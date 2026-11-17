/**
 * Factorio Space Age inspired catalog for the Capytorio 3D Factory Minigame.
 * Recipes and technologies are loaded directly from Factorio `data:extend` .lua files
 * (`./data/capytorio/recipe.lua` & `./data/capytorio/technology.lua`), enabling external
 * editing and procedural item generation without duplicating data in TypeScript.
 */

import {
  DEFAULT_RECIPE_LUA_SOURCE,
  DEFAULT_TECH_LUA_SOURCE,
} from './capytorioLuaDefaults';
import {
  CURATED_CAPYTORIO_ITEMS,
  createProceduralItemMeta,
  parseCapytorioLuaCatalog,
} from './CapytorioLuaParser';

export type CapytorioItemId = string;

export type CapytorioMachineType =
  | 'drill'
  | 'belt'
  | 'inserter'
  | 'furnace'
  | 'assembler'
  | 'generator'
  | 'lab'
  | 'splitter'
  | 'tunnel'
  | 'chest';

export type CapytorioDirection = 0 | 1 | 2 | 3; // 0: North (-Z), 1: East (+X), 2: South (+Z), 3: West (-X)

export const CAPYTORIO_WORLD_ORIGIN_X = 1200;
export const CAPYTORIO_WORLD_ORIGIN_Z = 0;
export const CAPYTORIO_TILE_SIZE = 2.5;
export const CAPYTORIO_CHUNK_SIZE = 16;

export interface CapytorioItemMeta {
  id: CapytorioItemId;
  name: string;
  shortName: string;
  category: 'ore' | 'plate' | 'intermediate' | 'science' | 'rocket';
  colorHex: number;
  cssColor: string;
}

export interface CapytorioMachineSpec {
  type: CapytorioMachineType;
  hotkey: string;
  name: string;
  shortName: string;
  description: string;
  powerDemandMw: number;
  powerSupplyMw: number;
  craftCost: Partial<Record<CapytorioItemId, number>>;
  colorHex: number;
  starterCount: number;
}

export const CAPYTORIO_MACHINE_SPECS: Record<CapytorioMachineType, CapytorioMachineSpec> = {
  drill: {
    type: 'drill',
    hotkey: '1',
    name: 'Mining Drill',
    shortName: 'Drill',
    description: 'Place over ore seams to mine automatically and push ore out its front chute.',
    powerDemandMw: 0.9,
    powerSupplyMw: 0,
    craftCost: { iron_plate: 3, iron_gear: 2 },
    colorHex: 0x0ea5e9,
    starterCount: 4,
  },
  belt: {
    type: 'belt',
    hotkey: '2',
    name: 'Transport Belt',
    shortName: 'Belt',
    description: 'Carries items continuously along its chevron direction and glides your Capybara!',
    powerDemandMw: 0,
    powerSupplyMw: 0,
    craftCost: { iron_plate: 1 },
    colorHex: 0xfacc15,
    starterCount: 24,
  },
  inserter: {
    type: 'inserter',
    hotkey: '3',
    name: 'Smart Inserter',
    shortName: 'Inserter',
    description: 'Swings items from the tile behind it into belts, chests, furnaces, assemblers & labs.',
    powerDemandMw: 0.35,
    powerSupplyMw: 0,
    craftCost: { iron_plate: 1, iron_gear: 1 },
    colorHex: 0xf59e0b,
    starterCount: 8,
  },
  furnace: {
    type: 'furnace',
    hotkey: '4',
    name: 'Electric Foundry',
    shortName: 'Furnace',
    description: 'Auto-smelts Iron Ore, Copper Ore, Calcite, Steel & any smelting recipes from recipe.lua.',
    powerDemandMw: 1.2,
    powerSupplyMw: 0,
    craftCost: { calcite: 2, iron_plate: 2 },
    colorHex: 0xf97316,
    starterCount: 4,
  },
  assembler: {
    type: 'assembler',
    hotkey: '5',
    name: 'Assembling Machine',
    shortName: 'Assembler',
    description: 'Automates gears, circuits, science packs, rocket fuel & custom .lua recipes.',
    powerDemandMw: 1.4,
    powerSupplyMw: 0,
    craftCost: { iron_plate: 3, iron_gear: 2, copper_plate: 2 },
    colorHex: 0x3b82f6,
    starterCount: 2,
  },
  generator: {
    type: 'generator',
    hotkey: '6',
    name: 'Coal Steam Generator',
    shortName: 'Generator',
    description: 'Generates 1.5 MW idle thermal trickle + surges to 6.0 MW when fed Coal or Yuzu Sap.',
    powerDemandMw: 0,
    powerSupplyMw: 6.0,
    craftCost: { iron_plate: 4, copper_plate: 2 },
    colorHex: 0xef4444,
    starterCount: 2,
  },
  lab: {
    type: 'lab',
    hotkey: '7',
    name: 'Science Lab',
    shortName: 'Lab',
    description: 'Consumes automated Science Packs to unlock technology.lua Tech Tree bonuses, DNA & Coins.',
    powerDemandMw: 1.5,
    powerSupplyMw: 0,
    craftCost: { iron_plate: 4, electronic_circuit: 2 },
    colorHex: 0xa855f7,
    starterCount: 1,
  },
  splitter: {
    type: 'splitter',
    hotkey: '8',
    name: 'Belt Splitter',
    shortName: 'Splitter',
    description: 'Alternates incoming belt items evenly to front, left & right output lanes.',
    powerDemandMw: 0.1,
    powerSupplyMw: 0,
    craftCost: { iron_plate: 2, iron_gear: 1 },
    colorHex: 0x06b6d4,
    starterCount: 2,
  },
  tunnel: {
    type: 'tunnel',
    hotkey: '9',
    name: 'Underground Tunnel',
    shortName: 'Tunnel',
    description: 'Subterranean belt lane jumping up to 6 tiles in its arrow direction.',
    powerDemandMw: 0,
    powerSupplyMw: 0,
    craftCost: { iron_plate: 3, iron_gear: 1 },
    colorHex: 0xeab308,
    starterCount: 2,
  },
  chest: {
    type: 'chest',
    hotkey: '0',
    name: 'Supply Chest',
    shortName: 'Chest',
    description: 'Stores up to 120 items and auto-transfers finished loot straight to your pocket!',
    powerDemandMw: 0,
    powerSupplyMw: 0,
    craftCost: { iron_plate: 2 },
    colorHex: 0x22c55e,
    starterCount: 2,
  },
};

export const CAPYTORIO_HOTBAR_ORDER: CapytorioMachineType[] = [
  'drill',
  'belt',
  'inserter',
  'furnace',
  'assembler',
  'generator',
  'lab',
  'splitter',
  'tunnel',
  'chest',
];

export type CapytorioRecipeId = string;
export type CapytorioTechId = string;

export interface CapytorioRecipeSpec {
  id: CapytorioRecipeId;
  name: string;
  station: 'furnace' | 'assembler';
  ingredients: Array<{ item: CapytorioItemId; count: number }>;
  result: CapytorioItemId;
  resultCount: number;
  craftTimeSec: number;
  unlockedByDefault: boolean;
  requiredTechId?: CapytorioTechId;
  pocketCraftable: boolean;
}

export interface CapytorioTechSpec {
  id: CapytorioTechId;
  name: string;
  subtitle: string;
  cost: Partial<Record<CapytorioItemId, number>>;
  prerequisites: CapytorioTechId[];
  effectSummary: string;
  repeatable?: boolean;
  rewardDna: number;
  rewardCoins: number;
}

export interface CapytorioSmeltSpec {
  recipeId: CapytorioRecipeId;
  result: CapytorioItemId;
  inputCount: number;
}

export type CapytorioLuaSourceMode = 'bundled' | 'live_server' | 'custom_override';

export interface CapytorioLuaCatalogInfo {
  version: number;
  sourceMode: CapytorioLuaSourceMode;
  recipeCount: number;
  techCount: number;
  itemCount: number;
}

export const CAPYTORIO_ITEM_CATALOG: Record<string, CapytorioItemMeta> = {
  ...CURATED_CAPYTORIO_ITEMS,
};
export const CAPYTORIO_RECIPES: CapytorioRecipeSpec[] = [];
export const CAPYTORIO_TECHS: CapytorioTechSpec[] = [];

const _recipeMap = new Map<CapytorioRecipeId, CapytorioRecipeSpec>();
const _techMap = new Map<CapytorioTechId, CapytorioTechSpec>();
const _smeltableMap = new Map<CapytorioItemId, CapytorioSmeltSpec>();

export const RECIPE_BY_ID: ReadonlyMap<CapytorioRecipeId, CapytorioRecipeSpec> = _recipeMap;
export const TECH_BY_ID: ReadonlyMap<CapytorioTechId, CapytorioTechSpec> = _techMap;

const CUSTOM_LUA_STORAGE_KEY = 'capy_capytorio_custom_lua_v1';

let activeRecipeLuaSource = '';
let activeTechLuaSource = '';
let activeSourceMode: CapytorioLuaSourceMode = 'bundled';
let catalogVersion = 0;
let initialServerFetchStarted = false;
const luaChangeListeners = new Set<(info: CapytorioLuaCatalogInfo) => void>();

function readInitialLuaFromNodeDisk(): { recipeLua: string; techLua: string } {
  if (typeof process === 'undefined') {
    return { recipeLua: '', techLua: '' };
  }
  const getBuiltin = (process as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
  if (typeof getBuiltin !== 'function') {
    return { recipeLua: '', techLua: '' };
  }
  try {
    const fsMod = getBuiltin('node:fs') as {
      existsSync: (p: string) => boolean;
      readFileSync: (p: string, enc: BufferEncoding) => string;
    };
    const pathMod = getBuiltin('node:path') as {
      resolve: (...segments: string[]) => string;
    };
    const rPath = pathMod.resolve(process.cwd(), 'public/data/capytorio/recipe.lua');
    const tPath = pathMod.resolve(process.cwd(), 'public/data/capytorio/technology.lua');
    return {
      recipeLua: fsMod.existsSync(rPath) ? fsMod.readFileSync(rPath, 'utf8') : '',
      techLua: fsMod.existsSync(tPath) ? fsMod.readFileSync(tPath, 'utf8') : '',
    };
  } catch {
    return { recipeLua: '', techLua: '' };
  }
}

function getBundledBaseLuaSources(): { recipeLua: string; techLua: string } {
  if (DEFAULT_RECIPE_LUA_SOURCE.trim().length > 0 || DEFAULT_TECH_LUA_SOURCE.trim().length > 0) {
    return {
      recipeLua: DEFAULT_RECIPE_LUA_SOURCE,
      techLua: DEFAULT_TECH_LUA_SOURCE,
    };
  }
  return readInitialLuaFromNodeDisk();
}

export function getCapytorioItemMeta(id: CapytorioItemId): CapytorioItemMeta {
  const existing = CAPYTORIO_ITEM_CATALOG[id];
  if (existing) return existing;
  const generated = createProceduralItemMeta(id);
  CAPYTORIO_ITEM_CATALOG[id] = generated;
  return generated;
}

export function getCapytorioSmeltSpec(itemId: CapytorioItemId): CapytorioSmeltSpec | undefined {
  return _smeltableMap.get(itemId);
}

export function getCapytorioLuaCatalogInfo(): CapytorioLuaCatalogInfo {
  return {
    version: catalogVersion,
    sourceMode: activeSourceMode,
    recipeCount: CAPYTORIO_RECIPES.length,
    techCount: CAPYTORIO_TECHS.length,
    itemCount: Object.keys(CAPYTORIO_ITEM_CATALOG).length,
  };
}

export function subscribeCapytorioLuaChanges(
  listener: (info: CapytorioLuaCatalogInfo) => void
): () => void {
  luaChangeListeners.add(listener);
  return () => {
    luaChangeListeners.delete(listener);
  };
}

function notifyLuaListeners(): void {
  const info = getCapytorioLuaCatalogInfo();
  for (const listener of luaChangeListeners) {
    try {
      listener(info);
    } catch {
      // Ignore individual subscriber errors cleanly
    }
  }
}

export function applyCapytorioLuaSources(
  recipeLua: string,
  techLua: string,
  mode: CapytorioLuaSourceMode = 'live_server'
): CapytorioLuaCatalogInfo {
  const parsed = parseCapytorioLuaCatalog(recipeLua, techLua);
  activeRecipeLuaSource = recipeLua;
  activeTechLuaSource = techLua;
  activeSourceMode = mode;

  // Replace item catalog in-place while retaining reference identity
  for (const key of Object.keys(CAPYTORIO_ITEM_CATALOG)) {
    delete CAPYTORIO_ITEM_CATALOG[key];
  }
  for (const [k, meta] of Object.entries(parsed.items)) {
    CAPYTORIO_ITEM_CATALOG[k] = meta;
  }

  CAPYTORIO_RECIPES.length = 0;
  for (let i = 0; i < parsed.recipes.length; i++) {
    CAPYTORIO_RECIPES.push(parsed.recipes[i]);
  }

  CAPYTORIO_TECHS.length = 0;
  for (let i = 0; i < parsed.techs.length; i++) {
    CAPYTORIO_TECHS.push(parsed.techs[i]);
  }

  _recipeMap.clear();
  _smeltableMap.clear();
  for (let i = 0; i < CAPYTORIO_RECIPES.length; i++) {
    const rec = CAPYTORIO_RECIPES[i];
    _recipeMap.set(rec.id, rec);
    if (rec.station === 'furnace' && rec.ingredients.length === 1) {
      const ing = rec.ingredients[0];
      if (!_smeltableMap.has(ing.item)) {
        _smeltableMap.set(ing.item, {
          recipeId: rec.id,
          result: rec.result,
          inputCount: ing.count,
        });
      }
    }
  }

  _techMap.clear();
  for (let i = 0; i < CAPYTORIO_TECHS.length; i++) {
    const tech = CAPYTORIO_TECHS[i];
    _techMap.set(tech.id, tech);
  }

  catalogVersion += 1;
  notifyLuaListeners();
  return getCapytorioLuaCatalogInfo();
}

export function getActiveCapytorioLuaSources(): {
  recipeLua: string;
  techLua: string;
  sourceMode: CapytorioLuaSourceMode;
} {
  return {
    recipeLua: activeRecipeLuaSource,
    techLua: activeTechLuaSource,
    sourceMode: activeSourceMode,
  };
}

export function setCustomCapytorioLuaSources(
  recipeLua?: string | null,
  techLua?: string | null
): CapytorioLuaCatalogInfo {
  const nextRecipe =
    typeof recipeLua === 'string' && recipeLua.trim().length > 0
      ? recipeLua
      : activeRecipeLuaSource;
  const nextTech =
    typeof techLua === 'string' && techLua.trim().length > 0 ? techLua : activeTechLuaSource;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        CUSTOM_LUA_STORAGE_KEY,
        JSON.stringify({ recipeLua: nextRecipe, techLua: nextTech })
      );
    }
  } catch {
    // Ignore storage quota errors cleanly
  }
  return applyCapytorioLuaSources(nextRecipe, nextTech, 'custom_override');
}

export async function resetCustomCapytorioLuaSources(): Promise<CapytorioLuaCatalogInfo> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CUSTOM_LUA_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors cleanly
  }
  const base = getBundledBaseLuaSources();
  applyCapytorioLuaSources(base.recipeLua, base.techLua, 'bundled');
  return reloadCapytorioLuaFromServer(true);
}

export async function reloadCapytorioLuaFromServer(
  force: boolean = false
): Promise<CapytorioLuaCatalogInfo> {
  if (typeof fetch !== 'function' || typeof window === 'undefined') {
    return getCapytorioLuaCatalogInfo();
  }
  if (!force && activeSourceMode === 'custom_override') {
    return getCapytorioLuaCatalogInfo();
  }
  try {
    const cacheBust = force ? `?t=${Date.now()}` : '';
    const [recResp, techResp] = await Promise.all([
      fetch(`./data/capytorio/recipe.lua${cacheBust}`, { cache: 'no-store' }),
      fetch(`./data/capytorio/technology.lua${cacheBust}`, { cache: 'no-store' }),
    ]);
    if (!recResp.ok || !techResp.ok) {
      return getCapytorioLuaCatalogInfo();
    }
    const [recText, techText] = await Promise.all([recResp.text(), techResp.text()]);
    if (recText.includes('data:extend') && techText.includes('data:extend')) {
      if (
        force ||
        recText !== activeRecipeLuaSource ||
        techText !== activeTechLuaSource
      ) {
        return applyCapytorioLuaSources(recText, techText, 'live_server');
      }
    }
  } catch {
    // Offline or non-HTTP environment gracefully keeps bundled .lua sources
  }
  return getCapytorioLuaCatalogInfo();
}

export function ensureLiveCapytorioLuaSync(): void {
  if (initialServerFetchStarted) return;
  initialServerFetchStarted = true;
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    void reloadCapytorioLuaFromServer(false);
  }
}

// Immediate synchronous initialization directly from the canonical .lua source files
(function initCapytorioCatalogFromLua() {
  const base = getBundledBaseLuaSources();
  let initialRec = base.recipeLua;
  let initialTech = base.techLua;
  let mode: CapytorioLuaSourceMode = 'bundled';

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(CUSTOM_LUA_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { recipeLua?: string; techLua?: string };
        if (parsed && typeof parsed.recipeLua === 'string' && typeof parsed.techLua === 'string') {
          initialRec = parsed.recipeLua;
          initialTech = parsed.techLua;
          mode = 'custom_override';
        }
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }

  applyCapytorioLuaSources(initialRec, initialTech, mode);
})();
