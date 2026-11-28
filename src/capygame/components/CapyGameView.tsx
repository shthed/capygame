import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AstrophysicsPaletteMode,
  PlayStyle,
  PlayerStats,
  CapyGameSettings,
  CapySnakeTelemetry,
  LiveModeTelemetry,
  BuildingCatalogItem,
  SPORE_MUTATIONS,
  MutationId,
  ZONE_LOCATIONS,
  PROGRESSIVE_UNLOCKS,
  COSMIC_GALAXIES,
  CosmicStage,
  GpuEngineTelemetry,
  MAX_UNIVERSE_LOG_METERS,
  MIN_UNIVERSE_LOG_METERS,
  OBJECT_MARKERS_COIN_COST,
  OBJECT_MARKERS_DNA_COST,
  PLAYABLE_CAPY_HEROES,
  PerformanceLogSnapshot,
  REALITY_RESCALER_COIN_COST,
  REALITY_RESCALER_DNA_COST,
  UNIVERSE_SCALE_BANDS,
  UniverseScaleBandId,
  UniverseScaleTelemetry,
  formatPhysicalScaleMeters,
  OrbitTelemetry,
  OrbitTimeScaleId,
  ForestSubMode,
  TopLevelGameMode,
  isForestGameMode,
  BountyEventType,
  createDefaultBounties,
} from '../types';
import { ProgressionService } from '../services/ProgressionService';
import type {
  PlacementGhostStatus,
  PlayStyleManager,
} from '../engine/PlayStyleManager';
import type { PhysicsEngineTelemetry } from '../engine/physics/PhysicsTypes';
import type { CosmicSimTelemetry } from '../engine/CosmicUniverseBuilder';
import { GamePauseController } from '../engine/GamePauseController';
import {
  canProcessGameKeyboardEvent,
  canRequestProgrammaticFocus,
  detectEmbeddedIframe,
  isEditableKeyboardTarget,
  readDocumentFocusState,
  resolveSuspensionMode,
  shouldCapturePointerOnCanvasDown,
  shouldUseNativePointerLock,
} from '../engine/FocusGuard';
import { AudioService } from '../services/AudioService';
import { NativeBridge } from '../../services/NativeBridge';
import { PwaService } from '../../services/PwaService';
import {
  ProceduralGameConfig,
  CODATA_FINE_STRUCTURE_INVERSE,
  hasCompletedFirstRunSetup,
  markFirstRunSetupComplete,
  loadSavedProceduralConfig,
  saveProceduralConfig,
  resetSavedProceduralConfig,
  parseAndValidateProceduralConfig,
  cloneProceduralConfig,
} from '../config/ProceduralGameConfig';
import { FOREST_MICRO_SPECIMENS } from '../engine/forestMicroSpecimens';
import {
  formatFlightSpeedReadout,
  resolveTopLevelGameMode,
} from '../engine/UniverseScaleMath';
import type {
  CapytorioLuaCatalogInfo,
  CapytorioRecipeGroup,
  CapytorioRecipeId,
} from '../engine/CapytorioData';
import type {
  CapytorioTileInspection,
  CapytorioUiSnapshot,
} from '../engine/CapytorioFactoryEngine';
import {
  getLoadedCapytorioRuntime,
  loadCapytorioRuntime,
} from '../engine/capytorio/CapytorioModuleLoader';
import { resolveCapytorioClipboardPointerAction } from '../engine/capytorio/CapytorioStateGuard';
import type { CapytorioDrawerTab, CapytorioHudProps } from './CapytorioHud';
import { createLiveTelemetryStore, TelemetryReadout } from './TelemetryReadout';
import { CapyWebGlContextBanner } from './hud/CapyWebGlContextBanner';

const LazyCapytorioHud = React.lazy(() =>
  import('./CapytorioHud').then((m) => ({ default: m.CapytorioHud }))
);
const LazyCapyAboutModal = React.lazy(() =>
  import('./CapyAboutModal').then((m) => ({ default: m.CapyAboutModal }))
);
const LazyCapyPrivacyModal = React.lazy(() =>
  import('./CapyAboutModal').then((m) => ({ default: m.CapyPrivacyModal }))
);
const LazyCapyTermsModal = React.lazy(() =>
  import('./CapyAboutModal').then((m) => ({ default: m.CapyTermsModal }))
);
const LazyCapyFeedbackModal = React.lazy(() =>
  import('./CapyFeedbackModal').then((m) => ({ default: m.CapyFeedbackModal }))
);
const LazyCapyTutorialBanner = React.lazy(() =>
  import('./CapyAboutModal').then((m) => ({ default: m.CapyTutorialBanner }))
);
const LazyCapyJsonConfigModal = React.lazy(() =>
  import('./CapyJsonConfigModal').then((m) => ({ default: m.CapyJsonConfigModal }))
);
const LazyCapySettingsModal = React.lazy(() =>
  import('./CapySettingsModal').then((m) => ({ default: m.CapySettingsModal }))
);
const LazyCapyDebugReportModal = React.lazy(() =>
  import('./CapyDebugReportModal').then((m) => ({ default: m.CapyDebugReportModal }))
);
const LazyCapyFirstRunSetupModal = React.lazy(() =>
  import('./CapyFirstRunSetupModal').then((m) => ({ default: m.CapyFirstRunSetupModal }))
);
const LazyCapyPerfLogPopover = React.lazy(() =>
  import('./CapyPerfLogPopover').then((m) => ({ default: m.CapyPerfLogPopover }))
);
const LazyCapyScaleAtlasPanel = React.lazy(() =>
  import('./CapyScaleAtlasAndOptics').then((m) => ({ default: m.CapyScaleAtlasPanel }))
);
const LazyCapyCosmicOpticsPanel = React.lazy(() =>
  import('./CapyScaleAtlasAndOptics').then((m) => ({ default: m.CapyCosmicOpticsPanel }))
);
const LazyCapyInfographicPanel = React.lazy(() =>
  import('./CapyInfographicPanel').then((m) => ({ default: m.CapyInfographicPanel }))
);
const LazyCapyForestMenuDrawer = React.lazy(() =>
  import('./CapyForestMenuDrawer').then((m) => ({ default: m.CapyForestMenuDrawer }))
);
import { formatAppVersionLabel } from '../config/appVersion';
import type {
  ActiveTutorialState,
  CapyTutorial,
} from '../engine/TutorialCatalog';
import {
  Volume2,
  VolumeX,
  Hammer,
  Plus,
  Minus,
  Trophy,
  ChevronDown,
  Settings as SettingsIcon,
  Info,
  Camera,
  X,
  Menu,
  Unlock,
  AlertTriangle,
  Crosshair,
  Code2,
  Rocket,
  Trees,
  Factory,
  Pause,
  Play,
  Copy,
  Activity,
  Shuffle,
  Maximize2,
  Minimize2,
  FastForward,
  Rewind,
  Orbit,
  MoveRight,
  HelpCircle,
} from 'lucide-react';

type DockTab = 'modes' | 'build' | 'dna' | 'upgrades' | 'wardrobe';

const PLAY_STYLE_LIST: Array<{
  id: PlayStyle;
  title: string;
  subtitle: string;
  compass: string;
  accentColor: string;
  description: string;
  requiredDna: number;
}> = [
  {
    id: 'sanctuary',
    title: 'Capy-Snake Sanctuary',
    subtitle: 'Dachshund Orange Trail & Island Hub',
    compass: 'Center (0, 0)',
    accentColor: '#38bdf8',
    description:
      'Collect oranges matching the 1 orange on your head to grow longer Capybara-Dachshund back segments (with each collected fruit sitting on your back), place structures, or explore all 4 outer islands.',
    requiredDna: 0,
  },
  {
    id: 'spore',
    title: 'Spore Lagoon',
    subtitle: 'Evolution Atoll & Plankton Hunt',
    compass: 'NW (-110, -110)',
    accentColor: '#34d399',
    description:
      'Navigate the North-West Lagoon, harvest plankton and DNA helixes, and splice 3D traits.',
    requiredDna: 5,
  },
  {
    id: 'capytorio',
    title: 'Capytorio Frontier',
    subtitle: '3D Factory Automation & Rocket Logistics',
    compass: 'Far East (+1200, 0)',
    accentColor: '#f59e0b',
    description:
      'Land on the untouched far hemisphere mineral plains, deploy mining drills, transport belts, inserters, foundries, assemblers, and science labs with infinite room to build.',
    requiredDna: 12,
  },
  {
    id: 'runner',
    title: 'Number Stampede',
    subtitle: 'Math Gate Herd Multiplier Highway',
    compass: 'SW (-110, +135)',
    accentColor: '#60a5fa',
    description:
      'Guide a 3D formation down the South-West causeway through arithmetic multiplier gates.',
    requiredDna: 20,
  },
  {
    id: 'fallguys',
    title: 'Yuzu Mountain',
    subtitle: 'Kinetic Obstacles & Ascent Course',
    compass: 'SE (+110, +135)',
    accentColor: '#a78bfa',
    description:
      'Ascend the South-East gauntlet past rotating kinetic pendulums and tilting platforms.',
    requiredDna: 30,
  },
];

interface TouchDragVisualState {
  active: boolean;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}

export const CapyGameView: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<PlayStyleManager | null>(null);

  const [stats, setStats] = useState<PlayerStats>(() =>
    ProgressionService.loadStats(true)
  );
  const [gameSettings, setGameSettings] = useState<CapyGameSettings>(() => {
    const loaded = ProgressionService.loadSettings();
    try {
      if (
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('advanced') === '1'
      ) {
        return { ...loaded, advancedMode: true };
      }
    } catch {
      // ignore URL parsing errors
    }
    return loaded;
  });
  const isAdvancedMode = Boolean(gameSettings.advancedMode);
  const gameSettingsRef = useRef<CapyGameSettings>(gameSettings);
  gameSettingsRef.current = gameSettings;
  const [isWebGlContextLost, setIsWebGlContextLost] = useState<boolean>(false);

  useEffect(() => {
    AudioService.applyMixerSettings({
      masterVolume: gameSettings.masterVolume,
      sfxVolume: gameSettings.sfxVolume,
      musicVolume: gameSettings.musicVolume,
      uiSoundsEnabled: gameSettings.uiSoundsEnabled,
    });
  }, [
    gameSettings.masterVolume,
    gameSettings.sfxVolume,
    gameSettings.musicVolume,
    gameSettings.uiSoundsEnabled,
  ]);
  const [isFreeMouselook, setIsFreeMouselook] = useState<boolean>(false);
  const isFreeMouselookRef = useRef<boolean>(false);
  isFreeMouselookRef.current = isFreeMouselook;
  const freeMouseFallbackLastRef = useRef<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const wasPointerLockedRef = useRef<boolean>(false);
  const [activeMode, setActiveMode] = useState<PlayStyle>(
    () => stats.selectedPlayStyle || 'sanctuary'
  );
  const [activeTab, setActiveTab] = useState<DockTab>('modes');
  const [capytorioSnap, setCapytorioSnap] = useState<CapytorioUiSnapshot | null>(null);
  const capytorioSnapRef = useRef<CapytorioUiSnapshot | null>(null);
  capytorioSnapRef.current = capytorioSnap;
  const [capytorioDrawerTab, setCapytorioDrawerTab] = useState<CapytorioDrawerTab>('none');
  const [capytorioPediaEntryId, setCapytorioPediaEntryId] = useState<string>('drill');
  const [capytorioPediaContextInfo, setCapytorioPediaContextInfo] =
    useState<CapytorioTileInspection | null>(null);
  const [capytorioSearchFocusNonce, setCapytorioSearchFocusNonce] = useState<number>(0);
  const [capytorioCraftGroup, setCapytorioCraftGroup] = useState<
    CapytorioRecipeGroup | 'machines' | 'lua'
  >('logistics');
  const [selectedCraftRecipeId, setSelectedCraftRecipeId] =
    useState<CapytorioRecipeId>('iron_gear');
  const [capytorioPointerHoverActive, setCapytorioPointerHoverActive] = useState<boolean>(false);
  const [capytorioClipboardMoveMode, setCapytorioClipboardMoveMode] = useState<boolean>(false);
  const capytorioClipboardMoveModeRef = useRef<boolean>(false);
  capytorioClipboardMoveModeRef.current = capytorioClipboardMoveMode;
  const isSpaceHeldRef = useRef<boolean>(false);
  const syncMoveInputRef = useRef<(() => void) | null>(null);
  const [isTopBarVisible, setIsTopBarVisible] = useState<boolean>(false);
  const pauseControllerRef = useRef<GamePauseController>(new GamePauseController());
  const [isGamePaused, setIsGamePaused] = useState<boolean>(false);
  const isGamePausedRef = useRef<boolean>(false);
  const isEmbeddedIframeRef = useRef<boolean>(detectEmbeddedIframe());
  const isWindowFocusedRef = useRef<boolean>(readDocumentFocusState().documentHasFocus);
  const isBackgroundSuspendedRef = useRef<boolean>(false);
  const syncBackgroundSuspensionRef = useRef<(() => void) | null>(null);
  const activePointerCaptureIdRef = useRef<number | null>(null);
  const suspendAnimLoopRef = useRef<(() => void) | null>(null);
  const resumeAnimLoopRef = useRef<(() => void) | null>(null);
  const [capytorioSelectionOverlay, setCapytorioSelectionOverlay] = useState<{
    active: boolean;
    mode: 'copy' | 'cut';
    shape: 'box' | 'lasso';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    points: Array<{ x: number; y: number }>;
  } | null>(null);
  const lastCapytorioMachineRef = useRef<string>('drill');
  const capytorioDrawerTabRef = useRef<CapytorioDrawerTab>('none');
  capytorioDrawerTabRef.current = capytorioDrawerTab;

  const openCapytorioPedia = useCallback(
    (entryId: string, contextInfo?: CapytorioTileInspection | null) => {
      setCapytorioPediaEntryId(entryId);
      if (contextInfo !== undefined) {
        setCapytorioPediaContextInfo(contextInfo);
      } else {
        setCapytorioPediaContextInfo(null);
      }
      setCapytorioDrawerTab('pedia');
    },
    []
  );

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [isInfographicExpanded, setIsInfographicExpanded] = useState<boolean>(false);
  const [allFeaturesUnlocked, setAllFeaturesUnlocked] = useState<boolean>(false);

  const [isMuted, setIsMuted] = useState<boolean>(() => AudioService.getMuted());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [activeTutorial, setActiveTutorial] = useState<ActiveTutorialState | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState<boolean>(false);
  const [isTermsOpen, setIsTermsOpen] = useState<boolean>(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [isBountiesOpen, setIsBountiesOpen] = useState<boolean>(false);
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState<boolean>(false);
  const [isFirstRunSetupOpen, setIsFirstRunSetupOpen] = useState<boolean>(() => {
    try {
      if (
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('open_setup') === '1'
      ) {
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  });
  const [firstRunTab, setFirstRunTab] = useState<'pilot' | 'vessel' | 'universe'>('pilot');
  const firstRunSetupOpenRef = useRef<boolean>(isFirstRunSetupOpen);
  firstRunSetupOpenRef.current = isFirstRunSetupOpen;
  const [proceduralConfig, setProceduralConfig] = useState<ProceduralGameConfig>(() =>
    loadSavedProceduralConfig()
  );
  const proceduralConfigRef = useRef<ProceduralGameConfig>(proceduralConfig);
  proceduralConfigRef.current = proceduralConfig;
  const [jsonDraftText, setJsonDraftText] = useState<string>(() =>
    JSON.stringify(loadSavedProceduralConfig(), null, 2)
  );
  const [jsonValidationError, setJsonValidationError] = useState<string | null>(null);
  const [jsonValidationWarnings, setJsonValidationWarnings] = useState<string[]>([]);
  const [jsonCopyLabel, setJsonCopyLabel] = useState<string>('Copy JSON');
  const [pwaStatus, setPwaStatus] = useState(() => ({
    installable: PwaService.isInstallable,
    standalone: PwaService.isStandalone,
    updateAvailable: PwaService.isUpdateAvailable,
  }));
  const [webglError, setWebglError] = useState<string | null>(null);
  const [placementGhost, setPlacementGhost] = useState<PlacementGhostStatus>({
    active: false,
    type: null,
    name: '',
    x: 0,
    z: 0,
    valid: false,
  });
  const [physicsTelemetry, setPhysicsTelemetry] = useState<PhysicsEngineTelemetry>({
    wasmInitialized: false,
    workerActive: false,
    transportMode: 'main_thread_wasm',
    rigidBodyCount: 12,
    staticColliderCount: 28,
    softBodyNodes: 12,
    fluidGridCells: 576,
    ccdEnabled: true,
    lastStepSubsteps: 1,
    stepDurationMs: 0.25,
    activeDistrict: 'sanctuary',
    worldX: 0,
    worldY: 0,
    worldZ: 4,
  });
  const [gpuTelemetry, setGpuTelemetry] = useState<GpuEngineTelemetry>({
    backendLabel: 'WebGL2 Hardware Accelerated GPU',
    gpuRenderer: 'WebGL2 GPU',
    isSoftwareGl: false,
    shadowCasterMode: 'sun',
    dayPhaseLabel: 'Daylight',
    timeOfDayHours: 9.5,
    contextLost: false,
    qualityPreset: 'high',
    postProcessingActive: true,
    visualFilterPreset: 'natural_pbr',
    visualFilterLabel: 'Natural PBR',
    toneMapping: 'agx',
    exposure: 1.12,
    textureFilter: 'trilinear_aniso',
    activeAnisotropy: 8,
    maxHardwareAnisotropy: 16,
    maxTextureSize: 4096,
    shadowQuality: 'pcf_soft',
    shadowMapSize: 2048,
    antiAliasing: 'msaa_fxaa',
    resolutionScale: 1.0,
    effectivePixelRatio: 1.0,
    msaaSamples: 0,
    bloomEnabled: true,
    ssaoEnabled: true,
    sharpenAmount: 0.26,
    drawCalls: 0,
    triangles: 0,
    texturesInVram: 0,
    geometriesInVram: 0,
    shaderPrograms: 0,
    registeredPbrTextures: 0,
    jsHeapUsedMB: null,
    jsHeapTotalMB: null,
    estimatedGeoVramMB: 0,
    estimatedTexVramMB: 0,
    estimatedRenderTargetVramMB: 0,
    estimatedTotalVramMB: 0,
    deviceMemoryGb: null,
    lowMemoryModeActive: false,
  });
  const [isPerfLogOpen, setIsPerfLogOpen] = useState<boolean>(false);
  const [isDebugReportOpen, setIsDebugReportOpen] = useState<boolean>(false);
  const [debugReportMode, setDebugReportMode] = useState<'summary' | 'analysis' | 'detail'>('summary');
  const [debugReportText, setDebugReportText] = useState<string>('');
  const [selectedSnippet, setSelectedSnippet] = useState<string>('');
  const [isReportCopied, setIsReportCopied] = useState<boolean>(false);
  const [isSaveJsonPasteOpen, setIsSaveJsonPasteOpen] = useState<boolean>(false);
  const [saveJsonDraft, setSaveJsonDraft] = useState<string>('');
  const [savePortabilityFeedback, setSavePortabilityFeedback] = useState<{
    tone: 'ok' | 'error';
    message: string;
  } | null>(null);
  const [perfLog, setPerfLog] = useState<PerformanceLogSnapshot>({
    liveFps: 60,
    avgFps: 60,
    minFps: 60,
    avgFrameMs: 16.7,
    p95FrameMs: 16.7,
    maxFrameMs: 16.7,
    droppedFramesCount: 0,
    alertCount: 0,
    activeAlert: false,
    lastAlertSummary: null,
    lock60FpsEnabled: true,
    fpsTarget: 60,
    maxFpsLimit: 60,
    autoOptimizerEnabled: true,
    activeGovernorTier: 0,
    disabledFeatures: [],
    entries: [],
  });

  const modalOpenRef = useRef<boolean>(false);
  modalOpenRef.current =
    isSettingsOpen ||
    isAboutOpen ||
    isJsonEditorOpen ||
    isDebugReportOpen ||
    isPrivacyOpen ||
    isTermsOpen ||
    isFeedbackOpen;
  const menuOpenRef = useRef<boolean>(false);
  menuOpenRef.current = isMenuOpen;
  const wasOverlayPausedRef = useRef<boolean>(false);
  const [luaCatalogInfo, setLuaCatalogInfo] = useState<CapytorioLuaCatalogInfo>({
    version: 0,
    sourceMode: 'bundled',
    recipeCount: 0,
    techCount: 0,
    itemCount: 0,
  });

  // Cosmic Genesis & Multi-Scale Universe State (starts directly in active Multiverse continuum unless skip_cosmic=1)
  const [cosmicStage, setCosmicStage] = useState<CosmicStage>('playing');
  const [selectedGalaxyIdx, setSelectedGalaxyIdx] = useState<number>(0);
  const [selectedStarIdx, setSelectedStarIdx] = useState<number>(0);
  const [selectedPlanetIdx, setSelectedPlanetIdx] = useState<number>(0);
  const [selectedLandingIdx, setSelectedLandingIdx] = useState<number>(0);
  const [selectedCapyHeroIdx, setSelectedCapyHeroIdx] = useState<number>(0);
  const [bigBangFlashOpacity, setBigBangFlashOpacity] = useState<number>(0);
  const [orbitTelemetry, setOrbitTelemetry] = useState<OrbitTelemetry | null>(null);
  const [selectedTimeScale, setSelectedTimeScale] = useState<OrbitTimeScaleId>('1_orbit_min');

  // Live Simulation Performance & Fractal Telemetry
  const [simStats, setSimStats] = useState<{
    activeStars: number;
    maxStars: number;
    totalGalaxies: number;
    fps: number;
  }>({
    activeStars: 36000,
    maxStars: 48000,
    totalGalaxies: 64,
    fps: 60,
  });

  const [cosmicSimInfo, setCosmicSimInfo] = useState<CosmicSimTelemetry>({
    epoch: 'inflation',
    epochLabel: 'Relativistic Inflation Fireball',
    cosmicAgeGyr: 0.0,
    gravityMultiplier: 1.0,
    fluidViscosity: 1.0,
    meanVelocityKmS: 1240,
    coalescencePercent: 0,
    activeHalos: 64,
    stellarColorMode: 'hr_blackbody',
    stellarColorModeLabel: 'H-R Blackbody (Mass & Age)',
    meanStellarMassSolar: 1.42,
    meanStellarAgeGyr: 4.6,
    meanTempKelvin: 6840,
    obStarPercent: 18,
    redGiantPercent: 14,
    totalSupernovae: 0,
    meanMetallicitySolar: 0.02,
    isFollowingTrackedStar: true,
    trackedStar: {
      starIndex: 0,
      catalogId: 'HD-00001-G1',
      hostGalaxyIndex: 0,
      hostGalaxyName: 'Andromeda Capy-Alpha',
      hostStarSystemIndex: 0,
      hostStarSystemName: 'Helios Yuzu-A',
      hostPlanetName: 'Terra Capybara',
      generation: 1,
      generationLabel: 'Gen 1 (Pop III Primordial)',
      evolutionaryStageLabel: 'Primordial Protostar',
      massSolar: 1.08,
      ageGyr: 0.1,
      tempKelvin: 5920,
      spectralClass: 'G2V',
      metallicityZ: 0.0001,
      supernovaAncestors: 0,
      hasProtoplanetaryDisk: false,
      elements: {
        hydrogenPct: 75.0,
        heliumPct: 25.0,
        carbonOxygenPct: 0.0,
        siliconMagnesiumPct: 0.0,
        ironHeavyPct: 0.0,
      },
      posX: 0,
      posY: 0,
      posZ: 0,
      velocityKmS: 420,
    },
  });

  const [isScaleAtlasOpen, setIsScaleAtlasOpen] = useState<boolean>(false);
  const [isStickerBookOpen, setIsStickerBookOpen] = useState<boolean>(false);
  const [isSpokenScaleCardsEnabled, setIsSpokenScaleCardsEnabled] = useState<boolean>(false);
  const discoveredSpecimensRef = useRef(stats.discoveredForestSpecimens ?? []);
  discoveredSpecimensRef.current = stats.discoveredForestSpecimens ?? [];
  const [isOpticsOpen, setIsOpticsOpen] = useState<boolean>(false);
  const [liveZoomThumbnails, setLiveZoomThumbnails] = useState<
    Partial<Record<UniverseScaleBandId, string>>
  >({});
  const [universeScale, setUniverseScale] = useState<UniverseScaleTelemetry>(() => {
    let skipCosmicInit = false;
    try {
      skipCosmicInit =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('skip_cosmic') === '1';
    } catch {
      skipCosmicInit = false;
    }
    return {
    active: !skipCosmicInit,
    logScaleMeters: 30.0,
    targetLogScaleMeters: 30.0,
    scaleFormatted: formatPhysicalScaleMeters(30.0),
    scientificLabel: '10^+30.0 m',
    bandId: 'multiverse',
    bandIndex: 0,
    totalBands: UNIVERSE_SCALE_BANDS.length,
    bandTitle: UNIVERSE_SCALE_BANDS[0].title,
    bandSubtitle: UNIVERSE_SCALE_BANDS[0].subtitle,
    domain: 'cosmic',
    quantumFocus: 'auto',
    autoZoomDir: 0,
    realityScaleGamma: 1.0,
    showObjectMarkers: false,
    markers: [],
    cosmicAgeGyr: 0.0,
    cruiseVelocityLogPerSec: 0,
    vesselMode: 'chase_pod',
    flightTrajectory: 'spiral',
    fineStructureInverse: CODATA_FINE_STRUCTURE_INVERSE,
    fineStructureAlpha: 1 / CODATA_FINE_STRUCTURE_INVERSE,
    galaxyMorphology: 'spiral',
    forestSpecimenId: 'leaf',
    forestSpecimenLabel: 'Leaf',
    };
  });

  // Mobile Touch Virtual Joystick visual state
  const [touchVisual, setTouchVisual] = useState<TouchDragVisualState>({
    active: false,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
  });

  const mobileZoomHoldTimerRef = useRef<number | null>(null);
  const mobileZoomRepeatRef = useRef<number | null>(null);
  const stopMobileZoomHold = () => {
    if (mobileZoomHoldTimerRef.current !== null) {
      window.clearTimeout(mobileZoomHoldTimerRef.current);
      mobileZoomHoldTimerRef.current = null;
    }
    if (mobileZoomRepeatRef.current !== null) {
      window.clearInterval(mobileZoomRepeatRef.current);
      mobileZoomRepeatRef.current = null;
    }
  };
  const stepMobileZoom = (delta: number) => {
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.adjustZoom(delta);
    setUniverseScale(mgr.getUniverseScaleTelemetry());
  };
  const startMobileZoomHold = (delta: number) => {
    stopMobileZoomHold();
    mobileZoomHoldTimerRef.current = window.setTimeout(() => {
      stepMobileZoom(delta);
      mobileZoomRepeatRef.current = window.setInterval(() => {
        stepMobileZoom(delta);
      }, 120);
    }, 260);
  };
  useEffect(() => stopMobileZoomHold, []);

  const pointerGestureRef = useRef<{
    pointerId: number | null;
    pointerType: 'mouse' | 'touch' | 'pen';
    button: number;
    originX: number;
    originY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    maxDist: number;
    pinchDist: number | null;
  }>({
    pointerId: null,
    pointerType: 'mouse',
    button: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    maxDist: 0,
    pinchDist: null,
  });

  const altTapCandidateRef = useRef<boolean>(false);

  const capytorioDragRef = useRef<{
    active: boolean;
    mode:
      | 'place'
      | 'demolish'
      | 'select_box'
      | 'select_lasso'
      | 'position_blueprint'
      | 'paste_tap_or_move'
      | 'clipboard_move'
      | 'open_pedia'
      | 'copy_settings'
      | 'paste_settings'
      | 'none';
    clipMode: 'copy' | 'cut';
    placedAny: boolean;
    batchStarted: boolean;
    prevGx: number | null;
    prevGz: number | null;
    placedCount: number;
    originNdcX: number;
    originNdcY: number;
    startGx: number;
    startGz: number;
    lastGx: number;
    lastGz: number;
    lassoGridPoints: Array<{ gx: number; gz: number }>;
    lassoScreenPoints: Array<{ x: number; y: number }>;
  }>({
    active: false,
    mode: 'none',
    clipMode: 'copy',
    placedAny: false,
    batchStarted: false,
    prevGx: null,
    prevGz: null,
    placedCount: 0,
    originNdcX: 0,
    originNdcY: 0,
    startGx: 0,
    startGz: 0,
    lastGx: 0,
    lastGz: 0,
    lassoGridPoints: [],
    lassoScreenPoints: [],
  });

  const [telemetryStore] = useState(() => createLiveTelemetryStore());
  const handleTriggerGroundPound = useCallback(() => {
    managerRef.current?.triggerGroundPound();
  }, []);
  const handleTriggerDash = useCallback(() => {
    managerRef.current?.triggerDash();
  }, []);

  const [snakeTelemetry, setSnakeTelemetry] = useState<CapySnakeTelemetry>({
    bodySegments: 1,
    bestSegments: 1,
    lengthMeters: 1.65,
    orangesCollected: 0,
    fruitsCarried: 1,
    mouthMaxRadiusCm: 40,
    groundRollingFruits: 0,
    pondFruits: 0,
    pondOverflowing: false,
    pondMessPercent: 0,
    headOrangeName: 'Tangerine',
    headOrangeCss: '#ff7a00',
    headOrangeHex: 0xff7a00,
    fps: 60,
    lodTier: 3,
    lodLabel: 'Ultra Bristle LOD',
    trianglesPerCapy: 6480,
    autoLodEnabled: true,
    timeOfDayHours: 9.5,
    dayPhaseLabel: 'Daylight',
    weather: 'clear',
    weatherLabel: 'Clear Skies',
    groundedFeet: 6,
    totalFeet: 6,
    isWalkingBackward: false,
    isStuckNoFooting: false,
    occludedObjectsFaded: 0,
  });

  const [statusBanner, setStatusBanner] = useState<string>(
    'Drag to navigate · Tap to jump · Open Menu for sector transit'
  );
  const [toastText, setToastText] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const clearHeldInputsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setToastText((prev) => (prev === msg ? null : prev));
    }, 2600);
  }, []);

  const setGamePaused = useCallback((paused: boolean) => {
    const controller = pauseControllerRef.current;
    const nowMs = performance.now();
    const changed = paused ? controller.pause(nowMs) : controller.resume(nowMs).resumed;
    if (!changed && isGamePausedRef.current === paused) return;

    isGamePausedRef.current = paused;
    setIsGamePaused(paused);

    if (paused) {
      clearHeldInputsRef.current?.();
      if (isFreeMouselookRef.current) {
        isFreeMouselookRef.current = false;
        setIsFreeMouselook(false);
        managerRef.current?.setMouselookLocked(false);
        if (typeof document !== 'undefined' && document.pointerLockElement === mountRef.current) {
          try {
            document.exitPointerLock?.();
          } catch {
            // Ignore pointer lock exit errors
          }
        }
      }
      suspendAnimLoopRef.current?.();
      managerRef.current?.setPaused(true);
    } else {
      if (syncBackgroundSuspensionRef.current) {
        syncBackgroundSuspensionRef.current();
      } else {
        managerRef.current?.setPaused(false);
        resumeAnimLoopRef.current?.();
      }
    }
  }, []);

  const toggleGamePause = useCallback(() => {
    setGamePaused(!isGamePausedRef.current);
  }, [setGamePaused]);

  type MemoizedCapytorioHudActions = Pick<
    CapytorioHudProps,
    | 'onToggleTopBar'
    | 'onOpenSettings'
    | 'onOpenAbout'
    | 'onSelectTool'
    | 'onMineTileAt'
    | 'onInspectTileAt'
    | 'onClearInspection'
    | 'onDemolishMachineAt'
    | 'onRotateDir'
    | 'onFlipBlueprintH'
    | 'onFlipBlueprintV'
    | 'onActivateLastBlueprint'
    | 'onSelectBlueprint'
    | 'onDeleteBlueprint'
    | 'onClearBlueprintLibrary'
    | 'onBuildSampleStarterMall'
    | 'onImportFactorioString'
    | 'onExportBlueprintString'
    | 'onExportFactoryString'
    | 'onExportBlueprintBookString'
    | 'onSetClipboardMode'
    | 'onClearClipboard'
    | 'onPlaceBlueprint'
    | 'onUndoCut'
    | 'onUndoAction'
    | 'onRedoAction'
    | 'onCollectAllOutputs'
    | 'onFeedScience'
    | 'onLaunchRocket'
    | 'onCraftMachine'
    | 'onCraftRecipe'
    | 'onCancelCraftQueueItem'
    | 'onSelectTech'
    | 'onFuelGenerator'
    | 'onInsertInputs'
    | 'onTakeOutputs'
    | 'onRotateMachineAt'
    | 'onSelectAssemblerRecipe'
    | 'onToggleAltMode'
    | 'onCopyEntitySettings'
    | 'onPasteEntitySettings'
    | 'onSetSplitterConfig'
    | 'onSetInserterConfig'
    | 'onSetChestSlotLimit'
    | 'onInstallModule'
    | 'onRemoveModule'
    | 'onRepairMachine'
  >;

  const capytorioHudActions = useMemo<MemoizedCapytorioHudActions>(
    () => ({
      onToggleTopBar: () => {
        AudioService.playCapytorioUiClick('tool');
        setIsTopBarVisible((prev) => !prev);
      },
      onOpenSettings: () => {
        AudioService.playCapytorioUiClick('tool');
        setIsSettingsOpen(true);
      },
      onOpenAbout: () => {
        AudioService.playCapytorioUiClick('tool');
        setIsAboutOpen(true);
      },
      onSelectTool: (toolId, promoteToRecent = false) => {
        if (toolId !== 'mine' && toolId !== 'demolish') {
          lastCapytorioMachineRef.current = toolId;
        }
        managerRef.current?.setCapytorioTool(toolId, promoteToRecent);
      },
      onMineTileAt: (gx, gz) => {
        const mined = managerRef.current?.mineCapytorioTileAt(gx, gz);
        if (mined) {
          const amt = mined === 'orange' ? 3 : 2;
          const rt = getLoadedCapytorioRuntime();
          const itemName = rt ? rt.getCapytorioItemMeta(mined).name : mined;
          showToast(
            mined === 'orange' ? `Harvested +${amt} ${itemName}` : `Mined +${amt} ${itemName}`
          );
        }
      },
      onInspectTileAt: (gx, gz) => {
        setCapytorioPointerHoverActive(false);
        managerRef.current?.inspectCapytorioTile(gx, gz);
      },
      onClearInspection: () => {
        managerRef.current?.clearCapytorioInspection();
      },
      onDemolishMachineAt: (gx, gz) => {
        const removed = managerRef.current?.demolishCapytorioTileAt(gx, gz);
        if (removed) {
          const rt = getLoadedCapytorioRuntime();
          const name = rt ? rt.CAPYTORIO_MACHINE_SPECS[removed].name : removed;
          showToast(`Deleted & refunded ${name}`);
        }
      },
      onRotateDir: () => {
        const snapBefore = managerRef.current?.getCapytorioSnapshot();
        const nextDir = managerRef.current?.rotateCapytorioDirection();
        if (snapBefore?.clipboard.toolState === 'paste') {
          showToast('Rotated blueprint 90°');
        } else if (snapBefore?.inspectedMachine && nextDir !== undefined) {
          const dirNames = ['North', 'East', 'South', 'West'];
          const rt = getLoadedCapytorioRuntime();
          const shortName = rt
            ? rt.CAPYTORIO_MACHINE_SPECS[snapBefore.inspectedMachine.type].shortName
            : snapBefore.inspectedMachine.type;
          showToast(`Rotated ${shortName}: ${dirNames[nextDir]}`);
        }
      },
      onFlipBlueprintH: () => {
        if (managerRef.current?.flipCapytorioBlueprintHorizontal()) {
          showToast('Flipped blueprint horizontally');
        }
      },
      onFlipBlueprintV: () => {
        if (managerRef.current?.flipCapytorioBlueprintVertical()) {
          showToast('Flipped blueprint vertically');
        }
      },
      onActivateLastBlueprint: () => {
        if (managerRef.current?.activateLastCapytorioBlueprint()) {
          const nextClip = managerRef.current.getCapytorioSnapshot()?.clipboard;
          showToast(`Paste ready (${nextClip?.count ?? 0}) — [R] Rotate · [H/V] Flip`);
        } else {
          showToast('No saved blueprints yet');
        }
      },
      onSelectBlueprint: (id) => {
        const picked = managerRef.current?.selectCapytorioBlueprint(id);
        if (picked) {
          showToast(`Loaded "${picked.label}" (${picked.entries.length}) — click to place`);
        }
      },
      onDeleteBlueprint: (id) => {
        if (managerRef.current?.deleteCapytorioBlueprint(id)) {
          showToast('Removed blueprint from library');
        }
      },
      onClearBlueprintLibrary: () => {
        managerRef.current?.clearCapytorioBlueprintLibrary();
        showToast('Cleared blueprint library');
      },
      onBuildSampleStarterMall: () => {
        const res = managerRef.current?.buildCapytorioSampleStarterMall();
        if (res?.message) {
          showToast(res.message);
        }
      },
      onImportFactorioString: async (raw) => {
        const mgr = managerRef.current;
        if (!mgr) {
          return {
            ok: false,
            kind: 'blueprint' as const,
            blueprints: [],
            importedEntityCount: 0,
            skippedTotalCount: 0,
            skippedEntities: [],
            addedIds: [],
            error: 'Factory engine is not ready yet.',
          };
        }
        const res = await mgr.importCapytorioFactorioBlueprintString(raw);
        if (res.ok) {
          const skipSuffix =
            res.skippedTotalCount > 0 ? ` (${res.skippedTotalCount} unsupported skipped)` : '';
          showToast(
            `Imported ${res.blueprints.length} blueprint${
              res.blueprints.length === 1 ? '' : 's'
            } (${res.importedEntityCount} entities)${skipSuffix}`
          );
        }
        return res;
      },
      onExportBlueprintString: async (id) => {
        const mgr = managerRef.current;
        if (!mgr) {
          return {
            ok: false,
            label: '',
            encoded: '',
            entityCount: 0,
            error: 'Factory engine is not ready yet.',
          };
        }
        return mgr.exportCapytorioBlueprintToFactorioString(id);
      },
      onExportFactoryString: async () => {
        const mgr = managerRef.current;
        if (!mgr) {
          return {
            ok: false,
            label: '',
            encoded: '',
            entityCount: 0,
            error: 'Factory engine is not ready yet.',
          };
        }
        return mgr.exportCapytorioFactoryToFactorioString();
      },
      onExportBlueprintBookString: async () => {
        const mgr = managerRef.current;
        if (!mgr) {
          return {
            ok: false,
            label: '',
            encoded: '',
            blueprintCount: 0,
            entityCount: 0,
            error: 'Factory engine is not ready yet.',
          };
        }
        return mgr.exportCapytorioBlueprintBookToFactorioString();
      },
      onSetClipboardMode: (mode, shape) => {
        setCapytorioClipboardMoveMode(false);
        managerRef.current?.setCapytorioClipboardMode(mode, shape);
      },
      onClearClipboard: () => {
        setCapytorioClipboardMoveMode(false);
        managerRef.current?.clearCapytorioClipboard();
        setCapytorioSelectionOverlay(null);
      },
      onPlaceBlueprint: () => {
        setCapytorioClipboardMoveMode(false);
        const res = managerRef.current?.placeCapytorioBlueprintAtPositionedGhost();
        if (res?.message) {
          showToast(res.message);
        }
      },
      onUndoCut: () => {
        const res = managerRef.current?.undoCapytorioCut();
        if (res && res.restoredCount > 0) {
          showToast(
            `Restored ${res.restoredCount} cut building${res.restoredCount === 1 ? '' : 's'}`
          );
        }
      },
      onUndoAction: () => {
        const res = managerRef.current?.undoCapytorioAction();
        if (res) {
          showToast(res.ok ? `Undid: ${res.label}` : 'Nothing to undo');
        }
      },
      onRedoAction: () => {
        const res = managerRef.current?.redoCapytorioAction();
        if (res) {
          showToast(res.ok ? `Redid: ${res.label}` : 'Nothing to redo');
        }
      },
      onCollectAllOutputs: () => {
        const got = managerRef.current?.collectAllCapytorioOutputs() ?? 0;
        showToast(
          got > 0
            ? `Collected ${got} items from machines, chests & floor`
            : 'No finished outputs or spilled items ready yet'
        );
      },
      onFeedScience: () => {
        const fed = managerRef.current?.feedScienceCapytorio() ?? 0;
        if (fed > 0) {
          showToast(`Delivered ${fed} Science Pack${fed === 1 ? '' : 's'} to Lab`);
        } else {
          showToast('Craft Science Packs & place a Science Lab first');
        }
      },
      onLaunchRocket: () => {
        const res = managerRef.current?.launchCapytorioRocket();
        if (res?.ok) {
          showToast(`ORBITAL YUZU ROCKET #${res.rocketLaunches} LAUNCHED!`);
        } else if (res?.reason) {
          showToast(res.reason);
        }
      },
      onCraftMachine: (mType, count = 1) => {
        const rt = getLoadedCapytorioRuntime();
        const spec = rt?.CAPYTORIO_MACHINE_SPECS[mType];
        const res = managerRef.current?.enqueueCapytorioMachineCraft(mType, count);
        if (res?.ok) {
          const name = spec?.name ?? mType;
          showToast(res.queuedCount > 1 ? `Queued ${res.queuedCount}× ${name}` : `Queued +1 ${name}`);
        } else {
          const costLabel =
            spec && rt
              ? Object.entries(spec.craftCost)
                  .map(([id, amt]) => `${amt} ${rt.getCapytorioItemMeta(id).shortName}`)
                  .join(' · ')
              : 'ingredients';
          showToast(res?.reason ?? `Need ${costLabel}`);
        }
      },
      onCraftRecipe: (recipeId, count, autoEquipResult = false) => {
        const rt = getLoadedCapytorioRuntime();
        const rec = rt?.CAPYTORIO_RECIPES.find((r) => r.id === recipeId);
        const res = managerRef.current?.enqueueCapytorioPocketCraft(recipeId, count);
        if (res?.ok && rec && rt) {
          const outMeta = rt.getCapytorioItemMeta(rec.result);
          if (autoEquipResult && rt.CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[rec.result]) {
            lastCapytorioMachineRef.current = rec.result;
            managerRef.current?.setCapytorioTool(rec.result, true);
          }
          showToast(
            res.queuedBatches > 1
              ? `Queued ${res.queuedBatches}× ${outMeta.name}`
              : `Queued +${rec.resultCount} ${outMeta.name}`
          );
        } else if (!autoEquipResult) {
          showToast(res?.reason ?? 'Missing required ingredients in Inventory');
        }
      },
      onCancelCraftQueueItem: (uid) => {
        const ok = managerRef.current?.cancelCapytorioCraftQueueItem(uid) ?? false;
        if (ok) {
          showToast('Cancelled craft · 100% ingredients refunded');
        }
      },
      onSelectTech: (techId) => {
        const rt = getLoadedCapytorioRuntime();
        const tech = rt?.TECH_BY_ID.get(techId);
        const ok = managerRef.current?.selectCapytorioTech(techId) ?? false;
        if (ok && tech) {
          showToast(`Researching: ${tech.name}`);
        } else if (
          tech &&
          capytorioSnapRef.current?.unlockedTechs.includes(techId) &&
          !tech.repeatable
        ) {
          showToast(`${tech.name} already researched`);
        } else {
          showToast('Unlock prerequisite research first');
        }
      },
      onFuelGenerator: (gx, gz) => {
        const loaded = managerRef.current?.fuelCapytorioGenerator(gx, gz, 5) ?? 0;
        showToast(
          loaded > 0
            ? `Loaded +${loaded} fuel into Generator (6.0 MW active)`
            : 'Need Coal, Sap, or Orange in pocket to fuel Generator'
        );
      },
      onInsertInputs: (gx, gz) => {
        const moved = managerRef.current?.insertInputsCapytorioMachine(gx, gz, 4) ?? 0;
        showToast(
          moved > 0
            ? `Loaded +${moved} inputs into machine`
            : 'No matching ingredients/science in pocket'
        );
      },
      onTakeOutputs: (gx, gz) => {
        const taken = managerRef.current?.takeOutputsCapytorioMachine(gx, gz) ?? 0;
        showToast(
          taken > 0 ? `Collected +${taken} items from machine` : 'Machine output buffer is empty'
        );
      },
      onRotateMachineAt: (gx, gz) => {
        managerRef.current?.rotateCapytorioMachineAt(gx, gz);
      },
      onSelectAssemblerRecipe: (recipeId) => {
        managerRef.current?.setCapytorioAssemblerRecipe(recipeId);
        const rt = getLoadedCapytorioRuntime();
        const rec = rt?.CAPYTORIO_RECIPES.find((r) => r.id === recipeId);
        showToast(`Assembler Recipe: ${rec?.name ?? recipeId}`);
      },
      onToggleAltMode: () => {
        const nextAlt = managerRef.current?.toggleCapytorioAltMode() ?? true;
        showToast(nextAlt ? 'Alt-Mode ON — 3D Machine Icons' : 'Alt-Mode OFF');
      },
      onCopyEntitySettings: (gx, gz) => {
        const res = managerRef.current?.copyCapytorioEntitySettingsAtTile(gx, gz);
        showToast(
          res?.ok
            ? `Copied settings: ${res.label ?? 'Entity'}`
            : res?.reason ?? 'No configurable settings to copy'
        );
      },
      onPasteEntitySettings: (gx, gz) => {
        const res = managerRef.current?.pasteCapytorioEntitySettingsAtTile(gx, gz);
        showToast(
          res?.ok
            ? `Pasted settings: ${res.label ?? 'Entity'}`
            : res?.reason ?? 'No matching copied settings to paste'
        );
      },
      onSetSplitterConfig: (gx, gz, config) => {
        managerRef.current?.setCapytorioSplitterConfig(gx, gz, config);
      },
      onSetInserterConfig: (gx, gz, config) => {
        managerRef.current?.setCapytorioInserterConfig(gx, gz, config);
      },
      onSetChestSlotLimit: (gx, gz, slotLimit) => {
        managerRef.current?.setCapytorioChestSlotLimit(gx, gz, slotLimit);
      },
      onInstallModule: (gx, gz, moduleItemId) => {
        const res = managerRef.current?.installCapytorioModule(gx, gz, moduleItemId);
        const rt = getLoadedCapytorioRuntime();
        const modName = rt?.getCapytorioItemMeta(moduleItemId).name ?? moduleItemId;
        showToast(
          res?.ok ? `Installed ${modName}` : res?.reason ?? `Could not install ${modName}`
        );
      },
      onRemoveModule: (gx, gz, slotIndex) => {
        const removed = managerRef.current?.removeCapytorioModule(gx, gz, slotIndex);
        if (removed) {
          const rt = getLoadedCapytorioRuntime();
          const modName = rt?.getCapytorioItemMeta(removed).name ?? removed;
          showToast(`Removed ${modName} to pocket`);
        }
      },
      onRepairMachine: (gx, gz) => {
        const res = managerRef.current?.repairCapytorioMachine(gx, gz);
        showToast(
          res?.ok
            ? `Repaired & tuned (+${Math.round(res.overclockSec)}s overclock)`
            : res?.reason ?? 'Need a Repair Pack in pocket'
        );
      },
    }),
    [showToast]
  );

  const setFreeMouselookActive = (enable: boolean) => {
    if (!enable) {
      isFreeMouselookRef.current = false;
      setIsFreeMouselook(false);
      freeMouseFallbackLastRef.current.x = null;
      freeMouseFallbackLastRef.current.y = null;
      wasPointerLockedRef.current = false;
      managerRef.current?.setMouselookLocked(false);
      if (typeof document !== 'undefined' && document.pointerLockElement === mountRef.current) {
        try {
          document.exitPointerLock?.();
        } catch {
          // Ignore pointer lock exit errors
        }
      }
      return;
    }

    if (gameSettingsRef.current.mouselookEnabled === false) {
      showToast('Enable Mouselook in Settings first');
      return;
    }

    const docFocus = readDocumentFocusState();
    if (
      !canRequestProgrammaticFocus({
        hasWindowFocus: isWindowFocusedRef.current,
        documentHasFocus: docFocus.documentHasFocus,
        visibilityState: docFocus.visibilityState,
      })
    ) {
      return;
    }

    freeMouseFallbackLastRef.current.x = null;
    freeMouseFallbackLastRef.current.y = null;
    isFreeMouselookRef.current = true;
    setIsFreeMouselook(true);
    managerRef.current?.setMouselookLocked(true);

    const el = mountRef.current;
    if (
      shouldUseNativePointerLock(isEmbeddedIframeRef.current) &&
      el &&
      typeof el.requestPointerLock === 'function'
    ) {
      try {
        const lockMaybePromise = el.requestPointerLock() as unknown as Promise<void> | undefined;
        if (lockMaybePromise && typeof lockMaybePromise.catch === 'function') {
          lockMaybePromise.catch(() => {
            // Sandboxed iframes may block native pointer lock; delta fallback remains active
          });
        }
      } catch {
        // Delta fallback remains active when native pointer lock is restricted
      }
    }
  };

  useEffect(() => {
    return PwaService.subscribe(() => {
      setPwaStatus({
        installable: PwaService.isInstallable,
        standalone: PwaService.isStandalone,
        updateAvailable: PwaService.isUpdateAvailable,
      });
    });
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  useEffect(() => {
    const anyOpen =
      isAboutOpen ||
      isSettingsOpen ||
      isPrivacyOpen ||
      isTermsOpen ||
      isFeedbackOpen ||
      isJsonEditorOpen ||
      isMenuOpen ||
      isScaleAtlasOpen ||
      isOpticsOpen ||
      isInfographicExpanded ||
      isPerfLogOpen;
    NativeBridge.setBackModalOpen(anyOpen, () => {
      if (isFeedbackOpen) setIsFeedbackOpen(false);
      else if (isTermsOpen) setIsTermsOpen(false);
      else if (isPrivacyOpen) setIsPrivacyOpen(false);
      else if (isAboutOpen) setIsAboutOpen(false);
      else if (isSettingsOpen) setIsSettingsOpen(false);
      else if (isJsonEditorOpen) setIsJsonEditorOpen(false);
      else if (isPerfLogOpen) setIsPerfLogOpen(false);
      else if (isOpticsOpen) setIsOpticsOpen(false);
      else if (isScaleAtlasOpen) setIsScaleAtlasOpen(false);
      else if (isInfographicExpanded) setIsInfographicExpanded(false);
      else if (isMenuOpen) setIsMenuOpen(false);
    });
    if (anyOpen && isFreeMouselookRef.current) {
      setFreeMouselookActive(false);
    }
    const overlayPausedNow =
      isMenuOpen ||
      isSettingsOpen ||
      isAboutOpen ||
      isJsonEditorOpen ||
      isDebugReportOpen ||
      isPrivacyOpen ||
      isTermsOpen ||
      isFeedbackOpen ||
      isFirstRunSetupOpen;
    if (overlayPausedNow) {
      clearHeldInputsRef.current?.();
    }
    if (wasOverlayPausedRef.current && !overlayPausedNow && managerRef.current?.isSoftwareGl) {
      managerRef.current.renderImmediateFrame(0.016);
    }
    wasOverlayPausedRef.current = overlayPausedNow;
  }, [
    isAboutOpen,
    isSettingsOpen,
    isPrivacyOpen,
    isTermsOpen,
    isFeedbackOpen,
    isJsonEditorOpen,
    isDebugReportOpen,
    isMenuOpen,
    isScaleAtlasOpen,
    isOpticsOpen,
    isInfographicExpanded,
    isPerfLogOpen,
    isFirstRunSetupOpen,
  ]);

  useEffect(() => {
    if (activeMode !== 'capytorio') return;
    let cancelled = false;
    let unsubscribeLua: (() => void) | null = null;
    void loadCapytorioRuntime().then((rt) => {
      if (cancelled) return;
      setLuaCatalogInfo(rt.getCapytorioLuaCatalogInfo());
      unsubscribeLua = rt.subscribeCapytorioLuaChanges((info) => {
        setLuaCatalogInfo(info);
      });
      if (managerRef.current) {
        void managerRef.current.ensureCapytorioLoaded().then(() => {
          if (cancelled || !managerRef.current) return;
          const snap = managerRef.current.getCapytorioSnapshot();
          if (snap) setCapytorioSnap(snap);
        });
      }
    });
    return () => {
      cancelled = true;
      unsubscribeLua?.();
    };
  }, [activeMode]);

  useEffect(() => {
    const containerEl = mountRef.current;
    if (!containerEl) return;

    const tuckStaticBootShell = () => {
      const staticShell = document.getElementById('static-boot-shell');
      if (!staticShell) return;
      staticShell.style.opacity = '0';
      staticShell.style.pointerEvents = 'none';
      staticShell.style.zIndex = '-1';
      staticShell.setAttribute('aria-hidden', 'true');
    };

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('simulate_webgl_error') === '1') {
        tuckStaticBootShell();
        setWebglError('Simulated WebGL 3D context initialization failure.');
        return;
      }
    } catch {
      // Ignore URL parsing issues
    }

    const initialStats = ProgressionService.loadStats(true);
    setStats(initialStats);
    const initialSettings = ProgressionService.loadSettings();

    let cancelled = false;
    let cleanupFn: (() => void) | null = null;

    const bootEngine = async () => {
      if (cancelled || !mountRef.current) return;

      let PlayStyleManagerCtor: typeof import('../engine/PlayStyleManager').PlayStyleManager;
      try {
        const mod = await import('../engine/PlayStyleManager');
        if (cancelled || !mountRef.current) return;
        PlayStyleManagerCtor = mod.PlayStyleManager;
      } catch (err) {
        if (!cancelled) {
          tuckStaticBootShell();
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to load the 3D engine module.';
          setWebglError(message);
        }
        return;
      }

      let manager: PlayStyleManager;
      try {
        manager = new PlayStyleManagerCtor(
          mountRef.current,
          initialStats,
          initialSettings,
          {
        onProgressEarned: (dnaDelta: number, mode: PlayStyle, score: number) => {
          setStats((prev: PlayerStats) => {
            return ProgressionService.recordProgress(
              prev,
              dnaDelta,
              mode,
              score,
              proceduralConfigRef.current.economy.coinRewardMultiplier
            );
          });
        },
        onBountyEvent: (eventType: BountyEventType, amount: number = 1) => {
          setStats((prev: PlayerStats) => {
            const res = ProgressionService.recordBountyProgress(prev, eventType, amount);
            if (res.stats === prev) return prev;
            if (res.completed.length > 0) {
              const first = res.completed[0];
              window.setTimeout(() => {
                managerRef.current?.updateStats(res.stats);
              }, 0);
              AudioService.playPrestigeFanfare();
              showToast(
                `Bounty Complete: ${first.title}! +${first.coinReward}c +${first.dnaReward} DNA`
              );
            }
            return res.stats;
          });
        },
        onTelemetryUpdate: (live: LiveModeTelemetry) => {
          telemetryStore.publish(live);
          setActiveMode((prev) => (prev === live.mode ? prev : live.mode));
        },
        onSnakeTelemetryUpdate: (snake: CapySnakeTelemetry) => {
          setSnakeTelemetry(snake);
        },
        onModeNotification: (msg: string) => {
          setStatusBanner(msg);
        },
        onPortalEntered: (targetMode: PlayStyle) => {
          setActiveMode(targetMode);
          const zone = ZONE_LOCATIONS[targetMode];
          showToast(`Sector Transit -> ${zone.title}`);
        },
        onPlacementGhostChange: (ghost: PlacementGhostStatus) => {
          setPlacementGhost(ghost);
        },
        onBuildingGhostConfirmed: (type, name, x, z, description) => {
          const costMult = proceduralConfigRef.current.economy.buildingCostMultiplier;
          setStats((prev: PlayerStats) => {
            if (prev.buildings.length >= 16) {
              showToast('Sector capacity reached (16/16 structures)');
              return prev;
            }
            const nextStats = ProgressionService.placeBuilding(
              prev,
              type,
              name,
              x,
              z,
              description,
              costMult
            );
            if (!nextStats) {
              const cost = ProgressionService.getBuildingCoinCost(type, costMult);
              showToast(`Requires ${cost}c to construct ${name}`);
              return prev;
            }
            AudioService.playCoin();
            window.setTimeout(() => {
              managerRef.current?.updateStats(nextStats);
              managerRef.current?.refreshSanctuaryBuildings();
            }, 0);
            showToast(`Constructed ${name} at (${x}, ${z})`);
            return nextStats;
          });
        },
        onCosmicStateChange: (
          stage: CosmicStage,
          gIdx: number,
          sIdx: number,
          pIdx: number,
          lIdx: number,
          hIdx: number,
          flashOpacity: number
        ) => {
          setCosmicStage(stage);
          if (stage === 'playing') {
            setIsInfographicExpanded(false);
            setIsOpticsOpen(false);
          }
          setSelectedGalaxyIdx(gIdx);
          setSelectedStarIdx(sIdx);
          setSelectedPlanetIdx(pIdx);
          setSelectedLandingIdx(lIdx);
          setSelectedCapyHeroIdx(hIdx);
          setBigBangFlashOpacity(flashOpacity);
          if (managerRef.current) {
            setSnakeTelemetry(managerRef.current.getCapySnakeTelemetry());
            if (managerRef.current.cosmicBuilder) {
              setSimStats(managerRef.current.cosmicBuilder.getSimulationStats());
              setCosmicSimInfo(managerRef.current.cosmicBuilder.getCosmicSimTelemetry());
            }
          }
        },
        onUniverseScaleChange: (scaleInfo: UniverseScaleTelemetry) => {
          setUniverseScale(scaleInfo);
        },
        onOrbitTelemetryChange: (telemetry: OrbitTelemetry) => {
          setOrbitTelemetry(telemetry);
        },
        onZoomThumbnailUpdated: (bandId: UniverseScaleBandId, dataUrl: string) => {
          setLiveZoomThumbnails((prev) =>
            prev[bandId] === dataUrl ? prev : { ...prev, [bandId]: dataUrl }
          );
        },
        onZoomThumbnailsReset: () => {
          setLiveZoomThumbnails({});
        },
        onForestSpecimenDiscovered: (specimenId, label) => {
          const alreadyHas = discoveredSpecimensRef.current.includes(specimenId);
          setStats((prev) => ProgressionService.discoverForestSpecimen(prev, specimenId).stats);
          if (!alreadyHas) {
            const nextCount = Math.min(
              FOREST_MICRO_SPECIMENS.length,
              discoveredSpecimensRef.current.length + 1
            );
            showToast(`Sticker Found: ${label} (${nextCount}/${FOREST_MICRO_SPECIMENS.length})`);
            AudioService.playScaleCardChime('microscopic');
          }
        },
        onCapytorioChange: (snap: CapytorioUiSnapshot) => {
          setCapytorioSnap(snap);
        },
        onCapytorioFactorySaved: (serialized) => {
          setStats((prev: PlayerStats) => {
            const next: PlayerStats = { ...prev, capytorioFactory: serialized };
            ProgressionService.scheduleSaveStats(next);
            return next;
          });
        },
      }
    );
      } catch (err) {
        tuckStaticBootShell();
        const message =
          err instanceof Error ? err.message : 'Unable to initialize 3D graphics context.';
        setWebglError(message);
        return;
      }

      if (cancelled) {
        manager.dispose();
        return;
      }

      managerRef.current = manager;
      (window as unknown as { __capyManager?: PlayStyleManager }).__capyManager = manager;
      manager.applyProceduralConfig(proceduralConfigRef.current, true);
      if (firstRunSetupOpenRef.current) {
        manager.setCruiseVelocity(0);
      }
      try {
        if (sessionStorage.getItem('capy_return_to_surface') === '1') {
          sessionStorage.removeItem('capy_return_to_surface');
          manager.setCosmicStage('playing');
        }
      } catch {
        // Ignore sessionStorage restrictions
      }
      if (manager.cosmicBuilder) {
        setSimStats(manager.cosmicBuilder.getSimulationStats());
        setCosmicSimInfo(manager.cosmicBuilder.getCosmicSimTelemetry());
      }
      setSnakeTelemetry(manager.getCapySnakeTelemetry());
      setUniverseScale(manager.getUniverseScaleTelemetry());
      setGpuTelemetry(manager.getGpuEngineTelemetry());
      setPerfLog(manager.getPerformanceLogSnapshot());
      setCapytorioSnap(manager.getCapytorioSnapshot());

      let animFrameId = 0;
      let lastTime = performance.now();
      let uiSyncAccum = 0;
      let paceTimerId: number | null = null;
      let activeFenceSync: WebGLSync | null = null;
      let modalWakeParity = 0;
      const glCtx =
        manager.isSoftwareGl &&
        typeof manager.renderer.getContext === 'function'
          ? (manager.renderer.getContext() as WebGL2RenderingContext | null)
          : null;

      const cancelScheduledFrame = () => {
        if (animFrameId !== 0) {
          window.cancelAnimationFrame(animFrameId);
          animFrameId = 0;
        }
        if (paceTimerId !== null) {
          window.clearTimeout(paceTimerId);
          paceTimerId = null;
        }
        if (activeFenceSync && glCtx && !glCtx.isContextLost()) {
          glCtx.deleteSync(activeFenceSync);
          activeFenceSync = null;
        }
      };

      const scheduleNextFrame = (didDrawGl: boolean) => {
        if (cancelled || isGamePausedRef.current || isBackgroundSuspendedRef.current) return;
        if (!manager.isSoftwareGl) {
          animFrameId = window.requestAnimationFrame(animate);
          return;
        }
        const delayMs =
          modalOpenRef.current || menuOpenRef.current
            ? 45
            : manager.cosmicStage === 'playing'
              ? 80
              : 45;
        if (
          didDrawGl &&
          glCtx &&
          typeof glCtx.fenceSync === 'function' &&
          !glCtx.isContextLost()
        ) {
          const sync = glCtx.fenceSync(glCtx.SYNC_GPU_COMMANDS_COMPLETE, 0);
          glCtx.flush();
          if (sync) {
            activeFenceSync = sync;
            const fenceStartMs = performance.now();
            const poll = () => {
              if (
                cancelled ||
                isGamePausedRef.current ||
                isBackgroundSuspendedRef.current ||
                glCtx.isContextLost()
              ) {
                if (activeFenceSync === sync && !glCtx.isContextLost()) {
                  glCtx.deleteSync(sync);
                }
                activeFenceSync = null;
                paceTimerId = null;
                return;
              }
              const state = glCtx.getSyncParameter(sync, glCtx.SYNC_STATUS);
              const timedOut = performance.now() - fenceStartMs >= 220;
              if (state === glCtx.UNSIGNALED && !timedOut) {
                paceTimerId = window.setTimeout(poll, 5);
              } else {
                glCtx.deleteSync(sync);
                if (activeFenceSync === sync) activeFenceSync = null;
                paceTimerId = window.setTimeout(() => {
                  paceTimerId = null;
                  if (!cancelled && !isGamePausedRef.current && !isBackgroundSuspendedRef.current) {
                    animFrameId = window.requestAnimationFrame(animate);
                  }
                }, delayMs);
              }
            };
            paceTimerId = window.setTimeout(poll, 5);
            return;
          }
        }
        paceTimerId = window.setTimeout(() => {
          paceTimerId = null;
          if (!cancelled && !isGamePausedRef.current && !isBackgroundSuspendedRef.current) {
            animFrameId = window.requestAnimationFrame(animate);
          }
        }, delayMs);
      };

      let firstFrameRendered = false;

      const syncBackgroundSuspension = (forceFocused: boolean = false) => {
        if (cancelled) return;
        const docFocus = readDocumentFocusState();
        const effectiveWindowFocused = forceFocused
          ? true
          : isWindowFocusedRef.current && docFocus.documentHasFocus;
        const suspendMode = resolveSuspensionMode({
          isManuallyPaused: isGamePausedRef.current,
          isDocumentHidden: docFocus.visibilityState === 'hidden',
          isEmbeddedIframe: isEmbeddedIframeRef.current,
          isWindowFocused: effectiveWindowFocused,
          firstFrameRendered,
        });
        const shouldSuspend = suspendMode !== 'none';
        isBackgroundSuspendedRef.current = shouldSuspend;
        if (shouldSuspend || isGamePausedRef.current) {
          cancelScheduledFrame();
          manager.setPaused(true, {
            releaseResources: suspendMode === 'deep' || isGamePausedRef.current,
          });
        } else {
          manager.setPaused(false);
          lastTime = performance.now();
          uiSyncAccum = 0;
          if (animFrameId === 0 && paceTimerId === null) {
            animFrameId = window.requestAnimationFrame(animate);
          }
        }
      };
      syncBackgroundSuspensionRef.current = () => syncBackgroundSuspension(false);

      const animate = (now: number) => {
        animFrameId = 0;
        if (cancelled || isGamePausedRef.current || isBackgroundSuspendedRef.current) return;
        if (manager.isSoftwareGl && (modalOpenRef.current || menuOpenRef.current)) {
          lastTime = now;
          modalWakeParity ^= 1;
          if (mountRef.current) {
            mountRef.current.style.opacity = modalWakeParity ? '0.999' : '1';
          }
          scheduleNextFrame(false);
          return;
        }
        if (
          manager.isSoftwareGl &&
          mountRef.current &&
          mountRef.current.style.opacity !== '' &&
          mountRef.current.style.opacity !== '1'
        ) {
          mountRef.current.style.opacity = '1';
        }

        // Hardware Max FPS Frame Limiter (prevents burning unneeded GPU cycles on 120/144Hz panels)
        const maxFpsCap = manager.performanceLog.maxFpsLimit;
        if (!manager.isSoftwareGl && maxFpsCap > 0) {
          const targetIntervalMs = 1000 / maxFpsCap;
          const elapsedMs = now - lastTime;
          if (elapsedMs < targetIntervalMs - 1.75) {
            scheduleNextFrame(false);
            return;
          }
        }

        const rawDtSec = Math.max(0.001, (now - lastTime) / 1000);
        const dt = Math.min(0.1, rawDtSec);
        lastTime = now;
        uiSyncAccum += dt;

        manager.tick(dt, rawDtSec);

        if (!firstFrameRendered) {
          firstFrameRendered = true;
          tuckStaticBootShell();
          syncBackgroundSuspension();
          if (isBackgroundSuspendedRef.current) {
            return;
          }
        }

        if (uiSyncAccum >= 0.35) {
          uiSyncAccum = 0;
          if (manager.cosmicStage !== 'playing') {
            if (manager.cosmicBuilder) {
              setSimStats(manager.cosmicBuilder.getSimulationStats());
              setCosmicSimInfo(manager.cosmicBuilder.getCosmicSimTelemetry());
            }
          } else {
            setPhysicsTelemetry(manager.getPhysicsTelemetry());
          }
          setGpuTelemetry(manager.getGpuEngineTelemetry());
          setSnakeTelemetry(manager.getCapySnakeTelemetry());
          setPerfLog(manager.getPerformanceLogSnapshot());
        }

        scheduleNextFrame(true);
      };

      suspendAnimLoopRef.current = cancelScheduledFrame;
      resumeAnimLoopRef.current = () => {
        if (cancelled || isGamePausedRef.current || isBackgroundSuspendedRef.current) return;
        lastTime = performance.now();
        uiSyncAccum = 0;
        if (animFrameId === 0 && paceTimerId === null) {
          animFrameId = window.requestAnimationFrame(animate);
        }
      };

      if (!isGamePausedRef.current) {
        animFrameId = window.requestAnimationFrame(animate);
      } else {
        manager.gpuEngine?.render();
        firstFrameRendered = true;
        tuckStaticBootShell();
        manager.setPaused(true);
      }

      const handleResize = () => {
        if (!mountRef.current || !managerRef.current) return;
        managerRef.current.handleResize(
          mountRef.current.clientWidth,
          mountRef.current.clientHeight
        );
      };

      const heldMoveKeys = new Set<string>();
      const syncMoveInput = () => {
        if (!managerRef.current) return;
        const up = heldMoveKeys.has('w') || heldMoveKeys.has('arrowup');
        const down = heldMoveKeys.has('s') || heldMoveKeys.has('arrowdown');
        const left = heldMoveKeys.has('a') || heldMoveKeys.has('arrowleft');
        const right = heldMoveKeys.has('d') || heldMoveKeys.has('arrowright');
        managerRef.current.moveInput.z = (down ? 1 : 0) - (up ? 1 : 0);
        managerRef.current.moveInput.x = (right ? 1 : 0) - (left ? 1 : 0);
      };
      syncMoveInputRef.current = syncMoveInput;
      const clearHeldInputs = () => {
        heldMoveKeys.clear();
        isSpaceHeldRef.current = false;
        if (managerRef.current) {
          managerRef.current.moveInput.x = 0;
          managerRef.current.moveInput.z = 0;
          managerRef.current.isJumping = false;
        }
      };
      clearHeldInputsRef.current = clearHeldInputs;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (!managerRef.current) return;
        const target = e.target;
        const docFocus = readDocumentFocusState();
        if (
          !canRequestProgrammaticFocus({
            hasWindowFocus: isWindowFocusedRef.current,
            documentHasFocus: docFocus.documentHasFocus,
            visibilityState: docFocus.visibilityState,
          })
        ) {
          return;
        }
        if (isEditableKeyboardTarget(target)) {
          if (e.key.toLowerCase() === 'escape' && target instanceof HTMLElement) {
            target.blur();
          }
          return;
        }
        if (
          !canProcessGameKeyboardEvent({
            hasWindowFocus: isWindowFocusedRef.current,
            documentHasFocus: docFocus.documentHasFocus,
            visibilityState: docFocus.visibilityState,
            target,
          })
        ) {
          return;
        }
        if (
          (e.ctrlKey || e.metaKey) &&
          !e.repeat &&
          e.key.toLowerCase() === 'f' &&
          managerRef.current.currentMode === 'capytorio' &&
          managerRef.current.cosmicStage === 'playing' &&
          !modalOpenRef.current &&
          !menuOpenRef.current &&
          !firstRunSetupOpenRef.current
        ) {
          e.preventDefault();
          const curDrawer = capytorioDrawerTabRef.current;
          if (curDrawer === 'none' || curDrawer === 'inspect') {
            setCapytorioDrawerTab('inventory');
          }
          setCapytorioSearchFocusNonce((n) => n + 1);
          return;
        }
        const key = e.key.toLowerCase();
        if (
          key === 'p' &&
          !e.repeat &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !modalOpenRef.current &&
          !firstRunSetupOpenRef.current
        ) {
          e.preventDefault();
          toggleGamePause();
          return;
        }
        if (isGamePausedRef.current) {
          if (key === 'escape' && !e.repeat) {
            e.preventDefault();
            setGamePaused(false);
          }
          return;
        }
        const overlayBlockingMovement =
          modalOpenRef.current || menuOpenRef.current || firstRunSetupOpenRef.current;
        const inCapytorioActive =
          managerRef.current.currentMode === 'capytorio' &&
          managerRef.current.cosmicStage === 'playing' &&
          !modalOpenRef.current &&
          !menuOpenRef.current &&
          !firstRunSetupOpenRef.current;
        if (!overlayBlockingMovement) {
          if (
            key === 'w' ||
            key === 'arrowup' ||
            key === 's' ||
            key === 'arrowdown' ||
            key === 'a' ||
            key === 'arrowleft' ||
            key === 'd' ||
            key === 'arrowright'
          ) {
            if (key.startsWith('arrow')) {
              e.preventDefault();
            }
            heldMoveKeys.add(key);
            syncMoveInput();
          }
          if (key === ' ') {
            isSpaceHeldRef.current = true;
            const clipActiveNow =
              inCapytorioActive &&
              managerRef.current.getCapytorioSnapshot()?.clipboard.toolState !== 'off';
            if (clipActiveNow) {
              e.preventDefault();
            } else {
              managerRef.current.isJumping = true;
            }
          }
        }

        if (e.key === 'Alt') {
          if (inCapytorioActive && !e.repeat && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            altTapCandidateRef.current = true;
          }
          return;
        }
        altTapCandidateRef.current = false;

        if ((e.key === 'Shift' || (key === 'q' && !inCapytorioActive)) && !e.repeat) {
          managerRef.current.triggerDash();
        }
        if ((key === 'c' || e.key === 'Control') && !e.repeat) {
          managerRef.current.triggerGroundPound();
        }
        if (
          key === 'm' &&
          !e.repeat &&
          !modalOpenRef.current &&
          !menuOpenRef.current &&
          !firstRunSetupOpenRef.current
        ) {
          setFreeMouselookActive(!isFreeMouselookRef.current);
        }
        if (inCapytorioActive) {
          const capyRt = getLoadedCapytorioRuntime();
          const curCapytorioSnap = managerRef.current.getCapytorioSnapshot();
          if (
            (e.ctrlKey || e.metaKey) &&
            !e.repeat &&
            (key === 'z' || key === 'y')
          ) {
            e.preventDefault();
            if (key === 'y' || e.shiftKey) {
              const res = managerRef.current.redoCapytorioAction();
              showToast(res.ok ? `Redid: ${res.label}` : 'Nothing to redo');
            } else {
              const res = managerRef.current.undoCapytorioAction();
              showToast(res.ok ? `Undid: ${res.label}` : 'Nothing to undo');
            }
            return;
          }
          if (
            key === 'enter' &&
            !e.repeat &&
            curCapytorioSnap?.clipboard.toolState === 'paste'
          ) {
            e.preventDefault();
            const res = managerRef.current.placeCapytorioBlueprintAtPositionedGhost();
            if (res.message) showToast(res.message);
            return;
          }
          if ((e.ctrlKey || e.metaKey) && !e.repeat && (key === 'c' || key === 'x' || key === 'v')) {
            e.preventDefault();
            const curClip = curCapytorioSnap?.clipboard;
            if (key === 'c') {
              managerRef.current.setCapytorioClipboardMode('select_copy', curClip?.selectionShape);
              showToast('Copy tool — drag Box/Lasso or click a building');
            } else if (key === 'x') {
              managerRef.current.setCapytorioClipboardMode('select_cut', curClip?.selectionShape);
              showToast('Cut tool — drag Box/Lasso or click a building to move');
            } else if (key === 'v') {
              const activated = managerRef.current.activateLastCapytorioBlueprint();
              if (activated) {
                const nextClip = managerRef.current.getCapytorioSnapshot()?.clipboard;
                showToast(
                  `Paste ready (${nextClip?.count ?? 0}) — position ghost then click Place [Enter]`
                );
              } else {
                showToast('Blueprint library empty — use Copy or Cut first');
              }
            }
            return;
          }
          if (key >= '0' && key <= '9') {
            const idx = key === '0' ? 9 : parseInt(key, 10) - 1;
            const snapTools = curCapytorioSnap?.recentTools ?? [];
            const machineTool = snapTools[idx] ?? capyRt?.CAPYTORIO_HOTBAR_ORDER[idx];
            if (machineTool) {
              lastCapytorioMachineRef.current = machineTool;
              managerRef.current.setCapytorioTool(machineTool);
            }
          } else if (key === 'r' && !e.repeat) {
            const snapBefore = curCapytorioSnap;
            const curClip = snapBefore?.clipboard;
            const nextDir = managerRef.current.rotateCapytorioDirection(e.shiftKey);
            if (curClip?.toolState === 'paste') {
              showToast(e.shiftKey ? 'Rotated blueprint 90° CCW' : 'Rotated blueprint 90° CW');
            } else if (snapBefore?.inspectedMachine) {
              const dirNames = ['North', 'East', 'South', 'West'];
              const mSpec = capyRt?.CAPYTORIO_MACHINE_SPECS[snapBefore.inspectedMachine.type];
              showToast(`Rotated ${mSpec?.shortName ?? snapBefore.inspectedMachine.type}: ${dirNames[nextDir]}`);
            } else {
              const dirNames = ['North', 'East', 'South', 'West'];
              showToast(`Orientation: ${dirNames[nextDir]}`);
            }
          } else if (key === 'x' && !e.repeat) {
            const cur = curCapytorioSnap?.selectedTool;
            managerRef.current.setCapytorioTool(
              cur === 'demolish' ? lastCapytorioMachineRef.current : 'demolish'
            );
          } else if (key === 'q' && !e.repeat) {
            const picked = managerRef.current.pipetteCapytorioAtCursor();
            if (picked.picked && picked.tool !== 'mine') {
              lastCapytorioMachineRef.current = picked.tool;
            }
            showToast(picked.label);
          } else if (key === 'h' && !e.repeat) {
            const curClip = curCapytorioSnap?.clipboard;
            if (curClip?.toolState === 'paste') {
              if (managerRef.current.flipCapytorioBlueprintHorizontal()) {
                showToast('Flipped blueprint horizontally');
              }
            } else {
              managerRef.current.returnToCapytorioBeacon();
              showToast('Returned to Survey Beacon (0, 0)');
            }
          } else if (key === 'b' && !e.repeat) {
            setCapytorioDrawerTab((prev) => (prev === 'blueprints' ? 'none' : 'blueprints'));
          } else if (key === 'f' && !e.repeat) {
            const insp = curCapytorioSnap?.inspectedMachine;
            const loadable =
              insp &&
              (insp.type === 'furnace' ||
                insp.type === 'assembler' ||
                insp.type === 'lab' ||
                insp.type === 'generator');
            if (loadable) {
              const moved = managerRef.current.insertInputsCapytorioMachine(insp.gx, insp.gz, 4);
              const shortName = capyRt?.CAPYTORIO_MACHINE_SPECS[insp.type].shortName ?? insp.type;
              showToast(
                moved > 0
                  ? `Loaded +${moved} inputs into ${shortName}`
                  : 'No matching pocket fuel/inputs available to load'
              );
            } else {
              const picked = managerRef.current.pickupCapytorioBeltOrFloorAtCursorOrHero();
              if (picked.total > 0) {
                const leadName = picked.items[0]
                  ? (capyRt?.getCapytorioItemMeta(picked.items[0].item).name ?? picked.items[0].item)
                  : 'items';
                showToast(
                  `Picked up +${picked.total} ${leadName}${picked.items.length > 1 ? '…' : ''} from ${picked.source === 'floor' ? 'ground' : 'belt'}`
                );
              } else {
                showToast('Point at a belt to pick up items or click a machine to load [F]');
              }
            }
          } else if (key === 'e' && !e.repeat) {
            const act = managerRef.current.mineOrPickupCapytorioAtCursorOrHero();
            if (act.kind === 'belt_pickup' || act.kind === 'floor_pickup') {
              const itemName = act.itemId
                ? (capyRt?.getCapytorioItemMeta(act.itemId).name ?? act.itemId)
                : 'items';
              showToast(
                `Picked up +${act.total} ${itemName} from ${act.kind === 'floor_pickup' ? 'ground' : 'belt'}`
              );
            } else if (act.itemId) {
              const itemName = capyRt?.getCapytorioItemMeta(act.itemId).name ?? act.itemId;
              showToast(
                act.itemId === 'orange'
                  ? `Harvested +${act.total} ${itemName} from Citrus Tree`
                  : `Mined +${act.total} ${itemName}`
              );
            } else if (managerRef.current.isHeroNearParkedUfo()) {
              managerRef.current.boardParkedUfoAndLaunch();
            } else {
              showToast('Point or stand near a belt item or ore seam [E]');
            }
          } else if (key === 'i' && !e.repeat) {
            setCapytorioDrawerTab((prev) => (prev === 'inventory' ? 'none' : 'inventory'));
          } else if (key === 'v' && !e.repeat) {
            const curClip = curCapytorioSnap?.clipboard;
            if (curClip?.toolState === 'paste') {
              if (managerRef.current.flipCapytorioBlueprintVertical()) {
                showToast('Flipped blueprint vertically');
              }
            } else {
              const nextCam = managerRef.current.toggleCapytorioCameraMode();
              updateGameSettings({ capytorioCameraMode: nextCam });
              showToast(
                nextCam === 'oblique'
                  ? 'Camera: Oblique Top-Down (Factorio View)'
                  : 'Camera: 3D Chase View'
              );
            }
          }
        } else if (
          key === 'e' &&
          !e.repeat &&
          managerRef.current.cosmicStage === 'playing' &&
          !managerRef.current.seamlessZoomActive &&
          !modalOpenRef.current &&
          !menuOpenRef.current &&
          !firstRunSetupOpenRef.current &&
          managerRef.current.isHeroNearParkedUfo()
        ) {
          e.preventDefault();
          managerRef.current.boardParkedUfoAndLaunch();
        }
        if (key === '=' || key === '+' || key === ']') {
          managerRef.current.adjustZoom(0.18);
        }
        if (key === '-' || key === '_' || key === '[') {
          managerRef.current.adjustZoom(-0.18);
        }
        if (key === 'escape') {
          setFreeMouselookActive(false);
          managerRef.current.cancelBuildingPlacementGhost();
          if (
            managerRef.current.getCapytorioSnapshot() &&
            managerRef.current.getCapytorioSnapshot()!.clipboard.toolState !== 'off'
          ) {
            setCapytorioClipboardMoveMode(false);
            managerRef.current.clearCapytorioClipboard();
            setCapytorioSelectionOverlay(null);
          }
          if (capytorioDrawerTabRef.current !== 'none') {
            setCapytorioDrawerTab('none');
          }
          menuOpenRef.current = false;
          modalOpenRef.current = false;
          setIsScaleAtlasOpen(false);
          setIsOpticsOpen(false);
          setIsInfographicExpanded(false);
          setIsPerfLogOpen(false);
          setIsPrivacyOpen(false);
          setIsTermsOpen(false);
          setIsFeedbackOpen(false);
          setIsAboutOpen(false);
          setIsSettingsOpen(false);
          setIsJsonEditorOpen(false);
          setIsMenuOpen(false);
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (!managerRef.current) return;
        if (e.key === 'Alt') {
          if (altTapCandidateRef.current) {
            altTapCandidateRef.current = false;
            const docFocus = readDocumentFocusState();
            const inCapytorioActive =
              isWindowFocusedRef.current &&
              docFocus.documentHasFocus &&
              docFocus.visibilityState === 'visible' &&
              managerRef.current.currentMode === 'capytorio' &&
              managerRef.current.cosmicStage === 'playing' &&
              !modalOpenRef.current &&
              !menuOpenRef.current &&
              !firstRunSetupOpenRef.current;
            if (inCapytorioActive) {
              const nextAlt = managerRef.current.toggleCapytorioAltMode();
              showToast(nextAlt ? 'Alt-Mode ON — 3D Machine Icons' : 'Alt-Mode OFF');
            }
          }
          return;
        }
        const key = e.key.toLowerCase();
        if (heldMoveKeys.delete(key)) {
          syncMoveInput();
        }
        if (key === ' ') {
          isSpaceHeldRef.current = false;
          managerRef.current.isJumping = false;
        }
      };

      const releaseCanvasPointerCapture = () => {
        const pid = activePointerCaptureIdRef.current;
        activePointerCaptureIdRef.current = null;
        if (pid === null) return;
        const el = mountRef.current;
        if (el && typeof el.releasePointerCapture === 'function') {
          try {
            if (!el.hasPointerCapture || el.hasPointerCapture(pid)) {
              el.releasePointerCapture(pid);
            }
          } catch {
            // Ignore pointer capture release errors
          }
        }
      };

      const handleWindowPointerDown = () => {
        altTapCandidateRef.current = false;
        const wasUnfocusedOrSuspended =
          !isWindowFocusedRef.current || isBackgroundSuspendedRef.current;
        isWindowFocusedRef.current = true;
        if (wasUnfocusedOrSuspended) {
          syncBackgroundSuspension(true);
        }
      };

      const handleWindowPointerUpOrCancel = (e: PointerEvent) => {
        const g = pointerGestureRef.current;
        if (g.pointerId !== e.pointerId) return;
        releaseCanvasPointerCapture();
        g.pointerId = null;
        if (capytorioDragRef.current.active) {
          capytorioDragRef.current.active = false;
          capytorioDragRef.current.mode = 'none';
          capytorioDragRef.current.placedAny = false;
          capytorioDragRef.current.batchStarted = false;
          setCapytorioSelectionOverlay(null);
        }
        if (syncMoveInputRef.current) {
          syncMoveInputRef.current();
        } else if (managerRef.current) {
          managerRef.current.moveInput.x = 0;
          managerRef.current.moveInput.z = 0;
          managerRef.current.pointerTargetX = null;
        }
        setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
      };

      const handleWindowMouseMove = (e: MouseEvent) => {
        if (
          !isWindowFocusedRef.current ||
          !readDocumentFocusState().documentHasFocus ||
          !isFreeMouselookRef.current ||
          !managerRef.current ||
          gameSettingsRef.current.mouselookEnabled === false ||
          modalOpenRef.current ||
          menuOpenRef.current ||
          firstRunSetupOpenRef.current
        ) {
          return;
        }
        if (typeof document !== 'undefined' && document.pointerLockElement === mountRef.current) {
          managerRef.current.applyMouseLookDelta(e.movementX || 0, e.movementY || 0);
          return;
        }
        const last = freeMouseFallbackLastRef.current;
        if (last.x === null || last.y === null) {
          last.x = e.clientX;
          last.y = e.clientY;
          return;
        }
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        last.x = e.clientX;
        last.y = e.clientY;
        if (dx !== 0 || dy !== 0) {
          managerRef.current.applyMouseLookDelta(dx, dy);
        }
      };

      const handlePointerLockChange = () => {
        if (typeof document === 'undefined') return;
        const lockedNow = document.pointerLockElement === mountRef.current;
        if (lockedNow) {
          wasPointerLockedRef.current = true;
          if (!isFreeMouselookRef.current) {
            isFreeMouselookRef.current = true;
            setIsFreeMouselook(true);
            managerRef.current?.setMouselookLocked(true);
          }
        } else if (wasPointerLockedRef.current) {
          wasPointerLockedRef.current = false;
          setFreeMouselookActive(false);
        }
      };

      const handleWindowFocus = () => {
        isWindowFocusedRef.current = true;
        syncBackgroundSuspension();
      };

      const handleWindowBlur = () => {
        isWindowFocusedRef.current = false;
        altTapCandidateRef.current = false;
        clearHeldInputs();
        stopMobileZoomHold();
        releaseCanvasPointerCapture();
        pointerGestureRef.current.pointerId = null;
        if (isFreeMouselookRef.current) {
          setFreeMouselookActive(false);
        }
        // Never call document.activeElement.blur() inside a window blur handler:
        // in Chromium cross-origin iframes (OOPIFs), calling .blur() during focus handoff
        // can bounce focus back into the iframe and prevent typing in the host page.
        syncBackgroundSuspension(false);
      };

      const handleDocumentVisibilityChange = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          isWindowFocusedRef.current = false;
          altTapCandidateRef.current = false;
          clearHeldInputs();
          stopMobileZoomHold();
          releaseCanvasPointerCapture();
          if (isFreeMouselookRef.current) {
            setFreeMouselookActive(false);
          }
        } else {
          isWindowFocusedRef.current = readDocumentFocusState().documentHasFocus;
        }
        syncBackgroundSuspension();
      };

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pointerGestureRef.current.pinchDist = Math.hypot(dx, dy);
        }
      };
      const handleTouchMove = (e: TouchEvent) => {
        if (
          e.touches.length === 2 &&
          pointerGestureRef.current.pinchDist !== null &&
          managerRef.current
        ) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const newDist = Math.hypot(dx, dy);
          const delta = (newDist - pointerGestureRef.current.pinchDist) * 0.004;
          managerRef.current.adjustZoom(delta);
          pointerGestureRef.current.pinchDist = newDist;
        }
      };
      const handleTouchEnd = () => {
        pointerGestureRef.current.pinchDist = null;
      };
      const handleWheel = (e: WheelEvent) => {
        if (!managerRef.current) return;
        e.preventDefault();
        const zoomDelta = -e.deltaY * 0.0012;
        managerRef.current.adjustZoom(zoomDelta);
        if (isBackgroundSuspendedRef.current && !isGamePausedRef.current) {
          managerRef.current.renderImmediateFrame(0.016);
        }
        setUniverseScale(managerRef.current.getUniverseScaleTelemetry());
      };

      const webglCanvasEl = containerEl.querySelector('canvas');
      const handleWebGlContextLost = (e: Event) => {
        e.preventDefault();
        if (!cancelled) {
          setIsWebGlContextLost(true);
        }
      };
      const handleWebGlContextRestored = () => {
        if (!cancelled) {
          setIsWebGlContextLost(false);
        }
      };
      webglCanvasEl?.addEventListener('webglcontextlost', handleWebGlContextLost, false);
      webglCanvasEl?.addEventListener('webglcontextrestored', handleWebGlContextRestored, false);

      containerEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      containerEl.addEventListener('touchmove', handleTouchMove, { passive: true });
      containerEl.addEventListener('touchend', handleTouchEnd, { passive: true });
      containerEl.addEventListener('wheel', handleWheel, { passive: false });

      window.addEventListener('resize', handleResize);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('pointerdown', handleWindowPointerDown, true);
      window.addEventListener('pointerup', handleWindowPointerUpOrCancel);
      window.addEventListener('pointercancel', handleWindowPointerUpOrCancel);
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('focus', handleWindowFocus);
      window.addEventListener('blur', handleWindowBlur);
      document.addEventListener('pointerlockchange', handlePointerLockChange);
      document.addEventListener('visibilitychange', handleDocumentVisibilityChange);

      cleanupFn = () => {
        clearHeldInputs();
        releaseCanvasPointerCapture();
        clearHeldInputsRef.current = null;
        syncMoveInputRef.current = null;
        syncBackgroundSuspensionRef.current = null;
        suspendAnimLoopRef.current = null;
        resumeAnimLoopRef.current = null;
        isBackgroundSuspendedRef.current = false;
        cancelScheduledFrame();
        webglCanvasEl?.removeEventListener('webglcontextlost', handleWebGlContextLost, false);
        webglCanvasEl?.removeEventListener('webglcontextrestored', handleWebGlContextRestored, false);
        containerEl.removeEventListener('touchstart', handleTouchStart);
        containerEl.removeEventListener('touchmove', handleTouchMove);
        containerEl.removeEventListener('touchend', handleTouchEnd);
        containerEl.removeEventListener('wheel', handleWheel);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('pointerdown', handleWindowPointerDown, true);
        window.removeEventListener('pointerup', handleWindowPointerUpOrCancel);
        window.removeEventListener('pointercancel', handleWindowPointerUpOrCancel);
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('blur', handleWindowBlur);
        document.removeEventListener('pointerlockchange', handlePointerLockChange);
        document.removeEventListener('visibilitychange', handleDocumentVisibilityChange);
        const winRef = window as unknown as { __capyManager?: PlayStyleManager };
        if (winRef.__capyManager === manager) {
          delete winRef.__capyManager;
        }
        manager.dispose();
        managerRef.current = null;
      };
    };

    let bootRaf = 0;
    bootRaf = window.requestAnimationFrame(() => {
      bootRaf = 0;
      if (!cancelled) {
        void bootEngine().catch((err) => {
          if (cancelled) return;
          tuckStaticBootShell();
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to initialize the 3D engine.';
          setWebglError(message);
        });
      }
    });

    return () => {
      cancelled = true;
      if (bootRaf !== 0) {
        window.cancelAnimationFrame(bootRaf);
        bootRaf = 0;
      }
      cleanupFn?.();
    };
  }, []);

  useEffect(() => {
    managerRef.current?.updateStats(stats);
  }, [stats]);

  useEffect(() => {
    managerRef.current?.setAllFeaturesUnlocked(allFeaturesUnlocked);
  }, [allFeaturesUnlocked]);

  useEffect(() => {
    if (capytorioSnap?.clipboard.toolState === 'off' && capytorioClipboardMoveMode) {
      setCapytorioClipboardMoveMode(false);
    }
  }, [capytorioSnap?.clipboard.toolState, capytorioClipboardMoveMode]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!managerRef.current) return;
    if (shouldCapturePointerOnCanvasDown(isEmbeddedIframeRef.current, e.pointerType)) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        activePointerCaptureIdRef.current = e.pointerId;
      } catch {
        // Ignore pointer capture errors on synthetic events
      }
    }

    const pointerType =
      e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pointerType : 'mouse';
    pointerGestureRef.current.pointerId = e.pointerId;
    pointerGestureRef.current.pointerType = pointerType;
    pointerGestureRef.current.button = e.button;
    pointerGestureRef.current.originX = e.clientX;
    pointerGestureRef.current.originY = e.clientY;
    pointerGestureRef.current.lastX = e.clientX;
    pointerGestureRef.current.lastY = e.clientY;
    pointerGestureRef.current.startTime = performance.now();
    pointerGestureRef.current.maxDist = 0;

    capytorioDragRef.current.active = false;
    capytorioDragRef.current.mode = 'none';
    capytorioDragRef.current.placedAny = false;
    capytorioDragRef.current.batchStarted = false;
    capytorioDragRef.current.prevGx = null;
    capytorioDragRef.current.prevGz = null;
    capytorioDragRef.current.placedCount = 0;
    capytorioDragRef.current.lassoGridPoints = [];
    capytorioDragRef.current.lassoScreenPoints = [];

    if (
      managerRef.current.currentMode === 'capytorio' &&
      managerRef.current.cosmicStage === 'playing' &&
      !managerRef.current.getUniverseScaleTelemetry().active
    ) {
      const rect = e.currentTarget.getBoundingClientRect();
      const ndcX = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
      const ndcY = rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;
      const cSnap = managerRef.current.getCapytorioSnapshot();
      if (!cSnap) return;
      const clipState = cSnap.clipboard.toolState;

      // Alt + Left-Click anywhere opens Capytoriopedia directly on the clicked tile/entity
      if (e.button === 0 && e.altKey) {
        altTapCandidateRef.current = false;
        e.preventDefault();
        capytorioDragRef.current.active = true;
        capytorioDragRef.current.mode = 'open_pedia';
        capytorioDragRef.current.originNdcX = ndcX;
        capytorioDragRef.current.originNdcY = ndcY;
        return;
      }

      // Factorio Shift + Right-Click copies entity settings; Shift + Left-Click pastes entity settings
      if (clipState === 'off' && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.button === 2) {
          e.preventDefault();
          capytorioDragRef.current.active = true;
          capytorioDragRef.current.mode = 'copy_settings';
          capytorioDragRef.current.originNdcX = ndcX;
          capytorioDragRef.current.originNdcY = ndcY;
          return;
        }
        if (e.button === 0) {
          e.preventDefault();
          capytorioDragRef.current.active = true;
          capytorioDragRef.current.mode = 'paste_settings';
          capytorioDragRef.current.originNdcX = ndcX;
          capytorioDragRef.current.originNdcY = ndcY;
          return;
        }
      }

      // Clipboard Copy/Cut/Paste gesture routing (allows moving via Move mode, Right/Middle drag,
      // Space+drag, or dragging outside the blueprint ghost footprint in Paste mode)
      if (clipState !== 'off') {
        const hasLockedPasteAnchor = cSnap.clipboard.pasteAnchor !== null;
        const hitPad = pointerType === 'mouse' ? 0 : 1;
        const canDragGhostDirectly = pointerType !== 'mouse' || hasLockedPasteAnchor;
        const hitInsideGhost =
          clipState === 'paste' && e.button === 0 && canDragGhostDirectly
            ? managerRef.current.isNdcInsideCapytorioBlueprint(ndcX, ndcY, hitPad)
            : false;
        const clipAction = resolveCapytorioClipboardPointerAction({
          clipState,
          selectionShape: cSnap.clipboard.selectionShape,
          button: e.button,
          clipboardMoveMode: capytorioClipboardMoveModeRef.current,
          isSpaceHeld: isSpaceHeldRef.current,
          hitInsideBlueprintGhost: hitInsideGhost,
          pointerType,
          hasLockedPasteAnchor,
        });

        if (clipAction === 'clipboard_move') {
          if (e.button === 1 || e.button === 2) {
            e.preventDefault();
          }
          capytorioDragRef.current.active = true;
          capytorioDragRef.current.mode = 'clipboard_move';
          capytorioDragRef.current.originNdcX = ndcX;
          capytorioDragRef.current.originNdcY = ndcY;
          if (pointerType !== 'mouse' || capytorioClipboardMoveModeRef.current) {
            setTouchVisual({
              active: true,
              originX: e.clientX,
              originY: e.clientY,
              currentX: e.clientX,
              currentY: e.clientY,
            });
          }
          return;
        }

        if (clipAction === 'position_blueprint') {
          capytorioDragRef.current.active = true;
          capytorioDragRef.current.mode = 'position_blueprint';
          capytorioDragRef.current.originNdcX = ndcX;
          capytorioDragRef.current.originNdcY = ndcY;
          managerRef.current.setCapytorioBlueprintAnchorFromNdc(ndcX, ndcY);
          return;
        }

        if (clipAction === 'paste_tap_or_move') {
          capytorioDragRef.current.active = true;
          capytorioDragRef.current.mode = 'paste_tap_or_move';
          capytorioDragRef.current.originNdcX = ndcX;
          capytorioDragRef.current.originNdcY = ndcY;
          return;
        }

        if (clipAction === 'select_box' || clipAction === 'select_lasso') {
          const hit = managerRef.current.raycastCapytorioGridFloat(ndcX, ndcY);
          if (hit) {
            const clipMode: 'copy' | 'cut' = clipState === 'select_cut' ? 'cut' : 'copy';
            capytorioDragRef.current.active = true;
            capytorioDragRef.current.mode = clipAction;
            capytorioDragRef.current.clipMode = clipMode;
            capytorioDragRef.current.originNdcX = ndcX;
            capytorioDragRef.current.originNdcY = ndcY;
            capytorioDragRef.current.startGx = hit.gx;
            capytorioDragRef.current.startGz = hit.gz;
            capytorioDragRef.current.lastGx = hit.gx;
            capytorioDragRef.current.lastGz = hit.gz;
            capytorioDragRef.current.lassoGridPoints = [{ gx: hit.fGx, gz: hit.fGz }];
            capytorioDragRef.current.lassoScreenPoints = [{ x: e.clientX, y: e.clientY }];
            return;
          }
        }
      }

      if (
        pointerType === 'mouse' &&
        managerRef.current.getCapytorioCameraMode() === 'oblique' &&
        clipState === 'off'
      ) {
        const curTool = cSnap.selectedTool;
        if (e.button === 2 || curTool === 'demolish') {
          capytorioDragRef.current.active = true;
          capytorioDragRef.current.mode = 'demolish';
          capytorioDragRef.current.originNdcX = ndcX;
          capytorioDragRef.current.originNdcY = ndcY;
          return;
        }
        if (e.button === 0 && curTool !== 'mine') {
          capytorioDragRef.current.active = true;
          capytorioDragRef.current.mode = 'place';
          capytorioDragRef.current.originNdcX = ndcX;
          capytorioDragRef.current.originNdcY = ndcY;
          return;
        }
      }
    }

    if (managerRef.current.getPlacementGhostState().active) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        managerRef.current.updateBuildingPlacementGhostFromNdc(ndcX, ndcY);
      }
      return;
    }

    const useMouseDragMouselook =
      pointerType === 'mouse' && gameSettingsRef.current.mouselookEnabled !== false;
    if (!useMouseDragMouselook) {
      setTouchVisual({
        active: true,
        originX: e.clientX,
        originY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (managerRef.current && managerRef.current.getPlacementGhostState().active) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        managerRef.current.updateBuildingPlacementGhostFromNdc(ndcX, ndcY);
      }
      if (pointerGestureRef.current.pointerId !== e.pointerId) return;
      const gGhost = pointerGestureRef.current;
      const dGhost = Math.hypot(e.clientX - gGhost.originX, e.clientY - gGhost.originY);
      if (dGhost > gGhost.maxDist) gGhost.maxDist = dGhost;
      return;
    }

    if (
      managerRef.current &&
      managerRef.current.currentMode === 'capytorio' &&
      managerRef.current.cosmicStage === 'playing' &&
      !managerRef.current.getUniverseScaleTelemetry().active
    ) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        if (e.pointerType === 'mouse') {
          setCapytorioPointerHoverActive((prev) => (prev ? prev : true));
        }
        managerRef.current.updateCapytorioHoverFromNdc(ndcX, ndcY);

        const cDrag = capytorioDragRef.current;
        const g = pointerGestureRef.current;
        if (cDrag.active && g.pointerId === e.pointerId) {
          const dist = Math.hypot(e.clientX - g.originX, e.clientY - g.originY);
          if (dist > g.maxDist) g.maxDist = dist;

          if (cDrag.mode === 'clipboard_move' || cDrag.mode === 'paste_tap_or_move') {
            const dxMove = e.clientX - g.originX;
            const dyMove = e.clientY - g.originY;
            const moveThreshold = cDrag.mode === 'paste_tap_or_move' ? 10 : 6;
            if (dist >= moveThreshold) {
              managerRef.current.unlockCapytorioBlueprintAnchor();
              const maxJoystickRadius = 56;
              const clampedX = Math.max(-1, Math.min(1, dxMove / maxJoystickRadius));
              const clampedZ = Math.max(-1, Math.min(1, dyMove / maxJoystickRadius));
              managerRef.current.moveInput.x = clampedX;
              managerRef.current.moveInput.z = clampedZ;

              const clampedVisDist = Math.min(dist, maxJoystickRadius);
              const angle = Math.atan2(dyMove, dxMove);
              setTouchVisual({
                active: true,
                originX: g.originX,
                originY: g.originY,
                currentX: g.originX + Math.cos(angle) * clampedVisDist,
                currentY: g.originY + Math.sin(angle) * clampedVisDist,
              });
            }
            return;
          }

          if (cDrag.mode === 'position_blueprint') {
            managerRef.current.setCapytorioBlueprintAnchorFromNdc(ndcX, ndcY);
            return;
          }

          if (cDrag.mode === 'select_box' || cDrag.mode === 'select_lasso') {
            if (dist >= 8) {
              const hit = managerRef.current.raycastCapytorioGridFloat(ndcX, ndcY);
              if (cDrag.mode === 'select_box') {
                if (hit) {
                  cDrag.lastGx = hit.gx;
                  cDrag.lastGz = hit.gz;
                  managerRef.current.previewCapytorioSelectionBox(
                    cDrag.startGx,
                    cDrag.startGz,
                    hit.gx,
                    hit.gz
                  );
                }
                setCapytorioSelectionOverlay({
                  active: true,
                  mode: cDrag.clipMode,
                  shape: 'box',
                  startX: g.originX,
                  startY: g.originY,
                  currentX: e.clientX,
                  currentY: e.clientY,
                  points: [],
                });
              } else {
                const prevScreen =
                  cDrag.lassoScreenPoints[cDrag.lassoScreenPoints.length - 1];
                if (
                  !prevScreen ||
                  Math.hypot(e.clientX - prevScreen.x, e.clientY - prevScreen.y) >= 8
                ) {
                  cDrag.lassoScreenPoints.push({ x: e.clientX, y: e.clientY });
                  if (hit) {
                    cDrag.lassoGridPoints.push({ gx: hit.fGx, gz: hit.fGz });
                    managerRef.current.previewCapytorioSelectionLasso(cDrag.lassoGridPoints);
                  }
                  setCapytorioSelectionOverlay({
                    active: true,
                    mode: cDrag.clipMode,
                    shape: 'lasso',
                    startX: g.originX,
                    startY: g.originY,
                    currentX: e.clientX,
                    currentY: e.clientY,
                    points: cDrag.lassoScreenPoints.slice(),
                  });
                }
              }
            }
            return;
          }

          if (dist >= 12) {
            if (cDrag.mode === 'demolish') {
              if (!cDrag.batchStarted) {
                managerRef.current.beginCapytorioHistoryBatch('Drag demolish');
                cDrag.batchStarted = true;
              }
              if (!cDrag.placedAny) {
                if (managerRef.current.handleCapytorioDragDemolish(cDrag.originNdcX, cDrag.originNdcY)) {
                  cDrag.placedAny = true;
                  cDrag.placedCount++;
                }
              }
              if (managerRef.current.handleCapytorioDragDemolish(ndcX, ndcY)) {
                cDrag.placedAny = true;
                cDrag.placedCount++;
              }
            } else if (cDrag.mode === 'place') {
              if (!cDrag.batchStarted) {
                managerRef.current.beginCapytorioHistoryBatch('Drag build');
                cDrag.batchStarted = true;
              }
              if (!cDrag.placedAny) {
                const startRes = managerRef.current.handleCapytorioDragPaint(
                  cDrag.originNdcX,
                  cDrag.originNdcY,
                  null,
                  null,
                  false
                );
                if (startRes.placed) {
                  cDrag.placedAny = true;
                  cDrag.prevGx = startRes.gx;
                  cDrag.prevGz = startRes.gz;
                  cDrag.placedCount++;
                } else {
                  const hoverSnap = managerRef.current.getCapytorioSnapshot()?.hoveredTile;
                  if (hoverSnap) {
                    cDrag.prevGx = hoverSnap.gx;
                    cDrag.prevGz = hoverSnap.gz;
                  }
                }
              }
              const stepRes = managerRef.current.handleCapytorioDragPaint(
                ndcX,
                ndcY,
                cDrag.prevGx,
                cDrag.prevGz,
                cDrag.placedCount > 0 && cDrag.placedAny
              );
              if (stepRes.placed) {
                cDrag.placedAny = true;
                cDrag.prevGx = stepRes.gx;
                cDrag.prevGz = stepRes.gz;
                cDrag.placedCount++;
              }
            }
          }
          return;
        }
      }
    }

    const g = pointerGestureRef.current;
    if (g.pointerId !== e.pointerId || !managerRef.current) return;

    const stepDx = e.clientX - g.lastX;
    const stepDy = e.clientY - g.lastY;
    g.lastX = e.clientX;
    g.lastY = e.clientY;

    const dx = e.clientX - g.originX;
    const dy = e.clientY - g.originY;
    const dist = Math.hypot(dx, dy);
    if (dist > g.maxDist) {
      g.maxDist = dist;
    }

    if (g.pointerType === 'mouse' && gameSettingsRef.current.mouselookEnabled !== false) {
      if (!isFreeMouselookRef.current && (stepDx !== 0 || stepDy !== 0)) {
        managerRef.current.applyMouseLookDelta(stepDx, stepDy);
      }
      return;
    }

    const maxJoystickRadius = 56;
    const clampedX = Math.max(-1, Math.min(1, dx / maxJoystickRadius));
    const clampedZ = Math.max(-1, Math.min(1, dy / maxJoystickRadius));

    if (dist > 6) {
      managerRef.current.moveInput.x = clampedX;
      managerRef.current.moveInput.z = clampedZ;

      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0) {
        const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        managerRef.current.pointerTargetX = Math.max(-1, Math.min(1, normX));
      }
    }

    const clampedVisDist = Math.min(dist, maxJoystickRadius);
    const angle = Math.atan2(dy, dx);
    setTouchVisual((prev) =>
      prev.active
        ? {
            ...prev,
            currentX: prev.originX + Math.cos(angle) * clampedVisDist,
            currentY: prev.originY + Math.sin(angle) * clampedVisDist,
          }
        : prev
    );
  };

  const handleCanvasPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = pointerGestureRef.current;
    if (g.pointerId !== e.pointerId) return;
    if (activePointerCaptureIdRef.current === e.pointerId) {
      activePointerCaptureIdRef.current = null;
    }
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore pointer capture release errors
    }

    const wasCapytorioPress = capytorioDragRef.current.active;
    const wasDragPaint = wasCapytorioPress && capytorioDragRef.current.placedAny;
    const wasBatchStarted = capytorioDragRef.current.batchStarted;
    const dragCount = capytorioDragRef.current.placedCount;
    const dragMode = capytorioDragRef.current.mode;
    const selStartGx = capytorioDragRef.current.startGx;
    const selStartGz = capytorioDragRef.current.startGz;
    const selLastGx = capytorioDragRef.current.lastGx;
    const selLastGz = capytorioDragRef.current.lastGz;
    const selLassoPoints = capytorioDragRef.current.lassoGridPoints.slice();

    capytorioDragRef.current.active = false;
    capytorioDragRef.current.mode = 'none';
    capytorioDragRef.current.placedAny = false;
    capytorioDragRef.current.batchStarted = false;
    capytorioDragRef.current.prevGx = null;
    capytorioDragRef.current.prevGz = null;
    capytorioDragRef.current.placedCount = 0;
    capytorioDragRef.current.lassoGridPoints = [];
    capytorioDragRef.current.lassoScreenPoints = [];
    setCapytorioSelectionOverlay(null);

    if (wasBatchStarted && managerRef.current) {
      managerRef.current.commitCapytorioHistoryBatch(
        dragMode === 'demolish'
          ? `Demolish ${dragCount} building${dragCount === 1 ? '' : 's'}`
          : `Build ${dragCount} building${dragCount === 1 ? '' : 's'}`
      );
    }

    if (wasCapytorioPress && dragMode === 'open_pedia' && managerRef.current) {
      g.pointerId = null;
      const rect = e.currentTarget.getBoundingClientRect();
      const ndcX = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
      const ndcY = rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;
      const res = managerRef.current.openCapytorioPediaAtNdc(ndcX, ndcY);
      if (res) {
        openCapytorioPedia(res.pediaId, res.info);
      }
      setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
      return;
    }

    if (wasCapytorioPress && dragMode === 'copy_settings' && managerRef.current) {
      g.pointerId = null;
      const rect = e.currentTarget.getBoundingClientRect();
      const ndcX = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
      const ndcY = rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;
      const res = managerRef.current.copyCapytorioEntitySettingsAtNdc(ndcX, ndcY);
      showToast(
        res.ok
          ? `Copied settings: ${res.label ?? 'Entity'}`
          : res.reason ?? 'Click a configurable machine to copy settings'
      );
      setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
      return;
    }

    if (wasCapytorioPress && dragMode === 'paste_settings' && managerRef.current) {
      g.pointerId = null;
      const rect = e.currentTarget.getBoundingClientRect();
      const ndcX = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
      const ndcY = rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;
      const res = managerRef.current.pasteCapytorioEntitySettingsAtNdc(ndcX, ndcY);
      showToast(
        res.ok
          ? `Pasted settings: ${res.label ?? 'Entity'}`
          : res.reason ?? 'No matching copied settings to paste'
      );
      setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
      return;
    }

    if (
      wasCapytorioPress &&
      (dragMode === 'clipboard_move' || dragMode === 'paste_tap_or_move') &&
      managerRef.current
    ) {
      const wasQuickTap = g.maxDist < 10;
      g.pointerId = null;
      if (syncMoveInputRef.current) {
        syncMoveInputRef.current();
      } else {
        managerRef.current.moveInput.x = 0;
        managerRef.current.moveInput.z = 0;
      }
      setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
      if (dragMode === 'paste_tap_or_move' && wasQuickTap) {
        const rect = e.currentTarget.getBoundingClientRect();
        const ndcX = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
        const ndcY = rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;
        managerRef.current.setCapytorioBlueprintAnchorFromNdc(ndcX, ndcY);
      }
      return;
    }

    if (wasCapytorioPress && dragMode === 'position_blueprint' && managerRef.current) {
      g.pointerId = null;
      const rect = e.currentTarget.getBoundingClientRect();
      const ndcX = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
      const ndcY = rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;
      managerRef.current.setCapytorioBlueprintAnchorFromNdc(ndcX, ndcY);
      setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
      return;
    }

    if (
      wasCapytorioPress &&
      (dragMode === 'select_box' || dragMode === 'select_lasso') &&
      g.maxDist >= 10 &&
      managerRef.current
    ) {
      g.pointerId = null;
      const res =
        dragMode === 'select_box'
          ? managerRef.current.commitCapytorioSelectionBox(
              selStartGx,
              selStartGz,
              selLastGx,
              selLastGz
            )
          : managerRef.current.commitCapytorioSelectionLasso(selLassoPoints);
      if (res.count > 0) {
        showToast(
          res.mode === 'cut'
            ? `Cut ${res.count} building${res.count === 1 ? '' : 's'} — position ghost & tap Place`
            : `Copied ${res.count} building${res.count === 1 ? '' : 's'} — position ghost & tap Place`
        );
      } else {
        showToast('No buildings inside selection');
      }
      setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
      return;
    }

    const elapsed = performance.now() - g.startTime;
    const tapMaxMs = wasCapytorioPress ? 1200 : 350;
    const wasQuickTap = !wasDragPaint && g.maxDist < 14 && elapsed < tapMaxMs;
    const wasMouseDragMouselook =
      g.pointerType === 'mouse' && gameSettingsRef.current.mouselookEnabled !== false;
    const releasedButton = g.button;

    g.pointerId = null;
    if (wasDragPaint) {
      if (dragCount > 1) {
        showToast(
          dragMode === 'demolish'
            ? `Demolished ${dragCount} structures (100% refunded)`
            : `Drag-placed ${dragCount} structures cleanly`
        );
      }
      setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
      return;
    }

    if (managerRef.current) {
      if (!wasMouseDragMouselook) {
        managerRef.current.moveInput.x = 0;
        managerRef.current.moveInput.z = 0;
        managerRef.current.pointerTargetX = null;
      }

      if (wasQuickTap) {
        const rect = e.currentTarget.getBoundingClientRect();
        const ndcX = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
        const ndcY = rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;

        if (
          managerRef.current.currentMode === 'capytorio' &&
          managerRef.current.cosmicStage === 'playing' &&
          !managerRef.current.getUniverseScaleTelemetry().active
        ) {
          if (releasedButton === 2) {
            const removed = managerRef.current.handleCapytorioSecondaryClick(ndcX, ndcY);
            if (removed) {
              showToast('Demolished & refunded 100%');
            }
            setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
            return;
          }
          if (releasedButton === 0) {
            if (e.pointerType !== 'mouse') {
              setCapytorioPointerHoverActive(false);
            }
            const priRes = managerRef.current.handleCapytorioPrimaryClick(ndcX, ndcY);
            if (priRes.message && (!priRes.ok || !priRes.inspected || priRes.openInspectorModal)) {
              showToast(priRes.message);
            }
            if (priRes.ok && priRes.openInspectorModal) {
              setCapytorioDrawerTab('inspect');
            }
            setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
            return;
          }
        }

        if (!wasMouseDragMouselook || releasedButton === 0) {
          const handledByCosmic = managerRef.current.handleCanvasTapRaycast(ndcX, ndcY);
          if (!handledByCosmic && managerRef.current.cosmicStage === 'playing') {
            managerRef.current.isJumping = true;
          }
        }
      }
    }

    setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
  };

  const updateGameSettings = (patch: Partial<CapyGameSettings>) => {
    setGameSettings((prev: CapyGameSettings) => {
      const next: CapyGameSettings = { ...prev, ...patch };
      ProgressionService.saveSettings(next);
      if (next.mouselookEnabled === false && isFreeMouselookRef.current) {
        setFreeMouselookActive(false);
      }
      if (managerRef.current) {
        managerRef.current.updateSettings(next);
        setGpuTelemetry(managerRef.current.getGpuEngineTelemetry());
      }
      return next;
    });
  };

  const isZoneUnlocked = (mode: PlayStyle): boolean => {
    if (allFeaturesUnlocked || mode === 'sanctuary') return true;
    const item = PLAY_STYLE_LIST.find((m) => m.id === mode);
    return stats.dna >= (item?.requiredDna ?? 0);
  };

  const isTabUnlocked = (tab: DockTab): boolean => {
    if (allFeaturesUnlocked || tab === 'modes' || tab === 'build') return true;
    if (tab === 'dna') return stats.dna >= 5;
    if (tab === 'upgrades') return stats.dna >= 12;
    if (tab === 'wardrobe') return stats.dna >= 20;
    return true;
  };

  const isMarkersUnlocked = Boolean(
    stats.unlockedObjectMarkers || allFeaturesUnlocked
  );
  const isRescalerUnlocked = Boolean(
    stats.unlockedRealityRescaler || allFeaturesUnlocked
  );

  const handleUnlockCosmicInstrument = (
    instrument: 'markers' | 'rescaler',
    currency: 'dna' | 'coins'
  ) => {
    const updated = ProgressionService.unlockCosmicInstrument(
      stats,
      instrument,
      currency
    );
    if (!updated) {
      const needed =
        instrument === 'markers'
          ? currency === 'dna'
            ? `${OBJECT_MARKERS_DNA_COST} DNA`
            : `${OBJECT_MARKERS_COIN_COST}c`
          : currency === 'dna'
            ? `${REALITY_RESCALER_DNA_COST} DNA`
            : `${REALITY_RESCALER_COIN_COST}c`;
      showToast(`Requires ${needed} · Collect on surface or use Sandbox Unlock`);
      return;
    }
    AudioService.playPrestigeFanfare();
    setStats(updated);
    managerRef.current?.updateStats(updated);
    if (instrument === 'markers') {
      updateGameSettings({ showObjectMarkers: true });
      managerRef.current?.setShowObjectMarkers(true);
      showToast('Object Finder Markers Unlocked & Active');
    } else {
      showToast('Logarithmic Reality Rescaler Unlocked');
    }
  };

  const handleSetRealityGamma = (gamma: number) => {
    const clamped = Math.max(0.28, Math.min(1.0, gamma));
    updateGameSettings({ realityScaleGamma: clamped });
    managerRef.current?.setRealityScaleGamma(clamped);
  };

  const handleToggleObjectMarkers = () => {
    const nextVal = !gameSettings.showObjectMarkers;
    AudioService.playUiClick(nextVal ? 'toggle_on' : 'toggle_off');
    updateGameSettings({ showObjectMarkers: nextVal });
    managerRef.current?.setShowObjectMarkers(nextVal);
  };

  const handleSetAstrophysicsPalette = (palette: AstrophysicsPaletteMode) => {
    AudioService.playUiClick('select');
    updateGameSettings({ astrophysicsPalette: palette });
    managerRef.current?.setAstrophysicsPalette(palette);
  };

  const handleUnlockAllFeatures = () => {
    AudioService.playPrestigeFanfare();
    setAllFeaturesUnlocked(true);
    managerRef.current?.setAllFeaturesUnlocked(true);
    setStats((prev) => {
      const nextDna = Math.max(prev.dna, 50);
      const updated: PlayerStats = {
        ...prev,
        dna: nextDna,
        unlockedObjectMarkers: true,
        unlockedRealityRescaler: true,
      };
      ProgressionService.saveStats(updated);
      managerRef.current?.updateStats(updated);
      return updated;
    });
    showToast('All World Sectors & Optical Instruments Unlocked');
  };

  const closeAllTopBarDrawers = () => {
    setIsAboutOpen(false);
    setIsMenuOpen(false);
    setIsSettingsOpen(false);
    setIsScaleAtlasOpen(false);
    setIsOpticsOpen(false);
    setIsInfographicExpanded(false);
    setIsPerfLogOpen(false);
  };

  const handleSwitchTopLevelGame = (game: TopLevelGameMode) => {
    closeAllTopBarDrawers();
    setCapytorioClipboardMoveMode(false);
    const mgr = managerRef.current;
    if (!mgr) return;

    if (game === 'infinite_zoom') {
      mgr.enterInfiniteZoom(undefined, true);
      setUniverseScale(mgr.getUniverseScaleTelemetry());
      AudioService.playCosmicWarp(1.06);
      return;
    }

    if (game === 'forest_games') {
      const targetSub: ForestSubMode = isForestGameMode(activeMode) ? activeMode : 'sanctuary';
      if (!isZoneUnlocked(targetSub)) {
        setAllFeaturesUnlocked(true);
      }
      AudioService.playUiClick('select');
      setActiveMode(targetSub);
      setStats((prev: PlayerStats) => {
        const updated = { ...prev, selectedPlayStyle: targetSub };
        ProgressionService.saveStats(updated);
        return updated;
      });
      mgr.enterForestGames(targetSub, true);
      setUniverseScale(mgr.getUniverseScaleTelemetry());
      return;
    }

    if (!isZoneUnlocked('capytorio')) {
      setAllFeaturesUnlocked(true);
    }
    AudioService.playUiClick('select');
    setActiveMode('capytorio');
    setStats((prev: PlayerStats) => {
      const updated = { ...prev, selectedPlayStyle: 'capytorio' as PlayStyle };
      ProgressionService.saveStats(updated);
      return updated;
    });
    mgr.enterCapytorio(true);
    setUniverseScale(mgr.getUniverseScaleTelemetry());
  };

  const handleSelectMode = (mode: PlayStyle) => {
    if (!isZoneUnlocked(mode)) {
      setAllFeaturesUnlocked(true);
    }
    if (mode === 'capytorio') {
      handleSwitchTopLevelGame('capytorio');
      showToast(`Transiting to ${ZONE_LOCATIONS.capytorio.title}`);
      return;
    }
    const wasSeamlessActive = Boolean(
      managerRef.current?.getUniverseScaleTelemetry().active
    );
    AudioService.playUiClick('select');
    setActiveMode(mode);
    setStats((prev: PlayerStats) => {
      const updated = { ...prev, selectedPlayStyle: mode };
      ProgressionService.saveStats(updated);
      return updated;
    });
    if (wasSeamlessActive || managerRef.current?.cosmicStage !== 'playing') {
      managerRef.current?.enterForestGames(mode, true);
    } else {
      managerRef.current?.switchMode(
        mode,
        Boolean(managerRef.current?.isSoftwareGl && isMenuOpen)
      );
    }
    if (managerRef.current) {
      setUniverseScale(managerRef.current.getUniverseScaleTelemetry());
    }
    const zone = ZONE_LOCATIONS[mode];
    showToast(`Transiting to ${zone.title}`);
  };

  const handleStartTutorial = (tutorial: CapyTutorial) => {
    closeAllTopBarDrawers();

    if (tutorial.launchTarget === 'cosmos') {
      if (managerRef.current) {
        managerRef.current.enterInfiniteZoom(24.0, true);
        setUniverseScale(managerRef.current.getUniverseScaleTelemetry());
      }
      AudioService.playCosmicWarp(1.08);
    } else if (tutorial.launchTarget === 'sanctuary') {
      setActiveMode('sanctuary');
      setStats((prev: PlayerStats) => {
        const updated = { ...prev, selectedPlayStyle: 'sanctuary' as PlayStyle };
        ProgressionService.saveStats(updated);
        return updated;
      });
      if (managerRef.current) {
        managerRef.current.enterForestGames('sanctuary', true);
        setUniverseScale(managerRef.current.getUniverseScaleTelemetry());
      }
      AudioService.playUiClick('select');
    } else if (tutorial.launchTarget === 'capytorio') {
      handleSwitchTopLevelGame('capytorio');
    } else if (tutorial.launchTarget === 'genesis_setup') {
      handleOpenFirstRunSetup();
    }

    setActiveTutorial({ tutorialId: tutorial.id, stepIndex: 0 });
    showToast(`Tutorial started: ${tutorial.title}`);
  };

  const handleSelectTab = (tab: DockTab) => {
    if (!isTabUnlocked(tab)) {
      setAllFeaturesUnlocked(true);
    }
    setActiveTab(tab);
    setIsDockCollapsed(false);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    AudioService.setMuted(nextMuted);
    setIsMuted(nextMuted);
    if (!nextMuted) {
      AudioService.playUiClick('toggle_on');
    }
  };

  const handleToggleFullscreen = () => {
    AudioService.playUiClick('tap');
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const canvasHostEl = mountRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;
    const activeEl = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (activeEl) {
      const exitFn = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exitFn) {
        Promise.resolve(exitFn.call(doc))
          .then(() => setIsFullscreen(false))
          .catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
      return;
    }
    const reqFn = rootEl.requestFullscreen || rootEl.webkitRequestFullscreen;
    const hostReqFn = canvasHostEl?.requestFullscreen || canvasHostEl?.webkitRequestFullscreen;
    if (reqFn) {
      Promise.resolve(reqFn.call(rootEl))
        .then(() => setIsFullscreen(true))
        .catch(() => {
          if (hostReqFn && canvasHostEl) {
            Promise.resolve(hostReqFn.call(canvasHostEl))
              .then(() => setIsFullscreen(true))
              .catch(() => setIsFullscreen((prev) => !prev));
          } else {
            // Graceful immersive toggle when iframe sandbox disallows native fullscreen API
            setIsFullscreen((prev) => !prev);
          }
        });
    } else if (hostReqFn && canvasHostEl) {
      Promise.resolve(hostReqFn.call(canvasHostEl))
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen((prev) => !prev));
    } else {
      setIsFullscreen((prev) => !prev);
    }
  };

  const handleToggleChaseCamera = () => {
    const nextFollow = !gameSettings.cameraFollowBehind;
    AudioService.playUiClick(nextFollow ? 'toggle_on' : 'toggle_off');
    updateGameSettings({ cameraFollowBehind: nextFollow });
    showToast(nextFollow ? 'Tracking Camera: Active' : 'Fixed Horizon Camera: Active');
  };

  const syncCosmicTelemetryNow = () => {
    if (managerRef.current?.cosmicBuilder) {
      setSimStats(managerRef.current.cosmicBuilder.getSimulationStats());
      setCosmicSimInfo(managerRef.current.cosmicBuilder.getCosmicSimTelemetry());
    }
  };

  const handleOpenJsonEditor = () => {
    AudioService.playUiClick('tap');
    setJsonDraftText(JSON.stringify(proceduralConfigRef.current, null, 2));
    setJsonValidationError(null);
    setJsonValidationWarnings([]);
    setIsScaleAtlasOpen(false);
    setIsOpticsOpen(false);
    setIsInfographicExpanded(false);
    setIsMenuOpen(false);
    setIsJsonEditorOpen(true);
  };

  const handleJsonDraftChange = (nextText: string) => {
    setJsonDraftText(nextText);
    const res = parseAndValidateProceduralConfig(nextText);
    if (res.ok) {
      setJsonValidationError(null);
      setJsonValidationWarnings(res.warnings);
    } else {
      setJsonValidationError(res.error);
      setJsonValidationWarnings([]);
    }
  };

  const applyProceduralConfigCommit = (
    cfg: ProceduralGameConfig,
    regenerate: boolean,
    closeEditor: boolean
  ) => {
    saveProceduralConfig(cfg);
    proceduralConfigRef.current = cfg;
    setProceduralConfig(cfg);
    setJsonDraftText(JSON.stringify(cfg, null, 2));
    setJsonValidationError(null);
    if (cfg.economy.unlockAllSectors || cfg.economy.unlockAllInstruments) {
      setAllFeaturesUnlocked(true);
      managerRef.current?.setAllFeaturesUnlocked(true);
    }
    if (managerRef.current) {
      managerRef.current.applyProceduralConfig(cfg, regenerate);
      setGpuTelemetry(managerRef.current.getGpuEngineTelemetry());
      setUniverseScale(managerRef.current.getUniverseScaleTelemetry());
      setSnakeTelemetry(managerRef.current.getCapySnakeTelemetry());
    }
    AudioService.playUiClick('select');
    showToast(
      regenerate
        ? `Regenerated World: ${cfg.meta.configName} (Seed ${cfg.meta.seed})`
        : `Applied Live Config: ${cfg.meta.configName}`
    );
    if (closeEditor) {
      setIsJsonEditorOpen(false);
    }
  };

  const handleApplyJsonConfig = (regenerate: boolean) => {
    const res = parseAndValidateProceduralConfig(jsonDraftText);
    if (!res.ok) {
      setJsonValidationError(res.error);
      return;
    }
    setJsonValidationWarnings(res.warnings);
    applyProceduralConfigCommit(res.config, regenerate, false);
  };

  const handleSelectProceduralPreset = (presetCfg: ProceduralGameConfig) => {
    const cloned = cloneProceduralConfig(presetCfg);
    setJsonValidationWarnings([]);
    applyProceduralConfigCommit(cloned, true, false);
  };

  const handleRandomizeProceduralSeed = () => {
    const res = parseAndValidateProceduralConfig(jsonDraftText);
    const baseCfg = res.ok
      ? cloneProceduralConfig(res.config)
      : cloneProceduralConfig(proceduralConfigRef.current);
    baseCfg.meta.seed = Math.floor(100000 + Math.random() * 899999);
    setJsonValidationWarnings([]);
    applyProceduralConfigCommit(baseCfg, true, false);
  };

  const handleFormatJsonDraft = () => {
    const res = parseAndValidateProceduralConfig(jsonDraftText);
    if (!res.ok) {
      setJsonValidationError(res.error);
      return;
    }
    setJsonValidationError(null);
    setJsonValidationWarnings(res.warnings);
    setJsonDraftText(JSON.stringify(res.config, null, 2));
  };

  const handleCopyJsonDraft = async () => {
    try {
      await navigator.clipboard.writeText(jsonDraftText);
      if (!isMountedRef.current) return;
      setJsonCopyLabel('Copied!');
      window.setTimeout(() => {
        if (isMountedRef.current) setJsonCopyLabel('Copy JSON');
      }, 1800);
    } catch {
      if (!isMountedRef.current) return;
      setJsonCopyLabel('Unavailable');
      window.setTimeout(() => {
        if (isMountedRef.current) setJsonCopyLabel('Copy JSON');
      }, 1800);
    }
  };

  const handleResetProceduralDefault = () => {
    const resetCfg = resetSavedProceduralConfig();
    setJsonValidationWarnings([]);
    applyProceduralConfigCommit(resetCfg, true, false);
  };

  const applyFirstRunDraftUpdate = (
    updater: (draft: ProceduralGameConfig) => void,
    syncStarterStats: boolean = false
  ) => {
    const next = cloneProceduralConfig(proceduralConfigRef.current);
    updater(next);
    saveProceduralConfig(next);
    proceduralConfigRef.current = next;
    setProceduralConfig(next);
    setJsonDraftText(JSON.stringify(next, null, 2));

    if (syncStarterStats) {
      setStats((prev) => {
        const unlockedCosmetics = prev.unlockedCosmetics.includes(next.player.activeHat)
          ? prev.unlockedCosmetics
          : [...prev.unlockedCosmetics, next.player.activeHat];
        const updated: PlayerStats = {
          ...prev,
          activeSkin: next.player.activeSkin,
          activeHat: next.player.activeHat,
          unlockedCosmetics,
        };
        ProgressionService.saveStats(updated);
        managerRef.current?.updateStats(updated);
        return updated;
      });
    }

    if (managerRef.current) {
      managerRef.current.applyProceduralConfig(next, false);
      setUniverseScale(managerRef.current.getUniverseScaleTelemetry());
      setSnakeTelemetry(managerRef.current.getCapySnakeTelemetry());
    }
  };

  const handleOpenFirstRunSetup = () => {
    AudioService.playUiClick('tap');
    setIsMenuOpen(false);
    setIsScaleAtlasOpen(false);
    setIsOpticsOpen(false);
    setIsInfographicExpanded(false);
    setFirstRunTab('pilot');
    setIsFirstRunSetupOpen(true);
    if (managerRef.current && universeScale.active) {
      managerRef.current.setCruiseVelocity(0);
    }
  };

  const handleCompleteFirstRunSetup = (launchFromBigBang: boolean) => {
    const cfg = cloneProceduralConfig(proceduralConfigRef.current);
    saveProceduralConfig(cfg);
    markFirstRunSetupComplete();
    setIsFirstRunSetupOpen(false);

    if (managerRef.current) {
      managerRef.current.applyProceduralConfig(cfg, false);
      if (launchFromBigBang) {
        managerRef.current.launchIntoCosmos(28.0);
        managerRef.current.setSeamlessLogScale(28.0, true);
        managerRef.current.setVesselMode(cfg.player.startingVesselMode);
        managerRef.current.setCruiseVelocity(0);
      }
      setUniverseScale(managerRef.current.getUniverseScaleTelemetry());
      setSnakeTelemetry(managerRef.current.getCapySnakeTelemetry());
    }
    AudioService.playCosmicWarp(1.2);
    const activeHeroName =
      PLAYABLE_CAPY_HEROES.find((h) => h.id === cfg.player.heroArchetypeId)?.name || 'Captain Yuzu';
    showToast(
      `Chrono-Vessel Launched · ${activeHeroName} · α⁻¹=${cfg.universe.fineStructureInverse.toFixed(1)}`
    );
  };

  const handleOpenDebugReport = (mode?: 'summary' | 'analysis' | 'detail') => {
    AudioService.playUiClick('tap');
    const effectiveMode = mode ?? debugReportMode;
    const report = managerRef.current
      ? managerRef.current.generatePerformanceDebugReport(effectiveMode)
      : 'CapyGame: Engine not initialized';
    setDebugReportText(report);
    setSelectedSnippet('');
    setIsDebugReportOpen(true);
    setIsReportCopied(false);
  };

  const handleToggleDebugReportMode = (mode: 'summary' | 'analysis' | 'detail') => {
    setDebugReportMode(mode);
    if (managerRef.current) {
      const report = managerRef.current.generatePerformanceDebugReport(mode);
      setDebugReportText(report);
      setSelectedSnippet('');
      setIsReportCopied(false);
    }
  };

  const handleCopyDebugReport = async (textToCopy?: string) => {
    const text = textToCopy || (selectedSnippet ? selectedSnippet : debugReportText);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const docFocus = readDocumentFocusState();
        if (
          !canRequestProgrammaticFocus({
            hasWindowFocus: isWindowFocusedRef.current,
            documentHasFocus: docFocus.documentHasFocus,
            visibilityState: docFocus.visibilityState,
          })
        ) {
          throw new Error('Window is not focused');
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setIsReportCopied(true);
      AudioService.playUiClick('select');
      const msg = textToCopy
        ? 'Incident log entry copied'
        : selectedSnippet
        ? `Selected snippet copied (${text.length} chars)`
        : debugReportMode === 'summary'
        ? 'Summary performance report copied (~120 tokens)'
        : debugReportMode === 'analysis'
        ? 'Fine-grained performance analysis copied'
        : 'Full diagnostic report copied';
      showToast(msg);
      window.setTimeout(() => {
        if (isMountedRef.current) setIsReportCopied(false);
      }, 2500);
    } catch {
      showToast('Could not copy automatically. Select text below.');
    }
  };

  const handlePlaceBuilding = (def: BuildingCatalogItem) => {
    if (stats.buildings.length >= 16) {
      showToast('Sector capacity reached (16/16 structures)');
      return;
    }
    const costMult = proceduralConfigRef.current.economy.buildingCostMultiplier;
    const coinCost = ProgressionService.getBuildingCoinCost(def.type, costMult);
    const idx = stats.buildings.length;
    const clearSpot = managerRef.current?.findClearBuildingSpot(idx);
    const angle = (idx * Math.PI * 2) / 10 + 0.4;
    const radius = 8.5 + (idx % 3) * 3.8;
    const bx = clearSpot ? clearSpot.x : Math.cos(angle) * radius;
    const bz = clearSpot ? clearSpot.z : Math.sin(angle) * radius;

    const nextStats = ProgressionService.placeBuilding(
      stats,
      def.type,
      def.name,
      bx,
      bz,
      def.description,
      costMult
    );
    if (!nextStats) {
      showToast(`Requires ${coinCost}c to deploy ${def.name}`);
      return;
    }
    AudioService.playCoin();
    setStats(nextStats);
    managerRef.current?.updateStats(nextStats);
    managerRef.current?.refreshSanctuaryBuildings();
    showToast(`Deployed ${def.name} (-${coinCost}c)`);
  };

  const handleStartBuildingGhost = (def: BuildingCatalogItem) => {
    if (stats.buildings.length >= 16) {
      showToast('Sector capacity reached (16/16 structures)');
      return;
    }
    const costMult = proceduralConfigRef.current.economy.buildingCostMultiplier;
    const coinCost = ProgressionService.getBuildingCoinCost(def.type, costMult);
    if ((stats.coins ?? 0) < coinCost) {
      showToast(`Requires ${coinCost}c to place ${def.name}`);
      return;
    }
    if (activeMode !== 'sanctuary') {
      setActiveMode('sanctuary');
      managerRef.current?.switchMode('sanctuary', true);
    }
    AudioService.playUiClick('select');
    managerRef.current?.startBuildingPlacementGhost(
      def.type,
      def.name,
      def.description
    );
    setIsMenuOpen(false);
  };

  const handleUpgradeBuilding = (buildingId: string) => {
    const costMult = proceduralConfigRef.current.economy.buildingCostMultiplier;
    const target = stats.buildings.find((b) => b.id === buildingId);
    const updated = ProgressionService.upgradeBuilding(stats, buildingId, costMult);
    if (!updated) {
      if (target) {
        const reqCoins = ProgressionService.getBuildingUpgradeCoinCost(
          target.type,
          target.level,
          costMult
        );
        showToast(`Requires ${reqCoins}c to upgrade ${target.name}`);
      }
      return;
    }
    AudioService.playCoin();
    setStats(updated);
    managerRef.current?.updateStats(updated);
    managerRef.current?.refreshSanctuaryBuildings();
    showToast('Structure tier upgraded');
  };

  const handleLevelUpAbility = (upgradeKey: keyof PlayerStats['upgrades']) => {
    const curLevel = stats.upgrades[upgradeKey] || 1;
    const reqDna = ProgressionService.getAbilityUpgradeDnaCost(curLevel);
    const updated = ProgressionService.buyUpgrade(stats, upgradeKey);
    if (!updated) {
      showToast(`Requires ${reqDna} DNA to increment parameter`);
      return;
    }
    AudioService.playSplash();
    setStats(updated);
    managerRef.current?.updateStats(updated);
    showToast(`Parameter upgraded (-${reqDna} DNA)`);
  };

  const handleToggleMutation = (mutationId: MutationId) => {
    const mut = SPORE_MUTATIONS.find((m) => m.id === mutationId);
    const res = ProgressionService.unlockOrToggleMutation(stats, mutationId);
    if (!res) {
      if (mut) {
        showToast(`Requires ${mut.dnaCost} DNA to splice ${mut.name}`);
      }
      return;
    }
    AudioService.playCoin();
    managerRef.current?.updateStats(res.stats);
    setStats(res.stats);
    if (res.action === 'unlocked' && mut) {
      showToast(`Unlocked ${mut.name} (-${mut.dnaCost} DNA)`);
    }
  };

  const handleEquipHat = (hatId: string) => {
    const res = ProgressionService.unlockOrEquipCosmetic(stats, hatId);
    if (!res) {
      const cost = ProgressionService.getCosmeticCoinCost(hatId);
      showToast(`Requires ${cost}c to unlock cosmetic`);
      return;
    }
    AudioService.playCoin();
    managerRef.current?.updateStats(res.stats);
    setStats(res.stats);
    if (res.action === 'unlocked') {
      const cost = ProgressionService.getCosmeticCoinCost(hatId);
      showToast(`Unlocked & equipped headgear (-${cost}c)`);
    }
  };

  const handlePrestigeAscend = () => {
    const reqDna = ProgressionService.getPrestigeDnaCost(stats.prestigeLevel);
    const updated = ProgressionService.prestige(stats);
    if (!updated) {
      showToast(`Requires ${reqDna} DNA for Prestige Ascension`);
      return;
    }
    AudioService.playPrestigeFanfare();
    setStats(updated);
    managerRef.current?.updateStats(updated);
    showToast(`Prestige Tier ${updated.prestigeLevel} Ascended (${updated.prestigeLevel}x Coin Yield)`);
  };

  const handleResetProgress = () => {
    const fresh = ProgressionService.resetStats();
    setStats(fresh);
    managerRef.current?.updateStats(fresh);
    managerRef.current?.refreshSanctuaryBuildings();
    managerRef.current?.resetCapytorioToBlankField();
    AudioService.playSplash();
    showToast('Simulation state reset');
  };

  const applyImportedSaveBundle = (rawText: string): boolean => {
    const res = ProgressionService.importSaveBundleJson(rawText);
    if (!res.ok) {
      setSavePortabilityFeedback({ tone: 'error', message: res.error });
      showToast(res.error);
      return false;
    }
    setStats(res.stats);
    setGameSettings(res.settings);
    if (res.proceduralConfig) {
      setProceduralConfig(res.proceduralConfig);
      managerRef.current?.applyProceduralConfig(res.proceduralConfig, true);
    }
    if (res.firstRunSetupComplete === true) {
      setIsFirstRunSetupOpen(false);
    }
    managerRef.current?.updateStats(res.stats);
    managerRef.current?.updateSettings(res.settings);
    managerRef.current?.refreshSanctuaryBuildings();
    managerRef.current?.hydrateCapytorioFromStats(res.stats);
    managerRef.current?.reloadYuzuBestGhostFromStorage();
    if (managerRef.current) {
      setGpuTelemetry(managerRef.current.getGpuEngineTelemetry());
    }
    AudioService.playPrestigeFanfare();
    const ghostNote = res.yuzuGhostRun
      ? ` + Parkour PB (${(res.yuzuGhostRun.durationMs / 1000).toFixed(2)}s)`
      : '';
    const seedNote = res.proceduralConfig ? ` + Seed #${res.proceduralConfig.meta.seed}` : '';
    const warnNote = res.warnings.length > 0 ? ` (${res.warnings.length} sanitized)` : '';
    const okMsg = `Restored save (${res.stats.dna} DNA, ${res.stats.coins}c)${seedNote}${ghostNote}${warnNote}.`;
    setSavePortabilityFeedback({ tone: 'ok', message: okMsg });
    setSaveJsonDraft('');
    setIsSaveJsonPasteOpen(false);
    showToast(okMsg);
    return true;
  };

  const handleExportSaveBundleFile = () => {
    const json = ProgressionService.exportSaveBundleJson(
      stats,
      gameSettings,
      undefined,
      proceduralConfig
    );
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `capygame-save-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback to draft drawer if blob downloads are restricted
    }
    setSaveJsonDraft(json);
    setSavePortabilityFeedback({
      tone: 'ok',
      message: 'Exported full v2 save backup (progress, Capytorio, settings, seeds & Parkour PB).',
    });
    showToast('Exported Full Save Backup JSON');
  };

  const handleCopySaveBundleJson = async () => {
    const json = ProgressionService.exportSaveBundleJson(
      stats,
      gameSettings,
      undefined,
      proceduralConfig
    );
    setSaveJsonDraft(json);
    setIsSaveJsonPasteOpen(true);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(json);
      }
    } catch {
      // Clipboard may be blocked in non-HTTPS contexts; preview remains open for copy
    }
    setSavePortabilityFeedback({
      tone: 'ok',
      message: 'Copied full v2 JSON backup to clipboard and opened preview.',
    });
    showToast('Save JSON copied');
  };

  const getHighScoreForMode = (mode: PlayStyle): number => {
    if (mode === 'spore') return stats.highScoreSpore;
    if (mode === 'capytorio') return stats.highScoreCapytorio;
    if (mode === 'runner') return stats.highScoreRunner;
    if (mode === 'fallguys') return stats.highScoreFallGuys;
    return stats.buildings.length;
  };

  const setVirtualInput = (x: number, z: number) => {
    if (!managerRef.current) return;
    managerRef.current.moveInput.x = x;
    managerRef.current.moveInput.z = z;
  };

  const currentModeInfo =
    PLAY_STYLE_LIST.find((m) => m.id === activeMode) ?? PLAY_STYLE_LIST[0];
  const currentZone = ZONE_LOCATIONS[activeMode];
  const activeGame: TopLevelGameMode =
    universeScale.activeGame ??
    resolveTopLevelGameMode(
      universeScale.active,
      activeMode,
      Boolean(universeScale.isCapytorioOrbitalFlight)
    );
  const isPureInfiniteZoom = activeGame === 'infinite_zoom';
  const isForestGames = activeGame === 'forest_games';
  const isCapytorioGame = activeGame === 'capytorio';
  const isCapytorioOrbitalFlight = Boolean(universeScale.isCapytorioOrbitalFlight);

  const unlockedCount = PROGRESSIVE_UNLOCKS.filter(
    (u) => allFeaturesUnlocked || stats.dna >= u.requiredDna
  ).length;

  const showTouchDpad =
    cosmicStage === 'playing' && gameSettings.touchControlsMode === 'always';

  const activeGalaxy = COSMIC_GALAXIES[selectedGalaxyIdx] || COSMIC_GALAXIES[0];
  const activeStar =
    activeGalaxy.starSystems[selectedStarIdx] || activeGalaxy.starSystems[0];
  const activePlanet =
    activeStar.planets[selectedPlanetIdx] || activeStar.planets[0];
  const defaultFallbackSpot = activePlanet.landingSpots[0] || {
    id: `${activePlanet.id}_probe`,
    name: `${activePlanet.name} Atmospheric Survey`,
    subtitle: 'High-altitude probe reconnaissance',
    lat: 0,
    lon: 0,
    biome: {
      biomeName: `${activePlanet.name} Stratosphere`,
      skyHex: activePlanet.atmosphereHex,
      fogHex: activePlanet.colorHex,
      oceanHex: activePlanet.colorHex,
      islandGrassHex: activePlanet.continentHex,
      beachSandHex: activePlanet.continentHex,
      floraPaletteHexes: [activePlanet.colorHex, activePlanet.continentHex, activePlanet.atmosphereHex],
      gravityMultiplier: 1.0,
    },
  };
  const activeLandingSpot =
    activePlanet.landingSpots[selectedLandingIdx] || defaultFallbackSpot;
  const activeCapyHero =
    PLAYABLE_CAPY_HEROES[selectedCapyHeroIdx] || PLAYABLE_CAPY_HEROES[0];

  const infographicStageTag =
    cosmicStage === 'singularity'
      ? 'T = 0.00s'
      : cosmicStage === 'big_bang'
      ? cosmicSimInfo.epoch === 'inflation'
        ? 'INFLATION'
        : cosmicSimInfo.epoch === 'gravitational_collapse'
        ? 'GRAVITY COLLAPSE'
        : 'FLUID ACCRETION'
      : cosmicStage === 'universe_flight'
      ? 'SCALE 1/4'
      : cosmicStage === 'galaxy_view'
      ? 'SCALE 2/4'
      : cosmicStage === 'star_system_view'
      ? 'SCALE 3/4'
      : cosmicStage === 'planet_orbit'
      ? 'SCALE 4/4'
      : cosmicStage === 'planet_descent'
      ? 'DESCENT'
      : 'SURFACE';

  const infographicTargetTitle =
    cosmicStage === 'singularity'
      ? 'Primordial Singularity'
      : cosmicStage === 'big_bang'
      ? `${cosmicSimInfo.epochLabel} (${cosmicSimInfo.coalescencePercent}%)`
      : cosmicStage === 'universe_flight'
      ? activeGalaxy.name
      : cosmicStage === 'galaxy_view'
      ? activeStar.name
      : cosmicStage === 'star_system_view'
      ? activePlanet.name
      : cosmicStage === 'planet_orbit' || cosmicStage === 'planet_descent'
      ? activeLandingSpot.name
      : `${activeCapyHero.name} · ${activeCapyHero.title}`;

  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-[#000000] font-sans text-zinc-100">
      {/* Contiguous 3D WebGL World Canvas with Direct Touch, Wheel Zoom & Pointer Steering */}
      <div
        ref={mountRef}
        data-testid="capygame-canvas-container"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUpOrCancel}
        onPointerCancel={handleCanvasPointerUpOrCancel}
        onLostPointerCapture={handleCanvasPointerUpOrCancel}
        onPointerLeave={() => {
          setCapytorioPointerHoverActive(false);
          managerRef.current?.clearCapytorioPointerHover();
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
        className="absolute inset-0 w-full h-full cursor-crosshair active:cursor-grabbing"
      />

      {/* WebGL Error Fallback Card */}
      {webglError && (
        <div
          data-testid="capygame-webgl-error"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 select-text"
        >
          <div className="max-w-md w-full bg-zinc-900 rounded-xl p-5 shadow-2xl border border-white/15 text-zinc-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-100">
                  WebGL 3D Context Unavailable
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Hardware or software 3D rendering could not be initialized
                </p>
              </div>
            </div>
            <pre className="text-xs font-mono text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded-lg border border-white/10 whitespace-pre-wrap break-words max-h-40 overflow-y-auto select-text cursor-text">
              {webglError}
            </pre>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                data-testid="webgl-error-copy-btn"
                onClick={() => void handleCopyDebugReport(webglError)}
                className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium cursor-pointer border border-white/10 select-none"
              >
                Copy Error
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium cursor-pointer border border-white/10 select-none"
              >
                Reinitialize Context
              </button>
            </div>
          </div>
        </div>
      )}

      <CapyWebGlContextBanner
        isContextLost={isWebGlContextLost && !webglError}
        onReloadScene={() => window.location.reload()}
      />

      {/* Subtle HUD Notice when Free Mouselook (M) is Active */}
      {isFreeMouselook && (
        <div
          data-testid="mouselook-active-pill"
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950/90 border border-sky-400/50 text-sky-200 text-[11px] font-mono shadow-xl pointer-events-auto"
        >
          <Crosshair className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>Free Mouselook Active · Press M or Esc to unlock</span>
          <button
            type="button"
            onClick={() => setFreeMouselookActive(false)}
            className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-[10px] cursor-pointer"
          >
            Unlock
          </button>
        </div>
      )}

      {/* Minimal Vector Reticle when Dragging on Screen */}
      {touchVisual.active && (
        <div
          data-testid="touch-joystick-indicator"
          className="fixed inset-0 pointer-events-none z-10"
        >
          <div
            style={{
              left: `${touchVisual.originX - 36}px`,
              top: `${touchVisual.originY - 36}px`,
            }}
            className="fixed w-18 h-18 rounded-full border border-white/30 bg-zinc-950/40"
          />
          <div
            style={{
              left: `${touchVisual.currentX - 12}px`,
              top: `${touchVisual.currentY - 12}px`,
            }}
            className="fixed w-6 h-6 rounded-full bg-sky-400/80 border border-white"
          />
        </div>
      )}

      {/* Subtle White Flash Overlay on Singularity Ignition */}
      {bigBangFlashOpacity > 0.01 && (
        <div
          data-testid="big-bang-flash-overlay"
          style={{ opacity: bigBangFlashOpacity }}
          className="fixed inset-0 z-20 pointer-events-none bg-white transition-opacity duration-75"
        />
      )}

      {/* =====================================================================
          UNLOCKABLE 1:1 OBJECT FINDER MARKERS (Screen-Space Reticles & Callouts)
          Projects crisp HUD diamond brackets onto sub-pixel planets, moons,
          stellar cores, and atomic nuclei so tiny 1:1 objects can be located
          and clicked to zoom directly to their physical scale.
         ===================================================================== */}
      {universeScale.active &&
        universeScale.showObjectMarkers &&
        universeScale.markers.length > 0 && (
          <div
            data-testid="object-finder-markers-layer"
            className="fixed inset-0 z-20 pointer-events-none overflow-hidden"
          >
            {universeScale.markers.map((m) => (
              <div
                key={m.id}
                style={{
                  transform: `translate3d(${m.screenX}px, ${m.screenY}px, 0)`,
                }}
                className="absolute top-0 left-0"
              >
                <div
                  aria-hidden="true"
                  style={{ borderColor: m.colorCss }}
                  className="w-3.5 h-3.5 -ml-[7px] -mt-[7px] rotate-45 border bg-zinc-950/30"
                />
                <button
                  type="button"
                  data-testid={`object-marker-${m.id}`}
                  onClick={() => {
                    AudioService.playCosmicWarp(1.06);
                    managerRef.current?.setSeamlessLogScale(m.targetLogMeters, false);
                  }}
                  title={`Focus ${m.label} (${m.sublabel})`}
                  className="pointer-events-auto absolute left-3 -top-2.5 px-1.5 py-0.5 rounded bg-zinc-950/90 hover:bg-zinc-900 border border-white/15 text-left whitespace-nowrap cursor-pointer transition-colors"
                >
                  <div
                    style={{ color: m.colorCss }}
                    className="text-[10px] font-mono font-semibold leading-tight"
                  >
                    {m.label}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-400 tabular-nums leading-tight">
                    {m.sublabel}
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}

      {/* =====================================================================
          SINGLE COMPACT TOP CONTROL, SCALE, STATUS & DROPDOWN BAR (h-10 / 40px)
          Hidden by default for a clean viewport; revealed from top-right Menu.
         ===================================================================== */}
      {!isTopBarVisible && (
          <div className="fixed top-[calc(0.5rem+var(--sat))] right-[calc(0.5rem+var(--sar))] z-30 flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              data-testid="quick-help-btn"
              onClick={() => {
                AudioService.playUiClick('tap');
                setIsAboutOpen(true);
              }}
              title="About CapyGame & Tutorials"
              aria-label="Open About CapyGame and Tutorials"
              className="h-7 px-2 rounded bg-zinc-950/90 hover:bg-zinc-900 border border-white/15 text-zinc-100 text-[11px] font-medium flex items-center gap-1 shadow-lg cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
              <span>Help</span>
            </button>
            <button
              type="button"
              data-testid="reveal-top-bar-btn"
              onClick={() => {
                AudioService.playUiClick('tap');
                setIsTopBarVisible(true);
              }}
              title="Show World & Scale Menu Bar"
              aria-label="Show Top Menu Bar"
              className="h-7 px-2 rounded bg-zinc-950/90 hover:bg-zinc-900 border border-white/15 text-zinc-100 text-[11px] font-medium flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Menu className="w-3.5 h-3.5 text-sky-400" />
              <span>Menu</span>
            </button>
          </div>
        )}

      {isTopBarVisible && (
      <nav
        data-testid="unified-top-bar"
        data-ui-mode={isAdvancedMode ? 'advanced' : 'basic'}
        data-active-game={activeGame}
        aria-label="CapyGame Mode Switcher and Controls"
        className="fixed top-0 inset-x-0 z-30 h-10 hud-safe-top bg-zinc-950/95 border-b border-white/12 px-1 sm:px-2.5 flex items-center justify-between gap-1 sm:gap-2 pointer-events-auto whitespace-nowrap"
      >
        {/* LEFT CLUSTER: 3-Game Standalone Switcher + Mode-Specific Zoom Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 shrink">
          <div
            role="group"
            data-testid="game-mode-switcher"
            aria-label="Select Game Mode"
            className="flex items-center rounded-md bg-zinc-900 border border-white/12 p-0.5 shrink-0"
          >
            <button
              type="button"
              data-testid="game-switcher-infinite-zoom"
              aria-pressed={isPureInfiniteZoom}
              onClick={() => handleSwitchTopLevelGame('infinite_zoom')}
              className={`h-6 px-1.5 sm:px-2.5 rounded text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
                isPureInfiniteZoom
                  ? 'bg-sky-500/25 text-sky-200 border border-sky-400/55'
                  : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
              }`}
            >
              <span className="sm:hidden">Zoom</span>
              <span className="hidden sm:inline">Infinite Zoom</span>
            </button>
            <button
              type="button"
              data-testid="game-switcher-forest-games"
              aria-pressed={isForestGames}
              onClick={() => handleSwitchTopLevelGame('forest_games')}
              className={`h-6 px-1.5 sm:px-2.5 rounded text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
                isForestGames
                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/55'
                  : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
              }`}
            >
              <span className="sm:hidden">Forest</span>
              <span className="hidden sm:inline">Forest Games</span>
            </button>
            <button
              type="button"
              data-testid="game-switcher-capytorio"
              aria-pressed={isCapytorioGame}
              onClick={() => handleSwitchTopLevelGame('capytorio')}
              className={`h-6 px-1.5 sm:px-2.5 rounded text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
                isCapytorioGame
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-400/55'
                  : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
              }`}
            >
              Capytorio
            </button>
          </div>

          {universeScale.active && (
          <div
            data-testid="universe-scale-hud"
            data-scale-band={universeScale.bandId}
            data-seamless-active={universeScale.active ? 'true' : 'false'}
            className="flex items-center gap-0.5 sm:gap-1 min-w-0 shrink"
          >
            {isAdvancedMode && (
              <button
                type="button"
                data-testid="scale-zoom-out-btn"
                onClick={() => managerRef.current?.stepScaleBand(1)}
              title="Zoom Out 1 Scale Band (Toward Big Bang 10^+30m)"
              aria-label="Zoom Out Scale"
              className="hidden sm:flex w-6 h-7 items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 cursor-pointer shrink-0"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            data-testid="toggle-scale-atlas-btn"
            aria-expanded={isScaleAtlasOpen}
            onClick={() => {
              AudioService.playUiClick('tap');
              setIsScaleAtlasOpen((prev) => {
                const next = !prev;
                if (next) {
                  setIsOpticsOpen(false);
                  setIsInfographicExpanded(false);
                  setIsMenuOpen(false);
                }
                return next;
              });
            }}
            title={isAdvancedMode ? 'Open 65-Orders-of-Magnitude Universe Scale Scrubber' : 'Choose Zoom Level & Sticker Book'}
            className={`${isAdvancedMode ? 'h-6 sm:h-7 px-1 sm:px-2' : 'h-7 px-1.5 sm:px-2'} rounded border flex items-center gap-1 text-left transition-colors cursor-pointer ${
              isScaleAtlasOpen
                ? 'bg-sky-500/20 border-sky-400/60 text-zinc-100'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-100'
            }`}
          >
            {isAdvancedMode ? (
              <>
                <span
                  data-testid="compact-scale-exponent"
                  className="text-[10px] font-mono tabular-nums text-sky-400 font-semibold"
                >
                  {universeScale.scientificLabel}
                </span>
                <span className="hidden sm:inline text-zinc-600 text-[10px]">·</span>
                <span className="hidden sm:inline text-[11px] font-medium text-zinc-200 max-w-[140px] lg:max-w-[185px] truncate">
                  {universeScale.bandId === 'leaf_fur_micro' && universeScale.forestSpecimenLabel
                    ? `Leaf & Fur · ${universeScale.forestSpecimenLabel}`
                    : UNIVERSE_SCALE_BANDS[universeScale.bandIndex]?.shortLabel || 'Scale'}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1 min-w-0 max-w-[116px] sm:max-w-[230px]">
                <span className="text-[11px] font-medium text-zinc-100 truncate">
                  {universeScale.bandId === 'leaf_fur_micro' && universeScale.forestSpecimenLabel
                    ? `Glade · ${universeScale.forestSpecimenLabel}`
                    : UNIVERSE_SCALE_BANDS[universeScale.bandIndex]?.shortLabel || 'Zoom'}
                </span>
                <span
                  data-testid="basic-top-scale-readout"
                  className="hidden sm:inline text-[10px] font-mono tabular-nums text-sky-300 shrink-0"
                >
                  · {universeScale.scaleFormatted}
                </span>
              </span>
            )}
            <ChevronDown
              className={`w-3 h-3 text-zinc-400 shrink-0 transition-transform ${
                isScaleAtlasOpen ? 'rotate-180 text-sky-400' : ''
              }`}
            />
          </button>

          {isAdvancedMode && (
            <input
              type="range"
              min={MIN_UNIVERSE_LOG_METERS}
              max={MAX_UNIVERSE_LOG_METERS}
              step={0.05}
              value={universeScale.targetLogScaleMeters}
              onChange={(e) => {
                managerRef.current?.setSeamlessLogScale(parseFloat(e.target.value), false);
              }}
              aria-label="Inline Universe Scale Slider"
              title={`Scale: ${universeScale.scientificLabel} (${universeScale.bandTitle})`}
              className="hidden xl:block w-24 accent-sky-400 cursor-pointer h-1 bg-zinc-800 rounded-lg mx-0.5"
            />
          )}

          {isAdvancedMode && (
            <button
              type="button"
              data-testid="scale-zoom-in-btn"
              onClick={() => managerRef.current?.stepScaleBand(-1)}
              title="Zoom In 1 Scale Band (Toward Electron & Photon 10^-35m)"
              aria-label="Zoom In Scale"
              className="hidden sm:flex w-6 h-7 items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

          {isAdvancedMode && (
            <button
              type="button"
              data-testid="toggle-optics-panel-btn"
              aria-expanded={isOpticsOpen}
              onClick={() => {
                AudioService.playUiClick('tap');
                setIsOpticsOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    setIsScaleAtlasOpen(false);
                    setIsInfographicExpanded(false);
                    setIsMenuOpen(false);
                  }
                  return next;
                });
              }}
              title="Cosmic Optics: 1:1 Physical Scale, Object Finder Markers & Reality Rescaler"
              className={`h-6 sm:h-7 px-1 sm:px-1.5 rounded border flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-mono tabular-nums transition-colors cursor-pointer shrink-0 ${
                isOpticsOpen || universeScale.showObjectMarkers || universeScale.realityScaleGamma < 0.99
                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
              }`}
            >
              <Crosshair className="w-3 h-3 text-sky-400 shrink-0" />
              <span data-testid="compact-scale-ratio-badge">
                {universeScale.realityScaleGamma >= 0.99
                  ? '1:1'
                  : `γ${universeScale.realityScaleGamma.toFixed(2)}`}
                {universeScale.showObjectMarkers ? '·M' : ''}
              </span>
            </button>
          )}
        </div>
        )}
        </div>

        {/* CENTER CLUSTER: Live Status & Inspector Trigger */}
        <div className="flex-1 min-w-0 overflow-hidden flex items-center justify-center">
          {placementGhost.active ? (
            <div
              data-testid="placement-ghost-banner"
              className="flex items-center gap-1.5 bg-zinc-900 border border-emerald-400/50 px-2 h-7 rounded text-[11px] font-mono min-w-0 max-w-full overflow-hidden"
            >
              <Hammer className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="text-zinc-100 font-sans font-semibold truncate">
                {placementGhost.name}
              </span>
              {isAdvancedMode && (
                <span className="hidden md:inline text-zinc-400 tabular-nums">
                  ({placementGhost.x.toFixed(1)}, {placementGhost.z.toFixed(1)})
                </span>
              )}
              <span
                data-testid="placement-ghost-validity"
                className={
                  placementGhost.valid
                    ? 'text-emerald-300 font-semibold shrink-0'
                    : 'text-rose-300 font-semibold shrink-0'
                }
              >
                {placementGhost.valid ? (isAdvancedMode ? 'Clear · Tap' : 'Tap to Place') : 'Move Here'}
              </span>
              <button
                type="button"
                data-testid="cancel-placement-ghost-btn"
                onClick={() => managerRef.current?.cancelBuildingPlacementGhost()}
                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/15 font-sans text-[10px] cursor-pointer shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              data-testid="cosmic-hud"
              data-cosmic-stage={cosmicStage}
              data-expanded={isInfographicExpanded ? 'true' : 'false'}
              className={`min-w-0 max-w-full sm:max-w-[360px] lg:max-w-[450px] overflow-hidden items-center justify-center ${
                !toastText && (universeScale.active || isForestGames || isCapytorioGame)
                  ? 'hidden md:flex'
                  : 'flex'
              }`}
            >
              <button
                type="button"
                data-testid="toggle-infographic-btn"
                aria-expanded={isInfographicExpanded}
                onClick={() => {
                  AudioService.playUiClick('tap');
                  setIsInfographicExpanded((prev) => {
                    const next = !prev;
                    if (next) {
                      setIsScaleAtlasOpen(false);
                      setIsOpticsOpen(false);
                      setIsMenuOpen(false);
                    }
                    return next;
                  });
                }}
                title={isAdvancedMode ? 'Open Live Simulation, Cosmic & Capybara Inspector' : 'Quick Actions'}
                className={`${isAdvancedMode ? 'h-6 sm:h-7 px-1 sm:px-2 text-[10px] sm:text-[11px]' : 'h-7 px-2 text-[11px]'} rounded border flex items-center gap-1 sm:gap-1.5 min-w-0 max-w-full overflow-hidden whitespace-nowrap transition-colors cursor-pointer ${
                  isInfographicExpanded
                    ? 'bg-sky-500/20 border-sky-400/60 text-zinc-100'
                    : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/10 text-zinc-200'
                }`}
              >
                {toastText ? (
                  <span className="font-mono text-[10px] text-sky-300 truncate min-w-0">{toastText}</span>
                ) : !isAdvancedMode ? (
                  cosmicStage === 'playing' && !universeScale.active ? (
                    <span
                      data-testid="capy-snake-hud"
                      className="flex items-center gap-1.5 min-w-0 overflow-hidden whitespace-nowrap"
                    >
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: snakeTelemetry.headOrangeCss }}
                        className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                      />
                      <span className="font-medium text-zinc-100 truncate">
                        {activeMode === 'sanctuary' ? 'Capy Island' : currentZone.title}
                      </span>
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] sm:text-[11px] font-medium text-sky-300 tabular-nums whitespace-nowrap">
                      {universeScale.active ? (
                        <>
                          <span className="sm:hidden">{universeScale.scaleFormatted}</span>
                          <span className="hidden sm:inline">
                            {formatFlightSpeedReadout(universeScale.cruiseVelocityLogPerSec).kidLabel}
                          </span>
                        </>
                      ) : cosmicStage === 'singularity' ? (
                        'Play'
                      ) : (
                        infographicTargetTitle
                      )}
                    </span>
                  )
                ) : cosmicStage === 'playing' && !universeScale.active && activeMode === 'sanctuary' ? (
                  <span
                    data-testid="capy-snake-hud"
                    className="flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-hidden font-mono tabular-nums whitespace-nowrap"
                  >
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: snakeTelemetry.headOrangeCss }}
                      className="w-2.5 h-2.5 rounded-xs border border-white/30 shrink-0"
                    />
                    <span
                      data-testid="snake-head-orange-label"
                      className="hidden sm:inline font-sans font-medium text-zinc-100 truncate max-w-[96px]"
                    >
                      {snakeTelemetry.headOrangeName}
                    </span>
                    <span className="sm:hidden sr-only">{snakeTelemetry.headOrangeName}</span>
                    <span
                      data-testid="snake-length-label"
                      className="text-[10px] text-amber-300 font-semibold truncate min-w-0 whitespace-nowrap"
                    >
                      {snakeTelemetry.lengthMeters.toFixed(2)}m · {snakeTelemetry.bodySegments}{' '}
                      {snakeTelemetry.bodySegments === 1 ? 'seg' : 'segs'}
                    </span>
                    <span
                      data-testid="capy-lod-label"
                      className="sr-only lg:not-sr-only lg:inline text-[10px] text-emerald-400 shrink-0 whitespace-nowrap"
                    >
                      {snakeTelemetry.lodLabel}
                    </span>
                  </span>
                ) : cosmicStage === 'playing' && !universeScale.active ? (
                  <TelemetryReadout
                    variant="bar"
                    store={telemetryStore}
                    currentZoneTitle={currentZone.title}
                  />
                ) : (
                  <span className="flex items-center gap-1.5 min-w-0 font-mono text-[10px] tabular-nums">
                    <span className="text-sky-400 shrink-0">
                      {universeScale.active ? universeScale.scaleFormatted : infographicStageTag}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="font-sans font-medium text-zinc-100 truncate">
                      {universeScale.active
                        ? universeScale.bandId === 'leaf_fur_micro' && universeScale.forestSpecimenLabel
                          ? `Leaf & Fur · ${universeScale.forestSpecimenLabel}`
                          : universeScale.bandTitle
                        : infographicTargetTitle}
                    </span>
                  </span>
                )}
                <ChevronDown
                  className={`w-3 h-3 text-zinc-400 shrink-0 transition-transform ${
                    isInfographicExpanded ? 'rotate-180 text-sky-400' : ''
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT CLUSTER */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {isAdvancedMode && universeScale.active && (
            <div
              data-testid="top-bar-epoch-badge"
              className="hidden md:flex items-center gap-1 px-1.5 h-7 rounded bg-zinc-900/90 border border-cyan-400/25 text-[10px] font-mono tabular-nums text-cyan-300"
            >
              T+{universeScale.cosmicAgeGyr.toFixed(2)} Gyr
            </div>
          )}

          {isAdvancedMode && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 h-7 rounded bg-zinc-900/75 border border-white/8 text-[10px] font-mono tabular-nums mr-0.5">
              <span data-testid="stat-dna" className="text-emerald-300 font-semibold">
                {stats.dna} DNA
              </span>
              {activeMode !== 'capytorio' && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span data-testid="stat-coins" className="text-amber-300 font-semibold">
                    {stats.coins ?? 0}c
                  </span>
                </>
              )}
            </div>
          )}

          {isAdvancedMode && (
            <button
              type="button"
              data-testid="open-json-editor-btn"
              onClick={handleOpenJsonEditor}
              title="Live Procedural JSON Engine Configurator"
              aria-label="Open Procedural JSON Config Editor"
              className={`h-6 sm:h-7 w-5 sm:w-auto px-0 sm:px-2 rounded border flex items-center justify-center gap-1 text-[11px] font-mono transition-colors cursor-pointer shrink-0 ${
                isJsonEditorOpen
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-cyan-400/25 text-cyan-300'
              }`}
            >
              <Code2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden sm:inline">JSON</span>
            </button>
          )}

          {isForestGames && (
          <button
            type="button"
            data-testid="toggle-menu-btn"
            onClick={() => {
              AudioService.playUiClick('tap');
              setIsMenuOpen((prev) => {
                const next = !prev;
                if (next) {
                  setIsScaleAtlasOpen(false);
                  setIsOpticsOpen(false);
                  setIsInfographicExpanded(false);
                }
                return next;
              });
            }}
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close Island Menu' : 'Open Island Menu'}
            className={`${isAdvancedMode ? 'h-6 sm:h-7 w-6 sm:w-auto px-0 sm:px-2' : 'h-7 px-2'} rounded border flex items-center justify-center gap-1 text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              isMenuOpen
                ? 'bg-sky-500/20 border-sky-400/60 text-zinc-100'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/12 text-zinc-100'
            }`}
          >
            {isMenuOpen ? (
              <X className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Menu className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span className={isAdvancedMode ? 'hidden sm:inline' : 'inline truncate max-w-[74px] sm:max-w-none'}>
              {activeMode === 'sanctuary' ? 'Island' : currentZone.title}
            </span>
          </button>
          )}

          <button
            type="button"
            data-testid="toggle-pause-btn"
            onClick={toggleGamePause}
            title={isGamePaused ? 'Resume Simulation [P]' : 'Pause & Hibernate Simulation [P]'}
            aria-label={isGamePaused ? 'Resume simulation' : 'Pause simulation'}
            aria-pressed={isGamePaused}
            className={`${isAdvancedMode ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-7 h-7'} flex items-center justify-center rounded border transition-colors cursor-pointer shrink-0 ${
              isGamePaused
                ? 'bg-amber-500/25 border-amber-400/60 text-amber-200 hover:bg-amber-500/35'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
            }`}
          >
            {isGamePaused ? (
              <Play className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            className="hidden md:flex w-7 h-7 items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 transition-colors cursor-pointer shrink-0"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            data-testid="open-settings-btn"
            onClick={() => {
              AudioService.playUiClick('tap');
              setIsSettingsOpen(true);
            }}
            title="Settings"
            aria-label="Open Settings"
            className={`${isAdvancedMode ? 'w-5 h-6 sm:w-7 sm:h-7' : 'w-7 h-7'} flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 transition-colors cursor-pointer shrink-0`}
          >
            <SettingsIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>

          <button
            type="button"
            data-testid="open-about-btn"
            onClick={() => {
              AudioService.playUiClick('tap');
              setIsAboutOpen(true);
            }}
            title="About CapyGame & Tutorials"
            aria-label="Open About CapyGame and Help"
            className={`${isAdvancedMode ? 'w-5 h-6 sm:w-7 sm:h-7' : 'h-7 px-1.5 sm:px-2 gap-1'} flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-[11px] font-medium transition-colors cursor-pointer shrink-0`}
          >
            <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
            {!isAdvancedMode && <span className="hidden md:inline">Help</span>}
          </button>

          {isAdvancedMode && gameSettings.showFpsButton !== false && (
            <button
              type="button"
              data-testid="top-right-fps-btn"
              onClick={() => {
                AudioService.playUiClick('tap');
                setIsPerfLogOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    setIsScaleAtlasOpen(false);
                    setIsOpticsOpen(false);
                    setIsInfographicExpanded(false);
                    setIsMenuOpen(false);
                  }
                  return next;
                });
              }}
              aria-expanded={isPerfLogOpen}
              aria-label="Open 60 FPS Performance Log"
              title="Live 60 FPS Telemetry & Frame-Drop Alert Log"
              className={`h-6 sm:h-7 px-1 sm:px-2 rounded border flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-mono font-semibold tabular-nums transition-colors cursor-pointer shrink-0 ${
                isPerfLogOpen
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : perfLog.liveFps >= 55
                    ? 'bg-zinc-900 hover:bg-zinc-800 border-emerald-400/35 text-emerald-300'
                    : perfLog.liveFps >= 40
                      ? 'bg-amber-950/90 hover:bg-amber-900/90 border-amber-400/50 text-amber-200'
                      : 'bg-rose-950/90 hover:bg-rose-900/90 border-rose-500/60 text-rose-200'
              }`}
            >
              <Activity className="hidden sm:block w-3 h-3 shrink-0" />
              <span>
                {perfLog.liveFps}
                <span className="hidden sm:inline"> FPS</span>
              </span>
              {perfLog.alertCount > 0 && (
                <span
                  data-testid="fps-alert-count-badge"
                  className="px-0.5 sm:px-1 rounded bg-rose-500/25 border border-rose-400/50 text-rose-200 text-[8px] sm:text-[9px] leading-tight"
                >
                  !{perfLog.alertCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            data-testid="toggle-fullscreen-btn"
            onClick={handleToggleFullscreen}
            aria-pressed={isFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="hidden md:flex w-7 h-7 items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 transition-colors cursor-pointer shrink-0"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-300" />
            ) : (
              <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
          </button>

          <button
            type="button"
            data-testid="hide-top-bar-btn"
            onClick={() => {
              AudioService.playUiClick('back');
              setIsTopBarVisible(false);
              setIsScaleAtlasOpen(false);
              setIsOpticsOpen(false);
              setIsInfographicExpanded(false);
              setIsMenuOpen(false);
              setIsPerfLogOpen(false);
            }}
            title="Hide Top Bar"
            aria-label="Hide Top Bar"
            className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </nav>
      )}

      {/* TOP-ANCHORED PERFORMANCE LOG POPOVER (Lazily Loaded) */}
      {isPerfLogOpen && (
        <Suspense fallback={null}>
          <LazyCapyPerfLogPopover
            perfLog={perfLog}
            gpuTelemetry={gpuTelemetry}
            onClose={() => setIsPerfLogOpen(false)}
            onToggleLock60={() => {
              const next = !perfLog.lock60FpsEnabled;
              managerRef.current?.setLock60Fps(next);
              updateGameSettings({ lock60FpsGovernor: next });
              if (managerRef.current) {
                setPerfLog(managerRef.current.getPerformanceLogSnapshot());
              }
            }}
            onOpenDebugReport={(mode) => handleOpenDebugReport(mode)}
            onClearLog={() => {
              managerRef.current?.clearPerformanceLog();
              if (managerRef.current) {
                setPerfLog(managerRef.current.getPerformanceLogSnapshot());
              }
            }}
            onCopyIncident={(text) => handleCopyDebugReport(text)}
          />
        </Suspense>
      )}

      {/* Copyable Performance Debug Log Modal (Lazily Loaded) */}
      {isDebugReportOpen && (
        <Suspense fallback={null}>
          <LazyCapyDebugReportModal
            debugReportMode={debugReportMode}
            debugReportText={debugReportText}
            selectedSnippet={selectedSnippet}
            isReportCopied={isReportCopied}
            perfLog={perfLog}
            gpuTelemetry={gpuTelemetry}
            onClose={() => setIsDebugReportOpen(false)}
            onCopyDebugReport={handleCopyDebugReport}
            onToggleDebugReportMode={handleToggleDebugReportMode}
            onSelectSnippet={setSelectedSnippet}
          />
        </Suspense>
      )}

      {/* TOP-ANCHORED DROPDOWN 1: 63-ORDER UNIVERSE SCALE ATLAS (Lazily Loaded) */}
      {isScaleAtlasOpen && universeScale.active && (
        <Suspense fallback={null}>
          <LazyCapyScaleAtlasPanel
            isAdvancedMode={isAdvancedMode}
            universeScale={universeScale}
            stats={stats}
            isSpokenScaleCardsEnabled={isSpokenScaleCardsEnabled}
            isStickerBookOpen={isStickerBookOpen}
            liveZoomThumbnails={liveZoomThumbnails}
            onClose={() => setIsScaleAtlasOpen(false)}
            onSetSpokenScaleCardsEnabled={setIsSpokenScaleCardsEnabled}
            onToggleStickerBook={() => setIsStickerBookOpen((prev) => !prev)}
            onCloseStickerBook={() => setIsStickerBookOpen(false)}
            onJumpToScaleBand={(bandId, immediate) =>
              managerRef.current?.jumpToScaleBand(bandId, immediate)
            }
            onRerollForestSpecimen={(specId) => managerRef.current?.rerollForestSpecimen(specId)}
            onSetSeamlessLogScale={(val, immediate) =>
              managerRef.current?.setSeamlessLogScale(val, immediate)
            }
            onToggleAutoZoom={(dir) => managerRef.current?.toggleAutoZoom(dir)}
            onSetQuantumFocusMode={(mode) => managerRef.current?.setQuantumFocusMode(mode)}
            onResumeSurfacePlayFromForest={() =>
              managerRef.current?.resumeSurfacePlayFromForest()
            }
          />
        </Suspense>
      )}

      {/* TOP-ANCHORED DROPDOWN 1B: COSMIC OPTICS (Lazily Loaded) */}
      {isOpticsOpen && universeScale.active && (
        <Suspense fallback={null}>
          <LazyCapyCosmicOpticsPanel
            universeScale={universeScale}
            gameSettings={gameSettings}
            stats={stats}
            isMarkersUnlocked={isMarkersUnlocked}
            isRescalerUnlocked={isRescalerUnlocked}
            onClose={() => setIsOpticsOpen(false)}
            onToggleObjectMarkers={handleToggleObjectMarkers}
            onUnlockCosmicInstrument={handleUnlockCosmicInstrument}
            onSetRealityGamma={handleSetRealityGamma}
            onSetAstrophysicsPalette={handleSetAstrophysicsPalette}
            onSetGalaxyMorphology={(morph) => {
              managerRef.current?.setGalaxyMorphology(morph);
              if (managerRef.current) {
                setUniverseScale(managerRef.current.getUniverseScaleTelemetry());
              }
            }}
            onUnlockAllFeatures={handleUnlockAllFeatures}
          />
        </Suspense>
      )}

      {/* =====================================================================
          TOP-ANCHORED DROPDOWN 2: UNIT SELECTOR ON PLANET SURFACE (`capy_selection`)
         ===================================================================== */}
      {cosmicStage === 'capy_selection' && !isMenuOpen && !isScaleAtlasOpen && !isOpticsOpen && (
        <div
          data-testid="capy-selector-bar"
          data-expanded="true"
          className="fixed top-11 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-80 z-40 pointer-events-auto bg-zinc-950/96 border border-white/15 rounded-xl p-3 text-zinc-100 shadow-2xl space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                SURFACE · {activeLandingSpot.name}
              </div>
              <h3 className="text-xs font-semibold text-zinc-100 truncate">
                {activeCapyHero.name} · {activeCapyHero.title}
              </h3>
            </div>
            <button
              type="button"
              data-testid="cosmic-back-btn"
              onClick={() => managerRef.current?.stepCosmicBack()}
              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-white/10 cursor-pointer shrink-0"
            >
              ← Orbit
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono bg-zinc-900/90 p-2 rounded-lg border border-white/8">
            <div>
              <span className="text-zinc-500 block">SPECIFICATION</span>
              <span className="text-sky-300 truncate block">{activeCapyHero.perkLabel}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">VELOCITY / LEAP</span>
              <span className="text-zinc-200">
                {activeCapyHero.speedMultiplier.toFixed(2)}x /{' '}
                {activeCapyHero.jumpMultiplier.toFixed(2)}x
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {PLAYABLE_CAPY_HEROES.map((hero, idx) => {
              const isSelected = idx === selectedCapyHeroIdx;
              return (
                <button
                  key={hero.id}
                  type="button"
                  data-testid={`select-capy-${idx}`}
                  onClick={() => managerRef.current?.selectCapyHero(idx, false)}
                  className={`px-2 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800 text-zinc-100 border-sky-400/60'
                      : 'bg-zinc-900/80 text-zinc-400 border-white/10 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="text-[10px] font-medium truncate">{hero.name}</div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="confirm-capy-btn"
            onClick={() => {
              setIsInfographicExpanded(false);
              managerRef.current?.confirmSelectedCapyHero();
            }}
            className="w-full py-1.5 px-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            Deploy {activeCapyHero.name} →
          </button>
        </div>
      )}

      {/* TOP-ANCHORED DROPDOWN 3: TELEMETRY INSPECTOR (Lazily Loaded) */}
      {isInfographicExpanded && cosmicStage !== 'capy_selection' && (
        <Suspense fallback={null}>
          <LazyCapyInfographicPanel
            isAdvancedMode={isAdvancedMode}
            isForestGames={isForestGames}
            isCapytorioGame={isCapytorioGame}
            isCapytorioOrbitalFlight={isCapytorioOrbitalFlight}
            activeMode={activeMode}
            cosmicStage={cosmicStage}
            universeScale={universeScale}
            currentZone={currentZone}
            snakeTelemetry={snakeTelemetry}
            simStats={simStats}
            cosmicSimInfo={cosmicSimInfo}
            orbitTelemetry={orbitTelemetry}
            selectedTimeScale={selectedTimeScale}
            selectedGalaxyIdx={selectedGalaxyIdx}
            selectedStarIdx={selectedStarIdx}
            selectedPlanetIdx={selectedPlanetIdx}
            selectedLandingIdx={selectedLandingIdx}
            physicsTelemetry={physicsTelemetry}
            gpuTelemetry={gpuTelemetry}
            statusBanner={statusBanner}
            onClose={() => setIsInfographicExpanded(false)}
            onOpenForestMenuTab={(tab) => {
              setIsInfographicExpanded(false);
              setActiveTab(tab);
              setIsMenuOpen(true);
            }}
            onOpenAbout={() => {
              setIsInfographicExpanded(false);
              setIsAboutOpen(true);
            }}
            onOpenScaleAtlas={() => {
              setIsInfographicExpanded(false);
              setIsScaleAtlasOpen(true);
            }}
            onEngageCapytorioLanding={() => {
              setIsInfographicExpanded(false);
              managerRef.current?.engageCapytorioLanding();
            }}
            onTriggerBigBang={() => {
              managerRef.current?.triggerBigBang();
              syncCosmicTelemetryNow();
            }}
            onPickRandomTrackedStar={() => {
              managerRef.current?.pickRandomTrackedStar();
              syncCosmicTelemetryNow();
            }}
            onSetCosmicStagePlaying={() => {
              managerRef.current?.setCosmicStage('playing');
              setIsInfographicExpanded(false);
            }}
            onAdjustGravityConstant={(delta) => {
              managerRef.current?.adjustGravityConstant(delta);
              syncCosmicTelemetryNow();
            }}
            onToggleFollowTrackedStar={() => {
              managerRef.current?.toggleFollowTrackedStar();
              syncCosmicTelemetryNow();
            }}
            onTriggerSupernovaOnTrackedStar={() => {
              managerRef.current?.triggerSupernovaOnTrackedStar();
              syncCosmicTelemetryNow();
            }}
            onSetStellarColorMode={(mode) => {
              managerRef.current?.setStellarColorMode(mode);
              syncCosmicTelemetryNow();
            }}
            onFollowTrackedStarToPlanet={() => {
              managerRef.current?.followTrackedStarToPlanet();
              syncCosmicTelemetryNow();
            }}
            onSkipToUniverseFlight={() => {
              managerRef.current?.skipToUniverseFlight();
              syncCosmicTelemetryNow();
            }}
            onCycleStellarColorMode={() => {
              managerRef.current?.cycleStellarColorMode();
              syncCosmicTelemetryNow();
            }}
            onSelectGalaxy={(idx) => managerRef.current?.selectGalaxy(idx)}
            onStepCosmicBack={() => managerRef.current?.stepCosmicBack()}
            onSelectStarSystem={(idx) => managerRef.current?.selectStarSystem(idx)}
            onSetOrbitTimeScale={(scaleId) => {
              managerRef.current?.setOrbitTimeScale(scaleId);
              setSelectedTimeScale(scaleId);
            }}
            onSelectAsteroidBelt={() => managerRef.current?.selectAsteroidBelt()}
            onSelectPlanet={(idx) => managerRef.current?.selectPlanet(idx)}
            onSelectLandingSpot={(idx) => managerRef.current?.selectLandingSpot(idx)}
          />
        </Suspense>
      )}

      {/* TOP-ANCHORED DROPDOWN 4: FOREST ISLAND MENU DRAWER (Lazily Loaded) */}
      {isMenuOpen && isForestGames && (
        <Suspense fallback={null}>
          <LazyCapyForestMenuDrawer
            isAdvancedMode={isAdvancedMode}
            activeMode={activeMode}
            activeTab={activeTab}
            isDockCollapsed={isDockCollapsed}
            currentZoneTitle={currentZone.title}
            currentModeCompass={currentModeInfo.compass}
            stats={stats}
            unlockedCount={unlockedCount}
            gameSettings={gameSettings}
            proceduralConfig={proceduralConfig}
            playStyleList={PLAY_STYLE_LIST}
            isTabUnlocked={isTabUnlocked}
            isZoneUnlocked={isZoneUnlocked}
            getHighScoreForMode={getHighScoreForMode}
            onUnlockAllFeatures={handleUnlockAllFeatures}
            onOpenCapySelect={() => {
              AudioService.playUiClick('select');
              managerRef.current?.setCosmicStage('capy_selection');
              setIsMenuOpen(false);
            }}
            onToggleChaseCamera={handleToggleChaseCamera}
            onSelectTab={handleSelectTab}
            onResetSector={() => managerRef.current?.switchMode(activeMode)}
            onToggleDockCollapse={() => setIsDockCollapsed((prev) => !prev)}
            onSelectMode={handleSelectMode}
            onPlaceBuilding={handlePlaceBuilding}
            onStartBuildingGhost={handleStartBuildingGhost}
            onUpgradeBuilding={handleUpgradeBuilding}
            onToggleMutation={handleToggleMutation}
            onLevelUpAbility={handleLevelUpAbility}
            onPrestigeAscend={handlePrestigeAscend}
            onEquipHat={handleEquipHat}
          />
        </Suspense>
      )}

      {/* Compact Arcade Combo Multiplier HUD (Forest Games Only) */}
      {isForestGames &&
        cosmicStage === 'playing' &&
        !universeScale.active &&
        !webglError && <TelemetryReadout variant="combo" store={telemetryStore} />}

      {/* Collapsible 3-Slot Island Bounties Drawer (Forest Games Only) */}
      {isForestGames &&
        cosmicStage === 'playing' &&
        !universeScale.active &&
        !webglError &&
        !isMenuOpen &&
        !isSettingsOpen &&
        !isAboutOpen &&
        !isPrivacyOpen &&
        !isTermsOpen &&
        !isFeedbackOpen &&
        !isJsonEditorOpen && (() => {
          const activeBounties =
            stats.bounties && stats.bounties.length > 0
              ? stats.bounties
              : createDefaultBounties();
          const lead = activeBounties[0];
          return (
            <aside
              data-testid="bounties-hud-container"
              aria-label="Archipelago Bounties"
              className={`fixed bottom-2.5 left-2.5 hud-safe-bottom-left z-20 pointer-events-auto flex-col items-start gap-1.5 ${
                activeMode === 'capytorio' ? 'hidden' : 'flex'
              }`}
            >
              {isBountiesOpen && (
                <div
                  data-testid="bounties-panel"
                  className="w-64 sm:w-72 rounded-xl bg-zinc-950/95 border border-white/15 shadow-2xl p-2.5 space-y-2 text-zinc-100"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                      <Trophy className="w-3.5 h-3.5 shrink-0" />
                      <span>Island Bounties</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBountiesOpen(false)}
                      aria-label="Close Bounties"
                      className="p-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {activeBounties.map((b) => {
                      const pct = Math.min(100, Math.round((b.progress / b.target) * 100));
                      return (
                        <div
                          key={b.id}
                          data-testid={`bounty-slot-${b.id}`}
                          className="p-2 rounded-lg bg-zinc-900/90 border border-white/8 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-medium text-zinc-100 truncate">{b.title}</span>
                            <span className="font-mono tabular-nums text-amber-300 shrink-0">
                              {b.progress}/{b.target}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400 leading-snug">
                            {b.description}
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                style={{ width: `${pct}%` }}
                                className="h-full bg-emerald-400"
                              />
                            </div>
                            <span className="text-[9px] font-mono tabular-nums text-emerald-300 shrink-0">
                              +{b.coinReward}c +{b.dnaReward} DNA
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                data-testid="bounties-hud-toggle"
                aria-expanded={isBountiesOpen}
                onClick={() => {
                  AudioService.playUiClick('tap');
                  setIsBountiesOpen((prev) => !prev);
                }}
                className="h-9 px-2.5 rounded-lg bg-zinc-950/95 hover:bg-zinc-900 border border-white/15 shadow-lg flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-zinc-100 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="font-sans font-medium truncate max-w-[140px]">
                  {lead.title}
                </span>
                <span className="text-amber-300">
                  {lead.progress}/{lead.target}
                </span>
              </button>
            </aside>
          );
        })()}

      {/* Kinetic Surface Ability Buttons (Forest Games Only) */}
      {isForestGames &&
        cosmicStage === 'playing' &&
        !universeScale.active &&
        !webglError &&
        gameSettings.touchControlsMode !== 'hidden' &&
        !isMenuOpen &&
        !isSettingsOpen &&
        !isAboutOpen &&
        !isPrivacyOpen &&
        !isTermsOpen &&
        !isFeedbackOpen &&
        !isJsonEditorOpen && (
          <TelemetryReadout
            variant="abilities"
            store={telemetryStore}
            activeMode={activeMode}
            showTouchDpad={showTouchDpad}
            onTriggerGroundPound={handleTriggerGroundPound}
            onTriggerDash={handleTriggerDash}
          />
        )}

      {/* Contextual Board Parked UFO Prompt (Capytorio Only) */}
      {isCapytorioGame &&
        cosmicStage === 'playing' &&
        !universeScale.active &&
        !isFirstRunSetupOpen &&
        !webglError &&
        !isMenuOpen &&
        !isSettingsOpen &&
        !isAboutOpen &&
        !isPrivacyOpen &&
        !isTermsOpen &&
        !isFeedbackOpen &&
        !isJsonEditorOpen && (
          <TelemetryReadout
            variant="ufo_prompt"
            store={telemetryStore}
            activeMode={activeMode}
            onBoardUfo={() => {
              managerRef.current?.boardParkedUfoAndLaunch();
            }}
          />
        )}

      {/* Compact Bottom-Right Zoom In / Zoom Out Controls (Continuous Ground -> Orbit -> Cosmos) */}
      {!isFirstRunSetupOpen &&
        !webglError &&
        !isJsonEditorOpen &&
        !isSettingsOpen &&
        !isAboutOpen &&
        !isDebugReportOpen &&
        !isMenuOpen &&
        !isOpticsOpen &&
        !isScaleAtlasOpen &&
        !(
          cosmicStage === 'playing' &&
          !universeScale.active &&
          activeMode === 'capytorio' &&
          capytorioDrawerTab !== 'none'
        ) && (() => {
          const isCapytorioCompactZoom =
            cosmicStage === 'playing' && !universeScale.active && activeMode === 'capytorio';
          let positionClass = 'bottom-3 right-3';
          if (universeScale.active) {
            positionClass = 'bottom-[150px] sm:bottom-[96px] right-2';
          } else if (isCapytorioCompactZoom) {
            positionClass = 'bottom-[78px] right-2';
          } else if (showTouchDpad) {
            positionClass = 'bottom-[104px] right-3';
          } else if (gameSettings.touchControlsMode !== 'hidden') {
            positionClass = 'bottom-[68px] right-3';
          }
          return (
            <div
              data-testid="mobile-zoom-controls"
              aria-label="Camera Zoom Controls"
              className={`${
                isCapytorioCompactZoom
                  ? 'fixed z-30 pointer-events-auto flex flex-col gap-0.5 p-0.5 rounded-[3px] bg-[#1f2126]/95 border-2 border-[#3c4049] border-t-[#545966] border-l-[#4c515c] border-b-[#111216] border-r-[#111216] shadow-[0_8px_22px_rgba(0,0,0,0.65)] select-none'
                  : 'lg:hidden fixed z-30 pointer-events-auto flex flex-col gap-1 p-1 rounded-xl bg-zinc-950/92 border border-white/15 shadow-xl select-none'
              } ${positionClass}`}
            >
              <button
                type="button"
                data-testid="mobile-zoom-in-btn"
                aria-label="Zoom In"
                title="Zoom In [+]"
                onClick={() => stepMobileZoom(0.28)}
                onPointerDown={() => startMobileZoomHold(0.28)}
                onPointerUp={stopMobileZoomHold}
                onPointerLeave={stopMobileZoomHold}
                onPointerCancel={stopMobileZoomHold}
                className={
                  isCapytorioCompactZoom
                    ? 'w-8 h-8 rounded-[2px] bg-[#2b2e35] hover:bg-[#393d46] active:bg-[#e58926] active:text-[#151618] border border-[#4a4f5b] border-b-[#14161a] border-r-[#14161a] text-[#e4e6eb] flex items-center justify-center cursor-pointer'
                    : 'w-10 h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-sky-500/30 border border-white/12 text-zinc-100 flex items-center justify-center cursor-pointer'
                }
              >
                <Plus className={isCapytorioCompactZoom ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </button>
              <button
                type="button"
                data-testid="mobile-zoom-out-btn"
                aria-label="Zoom Out to Orbit"
                title="Zoom Out [-]"
                onClick={() => stepMobileZoom(-0.28)}
                onPointerDown={() => startMobileZoomHold(-0.28)}
                onPointerUp={stopMobileZoomHold}
                onPointerLeave={stopMobileZoomHold}
                onPointerCancel={stopMobileZoomHold}
                className={
                  isCapytorioCompactZoom
                    ? 'w-8 h-8 rounded-[2px] bg-[#2b2e35] hover:bg-[#393d46] active:bg-[#e58926] active:text-[#151618] border border-[#4a4f5b] border-b-[#14161a] border-r-[#14161a] text-[#e4e6eb] flex items-center justify-center cursor-pointer'
                    : 'w-10 h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-sky-500/30 border border-white/12 text-zinc-100 flex items-center justify-center cursor-pointer'
                }
              >
                <Minus className={isCapytorioCompactZoom ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </button>
            </div>
          );
        })()}

      {/* Live Box / Freeform Lasso Cut-Copy Selection SVG Overlay */}
      {capytorioSelectionOverlay && capytorioSelectionOverlay.active && (
        <svg
          data-testid="capytorio-selection-overlay"
          className="fixed inset-0 w-full h-full pointer-events-none z-20"
          aria-hidden="true"
        >
          {capytorioSelectionOverlay.shape === 'box' ? (
            <rect
              x={Math.min(capytorioSelectionOverlay.startX, capytorioSelectionOverlay.currentX)}
              y={Math.min(capytorioSelectionOverlay.startY, capytorioSelectionOverlay.currentY)}
              width={Math.abs(capytorioSelectionOverlay.currentX - capytorioSelectionOverlay.startX)}
              height={Math.abs(capytorioSelectionOverlay.currentY - capytorioSelectionOverlay.startY)}
              fill={
                capytorioSelectionOverlay.mode === 'cut'
                  ? 'rgba(249, 115, 22, 0.16)'
                  : 'rgba(56, 189, 248, 0.16)'
              }
              stroke={capytorioSelectionOverlay.mode === 'cut' ? '#fb923c' : '#38bdf8'}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          ) : (
            capytorioSelectionOverlay.points.length >= 2 && (
              <polygon
                points={capytorioSelectionOverlay.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill={
                  capytorioSelectionOverlay.mode === 'cut'
                    ? 'rgba(249, 115, 22, 0.14)'
                    : 'rgba(56, 189, 248, 0.14)'
                }
                stroke={capytorioSelectionOverlay.mode === 'cut' ? '#fb923c' : '#38bdf8'}
                strokeWidth={2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray="6 4"
              />
            )
          )}
        </svg>
      )}

      {/* Capytorio 3D Factory HUD (Simplified Factorio Quickbar + Top-Right Info & Menu) */}
      {cosmicStage === 'playing' &&
        !universeScale.active &&
        activeMode === 'capytorio' &&
        !webglError &&
        !isMenuOpen &&
        !isSettingsOpen &&
        !isAboutOpen &&
        !isPrivacyOpen &&
        !isTermsOpen &&
        !isFeedbackOpen &&
        !isJsonEditorOpen &&
        capytorioSnap && (
          <Suspense fallback={null}>
            <LazyCapytorioHud
              snap={capytorioSnap}
              isTopBarVisible={isTopBarVisible}
              isPaused={isGamePaused}
              onTogglePause={toggleGamePause}
              pointerHoverActive={capytorioPointerHoverActive}
              clipboardMoveMode={capytorioClipboardMoveMode}
              onToggleClipboardMoveMode={() => {
                const next = !capytorioClipboardMoveMode;
                setCapytorioClipboardMoveMode(next);
                if (next) {
                  managerRef.current?.unlockCapytorioBlueprintAnchor();
                  showToast('Move mode — drag anywhere or use WASD to move while keeping blueprint');
                }
              }}
              drawerTab={capytorioDrawerTab}
              setDrawerTab={setCapytorioDrawerTab}
              craftGroup={capytorioCraftGroup}
              setCraftGroup={setCapytorioCraftGroup}
              selectedCraftRecipeId={selectedCraftRecipeId}
              setSelectedCraftRecipeId={setSelectedCraftRecipeId}
              luaCatalogInfo={luaCatalogInfo}
              setLuaCatalogInfo={setLuaCatalogInfo}
              pediaEntryId={capytorioPediaEntryId}
              pediaContextInfo={capytorioPediaContextInfo}
              searchFocusNonce={capytorioSearchFocusNonce}
              onOpenPedia={openCapytorioPedia}
              showToast={showToast}
              {...capytorioHudActions}
            />
          </Suspense>
        )}

      {/* Optional On-Screen Steering Pad (Hidden unless explicitly set to 'always' in Settings) */}
      {showTouchDpad && (
        <div
          data-testid="touch-dpad-controls"
          className="fixed bottom-3 right-3 hud-safe-bottom-right z-20 flex flex-col items-center gap-1 pointer-events-auto"
        >
          <button
            type="button"
            onPointerDown={() => setVirtualInput(0, -1)}
            onPointerUp={() => setVirtualInput(0, 0)}
            onPointerLeave={() => setVirtualInput(0, 0)}
            className="w-10 h-10 rounded-lg bg-zinc-950/90 active:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-mono shadow-lg flex items-center justify-center"
            aria-label="Move Forward"
          >
            N
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onPointerDown={() => setVirtualInput(-1, 0)}
              onPointerUp={() => setVirtualInput(0, 0)}
              onPointerLeave={() => setVirtualInput(0, 0)}
              className="w-10 h-10 rounded-lg bg-zinc-950/90 active:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-mono shadow-lg flex items-center justify-center"
              aria-label="Turn Left"
            >
              W
            </button>
            <button
              type="button"
              onPointerDown={() => setVirtualInput(0, 1)}
              onPointerUp={() => setVirtualInput(0, 0)}
              onPointerLeave={() => setVirtualInput(0, 0)}
              className="w-10 h-10 rounded-lg bg-zinc-950/90 active:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-mono shadow-lg flex items-center justify-center"
              aria-label="Move Backward"
            >
              S
            </button>
            <button
              type="button"
              onPointerDown={() => setVirtualInput(1, 0)}
              onPointerUp={() => setVirtualInput(0, 0)}
              onPointerLeave={() => setVirtualInput(0, 0)}
              className="w-10 h-10 rounded-lg bg-zinc-950/90 active:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-mono shadow-lg flex items-center justify-center"
              aria-label="Turn Right"
            >
              E
            </button>
          </div>
        </div>
      )}

      {/* ABOUT CAPYGAME & HELP / TUTORIALS MODAL (LAZY-LOADED) */}
      {isAboutOpen && (
        <React.Suspense fallback={null}>
          <LazyCapyAboutModal
            onClose={() => setIsAboutOpen(false)}
            onStartTutorial={handleStartTutorial}
            onOpenSettings={() => {
              setIsAboutOpen(false);
              setIsSettingsOpen(true);
            }}
            onOpenFeedback={() => {
              setIsAboutOpen(false);
              setIsFeedbackOpen(true);
            }}
            onOpenPrivacy={() => {
              setIsAboutOpen(false);
              setIsPrivacyOpen(true);
            }}
            onOpenTerms={() => {
              setIsAboutOpen(false);
              setIsTermsOpen(true);
            }}
          />
        </React.Suspense>
      )}

      {/* SETTINGS MODAL (Lazily Loaded) */}
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <LazyCapySettingsModal
            stats={stats}
            isAdvancedMode={isAdvancedMode}
            gameSettings={gameSettings}
            isMuted={isMuted}
            snakeTelemetry={snakeTelemetry}
            perfLog={perfLog}
            gpuTelemetry={gpuTelemetry}
            pwaStatus={pwaStatus}
            proceduralConfig={proceduralConfig}
            isSaveJsonPasteOpen={isSaveJsonPasteOpen}
            saveJsonDraft={saveJsonDraft}
            savePortabilityFeedback={savePortabilityFeedback}
            onClose={() => setIsSettingsOpen(false)}
            onUpdateGameSettings={updateGameSettings}
            onSwitchToBasicMode={() => {
              updateGameSettings({ advancedMode: false });
              setIsOpticsOpen(false);
              setIsPerfLogOpen(false);
              setIsJsonEditorOpen(false);
              if (activeTab === 'dna' || activeTab === 'upgrades') {
                setActiveTab('modes');
              }
            }}
            onToggleMute={handleToggleMute}
            onSetCapytorioCameraMode={(nextCam) => {
              updateGameSettings({ capytorioCameraMode: nextCam });
              managerRef.current?.setCapytorioCameraMode(nextCam);
            }}
            onSetCapytorioBeltEndSpill={(nextSpill) => {
              updateGameSettings({ capytorioBeltEndSpill: nextSpill });
              managerRef.current?.setCapytorioBeltEndSpill(nextSpill);
            }}
            onReturnToCapytorioBeacon={() => {
              managerRef.current?.returnToCapytorioBeacon();
              setIsSettingsOpen(false);
              showToast('Returned to Survey Beacon (0, 0)');
            }}
            onLockMouselook={() => {
              setIsSettingsOpen(false);
              setFreeMouselookActive(true);
            }}
            onToggleFpsButton={(next) => {
              updateGameSettings({ showFpsButton: next });
              if (!next) setIsPerfLogOpen(false);
            }}
            onUnlockAllFeatures={handleUnlockAllFeatures}
            onOpenAbout={() => {
              setIsSettingsOpen(false);
              setIsAboutOpen(true);
            }}
            onOpenFeedback={() => {
              setIsSettingsOpen(false);
              setIsFeedbackOpen(true);
            }}
            onOpenPrivacy={() => {
              setIsSettingsOpen(false);
              setIsPrivacyOpen(true);
            }}
            onOpenTerms={() => {
              setIsSettingsOpen(false);
              setIsTermsOpen(true);
            }}
            onOpenJsonEditor={handleOpenJsonEditor}
            onResetProgress={handleResetProgress}
            onExportSaveBundleFile={handleExportSaveBundleFile}
            onCopySaveBundleJson={() => void handleCopySaveBundleJson()}
            onToggleSaveJsonPasteOpen={() => setIsSaveJsonPasteOpen((prev) => !prev)}
            onChangeSaveJsonDraft={setSaveJsonDraft}
            onApplyImportedSaveBundle={applyImportedSaveBundle}
          />
        </Suspense>
      )}

      {/* EMBEDDED PRIVACY POLICY MODAL (Lazily Loaded) */}
      {isPrivacyOpen && (
        <Suspense fallback={null}>
          <LazyCapyPrivacyModal onClose={() => setIsPrivacyOpen(false)} />
        </Suspense>
      )}

      {/* EMBEDDED TERMS OF SERVICE MODAL (Lazily Loaded) */}
      {isTermsOpen && (
        <Suspense fallback={null}>
          <LazyCapyTermsModal onClose={() => setIsTermsOpen(false)} />
        </Suspense>
      )}

      {/* ANONYMOUS IN-GAME FEEDBACK MODAL (Lazily Loaded) */}
      {isFeedbackOpen && (
        <Suspense fallback={null}>
          <LazyCapyFeedbackModal
            activeMode={universeScale.active ? 'cosmic' : activeMode}
            onClose={() => setIsFeedbackOpen(false)}
          />
        </Suspense>
      )}

      {/* FIRST-TIME GENESIS LAUNCH CONFIGURATOR (Lazily Loaded) */}
      {isFirstRunSetupOpen && !webglError && !isJsonEditorOpen && !isSettingsOpen && (
        <Suspense fallback={null}>
          <LazyCapyFirstRunSetupModal
            proceduralConfig={proceduralConfig}
            firstRunTab={firstRunTab}
            universeScaleLogMeters={universeScale.logScaleMeters}
            onSelectTab={setFirstRunTab}
            onApplyDraftUpdate={applyFirstRunDraftUpdate}
            onPreviewScale={(log) => {
              managerRef.current?.setCruiseVelocity(0);
              managerRef.current?.setSeamlessLogScale(log, true);
            }}
            onCompleteSetup={handleCompleteFirstRunSetup}
          />
        </Suspense>
      )}

      {/* =====================================================================
          BOTTOM-RIGHT FLIGHT CONTROLS: STRAIGHT/SPIRAL TOGGLE + 3 SPEED BUTTONS
          Just 3 speed buttons (Rewind, Play/Pause, Fast Forward) + Straight/Spiral toggle.
         ===================================================================== */}
      {universeScale.active &&
        !isFirstRunSetupOpen &&
        !webglError &&
        !isJsonEditorOpen &&
        !isSettingsOpen &&
        !isAboutOpen &&
        !isDebugReportOpen &&
        !isMenuOpen &&
        !isOpticsOpen && (() => {
          const activeVel =
            universeScale.autoZoomDir === 0 ? 0 : universeScale.cruiseVelocityLogPerSec;
          const isPaused = universeScale.autoZoomDir === 0 || Math.abs(activeVel) < 0.05;
          const isRewinding = !isPaused && activeVel > 0;
          const isFastForward = !isPaused && activeVel < 0;
          const isSpiral =
            (universeScale.flightTrajectory ?? gameSettings.flightTrajectory ?? 'spiral') ===
            'spiral';
          return (
            <aside
              data-testid="right-flight-speed-panel"
              aria-label="Flight Trajectory and Speed Controls"
              className="fixed right-2 bottom-[62px] sm:bottom-2 hud-safe-flight-panel z-30 pointer-events-auto flex flex-col items-end gap-1.5 select-none"
            >
              <button
                type="button"
                data-testid="toggle-flight-trajectory-btn"
                aria-pressed={isSpiral}
                onClick={() => {
                  const next = isSpiral ? 'straight' : 'spiral';
                  updateGameSettings({
                    flightTrajectory: next,
                    flightTrajectoryUserSelected: true,
                  });
                  managerRef.current?.setFlightTrajectory(next);
                }}
                title={
                  isSpiral
                    ? 'Spiral Flight: Curves 360° around each zoom level (tap for Straight)'
                    : 'Straight Flight: Direct path (tap for 360° Spiral curve)'
                }
                aria-label={`Flight Path: ${isSpiral ? 'Spiral' : 'Straight'}`}
                className={`h-7 px-2 rounded-lg border flex items-center gap-1 text-[10px] font-medium shadow-lg cursor-pointer transition-colors whitespace-nowrap ${
                  isSpiral
                    ? 'bg-violet-500/25 border-violet-400/60 text-violet-100'
                    : 'bg-zinc-950/90 hover:bg-zinc-900 border-white/15 text-zinc-200'
                }`}
              >
                {isSpiral ? (
                  <Orbit className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                ) : (
                  <MoveRight className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                )}
                <span>{isSpiral ? 'Spiral' : 'Straight'}</span>
              </button>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950/92 border border-white/15 shadow-xl text-zinc-100">
                <button
                  type="button"
                  data-testid="speed-rewind-btn"
                  onClick={() => managerRef.current?.applyMediaSpeedControl('rewind')}
                  title="Rewind"
                  aria-label="Rewind"
                  aria-pressed={isRewinding}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                    isRewinding
                      ? 'bg-amber-500/25 border-amber-400/65 text-amber-200'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
                  }`}
                >
                  <Rewind className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  data-testid="speed-play-pause-btn"
                  onClick={() => managerRef.current?.applyMediaSpeedControl('play_pause')}
                  title={isPaused ? 'Play' : 'Pause'}
                  aria-label={isPaused ? 'Play' : 'Pause'}
                  aria-pressed={!isPaused}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                    !isPaused
                      ? 'bg-cyan-500/25 border-cyan-400/65 text-cyan-200'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
                  }`}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="button"
                  data-testid="speed-fast-forward-btn"
                  onClick={() => managerRef.current?.applyMediaSpeedControl('fast_forward')}
                  title="Fast Forward"
                  aria-label="Fast Forward"
                  aria-pressed={isFastForward}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                    isFastForward
                      ? 'bg-cyan-500/25 border-cyan-400/65 text-cyan-200'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
                  }`}
                >
                  <FastForward className="w-4 h-4" />
                </button>
              </div>
            </aside>
          );
        })()}

      {/* =====================================================================
          INFINITE ZOOM BOTTOM STATUS BAR & QUICK GAME-SKIP BUTTONS
          Displays the active zoom level name and scale alongside direct
          Forest and Capytorio skip buttons cleanly across mobile & desktop.
         ===================================================================== */}
      {universeScale.active &&
        !isFirstRunSetupOpen &&
        !webglError &&
        !isJsonEditorOpen &&
        !isSettingsOpen &&
        (isAdvancedMode || universeScale.ufoFlightPhase !== 'orbital_descent') && (() => {
          const currentBand = UNIVERSE_SCALE_BANDS[universeScale.bandIndex];
          const shortZoomName =
            universeScale.bandId === 'leaf_fur_micro' && universeScale.forestSpecimenLabel
              ? `Leaf & Fur · ${universeScale.forestSpecimenLabel}`
              : currentBand?.shortLabel || universeScale.bandTitle || 'Infinite Zoom';
          const fullZoomName =
            universeScale.bandId === 'leaf_fur_micro' && universeScale.forestSpecimenLabel
              ? `Leaf & Fur · ${universeScale.forestSpecimenLabel}`
              : universeScale.bandTitle || currentBand?.shortLabel || 'Infinite Zoom';
          const mobileZoomLabel = isCapytorioOrbitalFlight
            ? `Capytorio UFO · ${shortZoomName}`
            : shortZoomName;
          const desktopZoomLabel = isCapytorioOrbitalFlight
            ? `Capytorio UFO · ${fullZoomName}`
            : fullZoomName;

          return (
            <div
              data-testid="chrono-vessel-flight-strip"
              className="fixed bottom-2 hud-safe-bottom left-2 right-2 sm:right-auto sm:w-auto sm:max-w-[calc(100vw-152px)] xl:left-1/2 xl:-translate-x-1/2 xl:max-w-[min(760px,calc(100vw-304px))] z-30 pointer-events-auto bg-zinc-950/95 border border-cyan-400/30 rounded-xl shadow-2xl px-2 sm:px-2.5 py-1.5 text-zinc-100"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Rocket className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <div className="min-w-0 flex flex-col leading-tight">
                    <span
                      data-testid="flight-strip-band-name"
                      className="text-xs font-semibold text-zinc-100 truncate"
                      title={desktopZoomLabel}
                    >
                      <span className="sm:hidden">{mobileZoomLabel}</span>
                      <span className="hidden sm:inline">{desktopZoomLabel}</span>
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-zinc-400 truncate">
                      <span className="text-amber-300/95 shrink-0">
                        {universeScale.scientificLabel}
                      </span>
                      <span className="hidden md:inline text-zinc-500 truncate">
                        ({universeScale.scaleFormatted})
                      </span>
                      {isAdvancedMode && (
                        <>
                          <span className="text-zinc-600 shrink-0">·</span>
                          <span
                            data-testid="flight-strip-epoch"
                            className="text-cyan-300 shrink-0"
                          >
                            T+{universeScale.cosmicAgeGyr.toFixed(2)} Gyr
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isCapytorioOrbitalFlight && universeScale.bandId === 'leaf_fur_micro' && (
                    <button
                      type="button"
                      data-testid="shuffle-forest-specimen-btn"
                      onClick={() => {
                        AudioService.playUiClick('select');
                        managerRef.current?.rerollForestSpecimen();
                      }}
                      title="Pick a random Forest Glade specimen"
                      aria-label="Shuffle Forest Glade Specimen"
                      className="h-8 px-2 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/45 text-[11px] font-medium cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Shuffle className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">
                        {universeScale.forestSpecimenLabel || 'Specimen'}
                      </span>
                    </button>
                  )}

                  {isCapytorioOrbitalFlight ? (
                    <button
                      type="button"
                      data-testid="chrono-land-capytorio-btn"
                      onClick={() => managerRef.current?.engageCapytorioLanding()}
                      className="h-8 px-2.5 sm:px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Land in Capytorio
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        data-testid="flight-strip-go-forest-btn"
                        onClick={() => handleSwitchTopLevelGame('forest_games')}
                        title="Skip straight to Forest Games"
                        aria-label="Go to Forest Games"
                        className="h-8 px-2 sm:px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/40 text-emerald-100 border border-emerald-400/50 text-[11px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Trees className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                        <span>Forest</span>
                      </button>
                      <button
                        type="button"
                        data-testid="flight-strip-go-capytorio-btn"
                        onClick={() => handleSwitchTopLevelGame('capytorio')}
                        title="Skip straight to Capytorio"
                        aria-label="Go to Capytorio"
                        className="h-8 px-2 sm:px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 text-amber-100 border border-amber-400/50 text-[11px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Factory className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span>Capytorio</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* =====================================================================
          BUILT-IN LIVE PROCEDURAL JSON CONFIG EDITOR MODAL (LAZY-LOADED)
         ===================================================================== */}
      {isJsonEditorOpen && (
        <React.Suspense fallback={null}>
          <LazyCapyJsonConfigModal
            proceduralConfig={proceduralConfig}
            jsonDraftText={jsonDraftText}
            jsonValidationError={jsonValidationError}
            jsonValidationWarnings={jsonValidationWarnings}
            jsonCopyLabel={jsonCopyLabel}
            onClose={() => setIsJsonEditorOpen(false)}
            onSelectPreset={handleSelectProceduralPreset}
            onRandomizeSeed={handleRandomizeProceduralSeed}
            onFormatDraft={handleFormatJsonDraft}
            onCopyDraft={handleCopyJsonDraft}
            onResetDefault={handleResetProceduralDefault}
            onDraftChange={handleJsonDraftChange}
            onApplyConfig={handleApplyJsonConfig}
          />
        </React.Suspense>
      )}

      {/* Simulation Paused & Hibernated Overlay */}
      {isGamePaused && (
        <div
          data-testid="game-paused-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Simulation Paused"
          className="fixed inset-0 z-50 bg-zinc-950/75 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
        >
          <div className="w-full max-w-sm rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
              <Pause className="w-6 h-6 text-amber-300" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">
                Simulation Paused
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Render loop, Wasm physics worker, GPU post-processing buffers, and audio are suspended to save CPU and RAM.
              </p>
            </div>
            <button
              type="button"
              data-testid="resume-game-btn"
              onClick={() => setGamePaused(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-semibold transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Simulation</span>
              <span className="text-[11px] font-mono opacity-75">[P]</span>
            </button>
          </div>
        </div>
      )}
      {/* NON-BLOCKING ACTIVE TUTORIAL STEP BANNER (Lazily Loaded) */}
      {activeTutorial &&
        !isAboutOpen &&
        !isSettingsOpen &&
        !isPrivacyOpen &&
        !isTermsOpen &&
        !isFeedbackOpen &&
        !isJsonEditorOpen &&
        !isDebugReportOpen &&
        !isMenuOpen &&
        !isScaleAtlasOpen &&
        !isOpticsOpen &&
        !isInfographicExpanded &&
        !isPerfLogOpen &&
        !isGamePaused &&
        !webglError && (
          <Suspense fallback={null}>
            <LazyCapyTutorialBanner
              activeTutorial={activeTutorial}
              isFirstRunSetupOpen={isFirstRunSetupOpen}
              onClose={() => setActiveTutorial(null)}
              onOpenAllTutorials={() => setIsAboutOpen(true)}
              onStepChange={(next, finishedTitle) => {
                setActiveTutorial(next);
                if (!next && finishedTitle) {
                  showToast(`Finished: ${finishedTitle}`);
                }
              }}
            />
          </Suspense>
        )}
    </div>
  );
};
