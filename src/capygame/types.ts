export type PlayStyle = 'sanctuary' | 'spore' | 'breakout' | 'runner' | 'fallguys';

export type MutationId = 'flippers' | 'wings' | 'tusks' | 'horn' | 'shell' | 'glow_tail';

export interface CapyMutation {
  id: MutationId;
  name: string;
  description: string;
  speedBonus: number;
  magnetBonus: number;
  dnaCost: number;
}

export const SPORE_MUTATIONS: CapyMutation[] = [
  {
    id: 'flippers',
    name: 'Aqua Flippers',
    description: 'Webbed turbo paws for +25% movement speed across all game zones.',
    speedBonus: 0.25,
    magnetBonus: 0,
    dnaCost: 4,
  },
  {
    id: 'tusks',
    name: 'Mighty Chomp Tusks',
    description: 'Prehistoric tusks that widen chomp reach and boost Yuzu collection.',
    speedBonus: 0.08,
    magnetBonus: 0.25,
    dnaCost: 5,
  },
  {
    id: 'shell',
    name: 'Armored Yuzu Shell',
    description: 'Spiky citrus carapace that protects your herd and stabilizes parkour landings.',
    speedBonus: 0.05,
    magnetBonus: 0.35,
    dnaCost: 6,
  },
  {
    id: 'wings',
    name: 'Celestial Glide Wings',
    description: 'Feathered capybara wings that boost jump height and air control.',
    speedBonus: 0.35,
    magnetBonus: 0.4,
    dnaCost: 8,
  },
  {
    id: 'horn',
    name: 'Unicorn Prism Horn',
    description: 'Mythic crystalline horn that radiates a wide Yuzu & DNA magnet aura.',
    speedBonus: 0.2,
    magnetBonus: 1.0,
    dnaCost: 10,
  },
  {
    id: 'glow_tail',
    name: 'Bioluminescent Tail',
    description: 'Apex evolutionary trait boosting dash agility and glowing in the lagoon.',
    speedBonus: 0.3,
    magnetBonus: 0.6,
    dnaCost: 8,
  },
];

export type BuildingType =
  | 'hot_spring'
  | 'yuzu_orchard'
  | 'bamboo_grove'
  | 'zen_pagoda'
  | 'capy_statue'
  | 'trampoline_pad';

export interface BuildingCatalogItem {
  type: BuildingType;
  name: string;
  icon: string;
  description: string;
  coinCost: number;
}

export const BUILDING_CATALOG: BuildingCatalogItem[] = [
  {
    type: 'hot_spring',
    name: 'Cozy Onsen',
    icon: '♨️',
    description: 'Steaming mineral bath where capybaras soak with yuzu on their heads.',
    coinCost: 8,
  },
  {
    type: 'yuzu_orchard',
    name: 'Yuzu Orchard',
    icon: '🌳',
    description: 'Fragrant citrus grove that drops collectible golden yuzu around the island.',
    coinCost: 10,
  },
  {
    type: 'trampoline_pad',
    name: 'Bouncy Mushroom Pad',
    icon: '🍄',
    description: 'Springy giant mushroom pad—jump on it in the Sanctuary for high-altitude bounces!',
    coinCost: 10,
  },
  {
    type: 'bamboo_grove',
    name: 'Emerald Bamboo Grove',
    icon: '🎋',
    description: 'Tranquil bamboo forest that shelters wandering capybara families.',
    coinCost: 12,
  },
  {
    type: 'zen_pagoda',
    name: 'Sacred Capy Pagoda',
    icon: '⛩️',
    description: 'Ancient timber temple overlooking the entire 3D Capybara Archipelago.',
    coinCost: 15,
  },
  {
    type: 'capy_statue',
    name: 'Golden Capy Monument',
    icon: '🗿',
    description: 'Gleaming solid-gold monument celebrating the supreme chill of the Capybara.',
    coinCost: 20,
  },
];

export const COSMETIC_COIN_COSTS: Record<string, number> = {
  yuzu: 0,
  flower: 0,
  party: 12,
  crown: 15,
  wizard: 18,
  halo: 22,
};

export interface WorldBuilding {
  id: string;
  type: BuildingType;
  name: string;
  level: number;
  x: number;
  z: number;
  description: string;
}

export type CapyLodTier = 0 | 1 | 2 | 3;

export interface HeadOrangeVariety {
  id: 'tangerine' | 'valencia' | 'blood_orange' | 'calamansi' | 'mandarin';
  name: string;
  colorHex: number;
  cssColor: string;
  emissiveHex: number;
}

export const HEAD_ORANGE_VARIETIES: HeadOrangeVariety[] = [
  {
    id: 'tangerine',
    name: 'Tangerine Orange',
    colorHex: 0xff7a00,
    cssColor: '#ff7a00',
    emissiveHex: 0x7c2d12,
  },
  {
    id: 'valencia',
    name: 'Valencia Gold',
    colorHex: 0xffb703,
    cssColor: '#ffb703',
    emissiveHex: 0x78350f,
  },
  {
    id: 'blood_orange',
    name: 'Blood Orange',
    colorHex: 0xf43f5e,
    cssColor: '#f43f5e',
    emissiveHex: 0x881337,
  },
  {
    id: 'calamansi',
    name: 'Key-Lime Citrus',
    colorHex: 0x84cc16,
    cssColor: '#84cc16',
    emissiveHex: 0x365314,
  },
  {
    id: 'mandarin',
    name: 'Azure Mandarin',
    colorHex: 0x38bdf8,
    cssColor: '#38bdf8',
    emissiveHex: 0x0c4a6e,
  },
];

export type WeatherType = 'clear' | 'rain' | 'storm' | 'mist' | 'snow';

export interface CapySnakeTelemetry {
  bodySegments: number;
  bestSegments: number;
  lengthMeters: number;
  orangesCollected: number;
  fruitsCarried: number;
  mouthMaxRadiusCm: number;
  groundRollingFruits: number;
  pondFruits: number;
  pondOverflowing: boolean;
  pondMessPercent: number;
  groundedFeet: number;
  totalFeet: number;
  isWalkingBackward: boolean;
  isStuckNoFooting: boolean;
  occludedObjectsFaded: number;
  headOrangeName: string;
  headOrangeCss: string;
  headOrangeHex: number;
  timeOfDayHours: number;
  dayPhaseLabel: string;
  weather: WeatherType;
  weatherLabel: string;
  fps: number;
  lodTier: CapyLodTier;
  lodLabel: string;
  trianglesPerCapy: number;
  autoLodEnabled: boolean;
}

export interface LiveModeTelemetry {
  mode: PlayStyle;
  primaryLabel: string;
  primaryValue: string | number;
  secondaryLabel: string;
  secondaryValue: string | number;
  zoneCoordsLabel: string;
}

export type AstrophysicsPaletteMode = 'natural' | 'hubble';

export { GPU_VISUAL_FILTER_PROFILES } from './engine/gpu/GpuEngineTypes';
export type {
  GpuAntiAliasingMode,
  GpuEngineTelemetry,
  GpuPipelineConfig,
  GpuQualityPreset,
  GpuRenderBackendMode,
  GpuShadowQualityMode,
  GpuTextureFilterMode,
  GpuToneMappingMode,
  GpuVisualFilterPreset,
  PerformanceLogEntry,
  PerformanceLogSeverity,
  PerformanceLogSnapshot,
  PerformanceAnalysisSnapshot,
  ProfilerModuleMetric,
  ProfilerActionEvent,
  ProfilerPhaseId,
} from './engine/gpu/GpuEngineTypes';

import type {
  GpuAntiAliasingMode,
  GpuQualityPreset,
  GpuRenderBackendMode,
  GpuShadowQualityMode,
  GpuTextureFilterMode,
  GpuToneMappingMode,
  GpuVisualFilterPreset,
} from './engine/gpu/GpuEngineTypes';

export interface CapyGameSettings {
  cameraFollowBehind: boolean;
  mouselookEnabled: boolean;
  mouselookSensitivity: number;
  invertMouseY: boolean;
  cameraDistance: number;
  turnSensitivity: number;
  fov: number;
  worldFogEnabled: boolean;
  drawDistance: number;
  touchControlsMode: 'auto' | 'always' | 'hidden';
  showAboutOnStartup: boolean;
  autoCapyLod: boolean;
  manualCapyLodTier: CapyLodTier;
  lock60FpsGovernor: boolean;
  maxFpsLimit: number;
  fpsTarget: number;
  showFpsButton: boolean;
  dayNightAutoCycle: boolean;
  timeOfDayHours: number;
  weatherMode: 'auto' | WeatherType;
  showObjectMarkers: boolean;
  realityScaleGamma: number;
  astrophysicsPalette: AstrophysicsPaletteMode;
  gpuBackendPreference: GpuRenderBackendMode;
  gpuQualityPreset: GpuQualityPreset;
  gpuPostProcessing: boolean;
  gpuVisualFilter: GpuVisualFilterPreset;
  gpuToneMapping: GpuToneMappingMode;
  gpuExposure: number;
  gpuTextureFilter: GpuTextureFilterMode;
  gpuAnisotropy: 1 | 4 | 8 | 16;
  gpuShadowQuality: GpuShadowQualityMode;
  gpuAntiAliasing: GpuAntiAliasingMode;
  gpuResolutionScale: number;
  gpuBloomEnabled: boolean;
  gpuBloomStrength: number;
  gpuSsaoEnabled: boolean;
  gpuSharpenAmount: number;
}

export const DEFAULT_CAPY_SETTINGS: CapyGameSettings = {
  cameraFollowBehind: true,
  mouselookEnabled: true,
  mouselookSensitivity: 1.0,
  invertMouseY: false,
  cameraDistance: 1.0,
  turnSensitivity: 1.0,
  fov: 58,
  worldFogEnabled: false,
  drawDistance: 650,
  touchControlsMode: 'auto',
  showAboutOnStartup: false,
  autoCapyLod: true,
  manualCapyLodTier: 3,
  lock60FpsGovernor: true,
  maxFpsLimit: 60,
  fpsTarget: 60,
  showFpsButton: true,
  dayNightAutoCycle: true,
  timeOfDayHours: 9.5,
  weatherMode: 'auto',
  showObjectMarkers: false,
  realityScaleGamma: 1.0, // Strict 1:1 physical reality by default
  astrophysicsPalette: 'natural',
  gpuBackendPreference: 'auto',
  gpuQualityPreset: 'high',
  gpuPostProcessing: true,
  gpuVisualFilter: 'natural_pbr',
  gpuToneMapping: 'agx',
  gpuExposure: 1.02,
  gpuTextureFilter: 'trilinear_aniso',
  gpuAnisotropy: 8,
  gpuShadowQuality: 'pcf_soft',
  gpuAntiAliasing: 'msaa_fxaa',
  gpuResolutionScale: 1.0,
  gpuBloomEnabled: true,
  gpuBloomStrength: 0.24,
  gpuSsaoEnabled: true,
  gpuSharpenAmount: 0.26,
};

export interface ProgressiveUnlockMilestone {
  id: 'sanctuary_build' | 'spore_world' | 'breakout_world' | 'runner_world' | 'fallguys_world';
  title: string;
  subtitle: string;
  requiredDna: number;
  targetMode?: PlayStyle;
}

export const PROGRESSIVE_UNLOCKS: ProgressiveUnlockMilestone[] = [
  {
    id: 'sanctuary_build',
    title: 'Sanctuary Builder',
    subtitle: 'Build Onsens, Orchards & Bouncy Pads',
    requiredDna: 0,
    targetMode: 'sanctuary',
  },
  {
    id: 'spore_world',
    title: 'Spore Lagoon & DNA Lab',
    subtitle: 'Swim, chomp plankton & splice 3D traits',
    requiredDna: 5,
    targetMode: 'spore',
  },
  {
    id: 'breakout_world',
    title: 'Yuzu Breakout & Abilities',
    subtitle: 'Smash crystal waves & upgrade stats',
    requiredDna: 12,
    targetMode: 'breakout',
  },
  {
    id: 'runner_world',
    title: 'Number Stampede & Wardrobe',
    subtitle: 'Multiply your Capy herd & equip hats',
    requiredDna: 20,
    targetMode: 'runner',
  },
  {
    id: 'fallguys_world',
    title: 'Yuzu Mountain Parkour',
    subtitle: 'Race rival Capys for the Golden Crown',
    requiredDna: 30,
    targetMode: 'fallguys',
  },
];

export const ZONE_LOCATIONS: Record<
  PlayStyle,
  { x: number; z: number; title: string; subtitle: string }
> = {
  sanctuary: {
    x: 0,
    z: 0,
    title: 'Capy Sanctuary',
    subtitle: 'Central Archipelago Hub & Sandbox Builder',
  },
  spore: {
    x: -75,
    z: -75,
    title: 'Spore Lagoon',
    subtitle: 'North-West Evolution Atoll (-75, -75)',
  },
  breakout: {
    x: 75,
    z: -75,
    title: 'Yuzu Breakout',
    subtitle: 'North-East Arcade Stadium (+75, -75)',
  },
  runner: {
    x: -75,
    z: 75,
    title: 'Number Stampede',
    subtitle: 'South-West Math Causeway (-75, +75)',
  },
  fallguys: {
    x: 75,
    z: 75,
    title: 'Yuzu Mountain',
    subtitle: 'South-East Parkour Gauntlet (+75, +75)',
  },
};

export interface PlayerStats {
  dna: number;
  coins: number;
  prestigeLevel: number;
  selectedPlayStyle: PlayStyle;
  activeHat: string;
  activeSkin: string;
  activeMutations: MutationId[];
  unlockedMutations?: MutationId[];
  evolutionStage: number;

  highScoreSpore: number;
  highScoreBreakout: number;
  highScoreRunner: number;
  highScoreFallGuys: number;

  upgrades: {
    herdSize: number;
    yuzuMagnet: number;
    speedBoost: number;
    paddleSize: number;
    bounciness: number;
  };

  buildings: WorldBuilding[];
  unlockedCosmetics: string[];
  unlockedObjectMarkers?: boolean;
  unlockedRealityRescaler?: boolean;
}

export const OBJECT_MARKERS_DNA_COST = 12;
export const OBJECT_MARKERS_COIN_COST = 30;
export const REALITY_RESCALER_DNA_COST = 20;
export const REALITY_RESCALER_COIN_COST = 45;
export const PRESTIGE_BASE_DNA_COST = 20;

export const INITIAL_PLAYER_STATS: PlayerStats = {
  dna: 30,
  coins: 50,
  prestigeLevel: 1,
  selectedPlayStyle: 'sanctuary',
  activeHat: 'yuzu',
  activeSkin: 'classic',
  activeMutations: [],
  unlockedMutations: [],
  evolutionStage: 1,
  highScoreSpore: 0,
  highScoreBreakout: 0,
  highScoreRunner: 0,
  highScoreFallGuys: 0,
  upgrades: {
    herdSize: 1,
    yuzuMagnet: 1,
    speedBoost: 1,
    paddleSize: 1,
    bounciness: 1,
  },
  buildings: [
    {
      id: 'b_init_onsen',
      type: 'hot_spring',
      name: 'Cozy Onsen',
      level: 1,
      x: -14.8,
      z: 11.6,
      description: 'Steaming mineral bath where capybaras soak with yuzu on their heads.',
    },
    {
      id: 'b_init_yuzu',
      type: 'yuzu_orchard',
      name: 'Yuzu Orchard',
      level: 1,
      x: 15.2,
      z: 2.8,
      description: 'Fragrant citrus grove that drops collectible golden yuzu around the island.',
    },
    {
      id: 'b_init_pad',
      type: 'trampoline_pad',
      name: 'Bouncy Mushroom Pad',
      level: 1,
      x: 3.4,
      z: 7.8,
      description: 'Springy giant mushroom pad—jump on it in the Sanctuary for high-altitude bounces!',
    },
  ],
  unlockedCosmetics: ['yuzu', 'flower'],
  unlockedObjectMarkers: false,
  unlockedRealityRescaler: false,
};

// ============================================================================
// COSMIC GENESIS & MULTI-SCALE UNIVERSE ZOOM TYPES
// ============================================================================

export type CosmicStage =
  | 'singularity'
  | 'big_bang'
  | 'universe_flight'
  | 'galaxy_view'
  | 'star_system_view'
  | 'planet_orbit'
  | 'planet_descent'
  | 'capy_selection'
  | 'playing';

export interface PlanetaryBiomeConfig {
  biomeName: string;
  skyHex: number;
  fogHex: number;
  oceanHex: number;
  islandGrassHex: number;
  beachSandHex: number;
  floraPaletteHexes: number[];
  gravityMultiplier: number;
}

export interface CosmicLandingSpot {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
  biome: PlanetaryBiomeConfig;
}

export type CosmicPlanetType =
  | 'rocky'
  | 'habitable'
  | 'asteroid_belt'
  | 'gas_giant'
  | 'ice_giant';

export interface CosmicAsteroidBeltSpec {
  id: string;
  name: string;
  subtitle: string;
  semiMajorAu: number;
  widthAu: number;
  rockCount: number;
  orbitalPeriodYears: number;
  colorHex: number;
}

export interface CosmicPlanetSpec {
  id: string;
  name: string;
  subtitle: string;
  planetType?: CosmicPlanetType;
  orbitRadius: number;
  orbitSpeed: number;
  size: number;
  colorHex: number;
  continentHex: number;
  atmosphereHex: number;
  hasRings?: boolean;
  ringColorHex?: number;
  semiMajorAu?: number;
  orbitalPeriodYears?: number;
  massLabel?: string;
  diameterKm?: number;
  landingSpots: CosmicLandingSpot[];
}

export interface CosmicStarSystemSpec {
  id: string;
  name: string;
  spectralClass: string;
  subtitle: string;
  localX: number;
  localY: number;
  localZ: number;
  starColorHex: number;
  coronaHex: number;
  starScale: number;
  asteroidBelt?: CosmicAsteroidBeltSpec;
  planets: CosmicPlanetSpec[];
}

// ============================================================================
// ORBITAL TIME SIMULATION & FAST-FORWARD CONTROLS
// ============================================================================

export type OrbitTimeScaleId =
  | 'paused'
  | 'realtime'
  | '1_day_s'
  | '1_month_s'
  | '1_orbit_min'
  | '1_orbit_s'
  | '10_yr_s';

export interface OrbitTimeScaleSpec {
  id: OrbitTimeScaleId;
  label: string;
  shortLabel: string;
  multiplier: number;
  earthOrbitDurationSec: number;
  description: string;
}

export const ORBIT_TIME_SCALES: OrbitTimeScaleSpec[] = [
  {
    id: 'paused',
    label: 'Paused (0x)',
    shortLabel: '⏸ Pause',
    multiplier: 0,
    earthOrbitDurationSec: Infinity,
    description: 'Orbital motion suspended for snapshot inspection.',
  },
  {
    id: 'realtime',
    label: 'Real-Time (1x)',
    shortLabel: '1x Real',
    multiplier: 1,
    earthOrbitDurationSec: 31557600,
    description: 'Astronomical 1:1 time (Earth completes 1 orbit in 365.25 days).',
  },
  {
    id: '1_day_s',
    label: '1 Day / sec',
    shortLabel: '1 Day/s',
    multiplier: 86400,
    earthOrbitDurationSec: 365.25,
    description: '1 second = 1 Earth day (Earth completes 1 orbit in ~6.1 minutes).',
  },
  {
    id: '1_month_s',
    label: '1 Month / sec',
    shortLabel: '1 Mo/s',
    multiplier: 2592000,
    earthOrbitDurationSec: 12.175,
    description: '1 second = 30 Earth days (Earth completes 1 orbit in ~12.2 seconds).',
  },
  {
    id: '1_orbit_min',
    label: '1 Orbit / min',
    shortLabel: '1 Orb/min',
    multiplier: 525960,
    earthOrbitDurationSec: 60.0,
    description: 'Earth completes 1 full revolution in 60 seconds (Keplerian baseline).',
  },
  {
    id: '1_orbit_s',
    label: '1 Orbit / sec',
    shortLabel: '1 Orb/s',
    multiplier: 31557600,
    earthOrbitDurationSec: 1.0,
    description: 'Earth completes 1 full revolution every second.',
  },
  {
    id: '10_yr_s',
    label: '10 Years / sec',
    shortLabel: '10 Yr/s',
    multiplier: 315576000,
    earthOrbitDurationSec: 0.1,
    description: 'Fast-forward: sweeps a decade per second to observe outer gas giant orbits.',
  },
];

export interface OrbitTelemetry {
  scaleId: OrbitTimeScaleId;
  multiplier: number;
  simElapsedYears: number;
  simElapsedDays: number;
  earthOrbitDurationSec: number;
  activeBody?: {
    name: string;
    type: CosmicPlanetType;
    semiMajorAu: number;
    orbitalPeriodYears: number;
    orbitalSpeedKmS: number;
    currentAngleDeg: number;
  };
}

export interface CosmicGalaxySpec {
  id: string;
  name: string;
  styleLabel: string;
  armCount: number;
  radiusScale: number;
  coreColorHex: number;
  armColorHex: number;
  outerColorHex: number;
  posX: number;
  posY: number;
  posZ: number;
  tiltX: number;
  tiltZ: number;
  rotationSpeed: number;
  blackHoleMassLabel: string;
  starSystems: CosmicStarSystemSpec[];
}

export interface PlayableCapyHero {
  id: string;
  name: string;
  title: string;
  skin: string;
  hat: string;
  mutations: MutationId[];
  perkLabel: string;
  perkDescription: string;
  speedMultiplier: number;
  jumpMultiplier: number;
  magnetMultiplier: number;
  herdBonus: number;
}

export const PLAYABLE_CAPY_HEROES: PlayableCapyHero[] = [
  {
    id: 'captain_yuzu',
    name: 'Captain Yuzu',
    title: 'Sanctuary Navigator',
    skin: 'classic',
    hat: 'yuzu',
    mutations: [],
    perkLabel: '+15% Speed · +25% Magnet',
    perkDescription: 'Balanced explorer attuned to warm citrus currents and island springs.',
    speedMultiplier: 1.15,
    jumpMultiplier: 1.05,
    magnetMultiplier: 1.25,
    herdBonus: 0,
  },
  {
    id: 'monarch_rex',
    name: 'Commander Rex',
    title: 'Solar Sprinter',
    skin: 'golden',
    hat: 'crown',
    mutations: ['flippers'],
    perkLabel: '+40% Turbo Speed',
    perkDescription: 'Blazing golden coat and webbed turbo paws built for high-speed exploration.',
    speedMultiplier: 1.4,
    jumpMultiplier: 1.1,
    magnetMultiplier: 1.1,
    herdBonus: 0,
  },
  {
    id: 'sakura_hopper',
    name: 'Sakura Hopper',
    title: 'Low-Gravity Leaper',
    skin: 'sakura',
    hat: 'flower',
    mutations: ['wings'],
    perkLabel: '+45% Jump Height',
    perkDescription: 'Feathered glide wings allow soaring leaps across mushrooms and parkour peaks.',
    speedMultiplier: 1.2,
    jumpMultiplier: 1.45,
    magnetMultiplier: 1.15,
    herdBonus: 0,
  },
  {
    id: 'dr_spore',
    name: 'Dr. Spore',
    title: 'Quantum Bio-Magnet',
    skin: 'matcha',
    hat: 'wizard',
    mutations: ['horn', 'tusks'],
    perkLabel: '+90% Yuzu & DNA Aura',
    perkDescription: 'Crystalline unicorn horn radiates a massive gravitational pull for Yuzu and DNA.',
    speedMultiplier: 1.15,
    jumpMultiplier: 1.1,
    magnetMultiplier: 1.9,
    herdBonus: 0,
  },
  {
    id: 'nebula_zen',
    name: 'Nebula Zen',
    title: 'Void Walker',
    skin: 'cosmic',
    hat: 'halo',
    mutations: ['glow_tail', 'wings'],
    perkLabel: '+30% Speed · +30% Jump',
    perkDescription: 'Born from stardust with a bioluminescent tail and effortless aerial grace.',
    speedMultiplier: 1.3,
    jumpMultiplier: 1.3,
    magnetMultiplier: 1.35,
    herdBonus: 0,
  },
  {
    id: 'stampede_chief',
    name: 'Stampede Chief',
    title: 'Herd Vanguard',
    skin: 'classic',
    hat: 'party',
    mutations: ['shell'],
    perkLabel: '+3 Starting Herd · Armored',
    perkDescription: 'Armored carapace and natural charisma that rallies extra companions.',
    speedMultiplier: 1.2,
    jumpMultiplier: 1.2,
    magnetMultiplier: 1.25,
    herdBonus: 3,
  },
];

function createStarSystemsForGalaxy(
  galaxyPrefix: string,
  baseSkyHex: number,
  baseOceanHex: number,
  baseGrassHex: number
): CosmicStarSystemSpec[] {
  return [
    {
      id: `${galaxyPrefix}_star_sol`,
      name: 'Sol Yuzu Prime',
      spectralClass: 'G2V Golden Star',
      subtitle: 'Warm habitable archipelago system with full planetary family',
      localX: 8,
      localY: 1.2,
      localZ: 5,
      starColorHex: 0xfacc15,
      coronaHex: 0xf97316,
      starScale: 1.25,
      asteroidBelt: {
        id: `${galaxyPrefix}_belt_main`,
        name: 'Sol Yuzu Asteroid Belt',
        subtitle: '2.4–3.2 AU · 1,200 Planetesimals & Carbonaceous Chondrites',
        semiMajorAu: 2.8,
        widthAu: 0.8,
        rockCount: 420,
        orbitalPeriodYears: 4.69,
        colorHex: 0xd6d3d1,
      },
      planets: [
        {
          id: `${galaxyPrefix}_p_vulcan`,
          name: 'Basalt Pyro-Prime',
          subtitle: 'Scorched basalt crust & vulcan magma calderas',
          planetType: 'rocky',
          orbitRadius: 5.2,
          orbitSpeed: 0.82,
          size: 0.85,
          colorHex: 0x78350f,
          continentHex: 0xb45309,
          atmosphereHex: 0xf97316,
          semiMajorAu: 0.42,
          orbitalPeriodYears: 0.27,
          diameterKm: 5120,
          massLabel: '0.06 Earth Masses',
          landingSpots: [],
        },
        {
          id: `${galaxyPrefix}_p_haven`,
          name: 'Capy Haven Alpha',
          subtitle: 'Lush Onsen Archipelago & Emerald Pastures',
          planetType: 'habitable',
          orbitRadius: 9.0,
          orbitSpeed: 0.45,
          size: 1.35,
          colorHex: baseOceanHex,
          continentHex: baseGrassHex,
          atmosphereHex: baseSkyHex,
          semiMajorAu: 1.0,
          orbitalPeriodYears: 1.0,
          diameterKm: 12756,
          massLabel: '1.00 Earth Mass',
          landingSpots: [
            {
              id: `${galaxyPrefix}_land_emerald`,
              name: 'Emerald Onsen Bay',
              subtitle: 'Steaming mineral springs & golden yuzu groves',
              lat: 18,
              lon: 25,
              biome: {
                biomeName: 'Emerald Onsen Bay',
                skyHex: baseSkyHex,
                fogHex: baseSkyHex,
                oceanHex: baseOceanHex,
                islandGrassHex: baseGrassHex,
                beachSandHex: 0xfde68a,
                floraPaletteHexes: [0xfef08a, 0xf472b6, 0x93c5fd, 0xd8b4fe, 0xe2e8f0],
                gravityMultiplier: 1.0,
              },
            },
            {
              id: `${galaxyPrefix}_land_sakura`,
              name: 'Sakura Blossom Atoll',
              subtitle: 'Rose-tinted sky & petal beaches',
              lat: -22,
              lon: 115,
              biome: {
                biomeName: 'Sakura Blossom Atoll',
                skyHex: 0xf472b6,
                fogHex: 0xfbcfe8,
                oceanHex: 0x0284c7,
                islandGrassHex: 0xf9a8d4,
                beachSandHex: 0xfef3c7,
                floraPaletteHexes: [0xffffff, 0xf43f5e, 0xfde047, 0xe879f9, 0xfbcfe8],
                gravityMultiplier: 0.92,
              },
            },
            {
              id: `${galaxyPrefix}_land_amber`,
              name: 'Golden Citrus Highlands',
              subtitle: 'Sunlit amber meadows & warm turquoise tides',
              lat: 35,
              lon: -80,
              biome: {
                biomeName: 'Golden Citrus Highlands',
                skyHex: 0x38bdf8,
                fogHex: 0x7dd3fc,
                oceanHex: 0x0d9488,
                islandGrassHex: 0x84cc16,
                beachSandHex: 0xfcd34d,
                floraPaletteHexes: [0xfacc15, 0xf97316, 0xffffff, 0x34d399, 0xfde047],
                gravityMultiplier: 1.0,
              },
            },
            {
              id: `${galaxyPrefix}_land_nebula`,
              name: 'Starlight Lagoon',
              subtitle: 'Bioluminescent twilight waters & low gravity',
              lat: -40,
              lon: -155,
              biome: {
                biomeName: 'Starlight Lagoon',
                skyHex: 0x1e1b4b,
                fogHex: 0x312e81,
                oceanHex: 0x0369a1,
                islandGrassHex: 0x2dd4bf,
                beachSandHex: 0xc7d2fe,
                floraPaletteHexes: [0x38bdf8, 0xc084fc, 0xf472b6, 0xfacc15, 0x5eead4],
                gravityMultiplier: 0.78,
              },
            },
          ],
        },
        {
          id: `${galaxyPrefix}_p_jovian`,
          name: 'Grand Yuzu Jovian',
          subtitle: 'Massive gas giant with amber storm cyclonic belts',
          planetType: 'gas_giant',
          orbitRadius: 17.5,
          orbitSpeed: 0.22,
          size: 2.6,
          colorHex: 0xf59e0b,
          continentHex: 0xd97706,
          atmosphereHex: 0xfde68a,
          hasRings: false,
          semiMajorAu: 5.2,
          orbitalPeriodYears: 11.86,
          diameterKm: 142984,
          massLabel: '317.8 Earth Masses',
          landingSpots: [],
        },
        {
          id: `${galaxyPrefix}_p_azure`,
          name: 'Azure Ringworld Kronos',
          subtitle: 'Majestic ice-dust rings & crystalline stratosphere',
          planetType: 'gas_giant',
          orbitRadius: 23.5,
          orbitSpeed: 0.15,
          size: 2.15,
          colorHex: 0x0284c7,
          continentHex: 0x2dd4bf,
          atmosphereHex: 0x38bdf8,
          hasRings: true,
          ringColorHex: 0x7dd3fc,
          semiMajorAu: 9.54,
          orbitalPeriodYears: 29.45,
          diameterKm: 120536,
          massLabel: '95.2 Earth Masses',
          landingSpots: [
            {
              id: `${galaxyPrefix}_azure_1`,
              name: 'Sapphire Reef Sanctuary',
              subtitle: 'Shimmering planetary rings overhead',
              lat: 12,
              lon: 45,
              biome: {
                biomeName: 'Sapphire Reef Sanctuary',
                skyHex: 0x0ea5e9,
                fogHex: 0x38bdf8,
                oceanHex: 0x1d4ed8,
                islandGrassHex: 0x2dd4bf,
                beachSandHex: 0xe0f2fe,
                floraPaletteHexes: [0x38bdf8, 0xffffff, 0xf472b6, 0xfacc15, 0xa7f3d0],
                gravityMultiplier: 0.88,
              },
            },
            {
              id: `${galaxyPrefix}_azure_2`,
              name: 'Turquoise Spire Cove',
              subtitle: 'Warm coral shallows & crystal flora',
              lat: -28,
              lon: -65,
              biome: {
                biomeName: 'Turquoise Spire Cove',
                skyHex: 0x0284c7,
                fogHex: 0x0ea5e9,
                oceanHex: 0x0f766e,
                islandGrassHex: 0x34d399,
                beachSandHex: 0xfef08a,
                floraPaletteHexes: [0xfde047, 0x60a5fa, 0xf472b6, 0xffffff, 0x6ee7b7],
                gravityMultiplier: 0.9,
              },
            },
          ],
        },
        {
          id: `${galaxyPrefix}_p_velvet`,
          name: 'Amethyst Dawn',
          subtitle: 'Deep azure ice giant with high-atmosphere auroras',
          planetType: 'ice_giant',
          orbitRadius: 29.0,
          orbitSpeed: 0.09,
          size: 1.6,
          colorHex: 0x6d28d9,
          continentHex: 0xc084fc,
          atmosphereHex: 0xa855f7,
          hasRings: true,
          ringColorHex: 0xd8b4fe,
          semiMajorAu: 19.2,
          orbitalPeriodYears: 84.0,
          diameterKm: 51118,
          massLabel: '14.5 Earth Masses',
          landingSpots: [
            {
              id: `${galaxyPrefix}_velvet_1`,
              name: 'Violet Spore Valley',
              subtitle: 'Low-gravity lavender pastures',
              lat: 15,
              lon: 90,
              biome: {
                biomeName: 'Violet Spore Valley',
                skyHex: 0x4c1d95,
                fogHex: 0x6d28d9,
                oceanHex: 0x3b0764,
                islandGrassHex: 0xa855f7,
                beachSandHex: 0xf3e8ff,
                floraPaletteHexes: [0xf472b6, 0x38bdf8, 0xfacc15, 0xffffff, 0xe879f9],
                gravityMultiplier: 0.75,
              },
            },
          ],
        },
      ],
    },
    {
      id: `${galaxyPrefix}_star_hyperion`,
      name: 'Sirius Cyan-B',
      spectralClass: 'B1V Blue Supergiant',
      subtitle: 'High-energy luminous stellar system',
      localX: -11,
      localY: -0.8,
      localZ: 9,
      starColorHex: 0x38bdf8,
      coronaHex: 0x0284c7,
      starScale: 1.45,
      asteroidBelt: {
        id: `${galaxyPrefix}_belt_cyan`,
        name: 'Cyan Glint Asteroid Ring',
        subtitle: 'Silicate & metallic boulder field at 2.6 AU',
        semiMajorAu: 2.6,
        widthAu: 0.7,
        rockCount: 380,
        orbitalPeriodYears: 4.19,
        colorHex: 0x93c5fd,
      },
      planets: [
        {
          id: `${galaxyPrefix}_p_iron`,
          name: 'Ferrum Obsidian',
          subtitle: 'Metallic rocky iron world in close orbit',
          planetType: 'rocky',
          orbitRadius: 5.8,
          orbitSpeed: 0.75,
          size: 0.9,
          colorHex: 0x475569,
          continentHex: 0x64748b,
          atmosphereHex: 0x94a3b8,
          semiMajorAu: 0.48,
          orbitalPeriodYears: 0.33,
          diameterKm: 6050,
          massLabel: '0.12 Earth Masses',
          landingSpots: [],
        },
        {
          id: `${galaxyPrefix}_p_hyper_1`,
          name: 'Cerenkov Atoll',
          subtitle: 'Electric blue seas & bioluminescent palms',
          planetType: 'habitable',
          orbitRadius: 10.5,
          orbitSpeed: 0.38,
          size: 1.4,
          colorHex: 0x0369a1,
          continentHex: 0x4ade80,
          atmosphereHex: 0x38bdf8,
          semiMajorAu: 1.15,
          orbitalPeriodYears: 1.23,
          diameterKm: 13400,
          massLabel: '1.18 Earth Masses',
          landingSpots: [
            {
              id: `${galaxyPrefix}_hyper_land_1`,
              name: 'Luminous Lagrange Delta',
              subtitle: 'Radiant cyan sky & emerald shores',
              lat: 10,
              lon: 10,
              biome: {
                biomeName: 'Luminous Lagrange Delta',
                skyHex: 0x0284c7,
                fogHex: 0x38bdf8,
                oceanHex: 0x0369a1,
                islandGrassHex: 0x4ade80,
                beachSandHex: 0xe0f2fe,
                floraPaletteHexes: [0x38bdf8, 0xfef08a, 0xf472b6, 0xffffff, 0x2dd4bf],
                gravityMultiplier: 0.9,
              },
            },
          ],
        },
        {
          id: `${galaxyPrefix}_p_cyan_giant`,
          name: 'Hyperion Storm Colossus',
          subtitle: 'Methane-banded turquoise supergiant',
          planetType: 'gas_giant',
          orbitRadius: 19.0,
          orbitSpeed: 0.2,
          size: 2.5,
          colorHex: 0x0284c7,
          continentHex: 0x0369a1,
          atmosphereHex: 0x67e8f9,
          hasRings: true,
          ringColorHex: 0xa5f3fc,
          semiMajorAu: 6.1,
          orbitalPeriodYears: 15.06,
          diameterKm: 138000,
          massLabel: '240 Earth Masses',
          landingSpots: [],
        },
      ],
    },
    {
      id: `${galaxyPrefix}_star_yuzu`,
      name: 'Antares Amber',
      spectralClass: 'K5III Orange Giant',
      subtitle: 'Eternal golden-hour sunset system',
      localX: 12,
      localY: 0.5,
      localZ: -10,
      starColorHex: 0xf97316,
      coronaHex: 0xef4444,
      starScale: 1.5,
      asteroidBelt: {
        id: `${galaxyPrefix}_belt_amber`,
        name: 'Amber Shingle Asteroid Belt',
        subtitle: 'Pyroxene & gold-rich rubble swarm at 2.9 AU',
        semiMajorAu: 2.9,
        widthAu: 0.9,
        rockCount: 390,
        orbitalPeriodYears: 4.94,
        colorHex: 0xfde047,
      },
      planets: [
        {
          id: `${galaxyPrefix}_p_cinder`,
          name: 'Cinder Crust',
          subtitle: 'Cratered silicate world with red glow cracks',
          planetType: 'rocky',
          orbitRadius: 6.2,
          orbitSpeed: 0.7,
          size: 0.95,
          colorHex: 0x991b1b,
          continentHex: 0x7f1d1d,
          atmosphereHex: 0xf87171,
          semiMajorAu: 0.52,
          orbitalPeriodYears: 0.38,
          diameterKm: 6800,
          massLabel: '0.15 Earth Masses',
          landingSpots: [],
        },
        {
          id: `${galaxyPrefix}_p_sunset`,
          name: 'Golden Yuzu Prime',
          subtitle: 'Warm sunset oceans & citrus groves',
          planetType: 'habitable',
          orbitRadius: 11.5,
          orbitSpeed: 0.34,
          size: 1.5,
          colorHex: 0x0d9488,
          continentHex: 0xfacc15,
          atmosphereHex: 0xfb923c,
          hasRings: true,
          ringColorHex: 0xfde047,
          semiMajorAu: 1.25,
          orbitalPeriodYears: 1.4,
          diameterKm: 14100,
          massLabel: '1.25 Earth Masses',
          landingSpots: [
            {
              id: `${galaxyPrefix}_sunset_land_1`,
              name: 'Sunset Onsen Ridge',
              subtitle: 'Golden-amber turf & warm mineral lagoons',
              lat: 0,
              lon: 0,
              biome: {
                biomeName: 'Sunset Onsen Ridge',
                skyHex: 0xfb923c,
                fogHex: 0xfdba74,
                oceanHex: 0x0f766e,
                islandGrassHex: 0x84cc16,
                beachSandHex: 0xfde047,
                floraPaletteHexes: [0xfef08a, 0xf97316, 0xf43f5e, 0xffffff, 0xa3e635],
                gravityMultiplier: 0.95,
              },
            },
          ],
        },
        {
          id: `${galaxyPrefix}_p_amber_kronos`,
          name: 'Ochre Saturnia',
          subtitle: 'Banded amber gas giant with wide golden ring planes',
          planetType: 'gas_giant',
          orbitRadius: 21.0,
          orbitSpeed: 0.17,
          size: 2.4,
          colorHex: 0xd97706,
          continentHex: 0xb45309,
          atmosphereHex: 0xfef08a,
          hasRings: true,
          ringColorHex: 0xfef08a,
          semiMajorAu: 7.8,
          orbitalPeriodYears: 21.78,
          diameterKm: 125000,
          massLabel: '110 Earth Masses',
          landingSpots: [],
        },
      ],
    },
  ];
}

export const COSMIC_GALAXIES: CosmicGalaxySpec[] = [
  {
    id: 'galaxy_andromeda_yuzu',
    name: 'Yuzu Whirlpool Galaxy',
    styleLabel: '4-Arm Grand Design Spiral',
    armCount: 4,
    radiusScale: 1.25,
    coreColorHex: 0xfffbeb,
    armColorHex: 0xfbbf24,
    outerColorHex: 0x38bdf8,
    posX: -52,
    posY: 12,
    posZ: -38,
    tiltX: 0.38,
    tiltZ: -0.22,
    rotationSpeed: 0.22,
    blackHoleMassLabel: '4.2M Solar Masses',
    starSystems: createStarSystemsForGalaxy('g0', 0x38bdf8, 0x0284c7, 0x4ade80),
  },
  {
    id: 'galaxy_emerald_nebula',
    name: 'Emerald Capybara Nebula',
    styleLabel: '2-Arm Barred Spiral',
    armCount: 2,
    radiusScale: 1.1,
    coreColorHex: 0xecfdf5,
    armColorHex: 0x34d399,
    outerColorHex: 0x0ea5e9,
    posX: 56,
    posY: -8,
    posZ: -44,
    tiltX: -0.45,
    tiltZ: 0.3,
    rotationSpeed: -0.28,
    blackHoleMassLabel: '8.7M Solar Masses',
    starSystems: createStarSystemsForGalaxy('g1', 0x0ea5e9, 0x0f766e, 0x34d399),
  },
  {
    id: 'galaxy_sakura_pinwheel',
    name: 'Sakura Pinwheel M-88',
    styleLabel: '5-Arm Flocculent Spiral',
    armCount: 5,
    radiusScale: 1.4,
    coreColorHex: 0xfff1f2,
    armColorHex: 0xf472b6,
    outerColorHex: 0xa855f7,
    posX: 0,
    posY: 24,
    posZ: -78,
    tiltX: 0.52,
    tiltZ: 0.15,
    rotationSpeed: 0.18,
    blackHoleMassLabel: '14.5M Solar Masses',
    starSystems: createStarSystemsForGalaxy('g2', 0xf472b6, 0x0284c7, 0xf9a8d4),
  },
  {
    id: 'galaxy_sapphire_sombrero',
    name: 'Sapphire Horizon Ring',
    styleLabel: '3-Arm Ringed Spiral',
    armCount: 3,
    radiusScale: 0.95,
    coreColorHex: 0xe0f2fe,
    armColorHex: 0x38bdf8,
    outerColorHex: 0x6366f1,
    posX: -64,
    posY: -18,
    posZ: 28,
    tiltX: -0.28,
    tiltZ: -0.42,
    rotationSpeed: 0.32,
    blackHoleMassLabel: '6.1M Solar Masses',
    starSystems: createStarSystemsForGalaxy('g3', 0x0284c7, 0x1d4ed8, 0x2dd4bf),
  },
  {
    id: 'galaxy_amber_starburst',
    name: 'Golden Onsen Starburst',
    styleLabel: '3-ArmTightly Wound Spiral',
    armCount: 3,
    radiusScale: 1.15,
    coreColorHex: 0xfef3c7,
    armColorHex: 0xf97316,
    outerColorHex: 0xeab308,
    posX: 62,
    posY: 16,
    posZ: 32,
    tiltX: 0.32,
    tiltZ: 0.48,
    rotationSpeed: -0.24,
    blackHoleMassLabel: '11.0M Solar Masses',
    starSystems: createStarSystemsForGalaxy('g4', 0xfb923c, 0x0d9488, 0x84cc16),
  },
  {
    id: 'galaxy_violet_quasar',
    name: 'Amethyst Quasar Cluster',
    styleLabel: '4-Arm Grand Vortex',
    armCount: 4,
    radiusScale: 1.3,
    coreColorHex: 0xf5f3ff,
    armColorHex: 0xc084fc,
    outerColorHex: 0xec4899,
    posX: 4,
    posY: -26,
    posZ: 54,
    tiltX: -0.4,
    tiltZ: 0.25,
    rotationSpeed: 0.26,
    blackHoleMassLabel: '21.4M Solar Masses',
    starSystems: createStarSystemsForGalaxy('g5', 0x4c1d95, 0x3b0764, 0xa855f7),
  },
];

// ============================================================================
// SEAMLESS ORDERS-OF-MAGNITUDE UNIVERSE SIMULATOR (+28 TO -35 LOG10 METERS)
// ============================================================================

export type UniverseScaleBandId =
  | 'multiverse'
  | 'big_bang'
  | 'universe'
  | 'observable'
  | 'cosmic_web'
  | 'filament'
  | 'supercluster'
  | 'cluster'
  | 'galaxy'
  | 'spiral_arms'
  | 'nebulas'
  | 'stellar_systems'
  | 'planetary_system'
  | 'planet'
  | 'atmosphere'
  | 'land_masses'
  | 'ecosystems'
  | 'capybara_forest'
  | 'leaf_fur_micro'
  | 'biological_cells'
  | 'dna_molecules'
  | 'atomic_orbitals'
  | 'atomic_nucleus'
  | 'quarks_gluons'
  | 'single_electron'
  | 'single_photon'
  | 'planck_quantum_foam';

export type GalaxyMorphology = 'spiral' | 'barred_spiral' | 'elliptical' | 'irregular';

export type QuantumFocusMode = 'auto' | 'electron' | 'photon';

export interface UniverseScaleBandSpec {
  id: UniverseScaleBandId;
  title: string;
  shortLabel: string;
  subtitle: string;
  logMeters: number;
  typicalSizeLabel: string;
  domain: 'cosmic' | 'stellar' | 'planetary' | 'terrestrial' | 'microscopic' | 'quantum';
  skyHex: number;
  accentHex: number;
}

export const MIN_UNIVERSE_LOG_METERS = -35.0;
export const MAX_UNIVERSE_LOG_METERS = 30.0;
export const CAPYBARA_FOREST_LOG_METERS = 0.8;

export const UNIVERSE_SCALE_BANDS: UniverseScaleBandSpec[] = [
  {
    id: 'multiverse',
    title: 'Multiverse & Pocket Bubble Universes',
    shortLabel: 'Multiverse',
    subtitle: 'Higher-dimensional false vacuum void spawning nucleating inflationary universe bubbles',
    logMeters: 30.0,
    typicalSizeLabel: '1.0×10^30 m · Eternal Inflation Landscape',
    domain: 'cosmic',
    skyHex: 0x010006,
    accentHex: 0xa855f7,
  },
  {
    id: 'big_bang',
    title: 'Big Bang & Cosmic Inflation Singularity',
    shortLabel: 'Big Bang',
    subtitle: 'Primordial singularity expanding via exponential cosmic inflation and relativistic plasma',
    logMeters: 28.0,
    typicalSizeLabel: '1.0×10^28 m · Inflation Envelope',
    domain: 'cosmic',
    skyHex: 0x030208,
    accentHex: 0xfef08a,
  },
  {
    id: 'universe',
    title: 'Entire Evolved Universe',
    shortLabel: 'Universe',
    subtitle: 'Total flat spacetime manifold evolved from the Big Bang beyond the visible horizon',
    logMeters: 27.2,
    typicalSizeLabel: '1.6×10^27 m · Total Spacetime Continuum',
    domain: 'cosmic',
    skyHex: 0x02030b,
    accentHex: 0x60a5fa,
  },
  {
    id: 'observable',
    title: 'Observable Universe (CMB Horizon)',
    shortLabel: 'Observable',
    subtitle: '93.0 billion light-year particle horizon bounded by the 2.725 K Cosmic Microwave Background sphere',
    logMeters: 26.94,
    typicalSizeLabel: '8.8×10^26 m · 93.0 Gly',
    domain: 'cosmic',
    skyHex: 0x02040d,
    accentHex: 0x38bdf8,
  },
  {
    id: 'cosmic_web',
    title: 'Cosmic Web & Intergalactic Voids',
    shortLabel: 'Cosmic Web',
    subtitle: 'Large-scale gravitational structure of dark matter halos, gas sheets, and 100 Mly cosmic voids',
    logMeters: 25.2,
    typicalSizeLabel: '1.6×10^25 m · 1.7 Gly',
    domain: 'cosmic',
    skyHex: 0x02030a,
    accentHex: 0x818cf8,
  },
  {
    id: 'filament',
    title: 'Cosmic Filament Wall',
    shortLabel: 'Filament',
    subtitle: 'Gravitational dark matter and baryon bridge linking galaxy superclusters across intergalactic space',
    logMeters: 24.0,
    typicalSizeLabel: '1.0×10^24 m · 105 Mly',
    domain: 'cosmic',
    skyHex: 0x02040c,
    accentHex: 0x67e8f9,
  },
  {
    id: 'supercluster',
    title: 'Supercluster (Laniakea & Great Attractor)',
    shortLabel: 'Supercluster',
    subtitle: 'Gravitational basin of 100,000 galaxies streaming along cosmic streamlines toward the Great Attractor',
    logMeters: 23.0,
    typicalSizeLabel: '1.0×10^23 m · 10.5 Mly',
    domain: 'cosmic',
    skyHex: 0x02040a,
    accentHex: 0xfbbf24,
  },
  {
    id: 'cluster',
    title: 'Galaxy Cluster (Virgo / Coma Swarm)',
    shortLabel: 'Cluster',
    subtitle: 'Gravitationally bound swarm of thousands of galaxies immersed in hot X-ray intracluster plasma',
    logMeters: 22.2,
    typicalSizeLabel: '1.6×10^22 m · 1.7 Mly',
    domain: 'cosmic',
    skyHex: 0x03040e,
    accentHex: 0xf472b6,
  },
  {
    id: 'galaxy',
    title: 'Milky Way Galaxy & Spiral Arms',
    shortLabel: 'Galaxy',
    subtitle: '105,700 ly stellar disc, central bulge, Sagittarius A* SMBH & continuous spiral arms',
    logMeters: 21.0,
    typicalSizeLabel: '1.0×10^21 m · 105,700 ly',
    domain: 'cosmic',
    skyHex: 0x020308,
    accentHex: 0x60a5fa,
  },
  {
    id: 'spiral_arms',
    title: 'Spiral Arms (Orion-Cygnus Spur · 26,000 ly)',
    shortLabel: 'Spiral Arms',
    subtitle: 'Solar neighborhood inside the Milky Way Orion-Cygnus Spur, ~50% radius from core, OB supergiants & dust rifts',
    logMeters: 19.4,
    typicalSizeLabel: '2.5×10^19 m · 2,600 ly',
    domain: 'cosmic',
    skyHex: 0x030209,
    accentHex: 0x38bdf8,
  },
  {
    id: 'nebulas',
    title: 'Nebulas, Molecular Clouds & Dust Pillars',
    shortLabel: 'Nebulas',
    subtitle: 'Ionized H-II gas clouds, dark absorptive Bok globules, M16 pillars of creation, and Herbig-Haro shock jets',
    logMeters: 17.2,
    typicalSizeLabel: '1.6×10^17 m · 17 ly',
    domain: 'stellar',
    skyHex: 0x030208,
    accentHex: 0xf43f5e,
  },
  {
    id: 'stellar_systems',
    title: 'Stellar & Planetary Systems (Solar System)',
    shortLabel: 'Stellar System',
    subtitle: '0.005–50,000 AU · Central Star, Terrestrial Planets, Asteroids, Jovian Giants, Kuiper Belt & Oort Cloud',
    logMeters: 12.95,
    typicalSizeLabel: '1.5×10^13 m · 100 AU',
    domain: 'stellar',
    skyHex: 0x010308,
    accentHex: 0xfacc15,
  },
  {
    id: 'planetary_system',
    title: 'Planetary System & Moon Orbits',
    shortLabel: 'Planetary System',
    subtitle: 'Planetary Hill sphere, Capy-Moon orbital ellipse (384,400 km), and ring plane',
    logMeters: 8.85,
    typicalSizeLabel: '7.1×10^8 m · Hill Sphere & Moon Orbit',
    domain: 'planetary',
    skyHex: 0x010206,
    accentHex: 0x38bdf8,
  },
  {
    id: 'planet',
    title: 'Planet & Continents (Capy-Earth)',
    shortLabel: 'Planet',
    subtitle: '12,742 km terrestrial sphere, azure oceans, green continents, and polar ice caps',
    logMeters: 7.10,
    typicalSizeLabel: '1.27×10^7 m · Planetary Diameter',
    domain: 'planetary',
    skyHex: 0x04132b,
    accentHex: 0x22c55e,
  },
  {
    id: 'atmosphere',
    title: 'Atmosphere & Cloud Decks',
    shortLabel: 'Atmosphere',
    subtitle: '80 km Kármán Rayleigh blue limb, jet streams & cumulus cloud towers',
    logMeters: 4.9,
    typicalSizeLabel: '8.0×10^4 m · 80 km',
    domain: 'terrestrial',
    skyHex: 0x0c4a6e,
    accentHex: 0x7dd3fc,
  },
  {
    id: 'land_masses',
    title: 'Land Masses & Cordilleras',
    shortLabel: 'Land Masses',
    subtitle: 'Snow-capped mountain ranges, braided river deltas & island archipelagos',
    logMeters: 3.6,
    typicalSizeLabel: '4.0×10^3 m · 4.0 km',
    domain: 'terrestrial',
    skyHex: 0x0284c7,
    accentHex: 0x4ade80,
  },
  {
    id: 'ecosystems',
    title: 'Forest & Wetland Ecosystems',
    shortLabel: 'Ecosystems',
    subtitle: 'Broadleaf & conifer woodland canopy, marshes & sunlit citrus groves',
    logMeters: 2.2,
    typicalSizeLabel: '1.6×10^2 m · 160 m',
    domain: 'terrestrial',
    skyHex: 0x38bdf8,
    accentHex: 0x22c55e,
  },
  {
    id: 'capybara_forest',
    title: 'Forest with Capybaras',
    shortLabel: 'Capybara Forest',
    subtitle: 'Live 3D woodland sanctuary, 1.3m grazing Capybaras, Home Pool & citrus trees',
    logMeters: 0.8,
    typicalSizeLabel: '6.3 m · Woodland Clearing',
    domain: 'terrestrial',
    skyHex: 0x38bdf8,
    accentHex: 0xfbbf24,
  },
  {
    id: 'leaf_fur_micro',
    title: 'Citrus Leaf & Capybara Fur',
    shortLabel: 'Leaf & Fur',
    subtitle: 'Vascular leaf venation, stomatal guard pores & keratin fur cuticles',
    logMeters: -2.0,
    typicalSizeLabel: '1.0 cm · 10^-2 m',
    domain: 'microscopic',
    skyHex: 0x041f14,
    accentHex: 0x84cc16,
  },
  {
    id: 'biological_cells',
    title: 'Biological Cells & Chloroplasts',
    shortLabel: 'Plant Cells',
    subtitle: '50 µm palisade cellulose walls, 5 µm chloroplasts & chromatin nucleus',
    logMeters: -4.3,
    typicalSizeLabel: '50 µm · 5.0×10^-5 m',
    domain: 'microscopic',
    skyHex: 0x032221,
    accentHex: 0x10b981,
  },
  {
    id: 'dna_molecules',
    title: 'DNA Double Helix & Molecules',
    shortLabel: 'DNA Helix',
    subtitle: '3.4 nm B-DNA helical pitch, 2.0 nm diameter & Watson-Crick base rungs',
    logMeters: -8.47,
    typicalSizeLabel: '3.4 nm · 3.4×10^-9 m',
    domain: 'microscopic',
    skyHex: 0x051322,
    accentHex: 0x2dd4bf,
  },
  {
    id: 'atomic_orbitals',
    title: 'Carbon Atom & Electron Cloud',
    shortLabel: 'Atom Orbitals',
    subtitle: '3.4 Å van der Waals cloud; C-12 nucleus sits 63,000× smaller at center',
    logMeters: -9.47,
    typicalSizeLabel: '3.4 Å · 3.4×10^-10 m',
    domain: 'quantum',
    skyHex: 0x030817,
    accentHex: 0x38bdf8,
  },
  {
    id: 'atomic_nucleus',
    title: 'Atomic Nucleus (Protons & Neutrons)',
    shortLabel: 'Nucleus',
    subtitle: '5.4 fm Carbon-12 nucleon cluster bound by strong Yukawa pion exchange',
    logMeters: -14.27,
    typicalSizeLabel: '5.4 fm · 5.4×10^-15 m',
    domain: 'quantum',
    skyHex: 0x050312,
    accentHex: 0xf43f5e,
  },
  {
    id: 'quarks_gluons',
    title: 'Quarks & Gluon Flux Tubes',
    shortLabel: 'Quarks',
    subtitle: 'Valence u-u-d quark triplet confined by relativistic QCD color flux tubes',
    logMeters: -18.0,
    typicalSizeLabel: '1.0 am · 10^-18 m',
    domain: 'quantum',
    skyHex: 0x04020d,
    accentHex: 0xc084fc,
  },
  {
    id: 'single_electron',
    title: 'Single Electron (Dirac Spinor)',
    shortLabel: 'Electron (e-)',
    subtitle: 'Spin-1/2 Dirac probability current, magnetic dipole & QED vacuum polarization',
    logMeters: -23.0,
    typicalSizeLabel: '10^-23 m · Electron Field',
    domain: 'quantum',
    skyHex: 0x020512,
    accentHex: 0x22d3ee,
  },
  {
    id: 'single_photon',
    title: 'Single Photon (EM Wave-Packet)',
    shortLabel: 'Photon (γ)',
    subtitle: 'Quantized orthogonal E ⊥ B electromagnetic wave-packet propagating at c',
    logMeters: -29.0,
    typicalSizeLabel: '10^-29 m · Photon Quantum',
    domain: 'quantum',
    skyHex: 0x02040e,
    accentHex: 0xfde047,
  },
  {
    id: 'planck_quantum_foam',
    title: 'Planck Quantum Foam',
    shortLabel: 'Planck Scale',
    subtitle: 'Spacetime metric fluctuations at 1.616×10^-35 m bridging to T=0 Big Bang',
    logMeters: -35.0,
    typicalSizeLabel: '1.62×10^-35 m · 1 l_P',
    domain: 'quantum',
    skyHex: 0x020108,
    accentHex: 0xe879f9,
  },
];

export type ChronoVesselViewMode = 'chase_pod' | 'telescope_first_person' | 'landed';

export interface ProjectedObjectMarker {
  id: string;
  label: string;
  sublabel: string;
  screenX: number;
  screenY: number;
  colorCss: string;
  targetLogMeters: number;
  isSubPixel: boolean;
}

export interface UniverseScaleTelemetry {
  active: boolean;
  logScaleMeters: number;
  targetLogScaleMeters: number;
  scaleFormatted: string;
  scientificLabel: string;
  bandId: UniverseScaleBandId;
  bandIndex: number;
  totalBands: number;
  bandTitle: string;
  bandSubtitle: string;
  domain: UniverseScaleBandSpec['domain'];
  quantumFocus: QuantumFocusMode;
  autoZoomDir: -1 | 0 | 1;
  realityScaleGamma: number;
  showObjectMarkers: boolean;
  markers: ProjectedObjectMarker[];
  cosmicAgeGyr: number;
  cruiseVelocityLogPerSec: number;
  vesselMode: ChronoVesselViewMode;
  fineStructureInverse: number;
  fineStructureAlpha: number;
  galaxyMorphology: GalaxyMorphology;
}

export function findNearestScaleBandIndex(logMeters: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < UNIVERSE_SCALE_BANDS.length; i++) {
    const d = Math.abs(UNIVERSE_SCALE_BANDS[i].logMeters - logMeters);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function formatPhysicalScaleMeters(logMeters: number): string {
  const meters = Math.pow(10, logMeters);
  if (logMeters >= 25.0) {
    const gly = meters / 9.4607e24;
    return `${gly >= 10 ? gly.toFixed(0) : gly.toFixed(2)} Gly`;
  }
  if (logMeters >= 22.0) {
    const mly = meters / 9.4607e21;
    return `${mly >= 10 ? mly.toFixed(0) : mly.toFixed(1)} Mly`;
  }
  if (logMeters >= 15.98) {
    const ly = meters / 9.4607e15;
    return `${ly >= 100 ? ly.toFixed(0) : ly.toFixed(2)} ly`;
  }
  if (logMeters >= 11.0) {
    const au = meters / 1.4959787e11;
    return `${au >= 10 ? au.toFixed(1) : au.toFixed(2)} AU`;
  }
  if (logMeters >= 3.0) {
    const km = meters / 1e3;
    return km >= 1e5
      ? `${(km / 1e3).toFixed(0)}k km`
      : km >= 100
        ? `${km.toFixed(0)} km`
        : `${km.toFixed(2)} km`;
  }
  if (logMeters >= 0.0) {
    return `${meters >= 10 ? meters.toFixed(1) : meters.toFixed(2)} m`;
  }
  if (logMeters >= -2.5) {
    return `${(meters * 100).toFixed(2)} cm`;
  }
  if (logMeters >= -3.5) {
    return `${(meters * 1e3).toFixed(2)} mm`;
  }
  if (logMeters >= -6.5) {
    return `${(meters * 1e6).toFixed(2)} µm`;
  }
  if (logMeters >= -9.5) {
    return `${(meters * 1e9).toFixed(2)} nm`;
  }
  if (logMeters >= -12.5) {
    return `${(meters * 1e12).toFixed(2)} pm`;
  }
  if (logMeters >= -16.5) {
    return `${(meters * 1e15).toFixed(2)} fm`;
  }
  if (logMeters >= -20.5) {
    return `${(meters * 1e18).toFixed(2)} am`;
  }
  const planckLengths = Math.pow(10, logMeters - -34.7915);
  if (logMeters <= -33.0) {
    return `${planckLengths.toFixed(1)} l_P`;
  }
  return `10^${logMeters.toFixed(1)} m`;
}
