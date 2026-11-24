import {
  BUILDING_CATALOG,
  BuildingType,
  CapyGameSettings,
  COSMETIC_COIN_COSTS,
  DEFAULT_CAPY_SETTINGS,
  INITIAL_PLAYER_STATS,
  MutationId,
  OBJECT_MARKERS_COIN_COST,
  OBJECT_MARKERS_DNA_COST,
  PlayerStats,
  PlayStyle,
  PRESTIGE_BASE_DNA_COST,
  REALITY_RESCALER_COIN_COST,
  REALITY_RESCALER_DNA_COST,
  SPORE_MUTATIONS,
  WorldBuilding,
} from '../types';
import {
  QuantizedGhostRun,
  loadBestYuzuGhostRun,
  parseAndValidateGhostRun,
  saveYuzuGhostRunDirect,
} from '../engine/physics/YuzuGhostRecorder';
import type { ForestMicroSpecimenId } from '../engine/forestMicroSpecimens';
import {
  mergeDiscoveredSpecimen,
  sanitizeDiscoveredSpecimens,
} from '../engine/UniverseScaleMath';
import {
  applyBountyEvent,
  sanitizeBountyState,
  type BountyCatalogSpec,
  type BountyEventType,
} from '../engine/GameplayFunMath';

import { sanitizeCapytorioStateShallow } from '../engine/capytorio/CapytorioStateGuard';

const SAVE_KEY = 'capy_game_save_v3';
const LEGACY_SAVE_KEY_V2 = 'capy_game_save_v2';
const SETTINGS_KEY = 'capy_game_settings_v1';

const VALID_PLAY_STYLES: ReadonlySet<PlayStyle> = new Set([
  'sanctuary',
  'spore',
  'capytorio',
  'runner',
  'fallguys',
]);

const VALID_BUILDING_TYPES: ReadonlySet<BuildingType> = new Set([
  'hot_spring',
  'yuzu_orchard',
  'bamboo_grove',
  'zen_pagoda',
  'capy_statue',
  'trampoline_pad',
]);

const VALID_MUTATION_IDS: ReadonlySet<MutationId> = new Set(
  SPORE_MUTATIONS.map((m) => m.id)
);

export interface CapySaveBundle {
  schema: 'capygame-save-bundle-v1';
  exportedAtIso: string;
  saveKey: typeof SAVE_KEY;
  settingsKey: typeof SETTINGS_KEY;
  stats: PlayerStats;
  settings: CapyGameSettings;
  yuzuGhostRun?: QuantizedGhostRun | null;
}

export type SaveBundleImportResult =
  | {
      ok: true;
      stats: PlayerStats;
      settings: CapyGameSettings;
      yuzuGhostRun: QuantizedGhostRun | null;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
    };

export class ProgressionService {
  private static cachedStats: PlayerStats | null = null;
  private static cachedSettings: CapyGameSettings | null = null;
  private static saveTimerId: ReturnType<typeof setTimeout> | null = null;
  private static pendingFlush = false;
  private static lifecycleHooked = false;

  private static ensureLifecycleHooks(): void {
    if (this.lifecycleHooked || typeof window === 'undefined') return;
    this.lifecycleHooked = true;
    const flush = () => this.flushPendingSave();
    window.addEventListener('pagehide', flush);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushPendingSave();
        }
      });
    }
  }

  public static sanitizePlayerStats(raw: unknown, warnings?: string[]): PlayerStats {
    if (!raw || typeof raw !== 'object') {
      warnings?.push('Missing stats object; using initial defaults.');
      return structuredClone(INITIAL_PLAYER_STATS);
    }
    const parsed = raw as Partial<PlayerStats> & Record<string, unknown>;
    const cleanNum = (val: unknown, fallback: number, min = 0): number => {
      if (typeof val === 'number' && Number.isFinite(val)) {
        return Math.max(min, Math.round(val));
      }
      return fallback;
    };

    const rawActiveMutations = Array.isArray(parsed.activeMutations)
      ? parsed.activeMutations.filter(
          (id): id is MutationId => typeof id === 'string' && VALID_MUTATION_IDS.has(id as MutationId)
        )
      : [];
    const rawUnlockedMutations = Array.isArray(parsed.unlockedMutations)
      ? parsed.unlockedMutations.filter(
          (id): id is MutationId => typeof id === 'string' && VALID_MUTATION_IDS.has(id as MutationId)
        )
      : [...rawActiveMutations];
    for (const activeId of rawActiveMutations) {
      if (!rawUnlockedMutations.includes(activeId)) {
        rawUnlockedMutations.push(activeId);
      }
    }

    const rawBuildings = Array.isArray(parsed.buildings)
      ? parsed.buildings
          .filter((b): b is WorldBuilding => {
            if (!b || typeof b !== 'object') return false;
            const candidate = b as Partial<WorldBuilding>;
            return (
              typeof candidate.type === 'string' &&
              VALID_BUILDING_TYPES.has(candidate.type as BuildingType) &&
              typeof candidate.x === 'number' &&
              Number.isFinite(candidate.x) &&
              typeof candidate.z === 'number' &&
              Number.isFinite(candidate.z)
            );
          })
          .map((b, idx) => ({
            id:
              typeof b.id === 'string' && b.id.trim().length > 0
                ? b.id
                : `b_imp_${idx}_${Date.now()}`,
            type: b.type,
            name:
              typeof b.name === 'string' && b.name.trim().length > 0
                ? b.name
                : BUILDING_CATALOG.find((item) => item.type === b.type)?.name ?? b.type,
            level: cleanNum(b.level, 1, 1),
            x: Math.max(-45, Math.min(45, b.x)),
            z: Math.max(-45, Math.min(45, b.z)),
            description:
              typeof b.description === 'string'
                ? b.description
                : BUILDING_CATALOG.find((item) => item.type === b.type)?.description ?? '',
          }))
      : [];

    const rawCosmetics = Array.isArray(parsed.unlockedCosmetics)
      ? parsed.unlockedCosmetics.filter((c): c is string => typeof c === 'string' && c.length > 0)
      : [];
    const unlockedCosmetics =
      rawCosmetics.length > 0 ? Array.from(new Set(rawCosmetics)) : [...INITIAL_PLAYER_STATS.unlockedCosmetics];

    const rawMode =
      (parsed.selectedPlayStyle as unknown as string) === 'breakout'
        ? 'capytorio'
        : parsed.selectedPlayStyle;
    const selectedPlayStyle: PlayStyle =
      typeof rawMode === 'string' && VALID_PLAY_STYLES.has(rawMode as PlayStyle)
        ? (rawMode as PlayStyle)
        : INITIAL_PLAYER_STATS.selectedPlayStyle;

    const rawUpgrades =
      parsed.upgrades && typeof parsed.upgrades === 'object'
        ? (parsed.upgrades as Partial<PlayerStats['upgrades']>)
        : {};

    return {
      ...INITIAL_PLAYER_STATS,
      dna: cleanNum(parsed.dna, INITIAL_PLAYER_STATS.dna, 0),
      coins: cleanNum(parsed.coins, INITIAL_PLAYER_STATS.coins, 0),
      prestigeLevel: cleanNum(parsed.prestigeLevel, INITIAL_PLAYER_STATS.prestigeLevel, 1),
      selectedPlayStyle,
      activeHat:
        typeof parsed.activeHat === 'string' && parsed.activeHat.length > 0
          ? parsed.activeHat
          : INITIAL_PLAYER_STATS.activeHat,
      activeSkin:
        typeof parsed.activeSkin === 'string' && parsed.activeSkin.length > 0
          ? parsed.activeSkin
          : INITIAL_PLAYER_STATS.activeSkin,
      activeMutations: Array.from(new Set(rawActiveMutations)),
      unlockedMutations: Array.from(new Set(rawUnlockedMutations)),
      evolutionStage: cleanNum(parsed.evolutionStage, 1, 1),
      highScoreSpore: cleanNum(parsed.highScoreSpore, 0, 0),
      highScoreCapytorio: cleanNum(
        parsed.highScoreCapytorio ?? (parsed as Record<string, unknown>).highScoreBreakout,
        0,
        0
      ),
      highScoreRunner: cleanNum(parsed.highScoreRunner, 0, 0),
      highScoreFallGuys: cleanNum(parsed.highScoreFallGuys, 0, 0),
      capytorioFactory: sanitizeCapytorioStateShallow(parsed.capytorioFactory),
      upgrades: {
        herdSize: cleanNum(rawUpgrades.herdSize, INITIAL_PLAYER_STATS.upgrades.herdSize, 1),
        yuzuMagnet: cleanNum(rawUpgrades.yuzuMagnet, INITIAL_PLAYER_STATS.upgrades.yuzuMagnet, 1),
        speedBoost: cleanNum(rawUpgrades.speedBoost, INITIAL_PLAYER_STATS.upgrades.speedBoost, 1),
        paddleSize: cleanNum(rawUpgrades.paddleSize, INITIAL_PLAYER_STATS.upgrades.paddleSize, 1),
        bounciness: cleanNum(rawUpgrades.bounciness, INITIAL_PLAYER_STATS.upgrades.bounciness, 1),
      },
      buildings:
        rawBuildings.length > 0 ? rawBuildings : structuredClone(INITIAL_PLAYER_STATS.buildings),
      unlockedCosmetics,
      unlockedObjectMarkers: Boolean(parsed.unlockedObjectMarkers),
      unlockedRealityRescaler: Boolean(parsed.unlockedRealityRescaler),
      discoveredForestSpecimens: sanitizeDiscoveredSpecimens(parsed.discoveredForestSpecimens),
      bounties: sanitizeBountyState(parsed.bounties),
    };
  }

  public static sanitizeGameSettings(raw: unknown, warnings?: string[]): CapyGameSettings {
    if (!raw || typeof raw !== 'object') {
      warnings?.push('Missing settings object; using default simulation settings.');
      return { ...DEFAULT_CAPY_SETTINGS };
    }
    const parsed = raw as Partial<CapyGameSettings>;
    return {
      ...DEFAULT_CAPY_SETTINGS,
      ...parsed,
      advancedMode: Boolean(parsed.advancedMode),
      capytorioCameraMode: parsed.capytorioCameraMode === 'chase' ? 'chase' : 'oblique',
      capytorioBeltEndSpill: Boolean(parsed.capytorioBeltEndSpill),
      worldFogEnabled: false,
      drawDistance:
        typeof parsed.drawDistance === 'number' && Number.isFinite(parsed.drawDistance)
          ? Math.max(90, Math.min(1350, Math.round(parsed.drawDistance)))
          : parsed.gpuQualityPreset === 'performance'
            ? 135
            : DEFAULT_CAPY_SETTINGS.drawDistance,
      realityScaleGamma:
        typeof parsed.realityScaleGamma === 'number' &&
        Number.isFinite(parsed.realityScaleGamma)
          ? Math.max(0.28, Math.min(1.0, parsed.realityScaleGamma))
          : DEFAULT_CAPY_SETTINGS.realityScaleGamma,
      showObjectMarkers: Boolean(parsed.showObjectMarkers),
      astrophysicsPalette:
        parsed.astrophysicsPalette === 'hubble' ? 'hubble' : 'natural',
      flightTrajectory:
        parsed.flightTrajectoryUserSelected === true && parsed.flightTrajectory === 'straight'
          ? 'straight'
          : 'spiral',
      flightTrajectoryUserSelected: Boolean(parsed.flightTrajectoryUserSelected),
      cameraDistance:
        typeof parsed.cameraDistance === 'number' && Number.isFinite(parsed.cameraDistance)
          ? Math.max(0.45, Math.min(2.2, parsed.cameraDistance))
          : DEFAULT_CAPY_SETTINGS.cameraDistance,
      turnSensitivity:
        typeof parsed.turnSensitivity === 'number' && Number.isFinite(parsed.turnSensitivity)
          ? Math.max(0.5, Math.min(2.0, parsed.turnSensitivity))
          : DEFAULT_CAPY_SETTINGS.turnSensitivity,
      fov:
        typeof parsed.fov === 'number' && Number.isFinite(parsed.fov)
          ? Math.max(45, Math.min(75, Math.round(parsed.fov)))
          : DEFAULT_CAPY_SETTINGS.fov,
      timeOfDayHours:
        typeof parsed.timeOfDayHours === 'number' && Number.isFinite(parsed.timeOfDayHours)
          ? Math.max(0, Math.min(24, parsed.timeOfDayHours))
          : DEFAULT_CAPY_SETTINGS.timeOfDayHours,
      gpuExposure:
        typeof parsed.gpuExposure === 'number' && Number.isFinite(parsed.gpuExposure)
          ? Math.max(0.5, Math.min(2.0, parsed.gpuExposure))
          : DEFAULT_CAPY_SETTINGS.gpuExposure,
      gpuBloomStrength:
        typeof parsed.gpuBloomStrength === 'number' &&
        Number.isFinite(parsed.gpuBloomStrength)
          ? Math.max(0.0, Math.min(1.5, parsed.gpuBloomStrength))
          : DEFAULT_CAPY_SETTINGS.gpuBloomStrength,
      gpuSharpenAmount:
        typeof parsed.gpuSharpenAmount === 'number' &&
        Number.isFinite(parsed.gpuSharpenAmount)
          ? Math.max(0.0, Math.min(1.0, parsed.gpuSharpenAmount))
          : DEFAULT_CAPY_SETTINGS.gpuSharpenAmount,
      maxFpsLimit:
        typeof parsed.maxFpsLimit === 'number' && Number.isFinite(parsed.maxFpsLimit)
          ? parsed.maxFpsLimit <= 0
            ? 0
            : Math.max(24, Math.min(240, Math.round(parsed.maxFpsLimit)))
          : DEFAULT_CAPY_SETTINGS.maxFpsLimit,
      fpsTarget:
        typeof parsed.fpsTarget === 'number' && Number.isFinite(parsed.fpsTarget)
          ? Math.max(24, Math.min(240, Math.round(parsed.fpsTarget)))
          : DEFAULT_CAPY_SETTINGS.fpsTarget,
      showFpsButton:
        parsed.showFpsButton === undefined
          ? DEFAULT_CAPY_SETTINGS.showFpsButton
          : Boolean(parsed.showFpsButton),
      mouselookEnabled:
        parsed.mouselookEnabled === undefined
          ? DEFAULT_CAPY_SETTINGS.mouselookEnabled
          : Boolean(parsed.mouselookEnabled),
      mouselookSensitivity:
        typeof parsed.mouselookSensitivity === 'number' &&
        Number.isFinite(parsed.mouselookSensitivity)
          ? Math.max(0.2, Math.min(2.5, Math.round(parsed.mouselookSensitivity * 20) / 20))
          : DEFAULT_CAPY_SETTINGS.mouselookSensitivity,
      invertMouseY:
        parsed.invertMouseY === undefined
          ? DEFAULT_CAPY_SETTINGS.invertMouseY
          : Boolean(parsed.invertMouseY),
      gpuResolutionScale:
        typeof parsed.gpuResolutionScale === 'number' &&
        Number.isFinite(parsed.gpuResolutionScale)
          ? Math.max(0.5, Math.min(1.5, parsed.gpuResolutionScale))
          : DEFAULT_CAPY_SETTINGS.gpuResolutionScale,
      gpuAntiAliasing:
        parsed.gpuAntiAliasing === 'msaa_fxaa' ||
        parsed.gpuAntiAliasing === 'fxaa' ||
        parsed.gpuAntiAliasing === 'none'
          ? parsed.gpuAntiAliasing
          : DEFAULT_CAPY_SETTINGS.gpuAntiAliasing,
    };
  }

  public static exportSaveBundleJson(
    statsOverride?: PlayerStats,
    settingsOverride?: CapyGameSettings,
    ghostOverride?: QuantizedGhostRun | null
  ): string {
    const bundle: CapySaveBundle = {
      schema: 'capygame-save-bundle-v1',
      exportedAtIso: new Date().toISOString(),
      saveKey: SAVE_KEY,
      settingsKey: SETTINGS_KEY,
      stats: this.sanitizePlayerStats(statsOverride ?? this.loadStats()),
      settings: this.sanitizeGameSettings(settingsOverride ?? this.loadSettings()),
      yuzuGhostRun:
        ghostOverride !== undefined ? ghostOverride : loadBestYuzuGhostRun(),
    };
    return JSON.stringify(bundle, null, 2);
  }

  public static parseAndValidateSaveBundle(jsonText: string): SaveBundleImportResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { ok: false, error: 'Invalid JSON syntax. Please check your backup file.' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Backup JSON must be an object containing stats or settings.' };
    }

    const obj = parsed as Record<string, unknown>;
    const warnings: string[] = [];
    const hasStatsKey = typeof obj.stats === 'object' && obj.stats !== null;
    const hasSettingsKey = typeof obj.settings === 'object' && obj.settings !== null;
    const looksLikeRawStats =
      !hasStatsKey &&
      !hasSettingsKey &&
      ('dna' in obj || 'coins' in obj || 'buildings' in obj || 'upgrades' in obj);
    const looksLikeRawSettings =
      !hasStatsKey &&
      !hasSettingsKey &&
      ('fov' in obj || 'gpuQualityPreset' in obj || 'drawDistance' in obj);

    if (!hasStatsKey && !hasSettingsKey && !looksLikeRawStats && !looksLikeRawSettings) {
      return {
        ok: false,
        error:
          'Unrecognized save format. Expected capygame-save-bundle-v1 with stats and/or settings.',
      };
    }

    const stats = hasStatsKey
      ? this.sanitizePlayerStats(obj.stats, warnings)
      : looksLikeRawStats
        ? this.sanitizePlayerStats(obj, warnings)
        : this.sanitizePlayerStats(this.loadStats());

    const settings = hasSettingsKey
      ? this.sanitizeGameSettings(obj.settings, warnings)
      : looksLikeRawSettings
        ? this.sanitizeGameSettings(obj, warnings)
        : this.sanitizeGameSettings(this.loadSettings());

    let yuzuGhostRun: QuantizedGhostRun | null = null;
    if ('yuzuGhostRun' in obj && obj.yuzuGhostRun !== null && obj.yuzuGhostRun !== undefined) {
      const validGhost = parseAndValidateGhostRun(obj.yuzuGhostRun);
      if (validGhost) {
        yuzuGhostRun = validGhost;
      } else {
        warnings.push('Ignored malformed yuzuGhostRun payload in backup.');
      }
    }

    return { ok: true, stats, settings, yuzuGhostRun, warnings };
  }

  public static importSaveBundleJson(jsonText: string): SaveBundleImportResult {
    const res = this.parseAndValidateSaveBundle(jsonText);
    if (!res.ok) return res;
    this.saveStats(res.stats);
    this.saveSettings(res.settings);
    if (res.yuzuGhostRun) {
      saveYuzuGhostRunDirect(res.yuzuGhostRun);
    }
    return res;
  }

  public static loadStats(forceReload: boolean = false): PlayerStats {
    this.ensureLifecycleHooks();
    if (this.cachedStats && !forceReload) return this.cachedStats;
    try {
      if (typeof window !== 'undefined') {
        const raw =
          localStorage.getItem(SAVE_KEY) ||
          localStorage.getItem(LEGACY_SAVE_KEY_V2) ||
          localStorage.getItem('capy_game_save_v1');
        if (raw) {
          const loaded = this.sanitizePlayerStats(JSON.parse(raw));
          this.cachedStats = loaded;
          return loaded;
        }
      }
    } catch (e) {
      console.warn('Failed to load CapyGame stats', e);
    }
    const fallback: PlayerStats = structuredClone(INITIAL_PLAYER_STATS);
    this.cachedStats = fallback;
    return fallback;
  }

  public static flushPendingSave(): void {
    if (this.saveTimerId !== null) {
      clearTimeout(this.saveTimerId);
      this.saveTimerId = null;
    }
    if (!this.pendingFlush || !this.cachedStats) return;
    this.pendingFlush = false;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.cachedStats));
      }
    } catch (e) {
      console.warn('Failed to flush CapyGame stats', e);
    }
  }

  public static scheduleSaveStats(stats: PlayerStats, delayMs: number = 250): void {
    this.ensureLifecycleHooks();
    this.cachedStats = stats;
    this.pendingFlush = true;
    if (this.saveTimerId !== null) {
      clearTimeout(this.saveTimerId);
    }
    this.saveTimerId = setTimeout(() => {
      this.saveTimerId = null;
      this.flushPendingSave();
    }, delayMs);
  }

  public static saveStats(stats: PlayerStats) {
    this.ensureLifecycleHooks();
    this.cachedStats = stats;
    this.pendingFlush = true;
    this.flushPendingSave();
  }

  public static resetStats(): PlayerStats {
    const fresh: PlayerStats = structuredClone(INITIAL_PLAYER_STATS);
    this.saveStats(fresh);
    return fresh;
  }

  public static loadSettings(): CapyGameSettings {
    if (this.cachedSettings) return this.cachedSettings;
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const loaded = this.sanitizeGameSettings(JSON.parse(raw));
          this.cachedSettings = loaded;
          return loaded;
        }
      }
    } catch (e) {
      console.warn('Failed to load CapyGame settings', e);
    }
    const fallback: CapyGameSettings = { ...DEFAULT_CAPY_SETTINGS };
    this.cachedSettings = fallback;
    return fallback;
  }

  public static saveSettings(settings: CapyGameSettings) {
    this.cachedSettings = settings;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      }
    } catch (e) {
      console.warn('Failed to save CapyGame settings', e);
    }
  }

  public static getMutationBonuses(stats: PlayerStats) {
    let speedBonus = 0;
    let magnetBonus = 0;
    for (const mutId of stats.activeMutations) {
      const m = SPORE_MUTATIONS.find((item) => item.id === mutId);
      if (m) {
        speedBonus += m.speedBonus;
        magnetBonus += m.magnetBonus;
      }
    }
    return { speedBonus, magnetBonus };
  }

  public static recordProgress(
    stats: PlayerStats,
    dnaAmount: number = 0,
    mode?: PlayStyle,
    modeScore?: number,
    coinMultiplierBonus: number = 1.0
  ): PlayerStats {
    const finalDna = Math.max(0, Math.round(dnaAmount));
    const prestigeMult = Math.max(1, stats.prestigeLevel || 1);
    const statueLevels = (stats.buildings || []).reduce(
      (sum, b) => (b.type === 'capy_statue' ? sum + Math.max(1, b.level || 1) : sum),
      0
    );
    const statueMult = 1 + statueLevels * 0.15;
    const bonusCoins =
      finalDna > 0
        ? Math.max(1, Math.round(finalDna * 2 * prestigeMult * statueMult * coinMultiplierBonus))
        : 0;

    const next: PlayerStats = {
      ...stats,
      dna: stats.dna + finalDna,
      coins: (stats.coins || 0) + bonusCoins,
    };

    if (mode && typeof modeScore === 'number') {
      if (mode === 'spore' && modeScore > next.highScoreSpore) {
        next.highScoreSpore = Math.round(modeScore);
      } else if (mode === 'capytorio' && modeScore > next.highScoreCapytorio) {
        next.highScoreCapytorio = Math.round(modeScore);
      } else if (mode === 'runner' && modeScore > next.highScoreRunner) {
        next.highScoreRunner = Math.round(modeScore);
      } else if (mode === 'fallguys' && modeScore > next.highScoreFallGuys) {
        next.highScoreFallGuys = Math.round(modeScore);
      }
    }

    this.scheduleSaveStats(next);
    return next;
  }

  public static getBuildingCoinCost(
    type: BuildingType,
    costMultiplier: number = 1.0
  ): number {
    const base = BUILDING_CATALOG.find((b) => b.type === type)?.coinCost ?? 10;
    return Math.max(0, Math.round(base * costMultiplier));
  }

  public static getBuildingUpgradeCoinCost(
    type: BuildingType,
    currentLevel: number,
    costMultiplier: number = 1.0
  ): number {
    return Math.max(
      5,
      Math.round(this.getBuildingCoinCost(type, costMultiplier) * 0.75 * Math.max(1, currentLevel))
    );
  }

  public static getAbilityUpgradeDnaCost(currentLevel: number): number {
    return 5 * Math.max(1, currentLevel);
  }

  public static getCosmeticCoinCost(hatId: string): number {
    return COSMETIC_COIN_COSTS[hatId] ?? 15;
  }

  public static getPrestigeDnaCost(prestigeLevel: number): number {
    return PRESTIGE_BASE_DNA_COST * Math.max(1, prestigeLevel || 1);
  }

  public static upgradeBuilding(
    stats: PlayerStats,
    buildingId: string,
    costMultiplier: number = 1.0
  ): PlayerStats | null {
    const building = stats.buildings.find((b) => b.id === buildingId);
    if (!building) return null;

    const coinCost = this.getBuildingUpgradeCoinCost(
      building.type,
      building.level,
      costMultiplier
    );
    const currentCoins = stats.coins ?? 0;
    if (currentCoins < coinCost) return null;

    const updatedBuildings = stats.buildings.map((b) =>
      b.id === buildingId ? { ...b, level: b.level + 1 } : b
    );

    const updated: PlayerStats = {
      ...stats,
      coins: currentCoins - coinCost,
      buildings: updatedBuildings,
    };
    this.saveStats(updated);
    return updated;
  }

  public static placeBuilding(
    stats: PlayerStats,
    type: WorldBuilding['type'],
    name: string,
    x: number,
    z: number,
    description: string,
    costMultiplier: number = 1.0
  ): PlayerStats | null {
    const coinCost = this.getBuildingCoinCost(type, costMultiplier);
    const currentCoins = stats.coins ?? 0;
    if (currentCoins < coinCost) return null;

    const newBuilding: WorldBuilding = {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type,
      name,
      level: 1,
      x,
      z,
      description,
    };
    const updated: PlayerStats = {
      ...stats,
      coins: currentCoins - coinCost,
      buildings: [...stats.buildings, newBuilding],
    };
    this.saveStats(updated);
    return updated;
  }

  public static buyUpgrade(
    stats: PlayerStats,
    upgradeKey: keyof PlayerStats['upgrades']
  ): PlayerStats | null {
    const currentLevel = stats.upgrades[upgradeKey] || 1;
    const dnaCost = this.getAbilityUpgradeDnaCost(currentLevel);
    if (stats.dna < dnaCost) return null;

    const updated: PlayerStats = {
      ...stats,
      dna: stats.dna - dnaCost,
      upgrades: {
        ...stats.upgrades,
        [upgradeKey]: currentLevel + 1,
      },
    };
    this.saveStats(updated);
    return updated;
  }

  public static unlockOrToggleMutation(
    stats: PlayerStats,
    mutationId: MutationId
  ): { stats: PlayerStats; action: 'unlocked' | 'toggled' } | null {
    const mut = SPORE_MUTATIONS.find((m) => m.id === mutationId);
    if (!mut) return null;

    const prevUnlocked = stats.unlockedMutations ?? [...stats.activeMutations];

    if (stats.activeMutations.includes(mutationId)) {
      const ensuredUnlocked = prevUnlocked.includes(mutationId)
        ? prevUnlocked
        : [...prevUnlocked, mutationId];
      const updated: PlayerStats = {
        ...stats,
        activeMutations: stats.activeMutations.filter((id) => id !== mutationId),
        unlockedMutations: ensuredUnlocked,
      };
      this.saveStats(updated);
      return { stats: updated, action: 'toggled' };
    }

    if (prevUnlocked.includes(mutationId)) {
      const nextMutations = [...stats.activeMutations, mutationId];
      const updated: PlayerStats = {
        ...stats,
        activeMutations: nextMutations,
        unlockedMutations: prevUnlocked,
        evolutionStage: Math.max(stats.evolutionStage, prevUnlocked.length + 1),
      };
      this.saveStats(updated);
      return { stats: updated, action: 'toggled' };
    }

    if (stats.dna < mut.dnaCost) return null;

    const nextUnlocked = [...prevUnlocked, mutationId];
    const nextMutations = [...stats.activeMutations, mutationId];
    const updated: PlayerStats = {
      ...stats,
      dna: stats.dna - mut.dnaCost,
      activeMutations: nextMutations,
      unlockedMutations: nextUnlocked,
      evolutionStage: Math.max(stats.evolutionStage, nextUnlocked.length + 1),
    };
    this.saveStats(updated);
    return { stats: updated, action: 'unlocked' };
  }

  public static unlockOrEquipCosmetic(
    stats: PlayerStats,
    hatId: string
  ): { stats: PlayerStats; action: 'equipped' | 'unlocked' } | null {
    const unlocked = stats.unlockedCosmetics ?? ['yuzu'];
    if (unlocked.includes(hatId)) {
      const updated: PlayerStats = { ...stats, activeHat: hatId };
      this.saveStats(updated);
      return { stats: updated, action: 'equipped' };
    }

    const coinCost = this.getCosmeticCoinCost(hatId);
    const currentCoins = stats.coins ?? 0;
    if (currentCoins < coinCost) return null;

    const updated: PlayerStats = {
      ...stats,
      coins: currentCoins - coinCost,
      activeHat: hatId,
      unlockedCosmetics: [...unlocked, hatId],
    };
    this.saveStats(updated);
    return { stats: updated, action: 'unlocked' };
  }

  public static unlockCosmicInstrument(
    stats: PlayerStats,
    instrument: 'markers' | 'rescaler',
    currency: 'dna' | 'coins'
  ): PlayerStats | null {
    if (instrument === 'markers') {
      if (stats.unlockedObjectMarkers) return stats;
      if (currency === 'dna') {
        if (stats.dna < OBJECT_MARKERS_DNA_COST) return null;
        const updated: PlayerStats = {
          ...stats,
          dna: stats.dna - OBJECT_MARKERS_DNA_COST,
          unlockedObjectMarkers: true,
        };
        this.saveStats(updated);
        return updated;
      }
      if ((stats.coins ?? 0) < OBJECT_MARKERS_COIN_COST) return null;
      const updated: PlayerStats = {
        ...stats,
        coins: (stats.coins ?? 0) - OBJECT_MARKERS_COIN_COST,
        unlockedObjectMarkers: true,
      };
      this.saveStats(updated);
      return updated;
    }

    if (stats.unlockedRealityRescaler) return stats;
    if (currency === 'dna') {
      if (stats.dna < REALITY_RESCALER_DNA_COST) return null;
      const updated: PlayerStats = {
        ...stats,
        dna: stats.dna - REALITY_RESCALER_DNA_COST,
        unlockedRealityRescaler: true,
      };
      this.saveStats(updated);
      return updated;
    }
    if ((stats.coins ?? 0) < REALITY_RESCALER_COIN_COST) return null;
    const updated: PlayerStats = {
      ...stats,
      coins: (stats.coins ?? 0) - REALITY_RESCALER_COIN_COST,
      unlockedRealityRescaler: true,
    };
    this.saveStats(updated);
    return updated;
  }

  public static prestige(stats: PlayerStats): PlayerStats | null {
    const currentPrestige = Math.max(1, stats.prestigeLevel || 1);
    const reqDna = this.getPrestigeDnaCost(currentPrestige);
    if (stats.dna < reqDna) return null;

    const updated: PlayerStats = {
      ...stats,
      dna: stats.dna - reqDna,
      coins: (stats.coins || 0) + 50 * currentPrestige,
      prestigeLevel: currentPrestige + 1,
    };
    this.saveStats(updated);
    return updated;
  }

  public static discoverForestSpecimen(
    stats: PlayerStats,
    specimenId: ForestMicroSpecimenId
  ): { stats: PlayerStats; isNew: boolean } {
    const merged = mergeDiscoveredSpecimen(stats.discoveredForestSpecimens, specimenId);
    if (!merged.isNew) {
      return { stats, isNew: false };
    }
    const updated: PlayerStats = {
      ...stats,
      discoveredForestSpecimens: merged.list,
    };
    this.scheduleSaveStats(updated, 150);
    return { stats: updated, isNew: true };
  }

  public static recordBountyProgress(
    stats: PlayerStats,
    eventType: BountyEventType,
    amount: number = 1
  ): { stats: PlayerStats; completed: BountyCatalogSpec[] } {
    const res = applyBountyEvent(stats.bounties, eventType, amount);
    if (!res.changed) {
      return { stats, completed: [] };
    }
    let bonusCoins = 0;
    let bonusDna = 0;
    for (let i = 0; i < res.completedBounties.length; i++) {
      bonusCoins += res.completedBounties[i].coinReward;
      bonusDna += res.completedBounties[i].dnaReward;
    }
    const updated: PlayerStats = {
      ...stats,
      coins: (stats.coins || 0) + bonusCoins,
      dna: (stats.dna || 0) + bonusDna,
      bounties: res.nextItems,
    };
    this.scheduleSaveStats(updated, 200);
    return { stats: updated, completed: res.completedBounties };
  }
}
