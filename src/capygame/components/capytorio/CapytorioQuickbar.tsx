import React from 'react';
import {
  ClipboardPaste,
  Copy,
  Hammer,
  Package,
  Rocket,
  RotateCcw,
  Scissors,
  Search,
  Trash2,
} from 'lucide-react';
import { getCapytorioFootprint } from '../../engine/CapytorioData';
import {
  resolveCapytorioPlaceableSpec,
  type CapytorioClipboardToolState,
  type CapytorioSelectionShape,
  type CapytorioUiSnapshot,
} from '../../engine/CapytorioFactoryEngine';
import { CapytorioMachineIcon, CapytorioSlotTile } from '../CapytorioSlotIcon';
import type { CapytorioDrawerTab } from '../CapytorioHud';
import {
  DIR_LABELS,
  FACTORIO_BTN_ACTIVE,
  FACTORIO_BTN_IDLE,
  FACTORIO_PANEL_FRAME,
  hexToCss,
  type CapytorioSlotTooltipData,
} from './CapytorioTooltip';

export interface CapytorioQuickbarProps {
  snap: CapytorioUiSnapshot;
  drawerTab: CapytorioDrawerTab;
  setDrawerTab: React.Dispatch<React.SetStateAction<CapytorioDrawerTab>>;
  toggleTab: (tab: Exclude<CapytorioDrawerTab, 'none'>) => void;
  recentSlots: string[];
  dirLabel: string;
  onSelectTool: (toolId: string, promoteToRecent?: boolean) => void;
  onRotateDir: () => void;
  onSetClipboardMode: (mode: CapytorioClipboardToolState, shape?: CapytorioSelectionShape) => void;
  onClearClipboard: () => void;
  onLaunchRocket: () => void;
  onOpenPedia: (entryId: string) => void;
  showSlotTooltip: (el: HTMLElement, data: CapytorioSlotTooltipData) => void;
  hideSlotTooltip: () => void;
}

export const CapytorioQuickbar: React.FC<CapytorioQuickbarProps> = React.memo(({
  snap,
  drawerTab,
  setDrawerTab,
  toggleTab,
  recentSlots,
  dirLabel,
  onSelectTool,
  onRotateDir,
  onSetClipboardMode,
  onClearClipboard,
  onLaunchRocket,
  onOpenPedia,
  showSlotTooltip,
  hideSlotTooltip,
}) => {
  const clip = snap.clipboard;
  const isClipboardActive = clip.toolState !== 'off';
  const inspected = snap.inspectedMachine;
  const inspectedSpec = inspected
    ? resolveCapytorioPlaceableSpec(inspected.variantItemId ?? inspected.type)
    : null;
  const inspectedTile = snap.inspectedTile;

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
    <section
      data-testid="capytorio-build-bar"
      aria-label="Capytorio Factorio Quickbar"
      className="fixed bottom-1.5 hud-safe-bottom hud-safe-quickbar left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[calc(100vw-12px)] max-w-[780px] text-[#e6e8ec]"
    >
      <div className={`${FACTORIO_PANEL_FRAME} overflow-hidden`}>
        {/* SELECTED ITEM STATUS BAR */}
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
                variantItemId={selectedPlaceable.isBaseMachine ? undefined : selectedPlaceable.id}
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
                <span
                  className={
                    selectedStock === 0
                      ? 'text-[#f2857c] font-semibold'
                      : 'text-[#86ef92] font-semibold'
                  }
                >
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
                  variantItemId: resolved.isBaseMachine ? undefined : resolved.id,
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
                  variantItemId={resolved.isBaseMachine ? undefined : resolved.id}
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

          <div
            className="w-[2px] h-7 bg-[#111216] border-r border-[#3b3f4a] shrink-0"
            aria-hidden="true"
          />

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
  );
});
