import React from 'react';
import { HelpCircle, Minus, Plus, X } from 'lucide-react';
import {
  COSMIC_GALAXIES,
  CapySnakeTelemetry,
  CosmicStage,
  GpuEngineTelemetry,
  ORBIT_TIME_SCALES,
  OrbitTelemetry,
  OrbitTimeScaleId,
  PlayStyle,
  UNIVERSE_SCALE_BANDS,
  UniverseScaleTelemetry,
} from '../types';
import type { CosmicSimTelemetry } from '../engine/CosmicUniverseBuilder';
import type { PhysicsEngineTelemetry } from '../engine/physics/PhysicsTypes';
import { KID_FRIENDLY_BAND_DESCRIPTIONS } from './CapyScaleAtlasAndOptics';

export interface CapyInfographicPanelProps {
  isAdvancedMode: boolean;
  isForestGames: boolean;
  isCapytorioGame: boolean;
  isCapytorioOrbitalFlight: boolean;
  activeMode: PlayStyle;
  cosmicStage: CosmicStage;
  universeScale: UniverseScaleTelemetry;
  currentZone: { title: string; subtitle: string };
  snakeTelemetry: CapySnakeTelemetry;
  simStats: { fps: number };
  cosmicSimInfo: CosmicSimTelemetry;
  orbitTelemetry: OrbitTelemetry | null;
  selectedTimeScale: OrbitTimeScaleId;
  selectedGalaxyIdx: number;
  selectedStarIdx: number;
  selectedPlanetIdx: number;
  selectedLandingIdx: number;
  physicsTelemetry: PhysicsEngineTelemetry;
  gpuTelemetry: GpuEngineTelemetry;
  statusBanner: string;
  onClose: () => void;
  onOpenForestMenuTab: (tab: 'modes' | 'wardrobe') => void;
  onOpenAbout: () => void;
  onOpenScaleAtlas: () => void;
  onEngageCapytorioLanding: () => void;
  onTriggerBigBang: () => void;
  onPickRandomTrackedStar: () => void;
  onSetCosmicStagePlaying: () => void;
  onAdjustGravityConstant: (delta: number) => void;
  onToggleFollowTrackedStar: () => void;
  onTriggerSupernovaOnTrackedStar: () => void;
  onSetStellarColorMode: (mode: 'hr_blackbody' | 'mass_spectrum' | 'age_gradient') => void;
  onFollowTrackedStarToPlanet: () => void;
  onSkipToUniverseFlight: () => void;
  onCycleStellarColorMode: () => void;
  onSelectGalaxy: (idx: number) => void;
  onStepCosmicBack: () => void;
  onSelectStarSystem: (idx: number) => void;
  onSetOrbitTimeScale: (scaleId: OrbitTimeScaleId) => void;
  onSelectAsteroidBelt: () => void;
  onSelectPlanet: (idx: number) => void;
  onSelectLandingSpot: (idx: number) => void;
}

export const CapyInfographicPanel: React.FC<CapyInfographicPanelProps> = ({
  isAdvancedMode,
  isForestGames,
  isCapytorioGame,
  isCapytorioOrbitalFlight,
  activeMode,
  cosmicStage,
  universeScale,
  currentZone,
  snakeTelemetry,
  simStats,
  cosmicSimInfo,
  orbitTelemetry,
  selectedTimeScale,
  selectedGalaxyIdx,
  selectedStarIdx,
  selectedPlanetIdx,
  selectedLandingIdx,
  physicsTelemetry,
  gpuTelemetry,
  statusBanner,
  onClose,
  onOpenForestMenuTab,
  onOpenAbout,
  onOpenScaleAtlas,
  onEngageCapytorioLanding,
  onTriggerBigBang,
  onPickRandomTrackedStar,
  onSetCosmicStagePlaying,
  onAdjustGravityConstant,
  onToggleFollowTrackedStar,
  onTriggerSupernovaOnTrackedStar,
  onSetStellarColorMode,
  onFollowTrackedStarToPlanet,
  onSkipToUniverseFlight,
  onCycleStellarColorMode,
  onSelectGalaxy,
  onStepCosmicBack,
  onSelectStarSystem,
  onSetOrbitTimeScale,
  onSelectAsteroidBelt,
  onSelectPlanet,
  onSelectLandingSpot,
}) => {
  const activeGalaxy = COSMIC_GALAXIES[selectedGalaxyIdx] || COSMIC_GALAXIES[0];
  const activeStar = activeGalaxy.starSystems[selectedStarIdx] || activeGalaxy.starSystems[0];
  const activePlanet = activeStar.planets[selectedPlanetIdx] || activeStar.planets[0];
  const activeLandingSpot = activePlanet.landingSpots[selectedLandingIdx] ||
    activePlanet.landingSpots[0] || {
      id: `${activePlanet.id}_probe`,
      name: `${activePlanet.name} Atmospheric Survey`,
      lat: 0,
      lon: 0,
      biome: {
        gravityMultiplier: 1.0,
      },
    };

  return (
    <div
      data-testid="top-info-dropdown"
      className="fixed top-11 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[340px] z-40 pointer-events-auto bg-zinc-950/96 border border-white/15 rounded-xl p-3 text-zinc-100 shadow-2xl space-y-2.5 max-h-[80vh] overflow-y-auto"
    >
      {!isAdvancedMode ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                Adventure Guide
              </div>
              <h2 className="text-sm font-semibold text-zinc-100 truncate">
                {cosmicStage === 'playing' && !universeScale.active
                  ? currentZone.title
                  : UNIVERSE_SCALE_BANDS[universeScale.bandIndex]?.shortLabel || 'Space Explorer'}
              </h2>
            </div>
            <button
              type="button"
              data-testid="close-infographic-btn"
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>

          {isForestGames ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-300 leading-relaxed">
                {activeMode === 'sanctuary'
                  ? 'Bump fruit trees matching the orange on your head to grow longer! Walk along the meadow paths across the unified island to visit Spore Lagoon, Number Stampede, and Yuzu Mountain.'
                  : currentZone.subtitle}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenForestMenuTab('modes')}
                  className="py-2 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-semibold text-xs border border-emerald-400/40 cursor-pointer"
                >
                  Island Games
                </button>
                <button
                  type="button"
                  onClick={() => onOpenForestMenuTab('wardrobe')}
                  className="py-2 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-xs border border-amber-400/40 cursor-pointer"
                >
                  Pick a Hat
                </button>
              </div>
              <button
                type="button"
                data-testid="infographic-open-about-btn"
                onClick={onOpenAbout}
                className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-medium text-xs border border-white/12 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                <span>About CapyGame &amp; Tutorials</span>
              </button>
            </div>
          ) : isCapytorioGame && !isCapytorioOrbitalFlight ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-300 leading-relaxed">{currentZone.subtitle}</p>
              <button
                type="button"
                data-testid="infographic-open-about-btn"
                onClick={onOpenAbout}
                className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-medium text-xs border border-white/12 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                <span>About CapyGame &amp; Tutorials</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-300 leading-relaxed">
                {KID_FRIENDLY_BAND_DESCRIPTIONS[universeScale.bandId] ||
                  'Scroll or use the Scale Atlas to zoom continuously from Multiverse down to Planck length.'}
              </p>
              <div className="flex flex-col gap-1.5">
                {isCapytorioOrbitalFlight ? (
                  <button
                    type="button"
                    data-testid="skip-cosmic-to-world-btn"
                    onClick={() => {
                      onEngageCapytorioLanding();
                      onClose();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Land in Capytorio
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenScaleAtlas}
                    className="w-full py-2 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 font-semibold text-xs border border-sky-400/40 transition-colors cursor-pointer"
                  >
                    Open Scale Atlas
                  </button>
                )}
                {cosmicStage === 'singularity' && (
                  <button
                    type="button"
                    data-testid="trigger-big-bang-btn"
                    onClick={() => {
                      onTriggerBigBang();
                      onClose();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs border border-white/10 transition-colors cursor-pointer"
                  >
                    Start Big Bang Fireworks
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenScaleAtlas}
                  className="w-full py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sky-300 font-medium text-xs border border-sky-400/30 transition-colors cursor-pointer"
                >
                  See All {UNIVERSE_SCALE_BANDS.length} Zoom Pictures
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 border-b border-white/10 pb-1.5 gap-1 tabular-nums">
            <span className="text-emerald-400 font-semibold">
              {cosmicStage === 'playing' ? snakeTelemetry.fps : simStats.fps} FPS
            </span>
            <span>{universeScale.scientificLabel}</span>
            <span className="truncate">{universeScale.bandTitle}</span>
            <button
              type="button"
              data-testid="close-infographic-btn"
              onClick={onClose}
              title="Close Inspector"
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer shrink-0"
            >
              <X className="w-3 h-3 text-zinc-400" />
            </button>
          </div>

          {cosmicStage === 'singularity' && (
            <div className="space-y-2">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                  T = 0.00s · INITIAL STATE
                </div>
                <h2 className="text-xs font-semibold text-zinc-100 mt-0.5">
                  Primordial Singularity
                </h2>
                <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                  Click the central white point or zoom continuously from Big Bang (10^+28m) to Capybara Forest (10^+0.8m) and Quantum Photon (10^-35m).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono bg-zinc-900/90 p-2 rounded-lg border border-white/8">
                <div>
                  <span className="text-zinc-500 block">TRACKED SEED</span>
                  <span data-testid="tracked-star-id" className="text-sky-300 font-semibold">
                    {cosmicSimInfo.trackedStar.catalogId}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">BARYON NODES</span>
                  <span className="text-zinc-200">4.8×10⁴ Persistent</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  data-testid="trigger-big-bang-btn"
                  onClick={onTriggerBigBang}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Ignite Big Bang
                </button>
                <button
                  type="button"
                  data-testid="pick-random-tracked-star-btn"
                  onClick={onPickRandomTrackedStar}
                  title="Pick a random persistent star seed to follow from T=0"
                  className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sky-300 font-mono text-[10px] border border-sky-400/30 cursor-pointer"
                >
                  Random Star
                </button>
                <button
                  type="button"
                  data-testid="skip-cosmic-to-world-btn"
                  onClick={onSetCosmicStagePlaying}
                  className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-[11px] border border-white/10 cursor-pointer"
                >
                  Surface
                </button>
              </div>
            </div>
          )}

          {cosmicStage === 'big_bang' && (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                    N-BODY GRAVITY &amp; NUCLEOSYNTHESIS
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-100 mt-0.5 truncate">
                    {cosmicSimInfo.epochLabel}
                  </h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid="gravity-boost-btn"
                    onClick={() => onAdjustGravityConstant(0.25)}
                    title="Increase Gravitational Constant G"
                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/12 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    data-testid="gravity-damp-btn"
                    onClick={() => onAdjustGravityConstant(-0.25)}
                    title="Decrease Gravitational Constant G"
                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/12 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono bg-zinc-900/90 p-2 rounded-lg border border-white/8">
                <div>
                  <span className="text-zinc-500 block">GRAVITY G</span>
                  <span data-testid="gravity-g-label" className="text-zinc-200">
                    {cosmicSimInfo.gravityMultiplier.toFixed(2)} G₀
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">SUPERNOVAE</span>
                  <span
                    data-testid="supernova-count-label"
                    className="text-amber-300 truncate block"
                  >
                    {cosmicSimInfo.totalSupernovae.toLocaleString()} SNe
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">METALS (Z)</span>
                  <span
                    data-testid="metallicity-z-label"
                    className="text-emerald-300 truncate block"
                  >
                    {cosmicSimInfo.meanMetallicitySolar.toFixed(2)} Z☉
                  </span>
                </div>
              </div>

              <div className="bg-zinc-900/85 p-2 rounded-lg border border-sky-400/25 space-y-1.5">
                <div className="flex items-center justify-between gap-1 text-[9px] font-mono">
                  <span className="text-sky-300 font-semibold truncate" data-testid="tracked-star-id">
                    ★ {cosmicSimInfo.trackedStar.catalogId} · {cosmicSimInfo.trackedStar.generationLabel}
                  </span>
                  <span className="text-amber-300 shrink-0" data-testid="tracked-star-sn-ancestors">
                    {cosmicSimInfo.trackedStar.supernovaAncestors} SNe
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-zinc-300">
                  <div>
                    <span className="text-zinc-500 block">MASS</span>
                    <span data-testid="stellar-mass-label">
                      {cosmicSimInfo.trackedStar.massSolar.toFixed(2)}M☉
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">TEMP</span>
                    <span>{cosmicSimInfo.trackedStar.tempKelvin}K</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">H / He</span>
                    <span>
                      {cosmicSimInfo.trackedStar.elements.hydrogenPct.toFixed(0)}/
                      {cosmicSimInfo.trackedStar.elements.heliumPct.toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">C·O·Si·Fe</span>
                    <span data-testid="tracked-star-heavy-elements" className="text-emerald-300">
                      {(
                        cosmicSimInfo.trackedStar.elements.carbonOxygenPct +
                        cosmicSimInfo.trackedStar.elements.siliconMagnesiumPct +
                        cosmicSimInfo.trackedStar.elements.ironHeavyPct
                      ).toFixed(2)}
                      %
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  <button
                    type="button"
                    data-testid="toggle-follow-star-btn"
                    onClick={onToggleFollowTrackedStar}
                    className={`px-1.5 py-1 rounded text-[9px] font-mono border cursor-pointer truncate ${
                      cosmicSimInfo.isFollowingTrackedStar
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {cosmicSimInfo.isFollowingTrackedStar ? 'Cam: Locked' : 'Cam: Free'}
                  </button>
                  <button
                    type="button"
                    data-testid="pick-random-tracked-star-btn"
                    onClick={onPickRandomTrackedStar}
                    className="px-1.5 py-1 rounded text-[9px] font-mono bg-zinc-950 hover:bg-zinc-800 border border-white/12 text-zinc-200 cursor-pointer truncate"
                  >
                    Random Star
                  </button>
                  <button
                    type="button"
                    data-testid="trigger-supernova-btn"
                    onClick={onTriggerSupernovaOnTrackedStar}
                    className="px-1.5 py-1 rounded text-[9px] font-mono bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 cursor-pointer truncate"
                  >
                    Supernova
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900/80 p-1.5 rounded-lg border border-white/8 space-y-1">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    data-testid="stellar-color-mode-hr_blackbody"
                    onClick={() => onSetStellarColorMode('hr_blackbody')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono border cursor-pointer truncate ${
                      cosmicSimInfo.stellarColorMode === 'hr_blackbody'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    H-R Blackbody
                  </button>
                  <button
                    type="button"
                    data-testid="stellar-color-mode-mass_spectrum"
                    onClick={() => onSetStellarColorMode('mass_spectrum')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono border cursor-pointer truncate ${
                      cosmicSimInfo.stellarColorMode === 'mass_spectrum'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Mass (M/M☉)
                  </button>
                  <button
                    type="button"
                    data-testid="stellar-color-mode-age_gradient"
                    onClick={() => onSetStellarColorMode('age_gradient')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono border cursor-pointer truncate ${
                      cosmicSimInfo.stellarColorMode === 'age_gradient'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Age (Gyr)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  data-testid="follow-star-to-planet-btn"
                  onClick={onFollowTrackedStarToPlanet}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-[11px] transition-colors cursor-pointer truncate"
                >
                  Follow Star → Planet
                </button>
                <button
                  type="button"
                  data-testid="skip-big-bang-btn"
                  onClick={onSkipToUniverseFlight}
                  className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-[11px] border border-white/12 cursor-pointer shrink-0"
                >
                  Galaxies →
                </button>
              </div>
            </div>
          )}

          {cosmicStage === 'universe_flight' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                    SCALE 1/4 · {cosmicSimInfo.trackedStar.catalogId}
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-100 mt-0.5">
                    {activeGalaxy.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="cycle-stellar-color-btn"
                    onClick={onCycleStellarColorMode}
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-sky-300 font-mono text-[10px] border border-sky-400/30 cursor-pointer"
                  >
                    Spectrum
                  </button>
                  <button
                    type="button"
                    data-testid="skip-cosmic-to-world-btn"
                    onClick={onSetCosmicStagePlaying}
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-white/10 cursor-pointer"
                  >
                    Surface
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900/85 p-2 rounded-lg border border-sky-400/25 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-sky-300 font-semibold truncate" data-testid="tracked-star-id">
                    ★ {cosmicSimInfo.trackedStar.catalogId} ({cosmicSimInfo.trackedStar.generationLabel})
                  </span>
                  <span className="text-emerald-300 shrink-0">
                    Z={cosmicSimInfo.trackedStar.metallicityZ.toFixed(4)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    data-testid="pick-random-tracked-star-btn"
                    onClick={onPickRandomTrackedStar}
                    className="px-1.5 py-1 rounded text-[9px] font-mono bg-zinc-950 hover:bg-zinc-800 border border-white/12 text-zinc-200 cursor-pointer truncate"
                  >
                    Random Star
                  </button>
                  <button
                    type="button"
                    data-testid="trigger-supernova-btn"
                    onClick={onTriggerSupernovaOnTrackedStar}
                    className="px-1.5 py-1 rounded text-[9px] font-mono bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 cursor-pointer truncate"
                  >
                    Supernova
                  </button>
                  <button
                    type="button"
                    data-testid="follow-star-to-planet-btn"
                    onClick={onFollowTrackedStarToPlanet}
                    className="px-1.5 py-1 rounded text-[9px] font-mono bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold cursor-pointer truncate"
                  >
                    To Planet →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto pr-0.5">
                {COSMIC_GALAXIES.map((gal, idx) => (
                  <button
                    key={gal.id}
                    type="button"
                    data-testid={`select-galaxy-${idx}`}
                    onClick={() => onSelectGalaxy(idx)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      idx === selectedGalaxyIdx
                        ? 'bg-zinc-800 border-sky-400/60 text-zinc-100'
                        : 'bg-zinc-900/80 border-white/10 text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <span className="text-[10px] font-medium truncate">{gal.name}</span>
                    <span className="text-[9px] font-mono text-sky-400 shrink-0 ml-1">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {cosmicStage === 'galaxy_view' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                    SCALE 2/4 · {activeGalaxy.name}
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-100 mt-0.5">{activeStar.name}</h3>
                </div>
                <button
                  type="button"
                  data-testid="cosmic-back-btn"
                  onClick={onStepCosmicBack}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-white/10 cursor-pointer shrink-0"
                >
                  ← Back
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono bg-zinc-900/90 p-2 rounded-lg border border-white/8">
                <div>
                  <span className="text-zinc-500 block">SPECTRAL CLASS</span>
                  <span className="text-zinc-200">{activeStar.spectralClass}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">BODIES</span>
                  <span className="text-zinc-200">{activeStar.planets.length} Planets</span>
                </div>
              </div>

              <div className="space-y-1">
                {activeGalaxy.starSystems.map((star, idx) => (
                  <button
                    key={star.id}
                    type="button"
                    data-testid={`select-star-${idx}`}
                    onClick={() => onSelectStarSystem(idx)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 text-left transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="text-[11px] font-medium text-zinc-100">{star.name}</div>
                      <div className="text-[9px] font-mono text-zinc-400">{star.spectralClass}</div>
                    </div>
                    <span className="text-[10px] font-mono text-sky-400">Enter →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {cosmicStage === 'star_system_view' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <span>SCALE 3/4 · {activeStar.name}</span>
                    <span className="px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[8px] font-mono border border-sky-500/30">
                      STELLAR SYSTEM
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-100 mt-0.5">
                    {activePlanet.name}
                  </h3>
                </div>
                <button
                  type="button"
                  data-testid="cosmic-back-btn"
                  onClick={onStepCosmicBack}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-white/10 cursor-pointer shrink-0"
                >
                  ← Back
                </button>
              </div>

              <div className="p-2 rounded-lg bg-zinc-900/95 border border-sky-500/30 space-y-1.5 shadow-lg shadow-sky-950/20">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-zinc-300 font-medium">SIM CLOCK</span>
                    <span className="text-sky-300 font-bold" data-testid="sim-clock-readout">
                      Yr {orbitTelemetry?.simElapsedYears ?? 0} · Day {orbitTelemetry?.simElapsedDays ?? 0}
                    </span>
                  </div>
                  <span className="text-zinc-400 text-[9px]">
                    {ORBIT_TIME_SCALES.find((s) => s.id === selectedTimeScale)?.shortLabel ?? '1 Orb/min'}
                  </span>
                </div>

                <div
                  className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none"
                  data-testid="orbit-time-controls"
                >
                  {ORBIT_TIME_SCALES.map((scale) => {
                    const isActive = selectedTimeScale === scale.id;
                    return (
                      <button
                        key={scale.id}
                        type="button"
                        data-testid={`orbit-scale-${scale.id}`}
                        title={scale.description}
                        onClick={() => onSetOrbitTimeScale(scale.id)}
                        className={`px-2 py-1 rounded text-[9px] font-mono border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-sky-500/25 text-sky-200 border-sky-400 font-bold shadow-[0_0_8px_rgba(56,189,248,0.4)] ring-1 ring-sky-400/50'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {scale.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono bg-zinc-900/90 p-2 rounded-lg border border-white/8">
                <div>
                  <span className="text-zinc-500 block text-[9px]">SEMI-MAJOR</span>
                  <span className="text-zinc-200 font-semibold">
                    {activePlanet.semiMajorAu ?? (activePlanet.orbitRadius / 9.0).toFixed(2)} AU
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px]">PERIOD</span>
                  <span className="text-zinc-200 font-semibold">
                    {activePlanet.orbitalPeriodYears ?? Math.pow(activePlanet.orbitRadius / 9.0, 1.5).toFixed(2)} yr
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px]">TYPE</span>
                  <span className="text-sky-300 font-semibold uppercase text-[9px]">
                    {activePlanet.planetType ? activePlanet.planetType.replace('_', ' ') : 'HABITABLE'}
                  </span>
                </div>
              </div>

              {activeStar.asteroidBelt && (
                <button
                  type="button"
                  data-testid="inspect-asteroid-belt"
                  onClick={onSelectAsteroidBelt}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-950/25 hover:bg-amber-900/35 border border-amber-500/30 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🪨</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-amber-200">
                          {activeStar.asteroidBelt.name}
                        </span>
                        <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          MAIN BELT
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-zinc-400 truncate max-w-52">
                        {activeStar.asteroidBelt.semiMajorAu} AU · {activeStar.asteroidBelt.rockCount} Boulders · T = {activeStar.asteroidBelt.orbitalPeriodYears.toFixed(2)} yr
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-amber-400 group-hover:translate-x-0.5 transition-transform">
                    Inspect →
                  </span>
                </button>
              )}

              <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-none">
                {activeStar.planets.map((planet, idx) => {
                  const pType = planet.planetType || 'habitable';
                  const typeBadgeClass =
                    pType === 'rocky'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : pType === 'gas_giant'
                        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                        : pType === 'ice_giant'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

                  return (
                    <button
                      key={planet.id}
                      type="button"
                      data-testid={`select-planet-${idx}`}
                      onClick={() => onSelectPlanet(idx)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        selectedPlanetIdx === idx
                          ? 'bg-zinc-800/90 border-sky-500/40'
                          : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div className="text-[11px] font-medium text-zinc-100">{planet.name}</div>
                          <span
                            className={`text-[8px] font-mono px-1 py-0.2 rounded border uppercase ${typeBadgeClass}`}
                          >
                            {pType.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-zinc-400 truncate max-w-48">
                          {planet.semiMajorAu ? `${planet.semiMajorAu} AU · ` : ''}
                          {planet.subtitle}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-sky-400 shrink-0">Orbit →</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {cosmicStage === 'planet_orbit' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                    SCALE 4/4 · {activePlanet.name}
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-100 mt-0.5">
                    {activeLandingSpot.name}
                  </h3>
                </div>
                <button
                  type="button"
                  data-testid="cosmic-back-btn"
                  onClick={onStepCosmicBack}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-white/10 cursor-pointer shrink-0"
                >
                  ← Back
                </button>
              </div>

              {activePlanet.landingSpots.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono bg-zinc-900/90 p-2 rounded-lg border border-white/8">
                    <div>
                      <span className="text-zinc-500 block">COORDINATES</span>
                      <span className="text-zinc-200">
                        {activeLandingSpot.lat}°, {activeLandingSpot.lon}°
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">SURFACE GRAVITY</span>
                      <span className="text-zinc-200">
                        {activeLandingSpot.biome.gravityMultiplier.toFixed(2)} G
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {activePlanet.landingSpots.map((spot, idx) => (
                      <button
                        key={spot.id}
                        type="button"
                        data-testid={`select-landing-${idx}`}
                        onClick={() => onSelectLandingSpot(idx)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 text-left transition-colors cursor-pointer"
                      >
                        <div>
                          <div className="text-[11px] font-medium text-zinc-100">{spot.name}</div>
                          <div className="text-[9px] font-mono text-zinc-400">
                            {spot.lat}°N, {spot.lon}°E
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-sky-400">Descend ↓</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-2.5 rounded-lg bg-zinc-900/95 border border-amber-500/30 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    Deep Atmosphere · Extreme Environment
                  </div>
                  <p className="text-[10px] font-mono text-zinc-300 leading-relaxed">
                    Planetary conditions preclude foot landing. Orbital atmospheric survey probe is active.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono bg-zinc-950/60 p-1.5 rounded border border-white/5">
                    <div>
                      <span className="text-zinc-500 block">MASS</span>
                      <span className="text-zinc-200 font-semibold">
                        {activePlanet.massLabel || 'Colossal'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">DIAMETER</span>
                      <span className="text-zinc-200 font-semibold">
                        {activePlanet.diameterKm
                          ? `${activePlanet.diameterKm.toLocaleString()} km`
                          : '120,000 km'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {cosmicStage === 'planet_descent' && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                ATMOSPHERIC ENTRY · {activePlanet.name}
              </div>
              <div className="text-xs font-medium text-zinc-100">
                Descending to {activeLandingSpot.name}...
              </div>
            </div>
          )}

          {cosmicStage === 'playing' && (
            <div className="space-y-2 text-[10px] font-mono tabular-nums">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: snakeTelemetry.headOrangeCss }}
                    className="w-3 h-3 rounded-sm border border-white/30 shrink-0"
                  />
                  <span className="font-sans text-xs font-semibold text-zinc-100 truncate">
                    {snakeTelemetry.headOrangeName} · {currentZone.title}
                  </span>
                </div>
                <span data-testid="snake-fruits-carried" className="text-amber-200 shrink-0">
                  Stack: {snakeTelemetry.fruitsCarried}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 bg-zinc-900/90 p-2 rounded-lg border border-white/8">
                <div>
                  <span className="text-zinc-500 block">BODY</span>
                  <span className="text-amber-300">
                    {snakeTelemetry.lengthMeters.toFixed(2)}m ({snakeTelemetry.bodySegments})
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">MOUTH MAX</span>
                  <span data-testid="snake-mouth-limit" className="text-sky-300">
                    &le;{snakeTelemetry.mouthMaxRadiusCm}cm
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">EATEN</span>
                  <span data-testid="snake-oranges-count" className="text-zinc-200">
                    {snakeTelemetry.orangesCollected}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-zinc-900/90 p-2 rounded-lg border border-white/8">
                <div>
                  <span className="text-zinc-500 block">SOLAR / WEATHER</span>
                  <span data-testid="world-weather-label" className="text-zinc-200 truncate block">
                    {snakeTelemetry.dayPhaseLabel} · {snakeTelemetry.weatherLabel}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">HOME POOL</span>
                  <span data-testid="pond-status-label" className="text-sky-300 truncate block">
                    {snakeTelemetry.pondOverflowing
                      ? `Mess ${snakeTelemetry.pondMessPercent}% (${snakeTelemetry.pondFruits})`
                      : `${snakeTelemetry.pondFruits} fruits`}
                  </span>
                </div>
              </div>

              <div
                data-testid="capy-footing-label"
                className="flex items-center justify-between text-zinc-300 px-0.5"
              >
                <span>
                  {snakeTelemetry.isStuckNoFooting
                    ? `STUCK (0/${snakeTelemetry.totalFeet} feet)`
                    : snakeTelemetry.isWalkingBackward
                      ? `Reverse (${snakeTelemetry.groundedFeet}/${snakeTelemetry.totalFeet} feet)`
                      : `Feet: ${snakeTelemetry.groundedFeet}/${snakeTelemetry.totalFeet} grounded`}
                </span>
                <span className="text-zinc-400">{snakeTelemetry.lodLabel}</span>
              </div>

              <div
                data-testid="physics-telemetry-readout"
                className="bg-zinc-900/90 p-2 rounded-lg border border-white/8 space-y-1"
              >
                <div className="flex items-center justify-between text-[9px] text-emerald-300">
                  <span>
                    PHYSICS: Rapier3D Wasm{physicsTelemetry.workerActive ? ' + Worker' : ''} · CCD
                  </span>
                  <span className="text-zinc-400">
                    ({physicsTelemetry.worldX}, {physicsTelemetry.worldZ})m
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-zinc-400">
                  <span>
                    Bodies: {physicsTelemetry.rigidBodyCount}R/{physicsTelemetry.staticColliderCount}S · XPBD {physicsTelemetry.softBodyNodes}n
                  </span>
                  <span>
                    Fluid {physicsTelemetry.fluidGridCells}c ·{' '}
                    {physicsTelemetry.transportMode === 'shared_array_buffer' ? 'SAB' : 'Worker'}
                  </span>
                </div>
              </div>

              <div
                data-testid="gpu-telemetry-readout"
                className="bg-zinc-900/90 p-2 rounded-lg border border-white/8 space-y-1 tabular-nums"
              >
                <div className="flex items-center justify-between text-[9px] text-sky-300">
                  <span className="truncate pr-2">
                    GPU: {gpuTelemetry.backendLabel} · {gpuTelemetry.toneMapping.toUpperCase()}
                  </span>
                  <span className="text-zinc-400 shrink-0">
                    {gpuTelemetry.activeAnisotropy}x Aniso
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-zinc-400">
                  <span className="truncate pr-2">
                    Filter: {gpuTelemetry.visualFilterLabel} ·{' '}
                    {gpuTelemetry.postProcessingActive ? 'HDR PostFX' : 'Direct'}
                  </span>
                  <span className="shrink-0">
                    {gpuTelemetry.drawCalls} dc · {(gpuTelemetry.triangles / 1000).toFixed(1)}k tri
                  </span>
                </div>
              </div>

              <div className="text-zinc-400 text-[10px] font-sans border-t border-white/10 pt-1.5">
                {statusBanner}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
