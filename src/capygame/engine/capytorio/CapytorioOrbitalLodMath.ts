/**
 * Pure, zero-allocation multi-scale LOD, nested clipmap ring, and atmospheric cloud math
 * for Capytorio's continuous zoom from ground level (10 m) through high orbit (234 km+).
 */

import type { CapytorioItemId, CapytorioMachineType } from '../CapytorioData';

export interface CapytorioClipmapRingConfig {
  readonly index: number;
  /** Factorio mapgen tile step per texel (1 = 1 tile/px, 4 = 4 tiles/px, ..., 256 = 256 tiles/px) */
  readonly scale: number;
  /** Texture width & height in texels (power-of-two for hardware mipmaps) */
  readonly texSize: number;
  /** Total world width in meters (texSize * scale * 2.5 m) */
  readonly worldSpanMeters: number;
  /** World Y offset slightly below y = 0 so 3D props & groundDeck cleanly layer above */
  readonly yOffset: number;
  /** Render order (outermost drawn first so inner high-res rings feather seamlessly on top) */
  readonly renderOrder: number;
  /** Minimum altitudeRadius (m) where this ring is needed */
  readonly minAltitudeM: number;
  /** Maximum altitudeRadius (m) where this ring adds visible detail */
  readonly maxAltitudeM: number;
}

export const CAPYTORIO_CLIPMAP_TEX_SIZE = 256;
export const CAPYTORIO_TILE_METERS = 2.5;

export const CAPYTORIO_CLIPMAP_RINGS: readonly CapytorioClipmapRingConfig[] = [
  {
    index: 0,
    scale: 1,
    texSize: CAPYTORIO_CLIPMAP_TEX_SIZE,
    worldSpanMeters: CAPYTORIO_CLIPMAP_TEX_SIZE * 1 * CAPYTORIO_TILE_METERS, // 640 m
    yOffset: -0.07,
    renderOrder: -11,
    minAltitudeM: 0,
    maxAltitudeM: 2_800,
  },
  {
    index: 1,
    scale: 4,
    texSize: CAPYTORIO_CLIPMAP_TEX_SIZE,
    worldSpanMeters: CAPYTORIO_CLIPMAP_TEX_SIZE * 4 * CAPYTORIO_TILE_METERS, // 2.56 km
    yOffset: -0.12,
    renderOrder: -12,
    minAltitudeM: 0,
    maxAltitudeM: 12_000,
  },
  {
    index: 2,
    scale: 16,
    texSize: CAPYTORIO_CLIPMAP_TEX_SIZE,
    worldSpanMeters: CAPYTORIO_CLIPMAP_TEX_SIZE * 16 * CAPYTORIO_TILE_METERS, // 10.24 km
    yOffset: -0.18,
    renderOrder: -13,
    minAltitudeM: 260,
    maxAltitudeM: 52_000,
  },
  {
    index: 3,
    scale: 64,
    texSize: CAPYTORIO_CLIPMAP_TEX_SIZE,
    worldSpanMeters: CAPYTORIO_CLIPMAP_TEX_SIZE * 64 * CAPYTORIO_TILE_METERS, // 40.96 km
    yOffset: -0.26,
    renderOrder: -14,
    minAltitudeM: 1_100,
    maxAltitudeM: 195_000,
  },
  {
    index: 4,
    scale: 256,
    texSize: CAPYTORIO_CLIPMAP_TEX_SIZE,
    worldSpanMeters: CAPYTORIO_CLIPMAP_TEX_SIZE * 256 * CAPYTORIO_TILE_METERS, // 163.84 km
    yOffset: -0.36,
    renderOrder: -15,
    minAltitudeM: 4_200,
    maxAltitudeM: 500_000,
  },
];

/** World heights for the two counter-drifting patchy cloud strata */
export const CAPYTORIO_CLOUD_LOWER_Y = 760;
export const CAPYTORIO_CLOUD_UPPER_Y = 2_350;

/** Altitude radius (m) above which the orbital Capy-Earth planet globe activates underneath Ring 4 */
export const CAPYTORIO_PLANET_GLOBE_ACTIVATE_M = 42_000;

export interface CapytorioAltitudeLodState {
  logAlt: number;
  /** 1.0 close to ground (<= 180 m), fades cleanly to 0 by 340 m onto Ring 0 clipmap */
  groundDeckAlpha: number;
  /** True while full multi-part 3D machine groups should render */
  useDetailedMachines: boolean;
  /** True while single-draw-call simplified 3D machine box proxies should render */
  useProxyMachines: boolean;
  /** True while full multi-part curved/rail/animated belts should render */
  useDetailedBelts: boolean;
  /** True while single-draw-call simplified flat belt strips should render */
  useProxyBelts: boolean;
  /** True while full 3D tree trunks + canopies should render */
  showDetailedTrees: boolean;
  /** True while canopy-only lightweight 3D trees should render */
  showCanopyOnlyTrees: boolean;
  /** True while 3D ore crystal shards should render (plates remain visible longer) */
  showOreCrystals: boolean;
  /** Master clipmap opacity (1.0 from ground to ~35 km, then smoothly dissolves into orbital globe by ~225 km) */
  clipmapOpacity: number;
  /** Soft Rayleigh daylight aerial perspective haze (0 near ground -> peaks ~0.34 at 18-35 km -> yields to space) */
  hazeStrength: number;
  /** Lower patchy cumulus stratum opacity (includes smooth lens-proximity fade when ascending through it) */
  cloudLayer1Opacity: number;
  /** Upper wispy stratocumulus stratum opacity (includes smooth lens-proximity fade) */
  cloudLayer2Opacity: number;
  /** Daylight sky dome alpha (1.0 through troposphere, deepens smoothly to orbital space 7 km..95 km) */
  skyDomeAlpha: number;
  /** True when Capytorio orbital globe handoff should activate in PlayStyleManager */
  planetGlobeActive: boolean;
  /** Gentle scale factor near upper handoff so residual 3D proxies never pop */
  proxyScale: number;
}

export function createCapytorioAltitudeLodState(): CapytorioAltitudeLodState {
  return {
    logAlt: 1.41,
    groundDeckAlpha: 1,
    useDetailedMachines: true,
    useProxyMachines: false,
    useDetailedBelts: true,
    useProxyBelts: false,
    showDetailedTrees: true,
    showCanopyOnlyTrees: false,
    showOreCrystals: true,
    clipmapOpacity: 1,
    hazeStrength: 0,
    cloudLayer1Opacity: 0,
    cloudLayer2Opacity: 0,
    skyDomeAlpha: 1,
    planetGlobeActive: false,
    proxyScale: 1,
  };
}

function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Evaluates all Capytorio continuous altitude tiers, clipmap opacity, cloud strata lens-fades,
 * and Rayleigh aerial haze in-place with zero heap allocations.
 */
export function evaluateCapytorioAltitudeLod(
  altitudeRadius: number,
  out: CapytorioAltitudeLodState
): CapytorioAltitudeLodState {
  const alt = Number.isFinite(altitudeRadius) ? Math.max(8, altitudeRadius) : 26;
  const logAlt = Math.log10(alt);
  out.logAlt = logAlt;

  // Ground 128x128 vertex deck stays crisp at close range (<= 180 m) and crossfades onto Ring 0 by 340 m
  out.groundDeckAlpha = 1.0 - smoothstep(185, 340, alt);

  // Full 3D machines vs single-draw-call simplified 3D proxies (both also stamped into Ring 0..4 clipmaps!)
  out.useDetailedMachines = alt <= 280;
  out.useProxyMachines = alt > 280 && alt <= 6_500;
  out.useDetailedBelts = alt <= 320;
  out.useProxyBelts = alt > 320 && alt <= 5_200;

  // 3D foliage & ore tiers (distant forests and ore fields continue seamlessly on Ring 0..4 clipmaps!)
  out.showDetailedTrees = alt <= 290;
  out.showCanopyOnlyTrees = alt > 290 && alt <= 1_450;
  out.showOreCrystals = alt <= 340;

  // Nested planetary clipmap stays 100% crisp up to ~52 km (logAlt 4.72), then dissolves seamlessly
  // onto the Capy-Earth orbital planet globe through ~240 km (logAlt 5.38)
  out.clipmapOpacity = 1.0 - smoothstep(4.72, 5.38, logAlt);

  // Soft Rayleigh daylight haze: rises gently from 420 m to ~25 km, never obscures factory completely
  const hazeRise = smoothstep(2.62, 4.18, logAlt);
  const hazeSpaceFade = 1.0 - smoothstep(4.62, 5.28, logAlt);
  out.hazeStrength = hazeRise * (0.34 * hazeSpaceFade + 0.14 * (1 - hazeSpaceFade));

  // Estimate vertical camera height (~sin(78 deg) * alt at high altitude) for cloud-pass lens fade
  const approxCamY = alt * 0.96;

  // Lower patchy cumulus stratum (~760 m)
  const lowerFadeIn = smoothstep(340, 620, alt);
  const lowerLensGap = smoothstep(65, 250, Math.abs(approxCamY - CAPYTORIO_CLOUD_LOWER_Y));
  const lowerOrbitFade = 1.0 - smoothstep(4.68, 5.26, logAlt);
  out.cloudLayer1Opacity = lowerFadeIn * (0.18 + 0.82 * lowerLensGap) * lowerOrbitFade * 0.56;

  // Upper wispy stratocumulus stratum (~2,350 m)
  const upperFadeIn = smoothstep(1_050, 1_900, alt);
  const upperLensGap = smoothstep(160, 680, Math.abs(approxCamY - CAPYTORIO_CLOUD_UPPER_Y));
  const upperOrbitFade = 1.0 - smoothstep(4.82, 5.36, logAlt);
  out.cloudLayer2Opacity = upperFadeIn * (0.20 + 0.80 * upperLensGap) * upperOrbitFade * 0.46;

  // Daylight sky dome deepens smoothly from troposphere (~7 km) into high orbit (~90 km)
  out.skyDomeAlpha = 1.0 - smoothstep(3.85, 4.95, logAlt);

  // Keep seamlessUniverse orbital globe dormant until high altitude so Nauvis clipmaps own 10 m..35 km
  out.planetGlobeActive = alt > CAPYTORIO_PLANET_GLOBE_ACTIVATE_M;

  // Smooth proxy scale taper before handing off solely to stamped clipmap pixels
  out.proxyScale = alt <= 3_500 ? 1.0 : 1.0 - 0.55 * smoothstep(3_500, 6_500, alt);

  return out;
}

/**
 * Computes whether a specific clipmap ring should be rendered at a given altitude, plus its opacity
 * so rings smoothly hand off without popping.
 */
export function evaluateClipmapRingAlpha(
  ring: CapytorioClipmapRingConfig,
  altitudeRadius: number,
  masterClipmapOpacity: number
): number {
  if (masterClipmapOpacity <= 0.004) return 0;
  if (altitudeRadius < ring.minAltitudeM * 0.85 || altitudeRadius > ring.maxAltitudeM * 1.15) {
    return 0;
  }
  const fadeIn =
    ring.minAltitudeM <= 0
      ? 1.0
      : smoothstep(ring.minAltitudeM * 0.85, ring.minAltitudeM * 1.35, altitudeRadius);
  const fadeOut =
    ring.index === CAPYTORIO_CLIPMAP_RINGS.length - 1
      ? 1.0
      : 1.0 - smoothstep(ring.maxAltitudeM * 0.72, ring.maxAltitudeM * 1.12, altitudeRadius);
  return masterClipmapOpacity * fadeIn * fadeOut;
}

/**
 * Daylight-calibrated roof/chassis hex color for simplified 3D proxies & live clipmap stamping.
 * Matched closely to CapytorioMeshBuilder's 3D machine PBR materials so zooming out looks identical, just smaller.
 */
export function getCapytorioMachineProxyColorHex(
  type: CapytorioMachineType,
  variantItemId?: CapytorioItemId
): number {
  if (variantItemId === 'fast_transport_belt') return 0xdc2626;
  if (variantItemId === 'express_transport_belt') return 0x0284c7;
  if (variantItemId === 'solar_panel') return 0x1d4ed8;
  if (variantItemId === 'accumulator') return 0x38bdf8;
  if (variantItemId === 'nuclear_reactor') return 0x22c55e;
  if (variantItemId === 'steam_turbine' || variantItemId === 'steam_engine') return 0x94a3b8;
  if (variantItemId === 'boiler') return 0x64748b;
  if (variantItemId === 'electric_furnace') return 0x94a3b8;
  if (variantItemId === 'steel_furnace') return 0x78716c;
  if (variantItemId === 'assembling_machine_2') return 0x2563eb;
  if (variantItemId === 'assembling_machine_3') return 0x16a34a;
  if (variantItemId === 'oil_refinery' || variantItemId === 'chemical_plant') return 0x6d28d9;
  if (variantItemId === 'pumpjack') return 0x7c3aed;
  if (variantItemId === 'beacon') return 0x0891b2;
  if (variantItemId === 'roboport') return 0x0ea5e9;
  if (variantItemId === 'radar') return 0x475569;
  if (variantItemId === 'rocket_silo') return 0xe2e8f0;
  if (variantItemId === 'stone_wall' || variantItemId === 'gate') return 0x9ca3af;
  if (variantItemId === 'gun_turret' || variantItemId === 'laser_turret') return 0xe11d48;
  if (variantItemId === 'substation' || variantItemId === 'big_electric_pole') return 0x475569;
  if (variantItemId === 'small_electric_pole' || variantItemId === 'medium_electric_pole') return 0x92400e;
  if (variantItemId === 'pipe' || variantItemId === 'pipe_to_ground') return 0x64748b;

  switch (type) {
    case 'belt':
      return 0xeab308;
    case 'drill':
      return 0xd97706;
    case 'furnace':
      return 0xb45309;
    case 'assembler':
      return 0x3b82f6;
    case 'inserter':
      return 0xf59e0b;
    case 'splitter':
      return 0xfbbf24;
    case 'tunnel':
      return 0xca8a04;
    case 'chest':
      return 0x854d0e;
    case 'generator':
      return 0x475569;
    case 'lab':
      return 0x8b5cf6;
    default:
      return 0x94a3b8;
  }
}

/**
 * Representative 3D building height (meters) for simplified instanced machine proxies.
 */
export function getCapytorioMachineProxyHeight(
  type: CapytorioMachineType,
  variantItemId?: CapytorioItemId
): number {
  if (variantItemId === 'solar_panel') return 0.65;
  if (variantItemId === 'pipe' || variantItemId === 'pipe_to_ground') return 0.55;
  if (
    variantItemId === 'small_electric_pole' ||
    variantItemId === 'medium_electric_pole' ||
    variantItemId === 'big_electric_pole' ||
    variantItemId === 'substation'
  ) {
    return 2.6;
  }
  if (variantItemId === 'rocket_silo') return 3.6;
  if (variantItemId === 'nuclear_reactor') return 3.2;
  if (variantItemId === 'oil_refinery') return 2.9;
  if (variantItemId === 'roboport') return 2.4;
  switch (type) {
    case 'belt':
      return 0.16;
    case 'inserter':
      return 0.85;
    case 'chest':
      return 0.95;
    case 'splitter':
    case 'tunnel':
      return 0.75;
    case 'drill':
      return 1.85;
    case 'furnace':
      return 1.95;
    case 'assembler':
      return 2.05;
    case 'generator':
      return 2.25;
    case 'lab':
      return 2.35;
    default:
      return 1.5;
  }
}

/** Shared daylight RGB palette (0..255 sRGB) for Factorio Nauvis resources in clipmap tiles */
export const CAPYTORIO_ORE_CLIPMAP_RGB: readonly (readonly [number, number, number])[] = [
  [104, 154, 198], // 0: iron_ore (steel-slate blue)
  [214, 114, 58],  // 1: copper_ore (warm copper orange)
  [36, 38, 42],    // 2: coal (charcoal)
  [178, 166, 134], // 3: stone (warm limestone)
  [74, 212, 108],  // 4: uranium_ore (luminous emerald)
  [54, 28, 72],    // 5: crude_oil (deep violet-black)
];

/** Shared daylight RGB palette (0..255 sRGB) for the 5 Nauvis tree species styles (1..5) */
export const CAPYTORIO_TREE_CLIPMAP_RGB: readonly (readonly [number, number, number])[] = [
  [38, 128, 46],   // 0: fallback green
  [38, 134, 48],   // 1: lush meadow green
  [44, 116, 52],   // 2: pine / olive
  [162, 74, 42],   // 3: red / autumn
  [132, 94, 46],   // 4: brown / savanna
  [124, 106, 78],  // 5: desert dry
];
