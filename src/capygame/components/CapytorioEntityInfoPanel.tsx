import React from 'react';
import { Flame, Hammer, Package, Pickaxe, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
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
  'rounded-[3px] bg-[#1f2126]/96 border-2 border-[#3c4049] border-t-[#545966] border-l-[#4c515c] border-b-[#111216] border-r-[#111216] shadow-[0_14px_36px_rgba(0,0,0,0.74)]';

const FACTORIO_INFO_WELL =
  'rounded-[2px] bg-[#15171b] border border-[#0b0c0e] border-b-[#343842] border-r-[#343842]';

const FACTORIO_INFO_BTN =
  'bg-[#2b2e35] hover:bg-[#393d46] border border-[#4a4f5b] border-b-[#14161a] border-r-[#14161a] text-[#e4e6eb]';

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
      return 'text-[#a3aab7]';
  }
}

export interface CapytorioEntityInfoPanelProps {
  info: CapytorioTileInspection;
  isPinned: boolean;
  isDockCollapsed: boolean;
  onClearPin: () => void;
  onOpenMachineModal: (gx: number, gz: number) => void;
  onRotateMachineAt: (gx: number, gz: number) => void;
  onMineTileAt: (gx: number, gz: number) => void;
  onCollectAllOutputs: () => void;
}

export const CapytorioEntityInfoPanel: React.FC<CapytorioEntityInfoPanelProps> = ({
  info,
  isPinned,
  isDockCollapsed,
  onClearPin,
  onOpenMachineModal,
  onRotateMachineAt,
  onMineTileAt,
  onCollectAllOutputs,
}) => {
  const m = info.machine;
  const isBeltLike = m !== null && (m.type === 'belt' || m.type === 'splitter' || m.type === 'tunnel');
  const inputEntries = m
    ? Object.entries(m.inputBuffer).filter(([, qty]) => (qty ?? 0) > 0)
    : [];
  const outputEntries = m
    ? Object.entries(m.outputBuffer).filter(([, qty]) => (qty ?? 0) > 0)
    : [];

  const renderHeaderIcon = () => {
    if (m) {
      return (
        <CapytorioMachineIcon
          machineType={m.type}
          color={hexToCss(m.colorHex)}
          size={19}
          className="shrink-0"
        />
      );
    }
    if (info.tree) {
      return <CapytorioWorldIcon kind="tree" size={19} className="shrink-0" />;
    }
    if (info.resource) {
      const meta = getCapytorioItemMeta(info.resource.id);
      const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
      return (
        <CapytorioItemIcon
          shape={shape}
          color={meta.cssColor}
          size={19}
          className="shrink-0"
        />
      );
    }
    if (info.spilledItems.length > 0) {
      const firstMeta = getCapytorioItemMeta(info.spilledItems[0].item);
      const shape = firstMeta.shape ?? resolveCapytorioItemShape(firstMeta.id, firstMeta.category);
      return (
        <CapytorioItemIcon
          shape={shape}
          color={firstMeta.cssColor}
          size={19}
          className="shrink-0"
        />
      );
    }
    if (info.isBeacon) {
      return <CapytorioWorldIcon kind="beacon" size={19} className="shrink-0" />;
    }
    return <CapytorioWorldIcon kind="terrain" size={19} className="shrink-0" />;
  };

  return (
    <aside
      data-testid="capytorio-entity-info-panel"
      aria-label="Factorio Entity Info Window"
      className={`fixed right-2 z-30 pointer-events-auto w-[236px] sm:w-[268px] text-[#e6e8ec] select-none transition-[bottom] duration-150 ${
        isDockCollapsed ? 'bottom-[44px]' : 'bottom-[102px] sm:bottom-[98px]'
      }`}
    >
      <div className={`${FACTORIO_INFO_FRAME} overflow-hidden`}>
        {/* Factorio Beveled Title Header */}
        <div className="px-2 py-1.5 bg-[#2c2f36] border-b-2 border-[#121317] flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {renderHeaderIcon()}
            <div className="min-w-0">
              <div
                data-testid="capytorio-info-title"
                className="text-[11px] font-bold tracking-wide text-[#f4b054] truncate leading-tight"
              >
                {info.title}
              </div>
              <div className="text-[9px] font-mono tabular-nums text-[#9aa0ac] truncate leading-tight">
                ({info.gx}, {info.gz}) · {info.subtitle}
              </div>
            </div>
          </div>

          {isPinned && (
            <button
              type="button"
              data-testid="capytorio-info-clear-btn"
              onClick={onClearPin}
              title="Clear pinned selection"
              aria-label="Clear pinned selection"
              className={`w-5 h-5 rounded-[2px] flex items-center justify-center shrink-0 cursor-pointer ${FACTORIO_INFO_BTN}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-2 space-y-1.5 text-[10px]">
          {/* Machine Status & Telemetry */}
          {m && (
            <div className="flex items-center justify-between gap-2 font-mono tabular-nums text-[10px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotClass(m.status)}`}
                  aria-hidden="true"
                />
                <span className={`font-semibold truncate ${getStatusTextClass(m.status)}`}>
                  {m.status}
                </span>
              </div>
              <div className="text-[#a3aab7] shrink-0">
                Dir {DIR_LABELS[m.dir] ?? 'E'}
                {m.type === 'generator'
                  ? ` · ${m.powerSupplyMw.toFixed(1)} MW`
                  : m.powerDemandMw > 0
                    ? ` · ${m.powerDemandMw.toFixed(1)} MW`
                    : ''}
              </div>
            </div>
          )}

          {/* Transport Belt / Splitter / Tunnel Live Item Count Breakdown */}
          {m && isBeltLike && (
            <div className={`${FACTORIO_INFO_WELL} p-1.5 space-y-1.5`}>
              <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                <span className="text-[10px] uppercase tracking-wider text-[#9aa0ac]">
                  Items on {m.type === 'belt' ? 'belt' : m.shortName.toLowerCase()}
                </span>
                <span
                  data-testid="capytorio-info-belt-count"
                  className={`text-[12px] font-bold ${
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

              {/* Belt Capacity Bar */}
              <div className="h-1.5 w-full rounded-[1px] bg-[#0b0d10] border border-[#2a2e38] overflow-hidden">
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

              {/* Lane Split */}
              <div
                data-testid="capytorio-info-belt-lanes"
                className="flex items-center justify-between text-[9px] font-mono tabular-nums text-[#9aa0ac]"
              >
                <span>
                  L {m.beltLeftLaneCount}/{m.beltLeftLaneCapacity} · R {m.beltRightLaneCount}/
                  {m.beltRightLaneCapacity}
                </span>
                <span>{m.beltSpeedItemsPerSec} items/s</span>
              </div>

              {/* Grouped Item Types Currently Riding on This Belt */}
              {m.beltItemsByType.length > 0 ? (
                <div className="pt-1 border-t border-[#252831] space-y-1">
                  {m.beltItemsByType.slice(0, 4).map((entry) => {
                    const meta = getCapytorioItemMeta(entry.item);
                    const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                    return (
                      <div
                        key={entry.item}
                        className="flex items-center justify-between gap-1.5 text-[10px]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CapytorioItemIcon
                            shape={shape}
                            color={meta.cssColor}
                            size={14}
                            className="shrink-0"
                          />
                          <span className="text-[#dce0e8] truncate">{meta.name}</span>
                        </div>
                        <span className="font-mono font-bold tabular-nums text-[#f4b054] shrink-0">
                          ×{entry.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pt-1 border-t border-[#252831] text-[9px] text-[#7c8391]">
                  Belt tile empty
                </div>
              )}
            </div>
          )}

          {/* Non-Belt Machine Progress, Recipe, Held Item & Buffers */}
          {m && !isBeltLike && (
            <div className={`${FACTORIO_INFO_WELL} p-1.5 space-y-1.5`}>
              {(m.type === 'furnace' ||
                m.type === 'assembler' ||
                m.type === 'drill' ||
                m.type === 'lab' ||
                m.type === 'generator') && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-mono tabular-nums text-[9px] text-[#c4c9d4]">
                    <span className="truncate">
                      {m.type === 'generator'
                        ? m.fuelTimer > 0
                          ? `Burning (${m.fuelTimer.toFixed(1)}s)`
                          : 'Needs Coal or Orange'
                        : m.recipeName
                          ? `Recipe: ${m.recipeName}`
                          : m.type === 'drill'
                            ? 'Mining progress'
                            : m.type === 'furnace'
                              ? 'Smelting progress'
                              : 'Research cycle'}
                    </span>
                    <span className="shrink-0">
                      {m.type === 'generator'
                        ? `${m.powerSupplyMw.toFixed(1)} MW`
                        : `${Math.round(m.craftProgress * 100)}%`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-[1px] bg-[#0b0d10] border border-[#2a2e38] overflow-hidden">
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
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-[#9aa0ac]">Holding</span>
                  {m.holdingItem ? (
                    (() => {
                      const heldMeta = getCapytorioItemMeta(m.holdingItem);
                      const shape =
                        heldMeta.shape ??
                        resolveCapytorioItemShape(heldMeta.id, heldMeta.category);
                      return (
                        <span className="flex items-center gap-1 font-medium text-[#ffe4b5]">
                          <CapytorioItemIcon shape={shape} color={heldMeta.cssColor} size={14} />
                          <span>{heldMeta.shortName}</span>
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-[#7c8391] font-mono">Empty</span>
                  )}
                </div>
              )}

              {(inputEntries.length > 0 || outputEntries.length > 0) && (
                <div className="pt-1 border-t border-[#252831] space-y-1">
                  {inputEntries.length > 0 && (
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span className="text-[9px] font-mono uppercase text-[#8e95a2]">In</span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {inputEntries.slice(0, 3).map(([id, qty]) => {
                          const meta = getCapytorioItemMeta(id);
                          const shape =
                            meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-0.5 font-mono tabular-nums text-[#dce0e8]"
                              title={`${meta.name}: ${qty}`}
                            >
                              <CapytorioItemIcon shape={shape} color={meta.cssColor} size={13} />
                              <span>{qty}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {outputEntries.length > 0 && (
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span className="text-[9px] font-mono uppercase text-[#8e95a2]">
                        {m.type === 'chest' ? 'Stored' : 'Out'}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {outputEntries.slice(0, 4).map(([id, qty]) => {
                          const meta = getCapytorioItemMeta(id);
                          const shape =
                            meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-0.5 font-mono tabular-nums text-[#7ce680]"
                              title={`${meta.name}: ${qty}`}
                            >
                              <CapytorioItemIcon shape={shape} color={meta.cssColor} size={13} />
                              <span>{qty}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ground Resource / Ore Seam (Standalone OR Underlying a Drill/Belt) */}
          {info.resource && (
            <div className={`${FACTORIO_INFO_WELL} p-1.5 space-y-1`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {(() => {
                    const meta = getCapytorioItemMeta(info.resource.id);
                    const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                    return (
                      <CapytorioItemIcon
                        shape={shape}
                        color={meta.cssColor}
                        size={15}
                        className="shrink-0"
                      />
                    );
                  })()}
                  <span className="text-[#dce0e8] font-semibold truncate">
                    {m ? `Underneath: ${info.resource.shortName}` : 'Expected resources'}
                  </span>
                </div>
                <span
                  data-testid="capytorio-info-resource-amount"
                  className="font-mono font-bold tabular-nums text-[#f4b054] shrink-0"
                >
                  {info.resource.remaining.toLocaleString()}
                </span>
              </div>
              {!m && (
                <div className="flex items-center justify-between text-[9px] font-mono text-[#9aa0ac]">
                  <span>Minable by hand</span>
                  <span>+{info.resource.harvestAmount} / click</span>
                </div>
              )}
            </div>
          )}

          {/* Wild Citrus Tree */}
          {info.tree && (
            <div className={`${FACTORIO_INFO_WELL} p-1.5 space-y-1`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#9aa0ac]">Harvest yield</span>
                <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-[#ffe4b5]">
                  <CapytorioItemIcon shape="fruit" color="#fb923c" size={14} />
                  <span>×{info.tree.yieldCount} Fresh Orange</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-[#9aa0ac]">
                <span className="inline-flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5 text-[#f4b054]" />
                  <span>Generator fuel</span>
                </span>
                <span className="font-mono">Chop [E]</span>
              </div>
            </div>
          )}

          {/* Spilled Ground Items */}
          {info.spilledTotalCount > 0 && (
            <div className={`${FACTORIO_INFO_WELL} p-1.5 space-y-1`}>
              <div className="flex items-center justify-between font-mono text-[9px] uppercase text-[#9aa0ac]">
                <span>Items on ground</span>
                <span className="text-[#f4b054] font-bold tabular-nums">
                  {info.spilledTotalCount}
                </span>
              </div>
              <div className="space-y-0.5">
                {info.spilledItems.slice(0, 4).map((entry) => {
                  const meta = getCapytorioItemMeta(entry.item);
                  const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
                  return (
                    <div key={entry.item} className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CapytorioItemIcon shape={shape} color={meta.cssColor} size={13} />
                        <span className="text-[#dce0e8] truncate">{meta.name}</span>
                      </div>
                      <span className="font-mono font-bold tabular-nums text-[#f4b054]">
                        ×{entry.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Beacon / Empty Terrain Details */}
          {!m && !info.resource && !info.tree && info.spilledTotalCount === 0 && (
            <div className={`${FACTORIO_INFO_WELL} p-1.5 flex items-center justify-between text-[10px]`}>
              <span className="text-[#9aa0ac]">
                {info.isBeacon ? 'Base Origin' : 'Surface'}
              </span>
              <span className="font-mono text-[#dce0e8]">
                {info.isBeacon ? 'Warp Point [H]' : 'Buildable'}
              </span>
            </div>
          )}

          {/* Contextual Action Row */}
          <div className="flex items-center gap-1 pt-0.5">
            {m && (
              <>
                <button
                  type="button"
                  data-testid="capytorio-info-open-btn"
                  onClick={() => onOpenMachineModal(m.gx, m.gz)}
                  className={`flex-1 h-6 px-2 rounded-[2px] text-[10px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
                >
                  <SlidersHorizontal className="w-3 h-3 shrink-0" />
                  <span>Open</span>
                </button>
                <button
                  type="button"
                  data-testid="capytorio-info-rotate-btn"
                  onClick={() => onRotateMachineAt(m.gx, m.gz)}
                  title="Rotate building [R]"
                  className={`h-6 px-2 rounded-[2px] text-[10px] font-mono cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN}`}
                >
                  <RotateCcw className="w-3 h-3 shrink-0" />
                  <span>[R]</span>
                </button>
              </>
            )}

            {!m && info.resource && (
              <button
                type="button"
                data-testid="capytorio-info-mine-btn"
                onClick={() => onMineTileAt(info.gx, info.gz)}
                className={`flex-1 h-6 px-2 rounded-[2px] text-[10px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
              >
                <Pickaxe className="w-3 h-3 shrink-0" />
                <span>Mine (+{info.resource.harvestAmount})</span>
              </button>
            )}

            {!m && info.tree && (
              <button
                type="button"
                data-testid="capytorio-info-chop-btn"
                onClick={() => onMineTileAt(info.gx, info.gz)}
                className={`flex-1 h-6 px-2 rounded-[2px] text-[10px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
              >
                <Hammer className="w-3 h-3 shrink-0" />
                <span>Chop (+{info.tree.yieldCount})</span>
              </button>
            )}

            {!m && info.spilledTotalCount > 0 && (
              <button
                type="button"
                data-testid="capytorio-info-collect-btn"
                onClick={onCollectAllOutputs}
                className={`flex-1 h-6 px-2 rounded-[2px] text-[10px] cursor-pointer flex items-center justify-center gap-1 ${FACTORIO_INFO_BTN_AMBER}`}
              >
                <Package className="w-3 h-3 shrink-0" />
                <span>Collect</span>
              </button>
            )}
          </div>

          {/* Concise Factorio Hint Footer */}
          <div className="text-[9px] text-[#8e95a2] leading-snug border-t border-[#282b33] pt-1 truncate">
            {info.actionHint}
          </div>
        </div>
      </div>
    </aside>
  );
};
