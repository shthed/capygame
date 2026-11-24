import React from 'react';
import type { CapytorioItemShape, CapytorioMachineType } from '../../engine/CapytorioData';
import { CapytorioItemIcon, CapytorioMachineIcon } from '../CapytorioSlotIcon';

export const DIR_LABELS = ['N', 'E', 'S', 'W'] as const;

export const FACTORIO_PANEL_FRAME =
  'rounded-[3px] bg-[#1f2126] border-2 border-[#3c4049] border-t-[#545966] border-l-[#4c515c] border-b-[#111216] border-r-[#111216] shadow-[0_18px_48px_rgba(0,0,0,0.72)]';

export const FACTORIO_HEADER_BAR =
  'px-3 py-1.5 bg-[#2c2f36] border-b-2 border-[#121317] flex items-center justify-between gap-2';

export const FACTORIO_WELL =
  'rounded-[2px] bg-[#16181c] border border-[#0b0c0e] border-b-[#353942] border-r-[#353942]';

export const FACTORIO_BTN_IDLE =
  'bg-[#2b2e35] hover:bg-[#393d46] border border-[#4a4f5b] border-b-[#14161a] border-r-[#14161a] text-[#e4e6eb]';

export const FACTORIO_BTN_ACTIVE =
  'bg-[#e58926] hover:bg-[#ef9837] border border-[#f8c173] border-b-[#8b4f0f] border-r-[#8b4f0f] text-[#151618] font-bold';

export function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export interface CapytorioSlotTooltipData {
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

export interface CapytorioHoverTooltipState extends CapytorioSlotTooltipData {
  anchorRect: { left: number; right: number; top: number; bottom: number };
}

export interface CapytorioTooltipProps {
  hoverTooltip: CapytorioHoverTooltipState | null;
}

export const CapytorioTooltip: React.FC<CapytorioTooltipProps> = ({ hoverTooltip }) => {
  if (!hoverTooltip) return null;

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
                <span
                  className={
                    ok
                      ? 'text-[#86ef92] font-semibold shrink-0'
                      : 'text-[#f2857c] font-semibold shrink-0'
                  }
                >
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
};
