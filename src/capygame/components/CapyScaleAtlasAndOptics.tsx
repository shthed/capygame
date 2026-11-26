import React from 'react';
import { BookOpen, Check, Lock, Volume2, X } from 'lucide-react';
import {
  AstrophysicsPaletteMode,
  CapyGameSettings,
  GalaxyMorphology,
  MAX_UNIVERSE_LOG_METERS,
  MIN_UNIVERSE_LOG_METERS,
  OBJECT_MARKERS_COIN_COST,
  OBJECT_MARKERS_DNA_COST,
  PlayerStats,
  REALITY_RESCALER_COIN_COST,
  REALITY_RESCALER_DNA_COST,
  UNIVERSE_SCALE_BANDS,
  UniverseScaleBandId,
  UniverseScaleTelemetry,
  formatPhysicalScaleMeters,
} from '../types';
import { FOREST_MICRO_SPECIMENS, ForestMicroSpecimenId } from '../engine/forestMicroSpecimens';
import { AudioService } from '../services/AudioService';

export const KID_FRIENDLY_BAND_DESCRIPTIONS: Record<UniverseScaleBandId, string> = {
  multiverse: 'Floating bubbles of different universes in deep space.',
  big_bang: 'The bright flash where stars and space first began.',
  universe: 'Billions of shining galaxies stretching everywhere.',
  observable: 'Everything we can see across the whole cosmos.',
  cosmic_web: 'Giant glowing webs of galaxies connected together.',
  filament: 'Long sparkling bridges made of thousands of galaxies.',
  supercluster: 'Huge neighborhoods packed with galaxy clusters.',
  cluster: 'Hundreds of giant galaxies dancing near each other.',
  galaxy: 'Our spinning Milky Way spiral full of billions of stars.',
  spiral_arms: 'Bright blue arms of newborn stars and glowing dust.',
  nebulas: 'Colorful space clouds where brand new stars are born.',
  stellar_systems: 'A bright star with planets circling around it.',
  planetary_system: 'Capybara Earth with its Moon orbiting nearby.',
  planet: 'Our big blue marble of oceans, clouds, and green land.',
  atmosphere: 'Soft blue sky layers and fluffy clouds above Earth.',
  land_masses: 'Wide green continents surrounded by sparkling blue seas.',
  ecosystems: 'A peaceful tropical island bay surrounded by mountains.',
  capybara_forest: 'Walk, swim, bounce, and collect oranges with Capybara!',
  leaf_fur_micro: 'Super close look at fuzzy golden fur and green leaves.',
  biological_cells: 'Tiny living cells working inside every plant and animal.',
  dna_molecules: 'Twisting rainbow spirals that hold life instructions.',
  atomic_orbitals: 'Spinning cloud shells of energy around an atom.',
  atomic_nucleus: 'The super tiny, dense core right inside an atom.',
  quarks_gluons: 'Three colorful building blocks zipped inside protons.',
  single_electron: 'One zippy glowing particle zooming around atoms.',
  single_photon: 'A tiny twinkling wave of pure sunlight.',
  planck_quantum_foam: 'The smallest buzzing grid at the bottom of space.',
};

export interface CapyScaleAtlasPanelProps {
  isAdvancedMode: boolean;
  universeScale: UniverseScaleTelemetry;
  stats: PlayerStats;
  isSpokenScaleCardsEnabled: boolean;
  isStickerBookOpen: boolean;
  liveZoomThumbnails: Partial<Record<UniverseScaleBandId, string>>;
  onClose: () => void;
  onSetSpokenScaleCardsEnabled: (enabled: boolean) => void;
  onToggleStickerBook: () => void;
  onCloseStickerBook: () => void;
  onJumpToScaleBand: (bandId: UniverseScaleBandId, immediate: boolean) => void;
  onRerollForestSpecimen: (specimenId?: ForestMicroSpecimenId) => void;
  onSetSeamlessLogScale: (val: number, immediate: boolean) => void;
  onToggleAutoZoom: (dir: -1 | 1) => void;
  onSetQuantumFocusMode: (mode: 'electron' | 'photon') => void;
  onResumeSurfacePlayFromForest: () => void;
}

export const CapyScaleAtlasPanel: React.FC<CapyScaleAtlasPanelProps> = ({
  isAdvancedMode,
  universeScale,
  stats,
  isSpokenScaleCardsEnabled,
  isStickerBookOpen,
  liveZoomThumbnails,
  onClose,
  onSetSpokenScaleCardsEnabled,
  onToggleStickerBook,
  onCloseStickerBook,
  onJumpToScaleBand,
  onRerollForestSpecimen,
  onSetSeamlessLogScale,
  onToggleAutoZoom,
  onSetQuantumFocusMode,
  onResumeSurfacePlayFromForest,
}) => (
  <div
    data-testid="universe-scale-atlas-panel"
    className="fixed top-11 left-2 z-40 pointer-events-auto w-[calc(100vw-16px)] max-w-[390px] bg-zinc-950/96 border border-white/15 rounded-xl p-3 text-zinc-100 shadow-2xl space-y-2.5"
  >
    <div className="border-b border-white/10 pb-2 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isAdvancedMode ? (
            <>
              <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-sky-400">
                <span data-testid="scale-scientific-readout">{universeScale.scientificLabel}</span>
                <span className="text-zinc-600">·</span>
                <span
                  data-testid="scale-human-readout"
                  className="text-amber-300 font-semibold whitespace-nowrap"
                >
                  {universeScale.scaleFormatted}
                </span>
              </div>
              <h3
                data-testid="scale-band-title"
                className="text-xs font-semibold text-zinc-100 truncate mt-0.5"
              >
                {universeScale.bandTitle}
              </h3>
              <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                {universeScale.bandSubtitle}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400 whitespace-nowrap">
                <span>Zoom Explorer · {UNIVERSE_SCALE_BANDS.length} Sizes</span>
                <span className="text-zinc-600">·</span>
                <span className="font-mono text-amber-300 tabular-nums normal-case">
                  {universeScale.scaleFormatted}
                </span>
              </div>
              <h3
                data-testid="scale-band-title"
                className="text-sm font-semibold text-zinc-100 truncate mt-0.5"
              >
                {UNIVERSE_SCALE_BANDS[universeScale.bandIndex]?.shortLabel || universeScale.bandTitle}
              </h3>
              <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                Tap any card to fly there, or open the Sticker Book!
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          data-testid="close-scale-atlas-btn"
          onClick={onClose}
          className="min-h-9 min-w-9 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer shrink-0"
          aria-label="Collapse Universe Scale Atlas"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          data-testid="toggle-speak-cards-btn"
          aria-pressed={isSpokenScaleCardsEnabled}
          onClick={() => {
            const next = !isSpokenScaleCardsEnabled;
            onSetSpokenScaleCardsEnabled(next);
            const curBand = UNIVERSE_SCALE_BANDS[universeScale.bandIndex];
            AudioService.playScaleCardChime(curBand?.domain ?? 'cosmic');
            if (next && curBand) {
              AudioService.speakScaleCardCaption(
                `${curBand.shortLabel}. ${KID_FRIENDLY_BAND_DESCRIPTIONS[curBand.id]}`
              );
            }
          }}
          title={isSpokenScaleCardsEnabled ? 'Mute Spoken Scale Cards' : 'Read Scale Cards Aloud'}
          aria-label="Toggle Spoken Scale Cards"
          className={`min-h-9 px-2.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
            isSpokenScaleCardsEnabled
              ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
              : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5 shrink-0" />
          <span>{isSpokenScaleCardsEnabled ? 'Voice On' : 'Read Aloud'}</span>
        </button>
        <button
          type="button"
          data-testid="toggle-sticker-book-btn"
          aria-pressed={isStickerBookOpen}
          onClick={() => {
            AudioService.playCoin();
            onToggleStickerBook();
          }}
          title="Forest Glade Discovery Sticker Book"
          aria-label="Toggle Forest Glade Sticker Book"
          className={`min-h-9 px-2.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
            isStickerBookOpen
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
              : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-amber-300'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span>
            Stickers {(stats.discoveredForestSpecimens?.length ?? 0)}/{FOREST_MICRO_SPECIMENS.length}
          </span>
        </button>
      </div>
    </div>

    {isStickerBookOpen && (
      <div
        data-testid="forest-sticker-book-panel"
        className="p-2.5 rounded-xl bg-zinc-900/95 border border-amber-400/30 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold text-amber-300">
            Micro-Glade Sticker Book ({stats.discoveredForestSpecimens?.length ?? 0}/
            {FOREST_MICRO_SPECIMENS.length} Found)
          </div>
          <button
            type="button"
            onClick={onCloseStickerBook}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            Back to Sizes
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5 max-h-[38vh] overflow-y-auto pr-0.5">
          {FOREST_MICRO_SPECIMENS.map((spec) => {
            const found = Boolean(stats.discoveredForestSpecimens?.includes(spec.id));
            const isActiveSpecimen =
              universeScale.bandId === 'leaf_fur_micro' &&
              universeScale.forestSpecimenId === spec.id;
            return (
              <button
                key={spec.id}
                type="button"
                data-testid={`sticker-specimen-${spec.id}`}
                onClick={() => {
                  AudioService.playScaleCardChime('microscopic');
                  if (isSpokenScaleCardsEnabled) {
                    AudioService.speakScaleCardCaption(`${spec.title}. ${spec.subtitle}`);
                  }
                  onJumpToScaleBand('leaf_fur_micro', false);
                  onRerollForestSpecimen(spec.id);
                }}
                className={`min-h-12 p-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  isActiveSpecimen
                    ? 'bg-amber-400/25 border-amber-300 text-amber-100'
                    : found
                      ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-100 hover:bg-emerald-500/25'
                      : 'bg-zinc-950/80 border-white/10 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold truncate">{spec.kidLabel}</span>
                  {found && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                </div>
                <div className="text-[9px] text-zinc-400 truncate mt-0.5">
                  {found ? 'Collected!' : 'Tap to Spot'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    )}

    {isAdvancedMode && !isStickerBookOpen && (
      <>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 tabular-nums">
            <span>10^-35m Planck</span>
            <span className="text-emerald-300">10^+0.8m Capy Forest</span>
            <span>10^+30m Multiverse</span>
          </div>
          <input
            type="range"
            data-testid="universe-scale-slider"
            min={MIN_UNIVERSE_LOG_METERS}
            max={MAX_UNIVERSE_LOG_METERS}
            step={0.05}
            value={universeScale.targetLogScaleMeters}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onSetSeamlessLogScale(val, false);
            }}
            aria-label="Logarithmic Universe Scale (log10 meters)"
            className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
          />
        </div>

        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
          <button
            type="button"
            data-testid="auto-zoom-quantum-btn"
            onClick={() => onToggleAutoZoom(-1)}
            className={`py-1 px-1.5 rounded border cursor-pointer truncate ${
              universeScale.autoZoomDir === -1
                ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
            }`}
          >
            {universeScale.autoZoomDir === -1 ? 'Pause ↓' : 'Dive 10⁻³⁵'}
          </button>
          <button
            type="button"
            data-testid="auto-zoom-cosmic-btn"
            onClick={() => onToggleAutoZoom(1)}
            className={`py-1 px-1.5 rounded border cursor-pointer truncate ${
              universeScale.autoZoomDir === 1
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
            }`}
          >
            {universeScale.autoZoomDir === 1 ? 'Pause ↑' : 'Rise 10⁺³⁰'}
          </button>
          <button
            type="button"
            data-testid="quantum-focus-electron"
            onClick={() => onSetQuantumFocusMode('electron')}
            className={`py-1 px-1.5 rounded border cursor-pointer truncate ${
              universeScale.bandId === 'single_electron'
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-cyan-300'
            }`}
          >
            Electron e⁻
          </button>
          <button
            type="button"
            data-testid="quantum-focus-photon"
            onClick={() => onSetQuantumFocusMode('photon')}
            className={`py-1 px-1.5 rounded border cursor-pointer truncate ${
              universeScale.bandId === 'single_photon'
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-amber-300'
            }`}
          >
            Photon γ
          </button>
        </div>
      </>
    )}

    {!isStickerBookOpen && (
      <div
        data-testid="zoom-levels-list"
        className="flex flex-col gap-2 max-h-[54vh] overflow-y-auto pr-1"
      >
        {UNIVERSE_SCALE_BANDS.map((band, idx) => {
          const isCurrent = band.id === universeScale.bandId;
          const thumbSrc =
            liveZoomThumbnails[band.id] || `./assets/zoom_thumbs/${band.id}.jpg`;
          const realisticSizeShort = formatPhysicalScaleMeters(band.logMeters);
          return (
            <button
              key={band.id}
              type="button"
              data-testid={`scale-band-btn-${band.id}`}
              onClick={() => {
                AudioService.playScaleCardChime(band.domain);
                if (isSpokenScaleCardsEnabled) {
                  AudioService.speakScaleCardCaption(
                    `${band.shortLabel}. ${realisticSizeShort}. ${KID_FRIENDLY_BAND_DESCRIPTIONS[band.id]}`
                  );
                }
                onJumpToScaleBand(band.id, false);
              }}
              className={`w-full flex items-center gap-2.5 rounded-xl border text-left transition-colors cursor-pointer shrink-0 ${
                isAdvancedMode ? 'p-2 min-h-[64px]' : 'p-2.5 min-h-[76px]'
              } ${
                isCurrent
                  ? 'bg-sky-500/20 border-sky-400 text-zinc-100'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/10 text-zinc-200'
              }`}
            >
              <img
                data-testid={`scale-band-thumb-${band.id}`}
                src={thumbSrc}
                alt={`${band.shortLabel} preview`}
                className="w-24 h-[60px] sm:w-28 sm:h-[70px] rounded-lg object-cover shrink-0 bg-zinc-950 border border-white/15"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-mono text-sky-400 tabular-nums truncate">
                    {isAdvancedMode
                      ? `10^${band.logMeters >= 0 ? `+${band.logMeters}` : band.logMeters}m · ${realisticSizeShort} · #${idx + 1}`
                      : `#${idx + 1} · ${realisticSizeShort} · ${
                          band.domain === 'cosmic' || band.domain === 'stellar'
                            ? 'Space'
                            : band.domain === 'planetary' || band.domain === 'terrestrial'
                              ? 'Earth'
                              : 'Tiny World'
                        }`}
                  </span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-400 text-zinc-950 text-[9px] font-semibold shrink-0">
                      HERE
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-zinc-100 truncate mt-0.5">
                  {isAdvancedMode ? band.title : band.shortLabel}
                </div>
                <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5 leading-snug">
                  {isAdvancedMode
                    ? band.subtitle
                    : KID_FRIENDLY_BAND_DESCRIPTIONS[band.id]}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    )}

    <button
      type="button"
      data-testid="enter-capy-forest-play-btn"
      onClick={() => {
        onResumeSurfacePlayFromForest();
        onClose();
      }}
      className="w-full min-h-11 py-2 px-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
    >
      {isAdvancedMode
        ? 'Land & Control Capybara in Forest (10⁺⁰·⁸ m)'
        : 'Play on Capybara Island!'}
    </button>
  </div>
);

export interface CapyCosmicOpticsPanelProps {
  universeScale: UniverseScaleTelemetry;
  gameSettings: CapyGameSettings;
  stats: PlayerStats;
  isMarkersUnlocked: boolean;
  isRescalerUnlocked: boolean;
  onClose: () => void;
  onToggleObjectMarkers: () => void;
  onUnlockCosmicInstrument: (instrument: 'markers' | 'rescaler', currency: 'dna' | 'coins') => void;
  onSetRealityGamma: (gamma: number) => void;
  onSetAstrophysicsPalette: (palette: AstrophysicsPaletteMode) => void;
  onSetGalaxyMorphology: (morph: GalaxyMorphology) => void;
  onUnlockAllFeatures: () => void;
}

export const CapyCosmicOpticsPanel: React.FC<CapyCosmicOpticsPanelProps> = ({
  universeScale,
  gameSettings,
  stats,
  isMarkersUnlocked,
  isRescalerUnlocked,
  onClose,
  onToggleObjectMarkers,
  onUnlockCosmicInstrument,
  onSetRealityGamma,
  onSetAstrophysicsPalette,
  onSetGalaxyMorphology,
  onUnlockAllFeatures,
}) => (
  <div
    data-testid="cosmic-optics-panel"
    className="fixed top-11 left-2 sm:left-32 z-40 pointer-events-auto w-[calc(100vw-16px)] max-w-[360px] bg-zinc-950/96 border border-white/15 rounded-xl p-3 text-zinc-100 shadow-2xl space-y-2.5"
  >
    <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-sky-400">
          <span>COSMIC OPTICS</span>
          <span className="text-zinc-600">·</span>
          <span data-testid="optics-active-law-label" className="text-emerald-300 font-semibold">
            {universeScale.realityScaleGamma >= 0.99
              ? '1:1 True Physics'
              : `Rescaled (γ = ${universeScale.realityScaleGamma.toFixed(2)})`}
          </span>
        </div>
        <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug whitespace-normal">
          Default universe renders at strict 1:1 physical ratios. Unlock optical instruments to locate sub-pixel bodies or compress scale ratios.
        </p>
      </div>
      <button
        type="button"
        data-testid="close-optics-panel-btn"
        onClick={onClose}
        className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer shrink-0"
        aria-label="Close Cosmic Optics Panel"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>

    <div className="p-2.5 rounded-lg bg-zinc-900/85 border border-white/10 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-zinc-100">Object Finder Markers</div>
        {isMarkersUnlocked ? (
          <button
            type="button"
            data-testid="toggle-object-markers-btn"
            onClick={onToggleObjectMarkers}
            className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold border cursor-pointer ${
              gameSettings.showObjectMarkers
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                : 'bg-zinc-950 text-zinc-400 border-white/10 hover:text-zinc-200'
            }`}
          >
            {gameSettings.showObjectMarkers ? 'MARKERS ON' : 'MARKERS OFF'}
          </button>
        ) : (
          <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Locked
          </span>
        )}
      </div>
      <p className="text-[10px] text-zinc-400 leading-snug whitespace-normal">
        Projects Keplerian orbit hairlines and clickable HUD target reticles onto tiny 1:1 planets, moons, protostars, and atomic nuclei.
      </p>
      {!isMarkersUnlocked && (
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            type="button"
            data-testid="unlock-markers-dna-btn"
            onClick={() => onUnlockCosmicInstrument('markers', 'dna')}
            className="py-1 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-mono font-semibold cursor-pointer"
          >
            Unlock · {OBJECT_MARKERS_DNA_COST} DNA
          </button>
          <button
            type="button"
            data-testid="unlock-markers-coins-btn"
            onClick={() => onUnlockCosmicInstrument('markers', 'coins')}
            className="py-1 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[10px] font-mono font-semibold cursor-pointer"
          >
            Unlock · {OBJECT_MARKERS_COIN_COST}c
          </button>
        </div>
      )}
    </div>

    <div className="p-2.5 rounded-lg bg-zinc-900/85 border border-white/10 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-zinc-100">Reality Rescaler</div>
        {isRescalerUnlocked ? (
          <span
            data-testid="reality-rescaler-readout"
            className="text-[10px] font-mono tabular-nums text-sky-300 font-semibold"
          >
            γ = {gameSettings.realityScaleGamma.toFixed(2)}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Locked (1:1)
          </span>
        )}
      </div>
      <p className="text-[10px] text-zinc-400 leading-snug whitespace-normal">
        Logarithmically / exponentially compresses size &amp; orbital ratios (r&prime; &prop; r^&gamma;) so giant stars, tiny planets, moons, and nuclei appear together intuitively.
      </p>
      {isRescalerUnlocked ? (
        <div className="space-y-1.5 pt-0.5">
          <input
            type="range"
            data-testid="reality-rescaler-slider"
            min={0.28}
            max={1.0}
            step={0.02}
            value={gameSettings.realityScaleGamma}
            onChange={(e) => onSetRealityGamma(parseFloat(e.target.value))}
            aria-label="Reality Rescaler Exponent Gamma"
            className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
          />
          <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
            <button
              type="button"
              data-testid="rescaler-preset-1to1"
              onClick={() => onSetRealityGamma(1.0)}
              className={`py-1 px-1.5 rounded border cursor-pointer ${
                gameSettings.realityScaleGamma >= 0.99
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                  : 'bg-zinc-950 hover:bg-zinc-800 border-white/10 text-zinc-300'
              }`}
            >
              1:1 True
            </button>
            <button
              type="button"
              data-testid="rescaler-preset-log"
              onClick={() => onSetRealityGamma(0.5)}
              className={`py-1 px-1.5 rounded border cursor-pointer ${
                Math.abs(gameSettings.realityScaleGamma - 0.5) < 0.03
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                  : 'bg-zinc-950 hover:bg-zinc-800 border-white/10 text-zinc-300'
              }`}
            >
              Log-Sqrt 0.50
            </button>
            <button
              type="button"
              data-testid="rescaler-preset-atlas"
              onClick={() => onSetRealityGamma(0.3)}
              className={`py-1 px-1.5 rounded border cursor-pointer ${
                gameSettings.realityScaleGamma <= 0.33
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                  : 'bg-zinc-950 hover:bg-zinc-800 border-white/10 text-zinc-300'
              }`}
            >
              Atlas 0.30
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            type="button"
            data-testid="unlock-rescaler-dna-btn"
            onClick={() => onUnlockCosmicInstrument('rescaler', 'dna')}
            className="py-1 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-mono font-semibold cursor-pointer"
          >
            Unlock · {REALITY_RESCALER_DNA_COST} DNA
          </button>
          <button
            type="button"
            data-testid="unlock-rescaler-coins-btn"
            onClick={() => onUnlockCosmicInstrument('rescaler', 'coins')}
            className="py-1 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[10px] font-mono font-semibold cursor-pointer"
          >
            Unlock · {REALITY_RESCALER_COIN_COST}c
          </button>
        </div>
      )}
    </div>

    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/85 border border-white/10">
      <span className="text-[11px] font-medium text-zinc-200">Spectral Filter</span>
      <div className="flex items-center gap-1 text-[10px] font-mono">
        <button
          type="button"
          data-testid="palette-btn-natural"
          onClick={() => onSetAstrophysicsPalette('natural')}
          className={`px-2 py-0.5 rounded border cursor-pointer ${
            gameSettings.astrophysicsPalette === 'natural'
              ? 'bg-sky-500/25 border-sky-400 text-sky-200'
              : 'bg-zinc-950 text-zinc-400 border-white/10'
          }`}
        >
          Natural Eye
        </button>
        <button
          type="button"
          data-testid="palette-btn-hubble"
          onClick={() => onSetAstrophysicsPalette('hubble')}
          className={`px-2 py-0.5 rounded border cursor-pointer ${
            gameSettings.astrophysicsPalette === 'hubble'
              ? 'bg-amber-500/25 border-amber-400 text-amber-200'
              : 'bg-zinc-950 text-zinc-400 border-white/10'
          }`}
        >
          Hubble SHO
        </button>
      </div>
    </div>

    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-zinc-900/85 border border-white/10">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-zinc-200">Galaxy Morphology</span>
        <span className="text-[10px] font-mono text-zinc-400 capitalize">
          {(universeScale.galaxyMorphology || 'spiral').replace('_', ' ')}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px] font-mono">
        {(
          [
            { id: 'spiral' as const, label: 'Grand Spiral' },
            { id: 'barred_spiral' as const, label: 'Barred' },
            { id: 'elliptical' as const, label: 'Elliptical' },
            { id: 'irregular' as const, label: 'Irregular' },
          ]
        ).map((morph) => (
          <button
            key={morph.id}
            type="button"
            data-testid={`morphology-btn-${morph.id}`}
            onClick={() => {
              AudioService.playCoin();
              onSetGalaxyMorphology(morph.id);
            }}
            className={`px-1.5 py-1 rounded border text-center cursor-pointer truncate ${
              (universeScale.galaxyMorphology || 'spiral') === morph.id
                ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                : 'bg-zinc-950 text-zinc-400 border-white/10 hover:text-zinc-200'
            }`}
          >
            {morph.label}
          </button>
        ))}
      </div>
    </div>

    {(!isMarkersUnlocked || !isRescalerUnlocked) && (
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[10px] font-mono">
        <span className="text-zinc-400 tabular-nums">
          Balance: <span className="text-emerald-300">{stats.dna} DNA</span> ·{' '}
          <span className="text-amber-300">{stats.coins ?? 0}c</span>
        </span>
        <button
          type="button"
          data-testid="optics-sandbox-unlock-btn"
          onClick={onUnlockAllFeatures}
          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/15 cursor-pointer"
        >
          Sandbox Unlock All
        </button>
      </div>
    )}
  </div>
);
