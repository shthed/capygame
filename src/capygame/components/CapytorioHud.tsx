import React, { useRef, useState } from 'react';
import {
  Copy,
  Flame,
  Hammer,
  Menu,
  Package,
  Rocket,
  RotateCcw,
  Scissors,
  Search,
  Settings,
  Undo2,
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
  type CapytorioClipboardToolState,
  type CapytorioSelectionShape,
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
  isTopBarVisible: boolean;
  onToggleTopBar: () => void;
  onOpenSettings: () => void;
  pointerHoverActive: boolean;
  drawerTab: CapytorioDrawerTab;
  setDrawerTab: React.Dispatch<React.SetStateAction<CapytorioDrawerTab>>;
  craftGroup: CapytorioCraftGroupTab;
  setCraftGroup: (group: CapytorioCraftGroupTab) => void;
  selectedCraftRecipeId: string;
  setSelectedCraftRecipeId: (id: string) => void;
  luaCatalogInfo: CapytorioLuaCatalogInfo;
  setLuaCatalogInfo: (info: CapytorioLuaCatalogInfo) => void;
  onSelectTool: (toolId: string, promoteToRecent?: boolean) => void;
  onMineTileAt: (gx: number, gz: number) => void;
  onInspectTileAt: (gx: number, gz: number) => void;
  onClearInspection: () => void;
  onDemolishMachineAt: (gx: number, gz: number) => void;
  onRotateDir: () => void;
  onSetClipboardMode: (mode: CapytorioClipboardToolState, shape?: CapytorioSelectionShape) => void;
  onClearClipboard: () => void;
  onUndoCut: () => void;
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
  isTopBarVisible,
  onToggleTopBar,
  onOpenSettings,
  pointerHoverActive,
  drawerTab,
  setDrawerTab,
  craftGroup,
  setCraftGroup,
  selectedCraftRecipeId,
  setSelectedCraftRecipeId,
  luaCatalogInfo,
  setLuaCatalogInfo,
  onSelectTool,
  onMineTileAt,
  onInspectTileAt,
  onClearInspection,
  onDemolishMachineAt,
  onRotateDir,
  onSetClipboardMode,
  onClearClipboard,
  onUndoCut,
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
  const [selectedCraftMachineType, setSelectedCraftMachineType] =
    useState<CapytorioMachineType>(CAPYTORIO_HOTBAR_ORDER[0]);
  const [focusedInvText, setFocusedInvText] = useState<string | null>(null);

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
  const dirLabel = DIR_LABELS[inspected ? inspected.dir : snap.selectedDir] ?? 'E';
  const inspectedTile = snap.inspectedTile;
  const activeInfoTarget = pointerHoverActive
    ? snap.hoveredTileInfo
    : inspectedTile ?? snap.hoveredTileInfo;
  const isInfoPinned = !pointerHoverActive && inspectedTile !== null;
  const clip = snap.clipboard;
  const isClipboardActive = clip.toolState !== 'off';

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

  const toggleTab = (tab: Exclude<CapytorioDrawerTab, 'none'>) => {
    setDrawerTab((prev) => (prev === tab ? 'none' : tab));
  };

  return (
    <>
      {/* TOP-RIGHT COMPACT FACTORIO MENU STRIP (Tech, Settings, Menu to reveal top bar) */}
      <div
        data-testid="capytorio-top-right-menu"
        aria-label="Factorio Top-Right Menu"
        className={`fixed right-2 z-30 pointer-events-auto transition-[top] duration-150 ${
          isTopBarVisible ? 'top-[48px]' : 'top-2'
        }`}
      >
        <div className={`${FACTORIO_PANEL_FRAME} p-0.5 flex items-center gap-1 text-[#e6e8ec]`}>
          <button
            type="button"
            data-testid="capytorio-drawer-tech-btn"
            title="Technology Research"
            onClick={() => toggleTab('tech')}
            className={`h-6 px-2 rounded-[2px] text-[10px] font-mono font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              drawerTab === 'tech' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
            }`}
          >
            <span>Tech</span>
            <span className="opacity-80">{Math.round(snap.activeTechProgress * 100)}%</span>
          </button>

          <button
            type="button"
            data-testid="capytorio-open-settings-btn"
            title="Factory & World Settings"
            aria-label="Open Settings"
            onClick={onOpenSettings}
            className={`h-6 w-6 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="capytorio-toggle-topbar-btn"
            title={isTopBarVisible ? 'Hide Top Bar' : 'Show World & Scale Top Bar'}
            aria-label={isTopBarVisible ? 'Hide Top Bar' : 'Show Top Bar'}
            aria-expanded={isTopBarVisible}
            onClick={onToggleTopBar}
            className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              isTopBarVisible ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
            }`}
          >
            <Menu className="w-3 h-3 shrink-0" />
            <span>Menu</span>
          </button>
        </div>
      </div>

      {/* CENTERED FACTORIO MODAL LAYER (sits above viewport, leaves bottom Quickbar directly clickable) */}
      {drawerTab !== 'none' && (
        <div
          className={`fixed inset-x-0 ${
            isTopBarVisible ? 'top-10' : 'top-0'
          } bottom-[54px] z-20 flex items-center justify-center p-2 sm:p-4 bg-black/55 pointer-events-auto`}
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
                  <span
                    data-testid="capytorio-power-readout"
                    className={`text-[10px] font-mono tabular-nums font-semibold whitespace-nowrap ${
                      effPct >= 95
                        ? 'text-[#5cd660]'
                        : effPct >= 60
                          ? 'text-[#f4b054]'
                          : 'text-[#e85d50]'
                    }`}
                  >
                    {snap.powerSupplyMw.toFixed(1)}/{snap.powerDemandMw.toFixed(1)} MW ({effPct}%)
                  </span>
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
                  <div className="flex items-center justify-between gap-2 border-b border-[#2b2e35] pb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#f4b054]">
                      Inventory
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-[#9aa0ac] truncate">
                      {focusedInvText ?? `${totalPocketItemsCount} items`}
                    </span>
                  </div>

                  {/* Starter Kit Buildings */}
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-[#8e95a2] mb-1.5">
                      Starter Buildings (Click to Equip)
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,36px)] gap-1">
                      {CAPYTORIO_HOTBAR_ORDER.map((mType) => {
                        const spec = CAPYTORIO_MACHINE_SPECS[mType];
                        const count = snap.pocketMachines[mType] ?? 0;
                        const isActive = snap.selectedTool === mType;
                        return (
                          <div
                            key={mType}
                            onMouseEnter={() => setFocusedInvText(`${spec.name} ×${count}`)}
                            onMouseLeave={() => setFocusedInvText(null)}
                          >
                            <CapytorioSlotTile
                              mini
                              testId={`capytorio-inv-machine-${mType}`}
                              label={spec.shortName}
                              title={`${spec.name} (×${count}) — Click to equip`}
                              count={count}
                              selected={isActive}
                              dimmed={count === 0 && !isActive}
                              machineType={mType}
                              color={hexToCss(spec.colorHex)}
                              onClick={() => {
                                setFocusedInvText(`${spec.name} ×${count}`);
                                onSelectTool(mType, true);
                                showToast(`Equipped ${spec.name}`);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pocket Resources & Crafted Entities */}
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="text-[9px] font-mono uppercase tracking-wider text-[#8e95a2] mb-1.5">
                      Resources & Crafted Entities
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,36px)] gap-1 max-h-[38vh] overflow-y-auto pr-0.5">
                      {inventoryItemList.map((meta) => {
                        const qty = snap.pocketItems[meta.id] ?? 0;
                        const placeable = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[meta.id];
                        const isEquipped = snap.selectedTool === meta.id;
                        const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                        return (
                          <div
                            key={meta.id}
                            onMouseEnter={() => setFocusedInvText(`${meta.name} ×${qty}`)}
                            onMouseLeave={() => setFocusedInvText(null)}
                          >
                            <CapytorioSlotTile
                              mini
                              testId={`capytorio-inv-item-${meta.id}`}
                              label={meta.shortName}
                              title={`${meta.name}${placeable ? ' (Click to equip)' : ''}: ${qty}`}
                              count={qty}
                              selected={isEquipped}
                              dimmed={qty === 0 && !isEquipped}
                              machineType={placeable?.baseType}
                              itemShape={shape}
                              color={placeable?.tintHex ? hexToCss(placeable.tintHex) : meta.cssColor}
                              onClick={() => {
                                setFocusedInvText(`${meta.name} ×${qty}`);
                                if (placeable) {
                                  onSelectTool(meta.id, true);
                                  showToast(`Equipped ${meta.name} into Quickbar Slot 1`);
                                }
                              }}
                            />
                          </div>
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
                      <div className="grid grid-cols-[repeat(auto-fill,36px)] gap-1 max-h-[36vh] overflow-y-auto pr-0.5">
                        {CAPYTORIO_HOTBAR_ORDER.map((mType) => {
                          const spec = CAPYTORIO_MACHINE_SPECS[mType];
                          const canAffordMachine = Object.entries(spec.craftCost).every(
                            ([id, amt]) => (snap.pocketItems[id] ?? 0) >= (amt ?? 0)
                          );
                          const costLabel = Object.entries(spec.craftCost)
                            .map(([id, amt]) => `${amt} ${getCapytorioItemMeta(id).shortName}`)
                            .join(' · ');
                          return (
                            <CapytorioSlotTile
                              key={mType}
                              mini
                              testId={`capytorio-craft-machine-${mType}`}
                              label={spec.shortName}
                              title={`Craft +1 ${spec.name} (${costLabel})`}
                              count="×1"
                              selected={selectedCraftMachineType === mType}
                              accent={canAffordMachine ? 'craftable' : 'missing'}
                              machineType={mType}
                              color={hexToCss(spec.colorHex)}
                              onClick={() => {
                                setSelectedCraftMachineType(mType);
                                onCraftMachine(mType);
                              }}
                            />
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
                      <div className="grid grid-cols-[repeat(auto-fill,36px)] gap-1 max-h-[36vh] overflow-y-auto pr-0.5">
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
                              mini
                              testId={`capytorio-craft-recipe-${rec.id}`}
                              label={outMeta.shortName}
                              title={`${rec.name} (×${rec.resultCount}) — Click to craft 1`}
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

                  {/* Selected Building Ingredient & Craft Bar */}
                  {craftGroup === 'machines' && (() => {
                    const spec = CAPYTORIO_MACHINE_SPECS[selectedCraftMachineType];
                    return (
                      <div className="pt-2 border-t border-[#2b2e35] flex flex-wrap items-center justify-between gap-2 text-[10px]">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className="font-bold text-[#f4b054] truncate">{spec.name}</span>
                          {Object.entries(spec.craftCost).map(([ingId, need]) => {
                            const req = need ?? 0;
                            const have = snap.pocketItems[ingId] ?? 0;
                            const ok = have >= req;
                            return (
                              <span
                                key={ingId}
                                className={`px-1.5 py-0.5 rounded-[2px] font-mono tabular-nums border ${
                                  ok
                                    ? 'bg-[#162518] border-[#45b649]/65 text-[#86ef92]'
                                    : 'bg-[#261616] border-[#d9483b]/65 text-[#f2857c]'
                                }`}
                              >
                                {have}/{req} {getCapytorioItemMeta(ingId).shortName}
                              </span>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => onCraftMachine(selectedCraftMachineType)}
                          className={`px-2.5 py-1 rounded-[2px] font-mono cursor-pointer shrink-0 ${FACTORIO_BTN_ACTIVE}`}
                        >
                          Craft 1
                        </button>
                      </div>
                    );
                  })()}

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
                  <span
                    className={`hidden sm:inline text-[10px] font-mono tabular-nums font-semibold whitespace-nowrap ${
                      effPct >= 95
                        ? 'text-[#5cd660]'
                        : effPct >= 60
                          ? 'text-[#f4b054]'
                          : 'text-[#e85d50]'
                    }`}
                  >
                    · {snap.powerSupplyMw.toFixed(1)}/{snap.powerDemandMw.toFixed(1)} MW
                  </span>
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

      {/* FACTORIO TOP-RIGHT LIVE ENTITY / TILE INFO WINDOW */}
      {drawerTab === 'none' && activeInfoTarget && (
        <CapytorioEntityInfoPanel
          info={activeInfoTarget}
          isPinned={isInfoPinned}
          isTopBarVisible={isTopBarVisible}
          onClearPin={onClearInspection}
          onOpenMachineModal={(gx, gz) => {
            onInspectTileAt(gx, gz);
            setDrawerTab('inspect');
          }}
          onRotateMachineAt={onRotateMachineAt}
          onDemolishMachineAt={onDemolishMachineAt}
          onMineTileAt={onMineTileAt}
          onCollectAllOutputs={onCollectAllOutputs}
        />
      )}

      {/* CONTEXTUAL CUT / COPY / PASTE SUB-BAR (Visible ONLY when Copy/Paste tool is active) */}
      {drawerTab === 'none' && isClipboardActive && (
        <div
          data-testid="capytorio-clipboard-bar"
          aria-label="Cut Copy Paste Blueprint Controls"
          className="fixed bottom-[54px] left-2 sm:left-1/2 sm:-translate-x-1/2 z-30 pointer-events-auto max-w-[calc(100vw-60px)] text-[#e6e8ec]"
        >
          <div className={`${FACTORIO_PANEL_FRAME} px-1.5 py-1 flex items-center gap-1 overflow-x-auto`}>
            {/* Copy vs Cut toggle */}
            <button
              type="button"
              data-testid="capytorio-clip-copy-btn"
              onClick={() => onSetClipboardMode('select_copy', clip.selectionShape)}
              title="Copy buildings [Ctrl+C]"
              className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                clip.toolState === 'select_copy' || (clip.toolState === 'paste' && clip.mode === 'copy')
                  ? FACTORIO_BTN_ACTIVE
                  : FACTORIO_BTN_IDLE
              }`}
            >
              <Copy className="w-3 h-3 shrink-0" />
              <span>Copy</span>
            </button>

            <button
              type="button"
              data-testid="capytorio-clip-cut-btn"
              onClick={() => onSetClipboardMode('select_cut', clip.selectionShape)}
              title="Cut & move buildings [Ctrl+X]"
              className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                clip.toolState === 'select_cut' || (clip.toolState === 'paste' && clip.mode === 'cut')
                  ? 'bg-[#b44b1e] hover:bg-[#c85624] border border-[#f59d6d] border-b-[#5a220a] border-r-[#5a220a] text-[#fff3eb] font-bold'
                  : FACTORIO_BTN_IDLE
              }`}
            >
              <Scissors className="w-3 h-3 shrink-0" />
              <span>Cut</span>
            </button>

            <div className="w-[1px] h-4 bg-[#3b3f4a] mx-0.5 shrink-0" aria-hidden="true" />

            {/* Square Box vs Freeform Lasso shape toggle */}
            <button
              type="button"
              data-testid="capytorio-clip-box-btn"
              onClick={() =>
                onSetClipboardMode(
                  clip.toolState === 'paste' ? (clip.mode === 'cut' ? 'select_cut' : 'select_copy') : clip.toolState,
                  'box'
                )
              }
              title="Square box drag selection"
              className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                clip.selectionShape === 'box' && clip.toolState !== 'paste'
                  ? 'bg-[#2a3b4d] border border-[#38bdf8] text-[#bae6fd]'
                  : FACTORIO_BTN_IDLE
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 1.5" />
              </svg>
              <span>Box</span>
            </button>

            <button
              type="button"
              data-testid="capytorio-clip-lasso-btn"
              onClick={() =>
                onSetClipboardMode(
                  clip.toolState === 'paste' ? (clip.mode === 'cut' ? 'select_cut' : 'select_copy') : clip.toolState,
                  'lasso'
                )
              }
              title="Freeform lasso line selection"
              className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                clip.selectionShape === 'lasso' && clip.toolState !== 'paste'
                  ? 'bg-[#2a3b4d] border border-[#38bdf8] text-[#bae6fd]'
                  : FACTORIO_BTN_IDLE
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M2.5 8.5C2 4.5 5 2 8.5 2.5C11.5 3 12.5 5.8 11 8.5C9.5 11.2 5.5 11.8 3.5 10.2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeDasharray="2.2 1.6"
                />
                <circle cx="3" cy="10.2" r="1.4" fill="currentColor" />
              </svg>
              <span>Lasso</span>
            </button>

            {/* Paste status / Rotate 90° / Undo Cut */}
            {clip.toolState === 'paste' && (
              <>
                <div className="w-[1px] h-4 bg-[#3b3f4a] mx-0.5 shrink-0" aria-hidden="true" />
                <span
                  data-testid="capytorio-clip-count"
                  className="text-[10px] font-mono tabular-nums text-[#7ce680] font-semibold px-1 whitespace-nowrap"
                >
                  {clip.count} ready
                </span>
                <button
                  type="button"
                  data-testid="capytorio-clip-rotate-btn"
                  onClick={onRotateDir}
                  title="Rotate blueprint 90° [R]"
                  className={`h-6 px-1.5 rounded-[2px] text-[10px] font-mono cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                >
                  <RotateCcw className="w-3 h-3 shrink-0" />
                  <span>90°</span>
                </button>
              </>
            )}

            {clip.toolState !== 'paste' && clip.previewCount > 0 && (
              <span className="text-[10px] font-mono tabular-nums text-[#38bdf8] font-semibold px-1 whitespace-nowrap">
                {clip.previewCount} sel
              </span>
            )}

            {clip.canUndoCut && (
              <button
                type="button"
                data-testid="capytorio-clip-undo-btn"
                onClick={onUndoCut}
                title="Restore cut buildings to original tiles"
                className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
              >
                <Undo2 className="w-3 h-3 shrink-0" />
                <span>Undo</span>
              </button>
            )}

            <button
              type="button"
              data-testid="capytorio-clip-cancel-btn"
              onClick={onClearClipboard}
              title="Cancel selection / paste [Esc]"
              aria-label="Cancel Cut/Copy/Paste"
              className={`h-6 w-6 rounded-[2px] flex items-center justify-center shrink-0 cursor-pointer ${FACTORIO_BTN_IDLE}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* SLIM SINGLE-ROW BOTTOM FACTORIO QUICKBAR (Items Left · 5 Commands Right) */}
      <section
        data-testid="capytorio-build-bar"
        aria-label="Capytorio Factorio Quickbar"
        className="fixed bottom-1.5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[calc(100vw-12px)] max-w-[780px] text-[#e6e8ec]"
      >
        <div className={`${FACTORIO_PANEL_FRAME} overflow-hidden`}>
          <div
            data-testid="capytorio-toolbar"
            className="px-1.5 py-1 bg-[#1d1f24] flex items-center justify-between gap-1.5"
          >
            {/* LEFT: Compact 36x36px Item Slots (scrollable on narrow phones) */}
            <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
              {recentSlots.map((toolId, slotIdx) => {
                const resolved = resolveCapytorioPlaceableSpec(toolId);
                if (!resolved) return null;
                const hotkey = slotIdx === 9 ? '0' : String(slotIdx + 1);
                const count = resolved.isBaseMachine
                  ? snap.pocketMachines[resolved.baseType] ?? 0
                  : snap.pocketItems[resolved.id] ?? 0;
                const selected = !isClipboardActive && snap.selectedTool === toolId;
                return (
                  <CapytorioSlotTile
                    key={toolId}
                    mini
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

            <div className="w-[2px] h-7 bg-[#111216] border-r border-[#3b3f4a] shrink-0" aria-hidden="true" />

            {/* RIGHT: Strictly 5 Core Commands (Rotate, Inspect, Inventory, Craft, Copy/Paste) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-testid="capytorio-rotate-btn"
                title={
                  clip.toolState === 'paste'
                    ? 'Rotate Blueprint 90° [R]'
                    : inspected
                      ? `Rotate Selected ${inspectedSpec?.shortName ?? 'Building'} (${dirLabel}) [R]`
                      : `Rotate Placement Direction (${dirLabel}) [R]`
                }
                onClick={onRotateDir}
                className={`h-9 px-1.5 sm:px-2 rounded-[2px] text-[9px] font-mono font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${FACTORIO_BTN_IDLE}`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{clip.toolState === 'paste' ? '90°' : dirLabel}</span>
              </button>

              <button
                type="button"
                data-testid="capytorio-drawer-inspect-btn"
                title="Inspect Tile, Resource, Tree, or Building"
                onClick={() => {
                  if (drawerTab === 'inspect') {
                    setDrawerTab('none');
                    return;
                  }
                  if (!isClipboardActive && snap.selectedTool === 'mine' && inspectedTile) {
                    setDrawerTab('inspect');
                  } else {
                    onSelectTool('mine');
                  }
                }}
                className={`h-9 px-1.5 sm:px-2 rounded-[2px] text-[9px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                  drawerTab === 'inspect' || (!isClipboardActive && snap.selectedTool === 'mine')
                    ? FACTORIO_BTN_ACTIVE
                    : FACTORIO_BTN_IDLE
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Inspect</span>
              </button>

              <button
                type="button"
                data-testid="capytorio-drawer-inventory-btn"
                title="Character Inventory [I]"
                onClick={() => toggleTab('inventory')}
                className={`h-9 px-1.5 sm:px-2 rounded-[2px] text-[9px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                  drawerTab === 'inventory' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Inv</span>
              </button>

              <button
                type="button"
                data-testid="capytorio-drawer-craft-btn"
                title="Crafting Workbench"
                onClick={() => toggleTab('craft')}
                className={`h-9 px-1.5 sm:px-2 rounded-[2px] text-[9px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                  drawerTab === 'craft' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Craft</span>
              </button>

              <button
                type="button"
                data-testid="capytorio-clipboard-btn"
                title="Cut / Copy & Paste Buildings (Box or Freeform Lasso) [Ctrl+C / Ctrl+X]"
                onClick={() => {
                  if (isClipboardActive) {
                    onClearClipboard();
                  } else {
                    setDrawerTab('none');
                    onSetClipboardMode('select_copy', clip.selectionShape);
                  }
                }}
                className={`h-9 px-1.5 sm:px-2 rounded-[2px] text-[9px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                  isClipboardActive ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </button>

              {(snap.pocketItems.rocket_part ?? 0) > 0 && (
                <button
                  type="button"
                  data-testid="capytorio-launch-rocket-btn"
                  onClick={onLaunchRocket}
                  className={`h-9 px-1.5 sm:px-2 rounded-[2px] text-[9px] whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${FACTORIO_BTN_ACTIVE}`}
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Launch</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
