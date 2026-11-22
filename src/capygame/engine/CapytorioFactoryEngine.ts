import {
  CAPYTORIO_CHUNK_SIZE,
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
  getCapytorioItemMeta,
  getCapytorioSmeltSpec,
  type CapytorioDirection,
  type CapytorioItemId,
  type CapytorioMachineType,
  type CapytorioRecipeId,
  type CapytorioTechId,
} from './CapytorioData';

export const MAX_RECENT_CAPYTORIO_TOOLS = 10;

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
}

export interface CapytorioBlueprintClipboard {
  mode: 'copy' | 'cut';
  entries: CapytorioBlueprintEntry[];
  canUndoCut: boolean;
}

export interface CapytorioBlueprintPlacementCheck {
  entry: CapytorioBlueprintEntry;
  gx: number;
  gz: number;
  valid: boolean;
  reason?: 'occupied' | 'needs_ore' | 'no_stock';
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
  };
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

function hashInt2D(x: number, z: number, seed: number): number {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
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
 */
export function sampleCapytorioBaseResource(
  gx: number,
  gz: number
): { resource: CapytorioItemId; initialAmount: number } | null {
  // Keep exact spawn pad clear so hero stands on clean solid limestone ground
  if (Math.abs(gx) <= 2 && Math.abs(gz) <= 2) {
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
  if (sampleCapytorioBaseResource(gx, gz) !== null) return false;
  const groveNoise = Math.sin(gx * 0.23 + 0.5) * Math.cos(gz * 0.21 - 0.3);
  if (groveNoise < -0.35) return false;
  const h = hashInt2D(gx, gz, 7719);
  return h < 0.125;
}

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

export class CapytorioFactoryEngine {
  public readonly machines = new Map<string, CapytorioMachine>();
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

  // Multi-building Cut / Copy / Paste Blueprint Clipboard state
  public clipboardToolState: CapytorioClipboardToolState = 'off';
  public selectionShape: CapytorioSelectionShape = 'box';
  public clipboard: CapytorioBlueprintClipboard | null = null;
  public readonly previewSelectedKeys = new Set<string>();
  private undoCutSnapshot: Array<{
    gx: number;
    gz: number;
    toolId: string;
    baseType: CapytorioMachineType;
    dir: CapytorioDirection;
    recipeId?: CapytorioRecipeId;
    inputBuffer: Partial<Record<CapytorioItemId, number>>;
    outputBuffer: Partial<Record<CapytorioItemId, number>>;
    beltItems: CapytorioBeltItem[];
    holdingItem: CapytorioItemId | null;
  }> = [];

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

  constructor(initialState?: CapytorioSerializedState | null) {
    if (initialState && initialState.version === 1) {
      this.hydrate(initialState);
    } else {
      this.resetToBlankStarterField();
    }
  }

  public resetToBlankStarterField(): void {
    this.machines.clear();
    this.spilledItems.length = 0;
    this.oreRemainingOverrides.clear();
    this.harvestedTrees.clear();
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
    this.previewSelectedKeys.clear();
    this.undoCutSnapshot.length = 0;
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
    if (this.machines.has(key)) return false;
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

    const key = tileKey(gx, gz);
    const existing = this.machines.get(key);
    if (existing) {
      const sameTool =
        existing.type === baseType &&
        (existing.variantItemId ?? existing.type) === (variantItemId ?? baseType);
      // Clicking an existing belt/inserter with same tool rotates it cleanly instead of failing!
      if (sameTool) {
        existing.dir = ((existing.dir + 1) & 3) as CapytorioDirection;
        return { ok: true, machine: existing };
      }
      return { ok: false, reason: 'Tile already occupied — Right-click or press X to demolish first' };
    }

    if (baseType === 'drill') {
      const ore = this.getResourceAt(gx, gz);
      if (!ore) {
        return { ok: false, reason: 'Mining Drills must be placed on glowing ore tiles' };
      }
    }

    if (resolved.isBaseMachine) {
      const inPocket = this.getPocketMachineCount(baseType);
      if (inPocket > 0) {
        this.pocketMachines[baseType] = inPocket - 1;
      } else if (!this.craftMachineIntoPocket(baseType)) {
        return { ok: false, reason: `Need materials to craft ${resolved.name}` };
      } else {
        // Use the one just crafted
        this.pocketMachines[baseType] = Math.max(0, (this.pocketMachines[baseType] ?? 1) - 1);
      }
    } else {
      const itemQty = this.getPocketItemCount(resolved.id);
      if (itemQty > 0) {
        this.consumePocketItem(resolved.id, 1);
      } else {
        // Auto-craft matching Factorio recipe if affordable in pocket
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

    // Clear any citrus tree on this tile cleanly and award oranges!
    this.harvestTreeAt(gx, gz);

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
      inputBuffer: {},
      outputBuffer: {},
      beltItems: [],
    };
    this.machines.set(key, machine);
    this.machineListDirty = true;
    this.topologyRevision++;
    this.inspectedKey = key;
    this.inspectedTile = { gx, gz };
    this.score += 10;
    this.recordRecentTool(resolved.id);
    this.recomputePowerMetrics();
    return { ok: true, machine };
  }

  public rotateMachineAt(gx: number, gz: number): CapytorioDirection | null {
    const m = this.machines.get(tileKey(gx, gz));
    if (!m) return null;
    m.dir = ((m.dir + 1) & 3) as CapytorioDirection;
    this.topologyRevision++;
    return m.dir;
  }

  public setAssemblerRecipeAt(gx: number, gz: number, recipeId: CapytorioRecipeId): boolean {
    if (!this.isRecipeUnlocked(recipeId)) return false;
    const rec = RECIPE_BY_ID.get(recipeId);
    if (!rec || rec.station !== 'assembler') return false;
    this.selectedRecipeId = recipeId;
    const m = this.machines.get(tileKey(gx, gz));
    if (m && m.type === 'assembler') {
      if (m.recipeId !== recipeId) {
        // Refund leftover buffered ingredients into pocket cleanly!
        for (const [k, v] of Object.entries(m.inputBuffer) as Array<[CapytorioItemId, number]>) {
          if (v > 0) this.addPocketItem(k, v);
        }
        m.inputBuffer = {};
        m.craftProgress = 0;
        m.recipeId = recipeId;
      }
      return true;
    }
    return false;
  }

  public demolishAt(gx: number, gz: number): CapytorioMachineType | null {
    const key = tileKey(gx, gz);
    const m = this.machines.get(key);
    if (!m) return null;
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
    this.machines.delete(key);
    if (this.inspectedKey === key) this.inspectedKey = null;
    if (this.inspectedTile && this.inspectedTile.gx === gx && this.inspectedTile.gz === gz) {
      this.inspectedTile = { gx, gz };
    }
    this.machineListDirty = true;
    this.topologyRevision++;
    this.recomputePowerMetrics();
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
          const prevM = this.machines.get(tileKey(prevPlacedGx, prevPlacedGz));
          if (prevM && prevM.type === 'belt') {
            prevM.dir = targetDir;
            this.topologyRevision++;
          }
        }
      }
    }
    const existing = this.machines.get(tileKey(gx, gz));
    if (existing) {
      return { ok: false, appliedDir: targetDir };
    }
    const res = this.placeMachine(toolOrType, gx, gz, targetDir);
    return {
      ok: res.ok,
      machine: res.machine,
      appliedDir: targetDir,
    };
  }

  public setClipboardToolMode(
    state: CapytorioClipboardToolState,
    shape?: CapytorioSelectionShape
  ): void {
    if (shape) this.selectionShape = shape;
    if (state === 'paste' && (!this.clipboard || this.clipboard.entries.length === 0)) {
      this.clipboardToolState = 'select_copy';
    } else {
      this.clipboardToolState = state;
    }
    this.previewSelectedKeys.clear();
  }

  public clearClipboard(): void {
    this.clipboardToolState = 'off';
    this.clipboard = null;
    this.previewSelectedKeys.clear();
    this.undoCutSnapshot.length = 0;
  }

  public selectMachinesInBox(gxA: number, gzA: number, gxB: number, gzB: number): CapytorioMachine[] {
    const minX = Math.min(gxA, gxB);
    const maxX = Math.max(gxA, gxB);
    const minZ = Math.min(gzA, gzB);
    const maxZ = Math.max(gzA, gzB);
    const out: CapytorioMachine[] = [];
    for (const m of this.machines.values()) {
      if (m.gx >= minX && m.gx <= maxX && m.gz >= minZ && m.gz <= maxZ) {
        out.push(m);
      }
    }
    return out;
  }

  public selectMachinesInPolygon(
    points: ReadonlyArray<{ gx: number; gz: number }>
  ): CapytorioMachine[] {
    const n = points.length;
    if (n === 0) return [];
    if (n === 1) {
      const m = this.machines.get(tileKey(Math.round(points[0].gx), Math.round(points[0].gz)));
      return m ? [m] : [];
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const pt = points[i];
      if (pt.gx < minX) minX = pt.gx;
      if (pt.gx > maxX) maxX = pt.gx;
      if (pt.gz < minZ) minZ = pt.gz;
      if (pt.gz > maxZ) maxZ = pt.gz;
    }
    const pad = 0.65;
    const brushDistSq = 0.54 * 0.54;
    const out: CapytorioMachine[] = [];

    for (const m of this.machines.values()) {
      const px = m.gx;
      const pz = m.gz;
      if (px < minX - pad || px > maxX + pad || pz < minZ - pad || pz > maxZ + pad) continue;

      // 1. Check direct brush proximity to any drawn polyline segment
      let touched = false;
      for (let i = 0; i < n - 1; i++) {
        const ax = points[i].gx;
        const az = points[i].gz;
        const bx = points[i + 1].gx;
        const bz = points[i + 1].gz;
        const abx = bx - ax;
        const abz = bz - az;
        const lenSq = abx * abx + abz * abz;
        const t = lenSq > 1e-6 ? Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / lenSq)) : 0;
        const cx = ax + abx * t;
        const cz = az + abz * t;
        const dSq = (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
        if (dSq <= brushDistSq) {
          touched = true;
          break;
        }
      }
      if (touched) {
        out.push(m);
        continue;
      }

      // 2. Ray-casting point-in-polygon check (closing last point -> first point)
      if (n >= 3) {
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = points[i].gx;
          const zi = points[i].gz;
          const xj = points[j].gx;
          const zj = points[j].gz;
          const intersects =
            zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-9) + xi;
          if (intersects) inside = !inside;
        }
        if (inside) {
          out.push(m);
        }
      }
    }
    return out;
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
      if (m.gx < minGx) minGx = m.gx;
      if (m.gx > maxGx) maxGx = m.gx;
      if (m.gz < minGz) minGz = m.gz;
      if (m.gz > maxGz) maxGz = m.gz;
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
      });
      if (mode === 'cut') {
        this.undoCutSnapshot.push({
          gx: m.gx,
          gz: m.gz,
          toolId,
          baseType: m.type,
          dir: m.dir,
          recipeId: m.recipeId,
          inputBuffer: { ...m.inputBuffer },
          outputBuffer: { ...m.outputBuffer },
          beltItems: m.beltItems.map((bi) => ({ ...bi })),
          holdingItem: m.holdingItem,
        });
      }
    }

    if (mode === 'cut') {
      for (let i = 0; i < this.undoCutSnapshot.length; i++) {
        const snap = this.undoCutSnapshot[i];
        this.demolishAt(snap.gx, snap.gz);
      }
    }

    this.clipboard = {
      mode,
      entries,
      canUndoCut: mode === 'cut' && this.undoCutSnapshot.length > 0,
    };
    this.clipboardToolState = 'paste';
    return { count: entries.length, mode };
  }

  public rotateBlueprint90(): boolean {
    if (!this.clipboard || this.clipboard.entries.length === 0) return false;
    for (let i = 0; i < this.clipboard.entries.length; i++) {
      const e = this.clipboard.entries[i];
      const prevDx = e.dx;
      const prevDz = e.dz;
      // 90 deg CW in Capytorio (+X East, +Z South): (dx, dz) -> (-dz, dx)
      e.dx = -prevDz;
      e.dz = prevDx;
      e.dir = ((e.dir + 1) & 3) as CapytorioDirection;
    }
    return true;
  }

  public evaluateBlueprintPlacementAt(
    originGx: number,
    originGz: number
  ): CapytorioBlueprintPlacementCheck[] {
    if (!this.clipboard || this.clipboard.entries.length === 0) return [];
    const remainingStock = new Map<string, number>();
    const results: CapytorioBlueprintPlacementCheck[] = [];

    for (let i = 0; i < this.clipboard.entries.length; i++) {
      const entry = this.clipboard.entries[i];
      const gx = originGx + entry.dx;
      const gz = originGz + entry.dz;
      const key = tileKey(gx, gz);
      const existing = this.machines.get(key);
      if (existing) {
        // Allow recipe-only paste onto an existing assembler of matching recipe
        if (existing.type === 'assembler' && entry.baseType === 'assembler' && entry.recipeId) {
          results.push({ entry, gx, gz, valid: true });
        } else {
          results.push({ entry, gx, gz, valid: false, reason: 'occupied' });
        }
        continue;
      }
      if (entry.baseType === 'drill' && !this.getResourceAt(gx, gz)) {
        results.push({ entry, gx, gz, valid: false, reason: 'needs_ore' });
        continue;
      }
      const resolved = resolveCapytorioPlaceableSpec(entry.toolId);
      if (!resolved) {
        results.push({ entry, gx, gz, valid: false, reason: 'no_stock' });
        continue;
      }
      let avail = remainingStock.get(entry.toolId);
      if (avail === undefined) {
        avail = resolved.isBaseMachine
          ? this.pocketMachines[resolved.baseType] ?? 0
          : this.pocketItems[resolved.id] ?? 0;
      }
      if (avail <= 0) {
        results.push({ entry, gx, gz, valid: false, reason: 'no_stock' });
        continue;
      }
      remainingStock.set(entry.toolId, avail - 1);
      results.push({ entry, gx, gz, valid: true });
    }
    return results;
  }

  public pasteBlueprintAt(
    originGx: number,
    originGz: number
  ): { placedCount: number; skippedCount: number; updatedRecipesCount: number } {
    if (!this.clipboard || this.clipboard.entries.length === 0) {
      return { placedCount: 0, skippedCount: 0, updatedRecipesCount: 0 };
    }
    const entries = this.clipboard.entries;
    const wasCut = this.clipboard.mode === 'cut';
    let placedCount = 0;
    let skippedCount = 0;
    let updatedRecipesCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const gx = originGx + entry.dx;
      const gz = originGz + entry.dz;
      const key = tileKey(gx, gz);
      const existing = this.machines.get(key);
      if (existing) {
        if (
          existing.type === 'assembler' &&
          entry.baseType === 'assembler' &&
          entry.recipeId &&
          existing.recipeId !== entry.recipeId
        ) {
          if (this.setAssemblerRecipeAt(gx, gz, entry.recipeId)) {
            updatedRecipesCount++;
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
        continue;
      }

      const placed = this.placeMachine(entry.toolId, gx, gz, entry.dir);
      if (placed.ok) {
        placedCount++;
        if (entry.baseType === 'assembler' && entry.recipeId) {
          this.setAssemblerRecipeAt(gx, gz, entry.recipeId);
        }
      } else {
        skippedCount++;
      }
    }

    if (wasCut && placedCount > 0) {
      this.clipboard = null;
      this.clipboardToolState = 'off';
      this.undoCutSnapshot.length = 0;
    }

    return { placedCount, skippedCount, updatedRecipesCount };
  }

  public undoCut(): { restoredCount: number } {
    if (this.undoCutSnapshot.length === 0) return { restoredCount: 0 };
    let restoredCount = 0;
    for (let i = 0; i < this.undoCutSnapshot.length; i++) {
      const item = this.undoCutSnapshot[i];
      if (this.machines.has(tileKey(item.gx, item.gz))) continue;
      const res = this.placeMachine(item.toolId, item.gx, item.gz, item.dir);
      if (res.ok && res.machine) {
        restoredCount++;
        if (item.baseType === 'assembler' && item.recipeId) {
          this.setAssemblerRecipeAt(item.gx, item.gz, item.recipeId);
        }
        // Re-load refunded buffers & belt items cleanly from pocket where available
        for (const [k, qty] of Object.entries(item.inputBuffer) as Array<[CapytorioItemId, number]>) {
          const take = Math.min(qty, this.pocketItems[k] ?? 0);
          if (take > 0) {
            this.consumePocketItem(k, take);
            res.machine.inputBuffer[k] = (res.machine.inputBuffer[k] ?? 0) + take;
          }
        }
        for (const [k, qty] of Object.entries(item.outputBuffer) as Array<[CapytorioItemId, number]>) {
          const take = Math.min(qty, this.pocketItems[k] ?? 0);
          if (take > 0) {
            this.consumePocketItem(k, take);
            res.machine.outputBuffer[k] = (res.machine.outputBuffer[k] ?? 0) + take;
          }
        }
        for (let bi = 0; bi < item.beltItems.length; bi++) {
          const bItem = item.beltItems[bi];
          if ((this.pocketItems[bItem.item] ?? 0) > 0) {
            this.consumePocketItem(bItem.item, 1);
            res.machine.beltItems.push({ ...bItem });
          }
        }
        if (item.holdingItem && (this.pocketItems[item.holdingItem] ?? 0) > 0) {
          this.consumePocketItem(item.holdingItem, 1);
          res.machine.holdingItem = item.holdingItem;
        }
      }
    }
    this.undoCutSnapshot.length = 0;
    this.clipboard = null;
    this.clipboardToolState = 'off';
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
    const key = tileKey(gx, gz);
    const existing = this.machines.get(key);
    if (existing) {
      const toolId = existing.variantItemId ?? existing.type;
      this.selectedTool = toolId;
      this.selectedDir = existing.dir;
      this.inspectedKey = key;
      this.inspectedTile = { gx, gz };
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
    const m = this.machines.get(tileKey(gx, gz));
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
    const m = this.machines.get(tileKey(gx, gz));
    if (!m) return 0;

    if (m.type === 'generator') {
      return this.insertPocketFuelToGenerator(gx, gz, batches);
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
    const m = this.machines.get(tileKey(gx, gz));
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
    return taken;
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
          (labCount >= 1 && (totalSci >= 1 || Object.keys(this.techDelivered).length > 0)),
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
      const wx = m.gx * CAPYTORIO_TILE_SIZE;
      const wz = m.gz * CAPYTORIO_TILE_SIZE;
      if (Math.hypot(wx - heroLocalX, wz - heroLocalZ) <= pickupRadiusMeters) {
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
    const m = this.machines.get(tileKey(gx, gz));
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
    const genBonus = this.unlockedTechs.has('bioflux_chemistry') ? 1.25 : 1.0;

    for (let i = 0; i < this.machineStepList.length; i++) {
      const m = this.machineStepList[i];
      const spec = CAPYTORIO_MACHINE_SPECS[m.type];
      const tierMult = m.tierMult ?? 1.0;
      demand += spec.powerDemandMw;
      if (m.type === 'generator') {
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
    if (target.type === 'belt' || target.type === 'splitter' || target.type === 'tunnel') {
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

      const targetCurve = target.type === 'belt' ? getBeltCurveShape(this.machines, target) : 'straight';
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

          // Inline drop from a drill / furnace / assembler onto the rear of a belt
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

        // Non-inline drop (inserter, side-loading belt, splitter, or tunnel):
        // Probe preferred middle drop (0.45) first, then canonical packed rear slots (e.g. 0.375, 0.125)
        // so lanes compress cleanly up to 100% Factorio capacity (4 per straight lane) without gaps.
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
      if (total >= 120) return false;
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

    // Update fuel timers & recompute power
    let anyFuelChanged = false;
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
    }
    if (anyFuelChanged || this.machineStepList.length > 0) {
      this.recomputePowerMetrics();
    }

    const craftRate = this.getCraftSpeedMultiplier() * this.powerEfficiency;
    const beltRate = this.getBeltSpeedTilesPerSec();
    const prodBonus = this.getProductivityBonusFraction();
    const inserterStack = this.getInserterStackSize();

    // Advance belt surface phase strictly 1:1 with simulation item advancement
    this.beltScrollPhase = (this.beltScrollPhase + clampedDt * beltRate) % 1000.0;

    // Reusable scratch tuple for zero-allocation inserter pickup target calculation
    const poseScratch = _inserterPoseScratch;

    for (let i = 0; i < this.machineStepList.length; i++) {
      const m = this.machineStepList[i];
      const mTierMult = m.tierMult ?? 1.0;
      const fGx = m.gx + DIR_DX[m.dir];
      const fGz = m.gz + DIR_DZ[m.dir];
      const frontTarget = this.machines.get(tileKey(fGx, fGz));

      if (m.type === 'drill') {
        const oreTile = this.getResourceAt(m.gx, m.gz);
        const bufferedOut = this.countMapValues(m.outputBuffer);
        if (oreTile && bufferedOut < 4) {
          m.craftProgress += (clampedDt * craftRate * mTierMult) / 2.2;
          if (m.craftProgress >= 1.0) {
            m.craftProgress -= 1.0;
            const mined = this.depleteOreAt(m.gx, m.gz, 1);
            if (mined) {
              m.outputBuffer[mined] = (m.outputBuffer[mined] ?? 0) + 1;
              this.totalProduced += 1;
              this.score += 1;
              m.productivityProgress += prodBonus;
              if (m.productivityProgress >= 1.0) {
                m.productivityProgress -= 1.0;
                m.outputBuffer[mined] = (m.outputBuffer[mined] ?? 0) + 1;
                this.totalProduced += 1;
              }
            }
          }
        }
        if (frontTarget && this.countMapValues(m.outputBuffer) > 0) {
          for (const k in m.outputBuffer) {
            const id = k as CapytorioItemId;
            if ((m.outputBuffer[id] ?? 0) > 0 && this.tryAcceptItemIntoTarget(frontTarget, id, m.gx, m.gz)) {
              m.outputBuffer[id] = (m.outputBuffer[id] ?? 1) - 1;
              if (m.outputBuffer[id]! <= 0) delete m.outputBuffer[id];
              break;
            }
          }
        }
      } else if (m.type === 'furnace') {
        // Select active smeltable item automatically from recipe.lua smelting entries
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
          m.craftProgress += (clampedDt * craftRate * mTierMult) / craftSec;
          if (m.craftProgress >= 1.0) {
            m.craftProgress -= 1.0;
            m.inputBuffer[activeInput] = (m.inputBuffer[activeInput] ?? smeltSpec.inputCount) - smeltSpec.inputCount;
            if (m.inputBuffer[activeInput]! <= 0) delete m.inputBuffer[activeInput];
            m.outputBuffer[smeltSpec.result] = (m.outputBuffer[smeltSpec.result] ?? 0) + (rec?.resultCount ?? 1);
            this.totalProduced += rec?.resultCount ?? 1;
            this.score += 3 * (rec?.resultCount ?? 1);
            m.productivityProgress += prodBonus;
            if (m.productivityProgress >= 1.0) {
              m.productivityProgress -= 1.0;
              m.outputBuffer[smeltSpec.result] = (m.outputBuffer[smeltSpec.result] ?? 0) + (rec?.resultCount ?? 1);
              this.totalProduced += rec?.resultCount ?? 1;
            }
          }
        } else if (!activeInput) {
          m.craftProgress = 0;
        }
        // Friendly auto-eject onto front belt or chest
        if (frontTarget && (frontTarget.type === 'belt' || frontTarget.type === 'splitter' || frontTarget.type === 'chest' || frontTarget.type === 'tunnel')) {
          for (const k in m.outputBuffer) {
            const id = k as CapytorioItemId;
            if ((m.outputBuffer[id] ?? 0) > 0 && this.tryAcceptItemIntoTarget(frontTarget, id, m.gx, m.gz)) {
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
            m.craftProgress += (clampedDt * craftRate * mTierMult) / rec.craftTimeSec;
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

              m.productivityProgress += prodBonus;
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
        // Friendly auto-eject onto front belt or chest
        if (frontTarget && (frontTarget.type === 'belt' || frontTarget.type === 'splitter' || frontTarget.type === 'chest' || frontTarget.type === 'tunnel')) {
          for (const k in m.outputBuffer) {
            const id = k as CapytorioItemId;
            if ((m.outputBuffer[id] ?? 0) > 0 && this.tryAcceptItemIntoTarget(frontTarget, id, m.gx, m.gz)) {
              m.outputBuffer[id] = (m.outputBuffer[id] ?? 1) - 1;
              if (m.outputBuffer[id]! <= 0) delete m.outputBuffer[id];
              break;
            }
          }
        }
      } else if (m.type === 'lab') {
        if (this.activeTechId) {
          const tech = TECH_BY_ID.get(this.activeTechId);
          if (tech) {
            let consumedPack = false;
            for (const [sciId, reqCount] of Object.entries(tech.cost) as Array<[CapytorioItemId, number]>) {
              const deliv = this.techDelivered[sciId] ?? 0;
              if (deliv < reqCount && (m.inputBuffer[sciId] ?? 0) > 0) {
                m.craftProgress += (clampedDt * craftRate) / 1.4;
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
        const curveShape = getBeltCurveShape(this.machines, m);
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
          frontCurve = getBeltCurveShape(this.machines, frontTarget);
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
          const leftDir = ((m.dir + 3) & 3) as CapytorioDirection;
          const rightDir = ((m.dir + 1) & 3) as CapytorioDirection;
          const dirs: [CapytorioDirection, CapytorioDirection, CapytorioDirection] = [
            m.dir,
            leftDir,
            rightDir,
          ];
          const frontItem = m.beltItems[0];
          let transferred = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            const tryDir = dirs[(m.splitterToggle + attempt) % 3];
            const tgt = this.machines.get(tileKey(m.gx + DIR_DX[tryDir], m.gz + DIR_DZ[tryDir]));
            if (tgt && this.tryAcceptItemIntoTarget(tgt, frontItem.item, m.gx, m.gz, frontItem.lane)) {
              m.beltItems.shift();
              m.splitterToggle = (m.splitterToggle + attempt + 1) % 3;
              transferred = true;
              break;
            }
          }
          if (!transferred && m.beltItems[0].progress < 0.7) {
            m.beltItems[0].progress = Math.min(0.7, m.beltItems[0].progress + clampedDt * beltRate);
          }
        }
      } else if (m.type === 'tunnel') {
        if (m.beltItems.length > 0) {
          const item = m.beltItems[0].item;
          // Search 1..6 tiles ahead for exit tunnel facing same dir
          let jumped = false;
          for (let dist = 1; dist <= 6; dist++) {
            const exitM = this.machines.get(
              tileKey(m.gx + DIR_DX[m.dir] * dist, m.gz + DIR_DZ[m.dir] * dist)
            );
            if (exitM && exitM.type === 'tunnel' && exitM.dir === m.dir) {
              const afterExit = this.machines.get(
                tileKey(exitM.gx + DIR_DX[m.dir], exitM.gz + DIR_DZ[m.dir])
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
        const srcGx = m.gx - iFwdDx;
        const srcGz = m.gz - iFwdDz;
        const srcM = this.machines.get(tileKey(srcGx, srcGz));
        const swingSpeed = 2.05 * mTierMult * Math.max(0.5, this.powerEfficiency);
        const reachSpeed = 4.6 * mTierMult * Math.max(0.5, this.powerEfficiency);
        const returnSpeed = 2.3 * mTierMult * Math.max(0.5, this.powerEfficiency);

        // Migrate legacy saves seamlessly
        if (!m.inserterPhase) {
          m.inserterPhase = m.holdingItem
            ? 'carrying'
            : m.armSwing > 0.01
              ? 'returning'
              : 'idle_pickup';
          m.armExtend = m.holdingItem ? 1.0 : 0;
        }

        // Helper compute drop target in inserter's local coordinates (-Z = forward, +X = right)
        if (frontTarget && (frontTarget.type === 'belt' || frontTarget.type === 'splitter' || frontTarget.type === 'tunnel')) {
          const tDx = DIR_DX[frontTarget.dir];
          const tDz = DIR_DZ[frontTarget.dir];
          const relX = m.gx - frontTarget.gx;
          const relZ = m.gz - frontTarget.gz;
          const tRightDx = -tDz;
          const tRightDz = tDx;
          const isLeft = relX === -tRightDx && relZ === -tRightDz;
          const isRight = relX === tRightDx && relZ === tRightDz;
          const dropLane: 0 | 1 = isLeft ? 1 : isRight ? 0 : 0;
          const fCurve = frontTarget.type === 'belt' ? getBeltCurveShape(this.machines, frontTarget) : 'straight';
          evalBeltItemLocalPose(fCurve, dropLane, isLeft || isRight ? 0.45 : 0.08, poseScratch);
          const tgtDx = (frontTarget.gx - m.gx) * CAPYTORIO_TILE_SIZE + tRightDx * poseScratch[0] - tDx * poseScratch[1];
          const tgtDz = (frontTarget.gz - m.gz) * CAPYTORIO_TILE_SIZE + tRightDz * poseScratch[0] - tDz * poseScratch[1];
          m.dropLocalX = iRightDx * tgtDx + iRightDz * tgtDz;
          m.dropLocalZ = -(iFwdDx * tgtDx + iFwdDz * tgtDz);
        } else {
          m.dropLocalX = 0;
          m.dropLocalZ = -CAPYTORIO_TILE_SIZE * 0.9;
        }

        if (m.inserterPhase === 'idle_pickup') {
          m.armSwing = 0;
          m.armExtend = Math.max(0, (m.armExtend ?? 0) - clampedDt * reachSpeed);
          if (!m.holdingItem && frontTarget) {
            if (srcM) {
              if (srcM.type === 'belt' || srcM.type === 'splitter' || srcM.type === 'tunnel') {
                for (let bi = 0; bi < srcM.beltItems.length; bi++) {
                  const candItem = srcM.beltItems[bi];
                  if (this.wouldMachineAccept(frontTarget, candItem.item)) {
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
                  if ((srcM.outputBuffer[cand] ?? 0) > 0 && this.wouldMachineAccept(frontTarget, cand)) {
                    m.targetBeltUid = undefined;
                    m.pickupLane = 0;
                    m.pickupLocalX = 0;
                    m.pickupLocalZ = CAPYTORIO_TILE_SIZE * 0.9;
                    m.inserterPhase = 'reaching';
                    m.armExtend = 0.05;
                    break;
                  }
                }
              }
            } else if (this.spilledItems.length > 0) {
              // Empty ground tile behind inserter: pick up spilled belt-end ground items!
              const srcCenterX = srcGx * CAPYTORIO_TILE_SIZE;
              const srcCenterZ = srcGz * CAPYTORIO_TILE_SIZE;
              const halfTile = CAPYTORIO_TILE_SIZE * 0.65;
              for (let si = 0; si < this.spilledItems.length; si++) {
                const sp = this.spilledItems[si];
                if (
                  sp.y <= 0.35 &&
                  Math.abs(sp.lx - srcCenterX) <= halfTile &&
                  Math.abs(sp.lz - srcCenterZ) <= halfTile &&
                  this.wouldMachineAccept(frontTarget, sp.item)
                ) {
                  m.targetBeltUid = -sp.uid; // Negative UID tags ground-spilled item
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

          if (frontTarget) {
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
                    if (this.wouldMachineAccept(frontTarget, srcM.beltItems[bi].item)) {
                      foundIdx = bi;
                      m.targetBeltUid = srcM.beltItems[bi].uid;
                      break;
                    }
                  }
                }
                if (foundIdx !== -1) {
                  const bItem = srcM.beltItems[foundIdx];
                  if (this.wouldMachineAccept(frontTarget, bItem.item)) {
                    targetReady = true;
                    m.pickupLane = bItem.lane === 1 ? 1 : 0;
                    const sCurve = srcM.type === 'belt' ? getBeltCurveShape(this.machines, srcM) : 'straight';
                    evalBeltItemLocalPose(sCurve, m.pickupLane, bItem.progress, poseScratch);
                    const sDx = DIR_DX[srcM.dir];
                    const sDz = DIR_DZ[srcM.dir];
                    const sRightDx = -sDz;
                    const sRightDz = sDx;
                    const itemWorldDeltaX = (srcM.gx - m.gx) * CAPYTORIO_TILE_SIZE + sRightDx * poseScratch[0] - sDx * poseScratch[1];
                    const itemWorldDeltaZ = (srcM.gz - m.gz) * CAPYTORIO_TILE_SIZE + sRightDz * poseScratch[0] - sDz * poseScratch[1];
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
                m.pickupLocalZ = CAPYTORIO_TILE_SIZE * 0.9;
                for (const k in srcM.outputBuffer) {
                  const cand = k as CapytorioItemId;
                  if ((srcM.outputBuffer[cand] ?? 0) > 0 && this.wouldMachineAccept(frontTarget, cand)) {
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
                    this.wouldMachineAccept(frontTarget, sp.item)
                  ) {
                    foundIdx = si;
                    m.targetBeltUid = -sp.uid;
                    break;
                  }
                }
              }
              if (foundIdx !== -1) {
                const sp = this.spilledItems[foundIdx];
                if (this.wouldMachineAccept(frontTarget, sp.item)) {
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
            if (m.armSwing >= 1.0 && frontTarget) {
              if (this.tryAcceptItemIntoTarget(frontTarget, m.holdingItem, m.gx, m.gz, undefined, undefined, true)) {
                // Bonus stack grab for electric stack inserters from buffer sources
                if (
                  inserterStack > 1 &&
                  srcM &&
                  (srcM.type === 'chest' || srcM.type === 'furnace' || srcM.type === 'assembler')
                ) {
                  for (let extra = 1; extra < inserterStack; extra++) {
                    const avail = srcM.outputBuffer[m.holdingItem] ?? 0;
                    if (
                      avail > 0 &&
                      this.tryAcceptItemIntoTarget(frontTarget, m.holdingItem, m.gx, m.gz, undefined, undefined, true)
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
    this.evaluateMilestones(callbacks);

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
  }

  private stepSpilledItems(dt: number): void {
    const count = this.spilledItems.length;
    if (count === 0) return;

    const gravity = 14.5;
    const restitution = 0.28;
    const groundDrag = Math.exp(-7.5 * dt);
    const airDrag = Math.exp(-0.9 * dt);
    const minSep = 0.34;
    const minSepSq = minSep * minSep;

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
      }
    }

    // Gentle local pile separation so spilled items fan out instead of stacking on one point
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
        }
      }
    }
  }

  private wouldMachineAccept(target: CapytorioMachine, item: CapytorioItemId): boolean {
    if (target.type === 'belt' || target.type === 'splitter' || target.type === 'tunnel') {
      return target.beltItems.length < CAPYTORIO_BELT_MAX_ITEMS_PER_TILE;
    }
    if (target.type === 'chest') {
      return this.countMapValues(target.outputBuffer) < 120;
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
    const key = tileKey(gx, gz);
    this.inspectedTile = { gx, gz };
    this.inspectedKey = this.machines.has(key) ? key : null;
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
    const machine = this.machines.get(key) ?? null;
    const oreTile = this.getResourceAt(gx, gz);
    const hasTree = this.hasTreeAt(gx, gz);
    const spilledItems = this.getSpilledItemsAtTile(gx, gz);
    let spilledTotalCount = 0;
    for (let i = 0; i < spilledItems.length; i++) {
      spilledTotalCount += spilledItems[i].count;
    }
    const isBeacon = this.isBeaconTile(gx, gz);

    let machineDetail: CapytorioInspectedMachineDetail | null = null;
    if (machine) {
      const resolved = resolveCapytorioPlaceableSpec(machine.variantItemId ?? machine.type);
      const baseSpec = CAPYTORIO_MACHINE_SPECS[machine.type];
      const tierMult = machine.tierMult ?? resolved?.tierMult ?? 1.0;
      const inputTotal = this.countMapValues(machine.inputBuffer);
      const outputTotal = this.countMapValues(machine.outputBuffer);
      const curveShape =
        machine.type === 'belt' ? getBeltCurveShape(this.machines, machine) : 'straight';
      const leftCap =
        machine.type === 'belt'
          ? getBeltLaneCapacity(curveShape, 0)
          : machine.type === 'splitter' || machine.type === 'tunnel'
            ? CAPYTORIO_BELT_ITEMS_PER_LANE
            : 0;
      const rightCap =
        machine.type === 'belt'
          ? getBeltLaneCapacity(curveShape, 1)
          : machine.type === 'splitter' || machine.type === 'tunnel'
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
        status = outputTotal >= 120 ? 'Full' : outputTotal > 0 ? 'Working' : 'Idle';
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

    let primaryKind: CapytorioTileInspectionKind = 'terrain';
    let title = 'Meadow Grass';
    let subtitle = 'Buildable Terrain';
    let actionHint = 'Select a building from quickbar to place';

    if (machineDetail) {
      primaryKind = 'machine';
      title = machineDetail.name;
      if (machineDetail.type === 'belt') {
        const shapeLabel =
          machineDetail.beltCurveShape === 'straight'
            ? 'Straight'
            : machineDetail.beltCurveShape === 'curve_from_left'
              ? 'Curved (Left)'
              : 'Curved (Right)';
        subtitle = `Logistics · ${shapeLabel} · ${machineDetail.beltSpeedItemsPerSec}/s`;
        actionHint = 'Press [R] to rotate · Click Open to collect items';
      } else if (machineDetail.type === 'drill') {
        subtitle = resourceDetail
          ? `Mining ${resourceDetail.shortName} · ${machineDetail.tierMult.toFixed(1)}x`
          : 'Mining Drill · No Resource Below';
        actionHint = 'Outputs directly onto front belt, chest, or furnace';
      } else if (machineDetail.type === 'inserter') {
        subtitle = `Logistics · ${machineDetail.tierMult.toFixed(1)}x swing`;
        actionHint = 'Picks up behind · Drops in front · [R] Rotate';
      } else if (machineDetail.type === 'generator') {
        subtitle = `Power · ${machineDetail.powerSupplyMw.toFixed(1)} MW`;
        actionHint = 'Feed Coal or Fresh Orange for 6.0 MW surge';
      } else {
        subtitle = `Building · ${machineDetail.status}`;
        actionHint = 'Click Open to manage buffers or recipes';
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
      gx,
      gz,
      key,
      primaryKind,
      title,
      subtitle,
      machine: machineDetail,
      resource: resourceDetail,
      tree: treeDetail,
      spilledItems,
      spilledTotalCount,
      isBeacon,
      terrainName: isBeacon ? 'Surveyor Beacon Pad' : 'Meadow Grass',
      actionHint,
    };
  }

  public getUiSnapshot(): CapytorioUiSnapshot {
    const inspected = this.inspectedKey ? this.machines.get(this.inspectedKey) ?? null : null;
    const hoveredOre = this.getResourceAt(this.hoveredGx, this.hoveredGz);
    const hoveredMachine = this.machines.get(tileKey(this.hoveredGx, this.hoveredGz)) ?? null;
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
      },
    };
  }

  public serialize(): CapytorioSerializedState {
    const machinesOut: CapytorioSerializedState['machines'] = [];
    for (const m of this.machines.values()) {
      machinesOut.push({
        type: m.type,
        variantItemId: m.variantItemId,
        tierMult: m.tierMult,
        gx: m.gx,
        gz: m.gz,
        dir: m.dir,
        recipeId: m.recipeId,
        inputBuffer: { ...m.inputBuffer },
        outputBuffer: { ...m.outputBuffer },
        beltItems: m.beltItems.map((bi) => ({
          item: bi.item,
          progress: +bi.progress.toFixed(2),
          lane: bi.lane === 1 ? 1 : 0,
          squish: bi.squish ? +bi.squish.toFixed(2) : undefined,
          edgeProgress: bi.edgeProgress ? +bi.edgeProgress.toFixed(2) : undefined,
        })),
      });
    }
    const spilledOut =
      this.spilledItems.length > 0
        ? this.spilledItems.slice(0, MAX_CAPYTORIO_SPILLED_ITEMS).map((sp) => ({
            item: sp.item,
            lx: +sp.lx.toFixed(2),
            y: +sp.y.toFixed(2),
            lz: +sp.lz.toFixed(2),
            ry: +sp.ry.toFixed(2),
          }))
        : undefined;
    return {
      version: 1,
      machines: machinesOut,
      spilledItems: spilledOut,
      depletions: Array.from(this.oreRemainingOverrides.entries()),
      harvestedTrees: Array.from(this.harvestedTrees.values()),
      recentTools: this.getRecentTools(),
      pocketItems: { ...this.pocketItems },
      pocketMachines: { ...this.pocketMachines },
      unlockedTechs: Array.from(this.unlockedTechs),
      activeTechId: this.activeTechId,
      techDelivered: { ...this.techDelivered },
      completedMilestones: Array.from(this.completedMilestones),
      rocketLaunches: this.rocketLaunches,
      totalProduced: this.totalProduced,
      score: this.score,
    };
  }

  public hydrate(raw: CapytorioSerializedState): void {
    this.machines.clear();
    this.spilledItems.length = 0;
    this.oreRemainingOverrides.clear();
    this.harvestedTrees.clear();
    this.topologyRevision++;
    for (const k of Object.keys(this.pocketItems) as CapytorioItemId[]) {
      delete this.pocketItems[k];
    }
    for (const m of CAPYTORIO_HOTBAR_ORDER) {
      this.pocketMachines[m] = 0;
    }

    if (raw.pocketItems) {
      for (const [k, v] of Object.entries(raw.pocketItems) as Array<[CapytorioItemId, number]>) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          this.pocketItems[k] = Math.round(v);
        }
      }
    }
    if (raw.pocketMachines) {
      for (const m of CAPYTORIO_HOTBAR_ORDER) {
        const val = raw.pocketMachines[m];
        this.pocketMachines[m] =
          typeof val === 'number' && Number.isFinite(val) ? Math.max(0, Math.round(val)) : 0;
      }
    }
    if (Array.isArray(raw.depletions)) {
      for (let i = 0; i < raw.depletions.length; i++) {
        const pair = raw.depletions[i];
        if (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'number') {
          this.oreRemainingOverrides.set(pair[0], Math.max(0, Math.round(pair[1])));
        }
      }
    }
    if (Array.isArray(raw.harvestedTrees)) {
      for (let i = 0; i < raw.harvestedTrees.length; i++) {
        if (typeof raw.harvestedTrees[i] === 'string') {
          this.harvestedTrees.add(raw.harvestedTrees[i]);
        }
      }
    }
    if (Array.isArray(raw.recentTools)) {
      const cleaned: string[] = [];
      for (let i = 0; i < raw.recentTools.length && cleaned.length < MAX_RECENT_CAPYTORIO_TOOLS; i++) {
        const tid = raw.recentTools[i];
        if (typeof tid === 'string' && resolveCapytorioPlaceableSpec(tid) && !cleaned.includes(tid)) {
          cleaned.push(tid);
        }
      }
      for (let i = 0; i < CAPYTORIO_HOTBAR_ORDER.length && cleaned.length < MAX_RECENT_CAPYTORIO_TOOLS; i++) {
        if (!cleaned.includes(CAPYTORIO_HOTBAR_ORDER[i])) {
          cleaned.push(CAPYTORIO_HOTBAR_ORDER[i]);
        }
      }
      this.recentTools = cleaned;
    } else {
      this.recentTools = [...CAPYTORIO_HOTBAR_ORDER];
    }
    this.unlockedTechs.clear();
    if (Array.isArray(raw.unlockedTechs)) {
      for (let i = 0; i < raw.unlockedTechs.length; i++) {
        if (TECH_BY_ID.has(raw.unlockedTechs[i])) {
          this.unlockedTechs.add(raw.unlockedTechs[i]);
        }
      }
    }
    this.completedMilestones.clear();
    if (Array.isArray(raw.completedMilestones)) {
      for (let i = 0; i < raw.completedMilestones.length; i++) {
        if (typeof raw.completedMilestones[i] === 'string') {
          this.completedMilestones.add(raw.completedMilestones[i]);
        }
      }
    }
    this.activeTechId =
      raw.activeTechId && TECH_BY_ID.has(raw.activeTechId) ? raw.activeTechId : getDefaultTechId();
    this.techDelivered = raw.techDelivered ? { ...raw.techDelivered } : {};
    this.rocketLaunches = Math.max(0, Math.round(raw.rocketLaunches || 0));
    this.totalProduced = Math.max(0, Math.round(raw.totalProduced || 0));
    this.score = Math.max(0, Math.round(raw.score || 0));
    this.lastReportedScore = this.score;

    if (Array.isArray(raw.machines)) {
      for (let i = 0; i < raw.machines.length; i++) {
        const sm = raw.machines[i];
        if (!sm || typeof sm.gx !== 'number' || typeof sm.gz !== 'number') continue;
        if (!CAPYTORIO_MACHINE_SPECS[sm.type]) continue;
        const machine: CapytorioMachine = {
          id: this.nextMachineId++,
          type: sm.type,
          variantItemId: sm.variantItemId,
          tierMult: sm.tierMult,
          gx: Math.round(sm.gx),
          gz: Math.round(sm.gz),
          dir: ((sm.dir ?? 1) & 3) as CapytorioDirection,
          recipeId: sm.recipeId,
          craftProgress: 0,
          productivityProgress: 0,
          fuelTimer: 0,
          armSwing: 0,
          armExtend: 0,
          inserterPhase: sm.type === 'inserter' ? 'idle_pickup' : undefined,
          holdingItem: null,
          splitterToggle: 0,
          inputBuffer: sm.inputBuffer ? { ...sm.inputBuffer } : {},
          outputBuffer: sm.outputBuffer ? { ...sm.outputBuffer } : {},
          beltItems: Array.isArray(sm.beltItems)
            ? sm.beltItems.slice(0, CAPYTORIO_BELT_MAX_ITEMS_PER_TILE).map((b) => ({
                uid: this.nextBeltItemUid++,
                item: b.item,
                progress: b.progress,
                lane: b.lane === 1 ? 1 : 0,
                squish: 0,
                edgeProgress:
                  typeof b.edgeProgress === 'number' && Number.isFinite(b.edgeProgress)
                    ? Math.max(0, Math.min(1, b.edgeProgress))
                    : 0,
              }))
            : [],
        };
        this.machines.set(tileKey(machine.gx, machine.gz), machine);
      }
    }

    if (Array.isArray(raw.spilledItems)) {
      for (let i = 0; i < raw.spilledItems.length && this.spilledItems.length < MAX_CAPYTORIO_SPILLED_ITEMS; i++) {
        const sp = raw.spilledItems[i];
        if (
          !sp ||
          typeof sp.item !== 'string' ||
          typeof sp.lx !== 'number' ||
          !Number.isFinite(sp.lx) ||
          typeof sp.lz !== 'number' ||
          !Number.isFinite(sp.lz)
        ) {
          continue;
        }
        const cleanY = typeof sp.y === 'number' && Number.isFinite(sp.y) ? Math.max(0, Math.min(8, sp.y)) : 0;
        const cleanRy = typeof sp.ry === 'number' && Number.isFinite(sp.ry) ? sp.ry : 0;
        this.spilledItems.push({
          uid: this.nextSpilledItemUid++,
          item: sp.item as CapytorioItemId,
          lx: sp.lx,
          y: cleanY,
          lz: sp.lz,
          vx: 0,
          vy: 0,
          vz: 0,
          rx: 0,
          ry: cleanRy,
          rz: 0,
          vrx: 0,
          vrz: 0,
          squish: 0,
          settled: cleanY <= 0.01,
          ageSec: 0,
        });
      }
    }

    this.machineListDirty = true;
    this.recomputePowerMetrics();
  }
}

export function sanitizeCapytorioState(raw: unknown): CapytorioSerializedState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as CapytorioSerializedState;
  if (candidate.version !== 1) return undefined;
  const eng = new CapytorioFactoryEngine(candidate);
  return eng.serialize();
}
