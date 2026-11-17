import {
  CAPYTORIO_CHUNK_SIZE,
  CAPYTORIO_HOTBAR_ORDER,
  CAPYTORIO_MACHINE_SPECS,
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

export interface CapytorioBeltItem {
  item: CapytorioItemId;
  progress: number; // 0..1 along tile direction
}

export interface CapytorioMachine {
  id: number;
  type: CapytorioMachineType;
  gx: number;
  gz: number;
  dir: CapytorioDirection;
  recipeId?: CapytorioRecipeId;
  craftProgress: number;
  productivityProgress: number;
  fuelTimer: number;
  armSwing: number; // 0..1 inserter visual arm progress
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
    gx: number;
    gz: number;
    dir: CapytorioDirection;
    recipeId?: CapytorioRecipeId;
    inputBuffer?: Partial<Record<CapytorioItemId, number>>;
    outputBuffer?: Partial<Record<CapytorioItemId, number>>;
    beltItems?: Array<{ item: CapytorioItemId; progress: number }>;
  }>;
  depletions: Array<[string, number]>;
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

export interface CapytorioUiSnapshot {
  machineCount: number;
  powerSupplyMw: number;
  powerDemandMw: number;
  powerEfficiency: number;
  selectedTool: CapytorioMachineType | 'demolish' | 'mine';
  selectedDir: CapytorioDirection;
  selectedRecipeId: CapytorioRecipeId;
  inspectedMachine: {
    gx: number;
    gz: number;
    type: CapytorioMachineType;
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
  hoveredTile: {
    gx: number;
    gz: number;
    resource: CapytorioItemId | null;
    resourceAmount: number;
    machineType: CapytorioMachineType | null;
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

function getDefaultTechId(): CapytorioTechId | null {
  return CAPYTORIO_TECHS[0]?.id ?? null;
}

function getDefaultAssemblerRecipeId(): CapytorioRecipeId {
  for (let i = 0; i < CAPYTORIO_RECIPES.length; i++) {
    const r = CAPYTORIO_RECIPES[i];
    if (r.station === 'assembler' && r.unlockedByDefault) return r.id;
  }
  return CAPYTORIO_RECIPES[0]?.id ?? 'iron_gear';
}

export class CapytorioFactoryEngine {
  public readonly machines = new Map<string, CapytorioMachine>();
  private readonly oreRemainingOverrides = new Map<string, number>();
  private readonly pocketItems: Partial<Record<CapytorioItemId, number>> = {};
  private readonly pocketMachines: Partial<Record<CapytorioMachineType, number>> = {};
  private readonly unlockedTechs = new Set<CapytorioTechId>();
  private readonly completedMilestones = new Set<string>();
  private activeTechId: CapytorioTechId | null = getDefaultTechId();
  private techDelivered: Partial<Record<CapytorioItemId, number>> = {};

  private nextMachineId = 1;
  private rocketLaunches = 0;
  private totalProduced = 0;
  private score = 0;
  private lastReportedScore = 0;

  // Player build tool state
  public selectedTool: CapytorioMachineType | 'demolish' | 'mine' = 'drill';
  public selectedDir: CapytorioDirection = 1; // East (+X) by default
  public selectedRecipeId: CapytorioRecipeId = getDefaultAssemblerRecipeId();
  public hoveredGx = 0;
  public hoveredGz = 0;
  public inspectedKey: string | null = null;

  // Power metrics (zero-allocation cached scalars updated every step)
  public powerSupplyMw = 0;
  public powerDemandMw = 0;
  public powerEfficiency = 1.0;

  // External ProceduralGameConfig / progression multipliers
  public configCraftSpeedMult = 1.0;
  public configBeltSpeedMult = 1.0;
  public configOreRichnessMult = 1.0;

  // Reusable ordered snapshot list for zero-allocation iteration inside step()
  private machineStepList: CapytorioMachine[] = [];
  private machineListDirty = true;

  constructor(initialState?: CapytorioSerializedState | null) {
    if (initialState && initialState.version === 1) {
      this.hydrate(initialState);
    } else {
      this.resetToBlankStarterField();
    }
  }

  public resetToBlankStarterField(): void {
    this.machines.clear();
    this.oreRemainingOverrides.clear();
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
    this.rocketLaunches = 0;
    this.totalProduced = 0;
    this.score = 0;
    this.lastReportedScore = 0;
    this.inspectedKey = null;
    this.selectedTool = 'drill';
    this.selectedDir = 1;
    this.selectedRecipeId = getDefaultAssemblerRecipeId();
    this.machineListDirty = true;
    this.recomputePowerMetrics();
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
    return true;
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

  public pocketCraftRecipe(recipeId: CapytorioRecipeId): boolean {
    const rec = RECIPE_BY_ID.get(recipeId);
    if (!rec || !this.canAffordPocketRecipe(recipeId)) return false;
    for (let i = 0; i < rec.ingredients.length; i++) {
      this.consumePocketItem(rec.ingredients[i].item, rec.ingredients[i].count);
    }
    this.addPocketItem(rec.result, rec.resultCount);
    this.totalProduced += rec.resultCount;
    this.score += 5 * rec.resultCount;
    return true;
  }

  public handMineAt(gx: number, gz: number, yieldCount: number = 2): CapytorioItemId | null {
    const res = this.depleteOreAt(gx, gz, yieldCount);
    if (!res) return null;
    this.addPocketItem(res, yieldCount);
    this.score += 2 * yieldCount;
    return res;
  }

  public placeMachine(
    type: CapytorioMachineType,
    gx: number,
    gz: number,
    dir: CapytorioDirection = this.selectedDir,
    recipeId?: CapytorioRecipeId
  ): { ok: boolean; reason?: string; machine?: CapytorioMachine } {
    const key = tileKey(gx, gz);
    const existing = this.machines.get(key);
    if (existing) {
      // Clicking an existing belt/inserter with same tool rotates it cleanly instead of failing!
      if (existing.type === type) {
        existing.dir = ((existing.dir + 1) & 3) as CapytorioDirection;
        return { ok: true, machine: existing };
      }
      return { ok: false, reason: 'Tile already occupied — Right-click or press X to demolish first' };
    }

    if (type === 'drill') {
      const ore = this.getResourceAt(gx, gz);
      if (!ore) {
        return { ok: false, reason: 'Mining Drills must be placed on glowing ore tiles' };
      }
    }

    const inPocket = this.getPocketMachineCount(type);
    if (inPocket > 0) {
      this.pocketMachines[type] = inPocket - 1;
    } else if (!this.craftMachineIntoPocket(type)) {
      return { ok: false, reason: `Need materials to craft ${CAPYTORIO_MACHINE_SPECS[type].name}` };
    } else {
      // Use the one just crafted
      this.pocketMachines[type] = Math.max(0, (this.pocketMachines[type] ?? 1) - 1);
    }

    const machine: CapytorioMachine = {
      id: this.nextMachineId++,
      type,
      gx,
      gz,
      dir,
      recipeId: type === 'assembler' ? recipeId ?? this.selectedRecipeId : undefined,
      craftProgress: 0,
      productivityProgress: 0,
      fuelTimer: 0,
      armSwing: 0,
      holdingItem: null,
      splitterToggle: 0,
      inputBuffer: {},
      outputBuffer: {},
      beltItems: [],
    };
    this.machines.set(key, machine);
    this.machineListDirty = true;
    this.inspectedKey = key;
    this.score += 10;
    this.recomputePowerMetrics();
    return { ok: true, machine };
  }

  public rotateMachineAt(gx: number, gz: number): CapytorioDirection | null {
    const m = this.machines.get(tileKey(gx, gz));
    if (!m) return null;
    m.dir = ((m.dir + 1) & 3) as CapytorioDirection;
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
    // 100% friendly refund of machine + buffered items + belt items
    this.pocketMachines[m.type] = (this.pocketMachines[m.type] ?? 0) + 1;
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
    this.machineListDirty = true;
    this.recomputePowerMetrics();
    return m.type;
  }

  /**
   * Drag-safe placement helper: skips already-occupied tiles and automatically aligns
   * Transport Belts along orthogonal drag steps (orienting both the new tile and previous
   * drag tile so multi-tile belt runs and corners connect seamlessly).
   */
  public placeMachineDuringDrag(
    type: CapytorioMachineType,
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
          }
        }
      }
    }
    const existing = this.machines.get(tileKey(gx, gz));
    if (existing) {
      return { ok: false, appliedDir: targetDir };
    }
    const res = this.placeMachine(type, gx, gz, targetDir);
    return {
      ok: res.ok,
      machine: res.machine,
      appliedDir: targetDir,
    };
  }

  /**
   * Factorio `[Q]` Smart Pipette: samples the hovered machine's type & assembler recipe,
   * or clears the active build tool back to Inspect/Hand-Mine if the tile is empty.
   */
  public pipetteAt(gx: number, gz: number): {
    tool: CapytorioMachineType | 'mine';
    picked: boolean;
    copiedRecipeId?: CapytorioRecipeId;
  } {
    const key = tileKey(gx, gz);
    const existing = this.machines.get(key);
    if (existing) {
      this.selectedTool = existing.type;
      this.selectedDir = existing.dir;
      this.inspectedKey = key;
      if (existing.type === 'assembler' && existing.recipeId) {
        this.selectedRecipeId = existing.recipeId;
      }
      return {
        tool: existing.type,
        picked: true,
        copiedRecipeId: existing.recipeId,
      };
    }
    this.selectedTool = 'mine';
    return { tool: 'mine', picked: false };
  }

  /**
   * Manually loads coal or yuzu_sap from pocket into a Coal Steam Generator,
   * igniting immediately if idle so power output surges from 1.5 MW -> 6.0 MW.
   */
  public insertPocketFuelToGenerator(gx: number, gz: number, maxAmount: number = 5): number {
    const m = this.machines.get(tileKey(gx, gz));
    if (!m || m.type !== 'generator') return 0;

    let loaded = 0;
    const fuels: readonly CapytorioItemId[] = ['coal', 'yuzu_sap'];
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
      50,
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

    const defs: Array<{ id: string; label: string; hint: string; met: boolean; coins: number }> = [
      {
        id: 'mine_ore',
        label: 'Mine Starter Ore',
        hint: 'Press [E] over a glowing ore seam or drill it',
        met: this.completedMilestones.has('mine_ore') || totalOreMined >= 2 || drillCount >= 1,
        coins: 5,
      },
      {
        id: 'place_drill',
        label: 'Place Mining Drill',
        hint: 'Equip Drill [1] and click on NW Iron or NE Copper',
        met: this.completedMilestones.has('place_drill') || drillCount >= 1,
        coins: 8,
      },
      {
        id: 'lay_belts',
        label: 'Run Conveyor Line',
        hint: 'Select Belt [2] & drag across 3 tiles from a drill',
        met: this.completedMilestones.has('lay_belts') || beltCount >= 3,
        coins: 10,
      },
      {
        id: 'smelt_power',
        label: 'Smelt & Power Grid',
        hint: 'Place a Furnace [4] or fuel Coal Generator [6]',
        met:
          this.completedMilestones.has('smelt_power') ||
          (furnaceOrGenActive && this.totalProduced >= 2),
        coins: 12,
      },
      {
        id: 'research_lab',
        label: 'Automate Science Lab',
        hint: 'Craft Science Packs, place Lab [7] & click Feed Sci',
        met:
          this.completedMilestones.has('research_lab') ||
          this.unlockedTechs.size >= 1 ||
          (labCount >= 1 && (totalSci >= 1 || Object.keys(this.techDelivered).length > 0)),
        coins: 15,
      },
      {
        id: 'launch_rocket',
        label: 'Launch Yuzu Rocket',
        hint: 'Reach Rocket Productivity & launch into orbit',
        met: this.completedMilestones.has('launch_rocket') || this.rocketLaunches >= 1,
        coins: 30,
      },
    ];

    const out: CapytorioMilestoneStatus[] = [];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (d.met && !this.completedMilestones.has(d.id)) {
        this.completedMilestones.add(d.id);
        this.score += d.coins * 5;
        callbacks?.onMilestoneCompleted?.(d.id, d.label, d.coins);
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
      demand += spec.powerDemandMw;
      if (m.type === 'generator') {
        supply += (m.fuelTimer > 0 ? spec.powerSupplyMw : 1.5) * genBonus;
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
    fromGz: number
  ): boolean {
    if (target.type === 'belt' || target.type === 'splitter' || target.type === 'tunnel') {
      if (target.beltItems.length >= 2) return false;
      const progress =
        target.type === 'belt' && fromGx === target.gx - DIR_DX[target.dir] && fromGz === target.gz - DIR_DZ[target.dir]
          ? 0.05
          : 0.45;
      for (let i = 0; i < target.beltItems.length; i++) {
        if (Math.abs(target.beltItems[i].progress - progress) < 0.25) return false;
      }
      target.beltItems.push({ item, progress });
      return true;
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
      if (item !== 'coal' && item !== 'yuzu_sap') return false;
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

    for (let i = 0; i < this.machineStepList.length; i++) {
      const m = this.machineStepList[i];
      const fGx = m.gx + DIR_DX[m.dir];
      const fGz = m.gz + DIR_DZ[m.dir];
      const frontTarget = this.machines.get(tileKey(fGx, fGz));

      if (m.type === 'drill') {
        const oreTile = this.getResourceAt(m.gx, m.gz);
        const bufferedOut = this.countMapValues(m.outputBuffer);
        if (oreTile && bufferedOut < 4) {
          m.craftProgress += (clampedDt * craftRate) / 2.2;
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
          m.craftProgress += (clampedDt * craftRate) / craftSec;
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
            m.craftProgress += (clampedDt * craftRate) / rec.craftTimeSec;
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
        for (let bi = m.beltItems.length - 1; bi >= 0; bi--) {
          const bItem = m.beltItems[bi];
          const maxAllow = bi === 0 ? 1.0 : Math.min(1.0, m.beltItems[bi - 1].progress - 0.34);
          bItem.progress = Math.min(maxAllow, bItem.progress + clampedDt * beltRate);
          if (bItem.progress >= 0.98 && frontTarget) {
            if (this.tryAcceptItemIntoTarget(frontTarget, bItem.item, m.gx, m.gz)) {
              m.beltItems.splice(bi, 1);
            }
          }
        }
        // Keep beltItems sorted highest-progress first
        if (m.beltItems.length === 2 && m.beltItems[0].progress < m.beltItems[1].progress) {
          const tmp = m.beltItems[0];
          m.beltItems[0] = m.beltItems[1];
          m.beltItems[1] = tmp;
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
          const item = m.beltItems[0].item;
          let transferred = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            const tryDir = dirs[(m.splitterToggle + attempt) % 3];
            const tgt = this.machines.get(tileKey(m.gx + DIR_DX[tryDir], m.gz + DIR_DZ[tryDir]));
            if (tgt && this.tryAcceptItemIntoTarget(tgt, item, m.gx, m.gz)) {
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
        const srcGx = m.gx - DIR_DX[m.dir];
        const srcGz = m.gz - DIR_DZ[m.dir];
        const srcM = this.machines.get(tileKey(srcGx, srcGz));
        const swingSpeed = 1.85 * Math.max(0.5, this.powerEfficiency);

        if (!m.holdingItem && srcM && frontTarget) {
          // Pick best candidate item from source
          let picked: CapytorioItemId | null = null;
          if (srcM.type === 'belt' && srcM.beltItems.length > 0) {
            // Check filter against frontTarget acceptance
            for (let bi = 0; bi < srcM.beltItems.length; bi++) {
              const cand = srcM.beltItems[bi].item;
              if (this.wouldMachineAccept(frontTarget, cand)) {
                picked = cand;
                srcM.beltItems.splice(bi, 1);
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
                picked = cand;
                srcM.outputBuffer[cand] = (srcM.outputBuffer[cand] ?? 1) - 1;
                if (srcM.outputBuffer[cand]! <= 0) delete srcM.outputBuffer[cand];
                break;
              }
            }
          }
          if (picked) {
            m.holdingItem = picked;
            m.armSwing = 0;
          }
        }

        if (m.holdingItem) {
          m.armSwing = Math.min(1.0, m.armSwing + clampedDt * swingSpeed);
          if (m.armSwing >= 1.0 && frontTarget) {
            if (this.tryAcceptItemIntoTarget(frontTarget, m.holdingItem, m.gx, m.gz)) {
              // Bonus stack grab for electric stack inserters from buffer sources!
              if (inserterStack > 1 && srcM && (srcM.type === 'chest' || srcM.type === 'furnace' || srcM.type === 'assembler')) {
                for (let extra = 1; extra < inserterStack; extra++) {
                  const avail = srcM.outputBuffer[m.holdingItem] ?? 0;
                  if (avail > 0 && this.tryAcceptItemIntoTarget(frontTarget, m.holdingItem, m.gx, m.gz)) {
                    srcM.outputBuffer[m.holdingItem] = avail - 1;
                    if (avail - 1 <= 0) delete srcM.outputBuffer[m.holdingItem];
                  } else {
                    break;
                  }
                }
              }
              m.holdingItem = null;
              m.armSwing = 0;
            }
          }
        } else if (m.armSwing > 0) {
          m.armSwing = Math.max(0, m.armSwing - clampedDt * swingSpeed * 1.3);
        }
      }
    }

    this.evaluateMilestones(callbacks);

    if (this.score !== this.lastReportedScore) {
      this.lastReportedScore = this.score;
      callbacks?.onScoreChanged?.(this.score);
    }
  }

  private wouldMachineAccept(target: CapytorioMachine, item: CapytorioItemId): boolean {
    if (target.type === 'belt' || target.type === 'splitter' || target.type === 'tunnel') {
      return target.beltItems.length < 2;
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
      return (item === 'coal' || item === 'yuzu_sap') && (target.inputBuffer[item] ?? 0) < 16;
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

  public getUiSnapshot(): CapytorioUiSnapshot {
    const inspected = this.inspectedKey ? this.machines.get(this.inspectedKey) ?? null : null;
    const hoveredOre = this.getResourceAt(this.hoveredGx, this.hoveredGz);
    const hoveredMachine = this.machines.get(tileKey(this.hoveredGx, this.hoveredGz)) ?? null;
    const activeTech = this.activeTechId ? TECH_BY_ID.get(this.activeTechId) : null;

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
      inspectedMachine: inspected
        ? {
            gx: inspected.gx,
            gz: inspected.gz,
            type: inspected.type,
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
      hoveredTile: {
        gx: this.hoveredGx,
        gz: this.hoveredGz,
        resource: hoveredOre?.resource ?? null,
        resourceAmount: hoveredOre?.richness ?? 0,
        machineType: hoveredMachine?.type ?? null,
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
    };
  }

  public serialize(): CapytorioSerializedState {
    const machinesOut: CapytorioSerializedState['machines'] = [];
    for (const m of this.machines.values()) {
      machinesOut.push({
        type: m.type,
        gx: m.gx,
        gz: m.gz,
        dir: m.dir,
        recipeId: m.recipeId,
        inputBuffer: { ...m.inputBuffer },
        outputBuffer: { ...m.outputBuffer },
        beltItems: m.beltItems.map((bi) => ({ item: bi.item, progress: +bi.progress.toFixed(2) })),
      });
    }
    return {
      version: 1,
      machines: machinesOut,
      depletions: Array.from(this.oreRemainingOverrides.entries()),
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
    this.oreRemainingOverrides.clear();
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
          gx: Math.round(sm.gx),
          gz: Math.round(sm.gz),
          dir: ((sm.dir ?? 1) & 3) as CapytorioDirection,
          recipeId: sm.recipeId,
          craftProgress: 0,
          productivityProgress: 0,
          fuelTimer: 0,
          armSwing: 0,
          holdingItem: null,
          splitterToggle: 0,
          inputBuffer: sm.inputBuffer ? { ...sm.inputBuffer } : {},
          outputBuffer: sm.outputBuffer ? { ...sm.outputBuffer } : {},
          beltItems: Array.isArray(sm.beltItems)
            ? sm.beltItems.slice(0, 2).map((b) => ({ item: b.item, progress: b.progress }))
            : [],
        };
        this.machines.set(tileKey(machine.gx, machine.gz), machine);
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
