import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  Flame,
  FlipHorizontal2,
  FlipVertical2,
  Hammer,
  Menu,
  Package,
  Redo2,
  Rocket,
  RotateCcw,
  Scissors,
  Search,
  Settings,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  CAPYTORIO_CHEST_ITEMS_PER_SLOT,
  CAPYTORIO_CHEST_SLOTS,
  CAPYTORIO_HOTBAR_ORDER,
  CAPYTORIO_ITEM_CATALOG,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  CAPYTORIO_RECIPES,
  CAPYTORIO_TECHS,
  TECH_BY_ID,
  getCapytorioFootprint,
  getCapytorioItemMeta,
  reloadCapytorioLuaFromServer,
  resetCustomCapytorioLuaSources,
  resolveCapytorioItemShape,
  setCustomCapytorioLuaSources,
  type CapytorioItemId,
  type CapytorioItemShape,
  type CapytorioLuaCatalogInfo,
  type CapytorioMachineType,
  type CapytorioRecipeGroup,
  type CapytorioRecipeId,
  type CapytorioTechId,
} from '../engine/CapytorioData';
import {
  MAX_CAPYTORIO_BLUEPRINT_LIBRARY,
  resolveCapytorioPlaceableSpec,
  type CapytorioClipboardToolState,
  type CapytorioInserterFilterMode,
  type CapytorioSavedBlueprint,
  type CapytorioSelectionShape,
  type CapytorioSplitterPriority,
  type CapytorioTileInspection,
  type CapytorioUiSnapshot,
} from '../engine/CapytorioFactoryEngine';
import {
  CapytorioItemIcon,
  CapytorioMachineIcon,
  CapytorioSlotTile,
  CapytorioWorldIcon,
} from './CapytorioSlotIcon';
import { CapytorioEntityInfoPanel } from './CapytorioEntityInfoPanel';
import { CapytorioPediaView } from './CapytorioPediaView';

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

const BlueprintMiniPreview: React.FC<{ blueprint: CapytorioSavedBlueprint }> = ({ blueprint }) => {
  if (blueprint.entries.length === 0) {
    return (
      <div className="w-full h-16 rounded-[2px] bg-[#0e1621] border border-[#223247] flex items-center justify-center text-[10px] text-[#6d7d92]">
        Empty
      </div>
    );
  }
  let minX = blueprint.entries[0].dx;
  let maxX = minX;
  let minZ = blueprint.entries[0].dz;
  let maxZ = minZ;
  for (let i = 1; i < blueprint.entries.length; i++) {
    const e = blueprint.entries[i];
    if (e.dx < minX) minX = e.dx;
    if (e.dx > maxX) maxX = e.dx;
    if (e.dz < minZ) minZ = e.dz;
    if (e.dz > maxZ) maxZ = e.dz;
  }
  const cols = Math.max(1, maxX - minX + 1);
  const rows = Math.max(1, maxZ - minZ + 1);
  const pad = 0.6;
  const vbW = cols + pad * 2;
  const vbH = rows + pad * 2;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-16 rounded-[2px] bg-[#0d1724] border border-[#233952]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={`bp-grid-${blueprint.id}`}
          width="1"
          height="1"
          patternUnits="userSpaceOnUse"
        >
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#1b314b" strokeWidth="0.06" />
        </pattern>
      </defs>
      <rect x={-pad} y={-pad} width={vbW} height={vbH} fill={`url(#bp-grid-${blueprint.id})`} />
      {blueprint.entries.map((entry, idx) => {
        const x = entry.dx - minX;
        const y = entry.dz - minZ;
        const spec = resolveCapytorioPlaceableSpec(entry.toolId);
        const color = hexToCss(spec?.tintHex ?? CAPYTORIO_MACHINE_SPECS[entry.baseType].colorHex);
        const cx = x + 0.5;
        const cy = y + 0.5;
        const rotDeg = entry.dir * 90;
        return (
          <g key={`${entry.dx},${entry.dz},${idx}`}>
            <rect
              x={x + 0.09}
              y={y + 0.09}
              width={0.82}
              height={0.82}
              rx={0.12}
              fill={color}
              fillOpacity={0.82}
              stroke="#e2f2ff"
              strokeOpacity={0.45}
              strokeWidth={0.06}
            />
            <polygon
              points="0,-0.26 0.2,0.16 -0.2,0.16"
              fill="#0b1220"
              fillOpacity={0.82}
              transform={`translate(${cx},${cy}) rotate(${rotDeg})`}
            />
          </g>
        );
      })}
    </svg>
  );
};

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
  const recipeLuaInputRef = useRef<HTMLInputElement | null>(null);
  const techLuaInputRef = useRef<HTMLInputElement | null>(null);
  const invSearchInputRef = useRef<HTMLInputElement | null>(null);
  const craftSearchInputRef = useRef<HTMLInputElement | null>(null);
  const assemblerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const techSearchInputRef = useRef<HTMLInputElement | null>(null);
  const blueprintSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCraftMachineType, setSelectedCraftMachineType] =
    useState<CapytorioMachineType>(CAPYTORIO_HOTBAR_ORDER[0]);
  const [focusedInvText, setFocusedInvText] = useState<string | null>(null);
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [craftSearchQuery, setCraftSearchQuery] = useState('');
  const [assemblerSearchQuery, setAssemblerSearchQuery] = useState('');
  const [assemblerRecipeGroup, setAssemblerRecipeGroup] =
    useState<CapytorioRecipeGroup>('logistics');
  const [techSearchQuery, setTechSearchQuery] = useState('');
  const [blueprintSearchQuery, setBlueprintSearchQuery] = useState('');
  const [hoverTooltip, setHoverTooltip] = useState<{
    title: string;
    subtitle?: string;
    description?: string;
    machineType?: CapytorioMachineType;
    itemShape?: CapytorioItemShape;
    color: string;
    footprint?: string;
    stockCount?: number;
    outputCount?: number;
    craftTimeSec?: number;
    ingredients?: Array<{ id: string; name: string; have: number; need: number }>;
    hint?: string;
    anchorRect: { left: number; right: number; top: number; bottom: number };
  } | null>(null);

  useEffect(() => {
    setHoverTooltip(null);
  }, [drawerTab]);

  const showSlotTooltip = (
    el: HTMLElement,
    data: {
      title: string;
      subtitle?: string;
      description?: string;
      machineType?: CapytorioMachineType;
      itemShape?: CapytorioItemShape;
      color: string;
      footprint?: string;
      stockCount?: number;
      outputCount?: number;
      craftTimeSec?: number;
      ingredients?: Array<{ id: string; name: string; have: number; need: number }>;
      hint?: string;
    }
  ) => {
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
  const recentSlots = snap.recentTools.slice(0, 10);
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

  const activeAssemblerRecipeId =
    inspected?.type === 'assembler' ? inspected.recipeId : snap.selectedRecipeId;
  const assemblerGroupTabs = GROUP_TABS.filter(
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
                      Resources & Crafted Entities
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
                          const resolvedColor = placeable?.tintHex ? hexToCss(placeable.tintHex) : meta.cssColor;
                          const openTip = (el: HTMLElement) => {
                            setFocusedInvText(`${meta.name} ×${qty}`);
                            showSlotTooltip(el, {
                              title: meta.name,
                              subtitle: placeable ? 'Placeable Entity' : meta.category,
                              description: placeable
                                ? CAPYTORIO_MACHINE_SPECS[placeable.baseType]?.description
                                : undefined,
                              machineType: placeable?.baseType,
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
                      {GROUP_TABS.map((tab) => {
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
                    {(craftGroup === 'machines' && !craftNeedle) ? (
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
                  <div className="relative w-32 sm:w-44">
                    <Search className="w-3 h-3 text-[#8e95a2] absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={techSearchInputRef}
                      type="text"
                      value={techSearchQuery}
                      onChange={(e) => setTechSearchQuery(e.target.value)}
                      data-testid="capytorio-tech-search"
                      placeholder="Search tech [Ctrl+F]..."
                      aria-label="Search Technology"
                      className="w-full h-6 pl-5 pr-4 rounded-[2px] bg-[#101216] border border-[#2f333d] focus:border-[#e58926] outline-none text-[10px] text-[#eef1f5] placeholder-[#6c7382]"
                    />
                    {techSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTechSearchQuery('')}
                        aria-label="Clear tech search"
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-[#8e95a2] hover:text-[#eef1f5] cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
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
                {CAPYTORIO_TECHS.filter((t) => {
                  const q = techSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    t.name.toLowerCase().includes(q) ||
                    t.id.toLowerCase().includes(q) ||
                    t.effectSummary.toLowerCase().includes(q)
                  );
                }).map((tech) => {
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
                      title={`${tech.name} — Click research · Alt+Click Pedia`}
                      onClick={(e) => {
                        if (e.altKey) {
                          e.preventDefault();
                          onOpenPedia(`tech:${tech.id}`);
                          return;
                        }
                        onSelectTech(tech.id);
                      }}
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

          {/* BLUEPRINT LIBRARY MODAL (Last 100 Cut/Copy Selections) */}
          {drawerTab === 'blueprints' && (
            <div
              data-testid="capytorio-drawer-blueprints"
              role="dialog"
              aria-label="Blueprint Library"
              onClick={(e) => e.stopPropagation()}
              className={`${FACTORIO_PANEL_FRAME} w-full max-w-[780px] max-h-full flex flex-col overflow-hidden text-[#e6e8ec]`}
            >
              <div className={FACTORIO_HEADER_BAR}>
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                  <span className="text-xs font-bold tracking-wider uppercase text-[#f4b054] whitespace-nowrap">
                    Blueprint Library
                  </span>
                  <span
                    data-testid="capytorio-blueprint-library-count"
                    className="text-[10px] font-mono tabular-nums text-[#9aa0ac] whitespace-nowrap"
                  >
                    {snap.blueprintLibrary.length} / {MAX_CAPYTORIO_BLUEPRINT_LIBRARY}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="relative w-32 sm:w-44">
                    <Search className="w-3 h-3 text-[#8e95a2] absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={blueprintSearchInputRef}
                      type="text"
                      value={blueprintSearchQuery}
                      onChange={(e) => setBlueprintSearchQuery(e.target.value)}
                      data-testid="capytorio-blueprint-search"
                      placeholder="Search [Ctrl+F]..."
                      aria-label="Search Blueprint Library"
                      className="w-full h-6 pl-5 pr-4 rounded-[2px] bg-[#101216] border border-[#2f333d] focus:border-[#e58926] outline-none text-[10px] text-[#eef1f5] placeholder-[#6c7382]"
                    />
                    {blueprintSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setBlueprintSearchQuery('')}
                        aria-label="Clear blueprint search"
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-[#8e95a2] hover:text-[#eef1f5] cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  {snap.blueprintLibrary.length > 0 && (
                    <button
                      type="button"
                      data-testid="capytorio-blueprint-clear-all-btn"
                      onClick={() => {
                        onClearBlueprintLibrary();
                      }}
                      className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer ${FACTORIO_BTN_IDLE}`}
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Close Blueprint Library"
                    onClick={() => setDrawerTab('none')}
                    className={`h-6 w-6 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-[#181b20] border-b border-[#2b303a] text-[10px] text-[#9aa0ac] flex flex-wrap items-center justify-between gap-2">
                <span>
                  Every Copy [Ctrl+C] and Cut [Ctrl+X] is saved automatically (newest first, up to 100).
                </span>
                <span className="font-mono text-[#bae6fd]">
                  [R] Rotate · [H] Flip H · [V] Flip V
                </span>
              </div>

              <div className="p-3 overflow-y-auto flex-1 min-h-0">
                {snap.blueprintLibrary.length === 0 ? (
                  <div
                    data-testid="capytorio-blueprint-library-empty"
                    className={`${FACTORIO_WELL} p-6 text-center space-y-1.5`}
                  >
                    <div className="text-xs font-semibold text-[#e4e6eb]">
                      No saved blueprints yet
                    </div>
                    <p className="text-[11px] text-[#9aa0ac]">
                      Use Copy [Ctrl+C] or Cut [Ctrl+X] and drag a Box or Lasso around buildings to save them here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {snap.blueprintLibrary
                      .filter((bp) => {
                        const q = blueprintSearchQuery.trim().toLowerCase();
                        if (!q) return true;
                        return bp.label.toLowerCase().includes(q) || bp.sourceMode.includes(q);
                      })
                      .map((bp, idx) => {
                      const isActive =
                        clip.toolState === 'paste' && clip.activeBlueprintId === bp.id;
                      return (
                        <div
                          key={bp.id}
                          data-testid={`capytorio-blueprint-card-${bp.id}`}
                          data-blueprint-index={idx}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            onSelectBlueprint(bp.id);
                            setDrawerTab('none');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectBlueprint(bp.id);
                              setDrawerTab('none');
                            }
                          }}
                          className={`group relative rounded-[2px] p-1.5 text-left cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-[#2a2319] border border-[#e58926]'
                              : 'bg-[#16191f] hover:bg-[#1f242d] border border-[#2f3541]'
                          }`}
                        >
                          <BlueprintMiniPreview blueprint={bp} />
                          <div className="mt-1.5 flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-[#eef1f5] truncate">
                                {bp.label}
                              </div>
                              <div className="text-[10px] font-mono tabular-nums text-[#9aa0ac] truncate">
                                {bp.width}×{bp.height} · {bp.entries.length}{' '}
                                {bp.entries.length === 1 ? 'item' : 'items'} ·{' '}
                                {bp.sourceMode === 'cut' ? 'Cut' : 'Copy'}
                              </div>
                            </div>
                            <button
                              type="button"
                              data-testid={`capytorio-blueprint-delete-${bp.id}`}
                              title="Remove from Blueprint Library"
                              aria-label={`Delete blueprint ${bp.label}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteBlueprint(bp.id);
                              }}
                              className="h-5 w-5 rounded-[2px] flex items-center justify-center shrink-0 text-[#8e95a2] hover:text-[#fca5a5] hover:bg-[#3a1f22] cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CAPYTORIOPEDIA ENCYCLOPEDIA & HELP WINDOW (Alt + Left-Click anywhere) */}
          {drawerTab === 'pedia' && (
            <CapytorioPediaView
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
          )}
        </div>
      )}

      {/* FACTORIO TOP-RIGHT LIVE ENTITY / TILE INFO WINDOW */}
      {drawerTab === 'none' && activeInfoTarget && (
        <CapytorioEntityInfoPanel
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
      <section
        data-testid="capytorio-build-bar"
        aria-label="Capytorio Factorio Quickbar"
        className="fixed bottom-1.5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[calc(100vw-12px)] max-w-[780px] text-[#e6e8ec]"
      >
        <div className={`${FACTORIO_PANEL_FRAME} overflow-hidden`}>
          {/* SELECTED ITEM STATUS BAR */}
          {(() => {
            const selectedPlaceable =
              !isClipboardActive &&
              snap.selectedTool !== 'mine' &&
              snap.selectedTool !== 'demolish'
                ? resolveCapytorioPlaceableSpec(snap.selectedTool)
                : null;
            const selectedStock = selectedPlaceable
              ? selectedPlaceable.isBaseMachine
                ? snap.pocketMachines[selectedPlaceable.baseType] ?? 0
                : snap.pocketItems[selectedPlaceable.id] ?? 0
              : null;
            const selectedFp = selectedPlaceable
              ? getCapytorioFootprint(
                  selectedPlaceable.baseType,
                  selectedPlaceable.isBaseMachine ? undefined : selectedPlaceable.id,
                  snap.selectedDir
                )
              : null;
            let statusName = 'Hand Mine & Inspect';
            let statusMeta = 'Click tile to inspect · [E] Mine or Pickup';
            if (isClipboardActive) {
              if (clip.toolState === 'paste') {
                statusName = `Blueprint Paste (${clip.count})`;
                statusMeta = 'Position ghost · [Enter] Place · [R] Rotate';
              } else if (clip.toolState === 'select_cut') {
                statusName = 'Cut Selection Tool';
                statusMeta = 'Drag box or lasso to cut buildings';
              } else {
                statusName = 'Copy Selection Tool';
                statusMeta = 'Drag box or lasso to copy blueprint';
              }
            } else if (snap.selectedTool === 'demolish') {
              statusName = 'Demolish Tool';
              statusMeta = 'Click or drag to remove (100% refund)';
            } else if (selectedPlaceable) {
              statusName = selectedPlaceable.name;
              statusMeta = `${selectedFp ? `${selectedFp.width}×${selectedFp.height}` : '1×1'} · Facing ${DIR_LABELS[snap.selectedDir]}`;
            }
            return (
              <div
                data-testid="capytorio-selected-status-bar"
                className="h-[22px] px-2 bg-[#15171c] border-b border-[#2c303a] flex items-center justify-between gap-2 text-[10.5px] leading-none"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isClipboardActive ? (
                    clip.toolState === 'paste' ? (
                      <ClipboardPaste className="w-3 h-3 shrink-0 text-[#7ce680]" />
                    ) : clip.toolState === 'select_cut' ? (
                      <Scissors className="w-3 h-3 shrink-0 text-[#f4b054]" />
                    ) : (
                      <Copy className="w-3 h-3 shrink-0 text-[#38bdf8]" />
                    )
                  ) : snap.selectedTool === 'demolish' ? (
                    <Trash2 className="w-3 h-3 shrink-0 text-[#f2857c]" />
                  ) : selectedPlaceable ? (
                    <CapytorioMachineIcon
                      machineType={selectedPlaceable.baseType}
                      color={hexToCss(selectedPlaceable.tintHex)}
                      size={14}
                      className="shrink-0"
                    />
                  ) : (
                    <Search className="w-3 h-3 shrink-0 text-[#f4b054]" />
                  )}
                  <span
                    data-testid="capytorio-selected-item-name"
                    className="font-bold text-[#f4b054] truncate"
                  >
                    {statusName}
                  </span>
                  <span className="text-[#4a505d] shrink-0" aria-hidden="true">
                    ·
                  </span>
                  {selectedStock !== null ? (
                    <span className="font-mono tabular-nums text-[10px] text-[#b4bac6] whitespace-nowrap truncate">
                      <span className={selectedStock === 0 ? 'text-[#f2857c] font-semibold' : 'text-[#86ef92] font-semibold'}>
                        ×{selectedStock}
                      </span>
                      {' · '}
                      {statusMeta}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#9aa0ac] truncate">{statusMeta}</span>
                  )}
                </div>
                <span className="hidden sm:inline font-mono text-[9.5px] text-[#7c8391] whitespace-nowrap shrink-0">
                  [R] Rotate · [Q] Pipette · [Alt+Click] Pedia
                </span>
              </div>
            );
          })()}

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
                const fp = getCapytorioFootprint(
                  resolved.baseType,
                  resolved.isBaseMachine ? undefined : resolved.id
                );
                const openBarTip = (el: HTMLElement) =>
                  showSlotTooltip(el, {
                    title: resolved.name,
                    subtitle: `Quickbar [${hotkey}]`,
                    description: resolved.description,
                    machineType: resolved.baseType,
                    color: hexToCss(resolved.tintHex),
                    footprint: `${fp.width}×${fp.height}`,
                    stockCount: count,
                    hint: 'Click Equip · Alt+Click Pedia',
                  });
                return (
                  <CapytorioSlotTile
                    key={toolId}
                    mini
                    suppressNativeTitle
                    recentSlot
                    testId={`capytorio-tool-${toolId}`}
                    label={resolved.shortName}
                    title={`${resolved.name} [${hotkey}]`}
                    hotkey={hotkey}
                    count={count}
                    selected={selected}
                    dimmed={count === 0 && !selected}
                    machineType={resolved.baseType}
                    color={hexToCss(resolved.tintHex)}
                    onMouseEnter={(e) => openBarTip(e.currentTarget)}
                    onFocus={(e) => openBarTip(e.currentTarget)}
                    onMouseLeave={hideSlotTooltip}
                    onBlur={hideSlotTooltip}
                    onClick={(e) => {
                      if (e.altKey) {
                        e.preventDefault();
                        hideSlotTooltip();
                        onOpenPedia(toolId);
                        return;
                      }
                      onSelectTool(toolId, false);
                    }}
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
                title="Cut / Copy / Paste & Blueprint Library [Ctrl+C / Ctrl+X / Ctrl+V / B]"
                onClick={() => {
                  if (isClipboardActive) {
                    onClearClipboard();
                  } else {
                    setDrawerTab('none');
                    onSetClipboardMode('select_copy', clip.selectionShape);
                  }
                }}
                className={`h-9 px-1.5 sm:px-2 rounded-[2px] text-[9px] font-semibold whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${
                  isClipboardActive || drawerTab === 'blueprints'
                    ? FACTORIO_BTN_ACTIVE
                    : FACTORIO_BTN_IDLE
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

      {/* FLOATING FACTORIO-STYLE ITEM / RECIPE HOVER TOOLTIP */}
      {hoverTooltip && (() => {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const tipWidth = 248;
        const estHeight =
          96 +
          (hoverTooltip.description ? 38 : 0) +
          (hoverTooltip.ingredients && hoverTooltip.ingredients.length > 0
            ? 28 + hoverTooltip.ingredients.length * 18
            : 0);
        const ar = hoverTooltip.anchorRect;
        // If hovering a bottom quickbar slot, clear the Selected Item Status Bar above it
        const isInBottomBar = ar.bottom >= vh - 68;
        const clearTop = isInBottomBar ? Math.min(ar.top, vh - 76) : ar.top;
        // Prefer placing above the tile using exact CSS `bottom` so multi-line descriptions never overlap the tile
        const placeAbove = clearTop - estHeight - 8 >= 8 || clearTop >= vh - ar.bottom;
        const verticalStyle: React.CSSProperties = placeAbove
          ? { bottom: `${Math.max(8, Math.round(vh - clearTop + 8))}px` }
          : { top: `${Math.max(8, Math.min(vh - 60, Math.round(ar.bottom + 8)))}px` };
        // Center horizontally on tile, clamped within viewport
        let left = (ar.left + ar.right) * 0.5 - tipWidth * 0.5;
        left = Math.max(8, Math.min(vw - tipWidth - 8, left));
        return (
          <div
            data-testid="capytorio-item-tooltip"
            role="tooltip"
            style={{ left: `${Math.round(left)}px`, width: `${tipWidth}px`, ...verticalStyle }}
            className={`fixed z-[80] pointer-events-none ${FACTORIO_PANEL_FRAME} bg-[#181a20]/98 text-[#e6e8ec] p-2 space-y-1.5`}
          >
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-[2px] bg-[#101216] border border-[#2f333d] flex items-center justify-center shrink-0">
                {hoverTooltip.machineType ? (
                  <CapytorioMachineIcon
                    machineType={hoverTooltip.machineType}
                    color={hoverTooltip.color}
                    size={22}
                  />
                ) : (
                  <CapytorioItemIcon
                    shape={hoverTooltip.itemShape ?? 'crate'}
                    color={hoverTooltip.color}
                    size={22}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-bold text-[#f4b054] leading-tight truncate">
                  {hoverTooltip.title}
                </div>
                <div className="text-[9.5px] font-mono tabular-nums text-[#9aa0ac] leading-tight mt-0.5 flex flex-wrap items-center gap-x-1">
                  {hoverTooltip.subtitle && <span className="capitalize">{hoverTooltip.subtitle}</span>}
                  {hoverTooltip.footprint && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#d6dbe5]">{hoverTooltip.footprint}</span>
                    </>
                  )}
                  {hoverTooltip.stockCount !== undefined && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className={hoverTooltip.stockCount > 0 ? 'text-[#86ef92]' : 'text-[#9aa0ac]'}>
                        In Pocket: {hoverTooltip.stockCount}
                      </span>
                    </>
                  )}
                  {hoverTooltip.craftTimeSec !== undefined && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{hoverTooltip.craftTimeSec}s</span>
                    </>
                  )}
                  {hoverTooltip.outputCount !== undefined && hoverTooltip.outputCount > 1 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#f4b054]">Yields ×{hoverTooltip.outputCount}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {hoverTooltip.description && (
              <p className="text-[10px] leading-snug text-[#c5cbd6] border-t border-[#2b2e35] pt-1">
                {hoverTooltip.description}
              </p>
            )}

            {hoverTooltip.ingredients && hoverTooltip.ingredients.length > 0 && (
              <div className="border-t border-[#2b2e35] pt-1 space-y-0.5">
                <div className="text-[9px] font-mono uppercase tracking-wider text-[#8e95a2]">
                  Ingredients
                </div>
                {hoverTooltip.ingredients.map((ing) => {
                  const ok = ing.have >= ing.need;
                  return (
                    <div
                      key={ing.id}
                      className="flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums"
                    >
                      <span className="text-[#d4d8e1] truncate">{ing.name}</span>
                      <span className={ok ? 'text-[#86ef92] font-semibold shrink-0' : 'text-[#f2857c] font-semibold shrink-0'}>
                        {ing.have}/{ing.need}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {hoverTooltip.hint && (
              <div className="text-[9px] font-mono text-[#7f8694] border-t border-[#2b2e35] pt-1">
                {hoverTooltip.hint}
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
};
