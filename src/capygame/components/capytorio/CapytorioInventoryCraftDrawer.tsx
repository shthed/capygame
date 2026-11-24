import React, { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  CAPYTORIO_HOTBAR_ORDER,
  CAPYTORIO_ITEM_CATALOG,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  getCapytorioFootprint,
  getCapytorioItemMeta,
  reloadCapytorioLuaFromServer,
  resetCustomCapytorioLuaSources,
  resolveCapytorioItemShape,
  setCustomCapytorioLuaSources,
  type CapytorioLuaCatalogInfo,
  type CapytorioMachineType,
  type CapytorioRecipeSpec,
} from '../../engine/CapytorioData';
import type { CapytorioUiSnapshot } from '../../engine/CapytorioFactoryEngine';
import { CapytorioSlotTile } from '../CapytorioSlotIcon';
import type { CapytorioCraftGroupTab, CapytorioDrawerTab } from '../CapytorioHud';
import {
  FACTORIO_BTN_ACTIVE,
  FACTORIO_BTN_IDLE,
  FACTORIO_HEADER_BAR,
  FACTORIO_PANEL_FRAME,
  FACTORIO_WELL,
  hexToCss,
  type CapytorioSlotTooltipData,
} from './CapytorioTooltip';

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

export const CAPYTORIO_CRAFT_GROUP_TABS: Array<{ id: CapytorioCraftGroupTab; label: string }> = [
  { id: 'logistics', label: 'Logistics' },
  { id: 'production', label: 'Production' },
  { id: 'intermediate', label: 'Intermediates' },
  { id: 'combat', label: 'Combat' },
  { id: 'science', label: 'Science' },
  { id: 'machines', label: 'Buildings' },
  { id: 'lua', label: 'Mod .lua' },
];

export interface CapytorioInventoryCraftDrawerProps {
  snap: CapytorioUiSnapshot;
  drawerTab: 'inventory' | 'craft';
  setDrawerTab: React.Dispatch<React.SetStateAction<CapytorioDrawerTab>>;
  effPct: number;
  totalSciInPocket: number;
  craftGroup: CapytorioCraftGroupTab;
  setCraftGroup: (group: CapytorioCraftGroupTab) => void;
  selectedCraftRecipeId: string;
  setSelectedCraftRecipeId: (id: string) => void;
  pocketCraftableRecipes: CapytorioRecipeSpec[];
  luaCatalogInfo: CapytorioLuaCatalogInfo;
  setLuaCatalogInfo: (info: CapytorioLuaCatalogInfo) => void;
  invSearchInputRef: React.RefObject<HTMLInputElement | null>;
  craftSearchInputRef: React.RefObject<HTMLInputElement | null>;
  onCollectAllOutputs: () => void;
  onFeedScience: () => void;
  onSelectTool: (toolId: string, promoteToRecent?: boolean) => void;
  onCraftMachine: (mType: CapytorioMachineType, count?: number) => void;
  onCraftRecipe: (recipeId: string, count: number, autoEquipResult?: boolean) => void;
  onOpenPedia: (entryId: string) => void;
  showSlotTooltip: (el: HTMLElement, data: CapytorioSlotTooltipData) => void;
  hideSlotTooltip: () => void;
  showToast: (msg: string) => void;
}

export const CapytorioInventoryCraftDrawer: React.FC<CapytorioInventoryCraftDrawerProps> = React.memo(({
  snap,
  drawerTab,
  setDrawerTab,
  effPct,
  totalSciInPocket,
  craftGroup,
  setCraftGroup,
  selectedCraftRecipeId,
  setSelectedCraftRecipeId,
  pocketCraftableRecipes,
  luaCatalogInfo,
  setLuaCatalogInfo,
  invSearchInputRef,
  craftSearchInputRef,
  onCollectAllOutputs,
  onFeedScience,
  onSelectTool,
  onCraftMachine,
  onCraftRecipe,
  onOpenPedia,
  showSlotTooltip,
  hideSlotTooltip,
  showToast,
}) => {
  const recipeLuaInputRef = useRef<HTMLInputElement | null>(null);
  const techLuaInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCraftMachineType, setSelectedCraftMachineType] =
    useState<CapytorioMachineType>(CAPYTORIO_HOTBAR_ORDER[0]);
  const [focusedInvText, setFocusedInvText] = useState<string | null>(null);
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [craftSearchQuery, setCraftSearchQuery] = useState('');

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
  const invNeedle = invSearchQuery.trim().toLowerCase();
  const filteredStarterMachines = invNeedle
    ? CAPYTORIO_HOTBAR_ORDER.filter((mType) => {
        const spec = CAPYTORIO_MACHINE_SPECS[mType];
        return (
          spec.name.toLowerCase().includes(invNeedle) ||
          spec.shortName.toLowerCase().includes(invNeedle) ||
          mType.toLowerCase().includes(invNeedle)
        );
      })
    : CAPYTORIO_HOTBAR_ORDER;
  const filteredInventoryItems = invNeedle
    ? inventoryItemList.filter(
        (meta) =>
          meta.name.toLowerCase().includes(invNeedle) ||
          meta.shortName.toLowerCase().includes(invNeedle) ||
          meta.id.toLowerCase().includes(invNeedle) ||
          meta.category.toLowerCase().includes(invNeedle)
      )
    : inventoryItemList;
  const totalPocketItemsCount = Object.values(snap.pocketItems).reduce<number>(
    (sum, v) => sum + (v ?? 0),
    0
  );

  const craftNeedle = craftSearchQuery.trim().toLowerCase();
  const groupRecipes = craftNeedle
    ? pocketCraftableRecipes.filter((r) => {
        const outMeta = getCapytorioItemMeta(r.result);
        return (
          r.name.toLowerCase().includes(craftNeedle) ||
          r.id.toLowerCase().includes(craftNeedle) ||
          r.group.toLowerCase().includes(craftNeedle) ||
          outMeta.name.toLowerCase().includes(craftNeedle) ||
          outMeta.shortName.toLowerCase().includes(craftNeedle)
        );
      })
    : craftGroup === 'machines' || craftGroup === 'lua'
      ? []
      : pocketCraftableRecipes.filter((r) => r.group === craftGroup);
  const filteredCraftMachines = craftNeedle
    ? CAPYTORIO_HOTBAR_ORDER.filter((mType) => {
        const spec = CAPYTORIO_MACHINE_SPECS[mType];
        return (
          spec.name.toLowerCase().includes(craftNeedle) ||
          spec.shortName.toLowerCase().includes(craftNeedle) ||
          mType.toLowerCase().includes(craftNeedle)
        );
      })
    : CAPYTORIO_HOTBAR_ORDER;
  const detailRecipe =
    groupRecipes.find((r) => r.id === selectedCraftRecipeId) ??
    pocketCraftableRecipes.find((r) => r.id === selectedCraftRecipeId) ??
    groupRecipes[0] ??
    pocketCraftableRecipes[0];

  return (
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#f4b054] shrink-0">
              Inventory
            </span>
            <div className="relative flex-1 max-w-[175px]">
              <Search className="w-3 h-3 text-[#8e95a2] absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={invSearchInputRef}
                type="text"
                value={invSearchQuery}
                onChange={(e) => setInvSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && invSearchQuery) {
                    e.stopPropagation();
                    setInvSearchQuery('');
                  }
                }}
                data-testid="capytorio-inventory-search"
                placeholder="Search [Ctrl+F]..."
                aria-label="Search Inventory"
                className="w-full h-5 pl-5 pr-4 rounded-[2px] bg-[#101216] border border-[#2f333d] focus:border-[#e58926] outline-none text-[10px] text-[#eef1f5] placeholder-[#6c7382]"
              />
              {invSearchQuery && (
                <button
                  type="button"
                  onClick={() => setInvSearchQuery('')}
                  aria-label="Clear inventory search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-[#8e95a2] hover:text-[#eef1f5] cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <span className="text-[10px] font-mono tabular-nums text-[#9aa0ac] truncate hidden sm:inline">
              {focusedInvText ?? `${totalPocketItemsCount}`}
            </span>
          </div>

          {/* Starter Kit Buildings */}
          {filteredStarterMachines.length > 0 && (
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-[#8e95a2] mb-1.5">
                Starter Buildings (Click Equip · Alt+Click Pedia)
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,36px)] gap-1">
                {filteredStarterMachines.map((mType) => {
                  const spec = CAPYTORIO_MACHINE_SPECS[mType];
                  const count = snap.pocketMachines[mType] ?? 0;
                  const isActive = snap.selectedTool === mType;
                  const fp = getCapytorioFootprint(mType);
                  const fpLabel = `${fp.width}×${fp.height}`;
                  const openTip = (el: HTMLElement) => {
                    setFocusedInvText(`${spec.name} ×${count}`);
                    showSlotTooltip(el, {
                      title: spec.name,
                      subtitle: 'Building',
                      description: spec.description,
                      machineType: mType,
                      color: hexToCss(spec.colorHex),
                      footprint: fpLabel,
                      stockCount: count,
                      hint: 'Click Equip · Alt+Click Pedia',
                    });
                  };
                  return (
                    <CapytorioSlotTile
                      key={mType}
                      mini
                      suppressNativeTitle
                      testId={`capytorio-inv-machine-${mType}`}
                      label={spec.shortName}
                      title={`${spec.name} (×${count})`}
                      count={count}
                      selected={isActive}
                      dimmed={count === 0 && !isActive}
                      machineType={mType}
                      color={hexToCss(spec.colorHex)}
                      onMouseEnter={(e) => openTip(e.currentTarget)}
                      onFocus={(e) => openTip(e.currentTarget)}
                      onMouseLeave={() => {
                        setFocusedInvText(null);
                        hideSlotTooltip();
                      }}
                      onBlur={() => {
                        setFocusedInvText(null);
                        hideSlotTooltip();
                      }}
                      onClick={(e) => {
                        if (e.altKey) {
                          e.preventDefault();
                          hideSlotTooltip();
                          onOpenPedia(mType);
                          return;
                        }
                        setFocusedInvText(`${spec.name} ×${count}`);
                        onSelectTool(mType, true);
                        showToast(`Equipped ${spec.name}`);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Pocket Resources & Crafted Entities */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-[9px] font-mono uppercase tracking-wider text-[#8e95a2] mb-1.5">
              Resources &amp; Crafted Entities
            </div>
            {filteredInventoryItems.length === 0 ? (
              <div className="text-[10px] text-[#7c8391] py-4 text-center">
                No inventory items match "{invSearchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,36px)] gap-1 max-h-[38vh] overflow-y-auto pr-0.5">
                {filteredInventoryItems.map((meta) => {
                  const qty = snap.pocketItems[meta.id] ?? 0;
                  const placeable = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[meta.id];
                  const isEquipped = snap.selectedTool === meta.id;
                  const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                  const fp = placeable ? getCapytorioFootprint(placeable.baseType, meta.id) : null;
                  const fpLabel = fp ? `${fp.width}×${fp.height}` : undefined;
                  const resolvedColor = placeable?.tintHex
                    ? hexToCss(placeable.tintHex)
                    : meta.cssColor;
                  const openTip = (el: HTMLElement) => {
                    setFocusedInvText(`${meta.name} ×${qty}`);
                    showSlotTooltip(el, {
                      title: meta.name,
                      subtitle: placeable ? 'Placeable Entity' : meta.category,
                      description: placeable
                        ? CAPYTORIO_MACHINE_SPECS[placeable.baseType]?.description
                        : undefined,
                      machineType: placeable?.baseType,
                      variantItemId: placeable ? meta.id : undefined,
                      itemShape: shape,
                      color: resolvedColor,
                      footprint: fpLabel,
                      stockCount: qty,
                      hint: placeable ? 'Click Equip · Alt+Click Pedia' : 'Alt+Click Pedia',
                    });
                  };
                  return (
                    <CapytorioSlotTile
                      key={meta.id}
                      mini
                      suppressNativeTitle
                      testId={`capytorio-inv-item-${meta.id}`}
                      label={meta.shortName}
                      title={`${meta.name} (×${qty})`}
                      count={qty}
                      selected={isEquipped}
                      dimmed={qty === 0 && !isEquipped}
                      machineType={placeable?.baseType}
                      variantItemId={placeable ? meta.id : undefined}
                      itemShape={shape}
                      color={resolvedColor}
                      onMouseEnter={(e) => openTip(e.currentTarget)}
                      onFocus={(e) => openTip(e.currentTarget)}
                      onMouseLeave={() => {
                        setFocusedInvText(null);
                        hideSlotTooltip();
                      }}
                      onBlur={() => {
                        setFocusedInvText(null);
                        hideSlotTooltip();
                      }}
                      onClick={(e) => {
                        if (e.altKey) {
                          e.preventDefault();
                          hideSlotTooltip();
                          onOpenPedia(meta.id);
                          return;
                        }
                        setFocusedInvText(`${meta.name} ×${qty}`);
                        if (placeable) {
                          onSelectTool(meta.id, true);
                          showToast(`Equipped ${meta.name} into Quickbar Slot 1`);
                        }
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Tabbed Crafting Workbench */}
        <div
          className={`${
            drawerTab === 'craft' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-7 flex-col justify-between gap-2 ${FACTORIO_WELL} p-2.5`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-[#2b2e35] pb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#f4b054] shrink-0">
                Crafting
              </span>
              <div className="relative flex-1 max-w-[200px]">
                <Search className="w-3 h-3 text-[#8e95a2] absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={craftSearchInputRef}
                  type="text"
                  value={craftSearchQuery}
                  onChange={(e) => setCraftSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && craftSearchQuery) {
                      e.stopPropagation();
                      setCraftSearchQuery('');
                    }
                  }}
                  data-testid="capytorio-craft-search"
                  placeholder="Search recipes [Ctrl+F]..."
                  aria-label="Search Crafting Recipes"
                  className="w-full h-5 pl-5 pr-4 rounded-[2px] bg-[#101216] border border-[#2f333d] focus:border-[#e58926] outline-none text-[10px] text-[#eef1f5] placeholder-[#6c7382]"
                />
                {craftSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCraftSearchQuery('')}
                    aria-label="Clear crafting search"
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-[#8e95a2] hover:text-[#eef1f5] cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <span className="text-[10px] font-mono tabular-nums text-[#9aa0ac] hidden sm:inline shrink-0">
                {craftNeedle ? `${groupRecipes.length} matches` : `${pocketCraftableRecipes.length} unlocked`}
              </span>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1">
              {CAPYTORIO_CRAFT_GROUP_TABS.map((tab) => {
                const active = !craftNeedle && craftGroup === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`capytorio-craft-tab-${tab.id}`}
                    onClick={() => {
                      setCraftSearchQuery('');
                      setCraftGroup(tab.id);
                    }}
                    className={`px-2 py-1 rounded-[2px] text-[10px] font-semibold cursor-pointer ${
                      active ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Active Category Grid (Search spans both Buildings and ALL recipe tabs) */}
            {craftGroup === 'machines' && !craftNeedle ? (
              <div className="grid grid-cols-[repeat(auto-fill,36px)] gap-1 max-h-[36vh] overflow-y-auto pr-0.5">
                {filteredCraftMachines.map((mType) => {
                  const spec = CAPYTORIO_MACHINE_SPECS[mType];
                  const costEntries = Object.entries(spec.craftCost).map(([id, amt]) => ({
                    id,
                    name: getCapytorioItemMeta(id).name,
                    have: snap.pocketItems[id] ?? 0,
                    need: amt ?? 0,
                  }));
                  const canAffordMachine = costEntries.every((c) => c.have >= c.need);
                  const fp = getCapytorioFootprint(mType);
                  const openTip = (el: HTMLElement) =>
                    showSlotTooltip(el, {
                      title: spec.name,
                      subtitle: 'Building',
                      description: spec.description,
                      machineType: mType,
                      color: hexToCss(spec.colorHex),
                      footprint: `${fp.width}×${fp.height}`,
                      stockCount: snap.pocketMachines[mType] ?? 0,
                      outputCount: 1,
                      craftTimeSec: 0.5,
                      ingredients: costEntries,
                      hint: 'L-Click ×1 · R-Click ×5 · Shift All · Alt+Click Pedia',
                    });
                  return (
                    <CapytorioSlotTile
                      key={mType}
                      mini
                      suppressNativeTitle
                      testId={`capytorio-craft-machine-${mType}`}
                      label={spec.shortName}
                      title={`Craft ${spec.name}`}
                      count="×1"
                      selected={selectedCraftMachineType === mType}
                      accent={canAffordMachine ? 'craftable' : 'missing'}
                      machineType={mType}
                      color={hexToCss(spec.colorHex)}
                      onMouseEnter={(e) => openTip(e.currentTarget)}
                      onFocus={(e) => openTip(e.currentTarget)}
                      onMouseLeave={hideSlotTooltip}
                      onBlur={hideSlotTooltip}
                      onClick={(e) => {
                        if (e.altKey) {
                          e.preventDefault();
                          hideSlotTooltip();
                          onOpenPedia(mType);
                          return;
                        }
                        setSelectedCraftMachineType(mType);
                        onCraftMachine(mType, e.shiftKey ? 9999 : 1);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedCraftMachineType(mType);
                        onCraftMachine(mType, 5);
                      }}
                    />
                  );
                })}
              </div>
            ) : craftGroup === 'lua' && !craftNeedle ? (
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
                {craftNeedle &&
                  filteredCraftMachines.map((mType) => {
                    const spec = CAPYTORIO_MACHINE_SPECS[mType];
                    const costEntries = Object.entries(spec.craftCost).map(([id, amt]) => ({
                      id,
                      name: getCapytorioItemMeta(id).name,
                      have: snap.pocketItems[id] ?? 0,
                      need: amt ?? 0,
                    }));
                    const canAffordMachine = costEntries.every((c) => c.have >= c.need);
                    const fp = getCapytorioFootprint(mType);
                    const openTip = (el: HTMLElement) =>
                      showSlotTooltip(el, {
                        title: spec.name,
                        subtitle: 'Building',
                        description: spec.description,
                        machineType: mType,
                        color: hexToCss(spec.colorHex),
                        footprint: `${fp.width}×${fp.height}`,
                        stockCount: snap.pocketMachines[mType] ?? 0,
                        outputCount: 1,
                        craftTimeSec: 0.5,
                        ingredients: costEntries,
                        hint: 'L-Click ×1 · R-Click ×5 · Shift All · Alt+Click Pedia',
                      });
                    return (
                      <CapytorioSlotTile
                        key={`srch-m-${mType}`}
                        mini
                        suppressNativeTitle
                        testId={`capytorio-craft-machine-${mType}`}
                        label={spec.shortName}
                        title={`Craft ${spec.name}`}
                        count="×1"
                        selected={selectedCraftMachineType === mType}
                        accent={canAffordMachine ? 'craftable' : 'missing'}
                        machineType={mType}
                        color={hexToCss(spec.colorHex)}
                        onMouseEnter={(e) => openTip(e.currentTarget)}
                        onFocus={(e) => openTip(e.currentTarget)}
                        onMouseLeave={hideSlotTooltip}
                        onBlur={hideSlotTooltip}
                        onClick={(e) => {
                          if (e.altKey) {
                            e.preventDefault();
                            hideSlotTooltip();
                            onOpenPedia(mType);
                            return;
                          }
                          setSelectedCraftMachineType(mType);
                          onCraftMachine(mType, e.shiftKey ? 9999 : 1);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedCraftMachineType(mType);
                          onCraftMachine(mType, 5);
                        }}
                      />
                    );
                  })}
                {groupRecipes.map((rec) => {
                  const outMeta = getCapytorioItemMeta(rec.result);
                  const ingEntries = rec.ingredients.map((i) => ({
                    id: i.item,
                    name: getCapytorioItemMeta(i.item).name,
                    have: snap.pocketItems[i.item] ?? 0,
                    need: i.count,
                  }));
                  const canAfford = ingEntries.every((i) => i.have >= i.need);
                  const isSelected = detailRecipe?.id === rec.id;
                  const placeable = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[rec.result];
                  const shape =
                    outMeta.shape ?? resolveCapytorioItemShape(outMeta.id, outMeta.category);
                  const resolvedColor = placeable?.tintHex
                    ? hexToCss(placeable.tintHex)
                    : outMeta.cssColor;
                  const fp = placeable
                    ? getCapytorioFootprint(placeable.baseType, rec.result)
                    : null;
                  const stockCount = Object.prototype.hasOwnProperty.call(
                    CAPYTORIO_MACHINE_SPECS,
                    rec.result
                  )
                    ? snap.pocketMachines[rec.result as CapytorioMachineType] ?? 0
                    : snap.pocketItems[rec.result] ?? 0;
                  const openTip = (el: HTMLElement) =>
                    showSlotTooltip(el, {
                      title: rec.name,
                      subtitle: placeable ? 'Placeable Entity' : outMeta.category,
                      description: placeable
                        ? CAPYTORIO_MACHINE_SPECS[placeable.baseType]?.description
                        : undefined,
                      machineType: placeable?.baseType,
                      variantItemId: placeable ? rec.result : undefined,
                      itemShape: shape,
                      color: resolvedColor,
                      footprint: fp ? `${fp.width}×${fp.height}` : undefined,
                      stockCount,
                      outputCount: rec.resultCount,
                      craftTimeSec: rec.craftTimeSec,
                      ingredients: ingEntries,
                      hint: 'L-Click ×1 · R-Click ×5 · Shift All · Alt+Click Pedia',
                    });
                  return (
                    <CapytorioSlotTile
                      key={rec.id}
                      mini
                      suppressNativeTitle
                      testId={`capytorio-craft-recipe-${rec.id}`}
                      label={outMeta.shortName}
                      title={`${rec.name} (×${rec.resultCount})`}
                      count={`×${rec.resultCount}`}
                      selected={isSelected}
                      accent={canAfford ? 'craftable' : 'missing'}
                      machineType={placeable?.baseType}
                      variantItemId={placeable ? rec.result : undefined}
                      itemShape={shape}
                      color={resolvedColor}
                      onMouseEnter={(e) => openTip(e.currentTarget)}
                      onFocus={(e) => openTip(e.currentTarget)}
                      onMouseLeave={hideSlotTooltip}
                      onBlur={hideSlotTooltip}
                      onClick={(e) => {
                        if (e.altKey) {
                          e.preventDefault();
                          hideSlotTooltip();
                          onOpenPedia(rec.result);
                          return;
                        }
                        setSelectedCraftRecipeId(rec.id);
                        onCraftRecipe(rec.id, e.shiftKey ? 9999 : 1, true);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedCraftRecipeId(rec.id);
                        onCraftRecipe(rec.id, 5, false);
                      }}
                    />
                  );
                })}
                {craftNeedle &&
                  filteredCraftMachines.length === 0 &&
                  groupRecipes.length === 0 && (
                    <div className="col-span-full text-[10px] text-[#7c8391] py-4 text-center">
                      No crafting recipes match "{craftSearchQuery}"
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Selected Building Ingredient & Craft Bar */}
          {craftGroup === 'machines' &&
            (() => {
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
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onCraftMachine(selectedCraftMachineType, 1)}
                      className="px-2.5 py-1 rounded-[2px] bg-[#243426] hover:bg-[#2f4532] border border-[#45b649]/75 text-[#86ef92] font-mono font-semibold cursor-pointer"
                    >
                      Craft 1
                    </button>
                    <button
                      type="button"
                      onClick={() => onCraftMachine(selectedCraftMachineType, 5)}
                      className={`px-2.5 py-1 rounded-[2px] font-mono cursor-pointer ${FACTORIO_BTN_ACTIVE}`}
                    >
                      ×5
                    </button>
                    <button
                      type="button"
                      onClick={() => onCraftMachine(selectedCraftMachineType, 9999)}
                      className={`px-2 py-1 rounded-[2px] font-mono cursor-pointer ${FACTORIO_BTN_IDLE}`}
                    >
                      All
                    </button>
                  </div>
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
                <button
                  type="button"
                  onClick={() => onCraftRecipe(detailRecipe.id, 9999, false)}
                  className={`px-2 py-1 rounded-[2px] font-mono cursor-pointer ${FACTORIO_BTN_IDLE}`}
                >
                  All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
