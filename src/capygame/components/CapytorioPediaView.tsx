import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Cpu,
  FlaskConical,
  Hammer,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_RECIPES,
  getCapytorioItemMeta,
  resolveCapytorioItemShape,
  type CapytorioLuaCatalogInfo,
  type CapytorioMachineType,
  type CapytorioRecipeSpec,
  type CapytorioTechId,
} from '../engine/CapytorioData';
import type {
  CapytorioTileInspection,
  CapytorioUiSnapshot,
} from '../engine/CapytorioFactoryEngine';
import {
  buildCapytorioPediaCatalog,
  getCapytorioPediaEntry,
  type CapytorioPediaCategory,
  type CapytorioPediaEntry,
} from '../engine/CapytorioPedia';
import {
  CapytorioItemIcon,
  CapytorioMachineIcon,
  CapytorioWorldIcon,
} from './CapytorioSlotIcon';

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

const CATEGORY_FILTERS: Array<{ id: 'all' | CapytorioPediaCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'resources', label: 'Ores' },
  { id: 'intermediates', label: 'Parts' },
  { id: 'science', label: 'Science' },
  { id: 'tech', label: 'Tech' },
  { id: 'world', label: 'World' },
];

export interface CapytorioPediaViewProps {
  entryId: string;
  contextInfo: CapytorioTileInspection | null;
  snap: CapytorioUiSnapshot;
  luaCatalogInfo: CapytorioLuaCatalogInfo;
  searchFocusNonce?: number;
  onNavigateEntry: (nextEntryId: string) => void;
  onClose: () => void;
  onSelectTool: (toolId: string, promoteToRecent?: boolean) => void;
  onCraftMachine: (mType: CapytorioMachineType) => void;
  onCraftRecipe: (recipeId: string, count: number, autoEquipResult?: boolean) => void;
  onSelectTech: (techId: CapytorioTechId) => void;
}

const EntryIconView: React.FC<{
  icon: CapytorioPediaEntry['icon'];
  size: number;
  className?: string;
}> = ({ icon, size, className = '' }) => {
  if (icon.kind === 'machine') {
    return (
      <CapytorioMachineIcon
        machineType={icon.machineType}
        color={icon.color}
        size={size}
        className={className}
      />
    );
  }
  if (icon.kind === 'item') {
    return (
      <CapytorioItemIcon
        shape={icon.shape}
        color={icon.color}
        size={size}
        className={className}
      />
    );
  }
  if (icon.kind === 'world') {
    return <CapytorioWorldIcon kind={icon.worldKind} size={size} className={className} />;
  }
  return <FlaskConical style={{ width: size, height: size, color: icon.color }} className={className} />;
};

export const CapytorioPediaView: React.FC<CapytorioPediaViewProps> = React.memo(({
  entryId,
  contextInfo,
  snap,
  luaCatalogInfo,
  searchFocusNonce = 0,
  onNavigateEntry,
  onClose,
  onSelectTool,
  onCraftMachine,
  onCraftRecipe,
  onSelectTech,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CapytorioPediaCategory>('all');
  const [mobileShowIndex, setMobileShowIndex] = useState(false);
  const [history, setHistory] = useState<string[]>([entryId]);
  const [historyCursor, setHistoryCursor] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const catalog = useMemo(
    () => buildCapytorioPediaCatalog(),
    [luaCatalogInfo.version]
  );

  // Push externally selected entryIds (e.g., new Alt+Left-Click) into history stack
  useEffect(() => {
    setHistory((prev) => {
      if (prev[historyCursor] === entryId) return prev;
      const truncated = prev.slice(0, historyCursor + 1);
      const next = [...truncated, entryId].slice(-40);
      setHistoryCursor(next.length - 1);
      return next;
    });
    setMobileShowIndex(false);
  }, [entryId]);

  useEffect(() => {
    if (searchFocusNonce > 0) {
      setMobileShowIndex(true);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    }
  }, [searchFocusNonce]);

  const entry = useMemo(
    () => getCapytorioPediaEntry(entryId, catalog),
    [entryId, catalog]
  );

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (q.length > 0 && !item.searchText.includes(q)) return false;
      return true;
    });
  }, [catalog, categoryFilter, searchQuery]);

  const jumpTo = (targetId: string) => {
    onNavigateEntry(targetId);
    setMobileShowIndex(false);
  };

  const canGoBack = historyCursor > 0;
  const canGoForward = historyCursor < history.length - 1;

  const goBack = () => {
    if (!canGoBack) return;
    const nextIdx = historyCursor - 1;
    setHistoryCursor(nextIdx);
    onNavigateEntry(history[nextIdx]);
  };

  const goForward = () => {
    if (!canGoForward) return;
    const nextIdx = historyCursor + 1;
    setHistoryCursor(nextIdx);
    onNavigateEntry(history[nextIdx]);
  };

  // Owned pocket count for current entry
  const ownedCount = (() => {
    if (!entry) return 0;
    if (entry.machineBaseType && entry.placeableToolId === entry.machineBaseType) {
      return snap.pocketMachines[entry.machineBaseType] ?? 0;
    }
    if (entry.itemId) {
      return snap.pocketItems[entry.itemId] ?? 0;
    }
    return 0;
  })();

  const firstPocketCraftableRecipe = entry?.producedByRecipes.find(
    (r) => r.pocketCraftable && snap.unlockedRecipes.includes(r.id)
  );
  const canCraftBaseMachine =
    entry?.kind === 'machine' &&
    entry.machineBaseType !== undefined &&
    entry.placeableToolId === entry.machineBaseType &&
    Object.entries(CAPYTORIO_MACHINE_SPECS[entry.machineBaseType].craftCost).every(
      ([id, amt]) => (snap.pocketItems[id] ?? 0) >= (amt ?? 0)
    );
  const canCraftRecipe =
    firstPocketCraftableRecipe !== undefined &&
    firstPocketCraftableRecipe.ingredients.every(
      (i) => (snap.pocketItems[i.item] ?? 0) >= i.count
    );

  // Scanned contextual entities from Alt+Click tile (cargo on belt, ore under drill, active recipe, ground drops)
  const tileContextLinks = useMemo(() => {
    if (!contextInfo) return [];
    const links: Array<{ pediaId: string; label: string; tag: string }> = [];
    const pushed = new Set<string>();
    const addLink = (pediaId: string, label: string, tag: string) => {
      if (pushed.has(`${tag}:${pediaId}`)) return;
      pushed.add(`${tag}:${pediaId}`);
      links.push({ pediaId, label, tag });
    };

    if (contextInfo.machine) {
      const m = contextInfo.machine;
      addLink(m.variantItemId ?? m.type, m.name, 'Building');
      for (const bi of m.beltItemsByType) {
        addLink(bi.item, `${getCapytorioItemMeta(bi.item).name} ×${bi.count}`, 'On Belt');
      }
      if (m.holdingItem) {
        addLink(m.holdingItem, getCapytorioItemMeta(m.holdingItem).name, 'Holding');
      }
      if (m.recipeId) {
        const rec = CAPYTORIO_RECIPES.find((r) => r.id === m.recipeId);
        if (rec) {
          addLink(rec.result, `${rec.name}`, 'Recipe');
        }
      }
    }
    if (contextInfo.resource) {
      addLink(
        contextInfo.resource.id,
        `${contextInfo.resource.name} (${contextInfo.resource.remaining.toLocaleString()})`,
        contextInfo.machine ? 'Underneath' : 'Ore'
      );
    }
    if (contextInfo.tree) {
      addLink('world:tree', contextInfo.tree.name, 'Flora');
      addLink('orange', 'Fresh Orange (+3)', 'Yield');
    }
    for (const sp of contextInfo.spilledItems) {
      addLink(sp.item, `${getCapytorioItemMeta(sp.item).name} ×${sp.count}`, 'Floor');
    }
    if (contextInfo.isBeacon) {
      addLink('world:beacon', 'Surveyor Beacon', 'Landmark');
    }
    return links;
  }, [contextInfo]);

  const renderRecipeCard = (rec: CapytorioRecipeSpec, keyPrefix: string) => {
    const outMeta = getCapytorioItemMeta(rec.result);
    const outShape = outMeta.shape ?? resolveCapytorioItemShape(outMeta.id, outMeta.category);
    const stationId = rec.station === 'furnace' ? 'furnace' : 'assembler';
    const stationLabel = rec.station === 'furnace' ? 'Foundry' : 'Assembler';
    const techId = rec.requiredTechId;
    const isUnlocked = snap.unlockedRecipes.includes(rec.id);

    return (
      <div
        key={`${keyPrefix}-${rec.id}`}
        className="p-2 rounded-[2px] bg-[#121418] border border-[#2c303a] space-y-1.5 text-[10px]"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => jumpTo(rec.result)}
            className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer hover:text-[#f4b054]"
          >
            <CapytorioItemIcon shape={outShape} color={outMeta.cssColor} size={18} className="shrink-0" />
            <span className="font-bold text-[#eef1f5] truncate">
              {rec.name} ×{rec.resultCount}
            </span>
          </button>
          <span className="font-mono text-[9px] text-[#9aa0ac] shrink-0">
            {rec.craftTimeSec}s
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {rec.ingredients.map((ing) => {
            const ingMeta = getCapytorioItemMeta(ing.item);
            const ingShape = ingMeta.shape ?? resolveCapytorioItemShape(ingMeta.id, ingMeta.category);
            return (
              <button
                key={ing.item}
                type="button"
                onClick={() => jumpTo(ing.item)}
                title={`Open ${ingMeta.name} in Capytoriopedia`}
                className="px-1.5 py-0.5 rounded-[2px] bg-[#1d2027] hover:bg-[#2a2f3a] border border-[#3a3f4b] flex items-center gap-1 text-[9.5px] font-mono cursor-pointer"
              >
                <CapytorioItemIcon shape={ingShape} color={ingMeta.cssColor} size={14} />
                <span className="text-[#dce0e8]">
                  {ing.count}× {ingMeta.shortName}
                </span>
              </button>
            );
          })}
          <span className="text-[#7e8594] font-mono px-0.5">→</span>
          <button
            type="button"
            onClick={() => jumpTo(stationId)}
            className="px-1.5 py-0.5 rounded-[2px] bg-[#1a2230] hover:bg-[#253247] border border-[#334863] text-[#93c5fd] text-[9px] font-mono cursor-pointer"
          >
            {stationLabel}
          </button>
          {techId && (
            <button
              type="button"
              onClick={() => jumpTo(`tech:${techId}`)}
              className={`px-1.5 py-0.5 rounded-[2px] border text-[9px] font-mono cursor-pointer ${
                isUnlocked
                  ? 'bg-[#17281a] border-[#45b649]/60 text-[#86ef92]'
                  : 'bg-[#2a1f2d] border-[#a855f7]/60 text-[#d8b4fe]'
              }`}
            >
              Tech: {techId.replace(/_/g, ' ')}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="capytorio-drawer-pedia"
      role="dialog"
      aria-label="Capytoriopedia Encyclopedia and Help"
      onClick={(e) => e.stopPropagation()}
      className={`${FACTORIO_PANEL_FRAME} w-full max-w-[960px] h-full max-h-[82vh] flex flex-col overflow-hidden text-[#e6e8ec]`}
    >
      {/* HEADER */}
      <div className={`${FACTORIO_HEADER_BAR} flex-wrap`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            data-testid="capytorio-pedia-back-btn"
            disabled={!canGoBack}
            onClick={goBack}
            title="Previous entry"
            aria-label="Back"
            className={`w-6 h-6 rounded-[2px] flex items-center justify-center shrink-0 ${
              canGoBack
                ? `${FACTORIO_BTN_IDLE} cursor-pointer`
                : 'bg-[#1d1f24] border border-[#2d3038] text-[#555a66] cursor-not-allowed'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            data-testid="capytorio-pedia-fwd-btn"
            disabled={!canGoForward}
            onClick={goForward}
            title="Next entry"
            aria-label="Forward"
            className={`w-6 h-6 rounded-[2px] flex items-center justify-center shrink-0 ${
              canGoForward
                ? `${FACTORIO_BTN_IDLE} cursor-pointer`
                : 'bg-[#1d1f24] border border-[#2d3038] text-[#555a66] cursor-not-allowed'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <BookOpen className="w-4 h-4 text-[#f4b054] shrink-0 ml-1" />
          <span className="text-xs font-bold tracking-wider uppercase text-[#f4b054] whitespace-nowrap">
            Capytoriopedia
          </span>
          <span className="hidden sm:inline text-[10px] font-mono text-[#9aa0ac] px-1.5 py-0.5 rounded-[2px] bg-[#181a1f] border border-[#30343e] whitespace-nowrap">
            Alt + Left-Click anything
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setMobileShowIndex((prev) => !prev)}
            className={`md:hidden h-6 px-2 rounded-[2px] text-[10px] font-semibold cursor-pointer ${
              mobileShowIndex ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
            }`}
          >
            {mobileShowIndex ? 'Article' : `Index (${catalog.length})`}
          </button>
          <button
            type="button"
            data-testid="capytorio-pedia-close-btn"
            onClick={onClose}
            aria-label="Close Capytoriopedia"
            className={`w-6 h-6 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* BODY: Searchable Left Index + Rich Encyclopedia Article */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-2.5 p-2.5 overflow-hidden">
        {/* LEFT INDEX */}
        <div
          className={`${
            mobileShowIndex ? 'flex' : 'hidden md:flex'
          } md:col-span-4 flex-col gap-2 min-h-0 ${FACTORIO_WELL} p-2`}
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8e95a2] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="capytorio-pedia-search"
              placeholder="Search items, machines, ores, tech..."
              aria-label="Search Capytoriopedia"
              className="w-full h-7 pl-7 pr-6 rounded-[2px] bg-[#111317] border border-[#323640] focus:border-[#e58926] outline-none text-[11px] text-[#eef1f5] placeholder-[#6c7382]"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8e95a2] hover:text-[#eef1f5] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-1.5 py-0.5 rounded-[2px] text-[9.5px] font-semibold cursor-pointer ${
                  categoryFilter === cat.id ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredCatalog.length === 0 ? (
              <div className="text-[11px] text-[#7c8391] py-6 text-center">
                No entries match "{searchQuery}"
              </div>
            ) : (
              filteredCatalog.map((item) => {
                const isSel = entry?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`capytorio-pedia-index-${item.id}`}
                    onClick={() => jumpTo(item.id)}
                    className={`w-full px-2 py-1.5 rounded-[2px] flex items-center gap-2 text-left cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-[#3c2a14] border border-[#e58926] text-[#ffe4b5]'
                        : 'bg-[#121418] hover:bg-[#1e222a] border border-transparent text-[#dce0e8]'
                    }`}
                  >
                    <EntryIconView icon={item.icon} size={20} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold truncate leading-tight">
                        {item.title}
                      </div>
                      <div className="text-[9px] font-mono text-[#8e95a2] truncate">
                        {item.categoryLabel}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT ARTICLE DETAIL */}
        <div
          data-testid="capytorio-pedia-detail"
          className={`${
            mobileShowIndex ? 'hidden md:flex' : 'flex'
          } md:col-span-8 flex-col gap-2.5 min-h-0 overflow-y-auto ${FACTORIO_WELL} p-3`}
        >
          {entry ? (
            <>
              {/* Live Tile Scan Context Bar (when Alt+Left-Clicked on the factory grid) */}
              {contextInfo && tileContextLinks.length > 0 && (
                <div className="p-2 rounded-[2px] bg-[#121822] border border-[#2a4361] space-y-1">
                  <div className="text-[9px] font-mono uppercase tracking-wider text-[#7dd3fc]">
                    Scanned Tile ({contextInfo.gx}, {contextInfo.gz}) — Click any entity below
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tileContextLinks.map((lnk) => (
                      <button
                        key={`${lnk.tag}-${lnk.pediaId}`}
                        type="button"
                        onClick={() => jumpTo(lnk.pediaId)}
                        className={`px-1.5 py-0.5 rounded-[2px] text-[9.5px] font-mono cursor-pointer ${
                          entry.id === lnk.pediaId
                            ? 'bg-[#2a3f59] border border-[#38bdf8] text-[#e0f2fe] font-bold'
                            : 'bg-[#17212e] hover:bg-[#223246] border border-[#2b425e] text-[#bae6fd]'
                        }`}
                      >
                        <span className="opacity-70">{lnk.tag}:</span> {lnk.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hero Title & Quick Actions */}
              <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-[#2b2e35]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-[2px] bg-[#111317] border border-[#3c4049] flex items-center justify-center shrink-0">
                    <EntryIconView icon={entry.icon} size={38} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2
                        data-testid="capytorio-pedia-title"
                        className="text-sm sm:text-base font-bold text-[#f4b054] truncate"
                      >
                        {entry.title}
                      </h2>
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-[#242832] border border-[#3b404d] text-[9px] font-mono uppercase text-[#b8bfcc]">
                        {entry.categoryLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9aa0ac] mt-0.5">{entry.subtitle}</p>
                    {(ownedCount > 0 || entry.kind === 'machine' || entry.kind === 'item') && (
                      <p className="text-[10px] font-mono text-[#7ce680] mt-0.5">
                        In pocket: ×{ownedCount}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {entry.placeableToolId && (
                    <button
                      type="button"
                      data-testid="capytorio-pedia-equip-btn"
                      onClick={() => {
                        onSelectTool(entry.placeableToolId!, true);
                        onClose();
                      }}
                      className={`h-7 px-2.5 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 ${FACTORIO_BTN_ACTIVE}`}
                    >
                      <Wrench className="w-3 h-3 shrink-0" />
                      <span>Equip</span>
                    </button>
                  )}

                  {canCraftBaseMachine && entry.machineBaseType && (
                    <button
                      type="button"
                      data-testid="capytorio-pedia-craft-btn"
                      onClick={() => onCraftMachine(entry.machineBaseType!)}
                      className="h-7 px-2.5 rounded-[2px] bg-[#1e2d20] hover:bg-[#273c2a] border border-[#45b649]/75 text-[#86ef92] text-[10px] font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <Hammer className="w-3 h-3 shrink-0" />
                      <span>Craft ×1</span>
                    </button>
                  )}

                  {!canCraftBaseMachine && canCraftRecipe && firstPocketCraftableRecipe && (
                    <button
                      type="button"
                      data-testid="capytorio-pedia-craft-btn"
                      onClick={() => onCraftRecipe(firstPocketCraftableRecipe.id, 1, false)}
                      className="h-7 px-2.5 rounded-[2px] bg-[#1e2d20] hover:bg-[#273c2a] border border-[#45b649]/75 text-[#86ef92] text-[10px] font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <Hammer className="w-3 h-3 shrink-0" />
                      <span>Craft ×{firstPocketCraftableRecipe.resultCount}</span>
                    </button>
                  )}

                  {entry.techId && (
                    <button
                      type="button"
                      data-testid="capytorio-pedia-research-btn"
                      onClick={() => onSelectTech(entry.techId!)}
                      className={`h-7 px-2.5 rounded-[2px] text-[10px] font-semibold cursor-pointer flex items-center gap-1 ${FACTORIO_BTN_ACTIVE}`}
                    >
                      <FlaskConical className="w-3 h-3 shrink-0" />
                      <span>
                        {snap.activeTechId === entry.techId ? 'Researching' : 'Set Active Research'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Description & Key Telemetry Stats */}
              <div className="space-y-2">
                <p className="text-[11.5px] leading-relaxed text-[#dce0e8]">{entry.description}</p>
                <div className="text-[10px] font-mono text-[#a3aab7]">
                  <span className="text-[#f4b054] font-semibold">Source:</span> {entry.sourceSummary}
                </div>

                {entry.stats.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {entry.stats.map((st) => (
                      <div
                        key={st.label}
                        className="p-1.5 rounded-[2px] bg-[#121418] border border-[#2a2e38]"
                      >
                        <div className="text-[9px] font-mono uppercase text-[#8e95a2]">
                          {st.label}
                        </div>
                        <div className="text-[10.5px] font-mono font-semibold text-[#eef1f5] truncate">
                          {st.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* How to Use & Tips */}
              {entry.tips.length > 0 && (
                <div className="p-2 rounded-[2px] bg-[#121418] border border-[#2b303a] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#f4b054] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>How To Use & Controls</span>
                  </div>
                  <ul className="space-y-1 text-[10.5px] text-[#c8cdd8] list-disc pl-4">
                    {entry.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Build / Research Cost */}
              {entry.buildCost.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#f4b054]">
                    {entry.kind === 'tech' ? 'Science Pack Cost' : 'Build / Craft Cost'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.buildCost.map((c) => {
                      const cMeta = getCapytorioItemMeta(c.item);
                      const cShape = cMeta.shape ?? resolveCapytorioItemShape(cMeta.id, cMeta.category);
                      const have = snap.pocketItems[c.item] ?? 0;
                      return (
                        <button
                          key={c.item}
                          type="button"
                          onClick={() => jumpTo(c.item)}
                          className="px-2 py-1 rounded-[2px] bg-[#121418] hover:bg-[#1d2129] border border-[#323642] flex items-center gap-1.5 text-[10px] font-mono cursor-pointer"
                        >
                          <CapytorioItemIcon shape={cShape} color={cMeta.cssColor} size={16} />
                          <span className="text-[#eef1f5]">
                            {c.count}× {cMeta.name}
                          </span>
                          {entry.kind !== 'tech' && (
                            <span className={have >= c.count ? 'text-[#7ce680]' : 'text-[#f2857c]'}>
                              ({have})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unlocked By Techs */}
              {entry.unlockedByTechs.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#d8b4fe]">
                    Unlocked By Technology
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.unlockedByTechs.map((t) => {
                      const done = snap.unlockedTechs.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => jumpTo(`tech:${t.id}`)}
                          className={`px-2 py-1 rounded-[2px] border text-[10px] font-mono cursor-pointer flex items-center gap-1 ${
                            done
                              ? 'bg-[#17281a] border-[#45b649]/65 text-[#86ef92]'
                              : 'bg-[#211929] hover:bg-[#2c2038] border-[#a855f7]/60 text-[#e9d5ff]'
                          }`}
                        >
                          <FlaskConical className="w-3 h-3 shrink-0" />
                          <span>
                            {t.name} {done ? '(Researched)' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tech Prerequisites & Unlocked Recipes */}
              {entry.techPrerequisites.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#93c5fd]">
                    Prerequisites
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.techPrerequisites.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => jumpTo(`tech:${p.id}`)}
                        className="px-2 py-1 rounded-[2px] bg-[#161c26] hover:bg-[#1f2938] border border-[#34465e] text-[10px] font-mono text-[#bae6fd] cursor-pointer"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {entry.unlockedRecipesForTech.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#7ce680]">
                    Unlocks Recipes ({entry.unlockedRecipesForTech.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {entry.unlockedRecipesForTech.map((r) => renderRecipeCard(r, 'unlock'))}
                  </div>
                </div>
              )}

              {/* Produced By Recipes */}
              {entry.producedByRecipes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#f4b054]">
                    Produced By ({entry.producedByRecipes.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {entry.producedByRecipes.map((r) => renderRecipeCard(r, 'prod'))}
                  </div>
                </div>
              )}

              {/* Used In Recipes */}
              {entry.usedInRecipes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#7dd3fc]">
                    Used In Recipes ({entry.usedInRecipes.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {entry.usedInRecipes.slice(0, 16).map((r) => renderRecipeCard(r, 'used'))}
                  </div>
                </div>
              )}

              {/* Used As Science Pack For Techs */}
              {entry.usedAsTechCostIn.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#d8b4fe]">
                    Researches Technologies ({entry.usedAsTechCostIn.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.usedAsTechCostIn.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => jumpTo(`tech:${t.id}`)}
                        className="px-2 py-1 rounded-[2px] bg-[#1a1622] hover:bg-[#272033] border border-[#44355a] text-[10px] font-mono text-[#e9d5ff] cursor-pointer"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Station Recipes (for Foundry / Assembler) */}
              {entry.stationRecipes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#c4c9d4] flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-[#f4b054]" />
                    <span>Crafts In This Machine ({entry.stationRecipes.length}+ recipes)</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entry.stationRecipes.map((rec) => {
                      const rMeta = getCapytorioItemMeta(rec.result);
                      const rShape =
                        rMeta.shape ?? resolveCapytorioItemShape(rMeta.id, rMeta.category);
                      return (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => jumpTo(rec.result)}
                          className="px-1.5 py-1 rounded-[2px] bg-[#121418] hover:bg-[#1e2229] border border-[#2f333d] flex items-center gap-1 text-[10px] cursor-pointer"
                        >
                          <CapytorioItemIcon shape={rShape} color={rMeta.cssColor} size={14} />
                          <span className="text-[#dce0e8]">{rec.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-[#9aa0ac] p-6 text-center">
              Select any item, building, resource, or technology from the index.
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
