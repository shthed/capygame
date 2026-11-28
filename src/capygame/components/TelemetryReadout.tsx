import React, { useSyncExternalStore } from 'react';
import { ChevronDown, Rocket, Zap } from 'lucide-react';
import type { LiveModeTelemetry, PlayStyle } from '../types';

export const DEFAULT_LIVE_TELEMETRY: LiveModeTelemetry = {
  mode: 'sanctuary',
  primaryLabel: 'Dachshund Body',
  primaryValue: '2.3m (1)',
  secondaryLabel: 'Head Orange',
  secondaryValue: 'Tangerine',
  zoneCoordsLabel: 'Center (0, 0)',
};

export interface LiveTelemetryStore {
  getSnapshot: () => LiveModeTelemetry;
  subscribe: (listener: () => void) => () => void;
  publish: (next: LiveModeTelemetry) => void;
}

/**
 * Lightweight zero-dependency pub-sub store for 4-9 Hz `onTelemetryUpdate` snapshots.
 * Consumed via `useSyncExternalStore` inside `<TelemetryReadout />` so root `CapyGameView`
 * never re-renders on high-frequency telemetry ticks.
 */
export function createLiveTelemetryStore(
  initial: LiveModeTelemetry = DEFAULT_LIVE_TELEMETRY
): LiveTelemetryStore {
  let snapshot: LiveModeTelemetry = initial;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: (next: LiveModeTelemetry) => {
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
}

export function useLiveTelemetry(store: LiveTelemetryStore): LiveModeTelemetry {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export type TelemetryReadoutProps =
  | {
      variant: 'bar';
      store: LiveTelemetryStore;
      currentZoneTitle: string;
    }
  | {
      variant: 'combo';
      store: LiveTelemetryStore;
    }
  | {
      variant: 'abilities';
      store: LiveTelemetryStore;
      activeMode: PlayStyle;
      showTouchDpad: boolean;
      onTriggerGroundPound: () => void;
      onTriggerDash: () => void;
    }
  | {
      variant: 'ufo_prompt';
      store: LiveTelemetryStore;
      activeMode: PlayStyle;
      onBoardUfo: () => void;
      onLandUfo: () => void;
    };

export const TelemetryReadout: React.FC<TelemetryReadoutProps> = React.memo((props) => {
  const telemetry = useLiveTelemetry(props.store);

  if (props.variant === 'bar') {
    return (
      <span className="flex items-center gap-1.5 min-w-0 font-mono text-[10px] tabular-nums">
        <span className="font-sans font-semibold text-zinc-100 truncate">
          {props.currentZoneTitle}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-amber-300 truncate">{telemetry.primaryValue}</span>
        <span className="hidden md:inline text-sky-300 truncate">
          · {telemetry.secondaryValue}
        </span>
      </span>
    );
  }

  if (props.variant === 'combo') {
    const combo = telemetry.arcadeCombo;
    if (!combo?.active) return null;
    const pct = Math.max(
      0,
      Math.min(100, (combo.timeRemainingSec / Math.max(0.1, combo.maxWindowSec)) * 100)
    );
    return (
      <div
        data-testid="arcade-combo-hud"
        className={`fixed top-[calc(3rem+var(--sat))] right-[calc(0.625rem+var(--sar))] z-20 pointer-events-none px-3 py-2 rounded-xl bg-zinc-950/95 border shadow-xl tabular-nums min-w-[168px] ${
          combo.feverActive ? 'border-amber-400/75' : 'border-sky-400/45'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono font-bold text-amber-300">
            {combo.multiplier}x COMBO ({combo.count})
          </span>
          {combo.feverActive && (
            <span className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-400/45">
              FEVER
            </span>
          )}
        </div>
        <div className="text-[10px] font-medium text-zinc-200 truncate mt-0.5">
          {combo.lastActionLabel || 'Chain Active'}
        </div>
        <div className="mt-1.5 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            style={{ width: `${pct}%` }}
            className={`h-full transition-[width] duration-75 ${
              combo.feverActive ? 'bg-amber-400' : 'bg-sky-400'
            }`}
          />
        </div>
      </div>
    );
  }

  if (props.variant === 'ufo_prompt') {
    const bottomClass =
      props.activeMode === 'capytorio'
        ? 'bottom-[calc(136px+var(--sab))] sm:bottom-[calc(92px+var(--sab))]'
        : 'bottom-[calc(1rem+var(--sab))]';

    if (telemetry.ufoFlightPhase === 'air_flight') {
      const canLand = telemetry.ufoCanLandHere !== false;
      return (
        <div
          data-testid="ufo-air-flight-controls"
          className={`fixed left-1/2 -translate-x-1/2 ${bottomClass} z-20 pointer-events-auto flex flex-col items-center gap-1.5`}
        >
          <button
            type="button"
            data-testid="land-ufo-btn"
            onClick={props.onLandUfo}
            className={`min-h-11 px-4 py-2 rounded-xl border shadow-2xl flex items-center gap-2 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              canLand
                ? 'bg-zinc-950/95 hover:bg-zinc-900 border-emerald-400/75 text-emerald-100'
                : 'bg-zinc-950/95 border-amber-400/60 text-amber-200'
            }`}
          >
            <ChevronDown className={`w-4 h-4 shrink-0 ${canLand ? 'text-emerald-300' : 'text-amber-300'}`} />
            <span>{canLand ? 'Land UFO' : 'Fly Over Dry Land to Land'}</span>
            {canLand && (
              <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/45 text-[10px] font-mono text-emerald-200">
                E
              </span>
            )}
          </button>
          <span className="max-w-[calc(100vw-24px)] px-2.5 py-0.5 rounded-md bg-zinc-950/85 border border-white/10 text-[10px] font-mono text-zinc-300 pointer-events-none text-center truncate">
            <span className="sm:hidden">Tap Map to Fast-Travel · Pinch / +/- Zoom</span>
            <span className="hidden sm:inline">WASD / Tap Map to Fast-Travel · Shift Boost · Scroll Zoom</span>
          </span>
        </div>
      );
    }

    if (!telemetry.nearParkedUfo || telemetry.ufoFlightPhase !== 'parked_on_ground') {
      return null;
    }
    return (
      <div
        data-testid="parked-ufo-prompt"
        className={`fixed left-1/2 -translate-x-1/2 ${bottomClass} z-20 pointer-events-auto`}
      >
        <button
          type="button"
          data-testid="board-ufo-btn"
          onClick={props.onBoardUfo}
          className="min-h-11 px-4 py-2 rounded-xl bg-zinc-950/95 hover:bg-zinc-900 border border-cyan-400/70 text-cyan-100 shadow-2xl flex items-center gap-2 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
        >
          <Rocket className="w-4 h-4 text-cyan-300 shrink-0" />
          <span>Board UFO</span>
          <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/45 text-[10px] font-mono text-cyan-200">
            E
          </span>
        </button>
      </div>
    );
  }

  const dashCd = telemetry.dashCooldownFrac ?? 0;
  const dashReady = dashCd <= 0.02;
  const canDive = Boolean(telemetry.canDive);

  return (
    <div
      data-testid="surface-action-controls"
      className={`fixed bottom-3 hud-safe-bottom z-20 items-center gap-1.5 pointer-events-auto ${
        props.activeMode === 'capytorio' ? 'hidden' : 'flex'
      } ${props.showTouchDpad ? 'right-36' : 'right-3'}`}
    >
      <button
        type="button"
        data-testid="surface-dive-btn"
        onClick={props.onTriggerGroundPound}
        title="Airborne Belly-Flop Slam (Ctrl / C)"
        aria-label="Belly-Flop Dive"
        className={`min-h-12 min-w-12 px-2.5 rounded-xl border shadow-lg flex flex-col items-center justify-center text-[10px] font-mono cursor-pointer transition-colors ${
          canDive
            ? 'bg-amber-500/25 hover:bg-amber-500/35 border-amber-400/70 text-amber-100'
            : 'bg-zinc-950/90 border-white/12 text-zinc-400 hover:bg-zinc-900'
        }`}
      >
        <ChevronDown className="w-4 h-4 shrink-0" />
        <span>Dive</span>
      </button>

      <button
        type="button"
        data-testid="surface-dash-btn"
        onClick={props.onTriggerDash}
        title="Kinetic Dash Surge (Shift / Q)"
        aria-label="Kinetic Dash"
        className={`min-h-12 min-w-12 px-2.5 rounded-xl border shadow-lg flex flex-col items-center justify-center text-[10px] font-mono tabular-nums cursor-pointer transition-colors ${
          dashReady
            ? 'bg-sky-500/25 hover:bg-sky-500/35 border-sky-400/70 text-sky-100'
            : 'bg-zinc-950/90 border-white/12 text-zinc-400'
        }`}
      >
        <Zap className="w-3.5 h-3.5 shrink-0" />
        <span>{dashReady ? 'Dash' : `${Math.round((1 - dashCd) * 100)}%`}</span>
      </button>
    </div>
  );
});
