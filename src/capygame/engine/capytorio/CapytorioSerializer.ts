import {
  CAPYTORIO_CHEST_SLOTS,
  CAPYTORIO_HOTBAR_ORDER,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  CAPYTORIO_TECHS,
  RECIPE_BY_ID,
  TECH_BY_ID,
  getCapytorioFootprint,
  isCapytorioFunctionalInserter,
  isCapytorioStorageChest,
  type CapytorioDirection,
  type CapytorioItemId,
  type CapytorioMachineType,
  type CapytorioTechId,
} from '../CapytorioData';
import {
  CAPYTORIO_BELT_MAX_ITEMS_PER_TILE,
  MAX_CAPYTORIO_BLUEPRINT_LIBRARY,
  MAX_CAPYTORIO_SPILLED_ITEMS,
  MAX_RECENT_CAPYTORIO_TOOLS,
  isCapytorioModuleItem,
  resolveCapytorioPlaceableSpec,
  tileKey,
  type CapytorioBlueprintEntry,
  type CapytorioCraftQueueItem,
  type CapytorioEntitySettingsClipboard,
  type CapytorioHistoryEntry,
  type CapytorioMachine,
  type CapytorioSavedBlueprint,
  type CapytorioSerializedState,
  type CapytorioSpilledItem,
} from '../CapytorioFactoryEngine';
import { buildBlueprintLabel, computeBlueprintBounds } from './CapytorioBlueprintService';

export interface CapytorioSerializerHost {
  machines: Map<string, CapytorioMachine>;
  occupancyGrid: Map<string, CapytorioMachine>;
  spilledItems: CapytorioSpilledItem[];
  oreRemainingOverrides: Map<string, number>;
  harvestedTrees: Set<string>;
  recentTools: string[];
  pocketItems: Partial<Record<CapytorioItemId, number>>;
  pocketMachines: Partial<Record<CapytorioMachineType, number>>;
  unlockedTechs: Set<CapytorioTechId>;
  activeTechId: CapytorioTechId | null;
  techDelivered: Partial<Record<CapytorioItemId, number>>;
  completedMilestones: Set<string>;
  blueprintLibrary: CapytorioSavedBlueprint[];
  activeBlueprintId: string | null;
  altModeEnabled: boolean;
  rocketLaunches: number;
  totalProduced: number;
  score: number;
  lastReportedScore: number;
  pasteAnchor: { gx: number; gz: number } | null;
  undoStack: CapytorioHistoryEntry[];
  redoStack: CapytorioHistoryEntry[];
  activeHistoryBatch: unknown;
  craftingQueue: CapytorioCraftQueueItem[];
  entitySettingsClipboard: CapytorioEntitySettingsClipboard | null;
  topologyRevision: number;
  allocateMachineId(): number;
  allocateBeltItemUid(): number;
  allocateSpilledItemUid(): number;
  allocateBlueprintUid(): number;
  getRecentTools(): string[];
  canFootprintFit(
    gx: number,
    gz: number,
    width: number,
    height: number,
    ignoreMachine?: CapytorioMachine,
    allowWater?: boolean
  ): boolean;
  getMachineModuleSlotLimit(m: CapytorioMachine): number;
  registerMachineOccupancy(m: CapytorioMachine): void;
  markHydratedAndRecomputePower(): void;
}

export function serializeCapytorioEngineState(
  host: CapytorioSerializerHost
): CapytorioSerializedState {
  const machinesOut: CapytorioSerializedState['machines'] = [];
  for (const m of host.machines.values()) {
    machinesOut.push({
      type: m.type,
      variantItemId: m.variantItemId,
      tierMult: m.tierMult,
      gx: m.gx,
      gz: m.gz,
      dir: m.dir,
      recipeId: m.recipeId,
      splitterInputPriority: m.splitterInputPriority,
      splitterOutputPriority: m.splitterOutputPriority,
      splitterFilterItem: m.splitterFilterItem,
      inserterFilterMode: m.inserterFilterMode,
      inserterFilters: m.inserterFilters ? [...m.inserterFilters] : undefined,
      inserterStackLimit: m.inserterStackLimit,
      chestSlotLimit: m.chestSlotLimit,
      modules: m.modules && m.modules.length > 0 ? [...m.modules] : undefined,
      integrity: typeof m.integrity === 'number' && m.integrity < 100 ? m.integrity : undefined,
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
    host.spilledItems.length > 0
      ? host.spilledItems.slice(0, MAX_CAPYTORIO_SPILLED_ITEMS).map((sp) => ({
          item: sp.item,
          lx: +sp.lx.toFixed(2),
          y: +sp.y.toFixed(2),
          lz: +sp.lz.toFixed(2),
          ry: +sp.ry.toFixed(2),
        }))
      : undefined;
  const blueprintsOut =
    host.blueprintLibrary.length > 0
      ? host.blueprintLibrary.slice(0, MAX_CAPYTORIO_BLUEPRINT_LIBRARY).map((bp) => ({
          id: bp.id,
          label: bp.label,
          sourceMode: bp.sourceMode,
          createdAt: bp.createdAt,
          width: bp.width,
          height: bp.height,
          entries: bp.entries.map((e) => ({
            dx: e.dx,
            dz: e.dz,
            toolId: e.toolId,
            baseType: e.baseType,
            dir: e.dir,
            recipeId: e.recipeId,
            splitterInputPriority: e.splitterInputPriority,
            splitterOutputPriority: e.splitterOutputPriority,
            splitterFilterItem: e.splitterFilterItem,
            inserterFilterMode: e.inserterFilterMode,
            inserterFilters: e.inserterFilters ? [...e.inserterFilters] : undefined,
            inserterStackLimit: e.inserterStackLimit,
            chestSlotLimit: e.chestSlotLimit,
          })),
        }))
      : undefined;
  return {
    version: 1,
    machines: machinesOut,
    spilledItems: spilledOut,
    depletions: Array.from(host.oreRemainingOverrides.entries()),
    harvestedTrees: Array.from(host.harvestedTrees.values()),
    recentTools: host.getRecentTools(),
    pocketItems: { ...host.pocketItems },
    pocketMachines: { ...host.pocketMachines },
    unlockedTechs: Array.from(host.unlockedTechs),
    activeTechId: host.activeTechId,
    techDelivered: { ...host.techDelivered },
    completedMilestones: Array.from(host.completedMilestones),
    blueprintLibrary: blueprintsOut,
    altModeEnabled: host.altModeEnabled,
    rocketLaunches: host.rocketLaunches,
    totalProduced: host.totalProduced,
    score: host.score,
  };
}

export function hydrateCapytorioEngineState(
  host: CapytorioSerializerHost,
  raw: CapytorioSerializedState
): void {
  host.machines.clear();
  host.occupancyGrid.clear();
  host.spilledItems.length = 0;
  host.oreRemainingOverrides.clear();
  host.harvestedTrees.clear();
  host.pasteAnchor = null;
  host.undoStack.length = 0;
  host.redoStack.length = 0;
  host.activeHistoryBatch = null;
  host.craftingQueue.length = 0;
  host.entitySettingsClipboard = null;
  host.altModeEnabled = typeof raw.altModeEnabled === 'boolean' ? raw.altModeEnabled : true;
  host.topologyRevision++;
  for (const k of Object.keys(host.pocketItems) as CapytorioItemId[]) {
    delete host.pocketItems[k];
  }
  for (const m of CAPYTORIO_HOTBAR_ORDER) {
    host.pocketMachines[m] = 0;
  }

  if (raw.pocketItems) {
    for (const [k, v] of Object.entries(raw.pocketItems) as Array<[CapytorioItemId, number]>) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        host.pocketItems[k] = Math.round(v);
      }
    }
  }
  if (raw.pocketMachines) {
    for (const m of CAPYTORIO_HOTBAR_ORDER) {
      const val = raw.pocketMachines[m];
      host.pocketMachines[m] =
        typeof val === 'number' && Number.isFinite(val) ? Math.max(0, Math.round(val)) : 0;
    }
  }
  if (Array.isArray(raw.depletions)) {
    for (let i = 0; i < raw.depletions.length; i++) {
      const pair = raw.depletions[i];
      if (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'number') {
        host.oreRemainingOverrides.set(pair[0], Math.max(0, Math.round(pair[1])));
      }
    }
  }
  if (Array.isArray(raw.harvestedTrees)) {
    for (let i = 0; i < raw.harvestedTrees.length; i++) {
      if (typeof raw.harvestedTrees[i] === 'string') {
        host.harvestedTrees.add(raw.harvestedTrees[i]);
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
    for (
      let i = 0;
      i < CAPYTORIO_HOTBAR_ORDER.length && cleaned.length < MAX_RECENT_CAPYTORIO_TOOLS;
      i++
    ) {
      if (!cleaned.includes(CAPYTORIO_HOTBAR_ORDER[i])) {
        cleaned.push(CAPYTORIO_HOTBAR_ORDER[i]);
      }
    }
    host.recentTools = cleaned;
  } else {
    host.recentTools = [...CAPYTORIO_HOTBAR_ORDER];
  }
  host.unlockedTechs.clear();
  if (Array.isArray(raw.unlockedTechs)) {
    for (let i = 0; i < raw.unlockedTechs.length; i++) {
      if (TECH_BY_ID.has(raw.unlockedTechs[i])) {
        host.unlockedTechs.add(raw.unlockedTechs[i]);
      }
    }
  }
  host.completedMilestones.clear();
  if (Array.isArray(raw.completedMilestones)) {
    for (let i = 0; i < raw.completedMilestones.length; i++) {
      if (typeof raw.completedMilestones[i] === 'string') {
        host.completedMilestones.add(raw.completedMilestones[i]);
      }
    }
  }
  let activeTechId: CapytorioTechId | null = null;
  if (raw.activeTechId && TECH_BY_ID.has(raw.activeTechId)) {
    const tech = TECH_BY_ID.get(raw.activeTechId)!;
    if (tech.repeatable || !host.unlockedTechs.has(raw.activeTechId)) {
      activeTechId = raw.activeTechId;
    }
  }
  if (!activeTechId) {
    for (let i = 0; i < CAPYTORIO_TECHS.length; i++) {
      const candidate = CAPYTORIO_TECHS[i];
      if (candidate.repeatable || !host.unlockedTechs.has(candidate.id)) {
        activeTechId = candidate.id;
        break;
      }
    }
  }
  host.activeTechId = activeTechId;
  host.techDelivered = {};
  if (raw.techDelivered && typeof raw.techDelivered === 'object') {
    for (const [k, v] of Object.entries(raw.techDelivered) as Array<[CapytorioItemId, number]>) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        host.techDelivered[k] = Math.round(v);
      }
    }
  }
  host.rocketLaunches =
    typeof raw.rocketLaunches === 'number' && Number.isFinite(raw.rocketLaunches)
      ? Math.max(0, Math.round(raw.rocketLaunches))
      : 0;
  host.totalProduced =
    typeof raw.totalProduced === 'number' && Number.isFinite(raw.totalProduced)
      ? Math.max(0, Math.round(raw.totalProduced))
      : 0;
  host.score =
    typeof raw.score === 'number' && Number.isFinite(raw.score)
      ? Math.max(0, Math.round(raw.score))
      : 0;
  host.lastReportedScore = host.score;

  const sanitizeItemBuffer = (
    rawBuf: Partial<Record<CapytorioItemId, number>> | undefined
  ): Partial<Record<CapytorioItemId, number>> => {
    const out: Partial<Record<CapytorioItemId, number>> = {};
    if (!rawBuf || typeof rawBuf !== 'object') return out;
    for (const [k, v] of Object.entries(rawBuf) as Array<[CapytorioItemId, number]>) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = Math.round(v);
      }
    }
    return out;
  };

  if (Array.isArray(raw.machines)) {
    for (let i = 0; i < raw.machines.length; i++) {
      const sm = raw.machines[i];
      if (
        !sm ||
        typeof sm.gx !== 'number' ||
        !Number.isFinite(sm.gx) ||
        typeof sm.gz !== 'number' ||
        !Number.isFinite(sm.gz)
      ) {
        continue;
      }
      if (!CAPYTORIO_MACHINE_SPECS[sm.type]) continue;
      let cleanVariant: CapytorioItemId | undefined = undefined;
      let defaultTierMult = 1.0;
      if (typeof sm.variantItemId === 'string' && sm.variantItemId.length > 0) {
        const mapping = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[sm.variantItemId];
        if (mapping && mapping.baseType === sm.type) {
          cleanVariant = sm.variantItemId;
          defaultTierMult = mapping.tierMult;
        }
      }
      const cleanTierMult =
        typeof sm.tierMult === 'number' && Number.isFinite(sm.tierMult) && sm.tierMult > 0
          ? Math.min(20, sm.tierMult)
          : defaultTierMult;
      const cleanGx = Math.round(sm.gx);
      const cleanGz = Math.round(sm.gz);
      const cleanDir = ((typeof sm.dir === 'number' && Number.isFinite(sm.dir) ? Math.round(sm.dir) : 1) &
        3) as CapytorioDirection;
      const fp = getCapytorioFootprint(sm.type, cleanVariant, cleanDir);
      if (
        !host.canFootprintFit(
          cleanGx,
          cleanGz,
          fp.width,
          fp.height,
          undefined,
          cleanVariant === 'offshore_pump'
        )
      ) {
        continue;
      }
      const cleanRecipeId =
        sm.type === 'assembler' && typeof sm.recipeId === 'string' && RECIPE_BY_ID.has(sm.recipeId)
          ? sm.recipeId
          : undefined;
      const maxBeltCap =
        sm.type === 'splitter'
          ? CAPYTORIO_BELT_MAX_ITEMS_PER_TILE * 2
          : CAPYTORIO_BELT_MAX_ITEMS_PER_TILE;
      const functionalInserter = isCapytorioFunctionalInserter({
        type: sm.type,
        variantItemId: cleanVariant,
      });
      const storageChest = isCapytorioStorageChest({
        type: sm.type,
        variantItemId: cleanVariant,
      });
      const cleanBeltItems: CapytorioMachine['beltItems'] = [];
      if (Array.isArray(sm.beltItems)) {
        for (let bi = 0; bi < sm.beltItems.length && cleanBeltItems.length < maxBeltCap; bi++) {
          const b = sm.beltItems[bi];
          if (!b || typeof b.item !== 'string' || b.item.length === 0) continue;
          const prog =
            typeof b.progress === 'number' && Number.isFinite(b.progress)
              ? Math.max(0, Math.min(1, b.progress))
              : 0;
          cleanBeltItems.push({
            uid: host.allocateBeltItemUid(),
            item: b.item,
            progress: prog,
            lane: b.lane === 1 ? 1 : 0,
            squish: 0,
            edgeProgress:
              typeof b.edgeProgress === 'number' && Number.isFinite(b.edgeProgress)
                ? Math.max(0, Math.min(1, b.edgeProgress))
                : 0,
          });
        }
      }
      const machine: CapytorioMachine = {
        id: host.allocateMachineId(),
        type: sm.type,
        variantItemId: cleanVariant,
        tierMult: cleanTierMult,
        gx: cleanGx,
        gz: cleanGz,
        dir: cleanDir,
        recipeId: cleanRecipeId,
        craftProgress: 0,
        productivityProgress: 0,
        fuelTimer: 0,
        armSwing: 0,
        armExtend: 0,
        inserterPhase: functionalInserter ? 'idle_pickup' : undefined,
        holdingItem: null,
        splitterToggle: 0,
        splitterInputToggle: 0,
        splitterInputPriority:
          sm.splitterInputPriority === 'left' || sm.splitterInputPriority === 'right'
            ? sm.splitterInputPriority
            : sm.type === 'splitter'
              ? 'none'
              : undefined,
        splitterOutputPriority:
          sm.splitterOutputPriority === 'left' || sm.splitterOutputPriority === 'right'
            ? sm.splitterOutputPriority
            : sm.type === 'splitter'
              ? 'none'
              : undefined,
        splitterFilterItem: sm.type === 'splitter' ? (sm.splitterFilterItem ?? null) : undefined,
        inserterFilterMode:
          functionalInserter
            ? sm.inserterFilterMode === 'blacklist'
              ? 'blacklist'
              : 'whitelist'
            : undefined,
        inserterFilters:
          functionalInserter && Array.isArray(sm.inserterFilters)
            ? sm.inserterFilters.filter((f): f is string => typeof f === 'string' && f.length > 0).slice(0, 5)
            : functionalInserter
              ? []
              : undefined,
        inserterStackLimit:
          functionalInserter &&
          typeof sm.inserterStackLimit === 'number' &&
          Number.isFinite(sm.inserterStackLimit)
            ? Math.max(1, Math.min(12, Math.round(sm.inserterStackLimit)))
            : functionalInserter
              ? null
              : undefined,
        chestSlotLimit:
          storageChest &&
          typeof sm.chestSlotLimit === 'number' &&
          Number.isFinite(sm.chestSlotLimit)
            ? Math.max(1, Math.min(CAPYTORIO_CHEST_SLOTS, Math.round(sm.chestSlotLimit)))
            : storageChest
              ? null
              : undefined,
        modules: undefined,
        integrity:
          typeof sm.integrity === 'number' && Number.isFinite(sm.integrity)
            ? Math.max(10, Math.min(100, Math.round(sm.integrity)))
            : undefined,
        inputBuffer: sanitizeItemBuffer(sm.inputBuffer),
        outputBuffer: sanitizeItemBuffer(sm.outputBuffer),
        beltItems: cleanBeltItems,
      };
      const slotLimit = host.getMachineModuleSlotLimit(machine);
      if (slotLimit > 0 && Array.isArray(sm.modules)) {
        const cleanMods: CapytorioItemId[] = [];
        for (let mi = 0; mi < sm.modules.length && cleanMods.length < slotLimit; mi++) {
          const modId = sm.modules[mi];
          if (typeof modId === 'string' && isCapytorioModuleItem(modId)) {
            cleanMods.push(modId);
          }
        }
        if (cleanMods.length > 0) {
          machine.modules = cleanMods;
        }
      }
      host.machines.set(tileKey(machine.gx, machine.gz), machine);
      host.registerMachineOccupancy(machine);
    }
  }

  if (Array.isArray(raw.spilledItems)) {
    for (
      let i = 0;
      i < raw.spilledItems.length && host.spilledItems.length < MAX_CAPYTORIO_SPILLED_ITEMS;
      i++
    ) {
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
      const cleanY =
        typeof sp.y === 'number' && Number.isFinite(sp.y) ? Math.max(0, Math.min(8, sp.y)) : 0;
      const cleanRy = typeof sp.ry === 'number' && Number.isFinite(sp.ry) ? sp.ry : 0;
      host.spilledItems.push({
        uid: host.allocateSpilledItemUid(),
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

  host.blueprintLibrary = [];
  host.activeBlueprintId = null;
  if (Array.isArray(raw.blueprintLibrary)) {
    for (
      let i = 0;
      i < raw.blueprintLibrary.length &&
      host.blueprintLibrary.length < MAX_CAPYTORIO_BLUEPRINT_LIBRARY;
      i++
    ) {
      const bp = raw.blueprintLibrary[i];
      if (!bp || !Array.isArray(bp.entries) || bp.entries.length === 0) continue;
      const cleanEntries: CapytorioBlueprintEntry[] = [];
      for (let j = 0; j < bp.entries.length && cleanEntries.length < 256; j++) {
        const e = bp.entries[j];
        if (
          !e ||
          typeof e.dx !== 'number' ||
          !Number.isFinite(e.dx) ||
          typeof e.dz !== 'number' ||
          !Number.isFinite(e.dz) ||
          typeof e.toolId !== 'string' ||
          !CAPYTORIO_MACHINE_SPECS[e.baseType]
        ) {
          continue;
        }
        cleanEntries.push({
          dx: Math.round(e.dx),
          dz: Math.round(e.dz),
          toolId: e.toolId,
          baseType: e.baseType,
          dir: ((e.dir ?? 1) & 3) as CapytorioDirection,
          recipeId:
            typeof e.recipeId === 'string' && RECIPE_BY_ID.has(e.recipeId)
              ? e.recipeId
              : undefined,
          splitterInputPriority: e.splitterInputPriority,
          splitterOutputPriority: e.splitterOutputPriority,
          splitterFilterItem: e.splitterFilterItem,
          inserterFilterMode: e.inserterFilterMode,
          inserterFilters: Array.isArray(e.inserterFilters)
            ? e.inserterFilters.slice(0, 5)
            : undefined,
          inserterStackLimit: e.inserterStackLimit,
          chestSlotLimit: e.chestSlotLimit,
        });
      }
      if (cleanEntries.length === 0) continue;
      const bounds = computeBlueprintBounds(cleanEntries);
      host.blueprintLibrary.push({
        id:
          typeof bp.id === 'string' && bp.id.trim().length > 0
            ? bp.id.trim().slice(0, 64)
            : `bp_h_${host.allocateBlueprintUid()}`,
        label:
          typeof bp.label === 'string' && bp.label.trim().length > 0
            ? bp.label.trim().slice(0, 80)
            : buildBlueprintLabel(cleanEntries),
        sourceMode:
          bp.sourceMode === 'cut'
            ? 'cut'
            : bp.sourceMode === 'import'
              ? 'import'
              : 'copy',
        createdAt:
          typeof bp.createdAt === 'number' && Number.isFinite(bp.createdAt)
            ? bp.createdAt
            : Date.now(),
        width: bounds.width,
        height: bounds.height,
        entries: cleanEntries,
      });
    }
  }

  host.markHydratedAndRecomputePower();
}

export function sanitizeCapytorioSerializedState(
  raw: unknown,
  createEngine: (state: CapytorioSerializedState) => { serialize(): CapytorioSerializedState }
): CapytorioSerializedState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as CapytorioSerializedState;
  if (candidate.version !== 1) return undefined;
  const eng = createEngine(candidate);
  return eng.serialize();
}
