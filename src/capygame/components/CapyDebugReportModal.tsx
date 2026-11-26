import React from 'react';
import { Activity, Check, Copy, X } from 'lucide-react';
import type { GpuEngineTelemetry, PerformanceLogSnapshot } from '../types';

export interface CapyDebugReportModalProps {
  debugReportMode: 'summary' | 'analysis' | 'detail';
  debugReportText: string;
  selectedSnippet: string;
  isReportCopied: boolean;
  perfLog: PerformanceLogSnapshot;
  gpuTelemetry: GpuEngineTelemetry;
  onClose: () => void;
  onCopyDebugReport: (snippet?: string) => void;
  onToggleDebugReportMode: (mode: 'summary' | 'analysis' | 'detail') => void;
  onSelectSnippet: (snippet: string) => void;
}

export const CapyDebugReportModal: React.FC<CapyDebugReportModalProps> = ({
  debugReportMode,
  debugReportText,
  selectedSnippet,
  isReportCopied,
  perfLog,
  gpuTelemetry,
  onClose,
  onCopyDebugReport,
  onToggleDebugReportMode,
  onSelectSnippet,
}) => {
  return (
    <div
      data-testid="perf-debug-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs pointer-events-auto"
    >
      <div className="w-full max-w-2xl max-h-[85vh] bg-zinc-950 border border-cyan-400/35 rounded-2xl p-3.5 sm:p-4 text-zinc-100 shadow-2xl flex flex-col space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-mono font-bold text-zinc-100 truncate">
              FRAME DROP DEBUG LOG & TELEMETRY
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {selectedSnippet ? (
              <button
                type="button"
                data-testid="copy-selected-snippet-btn"
                onClick={() => onCopyDebugReport(selectedSnippet)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-[11px] font-mono font-semibold flex items-center gap-1.5 cursor-pointer shadow transition-colors"
              >
                {isReportCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span className="text-emerald-200">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Selected ({selectedSnippet.length} ch)</span>
                  </>
                )}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="copy-debug-report-btn"
              onClick={() => onCopyDebugReport()}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-200 text-[11px] font-mono font-semibold flex items-center gap-1.5 cursor-pointer shadow transition-colors"
            >
              {isReportCopied && !selectedSnippet ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-200">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {selectedSnippet
                      ? 'Copy All'
                      : debugReportMode === 'summary'
                        ? 'Copy Summary'
                        : debugReportMode === 'analysis'
                          ? 'Copy Analysis'
                          : 'Copy Full Detail'}
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              data-testid="close-debug-modal-btn"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              aria-label="Close Debug Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Selector and Quick Stats Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
          {/* Mode Toggle Pills */}
          <div
            data-testid="perf-report-mode-toggle"
            className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-white/10"
          >
            <button
              type="button"
              data-testid="perf-mode-summary-btn"
              onClick={() => onToggleDebugReportMode('summary')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                debugReportMode === 'summary'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Summary (~120 tokens · Chat)
            </button>
            <button
              type="button"
              data-testid="perf-mode-analysis-btn"
              onClick={() => onToggleDebugReportMode('analysis')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                debugReportMode === 'analysis'
                  ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/50 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              CPU/GPU Profiler (Analysis)
            </button>
            <button
              type="button"
              data-testid="perf-mode-detail-btn"
              onClick={() => onToggleDebugReportMode('detail')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                debugReportMode === 'detail'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Full Detail (Deep Telemetry)
            </button>
          </div>

          {/* Quick telemetry metrics */}
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-emerald-300">
              Live: {perfLog.liveFps} FPS
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-rose-300">
              Drops: {perfLog.droppedFramesCount}
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-sky-300 truncate">
              {gpuTelemetry.backendLabel}
            </span>
          </div>
        </div>

        {/* Selection Guidance / Helper Bar */}
        <div className="flex items-center justify-between text-[9.5px] font-mono text-zinc-400 bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-white/5">
          <span className="truncate">
            {selectedSnippet
              ? `Selected ${selectedSnippet.split('\n').length} line(s) (${selectedSnippet.length} chars). Click "Copy Selected" or right-click to copy.`
              : 'Select any specific line or text with your cursor, or use Summary mode for minimal tokens.'}
          </span>
          <button
            type="button"
            data-testid="select-all-log-btn"
            onClick={() => {
              const pre = document.querySelector('[data-testid="perf-debug-log-text"]');
              if (pre) {
                const range = document.createRange();
                range.selectNodeContents(pre);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                onSelectSnippet(pre.textContent || '');
              }
            }}
            className="text-[9px] text-cyan-400 hover:underline cursor-pointer ml-2 shrink-0"
          >
            Select All
          </button>
        </div>

        {/* Scrollable diagnostic text area */}
        <div
          className="flex-1 min-h-0 overflow-y-auto bg-black/90 rounded-xl p-3 border border-white/10"
          onMouseUp={() => {
            const sel = window.getSelection()?.toString() || '';
            onSelectSnippet(sel.trim());
          }}
          onTouchEnd={() => {
            const sel = window.getSelection()?.toString() || '';
            onSelectSnippet(sel.trim());
          }}
          onKeyUp={() => {
            const sel = window.getSelection()?.toString() || '';
            onSelectSnippet(sel.trim());
          }}
        >
          <pre
            data-testid="perf-debug-log-text"
            className="font-mono text-[10.5px] leading-relaxed text-zinc-300 whitespace-pre font-normal select-text cursor-text selection:bg-cyan-500/40 selection:text-white"
          >
            {debugReportText}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1 border-t border-white/10">
          <span className="truncate">
            {debugReportMode === 'summary'
              ? 'Ultra-compact grouped log (~110-140 tokens) ready to paste into chat.'
              : 'Full GPU buffer, shadow cascades & engine memory specs.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/15 cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
