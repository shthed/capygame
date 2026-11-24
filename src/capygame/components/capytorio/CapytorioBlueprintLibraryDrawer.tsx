import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  Download,
  Factory,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CAPYTORIO_MACHINE_SPECS } from '../../engine/CapytorioData';
import {
  MAX_CAPYTORIO_BLUEPRINT_LIBRARY,
  resolveCapytorioPlaceableSpec,
  type CapytorioSavedBlueprint,
  type CapytorioUiSnapshot,
} from '../../engine/CapytorioFactoryEngine';
import type { FactorioBlueprintImportResult } from '../../engine/FactorioBlueprintCodec';
import {
  FACTORIO_BTN_ACTIVE,
  FACTORIO_BTN_IDLE,
  FACTORIO_HEADER_BAR,
  FACTORIO_PANEL_FRAME,
  FACTORIO_WELL,
  hexToCss,
} from './CapytorioTooltip';

export const BlueprintMiniPreview: React.FC<{ blueprint: CapytorioSavedBlueprint }> = ({
  blueprint,
}) => {
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

export interface CapytorioBlueprintLibraryDrawerProps {
  snap: CapytorioUiSnapshot;
  blueprintSearchInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
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
  showToast: (msg: string) => void;
}

export const CapytorioBlueprintLibraryDrawer: React.FC<CapytorioBlueprintLibraryDrawerProps> = ({
  snap,
  blueprintSearchInputRef,
  onClose,
  onSelectBlueprint,
  onDeleteBlueprint,
  onClearBlueprintLibrary,
  onBuildSampleStarterMall,
  onImportFactorioString,
  onExportBlueprintString,
  onExportFactoryString,
  onExportBlueprintBookString,
  showToast,
}) => {
  const [blueprintSearchQuery, setBlueprintSearchQuery] = useState('');
  const [blueprintIoMode, setBlueprintIoMode] = useState<'none' | 'import' | 'export'>('none');
  const [blueprintImportText, setBlueprintImportText] = useState('');
  const [blueprintImportBusy, setBlueprintImportBusy] = useState(false);
  const [blueprintImportError, setBlueprintImportError] = useState<string | null>(null);
  const [blueprintImportReport, setBlueprintImportReport] = useState<
    (FactorioBlueprintImportResult & { addedIds: string[] }) | null
  >(null);
  const [blueprintExportState, setBlueprintExportState] = useState<{
    title: string;
    meta: string;
    encoded: string;
  } | null>(null);
  const [blueprintExportCopied, setBlueprintExportCopied] = useState(false);

  const clip = snap.clipboard;
  const q = blueprintSearchQuery.trim().toLowerCase();
  const filteredPresets = (snap.presetBlueprints ?? []).filter((bp) => {
    if (!q) return true;
    return bp.label.toLowerCase().includes(q) || 'preset starter mall sample'.includes(q);
  });
  const filteredSaved = snap.blueprintLibrary.filter((bp) => {
    if (!q) return true;
    return bp.label.toLowerCase().includes(q) || bp.sourceMode.includes(q);
  });

  const handleOpenExport = async (
    loader: () => Promise<{
      ok: boolean;
      label: string;
      encoded: string;
      entityCount: number;
      blueprintCount?: number;
      error?: string;
    }>
  ) => {
    const res = await loader();
    if (!res.ok) {
      showToast?.(res.error ?? 'Nothing to export yet.');
      return;
    }
    const meta =
      typeof res.blueprintCount === 'number'
        ? `${res.blueprintCount} ${res.blueprintCount === 1 ? 'blueprint' : 'blueprints'} · ${res.entityCount} entities · Factorio 0e string`
        : `${res.entityCount} ${res.entityCount === 1 ? 'entity' : 'entities'} · Factorio 0e string`;
    setBlueprintExportState({
      title: res.label,
      meta,
      encoded: res.encoded,
    });
    setBlueprintExportCopied(false);
    setBlueprintIoMode('export');
  };

  const handleImportSubmit = async () => {
    const trimmed = blueprintImportText.trim();
    if (!trimmed) {
      setBlueprintImportError('Paste a Factorio 0e... blueprint string or JSON first.');
      return;
    }
    setBlueprintImportBusy(true);
    setBlueprintImportError(null);
    try {
      const res = await onImportFactorioString(trimmed);
      setBlueprintImportReport(res);
      if (!res.ok) {
        setBlueprintImportError(res.error ?? 'Could not decode blueprint string.');
      } else {
        setBlueprintImportText('');
      }
    } finally {
      setBlueprintImportBusy(false);
    }
  };

  const handleCopyExport = async () => {
    if (!blueprintExportState?.encoded) return;
    try {
      await navigator.clipboard.writeText(blueprintExportState.encoded);
      setBlueprintExportCopied(true);
      showToast?.('Copied Factorio blueprint string');
    } catch {
      showToast?.('Select and copy the blueprint string manually');
    }
  };

  const sourceLabel = (mode: CapytorioSavedBlueprint['sourceMode']) =>
    mode === 'cut'
      ? 'Cut'
      : mode === 'import'
        ? 'Import'
        : mode === 'preset'
          ? 'Preset'
          : 'Copy';

  return (
    <div
      data-testid="capytorio-drawer-blueprints"
      role="dialog"
      aria-label="Blueprint Library"
      onClick={(e) => e.stopPropagation()}
      className={`${FACTORIO_PANEL_FRAME} w-full max-w-[820px] max-h-full flex flex-col overflow-hidden text-[#e6e8ec]`}
    >
      <div className={`${FACTORIO_HEADER_BAR} flex-wrap gap-y-1.5`}>
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
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
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
              className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${FACTORIO_BTN_IDLE}`}
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            aria-label="Close Blueprint Library"
            onClick={onClose}
            className={`h-6 w-6 rounded-[2px] flex items-center justify-center shrink-0 cursor-pointer ${FACTORIO_BTN_IDLE}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Action toolbar: Build Sample Mall + Factorio 0e... Import / Export */}
      <div className="px-3 py-2 bg-[#181b20] border-b border-[#2b303a] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="capytorio-build-sample-mall-btn"
            onClick={() => {
              onBuildSampleStarterMall();
              onClose();
            }}
            className="h-7 px-2.5 rounded-[2px] flex items-center gap-1.5 text-[11px] font-bold tracking-wide whitespace-nowrap shrink-0 cursor-pointer bg-[#b46218] hover:bg-[#cc721f] text-[#fff7eb] border border-[#e59838] transition-colors"
          >
            <Factory className="w-3.5 h-3.5 shrink-0" />
            <span>Build Sample Mall</span>
          </button>
          <button
            type="button"
            data-testid="capytorio-blueprint-import-toggle-btn"
            onClick={() => {
              setBlueprintImportError(null);
              setBlueprintIoMode((prev) => (prev === 'import' ? 'none' : 'import'));
            }}
            className={`h-7 px-2.5 rounded-[2px] flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              blueprintIoMode === 'import' ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
            }`}
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span>Import String</span>
          </button>
          <button
            type="button"
            data-testid="capytorio-blueprint-export-factory-btn"
            onClick={() => {
              void handleOpenExport(onExportFactoryString);
            }}
            className={`h-7 px-2.5 rounded-[2px] flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${FACTORIO_BTN_IDLE}`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export Factory</span>
          </button>
          <button
            type="button"
            data-testid="capytorio-blueprint-export-book-btn"
            onClick={() => {
              void handleOpenExport(onExportBlueprintBookString);
            }}
            className={`h-7 px-2.5 rounded-[2px] flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${FACTORIO_BTN_IDLE}`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Export Book</span>
          </button>
        </div>
        <span className="text-[10px] font-mono text-[#bae6fd] whitespace-nowrap">
          [R] Rotate · [H] Flip H · [V] Flip V
        </span>
      </div>

      {/* Inline Factorio Blueprint String / Book Import Drawer */}
      {blueprintIoMode === 'import' && (
        <div
          data-testid="capytorio-blueprint-import-panel"
          className="px-3 py-2.5 bg-[#14171d] border-b border-[#343b48] space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-[#f4b054]">
              Import Factorio Blueprint or Blueprint Book (0e... string or 2.0 JSON)
            </div>
            <button
              type="button"
              onClick={() => setBlueprintIoMode('none')}
              className="text-[10px] text-[#9aa0ac] hover:text-[#eef1f5] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Hide
            </button>
          </div>
          <textarea
            data-testid="capytorio-blueprint-import-input"
            value={blueprintImportText}
            onChange={(e) => {
              setBlueprintImportText(e.target.value);
              if (blueprintImportError) setBlueprintImportError(null);
            }}
            rows={3}
            spellCheck={false}
            placeholder="Paste a Factorio 0e... blueprint string, blueprint book string, or JSON here..."
            className="w-full p-2 rounded-[2px] bg-[#0e1014] border border-[#2f3541] focus:border-[#e58926] outline-none font-mono text-[11px] text-[#e6e8ec] placeholder-[#687080] resize-y"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-[#9aa0ac]">
              Exact entity matches only · unsupported or modded entities are skipped with a warning
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="capytorio-blueprint-import-submit"
                disabled={blueprintImportBusy}
                onClick={() => {
                  void handleImportSubmit();
                }}
                className="h-7 px-3 rounded-[2px] text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer bg-[#2a5c3f] hover:bg-[#33704d] text-[#ecfdf5] border border-[#4ade80]/50 disabled:opacity-50"
              >
                {blueprintImportBusy ? 'Decoding...' : 'Import & Equip'}
              </button>
            </div>
          </div>

          {blueprintImportError && (
            <div
              role="alert"
              data-testid="capytorio-blueprint-import-error"
              className="flex items-start gap-2 px-2.5 py-2 rounded-[2px] bg-[#361b1e] border border-[#b91c1c] text-[11px] text-[#fecaca]"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#f87171] shrink-0 mt-0.5" />
              <span>{blueprintImportError}</span>
            </div>
          )}

          {blueprintImportReport?.ok && (
            <div data-testid="capytorio-blueprint-import-summary" className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-[2px] bg-[#162b21] border border-[#2f6f4e] text-[11px] text-[#bbf7d0]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Check className="w-3.5 h-3.5 text-[#4ade80] shrink-0" />
                  <span>
                    Imported{' '}
                    <strong className="font-mono">{blueprintImportReport.blueprints.length}</strong>{' '}
                    {blueprintImportReport.blueprints.length === 1 ? 'blueprint' : 'blueprints'} ·{' '}
                    <strong className="font-mono">
                      {blueprintImportReport.importedEntityCount}
                    </strong>{' '}
                    entities
                    {blueprintImportReport.bookLabel
                      ? ` from book "${blueprintImportReport.bookLabel}"`
                      : ''}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="capytorio-blueprint-import-place-btn"
                  onClick={onClose}
                  className="h-6 px-2.5 rounded-[2px] text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer bg-[#b46218] hover:bg-[#cc721f] text-[#fff7eb] border border-[#e59838]"
                >
                  Close &amp; Place
                </button>
              </div>

              {blueprintImportReport.skippedTotalCount > 0 && (
                <div
                  role="status"
                  data-testid="capytorio-blueprint-import-warnings"
                  className="flex items-start gap-2 px-2.5 py-2 rounded-[2px] bg-[#332413] border border-[#d97706] text-[11px] text-[#fde68a]"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#fbbf24] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold text-[#fcd34d]">
                      Skipped {blueprintImportReport.skippedTotalCount} unsupported{' '}
                      {blueprintImportReport.skippedTotalCount === 1 ? 'entity' : 'entities'}:
                    </div>
                    <div className="font-mono text-[10px] text-[#fde68a] break-words mt-0.5">
                      {blueprintImportReport.skippedEntities
                        .map((s) => `${s.name} ×${s.count}`)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inline Factorio Blueprint String Export Drawer */}
      {blueprintIoMode === 'export' && blueprintExportState && (
        <div
          data-testid="capytorio-blueprint-export-panel"
          className="px-3 py-2.5 bg-[#14171d] border-b border-[#343b48] space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-[#f4b054]">
                {blueprintExportState.title}
              </span>
              <span className="ml-2 text-[10px] font-mono text-[#9aa0ac]">
                {blueprintExportState.meta}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="capytorio-blueprint-export-copy"
                onClick={() => {
                  void handleCopyExport();
                }}
                className="h-6 px-2.5 rounded-[2px] flex items-center gap-1 text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer bg-[#b46218] hover:bg-[#cc721f] text-[#fff7eb] border border-[#e59838]"
              >
                {blueprintExportCopied ? (
                  <Check className="w-3 h-3 shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 shrink-0" />
                )}
                <span>{blueprintExportCopied ? 'Copied' : 'Copy String'}</span>
              </button>
              <button
                type="button"
                onClick={() => setBlueprintIoMode('none')}
                className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${FACTORIO_BTN_IDLE}`}
              >
                Hide
              </button>
            </div>
          </div>
          <textarea
            data-testid="capytorio-blueprint-export-output"
            readOnly
            value={blueprintExportState.encoded}
            onFocus={(e) => e.currentTarget.select()}
            rows={3}
            spellCheck={false}
            aria-label="Exported Factorio blueprint string"
            className="w-full p-2 rounded-[2px] bg-[#0e1014] border border-[#2f3541] font-mono text-[10px] text-[#bae6fd] select-all resize-y"
          />
        </div>
      )}

      <div className="p-3 overflow-y-auto flex-1 min-h-0 space-y-4">
        {/* Built-in Presets (Starter Mall) */}
        {filteredPresets.length > 0 && (
          <section aria-label="Built-in Presets" className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-[#9aa0ac]">
              <span>Built-in Presets</span>
              <span className="font-mono">Self-powered starter layout</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredPresets.map((bp) => {
                const isActive = clip.toolState === 'paste' && clip.activeBlueprintId === bp.id;
                return (
                  <div
                    key={bp.id}
                    data-testid={`capytorio-blueprint-card-${bp.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectBlueprint(bp.id);
                      onClose();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectBlueprint(bp.id);
                        onClose();
                      }
                    }}
                    className={`group rounded-[2px] p-2 text-left cursor-pointer transition-colors flex items-center gap-2.5 ${
                      isActive
                        ? 'bg-[#2a2319] border border-[#e58926]'
                        : 'bg-[#171b22] hover:bg-[#1f2530] border border-[#323947]'
                    }`}
                  >
                    <div className="w-24 shrink-0">
                      <BlueprintMiniPreview blueprint={bp} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-[11px] font-bold text-[#f4b054] truncate">
                        {bp.label}
                      </div>
                      <div className="text-[10px] text-[#b4bac6]">
                        Coal Steam Power · Iron &amp; Copper Smelting · Automated Belts, Inserters
                        &amp; Circuits
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-[#8f97a6]">
                        {bp.width}×{bp.height} · {bp.entries.length} entities · Preset
                      </div>
                      <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`capytorio-preset-build-${bp.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onBuildSampleStarterMall();
                            onClose();
                          }}
                          className="h-6 px-2 rounded-[2px] text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer bg-[#b46218] hover:bg-[#cc721f] text-[#fff7eb] border border-[#e59838]"
                        >
                          Build Live
                        </button>
                        <button
                          type="button"
                          data-testid={`capytorio-blueprint-export-${bp.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleOpenExport(() => onExportBlueprintString(bp.id));
                          }}
                          className={`h-6 px-2 rounded-[2px] text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${FACTORIO_BTN_IDLE}`}
                        >
                          Export 0e
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* User Saved & Imported Blueprints */}
        <section aria-label="Saved Blueprints" className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-[#9aa0ac]">
            <span>Saved &amp; Imported Blueprints</span>
            <span className="font-mono">Copy [Ctrl+C] · Cut [Ctrl+X] · Import 0e...</span>
          </div>

          {snap.blueprintLibrary.length === 0 ? (
            <div
              data-testid="capytorio-blueprint-library-empty"
              className={`${FACTORIO_WELL} p-5 text-center space-y-1`}
            >
              <div className="text-xs font-semibold text-[#e4e6eb]">No saved blueprints yet</div>
              <p className="text-[11px] text-[#9aa0ac]">
                Copy [Ctrl+C], Cut [Ctrl+X], or click Import String above to add Factorio
                blueprints and books.
              </p>
            </div>
          ) : filteredSaved.length === 0 ? (
            <div className={`${FACTORIO_WELL} p-4 text-center text-[11px] text-[#9aa0ac]`}>
              No blueprints match &ldquo;{blueprintSearchQuery}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredSaved.map((bp, idx) => {
                const isActive = clip.toolState === 'paste' && clip.activeBlueprintId === bp.id;
                return (
                  <div
                    key={bp.id}
                    data-testid={`capytorio-blueprint-card-${bp.id}`}
                    data-blueprint-index={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectBlueprint(bp.id);
                      onClose();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectBlueprint(bp.id);
                        onClose();
                      }
                    }}
                    className={`group relative rounded-[2px] p-1.5 text-left cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#2a2319] border border-[#e58926]'
                        : 'bg-[#16191f] hover:bg-[#1f242d] border border-[#2f3541]'
                    }`}
                  >
                    <BlueprintMiniPreview blueprint={bp} />
                    <div className="mt-1.5 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-[11px] font-semibold text-[#eef1f5] truncate min-w-0">
                          {bp.label}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            data-testid={`capytorio-blueprint-export-${bp.id}`}
                            title="Export Factorio 0e... blueprint string"
                            aria-label={`Export blueprint ${bp.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleOpenExport(() => onExportBlueprintString(bp.id));
                            }}
                            className="h-5 w-5 rounded-[2px] flex items-center justify-center shrink-0 text-[#8e95a2] hover:text-[#bae6fd] hover:bg-[#1e2d3b] cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                          </button>
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
                      <div className="text-[10px] font-mono tabular-nums text-[#9aa0ac] truncate">
                        {bp.width}×{bp.height} · {bp.entries.length}{' '}
                        {bp.entries.length === 1 ? 'item' : 'items'} · {sourceLabel(bp.sourceMode)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
