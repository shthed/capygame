import {
  CAPYTORIO_MACHINE_SPECS,
  RECIPE_BY_ID,
  type CapytorioDirection,
  type CapytorioItemId,
  type CapytorioMachineType,
  type CapytorioRecipeId,
} from '../CapytorioData';
import {
  decodeFactorioBlueprintString,
  encodeFactorioBlueprintBookString,
  encodeFactorioBlueprintString,
  type FactorioBlueprintImportResult,
} from '../FactorioBlueprintCodec';
import {
  MAX_CAPYTORIO_BLUEPRINT_LIBRARY,
  getCapytorioToolFootprint,
  resolveCapytorioPlaceableSpec,
  tileKey,
  type CapytorioBlueprintClipboard,
  type CapytorioBlueprintEntry,
  type CapytorioBlueprintPlacementCheck,
  type CapytorioClipboardToolState,
  type CapytorioMachine,
  type CapytorioMachineUndoSnapshot,
  type CapytorioResourceTile,
  type CapytorioSavedBlueprint,
} from '../CapytorioFactoryEngine';

export interface CapytorioBlueprintHost {
  machines: Map<string, CapytorioMachine>;
  pocketItems: Partial<Record<CapytorioItemId, number>>;
  pocketMachines: Partial<Record<CapytorioMachineType, number>>;
  clipboardToolState: CapytorioClipboardToolState;
  clipboard: CapytorioBlueprintClipboard | null;
  pasteAnchor: { gx: number; gz: number } | null;
  blueprintLibrary: CapytorioSavedBlueprint[];
  readonly presetBlueprints: CapytorioSavedBlueprint[];
  activeBlueprintId: string | null;
  previewSelectedKeys: Set<string>;
  undoCutSnapshot: CapytorioMachineUndoSnapshot[];
  allocateBlueprintUid(): number;
  getMachineFootprint(m: CapytorioMachine): { width: number; height: number };
  getMachineAt(gx: number, gz: number): CapytorioMachine | undefined;
  canFootprintFit(
    gx: number,
    gz: number,
    width: number,
    height: number,
    ignoreMachine?: CapytorioMachine,
    allowWater?: boolean
  ): boolean;
  findFirstOreInFootprint(
    gx: number,
    gz: number,
    width: number,
    height: number
  ): CapytorioResourceTile | null;
  selectBlueprintFromLibrary(id: string): CapytorioSavedBlueprint | null;
  beginHistoryBatch(label: string): void;
  commitHistoryBatch(overrideLabel?: string): void;
  placeMachine(
    toolOrType: string,
    gx: number,
    gz: number,
    dir?: CapytorioDirection,
    recipeId?: CapytorioRecipeId
  ): { ok: boolean; reason?: string; machine?: CapytorioMachine };
  setAssemblerRecipeAt(gx: number, gz: number, recipeId: CapytorioRecipeId): boolean;
  applyConfigSnapshotToMachine(
    m: CapytorioMachine,
    src: Pick<
      CapytorioBlueprintEntry,
      | 'splitterInputPriority'
      | 'splitterOutputPriority'
      | 'splitterFilterItem'
      | 'inserterFilterMode'
      | 'inserterFilters'
      | 'inserterStackLimit'
      | 'chestSlotLimit'
    >
  ): void;
}

export function buildBlueprintLabel(entries: ReadonlyArray<CapytorioBlueprintEntry>): string {
  if (entries.length === 0) return 'Empty Blueprint';
  const counts = new Map<string, number>();
  let firstRecipeName: string | null = null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const spec = resolveCapytorioPlaceableSpec(e.toolId);
    const name = spec?.shortName ?? CAPYTORIO_MACHINE_SPECS[e.baseType]?.shortName ?? e.baseType;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!firstRecipeName && e.baseType === 'assembler' && e.recipeId) {
      const rec = RECIPE_BY_ID.get(e.recipeId);
      if (rec) firstRecipeName = rec.name;
    }
  }
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 1) {
    const [name, qty] = ranked[0];
    if (firstRecipeName && entries.length <= 2) {
      return `${name} · ${firstRecipeName}`;
    }
    return qty === 1 ? name : `${name} ×${qty}`;
  }
  const topTwo = ranked
    .slice(0, 2)
    .map(([name, qty]) => (qty > 1 ? `${name} ×${qty}` : name))
    .join(' + ');
  return ranked.length > 2 ? `${topTwo} +${ranked.length - 2}` : topTwo;
}

export function computeBlueprintBounds(entries: ReadonlyArray<CapytorioBlueprintEntry>): {
  width: number;
  height: number;
} {
  if (entries.length === 0) return { width: 0, height: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const fp = getCapytorioToolFootprint(e.toolId, e.dir);
    if (e.dx < minX) minX = e.dx;
    if (e.dx + fp.width - 1 > maxX) maxX = e.dx + fp.width - 1;
    if (e.dz < minZ) minZ = e.dz;
    if (e.dz + fp.height - 1 > maxZ) maxZ = e.dz + fp.height - 1;
  }
  return {
    width: maxX - minX + 1,
    height: maxZ - minZ + 1,
  };
}

export function recordBlueprintToLibrary(
  host: CapytorioBlueprintHost,
  entries: ReadonlyArray<CapytorioBlueprintEntry>,
  sourceMode: 'copy' | 'cut'
): CapytorioSavedBlueprint {
  const clonedEntries = entries.map((e) => ({
    ...e,
    inserterFilters: e.inserterFilters ? [...e.inserterFilters] : undefined,
  }));
  const bounds = computeBlueprintBounds(clonedEntries);
  const saved: CapytorioSavedBlueprint = {
    id: `bp_${Date.now().toString(36)}_${host.allocateBlueprintUid()}`,
    label: buildBlueprintLabel(clonedEntries),
    sourceMode,
    createdAt: Date.now(),
    width: bounds.width,
    height: bounds.height,
    entries: clonedEntries,
  };
  host.blueprintLibrary.unshift(saved);
  if (host.blueprintLibrary.length > MAX_CAPYTORIO_BLUEPRINT_LIBRARY) {
    host.blueprintLibrary.length = MAX_CAPYTORIO_BLUEPRINT_LIBRARY;
  }
  host.activeBlueprintId = saved.id;
  return saved;
}

export function selectBlueprintFromLibrary(
  host: CapytorioBlueprintHost,
  id: string
): CapytorioSavedBlueprint | null {
  const found =
    host.blueprintLibrary.find((bp) => bp.id === id) ??
    host.presetBlueprints.find((bp) => bp.id === id) ??
    null;
  if (!found || found.entries.length === 0) return null;
  host.clipboard = {
    mode: 'copy',
    entries: found.entries.map((e) => ({
      ...e,
      inserterFilters: e.inserterFilters ? [...e.inserterFilters] : undefined,
    })),
    canUndoCut: false,
    blueprintId: found.id,
    label: found.label,
  };
  host.activeBlueprintId = found.id;
  host.clipboardToolState = 'paste';
  host.pasteAnchor = null;
  host.previewSelectedKeys.clear();
  host.undoCutSnapshot.length = 0;
  return found;
}

export function deleteBlueprintFromLibrary(host: CapytorioBlueprintHost, id: string): boolean {
  const idx = host.blueprintLibrary.findIndex((bp) => bp.id === id);
  if (idx < 0) return false;
  host.blueprintLibrary.splice(idx, 1);
  if (host.activeBlueprintId === id) {
    host.activeBlueprintId = null;
  }
  if (host.clipboard?.blueprintId === id) {
    host.clipboard.blueprintId = null;
  }
  return true;
}

export function rotateBlueprintEntries90(
  entries: CapytorioBlueprintEntry[],
  ccw: boolean = false
): boolean {
  if (entries.length === 0) return false;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const oldFp = getCapytorioToolFootprint(e.toolId, e.dir);
    const cx = e.dx + (oldFp.width - 1) * 0.5;
    const cz = e.dz + (oldFp.height - 1) * 0.5;
    let ncx: number;
    let ncz: number;
    if (ccw) {
      // 90 deg CCW in Capytorio (+X East, +Z South): (cx, cz) -> (cz, -cx)
      ncx = cz;
      ncz = -cx;
      e.dir = ((e.dir + 3) & 3) as CapytorioDirection;
    } else {
      // 90 deg CW in Capytorio (+X East, +Z South): (cx, cz) -> (-cz, cx)
      ncx = -cz;
      ncz = cx;
      e.dir = ((e.dir + 1) & 3) as CapytorioDirection;
    }
    const newFp = getCapytorioToolFootprint(e.toolId, e.dir);
    e.dx = Math.round(ncx - (newFp.width - 1) * 0.5);
    e.dz = Math.round(ncz - (newFp.height - 1) * 0.5);
  }
  return true;
}

export function flipBlueprintEntriesHorizontal(entries: CapytorioBlueprintEntry[]): boolean {
  if (entries.length === 0) return false;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const fp = getCapytorioToolFootprint(e.toolId, e.dir);
    const cx = e.dx + (fp.width - 1) * 0.5;
    e.dx = Math.round(-cx - (fp.width - 1) * 0.5);
    if (e.dir === 1) e.dir = 3;
    else if (e.dir === 3) e.dir = 1;
    if (e.baseType === 'splitter') {
      if (e.splitterInputPriority === 'left') e.splitterInputPriority = 'right';
      else if (e.splitterInputPriority === 'right') e.splitterInputPriority = 'left';
      if (e.splitterOutputPriority === 'left') e.splitterOutputPriority = 'right';
      else if (e.splitterOutputPriority === 'right') e.splitterOutputPriority = 'left';
    }
  }
  return true;
}

export function flipBlueprintEntriesVertical(entries: CapytorioBlueprintEntry[]): boolean {
  if (entries.length === 0) return false;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const fp = getCapytorioToolFootprint(e.toolId, e.dir);
    const cz = e.dz + (fp.height - 1) * 0.5;
    e.dz = Math.round(-cz - (fp.height - 1) * 0.5);
    if (e.dir === 0) e.dir = 2;
    else if (e.dir === 2) e.dir = 0;
    if (e.baseType === 'splitter') {
      if (e.splitterInputPriority === 'left') e.splitterInputPriority = 'right';
      else if (e.splitterInputPriority === 'right') e.splitterInputPriority = 'left';
      if (e.splitterOutputPriority === 'left') e.splitterOutputPriority = 'right';
      else if (e.splitterOutputPriority === 'right') e.splitterOutputPriority = 'left';
    }
  }
  return true;
}

export function selectMachinesInBox(
  host: CapytorioBlueprintHost,
  gxA: number,
  gzA: number,
  gxB: number,
  gzB: number
): CapytorioMachine[] {
  const minX = Math.min(gxA, gxB);
  const maxX = Math.max(gxA, gxB);
  const minZ = Math.min(gzA, gzB);
  const maxZ = Math.max(gzA, gzB);
  const out: CapytorioMachine[] = [];
  for (const m of host.machines.values()) {
    const fp = host.getMachineFootprint(m);
    const mMaxX = m.gx + fp.width - 1;
    const mMaxZ = m.gz + fp.height - 1;
    if (mMaxX >= minX && m.gx <= maxX && mMaxZ >= minZ && m.gz <= maxZ) {
      out.push(m);
    }
  }
  return out;
}

export function selectMachinesInPolygon(
  host: CapytorioBlueprintHost,
  points: ReadonlyArray<{ gx: number; gz: number }>
): CapytorioMachine[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) {
    const m = host.getMachineAt(Math.round(points[0].gx), Math.round(points[0].gz));
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
  const pad = 1.15;
  const brushDistSq = 0.68 * 0.68;
  const out: CapytorioMachine[] = [];

  for (const m of host.machines.values()) {
    const fp = host.getMachineFootprint(m);
    const px = m.gx + (fp.width - 1) * 0.5;
    const pz = m.gz + (fp.height - 1) * 0.5;
    if (px < minX - pad || px > maxX + pad || pz < minZ - pad || pz > maxZ + pad) continue;

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

export function evaluateBlueprintPlacementAt(
  host: CapytorioBlueprintHost,
  originGx: number,
  originGz: number
): CapytorioBlueprintPlacementCheck[] {
  if (!host.clipboard || host.clipboard.entries.length === 0) return [];
  const remainingStock = new Map<string, number>();
  const plannedTiles = new Set<string>();
  const results: CapytorioBlueprintPlacementCheck[] = [];

  for (let i = 0; i < host.clipboard.entries.length; i++) {
    const entry = host.clipboard.entries[i];
    const gx = originGx + entry.dx;
    const gz = originGz + entry.dz;
    const fp = getCapytorioToolFootprint(entry.toolId, entry.dir);
    const key = tileKey(gx, gz);
    const existingAnchor = host.machines.get(key);
    if (existingAnchor) {
      if (existingAnchor.type === 'assembler' && entry.baseType === 'assembler' && entry.recipeId) {
        results.push({ entry, gx, gz, valid: true });
      } else {
        results.push({ entry, gx, gz, valid: false, reason: 'occupied' });
      }
      continue;
    }

    let blocked = !host.canFootprintFit(
      gx,
      gz,
      fp.width,
      fp.height,
      undefined,
      entry.toolId === 'offshore_pump'
    );
    if (!blocked) {
      for (let dx = 0; dx < fp.width && !blocked; dx++) {
        for (let dz = 0; dz < fp.height; dz++) {
          if (plannedTiles.has(tileKey(gx + dx, gz + dz))) {
            blocked = true;
            break;
          }
        }
      }
    }
    if (blocked) {
      results.push({ entry, gx, gz, valid: false, reason: 'occupied' });
      continue;
    }
    if (
      entry.baseType === 'drill' &&
      entry.toolId !== 'offshore_pump' &&
      !host.findFirstOreInFootprint(gx, gz, fp.width, fp.height)
    ) {
      results.push({ entry, gx, gz, valid: false, reason: 'needs_ore' });
      continue;
    }
    const resolved = resolveCapytorioPlaceableSpec(entry.toolId);
    if (!resolved) {
      results.push({ entry, gx, gz, valid: false, reason: 'no_stock' });
      continue;
    }
    const stockKey = resolved.isBaseMachine
      ? `m:${resolved.baseType}`
      : `i:${resolved.id}`;
    let avail = remainingStock.get(stockKey);
    if (avail === undefined) {
      avail = resolved.isBaseMachine
        ? host.pocketMachines[resolved.baseType] ?? 0
        : host.pocketItems[resolved.id] ?? 0;
    }
    if (avail <= 0) {
      results.push({ entry, gx, gz, valid: false, reason: 'no_stock' });
      continue;
    }
    remainingStock.set(stockKey, avail - 1);
    for (let dx = 0; dx < fp.width; dx++) {
      for (let dz = 0; dz < fp.height; dz++) {
        plannedTiles.add(tileKey(gx + dx, gz + dz));
      }
    }
    results.push({ entry, gx, gz, valid: true });
  }
  return results;
}

export function pasteBlueprintAt(
  host: CapytorioBlueprintHost,
  originGx: number,
  originGz: number
): { placedCount: number; skippedCount: number; updatedRecipesCount: number } {
  if (!host.clipboard || host.clipboard.entries.length === 0) {
    return { placedCount: 0, skippedCount: 0, updatedRecipesCount: 0 };
  }
  const entries = host.clipboard.entries;
  const wasCut = host.clipboard.mode === 'cut';
  let placedCount = 0;
  let skippedCount = 0;
  let updatedRecipesCount = 0;
  const remainingEntries: CapytorioBlueprintEntry[] = [];
  const remainingCutSnapshots: CapytorioMachineUndoSnapshot[] = [];

  host.beginHistoryBatch('Paste blueprint');
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const gx = originGx + entry.dx;
    const gz = originGz + entry.dz;
    const key = tileKey(gx, gz);
    const existing = host.machines.get(key);
    if (existing) {
      if (
        existing.type === 'assembler' &&
        entry.baseType === 'assembler' &&
        entry.recipeId &&
        existing.recipeId !== entry.recipeId
      ) {
        if (host.setAssemblerRecipeAt(gx, gz, entry.recipeId)) {
          updatedRecipesCount++;
        } else {
          skippedCount++;
          if (wasCut) {
            remainingEntries.push(entry);
            if (host.undoCutSnapshot[i]) {
              remainingCutSnapshots.push(host.undoCutSnapshot[i]);
            }
          }
        }
      } else {
        skippedCount++;
        if (wasCut) {
          remainingEntries.push(entry);
          if (host.undoCutSnapshot[i]) {
            remainingCutSnapshots.push(host.undoCutSnapshot[i]);
          }
        }
      }
      continue;
    }

    const placed = host.placeMachine(entry.toolId, gx, gz, entry.dir, entry.recipeId);
    if (placed.ok && placed.machine) {
      placedCount++;
      if (entry.baseType === 'assembler' && entry.recipeId) {
        host.setAssemblerRecipeAt(gx, gz, entry.recipeId);
      } else if (
        entry.baseType === 'splitter' ||
        entry.baseType === 'inserter' ||
        entry.baseType === 'chest'
      ) {
        host.applyConfigSnapshotToMachine(placed.machine, entry);
      }
    } else {
      skippedCount++;
      if (wasCut) {
        remainingEntries.push(entry);
        if (host.undoCutSnapshot[i]) {
          remainingCutSnapshots.push(host.undoCutSnapshot[i]);
        }
      }
    }
  }
  const totalApplied = placedCount + updatedRecipesCount;
  host.commitHistoryBatch(`Paste ${totalApplied} building${totalApplied === 1 ? '' : 's'}`);

  if (totalApplied > 0) {
    host.pasteAnchor = null;
  }

  if (wasCut) {
    if (skippedCount === 0 && (placedCount > 0 || updatedRecipesCount > 0)) {
      host.clipboard = null;
      host.clipboardToolState = 'off';
      host.pasteAnchor = null;
      host.undoCutSnapshot.length = 0;
    } else if (totalApplied > 0 && remainingEntries.length > 0) {
      host.clipboard = {
        ...host.clipboard,
        entries: remainingEntries,
        canUndoCut: remainingCutSnapshots.length > 0,
      };
      host.undoCutSnapshot = remainingCutSnapshots;
      host.clipboardToolState = 'paste';
    }
  }

  return { placedCount, skippedCount, updatedRecipesCount };
}

export async function importFactorioBlueprintStringIntoHost(
  host: CapytorioBlueprintHost,
  rawInput: string
): Promise<FactorioBlueprintImportResult & { addedIds: string[] }> {
  const decoded = await decodeFactorioBlueprintString(rawInput);
  if (!decoded.ok || decoded.blueprints.length === 0) {
    return { ...decoded, addedIds: [] };
  }

  const now = Date.now();
  const added: CapytorioSavedBlueprint[] = [];
  for (let i = 0; i < decoded.blueprints.length; i++) {
    const bp = decoded.blueprints[i];
    const saved: CapytorioSavedBlueprint = {
      id: `bp_imp_${now.toString(36)}_${host.allocateBlueprintUid()}`,
      label: bp.label,
      sourceMode: 'import',
      createdAt: now + i,
      width: bp.width,
      height: bp.height,
      entries: bp.entries.map((e) => ({
        ...e,
        inserterFilters: e.inserterFilters ? [...e.inserterFilters] : undefined,
      })),
    };
    added.push(saved);
  }

  // Prepend imported blueprints in book order so index 0 appears first in library
  host.blueprintLibrary.unshift(...added);
  if (host.blueprintLibrary.length > MAX_CAPYTORIO_BLUEPRINT_LIBRARY) {
    host.blueprintLibrary.length = MAX_CAPYTORIO_BLUEPRINT_LIBRARY;
  }

  const firstId = added[0]?.id;
  if (firstId) {
    host.selectBlueprintFromLibrary(firstId);
  }

  return {
    ...decoded,
    addedIds: added.map((b) => b.id),
  };
}

export async function exportBlueprintToFactorioStringFromHost(
  host: CapytorioBlueprintHost,
  id: string
): Promise<{
  ok: boolean;
  label: string;
  encoded: string;
  entityCount: number;
  error?: string;
}> {
  const bp =
    host.blueprintLibrary.find((b) => b.id === id) ??
    host.presetBlueprints.find((b) => b.id === id) ??
    null;
  if (!bp || bp.entries.length === 0) {
    return {
      ok: false,
      label: '',
      encoded: '',
      entityCount: 0,
      error: 'Blueprint not found or empty.',
    };
  }
  const encoded = await encodeFactorioBlueprintString({
    label: bp.label,
    entries: bp.entries,
  });
  return {
    ok: true,
    label: bp.label,
    encoded,
    entityCount: bp.entries.length,
  };
}

export async function exportFactoryToFactorioStringFromHost(
  host: CapytorioBlueprintHost,
  label: string = 'Capytorio Factory'
): Promise<{
  ok: boolean;
  label: string;
  encoded: string;
  entityCount: number;
  error?: string;
}> {
  const allMachines = Array.from(host.machines.values());
  if (allMachines.length === 0) {
    return {
      ok: false,
      label,
      encoded: '',
      entityCount: 0,
      error: 'No buildings placed on the factory floor yet.',
    };
  }

  let minGx = allMachines[0].gx;
  let minGz = allMachines[0].gz;
  for (let i = 1; i < allMachines.length; i++) {
    if (allMachines[i].gx < minGx) minGx = allMachines[i].gx;
    if (allMachines[i].gz < minGz) minGz = allMachines[i].gz;
  }

  const entries: CapytorioBlueprintEntry[] = allMachines.map((m) => ({
    dx: m.gx - minGx,
    dz: m.gz - minGz,
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
  }));

  const encoded = await encodeFactorioBlueprintString({ label, entries });
  return {
    ok: true,
    label,
    encoded,
    entityCount: entries.length,
  };
}

export async function exportBlueprintLibraryAsFactorioBookStringFromHost(
  host: CapytorioBlueprintHost,
  bookLabel: string = 'Capytorio Blueprint Book'
): Promise<{
  ok: boolean;
  label: string;
  encoded: string;
  blueprintCount: number;
  entityCount: number;
  error?: string;
}> {
  const source =
    host.blueprintLibrary.length > 0 ? host.blueprintLibrary : host.presetBlueprints;
  if (source.length === 0) {
    return {
      ok: false,
      label: bookLabel,
      encoded: '',
      blueprintCount: 0,
      entityCount: 0,
      error: 'No blueprints available to export.',
    };
  }
  const encoded = await encodeFactorioBlueprintBookString(source, bookLabel);
  const entityCount = source.reduce((acc, bp) => acc + bp.entries.length, 0);
  return {
    ok: true,
    label: bookLabel,
    encoded,
    blueprintCount: source.length,
    entityCount,
  };
}
