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

const SAVE_KEY = 'capy_game_save_v3';
const LEGACY_SAVE_KEY_V2 = 'capy_game_save_v2';
const SETTINGS_KEY = 'capy_game_settings_v1';

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
          const parsed = JSON.parse(raw);
          const loaded: PlayerStats = {
            ...INITIAL_PLAYER_STATS,
            ...parsed,
            dna: typeof parsed.dna === 'number' ? parsed.dna : INITIAL_PLAYER_STATS.dna,
            coins: typeof parsed.coins === 'number' ? parsed.coins : INITIAL_PLAYER_STATS.coins,
            evolutionStage: parsed.evolutionStage || 1,
            activeMutations: Array.isArray(parsed.activeMutations) ? parsed.activeMutations : [],
            unlockedMutations: Array.isArray(parsed.unlockedMutations)
              ? parsed.unlockedMutations
              : Array.isArray(parsed.activeMutations)
                ? [...parsed.activeMutations]
                : [],
            upgrades: {
              ...INITIAL_PLAYER_STATS.upgrades,
              ...(parsed.upgrades || {}),
            },
            buildings:
              Array.isArray(parsed.buildings) && parsed.buildings.length > 0
                ? parsed.buildings
                : INITIAL_PLAYER_STATS.buildings,
            unlockedCosmetics:
              Array.isArray(parsed.unlockedCosmetics) && parsed.unlockedCosmetics.length > 0
                ? parsed.unlockedCosmetics
                : INITIAL_PLAYER_STATS.unlockedCosmetics,
            unlockedObjectMarkers: Boolean(parsed.unlockedObjectMarkers),
            unlockedRealityRescaler: Boolean(parsed.unlockedRealityRescaler),
          };
          this.cachedStats = loaded;
          return loaded;
        }
      }
    } catch (e) {
      console.warn('Failed to load CapyGame stats', e);
    }
    const fallback: PlayerStats = { ...INITIAL_PLAYER_STATS };
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
    const fresh: PlayerStats = { ...INITIAL_PLAYER_STATS };
    this.saveStats(fresh);
    return fresh;
  }

  public static loadSettings(): CapyGameSettings {
    if (this.cachedSettings) return this.cachedSettings;
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const loaded: CapyGameSettings = {
            ...DEFAULT_CAPY_SETTINGS,
            ...parsed,
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
      } else if (mode === 'breakout' && modeScore > next.highScoreBreakout) {
        next.highScoreBreakout = Math.round(modeScore);
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
}
