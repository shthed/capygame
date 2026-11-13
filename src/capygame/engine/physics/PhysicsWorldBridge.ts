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
import {
  resolveCircleRotatedBox2D,
  type RotatedBoxCollisionResult,
} from './ColliderMath';

// Reusable zero-allocation result structs for character CCD stepping
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

const _obbScratch: RotatedBoxCollisionResult = {
  collided: false,
  wx: 0,
  wz: 0,
  nx: 0,
  nz: 0,
};

export class PhysicsWorldBridge {
  private worker: Worker | null = null;
  private sab: SharedArrayBuffer | null = null;
  private sabInt32: Int32Array | null = null;
  private sabFloat32: Float32Array | null = null;
  private pingPongBuf: Float32Array | null = new Float32Array(PHYSICS_SAB_FLOAT_COUNT);
  private workerInFlight = false;
  private stepEpoch = 0;

  private workerReady = false;
  private transportMode: PhysicsTransportMode = 'transferable_worker';

  private staticCircles: StaticCircleColliderSpec[] = [];
  private staticBoxes: StaticBoxColliderSpec[] = [];

  public readonly fluidSolver = new ShallowWaterFluidSolver();
  public readonly softBodySolver = new XpbdSoftBodySolver();

  private homePoolSpec: { x: number; z: number; radius: number; waterY: number } | null = null;
  private seeSawTilt0 = 0;
  private seeSawAngVel0 = 0;
  private seesawStiffnessScale = 1.0;
  private waterWaveSpeedScale = 1.0;
  private fluidViscosityScale = 1.0;
  private trampolineBoostMultiplier = 1.0;
  private rigidBodyCount = 11;
  private staticColliderCount = 0;
  private lastSubsteps = 1;
  private lastStepDurationMs = 0.25;
  private activeDistrict: PlayStyle = 'sanctuary';
  private lastHeroWx = 0;
  private lastHeroWy = 0;
  private lastHeroWz = 4;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof Worker === 'undefined') return;
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

        if (
          data.type === 'ready' &&
          this.worker &&
          (this.staticCircles.length > 0 || this.staticBoxes.length > 0)
        ) {
          this.worker.postMessage({
            type: 'rebuild_static',
            circles: this.staticCircles,
            boxes: this.staticBoxes,
          });
        }

        if (data.type === 'stepped') {
          this.workerInFlight = false;
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

  public setHomePoolSpec(spec: { x: number; z: number; radius: number; waterY: number }): void {
    this.homePoolSpec = spec;
  }

  public setPhysicsTuning(opts: {
    seesawStiffnessScale?: number;
    waterWaveSpeedScale?: number;
    fluidViscosityScale?: number;
    trampolineBoostMultiplier?: number;
  }): void {
    if (typeof opts.seesawStiffnessScale === 'number') {
      this.seesawStiffnessScale = Math.max(0.25, Math.min(3.0, opts.seesawStiffnessScale));
    }
    if (typeof opts.waterWaveSpeedScale === 'number') {
      this.waterWaveSpeedScale = Math.max(0.2, Math.min(3.5, opts.waterWaveSpeedScale));
    }
    if (typeof opts.fluidViscosityScale === 'number') {
      this.fluidViscosityScale = Math.max(0.1, Math.min(3.0, opts.fluidViscosityScale));
    }
    if (typeof opts.trampolineBoostMultiplier === 'number') {
      this.trampolineBoostMultiplier = Math.max(0.5, Math.min(2.5, opts.trampolineBoostMultiplier));
    }
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

    if (this.worker && this.workerReady) {
      this.worker.postMessage({
        type: 'rebuild_static',
        circles,
        boxes,
      });
    }
  }

  /**
   * Reads lock-free SharedArrayBuffer snapshot telemetry if crossOriginIsolated is active.
   */
  private pollSharedBufferSnapshot(): void {
    if (!this.sabInt32 || !this.sabFloat32) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      const seqStart = Atomics.load(this.sabInt32, 0);
      if ((seqStart & 1) === 1) continue; // Worker currently writing
      const stepMs = this.sabFloat32[24];
      const substeps = this.sabFloat32[25];
      const seqEnd = Atomics.load(this.sabInt32, 0);
      if (seqStart === seqEnd) {
        this.lastStepDurationMs = stepMs;
        this.lastSubsteps = Math.max(1, Math.round(substeps));
        this.rigidBodyCount = Atomics.load(this.sabInt32, 2) || this.rigidBodyCount;
        this.staticColliderCount = Atomics.load(this.sabInt32, 3) || this.staticColliderCount;
        break;
      }
    }
  }

  /**
   * Executes a Continuous Collision Detection (CCD) sub-stepped character + world multiphysics tick:
   * - Subdivides large steps (`maxDisplacement <= 0.42 * radius`) so fast dashes/knockbacks never tunnel
   * - Projects against yaw-rotated OBB colliders (`rotY`), cylindrical trunks/pillars, and shoreline SDF curbs
   * - Couples Archimedes fluid buoyancy, XPBD soft-body mushroom pad compression,
   *   torque-balanced See-Saw plank tilt, and rotating hammer angular-momentum impulses.
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
    this.fluidSolver.step(
      dt,
      wx,
      wz,
      Math.hypot(totalVx, totalVz),
      this.waterWaveSpeedScale,
      this.fluidViscosityScale
    );
    this.softBodySolver.step(dt);

    // Authoritative torque-coupled See-Saw spring-damper integration
    {
      const fz = ZONE_LOCATIONS.fallguys;
      const relSeeX = wx - fz.x;
      const relSeeZ = wz - (fz.z - 33.0);
      let playerTorque = 0;
      if (Math.abs(relSeeX) <= 5.1 && Math.abs(relSeeZ) <= 6.2 && wy <= 1.4) {
        playerTorque = -relSeeX * 1.15;
      }
      const restoringTorque =
        -this.seeSawTilt0 * 9.5 * this.seesawStiffnessScale - this.seeSawAngVel0 * 3.2;
      this.seeSawAngVel0 += (playerTorque + restoringTorque) * dt;
      this.seeSawTilt0 = Math.max(
        -0.32,
        Math.min(0.32, this.seeSawTilt0 + this.seeSawAngVel0 * dt)
      );
    }

    for (let sub = 0; sub < ccdSubsteps; sub++) {
      wx += (input.desiredMoveVx + vx) * subDt;
      wz += (input.desiredMoveVz + vz) * subDt;

      // Exact Analytic Circle & Yaw-Rotated OBB Non-Clipping Projection
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
          const vDot = vx * nx + vz * nz;
          if (vDot < 0) {
            vx -= vDot * nx;
            vz -= vDot * nz;
          }
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
        const hit = resolveCircleRotatedBox2D(
          wx,
          wz,
          input.radius,
          bx.wx,
          bx.wz,
          bx.halfX,
          bx.halfZ,
          bx.rotY ?? 0,
          _obbScratch
        );
        if (hit.collided) {
          wx = hit.wx;
          wz = hit.wz;
          const vDot = vx * hit.nx + vz * hit.nz;
          if (vDot < 0) {
            vx -= vDot * hit.nx;
            vz -= vDot * hit.nz;
          }
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
        const launchVy = this.softBodySolver.applyImpact(
          pad.id,
          Math.max(4.0, -vy),
          this.trampolineBoostMultiplier
        );
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

  public resetSeeSaw(): void {
    this.seeSawTilt0 = 0;
    this.seeSawAngVel0 = 0;
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
      wasmInitialized: this.workerReady,
      workerActive: this.workerReady,
      transportMode: this.transportMode,
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
    this.workerReady = false;
  }
}
