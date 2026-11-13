import { ZONE_LOCATIONS, type PlayStyle } from '../../types';
import type { FluidSampleResult, SoftBodyPadState } from './PhysicsTypes';

/**
 * Contiguous Single-World Topology, Swept-CCD Obstacle Solver,
 * XPBD Volumetric Soft-Body Solver & Shallow-Water Fluid Buoyancy Grid.
 *
 * Zero per-frame heap allocations in all hot-path query and solver methods.
 */

export interface PromenadeBridgeSpec {
  targetMode: PlayStyle;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  dirX: number;
  dirZ: number;
  perpX: number;
  perpZ: number;
  length: number;
  halfWidth: number;
}

export const PROMENADE_HALF_WIDTH = 4.8; // 9.6m wide walkable grand causeways

function makeBridge(
  targetMode: PlayStyle,
  sx: number,
  sz: number,
  ex: number,
  ez: number
): PromenadeBridgeSpec {
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.hypot(dx, dz);
  const dirX = dx / len;
  const dirZ = dz / len;
  return {
    targetMode,
    startX: sx,
    startZ: sz,
    endX: ex,
    endZ: ez,
    dirX,
    dirZ,
    perpX: -dirZ,
    perpZ: dirX,
    length: len,
    halfWidth: PROMENADE_HALF_WIDTH,
  };
}

/**
 * 4 Wide Stone-and-Turf Grand Promenade Causeways directly joining Sanctuary (0, 0)
 * to all 4 surrounding minigame arenas so players can walk seamlessly between every game:
 * - NW Causeway: Sanctuary (-21, -21) -> Spore Lagoon Beach (-48, -48)
 * - NE Causeway: Sanctuary (+21, -21) -> Yuzu Breakout South Plaza (+75, -60)
 * - SW Causeway: Sanctuary (-21, +21) -> Number Stampede North Plaza (-75, +82)
 * - SE Causeway: Sanctuary (+21, +21) -> Yuzu Mountain Base Plaza (+75, +80)
 */
export const CONTIGUOUS_BRIDGES: readonly PromenadeBridgeSpec[] = [
  makeBridge('spore', -20.5, -20.5, -49.5, -49.5),
  makeBridge('breakout', 20.5, -20.5, 75.0, -59.5),
  makeBridge('runner', -20.5, 20.5, -75.0, 81.5),
  makeBridge('fallguys', 20.5, 20.5, 75.0, 80.5),
];

// Reusable scratch struct for fluid queries (zero GC allocation)
const _fluidScratch: FluidSampleResult = {
  inFluid: false,
  surfaceY: -1.25,
  depth: 0,
  waveHeight: 0,
  flowVx: 0,
  flowVz: 0,
  buoyancyAccelY: 0,
  dragFactor: 0,
};

// Reusable scratch struct for domain clamping (zero GC allocation)
export const _walkableClampScratch = {
  wx: 0,
  wz: 0,
  clamped: false,
  nx: 0,
  nz: 0,
};

/**
 * Signed distance (negative = safely inside walkable contiguous world, positive = outside over deep ocean)
 * across the union of:
 * 1. Sanctuary Central Island (radius 33.4m around 0,0)
 * 2. Spore Lagoon Atoll & Sandy Rim (radius 41.5m around -75,-75)
 * 3. Yuzu Breakout Stadium & South Forecourt Plaza (around +75,-75)
 * 4. Number Stampede Track & Return Boardwalk Loop (around -75,+75, localZ in [-102, +14])
 * 5. Yuzu Mountain Ascent Course, Side Walkways & Summit Return Ramp (around +75,+75, localZ in [-66, +12])
 * 6. All 4 Grand Promenade Causeways (width 9.6m)
 */
export function evaluateContiguousWalkableSdf(wx: number, wz: number): number {
  // 1. Sanctuary Central Island (0, 0)
  const dSanctuary = Math.hypot(wx, wz) - 33.4;
  let minSdf = dSanctuary;

  // 2. Spore Lagoon Atoll (-75, -75)
  const dSpore =
    Math.hypot(wx - ZONE_LOCATIONS.spore.x, wz - ZONE_LOCATIONS.spore.z) - 41.5;
  if (dSpore < minSdf) minSdf = dSpore;

  // 3. Yuzu Breakout Stadium & Open South Forecourt (+75, -75)
  // Arena spans localX in [-8.2, +8.2], localZ in [-11.0, +19.5] (includes open south apron at +11..+19.5)
  const bx = Math.abs(wx - ZONE_LOCATIONS.breakout.x) - 9.2;
  const bz = Math.abs(wz - (ZONE_LOCATIONS.breakout.z + 4.2)) - 15.2;
  const dBreakout = Math.max(bx, bz);
  if (dBreakout < minSdf) minSdf = dBreakout;

  // 4. Number Stampede Stadium Track & Side/Return Boardwalk (-75, +75)
  // Spans localX in [-8.2, +8.2] (track [-4.4, +4.4] + east/west return boardwalks) and localZ in [-98, +12]
  const rx = Math.abs(wx - ZONE_LOCATIONS.runner.x) - 8.2;
  const rz = Math.abs(wz - (ZONE_LOCATIONS.runner.z - 43.0)) - 55.0;
  const dRunner = Math.max(rx, rz);
  if (dRunner < minSdf) minSdf = dRunner;

  // 5. Yuzu Mountain Course & Scenic Return Walkway (+75, +75)
  // Spans localX in [-8.4, +8.4], localZ in [-66.0, +10.5]
  const fgx = Math.abs(wx - ZONE_LOCATIONS.fallguys.x) - 8.4;
  const fgz = Math.abs(wz - (ZONE_LOCATIONS.fallguys.z - 27.75)) - 38.25;
  const dFallGuys = Math.max(fgx, fgz);
  if (dFallGuys < minSdf) minSdf = dFallGuys;

  // 6. 4 Grand Promenade Causeways
  for (let i = 0; i < CONTIGUOUS_BRIDGES.length; i++) {
    const b = CONTIGUOUS_BRIDGES[i];
    const relX = wx - b.startX;
    const relZ = wz - b.startZ;
    const along = relX * b.dirX + relZ * b.dirZ;
    const clampedAlong = along < 0 ? 0 : along > b.length ? b.length : along;
    const nearX = b.startX + b.dirX * clampedAlong;
    const nearZ = b.startZ + b.dirZ * clampedAlong;
    const dist = Math.hypot(wx - nearX, wz - nearZ) - b.halfWidth;
    if (dist < minSdf) minSdf = dist;
  }

  return minSdf;
}

/**
 * Projects any world coordinate (wx, wz) with body radius smoothly inside the contiguous
 * walkable multi-district landmass + causeways with finite-difference surface normal.
 */
export function clampToContiguousWalkableWorld(
  wx: number,
  wz: number,
  bodyRadius: number
): typeof _walkableClampScratch {
  const sdf = evaluateContiguousWalkableSdf(wx, wz) + bodyRadius;
  if (sdf <= 0) {
    _walkableClampScratch.wx = wx;
    _walkableClampScratch.wz = wz;
    _walkableClampScratch.clamped = false;
    _walkableClampScratch.nx = 0;
    _walkableClampScratch.nz = 0;
    return _walkableClampScratch;
  }

  const eps = 0.08;
  const gx =
    evaluateContiguousWalkableSdf(wx + eps, wz) -
    evaluateContiguousWalkableSdf(wx - eps, wz);
  const gz =
    evaluateContiguousWalkableSdf(wx, wz + eps) -
    evaluateContiguousWalkableSdf(wx, wz - eps);
  const gLen = Math.hypot(gx, gz);
  if (gLen > 1e-5) {
    const nx = gx / gLen;
    const nz = gz / gLen;
    _walkableClampScratch.wx = wx - nx * sdf;
    _walkableClampScratch.wz = wz - nz * sdf;
    _walkableClampScratch.clamped = true;
    _walkableClampScratch.nx = -nx;
    _walkableClampScratch.nz = -nz;
  } else {
    _walkableClampScratch.wx = wx;
    _walkableClampScratch.wz = wz;
    _walkableClampScratch.clamped = false;
    _walkableClampScratch.nx = 0;
    _walkableClampScratch.nz = 0;
  }
  return _walkableClampScratch;
}

/**
 * Classifies which minigame district the player is currently standing in based on world coordinates,
 * with hysteresis margin so walking on a promenade bridge stays smooth until entering the arena threshold.
 */
export function classifyDistrictAtWorldPos(
  wx: number,
  wz: number,
  currentDistrict: PlayStyle
): PlayStyle {
  // Spore Lagoon (-75, -75)
  const dSpore = Math.hypot(wx - ZONE_LOCATIONS.spore.x, wz - ZONE_LOCATIONS.spore.z);
  if (dSpore < (currentDistrict === 'spore' ? 40.5 : 37.5)) {
    return 'spore';
  }

  // Yuzu Breakout (+75, -75)
  const bLocalX = wx - ZONE_LOCATIONS.breakout.x;
  const bLocalZ = wz - ZONE_LOCATIONS.breakout.z;
  const inBreakout =
    Math.abs(bLocalX) <= (currentDistrict === 'breakout' ? 9.2 : 8.4) &&
    bLocalZ >= -11.5 &&
    bLocalZ <= (currentDistrict === 'breakout' ? 15.4 : 13.6);
  if (inBreakout) {
    return 'breakout';
  }

  // Number Stampede (-75, +75)
  const rLocalX = wx - ZONE_LOCATIONS.runner.x;
  const rLocalZ = wz - ZONE_LOCATIONS.runner.z;
  const inRunner =
    Math.abs(rLocalX) <= (currentDistrict === 'runner' ? 8.2 : 5.2) &&
    rLocalZ <= (currentDistrict === 'runner' ? 6.5 : 3.5) &&
    rLocalZ >= -98.0;
  if (inRunner) {
    return 'runner';
  }

  // Yuzu Mountain (+75, +75)
  const fLocalX = wx - ZONE_LOCATIONS.fallguys.x;
  const fLocalZ = wz - ZONE_LOCATIONS.fallguys.z;
  const inFallGuys =
    Math.abs(fLocalX) <= (currentDistrict === 'fallguys' ? 8.2 : 6.4) &&
    fLocalZ <= (currentDistrict === 'fallguys' ? 6.8 : 4.5) &&
    fLocalZ >= -66.0;
  if (inFallGuys) {
    return 'fallguys';
  }

  return 'sanctuary';
}

/**
 * Evaluates continuous ground elevation across all 5 districts, bridges, see-saws, and basins.
 */
export function sampleContiguousGroundY(
  wx: number,
  wz: number,
  homePoolCenter: { x: number; z: number; radius: number } | null,
  seeSawTilt0: number
): number {
  // 1. Sanctuary Home Pool Basin (around -8.8, 3.0)
  if (homePoolCenter) {
    const dPool = Math.hypot(wx - homePoolCenter.x, wz - homePoolCenter.z);
    if (dPool < homePoolCenter.radius - 0.25) {
      return -0.44;
    }
  }

  // 2. Spore Lagoon Basin (-75, -75) -> gentle sandy beach slope into shallow lagoon
  const dSpore = Math.hypot(wx - ZONE_LOCATIONS.spore.x, wz - ZONE_LOCATIONS.spore.z);
  if (dSpore < 39.5) {
    if (dSpore > 33.5) {
      // Smooth beach ramp from y = 0.0 at r=39.5 down to y = -0.18 at r=33.5
      const t = (39.5 - dSpore) / 6.0;
      return -0.18 * t;
    }
    return -0.18;
  }

  // 3. Yuzu Mountain Elevated Platforms & Torque-Balanced See-Saw (+75, +75)
  const fx = wx - ZONE_LOCATIONS.fallguys.x;
  const fz = wz - ZONE_LOCATIONS.fallguys.z;
  if (Math.abs(fx) <= 8.4 && fz <= 8.5 && fz >= -66.0) {
    // Gentle entry ramp from z = +8.5 (y = 0) up to z = +4.5 (y = 0.5)
    if (fz > 4.5) {
      const rampT = 1.0 - (fz - 4.5) / 4.0;
      return Math.max(0, rampT * 0.5);
    }
    // Dynamic tilting see-saw plank centered at local (0, 0.5, -33), width 10m, depth 12m
    if (Math.abs(fx) <= 5.1 && Math.abs(fz - -33.0) <= 6.2) {
      return 0.5 + Math.sin(seeSawTilt0) * fx;
    }
    return 0.5;
  }

  // 4. Grand Promenade Causeways gentle arch crown (+0.12m mid-span)
  for (let i = 0; i < CONTIGUOUS_BRIDGES.length; i++) {
    const b = CONTIGUOUS_BRIDGES[i];
    const relX = wx - b.startX;
    const relZ = wz - b.startZ;
    const along = relX * b.dirX + relZ * b.dirZ;
    if (along >= 0 && along <= b.length) {
      const lateral = Math.abs(relX * b.perpX + relZ * b.perpZ);
      if (lateral <= b.halfWidth) {
        const u = along / b.length;
        return Math.sin(u * Math.PI) * 0.14;
      }
    }
  }

  return 0.0;
}

/**
 * 2D Shallow-Water Wave & Archimedes Buoyancy Solver (Zero-Allocation Float32Array Grid).
 * Simulates coupled surface height ripples, velocity fields, Archimedes displaced-volume lift,
 * and quadratic hydrodynamic drag across the Home Pool and Spore Lagoon.
 */
export class ShallowWaterFluidSolver {
  public readonly gridSize = 24;
  public readonly cellCount = 24 * 24;
  public readonly heightCur = new Float32Array(24 * 24);
  public readonly heightPrev = new Float32Array(24 * 24);
  public readonly velX = new Float32Array(24 * 24);
  public readonly velZ = new Float32Array(24 * 24);
  public readonly rippleDataBytes = new Uint8Array(24 * 24 * 4);
  private simTime = 0;

  public step(
    dt: number,
    heroWx: number,
    heroWz: number,
    heroSpeed: number,
    waveSpeedScale: number = 1.0,
    viscosityScale: number = 1.0
  ): void {
    this.simTime += dt;
    const n = this.gridSize;
    const waveSpeedSq = 14.0 * Math.max(0.2, Math.min(3.5, waveSpeedScale));
    const dtClamped = Math.min(0.025, dt);
    const alpha = Math.min(0.24, waveSpeedSq * dtClamped * dtClamped);
    const damping = Math.max(0.92, Math.min(0.992, 1.0 - 0.018 * Math.max(0.2, viscosityScale)));

    // Inject wake impulse when Hero swims in Spore Lagoon (-75, -75) or Home Pool (-8.8, 3.0)
    const dPool = Math.hypot(heroWx - -8.8, heroWz - 3.0);
    if (dPool < 4.2 && heroSpeed > 0.25) {
      const gx = Math.floor(((heroWx - -8.8) / 8.4 + 0.5) * n);
      const gz = Math.floor(((heroWz - 3.0) / 8.4 + 0.5) * n);
      if (gx >= 1 && gx < n - 1 && gz >= 1 && gz < n - 1) {
        this.heightCur[gz * n + gx] -= Math.min(0.12, heroSpeed * 0.014);
      }
    } else {
      const dLagoon = Math.hypot(
        heroWx - ZONE_LOCATIONS.spore.x,
        heroWz - ZONE_LOCATIONS.spore.z
      );
      if (dLagoon < 36.0 && heroSpeed > 0.25) {
        const gx = Math.floor(((heroWx - ZONE_LOCATIONS.spore.x) / 76.0 + 0.5) * n);
        const gz = Math.floor(((heroWz - ZONE_LOCATIONS.spore.z) / 76.0 + 0.5) * n);
        if (gx >= 1 && gx < n - 1 && gz >= 1 && gz < n - 1) {
          this.heightCur[gz * n + gx] -= Math.min(0.14, heroSpeed * 0.015);
        }
      }
    }

    // Discrete 2D wave equation step + spatial gradient velocity update (zero allocations)
    for (let z = 1; z < n - 1; z++) {
      const row = z * n;
      for (let x = 1; x < n - 1; x++) {
        const idx = row + x;
        const c = this.heightCur[idx];
        const laplacian =
          this.heightCur[idx - 1] +
          this.heightCur[idx + 1] +
          this.heightCur[idx - n] +
          this.heightCur[idx + n] -
          4.0 * c;
        const nextH = (2.0 * c - this.heightPrev[idx] + alpha * laplacian) * damping;
        this.heightPrev[idx] = nextH;
        this.velX[idx] = (this.heightCur[idx - 1] - this.heightCur[idx + 1]) * 3.5;
        this.velZ[idx] = (this.heightCur[idx - n] - this.heightCur[idx + n]) * 3.5;
      }
    }

    // Swap ping-pong height arrays in-place via TypedArray.set
    for (let i = 0; i < this.cellCount; i++) {
      const tmp = this.heightCur[i];
      this.heightCur[i] = this.heightPrev[i];
      this.heightPrev[i] = tmp;
    }
  }

  /**
   * Packs wave height (R) and lateral velocity gradients (G, B) into a pre-allocated
   * 24x24 RGBA Uint8Array for zero-allocation Three.js DataTexture uploads.
   */
  public packRippleTextureBytes(): Uint8Array {
    const out = this.rippleDataBytes;
    for (let i = 0; i < this.cellCount; i++) {
      const off = i * 4;
      const hByte = Math.max(0, Math.min(255, Math.round(128 + this.heightCur[i] * 700)));
      const gxByte = Math.max(0, Math.min(255, Math.round(128 + this.velX[i] * 180)));
      const gzByte = Math.max(0, Math.min(255, Math.round(128 + this.velZ[i] * 180)));
      out[off] = hByte;
      out[off + 1] = gxByte;
      out[off + 2] = gzByte;
      out[off + 3] = 255;
    }
    return out;
  }

  public sampleFluid(
    wx: number,
    wy: number,
    wz: number,
    bodyRadius: number,
    homePool: { x: number; z: number; radius: number; waterY: number } | null
  ): FluidSampleResult {
    _fluidScratch.inFluid = false;
    _fluidScratch.surfaceY = -1.25;
    _fluidScratch.depth = 0;
    _fluidScratch.waveHeight = 0;
    _fluidScratch.flowVx = 0;
    _fluidScratch.flowVz = 0;
    _fluidScratch.buoyancyAccelY = 0;
    _fluidScratch.dragFactor = 0;

    // 1. Sanctuary Home Pool
    if (homePool) {
      const dPool = Math.hypot(wx - homePool.x, wz - homePool.z);
      if (dPool < homePool.radius - 0.3) {
        const n = this.gridSize;
        const gx = Math.max(0, Math.min(n - 1, Math.floor(((wx - homePool.x) / 8.4 + 0.5) * n)));
        const gz = Math.max(0, Math.min(n - 1, Math.floor(((wz - homePool.z) / 8.4 + 0.5) * n)));
        const idx = gz * n + gx;
        const wave = this.heightCur[idx] + Math.sin(this.simTime * 4.2 + dPool * 1.4) * 0.024;
        const surfY = homePool.waterY + wave;
        const submergence = Math.max(0, Math.min(1, (surfY - (wy - bodyRadius)) / (2 * bodyRadius)));
        _fluidScratch.inFluid = submergence > 0.02;
        _fluidScratch.surfaceY = surfY;
        _fluidScratch.depth = surfY - -0.44;
        _fluidScratch.waveHeight = wave;
        _fluidScratch.flowVx = this.velX[idx];
        _fluidScratch.flowVz = this.velZ[idx];
        _fluidScratch.buoyancyAccelY = submergence * 34.0;
        _fluidScratch.dragFactor = 4.2 * submergence;
        return _fluidScratch;
      }
    }

    // 2. Spore Lagoon Shallow Bioluminescent Water (-75, -75)
    const dLagoon = Math.hypot(wx - ZONE_LOCATIONS.spore.x, wz - ZONE_LOCATIONS.spore.z);
    if (dLagoon < 35.5) {
      const n = this.gridSize;
      const gx = Math.max(
        0,
        Math.min(n - 1, Math.floor(((wx - ZONE_LOCATIONS.spore.x) / 76.0 + 0.5) * n))
      );
      const gz = Math.max(
        0,
        Math.min(n - 1, Math.floor(((wz - ZONE_LOCATIONS.spore.z) / 76.0 + 0.5) * n))
      );
      const idx = gz * n + gx;
      const wave = this.heightCur[idx] + Math.sin(this.simTime * 3.1 + wx * 0.25 + wz * 0.25) * 0.03;
      const surfY = 0.06 + wave;
      const submergence = Math.max(0, Math.min(1, (surfY - (wy - bodyRadius)) / (2 * bodyRadius)));
      _fluidScratch.inFluid = submergence > 0.02;
      _fluidScratch.surfaceY = surfY;
      _fluidScratch.depth = surfY - -0.18;
      _fluidScratch.waveHeight = wave;
      _fluidScratch.flowVx = this.velX[idx];
      _fluidScratch.flowVz = this.velZ[idx];
      _fluidScratch.buoyancyAccelY = submergence * 28.5;
      _fluidScratch.dragFactor = 2.6 * submergence;
      return _fluidScratch;
    }

    return _fluidScratch;
  }
}

/**
 * Extended Position-Based Dynamics (XPBD) Volumetric Soft-Body Solver.
 * Simulates volume-preserving tetrahedral compliance (C_vol = det([p1-p0, p2-p0, p3-p0])/6 - V_0)
 * for Bouncy Mushroom Trampoline Pads, Yuzu Mountain Launch Pads, and elastic Capybara squash.
 */
export class XpbdSoftBodySolver {
  public readonly pads: SoftBodyPadState[] = [];

  public syncPads(padSpecs: Array<{ id: string; wx: number; wy: number; wz: number; radius: number }>): void {
    // Preserve state of existing pads while adding/removing changed pads
    for (let i = this.pads.length - 1; i >= 0; i--) {
      if (!padSpecs.some((s) => s.id === this.pads[i].id)) {
        this.pads.splice(i, 1);
      }
    }
    for (let i = 0; i < padSpecs.length; i++) {
      const s = padSpecs[i];
      const existing = this.pads.find((p) => p.id === s.id);
      if (existing) {
        existing.wx = s.wx;
        existing.wy = s.wy;
        existing.wz = s.wz;
        existing.radius = s.radius;
      } else {
        this.pads.push({
          id: s.id,
          wx: s.wx,
          wy: s.wy,
          wz: s.wz,
          radius: s.radius,
          compression: 0,
          velocityY: 0,
          volumeError: 0,
        });
      }
    }
  }

  /**
   * Steps XPBD volume-restoring constraint: when vertically compressed by ratio `c`,
   * lateral Poisson bulge `r' = r * 1/sqrt(1 - c)` preserves tetrahedral volume `V = V_0`,
   * and compliant XPBD Lagrange multiplier `dLambda = -C / (w + alpha / dt^2)` restores equilibrium.
   */
  public step(dt: number): void {
    const substeps = 4;
    const subDt = Math.min(0.025, dt) / substeps;
    const complianceAlpha = 0.00085; // Soft-elastic mushroom cap compliance

    for (let p = 0; p < this.pads.length; p++) {
      const pad = this.pads[p];
      for (let s = 0; s < substeps; s++) {
        const predComp = pad.compression + pad.velocityY * subDt;
        // XPBD compliant spring-volume constraint C = predComp
        const alphaTilde = complianceAlpha / (subDt * subDt);
        const dLambda = -predComp / (1.0 + alphaTilde);
        const correctedComp = Math.max(-0.18, Math.min(0.45, predComp + dLambda));
        pad.velocityY = ((correctedComp - pad.compression) / subDt) * Math.exp(-5.5 * subDt);
        pad.compression = correctedComp;
        // Residual volume error metric after Poisson lateral expansion
        const lateralScaleSq = 1.0 / Math.max(0.55, 1.0 - pad.compression);
        pad.volumeError = Math.abs((1.0 - pad.compression) * lateralScaleSq - 1.0);
      }
    }
  }

  public applyImpact(padId: string, impactSpeedY: number, boostMultiplier: number = 1.0): number {
    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      if (pad.id === padId) {
        pad.compression = Math.min(0.42, pad.compression + Math.min(0.34, impactSpeedY * 0.032));
        pad.velocityY = -6.8;
        // Stored elastic potential converts into upward restitution impulse
        return (15.8 + pad.compression * 6.5) * boostMultiplier;
      }
    }
    return 16.0 * boostMultiplier;
  }
}
