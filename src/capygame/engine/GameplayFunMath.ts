export type BountyEventType =
  | 'shake_citrus_trees'
  | 'collect_yuzu'
  | 'ground_pound_splash'
  | 'mushroom_bounce'
  | 'spore_chomp'
  | 'capytorio_pack'
  | 'runner_gates'
  | 'fallguys_crown';

export interface BountyCatalogSpec {
  id: BountyEventType;
  title: string;
  description: string;
  target: number;
  coinReward: number;
  dnaReward: number;
}

export interface BountyProgressItem {
  id: BountyEventType;
  title: string;
  description: string;
  progress: number;
  target: number;
  coinReward: number;
  dnaReward: number;
  completedCount: number;
}

export interface ArcadeComboTelemetry {
  active: boolean;
  count: number;
  multiplier: number;
  timeRemainingSec: number;
  maxWindowSec: number;
  feverActive: boolean;
  lastActionLabel: string;
}

export interface MutableComboState {
  active: boolean;
  count: number;
  multiplier: number;
  timeRemainingSec: number;
  feverActive: boolean;
  lastActionLabel: string;
}

export interface OrbitalSurfaceBlendResult {
  inSurfaceWindow: boolean;
  terrestrialBlend: number;
  archipelagoVisible: boolean;
}

export interface DescentRingSpec {
  index: number;
  logMeters: number;
  radiusMeters: number;
  offsetX: number;
  offsetZ: number;
  colorHex: number;
}

export const COMBO_WINDOW_SEC = 4.5;
export const FEVER_COMBO_THRESHOLD = 4;

export const DESCENT_RING_SPECS: readonly DescentRingSpec[] = [
  { index: 0, logMeters: 4.55, radiusMeters: 9.0, offsetX: -2.2, offsetZ: 1.8, colorHex: 0x38bdf8 },
  { index: 1, logMeters: 3.92, radiusMeters: 7.6, offsetX: 2.0, offsetZ: 1.2, colorHex: 0x22d3ee },
  { index: 2, logMeters: 3.30, radiusMeters: 6.4, offsetX: 1.6, offsetZ: -1.8, colorHex: 0x34d399 },
  { index: 3, logMeters: 2.70, radiusMeters: 5.4, offsetX: -1.4, offsetZ: -1.2, colorHex: 0xfacc15 },
  { index: 4, logMeters: 2.12, radiusMeters: 4.5, offsetX: -0.6, offsetZ: 0.9, colorHex: 0xfb923c },
  { index: 5, logMeters: 1.52, radiusMeters: 3.8, offsetX: 0.0, offsetZ: 0.0, colorHex: 0xfef08a },
];

export const BOUNTY_CATALOG: readonly BountyCatalogSpec[] = [
  {
    id: 'shake_citrus_trees',
    title: 'Orchard Shake',
    description: 'Shake ripe fruit from 3 matching Sanctuary Trees',
    target: 3,
    coinReward: 18,
    dnaReward: 4,
  },
  {
    id: 'collect_yuzu',
    title: 'Citrus Harvest',
    description: 'Chomp 5 Golden Yuzu on Sanctuary Island',
    target: 5,
    coinReward: 15,
    dnaReward: 3,
  },
  {
    id: 'ground_pound_splash',
    title: 'Belly-Flop Splash',
    description: 'Land 2 Belly-Flop Slams (Ctrl / C / Dive)',
    target: 2,
    coinReward: 16,
    dnaReward: 3,
  },
  {
    id: 'mushroom_bounce',
    title: 'XPBD Sky Bounce',
    description: 'Bounce off Giant Mushroom Pads 3 times',
    target: 3,
    coinReward: 14,
    dnaReward: 3,
  },
  {
    id: 'spore_chomp',
    title: 'Lagoon Apex',
    description: 'Eat 6 Spore Orbs or Critters in Lagoon',
    target: 6,
    coinReward: 15,
    dnaReward: 4,
  },
  {
    id: 'capytorio_pack',
    title: 'Factory Automation',
    description: 'Automate & Craft 4 Science Packs in Capytorio',
    target: 4,
    coinReward: 18,
    dnaReward: 4,
  },
  {
    id: 'runner_gates',
    title: 'Stampede Tactician',
    description: 'Pass 4 Math Gates in Number Stampede',
    target: 4,
    coinReward: 16,
    dnaReward: 4,
  },
  {
    id: 'fallguys_crown',
    title: 'Summit Champion',
    description: 'Claim 1 Golden Crown in Mountain Parkour',
    target: 1,
    coinReward: 25,
    dnaReward: 6,
  },
];

const BOUNTY_BY_ID: ReadonlyMap<BountyEventType, BountyCatalogSpec> = new Map(
  BOUNTY_CATALOG.map((b) => [b.id, b])
);

const LEGACY_BOUNTY_ID_MIGRATIONS: Readonly<Record<string, BountyEventType>> = {
  descent_rings: 'shake_citrus_trees',
};

export function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

export function smoothstep01(edge0: number, edge1: number, x: number): number {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-6) {
    return x >= edge1 ? 1 : 0;
  }
  const t = clamp01((x - edge0) / denom);
  return t * t * (3 - 2 * t);
}

/**
 * Damps the 360-deg-per-band orbital spiral spin smoothly as the vessel enters Earth's
 * upper stratosphere (log 5.2 -> 2.1) so approach through clouds & landing stay calm and oriented.
 */
export function computeDescentApproachDampingFactor(logMeters: number): number {
  if (logMeters >= 5.2) return 1.0;
  if (logMeters <= 2.1) return 0.0;
  return smoothstep01(2.1, 5.2, logMeters);
}

/**
 * Continuous atmospheric, lighting, ocean & archipelago fade curves spanning log +4.15 -> -0.85
 * so descending from orbit into Capybara Forest has zero 1-frame lighting, sky, or island pop-in.
 */
export function computeOrbitalSurfaceBlend(
  logMeters: number,
  isSoftwareGl: boolean = false
): OrbitalSurfaceBlendResult {
  const inSurfaceWindow = logMeters >= -0.85 && logMeters <= 4.15;
  let terrestrialBlend = 0;
  if (logMeters >= -0.85 && logMeters <= 4.15) {
    const enterRamp = 1.0 - smoothstep01(1.95, 4.15, logMeters);
    const microFade = smoothstep01(-0.85, 0.05, logMeters);
    terrestrialBlend = clamp01(enterRamp * microFade);
  }
  const archipelagoMaxLog = isSoftwareGl ? 3.1 : 3.65;
  const archipelagoVisible = logMeters >= -0.85 && logMeters <= archipelagoMaxLog;
  return {
    inSurfaceWindow,
    terrestrialBlend,
    archipelagoVisible,
  };
}

/**
 * Matches the surface chase camera orbit distance (~12.6m at log 0.8) smoothly from canonical
 * space orbit radius (38.0m at log 2.95) so touchdown transitions with zero FOV/distance snap.
 */
export function computeContinuousDescentCamRadius(
  logMeters: number,
  landingChaseRadius: number = 12.6
): number {
  const canonicalRadius = 38.0;
  if (logMeters >= 2.95) {
    return canonicalRadius;
  }
  if (logMeters >= 0.8) {
    const t = clamp01((logMeters - 0.8) / (2.95 - 0.8));
    const s = t * t * (3 - 2 * t);
    return landingChaseRadius + (canonicalRadius - landingChaseRadius) * s;
  }
  if (logMeters >= -0.15) {
    const t = clamp01((logMeters - -0.15) / (0.8 - -0.15));
    const s = t * t * (3 - 2 * t);
    return 1.25 + (landingChaseRadius - 1.25) * s;
  }
  const t = clamp01((logMeters - -0.85) / (-0.15 - -0.85));
  const s = t * t * (3 - 2 * t);
  return 0.65 + (1.25 - 0.65) * s;
}

export function computeComboMultiplier(streakCount: number): number {
  if (streakCount >= 7) return 4;
  if (streakCount >= 4) return 3;
  if (streakCount >= 2) return 2;
  return 1;
}

export function createEmptyComboState(): MutableComboState {
  return {
    active: false,
    count: 0,
    multiplier: 1,
    timeRemainingSec: 0,
    feverActive: false,
    lastActionLabel: '',
  };
}

export function registerComboHit(
  state: MutableComboState,
  actionLabel: string
): { count: number; multiplier: number; feverJustTriggered: boolean } {
  const prevFever = state.feverActive;
  state.count += 1;
  state.active = true;
  state.multiplier = computeComboMultiplier(state.count);
  state.timeRemainingSec = COMBO_WINDOW_SEC;
  state.feverActive = state.count >= FEVER_COMBO_THRESHOLD;
  state.lastActionLabel = actionLabel;
  return {
    count: state.count,
    multiplier: state.multiplier,
    feverJustTriggered: !prevFever && state.feverActive,
  };
}

export function tickComboDecay(state: MutableComboState, dt: number): boolean {
  if (!state.active || dt <= 0) return false;
  state.timeRemainingSec = Math.max(0, state.timeRemainingSec - dt);
  if (state.timeRemainingSec <= 0) {
    state.active = false;
    state.count = 0;
    state.multiplier = 1;
    state.feverActive = false;
    state.lastActionLabel = '';
  }
  return true;
}

export function createBountyItem(
  spec: BountyCatalogSpec,
  progress: number = 0,
  completedCount: number = 0
): BountyProgressItem {
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    progress: Math.max(0, Math.min(spec.target, Math.round(progress))),
    target: spec.target,
    coinReward: spec.coinReward,
    dnaReward: spec.dnaReward,
    completedCount: Math.max(0, Math.round(completedCount)),
  };
}

export function createDefaultBounties(): BountyProgressItem[] {
  return [
    createBountyItem(BOUNTY_CATALOG[0]), // shake_citrus_trees
    createBountyItem(BOUNTY_CATALOG[1]), // collect_yuzu
    createBountyItem(BOUNTY_CATALOG[2]), // ground_pound_splash
  ];
}

export function sanitizeBountyState(raw: unknown): BountyProgressItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return createDefaultBounties();
  }
  const seen = new Set<BountyEventType>();
  const cleaned: BountyProgressItem[] = [];
  for (let i = 0; i < raw.length && cleaned.length < 3; i++) {
    const item = raw[i] as Partial<BountyProgressItem> | null | undefined;
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') continue;
    const migratedId = (LEGACY_BOUNTY_ID_MIGRATIONS[item.id] ?? item.id) as BountyEventType;
    const spec = BOUNTY_BY_ID.get(migratedId);
    if (!spec || seen.has(spec.id)) continue;
    seen.add(spec.id);
    const prog =
      typeof item.progress === 'number' && Number.isFinite(item.progress)
        ? Math.max(0, Math.min(spec.target - 1, Math.round(item.progress)))
        : 0;
    const comp =
      typeof item.completedCount === 'number' && Number.isFinite(item.completedCount)
        ? Math.max(0, Math.round(item.completedCount))
        : 0;
    cleaned.push(createBountyItem(spec, prog, comp));
  }
  for (let i = 0; i < BOUNTY_CATALOG.length && cleaned.length < 3; i++) {
    const spec = BOUNTY_CATALOG[i];
    if (!seen.has(spec.id)) {
      seen.add(spec.id);
      cleaned.push(createBountyItem(spec, 0, 0));
    }
  }
  return cleaned;
}

export function pickNextReplacementBounty(
  currentSlots: readonly BountyProgressItem[],
  justCompletedId: BountyEventType
): BountyCatalogSpec {
  const activeIds = new Set<BountyEventType>(currentSlots.map((b) => b.id));
  const completedIdx = BOUNTY_CATALOG.findIndex((b) => b.id === justCompletedId);
  const startOffset = completedIdx >= 0 ? completedIdx + 1 : 0;
  for (let step = 0; step < BOUNTY_CATALOG.length; step++) {
    const candidate = BOUNTY_CATALOG[(startOffset + step) % BOUNTY_CATALOG.length];
    if (candidate.id !== justCompletedId && !activeIds.has(candidate.id)) {
      return candidate;
    }
  }
  return BOUNTY_CATALOG[0];
}

export function applyBountyEvent(
  currentSlots: readonly BountyProgressItem[] | undefined,
  eventType: BountyEventType,
  amount: number = 1
): {
  nextItems: BountyProgressItem[];
  completedBounties: BountyCatalogSpec[];
  changed: boolean;
} {
  const base =
    currentSlots && currentSlots.length > 0 ? sanitizeBountyState(currentSlots) : createDefaultBounties();
  const delta = Math.max(1, Math.round(amount));
  const completedBounties: BountyCatalogSpec[] = [];
  let changed = false;

  const nextItems: BountyProgressItem[] = base.map((slot) => ({ ...slot }));

  for (let i = 0; i < nextItems.length; i++) {
    const slot = nextItems[i];
    if (slot.id !== eventType) continue;
    const spec = BOUNTY_BY_ID.get(slot.id);
    if (!spec) continue;
    changed = true;
    const nextProg = slot.progress + delta;
    if (nextProg >= spec.target) {
      completedBounties.push(spec);
      const nextSpec = pickNextReplacementBounty(nextItems, spec.id);
      nextItems[i] = createBountyItem(nextSpec, 0, 0);
    } else {
      slot.progress = nextProg;
    }
  }

  return { nextItems, completedBounties, changed };
}
