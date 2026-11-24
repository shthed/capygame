import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  Flame,
  FlipHorizontal2,
  FlipVertical2,
  Menu,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Scissors,
  Search,
  Settings,
  Undo2,
  X,
} from 'lucide-react';
import {
  CAPYTORIO_CHEST_ITEMS_PER_SLOT,
  CAPYTORIO_CHEST_SLOTS,
  CAPYTORIO_ITEM_CATALOG,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  CAPYTORIO_RECIPES,
  getCapytorioFootprint,
  getCapytorioItemMeta,
  resolveCapytorioItemShape,
  type CapytorioItemId,
  type CapytorioLuaCatalogInfo,
  type CapytorioMachineType,
  type CapytorioRecipeGroup,
  type CapytorioRecipeId,
  type CapytorioTechId,
} from '../engine/CapytorioData';
import {
  resolveCapytorioPlaceableSpec,
  type CapytorioClipboardToolState,
  type CapytorioInserterFilterMode,
  type CapytorioSelectionShape,
  type CapytorioSplitterPriority,
  type CapytorioTileInspection,
  type CapytorioUiSnapshot,
} from '../engine/CapytorioFactoryEngine';
import type { FactorioBlueprintImportResult } from '../engine/FactorioBlueprintCodec';
import {
  CapytorioItemIcon,
  CapytorioMachineIcon,
  CapytorioSlotTile,
  CapytorioWorldIcon,
} from './CapytorioSlotIcon';
const LazyCapytorioEntityInfoPanel = React.lazy(() =>
  import('./CapytorioEntityInfoPanel').then((m) => ({ default: m.CapytorioEntityInfoPanel }))
);
const LazyCapytorioPediaView = React.lazy(() =>
  import('./CapytorioPediaView').then((m) => ({ default: m.CapytorioPediaView }))
);
import {
  CapytorioTooltip,
  DIR_LABELS,
  FACTORIO_BTN_ACTIVE,
  FACTORIO_BTN_IDLE,
  FACTORIO_HEADER_BAR,
  FACTORIO_PANEL_FRAME,
  FACTORIO_WELL,
  hexToCss,
  type CapytorioHoverTooltipState,
  type CapytorioSlotTooltipData,
} from './capytorio/CapytorioTooltip';
import { CapytorioQuickbar } from './capytorio/CapytorioQuickbar';
import {
  CAPYTORIO_CRAFT_GROUP_TABS,
  CapytorioInventoryCraftDrawer,
} from './capytorio/CapytorioInventoryCraftDrawer';
import { CapytorioTechDrawer } from './capytorio/CapytorioTechDrawer';
import { CapytorioBlueprintLibraryDrawer } from './capytorio/CapytorioBlueprintLibraryDrawer';

export type CapytorioDrawerTab =
  | 'none'
  | 'inventory'
  | 'craft'
  | 'tech'
  | 'inspect'
  | 'blueprints'
  | 'pedia';
export type CapytorioCraftGroupTab = CapytorioRecipeGroup | 'machines' | 'lua';

export interface CapytorioHudProps {
  snap: CapytorioUiSnapshot;
  isTopBarVisible: boolean;
  onToggleTopBar: () => void;
  onOpenSettings: () => void;
  isPaused?: boolean;
  onTogglePause?: () => void;
  pointerHoverActive: boolean;
  drawerTab: CapytorioDrawerTab;
  setDrawerTab: React.Dispatch<React.SetStateAction<CapytorioDrawerTab>>;
  craftGroup: CapytorioCraftGroupTab;
  setCraftGroup: (group: CapytorioCraftGroupTab) => void;
  selectedCraftRecipeId: string;
  setSelectedCraftRecipeId: (id: string) => void;
  luaCatalogInfo: CapytorioLuaCatalogInfo;
  setLuaCatalogInfo: (info: CapytorioLuaCatalogInfo) => void;
  pediaEntryId: string;
  pediaContextInfo: CapytorioTileInspection | null;
  searchFocusNonce?: number;
  onOpenPedia: (entryId: string, contextInfo?: CapytorioTileInspection | null) => void;
  onSelectTool: (toolId: string, promoteToRecent?: boolean) => void;
  onMineTileAt: (gx: number, gz: number) => void;
  onInspectTileAt: (gx: number, gz: number) => void;
  onClearInspection: () => void;
  onDemolishMachineAt: (gx: number, gz: number) => void;
  onRotateDir: () => void;
  onFlipBlueprintH: () => void;
  onFlipBlueprintV: () => void;
  onActivateLastBlueprint: () => void;
  onSelectBlueprint: (id: string) => void;
  onDeleteBlueprint: (id: string) => void;
  onClearBlueprintLibrary: () => void;
  onBuildSampleStarterMall: () => void;
  onImportFactorioString: (
    raw: string
  ) => Promise<FactorioBlueprintImportResult & { addedIds: string[] }>;
  onExportBlueprintString: (id: string) => Promise<{
    ok: boolean;
    label: string;
    encoded: string;
    entityCount: number;
    error?: string;
  }>;
  onExportFactoryString: () => Promise<{
    ok: boolean;
    label: string;
    encoded: string;
    entityCount: number;
    error?: string;
  }>;
  onExportBlueprintBookString: () => Promise<{
    ok: boolean;
    label: string;
    encoded: string;
    blueprintCount: number;
    entityCount: number;
    error?: string;
  }>;
  onSetClipboardMode: (mode: CapytorioClipboardToolState, shape?: CapytorioSelectionShape) => void;
  onClearClipboard: () => void;
  onPlaceBlueprint: () => void;
  onUndoCut: () => void;
  onUndoAction: () => void;
  onRedoAction: () => void;
  onCollectAllOutputs: () => void;
  onFeedScience: () => void;
  onLaunchRocket: () => void;
  onCraftMachine: (mType: CapytorioMachineType, count?: number) => void;
  onCraftRecipe: (recipeId: string, count: number, autoEquipResult?: boolean) => void;
  onCancelCraftQueueItem: (uid: number) => void;
  onSelectTech: (techId: CapytorioTechId) => void;
  onFuelGenerator: (gx: number, gz: number) => void;
  onInsertInputs: (gx: number, gz: number) => void;
  onTakeOutputs: (gx: number, gz: number) => void;
  onRotateMachineAt: (gx: number, gz: number) => void;
  onSelectAssemblerRecipe: (recipeId: CapytorioRecipeId) => void;
  onToggleAltMode: () => void;
  onCopyEntitySettings: (gx: number, gz: number) => void;
  onPasteEntitySettings: (gx: number, gz: number) => void;
  onSetSplitterConfig: (
    gx: number,
    gz: number,
    config: {
      inputPriority?: CapytorioSplitterPriority;
      outputPriority?: CapytorioSplitterPriority;
      filterItem?: CapytorioItemId | null;
    }
  ) => void;
  onSetInserterConfig: (
    gx: number,
    gz: number,
    config: {
      filterMode?: CapytorioInserterFilterMode;
      filters?: CapytorioItemId[];
      stackLimit?: number | null;
    }
  ) => void;
  onSetChestSlotLimit: (gx: number, gz: number, slotLimit: number | null) => void;
  showToast: (msg: string) => void;
}

export const CapytorioHud: React.FC<CapytorioHudProps> = React.memo(({
  snap,
  isTopBarVisible,
  onToggleTopBar,
  onOpenSettings,
  isPaused = false,
  onTogglePause,
  pointerHoverActive,
  drawerTab,
  setDrawerTab,
  craftGroup,
  setCraftGroup,
  selectedCraftRecipeId,
  setSelectedCraftRecipeId,
  luaCatalogInfo,
  setLuaCatalogInfo,
  pediaEntryId,
  pediaContextInfo,
  searchFocusNonce = 0,
  onOpenPedia,
  onSelectTool,
  onMineTileAt,
  onInspectTileAt,
  onClearInspection,
  onDemolishMachineAt,
  onRotateDir,
  onFlipBlueprintH,
  onFlipBlueprintV,
  onActivateLastBlueprint,
  onSelectBlueprint,
  onDeleteBlueprint,
  onClearBlueprintLibrary,
  onBuildSampleStarterMall,
  onImportFactorioString,
  onExportBlueprintString,
  onExportFactoryString,
  onExportBlueprintBookString,
  onSetClipboardMode,
  onClearClipboard,
  onPlaceBlueprint,
  onUndoCut,
  onUndoAction,
  onRedoAction,
  onCollectAllOutputs,
  onFeedScience,
  onLaunchRocket,
  onCraftMachine,
  onCraftRecipe,
  onCancelCraftQueueItem,
  onSelectTech,
  onFuelGenerator,
  onInsertInputs,
  onTakeOutputs,
  onRotateMachineAt,
  onSelectAssemblerRecipe,
  onToggleAltMode,
  onCopyEntitySettings,
  onPasteEntitySettings,
  onSetSplitterConfig,
  onSetInserterConfig,
  onSetChestSlotLimit,
  showToast,
}) => {
  const filterableItems = useMemo(() => {
    const order: Record<string, number> = {
      raw: 0,
      plate: 1,
      intermediate: 2,
      science: 3,
      rocket: 4,
      building: 5,
    };
    return Object.values(CAPYTORIO_ITEM_CATALOG)
      .slice()
      .sort(
        (a, b) =>
          (order[a.category] ?? 9) - (order[b.category] ?? 9) ||
          a.name.localeCompare(b.name)
      );
  }, []);
  const invSearchInputRef = useRef<HTMLInputElement | null>(null);
  const craftSearchInputRef = useRef<HTMLInputElement | null>(null);
  const assemblerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const techSearchInputRef = useRef<HTMLInputElement | null>(null);
  const blueprintSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [assemblerSearchQuery, setAssemblerSearchQuery] = useState('');
  const [assemblerRecipeGroup, setAssemblerRecipeGroup] =
    useState<CapytorioRecipeGroup>('logistics');
  const [hoverTooltip, setHoverTooltip] = useState<CapytorioHoverTooltipState | null>(null);

  useEffect(() => {
    setHoverTooltip(null);
  }, [drawerTab]);

  const showSlotTooltip = (el: HTMLElement, data: CapytorioSlotTooltipData) => {
    const r = el.getBoundingClientRect();
    setHoverTooltip({
      ...data,
      anchorRect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
    });
  };

  const hideSlotTooltip = () => {
    setHoverTooltip(null);
  };

  useEffect(() => {
    if (searchFocusNonce <= 0) return;
    const focusSearch = () => {
      const target =
        drawerTab === 'craft'
          ? craftSearchInputRef.current
          : drawerTab === 'inventory'
            ? invSearchInputRef.current
            : drawerTab === 'inspect'
              ? assemblerSearchInputRef.current
              : drawerTab === 'tech'
                ? techSearchInputRef.current
                : drawerTab === 'blueprints'
                  ? blueprintSearchInputRef.current
                  : null;
      if (target) {
        target.focus();
        target.select();
        return true;
      }
      return false;
    };
    if (!focusSearch()) {
      requestAnimationFrame(() => {
        focusSearch();
      });
    }
  }, [searchFocusNonce, drawerTab]);

  const effPct = Math.round(snap.powerEfficiency * 100);
  const totalSciInPocket = Object.entries(snap.pocketItems).reduce<number>(
    (sum, [id, qty]) =>
      qty && qty > 0 && getCapytorioItemMeta(id).category === 'science' ? sum + qty : sum,
    0
  );
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
  const recentSlots = snap.recentTools.slice(0, 10);

  const activeAssemblerRecipeId =
    inspected?.type === 'assembler' ? inspected.recipeId : snap.selectedRecipeId;
  const assemblerGroupTabs = CAPYTORIO_CRAFT_GROUP_TABS.filter(
    (tab): tab is { id: CapytorioRecipeGroup; label: string } =>
      tab.id !== 'machines' &&
      tab.id !== 'lua' &&
      assemblerRecipes.some((r) => r.group === tab.id)
  );
  const inspectedKey = inspected ? `${inspected.gx},${inspected.gz}` : null;
  useEffect(() => {
    if (drawerTab !== 'inspect') return;
    setAssemblerSearchQuery('');
    const assigned = assemblerRecipes.find((r) => r.id === activeAssemblerRecipeId);
    if (assigned) {
      setAssemblerRecipeGroup(assigned.group);
    }
    // Sync tab only when opening inspect or switching inspected machine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerTab, inspectedKey]);
  const effectiveAssemblerGroup: CapytorioRecipeGroup = assemblerGroupTabs.some(
    (t) => t.id === assemblerRecipeGroup
  )
    ? assemblerRecipeGroup
    : assemblerGroupTabs[0]?.id ?? 'logistics';
  const assemblerNeedle = assemblerSearchQuery.trim().toLowerCase();
  const filteredAssemblerRecipes = assemblerNeedle
    ? assemblerRecipes.filter((r) => {
        const outMeta = getCapytorioItemMeta(r.result);
        return (
          r.name.toLowerCase().includes(assemblerNeedle) ||
          r.id.toLowerCase().includes(assemblerNeedle) ||
          r.group.toLowerCase().includes(assemblerNeedle) ||
          outMeta.name.toLowerCase().includes(assemblerNeedle) ||
          outMeta.shortName.toLowerCase().includes(assemblerNeedle)
        );
      })
    : assemblerRecipes.filter((r) => r.group === effectiveAssemblerGroup);
  const activeAssemblerRecipe =
    assemblerRecipes.find((r) => r.id === activeAssemblerRecipeId) ??
    filteredAssemblerRecipes[0] ??
    assemblerRecipes[0];

  const toggleTab = (tab: Exclude<CapytorioDrawerTab, 'none'>) => {
    setDrawerTab((prev) => (prev === tab ? 'none' : tab));
  };

  return (
    <>
      {/* TOP-LEFT COMPACT FACTORIO UNDO / REDO STRIP */}
      <div
        data-testid="capytorio-history-bar"
        aria-label="Building Undo and Redo Controls"
        className={`fixed left-2 z-30 pointer-events-auto transition-[top] duration-150 ${
          isTopBarVisible ? 'top-[48px]' : 'top-2'
        }`}
      >
        <div className={`${FACTORIO_PANEL_FRAME} p-0.5 flex items-center gap-1 text-[#e6e8ec]`}>
          <button
            type="button"
            data-testid="capytorio-undo-btn"
            disabled={!snap.history.canUndo}
            onClick={onUndoAction}
            title={
              snap.history.canUndo && snap.history.nextUndoLabel
                ? `Undo: ${snap.history.nextUndoLabel} [Ctrl+Z]`
                : 'Nothing to undo [Ctrl+Z]'
            }
            aria-label="Undo last building action"
            className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap ${
              snap.history.canUndo
                ? `${FACTORIO_BTN_IDLE} cursor-pointer`
                : 'bg-[#202228] border border-[#323640] text-[#5c6270] cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3 h-3 shrink-0" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            data-testid="capytorio-redo-btn"
            disabled={!snap.history.canRedo}
            onClick={onRedoAction}
            title={
              snap.history.canRedo && snap.history.nextRedoLabel
                ? `Redo: ${snap.history.nextRedoLabel} [Ctrl+Y]`
                : 'Nothing to redo [Ctrl+Y]'
            }
            aria-label="Redo building action"
            className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 ${
              snap.history.canRedo
                ? `${FACTORIO_BTN_IDLE} cursor-pointer`
                : 'bg-[#202228] border border-[#323640] text-[#5c6270] cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-3 h-3 shrink-0" />
            <span>Redo</span>
          </button>

          <button
            type="button"
            data-testid="capytorio-alt-mode-btn"
            aria-pressed={snap.altModeEnabled}
            onClick={onToggleAltMode}
            title={
              snap.altModeEnabled
                ? 'Alt-Mode ON — Tap [Alt] to hide 3D recipe/filter overlays'
                : 'Alt-Mode OFF — Tap [Alt] to show 3D recipe/filter overlays'
            }
            className={`h-6 px-2 rounded-[2px] text-[10px] font-mono font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
              snap.altModeEnabled ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
            }`}
          >
            <Eye className="w-3 h-3 shrink-0" />
            <span>Alt</span>
          </button>
        </div>
      </div>

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
            data-testid="capytorio-drawer-pedia-btn"
            title="Capytoriopedia [Alt + Left-Click anything]"
            aria-label="Open Capytoriopedia"
            onClick={() => {
              if (drawerTab === 'pedia') {
                setDrawerTab('none');
              } else {
                onOpenPedia(pediaEntryId || 'drill', pediaContextInfo);
              }
            }}
            className={`h-6 w-6 rounded-[2px] flex items-center justify-center cursor-pointer ${
              drawerTab === 'pedia' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>

          {onTogglePause && (
            <button
              type="button"
              data-testid="capytorio-pause-btn"
              title={isPaused ? 'Resume Simulation [P]' : 'Pause Simulation & Save CPU/RAM [P]'}
              aria-label={isPaused ? 'Resume Game' : 'Pause Game'}
              onClick={onTogglePause}
              className={`h-6 w-6 rounded-[2px] flex items-center justify-center cursor-pointer ${
                isPaused ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          )}

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
          } bottom-[78px] z-20 flex items-center justify-center pt-[46px] px-2 pb-2 sm:pt-[48px] sm:px-4 sm:pb-4 bg-black/55 pointer-events-auto`}
          onClick={() => setDrawerTab('none')}
        >
          {/* CHARACTER INVENTORY & CRAFTING WINDOW */}
          {(drawerTab === 'inventory' || drawerTab === 'craft') && (
            <CapytorioInventoryCraftDrawer
              snap={snap}
              drawerTab={drawerTab}
              setDrawerTab={setDrawerTab}
              effPct={effPct}
              totalSciInPocket={totalSciInPocket}
              craftGroup={craftGroup}
              setCraftGroup={setCraftGroup}
              selectedCraftRecipeId={selectedCraftRecipeId}
              setSelectedCraftRecipeId={setSelectedCraftRecipeId}
              pocketCraftableRecipes={pocketCraftableRecipes}
              luaCatalogInfo={luaCatalogInfo}
              setLuaCatalogInfo={setLuaCatalogInfo}
              invSearchInputRef={invSearchInputRef}
              craftSearchInputRef={craftSearchInputRef}
              onCollectAllOutputs={onCollectAllOutputs}
              onFeedScience={onFeedScience}
              onSelectTool={onSelectTool}
              onCraftMachine={onCraftMachine}
              onCraftRecipe={onCraftRecipe}
              onOpenPedia={(entryId) => onOpenPedia(entryId)}
              showSlotTooltip={showSlotTooltip}
              hideSlotTooltip={hideSlotTooltip}
              showToast={showToast}
            />
          )}

          {/* TECHNOLOGY RESEARCH WINDOW */}
          {drawerTab === 'tech' && (
            <CapytorioTechDrawer
              snap={snap}
              effPct={effPct}
              totalSciInPocket={totalSciInPocket}
              techSearchInputRef={techSearchInputRef}
              onFeedScience={onFeedScience}
              onSelectTech={onSelectTech}
              onOpenPedia={(entryId) => onOpenPedia(entryId)}
              onClose={() => setDrawerTab('none')}
            />
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

                    {/* Logistics & Storage Configuration Controls (Splitter / Inserter / Chest) */}
                    {inspectedTile?.machine?.type === 'splitter' && (
                      <div className="p-2 rounded-[2px] bg-[#121417] border border-[#282b33] space-y-2 text-[10px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[#9aa0ac]">Input Priority</span>
                          <div className="flex items-center gap-1">
                            {(['left', 'none', 'right'] as const).map((prio) => (
                              <button
                                key={prio}
                                type="button"
                                onClick={() =>
                                  onSetSplitterConfig(inspected.gx, inspected.gz, {
                                    inputPriority: prio,
                                  })
                                }
                                className={`px-2 py-0.5 rounded-[2px] font-mono cursor-pointer ${
                                  (inspectedTile.machine?.splitterInputPriority ?? 'none') === prio
                                    ? FACTORIO_BTN_ACTIVE
                                    : FACTORIO_BTN_IDLE
                                }`}
                              >
                                {prio === 'left' ? 'Left' : prio === 'right' ? 'Right' : 'Balanced'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[#9aa0ac]">Output Priority</span>
                          <div className="flex items-center gap-1">
                            {(['left', 'none', 'right'] as const).map((prio) => (
                              <button
                                key={prio}
                                type="button"
                                onClick={() =>
                                  onSetSplitterConfig(inspected.gx, inspected.gz, {
                                    outputPriority: prio,
                                  })
                                }
                                className={`px-2 py-0.5 rounded-[2px] font-mono cursor-pointer ${
                                  (inspectedTile.machine?.splitterOutputPriority ?? 'none') === prio
                                    ? FACTORIO_BTN_ACTIVE
                                    : FACTORIO_BTN_IDLE
                                }`}
                              >
                                {prio === 'left' ? 'Left' : prio === 'right' ? 'Right' : 'Balanced'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#9aa0ac] shrink-0">Output Filter</span>
                          <select
                            value={inspectedTile.machine.splitterFilterItem ?? ''}
                            onChange={(e) =>
                              onSetSplitterConfig(inspected.gx, inspected.gz, {
                                filterItem: e.target.value ? e.target.value : null,
                              })
                            }
                            className="flex-1 min-w-0 h-6 px-1.5 rounded-[2px] bg-[#0e1013] border border-[#4a4f5b] text-[10px] font-mono text-[#e6e8ec]"
                          >
                            <option value="">None (Balanced Output)</option>
                            {filterableItems.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {inspectedTile?.machine?.type === 'inserter' && (
                      <div className="p-2 rounded-[2px] bg-[#121417] border border-[#282b33] space-y-2 text-[10px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[#9aa0ac]">
                            Filter Mode ·{' '}
                            {inspectedTile.machine.inserterReach === 2 ? '2-Tile Reach' : '1-Tile Reach'}
                          </span>
                          <div className="flex items-center gap-1">
                            {(['whitelist', 'blacklist'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() =>
                                  onSetInserterConfig(inspected.gx, inspected.gz, { filterMode: mode })
                                }
                                className={`px-2 py-0.5 rounded-[2px] font-mono cursor-pointer ${
                                  (inspectedTile.machine?.inserterFilterMode ?? 'whitelist') === mode
                                    ? FACTORIO_BTN_ACTIVE
                                    : FACTORIO_BTN_IDLE
                                }`}
                              >
                                {mode === 'whitelist' ? 'Whitelist' : 'Blacklist'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {(inspectedTile.machine.inserterFilters ?? []).map((fid) => (
                            <button
                              key={fid}
                              type="button"
                              onClick={() =>
                                onSetInserterConfig(inspected.gx, inspected.gz, {
                                  filters: (inspectedTile.machine?.inserterFilters ?? []).filter(
                                    (x) => x !== fid
                                  ),
                                })
                              }
                              className="px-1.5 py-0.5 rounded-[2px] bg-[#242832] hover:bg-[#3a1a1a] border border-[#4a4f5b] font-mono text-[10px] text-[#e6e8ec] flex items-center gap-1 cursor-pointer"
                            >
                              <span>{getCapytorioItemMeta(fid).shortName}</span>
                              <X className="w-2.5 h-2.5 text-[#f2857c]" />
                            </button>
                          ))}
                          {(inspectedTile.machine.inserterFilters ?? []).length < 5 && (
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const cur = inspectedTile.machine?.inserterFilters ?? [];
                                if (!cur.includes(val)) {
                                  onSetInserterConfig(inspected.gx, inspected.gz, {
                                    filters: [...cur, val].slice(0, 5),
                                  });
                                }
                              }}
                              className="h-6 px-1.5 rounded-[2px] bg-[#0e1013] border border-[#4a4f5b] text-[10px] font-mono text-[#e6e8ec]"
                            >
                              <option value="">+ Add Filter...</option>
                              {filterableItems.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 font-mono tabular-nums">
                          <span className="text-[#9aa0ac]">Stack Size Override</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const maxS = inspectedTile.machine?.inserterMaxStack ?? 4;
                                const cur = inspectedTile.machine?.inserterStackLimit ?? maxS;
                                onSetInserterConfig(inspected.gx, inspected.gz, {
                                  stackLimit: Math.max(1, cur - 1),
                                });
                              }}
                              className={`w-6 h-6 rounded-[2px] cursor-pointer ${FACTORIO_BTN_IDLE}`}
                            >
                              -
                            </button>
                            <span className="px-2 text-[#f4b054] font-bold">
                              {inspectedTile.machine.inserterStackLimit === null ||
                              inspectedTile.machine.inserterStackLimit === undefined
                                ? `Auto (${inspectedTile.machine.inserterMaxStack ?? 1})`
                                : `${inspectedTile.machine.inserterStackLimit} / ${inspectedTile.machine.inserterMaxStack ?? 1}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const maxS = inspectedTile.machine?.inserterMaxStack ?? 4;
                                const cur = inspectedTile.machine?.inserterStackLimit ?? maxS;
                                const next = cur + 1;
                                onSetInserterConfig(inspected.gx, inspected.gz, {
                                  stackLimit: next >= maxS ? null : next,
                                });
                              }}
                              className={`w-6 h-6 rounded-[2px] cursor-pointer ${FACTORIO_BTN_IDLE}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {inspectedTile?.machine?.type === 'chest' && (
                      <div className="p-2 rounded-[2px] bg-[#121417] border border-[#282b33] space-y-1.5 text-[10px]">
                        <div className="flex items-center justify-between font-mono tabular-nums">
                          <span className="text-[#9aa0ac]">Chest Slot Limit (Red Bar)</span>
                          <span className="text-[#f4b054] font-bold">
                            {inspectedTile.machine.chestSlotLimit ?? CAPYTORIO_CHEST_SLOTS}/
                            {CAPYTORIO_CHEST_SLOTS} slots ·{' '}
                            {inspectedTile.machine.chestCapacityItems ??
                              CAPYTORIO_CHEST_SLOTS * CAPYTORIO_CHEST_ITEMS_PER_SLOT}{' '}
                            max
                          </span>
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                          {Array.from({ length: CAPYTORIO_CHEST_SLOTS }, (_, idx) => {
                            const slotNum = idx + 1;
                            const activeLimit =
                              inspectedTile.machine?.chestSlotLimit ?? CAPYTORIO_CHEST_SLOTS;
                            const locked = slotNum > activeLimit;
                            return (
                              <button
                                key={slotNum}
                                type="button"
                                onClick={() =>
                                  onSetChestSlotLimit(
                                    inspected.gx,
                                    inspected.gz,
                                    slotNum === CAPYTORIO_CHEST_SLOTS ? null : slotNum
                                  )
                                }
                                className={`h-6 rounded-[2px] font-mono tabular-nums cursor-pointer border ${
                                  locked
                                    ? 'bg-[#451414] border-[#b91c1c] text-[#fca5a5]'
                                    : 'bg-[#252932] border-[#4a4f5b] text-[#e2e8f0] hover:border-[#f4b054]'
                                }`}
                              >
                                {locked ? '×' : slotNum}
                              </button>
                            );
                          })}
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

                      {(inspected.type === 'assembler' ||
                        inspected.type === 'splitter' ||
                        inspected.type === 'inserter' ||
                        inspected.type === 'chest') && (
                        <>
                          <button
                            type="button"
                            onClick={() => onCopyEntitySettings(inspected.gx, inspected.gz)}
                            title="Copy entity settings [Shift + Right-Click]"
                            className={`px-2.5 py-1 rounded-[2px] font-mono cursor-pointer flex items-center gap-1 ${FACTORIO_BTN_IDLE}`}
                          >
                            <Copy className="w-3 h-3 shrink-0" />
                            <span>Copy Settings</span>
                          </button>
                          {snap.entitySettingsClipboard?.sourceType === inspected.type && (
                            <button
                              type="button"
                              onClick={() => onPasteEntitySettings(inspected.gx, inspected.gz)}
                              title="Paste entity settings [Shift + Left-Click]"
                              className={`px-2.5 py-1 rounded-[2px] font-mono cursor-pointer flex items-center gap-1 ${FACTORIO_BTN_ACTIVE}`}
                            >
                              <ClipboardPaste className="w-3 h-3 shrink-0" />
                              <span>Paste Settings</span>
                            </button>
                          )}
                        </>
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
                  <div className={`flex flex-col justify-between gap-2 ${FACTORIO_WELL} p-2.5`}>
                    <div className="space-y-2">
                      {/* Header bar matching Crafting workbench */}
                      <div className="flex items-center justify-between gap-2 border-b border-[#2b2e35] pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#f4b054] shrink-0">
                          Assembler Recipe
                        </span>
                        <div className="relative flex-1 max-w-[200px]">
                          <Search className="w-3 h-3 text-[#8e95a2] absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            ref={assemblerSearchInputRef}
                            type="text"
                            value={assemblerSearchQuery}
                            onChange={(e) => setAssemblerSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape' && assemblerSearchQuery) {
                                e.stopPropagation();
                                setAssemblerSearchQuery('');
                              }
                            }}
                            data-testid="capytorio-assembler-search"
                            placeholder="Search recipes [Ctrl+F]..."
                            aria-label="Search Assembler Recipes"
                            className="w-full h-5 pl-5 pr-4 rounded-[2px] bg-[#101216] border border-[#2f333d] focus:border-[#e58926] outline-none text-[10px] text-[#eef1f5] placeholder-[#6c7382]"
                          />
                          {assemblerSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setAssemblerSearchQuery('')}
                              aria-label="Clear assembler recipe search"
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-[#8e95a2] hover:text-[#eef1f5] cursor-pointer"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] font-mono tabular-nums text-[#9aa0ac] hidden sm:inline shrink-0">
                          {assemblerNeedle
                            ? `${filteredAssemblerRecipes.length} matches`
                            : `${assemblerRecipes.length} unlocked`}
                        </span>
                      </div>

                      {/* Category Tabs matching Crafting workbench */}
                      <div className="flex flex-wrap gap-1">
                        {assemblerGroupTabs.map((tab) => {
                          const active = !assemblerNeedle && effectiveAssemblerGroup === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              data-testid={`capytorio-assembler-tab-${tab.id}`}
                              onClick={() => {
                                setAssemblerSearchQuery('');
                                setAssemblerRecipeGroup(tab.id);
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

                      {/* Compact 36x36 Recipe Grid matching Crafting workbench */}
                      <div className="grid grid-cols-[repeat(auto-fill,36px)] gap-1 max-h-[36vh] overflow-y-auto pr-0.5">
                        {filteredAssemblerRecipes.map((rec) => {
                          const outMeta = getCapytorioItemMeta(rec.result);
                          const isSel = activeAssemblerRecipeId === rec.id;
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
                          const ingEntries = rec.ingredients.map((i) => ({
                            id: i.item,
                            name: getCapytorioItemMeta(i.item).name,
                            have:
                              (inspected?.type === 'assembler'
                                ? inspected.inputBuffer[i.item] ?? 0
                                : 0) + (snap.pocketItems[i.item] ?? 0),
                            need: i.count,
                          }));
                          const hasInputs = ingEntries.every((i) => i.have >= i.need);
                          const openTip = (el: HTMLElement) =>
                            showSlotTooltip(el, {
                              title: rec.name,
                              subtitle: placeable ? 'Placeable Entity' : outMeta.category,
                              description: placeable
                                ? CAPYTORIO_MACHINE_SPECS[placeable.baseType]?.description
                                : undefined,
                              machineType: placeable?.baseType,
                              itemShape: shape,
                              color: resolvedColor,
                              footprint: fp ? `${fp.width}×${fp.height}` : undefined,
                              stockCount,
                              outputCount: rec.resultCount,
                              craftTimeSec: rec.craftTimeSec,
                              ingredients: ingEntries,
                              hint: 'Click Assign Recipe · Alt+Click Pedia',
                            });
                          return (
                            <CapytorioSlotTile
                              key={rec.id}
                              mini
                              suppressNativeTitle
                              testId={`capytorio-assembler-recipe-${rec.id}`}
                              label={outMeta.shortName}
                              title={`Assign Assembler Recipe: ${rec.name} (×${rec.resultCount})`}
                              count={`×${rec.resultCount}`}
                              selected={isSel}
                              accent={hasInputs ? 'craftable' : 'none'}
                              machineType={placeable?.baseType}
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
                                onSelectAssemblerRecipe(rec.id as CapytorioRecipeId);
                              }}
                            />
                          );
                        })}
                        {assemblerNeedle && filteredAssemblerRecipes.length === 0 && (
                          <div className="col-span-full text-[10px] text-[#7c8391] py-4 text-center">
                            No assembler recipes match "{assemblerSearchQuery}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected Assembler Recipe Ingredient & Status Bar */}
                    {activeAssemblerRecipe && (
                      <div
                        data-testid="capytorio-assembler-selected-bar"
                        className="pt-2 border-t border-[#2b2e35] flex flex-wrap items-center justify-between gap-2 text-[10px]"
                      >
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className="font-bold text-[#f4b054] truncate">
                            {activeAssemblerRecipe.name}
                          </span>
                          <span className="text-[#9aa0ac] font-mono tabular-nums">
                            ×{activeAssemblerRecipe.resultCount} · {activeAssemblerRecipe.craftTimeSec}s
                          </span>
                          {activeAssemblerRecipe.ingredients.map((ing) => {
                            const inMachine =
                              inspected?.type === 'assembler'
                                ? inspected.inputBuffer[ing.item] ?? 0
                                : 0;
                            const inPocket = snap.pocketItems[ing.item] ?? 0;
                            const have = inMachine + inPocket;
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
                        {inspected?.type === 'assembler' && (
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-[#2a2216] border border-[#e58926]/65 text-[#f4b054] font-mono font-semibold shrink-0">
                            Assigned
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BLUEPRINT LIBRARY MODAL (Built-in Presets, Factorio 0e... Import/Export, Last 100 Saved) */}
          {drawerTab === 'blueprints' && (
            <CapytorioBlueprintLibraryDrawer
              snap={snap}
              blueprintSearchInputRef={blueprintSearchInputRef}
              onClose={() => setDrawerTab('none')}
              onSelectBlueprint={onSelectBlueprint}
              onDeleteBlueprint={onDeleteBlueprint}
              onClearBlueprintLibrary={onClearBlueprintLibrary}
              onBuildSampleStarterMall={onBuildSampleStarterMall}
              onImportFactorioString={onImportFactorioString}
              onExportBlueprintString={onExportBlueprintString}
              onExportFactoryString={onExportFactoryString}
              onExportBlueprintBookString={onExportBlueprintBookString}
              showToast={showToast}
            />
          )}

          {/* CAPYTORIOPEDIA ENCYCLOPEDIA & HELP WINDOW (Alt + Left-Click anywhere) */}
          {drawerTab === 'pedia' && (
            <Suspense fallback={null}>
              <LazyCapytorioPediaView
                entryId={pediaEntryId}
                contextInfo={pediaContextInfo}
                snap={snap}
                luaCatalogInfo={luaCatalogInfo}
                searchFocusNonce={searchFocusNonce}
                onNavigateEntry={(nextId) => onOpenPedia(nextId, pediaContextInfo)}
                onClose={() => setDrawerTab('none')}
                onSelectTool={onSelectTool}
                onCraftMachine={onCraftMachine}
                onCraftRecipe={onCraftRecipe}
                onSelectTech={onSelectTech}
              />
            </Suspense>
          )}
        </div>
      )}

      {/* FACTORIO TOP-RIGHT LIVE ENTITY / TILE INFO WINDOW */}
      {drawerTab === 'none' && activeInfoTarget && (
        <Suspense fallback={null}>
          <LazyCapytorioEntityInfoPanel
            info={activeInfoTarget}
            isPinned={isInfoPinned}
            isTopBarVisible={isTopBarVisible}
            entitySettingsClipboard={snap.entitySettingsClipboard}
            onClearPin={onClearInspection}
            onOpenMachineModal={(gx, gz) => {
              onInspectTileAt(gx, gz);
              setDrawerTab('inspect');
            }}
            onRotateMachineAt={onRotateMachineAt}
            onDemolishMachineAt={onDemolishMachineAt}
            onMineTileAt={onMineTileAt}
            onTakeOutputs={onTakeOutputs}
            onCollectAllOutputs={onCollectAllOutputs}
            onOpenPedia={(nextId, ctx) => onOpenPedia(nextId, ctx)}
            onCopyEntitySettings={onCopyEntitySettings}
            onPasteEntitySettings={onPasteEntitySettings}
            onSetSplitterConfig={onSetSplitterConfig}
            onSetInserterConfig={onSetInserterConfig}
            onSetChestSlotLimit={onSetChestSlotLimit}
          />
        </Suspense>
      )}

      {/* BOTTOM-LEFT REAL-TIME HAND-CRAFTING QUEUE STRIP (Factorio style, click to cancel & refund) */}
      {snap.craftingQueue.length > 0 && (
        <div
          data-testid="capytorio-craft-queue"
          aria-label="Hand-Crafting Queue"
          className="fixed bottom-[78px] left-2 z-30 pointer-events-auto max-w-[calc(100vw-24px)]"
        >
          <div className={`${FACTORIO_PANEL_FRAME} p-1 flex items-center gap-1 overflow-x-auto no-scrollbar`}>
            {snap.craftingQueue.slice(0, 8).map((q, idx) => {
              const isMachine = q.kind === 'machine';
              const machineSpec = isMachine
                ? CAPYTORIO_MACHINE_SPECS[q.resultId as CapytorioMachineType]
                : null;
              const placeable = !isMachine
                ? CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[q.resultId]
                : undefined;
              const meta = !isMachine ? getCapytorioItemMeta(q.resultId) : null;
              const shape = meta
                ? meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category)
                : 'crate';
              const color = machineSpec
                ? hexToCss(machineSpec.colorHex)
                : placeable?.tintHex
                  ? hexToCss(placeable.tintHex)
                  : meta?.cssColor ?? '#f4b054';
              const pct = idx === 0 ? Math.max(0, Math.min(100, Math.round(q.progress * 100))) : 0;
              const queueSubtitle = idx === 0
                ? `Crafting · ${pct}%`
                : q.isIntermediate
                  ? 'Auto-Intermediate'
                  : 'Queued';
              return (
                <button
                  key={q.uid}
                  type="button"
                  data-testid={`capytorio-craft-queue-item-${q.resultId}`}
                  onClick={() => {
                    hideSlotTooltip();
                    onCancelCraftQueueItem(q.uid);
                  }}
                  onMouseEnter={(e) =>
                    showSlotTooltip(e.currentTarget, {
                      title: `${q.resultName} ×${q.remainingCount}`,
                      subtitle: queueSubtitle,
                      color,
                      machineType: isMachine
                        ? (q.resultId as CapytorioMachineType)
                        : placeable?.baseType,
                      itemShape: !isMachine && !placeable ? shape : undefined,
                      hint: 'Click to cancel & refund ingredients',
                    })
                  }
                  onMouseLeave={hideSlotTooltip}
                  onFocus={(e) =>
                    showSlotTooltip(e.currentTarget, {
                      title: `${q.resultName} ×${q.remainingCount}`,
                      subtitle: queueSubtitle,
                      color,
                      machineType: isMachine
                        ? (q.resultId as CapytorioMachineType)
                        : placeable?.baseType,
                      itemShape: !isMachine && !placeable ? shape : undefined,
                      hint: 'Click to cancel & refund ingredients',
                    })
                  }
                  onBlur={hideSlotTooltip}
                  aria-label={`${q.resultName} ×${q.remainingCount}${q.isIntermediate ? ' (Auto-Intermediate)' : ''} — Click to cancel & refund`}
                  className={`relative w-9 h-9 rounded-[2px] border flex items-center justify-center shrink-0 cursor-pointer overflow-hidden ${
                    idx === 0
                      ? 'bg-[#2a2419] border-[#e58926]'
                      : q.isIntermediate
                        ? 'bg-[#171e26] border-[#38bdf8]/65 hover:border-[#ef4444]'
                        : 'bg-[#171a1f] border-[#4a4f5b] hover:border-[#ef4444]'
                  }`}
                >
                  {idx === 0 && (
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-[#45b649]/35 pointer-events-none"
                      style={{ height: `${pct}%` }}
                    />
                  )}
                  <div className="relative z-10 pointer-events-none">
                    {isMachine && machineSpec ? (
                      <CapytorioMachineIcon
                        machineType={q.resultId as CapytorioMachineType}
                        color={color}
                        size={28}
                      />
                    ) : placeable ? (
                      <CapytorioMachineIcon
                        machineType={placeable.baseType}
                        color={color}
                        size={28}
                      />
                    ) : (
                      <CapytorioItemIcon shape={shape} color={color} size={28} />
                    )}
                  </div>
                  <span className="z-20 absolute bottom-0 right-0 px-[2px] bg-[#111317]/85 font-mono tabular-nums font-bold text-[8.5px] leading-[1.05] text-[#f4f6f9]">
                    {q.remainingCount}
                  </span>
                </button>
              );
            })}
            {snap.craftingQueue.length > 8 && (
              <span className="px-1 font-mono tabular-nums text-[9px] text-[#9aa0ac]">
                +{snap.craftingQueue.length - 8}
              </span>
            )}
          </div>
        </div>
      )}

      {/* CONTEXTUAL CUT / COPY / PASTE SUB-BAR (Visible ONLY when Copy/Paste tool is active) */}
      {drawerTab === 'none' && isClipboardActive && (
        <div
          data-testid="capytorio-clipboard-bar"
          aria-label="Cut Copy Paste Blueprint Controls"
          className="fixed bottom-[78px] left-2 sm:left-1/2 sm:-translate-x-1/2 z-30 pointer-events-auto max-w-[calc(100vw-60px)] text-[#e6e8ec]"
        >
          <div className={`${FACTORIO_PANEL_FRAME} px-1.5 py-1 flex items-center gap-1`}>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
              {clip.toolState === 'paste' ? (
                <>
                  {/* Primary Place button right up front for positioning + stamping */}
                  <button
                    type="button"
                    data-testid="capytorio-clip-place-btn"
                    onClick={onPlaceBlueprint}
                    title={
                      clip.pasteAnchor
                        ? `Place ${clip.count} building${clip.count === 1 ? '' : 's'} at (${clip.pasteAnchor.gx}, ${clip.pasteAnchor.gz}) [Enter]`
                        : `Place ${clip.count} building${clip.count === 1 ? '' : 's'} at ghost position [Enter]`
                    }
                    className="h-6 px-2.5 rounded-[2px] text-[10px] font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap bg-[#2d7a36] hover:bg-[#379442] border border-[#6be678] border-b-[#153e1a] border-r-[#153e1a] text-[#f0fdf4]"
                  >
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Place ({clip.count})</span>
                  </button>

                  <button
                    type="button"
                    data-testid="capytorio-clip-rotate-btn"
                    onClick={onRotateDir}
                    title="Rotate blueprint 90° [R] (Shift+R CCW)"
                    className={`h-6 px-1.5 rounded-[2px] text-[10px] font-mono cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                  >
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span>90°</span>
                  </button>
                  <button
                    type="button"
                    data-testid="capytorio-clip-flip-h-btn"
                    onClick={onFlipBlueprintH}
                    title="Flip blueprint horizontally (East ↔ West) [H]"
                    className={`h-6 px-1.5 rounded-[2px] text-[10px] font-mono cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                  >
                    <FlipHorizontal2 className="w-3 h-3 shrink-0" />
                    <span>Flip H</span>
                  </button>
                  <button
                    type="button"
                    data-testid="capytorio-clip-flip-v-btn"
                    onClick={onFlipBlueprintV}
                    title="Flip blueprint vertically (North ↔ South) [V]"
                    className={`h-6 px-1.5 rounded-[2px] text-[10px] font-mono cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                  >
                    <FlipVertical2 className="w-3 h-3 shrink-0" />
                    <span>Flip V</span>
                  </button>

                  <div className="w-[1px] h-4 bg-[#3b3f4a] mx-0.5 shrink-0" aria-hidden="true" />

                  <button
                    type="button"
                    data-testid="capytorio-blueprint-library-btn"
                    onClick={() => setDrawerTab('blueprints')}
                    title="Open Blueprint Library (last 100 copied/cut selections) [B]"
                    className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                  >
                    <BookOpen className="w-3 h-3 shrink-0 text-[#38bdf8]" />
                    <span>Library{clip.libraryCount > 0 ? ` (${clip.libraryCount})` : ''}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="capytorio-clip-copy-btn"
                    onClick={() => onSetClipboardMode('select_copy', clip.selectionShape)}
                    title="Select new area to copy [Ctrl+C]"
                    className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                  >
                    <Copy className="w-3 h-3 shrink-0" />
                    <span>Copy</span>
                  </button>

                  <button
                    type="button"
                    data-testid="capytorio-clip-cut-btn"
                    onClick={() => onSetClipboardMode('select_cut', clip.selectionShape)}
                    title="Select new area to cut [Ctrl+X]"
                    className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                  >
                    <Scissors className="w-3 h-3 shrink-0" />
                    <span>Cut</span>
                  </button>

                  {clip.canUndoCut && (
                    <button
                      type="button"
                      data-testid="capytorio-clip-undo-btn"
                      onClick={onUndoCut}
                      title="Restore cut buildings to original tiles"
                      className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                    >
                      <Undo2 className="w-3 h-3 shrink-0" />
                      <span>Restore</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Copy vs Cut toggle */}
                  <button
                    type="button"
                    data-testid="capytorio-clip-copy-btn"
                    onClick={() => onSetClipboardMode('select_copy', clip.selectionShape)}
                    title="Copy buildings [Ctrl+C]"
                    className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                      clip.toolState === 'select_copy' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
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
                      clip.toolState === 'select_cut'
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
                    onClick={() => onSetClipboardMode(clip.toolState, 'box')}
                    title="Square box drag selection"
                    className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                      clip.selectionShape === 'box'
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
                    onClick={() => onSetClipboardMode(clip.toolState, 'lasso')}
                    title="Freeform lasso line selection"
                    className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                      clip.selectionShape === 'lasso'
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

                  {/* Paste remembered selection when not currently pasting */}
                  {clip.hasRememberedSelection && (
                    <>
                      <div className="w-[1px] h-4 bg-[#3b3f4a] mx-0.5 shrink-0" aria-hidden="true" />
                      <button
                        type="button"
                        data-testid="capytorio-clip-paste-btn"
                        onClick={onActivateLastBlueprint}
                        title="Paste last copied/cut selection [Ctrl+V]"
                        className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                      >
                        <ClipboardPaste className="w-3 h-3 shrink-0 text-[#7ce680]" />
                        <span>Paste</span>
                      </button>
                    </>
                  )}

                  {clip.previewCount > 0 && (
                    <span className="text-[10px] font-mono tabular-nums text-[#38bdf8] font-semibold px-1 whitespace-nowrap">
                      {clip.previewCount} sel
                    </span>
                  )}

                  <div className="w-[1px] h-4 bg-[#3b3f4a] mx-0.5 shrink-0" aria-hidden="true" />

                  <button
                    type="button"
                    data-testid="capytorio-blueprint-library-btn"
                    onClick={() => setDrawerTab('blueprints')}
                    title="Open Blueprint Library (last 100 copied/cut selections) [B]"
                    className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap ${FACTORIO_BTN_IDLE}`}
                  >
                    <BookOpen className="w-3 h-3 shrink-0 text-[#38bdf8]" />
                    <span>Library{clip.libraryCount > 0 ? ` (${clip.libraryCount})` : ''}</span>
                  </button>
                </>
              )}
            </div>

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

      {/* SLIM BOTTOM FACTORIO QUICKBAR WITH SELECTED ITEM STATUS BAR */}
      <CapytorioQuickbar
        snap={snap}
        drawerTab={drawerTab}
        setDrawerTab={setDrawerTab}
        toggleTab={toggleTab}
        recentSlots={recentSlots}
        dirLabel={dirLabel}
        onSelectTool={onSelectTool}
        onRotateDir={onRotateDir}
        onSetClipboardMode={onSetClipboardMode}
        onClearClipboard={onClearClipboard}
        onLaunchRocket={onLaunchRocket}
        onOpenPedia={(entryId) => onOpenPedia(entryId)}
        showSlotTooltip={showSlotTooltip}
        hideSlotTooltip={hideSlotTooltip}
      />

      {/* FLOATING FACTORIO-STYLE ITEM / RECIPE HOVER TOOLTIP */}
      <CapytorioTooltip hoverTooltip={hoverTooltip} />
    </>
  );
});
