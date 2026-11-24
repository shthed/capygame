import {
  CAPYTORIO_CHEST_SLOTS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  RECIPE_BY_ID,
  getCapytorioFootprint,
  type CapytorioDirection,
  type CapytorioItemId,
  type CapytorioMachineType,
  type CapytorioRecipeId,
} from './CapytorioData';
import type {
  CapytorioBlueprintEntry,
  CapytorioSavedBlueprint,
} from './CapytorioFactoryEngine';

/** Canonical Factorio 1.1.110 uint64 version header (imports cleanly into both Factorio 1.1 and 2.0). */
export const FACTORIO_EXPORT_VERSION = 281479278886912;

export const SAMPLE_STARTER_MALL_BLUEPRINT_ID = 'preset_starter_mall';
export const SAMPLE_STARTER_MALL_ORIGIN_GX = -8;
export const SAMPLE_STARTER_MALL_ORIGIN_GZ = -8;

export interface FactorioSkippedEntity {
  name: string;
  count: number;
}

export interface FactorioBlueprintImportResult {
  ok: boolean;
  kind: 'blueprint' | 'blueprint_book';
  bookLabel?: string;
  blueprints: Array<{
    label: string;
    width: number;
    height: number;
    entries: CapytorioBlueprintEntry[];
  }>;
  importedEntityCount: number;
  skippedEntities: FactorioSkippedEntity[];
  skippedTotalCount: number;
  error?: string;
}

/**
 * Strict exact-match bidirectional table between Factorio prototype entity names
 * and Capytorio placeable tool IDs. Unsupported/modded entities are intentionally excluded
 * so imports never silently substitute unrelated buildings.
 */
const FACTORIO_ENTITY_TO_CAPYTORIO: Record<string, string> = {
  'burner-mining-drill': 'burner_mining_drill',
  'electric-mining-drill': 'electric_mining_drill',
  'offshore-pump': 'offshore_pump',
  'transport-belt': 'transport_belt',
  'fast-transport-belt': 'fast_transport_belt',
  'express-transport-belt': 'express_transport_belt',
  'underground-belt': 'underground_belt',
  'fast-underground-belt': 'fast_underground_belt',
  'express-underground-belt': 'express_underground_belt',
  splitter: 'splitter',
  'fast-splitter': 'fast_splitter',
  'express-splitter': 'express_splitter',
  'burner-inserter': 'burner_inserter',
  inserter: 'inserter',
  'long-handed-inserter': 'long_handed_inserter',
  'fast-inserter': 'fast_inserter',
  'bulk-inserter': 'bulk_inserter',
  'wooden-chest': 'wooden_chest',
  'iron-chest': 'iron_chest',
  'steel-chest': 'steel_chest',
  'passive-provider-chest': 'passive_provider_chest',
  'requester-chest': 'requester_chest',
  'stone-furnace': 'stone_furnace',
  'steel-furnace': 'steel_furnace',
  'electric-furnace': 'electric_furnace',
  'assembling-machine-1': 'assembling_machine_1',
  'assembling-machine-2': 'assembling_machine_2',
  'assembling-machine-3': 'assembling_machine_3',
  boiler: 'boiler',
  'steam-engine': 'steam_engine',
  'steam-turbine': 'steam_turbine',
  'solar-panel': 'solar_panel',
  accumulator: 'accumulator',
  'nuclear-reactor': 'nuclear_reactor',
  lab: 'lab',
  beacon: 'beacon',
  radar: 'radar',
  'small-electric-pole': 'small_electric_pole',
  'medium-electric-pole': 'medium_electric_pole',
  'big-electric-pole': 'big_electric_pole',
  substation: 'substation',
  'stone-wall': 'stone_wall',
  gate: 'gate',
  'gun-turret': 'gun_turret',
  'laser-turret': 'laser_turret',
  'rocket-silo': 'rocket_silo',
};

const CAPYTORIO_TO_FACTORIO_ENTITY: Record<string, string> = {};
for (const [factorioName, capyId] of Object.entries(FACTORIO_ENTITY_TO_CAPYTORIO)) {
  CAPYTORIO_TO_FACTORIO_ENTITY[capyId] = factorioName;
}

/** Fallback Factorio prototype names when a Capytorio base machine type has no explicit variant ID. */
const BASE_MACHINE_TO_FACTORIO_ENTITY: Record<CapytorioMachineType, string> = {
  drill: 'electric-mining-drill',
  belt: 'transport-belt',
  tunnel: 'underground-belt',
  splitter: 'splitter',
  inserter: 'inserter',
  furnace: 'stone-furnace',
  assembler: 'assembling-machine-1',
  chest: 'wooden-chest',
  generator: 'steam-engine',
  lab: 'lab',
};

/** Exact bidirectional exceptions where Factorio's hyphenated ID differs from Capytorio's underscored ID. */
const FACTORIO_ITEM_TO_CAPYTORIO_EXCEPTIONS: Record<string, string> = {
  'iron-gear-wheel': 'iron_gear',
  stone: 'calcite',
  wood: 'orange',
  'automation-science-pack': 'automation_science',
  'logistic-science-pack': 'logistic_science',
  'military-science-pack': 'military_science',
  'chemical-science-pack': 'chemical_science',
  'production-science-pack': 'production_science',
  'utility-science-pack': 'utility_science',
  'space-science-pack': 'space_science',
  'metallurgic-science-pack': 'metallurgic_science',
  'agricultural-science-pack': 'agricultural_science',
  'electromagnetic-science-pack': 'electromagnetic_science',
};

const CAPYTORIO_ITEM_TO_FACTORIO_EXCEPTIONS: Record<string, string> = {};
for (const [fName, cId] of Object.entries(FACTORIO_ITEM_TO_CAPYTORIO_EXCEPTIONS)) {
  if (!CAPYTORIO_ITEM_TO_FACTORIO_EXCEPTIONS[cId]) {
    CAPYTORIO_ITEM_TO_FACTORIO_EXCEPTIONS[cId] = fName;
  }
}

export function mapFactorioEntityToCapytorioTool(factorioName: string): {
  toolId: string;
  baseType: CapytorioMachineType;
} | null {
  const key = factorioName.trim().toLowerCase();
  const toolId = FACTORIO_ENTITY_TO_CAPYTORIO[key];
  if (!toolId) return null;
  const placeable = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[toolId];
  if (!placeable) return null;
  return { toolId, baseType: placeable.baseType };
}

export function mapCapytorioEntryToFactorioEntityName(entry: CapytorioBlueprintEntry): string {
  if (CAPYTORIO_TO_FACTORIO_ENTITY[entry.toolId]) {
    return CAPYTORIO_TO_FACTORIO_ENTITY[entry.toolId];
  }
  return BASE_MACHINE_TO_FACTORIO_ENTITY[entry.baseType] ?? 'transport-belt';
}

export function mapFactorioItemOrRecipeToCapytorio(rawName: unknown): string | undefined {
  let str: string | null = null;
  if (typeof rawName === 'string') {
    str = rawName;
  } else if (rawName && typeof rawName === 'object' && typeof (rawName as { name?: unknown }).name === 'string') {
    // Factorio 2.0 filter objects use { name: "iron-plate", quality?: "normal" }
    str = (rawName as { name: string }).name;
  }
  if (!str) return undefined;
  const cleaned = str.trim().toLowerCase();
  if (!cleaned) return undefined;
  if (FACTORIO_ITEM_TO_CAPYTORIO_EXCEPTIONS[cleaned]) {
    return FACTORIO_ITEM_TO_CAPYTORIO_EXCEPTIONS[cleaned];
  }
  return cleaned.replace(/-/g, '_');
}

export function mapCapytorioItemOrRecipeToFactorio(capyId: string): string {
  if (CAPYTORIO_ITEM_TO_FACTORIO_EXCEPTIONS[capyId]) {
    return CAPYTORIO_ITEM_TO_FACTORIO_EXCEPTIONS[capyId];
  }
  return capyId.replace(/_/g, '-');
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
    throw new Error('Blueprint string contains invalid Base64 characters');
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

async function runWebStream(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const writePromise = writer
    .write(input as unknown as BufferSource)
    .then(() => writer.close());

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLen += value.byteLength;
    }
  }
  await writePromise;

  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    merged.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return merged;
}

async function deflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    return runWebStream(bytes, new CompressionStream('deflate'));
  }
  throw new Error('Zlib compression (CompressionStream) is unavailable in this environment');
}

async function inflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    return runWebStream(bytes, new DecompressionStream('deflate'));
  }
  throw new Error('Zlib decompression (DecompressionStream) is unavailable in this environment');
}

interface FactorioRawEntity {
  entity_number?: number;
  name?: string;
  position?: { x?: number; y?: number };
  direction?: number;
  recipe?: string;
  type?: 'input' | 'output';
  input_priority?: string;
  output_priority?: string;
  filter?: unknown;
  filters?: unknown[];
  filter_mode?: string;
  override_stack_size?: number;
  bar?: number;
}

interface FactorioRawBlueprint {
  item?: string;
  label?: string;
  version?: number;
  entities?: FactorioRawEntity[];
  icons?: Array<{ index: number; signal: { type?: string; name: string } }>;
}

interface FactorioRawBlueprintBook {
  item?: string;
  label?: string;
  version?: number;
  active_index?: number;
  blueprints?: Array<{
    index?: number;
    blueprint?: FactorioRawBlueprint;
    blueprint_book?: FactorioRawBlueprintBook;
  }>;
}

interface FactorioRootPayload {
  blueprint?: FactorioRawBlueprint;
  blueprint_book?: FactorioRawBlueprintBook;
}

function isFactorio2Version(version: unknown, entities: FactorioRawEntity[]): boolean {
  // Factorio 2.0 encodes major version 2 in bits 48..63 (>= 2 * 2^48 = 562949953421312)
  if (typeof version === 'number' && Number.isFinite(version) && version >= 562949953421312) {
    return true;
  }
  for (let i = 0; i < entities.length; i++) {
    const dir = entities[i].direction;
    if (typeof dir === 'number' && dir >= 8) {
      return true;
    }
  }
  return false;
}

function decodeFactorioDirection(rawDir: unknown, isV2: boolean): CapytorioDirection {
  if (typeof rawDir !== 'number' || !Number.isFinite(rawDir)) return 0;
  if (isV2) {
    // 16-way compass: 0=N, 4=E, 8=S, 12=W
    const norm = ((Math.round(rawDir) % 16) + 16) % 16;
    return (Math.round(norm / 4) % 4) as CapytorioDirection;
  }
  // Factorio 1.1 8-way compass: 0=N, 2=E, 4=S, 6=W
  const norm = ((Math.round(rawDir) % 8) + 8) % 8;
  return (Math.round(norm / 2) % 4) as CapytorioDirection;
}

function encodeFactorioDirectionV1(dir: CapytorioDirection): number {
  return ((dir % 4) + 4) % 4 * 2;
}

function decodeSingleBlueprintObject(
  bp: FactorioRawBlueprint,
  fallbackLabel: string,
  skippedMap: Map<string, number>
): {
  label: string;
  width: number;
  height: number;
  entries: CapytorioBlueprintEntry[];
} | null {
  const rawEntities = Array.isArray(bp.entities) ? bp.entities : [];
  if (rawEntities.length === 0) return null;

  const isV2 = isFactorio2Version(bp.version, rawEntities);
  const decodedRaw: Array<{
    gx: number;
    gz: number;
    width: number;
    height: number;
    entry: Omit<CapytorioBlueprintEntry, 'dx' | 'dz'>;
  }> = [];

  for (let i = 0; i < rawEntities.length; i++) {
    const ent = rawEntities[i];
    if (!ent || typeof ent.name !== 'string') continue;
    const mapped = mapFactorioEntityToCapytorioTool(ent.name);
    if (!mapped) {
      const skippedName = ent.name.trim() || 'unknown-entity';
      skippedMap.set(skippedName, (skippedMap.get(skippedName) ?? 0) + 1);
      continue;
    }

    const dir = decodeFactorioDirection(ent.direction, isV2);
    const variantItemId = mapped.toolId;
    const fp = getCapytorioFootprint(mapped.baseType, variantItemId, dir);

    const posX = typeof ent.position?.x === 'number' && Number.isFinite(ent.position.x) ? ent.position.x : 0;
    const posY = typeof ent.position?.y === 'number' && Number.isFinite(ent.position.y) ? ent.position.y : 0;
    const gx = Math.round(posX - fp.width * 0.5);
    const gz = Math.round(posY - fp.height * 0.5);

    const entryCore: Omit<CapytorioBlueprintEntry, 'dx' | 'dz'> = {
      toolId: mapped.toolId,
      baseType: mapped.baseType,
      dir,
    };

    if (mapped.baseType === 'assembler' && typeof ent.recipe === 'string') {
      const mappedRecipe = mapFactorioItemOrRecipeToCapytorio(ent.recipe) as CapytorioRecipeId | undefined;
      if (mappedRecipe && RECIPE_BY_ID.has(mappedRecipe)) {
        entryCore.recipeId = mappedRecipe;
      }
    }

    if (mapped.baseType === 'splitter') {
      if (ent.input_priority === 'left' || ent.input_priority === 'right') {
        entryCore.splitterInputPriority = ent.input_priority;
      }
      if (ent.output_priority === 'left' || ent.output_priority === 'right') {
        entryCore.splitterOutputPriority = ent.output_priority;
      }
      const filterId = mapFactorioItemOrRecipeToCapytorio(ent.filter);
      if (filterId) {
        entryCore.splitterFilterItem = filterId as CapytorioItemId;
      }
    }

    if (mapped.baseType === 'inserter') {
      if (ent.filter_mode === 'blacklist' || ent.filter_mode === 'whitelist') {
        entryCore.inserterFilterMode = ent.filter_mode;
      }
      if (Array.isArray(ent.filters) && ent.filters.length > 0) {
        const filters: CapytorioItemId[] = [];
        for (let fi = 0; fi < ent.filters.length; fi++) {
          const id = mapFactorioItemOrRecipeToCapytorio(ent.filters[fi]);
          if (id && !filters.includes(id as CapytorioItemId)) {
            filters.push(id as CapytorioItemId);
          }
        }
        if (filters.length > 0) {
          entryCore.inserterFilters = filters;
          if (!entryCore.inserterFilterMode) {
            entryCore.inserterFilterMode = 'whitelist';
          }
        }
      }
      if (typeof ent.override_stack_size === 'number' && Number.isFinite(ent.override_stack_size)) {
        const clampedStack = Math.max(1, Math.min(12, Math.round(ent.override_stack_size)));
        entryCore.inserterStackLimit = clampedStack;
      }
    }

    if (mapped.baseType === 'chest' && typeof ent.bar === 'number' && Number.isFinite(ent.bar)) {
      const clampedBar = Math.max(1, Math.min(CAPYTORIO_CHEST_SLOTS, Math.round(ent.bar)));
      entryCore.chestSlotLimit = clampedBar;
    }

    decodedRaw.push({ gx, gz, width: fp.width, height: fp.height, entry: entryCore });
  }

  if (decodedRaw.length === 0) return null;

  let minX = decodedRaw[0].gx;
  let minZ = decodedRaw[0].gz;
  let maxX = decodedRaw[0].gx + decodedRaw[0].width - 1;
  let maxZ = decodedRaw[0].gz + decodedRaw[0].height - 1;
  for (let i = 1; i < decodedRaw.length; i++) {
    const item = decodedRaw[i];
    if (item.gx < minX) minX = item.gx;
    if (item.gz < minZ) minZ = item.gz;
    if (item.gx + item.width - 1 > maxX) maxX = item.gx + item.width - 1;
    if (item.gz + item.height - 1 > maxZ) maxZ = item.gz + item.height - 1;
  }

  // Deduplicate exact anchor collisions while preserving first entity
  const seenAnchors = new Set<string>();
  const entries: CapytorioBlueprintEntry[] = [];
  for (let i = 0; i < decodedRaw.length; i++) {
    const item = decodedRaw[i];
    const dx = item.gx - minX;
    const dz = item.gz - minZ;
    const anchorKey = `${dx},${dz}`;
    if (seenAnchors.has(anchorKey)) continue;
    seenAnchors.add(anchorKey);
    entries.push({
      dx,
      dz,
      ...item.entry,
    });
  }

  const label =
    typeof bp.label === 'string' && bp.label.trim().length > 0
      ? bp.label.trim().slice(0, 64)
      : fallbackLabel;

  return {
    label,
    width: maxX - minX + 1,
    height: maxZ - minZ + 1,
    entries,
  };
}

function collectBookBlueprints(
  book: FactorioRawBlueprintBook,
  prefixLabel: string,
  outBlueprints: Array<{
    label: string;
    width: number;
    height: number;
    entries: CapytorioBlueprintEntry[];
  }>,
  skippedMap: Map<string, number>,
  nestedPrefix: string = ''
): void {
  const items = Array.isArray(book.blueprints) ? [...book.blueprints] : [];
  items.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (let i = 0; i < items.length; i++) {
    const slot = items[i];
    if (!slot || typeof slot !== 'object') continue;
    if (slot.blueprint) {
      const fallback = prefixLabel
        ? `${prefixLabel} #${outBlueprints.length + 1}`
        : `Imported Blueprint #${outBlueprints.length + 1}`;
      const decoded = decodeSingleBlueprintObject(slot.blueprint, fallback, skippedMap);
      if (decoded) {
        if (nestedPrefix && !decoded.label.startsWith(`${nestedPrefix} /`)) {
          decoded.label = `${nestedPrefix} / ${decoded.label}`.slice(0, 64);
        }
        outBlueprints.push(decoded);
      }
    } else if (slot.blueprint_book) {
      const rawSubLabel =
        typeof slot.blueprint_book.label === 'string' && slot.blueprint_book.label.trim()
          ? slot.blueprint_book.label.trim()
          : '';
      const nextNested = rawSubLabel
        ? nestedPrefix
          ? `${nestedPrefix} / ${rawSubLabel}`
          : rawSubLabel
        : nestedPrefix;
      collectBookBlueprints(
        slot.blueprint_book,
        rawSubLabel || prefixLabel,
        outBlueprints,
        skippedMap,
        nextNested
      );
    }
  }
}

/**
 * Decodes a Factorio Blueprint String (`0e...`) or raw Factorio 2.0 JSON into Capytorio blueprints.
 * Supports single blueprints and nested blueprint books, using exact-match entity filtering
 * and returning an explicit skipped-entity summary for any unsupported/modded entities.
 */
export async function decodeFactorioBlueprintString(
  rawInput: string
): Promise<FactorioBlueprintImportResult> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      kind: 'blueprint',
      blueprints: [],
      importedEntityCount: 0,
      skippedEntities: [],
      skippedTotalCount: 0,
      error: 'Paste a Factorio blueprint string starting with "0" (or raw Factorio JSON).',
    };
  }

  let parsed: FactorioRootPayload;
  try {
    if (trimmed.startsWith('{')) {
      parsed = JSON.parse(trimmed) as FactorioRootPayload;
    } else {
      if (trimmed[0] !== '0') {
        return {
          ok: false,
          kind: 'blueprint',
          blueprints: [],
          importedEntityCount: 0,
          skippedEntities: [],
          skippedTotalCount: 0,
          error: `Unsupported blueprint version prefix "${trimmed[0]}" (expected "0").`,
        };
      }
      const compressed = base64ToBytes(trimmed.slice(1));
      const inflated = await inflateZlib(compressed);
      const jsonText = new TextDecoder().decode(inflated);
      parsed = JSON.parse(jsonText) as FactorioRootPayload;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to decompress or parse blueprint string';
    return {
      ok: false,
      kind: 'blueprint',
      blueprints: [],
      importedEntityCount: 0,
      skippedEntities: [],
      skippedTotalCount: 0,
      error: `Invalid Factorio blueprint string: ${msg}`,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      kind: 'blueprint',
      blueprints: [],
      importedEntityCount: 0,
      skippedEntities: [],
      skippedTotalCount: 0,
      error: 'Decoded blueprint payload is not a valid JSON object.',
    };
  }

  const skippedMap = new Map<string, number>();
  const blueprints: Array<{
    label: string;
    width: number;
    height: number;
    entries: CapytorioBlueprintEntry[];
  }> = [];
  let kind: 'blueprint' | 'blueprint_book' = 'blueprint';
  let bookLabel: string | undefined;

  if (parsed.blueprint && typeof parsed.blueprint === 'object') {
    kind = 'blueprint';
    const single = decodeSingleBlueprintObject(parsed.blueprint, 'Imported Blueprint', skippedMap);
    if (single) blueprints.push(single);
  } else if (parsed.blueprint_book && typeof parsed.blueprint_book === 'object') {
    kind = 'blueprint_book';
    bookLabel =
      typeof parsed.blueprint_book.label === 'string' && parsed.blueprint_book.label.trim()
        ? parsed.blueprint_book.label.trim().slice(0, 64)
        : 'Imported Blueprint Book';
    collectBookBlueprints(parsed.blueprint_book, bookLabel, blueprints, skippedMap);
  } else {
    return {
      ok: false,
      kind: 'blueprint',
      blueprints: [],
      importedEntityCount: 0,
      skippedEntities: [],
      skippedTotalCount: 0,
      error: 'JSON does not contain a "blueprint" or "blueprint_book" object.',
    };
  }

  const skippedEntities: FactorioSkippedEntity[] = Array.from(skippedMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const skippedTotalCount = skippedEntities.reduce((acc, s) => acc + s.count, 0);
  const importedEntityCount = blueprints.reduce((acc, b) => acc + b.entries.length, 0);

  if (blueprints.length === 0 || importedEntityCount === 0) {
    const skippedList =
      skippedEntities.length > 0
        ? ` Skipped unsupported entities: ${skippedEntities
            .slice(0, 5)
            .map((s) => `${s.name} ×${s.count}`)
            .join(', ')}.`
        : '';
    return {
      ok: false,
      kind,
      bookLabel,
      blueprints: [],
      importedEntityCount: 0,
      skippedEntities,
      skippedTotalCount,
      error: `No supported Capytorio entities found in this ${kind === 'blueprint_book' ? 'blueprint book' : 'blueprint'}.${skippedList}`,
    };
  }

  return {
    ok: true,
    kind,
    bookLabel,
    blueprints,
    importedEntityCount,
    skippedEntities,
    skippedTotalCount,
  };
}

function buildFactorioBlueprintPayload(input: {
  label: string;
  entries: ReadonlyArray<CapytorioBlueprintEntry>;
}): FactorioRawBlueprint {
  const entities: FactorioRawEntity[] = [];
  const iconCounts = new Map<string, number>();

  for (let i = 0; i < input.entries.length; i++) {
    const e = input.entries[i];
    const name = mapCapytorioEntryToFactorioEntityName(e);
    iconCounts.set(name, (iconCounts.get(name) ?? 0) + 1);
    const variantItemId = e.toolId !== e.baseType ? e.toolId : undefined;
    const fp = getCapytorioFootprint(e.baseType, variantItemId, e.dir);

    const ent: FactorioRawEntity = {
      entity_number: i + 1,
      name,
      position: {
        x: e.dx + fp.width * 0.5,
        y: e.dz + fp.height * 0.5,
      },
    };

    const fDir = encodeFactorioDirectionV1(e.dir);
    if (fDir !== 0) {
      ent.direction = fDir;
    }

    if (e.baseType === 'tunnel') {
      ent.type = 'input';
    }

    if (e.baseType === 'assembler' && e.recipeId) {
      ent.recipe = mapCapytorioItemOrRecipeToFactorio(e.recipeId);
    }

    if (e.baseType === 'splitter') {
      if (e.splitterInputPriority && e.splitterInputPriority !== 'none') {
        ent.input_priority = e.splitterInputPriority;
      }
      if (e.splitterOutputPriority && e.splitterOutputPriority !== 'none') {
        ent.output_priority = e.splitterOutputPriority;
      }
      if (e.splitterFilterItem) {
        ent.filter = mapCapytorioItemOrRecipeToFactorio(e.splitterFilterItem);
      }
    }

    if (e.baseType === 'inserter') {
      if (e.inserterFilterMode) {
        ent.filter_mode = e.inserterFilterMode;
      }
      if (e.inserterFilters && e.inserterFilters.length > 0) {
        ent.filters = e.inserterFilters.map((item, idx) => ({
          index: idx + 1,
          name: mapCapytorioItemOrRecipeToFactorio(item),
        }));
      }
      if (typeof e.inserterStackLimit === 'number' && e.inserterStackLimit >= 1) {
        ent.override_stack_size = e.inserterStackLimit;
      }
    }

    if (e.baseType === 'chest' && typeof e.chestSlotLimit === 'number' && e.chestSlotLimit >= 1) {
      ent.bar = Math.min(CAPYTORIO_CHEST_SLOTS, Math.round(e.chestSlotLimit));
    }

    entities.push(ent);
  }

  const topIcons = Array.from(iconCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name], idx) => ({
      index: idx + 1,
      signal: { type: 'item', name },
    }));

  return {
    item: 'blueprint',
    label: input.label || 'Capytorio Blueprint',
    icons: topIcons,
    entities,
    version: FACTORIO_EXPORT_VERSION,
  };
}

/**
 * Encodes a single Capytorio blueprint into a genuine Factorio `0e...` compressed string.
 */
export async function encodeFactorioBlueprintString(input: {
  label: string;
  entries: ReadonlyArray<CapytorioBlueprintEntry>;
}): Promise<string> {
  const payload: FactorioRootPayload = {
    blueprint: buildFactorioBlueprintPayload(input),
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = await deflateZlib(jsonBytes);
  return '0' + bytesToBase64(compressed);
}

/**
 * Encodes multiple Capytorio blueprints into a genuine Factorio `0e...` `blueprint_book` string.
 */
export async function encodeFactorioBlueprintBookString(
  blueprints: ReadonlyArray<{
    label: string;
    entries: ReadonlyArray<CapytorioBlueprintEntry>;
  }>,
  bookLabel: string = 'Capytorio Blueprint Book'
): Promise<string> {
  const payload: FactorioRootPayload = {
    blueprint_book: {
      item: 'blueprint-book',
      label: bookLabel,
      active_index: 0,
      version: FACTORIO_EXPORT_VERSION,
      blueprints: blueprints.map((bp, index) => ({
        index,
        blueprint: buildFactorioBlueprintPayload(bp),
      })),
    },
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = await deflateZlib(jsonBytes);
  return '0' + bytesToBase64(compressed);
}

interface AbsoluteSampleEntry {
  gx: number;
  gz: number;
  toolId: string;
  baseType: CapytorioMachineType;
  dir: CapytorioDirection;
  recipeId?: CapytorioRecipeId;
  chestSlotLimit?: number;
}

/**
 * Complete self-powered Capytorio Starter Mall layout anchored around the starter plain:
 * - NW Iron Patch (-5.5,-5.5): 2 Electric Mining Drills -> 2 Stone Furnaces -> Iron Plate main bus
 * - NE Copper Patch (+5.5,-5.5): 2 Electric Mining Drills -> 2 Stone Furnaces -> Copper Plate line
 * - SW Coal Patch (-5.5,+5.5): 1 Electric Mining Drill -> belt -> Inserter -> Steam Engine (6 MW)
 * - Central Starter Mall:
 *   - Copper Cable Assembler -> direct-inserted into Electronic Circuit Assembler -> Iron Chest (capped)
 *   - Iron Gear Assembler -> direct-inserted into Transport Belt Assembler (-> Iron Chest) & Inserter Assembler (-> Iron Chest)
 *   - Electronic Circuit output belt feeds Inserter Assembler & fills Electronic Circuit Iron Chest
 * - Leaves central spawn (0, 0) & Surveyor Beacon (0, -3) completely clear.
 */
const SAMPLE_STARTER_MALL_ABSOLUTE: readonly AbsoluteSampleEntry[] = [
  // 1. NW Iron Mining & Smelting (covers iron_ore around -5.5, -5.5)
  { gx: -8, gz: -7, toolId: 'electric_mining_drill', baseType: 'drill', dir: 2 },
  { gx: -5, gz: -7, toolId: 'electric_mining_drill', baseType: 'drill', dir: 2 },
  { gx: -7, gz: -4, toolId: 'stone_furnace', baseType: 'furnace', dir: 2 },
  { gx: -4, gz: -4, toolId: 'stone_furnace', baseType: 'furnace', dir: 2 },

  // Iron Plate Main Bus: (-7,-2) -> (-3,-2) -> down (-3,2) -> 2x1 Splitter at (-2,2)
  // Upper lane (gz=2) feeds Electronic Circuits & Inserters; Lower lane (gz=3) feeds Belts & Gears!
  { gx: -7, gz: -2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -6, gz: -2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -5, gz: -2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -4, gz: -2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -3, gz: -2, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: -3, gz: -1, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: -3, gz: 0, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: -3, gz: 1, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: -3, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -2, gz: 2, toolId: 'splitter', baseType: 'splitter', dir: 1 },

  // Upper Iron Branch (gz=2): splits 50/50 at (6,2) to feed Electronic Circuits (7,1) & Inserters (7,4)
  { gx: -1, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 0, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 1, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 2, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 3, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 4, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 5, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 6, gz: 2, toolId: 'splitter', baseType: 'splitter', dir: 1 },
  { gx: 7, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 7, gz: 3, toolId: 'transport_belt', baseType: 'belt', dir: 1 },

  // Lower Iron Branch (gz=3): feeds Transport Belt Assembler (-1,4) & Iron Gear Assembler (3,4)
  { gx: -1, gz: 3, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 0, gz: 3, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 1, gz: 3, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 2, gz: 3, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 3, gz: 3, toolId: 'transport_belt', baseType: 'belt', dir: 1 },

  // 2. NE Copper Mining & Smelting (covers copper_ore around 5.5, -5.5)
  { gx: 3, gz: -8, toolId: 'electric_mining_drill', baseType: 'drill', dir: 2 },
  { gx: 6, gz: -8, toolId: 'electric_mining_drill', baseType: 'drill', dir: 2 },
  { gx: 4, gz: -5, toolId: 'stone_furnace', baseType: 'furnace', dir: 2 },
  { gx: 7, gz: -5, toolId: 'stone_furnace', baseType: 'furnace', dir: 2 },

  // Copper Plate Feed Line along gz = -3 heading West into Copper Cable Assembler
  { gx: 7, gz: -3, toolId: 'transport_belt', baseType: 'belt', dir: 3 },
  { gx: 6, gz: -3, toolId: 'transport_belt', baseType: 'belt', dir: 3 },
  { gx: 5, gz: -3, toolId: 'transport_belt', baseType: 'belt', dir: 3 },
  { gx: 4, gz: -3, toolId: 'transport_belt', baseType: 'belt', dir: 3 },
  { gx: 3, gz: -3, toolId: 'transport_belt', baseType: 'belt', dir: 3 },

  // 3. Electronic Circuit Production Cell (North of Upper Iron Branch)
  { gx: 3, gz: -2, toolId: 'inserter', baseType: 'inserter', dir: 2 },
  { gx: 4, gz: -2, toolId: 'inserter', baseType: 'inserter', dir: 2 },
  { gx: 2, gz: -1, toolId: 'assembling_machine_1', baseType: 'assembler', dir: 1, recipeId: 'copper_cable' },
  { gx: 5, gz: -1, toolId: 'fast_inserter', baseType: 'inserter', dir: 1 },
  { gx: 5, gz: 0, toolId: 'fast_inserter', baseType: 'inserter', dir: 1 },
  { gx: 6, gz: -2, toolId: 'assembling_machine_1', baseType: 'assembler', dir: 1, recipeId: 'electronic_circuit' },
  { gx: 7, gz: 1, toolId: 'inserter', baseType: 'inserter', dir: 0 },

  // Electronic Circuit output line heading East & South -> 2x1 Splitter at (10,5) splits 50/50 to Inserter Assembler & Circuit Chest
  { gx: 9, gz: -1, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 10, gz: -1, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: 10, gz: 0, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: 10, gz: 1, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: 10, gz: 2, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: 10, gz: 3, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: 10, gz: 4, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: 10, gz: 5, toolId: 'splitter', baseType: 'splitter', dir: 2 },
  { gx: 10, gz: 6, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: 11, gz: 6, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: 11, gz: 7, toolId: 'iron_chest', baseType: 'chest', dir: 0, chestSlotLimit: 4 },

  // 4. Starter Mall Lower Row (Transport Belts, Iron Gears, Inserters)
  { gx: -1, gz: 4, toolId: 'inserter', baseType: 'inserter', dir: 2 },
  { gx: 3, gz: 4, toolId: 'inserter', baseType: 'inserter', dir: 2 },
  { gx: 7, gz: 4, toolId: 'inserter', baseType: 'inserter', dir: 2 },

  // Transport Belt Assembler -> Iron Chest (left)
  { gx: -3, gz: 6, toolId: 'iron_chest', baseType: 'chest', dir: 0, chestSlotLimit: 4 },
  { gx: -2, gz: 5, toolId: 'assembling_machine_1', baseType: 'assembler', dir: 3, recipeId: 'transport_belt' },

  // Direct-insertion Iron Gear Assembler feeding both Belt & Inserter assemblers
  { gx: 1, gz: 6, toolId: 'inserter', baseType: 'inserter', dir: 3 },
  { gx: 2, gz: 5, toolId: 'assembling_machine_1', baseType: 'assembler', dir: 1, recipeId: 'iron_gear' },
  { gx: 5, gz: 6, toolId: 'inserter', baseType: 'inserter', dir: 1 },

  // Inserter Assembler -> Iron Chest (south), fed Electronic Circuits from (10,6)
  { gx: 6, gz: 5, toolId: 'assembling_machine_1', baseType: 'assembler', dir: 2, recipeId: 'inserter' },
  { gx: 9, gz: 6, toolId: 'inserter', baseType: 'inserter', dir: 3 },
  { gx: 7, gz: 8, toolId: 'iron_chest', baseType: 'chest', dir: 0, chestSlotLimit: 4 },

  // 5. SW Coal Power Plant (covers coal around -5.5, 5.5 -> feeds 4 Steam Engines = 24 MW)
  { gx: -8, gz: 4, toolId: 'electric_mining_drill', baseType: 'drill', dir: 2 },
  { gx: -7, gz: 7, toolId: 'transport_belt', baseType: 'belt', dir: 2 },
  { gx: -7, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -6, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -5, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -4, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -3, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -2, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -1, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 0, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 1, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 2, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 3, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 4, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: 5, gz: 8, toolId: 'transport_belt', baseType: 'belt', dir: 1 },
  { gx: -4, gz: 9, toolId: 'inserter', baseType: 'inserter', dir: 2 },
  { gx: -1, gz: 9, toolId: 'inserter', baseType: 'inserter', dir: 2 },
  { gx: 2, gz: 9, toolId: 'inserter', baseType: 'inserter', dir: 2 },
  { gx: 5, gz: 9, toolId: 'inserter', baseType: 'inserter', dir: 2 },
  { gx: -5, gz: 10, toolId: 'steam_engine', baseType: 'generator', dir: 2 },
  { gx: -2, gz: 10, toolId: 'steam_engine', baseType: 'generator', dir: 2 },
  { gx: 1, gz: 10, toolId: 'steam_engine', baseType: 'generator', dir: 2 },
  { gx: 4, gz: 10, toolId: 'steam_engine', baseType: 'generator', dir: 2 },
];

export function createSampleStarterMallBlueprint(): CapytorioSavedBlueprint {
  let maxX = 0;
  let maxZ = 0;
  const entries: CapytorioBlueprintEntry[] = SAMPLE_STARTER_MALL_ABSOLUTE.map((item) => {
    const dx = item.gx - SAMPLE_STARTER_MALL_ORIGIN_GX;
    const dz = item.gz - SAMPLE_STARTER_MALL_ORIGIN_GZ;
    const fp = getCapytorioFootprint(item.baseType, item.toolId, item.dir);
    if (dx + fp.width > maxX) maxX = dx + fp.width;
    if (dz + fp.height > maxZ) maxZ = dz + fp.height;
    const bpEntry: CapytorioBlueprintEntry = {
      dx,
      dz,
      toolId: item.toolId,
      baseType: item.baseType,
      dir: item.dir,
    };
    if (item.recipeId) bpEntry.recipeId = item.recipeId;
    if (item.chestSlotLimit) bpEntry.chestSlotLimit = item.chestSlotLimit;
    return bpEntry;
  });

  return {
    id: SAMPLE_STARTER_MALL_BLUEPRINT_ID,
    label: 'Starter Mall · Belts, Inserters & Circuits',
    sourceMode: 'preset',
    createdAt: 0,
    width: maxX,
    height: maxZ,
    entries,
  };
}

export function getSampleStarterMallAbsoluteEntries(): readonly AbsoluteSampleEntry[] {
  return SAMPLE_STARTER_MALL_ABSOLUTE;
}
