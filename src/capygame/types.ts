export type PlayStyle = 'sanctuary' | 'breakout' | 'runner' | 'fallguys';

export interface CapyCosmetic {
  id: string;
  name: string;
  category: 'hat' | 'skin' | 'accessory';
  cost: number;
  unlocked: boolean;
  description: string;
  color?: number;
}

export interface WorldBuilding {
  id: string;
  type: 'hot_spring' | 'yuzu_orchard' | 'bamboo_grove' | 'zen_pagoda' | 'capy_statue' | 'trampoline_pad';
  name: string;
  level: number;
  cost: number;
  x: number;
  z: number;
  cps: number; // CapyCoins per second
  description: string;
}

export interface PlayerStats {
  coins: number;
  totalCoinsEarned: number;
  karma: number; // Prestige points
  prestigeLevel: number;
  selectedPlayStyle: PlayStyle;
  activeHat: string;
  activeSkin: string;
  
  // High scores across modes
  highScoreBreakout: number;
  highScoreRunner: number;
  highScoreFallGuys: number;
  
  // Upgrades
  upgrades: {
    herdSize: number;        // Level for runner / sanctuary herd
    coinMagnet: number;      // Magnet radius
    speedBoost: number;      // Movement speed
    paddleSize: number;      // Breakout paddle width
    bounciness: number;      // Fallguys jump force
    idleMultiplier: number;  // Sanctuary idle earnings
  };

  buildings: WorldBuilding[];
  unlockedCosmetics: string[];
}

export const INITIAL_PLAYER_STATS: PlayerStats = {
  coins: 100,
  totalCoinsEarned: 100,
  karma: 0,
  prestigeLevel: 1,
  selectedPlayStyle: 'sanctuary',
  activeHat: 'yuzu',
  activeSkin: 'default',
  highScoreBreakout: 0,
  highScoreRunner: 0,
  highScoreFallGuys: 0,
  upgrades: {
    herdSize: 1,
    coinMagnet: 1,
    speedBoost: 1,
    paddleSize: 1,
    bounciness: 1,
    idleMultiplier: 1,
  },
  buildings: [
    {
      id: 'b1',
      type: 'hot_spring',
      name: 'Cozy Onsen',
      level: 1,
      cost: 50,
      x: 0,
      z: -4,
      cps: 2,
      description: 'A warm bubbling hot spring where capybaras soak and meditate.',
    },
    {
      id: 'b2',
      type: 'yuzu_orchard',
      name: 'Yuzu Tree',
      level: 1,
      cost: 120,
      x: 5,
      z: 2,
      cps: 5,
      description: 'Fragrant citrus fruit that brings endless joy to all capybaras.',
    },
  ],
  unlockedCosmetics: ['yuzu', 'flower', 'default'],
};
