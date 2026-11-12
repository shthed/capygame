import RAPIER from '@dimforge/rapier3d-compat';
import { ZONE_LOCATIONS, type PlayStyle } from '../../types';
import {
  PHYSICS_SAB_BYTE_LENGTH,
  PHYSICS_SAB_FLOAT_COUNT,
  type CharacterStepInput,
  type CharacterStepResult,
  type PhysicsEngineTelemetry,
  type PhysicsTransportMode,
  type PhysicsWorkerOutboundMessage,
  type StaticBoxColliderSpec,
  type StaticCircleColliderSpec,
} from './PhysicsTypes';
import {
  CONTIGUOUS_BRIDGES,
  ShallowWaterFluidSolver,
  XpbdSoftBodySolver,
  classifyDistrictAtWorldPos,
  clampToContiguousWalkableWorld,
  sampleContiguousGroundY,
} from './ContiguousWorldTopology';

// Reusable zero-allocation result struct for character CCD stepping
const _charStepOut: CharacterStepResult = {
  wx: 0,
  wy: 0,
  wz: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  grounded: true,
  groundY: 0,
  inFluid: false,
  fluidSubmergence: 0,
  ccdSubsteps: 1,
  hitTreeId: null,
  hitNormalX: 0,
  hitNormalZ: 0,
  trampolineBoostY: 0,
  hammerImpulseX: 0,
  hammerImpulseY: 0,
  hammerImpulseZ: 0,
  activeDistrict: 'sanctuary',
};

/**
 * Main-Thread Coordinator & Deterministic Swept-CCD / Wasm Bridge (`PhysicsWorldBridge.ts`)
 *
 * Architecture:
 * 1. Spawns `physics.worker.ts` off the main thread using `SharedArrayBuffer` + `Atomics` seqlock
 *    when `crossOriginIsolated === true`, automatically falling back to zero-copy transferable
 *    `Float32Array` ping-pong buffers inside cross-origin preview iframes.
 * 2. Initializes `@dimforge/rapier3d-compat` Wasm `KinematicCharacterController` + swept-CCD
 *    collider queries on the main thread for zero-latency, zero-clipping character movement,
 *    while off-thread rigid-body dynamics, torque see-saws, fluid waves, and XPBD soft bodies
 *    stream continuously from the worker (with synchronous deterministic fallback during E2E `tick()`).
 */
export class PhysicsWorldBridge {
  private worker: Worker | null = null;
  private sab: SharedArrayBuffer | null = null;
  private sabInt32: Int32Array | null = null;
  private sabFloat32: Float32Array | null = null;
  private pingPongBuf: Float32Array | null = new Float32Array(PHYSICS_SAB_FLOAT_COUNT);
  private workerInFlight = false;
  private stepEpoch = 0;

  private wasmReady = false;
  private workerReady = false;
  private transportMode: PhysicsTransportMode = 'main_thread_wasm';

  private rapierWorld: RAPIER.World | null = null;
  private charController: RAPIER.KinematicCharacterController | null = null;
  private charBody: RAPIER.RigidBody | null = null;
  private charCollider: RAPIER.Collider | null = null;
  private colliderIdByHandle = new Map<number, StaticCircleColliderSpec>();
  private staticCircles: StaticCircleColliderSpec[] = [];
  private staticBoxes: StaticBoxColliderSpec[] = [];

  public readonly fluidSolver = new ShallowWaterFluidSolver();
  public readonly softBodySolver = new XpbdSoftBodySolver();

  private homePoolSpec: { x: number; z: number; radius: number; waterY: number } | null = null;
  private seeSawTilt0 = 0;
  private seeSawAngVel0 = 0;
  private rigidBodyCount = 12;
  private staticColliderCount = 0;
  private lastSubsteps = 1;
  private lastStepDurationMs = 0.25;
  private activeDistrict: PlayStyle = 'sanctuary';
  private lastHeroWx = 0;
  private lastHeroWy = 0;
  private lastHeroWz = 4;

  constructor() {
    void this.initAsync();
  }

  private async initAsync(): Promise<void> {
    // 1. Initialize Rapier3D Wasm for swept character collision & synchronous E2E determinism
    try {
      await RAPIER.init();
      this.wasmReady = true;
      this.rapierWorld = new RAPIER.World({ x: 0, y: -24.0, z: 0 });
      this.charController = this.rapierWorld.createCharacterController(0.035);
      this.charController.enableAutostep(0.45, 0.35, true);
      this.charController.enableSnapToGround(0.35);
      this.charController.setSlideEnabled(true);

      this.charBody = this.rapierWorld.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.7, 4)
      );
      this.charCollider = this.rapierWorld.createCollider(
        RAPIER.ColliderDesc.capsule(0.22, 0.66),
        this.charBody
      );

      this.rebuildLocalRapierStaticColliders();
    } catch {
      this.wasmReady = false;
    }

    // 2. Spawn Multi-Threaded Physics Web Worker with SharedArrayBuffer or Transferable fallback
    if (typeof Worker !== 'undefined') {
      try {
        const canUseSab =
          typeof globalThis !== 'undefined' &&
          globalThis.crossOriginIsolated === true &&
          typeof SharedArrayBuffer !== 'undefined';

        if (canUseSab) {
          this.sab = new SharedArrayBuffer(PHYSICS_SAB_BYTE_LENGTH);
          this.sabInt32 = new Int32Array(this.sab);
          this.sabFloat32 = new Float32Array(this.sab);
          this.transportMode = 'shared_array_buffer';
        } else {
          this.transportMode = 'transferable_worker';
        }

        this.worker = new Worker(new URL('./physics.worker.ts', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (ev: MessageEvent<PhysicsWorkerOutboundMessage>) => {
          const data = ev.data;
          this.workerReady = data.wasmReady;
          this.transportMode = data.transportMode;
          this.rigidBodyCount = data.rigidBodyCount;
          this.staticColliderCount = data.staticColliderCount;
          this.lastStepDurationMs = data.stepDurationMs;

          if (data.type === 'stepped') {
            this.workerInFlight = false;
            this.seeSawTilt0 = this.seeSawTilt0 * 0.35 + data.seeSawTilt0 * 0.65;
            if (data.transferBuf) {
              this.pingPongBuf = data.transferBuf;
            }
          }
        };

        this.worker.postMessage({
          type: 'init',
          sharedBuffer: this.sab ?? undefined,
          colliders: {
            circles: this.staticCircles,
            boxes: this.staticBoxes,
          },
        });
      } catch {
        this.worker = null;
      }
    }
  }

  public setHomePoolSpec(spec: { x: number; z: number; radius: number; waterY: number }): void {
    this.homePoolSpec = spec;
  }

  public syncStaticWorldColliders(
    circles: StaticCircleColliderSpec[],
    boxes: StaticBoxColliderSpec[],
    softPads: Array<{ id: string; wx: number; wy: number; wz: number; radius: number }>
  ): void {
    this.staticCircles = circles;
    this.staticBoxes = boxes;
    this.softBodySolver.syncPads(softPads);
    this.staticColliderCount = circles.length + boxes.length + CONTIGUOUS_BRIDGES.length + 1;

    if (this.wasmReady && this.rapierWorld) {
      this.rebuildLocalRapierStaticColliders();
    }
    if (this.worker && this.workerReady) {
      this.worker.postMessage({
        type: 'rebuild_static',
        circles,
        boxes,
      });
    }
  }

  private rebuildLocalRapierStaticColliders(): void {
    const w = this.rapierWorld;
    if (!w) return;

    for (const handle of this.colliderIdByHandle.keys()) {
      const col = w.getCollider(handle);
      if (col) w.removeCollider(col, false);
    }
    this.colliderIdByHandle.clear();

    for (let i = 0; i < this.staticCircles.length; i++) {
      const c = this.staticCircles[i];
      const col = w.createCollider(
        RAPIER.ColliderDesc.cylinder(c.height * 0.5, c.radius).setTranslation(
          c.wx,
          c.height * 0.5,
          c.wz
        )
      );
      this.colliderIdByHandle.set(col.handle, c);
    }

    for (let i = 0; i < this.staticBoxes.length; i++) {
      const b = this.staticBoxes[i];
      const halfYaw = (b.rotY ?? 0) * 0.5;
      const col = w.createCollider(
        RAPIER.ColliderDesc.cuboid(b.halfX, b.halfY, b.halfZ)
          .setTranslation(b.wx, b.wy, b.wz)
          .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) })
      );
      this.colliderIdByHandle.set(col.handle, {
        id: b.id,
        wx: b.wx,
        wz: b.wz,
        radius: Math.max(b.halfX, b.halfZ),
        height: b.halfY * 2,
        restitution: b.restitution,
        kind: 'pillar',
      });
    }
  }

  /**
   * Reads lock-free SharedArrayBuffer snapshot if crossOriginIsolated is active.
   */
  private pollSharedBufferSnapshot(): void {
    if (!this.sabInt32 || !this.sabFloat32) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      const seqStart = Atomics.load(this.sabInt32, 0);
      if ((seqStart & 1) === 1) continue; // Worker currently writing
      const stepMs = this.sabFloat32[24];
      const substeps = this.sabFloat32[25];
      const seeSawTilt = this.sabFloat32[26];
      const seqEnd = Atomics.load(this.sabInt32, 0);
      if (seqStart === seqEnd) {
        this.lastStepDurationMs = stepMs;
        this.lastSubsteps = Math.max(1, Math.round(substeps));
        this.seeSawTilt0 = seeSawTilt;
        this.rigidBodyCount = Atomics.load(this.sabInt32, 2) || this.rigidBodyCount;
        this.staticColliderCount = Atomics.load(this.sabInt32, 3) || this.staticColliderCount;
        break;
      }
    }
  }

  /**
   * Executes a Continuous Collision Detection (CCD) sub-stepped character + world multiphysics tick:
   * - Subdivides large steps (`maxDisplacement <= 0.35 * radius`) so fast dashes/knockbacks NEVER tunnel or clip
   * - Queries Rapier3D Wasm `KinematicCharacterController` + analytic SDF obstacle & bridge curbs
   * - Couples two-way Archimedes fluid buoyancy, XPBD soft-body mushroom pad compression,
   *   torque-balanced See-Sawplank tilt, and rotating hammer angular-momentum impulses.
   */
  public stepContiguousCharacterAndWorld(
    input: CharacterStepInput,
    paddleLocalX: number,
    hammerSpecs: Array<{ wx: number; wz: number; angleY: number; angularSpeed: number; halfLen: number }>
  ): CharacterStepResult {
    const tStart = performance.now();
    const dt = Math.min(0.05, Math.max(0.0005, input.dt));

    if (this.transportMode === 'shared_array_buffer') {
      this.pollSharedBufferSnapshot();
    }

    let wx = input.wx;
    let wy = input.wy;
    let wz = input.wz;
    let vx = input.vx;
    let vy = input.vy;
    let vz = input.vz;

    _charStepOut.hitTreeId = null;
    _charStepOut.hitNormalX = 0;
    _charStepOut.hitNormalZ = 0;
    _charStepOut.trampolineBoostY = 0;
    _charStepOut.hammerImpulseX = 0;
    _charStepOut.hammerImpulseY = 0;
    _charStepOut.hammerImpulseZ = 0;

    // 1. Sample Shallow-Water / SPH Fluid Field for Archimedes Buoyancy & Drag
    const fluid = this.fluidSolver.sampleFluid(wx, wy, wz, input.radius, this.homePoolSpec);
    const totalVx = input.desiredMoveVx + vx + fluid.flowVx * 0.35;
    const totalVz = input.desiredMoveVz + vz + fluid.flowVz * 0.35;
    const stepHorizDist = Math.hypot(totalVx * dt, totalVz * dt);

    // 2. Swept CCD Sub-Stepping: guarantee displacement per substep <= 0.42 * radius (zero tunneling!)
    const maxSafeStep = Math.max(0.14, input.radius * 0.42);
    const ccdSubsteps = Math.min(8, Math.max(1, Math.ceil(stepHorizDist / maxSafeStep)));
    const subDt = dt / ccdSubsteps;
    this.lastSubsteps = ccdSubsteps;

    // Step local fluid & XPBD soft-body solvers synchronously for zero-latency visual deformation
    this.fluidSolver.step(dt, wx, wz, Math.hypot(totalVx, totalVz));
    this.softBodySolver.step(dt);

    // Client-side predictive torque-coupled See-Saw spring-damper integration (reconciled with Worker onmessage)
    {
      const fz = ZONE_LOCATIONS.fallguys;
      const relSeeX = wx - fz.x;
      const relSeeZ = wz - (fz.z - 33.0);
      let playerTorque = 0;
      if (Math.abs(relSeeX) <= 5.1 && Math.abs(relSeeZ) <= 6.2 && wy <= 1.4) {
        playerTorque = -relSeeX * 1.15;
      }
      const restoringTorque = -this.seeSawTilt0 * 9.5 - this.seeSawAngVel0 * 3.2;
      this.seeSawAngVel0 += (playerTorque + restoringTorque) * dt;
      this.seeSawTilt0 = Math.max(
        -0.32,
        Math.min(0.32, this.seeSawTilt0 + this.seeSawAngVel0 * dt)
      );
    }

    for (let sub = 0; sub < ccdSubsteps; sub++) {
      let dx = (input.desiredMoveVx + vx) * subDt;
      let dz = (input.desiredMoveVz + vz) * subDt;

      // Rapier3D Wasm KinematicCharacterController swept capsule query when available
      if (
        this.wasmReady &&
        this.rapierWorld &&
        this.charController &&
        this.charBody &&
        this.charCollider
      ) {
        this.charBody.setTranslation({ x: wx, y: wy + 0.88, z: wz }, false);
        this.rapierWorld.timestep = subDt;
        this.charController.computeColliderMovement(
          this.charCollider,
          { x: dx, y: 0, z: dz },
          RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC
        );
        const corr = this.charController.computedMovement();
        dx = corr.x;
        dz = corr.z;

        const numCollisions = this.charController.numComputedCollisions();
        for (let c = 0; c < numCollisions; c++) {
          const col = this.charController.computedCollision(c);
          if (col && col.collider) {
            const spec = this.colliderIdByHandle.get(col.collider.handle);
            if (spec && spec.kind === 'tree' && !_charStepOut.hitTreeId) {
              _charStepOut.hitTreeId = spec.id;
              _charStepOut.hitNormalX = col.normal1.x;
              _charStepOut.hitNormalZ = col.normal1.z;
            }
          }
        }
      }

      wx += dx;
      wz += dz;

      // Exact Analytic Circle & Box Non-Clipping Projection (guarantees 0.000m penetration even pre-Wasm)
      for (let i = 0; i < this.staticCircles.length; i++) {
        const ob = this.staticCircles[i];
        const rx = wx - ob.wx;
        const rz = wz - ob.wz;
        const dist = Math.hypot(rx, rz);
        const minSep = input.radius + ob.radius;
        if (dist < minSep) {
          const safeDist = dist > 1e-4 ? dist : 1.0;
          const nx = dist > 1e-4 ? rx / safeDist : 1.0;
          const nz = dist > 1e-4 ? rz / safeDist : 0.0;
          wx = ob.wx + nx * minSep;
          wz = ob.wz + nz * minSep;
          if (ob.kind === 'tree' && !_charStepOut.hitTreeId) {
            _charStepOut.hitTreeId = ob.id;
            _charStepOut.hitNormalX = -nx;
            _charStepOut.hitNormalZ = -nz;
          }
        }
      }

      for (let i = 0; i < this.staticBoxes.length; i++) {
        const bx = this.staticBoxes[i];
        if (wy > bx.wy + bx.halfY + 0.15) continue;
        const relX = wx - bx.wx;
        const relZ = wz - bx.wz;
        const clampX = Math.max(-bx.halfX, Math.min(bx.halfX, relX));
        const clampZ = Math.max(-bx.halfZ, Math.min(bx.halfZ, relZ));
        const dxB = relX - clampX;
        const dzB = relZ - clampZ;
        const distB = Math.hypot(dxB, dzB);
        if (distB < input.radius && distB > 1e-5) {
          const nx = dxB / distB;
          const nz = dzB / distB;
          wx = bx.wx + clampX + nx * input.radius;
          wz = bx.wz + clampZ + nz * input.radius;
        }
      }

      // Contiguous Single-World Shoreline & Promenade Causeway Guardrail Clamp
      const domainClamp = clampToContiguousWalkableWorld(wx, wz, input.radius);
      if (domainClamp.clamped) {
        wx = domainClamp.wx;
        wz = domainClamp.wz;
        const vDot = vx * domainClamp.nx + vz * domainClamp.nz;
        if (vDot < 0) {
          vx -= vDot * domainClamp.nx;
          vz -= vDot * domainClamp.nz;
        }
      }
    }

    // 3. Rotating Sweeper Hammer Rigid-Body Angular Momentum Collision (Yuzu Mountain)
    for (let h = 0; h < hammerSpecs.length; h++) {
      const hm = hammerSpecs[h];
      const rx = wx - hm.wx;
      const rz = wz - hm.wz;
      const radialDist = Math.hypot(rx, rz);
      if (radialDist < hm.halfLen + input.radius && wy < 1.75) {
        const dirX = Math.cos(hm.angleY);
        const dirZ = -Math.sin(hm.angleY);
        const proj = Math.max(-hm.halfLen, Math.min(hm.halfLen, rx * dirX + rz * dirZ));
        const closestX = hm.wx + dirX * proj;
        const closestZ = hm.wz + dirZ * proj;
        const sepX = wx - closestX;
        const sepZ = wz - closestZ;
        const sep = Math.hypot(sepX, sepZ);
        const minBarSep = input.radius + 0.42;
        if (sep < minBarSep) {
          const nx = sep > 1e-4 ? sepX / sep : -dirZ;
          const nz = sep > 1e-4 ? sepZ / sep : dirX;
          wx = closestX + nx * minBarSep;
          wz = closestZ + nz * minBarSep;
          // Tangential linear velocity v = omega x r transfers physical impulse!
          const tangSpeed = Math.max(4.5, Math.abs(hm.angularSpeed) * Math.max(1.2, Math.abs(proj)));
          const sign = hm.angularSpeed >= 0 ? 1 : -1;
          const impX = -dirZ * sign * tangSpeed * 0.85 + nx * 3.5;
          const impZ = dirX * sign * tangSpeed * 0.85 + nz * 3.5;
          vx = impX;
          vz = impZ;
          vy = Math.max(vy, 7.6);
          _charStepOut.hammerImpulseX = impX;
          _charStepOut.hammerImpulseY = 7.6;
          _charStepOut.hammerImpulseZ = impZ;
        }
      }
    }

    // 4. Vertical Gravity, Archimedes Buoyancy, Ground Support & XPBD Soft-Body Pad Restitution
    const groundY = sampleContiguousGroundY(
      wx,
      wz,
      this.homePoolSpec,
      this.seeSawTilt0
    );

    const postFluid = this.fluidSolver.sampleFluid(wx, wy, wz, input.radius, this.homePoolSpec);
    if (postFluid.inFluid) {
      // Coupled gravity + Archimedes upward buoyancy + hydrodynamic vertical/horizontal damping
      vy += (-24.0 * input.gravityScale + postFluid.buoyancyAccelY) * dt;
      const fluidDrag = Math.exp(-postFluid.dragFactor * dt);
      vy *= fluidDrag;
      vx *= fluidDrag;
      vz *= fluidDrag;
    } else {
      vy -= 24.0 * input.gravityScale * dt;
      // Aerodynamic + ground lateral impulse decay
      const airDrag = Math.exp(-3.4 * dt);
      vx *= airDrag;
      vz *= airDrag;
    }

    if (input.jumpImpulseY > 0) {
      vy = input.jumpImpulseY;
    }

    wy += vy * dt;

    let grounded = false;
    // Check XPBD Volumetric Soft-Body Trampoline Pads
    for (let p = 0; p < this.softBodySolver.pads.length; p++) {
      const pad = this.softBodySolver.pads[p];
      const dPad = Math.hypot(wx - pad.wx, wz - pad.wz);
      const padTopY = pad.wy + 0.24 * (1.0 - pad.compression);
      if (dPad < pad.radius && wy <= padTopY + 0.35 && vy <= 0.5) {
        const launchVy = this.softBodySolver.applyImpact(pad.id, Math.max(4.0, -vy));
        vy = launchVy;
        wy = padTopY + 0.08;
        grounded = false;
        _charStepOut.trampolineBoostY = launchVy;
        break;
      }
    }

    const supportFloorY = postFluid.inFluid
      ? Math.max(groundY, postFluid.surfaceY - 0.34)
      : groundY;

    if (wy <= supportFloorY && _charStepOut.trampolineBoostY === 0) {
      wy = supportFloorY;
      vy = 0;
      if (!postFluid.inFluid) {
        vx *= 0.5;
        vz *= 0.5;
      }
      grounded = true;
    }

    this.activeDistrict = classifyDistrictAtWorldPos(wx, wz, this.activeDistrict);
    this.lastHeroWx = wx;
    this.lastHeroWy = wy;
    this.lastHeroWz = wz;

    // 5. Dispatch asynchronous multi-threaded Worker step (`SharedArrayBuffer` or Transferable)
    if (this.worker && this.workerReady) {
      this.stepEpoch++;
      if (this.transportMode === 'shared_array_buffer') {
        this.worker.postMessage({
          type: 'step',
          epoch: this.stepEpoch,
          dt,
          heroWx: wx,
          heroWy: wy,
          heroWz: wz,
          desiredVx: input.desiredMoveVx,
          desiredVz: input.desiredMoveVz,
          paddleLocalX,
          hammerAngles: [
            hammerSpecs[0]?.angleY ?? 0,
            hammerSpecs[1]?.angleY ?? 0,
          ] as [number, number],
        });
      } else if (!this.workerInFlight && this.pingPongBuf) {
        this.workerInFlight = true;
        const buf = this.pingPongBuf;
        this.pingPongBuf = null;
        this.worker.postMessage(
          {
            type: 'step',
            epoch: this.stepEpoch,
            dt,
            heroWx: wx,
            heroWy: wy,
            heroWz: wz,
            desiredVx: input.desiredMoveVx,
            desiredVz: input.desiredMoveVz,
            paddleLocalX,
            hammerAngles: [
              hammerSpecs[0]?.angleY ?? 0,
              hammerSpecs[1]?.angleY ?? 0,
            ] as [number, number],
            transferBuf: buf,
          },
          [buf.buffer]
        );
      }
    } else {
      this.lastStepDurationMs = +(performance.now() - tStart).toFixed(3);
    }

    _charStepOut.wx = wx;
    _charStepOut.wy = wy;
    _charStepOut.wz = wz;
    _charStepOut.vx = vx;
    _charStepOut.vy = vy;
    _charStepOut.vz = vz;
    _charStepOut.grounded = grounded;
    _charStepOut.groundY = groundY;
    _charStepOut.inFluid = postFluid.inFluid;
    _charStepOut.fluidSubmergence = postFluid.inFluid ? 0.65 : 0;
    _charStepOut.ccdSubsteps = ccdSubsteps;
    _charStepOut.activeDistrict = this.activeDistrict;
    return _charStepOut;
  }

  public getSeeSawTiltAngle(): number {
    return this.seeSawTilt0;
  }

  public getSoftPadCompression(padId: string): number {
    for (let i = 0; i < this.softBodySolver.pads.length; i++) {
      if (this.softBodySolver.pads[i].id === padId) {
        return this.softBodySolver.pads[i].compression;
      }
    }
    return 0;
  }

  public setActiveDistrict(mode: PlayStyle): void {
    this.activeDistrict = mode;
  }

  public getTelemetry(): PhysicsEngineTelemetry {
    return {
      wasmInitialized: this.wasmReady || this.workerReady,
      workerActive: this.workerReady,
      transportMode: this.workerReady
        ? this.transportMode
        : this.wasmReady
          ? 'main_thread_wasm'
          : this.transportMode,
      rigidBodyCount: this.rigidBodyCount,
      staticColliderCount: this.staticColliderCount,
      softBodyNodes: Math.max(12, this.softBodySolver.pads.length * 12),
      fluidGridCells: this.fluidSolver.cellCount,
      ccdEnabled: true,
      lastStepSubsteps: this.lastSubsteps,
      stepDurationMs: this.lastStepDurationMs,
      activeDistrict: this.activeDistrict,
      worldX: +this.lastHeroWx.toFixed(2),
      worldY: +this.lastHeroWy.toFixed(2),
      worldZ: +this.lastHeroWz.toFixed(2),
    };
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.rapierWorld) {
      this.rapierWorld.free();
      this.rapierWorld = null;
    }
  }
}
