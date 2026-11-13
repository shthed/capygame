import React, { useEffect, useRef, useState } from 'react';
import {
  AstrophysicsPaletteMode,
  PlayStyle,
  PlayerStats,
  CapyGameSettings,
  CapyLodTier,
  CapySnakeTelemetry,
  LiveModeTelemetry,
  BUILDING_CATALOG,
  BuildingCatalogItem,
  SPORE_MUTATIONS,
  MutationId,
  ZONE_LOCATIONS,
  PROGRESSIVE_UNLOCKS,
  COSMIC_GALAXIES,
  CosmicStage,
  ChronoVesselViewMode,
  GPU_VISUAL_FILTER_PROFILES,
  GpuEngineTelemetry,
  GpuQualityPreset,
  GpuShadowQualityMode,
  GpuTextureFilterMode,
  GpuToneMappingMode,
  GpuVisualFilterPreset,
  MAX_UNIVERSE_LOG_METERS,
  MIN_UNIVERSE_LOG_METERS,
  OBJECT_MARKERS_COIN_COST,
  OBJECT_MARKERS_DNA_COST,
  PLAYABLE_CAPY_HEROES,
  REALITY_RESCALER_COIN_COST,
  REALITY_RESCALER_DNA_COST,
  UNIVERSE_SCALE_BANDS,
  UniverseScaleTelemetry,
  WeatherType,
  formatPhysicalScaleMeters,
  OrbitTelemetry,
  OrbitTimeScaleId,
  ORBIT_TIME_SCALES,
} from '../types';
import { ProgressionService } from '../services/ProgressionService';
import {
  PlacementGhostStatus,
  PlayStyleManager,
} from '../engine/PlayStyleManager';
import type { PhysicsEngineTelemetry } from '../engine/physics/PhysicsTypes';
import { CosmicSimTelemetry } from '../engine/CosmicUniverseBuilder';
import { AudioService } from '../services/AudioService';
import { NativeBridge } from '../../services/NativeBridge';
import { PwaService } from '../../services/PwaService';
import {
  ProceduralGameConfig,
  PROCEDURAL_CONFIG_PRESETS,
  CODATA_FINE_STRUCTURE_INVERSE,
  FINE_STRUCTURE_MIN_INVERSE,
  FINE_STRUCTURE_MAX_INVERSE,
  computeFineStructurePhysics,
  hasCompletedFirstRunSetup,
  markFirstRunSetupComplete,
  loadSavedProceduralConfig,
  saveProceduralConfig,
  resetSavedProceduralConfig,
  parseAndValidateProceduralConfig,
  cloneProceduralConfig,
} from '../config/ProceduralGameConfig';
import {
  Sparkles,
  Volume2,
  VolumeX,
  Dna,
  Hammer,
  Crown,
  RotateCcw,
  Plus,
  Minus,
  ArrowUpCircle,
  Trophy,
  ChevronUp,
  ChevronDown,
  Compass,
  Settings as SettingsIcon,
  Info,
  Camera,
  Check,
  X,
  Menu,
  Lock,
  Unlock,
  AlertTriangle,
  Crosshair,
  Code2,
  Rocket,
  Eye,
  Pause,
  Play,
  Copy,
  Download,
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
      'Collect oranges matching the color perched on your head to grow your Capybara body like a Dachshund snake, place structures, or enter the 4 outer portals.',
    requiredDna: 0,
  },
  {
    id: 'spore',
    title: 'Spore Lagoon',
    subtitle: 'Evolution Atoll & Plankton Hunt',
    compass: 'NW (-75, -75)',
    accentColor: '#34d399',
    description:
      'Navigate the North-West Lagoon, harvest plankton and DNA helixes, and splice 3D traits.',
    requiredDna: 5,
  },
  {
    id: 'breakout',
    title: 'Yuzu Breakout',
    subtitle: '3D Deflector & Crystal Waves',
    compass: 'NE (+75, -75)',
    accentColor: '#fbbf24',
    description:
      'Control the deflector in the North-East sector to ricochet spheres into crystal arrays.',
    requiredDna: 12,
  },
  {
    id: 'runner',
    title: 'Number Stampede',
    subtitle: 'Math Gate Herd Multiplier Highway',
    compass: 'SW (-75, +75)',
    accentColor: '#60a5fa',
    description:
      'Guide a 3D formation down the South-West causeway through arithmetic multiplier gates.',
    requiredDna: 20,
  },
  {
    id: 'fallguys',
    title: 'Yuzu Mountain',
    subtitle: 'Kinetic Obstacles & Ascent Course',
    compass: 'SE (+75, +75)',
    accentColor: '#a78bfa',
    description:
      'Ascend the South-East gauntlet past rotating kinetic pendulums and tilting platforms.',
    requiredDna: 30,
  },
];

const ABILITY_UPGRADE_LIST: Array<{
  id: keyof PlayerStats['upgrades'];
  name: string;
  description: string;
}> = [
  {
    id: 'speedBoost',
    name: 'Locomotion Velocity',
    description: 'Increases surface and aquatic traversal speed across all 5 world sectors.',
  },
  {
    id: 'yuzuMagnet',
    name: 'Field Attraction Radius',
    description: 'Expands the collection radius for energy spheres and DNA nodes.',
  },
  {
    id: 'bounciness',
    name: 'Vertical Impulse Boost',
    description: 'Increases vertical leap impulse across surface pads and ascent courses.',
  },
  {
    id: 'herdSize',
    name: 'Initial Formation Count',
    description: 'Adds starting companion units in the South-West causeway sector.',
  },
  {
    id: 'paddleSize',
    name: 'Deflector Span',
    description: 'Widens the horizontal deflector span in the North-East sector.',
  },
];

const WARDROBE_HATS: Array<{
  id: string;
  name: string;
  description: string;
}> = [
  {
    id: 'yuzu',
    name: 'Citrus Crest',
    description: ' minimal botanical crest.',
  },
  {
    id: 'crown',
    name: 'Gold Diadem',
    description: 'Geometric metallic crown.',
  },
  {
    id: 'flower',
    name: 'Flora Emblem',
    description: 'Botanical surface specimen.',
  },
  {
    id: 'wizard',
    name: 'Spire Cone',
    description: 'Angular spire headgear.',
  },
  {
    id: 'halo',
    name: 'Orbital Ring',
    description: 'Suspended luminous ring.',
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
  const [gameSettings, setGameSettings] = useState<CapyGameSettings>(() =>
    ProgressionService.loadSettings()
  );
  const [activeMode, setActiveMode] = useState<PlayStyle>(
    () => stats.selectedPlayStyle || 'sanctuary'
  );
  const [activeTab, setActiveTab] = useState<DockTab>('modes');

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [isInfographicExpanded, setIsInfographicExpanded] = useState<boolean>(false);
  const [allFeaturesUnlocked, setAllFeaturesUnlocked] = useState<boolean>(false);

  const [isMuted, setIsMuted] = useState<boolean>(() => AudioService.getMuted());
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState<boolean>(false);
  const [isFirstRunSetupOpen, setIsFirstRunSetupOpen] = useState<boolean>(() => {
    try {
      if (
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('skip_cosmic') === '1'
      ) {
        return false;
      }
    } catch {
      // ignore
    }
    return !hasCompletedFirstRunSetup();
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
  const [isFlightStripCollapsed, setIsFlightStripCollapsed] = useState<boolean>(false);
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
    msaaSamples: 0,
    bloomEnabled: true,
    ssaoEnabled: true,
    sharpenAmount: 0.24,
    drawCalls: 0,
    triangles: 0,
    texturesInVram: 0,
    geometriesInVram: 0,
    shaderPrograms: 0,
    registeredPbrTextures: 0,
  });

  const modalOpenRef = useRef<boolean>(false);
  modalOpenRef.current = isSettingsOpen || isAboutOpen || isJsonEditorOpen;
  const menuOpenRef = useRef<boolean>(false);
  menuOpenRef.current = isMenuOpen;

  // Cosmic Genesis & Multi-Scale Universe State
  const [cosmicStage, setCosmicStage] = useState<CosmicStage>(() => {
    try {
      if (
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('skip_cosmic') === '1'
      ) {
        return 'playing';
      }
    } catch {
      // Ignore URL parsing issues
    }
    return 'singularity';
  });
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
  const [isOpticsOpen, setIsOpticsOpen] = useState<boolean>(false);
  const [universeScale, setUniverseScale] = useState<UniverseScaleTelemetry>(() => ({
    active: false,
    logScaleMeters: 28.0,
    targetLogScaleMeters: 28.0,
    scaleFormatted: formatPhysicalScaleMeters(28.0),
    scientificLabel: '10^+28.0 m',
    bandId: 'big_bang',
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
    cruiseVelocityLogPerSec: -2.2,
    vesselMode: 'chase_pod',
    fineStructureInverse: CODATA_FINE_STRUCTURE_INVERSE,
    fineStructureAlpha: 1 / CODATA_FINE_STRUCTURE_INVERSE,
  }));

  // Mobile Touch Virtual Joystick visual state
  const [touchVisual, setTouchVisual] = useState<TouchDragVisualState>({
    active: false,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
  });

  const pointerGestureRef = useRef<{
    pointerId: number | null;
    originX: number;
    originY: number;
    startTime: number;
    maxDist: number;
    pinchDist: number | null;
  }>({
    pointerId: null,
    originX: 0,
    originY: 0,
    startTime: 0,
    maxDist: 0,
    pinchDist: null,
  });

  const [telemetry, setTelemetry] = useState<LiveModeTelemetry>({
    mode: 'sanctuary',
    primaryLabel: 'Dachshund Body',
    primaryValue: '2.3m (1)',
    secondaryLabel: 'Head Orange',
    secondaryValue: 'Tangerine',
    zoneCoordsLabel: 'Center (0, 0)',
  });

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

  const showToast = (msg: string) => {
    setToastText(msg);
    window.setTimeout(() => {
      setToastText((prev) => (prev === msg ? null : prev));
    }, 2600);
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
    const anyOpen =
      isAboutOpen ||
      isSettingsOpen ||
      isJsonEditorOpen ||
      isMenuOpen ||
      isScaleAtlasOpen ||
      isOpticsOpen ||
      isInfographicExpanded;
    NativeBridge.setBackModalOpen(anyOpen, () => {
      if (isAboutOpen) setIsAboutOpen(false);
      else if (isSettingsOpen) setIsSettingsOpen(false);
      else if (isJsonEditorOpen) setIsJsonEditorOpen(false);
      else if (isOpticsOpen) setIsOpticsOpen(false);
      else if (isScaleAtlasOpen) setIsScaleAtlasOpen(false);
      else if (isInfographicExpanded) setIsInfographicExpanded(false);
      else if (isMenuOpen) setIsMenuOpen(false);
    });
  }, [
    isAboutOpen,
    isSettingsOpen,
    isJsonEditorOpen,
    isMenuOpen,
    isScaleAtlasOpen,
    isOpticsOpen,
    isInfographicExpanded,
  ]);

  useEffect(() => {
    if (!mountRef.current) return;

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('simulate_webgl_error') === '1') {
        setWebglError('Simulated WebGL 3D context initialization failure.');
        return;
      }
    } catch {
      // Ignore URL parsing issues
    }

    const initialStats = ProgressionService.loadStats(true);
    setStats(initialStats);
    const initialSettings = ProgressionService.loadSettings();

    let manager: PlayStyleManager;
    try {
      manager = new PlayStyleManager(mountRef.current, initialStats, initialSettings, {
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
        onTelemetryUpdate: (live: LiveModeTelemetry) => {
          setTelemetry(live);
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
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to initialize WebGL 3D graphics context.';
      setWebglError(message);
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
    setSimStats(manager.cosmicBuilder.getSimulationStats());
    setCosmicSimInfo(manager.cosmicBuilder.getCosmicSimTelemetry());
    setSnakeTelemetry(manager.getCapySnakeTelemetry());
    setUniverseScale(manager.getUniverseScaleTelemetry());
    setGpuTelemetry(manager.getGpuEngineTelemetry());

    let animFrameId = 0;
    let lastTime = performance.now();
    let uiSyncAccum = 0;
    let paceTimerId: number | null = null;
    let activeFenceSync: WebGLSync | null = null;
    let modalWakeParity = 0;
    const glCtx = manager.isSoftwareGl
      ? (manager.renderer.getContext() as WebGL2RenderingContext | null)
      : null;

    const scheduleNextFrame = (didDrawGl: boolean) => {
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
          const poll = () => {
            if (glCtx.isContextLost()) {
              activeFenceSync = null;
              return;
            }
            const state = glCtx.getSyncParameter(sync, glCtx.SYNC_STATUS);
            if (state === glCtx.UNSIGNALED) {
              paceTimerId = window.setTimeout(poll, 5);
            } else {
              glCtx.deleteSync(sync);
              if (activeFenceSync === sync) activeFenceSync = null;
              paceTimerId = window.setTimeout(() => {
                paceTimerId = null;
                animFrameId = window.requestAnimationFrame(animate);
              }, delayMs);
            }
          };
          paceTimerId = window.setTimeout(poll, 5);
          return;
        }
      }
      paceTimerId = window.setTimeout(() => {
        paceTimerId = null;
        animFrameId = window.requestAnimationFrame(animate);
      }, delayMs);
    };

    const animate = (now: number) => {
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

      const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      uiSyncAccum += dt;

      manager.tick(dt, dt);

      if (uiSyncAccum >= 0.35) {
        uiSyncAccum = 0;
        if (manager.cosmicStage !== 'playing') {
          setSimStats(manager.cosmicBuilder.getSimulationStats());
          setCosmicSimInfo(manager.cosmicBuilder.getCosmicSimTelemetry());
        } else {
          setPhysicsTelemetry(manager.getPhysicsTelemetry());
        }
        setGpuTelemetry(manager.getGpuEngineTelemetry());
        setSnakeTelemetry(manager.getCapySnakeTelemetry());
      }

      scheduleNextFrame(true);
    };
    animFrameId = window.requestAnimationFrame(animate);

    const handleResize = () => {
      if (!mountRef.current || !managerRef.current) return;
      managerRef.current.handleResize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!managerRef.current) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') managerRef.current.moveInput.z = -1;
      if (key === 's' || key === 'arrowdown') managerRef.current.moveInput.z = 1;
      if (key === 'a' || key === 'arrowleft') managerRef.current.moveInput.x = -1;
      if (key === 'd' || key === 'arrowright') managerRef.current.moveInput.x = 1;
      if (key === ' ') managerRef.current.isJumping = true;
      if (key === '=' || key === '+' || key === ']') {
        managerRef.current.adjustZoom(0.18);
      }
      if (key === '-' || key === '_' || key === '[') {
        managerRef.current.adjustZoom(-0.18);
      }
      if (key === 'escape') {
        managerRef.current.cancelBuildingPlacementGhost();
        setIsScaleAtlasOpen(false);
        setIsOpticsOpen(false);
        setIsInfographicExpanded(false);
        setIsAboutOpen(false);
        setIsSettingsOpen(false);
        setIsJsonEditorOpen(false);
        setIsMenuOpen(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!managerRef.current) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup' || key === 's' || key === 'arrowdown') {
        managerRef.current.moveInput.z = 0;
      }
      if (key === 'a' || key === 'arrowleft' || key === 'd' || key === 'arrowright') {
        managerRef.current.moveInput.x = 0;
      }
    };

    const containerEl = mountRef.current;
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
    };

    containerEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    containerEl.addEventListener('touchmove', handleTouchMove, { passive: true });
    containerEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    containerEl.addEventListener('wheel', handleWheel, { passive: false });

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.cancelAnimationFrame(animFrameId);
      if (paceTimerId !== null) {
        window.clearTimeout(paceTimerId);
      }
      if (activeFenceSync && glCtx && !glCtx.isContextLost()) {
        glCtx.deleteSync(activeFenceSync);
        activeFenceSync = null;
      }
      containerEl.removeEventListener('touchstart', handleTouchStart);
      containerEl.removeEventListener('touchmove', handleTouchMove);
      containerEl.removeEventListener('touchend', handleTouchEnd);
      containerEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  useEffect(() => {
    managerRef.current?.updateStats(stats);
  }, [stats]);

  useEffect(() => {
    managerRef.current?.setAllFeaturesUnlocked(allFeaturesUnlocked);
  }, [allFeaturesUnlocked]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!managerRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors on synthetic events
    }

    pointerGestureRef.current.pointerId = e.pointerId;
    pointerGestureRef.current.originX = e.clientX;
    pointerGestureRef.current.originY = e.clientY;
    pointerGestureRef.current.startTime = performance.now();
    pointerGestureRef.current.maxDist = 0;

    if (managerRef.current.getPlacementGhostState().active) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        managerRef.current.updateBuildingPlacementGhostFromNdc(ndcX, ndcY);
      }
    }

    setTouchVisual({
      active: true,
      originX: e.clientX,
      originY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
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

    const g = pointerGestureRef.current;
    if (g.pointerId !== e.pointerId || !managerRef.current) return;

    const dx = e.clientX - g.originX;
    const dy = e.clientY - g.originY;
    const dist = Math.hypot(dx, dy);
    if (dist > g.maxDist) {
      g.maxDist = dist;
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

    const elapsed = performance.now() - g.startTime;
    const wasQuickTap = g.maxDist < 14 && elapsed < 350;

    g.pointerId = null;
    if (managerRef.current) {
      managerRef.current.moveInput.x = 0;
      managerRef.current.moveInput.z = 0;
      managerRef.current.pointerTargetX = null;

      if (wasQuickTap) {
        const rect = e.currentTarget.getBoundingClientRect();
        const ndcX = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
        const ndcY = rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;
        const handledByCosmic = managerRef.current.handleCanvasTapRaycast(ndcX, ndcY);
        if (!handledByCosmic && managerRef.current.cosmicStage === 'playing') {
          managerRef.current.isJumping = true;
        }
      }
    }

    setTouchVisual((prev) => (prev.active ? { ...prev, active: false } : prev));
  };

  const updateGameSettings = (patch: Partial<CapyGameSettings>) => {
    setGameSettings((prev: CapyGameSettings) => {
      const next: CapyGameSettings = { ...prev, ...patch };
      ProgressionService.saveSettings(next);
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
    AudioService.playCoin();
    updateGameSettings({ showObjectMarkers: nextVal });
    managerRef.current?.setShowObjectMarkers(nextVal);
  };

  const handleSetAstrophysicsPalette = (palette: AstrophysicsPaletteMode) => {
    AudioService.playCoin();
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

  const handleSelectMode = (mode: PlayStyle) => {
    if (!isZoneUnlocked(mode)) {
      setAllFeaturesUnlocked(true);
    }
    if (managerRef.current && managerRef.current.cosmicStage !== 'playing') {
      managerRef.current.setCosmicStage('playing');
    }
    AudioService.playJump();
    setActiveMode(mode);
    setStats((prev: PlayerStats) => {
      const updated = { ...prev, selectedPlayStyle: mode };
      ProgressionService.saveStats(updated);
      return updated;
    });
    managerRef.current?.switchMode(
      mode,
      Boolean(managerRef.current?.isSoftwareGl && isMenuOpen)
    );
    const zone = ZONE_LOCATIONS[mode];
    showToast(`Transiting to ${zone.title}`);
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
      AudioService.playCoin();
    }
  };

  const handleToggleChaseCamera = () => {
    const nextFollow = !gameSettings.cameraFollowBehind;
    AudioService.playCoin();
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
    AudioService.playCoin();
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
    AudioService.playCoin();
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
      setJsonCopyLabel('Copied!');
      window.setTimeout(() => setJsonCopyLabel('Copy JSON'), 1800);
    } catch {
      setJsonCopyLabel('Unavailable');
      window.setTimeout(() => setJsonCopyLabel('Copy JSON'), 1800);
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
    AudioService.playCoin();
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
        managerRef.current.setCruiseVelocity(-2.2);
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
    AudioService.playCoin();
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
    AudioService.playSplash();
    showToast('Simulation state reset');
  };

  const getHighScoreForMode = (mode: PlayStyle): number => {
    if (mode === 'spore') return stats.highScoreSpore;
    if (mode === 'breakout') return stats.highScoreBreakout;
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
        style={{ touchAction: 'none' }}
        className="absolute inset-0 w-full h-full cursor-crosshair active:cursor-grabbing"
      />

      {/* WebGL Error Fallback Card */}
      {webglError && (
        <div
          data-testid="capygame-webgl-error"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95"
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
            <p className="text-xs font-mono text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded-lg border border-white/10">
              {webglError}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium cursor-pointer border border-white/10"
              >
                Reinitialize Context
              </button>
            </div>
          </div>
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
          Consolidates all zoom controls, scale scrubber, live status, cosmic/snake
          inspectors, placement ghost, sector/build/DNA dock, settings & audio
          into one sleek top line with top-anchored popover dropdowns.
         ===================================================================== */}
      <nav
        data-testid="unified-top-bar"
        aria-label="Universe Simulator Controls and Status"
        className="fixed top-0 inset-x-0 z-30 h-10 bg-zinc-950/95 border-b border-white/12 px-1.5 sm:px-2.5 flex items-center justify-between gap-1 sm:gap-2 pointer-events-auto whitespace-nowrap"
      >
        {/* LEFT CLUSTER: Continuous 63-Order Scale & Step Zoom Controls */}
        <div
          data-testid="universe-scale-hud"
          data-scale-band={universeScale.bandId}
          data-seamless-active={universeScale.active ? 'true' : 'false'}
          className="flex items-center gap-0.5 sm:gap-1 shrink-0"
        >
          <button
            type="button"
            data-testid="scale-zoom-out-btn"
            onClick={() => managerRef.current?.stepScaleBand(1)}
            title="Zoom Out 1 Scale Band (Toward Big Bang 10^+28m)"
            aria-label="Zoom Out Scale"
            className="w-6 h-7 flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 cursor-pointer shrink-0"
          >
            <Minus className="w-3 h-3" />
          </button>

          <button
            type="button"
            data-testid="toggle-scale-atlas-btn"
            aria-expanded={isScaleAtlasOpen}
            onClick={() => {
              AudioService.playCoin();
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
            title="Open 63-Orders-of-Magnitude Universe Scale Scrubber (Big Bang to Photon)"
            className={`h-7 px-1.5 sm:px-2 rounded border flex items-center gap-1 text-left transition-colors cursor-pointer ${
              isScaleAtlasOpen
                ? 'bg-sky-500/20 border-sky-400/60 text-zinc-100'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-100'
            }`}
          >
            <span
              data-testid="compact-scale-exponent"
              className="text-[10px] font-mono tabular-nums text-sky-400 font-semibold"
            >
              {universeScale.scientificLabel}
            </span>
            <span className="hidden sm:inline text-zinc-600 text-[10px]">·</span>
            <span className="hidden sm:inline text-[11px] font-medium text-zinc-200 max-w-[116px] lg:max-w-[155px] truncate">
              {UNIVERSE_SCALE_BANDS[universeScale.bandIndex]?.shortLabel || 'Scale'}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-zinc-400 shrink-0 transition-transform ${
                isScaleAtlasOpen ? 'rotate-180 text-sky-400' : ''
              }`}
            />
          </button>

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

          <button
            type="button"
            data-testid="scale-zoom-in-btn"
            onClick={() => managerRef.current?.stepScaleBand(-1)}
            title="Zoom In 1 Scale Band (Toward Electron & Photon 10^-35m)"
            aria-label="Zoom In Scale"
            className="w-6 h-7 flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 cursor-pointer shrink-0"
          >
            <Plus className="w-3 h-3" />
          </button>

          <button
            type="button"
            data-testid="toggle-optics-panel-btn"
            aria-expanded={isOpticsOpen}
            onClick={() => {
              AudioService.playCoin();
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
            className={`h-7 px-1.5 rounded border flex items-center gap-1 text-[10px] font-mono tabular-nums transition-colors cursor-pointer shrink-0 ${
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
        </div>

        {/* CENTER CLUSTER: Single-Line Live Status, Placement Ghost & Info Dropdown Trigger */}
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
              <span className="hidden md:inline text-zinc-400 tabular-nums">
                ({placementGhost.x.toFixed(1)}, {placementGhost.z.toFixed(1)})
              </span>
              <span
                data-testid="placement-ghost-validity"
                className={
                  placementGhost.valid
                    ? 'text-emerald-300 font-semibold shrink-0'
                    : 'text-rose-300 font-semibold shrink-0'
                }
              >
                {placementGhost.valid ? 'Clear · Tap' : 'Blocked'}
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
              className="min-w-0 max-w-full sm:max-w-[360px] lg:max-w-[450px] overflow-hidden flex items-center justify-center"
            >
              <button
                type="button"
                data-testid="toggle-infographic-btn"
                aria-expanded={isInfographicExpanded}
                onClick={() => {
                  AudioService.playCoin();
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
                title="Open Live Simulation, Cosmic & Capybara Inspector"
                className={`h-7 px-1.5 sm:px-2 rounded border flex items-center gap-1 sm:gap-1.5 min-w-0 max-w-full overflow-hidden text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                  isInfographicExpanded
                    ? 'bg-sky-500/20 border-sky-400/60 text-zinc-100'
                    : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/10 text-zinc-200'
                }`}
              >
                {toastText ? (
                  <span className="font-mono text-[10px] text-sky-300 truncate min-w-0">{toastText}</span>
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
                      {snakeTelemetry.fps} FPS · {snakeTelemetry.lodLabel}
                    </span>
                  </span>
                ) : cosmicStage === 'playing' && !universeScale.active ? (
                  <span className="flex items-center gap-1.5 min-w-0 font-mono text-[10px] tabular-nums">
                    <span className="font-sans font-semibold text-zinc-100 truncate">
                      {currentZone.title}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-amber-300 truncate">{telemetry.primaryValue}</span>
                    <span className="hidden md:inline text-sky-300 truncate">
                      · {telemetry.secondaryValue}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 min-w-0 font-mono text-[10px] tabular-nums">
                    <span className="hidden md:inline text-emerald-400 font-semibold shrink-0">
                      {simStats.fps} FPS
                    </span>
                    <span className="text-sky-400 shrink-0">
                      {universeScale.active ? universeScale.scaleFormatted : infographicStageTag}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="font-sans font-medium text-zinc-100 truncate">
                      {universeScale.active ? universeScale.bandTitle : infographicTargetTitle}
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

        {/* RIGHT CLUSTER: Compact Epoch/DNA/Coins Readout, JSON Config, World Dropdown, Settings, Overview & Audio */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {universeScale.active && (
            <div
              data-testid="top-bar-epoch-badge"
              className="hidden md:flex items-center gap-1 px-1.5 h-7 rounded bg-zinc-900/90 border border-cyan-400/25 text-[10px] font-mono tabular-nums text-cyan-300"
            >
              T+{universeScale.cosmicAgeGyr.toFixed(2)} Gyr
            </div>
          )}

          <div className="hidden lg:flex items-center gap-1.5 px-2 h-7 rounded bg-zinc-900/75 border border-white/8 text-[10px] font-mono tabular-nums mr-0.5">
            <span data-testid="stat-dna" className="text-emerald-300 font-semibold">
              {stats.dna} DNA
            </span>
            <span className="text-zinc-600">·</span>
            <span data-testid="stat-coins" className="text-amber-300 font-semibold">
              {stats.coins ?? 0}c
            </span>
          </div>

          <button
            type="button"
            data-testid="open-json-editor-btn"
            onClick={handleOpenJsonEditor}
            title="Live Procedural JSON Engine Configurator"
            aria-label="Open Procedural JSON Config Editor"
            className={`h-7 px-1.5 sm:px-2 rounded border flex items-center gap-1 text-[11px] font-mono transition-colors cursor-pointer ${
              isJsonEditorOpen
                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-cyan-400/25 text-cyan-300'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          <button
            type="button"
            data-testid="toggle-menu-btn"
            onClick={() => {
              AudioService.playCoin();
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
            aria-label={isMenuOpen ? 'Close World Menu' : 'Open World Menu'}
            className={`h-7 px-2 rounded border flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer ${
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
            <span className="hidden sm:inline">World</span>
          </button>

          <button
            type="button"
            data-testid="open-settings-btn"
            onClick={() => {
              AudioService.playCoin();
              setIsSettingsOpen(true);
            }}
            title="Simulation Settings"
            aria-label="Open Simulation Settings"
            className="w-7 h-7 flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 transition-colors cursor-pointer"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="open-about-btn"
            onClick={() => {
              AudioService.playCoin();
              setIsAboutOpen(true);
            }}
            title="Universe Architecture Overview"
            aria-label="Open Overview"
            className="w-7 h-7 flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 transition-colors cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </nav>

      {/* =====================================================================
          TOP-ANCHORED DROPDOWN 1: 63-ORDER UNIVERSE SCALE ATLAS (left-aligned under top bar)
         ===================================================================== */}
      {isScaleAtlasOpen && (
        <div
          data-testid="universe-scale-atlas-panel"
          className="fixed top-11 left-2 z-40 pointer-events-auto w-[calc(100vw-16px)] max-w-[368px] bg-zinc-950/96 border border-white/15 rounded-xl p-3 text-zinc-100 shadow-2xl space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-sky-400">
                <span data-testid="scale-scientific-readout">{universeScale.scientificLabel}</span>
                <span className="text-zinc-600">·</span>
                <span data-testid="scale-human-readout" className="text-amber-300 font-semibold">
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
            </div>
            <button
              type="button"
              data-testid="close-scale-atlas-btn"
              onClick={() => setIsScaleAtlasOpen(false)}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer shrink-0"
              aria-label="Collapse Universe Scale Atlas"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Continuous Logarithmic Powers-of-10 Scrubber (+28 Big Bang <-> +0.8 Forest <-> -35 Photon) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 tabular-nums">
              <span>10^-35m Photon</span>
              <span className="text-emerald-300">10^+0.8m Capy Forest</span>
              <span>10^+28m Big Bang</span>
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
                managerRef.current?.setSeamlessLogScale(val, false);
              }}
              aria-label="Logarithmic Universe Scale (log10 meters)"
              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
          </div>

          {/* Step Zoom, Auto-Journey & Quantum Focus Controls */}
          <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
            <button
              type="button"
              data-testid="auto-zoom-quantum-btn"
              onClick={() => managerRef.current?.toggleAutoZoom(-1)}
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
              onClick={() => managerRef.current?.toggleAutoZoom(1)}
              className={`py-1 px-1.5 rounded border cursor-pointer truncate ${
                universeScale.autoZoomDir === 1
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
              }`}
            >
              {universeScale.autoZoomDir === 1 ? 'Pause ↑' : 'Rise 10⁺²⁸'}
            </button>
            <button
              type="button"
              data-testid="quantum-focus-electron"
              onClick={() => managerRef.current?.setQuantumFocusMode('electron')}
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
              onClick={() => managerRef.current?.setQuantumFocusMode('photon')}
              className={`py-1 px-1.5 rounded border cursor-pointer truncate ${
                universeScale.bandId === 'single_photon'
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-amber-300'
              }`}
            >
              Photon γ
            </button>
          </div>

          {/* All 25 Scales Quick-Jump Atlas */}
          <div className="grid grid-cols-3 gap-1 max-h-44 overflow-y-auto pr-0.5">
            {UNIVERSE_SCALE_BANDS.map((band) => {
              const isCurrent = band.id === universeScale.bandId;
              return (
                <button
                  key={band.id}
                  type="button"
                  data-testid={`scale-band-btn-${band.id}`}
                  onClick={() => managerRef.current?.jumpToScaleBand(band.id, false)}
                  className={`px-1.5 py-1 rounded border text-left transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-sky-500/25 border-sky-400 text-zinc-100'
                      : 'bg-zinc-900/85 hover:bg-zinc-800 border-white/10 text-zinc-300'
                  }`}
                >
                  <div className="text-[9px] font-mono text-sky-400 tabular-nums leading-none">
                    10^{band.logMeters >= 0 ? `+${band.logMeters}` : band.logMeters}m
                  </div>
                  <div className="text-[10px] font-medium truncate mt-0.5">{band.shortLabel}</div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="enter-capy-forest-play-btn"
            onClick={() => {
              managerRef.current?.resumeSurfacePlayFromForest();
              setIsScaleAtlasOpen(false);
            }}
            className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            Land &amp; Control Capybara in Forest (10⁺⁰·⁸ m)
          </button>
        </div>
      )}

      {/* =====================================================================
          TOP-ANCHORED DROPDOWN 1B: COSMIC OPTICS (1:1 Scale, Markers & Reality Rescaler)
         ===================================================================== */}
      {isOpticsOpen && (
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
              onClick={() => setIsOpticsOpen(false)}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer shrink-0"
              aria-label="Close Cosmic Optics Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 1. UNLOCKABLE OBJECT FINDER MARKERS */}
          <div className="p-2.5 rounded-lg bg-zinc-900/85 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-zinc-100">
                Object Finder Markers
              </div>
              {isMarkersUnlocked ? (
                <button
                  type="button"
                  data-testid="toggle-object-markers-btn"
                  onClick={handleToggleObjectMarkers}
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
                  onClick={() => handleUnlockCosmicInstrument('markers', 'dna')}
                  className="py-1 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-mono font-semibold cursor-pointer"
                >
                  Unlock · {OBJECT_MARKERS_DNA_COST} DNA
                </button>
                <button
                  type="button"
                  data-testid="unlock-markers-coins-btn"
                  onClick={() => handleUnlockCosmicInstrument('markers', 'coins')}
                  className="py-1 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[10px] font-mono font-semibold cursor-pointer"
                >
                  Unlock · {OBJECT_MARKERS_COIN_COST}c
                </button>
              </div>
            )}
          </div>

          {/* 2. UNLOCKABLE LOGARITHMIC / EXPONENTIAL REALITY RESCALER */}
          <div className="p-2.5 rounded-lg bg-zinc-900/85 border border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-zinc-100">
                Reality Rescaler
              </div>
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
                  onChange={(e) => handleSetRealityGamma(parseFloat(e.target.value))}
                  aria-label="Reality Rescaler Exponent Gamma"
                  className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                />
                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                  <button
                    type="button"
                    data-testid="rescaler-preset-1to1"
                    onClick={() => handleSetRealityGamma(1.0)}
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
                    onClick={() => handleSetRealityGamma(0.5)}
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
                    onClick={() => handleSetRealityGamma(0.3)}
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
                  onClick={() => handleUnlockCosmicInstrument('rescaler', 'dna')}
                  className="py-1 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-mono font-semibold cursor-pointer"
                >
                  Unlock · {REALITY_RESCALER_DNA_COST} DNA
                </button>
                <button
                  type="button"
                  data-testid="unlock-rescaler-coins-btn"
                  onClick={() => handleUnlockCosmicInstrument('rescaler', 'coins')}
                  className="py-1 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[10px] font-mono font-semibold cursor-pointer"
                >
                  Unlock · {REALITY_RESCALER_COIN_COST}c
                </button>
              </div>
            )}
          </div>

          {/* 3. ASTROPHYSICS SPECTRAL FILTER (Natural Eye vs Hubble Narrowband SHO) */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/85 border border-white/10">
            <span className="text-[11px] font-medium text-zinc-200">Spectral Filter</span>
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <button
                type="button"
                data-testid="palette-btn-natural"
                onClick={() => handleSetAstrophysicsPalette('natural')}
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
                onClick={() => handleSetAstrophysicsPalette('hubble')}
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

          {(!isMarkersUnlocked || !isRescalerUnlocked) && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[10px] font-mono">
              <span className="text-zinc-400 tabular-nums">
                Balance: <span className="text-emerald-300">{stats.dna} DNA</span> ·{' '}
                <span className="text-amber-300">{stats.coins ?? 0}c</span>
              </span>
              <button
                type="button"
                data-testid="optics-sandbox-unlock-btn"
                onClick={handleUnlockAllFeatures}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/15 cursor-pointer"
              >
                Sandbox Unlock All
              </button>
            </div>
          )}
        </div>
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

      {/* =====================================================================
          TOP-ANCHORED DROPDOWN 3: LIVE COSMIC, QUANTUM & SURFACE TELEMETRY INSPECTOR
         ===================================================================== */}
      {isInfographicExpanded && cosmicStage !== 'capy_selection' && (
        <div
          data-testid="top-info-dropdown"
          className="fixed top-11 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[340px] z-40 pointer-events-auto bg-zinc-950/96 border border-white/15 rounded-xl p-3 text-zinc-100 shadow-2xl space-y-2.5 max-h-[80vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 border-b border-white/10 pb-1.5 gap-1 tabular-nums">
            <span className="text-emerald-400 font-semibold">
              {cosmicStage === 'playing' ? snakeTelemetry.fps : simStats.fps} FPS
            </span>
            <span>{universeScale.scientificLabel}</span>
            <span className="truncate">{universeScale.bandTitle}</span>
            <button
              type="button"
              data-testid="close-infographic-btn"
              onClick={() => setIsInfographicExpanded(false)}
              title="Close Inspector"
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer shrink-0"
            >
              <X className="w-3 h-3 text-zinc-400" />
            </button>
          </div>

          {/* STAGE 0: SINGULARITY */}
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
                  onClick={() => managerRef.current?.triggerBigBang()}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Ignite Big Bang
                </button>
                <button
                  type="button"
                  data-testid="pick-random-tracked-star-btn"
                  onClick={() => managerRef.current?.pickRandomTrackedStar()}
                  title="Pick a random persistent star seed to follow from T=0"
                  className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sky-300 font-mono text-[10px] border border-sky-400/30 cursor-pointer"
                >
                  Random Star
                </button>
                <button
                  type="button"
                  data-testid="skip-cosmic-to-world-btn"
                  onClick={() => managerRef.current?.setCosmicStage('playing')}
                  className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-[11px] border border-white/10 cursor-pointer"
                >
                  Surface
                </button>
              </div>
            </div>
          )}

          {/* STAGE 1: N-BODY GRAVITY, SUPERNOVA NUCLEOSYNTHESIS & PERSISTENT STAR TRACKER */}
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
                    onClick={() => {
                      managerRef.current?.adjustGravityConstant(0.25);
                      syncCosmicTelemetryNow();
                    }}
                    title="Increase Gravitational Constant G"
                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/12 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    data-testid="gravity-damp-btn"
                    onClick={() => {
                      managerRef.current?.adjustGravityConstant(-0.25);
                      syncCosmicTelemetryNow();
                    }}
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
                    onClick={() => {
                      managerRef.current?.toggleFollowTrackedStar();
                      syncCosmicTelemetryNow();
                    }}
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
                    onClick={() => {
                      managerRef.current?.pickRandomTrackedStar();
                      syncCosmicTelemetryNow();
                    }}
                    className="px-1.5 py-1 rounded text-[9px] font-mono bg-zinc-950 hover:bg-zinc-800 border border-white/12 text-zinc-200 cursor-pointer truncate"
                  >
                    Random Star
                  </button>
                  <button
                    type="button"
                    data-testid="trigger-supernova-btn"
                    onClick={() => {
                      managerRef.current?.triggerSupernovaOnTrackedStar();
                      syncCosmicTelemetryNow();
                    }}
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
                    onClick={() => {
                      managerRef.current?.setStellarColorMode('hr_blackbody');
                      syncCosmicTelemetryNow();
                    }}
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
                    onClick={() => {
                      managerRef.current?.setStellarColorMode('mass_spectrum');
                      syncCosmicTelemetryNow();
                    }}
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
                    onClick={() => {
                      managerRef.current?.setStellarColorMode('age_gradient');
                      syncCosmicTelemetryNow();
                    }}
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
                  onClick={() => managerRef.current?.followTrackedStarToPlanet()}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-[11px] transition-colors cursor-pointer truncate"
                >
                  Follow Star → Planet
                </button>
                <button
                  type="button"
                  data-testid="skip-big-bang-btn"
                  onClick={() => managerRef.current?.skipToUniverseFlight()}
                  className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-[11px] border border-white/12 cursor-pointer shrink-0"
                >
                  Galaxies →
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: UNIVERSE FLIGHT */}
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
                    onClick={() => {
                      managerRef.current?.cycleStellarColorMode();
                      syncCosmicTelemetryNow();
                    }}
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-sky-300 font-mono text-[10px] border border-sky-400/30 cursor-pointer"
                  >
                    Spectrum
                  </button>
                  <button
                    type="button"
                    data-testid="skip-cosmic-to-world-btn"
                    onClick={() => managerRef.current?.setCosmicStage('playing')}
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
                    onClick={() => {
                      managerRef.current?.pickRandomTrackedStar();
                      syncCosmicTelemetryNow();
                    }}
                    className="px-1.5 py-1 rounded text-[9px] font-mono bg-zinc-950 hover:bg-zinc-800 border border-white/12 text-zinc-200 cursor-pointer truncate"
                  >
                    Random Star
                  </button>
                  <button
                    type="button"
                    data-testid="trigger-supernova-btn"
                    onClick={() => {
                      managerRef.current?.triggerSupernovaOnTrackedStar();
                      syncCosmicTelemetryNow();
                    }}
                    className="px-1.5 py-1 rounded text-[9px] font-mono bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 cursor-pointer truncate"
                  >
                    Supernova
                  </button>
                  <button
                    type="button"
                    data-testid="follow-star-to-planet-btn"
                    onClick={() => managerRef.current?.followTrackedStarToPlanet()}
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
                    onClick={() => managerRef.current?.selectGalaxy(idx)}
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

          {/* STAGE 3: GALAXY VIEW */}
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
                  onClick={() => managerRef.current?.stepCosmicBack()}
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
                    onClick={() => managerRef.current?.selectStarSystem(idx)}
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

          {/* STAGE 4: STAR SYSTEM VIEW (UNIFIED PLANETARY SYSTEM & ORBITAL TIME CONTROLS) */}
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
                  onClick={() => managerRef.current?.stepCosmicBack()}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-white/10 cursor-pointer shrink-0"
                >
                  ← Back
                </button>
              </div>

              {/* ORBITAL TIME CONTROLLER DOCK */}
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

                {/* Fast-Forward Timescale Preset Steppers */}
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
                        onClick={() => {
                          managerRef.current?.setOrbitTimeScale(scale.id);
                          setSelectedTimeScale(scale.id);
                        }}
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

              {/* Active Planet / Body Keplerian Physics Telemetry */}
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

              {/* Asteroid Belt Interactive Inspector */}
              {activeStar.asteroidBelt && (
                <button
                  type="button"
                  data-testid="inspect-asteroid-belt"
                  onClick={() => managerRef.current?.selectAsteroidBelt()}
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

              {/* Planetary Family List (Rocky, Habitable, Gas Giants, Ice Giants) */}
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
                      onClick={() => managerRef.current?.selectPlanet(idx)}
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
                          {planet.semiMajorAu ? `${planet.semiMajorAu} AU · ` : ''}{planet.subtitle}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-sky-400 shrink-0">Orbit →</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STAGE 5: PLANETARY ORBIT */}
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
                  onClick={() => managerRef.current?.stepCosmicBack()}
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
                        onClick={() => managerRef.current?.selectLandingSpot(idx)}
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
                /* Gas Giant or Deep Vulcan Surface Orbital Survey Mode */
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
                      <span className="text-zinc-200 font-semibold">{activePlanet.massLabel || 'Colossal'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">DIAMETER</span>
                      <span className="text-zinc-200 font-semibold">
                        {activePlanet.diameterKm ? `${activePlanet.diameterKm.toLocaleString()} km` : '120,000 km'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAGE 5B: ATMOSPHERIC DESCENT */}
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

          {/* SURFACE PLAYING DETAILED INSPECTOR */}
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
                    Fluid {physicsTelemetry.fluidGridCells}c · {physicsTelemetry.transportMode === 'shared_array_buffer' ? 'SAB' : 'Worker'}
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
                    Filter: {gpuTelemetry.visualFilterLabel} · {gpuTelemetry.postProcessingActive ? 'HDR PostFX' : 'Direct'}
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
        </div>
      )}

      {/* =====================================================================
          TOP-ANCHORED DROPDOWN 4: WORLD SECTORS, STRUCTURES, BIO-TRAITS & LOADOUT
         ===================================================================== */}
      {isMenuOpen && (
        <header
          data-testid="capygame-top-header"
          className="fixed top-11 right-2 left-2 sm:left-auto sm:w-[720px] z-40 pointer-events-auto bg-zinc-950/96 border border-white/15 rounded-xl shadow-2xl p-2.5 flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 px-2.5 py-1 rounded-md text-xs">
                <Compass className="w-3 h-3 text-sky-400 shrink-0" />
                <span className="font-semibold text-zinc-100">{currentZone.title}</span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {currentModeInfo.compass}
                </span>
              </div>

              <div className="flex lg:hidden items-center gap-1.5 bg-zinc-900 border border-white/10 px-2 py-1 rounded-md text-[11px] font-mono tabular-nums">
                <span className="text-emerald-300 font-semibold">{stats.dna} DNA</span>
                <span className="text-zinc-600">·</span>
                <span className="text-amber-300 font-semibold">{stats.coins ?? 0}c</span>
              </div>

              <div
                data-testid="progressive-unlock-bar"
                className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 px-2 py-1 rounded-md text-[11px] font-mono text-zinc-300"
              >
                <span>
                  SECTORS {unlockedCount}/{PROGRESSIVE_UNLOCKS.length}
                </span>
                {unlockedCount < PROGRESSIVE_UNLOCKS.length && (
                  <button
                    type="button"
                    data-testid="unlock-all-features-btn"
                    onClick={handleUnlockAllFeatures}
                    className="ml-1 px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 font-sans font-medium text-[10px] cursor-pointer"
                  >
                    Unlock All
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                data-testid="launch-chrono-vessel-btn"
                onClick={() => {
                  managerRef.current?.launchIntoCosmos(22.0);
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 font-medium text-[11px] px-2 py-1 rounded-md border border-cyan-400/40 transition-colors cursor-pointer"
              >
                <Rocket className="w-3 h-3 text-cyan-300" />
                <span>Chrono-Flight</span>
              </button>

              <button
                type="button"
                data-testid="open-cosmic-map-btn"
                onClick={() => {
                  AudioService.playCosmicWarp(1.0);
                  managerRef.current?.setCosmicStage('universe_flight');
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-sky-300 font-medium text-[11px] px-2 py-1 rounded-md border border-sky-500/30 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span>Cosmic Map</span>
              </button>

              <button
                type="button"
                data-testid="open-capy-select-btn"
                onClick={() => {
                  AudioService.playCoin();
                  managerRef.current?.setCosmicStage('capy_selection');
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-[11px] px-2 py-1 rounded-md border border-white/12 transition-colors cursor-pointer"
              >
                <Crown className="w-3 h-3 text-amber-400" />
                <span>Select Unit</span>
              </button>

              <button
                type="button"
                data-testid="open-first-run-setup-btn"
                onClick={handleOpenFirstRunSetup}
                className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-amber-300 font-medium text-[11px] px-2 py-1 rounded-md border border-amber-400/30 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Genesis Setup</span>
              </button>

              <button
                type="button"
                data-testid="toggle-chase-camera-btn"
                onClick={handleToggleChaseCamera}
                className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer border ${
                  gameSettings.cameraFollowBehind
                    ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                    : 'bg-zinc-900 text-zinc-300 border-white/12 hover:bg-zinc-800'
                }`}
              >
                <Camera className="w-3 h-3" />
                <span>{gameSettings.cameraFollowBehind ? 'Chase Cam: ON' : 'Fixed Cam'}</span>
              </button>
            </div>
          </div>

          <section data-testid="capygame-top-dock" className="w-full overflow-hidden">
            <div className="flex flex-wrap items-center justify-between pb-2 border-b border-white/10 gap-1">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  data-testid="tab-modes"
                  onClick={() => handleSelectTab('modes')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'modes'
                      ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Sectors (5)</span>
                </button>

                <button
                  type="button"
                  data-testid="tab-build"
                  onClick={() => handleSelectTab('build')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'build'
                      ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Hammer className="w-3.5 h-3.5" />
                  <span>Structures</span>
                </button>

                <button
                  type="button"
                  data-testid="tab-dna"
                  onClick={() => handleSelectTab('dna')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'dna'
                      ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  {isTabUnlocked('dna') ? (
                    <Dna className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3 h-3 text-zinc-500" />
                  )}
                  <span>Bio-Traits</span>
                </button>

                <button
                  type="button"
                  data-testid="tab-upgrades"
                  onClick={() => handleSelectTab('upgrades')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'upgrades'
                      ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  {isTabUnlocked('upgrades') ? (
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3 h-3 text-zinc-500" />
                  )}
                  <span>Parameters</span>
                </button>

                <button
                  type="button"
                  data-testid="tab-wardrobe"
                  onClick={() => handleSelectTab('wardrobe')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'wardrobe'
                      ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  {isTabUnlocked('wardrobe') ? (
                    <Crown className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3 h-3 text-zinc-500" />
                  )}
                  <span>Loadout</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {activeMode !== 'sanctuary' && (
                  <button
                    type="button"
                    onClick={() => managerRef.current?.switchMode(activeMode, true)}
                    className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-[11px] font-medium border border-white/10 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="hidden sm:inline">Reset Sector</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="toggle-dock-collapse"
                  onClick={() => setIsDockCollapsed((prev) => !prev)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[11px] font-medium border border-white/10 cursor-pointer"
                >
                  <span>{isDockCollapsed ? 'Expand' : 'Hide'}</span>
                  {isDockCollapsed ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {!isDockCollapsed && (
              <div className="pt-2 max-h-[54vh] sm:max-h-[62vh] overflow-y-auto">
                {activeTab === 'modes' && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {PLAY_STYLE_LIST.map((mode) => {
                      const isSelected = mode.id === activeMode;
                      const unlocked = isZoneUnlocked(mode.id);
                      const best = getHighScoreForMode(mode.id);
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          data-testid={`mode-btn-${mode.id}`}
                          onClick={() => handleSelectMode(mode.id)}
                          className={`flex flex-col justify-between p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-800/90 border-sky-400/60'
                              : 'bg-zinc-900/70 border-white/10 hover:bg-zinc-800/60'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-zinc-100 truncate flex items-center gap-1">
                                {!unlocked && <Lock className="w-3 h-3 text-zinc-500 shrink-0" />}
                                {mode.title}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                              {mode.subtitle}
                            </p>
                          </div>

                          <div className="mt-1.5 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                            <span className="text-sky-400 flex items-center gap-0.5">
                              {isSelected ? (
                                'ACTIVE'
                              ) : unlocked ? (
                                'TRANSIT ->'
                              ) : (
                                <>
                                  <Unlock className="w-2.5 h-2.5" />
                                  <span>{mode.requiredDna} DNA</span>
                                </>
                              )}
                            </span>
                            <span className="flex items-center gap-0.5 text-zinc-300">
                              <Trophy className="w-2.5 h-2.5" /> {best}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'build' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BUILDING_CATALOG.map((def) => {
                        const count = stats.buildings.filter((b) => b.type === def.type).length;
                        const displayCost = ProgressionService.getBuildingCoinCost(
                          def.type,
                          proceduralConfig.economy.buildingCostMultiplier
                        );
                        return (
                          <div
                            key={def.type}
                            className="flex flex-col justify-between p-2 rounded-lg bg-zinc-900/80 border border-white/10"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-zinc-100 truncate">
                                  {def.name}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-amber-300 border border-white/10 shrink-0">
                                  {displayCost}c · #{count}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                                {def.description}
                              </p>
                            </div>

                            <div className="mt-1.5 flex items-center gap-1">
                              <button
                                type="button"
                                data-testid={`build-btn-${def.type}`}
                                onClick={() => handlePlaceBuilding(def)}
                                className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Deploy ({displayCost}c)</span>
                              </button>
                              <button
                                type="button"
                                data-testid={`ghost-btn-${def.type}`}
                                onClick={() => handleStartBuildingGhost(def)}
                                title="Aim & place on exact 3D Sanctuary turf"
                                className="flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/35"
                              >
                                <Compass className="w-3 h-3" />
                                <span>Place</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {stats.buildings.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 shrink-0">
                          Deployed ({stats.buildings.length}/16):
                        </span>
                        {stats.buildings.map((b, idx) => {
                          const upCost = ProgressionService.getBuildingUpgradeCoinCost(
                            b.type,
                            b.level,
                            proceduralConfig.economy.buildingCostMultiplier
                          );
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleUpgradeBuilding(b.id)}
                              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border bg-zinc-900 border-white/15 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                            >
                              <span>
                                #{idx + 1} {b.name} L{b.level}
                              </span>
                              <span className="text-sky-400">+{upCost}c</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'dna' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SPORE_MUTATIONS.map((mut) => {
                      const isEquipped = stats.activeMutations.includes(mut.id);
                      const isUnlocked =
                        isEquipped || Boolean(stats.unlockedMutations?.includes(mut.id));
                      return (
                        <div
                          key={mut.id}
                          className={`flex flex-col justify-between p-2 rounded-lg border ${
                            isEquipped
                              ? 'bg-zinc-800 border-emerald-400/50'
                              : 'bg-zinc-900/80 border-white/10'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-zinc-100">{mut.name}</span>
                              <span className="text-[10px] font-mono text-emerald-300">
                                {isUnlocked ? 'Spliced' : `${mut.dnaCost} DNA`}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">
                              {mut.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            data-testid={`mutation-btn-${mut.id}`}
                            onClick={() => handleToggleMutation(mut.id)}
                            className={`mt-1.5 w-full py-1 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                              isEquipped
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-white/10'
                            }`}
                          >
                            {isEquipped
                              ? 'Active'
                              : isUnlocked
                                ? 'Activate'
                                : `Splice (${mut.dnaCost} DNA)`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'upgrades' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {ABILITY_UPGRADE_LIST.map((up) => {
                        const level = stats.upgrades[up.id] || 1;
                        const dnaCost = ProgressionService.getAbilityUpgradeDnaCost(level);
                        return (
                          <div
                            key={up.id}
                            className="flex flex-col justify-between p-2 rounded-lg bg-zinc-900/80 border border-white/10 gap-1.5"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-zinc-100">{up.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-sky-400 border border-white/10">
                                  L{level}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-400 mt-0.5">{up.description}</p>
                            </div>

                            <button
                              type="button"
                              data-testid={`upgrade-btn-${up.id}`}
                              onClick={() => handleLevelUpAbility(up.id)}
                              className="w-full py-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10"
                            >
                              Increment ({dnaCost} DNA)
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/90 border border-amber-400/25">
                      <div>
                        <span className="text-xs font-semibold text-amber-300 font-mono">
                          Prestige Tier P{stats.prestigeLevel} · {stats.prestigeLevel}x Coin Multiplier
                        </span>
                        <p className="text-[10px] text-zinc-400">
                          Ascend lineage for +{50 * stats.prestigeLevel}c bonus and permanent coin yield scaling.
                        </p>
                      </div>
                      <button
                        type="button"
                        data-testid="prestige-ascend-btn"
                        onClick={handlePrestigeAscend}
                        className="px-3 py-1 rounded text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 cursor-pointer"
                      >
                        Ascend ({ProgressionService.getPrestigeDnaCost(stats.prestigeLevel)} DNA)
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'wardrobe' && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {WARDROBE_HATS.map((item) => {
                      const isSelected = stats.activeHat === item.id;
                      const isUnlocked = stats.unlockedCosmetics.includes(item.id);
                      const hatCost = ProgressionService.getCosmeticCoinCost(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`wardrobe-btn-${item.id}`}
                          onClick={() => handleEquipHat(item.id)}
                          className={`flex flex-col justify-between p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-800 border-sky-400/50'
                              : 'bg-zinc-900/80 border-white/10 hover:bg-zinc-800/60'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-semibold text-zinc-100">{item.name}</span>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{item.description}</p>
                          </div>
                          <span
                            className={`mt-1.5 inline-block text-[10px] font-mono uppercase ${
                              isSelected
                                ? 'text-sky-400'
                                : isUnlocked
                                  ? 'text-zinc-400'
                                  : 'text-amber-300'
                            }`}
                          >
                            {isSelected
                              ? 'EQUIPPED'
                              : isUnlocked
                                ? 'EQUIP'
                                : `UNLOCK ${hatCost}c`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </header>
      )}

      {/* Optional On-Screen Steering Pad (Hidden unless explicitly set to 'always' in Settings) */}
      {showTouchDpad && (
        <div
          data-testid="touch-dpad-controls"
          className="fixed bottom-3 right-3 z-20 flex flex-col items-center gap-1 pointer-events-auto"
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

      {/* OVERVIEW / ABOUT MODAL */}
      {isAboutOpen && (
        <div
          data-testid="capygame-about-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85"
        >
          <div className="relative w-full max-w-2xl bg-zinc-900 rounded-xl shadow-2xl border border-white/15 overflow-hidden text-zinc-100">
            <div className="bg-zinc-950 px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-semibold tracking-wider uppercase text-zinc-100">
                  Capy Universe 3D · System Architecture
                </h2>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                  63-Order Seamless Zoom (10^+28m to 10^-35m) · N-Body Galaxies · 5 Surface Sectors
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer"
                aria-label="Close Overview Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <p className="text-xs text-zinc-300 leading-relaxed">
                The simulation initializes at a pitch-black 0D singularity. Triggering the Big Bang
                rapidly expands a blinding white radiation fireball that condenses into 48,000
                simulated star and baryon particles. Real-time softened Newtonian gravity, fluid
                viscous damping, and angular momentum conservation coalesce the stars into 64
                rotating spiral galaxies with relativistic supermassive black hole cores.
              </p>

              <div>
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                  Surface Sectors (Click to Transit)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PLAY_STYLE_LIST.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        handleSelectMode(m.id);
                        setIsAboutOpen(false);
                      }}
                      className="flex items-start justify-between p-2.5 rounded-lg bg-zinc-950/80 border border-white/10 hover:border-sky-400/50 text-left transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-100">{m.title}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-sky-400 border border-white/10">
                            {m.compass}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{m.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  data-testid="close-about-btn"
                  onClick={() => {
                    AudioService.playCoin();
                    setIsAboutOpen(false);
                  }}
                  className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Resume Simulation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
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
                    Simulation Settings
                  </h2>
                  <p className="text-[11px] font-mono text-zinc-400">
                    Camera kinematics, field of view & audio synthesis
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="close-settings-btn"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer"
                aria-label="Close Settings Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 sm:p-5 space-y-2 sm:space-y-3.5 max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Tracking Chase Camera
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Aligns camera azimuth behind the active unit during surface traversal
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settings-toggle-chase-cam"
                  onClick={() =>
                    updateGameSettings({
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

              <div
                data-testid="settings-gpu-engine-panel"
                className="p-3 rounded-lg bg-zinc-950/90 border border-sky-400/20 space-y-3"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100">
                      3D Hardware GPU Engine, Lighting, Textures &amp; Filters
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums truncate">
                      {gpuTelemetry.backendLabel} · {gpuTelemetry.registeredPbrTextures} PBR maps · Shadow {gpuTelemetry.shadowMapSize || 'OFF'}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-toggle-postfx"
                    onClick={() =>
                      updateGameSettings({
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
                            updateGameSettings(
                              PlayStyleManager.getPresetPatchForGpuQuality(preset)
                            )
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

                {/* Visual Filter & Color Grading Presets */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">Visual Filter &amp; Color Grade</span>
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
                          updateGameSettings({
                            gpuVisualFilter: id,
                            gpuPostProcessing: id !== 'natural_pbr' ? true : gameSettings.gpuPostProcessing,
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
                      {gameSettings.gpuToneMapping.toUpperCase()} · {gameSettings.gpuExposure.toFixed(2)} EV
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['agx', 'aces', 'neutral', 'reinhard'] as GpuToneMappingMode[]).map((tm) => (
                      <button
                        key={tm}
                        type="button"
                        data-testid={`settings-tonemap-${tm}`}
                        onClick={() => updateGameSettings({ gpuToneMapping: tm })}
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
                      updateGameSettings({ gpuExposure: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                {/* PBR Texture Filtering & Hardware Anisotropy */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">PBR Texture Sampling &amp; Anisotropy</span>
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
                        onClick={() => updateGameSettings({ gpuTextureFilter: id })}
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
                  <div className="grid grid-cols-4 gap-1.5">
                    {([1, 4, 8, 16] as Array<1 | 4 | 8 | 16>).map((aniso) => (
                      <button
                        key={aniso}
                        type="button"
                        data-testid={`settings-aniso-${aniso}`}
                        onClick={() => updateGameSettings({ gpuAnisotropy: aniso })}
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
                        onClick={() => updateGameSettings({ gpuShadowQuality: id })}
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

                {/* Bloom, Depth SSAO & CAS Texture Sharpening */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="settings-toggle-bloom"
                    onClick={() =>
                      updateGameSettings({
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
                      updateGameSettings({
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

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 font-medium">CAS Texture Sharpening</span>
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
                      updateGameSettings({
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
                      Capybara Mesh Detail (60 FPS Governor)
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums truncate">
                      Active: {snakeTelemetry.lodLabel} (~{snakeTelemetry.trianglesPerCapy.toLocaleString()} tris · {snakeTelemetry.fps} FPS)
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-toggle-auto-lod"
                    onClick={() =>
                      updateGameSettings({
                        autoCapyLod: !gameSettings.autoCapyLod,
                      })
                    }
                    className={`min-w-[98px] text-center px-2.5 py-1 rounded text-xs font-mono cursor-pointer shrink-0 border ${
                      gameSettings.autoCapyLod
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    {gameSettings.autoCapyLod ? 'AUTO 60 FPS' : 'MANUAL'}
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
                          updateGameSettings({
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
                      {snakeTelemetry.dayPhaseLabel} ({snakeTelemetry.timeOfDayHours.toFixed(1)}h / 24h)
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-toggle-daynight"
                    onClick={() =>
                      updateGameSettings({
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
                    updateGameSettings({
                      dayNightAutoCycle: false,
                      timeOfDayHours: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">Weather System</span>
                  <span className="text-[11px] font-mono text-sky-300">
                    {snakeTelemetry.weatherLabel}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {(['auto', 'clear', 'rain', 'storm', 'mist', 'snow'] as Array<
                    'auto' | WeatherType
                  >).map((wMode) => (
                    <button
                      key={wMode}
                      type="button"
                      data-testid={`settings-weather-${wMode}`}
                      onClick={() => updateGameSettings({ weatherMode: wMode })}
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
                  min={0.6}
                  max={1.5}
                  step={0.05}
                  value={gameSettings.cameraDistance}
                  onChange={(e) =>
                    updateGameSettings({ cameraDistance: parseFloat(e.target.value) })
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
                    updateGameSettings({ turnSensitivity: parseFloat(e.target.value) })
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
                  onChange={(e) => updateGameSettings({ fov: parseInt(e.target.value, 10) })}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Atmospheric Fog</div>
                    <div className="text-[10px] text-zinc-500">Horizon attenuation</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateGameSettings({ worldFogEnabled: !gameSettings.worldFogEnabled })
                    }
                    className={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
                      gameSettings.worldFogEnabled
                        ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    {gameSettings.worldFogEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/80 border border-white/10">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Audio Synthesis</div>
                    <div className="text-[10px] text-zinc-500">WebAudio harmonic output</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
                      !isMuted
                        ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    {!isMuted ? 'ON' : 'MUTED'}
                  </button>
                </div>
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
                      onClick={() => updateGameSettings({ touchControlsMode: mode })}
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
                      Mode: {pwaStatus.standalone ? 'Standalone Installed' : 'Web Session'} · Preset:{' '}
                      {proceduralConfig.meta.configName} (#{proceduralConfig.meta.seed})
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
                        setIsSettingsOpen(false);
                        handleOpenJsonEditor();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-400/35 cursor-pointer"
                    >
                      <Code2 className="w-3 h-3" />
                      <span>Edit JSON</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleUnlockAllFeatures}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 cursor-pointer"
                >
                  Unlock All Sectors
                </button>

                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-500/30 cursor-pointer"
                >
                  Reset State
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          FIRST-TIME GENESIS LAUNCH CONFIGURATOR (Pilot, Spaceship & Fine-Structure α)
          Docked left on desktop & bottom on mobile so the live 3D Chrono-Vessel
          and Universe remain unobstructed behind it.
         ===================================================================== */}
      {isFirstRunSetupOpen && !webglError && !isJsonEditorOpen && !isSettingsOpen && (() => {
        const alphaPhysics = computeFineStructurePhysics(
          proceduralConfig.universe.fineStructureInverse
        );
        const regimeColorClass =
          alphaPhysics.regimeTone === 'emerald'
            ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/15'
            : alphaPhysics.regimeTone === 'amber'
              ? 'text-amber-300 border-amber-400/40 bg-amber-500/15'
              : 'text-cyan-300 border-cyan-400/40 bg-cyan-500/15';

        const furPresets = [
          { hex: '#b47442', secondary: '#6d3f1d', label: 'Classic' },
          { hex: '#eab308', secondary: '#854d0e', label: 'Solar' },
          { hex: '#f472b6', secondary: '#9d174d', label: 'Sakura' },
          { hex: '#4ade80', secondary: '#166534', label: 'Matcha' },
          { hex: '#6366f1', secondary: '#312e81', label: 'Cosmic' },
          { hex: '#cbd5e1', secondary: '#475569', label: 'Lunar' },
        ];
        const skinIds = ['classic', 'golden', 'sakura', 'matcha', 'cosmic'];
        const hatIds: Array<{ id: string; label: string }> = [
          { id: 'yuzu', label: 'Yuzu' },
          { id: 'crown', label: 'Crown' },
          { id: 'flower', label: 'Flora' },
          { id: 'wizard', label: 'Wizard' },
          { id: 'halo', label: 'Halo' },
          { id: 'party', label: 'Party' },
        ];

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
                onClick={() => handleCompleteFirstRunSetup(false)}
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
                  setFirstRunTab('pilot');
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
                  setFirstRunTab('vessel');
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
                  setFirstRunTab('universe');
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
                          furPresets.find((f) =>
                            hero.skin === 'golden'
                              ? f.label === 'Solar'
                              : hero.skin === 'sakura'
                                ? f.label === 'Sakura'
                                : hero.skin === 'matcha'
                                  ? f.label === 'Matcha'
                                  : hero.skin === 'cosmic'
                                    ? f.label === 'Cosmic'
                                    : f.label === 'Classic'
                          ) || furPresets[0];
                        return (
                          <button
                            key={hero.id}
                            type="button"
                            data-testid={`setup-hero-${hero.id}`}
                            onClick={() => {
                              AudioService.playCoin();
                              applyFirstRunDraftUpdate((draft) => {
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
                      {furPresets.map((preset) => {
                        const isActive =
                          proceduralConfig.player.furPrimaryHex.toLowerCase() === preset.hex;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            data-testid={`setup-fur-preset-${preset.label.toLowerCase()}`}
                            onClick={() => {
                              AudioService.playCoin();
                              applyFirstRunDraftUpdate((draft) => {
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
                            applyFirstRunDraftUpdate((draft) => {
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
                            applyFirstRunDraftUpdate((draft) => {
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
                      {skinIds.map((skinId) => (
                        <button
                          key={skinId}
                          type="button"
                          data-testid={`setup-skin-${skinId}`}
                          onClick={() => {
                            AudioService.playCoin();
                            applyFirstRunDraftUpdate((draft) => {
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
                      {hatIds.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          data-testid={`setup-hat-${h.id}`}
                          onClick={() => {
                            AudioService.playCoin();
                            applyFirstRunDraftUpdate((draft) => {
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
                      {['#06b6d4', '#38bdf8', '#f59e0b', '#ec4899', '#34d399', '#a855f7'].map(
                        (hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => {
                              AudioService.playCoin();
                              applyFirstRunDraftUpdate((draft) => {
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
                        )
                      )}
                      <input
                        type="color"
                        data-testid="setup-vessel-cherenkov-input"
                        value={proceduralConfig.player.vesselCherenkovHex}
                        onChange={(e) => {
                          const val = e.target.value;
                          applyFirstRunDraftUpdate((draft) => {
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
                            applyFirstRunDraftUpdate((draft) => {
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
                          applyFirstRunDraftUpdate((draft) => {
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
                            applyFirstRunDraftUpdate((draft) => {
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
                          applyFirstRunDraftUpdate((draft) => {
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
                        applyFirstRunDraftUpdate((draft) => {
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
                          applyFirstRunDraftUpdate((draft) => {
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
                          applyFirstRunDraftUpdate((draft) => {
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
                        applyFirstRunDraftUpdate((draft) => {
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
                            applyFirstRunDraftUpdate((draft) => {
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
                    <p className="text-[10px] text-zinc-400 leading-snug">
                      {alphaPhysics.summary}
                    </p>
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
                            managerRef.current?.setCruiseVelocity(0);
                            managerRef.current?.setSeamlessLogScale(s.log, true);
                          }}
                          className={`py-1 px-1 rounded border cursor-pointer truncate ${
                            Math.abs(universeScale.logScaleMeters - s.log) < 0.8
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
                  applyFirstRunDraftUpdate((draft) => {
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
                onClick={() => handleCompleteFirstRunSetup(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Rocket className="w-3.5 h-3.5 shrink-0" />
                <span>Launch Chrono-Vessel</span>
              </button>
            </div>
          </aside>
        );
      })()}

      {/* =====================================================================
          FUTURE CAPYBARA CHRONO-VESSEL FLIGHT STRIP (Collapsible Bottom Controls)
          Crisp solid zinc surface (zero backdrop-blur) during cosmic voyage.
         ===================================================================== */}
      {universeScale.active && !isFirstRunSetupOpen && !webglError && !isJsonEditorOpen && !isSettingsOpen && (
        <div
          data-testid="chrono-vessel-flight-strip"
          className="fixed bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[calc(100vw-16px)] max-w-[700px] bg-zinc-950/95 border border-cyan-400/30 rounded-xl shadow-2xl px-2.5 py-1.5 text-zinc-100"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Rocket className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-semibold text-zinc-100 truncate">
                Chrono-Vessel
              </span>
              <span
                data-testid="flight-strip-epoch"
                className="text-[10px] font-mono tabular-nums text-cyan-300 shrink-0"
              >
                T+{universeScale.cosmicAgeGyr.toFixed(2)} Gyr
              </span>
              <span className="text-zinc-600 text-[10px] hidden sm:inline">·</span>
              <span className="hidden sm:inline text-[10px] font-mono tabular-nums text-amber-300 shrink-0">
                {universeScale.scientificLabel} ({universeScale.scaleFormatted})
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-testid="chrono-land-pad-btn"
                onClick={() => managerRef.current?.engageAutoLanding()}
                className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/45 text-[10px] font-mono font-semibold cursor-pointer whitespace-nowrap"
              >
                Land on Pad
              </button>
              <button
                type="button"
                data-testid="toggle-flight-strip-collapse"
                onClick={() => setIsFlightStripCollapsed((prev) => !prev)}
                aria-label={isFlightStripCollapsed ? 'Expand Chrono Controls' : 'Collapse Chrono Controls'}
                className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer"
              >
                {isFlightStripCollapsed ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {!isFlightStripCollapsed && (
            <div className="mt-1.5 pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="text-[9px] font-mono uppercase text-zinc-500 mr-0.5">
                  Throttle:
                </span>
                {[
                  { vel: -6.0, label: '-6/s' },
                  { vel: -2.2, label: '-2.2/s' },
                  { vel: 0.0, label: 'Hold' },
                  { vel: 2.2, label: '+2.2/s' },
                  { vel: 6.0, label: '+6/s' },
                ].map((btn) => {
                  const isActive =
                    btn.vel === 0
                      ? universeScale.autoZoomDir === 0
                      : universeScale.autoZoomDir !== 0 &&
                        Math.abs(universeScale.cruiseVelocityLogPerSec - btn.vel) < 0.25 &&
                        Math.sign(btn.vel) === universeScale.autoZoomDir;
                  return (
                    <button
                      key={btn.label}
                      type="button"
                      data-testid={`throttle-btn-${btn.vel}`}
                      onClick={() => managerRef.current?.setCruiseVelocity(btn.vel)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border cursor-pointer flex items-center gap-0.5 ${
                        isActive
                          ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 font-semibold'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
                      }`}
                    >
                      {btn.vel === 0 ? (
                        <Pause className="w-2.5 h-2.5" />
                      ) : (
                        <Play className="w-2.5 h-2.5" />
                      )}
                      <span>{btn.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="toggle-vessel-view-btn"
                onClick={() => {
                  const nextView: ChronoVesselViewMode =
                    universeScale.vesselMode === 'telescope_first_person'
                      ? 'chase_pod'
                      : 'telescope_first_person';
                  managerRef.current?.setVesselMode(nextView);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-sky-400/30 cursor-pointer shrink-0"
              >
                <Eye className="w-3 h-3" />
                <span>
                  {universeScale.vesselMode === 'telescope_first_person'
                    ? 'Telescope 1P'
                    : 'Chase Pod 3P'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          BUILT-IN LIVE PROCEDURAL JSON CONFIG EDITOR MODAL
         ===================================================================== */}
      {isJsonEditorOpen && (
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
                onClick={() => setIsJsonEditorOpen(false)}
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
                        onClick={() => handleSelectProceduralPreset(preset.config)}
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
                    onClick={handleRandomizeProceduralSeed}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-amber-400/30 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Randomize Seed</span>
                  </button>
                  <button
                    type="button"
                    data-testid="json-format-btn"
                    onClick={handleFormatJsonDraft}
                    className="px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer"
                  >
                    Format JSON
                  </button>
                  <button
                    type="button"
                    data-testid="json-copy-btn"
                    onClick={handleCopyJsonDraft}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{jsonCopyLabel}</span>
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="json-reset-default-btn"
                  onClick={handleResetProceduralDefault}
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
                onChange={(e) => handleJsonDraftChange(e.target.value)}
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
                  onClick={() => handleApplyJsonConfig(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 text-xs font-medium border border-white/15 cursor-pointer"
                >
                  Apply Live
                </button>
                <button
                  type="button"
                  data-testid="json-apply-regen-btn"
                  disabled={Boolean(jsonValidationError)}
                  onClick={() => handleApplyJsonConfig(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-zinc-950 text-xs font-semibold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply &amp; Regenerate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
