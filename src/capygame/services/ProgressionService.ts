import {
  CapyGameSettings,
  DEFAULT_CAPY_SETTINGS,
  INITIAL_PLAYER_STATS,
  MutationId,
  OBJECT_MARKERS_COIN_COST,
  OBJECT_MARKERS_DNA_COST,
  PlayerStats,
  PlayStyle,
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

  public static loadStats(forceReload: boolean = false): PlayerStats {
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

  public static saveStats(stats: PlayerStats) {
    this.cachedStats = stats;
    try {
      if (typeof window !== 'undefined') {
        const serialized = JSON.stringify(stats);
        localStorage.setItem(SAVE_KEY, serialized);
        localStorage.setItem(LEGACY_SAVE_KEY_V2, serialized);
      }
    } catch (e) {
      console.warn('Failed to save CapyGame stats', e);
    }
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
    modeScore?: number
  ): PlayerStats {
    const finalDna = Math.max(0, Math.round(dnaAmount));
    const bonusCoins = finalDna > 0 ? finalDna * 2 : 0;

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

    this.saveStats(next);
    return next;
  }

  public static upgradeBuilding(stats: PlayerStats, buildingId: string): PlayerStats | null {
    const building = stats.buildings.find((b) => b.id === buildingId);
    if (!building) return null;

    const updatedBuildings = stats.buildings.map((b) =>
      b.id === buildingId ? { ...b, level: b.level + 1 } : b
    );

    const updated: PlayerStats = {
      ...stats,
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
    description: string
  ): PlayerStats {
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
      buildings: [...stats.buildings, newBuilding],
    };
    this.saveStats(updated);
    return updated;
  }

  public static buyUpgrade(
    stats: PlayerStats,
    upgradeKey: keyof PlayerStats['upgrades']
  ): PlayerStats {
    const currentLevel = stats.upgrades[upgradeKey] || 1;
    const updated: PlayerStats = {
      ...stats,
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

    if (stats.activeMutations.includes(mutationId)) {
      const updated: PlayerStats = {
        ...stats,
        activeMutations: stats.activeMutations.filter((id) => id !== mutationId),
      };
      this.saveStats(updated);
      return { stats: updated, action: 'toggled' };
    }

    const nextMutations = [...stats.activeMutations, mutationId];
    const updated: PlayerStats = {
      ...stats,
      activeMutations: nextMutations,
      evolutionStage: Math.max(stats.evolutionStage, nextMutations.length + 1),
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

  public static prestige(stats: PlayerStats): PlayerStats {
    const updated: PlayerStats = {
      ...stats,
      dna: stats.dna + 25 * stats.prestigeLevel,
      coins: (stats.coins || 0) + 50 * stats.prestigeLevel,
      prestigeLevel: stats.prestigeLevel + 1,
    };
    this.saveStats(updated);
    return updated;
  }
}
