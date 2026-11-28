import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Flame,
  Hammer,
  Package,
  Pickaxe,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  CAPYTORIO_CHEST_ITEMS_PER_SLOT,
  CAPYTORIO_CHEST_SLOTS,
  CAPYTORIO_ITEM_CATALOG,
  getCapytorioItemMeta,
  resolveCapytorioItemShape,
  type CapytorioItemId,
} from '../engine/CapytorioData';
import type {
  CapytorioInspectedMachineDetail,
  CapytorioInserterFilterMode,
  CapytorioSplitterPriority,
  CapytorioTileInspection,
} from '../engine/CapytorioFactoryEngine';
import { resolvePediaIdFromTileInspection } from '../engine/CapytorioPedia';
import {
  CapytorioItemIcon,
  CapytorioMachineIcon,
  CapytorioWorldIcon,
} from './CapytorioSlotIcon';

const DIR_LABELS = ['N', 'E', 'S', 'W'] as const;

const FACTORIO_INFO_FRAME =
  'rounded-[2px] bg-[#1b1d22]/94 border border-[#4a4f5b] border-b-[#0e1014] border-r-[#0e1014] shadow-[0_6px_18px_rgba(0,0,0,0.62)]';

const FACTORIO_INFO_BTN =
  'bg-[#2b2e35] hover:bg-[#3a3f4a] border border-[#4a4f5b] border-b-[#121418] border-r-[#121418] text-[#e4e6eb]';

const FACTORIO_INFO_BTN_AMBER =
  'bg-[#e58926] hover:bg-[#ef9837] border border-[#f8c173] border-b-[#8b4f0f] border-r-[#8b4f0f] text-[#151618] font-bold';

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function getStatusDotClass(status: CapytorioInspectedMachineDetail['status']): string {
  switch (status) {
    case 'Working':
      return 'bg-[#5cd660]';
    case 'Full':
      return 'bg-[#f4b054]';
    case 'No Power':
    case 'No Fuel':
    case 'No Resource':
      return 'bg-[#e85d50]';
    case 'Idle':
    default:
      return 'bg-[#8e95a2]';
  }
}

function getStatusTextClass(status: CapytorioInspectedMachineDetail['status']): string {
  switch (status) {
    case 'Working':
      return 'text-[#7ce680]';
    case 'Full':
      return 'text-[#f4b054]';
    case 'No Power':
    case 'No Fuel':
    case 'No Resource':
      return 'text-[#f2857c]';
    case 'Idle':
    default:
      return 'text-[#b4bac6]';
  }
}

export interface CapytorioEntityInfoPanelProps {
  info: CapytorioTileInspection;
  isPinned: boolean;
  isTopBarVisible: boolean;
  catalogVersion?: number;
  entitySettingsClipboard?: {
    sourceType: 'assembler' | 'splitter' | 'inserter' | 'chest';
    sourceLabel: string;
  } | null;
  onClearPin: () => void;
  onOpenMachineModal: (gx: number, gz: number) => void;
  onRotateMachineAt: (gx: number, gz: number) => void;
  onDemolishMachineAt: (gx: number, gz: number) => void;
  onMineTileAt: (gx: number, gz: number) => void;
  onTakeOutputs: (gx: number, gz: number) => void;
  onCollectAllOutputs: () => void;
  onOpenPedia: (entryId: string, contextInfo: CapytorioTileInspection) => void;
  onCopyEntitySettings?: (gx: number, gz: number) => void;
  onPasteEntitySettings?: (gx: number, gz: number) => void;
  onSetSplitterConfig?: (
    gx: number,
    gz: number,
    config: {
      inputPriority?: CapytorioSplitterPriority;
      outputPriority?: CapytorioSplitterPriority;
      filterItem?: CapytorioItemId | null;
    }
  ) => void;
  onSetInserterConfig?: (
    gx: number,
    gz: number,
    config: {
      filterMode?: CapytorioInserterFilterMode;
      filters?: CapytorioItemId[];
      stackLimit?: number | null;
    }
  ) => void;
  onSetChestSlotLimit?: (gx: number, gz: number, slotLimit: number | null) => void;
}

export const CapytorioEntityInfoPanel: React.FC<CapytorioEntityInfoPanelProps> = React.memo(({
  info,
  isPinned,
  isTopBarVisible,
  catalogVersion = 0,
  entitySettingsClipboard,
  onClearPin,
  onOpenMachineModal,
  onRotateMachineAt,
  onDemolishMachineAt,
  onMineTileAt,
  onTakeOutputs,
  onCollectAllOutputs,
  onOpenPedia,
  onCopyEntitySettings,
  onPasteEntitySettings,
  onSetSplitterConfig,
  onSetInserterConfig,
  onSetChestSlotLimit,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

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
  }, [catalogVersion]);

  const m = info.machine;
  const isBeltLike =
    m !== null && (m.type === 'belt' || m.type === 'splitter' || m.type === 'tunnel');
  const inputEntries = m
    ? Object.entries(m.inputBuffer).filter(([, qty]) => (qty ?? 0) > 0)
    : [];
  const outputEntries = m
    ? Object.entries(m.outputBuffer).filter(([, qty]) => (qty ?? 0) > 0)
    : [];
  const totalStored = outputEntries.reduce((sum, [, qty]) => sum + (qty ?? 0), 0);

  const renderIcon = (size: number) => {
    if (m) {
      return (
        <CapytorioMachineIcon
          machineType={m.type}
          variantItemId={m.variantItemId}
          color={hexToCss(m.colorHex)}
          size={size}
          className="shrink-0"
        />
      );
    }
    if (info.tree) {
      return <CapytorioWorldIcon kind="tree" size={size} className="shrink-0" />;
    }
    if (info.resource) {
      const meta = getCapytorioItemMeta(info.resource.id);
      const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
      return (
        <CapytorioItemIcon
          shape={shape}
          color={meta.cssColor}
          size={size}
          className="shrink-0"
        />
      );
    }
    if (info.spilledItems.length > 0) {
      const firstMeta = getCapytorioItemMeta(info.spilledItems[0].item);
      const shape =
        firstMeta.shape ?? resolveCapytorioItemShape(firstMeta.id, firstMeta.category);
      return (
        <CapytorioItemIcon
          shape={shape}
          color={firstMeta.cssColor}
          size={size}
          className="shrink-0"
        />
      );
    }
    if (info.isBeacon) {
      return <CapytorioWorldIcon kind="beacon" size={size} className="shrink-0" />;
    }
    return <CapytorioWorldIcon kind="terrain" size={size} className="shrink-0" />;
  };

  // Concise single-line readout for collapsed minimal mode
  const renderCompactSummary = () => {
    if (m && isBeltLike) {
      return (
        <div className="flex items-center justify-between gap-1 px-1.5 py-[2px] border-t border-[#2c303a] font-mono tabular-nums text-[9px] leading-tight">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotClass(m.status)}`}
              aria-hidden="true"
            />
            <span
              data-testid="capytorio-info-belt-count"
              className={`font-bold ${
                m.beltCapacity > 0 && m.beltItemCount >= m.beltCapacity
                  ? 'text-[#f4b054]'
                  : m.beltItemCount > 0
                    ? 'text-[#7ce680]'
                    : 'text-[#a3aab7]'
              }`}
            >
              {m.beltItemCount}/{m.beltCapacity}
            </span>
            <span className="text-[#8e95a2] truncate">
              L{m.beltLeftLaneCount}·R{m.beltRightLaneCount}
            </span>
          </div>
          <div className="flex items-center gap-[2px] shrink-0">
            {m.type === 'splitter' && (
              <button
                type="button"
                data-testid="capytorio-info-configure-btn"
                onClick={() => onOpenMachineModal(m.gx, m.gz)}
                title="Configure Splitter Priority & Filter"
                aria-label="Configure Splitter"
                className={`w-[18px] h-[18px] rounded-[1px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN_AMBER}`}
              >
                <SlidersHorizontal className="w-2.5 h-2.5" />
              </button>
            )}
            {m.beltItemCount > 0 && (
              <button
                type="button"
                data-testid="capytorio-info-pickup-btn"
                onClick={() => onTakeOutputs(m.gx, m.gz)}
                title={`Pick up ${m.beltItemCount} belt item${m.beltItemCount === 1 ? '' : 's'} [E / F]`}
                aria-label="Pick up items from belt"
                className={`w-[18px] h-[18px] rounded-[1px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN_AMBER}`}
              >
                <Package className="w-2.5 h-2.5" />
              </button>
            )}
            <button
              type="button"
              data-testid="capytorio-info-rotate-btn"
              onClick={() => onRotateMachineAt(m.gx, m.gz)}
              title="Rotate [R]"
              aria-label="Rotate building"
              className={`w-[18px] h-[18px] rounded-[1px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN}`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              data-testid="capytorio-info-delete-btn"
              onClick={() => onDemolishMachineAt(m.gx, m.gz)}
              title="Delete & refund [X]"
              aria-label="Delete building"
              className="w-[18px] h-[18px] rounded-[1px] flex items-center justify-center cursor-pointer bg-[#3a1a1a] hover:bg-[#562424] border border-[#8e3a36] text-[#f7a8a3]"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      );
    }

    if (m) {
      let compactStat: string = m.status;
      if (m.type === 'generator') {
        compactStat =
          m.isFuelGenerator === false || m.fuelTimer > 0
            ? `${m.powerSupplyMw.toFixed(1)}MW`
            : 'No Fuel';
      } else if (m.type === 'inserter' && m.isFunctionalInserter !== false) {
        compactStat = m.holdingItem
          ? getCapytorioItemMeta(m.holdingItem).shortName
          : m.inserterReach === 2
            ? '2-Tile'
            : m.status;
      } else if (m.type === 'chest' && m.isStorageChest !== false) {
        const cap = m.chestCapacityItems ?? CAPYTORIO_CHEST_SLOTS * CAPYTORIO_CHEST_ITEMS_PER_SLOT;
        compactStat = `${totalStored}/${cap}`;
      } else if (m.status === 'Working') {
        compactStat = `${Math.round(m.craftProgress * 100)}%`;
      }

      return (
        <div className="flex items-center justify-between gap-1 px-1.5 py-[2px] border-t border-[#2c303a] font-mono tabular-nums text-[9px] leading-tight">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotClass(m.status)}`}
              aria-hidden="true"
            />
            <span className={`font-semibold truncate ${getStatusTextClass(m.status)}`}>
              {compactStat}
            </span>
          </div>
          <div className="flex items-center gap-[2px] shrink-0">
            <button
              type="button"
              data-testid="capytorio-info-open-btn"
              onClick={() => onOpenMachineModal(m.gx, m.gz)}
              title="Open machine controls"
              aria-label="Open machine controls"
              className={`w-[18px] h-[18px] rounded-[1px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN_AMBER}`}
            >
              <SlidersHorizontal className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              data-testid="capytorio-info-rotate-btn"
              onClick={() => onRotateMachineAt(m.gx, m.gz)}
              title="Rotate [R]"
              aria-label="Rotate building"
              className={`w-[18px] h-[18px] rounded-[1px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN}`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              data-testid="capytorio-info-delete-btn"
              onClick={() => onDemolishMachineAt(m.gx, m.gz)}
              title="Delete & refund [X]"
              aria-label="Delete building"
              className="w-[18px] h-[18px] rounded-[1px] flex items-center justify-center cursor-pointer bg-[#3a1a1a] hover:bg-[#562424] border border-[#8e3a36] text-[#f7a8a3]"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      );
    }

    if (info.resource) {
      return (
        <div className="flex items-center justify-between gap-1 px-1.5 py-[2px] border-t border-[#2c303a] font-mono tabular-nums text-[9px] leading-tight">
          <span
            data-testid="capytorio-info-resource-amount"
            className="font-bold text-[#f4b054] truncate"
          >
            {info.resource.remaining.toLocaleString()}
          </span>
          <button
            type="button"
            data-testid="capytorio-info-mine-btn"
            onClick={() => onMineTileAt(info.gx, info.gz)}
            title={`Mine +${info.resource.harvestAmount} [E]`}
            className={`h-[18px] px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center gap-0.5 shrink-0 ${FACTORIO_INFO_BTN_AMBER}`}
          >
            <Pickaxe className="w-2.5 h-2.5 shrink-0" />
            <span>+{info.resource.harvestAmount}</span>
          </button>
        </div>
      );
    }

    if (info.tree) {
      return (
        <div className="flex items-center justify-between gap-1 px-1.5 py-[2px] border-t border-[#2c303a] font-mono tabular-nums text-[9px] leading-tight">
          <span className="text-[#ffe4b5] truncate">+{info.tree.yieldCount} Orange</span>
          <button
            type="button"
            data-testid="capytorio-info-chop-btn"
            onClick={() => onMineTileAt(info.gx, info.gz)}
            title={`Chop tree (+${info.tree.yieldCount}) [E]`}
            className={`h-[18px] px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center gap-0.5 shrink-0 ${FACTORIO_INFO_BTN_AMBER}`}
          >
            <Hammer className="w-2.5 h-2.5 shrink-0" />
            <span>Chop</span>
          </button>
        </div>
      );
    }

    if (info.spilledTotalCount > 0) {
      return (
        <div className="flex items-center justify-between gap-1 px-1.5 py-[2px] border-t border-[#2c303a] font-mono tabular-nums text-[9px] leading-tight">
          <span className="text-[#f4b054] font-bold truncate">
            {info.spilledTotalCount} on floor
          </span>
          <button
            type="button"
            data-testid="capytorio-info-collect-btn"
            onClick={onCollectAllOutputs}
            title="Collect spilled items"
            className={`h-[18px] px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center gap-0.5 shrink-0 ${FACTORIO_INFO_BTN_AMBER}`}
          >
            <Package className="w-2.5 h-2.5 shrink-0" />
            <span>Get</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-1 px-1.5 py-[2px] border-t border-[#2c303a] font-mono tabular-nums text-[9px] text-[#9aa0ac] leading-tight">
        <span>
          ({info.gx},{info.gz})
        </span>
        <span className="truncate">{info.isBeacon ? 'Home [H]' : 'Buildable'}</span>
      </div>
    );
  };

  return (
    <aside
      data-testid="capytorio-entity-info-panel"
      data-expanded={isExpanded ? 'true' : 'false'}
      aria-label="Factorio Entity Info Window"
      className={`fixed right-[calc(0.5rem+var(--sar))] z-30 pointer-events-auto text-[#e6e8ec] select-none transition-[width] duration-150 ${
        isTopBarVisible ? 'top-[calc(84px+var(--sat))]' : 'top-[calc(78px+var(--sat))]'
      } ${isExpanded ? 'w-[200px] sm:w-[224px]' : 'w-[160px] sm:w-[164px]'}`}
    >
      <div className={`${FACTORIO_INFO_FRAME} overflow-hidden`}>
        {/* Ultra-Compact Header Bar (Click anywhere on title to expand/collapse) */}
        <div className="px-1.5 py-[3px] bg-[#292c34] flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Collapse info window' : 'Expand for full details'}
            className="flex items-center gap-1 min-w-0 flex-1 text-left cursor-pointer"
          >
            {renderIcon(13)}
            <span
              data-testid="capytorio-info-title"
              className="text-[10px] font-bold tracking-tight text-[#f4b054] truncate leading-none"
            >
              {info.title}
            </span>
          </button>

          <div className="flex items-center gap-[2px] shrink-0">
            <button
              type="button"
              data-testid="capytorio-info-pedia-btn"
              onClick={() => onOpenPedia(resolvePediaIdFromTileInspection(info), info)}
              title="Open in Capytoriopedia [Alt + Left-Click]"
              aria-label="Open in Capytoriopedia"
              className={`w-4 h-4 rounded-[1px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN}`}
            >
              <BookOpen className="w-2.5 h-2.5 text-[#f4b054]" />
            </button>

            <button
              type="button"
              data-testid="capytorio-info-expand-btn"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse info' : 'Expand info'}
              title={isExpanded ? 'Show less' : 'Show more details'}
              className={`w-4 h-4 rounded-[1px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN}`}
            >
              {isExpanded ? (
                <ChevronUp className="w-2.5 h-2.5" />
              ) : (
                <ChevronDown className="w-2.5 h-2.5" />
              )}
            </button>

            {isPinned && (
              <button
                type="button"
                data-testid="capytorio-info-clear-btn"
                onClick={onClearPin}
                title="Clear selection"
                aria-label="Clear selection"
                className={`w-4 h-4 rounded-[1px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* COLLAPSED: Minimal single-line summary */}
        {!isExpanded && renderCompactSummary()}

        {/* EXPANDED: Tight high-density Factorio details with zero wasted padding */}
        {isExpanded && (
          <div className="border-t border-[#121317] divide-y divide-[#282b33] text-[9.5px] leading-tight">
            {/* Coords & Category */}
            <div className="px-1.5 py-0.5 bg-[#15171b] flex items-center justify-between gap-1.5 font-mono tabular-nums text-[8.5px] text-[#9aa0ac]">
              <span className="shrink-0 whitespace-nowrap">
                ({info.gx},{info.gz})
              </span>
              <span className="truncate text-right">{info.subtitle}</span>
            </div>

            {/* Machine Status & Power */}
            {m && (
              <div className="px-1.5 py-1 flex items-center justify-between gap-1 font-mono tabular-nums">
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotClass(m.status)}`}
                    aria-hidden="true"
                  />
                  <span className={`font-semibold truncate ${getStatusTextClass(m.status)}`}>
                    {m.status}
                  </span>
                </div>
                <span className="text-[#a3aab7] shrink-0 text-[9px]">
                  {m.width}×{m.height} · {DIR_LABELS[m.dir] ?? 'E'}
                  {m.type === 'generator'
                    ? ` · ${m.powerSupplyMw.toFixed(1)}MW`
                    : m.powerDemandMw > 0
                      ? ` · ${m.powerDemandMw.toFixed(1)}MW`
                      : ''}
                </span>
              </div>
            )}

            {/* Belt Item Count & Lanes */}
            {m && isBeltLike && (
              <div className="px-1.5 py-1 bg-[#14161a] space-y-1">
                <div className="flex items-center justify-between font-mono tabular-nums">
                  <span className="text-[#9aa0ac] text-[9px]">Items on belt</span>
                  <span
                    data-testid="capytorio-info-belt-count"
                    className={`font-bold ${
                      m.beltCapacity > 0 && m.beltItemCount >= m.beltCapacity
                        ? 'text-[#f4b054]'
                        : m.beltItemCount > 0
                          ? 'text-[#7ce680]'
                          : 'text-[#8e95a2]'
                    }`}
                  >
                    {m.beltItemCount} / {m.beltCapacity}
                  </span>
                </div>

                <div className="h-1 w-full bg-[#0b0d10] overflow-hidden">
                  <div
                    className={
                      m.beltCapacity > 0 && m.beltItemCount >= m.beltCapacity
                        ? 'h-full bg-[#e58926]'
                        : 'h-full bg-[#45b649]'
                    }
                    style={{
                      width: `${
                        m.beltCapacity > 0
                          ? Math.min(100, Math.round((m.beltItemCount / m.beltCapacity) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div
                  data-testid="capytorio-info-belt-lanes"
                  className="flex items-center justify-between text-[8.5px] font-mono tabular-nums text-[#9aa0ac]"
                >
                  <span>
                    L {m.beltLeftLaneCount}/{m.beltLeftLaneCapacity} · R {m.beltRightLaneCount}/
                    {m.beltRightLaneCapacity}
                  </span>
                  <span>{m.beltSpeedItemsPerSec}/s</span>
                </div>

                {m.beltItemsByType.length > 0 && (
                  <div className="pt-0.5 border-t border-[#242730] space-y-0.5">
                    {m.beltItemsByType.slice(0, 4).map((entry) => {
                      const meta = getCapytorioItemMeta(entry.item);
                      const shape =
                        meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                      return (
                        <div
                          key={entry.item}
                          className="flex items-center justify-between gap-1 text-[9px]"
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <CapytorioItemIcon
                              shape={shape}
                              color={meta.cssColor}
                              size={12}
                              className="shrink-0"
                            />
                            <span className="text-[#dce0e8] truncate">{meta.shortName}</span>
                          </div>
                          <span className="font-mono font-bold tabular-nums text-[#f4b054] shrink-0">
                            ×{entry.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Splitter Priority & Output Filter Controls */}
                {m.type === 'splitter' && onSetSplitterConfig && (
                  <div className="pt-1 border-t border-[#242730] space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[8.5px] font-mono text-[#9aa0ac]">In Prio</span>
                      <div className="flex items-center gap-0.5">
                        {(['left', 'none', 'right'] as const).map((prio) => (
                          <button
                            key={prio}
                            type="button"
                            data-testid={`capytorio-splitter-in-${prio}`}
                            onClick={() =>
                              onSetSplitterConfig(m.gx, m.gz, { inputPriority: prio })
                            }
                            className={`h-4 px-1.5 rounded-[1px] text-[8.5px] font-mono cursor-pointer ${
                              (m.splitterInputPriority ?? 'none') === prio
                                ? FACTORIO_INFO_BTN_AMBER
                                : FACTORIO_INFO_BTN
                            }`}
                          >
                            {prio === 'left' ? 'L' : prio === 'right' ? 'R' : '='}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[8.5px] font-mono text-[#9aa0ac]">Out Prio</span>
                      <div className="flex items-center gap-0.5">
                        {(['left', 'none', 'right'] as const).map((prio) => (
                          <button
                            key={prio}
                            type="button"
                            data-testid={`capytorio-splitter-out-${prio}`}
                            onClick={() =>
                              onSetSplitterConfig(m.gx, m.gz, { outputPriority: prio })
                            }
                            className={`h-4 px-1.5 rounded-[1px] text-[8.5px] font-mono cursor-pointer ${
                              (m.splitterOutputPriority ?? 'none') === prio
                                ? FACTORIO_INFO_BTN_AMBER
                                : FACTORIO_INFO_BTN
                            }`}
                          >
                            {prio === 'left' ? 'L' : prio === 'right' ? 'R' : '='}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        data-testid="capytorio-splitter-filter-select"
                        value={m.splitterFilterItem ?? ''}
                        onChange={(e) =>
                          onSetSplitterConfig(m.gx, m.gz, {
                            filterItem: e.target.value ? e.target.value : null,
                          })
                        }
                        aria-label="Splitter output filter"
                        className="flex-1 min-w-0 h-5 px-1 rounded-[1px] bg-[#0f1115] border border-[#4a4f5b] text-[8.5px] text-[#e6e8ec] font-mono"
                      >
                        <option value="">Filter: None</option>
                        {filterableItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                      {m.splitterFilterItem && (
                        <button
                          type="button"
                          onClick={() =>
                            onSetSplitterConfig(m.gx, m.gz, { filterItem: null })
                          }
                          title="Clear filter"
                          className={`w-5 h-5 rounded-[1px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN}`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Non-Belt Machine Telemetry */}
            {m && !isBeltLike && (
              <div className="px-1.5 py-1 bg-[#14161a] space-y-1">
                {(m.type === 'furnace' ||
                  m.type === 'assembler' ||
                  m.type === 'drill' ||
                  m.type === 'lab' ||
                  m.type === 'generator') && (
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between font-mono tabular-nums text-[8.5px] text-[#c4c9d4]">
                      <span className="truncate">
                        {m.type === 'generator'
                          ? m.isFuelGenerator === false
                            ? 'Fuel-Free'
                            : m.fuelTimer > 0
                              ? `Burn ${m.fuelTimer.toFixed(1)}s`
                              : 'Needs fuel'
                          : m.recipeName ?? m.type}
                      </span>
                      <span className="shrink-0">
                        {m.type === 'generator'
                          ? `${m.powerSupplyMw.toFixed(1)}MW`
                          : `${Math.round(m.craftProgress * 100)}%`}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-[#0b0d10] overflow-hidden">
                      <div
                        className={m.type === 'generator' ? 'h-full bg-[#e58926]' : 'h-full bg-[#45b649]'}
                        style={{
                          width: `${
                            m.type === 'generator'
                              ? m.isFuelGenerator === false
                                ? 100
                                : Math.min(100, Math.round((m.fuelTimer / 14) * 100))
                              : Math.round(m.craftProgress * 100)
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {m.type === 'inserter' && m.isFunctionalInserter !== false && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-[#9aa0ac]">
                        Holding · {m.inserterReach === 2 ? '2-Tile' : '1-Tile'}
                      </span>
                      <span className="font-mono text-[#ffe4b5] truncate">
                        {m.holdingItem ? getCapytorioItemMeta(m.holdingItem).shortName : 'Empty'}
                      </span>
                    </div>

                    {onSetInserterConfig && (
                      <div className="pt-1 border-t border-[#242730] space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[8.5px] font-mono text-[#9aa0ac]">Filter</span>
                          <div className="flex items-center gap-0.5">
                            {(['whitelist', 'blacklist'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                data-testid={`capytorio-inserter-mode-${mode}`}
                                onClick={() =>
                                  onSetInserterConfig(m.gx, m.gz, { filterMode: mode })
                                }
                                className={`h-4 px-1.5 rounded-[1px] text-[8px] font-mono cursor-pointer ${
                                  (m.inserterFilterMode ?? 'whitelist') === mode
                                    ? FACTORIO_INFO_BTN_AMBER
                                    : FACTORIO_INFO_BTN
                                }`}
                              >
                                {mode === 'whitelist' ? 'Allow' : 'Block'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {(m.inserterFilters ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-0.5">
                            {(m.inserterFilters ?? []).map((fid) => {
                              const meta = getCapytorioItemMeta(fid);
                              return (
                                <button
                                  key={fid}
                                  type="button"
                                  onClick={() =>
                                    onSetInserterConfig(m.gx, m.gz, {
                                      filters: (m.inserterFilters ?? []).filter((x) => x !== fid),
                                    })
                                  }
                                  title={`Remove ${meta.name}`}
                                  className="h-4 px-1 rounded-[1px] bg-[#242832] hover:bg-[#3a1a1a] border border-[#4a4f5b] text-[8px] font-mono text-[#e6e8ec] flex items-center gap-0.5 cursor-pointer"
                                >
                                  <span>{meta.shortName}</span>
                                  <X className="w-2 h-2 text-[#f2857c]" />
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {(m.inserterFilters ?? []).length < 5 && (
                          <select
                            data-testid="capytorio-inserter-filter-add"
                            value=""
                            onChange={(e) => {
                              const nextId = e.target.value;
                              if (!nextId) return;
                              const cur = m.inserterFilters ?? [];
                              if (!cur.includes(nextId)) {
                                onSetInserterConfig(m.gx, m.gz, {
                                  filters: [...cur, nextId].slice(0, 5),
                                });
                              }
                            }}
                            aria-label="Add inserter filter item"
                            className="w-full h-5 px-1 rounded-[1px] bg-[#0f1115] border border-[#4a4f5b] text-[8.5px] text-[#e6e8ec] font-mono"
                          >
                            <option value="">+ Add filter item...</option>
                            {filterableItems.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name}
                              </option>
                            ))}
                          </select>
                        )}

                        <div className="flex items-center justify-between gap-1 font-mono tabular-nums">
                          <span className="text-[8.5px] text-[#9aa0ac]">Stack</span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                const maxS = m.inserterMaxStack ?? 4;
                                const cur = m.inserterStackLimit ?? maxS;
                                onSetInserterConfig(m.gx, m.gz, {
                                  stackLimit: Math.max(1, cur - 1),
                                });
                              }}
                              className={`w-4 h-4 rounded-[1px] text-[9px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN}`}
                            >
                              -
                            </button>
                            <span
                              data-testid="capytorio-inserter-stack-val"
                              className="px-1 text-[8.5px] text-[#f4b054] font-bold"
                            >
                              {m.inserterStackLimit === null || m.inserterStackLimit === undefined
                                ? `Auto (${m.inserterMaxStack ?? 1})`
                                : `${m.inserterStackLimit}/${m.inserterMaxStack ?? 1}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const maxS = m.inserterMaxStack ?? 4;
                                const cur = m.inserterStackLimit ?? maxS;
                                const next = cur + 1;
                                onSetInserterConfig(m.gx, m.gz, {
                                  stackLimit: next >= maxS ? null : next,
                                });
                              }}
                              className={`w-4 h-4 rounded-[1px] text-[9px] flex items-center justify-center cursor-pointer ${FACTORIO_INFO_BTN}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {m.type === 'chest' && m.isStorageChest !== false && onSetChestSlotLimit && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between font-mono tabular-nums text-[8.5px]">
                      <span className="text-[#9aa0ac]">Slot Limit (Red Bar)</span>
                      <span
                        data-testid="capytorio-chest-slot-limit-val"
                        className="text-[#f4b054] font-bold"
                      >
                        {m.chestSlotLimit ?? CAPYTORIO_CHEST_SLOTS}/{CAPYTORIO_CHEST_SLOTS} ·{' '}
                        {m.chestCapacityItems ??
                          CAPYTORIO_CHEST_SLOTS * CAPYTORIO_CHEST_ITEMS_PER_SLOT}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-0.5">
                      {Array.from({ length: CAPYTORIO_CHEST_SLOTS }, (_, idx) => {
                        const slotNum = idx + 1;
                        const activeLimit = m.chestSlotLimit ?? CAPYTORIO_CHEST_SLOTS;
                        const locked = slotNum > activeLimit;
                        return (
                          <button
                            key={slotNum}
                            type="button"
                            data-testid={`capytorio-chest-slot-${slotNum}`}
                            onClick={() =>
                              onSetChestSlotLimit(
                                m.gx,
                                m.gz,
                                slotNum === CAPYTORIO_CHEST_SLOTS ? null : slotNum
                              )
                            }
                            title={`Allow up to ${slotNum} slots (${slotNum * CAPYTORIO_CHEST_ITEMS_PER_SLOT} items)`}
                            className={`h-4 rounded-[1px] text-[8px] font-mono tabular-nums cursor-pointer border ${
                              locked
                                ? 'bg-[#451414] border-[#b91c1c] text-[#fca5a5]'
                                : 'bg-[#252932] border-[#4a4f5b] text-[#cbd5e1] hover:border-[#f4b054]'
                            }`}
                          >
                            {locked ? '×' : slotNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {inputEntries.length > 0 && (
                  <div className="flex items-center justify-between gap-1 text-[9px]">
                    <span className="text-[#8e95a2] font-mono">In</span>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {inputEntries.slice(0, 3).map(([id, qty]) => {
                        const meta = getCapytorioItemMeta(id);
                        const shape =
                          meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-0.5 font-mono tabular-nums text-[#dce0e8]"
                          >
                            <CapytorioItemIcon shape={shape} color={meta.cssColor} size={11} />
                            <span>{qty}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {outputEntries.length > 0 && (
                  <div className="flex items-center justify-between gap-1 text-[9px]">
                    <span className="text-[#8e95a2] font-mono">
                      {m.type === 'chest' ? 'Box' : 'Out'}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {outputEntries.slice(0, 4).map(([id, qty]) => {
                        const meta = getCapytorioItemMeta(id);
                        const shape =
                          meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-0.5 font-mono tabular-nums text-[#7ce680]"
                          >
                            <CapytorioItemIcon shape={shape} color={meta.cssColor} size={11} />
                            <span>{qty}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resource Seam (Standalone or Beneath Drill) */}
            {info.resource && (
              <div className="px-1.5 py-1 bg-[#14161a] space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[#c4c9d4] truncate">
                    {m ? `Under: ${info.resource.shortName}` : 'Resources'}
                  </span>
                  <span
                    data-testid="capytorio-info-resource-amount"
                    className="font-mono font-bold tabular-nums text-[#f4b054]"
                  >
                    {info.resource.remaining.toLocaleString()}
                  </span>
                </div>
                {!m && (
                  <div className="flex items-center justify-between text-[8.5px] font-mono text-[#8e95a2]">
                    <span>Hand mine</span>
                    <span>+{info.resource.harvestAmount}/tap</span>
                  </div>
                )}
              </div>
            )}

            {/* Wild Citrus Tree */}
            {info.tree && (
              <div className="px-1.5 py-1 bg-[#14161a] flex items-center justify-between gap-1 text-[9px]">
                <span className="inline-flex items-center gap-0.5 text-[#9aa0ac]">
                  <Flame className="w-2.5 h-2.5 text-[#f4b054]" />
                  <span>Fuel yield</span>
                </span>
                <span className="font-mono font-bold text-[#ffe4b5]">
                  ×{info.tree.yieldCount} Orange
                </span>
              </div>
            )}

            {/* Spilled Ground Items */}
            {info.spilledTotalCount > 0 && (
              <div className="px-1.5 py-1 bg-[#14161a] space-y-0.5">
                <div className="flex items-center justify-between text-[8.5px] font-mono text-[#9aa0ac]">
                  <span>On ground</span>
                  <span className="text-[#f4b054] font-bold">{info.spilledTotalCount}</span>
                </div>
                {info.spilledItems.slice(0, 3).map((entry) => {
                  const meta = getCapytorioItemMeta(entry.item);
                  const shape =
                    meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                  return (
                    <div key={entry.item} className="flex items-center justify-between text-[9px]">
                      <span className="inline-flex items-center gap-1 truncate text-[#dce0e8]">
                        <CapytorioItemIcon shape={shape} color={meta.cssColor} size={11} />
                        <span className="truncate">{meta.shortName}</span>
                      </span>
                      <span className="font-mono font-bold text-[#f4b054]">×{entry.count}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Compact Entity Settings Copy/Paste Bar */}
            {m &&
              (m.type === 'assembler' ||
                m.type === 'splitter' ||
                (m.type === 'inserter' && m.isFunctionalInserter !== false) ||
                (m.type === 'chest' && m.isStorageChest !== false)) &&
              onCopyEntitySettings &&
              onPasteEntitySettings && (
                <div className="px-1.5 py-1 bg-[#14161a] flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="capytorio-info-copy-settings-btn"
                    onClick={() => onCopyEntitySettings(m.gx, m.gz)}
                    title="Copy entity settings [Shift + Right-Click]"
                    className={`flex-1 h-5 px-1.5 rounded-[1px] text-[8.5px] font-mono cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${FACTORIO_INFO_BTN}`}
                  >
                    <Copy className="w-2.5 h-2.5 shrink-0" />
                    <span>Copy S</span>
                  </button>
                  <button
                    type="button"
                    data-testid="capytorio-info-paste-settings-btn"
                    disabled={entitySettingsClipboard?.sourceType !== m.type}
                    onClick={() => onPasteEntitySettings(m.gx, m.gz)}
                    title={
                      entitySettingsClipboard?.sourceType === m.type
                        ? `Paste ${entitySettingsClipboard.sourceLabel} [Shift + Left-Click]`
                        : 'Copy settings from a matching building first [Shift + RMB]'
                    }
                    className={`flex-1 h-5 px-1.5 rounded-[1px] text-[8.5px] font-mono flex items-center justify-center gap-1 whitespace-nowrap ${
                      entitySettingsClipboard?.sourceType === m.type
                        ? `cursor-pointer ${FACTORIO_INFO_BTN_AMBER}`
                        : 'opacity-45 cursor-not-allowed bg-[#1f2228] border border-[#343842] text-[#7a818f]'
                    }`}
                  >
                    <ClipboardPaste className="w-2.5 h-2.5 shrink-0" />
                    <span>Paste S</span>
                  </button>
                </div>
              )}

            {/* Compact Action Strip */}
            {(m || info.resource || info.tree || info.spilledTotalCount > 0) && (
              <div className="px-1.5 py-1 flex items-center gap-1">
                {m && (
                  <>
                    {isBeltLike && m.beltItemCount > 0 ? (
                      <button
                        type="button"
                        data-testid="capytorio-info-pickup-btn"
                        onClick={() => onTakeOutputs(m.gx, m.gz)}
                        title="Pick up all items on belt [E / F]"
                        className={`flex-1 h-5 px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
                      >
                        <Package className="w-2.5 h-2.5 shrink-0" />
                        <span>Pick up ({m.beltItemCount})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-testid="capytorio-info-open-btn"
                        onClick={() => onOpenMachineModal(m.gx, m.gz)}
                        className={`flex-1 h-5 px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
                      >
                        <SlidersHorizontal className="w-2.5 h-2.5 shrink-0" />
                        <span>Open</span>
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="capytorio-info-rotate-btn"
                      onClick={() => onRotateMachineAt(m.gx, m.gz)}
                      title="Rotate [R]"
                      className={`h-5 px-1.5 rounded-[1px] text-[9px] font-mono cursor-pointer flex items-center justify-center gap-0.5 ${FACTORIO_INFO_BTN}`}
                    >
                      <RotateCcw className="w-2.5 h-2.5 shrink-0" />
                      <span>R</span>
                    </button>
                    <button
                      type="button"
                      data-testid="capytorio-info-delete-btn"
                      onClick={() => onDemolishMachineAt(m.gx, m.gz)}
                      title="Delete & refund [X]"
                      aria-label="Delete building"
                      className="h-5 px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center justify-center bg-[#3a1a1a] hover:bg-[#562424] border border-[#8e3a36] text-[#f7a8a3]"
                    >
                      <Trash2 className="w-2.5 h-2.5 shrink-0" />
                    </button>
                  </>
                )}

                {!m && info.resource && (
                  <button
                    type="button"
                    data-testid="capytorio-info-mine-btn"
                    onClick={() => onMineTileAt(info.gx, info.gz)}
                    className={`flex-1 h-5 px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
                  >
                    <Pickaxe className="w-2.5 h-2.5 shrink-0" />
                    <span>Mine (+{info.resource.harvestAmount})</span>
                  </button>
                )}

                {!m && info.tree && (
                  <button
                    type="button"
                    data-testid="capytorio-info-chop-btn"
                    onClick={() => onMineTileAt(info.gx, info.gz)}
                    className={`flex-1 h-5 px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
                  >
                    <Hammer className="w-2.5 h-2.5 shrink-0" />
                    <span>Chop (+{info.tree.yieldCount})</span>
                  </button>
                )}

                {!m && info.spilledTotalCount > 0 && (
                  <button
                    type="button"
                    data-testid="capytorio-info-collect-btn"
                    onClick={onCollectAllOutputs}
                    className={`flex-1 h-5 px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
                  >
                    <Package className="w-2.5 h-2.5 shrink-0" />
                    <span>Collect</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
});
