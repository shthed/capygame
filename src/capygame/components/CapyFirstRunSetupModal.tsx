import React from 'react';
import { Crown, Rocket, RotateCcw, Sparkles, X } from 'lucide-react';
import { PLAYABLE_CAPY_HEROES } from '../types';
import {
  CODATA_FINE_STRUCTURE_INVERSE,
  FINE_STRUCTURE_MAX_INVERSE,
  FINE_STRUCTURE_MIN_INVERSE,
  ProceduralGameConfig,
  computeFineStructurePhysics,
} from '../config/ProceduralGameConfig';
import { AudioService } from '../services/AudioService';

export interface CapyFirstRunSetupModalProps {
  proceduralConfig: ProceduralGameConfig;
  firstRunTab: 'pilot' | 'vessel' | 'universe';
  universeScaleLogMeters: number;
  onSelectTab: (tab: 'pilot' | 'vessel' | 'universe') => void;
  onApplyDraftUpdate: (
    mutate: (draft: ProceduralGameConfig) => void,
    refreshHeroVisual?: boolean
  ) => void;
  onPreviewScale: (logScaleMeters: number) => void;
  onCompleteSetup: (launchPlay: boolean) => void;
}

const FUR_PRESETS = [
  { hex: '#b47442', secondary: '#6d3f1d', label: 'Classic' },
  { hex: '#eab308', secondary: '#854d0e', label: 'Solar' },
  { hex: '#f472b6', secondary: '#9d174d', label: 'Sakura' },
  { hex: '#4ade80', secondary: '#166534', label: 'Matcha' },
  { hex: '#6366f1', secondary: '#312e81', label: 'Cosmic' },
  { hex: '#cbd5e1', secondary: '#475569', label: 'Lunar' },
] as const;

const SKIN_IDS = ['classic', 'golden', 'sakura', 'matcha', 'cosmic'] as const;

const HAT_IDS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'yuzu', label: 'Yuzu' },
  { id: 'crown', label: 'Crown' },
  { id: 'flower', label: 'Flora' },
  { id: 'wizard', label: 'Wizard' },
  { id: 'halo', label: 'Halo' },
  { id: 'party', label: 'Party' },
];

export const CapyFirstRunSetupModal: React.FC<CapyFirstRunSetupModalProps> = ({
  proceduralConfig,
  firstRunTab,
  universeScaleLogMeters,
  onSelectTab,
  onApplyDraftUpdate,
  onPreviewScale,
  onCompleteSetup,
}) => {
  const alphaPhysics = computeFineStructurePhysics(
    proceduralConfig.universe.fineStructureInverse
  );
  const regimeColorClass =
    alphaPhysics.regimeTone === 'emerald'
      ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/15'
      : alphaPhysics.regimeTone === 'amber'
        ? 'text-amber-300 border-amber-400/40 bg-amber-500/15'
        : 'text-cyan-300 border-cyan-400/40 bg-cyan-500/15';

  return (
    <aside
      data-testid="first-run-customizer"
      aria-label="Genesis Launch Configurator"
      className="fixed bottom-2 left-2 right-2 sm:bottom-auto sm:right-auto sm:top-12 sm:left-2.5 z-40 pointer-events-auto sm:w-[376px] max-h-[55vh] sm:max-h-[calc(100vh-58px)] bg-zinc-950/95 border border-cyan-400/35 rounded-xl shadow-2xl text-zinc-100 flex flex-col overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 bg-zinc-900/70">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-wider text-cyan-400">
            Chrono-Genesis Setup
          </div>
          <h2 className="text-xs font-semibold text-zinc-100 truncate">
            Customize Pilot, Spaceship &amp; α
          </h2>
        </div>
        <button
          type="button"
          data-testid="setup-skip-btn"
          onClick={() => onCompleteSetup(false)}
          aria-label="Close Genesis Setup"
          className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3 Crisp Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1.5 border-b border-white/10 bg-zinc-950 shrink-0">
        <button
          type="button"
          data-testid="setup-tab-pilot"
          onClick={() => {
            AudioService.playCoin();
            onSelectTab('pilot');
          }}
          className={`py-1.5 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer border transition-colors ${
            firstRunTab === 'pilot'
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
              : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-400'
          }`}
        >
          <Crown className="w-3 h-3 shrink-0" />
          <span>Pilot</span>
        </button>
        <button
          type="button"
          data-testid="setup-tab-vessel"
          onClick={() => {
            AudioService.playCoin();
            onSelectTab('vessel');
          }}
          className={`py-1.5 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer border transition-colors ${
            firstRunTab === 'vessel'
              ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
              : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-400'
          }`}
        >
          <Rocket className="w-3 h-3 shrink-0" />
          <span>Spaceship</span>
        </button>
        <button
          type="button"
          data-testid="setup-tab-universe"
          onClick={() => {
            AudioService.playCoin();
            onSelectTab('universe');
          }}
          className={`py-1.5 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer border transition-colors ${
            firstRunTab === 'universe'
              ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
              : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-400'
          }`}
        >
          <Sparkles className="w-3 h-3 shrink-0" />
          <span>Universe α</span>
        </button>
      </div>

      {/* Active Tab Body */}
      <div className="p-2.5 sm:p-3 overflow-y-auto flex-1 space-y-2.5">
        {firstRunTab === 'pilot' && (
          <div data-testid="setup-panel-pilot" className="space-y-2.5">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Pilot Archetype &amp; Perks
              </div>
              <div className="grid grid-cols-2 gap-1">
                {PLAYABLE_CAPY_HEROES.map((hero) => {
                  const isSelected = proceduralConfig.player.heroArchetypeId === hero.id;
                  const matchingFur =
                    FUR_PRESETS.find((f) =>
                      hero.skin === 'golden'
                        ? f.label === 'Solar'
                        : hero.skin === 'sakura'
                          ? f.label === 'Sakura'
                          : hero.skin === 'matcha'
                            ? f.label === 'Matcha'
                            : hero.skin === 'cosmic'
                              ? f.label === 'Cosmic'
                              : f.label === 'Classic'
                    ) || FUR_PRESETS[0];
                  return (
                    <button
                      key={hero.id}
                      type="button"
                      data-testid={`setup-hero-${hero.id}`}
                      onClick={() => {
                        AudioService.playCoin();
                        onApplyDraftUpdate((draft) => {
                          draft.player.heroArchetypeId = hero.id;
                          draft.player.activeSkin = hero.skin;
                          draft.player.activeHat = hero.hat;
                          draft.player.furPrimaryHex = matchingFur.hex;
                          draft.player.furSecondaryHex = matchingFur.secondary;
                        }, true);
                      }}
                      className={`p-1.5 rounded text-left border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400/60 text-zinc-100'
                          : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                      }`}
                    >
                      <div className="text-[11px] font-semibold truncate">{hero.name}</div>
                      <div className="text-[9px] font-mono text-amber-300 truncate">
                        {hero.perkLabel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                <span>Coat Primary &amp; Snout Trim</span>
                <span className="tabular-nums text-zinc-300">
                  {proceduralConfig.player.furPrimaryHex}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {FUR_PRESETS.map((preset) => {
                  const isActive =
                    proceduralConfig.player.furPrimaryHex.toLowerCase() === preset.hex;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      data-testid={`setup-fur-preset-${preset.label.toLowerCase()}`}
                      onClick={() => {
                        AudioService.playCoin();
                        onApplyDraftUpdate((draft) => {
                          draft.player.furPrimaryHex = preset.hex;
                          draft.player.furSecondaryHex = preset.secondary;
                        }, true);
                      }}
                      title={preset.label}
                      className={`w-6 h-6 rounded border cursor-pointer ${
                        isActive ? 'border-white ring-1 ring-cyan-400' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: preset.hex }}
                    />
                  );
                })}
                <label className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 ml-auto cursor-pointer">
                  <span>Coat</span>
                  <input
                    type="color"
                    data-testid="setup-fur-primary-input"
                    value={proceduralConfig.player.furPrimaryHex}
                    onChange={(e) => {
                      const val = e.target.value;
                      onApplyDraftUpdate((draft) => {
                        draft.player.furPrimaryHex = val;
                      }, true);
                    }}
                    className="w-6 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 cursor-pointer">
                  <span>Trim</span>
                  <input
                    type="color"
                    data-testid="setup-fur-secondary-input"
                    value={proceduralConfig.player.furSecondaryHex}
                    onChange={(e) => {
                      const val = e.target.value;
                      onApplyDraftUpdate((draft) => {
                        draft.player.furSecondaryHex = val;
                      }, true);
                    }}
                    className="w-6 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Surface Skin &amp; Headgear
              </div>
              <div className="grid grid-cols-5 gap-1 mb-1.5">
                {SKIN_IDS.map((skinId) => (
                  <button
                    key={skinId}
                    type="button"
                    data-testid={`setup-skin-${skinId}`}
                    onClick={() => {
                      AudioService.playCoin();
                      onApplyDraftUpdate((draft) => {
                        draft.player.activeSkin = skinId;
                      }, true);
                    }}
                    className={`py-1 px-1 rounded text-[10px] font-mono capitalize border cursor-pointer ${
                      proceduralConfig.player.activeSkin === skinId
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                    }`}
                  >
                    {skinId}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {HAT_IDS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    data-testid={`setup-hat-${h.id}`}
                    onClick={() => {
                      AudioService.playCoin();
                      onApplyDraftUpdate((draft) => {
                        draft.player.activeHat = h.id;
                      }, true);
                    }}
                    className={`py-1 px-1.5 rounded text-[10px] font-mono border cursor-pointer ${
                      proceduralConfig.player.activeHat === h.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {firstRunTab === 'vessel' && (
          <div data-testid="setup-panel-vessel" className="space-y-2.5">
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                <span>Cherenkov Thruster &amp; Visor</span>
                <span className="tabular-nums text-cyan-300">
                  {proceduralConfig.player.vesselCherenkovHex}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {['#06b6d4', '#38bdf8', '#f59e0b', '#ec4899', '#34d399', '#a855f7'].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => {
                      AudioService.playCoin();
                      onApplyDraftUpdate((draft) => {
                        draft.player.vesselCherenkovHex = hex;
                      });
                    }}
                    className={`w-6 h-6 rounded border cursor-pointer ${
                      proceduralConfig.player.vesselCherenkovHex.toLowerCase() === hex
                        ? 'border-white ring-1 ring-cyan-400'
                        : 'border-white/20'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <input
                  type="color"
                  data-testid="setup-vessel-cherenkov-input"
                  value={proceduralConfig.player.vesselCherenkovHex}
                  onChange={(e) => {
                    const val = e.target.value;
                    onApplyDraftUpdate((draft) => {
                      draft.player.vesselCherenkovHex = val;
                    });
                  }}
                  className="ml-auto w-7 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                <span>Astrolabe Brass / Alloy Trim</span>
                <span className="tabular-nums text-amber-300">
                  {proceduralConfig.player.vesselBrassHex}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {['#eab308', '#cbd5e1', '#f97316', '#2dd4bf', '#f43f5e'].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => {
                      AudioService.playCoin();
                      onApplyDraftUpdate((draft) => {
                        draft.player.vesselBrassHex = hex;
                      });
                    }}
                    className={`w-6 h-6 rounded border cursor-pointer ${
                      proceduralConfig.player.vesselBrassHex.toLowerCase() === hex
                        ? 'border-white ring-1 ring-amber-400'
                        : 'border-white/20'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <input
                  type="color"
                  data-testid="setup-vessel-brass-input"
                  value={proceduralConfig.player.vesselBrassHex}
                  onChange={(e) => {
                    const val = e.target.value;
                    onApplyDraftUpdate((draft) => {
                      draft.player.vesselBrassHex = val;
                    });
                  }}
                  className="ml-auto w-7 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                <span>Optical Canopy Dome Tint</span>
                <span className="tabular-nums text-sky-300">
                  {proceduralConfig.player.vesselCanopyHex}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {['#38bdf8', '#22d3ee', '#fde047', '#c084fc', '#e2e8f0'].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => {
                      AudioService.playCoin();
                      onApplyDraftUpdate((draft) => {
                        draft.player.vesselCanopyHex = hex;
                      });
                    }}
                    className={`w-6 h-6 rounded border cursor-pointer ${
                      proceduralConfig.player.vesselCanopyHex.toLowerCase() === hex
                        ? 'border-white ring-1 ring-sky-400'
                        : 'border-white/20'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <input
                  type="color"
                  data-testid="setup-vessel-canopy-input"
                  value={proceduralConfig.player.vesselCanopyHex}
                  onChange={(e) => {
                    const val = e.target.value;
                    onApplyDraftUpdate((draft) => {
                      draft.player.vesselCanopyHex = val;
                    });
                  }}
                  className="ml-auto w-7 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                <span>Chrono-Vessel Hull Scale</span>
                <span className="tabular-nums text-zinc-200 font-semibold">
                  {proceduralConfig.player.vesselScale.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                data-testid="setup-vessel-scale-slider"
                min={0.6}
                max={1.6}
                step={0.05}
                value={proceduralConfig.player.vesselScale}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onApplyDraftUpdate((draft) => {
                    draft.player.vesselScale = val;
                  });
                }}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Launch Flight View
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-testid="setup-vessel-mode-chase"
                  onClick={() => {
                    AudioService.playCoin();
                    onApplyDraftUpdate((draft) => {
                      draft.player.startingVesselMode = 'chase_pod';
                    });
                  }}
                  className={`py-1.5 px-2 rounded text-[11px] font-mono border cursor-pointer ${
                    proceduralConfig.player.startingVesselMode === 'chase_pod'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                  }`}
                >
                  Chase Pod (3P)
                </button>
                <button
                  type="button"
                  data-testid="setup-vessel-mode-telescope"
                  onClick={() => {
                    AudioService.playCoin();
                    onApplyDraftUpdate((draft) => {
                      draft.player.startingVesselMode = 'telescope_first_person';
                    });
                  }}
                  className={`py-1.5 px-2 rounded text-[11px] font-mono border cursor-pointer ${
                    proceduralConfig.player.startingVesselMode === 'telescope_first_person'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                  }`}
                >
                  Telescope (1P)
                </button>
              </div>
            </div>
          </div>
        )}

        {firstRunTab === 'universe' && (
          <div data-testid="setup-panel-universe" className="space-y-2.5">
            <div className="p-2 rounded-lg bg-zinc-900/90 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Fine-Structure Constant (α)
                </span>
                <span
                  data-testid="setup-alpha-readout"
                  className="text-xs font-mono tabular-nums font-semibold text-cyan-300"
                >
                  1 / {alphaPhysics.inverseAlpha.toFixed(3)}
                </span>
              </div>
              <input
                type="range"
                data-testid="setup-alpha-slider"
                min={FINE_STRUCTURE_MIN_INVERSE}
                max={FINE_STRUCTURE_MAX_INVERSE}
                step={0.1}
                value={proceduralConfig.universe.fineStructureInverse}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onApplyDraftUpdate((draft) => {
                    draft.universe.fineStructureInverse = val;
                  });
                }}
                className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: 'Strong 1/90', val: 90.0 },
                  { label: 'CODATA 137', val: CODATA_FINE_STRUCTURE_INVERSE },
                  { label: 'Weak 1/185', val: 185.0 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    data-testid={`setup-alpha-preset-${Math.round(p.val)}`}
                    onClick={() => {
                      AudioService.playCoin();
                      onApplyDraftUpdate((draft) => {
                        draft.universe.fineStructureInverse = p.val;
                      });
                    }}
                    className={`py-1 px-1.5 rounded text-[10px] font-mono tabular-nums border cursor-pointer ${
                      Math.abs(alphaPhysics.inverseAlpha - p.val) < 0.6
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-zinc-950 hover:bg-zinc-800 border-white/10 text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scientific Consequences Readout */}
            <div className="p-2 rounded-lg bg-zinc-900/75 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  data-testid="setup-alpha-regime"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${regimeColorClass}`}
                >
                  {alphaPhysics.regimeLabel}
                </span>
                <span className="text-[10px] font-mono tabular-nums text-zinc-400">
                  α = {alphaPhysics.alpha.toFixed(6)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono tabular-nums">
                <div className="bg-zinc-950/90 px-2 py-1 rounded border border-white/8">
                  <div className="text-zinc-500 text-[9px]">Bohr Radius (a₀)</div>
                  <div className="text-amber-300 font-semibold">
                    {alphaPhysics.bohrRadiusScale.toFixed(2)}× real
                  </div>
                </div>
                <div className="bg-zinc-950/90 px-2 py-1 rounded border border-white/8">
                  <div className="text-zinc-500 text-[9px]">Electron v₁ / c</div>
                  <div className="text-cyan-300 font-semibold">
                    {alphaPhysics.electronSpeedC.toFixed(5)} c
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 leading-snug">{alphaPhysics.summary}</p>
            </div>

            {/* Quick Live 3D Scale Previewer */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Inspect α Live in 3D Viewport
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                {[
                  { id: 'big_bang', label: 'Big Bang', log: 28.0 },
                  { id: 'solar', label: 'Sun Star', log: 11.2 },
                  { id: 'atom', label: 'C-Atom', log: -9.47 },
                  { id: 'photon', label: 'Photon γ', log: -29.0 },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`setup-preview-${s.id}`}
                    onClick={() => {
                      AudioService.playCosmicWarp(1.05);
                      onPreviewScale(s.log);
                    }}
                    className={`py-1 px-1 rounded border cursor-pointer truncate ${
                      Math.abs(universeScaleLogMeters - s.log) < 0.8
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Launch Actions */}
      <div className="px-3 py-2 border-t border-white/10 bg-zinc-950 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          data-testid="setup-reset-btn"
          onClick={() => {
            AudioService.playSplash();
            onApplyDraftUpdate((draft) => {
              draft.universe.fineStructureInverse = CODATA_FINE_STRUCTURE_INVERSE;
              draft.player.heroArchetypeId = 'captain_yuzu';
              draft.player.activeSkin = 'classic';
              draft.player.activeHat = 'yuzu';
              draft.player.furPrimaryHex = '#b47442';
              draft.player.furSecondaryHex = '#6d3f1d';
              draft.player.vesselScale = 1.0;
              draft.player.vesselCherenkovHex = '#06b6d4';
              draft.player.vesselBrassHex = '#eab308';
              draft.player.vesselCanopyHex = '#38bdf8';
              draft.player.startingVesselMode = 'chase_pod';
            }, true);
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-mono border border-white/10 cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Defaults</span>
        </button>

        <button
          type="button"
          data-testid="setup-launch-btn"
          onClick={() => onCompleteSetup(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <Rocket className="w-3.5 h-3.5 shrink-0" />
          <span>Launch Chrono-Vessel</span>
        </button>
      </div>
    </aside>
  );
};
