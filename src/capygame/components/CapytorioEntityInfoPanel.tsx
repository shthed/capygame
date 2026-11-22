import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
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
  getCapytorioItemMeta,
  resolveCapytorioItemShape,
} from '../engine/CapytorioData';
import type {
  CapytorioInspectedMachineDetail,
  CapytorioTileInspection,
} from '../engine/CapytorioFactoryEngine';
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
  onClearPin: () => void;
  onOpenMachineModal: (gx: number, gz: number) => void;
  onRotateMachineAt: (gx: number, gz: number) => void;
  onDemolishMachineAt: (gx: number, gz: number) => void;
  onMineTileAt: (gx: number, gz: number) => void;
  onCollectAllOutputs: () => void;
}

export const CapytorioEntityInfoPanel: React.FC<CapytorioEntityInfoPanelProps> = ({
  info,
  isPinned,
  isTopBarVisible,
  onClearPin,
  onOpenMachineModal,
  onRotateMachineAt,
  onDemolishMachineAt,
  onMineTileAt,
  onCollectAllOutputs,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

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
        compactStat = m.fuelTimer > 0 ? `${m.powerSupplyMw.toFixed(1)}MW` : 'No Fuel';
      } else if (m.type === 'inserter') {
        compactStat = m.holdingItem ? getCapytorioItemMeta(m.holdingItem).shortName : m.status;
      } else if (m.type === 'chest') {
        compactStat = totalStored > 0 ? `${totalStored} stored` : 'Empty';
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
      className={`fixed right-2 z-30 pointer-events-auto text-[#e6e8ec] select-none transition-[top,width] duration-150 ${
        isTopBarVisible ? 'top-[82px]' : 'top-[42px]'
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
                  {DIR_LABELS[m.dir] ?? 'E'}
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
                          ? m.fuelTimer > 0
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
                              ? Math.min(100, Math.round((m.fuelTimer / 14) * 100))
                              : Math.round(m.craftProgress * 100)
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {m.type === 'inserter' && (
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-[#9aa0ac]">Holding</span>
                    <span className="font-mono text-[#ffe4b5] truncate">
                      {m.holdingItem ? getCapytorioItemMeta(m.holdingItem).shortName : 'Empty'}
                    </span>
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

            {/* Compact Action Strip */}
            {(m || info.resource || info.tree || info.spilledTotalCount > 0) && (
              <div className="px-1.5 py-1 flex items-center gap-1">
                {m && (
                  <>
                    <button
                      type="button"
                      data-testid="capytorio-info-open-btn"
                      onClick={() => onOpenMachineModal(m.gx, m.gz)}
                      className={`flex-1 h-5 px-1.5 rounded-[1px] text-[9px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
                    >
                      <SlidersHorizontal className="w-2.5 h-2.5 shrink-0" />
                      <span>Open</span>
                    </button>
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
};
