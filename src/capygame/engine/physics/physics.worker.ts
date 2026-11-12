/// <reference lib="webworker" />
import RAPIER from '@dimforge/rapier3d-compat';
import { ZONE_LOCATIONS } from '../../types';
import {
  PHYSICS_SAB_FLOAT_COUNT,
  type PhysicsTransportMode,
  type PhysicsWorkerInboundMessage,
  type PhysicsWorkerOutboundMessage,
  type StaticBoxColliderSpec,
  type StaticCircleColliderSpec,
} from './PhysicsTypes';
import {
  CONTIGUOUS_BRIDGES,
  ShallowWaterFluidSolver,
  XpbdSoftBodySolver,
} from './ContiguousWorldTopology';

/**
 * Dedicated Multi-Threaded 3D Physics Web Worker (`physics.worker.ts`)
 *
 * Executes off the main render thread:
 * 1. `@dimforge/rapier3d-compat` Wasm SIMD Rigid-Body & Swept-CCD world (`120 Hz` internal substeps)
 * 2. Torque-balanced dynamic See-Saw rigid body + KinematicVelocityBased spinning sweeper bars
 * 3. Shallow-Water 2D Saint-Venant Fluid Grid + XPBD Volumetric Soft-Body Pads
 * 4. Lock-free SharedArrayBuffer + Atomics seqlock publication (with automatic zero-copy
 *    transferable Float32Array ping-pong fallback when crossOriginIsolated === false).
 */

declare const self: DedicatedWorkerGlobalScope;

let wasmReady = false;
let world: RAPIER.World | null = null;
let transportMode: PhysicsTransportMode = 'transferable_worker';
let sabInt32: Int32Array | null = null;
let sabFloat32: Float32Array | null = null;

const fluidSolver = new ShallowWaterFluidSolver();
const softBodySolver = new XpbdSoftBodySolver();

let staticHandles: number[] = [];
let paddleBody: RAPIER.RigidBody | null = null;
let hammerBodies: RAPIER.RigidBody[] = [];
let seeSawBody: RAPIER.RigidBody | null = null;
let breakoutBallBodies: RAPIER.RigidBody[] = [];

function buildStaticColliders(
  w: RAPIER.World,
  circles: StaticCircleColliderSpec[],
  boxes: StaticBoxColliderSpec[]
): void {
  for (let i = 0; i < staticHandles.length; i++) {
    const col = w.getCollider(staticHandles[i]);
    if (col) w.removeCollider(col, false);
  }
  staticHandles = [];

  // Contiguous world floor slabs: Sanctuary, 4 Grand Promenade Causeways, and 4 Minigame Districts
  const groundSlab = RAPIER.ColliderDesc.cuboid(140, 0.5, 140)
    .setTranslation(0, -0.5, 0)
    .setFriction(0.65);
  staticHandles.push(w.createCollider(groundSlab).handle);

  for (let i = 0; i < CONTIGUOUS_BRIDGES.length; i++) {
    const b = CONTIGUOUS_BRIDGES[i];
    const midX = (b.startX + b.endX) * 0.5;
    const midZ = (b.startZ + b.endZ) * 0.5;
    const yaw = Math.atan2(b.dirX, b.dirZ);
    const halfYaw = yaw * 0.5;
    const deck = RAPIER.ColliderDesc.cuboid(b.halfWidth, 0.25, b.length * 0.5)
      .setTranslation(midX, -0.18, midZ)
      .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) });
    staticHandles.push(w.createCollider(deck).handle);
  }

  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    const desc = RAPIER.ColliderDesc.cylinder(c.height * 0.5, c.radius)
      .setTranslation(c.wx, c.height * 0.5, c.wz)
      .setRestitution(c.restitution);
    staticHandles.push(w.createCollider(desc).handle);
  }

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const halfYaw = (b.rotY ?? 0) * 0.5;
    const desc = RAPIER.ColliderDesc.cuboid(b.halfX, b.halfY, b.halfZ)
      .setTranslation(b.wx, b.wy, b.wz)
      .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) })
      .setRestitution(b.restitution)
      .setFriction(b.friction);
    staticHandles.push(w.createCollider(desc).handle);
  }
}

function initDynamicArenaBodies(w: RAPIER.World): void {
  // 1. Breakout Kinematic Deflector Paddle (+75, -75)
  const bz = ZONE_LOCATIONS.breakout;
  const paddleDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
    bz.x,
    0.5,
    bz.z + 9.2
  );
  paddleBody = w.createRigidBody(paddleDesc);
  w.createCollider(
    RAPIER.ColliderDesc.cuboid(1.9, 0.4, 0.45).setRestitution(1.02).setFriction(0.05),
    paddleBody
  );

  // 2. Swept-CCD Breakout Yuzu Ball (`ccdEnabled = true` prevents tunneling at any speed)
  breakoutBallBodies = [];
  const ballDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(bz.x, 0.5, bz.z + 6.5)
    .setLinvel(4.2, 0, -9.2)
    .setCcdEnabled(true)
    .setLinearDamping(0.0)
    .lockTranslations();
  // Allow X/Z motion by unlocking enabled translations on dynamic body
  const dynamicBallDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(bz.x, 0.5, bz.z + 6.5)
    .setLinvel(4.2, 0, -9.2)
    .setGravityScale(0.0)
    .setCcdEnabled(true);
  void ballDesc;
  const ballBody = w.createRigidBody(dynamicBallDesc);
  w.createCollider(
    RAPIER.ColliderDesc.ball(0.38).setRestitution(1.0).setFriction(0.0),
    ballBody
  );
  breakoutBallBodies.push(ballBody);

  // 3. Yuzu Mountain Kinematic Sweeper Hammers (+75, +75)
  const fz = ZONE_LOCATIONS.fallguys;
  hammerBodies = [];
  for (const zOff of [-12, -20]) {
    const hBody = w.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(fz.x, 1.15, fz.z + zOff)
    );
    w.createCollider(
      RAPIER.ColliderDesc.cuboid(4.75, 0.38, 0.38).setRestitution(0.85),
      hBody
    );
    hammerBodies.push(hBody);
  }

  // 4. Torque-Balanced Dynamic See-Saw Plank (+75, +75, localZ = -33)
  const anchorBody = w.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(fz.x, 0.5, fz.z - 33.0)
  );
  seeSawBody = w.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(fz.x, 0.5, fz.z - 33.0)
      .setAngularDamping(2.6)
      .setLinearDamping(8.0)
  );
  w.createCollider(
    RAPIER.ColliderDesc.cuboid(5.0, 0.3, 6.0).setDensity(2.2).setFriction(0.75),
    seeSawBody
  );
  const jointParams = RAPIER.JointData.revolute(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }
  );
  w.createImpulseJoint(jointParams, anchorBody, seeSawBody, true);

  // 5. XPBD Soft-Body Pads (Yuzu Mountain Launch Pad + Sanctuary Mushroom Pads)
  softBodySolver.syncPads([
    { id: 'fallguys_launch_pad', wx: fz.x, wy: 0.5, wz: fz.z - 46.0, radius: 4.5 },
  ]);
}

function writeSnapshot(
  outFloat: Float32Array,
  stepMs: number,
  substeps: number,
  seeSawTilt: number
): void {
  outFloat[24] = stepMs;
  outFloat[25] = substeps;
  outFloat[26] = seeSawTilt;
  outFloat[27] = softBodySolver.pads[0]?.compression ?? 0;

  if (breakoutBallBodies.length > 0) {
    const bPos = breakoutBallBodies[0].translation();
    const bVel = breakoutBallBodies[0].linvel();
    outFloat[48] = bPos.x;
    outFloat[49] = bPos.y;
    outFloat[50] = bPos.z;
    outFloat[51] = bVel.x;
    outFloat[52] = bVel.y;
    outFloat[53] = bVel.z;
  }
}

self.onmessage = async (ev: MessageEvent<PhysicsWorkerInboundMessage>) => {
  const msg = ev.data;

  if (msg.type === 'init') {
    if (!wasmReady) {
      await RAPIER.init();
      wasmReady = true;
    }

    world = new RAPIER.World({ x: 0.0, y: -24.0, z: 0.0 });
    buildStaticColliders(world, msg.colliders.circles, msg.colliders.boxes);
    initDynamicArenaBodies(world);

    if (msg.sharedBuffer && typeof Atomics !== 'undefined') {
      transportMode = 'shared_array_buffer';
      sabInt32 = new Int32Array(msg.sharedBuffer);
      sabFloat32 = new Float32Array(msg.sharedBuffer);
      Atomics.store(sabInt32, 1, 1);
      Atomics.store(sabInt32, 2, world.bodies.len());
      Atomics.store(sabInt32, 3, world.colliders.len());
      Atomics.store(sabInt32, 4, softBodySolver.pads.length * 12);
      Atomics.store(sabInt32, 5, fluidSolver.cellCount);
    } else {
      transportMode = 'transferable_worker';
    }

    const readyReply: PhysicsWorkerOutboundMessage = {
      type: 'ready',
      wasmReady: true,
      transportMode,
      rigidBodyCount: world.bodies.len(),
      staticColliderCount: world.colliders.len(),
      softBodyNodes: Math.max(12, softBodySolver.pads.length * 12),
      fluidGridCells: fluidSolver.cellCount,
      stepDurationMs: 0,
      seeSawTilt0: 0,
      seeSawTilt1: 0,
    };
    self.postMessage(readyReply);
    return;
  }

  if (msg.type === 'rebuild_static' && world) {
    buildStaticColliders(world, msg.circles, msg.boxes);
    if (sabInt32) {
      Atomics.store(sabInt32, 3, world.colliders.len());
    }
    return;
  }

  if (msg.type === 'step' && world) {
    const t0 = performance.now();
    const clampedDt = Math.min(0.05, Math.max(0.001, msg.dt));
    const substeps = clampedDt > 0.018 ? 2 : 1;
    const subDt = clampedDt / substeps;
    world.timestep = subDt;

    // Update kinematic paddle & rotating hammers
    if (paddleBody) {
      paddleBody.setNextKinematicTranslation({
        x: ZONE_LOCATIONS.breakout.x + msg.paddleLocalX,
        y: 0.5,
        z: ZONE_LOCATIONS.breakout.z + 9.2,
      });
    }
    for (let h = 0; h < hammerBodies.length; h++) {
      const halfAngle = (msg.hammerAngles[h] ?? 0) * 0.5;
      hammerBodies[h].setNextKinematicRotation({
        x: 0,
        y: Math.sin(halfAngle),
        z: 0,
        w: Math.cos(halfAngle),
      });
    }

    // Apply physical character weight torque + restoring spring on dynamic See-Saw (I_z ~ 1325 kg*m^2)
    let seeSawTilt = 0;
    if (seeSawBody) {
      const fz = ZONE_LOCATIONS.fallguys;
      const relX = msg.heroWx - fz.x;
      const relZ = msg.heroWz - (fz.z - 33.0);
      if (Math.abs(relX) <= 5.2 && Math.abs(relZ) <= 6.2) {
        seeSawBody.applyTorqueImpulse({ x: 0, y: 0, z: -relX * 260.0 * clampedDt }, true);
      }
      const rot = seeSawBody.rotation();
      const sinHalfZ = rot.z;
      const cosHalfZ = rot.w;
      seeSawTilt = Math.max(-0.34, Math.min(0.34, 2 * Math.atan2(sinHalfZ, cosHalfZ)));
      // Torsional restoring spring so plank settles horizontally when unloaded
      seeSawBody.applyTorqueImpulse({ x: 0, y: 0, z: -seeSawTilt * 1850.0 * clampedDt }, true);
    }

    for (let s = 0; s < substeps; s++) {
      world.step();
    }

    const heroSpeed = Math.hypot(msg.desiredVx, msg.desiredVz);
    fluidSolver.step(clampedDt, msg.heroWx, msg.heroWz, heroSpeed);
    softBodySolver.step(clampedDt);

    const stepMs = +(performance.now() - t0).toFixed(3);

    if (transportMode === 'shared_array_buffer' && sabInt32 && sabFloat32) {
      // Lock-free seqlock write (odd = writing, even = committed)
      Atomics.add(sabInt32, 0, 1);
      writeSnapshot(sabFloat32, stepMs, substeps, seeSawTilt);
      Atomics.store(sabInt32, 2, world.bodies.len());
      Atomics.store(sabInt32, 3, world.colliders.len());
      Atomics.store(sabInt32, 6, substeps);
      Atomics.add(sabInt32, 0, 1);
    } else {
      const outBuf =
        msg.transferBuf && msg.transferBuf.length >= PHYSICS_SAB_FLOAT_COUNT
          ? msg.transferBuf
          : new Float32Array(PHYSICS_SAB_FLOAT_COUNT);
      writeSnapshot(outBuf, stepMs, substeps, seeSawTilt);
      const reply: PhysicsWorkerOutboundMessage = {
        type: 'stepped',
        wasmReady: true,
        transportMode: 'transferable_worker',
        rigidBodyCount: world.bodies.len(),
        staticColliderCount: world.colliders.len(),
        softBodyNodes: Math.max(12, softBodySolver.pads.length * 12),
        fluidGridCells: fluidSolver.cellCount,
        stepDurationMs: stepMs,
        seeSawTilt0: seeSawTilt,
        seeSawTilt1: 0,
        transferBuf: outBuf,
      };
      self.postMessage(reply, [outBuf.buffer]);
    }
  }
};
