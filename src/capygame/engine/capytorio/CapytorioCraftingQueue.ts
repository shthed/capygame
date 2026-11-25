import {
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  CAPYTORIO_RECIPES,
  RECIPE_BY_ID,
  type CapytorioItemId,
  type CapytorioMachineType,
  type CapytorioRecipeSpec,
  type CapytorioRecipeId,
} from '../CapytorioData';
import type {
  CapytorioCraftQueueItem,
  CapytorioStepCallbacks,
} from '../CapytorioFactoryEngine';

export interface PlannedCraftStep {
  recipeId: CapytorioRecipeId;
  resultId: CapytorioItemId;
  resultName: string;
  resultCountPerBatch: number;
  batches: number;
  craftTimeSec: number;
  directConsumed: Array<{ item: CapytorioItemId; count: number }>;
  surplusToPocket: number;
}

export interface CapytorioCraftingQueueHost {
  pocketItems: Partial<Record<CapytorioItemId, number>>;
  pocketMachines: Partial<Record<CapytorioMachineType, number>>;
  craftingQueue: CapytorioCraftQueueItem[];
  totalProduced: number;
  score: number;
  allocateCraftQueueUid(): number;
  isRecipeUnlocked(recipeId: CapytorioRecipeId): boolean;
  addPocketItem(item: CapytorioItemId, count: number): void;
  consumePocketItem(item: CapytorioItemId, count: number): boolean;
  recordRecentTool(toolId: string): void;
  getCraftSpeedMultiplier(): number;
}

export function findPocketRecipeForItem(
  itemId: CapytorioItemId,
  isRecipeUnlocked: (recipeId: CapytorioRecipeId) => boolean
): CapytorioRecipeSpec | null {
  const direct = RECIPE_BY_ID.get(itemId);
  if (direct && direct.pocketCraftable && direct.result === itemId && isRecipeUnlocked(direct.id)) {
    return direct;
  }
  for (let i = 0; i < CAPYTORIO_RECIPES.length; i++) {
    const r = CAPYTORIO_RECIPES[i];
    if (r.result === itemId && r.pocketCraftable && isRecipeUnlocked(r.id)) {
      return r;
    }
  }
  return null;
}

function subtractFromSurplusSources(
  item: CapytorioItemId,
  amount: number,
  stepsOut: PlannedCraftStep[]
): void {
  let rem = amount;
  for (let i = stepsOut.length - 1; i >= 0 && rem > 0; i--) {
    const st = stepsOut[i];
    if (st.resultId === item && st.surplusToPocket > 0) {
      const take = Math.min(st.surplusToPocket, rem);
      st.surplusToPocket -= take;
      rem -= take;
    }
  }
}

export function planRecursiveIngredients(
  ingredients: ReadonlyArray<{ item: CapytorioItemId; count: number }>,
  simStock: Map<CapytorioItemId, number>,
  visiting: Set<CapytorioItemId>,
  stepsOut: PlannedCraftStep[],
  isRecipeUnlocked: (recipeId: CapytorioRecipeId) => boolean,
  surplusStock?: Map<CapytorioItemId, number>
): { ok: boolean; directConsumed: Array<{ item: CapytorioItemId; count: number }> } {
  const directConsumedMap = new Map<CapytorioItemId, number>();
  const localSurplus = surplusStock ?? new Map<CapytorioItemId, number>();

  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    let needed = ing.count;

    // Consume any already-planned intermediate surplus first (never deducted from pocket!)
    const availSurplus = localSurplus.get(ing.item) ?? 0;
    const takeSurplus = Math.min(availSurplus, needed);
    if (takeSurplus > 0) {
      localSurplus.set(ing.item, availSurplus - takeSurplus);
      subtractFromSurplusSources(ing.item, takeSurplus, stepsOut);
      needed -= takeSurplus;
    }

    // Consume from existing pocket stock next
    if (needed > 0) {
      const have = simStock.get(ing.item) ?? 0;
      const takeExisting = Math.min(have, needed);
      if (takeExisting > 0) {
        simStock.set(ing.item, have - takeExisting);
        directConsumedMap.set(ing.item, (directConsumedMap.get(ing.item) ?? 0) + takeExisting);
        needed -= takeExisting;
      }
    }

    // Recursively craft any remaining shortfall
    if (needed > 0) {
      if (visiting.has(ing.item)) return { ok: false, directConsumed: [] };
      const subRec = findPocketRecipeForItem(ing.item, isRecipeUnlocked);
      if (!subRec) return { ok: false, directConsumed: [] };
      visiting.add(ing.item);
      const subBatches = Math.ceil(needed / Math.max(1, subRec.resultCount));
      const scaledSubIngs = subRec.ingredients.map((si) => ({
        item: si.item,
        count: si.count * subBatches,
      }));
      const subPlan = planRecursiveIngredients(
        scaledSubIngs,
        simStock,
        visiting,
        stepsOut,
        isRecipeUnlocked,
        localSurplus
      );
      visiting.delete(ing.item);
      if (!subPlan.ok) return { ok: false, directConsumed: [] };
      const produced = subBatches * Math.max(1, subRec.resultCount);
      const surplus = Math.max(0, produced - needed);
      if (surplus > 0) {
        localSurplus.set(ing.item, (localSurplus.get(ing.item) ?? 0) + surplus);
      }
      stepsOut.push({
        recipeId: subRec.id,
        resultId: subRec.result,
        resultName: subRec.name,
        resultCountPerBatch: Math.max(1, subRec.resultCount),
        batches: subBatches,
        craftTimeSec: Math.max(0.25, subRec.craftTimeSec * 0.5),
        directConsumed: subPlan.directConsumed,
        surplusToPocket: surplus,
      });
    }
  }

  const directConsumed: Array<{ item: CapytorioItemId; count: number }> = [];
  for (const [item, count] of directConsumedMap.entries()) {
    if (count > 0) directConsumed.push({ item, count });
  }
  return { ok: true, directConsumed };
}

export function getMaxAffordableCraftBatches(
  host: CapytorioCraftingQueueHost,
  kind: 'recipe' | 'machine',
  id: string,
  cap: number = 25
): number {
  let ingredients: Array<{ item: CapytorioItemId; count: number }> = [];
  if (kind === 'recipe') {
    const rec = RECIPE_BY_ID.get(id as CapytorioRecipeId);
    if (!rec || !rec.pocketCraftable || !host.isRecipeUnlocked(rec.id)) return 0;
    ingredients = rec.ingredients;
  } else {
    const spec = CAPYTORIO_MACHINE_SPECS[id as CapytorioMachineType];
    if (!spec) return 0;
    ingredients = (Object.entries(spec.craftCost) as Array<[CapytorioItemId, number]>).map(
      ([item, count]) => ({ item, count })
    );
  }

  const simStock = new Map<CapytorioItemId, number>();
  for (const [k, v] of Object.entries(host.pocketItems) as Array<[CapytorioItemId, number]>) {
    if (v > 0) simStock.set(k, v);
  }
  const checkUnlocked = (rId: CapytorioRecipeId) => host.isRecipeUnlocked(rId);
  let count = 0;
  while (count < cap) {
    const snap = new Map(simStock);
    const surplusSnap = new Map<CapytorioItemId, number>();
    const steps: PlannedCraftStep[] = [];
    const res = planRecursiveIngredients(
      ingredients,
      snap,
      new Set(),
      steps,
      checkUnlocked,
      surplusSnap
    );
    if (!res.ok) break;
    // Any unconsumed surplus from batch N becomes available pocket stock for batch N+1
    for (const [sk, sv] of surplusSnap.entries()) {
      if (sv > 0) snap.set(sk, (snap.get(sk) ?? 0) + sv);
    }
    simStock.clear();
    for (const [k, v] of snap.entries()) simStock.set(k, v);
    count++;
  }
  return count;
}

function deductReservedEntries(
  reserved: Array<{ item: CapytorioItemId; count: number }>,
  item: CapytorioItemId,
  amount: number
): number {
  let rem = amount;
  for (let i = 0; i < reserved.length && rem > 0; i++) {
    const entry = reserved[i];
    if (entry.item === item && entry.count > 0) {
      const take = Math.min(entry.count, rem);
      entry.count -= take;
      rem -= take;
    }
  }
  return amount - rem;
}

function addHeldIntermediate(
  held: Partial<Record<CapytorioItemId, number>>,
  item: CapytorioItemId,
  amount: number
): void {
  if (amount <= 0) return;
  held[item] = (held[item] ?? 0) + amount;
}

function takeHeldIntermediate(
  held: Partial<Record<CapytorioItemId, number>> | undefined,
  item: CapytorioItemId,
  amount: number
): number {
  if (!held || amount <= 0) return 0;
  const have = held[item] ?? 0;
  const take = Math.min(have, amount);
  if (take > 0) {
    const next = have - take;
    if (next <= 0) delete held[item];
    else held[item] = next;
  }
  return take;
}

function getBatchIngredientsForQueueItem(
  q: CapytorioCraftQueueItem
): ReadonlyArray<{ item: CapytorioItemId; count: number }> {
  if (q.kind === 'machine' && q.machineType) {
    const spec = CAPYTORIO_MACHINE_SPECS[q.machineType];
    if (!spec) return [];
    const out: Array<{ item: CapytorioItemId; count: number }> = [];
    for (const [item, count] of Object.entries(spec.craftCost) as Array<[CapytorioItemId, number]>) {
      if (count > 0) out.push({ item, count });
    }
    return out;
  }
  const rec = q.recipeId ? RECIPE_BY_ID.get(q.recipeId) : undefined;
  return rec ? rec.ingredients : [];
}

export function enqueuePocketCraft(
  host: CapytorioCraftingQueueHost,
  recipeId: CapytorioRecipeId,
  batches: number = 1
): { ok: boolean; queuedBatches: number; queuedIntermediates: number } {
  const rec = RECIPE_BY_ID.get(recipeId);
  if (!rec || !rec.pocketCraftable || !host.isRecipeUnlocked(recipeId) || batches < 1) {
    return { ok: false, queuedBatches: 0, queuedIntermediates: 0 };
  }
  let queuedBatches = 0;
  let queuedIntermediates = 0;
  const maxLoop = Math.min(50, Math.floor(batches));
  const checkUnlocked = (rId: CapytorioRecipeId) => host.isRecipeUnlocked(rId);

  for (let b = 0; b < maxLoop; b++) {
    const simStock = new Map<CapytorioItemId, number>();
    for (const [k, v] of Object.entries(host.pocketItems) as Array<[CapytorioItemId, number]>) {
      if (v > 0) simStock.set(k, v);
    }
    const subSteps: PlannedCraftStep[] = [];
    const plan = planRecursiveIngredients(
      rec.ingredients,
      simStock,
      new Set([rec.result]),
      subSteps,
      checkUnlocked
    );
    if (!plan.ok) break;

    // Deduct all direct raw pocket materials upfront
    for (let s = 0; s < subSteps.length; s++) {
      const dc = subSteps[s].directConsumed;
      for (let k = 0; k < dc.length; k++) {
        host.consumePocketItem(dc[k].item, dc[k].count);
      }
    }
    for (let k = 0; k < plan.directConsumed.length; k++) {
      host.consumePocketItem(plan.directConsumed[k].item, plan.directConsumed[k].count);
    }

    const parentUid = host.allocateCraftQueueUid();
    for (let s = 0; s < subSteps.length; s++) {
      const st = subSteps[s];
      host.craftingQueue.push({
        uid: host.allocateCraftQueueUid(),
        kind: 'recipe',
        recipeId: st.recipeId,
        resultId: st.resultId,
        resultName: st.resultName,
        resultCountPerBatch: st.resultCountPerBatch,
        batchesTotal: st.batches,
        batchesRemaining: st.batches,
        craftTimeSec: st.craftTimeSec,
        progress: 0,
        isIntermediate: true,
        parentUid,
        reservedPerBatch: st.directConsumed.map((e) => ({ item: e.item, count: e.count })),
        surplusToPocket: st.surplusToPocket > 0 ? st.surplusToPocket : undefined,
      });
      queuedIntermediates += st.batches;
    }

    host.craftingQueue.push({
      uid: parentUid,
      kind: 'recipe',
      recipeId: rec.id,
      resultId: rec.result,
      resultName: rec.name,
      resultCountPerBatch: Math.max(1, rec.resultCount),
      batchesTotal: 1,
      batchesRemaining: 1,
      craftTimeSec: Math.max(0.25, rec.craftTimeSec * 0.5),
      progress: 0,
      isIntermediate: false,
      reservedPerBatch: plan.directConsumed.map((e) => ({ item: e.item, count: e.count })),
      heldIntermediates: {},
    });
    queuedBatches++;
  }

  return { ok: queuedBatches > 0, queuedBatches, queuedIntermediates };
}

export function enqueueMachineCraft(
  host: CapytorioCraftingQueueHost,
  type: CapytorioMachineType,
  count: number = 1
): { ok: boolean; queuedBatches: number; queuedIntermediates: number } {
  const spec = CAPYTORIO_MACHINE_SPECS[type];
  if (!spec || count < 1) {
    return { ok: false, queuedBatches: 0, queuedIntermediates: 0 };
  }
  const ingredients = (Object.entries(spec.craftCost) as Array<[CapytorioItemId, number]>).map(
    ([item, amt]) => ({ item, count: amt })
  );
  let queuedBatches = 0;
  let queuedIntermediates = 0;
  const maxLoop = Math.min(50, Math.floor(count));
  const checkUnlocked = (rId: CapytorioRecipeId) => host.isRecipeUnlocked(rId);

  for (let b = 0; b < maxLoop; b++) {
    const simStock = new Map<CapytorioItemId, number>();
    for (const [k, v] of Object.entries(host.pocketItems) as Array<[CapytorioItemId, number]>) {
      if (v > 0) simStock.set(k, v);
    }
    const subSteps: PlannedCraftStep[] = [];
    const plan = planRecursiveIngredients(ingredients, simStock, new Set(), subSteps, checkUnlocked);
    if (!plan.ok) break;

    for (let s = 0; s < subSteps.length; s++) {
      const dc = subSteps[s].directConsumed;
      for (let k = 0; k < dc.length; k++) {
        host.consumePocketItem(dc[k].item, dc[k].count);
      }
    }
    for (let k = 0; k < plan.directConsumed.length; k++) {
      host.consumePocketItem(plan.directConsumed[k].item, plan.directConsumed[k].count);
    }

    const parentUid = host.allocateCraftQueueUid();
    for (let s = 0; s < subSteps.length; s++) {
      const st = subSteps[s];
      host.craftingQueue.push({
        uid: host.allocateCraftQueueUid(),
        kind: 'recipe',
        recipeId: st.recipeId,
        resultId: st.resultId,
        resultName: st.resultName,
        resultCountPerBatch: st.resultCountPerBatch,
        batchesTotal: st.batches,
        batchesRemaining: st.batches,
        craftTimeSec: st.craftTimeSec,
        progress: 0,
        isIntermediate: true,
        parentUid,
        reservedPerBatch: st.directConsumed.map((e) => ({ item: e.item, count: e.count })),
        surplusToPocket: st.surplusToPocket > 0 ? st.surplusToPocket : undefined,
      });
      queuedIntermediates += st.batches;
    }

    host.craftingQueue.push({
      uid: parentUid,
      kind: 'machine',
      machineType: type,
      resultId: type,
      resultName: spec.name,
      resultCountPerBatch: 1,
      batchesTotal: 1,
      batchesRemaining: 1,
      craftTimeSec: 0.55,
      progress: 0,
      isIntermediate: false,
      reservedPerBatch: plan.directConsumed.map((e) => ({ item: e.item, count: e.count })),
      heldIntermediates: {},
    });
    queuedBatches++;
  }

  return { ok: queuedBatches > 0, queuedBatches, queuedIntermediates };
}

export function cancelCraftQueueItem(
  host: CapytorioCraftingQueueHost,
  uid: number
): { ok: boolean; cancelledCount: number } {
  const idx = host.craftingQueue.findIndex((q) => q.uid === uid);
  if (idx < 0) return { ok: false, cancelledCount: 0 };
  const target = host.craftingQueue[idx];
  const rootUid =
    target.isIntermediate && target.parentUid !== undefined ? target.parentUid : target.uid;

  let cancelledCount = 0;
  for (let i = host.craftingQueue.length - 1; i >= 0; i--) {
    const q = host.craftingQueue[i];
    if (q.uid === rootUid || q.parentUid === rootUid) {
      // Refund exact unconsumed raw materials still held by this queue item
      for (let r = 0; r < q.reservedPerBatch.length; r++) {
        const entry = q.reservedPerBatch[r];
        if (entry.count > 0) host.addPocketItem(entry.item, entry.count);
      }
      // Refund exact already-crafted intermediates held for this chain
      if (q.heldIntermediates) {
        for (const [item, count] of Object.entries(q.heldIntermediates) as Array<
          [CapytorioItemId, number]
        >) {
          if (count > 0) host.addPocketItem(item, count);
        }
      }
      host.craftingQueue.splice(i, 1);
      cancelledCount++;
    }
  }
  return { ok: cancelledCount > 0, cancelledCount };
}

export function stepCraftingQueue(
  host: CapytorioCraftingQueueHost,
  dt: number,
  callbacks?: CapytorioStepCallbacks
): void {
  if (host.craftingQueue.length === 0) return;
  const head = host.craftingQueue[0];
  const speed = Math.max(0.5, host.getCraftSpeedMultiplier());
  head.progress += (dt * speed) / Math.max(0.15, head.craftTimeSec);
  if (head.progress < 1.0) return;

  head.progress -= 1.0;
  head.batchesRemaining -= 1;

  const parent =
    head.isIntermediate && head.parentUid !== undefined
      ? host.craftingQueue.find((q) => q.uid === head.parentUid)
      : undefined;

  // Consume exactly 1 batch of this step's recipe ingredients from its reserved raw materials
  // and/or previously crafted intermediates held on the chain root.
  const batchIngs = getBatchIngredientsForQueueItem(head);
  const heldPool = head.isIntermediate ? parent?.heldIntermediates : head.heldIntermediates;
  for (let i = 0; i < batchIngs.length; i++) {
    const ing = batchIngs[i];
    let need = ing.count;
    // Consume held intermediates first so nested chains never double-count consumed intermediates
    if (heldPool && need > 0) {
      need -= takeHeldIntermediate(heldPool, ing.item, need);
    }
    if (need > 0) {
      need -= deductReservedEntries(head.reservedPerBatch, ing.item, need);
    }
  }

  if (!head.isIntermediate) {
    if (head.kind === 'machine' && head.machineType) {
      host.pocketMachines[head.machineType] =
        (host.pocketMachines[head.machineType] ?? 0) + head.resultCountPerBatch;
      host.recordRecentTool(head.machineType);
    } else if (Object.prototype.hasOwnProperty.call(CAPYTORIO_MACHINE_SPECS, head.resultId)) {
      const mType = head.resultId as CapytorioMachineType;
      host.pocketMachines[mType] = (host.pocketMachines[mType] ?? 0) + head.resultCountPerBatch;
      host.recordRecentTool(mType);
    } else {
      host.addPocketItem(head.resultId, head.resultCountPerBatch);
      if (CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[head.resultId]) {
        host.recordRecentTool(head.resultId);
      }
    }
    host.totalProduced += head.resultCountPerBatch;
    host.score += 5 * head.resultCountPerBatch;
    callbacks?.onCraftQueueCompleted?.(head.resultId, head.resultCountPerBatch);

    // Safety net: if root finished with any leftover held intermediates (e.g. unconsumed surplus), return to pocket
    if (head.batchesRemaining <= 0 && head.heldIntermediates) {
      for (const [item, count] of Object.entries(head.heldIntermediates) as Array<
        [CapytorioItemId, number]
      >) {
        if (count > 0) host.addPocketItem(item, count);
      }
      head.heldIntermediates = {};
    }
  } else {
    // Completed 1 batch of an intermediate step: credit its output immediately to parent's heldIntermediates
    // so mid-batch cancellation preserves completed outputs with zero loss or duplication.
    if (parent) {
      if (!parent.heldIntermediates) parent.heldIntermediates = {};
      addHeldIntermediate(parent.heldIntermediates, head.resultId, head.resultCountPerBatch);
      if (head.batchesRemaining <= 0 && (head.surplusToPocket ?? 0) > 0) {
        const deliver = takeHeldIntermediate(
          parent.heldIntermediates,
          head.resultId,
          head.surplusToPocket!
        );
        if (deliver > 0) {
          host.addPocketItem(head.resultId, deliver);
        }
      }
    } else {
      host.addPocketItem(head.resultId, head.resultCountPerBatch);
    }
  }

  if (head.batchesRemaining <= 0) {
    host.craftingQueue.shift();
  }
}
