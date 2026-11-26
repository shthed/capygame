import React, { useRef } from 'react';
import {
  Code2,
  Copy,
  Download,
  HelpCircle,
  Moon,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import {
  CapyGameSettings,
  CapyLodTier,
  CapySnakeTelemetry,
  GPU_VISUAL_FILTER_PROFILES,
  GpuAntiAliasingMode,
  GpuEngineTelemetry,
  GpuQualityPreset,
  GpuShadowQualityMode,
  GpuTextureFilterMode,
  GpuToneMappingMode,
  GpuVisualFilterPreset,
  PerformanceLogSnapshot,
  WeatherType,
} from '../types';
import { getPresetPatchForGpuQuality } from '../engine/gpu/GpuEngineTypes';
import type { ProceduralGameConfig } from '../config/ProceduralGameConfig';
import { AudioService } from '../services/AudioService';
import { PwaService } from '../../services/PwaService';

export interface CapySettingsModalProps {
  isAdvancedMode: boolean;
  gameSettings: CapyGameSettings;
  isMuted: boolean;
  snakeTelemetry: CapySnakeTelemetry;
  perfLog: PerformanceLogSnapshot;
  gpuTelemetry: GpuEngineTelemetry;
  pwaStatus: {
    installable: boolean;
    updateAvailable: boolean;
    standalone: boolean;
  };
  proceduralConfig: ProceduralGameConfig;
  isSaveJsonPasteOpen: boolean;
  saveJsonDraft: string;
  savePortabilityFeedback: { tone: 'ok' | 'error'; message: string } | null;
  onClose: () => void;
  onUpdateGameSettings: (patch: Partial<CapyGameSettings>) => void;
  onSwitchToBasicMode: () => void;
  onToggleMute: () => void;
  onSetCapytorioCameraMode: (mode: 'oblique' | 'chase') => void;
  onSetCapytorioBeltEndSpill: (enabled: boolean) => void;
  onReturnToCapytorioBeacon: () => void;
  onLockMouselook: () => void;
  onToggleFpsButton: (next: boolean) => void;
  onUnlockAllFeatures: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
  onOpenJsonEditor: () => void;
  onResetProgress: () => void;
  onExportSaveBundleFile: () => void;
  onCopySaveBundleJson: () => void;
  onImportSaveFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleSaveJsonPasteOpen: () => void;
  onChangeSaveJsonDraft: (val: string) => void;
  onApplyImportedSaveBundle: (raw: string) => void;
}

export const CapySettingsModal: React.FC<CapySettingsModalProps> = ({
  isAdvancedMode,
  gameSettings,
  isMuted,
  snakeTelemetry,
  perfLog,
  gpuTelemetry,
  pwaStatus,
  proceduralConfig,
  isSaveJsonPasteOpen,
  saveJsonDraft,
  savePortabilityFeedback,
  onClose,
  onUpdateGameSettings,
  onSwitchToBasicMode,
  onToggleMute,
  onSetCapytorioCameraMode,
  onSetCapytorioBeltEndSpill,
  onReturnToCapytorioBeacon,
  onLockMouselook,
  onToggleFpsButton,
  onUnlockAllFeatures,
  onOpenAbout,
  onOpenPrivacy,
  onOpenJsonEditor,
  onResetProgress,
  onExportSaveBundleFile,
  onCopySaveBundleJson,
  onImportSaveFileChange,
  onToggleSaveJsonPasteOpen,
  onChangeSaveJsonDraft,
  onApplyImportedSaveBundle,
}) => {
  const saveImportFileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      data-testid="capygame-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-zinc-950/85"
    >
      <div className="relative w-full max-w-lg bg-zinc-900 rounded-xl shadow-2xl border border-white/15 overflow-hidden text-zinc-100">
        <div className="bg-zinc-950 px-4 sm:px-5 py-3 sm:py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="w-4 h-4 text-sky-400" />
            <div>
              <h2 className="text-sm font-semibold tracking-wider uppercase">
                {isAdvancedMode ? 'Simulation Settings' : 'Game Settings'}
              </h2>
              <p className="text-[11px] font-mono text-zinc-400">
                {isAdvancedMode
                  ? 'Camera kinematics, GPU pipeline & save backups'
                  : 'Simple controls for sound, weather, time & mode'}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-settings-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer"
            aria-label="Close Settings Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-3.5 max-h-[84vh] overflow-y-auto">
          {/* Prominent Basic Mode vs Advanced Mode Switcher */}
          <div
            data-testid="settings-mode-panel"
            className="p-3 rounded-lg bg-zinc-950/90 border border-sky-400/35 space-y-2"
          >
            <div>
              <div className="text-xs font-semibold text-zinc-100">Interface Complexity</div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Start simple in Basic Mode, or turn on Advanced Mode for full science dials, FPS
                stats, and JSON tools.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="settings-mode-basic-btn"
                onClick={onSwitchToBasicMode}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  !isAdvancedMode
                    ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-400'
                }`}
              >
                Basic Mode
              </button>
              <button
                type="button"
                data-testid="settings-mode-advanced-btn"
                onClick={() => onUpdateGameSettings({ advancedMode: true })}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  isAdvancedMode
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-400'
                }`}
              >
                Advanced Mode
              </button>
            </div>
          </div>

          {!isAdvancedMode ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">Sound Effects</div>
                  <div className="text-[11px] text-zinc-400">Music and fun game sounds</div>
                </div>
                <button
                  type="button"
                  data-testid="settings-basic-mute-btn"
                  onClick={onToggleMute}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    !isMuted
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/45'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  {!isMuted ? 'Sound ON' : 'Muted'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Camera Follows Capybara
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Keep the camera behind your Capybara as you explore
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settings-toggle-chase-cam"
                  onClick={() =>
                    onUpdateGameSettings({
                      cameraFollowBehind: !gameSettings.cameraFollowBehind,
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 border ${
                    gameSettings.cameraFollowBehind
                      ? 'bg-sky-500/20 text-sky-200 border-sky-400/45'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  {gameSettings.cameraFollowBehind ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">Capytorio Camera View</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Top-down Oblique (Factorio style) or 3D Chase behind your Capybara
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settings-capytorio-camera-mode"
                  onClick={() => {
                    const nextCam =
                      gameSettings.capytorioCameraMode === 'chase' ? 'oblique' : 'chase';
                    onSetCapytorioCameraMode(nextCam);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 border ${
                    gameSettings.capytorioCameraMode !== 'chase'
                      ? 'bg-sky-500/20 text-sky-200 border-sky-400/45'
                      : 'bg-zinc-900 text-zinc-300 border-white/10'
                  }`}
                >
                  {gameSettings.capytorioCameraMode === 'chase' ? '3D Chase' : 'Oblique'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">Belt End Item Spill</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Allow items to tumble off unconnected belt ends onto the meadow (off by default)
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settings-capytorio-belt-spill"
                  onClick={() => onSetCapytorioBeltEndSpill(!gameSettings.capytorioBeltEndSpill)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 border ${
                    gameSettings.capytorioBeltEndSpill
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/45'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  {gameSettings.capytorioBeltEndSpill ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Survey Beacon Home ([H])
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Warp camera and Capybara back to factory origin (0, 0)
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settings-capytorio-beacon-btn"
                  onClick={onReturnToCapytorioBeacon}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 border bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/12"
                >
                  Return Home
                </button>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">Time of Day</span>
                  <span className="text-[11px] text-amber-300 font-medium">
                    {gameSettings.dayNightAutoCycle
                      ? 'Auto Day/Night'
                      : snakeTelemetry.dayPhaseLabel}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateGameSettings({ dayNightAutoCycle: true })}
                    className={`px-1.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer border ${
                      gameSettings.dayNightAutoCycle
                        ? 'bg-amber-500/20 text-amber-200 border-amber-400/45'
                        : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                    }`}
                  >
                    Auto
                  </button>
                  {(
                    [
                      { id: 'dawn', label: 'Morning', hour: 6.2 },
                      { id: 'noon', label: 'Noon', hour: 12.0 },
                      { id: 'dusk', label: 'Sunset', hour: 18.2 },
                      { id: 'night', label: 'Night', hour: 23.0 },
                    ] as const
                  ).map((phase) => (
                    <button
                      key={phase.id}
                      type="button"
                      data-testid={`settings-phase-${phase.id}`}
                      onClick={() =>
                        onUpdateGameSettings({
                          dayNightAutoCycle: false,
                          timeOfDayHours: phase.hour,
                        })
                      }
                      className={`px-1.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer border ${
                        !gameSettings.dayNightAutoCycle &&
                        Math.abs((gameSettings.timeOfDayHours ?? 9.5) - phase.hour) < 0.8
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400/45'
                          : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                      }`}
                    >
                      {phase.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">Weather</span>
                  <span className="text-[11px] text-sky-300 font-medium">
                    {snakeTelemetry.weatherLabel}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: 'auto', label: 'Auto' },
                      { id: 'clear', label: 'Sunny' },
                      { id: 'rain', label: 'Rainy' },
                      { id: 'storm', label: 'Storm' },
                      { id: 'snow', label: 'Snowy' },
                    ] as Array<{ id: 'auto' | WeatherType; label: string }>
                  ).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      data-testid={`settings-weather-${w.id}`}
                      onClick={() => onUpdateGameSettings({ weatherMode: w.id })}
                      className={`px-1.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer border ${
                        gameSettings.weatherMode === w.id
                          ? 'bg-sky-500/20 text-sky-200 border-sky-400/45'
                          : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">On-Screen Arrows</div>
                  <div className="text-[11px] text-zinc-400">Touch buttons on phones</div>
                </div>
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'auto', label: 'Auto' },
                      { id: 'always', label: 'Show' },
                      { id: 'hidden', label: 'Hide' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onUpdateGameSettings({ touchControlsMode: mode.id })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer border ${
                        gameSettings.touchControlsMode === mode.id
                          ? 'bg-sky-500/20 text-sky-200 border-sky-400/45'
                          : 'bg-zinc-900 text-zinc-400 border-white/10'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onUnlockAllFeatures}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-white/10 cursor-pointer"
                  >
                    Unlock Everything
                  </button>
                  <button
                    type="button"
                    data-testid="settings-open-about-btn"
                    onClick={() => {
                      AudioService.playCoin();
                      onOpenAbout();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                    <span>About &amp; Tutorials</span>
                  </button>
                  <button
                    type="button"
                    data-testid="open-privacy-policy-btn"
                    onClick={() => {
                      AudioService.playCoin();
                      onOpenPrivacy();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Privacy Policy</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onResetProgress}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-500/30 cursor-pointer"
                >
                  Start Over
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">Tracking Chase Camera</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Aligns camera azimuth behind the active unit during surface traversal
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settings-toggle-chase-cam"
                  onClick={() =>
                    onUpdateGameSettings({
                      cameraFollowBehind: !gameSettings.cameraFollowBehind,
                    })
                  }
                  className={`px-3 py-1 rounded text-xs font-mono cursor-pointer shrink-0 border ${
                    gameSettings.cameraFollowBehind
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  {gameSettings.cameraFollowBehind ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Capytorio Camera Perspective ([V])
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Oblique locks a Factorio-style overhead view with cardinal WASD; Chase uses
                    third-person orbit
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settings-capytorio-camera-mode"
                  onClick={() => {
                    const nextCam =
                      gameSettings.capytorioCameraMode === 'chase' ? 'oblique' : 'chase';
                    onSetCapytorioCameraMode(nextCam);
                  }}
                  className={`px-3 py-1 rounded text-xs font-mono cursor-pointer shrink-0 border ${
                    gameSettings.capytorioCameraMode !== 'chase'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                      : 'bg-zinc-900 text-zinc-300 border-white/10'
                  }`}
                >
                  {gameSettings.capytorioCameraMode === 'chase' ? '3D Chase' : 'Oblique'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">Belt End Item Spill</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    When enabled, backed-up items tip and tumble off open belt ends onto the ground
                    (default OFF)
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settings-capytorio-belt-spill"
                  onClick={() => onSetCapytorioBeltEndSpill(!gameSettings.capytorioBeltEndSpill)}
                  className={`px-3 py-1 rounded text-xs font-mono cursor-pointer shrink-0 border ${
                    gameSettings.capytorioBeltEndSpill
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/45'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  {gameSettings.capytorioBeltEndSpill ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Survey Beacon Home ([H])
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Return camera and Capybara to factory origin (0, 0)
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settings-capytorio-beacon-btn"
                  onClick={onReturnToCapytorioBeacon}
                  className="px-3 py-1 rounded text-xs font-mono cursor-pointer shrink-0 border bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/12"
                >
                  Return Home
                </button>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-100">
                      Mouselook Camera (Drag or M)
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Drag left/right mouse anywhere to orbit, or press M for free mouselook
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {gameSettings.mouselookEnabled !== false && (
                      <button
                        type="button"
                        data-testid="settings-lock-mouselook-btn"
                        onClick={onLockMouselook}
                        className="px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-sky-400/35 cursor-pointer"
                      >
                        Lock (M)
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="settings-toggle-mouselook"
                      onClick={() =>
                        onUpdateGameSettings({
                          mouselookEnabled: gameSettings.mouselookEnabled === false,
                        })
                      }
                      className={`px-3 py-1 rounded text-xs font-mono cursor-pointer border ${
                        gameSettings.mouselookEnabled !== false
                          ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                          : 'bg-zinc-900 text-zinc-400 border-white/10'
                      }`}
                    >
                      {gameSettings.mouselookEnabled !== false ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {gameSettings.mouselookEnabled !== false && (
                  <div className="pt-2 border-t border-white/8 space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-zinc-300">
                          Mouselook Sensitivity
                        </span>
                        <span className="text-[11px] font-mono text-sky-400 tabular-nums">
                          {(gameSettings.mouselookSensitivity ?? 1.0).toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        data-testid="settings-mouselook-sensitivity"
                        min={0.2}
                        max={2.5}
                        step={0.05}
                        value={gameSettings.mouselookSensitivity ?? 1.0}
                        onChange={(e) =>
                          onUpdateGameSettings({
                            mouselookSensitivity: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-sky-400 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium text-zinc-300">
                        Invert Mouse Y-Axis
                      </span>
                      <button
                        type="button"
                        data-testid="settings-toggle-invert-mouse-y"
                        onClick={() =>
                          onUpdateGameSettings({
                            invertMouseY: !gameSettings.invertMouseY,
                          })
                        }
                        className={`px-2.5 py-0.5 rounded text-[11px] font-mono cursor-pointer border ${
                          gameSettings.invertMouseY
                            ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                            : 'bg-zinc-900 text-zinc-400 border-white/10'
                        }`}
                      >
                        {gameSettings.invertMouseY ? 'INVERTED' : 'STANDARD'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div
                data-testid="settings-fps-governor-panel"
                className="p-3 rounded-lg bg-zinc-950/90 border border-emerald-400/25 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100">
                      Frame Rate Limit &amp; Adaptive FPS Target
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Cap FPS to save GPU power, or auto-cut heavy FX to hit target FPS
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/35 shrink-0 tabular-nums">
                    {perfLog.liveFps} FPS
                  </span>
                </div>

                {/* Corner FPS Button Visibility Toggle */}
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-white/8">
                  <div className="min-w-0">
                    <span className="text-[11px] text-zinc-300 font-medium block">
                      Top-Right FPS Button
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Show or hide the live FPS button in the corner
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-toggle-fps-btn"
                    onClick={() => onToggleFpsButton(!(gameSettings.showFpsButton !== false))}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold cursor-pointer shrink-0 border ${
                      gameSettings.showFpsButton !== false
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/45'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    {gameSettings.showFpsButton !== false ? 'SHOWN' : 'HIDDEN'}
                  </button>
                </div>

                {/* Maximum Frame Rate Limit */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">Max FPS Limit (Power Saver)</span>
                    <span className="font-mono text-sky-300 tabular-nums">
                      {(gameSettings.maxFpsLimit ?? 60) > 0
                        ? `${gameSettings.maxFpsLimit} FPS Cap`
                        : 'Unlimited (VSync)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {([0, 30, 45, 60, 90, 120, 144] as const).map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        data-testid={`settings-max-fps-${cap}`}
                        onClick={() => onUpdateGameSettings({ maxFpsLimit: cap })}
                        className={`px-1 py-1 rounded text-[10px] font-mono cursor-pointer border text-center ${
                          (gameSettings.maxFpsLimit ?? 60) === cap
                            ? 'bg-sky-500/20 text-sky-200 border-sky-400/45'
                            : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {cap === 0 ? 'Unlim' : cap}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FPS Target & Auto GPU Feature Reducer */}
                <div className="space-y-1.5 pt-1 border-t border-white/8">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[11px] text-zinc-300 font-medium block">
                        FPS Target (Auto Disable GPU FX)
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Effective: {perfLog.fpsTarget} FPS
                        {(gameSettings.maxFpsLimit ?? 60) > 0 &&
                          (gameSettings.fpsTarget ?? 60) > (gameSettings.maxFpsLimit ?? 60) &&
                          ` (capped by ${gameSettings.maxFpsLimit})`}
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid="settings-toggle-fps-optimizer"
                      onClick={() =>
                        onUpdateGameSettings({
                          lock60FpsGovernor: !(gameSettings.lock60FpsGovernor !== false),
                        })
                      }
                      className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold cursor-pointer shrink-0 border ${
                        gameSettings.lock60FpsGovernor !== false
                          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/45'
                          : 'bg-zinc-900 text-zinc-400 border-white/10'
                      }`}
                    >
                      {gameSettings.lock60FpsGovernor !== false ? 'AUTO OPT ON' : 'MANUAL'}
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {([30, 45, 60, 90, 120] as const).map((target) => (
                      <button
                        key={target}
                        type="button"
                        data-testid={`settings-fps-target-${target}`}
                        onClick={() =>
                          onUpdateGameSettings({
                            fpsTarget: target,
                            lock60FpsGovernor: true,
                          })
                        }
                        className={`px-1.5 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                          (gameSettings.fpsTarget ?? 60) === target
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/45'
                            : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {target} FPS
                      </button>
                    ))}
                  </div>
                  {gameSettings.lock60FpsGovernor !== false && (
                    <div className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded border border-white/8">
                      {perfLog.disabledFeatures.length > 0 ? (
                        <span className="text-amber-300">
                          Tier {perfLog.activeGovernorTier} Cuts:{' '}
                          {perfLog.disabledFeatures.join(' · ')}
                        </span>
                      ) : (
                        <span className="text-emerald-300">
                          Holding {perfLog.fpsTarget} FPS · All requested GPU FX active
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div
                data-testid="settings-gpu-engine-panel"
                className="p-3 rounded-lg bg-zinc-950/90 border border-sky-400/20 space-y-3"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100">
                      3D Hardware GPU Engine, Lighting &amp; Filters
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums truncate">
                      {gpuTelemetry.backendLabel} · DPR {gpuTelemetry.effectivePixelRatio}x ·
                      Shadow {gpuTelemetry.shadowMapSize || 'OFF'} (
                      {gpuTelemetry.shadowCasterMode.toUpperCase()})
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-toggle-postfx"
                    onClick={() =>
                      onUpdateGameSettings({
                        gpuPostProcessing: !gameSettings.gpuPostProcessing,
                      })
                    }
                    className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer shrink-0 border ${
                      gameSettings.gpuPostProcessing
                        ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    {gameSettings.gpuPostProcessing ? 'POST-FX ON' : 'DIRECT PASS'}
                  </button>
                </div>

                {/* WebGL2 Hardware Adapter & Memory Capability Strip */}
                <div className="p-2 rounded-lg bg-zinc-900/90 border border-white/8 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-zinc-400 truncate">
                      Adapter: <span className="text-cyan-300">{gpuTelemetry.gpuRenderer}</span>
                    </span>
                    <span className="text-sky-300 font-semibold shrink-0">WEBGL2</span>
                  </div>
                  <div
                    data-testid="settings-memory-footprint"
                    className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] font-mono text-zinc-300 bg-zinc-950/60 px-2 py-1 rounded border border-white/5"
                  >
                    <span>
                      RAM:{' '}
                      <span className="text-emerald-300">
                        {gpuTelemetry.jsHeapUsedMB !== null
                          ? `${gpuTelemetry.jsHeapUsedMB} MB`
                          : 'N/A'}
                      </span>
                    </span>
                    <span>
                      VRAM:{' '}
                      <span className="text-amber-300">
                        ~{gpuTelemetry.estimatedTotalVramMB} MB
                      </span>{' '}
                      <span className="text-zinc-500">
                        (G:{gpuTelemetry.estimatedGeoVramMB} T:{gpuTelemetry.estimatedTexVramMB} F:
                        {gpuTelemetry.estimatedRenderTargetVramMB})
                      </span>
                    </span>
                    {gpuTelemetry.lowMemoryModeActive && (
                      <span className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                        LEAN MEM
                      </span>
                    )}
                  </div>
                </div>

                {/* GPU Quality Presets */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">GPU Quality Preset</span>
                    <span className="font-mono text-sky-300 uppercase">
                      {gameSettings.gpuQualityPreset}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['performance', 'balanced', 'high', 'ultra'] as GpuQualityPreset[]).map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          data-testid={`settings-gpu-quality-${preset}`}
                          onClick={() =>
                            onUpdateGameSettings(getPresetPatchForGpuQuality(preset))
                          }
                          className={`px-2 py-1 rounded text-[10px] font-mono uppercase cursor-pointer border ${
                            gameSettings.gpuQualityPreset === preset
                              ? 'bg-zinc-800 text-sky-300 border-sky-400/40'
                              : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                          }`}
                        >
                          {preset === 'performance' ? 'Perf' : preset}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Draw Distance (Camera Far Clip + Background District Culling) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">Draw Distance</span>
                    <span className="font-mono text-sky-300 tabular-nums">
                      {Math.round(gameSettings.drawDistance ?? 650)} m
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { dist: 135, label: 'Short' },
                        { dist: 280, label: 'Med' },
                        { dist: 650, label: 'Far' },
                        { dist: 1350, label: 'Max' },
                      ] as const
                    ).map(({ dist, label }) => (
                      <button
                        key={dist}
                        type="button"
                        data-testid={`settings-draw-distance-${dist}`}
                        onClick={() => onUpdateGameSettings({ drawDistance: dist })}
                        className={`px-1 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                          Math.abs((gameSettings.drawDistance ?? 650) - dist) < 25
                            ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                            : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    data-testid="settings-draw-distance-slider"
                    min={90}
                    max={1350}
                    step={15}
                    value={gameSettings.drawDistance ?? 650}
                    onChange={(e) =>
                      onUpdateGameSettings({ drawDistance: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                {/* Render Resolution Scale & Anti-Aliasing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-300 font-medium">Render Scale</span>
                      <span className="font-mono text-sky-300 tabular-nums">
                        {(gameSettings.gpuResolutionScale ?? 1.0).toFixed(2)}x (
                        {gpuTelemetry.effectivePixelRatio} DPR)
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {([0.6, 0.75, 1.0, 1.25] as const).map((scale) => (
                        <button
                          key={scale}
                          type="button"
                          data-testid={`settings-res-scale-${scale}`}
                          onClick={() => onUpdateGameSettings({ gpuResolutionScale: scale })}
                          className={`px-1 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                            Math.abs((gameSettings.gpuResolutionScale ?? 1.0) - scale) < 0.02
                              ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                              : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                          }`}
                        >
                          {scale}x
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-300 font-medium">Anti-Aliasing</span>
                      <span className="font-mono text-sky-300 uppercase">
                        {gameSettings.gpuAntiAliasing ?? 'msaa_fxaa'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'msaa_fxaa', label: 'MSAA+FX' },
                          { id: 'fxaa', label: 'FXAA' },
                          { id: 'none', label: 'Off' },
                        ] as Array<{ id: GpuAntiAliasingMode; label: string }>
                      ).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          data-testid={`settings-aa-${id}`}
                          onClick={() =>
                            onUpdateGameSettings({
                              gpuAntiAliasing: id,
                              gpuPostProcessing:
                                id !== 'none' ? true : gameSettings.gpuPostProcessing,
                            })
                          }
                          className={`px-1 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                            (gameSettings.gpuAntiAliasing ?? 'msaa_fxaa') === id
                              ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                              : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Visual Filter & Color Grading Presets */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">
                      Visual Filter &amp; Color Grade
                    </span>
                    <span className="font-mono text-amber-300">
                      {GPU_VISUAL_FILTER_PROFILES[gameSettings.gpuVisualFilter]?.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'natural_pbr', short: 'Natural PBR' },
                        { id: 'cinema_filmic', short: 'Cinema' },
                        { id: 'vibrant_hdr', short: 'Vibrant HDR' },
                        { id: 'golden_hour', short: 'Golden Hour' },
                        { id: 'noir_contrast', short: 'Noir Silver' },
                        { id: 'retro_crt', short: 'Retro CRT' },
                      ] as Array<{ id: GpuVisualFilterPreset; short: string }>
                    ).map(({ id, short }) => (
                      <button
                        key={id}
                        type="button"
                        data-testid={`settings-gpu-filter-${id}`}
                        onClick={() =>
                          onUpdateGameSettings({
                            gpuVisualFilter: id,
                            gpuPostProcessing:
                              id !== 'natural_pbr' ? true : gameSettings.gpuPostProcessing,
                          })
                        }
                        className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border truncate ${
                          gameSettings.gpuVisualFilter === id
                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                            : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {short}
                      </button>
                    ))}
                  </div>
                </div>

                {/* HDR Tone Mapping + Exposure */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">HDR Tone Mapping &amp; Exposure</span>
                    <span className="font-mono text-sky-300 tabular-nums">
                      {gameSettings.gpuToneMapping.toUpperCase()} ·{' '}
                      {gameSettings.gpuExposure.toFixed(2)} EV
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['agx', 'aces', 'neutral', 'reinhard'] as GpuToneMappingMode[]).map((tm) => (
                      <button
                        key={tm}
                        type="button"
                        data-testid={`settings-tonemap-${tm}`}
                        onClick={() => onUpdateGameSettings({ gpuToneMapping: tm })}
                        className={`px-2 py-1 rounded text-[10px] font-mono uppercase cursor-pointer border ${
                          gameSettings.gpuToneMapping === tm
                            ? 'bg-zinc-800 text-sky-300 border-sky-400/40'
                            : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {tm}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    data-testid="settings-exposure-slider"
                    min={0.6}
                    max={1.8}
                    step={0.04}
                    value={gameSettings.gpuExposure}
                    onChange={(e) =>
                      onUpdateGameSettings({ gpuExposure: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                {/* PBR Texture Filtering & Hardware Anisotropy */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">
                      PBR Texture Sampling &amp; Anisotropy
                    </span>
                    <span className="font-mono text-emerald-300 tabular-nums">
                      {gpuTelemetry.activeAnisotropy}x / {gpuTelemetry.maxHardwareAnisotropy}x Max
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'trilinear_aniso', label: 'Trilinear' },
                        { id: 'bilinear', label: 'Bilinear' },
                        { id: 'nearest_retro', label: 'Nearest Crisp' },
                      ] as Array<{ id: GpuTextureFilterMode; label: string }>
                    ).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        data-testid={`settings-texfilter-${id}`}
                        onClick={() => onUpdateGameSettings({ gpuTextureFilter: id })}
                        className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                          gameSettings.gpuTextureFilter === id
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                            : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div
                    className={`grid grid-cols-4 gap-1.5 ${
                      gameSettings.gpuTextureFilter !== 'trilinear_aniso' ? 'opacity-45' : ''
                    }`}
                  >
                    {([1, 4, 8, 16] as Array<1 | 4 | 8 | 16>).map((aniso) => (
                      <button
                        key={aniso}
                        type="button"
                        data-testid={`settings-aniso-${aniso}`}
                        onClick={() =>
                          onUpdateGameSettings({
                            gpuAnisotropy: aniso,
                            gpuTextureFilter: 'trilinear_aniso',
                          })
                        }
                        className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                          gameSettings.gpuAnisotropy === aniso
                            ? 'bg-zinc-800 text-emerald-300 border-emerald-400/40'
                            : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {aniso}x AF
                      </button>
                    ))}
                  </div>
                </div>

                {/* Directional Solar Shadow Cascade + Post-FX Passes */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">Solar Shadow Cascade</span>
                    <span className="font-mono text-zinc-400 uppercase">
                      {gameSettings.gpuShadowQuality}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'pcf_soft', label: 'PCF Soft' },
                        { id: 'pcf', label: 'PCF' },
                        { id: 'vsm', label: 'VSM' },
                        { id: 'off', label: 'Off' },
                      ] as Array<{ id: GpuShadowQualityMode; label: string }>
                    ).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        data-testid={`settings-shadow-${id}`}
                        onClick={() => onUpdateGameSettings({ gpuShadowQuality: id })}
                        className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                          gameSettings.gpuShadowQuality === id
                            ? 'bg-zinc-800 text-sky-300 border-sky-400/40'
                            : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bloom, Depth SSAO, Bloom Intensity & CAS Texture Sharpening */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="settings-toggle-bloom"
                    onClick={() =>
                      onUpdateGameSettings({
                        gpuBloomEnabled: !gameSettings.gpuBloomEnabled,
                        gpuPostProcessing: true,
                      })
                    }
                    className={`px-2.5 py-1.5 rounded text-[11px] font-mono cursor-pointer border flex items-center justify-between ${
                      gameSettings.gpuBloomEnabled
                        ? 'bg-sky-500/15 text-sky-200 border-sky-400/35'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    <span>HDR Bloom</span>
                    <span>{gameSettings.gpuBloomEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="settings-toggle-ssao"
                    onClick={() =>
                      onUpdateGameSettings({
                        gpuSsaoEnabled: !gameSettings.gpuSsaoEnabled,
                        gpuPostProcessing: true,
                      })
                    }
                    className={`px-2.5 py-1.5 rounded text-[11px] font-mono cursor-pointer border flex items-center justify-between ${
                      gameSettings.gpuSsaoEnabled
                        ? 'bg-sky-500/15 text-sky-200 border-sky-400/35'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    <span>Depth SSAO</span>
                    <span>{gameSettings.gpuSsaoEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                {gameSettings.gpuBloomEnabled && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-300 font-medium">HDR Bloom Intensity</span>
                      <span className="font-mono text-sky-300 tabular-nums">
                        {Math.round((gameSettings.gpuBloomStrength ?? 0.24) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      data-testid="settings-bloom-slider"
                      min={0.05}
                      max={0.8}
                      step={0.02}
                      value={gameSettings.gpuBloomStrength ?? 0.24}
                      onChange={(e) =>
                        onUpdateGameSettings({
                          gpuBloomStrength: parseFloat(e.target.value),
                          gpuPostProcessing: true,
                        })
                      }
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>
                )}

                <div className={`space-y-1 ${!gameSettings.gpuPostProcessing ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">
                      CAS Texture Sharpening {!gameSettings.gpuPostProcessing && '(Needs Post-FX)'}
                    </span>
                    <span className="font-mono text-sky-300 tabular-nums">
                      {Math.round(gameSettings.gpuSharpenAmount * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    data-testid="settings-sharpen-slider"
                    min={0}
                    max={1}
                    step={0.04}
                    value={gameSettings.gpuSharpenAmount}
                    onChange={(e) =>
                      onUpdateGameSettings({
                        gpuSharpenAmount: parseFloat(e.target.value),
                        gpuPostProcessing: true,
                      })
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100">
                      Capybara Mesh Detail (Adaptive LOD)
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums truncate">
                      Active: {snakeTelemetry.lodLabel} (~
                      {snakeTelemetry.trianglesPerCapy.toLocaleString()} tris · {snakeTelemetry.fps}{' '}
                      FPS)
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-toggle-auto-lod"
                    onClick={() =>
                      onUpdateGameSettings({
                        autoCapyLod: !gameSettings.autoCapyLod,
                      })
                    }
                    className={`min-w-[98px] text-center px-2.5 py-1 rounded text-xs font-mono cursor-pointer shrink-0 border ${
                      gameSettings.autoCapyLod
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    {gameSettings.autoCapyLod ? 'AUTO LOD' : 'MANUAL'}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { tier: 0 as CapyLodTier, label: 'Perf' },
                      { tier: 1 as CapyLodTier, label: 'Balanced' },
                      { tier: 2 as CapyLodTier, label: 'High' },
                      { tier: 3 as CapyLodTier, label: 'Ultra' },
                    ] as const
                  ).map(({ tier, label }) => {
                    const activeTier = gameSettings.autoCapyLod
                      ? snakeTelemetry.lodTier
                      : gameSettings.manualCapyLodTier;
                    const isSelected = activeTier === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        data-testid={`settings-lod-tier-${tier}`}
                        onClick={() =>
                          onUpdateGameSettings({
                            autoCapyLod: false,
                            manualCapyLodTier: tier,
                          })
                        }
                        className={`px-2 py-1 rounded text-[10px] font-mono uppercase cursor-pointer border ${
                          isSelected
                            ? 'bg-zinc-800 text-sky-300 border-sky-400/40'
                            : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100">
                      Day / Night Solar Cycle
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums truncate">
                      {snakeTelemetry.dayPhaseLabel} ({snakeTelemetry.timeOfDayHours.toFixed(1)}h /
                      24h)
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-toggle-daynight"
                    onClick={() =>
                      onUpdateGameSettings({
                        dayNightAutoCycle: !gameSettings.dayNightAutoCycle,
                      })
                    }
                    className={`min-w-[104px] text-center px-2.5 py-1 rounded text-xs font-mono cursor-pointer shrink-0 border ${
                      gameSettings.dayNightAutoCycle
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    {gameSettings.dayNightAutoCycle ? 'AUTO CYCLE' : 'MANUAL HOUR'}
                  </button>
                </div>
                <input
                  type="range"
                  data-testid="settings-time-slider"
                  min={0}
                  max={24}
                  step={0.25}
                  value={
                    gameSettings.dayNightAutoCycle
                      ? snakeTelemetry.timeOfDayHours
                      : gameSettings.timeOfDayHours
                  }
                  onChange={(e) =>
                    onUpdateGameSettings({
                      dayNightAutoCycle: false,
                      timeOfDayHours: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                  {(
                    [
                      { id: 'dawn', label: 'Dawn 6.2h', hour: 6.2 },
                      { id: 'noon', label: 'Noon 12h', hour: 12.0 },
                      { id: 'dusk', label: 'Dusk 18.2h', hour: 18.2 },
                      { id: 'night', label: 'Night 23h', hour: 23.0 },
                    ] as const
                  ).map((phase) => (
                    <button
                      key={phase.id}
                      type="button"
                      data-testid={`settings-phase-${phase.id}`}
                      onClick={() =>
                        onUpdateGameSettings({
                          dayNightAutoCycle: false,
                          timeOfDayHours: phase.hour,
                        })
                      }
                      className={`px-1.5 py-1 rounded text-[10px] font-mono cursor-pointer border flex items-center justify-center gap-1 ${
                        !gameSettings.dayNightAutoCycle &&
                        Math.abs((gameSettings.timeOfDayHours ?? 9.5) - phase.hour) < 0.8
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400/45'
                          : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                      }`}
                    >
                      {phase.id === 'night' ? (
                        <Moon className="w-2.5 h-2.5 shrink-0" />
                      ) : (
                        <Sun className="w-2.5 h-2.5 shrink-0" />
                      )}
                      <span>{phase.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">Weather System</span>
                  <span className="text-[11px] font-mono text-sky-300">
                    {snakeTelemetry.weatherLabel}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {(['auto', 'clear', 'rain', 'storm', 'snow'] as Array<
                    'auto' | WeatherType
                  >).map((wMode) => (
                    <button
                      key={wMode}
                      type="button"
                      data-testid={`settings-weather-${wMode}`}
                      onClick={() => onUpdateGameSettings({ weatherMode: wMode })}
                      className={`px-1.5 py-1 rounded text-[10px] font-mono uppercase cursor-pointer border ${
                        gameSettings.weatherMode === wMode
                          ? 'bg-zinc-800 text-sky-300 border-sky-400/40'
                          : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
                      }`}
                    >
                      {wMode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-200">Camera Follow Distance</span>
                  <span className="text-xs font-mono text-sky-400 tabular-nums">
                    {gameSettings.cameraDistance.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.45}
                  max={2.2}
                  step={0.05}
                  value={gameSettings.cameraDistance}
                  onChange={(e) =>
                    onUpdateGameSettings({ cameraDistance: parseFloat(e.target.value) })
                  }
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-200">
                    Angular Turn Sensitivity
                  </span>
                  <span className="text-xs font-mono text-sky-400 tabular-nums">
                    {gameSettings.turnSensitivity.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={gameSettings.turnSensitivity}
                  onChange={(e) =>
                    onUpdateGameSettings({ turnSensitivity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-200">Field of View (FOV)</span>
                  <span className="text-xs font-mono text-sky-400 tabular-nums">
                    {gameSettings.fov}°
                  </span>
                </div>
                <input
                  type="range"
                  min={45}
                  max={75}
                  step={1}
                  value={gameSettings.fov}
                  onChange={(e) => onUpdateGameSettings({ fov: parseInt(e.target.value, 10) })}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-medium text-zinc-200">Audio Synthesis</div>
                  <div className="text-[10px] text-zinc-500">WebAudio harmonic output</div>
                </div>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
                    !isMuted
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  {!isMuted ? 'ON' : 'MUTED'}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-zinc-200">On-Screen D-Pad</div>
                  <div className="text-[10px] text-zinc-500">Directional pad visibility</div>
                </div>
                <div className="flex items-center gap-1">
                  {(['auto', 'always', 'hidden'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateGameSettings({ touchControlsMode: mode })}
                      className={`px-2 py-1 rounded text-[10px] font-mono uppercase cursor-pointer border ${
                        gameSettings.touchControlsMode === mode
                          ? 'bg-zinc-800 text-sky-300 border-sky-400/40'
                          : 'bg-zinc-900 text-zinc-400 border-white/10'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Offline Progressive Web App (PwaService) Panel */}
              <div
                data-testid="settings-pwa-panel"
                className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-zinc-100">
                      Offline App &amp; Procedural Engine Config
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      Mode: {pwaStatus.standalone ? 'Standalone Installed' : 'Web Session'} ·
                      Preset: {proceduralConfig.meta.configName} (#{proceduralConfig.meta.seed})
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {pwaStatus.installable && (
                      <button
                        type="button"
                        data-testid="pwa-install-btn"
                        onClick={() => PwaService.promptInstall()}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Install App</span>
                      </button>
                    )}
                    {pwaStatus.updateAvailable && (
                      <button
                        type="button"
                        data-testid="pwa-update-btn"
                        onClick={() => PwaService.applyUpdate()}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Apply Update</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenJsonEditor();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-400/35 cursor-pointer"
                    >
                      <Code2 className="w-3 h-3" />
                      <span>Edit JSON</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Cloud Save & Settings Portability (capy_game_save_v3 + capy_game_settings_v1) */}
              <div
                data-testid="settings-save-portability-panel"
                className="p-3 rounded-lg bg-zinc-950/90 border border-emerald-400/20 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-zinc-100">
                      Save &amp; Settings Portability (JSON)
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      Backup or transfer capy_game_save_v3, settings &amp; Yuzu ghost PB
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="settings-export-save-btn"
                      onClick={onExportSaveBundleFile}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-400/35 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      type="button"
                      data-testid="settings-copy-save-btn"
                      onClick={onCopySaveBundleJson}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/15 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    <button
                      type="button"
                      data-testid="settings-import-save-btn"
                      onClick={() => saveImportFileInputRef.current?.click()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-400/35 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Import File</span>
                    </button>
                    <button
                      type="button"
                      data-testid="settings-toggle-paste-save-btn"
                      onClick={onToggleSaveJsonPasteOpen}
                      className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/15 cursor-pointer"
                    >
                      {isSaveJsonPasteOpen ? 'Hide JSON' : 'Paste JSON'}
                    </button>
                  </div>
                </div>

                <input
                  ref={saveImportFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  data-testid="settings-import-save-input"
                  onChange={onImportSaveFileChange}
                  className="hidden"
                />

                {isSaveJsonPasteOpen && (
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    <textarea
                      data-testid="settings-import-json-textarea"
                      value={saveJsonDraft}
                      onChange={(e) => onChangeSaveJsonDraft(e.target.value)}
                      placeholder="Paste capygame-save-bundle-v1 JSON here..."
                      rows={5}
                      className="w-full rounded-lg bg-zinc-900 border border-white/15 p-2 text-[11px] font-mono text-zinc-100 focus:outline-none focus:border-sky-400/60"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        data-testid="settings-apply-import-json-btn"
                        disabled={!saveJsonDraft.trim()}
                        onClick={() => onApplyImportedSaveBundle(saveJsonDraft)}
                        className="px-3 py-1 rounded text-[11px] font-mono bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-40 text-sky-200 border border-sky-400/40 cursor-pointer"
                      >
                        Apply Backup JSON
                      </button>
                    </div>
                  </div>
                )}

                {savePortabilityFeedback && (
                  <div
                    data-testid="settings-save-status"
                    className={`text-[11px] font-mono px-2.5 py-1.5 rounded border ${
                      savePortabilityFeedback.tone === 'ok'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-400/30'
                    }`}
                  >
                    {savePortabilityFeedback.message}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onUnlockAllFeatures}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 cursor-pointer"
                  >
                    Unlock All Sectors
                  </button>
                  <button
                    type="button"
                    data-testid="settings-open-about-btn"
                    onClick={() => {
                      AudioService.playCoin();
                      onOpenAbout();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                    <span>About &amp; Tutorials</span>
                  </button>
                  <button
                    type="button"
                    data-testid="open-privacy-policy-btn"
                    onClick={() => {
                      AudioService.playCoin();
                      onOpenPrivacy();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Privacy Policy</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onResetProgress}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-500/30 cursor-pointer"
                >
                  Reset State
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
