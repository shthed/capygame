import React from 'react';
import {
  ArrowUpCircle,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Crown,
  Dna,
  Hammer,
  Lock,
  Plus,
  RotateCcw,
  Trophy,
  Unlock,
} from 'lucide-react';
import {
  BUILDING_CATALOG,
  BuildingCatalogItem,
  CapyGameSettings,
  MutationId,
  PROGRESSIVE_UNLOCKS,
  PlayStyle,
  PlayerStats,
  SPORE_MUTATIONS,
  isForestGameMode,
} from '../types';
import { ProgressionService } from '../services/ProgressionService';
import { AudioService } from '../services/AudioService';
import type { ProceduralGameConfig } from '../config/ProceduralGameConfig';

export type ForestDockTab = 'modes' | 'build' | 'dna' | 'upgrades' | 'wardrobe';

const ABILITY_UPGRADE_LIST: Array<{
  id: keyof PlayerStats['upgrades'];
  name: string;
  description: string;
}> = [
  {
    id: 'speedBoost',
    name: 'Locomotion Velocity',
    description: 'Increases surface and aquatic traversal speed across all 5 world sectors.',
  },
  {
    id: 'yuzuMagnet',
    name: 'Field Attraction Radius',
    description: 'Expands the collection radius for energy spheres and DNA nodes.',
  },
  {
    id: 'bounciness',
    name: 'Vertical Impulse Boost',
    description: 'Increases vertical leap impulse across surface pads and ascent courses.',
  },
  {
    id: 'herdSize',
    name: 'Initial Formation Count',
    description: 'Adds starting companion units in the South-West causeway sector.',
  },
  {
    id: 'paddleSize',
    name: 'Automation Overclock',
    description: 'Boosts Capytorio factory speed, inserter throughput, and belt velocity.',
  },
];

const WARDROBE_HATS: Array<{
  id: string;
  name: string;
  kidName: string;
  description: string;
}> = [
  {
    id: 'yuzu',
    name: 'Citrus Crest',
    kidName: 'Yuzu Orange',
    description: 'Signature orange balanced on head.',
  },
  {
    id: 'crown',
    name: 'Gold Diadem',
    kidName: 'Gold Crown',
    description: 'Shiny royal capybara crown.',
  },
  {
    id: 'flower',
    name: 'Flora Emblem',
    kidName: 'Daisy Flower',
    description: 'Cute garden flower hat.',
  },
  {
    id: 'wizard',
    name: 'Spire Cone',
    kidName: 'Wizard Hat',
    description: 'Magical pointy wizard hat.',
  },
  {
    id: 'halo',
    name: 'Orbital Ring',
    kidName: 'Glowing Halo',
    description: 'Floating golden ring.',
  },
];

export interface ForestModeItem {
  id: PlayStyle;
  title: string;
  subtitle: string;
  compass: string;
  accentColor: string;
  description: string;
  requiredDna: number;
}

export interface CapyForestMenuDrawerProps {
  isAdvancedMode: boolean;
  activeMode: PlayStyle;
  activeTab: ForestDockTab;
  isDockCollapsed: boolean;
  currentZoneTitle: string;
  currentModeCompass: string;
  stats: PlayerStats;
  unlockedCount: number;
  gameSettings: CapyGameSettings;
  proceduralConfig: ProceduralGameConfig;
  playStyleList: ForestModeItem[];
  isTabUnlocked: (tab: ForestDockTab) => boolean;
  isZoneUnlocked: (mode: PlayStyle) => boolean;
  getHighScoreForMode: (mode: PlayStyle) => number;
  onUnlockAllFeatures: () => void;
  onOpenCapySelect: () => void;
  onToggleChaseCamera: () => void;
  onSelectTab: (tab: ForestDockTab) => void;
  onResetSector: () => void;
  onToggleDockCollapse: () => void;
  onSelectMode: (mode: PlayStyle) => void;
  onPlaceBuilding: (def: BuildingCatalogItem) => void;
  onStartBuildingGhost: (def: BuildingCatalogItem) => void;
  onUpgradeBuilding: (buildingId: string) => void;
  onToggleMutation: (mutationId: MutationId) => void;
  onLevelUpAbility: (upgradeKey: keyof PlayerStats['upgrades']) => void;
  onPrestigeAscend: () => void;
  onEquipHat: (hatId: string) => void;
}

export const CapyForestMenuDrawer: React.FC<CapyForestMenuDrawerProps> = ({
  isAdvancedMode,
  activeMode,
  activeTab,
  isDockCollapsed,
  currentZoneTitle,
  currentModeCompass,
  stats,
  unlockedCount,
  gameSettings,
  proceduralConfig,
  playStyleList,
  isTabUnlocked,
  isZoneUnlocked,
  getHighScoreForMode,
  onUnlockAllFeatures,
  onOpenCapySelect,
  onToggleChaseCamera,
  onSelectTab,
  onResetSector,
  onToggleDockCollapse,
  onSelectMode,
  onPlaceBuilding,
  onStartBuildingGhost,
  onUpgradeBuilding,
  onToggleMutation,
  onLevelUpAbility,
  onPrestigeAscend,
  onEquipHat,
}) => (
  <header
    data-testid="capygame-top-header"
    className="fixed top-11 right-2 left-2 sm:left-auto sm:w-[720px] z-40 pointer-events-auto bg-zinc-950/96 border border-white/15 rounded-xl shadow-2xl p-2.5 flex flex-col gap-2"
  >
    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 px-2.5 py-1 rounded-md text-xs">
          <Compass className="w-3 h-3 text-sky-400 shrink-0" />
          <span className="font-semibold text-zinc-100">{currentZoneTitle}</span>
          {isAdvancedMode && (
            <span className="text-[10px] font-mono text-zinc-400">{currentModeCompass}</span>
          )}
        </div>

        <div className="flex lg:hidden items-center gap-1.5 bg-zinc-900 border border-white/10 px-2 py-1 rounded-md text-[11px] font-mono tabular-nums">
          {isAdvancedMode && (
            <>
              <span className="text-emerald-300 font-semibold">{stats.dna} DNA</span>
              <span className="text-zinc-600">·</span>
            </>
          )}
          <span className="text-amber-300 font-semibold">
            {stats.coins ?? 0} {isAdvancedMode ? 'c' : 'Coins'}
          </span>
        </div>

        <div
          data-testid="progressive-unlock-bar"
          className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 px-2 py-1 rounded-md text-[11px] font-mono text-zinc-300"
        >
          <span>
            {isAdvancedMode
              ? `SECTORS ${unlockedCount}/${PROGRESSIVE_UNLOCKS.length}`
              : `${unlockedCount}/${PROGRESSIVE_UNLOCKS.length} Open`}
          </span>
          {unlockedCount < PROGRESSIVE_UNLOCKS.length && (
            <button
              type="button"
              data-testid="unlock-all-features-btn"
              onClick={onUnlockAllFeatures}
              className="ml-1 px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 font-sans font-medium text-[10px] cursor-pointer"
            >
              {isAdvancedMode ? 'Unlock All' : 'Unlock Everything'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {isAdvancedMode && (
          <button
            type="button"
            data-testid="open-capy-select-btn"
            onClick={() => {
              AudioService.playCoin();
              onOpenCapySelect();
            }}
            className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-[11px] px-2 py-1 rounded-md border border-white/12 transition-colors cursor-pointer"
          >
            <Crown className="w-3 h-3 text-amber-400" />
            <span>Select Unit</span>
          </button>
        )}

        <button
          type="button"
          data-testid="toggle-chase-camera-btn"
          onClick={onToggleChaseCamera}
          className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer border ${
            gameSettings.cameraFollowBehind
              ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
              : 'bg-zinc-900 text-zinc-300 border-white/12 hover:bg-zinc-800'
          }`}
        >
          <Camera className="w-3 h-3" />
          <span>
            {isAdvancedMode
              ? gameSettings.cameraFollowBehind
                ? 'Chase Cam: ON'
                : 'Fixed Cam'
              : gameSettings.cameraFollowBehind
                ? 'Follow Capy: ON'
                : 'Follow Capy: OFF'}
          </span>
        </button>
      </div>
    </div>

    <section data-testid="capygame-top-dock" className="w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between pb-2 border-b border-white/10 gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            data-testid="tab-modes"
            onClick={() => onSelectTab('modes')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'modes'
                ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{isAdvancedMode ? 'Island Games (4)' : 'Island Areas'}</span>
          </button>

          <button
            type="button"
            data-testid="tab-build"
            onClick={() => onSelectTab('build')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'build'
                ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>{isAdvancedMode ? 'Structures' : 'Build'}</span>
          </button>

          {isAdvancedMode && (
            <>
              <button
                type="button"
                data-testid="tab-dna"
                onClick={() => onSelectTab('dna')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'dna'
                    ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {isTabUnlocked('dna') ? (
                  <Dna className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3 h-3 text-zinc-500" />
                )}
                <span>Bio-Traits</span>
              </button>

              <button
                type="button"
                data-testid="tab-upgrades"
                onClick={() => onSelectTab('upgrades')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'upgrades'
                    ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {isTabUnlocked('upgrades') ? (
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3 h-3 text-zinc-500" />
                )}
                <span>Parameters</span>
              </button>
            </>
          )}

          <button
            type="button"
            data-testid="tab-wardrobe"
            onClick={() => onSelectTab('wardrobe')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'wardrobe'
                ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            {isTabUnlocked('wardrobe') ? (
              <Crown className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3 h-3 text-zinc-500" />
            )}
            <span>{isAdvancedMode ? 'Loadout' : 'Hats'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {activeMode !== 'sanctuary' && (
            <button
              type="button"
              onClick={onResetSector}
              className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-[11px] font-medium border border-white/10 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset Sector</span>
            </button>
          )}

          <button
            type="button"
            data-testid="toggle-dock-collapse"
            onClick={onToggleDockCollapse}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[11px] font-medium border border-white/10 cursor-pointer"
          >
            <span>{isDockCollapsed ? 'Expand' : 'Hide'}</span>
            {isDockCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {!isDockCollapsed && (
        <div className="pt-2 max-h-[54vh] sm:max-h-[62vh] overflow-y-auto">
          {activeTab === 'modes' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {playStyleList.filter((mode) => isForestGameMode(mode.id)).map((mode) => {
                const isSelected = mode.id === activeMode;
                const unlocked = isZoneUnlocked(mode.id);
                const best = getHighScoreForMode(mode.id);
                return (
                  <button
                    key={mode.id}
                    type="button"
                    data-testid={`mode-btn-${mode.id}`}
                    onClick={() => onSelectMode(mode.id)}
                    className={`flex flex-col justify-between p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800/90 border-sky-400/60'
                        : 'bg-zinc-900/70 border-white/10 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-zinc-100 truncate flex items-center gap-1">
                          {!unlocked && <Lock className="w-3 h-3 text-zinc-500 shrink-0" />}
                          {mode.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                        {mode.subtitle}
                      </p>
                    </div>

                    <div className="mt-1.5 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span className="text-sky-400 flex items-center gap-0.5">
                        {isSelected ? (
                          'ACTIVE'
                        ) : unlocked ? (
                          'TRANSIT ->'
                        ) : (
                          <>
                            <Unlock className="w-2.5 h-2.5" />
                            <span>{mode.requiredDna} DNA</span>
                          </>
                        )}
                      </span>
                      <span className="flex items-center gap-0.5 text-zinc-300">
                        <Trophy className="w-2.5 h-2.5" /> {best}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'build' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BUILDING_CATALOG.map((def) => {
                  const count = stats.buildings.filter((b) => b.type === def.type).length;
                  const displayCost = ProgressionService.getBuildingCoinCost(
                    def.type,
                    proceduralConfig.economy.buildingCostMultiplier
                  );
                  return (
                    <div
                      key={def.type}
                      className="flex flex-col justify-between p-2 rounded-lg bg-zinc-900/80 border border-white/10"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-zinc-100 truncate">
                            {def.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-amber-300 border border-white/10 shrink-0">
                            {displayCost}c · #{count}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                          {def.description}
                        </p>
                      </div>

                      <div className="mt-1.5 flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`build-btn-${def.type}`}
                          onClick={() => onPlaceBuilding(def)}
                          className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Deploy ({displayCost}c)</span>
                        </button>
                        <button
                          type="button"
                          data-testid={`ghost-btn-${def.type}`}
                          onClick={() => onStartBuildingGhost(def)}
                          title="Aim & place on exact 3D Sanctuary turf"
                          className="flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/35"
                        >
                          <Compass className="w-3 h-3" />
                          <span>Place</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stats.buildings.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 shrink-0">
                    Deployed ({stats.buildings.length}/16):
                  </span>
                  {stats.buildings.map((b, idx) => {
                    const upCost = ProgressionService.getBuildingUpgradeCoinCost(
                      b.type,
                      b.level,
                      proceduralConfig.economy.buildingCostMultiplier
                    );
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onUpgradeBuilding(b.id)}
                        className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border bg-zinc-900 border-white/15 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                      >
                        <span>
                          #{idx + 1} {b.name} L{b.level}
                        </span>
                        <span className="text-sky-400">+{upCost}c</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'dna' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPORE_MUTATIONS.map((mut) => {
                const isEquipped = stats.activeMutations.includes(mut.id);
                const isUnlocked =
                  isEquipped || Boolean(stats.unlockedMutations?.includes(mut.id));
                return (
                  <div
                    key={mut.id}
                    className={`flex flex-col justify-between p-2 rounded-lg border ${
                      isEquipped
                        ? 'bg-zinc-800 border-emerald-400/50'
                        : 'bg-zinc-900/80 border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-zinc-100">{mut.name}</span>
                        <span className="text-[10px] font-mono text-emerald-300">
                          {isUnlocked ? 'Spliced' : `${mut.dnaCost} DNA`}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">
                        {mut.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid={`mutation-btn-${mut.id}`}
                      onClick={() => onToggleMutation(mut.id)}
                      className={`mt-1.5 w-full py-1 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        isEquipped
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-white/10'
                      }`}
                    >
                      {isEquipped
                        ? 'Active'
                        : isUnlocked
                          ? 'Activate'
                          : `Splice (${mut.dnaCost} DNA)`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'upgrades' && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {ABILITY_UPGRADE_LIST.map((up) => {
                  const level = stats.upgrades[up.id] || 1;
                  const dnaCost = ProgressionService.getAbilityUpgradeDnaCost(level);
                  return (
                    <div
                      key={up.id}
                      className="flex flex-col justify-between p-2 rounded-lg bg-zinc-900/80 border border-white/10 gap-1.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-zinc-100">{up.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-sky-400 border border-white/10">
                            L{level}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{up.description}</p>
                      </div>

                      <button
                        type="button"
                        data-testid={`upgrade-btn-${up.id}`}
                        onClick={() => onLevelUpAbility(up.id)}
                        className="w-full py-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10"
                      >
                        Increment ({dnaCost} DNA)
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/90 border border-amber-400/25">
                <div>
                  <span className="text-xs font-semibold text-amber-300 font-mono">
                    Prestige Tier P{stats.prestigeLevel} · {stats.prestigeLevel}x Coin Multiplier
                  </span>
                  <p className="text-[10px] text-zinc-400">
                    Ascend lineage for +{50 * stats.prestigeLevel}c bonus and permanent coin yield scaling.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="prestige-ascend-btn"
                  onClick={onPrestigeAscend}
                  className="px-3 py-1 rounded text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 cursor-pointer"
                >
                  Ascend ({ProgressionService.getPrestigeDnaCost(stats.prestigeLevel)} DNA)
                </button>
              </div>
            </div>
          )}

          {activeTab === 'wardrobe' && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {WARDROBE_HATS.map((item) => {
                const isSelected = stats.activeHat === item.id;
                const isUnlocked = stats.unlockedCosmetics.includes(item.id);
                const hatCost = ProgressionService.getCosmeticCoinCost(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`wardrobe-btn-${item.id}`}
                    onClick={() => onEquipHat(item.id)}
                    className={`flex flex-col justify-between p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800 border-sky-400/50'
                        : 'bg-zinc-900/80 border-white/10 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-semibold text-zinc-100">
                        {isAdvancedMode ? item.name : item.kidName}
                      </span>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{item.description}</p>
                    </div>
                    <span
                      className={`mt-1.5 inline-block text-[10px] font-mono uppercase ${
                        isSelected
                          ? 'text-sky-400'
                          : isUnlocked
                            ? 'text-zinc-400'
                            : 'text-amber-300'
                      }`}
                    >
                      {isSelected
                        ? isAdvancedMode
                          ? 'EQUIPPED'
                          : 'WEARING'
                        : isUnlocked
                          ? isAdvancedMode
                            ? 'EQUIP'
                            : 'WEAR'
                          : `${isAdvancedMode ? 'UNLOCK' : 'BUY'} ${hatCost}c`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  </header>
);
