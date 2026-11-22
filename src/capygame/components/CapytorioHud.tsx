import React, { useRef } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Hammer,
  Home,
  Minus,
  Package,
  Plus,
  Rocket,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  CAPYTORIO_HOTBAR_ORDER,
  CAPYTORIO_ITEM_CATALOG,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  CAPYTORIO_RECIPES,
  CAPYTORIO_TECHS,
  TECH_BY_ID,
  getCapytorioItemMeta,
  reloadCapytorioLuaFromServer,
  resetCustomCapytorioLuaSources,
  resolveCapytorioItemShape,
  setCustomCapytorioLuaSources,
  type CapytorioLuaCatalogInfo,
  type CapytorioMachineType,
  type CapytorioRecipeGroup,
  type CapytorioRecipeId,
  type CapytorioTechId,
} from '../engine/CapytorioData';
import {
  resolveCapytorioPlaceableSpec,
  type CapytorioUiSnapshot,
} from '../engine/CapytorioFactoryEngine';
import {
  CapytorioItemIcon,
  CapytorioMachineIcon,
  CapytorioSlotTile,
  CapytorioWorldIcon,
} from './CapytorioSlotIcon';
import { CapytorioEntityInfoPanel } from './CapytorioEntityInfoPanel';

export type CapytorioDrawerTab = 'none' | 'inventory' | 'craft' | 'tech' | 'inspect';
export type CapytorioCraftGroupTab = CapytorioRecipeGroup | 'machines' | 'lua';

export interface CapytorioHudProps {
  snap: CapytorioUiSnapshot;
  isObliqueCam: boolean;
  beltEndSpillEnabled: boolean;
  pointerHoverActive: boolean;
  drawerTab: CapytorioDrawerTab;
  setDrawerTab: React.Dispatch<React.SetStateAction<CapytorioDrawerTab>>;
  isDockCollapsed: boolean;
  setIsDockCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  craftGroup: CapytorioCraftGroupTab;
  setCraftGroup: (group: CapytorioCraftGroupTab) => void;
  selectedCraftRecipeId: string;
  setSelectedCraftRecipeId: (id: string) => void;
  luaCatalogInfo: CapytorioLuaCatalogInfo;
  setLuaCatalogInfo: (info: CapytorioLuaCatalogInfo) => void;
  onSelectTool: (toolId: string, promoteToRecent?: boolean) => void;
  onMineAction: () => void;
  onMineTileAt: (gx: number, gz: number) => void;
  onInspectTileAt: (gx: number, gz: number) => void;
  onClearInspection: () => void;
  onRotateDir: () => void;
  onToggleCameraMode: () => void;
  onToggleBeltEndSpill: () => void;
  onAdjustZoom: (delta: number) => void;
  onReturnToBeacon: () => void;
  onCollectAllOutputs: () => void;
  onFeedScience: () => void;
  onLaunchRocket: () => void;
  onCraftMachine: (mType: CapytorioMachineType) => void;
  onCraftRecipe: (recipeId: string, count: number, autoEquipResult?: boolean) => void;
  onSelectTech: (techId: CapytorioTechId) => void;
  onFuelGenerator: (gx: number, gz: number) => void;
  onInsertInputs: (gx: number, gz: number) => void;
  onTakeOutputs: (gx: number, gz: number) => void;
  onRotateMachineAt: (gx: number, gz: number) => void;
  onSelectAssemblerRecipe: (recipeId: CapytorioRecipeId) => void;
  showToast: (msg: string) => void;
}

const DIR_LABELS = ['N', 'E', 'S', 'W'] as const;

const CATEGORY_ORDER: Record<string, number> = {
  ore: 0,
  plate: 1,
  logistics: 2,
  production: 3,
  intermediate: 4,
  combat: 5,
  science: 6,
  rocket: 7,
};

const GROUP_TABS: Array<{ id: CapytorioCraftGroupTab; label: string }> = [
  { id: 'logistics', label: 'Logistics' },
  { id: 'production', label: 'Production' },
  { id: 'intermediate', label: 'Intermediates' },
  { id: 'combat', label: 'Combat' },
  { id: 'science', label: 'Science' },
  { id: 'machines', label: 'Buildings' },
  { id: 'lua', label: 'Mod .lua' },
];

const FACTORIO_PANEL_FRAME =
  'rounded-[3px] bg-[#1f2126] border-2 border-[#3c4049] border-t-[#545966] border-l-[#4c515c] border-b-[#111216] border-r-[#111216] shadow-[0_18px_48px_rgba(0,0,0,0.72)]';

const FACTORIO_HEADER_BAR =
  'px-3 py-1.5 bg-[#2c2f36] border-b-2 border-[#121317] flex items-center justify-between gap-2';

const FACTORIO_WELL =
  'rounded-[2px] bg-[#16181c] border border-[#0b0c0e] border-b-[#353942] border-r-[#353942]';

const FACTORIO_BTN_IDLE =
  'bg-[#2b2e35] hover:bg-[#393d46] border border-[#4a4f5b] border-b-[#14161a] border-r-[#14161a] text-[#e4e6eb]';

const FACTORIO_BTN_ACTIVE =
  'bg-[#e58926] hover:bg-[#ef9837] border border-[#f8c173] border-b-[#8b4f0f] border-r-[#8b4f0f] text-[#151618] font-bold';

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export const CapytorioHud: React.FC<CapytorioHudProps> = ({
  snap,
  isObliqueCam,
  beltEndSpillEnabled,
  pointerHoverActive,
  drawerTab,
  setDrawerTab,
  isDockCollapsed,
  setIsDockCollapsed,
  craftGroup,
  setCraftGroup,
  selectedCraftRecipeId,
  setSelectedCraftRecipeId,
  luaCatalogInfo,
  setLuaCatalogInfo,
  onSelectTool,
  onMineAction,
  onMineTileAt,
  onInspectTileAt,
  onClearInspection,
  onRotateDir,
  onToggleCameraMode,
  onToggleBeltEndSpill,
  onAdjustZoom,
  onReturnToBeacon,
  onCollectAllOutputs,
  onFeedScience,
  onLaunchRocket,
  onCraftMachine,
  onCraftRecipe,
  onSelectTech,
  onFuelGenerator,
  onInsertInputs,
  onTakeOutputs,
  onRotateMachineAt,
  onSelectAssemblerRecipe,
  showToast,
}) => {
  const recipeLuaInputRef = useRef<HTMLInputElement | null>(null);
  const techLuaInputRef = useRef<HTMLInputElement | null>(null);

  const dirLabel = DIR_LABELS[snap.selectedDir] ?? 'E';
  const effPct = Math.round(snap.powerEfficiency * 100);
  const totalSciInPocket = Object.entries(snap.pocketItems).reduce<number>(
    (sum, [id, qty]) =>
      qty && qty > 0 && getCapytorioItemMeta(id).category === 'science' ? sum + qty : sum,
    0
  );
  const activeTech = snap.activeTechId ? TECH_BY_ID.get(snap.activeTechId) : null;
  const pocketCraftableRecipes = CAPYTORIO_RECIPES.filter(
    (r) => r.pocketCraftable && snap.unlockedRecipes.includes(r.id)
  );
  const assemblerRecipes = CAPYTORIO_RECIPES.filter(
    (r) => r.station === 'assembler' && snap.unlockedRecipes.includes(r.id)
  );
  const inspected = snap.inspectedMachine;
  const inspectedSpec = inspected
    ? resolveCapytorioPlaceableSpec(inspected.variantItemId ?? inspected.type)
    : null;
  const inspectedTile = snap.inspectedTile;
  const activeInfoTarget = pointerHoverActive
    ? snap.hoveredTileInfo
    : inspectedTile ?? snap.hoveredTileInfo;
  const isInfoPinned = !pointerHoverActive && inspectedTile !== null;
  const hoveredTileInfo = snap.hoveredTile;
  const hoveredTileLabel = hoveredTileInfo.resource
    ? `${getCapytorioItemMeta(hoveredTileInfo.resource).shortName} ${hoveredTileInfo.resourceAmount} (${hoveredTileInfo.gx}, ${hoveredTileInfo.gz})`
    : hoveredTileInfo.hasTree
      ? `Citrus Tree +3 [E] (${hoveredTileInfo.gx}, ${hoveredTileInfo.gz})`
      : hoveredTileInfo.machineType
        ? `${resolveCapytorioPlaceableSpec(hoveredTileInfo.variantItemId ?? hoveredTileInfo.machineType)?.shortName ?? hoveredTileInfo.machineType} (${hoveredTileInfo.gx}, ${hoveredTileInfo.gz})`
        : `Grass (${hoveredTileInfo.gx}, ${hoveredTileInfo.gz})`;

  const allCatalogItems = Object.values(CAPYTORIO_ITEM_CATALOG).sort((a, b) => {
    const ca = CATEGORY_ORDER[a.category] ?? 9;
    const cb = CATEGORY_ORDER[b.category] ?? 9;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name);
  });
  const extraPocketIds = Object.keys(snap.pocketItems).filter(
    (id) => !CAPYTORIO_ITEM_CATALOG[id] && (snap.pocketItems[id] ?? 0) > 0
  );
  const inventoryItemList = [
    ...allCatalogItems,
    ...extraPocketIds.map((id) => getCapytorioItemMeta(id)),
  ];
  const totalPocketItemsCount = Object.values(snap.pocketItems).reduce<number>(
    (sum, v) => sum + (v ?? 0),
    0
  );
  const recentSlots = snap.recentTools.slice(0, 10);
  const groupRecipes =
    craftGroup === 'machines' || craftGroup === 'lua'
      ? []
      : pocketCraftableRecipes.filter((r) => r.group === craftGroup);
  const detailRecipe =
    groupRecipes.find((r) => r.id === selectedCraftRecipeId) ??
    pocketCraftableRecipes.find((r) => r.id === selectedCraftRecipeId) ??
    groupRecipes[0] ??
    pocketCraftableRecipes[0];

  const nextGoal = snap.milestones.find((ms) => !ms.completed);

  const toggleTab = (tab: Exclude<CapytorioDrawerTab, 'none'>) => {
    setIsDockCollapsed(false);
    setDrawerTab((prev) => (prev === tab ? 'none' : tab));
  };

  return (
    <>
      {/* CENTERED FACTORIO MODAL LAYER (sits above viewport, leaves bottom Quickbar directly clickable) */}
      {drawerTab !== 'none' && (
        <div
          className="fixed inset-x-0 top-10 bottom-[86px] z-20 flex items-center justify-center p-2 sm:p-4 bg-black/55 pointer-events-auto"
          onClick={() => setDrawerTab('none')}
        >
          {/* CHARACTER INVENTORY & CRAFTING WINDOW */}
          {(drawerTab === 'inventory' || drawerTab === 'craft') && (
            <div
              data-testid={`capytorio-drawer-${drawerTab}`}
              role="dialog"
              aria-label="Factorio Character Inventory and Crafting"
              onClick={(e) => e.stopPropagation()}
              className={`${FACTORIO_PANEL_FRAME} w-full max-w-[940px] max-h-full flex flex-col overflow-hidden text-[#e6e8ec]`}
            >
              {/* Window Title Bar */}
              <div className={`${FACTORIO_HEADER_BAR} flex-wrap`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold tracking-wider uppercase text-[#f4b054] whitespace-nowrap">
                    Character
                  </span>
                  <div className="hidden sm:flex flex-col gap-[2px] w-16 opacity-35" aria-hidden="true">
                    <span className="h-[1px] bg-[#9aa0ac]" />
                    <span className="h-[1px] bg-[#9aa0ac]" />
                    <span className="h-[1px] bg-[#9aa0ac]" />
                  </div>
                  {/* Mobile / narrow viewport pane switch */}
                  <div className="flex lg:hidden items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDrawerTab('inventory')}
                      className={`px-2 py-0.5 rounded-[2px] text-[10px] font-semibold cursor-pointer ${
                        drawerTab === 'inventory' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                      }`}
                    >
                      Inventory
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerTab('craft')}
                      className={`px-2 py-0.5 rounded-[2px] text-[10px] font-semibold cursor-pointer ${
                        drawerTab === 'craft' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                      }`}
                    >
                      Crafting
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    data-testid="capytorio-collect-outputs-btn"
                    onClick={onCollectAllOutputs}
                    className="h-6 px-2 rounded-[2px] bg-[#1e2d20] hover:bg-[#273c2a] border border-[#45b649]/70 text-[#86ef92] text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Collect{snap.spilledItemCount > 0 ? ` (+${snap.spilledItemCount})` : ' Outputs'}
                  </button>
                  <button
                    type="button"
                    data-testid="capytorio-feed-sci-btn"
                    onClick={onFeedScience}
                    className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer whitespace-nowrap ${
                      totalSciInPocket > 0
                        ? 'bg-[#3b2a14] hover:bg-[#4d371a] border border-[#e58926] text-[#ffd58a]'
                        : FACTORIO_BTN_IDLE
                    }`}
                  >
                    Feed Sci ({totalSciInPocket})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab('none')}
                    aria-label="Close Factorio Window"
                    className={`w-6 h-6 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Dual-Pane Body */}
              <div className="p-2.5 grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-y-auto min-h-0">
                {/* LEFT PANE: Inventory */}
                <div
                  className={`${
                    drawerTab === 'inventory' ? 'flex' : 'hidden lg:flex'
                  } lg:col-span-5 flex-col gap-2.5 ${FACTORIO_WELL} p-2.5`}
                >
                  <div className="flex items-center justify-between border-b border-[#2b2e35] pb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#f4b054]">
                      Inventory
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-[#9aa0ac]">
                      {totalPocketItemsCount} items
                    </span>
                  </div>

                  {/* Starter Kit Buildings */}
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-[#8e95a2] mb-1.5">
                      Starter Buildings (Click to Equip)
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {CAPYTORIO_HOTBAR_ORDER.map((mType) => {
                        const spec = CAPYTORIO_MACHINE_SPECS[mType];
                        const count = snap.pocketMachines[mType] ?? 0;
                        const isActive = snap.selectedTool === mType;
                        return (
                          <CapytorioSlotTile
                            key={mType}
                            testId={`capytorio-inv-machine-${mType}`}
                            label={spec.shortName}
                            title={`${spec.name} (x${count}) — Click to equip`}
                            count={count}
                            selected={isActive}
                            dimmed={count === 0 && !isActive}
                            machineType={mType}
                            color={hexToCss(spec.colorHex)}
                            onClick={() => {
                              onSelectTool(mType, true);
                              showToast(`Equipped ${spec.name}`);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Pocket Resources & Crafted Entities */}
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="text-[9px] font-mono uppercase tracking-wider text-[#8e95a2] mb-1.5">
                      Resources & Crafted Entities
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-1 max-h-[34vh] overflow-y-auto pr-0.5">
                      {inventoryItemList.map((meta) => {
                        const qty = snap.pocketItems[meta.id] ?? 0;
                        const placeable = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[meta.id];
                        const isEquipped = snap.selectedTool === meta.id;
                        const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                        return (
                          <CapytorioSlotTile
                            key={meta.id}
                            testId={`capytorio-inv-item-${meta.id}`}
                            label={meta.shortName}
                            title={`${meta.name}${placeable ? ' (Click to equip)' : ''}: ${qty}`}
                            count={qty}
                            selected={isEquipped}
                            dimmed={qty === 0 && !isEquipped}
                            machineType={placeable?.baseType}
                            itemShape={shape}
                            color={placeable?.tintHex ? hexToCss(placeable.tintHex) : meta.cssColor}
                            onClick={
                              placeable
                                ? () => {
                                    onSelectTool(meta.id, true);
                                    showToast(`Equipped ${meta.name} into Quickbar Slot 1`);
                                  }
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT PANE: Tabbed Crafting Workbench */}
                <div
                  className={`${
                    drawerTab === 'craft' ? 'flex' : 'hidden lg:flex'
                  } lg:col-span-7 flex-col justify-between gap-2 ${FACTORIO_WELL} p-2.5`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[#2b2e35] pb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#f4b054]">
                        Crafting
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-[#9aa0ac]">
                        {pocketCraftableRecipes.length} unlocked recipes
                      </span>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex flex-wrap gap-1">
                      {GROUP_TABS.map((tab) => {
                        const active = craftGroup === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            data-testid={`capytorio-craft-tab-${tab.id}`}
                            onClick={() => setCraftGroup(tab.id)}
                            className={`px-2 py-1 rounded-[2px] text-[10px] font-semibold cursor-pointer ${
                              active ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Category Grid */}
                    {craftGroup === 'machines' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {CAPYTORIO_HOTBAR_ORDER.map((mType) => {
                          const spec = CAPYTORIO_MACHINE_SPECS[mType];
                          const canAffordMachine = Object.entries(spec.craftCost).every(
                            ([id, amt]) => (snap.pocketItems[id] ?? 0) >= (amt ?? 0)
                          );
                          const costLabel = Object.entries(spec.craftCost)
                            .map(([id, amt]) => `${amt} ${getCapytorioItemMeta(id).shortName}`)
                            .join(' · ');
                          return (
                            <button
                              key={mType}
                              type="button"
                              data-testid={`capytorio-craft-machine-${mType}`}
                              onClick={() => onCraftMachine(mType)}
                              title={`Craft +1 ${spec.name} (${costLabel})`}
                              className={`p-1.5 rounded-[2px] border text-left cursor-pointer flex flex-col gap-1 transition-colors ${
                                canAffordMachine
                                  ? 'bg-[#171b18] hover:bg-[#222a24] border-[#315034] border-b-[#45b649] text-[#e6e8ec]'
                                  : 'bg-[#141518] hover:bg-[#1d1e22] border-[#392424] border-b-[#9a352c] text-[#9aa0ac]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CapytorioMachineIcon
                                  machineType={mType}
                                  color={hexToCss(spec.colorHex)}
                                  size={20}
                                  className="shrink-0"
                                />
                                <span className="text-[10px] font-semibold truncate">
                                  +1 {spec.shortName}
                                </span>
                              </div>
                              <div className="text-[9px] font-mono text-[#9aa0ac] truncate">
                                {costLabel}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : craftGroup === 'lua' ? (
                      <div className="p-2.5 rounded-[2px] bg-[#121417] border border-[#2d3038] space-y-2 text-[11px]">
                        <div className="font-mono text-[#d4d7de]">
                          Active .lua Catalog:{' '}
                          <span className="text-[#f4b054]">
                            {luaCatalogInfo.sourceMode === 'custom_override'
                              ? 'Custom Upload'
                              : luaCatalogInfo.sourceMode === 'live_server'
                                ? 'Live ./data/capytorio/*.lua'
                                : 'Bundled .lua'}
                          </span>{' '}
                          ({luaCatalogInfo.recipeCount} recipes · {luaCatalogInfo.techCount} techs)
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            ref={recipeLuaInputRef}
                            type="file"
                            accept=".lua,.txt"
                            data-testid="capytorio-upload-recipe-lua-input"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              const text = await file.text();
                              const info = setCustomCapytorioLuaSources(text, undefined);
                              setLuaCatalogInfo(info);
                              showToast(`Loaded recipe.lua (${info.recipeCount} recipes)`);
                            }}
                          />
                          <input
                            ref={techLuaInputRef}
                            type="file"
                            accept=".lua,.txt"
                            data-testid="capytorio-upload-tech-lua-input"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              const text = await file.text();
                              const info = setCustomCapytorioLuaSources(undefined, text);
                              setLuaCatalogInfo(info);
                              showToast(`Loaded technology.lua (${info.techCount} techs)`);
                            }}
                          />
                          <button
                            type="button"
                            data-testid="capytorio-reload-lua-btn"
                            onClick={async () => {
                              const info = await reloadCapytorioLuaFromServer(true);
                              setLuaCatalogInfo(info);
                              showToast(`Reloaded .lua (${info.recipeCount} recipes)`);
                            }}
                            className={`px-2.5 py-1 rounded-[2px] text-[10px] font-semibold cursor-pointer ${FACTORIO_BTN_IDLE}`}
                          >
                            Reload .lua
                          </button>
                          <button
                            type="button"
                            data-testid="capytorio-upload-recipe-lua-btn"
                            onClick={() => recipeLuaInputRef.current?.click()}
                            className={`px-2.5 py-1 rounded-[2px] text-[10px] font-semibold cursor-pointer ${FACTORIO_BTN_IDLE}`}
                          >
                            Load recipe.lua
                          </button>
                          <button
                            type="button"
                            data-testid="capytorio-upload-tech-lua-btn"
                            onClick={() => techLuaInputRef.current?.click()}
                            className={`px-2.5 py-1 rounded-[2px] text-[10px] font-semibold cursor-pointer ${FACTORIO_BTN_IDLE}`}
                          >
                            Load tech.lua
                          </button>
                          {luaCatalogInfo.sourceMode === 'custom_override' && (
                            <button
                              type="button"
                              data-testid="capytorio-reset-lua-btn"
                              onClick={async () => {
                                const info = await resetCustomCapytorioLuaSources();
                                setLuaCatalogInfo(info);
                                showToast('Restored default .lua files');
                              }}
                              className="px-2.5 py-1 rounded-[2px] bg-[#3a1c1c] hover:bg-[#4e2424] border border-[#d9483b]/70 text-[#fca5a5] text-[10px] font-semibold cursor-pointer"
                            >
                              Reset .lua
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 max-h-[36vh] overflow-y-auto pr-0.5">
                        {groupRecipes.map((rec) => {
                          const outMeta = getCapytorioItemMeta(rec.result);
                          const canAfford = rec.ingredients.every(
                            (i) => (snap.pocketItems[i.item] ?? 0) >= i.count
                          );
                          const isSelected = detailRecipe?.id === rec.id;
                          const placeable = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[rec.result];
                          const shape =
                            outMeta.shape ?? resolveCapytorioItemShape(outMeta.id, outMeta.category);
                          return (
                            <CapytorioSlotTile
                              key={rec.id}
                              testId={`capytorio-craft-recipe-${rec.id}`}
                              label={outMeta.shortName}
                              title={`${rec.name} (x${rec.resultCount}) — Click to craft 1`}
                              count={`×${rec.resultCount}`}
                              selected={isSelected}
                              accent={canAfford ? 'craftable' : 'missing'}
                              machineType={placeable?.baseType}
                              itemShape={shape}
                              color={placeable?.tintHex ? hexToCss(placeable.tintHex) : outMeta.cssColor}
                              onClick={() => {
                                setSelectedCraftRecipeId(rec.id);
                                onCraftRecipe(rec.id, 1, true);
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Selected Recipe Ingredient & Craft Bar */}
                  {detailRecipe && craftGroup !== 'machines' && craftGroup !== 'lua' && (
                    <div className="pt-2 border-t border-[#2b2e35] flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="font-bold text-[#f4b054] truncate">{detailRecipe.name}</span>
                        {detailRecipe.ingredients.map((ing) => {
                          const have = snap.pocketItems[ing.item] ?? 0;
                          const ok = have >= ing.count;
                          return (
                            <span
                              key={ing.item}
                              className={`px-1.5 py-0.5 rounded-[2px] font-mono tabular-nums border ${
                                ok
                                  ? 'bg-[#162518] border-[#45b649]/65 text-[#86ef92]'
                                  : 'bg-[#261616] border-[#d9483b]/65 text-[#f2857c]'
                              }`}
                            >
                              {have}/{ing.count} {getCapytorioItemMeta(ing.item).shortName}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onCraftRecipe(detailRecipe.id, 1, false)}
                          className="px-2.5 py-1 rounded-[2px] bg-[#243426] hover:bg-[#2f4532] border border-[#45b649]/75 text-[#86ef92] font-mono font-semibold cursor-pointer"
                        >
                          Craft 1
                        </button>
                        <button
                          type="button"
                          onClick={() => onCraftRecipe(detailRecipe.id, 5, false)}
                          className={`px-2.5 py-1 rounded-[2px] font-mono cursor-pointer ${FACTORIO_BTN_ACTIVE}`}
                        >
                          Craft 5
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TECHNOLOGY RESEARCH WINDOW */}
          {drawerTab === 'tech' && (
            <div
              data-testid="capytorio-drawer-tech"
              role="dialog"
              aria-label="Factorio Technology Research"
              onClick={(e) => e.stopPropagation()}
              className={`${FACTORIO_PANEL_FRAME} w-full max-w-[820px] max-h-full flex flex-col overflow-hidden text-[#e6e8ec]`}
            >
              <div className={FACTORIO_HEADER_BAR}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-bold tracking-wider uppercase text-[#f4b054]">
                    Technology
                  </span>
                  {activeTech && (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-medium text-[#e4e6eb] truncate">
                        {activeTech.name}
                      </span>
                      <div className="w-24 h-2.5 rounded-[1px] bg-[#121317] border border-[#3a3e48] overflow-hidden shrink-0">
                        <div
                          className="h-full bg-[#45b649]"
                          style={{ width: `${Math.round(snap.activeTechProgress * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-[#86ef92]">
                        {Math.round(snap.activeTechProgress * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-testid="capytorio-feed-sci-btn"
                    onClick={onFeedScience}
                    className={`h-6 px-2.5 rounded-[2px] text-[10px] font-semibold cursor-pointer whitespace-nowrap ${
                      totalSciInPocket > 0 ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                    }`}
                  >
                    Feed Sci ({totalSciInPocket})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab('none')}
                    aria-label="Close Technology Window"
                    className={`w-6 h-6 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-2.5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {CAPYTORIO_TECHS.map((tech) => {
                  const completed = snap.unlockedTechs.includes(tech.id);
                  const isActive = snap.activeTechId === tech.id;
                  const prereqsMet = tech.prerequisites.every((p) =>
                    snap.unlockedTechs.includes(p)
                  );
                  const costStr = Object.entries(tech.cost)
                    .map(([id, amt]) => `${amt} ${getCapytorioItemMeta(id).shortName}`)
                    .join(' · ');
                  return (
                    <button
                      key={tech.id}
                      type="button"
                      data-testid={`capytorio-tech-${tech.id}`}
                      onClick={() => onSelectTech(tech.id)}
                      className={`p-2.5 rounded-[2px] border text-left cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#3b2913] border-[#e58926] text-[#ffe4b5]'
                          : completed
                            ? 'bg-[#17281a] border-[#45b649]/70 text-[#9df2a5]'
                            : prereqsMet
                              ? 'bg-[#16181c] hover:bg-[#23262d] border-[#3d414b] text-[#e4e6eb]'
                              : 'bg-[#121417] border-[#262930] text-[#7c8391]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold truncate">{tech.name}</span>
                        <span
                          className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-[2px] shrink-0 ${
                            isActive
                              ? 'bg-[#e58926] text-[#151618]'
                              : completed && !tech.repeatable
                                ? 'bg-[#214226] text-[#86ef92]'
                                : prereqsMet
                                  ? 'bg-[#2b2e35] text-[#d4d7de]'
                                  : 'bg-[#1a1c21] text-[#6d7380]'
                          }`}
                        >
                          {isActive
                            ? 'Active'
                            : completed && !tech.repeatable
                              ? 'Done'
                              : prereqsMet
                                ? 'Start'
                                : 'Locked'}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#a3aab7] truncate mt-1">
                        {tech.effectSummary}
                      </div>
                      <div className="text-[9px] font-mono text-[#f4b054] mt-1 truncate">
                        {costStr}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* MACHINE & UNIVERSAL ENTITY INSPECTOR WINDOW */}
          {drawerTab === 'inspect' && (
            <div
              data-testid="capytorio-drawer-inspect"
              role="dialog"
              aria-label="Factorio Entity Inspector"
              onClick={(e) => e.stopPropagation()}
              className={`${FACTORIO_PANEL_FRAME} w-full max-w-[680px] max-h-full flex flex-col overflow-hidden text-[#e6e8ec]`}
            >
              <div className={FACTORIO_HEADER_BAR}>
                <div className="flex items-center gap-2 min-w-0">
                  {inspected ? (
                    <CapytorioMachineIcon
                      machineType={inspected.type}
                      color={hexToCss(inspectedSpec?.tintHex ?? CAPYTORIO_MACHINE_SPECS[inspected.type].colorHex)}
                      size={18}
                      className="shrink-0"
                    />
                  ) : inspectedTile?.tree ? (
                    <CapytorioWorldIcon kind="tree" size={18} className="shrink-0" />
                  ) : inspectedTile?.resource ? (
                    (() => {
                      const meta = getCapytorioItemMeta(inspectedTile.resource.id);
                      const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                      return (
                        <CapytorioItemIcon
                          shape={shape}
                          color={meta.cssColor}
                          size={18}
                          className="shrink-0"
                        />
                      );
                    })()
                  ) : inspectedTile?.isBeacon ? (
                    <CapytorioWorldIcon kind="beacon" size={18} className="shrink-0" />
                  ) : (
                    <CapytorioWorldIcon kind="terrain" size={18} className="shrink-0" />
                  )}
                  <span className="text-xs font-bold tracking-wider uppercase text-[#f4b054] truncate">
                    {inspected
                      ? `${inspectedSpec?.name ?? CAPYTORIO_MACHINE_SPECS[inspected.type].name} (${inspected.gx}, ${inspected.gz})`
                      : inspectedTile
                        ? `${inspectedTile.title} (${inspectedTile.gx}, ${inspectedTile.gz})`
                        : 'Entity Inspector'}
                  </span>
                  {inspected && (
                    <span className="text-[10px] font-mono text-[#9aa0ac] shrink-0">
                      Facing {DIR_LABELS[inspected.dir] ?? 'E'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerTab('none')}
                  aria-label="Close Entity Inspector"
                  className={`w-6 h-6 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2.5 space-y-2.5 overflow-y-auto">
                {inspected ? (
                  <div className={`${FACTORIO_WELL} p-2.5 space-y-2.5`}>
                    {/* Progress / Burn / Belt Gauge */}
                    {inspectedTile?.machine &&
                    (inspected.type === 'belt' ||
                      inspected.type === 'splitter' ||
                      inspected.type === 'tunnel') ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[#c4c9d4]">
                          <span>
                            Items on {inspected.type}:{' '}
                            <strong className="text-[#f4b054]">
                              {inspectedTile.machine.beltItemCount} /{' '}
                              {inspectedTile.machine.beltCapacity}
                            </strong>
                          </span>
                          <span>
                            L {inspectedTile.machine.beltLeftLaneCount}/
                            {inspectedTile.machine.beltLeftLaneCapacity} · R{' '}
                            {inspectedTile.machine.beltRightLaneCount}/
                            {inspectedTile.machine.beltRightLaneCapacity}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-[1px] bg-[#0e1013] border border-[#30343d] overflow-hidden">
                          <div
                            className="h-full bg-[#e58926]"
                            style={{
                              width: `${
                                inspectedTile.machine.beltCapacity > 0
                                  ? Math.min(
                                      100,
                                      Math.round(
                                        (inspectedTile.machine.beltItemCount /
                                          inspectedTile.machine.beltCapacity) *
                                          100
                                      )
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        {inspectedTile.machine.beltItemsByType.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {inspectedTile.machine.beltItemsByType.map((entry) => {
                              const meta = getCapytorioItemMeta(entry.item);
                              const shape =
                                meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                              return (
                                <CapytorioSlotTile
                                  key={entry.item}
                                  compact
                                  label={meta.shortName}
                                  title={`${meta.name}: ${entry.count}`}
                                  count={entry.count}
                                  itemShape={shape}
                                  color={meta.cssColor}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[#c4c9d4]">
                          <span>
                            {inspected.type === 'generator'
                              ? inspected.fuelTimer > 0
                                ? `Burning Fuel · 6.0 MW (${inspected.fuelTimer.toFixed(1)}s)`
                                : 'Idle · 1.5 MW (Feed Coal/Orange for 6.0 MW)'
                              : `Craft Progress: ${Math.round(inspected.craftProgress * 100)}%`}
                          </span>
                          <span>
                            In {inspected.inputTotal} · Out {inspected.outputTotal}
                            {inspected.beltItemCount > 0 ? ` · Belt ${inspected.beltItemCount}` : ''}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-[1px] bg-[#0e1013] border border-[#30343d] overflow-hidden">
                          <div
                            className={inspected.type === 'generator' ? 'h-full bg-[#e58926]' : 'h-full bg-[#45b649]'}
                            style={{
                              width: `${
                                inspected.type === 'generator'
                                  ? Math.min(100, Math.round((inspected.fuelTimer / 14) * 100))
                                  : Math.round(inspected.craftProgress * 100)
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Input / Output Slot Wells */}
                    {(inspected.inputTotal > 0 || inspected.outputTotal > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-2 rounded-[2px] bg-[#121417] border border-[#282b33]">
                          <div className="text-[9px] font-mono uppercase text-[#8e95a2] mb-1">
                            Input Buffer
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(inspected.inputBuffer).filter(([, v]) => (v ?? 0) > 0).length > 0 ? (
                              Object.entries(inspected.inputBuffer)
                                .filter(([, v]) => (v ?? 0) > 0)
                                .map(([id, qty]) => {
                                  const meta = getCapytorioItemMeta(id);
                                  const shape = meta.shape ?? resolveCapytorioItemShape(id, meta.category);
                                  return (
                                    <CapytorioSlotTile
                                      key={id}
                                      compact
                                      label={meta.shortName}
                                      title={`${meta.name}: ${qty}`}
                                      count={qty}
                                      itemShape={shape}
                                      color={meta.cssColor}
                                    />
                                  );
                                })
                            ) : (
                              <span className="text-[10px] text-[#6d7380]">Empty</span>
                            )}
                          </div>
                        </div>

                        <div className="p-2 rounded-[2px] bg-[#121417] border border-[#282b33]">
                          <div className="text-[9px] font-mono uppercase text-[#8e95a2] mb-1">
                            Output Buffer
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(inspected.outputBuffer).filter(([, v]) => (v ?? 0) > 0).length > 0 ? (
                              Object.entries(inspected.outputBuffer)
                                .filter(([, v]) => (v ?? 0) > 0)
                                .map(([id, qty]) => {
                                  const meta = getCapytorioItemMeta(id);
                                  const shape = meta.shape ?? resolveCapytorioItemShape(id, meta.category);
                                  return (
                                    <CapytorioSlotTile
                                      key={id}
                                      compact
                                      label={meta.shortName}
                                      title={`${meta.name}: ${qty}`}
                                      count={qty}
                                      itemShape={shape}
                                      color={meta.cssColor}
                                    />
                                  );
                                })
                            ) : (
                              <span className="text-[10px] text-[#6d7380]">Empty</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      {inspected.type === 'generator' && (
                        <button
                          type="button"
                          data-testid="capytorio-inspect-fuel-btn"
                          onClick={() => onFuelGenerator(inspected.gx, inspected.gz)}
                          className={`px-2.5 py-1 rounded-[2px] cursor-pointer flex items-center gap-1 ${FACTORIO_BTN_ACTIVE}`}
                        >
                          <Flame className="w-3 h-3 shrink-0" />
                          <span>Feed Fuel (+5)</span>
                        </button>
                      )}

                      {(inspected.type === 'furnace' ||
                        inspected.type === 'assembler' ||
                        inspected.type === 'lab') && (
                        <button
                          type="button"
                          data-testid="capytorio-inspect-load-btn"
                          onClick={() => onInsertInputs(inspected.gx, inspected.gz)}
                          className={`px-2.5 py-1 rounded-[2px] font-semibold cursor-pointer ${FACTORIO_BTN_IDLE}`}
                        >
                          Load Inputs [F]
                        </button>
                      )}

                      {(inspected.outputTotal > 0 || inspected.beltItemCount > 0) && (
                        <button
                          type="button"
                          data-testid="capytorio-inspect-take-btn"
                          onClick={() => onTakeOutputs(inspected.gx, inspected.gz)}
                          className="px-2.5 py-1 rounded-[2px] bg-[#1e2d20] hover:bg-[#273c2a] border border-[#45b649]/75 text-[#86ef92] font-semibold cursor-pointer"
                        >
                          Take Outputs ({inspected.outputTotal + inspected.beltItemCount})
                        </button>
                      )}

                      <button
                        type="button"
                        data-testid="capytorio-inspect-rotate-btn"
                        onClick={() => onRotateMachineAt(inspected.gx, inspected.gz)}
                        className={`px-2.5 py-1 rounded-[2px] font-mono cursor-pointer ${FACTORIO_BTN_IDLE}`}
                      >
                        Rotate
                      </button>
                    </div>
                  </div>
                ) : inspectedTile ? (
                  <div className={`${FACTORIO_WELL} p-2.5 space-y-2 text-[11px]`}>
                    <div className="text-[#c4c9d4]">{inspectedTile.subtitle}</div>
                    {inspectedTile.resource && (
                      <div className="flex items-center justify-between font-mono tabular-nums">
                        <span className="text-[#9aa0ac]">Remaining Ore:</span>
                        <span className="text-[#f4b054] font-bold">
                          {inspectedTile.resource.remaining.toLocaleString()} {inspectedTile.resource.name}
                        </span>
                      </div>
                    )}
                    {inspectedTile.tree && (
                      <div className="flex items-center justify-between font-mono tabular-nums">
                        <span className="text-[#9aa0ac]">Harvest Yield:</span>
                        <span className="text-[#ffe4b5] font-bold">
                          +{inspectedTile.tree.yieldCount} Fresh Orange
                        </span>
                      </div>
                    )}
                    {inspectedTile.spilledTotalCount > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {inspectedTile.spilledItems.map((entry) => {
                          const meta = getCapytorioItemMeta(entry.item);
                          const shape =
                            meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                          return (
                            <CapytorioSlotTile
                              key={entry.item}
                              compact
                              label={meta.shortName}
                              title={`${meta.name}: ${entry.count}`}
                              count={entry.count}
                              itemShape={shape}
                              color={meta.cssColor}
                            />
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 pt-1">
                      {(inspectedTile.resource || inspectedTile.tree) && (
                        <button
                          type="button"
                          onClick={() => onMineTileAt(inspectedTile.gx, inspectedTile.gz)}
                          className={`px-2.5 py-1 rounded-[2px] text-[10px] cursor-pointer ${FACTORIO_BTN_ACTIVE}`}
                        >
                          {inspectedTile.tree ? 'Chop Tree (+3 Orange)' : 'Hand Mine (+2 Ore)'}
                        </button>
                      )}
                      {inspectedTile.spilledTotalCount > 0 && (
                        <button
                          type="button"
                          onClick={onCollectAllOutputs}
                          className={`px-2.5 py-1 rounded-[2px] text-[10px] cursor-pointer ${FACTORIO_BTN_ACTIVE}`}
                        >
                          Collect Floor Items
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9aa0ac] px-1">
                    Click or hover any building, belt, ore seam, citrus tree, or tile on the meadow to inspect it.
                  </p>
                )}

                {(!inspected || inspected.type === 'assembler') && (
                  <div className={`${FACTORIO_WELL} p-2.5`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#f4b054] mb-1.5">
                      Assembler Recipe
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                      {assemblerRecipes.map((rec) => {
                        const outMeta = getCapytorioItemMeta(rec.result);
                        const shape =
                          outMeta.shape ?? resolveCapytorioItemShape(outMeta.id, outMeta.category);
                        const isSel =
                          (inspected?.type === 'assembler'
                            ? inspected.recipeId
                            : snap.selectedRecipeId) === rec.id;
                        return (
                          <CapytorioSlotTile
                            key={rec.id}
                            testId={`capytorio-assembler-recipe-${rec.id}`}
                            label={outMeta.shortName}
                            title={`Assign Assembler Recipe: ${rec.name}`}
                            selected={isSel}
                            itemShape={shape}
                            color={outMeta.cssColor}
                            onClick={() => onSelectAssemblerRecipe(rec.id as CapytorioRecipeId)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FACTORIO BOTTOM-RIGHT LIVE ENTITY / TILE INFO WINDOW */}
      {drawerTab === 'none' && activeInfoTarget && (
        <CapytorioEntityInfoPanel
          info={activeInfoTarget}
          isPinned={isInfoPinned}
          isDockCollapsed={isDockCollapsed}
          onClearPin={onClearInspection}
          onOpenMachineModal={(gx, gz) => {
            onInspectTileAt(gx, gz);
            setIsDockCollapsed(false);
            setDrawerTab('inspect');
          }}
          onRotateMachineAt={onRotateMachineAt}
          onMineTileAt={onMineTileAt}
          onCollectAllOutputs={onCollectAllOutputs}
        />
      )}

      {/* SINGLE COMPACT BOTTOM FACTORIO QUICKBAR DOCK */}
      <section
        data-testid="capytorio-build-bar"
        aria-label="Capytorio Factorio Quickbar"
        className="fixed bottom-1.5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[calc(100vw-12px)] md:max-w-[calc(100vw-240px)] lg:max-w-[960px] text-[#e6e8ec]"
      >
        <div className={`${FACTORIO_PANEL_FRAME} overflow-hidden`}>
          {/* Slim Top Utility Strip (Power, Tech, Milestone, Tile + Camera/Spill/Collapse) */}
          <div className="px-2 h-7 bg-[#282b32] border-b border-[#121317] flex items-center justify-between gap-2 text-[10px] tabular-nums">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden font-mono">
              <span
                data-testid="capytorio-power-readout"
                className={
                  effPct >= 95
                    ? 'text-[#5cd660] font-semibold whitespace-nowrap'
                    : effPct >= 60
                      ? 'text-[#f4b054] font-semibold whitespace-nowrap'
                      : 'text-[#e85d50] font-semibold whitespace-nowrap'
                }
              >
                {snap.powerSupplyMw.toFixed(1)}/{snap.powerDemandMw.toFixed(1)} MW{' '}
                <span className="hidden sm:inline">({effPct}%)</span>
              </span>
              <span className="hidden sm:inline text-[#4e5360]" aria-hidden="true">|</span>
              <span className="hidden sm:inline text-[#f4b054] truncate max-w-[140px]">
                {activeTech
                  ? `${activeTech.name} ${Math.round(snap.activeTechProgress * 100)}%`
                  : 'All Techs Complete'}
              </span>
              <span className="hidden md:inline text-[#4e5360]" aria-hidden="true">|</span>
              <span className="hidden md:inline text-[#9aa0ac] truncate max-w-[155px]">
                {hoveredTileLabel}
              </span>
              <span
                data-testid="capytorio-milestone-badge"
                title={nextGoal ? nextGoal.hint : 'All Factory Milestones Achieved!'}
                className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-[#16181c] border border-[#3a3e48] text-[9px] text-[#ffe1ad] font-sans font-medium max-w-[185px] truncate"
              >
                <Check className="w-2.5 h-2.5 shrink-0 text-[#45b649]" />
                <span className="truncate">
                  {snap.milestonesCompletedCount}/{snap.milestones.length}:{' '}
                  {nextGoal ? nextGoal.label : 'Rocket Ready'}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-testid="capytorio-belt-spill-btn"
                onClick={onToggleBeltEndSpill}
                title={
                  beltEndSpillEnabled
                    ? 'Belt End Item Spill: ON (items tumble off open belt ends onto ground)'
                    : 'Belt End Item Spill: OFF (items squish at open belt ends without spilling)'
                }
                className={`h-5 px-1.5 rounded-[2px] text-[9px] font-mono font-semibold whitespace-nowrap cursor-pointer ${
                  beltEndSpillEnabled ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                }`}
              >
                Spill: {beltEndSpillEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                data-testid="capytorio-zoom-out-btn"
                aria-label="Zoom Out Camera"
                onClick={() => onAdjustZoom(-0.24)}
                className={`h-5 w-5 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                data-testid="capytorio-zoom-in-btn"
                aria-label="Zoom In Camera"
                onClick={() => onAdjustZoom(0.24)}
                className={`h-5 w-5 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                data-testid="capytorio-camera-mode-btn"
                onClick={onToggleCameraMode}
                title="Toggle 68° Factorio Overhead / 3D Chase [V]"
                className={`h-5 px-1.5 rounded-[2px] text-[9px] font-mono font-semibold whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  isObliqueCam
                    ? 'bg-[#3d2a13] border border-[#e58926] text-[#ffe1ad]'
                    : FACTORIO_BTN_IDLE
                }`}
              >
                <Camera className="w-2.5 h-2.5 shrink-0" />
                <span>{isObliqueCam ? '68° [V]' : '3D [V]'}</span>
              </button>
              <button
                type="button"
                data-testid="capytorio-beacon-btn"
                onClick={onReturnToBeacon}
                title="Warp to Survey Beacon [H]"
                className={`h-5 w-5 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
              >
                <Home className="w-3 h-3" />
              </button>
              <button
                type="button"
                data-testid="capytorio-collapse-btn"
                aria-label={isDockCollapsed ? 'Expand Quickbar' : 'Collapse Quickbar'}
                onClick={() => setIsDockCollapsed((prev) => !prev)}
                className={`h-5 w-5 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
              >
                {isDockCollapsed ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Unified Single-Row Factorio Quickbar */}
          {!isDockCollapsed && (
            <div
              data-testid="capytorio-toolbar"
              className="px-1.5 py-1.5 bg-[#1d1f24] flex items-center justify-between gap-1.5 overflow-x-auto"
            >
              {/* Left Action Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="capytorio-tool-mine"
                  title="Hand Mine / Inspect [E]"
                  onClick={onMineAction}
                  className={`h-11 px-2 rounded-[2px] text-[10px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                    snap.selectedTool === 'mine' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                  }`}
                >
                  <span>Mine</span>
                  <span className="text-[9px] font-mono opacity-80">[E]</span>
                </button>

                <button
                  type="button"
                  data-testid="capytorio-tool-demolish"
                  title="Demolish Machine [X]"
                  onClick={() => onSelectTool('demolish')}
                  className={`h-11 px-2 rounded-[2px] text-[10px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                    snap.selectedTool === 'demolish'
                      ? 'bg-[#6b201c] border border-[#e05b50] text-[#ffe4e2] font-bold'
                      : FACTORIO_BTN_IDLE
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="text-[9px] font-mono opacity-80">[X]</span>
                </button>

                <button
                  type="button"
                  data-testid="capytorio-rotate-btn"
                  title="Rotate Placement Direction [R]"
                  onClick={onRotateDir}
                  className={`h-11 px-2 rounded-[2px] text-[10px] font-mono font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${FACTORIO_BTN_IDLE}`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{dirLabel} [R]</span>
                </button>
              </div>

              <div className="w-[2px] h-8 bg-[#111216] border-r border-[#3b3f4a] shrink-0" aria-hidden="true" />

              {/* Center 10-Slot Square Factorio Quickbar */}
              <div className="flex items-center gap-1 shrink-0">
                {recentSlots.map((toolId, slotIdx) => {
                  const resolved = resolveCapytorioPlaceableSpec(toolId);
                  if (!resolved) return null;
                  const hotkey = slotIdx === 9 ? '0' : String(slotIdx + 1);
                  const count = resolved.isBaseMachine
                    ? snap.pocketMachines[resolved.baseType] ?? 0
                    : snap.pocketItems[resolved.id] ?? 0;
                  const selected = snap.selectedTool === toolId;
                  return (
                    <CapytorioSlotTile
                      key={toolId}
                      compact
                      recentSlot
                      testId={`capytorio-tool-${toolId}`}
                      label={resolved.shortName}
                      title={`${resolved.name} [${hotkey}] — ${resolved.description}`}
                      hotkey={hotkey}
                      count={count}
                      selected={selected}
                      dimmed={count === 0 && !selected}
                      machineType={resolved.baseType}
                      color={hexToCss(resolved.tintHex)}
                      onClick={() => onSelectTool(toolId, false)}
                    />
                  );
                })}
              </div>

              <div className="w-[2px] h-8 bg-[#111216] border-r border-[#3b3f4a] shrink-0" aria-hidden="true" />

              {/* Right Modal Triggers */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="capytorio-drawer-inventory-btn"
                  title="Open Character Inventory [I]"
                  onClick={() => toggleTab('inventory')}
                  className={`h-11 px-2 rounded-[2px] text-[10px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                    drawerTab === 'inventory' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Inv [I]</span>
                </button>

                <button
                  type="button"
                  data-testid="capytorio-drawer-craft-btn"
                  title="Open Crafting Workbench"
                  onClick={() => toggleTab('craft')}
                  className={`h-11 px-2 rounded-[2px] text-[10px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                    drawerTab === 'craft' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                  }`}
                >
                  <Hammer className="w-3.5 h-3.5" />
                  <span>Craft</span>
                </button>

                <button
                  type="button"
                  data-testid="capytorio-drawer-tech-btn"
                  title="Open Technology Tree"
                  onClick={() => toggleTab('tech')}
                  className={`h-11 px-2 rounded-[2px] text-[10px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                    drawerTab === 'tech' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                  }`}
                >
                  <span className="text-[10px] font-bold">Tech</span>
                  <span className="text-[9px] font-mono opacity-80">
                    {Math.round(snap.activeTechProgress * 100)}%
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="capytorio-drawer-inspect-btn"
                  title="Inspect Selected Tile or Building"
                  onClick={() => toggleTab('inspect')}
                  className={`h-11 px-2 rounded-[2px] text-[10px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                    drawerTab === 'inspect' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                  }`}
                >
                  <span className="text-[10px] font-bold">Inspect</span>
                  <span className="text-[9px] font-mono opacity-80">
                    {inspectedTile ? `${inspectedTile.gx},${inspectedTile.gz}` : '—'}
                  </span>
                </button>

                {(snap.pocketItems.rocket_part ?? 0) > 0 && (
                  <button
                    type="button"
                    data-testid="capytorio-launch-rocket-btn"
                    onClick={onLaunchRocket}
                    className={`h-11 px-2 rounded-[2px] text-[10px] whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${FACTORIO_BTN_ACTIVE}`}
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Launch</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};
