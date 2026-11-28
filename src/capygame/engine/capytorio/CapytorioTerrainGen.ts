/**
 * Genuine Factorio Nauvis world generator for Capytorio powered by shthed/factorio-mapgen
 * (FactorioNoise WASM SIMD compiler + FactorioPreview exact tile, resource & tree autoplace).
 *
 * Every terrain tile (grass-1..4, dirt-1..7, dry-dirt, sand-1..3, red-desert-0..3, water,
 * deepwater), all 6 Factorio resources (iron-ore, copper-ore, coal, stone, crude-oil,
 * uranium-ore) with exact richness, and all 18 Nauvis tree species with exact 1/16-tile
 * off-grid placement are evaluated directly by factorio-mapgen and cached in O(1) 32x32
 * typed-array chunks for zero-allocation 60 FPS hot-path sampling.
 */

import { type CapytorioItemId } from '../CapytorioData';
import {
  DEFAULT_CAPYTORIO_MAP_GEN_CONFIG,
  FACTORIO_CONTROL_TO_RESOURCE,
  FACTORIO_RESOURCE_IDS,
  cloneCapytorioMapGenConfig,
  sanitizeCapytorioMapGenConfig,
  type CapytorioMapGenConfig,
  type FactorioResourceId,
} from './FactorioMapExchangeCodec';
import {
  FactorioNoise,
  FactorioPreview,
  NAUVIS_NOISE_DATA,
  type FactorioMapGenSettings,
  type FactorioPreviewRenderer,
} from './factorioMapgen';
import {
  CAPYTORIO_ORE_CLIPMAP_RGB,
  CAPYTORIO_TREE_CLIPMAP_RGB,
} from './CapytorioOrbitalLodMath';

export type CapytorioTerrainType =
  | 'lush_grass'
  | 'grass'
  | 'dirt'
  | 'sand'
  | 'red_desert'
  | 'shallow_water'
  | 'river'
  | 'lake'
  | 'ocean';

export interface CapytorioTerrainSample {
  type: CapytorioTerrainType;
  isWater: boolean;
  /** World Y elevation in meters (-0.02 flat buildable land .. -0.86 deep ocean bed) */
  elevationY: number;
  /** Normalized water depth 0 (dry land) .. 1 (deep pelagic ocean) */
  waterDepth: number;
  /** Normalized shoreline sand blend 0 (inland biome) .. 1 (coastal shoreline sand) */
  sandBlend: number;
  /** Climate moisture 0 (arid desert) .. 1 (lush emerald meadow) */
  moisture: number;
  /** Climate aux 0 (cool olive/clay) .. 1 (warm terracotta/red desert) */
  aux: number;
  /** Exact Factorio tile visual RGB (0..1 linear-ready daylight albedo) */
  colorR?: number;
  colorG?: number;
  colorB?: number;
  /** Underlying Factorio Nauvis tile prototype name (e.g. 'grass-1', 'water', 'red-desert-2') */
  factorioTileName?: string;
}

/**
 * Compact tree species style codes derived directly from Factorio's 18 Nauvis tree prototypes.
 * 0 = none, 1 = lush green (tree-01..05), 2 = olive/pine (tree-06..09),
 * 3 = autumn red (*-red), 4 = warm brown (*-brown), 5 = desert dry/dead (dead-*, dry-*)
 */
export type CapytorioTreeStyleCode = 0 | 1 | 2 | 3 | 4 | 5;

export interface CapytorioTreeSample {
  hasTree: boolean;
  style: CapytorioTreeStyleCode;
  /** Exact Factorio off-grid sub-tile X offset in [-0.5, +0.5) tiles */
  offsetX: number;
  /** Exact Factorio off-grid sub-tile Z offset in [-0.5, +0.5) tiles */
  offsetZ: number;
}

export function isCapytorioWaterTerrain(type: CapytorioTerrainType): boolean {
  return type === 'shallow_water' || type === 'river' || type === 'lake' || type === 'ocean';
}

// ---------------------------------------------------------------------------
// Factorio Tile Metadata Lookup (Daylight-Calibrated 3D PBR Albedo + Biome)
// ---------------------------------------------------------------------------

interface FactorioTileMeta {
  terrainType: CapytorioTerrainType;
  isWater: boolean;
  waterDepth: number;
  elevationY: number;
  sandBlend: number;
  moisture: number;
  aux: number;
  r: number;
  g: number;
  b: number;
}

const FACTORIO_TILE_META_BY_NAME: Readonly<Record<string, FactorioTileMeta>> = {
  deepwater: {
    terrainType: 'ocean',
    isWater: true,
    waterDepth: 0.92,
    elevationY: -0.82,
    sandBlend: 0,
    moisture: 1.0,
    aux: 0.5,
    r: 0.04,
    g: 0.22,
    b: 0.42,
  },
  water: {
    terrainType: 'lake',
    isWater: true,
    waterDepth: 0.42,
    elevationY: -0.46,
    sandBlend: 0,
    moisture: 1.0,
    aux: 0.5,
    r: 0.12,
    g: 0.46,
    b: 0.62,
  },
  'grass-1': {
    terrainType: 'lush_grass',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0,
    moisture: 0.86,
    aux: 0.28,
    r: 0.21,
    g: 0.43,
    b: 0.14,
  },
  'grass-2': {
    terrainType: 'lush_grass',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0,
    moisture: 0.72,
    aux: 0.34,
    r: 0.27,
    g: 0.44,
    b: 0.16,
  },
  'grass-3': {
    terrainType: 'grass',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0,
    moisture: 0.58,
    aux: 0.40,
    r: 0.31,
    g: 0.43,
    b: 0.20,
  },
  'grass-4': {
    terrainType: 'grass',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0,
    moisture: 0.48,
    aux: 0.46,
    r: 0.35,
    g: 0.40,
    b: 0.22,
  },
  'dirt-1': {
    terrainType: 'dirt',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.15,
    moisture: 0.34,
    aux: 0.36,
    r: 0.64,
    g: 0.52,
    b: 0.33,
  },
  'dirt-2': {
    terrainType: 'dirt',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.12,
    moisture: 0.36,
    aux: 0.40,
    r: 0.60,
    g: 0.47,
    b: 0.30,
  },
  'dirt-3': {
    terrainType: 'dirt',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.08,
    moisture: 0.38,
    aux: 0.42,
    r: 0.56,
    g: 0.43,
    b: 0.27,
  },
  'dirt-4': {
    terrainType: 'dirt',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.04,
    moisture: 0.40,
    aux: 0.46,
    r: 0.48,
    g: 0.37,
    b: 0.23,
  },
  'dirt-5': {
    terrainType: 'dirt',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0,
    moisture: 0.42,
    aux: 0.48,
    r: 0.43,
    g: 0.33,
    b: 0.21,
  },
  'dirt-6': {
    terrainType: 'dirt',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0,
    moisture: 0.45,
    aux: 0.50,
    r: 0.39,
    g: 0.30,
    b: 0.19,
  },
  'dirt-7': {
    terrainType: 'dirt',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0,
    moisture: 0.48,
    aux: 0.52,
    r: 0.37,
    g: 0.28,
    b: 0.17,
  },
  'dry-dirt': {
    terrainType: 'dirt',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.10,
    moisture: 0.26,
    aux: 0.48,
    r: 0.51,
    g: 0.41,
    b: 0.26,
  },
  'sand-1': {
    terrainType: 'sand',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.03,
    sandBlend: 0.85,
    moisture: 0.12,
    aux: 0.24,
    r: 0.77,
    g: 0.66,
    b: 0.43,
  },
  'sand-2': {
    terrainType: 'sand',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.025,
    sandBlend: 0.72,
    moisture: 0.16,
    aux: 0.28,
    r: 0.72,
    g: 0.60,
    b: 0.38,
  },
  'sand-3': {
    terrainType: 'sand',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.55,
    moisture: 0.20,
    aux: 0.32,
    r: 0.65,
    g: 0.53,
    b: 0.34,
  },
  'red-desert-0': {
    terrainType: 'red_desert',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.18,
    moisture: 0.14,
    aux: 0.88,
    r: 0.59,
    g: 0.37,
    b: 0.22,
  },
  'red-desert-1': {
    terrainType: 'red_desert',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.22,
    moisture: 0.18,
    aux: 0.80,
    r: 0.64,
    g: 0.42,
    b: 0.25,
  },
  'red-desert-2': {
    terrainType: 'red_desert',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.26,
    moisture: 0.22,
    aux: 0.74,
    r: 0.67,
    g: 0.47,
    b: 0.29,
  },
  'red-desert-3': {
    terrainType: 'red_desert',
    isWater: false,
    waterDepth: 0,
    elevationY: -0.02,
    sandBlend: 0.32,
    moisture: 0.26,
    aux: 0.68,
    r: 0.71,
    g: 0.52,
    b: 0.33,
  },
};

const FALLBACK_GRASS_META: FactorioTileMeta = FACTORIO_TILE_META_BY_NAME['grass-2'];

const RESOURCE_ID_TO_INDEX: Readonly<Record<FactorioResourceId, number>> = {
  iron_ore: 0,
  copper_ore: 1,
  coal: 2,
  stone: 3,
  crude_oil: 4,
  uranium_ore: 5,
};

function classifyFactorioTreeStyle(name: string): CapytorioTreeStyleCode {
  if (name.startsWith('dead-') || name.startsWith('dry-')) return 5;
  if (name.endsWith('-red')) return 3;
  if (name.endsWith('-brown')) return 4;
  if (name === 'tree-06' || name === 'tree-07' || name === 'tree-08' || name === 'tree-09') return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Active Factorio MapGen Kernel & O(1) 32x32 Chunk LRU Cache
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 32;
const CHUNK_TILES = CHUNK_SIZE * CHUNK_SIZE;
const MAX_CACHED_FULL_CHUNKS = 384;
const MAX_CACHED_OVERVIEW_CHUNKS = 128;

interface CachedNauvisChunk {
  cx: number;
  cy: number;
  tileIds: Int16Array;
  resKind: Int8Array;
  resAmount: Int32Array;
  treeStyle: Uint8Array;
  treeOffX: Int8Array;
  treeOffZ: Int8Array;
}

interface CompiledWorldKernel {
  config: CapytorioMapGenConfig;
  mgs: FactorioMapGenSettings;
  fullRenderer: FactorioPreviewRenderer;
  overviewRenderers: Map<number, FactorioPreviewRenderer>;
  tileNames: string[];
  tileMetaById: FactorioTileMeta[];
  fullChunks: Map<string, CachedNauvisChunk>;
  overviewChunks: Map<string, Int16Array>;
  clipmapRgbaChunks: Map<string, Uint8Array>;
  lastFullCx: number;
  lastFullCy: number;
  lastFullChunk: CachedNauvisChunk | null;
}

function buildFactorioMgsFromConfig(cfg: CapytorioMapGenConfig): FactorioMapGenSettings {
  const pen: Record<string, string | number> = {
    'control:moisture:frequency': String(cfg.moistureScale),
    'control:moisture:bias': String(cfg.moistureBias),
    'control:aux:frequency': String(cfg.auxScale),
    'control:aux:bias': String(cfg.auxBias),
  };
  if (cfg.mapType === 'island') {
    pen.elevation = 'elevation_island';
  }

  return {
    seed: cfg.seed >>> 0,
    starting_area: cfg.startingArea,
    autoplace_controls: {
      water: { frequency: cfg.waterScale, size: cfg.waterCoverage },
      trees: { frequency: cfg.treesFrequency, size: cfg.treesSize },
      'iron-ore': {
        frequency: cfg.resources.iron_ore.frequency,
        size: cfg.resources.iron_ore.size,
        richness: cfg.resources.iron_ore.richness,
      },
      'copper-ore': {
        frequency: cfg.resources.copper_ore.frequency,
        size: cfg.resources.copper_ore.size,
        richness: cfg.resources.copper_ore.richness,
      },
      coal: {
        frequency: cfg.resources.coal.frequency,
        size: cfg.resources.coal.size,
        richness: cfg.resources.coal.richness,
      },
      stone: {
        frequency: cfg.resources.stone.frequency,
        size: cfg.resources.stone.size,
        richness: cfg.resources.stone.richness,
      },
      'crude-oil': {
        frequency: cfg.resources.crude_oil.frequency,
        size: cfg.resources.crude_oil.size,
        richness: cfg.resources.crude_oil.richness,
      },
      'uranium-ore': {
        frequency: cfg.resources.uranium_ore.frequency,
        size: cfg.resources.uranium_ore.size,
        richness: cfg.resources.uranium_ore.richness,
      },
      // Peaceful Capytorio frontier: keep Nauvis biters/rocks/cliffs off while preserving authentic Nauvis terrain, ores, and trees
      'enemy-base': { frequency: 1, size: 0 },
      rocks: { frequency: 1, size: 0 },
      nauvis_cliff: { frequency: 1, size: 0 },
    },
    property_expression_names: pen,
  };
}

function compileWorldKernel(rawConfig: CapytorioMapGenConfig): CompiledWorldKernel {
  const config = sanitizeCapytorioMapGenConfig(rawConfig);
  FactorioNoise.resetHeap();
  const mgs = buildFactorioMgsFromConfig(config);
  const fullRenderer = FactorioPreview.renderer(NAUVIS_NOISE_DATA, 'nauvis', mgs, 1);
  const tileNames = fullRenderer.tileNames.slice();
  const tileMetaById = tileNames.map((name) => FACTORIO_TILE_META_BY_NAME[name] ?? FALLBACK_GRASS_META);

  return {
    config,
    mgs,
    fullRenderer,
    overviewRenderers: new Map(),
    tileNames,
    tileMetaById,
    fullChunks: new Map(),
    overviewChunks: new Map(),
    clipmapRgbaChunks: new Map(),
    lastFullCx: Number.NaN,
    lastFullCy: Number.NaN,
    lastFullChunk: null,
  };
}

let activeKernel: CompiledWorldKernel = compileWorldKernel(DEFAULT_CAPYTORIO_MAP_GEN_CONFIG);
let mapGenRevision = 1;

export function getCapytorioMapGenRevision(): number {
  return mapGenRevision;
}

export function getActiveCapytorioMapGen(): CapytorioMapGenConfig {
  return cloneCapytorioMapGenConfig(activeKernel.config);
}

export function setActiveCapytorioMapGen(config: CapytorioMapGenConfig): CapytorioMapGenConfig {
  activeKernel = compileWorldKernel(config);
  mapGenRevision++;
  return cloneCapytorioMapGenConfig(activeKernel.config);
}

export function resetActiveCapytorioMapGenToDefault(): CapytorioMapGenConfig {
  return setActiveCapytorioMapGen(DEFAULT_CAPYTORIO_MAP_GEN_CONFIG);
}

export function getFactorioMapGenDiagnostics(): {
  wasmEnabled: boolean;
  cachedFullChunks: number;
  cachedOverviewChunks: number;
  tileCount: number;
} {
  return {
    wasmEnabled: FactorioNoise.wasm(),
    cachedFullChunks: activeKernel.fullChunks.size,
    cachedOverviewChunks: activeKernel.overviewChunks.size,
    tileCount: activeKernel.tileNames.length,
  };
}

// ---------------------------------------------------------------------------
// Chunk Materialization & O(1) Tile / Resource / Tree Accessors
// ---------------------------------------------------------------------------

function getOrGenerateFullChunk(k: CompiledWorldKernel, cx: number, cy: number): CachedNauvisChunk {
  if (k.lastFullChunk && k.lastFullCx === cx && k.lastFullCy === cy) {
    return k.lastFullChunk;
  }
  const key = `${cx},${cy}`;
  const existing = k.fullChunks.get(key);
  if (existing) {
    // Refresh LRU order
    k.fullChunks.delete(key);
    k.fullChunks.set(key, existing);
    k.lastFullCx = cx;
    k.lastFullCy = cy;
    k.lastFullChunk = existing;
    return existing;
  }

  const sampled = k.fullRenderer._sampleChunk!(cx, cy);
  const resKind = new Int8Array(CHUNK_TILES).fill(-1);
  const resAmount = new Int32Array(CHUNK_TILES);
  const treeStyle = new Uint8Array(CHUNK_TILES);
  const treeOffX = new Int8Array(CHUNK_TILES);
  const treeOffZ = new Int8Array(CHUNK_TILES);

  const x0 = cx * CHUNK_SIZE;
  const y0 = cy * CHUNK_SIZE;
  const placed = sampled.placed;

  for (let i = 0; i < placed.length; i++) {
    const entry = placed[i];
    const ent = entry[0];
    const px = entry[1];
    const py = entry[2];
    const rv = entry[3];

    const tx = Math.floor(px);
    const ty = Math.floor(py);
    const lx = tx - x0;
    const ly = ty - y0;
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE) continue;
    const idx = ly * CHUNK_SIZE + lx;

    if (ent.kind === 'resource') {
      const mappedId = FACTORIO_CONTROL_TO_RESOURCE[ent.name];
      if (!mappedId) continue;
      const rIdx = RESOURCE_ID_TO_INDEX[mappedId];
      // Factorio solid ore richness is direct per-tile amount; crude-oil raw fluid units (~220k..1.2M) scale to Pumpjack reserves
      const amount =
        mappedId === 'crude_oil'
          ? Math.max(800, Math.round(Math.max(10000, rv) / 60))
          : Math.max(1, Math.round(rv));
      if (resKind[idx] < 0 || amount > resAmount[idx]) {
        resKind[idx] = rIdx;
        resAmount[idx] = amount;
      }
    } else if (ent.kind === 'tree') {
      if (treeStyle[idx] === 0) {
        treeStyle[idx] = classifyFactorioTreeStyle(ent.name);
        const ox = Math.max(-0.48, Math.min(0.48, px - tx - 0.5));
        const oz = Math.max(-0.48, Math.min(0.48, py - ty - 0.5));
        treeOffX[idx] = Math.round(ox * 128);
        treeOffZ[idx] = Math.round(oz * 128);
      }
    }
  }

  const chunk: CachedNauvisChunk = {
    cx,
    cy,
    tileIds: sampled.tiles,
    resKind,
    resAmount,
    treeStyle,
    treeOffX,
    treeOffZ,
  };

  k.fullChunks.set(key, chunk);
  if (k.fullChunks.size > MAX_CACHED_FULL_CHUNKS) {
    const oldestKey = k.fullChunks.keys().next().value;
    if (oldestKey !== undefined) k.fullChunks.delete(oldestKey);
    k.fullRenderer.trim(MAX_CACHED_FULL_CHUNKS);
  }
  k.lastFullCx = cx;
  k.lastFullCy = cy;
  k.lastFullChunk = chunk;
  return chunk;
}

function getOrGenerateOverviewTileId(
  k: CompiledWorldKernel,
  gx: number,
  gz: number,
  scale: number
): number {
  let renderer = k.overviewRenderers.get(scale);
  if (!renderer) {
    renderer = FactorioPreview.renderer(NAUVIS_NOISE_DATA, 'nauvis', k.mgs, scale);
    k.overviewRenderers.set(scale, renderer);
  }
  const sx = Math.floor(gx / scale);
  const sy = Math.floor(gz / scale);
  const cx = Math.floor(sx / CHUNK_SIZE);
  const cy = Math.floor(sy / CHUNK_SIZE);
  const key = `${scale}:${cx},${cy}`;
  let tiles = k.overviewChunks.get(key);
  if (!tiles) {
    tiles = renderer._sampleOverviewTiles!(cx, cy);
    k.overviewChunks.set(key, tiles);
    if (k.overviewChunks.size > MAX_CACHED_OVERVIEW_CHUNKS) {
      const oldestKey = k.overviewChunks.keys().next().value;
      if (oldestKey !== undefined) k.overviewChunks.delete(oldestKey);
    }
  }
  const lx = sx - cx * CHUNK_SIZE;
  const ly = sy - cy * CHUNK_SIZE;
  return tiles[ly * CHUNK_SIZE + lx] ?? 0;
}

function populateTerrainSampleFromTileId(
  k: CompiledWorldKernel,
  tileId: number,
  out: CapytorioTerrainSample
): CapytorioTerrainSample {
  const meta = k.tileMetaById[tileId] ?? FALLBACK_GRASS_META;
  out.type = meta.terrainType;
  out.isWater = meta.isWater;
  out.elevationY = meta.elevationY;
  out.waterDepth = meta.waterDepth;
  out.sandBlend = meta.sandBlend;
  out.moisture = meta.moisture;
  out.aux = meta.aux;
  out.colorR = meta.r;
  out.colorG = meta.g;
  out.colorB = meta.b;
  out.factorioTileName = k.tileNames[tileId] ?? 'grass-2';
  return out;
}

const _terrainScratch: CapytorioTerrainSample = {
  type: 'grass',
  isWater: false,
  elevationY: -0.02,
  waterDepth: 0,
  sandBlend: 0,
  moisture: 0.5,
  aux: 0.5,
  colorR: 0.27,
  colorG: 0.44,
  colorB: 0.16,
  factorioTileName: 'grass-2',
};

export function sampleCapytorioTerrainDetail(
  gx: number,
  gz: number,
  out: CapytorioTerrainSample = _terrainScratch
): CapytorioTerrainSample {
  const k = activeKernel;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const cx = Math.floor(ix / CHUNK_SIZE);
  const cy = Math.floor(iz / CHUNK_SIZE);
  const chunk = getOrGenerateFullChunk(k, cx, cy);
  const lx = ix - cx * CHUNK_SIZE;
  const ly = iz - cy * CHUNK_SIZE;
  const tileId = chunk.tileIds[ly * CHUNK_SIZE + lx] ?? 0;
  return populateTerrainSampleFromTileId(k, tileId, out);
}

/**
 * High-altitude fast terrain sampler for zoomed-out strategic deck LODs (lodStep >= 4).
 * Uses factorio-mapgen's tile-only overview evaluator so 512x512..1024x1024 tile continents
 * generate in milliseconds without materializing unseen entity chunks.
 */
export function sampleCapytorioTerrainForDeck(
  gx: number,
  gz: number,
  lodStep: number,
  out: CapytorioTerrainSample = _terrainScratch
): CapytorioTerrainSample {
  if (lodStep <= 2) {
    return sampleCapytorioTerrainDetail(gx, gz, out);
  }
  const k = activeKernel;
  const scale = lodStep >= 8 ? 8 : 4;
  const tileId = getOrGenerateOverviewTileId(k, Math.floor(gx), Math.floor(gz), scale);
  return populateTerrainSampleFromTileId(k, tileId, out);
}

export function sampleCapytorioTerrain(gx: number, gz: number): CapytorioTerrainType {
  return sampleCapytorioTerrainDetail(gx, gz, _terrainScratch).type;
}

export function sampleCapytorioBaseResource(
  gx: number,
  gz: number
): { resource: CapytorioItemId; initialAmount: number } | null {
  const k = activeKernel;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const cx = Math.floor(ix / CHUNK_SIZE);
  const cy = Math.floor(iz / CHUNK_SIZE);
  const chunk = getOrGenerateFullChunk(k, cx, cy);
  const lx = ix - cx * CHUNK_SIZE;
  const ly = iz - cy * CHUNK_SIZE;
  const idx = ly * CHUNK_SIZE + lx;
  const rKind = chunk.resKind[idx];
  if (rKind < 0) return null;
  const resId = FACTORIO_RESOURCE_IDS[rKind];
  if (!resId) return null;
  return {
    resource: resId,
    initialAmount: chunk.resAmount[idx],
  };
}

const _treeScratch: CapytorioTreeSample = {
  hasTree: false,
  style: 0,
  offsetX: 0,
  offsetZ: 0,
};

/**
 * Samples exact Factorio Nauvis tree presence, species style, and 1/16-tile off-grid offset
 * with zero heap allocations.
 */
export function sampleCapytorioTreeDetail(
  gx: number,
  gz: number,
  out: CapytorioTreeSample = _treeScratch
): CapytorioTreeSample {
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  // Keep exact drop-pod spawn tile clear so hero never spawns inside a trunk
  if (Math.abs(ix) <= 2 && Math.abs(iz) <= 2) {
    out.hasTree = false;
    out.style = 0;
    out.offsetX = 0;
    out.offsetZ = 0;
    return out;
  }
  const k = activeKernel;
  const cx = Math.floor(ix / CHUNK_SIZE);
  const cy = Math.floor(iz / CHUNK_SIZE);
  const chunk = getOrGenerateFullChunk(k, cx, cy);
  const lx = ix - cx * CHUNK_SIZE;
  const ly = iz - cy * CHUNK_SIZE;
  const idx = ly * CHUNK_SIZE + lx;
  const style = chunk.treeStyle[idx] as CapytorioTreeStyleCode;
  if (style === 0 || chunk.resKind[idx] >= 0) {
    out.hasTree = false;
    out.style = 0;
    out.offsetX = 0;
    out.offsetZ = 0;
    return out;
  }
  out.hasTree = true;
  out.style = style;
  out.offsetX = chunk.treeOffX[idx] / 128;
  out.offsetZ = chunk.treeOffZ[idx] / 128;
  return out;
}

export function sampleCapytorioTreeAt(gx: number, gz: number): boolean {
  return sampleCapytorioTreeDetail(gx, gz, _treeScratch).hasTree;
}

// ---------------------------------------------------------------------------
// Multi-Scale Clipmap Chunk Baker (32x32 sRGB RGBA chunks for scales 1..256)
// ---------------------------------------------------------------------------

const MAX_CACHED_CLIPMAP_CHUNKS = 384;

function linearToSrgbByte(v: number): number {
  const c = v <= 0 ? 0 : v >= 1 ? 1 : v;
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
}

function fastTileHash01(x: number, z: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(z, 668265263);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/**
 * Bakes (or returns from LRU cache) a 32x32 sRGB RGBA Uint8Array representing exact Nauvis
 * terrain, crisp coastlines, ore patches, and forests at the given `scale` (tiles per texel).
 * Calibrated directly to CapytorioMeshBuilder's 3D groundDeck, waterDeck, ores, and trees.
 */
export function getOrBakeCapytorioClipmapChunkRGBA(
  scale: number,
  cx: number,
  cy: number
): Uint8Array {
  const k = activeKernel;
  const safeScale = scale <= 1 ? 1 : Math.round(scale);
  const key = `${safeScale}:${cx},${cy}`;
  const existing = k.clipmapRgbaChunks.get(key);
  if (existing) {
    k.clipmapRgbaChunks.delete(key);
    k.clipmapRgbaChunks.set(key, existing);
    return existing;
  }

  const rgba = new Uint8Array(CHUNK_TILES * 4);
  const baseTileX = cx * CHUNK_SIZE * safeScale;
  const baseTileZ = cy * CHUNK_SIZE * safeScale;

  if (safeScale === 1) {
    const chunk = getOrGenerateFullChunk(k, cx, cy);
    const tileIds = chunk.tileIds;
    const resKind = chunk.resKind;
    const treeStyle = chunk.treeStyle;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const gz = baseTileZ + ly;
      const rowOff = ly * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = rowOff + lx;
        const gx = baseTileX + lx;
        const meta = k.tileMetaById[tileIds[idx] ?? 0] ?? FALLBACK_GRASS_META;

        let sr: number;
        let sg: number;
        let sb: number;

        if (meta.isWater) {
          const t = Math.min(1, meta.waterDepth);
          const tileName = k.tileNames[tileIds[idx] ?? 0] ?? '';
          const isGreen = tileName.includes('green');
          // Match waterDeck composited over recessed groundDeck basin
          const lr = isGreen ? 0.14 * (1 - t) + 0.08 * t : 0.14 * (1 - t) + 0.08 * t;
          const lg = isGreen ? 0.48 * (1 - t) + 0.30 * t : 0.56 * (1 - t) + 0.40 * t;
          const lb = isGreen ? 0.44 * (1 - t) + 0.30 * t : 0.78 * (1 - t) + 0.66 * t;
          sr = linearToSrgbByte(lr);
          sg = linearToSrgbByte(lg);
          sb = linearToSrgbByte(lb);
        } else {
          const mottling =
            Math.sin(gx * 0.17 + 0.4) * Math.cos(gz * 0.15 - 0.7) * 0.45 +
            Math.sin((gx + gz) * 0.07) * 0.35 +
            Math.cos(gx * 0.29 - gz * 0.23 + 1.1) * 0.2;
          const mDelta = mottling * 0.026;
          // 0.92 factor matches deckTex's lush meadow grain luminance multiplier
          sr = linearToSrgbByte(meta.r * 0.92 + mDelta);
          sg = linearToSrgbByte(meta.g * 0.92 + mDelta);
          sb = linearToSrgbByte(meta.b * 0.92 + mDelta * 0.65);

          const rk = resKind[idx];
          if (rk >= 0 && rk < CAPYTORIO_ORE_CLIPMAP_RGB.length) {
            const oc = CAPYTORIO_ORE_CLIPMAP_RGB[rk];
            const h = fastTileHash01(gx, gz);
            const shade = 0.86 + h * 0.24;
            sr = Math.round(sr * 0.16 + Math.min(255, oc[0] * shade) * 0.84);
            sg = Math.round(sg * 0.16 + Math.min(255, oc[1] * shade) * 0.84);
            sb = Math.round(sb * 0.16 + Math.min(255, oc[2] * shade) * 0.84);
          } else {
            const ts = treeStyle[idx];
            if (ts > 0 && !(Math.abs(gx) <= 2 && Math.abs(gz) <= 2)) {
              const tc = CAPYTORIO_TREE_CLIPMAP_RGB[ts] ?? CAPYTORIO_TREE_CLIPMAP_RGB[1];
              const h = fastTileHash01(gx, gz);
              const shade = 0.84 + h * 0.28;
              const cover = ts === 5 ? 0.56 : 0.78;
              sr = Math.round(sr * (1 - cover) + Math.min(255, tc[0] * shade) * cover);
              sg = Math.round(sg * (1 - cover) + Math.min(255, tc[1] * shade) * cover);
              sb = Math.round(sb * (1 - cover) + Math.min(255, tc[2] * shade) * cover);
            }
          }
        }

        const p = idx * 4;
        rgba[p] = sr;
        rgba[p + 1] = sg;
        rgba[p + 2] = sb;
        rgba[p + 3] = 255;
      }
    }
  } else {
    let renderer = k.overviewRenderers.get(safeScale);
    if (!renderer) {
      renderer = FactorioPreview.renderer(NAUVIS_NOISE_DATA, 'nauvis', k.mgs, safeScale);
      k.overviewRenderers.set(safeScale, renderer);
    }
    const surf = renderer._sampleOverviewSurface!(cx, cy);
    const tileIds = surf.tiles;
    const resIdxArr = surf.resEntityIdx;
    const treeIdxArr = surf.treeEntityIdx;
    const treeProbArr = surf.treeProb;
    const entNames = surf.entityNames;

    // Pre-map entity index -> resource index / tree style once per chunk
    const entResIndex = new Int8Array(entNames.length).fill(-1);
    const entTreeStyle = new Uint8Array(entNames.length);
    for (let i = 0; i < entNames.length; i++) {
      const name = entNames[i];
      const mappedRes = FACTORIO_CONTROL_TO_RESOURCE[name];
      if (mappedRes) {
        entResIndex[i] = RESOURCE_ID_TO_INDEX[mappedRes];
      } else if (name.includes('tree') || name.includes('dry')) {
        entTreeStyle[i] = classifyFactorioTreeStyle(name);
      }
    }

    const treeCoverageScale = Math.max(0, Math.min(2, k.config.treesSize));

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const gz = baseTileZ + ly * safeScale;
      const rowOff = ly * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = rowOff + lx;
        const gx = baseTileX + lx * safeScale;
        const meta = k.tileMetaById[tileIds[idx] ?? 0] ?? FALLBACK_GRASS_META;

        let sr: number;
        let sg: number;
        let sb: number;

        if (meta.isWater) {
          const t = Math.min(1, meta.waterDepth);
          const tileName = k.tileNames[tileIds[idx] ?? 0] ?? '';
          const isGreen = tileName.includes('green');
          const lr = isGreen ? 0.14 * (1 - t) + 0.08 * t : 0.14 * (1 - t) + 0.08 * t;
          const lg = isGreen ? 0.48 * (1 - t) + 0.30 * t : 0.56 * (1 - t) + 0.40 * t;
          const lb = isGreen ? 0.44 * (1 - t) + 0.30 * t : 0.78 * (1 - t) + 0.66 * t;
          sr = linearToSrgbByte(lr);
          sg = linearToSrgbByte(lg);
          sb = linearToSrgbByte(lb);
        } else {
          const mottling =
            Math.sin(gx * 0.031 + 0.4) * Math.cos(gz * 0.029 - 0.7) * 0.5 +
            Math.sin((gx + gz) * 0.011) * 0.35;
          const mDelta = mottling * 0.022;
          sr = linearToSrgbByte(meta.r * 0.92 + mDelta);
          sg = linearToSrgbByte(meta.g * 0.92 + mDelta);
          sb = linearToSrgbByte(meta.b * 0.92 + mDelta * 0.65);

          const reIdx = resIdxArr[idx];
          const rk = reIdx >= 0 ? entResIndex[reIdx] : -1;
          if (rk >= 0 && rk < CAPYTORIO_ORE_CLIPMAP_RGB.length) {
            const oc = CAPYTORIO_ORE_CLIPMAP_RGB[rk];
            const h = fastTileHash01(cx * CHUNK_SIZE + lx, cy * CHUNK_SIZE + ly);
            const shade = 0.88 + h * 0.22;
            sr = Math.round(sr * 0.14 + Math.min(255, oc[0] * shade) * 0.86);
            sg = Math.round(sg * 0.14 + Math.min(255, oc[1] * shade) * 0.86);
            sb = Math.round(sb * 0.14 + Math.min(255, oc[2] * shade) * 0.86);
          } else {
            const tp = treeProbArr[idx];
            if (tp > 0) {
              const teIdx = treeIdxArr[idx];
              const ts = teIdx >= 0 ? entTreeStyle[teIdx] || 1 : 1;
              const tc = CAPYTORIO_TREE_CLIPMAP_RGB[ts] ?? CAPYTORIO_TREE_CLIPMAP_RGB[1];
              const h = fastTileHash01(cx * CHUNK_SIZE + lx, cy * CHUNK_SIZE + ly);
              const density = Math.min(0.82, (tp / 255) * 0.76);
              const speckle = density * (0.72 + h * 0.52);
              const cover = speckle > 0.84 ? 0.84 : speckle;
              sr = Math.round(sr * (1 - cover) + tc[0] * cover);
              sg = Math.round(sg * (1 - cover) + tc[1] * cover);
              sb = Math.round(sb * (1 - cover) + tc[2] * cover);
            } else if (safeScale > 16 && treeCoverageScale > 0.05 && meta.moisture > 0.34) {
              // Macro planetary scale (> 16 tiles/px): subtle moisture-driven forest canopy shading
              // matching Nauvis woodland bands seamlessly with Ring 2
              const forestWave =
                0.5 +
                0.35 * Math.sin(gx * 0.0024 + gz * 0.0019) +
                0.15 * Math.cos(gx * 0.0061 - gz * 0.0053);
              const cover = Math.max(
                0,
                Math.min(0.46, (meta.moisture - 0.32) * 0.9 * forestWave * treeCoverageScale)
              );
              if (cover > 0.03) {
                const tc = meta.aux > 0.62 ? CAPYTORIO_TREE_CLIPMAP_RGB[2] : CAPYTORIO_TREE_CLIPMAP_RGB[1];
                sr = Math.round(sr * (1 - cover) + tc[0] * cover);
                sg = Math.round(sg * (1 - cover) + tc[1] * cover);
                sb = Math.round(sb * (1 - cover) + tc[2] * cover);
              }
            }
          }
        }

        const p = idx * 4;
        rgba[p] = sr;
        rgba[p + 1] = sg;
        rgba[p + 2] = sb;
        rgba[p + 3] = 255;
      }
    }
  }

  k.clipmapRgbaChunks.set(key, rgba);
  if (k.clipmapRgbaChunks.size > MAX_CACHED_CLIPMAP_CHUNKS) {
    const oldestKey = k.clipmapRgbaChunks.keys().next().value;
    if (oldestKey !== undefined) k.clipmapRgbaChunks.delete(oldestKey);
  }
  return rgba;
}

export { FACTORIO_RESOURCE_IDS };
