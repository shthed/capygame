import * as THREE from 'three';
import * as THREE_WEBGPU from 'three/webgpu';
import {
  CapyModelGenerator,
  CapyMeshGroup,
  CollectibleOrangeGroup,
  DachshundCabooseGroup,
  DachshundSegmentGroup,
} from './CapyModelGenerator';
import {
  CosmicUniverseBuilder,
  StellarColorMappingMode,
} from './CosmicUniverseBuilder';
import { SeamlessUniverseSimulator } from './SeamlessUniverseSimulator';
import {
  ExponentialFruitTree,
  HomePoolSystem,
  RealisticWorldEnvironment,
  SHARED_OCCLUDER_HEAD_CLIP,
  SHARED_OCCLUDER_HEAD_UV,
  SHARED_OCCLUDER_TAIL_CLIP,
  SHARED_OCCLUDER_VIEWPORT,
  evaluateSightlineEdgeAlphaAtScreenUv,
  installSightlineEdgeFadeShader,
} from './RealisticWorldEnvironment';
import {
  AdaptiveGpuMitigationResult,
  PerformanceLogTracker,
  computeAdaptiveGpuMitigation,
  computeDistrictTickStride,
  computeEffectiveCameraFar,
  computeEffectivePixelRatio,
  computeMouseLookAngles,
  computeVesselOneToOneTransform,
  dampShortestAngle,
  doesSphereBlockPlayerSightline,
  findNextEffectiveMitigationLevel,
  findPrevEffectiveMitigationLevel,
  installFastMatrixCull,
  isLowMemoryEnvironment,
  shouldEnableOccluderDepthWrite,
  shouldRenderDistrict,
} from './gpu/FramePerformanceGovernor';
import { PerformanceProfiler } from './gpu/PerformanceProfiler';
import {
  ArcadeComboTelemetry,
  AstrophysicsPaletteMode,
  BountyEventType,
  BuildingType,
  CAPYBARA_FOREST_LOG_METERS,
  CapyGameSettings,
  CapyLodTier,
  CapySnakeTelemetry,
  ChronoVesselViewMode,
  COSMIC_GALAXIES,
  CosmicStage,
  DEFAULT_CAPY_SETTINGS,
  ForestMicroSpecimenId,
  GalaxyMorphology,
  GpuEngineTelemetry,
  GpuPipelineConfig,
  GpuQualityPreset,
  HEAD_ORANGE_VARIETIES,
  LiveModeTelemetry,
  MAX_UNIVERSE_LOG_METERS,
  MIN_UNIVERSE_LOG_METERS,
  PLAYABLE_CAPY_HEROES,
  PerformanceLogSnapshot,
  PerformanceAnalysisSnapshot,
  PlanetaryBiomeConfig,
  PlayableCapyHero,
  PlayStyle,
  PlayerStats,
  ProjectedObjectMarker,
  QuantumFocusMode,
  UNIVERSE_SCALE_BANDS,
  UniverseScaleBandId,
  UniverseScaleTelemetry,
  ZONE_LOCATIONS,
  findNearestScaleBandIndex,
  formatPhysicalScaleMeters,
  OrbitTelemetry,
  OrbitTimeScaleId,
  ORBIT_TIME_SCALES,
} from '../types';
import { AudioService } from '../services/AudioService';
import { ProgressionService } from '../services/ProgressionService';
import { NativeBridge } from '../../services/NativeBridge';
import { AaaWorldVfxEngine } from './gpu/AaaWorldVfxEngine';
import { HardwareGpuEngine } from './gpu/HardwareGpuEngine';
import { PbrTextureSynthesizer } from './gpu/PbrTextureSynthesizer';
import {
  WebGpuPostAndComputePipeline,
  WebGpuProbeResult,
  convertLegacyShaderMaterialsToTsl,
} from './gpu/WebGpuPipeline';
import { PhysicsWorldBridge } from './physics/PhysicsWorldBridge';
import {
  CONTIGUOUS_BRIDGES,
  OPEN_OCEAN_SURFACE_Y,
  classifyDistrictAtWorldPos,
  sampleContiguousGroundY,
} from './physics/ContiguousWorldTopology';
import {
  RealisticLimbPose,
  SANE_CABOOSE_LINK_DIST,
  SANE_HERO_LINK_DIST,
  SANE_SEGMENT_SPACING,
  advanceDisplacementCoupledGaitPhase,
  computeLinearDachshundState,
  computeTerrainPitchAngle,
  evaluateRealisticLimbPose,
  solveBidirectionalSpinePass,
  solveSpineVerticalCoupling,
} from './physics/QuadrupedGaitSolver';
import {
  GhostPoseScratch,
  QuantizedGhostRun,
  YuzuGhostRecorder,
  createGhostPoseScratch,
  loadBestYuzuGhostRun,
  sampleGhostRunAtTime,
  saveBestYuzuGhostRunIfFaster,
} from './physics/YuzuGhostRecorder';
import type {
  PhysicsEngineTelemetry,
  StaticBoxColliderSpec,
  StaticCircleColliderSpec,
} from './physics/PhysicsTypes';
import { clampStarSystemIndex } from './physics/ColliderMath';
import { disposeObject3DTree } from './gpu/ThreeDisposal';
import {
  ChronoVesselRig,
  SanctuaryChronoPadSystem,
  createSanctuaryChronoPad,
} from './ChronoVesselRig';
import {
  DEFAULT_PROCEDURAL_GAME_CONFIG,
  ProceduralGameConfig,
  cloneProceduralConfig,
  mulberry32,
  parseHexColorString,
} from '../config/ProceduralGameConfig';
import { computeCosmicAgeGyr } from './SeamlessUniverseSimulator';
import {
  CAPYTORIO_OBLIQUE_BASE_RADIUS_M,
  CAPYTORIO_ORBIT_HANDOFF_DIST,
  CAPYTORIO_ORBIT_HANDOFF_LOG_METERS,
  CAPYTORIO_ZOOM_MIN_DIST,
  FlightTrajectoryMode,
  MEDIA_SPEED_GEARS,
  MediaSpeedAction,
  SURFACE_ZOOM_ORBIT_THRESHOLD,
  clampForwardFlightSpeed,
  computeCapytorioZoomStep,
  computeOrbitalZoomThrottleStep,
  computeSpiralOrbitAngleRadians,
  computeSurfaceZoomStep,
  stepFlightSpeedGear,
  stepMediaSpeedControl,
  stepSteadyLogScaleTowardTarget,
} from './UniverseScaleMath';
import {
  COMBO_WINDOW_SEC,
  DESCENT_RING_SPECS,
  MutableComboState,
  computeContinuousDescentCamRadius,
  computeDescentApproachDampingFactor,
  computeOrbitalSurfaceBlend,
  createEmptyComboState,
  registerComboHit,
  smoothstep01,
  tickComboDecay,
} from './GameplayFunMath';
import {
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_TILE_SIZE,
  CAPYTORIO_WORLD_ORIGIN_X,
  CAPYTORIO_WORLD_ORIGIN_Z,
  ensureLiveCapytorioLuaSync,
  getCapytorioItemMeta,
  subscribeCapytorioLuaChanges,
  type CapytorioDirection,
  type CapytorioItemId,
  type CapytorioMachineType,
  type CapytorioRecipeId,
  type CapytorioTechId,
} from './CapytorioData';
import {
  CapytorioFactoryEngine,
  capytorioGridToWorldX,
  capytorioGridToWorldZ,
  getCapytorioPlacementAnchor,
  resolveCapytorioPlaceableSpec,
  worldToCapytorioGridX,
  worldToCapytorioGridZ,
  type CapytorioClipboardToolState,
  type CapytorioInserterFilterMode,
  type CapytorioSavedBlueprint,
  type CapytorioSelectionShape,
  type CapytorioSerializedState,
  type CapytorioSplitterPriority,
  type CapytorioStepCallbacks,
  type CapytorioTileInspection,
  type CapytorioUiSnapshot,
} from './CapytorioFactoryEngine';
import { resolvePediaIdFromTileInspection } from './CapytorioPedia';
import { Capytorio3DRenderer } from './CapytorioMeshBuilder';

const CAPYTORIO_OBLIQUE_PITCH_RAD = (68 * Math.PI) / 180;
const CAPYTORIO_HIGH_ORBIT_PITCH_RAD = (84 * Math.PI) / 180;
const _capytorioAltPose = {
  distScale: 1.0,
  altitudeRadius: CAPYTORIO_OBLIQUE_BASE_RADIUS_M,
  logAlt: Math.log10(CAPYTORIO_OBLIQUE_BASE_RADIUS_M),
  pitchRad: CAPYTORIO_OBLIQUE_PITCH_RAD,
  dy: Math.sin(CAPYTORIO_OBLIQUE_PITCH_RAD) * CAPYTORIO_OBLIQUE_BASE_RADIUS_M,
  dz: Math.cos(CAPYTORIO_OBLIQUE_PITCH_RAD) * CAPYTORIO_OBLIQUE_BASE_RADIUS_M,
};

function evaluateCapytorioAltitudePose(distScale: number) {
  const safeDist =
    Number.isFinite(distScale) && distScale > 0
      ? Math.max(CAPYTORIO_ZOOM_MIN_DIST, Math.min(CAPYTORIO_ORBIT_HANDOFF_DIST, distScale))
      : 1.0;
  const altitudeRadius = CAPYTORIO_OBLIQUE_BASE_RADIUS_M * safeDist;
  const logAlt = Math.log10(Math.max(1.0, altitudeRadius));
  const overheadBlend = THREE.MathUtils.smoothstep(logAlt, 2.0, 4.2);
  const pitchRad = THREE.MathUtils.lerp(
    CAPYTORIO_OBLIQUE_PITCH_RAD,
    CAPYTORIO_HIGH_ORBIT_PITCH_RAD,
    overheadBlend
  );
  _capytorioAltPose.distScale = safeDist;
  _capytorioAltPose.altitudeRadius = altitudeRadius;
  _capytorioAltPose.logAlt = logAlt;
  _capytorioAltPose.pitchRad = pitchRad;
  _capytorioAltPose.dy = Math.sin(pitchRad) * altitudeRadius;
  _capytorioAltPose.dz = Math.cos(pitchRad) * altitudeRadius;
  return _capytorioAltPose;
}

// Pre-allocated math helpers for zero per-frame garbage collection
const _tempVec3 = new THREE.Vector3();
const _samplePos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _rollAxis = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _raycaster = new THREE.Raycaster();
const _occluderRaycaster = new THREE.Raycaster();
const _headWorldPos = new THREE.Vector3();
const _heroTorsoWorldPos = new THREE.Vector3();
const _rayTargetPos = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _capyGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _capyGroundHit = new THREE.Vector3();
const _capyPointerNdc = new THREE.Vector2();
const _beltVelScratch: [number, number] = [0, 0];
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _ringPosScratch = new THREE.Vector3();
const _ringVesselScratch = new THREE.Vector3();
const _rayHits: THREE.Intersection[] = [];
const _occluderCandidates: THREE.Object3D[] = [];
const _rendererSizeVec2 = new THREE.Vector2(1280, 720);
const _occProjectedNdc = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _vesselUprightQuat = new THREE.Quaternion();
const _vesselEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _galaxyArmWorldDir = new THREE.Vector3();
const _vesselNavQuat = new THREE.Quaternion();
const _vesselNavEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _colorHelper = new THREE.Color();
const _colorHelper2 = new THREE.Color();
const _seamlessSkyColor = new THREE.Color();
const _seamlessFocalPos = new THREE.Vector3();
const _sanctuaryGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ghostWorldHit = new THREE.Vector3();
const _storyDescentStartCam = new THREE.Vector3(0, 6, 30);
const _storyDescentStartLook = new THREE.Vector3(0, 0, 0);
const _storySelectionCamPos = new THREE.Vector3(0, 4.2, 9.8);
const _storySelectionLook = new THREE.Vector3(0, 0.9, -1.0);
const _spineSupportY = new Float32Array(52);
const _cachedPoolSpec = { x: -8.8, z: 3.0, radius: 4.8 };
const EMPTY_PROJECTED_MARKERS: ProjectedObjectMarker[] = [];

const SNAKE_PATH_CAPACITY = 800;
const MAX_DACHSHUND_SEGMENTS = 48;
const DACHSHUND_SEGMENT_SPACING = SANE_SEGMENT_SPACING;
const MAX_SPINE_NODES = MAX_DACHSHUND_SEGMENTS + 2;
const MAX_SPINE_BEND_RAD = 0.52; // ~30 deg max articulation bend so backing up never jackknifes
const MAX_SOLID_SQUASH = 0.06; // Solid body: <= 6% slight compression on impact
const MAX_PHYSICS_FRUITS = 64;
const POND_OVERFLOW_FRUIT_THRESHOLD = 6;
const MAX_SANCTUARY_BUDDIES = 12;
const MAX_SPORE_ORBS = 72;
const MAX_SPORE_CRITTERS = 32;
const MAX_BREAKOUT_BALLS = 8;
const MAX_BREAKOUT_POWERUPS = 6;
const MAX_BREAKOUT_ROWS = 7;
const MAX_BREAKOUT_COLS = 7;
const MAX_RUNNER_HERD = 22;
const CHRONO_PAD_X = 9.8;
const CHRONO_PAD_Z = 12.6;
const CHRONO_PAD_RADIUS = 2.65;

function normalizeAngleSigned(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function distSqPointToSegment2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq < 0.0001) {
    const dx = px - ax;
    const dz = pz - az;
    return dx * dx + dz * dz;
  }
  let t = ((px - ax) * abx + (pz - az) * abz) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + abx * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
}

export interface PhysicsFruit {
  active: boolean;
  inPond: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  varietyIndex: number;
  squash: number;
  squashVel: number;
  pickupDelay: number;
  bobPhase: number;
  mesh: CollectibleOrangeGroup;
}

export interface PlacementGhostStatus {
  active: boolean;
  type: BuildingType | null;
  name: string;
  x: number;
  z: number;
  valid: boolean;
}

export interface GameEventCallbacks {
  onProgressEarned: (dna: number, mode: PlayStyle, score: number) => void;
  onTelemetryUpdate: (telemetry: LiveModeTelemetry) => void;
  onSnakeTelemetryUpdate?: (snake: CapySnakeTelemetry) => void;
  onModeNotification?: (msg: string) => void;
  onPortalEntered?: (targetMode: PlayStyle) => void;
  onBuildingGhostConfirmed?: (
    type: BuildingType,
    name: string,
    x: number,
    z: number,
    description: string
  ) => void;
  onPlacementGhostChange?: (ghost: PlacementGhostStatus) => void;
  onCosmicStateChange?: (
    stage: CosmicStage,
    galaxyIdx: number,
    starIdx: number,
    planetIdx: number,
    landingIdx: number,
    heroIdx: number,
    flashOpacity: number
  ) => void;
  onUniverseScaleChange?: (scaleInfo: UniverseScaleTelemetry) => void;
  onOrbitTelemetryChange?: (telemetry: OrbitTelemetry) => void;
  onZoomThumbnailUpdated?: (bandId: UniverseScaleBandId, dataUrl: string) => void;
  onZoomThumbnailsReset?: () => void;
  onForestSpecimenDiscovered?: (specimenId: ForestMicroSpecimenId, label: string) => void;
  onBountyEvent?: (eventType: BountyEventType, amount?: number) => void;
  onCapytorioChange?: (snap: CapytorioUiSnapshot) => void;
  onCapytorioFactorySaved?: (serialized: CapytorioSerializedState) => void;
}

export class PlayStyleManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer | THREE_WEBGPU.WebGPURenderer;
  public readonly isSoftwareGl: boolean;
  public readonly isWebGpu: boolean;
  public readonly performanceLog = new PerformanceLogTracker();
  public readonly profiler = new PerformanceProfiler();
  private webGpuPipeline: WebGpuPostAndComputePipeline | null = null;

  public currentMode: PlayStyle = 'sanctuary';
  private stats: PlayerStats;
  private settings: CapyGameSettings;
  private callbacks: GameEventCallbacks;
  private telemetryTimer: number = 0;

  // Adaptive GPU FPS Optimizer state (zero per-frame allocations)
  private adaptiveMitigationLevel: number = 0;
  private adaptiveLastStepMs: number = 0;
  private adaptiveRecoveryAccumSec: number = 0;
  private adaptiveLowPerfStreak: number = 0;
  private pendingAdaptiveGpuConfig: GpuPipelineConfig | null = null;
  private readonly adaptiveMitigationResult: AdaptiveGpuMitigationResult = {
    level: 0,
    postProcessingEnabled: true,
    ssaoEnabled: true,
    bloomEnabled: true,
    shadowQuality: 'pcf_soft',
    antiAliasing: 'msaa_fxaa',
    resolutionScale: 1.0,
    maxCapyLodTier: 3,
    disabledFeatures: [],
  };
  private readonly effectiveGpuConfigScratch: GpuPipelineConfig = {
    qualityPreset: 'high',
    postProcessingEnabled: true,
    visualFilterPreset: 'natural_pbr',
    toneMapping: 'agx',
    exposure: 1.02,
    textureFilter: 'trilinear_aniso',
    anisotropyLevel: 8,
    shadowQuality: 'pcf_soft',
    antiAliasing: 'msaa_fxaa',
    resolutionScale: 1.0,
    bloomEnabled: true,
    bloomStrength: 0.24,
    ssaoEnabled: true,
    sharpenAmount: 0.26,
  };

  // Shared 3D World Groups (all 5 game zones live simultaneously in one contiguous world)
  private worldBaseGroup = new THREE.Group();
  private sanctuaryGroup = new THREE.Group();
  private sporeGroup = new THREE.Group();
  private capytorioGroup = new THREE.Group();
  private runnerGroup = new THREE.Group();
  private fallGuysGroup = new THREE.Group();

  // Cosmic Genesis & Multi-Scale Universe State
  public cosmicStage: CosmicStage = 'playing';
  public cosmicBuilder: CosmicUniverseBuilder;
  public seamlessUniverse: SeamlessUniverseSimulator;
  public chronoVessel!: ChronoVesselRig;
  public chronoPad: SanctuaryChronoPadSystem | null = null;
  public seamlessZoomActive: boolean = false;
  private vesselMode: ChronoVesselViewMode = 'chase_pod';
  private cruiseVelocityLogPerSec: number = 0;
  private targetCruiseVelocityLogPerSec: number = 0;
  private proceduralConfig: ProceduralGameConfig = cloneProceduralConfig(
    DEFAULT_PROCEDURAL_GAME_CONFIG
  );
  private proceduralPrng: () => number = mulberry32(
    DEFAULT_PROCEDURAL_GAME_CONFIG.meta.seed
  );
  private currentLogScaleMeters: number = MAX_UNIVERSE_LOG_METERS;
  private targetLogScaleMeters: number = MAX_UNIVERSE_LOG_METERS;
  private autoLandAtForestPending: boolean = false;
  private autoLandTargetMode: 'sanctuary' | 'capytorio' = 'sanctuary';
  private lastLaunchSourceMode: 'sanctuary' | 'capytorio' = 'sanctuary';
  private capytorioObliqueZoomDist: number = 1.0;
  private capytorioPlanetFadeActive: boolean = false;
  private quantumFocusMode: QuantumFocusMode = 'auto';
  private autoZoomDirection: -1 | 0 | 1 = 0;
  public flightTrajectory: FlightTrajectoryMode = 'spiral';
  private lastPlayingForwardSpeed: number = 0.16;
  private readonly spiralBandLogs: readonly number[] = UNIVERSE_SCALE_BANDS.map(
    (b) => b.logMeters
  );
  private seamlessTelemetryAccum: number = 0;
  private lastSoftwareRenderMs: number = -1000;
  public allFeaturesUnlockedOverride: boolean = false;
  private disposed: boolean = false;
  private idleWarmupCancel: (() => void) | null = null;

  // Dynamic Scale-Band Thumbnail Snapshot State (reusable 256x160 offscreen canvas, zero per-frame allocs)
  private thumbCanvas: HTMLCanvasElement | null = null;
  private thumbCtx: CanvasRenderingContext2D | null = null;
  private thumbStyleEpoch: number = 1;
  private thumbBandVersion: Partial<Record<UniverseScaleBandId, number>> = {};
  private thumbSettledBandId: UniverseScaleBandId | null = null;
  private thumbSettledAccumSec: number = 0;
  private pendingThumbnailBandId: UniverseScaleBandId | null = null;

  public selectedGalaxyIndex: number = 0;
  public selectedStarIndex: number = 0;
  public selectedPlanetIndex: number = 1;
  public selectedLandingIndex: number = 0;
  public selectedCapyHeroIndex: number = 0;
  public orbitTimeScale: OrbitTimeScaleId = '1_orbit_min';
  public activeBiome: PlanetaryBiomeConfig =
    (COSMIC_GALAXIES[0].starSystems[0].planets.find((p) => p.landingSpots.length > 0)
      ?.landingSpots[0].biome) || {
      biomeName: 'Emerald Onsen Bay',
      skyHex: 0x38bdf8,
      fogHex: 0x38bdf8,
      oceanHex: 0x0284c7,
      islandGrassHex: 0x4ade80,
      beachSandHex: 0xfde68a,
      floraPaletteHexes: [0xfef08a, 0xf472b6, 0x93c5fd, 0xd8b4fe, 0xe2e8f0],
      gravityMultiplier: 1.0,
    };
  public activeHeroSpec: PlayableCapyHero = PLAYABLE_CAPY_HEROES[0];

  private cosmicCamPos = new THREE.Vector3(0, 0, 26);
  private cosmicCamLook = new THREE.Vector3(0, 0, 0);
  private cosmicOrbitYaw: number = 0;
  private cosmicOrbitPitch: number = 0.28;
  private surfaceCamYaw: number = Math.PI;
  private surfaceCamPitch: number = 0.44;
  private mouselookLastActiveTimeMs: number = -100000;
  private mouselookLocked: boolean = false;
  private mouselookBankX: number = 0;
  private mouselookPitchZ: number = 0;
  public cosmicZoomMultiplier: number = 1.0;
  private cosmicDescentElapsed: number = 0;
  private lastDiscoveredSpecimenId: ForestMicroSpecimenId | null = null;
  private readonly gpuWakeParamsScratch = new Float32Array(4);

  // Photorealistic Hardware-Accelerated 3D GPU Engine, AAA VFX, World, Mountains, Home Pool & Exponential Trees
  public gpuEngine!: HardwareGpuEngine;
  public vfxEngine!: AaaWorldVfxEngine;
  public worldEnv!: RealisticWorldEnvironment;
  public homePool!: HomePoolSystem;
  public sanctuaryTrees: ExponentialFruitTree[] = [];
  public physicsFruits: PhysicsFruit[] = [];
  private fruitsGroup = new THREE.Group();

  // Dynamic Biome Meshes, Causeway Lanterns, AAA Camera Trauma & Selectable Capybara Heroes Circle
  private oceanMesh: THREE.Mesh | null = null;
  private sanctuaryIslandMesh: THREE.Mesh | null = null;
  private sanctuaryBeachMesh: THREE.Mesh | null = null;
  private sanctuaryDecorMesh: THREE.InstancedMesh | null = null;
  private causewayLanternMat: THREE.MeshStandardMaterial | null = null;
  private cameraTrauma: number = 0;
  private cameraShakePhase: number = 0;
  private dynamicFovOffset: number = 0;
  private prevHeroWorldX: number = 0;
  private prevHeroWorldZ: number = 4;
  private prevHeroPosInitialized: boolean = false;
  private selectableCapyGroup = new THREE.Group();
  private selectableCapyRings: THREE.Mesh[] = [];
  private selectableCapyHitMeshes: THREE.Object3D[] = [];

  // Hero Capybara & Local Zone Coordinates
  public heroCapy: CapyMeshGroup;
  public heroLocalPos = new THREE.Vector3(0, 0, 4);
  public heroYaw: number = Math.PI; // Facing -Z into the island/course
  private heroVelocity = new THREE.Vector3();
  private isGrounded: boolean = true;
  private isSwimmingInPool: boolean = false;
  private lastOceanFluidActive: boolean = false;
  private baseHeroSpeed: number = 9.0;

  // Realistic Foot-Contact Walking Traction & Suspension State
  public groundedFeetCount: number = 4;
  public totalFeetCount: number = 4;
  public isWalkingBackward: boolean = false;
  public isStuckNoFooting: boolean = false;
  public suspendedFootTestHeight: number | null = null;

  // Camera-to-Head Line-of-Sight Occlusion Transparency State
  public occludedObjectsFadedCount: number = 0;
  private fadedOccluderMeshes: THREE.Mesh[] = [];
  private currentFrameOccluders = new Set<THREE.Mesh>();
  private currentFrameOccluderList: THREE.Mesh[] = [];
  private currentFrameOccludedEntities = new Set<THREE.Object3D>();
  // Frame-local scalar scratch for zero-allocation sightline checks
  private occCamX = 0;
  private occCamY = 0;
  private occCamZ = 0;
  private occHeadX = 0;
  private occHeadY = 0;
  private occHeadZ = 0;
  private occTorsoX = 0;
  private occTorsoY = 0;
  private occTorsoZ = 0;
  private occPlayerPlaneDepth = 1;

  // Zero-Allocation Solid-Body Slight Squash State (clamped to +-6%)
  public heroSoftSquash: number = 0;
  private heroSoftSquashVel: number = 0;
  private segSoftSquash = new Float32Array(MAX_DACHSHUND_SEGMENTS);
  private segSoftSquashVel = new Float32Array(MAX_DACHSHUND_SEGMENTS);
  private buddySoftSquash = new Float32Array(MAX_SANCTUARY_BUDDIES);
  private buddySoftSquashVel = new Float32Array(MAX_SANCTUARY_BUDDIES);

  // Bidirectional Articulated Solid-Rod Spine State (node 0 = Hero, 1..N = Segments, N+1 = Caboose)
  private spineX = new Float32Array(MAX_SPINE_NODES);
  private spineY = new Float32Array(MAX_SPINE_NODES);
  private spineZ = new Float32Array(MAX_SPINE_NODES);
  private spineYaw = new Float32Array(MAX_SPINE_NODES);
  private spineInitialized: boolean = false;

  // Quick World Zone Travel Interpolation
  private zoneTransition = {
    active: false,
    elapsed: 0,
    duration: 0.42,
    fromWorldPos: new THREE.Vector3(),
    toWorldPos: new THREE.Vector3(),
  };

  // Unified Input State (Keyboard + Touch D-pad + Pointer Drag + Kinetic Abilities)
  public moveInput = { x: 0, z: 0 };
  public pointerTargetX: number | null = null;
  public isJumping: boolean = false;
  private heroDashCooldown: number = 0;
  private heroDashActiveTimer: number = 0;
  private heroDashDirX: number = 0;
  private heroDashDirZ: number = 0;
  private isGroundPounding: boolean = false;
  private coyoteGroundedTimer: number = 0;

  // Arcade Combo Multiplier & Orbital Skydiving Descent Rings
  private comboState: MutableComboState = createEmptyComboState();
  private readonly comboTelemetryScratch: ArcadeComboTelemetry = {
    active: false,
    count: 0,
    multiplier: 1,
    timeRemainingSec: 0,
    maxWindowSec: COMBO_WINDOW_SEC,
    feverActive: false,
    lastActionLabel: '',
  };
  private descentRingsGroup = new THREE.Group();
  private descentRingMeshes: THREE.Mesh[] = [];
  private descentRingHitFlags: boolean[] = DESCENT_RING_SPECS.map(() => false);
  private descentRingsHitCount: number = 0;
  private dockedChronoVesselVisible: boolean = false;
  private storySurfaceRevealed: boolean = false;

  // --- Dynamic 60 FPS Capybara Level-of-Detail (LOD) Governor & Frame Budget Pacing ---
  private rollingFps: number = 60;
  private currentCapyLodTier: CapyLodTier = 3;
  private lodGovernorAccum: number = 0;
  private lodHighFpsStreak: number = 0;
  private lodLowFpsStreak: number = 0;
  private cosmicUiTelemetryAccum: number = 0;
  private bgDistrictFrameCounter: number = 0;
  private readonly bgDistrictDtAccum: Record<PlayStyle, number> = {
    sanctuary: 0,
    spore: 0,
    capytorio: 0,
    runner: 0,
    fallguys: 0,
  };

  // --- 1. Sanctuary, Logarithmic Dachshund Capy-Snake & Home Pool State ---
  private sanctuaryCapys: Array<{
    capy: CapyMeshGroup;
    target: THREE.Vector3;
    stateTimer: number;
  }> = [];
  private sanctuaryPortals: Array<{
    mesh: THREE.Group;
    mode: PlayStyle;
    x: number;
    z: number;
    rotY: number;
  }> = [];
  private sanctuaryBuildingMeshes: THREE.Group[] = [];
  public heroTailAuraMat: THREE.MeshBasicMaterial;
  private heroTailAuraMesh: THREE.Mesh;
  private portalCooldown: number = 0;
  public physicsBridge: PhysicsWorldBridge;
  private hammerWorldScratch: Array<{
    wx: number;
    wz: number;
    angleY: number;
    angularSpeed: number;
    halfLen: number;
  }> = [
    {
      wx: ZONE_LOCATIONS.fallguys.x,
      wz: ZONE_LOCATIONS.fallguys.z - 12,
      angleY: 0,
      angularSpeed: 2.4,
      halfLen: 4.75,
    },
    {
      wx: ZONE_LOCATIONS.fallguys.x,
      wz: ZONE_LOCATIONS.fallguys.z - 20,
      angleY: 0,
      angularSpeed: -2.4,
      halfLen: 4.75,
    },
  ];

  // Interactive Raycast Building Placement Ghost (Sanctuary Island)
  private placementGhost: {
    active: boolean;
    type: BuildingType | null;
    name: string;
    description: string;
    x: number;
    z: number;
    valid: boolean;
    group: THREE.Group | null;
    ringMat: THREE.MeshBasicMaterial | null;
    ghostMats: THREE.MeshStandardMaterial[];
  } = {
    active: false,
    type: null,
    name: '',
    description: '',
    x: 0,
    z: 0,
    valid: false,
    group: null,
    ringMat: null,
    ghostMats: [],
  };

  // Logarithmic Body Length, Head Fruit Stack & Home Pool Overflow State
  private dachshundGroup = new THREE.Group();
  private dachshundSegments: DachshundSegmentGroup[] = [];
  private dachshundCaboose!: DachshundCabooseGroup;
  private snakeSegmentCount: number = 1;
  private bestSnakeSegments: number = 1;
  private orangesCollectedCount: number = 0;
  private fruitsCarried: number = 1; // Always >= 1 (base signature Head Orange)
  private eatenFruitMass: number = 0; // Accumulated fruit mass for mouth sizing
  private logarithmicLengthMeters: number = 3.43;
  private activeHeadOrangeIndex: number = 0;
  private lastSanctuaryLeaderDisp: number = 0;
  private _limbPoseScratch: RealisticLimbPose = {
    hipPitch: 0,
    kneePitch: 0,
    anklePitch: 0,
    hipDropFactor: 1,
    suspensionBounce: 0,
    pelvicRoll: 0,
  };
  private snakePathX = new Float32Array(SNAKE_PATH_CAPACITY);
  private snakePathY = new Float32Array(SNAKE_PATH_CAPACITY);
  private snakePathZ = new Float32Array(SNAKE_PATH_CAPACITY);
  private snakePathHead: number = 0;
  private snakePathCount: number = 0;
  private snakeSelfHitCooldown: number = 0;
  private buddyBumpCooldown: number = 0;
  private mouthFullNotifyCooldown: number = 0;
  private tapWashAccum: number = 0;
  private pondFruitCount: number = 0;
  private pondDisplacedVolume: number = 0;
  private pondOverflowing: boolean = false;
  private pondMessLevel: number = 0;
  private pondSplashTimer: number = 0;

  private orchardAutoDropTimer: number = 0;

  // --- 2. Spore Evolution State ---
  private sporeMass: number = 10;
  private sporeDnaEarned: number = 0;
  private sporeOrbs: Array<{
    mesh: THREE.Mesh;
    isDna: boolean;
    value: number;
    active: boolean;
  }> = [];
  private sporeCritters: Array<{
    mesh: CapyMeshGroup;
    scale: number;
    vel: THREE.Vector3;
    changeDirTimer: number;
    active: boolean;
  }> = [];
  private sporePoolsInitialized: boolean = false;
  private sporeOrbSphereGeo: THREE.SphereGeometry | null = null;
  private sporeOrbDnaGeo: THREE.OctahedronGeometry | null = null;
  private sporeOrbPlanktonMat: THREE.MeshStandardMaterial | null = null;
  private sporeOrbDnaMat: THREE.MeshStandardMaterial | null = null;
  private sporeRippleTexture: THREE.DataTexture | null = null;
  private sporeWaterMesh: THREE.Mesh | null = null;
  private sporeWaterMat: THREE.MeshPhysicalMaterial | null = null;
  private sporeDashCooldown: number = 0;
  private sporeLargeCritterKnockbackCd: number = 0;

  // --- 3. Capytorio Factory State (Far-Hemisphere Infinite Plain) ---
  public capytorioEngine: CapytorioFactoryEngine;
  private capytorioRenderer: Capytorio3DRenderer | null = null;
  private capytorioUiAccum: number = 0;
  private capytorioAutoSaveDirty: boolean = false;
  private capytorioAutoSaveTimer: number = 0;
  private pendingLandingPlayStyle: PlayStyle = 'sanctuary';
  private readonly capytorioStepCallbacks: CapytorioStepCallbacks;
  private unsubscribeCapytorioLua: (() => void) | null = null;

  // --- 4. Runner State ---
  private runnerHerdMeshes: CapyMeshGroup[] = [];
  private runnerTrackSegments: THREE.Group[] = [];
  private runnerDistance: number = 0;
  private runnerCapyCount: number = 1;
  private runnerSpeed: number = 15.0;
  private runnerGates: Array<{
    mesh: THREE.Group;
    panelMat: THREE.MeshBasicMaterial;
    type: 'add' | 'multiply' | 'sub';
    value: number;
    z: number;
    triggered: boolean;
  }> = [];
  private runnerPoolsInitialized: boolean = false;
  private runnerBannerTextureCache = new Map<string, THREE.CanvasTexture>();

  // --- 5. Fall Guys State ---
  private fallGuysCrowns: number = 0;
  private fallGuysRound: number = 1;
  private fallGuysInitialized: boolean = false;
  private spinningObstacles: Array<{ mesh: THREE.Mesh; speed: number; dir: number }> = [];
  private seeSaws: Array<{ mesh: THREE.Mesh; phase: number }> = [];
  private fallGuysRivals: Array<{
    capy: CapyMeshGroup;
    speed: number;
    laneOffset: number;
    vy: number;
  }> = [];
  private yuzuGhostRecorder = new YuzuGhostRecorder();
  private yuzuBestGhostRun: QuantizedGhostRun | null = loadBestYuzuGhostRun();
  private readonly yuzuGhostPoseScratch: GhostPoseScratch = createGhostPoseScratch();
  private yuzuGhostRunActive: boolean = false;
  private yuzuGhostRunElapsedSec: number = 0;
  private fallGuysGhostCapy: CapyMeshGroup | null = null;
  private fallGuysGhostMat: THREE.MeshStandardMaterial | null = null;

  private surfaceWorldsBuilt: boolean = false;
  private surfaceBuildStep: number = 0;
  private deferredBootCancel: (() => void) | null = null;
  private pendingProceduralConfigSync: boolean = false;

  constructor(
    container: HTMLElement,
    initialStats: PlayerStats,
    initialSettings: CapyGameSettings = DEFAULT_CAPY_SETTINGS,
    callbacks: GameEventCallbacks,
    webGpuInit?: {
      renderer?: THREE_WEBGPU.WebGPURenderer | null;
      probe: WebGpuProbeResult;
      isSoftwareGl?: boolean;
    } | null
  ) {
    this.stats = initialStats;
    this.settings = initialSettings;
    this.callbacks = callbacks;
    this.capytorioEngine = new CapytorioFactoryEngine(initialStats.capytorioFactory ?? null);
    this.capytorioEngine.beltEndSpillEnabled = Boolean(initialSettings.capytorioBeltEndSpill);
    this.capytorioStepCallbacks = {
      onTechCompleted: (_techId, techName, rewardDna, _rewardCoins, isRocketLaunch) => {
        const snap = this.capytorioEngine.getUiSnapshot();
        this.awardProgress(rewardDna, 'capytorio', snap.score);
        if (isRocketLaunch) {
          AudioService.playCapytorioRocketLaunch();
        } else {
          AudioService.playCapytorioTechComplete();
        }
        this.addCameraTrauma(isRocketLaunch ? 0.45 : 0.24);
        NativeBridge.haptic('success');
        this.callbacks.onBountyEvent?.('capytorio_pack', 1);
        this.callbacks.onModeNotification?.(
          isRocketLaunch
            ? `ORBITAL YUZU ROCKET LAUNCHED! +${rewardDna} DNA · +15% Factory Productivity!`
            : `Tech Researched: ${techName}! +${rewardDna} DNA!`
        );
        this.markCapytorioDirty();
      },
      onMilestoneItem: (itemId, count) => {
        const meta = getCapytorioItemMeta(itemId);
        if (meta.category === 'science') {
          this.callbacks.onBountyEvent?.('capytorio_pack', count);
        }
      },
      onMilestoneCompleted: (_id, label) => {
        AudioService.playCapytorioTechComplete();
        NativeBridge.haptic('success');
        this.callbacks.onModeNotification?.(`Factory Milestone: ${label}!`);
        this.markCapytorioDirty();
      },
      onCraftQueueCompleted: () => {
        AudioService.playCapytorioCraftQueue('complete');
      },
      onScoreChanged: (score) => {
        this.awardProgress(0, 'capytorio', score);
      },
    };
    ensureLiveCapytorioLuaSync();
    this.unsubscribeCapytorioLua = subscribeCapytorioLuaChanges(() => {
      this.emitCapytorioSnapshot();
    });
    this.performanceLog.lock60FpsEnabled = initialSettings.lock60FpsGovernor !== false;
    this.performanceLog.fpsTarget = initialSettings.fpsTarget ?? 60;
    this.performanceLog.maxFpsLimit = initialSettings.maxFpsLimit ?? 60;
    this.flightTrajectory = initialSettings.flightTrajectory === 'straight' ? 'straight' : 'spiral';

    const skipCosmic =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('skip_cosmic') === '1';

    this.isSoftwareGl = webGpuInit?.renderer
      ? webGpuInit.probe.isFallbackAdapter
      : typeof webGpuInit?.isSoftwareGl === 'boolean'
        ? webGpuInit.isSoftwareGl
        : (() => {
            try {
              const gl =
                document.createElement('canvas').getContext('webgl2') ||
                document.createElement('canvas').getContext('webgl');
              if (!gl) return true;
              const ext = gl.getExtension('WEBGL_debug_renderer_info');
              const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
              const gpu = String(gl.getParameter(param));
              gl.getExtension('WEBGL_lose_context')?.loseContext();
              return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
            } catch {
              return true;
            }
          })();

    // 1. Scene & Camera (Start directly in deep cosmic black when booting into Multiverse so surface sky never flashes)
    this.scene = new THREE.Scene();
    this.scene.matrixAutoUpdate = false;
    this.scene.background = new THREE.Color(skipCosmic ? 0x38bdf8 : 0x02040a);
    if (skipCosmic) {
      this.applyFogSetting();
    } else {
      this.scene.fog = null;
    }

    const width = Math.max(1, container.clientWidth || window.innerWidth || 360);
    const height = Math.max(1, container.clientHeight || window.innerHeight || 640);
    this.camera = new THREE.PerspectiveCamera(
      this.settings.fov || 58,
      width / height,
      0.1,
      1350
    );
    this.camera.position.set(0, 7.5, 14);

    // 2. Renderer (Hardware WebGPURenderer or WebGL2 with mobile/software fallback)
    if (webGpuInit?.renderer) {
      this.renderer = webGpuInit.renderer;
      this.isWebGpu = true;
    } else {
      this.isWebGpu = false;
      try {
        this.renderer = new THREE.WebGLRenderer({
          antialias: !this.isSoftwareGl,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        });
      } catch {
        this.isSoftwareGl = true;
        this.renderer = new THREE.WebGLRenderer({
          antialias: false,
          powerPreference: 'default',
          preserveDrawingBuffer: false,
        });
      }
    }
    this.renderer.setPixelRatio(
      computeEffectivePixelRatio(
        window.devicePixelRatio || 1,
        this.settings.gpuQualityPreset ?? 'high',
        this.settings.gpuPostProcessing !== false,
        this.isSoftwareGl,
        this.settings.gpuResolutionScale ?? 1.0
      )
    );
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    const gpuCfg = this.buildGpuConfigFromSettings(this.settings);
    const shadowsEnabledAtBoot = gpuCfg.shadowQuality !== 'off' && !this.isSoftwareGl;
    this.renderer.shadowMap.enabled = shadowsEnabledAtBoot;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.userSelect = 'none';
    this.renderer.domElement.style.webkitUserSelect = 'none';

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    if (this.renderer instanceof THREE.WebGLRenderer) {
      this.profiler.initGlContext(this.renderer.getContext());
    }
    this.profiler.setEnabled(true);

    // 3. Studio Environment, Warm/Cool 5:1 Lighting Rig & Hardware-Accelerated 3D GPU Engine
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.08);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xbfe3ff, 0x263d24, 0.48);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaf0, 2.65);
    dirLight.position.set(38, 72, 32);
    dirLight.castShadow = shadowsEnabledAtBoot;
    const shadowRes = this.isSoftwareGl ? 1024 : 2048;
    dirLight.shadow.mapSize.width = shadowRes;
    dirLight.shadow.mapSize.height = shadowRes;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 260;
    const d = 38;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.00032;
    dirLight.shadow.normalBias = 0.024;
    this.scene.add(dirLight);
    if (this.isWebGpu && webGpuInit?.probe) {
      this.webGpuPipeline = new WebGpuPostAndComputePipeline(
        this.renderer as THREE_WEBGPU.WebGPURenderer,
        this.scene,
        this.camera,
        webGpuInit.probe.adapterName,
        gpuCfg as GpuPipelineConfig
      );
    }

    this.gpuEngine = new HardwareGpuEngine(
      this.renderer,
      this.scene,
      this.camera,
      dirLight,
      this.isSoftwareGl,
      width,
      height,
      gpuCfg,
      webGpuInit?.probe || this.webGpuPipeline
        ? {
            webGpuPipeline: this.webGpuPipeline ?? undefined,
            webGpuProbe: webGpuInit?.probe ?? null,
          }
        : undefined
    );
    this.vfxEngine = new AaaWorldVfxEngine(
      this.scene,
      this.isSoftwareGl,
      this.renderer.getPixelRatio(),
      this.isWebGpu
    );

    const isLowMem = isLowMemoryEnvironment(
      this.isSoftwareGl,
      this.settings.gpuQualityPreset
    );
    PbrTextureSynthesizer.setLeanTextureMode(isLowMem);
    RealisticWorldEnvironment.setLeanTextureMode(isLowMem);
    CapyModelGenerator.setLeanTextureMode(isLowMem);

    // Hardware-accelerated PBR texture cache, GPU Sky Dome, 360° Alpine Mountains & Weather
    // (Defer synthesizing 8 planetary PBR texture sets until surface worlds build so Multiverse boots instantly!)
    this.worldEnv = new RealisticWorldEnvironment(
      this.renderer,
      this.isSoftwareGl,
      ambientLight,
      hemiLight,
      dirLight,
      this.isWebGpu,
      !skipCosmic
    );
    this.scene.add(this.worldEnv.moonLight);
    this.gpuEngine.setMoonLight(this.worldEnv.moonLight);

    // 4. Hero Capybara (Ultra-Detailed with Dynamic 60 FPS LOD & Signature Head Orange)
    this.currentCapyLodTier = this.settings.autoCapyLod
      ? 3
      : (this.settings.manualCapyLodTier ?? 3);
    this.activeHeadOrangeIndex =
      CapyModelGenerator.skinDefaultOrangeIndex[this.stats.activeSkin] ?? 0;
    const initVariety = HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex];

    this.heroCapy = CapyModelGenerator.createCapybara(
      this.stats.activeHat,
      1.0,
      this.stats.activeSkin,
      this.stats.activeMutations,
      this.currentCapyLodTier,
      initVariety.colorHex,
      false
    );
    this.heroTailAuraMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.heroTailAuraMesh = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 20),
      this.heroTailAuraMat
    );
    this.heroTailAuraMesh.rotation.x = -Math.PI / 2;
    this.heroTailAuraMesh.position.set(0, 0.06, -0.58);
    this.heroTailAuraMesh.visible = false;
    this.heroTailAuraMesh.userData.ignoreCameraFade = true;
    this.heroCapy.add(this.heroTailAuraMesh);
    this.heroCapy.visible = skipCosmic;
    this.heroCapy.matrixWorldAutoUpdate = skipCosmic;
    this.scene.add(this.heroCapy);

    // 5. Place All 5 Game Zone Groups in the Shared 3D World
    //    Keep all planetary surface groups hidden at Multiverse boot so Capytorio/Sanctuary never flicker!
    this.sanctuaryGroup.position.set(ZONE_LOCATIONS.sanctuary.x, 0, ZONE_LOCATIONS.sanctuary.z);
    this.sporeGroup.position.set(ZONE_LOCATIONS.spore.x, 0, ZONE_LOCATIONS.spore.z);
    // Capytorio3DRenderer manages world coordinates directly around (CAPYTORIO_WORLD_ORIGIN_X, 0, 0)
    this.capytorioGroup.position.set(0, 0, 0);
    this.runnerGroup.position.set(ZONE_LOCATIONS.runner.x, 0, ZONE_LOCATIONS.runner.z);
    this.fallGuysGroup.position.set(ZONE_LOCATIONS.fallguys.x, 0, ZONE_LOCATIONS.fallguys.z);

    this.worldBaseGroup.visible = skipCosmic;
    this.worldBaseGroup.matrixWorldAutoUpdate = skipCosmic;
    this.sanctuaryGroup.visible = skipCosmic;
    this.sanctuaryGroup.matrixWorldAutoUpdate = skipCosmic;
    this.sporeGroup.visible = skipCosmic;
    this.sporeGroup.matrixWorldAutoUpdate = skipCosmic;
    this.capytorioGroup.visible = skipCosmic;
    this.capytorioGroup.matrixWorldAutoUpdate = skipCosmic;
    this.runnerGroup.visible = skipCosmic;
    this.runnerGroup.matrixWorldAutoUpdate = skipCosmic;
    this.fallGuysGroup.visible = skipCosmic;
    this.fallGuysGroup.matrixWorldAutoUpdate = skipCosmic;
    this.vfxEngine.rootGroup.visible = skipCosmic;
    this.vfxEngine.rootGroup.matrixWorldAutoUpdate = skipCosmic;
    this.selectableCapyGroup.visible = false;
    this.selectableCapyGroup.matrixWorldAutoUpdate = false;

    this.scene.add(this.worldBaseGroup);
    this.scene.add(this.sanctuaryGroup);
    this.scene.add(this.sporeGroup);
    this.scene.add(this.capytorioGroup);
    this.scene.add(this.runnerGroup);
    this.scene.add(this.fallGuysGroup);

    this.physicsBridge = new PhysicsWorldBridge(!skipCosmic);

    // 6. Build Chrono-Vessel Rig & Multi-Scale Universe Simulator
    //    (CosmicUniverseBuilder stays lazy & suspended so Multiverse boots in a fraction of the time)
    this.cosmicBuilder = new CosmicUniverseBuilder(this.isSoftwareGl, isLowMem, !skipCosmic);
    this.cosmicBuilder.setSuspended(true);
    this.scene.add(this.cosmicBuilder.rootGroup);
    this.seamlessUniverse = new SeamlessUniverseSimulator(this.isSoftwareGl, this.isWebGpu);
    this.scene.add(this.seamlessUniverse.rootGroup);
    this.scene.add(this.seamlessUniverse.celestialBackdropGroup);
    this.sanctuaryGroup.add(this.seamlessUniverse.forestGroveGroup);
    this.chronoVessel = new ChronoVesselRig();
    this.chronoVessel.root.visible = !skipCosmic;
    this.chronoVessel.root.matrixWorldAutoUpdate = !skipCosmic;
    this.scene.add(this.chronoVessel.root);

    // Build 6 Orbital Skydiving Descent Rings for the atmosphere-to-Sanctuary glide path
    const descentRingGeo = new THREE.TorusGeometry(1.75, 0.11, 14, 36);
    this.descentRingsGroup.visible = false;
    this.descentRingsGroup.matrixWorldAutoUpdate = false;
    for (let ri = 0; ri < DESCENT_RING_SPECS.length; ri++) {
      const rSpec = DESCENT_RING_SPECS[ri];
      const rMat = new THREE.MeshBasicMaterial({
        color: rSpec.colorHex,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rMesh = new THREE.Mesh(descentRingGeo, rMat);
      rMesh.visible = false;
      this.descentRingsGroup.add(rMesh);
      this.descentRingMeshes.push(rMesh);
    }
    this.scene.add(this.descentRingsGroup);

    // Install O(1) matrix-tree skip on hidden/disabled top-level subtrees so Three.js never
    // walks ~13,000 hidden descendants every frame.
    installFastMatrixCull(this.worldBaseGroup);
    installFastMatrixCull(this.sanctuaryGroup);
    installFastMatrixCull(this.sporeGroup);
    installFastMatrixCull(this.capytorioGroup);
    installFastMatrixCull(this.runnerGroup);
    installFastMatrixCull(this.fallGuysGroup);
    installFastMatrixCull(this.cosmicBuilder.rootGroup);
    installFastMatrixCull(this.vfxEngine.rootGroup);
    installFastMatrixCull(this.selectableCapyGroup);
    installFastMatrixCull(this.heroCapy);
    installFastMatrixCull(this.dachshundGroup);
    installFastMatrixCull(this.chronoVessel.root);
    installFastMatrixCull(this.descentRingsGroup);

    if (skipCosmic) {
      this.ensureSurfaceWorldsBuilt();
      if (this.isWebGpu) {
        convertLegacyShaderMaterialsToTsl(this.scene);
      } else {
        const glRenderer = this.renderer as THREE.WebGLRenderer;
        if (!this.isSoftwareGl) {
          glRenderer.compile(this.chronoVessel.root, this.camera, this.scene);
          glRenderer.compile(this.heroCapy, this.camera, this.scene);
          glRenderer.compile(this.seamlessUniverse.celestialBackdropGroup, this.camera, this.scene);
        }
        this.scheduleIdlePipelineWarmup();
      }
      this.switchMode(this.stats.selectedPlayStyle, true);
      this.vesselMode = 'landed';
      this.chronoVessel.setMode('landed');
      this.chronoVessel.root.visible = false;
      this.setCosmicStage('playing');
    } else {
      // Unified Future Capybara Chrono-Vessel Continuum:
      // Boot DIRECTLY into the Multiverse (10^+30 m) on Frame 1 with zero Capytorio/surface flicker!
      this.currentMode = this.stats.selectedPlayStyle;
      this.cosmicStage = 'playing';
      this.seamlessZoomActive = true;
      this.vesselMode = 'chase_pod';
      this.chronoVessel.setMode('chase_pod');
      this.cruiseVelocityLogPerSec = 0;
      this.autoZoomDirection = 0;
      this.currentLogScaleMeters = MAX_UNIVERSE_LOG_METERS;
      this.targetLogScaleMeters = MAX_UNIVERSE_LOG_METERS;
      this.scene.fog = null;
      this.setSceneBackgroundHex(0x02040a);
      this.setSkyDomeAlpha(0.0);
      this.tickSeamlessUniverse(0.016);
      if (this.isWebGpu) {
        convertLegacyShaderMaterialsToTsl(this.chronoVessel.root);
      } else if (!this.isSoftwareGl) {
        const glRenderer = this.renderer as THREE.WebGLRenderer;
        glRenderer.compile(this.chronoVessel.root, this.camera, this.scene);
        glRenderer.compile(this.seamlessUniverse.celestialBackdropGroup, this.camera, this.scene);
      }
      this.emitCosmicState();
      this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
      this.scheduleDeferredBootWork();
    }
  }

  private buildNextSurfaceStep(): boolean {
    if (this.surfaceWorldsBuilt) return false;
    switch (this.surfaceBuildStep) {
      case 0:
        this.worldEnv.ensureCoreTexturesReady();
        this.buildSharedArchipelagoBase();
        if (this.isWebGpu) convertLegacyShaderMaterialsToTsl(this.worldBaseGroup);
        break;
      case 1:
        this.buildSanctuary();
        if (this.isWebGpu) convertLegacyShaderMaterialsToTsl(this.sanctuaryGroup);
        break;
      case 2:
        this.buildSporeWorld();
        if (this.isWebGpu) convertLegacyShaderMaterialsToTsl(this.sporeGroup);
        break;
      case 3:
        this.buildCapytorioWorld();
        if (this.isWebGpu) convertLegacyShaderMaterialsToTsl(this.capytorioGroup);
        break;
      case 4:
        this.buildRunner();
        if (this.isWebGpu) convertLegacyShaderMaterialsToTsl(this.runnerGroup);
        break;
      case 5:
        this.buildFallGuys();
        if (this.isWebGpu) convertLegacyShaderMaterialsToTsl(this.fallGuysGroup);
        break;
      case 6:
        this.physicsBridge.ensureWorkerInitialized();
        this.syncWorldPhysicsColliders();
        break;
      case 7:
        this.buildSelectableCapyHeroCircle();
        if (this.isWebGpu) convertLegacyShaderMaterialsToTsl(this.selectableCapyGroup);
        break;
      case 8:
        this.prewarmOccluderShaderPrograms();
        this.surfaceWorldsBuilt = true;
        if (this.pendingProceduralConfigSync) {
          this.pendingProceduralConfigSync = false;
          this.applyProceduralConfig(this.proceduralConfig, true);
        }
        break;
      default:
        this.surfaceWorldsBuilt = true;
        return false;
    }
    this.surfaceBuildStep += 1;
    // Keep surface groups hidden while still high in cosmic space
    if (this.seamlessZoomActive && this.currentLogScaleMeters > 4.5) {
      this.worldBaseGroup.visible = false;
      this.worldBaseGroup.matrixWorldAutoUpdate = false;
      this.sanctuaryGroup.visible = false;
      this.sanctuaryGroup.matrixWorldAutoUpdate = false;
      this.sporeGroup.visible = false;
      this.sporeGroup.matrixWorldAutoUpdate = false;
      this.capytorioGroup.visible = false;
      this.capytorioGroup.matrixWorldAutoUpdate = false;
      this.runnerGroup.visible = false;
      this.runnerGroup.matrixWorldAutoUpdate = false;
      this.fallGuysGroup.visible = false;
      this.fallGuysGroup.matrixWorldAutoUpdate = false;
      this.selectableCapyGroup.visible = false;
      this.selectableCapyGroup.matrixWorldAutoUpdate = false;
    }
    return !this.surfaceWorldsBuilt;
  }

  public ensureSurfaceWorldsBuilt(): void {
    if (!this.surfaceWorldsBuilt) {
      while (this.buildNextSurfaceStep()) {
        // Complete all remaining surface districts synchronously on demand
      }
    }
    if (!this.isSoftwareGl) {
      this.seamlessUniverse?.ensureWoodlandGroveBuilt();
    }
  }

  private scheduleDeferredBootWork(): void {
    if (typeof window === 'undefined' || this.disposed) return;
    let cancelled = false;
    let timerId: number | null = null;
    let idleId: number | null = null;
    const win = window as Window & {
      requestIdleCallback?: (
        cb: (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const runChunk = () => {
      if (cancelled || this.disposed) return;
      // Phase 1: progressively warm remaining universe scale layers (2 per slice)
      let moreLayers = false;
      for (let k = 0; k < 2; k++) {
        moreLayers = this.seamlessUniverse.warmNextPendingLayer();
        if (!moreLayers) break;
      }
      if (moreLayers) {
        scheduleNext(this.isSoftwareGl ? 90 : 35);
        return;
      }
      // Do NOT build playable Capybara Forest / Capytorio districts until the user selects "Play in Forest" or "Play Capytorio".
      if (!this.isWebGpu) {
        this.scheduleIdlePipelineWarmup();
      }
    };

    const scheduleNext = (delayMs: number) => {
      if (cancelled || this.disposed) return;
      timerId = window.setTimeout(() => {
        timerId = null;
        if (cancelled || this.disposed) return;
        if (typeof win.requestIdleCallback === 'function') {
          idleId = win.requestIdleCallback(
            () => {
              idleId = null;
              runChunk();
            },
            { timeout: 600 }
          );
        } else {
          runChunk();
        }
      }, delayMs);
    };

    // Let the first Multiverse frames paint smoothly before starting background warmup
    scheduleNext(260);

    this.deferredBootCancel = () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
        idleId = null;
      }
    };
  }

  private scheduleIdlePipelineWarmup(): void {
    if (typeof window === 'undefined' || this.isSoftwareGl || this.disposed) {
      this.gpuEngine?.markIdleWarmupComplete(true);
      return;
    }

    const webGpuCompileFn = this.isWebGpu
      ? (this.renderer as unknown as {
          compileAsync?: (obj: THREE.Object3D, cam: THREE.Camera, scene: THREE.Scene) => Promise<void>;
        }).compileAsync
      : undefined;
    const glRenderer = this.isWebGpu ? null : (this.renderer as THREE.WebGLRenderer);
    const compileTargetAsync = (obj: THREE.Object3D): Promise<void> => {
      if (this.isWebGpu) {
        if (typeof webGpuCompileFn === 'function') {
          return webGpuCompileFn.call(this.renderer, obj, this.camera, this.scene).then(() => undefined);
        }
        return Promise.resolve();
      }
      if (glRenderer && typeof glRenderer.compileAsync === 'function') {
        return glRenderer.compileAsync(obj, this.camera, this.scene).then(() => undefined);
      }
      return Promise.resolve();
    };

    if (!this.isWebGpu && (!glRenderer || typeof glRenderer.compileAsync !== 'function')) {
      this.gpuEngine?.markIdleWarmupComplete(true);
      return;
    }

    // Collect one representative renderable per distinct Material so each idle tick compiles
    // only 1 unique shader program (~2-15ms) instead of stalling 15s compiling an entire subtree at once.
    const seenMatIds = new Set<string>();
    const queue: THREE.Object3D[] = [];
    const enqueueUniqueFrom = (root: THREE.Object3D | null | undefined) => {
      if (!root) return;
      root.traverse((obj) => {
        const rend = obj as THREE.Mesh;
        if (!rend.isMesh && !(obj as THREE.Points).isPoints && !(obj as THREE.Line).isLine && !(obj as THREE.Sprite).isSprite) {
          return;
        }
        const mat = rend.material;
        if (!mat) return;
        const mats = Array.isArray(mat) ? mat : [mat];
        let hasNewMat = false;
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i];
          if (m && !seenMatIds.has(m.uuid)) {
            seenMatIds.add(m.uuid);
            hasNewMat = true;
          }
        }
        if (hasNewMat) {
          queue.push(obj);
        }
      });
    };

    enqueueUniqueFrom(this.heroCapy);
    enqueueUniqueFrom(this.sanctuaryGroup);
    enqueueUniqueFrom(this.worldBaseGroup);
    enqueueUniqueFrom(this.vfxEngine.rootGroup);
    enqueueUniqueFrom(this.worldEnv?.weatherMesh);
    enqueueUniqueFrom(this.worldEnv?.cloudGroup);
    enqueueUniqueFrom(this.chronoPad?.group);
    enqueueUniqueFrom(this.sporeWaterMesh);
    for (let i = 0; i < this.seamlessUniverse.rootGroup.children.length; i++) {
      enqueueUniqueFrom(this.seamlessUniverse.rootGroup.children[i]);
    }

    if (queue.length === 0) {
      this.gpuEngine?.markIdleWarmupComplete(true);
      return;
    }

    let index = 0;
    let timerId: number | null = null;
    let idleId: number | null = null;
    let cancelled = false;
    const stepDelayMs = this.isSoftwareGl ? 120 : 25;

    const win = window as Window & {
      requestIdleCallback?: (
        cb: (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const finishWarmup = () => {
      if (!cancelled && !this.disposed) {
        this.gpuEngine?.markIdleWarmupComplete(true);
      }
    };

    const scheduleNext = () => {
      if (cancelled || this.disposed) {
        return;
      }
      if (index >= queue.length) {
        finishWarmup();
        return;
      }
      if (typeof win.requestIdleCallback === 'function') {
        idleId = win.requestIdleCallback(
          (deadline) => {
            idleId = null;
            if (cancelled || this.disposed) return;
            if (deadline.timeRemaining() > 4 || deadline.didTimeout) {
              const target = queue[index++];
              if (target) {
                void compileTargetAsync(target)
                  .catch(() => undefined)
                  .finally(() => {
                    if (cancelled || this.disposed) return;
                    if (index < queue.length) {
                      timerId = window.setTimeout(scheduleNext, stepDelayMs);
                    } else {
                      finishWarmup();
                    }
                  });
                return;
              }
            }
            scheduleNext();
          },
          { timeout: 650 }
        );
      } else {
        timerId = window.setTimeout(() => {
          timerId = null;
          if (cancelled || this.disposed) return;
          const target = queue[index++];
          if (target) {
            void compileTargetAsync(target)
              .catch(() => undefined)
              .finally(() => {
                if (cancelled || this.disposed) return;
                if (index < queue.length) {
                  scheduleNext();
                } else {
                  finishWarmup();
                }
              });
          } else {
            finishWarmup();
          }
        }, stepDelayMs);
      }
    };

    timerId = window.setTimeout(scheduleNext, 450);
    this.idleWarmupCancel = () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
        idleId = null;
      }
    };
  }

  private setSceneBackgroundHex(hex: number): void {
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(hex);
    } else {
      this.scene.background = new THREE.Color(hex);
    }
  }

  private getBuildingLevelSum(type: BuildingType): number {
    let total = 0;
    for (let i = 0; i < this.stats.buildings.length; i++) {
      if (this.stats.buildings[i].type === type) {
        total += Math.max(1, this.stats.buildings[i].level || 1);
      }
    }
    return total;
  }

  private getDesiredBuddyCount(): number {
    const baseBuddies = Math.max(
      1,
      Math.min(
        MAX_SANCTUARY_BUDDIES,
        Math.round(this.proceduralConfig.districts.sanctuary.buddyCount)
      )
    );
    const groveLevels = this.getBuildingLevelSum('bamboo_grove');
    return Math.min(MAX_SANCTUARY_BUDDIES, baseBuddies + groveLevels * 2);
  }

  private awardProgress(baseDna: number, mode: PlayStyle, score: number): void {
    const pagodaLevels = this.getBuildingLevelSum('zen_pagoda');
    const pagodaMult = 1 + pagodaLevels * 0.1;
    const cfgMult = this.proceduralConfig.economy.dnaRewardMultiplier;
    const comboMult =
      this.comboState.active && this.comboState.multiplier > 1
        ? 1 + (this.comboState.multiplier - 1) * 0.5
        : 1;
    const scaledDna =
      baseDna > 0 ? Math.max(1, Math.round(baseDna * pagodaMult * cfgMult * comboMult)) : 0;
    this.callbacks.onProgressEarned(scaledDna, mode, score);
  }

  private registerArcadeCombo(actionLabel: string, bonusBaseDna: number = 0): void {
    const res = registerComboHit(this.comboState, actionLabel);
    AudioService.playComboChime(res.count);
    if (res.feverJustTriggered) {
      AudioService.playPrestigeFanfare();
      this.addCameraTrauma(0.18);
      if (this.heroCapy.visible && this.vfxEngine) {
        this.vfxEngine.emitBurst(
          this.heroCapy.position.x,
          this.heroCapy.position.y + 0.9,
          this.heroCapy.position.z,
          'xpbd_launch',
          10,
          0xfacc15
        );
      }
      this.callbacks.onModeNotification?.(
        `YUZU FEVER ${res.multiplier}x! Bonus DNA & shimmer active!`
      );
    }
    if (bonusBaseDna > 0) {
      this.awardProgress(bonusBaseDna, this.currentMode, 0);
    }
    this.emitTelemetry();
  }

  private setSkyDomeAlpha(alpha: number): void {
    if (!this.worldEnv) return;
    const clamped = THREE.MathUtils.clamp(alpha, 0, 1);
    const shaderMat = this.worldEnv.skyMaterial as THREE.ShaderMaterial;
    if (shaderMat?.uniforms?.uSkyAlpha) {
      shaderMat.uniforms.uSkyAlpha.value = clamped;
    }
    this.worldEnv.skyMesh.visible = clamped > 0.04;
  }

  private resetDescentRings(): void {
    for (let i = 0; i < this.descentRingHitFlags.length; i++) {
      this.descentRingHitFlags[i] = false;
    }
    this.descentRingsHitCount = 0;
  }

  private syncDockedVesselPose(dt: number, isDockedInSanctuary: boolean): void {
    if (!this.chronoVessel) return;
    if (!isDockedInSanctuary) {
      if (!this.seamlessZoomActive) {
        this.chronoVessel.root.visible = false;
        this.chronoVessel.root.matrixWorldAutoUpdate = false;
      }
      this.dockedChronoVesselVisible = false;
      return;
    }
    this.dockedChronoVesselVisible = true;
    this.chronoVessel.setMode('chase_pod');
    this.chronoVessel.root.visible = true;
    this.chronoVessel.root.matrixWorldAutoUpdate = true;
    const hoverBob = Math.sin(performance.now() * 0.0022) * 0.09;
    this.chronoVessel.root.position.set(
      CHRONO_PAD_X + 1.25,
      1.05 + hoverBob,
      CHRONO_PAD_Z - 1.15
    );
    this.chronoVessel.root.scale.setScalar(1.95);
    _vesselEuler.set(0, Math.PI * 0.25, 0);
    this.chronoVessel.root.quaternion.setFromEuler(_vesselEuler);
    this.chronoVessel.update(dt, 0, 0, 0);
  }

  public triggerDash(): boolean {
    if (this.seamlessZoomActive || this.cosmicStage !== 'playing') return false;
    if (this.heroDashCooldown > 0) return false;

    const hasGlowTail = this.stats.activeMutations.includes('glow_tail');
    this.heroDashCooldown = hasGlowTail ? 0.9 : 1.35;
    this.heroDashActiveTimer = 0.22;

    if (this.settings.cameraFollowBehind !== false) {
      const sign = this.isWalkingBackward ? -1 : 1;
      this.heroDashDirX = Math.sin(this.heroYaw) * sign;
      this.heroDashDirZ = Math.cos(this.heroYaw) * sign;
    } else if (Math.abs(this.moveInput.x) > 0.05 || Math.abs(this.moveInput.z) > 0.05) {
      const len = Math.hypot(this.moveInput.x, this.moveInput.z) || 1;
      this.heroDashDirX = this.moveInput.x / len;
      this.heroDashDirZ = this.moveInput.z / len;
    } else {
      this.heroDashDirX = Math.sin(this.heroYaw);
      this.heroDashDirZ = Math.cos(this.heroYaw);
    }

    this.heroVelocity.x += this.heroDashDirX * 14.5;
    this.heroVelocity.z += this.heroDashDirZ * 14.5;
    this.heroSoftSquashVel -= 1.6;
    AudioService.playDashWhoosh();
    NativeBridge.haptic('tick');

    if (this.vfxEngine) {
      this.vfxEngine.emitBurst(
        this.heroCapy.position.x,
        Math.max(0.3, this.heroCapy.position.y + 0.35),
        this.heroCapy.position.z,
        'citrus_burst',
        8,
        0x38bdf8
      );
    }
    this.emitTelemetry();
    return true;
  }

  public triggerGroundPound(): boolean {
    if (this.seamlessZoomActive || this.cosmicStage !== 'playing') return false;
    if (this.isGroundPounding) return false;
    const isAirborne = !this.isGrounded && !this.isSwimmingInPool && this.heroLocalPos.y > 0.25;
    if (!isAirborne) return false;

    this.isGroundPounding = true;
    this.heroVelocity.y = -24.5;
    this.heroSoftSquashVel += 1.4;
    AudioService.playDashWhoosh();
    NativeBridge.haptic('tick');
    this.emitTelemetry();
    return true;
  }

  private handleGroundPoundImpact(wx: number, wy: number, wz: number, inWater: boolean): void {
    this.isGroundPounding = false;
    this.heroSoftSquashVel -= 2.8;
    this.addCameraTrauma(0.34);
    AudioService.playSplash();
    NativeBridge.haptic('success');

    if (this.vfxEngine) {
      this.vfxEngine.emitBurst(
        wx,
        Math.max(0.15, wy + 0.2),
        wz,
        'xpbd_launch',
        14,
        inWater ? 0x38bdf8 : 0xfacc15
      );
    }

    if (inWater && this.physicsBridge?.fluidSolver) {
      this.physicsBridge.fluidSolver.writeGpuWakeParams(
        wx,
        wz,
        24.0,
        this.gpuWakeParamsScratch
      );
      this.gpuEngine?.setGpuWakeParams(
        this.gpuWakeParamsScratch[0],
        this.gpuWakeParamsScratch[1],
        Math.max(0.14, this.gpuWakeParamsScratch[2]),
        1.0
      );
      if (this.homePool) {
        this.worldEnv.triggerPondSplashBurst(this.homePool, 10);
      }
    }

    // Scatter nearby rolling fruits & knock down 1 nearby tree fruit playfully
    if (this.currentMode === 'sanctuary') {
      for (let i = 0; i < this.physicsFruits.length; i++) {
        const f = this.physicsFruits[i];
        if (!f.active || f.inPond) continue;
        const dx = f.x - this.heroLocalPos.x;
        const dz = f.z - this.heroLocalPos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05 && d < 6.5) {
          const push = (1 - d / 6.5) * 6.5;
          f.vx += (dx / d) * push;
          f.vz += (dz / d) * push;
          f.vy += 2.2;
        }
      }
      for (let t = 0; t < this.sanctuaryTrees.length; t++) {
        const tr = this.sanctuaryTrees[t];
        if (Math.hypot(tr.x - this.heroLocalPos.x, tr.z - this.heroLocalPos.z) < 7.2) {
          this.bumpTreeAndSpawnFruits(tr, 0.5, 0.5);
          break;
        }
      }
    }

    this.registerArcadeCombo(inWater ? 'Splash Belly-Flop!' : 'Ground Pound!', 1);
    this.callbacks.onBountyEvent?.('ground_pound_splash', 1);
    this.callbacks.onModeNotification?.(
      inWater ? 'Belly-Flop Splash Wave! +1 DNA!' : 'Shockwave Belly-Flop! +1 DNA!'
    );
  }

  private applyFogSetting() {
    this.scene.fog = null;
  }

  private buildGpuConfigFromSettings(s: CapyGameSettings): GpuPipelineConfig {
    return {
      qualityPreset: s.gpuQualityPreset ?? 'high',
      postProcessingEnabled: s.gpuPostProcessing !== false,
      visualFilterPreset: s.gpuVisualFilter ?? 'natural_pbr',
      toneMapping: s.gpuToneMapping ?? 'agx',
      exposure: s.gpuExposure ?? 1.02,
      textureFilter: s.gpuTextureFilter ?? 'trilinear_aniso',
      anisotropyLevel: s.gpuAnisotropy ?? 8,
      shadowQuality: s.gpuShadowQuality ?? 'pcf_soft',
      antiAliasing: s.gpuAntiAliasing ?? 'msaa_fxaa',
      resolutionScale: s.gpuResolutionScale ?? 1.0,
      bloomEnabled: s.gpuBloomEnabled !== false,
      bloomStrength: s.gpuBloomStrength ?? 0.24,
      ssaoEnabled: s.gpuSsaoEnabled !== false,
      sharpenAmount: s.gpuSharpenAmount ?? 0.26,
      drawDistance: s.drawDistance ?? 650,
    };
  }

  private buildEffectiveGpuConfig(s: CapyGameSettings, mitigationLevel: number): GpuPipelineConfig {
    const out = this.effectiveGpuConfigScratch;
    out.qualityPreset = s.gpuQualityPreset ?? 'high';
    out.postProcessingEnabled = s.gpuPostProcessing !== false;
    out.visualFilterPreset = s.gpuVisualFilter ?? 'natural_pbr';
    out.toneMapping = s.gpuToneMapping ?? 'agx';
    out.exposure = s.gpuExposure ?? 1.02;
    out.textureFilter = s.gpuTextureFilter ?? 'trilinear_aniso';
    out.anisotropyLevel = s.gpuAnisotropy ?? 8;
    out.shadowQuality = s.gpuShadowQuality ?? 'pcf_soft';
    out.antiAliasing = s.gpuAntiAliasing ?? 'msaa_fxaa';
    out.resolutionScale = s.gpuResolutionScale ?? 1.0;
    out.bloomEnabled = s.gpuBloomEnabled !== false;
    out.bloomStrength = s.gpuBloomStrength ?? 0.24;
    out.ssaoEnabled = s.gpuSsaoEnabled !== false;
    out.sharpenAmount = s.gpuSharpenAmount ?? 0.26;
    out.drawDistance = s.drawDistance ?? 650;

    if (mitigationLevel > 0 && s.lock60FpsGovernor !== false) {
      const m = computeAdaptiveGpuMitigation(
        out,
        s.autoCapyLod !== false,
        s.manualCapyLodTier ?? 3,
        mitigationLevel,
        this.adaptiveMitigationResult
      );
      out.postProcessingEnabled = m.postProcessingEnabled;
      out.ssaoEnabled = m.ssaoEnabled;
      out.bloomEnabled = m.bloomEnabled;
      out.shadowQuality = m.shadowQuality;
      out.antiAliasing = m.antiAliasing;
      out.resolutionScale = m.resolutionScale;
    } else {
      this.adaptiveMitigationResult.level = 0;
      this.adaptiveMitigationResult.maxCapyLodTier = s.autoCapyLod !== false ? 3 : (s.manualCapyLodTier ?? 3);
      this.adaptiveMitigationResult.disabledFeatures = [];
    }
    return out;
  }

  public static getPresetPatchForGpuQuality(preset: GpuQualityPreset): Partial<CapyGameSettings> {
    if (preset === 'performance') {
      return {
        gpuQualityPreset: 'performance',
        gpuPostProcessing: false,
        gpuShadowQuality: 'off',
        gpuTextureFilter: 'bilinear',
        gpuAnisotropy: 1,
        gpuAntiAliasing: 'none',
        gpuResolutionScale: 0.7,
        gpuBloomEnabled: false,
        gpuSsaoEnabled: false,
        gpuSharpenAmount: 0,
        drawDistance: 135,
        autoCapyLod: false,
        manualCapyLodTier: 0,
      };
    }
    if (preset === 'balanced') {
      return {
        gpuQualityPreset: 'balanced',
        gpuPostProcessing: true,
        gpuShadowQuality: 'pcf',
        gpuTextureFilter: 'trilinear_aniso',
        gpuAnisotropy: 4,
        gpuAntiAliasing: 'fxaa',
        gpuResolutionScale: 1.0,
        gpuBloomEnabled: true,
        gpuBloomStrength: 0.22,
        gpuSsaoEnabled: false,
        gpuSharpenAmount: 0.18,
        drawDistance: 280,
        autoCapyLod: true,
      };
    }
    if (preset === 'ultra') {
      return {
        gpuQualityPreset: 'ultra',
        gpuPostProcessing: true,
        gpuShadowQuality: 'pcf_soft',
        gpuTextureFilter: 'trilinear_aniso',
        gpuAnisotropy: 16,
        gpuAntiAliasing: 'msaa_fxaa',
        gpuResolutionScale: 1.0,
        gpuBloomEnabled: true,
        gpuBloomStrength: 0.34,
        gpuSsaoEnabled: true,
        gpuSharpenAmount: 0.32,
        drawDistance: 1350,
        autoCapyLod: true,
      };
    }
    return {
      gpuQualityPreset: 'high',
      gpuPostProcessing: true,
      gpuShadowQuality: 'pcf_soft',
      gpuTextureFilter: 'trilinear_aniso',
      gpuAnisotropy: 8,
      gpuAntiAliasing: 'msaa_fxaa',
      gpuResolutionScale: 1.0,
      gpuBloomEnabled: true,
      gpuBloomStrength: 0.24,
      gpuSsaoEnabled: true,
      gpuSharpenAmount: 0.26,
      drawDistance: 650,
      autoCapyLod: true,
    };
  }

  public updateSettings(newSettings: CapyGameSettings) {
    const prevManualTime = this.settings.timeOfDayHours ?? 9.5;
    const prevCamDist = this.settings.cameraDistance ?? 1.0;
    const prevCapytorioCam = this.getCapytorioCameraMode();
    const manualTimeChanged =
      typeof newSettings.timeOfDayHours === 'number' &&
      Math.abs(newSettings.timeOfDayHours - prevManualTime) > 0.01;
    this.settings = newSettings;
    if (Math.abs((newSettings.cameraDistance ?? 1.0) - prevCamDist) > 0.005) {
      this.capytorioObliqueZoomDist = THREE.MathUtils.clamp(
        newSettings.cameraDistance ?? 1.0,
        CAPYTORIO_ZOOM_MIN_DIST,
        CAPYTORIO_ORBIT_HANDOFF_DIST
      );
    }
    const nextCapytorioCam = this.getCapytorioCameraMode();
    if (nextCapytorioCam !== prevCapytorioCam && this.currentMode === 'capytorio') {
      this.setCapytorioCameraMode(nextCapytorioCam);
    }
    const nextBeltSpill = Boolean(newSettings.capytorioBeltEndSpill);
    if (this.capytorioEngine && this.capytorioEngine.beltEndSpillEnabled !== nextBeltSpill) {
      this.capytorioEngine.beltEndSpillEnabled = nextBeltSpill;
      this.emitCapytorioSnapshot();
    }
    this.performanceLog.lock60FpsEnabled = newSettings.lock60FpsGovernor !== false;
    this.performanceLog.fpsTarget = newSettings.fpsTarget ?? 60;
    this.performanceLog.maxFpsLimit = newSettings.maxFpsLimit ?? 60;
    this.flightTrajectory = newSettings.flightTrajectory === 'straight' ? 'straight' : 'spiral';

    // Reset adaptive degradation whenever user explicitly changes graphics/FPS settings
    this.adaptiveMitigationLevel = 0;
    this.adaptiveLowPerfStreak = 0;
    this.adaptiveRecoveryAccumSec = 0;
    this.pendingAdaptiveGpuConfig = null;
    this.performanceLog.activeGovernorTier = 0;
    this.performanceLog.disabledFeatures = [];
    this.performanceLog.notifyTransitionWarmup(2);

    this.camera.fov = newSettings.fov || 58;
    this.camera.updateProjectionMatrix();
    this.applyFogSetting();
    this.gpuEngine?.applyConfig(this.buildEffectiveGpuConfig(newSettings, 0));
    this.gpuEngine?.render();
    if (!newSettings.autoCapyLod && newSettings.manualCapyLodTier !== undefined) {
      this.applyGlobalCapyLodTier(newSettings.manualCapyLodTier);
    } else if (newSettings.autoCapyLod !== false && this.currentCapyLodTier < 3) {
      this.applyGlobalCapyLodTier(3);
    }
    if (
      this.worldEnv &&
      (this.cosmicStage === 'playing' ||
        this.cosmicStage === 'capy_selection' ||
        this.seamlessZoomActive)
    ) {
      if (manualTimeChanged && typeof newSettings.timeOfDayHours === 'number') {
        const prevCaster = this.worldEnv.activeShadowCaster;
        this.worldEnv.timeOfDayHours = ((newSettings.timeOfDayHours % 24) + 24) % 24;
        const nextPhaseIsNight =
          this.worldEnv.timeOfDayHours < 6.0 || this.worldEnv.timeOfDayHours >= 18.2;
        if ((prevCaster === 'sun') === nextPhaseIsNight) {
          this.performanceLog.notifyTransitionWarmup(4);
        }
      }
      const isPerfMode = newSettings.gpuQualityPreset === 'performance';
      const exposureScale = (this.settings.gpuExposure ?? 1.12) / 1.12;
      this.worldEnv.tickAtmosphereAndWeather(
        0.016,
        this.settings.dayNightAutoCycle !== false,
        this.settings.timeOfDayHours ?? 9.5,
        this.settings.weatherMode ?? 'auto',
        this.heroCapy.position.x,
        this.heroCapy.position.z,
        this.scene,
        this.renderer,
        false,
        this.homePool?.lanternLight,
        exposureScale,
        this.proceduralConfig.world.dayCycleSpeed ?? 1.0,
        this.proceduralConfig.graphics.fogDensity ?? 1.0,
        isPerfMode,
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z
      );
      this.updateBioluminescentNightGlow();
      if (manualTimeChanged && this.gpuEngine) {
        this.gpuEngine.updateLightingAndShadowCascade(
          0.016,
          this.heroCapy.position.x,
          this.heroCapy.position.y,
          this.heroCapy.position.z,
          0,
          !this.seamlessZoomActive || this.currentLogScaleMeters <= 3.1,
          this.worldEnv.currentNightFactor,
          this.worldEnv.currentSunDir,
          this.worldEnv.currentMoonDir,
          this.worldEnv.activeShadowCaster,
          this.worldEnv.getDayPhaseLabel(),
          this.worldEnv.timeOfDayHours,
          this.worldEnv.currentIblEnvIntensity
        );
      }
    }
    this.applySurfaceDrawDistanceAndCulling(
      this.cosmicStage === 'playing' ||
        this.cosmicStage === 'capy_selection' ||
        (this.seamlessZoomActive && this.currentLogScaleMeters <= 3.1)
    );
    if (manualTimeChanged) {
      this.invalidateZoomThumbnails('capybara_forest');
    }
    this.emitTelemetry();
  }

  private applySurfaceDrawDistanceAndCulling(isSurfaceVisible: boolean): void {
    const isPerfMode = this.settings.gpuQualityPreset === 'performance';
    const drawDist = this.settings.drawDistance ?? 650;
    const farInfo = computeEffectiveCameraFar(
      drawDist,
      this.settings.gpuQualityPreset ?? 'high',
      isSurfaceVisible,
      this.currentLogScaleMeters
    );

    const isCapytorioObliqueHighAlt =
      isSurfaceVisible &&
      this.cosmicStage === 'playing' &&
      !this.seamlessZoomActive &&
      this.currentMode === 'capytorio' &&
      this.getCapytorioCameraMode() === 'oblique' &&
      this.capytorioObliqueZoomDist * CAPYTORIO_OBLIQUE_BASE_RADIUS_M > 65;

    if (isCapytorioObliqueHighAlt) {
      const pose = evaluateCapytorioAltitudePose(this.capytorioObliqueZoomDist);
      const desiredNear = Math.max(0.08, pose.altitudeRadius * 0.012);
      const desiredFar = Math.max(farInfo.cameraFar, pose.altitudeRadius * 36.0);
      if (
        Math.abs(this.camera.near - desiredNear) > desiredNear * 0.08 ||
        Math.abs(this.camera.far - desiredFar) > Math.max(1.0, desiredFar * 0.05)
      ) {
        this.camera.near = desiredNear;
        this.camera.far = desiredFar;
        this.camera.updateProjectionMatrix();
      }
      this.capytorioPlanetFadeActive = pose.altitudeRadius > 420;
      const skyAlpha = 1.0 - smoothstep01(3.05, 4.15, pose.logAlt);
      this.setSkyDomeAlpha(skyAlpha);
      if (this.worldEnv) {
        this.worldEnv.skyMesh.position.set(this.camera.position.x, 0, this.camera.position.z);
        this.worldEnv.skyMesh.scale.setScalar(Math.max(1.0, (desiredFar * 0.72) / 720));
        this.worldEnv.mountainMesh.visible = false;
      }
      if (this.oceanMesh) {
        this.oceanMesh.visible = pose.logAlt <= 3.65;
        if (this.oceanMesh.visible) {
          this.oceanMesh.position.x = Math.round(this.camera.position.x / 32) * 32;
          this.oceanMesh.position.z = Math.round(this.camera.position.z / 32) * 32;
        }
      }
      if (this.seamlessUniverse) {
        this.seamlessUniverse.forestGroveGroup.visible = false;
        this.seamlessUniverse.forestGroveGroup.matrixWorldAutoUpdate = false;
      }
    } else {
      if (this.capytorioPlanetFadeActive && !this.seamlessZoomActive) {
        this.capytorioPlanetFadeActive = false;
        if (this.camera.near !== 0.1) {
          this.camera.near = 0.1;
          this.camera.far = farInfo.cameraFar;
          this.camera.updateProjectionMatrix();
        }
        if (this.cosmicStage === 'playing' || this.cosmicStage === 'capy_selection') {
          this.setSkyDomeAlpha(1.0);
          this.setSceneBackgroundHex(
            this.currentMode === 'sanctuary' || this.currentMode === 'capytorio'
              ? (this.activeBiome?.skyHex ?? 0x38bdf8)
              : 0x38bdf8
          );
        }
        if (this.oceanMesh) {
          this.oceanMesh.visible = isSurfaceVisible;
        }
        this.seamlessUniverse?.hide();
      }

      if (Math.abs(this.camera.far - farInfo.cameraFar) > 0.5 || (!this.seamlessZoomActive && this.camera.near !== 0.1)) {
        if (!this.seamlessZoomActive) {
          this.camera.near = 0.1;
        }
        this.camera.far = farInfo.cameraFar;
        this.camera.updateProjectionMatrix();
      }

      if (this.worldEnv) {
        this.worldEnv.skyMesh.position.set(this.camera.position.x, 0, this.camera.position.z);
        this.worldEnv.skyMesh.scale.setScalar(farInfo.skyScale);
        // Keep Sanctuary's 220m alpine ring hidden when exploring the far-hemisphere Capytorio plain
        this.worldEnv.mountainMesh.visible =
          isSurfaceVisible &&
          farInfo.showMountains &&
          this.camera.position.x < 450 &&
          this.currentMode !== 'capytorio';
      }

      if (this.oceanMesh && isSurfaceVisible) {
        this.oceanMesh.visible = true;
        this.oceanMesh.position.x = Math.round(this.camera.position.x / 32) * 32;
        this.oceanMesh.position.z = Math.round(this.camera.position.z / 32) * 32;
      }

      if (this.seamlessUniverse) {
        const showForestGrove =
          isSurfaceVisible &&
          this.currentMode !== 'capytorio' &&
          ((this.seamlessZoomActive &&
            this.currentLogScaleMeters >= -0.85 &&
            this.currentLogScaleMeters <= 3.1) ||
            (!this.seamlessZoomActive && this.cosmicStage === 'playing'));
        this.seamlessUniverse.forestGroveGroup.visible = showForestGrove;
        this.seamlessUniverse.forestGroveGroup.matrixWorldAutoUpdate = showForestGrove;
      }
    }

    if (
      isSurfaceVisible &&
      this.cosmicStage === 'playing' &&
      !this.seamlessZoomActive &&
      !this.zoneTransition.active
    ) {
      const camX = this.camera.position.x;
      const camZ = this.camera.position.z;

      const visSanctuary = shouldRenderDistrict(
        ZONE_LOCATIONS.sanctuary.x,
        ZONE_LOCATIONS.sanctuary.z,
        40,
        camX,
        camZ,
        drawDist,
        this.currentMode === 'sanctuary'
      );
      const visSpore = shouldRenderDistrict(
        ZONE_LOCATIONS.spore.x,
        ZONE_LOCATIONS.spore.z,
        44,
        camX,
        camZ,
        drawDist,
        this.currentMode === 'spore'
      );
      const visCapytorio =
        this.currentMode === 'capytorio' || camX >= 450 - drawDist;
      const visRunner = shouldRenderDistrict(
        ZONE_LOCATIONS.runner.x,
        ZONE_LOCATIONS.runner.z - 43,
        64,
        camX,
        camZ,
        drawDist,
        this.currentMode === 'runner'
      );
      const visFallGuys = shouldRenderDistrict(
        ZONE_LOCATIONS.fallguys.x,
        ZONE_LOCATIONS.fallguys.z - 28,
        48,
        camX,
        camZ,
        drawDist,
        this.currentMode === 'fallguys'
      );

      this.sanctuaryGroup.visible = visSanctuary;
      this.sanctuaryGroup.matrixWorldAutoUpdate = visSanctuary;
      this.sporeGroup.visible = visSpore;
      this.sporeGroup.matrixWorldAutoUpdate = visSpore;
      this.capytorioGroup.visible = visCapytorio;
      this.capytorioGroup.matrixWorldAutoUpdate = visCapytorio;
      this.runnerGroup.visible = visRunner;
      this.runnerGroup.matrixWorldAutoUpdate = visRunner;
      this.fallGuysGroup.visible = visFallGuys;
      this.fallGuysGroup.matrixWorldAutoUpdate = visFallGuys;
    }
  }

  private buildSharedArchipelagoBase() {
    // GPU Rayleigh/Mie Sky Dome, 360° Snow-Capped Alpine Mountains, Clouds & Weather Precipitation
    this.worldEnv.skyMesh.userData.ignoreCameraFade = true;
    this.worldEnv.mountainMesh.userData.ignoreCameraFade = true;
    this.worldEnv.weatherMesh.userData.ignoreCameraFade = true;
    this.worldBaseGroup.add(this.worldEnv.skyMesh);
    this.worldBaseGroup.add(this.worldEnv.mountainMesh);
    this.worldBaseGroup.add(this.worldEnv.cloudGroup);
    this.worldBaseGroup.add(this.worldEnv.weatherMesh);

    // Endless Open-World Clearcoat Specular Ocean spanning past every island & horizon
    const oceanGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.CylinderGeometry(1200, 1200, 0.6, 64)
    );
    const oceanMat = RealisticWorldEnvironment.createOceanWaterMaterial(
      this.isSoftwareGl,
      this.isWebGpu
    );
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.set(0, -1.25, 0);
    ocean.receiveShadow = true;
    ocean.userData.ignoreCameraFade = true;
    this.oceanMesh = ocean;
    this.worldBaseGroup.add(ocean);

    // 4 Wide Walkable Grand Promenade Causeways (9.6m wide) directly connecting Sanctuary (0,0)
    // to Spore Lagoon, Capytorio Frontier, Number Stampede & Yuzu Mountain across open ocean channels
    const cobbleTex = RealisticWorldEnvironment.getTextureSet('cobble', 8);
    const timberTex = RealisticWorldEnvironment.getTextureSet('timber', 6);
    const sandTex = RealisticWorldEnvironment.getTextureSet('sand', 8);

    const promenadeDeckMat = new THREE.MeshStandardMaterial({
      color: 0xe7e5e4,
      map: cobbleTex.albedo,
      normalMap: cobbleTex.normal,
      normalScale: new THREE.Vector2(0.84, 0.84),
      roughnessMap: cobbleTex.roughness,
      aoMap: cobbleTex.ao,
      aoMapIntensity: 0.78,
      roughness: 0.58,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const promenadeCurbMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      map: timberTex.albedo,
      normalMap: timberTex.normal,
      normalScale: new THREE.Vector2(0.68, 0.68),
      roughnessMap: timberTex.roughness,
      aoMap: timberTex.ao,
      aoMapIntensity: 0.65,
      roughness: 0.45,
    });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.15,
      roughness: 0.2,
    });
    this.causewayLanternMat = lanternMat;
    this.worldEnv.registerWettableMaterial(promenadeDeckMat, 0.58);
    this.worldEnv.registerWettableMaterial(promenadeCurbMat, 0.45);

    for (let bIdx = 0; bIdx < CONTIGUOUS_BRIDGES.length; bIdx++) {
      const b = CONTIGUOUS_BRIDGES[bIdx];
      const bridgeGroup = new THREE.Group();
      const midX = (b.startX + b.endX) * 0.5;
      const midZ = (b.startZ + b.endZ) * 0.5;
      const yaw = Math.atan2(b.dirX, b.dirZ);
      bridgeGroup.position.set(midX, 0, midZ);
      bridgeGroup.rotation.y = yaw;
      bridgeGroup.userData.ignoreCameraFade = true;

      const deckGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
        new THREE.BoxGeometry(b.halfWidth * 2, 0.48, b.length + 2.4)
      );
      const deck = new THREE.Mesh(deckGeo, promenadeDeckMat);
      deck.position.set(0, -0.21, 0);
      deck.receiveShadow = true;
      deck.userData.ignoreCameraFade = true;
      bridgeGroup.add(deck);

      // Low timber guard curbs & glowing brass bollards along both edges
      for (const side of [-1, 1]) {
        const curbGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
          new THREE.BoxGeometry(0.32, 0.26, b.length + 1.2)
        );
        const curb = new THREE.Mesh(curbGeo, promenadeCurbMat);
        curb.position.set(side * (b.halfWidth - 0.18), 0.14, 0);
        curb.castShadow = true;
        curb.userData.ignoreCameraFade = true;
        bridgeGroup.add(curb);

        const postCount = Math.max(4, Math.floor(b.length / 11));
        for (let p = 0; p <= postCount; p++) {
          const zOff = -b.length * 0.46 + (p / postCount) * (b.length * 0.92);
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.14, 0.72, 8),
            promenadeCurbMat
          );
          post.position.set(side * (b.halfWidth - 0.18), 0.42, zOff);
          post.userData.ignoreCameraFade = true;
          bridgeGroup.add(post);

          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lanternMat);
          orb.position.set(side * (b.halfWidth - 0.18), 0.84, zOff);
          orb.userData.ignoreCameraFade = true;
          bridgeGroup.add(orb);
        }
      }

      this.worldBaseGroup.add(bridgeGroup);
    }

    // Welcoming Sandy Beach Rim around Spore Lagoon (-75, -75) so you walk seamlessly from bridge into water
    const lagoonRimGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.RingGeometry(33.2, 42.0, 48)
    );
    const lagoonRim = new THREE.Mesh(
      lagoonRimGeo,
      new THREE.MeshStandardMaterial({
        color: 0xfde68a,
        map: sandTex.albedo,
        normalMap: sandTex.normal,
        normalScale: new THREE.Vector2(0.7, 0.7),
        roughnessMap: sandTex.roughness,
        aoMap: sandTex.ao,
        aoMapIntensity: 0.55,
        roughness: 0.72,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
      })
    );
    lagoonRim.rotation.x = -Math.PI / 2;
    lagoonRim.position.set(ZONE_LOCATIONS.spore.x, 0.015, ZONE_LOCATIONS.spore.z);
    lagoonRim.receiveShadow = true;
    lagoonRim.userData.ignoreCameraFade = true;
    this.worldBaseGroup.add(lagoonRim);

    // Note: Capytorio Continental Shelf at wx >= 500 is rendered directly by Capytorio3DRenderer

    // Number Stampede North Forecourt, Side Return Boardwalks & South Turnaround Deck (-75, +75)
    const runnerForecourt = new THREE.Mesh(
      PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(16.8, 0.44, 14.0)),
      promenadeDeckMat
    );
    runnerForecourt.position.set(
      ZONE_LOCATIONS.runner.x,
      -0.205,
      ZONE_LOCATIONS.runner.z + 6.5
    );
    runnerForecourt.receiveShadow = true;
    runnerForecourt.userData.ignoreCameraFade = true;
    this.worldBaseGroup.add(runnerForecourt);

    for (const side of [-1, 1]) {
      const boardwalk = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.42, 102.0),
        promenadeCurbMat
      );
      boardwalk.position.set(
        ZONE_LOCATIONS.runner.x + side * 6.3,
        -0.19,
        ZONE_LOCATIONS.runner.z - 44.0
      );
      boardwalk.receiveShadow = true;
      boardwalk.userData.ignoreCameraFade = true;
      this.worldBaseGroup.add(boardwalk);
    }

    const runnerTurnaround = new THREE.Mesh(
      new THREE.BoxGeometry(16.8, 0.44, 12.0),
      promenadeDeckMat
    );
    runnerTurnaround.position.set(
      ZONE_LOCATIONS.runner.x,
      -0.205,
      ZONE_LOCATIONS.runner.z - 92.0
    );
    runnerTurnaround.receiveShadow = true;
    runnerTurnaround.userData.ignoreCameraFade = true;
    this.worldBaseGroup.add(runnerTurnaround);

    // Yuzu Mountain Entry Ramp, Continuous Safety Promenade & Summit Return Walkway (+75, +75)
    const fgRamp = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.5, 11.0), promenadeDeckMat);
    fgRamp.position.set(ZONE_LOCATIONS.fallguys.x, 0.05, ZONE_LOCATIONS.fallguys.z + 7.0);
    fgRamp.rotation.x = 0.08;
    fgRamp.receiveShadow = true;
    fgRamp.userData.ignoreCameraFade = true;
    this.worldBaseGroup.add(fgRamp);

    const fgUnderDeck = new THREE.Mesh(
      new THREE.BoxGeometry(16.8, 0.8, 76.0),
      promenadeDeckMat
    );
    fgUnderDeck.position.set(
      ZONE_LOCATIONS.fallguys.x,
      0.08,
      ZONE_LOCATIONS.fallguys.z - 29.0
    );
    fgUnderDeck.receiveShadow = true;
    fgUnderDeck.userData.ignoreCameraFade = true;
    this.worldBaseGroup.add(fgUnderDeck);
  }

  public switchMode(mode: PlayStyle, instant: boolean = false) {
    this.ensureSurfaceWorldsBuilt();
    if (mode !== 'sanctuary' && this.placementGhost.active) {
      this.cancelBuildingPlacementGhost();
    }
    const prevWorldPos = this.heroCapy.position.clone();
    this.currentMode = mode;
    if (mode !== 'capytorio') {
      AudioService.updateCapytorioAmbient(0, 0, false);
    }
    this.physicsBridge?.setActiveDistrict(mode);

    // Keep all 5 game zones permanently active & visible in the same contiguous world!
    this.worldBaseGroup.visible = true;
    this.worldBaseGroup.matrixWorldAutoUpdate = true;
    this.sanctuaryGroup.visible = true;
    this.sanctuaryGroup.matrixWorldAutoUpdate = true;
    this.sporeGroup.visible = true;
    this.sporeGroup.matrixWorldAutoUpdate = true;
    this.capytorioGroup.visible = true;
    this.capytorioGroup.matrixWorldAutoUpdate = true;
    this.runnerGroup.visible = true;
    this.runnerGroup.matrixWorldAutoUpdate = true;
    this.fallGuysGroup.visible = true;
    this.fallGuysGroup.matrixWorldAutoUpdate = true;
    if (this.seamlessUniverse) {
      this.seamlessUniverse.forestGroveGroup.visible = true;
      this.seamlessUniverse.forestGroveGroup.matrixWorldAutoUpdate = true;
    }

    this.heroVelocity.set(0, 0, 0);
    this.pointerTargetX = null;
    this.heroCapy.scale.setScalar(1.0);
    this.heroCapy.visible = true;
    this.portalCooldown = 2.0;

    if (mode === 'sanctuary') {
      this.heroLocalPos.set(0, 0, 4);
      this.heroYaw = Math.PI;
      this.setSceneBackgroundHex(this.activeBiome?.skyHex ?? 0x38bdf8);
      this.syncDachshundVisibility();
      this.resetDachshundTrail();
      this.updateDachshundTransforms(0);
      this.callbacks.onModeNotification?.(
        'Bump matching citrus trees to shake fruits loose · Eat fitting fruits to grow · Swim under Home Pool tap water to rinse!'
      );
    } else if (mode === 'spore') {
      this.syncDachshundVisibility();
      this.heroLocalPos.set(0, 0, 0);
      this.heroYaw = Math.PI;
      this.setSceneBackgroundHex(0x0ea5e9);
      this.resetSporeGame();
      this.callbacks.onModeNotification?.(
        'Moved to Spore Lagoon (-110, -110) • Eat Yuzu Plankton & DNA Helixes to grow!'
      );
    } else if (mode === 'capytorio') {
      this.syncDachshundVisibility();
      this.heroLocalPos.set(0, 0, 3.0);
      this.heroYaw = Math.PI;
      this.setSceneBackgroundHex(this.activeBiome?.skyHex ?? 0x38bdf8);
      const initPose = evaluateCapytorioAltitudePose(this.capytorioObliqueZoomDist);
      this.ensureCapytorioRenderer().sync(
        this.capytorioEngine,
        CAPYTORIO_WORLD_ORIGIN_X,
        CAPYTORIO_WORLD_ORIGIN_Z + 3.0,
        0.016,
        this.worldEnv?.elapsedSeconds ?? 0,
        true,
        this.getCapytorioCameraMode() === 'oblique' ? initPose.altitudeRadius : 26
      );
      this.callbacks.onModeNotification?.(
        'Capytorio Frontier (+1200, 0) • Blank infinite ore field! Click to place Drills [1], Belts [2], Furnaces [4] & Generators [6].'
      );
      this.emitCapytorioSnapshot();
    } else if (mode === 'runner') {
      this.heroLocalPos.set(0, 0, 0);
      this.heroYaw = Math.PI;
      this.setSceneBackgroundHex(0x38bdf8);
      this.resetRunnerGame();
      this.callbacks.onModeNotification?.(
        'Moved to Number Stampede (-110, +135) • Steer through + and × gates to multiply your herd!'
      );
    } else if (mode === 'fallguys') {
      this.heroLocalPos.set(0, 0.6, 0);
      this.heroYaw = Math.PI;
      this.setSceneBackgroundHex(0x60a5fa);
      this.resetFallGuysGame(false);
      this.callbacks.onModeNotification?.(
        'Moved to Yuzu Mountain (+110, +135) • Race rival Capys past hammers & see-saws to the Crown!'
      );
    }

    this.heroCapy.rotation.set(0, this.heroYaw, 0);

    const zone = ZONE_LOCATIONS[mode];
    const targetWorldPos = new THREE.Vector3(
      zone.x + this.heroLocalPos.x,
      this.heroLocalPos.y,
      zone.z + this.heroLocalPos.z
    );

    if (!instant && prevWorldPos.distanceTo(targetWorldPos) > 5) {
      this.zoneTransition.active = true;
      this.zoneTransition.elapsed = 0;
      this.zoneTransition.fromWorldPos.copy(prevWorldPos);
      this.zoneTransition.toWorldPos.copy(targetWorldPos);
    } else {
      this.zoneTransition.active = false;
      this.heroCapy.position.copy(targetWorldPos);
      this.snapCameraToCurrentZone();
    }

    this.emitTelemetry();
    if (this.cosmicStage === 'playing') {
      if (!this.isSoftwareGl) {
        this.tick(0.016);
      } else if (instant) {
        this.renderImmediateFrame(0.016);
      }
    }
  }

  public renderImmediateFrame(dt: number = 0.016): void {
    if (this.disposed) return;
    if (this.cosmicStage === 'playing') {
      this.applySurfaceDrawDistanceAndCulling(true);
      if (this.homePool) {
        _cachedPoolSpec.x = this.homePool.centerX;
        _cachedPoolSpec.z = this.homePool.centerZ;
        _cachedPoolSpec.radius = this.homePool.basinRadius;
      }
      const heroGroundY = sampleContiguousGroundY(
        this.heroCapy.position.x,
        this.heroCapy.position.z,
        this.homePool ? _cachedPoolSpec : null,
        this.physicsBridge?.getSeeSawTiltAngle() ?? 0
      );
      this.gpuEngine?.updateLightingAndShadowCascade(
        dt,
        this.heroCapy.position.x,
        this.heroCapy.position.y,
        this.heroCapy.position.z,
        heroGroundY,
        this.heroCapy.visible,
        this.worldEnv.currentNightFactor,
        this.worldEnv.currentSunDir,
        this.worldEnv.currentMoonDir,
        this.worldEnv.activeShadowCaster,
        this.worldEnv.getDayPhaseLabel(),
        this.worldEnv.timeOfDayHours,
        this.worldEnv.currentIblEnvIntensity
      );
      this.updateHeadLineOfSightTransparency(dt);
    }
    this.renderSceneFrame(dt);
  }

  private snapCameraToCurrentZone() {
    const zone = ZONE_LOCATIONS[this.currentMode];
    const wx = zone.x + this.heroLocalPos.x;
    const wy = this.heroLocalPos.y;
    const wz = zone.z + this.heroLocalPos.z;
    const distScale = this.settings.cameraDistance || 1.0;
    this.mouselookLastActiveTimeMs = -100000;

    if (this.currentMode === 'capytorio') {
      if (this.getCapytorioCameraMode() === 'oblique') {
        const pose = evaluateCapytorioAltitudePose(this.capytorioObliqueZoomDist);
        this.surfaceCamYaw = Math.PI;
        this.surfaceCamPitch = pose.pitchRad;
        this.camera.position.set(wx, wy + pose.dy, wz + pose.dz);
        this.camera.lookAt(wx, wy + 0.15, wz);
        this.syncCapytorioHighAltitudePlanetSurface(0.016, wx, wy, wz, pose);
      } else {
        this.surfaceCamYaw = Math.PI;
        this.surfaceCamPitch = 0.66;
        this.camera.position.set(wx, wy + 13.5 * distScale, wz + 16.5 * distScale);
        this.camera.lookAt(wx, wy + 0.5, wz - 2.0);
        if (!this.seamlessZoomActive && this.capytorioPlanetFadeActive) {
          this.capytorioPlanetFadeActive = false;
          this.seamlessUniverse?.hide();
        }
      }
    } else if (this.currentMode === 'runner') {
      this.surfaceCamYaw = Math.PI;
      this.surfaceCamPitch = 0.46;
      this.camera.position.set(wx, wy + 5.8 * distScale, wz + 10.2 * distScale);
      this.camera.lookAt(wx, wy + 1.2, wz - 12);
    } else if (this.settings.cameraFollowBehind) {
      const camDist = 11.5 * distScale;
      const camHeight = 6.8 * distScale;
      this.surfaceCamYaw = this.heroYaw;
      this.surfaceCamPitch = Math.atan2(Math.max(0.5, camHeight - 1.25), camDist);
      this.camera.position.set(
        wx - Math.sin(this.heroYaw) * camDist,
        wy + camHeight,
        wz - Math.cos(this.heroYaw) * camDist
      );
      this.camera.lookAt(
        wx + Math.sin(this.heroYaw) * 3.5,
        wy + 1.2,
        wz + Math.cos(this.heroYaw) * 3.5
      );
    } else {
      const camDist = 12.0 * distScale;
      const camHeight = 7.5 * distScale;
      this.surfaceCamYaw = Math.PI;
      this.surfaceCamPitch = Math.atan2(Math.max(0.5, camHeight - 1.25), camDist);
      this.camera.position.set(wx, wy + camHeight, wz + camDist);
      this.camera.lookAt(wx, wy + 1.0, wz - 2);
    }
    if (this.cosmicStage === 'playing') {
      this.updateHeadLineOfSightTransparency(1.0);
    }
  }

  public updateStats(newStats: PlayerStats) {
    const skinChanged = this.stats.activeSkin !== newStats.activeSkin;
    const hatChanged = this.stats.activeHat !== newStats.activeHat;
    const mutationsChanged =
      this.stats.activeMutations.length !== newStats.activeMutations.length ||
      this.stats.activeMutations.some((m, idx) => m !== newStats.activeMutations[idx]);

    this.stats = newStats;

    if (skinChanged || hatChanged || mutationsChanged) {
      if (skinChanged) {
        this.activeHeadOrangeIndex =
          CapyModelGenerator.skinDefaultOrangeIndex[newStats.activeSkin] ?? 0;
      }
      const activeOrange = HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex];
      CapyModelGenerator.updateCapyAppearance(
        this.heroCapy,
        newStats.activeHat,
        newStats.activeSkin,
        newStats.activeMutations,
        activeOrange.colorHex
      );
      if (skinChanged) {
        this.syncDachshundSkinAndOrange();
      }
      this.updateBioluminescentNightGlow();
    }
  }

  // ============================================================================
  // INTERACTIVE RAYCAST BUILDING PLACEMENT GHOST (SANCTUARY ISLAND)
  // ============================================================================
  public getPlacementGhostState(): PlacementGhostStatus {
    return {
      active: this.placementGhost.active,
      type: this.placementGhost.type,
      name: this.placementGhost.name,
      x: this.placementGhost.x,
      z: this.placementGhost.z,
      valid: this.placementGhost.valid,
    };
  }

  public startBuildingPlacementGhost(
    type: BuildingType,
    name: string,
    description: string
  ) {
    this.cancelBuildingPlacementGhost(true);
    if (this.zoneTransition.active) {
      this.zoneTransition.active = false;
      this.syncDachshundVisibility();
      this.snapCameraToCurrentZone();
    }

    const previewRoot = new THREE.Group();
    previewRoot.name = 'BuildingPlacementGhost';
    previewRoot.userData.ignoreCameraFade = true;

    const model = CapyModelGenerator.createBuildingByType(type, 1);
    const ghostMats: THREE.MeshStandardMaterial[] = [];
    model.traverse((node) => {
      node.userData.ignoreCameraFade = true;
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        const ghostMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 0.72,
          transparent: true,
          opacity: 0.56,
          roughness: 0.32,
          depthWrite: false,
        });
        mesh.material = ghostMat;
        ghostMats.push(ghostMat);
      }
    });
    previewRoot.add(model);

    const bRad = type === 'trampoline_pad' ? 1.65 : 2.05;
    const ringGeo = new THREE.RingGeometry(bRad * 0.84, bRad * 1.04, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.08;
    ringMesh.userData.ignoreCameraFade = true;
    previewRoot.add(ringMesh);

    const defaultSpot = this.findClearBuildingSpot(this.stats.buildings.length);
    previewRoot.position.set(defaultSpot.x, 0, defaultSpot.z);
    this.sanctuaryGroup.add(previewRoot);

    this.placementGhost = {
      active: true,
      type,
      name,
      description,
      x: defaultSpot.x,
      z: defaultSpot.z,
      valid: this.isStaticSpotClearForBuilding(defaultSpot.x, defaultSpot.z, bRad, -1),
      group: previewRoot,
      ringMat,
      ghostMats,
    };
    this.syncPlacementGhostTint();
    this.callbacks.onPlacementGhostChange?.(this.getPlacementGhostState());
  }

  public cancelBuildingPlacementGhost(silent: boolean = false) {
    if (this.placementGhost.group) {
      this.sanctuaryGroup.remove(this.placementGhost.group);
      this.placementGhost.ghostMats.forEach((m) => m.dispose());
      this.placementGhost.ringMat?.dispose();
    }
    this.placementGhost = {
      active: false,
      type: null,
      name: '',
      description: '',
      x: 0,
      z: 0,
      valid: false,
      group: null,
      ringMat: null,
      ghostMats: [],
    };
    if (!silent) {
      this.callbacks.onPlacementGhostChange?.(this.getPlacementGhostState());
    }
  }

  private syncPlacementGhostTint() {
    const isValid = this.placementGhost.valid;
    const colorHex = isValid ? 0x10b981 : 0xf43f5e;
    const emissiveHex = isValid ? 0x059669 : 0xe11d48;
    for (let i = 0; i < this.placementGhost.ghostMats.length; i++) {
      const m = this.placementGhost.ghostMats[i];
      m.color.setHex(colorHex);
      m.emissive.setHex(emissiveHex);
    }
    if (this.placementGhost.ringMat) {
      this.placementGhost.ringMat.color.setHex(colorHex);
    }
  }

  public updateBuildingPlacementGhostFromNdc(ndcX: number, ndcY: number): boolean {
    if (
      !this.placementGhost.active ||
      !this.placementGhost.group ||
      !this.placementGhost.type ||
      this.currentMode !== 'sanctuary'
    ) {
      return false;
    }

    _pointerNdc.set(ndcX, ndcY);
    _raycaster.setFromCamera(_pointerNdc, this.camera);
    const hit = _raycaster.ray.intersectPlane(_sanctuaryGroundPlane, _ghostWorldHit);
    if (!hit) return false;

    let lx = _ghostWorldHit.x - ZONE_LOCATIONS.sanctuary.x;
    let lz = _ghostWorldHit.z - ZONE_LOCATIONS.sanctuary.z;
    const radial = Math.hypot(lx, lz);
    const bRad = this.placementGhost.type === 'trampoline_pad' ? 1.65 : 2.05;
    const maxR = 28.8 - bRad;
    if (radial > maxR && radial > 0.001) {
      lx = (lx / radial) * maxR;
      lz = (lz / radial) * maxR;
    }

    const rx = +lx.toFixed(2);
    const rz = +lz.toFixed(2);
    const valid = this.isStaticSpotClearForBuilding(rx, rz, bRad, -1);

    const changed =
      Math.abs(rx - this.placementGhost.x) > 0.04 ||
      Math.abs(rz - this.placementGhost.z) > 0.04 ||
      valid !== this.placementGhost.valid;

    this.placementGhost.x = rx;
    this.placementGhost.z = rz;
    this.placementGhost.valid = valid;
    this.placementGhost.group.position.set(rx, 0, rz);
    this.syncPlacementGhostTint();

    if (changed) {
      this.callbacks.onPlacementGhostChange?.(this.getPlacementGhostState());
    }
    return valid;
  }

  private getEffectiveSpeedMultiplier(): number {
    const upgBonus = (this.stats.upgrades.speedBoost - 1) * 0.15;
    const { speedBonus } = ProgressionService.getMutationBonuses(this.stats);
    const heroSpeed = this.activeHeroSpec?.speedMultiplier ?? 1.0;

    // Cozy Onsen proximity aura (+18% + 4% per level above 1 inside 10.5m)
    let onsenBonus = 0;
    if (this.currentMode === 'sanctuary') {
      let bestOnsenLvl = 0;
      for (let i = 0; i < this.stats.buildings.length; i++) {
        const b = this.stats.buildings[i];
        if (b.type === 'hot_spring') {
          if (Math.hypot(this.heroLocalPos.x - b.x, this.heroLocalPos.z - b.z) <= 10.5) {
            bestOnsenLvl = Math.max(bestOnsenLvl, b.level || 1);
          }
        }
      }
      if (bestOnsenLvl > 0) {
        onsenBonus = 0.18 + 0.04 * (bestOnsenLvl - 1);
      }
    }

    const cfgMult = this.proceduralConfig?.player?.moveSpeedMultiplier ?? 1.0;
    return (1 + upgBonus + speedBonus + onsenBonus) * heroSpeed * cfgMult;
  }

  private getEffectiveMagnetRadius(): number {
    const base = 2.4 + ((this.stats.upgrades.yuzuMagnet || 1) - 1) * 0.9;
    const { magnetBonus } = ProgressionService.getMutationBonuses(this.stats);
    const heroMagnet = this.activeHeroSpec?.magnetMultiplier ?? 1.0;
    return base * (1 + magnetBonus) * heroMagnet;
  }

  // ============================================================================
  // COSMIC GENESIS, MULTI-SCALE UNIVERSE ZOOM & HERO CAPYBARA SELECTION
  // ============================================================================
  private buildSelectableCapyHeroCircle() {
    this.selectableCapyGroup.name = 'SelectableCapyHeroCircle';
    this.selectableCapyRings = [];
    this.selectableCapyHitMeshes = [];

    PLAYABLE_CAPY_HEROES.forEach((hero, idx) => {
      const angle = ((idx - 2.5) / 5.5) * Math.PI * 0.88;
      const radius = 5.4;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius - 1.2;

      const node = new THREE.Group();
      node.position.set(x, 0, z);
      node.lookAt(0, 0, 7.5);

      const capyMesh = CapyModelGenerator.createCapybara(
        hero.hat,
        1.05,
        hero.skin,
        hero.mutations
      );
      node.add(capyMesh);

      // Glowing selection pedestal ring
      const ringGeo = new THREE.RingGeometry(0.95, 1.32, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx === this.selectedCapyHeroIndex ? 0xfacc15 : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: idx === this.selectedCapyHeroIndex ? 0.95 : 0.42,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.06;
      node.add(ringMesh);
      this.selectableCapyRings.push(ringMesh);

      // Invisible hit target for direct 3D tap selection
      const hitGeo = new THREE.SphereGeometry(1.65, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 0.8;
      hitMesh.userData = { cosmicType: 'capy_hero', index: idx };
      node.add(hitMesh);
      this.selectableCapyHitMeshes.push(hitMesh);

      this.selectableCapyGroup.add(node);
    });

    this.sanctuaryGroup.add(this.selectableCapyGroup);
  }

  public setCosmicStage(stage: CosmicStage) {
    if (stage === 'playing' || stage === 'capy_selection') {
      this.ensureSurfaceWorldsBuilt();
    }
    this.cosmicStage = stage;
    this.seamlessZoomActive = false;
    this.autoZoomDirection = 0;
    this.performanceLog.notifyTransitionWarmup(5);
    if (this.vfxEngine) {
      const showVfx = stage === 'playing' || stage === 'capy_selection';
      this.vfxEngine.rootGroup.visible = showVfx;
      this.vfxEngine.rootGroup.matrixWorldAutoUpdate = showVfx;
    }
    if (this.seamlessUniverse) {
      this.seamlessUniverse.hide();
      const showForestGrove = stage === 'playing';
      this.seamlessUniverse.forestGroveGroup.visible = showForestGrove;
      this.seamlessUniverse.forestGroveGroup.matrixWorldAutoUpdate = showForestGrove;
    }
    if (this.cosmicBuilder) {
      const legacyCosmic = stage !== 'playing' && stage !== 'capy_selection';
      this.cosmicBuilder.setSuspended(!legacyCosmic);
      this.cosmicBuilder.rootGroup.visible = legacyCosmic;
      this.cosmicBuilder.rootGroup.matrixWorldAutoUpdate = legacyCosmic;
    }
    if (stage === 'playing') {
      this.vesselMode = 'landed';
      this.descentRingsGroup.visible = false;
      this.descentRingsGroup.matrixWorldAutoUpdate = false;
      this.setSkyDomeAlpha(1.0);
      this.syncDockedVesselPose(0.016, this.currentMode === 'sanctuary');
    } else {
      this.dockedChronoVesselVisible = false;
      this.descentRingsGroup.visible = false;
      this.descentRingsGroup.matrixWorldAutoUpdate = false;
      if (stage === 'capy_selection') {
        this.setSkyDomeAlpha(1.0);
      }
    }
    const isSurfaceStage = stage === 'capy_selection' || stage === 'playing';
    const stageFarInfo = computeEffectiveCameraFar(
      this.settings.drawDistance ?? 650,
      this.settings.gpuQualityPreset ?? 'high',
      isSurfaceStage,
      stage === 'playing' ? CAPYBARA_FOREST_LOG_METERS : 28.0
    );
    if (this.camera.near !== 0.1 || Math.abs(this.camera.far - stageFarInfo.cameraFar) > 0.5) {
      this.camera.near = 0.1;
      this.camera.far = stageFarInfo.cameraFar;
      this.camera.updateProjectionMatrix();
    }

    const stageLogMap: Record<CosmicStage, number> = {
      singularity: MAX_UNIVERSE_LOG_METERS,
      big_bang: 27.2,
      universe_flight: 23.1,
      galaxy_view: 21.0,
      star_system_view: 12.9,
      planet_orbit: 7.1,
      planet_descent: 4.9,
      capy_selection: 0.95,
      playing: CAPYBARA_FOREST_LOG_METERS,
    };
    this.currentLogScaleMeters = stageLogMap[stage];
    this.targetLogScaleMeters = stageLogMap[stage];
    this.cosmicUiTelemetryAccum = 0;

    this.worldBaseGroup.visible = isSurfaceStage;
    this.worldBaseGroup.matrixWorldAutoUpdate = isSurfaceStage;
    this.sanctuaryGroup.visible = isSurfaceStage;
    this.sanctuaryGroup.matrixWorldAutoUpdate = isSurfaceStage;
    this.sporeGroup.visible = isSurfaceStage;
    this.sporeGroup.matrixWorldAutoUpdate = isSurfaceStage;
    this.capytorioGroup.visible = isSurfaceStage;
    this.capytorioGroup.matrixWorldAutoUpdate = isSurfaceStage;
    this.runnerGroup.visible = isSurfaceStage;
    this.runnerGroup.matrixWorldAutoUpdate = isSurfaceStage;
    this.fallGuysGroup.visible = isSurfaceStage;
    this.fallGuysGroup.matrixWorldAutoUpdate = isSurfaceStage;

    this.selectableCapyGroup.visible = stage === 'capy_selection';
    this.selectableCapyGroup.matrixWorldAutoUpdate = stage === 'capy_selection';
    this.heroCapy.visible = stage === 'playing';
    this.heroCapy.matrixWorldAutoUpdate = stage === 'playing';
    this.syncDachshundVisibility();
    this.applySurfaceDrawDistanceAndCulling(isSurfaceStage);

    if (stage === 'singularity') {
      this.setSceneBackgroundHex(0x000000);
      this.cosmicCamPos.set(0, 0, 26);
      this.cosmicCamLook.set(0, 0, 0);
      this.camera.position.copy(this.cosmicCamPos);
      this.camera.lookAt(this.cosmicCamLook);
    } else if (stage === 'big_bang') {
      this.setSceneBackgroundHex(0x020617);
      this.cosmicOrbitYaw = 0.16;
      this.cosmicOrbitPitch = 0.24;
      this.cosmicZoomMultiplier = 1.0;
      this.cosmicCamPos.set(0, 26, 128);
      this.cosmicCamLook.set(0, 0, 0);
    } else if (stage === 'universe_flight') {
      this.setSceneBackgroundHex(0x020617);
      this.cosmicOrbitYaw = 0;
      this.cosmicOrbitPitch = 0.25;
      this.cosmicZoomMultiplier = 1.0;
      this.cosmicCamPos.set(0, 32, 155);
      this.cosmicCamLook.set(0, 0, 0);
    } else if (stage === 'galaxy_view') {
      this.setSceneBackgroundHex(0x030712);
      this.cosmicBuilder.populateGalaxyView(this.selectedGalaxyIndex);
      this.cosmicOrbitYaw = 0;
      this.cosmicOrbitPitch = 0.38;
      this.cosmicCamPos.set(0, 26, 68);
      this.cosmicCamLook.set(0, 0, 0);
    } else if (stage === 'star_system_view') {
      this.setSceneBackgroundHex(0x030712);
      this.cosmicBuilder.populateStarSystemView(this.selectedGalaxyIndex, this.selectedStarIndex);
      this.cosmicOrbitYaw = 0;
      this.cosmicOrbitPitch = 0.42;
      this.cosmicCamPos.set(0, 28, 66);
      this.cosmicCamLook.set(0, 0, 0);
    } else if (stage === 'planet_orbit') {
      this.setSceneBackgroundHex(0x020617);
      this.cosmicBuilder.populatePlanetOrbitView(
        this.selectedGalaxyIndex,
        this.selectedStarIndex,
        this.selectedPlanetIndex
      );
      this.cosmicOrbitYaw = 0;
      this.cosmicOrbitPitch = 0.2;
      this.cosmicCamPos.set(0, 6, 30);
      this.cosmicCamLook.set(0, 0, 0);
    } else if (stage === 'planet_descent') {
      this.cosmicDescentElapsed = 0;
      this.storySurfaceRevealed = false;
      _storyDescentStartCam.copy(this.camera.position);
      _storyDescentStartLook.copy(this.cosmicCamLook);
      this.setSkyDomeAlpha(0);
    } else if (stage === 'capy_selection') {
      this.setSceneBackgroundHex(this.activeBiome.skyHex);
      this.camera.position.copy(_storySelectionCamPos);
      this.camera.lookAt(_storySelectionLook);
    } else if (stage === 'playing') {
      this.setSceneBackgroundHex(
        this.currentMode === 'sanctuary' ? this.activeBiome.skyHex : 0x38bdf8
      );
      this.snapCameraToCurrentZone();
    }

    this.cosmicBuilder.syncStageVisibility(stage);
    this.applyFogSetting();

    this.emitCosmicState();
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
    this.gpuEngine.render();
  }

  public triggerBigBang() {
    if (this.cosmicStage !== 'singularity') return;
    AudioService.playBigBang();
    this.setCosmicStage('big_bang');
  }

  public skipToUniverseFlight() {
    AudioService.playCosmicWarp(1.0);
    this.setCosmicStage('universe_flight');
  }

  public pulseGravityWave() {
    this.cosmicBuilder.triggerGravityWaveBurst(0, 0, 0);
    AudioService.playCosmicWarp(1.15);
    this.emitCosmicState();
  }

  public adjustGravityConstant(delta: number) {
    this.cosmicBuilder.adjustGravityConstant(delta);
    AudioService.playCoin();
    this.emitCosmicState();
  }

  public setStellarColorMode(mode: StellarColorMappingMode) {
    this.cosmicBuilder.setStellarColorMode(mode);
    AudioService.playCoin();
    this.emitCosmicState();
  }

  public cycleStellarColorMode() {
    this.cosmicBuilder.cycleStellarColorMode();
    AudioService.playCoin();
    this.emitCosmicState();
  }

  public pickRandomTrackedStar(): number {
    const idx = this.cosmicBuilder.pickRandomTrackedStar();
    const ts = this.cosmicBuilder.getTrackedStarTelemetry();
    this.selectedGalaxyIndex = ts.hostGalaxyIndex;
    this.selectedStarIndex = ts.hostStarSystemIndex;
    AudioService.playCoin();
    this.emitCosmicState();
    return idx;
  }

  public toggleFollowTrackedStar(): boolean {
    const following = this.cosmicBuilder.toggleCameraFollowingTrackedStar();
    AudioService.playCoin();
    this.emitCosmicState();
    return following;
  }

  public triggerSupernovaOnTrackedStar() {
    this.cosmicBuilder.triggerTrackedStarSupernova();
    AudioService.playBigBang();
    this.emitCosmicState();
  }

  public followTrackedStarToPlanet() {
    const ts = this.cosmicBuilder.getTrackedStarTelemetry();
    this.selectedGalaxyIndex = THREE.MathUtils.clamp(
      ts.hostGalaxyIndex,
      0,
      COSMIC_GALAXIES.length - 1
    );
    const galaxy = COSMIC_GALAXIES[this.selectedGalaxyIndex] || COSMIC_GALAXIES[0];
    this.selectedStarIndex = THREE.MathUtils.clamp(
      ts.hostStarSystemIndex,
      0,
      galaxy.starSystems.length - 1
    );
    this.selectedPlanetIndex = 0;
    this.selectedLandingIndex = 0;
    AudioService.playCosmicWarp(1.45);
    this.setCosmicStage('planet_orbit');
  }

  public selectGalaxy(index: number) {
    this.selectedGalaxyIndex = THREE.MathUtils.clamp(index, 0, COSMIC_GALAXIES.length - 1);
    this.selectedStarIndex = 0;
    this.selectedPlanetIndex = 0;
    this.selectedLandingIndex = 0;
    AudioService.playCosmicWarp(1.05);
    this.setCosmicStage('galaxy_view');
  }

  public selectStarSystem(index: number) {
    const galaxy = COSMIC_GALAXIES[this.selectedGalaxyIndex] || COSMIC_GALAXIES[0];
    this.selectedStarIndex = clampStarSystemIndex(index, galaxy.starSystems.length);
    const star = galaxy.starSystems[this.selectedStarIndex] || galaxy.starSystems[0];
    const habitableIdx = star.planets.findIndex((p) => p.landingSpots.length > 0);
    this.selectedPlanetIndex = habitableIdx >= 0 ? habitableIdx : 0;
    this.selectedLandingIndex = 0;
    AudioService.playCosmicWarp(1.25);
    this.setCosmicStage('star_system_view');
    this.callbacks.onOrbitTelemetryChange?.(this.getOrbitTelemetry());
  }

  public setOrbitTimeScale(scaleId: OrbitTimeScaleId) {
    this.orbitTimeScale = scaleId;
    this.cosmicBuilder.setOrbitTimeScale(scaleId);
    this.seamlessUniverse.setOrbitTimeScale(scaleId);
    this.callbacks.onOrbitTelemetryChange?.(this.getOrbitTelemetry());
  }

  public getOrbitTimeScale(): OrbitTimeScaleId {
    return this.orbitTimeScale;
  }

  public getOrbitTelemetry(): OrbitTelemetry {
    return this.cosmicBuilder.getOrbitTelemetry(this.selectedPlanetIndex);
  }

  public selectAsteroidBelt() {
    const galaxy = COSMIC_GALAXIES[this.selectedGalaxyIndex] || COSMIC_GALAXIES[0];
    const star = galaxy.starSystems[this.selectedStarIndex] || galaxy.starSystems[0];
    const belt = star.asteroidBelt;
    const name = belt?.name || 'Main Asteroid Belt';
    const sub = belt?.subtitle || '2.8 AU · 1,200 Planetesimals';
    this.callbacks.onModeNotification?.(`${name} · ${sub}`);
    AudioService.playCoin();
  }

  public selectPlanet(index: number) {
    const galaxy = COSMIC_GALAXIES[this.selectedGalaxyIndex] || COSMIC_GALAXIES[0];
    const star = galaxy.starSystems[this.selectedStarIndex] || galaxy.starSystems[0];
    this.selectedPlanetIndex = THREE.MathUtils.clamp(index, 0, star.planets.length - 1);
    this.selectedLandingIndex = 0;
    AudioService.playCosmicWarp(1.45);
    this.setCosmicStage('planet_orbit');
  }

  public selectLandingSpot(index: number) {
    const galaxy = COSMIC_GALAXIES[this.selectedGalaxyIndex] || COSMIC_GALAXIES[0];
    const star = galaxy.starSystems[this.selectedStarIndex] || galaxy.starSystems[0];
    const planet = star.planets[this.selectedPlanetIndex] || star.planets[0];
    this.selectedLandingIndex = THREE.MathUtils.clamp(index, 0, planet.landingSpots.length - 1);
    const spot = planet.landingSpots[this.selectedLandingIndex] || planet.landingSpots[0];

    this.pendingLandingPlayStyle = spot.targetPlayStyle ?? 'sanctuary';
    this.applyPlanetaryBiome(spot.biome);
    AudioService.playCosmicWarp(1.75);
    this.setCosmicStage('planet_descent');
  }

  public applyPlanetaryBiome(biome: PlanetaryBiomeConfig) {
    this.activeBiome = biome;
    if (this.oceanMesh) {
      (this.oceanMesh.material as THREE.MeshStandardMaterial).color.setHex(biome.oceanHex);
    }
    if (this.sanctuaryIslandMesh) {
      (this.sanctuaryIslandMesh.material as THREE.MeshStandardMaterial).color.setHex(
        biome.islandGrassHex
      );
    }
    if (this.sanctuaryBeachMesh) {
      (this.sanctuaryBeachMesh.material as THREE.MeshStandardMaterial).color.setHex(
        biome.beachSandHex
      );
    }
    if (this.sanctuaryDecorMesh && biome.floraPaletteHexes.length > 0) {
      for (let i = 0; i < 48; i++) {
        _colorHelper.setHex(biome.floraPaletteHexes[i % biome.floraPaletteHexes.length]);
        this.sanctuaryDecorMesh.setColorAt(i, _colorHelper);
      }
      if (this.sanctuaryDecorMesh.instanceColor) {
        this.sanctuaryDecorMesh.instanceColor.needsUpdate = true;
      }
    }
    this.applyFogSetting();
  }

  public getProceduralConfig(): ProceduralGameConfig {
    return cloneProceduralConfig(this.proceduralConfig);
  }

  public getVramResourceTelemetry(): {
    geometries: number;
    textures: number;
    programs: number;
  } {
    const info = this.renderer.info;
    return {
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: 'programs' in info && Array.isArray(info.programs) ? info.programs.length : 0,
    };
  }

  public setVesselMode(mode: ChronoVesselViewMode): void {
    this.vesselMode = mode;
    this.chronoVessel?.setMode(mode);
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public getVesselMode(): ChronoVesselViewMode {
    return this.vesselMode;
  }

  public isVesselFlying(): boolean {
    return this.seamlessZoomActive || this.vesselMode !== 'landed' || this.cosmicStage !== 'playing';
  }

  public adjustVesselThrottle(wheelDelta: number, justLaunched: boolean = false): number {
    if (!this.seamlessZoomActive) {
      this.launchIntoCosmos(this.currentLogScaleMeters);
    }
    const nextTarget = computeOrbitalZoomThrottleStep(
      this.targetCruiseVelocityLogPerSec,
      wheelDelta,
      justLaunched
    );

    this.targetCruiseVelocityLogPerSec = nextTarget;
    if (justLaunched && wheelDelta < 0) {
      this.cruiseVelocityLogPerSec = Math.max(0.45, nextTarget * 0.7);
    }
    if (Math.abs(nextTarget) < 0.03) {
      this.autoZoomDirection = 0;
    } else if (nextTarget < 0) {
      this.autoZoomDirection = -1;
    } else {
      this.autoZoomDirection = 1;
    }
    this.targetLogScaleMeters = this.currentLogScaleMeters;

    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
    return this.targetCruiseVelocityLogPerSec;
  }

  public setCruiseVelocity(velLogPerSec: number): void {
    if (Math.abs(velLogPerSec) < 0.03) {
      this.autoZoomDirection = 0;
      this.targetCruiseVelocityLogPerSec = 0;
      this.cruiseVelocityLogPerSec = 0;
      this.targetLogScaleMeters = this.currentLogScaleMeters;
    } else if (velLogPerSec < 0) {
      this.autoZoomDirection = -1;
      this.targetCruiseVelocityLogPerSec = THREE.MathUtils.clamp(velLogPerSec, -2.5, -0.05);
      this.targetLogScaleMeters = this.currentLogScaleMeters;
      if (this.cruiseVelocityLogPerSec >= -0.02) {
        this.cruiseVelocityLogPerSec = this.targetCruiseVelocityLogPerSec * 0.45;
      }
    } else {
      this.autoZoomDirection = 1;
      this.targetCruiseVelocityLogPerSec = THREE.MathUtils.clamp(velLogPerSec, 0.05, 2.5);
      this.targetLogScaleMeters = this.currentLogScaleMeters;
      if (this.cruiseVelocityLogPerSec <= 0.02) {
        this.cruiseVelocityLogPerSec = this.targetCruiseVelocityLogPerSec * 0.45;
      }
    }
    if (this.autoZoomDirection !== 0 && !this.seamlessZoomActive) {
      this.launchIntoCosmos(this.currentLogScaleMeters);
    }
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public stepFlightThrottle(direction: -1 | 1): number {
    const nextCruiseVel = stepFlightSpeedGear(this.targetCruiseVelocityLogPerSec, direction);
    this.setCruiseVelocity(nextCruiseVel);
    if (Math.abs(nextCruiseVel) < 0.03) {
      AudioService.playSplash();
    } else {
      AudioService.playCosmicWarp(direction > 0 ? 1.08 : 0.92);
    }
    return nextCruiseVel;
  }

  public setForwardFlightSpeed(forwardSpeed: number): void {
    const clampedForward = clampForwardFlightSpeed(forwardSpeed);
    if (clampedForward > 0.03) {
      this.lastPlayingForwardSpeed = clampedForward;
    }
    this.setCruiseVelocity(clampedForward === 0 ? 0 : -clampedForward);
  }

  public applyMediaSpeedControl(action: MediaSpeedAction): number {
    const nextVel = stepMediaSpeedControl(
      this.targetCruiseVelocityLogPerSec,
      action,
      this.lastPlayingForwardSpeed
    );
    if (nextVel < -0.03) {
      this.lastPlayingForwardSpeed = Math.abs(nextVel);
    }
    this.setCruiseVelocity(nextVel);
    if (Math.abs(nextVel) < 0.03) {
      AudioService.playSplash();
    } else {
      AudioService.playCosmicWarp(nextVel < 0 ? 1.12 : 0.9);
    }
    return nextVel;
  }

  public setFlightTrajectory(mode: FlightTrajectoryMode): void {
    this.flightTrajectory = mode === 'spiral' ? 'spiral' : 'straight';
    AudioService.playCoin();
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public engageAutoLanding(): void {
    this.autoLandTargetMode = 'sanctuary';
    this.engageForestLandingDescent();
  }

  public engageCapytorioLanding(): void {
    this.autoLandTargetMode = 'capytorio';
    this.engageForestLandingDescent();
  }

  private engageForestLandingDescent(): void {
    if (!this.surfaceWorldsBuilt) {
      this.ensureSurfaceWorldsBuilt();
    }
    this.seamlessZoomActive = true;
    this.autoLandAtForestPending = true;
    this.vesselMode = 'chase_pod';
    this.chronoVessel?.setMode('chase_pod');
    // Hyper-warp cleanly into orbital island-approach altitude when descending from deep cosmos (> log 3.6) or sub-quantum (< log -1.2)
    // so Play CTA triggers a crisp ~1.2s orbital dive onto the pad without deep-void or upper-planet shader stalls.
    if (this.currentLogScaleMeters > 3.6) {
      this.currentLogScaleMeters = 2.75;
    } else if (this.currentLogScaleMeters < -1.2) {
      this.currentLogScaleMeters = -0.4;
    }
    const delta = CAPYBARA_FOREST_LOG_METERS - this.currentLogScaleMeters;
    const dir: -1 | 1 = delta >= 0 ? 1 : -1;
    const landingSpeed = THREE.MathUtils.clamp(Math.abs(delta) * 0.95, 1.35, 2.6);
    this.autoZoomDirection = dir;
    this.targetCruiseVelocityLogPerSec = dir * landingSpeed;
    this.cruiseVelocityLogPerSec =
      dir * Math.max(0.95, Math.min(landingSpeed, Math.abs(this.cruiseVelocityLogPerSec) || 1.1));
    this.targetLogScaleMeters = CAPYBARA_FOREST_LOG_METERS;
    AudioService.playCosmicWarp(1.35);
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public launchIntoCosmos(
    targetLogMeters: number = 22.0,
    sourceMode: 'sanctuary' | 'capytorio' = 'sanctuary'
  ): void {
    if (this.placementGhost.active) {
      this.cancelBuildingPlacementGhost(true);
    }
    const clampedTarget = THREE.MathUtils.clamp(
      targetLogMeters,
      MIN_UNIVERSE_LOG_METERS,
      MAX_UNIVERSE_LOG_METERS
    );
    this.lastLaunchSourceMode = sourceMode;
    this.capytorioPlanetFadeActive = false;
    if (!this.seamlessZoomActive) {
      this.seamlessZoomActive = true;
      this.dockedChronoVesselVisible = false;
      this.currentLogScaleMeters =
        sourceMode === 'capytorio'
          ? Math.max(CAPYTORIO_ORBIT_HANDOFF_LOG_METERS, this.currentLogScaleMeters)
          : Math.max(CAPYBARA_FOREST_LOG_METERS, this.currentLogScaleMeters);
      this.performanceLog.notifyTransitionWarmup(4);
      if (sourceMode === 'capytorio') {
        this.cosmicOrbitYaw = 0;
        this.cosmicOrbitPitch = 1.18;
      } else {
        // Match departure orbit yaw cleanly to current player look heading so liftoff doesn't flip the camera
        this.cosmicOrbitYaw = this.surfaceCamYaw - Math.PI;
        this.cosmicOrbitPitch = THREE.MathUtils.clamp(this.surfaceCamPitch, 0.16, 1.05);
      }
    }
    this.resetDescentRings();
    this.autoLandAtForestPending = false;
    this.autoLandTargetMode = sourceMode;
    this.vesselMode = 'chase_pod';
    this.chronoVessel?.setMode('chase_pod');
    this.targetLogScaleMeters = clampedTarget;
    this.autoZoomDirection = 0;
    AudioService.playCosmicWarp(1.1);
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public applyProceduralConfig(
    cfg: ProceduralGameConfig,
    regenerate: boolean = false
  ): void {
    this.proceduralConfig = cloneProceduralConfig(cfg);
    this.proceduralPrng = mulberry32(this.proceduralConfig.meta.seed);

    const oceanHex = parseHexColorString(cfg.universe.planetBiome.oceanColorHex, 0x0284c7);
    const landHex = parseHexColorString(cfg.universe.planetBiome.landColorHex, 0x4ade80);
    const atmoHex = parseHexColorString(cfg.universe.planetBiome.atmosphereColorHex, 0x38bdf8);
    const grassPrimaryHex = parseHexColorString(cfg.world.grassPrimaryHex, 0x4d9b3b);
    const waterHex = parseHexColorString(cfg.world.waterColorHex, 0x06b6d4);
    const cherenkovHex = parseHexColorString(cfg.player.vesselCherenkovHex, 0x06b6d4);
    const brassHex = parseHexColorString(cfg.player.vesselBrassHex, 0xeab308);
    const canopyHex = parseHexColorString(cfg.player.vesselCanopyHex, 0x38bdf8);
    const furPrimaryHex = parseHexColorString(cfg.player.furPrimaryHex, 0xb47442);
    const furSecondaryHex = parseHexColorString(cfg.player.furSecondaryHex, 0x6d3f1d);

    this.seamlessUniverse.applyProceduralConfig({
      bigBangSpeed: cfg.universe.bigBangSpeed,
      fineStructureInverse: cfg.universe.fineStructureInverse,
      oceanColorHex: oceanHex,
      landColorHex: landHex,
      atmosphereColorHex: atmoHex,
      cloudDensity: cfg.universe.planetBiome.cloudDensity,
      ringSystemEnabled: cfg.universe.planetBiome.ringSystemEnabled,
      grassPrimaryHex,
      waterColorHex: waterHex,
    });

    const heroIdx = PLAYABLE_CAPY_HEROES.findIndex((h) => h.id === cfg.player.heroArchetypeId);
    if (heroIdx >= 0) {
      this.selectedCapyHeroIndex = heroIdx;
      this.activeHeroSpec = PLAYABLE_CAPY_HEROES[heroIdx];
    }
    const resolvedSkin = cfg.player.activeSkin || this.activeHeroSpec.skin || 'classic';
    const resolvedHat = cfg.player.activeHat || this.activeHeroSpec.hat || 'yuzu';
    this.activeHeadOrangeIndex = CapyModelGenerator.skinDefaultOrangeIndex[resolvedSkin] ?? 0;
    const pilotOrange = HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex] ?? HEAD_ORANGE_VARIETIES[0];

    this.stats.activeSkin = resolvedSkin;
    this.stats.activeHat = resolvedHat;
    this.syncDachshundSkinAndOrange(furPrimaryHex);

    this.chronoVessel?.applyConfig({
      vesselScale: cfg.player.vesselScale,
      vesselCherenkovHex: cherenkovHex,
      vesselBrassHex: brassHex,
      vesselCanopyHex: canopyHex,
      furPrimaryHex,
      furSecondaryHex,
      pilotHat: resolvedHat,
      pilotOrangeHex: pilotOrange.colorHex,
    });

    if (
      this.seamlessZoomActive &&
      this.vesselMode !== 'landed' &&
      (cfg.player.startingVesselMode === 'chase_pod' ||
        cfg.player.startingVesselMode === 'telescope_first_person')
    ) {
      this.vesselMode = cfg.player.startingVesselMode;
      this.chronoVessel?.setMode(cfg.player.startingVesselMode);
    }

    const trampolineLevelSum = Math.max(1, this.getBuildingLevelSum('trampoline_pad'));
    this.physicsBridge?.setPhysicsTuning({
      seesawStiffnessScale: cfg.districts.fallguys.seesawStiffness,
      waterWaveSpeedScale: cfg.world.waterWaveSpeed,
      fluidViscosityScale: cfg.universe.fluidViscosity,
      trampolineBoostMultiplier: 1.0 + Math.max(0, trampolineLevelSum - 1) * 0.1,
    });

    if (this.oceanMesh) {
      (this.oceanMesh.material as THREE.MeshPhysicalMaterial).color.setHex(oceanHex);
    }
    if (this.sanctuaryIslandMesh) {
      (this.sanctuaryIslandMesh.material as THREE.MeshStandardMaterial).color.setHex(
        grassPrimaryHex
      );
    }
    if (this.sporeWaterMat) {
      this.sporeWaterMat.color.setHex(waterHex);
    }
    if (this.homePool?.waterMesh) {
      (this.homePool.waterMesh.material as THREE.MeshPhysicalMaterial).color.setHex(waterHex);
    }

    this.activeBiome = {
      ...this.activeBiome,
      skyHex: atmoHex,
      fogHex: atmoHex,
      oceanHex,
      islandGrassHex: grassPrimaryHex,
      gravityMultiplier: cfg.player.gravityScale,
    };

    // Update GPU exposure / bloom / palette & atmosphere time/weather
    this.gpuEngine?.applyConfig({
      exposure: cfg.graphics.exposure,
      bloomStrength: cfg.graphics.bloomIntensity,
    });
    this.settings = {
      ...this.settings,
      gpuExposure: cfg.graphics.exposure,
      gpuBloomStrength: cfg.graphics.bloomIntensity,
      astrophysicsPalette: cfg.graphics.astrophysicsPalette,
      timeOfDayHours: cfg.world.timeOfDayHours,
      weatherMode: cfg.world.weather,
    };

    if (cfg.economy.unlockAllSectors || cfg.economy.unlockAllInstruments) {
      this.allFeaturesUnlockedOverride = true;
    }

    // Update companion buddy count visibility immediately
    const desiredBuddies = this.getDesiredBuddyCount();
    for (let i = 0; i < this.sanctuaryCapys.length; i++) {
      this.sanctuaryCapys[i].capy.visible = i < desiredBuddies;
    }

    // Seed starting snake length if greater than current and reset starting conditions on regenerate
    if (regenerate) {
      // Regenerate Sanctuary wildflowers & pebbles deterministically with proceduralPrng
      if (this.sanctuaryDecorMesh) {
        const grassAccHex = parseHexColorString(cfg.world.grassAccentHex, 0x7cc444);
        const palette = [grassAccHex, 0xfef08a, 0xf472b6, 0x93c5fd, 0xd8b4fe];
        let placed = 0;
        let cand = 0;
        while (placed < 64 && cand < 360) {
          const r = 4.2 + this.proceduralPrng() * 27.5;
          const theta = this.proceduralPrng() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          cand++;
          if (Math.hypot(px, pz) > 31.8) continue;
          if (this.homePool && Math.hypot(px - this.homePool.centerX, pz - this.homePool.centerZ) < 5.6) continue;
          if (Math.hypot(px - CHRONO_PAD_X, pz - CHRONO_PAD_Z) < 3.6) continue;
          let hitsStatic = false;
          for (let t = 0; t < this.sanctuaryTrees.length; t++) {
            const tr = this.sanctuaryTrees[t];
            if (Math.hypot(px - tr.x, pz - tr.z) < tr.trunkRadius + 0.85) {
              hitsStatic = true;
              break;
            }
          }
          if (hitsStatic) continue;
          _dummyObj.position.set(px, 0.05, pz);
          _dummyObj.scale.setScalar(0.65 + this.proceduralPrng() * 0.65);
          _dummyObj.rotation.set(0, theta, 0);
          _dummyObj.updateMatrix();
          this.sanctuaryDecorMesh.setMatrixAt(placed, _dummyObj.matrix);
          _colorHelper.setHex(palette[placed % palette.length]);
          this.sanctuaryDecorMesh.setColorAt(placed, _colorHelper);
          placed++;
        }
        this.sanctuaryDecorMesh.count = placed;
        this.sanctuaryDecorMesh.instanceMatrix.needsUpdate = true;
        if (this.sanctuaryDecorMesh.instanceColor) {
          this.sanctuaryDecorMesh.instanceColor.needsUpdate = true;
        }
      }

      // Re-seed all minigame pools deterministically without allocating new meshes/textures
      if (this.sporePoolsInitialized) this.resetSporeGame();
      if (this.runnerPoolsInitialized) this.refreshRunnerCircuitGates();
      if (this.fallGuysInitialized) this.resetFallGuysGame(false);
      if (this.surfaceWorldsBuilt) {
        this.sanitizeBuildingNonClipping();
        this.refreshSanctuaryBuildings();
      } else {
        this.pendingProceduralConfigSync = true;
      }
    }

    this.applyFogSetting();
    this.invalidateZoomThumbnails();
    this.emitTelemetry();
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public selectCapyHero(index: number, confirmAndPlay: boolean = false) {
    this.ensureSurfaceWorldsBuilt();
    this.selectedCapyHeroIndex = THREE.MathUtils.clamp(
      index,
      0,
      PLAYABLE_CAPY_HEROES.length - 1
    );
    this.activeHeroSpec = PLAYABLE_CAPY_HEROES[this.selectedCapyHeroIndex];

    // Update 3D selection ring highlights
    this.selectableCapyRings.forEach((ring, idx) => {
      const mat = ring.material as THREE.MeshBasicMaterial;
      const isSelected = idx === this.selectedCapyHeroIndex;
      mat.color.setHex(isSelected ? 0xfacc15 : 0x38bdf8);
      mat.opacity = isSelected ? 0.95 : 0.38;
      ring.scale.setScalar(isSelected ? 1.18 : 1.0);
    });

    // Synchronize Head Orange color & Dachshund coat with selected Capybara hero
    this.activeHeadOrangeIndex =
      CapyModelGenerator.skinDefaultOrangeIndex[this.activeHeroSpec.skin] ?? 0;
    const heroOrange = HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex];

    CapyModelGenerator.updateCapyAppearance(
      this.heroCapy,
      this.activeHeroSpec.hat,
      this.activeHeroSpec.skin,
      this.activeHeroSpec.mutations,
      heroOrange.colorHex
    );
    this.stats.activeSkin = this.activeHeroSpec.skin;
    this.stats.activeHat = this.activeHeroSpec.hat;
    this.syncDachshundSkinAndOrange();

    AudioService.playCoin();

    if (confirmAndPlay) {
      AudioService.playPrestigeFanfare();
      this.setCosmicStage('playing');
      this.resetDachshundTrail();
      this.updateDachshundTransforms(0);
      const landingTarget = this.pendingLandingPlayStyle;
      this.pendingLandingPlayStyle = 'sanctuary';
      if (landingTarget && landingTarget !== 'sanctuary') {
        this.switchMode(landingTarget, true);
      }
    } else {
      this.emitCosmicState();
    }
  }

  public confirmSelectedCapyHero() {
    this.selectCapyHero(this.selectedCapyHeroIndex, true);
  }

  public stepCosmicBack() {
    if (this.cosmicStage === 'capy_selection') {
      this.setCosmicStage('planet_orbit');
    } else if (this.cosmicStage === 'planet_orbit') {
      this.setCosmicStage('star_system_view');
    } else if (this.cosmicStage === 'star_system_view') {
      this.setCosmicStage('galaxy_view');
    } else if (this.cosmicStage === 'galaxy_view') {
      this.setCosmicStage('universe_flight');
    }
  }

  public handleCanvasTapRaycast(ndcX: number, ndcY: number): boolean {
    if (this.seamlessZoomActive) {
      if (Math.abs(this.currentLogScaleMeters - CAPYBARA_FOREST_LOG_METERS) <= 0.9) {
        this.resumeSurfacePlayFromForest(false);
        this.isJumping = true;
        return true;
      }
      if (this.currentLogScaleMeters >= 26.5 && this.cosmicStage === 'singularity') {
        this.triggerBigBang();
        return true;
      }
      return false;
    }
    if (this.cosmicStage === 'singularity') {
      this.triggerBigBang();
      return true;
    }
    _pointerNdc.set(ndcX, ndcY);
    _raycaster.setFromCamera(_pointerNdc, this.camera);

    if (this.cosmicStage === 'big_bang') {
      const perturbed = this.cosmicBuilder.handleBigBangRaycastPerturbation(
        _raycaster,
        this.camera
      );
      if (perturbed) {
        AudioService.playCosmicWarp(1.12);
        this.emitCosmicState();
        return true;
      }
      return false;
    }

    if (this.cosmicStage === 'capy_selection') {
      const hits = _raycaster.intersectObjects(this.selectableCapyHitMeshes, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData?.index;
        if (typeof idx === 'number') {
          this.selectCapyHero(idx, false);
          return true;
        }
      }
      return false;
    }

    if (this.cosmicStage !== 'playing') {
      const hits = _raycaster.intersectObjects(this.cosmicBuilder.clickableObjects, false);
      if (hits.length > 0) {
        const { cosmicType, index } = hits[0].object.userData || {};
        if (cosmicType === 'galaxy' && typeof index === 'number') {
          this.selectGalaxy(index);
          return true;
        }
        if (cosmicType === 'star' && typeof index === 'number') {
          this.selectStarSystem(index);
          return true;
        }
        if (cosmicType === 'planet' && typeof index === 'number') {
          this.selectPlanet(index);
          return true;
        }
        if (cosmicType === 'asteroid_belt') {
          this.selectAsteroidBelt();
          return true;
        }
        if (cosmicType === 'landing' && typeof index === 'number') {
          this.selectLandingSpot(index);
          return true;
        }
      }
    }

    // Interactive Sanctuary Building Placement Ghost confirmation on canvas tap
    if (
      this.cosmicStage === 'playing' &&
      this.currentMode === 'sanctuary' &&
      this.placementGhost.active &&
      this.placementGhost.type
    ) {
      this.updateBuildingPlacementGhostFromNdc(ndcX, ndcY);
      if (this.placementGhost.valid) {
        const { type, name, x, z, description } = this.placementGhost;
        this.cancelBuildingPlacementGhost();
        this.callbacks.onBuildingGhostConfirmed?.(type, name, x, z, description);
      } else {
        AudioService.playSplash();
        this.callbacks.onModeNotification?.(
          'Placement blocked — choose open meadow turf clear of trees & Home Pool'
        );
      }
      return true;
    }

    return false;
  }

  private emitCosmicState() {
    this.callbacks.onCosmicStateChange?.(
      this.cosmicStage,
      this.selectedGalaxyIndex,
      this.selectedStarIndex,
      this.selectedPlanetIndex,
      this.selectedLandingIndex,
      this.selectedCapyHeroIndex,
      this.cosmicBuilder ? this.cosmicBuilder.getFlashIntensity() : 0
    );
  }

  // ============================================================================
  // 1. PHOTOREALISTIC SANCTUARY, HOME POOL & EXPONENTIAL FRUIT TREES (WORLD 0, 0)
  // ============================================================================
  private buildSanctuary() {
    const sandTex = RealisticWorldEnvironment.getTextureSet('sand');
    const grassTex = RealisticWorldEnvironment.getTextureSet('grass');
    const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');

    // Photorealistic PBR Rippled Sand Beach Ring (Tangent-Space Normal + Roughness + Cavity AO)
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      map: sandTex.albedo,
      normalMap: sandTex.normal,
      normalScale: new THREE.Vector2(0.72, 0.72),
      roughnessMap: sandTex.roughness,
      aoMap: sandTex.ao,
      aoMapIntensity: 0.68,
      roughness: 0.86,
      metalness: 0.02,
    });
    this.worldEnv.registerWettableMaterial(beachMat, 0.86);
    const beachGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.CylinderGeometry(36.5, 38.5, 1.5, 48)
    );
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.position.set(0, -0.9, 0);
    beach.receiveShadow = true;
    beach.userData.ignoreCameraFade = true;
    this.sanctuaryBeachMesh = beach;
    this.sanctuaryGroup.add(beach);

    // Photorealistic PBR Meadow Pasture Island (Tangent-Space Normal + Roughness + Cavity AO)
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x86efac,
      map: grassTex.albedo,
      normalMap: grassTex.normal,
      normalScale: new THREE.Vector2(0.78, 0.78),
      roughnessMap: grassTex.roughness,
      aoMap: grassTex.ao,
      aoMapIntensity: 0.74,
      roughness: 0.82,
      metalness: 0.02,
    });
    this.worldEnv.registerWettableMaterial(islandMat, 0.82);
    const islandGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.CylinderGeometry(34.5, 30.0, 4, 48)
    );
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.set(0, -2, 0);
    island.receiveShadow = true;
    island.userData.ignoreCameraFade = true;
    this.sanctuaryIslandMesh = island;
    this.sanctuaryGroup.add(island);

    // --- CAPYBARA HOME POOL WITH RUNNING TAP WATER & OVERFLOW SPLASH MESS ---
    this.homePool = this.worldEnv.createHomePool(-8.8, 3.0);
    this.sanctuaryGroup.add(this.homePool.group);
    if (this.isSoftwareGl) {
      this.homePool.lanternLight.visible = false;
      this.homePool.group.remove(this.homePool.lanternLight);
    } else {
      const lanternWorldPos = new THREE.Vector3();
      this.homePool.group.updateMatrixWorld(true);
      this.homePool.lanternLight.getWorldPosition(lanternWorldPos);
      this.homePool.group.remove(this.homePool.lanternLight);
      this.homePool.lanternLight.position.copy(lanternWorldPos);
      this.scene.add(this.homePool.lanternLight);
    }

    // --- 8 PROCEDURAL EXPONENTIAL FRUIT TREES (Strictly Spaced for Zero Canopy/Root/Pool Clipping!) ---
    // Note: NO loose ground fruits are spawned initially! Fruits ONLY spawn onto the ground
    // when bumping into a matching-color tree!
    const treeBlueprints: Array<{
      tier: number;
      x: number;
      z: number;
      matchesHead: boolean;
      altOffset: number;
    }> = [
      // Tier 0 Matching Sapling (scale 1.00x, crown 1.42m) directly ahead of Hero spawn (0, 0, 4) facing -Z!
      { tier: 0, x: 0.0, z: 0.9, matchesHead: true, altOffset: 0 },
      // Tier 1 Matching Young Tree (scale 1.48x, crown 2.10m)
      { tier: 1, x: 6.2, z: -2.6, matchesHead: true, altOffset: 0 },
      // Tier 2 Matching Orchard Tree (scale 2.19x, crown 3.11m)
      { tier: 2, x: 13.6, z: -9.2, matchesHead: true, altOffset: 0 },
      // Tier 3 Matching Ancient Tree (scale 3.24x, crown 4.60m — 14.8m clear of Home Pool!)
      { tier: 3, x: -14.2, z: -10.8, matchesHead: true, altOffset: 0 },
      // Tier 4 Matching Colossus World-Tree (scale 4.80x, crown 6.81m — 16.8m clear of Tier 3 & portals!)
      { tier: 4, x: 1.4, z: -17.0, matchesHead: true, altOffset: 0 },
      // 3 Contrasting-Variety Trees (bumping non-matching trees sways canopy without spawning fruits!)
      { tier: 0, x: 8.6, z: 6.8, matchesHead: false, altOffset: 1 },
      { tier: 1, x: -19.5, z: -2.4, matchesHead: false, altOffset: 2 },
      { tier: 2, x: -14.8, z: 12.6, matchesHead: false, altOffset: 3 },
    ];

    this.sanctuaryTrees = [];
    for (let i = 0; i < treeBlueprints.length; i++) {
      const bp = treeBlueprints[i];
      const vIdx = bp.matchesHead
        ? this.activeHeadOrangeIndex
        : (this.activeHeadOrangeIndex + bp.altOffset) % HEAD_ORANGE_VARIETIES.length;
      const tree = this.worldEnv.createExponentialTree(
        i,
        bp.tier,
        bp.x,
        bp.z,
        bp.matchesHead,
        vIdx
      );
      this.sanctuaryGroup.add(tree.rootGroup);
      this.sanctuaryTrees.push(tree);
    }

    // Group holding dynamically spawned 3D Physics Fruits (falling, bouncing, rolling & pond-floating)
    this.fruitsGroup.name = 'PhysicsRollingFruitsGroup';
    this.sanctuaryGroup.add(this.fruitsGroup);

    // 4 Interactive 3D World Portals along the outer northern perimeter (zero overlap with Tier 3/4 canopies)
    const bridgeRotY = (targetMode: PlayStyle, fallback: number): number => {
      const b = CONTIGUOUS_BRIDGES.find((item) => item.targetMode === targetMode);
      return b ? Math.atan2(b.dirX, b.dirZ) : fallback;
    };

    const portalSpecs: Array<{
      mode: PlayStyle;
      title: string;
      sub: string;
      color: number;
      accent: string;
      x: number;
      z: number;
      rotY: number;
    }> = [
      {
        mode: 'spore',
        title: 'SPORE',
        sub: 'NW CAUSEWAY',
        color: 0x06b6d4,
        accent: '#22d3ee',
        x: -20.5,
        z: -20.5,
        rotY: bridgeRotY('spore', Math.atan2(-1, -1)),
      },
      {
        mode: 'capytorio',
        title: 'CAPYTORIO',
        sub: 'FAR HEMISPHERE',
        color: 0xf59e0b,
        accent: '#fbbf24',
        x: 20.5,
        z: -20.5,
        rotY: Math.atan2(1, -1),
      },
      {
        mode: 'runner',
        title: 'STAMPEDE',
        sub: 'SW CAUSEWAY',
        color: 0xf59e0b,
        accent: '#fbbf24',
        x: -20.5,
        z: 20.5,
        rotY: bridgeRotY('runner', Math.atan2(-89.5, 121.0)),
      },
      {
        mode: 'fallguys',
        title: 'PARKOUR',
        sub: 'SE CAUSEWAY',
        color: 0xec4899,
        accent: '#f472b6',
        x: 20.5,
        z: 20.5,
        rotY: bridgeRotY('fallguys', Math.atan2(89.5, 121.5)),
      },
    ];

    for (const p of portalSpecs) {
      const portalMesh = CapyModelGenerator.createWorldPortal(p.title, p.sub, p.color, p.accent);
      portalMesh.position.set(p.x, 0, p.z);
      portalMesh.rotation.y = p.rotY;
      portalMesh.userData.__occluderRoot = portalMesh;
      this.sanctuaryGroup.add(portalMesh);
      this.sanctuaryPortals.push({
        mesh: portalMesh,
        mode: p.mode,
        x: p.x,
        z: p.z,
        rotY: p.rotY,
      });
    }

    // Pre-warm/plant Future Capybara Chrono-Vessel Landing Pad on open Sanctuary meadow (9.8, 12.6)
    this.chronoPad = createSanctuaryChronoPad(CHRONO_PAD_X, CHRONO_PAD_Z);
    this.chronoPad.group.userData.ignoreCameraFade = true;
    this.sanctuaryGroup.add(this.chronoPad.group);
    if (this.isSoftwareGl) {
      this.chronoPad.beaconLight.visible = false;
      this.chronoPad.group.remove(this.chronoPad.beaconLight);
    } else {
      this.chronoPad.group.remove(this.chronoPad.beaconLight);
      this.chronoPad.beaconLight.position.set(CHRONO_PAD_X, 0.85, CHRONO_PAD_Z);
      this.scene.add(this.chronoPad.beaconLight);
    }

    // Instanced textured river pebbles & meadow wildflowers placed strictly outside Pool, Trees, Portals & Chrono-Pad
    const pebbleGeo = new THREE.DodecahedronGeometry(0.22);
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: basaltTex.albedo,
      bumpMap: basaltTex.bump,
      bumpScale: 0.08,
      roughness: 0.62,
    });
    const instancedDecor = new THREE.InstancedMesh(pebbleGeo, pebbleMat, 64);
    instancedDecor.userData.ignoreCameraFade = true;
    this.sanctuaryDecorMesh = instancedDecor;
    const palette = [0xfef08a, 0xf472b6, 0x93c5fd, 0xd8b4fe, 0xe2e8f0];

    let placedPebbles = 0;
    let candidateIdx = 0;
    while (placedPebbles < 64 && candidateIdx < 320) {
      const r = 4.2 + ((candidateIdx % 64) / 64) * 27.5;
      const theta = candidateIdx * 2.39996;
      const px = Math.cos(theta) * r;
      const pz = Math.sin(theta) * r;
      candidateIdx++;

      if (Math.hypot(px, pz) > 31.8) continue;
      if (Math.hypot(px - this.homePool.centerX, pz - this.homePool.centerZ) < 5.6) continue;
      if (Math.hypot(px - CHRONO_PAD_X, pz - CHRONO_PAD_Z) < 3.6) continue;
      let hitsStatic = false;
      for (let t = 0; t < this.sanctuaryTrees.length; t++) {
        const tr = this.sanctuaryTrees[t];
        if (Math.hypot(px - tr.x, pz - tr.z) < tr.trunkRadius + 0.85) {
          hitsStatic = true;
          break;
        }
      }
      for (let p = 0; p < this.sanctuaryPortals.length; p++) {
        const po = this.sanctuaryPortals[p];
        if (Math.hypot(px - po.x, pz - po.z) < 2.6) {
          hitsStatic = true;
          break;
        }
      }
      if (hitsStatic) continue;

      _dummyObj.position.set(px, 0.05, pz);
      _dummyObj.scale.setScalar(0.72 + (placedPebbles % 5) * 0.12);
      _dummyObj.rotation.set(0, theta, 0);
      _dummyObj.updateMatrix();
      instancedDecor.setMatrixAt(placedPebbles, _dummyObj.matrix);
      _colorHelper.setHex(palette[placedPebbles % palette.length]);
      instancedDecor.setColorAt(placedPebbles, _colorHelper);
      placedPebbles++;
    }
    instancedDecor.count = placedPebbles;
    instancedDecor.instanceMatrix.needsUpdate = true;
    if (instancedDecor.instanceColor) instancedDecor.instanceColor.needsUpdate = true;
    instancedDecor.computeBoundingSphere();
    this.sanctuaryGroup.add(instancedDecor);

    // --- Dachshund-Snake Articulated Spine & Caboose Group ---
    this.dachshundGroup.name = 'DachshundSnakeBodyGroup';
    this.sanctuaryGroup.add(this.dachshundGroup);

    this.dachshundCaboose = CapyModelGenerator.createDachshundCaboose(
      this.stats.activeSkin,
      this.currentCapyLodTier
    );
    this.dachshundGroup.add(this.dachshundCaboose);

    // Start with 1 sleek Wiener-dog mid-torso segment & 1 signature Head Orange
    this.fruitsCarried = 1;
    this.eatenFruitMass = 0;
    this.snakeSegmentCount = 0;
    this.growDachshundBody(1, true);
    this.syncLogarithmicBodyLength(true);
    this.resetDachshundTrail();
    this.updateDachshundTransforms(0);

    // Pre-allocated pool of ambient wandering Capybara buddies (scaled dynamically by bamboo_grove level!)
    const skins = ['classic', 'golden', 'sakura', 'matcha'];
    const hats = ['flower', 'yuzu', 'party', 'crown'];
    const buddySpawns: Array<[number, number]> = [
      [11.8, 12.2],
      [17.5, -1.8],
      [7.8, 16.5],
      [-15.5, 16.2],
      [-21.5, 6.2],
      [18.8, 8.8],
      [-14.2, -17.0],
      [12.4, -15.6],
      [-18.2, -7.8],
      [22.0, -6.5],
      [4.5, 19.5],
      [-10.5, 19.2],
    ];
    const desiredBuddies = this.getDesiredBuddyCount();
    for (let i = 0; i < MAX_SANCTUARY_BUDDIES; i++) {
      const buddy = CapyModelGenerator.createCapybara(
        hats[i % hats.length],
        0.84,
        skins[i % skins.length],
        [],
        this.currentCapyLodTier
      );
      const [bx, bz] = buddySpawns[i % buddySpawns.length];
      buddy.position.set(bx, 0, bz);
      buddy.visible = i < desiredBuddies;
      buddy.userData.__occluderRoot = buddy;
      this.sanctuaryGroup.add(buddy);
      this.sanctuaryCapys.push({
        capy: buddy,
        target: new THREE.Vector3(bx * 0.9, 0, bz * 0.9),
        stateTimer: 1.5 + i * 0.7,
      });
    }

    this.refreshSanctuaryBuildings();
  }

  /**
   * Checks whether a candidate Sanctuary structure footprint at (x, z) is completely clear of
   * the Home Pool (basin, boulders, tap post & overflow apron), all 8 procedural trees
   * (flared buttress roots & crowns), portals, Hero spawn, and existing structures.
   */
  public isStaticSpotClearForBuilding(
    x: number,
    z: number,
    buildingRadius: number = 2.05,
    ignoreBuildingIndex: number = -1
  ): boolean {
    // Stay safely inside meadow shoreline, clear of Hero spawn (0, 4) & Chrono-Vessel Pad
    if (Math.hypot(x, z) > 29.5 - buildingRadius) return false;
    if (Math.hypot(x - 0, z - 4.0) < buildingRadius + 1.8) return false;
    if (Math.hypot(x - CHRONO_PAD_X, z - CHRONO_PAD_Z) < 3.4 + buildingRadius) return false;

    // Clear of Home Pool + rim boulders + overflow splash apron (radius 5.4m around (-8.8, 3.0))
    if (this.homePool) {
      const dPool = Math.hypot(x - this.homePool.centerX, z - this.homePool.centerZ);
      if (dPool < 5.45 + buildingRadius) return false;
    }

    // Clear of all 8 Procedural Trees (full crown & buttress root clearance so canopies/roofs never clip!)
    for (let t = 0; t < this.sanctuaryTrees.length; t++) {
      const tree = this.sanctuaryTrees[t];
      const treeClearance = Math.max(tree.trunkRadius + 1.2, tree.crownRadius * 0.92);
      if (Math.hypot(x - tree.x, z - tree.z) < treeClearance + buildingRadius) {
        return false;
      }
    }

    // Clear of 4 Northern Portals
    for (let p = 0; p < this.sanctuaryPortals.length; p++) {
      const portal = this.sanctuaryPortals[p];
      if (Math.hypot(x - portal.x, z - portal.z) < 2.8 + buildingRadius) {
        return false;
      }
    }

    // Clear of all other placed Sanctuary structures
    for (let i = 0; i < this.stats.buildings.length; i++) {
      if (i === ignoreBuildingIndex) continue;
      const other = this.stats.buildings[i];
      const otherR = other.type === 'trampoline_pad' ? 1.65 : 2.05;
      if (Math.hypot(x - other.x, z - other.z) < otherR + buildingRadius + 0.45) {
        return false;
      }
    }

    return true;
  }

  public findClearBuildingSpot(preferredIdx: number = 0): { x: number; z: number } {
    for (let step = 0; step < 260; step++) {
      const k = preferredIdx + step;
      const radius = 6.8 + (step / 260) * 21.5;
      const angle = k * 2.39996 + 0.42;
      const cx = +(Math.cos(angle) * radius).toFixed(2);
      const cz = +(Math.sin(angle) * radius).toFixed(2);
      if (this.isStaticSpotClearForBuilding(cx, cz, 2.05, -1)) {
        return { x: cx, z: cz };
      }
    }
    return { x: 18.5, z: 14.5 };
  }

  private sanitizeBuildingNonClipping() {
    for (let i = 0; i < this.stats.buildings.length; i++) {
      const b = this.stats.buildings[i];
      const bRad = b.type === 'trampoline_pad' ? 1.65 : 2.05;
      if (!this.isStaticSpotClearForBuilding(b.x, b.z, bRad, i)) {
        for (let step = 0; step < 260; step++) {
          const radius = 6.8 + (step / 260) * 21.5;
          const angle = (i * 7 + step) * 2.39996 + 0.35;
          const cx = +(Math.cos(angle) * radius).toFixed(2);
          const cz = +(Math.sin(angle) * radius).toFixed(2);
          if (this.isStaticSpotClearForBuilding(cx, cz, bRad, i)) {
            b.x = cx;
            b.z = cz;
            break;
          }
        }
      }
    }
  }

  public refreshSanctuaryBuildings() {
    const toRemove: THREE.Object3D[] = [];
    this.sanctuaryGroup.children.forEach((child) => {
      if (child.name.startsWith('building_')) toRemove.push(child);
    });
    toRemove.forEach((c) => {
      this.sanctuaryGroup.remove(c);
      disposeObject3DTree(c);
    });
    this.sanctuaryBuildingMeshes = [];

    // Guarantee zero overlap between buildings (including legacy saved coordinates), trees & Home Pool
    this.sanitizeBuildingNonClipping();

    this.stats.buildings.forEach((b) => {
      const bMesh = CapyModelGenerator.createBuildingByType(b.type, b.level);
      bMesh.name = `building_${b.id}`;
      bMesh.position.set(b.x, 0, b.z);
      const levelScale = 1 + Math.min(0.5, (b.level - 1) * 0.08);
      bMesh.scale.setScalar(levelScale);
      bMesh.userData.buildingType = b.type;
      bMesh.userData.__occluderRoot = bMesh;
      this.sanctuaryBuildingMeshes.push(bMesh);
      this.sanctuaryGroup.add(bMesh);
    });

    const desiredBuddies = this.getDesiredBuddyCount();
    for (let i = 0; i < this.sanctuaryCapys.length; i++) {
      this.sanctuaryCapys[i].capy.visible = i < desiredBuddies;
    }
    const trampSum = Math.max(1, this.getBuildingLevelSum('trampoline_pad'));
    this.physicsBridge?.setPhysicsTuning({
      trampolineBoostMultiplier: 1.0 + Math.max(0, trampSum - 1) * 0.1,
    });

    this.syncWorldPhysicsColliders();
    this.invalidateZoomThumbnails('capybara_forest');
  }

  public syncWorldPhysicsColliders() {
    if (!this.physicsBridge) return;
    const circles: StaticCircleColliderSpec[] = [];
    const boxes: StaticBoxColliderSpec[] = [];
    const softPads: Array<{ id: string; wx: number; wy: number; wz: number; radius: number }> = [
      {
        id: 'fallguys_launch_pad',
        wx: ZONE_LOCATIONS.fallguys.x,
        wy: 0.5,
        wz: ZONE_LOCATIONS.fallguys.z - 46.0,
        radius: 4.5,
      },
    ];

    for (let t = 0; t < this.sanctuaryTrees.length; t++) {
      const tr = this.sanctuaryTrees[t];
      circles.push({
        id: `tree_${t}`,
        wx: tr.x,
        wz: tr.z,
        radius: tr.trunkRadius,
        height: 4.5,
        restitution: 0.35,
        kind: 'tree',
      });
    }

    if (this.homePool) {
      this.physicsBridge.setHomePoolSpec({
        x: this.homePool.centerX,
        z: this.homePool.centerZ,
        radius: this.homePool.basinRadius,
        waterY: this.homePool.waterMesh.position.y,
      });
      for (let r = 0; r < this.homePool.rimColliders.length; r++) {
        const rock = this.homePool.rimColliders[r];
        circles.push({
          id: `rim_${r}`,
          wx: rock.x,
          wz: rock.z,
          radius: rock.radius,
          height: 1.4,
          restitution: 0.25,
          kind: 'boulder',
        });
      }
    }

    for (let bIdx = 0; bIdx < this.stats.buildings.length; bIdx++) {
      const b = this.stats.buildings[bIdx];
      if (b.type === 'trampoline_pad') {
        softPads.push({
          id: `pad_${b.id}`,
          wx: b.x,
          wy: 0.12,
          wz: b.z,
          radius: 1.95,
        });
      } else {
        circles.push({
          id: `bld_${b.id}`,
          wx: b.x,
          wz: b.z,
          radius: 1.48,
          height: 3.5,
          restitution: 0.2,
          kind: 'building',
        });
      }
    }
    this.physicsBridge.syncStaticWorldColliders(circles, boxes, softPads);
  }

  public getPhysicsTelemetry(): PhysicsEngineTelemetry {
    return this.physicsBridge.getTelemetry();
  }

  public getGpuEngineTelemetry(): GpuEngineTelemetry {
    return this.gpuEngine.getTelemetry();
  }

  public getPerformanceLogSnapshot(): PerformanceLogSnapshot {
    return this.performanceLog.getSnapshot(Date.now());
  }

  public clearPerformanceLog(): void {
    this.performanceLog.clear(Date.now());
  }

  public isPerformanceAnalysisEnabled(): boolean {
    return this.profiler.isEnabled();
  }

  public setPerformanceAnalysisEnabled(enabled: boolean): void {
    this.profiler.setEnabled(enabled);
  }

  public getPerformanceAnalysisSnapshot(): PerformanceAnalysisSnapshot {
    return this.profiler.getTelemetrySnapshot();
  }

  public formatPerformanceAnalysisReport(): string {
    return this.profiler.formatAnalysisReport();
  }

  public generatePerformanceDebugReport(mode: 'summary' | 'detail' | 'analysis' = 'summary'): string {
    if (mode === 'analysis') {
      return this.profiler.formatAnalysisReport();
    }

    const perf = this.performanceLog.getSnapshot(Date.now());
    const gpu = this.gpuEngine.getTelemetry();
    const rInfo = (this.renderer as unknown as {
      info?: {
        render?: { calls?: number; triangles?: number; lines?: number; points?: number; frame?: number };
        memory?: { geometries?: number; textures?: number };
      };
    })?.info;

    const capLabel = perf.maxFpsLimit > 0 ? `${perf.maxFpsLimit}` : 'Unlim';
    const disabledStr =
      perf.disabledFeatures.length > 0 ? perf.disabledFeatures.join(', ') : 'None (Full Quality)';

    if (mode === 'summary') {
      const sLines: string[] = [];
      sLines.push('=== CAPYGAME 3D PERF SUMMARY ===');
      sLines.push(`Target: ${perf.fpsTarget} FPS | Max Cap: ${capLabel} (AutoOpt: ${perf.autoOptimizerEnabled ? `ON T${perf.activeGovernorTier}` : 'OFF'})`);
      sLines.push(`Live: ${perf.liveFps} | Avg: ${perf.avgFps} | Min: ${perf.minFps} | Drops: ${perf.droppedFramesCount} | Avg ${perf.avgFrameMs}ms / P95 ${perf.p95FrameMs}ms / Spike ${perf.maxFrameMs}ms`);
      sLines.push(`Scene: ${this.currentMode} · ${this.cosmicStage} | Scale: ${this.currentLogScaleMeters.toFixed(1)} log-m (T+${computeCosmicAgeGyr(this.currentLogScaleMeters).toFixed(2)} Gyr)`);
      sLines.push(`Vessel: ${this.vesselMode} | Velocity: ${this.cruiseVelocityLogPerSec.toFixed(1)} log/s`);
      sLines.push(`GPU: ${gpu.backendLabel} (${gpu.webGpuAdapterName || (gpu.gpuRenderer ? gpu.gpuRenderer.slice(0, 32) : 'Default')}) | Preset: ${gpu.qualityPreset}`);
      if (gpu.backendBenchmarkSummary) {
        sLines.push(`Auto-Bench: ${gpu.backendBenchmarkSummary}`);
      }
      sLines.push(`Pipeline: Shadows ${gpu.shadowCasterMode.toUpperCase()} (${gpu.shadowMapSize}px) | Bloom: ${gpu.bloomEnabled ? 'ON' : 'OFF'} | SSAO: ${gpu.ssaoEnabled ? 'ON' : 'OFF'} | AA: ${gpu.antiAliasing} | Scale: ${gpu.resolutionScale}x (DPR ${gpu.effectivePixelRatio})`);
      sLines.push(`Opt Cuts: ${disabledStr}`);
      const heapStr =
        gpu.jsHeapUsedMB !== null
          ? `${gpu.jsHeapUsedMB}/${gpu.jsHeapTotalMB ?? '?'}MB`
          : 'N/A';
      sLines.push(`Draw: ${gpu.drawCalls} calls | ${(rInfo?.render?.triangles ?? gpu.triangles).toLocaleString()} tris | Geo/Tex: ${rInfo?.memory?.geometries ?? gpu.geometriesInVram} geos, ${rInfo?.memory?.textures ?? gpu.texturesInVram} texs`);
      sLines.push(`Memory: JS Heap ${heapStr} | Est VRAM ${gpu.estimatedTotalVramMB}MB (Geo ${gpu.estimatedGeoVramMB} + Tex ${gpu.estimatedTexVramMB} + FBO ${gpu.estimatedRenderTargetVramMB})${gpu.lowMemoryModeActive ? ' [LEAN MEM]' : ''}`);
      sLines.push('Incidents:');
      if (perf.entries.length === 0) {
        sLines.push(`- Zero frame drops recorded (steady ${perf.fpsTarget} FPS target).`);
      } else {
        perf.entries.slice(0, 8).forEach((e, i) => {
          const rep = e.repeatCount && e.repeatCount > 1 ? ` [x${e.repeatCount}]` : '';
          const fpsRange = e.minFps && e.maxFps && e.minFps !== e.maxFps ? `${e.minFps}-${e.maxFps}` : `${e.fps}`;
          const timeRange = e.lastElapsedLabel && e.lastElapsedLabel !== e.elapsedLabel ? `${e.elapsedLabel}-${e.lastElapsedLabel}` : e.elapsedLabel;
          sLines.push(`- (${i + 1})${rep} T+${timeRange} | ${fpsRange} FPS (${e.maxFrameMs ?? e.frameMs}ms) | ${e.stageLabel} | ${e.cause} -> ${e.mitigation}`);
        });
      }
      sLines.push('================================');
      return sLines.join('\n');
    }

    const lines: string[] = [];
    lines.push('=== CAPYGAME 3D PERFORMANCE DEBUG REPORT ===');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Uptime: ${Math.floor(performance.now() / 1000)}s`);
    lines.push(`Target FPS: ${perf.fpsTarget} FPS | Max Cap: ${capLabel} (Auto GPU Optimizer: ${perf.autoOptimizerEnabled ? `ON Tier ${perf.activeGovernorTier}` : 'OFF'})`);
    lines.push(`Active GPU Reductions: ${disabledStr}`);
    lines.push('');
    lines.push('--- REAL-TIME PACING & FPS ---');
    lines.push(`Live FPS: ${perf.liveFps}`);
    lines.push(`Average FPS: ${perf.avgFps}`);
    lines.push(`Min FPS: ${perf.minFps}`);
    lines.push(`Avg Frame Duration: ${perf.avgFrameMs} ms`);
    lines.push(`P95 Frame Duration: ${perf.p95FrameMs} ms`);
    lines.push(`Max Frame Spike: ${perf.maxFrameMs} ms`);
    lines.push(`Total Dropped Frames: ${perf.droppedFramesCount}`);
    lines.push(`Alert Count: ${perf.alertCount}`);
    lines.push(`Last Alert: ${perf.lastAlertSummary ?? 'None'}`);
    lines.push('');
    lines.push('--- SCENE & SCALE CONTEXT ---');
    lines.push(`Current Mode: ${this.currentMode}`);
    lines.push(`Cosmic Stage: ${this.cosmicStage}`);
    lines.push(`Seamless Zoom Active: ${this.seamlessZoomActive}`);
    lines.push(`Log Scale Meters: ${this.currentLogScaleMeters.toFixed(2)} (Target: ${this.targetLogScaleMeters.toFixed(2)})`);
    lines.push(`Vessel Mode: ${this.vesselMode}`);
    lines.push(`Cruise Velocity: ${this.cruiseVelocityLogPerSec.toFixed(2)} log/s (Dir: ${this.autoZoomDirection})`);
    lines.push(`Cosmic Age: ${computeCosmicAgeGyr(this.currentLogScaleMeters).toFixed(2)} Gyr`);
    lines.push(`Buildings: ${this.stats.buildings.length} | Capy Heroes: ${PLAYABLE_CAPY_HEROES.length}`);
    lines.push('');
    lines.push('--- GRAPHICS PIPELINE & GPU TELEMETRY ---');
    lines.push(`Backend: ${gpu.backendLabel} (WebGPU Active: ${gpu.webGpuActive})`);
    if (gpu.backendBenchmarkSummary) {
      lines.push(`Auto-Bench: ${gpu.backendBenchmarkSummary}`);
    }
    lines.push(`Adapter: ${gpu.webGpuAdapterName || 'Unknown'}`);
    lines.push(`GPU Renderer: ${gpu.gpuRenderer}`);
    lines.push(`Software GL: ${gpu.isSoftwareGl}`);
    lines.push(`Quality Preset: ${gpu.qualityPreset}`);
    lines.push(`Tone Mapping: ${gpu.toneMapping} (Exposure: ${gpu.exposure.toFixed(2)})`);
    lines.push(`Shadows: ${gpu.shadowCasterMode.toUpperCase()} (Map: ${gpu.shadowMapSize}px, Quality: ${gpu.shadowQuality})`);
    lines.push(`Bloom: ${gpu.bloomEnabled ? 'ON' : 'OFF'} | SSAO/GTAO: ${gpu.ssaoEnabled ? 'ON' : 'OFF'}`);
    lines.push(`PostProcessing: ${gpu.postProcessingActive ? 'ON' : 'OFF'} | Filter: ${gpu.visualFilterLabel}`);
    lines.push(`Anti-Aliasing: ${gpu.antiAliasing} (MSAA Samples: ${gpu.msaaSamples}) | Render Scale: ${gpu.resolutionScale}x (DPR: ${gpu.effectivePixelRatio})`);
    lines.push(`Anisotropy: ${gpu.activeAnisotropy}/${gpu.maxHardwareAnisotropy}`);
    lines.push('');
    lines.push('--- THREE.JS RAM & VRAM METRICS ---');
    lines.push(`Draw Calls: ${gpu.drawCalls}`);
    lines.push(`Triangles: ${(rInfo?.render?.triangles ?? gpu.triangles).toLocaleString()}`);
    lines.push(`Lines: ${rInfo?.render?.lines ?? 0} | Points: ${rInfo?.render?.points ?? 0}`);
    lines.push(`Geometries in VRAM: ${rInfo?.memory?.geometries ?? gpu.geometriesInVram} (~${gpu.estimatedGeoVramMB} MB)`);
    lines.push(`Textures in VRAM: ${rInfo?.memory?.textures ?? gpu.texturesInVram} (~${gpu.estimatedTexVramMB} MB)`);
    lines.push(`Offscreen FBO / Shadow Targets: ~${gpu.estimatedRenderTargetVramMB} MB`);
    lines.push(`Estimated Total VRAM: ~${gpu.estimatedTotalVramMB} MB`);
    lines.push(
      `JS Heap RAM: ${gpu.jsHeapUsedMB !== null ? `${gpu.jsHeapUsedMB} MB used / ${gpu.jsHeapTotalMB ?? '?'} MB total` : 'Not exposed by browser'}`
    );
    lines.push(`Lean Memory Mode: ${gpu.lowMemoryModeActive ? 'ON (Reduced textures & pools)' : 'OFF'}`);
    lines.push(`Shader Programs: ${gpu.shaderPrograms}`);
    lines.push('');
    lines.push('--- INCIDENT LOG ENTRIES (GROUPED) ---');
    if (perf.entries.length === 0) {
      lines.push('Zero frame drops or lag spikes recorded.');
    } else {
      perf.entries.forEach((e, idx) => {
        const rep = e.repeatCount && e.repeatCount > 1 ? ` (Grouped x${e.repeatCount} instances)` : '';
        const fpsRange = e.minFps && e.maxFps && e.minFps !== e.maxFps ? `${e.minFps}-${e.maxFps}` : `${e.fps}`;
        const timeRange = e.lastElapsedLabel && e.lastElapsedLabel !== e.elapsedLabel ? `${e.elapsedLabel}-${e.lastElapsedLabel}` : e.elapsedLabel;
        lines.push(`[${idx + 1}] T+${timeRange} | ${fpsRange} FPS (Spike: ${e.maxFrameMs ?? e.frameMs} ms)${rep} | Severity: ${e.severity.toUpperCase()} | Stage: ${e.stageLabel}`);
        lines.push(`    Cause: ${e.cause}`);
        lines.push(`    Mitigation: ${e.mitigation}`);
      });
    }
    lines.push('');
    lines.push('--- CLIENT PLATFORM & RUNTIME ---');
    if (typeof navigator !== 'undefined') {
      lines.push(`User Agent: ${navigator.userAgent}`);
      lines.push(`Cores: ${navigator.hardwareConcurrency ?? 'N/A'}`);
      const devMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
      if (devMem) lines.push(`Device Memory: ~${devMem} GB`);
    }
    if (typeof window !== 'undefined') {
      lines.push(`Viewport: ${window.innerWidth}x${window.innerHeight} (DevicePixelRatio: ${window.devicePixelRatio})`);
      lines.push(`URL: ${window.location.href}`);
    }
    lines.push('=== END OF REPORT ===');

    return lines.join('\n');
  }

  public setLock60Fps(enabled: boolean): void {
    this.performanceLog.lock60FpsEnabled = enabled;
    this.settings = { ...this.settings, lock60FpsGovernor: enabled };
    if (!enabled && this.adaptiveMitigationLevel > 0) {
      this.adaptiveMitigationLevel = 0;
      this.adaptiveLowPerfStreak = 0;
      this.adaptiveRecoveryAccumSec = 0;
      this.pendingAdaptiveGpuConfig = null;
      this.performanceLog.activeGovernorTier = 0;
      this.performanceLog.disabledFeatures = [];
      this.gpuEngine?.applyConfig(this.buildEffectiveGpuConfig(this.settings, 0));
      this.gpuEngine?.render();
      if (this.settings.autoCapyLod !== false) {
        this.applyGlobalCapyLodTier(3);
      }
      this.performanceLog.notifyTransitionWarmup(2);
    }
    ProgressionService.saveSettings(this.settings);
  }

  public recordSyntheticLagSpike(frameMs: number): void {
    const stageStr = this.seamlessZoomActive
      ? this.seamlessUniverse.getBandById(
          UNIVERSE_SCALE_BANDS[findNearestScaleBandIndex(this.currentLogScaleMeters)].id
        ).title
      : this.currentMode;
    this.performanceLog.recordSyntheticLagSpike(
      frameMs,
      stageStr,
      this.performanceLog.lock60FpsEnabled
        ? 'Stepped LOD & PostFX load down to restore 60 FPS'
        : 'Logged frame drop alert'
    );
  }

  // ============================================================================
  // 2. SPORE EVOLUTION LAGOON (AT WORLD -75, -75)
  // ============================================================================
  private buildSporeWorld() {
    const sandTex = RealisticWorldEnvironment.getTextureSet('sand');
    const foliageTex = RealisticWorldEnvironment.getTextureSet('foliage');
    const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');

    const seabedGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.CylinderGeometry(42, 42, 1, 36)
    );
    const seabed = new THREE.Mesh(
      seabedGeo,
      new THREE.MeshStandardMaterial({
        color: 0x075985,
        map: sandTex.albedo,
        normalMap: sandTex.normal,
        normalScale: new THREE.Vector2(0.74, 0.74),
        roughnessMap: sandTex.roughness,
        aoMap: sandTex.ao,
        aoMapIntensity: 0.72,
        roughness: 0.52,
        metalness: 0.12,
      })
    );
    seabed.position.set(0, -0.5, 0);
    seabed.receiveShadow = true;
    seabed.userData.ignoreCameraFade = true;
    this.sporeGroup.add(seabed);

    const coralMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      map: basaltTex.albedo,
      normalMap: basaltTex.normal,
      normalScale: new THREE.Vector2(0.82, 0.82),
      roughnessMap: basaltTex.roughness,
      aoMap: basaltTex.ao,
      roughness: 0.58,
    });
    const lilyMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      map: foliageTex.albedo,
      normalMap: foliageTex.normal,
      normalScale: new THREE.Vector2(0.62, 0.62),
      roughnessMap: foliageTex.roughness,
      aoMap: foliageTex.ao,
      roughness: 0.68,
    });
    const lilyGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.CylinderGeometry(2.2, 2.2, 0.25, 16)
    );
    const coralGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.DodecahedronGeometry(0.9)
    );
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const dist = 10 + (i % 3) * 8;
      const pad = new THREE.Mesh(lilyGeo, lilyMat);
      pad.position.set(Math.cos(a) * dist, 0.08, Math.sin(a) * dist);
      pad.receiveShadow = true;
      pad.userData.ignoreCameraFade = true;
      this.sporeGroup.add(pad);

      if (i % 2 === 0) {
        const coral = new THREE.Mesh(coralGeo, coralMat);
        coral.position.set(Math.cos(a) * dist, 0.65, Math.sin(a) * dist);
        coral.castShadow = true;
        this.sporeGroup.add(coral);
      }
    }

    // Coupled rippling PBR shallow-water surface disc driven by 24x24 fluidSolver DataTexture
    this.sporeRippleTexture = RealisticWorldEnvironment.createWaterRippleDataTexture();
    const lagoonWaterHex = parseHexColorString(
      this.proceduralConfig.world.waterColorHex,
      0x0ea5e9
    );
    this.sporeWaterMat = RealisticWorldEnvironment.createRipplingWaterMaterial(
      this.sporeRippleTexture,
      {
        colorHex: lagoonWaterHex,
        opacity: 0.78,
        rippleAmp: 0.11,
        isWebGpu: this.isWebGpu,
        isSoftwareGl: this.isSoftwareGl,
      }
    );
    this.sporeWaterMesh = new THREE.Mesh(
      RealisticWorldEnvironment.createSubdividedWaterDiscGeometry(35.6, 36, 12),
      this.sporeWaterMat
    );
    this.sporeWaterMesh.position.set(0, 0.06, 0);
    this.sporeWaterMesh.renderOrder = 2;
    this.sporeWaterMesh.receiveShadow = true;
    this.sporeWaterMesh.userData.ignoreCameraFade = true;
    this.sporeGroup.add(this.sporeWaterMesh);

    this.initSporePools();
    this.resetSporeGame();
  }

  private initSporePools() {
    if (this.sporePoolsInitialized) return;
    this.sporePoolsInitialized = true;

    this.sporeOrbSphereGeo = new THREE.SphereGeometry(0.28, 10, 10);
    this.sporeOrbDnaGeo = new THREE.OctahedronGeometry(0.38, 1);
    this.sporeOrbPlanktonMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.48,
      roughness: 0.2,
    });
    this.sporeOrbDnaMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      roughness: 0.2,
    });

    for (let i = 0; i < MAX_SPORE_ORBS; i++) {
      const isDna = i % 3 === 0;
      const mesh = new THREE.Mesh(
        isDna ? this.sporeOrbDnaGeo : this.sporeOrbSphereGeo,
        isDna ? this.sporeOrbDnaMat : this.sporeOrbPlanktonMat
      );
      mesh.visible = false;
      this.sporeGroup.add(mesh);
      this.sporeOrbs.push({
        mesh,
        isDna,
        value: isDna ? 3 : 5,
        active: false,
      });
    }

    const skins = ['matcha', 'sakura', 'cosmic', 'golden'];
    for (let i = 0; i < MAX_SPORE_CRITTERS; i++) {
      const scale = 0.55 + (i % 4) * 0.32;
      const critter = CapyModelGenerator.createCapybara(
        i % 2 === 0 ? 'flower' : 'yuzu',
        scale,
        skins[i % skins.length],
        ['flippers']
      );
      critter.visible = false;
      this.sporeGroup.add(critter);
      this.sporeCritters.push({
        mesh: critter,
        scale,
        vel: new THREE.Vector3(),
        changeDirTimer: 2,
        active: false,
      });
    }
  }

  private resetSporeGame() {
    this.sporeMass = 10 + (this.stats.evolutionStage - 1) * 5;
    this.sporeDnaEarned = 0;
    this.initSporePools();

    const targetOrbs = Math.min(
      MAX_SPORE_ORBS,
      Math.max(6, Math.round(this.proceduralConfig.districts.spore.planktonCount))
    );
    const targetCritters = Math.min(
      MAX_SPORE_CRITTERS,
      Math.max(2, Math.round(this.proceduralConfig.districts.spore.critterCount))
    );

    for (let i = 0; i < this.sporeOrbs.length; i++) {
      const orb = this.sporeOrbs[i];
      if (i < targetOrbs) {
        orb.active = true;
        orb.mesh.visible = true;
        const angle = this.proceduralPrng() * Math.PI * 2;
        const rad = 2 + this.proceduralPrng() * 30;
        orb.mesh.position.set(Math.cos(angle) * rad, 0.45, Math.sin(angle) * rad);
      } else {
        orb.active = false;
        orb.mesh.visible = false;
      }
    }

    for (let i = 0; i < this.sporeCritters.length; i++) {
      const critter = this.sporeCritters[i];
      if (i < targetCritters) {
        critter.active = true;
        critter.mesh.visible = true;
        const angle = (i / targetCritters) * Math.PI * 2 + this.proceduralPrng() * 0.4;
        const rad = 8 + this.proceduralPrng() * 18;
        critter.mesh.position.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad);
        critter.vel.set(
          (this.proceduralPrng() - 0.5) * 5,
          0,
          (this.proceduralPrng() - 0.5) * 5
        );
        critter.changeDirTimer = 2 + this.proceduralPrng() * 3;
      } else {
        critter.active = false;
        critter.mesh.visible = false;
      }
    }
  }

  private spawnSporeOrb() {
    for (let i = 0; i < this.sporeOrbs.length; i++) {
      const orb = this.sporeOrbs[i];
      if (!orb.active) {
        orb.active = true;
        orb.mesh.visible = true;
        const angle = this.proceduralPrng() * Math.PI * 2;
        const rad = 2 + this.proceduralPrng() * 30;
        orb.mesh.position.set(Math.cos(angle) * rad, 0.45, Math.sin(angle) * rad);
        return;
      }
    }
  }

  // ============================================================================
  // 3. CAPYTORIO INFINITE FACTORY (FAR HEMISPHERE AT WORLD +1200, 0)
  // ============================================================================
  private ensureCapytorioRenderer(): Capytorio3DRenderer {
    if (!this.capytorioRenderer) {
      this.capytorioRenderer = new Capytorio3DRenderer();
      this.capytorioGroup.add(this.capytorioRenderer.root);
    }
    return this.capytorioRenderer;
  }

  private buildCapytorioWorld() {
    this.ensureCapytorioRenderer().sync(
      this.capytorioEngine,
      CAPYTORIO_WORLD_ORIGIN_X,
      CAPYTORIO_WORLD_ORIGIN_Z,
      0.016,
      0,
      this.capytorioGroup.visible
    );
  }

  public getCapytorioSnapshot(): CapytorioUiSnapshot {
    return this.capytorioEngine.getUiSnapshot();
  }

  private emitCapytorioSnapshot(): void {
    this.callbacks.onCapytorioChange?.(this.capytorioEngine.getUiSnapshot());
  }

  private markCapytorioDirty(): void {
    this.capytorioAutoSaveDirty = true;
    this.emitCapytorioSnapshot();
  }

  public hydrateCapytorioFromStats(nextStats: PlayerStats): void {
    if (nextStats.capytorioFactory) {
      this.capytorioEngine.hydrate(nextStats.capytorioFactory);
    } else {
      this.capytorioEngine.resetToBlankStarterField();
    }
    this.markCapytorioDirty();
  }

  public resetCapytorioToBlankField(): void {
    this.capytorioEngine.resetToBlankStarterField();
    this.markCapytorioDirty();
    this.emitTelemetry();
    AudioService.playSplash();
    this.callbacks.onModeNotification?.(
      'Capytorio Frontier reset to untouched infinite ore field with full Starter Kit!'
    );
  }

  public updateCapytorioHoverFromNdc(ndcX: number, ndcY: number): void {
    if (this.currentMode !== 'capytorio' || this.cosmicStage !== 'playing') return;
    _capyPointerNdc.set(ndcX, ndcY);
    _raycaster.setFromCamera(_capyPointerNdc, this.camera);
    const hit = _raycaster.ray.intersectPlane(_capyGroundPlane, _capyGroundHit);
    if (!hit) return;
    const nextGx = worldToCapytorioGridX(_capyGroundHit.x);
    const nextGz = worldToCapytorioGridZ(_capyGroundHit.z);
    if (
      nextGx !== this.capytorioEngine.hoveredGx ||
      nextGz !== this.capytorioEngine.hoveredGz
    ) {
      this.capytorioEngine.hoveredGx = nextGx;
      this.capytorioEngine.hoveredGz = nextGz;
      this.emitCapytorioSnapshot();
    }
  }

  public inspectCapytorioTile(gx: number, gz: number): void {
    this.capytorioEngine.inspectTileAt(gx, gz);
    this.emitCapytorioSnapshot();
  }

  public clearCapytorioInspection(): void {
    this.capytorioEngine.clearInspection();
    this.emitCapytorioSnapshot();
  }

  public mineCapytorioTileAt(gx: number, gz: number): CapytorioItemId | null {
    const mined = this.capytorioEngine.handMineAt(gx, gz, 2);
    if (mined) {
      const meta = getCapytorioItemMeta(mined);
      AudioService.playCapytorioMine(mined === 'orange' ? 'tree' : 'ore');
      this.vfxEngine?.emitBurst(
        capytorioGridToWorldX(gx),
        0.4,
        capytorioGridToWorldZ(gz),
        'citrus_burst',
        5,
        meta.colorHex
      );
      this.capytorioEngine.inspectTileAt(gx, gz);
      this.markCapytorioDirty();
      this.emitTelemetry();
    }
    return mined;
  }

  public raycastCapytorioGridFloat(
    ndcX: number,
    ndcY: number
  ): { gx: number; gz: number; fGx: number; fGz: number } | null {
    if (this.currentMode !== 'capytorio' || this.cosmicStage !== 'playing') return null;
    _capyPointerNdc.set(ndcX, ndcY);
    _raycaster.setFromCamera(_capyPointerNdc, this.camera);
    const hit = _raycaster.ray.intersectPlane(_capyGroundPlane, _capyGroundHit);
    if (!hit) return null;
    const fGx = (_capyGroundHit.x - CAPYTORIO_WORLD_ORIGIN_X) / CAPYTORIO_TILE_SIZE;
    const fGz = (_capyGroundHit.z - CAPYTORIO_WORLD_ORIGIN_Z) / CAPYTORIO_TILE_SIZE;
    const gx = Math.round(fGx);
    const gz = Math.round(fGz);
    if (
      gx !== this.capytorioEngine.hoveredGx ||
      gz !== this.capytorioEngine.hoveredGz
    ) {
      this.capytorioEngine.hoveredGx = gx;
      this.capytorioEngine.hoveredGz = gz;
    }
    return { gx, gz, fGx, fGz };
  }

  public setCapytorioClipboardMode(
    mode: CapytorioClipboardToolState,
    shape?: CapytorioSelectionShape
  ): void {
    this.capytorioEngine.setClipboardToolMode(mode, shape);
    AudioService.playCapytorioUiClick('tool');
    this.emitCapytorioSnapshot();
  }

  public clearCapytorioClipboard(): void {
    this.capytorioEngine.clearClipboard();
    this.emitCapytorioSnapshot();
  }

  public rotateCapytorioBlueprint(ccw: boolean = false): boolean {
    if (
      this.capytorioEngine.clipboardToolState !== 'paste' ||
      !this.capytorioEngine.clipboard ||
      this.capytorioEngine.clipboard.entries.length === 0
    ) {
      return false;
    }
    this.capytorioEngine.rotateBlueprint90(ccw);
    AudioService.playCapytorioRotate();
    this.emitCapytorioSnapshot();
    return true;
  }

  public flipCapytorioBlueprintHorizontal(): boolean {
    if (
      this.capytorioEngine.clipboardToolState !== 'paste' ||
      !this.capytorioEngine.clipboard ||
      this.capytorioEngine.clipboard.entries.length === 0
    ) {
      return false;
    }
    const ok = this.capytorioEngine.flipBlueprintHorizontal();
    if (ok) {
      AudioService.playCapytorioBlueprint('flip');
      this.emitCapytorioSnapshot();
    }
    return ok;
  }

  public flipCapytorioBlueprintVertical(): boolean {
    if (
      this.capytorioEngine.clipboardToolState !== 'paste' ||
      !this.capytorioEngine.clipboard ||
      this.capytorioEngine.clipboard.entries.length === 0
    ) {
      return false;
    }
    const ok = this.capytorioEngine.flipBlueprintVertical();
    if (ok) {
      AudioService.playCapytorioBlueprint('flip');
      this.emitCapytorioSnapshot();
    }
    return ok;
  }

  public activateLastCapytorioBlueprint(): boolean {
    const ok = this.capytorioEngine.activateLastBlueprint();
    if (ok) {
      AudioService.playCapytorioUiClick('tool');
      this.emitCapytorioSnapshot();
    }
    return ok;
  }

  public selectCapytorioBlueprint(id: string): CapytorioSavedBlueprint | null {
    const picked = this.capytorioEngine.selectBlueprintFromLibrary(id);
    if (picked) {
      AudioService.playCapytorioUiClick('tool');
      this.emitCapytorioSnapshot();
    }
    return picked;
  }

  public deleteCapytorioBlueprint(id: string): boolean {
    const removed = this.capytorioEngine.deleteBlueprintFromLibrary(id);
    if (removed) {
      AudioService.playCapytorioDemolish();
      this.markCapytorioDirty();
    }
    return removed;
  }

  public clearCapytorioBlueprintLibrary(): void {
    this.capytorioEngine.clearBlueprintLibrary();
    AudioService.playCapytorioDemolish();
    this.markCapytorioDirty();
  }

  public buildCapytorioSampleStarterMall(): {
    ok: boolean;
    placedCount: number;
    clearedCount: number;
    message: string;
  } {
    const res = this.capytorioEngine.buildSampleStarterMall();
    if (res.ok) {
      AudioService.playCapytorioBlueprint('paste', res.placedCount);
      this.markCapytorioDirty();
      this.emitTelemetry();
    } else {
      this.emitCapytorioSnapshot();
    }
    return res;
  }

  public async importCapytorioFactorioBlueprintString(rawInput: string) {
    const res = await this.capytorioEngine.importFactorioBlueprintString(rawInput);
    if (res.ok) {
      AudioService.playCapytorioBlueprint('copy', res.importedEntityCount);
      this.markCapytorioDirty();
    } else {
      AudioService.playCapytorioUiClick('alt_off');
      this.emitCapytorioSnapshot();
    }
    return res;
  }

  public async exportCapytorioBlueprintToFactorioString(id: string) {
    const res = await this.capytorioEngine.exportBlueprintToFactorioString(id);
    if (res.ok) {
      AudioService.playCapytorioUiClick('tool');
    }
    return res;
  }

  public async exportCapytorioFactoryToFactorioString(label?: string) {
    const res = await this.capytorioEngine.exportFactoryToFactorioString(label);
    if (res.ok) {
      AudioService.playCapytorioUiClick('tool');
    }
    return res;
  }

  public async exportCapytorioBlueprintBookToFactorioString(bookLabel?: string) {
    const res = await this.capytorioEngine.exportBlueprintLibraryAsFactorioBookString(bookLabel);
    if (res.ok) {
      AudioService.playCapytorioUiClick('tool');
    }
    return res;
  }

  public undoCapytorioCut(): { restoredCount: number } {
    const res = this.capytorioEngine.undoCut();
    if (res.restoredCount > 0) {
      AudioService.playCapytorioBlueprint('paste', res.restoredCount);
      this.markCapytorioDirty();
      this.emitTelemetry();
    } else {
      this.emitCapytorioSnapshot();
    }
    return res;
  }

  public demolishCapytorioTileAt(gx: number, gz: number): CapytorioMachineType | null {
    const removed = this.capytorioEngine.demolishAt(gx, gz);
    if (removed) {
      AudioService.playCapytorioDemolish();
      this.capytorioEngine.inspectTileAt(gx, gz);
      this.markCapytorioDirty();
      this.emitTelemetry();
    }
    return removed;
  }

  public previewCapytorioSelectionBox(
    gxA: number,
    gzA: number,
    gxB: number,
    gzB: number
  ): number {
    const count = this.capytorioEngine.previewSelectionBox(gxA, gzA, gxB, gzB);
    this.emitCapytorioSnapshot();
    return count;
  }

  public previewCapytorioSelectionLasso(
    points: ReadonlyArray<{ gx: number; gz: number }>
  ): number {
    const count = this.capytorioEngine.previewSelectionPolygon(points);
    this.emitCapytorioSnapshot();
    return count;
  }

  public commitCapytorioSelectionBox(
    gxA: number,
    gzA: number,
    gxB: number,
    gzB: number
  ): { count: number; mode: 'copy' | 'cut' } {
    const mode: 'copy' | 'cut' =
      this.capytorioEngine.clipboardToolState === 'select_cut' ? 'cut' : 'copy';
    const keys = this.capytorioEngine.selectMachinesInBox(gxA, gzA, gxB, gzB);
    const res = this.capytorioEngine.captureBlueprint(keys, mode);
    if (res.count > 0) {
      AudioService.playCapytorioBlueprint(mode, res.count);
      this.markCapytorioDirty();
      if (mode === 'cut') {
        this.emitTelemetry();
      }
    } else {
      this.emitCapytorioSnapshot();
    }
    return { count: res.count, mode };
  }

  public commitCapytorioSelectionLasso(
    points: ReadonlyArray<{ gx: number; gz: number }>
  ): { count: number; mode: 'copy' | 'cut' } {
    const mode: 'copy' | 'cut' =
      this.capytorioEngine.clipboardToolState === 'select_cut' ? 'cut' : 'copy';
    const keys = this.capytorioEngine.selectMachinesInPolygon(points);
    const res = this.capytorioEngine.captureBlueprint(keys, mode);
    if (res.count > 0) {
      AudioService.playCapytorioBlueprint(mode, res.count);
      this.markCapytorioDirty();
      if (mode === 'cut') {
        this.emitTelemetry();
      }
    } else {
      this.emitCapytorioSnapshot();
    }
    return { count: res.count, mode };
  }

  public beginCapytorioHistoryBatch(label: string): void {
    this.capytorioEngine.beginHistoryBatch(label);
  }

  public commitCapytorioHistoryBatch(labelOverride?: string): void {
    this.capytorioEngine.commitHistoryBatch(labelOverride);
    this.emitCapytorioSnapshot();
  }

  public undoCapytorioAction(): { ok: boolean; label: string; changedCount: number } {
    const res = this.capytorioEngine.undoLastAction();
    if (res.ok) {
      AudioService.playCapytorioDemolish();
      this.markCapytorioDirty();
      this.emitTelemetry();
    } else {
      this.emitCapytorioSnapshot();
    }
    return res;
  }

  public redoCapytorioAction(): { ok: boolean; label: string; changedCount: number } {
    const res = this.capytorioEngine.redoLastAction();
    if (res.ok) {
      AudioService.playCapytorioBlueprint('paste', res.changedCount);
      this.markCapytorioDirty();
      this.emitTelemetry();
    } else {
      this.emitCapytorioSnapshot();
    }
    return res;
  }

  public setCapytorioBlueprintAnchorFromNdc(
    ndcX: number,
    ndcY: number
  ): { gx: number; gz: number } | null {
    if (this.currentMode !== 'capytorio' || this.cosmicStage !== 'playing') {
      return null;
    }
    const prevAnchor = this.capytorioEngine.pasteAnchor;
    this.updateCapytorioHoverFromNdc(ndcX, ndcY);
    const gx = this.capytorioEngine.hoveredGx;
    const gz = this.capytorioEngine.hoveredGz;
    this.capytorioEngine.setBlueprintAnchor(gx, gz);
    if (!prevAnchor || prevAnchor.gx !== gx || prevAnchor.gz !== gz) {
      this.emitCapytorioSnapshot();
    }
    return { gx, gz };
  }

  public placeCapytorioBlueprintAtPositionedGhost(): {
    ok: boolean;
    placedCount: number;
    updatedRecipesCount: number;
    skippedCount: number;
    message: string;
  } {
    if (this.currentMode !== 'capytorio' || this.cosmicStage !== 'playing') {
      return { ok: false, placedCount: 0, updatedRecipesCount: 0, skippedCount: 0, message: '' };
    }
    const res = this.capytorioEngine.pasteBlueprintAtAnchor();
    const totalApplied = res.placedCount + res.updatedRecipesCount;
    if (totalApplied > 0) {
      AudioService.playCapytorioBlueprint('paste', totalApplied);
      this.vfxEngine?.emitBurst(
        capytorioGridToWorldX(res.anchorGx),
        0.55,
        capytorioGridToWorldZ(res.anchorGz),
        'citrus_burst',
        6,
        0x22c55e
      );
      this.markCapytorioDirty();
      this.emitTelemetry();
      const skippedNote = res.skippedCount > 0 ? ` (${res.skippedCount} skipped)` : '';
      return {
        ok: true,
        placedCount: res.placedCount,
        updatedRecipesCount: res.updatedRecipesCount,
        skippedCount: res.skippedCount,
        message: `Placed ${totalApplied} building${totalApplied === 1 ? '' : 's'}${skippedNote}`,
      };
    }
    AudioService.playCapytorioError();
    this.emitCapytorioSnapshot();
    return {
      ok: false,
      placedCount: res.placedCount,
      updatedRecipesCount: res.updatedRecipesCount,
      skippedCount: res.skippedCount,
      message: 'Could not place blueprint here (blocked or missing stock)',
    };
  }

  public pasteCapytorioBlueprintAtNdc(
    ndcX: number,
    ndcY: number
  ): { ok: boolean; placedCount: number; updatedRecipesCount: number; skippedCount: number; message: string } {
    if (this.currentMode !== 'capytorio' || this.cosmicStage !== 'playing') {
      return { ok: false, placedCount: 0, updatedRecipesCount: 0, skippedCount: 0, message: '' };
    }
    this.updateCapytorioHoverFromNdc(ndcX, ndcY);
    this.capytorioEngine.setBlueprintAnchor(
      this.capytorioEngine.hoveredGx,
      this.capytorioEngine.hoveredGz
    );
    return this.placeCapytorioBlueprintAtPositionedGhost();
  }

  public handleCapytorioPrimaryClick(
    ndcX: number,
    ndcY: number
  ): { ok: boolean; message?: string; inspected?: boolean; openInspectorModal?: boolean } {
    if (this.currentMode !== 'capytorio' || this.cosmicStage !== 'playing') {
      return { ok: false };
    }
    this.updateCapytorioHoverFromNdc(ndcX, ndcY);
    const gx = this.capytorioEngine.hoveredGx;
    const gz = this.capytorioEngine.hoveredGz;

    // Paste mode: lock transparent blueprint ghost at tapped tile so user can rotate/flip or tap Place
    if (this.capytorioEngine.clipboardToolState === 'paste') {
      this.capytorioEngine.setBlueprintAnchor(gx, gz);
      AudioService.playCapytorioUiClick('tool');
      this.emitCapytorioSnapshot();
      return {
        ok: true,
        inspected: true,
        message: `Blueprint positioned at (${gx}, ${gz}) — click Place or press Enter`,
      };
    }

    // Select Copy / Cut single-tap: capture the single building under cursor
    if (
      this.capytorioEngine.clipboardToolState === 'select_copy' ||
      this.capytorioEngine.clipboardToolState === 'select_cut'
    ) {
      const mode: 'copy' | 'cut' =
        this.capytorioEngine.clipboardToolState === 'select_cut' ? 'cut' : 'copy';
      const tapMachine = this.capytorioEngine.getMachineAt(gx, gz);
      if (tapMachine) {
        const res = this.capytorioEngine.captureBlueprint([tapMachine], mode);
        if (res.count > 0) {
          AudioService.playCapytorioBlueprint(mode, res.count);
          this.markCapytorioDirty();
          if (mode === 'cut') {
            this.emitTelemetry();
          }
          return {
            ok: true,
            message:
              mode === 'cut'
                ? 'Cut 1 building — saved to Blueprints · [R] Rotate · [H/V] Flip'
                : 'Copied 1 building — saved to Blueprints · [R] Rotate · [H/V] Flip',
          };
        }
      }
      return {
        ok: false,
        message: 'Drag around buildings or tap a building to select',
      };
    }

    const tool = this.capytorioEngine.selectedTool;
    const existing = this.capytorioEngine.getMachineAt(gx, gz);
    const isConfigurableMachine = (mType: CapytorioMachineType): boolean =>
      mType === 'furnace' ||
      mType === 'assembler' ||
      mType === 'generator' ||
      mType === 'lab' ||
      mType === 'chest' ||
      mType === 'splitter' ||
      mType === 'inserter';

    if (tool === 'demolish') {
      const removed = this.capytorioEngine.demolishAt(gx, gz);
      if (removed) {
        AudioService.playCapytorioDemolish();
        this.markCapytorioDirty();
        return { ok: true, message: `Refunded ${CAPYTORIO_MACHINE_SPECS[removed].name}` };
      }
      this.capytorioEngine.inspectTileAt(gx, gz);
      this.emitCapytorioSnapshot();
      return { ok: false, message: 'Nothing to demolish at cursor', inspected: true };
    }

    if (tool === 'mine') {
      if (existing) {
        const info = this.capytorioEngine.inspectTileAt(gx, gz);
        AudioService.playCapytorioUiClick('tool');
        this.emitCapytorioSnapshot();
        return {
          ok: true,
          inspected: true,
          openInspectorModal: isConfigurableMachine(existing.type),
          message: `Inspecting ${info.title}`,
        };
      }
      const alreadyInspectingThisTile =
        this.capytorioEngine.inspectedTile !== null &&
        this.capytorioEngine.inspectedTile.gx === gx &&
        this.capytorioEngine.inspectedTile.gz === gz;

      // Trees: first tap inspects so players can inspect flora without accidentally destroying it;
      // second tap on the already-inspected tree (or pressing [E] / Chop button) harvests it.
      if (this.capytorioEngine.hasTreeAt(gx, gz) && !alreadyInspectingThisTile) {
        const info = this.capytorioEngine.inspectTileAt(gx, gz);
        AudioService.playCapytorioUiClick('tool');
        this.emitCapytorioSnapshot();
        return {
          ok: true,
          inspected: true,
          message: `Inspecting ${info.title}`,
        };
      }

      const mined = this.capytorioEngine.handMineAt(gx, gz, 2);
      if (mined) {
        const meta = getCapytorioItemMeta(mined);
        const amt = mined === 'orange' ? 3 : 2;
        AudioService.playCapytorioMine(mined === 'orange' ? 'tree' : 'ore');
        this.vfxEngine?.emitBurst(
          capytorioGridToWorldX(gx),
          0.4,
          capytorioGridToWorldZ(gz),
          'citrus_burst',
          5,
          meta.colorHex
        );
        this.capytorioEngine.inspectTileAt(gx, gz);
        this.markCapytorioDirty();
        return {
          ok: true,
          inspected: true,
          message:
            mined === 'orange'
              ? `Harvested +${amt} ${meta.name} from Citrus Tree`
              : `Mined +${amt} ${meta.name}`,
        };
      }

      const info = this.capytorioEngine.inspectTileAt(gx, gz);
      this.emitCapytorioSnapshot();
      return {
        ok: true,
        inspected: true,
        message: `Inspecting ${info.title}`,
      };
    }

    const resolvedTool = resolveCapytorioPlaceableSpec(tool);
    if (existing) {
      const existingToolId = existing.variantItemId ?? existing.type;
      if (existingToolId !== tool) {
        const info = this.capytorioEngine.inspectTileAt(gx, gz);
        AudioService.playCapytorioUiClick('tool');
        this.emitCapytorioSnapshot();
        return {
          ok: true,
          inspected: true,
          openInspectorModal: isConfigurableMachine(existing.type),
          message: `Inspecting ${info.title}`,
        };
      }
    }

    const anchor = getCapytorioPlacementAnchor(
      gx,
      gz,
      tool,
      this.capytorioEngine.selectedDir
    );
    const res = this.capytorioEngine.placeMachine(
      tool,
      existing ? existing.gx : anchor.gx,
      existing ? existing.gz : anchor.gz,
      this.capytorioEngine.selectedDir
    );
    if (res.ok) {
      if (existing) {
        AudioService.playCapytorioRotate();
      } else {
        AudioService.playCapytorioPlace(resolvedTool?.baseType ?? tool, false);
      }
      this.vfxEngine?.emitBurst(
        capytorioGridToWorldX(gx),
        0.5,
        capytorioGridToWorldZ(gz),
        'citrus_burst',
        5,
        resolvedTool?.tintHex ?? 0xfacc15
      );
      this.markCapytorioDirty();
      this.emitTelemetry();
      return {
        ok: true,
        message: existing
          ? `Rotated ${resolvedTool?.shortName ?? tool}`
          : `Placed ${resolvedTool?.name ?? tool}`,
      };
    }
    this.capytorioEngine.inspectTileAt(gx, gz);
    this.emitCapytorioSnapshot();
    if (res.reason) {
      AudioService.playCapytorioError();
    }
    return { ok: false, inspected: true, message: res.reason };
  }

  public handleCapytorioSecondaryClick(ndcX: number, ndcY: number): boolean {
    if (this.currentMode !== 'capytorio' || this.cosmicStage !== 'playing') return false;
    this.updateCapytorioHoverFromNdc(ndcX, ndcY);
    const removed = this.capytorioEngine.demolishAt(
      this.capytorioEngine.hoveredGx,
      this.capytorioEngine.hoveredGz
    );
    if (removed) {
      AudioService.playCapytorioDemolish();
      this.markCapytorioDirty();
      this.emitTelemetry();
      return true;
    }
    return false;
  }

  public setCapytorioTool(tool: string, promoteToRecent: boolean = false): void {
    this.capytorioEngine.clipboardToolState = 'off';
    this.capytorioEngine.previewSelectedKeys.clear();
    this.capytorioEngine.equipPlaceableTool(tool, promoteToRecent);
    AudioService.playCapytorioUiClick('tool');
    this.emitCapytorioSnapshot();
  }

  public rotateCapytorioDirection(ccw: boolean = false): CapytorioDirection {
    if (
      this.capytorioEngine.clipboardToolState === 'paste' &&
      this.capytorioEngine.clipboard &&
      this.capytorioEngine.clipboard.entries.length > 0
    ) {
      this.capytorioEngine.rotateBlueprint90(ccw);
      AudioService.playCapytorioRotate();
      this.emitCapytorioSnapshot();
      return this.capytorioEngine.selectedDir;
    }
    const selectedMachine = this.capytorioEngine.inspectedKey
      ? this.capytorioEngine.machines.get(this.capytorioEngine.inspectedKey) ?? null
      : null;
    if (selectedMachine) {
      const rotatedDir = this.capytorioEngine.rotateMachineAt(
        selectedMachine.gx,
        selectedMachine.gz
      );
      if (rotatedDir !== null) {
        this.capytorioEngine.selectedDir = rotatedDir;
        AudioService.playCapytorioRotate();
        this.markCapytorioDirty();
        return rotatedDir;
      }
    }
    const step = ccw ? 3 : 1;
    const nextDir = ((this.capytorioEngine.selectedDir + step) & 3) as CapytorioDirection;
    this.capytorioEngine.selectedDir = nextDir;
    this.capytorioEngine.rotateMachineAt(
      this.capytorioEngine.hoveredGx,
      this.capytorioEngine.hoveredGz
    );
    AudioService.playCapytorioRotate();
    this.markCapytorioDirty();
    return nextDir;
  }

  public rotateCapytorioMachineAt(gx: number, gz: number): CapytorioDirection | null {
    const nextDir = this.capytorioEngine.rotateMachineAt(gx, gz);
    if (nextDir !== null) {
      AudioService.playCapytorioRotate();
      this.markCapytorioDirty();
    }
    return nextDir;
  }

  public openCapytorioPediaAtNdc(
    ndcX: number,
    ndcY: number
  ): { pediaId: string; info: CapytorioTileInspection } {
    const hit = this.raycastCapytorioGridFloat(ndcX, ndcY);
    const gx = hit ? hit.gx : this.capytorioEngine.hoveredGx;
    const gz = hit ? hit.gz : this.capytorioEngine.hoveredGz;
    const info = this.capytorioEngine.inspectTileAt(gx, gz);
    this.capytorioEngine.hoveredGx = gx;
    this.capytorioEngine.hoveredGz = gz;
    AudioService.playCapytorioUiClick('tool');
    this.markCapytorioDirty();
    return {
      pediaId: resolvePediaIdFromTileInspection(info),
      info,
    };
  }

  public getCapytorioCameraMode(): 'oblique' | 'chase' {
    return this.settings.capytorioCameraMode === 'chase' ? 'chase' : 'oblique';
  }

  public setCapytorioCameraMode(mode: 'oblique' | 'chase'): void {
    this.settings.capytorioCameraMode = mode;
    if (mode === 'chase' && this.capytorioObliqueZoomDist > SURFACE_ZOOM_ORBIT_THRESHOLD) {
      this.capytorioObliqueZoomDist = Math.min(2.2, this.settings.cameraDistance || 1.0);
    }
    if (this.currentMode === 'capytorio') {
      this.surfaceCamYaw = Math.PI;
      this.surfaceCamPitch = mode === 'oblique' ? CAPYTORIO_OBLIQUE_PITCH_RAD : 0.66;
      if (mode === 'oblique') {
        this.mouselookLastActiveTimeMs = -100000;
      } else if (!this.seamlessZoomActive) {
        this.capytorioPlanetFadeActive = false;
        this.seamlessUniverse?.hide();
      }
      if (this.isSoftwareGl) {
        this.snapCameraToCurrentZone();
        this.renderImmediateFrame(0.016);
      }
    }
    AudioService.playCoin();
  }

  public toggleCapytorioCameraMode(): 'oblique' | 'chase' {
    const next = this.getCapytorioCameraMode() === 'oblique' ? 'chase' : 'oblique';
    this.setCapytorioCameraMode(next);
    return next;
  }

  public getCapytorioBeltEndSpill(): boolean {
    return Boolean(this.settings.capytorioBeltEndSpill);
  }

  public setCapytorioBeltEndSpill(enabled: boolean): void {
    const next = Boolean(enabled);
    this.settings.capytorioBeltEndSpill = next;
    this.capytorioEngine.beltEndSpillEnabled = next;
    AudioService.playCapytorioUiClick(next ? 'alt_on' : 'alt_off');
    this.emitCapytorioSnapshot();
  }

  public setCapytorioAssemblerRecipe(recipeId: CapytorioRecipeId): boolean {
    let applied = false;
    if (this.capytorioEngine.inspectedKey) {
      const m = this.capytorioEngine.machines.get(this.capytorioEngine.inspectedKey);
      if (m && m.type === 'assembler') {
        applied = this.capytorioEngine.setAssemblerRecipeAt(m.gx, m.gz, recipeId);
      }
    }
    if (!applied) {
      applied = this.capytorioEngine.setAssemblerRecipeAt(
        this.capytorioEngine.hoveredGx,
        this.capytorioEngine.hoveredGz,
        recipeId
      );
    }
    this.capytorioEngine.selectedRecipeId = recipeId;
    AudioService.playCapytorioSettings('paste');
    this.markCapytorioDirty();
    return applied;
  }

  public selectCapytorioTech(techId: CapytorioTechId): boolean {
    const ok = this.capytorioEngine.selectActiveTech(techId);
    if (ok) {
      AudioService.playCapytorioScienceFeed();
      this.markCapytorioDirty();
    }
    return ok;
  }

  private tryPickupBeltOrFloorTileWithFx(gx: number, gz: number): {
    total: number;
    source: 'belt' | 'floor' | null;
    items: Array<{ item: CapytorioItemId; count: number }>;
  } {
    const res = this.capytorioEngine.pickupItemsAtTile(gx, gz);
    if (res.total > 0) {
      const leadMeta = res.items[0] ? getCapytorioItemMeta(res.items[0].item) : null;
      AudioService.playCapytorioPickup();
      this.vfxEngine?.emitBurst(
        capytorioGridToWorldX(gx),
        0.45,
        capytorioGridToWorldZ(gz),
        'citrus_burst',
        5,
        leadMeta?.colorHex ?? 0x22c55e
      );
      this.markCapytorioDirty();
      this.emitTelemetry();
    }
    return res;
  }

  public pickupCapytorioBeltOrFloorAtCursorOrHero(): {
    total: number;
    source: 'belt' | 'floor' | null;
    items: Array<{ item: CapytorioItemId; count: number }>;
  } {
    const curGx = this.capytorioEngine.hoveredGx;
    const curGz = this.capytorioEngine.hoveredGz;
    const atCursor = this.tryPickupBeltOrFloorTileWithFx(curGx, curGz);
    if (atCursor.total > 0) return atCursor;

    const insp = this.capytorioEngine.inspectedTile;
    if (insp && (insp.gx !== curGx || insp.gz !== curGz)) {
      const atInspected = this.tryPickupBeltOrFloorTileWithFx(insp.gx, insp.gz);
      if (atInspected.total > 0) return atInspected;
    }

    const hGx = worldToCapytorioGridX(CAPYTORIO_WORLD_ORIGIN_X + this.heroLocalPos.x);
    const hGz = worldToCapytorioGridZ(CAPYTORIO_WORLD_ORIGIN_Z + this.heroLocalPos.z);
    const centerPickup = this.tryPickupBeltOrFloorTileWithFx(hGx, hGz);
    if (centerPickup.total > 0) return centerPickup;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const nearPickup = this.tryPickupBeltOrFloorTileWithFx(hGx + dx, hGz + dz);
        if (nearPickup.total > 0) return nearPickup;
      }
    }
    return { total: 0, source: null, items: [] };
  }

  public mineOrPickupCapytorioAtCursorOrHero(): {
    kind: 'belt_pickup' | 'floor_pickup' | 'mine' | 'chop' | 'none';
    total: number;
    itemId: CapytorioItemId | null;
  } {
    // 1. Pick up items from hovered belt/splitter/tunnel or floor tile first
    const curGx = this.capytorioEngine.hoveredGx;
    const curGz = this.capytorioEngine.hoveredGz;
    const atCursor = this.tryPickupBeltOrFloorTileWithFx(curGx, curGz);
    if (atCursor.total > 0) {
      return {
        kind: atCursor.source === 'floor' ? 'floor_pickup' : 'belt_pickup',
        total: atCursor.total,
        itemId: atCursor.items[0]?.item ?? null,
      };
    }

    // 2. Hand-mine ore or chop tree at hovered cursor
    const cursorOre = this.capytorioEngine.handMineAt(curGx, curGz, 2);
    if (cursorOre) {
      AudioService.playCapytorioMine(cursorOre === 'orange' ? 'tree' : 'ore');
      this.markCapytorioDirty();
      return {
        kind: cursorOre === 'orange' ? 'chop' : 'mine',
        total: cursorOre === 'orange' ? 3 : 2,
        itemId: cursorOre,
      };
    }

    // 3. If user inspected a belt/floor tile (e.g. tap on mobile), pick up from it
    const insp = this.capytorioEngine.inspectedTile;
    if (insp && (insp.gx !== curGx || insp.gz !== curGz)) {
      const atInsp = this.tryPickupBeltOrFloorTileWithFx(insp.gx, insp.gz);
      if (atInsp.total > 0) {
        return {
          kind: atInsp.source === 'floor' ? 'floor_pickup' : 'belt_pickup',
          total: atInsp.total,
          itemId: atInsp.items[0]?.item ?? null,
        };
      }
    }

    // 4. Hero 3x3 neighborhood: check nearby belts/floor items, then ore/trees
    const nearPickup = this.pickupCapytorioBeltOrFloorAtCursorOrHero();
    if (nearPickup.total > 0) {
      return {
        kind: nearPickup.source === 'floor' ? 'floor_pickup' : 'belt_pickup',
        total: nearPickup.total,
        itemId: nearPickup.items[0]?.item ?? null,
      };
    }

    const hGx = worldToCapytorioGridX(CAPYTORIO_WORLD_ORIGIN_X + this.heroLocalPos.x);
    const hGz = worldToCapytorioGridZ(CAPYTORIO_WORLD_ORIGIN_Z + this.heroLocalPos.z);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const ore = this.capytorioEngine.handMineAt(hGx + dx, hGz + dz, 2);
        if (ore) {
          AudioService.playCapytorioMine(ore === 'orange' ? 'tree' : 'ore');
          this.markCapytorioDirty();
          return {
            kind: ore === 'orange' ? 'chop' : 'mine',
            total: ore === 'orange' ? 3 : 2,
            itemId: ore,
          };
        }
      }
    }
    return { kind: 'none', total: 0, itemId: null };
  }

  public handMineCapytorioAtCursorOrHero(): CapytorioItemId | null {
    const cursorOre = this.capytorioEngine.handMineAt(
      this.capytorioEngine.hoveredGx,
      this.capytorioEngine.hoveredGz,
      2
    );
    if (cursorOre) {
      AudioService.playCapytorioMine(cursorOre === 'orange' ? 'tree' : 'ore');
      this.markCapytorioDirty();
      return cursorOre;
    }
    const hGx = worldToCapytorioGridX(CAPYTORIO_WORLD_ORIGIN_X + this.heroLocalPos.x);
    const hGz = worldToCapytorioGridZ(CAPYTORIO_WORLD_ORIGIN_Z + this.heroLocalPos.z);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const ore = this.capytorioEngine.handMineAt(hGx + dx, hGz + dz, 2);
        if (ore) {
          AudioService.playCapytorioMine(ore === 'orange' ? 'tree' : 'ore');
          this.markCapytorioDirty();
          return ore;
        }
      }
    }
    return null;
  }

  public pocketCraftCapytorioRecipe(
    recipeId: CapytorioRecipeId,
    batches: number = 1
  ): boolean {
    const ok = this.capytorioEngine.pocketCraftRecipe(recipeId, batches);
    if (ok) {
      AudioService.playCapytorioCraftQueue('complete');
      this.markCapytorioDirty();
      this.emitTelemetry();
    }
    return ok;
  }

  public craftCapytorioMachine(type: CapytorioMachineType): boolean {
    const ok = this.capytorioEngine.craftMachineIntoPocket(type);
    if (ok) {
      AudioService.playCapytorioCraftQueue('complete');
      this.markCapytorioDirty();
    }
    return ok;
  }

  public feedScienceCapytorio(): number {
    const fed = this.capytorioEngine.feedPocketScienceToLabs();
    if (fed > 0) {
      AudioService.playCapytorioScienceFeed();
      // Step once immediately so tech completes cleanly if threshold was met
      this.capytorioEngine.step(0.05, this.capytorioStepCallbacks);
      this.markCapytorioDirty();
      this.emitTelemetry();
    }
    return fed;
  }

  public collectAllCapytorioOutputs(): number {
    const got = this.capytorioEngine.collectAllChestsAndOutputs();
    if (got > 0) {
      AudioService.playCapytorioPickup();
      this.markCapytorioDirty();
    }
    return got;
  }

  public handleCapytorioDragPaint(
    ndcX: number,
    ndcY: number,
    prevPlacedGx: number | null,
    prevPlacedGz: number | null,
    alignPrevTile: boolean
  ): {
    placed: boolean;
    gx: number;
    gz: number;
    tool: string;
  } {
    if (this.currentMode !== 'capytorio' || this.cosmicStage !== 'playing') {
      return { placed: false, gx: 0, gz: 0, tool: this.capytorioEngine.selectedTool };
    }
    this.updateCapytorioHoverFromNdc(ndcX, ndcY);
    const gx = this.capytorioEngine.hoveredGx;
    const gz = this.capytorioEngine.hoveredGz;
    const tool = this.capytorioEngine.selectedTool;

    if (tool === 'demolish') {
      const removed = this.capytorioEngine.demolishAt(gx, gz);
      if (removed) {
        AudioService.playCapytorioDemolish();
        this.markCapytorioDirty();
        this.emitTelemetry();
        return { placed: true, gx, gz, tool };
      }
      return { placed: false, gx, gz, tool };
    }

    if (tool === 'mine') {
      return { placed: false, gx, gz, tool };
    }

    const anchor = getCapytorioPlacementAnchor(
      gx,
      gz,
      tool,
      this.capytorioEngine.selectedDir
    );
    const res = this.capytorioEngine.placeMachineDuringDrag(
      tool,
      anchor.gx,
      anchor.gz,
      prevPlacedGx,
      prevPlacedGz,
      alignPrevTile
    );
    if (res.ok) {
      const resolvedTool = resolveCapytorioPlaceableSpec(tool);
      AudioService.playCapytorioPlace(resolvedTool?.baseType ?? tool, true);
      this.vfxEngine?.emitBurst(
        capytorioGridToWorldX(gx),
        0.45,
        capytorioGridToWorldZ(gz),
        'citrus_burst',
        4,
        resolvedTool?.tintHex ?? 0xfacc15
      );
      this.markCapytorioDirty();
      this.emitTelemetry();
      return { placed: true, gx: anchor.gx, gz: anchor.gz, tool };
    }
    return { placed: false, gx: anchor.gx, gz: anchor.gz, tool };
  }

  public handleCapytorioDragDemolish(ndcX: number, ndcY: number): boolean {
    return this.handleCapytorioSecondaryClick(ndcX, ndcY);
  }

  public pipetteCapytorioAtCursor(): {
    tool: string;
    picked: boolean;
    label: string;
  } {
    const res = this.capytorioEngine.pipetteAt(
      this.capytorioEngine.hoveredGx,
      this.capytorioEngine.hoveredGz
    );
    AudioService.playCapytorioUiClick('pipette');
    this.emitCapytorioSnapshot();
    const spec = resolveCapytorioPlaceableSpec(res.tool);
    const label = res.picked
      ? `Picked ${spec?.name ?? res.tool}`
      : 'Cursor cleared -> Mine / Inspect [E]';
    return { tool: res.tool, picked: res.picked, label };
  }

  public returnToCapytorioBeacon(): void {
    if (this.currentMode !== 'capytorio') {
      this.switchMode('capytorio', true);
    }
    this.heroLocalPos.set(0, 0, 3.0);
    this.heroVelocity.set(0, 0, 0);
    this.resetDachshundTrail();
    this.snapCameraToCurrentZone();
    AudioService.playJump();
    this.emitCapytorioSnapshot();
    this.emitTelemetry();
  }

  public fuelCapytorioGenerator(gx: number, gz: number, maxAmount: number = 5): number {
    const loaded = this.capytorioEngine.insertPocketFuelToGenerator(gx, gz, maxAmount);
    if (loaded > 0) {
      AudioService.playCapytorioFuelLoad();
      this.vfxEngine?.emitBurst(
        capytorioGridToWorldX(gx),
        1.2,
        capytorioGridToWorldZ(gz),
        'citrus_burst',
        8,
        0xf97316
      );
      this.capytorioEngine.evaluateMilestones(this.capytorioStepCallbacks);
      this.markCapytorioDirty();
      this.emitTelemetry();
    }
    return loaded;
  }

  public insertInputsCapytorioMachine(gx: number, gz: number, batches: number = 4): number {
    const moved = this.capytorioEngine.insertPocketInputsForMachine(gx, gz, batches);
    if (moved > 0) {
      AudioService.playCapytorioPickup();
      this.capytorioEngine.step(0.05, this.capytorioStepCallbacks);
      this.markCapytorioDirty();
      this.emitTelemetry();
    }
    return moved;
  }

  public takeOutputsCapytorioMachine(gx: number, gz: number): number {
    const taken = this.capytorioEngine.takeMachineOutputsToPocket(gx, gz);
    if (taken > 0) {
      AudioService.playCapytorioPickup();
      this.markCapytorioDirty();
      this.emitTelemetry();
    }
    return taken;
  }

  public launchCapytorioRocket(): { ok: boolean; reason?: string; rocketLaunches: number } {
    const res = this.capytorioEngine.launchRocketManual(this.capytorioStepCallbacks);
    if (res.ok) {
      const zone = ZONE_LOCATIONS.capytorio;
      this.vfxEngine?.emitBurst(zone.x, 1.5, zone.z - 6.8, 'citrus_burst', 28, 0xfacc15);
      this.addCameraTrauma(0.5);
      this.markCapytorioDirty();
      this.emitTelemetry();
    }
    return res;
  }

  public toggleCapytorioAltMode(): boolean {
    const next = this.capytorioEngine.toggleAltMode();
    AudioService.playCapytorioUiClick(next ? 'alt_on' : 'alt_off');
    this.markCapytorioDirty();
    return next;
  }

  public copyCapytorioEntitySettingsAtTile(
    gx: number,
    gz: number
  ): { ok: boolean; label?: string; reason?: string } {
    const res = this.capytorioEngine.copyEntitySettingsAt(gx, gz);
    if (res.ok) {
      AudioService.playCapytorioSettings('copy');
      this.emitCapytorioSnapshot();
    }
    return res;
  }

  public pasteCapytorioEntitySettingsAtTile(
    gx: number,
    gz: number
  ): { ok: boolean; label?: string; reason?: string } {
    const res = this.capytorioEngine.pasteEntitySettingsAt(gx, gz);
    if (res.ok) {
      AudioService.playCapytorioSettings('paste');
      this.markCapytorioDirty();
    } else {
      AudioService.playCapytorioError();
    }
    return res;
  }

  public copyCapytorioEntitySettingsAtNdc(
    ndcX: number,
    ndcY: number
  ): { ok: boolean; label?: string; reason?: string } {
    const hit = this.raycastCapytorioGridFloat(ndcX, ndcY);
    const gx = hit ? hit.gx : this.capytorioEngine.hoveredGx;
    const gz = hit ? hit.gz : this.capytorioEngine.hoveredGz;
    this.capytorioEngine.hoveredGx = gx;
    this.capytorioEngine.hoveredGz = gz;
    return this.copyCapytorioEntitySettingsAtTile(gx, gz);
  }

  public pasteCapytorioEntitySettingsAtNdc(
    ndcX: number,
    ndcY: number
  ): { ok: boolean; label?: string; reason?: string } {
    const hit = this.raycastCapytorioGridFloat(ndcX, ndcY);
    const gx = hit ? hit.gx : this.capytorioEngine.hoveredGx;
    const gz = hit ? hit.gz : this.capytorioEngine.hoveredGz;
    this.capytorioEngine.hoveredGx = gx;
    this.capytorioEngine.hoveredGz = gz;
    return this.pasteCapytorioEntitySettingsAtTile(gx, gz);
  }

  public setCapytorioSplitterConfig(
    gx: number,
    gz: number,
    config: {
      inputPriority?: CapytorioSplitterPriority;
      outputPriority?: CapytorioSplitterPriority;
      filterItem?: CapytorioItemId | null;
    }
  ): boolean {
    const ok = this.capytorioEngine.setSplitterConfigAt(gx, gz, config);
    if (ok) {
      AudioService.playCapytorioUiClick('tool');
      this.markCapytorioDirty();
    }
    return ok;
  }

  public setCapytorioInserterConfig(
    gx: number,
    gz: number,
    config: {
      filterMode?: CapytorioInserterFilterMode;
      filters?: CapytorioItemId[];
      stackLimit?: number | null;
    }
  ): boolean {
    const ok = this.capytorioEngine.setInserterConfigAt(gx, gz, config);
    if (ok) {
      AudioService.playCapytorioUiClick('tool');
      this.markCapytorioDirty();
    }
    return ok;
  }

  public setCapytorioChestSlotLimit(
    gx: number,
    gz: number,
    slotLimit: number | null
  ): boolean {
    const ok = this.capytorioEngine.setChestSlotLimitAt(gx, gz, slotLimit);
    if (ok) {
      AudioService.playCapytorioUiClick('tool');
      this.markCapytorioDirty();
    }
    return ok;
  }

  public enqueueCapytorioPocketCraft(
    recipeId: CapytorioRecipeId,
    batches: number = 1
  ): { ok: boolean; queuedBatches: number; reason?: string } {
    const res = this.capytorioEngine.enqueuePocketCraft(recipeId, batches);
    if (res.ok) {
      AudioService.playCapytorioCraftQueue('start');
      this.markCapytorioDirty();
      this.emitTelemetry();
    } else {
      AudioService.playCapytorioError();
    }
    return res;
  }

  public enqueueCapytorioMachineCraft(
    type: CapytorioMachineType,
    count: number = 1
  ): { ok: boolean; queuedCount: number; reason?: string } {
    const res = this.capytorioEngine.enqueueMachineCraft(type, count);
    if (res.ok) {
      AudioService.playCapytorioCraftQueue('start');
      this.markCapytorioDirty();
    } else {
      AudioService.playCapytorioError();
    }
    return { ok: res.ok, queuedCount: res.queuedBatches };
  }

  public cancelCapytorioCraftQueueItem(uid: number): boolean {
    const res = this.capytorioEngine.cancelCraftQueueItem(uid);
    if (res.ok) {
      AudioService.playCapytorioCraftQueue('cancel');
      this.markCapytorioDirty();
    }
    return res.ok;
  }

  // ============================================================================
  // 4. NUMBER RUNNER STAMPEDE (AT WORLD -75, +75)
  // ============================================================================
  private buildRunner() {
    this.initRunnerPools();
    this.resetRunnerGame();
  }

  private getCachedRunnerBannerTexture(
    labelText: string,
    subText: string,
    bgHex: string,
    accentHex: string
  ): THREE.CanvasTexture {
    const key = `${labelText}|${subText}|${bgHex}|${accentHex}`;
    const existing = this.runnerBannerTextureCache.get(key);
    if (existing) return existing;
    const tex = CapyModelGenerator.createTextBannerTexture(
      labelText,
      subText,
      bgHex,
      accentHex
    );
    this.runnerBannerTextureCache.set(key, tex);
    return tex;
  }

  private initRunnerPools() {
    if (this.runnerPoolsInitialized) return;
    this.runnerPoolsInitialized = true;

    for (let i = 0; i < 4; i++) {
      this.spawnRunnerTrackSegment(-i * 24);
    }

    const panelGeo = new THREE.BoxGeometry(3.6, 2.5, 0.18);
    const defaultTex = this.getCachedRunnerBannerTexture(
      '+3',
      'ADD CAPYS',
      '#1e3a8a',
      '#60a5fa'
    );
    for (let i = 1; i <= 3; i++) {
      const zPos = -i * 24;
      for (const xPos of [-2.1, 2.1]) {
        const gateGroup = new THREE.Group();
        gateGroup.position.set(xPos, 0, zPos);
        const panelMat = new THREE.MeshBasicMaterial({ map: defaultTex });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(0, 1.4, 0);
        gateGroup.add(panel);
        this.runnerGroup.add(gateGroup);
        this.runnerGates.push({
          mesh: gateGroup,
          panelMat,
          type: 'add',
          value: 3,
          z: zPos,
          triggered: false,
        });
      }
    }

    for (let idx = 0; idx < MAX_RUNNER_HERD; idx++) {
      const mini = CapyModelGenerator.createCapybara(
        idx % 3 === 0 ? 'yuzu' : 'flower',
        0.58,
        idx % 4 === 0 ? 'golden' : 'classic'
      );
      mini.rotation.y = Math.PI;
      mini.visible = false;
      mini.userData.ignoreCameraFade = true;
      this.runnerGroup.add(mini);
      this.runnerHerdMeshes.push(mini);
    }
  }

  private resetRunnerGame() {
    this.initRunnerPools();
    const rCfg = this.proceduralConfig.districts.runner;
    this.runnerDistance = 0;
    this.runnerSpeed = rCfg.laneSpeed;
    this.runnerCapyCount = Math.max(
      1,
      rCfg.startingHerdCount +
        (this.stats.upgrades.herdSize - 1) +
        (this.activeHeroSpec?.herdBonus ?? 0)
    );

    this.refreshRunnerCircuitGates();
    this.syncRunnerHerdVisuals();
  }

  private syncRunnerHerdVisuals() {
    const desiredVisualCount = Math.min(
      MAX_RUNNER_HERD,
      Math.max(0, this.runnerCapyCount - 1)
    );
    for (let i = 0; i < this.runnerHerdMeshes.length; i++) {
      this.runnerHerdMeshes[i].visible = i < desiredVisualCount;
    }
  }

  private spawnRunnerTrackSegment(zPos: number) {
    const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');
    const timberTex = RealisticWorldEnvironment.getTextureSet('timber');
    const segment = new THREE.Group();
    segment.position.set(0, 0, zPos);
    segment.userData.ignoreCameraFade = true;

    const trackGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.BoxGeometry(9.2, 0.4, 24)
    );
    const track = new THREE.Mesh(
      trackGeo,
      new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        map: basaltTex.albedo,
        normalMap: basaltTex.normal,
        normalScale: new THREE.Vector2(0.72, 0.72),
        roughnessMap: basaltTex.roughness,
        aoMap: basaltTex.ao,
        roughness: 0.52,
        metalness: 0.14,
      })
    );
    track.position.set(0, -0.2, 0);
    track.receiveShadow = true;
    segment.add(track);

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      map: timberTex.albedo,
      normalMap: timberTex.normal,
      normalScale: new THREE.Vector2(0.64, 0.64),
      roughnessMap: timberTex.roughness,
      aoMap: timberTex.ao,
      roughness: 0.35,
    });
    const railGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.BoxGeometry(0.3, 0.35, 24)
    );
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(-4.5, 0.1, 0);
    const railR = railL.clone();
    railR.position.x = 4.5;
    segment.add(railL, railR);

    this.runnerGroup.add(segment);
    this.runnerTrackSegments.push(segment);
  }

  private spawnRunnerGatePair(_zPos: number) {
    // Gate pairs are pre-allocated once in initRunnerPools() and mutated in-place by refreshRunnerCircuitGates()
  }

  // ============================================================================
  // 5. FALL GUYS CHAOS PARKOUR (AT WORLD +75, +75)
  // ============================================================================
  private buildFallGuys() {
    this.resetFallGuysGame(true);
  }

  private resetFallGuysGame(resetRound: boolean = false) {
    const fCfg = this.proceduralConfig.districts.fallguys;
    if (resetRound) {
      this.fallGuysCrowns = 0;
      this.fallGuysRound = 1;
    }

    if (!this.fallGuysInitialized) {
      this.fallGuysInitialized = true;
      const sandTex = RealisticWorldEnvironment.getTextureSet('sand');
      const timberTex = RealisticWorldEnvironment.getTextureSet('timber');
      const pinkMat = new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        map: sandTex.albedo,
        normalMap: sandTex.normal,
        normalScale: new THREE.Vector2(0.68, 0.68),
        roughnessMap: sandTex.roughness,
        aoMap: sandTex.ao,
        roughness: 0.42,
      });
      const cyanMat = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        map: sandTex.albedo,
        normalMap: sandTex.normal,
        normalScale: new THREE.Vector2(0.68, 0.68),
        roughnessMap: sandTex.roughness,
        aoMap: sandTex.ao,
        roughness: 0.38,
      });
      const yellowMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        map: timberTex.albedo,
        normalMap: timberTex.normal,
        normalScale: new THREE.Vector2(0.72, 0.72),
        roughnessMap: timberTex.roughness,
        aoMap: timberTex.ao,
        roughness: 0.3,
      });

      const startPlat = new THREE.Mesh(
        PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(12, 1, 12)),
        pinkMat
      );
      startPlat.position.set(0, 0, 0);
      startPlat.receiveShadow = true;
      startPlat.userData.ignoreCameraFade = true;
      this.fallGuysGroup.add(startPlat);

      const plat2 = new THREE.Mesh(
        PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(11, 1, 18)),
        cyanMat
      );
      plat2.position.set(0, 0, -16);
      plat2.receiveShadow = true;
      plat2.userData.ignoreCameraFade = true;
      this.fallGuysGroup.add(plat2);

      for (const zOff of [-12, -20]) {
        const post = new THREE.Mesh(
          PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.CylinderGeometry(0.5, 0.5, 3, 16)),
          yellowMat
        );
        post.position.set(0, 1.5, zOff);
        this.fallGuysGroup.add(post);

        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(9.5, 0.75, 0.75),
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.28, metalness: 0.2 })
        );
        bar.position.set(0, 1.15, zOff);
        bar.castShadow = true;
        this.fallGuysGroup.add(bar);
        const dir = zOff === -12 ? 1 : -1;
        this.spinningObstacles.push({
          mesh: bar,
          speed: dir * (2.2 + this.fallGuysRound * 0.25) * fCfg.hammerSpeedMultiplier,
          dir,
        });
      }

      const seeSaw = new THREE.Mesh(
        PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(10, 0.6, 12)),
        yellowMat
      );
      seeSaw.position.set(0, 0.2, -33);
      seeSaw.castShadow = true;
      seeSaw.userData.ignoreCameraFade = true;
      this.fallGuysGroup.add(seeSaw);
      this.seeSaws.push({ mesh: seeSaw, phase: 0 });

      const plat3 = new THREE.Mesh(
        new THREE.CylinderGeometry(5.5, 5.5, 1, 24),
        new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.25 })
      );
      plat3.position.set(0, 0, -46);
      plat3.userData.ignoreCameraFade = true;
      this.fallGuysGroup.add(plat3);

      const finishPlat = new THREE.Mesh(
        new THREE.BoxGeometry(12, 1, 12),
        new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 })
      );
      finishPlat.position.set(0, 0, -60);
      finishPlat.userData.ignoreCameraFade = true;
      this.fallGuysGroup.add(finishPlat);

      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 1.3, 1.6, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffd700,
          metalness: 0.9,
          roughness: 0.12,
        })
      );
      crown.position.set(0, 2.4, -60);
      this.fallGuysGroup.add(crown);

      const rivalSkins = ['sakura', 'matcha', 'golden', 'cosmic', 'classic'];
      const rivalHats = ['party', 'wizard', 'flower', 'crown', 'yuzu'];
      for (let i = 0; i < 5; i++) {
        const rival = CapyModelGenerator.createCapybara(
          rivalHats[i],
          0.92,
          rivalSkins[i]
        );
        const laneX = (i - 2) * 1.9;
        rival.position.set(laneX, 0.6, 1.5);
        rival.rotation.y = Math.PI;
        this.fallGuysGroup.add(rival);
        this.fallGuysRivals.push({
          capy: rival,
          speed: 5.8 + this.proceduralPrng() * 2.4,
          laneOffset: laneX,
          vy: 0,
        });
      }

      // Translucent Personal-Best Ghost Capybara (zero per-frame allocations)
      const ghostCapy = CapyModelGenerator.createCapybara('crown', 0.94, 'cosmic');
      const ghostMat = new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.72,
        roughness: 0.24,
        metalness: 0.15,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
      });
      ghostCapy.userData.ignoreCameraFade = true;
      ghostCapy.userData.furInstancedMesh.visible = false;
      ghostCapy.userData.rearFurInstancedMesh.visible = false;
      ghostCapy.traverse((obj) => {
        obj.userData.ignoreCameraFade = true;
        const m = obj as THREE.Mesh;
        if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh) {
          m.material = ghostMat;
          m.castShadow = false;
          m.receiveShadow = false;
        }
      });
      ghostCapy.visible = false;
      this.fallGuysGroup.add(ghostCapy);
      this.fallGuysGhostCapy = ghostCapy;
      this.fallGuysGhostMat = ghostMat;
    }

    // In-place round reset (zero geometry/material allocations!)
    for (let i = 0; i < this.spinningObstacles.length; i++) {
      const obs = this.spinningObstacles[i];
      obs.speed = obs.dir * (2.2 + this.fallGuysRound * 0.25) * fCfg.hammerSpeedMultiplier;
    }
    for (let i = 0; i < this.seeSaws.length; i++) {
      this.seeSaws[i].phase = 0;
      this.seeSaws[i].mesh.rotation.z = 0;
    }
    for (let i = 0; i < this.fallGuysRivals.length; i++) {
      const rival = this.fallGuysRivals[i];
      rival.capy.position.set(rival.laneOffset, 0.6, 1.5);
      rival.speed = 5.8 + this.proceduralPrng() * 2.4;
      rival.capy.visible = i < fCfg.rivalCount;
    }
    this.yuzuGhostRunActive = false;
    this.yuzuGhostRunElapsedSec = 0;
    this.yuzuGhostRecorder.stopRun();
    this.syncGhostToStartPose();
    this.physicsBridge?.resetSeeSaw();
  }

  private syncGhostToStartPose(): void {
    if (!this.fallGuysGhostCapy) return;
    if (
      this.yuzuBestGhostRun &&
      sampleGhostRunAtTime(this.yuzuBestGhostRun, 0, this.yuzuGhostPoseScratch)
    ) {
      this.fallGuysGhostCapy.position.set(
        this.yuzuGhostPoseScratch.x,
        this.yuzuGhostPoseScratch.y,
        this.yuzuGhostPoseScratch.z
      );
      this.fallGuysGhostCapy.rotation.set(0, this.yuzuGhostPoseScratch.yaw, 0);
      this.resetCapyLegs(this.fallGuysGhostCapy, 0.016);
      this.fallGuysGhostCapy.visible = true;
    } else {
      this.fallGuysGhostCapy.visible = false;
    }
  }

  public reloadYuzuBestGhostFromStorage(): void {
    this.yuzuBestGhostRun = loadBestYuzuGhostRun();
    if (!this.yuzuGhostRunActive) {
      this.syncGhostToStartPose();
    }
  }

  public getYuzuGhostStatus(): {
    hasPersonalBest: boolean;
    bestTimeSec: number | null;
    bestFrameCount: number;
    runActive: boolean;
    runElapsedSec: number;
    ghostVisible: boolean;
  } {
    return {
      hasPersonalBest: Boolean(this.yuzuBestGhostRun),
      bestTimeSec: this.yuzuBestGhostRun
        ? +(this.yuzuBestGhostRun.durationMs / 1000).toFixed(2)
        : null,
      bestFrameCount: this.yuzuBestGhostRun?.frameCount ?? 0,
      runActive: this.yuzuGhostRunActive,
      runElapsedSec: +this.yuzuGhostRunElapsedSec.toFixed(2),
      ghostVisible: Boolean(this.fallGuysGhostCapy?.visible),
    };
  }

  // ============================================================================
  // DYNAMIC 60 FPS CAPYBARA DETAIL GOVERNOR & DACHSHUND-SNAKE SPINE ENGINE
  // ============================================================================
  public getCapyLodTier(): CapyLodTier {
    return this.currentCapyLodTier;
  }

  public getMouthMaxFruitRadius(): number {
    // Starts at 0.40m (40cm); 'tusks' mutation widens capacity by +22%, scaled by proceduralConfig.player.mouthCapacityMultiplier
    const hasTusks =
      this.stats.activeMutations.includes('tusks') ||
      Boolean(this.activeHeroSpec?.mutations?.includes('tusks'));
    const tusksBonus = hasTusks ? 1.22 : 1.0;
    const cfgMult = this.proceduralConfig.player.mouthCapacityMultiplier;
    return +(
      0.4 *
      (1 + 0.48 * Math.log(1 + this.eatenFruitMass)) *
      tusksBonus *
      cfgMult
    ).toFixed(3);
  }

  public syncLogarithmicBodyLength(silent: boolean = false) {
    this.fruitsCarried = Math.max(1, this.fruitsCarried);
    if (this.fruitsCarried === 1) {
      this.eatenFruitMass = 0;
    }

    // Strictly linear body growth: 1 base orange on head ONLY, +1 back segment & +1 back-mounted orange per collected fruit
    const lin = computeLinearDachshundState(
      this.fruitsCarried,
      DACHSHUND_SEGMENT_SPACING,
      MAX_DACHSHUND_SEGMENTS,
      SANE_HERO_LINK_DIST,
      SANE_CABOOSE_LINK_DIST
    );
    this.logarithmicLengthMeters = lin.lengthMeters;
    const targetSegments = lin.bodySegments;

    if (targetSegments > this.snakeSegmentCount) {
      this.growDachshundBody(targetSegments - this.snakeSegmentCount, true);
    } else if (targetSegments < this.snakeSegmentCount) {
      this.snakeSegmentCount = targetSegments;
      for (let i = targetSegments; i < this.dachshundSegments.length; i++) {
        this.dachshundSegments[i].visible = false;
      }
    }

    // Strict 1-orange-on-head invariant: extra collected fruits sit along the Capybara's back segments!
    CapyModelGenerator.setHeadFruitStackCount(this.heroCapy, 1);
    const variety =
      HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex] ?? HEAD_ORANGE_VARIETIES[0];
    for (let i = 0; i < this.dachshundSegments.length; i++) {
      const showBackFruit = i < this.snakeSegmentCount && i < lin.collectedBackFruits;
      CapyModelGenerator.setDachshundSegmentFruitState(
        this.dachshundSegments[i],
        showBackFruit,
        variety.colorHex,
        variety.emissiveHex
      );
    }

    if (!silent) {
      this.emitTelemetry();
    }
  }

  public getCapySnakeTelemetry(): CapySnakeTelemetry {
    const variety =
      HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex] ?? HEAD_ORANGE_VARIETIES[0];
    let groundRolling = 0;
    for (let i = 0; i < this.physicsFruits.length; i++) {
      const f = this.physicsFruits[i];
      if (f.active && !f.inPond) groundRolling++;
    }
    return {
      bodySegments: this.snakeSegmentCount,
      bestSegments: this.bestSnakeSegments,
      lengthMeters: this.logarithmicLengthMeters,
      orangesCollected: this.orangesCollectedCount,
      fruitsCarried: this.fruitsCarried,
      mouthMaxRadiusCm: Math.round(this.getMouthMaxFruitRadius() * 100),
      groundRollingFruits: groundRolling,
      pondFruits: this.pondFruitCount,
      pondOverflowing: this.pondOverflowing,
      pondMessPercent: Math.round(this.pondMessLevel * 100),
      headOrangeName: variety.name,
      headOrangeCss: variety.cssColor,
      headOrangeHex: variety.colorHex,
      fps: Math.round(this.rollingFps),
      lodTier: this.currentCapyLodTier,
      lodLabel: CapyModelGenerator.LOD_LABELS[this.currentCapyLodTier],
      trianglesPerCapy: CapyModelGenerator.LOD_TRIANGLE_ESTIMATES[this.currentCapyLodTier],
      autoLodEnabled: this.settings.autoCapyLod !== false,
      timeOfDayHours: +(this.worldEnv?.timeOfDayHours ?? 9.5).toFixed(2),
      dayPhaseLabel: this.worldEnv ? this.worldEnv.getDayPhaseLabel() : 'Daylight',
      weather: this.worldEnv ? this.worldEnv.activeWeather : 'clear',
      weatherLabel: this.worldEnv ? this.worldEnv.getWeatherLabel() : 'Clear Skies',
      groundedFeet: this.groundedFeetCount,
      totalFeet: this.totalFeetCount,
      isWalkingBackward: this.isWalkingBackward,
      isStuckNoFooting: this.isStuckNoFooting,
      occludedObjectsFaded: this.occludedObjectsFadedCount,
    };
  }

  public applyGlobalCapyLodTier(tier: CapyLodTier) {
    if (this.currentCapyLodTier === tier && this.heroCapy.userData.lodTier === tier) return;
    this.currentCapyLodTier = tier;

    CapyModelGenerator.applyLodTier(this.heroCapy, tier);
    if (this.dachshundCaboose) {
      CapyModelGenerator.applyCabooseLodTier(this.dachshundCaboose, tier);
    }
    for (let i = 0; i < this.dachshundSegments.length; i++) {
      CapyModelGenerator.applySegmentLodTier(this.dachshundSegments[i], tier);
    }
    for (let i = 0; i < this.sanctuaryCapys.length; i++) {
      CapyModelGenerator.applyLodTier(this.sanctuaryCapys[i].capy, tier);
    }
    for (let i = 0; i < this.sporeCritters.length; i++) {
      CapyModelGenerator.applyLodTier(this.sporeCritters[i].mesh, tier);
    }
    for (let i = 0; i < this.runnerHerdMeshes.length; i++) {
      CapyModelGenerator.applyLodTier(this.runnerHerdMeshes[i], tier);
    }
    for (let i = 0; i < this.fallGuysRivals.length; i++) {
      CapyModelGenerator.applyLodTier(this.fallGuysRivals[i].capy, tier);
    }
    const selChildren = this.selectableCapyGroup.children;
    for (let i = 0; i < selChildren.length; i++) {
      const capy = selChildren[i].children[0] as CapyMeshGroup | undefined;
      if (capy?.userData) CapyModelGenerator.applyLodTier(capy, tier);
    }
  }

  /**
   * Feeds a live or simulated FPS measurement into the FPS Capybara LOD governor.
   * Scales Capybara anatomical & bristle-fur detail down if FPS dips below target * 0.9, and
   * scales detail back up toward Tier 3 (Ultra) when smooth headroom holds.
   */
  public ingestFpsSample(fpsSample: number, stepSeconds: number = 0.4) {
    const clampedFps = THREE.MathUtils.clamp(fpsSample, 15, 240);
    this.rollingFps = this.rollingFps * 0.78 + clampedFps * 0.22;

    if (this.settings.autoCapyLod === false) {
      return;
    }

    const effTarget = this.performanceLog.getEffectiveTargetFps();
    this.lodGovernorAccum += stepSeconds;
    if (this.lodGovernorAccum < 0.35) return;
    this.lodGovernorAccum = 0;

    if (this.rollingFps < effTarget * 0.91) {
      this.lodLowFpsStreak++;
      this.lodHighFpsStreak = 0;
      if (this.lodLowFpsStreak >= 1 && this.currentCapyLodTier > 0) {
        const nextTier = (this.currentCapyLodTier - 1) as CapyLodTier;
        this.applyGlobalCapyLodTier(nextTier);
      }
    } else if (this.rollingFps >= effTarget * 0.96) {
      this.lodHighFpsStreak++;
      this.lodLowFpsStreak = 0;
      const presetMaxTier: CapyLodTier =
        this.settings.gpuQualityPreset === 'performance' ? 1 : 3;
      const maxTier =
        this.adaptiveMitigationLevel > 0
          ? (Math.min(presetMaxTier, this.adaptiveMitigationResult.maxCapyLodTier) as CapyLodTier)
          : presetMaxTier;
      if (this.lodHighFpsStreak >= 2 && this.currentCapyLodTier < maxTier) {
        this.lodHighFpsStreak = 0;
        const nextTier = (this.currentCapyLodTier + 1) as CapyLodTier;
        this.applyGlobalCapyLodTier(nextTier);
      }
    } else {
      this.lodLowFpsStreak = 0;
    }
  }

  private syncDachshundVisibility() {
    const activeInSanctuary =
      this.cosmicStage === 'playing' &&
      this.currentMode === 'sanctuary' &&
      !this.zoneTransition.active;
    this.dachshundGroup.visible = activeInSanctuary;
    this.dachshundGroup.matrixWorldAutoUpdate = activeInSanctuary;
    if (this.heroCapy?.userData?.rearAssemblyGroup) {
      this.heroCapy.userData.rearAssemblyGroup.visible = !activeInSanctuary;
    }
  }

  private syncDachshundSkinAndOrange(overrideFurHex?: number) {
    const variety =
      HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex] ?? HEAD_ORANGE_VARIETIES[0];
    CapyModelGenerator.setHeadOrangeColor(
      this.heroCapy,
      variety.colorHex,
      variety.emissiveHex
    );

    const customFurHex =
      typeof overrideFurHex === 'number'
        ? overrideFurHex
        : parseHexColorString(
            this.proceduralConfig.player.furPrimaryHex,
            CapyModelGenerator.skinColors[this.stats.activeSkin] ?? CapyModelGenerator.skinColors.classic
          );
    const furColor = customFurHex;

    CapyModelGenerator.updateCapyAppearance(
      this.heroCapy,
      this.stats.activeHat,
      this.stats.activeSkin,
      this.stats.activeMutations,
      variety.colorHex,
      customFurHex
    );
    CapyModelGenerator.setHeadFruitStackCount(this.heroCapy, 1);

    const heroBodyMat = (this.heroCapy.getObjectByName('capyBody') as THREE.Mesh | undefined)
      ?.material as THREE.MeshStandardMaterial | undefined;

    const backFruitCount = Math.max(0, this.fruitsCarried - 1);
    for (let i = 0; i < this.dachshundSegments.length; i++) {
      const seg = this.dachshundSegments[i];
      CapyModelGenerator.setDachshundSegmentFruitState(
        seg,
        i < this.snakeSegmentCount && i < backFruitCount,
        variety.colorHex,
        variety.emissiveHex
      );
      seg.userData.bodyMat.roughness = this.stats.activeSkin === 'golden' ? 0.42 : 0.78;
      seg.userData.bodyMat.metalness = this.stats.activeSkin === 'golden' ? 0.34 : 0.02;
      if (heroBodyMat?.map) {
        seg.userData.bodyMat.map = heroBodyMat.map;
        const pSeg = seg.userData.bodyMat as THREE.MeshPhysicalMaterial;
        const pHero = heroBodyMat as THREE.MeshPhysicalMaterial;
        if (pSeg.sheenColor && pHero.sheenColor) {
          pSeg.sheen = pHero.sheen;
          pSeg.sheenRoughness = pHero.sheenRoughness;
          pSeg.sheenColor.copy(pHero.sheenColor);
        }
        seg.userData.bodyMat.needsUpdate = true;
      }
    }
    if (this.dachshundCaboose && heroBodyMat?.map && furColor) {
      this.dachshundCaboose.userData.bodyMat.map = heroBodyMat.map;
      this.dachshundCaboose.userData.bodyMat.roughness =
        this.stats.activeSkin === 'golden' ? 0.42 : 0.78;
      this.dachshundCaboose.userData.bodyMat.metalness =
        this.stats.activeSkin === 'golden' ? 0.34 : 0.02;
      const pCab = this.dachshundCaboose.userData.bodyMat as THREE.MeshPhysicalMaterial;
      const pHero = heroBodyMat as THREE.MeshPhysicalMaterial;
      if (pCab.sheenColor && pHero.sheenColor) {
        pCab.sheen = pHero.sheen;
        pCab.sheenRoughness = pHero.sheenRoughness;
        pCab.sheenColor.copy(pHero.sheenColor);
      }
      this.dachshundCaboose.userData.bodyMat.needsUpdate = true;
    }

    // Re-tint the 5 Matching Trees to match the hero's Head Orange variety,
    // and keep the 3 contrasting trees on distinct varieties
    let altCounter = 1;
    for (let t = 0; t < this.sanctuaryTrees.length; t++) {
      const tree = this.sanctuaryTrees[t];
      if (tree.matchesPlayerHead) {
        tree.varietyIndex = this.activeHeadOrangeIndex;
      } else {
        tree.varietyIndex =
          (this.activeHeadOrangeIndex + altCounter) % HEAD_ORANGE_VARIETIES.length;
        altCounter++;
      }
      const tv = HEAD_ORANGE_VARIETIES[tree.varietyIndex] ?? variety;
      tree.ringMat.color.setHex(tv.colorHex);
      tree.ringMat.emissive.setHex(tv.emissiveHex);
      for (let s = 0; s < tree.slots.length; s++) {
        const slot = tree.slots[s];
        slot.fruitMat.emissive.setHex(tv.emissiveHex);
        this.worldEnv.applyProceduralFruitGrowthVisuals(slot, tv.colorHex);
      }
    }
  }

  public growDachshundBody(count: number = 1, silent: boolean = false) {
    const variety =
      HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex] ?? HEAD_ORANGE_VARIETIES[0];
    for (let c = 0; c < count; c++) {
      if (this.snakeSegmentCount >= MAX_DACHSHUND_SEGMENTS) break;
      const segIdx = this.snakeSegmentCount;
      this.snakeSegmentCount++;
      if (segIdx < this.dachshundSegments.length) {
        this.dachshundSegments[segIdx].visible = true;
      } else {
        const seg = CapyModelGenerator.createDachshundSegment(
          this.stats.activeSkin,
          variety.colorHex,
          segIdx,
          this.currentCapyLodTier
        );
        seg.userData.__occluderRoot = seg;
        seg.userData.__isDachshundSegment = true;
        this.dachshundGroup.add(seg);
        this.dachshundSegments.push(seg);
      }

      // Initialize newly added spine node cleanly behind the preceding segment!
      if (this.spineInitialized) {
        const prevNode = segIdx; // 0 = hero, segIdx = previous segment
        const prevYaw = prevNode === 0 ? this.heroYaw : this.spineYaw[prevNode];
        const prevX = prevNode === 0 ? this.heroLocalPos.x : this.spineX[prevNode];
        const prevY = prevNode === 0 ? this.heroLocalPos.y : this.spineY[prevNode];
        const prevZ = prevNode === 0 ? this.heroLocalPos.z : this.spineZ[prevNode];
        const linkDist = prevNode === 0 ? SANE_HERO_LINK_DIST : DACHSHUND_SEGMENT_SPACING;
        const nodeIdx = segIdx + 1;
        this.spineX[nodeIdx] = prevX - Math.sin(prevYaw) * linkDist;
        this.spineY[nodeIdx] = prevY;
        this.spineZ[nodeIdx] = prevZ - Math.cos(prevYaw) * linkDist;
        this.spineYaw[nodeIdx] = prevYaw;

        const cabNode = this.snakeSegmentCount + 1;
        this.spineX[cabNode] = this.spineX[nodeIdx] - Math.sin(prevYaw) * SANE_CABOOSE_LINK_DIST;
        this.spineY[cabNode] = prevY;
        this.spineZ[cabNode] = this.spineZ[nodeIdx] - Math.cos(prevYaw) * SANE_CABOOSE_LINK_DIST;
        this.spineYaw[cabNode] = prevYaw;
      }
    }
    if (this.snakeSegmentCount > this.bestSnakeSegments) {
      this.bestSnakeSegments = this.snakeSegmentCount;
    }
    if (!silent) {
      this.emitTelemetry();
    }
  }

  public spawnPhysicsFruit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    radius: number,
    varietyIndex: number,
    inPond: boolean = false,
    pickupDelay: number = 0.08
  ): PhysicsFruit {
    const v = HEAD_ORANGE_VARIETIES[varietyIndex] ?? HEAD_ORANGE_VARIETIES[0];

    // Reuse an inactive fruit slot or recycle the oldest non-pond fruit in-place (zero allocations!)
    let slot: PhysicsFruit | null = null;
    for (let i = 0; i < this.physicsFruits.length; i++) {
      if (!this.physicsFruits[i].active) {
        slot = this.physicsFruits[i];
        break;
      }
    }

    if (!slot && this.physicsFruits.length >= MAX_PHYSICS_FRUITS) {
      slot = this.physicsFruits.find((f) => !f.inPond) ?? this.physicsFruits[0];
    }

    let mesh: CollectibleOrangeGroup;
    if (slot) {
      mesh = slot.mesh;
      if (mesh.userData.fruitMat) {
        mesh.userData.fruitMat.color.setHex(v.colorHex);
        mesh.userData.fruitMat.emissive.setHex(v.emissiveHex);
      }
      if (mesh.userData.haloMat) {
        mesh.userData.haloMat.color.setHex(v.colorHex);
      }
      mesh.userData.rollGroup?.rotation.set(0, 0, 0);
      mesh.userData.squashGroup?.scale.set(1, 1, 1);
      mesh.visible = true;
    } else {
      mesh = CapyModelGenerator.createCollectibleOrange(v.colorHex, v.emissiveHex, 0.28);
      mesh.userData.__occluderRoot = mesh;
      this.fruitsGroup.add(mesh);
    }

    mesh.scale.setScalar(radius / 0.28);
    mesh.position.set(x, y, z);

    if (slot) {
      slot.active = true;
      slot.inPond = inPond;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = vx;
      slot.vy = vy;
      slot.vz = vz;
      slot.radius = radius;
      slot.varietyIndex = varietyIndex;
      slot.squash = 0.16;
      slot.squashVel = -1.8;
      slot.pickupDelay = pickupDelay;
      slot.bobPhase = this.proceduralPrng() * Math.PI * 2;
      return slot;
    }

    const created: PhysicsFruit = {
      active: true,
      inPond,
      x,
      y,
      z,
      vx,
      vy,
      vz,
      radius,
      varietyIndex,
      squash: 0.16,
      squashVel: -1.8,
      pickupDelay,
      bobPhase: this.proceduralPrng() * Math.PI * 2,
      mesh,
    };
    this.physicsFruits.push(created);
    return created;
  }

  public bumpTreeAndSpawnFruits(
    tree: ExponentialFruitTree,
    impactDirX: number,
    impactDirZ: number
  ): number {
    if (tree.bumpCooldown > 0) return 0;
    tree.bumpCooldown = 0.48;

    // Elastic trunk & canopy sway impulse away from the bumping Capybara + AAA camera trauma & leaf/citrus burst
    const swayImpulse = 1.65 / Math.sqrt(tree.scale);
    tree.swayVelX += impactDirX * swayImpulse;
    tree.swayVelZ += impactDirZ * swayImpulse;
    this.heroSoftSquashVel -= 2.8;
    AudioService.playBrickHit(0.75 + 0.1 / tree.scale);
    this.addCameraTrauma(tree.varietyIndex === this.activeHeadOrangeIndex ? 0.38 : 0.18);
    NativeBridge.haptic(tree.varietyIndex === this.activeHeadOrangeIndex ? 'success' : 'tick');
    this.vfxEngine?.emitBurst(
      tree.x,
      1.6 * tree.scale,
      tree.z,
      'citrus_burst',
      8,
      HEAD_ORANGE_VARIETIES[tree.varietyIndex]?.colorHex
    );

    // STRICT RULE: Only spawn new fruits when bumping into a MATCHING tree!
    if (tree.varietyIndex !== this.activeHeadOrangeIndex) {
      const targetVariety = HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex];
      this.callbacks.onModeNotification?.(
        `Non-matching tree swayed — bump a matching ${targetVariety.name} tree to shake fruits loose!`
      );
      return 0;
    }

    let dropped = 0;
    for (let s = 0; s < tree.slots.length; s++) {
      const slot = tree.slots[s];
      if (slot.growth >= 0.72) {
        const wx = tree.x + slot.localOffset.x;
        const wy = Math.max(tree.fruitRadius + 0.35, slot.localOffset.y);
        const wz = tree.z + slot.localOffset.z;

        // Shake ripe fruit off branch with realistic outward + downward velocity
        const outAngle = Math.atan2(slot.localOffset.z, slot.localOffset.x);
        const radialSpeed = 1.15 + (s % 3) * 0.45;
        const vx = Math.cos(outAngle) * radialSpeed - impactDirX * 0.65;
        const vz = Math.sin(outAngle) * radialSpeed - impactDirZ * 0.65;
        const vy = 0.8 + (s % 2) * 0.6;

        this.spawnPhysicsFruit(
          wx,
          wy,
          wz,
          vx,
          vy,
          vz,
          tree.fruitRadius,
          tree.varietyIndex,
          false,
          0.08
        );

        // Reset branch bud to 4-stage procedural blossom (0.06) so it regrows live on the tree!
        slot.growth = 0.06;
        this.worldEnv.applyProceduralFruitGrowthVisuals(
          slot,
          HEAD_ORANGE_VARIETIES[tree.varietyIndex]?.colorHex ?? 0xff7a00
        );
        dropped++;
      }
    }

    if (dropped > 0) {
      const v = HEAD_ORANGE_VARIETIES[tree.varietyIndex];
      const cm = Math.round(tree.fruitRadius * 100);
      this.callbacks.onModeNotification?.(
        `Shook Tier ${tree.tier + 1} ${v.name} Tree! ${dropped} ripe ${cm}cm fruits fell & started rolling!`
      );
      this.emitTelemetry();
    } else {
      this.callbacks.onModeNotification?.(
        `Fruits on this Tier ${tree.tier + 1} tree are still ripening — watch the green buds grow!`
      );
    }

    return dropped;
  }

  public knockFruitOffBack(spawnX: number, spawnZ: number, pushX: number, pushZ: number) {
    if (this.fruitsCarried <= 1 || this.buddyBumpCooldown > 0) return;
    this.buddyBumpCooldown = 0.55;

    const prevCount = this.fruitsCarried;
    this.fruitsCarried = Math.max(1, this.fruitsCarried - 1);
    if (this.fruitsCarried === 1) {
      this.eatenFruitMass = 0;
    } else {
      this.eatenFruitMass = Math.max(
        0,
        this.eatenFruitMass * ((this.fruitsCarried - 1) / Math.max(1, prevCount - 1))
      );
    }
    this.syncLogarithmicBodyLength(true);

    // Pop a 3D physics fruit off the Capybara's back that bounces and rolls away!
    const norm = Math.hypot(pushX, pushZ) || 1;
    const nx = pushX / norm;
    const nz = pushZ / norm;
    this.spawnPhysicsFruit(
      spawnX + nx * 0.55,
      1.05,
      spawnZ + nz * 0.55,
      nx * 4.2,
      5.4,
      nz * 4.2,
      0.24,
      this.activeHeadOrangeIndex,
      false,
      1.15
    );

    this.heroSoftSquashVel -= 3.2;
    AudioService.playSplash();
    this.callbacks.onModeNotification?.(
      `Bumped another Capybara! Fruit knocked off your back — shrunk to ${this.logarithmicLengthMeters.toFixed(1)}m (${this.snakeSegmentCount} segs)`
    );
    this.emitTelemetry();
  }

  private resetDachshundTrail() {
    const backX = -Math.sin(this.heroYaw);
    const backZ = -Math.cos(this.heroYaw);
    const step = 0.14;
    const seedPoints = 420;
    this.snakePathCount = seedPoints;
    this.snakePathHead = seedPoints - 1;

    for (let i = 0; i < seedPoints; i++) {
      const distBehind = (seedPoints - 1 - i) * step;
      this.snakePathX[i] = this.heroLocalPos.x + backX * distBehind;
      this.snakePathY[i] = this.heroLocalPos.y;
      this.snakePathZ[i] = this.heroLocalPos.z + backZ * distBehind;
    }

    // Initialize explicit articulated solid-rod spine nodes straight behind Hero
    this.spineX[0] = this.heroLocalPos.x;
    this.spineY[0] = this.heroLocalPos.y;
    this.spineZ[0] = this.heroLocalPos.z;
    this.spineYaw[0] = this.heroYaw;

    let accumDist = 0;
    const totalNodes = this.snakeSegmentCount + 2;
    for (let n = 1; n < totalNodes; n++) {
      const linkLen =
        n === 1
          ? SANE_HERO_LINK_DIST
          : n === totalNodes - 1
            ? SANE_CABOOSE_LINK_DIST
            : DACHSHUND_SEGMENT_SPACING;
      accumDist += linkLen;
      this.spineX[n] = this.heroLocalPos.x + backX * accumDist;
      this.spineY[n] = this.heroLocalPos.y;
      this.spineZ[n] = this.heroLocalPos.z + backZ * accumDist;
      this.spineYaw[n] = this.heroYaw;
    }
    this.heroVelocity.set(0, 0, 0);
    this.isGrounded = this.heroLocalPos.y <= 0.05;
    this.isStuckNoFooting = false;
    this.spineInitialized = true;
  }

  private recordSnakeBreadcrumb() {
    const lastX = this.snakePathX[this.snakePathHead];
    const lastY = this.snakePathY[this.snakePathHead];
    const lastZ = this.snakePathZ[this.snakePathHead];
    const dx = this.heroLocalPos.x - lastX;
    const dy = this.heroLocalPos.y - lastY;
    const dz = this.heroLocalPos.z - lastZ;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq >= 0.012) {
      this.snakePathHead = (this.snakePathHead + 1) % SNAKE_PATH_CAPACITY;
      this.snakePathX[this.snakePathHead] = this.heroLocalPos.x;
      this.snakePathY[this.snakePathHead] = this.heroLocalPos.y;
      this.snakePathZ[this.snakePathHead] = this.heroLocalPos.z;
      if (this.snakePathCount < SNAKE_PATH_CAPACITY) {
        this.snakePathCount++;
      }
    }
  }

  /**
   * Biomechanical 2-joint quadruped limb animation powered by evaluateRealisticLimbPose:
   * - Asymmetric 58% stance / 42% swing duty cycle with plantar grip and genuine knee clearance.
   * - Reverses kinematics cleanly when `walkDir === -1` (walking backwards led by caboose).
   */
  private animateArticulatedLimb(
    limbRoot: THREE.Group,
    phase: number,
    walkDir: 1 | -1 = 1,
    hipAmp: number = 0.38,
    strideScale: number = 1.0
  ) {
    const pose = evaluateRealisticLimbPose(
      phase,
      walkDir,
      hipAmp,
      strideScale,
      this._limbPoseScratch
    );
    const lowerJoint = limbRoot.userData?.lowerJoint as THREE.Group | undefined;
    const pawGroup = limbRoot.userData?.pawGroup as THREE.Group | undefined;
    limbRoot.rotation.x = pose.hipPitch;
    if (lowerJoint) lowerJoint.rotation.x = pose.kneePitch;
    if (pawGroup) pawGroup.rotation.x = pose.anklePitch;
  }

  private resetArticulatedLimb(limbRoot: THREE.Group) {
    limbRoot.rotation.x = 0;
    const lowerJoint = limbRoot.userData?.lowerJoint as THREE.Group | undefined;
    const pawGroup = limbRoot.userData?.pawGroup as THREE.Group | undefined;
    if (lowerJoint) lowerJoint.rotation.x = 0;
    if (pawGroup) pawGroup.rotation.x = 0;
  }

  private getLimbVerticalDrop(limbRoot: THREE.Group, restHipHeight: number): number {
    const hipA = limbRoot.rotation.x;
    const lowerJoint = limbRoot.userData?.lowerJoint as THREE.Group | undefined;
    const kneeA = lowerJoint ? lowerJoint.rotation.x : 0;
    const upperLen = restHipHeight * 0.49;
    const lowerLen = restHipHeight * 0.51;
    return upperLen * Math.cos(hipA) + lowerLen * Math.cos(hipA + kneeA);
  }

  private getSupportSurfaceY(localX: number, localZ: number): number {
    const zone = ZONE_LOCATIONS[this.currentMode];
    const wx = zone.x + localX;
    const wz = zone.z + localZ;

    if (this.currentMode === 'sanctuary') {
      for (let i = 0; i < this.stats.buildings.length; i++) {
        const b = this.stats.buildings[i];
        if (b.type === 'trampoline_pad' && Math.hypot(localX - b.x, localZ - b.z) < 1.85) {
          const comp = this.physicsBridge?.getSoftPadCompression(`pad_${b.id}`) ?? 0;
          return 0.24 * (1 - comp);
        }
      }
    }

    const poolSpec = this.homePool
      ? {
          x: this.homePool.centerX,
          z: this.homePool.centerZ,
          radius: this.homePool.basinRadius,
        }
      : null;
    const seeSawTilt = this.physicsBridge?.getSeeSawTiltAngle() ?? 0;
    return sampleContiguousGroundY(wx, wz, poolSpec, seeSawTilt);
  }

  /**
   * Evaluates 3D foot sole ground contact across Hero front legs, every active Dachshund segment's
   * mid-legs, and the Hindquarters Caboose rear legs.
   * If 0 feet touch the ground (and not swimming), the Capybara has zero walking traction and gets stuck!
   */
  private evaluateFootContactsAndTraction() {
    const activeDachshund =
      this.currentMode === 'sanctuary' && !this.zoneTransition.active;
    let grounded = 0;
    let total = 0;
    const contactTol = 0.085;

    // 1. Hero Front Feet (FL, FR)
    const cosH = Math.cos(this.heroYaw);
    const sinH = Math.sin(this.heroYaw);
    const frontLegs: Array<[THREE.Group, number, number]> = [
      [this.heroCapy.userData.legFL, -0.27, 0.34],
      [this.heroCapy.userData.legFR, 0.27, 0.34],
    ];
    for (let i = 0; i < frontLegs.length; i++) {
      const [leg, lx, lz] = frontLegs[i];
      const fx = this.heroLocalPos.x + lx * cosH + lz * sinH;
      const fz = this.heroLocalPos.z - lx * sinH + lz * cosH;
      const drop = this.getLimbVerticalDrop(leg, 0.53);
      const soleY = this.heroLocalPos.y + 0.53 - drop;
      const groundY = this.getSupportSurfaceY(fx, fz);
      total++;
      if (soleY <= groundY + contactTol) grounded++;
    }

    if (activeDachshund) {
      // 2. Every Active Dachshund Segment's Walking Feet (midLegL, midLegR)
      for (let s = 0; s < this.snakeSegmentCount; s++) {
        const seg = this.dachshundSegments[s];
        if (!seg || !seg.visible) continue;
        const syaw = this.spineYaw[s + 1];
        const cosS = Math.cos(syaw);
        const sinS = Math.sin(syaw);
        const segY = this.spineY[s + 1];
        const segX = this.spineX[s + 1];
        const segZ = this.spineZ[s + 1];

        const segLegs: Array<[THREE.Group, number]> = [
          [seg.userData.midLegL, -0.27],
          [seg.userData.midLegR, 0.27],
        ];
        for (let k = 0; k < 2; k++) {
          const [leg, lx] = segLegs[k];
          const fx = segX + lx * cosS;
          const fz = segZ - lx * sinS;
          const drop = this.getLimbVerticalDrop(leg, 0.49);
          const soleY = segY + 0.49 - drop;
          const groundY = this.getSupportSurfaceY(fx, fz);
          total++;
          if (soleY <= groundY + contactTol) grounded++;
        }
      }

      // 3. Hindquarters Caboose Rear Feet (legBL, legBR)
      if (this.dachshundCaboose && this.dachshundCaboose.visible) {
        const cabNode = this.snakeSegmentCount + 1;
        const cyaw = this.spineYaw[cabNode];
        const cosC = Math.cos(cyaw);
        const sinC = Math.sin(cyaw);
        const cy = this.spineY[cabNode];
        const cx = this.spineX[cabNode];
        const cz = this.spineZ[cabNode];
        const rearLegs: Array<[THREE.Group, number, number]> = [
          [this.dachshundCaboose.userData.legBL, -0.27, -0.06],
          [this.dachshundCaboose.userData.legBR, 0.27, -0.06],
        ];
        for (let k = 0; k < 2; k++) {
          const [leg, lx, lz] = rearLegs[k];
          const fx = cx + lx * cosC + lz * sinC;
          const fz = cz - lx * sinC + lz * cosC;
          const drop = this.getLimbVerticalDrop(leg, 0.53);
          const soleY = cy + 0.53 - drop;
          const groundY = this.getSupportSurfaceY(fx, fz);
          total++;
          if (soleY <= groundY + contactTol) grounded++;
        }
      }
    } else {
      // Non-Dachshund 4-legged mode rear feet on heroCapy
      const rearLegs: Array<[THREE.Group, number, number]> = [
        [this.heroCapy.userData.legBL, -0.27, -0.34],
        [this.heroCapy.userData.legBR, 0.27, -0.34],
      ];
      for (let i = 0; i < rearLegs.length; i++) {
        const [leg, lx, lz] = rearLegs[i];
        const fx = this.heroLocalPos.x + lx * cosH + lz * sinH;
        const fz = this.heroLocalPos.z - lx * sinH + lz * cosH;
        const drop = this.getLimbVerticalDrop(leg, 0.53);
        const soleY = this.heroLocalPos.y + 0.53 - drop;
        const groundY = this.getSupportSurfaceY(fx, fz);
        total++;
        if (soleY <= groundY + contactTol) grounded++;
      }
    }

    this.groundedFeetCount = grounded;
    this.totalFeetCount = Math.max(4, total);
    this.isStuckNoFooting = !this.isSwimmingInPool && grounded === 0;
  }

  private updateDachshundTransforms(
    dt: number,
    isMoving: boolean = false,
    walkDir: 1 | -1 = 1,
    leaderDisp: number = 0
  ) {
    if (!this.spineInitialized) {
      this.resetDachshundTrail();
    }

    const totalNodes = this.snakeSegmentCount + 2;
    const isAirborneSearch = !this.isGrounded && !this.isSwimmingInPool;
    const strideScale = isMoving
      ? Math.min(1.22, Math.max(0.45, leaderDisp > 0.002 ? leaderDisp / Math.max(0.004, dt * 7.2) : 0.85))
      : 0;

    // Apply spine positions, yaws, terrain slope pitch, slight solid squash (<= 6%), and realistic 2-joint gaits
    for (let i = 0; i < this.dachshundSegments.length; i++) {
      const seg = this.dachshundSegments[i];
      if (i >= this.snakeSegmentCount) {
        seg.visible = false;
        continue;
      }
      seg.visible = true;
      const nodeIdx = i + 1;
      const sx = this.spineX[nodeIdx];
      const syPos = this.spineY[nodeIdx];
      const sz = this.spineZ[nodeIdx];
      const syaw = this.spineYaw[nodeIdx];

      seg.position.set(sx, syPos, sz);
      seg.rotation.order = 'YXZ';
      seg.rotation.y = syaw;

      // Align body segment pitch smoothly to both terrain slope and 3D spinal jump arc!
      if (this.suspendedFootTestHeight === null) {
        const fwdX = Math.sin(syaw) * 0.48;
        const fwdZ = Math.cos(syaw) * 0.48;
        const fY = this.getSupportSurfaceY(sx + fwdX, sz + fwdZ);
        const rY = this.getSupportSurfaceY(sx - fwdX, sz - fwdZ);
        const terrainPitch = computeTerrainPitchAngle(fY, rY, 0.96, 0.38);
        const prevIdx = nodeIdx - 1;
        const nextIdx = Math.min(totalNodes - 1, nodeIdx + 1);
        const spineHoriz = Math.max(
          0.35,
          Math.hypot(this.spineX[prevIdx] - this.spineX[nextIdx], this.spineZ[prevIdx] - this.spineZ[nextIdx])
        );
        const spineArcPitch = computeTerrainPitchAngle(
          this.spineY[prevIdx],
          this.spineY[nextIdx],
          spineHoriz,
          0.42
        );
        seg.rotation.x = Math.abs(spineArcPitch) > Math.abs(terrainPitch) ? spineArcPitch : terrainPitch;
      } else {
        seg.rotation.x = 0;
      }

      // Stiff solid-body elastic response (clamped strictly to +-6% slight squash!)
      this.segSoftSquashVel[i] +=
        (-135 * this.segSoftSquash[i] - 15.0 * this.segSoftSquashVel[i]) * dt;
      this.segSoftSquash[i] = THREE.MathUtils.clamp(
        this.segSoftSquash[i] + this.segSoftSquashVel[i] * dt,
        -MAX_SOLID_SQUASH,
        MAX_SOLID_SQUASH
      );
      const sy = 1 - this.segSoftSquash[i];
      const sxz = 1 / Math.sqrt(Math.max(0.85, sy));
      seg.scale.set(sxz, sy, sxz);

      if (isMoving) {
        seg.userData.walkCycle = this.heroCapy.userData.walkCycle - (i + 1) * 0.92;
        const segPhase = seg.userData.walkCycle;
        this.animateArticulatedLimb(seg.userData.midLegL, segPhase, walkDir, 0.37, strideScale);
        const leftRoll = this._limbPoseScratch.pelvicRoll;
        this.animateArticulatedLimb(
          seg.userData.midLegR,
          segPhase + Math.PI,
          walkDir,
          0.37,
          strideScale
        );
        seg.rotation.z = leftRoll * 0.85;
      } else {
        seg.rotation.z = 0;
        this.resetArticulatedLimb(seg.userData.midLegL);
        this.resetArticulatedLimb(seg.userData.midLegR);
      }
    }

    // Position Hindquarters Caboose at spine node N + 1 with realistic reverse/forward rear gait & whip tail wag
    if (this.dachshundCaboose) {
      const cabNode = totalNodes - 1;
      const cx = this.spineX[cabNode];
      const cyPos = this.spineY[cabNode];
      const cz = this.spineZ[cabNode];
      const cyaw = this.spineYaw[cabNode];

      this.dachshundCaboose.position.set(cx, cyPos, cz);
      this.dachshundCaboose.rotation.order = 'YXZ';
      this.dachshundCaboose.rotation.y = cyaw;

      if (this.suspendedFootTestHeight === null) {
        const fwdX = Math.sin(cyaw) * 0.42;
        const fwdZ = Math.cos(cyaw) * 0.42;
        const fY = this.getSupportSurfaceY(cx + fwdX, cz + fwdZ);
        const rY = this.getSupportSurfaceY(cx - fwdX, cz - fwdZ);
        const terrainPitch = computeTerrainPitchAngle(fY, rY, 0.84, 0.38);
        const prevIdx = Math.max(0, cabNode - 1);
        const cabHoriz = Math.max(
          0.35,
          Math.hypot(this.spineX[prevIdx] - cx, this.spineZ[prevIdx] - cz)
        );
        const spineArcPitch = computeTerrainPitchAngle(
          this.spineY[prevIdx],
          cyPos,
          cabHoriz,
          0.42
        );
        this.dachshundCaboose.rotation.x =
          Math.abs(spineArcPitch) > Math.abs(terrainPitch) ? spineArcPitch : terrainPitch;
      } else {
        this.dachshundCaboose.rotation.x = 0;
      }

      const lastIdx = Math.max(0, this.snakeSegmentCount - 1);
      const cSy = 1 - (this.segSoftSquash[lastIdx] || 0) * 0.85;
      const cSxz = 1 / Math.sqrt(Math.max(0.85, cSy));
      this.dachshundCaboose.scale.set(cSxz, cSy, cSxz);

      if (isMoving) {
        const rearPhase = this.heroCapy.userData.walkCycle - (this.snakeSegmentCount + 1) * 0.92;
        this.dachshundCaboose.userData.walkCycle = rearPhase;
        this.animateArticulatedLimb(
          this.dachshundCaboose.userData.legBL,
          rearPhase + Math.PI,
          walkDir,
          0.40,
          isAirborneSearch ? 0.9 : strideScale
        );
        this.animateArticulatedLimb(
          this.dachshundCaboose.userData.legBR,
          rearPhase,
          walkDir,
          0.40,
          isAirborneSearch ? 0.9 : strideScale
        );
        this.dachshundCaboose.rotation.z = this._limbPoseScratch.pelvicRoll;
        this.dachshundCaboose.userData.tailGroup.rotation.y =
          Math.sin(this.heroCapy.userData.walkCycle * 1.45) * 0.32;
      } else {
        this.dachshundCaboose.rotation.z = 0;
        this.dachshundCaboose.userData.tailGroup.rotation.y =
          Math.sin(performance.now() * 0.0035) * 0.12;
        this.resetArticulatedLimb(this.dachshundCaboose.userData.legBL);
        this.resetArticulatedLimb(this.dachshundCaboose.userData.legBR);
      }
    }
  }

  /**
   * Camera-to-Head Line-of-Sight Occlusion Transparency (95% Screen Clear + Faint Edge Outline):
   * Casts 4 sightline rays from the active camera to the Capybara's head & signature orange stack.
   * Any occluding object goes 100% transparent (`alpha = 0.0`, discarded) across 95% of the screen,
   * showing only a faint translucent outline (`alpha <= 0.25`) fading in around the outer edges so
   * the player still knows something is there without anything blocking their view.
   */
  private isDescendantOf(obj: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur === ancestor) return true;
      cur = cur.parent;
    }
    return false;
  }

  private resolveOccluderRoot(target: THREE.Object3D): THREE.Object3D {
    let bestRoot: THREE.Object3D = target;
    let cur: THREE.Object3D | null = target;
    while (cur) {
      if (cur.userData?.__occluderRoot) {
        bestRoot = cur.userData.__occluderRoot as THREE.Object3D;
      }
      cur = cur.parent;
    }
    return bestRoot;
  }

  private getOrBuildOccluderFadeMeshes(root: THREE.Object3D): THREE.Mesh[] {
    let cached = root.userData.__cachedFadeMeshes as THREE.Mesh[] | undefined;
    if (cached) return cached;
    cached = [];
    const stack: THREE.Object3D[] = [root];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.userData?.ignoreCameraFade) continue;
      const asMesh = node as THREE.Mesh;
      if (asMesh.isMesh) {
        const singleMat = Array.isArray(asMesh.material)
          ? asMesh.material[0]
          : asMesh.material;
        const isInvisibleHitbox =
          singleMat &&
          singleMat.userData.__origOpacity === undefined &&
          singleMat.opacity === 0;
        if (!isInvisibleHitbox) {
          cached.push(asMesh);
        }
      }
      for (let i = 0; i < node.children.length; i++) {
        stack.push(node.children[i]);
      }
    }
    root.userData.__cachedFadeMeshes = cached;
    return cached;
  }

  private markObjectHierarchyOccluded(target: THREE.Object3D) {
    const root = this.resolveOccluderRoot(target);
    if (this.currentFrameOccludedEntities.has(root)) return;
    const meshes = this.getOrBuildOccluderFadeMeshes(root);
    let addedAny = false;
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      if (!m.visible) continue;
      if (!this.currentFrameOccluders.has(m)) {
        this.currentFrameOccluders.add(m);
        this.currentFrameOccluderList.push(m);
      }
      addedAny = true;
    }
    if (addedAny) {
      this.currentFrameOccludedEntities.add(root);
    }
  }

  private prewarmOccluderShaderPrograms() {
    if (this.isSoftwareGl) return;
    const roots: THREE.Object3D[] = [];
    for (let i = 0; i < this.sanctuaryTrees.length; i++) {
      roots.push(this.sanctuaryTrees[i].rootGroup);
    }
    for (let i = 0; i < this.sanctuaryPortals.length; i++) {
      roots.push(this.sanctuaryPortals[i].mesh);
    }
    for (let i = 0; i < this.sanctuaryBuildingMeshes.length; i++) {
      roots.push(this.sanctuaryBuildingMeshes[i]);
    }
    if (this.homePool) {
      roots.push(this.homePool.tapFixtureGroup);
    }

    const swappedSamples: THREE.Mesh[] = [];
    for (let r = 0; r < roots.length; r++) {
      const meshes = this.getOrBuildOccluderFadeMeshes(roots[r]);
      for (let m = 0; m < meshes.length; m++) {
        const mesh = meshes[m];
        this.prepareMeshForOcclusionFade(mesh);
        if (!this.isSoftwareGl && r === 0 && mesh.userData.__occMaterial) {
          mesh.material = mesh.userData.__occMaterial;
          swappedSamples.push(mesh);
        }
      }
    }

    if (!this.isSoftwareGl && !this.isWebGpu && swappedSamples.length > 0) {
      (this.renderer as THREE.WebGLRenderer).compile(this.sanctuaryGroup, this.camera);
      for (let i = 0; i < swappedSamples.length; i++) {
        const mesh = swappedSamples[i];
        if (mesh.userData.__origMaterial) {
          mesh.material = mesh.userData.__origMaterial;
        }
      }
    } else if (swappedSamples.length > 0) {
      for (let i = 0; i < swappedSamples.length; i++) {
        const mesh = swappedSamples[i];
        if (mesh.userData.__origMaterial) {
          mesh.material = mesh.userData.__origMaterial;
        }
      }
    }
  }

  private prepareMeshForOcclusionFade(mesh: THREE.Mesh) {
    if (mesh.userData.__occluderPrepared) return;
    mesh.userData.__origMaterial = mesh.material;
    if (Array.isArray(mesh.material)) {
      mesh.userData.__occMaterial = mesh.material.map((m) => {
        const occMat = m.clone();
        delete occMat.userData.__occUniforms;
        occMat.userData.__origTransparent = m.transparent;
        occMat.userData.__origOpacity = m.opacity;
        occMat.userData.__origDepthWrite = m.depthWrite;
        installSightlineEdgeFadeShader(occMat, this.isWebGpu);
        return occMat;
      });
    } else if (mesh.material) {
      const orig = mesh.material;
      const occMat = orig.clone();
      delete occMat.userData.__occUniforms;
      occMat.userData.__origTransparent = orig.transparent;
      occMat.userData.__origOpacity = orig.opacity;
      occMat.userData.__origDepthWrite = orig.depthWrite;
      installSightlineEdgeFadeShader(occMat, this.isWebGpu);
      mesh.userData.__occMaterial = occMat;
    }
    mesh.userData.__occluderPrepared = true;
  }

  private setMeshOccluderBlend(
    mesh: THREE.Mesh,
    targetBlend: number,
    rate: number
  ): boolean {
    this.prepareMeshForOcclusionFade(mesh);
    const occMatProp = mesh.userData.__occMaterial;
    if (!occMatProp) return true;
    const origMatProp = mesh.userData.__origMaterial;
    const mats = Array.isArray(occMatProp) ? occMatProp : [occMatProp];
    const origMats = Array.isArray(origMatProp) ? origMatProp : [origMatProp];
    let allRestored = true;

    for (let i = 0; i < mats.length; i++) {
      const mat = mats[i];
      if (!mat) continue;
      const origMat = origMats[i];
      if (
        origMat &&
        'color' in mat &&
        'color' in origMat &&
        (mat as THREE.MeshStandardMaterial).color &&
        (origMat as THREE.MeshStandardMaterial).color
      ) {
        (mat as THREE.MeshStandardMaterial).color.copy(
          (origMat as THREE.MeshStandardMaterial).color
        );
      }

      const uniforms = installSightlineEdgeFadeShader(mat, this.isWebGpu);
      const origOpacity =
        (mat.userData.__origOpacity as number | undefined) ?? 1.0;

      const curBlend = uniforms.uCapyOccBlend.value;
      const nextBlend = curBlend + (targetBlend - curBlend) * rate;

      const origDepthWrite = Boolean(mat.userData.__origDepthWrite ?? true);
      const origTransparent = Boolean(mat.userData.__origTransparent ?? false);
      mat.transparent = origTransparent;

      if (targetBlend > 0.5) {
        allRestored = false;
        const snapped = nextBlend > 0.985 ? 1.0 : nextBlend;
        uniforms.uCapyOccBlend.value = snapped;
        mat.opacity = origOpacity;
        mat.depthWrite = origTransparent
          ? shouldEnableOccluderDepthWrite(snapped, origDepthWrite)
          : origDepthWrite;
        const vis = +THREE.MathUtils.lerp(origOpacity, 0.25, snapped).toFixed(4);
        mat.userData.__occBlend = snapped;
        mat.userData.__centerScreenOpacity = vis;
        mat.userData.__edgeOutlineMaxOpacity = vis;
      } else if (nextBlend <= 0.015) {
        uniforms.uCapyOccBlend.value = 0.0;
        mat.opacity = origOpacity;
        mat.depthWrite = origTransparent
          ? shouldEnableOccluderDepthWrite(0.0, origDepthWrite)
          : origDepthWrite;
        mat.userData.__occBlend = 0.0;
        mat.userData.__centerScreenOpacity = origOpacity;
        mat.userData.__edgeOutlineMaxOpacity = origOpacity;
      } else {
        allRestored = false;
        uniforms.uCapyOccBlend.value = nextBlend;
        mat.depthWrite = origTransparent
          ? shouldEnableOccluderDepthWrite(nextBlend, origDepthWrite)
          : origDepthWrite;
        const vis = +THREE.MathUtils.lerp(origOpacity, 0.25, nextBlend).toFixed(4);
        mat.userData.__occBlend = nextBlend;
        mat.userData.__centerScreenOpacity = vis;
        mat.userData.__edgeOutlineMaxOpacity = vis;
      }
    }

    if (allRestored) {
      if (mesh.userData.__origMaterial) {
        mesh.material = mesh.userData.__origMaterial;
      }
    } else if (mesh.material !== occMatProp) {
      mesh.material = occMatProp;
    }

    return allRestored;
  }

  public evaluateOccluderScreenAlpha(
    mesh: THREE.Mesh,
    sUvX: number,
    sUvY: number,
    fragViewDepth?: number
  ): number {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const u = mat?.userData?.__occUniforms;
    if (!u) return mat?.opacity ?? 1.0;
    return evaluateSightlineEdgeAlphaAtScreenUv(
      sUvX,
      sUvY,
      u.uCapyOccBlend.value,
      u.uCapyOccBounds.value.x,
      u.uCapyOccBounds.value.y,
      u.uCapyOccBounds.value.z,
      SHARED_OCCLUDER_VIEWPORT.x,
      SHARED_OCCLUDER_VIEWPORT.y,
      SHARED_OCCLUDER_HEAD_CLIP.x,
      SHARED_OCCLUDER_HEAD_CLIP.y,
      fragViewDepth,
      SHARED_OCCLUDER_TAIL_CLIP.x,
      SHARED_OCCLUDER_TAIL_CLIP.y,
      SHARED_OCCLUDER_HEAD_CLIP.w
    );
  }

  private blocksPlayerCorridor(
    sx: number,
    sy: number,
    sz: number,
    radius: number
  ): boolean {
    return (
      doesSphereBlockPlayerSightline(
        sx,
        sy,
        sz,
        radius,
        this.occCamX,
        this.occCamY,
        this.occCamZ,
        this.occHeadX,
        this.occHeadY,
        this.occHeadZ,
        0.35
      ) ||
      doesSphereBlockPlayerSightline(
        sx,
        sy,
        sz,
        radius,
        this.occCamX,
        this.occCamY,
        this.occCamZ,
        this.occTorsoX,
        this.occTorsoY,
        this.occTorsoZ,
        0.35
      )
    );
  }

  private isRightInFrontOfLens(
    sx: number,
    sy: number,
    sz: number,
    radius: number
  ): boolean {
    const relX = sx - this.occCamX;
    const relY = sy - this.occCamY;
    const relZ = sz - this.occCamZ;
    const fwd = relX * _camForward.x + relY * _camForward.y + relZ * _camForward.z;
    const maxLensDepth = Math.min(2.6, Math.max(0.4, this.occPlayerPlaneDepth - 0.35));
    if (fwd <= -radius * 0.45 || fwd >= maxLensDepth) return false;
    const clampedFwd = Math.max(0, fwd);
    const px = relX - _camForward.x * clampedFwd;
    const py = relY - _camForward.y * clampedFwd;
    const pz = relZ - _camForward.z * clampedFwd;
    const lensRadius = radius + 0.55;
    return px * px + py * py + pz * pz <= lensRadius * lensRadius;
  }

  public updateHeadLineOfSightTransparency(dt: number) {
    this.currentFrameOccluders.clear();
    this.currentFrameOccluderList.length = 0;
    this.currentFrameOccludedEntities.clear();

    this.renderer.getDrawingBufferSize(_rendererSizeVec2);
    if (_rendererSizeVec2.x > 10 && _rendererSizeVec2.y > 10) {
      SHARED_OCCLUDER_VIEWPORT.set(
        _rendererSizeVec2.x,
        _rendererSizeVec2.y
      );
    } else {
      const dom = this.renderer.domElement;
      if (dom && dom.clientWidth > 10 && dom.clientHeight > 10) {
        const pr = this.renderer.getPixelRatio() || 1;
        SHARED_OCCLUDER_VIEWPORT.set(dom.clientWidth * pr, dom.clientHeight * pr);
      }
    }

    const skipCapytorioObliqueFade =
      this.currentMode === 'capytorio' && this.getCapytorioCameraMode() !== 'chase';
    if (
      this.cosmicStage === 'playing' &&
      this.heroCapy.visible &&
      !this.zoneTransition.active &&
      !skipCapytorioObliqueFade
    ) {
      this.camera.updateMatrixWorld();
      this.heroCapy.updateWorldMatrix(true, true);
      const activeGroup =
        this.currentMode === 'sanctuary'
          ? this.sanctuaryGroup
          : this.currentMode === 'spore'
            ? this.sporeGroup
            : this.currentMode === 'capytorio'
              ? this.capytorioGroup
              : this.currentMode === 'runner'
                ? this.runnerGroup
                : this.fallGuysGroup;
      activeGroup.updateMatrixWorld();
      this.heroCapy.userData.head.getWorldPosition(_headWorldPos);
      _headWorldPos.y += 0.16;
      this.heroCapy.getWorldPosition(_heroTorsoWorldPos);
      _heroTorsoWorldPos.y += 0.38;

      // Extract orthonormal camera basis directly from camera.matrixWorld (zero allocation)
      const me = this.camera.matrixWorld.elements;
      _camRight.set(me[0], me[1], me[2]).normalize();
      _camUp.set(me[4], me[5], me[6]).normalize();
      _camForward.set(-me[8], -me[9], -me[10]).normalize();

      const camX = this.camera.position.x;
      const camY = this.camera.position.y;
      const camZ = this.camera.position.z;

      _rayDir.subVectors(_headWorldPos, this.camera.position);
      const centerDist = _rayDir.length();
      const headDepth = Math.max(
        0.5,
        (_headWorldPos.x - camX) * _camForward.x +
          (_headWorldPos.y - camY) * _camForward.y +
          (_headWorldPos.z - camZ) * _camForward.z
      );
      const torsoDepth = Math.max(
        0.5,
        (_heroTorsoWorldPos.x - camX) * _camForward.x +
          (_heroTorsoWorldPos.y - camY) * _camForward.y +
          (_heroTorsoWorldPos.z - camZ) * _camForward.z
      );

      _occProjectedNdc.copy(_headWorldPos).project(this.camera);
      const headUvX = _occProjectedNdc.x * 0.5 + 0.5;
      const headUvY = _occProjectedNdc.y * 0.5 + 0.5;
      SHARED_OCCLUDER_HEAD_UV.set(headUvX, headUvY);

      _occProjectedNdc.copy(_heroTorsoWorldPos).project(this.camera);
      const tailUvX = _occProjectedNdc.x * 0.5 + 0.5;
      const tailUvY = _occProjectedNdc.y * 0.5 + 0.5;

      // Large aspect-invariant cutout radius covering Capybara + immediate play area (~2.25m clearance)
      const halfFovRad = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
      const viewHeightWorld =
        (2.0 * headDepth * Math.tan(halfFovRad)) / Math.max(0.25, this.camera.zoom);
      const safeAspect = Math.max(
        0.25,
        SHARED_OCCLUDER_VIEWPORT.x / Math.max(10, SHARED_OCCLUDER_VIEWPORT.y)
      );
      const minDimWorldSpan = Math.max(0.5, viewHeightWorld * Math.min(1.0, safeAspect));
      const heroScale = Math.max(0.75, this.heroCapy.scale.x || 1.0);
      const innerRadiusNorm = THREE.MathUtils.clamp(
        (2.25 * heroScale) / minDimWorldSpan,
        0.24,
        0.36
      );
      SHARED_OCCLUDER_HEAD_CLIP.set(headUvX, headUvY, headDepth, innerRadiusNorm);
      SHARED_OCCLUDER_TAIL_CLIP.set(tailUvX, tailUvY, torsoDepth, 0.08);

      const torsoX = _heroTorsoWorldPos.x;
      const torsoY = _heroTorsoWorldPos.y;
      const torsoZ = _heroTorsoWorldPos.z;
      const headX = _headWorldPos.x;
      const headY = _headWorldPos.y;
      const headZ = _headWorldPos.z;

      const horizDx = headX - camX;
      const horizDz = headZ - camZ;
      const horizLen = Math.hypot(horizDx, horizDz);
      const horizDirX = horizLen > 0.1 ? horizDx / horizLen : 0;
      const horizDirZ = horizLen > 0.1 ? horizDz / horizLen : -1;
      const playerPlaneDepth = Math.max(0.6, Math.min(headDepth, torsoDepth));
      this.occCamX = camX;
      this.occCamY = camY;
      this.occCamZ = camZ;
      this.occHeadX = headX;
      this.occHeadY = headY;
      this.occHeadZ = headZ;
      this.occTorsoX = torsoX;
      this.occTorsoY = torsoY;
      this.occTorsoZ = torsoZ;
      this.occPlayerPlaneDepth = playerPlaneDepth;

      if (centerDist > 0.45) {
        _occluderCandidates.length = 0;

        if (this.currentMode === 'sanctuary') {
          const zx = ZONE_LOCATIONS.sanctuary.x;
          const zz = ZONE_LOCATIONS.sanctuary.z;

          // 1. Procedural Exponential Fruit Trees: trigger ONLY if blocking Capybara corridor or right in front of lens.
          //    Side trees stay 100% solid unless their actual mesh enters the sightline/near-lens rays.
          for (let i = 0; i < this.sanctuaryTrees.length; i++) {
            const tr = this.sanctuaryTrees[i];
            const wx = zx + tr.x;
            const wz = zz + tr.z;
            const cr = tr.crownRadius;
            const th = tr.trunkHeight;
            const horizProj = (wx - camX) * horizDirX + (wz - camZ) * horizDirZ;
            const inFrontOfPlayer = horizLen > 0.5 && horizProj < horizLen - 0.25;
            if (!inFrontOfPlayer || horizProj <= -cr * 0.85) continue;

            const trunkCheckRadius = Math.max(0.28, tr.trunkRadius * 1.05);
            const blocksTrunkOrLens =
              this.isRightInFrontOfLens(wx, th * 0.65, wz, Math.max(0.75, cr * 0.58)) ||
              this.blocksPlayerCorridor(wx, th * 0.34, wz, trunkCheckRadius) ||
              this.blocksPlayerCorridor(wx, th * 0.68, wz, trunkCheckRadius * 0.92);

            if (blocksTrunkOrLens) {
              this.markObjectHierarchyOccluded(tr.rootGroup);
            } else {
              const candRadius = cr + 0.9;
              if (
                distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <=
                candRadius * candRadius
              ) {
                tr.rootGroup.userData.__isSanctuaryTree = true;
                _occluderCandidates.push(tr.rootGroup);
              }
            }
          }

          // 2. Home Pool Wooden Tap Post ONLY (rim stones & water surface have ignoreCameraFade = true)
          if (this.homePool) {
            const postWx =
              zx + this.homePool.centerX - this.homePool.basinRadius + 0.72;
            const postWz = zz + this.homePool.centerZ;
            const postProj =
              (postWx - camX) * horizDirX + (postWz - camZ) * horizDirZ;
            if (postProj > -0.6 && postProj < horizLen - 0.25) {
              if (
                this.isRightInFrontOfLens(postWx, 1.45, postWz, 0.85) ||
                this.blocksPlayerCorridor(postWx, 1.55, postWz, 0.72)
              ) {
                this.markObjectHierarchyOccluded(this.homePool.tapFixtureGroup);
              } else if (
                distSqPointToSegment2D(postWx, postWz, camX, camZ, headX, headZ) <=
                2.56
              ) {
                _occluderCandidates.push(this.homePool.tapFixtureGroup);
              }
            }
          }

          // 3. Tall Sanctuary Buildings ONLY (skip ground-level hot_spring & trampoline_pad!)
          for (let i = 0; i < this.sanctuaryBuildingMeshes.length; i++) {
            const bm = this.sanctuaryBuildingMeshes[i];
            const bType = bm.userData.buildingType as string | undefined;
            if (
              bm.userData?.ignoreCameraFade ||
              bType === 'hot_spring' ||
              bType === 'trampoline_pad'
            ) {
              continue;
            }
            const wx = zx + bm.position.x;
            const wz = zz + bm.position.z;
            const s = bm.scale.x || 1.0;
            const bRadius = 1.9 * s;
            const bHeight = 3.2 * s;
            const horizProj = (wx - camX) * horizDirX + (wz - camZ) * horizDirZ;
            if (horizLen <= 0.5 || horizProj <= -bRadius || horizProj >= horizLen - 0.25) {
              continue;
            }

            const blocks =
              this.isRightInFrontOfLens(wx, bHeight * 0.55, wz, bRadius * 0.85) ||
              this.blocksPlayerCorridor(wx, bHeight * 0.45, wz, bRadius * 0.78) ||
              this.blocksPlayerCorridor(wx, bHeight * 0.85, wz, bRadius * 0.82);

            if (blocks) {
              this.markObjectHierarchyOccluded(bm);
            } else {
              const candR = bRadius + 0.9;
              if (
                distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <=
                candR * candR
              ) {
                _occluderCandidates.push(bm);
              }
            }
          }

          // 4. World Portals: only when blocking sightline or right in front of lens
          for (let i = 0; i < this.sanctuaryPortals.length; i++) {
            const p = this.sanctuaryPortals[i];
            const wx = zx + p.x;
            const wz = zz + p.z;
            const horizProj = (wx - camX) * horizDirX + (wz - camZ) * horizDirZ;
            if (horizProj <= -1.8 || horizProj >= horizLen - 0.25) continue;
            if (
              this.isRightInFrontOfLens(wx, 2.2, wz, 1.65) ||
              this.blocksPlayerCorridor(wx, 2.1, wz, 1.65) ||
              this.blocksPlayerCorridor(wx, 3.6, wz, 1.45)
            ) {
              this.markObjectHierarchyOccluded(p.mesh);
            } else if (
              distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <= 6.25
            ) {
              _occluderCandidates.push(p.mesh);
            }
          }

          // 5. Large Elevated Physics Fruits directly crossing sightline or lens
          for (let i = 0; i < this.physicsFruits.length; i++) {
            const f = this.physicsFruits[i];
            if (!f.active || f.radius < 0.35) continue;
            const wx = zx + f.x;
            const wz = zz + f.z;
            const horizProj = (wx - camX) * horizDirX + (wz - camZ) * horizDirZ;
            if (horizProj <= -f.radius || horizProj >= horizLen - 0.25) continue;
            if (
              (f.radius >= 0.48 || f.y > 0.75) &&
              (this.isRightInFrontOfLens(wx, f.y, wz, f.radius * 0.95) ||
                this.blocksPlayerCorridor(wx, f.y, wz, f.radius * 0.95))
            ) {
              this.markObjectHierarchyOccluded(f.mesh);
            } else {
              const rF = f.radius + 0.65;
              if (
                distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <=
                rF * rF
              ) {
                _occluderCandidates.push(f.mesh);
              }
            }
          }

          // 6. Wandering Sanctuary Capybara Buddies ONLY if directly crossing sightline or lens
          for (let i = 0; i < this.sanctuaryCapys.length; i++) {
            const buddy = this.sanctuaryCapys[i].capy;
            if (!buddy.visible) continue;
            const wx = zx + buddy.position.x;
            const wz = zz + buddy.position.z;
            const horizProj = (wx - camX) * horizDirX + (wz - camZ) * horizDirZ;
            if (horizProj <= -0.8 || horizProj >= horizLen - 0.25) continue;
            if (this.isRightInFrontOfLens(wx, 0.7, wz, 0.75)) {
              this.markObjectHierarchyOccluded(buddy);
            } else if (
              distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <= 1.69
            ) {
              _occluderCandidates.push(buddy);
            }
          }

          // 7. Coiled Trailing Dachshund Segments (idx >= 2): only fade if directly crossing sightline rays
          for (let i = 2; i < this.snakeSegmentCount; i++) {
            const seg = this.dachshundSegments[i];
            if (
              seg &&
              seg.visible &&
              distSqPointToSegment2D(
                zx + seg.position.x,
                zz + seg.position.z,
                camX,
                camZ,
                headX,
                headZ
              ) <= 1.44
            ) {
              _occluderCandidates.push(seg);
            }
          }
        } else if (this.currentMode === 'capytorio') {
          this.capytorioRenderer?.collectOccluderCandidates(
            _occluderCandidates,
            this.getCapytorioCameraMode() === 'chase'
          );
        } else {
          const oz = ZONE_LOCATIONS[this.currentMode];
          for (let i = 0; i < activeGroup.children.length; i++) {
            const child = activeGroup.children[i];
            if (!child.visible || child.userData?.ignoreCameraFade || child.position.y <= -0.15) {
              continue;
            }
            const wx = oz.x + child.position.x;
            const wz = oz.z + child.position.z;
            const horizProj = (wx - camX) * horizDirX + (wz - camZ) * horizDirZ;
            if (horizProj <= -1.2 || horizProj >= horizLen - 0.25) continue;
            if (
              distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <= 7.84
            ) {
              if (!child.userData.__occluderRoot) {
                child.userData.__occluderRoot = child;
              }
              _occluderCandidates.push(child);
            }
          }
        }

        if (_occluderCandidates.length > 0) {
          // Cast 7 focused sightline rays around Capybara + immediate play area AND 5 tight central
          // near-lens rays (<= 2.6m from camera). Off-center side props never trigger.
          const TOTAL_PLAYER_RAYS = 7;
          const NEAR_LENS_RAYS = 5;

          for (let r = 0; r < TOTAL_PLAYER_RAYS + NEAR_LENS_RAYS; r++) {
            let maxRayDist = 0;
            if (r < TOTAL_PLAYER_RAYS) {
              if (r === 6) {
                _rayTargetPos.copy(_heroTorsoWorldPos);
              } else {
                _rayTargetPos.copy(_headWorldPos);
                if (r === 1) {
                  _rayTargetPos.y += 0.36;
                } else if (r === 2) {
                  _rayTargetPos.addScaledVector(_camRight, 0.65);
                } else if (r === 3) {
                  _rayTargetPos.addScaledVector(_camRight, -0.65);
                } else if (r === 4) {
                  _rayTargetPos.y += 0.62;
                } else if (r === 5) {
                  _rayTargetPos.copy(_heroTorsoWorldPos);
                  _rayTargetPos.y += 0.15;
                }
              }
              _rayDir.subVectors(_rayTargetPos, this.camera.position);
              const dist = _rayDir.length();
              if (dist <= 0.45) continue;
              _rayDir.multiplyScalar(1 / dist);
              maxRayDist = Math.max(0.12, dist - 0.3);
            } else {
              const lensIdx = r - TOTAL_PLAYER_RAYS;
              const ndcX = lensIdx === 1 ? -0.22 : lensIdx === 2 ? 0.22 : 0.0;
              const ndcY = lensIdx === 3 ? -0.22 : lensIdx === 4 ? 0.22 : 0.0;
              _occProjectedNdc.set(ndcX, ndcY, 0.5).unproject(this.camera);
              _rayDir.subVectors(_occProjectedNdc, this.camera.position);
              const dLen = _rayDir.length();
              if (dLen <= 0.001) continue;
              _rayDir.multiplyScalar(1 / dLen);
              const forwardDot =
                _rayDir.x * _camForward.x +
                _rayDir.y * _camForward.y +
                _rayDir.z * _camForward.z;
              if (forwardDot <= 0.35) continue;
              const maxAllowedPlayer = (playerPlaneDepth - 0.35) / forwardDot;
              maxRayDist = Math.min(2.6 / forwardDot, Math.max(0.12, maxAllowedPlayer));
              if (maxRayDist <= 0.15) continue;
            }

            _occluderRaycaster.set(this.camera.position, _rayDir);
            _occluderRaycaster.near = 0.05;
            _occluderRaycaster.far = maxRayDist;

            _rayHits.length = 0;
            _occluderRaycaster.intersectObjects(_occluderCandidates, true, _rayHits);

            for (let h = 0; h < _rayHits.length; h++) {
              const hitObj = _rayHits[h].object as THREE.Mesh;
              if (!hitObj || !hitObj.isMesh || !hitObj.visible) continue;
              if (hitObj.userData?.ignoreCameraFade) continue;
              if (this.isDescendantOf(hitObj, this.heroCapy)) continue;
              const resolvedRoot = this.resolveOccluderRoot(hitObj);
              if (resolvedRoot.userData?.__isDachshundSegment && r > 1 && r < TOTAL_PLAYER_RAYS) {
                continue;
              }
              this.markObjectHierarchyOccluded(resolvedRoot);
            }
          }
        }
      }
    }

    const fadeOutRate = Math.min(1, dt * 14);
    const restoreRate = Math.min(1, dt * 10);

    for (let i = 0; i < this.currentFrameOccluderList.length; i++) {
      const mesh = this.currentFrameOccluderList[i];
      if (!mesh.userData.__inOccluderList) {
        mesh.userData.__inOccluderList = true;
        this.fadedOccluderMeshes.push(mesh);
      }
      this.setMeshOccluderBlend(mesh, 1.0, fadeOutRate);
    }

    for (let i = this.fadedOccluderMeshes.length - 1; i >= 0; i--) {
      const mesh = this.fadedOccluderMeshes[i];
      if (this.currentFrameOccluders.has(mesh)) continue;
      const restored = this.setMeshOccluderBlend(mesh, 0.0, restoreRate);
      if (restored) {
        mesh.userData.__inOccluderList = false;
        this.fadedOccluderMeshes.splice(i, 1);
      }
    }

    this.occludedObjectsFadedCount = this.currentFrameOccludedEntities.size;
  }

  // ============================================================================
  // PER-FRAME GAME LOOP (SHARED WORLD + 60 FPS LOD GOVERNOR + ATMOSPHERE/WEATHER)
  // ============================================================================
  public tick(delta: number, rawFrameDt?: number) {
    this.profiler.beginFrame();
    const tickStartMs = performance.now();
    const dt = Math.min(delta, 0.1);
    if (this.portalCooldown > 0) this.portalCooldown -= dt;
    if (this.snakeSelfHitCooldown > 0) this.snakeSelfHitCooldown -= dt;
    if (this.buddyBumpCooldown > 0) this.buddyBumpCooldown -= dt;
    if (this.mouthFullNotifyCooldown > 0) this.mouthFullNotifyCooldown -= dt;
    if (this.sporeLargeCritterKnockbackCd > 0) this.sporeLargeCritterKnockbackCd -= dt;
    if (this.heroDashCooldown > 0) this.heroDashCooldown = Math.max(0, this.heroDashCooldown - dt);
    if (this.heroDashActiveTimer > 0) this.heroDashActiveTimer = Math.max(0, this.heroDashActiveTimer - dt);
    if (tickComboDecay(this.comboState, dt)) {
      if (!this.comboState.active) {
        this.emitTelemetry();
      }
    }

    // Monitor live frame rate to dynamically scale Capybara mesh detail at smooth 60 FPS
    const measuredFps = this.isSoftwareGl
      ? 60
      : 1 / Math.max(0.004, rawFrameDt ?? delta);
    this.ingestFpsSample(measuredFps, dt);

    // Update GPU Day/Night solar/lunar lighting, sky dome, weather & coupled shallow-water ripples
    const seamlessSurfaceWindow =
      this.seamlessZoomActive &&
      this.currentLogScaleMeters >= -0.85 &&
      this.currentLogScaleMeters <= 4.15;
    if (
      ((this.sanctuaryGroup.visible ||
        this.sporeGroup.visible ||
        this.capytorioGroup.visible ||
        this.runnerGroup.visible ||
        this.fallGuysGroup.visible) &&
        (this.cosmicStage === 'capy_selection' ||
          this.cosmicStage === 'playing' ||
          this.cosmicStage === 'planet_descent')) ||
      seamlessSurfaceWindow
    ) {
      const isPerfMode = this.settings.gpuQualityPreset === 'performance';
      this.profiler.startPhase('world_simulation');
      const rippleTex = RealisticWorldEnvironment.getWaterRippleTexture();
      const waveMult = this.proceduralConfig.world.waterWaveSpeed ?? 1.0;
      rippleTex.offset.x = (rippleTex.offset.x + dt * 0.032 * waveMult) % 1;
      rippleTex.offset.y = (rippleTex.offset.y + dt * 0.021 * waveMult) % 1;

      if (!isPerfMode || (this.bgDistrictFrameCounter & 1) === 0) {
        if (this.physicsBridge?.fluidSolver) {
          this.physicsBridge.fluidSolver.writeGpuWakeParams(
            this.heroCapy.position.x,
            this.heroCapy.position.z,
            Math.hypot(this.heroVelocity.x, this.heroVelocity.z),
            this.gpuWakeParamsScratch
          );
          this.gpuEngine?.setGpuWakeParams(
            this.gpuWakeParamsScratch[0],
            this.gpuWakeParamsScratch[1],
            this.gpuWakeParamsScratch[2],
            this.gpuWakeParamsScratch[3]
          );
        }
        const fluidBytes = this.physicsBridge?.fluidSolver.packRippleTextureBytes();
        const rippleDataTex =
          this.sporeRippleTexture ??
          RealisticWorldEnvironment.createWaterRippleDataTexture();
        if (fluidBytes && rippleDataTex.image?.data instanceof Uint8Array) {
          rippleDataTex.image.data.set(fluidBytes);
          rippleDataTex.needsUpdate = true;
        }
      }
      const sporeWaterUniforms = this.sporeWaterMat?.userData?.__waterUniforms as
        | { uWaterTime?: { value: number } }
        | undefined;
      if (sporeWaterUniforms?.uWaterTime) {
        sporeWaterUniforms.uWaterTime.value += dt * waveMult;
      }

      if (this.chronoPad) {
        const heroNearPad =
          this.currentMode === 'sanctuary' &&
          Math.hypot(
            this.heroLocalPos.x - this.chronoPad.wx,
            this.heroLocalPos.z - this.chronoPad.wz
          ) <=
            this.chronoPad.radius + 0.6;
        this.chronoPad.update(
          dt,
          !this.seamlessZoomActive || heroNearPad,
          parseHexColorString(this.proceduralConfig.player.vesselCherenkovHex, 0x06b6d4)
        );
      }

      const exposureScale = (this.settings.gpuExposure ?? 1.02) / 1.02;
      this.worldEnv.tickAtmosphereAndWeather(
        dt,
        this.settings.dayNightAutoCycle !== false,
        this.settings.timeOfDayHours ?? 9.5,
        this.settings.weatherMode ?? 'auto',
        this.heroCapy.position.x,
        this.heroCapy.position.z,
        this.scene,
        this.renderer,
        false,
        this.homePool?.lanternLight,
        exposureScale,
        this.proceduralConfig.world.dayCycleSpeed ?? 1.0,
        this.proceduralConfig.graphics.fogDensity ?? 1.0,
        isPerfMode,
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z
      );
      if (!isPerfMode) {
        this.worldEnv.tickTrees(this.sanctuaryTrees, dt);
      }
      if (this.seamlessUniverse.forestGroveGroup.visible) {
        this.seamlessUniverse.tickWoodlandCapys(dt);
      }
      this.updateBioluminescentNightGlow();
      this.profiler.endPhase('world_simulation');
    }

    // 0. Handle Seamless 63-Orders-of-Magnitude Universe Zoom (+30 Multiverse <-> +0.8 Forest <-> -35 Photon)
    if (this.seamlessZoomActive) {
      this.profiler.startPhase('cosmic_universe');
      this.tickSeamlessUniverse(dt);
      this.profiler.endPhase('cosmic_universe');

      const activeBandId = UNIVERSE_SCALE_BANDS[findNearestScaleBandIndex(this.currentLogScaleMeters)].id;
      this.trackSettledBandForThumbnail(activeBandId, dt);

      const orbBlend = computeOrbitalSurfaceBlend(this.currentLogScaleMeters, this.isSoftwareGl);
      this.profiler.startPhase('gpu_shadow_cascade');
      this.gpuEngine.updateLightingAndShadowCascade(
        dt,
        this.heroCapy.position.x,
        this.heroCapy.position.y,
        this.heroCapy.position.z,
        0,
        orbBlend.inSurfaceWindow && orbBlend.terrestrialBlend > 0.25,
        this.worldEnv.currentNightFactor,
        this.worldEnv.currentSunDir,
        this.worldEnv.currentMoonDir,
        this.worldEnv.activeShadowCaster,
        this.worldEnv.getDayPhaseLabel(),
        this.worldEnv.timeOfDayHours,
        this.worldEnv.currentIblEnvIntensity
      );
      this.profiler.endPhase('gpu_shadow_cascade');
      this.renderSceneFrame(rawFrameDt, tickStartMs);
      return;
    }

    // 1. Handle Cosmic Stages & Capybara Selection before active gameplay
    if (this.cosmicStage !== 'playing') {
      this.profiler.startPhase('cosmic_universe');
      this.tickCosmicExperience(dt);
      this.profiler.endPhase('cosmic_universe');

      this.profiler.startPhase('gpu_shadow_cascade');
      this.gpuEngine.updateLightingAndShadowCascade(
        dt,
        this.heroCapy.position.x,
        this.heroCapy.position.y,
        this.heroCapy.position.z,
        0,
        this.cosmicStage === 'capy_selection',
        this.worldEnv.currentNightFactor,
        this.worldEnv.currentSunDir,
        this.worldEnv.currentMoonDir,
        this.worldEnv.activeShadowCaster,
        this.worldEnv.getDayPhaseLabel(),
        this.worldEnv.timeOfDayHours,
        this.worldEnv.currentIblEnvIntensity
      );
      this.profiler.endPhase('gpu_shadow_cascade');

      this.profiler.startPhase('sightline_occlusion');
      this.updateHeadLineOfSightTransparency(dt);
      this.profiler.endPhase('sightline_occlusion');

      this.renderSceneFrame(rawFrameDt, tickStartMs);
      return;
    }

    // Fast World Zone Glide when moving between games in the shared 3D world
    if (this.zoneTransition.active) {
      this.syncDachshundVisibility();
      this.zoneTransition.elapsed += dt;
      const t = Math.min(1, this.zoneTransition.elapsed / this.zoneTransition.duration);
      const ease = 1 - Math.pow(1 - t, 3);
      this.heroCapy.position.lerpVectors(
        this.zoneTransition.fromWorldPos,
        this.zoneTransition.toWorldPos,
        ease
      );
      // Slight arc in the air while zipping across the archipelago
      this.heroCapy.position.y += Math.sin(t * Math.PI) * 6.5;
      this.animateCapyLegs(this.heroCapy, dt, 22);

      const distScale = this.settings.cameraDistance || 1.0;
      _camTarget.set(
        this.heroCapy.position.x,
        this.heroCapy.position.y + 8.5 * distScale,
        this.heroCapy.position.z + 12.5 * distScale
      );
      this.camera.position.lerp(_camTarget, 0.35);
      this.camera.lookAt(this.heroCapy.position);

      if (t >= 1) {
        this.zoneTransition.active = false;
        this.syncDachshundVisibility();
        if (this.currentMode === 'sanctuary') {
          this.resetDachshundTrail();
          this.updateDachshundTransforms(0);
        }
        this.snapCameraToCurrentZone();
      }

      if (this.homePool) {
        _cachedPoolSpec.x = this.homePool.centerX;
        _cachedPoolSpec.z = this.homePool.centerZ;
        _cachedPoolSpec.radius = this.homePool.basinRadius;
      }
      const glideGroundY = sampleContiguousGroundY(
        this.heroCapy.position.x,
        this.heroCapy.position.z,
        this.homePool ? _cachedPoolSpec : null,
        this.physicsBridge?.getSeeSawTiltAngle() ?? 0
      );
      this.profiler.startPhase('gpu_shadow_cascade');
      this.gpuEngine.updateLightingAndShadowCascade(
        dt,
        this.heroCapy.position.x,
        this.heroCapy.position.y,
        this.heroCapy.position.z,
        glideGroundY,
        true,
        this.worldEnv.currentNightFactor,
        this.worldEnv.currentSunDir,
        this.worldEnv.currentMoonDir,
        this.worldEnv.activeShadowCaster,
        this.worldEnv.getDayPhaseLabel(),
        this.worldEnv.timeOfDayHours,
        this.worldEnv.currentIblEnvIntensity
      );
      this.profiler.endPhase('gpu_shadow_cascade');

      this.profiler.startPhase('sightline_occlusion');
      this.updateHeadLineOfSightTransparency(dt);
      this.profiler.endPhase('sightline_occlusion');

      this.renderSceneFrame(rawFrameDt, tickStartMs);
      return;
    }

    // Tick ALL 5 minigame ecosystems simultaneously in the unified contiguous world,
    // plus active player physics & seamless overland district handover!
    this.profiler.startPhase('district_gameplay');
    this.tickContiguousUnifiedWorld(dt);
    this.profiler.endPhase('district_gameplay');

    // Update texel-snapped directional solar & lunar shadow cascade across all 5 districts
    if (this.homePool) {
      _cachedPoolSpec.x = this.homePool.centerX;
      _cachedPoolSpec.z = this.homePool.centerZ;
      _cachedPoolSpec.radius = this.homePool.basinRadius;
    }
    const heroGroundY = sampleContiguousGroundY(
      this.heroCapy.position.x,
      this.heroCapy.position.z,
      this.homePool ? _cachedPoolSpec : null,
      this.physicsBridge?.getSeeSawTiltAngle() ?? 0
    );
    this.profiler.startPhase('gpu_shadow_cascade');
    this.gpuEngine.updateLightingAndShadowCascade(
      dt,
      this.heroCapy.position.x,
      this.heroCapy.position.y,
      this.heroCapy.position.z,
      heroGroundY,
      this.heroCapy.visible,
      this.worldEnv.currentNightFactor,
      this.worldEnv.currentSunDir,
      this.worldEnv.currentMoonDir,
      this.worldEnv.activeShadowCaster,
      this.worldEnv.getDayPhaseLabel(),
      this.worldEnv.timeOfDayHours,
      this.worldEnv.currentIblEnvIntensity
    );
    this.profiler.endPhase('gpu_shadow_cascade');

    // AAA Velocity-Reactive Dynamic FOV, Quadratic Camera Trauma & Zero-Allocation GPU VFX Step
    this.profiler.startPhase('vfx_particles');
    this.updateAaaCameraFeelAndWorldVfx(dt, heroGroundY);
    this.profiler.endPhase('vfx_particles');

    // Ensure nothing ever blocks the camera's sightline to the player's Capybara head!
    this.profiler.startPhase('sightline_occlusion');
    this.updateHeadLineOfSightTransparency(dt);
    this.profiler.endPhase('sightline_occlusion');

    if (this.cosmicStage === 'playing') {
      this.syncDockedVesselPose(dt, this.currentMode === 'sanctuary');
    }

    this.telemetryTimer += dt;
    const telemetryInterval = this.comboState.active || this.heroDashCooldown > 0 ? 0.11 : 0.25;
    if (this.telemetryTimer >= telemetryInterval) {
      this.telemetryTimer = 0;
      this.profiler.startPhase('telemetry_hud');
      this.emitTelemetry();
      this.profiler.endPhase('telemetry_hud');
    }

    if (this.cosmicStage === 'playing' && this.currentMode === 'sanctuary') {
      this.trackSettledBandForThumbnail('capybara_forest', dt);
    }

    this.renderSceneFrame(rawFrameDt, tickStartMs);
  }

  private renderSceneFrame(rawFrameDt?: number, tickStartMs?: number) {
    if (this.isSoftwareGl && rawFrameDt === undefined) {
      const now = performance.now();
      if (now - this.lastSoftwareRenderMs < 30) {
        this.scene.updateMatrixWorld();
        this.camera.updateMatrixWorld();
        return;
      }
      this.lastSoftwareRenderMs = now;
    } else if (this.isSoftwareGl) {
      this.lastSoftwareRenderMs = performance.now();
    }

    this.applySurfaceDrawDistanceAndCulling(
      this.seamlessZoomActive
        ? this.currentLogScaleMeters <= 2.75
        : this.cosmicStage === 'playing' || this.cosmicStage === 'capy_selection'
    );

    this.profiler.startPhase('scene_graph_matrices');
    this.scene.updateMatrixWorld();
    this.camera.updateMatrixWorld();
    this.profiler.endPhase('scene_graph_matrices');

    // Apply any queued adaptive GPU optimizer change strictly BEFORE render() so canvas
    // pixelRatio/setSize adjustments are immediately redrawn in the same rAF (zero black flash!).
    if (this.pendingAdaptiveGpuConfig) {
      const nextGpuCfg = this.pendingAdaptiveGpuConfig;
      this.pendingAdaptiveGpuConfig = null;
      this.gpuEngine.applyConfig(nextGpuCfg);
    }

    // Matrices were just updated cleanly above; suppress redundant internal
    // scene.updateMatrixWorld() inside WebGPURenderer._renderScene / WebGLRenderer.render.
    const prevSceneMatrixAuto = this.scene.matrixWorldAutoUpdate;
    const prevCamMatrixAuto = this.camera.matrixWorldAutoUpdate;
    this.scene.matrixWorldAutoUpdate = false;
    this.camera.matrixWorldAutoUpdate = false;
    this.profiler.beginGpuRender();
    try {
      this.gpuEngine.render();
      if (this.pendingThumbnailBandId !== null) {
        const captureBand = this.pendingThumbnailBandId;
        this.pendingThumbnailBandId = null;
        this.captureScaleBandThumbnail(captureBand);
      }
    } finally {
      this.profiler.endGpuRender();
      this.scene.matrixWorldAutoUpdate = prevSceneMatrixAuto;
      this.camera.matrixWorldAutoUpdate = prevCamMatrixAuto;
    }

    const endMs = performance.now();
    const workMs = tickStartMs !== undefined ? endMs - tickStartMs : 4.0;
    const intervalMs = (rawFrameDt ?? 0.01667) * 1000;
    const stageStr = this.seamlessZoomActive
      ? this.seamlessUniverse.getBandById(
          UNIVERSE_SCALE_BANDS[findNearestScaleBandIndex(this.currentLogScaleMeters)].id
        ).title
      : ZONE_LOCATIONS[this.currentMode]?.title || this.currentMode;

    const nowMs = Date.now();
    const effTarget = this.performanceLog.getEffectiveTargetFps();
    const budgetMs = 1000 / effTarget;
    const nextLodTier = Math.max(0, this.currentCapyLodTier - 1);
    const activeOptLabel =
      this.performanceLog.disabledFeatures.length > 0
        ? this.performanceLog.disabledFeatures[this.performanceLog.disabledFeatures.length - 1]
        : 'GPU Auto-Opt';
    const mitigation =
      this.performanceLog.lock60FpsEnabled && this.currentCapyLodTier > 0
        ? `LOD->T${nextLodTier}`
        : this.performanceLog.lock60FpsEnabled
          ? activeOptLabel
          : 'Monitoring Only';

    this.profiler.startPhase('telemetry_hud');
    const res = this.performanceLog.recordFrame(
      workMs,
      intervalMs,
      this.isSoftwareGl,
      stageStr,
      nowMs,
      mitigation
    );

    if (this.settings.lock60FpsGovernor !== false) {
      if (res.shouldReduceLoad) {
        this.adaptiveRecoveryAccumSec = 0;
        if (
          !this.isSoftwareGl &&
          this.settings.autoCapyLod !== false &&
          this.currentCapyLodTier > 0
        ) {
          this.applyGlobalCapyLodTier((this.currentCapyLodTier - 1) as CapyLodTier);
        }
        if (!this.isSoftwareGl && nowMs - this.adaptiveLastStepMs >= 2600) {
          this.adaptiveLowPerfStreak++;
          if (this.adaptiveLowPerfStreak >= 3) {
            this.adaptiveLowPerfStreak = 0;
            const baseCfg = this.buildGpuConfigFromSettings(this.settings);
            const nextLevel = findNextEffectiveMitigationLevel(
              this.adaptiveMitigationLevel,
              baseCfg,
              this.settings.autoCapyLod !== false,
              this.settings.manualCapyLodTier ?? 3
            );
            if (nextLevel > this.adaptiveMitigationLevel) {
              this.adaptiveMitigationLevel = nextLevel;
              this.adaptiveLastStepMs = nowMs;
              const effCfg = this.buildEffectiveGpuConfig(this.settings, nextLevel);
              // Queue for start of next rAF before render() so setSize/setPixelRatio never flashes black
              this.pendingAdaptiveGpuConfig = effCfg;
              if (
                this.settings.autoCapyLod !== false &&
                this.currentCapyLodTier > this.adaptiveMitigationResult.maxCapyLodTier
              ) {
                this.applyGlobalCapyLodTier(this.adaptiveMitigationResult.maxCapyLodTier);
              }
              this.performanceLog.activeGovernorTier = nextLevel;
              this.performanceLog.disabledFeatures = this.adaptiveMitigationResult.disabledFeatures.slice();
              this.performanceLog.notifyTransitionWarmup(2);
              this.profiler.recordAction(
                `Auto GPU Opt Tier ${nextLevel}`,
                0,
                this.performanceLog.disabledFeatures.join(', ')
              );
            }
          }
        }
      } else {
        this.adaptiveLowPerfStreak = 0;
        if (this.adaptiveMitigationLevel > 0 && !this.isSoftwareGl) {
          this.adaptiveRecoveryAccumSec += intervalMs / 1000;
          if (
            this.adaptiveRecoveryAccumSec >= 10.0 &&
            nowMs - this.adaptiveLastStepMs >= 10000 &&
            this.performanceLog.getAvgFrameMs() <= budgetMs * 0.85
          ) {
            this.adaptiveRecoveryAccumSec = 0;
            this.adaptiveLastStepMs = nowMs;
            const baseCfg = this.buildGpuConfigFromSettings(this.settings);
            const prevLevel = findPrevEffectiveMitigationLevel(
              this.adaptiveMitigationLevel,
              baseCfg,
              this.settings.autoCapyLod !== false,
              this.settings.manualCapyLodTier ?? 3
            );
            this.adaptiveMitigationLevel = prevLevel;
            const effCfg = this.buildEffectiveGpuConfig(this.settings, prevLevel);
            // Queue for start of next rAF before render() so recovery never flashes black
            this.pendingAdaptiveGpuConfig = effCfg;
            this.performanceLog.activeGovernorTier = prevLevel;
            this.performanceLog.disabledFeatures = this.adaptiveMitigationResult.disabledFeatures.slice();
            this.performanceLog.notifyTransitionWarmup(2);
          }
        }
      }
    }
    this.profiler.endPhase('telemetry_hud');

    this.profiler.endFrame();
  }

  /**
   * Modulates bioluminescent mutations (`glow_tail`), Sacred Capy Pagoda (`zen_pagoda`) lanterns,
   * 3D World Portals, Spore Lagoon bio-orbs, and the Sanctuary Art Easel gallery lamp smoothly
   * across Day, Crimson Dusk, and Midnight across all 5 PlayStyle worlds (zero allocations).
   */
  private updateBioluminescentNightGlow() {
    const night = this.worldEnv ? this.worldEnv.currentNightFactor : 0;
    const dusk = this.worldEnv ? this.worldEnv.currentDuskFactor : 0;
    const glowBoost = Math.max(night, dusk * 0.68);
    const pulse =
      0.92 + 0.08 * Math.sin((this.worldEnv?.elapsedSeconds || 0) * 3.1);

    // 1. Hero Bioluminescent Tail (`glow_tail`) Volumetric Aura + Emissive Plume across all 5 worlds
    const hasGlowTail =
      this.stats.activeMutations.includes('glow_tail') ||
      (this.cosmicStage === 'playing' &&
        Boolean(this.activeHeroSpec?.mutations?.includes('glow_tail')));
    this.heroTailAuraMesh.visible = hasGlowTail;
    this.heroTailAuraMat.opacity = hasGlowTail
      ? (0.08 + glowBoost * 0.42) * pulse
      : 0;

    const mutGroup = this.heroCapy.userData.mutationGroup;
    for (let i = 0; i < mutGroup.children.length; i++) {
      const child = mutGroup.children[i] as THREE.Mesh;
      if (child.userData?.isBioluminescentTail && child.isMesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive !== undefined) {
          mat.emissiveIntensity = (0.72 + glowBoost * 2.35) * pulse;
        }
      }
    }

    // 2. Sacred Capy Pagoda (`zen_pagoda`) Shoji Windows, Lanterns & Courtyard Halo
    for (let i = 0; i < this.sanctuaryBuildingMeshes.length; i++) {
      const bm = this.sanctuaryBuildingMeshes[i];
      if (bm.userData?.buildingType === 'zen_pagoda') {
        const pGlow = bm.userData.pagodaGlowMat as
          | THREE.MeshBasicMaterial
          | undefined;
        const pMat = bm.userData.pagodaLanternMat as
          | THREE.MeshStandardMaterial
          | undefined;
        if (pGlow) {
          pGlow.opacity = (0.01 + glowBoost * 0.34) * pulse;
        }
        if (pMat) {
          pMat.emissiveIntensity = (0.1 + glowBoost * 2.15) * pulse;
        }
      }
    }

    // 3. 3D World Portals (Vortex + Capital Beacons + Stone Frame)
    for (let i = 0; i < this.sanctuaryPortals.length; i++) {
      const pm = this.sanctuaryPortals[i].mesh;
      const beaconMat = pm.userData?.beaconMat as
        | THREE.MeshStandardMaterial
        | undefined;
      const frameMat = pm.userData?.frameMat as
        | THREE.MeshStandardMaterial
        | undefined;
      if (beaconMat) {
        beaconMat.emissiveIntensity = (0.28 + glowBoost * 1.95) * pulse;
      }
      if (frameMat) {
        frameMat.emissiveIntensity = 0.08 + glowBoost * 0.85;
      }
    }

    // 3b. Grand Promenade Causeway Lantern Bollards (4 Overland Bridges)
    if (this.causewayLanternMat) {
      this.causewayLanternMat.emissiveIntensity = (0.1 + glowBoost * 2.15) * pulse;
    }

    // 4. Spore Lagoon Bio-Orbs (O(1) shared-material intensity modulation)
    if (this.sporeOrbPlanktonMat) {
      this.sporeOrbPlanktonMat.emissiveIntensity = 0.42 + glowBoost * 1.45;
    }
    if (this.sporeOrbDnaMat) {
      this.sporeOrbDnaMat.emissiveIntensity = 0.65 + glowBoost * 1.45;
    }
  }

  private tickCosmicExperience(dt: number) {
    const shouldAdvance = this.cosmicBuilder.tick(dt, this.cosmicStage, this.camera);
    if (shouldAdvance && this.cosmicStage === 'big_bang') {
      this.setCosmicStage('universe_flight');
      return;
    }

    if (this.cosmicStage === 'big_bang') {
      // Free 3D orbital camera during the Big Bang explosion & N-Body/Fluid galaxy formation
      const nowMs = performance.now();
      const idleDrift =
        !this.mouselookLocked && nowMs - this.mouselookLastActiveTimeMs > 3200 ? 0.14 : 0;
      this.cosmicOrbitYaw += (idleDrift - this.moveInput.x * 1.45) * dt;
      this.cosmicOrbitPitch = THREE.MathUtils.clamp(
        this.cosmicOrbitPitch + this.moveInput.z * 0.95 * dt,
        -0.75,
        1.2
      );

      const isFollowingStar = this.cosmicBuilder.isCameraFollowingTrackedStar();
      const baseDist = isFollowingStar ? 68 : 138;
      const radius = Math.max(14, baseDist * this.cosmicZoomMultiplier);
      if (isFollowingStar) {
        this.cosmicBuilder.getTrackedStarWorldPosition(_lookTarget);
      } else {
        _lookTarget.set(0, 0, 0);
      }
      this.cosmicCamLook.lerp(_lookTarget, 1 - Math.exp(-6.5 * dt));

      _camTarget.set(
        this.cosmicCamLook.x +
          Math.sin(this.cosmicOrbitYaw) * Math.cos(this.cosmicOrbitPitch) * radius,
        this.cosmicCamLook.y + Math.sin(this.cosmicOrbitPitch) * radius,
        this.cosmicCamLook.z +
          Math.cos(this.cosmicOrbitYaw) * Math.cos(this.cosmicOrbitPitch) * radius
      );
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-5.5 * dt));
      this.camera.lookAt(this.cosmicCamLook);
      const coalFrac = this.cosmicBuilder.getCosmicSimTelemetry().coalescencePercent / 100;
      const liveBangLog = THREE.MathUtils.lerp(27.6, 23.4, coalFrac);
      this.currentLogScaleMeters = liveBangLog;
      this.targetLogScaleMeters = liveBangLog;
      this.seamlessTelemetryAccum += dt;
      if (this.seamlessTelemetryAccum >= 0.25) {
        this.seamlessTelemetryAccum = 0;
        this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
      }
      this.cosmicUiTelemetryAccum += dt;
      if (this.cosmicUiTelemetryAccum >= 0.085) {
        this.cosmicUiTelemetryAccum = 0;
        this.emitCosmicState();
      }
      return;
    }

    if (
      this.cosmicStage === 'universe_flight' ||
      this.cosmicStage === 'galaxy_view' ||
      this.cosmicStage === 'star_system_view' ||
      this.cosmicStage === 'planet_orbit'
    ) {
      // Free 3D flight / orbital steering with touch drag or WASD
      this.cosmicOrbitYaw -= this.moveInput.x * 1.45 * dt;
      this.cosmicOrbitPitch = THREE.MathUtils.clamp(
        this.cosmicOrbitPitch + this.moveInput.z * 0.95 * dt,
        -0.55,
        1.15
      );

      const isFollowingStar =
        this.cosmicStage === 'universe_flight' &&
        this.cosmicBuilder.isCameraFollowingTrackedStar();

      let baseRadius = isFollowingStar ? 64 : 155;
      if (this.cosmicStage === 'galaxy_view') baseRadius = 68;
      else if (this.cosmicStage === 'star_system_view') baseRadius = 82;
      else if (this.cosmicStage === 'planet_orbit') baseRadius = 28;
      const radius = Math.max(10, baseRadius * this.cosmicZoomMultiplier);

      if (isFollowingStar) {
        this.cosmicBuilder.getTrackedStarWorldPosition(_lookTarget);
      } else {
        _lookTarget.set(0, 0, 0);
      }
      this.cosmicCamLook.lerp(_lookTarget, 1 - Math.exp(-6.0 * dt));

      _camTarget.set(
        this.cosmicCamLook.x +
          Math.sin(this.cosmicOrbitYaw) * Math.cos(this.cosmicOrbitPitch) * radius,
        this.cosmicCamLook.y + Math.sin(this.cosmicOrbitPitch) * radius,
        this.cosmicCamLook.z +
          Math.cos(this.cosmicOrbitYaw) * Math.cos(this.cosmicOrbitPitch) * radius
      );
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-6.0 * dt));
      this.camera.lookAt(this.cosmicCamLook);
      this.cosmicUiTelemetryAccum += dt;
      if (this.cosmicUiTelemetryAccum >= 0.085) {
        this.cosmicUiTelemetryAccum = 0;
        if (this.cosmicStage === 'universe_flight') {
          this.emitCosmicState();
        } else if (this.cosmicStage === 'star_system_view') {
          this.callbacks.onOrbitTelemetryChange?.(this.getOrbitTelemetry());
        }
      }
      return;
    }

    if (this.cosmicStage === 'planet_descent') {
      this.cosmicDescentElapsed += dt;
      const descentDuration = this.isSoftwareGl ? 0.65 : 1.55;
      const t = Math.min(1.0, this.cosmicDescentElapsed / descentDuration);
      const ease = smoothstep01(0.0, 1.0, t);

      if (t >= 0.40 && !this.storySurfaceRevealed) {
        this.storySurfaceRevealed = true;
        this.worldBaseGroup.visible = true;
        this.worldBaseGroup.matrixWorldAutoUpdate = true;
        this.sanctuaryGroup.visible = true;
        this.sanctuaryGroup.matrixWorldAutoUpdate = true;
        this.sporeGroup.visible = true;
        this.sporeGroup.matrixWorldAutoUpdate = true;
        this.capytorioGroup.visible = true;
        this.capytorioGroup.matrixWorldAutoUpdate = true;
        this.runnerGroup.visible = true;
        this.runnerGroup.matrixWorldAutoUpdate = true;
        this.fallGuysGroup.visible = true;
        this.fallGuysGroup.matrixWorldAutoUpdate = true;
        this.selectableCapyGroup.visible = true;
        this.selectableCapyGroup.matrixWorldAutoUpdate = true;
        this.applySurfaceDrawDistanceAndCulling(true);
      }

      if (this.cosmicBuilder) {
        const showOrbitalGlobe = t < 0.72;
        this.cosmicBuilder.rootGroup.visible = showOrbitalGlobe;
        this.cosmicBuilder.rootGroup.matrixWorldAutoUpdate = showOrbitalGlobe;
      }

      const skyAlpha = smoothstep01(0.40, 0.92, t);
      this.setSkyDomeAlpha(skyAlpha);

      const surfaceLightBlend = smoothstep01(0.40, 0.96, t);
      if (this.worldEnv) {
        if (surfaceLightBlend <= 0.01) {
          this.worldEnv.ambientLight.intensity = 0.08;
          this.worldEnv.hemiLight.intensity = 0.24;
          this.worldEnv.sunLight.intensity = 2.45;
          this.worldEnv.moonLight.intensity = 0.0;
        } else {
          this.worldEnv.ambientLight.intensity = THREE.MathUtils.lerp(
            0.08,
            this.worldEnv.lastAmbientIntensity,
            surfaceLightBlend
          );
          this.worldEnv.hemiLight.intensity = THREE.MathUtils.lerp(
            0.24,
            this.worldEnv.lastHemiIntensity,
            surfaceLightBlend
          );
          this.worldEnv.sunLight.intensity = THREE.MathUtils.lerp(
            2.45,
            this.worldEnv.lastSunIntensity,
            surfaceLightBlend
          );
          this.worldEnv.moonLight.intensity = THREE.MathUtils.lerp(
            0.0,
            this.worldEnv.lastMoonIntensity,
            surfaceLightBlend
          );
          this.renderer.toneMappingExposure = THREE.MathUtils.lerp(
            this.settings.gpuExposure ?? 1.02,
            this.worldEnv.lastExposure,
            surfaceLightBlend
          );
        }
      }

      // Smoothly sweep camera along curved atmospheric plunge from landing beacon to selection meadow
      this.cosmicBuilder.getLandingBeaconWorldPosition(this.selectedLandingIndex, _tempVec3);
      const beaconApproachWeight = Math.sin(Math.min(1, t / 0.65) * Math.PI);
      const handoff = smoothstep01(0.28, 1.0, t);
      _camTarget
        .copy(_storyDescentStartCam)
        .lerp(_tempVec3.multiplyScalar(1.35), beaconApproachWeight * 0.48)
        .lerp(_storySelectionCamPos, handoff);
      this.camera.position.copy(_camTarget);

      _lookTarget.copy(_storyDescentStartLook).lerp(_storySelectionLook, smoothstep01(0.22, 0.95, t));
      this.camera.lookAt(_lookTarget);

      // Blend sky color smoothly from deep space into horizon atmosphere with zero allocations
      _colorHelper.setHex(0x020617);
      _colorHelper2.setHex(this.activeBiome.skyHex);
      _colorHelper.lerp(_colorHelper2, smoothstep01(0.18, 0.92, t));
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.copy(_colorHelper);
      } else {
        this.scene.background = _colorHelper.clone();
      }

      const liveDescentLog = THREE.MathUtils.lerp(4.9, 0.95, ease);
      this.currentLogScaleMeters = liveDescentLog;
      this.targetLogScaleMeters = liveDescentLog;
      this.cosmicUiTelemetryAccum += dt;
      if (this.cosmicUiTelemetryAccum >= 0.085 || t >= 1.0) {
        this.cosmicUiTelemetryAccum = 0;
        this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
      }

      if (t >= 1.0) {
        this.setCosmicStage('capy_selection');
      }
      return;
    }

    if (this.cosmicStage === 'capy_selection') {
      // Gently animate the 6 selectable Capybaras in the planetary meadow
      const children = this.selectableCapyGroup.children;
      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        const capy = node.children[0] as CapyMeshGroup | undefined;
        if (capy && capy.userData?.legFL) {
          if (i === this.selectedCapyHeroIndex) {
            this.animateCapyLegs(capy, dt, 10);
            capy.position.y = Math.abs(Math.sin(performance.now() * 0.005)) * 0.28;
          } else {
            this.resetCapyLegs(capy);
            capy.position.y = 0;
          }
        }
      }
    }
  }

  private emitTelemetry() {
    const zone = ZONE_LOCATIONS[this.currentMode];
    const coords = `(${zone.x}, ${zone.z})`;
    this.callbacks.onSnakeTelemetryUpdate?.(this.getCapySnakeTelemetry());

    this.comboTelemetryScratch.active = this.comboState.active;
    this.comboTelemetryScratch.count = this.comboState.count;
    this.comboTelemetryScratch.multiplier = this.comboState.multiplier;
    this.comboTelemetryScratch.timeRemainingSec = +this.comboState.timeRemainingSec.toFixed(2);
    this.comboTelemetryScratch.maxWindowSec = COMBO_WINDOW_SEC;
    this.comboTelemetryScratch.feverActive = this.comboState.feverActive;
    this.comboTelemetryScratch.lastActionLabel = this.comboState.lastActionLabel;

    const arcadeCombo = this.comboState.active ? { ...this.comboTelemetryScratch } : undefined;
    const dashCooldownFrac = +THREE.MathUtils.clamp(this.heroDashCooldown / 1.35, 0, 1).toFixed(2);
    const canDive =
      this.cosmicStage === 'playing' &&
      !this.seamlessZoomActive &&
      !this.isGrounded &&
      !this.isSwimmingInPool &&
      !this.isGroundPounding &&
      this.heroLocalPos.y > 0.25;

    if (this.currentMode === 'sanctuary') {
      const snake = this.getCapySnakeTelemetry();
      this.callbacks.onTelemetryUpdate({
        mode: 'sanctuary',
        primaryLabel: 'Dachshund Body',
        primaryValue: `${snake.lengthMeters}m (${snake.bodySegments})`,
        secondaryLabel: 'Head Orange',
        secondaryValue: snake.headOrangeName,
        zoneCoordsLabel: coords,
        arcadeCombo,
        dashCooldownFrac,
        canDive,
      });
    } else if (this.currentMode === 'spore') {
      this.callbacks.onTelemetryUpdate({
        mode: 'spore',
        primaryLabel: 'Spore Mass',
        primaryValue: `${Math.round(this.sporeMass)} kg`,
        secondaryLabel: 'DNA Harvested',
        secondaryValue: `+${this.sporeDnaEarned}`,
        zoneCoordsLabel: coords,
        arcadeCombo,
        dashCooldownFrac,
        canDive,
      });
    } else if (this.currentMode === 'capytorio') {
      const snap = this.capytorioEngine.getUiSnapshot();
      this.callbacks.onTelemetryUpdate({
        mode: 'capytorio',
        primaryLabel: 'Items Produced',
        primaryValue: `${snap.totalProduced} (${snap.machineCount}m)`,
        secondaryLabel: 'Power Grid',
        secondaryValue: `${snap.powerSupplyMw.toFixed(1)}/${snap.powerDemandMw.toFixed(1)} MW`,
        zoneCoordsLabel: coords,
        arcadeCombo,
        dashCooldownFrac,
        canDive,
      });
    } else if (this.currentMode === 'runner') {
      this.callbacks.onTelemetryUpdate({
        mode: 'runner',
        primaryLabel: 'Capy Herd',
        primaryValue: `${this.runnerCapyCount} Capys`,
        secondaryLabel: 'Distance',
        secondaryValue: `${Math.round(this.runnerDistance)}m`,
        zoneCoordsLabel: coords,
        arcadeCombo,
        dashCooldownFrac,
        canDive,
      });
    } else if (this.currentMode === 'fallguys') {
      const pbLabel = this.yuzuBestGhostRun
        ? ` · PB ${(this.yuzuBestGhostRun.durationMs / 1000).toFixed(2)}s`
        : '';
      const runLabel = this.yuzuGhostRunActive
        ? `R${this.fallGuysRound} · ${this.yuzuGhostRunElapsedSec.toFixed(1)}s${pbLabel}`
        : `Round ${this.fallGuysRound}${pbLabel}`;
      this.callbacks.onTelemetryUpdate({
        mode: 'fallguys',
        primaryLabel: 'Crowns Won',
        primaryValue: this.fallGuysCrowns,
        secondaryLabel: this.yuzuBestGhostRun ? 'Run / Ghost PB' : 'Course Round',
        secondaryValue: runLabel,
        zoneCoordsLabel: coords,
        arcadeCombo,
        dashCooldownFrac,
        canDive,
      });
    }
  }

  private animateCapyLegs(
    capy: CapyMeshGroup,
    dt: number,
    speedFactor: number = 12,
    walkDir: 1 | -1 = 1,
    planarDisp?: number,
    hasWalkIntent: boolean = true,
    isAirborne: boolean = false,
    isSwimming: boolean = false
  ) {
    if (typeof planarDisp === 'number') {
      capy.userData.walkCycle = advanceDisplacementCoupledGaitPhase(
        capy.userData.walkCycle,
        planarDisp,
        dt,
        {
          hasWalkIntent,
          isAirborne,
          isSwimming,
          strideRadius: 0.23,
          fallbackRateRadPerSec: speedFactor * 0.78,
        }
      );
    } else {
      capy.userData.walkCycle += dt * speedFactor;
    }
    const phase = capy.userData.walkCycle;
    const strideScale =
      typeof planarDisp === 'number'
        ? Math.min(1.25, Math.max(0.45, planarDisp > 0.002 ? planarDisp / Math.max(0.004, dt * 7.2) : 0.85))
        : 1.0;

    // Diagonal quadruped trot/walk gait with 2-joint knee/carpus flexion & flat stance planting
    this.animateArticulatedLimb(capy.userData.legFL, phase, walkDir, 0.39, strideScale);
    const frontRoll = this._limbPoseScratch.pelvicRoll;
    this.animateArticulatedLimb(capy.userData.legBR, phase, walkDir, 0.39, strideScale);
    this.animateArticulatedLimb(capy.userData.legFR, phase + Math.PI, walkDir, 0.39, strideScale);
    this.animateArticulatedLimb(capy.userData.legBL, phase + Math.PI, walkDir, 0.39, strideScale);

    capy.rotation.order = 'YXZ';
    capy.rotation.z = frontRoll * 0.75;

    // Subtle ear bob & natural eyelid blink at LOD Tier 2+
    if (capy.userData.lodTier >= 2) {
      const earFlutter = Math.sin(capy.userData.walkCycle * 0.5) * 0.08;
      capy.userData.earL.rotation.z = -0.32 + earFlutter;
      capy.userData.earR.rotation.z = 0.32 - earFlutter;

      capy.userData.blinkTimer -= dt;
      if (capy.userData.blinkTimer <= 0) {
        const blinkScale = capy.userData.blinkTimer > -0.11 ? 1.0 : 0.15;
        capy.userData.eyelidL.scale.y = blinkScale;
        capy.userData.eyelidR.scale.y = blinkScale;
        if (capy.userData.blinkTimer <= -0.12) {
          capy.userData.blinkTimer = 2.4 + Math.random() * 3.0;
          capy.userData.eyelidL.scale.y = 0.15;
          capy.userData.eyelidR.scale.y = 0.15;
        }
      }
    }
  }

  private resetCapyLegs(capy: CapyMeshGroup, dt: number = 0.016) {
    capy.rotation.z = 0;
    this.resetArticulatedLimb(capy.userData.legFL);
    this.resetArticulatedLimb(capy.userData.legFR);
    this.resetArticulatedLimb(capy.userData.legBL);
    this.resetArticulatedLimb(capy.userData.legBR);

    if (capy.userData.lodTier >= 2) {
      capy.userData.blinkTimer -= dt;
      if (capy.userData.blinkTimer <= 0) {
        const blinkScale = capy.userData.blinkTimer > -0.11 ? 1.0 : 0.15;
        capy.userData.eyelidL.scale.y = blinkScale;
        capy.userData.eyelidR.scale.y = blinkScale;
        if (capy.userData.blinkTimer <= -0.12) {
          capy.userData.blinkTimer = 2.6 + Math.random() * 3.2;
          capy.userData.eyelidL.scale.y = 0.15;
          capy.userData.eyelidR.scale.y = 0.15;
        }
      }
    }
  }

  /**
   * Shared movement & camera helper supporting:
   * - Behind-the-Capybara Chase Camera (with forward & true back-led backward walking!)
   * - Fixed World-Angle Camera
   * - Foot-Contact Walking Traction: if `enforceFootTraction` is true and 0 feet touch the ground
   *   (and not swimming in water), walking propulsion is 0 (player gets stuck while feet paddle in air!).
   */
  private applyPlayerMovementAndCamera(
    dt: number,
    speed: number,
    _baseCamHeight: number,
    _baseCamDist: number,
    enforceFootTraction: boolean = false,
    deferBidirectionalSpine: boolean = false
  ): {
    forwardInput: number;
    walkDir: 1 | -1;
    hasWalkIntent: boolean;
    tractionMult: number;
    effectiveSpeed: number;
  } {
    const turnSens = this.settings.turnSensitivity || 1.0;
    const tractionMult =
      enforceFootTraction && this.isStuckNoFooting ? 0.0 : 1.0;

    const useObliqueFactorioMove =
      this.currentMode === 'capytorio' && this.getCapytorioCameraMode() === 'oblique';
    if (this.settings.cameraFollowBehind && !useObliqueFactorioMove) {
      const forwardRaw = -this.moveInput.z;
      const isReversing = forwardRaw < -0.04;
      this.isWalkingBackward = isReversing;
      const walkDir: 1 | -1 = isReversing ? -1 : 1;

      const forwardInput =
        forwardRaw +
        (Math.abs(forwardRaw) < 0.05 && Math.abs(this.moveInput.x) > 0.1 ? 0.25 : 0);

      const hasWalkIntent =
        Math.abs(forwardInput) > 0.04 || Math.abs(this.moveInput.x) > 0.05;

      const dirPace = isReversing ? 0.78 : 1.0;
      const effectiveSpeed = speed * dirPace * tractionMult;

      if (deferBidirectionalSpine) {
        // Sanctuary bidirectional locomotion moves either Hero (forward) or Caboose (backward) as leader
        return { forwardInput, walkDir, hasWalkIntent, tractionMult, effectiveSpeed };
      }

      if (Math.abs(this.moveInput.x) > 0.02 && tractionMult > 0) {
        const yawRate = isReversing ? 2.1 : 2.6;
        this.heroYaw -= this.moveInput.x * yawRate * turnSens * dt;
      } else if (
        Math.abs(forwardRaw) > 0.04 &&
        tractionMult > 0 &&
        this.settings.mouselookEnabled !== false &&
        (this.mouselookLocked || performance.now() - this.mouselookLastActiveTimeMs < 2400)
      ) {
        this.heroYaw = dampShortestAngle(this.heroYaw, this.surfaceCamYaw, 9.0 * turnSens, dt);
      }

      const moveVx = Math.sin(this.heroYaw) * forwardInput * effectiveSpeed;
      const moveVz = Math.cos(this.heroYaw) * forwardInput * effectiveSpeed;

      this.heroLocalPos.x += (moveVx + this.heroVelocity.x) * dt;
      this.heroLocalPos.z += (moveVz + this.heroVelocity.z) * dt;
      this.heroCapy.rotation.y = this.heroYaw;

      if (hasWalkIntent) {
        this.animateCapyLegs(this.heroCapy, dt, isReversing ? 12 : 14, walkDir);
      } else {
        this.resetCapyLegs(this.heroCapy, dt);
      }

      return { forwardInput, walkDir, hasWalkIntent, tractionMult, effectiveSpeed };
    } else {
      this.isWalkingBackward = false;
      const hasWalkIntent =
        Math.abs(this.moveInput.x) > 0.04 || Math.abs(this.moveInput.z) > 0.04;
      const effectiveSpeed = speed * tractionMult;
      if (deferBidirectionalSpine) {
        return {
          forwardInput: hasWalkIntent ? 1 : 0,
          walkDir: 1,
          hasWalkIntent,
          tractionMult,
          effectiveSpeed,
        };
      }
      const moveVx = this.moveInput.x * effectiveSpeed;
      const moveVz = this.moveInput.z * effectiveSpeed;
      this.heroLocalPos.x += (moveVx + this.heroVelocity.x) * dt;
      this.heroLocalPos.z += (moveVz + this.heroVelocity.z) * dt;

      if (hasWalkIntent) {
        if (tractionMult > 0) {
          this.heroYaw = Math.atan2(this.moveInput.x, this.moveInput.z);
          this.heroCapy.rotation.y = this.heroYaw;
        }
        this.animateCapyLegs(this.heroCapy, dt, 14, 1);
      } else {
        this.resetCapyLegs(this.heroCapy, dt);
      }

      return {
        forwardInput: hasWalkIntent ? 1 : 0,
        walkDir: 1,
        hasWalkIntent,
        tractionMult,
        effectiveSpeed,
      };
    }
  }

  private updateWorldHeroAndCamera(
    dt: number,
    baseCamHeight: number,
    baseCamDist: number
  ) {
    const zone = ZONE_LOCATIONS[this.currentMode];
    const wx = zone.x + this.heroLocalPos.x;
    const wy = this.heroLocalPos.y;
    const wz = zone.z + this.heroLocalPos.z;

    this.heroCapy.position.set(wx, wy, wz);

    const distScale = this.settings.cameraDistance || 1.0;

    if (this.currentMode === 'capytorio' && this.getCapytorioCameraMode() === 'oblique') {
      const pose = evaluateCapytorioAltitudePose(this.capytorioObliqueZoomDist);
      this.surfaceCamYaw = Math.PI;
      this.surfaceCamPitch = pose.pitchRad;
      _camTarget.set(wx, wy + pose.dy, wz + pose.dz);
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-10.0 * dt));
      _lookTarget.set(wx, wy + 0.15, wz);
      this.camera.lookAt(_lookTarget);
      this.syncCapytorioHighAltitudePlanetSurface(dt, wx, wy, wz, pose);
      return;
    }

    const camDist = baseCamDist * distScale;
    const camHeight = baseCamHeight * distScale;
    const lookBaseY = wy + 1.25;
    const defaultHeightOffset = Math.max(0.5, camHeight - 1.25);
    const defaultPitch = Math.atan2(defaultHeightOffset, Math.max(1.0, camDist));
    const orbitRadius = Math.hypot(camDist, defaultHeightOffset);

    const nowMs = performance.now();
    const mouselookActive =
      this.settings.mouselookEnabled !== false &&
      (this.mouselookLocked || nowMs - this.mouselookLastActiveTimeMs < 2400);

    if (this.settings.cameraFollowBehind) {
      if (!mouselookActive) {
        this.surfaceCamYaw = dampShortestAngle(this.surfaceCamYaw, this.heroYaw, 6.0, dt);
        this.surfaceCamPitch = THREE.MathUtils.damp(this.surfaceCamPitch, defaultPitch, 4.5, dt);
      }
    } else if (this.settings.mouselookEnabled === false) {
      this.surfaceCamYaw = dampShortestAngle(this.surfaceCamYaw, Math.PI, 6.0, dt);
      this.surfaceCamPitch = THREE.MathUtils.damp(this.surfaceCamPitch, defaultPitch, 4.5, dt);
    }

    const cosPitch = Math.cos(this.surfaceCamPitch);
    const sinPitch = Math.sin(this.surfaceCamPitch);
    const horizDist = Math.max(2.2, cosPitch * orbitRadius);
    const rawCamY = lookBaseY + sinPitch * orbitRadius;
    const clampedCamY = Math.max(wy + 0.55, rawCamY);
    const lookUpLift = Math.max(0, -sinPitch) * 5.2;

    _camTarget.set(
      wx - Math.sin(this.surfaceCamYaw) * horizDist,
      clampedCamY,
      wz - Math.cos(this.surfaceCamYaw) * horizDist
    );
    const camSmooth = mouselookActive ? 18.0 : 8.0;
    this.camera.position.lerp(_camTarget, 1 - Math.exp(-camSmooth * dt));

    const lookAhead = this.settings.cameraFollowBehind && !mouselookActive ? 3.5 : 1.8;
    _lookTarget.set(
      wx + Math.sin(this.surfaceCamYaw) * lookAhead,
      lookBaseY + lookUpLift,
      wz + Math.cos(this.surfaceCamYaw) * lookAhead
    );
    this.camera.lookAt(_lookTarget);
  }

  // --- 1. SANCTUARY: SOLID SLIGHTLY-SQUASHABLE SPINE, REVERSE WALKING & ZERO-CLIPPING PBD ---
  private pushCircleOutOfStaticObstacle(
    cx: number,
    cz: number,
    cRadius: number,
    ox: number,
    oz: number,
    oRadius: number,
    slideBiasOnDeadCenter: boolean = false
  ): { x: number; z: number; hit: boolean; nx: number; nz: number } {
    let dx = cx - ox;
    let dz = cz - oz;
    let dist = Math.hypot(dx, dz);
    const minSep = cRadius + oRadius;
    if (dist >= minSep) {
      return { x: cx, z: cz, hit: false, nx: 0, nz: 0 };
    }
    if (dist < 0.0001) {
      dx = 1;
      dz = 0;
      dist = 1;
    }
    const nx = dx / dist;
    const nz = dz / dist;
    let outX = ox + nx * minSep;
    let outZ = oz + nz * minSep;

    if (slideBiasOnDeadCenter && Math.abs(dx) < 0.16) {
      outX += dx >= 0 ? 0.085 : -0.085;
    }
    return { x: outX, z: outZ, hit: true, nx, nz };
  }

  private resolveSpineNodeStaticObstacles(
    nodeIdx: number,
    radius: number,
    triggerHeroTreeBump: boolean
  ) {
    let x = this.spineX[nodeIdx];
    let z = this.spineZ[nodeIdx];
    const slideBias = nodeIdx === 0 && !this.isWalkingBackward;

    // 1. All 8 Procedural Exponential Tree Trunks
    for (let t = 0; t < this.sanctuaryTrees.length; t++) {
      const tree = this.sanctuaryTrees[t];
      const res = this.pushCircleOutOfStaticObstacle(
        x,
        z,
        radius,
        tree.x,
        tree.z,
        tree.trunkRadius,
        slideBias
      );
      if (res.hit) {
        x = res.x;
        z = res.z;
        if (nodeIdx === 0) {
          this.heroSoftSquashVel -= 1.2;
          if (triggerHeroTreeBump) {
            this.bumpTreeAndSpawnFruits(tree, -res.nx, -res.nz);
          }
        } else if (nodeIdx <= this.snakeSegmentCount) {
          this.segSoftSquashVel[nodeIdx - 1] -= 1.1;
        }
      }
    }

    // 2. Home Pool Basalt Rim Boulders & Cedar Tap Post
    if (this.homePool) {
      const rims = this.homePool.rimColliders;
      for (let r = 0; r < rims.length; r++) {
        const rock = rims[r];
        const res = this.pushCircleOutOfStaticObstacle(
          x,
          z,
          radius,
          rock.x,
          rock.z,
          rock.radius
        );
        if (res.hit) {
          x = res.x;
          z = res.z;
          if (nodeIdx === 0) this.heroSoftSquashVel -= 1.1;
        }
      }
    }

    // 3. Placed Sanctuary Structures (excluding flat trampoline pads)
    for (let bIdx = 0; bIdx < this.stats.buildings.length; bIdx++) {
      const b = this.stats.buildings[bIdx];
      if (b.type === 'trampoline_pad') continue;
      const res = this.pushCircleOutOfStaticObstacle(x, z, radius, b.x, b.z, 1.48);
      if (res.hit) {
        x = res.x;
        z = res.z;
      }
    }

    // 4. Promenade Gateway Arch Stone Pillars (wide 5.3m clear archway so players walk straight onto bridges!)
    for (let pIdx = 0; pIdx < this.sanctuaryPortals.length; pIdx++) {
      const p = this.sanctuaryPortals[pIdx];
      const cosR = Math.cos(p.rotY);
      const sinR = Math.sin(p.rotY);
      for (const side of [-2.85, 2.85]) {
        const px = p.x + cosR * side;
        const pz = p.z - sinR * side;
        const res = this.pushCircleOutOfStaticObstacle(x, z, radius, px, pz, 0.42);
        if (res.hit) {
          x = res.x;
          z = res.z;
        }
      }
    }

    // Open-world exploration: no artificial perimeter wall clamping on Dachshund segments
    this.spineX[nodeIdx] = x;
    this.spineZ[nodeIdx] = z;
  }

  /**
   * Bidirectional Articulated Solid-Rod Spine & Collision Solver:
   * - Forward mode: Hero (node 0) leads and solves 0 -> cabNode.
   * - Backward mode (`isWalkingBackward`): **Caboose (node `totalNodes - 1`) IS the leader!**
   *   Links solve in reverse (`cabNode -> 0`) so middle segments & head trail naturally behind
   *   the reversing hindquarters leader without folding or jackknifing!
   */
  private solveArticulatedSpineAndSolidCollisions(
    dt: number,
    _forwardInput: number,
    _speed: number
  ) {
    if (!this.spineInitialized) {
      this.resetDachshundTrail();
    }

    const totalNodes = this.snakeSegmentCount + 2;
    const cabNode = totalNodes - 1;
    const heroR = 0.68;
    const segR = 0.48;
    const cabooseR = 0.54;
    const buddyR = 0.58;

    if (!this.isWalkingBackward) {
      // Forward mode: Node 0 (Hero) leads
      this.spineX[0] = this.heroLocalPos.x;
      this.spineY[0] = this.heroLocalPos.y;
      this.spineZ[0] = this.heroLocalPos.z;
      this.spineYaw[0] = this.heroYaw;
    }

    // Compute clean ground/water support heights & couple 3D spine vertically so jumps stay attached!
    for (let n = 0; n < totalNodes; n++) {
      if (this.suspendedFootTestHeight !== null) {
        _spineSupportY[n] = this.suspendedFootTestHeight;
        this.spineY[n] = this.suspendedFootTestHeight;
      } else {
        const surfY = this.getSupportSurfaceY(this.spineX[n], this.spineZ[n]);
        _spineSupportY[n] =
          this.homePool &&
          Math.hypot(
            this.spineX[n] - this.homePool.centerX,
            this.spineZ[n] - this.homePool.centerZ
          ) <
            this.homePool.basinRadius - 0.32
            ? this.homePool.waterMesh.position.y - 0.34
            : surfY < OPEN_OCEAN_SURFACE_Y + 0.12
              ? Math.max(surfY, OPEN_OCEAN_SURFACE_Y - 0.34)
              : surfY;
      }
    }

    if (this.suspendedFootTestHeight === null) {
      solveSpineVerticalCoupling(
        this.spineX,
        this.spineY,
        this.spineZ,
        _spineSupportY,
        totalNodes,
        this.isWalkingBackward,
        dt,
        DACHSHUND_SEGMENT_SPACING,
        SANE_HERO_LINK_DIST,
        SANE_CABOOSE_LINK_DIST,
        0.44
      );
    }

    // 4-Iteration Bidirectional 3D Solid-Rod & Multi-Body Non-Clipping Solver
    for (let iter = 0; iter < 4; iter++) {
      // Pass A: Bidirectional Inextensible Solid-Rod Distance + Anti-Jackknife Bend-Angle Clamping
      solveBidirectionalSpinePass(
        this.spineX,
        this.spineZ,
        this.spineYaw,
        totalNodes,
        this.isWalkingBackward,
        DACHSHUND_SEGMENT_SPACING,
        SANE_HERO_LINK_DIST,
        SANE_CABOOSE_LINK_DIST,
        MAX_SPINE_BEND_RAD,
        true
      );

      // Pass B: Pairwise Solid Non-Clipping Between Non-Adjacent Spine Segments (|i - j| >= 2)
      for (let i = 0; i < totalNodes; i++) {
        const rI = i === 0 ? heroR : i === totalNodes - 1 ? cabooseR : segR;
        for (let j = i + 2; j < totalNodes; j++) {
          const rJ = j === totalNodes - 1 ? cabooseR : segR;
          const minSep = (rI + rJ) * 0.82;
          const dx = this.spineX[i] - this.spineX[j];
          const dz = this.spineZ[i] - this.spineZ[j];
          const dist = Math.hypot(dx, dz);
          if (dist < minSep) {
            const nx = dist > 0.0001 ? dx / dist : 1;
            const nz = dist > 0.0001 ? dz / dist : 0;
            const push = (minSep - dist) * 0.5;
            this.spineX[i] += nx * push;
            this.spineZ[i] += nz * push;
            this.spineX[j] -= nx * push;
            this.spineZ[j] -= nz * push;
            if (i === 0) this.heroSoftSquashVel -= 0.8;
            else if (i <= this.snakeSegmentCount) this.segSoftSquashVel[i - 1] -= 0.8;
            if (j <= this.snakeSegmentCount) this.segSoftSquashVel[j - 1] -= 0.8;
          }
        }
      }

      // Pass C: All Spine Nodes vs Static Obstacles (Trees, Pool Boulders, Buildings, Portals)
      if (this.isWalkingBackward) {
        // Resolve from trailing head forward toward leading caboose so leading node takes final contact authority
        for (let n = 0; n < totalNodes; n++) {
          const rN = n === 0 ? heroR : n === cabNode ? cabooseR : segR;
          this.resolveSpineNodeStaticObstacles(n, rN, iter === 0 && n === 0);
        }
      } else {
        for (let n = cabNode; n >= 0; n--) {
          const rN = n === 0 ? heroR : n === cabNode ? cabooseR : segR;
          this.resolveSpineNodeStaticObstacles(n, rN, iter === 0 && n === 0);
        }
      }

      // Pass C2: Obstacle reaction propagation from active leader tail/head back through rigid rod
      solveBidirectionalSpinePass(
        this.spineX,
        this.spineZ,
        this.spineYaw,
        totalNodes,
        this.isWalkingBackward,
        DACHSHUND_SEGMENT_SPACING,
        SANE_HERO_LINK_DIST,
        SANE_CABOOSE_LINK_DIST,
        MAX_SPINE_BEND_RAD,
        false
      );

      // Pass D: Wandering Capybara Buddies vs Static Obstacles, Each Other & Entire Solid Spine
      for (let i = 0; i < this.sanctuaryCapys.length; i++) {
        if (!this.sanctuaryCapys[i].capy.visible) continue;
        const bA = this.sanctuaryCapys[i].capy.position;
        for (let t = 0; t < this.sanctuaryTrees.length; t++) {
          const tree = this.sanctuaryTrees[t];
          const res = this.pushCircleOutOfStaticObstacle(
            bA.x,
            bA.z,
            buddyR,
            tree.x,
            tree.z,
            tree.trunkRadius
          );
          if (res.hit) {
            bA.x = res.x;
            bA.z = res.z;
          }
        }
        if (this.homePool) {
          const resPool = this.pushCircleOutOfStaticObstacle(
            bA.x,
            bA.z,
            buddyR,
            this.homePool.centerX,
            this.homePool.centerZ,
            this.homePool.basinRadius + 0.55
          );
          if (resPool.hit) {
            bA.x = resPool.x;
            bA.z = resPool.z;
          }
        }
        for (let bIdx = 0; bIdx < this.stats.buildings.length; bIdx++) {
          const bld = this.stats.buildings[bIdx];
          if (bld.type === 'trampoline_pad') continue;
          const resBld = this.pushCircleOutOfStaticObstacle(
            bA.x,
            bA.z,
            buddyR,
            bld.x,
            bld.z,
            1.48
          );
          if (resBld.hit) {
            bA.x = resBld.x;
            bA.z = resBld.z;
          }
        }
        for (let j = i + 1; j < this.sanctuaryCapys.length; j++) {
          if (!this.sanctuaryCapys[j].capy.visible) continue;
          const bB = this.sanctuaryCapys[j].capy.position;
          const dx = bA.x - bB.x;
          const dz = bA.z - bB.z;
          const dist = Math.hypot(dx, dz);
          const minSep = buddyR * 2;
          if (dist < minSep) {
            const nx = dist > 0.0001 ? dx / dist : 1;
            const nz = dist > 0.0001 ? dz / dist : 0;
            const push = (minSep - dist) * 0.5;
            bA.x += nx * push;
            bA.z += nz * push;
            bB.x -= nx * push;
            bB.z -= nz * push;
            this.buddySoftSquashVel[i] -= 0.9;
            this.buddySoftSquashVel[j] -= 0.9;
          }
        }

        // Solid 3D collision between Buddy and every node of Player's Capybara spine (0..totalNodes-1)
        for (let n = 0; n < totalNodes; n++) {
          if (Math.abs(this.spineY[n] - bA.y) > 0.68) continue;
          const rN = n === 0 ? heroR : n === totalNodes - 1 ? cabooseR : segR;
          const dx = this.spineX[n] - bA.x;
          const dz = this.spineZ[n] - bA.z;
          const dist = Math.hypot(dx, dz);
          const minSep = rN + buddyR;
          if (dist < minSep) {
            const nx = dist > 0.0001 ? dx / dist : 1;
            const nz = dist > 0.0001 ? dz / dist : 0;
            const overlap = minSep - dist;
            this.spineX[n] += nx * overlap * 0.45;
            this.spineZ[n] += nz * overlap * 0.45;
            bA.x -= nx * overlap * 0.55;
            bA.z -= nz * overlap * 0.55;
            this.buddySoftSquashVel[i] -= 1.2;
            if (n === 0) this.heroSoftSquashVel -= 1.2;
            else if (n <= this.snakeSegmentCount) this.segSoftSquashVel[n - 1] -= 1.2;
            if (iter === 0) {
              this.knockFruitOffBack(this.spineX[n], this.spineZ[n], nx, nz);
            }
          }
        }
      }
    }

    if (this.suspendedFootTestHeight === null) {
      solveSpineVerticalCoupling(
        this.spineX,
        this.spineY,
        this.spineZ,
        _spineSupportY,
        totalNodes,
        this.isWalkingBackward,
        dt,
        DACHSHUND_SEGMENT_SPACING,
        SANE_HERO_LINK_DIST,
        SANE_CABOOSE_LINK_DIST,
        0.44
      );
    }

    // Write back constrained Hero position & aligned forward orientation from spine node 0!
    this.heroLocalPos.x = this.spineX[0];
    this.heroLocalPos.y = this.spineY[0];
    this.heroLocalPos.z = this.spineZ[0];
    if (this.isWalkingBackward) {
      this.heroYaw = dampShortestAngle(this.heroYaw, this.spineYaw[0], 18, dt);
      this.heroCapy.rotation.y = this.heroYaw;
    }

    // Stiff Solid-Body Slight Elastic Squash (strictly <= 6% deformation!)
    this.heroSoftSquashVel +=
      (-135 * this.heroSoftSquash - 15.0 * this.heroSoftSquashVel) * dt;
    this.heroSoftSquash = THREE.MathUtils.clamp(
      this.heroSoftSquash + this.heroSoftSquashVel * dt,
      -MAX_SOLID_SQUASH,
      MAX_SOLID_SQUASH
    );
    const hSy = 1 - this.heroSoftSquash;
    const hSxz = 1 / Math.sqrt(Math.max(0.85, hSy));
    this.heroCapy.scale.set(hSxz, hSy, hSxz);

    for (let i = 0; i < this.sanctuaryCapys.length; i++) {
      if (!this.sanctuaryCapys[i].capy.visible) continue;
      this.buddySoftSquashVel[i] +=
        (-135 * this.buddySoftSquash[i] - 15.0 * this.buddySoftSquashVel[i]) * dt;
      this.buddySoftSquash[i] = THREE.MathUtils.clamp(
        this.buddySoftSquash[i] + this.buddySoftSquashVel[i] * dt,
        -MAX_SOLID_SQUASH,
        MAX_SOLID_SQUASH
      );
      const bSy = 0.84 * (1 - this.buddySoftSquash[i]);
      const bSxz = 0.84 / Math.sqrt(Math.max(0.85, 1 - this.buddySoftSquash[i]));
      this.sanctuaryCapys[i].capy.scale.set(bSxz, bSy, bSxz);
    }
  }

  private tickPhysicsFruitsAndMouthCheck(dt: number) {
    const mouthMaxR = this.getMouthMaxFruitRadius();
    const magnetRad = this.getEffectiveMagnetRadius();
    const pool = this.homePool;

    // 1. Integrate gravity, ground bounce, 3-axis rolling spin, pond buoyancy & mouth eating
    for (let i = 0; i < this.physicsFruits.length; i++) {
      const f = this.physicsFruits[i];
      if (!f.active) continue;
      if (f.pickupDelay > 0) f.pickupDelay -= dt;
      f.bobPhase += dt * 3.4;

      // Check if fruit entered the sunken Home Pool water
      if (pool) {
        const dPool = Math.hypot(f.x - pool.centerX, f.z - pool.centerZ);
        if (dPool < pool.basinRadius - f.radius - 0.12 && f.y <= pool.waterMesh.position.y + f.radius + 0.35) {
          f.inPond = true;
        }
      }

      if (f.inPond && pool) {
        // Floating & bobbing buoyantly inside the Home Pool!
        const waterY = pool.waterMesh.position.y;
        const targetFloatY = waterY - f.radius * 0.22 + Math.sin(f.bobPhase) * 0.032;
        f.vy += (targetFloatY - f.y) * 24 * dt;
        f.vy *= Math.exp(-5.5 * dt);
        // Gentle circulation away from the pouring tap water stream
        const dxTap = f.x - pool.tapStreamWorldX;
        const dzTap = f.z - pool.tapStreamWorldZ;
        const dTap = Math.hypot(dxTap, dzTap);
        if (dTap < 1.35 && dTap > 0.001) {
          f.vx += (dxTap / dTap) * 1.8 * dt;
          f.vz += (dzTap / dTap) * 1.8 * dt;
        }
        f.vx *= Math.exp(-2.2 * dt);
        f.vz *= Math.exp(-2.2 * dt);
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.z += f.vz * dt;

        // Confine floating pond fruit inside the stone basin walls (zero clipping!)
        const dxC = f.x - pool.centerX;
        const dzC = f.z - pool.centerZ;
        const dC = Math.hypot(dxC, dzC);
        const maxPoolR = Math.max(0.4, pool.basinRadius - f.radius - 0.26);
        if (dC > maxPoolR && dC > 0.0001) {
          const nx = dxC / dC;
          const nz = dzC / dC;
          f.x = pool.centerX + nx * maxPoolR;
          f.z = pool.centerZ + nz * maxPoolR;
          const vDot = f.vx * nx + f.vz * nz;
          if (vDot > 0) {
            f.vx -= 1.45 * vDot * nx;
            f.vz -= 1.45 * vDot * nz;
          }
        }
        f.mesh.userData.haloRing.visible = false;
      } else {
        // Realistic Gravity Fall, Restitution Ground Bounce & 3D Rolling Angular Velocity (omega = v / r)
        f.mesh.userData.haloRing.visible = true;
        f.vy -= 22.5 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.z += f.vz * dt;

        const groundY = f.radius;
        if (f.y <= groundY) {
          f.y = groundY;
          if (f.vy < -1.1) {
            const impactSpeed = Math.min(12, -f.vy);
            f.vy = -f.vy * 0.44;
            f.squashVel -= impactSpeed * 0.48;
          } else {
            f.vy = 0;
            // Subtle island meadow crown slope acceleration so dropped fruits roll naturally!
            const rDist = Math.hypot(f.x, f.z);
            if (rDist > 0.2 && rDist < 31) {
              f.vx += (f.x / rDist) * 0.22 * dt;
              f.vz += (f.z / rDist) * 0.22 * dt;
            }
            // Rolling grass friction
            const drag = Math.exp(-1.35 * dt);
            f.vx *= drag;
            f.vz *= drag;
          }
        }

        // Clamp inside island shoreline
        const dShore = Math.hypot(f.x, f.z);
        const maxShore = 33.2 - f.radius;
        if (dShore > maxShore && dShore > 0.001) {
          const nx = f.x / dShore;
          const nz = f.z / dShore;
          f.x = nx * maxShore;
          f.z = nz * maxShore;
          f.vx *= -0.5;
          f.vz *= -0.5;
        }

        // Non-clipping against tree trunks & pool rim boulders
        for (let t = 0; t < this.sanctuaryTrees.length; t++) {
          const tree = this.sanctuaryTrees[t];
          const res = this.pushCircleOutOfStaticObstacle(
            f.x,
            f.z,
            f.radius,
            tree.x,
            tree.z,
            tree.trunkRadius
          );
          if (res.hit) {
            f.x = res.x;
            f.z = res.z;
            const vDot = f.vx * res.nx + f.vz * res.nz;
            if (vDot < 0) {
              f.vx -= 1.5 * vDot * res.nx;
              f.vz -= 1.5 * vDot * res.nz;
              f.squashVel -= 1.2;
            }
          }
        }
        if (pool) {
          const rims = pool.rimColliders;
          for (let r = 0; r < rims.length; r++) {
            const rock = rims[r];
            const res = this.pushCircleOutOfStaticObstacle(
              f.x,
              f.z,
              f.radius,
              rock.x,
              rock.z,
              rock.radius
            );
            if (res.hit) {
              f.x = res.x;
              f.z = res.z;
              const vDot = f.vx * res.nx + f.vz * res.nz;
              if (vDot < 0) {
                f.vx -= 1.5 * vDot * res.nx;
                f.vz -= 1.5 * vDot * res.nz;
              }
            }
          }
        }

        // Gentle mouth attraction ONLY when fruit matches Head Orange AND fits in mouth!
        if (
          f.pickupDelay <= 0 &&
          f.varietyIndex === this.activeHeadOrangeIndex &&
          f.radius <= mouthMaxR &&
          f.y <= f.radius + 0.9
        ) {
          const noseX = this.heroLocalPos.x + Math.sin(this.heroYaw) * 0.55;
          const noseZ = this.heroLocalPos.z + Math.cos(this.heroYaw) * 0.55;
          const dNose = Math.hypot(noseX - f.x, noseZ - f.z);
          if (dNose < magnetRad && dNose > 0.01) {
            const pull = 7.5 * dt;
            f.vx += ((noseX - f.x) / dNose) * pull;
            f.vz += ((noseZ - f.z) / dNose) * pull;
          }
        }
      }

      // True 3-axis rolling rotation (axis = UP x velocity, angle = speed * dt / radius)
      const hSpeed = Math.hypot(f.vx, f.vz);
      if (hSpeed > 0.015) {
        _rollAxis.set(f.vz / hSpeed, 0, -f.vx / hSpeed);
        f.mesh.userData.rollGroup.rotateOnWorldAxis(
          _rollAxis,
          (hSpeed * dt) / Math.max(0.12, f.radius)
        );
      }

      // Soft-body squash-and-stretch spring on each fruit
      f.squashVel += (-78 * f.squash - 8.5 * f.squashVel) * dt;
      f.squash = THREE.MathUtils.clamp(f.squash + f.squashVel * dt, -0.32, 0.32);
      const fSy = 1 - f.squash;
      const fSxz = 1 / Math.sqrt(Math.max(0.55, fSy));
      f.mesh.userData.squashGroup.scale.set(fSxz, fSy, fSxz);
      f.mesh.position.set(f.x, f.y, f.z);
    }

    // 2. Pairwise Fruit-vs-Fruit 3D Non-Clipping Elastic Collisions (both on ground & in pond!)
    for (let i = 0; i < this.physicsFruits.length; i++) {
      const a = this.physicsFruits[i];
      if (!a.active) continue;
      for (let j = i + 1; j < this.physicsFruits.length; j++) {
        const b = this.physicsFruits[j];
        if (!b.active) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const dist = Math.hypot(dx, dy, dz);
        const minSep = a.radius + b.radius;
        if (dist < minSep) {
          const nx = dist > 0.0001 ? dx / dist : 1;
          const ny = dist > 0.0001 ? dy / dist : 0;
          const nz = dist > 0.0001 ? dz / dist : 0;
          const overlap = minSep - dist;
          const massA = a.radius * a.radius * a.radius;
          const massB = b.radius * b.radius * b.radius;
          const invTotal = 1 / (massA + massB);
          a.x += nx * overlap * (massB * invTotal);
          a.z += nz * overlap * (massB * invTotal);
          b.x -= nx * overlap * (massA * invTotal);
          b.z -= nz * overlap * (massA * invTotal);
          if (a.inPond && b.inPond) {
            a.y += ny * overlap * 0.25;
            b.y -= ny * overlap * 0.25;
          }

          const rvx = a.vx - b.vx;
          const rvz = a.vz - b.vz;
          const relNormal = rvx * nx + rvz * nz;
          if (relNormal < 0) {
            const impulse = -(1.55 * relNormal) * invTotal;
            a.vx += impulse * massB * nx;
            a.vz += impulse * massB * nz;
            b.vx -= impulse * massA * nx;
            b.vz -= impulse * massA * nz;
            a.squashVel -= 1.1;
            b.squashVel -= 1.1;
          }
          a.mesh.position.set(a.x, a.y, a.z);
          b.mesh.position.set(b.x, b.y, b.z);
        }
      }
    }

    // 3. Hero Capybara Mouth-Size Eating vs Physical Soft-Body Push for Oversized Fruits!
    const noseX = this.heroLocalPos.x + Math.sin(this.heroYaw) * 0.55;
    const noseZ = this.heroLocalPos.z + Math.cos(this.heroYaw) * 0.55;

    for (let i = 0; i < this.physicsFruits.length; i++) {
      const f = this.physicsFruits[i];
      if (!f.active || f.inPond) continue;

      const dMouth = Math.min(
        Math.hypot(noseX - f.x, noseZ - f.z),
        Math.hypot(this.heroLocalPos.x - f.x, this.heroLocalPos.z - f.z)
      );
      const contactDist = 0.72 + f.radius;

      if (dMouth < contactDist && Math.abs(this.heroLocalPos.y + 0.45 - f.y) < 1.35 + f.radius) {
        if (
          f.pickupDelay <= 0 &&
          f.varietyIndex === this.activeHeadOrangeIndex &&
          f.radius <= mouthMaxR
        ) {
          // Fruit fits in mouth! Return slot to pool and grow logarithmically!
          f.active = false;
          f.mesh.visible = false;

          const massGain = Math.pow(f.radius / 0.24, 1.5);
          this.orangesCollectedCount++;
          this.fruitsCarried++;
          this.eatenFruitMass += massGain;
          this.heroSoftSquashVel += 2.6;
          this.syncLogarithmicBodyLength(true);

          AudioService.playCoin();
          this.awardProgress(
            2,
            'sanctuary',
            this.bestSnakeSegments * 10 + this.orangesCollectedCount
          );
          this.registerArcadeCombo('Yuzu Chomp!');
          this.callbacks.onBountyEvent?.('collect_yuzu', 1);
          const variety = HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex];
          const onBack = Math.max(0, this.fruitsCarried - 1);
          this.callbacks.onModeNotification?.(
            `Chomped ${Math.round(f.radius * 100)}cm ${variety.name}! Sausage body: ${this.logarithmicLengthMeters.toFixed(1)}m (${this.snakeSegmentCount} segs · ${onBack} on back)`
          );
          this.emitTelemetry();
        } else {
          // Oversized fruit (or still in brief knock-off cooldown): NEVER clip — push & roll away physically!
          const dx = f.x - this.heroLocalPos.x;
          const dz = f.z - this.heroLocalPos.z;
          const dist = Math.hypot(dx, dz) || 1;
          const nx = dx / dist;
          const nz = dz / dist;
          const minSep = 0.7 + f.radius;
          if (dist < minSep) {
            const overlap = minSep - dist;
            // Heavy giant fruits also push the Capybara back slightly!
            const capyShare = f.radius > 0.65 ? 0.35 : 0.12;
            this.heroLocalPos.x -= nx * overlap * capyShare;
            this.heroLocalPos.z -= nz * overlap * capyShare;
            f.x += nx * overlap * (1 - capyShare);
            f.z += nz * overlap * (1 - capyShare);
            f.vx += nx * (4.8 / Math.max(0.5, f.radius));
            f.vz += nz * (4.8 / Math.max(0.5, f.radius));
            f.squashVel -= 2.2;
            this.heroSoftSquashVel -= 1.6;
            f.mesh.position.set(f.x, f.y, f.z);
          }

          if (f.radius > mouthMaxR && this.mouthFullNotifyCooldown <= 0) {
            this.mouthFullNotifyCooldown = 1.4;
            AudioService.playBrickHit(0.65);
            this.callbacks.onModeNotification?.(
              `Fruit too big for your mouth (${Math.round(f.radius * 100)}cm > ${Math.round(mouthMaxR * 100)}cm max) — eat smaller fruits to grow first!`
            );
          }
        }
      }
    }
  }

  private tickHomePoolTapAndOverflow(dt: number) {
    const pool = this.homePool;
    if (!pool) return;

    // 1. Check if Hero Capybara is swimming inside the Home Pool under the running Tap Water stream
    const dPool = Math.hypot(
      this.heroLocalPos.x - pool.centerX,
      this.heroLocalPos.z - pool.centerZ
    );
    const inHomePool =
      dPool < pool.basinRadius - 0.32 &&
      this.heroLocalPos.y <= pool.waterMesh.position.y - 0.18;
    if (inHomePool) {
      this.isSwimmingInPool = true;
    }

    if (inHomePool) {
      const headX = this.heroLocalPos.x + Math.sin(this.heroYaw) * 0.52;
      const headZ = this.heroLocalPos.z + Math.cos(this.heroYaw) * 0.52;
      const dTap = Math.min(
        Math.hypot(headX - pool.tapStreamWorldX, headZ - pool.tapStreamWorldZ),
        Math.hypot(
          this.heroLocalPos.x - pool.tapStreamWorldX,
          this.heroLocalPos.z - pool.tapStreamWorldZ
        )
      );

      // Putting head under the running tap water washes extra fruits off your back into the pool until 1 Head Orange is left!
      if (dTap < 1.12 && this.fruitsCarried > 1) {
        this.tapWashAccum += dt;
        while (this.tapWashAccum >= 0.16 && this.fruitsCarried > 1) {
          this.tapWashAccum -= 0.16;
          const prevCarried = this.fruitsCarried;
          this.fruitsCarried = Math.max(1, this.fruitsCarried - 1);
          if (this.fruitsCarried === 1) {
            this.eatenFruitMass = 0;
          } else {
            this.eatenFruitMass = Math.max(
              0,
              this.eatenFruitMass * ((this.fruitsCarried - 1) / Math.max(1, prevCarried - 1))
            );
          }
          this.syncLogarithmicBodyLength(true);

          // Drop the washed fruit into the pond water!
          const angle = Math.random() * Math.PI * 2;
          this.spawnPhysicsFruit(
            pool.tapStreamWorldX + Math.cos(angle) * 0.25,
            pool.waterMesh.position.y + 0.55,
            pool.tapStreamWorldZ + Math.sin(angle) * 0.25,
            Math.cos(angle) * 1.9 + 1.2,
            -2.6,
            Math.sin(angle) * 1.9,
            0.25,
            this.activeHeadOrangeIndex,
            true,
            999
          );
          this.worldEnv.triggerPondSplashBurst(pool, 6);
          AudioService.playSplash();

          if (this.fruitsCarried === 1) {
            this.callbacks.onModeNotification?.(
              'Tap water washed all back fruits into your Home Pool — 1 signature Head Orange left!'
            );
          } else {
            this.callbacks.onModeNotification?.(
              `Tap water washing fruits off your back into the pool... (${this.fruitsCarried - 1} left on back)`
            );
          }
          this.emitTelemetry();
        }
      } else {
        this.tapWashAccum = 0;
      }
    } else {
      this.tapWashAccum = 0;
    }

    // 2. Compute Pond Fruit Count, Water Displacement & Overflow Splash-Out Mess!
    let count = 0;
    let volUnits = 0;
    for (let i = 0; i < this.physicsFruits.length; i++) {
      const f = this.physicsFruits[i];
      if (f.active && f.inPond) {
        count++;
        volUnits += Math.pow(f.radius / 0.24, 2.2);
      }
    }
    this.pondFruitCount = count;
    this.pondDisplacedVolume = volUnits;

    const wasOverflowing = this.pondOverflowing;
    this.pondOverflowing =
      count >= POND_OVERFLOW_FRUIT_THRESHOLD || volUnits >= POND_OVERFLOW_FRUIT_THRESHOLD;

    if (this.pondOverflowing) {
      if (!wasOverflowing) {
        this.pondMessLevel = Math.max(this.pondMessLevel, 0.38);
        this.worldEnv.triggerPondSplashBurst(pool, 28);
        AudioService.playSplash();
        this.callbacks.onModeNotification?.(
          `Too many fruits in your Home Pool (${count} fruits)! Water is splashing out and making a muddy mess!`
        );
        this.emitTelemetry();
      }
      this.pondMessLevel = Math.min(1.0, this.pondMessLevel + dt * 0.38);
      this.pondSplashTimer += dt;
      if (this.pondSplashTimer >= 0.26) {
        this.pondSplashTimer = 0;
        this.worldEnv.triggerPondSplashBurst(pool, 12);
      }
    }

    const displacedRise = Math.min(0.24, volUnits * 0.032);
    this.worldEnv.updateHomePoolEffects(
      pool,
      dt,
      displacedRise,
      this.pondOverflowing,
      this.pondMessLevel
    );
  }

  /**
   * Seamlessly re-bases `currentMode` and `heroLocalPos` when the player physically walks
   * across a Grand Promenade Causeway into another minigame district (zero teleport, zero velocity cut!).
   */
  private syncOverlandDistrictFromWorldPos(wx: number, wy: number, wz: number) {
    const nextDistrict = classifyDistrictAtWorldPos(wx, wz, this.currentMode);
    if (nextDistrict === this.currentMode) return;

    const prevMode = this.currentMode;
    this.currentMode = nextDistrict;
    this.physicsBridge.setActiveDistrict(nextDistrict);

    const nextZone = ZONE_LOCATIONS[nextDistrict];
    this.heroLocalPos.set(wx - nextZone.x, wy, wz - nextZone.z);

    if (prevMode === 'spore' && nextDistrict !== 'spore') {
      this.heroCapy.scale.setScalar(1.0);
    }

    if (nextDistrict === 'sanctuary') {
      this.syncDachshundVisibility();
      this.resetDachshundTrail();
      this.updateDachshundTransforms(0);
      this.callbacks.onModeNotification?.(
        'Walked into Capy Sanctuary (0, 0) • Orchard, Home Pool & Sandbox Builder active!'
      );
    } else {
      this.syncDachshundVisibility();
      if (nextDistrict === 'spore') {
        this.callbacks.onModeNotification?.(
          'Walked into Spore Lagoon (-110, -110) • Swim, chomp Yuzu Plankton & splice DNA!'
        );
      } else if (nextDistrict === 'capytorio') {
        this.emitCapytorioSnapshot();
        this.callbacks.onModeNotification?.(
          'Arrived at Capytorio Infinite Plain (+1200, 0) • Build across endless mineral land!'
        );
      } else if (nextDistrict === 'runner') {
        this.callbacks.onModeNotification?.(
          'Walked into Number Stampede (-110, +135) • Sprint the blue math lanes or explore freely!'
        );
      } else if (nextDistrict === 'fallguys') {
        this.callbacks.onModeNotification?.(
          'Walked into Yuzu Mountain (+110, +135) • Dodge kinetic hammers, tilt the see-saw & claim the Crown!'
        );
      }
    }

    this.callbacks.onPortalEntered?.(nextDistrict);
    this.emitTelemetry();
  }

  /**
   * Unified Contiguous World & Multi-Threaded Physics Engine Step:
   * 1. Ticks active player physics, swept CCD, fluid buoyancy & XPBD soft bodies in the current district
   * 2. Ticks ALL 4 other minigame ecosystems simultaneously in the background so the entire world is alive
   * 3. Detects overland walking across any of the 4 Grand Promenade Causeways for zero-cut handover
   */
  private tickContiguousUnifiedWorld(dt: number) {
    // Advance rotating hammers & dynamic see-saw visuals every frame regardless of player district
    const fz = ZONE_LOCATIONS.fallguys;
    for (let i = 0; i < this.spinningObstacles.length; i++) {
      const obs = this.spinningObstacles[i];
      obs.mesh.rotation.y += obs.speed * dt;
      if (this.hammerWorldScratch[i]) {
        this.hammerWorldScratch[i].wx = fz.x + obs.mesh.position.x;
        this.hammerWorldScratch[i].wz = fz.z + obs.mesh.position.z;
        this.hammerWorldScratch[i].angleY = obs.mesh.rotation.y;
        this.hammerWorldScratch[i].angularSpeed = obs.speed;
      }
    }

    // Step background ecosystems for districts where the player is not currently standing,
    // striding distant districts (>85m / >135m) with exact accumulated dt to preserve locked 60 FPS!
    this.bgDistrictFrameCounter = (this.bgDistrictFrameCounter + 1) & 0x3fffffff;
    const curZone = ZONE_LOCATIONS[this.currentMode];
    const hWx = curZone.x + this.heroLocalPos.x;
    const hWz = curZone.z + this.heroLocalPos.z;
    const camWx = this.camera.position.x;
    const camWz = this.camera.position.z;

    const stepBgDistrict = (
      mode: PlayStyle,
      group: THREE.Group,
      fn: (stepDt: number) => void
    ) => {
      if (this.currentMode === mode) {
        this.bgDistrictDtAccum[mode] = 0;
        return;
      }
      if (!group.visible) {
        this.bgDistrictDtAccum[mode] = 0;
        return;
      }
      const zLoc = ZONE_LOCATIONS[mode];
      const dHeroSq = (hWx - zLoc.x) * (hWx - zLoc.x) + (hWz - zLoc.z) * (hWz - zLoc.z);
      const dCamSq = (camWx - zLoc.x) * (camWx - zLoc.x) + (camWz - zLoc.z) * (camWz - zLoc.z);
      const stride = computeDistrictTickStride(Math.min(dHeroSq, dCamSq));
      this.bgDistrictDtAccum[mode] += dt;
      if (this.bgDistrictFrameCounter % stride === 0) {
        const stepDt = Math.min(0.25, this.bgDistrictDtAccum[mode]);
        this.bgDistrictDtAccum[mode] = 0;
        fn(stepDt);
      }
    };

    stepBgDistrict('sanctuary', this.sanctuaryGroup, (sDt) => this.tickSanctuaryAmbientOnly(sDt));
    stepBgDistrict('spore', this.sporeGroup, (sDt) => this.tickSporeEcosystemOnly(sDt));
    stepBgDistrict('capytorio', this.capytorioGroup, (sDt) => this.tickCapytorioEcosystemOnly(sDt));
    stepBgDistrict('runner', this.runnerGroup, (sDt) => this.tickRunnerEcosystemOnly(sDt));
    stepBgDistrict('fallguys', this.fallGuysGroup, (sDt) => this.tickFallGuysEcosystemOnly(sDt));

    // Step player + active district gameplay
    if (this.currentMode === 'sanctuary') {
      this.tickSanctuary(dt);
    } else if (this.currentMode === 'spore') {
      this.tickSpore(dt);
    } else if (this.currentMode === 'capytorio') {
      this.tickCapytorio(dt);
    } else if (this.currentMode === 'runner') {
      this.tickRunner(dt);
    } else if (this.currentMode === 'fallguys') {
      this.tickFallGuys(dt);
    }

    // Synchronize XPBD soft-body visual compression on mushroom pads
    for (let i = 0; i < this.sanctuaryBuildingMeshes.length; i++) {
      const bm = this.sanctuaryBuildingMeshes[i];
      if (bm.userData?.buildingType === 'trampoline_pad') {
        const bId = bm.name.replace('building_', '');
        const comp = this.physicsBridge.getSoftPadCompression(`pad_${bId}`);
        if (comp > 0.001) {
          const lateralPoisson = 1.0 / Math.sqrt(Math.max(0.55, 1.0 - comp));
          bm.scale.set(lateralPoisson, Math.max(0.58, 1.0 - comp), lateralPoisson);
        }
      }
    }

    // Evaluate seamless overland district transition after player movement
    const activeZone = ZONE_LOCATIONS[this.currentMode];
    const heroWx = activeZone.x + this.heroLocalPos.x;
    const heroWy = this.heroLocalPos.y;
    const heroWz = activeZone.z + this.heroLocalPos.z;
    this.syncOverlandDistrictFromWorldPos(heroWx, heroWy, heroWz);
  }

  private tickSanctuaryAmbientOnly(dt: number) {
    for (let i = 0; i < this.sanctuaryCapys.length; i++) {
      const buddy = this.sanctuaryCapys[i];
      if (!buddy.capy.visible) continue;
      buddy.stateTimer -= dt;
      if (buddy.stateTimer <= 0) {
        buddy.stateTimer = 4 + this.proceduralPrng() * 5;
        const rad = 6.5 + this.proceduralPrng() * 19.5;
        const ang = this.proceduralPrng() * Math.PI * 2;
        buddy.target.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
      }
      _tempVec3.subVectors(buddy.target, buddy.capy.position);
      if (_tempVec3.length() > 0.35) {
        _tempVec3.normalize();
        buddy.capy.position.addScaledVector(_tempVec3, 2.15 * dt);
        buddy.capy.rotation.y = Math.atan2(_tempVec3.x, _tempVec3.z);
        this.animateCapyLegs(buddy.capy, dt, 7, 1);
      }
    }
    this.tickHomePoolTapAndOverflow(dt);
  }

  private tickSporeEcosystemOnly(dt: number) {
    for (let i = 0; i < this.sporeOrbs.length; i++) {
      const orb = this.sporeOrbs[i];
      if (!orb.active) continue;
      orb.mesh.rotation.y += dt * 2.2;
    }
    for (let i = 0; i < this.sporeCritters.length; i++) {
      const critter = this.sporeCritters[i];
      if (!critter.active) continue;
      critter.changeDirTimer -= dt;
      if (critter.changeDirTimer <= 0) {
        critter.changeDirTimer = 2 + this.proceduralPrng() * 3;
        critter.vel.set(
          (this.proceduralPrng() - 0.5) * 6,
          0,
          (this.proceduralPrng() - 0.5) * 6
        );
      }
      critter.mesh.position.addScaledVector(critter.vel, dt);
      critter.mesh.position.x = THREE.MathUtils.clamp(critter.mesh.position.x, -32, 32);
      critter.mesh.position.z = THREE.MathUtils.clamp(critter.mesh.position.z, -32, 32);
      critter.mesh.rotation.y = Math.atan2(critter.vel.x, critter.vel.z);
      this.animateCapyLegs(critter.mesh, dt, 9);
    }
  }

  private syncCapytorioConfigMultipliers(): void {
    const cCfg = this.proceduralConfig.districts.capytorio;
    const upgradeBoost = 1 + (Math.max(1, this.stats.upgrades.paddleSize) - 1) * 0.15;
    this.capytorioEngine.configCraftSpeedMult = cCfg.craftSpeedMultiplier * upgradeBoost;
    this.capytorioEngine.configBeltSpeedMult =
      cCfg.beltSpeedMultiplier * (1 + (Math.max(1, this.stats.upgrades.paddleSize) - 1) * 0.08);
    this.capytorioEngine.configOreRichnessMult = cCfg.oreRichnessMultiplier;
  }

  private tickCapytorioEcosystemOnly(dt: number) {
    this.syncCapytorioConfigMultipliers();
    this.capytorioEngine.step(dt, this.capytorioStepCallbacks);
    if (this.capytorioGroup.visible) {
      this.ensureCapytorioRenderer().sync(
        this.capytorioEngine,
        this.camera.position.x,
        this.camera.position.z,
        dt,
        this.worldEnv?.elapsedSeconds ?? performance.now() * 0.001,
        true
      );
    }
  }

  private tickRunnerEcosystemOnly(dt: number) {
    for (let i = 0; i < this.runnerHerdMeshes.length; i++) {
      if (!this.runnerHerdMeshes[i].visible) continue;
      this.animateCapyLegs(this.runnerHerdMeshes[i], dt, 10);
    }
  }

  private tickFallGuysEcosystemOnly(dt: number) {
    const seeSawTilt = this.physicsBridge.getSeeSawTiltAngle();
    for (let i = 0; i < this.seeSaws.length; i++) {
      this.seeSaws[i].mesh.rotation.z = seeSawTilt;
    }
    for (let i = 0; i < this.fallGuysRivals.length; i++) {
      const rival = this.fallGuysRivals[i];
      if (!rival.capy.visible) continue;
      rival.capy.position.z -= rival.speed * dt;
      rival.capy.position.x =
        rival.laneOffset + Math.sin(rival.capy.position.z * 0.35) * 1.1;
      this.animateCapyLegs(rival.capy, dt, 14);
      if (rival.capy.position.z < -60) {
        rival.capy.position.z = 0;
      }
    }
  }

  private tickSanctuary(dt: number) {
    this.syncDachshundVisibility();

    if (!this.spineInitialized) {
      this.resetDachshundTrail();
    }

    const totalNodes = this.snakeSegmentCount + 2;
    const cabNode = totalNodes - 1;

    const pool = this.homePool;
    const dPoolCenter = pool
      ? Math.hypot(this.heroLocalPos.x - pool.centerX, this.heroLocalPos.z - pool.centerZ)
      : 999;
    const inPoolBasin = pool
      ? dPoolCenter < pool.basinRadius - 0.32 &&
        this.heroLocalPos.y <= pool.waterMesh.position.y - 0.18
      : false;
    this.isSwimmingInPool = inPoolBasin || this.lastOceanFluidActive;

    // 1. Evaluate 3D foot sole ground contact BEFORE applying walking propulsion!
    this.evaluateFootContactsAndTraction();

    const swimSpeedMult = this.isSwimmingInPool ? 0.86 : 1.0;
    const speed = this.baseHeroSpeed * this.getEffectiveSpeedMultiplier() * swimSpeedMult;
    const lengthZoomFactor = 1 + Math.min(0.78, (this.snakeSegmentCount - 1) * 0.035);
    const camHeight = 6.8 * lengthZoomFactor;
    const camDist = 11.5 * lengthZoomFactor;

    const { forwardInput, walkDir, hasWalkIntent, tractionMult, effectiveSpeed } =
      this.applyPlayerMovementAndCamera(dt, speed, camHeight, camDist, true, true);

    const turnSens = this.settings.turnSensitivity || 1.0;
    const leaderIdx = this.isWalkingBackward ? cabNode : 0;
    const prevLeaderX = this.isWalkingBackward ? this.spineX[cabNode] : this.heroLocalPos.x;
    const prevLeaderZ = this.isWalkingBackward ? this.spineZ[cabNode] : this.heroLocalPos.z;

    const airborneInSanctuary =
      !this.isGrounded && !this.isSwimmingInPool && this.suspendedFootTestHeight === null;
    if (airborneInSanctuary) {
      // Subtle aerodynamic drag + gentle mid-air directional control while preserving forward leap arc
      const airDamp = Math.exp(-0.85 * dt);
      this.heroVelocity.x *= airDamp;
      this.heroVelocity.z *= airDamp;
      if (hasWalkIntent && !this.isWalkingBackward) {
        const steerYaw = this.settings.cameraFollowBehind
          ? this.heroYaw - this.moveInput.x * 1.4 * turnSens * dt
          : Math.atan2(this.moveInput.x, this.moveInput.z);
        this.heroYaw = steerYaw;
        this.heroCapy.rotation.y = steerYaw;
        this.heroVelocity.x += Math.sin(steerYaw) * speed * 1.6 * dt;
        this.heroVelocity.z += Math.cos(steerYaw) * speed * 1.6 * dt;
      }
    }

    if (this.isWalkingBackward) {
      // BACKWARD WALKING: Back hindquarters (Caboose) IS the leader! Steer & propel cabNode directly.
      if (Math.abs(this.moveInput.x) > 0.02 && tractionMult > 0) {
        this.spineYaw[cabNode] += this.moveInput.x * 2.1 * turnSens * dt;
      }
      const cabYaw = this.spineYaw[cabNode];
      const cabVx = Math.sin(cabYaw) * forwardInput * effectiveSpeed;
      const cabVz = Math.cos(cabYaw) * forwardInput * effectiveSpeed;
      this.spineX[cabNode] += (cabVx + this.heroVelocity.x) * dt;
      this.spineZ[cabNode] += (cabVz + this.heroVelocity.z) * dt;
    } else {
      // FORWARD WALKING: Front Hero Capybara (node 0) IS the leader.
      if (this.settings.cameraFollowBehind) {
        if (Math.abs(this.moveInput.x) > 0.02 && tractionMult > 0) {
          this.heroYaw -= this.moveInput.x * 2.6 * turnSens * dt;
        } else if (
          Math.abs(-this.moveInput.z) > 0.04 &&
          tractionMult > 0 &&
          this.settings.mouselookEnabled !== false &&
          (this.mouselookLocked || performance.now() - this.mouselookLastActiveTimeMs < 2400)
        ) {
          this.heroYaw = dampShortestAngle(this.heroYaw, this.surfaceCamYaw, 9.0 * turnSens, dt);
        }
        const moveVx = Math.sin(this.heroYaw) * forwardInput * effectiveSpeed;
        const moveVz = Math.cos(this.heroYaw) * forwardInput * effectiveSpeed;
        this.heroLocalPos.x += (moveVx + this.heroVelocity.x) * dt;
        this.heroLocalPos.z += (moveVz + this.heroVelocity.z) * dt;
      } else {
        const moveVx = this.moveInput.x * effectiveSpeed;
        const moveVz = this.moveInput.z * effectiveSpeed;
        this.heroLocalPos.x += (moveVx + this.heroVelocity.x) * dt;
        this.heroLocalPos.z += (moveVz + this.heroVelocity.z) * dt;
        if (hasWalkIntent && tractionMult > 0) {
          this.heroYaw = Math.atan2(this.moveInput.x, this.moveInput.z);
        }
      }
      this.heroCapy.rotation.y = this.heroYaw;
    }

    const activeLeaderX = this.isWalkingBackward ? this.spineX[cabNode] : this.heroLocalPos.x;
    const activeLeaderY = this.isWalkingBackward ? this.spineY[cabNode] : this.heroLocalPos.y;
    const activeLeaderZ = this.isWalkingBackward ? this.spineZ[cabNode] : this.heroLocalPos.z;

    // 2. Step Rapier3D Wasm + Shallow-Water Fluid Buoyancy + XPBD Soft-Body Pads at ACTIVE leader!
    if (this.suspendedFootTestHeight !== null) {
      this.heroLocalPos.y = this.suspendedFootTestHeight;
      this.spineY[cabNode] = this.suspendedFootTestHeight;
      this.heroVelocity.set(0, 0, 0);
      this.isGrounded = false;
      this.lastOceanFluidActive = false;
    } else {
      const gravityScale =
        (this.activeBiome?.gravityMultiplier ?? 1.0) *
        (this.proceduralConfig.player.gravityScale ?? 1.0);
      const hasWings = this.stats.activeMutations.includes('wings');
      const heroJumpScale =
        (this.activeHeroSpec?.jumpMultiplier ?? 1.0) *
        (hasWings ? 1.15 : 1.0) *
        (this.proceduralConfig.player.jumpImpulseMultiplier ?? 1.0);
      const wasAirborne = !this.isGrounded;
      const prevVy = this.heroVelocity.y;
      const canJumpSanctuary =
        this.coyoteGroundedTimer > 0 ||
        this.groundedFeetCount > 0 ||
        this.isSwimmingInPool ||
        this.isGrounded;

      let jumpImpulseY = 0;
      if (this.isJumping) {
        if (canJumpSanctuary) {
          // Crisp realistic hop (~1.0–1.45m peak under g=24) with true forward leap propulsion along heading!
          const dampedJumpScale = 1 + (heroJumpScale - 1) * 0.42;
          jumpImpulseY =
            (6.4 + Math.min(1.1, (this.stats.upgrades.bounciness - 1) * 0.35)) * dampedJumpScale;
          const launchYaw = this.isWalkingBackward ? this.spineYaw[cabNode] : this.heroYaw;
          const leapDir = this.isWalkingBackward ? -1 : 1;
          const leapSpeed = hasWalkIntent ? Math.max(speed * 1.18, 7.2) : Math.max(speed * 0.9, 5.8);
          this.heroVelocity.x = Math.sin(launchYaw) * leapSpeed * leapDir;
          this.heroVelocity.z = Math.cos(launchYaw) * leapSpeed * leapDir;
          this.isGrounded = false;
          this.coyoteGroundedTimer = 0;
          this.heroSoftSquashVel -= 1.5;
          AudioService.playJump();
        }
        this.isJumping = false;
      }

      const physStep = this.physicsBridge.stepContiguousCharacterAndWorld(
        {
          wx: activeLeaderX,
          wy: activeLeaderY,
          wz: activeLeaderZ,
          vx: 0,
          vy: this.heroVelocity.y,
          vz: 0,
          desiredMoveVx: (activeLeaderX - prevLeaderX) / Math.max(0.001, dt),
          desiredMoveVz: (activeLeaderZ - prevLeaderZ) / Math.max(0.001, dt),
          radius: leaderIdx === cabNode ? 0.54 : 0.68,
          halfHeight: 0.25,
          jumpImpulseY,
          gravityScale,
          dt,
        },
        0,
        this.hammerWorldScratch
      );
      this.lastOceanFluidActive = physStep.inFluid;
      const leaderPoolDist = pool
        ? Math.hypot(activeLeaderX - pool.centerX, activeLeaderZ - pool.centerZ)
        : 999;
      const leaderInPool = pool ? leaderPoolDist < pool.basinRadius - 0.32 : false;
      this.isSwimmingInPool =
        inPoolBasin ||
        (leaderInPool && Boolean(pool && activeLeaderY <= pool.waterMesh.position.y - 0.18)) ||
        (!leaderInPool && physStep.inFluid);

      if (leaderInPool && pool) {
        const targetPoolY =
          pool.waterMesh.position.y -
          0.34 +
          Math.sin(performance.now() * 0.0045) * 0.035;
        this.heroVelocity.y -= 24 * gravityScale * dt;
        const nextY = activeLeaderY + this.heroVelocity.y * dt;
        if (nextY <= targetPoolY) {
          this.spineY[leaderIdx] = targetPoolY;
          if (!this.isWalkingBackward) this.heroLocalPos.y = targetPoolY;
          this.heroVelocity.y = 0;
          if (this.heroDashActiveTimer <= 0) {
            this.heroVelocity.x = 0;
            this.heroVelocity.z = 0;
          } else {
            const dDecay = Math.exp(-4.5 * dt);
            this.heroVelocity.x *= dDecay;
            this.heroVelocity.z *= dDecay;
          }
          this.isGrounded = true;
          this.isSwimmingInPool = true;
          this.coyoteGroundedTimer = 0.14;
          if (this.isGroundPounding) {
            this.handleGroundPoundImpact(activeLeaderX, targetPoolY, activeLeaderZ, true);
          }
        } else {
          this.spineY[leaderIdx] = nextY;
          if (!this.isWalkingBackward) this.heroLocalPos.y = nextY;
          this.isGrounded = false;
          this.isSwimmingInPool = nextY <= pool.waterMesh.position.y - 0.18;
          this.coyoteGroundedTimer = Math.max(0, this.coyoteGroundedTimer - dt);
        }
      } else {
        this.spineY[leaderIdx] = physStep.wy;
        if (!this.isWalkingBackward) this.heroLocalPos.y = physStep.wy;
        this.heroVelocity.y = physStep.vy;
        if (physStep.grounded || physStep.inFluid) {
          this.coyoteGroundedTimer = 0.14;
        } else {
          this.coyoteGroundedTimer = Math.max(0, this.coyoteGroundedTimer - dt);
        }
        if (physStep.grounded) {
          this.isGrounded = true;
          if (this.heroDashActiveTimer <= 0) {
            this.heroVelocity.x = 0;
            this.heroVelocity.z = 0;
          } else {
            const dDecay = Math.exp(-4.5 * dt);
            this.heroVelocity.x *= dDecay;
            this.heroVelocity.z *= dDecay;
          }
          if (wasAirborne && prevVy < -3.0) {
            this.heroSoftSquashVel += Math.min(2.2, -prevVy * 0.16);
          }
          if (this.isGroundPounding) {
            this.handleGroundPoundImpact(
              activeLeaderX,
              physStep.wy,
              activeLeaderZ,
              physStep.inFluid
            );
          }
        } else if (this.isGroundPounding && physStep.inFluid) {
          this.handleGroundPoundImpact(activeLeaderX, physStep.wy, activeLeaderZ, true);
        }
        if (physStep.trampolineBoostY > 0) {
          // Gentle joyful Sanctuary mushroom hop (~1.4–2.1m high) with forward leap arc (zero sky-rocket disconnect)
          this.isGroundPounding = false;
          this.coyoteGroundedTimer = 0;
          const clampedHopVy = Math.min(9.8, Math.max(7.8, physStep.trampolineBoostY * 0.52));
          this.heroVelocity.y = clampedHopVy;
          const launchYaw = this.isWalkingBackward ? this.spineYaw[cabNode] : this.heroYaw;
          const leapDir = this.isWalkingBackward ? -1 : 1;
          this.heroVelocity.x = Math.sin(launchYaw) * Math.max(speed * 0.92, 5.8) * leapDir;
          this.heroVelocity.z = Math.cos(launchYaw) * Math.max(speed * 0.92, 5.8) * leapDir;
          this.isGrounded = false;
          this.heroSoftSquashVel -= 1.8;
          AudioService.playJump();
          this.awardProgress(1, 'sanctuary', this.bestSnakeSegments * 10);
          this.registerArcadeCombo('Mushroom Bounce!');
          this.callbacks.onBountyEvent?.('mushroom_bounce', 1);
          this.callbacks.onModeNotification?.('XPBD Soft-Body Mushroom Bounce! +1 Spore DNA!');
        }
      }
    }

    // Active Sanctuary yuzu_orchard building perk: periodic ripe citrus auto-drop
    const orchardLvl = this.getBuildingLevelSum('yuzu_orchard');
    if (orchardLvl > 0) {
      this.orchardAutoDropTimer += dt;
      const dropInterval = Math.max(4, 14 - orchardLvl * 1.5);
      if (this.orchardAutoDropTimer >= dropInterval) {
        this.orchardAutoDropTimer = 0;
        let dropped = false;
        for (let t = 0; t < this.sanctuaryTrees.length && !dropped; t++) {
          const tree = this.sanctuaryTrees[t];
          if (tree.varietyIndex !== this.activeHeadOrangeIndex) continue;
          for (let s = 0; s < tree.slots.length; s++) {
            const slot = tree.slots[s];
            if (slot.growth >= 0.72) {
              const wx = tree.x + slot.localOffset.x;
              const wy = Math.max(tree.fruitRadius + 0.35, slot.localOffset.y);
              const wz = tree.z + slot.localOffset.z;
              const ang = Math.atan2(slot.localOffset.z, slot.localOffset.x);
              this.spawnPhysicsFruit(
                wx,
                wy,
                wz,
                Math.cos(ang) * 1.2,
                0.7,
                Math.sin(ang) * 1.2,
                tree.fruitRadius,
                tree.varietyIndex,
                false,
                0.08
              );
              slot.growth = 0.06;
              this.worldEnv.applyProceduralFruitGrowthVisuals(
                slot,
                HEAD_ORANGE_VARIETIES[tree.varietyIndex]?.colorHex ?? 0xff7a00
              );
              dropped = true;
              break;
            }
          }
        }
        if (!dropped) {
          for (let b = 0; b < this.stats.buildings.length; b++) {
            const bld = this.stats.buildings[b];
            if (bld.type === 'yuzu_orchard') {
              const ang = this.proceduralPrng() * Math.PI * 2;
              this.spawnPhysicsFruit(
                bld.x + Math.cos(ang) * 1.5,
                2.2,
                bld.z + Math.sin(ang) * 1.5,
                Math.cos(ang) * 1.1,
                0.9,
                Math.sin(ang) * 1.1,
                0.24,
                this.activeHeadOrangeIndex,
                false,
                0.08
              );
              break;
            }
          }
        }
      }
    } else {
      this.orchardAutoDropTimer = 0;
    }

    // Check hot_spring building presence for buddy attraction
    let hotSpringRef: { x: number; z: number } | null = null;
    for (let b = 0; b < this.stats.buildings.length; b++) {
      if (this.stats.buildings[b].type === 'hot_spring') {
        hotSpringRef = this.stats.buildings[b];
        break;
      }
    }

    // Ambient Capybara buddies wandering around the orchard (or basking near hot_spring)
    for (let i = 0; i < this.sanctuaryCapys.length; i++) {
      const buddy = this.sanctuaryCapys[i];
      if (!buddy.capy.visible) continue;
      buddy.stateTimer -= dt;
      if (buddy.stateTimer <= 0) {
        buddy.stateTimer = 4 + this.proceduralPrng() * 5;
        if (hotSpringRef && this.proceduralPrng() < 0.48) {
          const ang = this.proceduralPrng() * Math.PI * 2;
          const r = 2.0 + this.proceduralPrng() * 1.8;
          buddy.target.set(
            hotSpringRef.x + Math.cos(ang) * r,
            0,
            hotSpringRef.z + Math.sin(ang) * r
          );
        } else {
          const rad = 6.5 + this.proceduralPrng() * 19.5;
          const ang = this.proceduralPrng() * Math.PI * 2;
          buddy.target.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
        }
      }
      _tempVec3.subVectors(buddy.target, buddy.capy.position);
      if (_tempVec3.length() > 0.35) {
        _tempVec3.normalize();
        buddy.capy.position.addScaledVector(_tempVec3, 2.15 * dt);
        buddy.capy.rotation.y = Math.atan2(_tempVec3.x, _tempVec3.z);
        this.animateCapyLegs(buddy.capy, dt, 7, 1);
      } else {
        this.resetCapyLegs(buddy.capy, dt);
      }
    }

    // 3. Solve Bidirectional Solid-Rod Spine, True Back-Led Backward Walking & Multi-Body Non-Clipping!
    this.solveArticulatedSpineAndSolidCollisions(dt, forwardInput, speed);

    const movedLeaderDist = this.isWalkingBackward
      ? Math.hypot(this.spineX[cabNode] - prevLeaderX, this.spineZ[cabNode] - prevLeaderZ)
      : Math.hypot(this.heroLocalPos.x - prevLeaderX, this.heroLocalPos.z - prevLeaderZ);
    this.lastSanctuaryLeaderDisp = movedLeaderDist;

    const isAirborneSearch = !this.isGrounded && !this.isSwimmingInPool;
    const shouldAnimateSpineFeet =
      movedLeaderDist > 0.0018 || (hasWalkIntent && (isAirborneSearch || this.isSwimmingInPool));

    if (shouldAnimateSpineFeet || (hasWalkIntent && !this.isStuckNoFooting && movedLeaderDist > 0.0008)) {
      this.animateCapyLegs(
        this.heroCapy,
        dt,
        this.isWalkingBackward ? 12 : 14,
        walkDir,
        movedLeaderDist,
        hasWalkIntent,
        isAirborneSearch,
        this.isSwimmingInPool
      );
    } else {
      this.resetCapyLegs(this.heroCapy, dt);
    }

    if (this.suspendedFootTestHeight === null) {
      const fwdX = Math.sin(this.heroYaw) * 0.45;
      const fwdZ = Math.cos(this.heroYaw) * 0.45;
      const fY = this.getSupportSurfaceY(this.heroLocalPos.x + fwdX, this.heroLocalPos.z + fwdZ);
      const rY = this.getSupportSurfaceY(this.heroLocalPos.x - fwdX, this.heroLocalPos.z - fwdZ);
      const terrainPitch = computeTerrainPitchAngle(fY, rY, 0.9, 0.38);
      const neckHoriz = Math.max(
        0.35,
        Math.hypot(this.spineX[0] - this.spineX[1], this.spineZ[0] - this.spineZ[1])
      );
      const jumpPitch =
        !this.isGrounded && Math.abs(this.heroVelocity.y) > 0.3
          ? THREE.MathUtils.clamp(-this.heroVelocity.y * 0.038, -0.34, 0.34)
          : computeTerrainPitchAngle(this.spineY[0], this.spineY[1], neckHoriz, 0.36);
      this.heroCapy.rotation.order = 'YXZ';
      this.heroCapy.rotation.x = Math.abs(jumpPitch) > Math.abs(terrainPitch) ? jumpPitch : terrainPitch;
    } else {
      this.heroCapy.rotation.x = 0;
    }

    this.recordSnakeBreadcrumb();
    this.updateDachshundTransforms(
      dt,
      shouldAnimateSpineFeet || (hasWalkIntent && !this.isStuckNoFooting && movedLeaderDist > 0.0008),
      walkDir,
      movedLeaderDist
    );

    // Refresh foot contact telemetry after final segment & limb poses are applied
    this.evaluateFootContactsAndTraction();

    // 4. Tick 3D falling/bouncing/rolling fruits, mouth-size check, and Home Pool tap-wash & overflow splash mess!
    this.tickPhysicsFruitsAndMouthCheck(dt);
    this.tickHomePoolTapAndOverflow(dt);

    this.spineX[0] = this.heroLocalPos.x;
    this.spineZ[0] = this.heroLocalPos.z;

    this.updateWorldHeroAndCamera(dt, camHeight, camDist);
  }

  // --- 2. SPORE EVOLUTION LAGOON TICK (CONTIGUOUS WALK-IN / SWIM-OUT) ---
  private tickSpore(dt: number) {
    const zone = ZONE_LOCATIONS.spore;
    const sCfg = this.proceduralConfig.districts.spore;
    const growthMult = sCfg.growthRateMultiplier;
    const hasGlowTail = this.stats.activeMutations.includes('glow_tail');
    const hasShell = this.stats.activeMutations.includes('shell');
    if (this.sporeDashCooldown > 0) this.sporeDashCooldown -= dt;

    let speed = this.baseHeroSpeed * 1.15 * this.getEffectiveSpeedMultiplier();
    let dashVx = 0;
    let dashVz = 0;
    if (this.isJumping && this.sporeDashCooldown <= 0) {
      this.sporeDashCooldown = (hasGlowTail ? 0.6 : 1.0) * sCfg.dashCooldownSec;
      this.isJumping = false;
      AudioService.playChomp();
      speed *= 2.1;
      dashVx = Math.sin(this.heroYaw) * 16.0;
      dashVz = Math.cos(this.heroYaw) * 16.0;
    }

    const heroScale = Math.min(2.6, 0.85 + Math.log10(Math.max(10, this.sporeMass)) * 0.48);
    this.heroCapy.scale.setScalar(heroScale);

    const prevLx = this.heroLocalPos.x;
    const prevLz = this.heroLocalPos.z;
    this.applyPlayerMovementAndCamera(dt, speed, 7.5 + heroScale * 2.2, 11.0 + heroScale * 1.8);

    const desiredVx = (this.heroLocalPos.x - prevLx) / Math.max(0.001, dt) + dashVx;
    const desiredVz = (this.heroLocalPos.z - prevLz) / Math.max(0.001, dt) + dashVz;

    // Step contiguous physics with Shallow-Water Lagoon Buoyancy & NW Promenade Causeway continuity
    const phys = this.physicsBridge.stepContiguousCharacterAndWorld(
      {
        wx: zone.x + prevLx,
        wy: this.heroLocalPos.y,
        wz: zone.z + prevLz,
        vx: this.heroVelocity.x,
        vy: this.heroVelocity.y,
        vz: this.heroVelocity.z,
        desiredMoveVx: desiredVx,
        desiredMoveVz: desiredVz,
        radius: 0.68,
        halfHeight: 0.25,
        jumpImpulseY: 0,
        gravityScale: this.proceduralConfig.player.gravityScale ?? 1.0,
        dt,
      },
      0,
      this.hammerWorldScratch
    );

    this.heroLocalPos.set(phys.wx - zone.x, phys.wy, phys.wz - zone.z);
    this.heroVelocity.set(phys.vx, phys.vy, phys.vz);
    this.isSwimmingInPool = phys.inFluid;

    const magnetRad = this.getEffectiveMagnetRadius() * heroScale;
    for (let i = 0; i < this.sporeOrbs.length; i++) {
      const orb = this.sporeOrbs[i];
      if (!orb.active) continue;
      orb.mesh.rotation.y += dt * 2.5;
      const d = Math.hypot(
        this.heroLocalPos.x - orb.mesh.position.x,
        this.heroLocalPos.z - orb.mesh.position.z
      );
      if (d < magnetRad) {
        _tempVec3.subVectors(this.heroLocalPos, orb.mesh.position).normalize();
        orb.mesh.position.addScaledVector(_tempVec3, 14 * dt);
      }
      if (d < 1.15 * heroScale) {
        this.sporeMass += orb.value * growthMult;
        const dnaGain = orb.isDna ? 2 : 0;
        this.sporeDnaEarned += dnaGain;
        AudioService.playCoin();
        this.awardProgress(dnaGain, 'spore', Math.round(this.sporeMass));
        if (orb.isDna) {
          this.registerArcadeCombo('DNA Plankton');
          this.callbacks.onBountyEvent?.('spore_chomp', 1);
        }
        const angle = this.proceduralPrng() * Math.PI * 2;
        const rad = 4 + this.proceduralPrng() * 28;
        orb.mesh.position.set(Math.cos(angle) * rad, 0.45, Math.sin(angle) * rad);
      }
    }

    for (let i = 0; i < this.sporeCritters.length; i++) {
      const critter = this.sporeCritters[i];
      if (!critter.active) continue;
      critter.changeDirTimer -= dt;
      if (critter.changeDirTimer <= 0) {
        critter.changeDirTimer = 2 + this.proceduralPrng() * 3;
        critter.vel.set(
          (this.proceduralPrng() - 0.5) * 6,
          0,
          (this.proceduralPrng() - 0.5) * 6
        );
      }
      critter.mesh.position.addScaledVector(critter.vel, dt);
      critter.mesh.position.x = THREE.MathUtils.clamp(critter.mesh.position.x, -32, 32);
      critter.mesh.position.z = THREE.MathUtils.clamp(critter.mesh.position.z, -32, 32);
      critter.mesh.rotation.y = Math.atan2(critter.vel.x, critter.vel.z);
      this.animateCapyLegs(critter.mesh, dt, 10);

      const dx = this.heroLocalPos.x - critter.mesh.position.x;
      const dz = this.heroLocalPos.z - critter.mesh.position.z;
      const dCritter = Math.hypot(dx, dz);
      if (dCritter < 1.25 * heroScale) {
        if (heroScale >= critter.scale * 0.9) {
          AudioService.playChomp();
          this.sporeMass += 18 * growthMult;
          this.sporeDnaEarned += 5;
          this.awardProgress(5, 'spore', Math.round(this.sporeMass));
          this.registerArcadeCombo('Spore Chomp!');
          this.callbacks.onBountyEvent?.('spore_chomp', 1);
          this.callbacks.onModeNotification?.('Chomped Spore Critter! +18 Mass & +5 DNA!');
          const ang = this.proceduralPrng() * Math.PI * 2;
          critter.mesh.position.set(Math.cos(ang) * 26, 0, Math.sin(ang) * 26);
        } else if (this.sporeLargeCritterKnockbackCd <= 0) {
          this.sporeLargeCritterKnockbackCd = 0.9;
          const distSafe = Math.max(0.01, dCritter);
          const nx = dx / distSafe;
          const nz = dz / distSafe;
          const knockScale = (hasShell ? 0.6 : 1.0) * 11.5;
          this.heroVelocity.x += nx * knockScale;
          this.heroVelocity.z += nz * knockScale;
          AudioService.playSplash();
          this.addCameraTrauma(0.28);
          this.callbacks.onModeNotification?.(
            hasShell
              ? 'Apex Predator deflected by Armored Shell!'
              : 'Too small for that predator — eat plankton to grow bigger!'
          );
        }
      }
    }

    this.updateWorldHeroAndCamera(dt, 7.5 + heroScale * 2.2, 11.0 + heroScale * 1.8);
  }

  // --- 3. CAPYTORIO INFINITE FACTORY TICK (CONVEYOR GLIDE, AUTO-COLLECT & 3D INSTANCED SYNC) ---
  private tickCapytorio(dt: number) {
    const zone = ZONE_LOCATIONS.capytorio;
    const prevLx = this.heroLocalPos.x;
    const prevLz = this.heroLocalPos.z;

    const moveSpeed = 10.5 * this.getEffectiveSpeedMultiplier();
    this.applyPlayerMovementAndCamera(dt, moveSpeed, 11.5, 15.5);

    this.syncCapytorioConfigMultipliers();
    this.capytorioEngine.getBeltMomentumAtLocalPos(prevLx, prevLz, _beltVelScratch);

    const hasWings = this.stats.activeMutations.includes('wings');
    const jumpBoost =
      (hasWings ? 1.18 : 1.0) *
      (this.proceduralConfig.player.jumpImpulseMultiplier ?? 1.0);
    const dashVx = this.heroDashActiveTimer > 0 ? this.heroDashDirX * 14.5 : 0;
    const dashVz = this.heroDashActiveTimer > 0 ? this.heroDashDirZ * 14.5 : 0;
    const canJumpCap = this.coyoteGroundedTimer > 0 || this.isGrounded;
    const jumpImpCap = this.isJumping && canJumpCap ? 9.8 * jumpBoost : 0;
    if (jumpImpCap > 0) this.coyoteGroundedTimer = 0;

    const phys = this.physicsBridge.stepContiguousCharacterAndWorld(
      {
        wx: zone.x + prevLx,
        wy: this.heroLocalPos.y,
        wz: zone.z + prevLz,
        vx: 0,
        vy: this.heroVelocity.y,
        vz: 0,
        desiredMoveVx:
          (this.heroLocalPos.x - prevLx) / Math.max(0.001, dt) + dashVx + _beltVelScratch[0],
        desiredMoveVz:
          (this.heroLocalPos.z - prevLz) / Math.max(0.001, dt) + dashVz + _beltVelScratch[1],
        radius: 0.68,
        halfHeight: 0.25,
        jumpImpulseY: jumpImpCap,
        gravityScale: this.proceduralConfig.player.gravityScale ?? 1.0,
        dt,
      },
      0,
      this.hammerWorldScratch
    );

    this.isJumping = false;
    this.isGrounded = phys.grounded;
    this.isSwimmingInPool = phys.inFluid;
    this.coyoteGroundedTimer =
      phys.grounded || phys.inFluid ? 0.14 : Math.max(0, this.coyoteGroundedTimer - dt);
    this.heroLocalPos.set(phys.wx - zone.x, phys.wy, phys.wz - zone.z);
    this.heroVelocity.y = phys.vy;
    if (this.isGroundPounding && (phys.grounded || phys.inFluid)) {
      this.handleGroundPoundImpact(phys.wx, phys.wy, phys.wz, phys.inFluid);
    }

    this.updateWorldHeroAndCamera(dt, 11.5, 15.5);

    // Friendly auto-pickup from adjacent chests, furnaces & assemblers
    const pickedUp = this.capytorioEngine.collectFromNearbyChestsAndOutputs(
      this.heroLocalPos.x,
      this.heroLocalPos.z,
      3.8
    );
    if (pickedUp > 0) {
      AudioService.playCapytorioPickup();
      this.capytorioAutoSaveDirty = true;
    }

    this.capytorioEngine.step(dt, this.capytorioStepCallbacks);
    const activeAltitudeRadius =
      this.getCapytorioCameraMode() === 'oblique'
        ? evaluateCapytorioAltitudePose(this.capytorioObliqueZoomDist).altitudeRadius
        : 26;
    this.ensureCapytorioRenderer().sync(
      this.capytorioEngine,
      zone.x + this.heroLocalPos.x,
      zone.z + this.heroLocalPos.z,
      dt,
      this.worldEnv?.elapsedSeconds ?? performance.now() * 0.001,
      true,
      activeAltitudeRadius
    );

    this.capytorioUiAccum += dt;
    if (this.capytorioUiAccum >= 0.1) {
      this.capytorioUiAccum = 0;
      this.emitCapytorioSnapshot();
      AudioService.updateCapytorioAmbient(
        this.capytorioEngine.machines.size,
        this.capytorioEngine.powerEfficiency,
        this.currentMode === 'capytorio' && !this.seamlessZoomActive && activeAltitudeRadius <= 120
      );
    }

    if (this.capytorioAutoSaveDirty) {
      this.capytorioAutoSaveTimer += dt;
      if (this.capytorioAutoSaveTimer >= 1.5) {
        this.capytorioAutoSaveTimer = 0;
        this.capytorioAutoSaveDirty = false;
        this.callbacks.onCapytorioFactorySaved?.(this.capytorioEngine.serialize());
      }
    }
  }

  // --- 4. NUMBER STAMPEDE TICK (BOUNDED CIRCUIT WITH SIDE RETURN BOARDWALKS) ---
  private tickRunner(dt: number) {
    const zone = ZONE_LOCATIONS.runner;
    const prevLx = this.heroLocalPos.x;
    const prevLz = this.heroLocalPos.z;

    const onBoostTrack =
      Math.abs(this.heroLocalPos.x) <= 4.35 &&
      this.heroLocalPos.z <= 2.5 &&
      this.heroLocalPos.z >= -86.0 &&
      this.moveInput.z <= 0.3;

    if (onBoostTrack) {
      if (this.pointerTargetX !== null) {
        const targetX = THREE.MathUtils.clamp(this.pointerTargetX * 5.6, -6.5, 6.5);
        this.heroLocalPos.x = THREE.MathUtils.lerp(
          this.heroLocalPos.x,
          targetX,
          1 - Math.exp(-15 * dt)
        );
      } else {
        const steerSpeed = 13.5 * this.getEffectiveSpeedMultiplier();
        this.heroLocalPos.x += this.moveInput.x * steerSpeed * dt;
      }

      const speed = this.runnerSpeed * (1 + Math.min(0.45, this.runnerDistance / 1500));
      this.runnerDistance += speed * dt;
      this.heroLocalPos.z -= speed * dt;

      const steerYaw = this.settings.cameraFollowBehind ? -this.moveInput.x * 0.22 : 0;
      this.heroYaw = Math.PI + steerYaw;
      this.heroCapy.rotation.y = this.heroYaw;
      this.animateCapyLegs(this.heroCapy, dt, 18);

      // Bounded circuit turnaround at localZ <= -85.5: refresh math gates & loop cleanly to track head (z = 0)!
      if (this.heroLocalPos.z <= -85.5) {
        this.heroLocalPos.z = 0.0;
        this.refreshRunnerCircuitGates();
      }
    } else {
      // Free 2D walking on the east/west wooden boardwalks & north forecourt back to SW Causeway!
      const walkSpeed = 10.5 * this.getEffectiveSpeedMultiplier();
      this.applyPlayerMovementAndCamera(dt, walkSpeed, 6.2, 10.2);
    }

    const hasWings = this.stats.activeMutations.includes('wings');
    const hasShell = this.stats.activeMutations.includes('shell');
    const jumpBoost =
      (hasWings ? 1.18 : 1.0) *
      (this.proceduralConfig.player.jumpImpulseMultiplier ?? 1.0);
    const runnerDashVx = this.heroDashActiveTimer > 0 ? this.heroDashDirX * 14.5 : 0;
    const runnerDashVz = this.heroDashActiveTimer > 0 ? this.heroDashDirZ * 14.5 : 0;
    const canJumpRunner = this.coyoteGroundedTimer > 0 || this.isGrounded;
    const jumpImpRunner = this.isJumping && canJumpRunner ? 10.0 * jumpBoost : 0;
    if (jumpImpRunner > 0) this.coyoteGroundedTimer = 0;
    const phys = this.physicsBridge.stepContiguousCharacterAndWorld(
      {
        wx: zone.x + prevLx,
        wy: this.heroLocalPos.y,
        wz: zone.z + prevLz,
        vx: 0,
        vy: this.heroVelocity.y,
        vz: 0,
        desiredMoveVx: (this.heroLocalPos.x - prevLx) / Math.max(0.001, dt) + runnerDashVx,
        desiredMoveVz: (this.heroLocalPos.z - prevLz) / Math.max(0.001, dt) + runnerDashVz,
        radius: 0.68,
        halfHeight: 0.25,
        jumpImpulseY: jumpImpRunner,
        gravityScale: this.proceduralConfig.player.gravityScale ?? 1.0,
        dt,
      },
      0,
      this.hammerWorldScratch
    );
    this.isJumping = false;
    this.isGrounded = phys.grounded;
    this.isSwimmingInPool = phys.inFluid;
    this.coyoteGroundedTimer =
      phys.grounded || phys.inFluid ? 0.14 : Math.max(0, this.coyoteGroundedTimer - dt);
    this.heroLocalPos.set(phys.wx - zone.x, phys.wy, phys.wz - zone.z);
    this.heroVelocity.y = phys.vy;
    if (this.isGroundPounding && (phys.grounded || phys.inFluid)) {
      this.handleGroundPoundImpact(phys.wx, phys.wy, phys.wz, phys.inFluid);
    }

    // Update visible 3D Herd followers in formation around the hero
    for (let i = 0; i < this.runnerHerdMeshes.length; i++) {
      const mini = this.runnerHerdMeshes[i];
      if (!mini.visible) continue;
      const ring = Math.floor(i / 6) + 1;
      const angle = ((i % 6) / 6) * Math.PI * 2 + this.runnerDistance * 0.05;
      const offsetX = Math.cos(angle) * (0.75 * ring);
      const offsetZ = Math.sin(angle) * (0.65 * ring) + 0.9 * ring;
      mini.position.set(
        THREE.MathUtils.clamp(this.heroLocalPos.x + offsetX, -7.2, 7.2),
        this.heroLocalPos.y,
        this.heroLocalPos.z + offsetZ
      );
      this.animateCapyLegs(mini, dt, 18);
    }

    const wx = zone.x + this.heroLocalPos.x;
    const wz = zone.z + this.heroLocalPos.z;
    this.heroCapy.position.set(wx, this.heroLocalPos.y, wz);

    if (onBoostTrack) {
      const distScale = this.settings.cameraDistance || 1.0;
      const camX = this.settings.cameraFollowBehind ? wx : zone.x + this.heroLocalPos.x * 0.45;
      this.camera.position.set(camX, 5.4 * distScale, wz + 9.8 * distScale);
      this.camera.lookAt(camX, 1.2, wz - 14);
    } else {
      this.updateWorldHeroAndCamera(dt, 6.2, 10.2);
    }

    // Gate collisions
    const rCfg = this.proceduralConfig.districts.runner;
    for (let i = 0; i < this.runnerGates.length; i++) {
      const gate = this.runnerGates[i];
      if (
        !gate.triggered &&
        Math.abs(gate.z - this.heroLocalPos.z) < 1.45 &&
        Math.abs(gate.mesh.position.x - this.heroLocalPos.x) < 1.95
      ) {
        gate.triggered = true;
        gate.mesh.visible = false;
        if (gate.type === 'multiply') {
          this.runnerCapyCount = Math.min(999, this.runnerCapyCount * gate.value);
          AudioService.playPrestigeFanfare();
        } else if (gate.type === 'add') {
          this.runnerCapyCount = Math.min(999, this.runnerCapyCount + gate.value);
          AudioService.playCoin();
        } else {
          const rawPenalty =
            gate.value *
            (hasShell ? 0.5 : 1.0) *
            rCfg.negativeGatePenaltyScale;
          const penalty = Math.max(1, Math.round(rawPenalty));
          this.runnerCapyCount = Math.max(1, this.runnerCapyCount - penalty);
          AudioService.playSplash();
        }
        this.syncRunnerHerdVisuals();

        this.awardProgress(
          gate.type === 'multiply' ? 1 : 0,
          'runner',
          this.runnerCapyCount * 10 + Math.round(this.runnerDistance)
        );
        if (gate.type === 'add' || gate.type === 'multiply') {
          this.registerArcadeCombo(gate.type === 'multiply' ? 'Herd Multiply!' : 'Gate Boost');
          this.callbacks.onBountyEvent?.('runner_gates', 1);
        }
        this.callbacks.onModeNotification?.(
          `Stampede Herd: ${this.runnerCapyCount} Capybaras!`
        );
      }
    }
  }

  private refreshRunnerCircuitGates() {
    const maxMult = Math.max(2, Math.min(6, Math.round(this.proceduralConfig.districts.runner.maxGateMultiplier)));
    for (let i = 0; i < this.runnerGates.length; i++) {
      const g = this.runnerGates[i];
      const pairIdx = Math.floor(i / 2);
      const isLeft = i % 2 === 0;
      const roll = this.proceduralPrng();
      let type: 'add' | 'multiply' | 'sub' = 'add';
      let value = 2 + Math.floor(this.proceduralPrng() * 5);
      let label = `+${value}`;
      let sub = 'ADD CAPYS';
      let bg = '#1e3a8a';
      let accent = '#60a5fa';

      if (roll > 0.72) {
        type = 'multiply';
        value = 2 + (Math.floor(this.proceduralPrng() * Math.max(1, maxMult - 1)));
        label = `×${value}`;
        sub = 'MULTIPLY HERD';
        bg = '#065f46';
        accent = '#34d399';
      } else if (!isLeft && roll < 0.34 && pairIdx > 0) {
        type = 'sub';
        value = 2 + Math.floor(this.proceduralPrng() * 4);
        label = `-${value}`;
        sub = 'AVOID LOSS';
        bg = '#7f1d1d';
        accent = '#f87171';
      }

      g.type = type;
      g.value = value;
      g.triggered = false;
      g.mesh.visible = true;
      g.panelMat.map = this.getCachedRunnerBannerTexture(label, sub, bg, accent);
      g.panelMat.needsUpdate = true;
    }
  }

  // --- 5. YUZU MOUNTAIN PARKOUR TICK (RIGID HAMMER IMPULSES, TORQUE SEE-SAWS & XPBD LAUNCH PAD) ---
  private tickFallGuys(dt: number) {
    const zone = ZONE_LOCATIONS.fallguys;
    const prevLx = this.heroLocalPos.x;
    const prevLz = this.heroLocalPos.z;
    const hasWings = this.stats.activeMutations.includes('wings');
    const hasShell = this.stats.activeMutations.includes('shell');
    const jumpBoost =
      (hasWings ? 1.18 : 1.0) *
      (this.proceduralConfig.player.jumpImpulseMultiplier ?? 1.0);

    const speed = 9.8 * this.getEffectiveSpeedMultiplier();
    this.applyPlayerMovementAndCamera(dt, speed, 6.2, 10.2);

    let jumpImpulseY = 0;
    const canJumpFallGuys = this.coyoteGroundedTimer > 0 || this.isGrounded;
    if (this.isJumping && canJumpFallGuys) {
      jumpImpulseY = (11.5 + (this.stats.upgrades.bounciness - 1) * 1.0) * jumpBoost;
      this.isGrounded = false;
      this.coyoteGroundedTimer = 0;
      this.isJumping = false;
      AudioService.playJump();
    } else if (this.isJumping) {
      this.isJumping = false;
    }

    const phys = this.physicsBridge.stepContiguousCharacterAndWorld(
      {
        wx: zone.x + prevLx,
        wy: this.heroLocalPos.y,
        wz: zone.z + prevLz,
        vx: this.heroVelocity.x,
        vy: this.heroVelocity.y,
        vz: this.heroVelocity.z,
        desiredMoveVx: (this.heroLocalPos.x - prevLx) / Math.max(0.001, dt),
        desiredMoveVz: (this.heroLocalPos.z - prevLz) / Math.max(0.001, dt),
        radius: 0.68,
        halfHeight: 0.25,
        jumpImpulseY,
        gravityScale: this.proceduralConfig.player.gravityScale ?? 1.0,
        dt,
      },
      0,
      this.hammerWorldScratch
    );

    this.heroLocalPos.set(phys.wx - zone.x, phys.wy, phys.wz - zone.z);
    this.heroVelocity.set(phys.vx, phys.vy, phys.vz);
    if (phys.hammerImpulseY > 0 && hasShell) {
      this.heroVelocity.x *= 0.6;
      this.heroVelocity.y *= 0.65;
      this.heroVelocity.z *= 0.6;
    }
    this.isGrounded = phys.grounded;
    this.isSwimmingInPool = phys.inFluid;
    this.coyoteGroundedTimer =
      phys.grounded || phys.inFluid ? 0.14 : Math.max(0, this.coyoteGroundedTimer - dt);

    if (this.isGroundPounding && (phys.grounded || phys.inFluid)) {
      this.handleGroundPoundImpact(phys.wx, phys.wy, phys.wz, phys.inFluid);
    }

    if (phys.trampolineBoostY > 0) {
      this.isGroundPounding = false;
      this.coyoteGroundedTimer = 0;
      AudioService.playTrampolineLaunch();
      this.addCameraTrauma(0.46);
      NativeBridge.haptic('success');
      this.vfxEngine?.emitBurst(
        this.heroCapy.position.x,
        Math.max(0.2, this.heroCapy.position.y),
        this.heroCapy.position.z,
        'xpbd_launch',
        12
      );
    } else if (phys.hammerImpulseY > 0) {
      AudioService.playJump();
      this.addCameraTrauma(0.38);
      NativeBridge.haptic('warning');
      this.vfxEngine?.emitBurst(
        this.heroCapy.position.x,
        this.heroCapy.position.y + 0.3,
        this.heroCapy.position.z,
        'citrus_burst',
        8,
        0xef4444
      );
    }

    // Apply exact torque-coupled See-Saw tilt angle to visual plank mesh
    const seeSawTilt = this.physicsBridge.getSeeSawTiltAngle();
    for (let i = 0; i < this.seeSaws.length; i++) {
      this.seeSaws[i].mesh.rotation.z = seeSawTilt;
    }

    // AI Rival Bean-Capys racing forward
    for (let i = 0; i < this.fallGuysRivals.length; i++) {
      const rival = this.fallGuysRivals[i];
      if (!rival.capy.visible) continue;
      rival.capy.position.z -= rival.speed * dt;
      rival.capy.position.x =
        rival.laneOffset + Math.sin(rival.capy.position.z * 0.35) * 1.1;
      this.animateCapyLegs(rival.capy, dt, 14);
      if (rival.capy.position.z < -60) {
        rival.capy.position.z = 0;
      }
    }

    // Deterministic Input & Transform Ghost Racing on Yuzu Mountain
    if (!this.yuzuGhostRunActive && this.heroLocalPos.z <= -1.0 && this.heroLocalPos.z > -55.0) {
      this.yuzuGhostRunActive = true;
      this.yuzuGhostRunElapsedSec = 0;
      this.yuzuGhostRecorder.startRun();
    } else if (this.yuzuGhostRunActive && this.heroLocalPos.z > 2.5) {
      this.yuzuGhostRunActive = false;
      this.yuzuGhostRunElapsedSec = 0;
      this.yuzuGhostRecorder.stopRun();
      this.syncGhostToStartPose();
    }

    if (this.yuzuGhostRunActive) {
      this.yuzuGhostRunElapsedSec += dt;
      const planarVel = Math.hypot(this.heroVelocity.x, this.heroVelocity.z);
      this.yuzuGhostRecorder.recordTick(
        this.yuzuGhostRunElapsedSec,
        this.heroLocalPos.x,
        this.heroLocalPos.y,
        this.heroLocalPos.z,
        this.heroYaw,
        this.moveInput.x,
        this.moveInput.z,
        this.isGrounded,
        planarVel > 0.4,
        !this.isGrounded
      );

      if (
        this.yuzuBestGhostRun &&
        this.fallGuysGhostCapy &&
        sampleGhostRunAtTime(
          this.yuzuBestGhostRun,
          this.yuzuGhostRunElapsedSec,
          this.yuzuGhostPoseScratch
        )
      ) {
        this.fallGuysGhostCapy.visible = true;
        this.fallGuysGhostCapy.position.set(
          this.yuzuGhostPoseScratch.x,
          this.yuzuGhostPoseScratch.y,
          this.yuzuGhostPoseScratch.z
        );
        this.fallGuysGhostCapy.rotation.set(0, this.yuzuGhostPoseScratch.yaw, 0);
        if (this.yuzuGhostPoseScratch.moving && !this.yuzuGhostPoseScratch.finished) {
          this.animateCapyLegs(this.fallGuysGhostCapy, dt, 14);
        } else {
          this.resetCapyLegs(this.fallGuysGhostCapy, dt);
        }
      }
    }

    // Check Golden Crown Finish Line at Z <= -57 & |X| <= 4.5
    if (this.heroLocalPos.z <= -57 && Math.abs(this.heroLocalPos.x) <= 4.5) {
      let ghostFinishNote = '';
      if (this.yuzuGhostRunActive) {
        const finishedRun = this.yuzuGhostRecorder.finalizeRun(
          this.yuzuGhostRunElapsedSec * 1000,
          this.heroLocalPos.x,
          this.heroLocalPos.y,
          this.heroLocalPos.z,
          this.heroYaw
        );
        if (finishedRun) {
          const savedRes = saveBestYuzuGhostRunIfFaster(finishedRun);
          this.yuzuBestGhostRun = savedRes.bestRun;
          const runSec = (finishedRun.durationMs / 1000).toFixed(2);
          const pbSec = (savedRes.bestRun.durationMs / 1000).toFixed(2);
          ghostFinishNote = savedRes.saved
            ? ` in ${runSec}s (NEW GHOST PB!)`
            : ` in ${runSec}s (Ghost PB: ${pbSec}s)`;
        }
      }

      this.fallGuysCrowns++;
      this.fallGuysRound++;
      AudioService.playPrestigeFanfare();
      const crownDna = Math.max(
        1,
        Math.round(this.proceduralConfig.districts.fallguys.crownCoinReward / 4)
      );
      this.awardProgress(crownDna, 'fallguys', this.fallGuysCrowns);
      this.registerArcadeCombo('Golden Crown!', 0);
      this.callbacks.onBountyEvent?.('fallguys_crown', 1);
      this.callbacks.onModeNotification?.(
        `GOLDEN CROWN #${this.fallGuysCrowns} CLAIMED${ghostFinishNote}! Advancing to Round ${this.fallGuysRound}!`
      );
      this.heroLocalPos.set(0, 1.0, 0);
      this.heroYaw = Math.PI;
      this.resetFallGuysGame(false);
    }

    this.updateWorldHeroAndCamera(dt, 6.2, 10.2);
  }

  // ============================================================================
  // SEAMLESS 63-ORDERS-OF-MAGNITUDE UNIVERSE ZOOM (+28 BIG BANG TO -35 PHOTON)
  // ============================================================================

  private tickSeamlessUniverse(dt: number) {
    // Smoothly damp cruiseVelocity toward targetCruiseVelocity with gentle aerospace momentum
    this.cruiseVelocityLogPerSec = THREE.MathUtils.damp(
      this.cruiseVelocityLogPerSec,
      this.targetCruiseVelocityLogPerSec,
      3.2,
      dt
    );

    const prevLogVal = this.currentLogScaleMeters;
    const activeVelocity = this.cruiseVelocityLogPerSec;
    if (Math.abs(activeVelocity) > 0.02) {
      const nextLog = prevLogVal + activeVelocity * dt;
      const crossedForestFromCosmos =
        activeVelocity < 0 &&
        prevLogVal >= CAPYBARA_FOREST_LOG_METERS - 0.05 &&
        nextLog <= CAPYBARA_FOREST_LOG_METERS;
      const crossedForestFromQuantum =
        activeVelocity > 0 &&
        prevLogVal <= CAPYBARA_FOREST_LOG_METERS + 0.05 &&
        nextLog >= CAPYBARA_FOREST_LOG_METERS;

      if (
        this.lastLaunchSourceMode === 'capytorio' &&
        !this.autoLandAtForestPending &&
        activeVelocity < -0.02 &&
        prevLogVal >= CAPYTORIO_ORBIT_HANDOFF_LOG_METERS - 0.12 &&
        nextLog < CAPYTORIO_ORBIT_HANDOFF_LOG_METERS
      ) {
        this.autoZoomDirection = 0;
        this.cruiseVelocityLogPerSec = 0;
        this.targetCruiseVelocityLogPerSec = 0;
        this.lastLaunchSourceMode = 'sanctuary';
        this.capytorioObliqueZoomDist = CAPYTORIO_ORBIT_HANDOFF_DIST * 0.85;
        this.settings.capytorioCameraMode = 'oblique';
        this.resumeSurfacePlayFromForest(true);
        this.switchMode('capytorio', true);
        this.snapCameraToCurrentZone();
        return;
      } else if (this.autoLandAtForestPending && (crossedForestFromCosmos || crossedForestFromQuantum)) {
        this.currentLogScaleMeters = CAPYBARA_FOREST_LOG_METERS;
        this.targetLogScaleMeters = CAPYBARA_FOREST_LOG_METERS;
        this.targetCruiseVelocityLogPerSec = 0;
        this.cruiseVelocityLogPerSec = 0;
      } else if (nextLog >= MAX_UNIVERSE_LOG_METERS) {
        this.currentLogScaleMeters = MAX_UNIVERSE_LOG_METERS;
        this.targetLogScaleMeters = MAX_UNIVERSE_LOG_METERS;
        this.targetCruiseVelocityLogPerSec = 0;
        this.cruiseVelocityLogPerSec = 0;
        this.autoZoomDirection = 0;
      } else if (nextLog <= MIN_UNIVERSE_LOG_METERS) {
        this.currentLogScaleMeters = MIN_UNIVERSE_LOG_METERS;
        this.targetLogScaleMeters = MIN_UNIVERSE_LOG_METERS;
        this.targetCruiseVelocityLogPerSec = 0;
        this.cruiseVelocityLogPerSec = 0;
        this.autoZoomDirection = 0;
      } else {
        this.currentLogScaleMeters = nextLog;
        this.targetLogScaleMeters = nextLog;
      }
    } else {
      if (this.autoZoomDirection === 0 && Math.abs(this.targetCruiseVelocityLogPerSec) < 0.03) {
        this.cruiseVelocityLogPerSec = 0;
      }
      // Fly steadily through intervening space toward any chosen zoom target without snapping
      this.currentLogScaleMeters = stepSteadyLogScaleTowardTarget(
        prevLogVal,
        this.targetLogScaleMeters,
        dt
      );
    }

    const logVal = this.currentLogScaleMeters;
    const approachDamping = computeDescentApproachDampingFactor((prevLogVal + logVal) * 0.5);
    let spiralAngle = 0;
    let spiralAngularVel = 0;
    if (this.flightTrajectory === 'spiral') {
      const prevSpiral = computeSpiralOrbitAngleRadians(prevLogVal, this.spiralBandLogs);
      spiralAngle = computeSpiralOrbitAngleRadians(logVal, this.spiralBandLogs);
      const deltaSpiralYaw = (spiralAngle - prevSpiral) * approachDamping;
      this.cosmicOrbitYaw += deltaSpiralYaw;
      spiralAngularVel = dt > 0.0005 ? deltaSpiralYaw / dt : 0;
    }

    // Reset orbital descent rings when flying high out past stratosphere so next descent replays cleanly
    if (logVal > 5.3 && this.descentRingsHitCount > 0) {
      this.resetDescentRings();
    }

    // Auto-touchdown onto Sanctuary Chrono-Pad or Capytorio Frontier once vessel settles into Capybara Forest window
    if (
      this.autoLandAtForestPending &&
      Math.abs(logVal - CAPYBARA_FOREST_LOG_METERS) <= 0.16 &&
      Math.abs(this.targetLogScaleMeters - CAPYBARA_FOREST_LOG_METERS) <= 0.16
    ) {
      const targetMode = this.autoLandTargetMode;
      this.autoLandAtForestPending = false;
      this.autoLandTargetMode = 'sanctuary';
      if (targetMode === 'capytorio') {
        this.settings.capytorioCameraMode = 'oblique';
        this.resumeSurfacePlayFromForest(true);
        this.switchMode('capytorio', true);
        this.callbacks.onModeNotification?.(
          'Landed at Capytorio Frontier! Harvest citrus trees & ore [E] or craft & place belts [I]!'
        );
      } else {
        this.resumeSurfacePlayFromForest(false);
        this.switchMode('sanctuary', true);
        this.heroLocalPos.set(CHRONO_PAD_X, 0.3, CHRONO_PAD_Z);
        this.heroCapy.position.set(CHRONO_PAD_X, 0.3, CHRONO_PAD_Z);
        this.resetDachshundTrail();
        this.updateDachshundTransforms(0);
        this.callbacks.onModeNotification?.(
          'Chrono-Vessel docked on Sanctuary Chrono-Pad! Explore the 5 districts or launch back to cosmos anytime.'
        );
      }
      return;
    }

    // Keep Chrono-Pad / Capytorio hero alignment converged before touchdown so focal target slides onto target cleanly
    if (this.autoLandAtForestPending && logVal <= 2.5) {
      if (this.autoLandTargetMode === 'capytorio') {
        this.currentMode = 'capytorio';
        this.heroLocalPos.set(0, 0, 3.0);
        this.heroCapy.position.set(CAPYTORIO_WORLD_ORIGIN_X, 0, CAPYTORIO_WORLD_ORIGIN_Z + 3.0);
      } else {
        this.currentMode = 'sanctuary';
        this.heroLocalPos.set(CHRONO_PAD_X, 0.3, CHRONO_PAD_Z);
        this.heroCapy.position.set(CHRONO_PAD_X, 0.3, CHRONO_PAD_Z);
      }
    }

    // Only build & display playable Capybara Forest / archipelago surface worlds once the user explicitly chooses "Play in Forest" or "Play Capytorio".
    if (this.autoLandAtForestPending && !this.surfaceWorldsBuilt) {
      this.ensureSurfaceWorldsBuilt();
    }

    const orbBlend = computeOrbitalSurfaceBlend(logVal, this.isSoftwareGl);
    const showPlayableSurface = this.autoLandAtForestPending && orbBlend.inSurfaceWindow;
    const inTerrestrialZoom = logVal >= -2.5 && logVal <= 4.7;

    this.cosmicBuilder.setSuspended(true);
    this.cosmicBuilder.rootGroup.visible = false;
    this.cosmicBuilder.rootGroup.matrixWorldAutoUpdate = false;
    this.worldBaseGroup.visible = showPlayableSurface;
    this.worldBaseGroup.matrixWorldAutoUpdate = showPlayableSurface;
    this.sanctuaryGroup.visible = showPlayableSurface;
    this.sanctuaryGroup.matrixWorldAutoUpdate = showPlayableSurface;
    this.seamlessUniverse.forestGroveGroup.visible = showPlayableSurface;
    this.seamlessUniverse.forestGroveGroup.matrixWorldAutoUpdate = showPlayableSurface;

    // Only reveal outer archipelago mini-game islands during explicit surface landing descent
    const archVisible = this.autoLandAtForestPending && orbBlend.archipelagoVisible;
    this.sporeGroup.visible = archVisible;
    this.sporeGroup.matrixWorldAutoUpdate = archVisible;
    this.capytorioGroup.visible = archVisible;
    this.capytorioGroup.matrixWorldAutoUpdate = archVisible;
    this.runnerGroup.visible = archVisible;
    this.runnerGroup.matrixWorldAutoUpdate = archVisible;
    this.fallGuysGroup.visible = archVisible;
    this.fallGuysGroup.matrixWorldAutoUpdate = archVisible;

    this.selectableCapyGroup.visible = false;
    this.selectableCapyGroup.matrixWorldAutoUpdate = false;
    this.heroCapy.visible = showPlayableSurface;
    this.heroCapy.matrixWorldAutoUpdate = showPlayableSurface;
    if (this.vfxEngine) {
      this.vfxEngine.rootGroup.visible = showPlayableSurface;
      this.vfxEngine.rootGroup.matrixWorldAutoUpdate = showPlayableSurface;
      if (!showPlayableSurface) {
        this.vfxEngine.godRayGroup.visible = false;
      }
    }
    if (this.dachshundGroup) {
      const showDachshund = showPlayableSurface && this.currentMode === 'sanctuary';
      this.dachshundGroup.visible = showDachshund;
      this.dachshundGroup.matrixWorldAutoUpdate = showDachshund;
    }
    this.scene.fog = null;

    // Fade atmospheric sky dome continuously during explicit landing plunge
    this.setSkyDomeAlpha(showPlayableSurface ? smoothstep01(0.16, 0.86, orbBlend.terrestrialBlend) : 0.0);

    if (this.worldEnv) {
      const tb = orbBlend.terrestrialBlend;
      if (!showPlayableSurface || tb <= 0.005) {
        // Smoothly transition between deep-space key/fill rig and warm woodland daylight across Clouds -> Valley -> Glade -> Leaf
        const gladeDaylight =
          smoothstep01(4.9, 3.2, logVal) * smoothstep01(-3.4, -2.2, logVal);
        this.worldEnv.ambientLight.intensity = THREE.MathUtils.lerp(0.08, 0.24, gladeDaylight);
        _colorHelper.setHex(0x60a5fa).lerp(_colorHelper2.setHex(0xbae6fd), gladeDaylight);
        this.worldEnv.hemiLight.color.copy(_colorHelper);
        _colorHelper.setHex(0x0f172a).lerp(_colorHelper2.setHex(0x1e4620), gladeDaylight);
        this.worldEnv.hemiLight.groundColor.copy(_colorHelper);
        this.worldEnv.hemiLight.intensity = THREE.MathUtils.lerp(0.24, 0.72, gladeDaylight);
        this.worldEnv.sunLight.color.setHex(0xfffaf0);
        this.worldEnv.sunLight.intensity = THREE.MathUtils.lerp(2.45, 1.78, gladeDaylight);
        if (gladeDaylight > 0.05) {
          const sunDir = this.seamlessUniverse.getSharedSunDir();
          this.worldEnv.sunLight.position.set(
            THREE.MathUtils.lerp(sunDir.x * 90, 32, gladeDaylight),
            THREE.MathUtils.lerp(sunDir.y * 90, 62, gladeDaylight),
            THREE.MathUtils.lerp(sunDir.z * 90, 28, gladeDaylight)
          );
        } else if (logVal >= 3.5 && logVal <= 14.5) {
          const sunDir = this.seamlessUniverse.getSharedSunDir();
          this.worldEnv.sunLight.position.set(sunDir.x * 90, sunDir.y * 90, sunDir.z * 90);
        }
        this.worldEnv.moonLight.intensity = 0.0;
        if (this.homePool) this.homePool.lanternLight.intensity = 0.0;
        if (this.chronoPad) this.chronoPad.beaconLight.intensity = 0.0;
        this.renderer.toneMappingExposure = this.settings.gpuExposure ?? 1.02;
      } else if (tb < 0.995) {
        // Continuous crossfade between space lighting rig and live terrestrial atmosphere
        this.worldEnv.ambientLight.intensity = THREE.MathUtils.lerp(
          0.08,
          this.worldEnv.lastAmbientIntensity,
          tb
        );
        _colorHelper.setHex(0x60a5fa).lerp(this.worldEnv.hemiLight.color, tb);
        this.worldEnv.hemiLight.color.copy(_colorHelper);
        _colorHelper.setHex(0x0f172a).lerp(this.worldEnv.hemiLight.groundColor, tb);
        this.worldEnv.hemiLight.groundColor.copy(_colorHelper);
        this.worldEnv.hemiLight.intensity = THREE.MathUtils.lerp(
          0.24,
          this.worldEnv.lastHemiIntensity,
          tb
        );
        _colorHelper.setHex(0xfffaf0).lerp(this.worldEnv.sunLight.color, tb);
        this.worldEnv.sunLight.color.copy(_colorHelper);
        this.worldEnv.sunLight.intensity = THREE.MathUtils.lerp(
          2.45,
          this.worldEnv.lastSunIntensity,
          tb
        );
        this.worldEnv.moonLight.intensity = THREE.MathUtils.lerp(
          0.0,
          this.worldEnv.lastMoonIntensity,
          tb
        );
        this.renderer.toneMappingExposure = THREE.MathUtils.lerp(
          this.settings.gpuExposure ?? 1.02,
          this.worldEnv.lastExposure,
          tb
        );
      }
    }

    // Keep sanctuary companion Capybaras gently alive during explicit landing descent
    if (showPlayableSurface) {
      for (let i = 0; i < this.sanctuaryCapys.length; i++) {
        const buddy = this.sanctuaryCapys[i];
        if (!buddy.capy.visible) continue;
        buddy.stateTimer -= dt;
        if (buddy.stateTimer <= 0) {
          buddy.stateTimer = 4 + this.proceduralPrng() * 5;
          const rad = 6.5 + this.proceduralPrng() * 19.5;
          const ang = this.proceduralPrng() * Math.PI * 2;
          buddy.target.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
        }
        _tempVec3.subVectors(buddy.target, buddy.capy.position);
        if (_tempVec3.length() > 0.35) {
          _tempVec3.normalize();
          buddy.capy.position.addScaledVector(_tempVec3, 1.85 * dt);
          buddy.capy.rotation.y = Math.atan2(_tempVec3.x, _tempVec3.z);
          this.animateCapyLegs(buddy.capy, dt, 6.5, 1);
        } else {
          this.resetCapyLegs(buddy.capy, dt);
        }
      }
    }

    // Free orbital camera steering with mouselook / drag / WASD across every cosmic & quantum scale.
    // Smoothly keep camera pitch above the terrestrial ground plane from Clouds through Glade · Leaf.
    const horizonMinPitch =
      showPlayableSurface || inTerrestrialZoom
        ? 0.14
        : THREE.MathUtils.lerp(-0.68, 0.14, THREE.MathUtils.smoothstep(logVal, 5.8, 4.7));
    const idleLookMs = performance.now() - this.mouselookLastActiveTimeMs;
    const isBasicComfortMode = !this.settings.advancedMode;
    const idleSpaceDrift =
      !isBasicComfortMode && !this.mouselookLocked && idleLookMs > 3200
        ? 0.04 * approachDamping
        : 0;
    this.cosmicOrbitYaw += (idleSpaceDrift - this.moveInput.x * 1.45) * dt;
    this.cosmicOrbitPitch = THREE.MathUtils.clamp(
      this.cosmicOrbitPitch + this.moveInput.z * 0.95 * dt,
      horizonMinPitch,
      1.18
    );

    // Smooth yaw orientation stabilization during final orbital plunge so camera never stays tilted sideways
    if (
      (isBasicComfortMode || (logVal <= 2.4 && approachDamping < 0.35)) &&
      !this.mouselookLocked &&
      idleLookMs > 900
    ) {
      if (Math.abs(this.moveInput.z) < 0.05) {
        const comfortPitchTarget =
          showPlayableSurface || inTerrestrialZoom
            ? 0.34
            : logVal >= 6.0 && logVal <= 14.5
              ? 0.32
              : 0.28;
        this.cosmicOrbitPitch = THREE.MathUtils.damp(
          this.cosmicOrbitPitch,
          Math.max(horizonMinPitch, comfortPitchTarget),
          2.2,
          dt
        );
      }
      if (
        (this.flightTrajectory !== 'spiral' || approachDamping < 0.35) &&
        Math.abs(this.moveInput.x) < 0.05 &&
        logVal >= 0.4 &&
        logVal <= 14.8
      ) {
        const signedYaw = normalizeAngleSigned(this.cosmicOrbitYaw);
        const guideYaw = logVal <= 3.2 ? 0.15 : 0.06;
        const dampedYaw = THREE.MathUtils.damp(signedYaw, guideYaw, 1.8, dt);
        this.cosmicOrbitYaw = dampedYaw;
      }
    }

    // Auto-discover active Forest Glade specimen when visiting Leaf & Fur scale
    if (logVal >= -2.6 && logVal <= -0.95) {
      this.notifyForestSpecimenDiscovered();
    }

    // Compute projective-invariant camera radius & smooth multi-sector focal anchor
    const canonicalRadius = 38.0;
    const chaseBaseDist = 11.4 * (this.settings.cameraDistance || 1.0);
    const camRadius = showPlayableSurface
      ? computeContinuousDescentCamRadius(logVal, chaseBaseDist)
      : canonicalRadius;

    if (showPlayableSurface) {
      const lowBlend = THREE.MathUtils.smoothstep(logVal, -0.85, -0.22);
      const highBlend = 1 - THREE.MathUtils.smoothstep(logVal, 1.85, 3.35);
      const anchorWeight = lowBlend * highBlend;
      _seamlessFocalPos.set(
        this.heroCapy.position.x * anchorWeight,
        (this.heroCapy.position.y + 0.96) * anchorWeight,
        (this.heroCapy.position.z + 0.2) * anchorWeight
      );
      const forestFar = computeEffectiveCameraFar(
        this.settings.drawDistance ?? 650,
        this.settings.gpuQualityPreset ?? 'high',
        true,
        logVal
      ).cameraFar;
      if (this.camera.near !== 0.04 || Math.abs(this.camera.far - forestFar) > 0.5) {
        this.camera.near = 0.04;
        this.camera.far = forestFar;
        this.camera.updateProjectionMatrix();
      }
    } else {
      _seamlessFocalPos.set(0, 0, 0);
      const desiredNear = logVal > 14 ? 0.25 : 0.08;
      const cosmicFar = computeEffectiveCameraFar(
        this.settings.drawDistance ?? 650,
        this.settings.gpuQualityPreset ?? 'high',
        false,
        logVal
      ).cameraFar;
      if (this.camera.near !== desiredNear || Math.abs(this.camera.far - cosmicFar) > 0.5) {
        this.camera.near = desiredNear;
        this.camera.far = cosmicFar;
        this.camera.updateProjectionMatrix();
      }
    }

    const effectiveGamma = this.isRealityRescalerUnlocked()
      ? (this.settings.realityScaleGamma ?? 1.0)
      : 1.0;
    const effectiveMarkers = Boolean(
      this.settings.showObjectMarkers && this.isObjectMarkersUnlocked()
    );
    const paletteMode: AstrophysicsPaletteMode =
      this.settings.astrophysicsPalette ?? 'natural';

    this.seamlessUniverse.updateForLogScale(
      logVal,
      dt,
      this.quantumFocusMode,
      _seamlessFocalPos,
      _seamlessSkyColor,
      effectiveGamma,
      effectiveMarkers,
      paletteMode,
      this.autoLandAtForestPending
    );
    this.seamlessUniverse.rootGroup.scale.setScalar(camRadius / canonicalRadius);

    // Blend background sky color cleanly across cosmic stratosphere -> daylight/night horizon during landing
    if (showPlayableSurface && orbBlend.terrestrialBlend > 0.005) {
      if (this.worldEnv) {
        _colorHelper.copy(this.worldEnv.currentHorizonSkyColor);
      } else {
        _colorHelper.setHex(this.activeBiome?.skyHex ?? 0x38bdf8);
      }
      _seamlessSkyColor.lerp(_colorHelper, orbBlend.terrestrialBlend);
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(_seamlessSkyColor);
    } else {
      this.scene.background = _seamlessSkyColor.clone();
    }

    const spiralPitchMod =
      this.flightTrajectory === 'spiral' ? Math.sin(spiralAngle) * 0.085 * approachDamping : 0;
    const spiralRadiusScale =
      this.flightTrajectory === 'spiral'
        ? 1.0 + Math.sin(spiralAngle * 2.0) * 0.07 * approachDamping
        : 1.0;
    const effectiveOrbitPitch = THREE.MathUtils.clamp(
      this.cosmicOrbitPitch + spiralPitchMod,
      horizonMinPitch,
      1.22
    );
    const effectiveCamRadius = camRadius * spiralRadiusScale;

    _camTarget.set(
      _seamlessFocalPos.x +
        Math.sin(this.cosmicOrbitYaw) * Math.cos(effectiveOrbitPitch) * effectiveCamRadius,
      _seamlessFocalPos.y + Math.sin(effectiveOrbitPitch) * effectiveCamRadius,
      _seamlessFocalPos.z +
        Math.cos(this.cosmicOrbitYaw) * Math.cos(effectiveOrbitPitch) * effectiveCamRadius
    );
    this.camera.position.copy(_camTarget);
    this.camera.lookAt(_seamlessFocalPos);

    // Anchor Future Capybara Chrono-Vessel with seamless HUD -> True 1:1 Meter World Scale convergence!
    if (this.chronoVessel) {
      if (this.vesselMode === 'landed') {
        this.chronoVessel.root.visible = false;
        this.chronoVessel.root.matrixWorldAutoUpdate = false;
      } else {
        this.chronoVessel.root.matrixWorldAutoUpdate = true;
        this.camera.updateMatrixWorld();
        _camForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
        _camUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
        _camRight.crossVectors(_camForward, _camUp).normalize();
        const vt = computeVesselOneToOneTransform(
          showPlayableSurface ? logVal : Math.max(logVal, 3.5),
          this.vesselMode,
          this.camera.position.x,
          this.camera.position.y,
          this.camera.position.z,
          _camForward.x,
          _camForward.y,
          _camForward.z,
          _camUp.x,
          _camUp.y,
          _camUp.z,
          this.heroCapy.position.x,
          this.heroCapy.position.y,
          this.heroCapy.position.z
        );
        this.chronoVessel.root.position.set(vt.worldX, vt.worldY, vt.worldZ);
        this.chronoVessel.root.scale.setScalar(vt.uniformScale);

        const scaleVel =
          this.autoZoomDirection !== 0
            ? this.autoZoomDirection * Math.abs(this.cruiseVelocityLogPerSec)
            : (this.targetLogScaleMeters - this.currentLogScaleMeters) * 4.0;

        // Autopilot banking & nose lead when navigating off-center into Earth's Milky Way Orion-Cygnus Spur
        // or sweeping along the 360-degree-per-band curved spiral trajectory!
        let navSteerX = 0;
        let navPitchZ = 0;
        if (vt.worldSpaceBlend <= 0.001 && logVal >= 18.8 && logVal <= 21.1) {
          const armNav = this.seamlessUniverse.getSpiralArmNavigationState(_galaxyArmWorldDir);
          if (armNav.navActiveWeight > 0.005) {
            const dirSign = scaleVel > 0.08 ? -1 : 1;
            navSteerX = _galaxyArmWorldDir.dot(_camRight) * armNav.navActiveWeight * 1.15 * dirSign;
            navPitchZ = _galaxyArmWorldDir.dot(_camUp) * armNav.navActiveWeight * 0.85 * dirSign;
          }
        }
        if (this.flightTrajectory === 'spiral' && Math.abs(spiralAngularVel) > 0.02) {
          const spiralLead = THREE.MathUtils.clamp(spiralAngularVel * 0.28, -0.95, 0.95);
          navSteerX += spiralLead;
          navPitchZ += Math.cos(spiralAngle) * 0.16 * Math.min(1, Math.abs(spiralAngularVel));
        }

        if (vt.worldSpaceBlend > 0.001) {
          _vesselEuler.set(0, this.cosmicOrbitYaw, 0);
          _vesselUprightQuat.setFromEuler(_vesselEuler);
          this.chronoVessel.root.quaternion
            .copy(this.camera.quaternion)
            .slerp(_vesselUprightQuat, vt.worldSpaceBlend);
        } else {
          this.chronoVessel.root.quaternion.copy(this.camera.quaternion);
          if (navSteerX !== 0 || navPitchZ !== 0) {
            _vesselNavEuler.set(navPitchZ * 0.34, -navSteerX * 0.42, -navSteerX * 0.22);
            _vesselNavQuat.setFromEuler(_vesselNavEuler);
            this.chronoVessel.root.quaternion.multiply(_vesselNavQuat);
          }
        }
        const bankDecay = Math.exp(-9.0 * dt);
        this.mouselookBankX = Math.abs(this.mouselookBankX * bankDecay) < 1e-4 ? 0 : this.mouselookBankX * bankDecay;
        this.mouselookPitchZ = Math.abs(this.mouselookPitchZ * bankDecay) < 1e-4 ? 0 : this.mouselookPitchZ * bankDecay;

        this.chronoVessel.update(
          dt,
          scaleVel,
          this.moveInput.x + navSteerX + this.mouselookBankX,
          this.moveInput.z + navPitchZ + this.mouselookPitchZ
        );

        // Animate & check 6 Atmospheric Skydiving Descent Rings during explicit landing descent
        const showRings = this.autoLandAtForestPending && logVal >= 1.0 && logVal <= 5.2;
        this.descentRingsGroup.visible = showRings;
        this.descentRingsGroup.matrixWorldAutoUpdate = showRings;
        if (showRings && this.descentRingMeshes.length === DESCENT_RING_SPECS.length) {
          _ringVesselScratch.copy(this.chronoVessel.root.position);
          const nowPulse = performance.now() * 0.004;
          for (let i = 0; i < DESCENT_RING_SPECS.length; i++) {
            const spec = DESCENT_RING_SPECS[i];
            const mesh = this.descentRingMeshes[i];
            const deltaLog = logVal - spec.logMeters;
            const ringVisible =
              !this.descentRingHitFlags[i] && deltaLog >= -0.04 && deltaLog <= 1.15;
            mesh.visible = ringVisible;
            if (!ringVisible) continue;

            const distAlongCam = 8.4 + deltaLog * 18.0;
            const mat = mesh.material as THREE.MeshBasicMaterial;
            mat.opacity =
              smoothstep01(-0.04, 0.1, deltaLog) *
              (1.0 - smoothstep01(0.75, 1.15, deltaLog)) *
              0.84;
            _ringPosScratch
              .copy(this.camera.position)
              .addScaledVector(_camForward, distAlongCam)
              .addScaledVector(_camRight, spec.offsetX * 0.42 * smoothstep01(0.0, 0.65, deltaLog))
              .addScaledVector(_camUp, spec.offsetZ * 0.34 * smoothstep01(0.0, 0.65, deltaLog));
            mesh.position.copy(_ringPosScratch);
            mesh.lookAt(this.camera.position);
            mesh.rotateZ(nowPulse * 0.35 + i * 0.8);
            const ringScale =
              (spec.radiusMeters / 6.2) * (1.0 + Math.sin(nowPulse + i) * 0.05);
            mesh.scale.setScalar(ringScale);

            if (
              Math.abs(deltaLog) <= 0.22 &&
              _ringVesselScratch.distanceTo(_ringPosScratch) <= ringScale * 3.8 + 4.5
            ) {
              this.descentRingHitFlags[i] = true;
              this.descentRingsHitCount += 1;
              mesh.visible = false;
              AudioService.playDescentRingChime(i);
              NativeBridge.haptic('tick');
              this.awardProgress(2, 'sanctuary', this.descentRingsHitCount * 10);
              this.registerArcadeCombo('Descent Ring!', 0);
              this.callbacks.onBountyEvent?.('descent_rings', 1);
              this.callbacks.onModeNotification?.(
                `Orbital Descent Ring ${this.descentRingsHitCount}/${DESCENT_RING_SPECS.length}! +2 DNA`
              );
            }
          }
        }
      }
    }

    this.seamlessTelemetryAccum += dt;
    if (this.seamlessTelemetryAccum >= 0.08) {
      this.seamlessTelemetryAccum = 0;
      this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
    }
  }

  public isObjectMarkersUnlocked(): boolean {
    return Boolean(this.stats.unlockedObjectMarkers || this.allFeaturesUnlockedOverride);
  }

  public isRealityRescalerUnlocked(): boolean {
    return Boolean(this.stats.unlockedRealityRescaler || this.allFeaturesUnlockedOverride);
  }

  public setAllFeaturesUnlocked(unlocked: boolean) {
    this.allFeaturesUnlockedOverride = unlocked;
    if (this.seamlessZoomActive) {
      this.tickSeamlessUniverse(0.001);
    }
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public setRealityScaleGamma(gamma: number) {
    const clamped = THREE.MathUtils.clamp(gamma, 0.28, 1.0);
    this.settings = { ...this.settings, realityScaleGamma: clamped };
    ProgressionService.saveSettings(this.settings);
    if (this.seamlessZoomActive) {
      this.tickSeamlessUniverse(0.001);
    }
    this.invalidateZoomThumbnails();
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public setShowObjectMarkers(show: boolean) {
    this.settings = { ...this.settings, showObjectMarkers: show };
    ProgressionService.saveSettings(this.settings);
    if (this.seamlessZoomActive) {
      this.tickSeamlessUniverse(0.001);
    }
    this.invalidateZoomThumbnails();
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public setAstrophysicsPalette(palette: AstrophysicsPaletteMode) {
    this.settings = { ...this.settings, astrophysicsPalette: palette };
    ProgressionService.saveSettings(this.settings);
    if (this.seamlessZoomActive) {
      this.tickSeamlessUniverse(0.001);
    }
    this.invalidateZoomThumbnails();
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public setGalaxyMorphology(morphology: GalaxyMorphology) {
    this.seamlessUniverse.setGalaxyMorphology(morphology);
    if (this.seamlessZoomActive) {
      this.tickSeamlessUniverse(0.001);
    }
    this.invalidateZoomThumbnails();
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public getGalaxyMorphology(): GalaxyMorphology {
    return this.seamlessUniverse.getGalaxyMorphology();
  }

  private notifyForestSpecimenDiscovered(): void {
    const spec = this.seamlessUniverse.getActiveForestSpecimenSpec();
    if (this.lastDiscoveredSpecimenId === spec.id) {
      return;
    }
    this.lastDiscoveredSpecimenId = spec.id;
    this.callbacks.onForestSpecimenDiscovered?.(spec.id, spec.label);
  }

  public rerollForestSpecimen(specificId?: ForestMicroSpecimenId): void {
    const spec = this.seamlessUniverse.rerollForestSpecimen(specificId);
    this.lastDiscoveredSpecimenId = spec.id;
    this.callbacks.onForestSpecimenDiscovered?.(spec.id, spec.label);
    this.invalidateZoomThumbnails('leaf_fur_micro');
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public invalidateZoomThumbnails(specificBandId?: UniverseScaleBandId): void {
    if (specificBandId) {
      delete this.thumbBandVersion[specificBandId];
      if (this.thumbSettledBandId === specificBandId) {
        this.thumbSettledAccumSec = 0.25;
      }
      return;
    }
    this.thumbStyleEpoch += 1;
    this.thumbSettledAccumSec = 0;
    this.callbacks.onZoomThumbnailsReset?.();
  }

  public requestCurrentBandThumbnail(): void {
    if (this.seamlessZoomActive) {
      const bandId = UNIVERSE_SCALE_BANDS[findNearestScaleBandIndex(this.currentLogScaleMeters)].id;
      this.pendingThumbnailBandId = bandId;
      return;
    }
    if (this.cosmicStage === 'playing' && this.currentMode === 'sanctuary') {
      this.pendingThumbnailBandId = 'capybara_forest';
    }
  }

  private trackSettledBandForThumbnail(bandId: UniverseScaleBandId, dt: number): void {
    if (this.thumbSettledBandId !== bandId) {
      this.thumbSettledBandId = bandId;
      this.thumbSettledAccumSec = 0;
      return;
    }
    if (this.thumbBandVersion[bandId] === this.thumbStyleEpoch) {
      return;
    }
    this.thumbSettledAccumSec += dt;
    if (this.thumbSettledAccumSec >= 0.28) {
      this.pendingThumbnailBandId = bandId;
    }
  }

  private captureScaleBandThumbnail(bandId: UniverseScaleBandId): void {
    if (typeof document === 'undefined' || !this.callbacks.onZoomThumbnailUpdated) return;
    const srcCanvas = this.renderer?.domElement;
    if (!srcCanvas || srcCanvas.width < 16 || srcCanvas.height < 16) return;
    if (!this.thumbCanvas) {
      this.thumbCanvas = document.createElement('canvas');
      this.thumbCanvas.width = 256;
      this.thumbCanvas.height = 160;
      this.thumbCtx = this.thumbCanvas.getContext('2d');
    }
    if (!this.thumbCtx) return;

    const dstW = 256;
    const dstH = 160;
    const targetAspect = dstW / dstH;
    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    const srcAspect = srcW / srcH;

    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;
    if (srcAspect > targetAspect) {
      sw = Math.round(srcH * targetAspect);
      sx = Math.round((srcW - sw) * 0.5);
    } else if (srcAspect < targetAspect) {
      sh = Math.round(srcW / targetAspect);
      sy = Math.round((srcH - sh) * 0.5);
    }

    try {
      this.thumbCtx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, dstW, dstH);
      const dataUrl = this.thumbCanvas.toDataURL('image/jpeg', 0.8);
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        this.thumbBandVersion[bandId] = this.thumbStyleEpoch;
        this.callbacks.onZoomThumbnailUpdated(bandId, dataUrl);
      }
    } catch {
      // Ignore tainted-canvas or software fallback read errors cleanly
    }
  }

  public getUniverseScaleTelemetry(): UniverseScaleTelemetry {
    const bandIndex = findNearestScaleBandIndex(this.currentLogScaleMeters);
    const band = UNIVERSE_SCALE_BANDS[bandIndex];
    const expStr =
      this.currentLogScaleMeters >= 0
        ? `+${this.currentLogScaleMeters.toFixed(1)}`
        : this.currentLogScaleMeters.toFixed(1);
    const effectiveGamma = this.isRealityRescalerUnlocked()
      ? (this.settings.realityScaleGamma ?? 1.0)
      : 1.0;
    const effectiveMarkers = Boolean(
      this.seamlessZoomActive &&
        this.settings.showObjectMarkers &&
        this.isObjectMarkersUnlocked()
    );

    let markersSnapshot: ProjectedObjectMarker[] = EMPTY_PROJECTED_MARKERS;
    if (effectiveMarkers) {
      const vw = this.renderer.domElement.clientWidth || 1280;
      const vh = this.renderer.domElement.clientHeight || 800;
      const raw = this.seamlessUniverse.projectVisibleMarkers(
        this.camera,
        vw,
        vh,
        this.currentLogScaleMeters,
        true
      );
      if (raw.length > 0) {
        markersSnapshot = raw.map((m) => ({ ...m }));
      }
    }

    return {
      active: this.seamlessZoomActive,
      logScaleMeters: +this.currentLogScaleMeters.toFixed(2),
      targetLogScaleMeters: +this.targetLogScaleMeters.toFixed(2),
      scaleFormatted: formatPhysicalScaleMeters(this.currentLogScaleMeters),
      scientificLabel: `10^${expStr} m`,
      bandId: band.id,
      bandIndex,
      totalBands: UNIVERSE_SCALE_BANDS.length,
      bandTitle: band.title,
      bandSubtitle: band.subtitle,
      domain: band.domain,
      quantumFocus: this.quantumFocusMode,
      autoZoomDir: this.autoZoomDirection,
      realityScaleGamma: +effectiveGamma.toFixed(2),
      showObjectMarkers: effectiveMarkers,
      markers: markersSnapshot,
      cosmicAgeGyr: +computeCosmicAgeGyr(this.currentLogScaleMeters).toFixed(2),
      cruiseVelocityLogPerSec:
        this.autoZoomDirection === 0
          ? 0
          : +(this.autoZoomDirection * Math.abs(this.cruiseVelocityLogPerSec)).toFixed(2),
      vesselMode: this.vesselMode,
      flightTrajectory: this.flightTrajectory,
      fineStructureInverse: +(this.proceduralConfig.universe.fineStructureInverse ?? 137.036).toFixed(3),
      fineStructureAlpha: +(1.0 / (this.proceduralConfig.universe.fineStructureInverse ?? 137.036)).toFixed(6),
      galaxyMorphology: this.seamlessUniverse.getGalaxyMorphology(),
      forestSpecimenId: this.seamlessUniverse.getActiveForestSpecimenSpec().id,
      forestSpecimenLabel: this.seamlessUniverse.getActiveForestSpecimenSpec().label,
      descentRingsHit: this.descentRingsHitCount,
      descentRingsTotal: this.autoLandAtForestPending ? DESCENT_RING_SPECS.length : 0,
      dockedOnChronoPad: this.dockedChronoVesselVisible,
    };
  }

  public setSeamlessLogScale(nextLogMeters: number, immediate: boolean = false) {
    if (this.placementGhost.active) {
      this.cancelBuildingPlacementGhost(true);
    }
    const clamped = THREE.MathUtils.clamp(
      nextLogMeters,
      MIN_UNIVERSE_LOG_METERS,
      MAX_UNIVERSE_LOG_METERS
    );
    if (!this.seamlessZoomActive) {
      this.seamlessZoomActive = true;
      this.performanceLog.notifyTransitionWarmup(4);
      this.vesselMode = 'chase_pod';
      this.chronoVessel?.setMode('chase_pod');
      this.cosmicOrbitPitch = Math.max(0.24, this.cosmicOrbitPitch);
      if (this.camera.zoom !== 1.0) {
        this.camera.zoom = 1.0;
        this.camera.updateProjectionMatrix();
      }
    }
    this.autoZoomDirection = 0;
    this.autoLandAtForestPending = false;
    this.targetLogScaleMeters = clamped;
    if (immediate) {
      this.performanceLog.notifyTransitionWarmup(5);
      this.currentLogScaleMeters = clamped;
      this.tickSeamlessUniverse(0.016);
      if (this.worldEnv && this.gpuEngine) {
        const inForestWindow =
          this.currentLogScaleMeters >= -0.85 && this.currentLogScaleMeters <= 2.85;
        this.gpuEngine.updateLightingAndShadowCascade(
          0.016,
          this.heroCapy.position.x,
          this.heroCapy.position.y,
          this.heroCapy.position.z,
          0,
          inForestWindow,
          this.worldEnv.currentNightFactor,
          this.worldEnv.currentSunDir,
          this.worldEnv.currentMoonDir,
          this.worldEnv.activeShadowCaster,
          this.worldEnv.getDayPhaseLabel(),
          this.worldEnv.timeOfDayHours,
          this.worldEnv.currentIblEnvIntensity
        );
        this.gpuEngine.render();
      }
    }
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public jumpToScaleBand(bandId: UniverseScaleBandId, immediate: boolean = false) {
    const spec = this.seamlessUniverse.getBandById(bandId);
    if (bandId === 'leaf_fur_micro' && !immediate) {
      this.seamlessUniverse.rerollForestSpecimen();
      this.invalidateZoomThumbnails('leaf_fur_micro');
    }
    if (bandId === 'single_electron') {
      this.quantumFocusMode = 'electron';
    } else if (bandId === 'single_photon') {
      this.quantumFocusMode = 'photon';
    } else if (spec.logMeters > -20.0) {
      this.quantumFocusMode = 'auto';
    }
    this.autoZoomDirection = 0;
    this.autoLandAtForestPending = false;
    AudioService.playCosmicWarp(1.08);
    this.setSeamlessLogScale(spec.logMeters, immediate);
  }

  public stepScaleBand(direction: -1 | 1) {
    const curIdx = findNearestScaleBandIndex(this.targetLogScaleMeters);
    // direction -1 = zoom IN to smaller scale (higher array index); +1 = zoom OUT to larger scale (lower index)
    const nextIdx = THREE.MathUtils.clamp(
      curIdx - direction,
      0,
      UNIVERSE_SCALE_BANDS.length - 1
    );
    this.jumpToScaleBand(UNIVERSE_SCALE_BANDS[nextIdx].id, false);
  }

  public setQuantumFocusMode(mode: QuantumFocusMode) {
    this.quantumFocusMode = mode;
    if (mode === 'electron') {
      this.setSeamlessLogScale(-23.0, false);
    } else if (mode === 'photon') {
      this.setSeamlessLogScale(-29.0, false);
    } else {
      this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
    }
    AudioService.playCoin();
  }

  public toggleAutoZoom(direction: -1 | 0 | 1) {
    this.autoLandAtForestPending = false;
    if (direction === 0 || this.autoZoomDirection === direction) {
      this.setCruiseVelocity(0);
    } else {
      if (!this.seamlessZoomActive) {
        this.launchIntoCosmos(this.currentLogScaleMeters);
      }
      this.setCruiseVelocity(direction * MEDIA_SPEED_GEARS[1]);
    }
    AudioService.playCoin();
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public resumeSurfacePlayFromForest(snapCamera: boolean = true) {
    this.ensureSurfaceWorldsBuilt();
    this.autoZoomDirection = 0;
    this.cruiseVelocityLogPerSec = 0;
    this.targetCruiseVelocityLogPerSec = 0;
    this.autoLandAtForestPending = false;
    this.vesselMode = 'landed';
    this.descentRingsGroup.visible = false;
    this.descentRingsGroup.matrixWorldAutoUpdate = false;
    this.setSkyDomeAlpha(1.0);
    const savedCamPos = _tempVec3.copy(this.camera.position);
    AudioService.playCoin();
    this.setCosmicStage('playing');
    if (!snapCamera) {
      this.surfaceCamYaw = this.cosmicOrbitYaw + Math.PI;
      this.heroYaw = this.surfaceCamYaw;
      this.heroCapy.rotation.y = this.heroYaw;
      this.surfaceCamPitch = THREE.MathUtils.clamp(this.cosmicOrbitPitch, 0.14, 1.05);
      this.camera.position.copy(savedCamPos);
      this.camera.lookAt(
        this.heroCapy.position.x,
        this.heroCapy.position.y + 0.9,
        this.heroCapy.position.z
      );
    }
    this.syncDockedVesselPose(0.016, this.currentMode === 'sanctuary');
  }

  public setMouselookLocked(locked: boolean): void {
    this.mouselookLocked = locked;
    if (locked) {
      this.mouselookLastActiveTimeMs = performance.now();
    }
  }

  public applyMouseLookDelta(deltaX: number, deltaY: number): void {
    if (this.settings.mouselookEnabled === false) return;
    if (deltaX === 0 && deltaY === 0) return;

    const sens = this.settings.mouselookSensitivity ?? 1.0;
    const invertY = Boolean(this.settings.invertMouseY);
    this.mouselookLastActiveTimeMs = performance.now();

    if (this.seamlessZoomActive) {
      const logVal = this.currentLogScaleMeters;
      const inForestWindow = logVal >= -0.85 && logVal <= 2.85;
      const horizonMinPitch = inForestWindow
        ? 0.14
        : THREE.MathUtils.lerp(-0.68, 0.14, THREE.MathUtils.smoothstep(logVal, 5.8, 4.7));
      const res = computeMouseLookAngles(
        this.cosmicOrbitYaw,
        this.cosmicOrbitPitch,
        deltaX,
        deltaY,
        sens,
        invertY,
        horizonMinPitch,
        1.18
      );
      this.cosmicOrbitYaw = res.yaw;
      this.cosmicOrbitPitch = res.pitch;
      this.mouselookBankX = THREE.MathUtils.clamp(
        this.mouselookBankX + THREE.MathUtils.clamp(deltaX * 0.012 * sens, -0.85, 0.85),
        -1.1,
        1.1
      );
      const ySign = invertY ? -1 : 1;
      this.mouselookPitchZ = THREE.MathUtils.clamp(
        this.mouselookPitchZ + THREE.MathUtils.clamp(deltaY * ySign * 0.01 * sens, -0.7, 0.7),
        -0.9,
        0.9
      );
      return;
    }

    if (this.cosmicStage !== 'playing') {
      if (
        this.cosmicStage === 'big_bang' ||
        this.cosmicStage === 'universe_flight' ||
        this.cosmicStage === 'galaxy_view' ||
        this.cosmicStage === 'star_system_view' ||
        this.cosmicStage === 'planet_orbit'
      ) {
        const minPitch = this.cosmicStage === 'big_bang' ? -0.75 : -0.55;
        const maxPitch = this.cosmicStage === 'big_bang' ? 1.2 : 1.15;
        const res = computeMouseLookAngles(
          this.cosmicOrbitYaw,
          this.cosmicOrbitPitch,
          deltaX,
          deltaY,
          sens,
          invertY,
          minPitch,
          maxPitch
        );
        this.cosmicOrbitYaw = res.yaw;
        this.cosmicOrbitPitch = res.pitch;
      }
      return;
    }

    if (this.currentMode === 'capytorio' && this.getCapytorioCameraMode() === 'oblique') {
      return;
    }

    const res = computeMouseLookAngles(
      this.surfaceCamYaw,
      this.surfaceCamPitch,
      deltaX,
      deltaY,
      sens,
      invertY,
      -0.38,
      1.18
    );
    this.surfaceCamYaw = res.yaw;
    this.surfaceCamPitch = res.pitch;
  }

  private syncCapytorioHighAltitudePlanetSurface(
    dt: number,
    wx: number,
    wy: number,
    wz: number,
    pose: typeof _capytorioAltPose
  ): void {
    if (!this.seamlessUniverse || this.seamlessZoomActive) return;
    // Keep tactical & macro factory zoom (up to 420m altitude) 100% pure Capytorio terrain/water
    // with zero universe-scale woodland or planetary overlay interference.
    if (pose.altitudeRadius <= 420) {
      if (this.capytorioPlanetFadeActive) {
        this.capytorioPlanetFadeActive = false;
        this.seamlessUniverse.hide();
        this.setSkyDomeAlpha(1.0);
        if (this.oceanMesh) {
          this.oceanMesh.visible = true;
        }
        this.setSceneBackgroundHex(this.activeBiome?.skyHex ?? 0x38bdf8);
      }
      return;
    }

    this.capytorioPlanetFadeActive = true;
    const effectiveGamma = this.isRealityRescalerUnlocked()
      ? (this.settings.realityScaleGamma ?? 1.0)
      : 1.0;
    const paletteMode: AstrophysicsPaletteMode =
      this.settings.astrophysicsPalette ?? 'natural';
    _seamlessFocalPos.set(wx, wy, wz);
    // Pass suppressWoodlandSurfaceLayers = true so Sanctuary's giant pine/ecosystem/glade trees
    // NEVER appear over Capytorio — only atmosphere clouds and the planetary globe emerge cleanly!
    this.seamlessUniverse.updateForLogScale(
      pose.logAlt,
      dt,
      'auto',
      _seamlessFocalPos,
      _seamlessSkyColor,
      effectiveGamma,
      false,
      paletteMode,
      true,
      true
    );
    this.seamlessUniverse.rootGroup.scale.setScalar(pose.altitudeRadius / 38.0);
    this.seamlessUniverse.forestGroveGroup.visible = false;
    this.seamlessUniverse.forestGroveGroup.matrixWorldAutoUpdate = false;

    const skyAlpha = 1.0 - smoothstep01(3.05, 4.15, pose.logAlt);
    this.setSkyDomeAlpha(skyAlpha);
    if (this.worldEnv) {
      _colorHelper.copy(this.worldEnv.currentHorizonSkyColor);
    } else {
      _colorHelper.setHex(this.activeBiome?.skyHex ?? 0x38bdf8);
    }
    _colorHelper.lerp(_seamlessSkyColor, 1.0 - skyAlpha);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(_colorHelper);
    } else {
      this.scene.background = _colorHelper.clone();
    }
  }

  public adjustZoom(delta: number): number {
    if (this.isVesselFlying()) {
      return this.adjustVesselThrottle(delta, false);
    }
    const isCapytorioOblique =
      this.cosmicStage === 'playing' &&
      this.currentMode === 'capytorio' &&
      this.getCapytorioCameraMode() === 'oblique';
    const curDist = isCapytorioOblique
      ? this.capytorioObliqueZoomDist
      : (this.settings.cameraDistance ?? 1.0);
    const step = isCapytorioOblique
      ? computeCapytorioZoomStep(curDist, delta)
      : computeSurfaceZoomStep(curDist, delta, this.cosmicStage === 'playing');
    if (step.launchToOrbit) {
      if (isCapytorioOblique) {
        this.currentLogScaleMeters = CAPYTORIO_ORBIT_HANDOFF_LOG_METERS;
        this.launchIntoCosmos(step.launchTargetLogMeters, 'capytorio');
      } else {
        this.launchIntoCosmos(step.launchTargetLogMeters, 'sanctuary');
      }
      return this.adjustVesselThrottle(delta, true);
    }
    if (isCapytorioOblique) {
      this.capytorioObliqueZoomDist = step.nextDistance;
      if (step.nextDistance <= 2.2) {
        this.settings.cameraDistance = Math.round(step.nextDistance * 100) / 100;
        ProgressionService.saveSettings(this.settings);
      }
      return this.capytorioObliqueZoomDist;
    }
    this.settings.cameraDistance = step.nextDistance;
    this.updateSettings(this.settings);
    return this.settings.cameraDistance;
  }

  public addCameraTrauma(amount: number): void {
    this.cameraTrauma = Math.min(1.0, Math.max(0, this.cameraTrauma + amount));
  }

  public getCameraTrauma(): number {
    return this.cameraTrauma;
  }

  private updateAaaCameraFeelAndWorldVfx(dt: number, heroGroundY: number): void {
    const wx = this.heroCapy.position.x;
    const wy = this.heroCapy.position.y;
    const wz = this.heroCapy.position.z;

    let planarSpeed = 0;
    if (this.prevHeroPosInitialized) {
      const dx = wx - this.prevHeroWorldX;
      const dz = wz - this.prevHeroWorldZ;
      const rawSpeed = Math.hypot(dx, dz) / Math.max(0.001, dt);
      // Ignore instantaneous sector teleport jumps (> 42 m/s)
      planarSpeed = rawSpeed < 42 ? rawSpeed : 0;
    } else {
      this.prevHeroPosInitialized = true;
    }
    this.prevHeroWorldX = wx;
    this.prevHeroWorldZ = wz;

    // 1. Velocity-Reactive Dynamic Camera FOV (+0° to +5.4° smoothly damped)
    const baseFov = this.settings.fov || 58;
    const totalSpeed = Math.hypot(planarSpeed, this.heroVelocity.y * 0.55);
    const targetFovBoost = THREE.MathUtils.clamp((totalSpeed - 3.5) * 0.42, 0, 5.4);
    this.dynamicFovOffset = THREE.MathUtils.lerp(
      this.dynamicFovOffset,
      targetFovBoost,
      1 - Math.exp(-7.5 * dt)
    );
    const desiredFov = baseFov + this.dynamicFovOffset;
    if (Math.abs(this.camera.fov - desiredFov) > 0.04) {
      this.camera.fov = desiredFov;
      this.camera.updateProjectionMatrix();
    }

    // 2. Quadratic Trauma Screen-Shake (Squirrel Eiserloh GDC trauma^2 decay)
    if (this.cameraTrauma > 0.001) {
      this.cameraShakePhase += dt * 38.0;
      const shakeMag = this.cameraTrauma * this.cameraTrauma * 0.24;
      this.camera.position.x += Math.sin(this.cameraShakePhase * 1.13) * shakeMag;
      this.camera.position.y += Math.cos(this.cameraShakePhase * 1.71) * shakeMag * 0.85;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.85);
    }

    // 3. Surface-Aware Sprint Dust / Cobblestone Puffs / Water Droplets & Foley Footsteps
    if (this.vfxEngine && this.heroCapy.visible) {
      const inWater =
        this.isSwimmingInPool ||
        heroGroundY < -0.18 ||
        (this.currentMode === 'spore' && wy <= 0.25);
      const rOrigin = Math.hypot(wx, wz);
      const onCauseway = !inWater && rOrigin > 35.5 && rOrigin < 76.0 && Math.abs(Math.abs(wx) - Math.abs(wz)) < 8.5;
      const stepSurface = this.vfxEngine.recordHeroMovementStep(
        wx,
        Math.max(heroGroundY, wy),
        wz,
        planarSpeed,
        dt,
        inWater,
        onCauseway
      );
      if (stepSurface && this.isGrounded) {
        AudioService.playFootstep(stepSurface);
      }

      this.vfxEngine.update(
        dt,
        this.worldEnv?.elapsedSeconds ?? 0,
        wx,
        wy,
        wz,
        this.worldEnv?.currentSunDir ?? this.gpuEngine.sunLight.position,
        this.worldEnv?.currentNightFactor ?? 0,
        this.settings.weatherMode === 'storm' ? 1 : this.settings.weatherMode === 'rain' ? 0.5 : 0,
        !this.seamlessZoomActive && this.cosmicStage === 'playing',
        this.settings.gpuQualityPreset === 'performance'
      );
    }
  }

  public handleResize(width: number, height: number) {
    if (width < 16 || height < 16) return;
    const safeW = Math.max(16, Math.floor(width));
    const safeH = Math.max(16, Math.floor(height));
    const curSize = this.renderer.getSize(_rendererSizeVec2);
    if (Math.floor(curSize.x) === safeW && Math.floor(curSize.y) === safeH) {
      return;
    }
    this.camera.aspect = safeW / safeH;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.renderer.setSize(safeW, safeH);
    this.gpuEngine?.handleResize(safeW, safeH);
    this.vfxEngine?.setPixelRatio(this.renderer.getPixelRatio());
    this.renderer.getDrawingBufferSize(_rendererSizeVec2);
    if (_rendererSizeVec2.x > 10 && _rendererSizeVec2.y > 10) {
      SHARED_OCCLUDER_VIEWPORT.set(_rendererSizeVec2.x, _rendererSizeVec2.y);
    }
    // Redraw immediately after setSize so the cleared canvas buffer never flashes black for a frame
    this.gpuEngine?.render();
  }

  public dispose() {
    this.disposed = true;
    this.unsubscribeCapytorioLua?.();
    this.unsubscribeCapytorioLua = null;
    this.deferredBootCancel?.();
    this.deferredBootCancel = null;
    this.idleWarmupCancel?.();
    this.idleWarmupCancel = null;
    this.cancelBuildingPlacementGhost(true);
    ProgressionService.flushPendingSave();
    AudioService.dispose();
    this.physicsBridge?.dispose();
    this.cosmicBuilder?.dispose();
    this.seamlessUniverse?.dispose();
    this.chronoVessel?.dispose();
    this.chronoPad?.dispose();
    this.vfxEngine?.dispose();
    this.gpuEngine?.dispose();
    this.runnerBannerTextureCache.forEach((tex) => tex.dispose());
    this.runnerBannerTextureCache.clear();
    this.sporeOrbSphereGeo?.dispose();
    this.sporeOrbDnaGeo?.dispose();
    this.sporeOrbPlanktonMat?.dispose();
    this.sporeOrbDnaMat?.dispose();
    this.sporeRippleTexture?.dispose();
    this.sporeWaterMat?.dispose();
    this.capytorioRenderer?.dispose();
    this.fallGuysGhostMat?.dispose();
    disposeObject3DTree(this.scene);
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }
}
