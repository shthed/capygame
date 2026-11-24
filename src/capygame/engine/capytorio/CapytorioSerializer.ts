import {
  CAPYTORIO_CHEST_SLOTS,
  CAPYTORIO_HOTBAR_ORDER,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_TECHS,
  RECIPE_BY_ID,
  TECH_BY_ID,
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
  host.activeTechId =
    raw.activeTechId && TECH_BY_ID.has(raw.activeTechId)
      ? raw.activeTechId
      : (CAPYTORIO_TECHS[0]?.id ?? null);
  host.techDelivered = raw.techDelivered ? { ...raw.techDelivered } : {};
  host.rocketLaunches = Math.max(0, Math.round(raw.rocketLaunches || 0));
  host.totalProduced = Math.max(0, Math.round(raw.totalProduced || 0));
  host.score = Math.max(0, Math.round(raw.score || 0));
  host.lastReportedScore = host.score;

  if (Array.isArray(raw.machines)) {
    for (let i = 0; i < raw.machines.length; i++) {
      const sm = raw.machines[i];
      if (!sm || typeof sm.gx !== 'number' || typeof sm.gz !== 'number') continue;
      if (!CAPYTORIO_MACHINE_SPECS[sm.type]) continue;
      const maxBeltCap =
        sm.type === 'splitter'
          ? CAPYTORIO_BELT_MAX_ITEMS_PER_TILE * 2
          : CAPYTORIO_BELT_MAX_ITEMS_PER_TILE;
      const machine: CapytorioMachine = {
        id: host.allocateMachineId(),
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
          sm.inserterFilterMode === 'blacklist'
            ? 'blacklist'
            : sm.type === 'inserter'
              ? 'whitelist'
              : undefined,
        inserterFilters:
          sm.type === 'inserter' && Array.isArray(sm.inserterFilters)
            ? sm.inserterFilters.slice(0, 5)
            : sm.type === 'inserter'
              ? []
              : undefined,
        inserterStackLimit:
          sm.type === 'inserter' &&
          typeof sm.inserterStackLimit === 'number' &&
          Number.isFinite(sm.inserterStackLimit)
            ? Math.max(1, Math.min(12, Math.round(sm.inserterStackLimit)))
            : sm.type === 'inserter'
              ? null
              : undefined,
        chestSlotLimit:
          sm.type === 'chest' &&
          typeof sm.chestSlotLimit === 'number' &&
          Number.isFinite(sm.chestSlotLimit)
            ? Math.max(1, Math.min(CAPYTORIO_CHEST_SLOTS, Math.round(sm.chestSlotLimit)))
            : sm.type === 'chest'
              ? null
              : undefined,
        modules: Array.isArray(sm.modules) ? sm.modules.slice(0, 4) : undefined,
        integrity:
          typeof sm.integrity === 'number' && Number.isFinite(sm.integrity)
            ? Math.max(10, Math.min(100, Math.round(sm.integrity)))
            : undefined,
        inputBuffer: sm.inputBuffer ? { ...sm.inputBuffer } : {},
        outputBuffer: sm.outputBuffer ? { ...sm.outputBuffer } : {},
        beltItems: Array.isArray(sm.beltItems)
          ? sm.beltItems.slice(0, maxBeltCap).map((b) => ({
              uid: host.allocateBeltItemUid(),
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
