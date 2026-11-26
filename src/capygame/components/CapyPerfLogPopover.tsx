import React from 'react';
import { Activity, AlertTriangle, Copy, Trash2, X } from 'lucide-react';
import type { GpuEngineTelemetry, PerformanceLogSnapshot } from '../types';

export interface CapyPerfLogPopoverProps {
  perfLog: PerformanceLogSnapshot;
  gpuTelemetry: GpuEngineTelemetry;
  onClose: () => void;
  onToggleLock60: () => void;
  onOpenDebugReport: (mode: 'summary' | 'analysis') => void;
  onClearLog: () => void;
  onCopyIncident: (text: string) => void;
}

export const CapyPerfLogPopover: React.FC<CapyPerfLogPopoverProps> = ({
  perfLog,
  gpuTelemetry,
  onClose,
  onToggleLock60,
  onOpenDebugReport,
  onClearLog,
  onCopyIncident,
}) => (
  <div
    data-testid="performance-log-popover"
    className="fixed top-11 right-2 z-40 pointer-events-auto w-[calc(100vw-16px)] max-w-[356px] bg-zinc-950/96 border border-white/15 rounded-xl p-3 text-zinc-100 shadow-2xl space-y-2.5"
  >
    <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-300">
          <Activity className="w-3 h-3 shrink-0" />
          <span>PERFORMANCE &amp; FPS GOVERNOR</span>
        </div>
        <p className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
          {gpuTelemetry.backendLabel}
        </p>
      </div>
      <button
        type="button"
        data-testid="close-perf-log-btn"
        onClick={onClose}
        className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 cursor-pointer shrink-0"
        aria-label="Close Performance Log"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>

    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono tabular-nums bg-zinc-900/90 p-2 rounded-lg border border-white/8">
      <div>
        <span className="text-zinc-500 block">LIVE / AVG</span>
        <span className="text-emerald-300 font-semibold">
          {perfLog.liveFps} / {perfLog.avgFps} FPS
        </span>
      </div>
      <div>
        <span className="text-zinc-500 block">MIN / CAP</span>
        <span
          className={
            perfLog.minFps < perfLog.fpsTarget * 0.9
              ? 'text-amber-300 font-semibold'
              : 'text-zinc-200'
          }
        >
          {perfLog.minFps} / {perfLog.maxFpsLimit > 0 ? perfLog.maxFpsLimit : 'Unlim'}
        </span>
      </div>
      <div>
        <span className="text-zinc-500 block">AVG / P95</span>
        <span className="text-sky-300">
          {perfLog.avgFrameMs} / {perfLog.p95FrameMs}ms
        </span>
      </div>
      <div>
        <span className="text-zinc-500 block">MAX SPIKE</span>
        <span
          className={
            perfLog.maxFrameMs > (1000 / Math.max(24, perfLog.fpsTarget)) * 1.25
              ? 'text-rose-300'
              : 'text-zinc-200'
          }
        >
          {perfLog.maxFrameMs} ms
        </span>
      </div>
      <div>
        <span className="text-zinc-500 block">DROPS</span>
        <span
          data-testid="perf-dropped-count"
          className={
            perfLog.droppedFramesCount > 0 ? 'text-amber-300 font-semibold' : 'text-emerald-300'
          }
        >
          {perfLog.droppedFramesCount}
        </span>
      </div>
      <div>
        <span className="text-zinc-500 block">SHADOW / DPR</span>
        <span className="text-amber-200 uppercase">
          {gpuTelemetry.shadowCasterMode} · {gpuTelemetry.effectivePixelRatio}x
        </span>
      </div>
    </div>

    {perfLog.disabledFeatures.length > 0 && (
      <div className="px-2 py-1 rounded-lg bg-amber-950/50 border border-amber-400/35 text-amber-200 text-[10px] font-mono">
        Auto-Opt Tier {perfLog.activeGovernorTier} ({perfLog.fpsTarget} FPS target):{' '}
        {perfLog.disabledFeatures.join(' · ')}
      </div>
    )}

    <div className="flex items-center justify-between gap-1.5">
      <button
        type="button"
        data-testid="perf-toggle-lock60-btn"
        onClick={onToggleLock60}
        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold border cursor-pointer ${
          perfLog.lock60FpsEnabled
            ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-200'
            : 'bg-zinc-900 border-white/10 text-zinc-400'
        }`}
      >
        Auto Opt ({perfLog.fpsTarget}): {perfLog.lock60FpsEnabled ? 'ON' : 'OFF'}
      </button>
      <button
        type="button"
        data-testid="perf-copy-debug-btn"
        onClick={() => onOpenDebugReport('summary')}
        className="py-1.5 px-2.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-200 border border-cyan-400/40 text-[10px] font-mono flex items-center gap-1 cursor-pointer shrink-0"
        title="View and Copy Full Diagnostic Debug Log"
      >
        <Copy className="w-3 h-3" />
        <span>Debug Log</span>
      </button>
      <button
        type="button"
        data-testid="perf-analysis-btn"
        onClick={() => onOpenDebugReport('analysis')}
        className="py-1.5 px-2.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-200 border border-indigo-400/40 text-[10px] font-mono flex items-center gap-1 cursor-pointer shrink-0"
        title="View Detailed CPU & GPU Subsystem Profiler Analysis"
      >
        <Activity className="w-3 h-3" />
        <span>Analysis</span>
      </button>
      <button
        type="button"
        data-testid="perf-clear-log-btn"
        onClick={onClearLog}
        className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-[10px] font-mono flex items-center gap-1 cursor-pointer shrink-0"
      >
        <Trash2 className="w-3 h-3" />
        <span>Clear</span>
      </button>
    </div>

    <div
      data-testid="perf-log-entries"
      className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5"
    >
      {perfLog.entries.length === 0 ? (
        <div className="p-2.5 rounded-lg bg-emerald-950/35 border border-emerald-500/25 text-emerald-200 text-[11px] font-mono">
          Steady {perfLog.fpsTarget} FPS target — Zero frame drops logged.
        </div>
      ) : (
        perfLog.entries.map((entry) => {
          const isGrouped = (entry.repeatCount ?? 1) > 1;
          const fpsLabel =
            entry.minFps !== undefined &&
            entry.maxFps !== undefined &&
            entry.minFps !== entry.maxFps
              ? `${entry.minFps}-${entry.maxFps} FPS`
              : `${entry.fps} FPS`;
          const timeLabel =
            entry.lastElapsedLabel && entry.lastElapsedLabel !== entry.elapsedLabel
              ? `T+${entry.elapsedLabel}-${entry.lastElapsedLabel}`
              : `T+${entry.elapsedLabel}`;
          const incidentLine = `[${timeLabel}] ${fpsLabel} (${
            entry.maxFrameMs ? entry.maxFrameMs.toFixed(1) : entry.frameMs
          }ms)${isGrouped ? ` (x${entry.repeatCount})` : ''} · ${entry.stageLabel} · ${
            entry.cause
          } → ${entry.mitigation}`;

          return (
            <div
              key={entry.id}
              data-testid="perf-log-entry-row"
              className={`p-2 rounded-lg border text-[10px] font-mono space-y-0.5 group transition-colors ${
                entry.severity === 'critical'
                  ? 'bg-rose-950/55 border-rose-500/40 text-rose-100'
                  : 'bg-amber-950/45 border-amber-400/35 text-amber-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold flex items-center gap-1 min-w-0">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {timeLabel} · {fpsLabel} ({entry.frameMs}ms)
                    {isGrouped && (
                      <span className="ml-1 px-1 py-0.2 bg-white/15 text-[9px] rounded font-bold">
                        x{entry.repeatCount}
                      </span>
                    )}
                  </span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] opacity-80 truncate">{entry.stageLabel}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyIncident(incidentLine);
                    }}
                    className="p-1 rounded bg-black/40 hover:bg-black/70 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Copy this incident to clipboard"
                    aria-label="Copy incident entry"
                  >
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
              <div className="text-[9px] opacity-85 truncate">
                {entry.cause} → {entry.mitigation}
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
);
