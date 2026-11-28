/**
 * MIT-licensed Factorio 1.1 / 2.0 / 2.1 Map Exchange String (>>>...<<<) binary codec
 * and Capytorio world-generation configuration presets.
 *
 * Uses Web CompressionStream / DecompressionStream in browsers with a Node zlib fallback
 * for deterministic unit tests. Zero copyrighted game assets or third-party packages.
 */

export type FactorioResourceId =
  | 'iron_ore'
  | 'copper_ore'
  | 'coal'
  | 'stone'
  | 'crude_oil'
  | 'uranium_ore';

export const FACTORIO_RESOURCE_IDS: readonly FactorioResourceId[] = [
  'iron_ore',
  'copper_ore',
  'coal',
  'stone',
  'crude_oil',
  'uranium_ore',
] as const;

export const FACTORIO_CONTROL_TO_RESOURCE: Readonly<Record<string, FactorioResourceId>> = {
  'iron-ore': 'iron_ore',
  'copper-ore': 'copper_ore',
  coal: 'coal',
  stone: 'stone',
  'crude-oil': 'crude_oil',
  'uranium-ore': 'uranium_ore',
};

export const RESOURCE_TO_FACTORIO_CONTROL: Readonly<Record<FactorioResourceId, string>> = {
  iron_ore: 'iron-ore',
  copper_ore: 'copper-ore',
  coal: 'coal',
  stone: 'stone',
  crude_oil: 'crude-oil',
  uranium_ore: 'uranium-ore',
};

export interface FactorioAutoplaceControl {
  /** Patch frequency multiplier (0.1667..6, default 1.0) */
  frequency: number;
  /** Patch size multiplier (0..6, 0 disables resource, default 1.0) */
  size: number;
  /** Patch richness / yield multiplier (0.1667..6, default 1.0) */
  richness: number;
}

export type CapytorioMapPresetId =
  | 'default'
  | 'rich_resources'
  | 'rail_world'
  | 'island'
  | 'desert_frontier';

export type CapytorioMapType = 'normal' | 'island';

export interface CapytorioMapGenConfig {
  seed: number;
  preset: CapytorioMapPresetId | 'custom';
  mapType: CapytorioMapType;
  /** Water frequency / terrain segmentation (0.1667..6, default 1.0) */
  waterScale: number;
  /** Water coverage / size (0..6, 0 = dry world, default 1.0) */
  waterCoverage: number;
  /** Starting area radius multiplier (0.1667..6, default 1.0) */
  startingArea: number;
  /** Moisture noise scale (0.1667..6, default 1.0) */
  moistureScale: number;
  /** Moisture bias (-0.5..+0.5; negative = arid desert, positive = lush meadow) */
  moistureBias: number;
  /** Biome contrast / terrain aux scale (0.1667..6, default 1.0) */
  auxScale: number;
  /** Biome contrast / aux bias (-0.5..+0.5; positive = red desert / warm mesas) */
  auxBias: number;
  /** Tree grove frequency (0.1667..6, default 1.0) */
  treesFrequency: number;
  /** Tree coverage (0..6, 0 = treeless, default 1.0) */
  treesSize: number;
  /** Full 6-resource Factorio autoplace controls */
  resources: Record<FactorioResourceId, FactorioAutoplaceControl>;
}

export interface FactorioMapExchangeDecodeResult {
  ok: boolean;
  config?: CapytorioMapGenConfig;
  sourceVersion?: string;
  warning?: string;
  error?: string;
}

export interface CapytorioMapPresetMeta {
  id: CapytorioMapPresetId;
  label: string;
  description: string;
}

export const CAPYTORIO_MAP_PRESETS: readonly CapytorioMapPresetMeta[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Balanced Nauvis continents, lakes, meadows, and all 6 Factorio resources.',
  },
  {
    id: 'rich_resources',
    label: 'Rich Resources',
    description: '200% ore richness and larger deposits for fast megabase expansion.',
  },
  {
    id: 'rail_world',
    label: 'Rail World',
    description: 'Spread-out massive high-richness veins built for long-distance logistics.',
  },
  {
    id: 'island',
    label: 'Island',
    description: 'Single large archipelago island surrounded by sweeping deep ocean.',
  },
  {
    id: 'desert_frontier',
    label: 'Desert Frontier',
    description: 'Arid red-desert mesas, scarce water, sparse groves, and abundant oil.',
  },
] as const;

export const DEFAULT_CAPYTORIO_MAP_SEED = 421337;

function clampFinite(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

export function sanitizeSeed(val: unknown, fallback: number = DEFAULT_CAPYTORIO_MAP_SEED): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return (Math.floor(val) >>> 0) || 1;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return (Math.floor(parsed) >>> 0) || 1;
      }
    }
  }
  return fallback >>> 0;
}

function defaultResourceControl(): FactorioAutoplaceControl {
  return { frequency: 1, size: 1, richness: 1 };
}

export function createCapytorioMapPreset(
  preset: CapytorioMapPresetId,
  seed: number = DEFAULT_CAPYTORIO_MAP_SEED
): CapytorioMapGenConfig {
  const cleanSeed = sanitizeSeed(seed);
  const base: CapytorioMapGenConfig = {
    seed: cleanSeed,
    preset,
    mapType: 'normal',
    waterScale: 1.0,
    waterCoverage: 1.0,
    startingArea: 1.0,
    moistureScale: 1.0,
    moistureBias: 0.0,
    auxScale: 1.0,
    auxBias: 0.0,
    treesFrequency: 1.0,
    treesSize: 1.0,
    resources: {
      iron_ore: defaultResourceControl(),
      copper_ore: defaultResourceControl(),
      coal: defaultResourceControl(),
      stone: defaultResourceControl(),
      crude_oil: defaultResourceControl(),
      uranium_ore: defaultResourceControl(),
    },
  };

  if (preset === 'rich_resources') {
    for (const id of FACTORIO_RESOURCE_IDS) {
      base.resources[id] = { frequency: 1.0, size: 1.35, richness: 2.0 };
    }
  } else if (preset === 'rail_world') {
    for (const id of FACTORIO_RESOURCE_IDS) {
      base.resources[id] = { frequency: 0.33, size: 2.25, richness: 1.75 };
    }
    base.waterScale = 0.65;
    base.waterCoverage = 1.1;
  } else if (preset === 'island') {
    base.mapType = 'island';
    base.waterScale = 1.0;
    base.waterCoverage = 1.15;
    base.startingArea = 1.25;
  } else if (preset === 'desert_frontier') {
    base.waterScale = 0.75;
    base.waterCoverage = 0.45;
    base.moistureBias = -0.34;
    base.auxBias = 0.30;
    base.treesFrequency = 0.55;
    base.treesSize = 0.45;
    base.resources.crude_oil = { frequency: 1.5, size: 1.5, richness: 1.75 };
    base.resources.uranium_ore = { frequency: 1.25, size: 1.25, richness: 1.5 };
  }

  return base;
}

export const DEFAULT_CAPYTORIO_MAP_GEN_CONFIG: CapytorioMapGenConfig =
  createCapytorioMapPreset('default', DEFAULT_CAPYTORIO_MAP_SEED);

export function cloneCapytorioMapGenConfig(cfg: CapytorioMapGenConfig): CapytorioMapGenConfig {
  return {
    ...cfg,
    resources: {
      iron_ore: { ...cfg.resources.iron_ore },
      copper_ore: { ...cfg.resources.copper_ore },
      coal: { ...cfg.resources.coal },
      stone: { ...cfg.resources.stone },
      crude_oil: { ...cfg.resources.crude_oil },
      uranium_ore: { ...cfg.resources.uranium_ore },
    },
  };
}

export function sanitizeCapytorioMapGenConfig(raw: unknown): CapytorioMapGenConfig {
  const def = createCapytorioMapPreset('default', DEFAULT_CAPYTORIO_MAP_SEED);
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Partial<CapytorioMapGenConfig>;
  const validPreset =
    r.preset === 'default' ||
    r.preset === 'rich_resources' ||
    r.preset === 'rail_world' ||
    r.preset === 'island' ||
    r.preset === 'desert_frontier' ||
    r.preset === 'custom'
      ? r.preset
      : 'custom';
  const resourcesRaw =
    r.resources && typeof r.resources === 'object'
      ? (r.resources as Partial<Record<FactorioResourceId, Partial<FactorioAutoplaceControl>>>)
      : {};
  const resources = {} as Record<FactorioResourceId, FactorioAutoplaceControl>;
  for (const id of FACTORIO_RESOURCE_IDS) {
    const entry = resourcesRaw[id];
    resources[id] = {
      frequency: clampFinite(entry?.frequency, 0.1667, 6, 1),
      size: clampFinite(entry?.size, 0, 6, 1),
      richness: clampFinite(entry?.richness, 0.1667, 6, 1),
    };
  }
  return {
    seed: sanitizeSeed(r.seed, DEFAULT_CAPYTORIO_MAP_SEED),
    preset: validPreset,
    mapType: r.mapType === 'island' ? 'island' : 'normal',
    waterScale: clampFinite(r.waterScale, 0.1667, 6, 1),
    waterCoverage: clampFinite(r.waterCoverage, 0, 6, 1),
    startingArea: clampFinite(r.startingArea, 0.1667, 6, 1),
    moistureScale: clampFinite(r.moistureScale, 0.1667, 6, 1),
    moistureBias: clampFinite(r.moistureBias, -0.5, 0.5, 0),
    auxScale: clampFinite(r.auxScale, 0.1667, 6, 1),
    auxBias: clampFinite(r.auxBias, -0.5, 0.5, 0),
    treesFrequency: clampFinite(r.treesFrequency, 0.1667, 6, 1),
    treesSize: clampFinite(r.treesSize, 0, 6, 1),
    resources,
  };
}

export function generateRandomCapytorioSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] || 1;
  }
  return ((Math.floor(Math.random() * 0xfffffffe) + 1) >>> 0) || 1;
}

// ---------------------------------------------------------------------------
// Binary Factorio 1.1 / 2.0 / 2.1 Map Exchange String Codec
// ---------------------------------------------------------------------------

type FieldType = 'f64' | 'u32' | 'bool' | 'u8' | 'u32[]' | 'f64[]' | `bare:${'f64' | 'u32' | 'u8'}`;
type FieldSpec = [string, FieldType | FieldSpec[]];

const POLLUTION_SPEC: FieldSpec = [
  'pollution',
  [
    ['enabled', 'bool'],
    ['diffusion_ratio', 'f64'],
    ['min_to_diffuse', 'f64'],
    ['ageing', 'f64'],
    ['expected_max_per_chunk', 'f64'],
    ['min_to_show_per_chunk', 'f64'],
    ['min_pollution_to_damage_trees', 'f64'],
    ['pollution_with_max_forest_damage', 'f64'],
    ['pollution_per_tree_damage', 'f64'],
    ['pollution_restored_per_tree_damage', 'f64'],
    ['max_pollution_to_restore_trees', 'f64'],
    ['enemy_attack_pollution_consumption_modifier', 'f64'],
  ],
];

const STEERING_SPEC: FieldSpec = [
  'steering',
  [
    [
      'default',
      [
        ['radius', 'f64'],
        ['separation_factor', 'f64'],
        ['separation_force', 'f64'],
        ['force_unit_fuzzy_goto_behavior', 'bool'],
      ],
    ],
    [
      'moving',
      [
        ['radius', 'f64'],
        ['separation_factor', 'f64'],
        ['separation_force', 'f64'],
        ['force_unit_fuzzy_goto_behavior', 'bool'],
      ],
    ],
  ],
];

const EVOLUTION_SPEC: FieldSpec = [
  'enemy_evolution',
  [
    ['enabled', 'bool'],
    ['time_factor', 'f64'],
    ['destroy_factor', 'f64'],
    ['pollution_factor', 'f64'],
  ],
];

const EXPANSION_2_0_SPEC: FieldSpec = [
  'enemy_expansion',
  [
    ['enabled', 'bool'],
    ['max_expansion_distance', 'u32'],
    ['friendly_base_influence_radius', 'u32'],
    ['enemy_building_influence_radius', 'u32'],
    ['building_coefficient', 'f64'],
    ['other_base_coefficient', 'f64'],
    ['neighbouring_chunk_coefficient', 'f64'],
    ['neighbouring_base_chunk_coefficient', 'f64'],
    ['max_colliding_tiles_coefficient', 'f64'],
    ['settler_group_min_size', 'u32'],
    ['settler_group_max_size', 'u32'],
    ['min_expansion_cooldown', 'u32'],
    ['max_expansion_cooldown', 'u32'],
  ],
];

const EXPANSION_2_1_SPEC: FieldSpec = [
  'enemy_expansion',
  [
    ['enabled', 'bool'],
    ['max_expansion_distance', 'u32'],
    ['min_expansion_distance', 'u32'],
    ['friendly_base_influence_radius', 'u32'],
    ['enemy_building_influence_radius', 'u32'],
    ['building_coefficient', 'f64'],
    ['other_base_coefficient', 'f64'],
    ['neighbouring_chunk_coefficient', 'f64'],
    ['neighbouring_base_chunk_coefficient', 'f64'],
    ['max_colliding_tiles_coefficient', 'f64'],
    ['settler_group_min_size', 'u32'],
    ['settler_group_max_size', 'u32'],
    ['evolution_group_size_factor', 'f64'],
    ['min_expansion_cooldown', 'u32'],
    ['max_expansion_cooldown', 'u32'],
  ],
];

const REST_SPEC: FieldSpec[] = [
  [
    'unit_group',
    [
      ['min_group_gathering_time', 'u32'],
      ['max_group_gathering_time', 'u32'],
      ['max_wait_time_for_late_members', 'u32'],
      ['max_group_radius', 'f64'],
      ['min_group_radius', 'f64'],
      ['max_member_speedup_when_behind', 'f64'],
      ['max_member_slowdown_when_ahead', 'f64'],
      ['max_group_slowdown_factor', 'f64'],
      ['max_group_member_fallback_factor', 'f64'],
      ['member_disown_distance', 'f64'],
      ['tick_tolerance_when_member_arrives', 'u32'],
      ['max_gathering_unit_groups', 'u32'],
      ['max_unit_group_size', 'u32'],
    ],
  ],
  [
    'path_finder',
    [
      ['fwd2bwd_ratio', 'u32'],
      ['goal_pressure_ratio', 'f64'],
      ['use_path_cache', 'bool'],
      ['max_steps_worked_per_tick', 'f64'],
      ['max_work_done_per_tick', 'u32'],
      ['short_cache_size', 'u32'],
      ['long_cache_size', 'u32'],
      ['short_cache_min_cacheable_distance', 'f64'],
      ['short_cache_min_algo_steps_to_cache', 'u32'],
      ['long_cache_min_cacheable_distance', 'f64'],
      ['cache_max_connect_to_cache_steps_multiplier', 'u32'],
      ['cache_accept_path_start_distance_ratio', 'f64'],
      ['cache_accept_path_end_distance_ratio', 'f64'],
      ['negative_cache_accept_path_start_distance_ratio', 'f64'],
      ['negative_cache_accept_path_end_distance_ratio', 'f64'],
      ['cache_path_start_distance_rating_multiplier', 'f64'],
      ['cache_path_end_distance_rating_multiplier', 'f64'],
      ['stale_enemy_with_same_destination_collision_penalty', 'f64'],
      ['ignore_moving_enemy_collision_distance', 'f64'],
      ['enemy_with_different_destination_collision_penalty', 'f64'],
      ['general_entity_collision_penalty', 'f64'],
      ['general_entity_subsequent_collision_penalty', 'f64'],
      ['extended_collision_penalty', 'f64'],
      ['max_clients_to_accept_any_new_request', 'u32'],
      ['max_clients_to_accept_short_new_request', 'u32'],
      ['direct_distance_to_consider_short_request', 'u32'],
      ['short_request_max_steps', 'u32'],
      ['short_request_ratio', 'f64'],
      ['min_steps_to_check_path_find_termination', 'u32'],
      ['start_to_goal_cost_multiplier_to_terminate_path_find', 'f64'],
      ['overload_levels', 'u32[]'],
      ['overload_multipliers', 'f64[]'],
      ['negative_path_cache_delay_interval', 'u32'],
    ],
  ],
  ['max_failed_behavior_count', 'bare:u32'],
  [
    'difficulty_settings',
    [
      ['technology_price_multiplier', 'bare:f64'],
      ['spoil_time_modifier', 'bare:f64'],
    ],
  ],
  [
    'asteroids',
    [
      ['spawning_rate', 'f64'],
      ['max_ray_portals_expanded_per_tick', 'u32'],
    ],
  ],
];

const MAP_SETTINGS_1_1: FieldSpec[] = [
  POLLUTION_SPEC,
  STEERING_SPEC,
  EVOLUTION_SPEC,
  EXPANSION_2_0_SPEC,
  ...REST_SPEC.slice(0, 3),
  [
    'difficulty_settings',
    [
      ['recipe_difficulty', 'bare:u8'],
      ['technology_difficulty', 'bare:u8'],
      ['technology_price_multiplier', 'bare:f64'],
      ['research_queue_setting', 'bare:u8'],
    ],
  ],
];

const MAP_SETTINGS_2_0: FieldSpec[] = [
  POLLUTION_SPEC,
  STEERING_SPEC,
  EVOLUTION_SPEC,
  EXPANSION_2_0_SPEC,
  ...REST_SPEC,
];

const MAP_SETTINGS_2_1: FieldSpec[] = [
  POLLUTION_SPEC,
  EVOLUTION_SPEC,
  EXPANSION_2_1_SPEC,
  ...REST_SPEC,
];

const DEFAULT_MAP_SETTINGS_2_0: Record<string, unknown> = {
  pollution: {
    enabled: true,
    diffusion_ratio: 0.02,
    min_to_diffuse: 15,
    ageing: 1,
    expected_max_per_chunk: 150,
    min_to_show_per_chunk: 50,
    min_pollution_to_damage_trees: 60,
    pollution_with_max_forest_damage: 150,
    pollution_per_tree_damage: 50,
    pollution_restored_per_tree_damage: 10,
    max_pollution_to_restore_trees: 20,
    enemy_attack_pollution_consumption_modifier: 1,
  },
  steering: {
    default: {
      radius: 1.2,
      separation_factor: 1.2,
      separation_force: 0.005,
      force_unit_fuzzy_goto_behavior: false,
    },
    moving: {
      radius: 3,
      separation_factor: 3,
      separation_force: 0.01,
      force_unit_fuzzy_goto_behavior: false,
    },
  },
  enemy_evolution: {
    enabled: true,
    time_factor: 0.000004,
    destroy_factor: 0.002,
    pollution_factor: 0.0000009,
  },
  enemy_expansion: {
    enabled: true,
    max_expansion_distance: 7,
    friendly_base_influence_radius: 2,
    enemy_building_influence_radius: 2,
    building_coefficient: 0.1,
    other_base_coefficient: 2,
    neighbouring_chunk_coefficient: 0.5,
    neighbouring_base_chunk_coefficient: 0.4,
    max_colliding_tiles_coefficient: 0.9,
    settler_group_min_size: 5,
    settler_group_max_size: 20,
    min_expansion_cooldown: 14400,
    max_expansion_cooldown: 216000,
  },
  unit_group: {
    min_group_gathering_time: 3600,
    max_group_gathering_time: 36000,
    max_wait_time_for_late_members: 7200,
    max_group_radius: 30,
    min_group_radius: 5,
    max_member_speedup_when_behind: 1.4,
    max_member_slowdown_when_ahead: 0.6,
    max_group_slowdown_factor: 0.3,
    max_group_member_fallback_factor: 3,
    member_disown_distance: 10,
    tick_tolerance_when_member_arrives: 60,
    max_gathering_unit_groups: 30,
    max_unit_group_size: 200,
  },
  path_finder: {
    fwd2bwd_ratio: 5,
    goal_pressure_ratio: 2,
    use_path_cache: true,
    max_steps_worked_per_tick: 1000,
    max_work_done_per_tick: 8000,
    short_cache_size: 5,
    long_cache_size: 25,
    short_cache_min_cacheable_distance: 10,
    short_cache_min_algo_steps_to_cache: 50,
    long_cache_min_cacheable_distance: 30,
    cache_max_connect_to_cache_steps_multiplier: 100,
    cache_accept_path_start_distance_ratio: 0.2,
    cache_accept_path_end_distance_ratio: 0.15,
    negative_cache_accept_path_start_distance_ratio: 0.3,
    negative_cache_accept_path_end_distance_ratio: 0.3,
    cache_path_start_distance_rating_multiplier: 10,
    cache_path_end_distance_rating_multiplier: 20,
    stale_enemy_with_same_destination_collision_penalty: 30,
    ignore_moving_enemy_collision_distance: 5,
    enemy_with_different_destination_collision_penalty: 30,
    general_entity_collision_penalty: 10,
    general_entity_subsequent_collision_penalty: 3,
    extended_collision_penalty: 3,
    max_clients_to_accept_any_new_request: 10,
    max_clients_to_accept_short_new_request: 100,
    direct_distance_to_consider_short_request: 100,
    short_request_max_steps: 1000,
    short_request_ratio: 0.5,
    min_steps_to_check_path_find_termination: 2000,
    start_to_goal_cost_multiplier_to_terminate_path_find: 2000,
    overload_levels: [0, 100, 500],
    overload_multipliers: [2, 3, 4],
    negative_path_cache_delay_interval: 20,
  },
  max_failed_behavior_count: 3,
  difficulty_settings: {
    technology_price_multiplier: 1,
    spoil_time_modifier: 1,
  },
  asteroids: {
    spawning_rate: 1,
    max_ray_portals_expanded_per_tick: 100,
  },
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

class BinaryReader {
  private readonly b: Uint8Array;
  private readonly v: DataView;
  public p = 0;
  private lastPosX = 0;
  private lastPosY = 0;

  constructor(bytes: Uint8Array) {
    this.b = bytes;
    this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private need(n: number): void {
    if (this.p + n > this.b.length) {
      throw new Error('Map exchange string is truncated.');
    }
  }

  u8(): number {
    this.need(1);
    return this.b[this.p++];
  }

  bool(): boolean {
    const val = this.u8();
    if (val > 1) throw new Error('Invalid map exchange string (bad boolean byte).');
    return val === 1;
  }

  u16(): number {
    this.need(2);
    const val = this.v.getUint16(this.p, true);
    this.p += 2;
    return val;
  }

  i16(): number {
    this.need(2);
    const val = this.v.getInt16(this.p, true);
    this.p += 2;
    return val;
  }

  u32(): number {
    this.need(4);
    const val = this.v.getUint32(this.p, true);
    this.p += 4;
    return val;
  }

  i32(): number {
    this.need(4);
    const val = this.v.getInt32(this.p, true);
    this.p += 4;
    return val;
  }

  f32(): number {
    this.need(4);
    const val = this.v.getFloat32(this.p, true);
    this.p += 4;
    return val;
  }

  f64(): number {
    this.need(8);
    const val = this.v.getFloat64(this.p, true);
    this.p += 8;
    return val;
  }

  count(): number {
    const first = this.u8();
    return first === 255 ? this.u32() : first;
  }

  str(): string {
    const len = this.count();
    this.need(len);
    const out = new TextDecoder().decode(this.b.subarray(this.p, this.p + len));
    this.p += len;
    return out;
  }

  skipBytes(n: number): void {
    this.need(n);
    this.p += n;
  }

  pos(): { x: number; y: number } {
    const dx = this.i16();
    let x: number;
    let y: number;
    if (dx === 0x7fff) {
      x = this.i32();
      y = this.i32();
    } else {
      x = this.lastPosX + dx;
      y = this.lastPosY + this.i16();
    }
    this.lastPosX = x;
    this.lastPosY = y;
    return { x: x / 256, y: y / 256 };
  }
}

class BinaryWriter {
  private buf = new Uint8Array(1024);
  private v = new DataView(this.buf.buffer);
  private p = 0;
  private lastPosX = 0;
  private lastPosY = 0;

  private grow(n: number): void {
    if (this.p + n <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.p + n));
    next.set(this.buf);
    this.buf = next;
    this.v = new DataView(next.buffer);
  }

  u8(val: number): void {
    this.grow(1);
    this.buf[this.p++] = val & 0xff;
  }

  bool(val: boolean): void {
    this.u8(val ? 1 : 0);
  }

  u16(val: number): void {
    this.grow(2);
    this.v.setUint16(this.p, val & 0xffff, true);
    this.p += 2;
  }

  i16(val: number): void {
    this.grow(2);
    this.v.setInt16(this.p, val | 0, true);
    this.p += 2;
  }

  u32(val: number): void {
    this.grow(4);
    this.v.setUint32(this.p, val >>> 0, true);
    this.p += 4;
  }

  i32(val: number): void {
    this.grow(4);
    this.v.setInt32(this.p, val | 0, true);
    this.p += 4;
  }

  f32(val: number): void {
    this.grow(4);
    this.v.setFloat32(this.p, val, true);
    this.p += 4;
  }

  f64(val: number): void {
    this.grow(8);
    this.v.setFloat64(this.p, val, true);
    this.p += 8;
  }

  count(n: number): void {
    if (n < 255) {
      this.u8(n);
    } else {
      this.u8(255);
      this.u32(n);
    }
  }

  str(s: string): void {
    const encoded = new TextEncoder().encode(s);
    this.count(encoded.length);
    this.grow(encoded.length);
    this.buf.set(encoded, this.p);
    this.p += encoded.length;
  }

  bytes(arr: readonly number[]): void {
    for (let i = 0; i < arr.length; i++) this.u8(arr[i]);
  }

  pos(pt: { x: number; y: number }): void {
    const x = Math.round(pt.x * 256);
    const y = Math.round(pt.y * 256);
    const dx = x - this.lastPosX;
    const dy = y - this.lastPosY;
    if (Math.abs(dx) < 0x7fff && Math.abs(dy) < 0x7fff) {
      this.i16(dx);
      this.i16(dy);
    } else {
      this.i16(0x7fff);
      this.i32(x);
      this.i32(y);
    }
    this.lastPosX = x;
    this.lastPosY = y;
  }

  result(): Uint8Array {
    return this.buf.slice(0, this.p);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const cleaned = b64.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length === 0) {
    throw new Error('Map exchange string contains invalid Base64 characters.');
  }
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(cleaned, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(cleaned);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

const MAX_DECOMPRESSED_EXCHANGE_BYTES = 512 * 1024; // 512 KB safety cap

async function runWebCompressionStream(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  maxOutputBytes?: number
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  let writeError: unknown = null;
  const writePromise = writer
    .write(input as unknown as BufferSource)
    .then(() => writer.close())
    .catch((err) => {
      writeError = err;
    });

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        totalLen += value.byteLength;
        if (maxOutputBytes !== undefined && totalLen > maxOutputBytes) {
          await reader.cancel().catch(() => {});
          await writer.abort().catch(() => {});
          await writePromise;
          throw new Error('Map exchange string payload exceeds safe size limit.');
        }
        chunks.push(value);
      }
    }
  } finally {
    await writePromise;
  }
  if (writeError) throw writeError;

  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    out.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return out;
}

async function zlibDeflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    return runWebCompressionStream(bytes, new CompressionStream('deflate'));
  }
  const zlibModName = 'node:' + 'zlib';
  const zlib = (await import(/* @vite-ignore */ zlibModName)) as {
    deflateSync: (buf: Uint8Array) => Uint8Array;
  };
  const out = zlib.deflateSync(bytes);
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

async function zlibInflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    return runWebCompressionStream(
      bytes,
      new DecompressionStream('deflate'),
      MAX_DECOMPRESSED_EXCHANGE_BYTES
    );
  }
  const zlibModName = 'node:' + 'zlib';
  const zlib = (await import(/* @vite-ignore */ zlibModName)) as {
    inflateSync: (buf: Uint8Array, opts?: { maxOutputLength?: number }) => Uint8Array;
  };
  const out = zlib.inflateSync(bytes, { maxOutputLength: MAX_DECOMPRESSED_EXCHANGE_BYTES });
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

function sortedBytewiseKeys(obj: Record<string, unknown>): string[] {
  const enc = new TextEncoder();
  return Object.keys(obj).sort((a, b) => {
    const xa = enc.encode(a);
    const xb = enc.encode(b);
    const len = Math.min(xa.length, xb.length);
    for (let i = 0; i < len; i++) {
      if (xa[i] !== xb[i]) return xa[i] - xb[i];
    }
    return xa.length - xb.length;
  });
}

function skipValue(r: BinaryReader, type: FieldType): void {
  const clean = type.startsWith('bare:') ? (type.slice(5) as FieldType) : type;
  switch (clean) {
    case 'f64':
      r.f64();
      return;
    case 'u32':
      r.u32();
      return;
    case 'bool':
      r.bool();
      return;
    case 'u8':
      r.u8();
      return;
    case 'u32[]':
      for (let n = r.count(); n > 0; n--) r.u32();
      return;
    case 'f64[]':
      for (let n = r.count(); n > 0; n--) r.f64();
      return;
  }
}

function skipFields(r: BinaryReader, specs: FieldSpec[]): void {
  for (let i = 0; i < specs.length; i++) {
    const [, type] = specs[i];
    if (Array.isArray(type)) {
      skipFields(r, type);
    } else if (type.startsWith('bare:')) {
      skipValue(r, type);
    } else if (r.bool()) {
      skipValue(r, type);
    }
  }
}

function writeValue(w: BinaryWriter, type: FieldType, val: unknown): void {
  const clean = type.startsWith('bare:') ? (type.slice(5) as FieldType) : type;
  switch (clean) {
    case 'f64':
      w.f64(Number(val ?? 0));
      return;
    case 'u32':
      w.u32(Number(val ?? 0));
      return;
    case 'bool':
      w.bool(Boolean(val));
      return;
    case 'u8':
      w.u8(Number(val ?? 0));
      return;
    case 'u32[]': {
      const arr = Array.isArray(val) ? val : [];
      w.count(arr.length);
      for (let i = 0; i < arr.length; i++) w.u32(Number(arr[i] ?? 0));
      return;
    }
    case 'f64[]': {
      const arr = Array.isArray(val) ? val : [];
      w.count(arr.length);
      for (let i = 0; i < arr.length; i++) w.f64(Number(arr[i] ?? 0));
      return;
    }
  }
}

function writeFields(
  w: BinaryWriter,
  specs: FieldSpec[],
  obj: Record<string, unknown> | undefined
): void {
  const src = obj ?? {};
  for (let i = 0; i < specs.length; i++) {
    const [name, type] = specs[i];
    if (Array.isArray(type)) {
      writeFields(w, type, src[name] as Record<string, unknown> | undefined);
    } else if (type.startsWith('bare:')) {
      writeValue(w, type, src[name]);
    } else {
      const val = src[name];
      const present = val !== undefined && val !== null;
      w.bool(present);
      if (present) writeValue(w, type, val);
    }
  }
}

function readFreqSizeRich(r: BinaryReader): FactorioAutoplaceControl {
  return {
    frequency: r.f32(),
    size: r.f32(),
    richness: r.f32(),
  };
}

function writeFreqSizeRich(w: BinaryWriter, ctrl: FactorioAutoplaceControl): void {
  w.f32(ctrl.frequency);
  w.f32(ctrl.size);
  w.f32(ctrl.richness);
}

interface ParsedRawFactorioSettings {
  version: [number, number, number, number];
  seed: number;
  startingArea: number;
  autoplaceControls: Record<string, FactorioAutoplaceControl>;
  propertyExpressions: Record<string, string>;
}

function parseBinaryExchangePayload(payload: Uint8Array): ParsedRawFactorioSettings {
  const r = new BinaryReader(payload);
  const version: [number, number, number, number] = [r.u16(), r.u16(), r.u16(), r.u16()];
  r.u8(); // version_extra

  const autoplaceControls: Record<string, FactorioAutoplaceControl> = {};
  const propertyExpressions: Record<string, string> = {};
  let seed = DEFAULT_CAPYTORIO_MAP_SEED;
  let startingArea = 1.0;

  if (version[0] < 2) {
    if (version[0] !== 1 || version[1] !== 1) {
      throw new Error(
        `Unsupported Factorio version ${version.slice(0, 3).join('.')} (use Factorio 1.1, 2.0, or 2.1).`
      );
    }
    const terrainSegmentation = r.f32();
    const waterSize = r.f32();
    for (let n = r.count(); n > 0; n--) {
      const k = r.str();
      const c = readFreqSizeRich(r);
      autoplaceControls[k] =
        c.frequency === 0 ? { frequency: 1, size: 0, richness: c.richness } : c;
    }
    autoplaceControls.water = { frequency: terrainSegmentation, size: waterSize, richness: 1 };
    for (let n = r.count(); n > 0; n--) {
      r.str();
      r.bool();
      for (let c = r.count(); c > 0; c--) {
        r.str();
        readFreqSizeRich(r);
      }
    }
    r.bool(); // default_enable_all_autoplace_controls
    seed = r.u32();
    r.u32(); // width
    r.u32(); // height
    r.pos(); // area left_top
    r.pos(); // area right_bottom
    r.skipBytes(4); // area_extra
    startingArea = r.f32();
    r.bool(); // peaceful_mode
    for (let n = r.count(); n > 0; n--) r.pos(); // starting_points
    for (let n = r.count(); n > 0; n--) {
      const rawKey = r.str();
      const rawVal = r.str();
      const migratedKey =
        rawKey === 'control-setting:moisture:frequency:multiplier'
          ? 'control:moisture:frequency'
          : rawKey === 'control-setting:moisture:bias'
            ? 'control:moisture:bias'
            : rawKey === 'control-setting:aux:frequency:multiplier'
              ? 'control:aux:frequency'
              : rawKey === 'control-setting:aux:bias'
                ? 'control:aux:bias'
                : rawKey;
      const migratedVal =
        rawKey === 'elevation' && rawVal === '0_17-island' ? 'elevation_island' : rawVal;
      propertyExpressions[migratedKey] = migratedVal;
    }
    // cliff_settings (1.1)
    r.str();
    r.f32();
    r.f32();
    r.f32();
    // map_settings (1.1)
    skipFields(r, MAP_SETTINGS_1_1);
  } else {
    for (let n = r.count(); n > 0; n--) {
      const k = r.str();
      autoplaceControls[k] = readFreqSizeRich(r);
    }
    for (let n = r.count(); n > 0; n--) {
      r.str();
      r.bool();
      for (let c = r.count(); c > 0; c--) {
        r.str();
        readFreqSizeRich(r);
      }
    }
    r.bool(); // default_enable_all_autoplace_controls
    seed = r.u32();
    r.u32(); // width
    r.u32(); // height
    r.pos(); // area left_top
    r.pos(); // area right_bottom
    r.skipBytes(4); // area_extra
    startingArea = r.f32();
    r.bool(); // peaceful_mode
    r.bool(); // no_enemies_mode
    for (let n = r.count(); n > 0; n--) r.pos(); // starting_points
    for (let n = r.count(); n > 0; n--) {
      const k = r.str();
      propertyExpressions[k] = r.str();
    }
    // cliff_settings (2.0+)
    r.str();
    r.str();
    r.f32();
    r.f32();
    r.f32();
    r.f32();
    // territory_settings (2.0+)
    const unitCount = r.count();
    if (unitCount > 0) {
      for (let n = unitCount; n > 0; n--) r.str();
      r.str();
      r.str();
      r.u32();
    }
    // map_settings (2.0 vs 2.1+)
    const is21 = version[0] > 2 || (version[0] === 2 && version[1] >= 1);
    skipFields(r, is21 ? MAP_SETTINGS_2_1 : MAP_SETTINGS_2_0);
  }

  return {
    version,
    seed,
    startingArea,
    autoplaceControls,
    propertyExpressions,
  };
}

function parseNumericExpr(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export async function decodeFactorioMapExchangeString(
  rawInput: string
): Promise<FactorioMapExchangeDecodeResult> {
  const trimmed = String(rawInput ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Paste a Factorio map exchange string (>>>...<<<) or numeric seed.' };
  }

  // Convenience: allow pasting a raw numeric seed directly into the exchange box
  if (/^\d{1,10}$/.test(trimmed)) {
    const seed = sanitizeSeed(trimmed);
    return {
      ok: true,
      config: createCapytorioMapPreset('default', seed),
      sourceVersion: 'Numeric Seed',
    };
  }

  const compact = trimmed.replace(/\s+/g, '');
  const startIdx = compact.indexOf('>>>');
  const endIdx = compact.lastIndexOf('<<<');
  if (startIdx < 0 || endIdx <= startIdx + 3) {
    return {
      ok: false,
      error: 'A Factorio map exchange string must start with >>> and end with <<<.',
    };
  }

  const b64Payload = compact.slice(startIdx + 3, endIdx);
  let inflated: Uint8Array;
  try {
    const compressed = base64ToBytes(b64Payload);
    inflated = await zlibInflate(compressed);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? err.message
          : 'Could not decompress Factorio map exchange string.',
    };
  }

  if (inflated.length < 13) {
    return { ok: false, error: 'Map exchange string payload is too short.' };
  }

  const body = inflated.subarray(0, inflated.length - 4);
  const expectedCrc = new DataView(
    inflated.buffer,
    inflated.byteOffset + inflated.length - 4,
    4
  ).getUint32(0, true);
  if (computeCrc32(body) !== expectedCrc) {
    return { ok: false, error: 'Map exchange string CRC32 checksum mismatch.' };
  }

  let parsed: ParsedRawFactorioSettings;
  try {
    parsed = parseBinaryExchangePayload(body);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to parse map exchange binary data.',
    };
  }

  const cfg = createCapytorioMapPreset('default', parsed.seed);
  cfg.preset = 'custom';
  cfg.startingArea = clampFinite(parsed.startingArea, 0.1667, 6, 1.0);

  const waterCtrl = parsed.autoplaceControls.water;
  if (waterCtrl) {
    cfg.waterScale = clampFinite(waterCtrl.frequency, 0.1667, 6, 1.0);
    cfg.waterCoverage = clampFinite(waterCtrl.size, 0, 6, 1.0);
  }

  const treesCtrl = parsed.autoplaceControls.trees;
  if (treesCtrl) {
    cfg.treesFrequency = clampFinite(treesCtrl.frequency, 0.1667, 6, 1.0);
    cfg.treesSize = clampFinite(treesCtrl.size, 0, 6, 1.0);
  }

  for (const [factorioKey, capyResId] of Object.entries(FACTORIO_CONTROL_TO_RESOURCE)) {
    const ctrl = parsed.autoplaceControls[factorioKey];
    if (ctrl) {
      cfg.resources[capyResId] = {
        frequency: clampFinite(ctrl.frequency, 0.1667, 6, 1.0),
        size: clampFinite(ctrl.size, 0, 6, 1.0),
        richness: clampFinite(ctrl.richness, 0.1667, 6, 1.0),
      };
    }
  }

  const elevExpr = (parsed.propertyExpressions.elevation ?? '').toLowerCase();
  if (elevExpr.includes('island')) {
    cfg.mapType = 'island';
  }

  cfg.moistureScale = clampFinite(
    parseNumericExpr(parsed.propertyExpressions['control:moisture:frequency'], 1.0),
    0.1667,
    6,
    1.0
  );
  cfg.moistureBias = clampFinite(
    parseNumericExpr(parsed.propertyExpressions['control:moisture:bias'], 0.0),
    -0.5,
    0.5,
    0.0
  );
  cfg.auxScale = clampFinite(
    parseNumericExpr(parsed.propertyExpressions['control:aux:frequency'], 1.0),
    0.1667,
    6,
    1.0
  );
  cfg.auxBias = clampFinite(
    parseNumericExpr(parsed.propertyExpressions['control:aux:bias'], 0.0),
    -0.5,
    0.5,
    0.0
  );

  const versionLabel = `Factorio ${parsed.version[0]}.${parsed.version[1]}.${parsed.version[2]}`;
  return {
    ok: true,
    config: sanitizeCapytorioMapGenConfig(cfg),
    sourceVersion: versionLabel,
  };
}

export async function encodeFactorioMapExchangeString(
  rawConfig: CapytorioMapGenConfig
): Promise<string> {
  const cfg = sanitizeCapytorioMapGenConfig(rawConfig);
  const w = new BinaryWriter();

  // Canonical Factorio 2.0.77.0 header (imports cleanly into Factorio 2.0/2.1 & Capytorio)
  w.u16(2);
  w.u16(0);
  w.u16(77);
  w.u16(0);
  w.u8(0);

  const controls: Record<string, FactorioAutoplaceControl> = {
    water: { frequency: cfg.waterScale, size: cfg.waterCoverage, richness: 1 },
    trees: { frequency: cfg.treesFrequency, size: cfg.treesSize, richness: 1 },
  };
  for (const resId of FACTORIO_RESOURCE_IDS) {
    controls[RESOURCE_TO_FACTORIO_CONTROL[resId]] = cfg.resources[resId];
  }

  const controlKeys = sortedBytewiseKeys(controls);
  w.count(controlKeys.length);
  for (let i = 0; i < controlKeys.length; i++) {
    const key = controlKeys[i];
    w.str(key);
    writeFreqSizeRich(w, controls[key]);
  }

  // autoplace_settings (empty)
  w.count(0);

  w.bool(true); // default_enable_all_autoplace_controls
  w.u32(cfg.seed);
  w.u32(2000000); // width (infinite)
  w.u32(2000000); // height (infinite)

  // area_to_generate_at_start
  w.pos({ x: -224, y: -224 });
  w.pos({ x: 224, y: 224 });
  w.bytes([0x00, 0x00, 0x01, 0x80]);

  w.f32(cfg.startingArea);
  w.bool(false); // peaceful_mode
  w.bool(false); // no_enemies_mode

  // starting_points
  w.count(1);
  w.pos({ x: 0, y: 0 });

  const propExprs: Record<string, string> = {};
  if (cfg.mapType === 'island') {
    propExprs.elevation = 'elevation_island';
  }
  if (Math.abs(cfg.moistureScale - 1) > 0.001) {
    propExprs['control:moisture:frequency'] = String(+cfg.moistureScale.toFixed(4));
  }
  if (Math.abs(cfg.moistureBias) > 0.001) {
    propExprs['control:moisture:bias'] = String(+cfg.moistureBias.toFixed(4));
  }
  if (Math.abs(cfg.auxScale - 1) > 0.001) {
    propExprs['control:aux:frequency'] = String(+cfg.auxScale.toFixed(4));
  }
  if (Math.abs(cfg.auxBias) > 0.001) {
    propExprs['control:aux:bias'] = String(+cfg.auxBias.toFixed(4));
  }

  const propKeys = sortedBytewiseKeys(propExprs);
  w.count(propKeys.length);
  for (let i = 0; i < propKeys.length; i++) {
    const k = propKeys[i];
    w.str(k);
    w.str(propExprs[k]);
  }

  // cliff_settings
  w.str('cliff');
  w.str('');
  w.f32(10);
  w.f32(40);
  w.f32(1);
  w.f32(1);

  // territory_settings (empty)
  w.count(0);

  // map_settings (Factorio 2.0 defaults)
  writeFields(w, MAP_SETTINGS_2_0, DEFAULT_MAP_SETTINGS_2_0);

  const body = w.result();
  const withCrc = new Uint8Array(body.length + 4);
  withCrc.set(body);
  new DataView(withCrc.buffer).setUint32(body.length, computeCrc32(body), true);

  const compressed = await zlibDeflate(withCrc);
  return `>>>${bytesToBase64(compressed)}<<<`;
}
