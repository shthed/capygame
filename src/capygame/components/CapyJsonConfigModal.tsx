import React from 'react';
import { Check, Code2, Copy, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  PROCEDURAL_CONFIG_PRESETS,
  ProceduralGameConfig,
} from '../config/ProceduralGameConfig';

export interface CapyJsonConfigModalProps {
  proceduralConfig: ProceduralGameConfig;
  jsonDraftText: string;
  jsonValidationError: string | null;
  jsonValidationWarnings: string[];
  jsonCopyLabel: string;
  onClose: () => void;
  onSelectPreset: (config: ProceduralGameConfig) => void;
  onRandomizeSeed: () => void;
  onFormatDraft: () => void;
  onCopyDraft: () => void;
  onResetDefault: () => void;
  onDraftChange: (value: string) => void;
  onApplyConfig: (regenerateWorld: boolean) => void;
}

export const CapyJsonConfigModal: React.FC<CapyJsonConfigModalProps> = ({
  proceduralConfig,
  jsonDraftText,
  jsonValidationError,
  jsonValidationWarnings,
  jsonCopyLabel,
  onClose,
  onSelectPreset,
  onRandomizeSeed,
  onFormatDraft,
  onCopyDraft,
  onResetDefault,
  onDraftChange,
  onApplyConfig,
}) => {
  return (
    <div
      data-testid="json-config-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-zinc-950/90"
    >
      <div className="relative w-full max-w-3xl bg-zinc-900 rounded-xl shadow-2xl border border-cyan-400/25 overflow-hidden text-zinc-100 flex flex-col max-h-[92vh]">
        <div className="bg-zinc-950 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Code2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-wider uppercase truncate">
                Procedural World &amp; Gameplay JSON Engine
              </h2>
              <p className="text-[11px] font-mono text-zinc-400 truncate">
                Active: {proceduralConfig.meta.configName} · Seed #{proceduralConfig.meta.seed} · Stored locally
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-json-editor-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer shrink-0"
            aria-label="Close JSON Editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 sm:p-4 space-y-2.5 overflow-y-auto flex-1">
          {/* 5 Built-in Procedural Presets */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Instant Procedural Archetypes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
              {PROCEDURAL_CONFIG_PRESETS.map((preset) => {
                const isSelected = proceduralConfig.meta.configName === preset.config.meta.configName;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`json-preset-${preset.id}`}
                    title={preset.subtitle}
                    onClick={() => onSelectPreset(preset.config)}
                    className={`p-2 rounded-lg text-left border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-zinc-100'
                        : 'bg-zinc-950/90 hover:bg-zinc-800 border-white/10 text-zinc-300'
                    }`}
                  >
                    <div className="text-[11px] font-semibold truncate">{preset.label}</div>
                    <div className="text-[9px] font-mono text-zinc-400 truncate mt-0.5">
                      Seed #{preset.config.meta.seed}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Utilities */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="json-randomize-seed-btn"
                onClick={onRandomizeSeed}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-amber-400/30 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Randomize Seed</span>
              </button>
              <button
                type="button"
                data-testid="json-format-btn"
                onClick={onFormatDraft}
                className="px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer"
              >
                Format JSON
              </button>
              <button
                type="button"
                data-testid="json-copy-btn"
                onClick={onCopyDraft}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{jsonCopyLabel}</span>
              </button>
            </div>

            <button
              type="button"
              data-testid="json-reset-default-btn"
              onClick={onResetDefault}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-950 hover:bg-rose-950/60 text-rose-300 border border-rose-500/30 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Default</span>
            </button>
          </div>

          {/* Validation Status Banner */}
          {jsonValidationError ? (
            <div
              data-testid="json-validation-error"
              className="px-3 py-2 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-mono"
            >
              {jsonValidationError}
            </div>
          ) : jsonValidationWarnings.length > 0 ? (
            <div
              data-testid="json-validation-warnings"
              className="px-3 py-2 rounded-lg bg-amber-950/70 border border-amber-400/40 text-amber-200 text-[11px] font-mono"
            >
              Sanitized: {jsonValidationWarnings.slice(0, 3).join(' · ')}
              {jsonValidationWarnings.length > 3 ? ` (+${jsonValidationWarnings.length - 3} more)` : ''}
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-400/30 text-emerald-300 text-[11px] font-mono flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Schema Valid · Ready to hot-reload live or regenerate world seed</span>
            </div>
          )}

          {/* Live Editable JSON Textarea */}
          <textarea
            data-testid="json-config-textarea"
            value={jsonDraftText}
            onChange={(e) => onDraftChange(e.target.value)}
            spellCheck={false}
            aria-label="Procedural Game Configuration JSON"
            className="w-full h-72 sm:h-80 p-3 rounded-lg bg-zinc-950 border border-white/15 focus:border-cyan-400/60 focus:outline-none text-[11px] font-mono leading-relaxed text-cyan-100 resize-y"
          />
        </div>

        <div className="bg-zinc-950 px-4 py-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-[10px] font-mono text-zinc-500">
            Controls universe physics, biomes, vessel colors, gravity, weather &amp; all 5 districts
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="json-apply-live-btn"
              disabled={Boolean(jsonValidationError)}
              onClick={() => onApplyConfig(false)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 text-xs font-medium border border-white/15 cursor-pointer"
            >
              Apply Live
            </button>
            <button
              type="button"
              data-testid="json-apply-regen-btn"
              disabled={Boolean(jsonValidationError)}
              onClick={() => onApplyConfig(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply &amp; Regenerate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
