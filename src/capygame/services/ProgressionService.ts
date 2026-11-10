import { INITIAL_PLAYER_STATS, PlayerStats, PlayStyle, WorldBuilding } from '../types';

const SAVE_KEY = 'capy_game_save_v1';

export class ProgressionService {
  private static cachedStats: PlayerStats | null = null;

  public static loadStats(): PlayerStats {
    if (this.cachedStats) return this.cachedStats;
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const loaded: PlayerStats = {
            ...INITIAL_PLAYER_STATS,
            ...parsed,
            upgrades: { ...INITIAL_PLAYER_STATS.upgrades, ...(parsed.upgrades || {}) },
            buildings: parsed.buildings || INITIAL_PLAYER_STATS.buildings,
            unlockedCosmetics: parsed.unlockedCosmetics || INITIAL_PLAYER_STATS.unlockedCosmetics,
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

  public static addCoins(stats: PlayerStats, amount: number): PlayerStats {
    const prestigeBonus = 1 + (stats.prestigeLevel - 1) * 0.25;
    const finalEarned = Math.round(amount * prestigeBonus);
    const updated: PlayerStats = {
      ...stats,
      coins: stats.coins + finalEarned,
      totalCoinsEarned: stats.totalCoinsEarned + finalEarned,
    };
    this.saveStats(updated);
    return updated;
  }

  public static calculateTotalCps(stats: PlayerStats): number {
    const baseCps = stats.buildings.reduce((sum, b) => sum + b.cps * b.level, 0);
    const idleMultiplier = 1 + (stats.upgrades.idleMultiplier - 1) * 0.5;
    const prestigeBonus = 1 + (stats.prestigeLevel - 1) * 0.25;
    return Math.round(baseCps * idleMultiplier * prestigeBonus * 10) / 10;
  }

  public static upgradeBuilding(stats: PlayerStats, buildingId: string): PlayerStats | null {
    const building = stats.buildings.find((b) => b.id === buildingId);
    if (!building) return null;
    const cost = Math.round(building.cost * Math.pow(1.6, building.level));
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
    cost: number,
    baseCps: number,
    x: number,
    z: number,
    description: string
  ): PlayerStats | null {
    if (stats.coins < cost) return null;
    const newBuilding: WorldBuilding = {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type,
      name,
      level: 1,
      cost,
      x,
      z,
      cps: baseCps,
      description,
    };
    const updated: PlayerStats = {
      ...stats,
      coins: stats.coins - cost,
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
    const cost = Math.round(100 * Math.pow(1.8, currentLevel - 1));
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

  public static prestige(stats: PlayerStats): PlayerStats | null {
    const requiredCoins = 1000 * Math.pow(2.2, stats.prestigeLevel - 1);
    if (stats.totalCoinsEarned < requiredCoins) return null;

    const updated: PlayerStats = {
      ...stats,
      coins: 200,
      prestigeLevel: stats.prestigeLevel + 1,
      karma: stats.karma + 100 * stats.prestigeLevel,
      // Keep cosmetics, high scores, and upgrade unlocks
    };
    this.saveStats(updated);
    return updated;
  }

  public static unlockCosmetic(stats: PlayerStats, cosmeticId: string, cost: number): PlayerStats | null {
    if (stats.coins < cost || stats.unlockedCosmetics.includes(cosmeticId)) return null;
    const updated: PlayerStats = {
      ...stats,
      coins: stats.coins - cost,
      unlockedCosmetics: [...stats.unlockedCosmetics, cosmeticId],
      activeHat: cosmeticId,
    };
    this.saveStats(updated);
    return updated;
  }
}
