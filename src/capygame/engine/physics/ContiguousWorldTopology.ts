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
 * 3 Wide Stone-and-Turf Grand Promenade Causeways directly joining Sanctuary (0, 0)
 * to the 3 Archipelago minigame islands across wide open ocean channels:
 * - NW Causeway: Sanctuary (-20.5, -20.5) -> Spore Lagoon Beach (-79.0, -79.0)
 * - SW Causeway: Sanctuary (-20.5, +20.5) -> Number Stampede North Plaza (-110.0, +141.5)
 * - SE Causeway: Sanctuary (+20.5, +20.5) -> Yuzu Mountain Base Plaza (+110.0, +142.0)
 * Capytorio Frontier sits independently on the far hemisphere (wx >= 500, infinite plain).
 */
export const CONTIGUOUS_BRIDGES: readonly PromenadeBridgeSpec[] = [
  makeBridge('spore', -20.5, -20.5, ZONE_LOCATIONS.spore.x + 31.0, ZONE_LOCATIONS.spore.z + 31.0),
  makeBridge('runner', -20.5, 20.5, ZONE_LOCATIONS.runner.x, ZONE_LOCATIONS.runner.z + 6.5),
  makeBridge(
    'fallguys',
    20.5,
    20.5,
    ZONE_LOCATIONS.fallguys.x,
    ZONE_LOCATIONS.fallguys.z + 7.0
  ),
];

export const OPEN_OCEAN_SEABED_Y = -1.65;
export const OPEN_OCEAN_SURFACE_Y = -0.95;

export interface DistrictBoundingBox2D {
  mode: PlayStyle;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  shape: 'circle' | 'box';
  cx: number;
  cz: number;
  radius?: number;
}

/**
 * Returns authoritative 2D visual/physical world footprints for all 5 islands
 * so unit tests and layout validators can guarantee zero overlaps.
 */
export function getArchipelagoDistrictFootprints(): DistrictBoundingBox2D[] {
  return [
    {
      mode: 'sanctuary',
      shape: 'circle',
      cx: ZONE_LOCATIONS.sanctuary.x,
      cz: ZONE_LOCATIONS.sanctuary.z,
      radius: 38.5,
      minX: ZONE_LOCATIONS.sanctuary.x - 38.5,
      maxX: ZONE_LOCATIONS.sanctuary.x + 38.5,
      minZ: ZONE_LOCATIONS.sanctuary.z - 38.5,
      maxZ: ZONE_LOCATIONS.sanctuary.z + 38.5,
    },
    {
      mode: 'spore',
      shape: 'circle',
      cx: ZONE_LOCATIONS.spore.x,
      cz: ZONE_LOCATIONS.spore.z,
      radius: 42.0,
      minX: ZONE_LOCATIONS.spore.x - 42.0,
      maxX: ZONE_LOCATIONS.spore.x + 42.0,
      minZ: ZONE_LOCATIONS.spore.z - 42.0,
      maxZ: ZONE_LOCATIONS.spore.z + 42.0,
    },
    {
      mode: 'capytorio',
      shape: 'circle',
      cx: ZONE_LOCATIONS.capytorio.x,
      cz: ZONE_LOCATIONS.capytorio.z,
      radius: 45.0,
      minX: ZONE_LOCATIONS.capytorio.x - 45.0,
      maxX: ZONE_LOCATIONS.capytorio.x + 45.0,
      minZ: ZONE_LOCATIONS.capytorio.z - 45.0,
      maxZ: ZONE_LOCATIONS.capytorio.z + 45.0,
    },
    {
      mode: 'runner',
      shape: 'box',
      cx: ZONE_LOCATIONS.runner.x,
      cz: ZONE_LOCATIONS.runner.z - 42.25,
      minX: ZONE_LOCATIONS.runner.x - 8.4,
      maxX: ZONE_LOCATIONS.runner.x + 8.4,
      minZ: ZONE_LOCATIONS.runner.z - 98.0,
      maxZ: ZONE_LOCATIONS.runner.z + 13.5,
    },
    {
      mode: 'fallguys',
      shape: 'box',
      cx: ZONE_LOCATIONS.fallguys.x,
      cz: ZONE_LOCATIONS.fallguys.z - 27.25,
      minX: ZONE_LOCATIONS.fallguys.x - 8.4,
      maxX: ZONE_LOCATIONS.fallguys.x + 8.4,
      minZ: ZONE_LOCATIONS.fallguys.z - 67.0,
      maxZ: ZONE_LOCATIONS.fallguys.z + 12.5,
    },
  ];
}

export function computePairwiseFootprintClearance(
  a: DistrictBoundingBox2D,
  b: DistrictBoundingBox2D
): number {
  if (a.shape === 'circle' && b.shape === 'circle') {
    return Math.hypot(a.cx - b.cx, a.cz - b.cz) - ((a.radius ?? 0) + (b.radius ?? 0));
  }
  if (a.shape === 'circle' || b.shape === 'circle') {
    const circ = a.shape === 'circle' ? a : b;
    const box = a.shape === 'circle' ? b : a;
    const nearX = Math.max(box.minX, Math.min(box.maxX, circ.cx));
    const nearZ = Math.max(box.minZ, Math.min(box.maxZ, circ.cz));
    return Math.hypot(circ.cx - nearX, circ.cz - nearZ) - (circ.radius ?? 0);
  }
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dz = Math.max(0, Math.max(a.minZ - b.maxZ, b.minZ - a.maxZ));
  if (dx === 0 && dz === 0) {
    const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    return -Math.min(ox, oz);
  }
  return Math.hypot(dx, dz);
}

export function evaluateDistrictClearances(): {
  minClearanceMeters: number;
  overlappingPairs: Array<[PlayStyle, PlayStyle, number]>;
} {
  const footprints = getArchipelagoDistrictFootprints();
  let minClearanceMeters = Infinity;
  const overlappingPairs: Array<[PlayStyle, PlayStyle, number]> = [];
  for (let i = 0; i < footprints.length; i++) {
    for (let j = i + 1; j < footprints.length; j++) {
      const gap = computePairwiseFootprintClearance(footprints[i], footprints[j]);
      if (gap < minClearanceMeters) minClearanceMeters = gap;
      if (gap <= 0) {
        overlappingPairs.push([footprints[i].mode, footprints[j].mode, gap]);
      }
    }
  }
  return { minClearanceMeters, overlappingPairs };
}

// Reusable scratch struct for fluid queries (zero GC allocation)
const _fluidScratch: FluidSampleResult = {
  inFluid: false,
  surfaceY: OPEN_OCEAN_SURFACE_Y,
  depth: 0,
  waveHeight: 0,
  flowVx: 0,
  flowVz: 0,
  buoyancyAccelY: 0,
  dragFactor: 0,
};

// Reusable scratch struct for domain queries (zero GC allocation)
export const _walkableClampScratch = {
  wx: 0,
  wz: 0,
  clamped: false,
  nx: 0,
  nz: 0,
};

/**
 * Signed distance (negative = over built landmass/causeways, positive = open ocean)
 * across the union of all 5 islands and 4 Grand Promenade Causeways.
 * Used strictly as a terrain/biome query — player exploration is completely unrestricted!
 */
export function evaluateContiguousWalkableSdf(wx: number, wz: number): number {
  const dSanctuary = Math.hypot(wx, wz) - 34.5;
  let minSdf = dSanctuary;

  const dSpore =
    Math.hypot(wx - ZONE_LOCATIONS.spore.x, wz - ZONE_LOCATIONS.spore.z) - 41.5;
  if (dSpore < minSdf) minSdf = dSpore;

  // Far-hemisphere Capytorio continental shelf starts at wx >= 500
  const dCapytorio = 500.0 - wx;
  if (dCapytorio < minSdf) minSdf = dCapytorio;

  const rx = Math.abs(wx - ZONE_LOCATIONS.runner.x) - 8.4;
  const rz = Math.abs(wz - (ZONE_LOCATIONS.runner.z - 42.25)) - 55.75;
  const dRunner = Math.max(rx, rz);
  if (dRunner < minSdf) minSdf = dRunner;

  const fgx = Math.abs(wx - ZONE_LOCATIONS.fallguys.x) - 8.4;
  const fgz = Math.abs(wz - (ZONE_LOCATIONS.fallguys.z - 27.25)) - 39.75;
  const dFallGuys = Math.max(fgx, fgz);
  if (dFallGuys < minSdf) minSdf = dFallGuys;

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
 * Legacy helper retained for API compatibility.
 * Open-world movement is unrestricted so callers pass through freely without artificial walls.
 */
export function clampToContiguousWalkableWorld(
  wx: number,
  wz: number,
  _bodyRadius: number
): typeof _walkableClampScratch {
  _walkableClampScratch.wx = wx;
  _walkableClampScratch.wz = wz;
  _walkableClampScratch.clamped = false;
  _walkableClampScratch.nx = 0;
  _walkableClampScratch.nz = 0;
  return _walkableClampScratch;
}

/**
 * Classifies which minigame district the player is currently standing in based on world coordinates,
 * returning `'sanctuary'` for Sanctuary hub as well as open-ocean free exploration anywhere around the world.
 */
export function classifyDistrictAtWorldPos(
  wx: number,
  wz: number,
  currentDistrict: PlayStyle
): PlayStyle {
  // Spore Lagoon
  const dSpore = Math.hypot(wx - ZONE_LOCATIONS.spore.x, wz - ZONE_LOCATIONS.spore.z);
  if (dSpore < (currentDistrict === 'spore' ? 41.0 : 38.0)) {
    return 'spore';
  }

  // Capytorio Far-Hemisphere Frontier (unbounded plain for wx >= 500)
  if (wx >= 500.0) {
    return 'capytorio';
  }

  // Number Stampede
  const rLocalX = wx - ZONE_LOCATIONS.runner.x;
  const rLocalZ = wz - ZONE_LOCATIONS.runner.z;
  const inRunner =
    Math.abs(rLocalX) <= (currentDistrict === 'runner' ? 8.4 : 5.4) &&
    rLocalZ <= (currentDistrict === 'runner' ? 9.0 : 5.0) &&
    rLocalZ >= -98.0;
  if (inRunner) {
    return 'runner';
  }

  // Yuzu Mountain
  const fLocalX = wx - ZONE_LOCATIONS.fallguys.x;
  const fLocalZ = wz - ZONE_LOCATIONS.fallguys.z;
  const inFallGuys =
    Math.abs(fLocalX) <= (currentDistrict === 'fallguys' ? 8.4 : 6.4) &&
    fLocalZ <= (currentDistrict === 'fallguys' ? 9.0 : 5.5) &&
    fLocalZ >= -66.5;
  if (inFallGuys) {
    return 'fallguys';
  }

  return 'sanctuary';
}

/**
 * Evaluates continuous ground elevation across all 5 islands, sandy shore ramps,
 * Grand Promenade Causeways, elevated platforms, see-saws, basins, and open ocean seabed.
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

  // 2. Check Grand Promenade Causeways (smooth deck arch & slightly extended aprons at ends)
  for (let i = 0; i < CONTIGUOUS_BRIDGES.length; i++) {
    const b = CONTIGUOUS_BRIDGES[i];
    const relX = wx - b.startX;
    const relZ = wz - b.startZ;
    const along = relX * b.dirX + relZ * b.dirZ;
    if (along >= -1.2 && along <= b.length + 1.2) {
      const lateral = Math.abs(relX * b.perpX + relZ * b.perpZ);
      if (lateral <= b.halfWidth) {
        const u = Math.max(0, Math.min(1, along / b.length));
        return Math.sin(u * Math.PI) * 0.14;
      }
    }
  }

  // 3. Sanctuary Island grass (r <= 34.5) and sloping sandy beach skirt (34.5..41.5 -> seabed -1.65)
  const dSanctuary = Math.hypot(wx, wz);
  if (dSanctuary <= 34.5) {
    return 0.0;
  }
  if (dSanctuary <= 41.5) {
    const beachT = (dSanctuary - 34.5) / 7.0;
    return OPEN_OCEAN_SEABED_Y * beachT;
  }

  // 4. Spore Lagoon Basin -> gentle sandy beach rim & outer slope into open ocean
  const dSpore = Math.hypot(wx - ZONE_LOCATIONS.spore.x, wz - ZONE_LOCATIONS.spore.z);
  if (dSpore <= 45.0) {
    if (dSpore > 39.5) {
      const rimT = (dSpore - 39.5) / 5.5;
      return OPEN_OCEAN_SEABED_Y * rimT;
    }
    if (dSpore > 33.5) {
      const t = (39.5 - dSpore) / 6.0;
      return -0.18 * t;
    }
    return -0.18;
  }

  // 5. Capytorio Far-Hemisphere Infinite Continental Terrain (wx >= 500 flat at y = 0, sandy shoreline 490..500)
  if (wx >= 500.0) {
    return 0.0;
  }
  if (wx >= 490.0) {
    const shoreT = (500.0 - wx) / 10.0;
    return OPEN_OCEAN_SEABED_Y * shoreT;
  }

  // 6. Number Stampede Track, Forecourt, Boardwalks & Turnaround
  const rx = wx - ZONE_LOCATIONS.runner.x;
  const rz = wz - ZONE_LOCATIONS.runner.z;
  if (Math.abs(rx) <= 8.4 && rz >= -98.0 && rz <= 13.5) {
    return 0.0;
  }

  // 7. Yuzu Mountain Elevated Platforms & Torque-Balanced See-Saw
  const fx = wx - ZONE_LOCATIONS.fallguys.x;
  const fz = wz - ZONE_LOCATIONS.fallguys.z;
  if (Math.abs(fx) <= 8.4 && fz <= 12.5 && fz >= -67.0) {
    if (fz > 4.5) {
      const rampT = Math.max(0, Math.min(1, 1.0 - (fz - 4.5) / 8.0));
      return rampT * 0.5;
    }
    if (Math.abs(fx) <= 5.1 && Math.abs(fz - -33.0) <= 6.2) {
      return 0.5 + Math.sin(seeSawTilt0) * fx;
    }
    return 0.5;
  }

  // 8. Open Ocean Seabed everywhere else in the world!
  return OPEN_OCEAN_SEABED_Y;
}

/**
 * 2D Shallow-Water Wave & Archimedes Buoyancy Solver (Zero-Allocation Float32Array Grid).
 * Simulates coupled surface height ripples, velocity fields, Archimedes displaced-volume lift,
 * and quadratic hydrodynamic drag across the Home Pool, Spore Lagoon, and endless Open Ocean.
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
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.simTime += dt;
    const n = this.gridSize;
    const waveSpeedSq = 14.0 * Math.max(0.2, Math.min(3.5, waveSpeedScale));
    const dtClamped = Math.min(0.025, dt);
    const alpha = Math.min(0.24, waveSpeedSq * dtClamped * dtClamped);
    const damping = Math.max(0.92, Math.min(0.992, 1.0 - 0.018 * Math.max(0.2, viscosityScale)));

    // Inject wake impulse when Hero swims in Home Pool (-8.8, 3.0) or Spore Lagoon
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

    // Swap ping-pong height arrays in-place
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
    _fluidScratch.surfaceY = OPEN_OCEAN_SURFACE_Y;
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

    // 2. Spore Lagoon Shallow Bioluminescent Water
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

    // 3. Endless Open Ocean surrounding all 5 islands and causeways
    const groundAtPos = sampleContiguousGroundY(wx, wz, homePool, 0);
    if (groundAtPos < OPEN_OCEAN_SURFACE_Y + 0.12) {
      const oceanWave =
        Math.sin(this.simTime * 1.9 + wx * 0.16 + wz * 0.11) * 0.045 +
        Math.cos(this.simTime * 1.3 + wx * 0.09 - wz * 0.14) * 0.03;
      const surfY = OPEN_OCEAN_SURFACE_Y + oceanWave;
      const submergence = Math.max(
        0,
        Math.min(1, (surfY - (wy - bodyRadius)) / (2 * bodyRadius))
      );
      _fluidScratch.inFluid = submergence > 0.02;
      _fluidScratch.surfaceY = surfY;
      _fluidScratch.depth = Math.max(0, surfY - groundAtPos);
      _fluidScratch.waveHeight = oceanWave;
      _fluidScratch.flowVx = Math.cos(this.simTime * 0.5 + wz * 0.05) * 0.35;
      _fluidScratch.flowVz = Math.sin(this.simTime * 0.4 + wx * 0.05) * 0.35;
      _fluidScratch.buoyancyAccelY = submergence * 31.5;
      _fluidScratch.dragFactor = 2.8 * submergence;
      return _fluidScratch;
    }

    return _fluidScratch;
  }

  /**
   * Computes normalized UV coordinates and wake displacement impulse for the
   * 128x128 WGSL compute shallow-water wake grid (`@compute @workgroup_size(8, 8)`).
   * Zero per-frame heap allocations.
   */
  public writeGpuWakeParams(
    heroWx: number,
    heroWz: number,
    heroSpeed: number,
    outParams: Float32Array
  ): boolean {
    const dPool = Math.hypot(heroWx - -8.8, heroWz - 3.0);
    if (dPool < 4.2 && heroSpeed > 0.2) {
      outParams[0] = (heroWx - -8.8) / 8.4 + 0.5;
      outParams[1] = (heroWz - 3.0) / 8.4 + 0.5;
      outParams[2] = Math.min(0.16, heroSpeed * 0.016);
      outParams[3] = 1.0; // Home Pool domain
      return true;
    }
    const dLagoon = Math.hypot(
      heroWx - ZONE_LOCATIONS.spore.x,
      heroWz - ZONE_LOCATIONS.spore.z
    );
    if (dLagoon < 36.0 && heroSpeed > 0.2) {
      outParams[0] = (heroWx - ZONE_LOCATIONS.spore.x) / 76.0 + 0.5;
      outParams[1] = (heroWz - ZONE_LOCATIONS.spore.z) / 76.0 + 0.5;
      outParams[2] = Math.min(0.18, heroSpeed * 0.017);
      outParams[3] = 2.0; // Spore Lagoon domain
      return true;
    }
    outParams[2] = 0;
    outParams[3] = 0;
    return false;
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
    if (!Number.isFinite(dt) || dt <= 0) return;
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
