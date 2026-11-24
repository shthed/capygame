import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  CAPYTORIO_TECHS,
  TECH_BY_ID,
  getCapytorioItemMeta,
  type CapytorioTechId,
} from '../../engine/CapytorioData';
import type { CapytorioUiSnapshot } from '../../engine/CapytorioFactoryEngine';
import {
  FACTORIO_BTN_ACTIVE,
  FACTORIO_BTN_IDLE,
  FACTORIO_HEADER_BAR,
  FACTORIO_PANEL_FRAME,
} from './CapytorioTooltip';

export interface CapytorioTechDrawerProps {
  snap: CapytorioUiSnapshot;
  effPct: number;
  totalSciInPocket: number;
  techSearchInputRef: React.RefObject<HTMLInputElement | null>;
  onFeedScience: () => void;
  onSelectTech: (techId: CapytorioTechId) => void;
  onOpenPedia: (entryId: string) => void;
  onClose: () => void;
}

export const CapytorioTechDrawer: React.FC<CapytorioTechDrawerProps> = React.memo(({
  snap,
  effPct,
  totalSciInPocket,
  techSearchInputRef,
  onFeedScience,
  onSelectTech,
  onOpenPedia,
  onClose,
}) => {
  const [techSearchQuery, setTechSearchQuery] = useState('');
  const activeTech = snap.activeTechId ? TECH_BY_ID.get(snap.activeTechId) : null;

  return (
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
            onClick={onClose}
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
          const prereqsMet = tech.prerequisites.every((p) => snap.unlockedTechs.includes(p));
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
              <div className="text-[10px] text-[#a3aab7] truncate mt-1">{tech.effectSummary}</div>
              <div className="text-[9px] font-mono text-[#f4b054] mt-1 truncate">{costStr}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
