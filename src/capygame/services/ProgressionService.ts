import {
  INITIAL_PLAYER_STATS,
  MutationId,
  PlayerStats,
  PlayStyle,
  SPORE_MUTATIONS,
  WorldBuilding,
} from '../types';

const SAVE_KEY = 'capy_game_save_v2';

export class ProgressionService {
  private static cachedStats: PlayerStats | null = null;

  public static loadStats(): PlayerStats {
    if (this.cachedStats) return this.cachedStats;
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem('capy_game_save_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          const loaded: PlayerStats = {
            ...INITIAL_PLAYER_STATS,
            ...parsed,
            dna: typeof parsed.dna === 'number' ? parsed.dna : INITIAL_PLAYER_STATS.dna,
            evolutionStage: parsed.evolutionStage || 1,
            activeMutations: Array.isArray(parsed.activeMutations) ? parsed.activeMutations : [],
            upgrades: { ...INITIAL_PLAYER_STATS.upgrades, ...(parsed.upgrades || {}) },
            buildings:
              Array.isArray(parsed.buildings) && parsed.buildings.length > 0
                ? parsed.buildings
                : INITIAL_PLAYER_STATS.buildings,
            unlockedCosmetics:
              Array.isArray(parsed.unlockedCosmetics) && parsed.unlockedCosmetics.length > 0
                ? parsed.unlockedCosmetics
                : INITIAL_PLAYER_STATS.unlockedCosmetics,
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
        localStorage.setItem(SAVE_KEY, JSON.stringify(stats));
      }
    } catch (e) {
      console.warn('Failed to save CapyGame stats', e);
    }
  }

  public static getMutationBonuses(stats: PlayerStats) {
    let speedBonus = 0;
    let magnetBonus = 0;
    let incomeBonus = 0;
    for (const mutId of stats.activeMutations) {
      const m = SPORE_MUTATIONS.find((item) => item.id === mutId);
      if (m) {
        speedBonus += m.speedBonus;
        magnetBonus += m.magnetBonus;
        incomeBonus += m.incomeBonus;
      }
    }
    return { speedBonus, magnetBonus, incomeBonus };
  }

  public static getGlobalMultiplier(stats: PlayerStats): number {
    const prestigeBonus = 1 + (stats.prestigeLevel - 1) * 0.35;
    const { incomeBonus } = this.getMutationBonuses(stats);
    const pagodaLevels = stats.buildings
      .filter((b) => b.type === 'zen_pagoda')
      .reduce((sum, b) => sum + b.level, 0);
    const pagodaBonus = 1 + pagodaLevels * 0.15;
    return prestigeBonus * (1 + incomeBonus) * pagodaBonus;
  }

  public static addRewards(
    stats: PlayerStats,
    coinsAmount: number,
    dnaAmount: number = 0,
    mode?: PlayStyle,
    modeScore?: number
  ): PlayerStats {
    const mult = this.getGlobalMultiplier(stats);
    const finalCoins = Math.max(0, Math.round(coinsAmount * mult));
    const finalDna = Math.max(0, Math.round(dnaAmount));

    const next: PlayerStats = {
      ...stats,
      coins: stats.coins + finalCoins,
      totalCoinsEarned: stats.totalCoinsEarned + finalCoins,
      dna: stats.dna + finalDna,
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

  public static addCoins(stats: PlayerStats, amount: number): PlayerStats {
    return this.addRewards(stats, amount, 0);
  }

  public static calculateTotalCps(stats: PlayerStats): number {
    const baseCps = stats.buildings.reduce((sum, b) => sum + b.cps * b.level, 0);
    const idleMultiplier = 1 + (stats.upgrades.idleMultiplier - 1) * 0.5;
    const globalMult = this.getGlobalMultiplier(stats);
    return Math.round(baseCps * idleMultiplier * globalMult * 10) / 10;
  }

  public static upgradeBuilding(stats: PlayerStats, buildingId: string): PlayerStats | null {
    const building = stats.buildings.find((b) => b.id === buildingId);
    if (!building) return null;
    const cost = Math.round(building.cost * Math.pow(1.55, building.level));
    if (stats.coins < cost) return null;

    const updatedBuildings = stats.buildings.map((b) =>
      b.id === buildingId ? { ...b, level: b.level + 1 } : b
    );

    const updated: PlayerStats = {
      ...stats,
      coins: stats.coins - cost,
      buildings: updatedBuildings,
    };
    this.saveStats(updated);
    return updated;
  }

  public static placeBuilding(
    stats: PlayerStats,
    type: WorldBuilding['type'],
    name: string,
    baseCost: number,
    baseCps: number,
    x: number,
    z: number,
    description: string
  ): PlayerStats | null {
    const existingCount = stats.buildings.filter((b) => b.type === type).length;
    const dynamicCost = Math.round(baseCost * Math.pow(1.35, existingCount));
    if (stats.coins < dynamicCost) return null;

    const newBuilding: WorldBuilding = {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type,
      name,
      level: 1,
      cost: baseCost,
      x,
      z,
      cps: baseCps,
      description,
    };
    const updated: PlayerStats = {
      ...stats,
      coins: stats.coins - dynamicCost,
      buildings: [...stats.buildings, newBuilding],
    };
    this.saveStats(updated);
    return updated;
  }

  public static buyUpgrade(
    stats: PlayerStats,
    upgradeKey: keyof PlayerStats['upgrades']
  ): PlayerStats | null {
    const currentLevel = stats.upgrades[upgradeKey];
    const cost = Math.round(90 * Math.pow(1.7, currentLevel - 1));
    if (stats.coins < cost) return null;

    const updated: PlayerStats = {
      ...stats,
      coins: stats.coins - cost,
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

    if (stats.dna < mut.costDna) return null;

    const nextMutations = [...stats.activeMutations, mutationId];
    const updated: PlayerStats = {
      ...stats,
      dna: stats.dna - mut.costDna,
      activeMutations: nextMutations,
      evolutionStage: Math.max(stats.evolutionStage, nextMutations.length + 1),
    };
    this.saveStats(updated);
    return { stats: updated, action: 'unlocked' };
  }

  public static getPrestigeRequirement(stats: PlayerStats): number {
    return Math.round(1200 * Math.pow(2.1, stats.prestigeLevel - 1));
  }

  public static prestige(stats: PlayerStats): PlayerStats | null {
    const requiredCoins = this.getPrestigeRequirement(stats);
    if (stats.totalCoinsEarned < requiredCoins) return null;

    const updated: PlayerStats = {
      ...stats,
      coins: 250 * stats.prestigeLevel,
      dna: stats.dna + 20 * stats.prestigeLevel,
      prestigeLevel: stats.prestigeLevel + 1,
      karma: stats.karma + 100 * stats.prestigeLevel,
    };
    this.saveStats(updated);
    return updated;
  }
}
