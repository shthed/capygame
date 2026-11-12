import type { PlayStyle } from '../../types';

/**
 * Shared memory & worker message protocol for the CapyGame 3D Multiphysics Engine:
 * - Rigid-Body Dynamics & Swept Continuous Collision Detection (Rapier3D Wasm + substep TOI)
 * - Physical Character Controller (Kinematic/Dynamic blending, autostep, slope slide, zero mesh clipping)
 * - Volumetric XPBD Soft-Body Deformation (tetrahedral volume-preserving shells & bouncy mushroom pads)
 * - Real-Time Shallow-Water + SPH Fluid Buoyancy & Hydrodynamic Drag (Home Pool, Spore Lagoon, Coastal Shallows)
 * - Lock-free SharedArrayBuffer + Atomics triple-buffer when crossOriginIsolated === true,
 *   with automatic zero-copy transferable Float32Array ping-pong fallback in cross-origin iframes.
 */

export type PhysicsTransportMode = 'shared_array_buffer' | 'transferable_worker' | 'main_thread_wasm';

export interface StaticCircleColliderSpec {
  id: string;
  wx: number;
  wz: number;
  radius: number;
  height: number;
  restitution: number;
  kind: 'tree' | 'boulder' | 'building' | 'pillar';
}

export interface StaticBoxColliderSpec {
  id: string;
  wx: number;
  wy: number;
  wz: number;
  halfX: number;
  halfY: number;
  halfZ: number;
  rotY?: number;
  restitution: number;
  friction: number;
  kind: 'wall' | 'platform' | 'bridge_curb' | 'ramp';
}

export interface DynamicSphereState {
  id: number;
  wx: number;
  wy: number;
  wz: number;
  vx: number;
  vy: number;
  vz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  radius: number;
  submergedRatio: number;
  softSquash: number;
}

export interface SoftBodyPadState {
  id: string;
  wx: number;
  wy: number;
  wz: number;
  radius: number;
  compression: number; // [0..0.42] volumetric XPBD compression
  velocityY: number;
  volumeError: number;
}

export interface SeeSawRigidState {
  index: number;
  wx: number;
  wy: number;
  wz: number;
  tiltAngleZ: number;
  angularVelZ: number;
  halfWidth: number;
  halfDepth: number;
}

export interface FluidSampleResult {
  inFluid: boolean;
  surfaceY: number;
  depth: number;
  waveHeight: number;
  flowVx: number;
  flowVz: number;
  buoyancyAccelY: number;
  dragFactor: number;
}

export interface CharacterStepInput {
  wx: number;
  wy: number;
  wz: number;
  vx: number;
  vy: number;
  vz: number;
  desiredMoveVx: number;
  desiredMoveVz: number;
  radius: number;
  halfHeight: number;
  jumpImpulseY: number;
  gravityScale: number;
  dt: number;
}

export interface CharacterStepResult {
  wx: number;
  wy: number;
  wz: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  groundY: number;
  inFluid: boolean;
  fluidSubmergence: number;
  ccdSubsteps: number;
  hitTreeId: string | null;
  hitNormalX: number;
  hitNormalZ: number;
  trampolineBoostY: number;
  hammerImpulseX: number;
  hammerImpulseY: number;
  hammerImpulseZ: number;
  activeDistrict: PlayStyle;
}

export interface PhysicsEngineTelemetry {
  wasmInitialized: boolean;
  workerActive: boolean;
  transportMode: PhysicsTransportMode;
  rigidBodyCount: number;
  staticColliderCount: number;
  softBodyNodes: number;
  fluidGridCells: number;
  ccdEnabled: boolean;
  lastStepSubsteps: number;
  stepDurationMs: number;
  activeDistrict: PlayStyle;
  worldX: number;
  worldY: number;
  worldZ: number;
}

/**
 * SharedArrayBuffer Layout (Float32Array / Int32Array views over 4096 bytes = 1024 float32 slots):
 * - Slots [0..7]: Int32 Atomics Header:
 *   0: sequenceCounter (even = stable, odd = writer active)
 *   1: workerReadyFlag (1 = Rapier3D Wasm + Worker initialized)
 *   2: rigidBodyCount
 *   3: staticColliderCount
 *   4: softBodyNodeCount
 *   5: fluidCellCount
 *   6: lastSubsteps
 *   7: commandEpoch
 * - Slots [8..23]: Main -> Worker Command Input (dt, desiredVx, desiredVz, heroWx, heroWy, heroWz, jumpY, paddleX, hammerAngles...)
 * - Slots [24..47]: Worker -> Main Character + SeeSaw + Fluid Telemetry Snapshot
 * - Slots [48..255]: Dynamic Rigid-Body Transforms (Breakout multiballs, fruits, soft-body pads)
 */
export const PHYSICS_SAB_FLOAT_COUNT = 512;
export const PHYSICS_SAB_BYTE_LENGTH = PHYSICS_SAB_FLOAT_COUNT * 4;

export interface WorkerInitMessage {
  type: 'init';
  sharedBuffer?: SharedArrayBuffer;
  colliders: {
    circles: StaticCircleColliderSpec[];
    boxes: StaticBoxColliderSpec[];
  };
}

export interface WorkerStepMessage {
  type: 'step';
  epoch: number;
  dt: number;
  heroWx: number;
  heroWy: number;
  heroWz: number;
  desiredVx: number;
  desiredVz: number;
  paddleLocalX: number;
  hammerAngles: [number, number];
  transferBuf?: Float32Array;
}

export interface WorkerRebuildStaticMessage {
  type: 'rebuild_static';
  circles: StaticCircleColliderSpec[];
  boxes: StaticBoxColliderSpec[];
}

export type PhysicsWorkerInboundMessage =
  | WorkerInitMessage
  | WorkerStepMessage
  | WorkerRebuildStaticMessage;

export interface PhysicsWorkerOutboundMessage {
  type: 'ready' | 'stepped';
  wasmReady: boolean;
  transportMode: PhysicsTransportMode;
  rigidBodyCount: number;
  staticColliderCount: number;
  softBodyNodes: number;
  fluidGridCells: number;
  stepDurationMs: number;
  seeSawTilt0: number;
  seeSawTilt1: number;
  transferBuf?: Float32Array;
}
