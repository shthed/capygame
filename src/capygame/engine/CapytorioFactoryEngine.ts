import {
  CAPYTORIO_CHEST_ITEMS_PER_SLOT,
  CAPYTORIO_CHEST_MAX_ITEMS,
  CAPYTORIO_CHEST_SLOTS,
  CAPYTORIO_HOTBAR_ORDER,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  CAPYTORIO_RECIPES,
  CAPYTORIO_TECHS,
  CAPYTORIO_TILE_SIZE,
  CAPYTORIO_WORLD_ORIGIN_X,
  CAPYTORIO_WORLD_ORIGIN_Z,
  RECIPE_BY_ID,
  TECH_BY_ID,
  getCapytorioFootprint,
  getCapytorioInserterReach,
  getCapytorioItemMeta,
  getCapytorioSmeltSpec,
  type CapytorioDirection,
  type CapytorioItemId,
  type CapytorioMachineType,
  type CapytorioRecipeId,
  type CapytorioTechId,
} from './CapytorioData';
import {
  createSampleStarterMallBlueprint,
  getSampleStarterMallAbsoluteEntries,
  type FactorioBlueprintImportResult,
} from './FactorioBlueprintCodec';
import {
  isCapytorioWaterTerrain,
  sampleCapytorioBaseResource,
  sampleCapytorioTerrain,
  sampleCapytorioTerrainDetail,
  sampleCapytorioTreeAt,
  type CapytorioTerrainSample,
  type CapytorioTerrainType,
} from './capytorio/CapytorioTerrainGen';
import {
  cancelCraftQueueItem as cancelCraftQueueItemInHost,
  enqueueMachineCraft as enqueueMachineCraftInHost,
  enqueuePocketCraft as enqueuePocketCraftInHost,
  getMaxAffordableCraftBatches as getMaxAffordableCraftBatchesInHost,
  stepCraftingQueue as stepCraftingQueueInHost,
  type CapytorioCraftingQueueHost,
} from './capytorio/CapytorioCraftingQueue';
import {
  buildBlueprintLabel as buildBlueprintLabelPure,
  computeBlueprintBounds as computeBlueprintBoundsPure,
  deleteBlueprintFromLibrary as deleteBlueprintFromLibraryInHost,
  evaluateBlueprintPlacementAt as evaluateBlueprintPlacementAtInHost,
  exportBlueprintLibraryAsFactorioBookStringFromHost,
  exportBlueprintToFactorioStringFromHost,
  exportFactoryToFactorioStringFromHost,
  flipBlueprintEntriesHorizontal,
  flipBlueprintEntriesVertical,
  importFactorioBlueprintStringIntoHost,
  pasteBlueprintAt as pasteBlueprintAtInHost,
  recordBlueprintToLibrary as recordBlueprintToLibraryInHost,
  rotateBlueprintEntries90,
  selectBlueprintFromLibrary as selectBlueprintFromLibraryInHost,
  selectMachinesInBox as selectMachinesInBoxInHost,
  selectMachinesInPolygon as selectMachinesInPolygonInHost,
  type CapytorioBlueprintHost,
} from './capytorio/CapytorioBlueprintService';
import {
  hydrateCapytorioEngineState,
  sanitizeCapytorioSerializedState,
  serializeCapytorioEngineState,
  type CapytorioSerializerHost,
} from './capytorio/CapytorioSerializer';

export {
  isCapytorioWaterTerrain,
  sampleCapytorioBaseResource,
  sampleCapytorioTerrain,
  sampleCapytorioTerrainDetail,
  sampleCapytorioTreeAt,
  type CapytorioTerrainSample,
  type CapytorioTerrainType,
};

export const MAX_RECENT_CAPYTORIO_TOOLS = 10;
export const MAX_CAPYTORIO_BLUEPRINT_LIBRARY = 100;
export const MAX_CAPYTORIO_UNDO_HISTORY = 100;

export type CapytorioPlaceableToolId = CapytorioMachineType | CapytorioItemId;

export interface CapytorioPlaceableSpec {
  id: string;
  baseType: CapytorioMachineType;
  isBaseMachine: boolean;
  name: string;
  shortName: string;
  description: string;
  tierMult: number;
  tintHex: number;
}

export function resolveCapytorioPlaceableSpec(toolId: string): CapytorioPlaceableSpec | null {
  if (Object.prototype.hasOwnProperty.call(CAPYTORIO_MACHINE_SPECS, toolId)) {
    const mType = toolId as CapytorioMachineType;
    const spec = CAPYTORIO_MACHINE_SPECS[mType];
    return {
      id: mType,
      baseType: mType,
      isBaseMachine: true,
      name: spec.name,
      shortName: spec.shortName,
      description: spec.description,
      tierMult: 1.0,
      tintHex: spec.colorHex,
    };
  }
  const mapping = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[toolId];
  if (mapping) {
    const baseSpec = CAPYTORIO_MACHINE_SPECS[mapping.baseType];
    const meta = getCapytorioItemMeta(toolId);
    return {
      id: toolId,
      baseType: mapping.baseType,
      isBaseMachine: false,
      name: meta.name,
      shortName: meta.shortName,
      description: `${meta.name} (${baseSpec.shortName} · ${mapping.tierMult.toFixed(1)}x speed)`,
      tierMult: mapping.tierMult,
      tintHex: mapping.tintHex ?? meta.colorHex,
    };
  }
  return null;
}

export type CapytorioBeltCurveShape = 'straight' | 'curve_from_left' | 'curve_from_right';
export type CapytorioInserterPhase = 'idle_pickup' | 'reaching' | 'carrying' | 'returning';

export const BELT_LANE_OFFSET_M = 0.49;
export const BELT_CURVE_INNER_RADIUS_M = CAPYTORIO_TILE_SIZE * 0.5 - BELT_LANE_OFFSET_M; // 0.76m
export const BELT_CURVE_OUTER_RADIUS_M = CAPYTORIO_TILE_SIZE * 0.5 + BELT_LANE_OFFSET_M; // 1.74m
export const BELT_CURVE_INNER_ARC_M = (Math.PI * 0.5) * BELT_CURVE_INNER_RADIUS_M; // ~1.194m
export const BELT_CURVE_OUTER_ARC_M = (Math.PI * 0.5) * BELT_CURVE_OUTER_RADIUS_M; // ~2.733m

// Canonical Factorio belt capacity: 4 items per lane = 8 items per straight tile (0.625 m slot pitch)
export const CAPYTORIO_BELT_ITEMS_PER_LANE = 4;
export const CAPYTORIO_BELT_MAX_ITEMS_PER_TILE = CAPYTORIO_BELT_ITEMS_PER_LANE * 2;
export const CAPYTORIO_BELT_ITEM_SPACING_M = CAPYTORIO_TILE_SIZE / CAPYTORIO_BELT_ITEMS_PER_LANE; // 0.625m
export const CAPYTORIO_BELT_HALF_ITEM_M = CAPYTORIO_BELT_ITEM_SPACING_M * 0.5; // 0.3125m

export const MAX_CAPYTORIO_SPILLED_ITEMS = 160;
export const CAPYTORIO_BELT_SURFACE_Y = 0.28;

export interface CapytorioBeltItem {
  uid?: number;
  item: CapytorioItemId;
  progress: number; // 0..1 along tile direction (straight or curve arc)
  lane?: 0 | 1; // 0 = left track (-X local), 1 = right track (+X local)
  squish?: number; // Legacy field retained as 0 for save compatibility (items stay rigid on belts)
  edgeProgress?: number; // 0..1 overhang progress off an open belt end (when beltEndSpillEnabled)
}

export interface CapytorioSpilledItem {
  uid: number;
  item: CapytorioItemId;
  lx: number; // Local X relative to CAPYTORIO_WORLD_ORIGIN_X
  y: number; // World height above Capytorio ground plane (0 = resting on meadow)
  lz: number; // Local Z relative to CAPYTORIO_WORLD_ORIGIN_Z
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vrz: number;
  squish: number; // 0..1 elastic landing bounce squish
  settled: boolean;
  ageSec: number;
}

export type CapytorioSplitterPriority = 'left' | 'none' | 'right';
export type CapytorioInserterFilterMode = 'whitelist' | 'blacklist';

export interface CapytorioEntitySettingsClipboard {
  sourceType: 'assembler' | 'splitter' | 'inserter' | 'chest';
  sourceLabel: string;
  recipeId?: CapytorioRecipeId;
  splitterInputPriority?: CapytorioSplitterPriority;
  splitterOutputPriority?: CapytorioSplitterPriority;
  splitterFilterItem?: CapytorioItemId | null;
  inserterFilterMode?: CapytorioInserterFilterMode;
  inserterFilters?: CapytorioItemId[];
  inserterStackLimit?: number | null;
  chestSlotLimit?: number | null;
}

export interface CapytorioCraftQueueItem {
  uid: number;
  kind: 'recipe' | 'machine';
  recipeId?: CapytorioRecipeId;
  machineType?: CapytorioMachineType;
  resultId: string;
  resultName: string;
  resultCountPerBatch: number;
  batchesTotal: number;
  batchesRemaining: number;
  craftTimeSec: number;
  progress: number;
  isIntermediate: boolean;
  parentUid?: number;
  reservedPerBatch: Array<{ item: CapytorioItemId; count: number }>;
}

export interface CapytorioMachine {
  id: number;
  type: CapytorioMachineType;
  variantItemId?: CapytorioItemId;
  tierMult?: number;
  gx: number;
  gz: number;
  dir: CapytorioDirection;
  recipeId?: CapytorioRecipeId;
  craftProgress: number;
  productivityProgress: number;
  fuelTimer: number;
  armSwing: number; // 0 (pickup side) .. 1 (drop side) inserter visual arm progress
  armExtend?: number; // 0..1 inserter reach/retract extension
  inserterPhase?: CapytorioInserterPhase;
  pickupLane?: 0 | 1;
  pickupLocalX?: number;
  pickupLocalZ?: number;
  dropLocalX?: number;
  dropLocalZ?: number;
  targetBeltUid?: number;
  holdingItem: CapytorioItemId | null;
  splitterToggle: number;
  splitterInputToggle?: number;
  splitterInputPriority?: CapytorioSplitterPriority;
  splitterOutputPriority?: CapytorioSplitterPriority;
  splitterFilterItem?: CapytorioItemId | null;
  inserterFilterMode?: CapytorioInserterFilterMode;
  inserterFilters?: CapytorioItemId[];
  inserterStackLimit?: number | null;
  chestSlotLimit?: number | null;
  modules?: CapytorioItemId[];
  integrity?: number; // 0..100 structural condition (restored by repair_pack)
  overclockTimer?: number; // Seconds of +20% maintenance tune-up boost from repair_pack
  inputBuffer: Partial<Record<CapytorioItemId, number>>;
  outputBuffer: Partial<Record<CapytorioItemId, number>>;
  beltItems: CapytorioBeltItem[];
}

export interface CapytorioResourceTile {
  gx: number;
  gz: number;
  resource: CapytorioItemId;
  richness: number;
}

export interface CapytorioMilestoneStatus {
  id: string;
  label: string;
  hint: string;
  completed: boolean;
}

export interface CapytorioSerializedState {
  version: 1;
  machines: Array<{
    type: CapytorioMachineType;
    variantItemId?: CapytorioItemId;
    tierMult?: number;
    gx: number;
    gz: number;
    dir: CapytorioDirection;
    recipeId?: CapytorioRecipeId;
    splitterInputPriority?: CapytorioSplitterPriority;
    splitterOutputPriority?: CapytorioSplitterPriority;
    splitterFilterItem?: CapytorioItemId | null;
    inserterFilterMode?: CapytorioInserterFilterMode;
    inserterFilters?: CapytorioItemId[];
    inserterStackLimit?: number | null;
    chestSlotLimit?: number | null;
    modules?: CapytorioItemId[];
    integrity?: number;
    inputBuffer?: Partial<Record<CapytorioItemId, number>>;
    outputBuffer?: Partial<Record<CapytorioItemId, number>>;
    beltItems?: Array<{
      item: CapytorioItemId;
      progress: number;
      lane?: 0 | 1;
      squish?: number;
      edgeProgress?: number;
    }>;
  }>;
  spilledItems?: Array<{
    item: CapytorioItemId;
    lx: number;
    y: number;
    lz: number;
    ry?: number;
  }>;
  depletions: Array<[string, number]>;
  harvestedTrees?: string[];
  recentTools?: string[];
  pocketItems: Partial<Record<CapytorioItemId, number>>;
  pocketMachines: Partial<Record<CapytorioMachineType, number>>;
  unlockedTechs: CapytorioTechId[];
  activeTechId: CapytorioTechId | null;
  techDelivered: Partial<Record<CapytorioItemId, number>>;
  completedMilestones?: string[];
  blueprintLibrary?: CapytorioSavedBlueprint[];
  altModeEnabled?: boolean;
  rocketLaunches: number;
  totalProduced: number;
  score: number;
}

export interface CapytorioTileItemCount {
  item: CapytorioItemId;
  count: number;
}

export interface CapytorioInspectedMachineDetail {
  gx: number;
  gz: number;
  width: number;
  height: number;
  type: CapytorioMachineType;
  variantItemId?: CapytorioItemId;
  name: string;
  shortName: string;
  dir: CapytorioDirection;
  tierMult: number;
  colorHex: number;
  status: 'Working' | 'Idle' | 'No Power' | 'No Fuel' | 'Full' | 'No Resource';
  powerDemandMw: number;
  powerSupplyMw: number;
  recipeId?: CapytorioRecipeId;
  recipeName?: string;
  craftProgress: number;
  fuelTimer: number;
  holdingItem: CapytorioItemId | null;
  splitterInputPriority?: CapytorioSplitterPriority;
  splitterOutputPriority?: CapytorioSplitterPriority;
  splitterFilterItem?: CapytorioItemId | null;
  inserterFilterMode?: CapytorioInserterFilterMode;
  inserterFilters?: CapytorioItemId[];
  inserterStackLimit?: number | null;
  inserterMaxStack?: number;
  inserterReach?: 1 | 2;
  chestSlotLimit?: number | null;
  chestCapacityItems?: number;
  inputTotal: number;
  outputTotal: number;
  inputBuffer: Partial<Record<CapytorioItemId, number>>;
  outputBuffer: Partial<Record<CapytorioItemId, number>>;
  beltItemCount: number;
  beltCapacity: number;
  beltLeftLaneCount: number;
  beltRightLaneCount: number;
  beltLeftLaneCapacity: number;
  beltRightLaneCapacity: number;
  beltCurveShape: CapytorioBeltCurveShape;
  beltSpeedItemsPerSec: number;
  beltItemsByType: CapytorioTileItemCount[];
  moduleSlots?: number;
  modules?: CapytorioItemId[];
  integrity?: number;
  overclockTimer?: number;
  roboportFleetCount?: number;
}

export type CapytorioTileInspectionKind =
  | 'machine'
  | 'resource'
  | 'tree'
  | 'spilled'
  | 'beacon'
  | 'terrain';

export interface CapytorioTileInspection {
  gx: number;
  gz: number;
  key: string;
  primaryKind: CapytorioTileInspectionKind;
  title: string;
  subtitle: string;
  machine: CapytorioInspectedMachineDetail | null;
  resource: {
    id: CapytorioItemId;
    name: string;
    shortName: string;
    remaining: number;
    cssColor: string;
    harvestAmount: number;
  } | null;
  tree: {
    name: string;
    yieldItem: CapytorioItemId;
    yieldCount: number;
  } | null;
  spilledItems: CapytorioTileItemCount[];
  spilledTotalCount: number;
  isBeacon: boolean;
  terrainName: string;
  actionHint: string;
}

export type CapytorioClipboardToolState = 'off' | 'select_copy' | 'select_cut' | 'paste';
export type CapytorioSelectionShape = 'box' | 'lasso';

export interface CapytorioBlueprintEntry {
  dx: number;
  dz: number;
  toolId: string;
  baseType: CapytorioMachineType;
  dir: CapytorioDirection;
  recipeId?: CapytorioRecipeId;
  splitterInputPriority?: CapytorioSplitterPriority;
  splitterOutputPriority?: CapytorioSplitterPriority;
  splitterFilterItem?: CapytorioItemId | null;
  inserterFilterMode?: CapytorioInserterFilterMode;
  inserterFilters?: CapytorioItemId[];
  inserterStackLimit?: number | null;
  chestSlotLimit?: number | null;
}

export interface CapytorioSavedBlueprint {
  id: string;
  label: string;
  sourceMode: 'copy' | 'cut' | 'import' | 'preset';
  createdAt: number;
  width: number;
  height: number;
  entries: CapytorioBlueprintEntry[];
}

export interface CapytorioBlueprintClipboard {
  mode: 'copy' | 'cut';
  entries: CapytorioBlueprintEntry[];
  canUndoCut: boolean;
  blueprintId?: string | null;
  label?: string;
}

export interface CapytorioBlueprintPlacementCheck {
  entry: CapytorioBlueprintEntry;
  gx: number;
  gz: number;
  valid: boolean;
  reason?: 'occupied' | 'needs_ore' | 'no_stock';
}

export interface CapytorioMachineUndoSnapshot {
  gx: number;
  gz: number;
  toolId: string;
  baseType: CapytorioMachineType;
  dir: CapytorioDirection;
  recipeId?: CapytorioRecipeId;
  splitterInputPriority?: CapytorioSplitterPriority;
  splitterOutputPriority?: CapytorioSplitterPriority;
  splitterFilterItem?: CapytorioItemId | null;
  inserterFilterMode?: CapytorioInserterFilterMode;
  inserterFilters?: CapytorioItemId[];
  inserterStackLimit?: number | null;
  chestSlotLimit?: number | null;
  inputBuffer: Partial<Record<CapytorioItemId, number>>;
  outputBuffer: Partial<Record<CapytorioItemId, number>>;
  beltItems: CapytorioBeltItem[];
  holdingItem: CapytorioItemId | null;
}

export interface CapytorioTileDelta {
  gx: number;
  gz: number;
  before: CapytorioMachineUndoSnapshot | null;
  after: CapytorioMachineUndoSnapshot | null;
}

export interface CapytorioHistoryEntry {
  label: string;
  deltas: CapytorioTileDelta[];
}

export interface CapytorioUiSnapshot {
  machineCount: number;
  powerSupplyMw: number;
  powerDemandMw: number;
  powerEfficiency: number;
  selectedTool: string;
  selectedDir: CapytorioDirection;
  selectedRecipeId: CapytorioRecipeId;
  recentTools: string[];
  harvestedTreeCount: number;
  inspectedMachine: {
    gx: number;
    gz: number;
    type: CapytorioMachineType;
    variantItemId?: CapytorioItemId;
    dir: CapytorioDirection;
    recipeId?: CapytorioRecipeId;
    craftProgress: number;
    fuelTimer: number;
    beltItemCount: number;
    inputTotal: number;
    outputTotal: number;
    inputBuffer: Partial<Record<CapytorioItemId, number>>;
    outputBuffer: Partial<Record<CapytorioItemId, number>>;
    holdingItem: CapytorioItemId | null;
  } | null;
  inspectedTile: CapytorioTileInspection | null;
  hoveredTileInfo: CapytorioTileInspection;
  hoveredTile: {
    gx: number;
    gz: number;
    resource: CapytorioItemId | null;
    resourceAmount: number;
    hasTree: boolean;
    machineType: CapytorioMachineType | null;
    variantItemId?: CapytorioItemId;
  };
  pocketItems: Partial<Record<CapytorioItemId, number>>;
  pocketMachines: Partial<Record<CapytorioMachineType, number>>;
  activeTechId: CapytorioTechId | null;
  activeTechName: string;
  activeTechProgress: number;
  unlockedTechs: CapytorioTechId[];
  unlockedRecipes: CapytorioRecipeId[];
  rocketLaunches: number;
  totalProduced: number;
  score: number;
  craftSpeedBonus: number;
  beltSpeedMultiplier: number;
  productivityBonus: number;
  milestones: CapytorioMilestoneStatus[];
  milestonesCompletedCount: number;
  spilledItemCount: number;
  beltEndSpillEnabled: boolean;
  clipboard: {
    toolState: CapytorioClipboardToolState;
    selectionShape: CapytorioSelectionShape;
    mode: 'copy' | 'cut' | null;
    count: number;
    canUndoCut: boolean;
    previewCount: number;
    activeBlueprintId: string | null;
    activeBlueprintLabel: string | null;
    libraryCount: number;
    hasRememberedSelection: boolean;
    pasteAnchor: { gx: number; gz: number } | null;
  };
  history: {
    canUndo: boolean;
    canRedo: boolean;
    undoCount: number;
    redoCount: number;
    nextUndoLabel: string | null;
    nextRedoLabel: string | null;
  };
  blueprintLibrary: CapytorioSavedBlueprint[];
  presetBlueprints: CapytorioSavedBlueprint[];
  altModeEnabled: boolean;
  entitySettingsClipboard: {
    sourceType: 'assembler' | 'splitter' | 'inserter' | 'chest';
    sourceLabel: string;
  } | null;
  craftingQueue: Array<{
    uid: number;
    kind: 'recipe' | 'machine';
    resultId: string;
    resultName: string;
    remainingCount: number;
    batchesRemaining: number;
    progress: number;
    isIntermediate: boolean;
  }>;
}

export interface CapytorioStepCallbacks {
  onTechCompleted?: (
    techId: CapytorioTechId,
    techName: string,
    rewardDna: number,
    rewardCoins: number,
    isRocketLaunch: boolean
  ) => void;
  onMilestoneItem?: (itemId: CapytorioItemId, count: number) => void;
  onMilestoneCompleted?: (id: string, label: string, rewardCoins: number) => void;
  onCraftQueueCompleted?: (itemId: CapytorioItemId, count: number) => void;
  onScoreChanged?: (score: number) => void;
}

export const DIR_DX: readonly [number, number, number, number] = [0, 1, 0, -1];
export const DIR_DZ: readonly [number, number, number, number] = [-1, 0, 1, 0];
const _inserterPoseScratch: [number, number, number] = [0, 0, 0];

export function tileKey(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

export function worldToCapytorioGridX(wx: number): number {
  return Math.round((wx - CAPYTORIO_WORLD_ORIGIN_X) / CAPYTORIO_TILE_SIZE);
}

export function worldToCapytorioGridZ(wz: number): number {
  return Math.round((wz - CAPYTORIO_WORLD_ORIGIN_Z) / CAPYTORIO_TILE_SIZE);
}

export function capytorioGridToWorldX(gx: number): number {
  return CAPYTORIO_WORLD_ORIGIN_X + gx * CAPYTORIO_TILE_SIZE;
}

export function capytorioGridToWorldZ(gz: number): number {
  return CAPYTORIO_WORLD_ORIGIN_Z + gz * CAPYTORIO_TILE_SIZE;
}

export function capytorioMachineCenterWorldX(gx: number, width: number = 1): number {
  return CAPYTORIO_WORLD_ORIGIN_X + (gx + (width - 1) * 0.5) * CAPYTORIO_TILE_SIZE;
}

export function capytorioMachineCenterWorldZ(gz: number, height: number = 1): number {
  return CAPYTORIO_WORLD_ORIGIN_Z + (gz + (height - 1) * 0.5) * CAPYTORIO_TILE_SIZE;
}

export function capytorioMachineCenterLocalX(gx: number, width: number = 1): number {
  return (gx + (width - 1) * 0.5) * CAPYTORIO_TILE_SIZE;
}

export function capytorioMachineCenterLocalZ(gz: number, height: number = 1): number {
  return (gz + (height - 1) * 0.5) * CAPYTORIO_TILE_SIZE;
}

export function getCapytorioToolFootprint(
  toolId: string,
  dir: CapytorioDirection = 0
): { width: number; height: number } {
  const spec = resolveCapytorioPlaceableSpec(toolId);
  if (!spec) return { width: 1, height: 1 };
  return getCapytorioFootprint(spec.baseType, spec.isBaseMachine ? undefined : spec.id, dir);
}

/**
 * Maps a cursor-hovered tile `(hoveredGx, hoveredGz)` to the centered top-left placement anchor
 * for any multi-tile building (so 3x3 centers directly on the hovered tile, 2x2 / 2x1 include it cleanly).
 */
export function getCapytorioPlacementAnchor(
  hoveredGx: number,
  hoveredGz: number,
  toolId: string,
  dir: CapytorioDirection = 0
): { gx: number; gz: number; width: number; height: number } {
  const fp = getCapytorioToolFootprint(toolId, dir);
  return {
    gx: hoveredGx - Math.floor((fp.width - 1) * 0.5),
    gz: hoveredGz - Math.floor((fp.height - 1) * 0.5),
    width: fp.width,
    height: fp.height,
  };
}

function isBeltLineFeederType(type: CapytorioMachineType): boolean {
  return type === 'belt' || type === 'splitter' || type === 'tunnel';
}

/**
 * Factorio-accurate orthogonal belt neighbor evaluation:
 * - A transport belt curves 90° ONLY when fed from a single perpendicular side (left OR right)
 *   AND not fed straight from behind (`!backFeed && (leftFeed !== rightFeed)`).
 * - Adding a straight back belt or an opposite side belt dynamically straightens it into a T-merge.
 */
export function getBeltCurveShape(
  machines: ReadonlyMap<string, CapytorioMachine>,
  m: CapytorioMachine
): CapytorioBeltCurveShape {
  if (m.type !== 'belt') return 'straight';
  const fwdDx = DIR_DX[m.dir];
  const fwdDz = DIR_DZ[m.dir];
  const rightDx = -fwdDz;
  const rightDz = fwdDx;

  const backNb = machines.get(tileKey(m.gx - fwdDx, m.gz - fwdDz));
  const backFeed = Boolean(
    backNb &&
      isBeltLineFeederType(backNb.type) &&
      DIR_DX[backNb.dir] === fwdDx &&
      DIR_DZ[backNb.dir] === fwdDz
  );
  if (backFeed) return 'straight';

  const leftNb = machines.get(tileKey(m.gx - rightDx, m.gz - rightDz));
  const leftFeed = Boolean(
    leftNb &&
      isBeltLineFeederType(leftNb.type) &&
      DIR_DX[leftNb.dir] === rightDx &&
      DIR_DZ[leftNb.dir] === rightDz
  );

  const rightNb = machines.get(tileKey(m.gx + rightDx, m.gz + rightDz));
  const rightFeed = Boolean(
    rightNb &&
      isBeltLineFeederType(rightNb.type) &&
      DIR_DX[rightNb.dir] === -rightDx &&
      DIR_DZ[rightNb.dir] === -rightDz
  );

  if (leftFeed && !rightFeed) return 'curve_from_left';
  if (rightFeed && !leftFeed) return 'curve_from_right';
  return 'straight';
}

export function getBeltLaneArcMeters(curve: CapytorioBeltCurveShape, lane: 0 | 1): number {
  if (curve === 'curve_from_left') {
    return lane === 0 ? BELT_CURVE_INNER_ARC_M : BELT_CURVE_OUTER_ARC_M;
  }
  if (curve === 'curve_from_right') {
    return lane === 0 ? BELT_CURVE_OUTER_ARC_M : BELT_CURVE_INNER_ARC_M;
  }
  return CAPYTORIO_TILE_SIZE;
}

/**
 * Exact Factorio-proportional item capacity for a single belt lane:
 * - Straight belt tile: 4 items per lane (8 total per tile)
 * - 90° curved belt inner arc: 2 items
 * - 90° curved belt outer arc: 4 items
 */
export function getBeltLaneCapacity(curve: CapytorioBeltCurveShape, lane: 0 | 1): number {
  const arcMeters = getBeltLaneArcMeters(curve, lane);
  return Math.max(2, Math.floor(arcMeters / CAPYTORIO_BELT_ITEM_SPACING_M + 0.15));
}

/**
 * Evaluates local tile pose `[localX, localZ, tangentYawOffsetRad]` in a machine's local
 * coordinate frame (where forward exit is `-Z`, rear entrance is `+Z`, left is `-X`, right is `+X`)
 * with zero heap allocations.
 */
export function evalBeltItemLocalPose(
  curve: CapytorioBeltCurveShape,
  lane: 0 | 1,
  progress: number,
  outPose: [number, number, number]
): void {
  const halfTile = CAPYTORIO_TILE_SIZE * 0.5;
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;

  if (curve === 'straight') {
    outPose[0] = lane === 1 ? BELT_LANE_OFFSET_M : -BELT_LANE_OFFSET_M;
    outPose[1] = (0.5 - p) * CAPYTORIO_TILE_SIZE;
    outPose[2] = 0;
    return;
  }

  const theta = (1 - p) * (Math.PI * 0.5);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  if (curve === 'curve_from_left') {
    const r = lane === 0 ? BELT_CURVE_INNER_RADIUS_M : BELT_CURVE_OUTER_RADIUS_M;
    outPose[0] = -halfTile + r * cosT;
    outPose[1] = -halfTile + r * sinT;
    outPose[2] = -theta; // At p=0 (theta=PI/2), heading East (+X) = -PI/2; exits -Z = 0
    return;
  }

  // 'curve_from_right'
  const r = lane === 0 ? BELT_CURVE_OUTER_RADIUS_M : BELT_CURVE_INNER_RADIUS_M;
  outPose[0] = halfTile - r * cosT;
  outPose[1] = -halfTile + r * sinT;
  outPose[2] = theta; // At p=0 (theta=PI/2), heading West (-X) = +PI/2; exits -Z = 0
}

// Terrain generation, hydrology, ore veins, and tree sampling live in ./capytorio/CapytorioTerrainGen.ts
// and are re-exported above to preserve 100% backwards-compatible imports.

function getDefaultTechId(): CapytorioTechId | null {
  return CAPYTORIO_TECHS[0]?.id ?? null;
}

function getDefaultAssemblerRecipeId(): CapytorioRecipeId {
  const ironGear = RECIPE_BY_ID.get('iron_gear');
  if (ironGear && ironGear.station === 'assembler' && ironGear.unlockedByDefault) {
    return ironGear.id;
  }
  for (let i = 0; i < CAPYTORIO_RECIPES.length; i++) {
    const r = CAPYTORIO_RECIPES[i];
    if (r.station === 'assembler' && r.unlockedByDefault) return r.id;
  }
  return CAPYTORIO_RECIPES[0]?.id ?? 'iron_gear';
}

export interface CapytorioModuleModifiers {
  speedMult: number;
  powerMult: number;
  prodBonus: number;
}

const _moduleModScratch: CapytorioModuleModifiers = {
  speedMult: 1,
  powerMult: 1,
  prodBonus: 0,
};

export function isCapytorioModuleItem(itemId: string): boolean {
  return (
    itemId === 'speed_module' ||
    itemId === 'speed_module_2' ||
    itemId === 'efficiency_module' ||
    itemId === 'efficiency_module_2' ||
    itemId === 'productivity_module' ||
    itemId === 'productivity_module_2'
  );
}

function accumulateSingleModuleEffect(
  modId: string,
  scale: number,
  acc: CapytorioModuleModifiers
): void {
  if (modId === 'speed_module') {
    acc.speedMult += 0.3 * scale;
    acc.powerMult += 0.2 * scale;
  } else if (modId === 'speed_module_2') {
    acc.speedMult += 0.5 * scale;
    acc.powerMult += 0.3 * scale;
  } else if (modId === 'efficiency_module') {
    acc.powerMult -= 0.3 * scale;
  } else if (modId === 'efficiency_module_2') {
    acc.powerMult -= 0.5 * scale;
  } else if (modId === 'productivity_module') {
    acc.prodBonus += 0.15 * scale;
    acc.powerMult += 0.25 * scale;
    acc.speedMult -= 0.05 * scale;
  } else if (modId === 'productivity_module_2') {
    acc.prodBonus += 0.25 * scale;
    acc.powerMult += 0.35 * scale;
    acc.speedMult -= 0.1 * scale;
  }
}

export class CapytorioFactoryEngine {
  /** Primary machine map keyed by top-left anchor `tileKey(m.gx, m.gz)` */
  public readonly machines = new Map<string, CapytorioMachine>();
  /** O(1) multi-tile spatial lookup mapping EVERY occupied sub-tile `tileKey(tx, tz)` to its owning machine */
  public readonly occupancyGrid = new Map<string, CapytorioMachine>();
  private readonly oreRemainingOverrides = new Map<string, number>();
  private readonly harvestedTrees = new Set<string>();
  private readonly pocketItems: Partial<Record<CapytorioItemId, number>> = {};
  private readonly pocketMachines: Partial<Record<CapytorioMachineType, number>> = {};
  private readonly unlockedTechs = new Set<CapytorioTechId>();
  private readonly completedMilestones = new Set<string>();
  private activeTechId: CapytorioTechId | null = getDefaultTechId();
  private techDelivered: Partial<Record<CapytorioItemId, number>> = {};
  private recentTools: string[] = [...CAPYTORIO_HOTBAR_ORDER];

  private nextMachineId = 1;
  private nextBeltItemUid = 1;
  private rocketLaunches = 0;
  private totalProduced = 0;
  private score = 0;
  private lastReportedScore = 0;

  // Deterministic synchronized conveyor surface phase (advanced strictly with clampedDt * beltRate)
  public beltScrollPhase = 0;

  // Player build tool state
  public selectedTool: string = 'drill';
  public selectedDir: CapytorioDirection = 1; // East (+X) by default
  public selectedRecipeId: CapytorioRecipeId = getDefaultAssemblerRecipeId();
  public hoveredGx = 0;
  public hoveredGz = 0;
  public inspectedKey: string | null = null;
  public inspectedTile: { gx: number; gz: number } | null = null;

  // Alt-Mode 3D overlay toggle (defaults ON so factories are readable immediately)
  public altModeEnabled = true;

  // Entity Settings Copy/Paste clipboard (Shift+RMB / Shift+LMB)
  public entitySettingsClipboard: CapytorioEntitySettingsClipboard | null = null;

  // Real-time recursive hand-crafting queue
  public readonly craftingQueue: CapytorioCraftQueueItem[] = [];
  private nextCraftQueueUid = 1;

  // Multi-building Cut / Copy / Paste Blueprint Clipboard & 100-entry Blueprint Library
  public clipboardToolState: CapytorioClipboardToolState = 'off';
  public selectionShape: CapytorioSelectionShape = 'box';
  public clipboard: CapytorioBlueprintClipboard | null = null;
  public pasteAnchor: { gx: number; gz: number } | null = null;
  public blueprintLibrary: CapytorioSavedBlueprint[] = [];
  public readonly presetBlueprints: CapytorioSavedBlueprint[] = [createSampleStarterMallBlueprint()];
  public activeBlueprintId: string | null = null;
  private nextBlueprintUid = 1;
  public readonly previewSelectedKeys = new Set<string>();
  private undoCutSnapshot: CapytorioMachineUndoSnapshot[] = [];

  // Full building action Undo / Redo history stack
  private undoStack: CapytorioHistoryEntry[] = [];
  private redoStack: CapytorioHistoryEntry[] = [];
  private activeHistoryBatch: { label: string; deltas: CapytorioTileDelta[] } | null = null;
  private isReplayingHistory = false;

  // Power metrics (zero-allocation cached scalars updated every step)
  public powerSupplyMw = 0;
  public powerDemandMw = 0;
  public powerEfficiency = 1.0;

  // External ProceduralGameConfig / progression multipliers
  public configCraftSpeedMult = 1.0;
  public configBeltSpeedMult = 1.0;
  public configOreRichnessMult = 1.0;
  public beltEndSpillEnabled = false;
  public readonly spilledItems: CapytorioSpilledItem[] = [];
  private nextSpilledItemUid = 1;

  // Reusable ordered snapshot list for zero-allocation iteration inside step()
  private machineStepList: CapytorioMachine[] = [];
  private machineListDirty = true;
  /** Monotonic revision incremented on machine placement/demolish/rotate, tree harvest, ore depletion, reset, or hydrate */
  public topologyRevision = 1;

  // Dirty-tracking state to avoid redundant 60 Hz recomputations & allocations
  private powerDirty = true;
  private lastPowerTopologyRevision = -1;
  private lastPowerBiofluxUnlocked = false;
  private lastActiveGeneratorCount = -1;
  private lastMilestoneTopoRev = -1;
  private lastMilestoneTotalProduced = -1;
  private lastMilestoneUnlockedCount = -1;
  private lastMilestoneRocketLaunches = -1;
  private lastMilestoneOreCount = -1;
  private lastMilestoneSciCount = -1;
  private lastMilestoneHasTechDelivered = false;
  private lastMilestoneActiveGenerators = -1;
  private spilledSeparationDirty = false;

  // Cached zero-allocation subsystem host adapters
  private readonly craftingQueueHost: CapytorioCraftingQueueHost;
  private readonly blueprintHost: CapytorioBlueprintHost;
  private readonly serializerHost: CapytorioSerializerHost;

  constructor(initialState?: CapytorioSerializedState | null) {
    const self = this;
    this.craftingQueueHost = {
      pocketItems: this.pocketItems,
      pocketMachines: this.pocketMachines,
      craftingQueue: this.craftingQueue,
      get totalProduced() {
        return self.totalProduced;
      },
      set totalProduced(v: number) {
        self.totalProduced = v;
      },
      get score() {
        return self.score;
      },
      set score(v: number) {
        self.score = v;
      },
      allocateCraftQueueUid: () => this.nextCraftQueueUid++,
      isRecipeUnlocked: (recipeId) => this.isRecipeUnlocked(recipeId),
      addPocketItem: (item, count) => this.addPocketItem(item, count),
      consumePocketItem: (item, count) => this.consumePocketItem(item, count),
      recordRecentTool: (toolId) => this.recordRecentTool(toolId),
      getCraftSpeedMultiplier: () => this.getCraftSpeedMultiplier(),
    };

    this.blueprintHost = {
      machines: this.machines,
      pocketItems: this.pocketItems,
      pocketMachines: this.pocketMachines,
      presetBlueprints: this.presetBlueprints,
      previewSelectedKeys: this.previewSelectedKeys,
      get clipboardToolState() {
        return self.clipboardToolState;
      },
      set clipboardToolState(v) {
        self.clipboardToolState = v;
      },
      get clipboard() {
        return self.clipboard;
      },
      set clipboard(v) {
        self.clipboard = v;
      },
      get pasteAnchor() {
        return self.pasteAnchor;
      },
      set pasteAnchor(v) {
        self.pasteAnchor = v;
      },
      get blueprintLibrary() {
        return self.blueprintLibrary;
      },
      set blueprintLibrary(v) {
        self.blueprintLibrary = v;
      },
      get activeBlueprintId() {
        return self.activeBlueprintId;
      },
      set activeBlueprintId(v) {
        self.activeBlueprintId = v;
      },
      get undoCutSnapshot() {
        return self.undoCutSnapshot;
      },
      set undoCutSnapshot(v) {
        self.undoCutSnapshot = v;
      },
      allocateBlueprintUid: () => this.nextBlueprintUid++,
      getMachineFootprint: (m) => this.getMachineFootprint(m),
      getMachineAt: (gx, gz) => this.getMachineAt(gx, gz),
      canFootprintFit: (gx, gz, width, height, ignoreMachine, allowWater) =>
        this.canFootprintFit(gx, gz, width, height, ignoreMachine, allowWater),
      findFirstOreInFootprint: (gx, gz, width, height) =>
        this.findFirstOreInFootprint(gx, gz, width, height),
      selectBlueprintFromLibrary: (id) => this.selectBlueprintFromLibrary(id),
      beginHistoryBatch: (label) => this.beginHistoryBatch(label),
      commitHistoryBatch: (overrideLabel) => this.commitHistoryBatch(overrideLabel),
      placeMachine: (toolOrType, gx, gz, dir, recipeId) =>
        this.placeMachine(toolOrType, gx, gz, dir, recipeId),
      setAssemblerRecipeAt: (gx, gz, recipeId) => this.setAssemblerRecipeAt(gx, gz, recipeId),
      applyConfigSnapshotToMachine: (m, src) => this.applyConfigSnapshotToMachine(m, src),
    };

    this.serializerHost = {
      machines: this.machines,
      occupancyGrid: this.occupancyGrid,
      spilledItems: this.spilledItems,
      oreRemainingOverrides: this.oreRemainingOverrides,
      harvestedTrees: this.harvestedTrees,
      pocketItems: this.pocketItems,
      pocketMachines: this.pocketMachines,
      unlockedTechs: this.unlockedTechs,
      completedMilestones: this.completedMilestones,
      craftingQueue: this.craftingQueue,
      get recentTools() {
        return self.recentTools;
      },
      set recentTools(v) {
        self.recentTools = v;
      },
      get activeTechId() {
        return self.activeTechId;
      },
      set activeTechId(v) {
        self.activeTechId = v;
      },
      get techDelivered() {
        return self.techDelivered;
      },
      set techDelivered(v) {
        self.techDelivered = v;
      },
      get blueprintLibrary() {
        return self.blueprintLibrary;
      },
      set blueprintLibrary(v) {
        self.blueprintLibrary = v;
      },
      get activeBlueprintId() {
        return self.activeBlueprintId;
      },
      set activeBlueprintId(v) {
        self.activeBlueprintId = v;
      },
      get altModeEnabled() {
        return self.altModeEnabled;
      },
      set altModeEnabled(v) {
        self.altModeEnabled = v;
      },
      get rocketLaunches() {
        return self.rocketLaunches;
      },
      set rocketLaunches(v) {
        self.rocketLaunches = v;
      },
      get totalProduced() {
        return self.totalProduced;
      },
      set totalProduced(v) {
        self.totalProduced = v;
      },
      get score() {
        return self.score;
      },
      set score(v) {
        self.score = v;
      },
      get lastReportedScore() {
        return self.lastReportedScore;
      },
      set lastReportedScore(v) {
        self.lastReportedScore = v;
      },
      get pasteAnchor() {
        return self.pasteAnchor;
      },
      set pasteAnchor(v) {
        self.pasteAnchor = v;
      },
      get undoStack() {
        return self.undoStack;
      },
      set undoStack(v) {
        self.undoStack = v;
      },
      get redoStack() {
        return self.redoStack;
      },
      set redoStack(v) {
        self.redoStack = v;
      },
      get activeHistoryBatch() {
        return self.activeHistoryBatch;
      },
      set activeHistoryBatch(v) {
        self.activeHistoryBatch = v as typeof self.activeHistoryBatch;
      },
      get entitySettingsClipboard() {
        return self.entitySettingsClipboard;
      },
      set entitySettingsClipboard(v) {
        self.entitySettingsClipboard = v;
      },
      get topologyRevision() {
        return self.topologyRevision;
      },
      set topologyRevision(v) {
        self.topologyRevision = v;
      },
      allocateMachineId: () => this.nextMachineId++,
      allocateBeltItemUid: () => this.nextBeltItemUid++,
      allocateSpilledItemUid: () => this.nextSpilledItemUid++,
      allocateBlueprintUid: () => this.nextBlueprintUid++,
      getRecentTools: () => this.getRecentTools(),
      registerMachineOccupancy: (m) => this.registerMachineOccupancy(m),
      markHydratedAndRecomputePower: () => {
        this.machineListDirty = true;
        this.powerDirty = true;
        this.recomputePowerMetrics();
      },
    };

    if (initialState && initialState.version === 1) {
      this.hydrate(initialState);
    } else {
      this.resetToBlankStarterField();
    }
  }

  public getMachineFootprint(m: CapytorioMachine): { width: number; height: number } {
    return getCapytorioFootprint(m.type, m.variantItemId, m.dir);
  }

  public getMachineAt(gx: number, gz: number): CapytorioMachine | undefined {
    return this.occupancyGrid.get(tileKey(gx, gz));
  }

  private registerMachineOccupancy(m: CapytorioMachine): void {
    const fp = this.getMachineFootprint(m);
    for (let dx = 0; dx < fp.width; dx++) {
      for (let dz = 0; dz < fp.height; dz++) {
        this.occupancyGrid.set(tileKey(m.gx + dx, m.gz + dz), m);
      }
    }
  }

  private unregisterMachineOccupancy(m: CapytorioMachine): void {
    const fp = this.getMachineFootprint(m);
    for (let dx = 0; dx < fp.width; dx++) {
      for (let dz = 0; dz < fp.height; dz++) {
        const k = tileKey(m.gx + dx, m.gz + dz);
        if (this.occupancyGrid.get(k) === m) {
          this.occupancyGrid.delete(k);
        }
      }
    }
  }

  public canFootprintFit(
    gx: number,
    gz: number,
    width: number,
    height: number,
    ignoreMachine?: CapytorioMachine,
    allowWater: boolean = false
  ): boolean {
    for (let dx = 0; dx < width; dx++) {
      for (let dz = 0; dz < height; dz++) {
        const tx = gx + dx;
        const tz = gz + dz;
        const occ = this.occupancyGrid.get(tileKey(tx, tz));
        if (occ && occ !== ignoreMachine) return false;
        if (!allowWater && isCapytorioWaterTerrain(sampleCapytorioTerrain(tx, tz))) {
          return false;
        }
      }
    }
    return true;
  }

  public findFirstOreInFootprint(
    gx: number,
    gz: number,
    width: number,
    height: number
  ): CapytorioResourceTile | null {
    // Check center tile first, then scan all footprint tiles deterministically
    const cx = gx + Math.floor((width - 1) * 0.5);
    const cz = gz + Math.floor((height - 1) * 0.5);
    const centerOre = this.getResourceAt(cx, cz);
    if (centerOre) return centerOre;
    for (let dx = 0; dx < width; dx++) {
      for (let dz = 0; dz < height; dz++) {
        const ore = this.getResourceAt(gx + dx, gz + dz);
        if (ore) return ore;
      }
    }
    return null;
  }

  public getMachineFrontEjectTile(m: CapytorioMachine): {
    targetGx: number;
    targetGz: number;
    edgeGx: number;
    edgeGz: number;
  } {
    const fp = this.getMachineFootprint(m);
    const midX = m.gx + Math.floor((fp.width - 1) * 0.5);
    const midZ = m.gz + Math.floor((fp.height - 1) * 0.5);
    if (m.dir === 0) {
      return { targetGx: midX, targetGz: m.gz - 1, edgeGx: midX, edgeGz: m.gz };
    }
    if (m.dir === 1) {
      return { targetGx: m.gx + fp.width, targetGz: midZ, edgeGx: m.gx + fp.width - 1, edgeGz: midZ };
    }
    if (m.dir === 2) {
      return { targetGx: midX, targetGz: m.gz + fp.height, edgeGx: midX, edgeGz: m.gz + fp.height - 1 };
    }
    return { targetGx: m.gx - 1, targetGz: midZ, edgeGx: m.gx, edgeGz: midZ };
  }

  /**
   * Returns the canonical Left (side 0) and Right (side 1) sub-tile coordinates of a 2x1 / 1x2 Splitter
   * relative to its forward direction `m.dir`, plus their corresponding forward exit tiles.
   */
  public getSplitterPorts(m: CapytorioMachine): {
    leftGx: number;
    leftGz: number;
    rightGx: number;
    rightGz: number;
    leftOutGx: number;
    leftOutGz: number;
    rightOutGx: number;
    rightOutGz: number;
  } {
    const fwdDx = DIR_DX[m.dir];
    const fwdDz = DIR_DZ[m.dir];
    // For each facing, determine which sub-tile is on the splitter's Left vs Right when looking forward:
    // dir 0 (North, -Z): Left is -X (gx, gz), Right is +X (gx+1, gz)
    // dir 1 (East, +X): Left is -Z (gx, gz), Right is +Z (gx, gz+1)
    // dir 2 (South, +Z): Left is +X (gx+1, gz), Right is -X (gx, gz)
    // dir 3 (West, -X): Left is +Z (gx, gz+1), Right is -Z (gx, gz)
    let leftGx = m.gx;
    let leftGz = m.gz;
    let rightGx = m.gx;
    let rightGz = m.gz;
    if (m.dir === 0) {
      leftGx = m.gx;
      leftGz = m.gz;
      rightGx = m.gx + 1;
      rightGz = m.gz;
    } else if (m.dir === 1) {
      leftGx = m.gx;
      leftGz = m.gz;
      rightGx = m.gx;
      rightGz = m.gz + 1;
    } else if (m.dir === 2) {
      leftGx = m.gx + 1;
      leftGz = m.gz;
      rightGx = m.gx;
      rightGz = m.gz;
    } else {
      leftGx = m.gx;
      leftGz = m.gz + 1;
      rightGx = m.gx;
      rightGz = m.gz;
    }
    return {
      leftGx,
      leftGz,
      rightGx,
      rightGz,
      leftOutGx: leftGx + fwdDx,
      leftOutGz: leftGz + fwdDz,
      rightOutGx: rightGx + fwdDx,
      rightOutGz: rightGz + fwdDz,
    };
  }

  public resetToBlankStarterField(): void {
    this.machines.clear();
    this.occupancyGrid.clear();
    this.spilledItems.length = 0;
    this.oreRemainingOverrides.clear();
    this.harvestedTrees.clear();
    this.craftingQueue.length = 0;
    this.entitySettingsClipboard = null;
    this.altModeEnabled = true;
    this.topologyRevision++;
    for (const k of Object.keys(this.pocketItems) as CapytorioItemId[]) {
      delete this.pocketItems[k];
    }
    for (const m of CAPYTORIO_HOTBAR_ORDER) {
      this.pocketMachines[m] = CAPYTORIO_MACHINE_SPECS[m].starterCount;
    }
    // Generous fun & easy starter kit materials!
    this.pocketItems.iron_plate = 24;
    this.pocketItems.copper_plate = 16;
    this.pocketItems.coal = 16;
    this.pocketItems.iron_gear = 8;

    this.unlockedTechs.clear();
    this.completedMilestones.clear();
    this.activeTechId = getDefaultTechId();
    this.techDelivered = {};
    this.recentTools = [...CAPYTORIO_HOTBAR_ORDER];
    this.beltScrollPhase = 0;
    this.rocketLaunches = 0;
    this.totalProduced = 0;
    this.score = 0;
    this.lastReportedScore = 0;
    this.inspectedKey = null;
    this.inspectedTile = null;
    this.clipboardToolState = 'off';
    this.clipboard = null;
    this.pasteAnchor = null;
    this.blueprintLibrary = [];
    this.activeBlueprintId = null;
    this.previewSelectedKeys.clear();
    this.undoCutSnapshot.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.activeHistoryBatch = null;
    this.selectedTool = 'drill';
    this.selectedDir = 1;
    this.selectedRecipeId = getDefaultAssemblerRecipeId();
    this.machineListDirty = true;
    this.recomputePowerMetrics();
  }

  public getRecentTools(): string[] {
    return this.recentTools.slice(0, MAX_RECENT_CAPYTORIO_TOOLS);
  }

  public recordRecentTool(toolId: string): void {
    if (!resolveCapytorioPlaceableSpec(toolId)) return;
    if (this.recentTools[0] === toolId && this.recentTools.length === MAX_RECENT_CAPYTORIO_TOOLS) {
      return;
    }
    const next: string[] = [toolId];
    for (let i = 0; i < this.recentTools.length && next.length < MAX_RECENT_CAPYTORIO_TOOLS; i++) {
      const existing = this.recentTools[i];
      if (existing !== toolId && resolveCapytorioPlaceableSpec(existing)) {
        next.push(existing);
      }
    }
    for (let i = 0; i < CAPYTORIO_HOTBAR_ORDER.length && next.length < MAX_RECENT_CAPYTORIO_TOOLS; i++) {
      const fallback = CAPYTORIO_HOTBAR_ORDER[i];
      if (!next.includes(fallback)) {
        next.push(fallback);
      }
    }
    this.recentTools = next;
  }

  public equipPlaceableTool(toolId: string, promoteToRecent: boolean = false): boolean {
    if (toolId === 'mine' || toolId === 'demolish') {
      this.selectedTool = toolId;
      return true;
    }
    if (!resolveCapytorioPlaceableSpec(toolId)) return false;
    this.selectedTool = toolId;
    if (promoteToRecent) {
      this.recordRecentTool(toolId);
    }
    return true;
  }

  public hasTreeAt(gx: number, gz: number): boolean {
    const key = tileKey(gx, gz);
    if (this.harvestedTrees.has(key)) return false;
    if (this.occupancyGrid.has(key)) return false;
    return sampleCapytorioTreeAt(gx, gz);
  }

  public harvestTreeAt(gx: number, gz: number): boolean {
    if (!this.hasTreeAt(gx, gz)) return false;
    this.harvestedTrees.add(tileKey(gx, gz));
    this.topologyRevision++;
    this.addPocketItem('orange', 3);
    this.score += 6;
    return true;
  }

  public getResourceAt(gx: number, gz: number): CapytorioResourceTile | null {
    const base = sampleCapytorioBaseResource(gx, gz);
    if (!base) return null;
    const k = tileKey(gx, gz);
    const remaining = this.oreRemainingOverrides.has(k)
      ? this.oreRemainingOverrides.get(k)!
      : Math.round(base.initialAmount * this.configOreRichnessMult);
    if (remaining <= 0) return null;
    return {
      gx,
      gz,
      resource: base.resource,
      richness: remaining,
    };
  }

  private depleteOreAt(gx: number, gz: number, amount: number): CapytorioItemId | null {
    const tile = this.getResourceAt(gx, gz);
    if (!tile) return null;
    const next = Math.max(0, tile.richness - amount);
    this.oreRemainingOverrides.set(tileKey(gx, gz), next);
    if (next <= 0) {
      this.topologyRevision++;
    }
    return tile.resource;
  }

  public getPocketItemCount(id: CapytorioItemId): number {
    return this.pocketItems[id] ?? 0;
  }

  public addPocketItem(id: CapytorioItemId, count: number): void {
    if (count <= 0) return;
    this.pocketItems[id] = (this.pocketItems[id] ?? 0) + count;
  }

  private consumePocketItem(id: CapytorioItemId, count: number): boolean {
    const cur = this.pocketItems[id] ?? 0;
    if (cur < count) return false;
    const next = cur - count;
    if (next <= 0) delete this.pocketItems[id];
    else this.pocketItems[id] = next;
    return true;
  }

  public getPocketMachineCount(type: CapytorioMachineType): number {
    return this.pocketMachines[type] ?? 0;
  }

  public canAffordMachineCraft(type: CapytorioMachineType): boolean {
    const cost = CAPYTORIO_MACHINE_SPECS[type].craftCost;
    for (const [itemId, amt] of Object.entries(cost) as Array<[CapytorioItemId, number]>) {
      if (this.getPocketItemCount(itemId) < amt) return false;
    }
    return true;
  }

  public craftMachineIntoPocket(type: CapytorioMachineType): boolean {
    if (!this.canAffordMachineCraft(type)) return false;
    const cost = CAPYTORIO_MACHINE_SPECS[type].craftCost;
    for (const [itemId, amt] of Object.entries(cost) as Array<[CapytorioItemId, number]>) {
      this.consumePocketItem(itemId, amt);
    }
    this.pocketMachines[type] = (this.pocketMachines[type] ?? 0) + 1;
    this.recordRecentTool(type);
    return true;
  }

  public getPlaceableToolCount(toolId: string): number {
    if (Object.prototype.hasOwnProperty.call(CAPYTORIO_MACHINE_SPECS, toolId)) {
      return this.getPocketMachineCount(toolId as CapytorioMachineType);
    }
    return this.getPocketItemCount(toolId);
  }

  public isRecipeUnlocked(recipeId: CapytorioRecipeId): boolean {
    const rec = RECIPE_BY_ID.get(recipeId);
    if (!rec) return false;
    if (rec.unlockedByDefault) return true;
    return rec.requiredTechId ? this.unlockedTechs.has(rec.requiredTechId) : true;
  }

  public isTechAvailable(techId: CapytorioTechId): boolean {
    const tech = TECH_BY_ID.get(techId);
    if (!tech) return false;
    if (!tech.repeatable && this.unlockedTechs.has(techId)) return false;
    for (let i = 0; i < tech.prerequisites.length; i++) {
      if (!this.unlockedTechs.has(tech.prerequisites[i])) return false;
    }
    return true;
  }

  public selectActiveTech(techId: CapytorioTechId): boolean {
    if (!this.isTechAvailable(techId)) return false;
    if (this.activeTechId !== techId) {
      this.activeTechId = techId;
      this.techDelivered = {};
    }
    return true;
  }

  public getCraftSpeedMultiplier(): number {
    let mult = this.configCraftSpeedMult;
    if (this.unlockedTechs.has('automation_1')) mult *= 1.25;
    if (this.unlockedTechs.has('metallurgy_foundry')) mult *= 1.2;
    return mult;
  }

  public getBeltSpeedTilesPerSec(): number {
    let mult = 1.65 * this.configBeltSpeedMult;
    if (this.unlockedTechs.has('logistics_turbo')) mult *= 1.45;
    return mult;
  }

  public getInserterStackSize(): number {
    if (this.unlockedTechs.has('electromagnetics_stack')) return 3;
    if (this.unlockedTechs.has('logistics_turbo')) return 2;
    return 1;
  }

  public getProductivityBonusFraction(): number {
    let bonus = 0;
    if (this.unlockedTechs.has('metallurgy_foundry')) bonus += 0.25;
    bonus += this.rocketLaunches * 0.15;
    return bonus;
  }

  public canAffordPocketRecipe(recipeId: CapytorioRecipeId): boolean {
    const rec = RECIPE_BY_ID.get(recipeId);
    if (!rec || !rec.pocketCraftable || !this.isRecipeUnlocked(recipeId)) return false;
    for (let i = 0; i < rec.ingredients.length; i++) {
      const ing = rec.ingredients[i];
      if (this.getPocketItemCount(ing.item) < ing.count) return false;
    }
    return true;
  }

  public pocketCraftRecipe(recipeId: CapytorioRecipeId, batches: number = 1): boolean {
    const rec = RECIPE_BY_ID.get(recipeId);
    if (!rec || batches < 1) return false;
    let craftedAny = false;
    for (let b = 0; b < batches; b++) {
      if (!this.canAffordPocketRecipe(recipeId)) break;
      for (let i = 0; i < rec.ingredients.length; i++) {
        this.consumePocketItem(rec.ingredients[i].item, rec.ingredients[i].count);
      }
      if (Object.prototype.hasOwnProperty.call(CAPYTORIO_MACHINE_SPECS, rec.result)) {
        const mType = rec.result as CapytorioMachineType;
        this.pocketMachines[mType] = (this.pocketMachines[mType] ?? 0) + rec.resultCount;
      } else {
        this.addPocketItem(rec.result, rec.resultCount);
      }
      this.totalProduced += rec.resultCount;
      this.score += 5 * rec.resultCount;
      craftedAny = true;
    }
    if (
      craftedAny &&
      (Object.prototype.hasOwnProperty.call(CAPYTORIO_MACHINE_SPECS, rec.result) ||
        CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[rec.result])
    ) {
      this.recordRecentTool(rec.result);
    }
    return craftedAny;
  }

  public toggleAltMode(): boolean {
    this.altModeEnabled = !this.altModeEnabled;
    return this.altModeEnabled;
  }

  public setAltModeEnabled(enabled: boolean): void {
    this.altModeEnabled = enabled;
  }

  public getMaxAffordableCraftBatches(
    kind: 'recipe' | 'machine',
    id: string,
    cap: number = 25
  ): number {
    return getMaxAffordableCraftBatchesInHost(this.craftingQueueHost, kind, id, cap);
  }

  public enqueuePocketCraft(
    recipeId: CapytorioRecipeId,
    batches: number = 1
  ): { ok: boolean; queuedBatches: number; queuedIntermediates: number } {
    return enqueuePocketCraftInHost(this.craftingQueueHost, recipeId, batches);
  }

  public enqueueMachineCraft(
    type: CapytorioMachineType,
    count: number = 1
  ): { ok: boolean; queuedBatches: number; queuedIntermediates: number } {
    return enqueueMachineCraftInHost(this.craftingQueueHost, type, count);
  }

  public cancelCraftQueueItem(uid: number): { ok: boolean; cancelledCount: number } {
    return cancelCraftQueueItemInHost(this.craftingQueueHost, uid);
  }

  private stepCraftingQueue(dt: number, callbacks?: CapytorioStepCallbacks): void {
    stepCraftingQueueInHost(this.craftingQueueHost, dt, callbacks);
  }

  public handMineAt(gx: number, gz: number, yieldCount: number = 2): CapytorioItemId | null {
    const res = this.depleteOreAt(gx, gz, yieldCount);
    if (res) {
      this.addPocketItem(res, yieldCount);
      this.score += 2 * yieldCount;
      return res;
    }
    if (this.harvestTreeAt(gx, gz)) {
      return 'orange';
    }
    return null;
  }

  public placeMachine(
    toolOrType: string,
    gx: number,
    gz: number,
    dir: CapytorioDirection = this.selectedDir,
    recipeId?: CapytorioRecipeId
  ): { ok: boolean; reason?: string; machine?: CapytorioMachine } {
    const resolved = resolveCapytorioPlaceableSpec(toolOrType);
    if (!resolved) {
      return { ok: false, reason: `Unknown building: ${toolOrType}` };
    }
    const baseType = resolved.baseType;
    const variantItemId = resolved.isBaseMachine ? undefined : resolved.id;
    const fp = getCapytorioFootprint(baseType, variantItemId, dir);

    const key = tileKey(gx, gz);
    const existingAnchor = this.machines.get(key);
    if (existingAnchor) {
      const sameTool =
        existingAnchor.type === baseType &&
        (existingAnchor.variantItemId ?? existingAnchor.type) === (variantItemId ?? baseType);
      if (sameTool) {
        const rotated = this.rotateMachineAt(existingAnchor.gx, existingAnchor.gz);
        if (rotated !== null) {
          return { ok: true, machine: existingAnchor };
        }
        return { ok: false, reason: 'Not enough room to rotate this building here' };
      }
      return { ok: false, reason: 'Tile already occupied — Right-click or press X to demolish first' };
    }

    const allowWater = variantItemId === 'offshore_pump';
    if (!this.canFootprintFit(gx, gz, fp.width, fp.height, undefined, allowWater)) {
      let hasWater = false;
      if (!allowWater) {
        for (let dx = 0; dx < fp.width && !hasWater; dx++) {
          for (let dz = 0; dz < fp.height; dz++) {
            if (isCapytorioWaterTerrain(sampleCapytorioTerrain(gx + dx, gz + dz))) {
              hasWater = true;
              break;
            }
          }
        }
      }
      return {
        ok: false,
        reason: hasWater
          ? 'Cannot build on water — place on solid ground or tunnel under rivers'
          : `Needs clear ${fp.width}×${fp.height} footprint — Right-click or press X to clear space`,
      };
    }

    if (baseType === 'drill' && variantItemId !== 'offshore_pump') {
      const ore = this.findFirstOreInFootprint(gx, gz, fp.width, fp.height);
      if (!ore) {
        return { ok: false, reason: 'Mining Drills must cover at least one glowing ore tile' };
      }
    }

    if (resolved.isBaseMachine) {
      const inPocket = this.getPocketMachineCount(baseType);
      if (inPocket > 0) {
        this.pocketMachines[baseType] = inPocket - 1;
      } else if (!this.craftMachineIntoPocket(baseType)) {
        return { ok: false, reason: `Need materials to craft ${resolved.name}` };
      } else {
        this.pocketMachines[baseType] = Math.max(0, (this.pocketMachines[baseType] ?? 1) - 1);
      }
    } else {
      const itemQty = this.getPocketItemCount(resolved.id);
      if (itemQty > 0) {
        this.consumePocketItem(resolved.id, 1);
      } else {
        let autoCrafted = false;
        for (let i = 0; i < CAPYTORIO_RECIPES.length; i++) {
          const rec = CAPYTORIO_RECIPES[i];
          if (rec.result === resolved.id && this.canAffordPocketRecipe(rec.id)) {
            autoCrafted = this.pocketCraftRecipe(rec.id, 1);
            if (autoCrafted) {
              this.consumePocketItem(resolved.id, 1);
            }
            break;
          }
        }
        if (!autoCrafted) {
          return { ok: false, reason: `Craft ${resolved.name} in the Craft menu first` };
        }
      }
    }

    // Clear any citrus trees across the full footprint cleanly and award oranges!
    for (let dx = 0; dx < fp.width; dx++) {
      for (let dz = 0; dz < fp.height; dz++) {
        this.harvestTreeAt(gx + dx, gz + dz);
      }
    }

    const machine: CapytorioMachine = {
      id: this.nextMachineId++,
      type: baseType,
      variantItemId,
      tierMult: resolved.tierMult,
      gx,
      gz,
      dir,
      recipeId: baseType === 'assembler' ? recipeId ?? this.selectedRecipeId : undefined,
      craftProgress: 0,
      productivityProgress: 0,
      fuelTimer: 0,
      armSwing: 0,
      armExtend: 0,
      inserterPhase: baseType === 'inserter' ? 'idle_pickup' : undefined,
      holdingItem: null,
      splitterToggle: 0,
      splitterInputToggle: 0,
      splitterInputPriority: baseType === 'splitter' ? 'none' : undefined,
      splitterOutputPriority: baseType === 'splitter' ? 'none' : undefined,
      splitterFilterItem: baseType === 'splitter' ? null : undefined,
      inserterFilterMode: baseType === 'inserter' ? 'whitelist' : undefined,
      inserterFilters: baseType === 'inserter' ? [] : undefined,
      inserterStackLimit: null,
      chestSlotLimit: baseType === 'chest' ? null : undefined,
      inputBuffer: {},
      outputBuffer: {},
      beltItems: [],
    };
    this.machines.set(key, machine);
    this.registerMachineOccupancy(machine);
    this.machineListDirty = true;
    this.topologyRevision++;
    this.inspectedKey = key;
    this.inspectedTile = { gx, gz };
    this.score += 10;
    this.recordRecentTool(resolved.id);
    this.recomputePowerMetrics();
    this.recordHistoryDelta(
      `Place ${resolved.shortName}`,
      gx,
      gz,
      null,
      this.snapshotMachineForUndo(machine)
    );
    return { ok: true, machine };
  }

  public rotateMachineAt(gx: number, gz: number): CapytorioDirection | null {
    const m = this.getMachineAt(gx, gz);
    if (!m) return null;
    const nextDir = ((m.dir + 1) & 3) as CapytorioDirection;
    const curFp = this.getMachineFootprint(m);
    const nextFp = getCapytorioFootprint(m.type, m.variantItemId, nextDir);
    if (nextFp.width !== curFp.width || nextFp.height !== curFp.height) {
      if (
        !this.canFootprintFit(
          m.gx,
          m.gz,
          nextFp.width,
          nextFp.height,
          m,
          m.variantItemId === 'offshore_pump'
        )
      ) {
        return null;
      }
    }
    const beforeSnap = this.snapshotMachineForUndo(m);
    this.unregisterMachineOccupancy(m);
    m.dir = nextDir;
    this.registerMachineOccupancy(m);
    for (let dx = 0; dx < nextFp.width; dx++) {
      for (let dz = 0; dz < nextFp.height; dz++) {
        this.harvestTreeAt(m.gx + dx, m.gz + dz);
      }
    }
    this.topologyRevision++;
    const resolved = resolveCapytorioPlaceableSpec(m.variantItemId ?? m.type);
    this.recordHistoryDelta(
      `Rotate ${resolved?.shortName ?? CAPYTORIO_MACHINE_SPECS[m.type].shortName}`,
      m.gx,
      m.gz,
      beforeSnap,
      this.snapshotMachineForUndo(m)
    );
    return m.dir;
  }

  public setAssemblerRecipeAt(gx: number, gz: number, recipeId: CapytorioRecipeId): boolean {
    if (!this.isRecipeUnlocked(recipeId)) return false;
    const rec = RECIPE_BY_ID.get(recipeId);
    if (!rec || rec.station !== 'assembler') return false;
    this.selectedRecipeId = recipeId;
    const m = this.getMachineAt(gx, gz);
    if (m && m.type === 'assembler') {
      if (m.recipeId !== recipeId) {
        const beforeSnap = this.snapshotMachineForUndo(m);
        for (const [k, v] of Object.entries(m.inputBuffer) as Array<[CapytorioItemId, number]>) {
          if (v > 0) this.addPocketItem(k, v);
        }
        m.inputBuffer = {};
        m.craftProgress = 0;
        m.recipeId = recipeId;
        this.topologyRevision++;
        this.recordHistoryDelta(
          `Set Recipe: ${rec.name}`,
          m.gx,
          m.gz,
          beforeSnap,
          this.snapshotMachineForUndo(m)
        );
      }
      return true;
    }
    return false;
  }

  public setSplitterConfigAt(
    gx: number,
    gz: number,
    config: {
      inputPriority?: CapytorioSplitterPriority;
      outputPriority?: CapytorioSplitterPriority;
      filterItem?: CapytorioItemId | null;
    }
  ): boolean {
    const m = this.getMachineAt(gx, gz);
    if (!m || m.type !== 'splitter') return false;
    const beforeSnap = this.snapshotMachineForUndo(m);
    if (config.inputPriority !== undefined) {
      m.splitterInputPriority = config.inputPriority;
    }
    if (config.outputPriority !== undefined) {
      m.splitterOutputPriority = config.outputPriority;
    }
    if (config.filterItem !== undefined) {
      m.splitterFilterItem = config.filterItem;
      // Factorio convenience: setting a filter with 'none' output priority defaults output priority to 'left'
      if (config.filterItem && (!m.splitterOutputPriority || m.splitterOutputPriority === 'none')) {
        m.splitterOutputPriority = 'left';
      }
    }
    this.topologyRevision++;
    this.recordHistoryDelta(
      'Configure Splitter',
      m.gx,
      m.gz,
      beforeSnap,
      this.snapshotMachineForUndo(m)
    );
    return true;
  }

  public setInserterConfigAt(
    gx: number,
    gz: number,
    config: {
      filterMode?: CapytorioInserterFilterMode;
      filters?: CapytorioItemId[];
      stackLimit?: number | null;
    }
  ): boolean {
    const m = this.getMachineAt(gx, gz);
    if (!m || m.type !== 'inserter') return false;
    const beforeSnap = this.snapshotMachineForUndo(m);
    if (config.filterMode !== undefined) {
      m.inserterFilterMode = config.filterMode;
    }
    if (config.filters !== undefined) {
      const cleaned: CapytorioItemId[] = [];
      for (let i = 0; i < config.filters.length && cleaned.length < 5; i++) {
        const fid = config.filters[i];
        if (fid && !cleaned.includes(fid)) cleaned.push(fid);
      }
      m.inserterFilters = cleaned;
    }
    if (config.stackLimit !== undefined) {
      const maxCap = this.getEffectiveInserterMaxStack(m);
      m.inserterStackLimit =
        config.stackLimit === null
          ? null
          : Math.max(1, Math.min(maxCap, Math.round(config.stackLimit)));
    }
    this.topologyRevision++;
    this.recordHistoryDelta(
      'Configure Inserter',
      m.gx,
      m.gz,
      beforeSnap,
      this.snapshotMachineForUndo(m)
    );
    return true;
  }

  public setChestSlotLimitAt(gx: number, gz: number, slotLimit: number | null): boolean {
    const m = this.getMachineAt(gx, gz);
    if (!m || m.type !== 'chest') return false;
    const beforeSnap = this.snapshotMachineForUndo(m);
    m.chestSlotLimit =
      slotLimit === null
        ? null
        : Math.max(1, Math.min(CAPYTORIO_CHEST_SLOTS, Math.round(slotLimit)));
    this.topologyRevision++;
    this.recordHistoryDelta(
      'Set Chest Limit',
      m.gx,
      m.gz,
      beforeSnap,
      this.snapshotMachineForUndo(m)
    );
    return true;
  }

  public getEffectiveInserterMaxStack(m: CapytorioMachine): number {
    const base = this.getInserterStackSize();
    if (m.variantItemId === 'bulk_inserter') {
      return Math.max(4, base + 2);
    }
    return base;
  }

  public getEffectiveInserterStack(m: CapytorioMachine): number {
    const maxCap = this.getEffectiveInserterMaxStack(m);
    if (typeof m.inserterStackLimit === 'number' && m.inserterStackLimit >= 1) {
      return Math.min(maxCap, Math.round(m.inserterStackLimit));
    }
    return maxCap;
  }

  public getEffectiveChestCapacity(m: CapytorioMachine): number {
    const slots =
      typeof m.chestSlotLimit === 'number' && m.chestSlotLimit >= 1
        ? Math.min(CAPYTORIO_CHEST_SLOTS, Math.round(m.chestSlotLimit))
        : CAPYTORIO_CHEST_SLOTS;
    return slots * CAPYTORIO_CHEST_ITEMS_PER_SLOT;
  }

  public doesInserterAllowItem(m: CapytorioMachine, item: CapytorioItemId): boolean {
    const filters = m.inserterFilters;
    if (!filters || filters.length === 0) return true;
    const listed = filters.includes(item);
    return m.inserterFilterMode === 'blacklist' ? !listed : listed;
  }

  public getMachineModuleSlotLimit(m: CapytorioMachine): number {
    if (m.variantItemId === 'beacon' || m.variantItemId === 'rocket_silo') return 4;
    if (
      m.type === 'assembler' ||
      m.type === 'furnace' ||
      (m.type === 'drill' && m.variantItemId !== 'offshore_pump') ||
      (m.type === 'lab' && m.variantItemId !== 'radar')
    ) {
      return 2;
    }
    return 0;
  }

  public installModuleOnMachine(
    gx: number,
    gz: number,
    moduleItemId: CapytorioItemId
  ): { ok: boolean; reason?: string } {
    if (!isCapytorioModuleItem(moduleItemId)) {
      return { ok: false, reason: 'Item is not a supported factory module' };
    }
    const m = this.getMachineAt(gx, gz);
    if (!m) {
      return { ok: false, reason: 'No building at target tile' };
    }
    const limit = this.getMachineModuleSlotLimit(m);
    if (limit <= 0) {
      return { ok: false, reason: 'This building does not accept upgrade modules' };
    }
    if (!m.modules) m.modules = [];
    if (m.modules.length >= limit) {
      return { ok: false, reason: `All ${limit} module slots are full` };
    }
    if (this.getPocketItemCount(moduleItemId) < 1) {
      return { ok: false, reason: `No ${getCapytorioItemMeta(moduleItemId).name} in pocket` };
    }
    this.consumePocketItem(moduleItemId, 1);
    m.modules.push(moduleItemId);
    this.powerDirty = true;
    this.topologyRevision++;
    this.recomputePowerMetrics();
    return { ok: true };
  }

  public removeModuleFromMachine(gx: number, gz: number, slotIndex: number): CapytorioItemId | null {
    const m = this.getMachineAt(gx, gz);
    if (!m || !m.modules || slotIndex < 0 || slotIndex >= m.modules.length) return null;
    const [removed] = m.modules.splice(slotIndex, 1);
    if (removed) {
      this.addPocketItem(removed, 1);
      this.powerDirty = true;
      this.topologyRevision++;
      this.recomputePowerMetrics();
    }
    return removed ?? null;
  }

  /**
   * Computes combined speed, power, and productivity modifiers for a machine from its
   * socketed modules, nearby placed Beacons (within 6 tiles), and maintenance overclock.
   * Writes into `out` with zero heap allocations when supplied.
   */
  public computeMachineModuleModifiers(
    m: CapytorioMachine,
    out: CapytorioModuleModifiers = { speedMult: 1, powerMult: 1, prodBonus: 0 }
  ): CapytorioModuleModifiers {
    out.speedMult = 1.0;
    out.powerMult = 1.0;
    out.prodBonus = 0.0;

    if (m.modules && m.modules.length > 0) {
      for (let i = 0; i < m.modules.length; i++) {
        accumulateSingleModuleEffect(m.modules[i], 1.0, out);
      }
    }

    // Apply aura from nearby placed Beacons (50% of beacon module effects + 15% base speed broadcast)
    if (m.variantItemId !== 'beacon' && this.getMachineModuleSlotLimit(m) > 0) {
      this.ensureMachineList();
      for (let i = 0; i < this.machineStepList.length; i++) {
        const other = this.machineStepList[i];
        if (other.variantItemId !== 'beacon') continue;
        const dx = other.gx - m.gx;
        const dz = other.gz - m.gz;
        if (dx * dx + dz * dz <= 36) {
          out.speedMult += 0.15;
          if (other.modules && other.modules.length > 0) {
            for (let j = 0; j < other.modules.length; j++) {
              const bMod = other.modules[j];
              // Beacons transmit speed & efficiency (canonical Factorio rule)
              if (bMod.startsWith('speed_') || bMod.startsWith('efficiency_')) {
                accumulateSingleModuleEffect(bMod, 0.5, out);
              }
            }
          }
        }
      }
    }

    if ((m.overclockTimer ?? 0) > 0) {
      out.speedMult += 0.2;
    }

    if (out.speedMult < 0.25) out.speedMult = 0.25;
    if (out.powerMult < 0.2) out.powerMult = 0.2;
    if (out.prodBonus < 0) out.prodBonus = 0;
    return out;
  }

  public damageMachineAt(gx: number, gz: number, amount: number): number {
    const m = this.getMachineAt(gx, gz);
    if (!m) return 0;
    const cur = m.integrity ?? 100;
    const next = Math.max(10, Math.min(100, Math.round(cur - Math.max(0, amount))));
    m.integrity = next;
    return next;
  }

  public useRepairPackAt(
    gx: number,
    gz: number
  ): { ok: boolean; reason?: string; restored: number; overclockSec: number } {
    const m = this.getMachineAt(gx, gz);
    if (!m) {
      return { ok: false, reason: 'No building at target tile to repair', restored: 0, overclockSec: 0 };
    }
    if (this.getPocketItemCount('repair_pack') < 1) {
      return { ok: false, reason: 'Craft a Repair Pack first', restored: 0, overclockSec: 0 };
    }
    const prev = m.integrity ?? 100;
    const restored = Math.max(0, 100 - prev);
    this.consumePocketItem('repair_pack', 1);
    m.integrity = 100;
    m.overclockTimer = 30.0;
    this.score += 10;
    return { ok: true, restored, overclockSec: 30.0 };
  }

  public getRoboportFleetCount(m: CapytorioMachine): number {
    if (m.variantItemId !== 'roboport') return 0;
    const stored =
      (m.outputBuffer.logistic_robot ?? 0) + (m.outputBuffer.construction_robot ?? 0);
    const pocket =
      this.getPocketItemCount('logistic_robot') + this.getPocketItemCount('construction_robot');
    // Always maintain 2 ambient station drones on a placed Roboport, scaling up to 6 with crafted bots
    return Math.min(6, Math.max(2, stored + Math.min(4, pocket)));
  }

  /**
   * Factorio `Shift + Right-Click` Entity Settings Copy.
   */
  public copyEntitySettingsAt(gx: number, gz: number): {
    ok: boolean;
    label?: string;
    reason?: string;
  } {
    const m = this.getMachineAt(gx, gz);
    if (!m) {
      return { ok: false, reason: 'No configurable building under cursor' };
    }
    if (m.type === 'assembler') {
      const rec = m.recipeId ? RECIPE_BY_ID.get(m.recipeId) : null;
      const label = rec ? `Assembler · ${rec.name}` : 'Assembler Settings';
      this.entitySettingsClipboard = {
        sourceType: 'assembler',
        sourceLabel: label,
        recipeId: m.recipeId,
      };
      return { ok: true, label };
    }
    if (m.type === 'splitter') {
      const filterName = m.splitterFilterItem
        ? getCapytorioItemMeta(m.splitterFilterItem).shortName
        : 'No Filter';
      const label = `Splitter · ${filterName}`;
      this.entitySettingsClipboard = {
        sourceType: 'splitter',
        sourceLabel: label,
        splitterInputPriority: m.splitterInputPriority ?? 'none',
        splitterOutputPriority: m.splitterOutputPriority ?? 'none',
        splitterFilterItem: m.splitterFilterItem ?? null,
      };
      return { ok: true, label };
    }
    if (m.type === 'inserter') {
      const fCount = m.inserterFilters?.length ?? 0;
      const label =
        fCount > 0
          ? `Inserter · ${m.inserterFilterMode === 'blacklist' ? 'Deny' : 'Allow'} ${fCount}`
          : `Inserter · Stack ${m.inserterStackLimit ?? 'Max'}`;
      this.entitySettingsClipboard = {
        sourceType: 'inserter',
        sourceLabel: label,
        inserterFilterMode: m.inserterFilterMode ?? 'whitelist',
        inserterFilters: m.inserterFilters ? [...m.inserterFilters] : [],
        inserterStackLimit: m.inserterStackLimit ?? null,
      };
      return { ok: true, label };
    }
    if (m.type === 'chest') {
      const slots = m.chestSlotLimit ?? CAPYTORIO_CHEST_SLOTS;
      const label = `Chest · ${slots} slots`;
      this.entitySettingsClipboard = {
        sourceType: 'chest',
        sourceLabel: label,
        chestSlotLimit: m.chestSlotLimit ?? null,
      };
      return { ok: true, label };
    }
    return { ok: false, reason: `${CAPYTORIO_MACHINE_SPECS[m.type].shortName} has no copyable settings` };
  }

  /**
   * Factorio `Shift + Left-Click` Entity Settings Paste.
   */
  public pasteEntitySettingsAt(gx: number, gz: number): {
    ok: boolean;
    label?: string;
    reason?: string;
  } {
    const clip = this.entitySettingsClipboard;
    if (!clip) {
      return { ok: false, reason: 'No entity settings copied yet (Shift+Right-Click a machine)' };
    }
    const m = this.getMachineAt(gx, gz);
    if (!m) {
      return { ok: false, reason: 'No building under cursor to paste settings onto' };
    }
    if (m.type !== clip.sourceType) {
      return {
        ok: false,
        reason: `Copied ${clip.sourceType} settings cannot paste onto ${m.type}`,
      };
    }
    if (m.type === 'assembler' && clip.recipeId) {
      const applied = this.setAssemblerRecipeAt(m.gx, m.gz, clip.recipeId);
      return applied
        ? { ok: true, label: clip.sourceLabel }
        : { ok: false, reason: 'Recipe is not unlocked yet' };
    }
    if (m.type === 'splitter') {
      this.setSplitterConfigAt(m.gx, m.gz, {
        inputPriority: clip.splitterInputPriority ?? 'none',
        outputPriority: clip.splitterOutputPriority ?? 'none',
        filterItem: clip.splitterFilterItem ?? null,
      });
      return { ok: true, label: clip.sourceLabel };
    }
    if (m.type === 'inserter') {
      this.setInserterConfigAt(m.gx, m.gz, {
        filterMode: clip.inserterFilterMode ?? 'whitelist',
        filters: clip.inserterFilters ? [...clip.inserterFilters] : [],
        stackLimit: clip.inserterStackLimit ?? null,
      });
      return { ok: true, label: clip.sourceLabel };
    }
    if (m.type === 'chest') {
      this.setChestSlotLimitAt(m.gx, m.gz, clip.chestSlotLimit ?? null);
      return { ok: true, label: clip.sourceLabel };
    }
    return { ok: false, reason: 'Unable to apply settings' };
  }

  public demolishAt(gx: number, gz: number): CapytorioMachineType | null {
    const m = this.getMachineAt(gx, gz);
    if (!m) return null;
    const anchorKey = tileKey(m.gx, m.gz);
    const beforeSnap = this.snapshotMachineForUndo(m);
    const resolved = resolveCapytorioPlaceableSpec(m.variantItemId ?? m.type);
    // 100% friendly refund of machine/variant item + buffered items + belt items
    if (m.variantItemId) {
      this.addPocketItem(m.variantItemId, 1);
    } else {
      this.pocketMachines[m.type] = (this.pocketMachines[m.type] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(m.inputBuffer) as Array<[CapytorioItemId, number]>) {
      if (v > 0) this.addPocketItem(k, v);
    }
    for (const [k, v] of Object.entries(m.outputBuffer) as Array<[CapytorioItemId, number]>) {
      if (v > 0) this.addPocketItem(k, v);
    }
    for (let i = 0; i < m.beltItems.length; i++) {
      this.addPocketItem(m.beltItems[i].item, 1);
    }
    if (m.holdingItem) {
      this.addPocketItem(m.holdingItem, 1);
    }
    if (m.modules && m.modules.length > 0) {
      for (let i = 0; i < m.modules.length; i++) {
        this.addPocketItem(m.modules[i], 1);
      }
    }
    this.unregisterMachineOccupancy(m);
    this.machines.delete(anchorKey);
    if (this.inspectedKey === anchorKey) this.inspectedKey = null;
    if (this.inspectedTile && this.inspectedTile.gx === gx && this.inspectedTile.gz === gz) {
      this.inspectedTile = { gx, gz };
    }
    this.machineListDirty = true;
    this.topologyRevision++;
    this.recomputePowerMetrics();
    this.recordHistoryDelta(
      `Remove ${resolved?.shortName ?? CAPYTORIO_MACHINE_SPECS[m.type].shortName}`,
      m.gx,
      m.gz,
      beforeSnap,
      null
    );
    return m.type;
  }

  /**
   * Drag-safe placement helper: skips already-occupied tiles and automatically aligns
   * Transport Belts along orthogonal drag steps (orienting both the new tile and previous
   * drag tile so multi-tile belt runs and corners connect seamlessly).
   */
  public placeMachineDuringDrag(
    toolOrType: string,
    gx: number,
    gz: number,
    prevPlacedGx: number | null,
    prevPlacedGz: number | null,
    alignPrevTile: boolean = false
  ): { ok: boolean; machine?: CapytorioMachine; appliedDir: CapytorioDirection } {
    let targetDir = this.selectedDir;
    if (prevPlacedGx !== null && prevPlacedGz !== null) {
      const dx = gx - prevPlacedGx;
      const dz = gz - prevPlacedGz;
      if (Math.abs(dx) + Math.abs(dz) === 1) {
        if (dz < 0) targetDir = 0;
        else if (dx > 0) targetDir = 1;
        else if (dz > 0) targetDir = 2;
        else if (dx < 0) targetDir = 3;
        this.selectedDir = targetDir;
        if (alignPrevTile) {
          const prevM = this.getMachineAt(prevPlacedGx, prevPlacedGz);
          if (prevM && prevM.type === 'belt' && prevM.dir !== targetDir) {
            const beforePrev = this.snapshotMachineForUndo(prevM);
            prevM.dir = targetDir;
            this.topologyRevision++;
            this.recordHistoryDelta(
              'Align Belt',
              prevPlacedGx,
              prevPlacedGz,
              beforePrev,
              this.snapshotMachineForUndo(prevM)
            );
          }
        }
      }
    }
    const fp = getCapytorioToolFootprint(toolOrType, targetDir);
    if (!this.canFootprintFit(gx, gz, fp.width, fp.height)) {
      return { ok: false, appliedDir: targetDir };
    }
    const res = this.placeMachine(toolOrType, gx, gz, targetDir);
    return {
      ok: res.ok,
      machine: res.machine,
      appliedDir: targetDir,
    };
  }

  private snapshotMachineForUndo(m: CapytorioMachine): CapytorioMachineUndoSnapshot {
    return {
      gx: m.gx,
      gz: m.gz,
      toolId: m.variantItemId ?? m.type,
      baseType: m.type,
      dir: m.dir,
      recipeId: m.recipeId,
      splitterInputPriority: m.splitterInputPriority,
      splitterOutputPriority: m.splitterOutputPriority,
      splitterFilterItem: m.splitterFilterItem,
      inserterFilterMode: m.inserterFilterMode,
      inserterFilters: m.inserterFilters ? [...m.inserterFilters] : undefined,
      inserterStackLimit: m.inserterStackLimit,
      chestSlotLimit: m.chestSlotLimit,
      inputBuffer: { ...m.inputBuffer },
      outputBuffer: { ...m.outputBuffer },
      beltItems: m.beltItems.map((bi) => ({ ...bi })),
      holdingItem: m.holdingItem,
    };
  }

  public beginHistoryBatch(label: string): void {
    if (this.isReplayingHistory || this.activeHistoryBatch) return;
    this.activeHistoryBatch = { label, deltas: [] };
  }

  public commitHistoryBatch(labelOverride?: string): void {
    if (!this.activeHistoryBatch) return;
    const batch = this.activeHistoryBatch;
    this.activeHistoryBatch = null;
    if (batch.deltas.length === 0) return;
    this.pushHistoryEntry({
      label: labelOverride ?? batch.label,
      deltas: batch.deltas,
    });
  }

  private pushHistoryEntry(entry: CapytorioHistoryEntry): void {
    if (entry.deltas.length === 0) return;
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_CAPYTORIO_UNDO_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  private recordHistoryDelta(
    label: string,
    gx: number,
    gz: number,
    before: CapytorioMachineUndoSnapshot | null,
    after: CapytorioMachineUndoSnapshot | null
  ): void {
    if (this.isReplayingHistory) return;
    if (this.activeHistoryBatch) {
      const deltas = this.activeHistoryBatch.deltas;
      for (let i = deltas.length - 1; i >= 0; i--) {
        if (deltas[i].gx === gx && deltas[i].gz === gz) {
          deltas[i].after = after;
          if (deltas[i].before === null && deltas[i].after === null) {
            deltas.splice(i, 1);
          }
          return;
        }
      }
      deltas.push({ gx, gz, before, after });
      return;
    }
    this.pushHistoryEntry({
      label,
      deltas: [{ gx, gz, before, after }],
    });
  }

  private applyConfigSnapshotToMachine(
    m: CapytorioMachine,
    snap: Pick<
      CapytorioMachineUndoSnapshot,
      | 'recipeId'
      | 'splitterInputPriority'
      | 'splitterOutputPriority'
      | 'splitterFilterItem'
      | 'inserterFilterMode'
      | 'inserterFilters'
      | 'inserterStackLimit'
      | 'chestSlotLimit'
    >
  ): void {
    if (m.type === 'assembler' && snap.recipeId) {
      m.recipeId = snap.recipeId;
    }
    if (m.type === 'splitter') {
      m.splitterInputPriority = snap.splitterInputPriority ?? 'none';
      m.splitterOutputPriority = snap.splitterOutputPriority ?? 'none';
      m.splitterFilterItem = snap.splitterFilterItem ?? null;
    }
    if (m.type === 'inserter') {
      m.inserterFilterMode = snap.inserterFilterMode ?? 'whitelist';
      m.inserterFilters = snap.inserterFilters ? [...snap.inserterFilters] : [];
      m.inserterStackLimit = snap.inserterStackLimit ?? null;
    }
    if (m.type === 'chest') {
      m.chestSlotLimit = snap.chestSlotLimit ?? null;
    }
  }

  private restoreMachineSnapshotFromPocket(snap: CapytorioMachineUndoSnapshot): boolean {
    const key = tileKey(snap.gx, snap.gz);
    const existing = this.machines.get(key);
    if (existing) {
      const sameTool =
        existing.type === snap.baseType &&
        (existing.variantItemId ?? existing.type) === snap.toolId;
      if (sameTool) {
        this.unregisterMachineOccupancy(existing);
        existing.dir = snap.dir;
        this.registerMachineOccupancy(existing);
        this.applyConfigSnapshotToMachine(existing, snap);
        this.topologyRevision++;
        return true;
      }
      this.demolishAt(snap.gx, snap.gz);
    }

    // Clear any overlapping occupants inside target footprint before restoring
    const snapFp = getCapytorioFootprint(
      snap.baseType,
      snap.toolId === snap.baseType ? undefined : snap.toolId,
      snap.dir
    );
    for (let dx = 0; dx < snapFp.width; dx++) {
      for (let dz = 0; dz < snapFp.height; dz++) {
        const occ = this.getMachineAt(snap.gx + dx, snap.gz + dz);
        if (occ) this.demolishAt(occ.gx, occ.gz);
      }
    }

    const placed = this.placeMachine(snap.toolId, snap.gx, snap.gz, snap.dir, snap.recipeId);
    if (!placed.ok || !placed.machine) return false;
    this.applyConfigSnapshotToMachine(placed.machine, snap);
    for (const [k, qty] of Object.entries(snap.inputBuffer) as Array<[CapytorioItemId, number]>) {
      const take = Math.min(qty, this.pocketItems[k] ?? 0);
      if (take > 0) {
        this.consumePocketItem(k, take);
        placed.machine.inputBuffer[k] = (placed.machine.inputBuffer[k] ?? 0) + take;
      }
    }
    for (const [k, qty] of Object.entries(snap.outputBuffer) as Array<[CapytorioItemId, number]>) {
      const take = Math.min(qty, this.pocketItems[k] ?? 0);
      if (take > 0) {
        this.consumePocketItem(k, take);
        placed.machine.outputBuffer[k] = (placed.machine.outputBuffer[k] ?? 0) + take;
      }
    }
    for (let bi = 0; bi < snap.beltItems.length; bi++) {
      const bItem = snap.beltItems[bi];
      if ((this.pocketItems[bItem.item] ?? 0) > 0) {
        this.consumePocketItem(bItem.item, 1);
        placed.machine.beltItems.push({ ...bItem });
      }
    }
    if (snap.holdingItem && (this.pocketItems[snap.holdingItem] ?? 0) > 0) {
      this.consumePocketItem(snap.holdingItem, 1);
      placed.machine.holdingItem = snap.holdingItem;
    }
    return true;
  }

  public undoLastAction(): { ok: boolean; label: string; changedCount: number } {
    if (this.activeHistoryBatch) {
      this.commitHistoryBatch();
    }
    const entry = this.undoStack.pop();
    if (!entry) {
      return { ok: false, label: '', changedCount: 0 };
    }
    let changedCount = 0;
    this.isReplayingHistory = true;
    try {
      for (let i = entry.deltas.length - 1; i >= 0; i--) {
        const d = entry.deltas[i];
        if (d.before === null) {
          if (this.demolishAt(d.gx, d.gz) !== null) {
            changedCount++;
          }
        } else {
          if (this.restoreMachineSnapshotFromPocket(d.before)) {
            changedCount++;
          }
        }
      }
    } finally {
      this.isReplayingHistory = false;
    }
    this.redoStack.push(entry);
    if (this.redoStack.length > MAX_CAPYTORIO_UNDO_HISTORY) {
      this.redoStack.shift();
    }
    // If the user undid a Cut action, clear the legacy single-cut snapshot
    if (this.undoCutSnapshot.length > 0 && entry.label.startsWith('Cut ')) {
      this.undoCutSnapshot.length = 0;
      if (this.clipboard?.mode === 'cut') {
        this.clipboard = null;
        this.clipboardToolState = 'off';
        this.pasteAnchor = null;
      }
    }
    return { ok: true, label: entry.label, changedCount };
  }

  public redoLastAction(): { ok: boolean; label: string; changedCount: number } {
    if (this.activeHistoryBatch) {
      this.commitHistoryBatch();
    }
    const entry = this.redoStack.pop();
    if (!entry) {
      return { ok: false, label: '', changedCount: 0 };
    }
    let changedCount = 0;
    this.isReplayingHistory = true;
    try {
      for (let i = 0; i < entry.deltas.length; i++) {
        const d = entry.deltas[i];
        if (d.after === null) {
          if (this.demolishAt(d.gx, d.gz) !== null) {
            changedCount++;
          }
        } else {
          if (this.restoreMachineSnapshotFromPocket(d.after)) {
            changedCount++;
          }
        }
      }
    } finally {
      this.isReplayingHistory = false;
    }
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_CAPYTORIO_UNDO_HISTORY) {
      this.undoStack.shift();
    }
    return { ok: true, label: entry.label, changedCount };
  }

  public setBlueprintAnchor(gx: number, gz: number): void {
    this.pasteAnchor = { gx, gz };
    this.hoveredGx = gx;
    this.hoveredGz = gz;
  }

  public clearBlueprintAnchor(): void {
    this.pasteAnchor = null;
  }

  public setClipboardToolMode(
    state: CapytorioClipboardToolState,
    shape?: CapytorioSelectionShape
  ): void {
    if (shape) this.selectionShape = shape;
    this.pasteAnchor = null;
    if (state === 'paste') {
      if (!this.clipboard || this.clipboard.entries.length === 0) {
        // Automatically remember the most recently copied/cut selection from the library
        if (this.blueprintLibrary.length > 0) {
          this.selectBlueprintFromLibrary(this.blueprintLibrary[0].id);
          return;
        }
        this.clipboardToolState = 'select_copy';
      } else {
        this.clipboardToolState = 'paste';
      }
    } else {
      this.clipboardToolState = state;
    }
    this.previewSelectedKeys.clear();
  }

  public clearClipboard(): void {
    this.clipboardToolState = 'off';
    this.pasteAnchor = null;
    // End active cut session, while keeping copied selections remembered in clipboard & library
    if (this.clipboard?.mode === 'cut') {
      this.clipboard = null;
    }
    this.previewSelectedKeys.clear();
    this.undoCutSnapshot.length = 0;
  }

  public activateLastBlueprint(): boolean {
    this.pasteAnchor = null;
    if (this.clipboard && this.clipboard.entries.length > 0) {
      this.clipboardToolState = 'paste';
      this.previewSelectedKeys.clear();
      return true;
    }
    if (this.blueprintLibrary.length > 0) {
      return this.selectBlueprintFromLibrary(this.blueprintLibrary[0].id) !== null;
    }
    return false;
  }

  public getBlueprintById(id: string): CapytorioSavedBlueprint | null {
    return (
      this.blueprintLibrary.find((bp) => bp.id === id) ??
      this.presetBlueprints.find((bp) => bp.id === id) ??
      null
    );
  }

  public selectBlueprintFromLibrary(id: string): CapytorioSavedBlueprint | null {
    return selectBlueprintFromLibraryInHost(this.blueprintHost, id);
  }

  public deleteBlueprintFromLibrary(id: string): boolean {
    return deleteBlueprintFromLibraryInHost(this.blueprintHost, id);
  }

  public clearBlueprintLibrary(): void {
    this.blueprintLibrary = [];
    this.activeBlueprintId = null;
    if (this.clipboard) {
      this.clipboard.blueprintId = null;
    }
  }

  /**
   * Imports a Factorio Blueprint String (`0e...`), Blueprint Book, or raw Factorio 2.0 JSON
   * into the Blueprint Library using exact-match entity filtering. Arms the first imported
   * blueprint for immediate 3D ghost placement.
   */
  public async importFactorioBlueprintString(
    rawInput: string
  ): Promise<FactorioBlueprintImportResult & { addedIds: string[] }> {
    return importFactorioBlueprintStringIntoHost(this.blueprintHost, rawInput);
  }

  /** Exports any saved blueprint or built-in preset as a genuine Factorio `0e...` string. */
  public async exportBlueprintToFactorioString(id: string): Promise<{
    ok: boolean;
    label: string;
    encoded: string;
    entityCount: number;
    error?: string;
  }> {
    return exportBlueprintToFactorioStringFromHost(this.blueprintHost, id);
  }

  /** Serializes every machine currently built on the map into a Factorio `0e...` blueprint string. */
  public async exportFactoryToFactorioString(label: string = 'Capytorio Factory'): Promise<{
    ok: boolean;
    label: string;
    encoded: string;
    entityCount: number;
    error?: string;
  }> {
    return exportFactoryToFactorioStringFromHost(this.blueprintHost, label);
  }

  /** Packages the player's Blueprint Library (or built-in presets if library is empty) into a Factorio Blueprint Book string. */
  public async exportBlueprintLibraryAsFactorioBookString(
    bookLabel: string = 'Capytorio Blueprint Book'
  ): Promise<{
    ok: boolean;
    label: string;
    encoded: string;
    blueprintCount: number;
    entityCount: number;
    error?: string;
  }> {
    return exportBlueprintLibraryAsFactorioBookStringFromHost(this.blueprintHost, bookLabel);
  }

  /**
   * Builds the self-powered Starter Mall sample factory directly onto the starter plain
   * (producing Transport Belts, Inserters, and Electronic Circuits), wrapped in a single
   * atomic Undo history entry (`Build Starter Mall`) so `Ctrl+Z` cleanly reverts it.
   */
  public buildSampleStarterMall(): {
    ok: boolean;
    placedCount: number;
    clearedCount: number;
    message: string;
  } {
    const plan = getSampleStarterMallAbsoluteEntries();
    let clearedCount = 0;
    let placedCount = 0;

    this.beginHistoryBatch('Build Starter Mall');
    try {
      // 1. Demolish any existing machines overlapping the Starter Mall footprint (100% refunded)
      const conflictingAnchors = new Set<string>();
      for (let i = 0; i < plan.length; i++) {
        const item = plan[i];
        const fp = getCapytorioFootprint(item.baseType, item.toolId, item.dir);
        for (let dx = 0; dx < fp.width; dx++) {
          for (let dz = 0; dz < fp.height; dz++) {
            const existing = this.getMachineAt(item.gx + dx, item.gz + dz);
            if (existing) {
              conflictingAnchors.add(tileKey(existing.gx, existing.gz));
            }
          }
        }
      }
      conflictingAnchors.forEach((anchorKey) => {
        const existing = this.machines.get(anchorKey);
        if (existing) {
          if (this.demolishAt(existing.gx, existing.gz) !== null) {
            clearedCount++;
          }
        }
      });

      // 2. Provision exact kit counts needed so the sample mall builds completely on demand
      const neededBase = new Map<CapytorioMachineType, number>();
      const neededItems = new Map<CapytorioItemId, number>();
      for (let i = 0; i < plan.length; i++) {
        const resolved = resolveCapytorioPlaceableSpec(plan[i].toolId);
        if (!resolved) continue;
        if (resolved.isBaseMachine) {
          neededBase.set(resolved.baseType, (neededBase.get(resolved.baseType) ?? 0) + 1);
        } else {
          neededItems.set(resolved.id, (neededItems.get(resolved.id) ?? 0) + 1);
        }
      }
      neededBase.forEach((reqCount, baseType) => {
        const have = this.pocketMachines[baseType] ?? 0;
        if (have < reqCount) {
          this.pocketMachines[baseType] = reqCount;
        }
      });
      neededItems.forEach((reqCount, itemId) => {
        const have = this.getPocketItemCount(itemId);
        if (have < reqCount) {
          this.addPocketItem(itemId, reqCount - have);
        }
      });

      // 3. Place every building with exact recipe, chest slot cap, and initial generator fuel
      for (let i = 0; i < plan.length; i++) {
        const item = plan[i];
        const res = this.placeMachine(item.toolId, item.gx, item.gz, item.dir, item.recipeId);
        if (res.ok && res.machine) {
          placedCount++;
          if (item.chestSlotLimit && res.machine.type === 'chest') {
            res.machine.chestSlotLimit = Math.max(
              1,
              Math.min(CAPYTORIO_CHEST_SLOTS, item.chestSlotLimit)
            );
          }
          if (res.machine.type === 'generator') {
            // Pre-seed coal & startup fuel so power is immediately 100% online
            res.machine.inputBuffer.coal = (res.machine.inputBuffer.coal ?? 0) + 20;
            res.machine.fuelTimer = Math.max(res.machine.fuelTimer, 24);
          }
        }
      }
    } finally {
      this.commitHistoryBatch();
    }

    this.machineListDirty = true;
    this.recomputePowerMetrics();
    this.topologyRevision++;
    this.clearClipboard();

    return {
      ok: placedCount > 0,
      placedCount,
      clearedCount,
      message: `Built Starter Mall (${placedCount} buildings · Belts, Inserters & Circuits) — [Ctrl+Z] to undo`,
    };
  }

  private buildBlueprintLabel(entries: ReadonlyArray<CapytorioBlueprintEntry>): string {
    return buildBlueprintLabelPure(entries);
  }

  private computeBlueprintBounds(entries: ReadonlyArray<CapytorioBlueprintEntry>): {
    width: number;
    height: number;
  } {
    return computeBlueprintBoundsPure(entries);
  }

  private recordBlueprintToLibrary(
    entries: ReadonlyArray<CapytorioBlueprintEntry>,
    sourceMode: 'copy' | 'cut'
  ): CapytorioSavedBlueprint {
    return recordBlueprintToLibraryInHost(this.blueprintHost, entries, sourceMode);
  }

  public selectMachinesInBox(gxA: number, gzA: number, gxB: number, gzB: number): CapytorioMachine[] {
    return selectMachinesInBoxInHost(this.blueprintHost, gxA, gzA, gxB, gzB);
  }

  public selectMachinesInPolygon(
    points: ReadonlyArray<{ gx: number; gz: number }>
  ): CapytorioMachine[] {
    return selectMachinesInPolygonInHost(this.blueprintHost, points);
  }

  public previewSelectionBox(gxA: number, gzA: number, gxB: number, gzB: number): number {
    this.previewSelectedKeys.clear();
    const list = this.selectMachinesInBox(gxA, gzA, gxB, gzB);
    for (let i = 0; i < list.length; i++) {
      this.previewSelectedKeys.add(tileKey(list[i].gx, list[i].gz));
    }
    return list.length;
  }

  public previewSelectionPolygon(points: ReadonlyArray<{ gx: number; gz: number }>): number {
    this.previewSelectedKeys.clear();
    const list = this.selectMachinesInPolygon(points);
    for (let i = 0; i < list.length; i++) {
      this.previewSelectedKeys.add(tileKey(list[i].gx, list[i].gz));
    }
    return list.length;
  }

  public captureBlueprint(
    machines: ReadonlyArray<CapytorioMachine>,
    mode: 'copy' | 'cut'
  ): { count: number; mode: 'copy' | 'cut' } {
    this.previewSelectedKeys.clear();
    if (machines.length === 0) {
      return { count: 0, mode };
    }
    let minGx = Infinity;
    let maxGx = -Infinity;
    let minGz = Infinity;
    let maxGz = -Infinity;
    for (let i = 0; i < machines.length; i++) {
      const m = machines[i];
      const fp = this.getMachineFootprint(m);
      if (m.gx < minGx) minGx = m.gx;
      if (m.gx + fp.width - 1 > maxGx) maxGx = m.gx + fp.width - 1;
      if (m.gz < minGz) minGz = m.gz;
      if (m.gz + fp.height - 1 > maxGz) maxGz = m.gz + fp.height - 1;
    }
    const anchorGx = Math.round((minGx + maxGx) * 0.5);
    const anchorGz = Math.round((minGz + maxGz) * 0.5);

    const entries: CapytorioBlueprintEntry[] = [];
    this.undoCutSnapshot.length = 0;

    for (let i = 0; i < machines.length; i++) {
      const m = machines[i];
      const toolId = m.variantItemId ?? m.type;
      entries.push({
        dx: m.gx - anchorGx,
        dz: m.gz - anchorGz,
        toolId,
        baseType: m.type,
        dir: m.dir,
        recipeId: m.recipeId,
        splitterInputPriority: m.splitterInputPriority,
        splitterOutputPriority: m.splitterOutputPriority,
        splitterFilterItem: m.splitterFilterItem,
        inserterFilterMode: m.inserterFilterMode,
        inserterFilters: m.inserterFilters ? [...m.inserterFilters] : undefined,
        inserterStackLimit: m.inserterStackLimit,
        chestSlotLimit: m.chestSlotLimit,
      });
      if (mode === 'cut') {
        this.undoCutSnapshot.push(this.snapshotMachineForUndo(m));
      }
    }

    if (mode === 'cut') {
      const cutCount = this.undoCutSnapshot.length;
      this.beginHistoryBatch(`Cut ${cutCount} building${cutCount === 1 ? '' : 's'}`);
      for (let i = 0; i < this.undoCutSnapshot.length; i++) {
        const snap = this.undoCutSnapshot[i];
        this.demolishAt(snap.gx, snap.gz);
      }
      this.commitHistoryBatch();
    }

    const savedBp = this.recordBlueprintToLibrary(entries, mode);
    this.clipboard = {
      mode,
      entries,
      canUndoCut: mode === 'cut' && this.undoCutSnapshot.length > 0,
      blueprintId: savedBp.id,
      label: savedBp.label,
    };
    this.clipboardToolState = 'paste';
    this.pasteAnchor = null;
    return { count: entries.length, mode };
  }

  public rotateBlueprint90(ccw: boolean = false): boolean {
    if (!this.clipboard || this.clipboard.entries.length === 0) return false;
    return rotateBlueprintEntries90(this.clipboard.entries, ccw);
  }

  public flipBlueprintHorizontal(): boolean {
    if (!this.clipboard || this.clipboard.entries.length === 0) return false;
    return flipBlueprintEntriesHorizontal(this.clipboard.entries);
  }

  public flipBlueprintVertical(): boolean {
    if (!this.clipboard || this.clipboard.entries.length === 0) return false;
    return flipBlueprintEntriesVertical(this.clipboard.entries);
  }

  public evaluateBlueprintPlacementAt(
    originGx: number,
    originGz: number
  ): CapytorioBlueprintPlacementCheck[] {
    return evaluateBlueprintPlacementAtInHost(this.blueprintHost, originGx, originGz);
  }

  public pasteBlueprintAtAnchor(): {
    placedCount: number;
    skippedCount: number;
    updatedRecipesCount: number;
    anchorGx: number;
    anchorGz: number;
  } {
    const anchorGx = this.pasteAnchor ? this.pasteAnchor.gx : this.hoveredGx;
    const anchorGz = this.pasteAnchor ? this.pasteAnchor.gz : this.hoveredGz;
    const res = this.pasteBlueprintAt(anchorGx, anchorGz);
    return { ...res, anchorGx, anchorGz };
  }

  public pasteBlueprintAt(
    originGx: number,
    originGz: number
  ): { placedCount: number; skippedCount: number; updatedRecipesCount: number } {
    return pasteBlueprintAtInHost(this.blueprintHost, originGx, originGz);
  }

  public undoCut(): { restoredCount: number } {
    if (this.undoCutSnapshot.length === 0) return { restoredCount: 0 };
    let restoredCount = 0;
    this.isReplayingHistory = true;
    try {
      for (let i = 0; i < this.undoCutSnapshot.length; i++) {
        const item = this.undoCutSnapshot[i];
        if (this.machines.has(tileKey(item.gx, item.gz))) continue;
        if (this.restoreMachineSnapshotFromPocket(item)) {
          restoredCount++;
        }
      }
    } finally {
      this.isReplayingHistory = false;
    }
    // Pop matching Cut history entry from undoStack if it's on top so Undo doesn't double-apply
    if (
      this.undoStack.length > 0 &&
      this.undoStack[this.undoStack.length - 1].label.startsWith('Cut ')
    ) {
      this.undoStack.pop();
    }
    this.undoCutSnapshot.length = 0;
    this.clipboard = null;
    this.clipboardToolState = 'off';
    this.pasteAnchor = null;
    this.previewSelectedKeys.clear();
    return { restoredCount };
  }

  /**
   * Factorio `[Q]` Smart Pipette: samples the hovered machine's type & assembler recipe,
   * or clears the active build tool back to Inspect/Hand-Mine if the tile is empty.
   */
  public pipetteAt(gx: number, gz: number): {
    tool: string;
    picked: boolean;
    copiedRecipeId?: CapytorioRecipeId;
  } {
    const existing = this.getMachineAt(gx, gz);
    if (existing) {
      const toolId = existing.variantItemId ?? existing.type;
      this.selectedTool = toolId;
      this.selectedDir = existing.dir;
      this.inspectedKey = tileKey(existing.gx, existing.gz);
      this.inspectedTile = { gx: existing.gx, gz: existing.gz };
      if (existing.type === 'assembler' && existing.recipeId) {
        this.selectedRecipeId = existing.recipeId;
      }
      this.recordRecentTool(toolId);
      return {
        tool: toolId,
        picked: true,
        copiedRecipeId: existing.recipeId,
      };
    }
    this.selectedTool = 'mine';
    return { tool: 'mine', picked: false };
  }

  /**
   * Manually loads coal, yuzu_sap, or orange bio-fuel from pocket into a Steam Generator,
   * igniting immediately if idle so power output surges from 1.5 MW -> 6.0 MW.
   */
  public insertPocketFuelToGenerator(gx: number, gz: number, maxAmount: number = 5): number {
    const m = this.getMachineAt(gx, gz);
    if (!m || m.type !== 'generator') return 0;

    let loaded = 0;
    const fuels: readonly CapytorioItemId[] = ['coal', 'yuzu_sap', 'orange'];
    for (let f = 0; f < fuels.length && loaded < maxAmount; f++) {
      const fuelId = fuels[f];
      const curBuf = m.inputBuffer[fuelId] ?? 0;
      const avail = this.getPocketItemCount(fuelId);
      const take = Math.min(maxAmount - loaded, 16 - curBuf, avail);
      if (take > 0 && this.consumePocketItem(fuelId, take)) {
        m.inputBuffer[fuelId] = curBuf + take;
        loaded += take;
      }
    }

    if (m.fuelTimer <= 0) {
      if ((m.inputBuffer.coal ?? 0) > 0) {
        m.inputBuffer.coal = (m.inputBuffer.coal ?? 1) - 1;
        if (m.inputBuffer.coal <= 0) delete m.inputBuffer.coal;
        m.fuelTimer = 10.0;
      } else if ((m.inputBuffer.yuzu_sap ?? 0) > 0) {
        m.inputBuffer.yuzu_sap = (m.inputBuffer.yuzu_sap ?? 1) - 1;
        if (m.inputBuffer.yuzu_sap <= 0) delete m.inputBuffer.yuzu_sap;
        m.fuelTimer = 6.5;
      } else if ((m.inputBuffer.orange ?? 0) > 0) {
        m.inputBuffer.orange = (m.inputBuffer.orange ?? 1) - 1;
        if (m.inputBuffer.orange <= 0) delete m.inputBuffer.orange;
        m.fuelTimer = 5.0;
      }
    }
    if (loaded > 0) {
      this.recomputePowerMetrics();
      this.score += loaded * 2;
    }
    return loaded;
  }

  /**
   * Zero-friction manual input loading (Ctrl-Click style): feeds matching ingredients
   * or fuel from pocket into Furnace, Assembler, Generator, or Lab.
   */
  public insertPocketInputsForMachine(gx: number, gz: number, batches: number = 4): number {
    const m = this.getMachineAt(gx, gz);
    if (!m) return 0;

    if (m.type === 'generator') {
      return this.insertPocketFuelToGenerator(m.gx, m.gz, batches);
    }

    let transferred = 0;
    if (m.type === 'furnace') {
      for (const [itemId, qty] of Object.entries(this.pocketItems) as Array<[CapytorioItemId, number]>) {
        if (!qty || qty <= 0) continue;
        const spec = getCapytorioSmeltSpec(itemId);
        if (!spec) continue;
        const cur = m.inputBuffer[itemId] ?? 0;
        const take = Math.min(qty, batches * spec.inputCount, 16 - cur);
        if (take > 0 && this.consumePocketItem(itemId, take)) {
          m.inputBuffer[itemId] = cur + take;
          transferred += take;
          break;
        }
      }
      return transferred;
    }

    if (m.type === 'assembler') {
      const rec = RECIPE_BY_ID.get(m.recipeId ?? getDefaultAssemblerRecipeId());
      if (!rec) return 0;
      for (let i = 0; i < rec.ingredients.length; i++) {
        const ing = rec.ingredients[i];
        const cur = m.inputBuffer[ing.item] ?? 0;
        const take = Math.min(
          this.getPocketItemCount(ing.item),
          batches * ing.count,
          Math.max(0, 16 - cur)
        );
        if (take > 0 && this.consumePocketItem(ing.item, take)) {
          m.inputBuffer[ing.item] = cur + take;
          transferred += take;
        }
      }
      return transferred;
    }

    if (m.type === 'lab') {
      const activeTech = this.activeTechId ? TECH_BY_ID.get(this.activeTechId) : null;
      const targetScienceIds: CapytorioItemId[] = activeTech
        ? (Object.keys(activeTech.cost) as CapytorioItemId[])
        : (Object.keys(this.pocketItems).filter(
            (id) => getCapytorioItemMeta(id).category === 'science'
          ) as CapytorioItemId[]);
      for (let i = 0; i < targetScienceIds.length; i++) {
        const sciId = targetScienceIds[i];
        const cur = m.inputBuffer[sciId] ?? 0;
        const take = Math.min(this.getPocketItemCount(sciId), batches, Math.max(0, 16 - cur));
        if (take > 0 && this.consumePocketItem(sciId, take)) {
          m.inputBuffer[sciId] = cur + take;
          transferred += take;
        }
      }
      return transferred;
    }

    return 0;
  }

  /**
   * Collects all output buffer items (or belt items) from a specific inspected machine into pocket.
   */
  public takeMachineOutputsToPocket(gx: number, gz: number): number {
    const m = this.getMachineAt(gx, gz);
    if (!m) return 0;
    let taken = 0;
    for (const [k, v] of Object.entries(m.outputBuffer) as Array<[CapytorioItemId, number]>) {
      if (v > 0) {
        this.addPocketItem(k, v);
        taken += v;
        delete m.outputBuffer[k];
      }
    }
    if (m.beltItems.length > 0) {
      for (let i = 0; i < m.beltItems.length; i++) {
        this.addPocketItem(m.beltItems[i].item, 1);
        taken += 1;
      }
      m.beltItems.length = 0;
    }
    if (
      taken > 0 &&
      (this.inspectedKey === tileKey(m.gx, m.gz) ||
        (this.inspectedTile?.gx === gx && this.inspectedTile?.gz === gz))
    ) {
      this.inspectTileAt(gx, gz);
    }
    return taken;
  }

  public pickupItemsAtTile(gx: number, gz: number): {
    total: number;
    source: 'belt' | 'floor' | null;
    items: Array<{ item: CapytorioItemId; count: number }>;
  } {
    const counts = new Map<CapytorioItemId, number>();
    let total = 0;
    let source: 'belt' | 'floor' | null = null;

    const m = this.getMachineAt(gx, gz);
    if (m && m.beltItems.length > 0) {
      for (let i = 0; i < m.beltItems.length; i++) {
        const itemId = m.beltItems[i].item;
        this.addPocketItem(itemId, 1);
        counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
        total++;
      }
      m.beltItems.length = 0;
      source = 'belt';
    }

    for (let i = this.spilledItems.length - 1; i >= 0; i--) {
      const sp = this.spilledItems[i];
      const spGx = Math.round(sp.lx / CAPYTORIO_TILE_SIZE);
      const spGz = Math.round(sp.lz / CAPYTORIO_TILE_SIZE);
      if (spGx === gx && spGz === gz) {
        this.addPocketItem(sp.item, 1);
        counts.set(sp.item, (counts.get(sp.item) ?? 0) + 1);
        this.spilledItems.splice(i, 1);
        total++;
        if (!source) source = 'floor';
      }
    }

    if (
      total > 0 &&
      (this.inspectedKey === tileKey(gx, gz) ||
        (this.inspectedTile?.gx === gx && this.inspectedTile?.gz === gz))
    ) {
      this.inspectTileAt(gx, gz);
    }

    const items: Array<{ item: CapytorioItemId; count: number }> = [];
    for (const [item, count] of counts.entries()) {
      items.push({ item, count });
    }
    items.sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
    return { total, source, items };
  }

  /**
   * Launches an Orbital Yuzu Rocket using a crafted Rocket Launch Core (`rocket_part`)
   * from pocket or inspected Assembler output, granting +15% permanent factory productivity.
   */
  public launchRocketManual(callbacks?: CapytorioStepCallbacks): {
    ok: boolean;
    reason?: string;
    rocketLaunches: number;
  } {
    let consumedPart = this.consumePocketItem('rocket_part', 1);
    if (!consumedPart) {
      this.ensureMachineList();
      for (let i = 0; i < this.machineStepList.length; i++) {
        const m = this.machineStepList[i];
        const count = m.outputBuffer.rocket_part ?? 0;
        if (count > 0) {
          if (count === 1) delete m.outputBuffer.rocket_part;
          else m.outputBuffer.rocket_part = count - 1;
          consumedPart = true;
          break;
        }
      }
    }
    if (!consumedPart) {
      return {
        ok: false,
        reason: 'Assemble 1 Rocket Launch Core (rocket_part) or complete Rocket Productivity research to launch!',
        rocketLaunches: this.rocketLaunches,
      };
    }

    this.rocketLaunches += 1;
    this.score += 500;
    this.evaluateMilestones(callbacks);
    callbacks?.onTechCompleted?.(
      'rocket_silo_prod',
      'Orbital Yuzu Rocket Launch',
      15,
      0,
      true
    );
    return {
      ok: true,
      rocketLaunches: this.rocketLaunches,
    };
  }

  private hasAnyTechDelivered(): boolean {
    for (const k in this.techDelivered) {
      if ((this.techDelivered[k as CapytorioItemId] ?? 0) > 0) return true;
    }
    return false;
  }

  private evaluateMilestonesIfDirty(
    activeGenerators: number,
    callbacks?: CapytorioStepCallbacks
  ): void {
    if (this.completedMilestones.size >= 6) return;
    const totalSci =
      (this.pocketItems.automation_science ?? 0) +
      (this.pocketItems.logistic_science ?? 0) +
      (this.pocketItems.metallurgic_science ?? 0) +
      (this.pocketItems.agricultural_science ?? 0) +
      (this.pocketItems.electromagnetic_science ?? 0);
    const totalOreMined =
      (this.pocketItems.iron_ore ?? 0) +
      (this.pocketItems.copper_ore ?? 0) +
      (this.pocketItems.calcite ?? 0) +
      (this.pocketItems.yuzu_sap ?? 0);
    const hasTechDelivered = this.hasAnyTechDelivered();
    if (
      this.topologyRevision === this.lastMilestoneTopoRev &&
      this.totalProduced === this.lastMilestoneTotalProduced &&
      this.unlockedTechs.size === this.lastMilestoneUnlockedCount &&
      this.rocketLaunches === this.lastMilestoneRocketLaunches &&
      totalOreMined === this.lastMilestoneOreCount &&
      totalSci === this.lastMilestoneSciCount &&
      hasTechDelivered === this.lastMilestoneHasTechDelivered &&
      activeGenerators === this.lastMilestoneActiveGenerators
    ) {
      return;
    }
    this.lastMilestoneTopoRev = this.topologyRevision;
    this.lastMilestoneTotalProduced = this.totalProduced;
    this.lastMilestoneUnlockedCount = this.unlockedTechs.size;
    this.lastMilestoneRocketLaunches = this.rocketLaunches;
    this.lastMilestoneOreCount = totalOreMined;
    this.lastMilestoneSciCount = totalSci;
    this.lastMilestoneHasTechDelivered = hasTechDelivered;
    this.lastMilestoneActiveGenerators = activeGenerators;
    this.evaluateMilestones(callbacks);
  }

  public evaluateMilestones(callbacks?: CapytorioStepCallbacks): CapytorioMilestoneStatus[] {
    let drillCount = 0;
    let beltCount = 0;
    let furnaceOrGenActive = false;
    let labCount = 0;
    this.ensureMachineList();
    for (let i = 0; i < this.machineStepList.length; i++) {
      const m = this.machineStepList[i];
      if (m.type === 'drill') drillCount++;
      else if (m.type === 'belt' || m.type === 'tunnel' || m.type === 'splitter') beltCount++;
      else if (m.type === 'furnace' || (m.type === 'generator' && m.fuelTimer > 0)) {
        furnaceOrGenActive = true;
      } else if (m.type === 'lab') labCount++;
    }

    const totalSci =
      (this.pocketItems.automation_science ?? 0) +
      (this.pocketItems.logistic_science ?? 0) +
      (this.pocketItems.metallurgic_science ?? 0) +
      (this.pocketItems.agricultural_science ?? 0) +
      (this.pocketItems.electromagnetic_science ?? 0);
    const totalOreMined =
      (this.pocketItems.iron_ore ?? 0) +
      (this.pocketItems.copper_ore ?? 0) +
      (this.pocketItems.calcite ?? 0) +
      (this.pocketItems.yuzu_sap ?? 0);
    const hasTechDelivered = this.hasAnyTechDelivered();

    const defs: Array<{ id: string; label: string; hint: string; met: boolean }> = [
      {
        id: 'mine_ore',
        label: 'Mine Starter Ore',
        hint: 'Press [E] over a glowing ore seam or drill it',
        met: this.completedMilestones.has('mine_ore') || totalOreMined >= 2 || drillCount >= 1,
      },
      {
        id: 'place_drill',
        label: 'Place Mining Drill',
        hint: 'Equip Drill [1] and click on NW Iron or NE Copper',
        met: this.completedMilestones.has('place_drill') || drillCount >= 1,
      },
      {
        id: 'lay_belts',
        label: 'Run Conveyor Line',
        hint: 'Select Belt [2] & drag across 3 tiles from a drill',
        met: this.completedMilestones.has('lay_belts') || beltCount >= 3,
      },
      {
        id: 'smelt_power',
        label: 'Smelt & Power Grid',
        hint: 'Place a Furnace [4] or fuel Coal Generator [6]',
        met:
          this.completedMilestones.has('smelt_power') ||
          (furnaceOrGenActive && this.totalProduced >= 2),
      },
      {
        id: 'research_lab',
        label: 'Automate Science Lab',
        hint: 'Craft Science Packs, place Lab [7] & click Feed Sci',
        met:
          this.completedMilestones.has('research_lab') ||
          this.unlockedTechs.size >= 1 ||
          (labCount >= 1 && (totalSci >= 1 || hasTechDelivered)),
      },
      {
        id: 'launch_rocket',
        label: 'Launch Yuzu Rocket',
        hint: 'Reach Rocket Productivity & launch into orbit',
        met: this.completedMilestones.has('launch_rocket') || this.rocketLaunches >= 1,
      },
    ];

    const out: CapytorioMilestoneStatus[] = [];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (d.met && !this.completedMilestones.has(d.id)) {
        this.completedMilestones.add(d.id);
        this.score += 40;
        callbacks?.onMilestoneCompleted?.(d.id, d.label, 0);
      }
      out.push({
        id: d.id,
        label: d.label,
        hint: d.hint,
        completed: this.completedMilestones.has(d.id),
      });
    }
    return out;
  }

  public feedPocketScienceToLabs(): number {
    if (!this.activeTechId) return 0;
    const tech = TECH_BY_ID.get(this.activeTechId);
    if (!tech) return 0;
    let fed = 0;
    for (const [itemId, reqCount] of Object.entries(tech.cost) as Array<[CapytorioItemId, number]>) {
      const delivered = this.techDelivered[itemId] ?? 0;
      const needed = Math.max(0, reqCount - delivered);
      if (needed <= 0) continue;
      const take = Math.min(needed, this.getPocketItemCount(itemId));
      if (take > 0) {
        this.consumePocketItem(itemId, take);
        this.techDelivered[itemId] = delivered + take;
        fed += take;
      }
    }
    return fed;
  }

  public collectFromNearbyChestsAndOutputs(
    heroLocalX: number,
    heroLocalZ: number,
    pickupRadiusMeters: number = 3.6
  ): number {
    let collected = 0;
    this.ensureMachineList();
    for (let i = 0; i < this.machineStepList.length; i++) {
      const m = this.machineStepList[i];
      if (m.type !== 'chest' && m.type !== 'furnace' && m.type !== 'assembler') continue;
      const fp = this.getMachineFootprint(m);
      const wx = capytorioMachineCenterLocalX(m.gx, fp.width);
      const wz = capytorioMachineCenterLocalZ(m.gz, fp.height);
      const extraRadius = (Math.max(fp.width, fp.height) - 1) * CAPYTORIO_TILE_SIZE * 0.5;
      if (Math.hypot(wx - heroLocalX, wz - heroLocalZ) <= pickupRadiusMeters + extraRadius) {
        for (const [k, v] of Object.entries(m.outputBuffer) as Array<[CapytorioItemId, number]>) {
          if (v > 0) {
            this.addPocketItem(k, v);
            collected += v;
            delete m.outputBuffer[k];
          }
        }
      }
    }
    const radiusSq = pickupRadiusMeters * pickupRadiusMeters;
    for (let i = this.spilledItems.length - 1; i >= 0; i--) {
      const sp = this.spilledItems[i];
      const dx = sp.lx - heroLocalX;
      const dz = sp.lz - heroLocalZ;
      if (dx * dx + dz * dz <= radiusSq) {
        this.addPocketItem(sp.item, 1);
        collected += 1;
        this.spilledItems.splice(i, 1);
      }
    }
    return collected;
  }

  public collectAllChestsAndOutputs(): number {
    let collected = 0;
    this.ensureMachineList();
    for (let i = 0; i < this.machineStepList.length; i++) {
      const m = this.machineStepList[i];
      for (const [k, v] of Object.entries(m.outputBuffer) as Array<[CapytorioItemId, number]>) {
        if (v > 0) {
          this.addPocketItem(k, v);
          collected += v;
          delete m.outputBuffer[k];
        }
      }
    }
    for (let i = 0; i < this.spilledItems.length; i++) {
      this.addPocketItem(this.spilledItems[i].item, 1);
      collected += 1;
    }
    this.spilledItems.length = 0;
    return collected;
  }

  /**
   * Computes belt push velocity at local coordinates relative to CAPYTORIO_WORLD_ORIGIN
   * into caller-owned `[0]=vx, [1]=vz` without heap allocation.
   */
  public getBeltMomentumAtLocalPos(localX: number, localZ: number, outVzVx: [number, number]): boolean {
    const gx = Math.round(localX / CAPYTORIO_TILE_SIZE);
    const gz = Math.round(localZ / CAPYTORIO_TILE_SIZE);
    const m = this.getMachineAt(gx, gz);
    if (!m || (m.type !== 'belt' && m.type !== 'splitter')) {
      outVzVx[0] = 0;
      outVzVx[1] = 0;
      return false;
    }
    const speed = this.getBeltSpeedTilesPerSec() * CAPYTORIO_TILE_SIZE * 0.65;
    outVzVx[0] = DIR_DX[m.dir] * speed;
    outVzVx[1] = DIR_DZ[m.dir] * speed;
    return true;
  }

  private ensureMachineList(): void {
    if (!this.machineListDirty) return;
    this.machineStepList.length = 0;
    for (const m of this.machines.values()) {
      this.machineStepList.push(m);
    }
    this.machineListDirty = false;
  }

  private recomputePowerMetrics(): void {
    this.ensureMachineList();
    let supply = 0;
    let demand = 0;
    let activeGenerators = 0;
    const biofluxUnlocked = this.unlockedTechs.has('bioflux_chemistry');
    const genBonus = biofluxUnlocked ? 1.25 : 1.0;

    for (let i = 0; i < this.machineStepList.length; i++) {
      const m = this.machineStepList[i];
      const spec = CAPYTORIO_MACHINE_SPECS[m.type];
      const tierMult = m.tierMult ?? 1.0;
      let baseDemand = spec.powerDemandMw;
      if (m.variantItemId === 'roboport') {
        baseDemand = 0.5;
      } else if (m.variantItemId === 'beacon') {
        baseDemand = 1.2;
      } else if (m.variantItemId === 'radar') {
        baseDemand = 0.4;
      } else if (m.variantItemId === 'pump') {
        baseDemand = 0.15;
      } else if (
        m.variantItemId === 'stone_wall' ||
        m.variantItemId === 'gate' ||
        m.variantItemId === 'small_electric_pole' ||
        m.variantItemId === 'medium_electric_pole' ||
        m.variantItemId === 'big_electric_pole' ||
        m.variantItemId === 'substation' ||
        m.variantItemId === 'pipe' ||
        m.variantItemId === 'pipe_to_ground' ||
        m.variantItemId === 'rail' ||
        m.variantItemId === 'train_stop'
      ) {
        baseDemand = 0;
      }
      if (baseDemand > 0) {
        const mods = this.computeMachineModuleModifiers(m, _moduleModScratch);
        demand += baseDemand * mods.powerMult;
      }
      if (m.type === 'generator') {
        if (m.fuelTimer > 0) activeGenerators++;
        supply += (m.fuelTimer > 0 ? spec.powerSupplyMw : 1.5) * tierMult * genBonus;
      }
    }

    this.powerSupplyMw = +supply.toFixed(2);
    this.powerDemandMw = +demand.toFixed(2);
    if (demand <= 0.001) {
      this.powerEfficiency = supply > 0 ? 1.2 : 1.0;
    } else if (supply >= demand) {
      this.powerEfficiency = Math.min(1.35, 1.0 + (supply - demand) * 0.04);
    } else {
      // Gentle floor so even an unpowered starter setup trickles along rather than freezing dead
      this.powerEfficiency = Math.max(0.35, supply / demand);
    }
    this.lastPowerTopologyRevision = this.topologyRevision;
    this.lastPowerBiofluxUnlocked = biofluxUnlocked;
    this.lastActiveGeneratorCount = activeGenerators;
    this.powerDirty = false;
  }

  private tryAcceptItemIntoTarget(
    target: CapytorioMachine,
    item: CapytorioItemId,
    fromGx: number,
    fromGz: number,
    preferredLane?: 0 | 1,
    initialProgress?: number,
    isInserterDrop: boolean = false
  ): boolean {
    if (target.type === 'splitter') {
      const maxSplitterItems = CAPYTORIO_BELT_MAX_ITEMS_PER_TILE * 2;
      if (target.beltItems.length >= maxSplitterItems) return false;
      // Enforce splitter input priority (left/right) when prioritized feeder belt has ready items
      const inPrio = target.splitterInputPriority;
      if (inPrio === 'left' || inPrio === 'right') {
        const ports = this.getSplitterPorts(target);
        const tDx = DIR_DX[target.dir];
        const tDz = DIR_DZ[target.dir];
        const prioInGx = (inPrio === 'left' ? ports.leftGx : ports.rightGx) - tDx;
        const prioInGz = (inPrio === 'left' ? ports.leftGz : ports.rightGz) - tDz;
        const isFromPrio = fromGx === prioInGx && fromGz === prioInGz;
        if (!isFromPrio && target.beltItems.length >= 2) {
          const prioBelt = this.getMachineAt(prioInGx, prioInGz);
          if (prioBelt && (prioBelt.type === 'belt' || prioBelt.type === 'tunnel' || prioBelt.type === 'splitter')) {
            for (let pi = 0; pi < prioBelt.beltItems.length; pi++) {
              if (prioBelt.beltItems[pi].progress >= 0.65) {
                return false;
              }
            }
          }
        }
      }
      target.beltItems.push({
        uid: this.nextBeltItemUid++,
        item,
        progress: 0.35,
        lane: preferredLane === 1 ? 1 : 0,
        squish: 0,
        edgeProgress: 0,
      });
      return true;
    }

    if (target.type === 'belt' || target.type === 'tunnel') {
      if (target.beltItems.length >= CAPYTORIO_BELT_MAX_ITEMS_PER_TILE) return false;
      const tDx = DIR_DX[target.dir];
      const tDz = DIR_DZ[target.dir];
      const relX = fromGx - target.gx;
      const relZ = fromGz - target.gz;
      const rightDx = -tDz;
      const rightDz = tDx;

      const isInlineBehind = relX === -tDx && relZ === -tDz;
      const isLeftSide = relX === -rightDx && relZ === -rightDz;
      const isRightSide = relX === rightDx && relZ === rightDz;

      const targetCurve = target.type === 'belt' ? getBeltCurveShape(this.occupancyGrid, target) : 'straight';
      const isCurveEntry =
        (targetCurve === 'curve_from_left' && isLeftSide) ||
        (targetCurve === 'curve_from_right' && isRightSide);
      const isContinuousEntry = target.type === 'belt' && (isInlineBehind || isCurveEntry);

      let primaryLane: 0 | 1;
      if (isInserterDrop && (isLeftSide || isRightSide)) {
        // Canonical Factorio rule: inserters drop onto the FAR lane of perpendicular belts
        primaryLane = isLeftSide ? 1 : 0;
      } else if (!isCurveEntry && isLeftSide) {
        primaryLane = 0;
      } else if (!isCurveEntry && isRightSide) {
        primaryLane = 1;
      } else if (preferredLane === 0 || preferredLane === 1) {
        primaryLane = preferredLane;
      } else if (target.type === 'belt') {
        primaryLane = (target.splitterToggle & 1) as 0 | 1;
        target.splitterToggle = (target.splitterToggle + 1) & 1;
      } else {
        primaryLane = 0;
      }

      const fallbackLane: 0 | 1 = primaryLane === 0 ? 1 : 0;
      const allowAltLane =
        !isInserterDrop && !isCurveEntry && !isLeftSide && !isRightSide && preferredLane === undefined;

      for (let attempt = 0; attempt < (allowAltLane ? 2 : 1); attempt++) {
        const lane: 0 | 1 = attempt === 0 ? primaryLane : fallbackLane;
        const arcMeters = target.type === 'belt' ? getBeltLaneArcMeters(targetCurve, lane) : CAPYTORIO_TILE_SIZE;
        const laneCap = target.type === 'belt' ? getBeltLaneCapacity(targetCurve, lane) : CAPYTORIO_BELT_ITEMS_PER_LANE;
        const minGapProg = CAPYTORIO_BELT_ITEM_SPACING_M / arcMeters;
        const minAcceptGapProg = (CAPYTORIO_BELT_ITEM_SPACING_M * 0.96) / arcMeters;
        const halfItemProg = CAPYTORIO_BELT_HALF_ITEM_M / arcMeters;
        const endFlushProg = Math.max(0.5, 1.0 - halfItemProg);

        let laneCount = 0;
        let minExistingProg = Infinity;
        for (let i = 0; i < target.beltItems.length; i++) {
          const existing = target.beltItems[i];
          if ((existing.lane ?? 0) !== lane) continue;
          laneCount++;
          if (existing.progress < minExistingProg) {
            minExistingProg = existing.progress;
          }
        }
        if (laneCount >= laneCap) continue;

        if (isContinuousEntry) {
          if (initialProgress !== undefined && Number.isFinite(initialProgress)) {
            if (minExistingProg < minAcceptGapProg) continue;
            let progress = Math.max(0.002, Math.min(0.24, initialProgress));
            if (minExistingProg < Infinity) {
              progress = Math.max(0.002, Math.min(progress, minExistingProg - minGapProg));
            }
            target.beltItems.push({
              uid: this.nextBeltItemUid++,
              item,
              progress,
              lane,
              squish: 0,
              edgeProgress: 0,
            });
            return true;
          }

          const inlineProg = Math.min(0.18, halfItemProg);
          let blocked = false;
          for (let i = 0; i < target.beltItems.length; i++) {
            const existing = target.beltItems[i];
            if ((existing.lane ?? 0) !== lane) continue;
            if (Math.abs(existing.progress - inlineProg) < minAcceptGapProg) {
              blocked = true;
              break;
            }
          }
          if (!blocked) {
            target.beltItems.push({
              uid: this.nextBeltItemUid++,
              item,
              progress: inlineProg,
              lane,
              squish: 0,
              edgeProgress: 0,
            });
            return true;
          }
          continue;
        }

        let chosenProgress = -1;
        for (let c = 0; c <= laneCap; c++) {
          let cand: number;
          if (c === 0) {
            cand = 0.45;
            if (cand > endFlushProg + 1e-4) continue;
          } else {
            cand = endFlushProg - (c - 1) * minGapProg;
            if (cand > 0.55 || cand < 0.01) continue;
          }
          let blocked = false;
          for (let i = 0; i < target.beltItems.length; i++) {
            const existing = target.beltItems[i];
            if ((existing.lane ?? 0) !== lane) continue;
            if (Math.abs(existing.progress - cand) < minAcceptGapProg) {
              blocked = true;
              break;
            }
          }
          if (!blocked) {
            chosenProgress = cand;
            break;
          }
        }

        if (chosenProgress >= 0) {
          target.beltItems.push({
            uid: this.nextBeltItemUid++,
            item,
            progress: chosenProgress,
            lane,
            squish: 0,
            edgeProgress: 0,
          });
          return true;
        }
      }
      return false;
    }

    if (target.type === 'chest') {
      const total = this.countMapValues(target.outputBuffer);
      if (total >= this.getEffectiveChestCapacity(target)) return false;
      target.outputBuffer[item] = (target.outputBuffer[item] ?? 0) + 1;
      return true;
    }

    if (target.type === 'furnace') {
      if (!getCapytorioSmeltSpec(item)) return false;
      const cur = target.inputBuffer[item] ?? 0;
      if (cur >= 16) return false;
      target.inputBuffer[item] = cur + 1;
      return true;
    }

    if (target.type === 'assembler') {
      const recId = target.recipeId ?? getDefaultAssemblerRecipeId();
      const rec = RECIPE_BY_ID.get(recId);
      if (!rec) return false;
      let needed = false;
      for (let i = 0; i < rec.ingredients.length; i++) {
        if (rec.ingredients[i].item === item) {
          needed = true;
          break;
        }
      }
      if (!needed) return false;
      const cur = target.inputBuffer[item] ?? 0;
      if (cur >= 16) return false;
      target.inputBuffer[item] = cur + 1;
      return true;
    }

    if (target.type === 'generator') {
      if (item !== 'coal' && item !== 'yuzu_sap' && item !== 'orange') return false;
      const cur = target.inputBuffer[item] ?? 0;
      if (cur >= 16) return false;
      target.inputBuffer[item] = cur + 1;
      return true;
    }

    if (target.type === 'lab') {
      const meta = getCapytorioItemMeta(item);
      if (meta.category !== 'science') return false;
      const cur = target.inputBuffer[item] ?? 0;
      if (cur >= 16) return false;
      target.inputBuffer[item] = cur + 1;
      return true;
    }

    return false;
  }

  private countMapValues(rec: Partial<Record<CapytorioItemId, number>>): number {
    let sum = 0;
    for (const k in rec) {
      sum += rec[k as CapytorioItemId] ?? 0;
    }
    return sum;
  }

  private popFirstItem(rec: Partial<Record<CapytorioItemId, number>>): CapytorioItemId | null {
    for (const k in rec) {
      const id = k as CapytorioItemId;
      const count = rec[id] ?? 0;
      if (count > 0) {
        if (count === 1) delete rec[id];
        else rec[id] = count - 1;
        return id;
      }
    }
    return null;
  }

  private checkAndCompleteActiveTech(callbacks?: CapytorioStepCallbacks): void {
    if (!this.activeTechId) return;
    const tech = TECH_BY_ID.get(this.activeTechId);
    if (!tech) return;

    for (const [itemId, reqCount] of Object.entries(tech.cost) as Array<[CapytorioItemId, number]>) {
      if ((this.techDelivered[itemId] ?? 0) < reqCount) {
        return;
      }
    }

    // Completed tech!
    this.unlockedTechs.add(tech.id);
    this.techDelivered = {};
    this.score += 150;
    let isRocketLaunch = false;

    if (tech.id === 'automation_1') {
      this.pocketMachines.drill = (this.pocketMachines.drill ?? 0) + 2;
      this.pocketMachines.belt = (this.pocketMachines.belt ?? 0) + 8;
    } else if (tech.id === 'rocket_silo_prod') {
      this.rocketLaunches += 1;
      isRocketLaunch = true;
    }

    callbacks?.onTechCompleted?.(
      tech.id,
      tech.name,
      tech.rewardDna,
      tech.rewardCoins,
      isRocketLaunch
    );

    if (!tech.repeatable) {
      // Auto-select next available tech for zero-friction flow
      let nextTech: CapytorioTechId | null = null;
      for (let i = 0; i < CAPYTORIO_TECHS.length; i++) {
        if (this.isTechAvailable(CAPYTORIO_TECHS[i].id)) {
          nextTech = CAPYTORIO_TECHS[i].id;
          break;
        }
      }
      this.activeTechId = nextTech;
    }
  }

  public step(dt: number, callbacks?: CapytorioStepCallbacks): void {
    if (dt <= 0) return;
    const clampedDt = Math.min(0.1, dt);
    this.ensureMachineList();
    this.stepCraftingQueue(clampedDt, callbacks);

    // Update fuel timers & recompute power only when power-relevant state changes
    let anyFuelChanged = false;
    let activeGenerators = 0;
    for (let i = 0; i < this.machineStepList.length; i++) {
      const m = this.machineStepList[i];
      if (m.type !== 'generator') continue;
      if (m.fuelTimer > 0) {
        m.fuelTimer = Math.max(0, m.fuelTimer - clampedDt);
        if (m.fuelTimer <= 0) anyFuelChanged = true;
      }
      if (m.fuelTimer <= 0) {
        if ((m.inputBuffer.coal ?? 0) > 0) {
          m.inputBuffer.coal = (m.inputBuffer.coal ?? 1) - 1;
          if (m.inputBuffer.coal <= 0) delete m.inputBuffer.coal;
          m.fuelTimer = 10.0;
          anyFuelChanged = true;
        } else if ((m.inputBuffer.yuzu_sap ?? 0) > 0) {
          m.inputBuffer.yuzu_sap = (m.inputBuffer.yuzu_sap ?? 1) - 1;
          if (m.inputBuffer.yuzu_sap <= 0) delete m.inputBuffer.yuzu_sap;
          m.fuelTimer = 6.5;
          anyFuelChanged = true;
        } else if ((m.inputBuffer.orange ?? 0) > 0) {
          m.inputBuffer.orange = (m.inputBuffer.orange ?? 1) - 1;
          if (m.inputBuffer.orange <= 0) delete m.inputBuffer.orange;
          m.fuelTimer = 5.0;
          anyFuelChanged = true;
        }
      }
      if (m.fuelTimer > 0) {
        activeGenerators++;
      }
    }
    const biofluxNow = this.unlockedTechs.has('bioflux_chemistry');
    if (
      anyFuelChanged ||
      this.powerDirty ||
      this.topologyRevision !== this.lastPowerTopologyRevision ||
      biofluxNow !== this.lastPowerBiofluxUnlocked ||
      activeGenerators !== this.lastActiveGeneratorCount
    ) {
      this.recomputePowerMetrics();
    }

    const craftRate = this.getCraftSpeedMultiplier() * this.powerEfficiency;
    const beltRate = this.getBeltSpeedTilesPerSec();
    const prodBonus = this.getProductivityBonusFraction();

    // Advance belt surface phase strictly 1:1 with simulation item advancement
    this.beltScrollPhase = (this.beltScrollPhase + clampedDt * beltRate) % 1000.0;

    // Reusable scratch tuple for zero-allocation inserter pickup target calculation
    const poseScratch = _inserterPoseScratch;

    for (let i = 0; i < this.machineStepList.length; i++) {
      const m = this.machineStepList[i];
      if ((m.overclockTimer ?? 0) > 0) {
        m.overclockTimer = Math.max(0, (m.overclockTimer ?? 0) - clampedDt);
      }
      const mTierMult = m.tierMult ?? 1.0;
      const fGx = m.gx + DIR_DX[m.dir];
      const fGz = m.gz + DIR_DZ[m.dir];
      const frontTarget = this.getMachineAt(fGx, fGz);

      if (m.type === 'drill') {
        const fp = this.getMachineFootprint(m);
        const oreTile = this.findFirstOreInFootprint(m.gx, m.gz, fp.width, fp.height);
        const bufferedOut = this.countMapValues(m.outputBuffer);
        if (oreTile && bufferedOut < 4) {
          const mods = this.computeMachineModuleModifiers(m, _moduleModScratch);
          m.craftProgress += (clampedDt * craftRate * mTierMult * mods.speedMult) / 2.2;
          if (m.craftProgress >= 1.0) {
            m.craftProgress -= 1.0;
            const mined = this.depleteOreAt(oreTile.gx, oreTile.gz, 1);
            if (mined) {
              m.outputBuffer[mined] = (m.outputBuffer[mined] ?? 0) + 1;
              this.totalProduced += 1;
              this.score += 1;
              m.productivityProgress += prodBonus + mods.prodBonus;
              if (m.productivityProgress >= 1.0) {
                m.productivityProgress -= 1.0;
                m.outputBuffer[mined] = (m.outputBuffer[mined] ?? 0) + 1;
                this.totalProduced += 1;
              }
            }
          }
        }
        const eject = this.getMachineFrontEjectTile(m);
        const ejectTarget = this.getMachineAt(eject.targetGx, eject.targetGz);
        if (ejectTarget && this.countMapValues(m.outputBuffer) > 0) {
          for (const k in m.outputBuffer) {
            const id = k as CapytorioItemId;
            if (
              (m.outputBuffer[id] ?? 0) > 0 &&
              this.tryAcceptItemIntoTarget(ejectTarget, id, eject.edgeGx, eject.edgeGz)
            ) {
              m.outputBuffer[id] = (m.outputBuffer[id] ?? 1) - 1;
              if (m.outputBuffer[id]! <= 0) delete m.outputBuffer[id];
              break;
            }
          }
        }
      } else if (m.type === 'furnace') {
        let activeInput: CapytorioItemId | null = null;
        let smeltSpec: { recipeId: CapytorioRecipeId; result: CapytorioItemId; inputCount: number } | undefined;
        for (const k in m.inputBuffer) {
          const id = k as CapytorioItemId;
          const spec = getCapytorioSmeltSpec(id);
          if (spec && (m.inputBuffer[id] ?? 0) >= spec.inputCount) {
            activeInput = id;
            smeltSpec = spec;
            break;
          }
        }
        const outCount = this.countMapValues(m.outputBuffer);
        if (activeInput && smeltSpec && outCount < 16) {
          const rec = RECIPE_BY_ID.get(smeltSpec.recipeId);
          const craftSec = rec?.craftTimeSec ?? 1.6;
          const mods = this.computeMachineModuleModifiers(m, _moduleModScratch);
          m.craftProgress += (clampedDt * craftRate * mTierMult * mods.speedMult) / craftSec;
          if (m.craftProgress >= 1.0) {
            m.craftProgress -= 1.0;
            m.inputBuffer[activeInput] = (m.inputBuffer[activeInput] ?? smeltSpec.inputCount) - smeltSpec.inputCount;
            if (m.inputBuffer[activeInput]! <= 0) delete m.inputBuffer[activeInput];
            m.outputBuffer[smeltSpec.result] = (m.outputBuffer[smeltSpec.result] ?? 0) + (rec?.resultCount ?? 1);
            this.totalProduced += rec?.resultCount ?? 1;
            this.score += 3 * (rec?.resultCount ?? 1);
            m.productivityProgress += prodBonus + mods.prodBonus;
            if (m.productivityProgress >= 1.0) {
              m.productivityProgress -= 1.0;
              m.outputBuffer[smeltSpec.result] = (m.outputBuffer[smeltSpec.result] ?? 0) + (rec?.resultCount ?? 1);
              this.totalProduced += rec?.resultCount ?? 1;
            }
          }
        } else if (!activeInput) {
          m.craftProgress = 0;
        }
        // Friendly auto-eject onto front-center belt or chest
        const eject = this.getMachineFrontEjectTile(m);
        const ejectTarget = this.getMachineAt(eject.targetGx, eject.targetGz);
        if (
          ejectTarget &&
          (ejectTarget.type === 'belt' ||
            ejectTarget.type === 'splitter' ||
            ejectTarget.type === 'chest' ||
            ejectTarget.type === 'tunnel')
        ) {
          for (const k in m.outputBuffer) {
            const id = k as CapytorioItemId;
            if (
              (m.outputBuffer[id] ?? 0) > 0 &&
              this.tryAcceptItemIntoTarget(ejectTarget, id, eject.edgeGx, eject.edgeGz)
            ) {
              m.outputBuffer[id] = (m.outputBuffer[id] ?? 1) - 1;
              if (m.outputBuffer[id]! <= 0) delete m.outputBuffer[id];
              break;
            }
          }
        }
      } else if (m.type === 'assembler') {
        const rec = RECIPE_BY_ID.get(m.recipeId ?? getDefaultAssemblerRecipeId());
        if (rec) {
          let hasAll = true;
          for (let j = 0; j < rec.ingredients.length; j++) {
            const ing = rec.ingredients[j];
            if ((m.inputBuffer[ing.item] ?? 0) < ing.count) {
              hasAll = false;
              break;
            }
          }
          const outCount = this.countMapValues(m.outputBuffer);
          if (hasAll && outCount < 20) {
            const mods = this.computeMachineModuleModifiers(m, _moduleModScratch);
            m.craftProgress += (clampedDt * craftRate * mTierMult * mods.speedMult) / rec.craftTimeSec;
            if (m.craftProgress >= 1.0) {
              m.craftProgress -= 1.0;
              for (let j = 0; j < rec.ingredients.length; j++) {
                const ing = rec.ingredients[j];
                m.inputBuffer[ing.item] = (m.inputBuffer[ing.item] ?? ing.count) - ing.count;
                if (m.inputBuffer[ing.item]! <= 0) delete m.inputBuffer[ing.item];
              }
              m.outputBuffer[rec.result] = (m.outputBuffer[rec.result] ?? 0) + rec.resultCount;
              this.totalProduced += rec.resultCount;
              this.score += 6 * rec.resultCount;
              callbacks?.onMilestoneItem?.(rec.result, rec.resultCount);

              m.productivityProgress += prodBonus + mods.prodBonus;
              if (m.productivityProgress >= 1.0) {
                m.productivityProgress -= 1.0;
                m.outputBuffer[rec.result] = (m.outputBuffer[rec.result] ?? 0) + rec.resultCount;
                this.totalProduced += rec.resultCount;
              }
            }
          } else if (!hasAll) {
            m.craftProgress = 0;
          }
        }
        const eject = this.getMachineFrontEjectTile(m);
        const ejectTarget = this.getMachineAt(eject.targetGx, eject.targetGz);
        if (
          ejectTarget &&
          (ejectTarget.type === 'belt' ||
            ejectTarget.type === 'splitter' ||
            ejectTarget.type === 'chest' ||
            ejectTarget.type === 'tunnel')
        ) {
          for (const k in m.outputBuffer) {
            const id = k as CapytorioItemId;
            if (
              (m.outputBuffer[id] ?? 0) > 0 &&
              this.tryAcceptItemIntoTarget(ejectTarget, id, eject.edgeGx, eject.edgeGz)
            ) {
              m.outputBuffer[id] = (m.outputBuffer[id] ?? 1) - 1;
              if (m.outputBuffer[id]! <= 0) delete m.outputBuffer[id];
              break;
            }
          }
        }
      } else if (m.type === 'lab') {
        if (this.activeTechId && m.variantItemId !== 'beacon' && m.variantItemId !== 'radar') {
          const tech = TECH_BY_ID.get(this.activeTechId);
          if (tech) {
            let consumedPack = false;
            const mods = this.computeMachineModuleModifiers(m, _moduleModScratch);
            for (const [sciId, reqCount] of Object.entries(tech.cost) as Array<[CapytorioItemId, number]>) {
              const deliv = this.techDelivered[sciId] ?? 0;
              if (deliv < reqCount && (m.inputBuffer[sciId] ?? 0) > 0) {
                m.craftProgress += (clampedDt * craftRate * mods.speedMult) / 1.4;
                if (m.craftProgress >= 1.0) {
                  m.craftProgress -= 1.0;
                  m.inputBuffer[sciId] = (m.inputBuffer[sciId] ?? 1) - 1;
                  if (m.inputBuffer[sciId]! <= 0) delete m.inputBuffer[sciId];
                  this.techDelivered[sciId] = deliv + 1;
                  this.score += 25;
                  callbacks?.onMilestoneItem?.(sciId, 1);
                  consumedPack = true;
                }
                break;
              }
            }
            if (consumedPack) {
              this.checkAndCompleteActiveTech(callbacks);
            }
          }
        }
      } else if (m.type === 'belt') {
        const tileBeltRate = beltRate * mTierMult;
        const curveShape = getBeltCurveShape(this.occupancyGrid, m);
        // Sort beltItems highest-progress first (<= 8 items, zero-allocation insertion sort)
        for (let a = 1; a < m.beltItems.length; a++) {
          const cur = m.beltItems[a];
          let b = a - 1;
          while (b >= 0 && m.beltItems[b].progress < cur.progress) {
            m.beltItems[b + 1] = m.beltItems[b];
            b--;
          }
          m.beltItems[b + 1] = cur;
        }

        // Check if frontTarget is a continuously connected belt (inline continuation or 90° corner curve)
        let frontCurve: CapytorioBeltCurveShape = 'straight';
        let isContinuousBeltFront = false;
        if (frontTarget && frontTarget.type === 'belt') {
          frontCurve = getBeltCurveShape(this.occupancyGrid, frontTarget);
          const ftDx = DIR_DX[frontTarget.dir];
          const ftDz = DIR_DZ[frontTarget.dir];
          const ftRightDx = -ftDz;
          const ftRightDz = ftDx;
          const relX = m.gx - frontTarget.gx;
          const relZ = m.gz - frontTarget.gz;
          isContinuousBeltFront =
            (relX === -ftDx && relZ === -ftDz) ||
            (frontCurve === 'curve_from_left' && relX === -ftRightDx && relZ === -ftRightDz) ||
            (frontCurve === 'curve_from_right' && relX === ftRightDx && relZ === ftRightDz);
        }

        const arc0 = getBeltLaneArcMeters(curveShape, 0);
        const arc1 = getBeltLaneArcMeters(curveShape, 1);
        const endFlush0 = Math.max(0.5, 1.0 - CAPYTORIO_BELT_HALF_ITEM_M / arc0);
        const endFlush1 = Math.max(0.5, 1.0 - CAPYTORIO_BELT_HALF_ITEM_M / arc1);

        let lane0Max: number;
        let lane1Max: number;
        if (isContinuousBeltFront && frontTarget) {
          const frontArc0 = getBeltLaneArcMeters(frontCurve, 0);
          const frontArc1 = getBeltLaneArcMeters(frontCurve, 1);
          const frontCap0 = getBeltLaneCapacity(frontCurve, 0);
          const frontCap1 = getBeltLaneCapacity(frontCurve, 1);
          let minFront0 = Infinity;
          let minFront1 = Infinity;
          let countFront0 = 0;
          let countFront1 = 0;
          for (let fi = 0; fi < frontTarget.beltItems.length; fi++) {
            const fb = frontTarget.beltItems[fi];
            if ((fb.lane ?? 0) === 0) {
              countFront0++;
              if (fb.progress < minFront0) minFront0 = fb.progress;
            } else {
              countFront1++;
              if (fb.progress < minFront1) minFront1 = fb.progress;
            }
          }
          const tailM0 = minFront0 < Infinity ? minFront0 * frontArc0 : Infinity;
          const tailM1 = minFront1 < Infinity ? minFront1 * frontArc1 : Infinity;
          lane0Max =
            tailM0 < CAPYTORIO_BELT_ITEM_SPACING_M - 1e-4 || countFront0 >= frontCap0
              ? Math.max(0, 1.0 - Math.max(0, CAPYTORIO_BELT_ITEM_SPACING_M - Math.min(tailM0, CAPYTORIO_BELT_ITEM_SPACING_M)) / arc0)
              : 1.0;
          lane1Max =
            tailM1 < CAPYTORIO_BELT_ITEM_SPACING_M - 1e-4 || countFront1 >= frontCap1
              ? Math.max(0, 1.0 - Math.max(0, CAPYTORIO_BELT_ITEM_SPACING_M - Math.min(tailM1, CAPYTORIO_BELT_ITEM_SPACING_M)) / arc1)
              : 1.0;
        } else if (frontTarget) {
          lane0Max = endFlush0;
          lane1Max = endFlush1;
        } else {
          lane0Max = this.beltEndSpillEnabled ? 1.0 : endFlush0;
          lane1Max = this.beltEndSpillEnabled ? 1.0 : endFlush1;
        }

        const worldStepMeters = clampedDt * tileBeltRate * CAPYTORIO_TILE_SIZE;
        for (let bi = 0; bi < m.beltItems.length; bi++) {
          const bItem = m.beltItems[bi];
          if (bItem.uid === undefined) bItem.uid = this.nextBeltItemUid++;
          const lane: 0 | 1 = bItem.lane === 1 ? 1 : 0;
          const arcMeters = lane === 0 ? arc0 : arc1;
          const endFlush = lane === 0 ? endFlush0 : endFlush1;
          const laneAdvance = worldStepMeters / arcMeters;
          const maxAllow = lane === 0 ? lane0Max : lane1Max;
          const rawNext = bItem.progress + laneAdvance;
          bItem.progress = Math.min(maxAllow, rawNext);

          if (frontTarget) {
            if (isContinuousBeltFront) {
              if (maxAllow >= 0.999 && (rawNext >= 1.0 || bItem.progress >= 0.995)) {
                const frontArcMeters = getBeltLaneArcMeters(frontCurve, lane);
                const carryoverProg = Math.max(0.002, (rawNext - 1.0) * (arcMeters / frontArcMeters));
                if (this.tryAcceptItemIntoTarget(frontTarget, bItem.item, m.gx, m.gz, lane, carryoverProg)) {
                  // Immediately propagate exact cross-seam backpressure to trailing items in this lane
                  const placedItem = frontTarget.beltItems[frontTarget.beltItems.length - 1];
                  const placedTailMeters = (placedItem ? placedItem.progress : carryoverProg) * frontArcMeters;
                  const afterSeamMax = Math.max(
                    0,
                    1.0 - Math.max(0, CAPYTORIO_BELT_ITEM_SPACING_M - placedTailMeters) / arcMeters
                  );
                  if (lane === 0) {
                    if (afterSeamMax < lane0Max) lane0Max = afterSeamMax;
                  } else {
                    if (afterSeamMax < lane1Max) lane1Max = afterSeamMax;
                  }
                  m.beltItems.splice(bi, 1);
                  bi--;
                  continue;
                }
              }
            } else if (rawNext >= endFlush - 0.005 || bItem.progress >= endFlush - 0.005) {
              if (this.tryAcceptItemIntoTarget(frontTarget, bItem.item, m.gx, m.gz, lane)) {
                m.beltItems.splice(bi, 1);
                bi--;
                continue;
              }
            }
          }

          // Open belt end overhang & spill-off when enabled by user option
          if (bItem.progress >= 0.99 && !frontTarget && this.beltEndSpillEnabled) {
            let pushedFromBehind = false;
            for (let k = bi + 1; k < m.beltItems.length; k++) {
              if ((m.beltItems[k].lane === 1 ? 1 : 0) === lane && m.beltItems[k].progress >= 0.65) {
                pushedFromBehind = true;
                break;
              }
            }
            const edgeRate = tileBeltRate * (pushedFromBehind ? 3.2 : 2.1);
            const nextEdge = (bItem.edgeProgress ?? 0) + clampedDt * edgeRate;
            bItem.edgeProgress = nextEdge;
            bItem.squish = 0;
            if (nextEdge >= 1.0) {
              this.spawnSpilledItemFromBelt(m, curveShape, lane, bItem.item, tileBeltRate, pushedFromBehind);
              m.beltItems.splice(bi, 1);
              bi--;
              continue;
            }
          } else {
            if ((bItem.edgeProgress ?? 0) > 0) {
              bItem.edgeProgress = Math.max(0, (bItem.edgeProgress ?? 0) - clampedDt * 6.0);
            }
            bItem.squish = 0;
          }

          // Exact Factorio touching spacing (0.625 m along belt arc -> 0.25 tile on straight belts)
          const minGapProg = CAPYTORIO_BELT_ITEM_SPACING_M / arcMeters;
          const nextLimit = Math.max(0, bItem.progress - minGapProg);
          if (lane === 0) {
            if (nextLimit < lane0Max) lane0Max = nextLimit;
          } else {
            if (nextLimit < lane1Max) lane1Max = nextLimit;
          }
        }
      } else if (m.type === 'splitter') {
        if (m.beltItems.length > 0) {
          const ports = this.getSplitterPorts(m);
          const leftOut = this.getMachineAt(ports.leftOutGx, ports.leftOutGz);
          const rightOut = this.getMachineAt(ports.rightOutGx, ports.rightOutGz);
          const filterItem = m.splitterFilterItem ?? null;
          const outPrio = m.splitterOutputPriority ?? 'none';

          // Process up to 2 items per step to sustain full dual-belt throughput
          let dispatches = 0;
          for (let bi = 0; bi < m.beltItems.length && dispatches < 2; bi++) {
            const candItem = m.beltItems[bi];
            let transferred = false;

            if (filterItem) {
              // Strict Factorio filter routing: matching items go strictly to prioritized output side
              const filterSideIsRight = outPrio === 'right';
              const wantsRight =
                candItem.item === filterItem ? filterSideIsRight : !filterSideIsRight;
              const tgt = wantsRight ? rightOut : leftOut;
              const fromGx = wantsRight ? ports.rightGx : ports.leftGx;
              const fromGz = wantsRight ? ports.rightGz : ports.leftGz;
              if (tgt && this.tryAcceptItemIntoTarget(tgt, candItem.item, fromGx, fromGz, candItem.lane)) {
                m.beltItems.splice(bi, 1);
                bi--;
                dispatches++;
                transferred = true;
              }
            } else {
              // Priority or alternating 50/50 split across Left & Right exit ports
              const tryRightFirst =
                outPrio === 'right'
                  ? true
                  : outPrio === 'left'
                    ? false
                    : (m.splitterToggle & 1) === 1;
              for (let attempt = 0; attempt < 2; attempt++) {
                const useRight = attempt === 0 ? tryRightFirst : !tryRightFirst;
                const tgt = useRight ? rightOut : leftOut;
                const fromGx = useRight ? ports.rightGx : ports.leftGx;
                const fromGz = useRight ? ports.rightGz : ports.leftGz;
                if (tgt && this.tryAcceptItemIntoTarget(tgt, candItem.item, fromGx, fromGz, candItem.lane)) {
                  m.beltItems.splice(bi, 1);
                  bi--;
                  dispatches++;
                  if (outPrio === 'none') {
                    m.splitterToggle = useRight ? 0 : 1;
                  }
                  transferred = true;
                  break;
                }
              }
            }

            if (!transferred && candItem.progress < 0.7) {
              candItem.progress = Math.min(0.7, candItem.progress + clampedDt * beltRate * mTierMult);
            }
          }
        }
      } else if (m.type === 'tunnel') {
        if (m.beltItems.length > 0) {
          const item = m.beltItems[0].item;
          let jumped = false;
          for (let dist = 1; dist <= 6; dist++) {
            const exitM = this.getMachineAt(
              m.gx + DIR_DX[m.dir] * dist,
              m.gz + DIR_DZ[m.dir] * dist
            );
            if (exitM && exitM.type === 'tunnel' && exitM.dir === m.dir) {
              const afterExit = this.getMachineAt(
                exitM.gx + DIR_DX[m.dir],
                exitM.gz + DIR_DZ[m.dir]
              );
              if (afterExit && this.tryAcceptItemIntoTarget(afterExit, item, exitM.gx, exitM.gz)) {
                m.beltItems.shift();
                jumped = true;
              }
              break;
            }
          }
          if (!jumped && frontTarget && this.tryAcceptItemIntoTarget(frontTarget, item, m.gx, m.gz)) {
            m.beltItems.shift();
          }
        }
      } else if (m.type === 'inserter') {
        const iFwdDx = DIR_DX[m.dir];
        const iFwdDz = DIR_DZ[m.dir];
        const iRightDx = -iFwdDz;
        const iRightDz = iFwdDx;
        const reach = getCapytorioInserterReach(m.variantItemId);
        const srcGx = m.gx - iFwdDx * reach;
        const srcGz = m.gz - iFwdDz * reach;
        const dstGx = m.gx + iFwdDx * reach;
        const dstGz = m.gz + iFwdDz * reach;
        const srcM = this.getMachineAt(srcGx, srcGz);
        const dstTarget = this.getMachineAt(dstGx, dstGz);
        const dropFromGx = dstGx - iFwdDx;
        const dropFromGz = dstGz - iFwdDz;
        const effectiveStack = this.getEffectiveInserterStack(m);
        const swingSpeed = 2.05 * mTierMult * Math.max(0.5, this.powerEfficiency);
        const reachSpeed = 4.6 * mTierMult * Math.max(0.5, this.powerEfficiency);
        const returnSpeed = 2.3 * mTierMult * Math.max(0.5, this.powerEfficiency);
        const defaultReachDist = CAPYTORIO_TILE_SIZE * (reach - 0.1);

        if (!m.inserterPhase) {
          m.inserterPhase = m.holdingItem
            ? 'carrying'
            : m.armSwing > 0.01
              ? 'returning'
              : 'idle_pickup';
          m.armExtend = m.holdingItem ? 1.0 : 0;
        }

        // Compute drop target in inserter's local coordinates (-Z = forward, +X = right)
        if (dstTarget && (dstTarget.type === 'belt' || dstTarget.type === 'splitter' || dstTarget.type === 'tunnel')) {
          const tDx = DIR_DX[dstTarget.dir];
          const tDz = DIR_DZ[dstTarget.dir];
          const relX = dropFromGx - dstGx;
          const relZ = dropFromGz - dstGz;
          const tRightDx = -tDz;
          const tRightDz = tDx;
          const isLeft = relX === -tRightDx && relZ === -tRightDz;
          const isRight = relX === tRightDx && relZ === tRightDz;
          const dropLane: 0 | 1 = isLeft ? 1 : isRight ? 0 : 0;
          const fCurve = dstTarget.type === 'belt' ? getBeltCurveShape(this.occupancyGrid, dstTarget) : 'straight';
          evalBeltItemLocalPose(fCurve, dropLane, isLeft || isRight ? 0.45 : 0.08, poseScratch);
          const tgtDx = (dstGx - m.gx) * CAPYTORIO_TILE_SIZE + tRightDx * poseScratch[0] - tDx * poseScratch[1];
          const tgtDz = (dstGz - m.gz) * CAPYTORIO_TILE_SIZE + tRightDz * poseScratch[0] - tDz * poseScratch[1];
          m.dropLocalX = iRightDx * tgtDx + iRightDz * tgtDz;
          m.dropLocalZ = -(iFwdDx * tgtDx + iFwdDz * tgtDz);
        } else {
          m.dropLocalX = 0;
          m.dropLocalZ = -defaultReachDist;
        }

        if (m.inserterPhase === 'idle_pickup') {
          m.armSwing = 0;
          m.armExtend = Math.max(0, (m.armExtend ?? 0) - clampedDt * reachSpeed);
          if (!m.holdingItem && dstTarget) {
            if (srcM) {
              if (srcM.type === 'belt' || srcM.type === 'splitter' || srcM.type === 'tunnel') {
                for (let bi = 0; bi < srcM.beltItems.length; bi++) {
                  const candItem = srcM.beltItems[bi];
                  if (
                    this.doesInserterAllowItem(m, candItem.item) &&
                    this.wouldMachineAccept(dstTarget, candItem.item)
                  ) {
                    if (candItem.uid === undefined) candItem.uid = this.nextBeltItemUid++;
                    m.targetBeltUid = candItem.uid;
                    m.pickupLane = candItem.lane === 1 ? 1 : 0;
                    m.inserterPhase = 'reaching';
                    m.armExtend = 0.05;
                    break;
                  }
                }
              } else if (
                srcM.type === 'drill' ||
                srcM.type === 'furnace' ||
                srcM.type === 'assembler' ||
                srcM.type === 'chest'
              ) {
                for (const k in srcM.outputBuffer) {
                  const cand = k as CapytorioItemId;
                  if (
                    (srcM.outputBuffer[cand] ?? 0) > 0 &&
                    this.doesInserterAllowItem(m, cand) &&
                    this.wouldMachineAccept(dstTarget, cand)
                  ) {
                    m.targetBeltUid = undefined;
                    m.pickupLane = 0;
                    m.pickupLocalX = 0;
                    m.pickupLocalZ = defaultReachDist;
                    m.inserterPhase = 'reaching';
                    m.armExtend = 0.05;
                    break;
                  }
                }
              }
            } else if (this.spilledItems.length > 0) {
              const srcCenterX = srcGx * CAPYTORIO_TILE_SIZE;
              const srcCenterZ = srcGz * CAPYTORIO_TILE_SIZE;
              const halfTile = CAPYTORIO_TILE_SIZE * 0.65;
              for (let si = 0; si < this.spilledItems.length; si++) {
                const sp = this.spilledItems[si];
                if (
                  sp.y <= 0.35 &&
                  Math.abs(sp.lx - srcCenterX) <= halfTile &&
                  Math.abs(sp.lz - srcCenterZ) <= halfTile &&
                  this.doesInserterAllowItem(m, sp.item) &&
                  this.wouldMachineAccept(dstTarget, sp.item)
                ) {
                  m.targetBeltUid = -sp.uid;
                  m.pickupLane = 0;
                  const deltaX = sp.lx - m.gx * CAPYTORIO_TILE_SIZE;
                  const deltaZ = sp.lz - m.gz * CAPYTORIO_TILE_SIZE;
                  m.pickupLocalX = iRightDx * deltaX + iRightDz * deltaZ;
                  m.pickupLocalZ = -(iFwdDx * deltaX + iFwdDz * deltaZ);
                  m.inserterPhase = 'reaching';
                  m.armExtend = 0.05;
                  break;
                }
              }
            }
          }
        }

        if (m.inserterPhase === 'reaching') {
          m.armSwing = 0;
          let targetReady = false;
          let grabbedItem: CapytorioItemId | null = null;
          let shouldGrabNow = false;

          m.armExtend = Math.min(1.0, (m.armExtend ?? 0) + clampedDt * reachSpeed);
          shouldGrabNow = (m.armExtend ?? 0) >= 1.0;

          if (dstTarget) {
            if (srcM) {
              if (srcM.type === 'belt' || srcM.type === 'splitter' || srcM.type === 'tunnel') {
                let foundIdx = -1;
                for (let bi = 0; bi < srcM.beltItems.length; bi++) {
                  if (srcM.beltItems[bi].uid === m.targetBeltUid) {
                    foundIdx = bi;
                    break;
                  }
                }
                if (foundIdx === -1 && srcM.beltItems.length > 0) {
                  for (let bi = 0; bi < srcM.beltItems.length; bi++) {
                    const candItem = srcM.beltItems[bi].item;
                    if (
                      this.doesInserterAllowItem(m, candItem) &&
                      this.wouldMachineAccept(dstTarget, candItem)
                    ) {
                      foundIdx = bi;
                      m.targetBeltUid = srcM.beltItems[bi].uid;
                      break;
                    }
                  }
                }
                if (foundIdx !== -1) {
                  const bItem = srcM.beltItems[foundIdx];
                  if (
                    this.doesInserterAllowItem(m, bItem.item) &&
                    this.wouldMachineAccept(dstTarget, bItem.item)
                  ) {
                    targetReady = true;
                    m.pickupLane = bItem.lane === 1 ? 1 : 0;
                    const sCurve = srcM.type === 'belt' ? getBeltCurveShape(this.occupancyGrid, srcM) : 'straight';
                    evalBeltItemLocalPose(sCurve, m.pickupLane, bItem.progress, poseScratch);
                    const sDx = DIR_DX[srcM.dir];
                    const sDz = DIR_DZ[srcM.dir];
                    const sRightDx = -sDz;
                    const sRightDz = sDx;
                    const itemWorldDeltaX = (srcGx - m.gx) * CAPYTORIO_TILE_SIZE + sRightDx * poseScratch[0] - sDx * poseScratch[1];
                    const itemWorldDeltaZ = (srcGz - m.gz) * CAPYTORIO_TILE_SIZE + sRightDz * poseScratch[0] - sDz * poseScratch[1];
                    m.pickupLocalX = iRightDx * itemWorldDeltaX + iRightDz * itemWorldDeltaZ;
                    m.pickupLocalZ = -(iFwdDx * itemWorldDeltaX + iFwdDz * itemWorldDeltaZ);

                    if (shouldGrabNow) {
                      grabbedItem = bItem.item;
                      srcM.beltItems.splice(foundIdx, 1);
                    }
                  }
                }
              } else if (
                srcM.type === 'drill' ||
                srcM.type === 'furnace' ||
                srcM.type === 'assembler' ||
                srcM.type === 'chest'
              ) {
                m.pickupLocalX = 0;
                m.pickupLocalZ = defaultReachDist;
                for (const k in srcM.outputBuffer) {
                  const cand = k as CapytorioItemId;
                  if (
                    (srcM.outputBuffer[cand] ?? 0) > 0 &&
                    this.doesInserterAllowItem(m, cand) &&
                    this.wouldMachineAccept(dstTarget, cand)
                  ) {
                    targetReady = true;
                    if (shouldGrabNow) {
                      grabbedItem = cand;
                      srcM.outputBuffer[cand] = (srcM.outputBuffer[cand] ?? 1) - 1;
                      if (srcM.outputBuffer[cand]! <= 0) delete srcM.outputBuffer[cand];
                    }
                    break;
                  }
                }
              }
            } else if (this.spilledItems.length > 0) {
              const targetSpillUid = m.targetBeltUid !== undefined && m.targetBeltUid < 0 ? -m.targetBeltUid : -1;
              const srcCenterX = srcGx * CAPYTORIO_TILE_SIZE;
              const srcCenterZ = srcGz * CAPYTORIO_TILE_SIZE;
              const halfTile = CAPYTORIO_TILE_SIZE * 0.65;
              let foundIdx = -1;
              if (targetSpillUid > 0) {
                for (let si = 0; si < this.spilledItems.length; si++) {
                  if (this.spilledItems[si].uid === targetSpillUid) {
                    foundIdx = si;
                    break;
                  }
                }
              }
              if (foundIdx === -1) {
                for (let si = 0; si < this.spilledItems.length; si++) {
                  const sp = this.spilledItems[si];
                  if (
                    sp.y <= 0.35 &&
                    Math.abs(sp.lx - srcCenterX) <= halfTile &&
                    Math.abs(sp.lz - srcCenterZ) <= halfTile &&
                    this.doesInserterAllowItem(m, sp.item) &&
                    this.wouldMachineAccept(dstTarget, sp.item)
                  ) {
                    foundIdx = si;
                    m.targetBeltUid = -sp.uid;
                    break;
                  }
                }
              }
              if (foundIdx !== -1) {
                const sp = this.spilledItems[foundIdx];
                if (
                  this.doesInserterAllowItem(m, sp.item) &&
                  this.wouldMachineAccept(dstTarget, sp.item)
                ) {
                  targetReady = true;
                  const deltaX = sp.lx - m.gx * CAPYTORIO_TILE_SIZE;
                  const deltaZ = sp.lz - m.gz * CAPYTORIO_TILE_SIZE;
                  m.pickupLocalX = iRightDx * deltaX + iRightDz * deltaZ;
                  m.pickupLocalZ = -(iFwdDx * deltaX + iFwdDz * deltaZ);
                  if (shouldGrabNow) {
                    grabbedItem = sp.item;
                    this.spilledItems.splice(foundIdx, 1);
                  }
                }
              }
            }
          }

          if (!targetReady) {
            m.inserterPhase = 'idle_pickup';
            m.armExtend = 0;
            m.targetBeltUid = undefined;
          } else if (grabbedItem) {
            m.holdingItem = grabbedItem;
            m.targetBeltUid = undefined;
            m.inserterPhase = 'carrying';
            m.armExtend = 1.0;
            m.armSwing = 0;
          }
        } else if (m.inserterPhase === 'carrying') {
          if (!m.holdingItem) {
            m.inserterPhase = 'returning';
          } else {
            m.armSwing = Math.min(1.0, m.armSwing + clampedDt * swingSpeed);
            m.armExtend = 1.0;
            if (m.armSwing >= 1.0 && dstTarget) {
              if (
                this.tryAcceptItemIntoTarget(
                  dstTarget,
                  m.holdingItem,
                  dropFromGx,
                  dropFromGz,
                  undefined,
                  undefined,
                  true
                )
              ) {
                if (
                  effectiveStack > 1 &&
                  srcM &&
                  (srcM.type === 'chest' || srcM.type === 'furnace' || srcM.type === 'assembler' || srcM.type === 'drill')
                ) {
                  for (let extra = 1; extra < effectiveStack; extra++) {
                    const avail = srcM.outputBuffer[m.holdingItem] ?? 0;
                    if (
                      avail > 0 &&
                      this.tryAcceptItemIntoTarget(
                        dstTarget,
                        m.holdingItem,
                        dropFromGx,
                        dropFromGz,
                        undefined,
                        undefined,
                        true
                      )
                    ) {
                      srcM.outputBuffer[m.holdingItem] = avail - 1;
                      if (avail - 1 <= 0) delete srcM.outputBuffer[m.holdingItem];
                    } else {
                      break;
                    }
                  }
                }
                m.holdingItem = null;
                m.armSwing = 1.0;
                m.inserterPhase = 'returning';
              }
            }
          }
        } else if (m.inserterPhase === 'returning') {
          m.armSwing = Math.max(0, m.armSwing - clampedDt * returnSpeed);
          m.armExtend = Math.max(0, (m.armExtend ?? 1.0) - clampedDt * returnSpeed * 1.4);
          if (m.armSwing <= 0.001) {
            m.armSwing = 0;
            m.armExtend = 0;
            m.inserterPhase = 'idle_pickup';
          }
        }
      }
    }

    this.stepSpilledItems(clampedDt);
    this.evaluateMilestonesIfDirty(activeGenerators, callbacks);

    if (this.score !== this.lastReportedScore) {
      this.lastReportedScore = this.score;
      callbacks?.onScoreChanged?.(this.score);
    }
  }

  private spawnSpilledItemFromBelt(
    belt: CapytorioMachine,
    curveShape: CapytorioBeltCurveShape,
    lane: 0 | 1,
    item: CapytorioItemId,
    tileBeltRate: number,
    pushedFromBehind: boolean
  ): void {
    const uid = this.nextSpilledItemUid++;
    const fwdDx = DIR_DX[belt.dir];
    const fwdDz = DIR_DZ[belt.dir];
    const rightDx = -fwdDz;
    const rightDz = fwdDx;

    evalBeltItemLocalPose(curveShape, lane, 1.0, _inserterPoseScratch);
    // Start just past the belt roller lip
    const lipLocalX = _inserterPoseScratch[0];
    const lipLocalZ = _inserterPoseScratch[1] - 0.34;
    const lx = belt.gx * CAPYTORIO_TILE_SIZE + rightDx * lipLocalX - fwdDx * lipLocalZ;
    const lz = belt.gz * CAPYTORIO_TILE_SIZE + rightDz * lipLocalX - fwdDz * lipLocalZ;

    // Deterministic pseudo-random jitter from uid so piles fan out naturally without Math.random instability
    const h1 = Math.sin(uid * 12.9898 + belt.gx * 78.233 + belt.gz * 37.719) * 43758.5453;
    const jitterA = (h1 - Math.floor(h1)) * 2 - 1; // -1..1
    const h2 = Math.sin(uid * 93.989 + belt.gz * 19.19) * 24634.6345;
    const jitterB = (h2 - Math.floor(h2)) * 2 - 1;

    const launchSpeed = Math.max(1.35, tileBeltRate * CAPYTORIO_TILE_SIZE * (pushedFromBehind ? 1.15 : 0.85));
    const lateralSpeed = jitterA * 0.55;

    if (this.spilledItems.length >= MAX_CAPYTORIO_SPILLED_ITEMS) {
      let evictIdx = 0;
      for (let i = 0; i < this.spilledItems.length; i++) {
        if (this.spilledItems[i].settled) {
          evictIdx = i;
          break;
        }
      }
      this.spilledItems.splice(evictIdx, 1);
    }

    this.spilledItems.push({
      uid,
      item,
      lx,
      y: CAPYTORIO_BELT_SURFACE_Y,
      lz,
      vx: fwdDx * launchSpeed + rightDx * lateralSpeed,
      vy: 0.72 + Math.abs(jitterB) * 0.35,
      vz: fwdDz * launchSpeed + rightDz * lateralSpeed,
      rx: -0.45,
      ry: -belt.dir * (Math.PI * 0.5) + jitterB * 0.35,
      rz: 0,
      vrx: (fwdDz !== 0 ? -fwdDz : fwdDx) * (3.2 + Math.abs(jitterA) * 2.4),
      vrz: jitterB * 3.4,
      squish: 0.35,
      settled: false,
      ageSec: 0,
    });
    this.spilledSeparationDirty = true;
  }

  private stepSpilledItems(dt: number): void {
    const count = this.spilledItems.length;
    if (count === 0) {
      this.spilledSeparationDirty = false;
      return;
    }

    const gravity = 14.5;
    const restitution = 0.28;
    const groundDrag = Math.exp(-7.5 * dt);
    const airDrag = Math.exp(-0.9 * dt);
    const minSep = 0.34;
    const minSepSq = minSep * minSep;
    let unsettledCount = 0;

    for (let i = 0; i < count; i++) {
      const sp = this.spilledItems[i];
      sp.ageSec += dt;
      if (sp.squish > 0) {
        sp.squish = Math.max(0, sp.squish - dt * 4.8);
      }

      if (!sp.settled) {
        sp.vy -= gravity * dt;
        sp.lx += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.lz += sp.vz * dt;
        sp.rx += sp.vrx * dt;
        sp.rz += sp.vrz * dt;

        if (sp.y <= 0) {
          sp.y = 0;
          if (sp.vy < -0.55) {
            sp.vy = -sp.vy * restitution;
            sp.squish = Math.min(1.0, Math.max(sp.squish, 0.72));
            sp.vx *= 0.72;
            sp.vz *= 0.72;
            sp.vrx *= 0.5;
            sp.vrz *= 0.5;
          } else {
            sp.vy = 0;
            sp.vx *= groundDrag;
            sp.vz *= groundDrag;
            // Ease tumble angles flat on the meadow
            sp.rx *= Math.exp(-8.0 * dt);
            sp.rz *= Math.exp(-8.0 * dt);
            sp.vrx = 0;
            sp.vrz = 0;
            if (Math.hypot(sp.vx, sp.vz) < 0.06 && Math.abs(sp.rx) < 0.05 && Math.abs(sp.rz) < 0.05) {
              sp.vx = 0;
              sp.vz = 0;
              sp.rx = 0;
              sp.rz = 0;
              sp.settled = true;
            }
          }
        } else {
          sp.vx *= airDrag;
          sp.vz *= airDrag;
        }
        if (!sp.settled) {
          unsettledCount++;
          this.spilledSeparationDirty = true;
        }
      }
    }

    // Skip O(N^2) pairwise collision loop once all spilled items are settled and separated
    if (unsettledCount === 0 && !this.spilledSeparationDirty) {
      return;
    }

    // Gentle local pile separation so spilled items fan out instead of stacking on one point
    let anySeparated = false;
    for (let i = 0; i < count; i++) {
      const a = this.spilledItems[i];
      if (a.y > 0.12) continue;
      for (let j = i + 1; j < count; j++) {
        const b = this.spilledItems[j];
        if (b.y > 0.12) continue;
        let dx = b.lx - a.lx;
        let dz = b.lz - a.lz;
        const distSq = dx * dx + dz * dz;
        if (distSq < minSepSq) {
          const dist = Math.sqrt(distSq);
          if (dist < 1e-4) {
            const angle = ((a.uid + b.uid) * 2.399963) % (Math.PI * 2);
            dx = Math.cos(angle);
            dz = Math.sin(angle);
          } else {
            dx /= dist;
            dz /= dist;
          }
          const overlap = (minSep - dist) * 0.35;
          a.lx -= dx * overlap;
          a.lz -= dz * overlap;
          b.lx += dx * overlap;
          b.lz += dz * overlap;
          anySeparated = true;
        }
      }
    }
    if (unsettledCount === 0 && !anySeparated) {
      this.spilledSeparationDirty = false;
    }
  }

  private wouldMachineAccept(target: CapytorioMachine, item: CapytorioItemId): boolean {
    if (target.type === 'splitter') {
      return target.beltItems.length < CAPYTORIO_BELT_MAX_ITEMS_PER_TILE * 2;
    }
    if (target.type === 'belt' || target.type === 'tunnel') {
      return target.beltItems.length < CAPYTORIO_BELT_MAX_ITEMS_PER_TILE;
    }
    if (target.type === 'chest') {
      return this.countMapValues(target.outputBuffer) < this.getEffectiveChestCapacity(target);
    }
    if (target.type === 'furnace') {
      return Boolean(getCapytorioSmeltSpec(item)) && (target.inputBuffer[item] ?? 0) < 16;
    }
    if (target.type === 'assembler') {
      const rec = RECIPE_BY_ID.get(target.recipeId ?? getDefaultAssemblerRecipeId());
      if (!rec) return false;
      for (let i = 0; i < rec.ingredients.length; i++) {
        if (rec.ingredients[i].item === item) {
          return (target.inputBuffer[item] ?? 0) < 16;
        }
      }
      return false;
    }
    if (target.type === 'generator') {
      return (item === 'coal' || item === 'yuzu_sap' || item === 'orange') && (target.inputBuffer[item] ?? 0) < 16;
    }
    if (target.type === 'lab') {
      const meta = getCapytorioItemMeta(item);
      return meta.category === 'science' && (target.inputBuffer[item] ?? 0) < 16;
    }
    return false;
  }

  public getScore(): number {
    return this.score;
  }

  public getTotalProduced(): number {
    return this.totalProduced;
  }

  public getRocketLaunches(): number {
    return this.rocketLaunches;
  }

  public inspectTileAt(gx: number, gz: number): CapytorioTileInspection {
    const machine = this.getMachineAt(gx, gz);
    this.inspectedTile = machine ? { gx: machine.gx, gz: machine.gz } : { gx, gz };
    this.inspectedKey = machine ? tileKey(machine.gx, machine.gz) : null;
    return this.inspectTileSnapshot(gx, gz);
  }

  public clearInspection(): void {
    this.inspectedTile = null;
    this.inspectedKey = null;
  }

  public isBeaconTile(gx: number, gz: number): boolean {
    return gx === 0 && gz === -3;
  }

  public getSpilledItemsAtTile(gx: number, gz: number): CapytorioTileItemCount[] {
    if (this.spilledItems.length === 0) return [];
    const counts = new Map<CapytorioItemId, number>();
    for (let i = 0; i < this.spilledItems.length; i++) {
      const sp = this.spilledItems[i];
      const spGx = Math.round(sp.lx / CAPYTORIO_TILE_SIZE);
      const spGz = Math.round(sp.lz / CAPYTORIO_TILE_SIZE);
      if (spGx === gx && spGz === gz) {
        counts.set(sp.item, (counts.get(sp.item) ?? 0) + 1);
      }
    }
    if (counts.size === 0) return [];
    const out: CapytorioTileItemCount[] = [];
    for (const [item, count] of counts.entries()) {
      out.push({ item, count });
    }
    out.sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
    return out;
  }

  public inspectTileSnapshot(gx: number, gz: number): CapytorioTileInspection {
    const key = tileKey(gx, gz);
    const machine = this.getMachineAt(gx, gz) ?? null;
    let oreTile = this.getResourceAt(gx, gz);
    if (!oreTile && machine && machine.type === 'drill') {
      const fp = this.getMachineFootprint(machine);
      oreTile = this.findFirstOreInFootprint(machine.gx, machine.gz, fp.width, fp.height);
    }
    const hasTree = this.hasTreeAt(gx, gz);
    const spilledItems = this.getSpilledItemsAtTile(gx, gz);
    let spilledTotalCount = 0;
    for (let i = 0; i < spilledItems.length; i++) {
      spilledTotalCount += spilledItems[i].count;
    }
    const isBeacon = this.isBeaconTile(gx, gz);

    let machineDetail: CapytorioInspectedMachineDetail | null = null;
    if (machine) {
      const fp = this.getMachineFootprint(machine);
      const resolved = resolveCapytorioPlaceableSpec(machine.variantItemId ?? machine.type);
      const baseSpec = CAPYTORIO_MACHINE_SPECS[machine.type];
      const tierMult = machine.tierMult ?? resolved?.tierMult ?? 1.0;
      const inputTotal = this.countMapValues(machine.inputBuffer);
      const outputTotal = this.countMapValues(machine.outputBuffer);
      const curveShape =
        machine.type === 'belt' ? getBeltCurveShape(this.occupancyGrid, machine) : 'straight';
      const leftCap =
        machine.type === 'belt'
          ? getBeltLaneCapacity(curveShape, 0)
          : machine.type === 'splitter'
            ? CAPYTORIO_BELT_ITEMS_PER_LANE * 2
            : machine.type === 'tunnel'
              ? CAPYTORIO_BELT_ITEMS_PER_LANE
              : 0;
      const rightCap =
        machine.type === 'belt'
          ? getBeltLaneCapacity(curveShape, 1)
          : machine.type === 'splitter'
            ? CAPYTORIO_BELT_ITEMS_PER_LANE * 2
            : machine.type === 'tunnel'
              ? CAPYTORIO_BELT_ITEMS_PER_LANE
              : 0;
      let leftCount = 0;
      let rightCount = 0;
      const beltTypeMap = new Map<CapytorioItemId, number>();
      for (let i = 0; i < machine.beltItems.length; i++) {
        const bi = machine.beltItems[i];
        if (bi.lane === 1) rightCount++;
        else leftCount++;
        beltTypeMap.set(bi.item, (beltTypeMap.get(bi.item) ?? 0) + 1);
      }
      const beltItemsByType: CapytorioTileItemCount[] = [];
      for (const [item, count] of beltTypeMap.entries()) {
        beltItemsByType.push({ item, count });
      }
      beltItemsByType.sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));

      const recipeMeta = machine.recipeId ? RECIPE_BY_ID.get(machine.recipeId) : undefined;
      const chestCap = machine.type === 'chest' ? this.getEffectiveChestCapacity(machine) : CAPYTORIO_CHEST_MAX_ITEMS;
      const inserterReach = machine.type === 'inserter' ? getCapytorioInserterReach(machine.variantItemId) : undefined;
      const inserterMaxStack =
        machine.type === 'inserter' ? this.getEffectiveInserterMaxStack(machine) : undefined;

      let status: CapytorioInspectedMachineDetail['status'] = 'Idle';
      if (machine.type === 'belt' || machine.type === 'splitter' || machine.type === 'tunnel') {
        const cap = leftCap + rightCap;
        status =
          cap > 0 && machine.beltItems.length >= cap
            ? 'Full'
            : machine.beltItems.length > 0
              ? 'Working'
              : 'Idle';
      } else if (machine.type === 'generator') {
        status = machine.fuelTimer > 0 ? 'Working' : 'No Fuel';
      } else if (machine.type === 'chest') {
        status = outputTotal >= chestCap ? 'Full' : outputTotal > 0 ? 'Working' : 'Idle';
      } else if (baseSpec.powerDemandMw > 0 && this.powerEfficiency <= 0.05) {
        status = 'No Power';
      } else if (machine.type === 'drill') {
        status = !oreTile ? 'No Resource' : outputTotal >= 20 ? 'Full' : 'Working';
      } else if (machine.type === 'inserter') {
        status = machine.holdingItem || machine.inserterPhase !== 'idle_pickup' ? 'Working' : 'Idle';
      } else if (machine.type === 'furnace' || machine.type === 'assembler' || machine.type === 'lab') {
        status =
          outputTotal >= 20
            ? 'Full'
            : machine.craftProgress > 0.01 || inputTotal > 0
              ? 'Working'
              : 'Idle';
      }

      const beltSpeedItemsPerSec =
        machine.type === 'belt' || machine.type === 'splitter' || machine.type === 'tunnel'
          ? +(
              this.getBeltSpeedTilesPerSec() *
              tierMult *
              CAPYTORIO_BELT_ITEMS_PER_LANE *
              2
            ).toFixed(1)
          : 0;

      machineDetail = {
        gx: machine.gx,
        gz: machine.gz,
        width: fp.width,
        height: fp.height,
        type: machine.type,
        variantItemId: machine.variantItemId,
        name: resolved?.name ?? baseSpec.name,
        shortName: resolved?.shortName ?? baseSpec.shortName,
        dir: machine.dir,
        tierMult: +tierMult.toFixed(2),
        colorHex: resolved?.tintHex ?? baseSpec.colorHex,
        status,
        powerDemandMw: baseSpec.powerDemandMw,
        powerSupplyMw:
          machine.type === 'generator' ? (machine.fuelTimer > 0 ? 6.0 : 1.5) : baseSpec.powerSupplyMw,
        recipeId: machine.recipeId,
        recipeName: recipeMeta?.name,
        craftProgress: +machine.craftProgress.toFixed(2),
        fuelTimer: +machine.fuelTimer.toFixed(1),
        holdingItem: machine.holdingItem,
        splitterInputPriority:
          machine.type === 'splitter' ? (machine.splitterInputPriority ?? 'none') : undefined,
        splitterOutputPriority:
          machine.type === 'splitter' ? (machine.splitterOutputPriority ?? 'none') : undefined,
        splitterFilterItem:
          machine.type === 'splitter' ? (machine.splitterFilterItem ?? null) : undefined,
        inserterFilterMode:
          machine.type === 'inserter' ? (machine.inserterFilterMode ?? 'whitelist') : undefined,
        inserterFilters:
          machine.type === 'inserter' ? [...(machine.inserterFilters ?? [])] : undefined,
        inserterStackLimit:
          machine.type === 'inserter' ? (machine.inserterStackLimit ?? null) : undefined,
        inserterMaxStack,
        inserterReach,
        chestSlotLimit:
          machine.type === 'chest' ? (machine.chestSlotLimit ?? null) : undefined,
        chestCapacityItems: machine.type === 'chest' ? chestCap : undefined,
        inputTotal,
        outputTotal,
        inputBuffer: { ...machine.inputBuffer },
        outputBuffer: { ...machine.outputBuffer },
        beltItemCount: machine.beltItems.length,
        beltCapacity: leftCap + rightCap,
        beltLeftLaneCount: leftCount,
        beltRightLaneCount: rightCount,
        beltLeftLaneCapacity: leftCap,
        beltRightLaneCapacity: rightCap,
        beltCurveShape: curveShape,
        beltSpeedItemsPerSec,
        beltItemsByType,
        moduleSlots: this.getMachineModuleSlotLimit(machine),
        modules: machine.modules ? [...machine.modules] : [],
        integrity: machine.integrity ?? 100,
        overclockTimer: +(machine.overclockTimer ?? 0).toFixed(1),
        roboportFleetCount:
          machine.variantItemId === 'roboport' ? this.getRoboportFleetCount(machine) : undefined,
      };
    }

    const resourceDetail = oreTile
      ? (() => {
          const meta = getCapytorioItemMeta(oreTile.resource);
          return {
            id: oreTile.resource,
            name: meta.name,
            shortName: meta.shortName,
            remaining: oreTile.richness,
            cssColor: meta.cssColor,
            harvestAmount: 2,
          };
        })()
      : null;

    const treeDetail = hasTree
      ? {
          name: 'Wild Citrus Tree',
          yieldItem: 'orange' as CapytorioItemId,
          yieldCount: 3,
        }
      : null;

    const terrainType = sampleCapytorioTerrain(gx, gz);
    const terrainLabels: Record<
      CapytorioTerrainType,
      { name: string; subtitle: string; hint: string }
    > = {
      grass: {
        name: 'Meadow Grass',
        subtitle: 'Buildable Terrain',
        hint: 'Select a building from quickbar to place',
      },
      sand: {
        name: 'Sandy Shore',
        subtitle: 'Buildable Coastal Sand',
        hint: 'Build along the shoreline or place an Offshore Pump nearby',
      },
      shallow_water: {
        name: 'Coastal Shallows',
        subtitle: 'Shallow Shoreline Water',
        hint: 'Place an Offshore Pump here or route tunnels underneath',
      },
      river: {
        name: 'Flowing River',
        subtitle: 'Meandering Waterway · Unbuildable',
        hint: 'Use Underground Tunnels to cross belts or place an Offshore Pump',
      },
      lake: {
        name: 'Freshwater Lake',
        subtitle: 'Inland Lake · Water Source',
        hint: 'Place an Offshore Pump along the lake shore',
      },
      ocean: {
        name: 'Deep Ocean',
        subtitle: 'Open Sea · Unbuildable Water',
        hint: 'Natural coastal frontier — build factories inland',
      },
    };
    const terrainInfo = terrainLabels[terrainType];

    let primaryKind: CapytorioTileInspectionKind = 'terrain';
    let title = terrainInfo.name;
    let subtitle = terrainInfo.subtitle;
    let actionHint = terrainInfo.hint;

    if (machineDetail) {
      primaryKind = 'machine';
      title = machineDetail.name;
      const fpLabel = `${machineDetail.width}×${machineDetail.height}`;
      if (machineDetail.type === 'belt') {
        const shapeLabel =
          machineDetail.beltCurveShape === 'straight'
            ? 'Straight'
            : machineDetail.beltCurveShape === 'curve_from_left'
              ? 'Curved (Left)'
              : 'Curved (Right)';
        subtitle = `Logistics · ${shapeLabel} · ${machineDetail.beltSpeedItemsPerSec}/s`;
        actionHint = 'Press [R] to rotate · Click Open to collect items';
      } else if (machineDetail.type === 'splitter') {
        const filterLabel = machineDetail.splitterFilterItem
          ? `Filter ${getCapytorioItemMeta(machineDetail.splitterFilterItem).shortName}`
          : 'Balanced';
        subtitle = `${fpLabel} Splitter · ${filterLabel} · ${machineDetail.beltSpeedItemsPerSec}/s`;
        actionHint = 'Configure priority/filter · Shift+RMB copy · Shift+LMB paste';
      } else if (machineDetail.type === 'drill') {
        subtitle = resourceDetail
          ? `${fpLabel} Mining ${resourceDetail.shortName} · ${machineDetail.tierMult.toFixed(1)}x`
          : `${fpLabel} Mining Drill · No Resource Below`;
        actionHint = 'Outputs directly onto front-center belt, chest, or furnace';
      } else if (machineDetail.type === 'inserter') {
        const reachLabel = machineDetail.inserterReach === 2 ? '2-Tile Reach' : '1-Tile Reach';
        subtitle = `Logistics · ${reachLabel} · ${machineDetail.tierMult.toFixed(1)}x`;
        actionHint = 'Picks behind · Drops ahead · Shift+RMB copy · [R] Rotate';
      } else if (machineDetail.type === 'chest') {
        const slotsUsed = machineDetail.chestSlotLimit ?? CAPYTORIO_CHEST_SLOTS;
        subtitle = `Storage · ${machineDetail.outputTotal}/${machineDetail.chestCapacityItems ?? CAPYTORIO_CHEST_MAX_ITEMS} · ${slotsUsed}/${CAPYTORIO_CHEST_SLOTS} slots`;
        actionHint = 'Set red-bar slot cap · Shift+RMB copy · Shift+LMB paste';
      } else if (machineDetail.type === 'generator') {
        subtitle = `${fpLabel} Power · ${machineDetail.powerSupplyMw.toFixed(1)} MW`;
        actionHint = 'Feed Coal or Fresh Orange for 6.0 MW surge';
      } else {
        subtitle = `${fpLabel} Building · ${machineDetail.status}`;
        actionHint = 'Click Open to manage buffers, recipes, or Shift+RMB copy';
      }
    } else if (treeDetail) {
      primaryKind = 'tree';
      title = treeDetail.name;
      subtitle = 'Harvestable Flora · Generator Fuel';
      actionHint = 'Chop [E] or click Chop for +3 Fresh Orange';
    } else if (resourceDetail) {
      primaryKind = 'resource';
      title = resourceDetail.name;
      subtitle = 'Minable Resource Deposit';
      actionHint = 'Mine [E] by hand or place a Mining Drill';
    } else if (spilledTotalCount > 0) {
      primaryKind = 'spilled';
      title =
        spilledItems.length === 1
          ? getCapytorioItemMeta(spilledItems[0].item).name
          : 'Items on Ground';
      subtitle = `Ground Loot · ${spilledTotalCount} item${spilledTotalCount === 1 ? '' : 's'}`;
      actionHint = 'Walk near, use an Inserter, or click Collect';
    } else if (isBeacon) {
      primaryKind = 'beacon';
      title = 'Surveyor Beacon';
      subtitle = 'Drop-Pod Landing Landmark';
      actionHint = 'Press [H] anytime to warp back to base';
    }

    return {
      gx: machineDetail ? machineDetail.gx : gx,
      gz: machineDetail ? machineDetail.gz : gz,
      key: machineDetail ? tileKey(machineDetail.gx, machineDetail.gz) : key,
      primaryKind,
      title,
      subtitle,
      machine: machineDetail,
      resource: resourceDetail,
      tree: treeDetail,
      spilledItems,
      spilledTotalCount,
      isBeacon,
      terrainName: isBeacon ? 'Surveyor Beacon Pad' : terrainInfo.name,
      actionHint,
    };
  }

  public getUiSnapshot(): CapytorioUiSnapshot {
    const inspected = this.inspectedKey ? this.machines.get(this.inspectedKey) ?? null : null;
    const hoveredOre = this.getResourceAt(this.hoveredGx, this.hoveredGz);
    const hoveredMachine = this.getMachineAt(this.hoveredGx, this.hoveredGz) ?? null;
    const activeTech = this.activeTechId ? TECH_BY_ID.get(this.activeTechId) : null;
    const hoveredTileInfo = this.inspectTileSnapshot(this.hoveredGx, this.hoveredGz);
    const inspectedTile = this.inspectedTile
      ? this.inspectTileSnapshot(this.inspectedTile.gx, this.inspectedTile.gz)
      : inspected
        ? this.inspectTileSnapshot(inspected.gx, inspected.gz)
        : null;

    let techFrac = 0;
    if (activeTech) {
      let totalReq = 0;
      let totalDeliv = 0;
      for (const [k, req] of Object.entries(activeTech.cost) as Array<[CapytorioItemId, number]>) {
        totalReq += req;
        totalDeliv += Math.min(req, this.techDelivered[k] ?? 0);
      }
      techFrac = totalReq > 0 ? totalDeliv / totalReq : 0;
    }

    const unlockedRecipes: CapytorioRecipeId[] = [];
    for (let i = 0; i < CAPYTORIO_RECIPES.length; i++) {
      const r = CAPYTORIO_RECIPES[i];
      if (r.station === 'assembler' && this.isRecipeUnlocked(r.id)) {
        unlockedRecipes.push(r.id);
      }
    }

    const milestones = this.evaluateMilestones();
    let milestonesCompletedCount = 0;
    for (let i = 0; i < milestones.length; i++) {
      if (milestones[i].completed) milestonesCompletedCount++;
    }

    return {
      machineCount: this.machines.size,
      powerSupplyMw: this.powerSupplyMw,
      powerDemandMw: this.powerDemandMw,
      powerEfficiency: +this.powerEfficiency.toFixed(2),
      selectedTool: this.selectedTool,
      selectedDir: this.selectedDir,
      selectedRecipeId: this.selectedRecipeId,
      recentTools: this.getRecentTools(),
      harvestedTreeCount: this.harvestedTrees.size,
      inspectedMachine: inspected
        ? {
            gx: inspected.gx,
            gz: inspected.gz,
            type: inspected.type,
            variantItemId: inspected.variantItemId,
            dir: inspected.dir,
            recipeId: inspected.recipeId,
            craftProgress: +inspected.craftProgress.toFixed(2),
            fuelTimer: +inspected.fuelTimer.toFixed(1),
            beltItemCount: inspected.beltItems.length,
            inputTotal: this.countMapValues(inspected.inputBuffer),
            outputTotal: this.countMapValues(inspected.outputBuffer),
            inputBuffer: { ...inspected.inputBuffer },
            outputBuffer: { ...inspected.outputBuffer },
            holdingItem: inspected.holdingItem,
          }
        : null,
      inspectedTile,
      hoveredTileInfo,
      hoveredTile: {
        gx: this.hoveredGx,
        gz: this.hoveredGz,
        resource: hoveredOre?.resource ?? null,
        resourceAmount: hoveredOre?.richness ?? 0,
        hasTree: this.hasTreeAt(this.hoveredGx, this.hoveredGz),
        machineType: hoveredMachine?.type ?? null,
        variantItemId: hoveredMachine?.variantItemId,
      },
      pocketItems: { ...this.pocketItems },
      pocketMachines: { ...this.pocketMachines },
      activeTechId: this.activeTechId,
      activeTechName: activeTech ? activeTech.name : 'All Initial Techs Complete',
      activeTechProgress: +techFrac.toFixed(2),
      unlockedTechs: Array.from(this.unlockedTechs),
      unlockedRecipes,
      rocketLaunches: this.rocketLaunches,
      totalProduced: this.totalProduced,
      score: this.score,
      craftSpeedBonus: +this.getCraftSpeedMultiplier().toFixed(2),
      beltSpeedMultiplier: +this.getBeltSpeedTilesPerSec().toFixed(2),
      productivityBonus: +this.getProductivityBonusFraction().toFixed(2),
      milestones,
      milestonesCompletedCount,
      spilledItemCount: this.spilledItems.length,
      beltEndSpillEnabled: this.beltEndSpillEnabled,
      clipboard: {
        toolState: this.clipboardToolState,
        selectionShape: this.selectionShape,
        mode: this.clipboard?.mode ?? null,
        count: this.clipboard?.entries.length ?? 0,
        canUndoCut: this.undoCutSnapshot.length > 0,
        previewCount: this.previewSelectedKeys.size,
        activeBlueprintId: this.clipboard?.blueprintId ?? this.activeBlueprintId,
        activeBlueprintLabel: this.clipboard?.label ?? null,
        libraryCount: this.blueprintLibrary.length,
        hasRememberedSelection:
          (this.clipboard !== null && this.clipboard.entries.length > 0) ||
          this.blueprintLibrary.length > 0,
        pasteAnchor: this.pasteAnchor ? { gx: this.pasteAnchor.gx, gz: this.pasteAnchor.gz } : null,
      },
      history: {
        canUndo: this.undoStack.length > 0,
        canRedo: this.redoStack.length > 0,
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length,
        nextUndoLabel:
          this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].label : null,
        nextRedoLabel:
          this.redoStack.length > 0 ? this.redoStack[this.redoStack.length - 1].label : null,
      },
      blueprintLibrary: this.blueprintLibrary.map((bp) => ({
        id: bp.id,
        label: bp.label,
        sourceMode: bp.sourceMode,
        createdAt: bp.createdAt,
        width: bp.width,
        height: bp.height,
        entries: bp.entries.map((e) => ({
          ...e,
          inserterFilters: e.inserterFilters ? [...e.inserterFilters] : undefined,
        })),
      })),
      presetBlueprints: this.presetBlueprints.map((bp) => ({
        id: bp.id,
        label: bp.label,
        sourceMode: bp.sourceMode,
        createdAt: bp.createdAt,
        width: bp.width,
        height: bp.height,
        entries: bp.entries.map((e) => ({
          ...e,
          inserterFilters: e.inserterFilters ? [...e.inserterFilters] : undefined,
        })),
      })),
      altModeEnabled: this.altModeEnabled,
      entitySettingsClipboard: this.entitySettingsClipboard
        ? {
            sourceType: this.entitySettingsClipboard.sourceType,
            sourceLabel: this.entitySettingsClipboard.sourceLabel,
          }
        : null,
      craftingQueue: this.craftingQueue.map((q) => ({
        uid: q.uid,
        kind: q.kind,
        resultId: q.resultId,
        resultName: q.resultName,
        remainingCount: q.batchesRemaining * q.resultCountPerBatch,
        batchesRemaining: q.batchesRemaining,
        progress: +q.progress.toFixed(2),
        isIntermediate: q.isIntermediate,
      })),
    };
  }

  public serialize(): CapytorioSerializedState {
    return serializeCapytorioEngineState(this.serializerHost);
  }

  public hydrate(raw: CapytorioSerializedState): void {
    hydrateCapytorioEngineState(this.serializerHost, raw);
  }
}

export function sanitizeCapytorioState(raw: unknown): CapytorioSerializedState | undefined {
  return sanitizeCapytorioSerializedState(raw, (candidate) => new CapytorioFactoryEngine(candidate));
}
