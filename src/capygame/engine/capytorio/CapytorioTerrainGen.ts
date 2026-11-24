import {
  CAPYTORIO_CHUNK_SIZE,
  type CapytorioItemId,
} from '../CapytorioData';

function hashInt2D(x: number, z: number, seed: number): number {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function smoothstepClamp(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Smooth deterministic 2D value noise returning [-1, +1] with zero allocations. */
function valueNoise2D(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const n00 = hashInt2D(ix, iz, seed);
  const n10 = hashInt2D(ix + 1, iz, seed);
  const n01 = hashInt2D(ix, iz + 1, seed);
  const n11 = hashInt2D(ix + 1, iz + 1, seed);

  const nx0 = n00 + (n10 - n00) * ux;
  const nx1 = n01 + (n11 - n01) * ux;
  return (nx0 + (nx1 - nx0) * uz) * 2.0 - 1.0;
}

/** 3-octave deterministic fractional Brownian motion returning approximately [-1, +1]. */
function fbm2D(x: number, z: number, seed: number, octaves: number = 3): number {
  let sum = 0;
  let amp = 0.56;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * freq, z * freq, seed + i * 97) * amp;
    norm += amp;
    freq *= 2.03;
    amp *= 0.48;
  }
  return sum / norm;
}

export type CapytorioTerrainType =
  | 'grass'
  | 'sand'
  | 'shallow_water'
  | 'river'
  | 'lake'
  | 'ocean';

export interface CapytorioTerrainSample {
  type: CapytorioTerrainType;
  isWater: boolean;
  /** World Y elevation in meters (-0.02 flat buildable land .. -0.82 deep ocean bed) */
  elevationY: number;
  /** Normalized water depth 0 (dry land) .. 1 (deep pelagic ocean) */
  waterDepth: number;
  /** Normalized shoreline sand blend 0 (lush meadow grass) .. 1 (warm coastal sand) */
  sandBlend: number;
}

export function isCapytorioWaterTerrain(type: CapytorioTerrainType): boolean {
  return type === 'shallow_water' || type === 'river' || type === 'lake' || type === 'ocean';
}

const _terrainScratch: CapytorioTerrainSample = {
  type: 'grass',
  isWater: false,
  elevationY: -0.02,
  waterDepth: 0,
  sandBlend: 0,
};

/**
 * Deterministic infinite Capytorio hydrology & terrain generator producing:
 * - Lush buildable starter meadow around (0, 0) (r <= 13 tiles)
 * - Scenic inland Freshwater Lakes (both flanking the starter plain & procedurally across the infinite map)
 * - Continuous meandering Rivers flowing across plains into lakes & oceans
 * - Sweeping Oceans with turquoise shallow bays and golden sandy beaches
 *
 * Accepts an optional caller-owned scratch struct `out` for zero-allocation vertex sampling.
 */
export function sampleCapytorioTerrainDetail(
  gx: number,
  gz: number,
  out: CapytorioTerrainSample = _terrainScratch
): CapytorioTerrainSample {
  const rOrigin = Math.hypot(gx, gz);
  // Guarantee starter base & all 5 starter ore patches stay 100% dry buildable land
  if (rOrigin <= 12.6) {
    out.type = 'grass';
    out.isWater = false;
    out.elevationY = -0.02;
    out.waterDepth = 0;
    out.sandBlend = 0;
    return out;
  }

  // Smooth mask keeping r <= 13.2 dry and gently unlocking water past r = 15.5
  const starterMask = smoothstepClamp(12.8, 15.6, rOrigin);

  // 1. CONTINENTAL OCEAN FIELD (infinite macro continents & ocean basins + western archipelago coast)
  const cWarpX = fbm2D(gx * 0.0085, gz * 0.0085, 1301, 2) * 18.0;
  const cWarpZ = fbm2D(gx * 0.0085 + 29.4, gz * 0.0085 - 17.8, 1307, 2) * 18.0;
  let continent = fbm2D((gx + cWarpX) * 0.009, (gz + cWarpZ) * 0.009, 1319, 3);

  // Blend in a sweeping organic Southern Ocean Bay starting ~36 tiles South of spawn
  const southBayDx = (gx - 6.0 + cWarpX * 0.85) * 0.82;
  const southBayDz = (gz - 92.0 + cWarpZ * 0.75) * 1.0;
  const southBayDist = Math.hypot(southBayDx, southBayDz);
  const southCoastPerturb =
    6.5 * Math.sin(gx * 0.055 + 0.4) +
    3.5 * Math.cos(gx * 0.12 - 0.8) +
    fbm2D(gx * 0.04, gz * 0.04, 1409, 2) * 5.2;
  const southBayPush = smoothstepClamp(64.0, 38.0, southBayDist + southCoastPerturb);
  if (southBayPush > 0.001) {
    continent = Math.min(continent, 0.24 - southBayPush * 0.94);
  }

  // Western coast facing Sanctuary across the archipelago sea (world x < 516 => gx < -273)
  if (gx < -262) {
    const westPush = smoothstepClamp(-262, -278, gx);
    continent = Math.min(continent, 0.2 - westPush * 0.95);
  }

  // Lift continent near starter peninsula (r < 34) so starter plain sits on solid coastal landmass
  const starterPeninsulaLift = (1.0 - smoothstepClamp(24.0, 42.0, rOrigin)) * 0.42;
  const oceanElev = continent + starterPeninsulaLift;

  // 2. MEANDERING RIVERS (infinite domain-warped zero-contour river network + starter eastern river)
  const rWarpX = fbm2D(gx * 0.022 + 7.1, gz * 0.022 - 5.3, 2111, 2) * 13.0;
  const rWarpZ = fbm2D(gx * 0.022 - 13.4, gz * 0.022 + 9.2, 2129, 2) * 13.0;
  const procRiverAbs = Math.abs(
    fbm2D((gx + rWarpX) * 0.0155 + 0.48, (gz + rWarpZ) * 0.0155 - 0.22, 2143, 3)
  );
  // Width ~3.0 tiles in grid space
  const procRiverNorm = procRiverAbs / 0.052; // < 1.0 => inside river channel

  // Scenic Starter Valley River curving East of the starter plain into the Southern Ocean Bay
  const starterRiverCenterX =
    28.5 +
    3.8 * Math.sin(gz * 0.075 + 0.45) +
    1.8 * Math.cos(gz * 0.038 - 0.6) +
    fbm2D(gx * 0.06, gz * 0.06, 2207, 2) * 1.4;
  const starterRiverFade =
    smoothstepClamp(66.0, 44.0, Math.abs(gz - 2.0)) * starterMask;
  const starterRiverHalfW = 2.25 + 0.45 * Math.sin(gz * 0.11);
  const starterRiverNorm =
    starterRiverFade > 0.05
      ? Math.abs(gx - starterRiverCenterX) / (starterRiverHalfW * starterRiverFade)
      : 99.0;

  const riverNorm = Math.min(procRiverNorm / Math.max(0.001, starterMask), starterRiverNorm);

  // 3. INLAND LAKES (infinite warped lake basins + two scenic starter lakes West of base)
  const lWarpX = fbm2D(gx * 0.036, gz * 0.036, 3301, 2) * 5.2;
  const lWarpZ = fbm2D(gx * 0.036 + 19.2, gz * 0.036 - 11.8, 3313, 2) * 5.2;
  const procLakeField = fbm2D((gx + lWarpX) * 0.028, (gz + lWarpZ) * 0.028, 3323, 3);

  // Scenic SW Lake around (-21, 14) & NW Lake around (-19, -20)
  const lakeShapeNoise = fbm2D(gx * 0.11, gz * 0.11, 3407, 2) * 2.1;
  const dSwLake = Math.hypot((gx + 21.5) * 0.90, (gz - 14.5) * 1.06) + lakeShapeNoise;
  const dNwLake = Math.hypot((gx + 19.0) * 1.02, (gz + 20.5) * 0.94) + lakeShapeNoise * 0.85;
  const rawStarterLake = Math.max(
    1.0 - dSwLake / 7.2,
    1.0 - dNwLake / 6.2
  );
  const starterLakeFactor = rawStarterLake > 0 ? rawStarterLake * starterMask : -9.0;

  // Compute effective signed lake depth (> 0 means submerged lake water)
  const procLakeDepth = (-0.33 - procLakeField) * 3.4 * starterMask;
  const lakeDepthVal = Math.max(procLakeDepth, starterLakeFactor);

  // --- COMBINE INTO UNIFIED HYDROLOGICAL ELEVATION & BIOME ---
  // Ocean thresholds: < -0.25 ocean, -0.25..-0.15 shallow_water, -0.15..-0.05 sand
  const oceanDepth = (-0.15 - oceanElev) * 3.1 * starterMask;
  const riverDepth = (1.0 - riverNorm) * 0.95;

  const maxWaterSignal = Math.max(oceanDepth, lakeDepthVal, riverDepth);

  if (maxWaterSignal > 0.0) {
    // Determine dominant water body type & smooth recessed bed depth
    let type: CapytorioTerrainType = 'shallow_water';
    let depth01 = Math.max(0.08, Math.min(1.0, maxWaterSignal));

    if (oceanDepth >= lakeDepthVal && oceanDepth >= riverDepth) {
      type = oceanElev < -0.25 ? 'ocean' : 'shallow_water';
      depth01 = type === 'ocean'
        ? Math.min(1.0, 0.45 + (-0.25 - oceanElev) * 1.65)
        : Math.max(0.10, Math.min(0.45, oceanDepth * 0.95));
    } else if (riverDepth >= lakeDepthVal) {
      type = riverNorm < 0.76 ? 'river' : 'shallow_water';
      depth01 = Math.max(0.16, Math.min(0.66, (1.0 - riverNorm) * 0.78));
    } else {
      type = lakeDepthVal > 0.20 ? 'lake' : 'shallow_water';
      depth01 = Math.max(0.12, Math.min(0.76, lakeDepthVal * 0.94));
    }

    // Smooth recessed bed from -0.32 (water's edge) down to -0.86 (deep ocean floor, cleanly above global oceanMesh at -0.95)
    out.type = type;
    out.isWater = true;
    out.waterDepth = depth01;
    out.elevationY = -0.32 - depth01 * 0.54;
    out.sandBlend = 1.0 - smoothstepClamp(0.0, 0.35, depth01);
    return out;
  }

  // Dry land: compute smooth golden sandy beach / riverbank margin around every body of water
  const oceanSand = smoothstepClamp(-0.04, -0.15, oceanElev) * starterMask;
  const riverSand = smoothstepClamp(1.62, 1.0, riverNorm) * starterMask;
  const lakeSand = Math.max(
    smoothstepClamp(-0.18, -0.33, procLakeField) * starterMask,
    smoothstepClamp(-0.32, 0.0, rawStarterLake) * starterMask
  );
  const sandBlend = Math.max(oceanSand, riverSand, lakeSand);

  out.type = sandBlend >= 0.42 ? 'sand' : 'grass';
  out.isWater = false;
  out.waterDepth = 0;
  // Gentle beach slope right near the water line (-0.02 flat land dipping smoothly toward -0.11 at shoreline)
  out.elevationY = -0.02 - Math.pow(sandBlend, 2.2) * 0.09;
  out.sandBlend = sandBlend;
  return out;
}

export function sampleCapytorioTerrain(gx: number, gz: number): CapytorioTerrainType {
  return sampleCapytorioTerrainDetail(gx, gz, _terrainScratch).type;
}

const PROC_RESOURCES: readonly CapytorioItemId[] = [
  'iron_ore',
  'copper_ore',
  'coal',
  'calcite',
  'yuzu_sap',
];

/**
 * Deterministic infinite procedural resource map.
 * - Guarantees 5 rich starter ore patches immediately around landing center (0, 0)
 *   so the player arrives on a crisp, blank mineralized plain ready to build from scratch.
 * - Generates unbounded additional patches across every 16x16 chunk in all directions!
 * - Never spawns mineral veins underwater (lakes, rivers, oceans).
 */
export function sampleCapytorioBaseResource(
  gx: number,
  gz: number
): { resource: CapytorioItemId; initialAmount: number } | null {
  // Keep exact spawn pad clear so hero stands on clean solid limestone ground
  if (Math.abs(gx) <= 2 && Math.abs(gz) <= 2) {
    return null;
  }
  // Never spawn ore deposits inside lakes, rivers, or oceans
  if (isCapytorioWaterTerrain(sampleCapytorioTerrain(gx, gz))) {
    return null;
  }

  // Starter Quadrant Patches (within r <= 12 tiles of (0,0)):
  // NW: Iron Ore
  const dIron = Math.hypot(gx - -5.5, gz - -5.5);
  if (dIron <= 3.1) {
    return { resource: 'iron_ore', initialAmount: Math.round(1400 - dIron * 160) };
  }
  // NE: Copper Ore
  const dCopper = Math.hypot(gx - 5.5, gz - -5.5);
  if (dCopper <= 3.1) {
    return { resource: 'copper_ore', initialAmount: Math.round(1400 - dCopper * 160) };
  }
  // SW: Coal Seam
  const dCoal = Math.hypot(gx - -5.5, gz - 5.5);
  if (dCoal <= 3.1) {
    return { resource: 'coal', initialAmount: Math.round(1400 - dCoal * 160) };
  }
  // SE: Volcanic Calcite & Bio-Yuzu Nutrient Groves side-by-side
  const dCalcite = Math.hypot(gx - 4.5, gz - 5.5);
  if (dCalcite <= 2.35) {
    return { resource: 'calcite', initialAmount: Math.round(1200 - dCalcite * 160) };
  }
  const dYuzu = Math.hypot(gx - 9.2, gz - 4.0);
  if (dYuzu <= 2.35) {
    return { resource: 'yuzu_sap', initialAmount: Math.round(1200 - dYuzu * 160) };
  }

  // Infinite procedural chunk veins outside immediate center (gx, gz in (-Inf..+Inf))
  if (Math.hypot(gx, gz) < 12.5) {
    return null;
  }

  const cx = Math.floor(gx / CAPYTORIO_CHUNK_SIZE);
  const cz = Math.floor(gz / CAPYTORIO_CHUNK_SIZE);

  // Check neighbor chunks up to +/-1 so blobs cross chunk borders seamlessly
  for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
      const spawnRoll = hashInt2D(ncx, ncz, 9101);
      if (spawnRoll > 0.68) continue; // ~68% of 16x16 chunks host a resource deposit

      const blobCx = ncx * CAPYTORIO_CHUNK_SIZE + 4 + hashInt2D(ncx, ncz, 202) * 8;
      const blobCz = ncz * CAPYTORIO_CHUNK_SIZE + 4 + hashInt2D(ncx, ncz, 303) * 8;
      const radius = 2.4 + hashInt2D(ncx, ncz, 404) * 2.1;
      const d = Math.hypot(gx - blobCx, gz - blobCz);
      if (d <= radius) {
        const resIdx = Math.floor(hashInt2D(ncx, ncz, 505) * PROC_RESOURCES.length);
        const res = PROC_RESOURCES[resIdx % PROC_RESOURCES.length];
        const distMult = 1.0 + Math.min(4.0, Math.hypot(gx, gz) * 0.025);
        return {
          resource: res,
          initialAmount: Math.max(400, Math.round((1200 - d * 120) * distMult)),
        };
      }
    }
  }

  return null;
}

/**
 * Deterministic tropical citrus trees across the lush Capytorio meadow.
 * Keeps the central landing pad (|gx|<=3, |gz|<=3) and mineral ore patches completely clear
 * while forming natural groves across the infinite plain.
 */
export function sampleCapytorioTreeAt(gx: number, gz: number): boolean {
  if (Math.abs(gx) <= 3 && Math.abs(gz) <= 3) return false;
  const terrain = sampleCapytorioTerrain(gx, gz);
  if (isCapytorioWaterTerrain(terrain) || terrain === 'sand') return false;
  if (sampleCapytorioBaseResource(gx, gz) !== null) return false;
  const groveNoise = Math.sin(gx * 0.23 + 0.5) * Math.cos(gz * 0.21 - 0.3);
  if (groveNoise < -0.35) return false;
  const h = hashInt2D(gx, gz, 7719);
  return h < 0.125;
}
