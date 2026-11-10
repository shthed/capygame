export type PlayStyle = 'sanctuary' | 'spore' | 'breakout' | 'runner' | 'fallguys';

export type MutationId = 'flippers' | 'wings' | 'tusks' | 'horn' | 'shell' | 'glow_tail';

export interface CapyMutation {
  id: MutationId;
  name: string;
  costDna: number;
  description: string;
  speedBonus: number;
  magnetBonus: number;
  incomeBonus: number;
}

export const SPORE_MUTATIONS: CapyMutation[] = [
  {
    id: 'flippers',
    name: 'Aqua Flippers',
    costDna: 25,
    description: 'Webbed turbo paws for +25% movement speed across all worlds.',
    speedBonus: 0.25,
    magnetBonus: 0,
    incomeBonus: 0.1,
  },
  {
    id: 'tusks',
    name: 'Mighty Chomp Tusks',
    costDna: 50,
    description: 'Prehistoric tusks that smash obstacles and boost coin drops by +30%.',
    speedBonus: 0.05,
    magnetBonus: 0.2,
    incomeBonus: 0.3,
  },
  {
    id: 'shell',
    name: 'Armored Yuzu Shell',
    costDna: 85,
    description: 'Spiky citrus carapace that protects your herd and adds +40% income.',
    speedBonus: 0,
    magnetBonus: 0.3,
    incomeBonus: 0.4,
  },
  {
    id: 'wings',
    name: 'Celestial Glide Wings',
    costDna: 140,
    description: 'Feathered capybara wings that boost jump height and glide control.',
    speedBonus: 0.35,
    magnetBonus: 0.4,
    incomeBonus: 0.5,
  },
  {
    id: 'horn',
    name: 'Unicorn Prism Horn',
    costDna: 220,
    description: 'Mythic crystalline horn that radiates a wide coin magnet aura.',
    speedBonus: 0.2,
    magnetBonus: 1.0,
    incomeBonus: 0.75,
  },
  {
    id: 'glow_tail',
    name: 'Bioluminescent Tail',
    costDna: 320,
    description: 'Apex evolutionary trait doubling passive Sanctuary and mini-game rewards.',
    speedBonus: 0.3,
    magnetBonus: 0.6,
    incomeBonus: 1.0,
  },
];

export type BuildingType =
  | 'hot_spring'
  | 'yuzu_orchard'
  | 'bamboo_grove'
  | 'zen_pagoda'
  | 'capy_statue'
  | 'trampoline_pad';

export interface BuildingCatalogItem {
  type: BuildingType;
  name: string;
  baseCost: number;
  baseCps: number;
  icon: string;
  description: string;
}

export const BUILDING_CATALOG: BuildingCatalogItem[] = [
  {
    type: 'hot_spring',
    name: 'Cozy Onsen',
    baseCost: 75,
    baseCps: 3,
    icon: '♨️',
    description: 'Steaming mineral bath where capybaras soak with yuzu on their heads.',
  },
  {
    type: 'yuzu_orchard',
    name: 'Yuzu Orchard',
    baseCost: 160,
    baseCps: 7,
    icon: '🌳',
    description: 'Fragrant citrus grove that drops collectible golden yuzu around the island.',
  },
  {
    type: 'trampoline_pad',
    name: 'Bouncy Mushroom Pad',
    baseCost: 280,
    baseCps: 12,
    icon: '🍄',
    description: 'Springy giant mushroom pad—jump on it in the Sanctuary for air-time coin bursts!',
  },
  {
    type: 'bamboo_grove',
    name: 'Emerald Bamboo Grove',
    baseCost: 520,
    baseCps: 24,
    icon: '🎋',
    description: 'Tranquil bamboo forest that shelter wandering capybara families.',
  },
  {
    type: 'zen_pagoda',
    name: 'Sacred Capy Pagoda',
    baseCost: 1100,
    baseCps: 55,
    icon: '⛩️',
    description: 'Ancient timber temple that amplifies all mini-game score payouts by +15% per level.',
  },
  {
    type: 'capy_statue',
    name: 'Golden Capy Monument',
    baseCost: 2400,
    baseCps: 130,
    icon: '🗿',
    description: 'Gleaming solid-gold monument celebrating the supreme chill of the Capybara.',
  },
];

export interface WorldBuilding {
  id: string;
  type: BuildingType;
  name: string;
  level: number;
  cost: number;
  x: number;
  z: number;
  cps: number;
  description: string;
}

export interface LiveModeTelemetry {
  mode: PlayStyle;
  primaryLabel: string;
  primaryValue: string | number;
  secondaryLabel: string;
  secondaryValue: string | number;
  comboMultiplier: number;
}

export interface PlayerStats {
  coins: number;
  totalCoinsEarned: number;
  dna: number;
  karma: number;
  prestigeLevel: number;
  selectedPlayStyle: PlayStyle;
  activeHat: string;
  activeSkin: string;
  activeMutations: MutationId[];
  evolutionStage: number;

  highScoreSpore: number;
  highScoreBreakout: number;
  highScoreRunner: number;
  highScoreFallGuys: number;

  upgrades: {
    herdSize: number;
    coinMagnet: number;
    speedBoost: number;
    paddleSize: number;
    bounciness: number;
    idleMultiplier: number;
  };

  buildings: WorldBuilding[];
  unlockedCosmetics: string[];
}

export const INITIAL_PLAYER_STATS: PlayerStats = {
  coins: 150,
  totalCoinsEarned: 150,
  dna: 15,
  karma: 0,
  prestigeLevel: 1,
  selectedPlayStyle: 'sanctuary',
  activeHat: 'yuzu',
  activeSkin: 'classic',
  activeMutations: [],
  evolutionStage: 1,
  highScoreSpore: 0,
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
      id: 'b_init_onsen',
      type: 'hot_spring',
      name: 'Cozy Onsen',
      level: 1,
      cost: 75,
      x: -5,
      z: -4,
      cps: 3,
      description: 'Steaming mineral bath where capybaras soak with yuzu on their heads.',
    },
    {
      id: 'b_init_yuzu',
      type: 'yuzu_orchard',
      name: 'Yuzu Orchard',
      level: 1,
      cost: 160,
      x: 6,
      z: -3,
      cps: 7,
      description: 'Fragrant citrus grove that drops collectible golden yuzu around the island.',
    },
    {
      id: 'b_init_pad',
      type: 'trampoline_pad',
      name: 'Bouncy Mushroom Pad',
      level: 1,
      cost: 280,
      x: 0,
      z: 6,
      cps: 12,
      description: 'Springy giant mushroom pad—jump on it in the Sanctuary for air-time coin bursts!',
    },
  ],
  unlockedCosmetics: ['yuzu', 'flower', 'crown', 'party', 'wizard', 'halo'],
};
