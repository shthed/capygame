import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Globe,
  RefreshCw,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import {
  CAPYTORIO_MAP_PRESETS,
  FACTORIO_RESOURCE_IDS,
  cloneCapytorioMapGenConfig,
  createCapytorioMapPreset,
  decodeFactorioMapExchangeString,
  encodeFactorioMapExchangeString,
  generateRandomCapytorioSeed,
  sanitizeCapytorioMapGenConfig,
  sanitizeSeed,
  type CapytorioMapGenConfig,
  type CapytorioMapPresetId,
  type FactorioAutoplaceControl,
  type FactorioResourceId,
} from '../../engine/capytorio/FactorioMapExchangeCodec';
import {
  FACTORIO_BTN_ACTIVE,
  FACTORIO_BTN_IDLE,
  FACTORIO_HEADER_BAR,
  FACTORIO_PANEL_FRAME,
  FACTORIO_WELL,
} from './CapytorioTooltip';

type WorldGenSubTab = 'seed' | 'terrain' | 'resources';

interface ResourceDisplayMeta {
  label: string;
  swatch: string;
  tag: string;
}

const RESOURCE_DISPLAY: Readonly<Record<FactorioResourceId, ResourceDisplayMeta>> = {
  iron_ore: { label: 'Iron Ore', swatch: '#7fa8c9', tag: 'Solid' },
  copper_ore: { label: 'Copper Ore', swatch: '#d97a48', tag: 'Solid' },
  coal: { label: 'Coal', swatch: '#3d424b', tag: 'Fuel' },
  stone: { label: 'Stone', swatch: '#b9ad8a', tag: 'Solid' },
  crude_oil: { label: 'Crude Oil', swatch: '#7a2fa6', tag: 'Fluid' },
  uranium_ore: { label: 'Uranium Ore', swatch: '#59db44', tag: 'Nuclear' },
};

function formatPct(mult: number, allowOff = false): string {
  if (allowOff && mult <= 0.001) return 'Off';
  return `${Math.round(mult * 100)}%`;
}

function formatBias(val: number): string {
  const pct = Math.round(val * 100);
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function configsEqual(a: CapytorioMapGenConfig, b: CapytorioMapGenConfig): boolean {
  if (
    a.seed !== b.seed ||
    a.preset !== b.preset ||
    a.mapType !== b.mapType ||
    Math.abs(a.waterScale - b.waterScale) > 0.001 ||
    Math.abs(a.waterCoverage - b.waterCoverage) > 0.001 ||
    Math.abs(a.startingArea - b.startingArea) > 0.001 ||
    Math.abs(a.moistureScale - b.moistureScale) > 0.001 ||
    Math.abs(a.moistureBias - b.moistureBias) > 0.001 ||
    Math.abs(a.auxScale - b.auxScale) > 0.001 ||
    Math.abs(a.auxBias - b.auxBias) > 0.001 ||
    Math.abs(a.treesFrequency - b.treesFrequency) > 0.001 ||
    Math.abs(a.treesSize - b.treesSize) > 0.001
  ) {
    return false;
  }
  for (const id of FACTORIO_RESOURCE_IDS) {
    const ra = a.resources[id];
    const rb = b.resources[id];
    if (
      Math.abs(ra.frequency - rb.frequency) > 0.001 ||
      Math.abs(ra.size - rb.size) > 0.001 ||
      Math.abs(ra.richness - rb.richness) > 0.001
    ) {
      return false;
    }
  }
  return true;
}

export interface CapytorioWorldGenDrawerProps {
  activeConfig: CapytorioMapGenConfig;
  machineCount: number;
  isTopBarVisible: boolean;
  onApplyMapGen: (config: CapytorioMapGenConfig, resetFactory: boolean) => void;
  onDownloadSaveBackup: () => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const CapytorioWorldGenDrawer: React.FC<CapytorioWorldGenDrawerProps> = ({
  activeConfig,
  machineCount,
  isTopBarVisible,
  onApplyMapGen,
  onDownloadSaveBackup,
  onClose,
  showToast,
}) => {
  const [subTab, setSubTab] = useState<WorldGenSubTab>('seed');
  const [draft, setDraft] = useState<CapytorioMapGenConfig>(() =>
    cloneCapytorioMapGenConfig(activeConfig)
  );
  const [seedInput, setSeedInput] = useState<string>(() => String(activeConfig.seed));
  const [exchangeInput, setExchangeInput] = useState<string>('');
  const [exchangeFeedback, setExchangeFeedback] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  const hasBuiltFactory = machineCount > 0;
  const isDirty = !configsEqual(draft, activeConfig);

  // Keep draft synced when activeConfig changes externally (e.g., save restore)
  useEffect(() => {
    setDraft(cloneCapytorioMapGenConfig(activeConfig));
    setSeedInput(String(activeConfig.seed));
    setConfirmResetOpen(false);
  }, [activeConfig]);

  const commitOrStage = (next: CapytorioMapGenConfig, forceInstantWhenEmpty = true) => {
    const clean = sanitizeCapytorioMapGenConfig(next);
    setDraft(clean);
    setSeedInput(String(clean.seed));
    setConfirmResetOpen(false);
    if (!hasBuiltFactory && forceInstantWhenEmpty) {
      onApplyMapGen(clean, true);
    }
  };

  const handleSelectPreset = (presetId: CapytorioMapPresetId) => {
    const next = createCapytorioMapPreset(presetId, draft.seed);
    setExchangeFeedback(null);
    commitOrStage(next, true);
  };

  const handleRandomizeSeed = () => {
    const nextSeed = generateRandomCapytorioSeed();
    const next = cloneCapytorioMapGenConfig(draft);
    next.seed = nextSeed;
    setExchangeFeedback(null);
    commitOrStage(next, true);
  };

  const handleSeedCommit = () => {
    const nextSeed = sanitizeSeed(seedInput, draft.seed);
    setSeedInput(String(nextSeed));
    if (nextSeed === draft.seed) return;
    const next = cloneCapytorioMapGenConfig(draft);
    next.seed = nextSeed;
    commitOrStage(next, true);
  };

  const handleImportExchangeString = async () => {
    setIsBusy(true);
    setExchangeFeedback(null);
    try {
      const res = await decodeFactorioMapExchangeString(exchangeInput);
      if (!res.ok || !res.config) {
        setExchangeFeedback({
          tone: 'err',
          text: res.error ?? 'Could not decode map exchange string.',
        });
        return;
      }
      const label = res.sourceVersion ?? 'Factorio Map';
      commitOrStage(res.config, true);
      setExchangeFeedback({
        tone: 'ok',
        text: hasBuiltFactory
          ? `Decoded ${label} (Seed ${res.config.seed}). Confirm below to generate new world.`
          : `Loaded ${label} (Seed ${res.config.seed}) live in 3D.`,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyExchangeString = async () => {
    setIsBusy(true);
    setExchangeFeedback(null);
    try {
      const encoded = await encodeFactorioMapExchangeString(draft);
      setExchangeInput(encoded);
      let copied = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(encoded);
          copied = true;
        }
      } catch {
        copied = false;
      }
      setExchangeFeedback({
        tone: 'ok',
        text: copied
          ? 'Factorio 2.0 map exchange string copied to clipboard.'
          : 'Generated Factorio 2.0 map exchange string in the box above.',
      });
      showToast(copied ? 'Copied Map Exchange String' : 'Generated Map Exchange String');
    } catch {
      setExchangeFeedback({
        tone: 'err',
        text: 'Unable to encode map exchange string in this browser.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const updateTerrainField = <K extends keyof CapytorioMapGenConfig>(
    key: K,
    value: CapytorioMapGenConfig[K]
  ) => {
    const next = cloneCapytorioMapGenConfig(draft);
    next[key] = value;
    next.preset = 'custom';
    commitOrStage(next, true);
  };

  const updateResourceField = (
    resId: FactorioResourceId,
    field: keyof FactorioAutoplaceControl,
    value: number
  ) => {
    const next = cloneCapytorioMapGenConfig(draft);
    next.resources[resId] = {
      ...next.resources[resId],
      [field]: value,
    };
    next.preset = 'custom';
    commitOrStage(next, true);
  };

  const handleResetDefaults = () => {
    const next = createCapytorioMapPreset('default', draft.seed);
    setExchangeFeedback(null);
    commitOrStage(next, true);
  };

  const handleApplyDraftClicked = () => {
    if (!hasBuiltFactory) {
      onApplyMapGen(draft, true);
      return;
    }
    setBackupDownloaded(false);
    setConfirmResetOpen(true);
  };

  const handleConfirmGenerate = () => {
    setConfirmResetOpen(false);
    onApplyMapGen(draft, true);
  };

  const activePresetMeta = CAPYTORIO_MAP_PRESETS.find((p) => p.id === draft.preset);

  return (
    <aside
      data-testid="capytorio-drawer-worldgen"
      role="dialog"
      aria-label="Capytorio World Generator"
      onClick={(e) => e.stopPropagation()}
      className={`fixed z-20 pointer-events-auto flex flex-col overflow-hidden text-[#e6e8ec] ${FACTORIO_PANEL_FRAME} left-[calc(0.5rem+var(--sal))] right-[calc(0.5rem+var(--sar))] bottom-[calc(126px+var(--sab))] max-h-[54vh] sm:left-auto sm:right-[calc(0.5rem+var(--sar))] ${
        isTopBarVisible
          ? 'sm:top-[calc(82px+var(--sat))]'
          : 'sm:top-[calc(76px+var(--sat))]'
      } sm:bottom-[calc(84px+var(--sab))] sm:max-h-none sm:w-[364px]`}
    >
      {/* Header */}
      <div className={FACTORIO_HEADER_BAR}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Globe className="w-3.5 h-3.5 text-[#f4b054] shrink-0" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-[#f4b054] truncate">
            World Generator
          </span>
          <span className="text-[10px] font-mono tabular-nums text-[#9aa0ac] truncate">
            #{draft.seed}
          </span>
        </div>
        <button
          type="button"
          data-testid="capytorio-worldgen-close-btn"
          onClick={onClose}
          aria-label="Close World Generator"
          className={`w-6 h-6 rounded-[2px] flex items-center justify-center cursor-pointer ${FACTORIO_BTN_IDLE}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode Banner + Sub-Tabs */}
      <div className="px-2 pt-2 pb-1.5 bg-[#1b1e24] border-b border-[#343844] space-y-1.5 shrink-0">
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
          <span className={hasBuiltFactory ? 'text-[#f4b054]' : 'text-[#7ce680]'}>
            {hasBuiltFactory
              ? `${machineCount} building${machineCount === 1 ? '' : 's'} placed · Confirm before reset`
              : 'Live 3D terrain · Changes apply instantly'}
          </span>
          <button
            type="button"
            onClick={handleResetDefaults}
            title="Reset terrain and resources to Default preset (keeps current seed)"
            className={`h-5 px-1.5 rounded-[2px] text-[9.5px] font-mono flex items-center gap-1 cursor-pointer shrink-0 ${FACTORIO_BTN_IDLE}`}
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Defaults</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: 'seed', label: 'Seed & String' },
              { id: 'terrain', label: 'Terrain' },
              { id: 'resources', label: 'Resources (6)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`capytorio-worldgen-tab-${tab.id}`}
              onClick={() => setSubTab(tab.id)}
              className={`h-6 px-1.5 rounded-[2px] text-[10px] font-mono font-semibold cursor-pointer ${
                subTab === tab.id ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
        {subTab === 'seed' && (
          <>
            {/* Presets */}
            <div className={`${FACTORIO_WELL} p-2 space-y-1.5`}>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#9aa0ac]">
                <span>World Preset</span>
                <span className="text-[#f4b054]">
                  {activePresetMeta ? activePresetMeta.label : 'Custom'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {CAPYTORIO_MAP_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`capytorio-worldgen-preset-${preset.id}`}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`h-7 px-2 rounded-[2px] text-[10px] font-mono text-left truncate cursor-pointer ${
                      draft.preset === preset.id ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] leading-snug text-[#9aa0ac]">
                {activePresetMeta
                  ? activePresetMeta.description
                  : 'Custom Factorio map generator settings.'}
              </p>
            </div>

            {/* Numeric Seed */}
            <div className={`${FACTORIO_WELL} p-2 space-y-1.5`}>
              <label
                htmlFor="capytorio-world-seed-input"
                className="block text-[10px] font-mono uppercase text-[#9aa0ac]"
              >
                Map Seed (uint32)
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="capytorio-world-seed-input"
                  data-testid="capytorio-worldgen-seed-input"
                  type="text"
                  inputMode="numeric"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                  onBlur={handleSeedCommit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSeedCommit();
                    }
                  }}
                  className="flex-1 min-w-0 h-7 px-2 rounded-[2px] bg-[#0e1013] border border-[#4a4f5b] focus:border-[#f4b054] focus:outline-none text-[11px] font-mono tabular-nums text-[#e6e8ec]"
                />
                <button
                  type="button"
                  data-testid="capytorio-worldgen-apply-seed-btn"
                  onClick={handleSeedCommit}
                  className={`h-7 px-2 rounded-[2px] text-[10px] font-mono cursor-pointer ${FACTORIO_BTN_IDLE}`}
                >
                  Set
                </button>
                <button
                  type="button"
                  data-testid="capytorio-worldgen-randomize-btn"
                  onClick={handleRandomizeSeed}
                  title="Generate a fresh random seed"
                  className={`h-7 px-2 rounded-[2px] text-[10px] font-mono flex items-center gap-1 cursor-pointer ${FACTORIO_BTN_IDLE}`}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Random</span>
                </button>
              </div>
            </div>

            {/* Factorio Map Exchange String */}
            <div className={`${FACTORIO_WELL} p-2 space-y-1.5`}>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#9aa0ac]">
                <span>Factorio Map Exchange String</span>
                <span className="text-[9px] text-[#7c8494]">v1.1 / 2.0 / 2.1</span>
              </div>
              <textarea
                data-testid="capytorio-worldgen-exchange-input"
                rows={3}
                value={exchangeInput}
                onChange={(e) => setExchangeInput(e.target.value)}
                placeholder="Paste >>>eNp1...<<< from Factorio or a numeric seed..."
                className="w-full p-1.5 rounded-[2px] bg-[#0e1013] border border-[#4a4f5b] focus:border-[#f4b054] focus:outline-none text-[10px] font-mono text-[#e6e8ec] placeholder:text-[#5c6270] resize-none break-all"
              />
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  data-testid="capytorio-worldgen-import-btn"
                  disabled={isBusy || !exchangeInput.trim()}
                  onClick={handleImportExchangeString}
                  className={`h-7 px-2 rounded-[2px] text-[10px] font-mono flex items-center justify-center gap-1 ${
                    isBusy || !exchangeInput.trim()
                      ? 'bg-[#202228] border border-[#323640] text-[#5c6270] cursor-not-allowed'
                      : `${FACTORIO_BTN_ACTIVE} cursor-pointer`
                  }`}
                >
                  <Upload className="w-3 h-3" />
                  <span>Import String</span>
                </button>
                <button
                  type="button"
                  data-testid="capytorio-worldgen-export-btn"
                  disabled={isBusy}
                  onClick={handleCopyExchangeString}
                  className={`h-7 px-2 rounded-[2px] text-[10px] font-mono flex items-center justify-center gap-1 cursor-pointer ${FACTORIO_BTN_IDLE}`}
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy String</span>
                </button>
              </div>
              {exchangeFeedback && (
                <div
                  data-testid="capytorio-worldgen-exchange-feedback"
                  className={`p-1.5 rounded-[2px] text-[10px] font-mono leading-snug border ${
                    exchangeFeedback.tone === 'ok'
                      ? 'bg-[#132617] border-[#2d7a36] text-[#9ff0a4]'
                      : 'bg-[#2b1414] border-[#8b2c2c] text-[#f59c9c]'
                  }`}
                >
                  {exchangeFeedback.text}
                </div>
              )}
            </div>
          </>
        )}

        {subTab === 'terrain' && (
          <div className={`${FACTORIO_WELL} p-2.5 space-y-3`}>
            {/* Map Type */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#9aa0ac]">
                <span>Map Type</span>
                <span className="text-[#f4b054]">
                  {draft.mapType === 'island' ? 'Island' : 'Normal'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(['normal', 'island'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    data-testid={`capytorio-worldgen-maptype-${mode}`}
                    onClick={() => updateTerrainField('mapType', mode)}
                    className={`h-7 rounded-[2px] text-[10px] font-mono cursor-pointer ${
                      draft.mapType === mode ? FACTORIO_BTN_ACTIVE : FACTORIO_BTN_IDLE
                    }`}
                  >
                    {mode === 'island' ? 'Island Archipelago' : 'Normal Continents'}
                  </button>
                ))}
              </div>
            </div>

            <SliderRow
              label="Water Scale"
              valueText={formatPct(draft.waterScale)}
              min={0.25}
              max={3.0}
              step={0.05}
              value={draft.waterScale}
              onChange={(v) => updateTerrainField('waterScale', v)}
            />
            <SliderRow
              label="Water Coverage"
              valueText={formatPct(draft.waterCoverage, true)}
              min={0}
              max={3.0}
              step={0.05}
              value={draft.waterCoverage}
              onChange={(v) => updateTerrainField('waterCoverage', v)}
            />
            <SliderRow
              label="Starting Area"
              valueText={formatPct(draft.startingArea)}
              min={0.5}
              max={3.0}
              step={0.05}
              value={draft.startingArea}
              onChange={(v) => updateTerrainField('startingArea', v)}
            />
            <SliderRow
              label="Moisture Bias"
              valueText={formatBias(draft.moistureBias)}
              hint="Arid Desert <-> Lush Meadow"
              min={-0.5}
              max={0.5}
              step={0.02}
              value={draft.moistureBias}
              onChange={(v) => updateTerrainField('moistureBias', v)}
            />
            <SliderRow
              label="Biome Contrast (Aux)"
              valueText={formatBias(draft.auxBias)}
              hint="Temperate <-> Red Desert"
              min={-0.5}
              max={0.5}
              step={0.02}
              value={draft.auxBias}
              onChange={(v) => updateTerrainField('auxBias', v)}
            />
            <SliderRow
              label="Tree Coverage"
              valueText={formatPct(draft.treesSize, true)}
              min={0}
              max={3.0}
              step={0.05}
              value={draft.treesSize}
              onChange={(v) => updateTerrainField('treesSize', v)}
            />
          </div>
        )}

        {subTab === 'resources' && (
          <div className="space-y-2">
            {FACTORIO_RESOURCE_IDS.map((resId) => {
              const meta = RESOURCE_DISPLAY[resId];
              const ctrl = draft.resources[resId];
              return (
                <div
                  key={resId}
                  data-testid={`capytorio-worldgen-res-${resId}`}
                  className={`${FACTORIO_WELL} p-2 space-y-1.5`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-[1px] border border-white/25 shrink-0"
                        style={{ backgroundColor: meta.swatch }}
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-[#e6e8ec]">{meta.label}</span>
                    </div>
                    <span className="text-[9px] uppercase text-[#8e95a2]">{meta.tag}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <MiniSlider
                      label="Freq"
                      valueText={formatPct(ctrl.frequency)}
                      min={0.25}
                      max={3.0}
                      step={0.05}
                      value={ctrl.frequency}
                      onChange={(v) => updateResourceField(resId, 'frequency', v)}
                    />
                    <MiniSlider
                      label="Size"
                      valueText={formatPct(ctrl.size, true)}
                      min={0}
                      max={3.0}
                      step={0.05}
                      value={ctrl.size}
                      onChange={(v) => updateResourceField(resId, 'size', v)}
                    />
                    <MiniSlider
                      label="Rich"
                      valueText={formatPct(ctrl.richness)}
                      min={0.25}
                      max={3.0}
                      step={0.05}
                      value={ctrl.richness}
                      onChange={(v) => updateResourceField(resId, 'richness', v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: Protected Apply Confirmation when factory has buildings */}
      {hasBuiltFactory && (
        <div className="p-2 bg-[#1a1d23] border-t border-[#343844] shrink-0 space-y-1.5">
          {confirmResetOpen ? (
            <div
              data-testid="capytorio-worldgen-confirm-box"
              className="p-2 rounded-[2px] bg-[#2a1c12] border border-[#d97706] space-y-2"
            >
              <div className="flex items-start gap-1.5 text-[10px] leading-snug text-[#fde68a]">
                <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0 mt-0.5" />
                <span>
                  Generating seed <strong className="font-mono">#{draft.seed}</strong> starts a fresh
                  factory and clears your {machineCount} placed building
                  {machineCount === 1 ? '' : 's'}. Forest Games & Infinite Zoom progress stays intact.
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  data-testid="capytorio-worldgen-backup-btn"
                  onClick={() => {
                    onDownloadSaveBackup();
                    setBackupDownloaded(true);
                  }}
                  className={`h-7 px-2 rounded-[2px] text-[10px] font-mono flex items-center justify-center gap-1.5 cursor-pointer ${FACTORIO_BTN_IDLE}`}
                >
                  {backupDownloaded ? (
                    <Check className="w-3 h-3 text-[#7ce680]" />
                  ) : (
                    <Download className="w-3 h-3 text-[#38bdf8]" />
                  )}
                  <span>
                    {backupDownloaded
                      ? 'Backup Downloaded (.json)'
                      : 'Download Save Backup (.json)'}
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(false)}
                    className={`h-7 px-2 rounded-[2px] text-[10px] font-mono cursor-pointer ${FACTORIO_BTN_IDLE}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="capytorio-worldgen-confirm-generate-btn"
                    onClick={handleConfirmGenerate}
                    className="h-7 px-2 rounded-[2px] text-[10px] font-mono font-bold cursor-pointer bg-[#b44b1e] hover:bg-[#c85624] border border-[#f59d6d] border-b-[#5a220a] border-r-[#5a220a] text-[#fff3eb]"
                  >
                    Start New World
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-testid="capytorio-worldgen-apply-btn"
              disabled={!isDirty}
              onClick={handleApplyDraftClicked}
              className={`w-full h-8 px-2.5 rounded-[2px] text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 ${
                isDirty
                  ? `${FACTORIO_BTN_ACTIVE} cursor-pointer`
                  : 'bg-[#202228] border border-[#323640] text-[#6d7380] cursor-not-allowed'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isDirty ? 'Apply & Start New World...' : 'Current World Active'}</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
};

interface SliderRowProps {
  label: string;
  valueText: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  valueText,
  hint,
  min,
  max,
  step,
  value,
  onChange,
}) => (
  <div className="space-y-0.5">
    <div className="flex items-center justify-between text-[10px] font-mono">
      <span className="text-[#c4c9d4]">{label}</span>
      <span className="tabular-nums text-[#f4b054] font-semibold">{valueText}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 accent-[#e58926] cursor-pointer"
    />
    {hint && <div className="text-[9px] font-mono text-[#7c8494]">{hint}</div>}
  </div>
);

interface MiniSliderProps {
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
}

const MiniSlider: React.FC<MiniSliderProps> = ({
  label,
  valueText,
  min,
  max,
  step,
  value,
  onChange,
}) => (
  <div className="space-y-0.5">
    <div className="flex items-center justify-between text-[9px] font-mono">
      <span className="text-[#9aa0ac]">{label}</span>
      <span className="tabular-nums text-[#e6e8ec]">{valueText}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 accent-[#e58926] cursor-pointer"
    />
  </div>
);
