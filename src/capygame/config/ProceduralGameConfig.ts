import type { AstrophysicsPaletteMode, WeatherType } from '../types';

export type StarColorMode = 'hr_blackbody' | 'mass_spectrum' | 'age_gradient';
export type StartingVesselMode = 'chase_pod' | 'telescope_first_person';

export const CODATA_FINE_STRUCTURE_INVERSE = 137.036;
export const FINE_STRUCTURE_MIN_INVERSE = 60.0;
export const FINE_STRUCTURE_MAX_INVERSE = 220.0;

export const FIRST_RUN_SETUP_STORAGE_KEY = 'capy_game_onboarding_v1';

export interface FineStructurePhysicsInfo {
  inverseAlpha: number;
  alpha: number;
  ratioToCodata: number;
  bohrRadiusScale: number;
  electronSpeedC: number;
  regimeLabel: string;
  regimeTone: 'amber' | 'emerald' | 'cyan';
  summary: string;
}

export function computeFineStructurePhysics(rawInverseAlpha: number): FineStructurePhysicsInfo {
  const inverseAlpha = Math.max(
    FINE_STRUCTURE_MIN_INVERSE,
    Math.min(FINE_STRUCTURE_MAX_INVERSE, Number.isFinite(rawInverseAlpha) ? rawInverseAlpha : CODATA_FINE_STRUCTURE_INVERSE)
  );
  const alpha = 1.0 / inverseAlpha;
  const ratioToCodata = CODATA_FINE_STRUCTURE_INVERSE / inverseAlpha;
  const bohrRadiusScale = inverseAlpha / CODATA_FINE_STRUCTURE_INVERSE;

  let regimeLabel = 'Anthropic Carbon Window';
  let regimeTone: 'amber' | 'emerald' | 'cyan' = 'emerald';
  let summary =
    'Hoyle 7.65 MeV C-12 resonance & EM-to-strong balance support long-lived stars and stable planetary chemistry.';

  if (inverseAlpha < 120) {
    regimeLabel = 'Hyper-Bound EM';
    regimeTone = 'amber';
    summary =
      'Strong electrostatic repulsion suppresses Carbon-12 fusion and tightly compresses atomic Bohr orbitals.';
  } else if (inverseAlpha > 152) {
    regimeLabel = 'Diffuse Weak-EM';
    regimeTone = 'cyan';
    summary =
      'Weak photon-electron coupling inflates Bohr shells outward and lowers molecular & stellar binding energy.';
  }

  return {
    inverseAlpha,
    alpha,
    ratioToCodata,
    bohrRadiusScale,
    electronSpeedC: alpha,
    regimeLabel,
    regimeTone,
    summary,
  };
}

export function hasCompletedFirstRunSetup(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(FIRST_RUN_SETUP_STORAGE_KEY) === '1';
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

export function markFirstRunSetupComplete(): void {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(FIRST_RUN_SETUP_STORAGE_KEY, '1');
    }
  } catch {
    // ignore storage errors
  }
}

export function resetFirstRunSetup(): void {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(FIRST_RUN_SETUP_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export interface ProceduralGameConfig {
  meta: {
    configName: string;
    seed: number;
  };
  universe: {
    galaxyCount: number;
    starDensityScale: number;
    gravityConstant: number;
    fluidViscosity: number;
    bigBangSpeed: number;
    defaultLogScaleMeters: number;
    defaultCruiseVelocity: number;
    fineStructureInverse: number;
    starColorMode: StarColorMode;
    planetBiome: {
      oceanColorHex: string;
      landColorHex: string;
      atmosphereColorHex: string;
      cloudDensity: number;
      ringSystemEnabled: boolean;
    };
  };
  world: {
    terrainAmplitude: number;
    treeCount: number;
    rockScatterDensity: number;
    waterWaveSpeed: number;
    waterColorHex: string;
    grassPrimaryHex: string;
    grassAccentHex: string;
    timeOfDayHours: number;
    dayCycleSpeed: number;
    weather: 'auto' | WeatherType;
  };
  player: {
    heroArchetypeId: string;
    activeSkin: string;
    activeHat: string;
    furPrimaryHex: string;
    furSecondaryHex: string;
    moveSpeedMultiplier: number;
    jumpImpulseMultiplier: number;
    gravityScale: number;
    startingSnakeSegments: number;
    mouthCapacityMultiplier: number;
    vesselScale: number;
    vesselCherenkovHex: string;
    vesselBrassHex: string;
    vesselCanopyHex: string;
    startingVesselMode: StartingVesselMode;
  };
  districts: {
    sanctuary: {
      maxGroundFruits: number;
      fruitSpawnRateSec: number;
      buddyCount: number;
      orchardYieldBonus: number;
    };
    spore: {
      planktonCount: number;
      critterCount: number;
      dashCooldownSec: number;
      growthRateMultiplier: number;
    };
    breakout: {
      rows: number;
      cols: number;
      ballBaseSpeed: number;
      paddleWidthMultiplier: number;
      powerupDropChance: number;
    };
    runner: {
      laneSpeed: number;
      startingHerdCount: number;
      maxGateMultiplier: number;
      negativeGatePenaltyScale: number;
    };
    fallguys: {
      rivalCount: number;
      hammerSpeedMultiplier: number;
      seesawStiffness: number;
      crownCoinReward: number;
    };
  };
  economy: {
    coinRewardMultiplier: number;
    dnaRewardMultiplier: number;
    buildingCostMultiplier: number;
    unlockAllSectors: boolean;
    unlockAllInstruments: boolean;
  };
  graphics: {
    exposure: number;
    bloomIntensity: number;
    fogDensity: number;
    astrophysicsPalette: AstrophysicsPaletteMode;
  };
}

export interface ProceduralPresetEntry {
  id: string;
  label: string;
  subtitle: string;
  config: ProceduralGameConfig;
}

export const PROCEDURAL_CONFIG_STORAGE_KEY = 'capy_game_procedural_config_v1';

export const DEFAULT_PROCEDURAL_GAME_CONFIG: ProceduralGameConfig = {
  meta: {
    configName: 'Chrono-Sanctuary Standard',
    seed: 202608,
  },
  universe: {
    galaxyCount: 6,
    starDensityScale: 1.0,
    gravityConstant: 1.0,
    fluidViscosity: 1.0,
    bigBangSpeed: 1.0,
    defaultLogScaleMeters: 0.8,
    defaultCruiseVelocity: 0.0,
    fineStructureInverse: CODATA_FINE_STRUCTURE_INVERSE,
    starColorMode: 'hr_blackbody',
    planetBiome: {
      oceanColorHex: '#0284c7',
      landColorHex: '#4ade80',
      atmosphereColorHex: '#38bdf8',
      cloudDensity: 1.0,
      ringSystemEnabled: false,
    },
  },
  world: {
    terrainAmplitude: 1.0,
    treeCount: 14,
    rockScatterDensity: 1.0,
    waterWaveSpeed: 1.0,
    waterColorHex: '#06b6d4',
    grassPrimaryHex: '#4d9b3b',
    grassAccentHex: '#7cc444',
    timeOfDayHours: 9.5,
    dayCycleSpeed: 1.0,
    weather: 'auto',
  },
  player: {
    heroArchetypeId: 'captain_yuzu',
    activeSkin: 'classic',
    activeHat: 'yuzu',
    furPrimaryHex: '#b47442',
    furSecondaryHex: '#6d3f1d',
    moveSpeedMultiplier: 1.0,
    jumpImpulseMultiplier: 1.0,
    gravityScale: 1.0,
    startingSnakeSegments: 5,
    mouthCapacityMultiplier: 1.0,
    vesselScale: 1.0,
    vesselCherenkovHex: '#06b6d4',
    vesselBrassHex: '#eab308',
    vesselCanopyHex: '#38bdf8',
    startingVesselMode: 'chase_pod',
  },
  districts: {
    sanctuary: {
      maxGroundFruits: 16,
      fruitSpawnRateSec: 3.4,
      buddyCount: 4,
      orchardYieldBonus: 1.0,
    },
    spore: {
      planktonCount: 38,
      critterCount: 16,
      dashCooldownSec: 1.2,
      growthRateMultiplier: 1.0,
    },
    breakout: {
      rows: 5,
      cols: 7,
      ballBaseSpeed: 10.5,
      paddleWidthMultiplier: 1.0,
      powerupDropChance: 0.28,
    },
    runner: {
      laneSpeed: 11.5,
      startingHerdCount: 6,
      maxGateMultiplier: 3,
      negativeGatePenaltyScale: 1.0,
    },
    fallguys: {
      rivalCount: 5,
      hammerSpeedMultiplier: 1.0,
      seesawStiffness: 1.0,
      crownCoinReward: 18,
    },
  },
  economy: {
    coinRewardMultiplier: 1.0,
    dnaRewardMultiplier: 1.0,
    buildingCostMultiplier: 1.0,
    unlockAllSectors: false,
    unlockAllInstruments: false,
  },
  graphics: {
    exposure: 1.12,
    bloomIntensity: 0.36,
    fogDensity: 1.0,
    astrophysicsPalette: 'natural',
  },
};

export const PROCEDURAL_CONFIG_PRESETS: ProceduralPresetEntry[] = [
  {
    id: 'default_chrono',
    label: 'Chrono-Sanctuary Standard',
    subtitle: 'Balanced 1:1 astrophysics, sunlit island terrain & standard district rules',
    config: DEFAULT_PROCEDURAL_GAME_CONFIG,
  },
  {
    id: 'low_g_moon',
    label: 'Low-G Lunar Citrus',
    subtitle: '0.42x gravity, high-altitude jumps, obsidian sky & crystalline cyan lagoons',
    config: {
      ...DEFAULT_PROCEDURAL_GAME_CONFIG,
      meta: { configName: 'Low-G Lunar Citrus', seed: 196907 },
      universe: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.universe,
        gravityConstant: 0.45,
        starDensityScale: 1.4,
        planetBiome: {
          oceanColorHex: '#0e7490',
          landColorHex: '#94a3b8',
          atmosphereColorHex: '#22d3ee',
          cloudDensity: 0.35,
          ringSystemEnabled: true,
        },
      },
      world: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.world,
        terrainAmplitude: 1.35,
        treeCount: 10,
        rockScatterDensity: 1.85,
        waterWaveSpeed: 0.65,
        waterColorHex: '#22d3ee',
        grassPrimaryHex: '#64748b',
        grassAccentHex: '#38bdf8',
        timeOfDayHours: 21.5,
        dayCycleSpeed: 0.35,
        weather: 'clear',
      },
      player: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.player,
        heroArchetypeId: 'monarch_rex',
        activeSkin: 'cosmic',
        activeHat: 'crown',
        furPrimaryHex: '#cbd5e1',
        furSecondaryHex: '#475569',
        moveSpeedMultiplier: 1.15,
        jumpImpulseMultiplier: 1.45,
        gravityScale: 0.42,
        vesselCherenkovHex: '#38bdf8',
      },
    },
  },
  {
    id: 'supernova_turbo',
    label: 'Supernova Turbo Chaos',
    subtitle: 'High-velocity Chrono-Vessel, rapid Stampede lanes & energized arcade physics',
    config: {
      ...DEFAULT_PROCEDURAL_GAME_CONFIG,
      meta: { configName: 'Supernova Turbo Chaos', seed: 999901 },
      universe: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.universe,
        galaxyCount: 10,
        starDensityScale: 1.8,
        bigBangSpeed: 2.4,
        starColorMode: 'mass_spectrum',
        planetBiome: {
          oceanColorHex: '#c2410c',
          landColorHex: '#f59e0b',
          atmosphereColorHex: '#fb7185',
          cloudDensity: 1.25,
          ringSystemEnabled: true,
        },
      },
      world: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.world,
        treeCount: 18,
        waterWaveSpeed: 1.8,
        waterColorHex: '#f97316',
        grassPrimaryHex: '#b45309',
        grassAccentHex: '#facc15',
        timeOfDayHours: 17.4,
        dayCycleSpeed: 2.2,
        weather: 'clear',
      },
      player: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.player,
        heroArchetypeId: 'monarch_rex',
        activeSkin: 'golden',
        activeHat: 'crown',
        moveSpeedMultiplier: 1.65,
        jumpImpulseMultiplier: 1.25,
        startingSnakeSegments: 8,
        mouthCapacityMultiplier: 1.5,
        vesselCherenkovHex: '#f59e0b',
      },
      districts: {
        sanctuary: {
          maxGroundFruits: 24,
          fruitSpawnRateSec: 1.8,
          buddyCount: 8,
          orchardYieldBonus: 1.8,
        },
        spore: {
          planktonCount: 54,
          critterCount: 22,
          dashCooldownSec: 0.55,
          growthRateMultiplier: 1.6,
        },
        breakout: {
          rows: 6,
          cols: 7,
          ballBaseSpeed: 15.0,
          paddleWidthMultiplier: 1.3,
          powerupDropChance: 0.45,
        },
        runner: {
          laneSpeed: 18.5,
          startingHerdCount: 10,
          maxGateMultiplier: 5,
          negativeGatePenaltyScale: 0.8,
        },
        fallguys: {
          rivalCount: 5,
          hammerSpeedMultiplier: 1.7,
          seesawStiffness: 0.75,
          crownCoinReward: 32,
        },
      },
      economy: {
        coinRewardMultiplier: 2.0,
        dnaRewardMultiplier: 2.0,
        buildingCostMultiplier: 0.75,
        unlockAllSectors: false,
        unlockAllInstruments: false,
      },
      graphics: {
        exposure: 1.24,
        bloomIntensity: 0.58,
        fogDensity: 0.85,
        astrophysicsPalette: 'hubble',
      },
    },
  },
  {
    id: 'bioluminescent_night',
    label: 'Bioluminescent Midnight Atoll',
    subtitle: 'Eternal moonlit lagoon, glowing cyan tides, mist & Hubble false-color skies',
    config: {
      ...DEFAULT_PROCEDURAL_GAME_CONFIG,
      meta: { configName: 'Bioluminescent Midnight Atoll', seed: 424242 },
      universe: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.universe,
        starDensityScale: 1.5,
        starColorMode: 'age_gradient',
        planetBiome: {
          oceanColorHex: '#0f172a',
          landColorHex: '#065f46',
          atmosphereColorHex: '#2dd4bf',
          cloudDensity: 1.35,
          ringSystemEnabled: true,
        },
      },
      world: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.world,
        treeCount: 20,
        rockScatterDensity: 1.4,
        waterWaveSpeed: 1.25,
        waterColorHex: '#14b8a6',
        grassPrimaryHex: '#064e3b',
        grassAccentHex: '#10b981',
        timeOfDayHours: 23.0,
        dayCycleSpeed: 0.0,
        weather: 'mist',
      },
      player: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.player,
        heroArchetypeId: 'dr_spore',
        activeSkin: 'matcha',
        activeHat: 'wizard',
        furPrimaryHex: '#64748b',
        furSecondaryHex: '#1e293b',
        vesselCherenkovHex: '#2dd4bf',
      },
      graphics: {
        exposure: 1.2,
        bloomIntensity: 0.65,
        fogDensity: 1.35,
        astrophysicsPalette: 'hubble',
      },
    },
  },
  {
    id: 'sandbox_unlimited',
    label: 'Creative Sandbox Architect',
    subtitle: 'All sectors & cosmic instruments unlocked, free Sanctuary building, 5x rewards',
    config: {
      ...DEFAULT_PROCEDURAL_GAME_CONFIG,
      meta: { configName: 'Creative Sandbox Architect', seed: 777777 },
      world: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.world,
        treeCount: 22,
        rockScatterDensity: 1.1,
      },
      player: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.player,
        heroArchetypeId: 'nebula_zen',
        activeSkin: 'cosmic',
        activeHat: 'halo',
        moveSpeedMultiplier: 1.25,
        startingSnakeSegments: 9,
        mouthCapacityMultiplier: 1.75,
      },
      districts: {
        ...DEFAULT_PROCEDURAL_GAME_CONFIG.districts,
        sanctuary: {
          maxGroundFruits: 28,
          fruitSpawnRateSec: 1.5,
          buddyCount: 10,
          orchardYieldBonus: 2.0,
        },
      },
      economy: {
        coinRewardMultiplier: 5.0,
        dnaRewardMultiplier: 5.0,
        buildingCostMultiplier: 0.0,
        unlockAllSectors: true,
        unlockAllInstruments: true,
      },
    },
  },
];

/**
 * Deterministic 32-bit PRNG (Mulberry32) so any JSON seed reproducibly generates
 * galaxies, Sanctuary foliage, rocks, fruit drops, bricks, and math gates.
 */
export function mulberry32(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cloneProceduralConfig(cfg: ProceduralGameConfig): ProceduralGameConfig {
  return JSON.parse(JSON.stringify(cfg)) as ProceduralGameConfig;
}

export function parseHexColorString(value: unknown, fallbackHex: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(0xffffff, Math.floor(value)));
  }
  if (typeof value !== 'string') return fallbackHex;
  const trimmed = value.trim();
  const normalized = trimmed.startsWith('#')
    ? trimmed.slice(1)
    : trimmed.startsWith('0x') || trimmed.startsWith('0X')
      ? trimmed.slice(2)
      : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return fallbackHex;
  }
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : fallbackHex;
}

function normalizeHexString(value: unknown, fallback: string, label: string, warnings: string[]): string {
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(cleaned)) {
      return cleaned;
    }
    if (/^[0-9a-f]{6}$/.test(cleaned)) {
      return `#${cleaned}`;
    }
  }
  if (value !== undefined) {
    warnings.push(`${label} was invalid hex color; reverted to ${fallback}`);
  }
  return fallback;
}

function clampNum(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  label: string,
  warnings: string[],
  roundInt = false
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    if (value !== undefined) {
      warnings.push(`${label} must be a finite number; reverted to ${fallback}`);
    }
    return fallback;
  }
  const clamped = Math.max(min, Math.min(max, value));
  if (clamped !== value) {
    warnings.push(`${label} clamped to [${min}, ${max}] -> ${clamped}`);
  }
  return roundInt ? Math.round(clamped) : clamped;
}

const VALID_WEATHERS = new Set(['auto', 'clear', 'rain', 'storm', 'mist', 'snow']);
const VALID_STAR_MODES = new Set(['hr_blackbody', 'mass_spectrum', 'age_gradient']);
const VALID_PALETTES = new Set(['natural', 'hubble']);
const VALID_SKINS = new Set(['classic', 'golden', 'sakura', 'matcha', 'cosmic']);
const VALID_HATS = new Set(['yuzu', 'crown', 'flower', 'wizard', 'halo', 'party']);
const VALID_VESSEL_MODES = new Set<StartingVesselMode>(['chase_pod', 'telescope_first_person']);

export type ProceduralConfigParseResult =
  | { ok: true; config: ProceduralGameConfig; warnings: string[] }
  | { ok: false; error: string };

export function parseAndValidateProceduralConfig(rawJson: string): ProceduralConfigParseResult {
  if (typeof rawJson !== 'string' || rawJson.trim().length === 0) {
    return { ok: false, error: 'JSON input is empty.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `Syntax error: ${err.message}` : 'Invalid JSON syntax.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Root configuration must be a JSON object.' };
  }

  const root = parsed as Record<string, unknown>;
  const def = DEFAULT_PROCEDURAL_GAME_CONFIG;
  const warnings: string[] = [];

  const metaObj = (typeof root.meta === 'object' && root.meta !== null ? root.meta : {}) as Record<
    string,
    unknown
  >;
  const uniObj = (
    typeof root.universe === 'object' && root.universe !== null ? root.universe : {}
  ) as Record<string, unknown>;
  const biomeObj = (
    typeof uniObj.planetBiome === 'object' && uniObj.planetBiome !== null ? uniObj.planetBiome : {}
  ) as Record<string, unknown>;
  const worldObj = (
    typeof root.world === 'object' && root.world !== null ? root.world : {}
  ) as Record<string, unknown>;
  const playerObj = (
    typeof root.player === 'object' && root.player !== null ? root.player : {}
  ) as Record<string, unknown>;
  const distObj = (
    typeof root.districts === 'object' && root.districts !== null ? root.districts : {}
  ) as Record<string, unknown>;
  const sancObj = (
    typeof distObj.sanctuary === 'object' && distObj.sanctuary !== null ? distObj.sanctuary : {}
  ) as Record<string, unknown>;
  const sporeObj = (
    typeof distObj.spore === 'object' && distObj.spore !== null ? distObj.spore : {}
  ) as Record<string, unknown>;
  const brkObj = (
    typeof distObj.breakout === 'object' && distObj.breakout !== null ? distObj.breakout : {}
  ) as Record<string, unknown>;
  const runObj = (
    typeof distObj.runner === 'object' && distObj.runner !== null ? distObj.runner : {}
  ) as Record<string, unknown>;
  const fgObj = (
    typeof distObj.fallguys === 'object' && distObj.fallguys !== null ? distObj.fallguys : {}
  ) as Record<string, unknown>;
  const econObj = (
    typeof root.economy === 'object' && root.economy !== null ? root.economy : {}
  ) as Record<string, unknown>;
  const gfxObj = (
    typeof root.graphics === 'object' && root.graphics !== null ? root.graphics : {}
  ) as Record<string, unknown>;

  const rawWeather = typeof worldObj.weather === 'string' ? worldObj.weather : def.world.weather;
  const weather = VALID_WEATHERS.has(rawWeather)
    ? (rawWeather as 'auto' | WeatherType)
    : def.world.weather;
  if (!VALID_WEATHERS.has(rawWeather)) {
    warnings.push(`world.weather "${rawWeather}" unsupported; reverted to ${def.world.weather}`);
  }

  const rawStarMode =
    typeof uniObj.starColorMode === 'string' ? uniObj.starColorMode : def.universe.starColorMode;
  const starColorMode = VALID_STAR_MODES.has(rawStarMode)
    ? (rawStarMode as StarColorMode)
    : def.universe.starColorMode;

  const rawPalette =
    typeof gfxObj.astrophysicsPalette === 'string'
      ? gfxObj.astrophysicsPalette
      : def.graphics.astrophysicsPalette;
  const astrophysicsPalette = VALID_PALETTES.has(rawPalette)
    ? (rawPalette as AstrophysicsPaletteMode)
    : def.graphics.astrophysicsPalette;

  const validated: ProceduralGameConfig = {
    meta: {
      configName:
        typeof metaObj.configName === 'string' && metaObj.configName.trim().length > 0
          ? metaObj.configName.trim().slice(0, 64)
          : def.meta.configName,
      seed: clampNum(metaObj.seed, 1, 999_999_999, def.meta.seed, 'meta.seed', warnings, true),
    },
    universe: {
      galaxyCount: clampNum(
        uniObj.galaxyCount,
        1,
        12,
        def.universe.galaxyCount,
        'universe.galaxyCount',
        warnings,
        true
      ),
      starDensityScale: clampNum(
        uniObj.starDensityScale,
        0.25,
        2.5,
        def.universe.starDensityScale,
        'universe.starDensityScale',
        warnings
      ),
      gravityConstant: clampNum(
        uniObj.gravityConstant,
        0.2,
        3.0,
        def.universe.gravityConstant,
        'universe.gravityConstant',
        warnings
      ),
      fluidViscosity: clampNum(
        uniObj.fluidViscosity,
        0.1,
        3.0,
        def.universe.fluidViscosity,
        'universe.fluidViscosity',
        warnings
      ),
      bigBangSpeed: clampNum(
        uniObj.bigBangSpeed,
        0.2,
        4.0,
        def.universe.bigBangSpeed,
        'universe.bigBangSpeed',
        warnings
      ),
      defaultLogScaleMeters: clampNum(
        uniObj.defaultLogScaleMeters,
        -35.0,
        28.0,
        def.universe.defaultLogScaleMeters,
        'universe.defaultLogScaleMeters',
        warnings
      ),
      defaultCruiseVelocity: clampNum(
        uniObj.defaultCruiseVelocity,
        -6.0,
        6.0,
        def.universe.defaultCruiseVelocity,
        'universe.defaultCruiseVelocity',
        warnings
      ),
      fineStructureInverse: clampNum(
        uniObj.fineStructureInverse,
        FINE_STRUCTURE_MIN_INVERSE,
        FINE_STRUCTURE_MAX_INVERSE,
        def.universe.fineStructureInverse,
        'universe.fineStructureInverse',
        warnings
      ),
      starColorMode,
      planetBiome: {
        oceanColorHex: normalizeHexString(
          biomeObj.oceanColorHex,
          def.universe.planetBiome.oceanColorHex,
          'universe.planetBiome.oceanColorHex',
          warnings
        ),
        landColorHex: normalizeHexString(
          biomeObj.landColorHex,
          def.universe.planetBiome.landColorHex,
          'universe.planetBiome.landColorHex',
          warnings
        ),
        atmosphereColorHex: normalizeHexString(
          biomeObj.atmosphereColorHex,
          def.universe.planetBiome.atmosphereColorHex,
          'universe.planetBiome.atmosphereColorHex',
          warnings
        ),
        cloudDensity: clampNum(
          biomeObj.cloudDensity,
          0.0,
          2.5,
          def.universe.planetBiome.cloudDensity,
          'universe.planetBiome.cloudDensity',
          warnings
        ),
        ringSystemEnabled:
          typeof biomeObj.ringSystemEnabled === 'boolean'
            ? biomeObj.ringSystemEnabled
            : def.universe.planetBiome.ringSystemEnabled,
      },
    },
    world: {
      terrainAmplitude: clampNum(
        worldObj.terrainAmplitude,
        0.2,
        2.5,
        def.world.terrainAmplitude,
        'world.terrainAmplitude',
        warnings
      ),
      treeCount: clampNum(
        worldObj.treeCount,
        4,
        36,
        def.world.treeCount,
        'world.treeCount',
        warnings,
        true
      ),
      rockScatterDensity: clampNum(
        worldObj.rockScatterDensity,
        0.0,
        2.5,
        def.world.rockScatterDensity,
        'world.rockScatterDensity',
        warnings
      ),
      waterWaveSpeed: clampNum(
        worldObj.waterWaveSpeed,
        0.2,
        3.0,
        def.world.waterWaveSpeed,
        'world.waterWaveSpeed',
        warnings
      ),
      waterColorHex: normalizeHexString(
        worldObj.waterColorHex,
        def.world.waterColorHex,
        'world.waterColorHex',
        warnings
      ),
      grassPrimaryHex: normalizeHexString(
        worldObj.grassPrimaryHex,
        def.world.grassPrimaryHex,
        'world.grassPrimaryHex',
        warnings
      ),
      grassAccentHex: normalizeHexString(
        worldObj.grassAccentHex,
        def.world.grassAccentHex,
        'world.grassAccentHex',
        warnings
      ),
      timeOfDayHours: clampNum(
        worldObj.timeOfDayHours,
        0.0,
        24.0,
        def.world.timeOfDayHours,
        'world.timeOfDayHours',
        warnings
      ),
      dayCycleSpeed: clampNum(
        worldObj.dayCycleSpeed,
        0.0,
        5.0,
        def.world.dayCycleSpeed,
        'world.dayCycleSpeed',
        warnings
      ),
      weather,
    },
    player: {
      heroArchetypeId:
        typeof playerObj.heroArchetypeId === 'string' && playerObj.heroArchetypeId.trim().length > 0
          ? playerObj.heroArchetypeId.trim().slice(0, 40)
          : def.player.heroArchetypeId,
      activeSkin:
        typeof playerObj.activeSkin === 'string' && VALID_SKINS.has(playerObj.activeSkin)
          ? playerObj.activeSkin
          : def.player.activeSkin,
      activeHat:
        typeof playerObj.activeHat === 'string' && VALID_HATS.has(playerObj.activeHat)
          ? playerObj.activeHat
          : def.player.activeHat,
      furPrimaryHex: normalizeHexString(
        playerObj.furPrimaryHex,
        def.player.furPrimaryHex,
        'player.furPrimaryHex',
        warnings
      ),
      furSecondaryHex: normalizeHexString(
        playerObj.furSecondaryHex,
        def.player.furSecondaryHex,
        'player.furSecondaryHex',
        warnings
      ),
      moveSpeedMultiplier: clampNum(
        playerObj.moveSpeedMultiplier,
        0.3,
        3.0,
        def.player.moveSpeedMultiplier,
        'player.moveSpeedMultiplier',
        warnings
      ),
      jumpImpulseMultiplier: clampNum(
        playerObj.jumpImpulseMultiplier,
        0.4,
        2.5,
        def.player.jumpImpulseMultiplier,
        'player.jumpImpulseMultiplier',
        warnings
      ),
      gravityScale: clampNum(
        playerObj.gravityScale,
        0.2,
        3.0,
        def.player.gravityScale,
        'player.gravityScale',
        warnings
      ),
      startingSnakeSegments: clampNum(
        playerObj.startingSnakeSegments,
        3,
        24,
        def.player.startingSnakeSegments,
        'player.startingSnakeSegments',
        warnings,
        true
      ),
      mouthCapacityMultiplier: clampNum(
        playerObj.mouthCapacityMultiplier,
        0.5,
        3.0,
        def.player.mouthCapacityMultiplier,
        'player.mouthCapacityMultiplier',
        warnings
      ),
      vesselScale: clampNum(
        playerObj.vesselScale,
        0.5,
        2.0,
        def.player.vesselScale,
        'player.vesselScale',
        warnings
      ),
      vesselCherenkovHex: normalizeHexString(
        playerObj.vesselCherenkovHex,
        def.player.vesselCherenkovHex,
        'player.vesselCherenkovHex',
        warnings
      ),
      vesselBrassHex: normalizeHexString(
        playerObj.vesselBrassHex,
        def.player.vesselBrassHex,
        'player.vesselBrassHex',
        warnings
      ),
      vesselCanopyHex: normalizeHexString(
        playerObj.vesselCanopyHex,
        def.player.vesselCanopyHex,
        'player.vesselCanopyHex',
        warnings
      ),
      startingVesselMode:
        typeof playerObj.startingVesselMode === 'string' &&
        VALID_VESSEL_MODES.has(playerObj.startingVesselMode as StartingVesselMode)
          ? (playerObj.startingVesselMode as StartingVesselMode)
          : def.player.startingVesselMode,
    },
    districts: {
      sanctuary: {
        maxGroundFruits: clampNum(
          sancObj.maxGroundFruits,
          4,
          40,
          def.districts.sanctuary.maxGroundFruits,
          'districts.sanctuary.maxGroundFruits',
          warnings,
          true
        ),
        fruitSpawnRateSec: clampNum(
          sancObj.fruitSpawnRateSec,
          0.5,
          12.0,
          def.districts.sanctuary.fruitSpawnRateSec,
          'districts.sanctuary.fruitSpawnRateSec',
          warnings
        ),
        buddyCount: clampNum(
          sancObj.buddyCount,
          0,
          12,
          def.districts.sanctuary.buddyCount,
          'districts.sanctuary.buddyCount',
          warnings,
          true
        ),
        orchardYieldBonus: clampNum(
          sancObj.orchardYieldBonus,
          0.25,
          4.0,
          def.districts.sanctuary.orchardYieldBonus,
          'districts.sanctuary.orchardYieldBonus',
          warnings
        ),
      },
      spore: {
        planktonCount: clampNum(
          sporeObj.planktonCount,
          8,
          72,
          def.districts.spore.planktonCount,
          'districts.spore.planktonCount',
          warnings,
          true
        ),
        critterCount: clampNum(
          sporeObj.critterCount,
          4,
          32,
          def.districts.spore.critterCount,
          'districts.spore.critterCount',
          warnings,
          true
        ),
        dashCooldownSec: clampNum(
          sporeObj.dashCooldownSec,
          0.2,
          4.0,
          def.districts.spore.dashCooldownSec,
          'districts.spore.dashCooldownSec',
          warnings
        ),
        growthRateMultiplier: clampNum(
          sporeObj.growthRateMultiplier,
          0.25,
          4.0,
          def.districts.spore.growthRateMultiplier,
          'districts.spore.growthRateMultiplier',
          warnings
        ),
      },
      breakout: {
        rows: clampNum(
          brkObj.rows,
          2,
          7,
          def.districts.breakout.rows,
          'districts.breakout.rows',
          warnings,
          true
        ),
        cols: clampNum(
          brkObj.cols,
          3,
          7,
          def.districts.breakout.cols,
          'districts.breakout.cols',
          warnings,
          true
        ),
        ballBaseSpeed: clampNum(
          brkObj.ballBaseSpeed,
          4.0,
          24.0,
          def.districts.breakout.ballBaseSpeed,
          'districts.breakout.ballBaseSpeed',
          warnings
        ),
        paddleWidthMultiplier: clampNum(
          brkObj.paddleWidthMultiplier,
          0.5,
          2.5,
          def.districts.breakout.paddleWidthMultiplier,
          'districts.breakout.paddleWidthMultiplier',
          warnings
        ),
        powerupDropChance: clampNum(
          brkObj.powerupDropChance,
          0.0,
          1.0,
          def.districts.breakout.powerupDropChance,
          'districts.breakout.powerupDropChance',
          warnings
        ),
      },
      runner: {
        laneSpeed: clampNum(
          runObj.laneSpeed,
          4.0,
          26.0,
          def.districts.runner.laneSpeed,
          'districts.runner.laneSpeed',
          warnings
        ),
        startingHerdCount: clampNum(
          runObj.startingHerdCount,
          1,
          20,
          def.districts.runner.startingHerdCount,
          'districts.runner.startingHerdCount',
          warnings,
          true
        ),
        maxGateMultiplier: clampNum(
          runObj.maxGateMultiplier,
          2,
          8,
          def.districts.runner.maxGateMultiplier,
          'districts.runner.maxGateMultiplier',
          warnings,
          true
        ),
        negativeGatePenaltyScale: clampNum(
          runObj.negativeGatePenaltyScale,
          0.0,
          2.0,
          def.districts.runner.negativeGatePenaltyScale,
          'districts.runner.negativeGatePenaltyScale',
          warnings
        ),
      },
      fallguys: {
        rivalCount: clampNum(
          fgObj.rivalCount,
          0,
          5,
          def.districts.fallguys.rivalCount,
          'districts.fallguys.rivalCount',
          warnings,
          true
        ),
        hammerSpeedMultiplier: clampNum(
          fgObj.hammerSpeedMultiplier,
          0.2,
          3.0,
          def.districts.fallguys.hammerSpeedMultiplier,
          'districts.fallguys.hammerSpeedMultiplier',
          warnings
        ),
        seesawStiffness: clampNum(
          fgObj.seesawStiffness,
          0.25,
          3.0,
          def.districts.fallguys.seesawStiffness,
          'districts.fallguys.seesawStiffness',
          warnings
        ),
        crownCoinReward: clampNum(
          fgObj.crownCoinReward,
          1,
          200,
          def.districts.fallguys.crownCoinReward,
          'districts.fallguys.crownCoinReward',
          warnings,
          true
        ),
      },
    },
    economy: {
      coinRewardMultiplier: clampNum(
        econObj.coinRewardMultiplier,
        0.2,
        10.0,
        def.economy.coinRewardMultiplier,
        'economy.coinRewardMultiplier',
        warnings
      ),
      dnaRewardMultiplier: clampNum(
        econObj.dnaRewardMultiplier,
        0.2,
        10.0,
        def.economy.dnaRewardMultiplier,
        'economy.dnaRewardMultiplier',
        warnings
      ),
      buildingCostMultiplier: clampNum(
        econObj.buildingCostMultiplier,
        0.0,
        3.0,
        def.economy.buildingCostMultiplier,
        'economy.buildingCostMultiplier',
        warnings
      ),
      unlockAllSectors:
        typeof econObj.unlockAllSectors === 'boolean'
          ? econObj.unlockAllSectors
          : def.economy.unlockAllSectors,
      unlockAllInstruments:
        typeof econObj.unlockAllInstruments === 'boolean'
          ? econObj.unlockAllInstruments
          : def.economy.unlockAllInstruments,
    },
    graphics: {
      exposure: clampNum(
        gfxObj.exposure,
        0.5,
        2.0,
        def.graphics.exposure,
        'graphics.exposure',
        warnings
      ),
      bloomIntensity: clampNum(
        gfxObj.bloomIntensity,
        0.0,
        1.5,
        def.graphics.bloomIntensity,
        'graphics.bloomIntensity',
        warnings
      ),
      fogDensity: clampNum(
        gfxObj.fogDensity,
        0.0,
        2.5,
        def.graphics.fogDensity,
        'graphics.fogDensity',
        warnings
      ),
      astrophysicsPalette,
    },
  };

  return { ok: true, config: validated, warnings };
}

export function loadSavedProceduralConfig(): ProceduralGameConfig {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PROCEDURAL_CONFIG_STORAGE_KEY);
      if (raw) {
        const res = parseAndValidateProceduralConfig(raw);
        if (res.ok) return res.config;
      }
    }
  } catch {
    // fallback cleanly to default config
  }
  return cloneProceduralConfig(DEFAULT_PROCEDURAL_GAME_CONFIG);
}

export function saveProceduralConfig(config: ProceduralGameConfig): void {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(PROCEDURAL_CONFIG_STORAGE_KEY, JSON.stringify(config, null, 2));
    }
  } catch {
    // ignore storage quota errors gracefully
  }
}

export function resetSavedProceduralConfig(): ProceduralGameConfig {
  const fresh = cloneProceduralConfig(DEFAULT_PROCEDURAL_GAME_CONFIG);
  saveProceduralConfig(fresh);
  return fresh;
}
