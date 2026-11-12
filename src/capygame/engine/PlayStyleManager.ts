import * as THREE from 'three';
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
  SHARED_OCCLUDER_HEAD_UV,
  SHARED_OCCLUDER_VIEWPORT,
  evaluateSightlineEdgeAlphaAtScreenUv,
  installSightlineEdgeFadeShader,
} from './RealisticWorldEnvironment';
import {
  AstrophysicsPaletteMode,
  BuildingType,
  CAPYBARA_FOREST_LOG_METERS,
  CapyGameSettings,
  CapyLodTier,
  CapySnakeTelemetry,
  COSMIC_GALAXIES,
  CosmicStage,
  DEFAULT_CAPY_SETTINGS,
  GpuEngineTelemetry,
  GpuPipelineConfig,
  GpuQualityPreset,
  HEAD_ORANGE_VARIETIES,
  LiveModeTelemetry,
  MAX_UNIVERSE_LOG_METERS,
  MIN_UNIVERSE_LOG_METERS,
  PLAYABLE_CAPY_HEROES,
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
} from '../types';
import { AudioService } from '../services/AudioService';
import { ProgressionService } from '../services/ProgressionService';
import { NativeBridge } from '../../services/NativeBridge';
import { AaaWorldVfxEngine } from './gpu/AaaWorldVfxEngine';
import { HardwareGpuEngine } from './gpu/HardwareGpuEngine';
import { PbrTextureSynthesizer } from './gpu/PbrTextureSynthesizer';
import { PhysicsWorldBridge } from './physics/PhysicsWorldBridge';
import {
  CONTIGUOUS_BRIDGES,
  classifyDistrictAtWorldPos,
  clampToContiguousWalkableWorld,
  sampleContiguousGroundY,
} from './physics/ContiguousWorldTopology';
import type {
  PhysicsEngineTelemetry,
  StaticBoxColliderSpec,
  StaticCircleColliderSpec,
} from './physics/PhysicsTypes';

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
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _rayHits: THREE.Intersection[] = [];
const _occluderCandidates: THREE.Object3D[] = [];
const _rendererSizeVec2 = new THREE.Vector2(1280, 720);
const _occCenterWorld = new THREE.Vector3();
const _occProjectedNdc = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _colorHelper = new THREE.Color();
const _colorHelper2 = new THREE.Color();
const _seamlessSkyColor = new THREE.Color();
const _seamlessFocalPos = new THREE.Vector3();
const _sanctuaryGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ghostWorldHit = new THREE.Vector3();
const _cachedPoolSpec = { x: -8.8, z: 3.0, radius: 4.8 };
const EMPTY_PROJECTED_MARKERS: ProjectedObjectMarker[] = [];

const SNAKE_PATH_CAPACITY = 800;
const MAX_DACHSHUND_SEGMENTS = 48;
const DACHSHUND_SEGMENT_SPACING = 0.66;
const MAX_SPINE_NODES = MAX_DACHSHUND_SEGMENTS + 2;
const MAX_SPINE_BEND_RAD = 0.52; // ~30 deg max articulation bend so backing up never jackknifes
const MAX_SOLID_SQUASH = 0.06; // Solid body: <= 6% slight compression on impact
const MAX_PHYSICS_FRUITS = 64;
const POND_OVERFLOW_FRUIT_THRESHOLD = 6;

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
}

export class PlayStyleManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public readonly isSoftwareGl: boolean;

  public currentMode: PlayStyle = 'sanctuary';
  private stats: PlayerStats;
  private settings: CapyGameSettings;
  private callbacks: GameEventCallbacks;
  private telemetryTimer: number = 0;

  // Shared 3D World Groups (all 5 game zones live simultaneously in one contiguous world)
  private worldBaseGroup = new THREE.Group();
  private sanctuaryGroup = new THREE.Group();
  private sporeGroup = new THREE.Group();
  private breakoutGroup = new THREE.Group();
  private runnerGroup = new THREE.Group();
  private fallGuysGroup = new THREE.Group();

  // Cosmic Genesis & Multi-Scale Universe State
  public cosmicStage: CosmicStage = 'singularity';
  public cosmicBuilder: CosmicUniverseBuilder;
  public seamlessUniverse: SeamlessUniverseSimulator;
  public seamlessZoomActive: boolean = false;
  private currentLogScaleMeters: number = MAX_UNIVERSE_LOG_METERS;
  private targetLogScaleMeters: number = MAX_UNIVERSE_LOG_METERS;
  private quantumFocusMode: QuantumFocusMode = 'auto';
  private autoZoomDirection: -1 | 0 | 1 = 0;
  private seamlessTelemetryAccum: number = 0;
  private lastSoftwareRenderMs: number = -1000;
  public allFeaturesUnlockedOverride: boolean = false;

  public selectedGalaxyIndex: number = 0;
  public selectedStarIndex: number = 0;
  public selectedPlanetIndex: number = 0;
  public selectedLandingIndex: number = 0;
  public selectedCapyHeroIndex: number = 0;
  public activeBiome: PlanetaryBiomeConfig =
    COSMIC_GALAXIES[0].starSystems[0].planets[0].landingSpots[0].biome;
  public activeHeroSpec: PlayableCapyHero = PLAYABLE_CAPY_HEROES[0];

  private cosmicCamPos = new THREE.Vector3(0, 0, 26);
  private cosmicCamLook = new THREE.Vector3(0, 0, 0);
  private cosmicOrbitYaw: number = 0;
  private cosmicOrbitPitch: number = 0.28;
  public cosmicZoomMultiplier: number = 1.0;
  private cosmicDescentElapsed: number = 0;

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
  private currentFrameOccludedEntities = new Set<THREE.Object3D>();

  // Zero-Allocation Solid-Body Slight Squash State (clamped to +-6%)
  public heroSoftSquash: number = 0;
  private heroSoftSquashVel: number = 0;
  private segSoftSquash = new Float32Array(MAX_DACHSHUND_SEGMENTS);
  private segSoftSquashVel = new Float32Array(MAX_DACHSHUND_SEGMENTS);
  private buddySoftSquash = new Float32Array(8);
  private buddySoftSquashVel = new Float32Array(8);

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

  // Unified Input State (Keyboard + Touch D-pad + Pointer Drag)
  public moveInput = { x: 0, z: 0 };
  public pointerTargetX: number | null = null;
  public isJumping: boolean = false;

  // --- Dynamic 60 FPS Capybara Level-of-Detail (LOD) Governor ---
  private rollingFps: number = 60;
  private currentCapyLodTier: CapyLodTier = 3;
  private lodGovernorAccum: number = 0;
  private lodHighFpsStreak: number = 0;
  private lodLowFpsStreak: number = 0;

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
    { wx: 75, wz: 63, angleY: 0, angularSpeed: 2.4, halfLen: 4.75 },
    { wx: 75, wz: 55, angleY: 0, angularSpeed: -2.4, halfLen: 4.75 },
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
  private eatenFruitMass: number = 0; // Drives logarithmic body length & mouth capacity
  private logarithmicLengthMeters: number = 1.65;
  private activeHeadOrangeIndex: number = 0;
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

  // --- 2. Spore Evolution State ---
  private sporeMass: number = 10;
  private sporeDnaEarned: number = 0;
  private sporeOrbs: Array<{
    mesh: THREE.Mesh;
    isDna: boolean;
    value: number;
  }> = [];
  private sporeCritters: Array<{
    mesh: CapyMeshGroup;
    scale: number;
    vel: THREE.Vector3;
    changeDirTimer: number;
  }> = [];
  private sporeDashCooldown: number = 0;

  // --- 3. Breakout State ---
  private breakoutPaddle: THREE.Mesh | null = null;
  private breakoutBalls: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    active: boolean;
  }> = [];
  private breakoutBlocks: Array<{
    mesh: THREE.Mesh;
    hp: number;
    isBonus: boolean;
  }> = [];
  private breakoutPowerups: Array<{
    mesh: THREE.Mesh;
    type: 'multiball' | 'wide';
  }> = [];
  private breakoutScore: number = 0;
  private breakoutWave: number = 1;
  private breakoutCombo: number = 1;
  private paddleWidthMultiplier: number = 1.0;

  // --- 4. Runner State ---
  private runnerHerdMeshes: CapyMeshGroup[] = [];
  private runnerTrackSegments: THREE.Group[] = [];
  private runnerDistance: number = 0;
  private runnerCapyCount: number = 1;
  private runnerSpeed: number = 15.0;
  private runnerGates: Array<{
    mesh: THREE.Group;
    type: 'add' | 'multiply' | 'sub';
    value: number;
    z: number;
    triggered: boolean;
  }> = [];

  // --- 5. Fall Guys State ---
  private fallGuysCrowns: number = 0;
  private fallGuysRound: number = 1;
  private spinningObstacles: Array<{ mesh: THREE.Mesh; speed: number }> = [];
  private seeSaws: Array<{ mesh: THREE.Mesh; phase: number }> = [];
  private fallGuysRivals: Array<{
    capy: CapyMeshGroup;
    speed: number;
    laneOffset: number;
    vy: number;
  }> = [];

  constructor(
    container: HTMLElement,
    initialStats: PlayerStats,
    initialSettings: CapyGameSettings = DEFAULT_CAPY_SETTINGS,
    callbacks: GameEventCallbacks
  ) {
    this.stats = initialStats;
    this.settings = initialSettings;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
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

    // 1. Scene & Camera (Long far-plane so all 5 game zones are visible in the same world)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8);
    this.applyFogSetting();

    const width = Math.max(1, container.clientWidth || window.innerWidth || 360);
    const height = Math.max(1, container.clientHeight || window.innerHeight || 640);
    this.camera = new THREE.PerspectiveCamera(
      this.settings.fov || 58,
      width / height,
      0.1,
      1350
    );
    this.camera.position.set(0, 7.5, 14);

    // 2. Renderer (with mobile / low-memory fallback)
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
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.userSelect = 'none';
    this.renderer.domElement.style.webkitUserSelect = 'none';

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // 3. Studio Environment, Warm/Cool Lighting Rig & Hardware-Accelerated 3D GPU Engine
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x334155, 0.95);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffedd5, 1.45);
    dirLight.position.set(38, 72, 32);
    dirLight.castShadow = !this.isSoftwareGl;
    const shadowRes = this.isSoftwareGl ? 1024 : 2048;
    dirLight.shadow.mapSize.width = shadowRes;
    dirLight.shadow.mapSize.height = shadowRes;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 260;
    const d = 68;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.normalBias = 0.024;
    this.scene.add(dirLight);

    this.gpuEngine = new HardwareGpuEngine(
      this.renderer,
      this.scene,
      this.camera,
      dirLight,
      this.isSoftwareGl,
      width,
      height,
      this.buildGpuConfigFromSettings(this.settings)
    );
    this.vfxEngine = new AaaWorldVfxEngine(
      this.scene,
      this.isSoftwareGl,
      this.renderer.getPixelRatio()
    );

    // Hardware-accelerated PBR texture cache, GPU Sky Dome, 360° Alpine Mountains & Weather
    this.worldEnv = new RealisticWorldEnvironment(
      this.renderer,
      this.isSoftwareGl,
      ambientLight,
      hemiLight,
      dirLight
    );
    this.scene.add(this.worldEnv.moonLight);

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
      initVariety.colorHex
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
    this.scene.add(this.heroCapy);

    // 5. Place All 5 Game Zone Groups in the Shared 3D World
    this.sanctuaryGroup.position.set(ZONE_LOCATIONS.sanctuary.x, 0, ZONE_LOCATIONS.sanctuary.z);
    this.sporeGroup.position.set(ZONE_LOCATIONS.spore.x, 0, ZONE_LOCATIONS.spore.z);
    this.breakoutGroup.position.set(ZONE_LOCATIONS.breakout.x, 0, ZONE_LOCATIONS.breakout.z);
    this.runnerGroup.position.set(ZONE_LOCATIONS.runner.x, 0, ZONE_LOCATIONS.runner.z);
    this.fallGuysGroup.position.set(ZONE_LOCATIONS.fallguys.x, 0, ZONE_LOCATIONS.fallguys.z);

    // All 5 game zones remain permanently visible in the same world
    this.sanctuaryGroup.visible = true;
    this.sporeGroup.visible = true;
    this.breakoutGroup.visible = true;
    this.runnerGroup.visible = true;
    this.fallGuysGroup.visible = true;

    this.scene.add(this.worldBaseGroup);
    this.scene.add(this.sanctuaryGroup);
    this.scene.add(this.sporeGroup);
    this.scene.add(this.breakoutGroup);
    this.scene.add(this.runnerGroup);
    this.scene.add(this.fallGuysGroup);

    // Build shared ocean, mountains, sky dome & connecting Grand Promenade Causeways + all 5 game zones
    this.physicsBridge = new PhysicsWorldBridge();
    this.buildSharedArchipelagoBase();
    this.buildSanctuary();
    this.buildSporeWorld();
    this.buildBreakout();
    this.buildRunner();
    this.buildFallGuys();
    this.syncWorldPhysicsColliders();

    // 6. Build Cosmic Universe Simulation & 25-Band Seamless Multi-Scale Universe Simulator
    this.cosmicBuilder = new CosmicUniverseBuilder(this.isSoftwareGl);
    this.scene.add(this.cosmicBuilder.rootGroup);
    this.seamlessUniverse = new SeamlessUniverseSimulator(this.isSoftwareGl);
    this.scene.add(this.seamlessUniverse.rootGroup);
    this.scene.add(this.seamlessUniverse.celestialBackdropGroup);
    this.sanctuaryGroup.add(this.seamlessUniverse.forestGroveGroup);
    this.buildSelectableCapyHeroCircle();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    const skipCosmic =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('skip_cosmic') === '1';
    this.cosmicStage = skipCosmic ? 'playing' : 'singularity';

    this.switchMode(this.stats.selectedPlayStyle, true);
    this.setCosmicStage(skipCosmic ? 'playing' : 'singularity');
  }

  private applyFogSetting() {
    if (this.cosmicStage !== 'capy_selection' && this.cosmicStage !== 'playing') {
      this.scene.fog = null;
      return;
    }
    const fogColor = this.activeBiome?.fogHex ?? 0xbae6fd;
    if (this.settings.worldFogEnabled) {
      this.scene.fog = new THREE.Fog(fogColor, 68, 340);
    } else {
      this.scene.fog = new THREE.Fog(fogColor, 160, 520);
    }
  }

  private buildGpuConfigFromSettings(s: CapyGameSettings): Partial<GpuPipelineConfig> {
    return {
      qualityPreset: s.gpuQualityPreset ?? 'high',
      postProcessingEnabled: s.gpuPostProcessing !== false,
      toneMapping: s.gpuToneMapping ?? 'agx',
      exposure: s.gpuExposure ?? 1.12,
      textureFilter: s.gpuTextureFilter ?? 'trilinear_aniso',
      anisotropyLevel: s.gpuAnisotropy ?? 8,
      shadowQuality: s.gpuShadowQuality ?? 'pcf_soft',
      visualFilterPreset: s.gpuVisualFilter ?? 'natural_pbr',
      bloomEnabled: s.gpuBloomEnabled !== false,
      bloomStrength: s.gpuBloomStrength ?? 0.28,
      ssaoEnabled: s.gpuSsaoEnabled !== false,
      sharpenAmount: s.gpuSharpenAmount ?? 0.24,
    };
  }

  public static getPresetPatchForGpuQuality(preset: GpuQualityPreset): Partial<CapyGameSettings> {
    if (preset === 'performance') {
      return {
        gpuQualityPreset: 'performance',
        gpuPostProcessing: false,
        gpuShadowQuality: 'off',
        gpuTextureFilter: 'bilinear',
        gpuAnisotropy: 1,
        gpuBloomEnabled: false,
        gpuSsaoEnabled: false,
        gpuSharpenAmount: 0,
      };
    }
    if (preset === 'balanced') {
      return {
        gpuQualityPreset: 'balanced',
        gpuPostProcessing: true,
        gpuShadowQuality: 'pcf',
        gpuTextureFilter: 'trilinear_aniso',
        gpuAnisotropy: 4,
        gpuBloomEnabled: true,
        gpuBloomStrength: 0.22,
        gpuSsaoEnabled: false,
        gpuSharpenAmount: 0.18,
      };
    }
    if (preset === 'ultra') {
      return {
        gpuQualityPreset: 'ultra',
        gpuPostProcessing: true,
        gpuShadowQuality: 'pcf_soft',
        gpuTextureFilter: 'trilinear_aniso',
        gpuAnisotropy: 16,
        gpuBloomEnabled: true,
        gpuBloomStrength: 0.34,
        gpuSsaoEnabled: true,
        gpuSharpenAmount: 0.32,
      };
    }
    return {
      gpuQualityPreset: 'high',
      gpuPostProcessing: true,
      gpuShadowQuality: 'pcf_soft',
      gpuTextureFilter: 'trilinear_aniso',
      gpuAnisotropy: 8,
      gpuBloomEnabled: true,
      gpuBloomStrength: 0.28,
      gpuSsaoEnabled: true,
      gpuSharpenAmount: 0.24,
    };
  }

  public updateSettings(newSettings: CapyGameSettings) {
    this.settings = newSettings;
    this.camera.fov = newSettings.fov || 58;
    this.camera.updateProjectionMatrix();
    this.applyFogSetting();
    this.gpuEngine?.applyConfig(this.buildGpuConfigFromSettings(newSettings));
    if (!newSettings.autoCapyLod && newSettings.manualCapyLodTier !== undefined) {
      this.applyGlobalCapyLodTier(newSettings.manualCapyLodTier);
    }
    if (
      this.worldEnv &&
      (this.cosmicStage === 'playing' || this.cosmicStage === 'capy_selection')
    ) {
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
        this.settings.worldFogEnabled,
        this.homePool?.lanternLight,
        exposureScale
      );
      this.updateBioluminescentNightGlow();
    }
    this.emitTelemetry();
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

    // Photorealistic Clearcoat Specular Ocean spanning the archipelago with dual-octave Gerstner normal maps
    const waterNormal = RealisticWorldEnvironment.getWaterRippleTexture();
    const waterNorms = PbrTextureSynthesizer.getWaterNormalMaps();
    const oceanGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.CylinderGeometry(355, 355, 0.6, 64)
    );
    const oceanMat = new THREE.MeshPhysicalMaterial({
      color: 0x0369a1,
      roughness: 0.08,
      metalness: 0.18,
      clearcoat: this.isSoftwareGl ? 0.0 : 1.0,
      clearcoatRoughness: 0.06,
      normalMap: waterNorms.primary,
      normalScale: new THREE.Vector2(0.62, 0.62),
      clearcoatNormalMap: waterNorms.secondary,
      clearcoatNormalScale: new THREE.Vector2(0.42, 0.42),
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.set(0, -1.25, 0);
    ocean.receiveShadow = true;
    ocean.userData.ignoreCameraFade = true;
    this.oceanMesh = ocean;
    this.worldBaseGroup.add(ocean);

    // 4 Wide Walkable Grand Promenade Causeways (9.6m wide) directly connecting Sanctuary (0,0)
    // to Spore Lagoon (-75,-75), Yuzu Breakout (+75,-75), Number Stampede (-75,+75) & Yuzu Mountain (+75,+75)
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
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
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
      deck.position.set(0, -0.2, 0);
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
        side: THREE.DoubleSide,
      })
    );
    lagoonRim.rotation.x = -Math.PI / 2;
    lagoonRim.position.set(ZONE_LOCATIONS.spore.x, -0.02, ZONE_LOCATIONS.spore.z);
    lagoonRim.receiveShadow = true;
    lagoonRim.userData.ignoreCameraFade = true;
    this.worldBaseGroup.add(lagoonRim);

    // Breakout Open South Forecourt Apron (+75, -60) connecting NE Causeway into the Breakout baseline
    const breakoutApron = new THREE.Mesh(
      PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(18.4, 0.44, 9.6)),
      promenadeDeckMat
    );
    breakoutApron.position.set(
      ZONE_LOCATIONS.breakout.x,
      -0.24,
      ZONE_LOCATIONS.breakout.z + 15.2
    );
    breakoutApron.receiveShadow = true;
    breakoutApron.userData.ignoreCameraFade = true;
    this.worldBaseGroup.add(breakoutApron);

    // Number Stampede North Forecourt, Side Return Boardwalks & South Turnaround Deck (-75, +75)
    const runnerForecourt = new THREE.Mesh(
      PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(16.8, 0.44, 14.0)),
      promenadeDeckMat
    );
    runnerForecourt.position.set(
      ZONE_LOCATIONS.runner.x,
      -0.24,
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
        -0.2,
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
      -0.24,
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
    if (mode !== 'sanctuary' && this.placementGhost.active) {
      this.cancelBuildingPlacementGhost();
    }
    const prevWorldPos = this.heroCapy.position.clone();
    this.currentMode = mode;
    this.physicsBridge?.setActiveDistrict(mode);

    // Keep all 5 game zones permanently active & visible in the same contiguous world!
    this.sanctuaryGroup.visible = true;
    this.sporeGroup.visible = true;
    this.breakoutGroup.visible = true;
    this.runnerGroup.visible = true;
    this.fallGuysGroup.visible = true;
    if (this.seamlessUniverse) {
      this.seamlessUniverse.forestGroveGroup.visible = !this.isSoftwareGl;
    }

    this.heroVelocity.set(0, 0, 0);
    this.pointerTargetX = null;
    this.heroCapy.scale.setScalar(1.0);
    this.heroCapy.visible = true;
    this.portalCooldown = 2.0;

    if (mode === 'sanctuary') {
      this.heroLocalPos.set(0, 0, 4);
      this.heroYaw = Math.PI;
      this.scene.background = new THREE.Color(this.activeBiome?.skyHex ?? 0x38bdf8);
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
      this.scene.background = new THREE.Color(0x0ea5e9);
      this.resetSporeGame();
      this.callbacks.onModeNotification?.(
        'Moved to Spore Lagoon (-75, -75) • Eat Yuzu Plankton & DNA Helixes to grow!'
      );
    } else if (mode === 'breakout') {
      this.heroLocalPos.set(0, 0.5, 10.6);
      this.heroYaw = Math.PI;
      this.scene.background = new THREE.Color(0x1e293b);
      this.resetBreakoutGame(true);
      this.callbacks.onModeNotification?.(
        'Moved to Yuzu Breakout (+75, -75) • Steer the paddle to smash crystal waves!'
      );
    } else if (mode === 'runner') {
      this.heroLocalPos.set(0, 0, 0);
      this.heroYaw = Math.PI;
      this.scene.background = new THREE.Color(0x38bdf8);
      this.resetRunnerGame();
      this.callbacks.onModeNotification?.(
        'Moved to Number Stampede (-75, +75) • Steer through + and × gates to multiply your herd!'
      );
    } else if (mode === 'fallguys') {
      this.heroLocalPos.set(0, 0.6, 0);
      this.heroYaw = Math.PI;
      this.scene.background = new THREE.Color(0x60a5fa);
      this.resetFallGuysGame(false);
      this.callbacks.onModeNotification?.(
        'Moved to Yuzu Mountain (+75, +75) • Race rival Capys past hammers & see-saws to the Crown!'
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
    if (this.cosmicStage === 'playing' && !this.isSoftwareGl) {
      this.tick(0.016);
    }
  }

  private snapCameraToCurrentZone() {
    const zone = ZONE_LOCATIONS[this.currentMode];
    const wx = zone.x + this.heroLocalPos.x;
    const wy = this.heroLocalPos.y;
    const wz = zone.z + this.heroLocalPos.z;
    const distScale = this.settings.cameraDistance || 1.0;

    if (this.currentMode === 'breakout') {
      this.camera.position.set(zone.x, 17.5 * distScale, zone.z + 15.5 * distScale);
      this.camera.lookAt(zone.x, 0, zone.z - 1.5);
    } else if (this.currentMode === 'runner') {
      this.camera.position.set(wx, wy + 5.8 * distScale, wz + 10.2 * distScale);
      this.camera.lookAt(wx, wy + 1.2, wz - 12);
    } else if (this.settings.cameraFollowBehind) {
      const camDist = 11.5 * distScale;
      const camHeight = 6.8 * distScale;
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
      this.camera.position.set(wx, wy + 7.5 * distScale, wz + 12.0 * distScale);
      this.camera.lookAt(wx, wy + 1.0, wz - 2);
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
    return (1 + upgBonus + speedBonus) * heroSpeed;
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
    this.cosmicStage = stage;
    this.seamlessZoomActive = false;
    this.autoZoomDirection = 0;
    if (this.seamlessUniverse) {
      this.seamlessUniverse.hide();
      this.seamlessUniverse.forestGroveGroup.visible =
        stage === 'playing' && this.currentMode === 'sanctuary' && !this.isSoftwareGl;
    }
    if (this.cosmicBuilder) {
      this.cosmicBuilder.rootGroup.visible = true;
    }
    if (this.camera.near !== 0.1 || this.camera.far !== 1350) {
      this.camera.near = 0.1;
      this.camera.far = 1350;
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

    const isSurfaceStage = stage === 'capy_selection' || stage === 'playing';

    this.worldBaseGroup.visible = isSurfaceStage;
    this.sanctuaryGroup.visible = isSurfaceStage;
    this.sporeGroup.visible = isSurfaceStage;
    this.breakoutGroup.visible = isSurfaceStage;
    this.runnerGroup.visible = isSurfaceStage;
    this.fallGuysGroup.visible = isSurfaceStage;

    this.selectableCapyGroup.visible = stage === 'capy_selection';
    this.heroCapy.visible = stage === 'playing';
    this.syncDachshundVisibility();

    if (stage === 'singularity') {
      this.scene.background = new THREE.Color(0x000000);
      this.cosmicCamPos.set(0, 0, 26);
      this.cosmicCamLook.set(0, 0, 0);
      this.camera.position.copy(this.cosmicCamPos);
      this.camera.lookAt(this.cosmicCamLook);
    } else if (stage === 'big_bang') {
      this.scene.background = new THREE.Color(0x020617);
      this.cosmicOrbitYaw = 0.16;
      this.cosmicOrbitPitch = 0.24;
      this.cosmicZoomMultiplier = 1.0;
      this.cosmicCamPos.set(0, 26, 128);
      this.cosmicCamLook.set(0, 0, 0);
    } else if (stage === 'universe_flight') {
      this.scene.background = new THREE.Color(0x020617);
      this.cosmicOrbitYaw = 0;
      this.cosmicOrbitPitch = 0.25;
      this.cosmicZoomMultiplier = 1.0;
      this.cosmicCamPos.set(0, 32, 155);
      this.cosmicCamLook.set(0, 0, 0);
    } else if (stage === 'galaxy_view') {
      this.scene.background = new THREE.Color(0x030712);
      this.cosmicBuilder.populateGalaxyView(this.selectedGalaxyIndex);
      this.cosmicOrbitYaw = 0;
      this.cosmicOrbitPitch = 0.38;
      this.cosmicCamPos.set(0, 26, 68);
      this.cosmicCamLook.set(0, 0, 0);
    } else if (stage === 'star_system_view') {
      this.scene.background = new THREE.Color(0x030712);
      this.cosmicBuilder.populateStarSystemView(this.selectedGalaxyIndex, this.selectedStarIndex);
      this.cosmicOrbitYaw = 0;
      this.cosmicOrbitPitch = 0.42;
      this.cosmicCamPos.set(0, 28, 66);
      this.cosmicCamLook.set(0, 0, 0);
    } else if (stage === 'planet_orbit') {
      this.scene.background = new THREE.Color(0x020617);
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
    } else if (stage === 'capy_selection') {
      this.scene.background = new THREE.Color(this.activeBiome.skyHex);
      this.camera.position.set(0, 4.2, 9.8);
      this.camera.lookAt(0, 0.9, -1.0);
    } else if (stage === 'playing') {
      this.scene.background = new THREE.Color(
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
    this.selectedStarIndex = THREE.MathUtils.clamp(index, 0, galaxy.starSystems.length - 1);
    this.selectedPlanetIndex = 0;
    this.selectedLandingIndex = 0;
    AudioService.playCosmicWarp(1.25);
    this.setCosmicStage('star_system_view');
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

  public selectCapyHero(index: number, confirmAndPlay: boolean = false) {
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
      { tier: 2, x: -2.2, z: 15.6, matchesHead: false, altOffset: 3 },
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
        rotY: Math.atan2(-1, -1),
      },
      {
        mode: 'breakout',
        title: 'BREAKOUT',
        sub: 'NE CAUSEWAY',
        color: 0x3b82f6,
        accent: '#60a5fa',
        x: 20.5,
        z: -20.5,
        rotY: Math.atan2(54.5, -39.0),
      },
      {
        mode: 'runner',
        title: 'STAMPEDE',
        sub: 'SW CAUSEWAY',
        color: 0xf59e0b,
        accent: '#fbbf24',
        x: -20.5,
        z: 20.5,
        rotY: Math.atan2(-54.5, 61.0),
      },
      {
        mode: 'fallguys',
        title: 'PARKOUR',
        sub: 'SE CAUSEWAY',
        color: 0xec4899,
        accent: '#f472b6',
        x: 20.5,
        z: 20.5,
        rotY: Math.atan2(54.5, 60.0),
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

    // Instanced textured river pebbles & meadow wildflowers placed strictly outside Pool, Trees & Portals
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
    const colorHelper = new THREE.Color();

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
      colorHelper.setHex(palette[placedPebbles % palette.length]);
      instancedDecor.setColorAt(placedPebbles, colorHelper);
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

    // Ambient wandering Capybara buddies (spawned at guaranteed non-clipping meadow clearings!)
    const skins = ['classic', 'golden', 'sakura', 'matcha'];
    const hats = ['flower', 'yuzu', 'party', 'crown'];
    const buddySpawns: Array<[number, number]> = [
      [11.8, 12.2],
      [17.5, -1.8],
      [7.8, 16.5],
      [-15.5, 16.2],
      [-21.5, 6.2],
      [18.8, 8.8],
    ];
    for (let i = 0; i < 6; i++) {
      const buddy = CapyModelGenerator.createCapybara(
        hats[i % hats.length],
        0.84,
        skins[i % skins.length],
        [],
        this.currentCapyLodTier
      );
      const [bx, bz] = buddySpawns[i];
      buddy.position.set(bx, 0, bz);
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
    // Stay safely inside meadow shoreline & clear of Hero spawn (0, 4)
    if (Math.hypot(x, z) > 29.5 - buildingRadius) return false;
    if (Math.hypot(x - 0, z - 4.0) < buildingRadius + 1.8) return false;

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
    toRemove.forEach((c) => this.sanctuaryGroup.remove(c));
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
    this.syncWorldPhysicsColliders();
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
    // Breakout Stadium Left, Right & North Crystal Rebound Walls (+75, -75)
    const bz = ZONE_LOCATIONS.breakout;
    boxes.push(
      {
        id: 'breakout_wall_l',
        wx: bz.x - 8.6,
        wy: 0.8,
        wz: bz.z,
        halfX: 0.4,
        halfY: 0.9,
        halfZ: 11.5,
        restitution: 0.95,
        friction: 0.05,
        kind: 'wall',
      },
      {
        id: 'breakout_wall_r',
        wx: bz.x + 8.6,
        wy: 0.8,
        wz: bz.z,
        halfX: 0.4,
        halfY: 0.9,
        halfZ: 11.5,
        restitution: 0.95,
        friction: 0.05,
        kind: 'wall',
      },
      {
        id: 'breakout_wall_top',
        wx: bz.x,
        wy: 0.8,
        wz: bz.z - 11.6,
        halfX: 9.0,
        halfY: 0.9,
        halfZ: 0.4,
        restitution: 0.95,
        friction: 0.05,
        kind: 'wall',
      }
    );

    this.physicsBridge.syncStaticWorldColliders(circles, boxes, softPads);
  }

  public getPhysicsTelemetry(): PhysicsEngineTelemetry {
    return this.physicsBridge.getTelemetry();
  }

  public getGpuEngineTelemetry(): GpuEngineTelemetry {
    return this.gpuEngine.getTelemetry();
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

    this.resetSporeGame();
  }

  private resetSporeGame() {
    this.sporeMass = 10 + (this.stats.evolutionStage - 1) * 5;
    this.sporeDnaEarned = 0;

    this.sporeOrbs.forEach((o) => this.sporeGroup.remove(o.mesh));
    this.sporeOrbs = [];
    this.sporeCritters.forEach((c) => this.sporeGroup.remove(c.mesh));
    this.sporeCritters = [];

    for (let i = 0; i < 28; i++) {
      this.spawnSporeOrb();
    }

    const skins = ['matcha', 'sakura', 'cosmic', 'golden'];
    for (let i = 0; i < 8; i++) {
      const scale = 0.55 + (i % 4) * 0.32;
      const critter = CapyModelGenerator.createCapybara(
        i % 2 === 0 ? 'flower' : 'yuzu',
        scale,
        skins[i % skins.length],
        ['flippers']
      );
      const angle = (i / 8) * Math.PI * 2;
      const rad = 8 + Math.random() * 18;
      critter.position.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad);
      this.sporeGroup.add(critter);
      this.sporeCritters.push({
        mesh: critter,
        scale,
        vel: new THREE.Vector3((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5),
        changeDirTimer: 2 + Math.random() * 3,
      });
    }
  }

  private spawnSporeOrb() {
    const isDna = Math.random() > 0.62;
    const mesh = new THREE.Mesh(
      isDna
        ? new THREE.OctahedronGeometry(0.38, 1)
        : new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({
        color: isDna ? 0x38bdf8 : 0xfacc15,
        emissive: isDna ? 0x0284c7 : 0xca8a04,
        emissiveIntensity: 0.55,
        roughness: 0.2,
      })
    );
    const angle = Math.random() * Math.PI * 2;
    const rad = 2 + Math.random() * 30;
    mesh.position.set(Math.cos(angle) * rad, 0.45, Math.sin(angle) * rad);
    this.sporeGroup.add(mesh);
    this.sporeOrbs.push({
      mesh,
      isDna,
      value: isDna ? 3 : 5,
    });
  }

  // ============================================================================
  // 3. YUZU BREAKOUT (AT WORLD +75, -75)
  // ============================================================================
  private buildBreakout() {
    const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');
    const timberTex = RealisticWorldEnvironment.getTextureSet('timber');
    const arenaMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      map: basaltTex.albedo,
      normalMap: basaltTex.normal,
      normalScale: new THREE.Vector2(0.84, 0.84),
      roughnessMap: basaltTex.roughness,
      aoMap: basaltTex.ao,
      aoMapIntensity: 0.76,
      roughness: 0.42,
      metalness: 0.52,
    });

    const floorGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.BoxGeometry(16.8, 0.4, 23)
    );
    const floor = new THREE.Mesh(floorGeo, arenaMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    floor.userData.ignoreCameraFade = true;
    this.breakoutGroup.add(floor);

    const wallSideGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.BoxGeometry(0.8, 1.8, 23)
    );
    const wallL = new THREE.Mesh(wallSideGeo, arenaMat);
    wallL.position.set(-8.6, 0.8, 0);
    this.breakoutGroup.add(wallL);

    const wallR = wallL.clone();
    wallR.position.x = 8.6;
    this.breakoutGroup.add(wallR);

    const wallTopGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.BoxGeometry(18.0, 1.8, 0.8)
    );
    const wallTop = new THREE.Mesh(wallTopGeo, arenaMat);
    wallTop.position.set(0, 0.8, -11.6);
    this.breakoutGroup.add(wallTop);

    const paddleGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
      new THREE.BoxGeometry(3.8, 0.8, 0.9)
    );
    const paddleMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      map: timberTex.albedo,
      normalMap: timberTex.normal,
      normalScale: new THREE.Vector2(0.68, 0.68),
      roughnessMap: timberTex.roughness,
      aoMap: timberTex.ao,
      roughness: 0.28,
      metalness: 0.4,
    });
    this.breakoutPaddle = new THREE.Mesh(paddleGeo, paddleMat);
    this.breakoutPaddle.position.set(0, 0.5, 9.2);
    this.breakoutPaddle.castShadow = true;
    this.breakoutPaddle.userData.ignoreCameraFade = true;
    this.breakoutGroup.add(this.breakoutPaddle);

    const paddleCapy = CapyModelGenerator.createCapybara('yuzu', 0.58);
    paddleCapy.position.set(0, 0.42, 0);
    paddleCapy.rotation.y = Math.PI;
    this.breakoutPaddle.add(paddleCapy);

    this.resetBreakoutGame(true);
  }

  private spawnBreakoutBall(x: number, z: number, vx: number, vz: number) {
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffbb00,
        roughness: 0.15,
        metalness: 0.3,
        emissive: 0x78350f,
      })
    );
    ballMesh.position.set(x, 0.5, z);
    ballMesh.castShadow = true;
    this.breakoutGroup.add(ballMesh);
    this.breakoutBalls.push({
      mesh: ballMesh,
      vel: new THREE.Vector3(vx, 0, vz),
      active: true,
    });
  }

  private resetBreakoutGame(fullReset: boolean = false) {
    if (fullReset) {
      this.breakoutScore = 0;
      this.breakoutWave = 1;
      this.breakoutCombo = 1;
    }

    this.breakoutBlocks.forEach((b) => this.breakoutGroup.remove(b.mesh));
    this.breakoutBlocks = [];
    this.breakoutBalls.forEach((b) => this.breakoutGroup.remove(b.mesh));
    this.breakoutBalls = [];
    this.breakoutPowerups.forEach((p) => this.breakoutGroup.remove(p.mesh));
    this.breakoutPowerups = [];

    const speedScale = 1 + (this.breakoutWave - 1) * 0.08;
    this.spawnBreakoutBall(0, 6.5, 4.2 * speedScale, -9.2 * speedScale);

    const blockColors = [0xef4444, 0xf97316, 0xeab308, 0x10b981, 0x06b6d4, 0x8b5cf6];
    const rows = Math.min(7, 4 + Math.floor(this.breakoutWave / 2));
    const cols = 7;
    const blockW = 2.0;
    const blockD = 0.95;
    const startX = -((cols - 1) * blockW) / 2;
    const startZ = -9.5;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.breakoutWave % 2 === 0 && (r + c) % 5 === 0) continue;
        const isBonus = (r === 0 && c === 3) || Math.random() > 0.86;
        const hp = isBonus ? 2 : 1;
        const mat = new THREE.MeshStandardMaterial({
          color: isBonus ? 0xfacc15 : blockColors[r % blockColors.length],
          roughness: 0.22,
          metalness: isBonus ? 0.75 : 0.3,
        });
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(blockW - 0.18, 0.7, blockD - 0.18),
          mat
        );
        block.position.set(startX + c * blockW, 0.5, startZ + r * blockD);
        block.castShadow = true;
        this.breakoutGroup.add(block);
        this.breakoutBlocks.push({ mesh: block, hp, isBonus });
      }
    }
  }

  // ============================================================================
  // 4. NUMBER RUNNER STAMPEDE (AT WORLD -75, +75)
  // ============================================================================
  private buildRunner() {
    this.resetRunnerGame();
  }

  private resetRunnerGame() {
    this.runnerDistance = 0;
    this.runnerCapyCount =
      this.stats.upgrades.herdSize + (this.activeHeroSpec?.herdBonus ?? 0);

    this.runnerTrackSegments.forEach((s) => this.runnerGroup.remove(s));
    this.runnerTrackSegments = [];
    this.runnerGates.forEach((g) => this.runnerGroup.remove(g.mesh));
    this.runnerGates = [];
    this.runnerHerdMeshes.forEach((m) => this.runnerGroup.remove(m));
    this.runnerHerdMeshes = [];

    for (let i = 0; i < 4; i++) {
      this.spawnRunnerTrackSegment(-i * 24);
    }

    this.syncRunnerHerdVisuals();
  }

  private syncRunnerHerdVisuals() {
    const desiredVisualCount = Math.min(22, Math.max(0, this.runnerCapyCount - 1));
    while (this.runnerHerdMeshes.length < desiredVisualCount) {
      const idx = this.runnerHerdMeshes.length;
      const mini = CapyModelGenerator.createCapybara(
        idx % 3 === 0 ? 'yuzu' : 'flower',
        0.58,
        idx % 4 === 0 ? 'golden' : 'classic'
      );
      mini.rotation.y = Math.PI;
      mini.userData.ignoreCameraFade = true;
      this.runnerGroup.add(mini);
      this.runnerHerdMeshes.push(mini);
    }
    while (this.runnerHerdMeshes.length > desiredVisualCount) {
      const removed = this.runnerHerdMeshes.pop()!;
      this.runnerGroup.remove(removed);
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

    if (Math.abs(zPos) > 16) {
      this.spawnRunnerGatePair(zPos);
    }
  }

  private spawnRunnerGatePair(zPos: number) {
    const sides = [-2.1, 2.1];
    for (const xPos of sides) {
      const roll = Math.random();
      let type: 'add' | 'multiply' | 'sub' = 'add';
      let value = Math.floor(Math.random() * 7) + 3;
      if (roll > 0.62) {
        type = 'multiply';
        value = Math.random() > 0.7 ? 3 : 2;
      } else if (roll < 0.18 && xPos > 0) {
        type = 'sub';
        value = Math.floor(Math.random() * 4) + 2;
      }

      const labelText =
        type === 'multiply' ? `×${value}` : type === 'add' ? `+${value}` : `-${value}`;
      const subText =
        type === 'multiply' ? 'MULTIPLY HERD' : type === 'add' ? 'ADD CAPYS' : 'HAZARD';
      const bgHex =
        type === 'multiply' ? '#065f46' : type === 'add' ? '#1e3a8a' : '#7f1d1d';
      const accentHex =
        type === 'multiply' ? '#34d399' : type === 'add' ? '#60a5fa' : '#f87171';

      const gateGroup = new THREE.Group();
      gateGroup.position.set(xPos, 0, zPos);

      const bannerTex = CapyModelGenerator.createTextBannerTexture(
        labelText,
        subText,
        bgHex,
        accentHex
      );
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 2.5, 0.18),
        new THREE.MeshBasicMaterial({ map: bannerTex })
      );
      panel.position.set(0, 1.4, 0);
      gateGroup.add(panel);

      this.runnerGroup.add(gateGroup);
      this.runnerGates.push({
        mesh: gateGroup,
        type,
        value,
        z: zPos,
        triggered: false,
      });
    }
  }

  // ============================================================================
  // 5. FALL GUYS CHAOS PARKOUR (AT WORLD +75, +75)
  // ============================================================================
  private buildFallGuys() {
    this.resetFallGuysGame(true);
  }

  private resetFallGuysGame(resetRound: boolean = false) {
    if (resetRound) {
      this.fallGuysCrowns = 0;
      this.fallGuysRound = 1;
    }

    while (this.fallGuysGroup.children.length > 0) {
      this.fallGuysGroup.remove(this.fallGuysGroup.children[0]);
    }
    this.spinningObstacles = [];
    this.seeSaws = [];
    this.fallGuysRivals = [];

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
      this.spinningObstacles.push({
        mesh: bar,
        speed: (zOff === -12 ? 1 : -1) * (2.2 + this.fallGuysRound * 0.25),
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
        speed: 5.8 + Math.random() * 2.4,
        laneOffset: laneX,
        vy: 0,
      });
    }
  }

  // ============================================================================
  // DYNAMIC 60 FPS CAPYBARA DETAIL GOVERNOR & DACHSHUND-SNAKE SPINE ENGINE
  // ============================================================================
  public getCapyLodTier(): CapyLodTier {
    return this.currentCapyLodTier;
  }

  public getMouthMaxFruitRadius(): number {
    // Starts at 0.40m (40cm: fits Tier 0 [24cm] & Tier 1 [35.5cm], blocks Tier 2 [52.6cm], Tier 3 [77.8cm], Tier 4 [115.2cm])
    // Widens logarithmically as your Capybara grows from eating smaller fruits!
    return +(0.40 * (1 + 0.48 * Math.log(1 + this.eatenFruitMass))).toFixed(3);
  }

  public syncLogarithmicBodyLength(silent: boolean = false) {
    this.fruitsCarried = Math.max(1, this.fruitsCarried);
    if (this.fruitsCarried === 1) {
      this.eatenFruitMass = 0;
    }

    // Strict logarithmic scaling: L(m) = L0 + k * ln(1 + eatenFruitMass)
    this.logarithmicLengthMeters = +(
      1.65 +
      2.15 * Math.log(1 + Math.max(0, this.eatenFruitMass))
    ).toFixed(2);

    const targetSegments = Math.max(
      1,
      Math.min(
        MAX_DACHSHUND_SEGMENTS,
        1 + Math.round(2.85 * Math.log(1 + Math.max(0, this.eatenFruitMass)))
      )
    );

    if (targetSegments > this.snakeSegmentCount) {
      this.growDachshundBody(targetSegments - this.snakeSegmentCount, true);
    } else if (targetSegments < this.snakeSegmentCount) {
      this.snakeSegmentCount = targetSegments;
      for (let i = targetSegments; i < this.dachshundSegments.length; i++) {
        this.dachshundSegments[i].visible = false;
      }
    }

    CapyModelGenerator.setHeadFruitStackCount(this.heroCapy, this.fruitsCarried);

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
   * Feeds a live or simulated FPS measurement into the 60 FPS Capybara LOD governor.
   * Scales Capybara anatomical & bristle-fur detail down if FPS dips below 55, and
   * scales detail back up toward Tier 3 (Ultra) when smooth ~60 FPS headroom holds.
   */
  public ingestFpsSample(fpsSample: number, stepSeconds: number = 0.4) {
    const clampedFps = THREE.MathUtils.clamp(fpsSample, 15, 144);
    this.rollingFps = this.rollingFps * 0.78 + clampedFps * 0.22;

    if (this.settings.autoCapyLod === false) {
      return;
    }

    this.lodGovernorAccum += stepSeconds;
    if (this.lodGovernorAccum < 0.35) return;
    this.lodGovernorAccum = 0;

    if (this.rollingFps < 55.0) {
      this.lodLowFpsStreak++;
      this.lodHighFpsStreak = 0;
      if (this.lodLowFpsStreak >= 1 && this.currentCapyLodTier > 0) {
        const nextTier = (this.currentCapyLodTier - 1) as CapyLodTier;
        this.applyGlobalCapyLodTier(nextTier);
      }
    } else if (this.rollingFps >= 58.0) {
      this.lodHighFpsStreak++;
      this.lodLowFpsStreak = 0;
      if (this.lodHighFpsStreak >= 2 && this.currentCapyLodTier < 3) {
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
    if (this.heroCapy?.userData?.rearAssemblyGroup) {
      this.heroCapy.userData.rearAssemblyGroup.visible = !activeInSanctuary;
    }
  }

  private syncDachshundSkinAndOrange() {
    const variety =
      HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex] ?? HEAD_ORANGE_VARIETIES[0];
    CapyModelGenerator.setHeadOrangeColor(
      this.heroCapy,
      variety.colorHex,
      variety.emissiveHex
    );

    const furColor =
      CapyModelGenerator.skinColors[this.stats.activeSkin] ??
      CapyModelGenerator.skinColors.classic;

    CapyModelGenerator.updateCapyAppearance(
      this.heroCapy,
      this.stats.activeHat,
      this.stats.activeSkin,
      this.stats.activeMutations,
      variety.colorHex
    );
    CapyModelGenerator.setHeadFruitStackCount(this.heroCapy, this.fruitsCarried);

    const heroBodyMat = (this.heroCapy.getObjectByName('capyBody') as THREE.Mesh | undefined)
      ?.material as THREE.MeshStandardMaterial | undefined;

    for (let i = 0; i < this.dachshundSegments.length; i++) {
      const seg = this.dachshundSegments[i];
      if (seg.userData.riderOrangeMat) {
        seg.userData.riderOrangeMat.color.setHex(variety.colorHex);
      }
      seg.userData.bodyMat.roughness = this.stats.activeSkin === 'golden' ? 0.45 : 0.84;
      seg.userData.bodyMat.metalness = this.stats.activeSkin === 'golden' ? 0.38 : 0.04;
      if (heroBodyMat?.map) {
        seg.userData.bodyMat.map = heroBodyMat.map;
        seg.userData.bodyMat.needsUpdate = true;
      }
    }
    if (this.dachshundCaboose && heroBodyMat?.map && furColor) {
      this.dachshundCaboose.userData.bodyMat.map = heroBodyMat.map;
      this.dachshundCaboose.userData.bodyMat.roughness =
        this.stats.activeSkin === 'golden' ? 0.45 : 0.84;
      this.dachshundCaboose.userData.bodyMat.metalness =
        this.stats.activeSkin === 'golden' ? 0.38 : 0.04;
      this.dachshundCaboose.userData.bodyMat.needsUpdate = true;
    }

    // Re-tint the 5 Exponential Matching Trees to match the hero's Head Orange variety,
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
        const linkDist = prevNode === 0 ? 0.56 : DACHSHUND_SEGMENT_SPACING;
        const nodeIdx = segIdx + 1;
        this.spineX[nodeIdx] = prevX - Math.sin(prevYaw) * linkDist;
        this.spineY[nodeIdx] = prevY;
        this.spineZ[nodeIdx] = prevZ - Math.cos(prevYaw) * linkDist;
        this.spineYaw[nodeIdx] = prevYaw;

        const cabNode = this.snakeSegmentCount + 1;
        this.spineX[cabNode] = this.spineX[nodeIdx] - Math.sin(prevYaw) * 0.54;
        this.spineY[cabNode] = prevY;
        this.spineZ[cabNode] = this.spineZ[nodeIdx] - Math.cos(prevYaw) * 0.54;
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

    // Reuse an inactive fruit slot or recycle the oldest non-pond fruit if pool is full
    let slot: PhysicsFruit | null = null;
    for (let i = 0; i < this.physicsFruits.length; i++) {
      if (!this.physicsFruits[i].active) {
        slot = this.physicsFruits[i];
        break;
      }
    }

    if (!slot && this.physicsFruits.length >= MAX_PHYSICS_FRUITS) {
      // Prefer recycling an old ground fruit rather than a pond fruit
      slot =
        this.physicsFruits.find((f) => !f.inPond) ?? this.physicsFruits[0];
      this.fruitsGroup.remove(slot.mesh);
    }

    const mesh = CapyModelGenerator.createCollectibleOrange(v.colorHex, v.emissiveHex, radius);
    mesh.position.set(x, y, z);
    mesh.userData.__occluderRoot = mesh;
    this.fruitsGroup.add(mesh);

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
      slot.bobPhase = Math.random() * Math.PI * 2;
      slot.mesh = mesh;
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
      bobPhase: Math.random() * Math.PI * 2,
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
        n === 1 ? 0.56 : n === totalNodes - 1 ? 0.54 : DACHSHUND_SEGMENT_SPACING;
      accumDist += linkLen;
      this.spineX[n] = this.heroLocalPos.x + backX * accumDist;
      this.spineY[n] = this.heroLocalPos.y;
      this.spineZ[n] = this.heroLocalPos.z + backZ * accumDist;
      this.spineYaw[n] = this.heroYaw;
    }
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
   * Biomechanical 2-joint quadruped limb animation:
   * - Stance phase (sin(phase) <= 0): foot stays planted flat while hip sweeps opposite walkDir to propel body.
   * - Swing phase (sin(phase) > 0): knee/carpus flexes (`lowerJoint`) to lift paw clear off ground while hip protracts!
   * - Reverses kinematics cleanly when `walkDir === -1` (walking backwards).
   */
  private animateArticulatedLimb(
    limbRoot: THREE.Group,
    phase: number,
    walkDir: 1 | -1 = 1,
    hipAmp: number = 0.36
  ) {
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const lowerJoint = limbRoot.userData?.lowerJoint as THREE.Group | undefined;
    const pawGroup = limbRoot.userData?.pawGroup as THREE.Group | undefined;

    if (s > 0) {
      // Swing phase: lift paw clear of ground and protract limb in walkDir
      const hipAngle = walkDir * c * hipAmp;
      const kneeFlex = -walkDir * s * 0.64;
      limbRoot.rotation.x = hipAngle;
      if (lowerJoint) lowerJoint.rotation.x = kneeFlex;
      if (pawGroup) pawGroup.rotation.x = -(hipAngle + kneeFlex) * 0.55;
    } else {
      // Stance phase: plant sole flat on ground and sweep rearward against ground for traction
      const hipAngle = walkDir * c * hipAmp * 0.88;
      const kneeBrace = -0.03 * s;
      limbRoot.rotation.x = hipAngle;
      if (lowerJoint) lowerJoint.rotation.x = kneeBrace;
      if (pawGroup) pawGroup.rotation.x = -(hipAngle + kneeBrace);
    }
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
    walkDir: 1 | -1 = 1
  ) {
    if (!this.spineInitialized) {
      this.resetDachshundTrail();
    }

    // Apply spine positions, yaws, slight solid squash (<= 6%), and articulated 2-joint leg gaits
    for (let i = 0; i < this.dachshundSegments.length; i++) {
      const seg = this.dachshundSegments[i];
      if (i >= this.snakeSegmentCount) {
        seg.visible = false;
        continue;
      }
      seg.visible = true;
      const nodeIdx = i + 1;
      seg.position.set(this.spineX[nodeIdx], this.spineY[nodeIdx], this.spineZ[nodeIdx]);
      seg.rotation.y = this.spineYaw[nodeIdx];

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
        seg.userData.walkCycle += dt * 14;
        const segPhase = this.heroCapy.userData.walkCycle - (i + 1) * 0.85;
        this.animateArticulatedLimb(seg.userData.midLegL, segPhase, walkDir, 0.35);
        this.animateArticulatedLimb(
          seg.userData.midLegR,
          segPhase + Math.PI,
          walkDir,
          0.35
        );
      } else {
        this.resetArticulatedLimb(seg.userData.midLegL);
        this.resetArticulatedLimb(seg.userData.midLegR);
      }
    }

    // Position Hindquarters Caboose at spine node N + 1 with coordinated forward/reverse rear gait
    if (this.dachshundCaboose) {
      const cabNode = this.snakeSegmentCount + 1;
      this.dachshundCaboose.position.set(
        this.spineX[cabNode],
        this.spineY[cabNode],
        this.spineZ[cabNode]
      );
      this.dachshundCaboose.rotation.y = this.spineYaw[cabNode];

      const lastIdx = Math.max(0, this.snakeSegmentCount - 1);
      const cSy = 1 - (this.segSoftSquash[lastIdx] || 0) * 0.85;
      const cSxz = 1 / Math.sqrt(Math.max(0.85, cSy));
      this.dachshundCaboose.scale.set(cSxz, cSy, cSxz);

      if (isMoving) {
        this.dachshundCaboose.userData.walkCycle += dt * 14;
        const rearPhase = this.heroCapy.userData.walkCycle - (this.snakeSegmentCount + 1) * 0.85;
        this.animateArticulatedLimb(
          this.dachshundCaboose.userData.legBL,
          rearPhase + Math.PI,
          walkDir,
          0.38
        );
        this.animateArticulatedLimb(
          this.dachshundCaboose.userData.legBR,
          rearPhase,
          walkDir,
          0.38
        );
        this.dachshundCaboose.userData.tailGroup.rotation.y =
          Math.sin(this.heroCapy.userData.walkCycle * 1.5) * 0.24;
      } else {
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
      this.currentFrameOccluders.add(m);
      addedAny = true;
    }
    if (addedAny) {
      this.currentFrameOccludedEntities.add(root);
    }
  }

  private prepareMeshForOcclusionFade(mesh: THREE.Mesh) {
    if (mesh.userData.__occluderPrepared) return;
    mesh.userData.__origMaterial = mesh.material;
    if (Array.isArray(mesh.material)) {
      mesh.userData.__occMaterial = mesh.material.map((m) => {
        const occMat = m.clone();
        delete occMat.userData.__occUniforms;
        occMat.userData.__origOpacity = m.opacity;
        installSightlineEdgeFadeShader(occMat);
        return occMat;
      });
    } else if (mesh.material) {
      const orig = mesh.material;
      const occMat = orig.clone();
      delete occMat.userData.__occUniforms;
      occMat.userData.__origOpacity = orig.opacity;
      installSightlineEdgeFadeShader(occMat);
      mesh.userData.__occMaterial = occMat;
    }
    mesh.userData.__occluderPrepared = true;
  }

  private updateMeshOccluderScreenBounds(mesh: THREE.Mesh) {
    const asInstanced = mesh as unknown as THREE.InstancedMesh;
    let bs: THREE.Sphere | null = null;
    if (asInstanced.isInstancedMesh && asInstanced.boundingSphere) {
      bs = asInstanced.boundingSphere;
    } else {
      if (!mesh.geometry.boundingSphere) {
        mesh.geometry.computeBoundingSphere();
      }
      bs = mesh.geometry.boundingSphere;
    }

    if (bs) {
      _occCenterWorld.copy(bs.center);
      mesh.localToWorld(_occCenterWorld);
      const maxScale = Math.max(
        Math.abs(mesh.scale.x),
        Math.abs(mesh.scale.y),
        Math.abs(mesh.scale.z),
        0.001
      );
      const worldRadius = Math.max(0.45, bs.radius * maxScale);
      const camDist = Math.max(0.6, this.camera.position.distanceTo(_occCenterWorld));
      const halfFovRad = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
      const viewHeightWorld =
        (2.0 * camDist * Math.tan(halfFovRad)) / Math.max(0.25, this.camera.zoom);
      const rUv = THREE.MathUtils.clamp(worldRadius / Math.max(0.2, viewHeightWorld), 0.06, 2.0);

      _occProjectedNdc.copy(_occCenterWorld).project(this.camera);
      const cxUv = _occProjectedNdc.x * 0.5 + 0.5;
      const cyUv = _occProjectedNdc.y * 0.5 + 0.5;

      const occMatProp = mesh.userData.__occMaterial ?? mesh.material;
      const mats = Array.isArray(occMatProp) ? occMatProp : [occMatProp];
      for (let i = 0; i < mats.length; i++) {
        const u = mats[i]?.userData?.__occUniforms;
        if (u) {
          u.uCapyOccBounds.value.set(cxUv, cyUv, rUv);
        }
      }
    }
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

      const uniforms = installSightlineEdgeFadeShader(mat);
      const origOpacity =
        (mat.userData.__origOpacity as number | undefined) ?? 1.0;

      const curBlend = uniforms.uCapyOccBlend.value;
      const nextBlend = curBlend + (targetBlend - curBlend) * rate;

      if (targetBlend > 0.5) {
        allRestored = false;
        const snapped = nextBlend > 0.985 ? 1.0 : nextBlend;
        uniforms.uCapyOccBlend.value = snapped;
        mat.opacity = origOpacity;
        mat.userData.__occBlend = snapped;
        mat.userData.__centerScreenOpacity = +(1.0 - snapped).toFixed(4);
        mat.userData.__edgeOutlineMaxOpacity = +THREE.MathUtils.lerp(
          origOpacity,
          0.25,
          snapped
        ).toFixed(4);
      } else if (nextBlend <= 0.015) {
        uniforms.uCapyOccBlend.value = 0.0;
        mat.opacity = origOpacity;
        mat.userData.__occBlend = 0.0;
        mat.userData.__centerScreenOpacity = origOpacity;
        mat.userData.__edgeOutlineMaxOpacity = origOpacity;
      } else {
        allRestored = false;
        uniforms.uCapyOccBlend.value = nextBlend;
        mat.userData.__occBlend = nextBlend;
        mat.userData.__centerScreenOpacity = +(1.0 - nextBlend).toFixed(4);
        mat.userData.__edgeOutlineMaxOpacity = +THREE.MathUtils.lerp(
          origOpacity,
          0.25,
          nextBlend
        ).toFixed(4);
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
    sUvY: number
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
      SHARED_OCCLUDER_HEAD_UV.x,
      SHARED_OCCLUDER_HEAD_UV.y
    );
  }

  public updateHeadLineOfSightTransparency(dt: number) {
    this.currentFrameOccluders.clear();
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

    if (
      this.cosmicStage === 'playing' &&
      this.heroCapy.visible &&
      !this.zoneTransition.active
    ) {
      this.scene.updateMatrixWorld();
      this.heroCapy.userData.head.getWorldPosition(_headWorldPos);
      this.heroCapy.getWorldPosition(_heroTorsoWorldPos);
      _heroTorsoWorldPos.y += 0.35;

      _occProjectedNdc.copy(_headWorldPos).project(this.camera);
      SHARED_OCCLUDER_HEAD_UV.set(
        _occProjectedNdc.x * 0.5 + 0.5,
        _occProjectedNdc.y * 0.5 + 0.5
      );

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
      const headDepth =
        (_headWorldPos.x - camX) * _camForward.x +
        (_headWorldPos.y - camY) * _camForward.y +
        (_headWorldPos.z - camZ) * _camForward.z;
      const torsoDepth =
        (_heroTorsoWorldPos.x - camX) * _camForward.x +
        (_heroTorsoWorldPos.y - camY) * _camForward.y +
        (_heroTorsoWorldPos.z - camZ) * _camForward.z;
      const heroCutDepth = Math.max(headDepth, torsoDepth) - 0.25;

      // Exact 4-plane 3D camera frustum cone constants (catches upper/lower/lateral intrusions & overhanging canopies)
      const halfFovRad = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
      const tanY =
        (Math.tan(halfFovRad) / Math.max(0.25, this.camera.zoom)) * 0.9;
      const cosY = 1 / Math.hypot(1, tanY);
      const sinY = tanY * cosY;
      const tanX = Math.min(
        tanY * Math.max(0.2, this.camera.aspect) * 0.88,
        0.52
      );
      const cosX = 1 / Math.hypot(1, tanX);
      const sinX = tanX * cosX;

      const doesSphereIntrudeForegroundFrustum = (
        wx: number,
        wy: number,
        wz: number,
        radius: number
      ): boolean => {
        const dx = wx - camX;
        const dy = wy - camY;
        const dz = wz - camZ;
        const centerDist = Math.hypot(dx, dy, dz);
        if (centerDist <= radius + 0.65) return true;
        const zFwd =
          dx * _camForward.x + dy * _camForward.y + dz * _camForward.z;
        // Never fade objects entirely at or behind the Capybara so background scenery remains crisp & opaque
        if (zFwd - radius >= heroCutDepth) return false;
        // Must reach in front of the camera near plane (handles giant overhanging canopies from behind lens!)
        if (zFwd + radius <= 0.14) return false;
        const effectiveZ = Math.max(0.18, zFwd + radius * 0.45);
        const yCam = Math.abs(dx * _camUp.x + dy * _camUp.y + dz * _camUp.z);
        if (yCam * cosY - effectiveZ * sinY >= radius) return false;
        const xCam = Math.abs(
          dx * _camRight.x + dy * _camRight.y + dz * _camRight.z
        );
        if (xCam * cosX - effectiveZ * sinX >= radius) return false;
        return true;
      };

      if (centerDist > 0.45) {
        _occluderCandidates.length = 0;
        const headX = _headWorldPos.x;
        const headZ = _headWorldPos.z;

        if (this.currentMode === 'sanctuary') {
          const zx = ZONE_LOCATIONS.sanctuary.x;
          const zz = ZONE_LOCATIONS.sanctuary.z;

          // 1. Procedural Exponential Fruit Trees (whole-tree atomic fade: trunk + leaves + hanging fruits!)
          for (let i = 0; i < this.sanctuaryTrees.length; i++) {
            const tr = this.sanctuaryTrees[i];
            const wx = zx + tr.x;
            const wz = zz + tr.z;
            const cr = tr.crownRadius;
            const th = tr.trunkHeight;
            const intrudes =
              doesSphereIntrudeForegroundFrustum(
                wx,
                th * 0.45,
                wz,
                Math.max(0.85, tr.trunkRadius * 2.5)
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx,
                th * 0.98,
                wz,
                cr * 1.25
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx,
                th * 1.22,
                wz,
                cr * 1.15
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx + cr * 0.55,
                th * 0.95,
                wz,
                cr * 0.7
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx - cr * 0.55,
                th * 0.95,
                wz,
                cr * 0.7
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx,
                th * 0.95,
                wz + cr * 0.55,
                cr * 0.7
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx,
                th * 0.95,
                wz - cr * 0.55,
                cr * 0.7
              );

            if (intrudes) {
              this.markObjectHierarchyOccluded(tr.rootGroup);
            } else {
              const rLim = cr + 2.5;
              if (
                distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <=
                rLim * rLim
              ) {
                _occluderCandidates.push(tr.rootGroup);
              }
            }
          }

          // 2. Home Pool Wooden Tap Post & Rim Boulders (water surface & sunken floor have ignoreCameraFade = true)
          if (this.homePool) {
            const postWx =
              zx + this.homePool.centerX - this.homePool.basinRadius + 0.72;
            const postWz = zz + this.homePool.centerZ;
            if (
              doesSphereIntrudeForegroundFrustum(postWx, 1.55, postWz, 1.35)
            ) {
              this.markObjectHierarchyOccluded(this.homePool.tapFixtureGroup);
            }
            const rPool = this.homePool.basinRadius + 2.4;
            if (
              distSqPointToSegment2D(
                zx + this.homePool.centerX,
                zz + this.homePool.centerZ,
                camX,
                camZ,
                headX,
                headZ
              ) <=
              rPool * rPool
            ) {
              _occluderCandidates.push(this.homePool.group);
            }
          }

          // 3. Sanctuary Buildings (yuzu_orchard, zen_pagoda, bamboo_grove, capy_statue, hot_spring, trampoline_pad)
          for (let i = 0; i < this.sanctuaryBuildingMeshes.length; i++) {
            const bm = this.sanctuaryBuildingMeshes[i];
            const wx = zx + bm.position.x;
            const wz = zz + bm.position.z;
            const s = bm.scale.x || 1.0;
            const bType = bm.userData.buildingType as string | undefined;
            const bRadius = bType === 'hot_spring' ? 2.6 * s : 2.4 * s;
            const bHeight = bType === 'hot_spring' ? 1.4 * s : 3.2 * s;
            const intrudes =
              doesSphereIntrudeForegroundFrustum(
                wx,
                bHeight * 0.45,
                wz,
                bRadius
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx,
                bHeight * 0.90,
                wz,
                bRadius
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx + bRadius * 0.5,
                bHeight * 0.7,
                wz,
                bRadius * 0.65
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx - bRadius * 0.5,
                bHeight * 0.7,
                wz,
                bRadius * 0.65
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx,
                bHeight * 0.7,
                wz + bRadius * 0.5,
                bRadius * 0.65
              ) ||
              doesSphereIntrudeForegroundFrustum(
                wx,
                bHeight * 0.7,
                wz - bRadius * 0.5,
                bRadius * 0.65
              );

            if (intrudes) {
              this.markObjectHierarchyOccluded(bm);
            } else if (
              distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <=
              (bRadius + 2.5) * (bRadius + 2.5)
            ) {
              _occluderCandidates.push(bm);
            }
          }
          // 4. World Portals
          for (let i = 0; i < this.sanctuaryPortals.length; i++) {
            const p = this.sanctuaryPortals[i];
            const wx = zx + p.x;
            const wz = zz + p.z;
            if (
              doesSphereIntrudeForegroundFrustum(wx, 2.1, wz, 2.65) ||
              doesSphereIntrudeForegroundFrustum(wx, 3.8, wz, 2.4)
            ) {
              this.markObjectHierarchyOccluded(p.mesh);
            } else if (
              distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <= 16.0
            ) {
              _occluderCandidates.push(p.mesh);
            }
          }

          // 5. Rolling / Falling 3D Physics Fruits in Foreground Frustum
          for (let i = 0; i < this.physicsFruits.length; i++) {
            const f = this.physicsFruits[i];
            if (!f.active || f.radius < 0.28) continue;
            const wx = zx + f.x;
            const wz = zz + f.z;
            if (
              doesSphereIntrudeForegroundFrustum(
                wx,
                f.y,
                wz,
                f.radius * 1.15
              ) &&
              (f.radius >= 0.45 || f.y > 0.65)
            ) {
              this.markObjectHierarchyOccluded(f.mesh);
            } else {
              const rF = f.radius + 1.1;
              if (
                distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <=
                rF * rF
              ) {
                _occluderCandidates.push(f.mesh);
              }
            }
          }

          // 6. Wandering Sanctuary Capybara Buddies
          for (let i = 0; i < this.sanctuaryCapys.length; i++) {
            const buddy = this.sanctuaryCapys[i].capy;
            const wx = zx + buddy.position.x;
            const wz = zz + buddy.position.z;
            if (
              doesSphereIntrudeForegroundFrustum(
                wx,
                buddy.position.y + 0.62,
                wz,
                0.95
              )
            ) {
              this.markObjectHierarchyOccluded(buddy);
            } else if (
              distSqPointToSegment2D(wx, wz, camX, camZ, headX, headZ) <= 2.56
            ) {
              _occluderCandidates.push(buddy);
            }
          }

          // 7. Coiled Trailing Dachshund Segments (idx >= 2): only fade if directly crossing head sightline rays
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
        } else {
          const activeGroup =
            this.currentMode === 'spore'
              ? this.sporeGroup
              : this.currentMode === 'breakout'
              ? this.breakoutGroup
              : this.currentMode === 'runner'
              ? this.runnerGroup
              : this.fallGuysGroup;
          const oz = ZONE_LOCATIONS[this.currentMode];
          for (let i = 0; i < activeGroup.children.length; i++) {
            const child = activeGroup.children[i];
            if (
              child.visible &&
              !child.userData?.ignoreCameraFade &&
              child.position.y > -0.15 &&
              distSqPointToSegment2D(
                oz.x + child.position.x,
                oz.z + child.position.z,
                camX,
                camZ,
                headX,
                headZ
              ) <= 16.0
            ) {
              if (!child.userData.__occluderRoot) {
                child.userData.__occluderRoot = child;
              }
              _occluderCandidates.push(child);
            }
          }
        }

        if (_occluderCandidates.length > 0) {
          // Cast rays:
          // 0-6: Direct head/torso sightline rays (head center, orange stack, left/right shoulders, upper crown, chin & torso)
          // 7-12: Screen-space view rays (top-center, top-left, top-right, mid-left, mid-right, high-top) to clear any foreground occluders in the player's 95% screen view!
          const TOTAL_OCCLUDER_RAYS = 13;
          for (let r = 0; r < TOTAL_OCCLUDER_RAYS; r++) {
            let maxRayDist = 0;
            if (r < 7) {
              if (r === 6) {
                _rayTargetPos.copy(_heroTorsoWorldPos);
              } else {
                _rayTargetPos.copy(_headWorldPos);
                if (r === 1) {
                  _rayTargetPos.y += 0.42;
                } else if (r === 2) {
                  _rayTargetPos.addScaledVector(_camRight, 0.32);
                } else if (r === 3) {
                  _rayTargetPos.addScaledVector(_camRight, -0.32);
                } else if (r === 4) {
                  _rayTargetPos.y += 0.85;
                } else if (r === 5) {
                  _rayTargetPos.y -= 0.22;
                }
              }

              _rayDir.subVectors(_rayTargetPos, this.camera.position);
              const dist = _rayDir.length();
              if (dist <= 0.42) continue;
              _rayDir.multiplyScalar(1 / dist);
              maxRayDist = Math.max(0.12, dist - 0.34);
            } else {
              // Screen-space view rays:
              if (r === 7) {
                // Top-center view ray
                _rayDir.copy(_camForward).multiplyScalar(0.85).addScaledVector(_camUp, 0.52).normalize();
              } else if (r === 8) {
                // Top-left view ray
                _rayDir.copy(_camForward).multiplyScalar(0.80).addScaledVector(_camUp, 0.50).addScaledVector(_camRight, -0.38).normalize();
              } else if (r === 9) {
                // Top-right view ray
                _rayDir.copy(_camForward).multiplyScalar(0.80).addScaledVector(_camUp, 0.50).addScaledVector(_camRight, 0.38).normalize();
              } else if (r === 10) {
                // Mid-left view ray
                _rayDir.copy(_camForward).multiplyScalar(0.88).addScaledVector(_camRight, -0.46).normalize();
              } else if (r === 11) {
                // Mid-right view ray
                _rayDir.copy(_camForward).multiplyScalar(0.88).addScaledVector(_camRight, 0.46).normalize();
              } else {
                // High-top view ray
                _rayDir.copy(_camForward).multiplyScalar(0.68).addScaledVector(_camUp, 0.72).normalize();
              }
              maxRayDist = Math.max(3.5, headDepth + 1.2);
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
              // Own trailing Dachshund segments only fade when blocking direct head rays (r === 0 or 1)
              if (resolvedRoot.userData?.__isDachshundSegment && r > 1) {
                continue;
              }
              this.markObjectHierarchyOccluded(resolvedRoot);
            }
          }
        }
      }
    }

    const fadeOutRate = Math.min(1, dt * 18);
    const restoreRate = Math.min(1, dt * 12);

    this.currentFrameOccluders.forEach((mesh) => {
      if (!mesh.userData.__inOccluderList) {
        mesh.userData.__inOccluderList = true;
        this.fadedOccluderMeshes.push(mesh);
      }
      this.setMeshOccluderBlend(mesh, 1.0, fadeOutRate);
      this.updateMeshOccluderScreenBounds(mesh);
    });

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
    const dt = Math.min(delta, 0.1);
    if (this.portalCooldown > 0) this.portalCooldown -= dt;
    if (this.snakeSelfHitCooldown > 0) this.snakeSelfHitCooldown -= dt;
    if (this.buddyBumpCooldown > 0) this.buddyBumpCooldown -= dt;
    if (this.mouthFullNotifyCooldown > 0) this.mouthFullNotifyCooldown -= dt;

    // Monitor live frame rate to dynamically scale Capybara mesh detail at smooth 60 FPS
    const measuredFps = this.isSoftwareGl
      ? 60
      : 1 / Math.max(0.004, rawFrameDt ?? delta);
    this.ingestFpsSample(measuredFps, dt);

    // Update GPU Day/Night solar/lunar lighting, sky dome, weather & water ripples on surface stages
    if (
      this.sanctuaryGroup.visible &&
      (this.cosmicStage === 'capy_selection' ||
        this.cosmicStage === 'playing' ||
        this.seamlessZoomActive)
    ) {
      const rippleTex = RealisticWorldEnvironment.getWaterRippleTexture();
      rippleTex.offset.x = (rippleTex.offset.x + dt * 0.032) % 1;
      rippleTex.offset.y = (rippleTex.offset.y + dt * 0.021) % 1;

      const exposureScale = (this.settings.gpuExposure ?? 1.12) / 1.12;
      this.worldEnv.tickAtmosphereAndWeather(
        dt,
        this.settings.dayNightAutoCycle !== false,
        this.settings.timeOfDayHours ?? 9.5,
        this.settings.weatherMode ?? 'auto',
        this.heroCapy.position.x,
        this.heroCapy.position.z,
        this.scene,
        this.renderer,
        this.settings.worldFogEnabled && !this.seamlessZoomActive,
        this.homePool?.lanternLight,
        exposureScale
      );
      this.worldEnv.tickTrees(this.sanctuaryTrees, dt);
      if (this.seamlessUniverse.forestGroveGroup.visible) {
        this.seamlessUniverse.tickWoodlandCapys(dt);
      }
      this.updateBioluminescentNightGlow();
    }

    // 0. Handle Seamless 63-Orders-of-Magnitude Universe Zoom (+28 Big Bang <-> +0.8 Forest <-> -35 Photon)
    if (this.seamlessZoomActive) {
      this.tickSeamlessUniverse(dt);
      this.gpuEngine.updateLightingAndShadowCascade(
        dt,
        this.heroCapy.position.x,
        this.heroCapy.position.y,
        this.heroCapy.position.z,
        0,
        false,
        this.worldEnv.currentNightFactor
      );
      this.renderSceneFrame(rawFrameDt);
      return;
    }

    // 1. Handle Cosmic Stages & Capybara Selection before active gameplay
    if (this.cosmicStage !== 'playing') {
      this.tickCosmicExperience(dt);
      this.gpuEngine.updateLightingAndShadowCascade(
        dt,
        this.heroCapy.position.x,
        this.heroCapy.position.y,
        this.heroCapy.position.z,
        0,
        this.cosmicStage === 'capy_selection',
        this.worldEnv.currentNightFactor
      );
      this.updateHeadLineOfSightTransparency(dt);
      this.renderSceneFrame(rawFrameDt);
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
      this.gpuEngine.updateLightingAndShadowCascade(
        dt,
        this.heroCapy.position.x,
        this.heroCapy.position.y,
        this.heroCapy.position.z,
        glideGroundY,
        true,
        this.worldEnv.currentNightFactor
      );
      this.updateHeadLineOfSightTransparency(dt);
      this.renderSceneFrame(rawFrameDt);
      return;
    }

    // Tick ALL 5 minigame ecosystems simultaneously in the unified contiguous world,
    // plus active player physics & seamless overland district handover!
    this.tickContiguousUnifiedWorld(dt);

    // Update texel-snapped directional solar shadow cascade & Hero contact shadow across all 5 districts
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
    this.gpuEngine.updateLightingAndShadowCascade(
      dt,
      this.heroCapy.position.x,
      this.heroCapy.position.y,
      this.heroCapy.position.z,
      heroGroundY,
      this.heroCapy.visible,
      this.worldEnv.currentNightFactor
    );

    // AAA Velocity-Reactive Dynamic FOV, Quadratic Camera Trauma & Zero-Allocation GPU VFX Step
    this.updateAaaCameraFeelAndWorldVfx(dt, heroGroundY);

    // Ensure nothing ever blocks the camera's sightline to the player's Capybara head!
    this.updateHeadLineOfSightTransparency(dt);

    this.telemetryTimer += dt;
    if (this.telemetryTimer >= 0.25) {
      this.telemetryTimer = 0;
      this.emitTelemetry();
    }

    this.renderSceneFrame(rawFrameDt);
  }

  private renderSceneFrame(rawFrameDt?: number) {
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
    this.gpuEngine.render();
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
          pGlow.opacity = (0.05 + glowBoost * 0.36) * pulse;
        }
        if (pMat) {
          pMat.emissiveIntensity = (0.38 + glowBoost * 2.25) * pulse;
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
        beaconMat.emissiveIntensity = (0.55 + glowBoost * 1.95) * pulse;
      }
      if (frameMat) {
        frameMat.emissiveIntensity = 0.28 + glowBoost * 0.85;
      }
    }

    // 3b. Grand Promenade Causeway Lantern Bollards (4 Overland Bridges)
    if (this.causewayLanternMat) {
      this.causewayLanternMat.emissiveIntensity = (0.55 + glowBoost * 2.3) * pulse;
    }

    // 4. Spore Lagoon Bio-Orbs & Critters
    for (let i = 0; i < this.sporeOrbs.length; i++) {
      const mat = this.sporeOrbs[i].mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive !== undefined) {
        mat.emissiveIntensity =
          (this.sporeOrbs[i].isDna ? 0.65 : 0.42) + glowBoost * 1.45;
      }
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
      this.cosmicOrbitYaw += (0.14 - this.moveInput.x * 1.45) * dt;
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
      this.emitCosmicState();
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
      else if (this.cosmicStage === 'star_system_view') baseRadius = 64;
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
      if (this.cosmicStage === 'universe_flight') {
        this.emitCosmicState();
      }
      return;
    }

    if (this.cosmicStage === 'planet_descent') {
      this.cosmicDescentElapsed += dt;
      const t = Math.min(1.0, this.cosmicDescentElapsed / 1.15);
      const ease = t * t * (3.0 - 2.0 * t);

      this.cosmicBuilder.getLandingBeaconWorldPosition(this.selectedLandingIndex, _tempVec3);
      _camTarget.copy(_tempVec3).multiplyScalar(1.05 + (1.0 - ease) * 1.65);
      this.camera.position.lerp(_camTarget, 0.25);
      this.camera.lookAt(0, 0, 0);

      // Blend sky color from deep space into the planet's atmospheric sky color with zero allocations
      _colorHelper.setHex(0x020617);
      _colorHelper2.setHex(this.activeBiome.skyHex);
      _colorHelper.lerp(_colorHelper2, ease);
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.copy(_colorHelper);
      } else {
        this.scene.background = _colorHelper.clone();
      }

      const liveDescentLog = THREE.MathUtils.lerp(4.9, 0.95, ease);
      this.currentLogScaleMeters = liveDescentLog;
      this.targetLogScaleMeters = liveDescentLog;
      this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());

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

    if (this.currentMode === 'sanctuary') {
      const snake = this.getCapySnakeTelemetry();
      this.callbacks.onTelemetryUpdate({
        mode: 'sanctuary',
        primaryLabel: 'Dachshund Body',
        primaryValue: `${snake.lengthMeters}m (${snake.bodySegments})`,
        secondaryLabel: 'Head Orange',
        secondaryValue: snake.headOrangeName,
        zoneCoordsLabel: coords,
      });
    } else if (this.currentMode === 'spore') {
      this.callbacks.onTelemetryUpdate({
        mode: 'spore',
        primaryLabel: 'Spore Mass',
        primaryValue: `${Math.round(this.sporeMass)} kg`,
        secondaryLabel: 'DNA Harvested',
        secondaryValue: `+${this.sporeDnaEarned}`,
        zoneCoordsLabel: coords,
      });
    } else if (this.currentMode === 'breakout') {
      this.callbacks.onTelemetryUpdate({
        mode: 'breakout',
        primaryLabel: 'Score',
        primaryValue: this.breakoutScore.toLocaleString(),
        secondaryLabel: 'Endless Wave',
        secondaryValue: `Wave ${this.breakoutWave}`,
        zoneCoordsLabel: coords,
      });
    } else if (this.currentMode === 'runner') {
      this.callbacks.onTelemetryUpdate({
        mode: 'runner',
        primaryLabel: 'Capy Herd',
        primaryValue: `${this.runnerCapyCount} Capys`,
        secondaryLabel: 'Distance',
        secondaryValue: `${Math.round(this.runnerDistance)}m`,
        zoneCoordsLabel: coords,
      });
    } else if (this.currentMode === 'fallguys') {
      this.callbacks.onTelemetryUpdate({
        mode: 'fallguys',
        primaryLabel: 'Crowns Won',
        primaryValue: this.fallGuysCrowns,
        secondaryLabel: 'Course Round',
        secondaryValue: `Round ${this.fallGuysRound}`,
        zoneCoordsLabel: coords,
      });
    }
  }

  private animateCapyLegs(
    capy: CapyMeshGroup,
    dt: number,
    speedFactor: number = 12,
    walkDir: 1 | -1 = 1
  ) {
    capy.userData.walkCycle += dt * speedFactor;
    const phase = capy.userData.walkCycle;
    // Diagonal quadruped trot/walk gait with 2-joint knee/carpus flexion & flat stance planting
    this.animateArticulatedLimb(capy.userData.legFL, phase, walkDir, 0.38);
    this.animateArticulatedLimb(capy.userData.legBR, phase, walkDir, 0.38);
    this.animateArticulatedLimb(capy.userData.legFR, phase + Math.PI, walkDir, 0.38);
    this.animateArticulatedLimb(capy.userData.legBL, phase + Math.PI, walkDir, 0.38);

    // Subtle ear bob & natural eyelid blink at LOD Tier 2+
    if (capy.userData.lodTier >= 2) {
      const earFlutter = Math.sin(capy.userData.walkCycle * 0.5) * 0.08;
      capy.userData.earL.rotation.z = -0.42 + earFlutter;
      capy.userData.earR.rotation.z = 0.42 - earFlutter;

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
   * - Behind-the-Capybara Chase Camera (with forward & active coordinated backward walking!)
   * - Fixed World-Angle Camera
   * - Foot-Contact Walking Traction: if `enforceFootTraction` is true and 0 feet touch the ground
   *   (and not swimming in water), walking propulsion is 0 (player gets stuck while feet paddle in air!).
   */
  private applyPlayerMovementAndCamera(
    dt: number,
    speed: number,
    _baseCamHeight: number,
    _baseCamDist: number,
    enforceFootTraction: boolean = false
  ): { forwardInput: number; walkDir: 1 | -1; hasWalkIntent: boolean } {
    const turnSens = this.settings.turnSensitivity || 1.0;
    const tractionMult =
      enforceFootTraction && this.isStuckNoFooting ? 0.0 : 1.0;

    if (this.settings.cameraFollowBehind) {
      const forwardRaw = -this.moveInput.z;
      const isReversing = forwardRaw < -0.04;
      this.isWalkingBackward = isReversing;
      const walkDir: 1 | -1 = isReversing ? -1 : 1;

      // Turning requires ground foot traction (or swimming water resistance)
      if (Math.abs(this.moveInput.x) > 0.02 && tractionMult > 0) {
        // Reverse steering direction slightly slower & natural when walking backward
        const yawRate = isReversing ? 2.1 : 2.6;
        this.heroYaw -= this.moveInput.x * yawRate * turnSens * dt;
      }

      const forwardInput =
        forwardRaw +
        (Math.abs(forwardRaw) < 0.05 && Math.abs(this.moveInput.x) > 0.1 ? 0.25 : 0);

      const hasWalkIntent =
        Math.abs(forwardInput) > 0.04 || Math.abs(this.moveInput.x) > 0.05;

      // Reverse walking moves at a realistic 0.78x backward quadruped pace; 0.0x if stuck with 0 feet on ground!
      const dirPace = isReversing ? 0.78 : 1.0;
      const effectiveSpeed = speed * dirPace * tractionMult;
      const moveVx = Math.sin(this.heroYaw) * forwardInput * effectiveSpeed;
      const moveVz = Math.cos(this.heroYaw) * forwardInput * effectiveSpeed;

      this.heroLocalPos.x += (moveVx + this.heroVelocity.x) * dt;
      this.heroLocalPos.z += (moveVz + this.heroVelocity.z) * dt;
      this.heroCapy.rotation.y = this.heroYaw;

      if (hasWalkIntent) {
        // Even if stuck with 0 feet touching ground, legs kick/cycle realistically searching for footing!
        this.animateCapyLegs(this.heroCapy, dt, isReversing ? 12 : 14, walkDir);
      } else {
        this.resetCapyLegs(this.heroCapy, dt);
      }

      return { forwardInput, walkDir, hasWalkIntent };
    } else {
      this.isWalkingBackward = false;
      const hasWalkIntent =
        Math.abs(this.moveInput.x) > 0.04 || Math.abs(this.moveInput.z) > 0.04;
      const effectiveSpeed = speed * tractionMult;
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

      return { forwardInput: hasWalkIntent ? 1 : 0, walkDir: 1, hasWalkIntent };
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
    const camDist = baseCamDist * distScale;
    const camHeight = baseCamHeight * distScale;

    if (this.settings.cameraFollowBehind) {
      // Position camera directly behind the Capybara's current heading
      _camTarget.set(
        wx - Math.sin(this.heroYaw) * camDist,
        wy + camHeight,
        wz - Math.cos(this.heroYaw) * camDist
      );
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-8 * dt));
      _lookTarget.set(
        wx + Math.sin(this.heroYaw) * 3.5,
        wy + 1.2,
        wz + Math.cos(this.heroYaw) * 3.5
      );
      this.camera.lookAt(_lookTarget);
    } else {
      _camTarget.set(wx, wy + camHeight, wz + camDist);
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-7 * dt));
      _lookTarget.set(wx, wy + 1.0, wz - 2.5);
      this.camera.lookAt(_lookTarget);
    }
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

    // 5. Contiguous Single-World Shoreline & 9.6m Grand Promenade Causeway Clamp
    const zone = ZONE_LOCATIONS[this.currentMode];
    const clamped = clampToContiguousWalkableWorld(zone.x + x, zone.z + z, radius);
    if (clamped.clamped) {
      x = clamped.wx - zone.x;
      z = clamped.wz - zone.z;
    }

    this.spineX[nodeIdx] = x;
    this.spineZ[nodeIdx] = z;
  }

  /**
   * Bidirectional Articulated Solid-Rod Spine & Collision Solver:
   * - When walking backwards (`isWalkingBackward`), EVERY Dachshund body segment and the Caboose
   *   actively step backward along their own reverse heading in coordination with the Hero.
   * - Runs 4 PBD iterations enforcing:
   *   1. Solid inextensible rod spacing (<= 4% slight elastic give) from head<->tail.
   *   2. Joint bend-angle limit (`MAX_SPINE_BEND_RAD` ~ 30 deg) so backing up NEVER folds or jackknifes.
   *   3. Non-adjacent spine segment-vs-segment solid separation (`|i - j| >= 2`) so the body never self-clips.
   *   4. Multi-body solid collisions against trees, boulders, structures, portals, and wandering Capybaras,
   *      transmitting tail obstacle resistance back up to the Hero when reversing into an obstacle!
   */
  private solveArticulatedSpineAndSolidCollisions(
    dt: number,
    forwardInput: number,
    speed: number
  ) {
    if (!this.spineInitialized) {
      this.resetDachshundTrail();
    }

    const totalNodes = this.snakeSegmentCount + 2;
    const heroR = 0.68;
    const segR = 0.48;
    const cabooseR = 0.54;
    const buddyR = 0.58;

    // Anchor node 0 at Hero's proposed step position
    this.spineX[0] = this.heroLocalPos.x;
    this.spineY[0] = this.heroLocalPos.y;
    this.spineZ[0] = this.heroLocalPos.z;
    this.spineYaw[0] = this.heroYaw;

    const tractionActive = !this.isStuckNoFooting;

    // Active Coordinated Backward Walking: ALL body segments & Caboose actively step backwards!
    if (this.isWalkingBackward && tractionActive && Math.abs(forwardInput) > 0.02) {
      const revStep = forwardInput * speed * 0.78 * dt; // negative -> steps backward along -heading
      const steerYaw = -this.moveInput.x * 1.45 * dt;
      for (let n = 1; n < totalNodes; n++) {
        this.spineYaw[n] += steerYaw * (1 - (n / totalNodes) * 0.35);
        this.spineX[n] += Math.sin(this.spineYaw[n]) * revStep;
        this.spineZ[n] += Math.cos(this.spineYaw[n]) * revStep;
      }
    }

    // Smooth vertical support tracking along spine (suspended height when testing 0-foot traction!)
    for (let n = 1; n < totalNodes; n++) {
      if (this.suspendedFootTestHeight !== null) {
        this.spineY[n] = this.suspendedFootTestHeight;
      } else {
        const groundY =
          this.homePool &&
          Math.hypot(
            this.spineX[n] - this.homePool.centerX,
            this.spineZ[n] - this.homePool.centerZ
          ) <
            this.homePool.basinRadius - 0.32
            ? this.homePool.waterMesh.position.y - 0.34
            : 0;
        const targetY =
          n === 1 ? (this.heroLocalPos.y * 0.45 + groundY * 0.55) : groundY;
        this.spineY[n] += (targetY - this.spineY[n]) * Math.min(1, dt * 16);
      }
    }

    // 4-Iteration Bidirectional Solid-Rod & Multi-Body Non-Clipping Solver
    const headShare = this.isWalkingBackward ? 0.52 : 0.0;
    const tailShare = 1.0 - headShare;

    for (let iter = 0; iter < 4; iter++) {
      // Pass A: Forward & Reverse Rod Distance + Anti-Jackknife Bend-Angle Clamping
      for (let n = 1; n < totalNodes; n++) {
        const restLen =
          n === 1 ? 0.56 : n === totalNodes - 1 ? 0.54 : DACHSHUND_SEGMENT_SPACING;
        let dx = this.spineX[n - 1] - this.spineX[n];
        let dz = this.spineZ[n - 1] - this.spineZ[n];
        let dist = Math.hypot(dx, dz);
        if (dist < 0.0001) {
          dx = Math.sin(this.spineYaw[n - 1]);
          dz = Math.cos(this.spineYaw[n - 1]);
          dist = 1;
        }

        // Enforce inextensible solid link length (allowing at most 3% slight compression)
        const targetLen = THREE.MathUtils.clamp(dist, restLen * 0.97, restLen);
        if (Math.abs(dist - targetLen) > 0.0005 || dist > restLen) {
          const err = dist - restLen;
          const nx = dx / dist;
          const nz = dz / dist;
          this.spineX[n - 1] -= nx * err * headShare;
          this.spineZ[n - 1] -= nz * err * headShare;
          this.spineX[n] += nx * err * tailShare;
          this.spineZ[n] += nz * err * tailShare;
        }

        // Enforce maximum joint articulation bend angle so backing up NEVER folds segments onto each other!
        dx = this.spineX[n - 1] - this.spineX[n];
        dz = this.spineZ[n - 1] - this.spineZ[n];
        const linkYaw = Math.atan2(dx, dz);
        const refYaw = n === 1 ? this.heroYaw : this.spineYaw[n - 1];
        const bendDiff = normalizeAngleSigned(linkYaw - refYaw);

        if (Math.abs(bendDiff) > MAX_SPINE_BEND_RAD) {
          const clampedYaw =
            refYaw + Math.sign(bendDiff) * MAX_SPINE_BEND_RAD;
          const desiredBackX = this.spineX[n - 1] - Math.sin(clampedYaw) * restLen;
          const desiredBackZ = this.spineZ[n - 1] - Math.cos(clampedYaw) * restLen;
          const corrX = desiredBackX - this.spineX[n];
          const corrZ = desiredBackZ - this.spineZ[n];
          const childWeight = this.isWalkingBackward ? 0.65 : 0.88;
          this.spineX[n] += corrX * childWeight;
          this.spineZ[n] += corrZ * childWeight;
          this.spineX[n - 1] -= corrX * (1 - childWeight);
          this.spineZ[n - 1] -= corrZ * (1 - childWeight);
          this.spineYaw[n] = clampedYaw;
        } else {
          this.spineYaw[n] = linkYaw;
        }
      }

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
      for (let n = totalNodes - 1; n >= 0; n--) {
        const rN = n === 0 ? heroR : n === totalNodes - 1 ? cabooseR : segR;
        this.resolveSpineNodeStaticObstacles(n, rN, iter === 0 && n === 0);
      }

      // Pass C2: Tail-to-Head Solid-Rod Pushback when reversing into an obstacle!
      // If the Caboose or any rear segment hits a tree/boulder while backing up, transmit solid resistance all the way to the Head!
      if (this.isWalkingBackward) {
        for (let n = totalNodes - 1; n >= 1; n--) {
          const minRodLen =
            (n === 1 ? 0.56 : n === totalNodes - 1 ? 0.54 : DACHSHUND_SEGMENT_SPACING) *
            0.97;
          let dx = this.spineX[n - 1] - this.spineX[n];
          let dz = this.spineZ[n - 1] - this.spineZ[n];
          let dist = Math.hypot(dx, dz);
          if (dist < minRodLen) {
            if (dist < 0.0001) {
              dx = Math.sin(this.spineYaw[n - 1]);
              dz = Math.cos(this.spineYaw[n - 1]);
              dist = 1;
            }
            const nx = dx / dist;
            const nz = dz / dist;
            this.spineX[n - 1] = this.spineX[n] + nx * minRodLen;
            this.spineZ[n - 1] = this.spineZ[n] + nz * minRodLen;
            const rParent = n - 1 === 0 ? heroR : segR;
            this.resolveSpineNodeStaticObstacles(n - 1, rParent, false);
          }
        }
      }

      // Pass D: Wandering Capybara Buddies vs Static Obstacles, Each Other & Entire Solid Spine
      for (let i = 0; i < this.sanctuaryCapys.length; i++) {
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

    // Write back constrained Hero position from spine node 0!
    this.heroLocalPos.x = this.spineX[0];
    this.heroLocalPos.z = this.spineZ[0];

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
          // Fruit fits in mouth! Chomp & grow logarithmically!
          f.active = false;
          this.fruitsGroup.remove(f.mesh);

          const massGain = Math.pow(f.radius / 0.24, 1.5);
          this.orangesCollectedCount++;
          this.fruitsCarried++;
          this.eatenFruitMass += massGain;
          this.heroSoftSquashVel += 2.6;
          this.syncLogarithmicBodyLength(true);

          AudioService.playCoin();
          this.callbacks.onProgressEarned(
            2,
            'sanctuary',
            this.bestSnakeSegments * 10 + this.orangesCollectedCount
          );
          const variety = HEAD_ORANGE_VARIETIES[this.activeHeadOrangeIndex];
          this.callbacks.onModeNotification?.(
            `Chomped ${Math.round(f.radius * 100)}cm ${variety.name}! Logarithmic body: ${this.logarithmicLengthMeters.toFixed(1)}m (${this.snakeSegmentCount} segs · Mouth max ${Math.round(this.getMouthMaxFruitRadius() * 100)}cm)`
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

    // 1. Check if Hero Capybara is swimming in the Home Pool & under the running Tap Water stream
    const dPool = Math.hypot(
      this.heroLocalPos.x - pool.centerX,
      this.heroLocalPos.z - pool.centerZ
    );
    this.isSwimmingInPool = dPool < pool.basinRadius - 0.32;

    if (this.isSwimmingInPool) {
      const headX = this.heroLocalPos.x + Math.sin(this.heroYaw) * 0.52;
      const headZ = this.heroLocalPos.z + Math.cos(this.heroYaw) * 0.52;
      const dTap = Math.min(
        Math.hypot(headX - pool.tapStreamWorldX, headZ - pool.tapStreamWorldZ),
        Math.hypot(
          this.heroLocalPos.x - pool.tapStreamWorldX,
          this.heroLocalPos.z - pool.tapStreamWorldZ
        )
      );

      // Putting head under the running tap water washes fruits off your head into the pool until 1 is left!
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

          // Drop the washed fruit off the Capybara's head directly into the pond water!
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
              'Tap water washed all extra fruits into your Home Pool — 1 signature Head Orange left!'
            );
          } else {
            this.callbacks.onModeNotification?.(
              `Tap water washing fruits off your head into the pool... (${this.fruitsCarried} left)`
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
          'Walked into Spore Lagoon (-75, -75) • Swim, chomp Yuzu Plankton & splice DNA!'
        );
      } else if (nextDistrict === 'breakout') {
        this.callbacks.onModeNotification?.(
          'Walked into Yuzu Breakout (+75, -75) • Move along the baseline to steer the paddle, or walk south to leave!'
        );
      } else if (nextDistrict === 'runner') {
        this.callbacks.onModeNotification?.(
          'Walked into Number Stampede (-75, +75) • Sprint the blue math lanes or step onto the boardwalk to return!'
        );
      } else if (nextDistrict === 'fallguys') {
        this.callbacks.onModeNotification?.(
          'Walked into Yuzu Mountain (+75, +75) • Dodge kinetic hammers, tilt the see-saw & claim the Crown!'
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

    // Step background ecosystems for districts where the player is not currently standing
    if (this.currentMode !== 'sanctuary') {
      this.tickSanctuaryAmbientOnly(dt);
    }
    if (this.currentMode !== 'spore') {
      this.tickSporeEcosystemOnly(dt);
    }
    if (this.currentMode !== 'breakout') {
      this.tickBreakoutEcosystemOnly(dt);
    }
    if (this.currentMode !== 'runner') {
      this.tickRunnerEcosystemOnly(dt);
    }
    if (this.currentMode !== 'fallguys') {
      this.tickFallGuysEcosystemOnly(dt);
    }

    // Step player + active district gameplay
    if (this.currentMode === 'sanctuary') {
      this.tickSanctuary(dt);
    } else if (this.currentMode === 'spore') {
      this.tickSpore(dt);
    } else if (this.currentMode === 'breakout') {
      this.tickBreakout(dt);
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
      buddy.stateTimer -= dt;
      if (buddy.stateTimer <= 0) {
        buddy.stateTimer = 4 + Math.random() * 5;
        const rad = 6.5 + Math.random() * 19.5;
        const ang = Math.random() * Math.PI * 2;
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
      this.sporeOrbs[i].mesh.rotation.y += dt * 2.2;
    }
    for (let i = 0; i < this.sporeCritters.length; i++) {
      const critter = this.sporeCritters[i];
      critter.changeDirTimer -= dt;
      if (critter.changeDirTimer <= 0) {
        critter.changeDirTimer = 2 + Math.random() * 3;
        critter.vel.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
      }
      critter.mesh.position.addScaledVector(critter.vel, dt);
      critter.mesh.position.x = THREE.MathUtils.clamp(critter.mesh.position.x, -32, 32);
      critter.mesh.position.z = THREE.MathUtils.clamp(critter.mesh.position.z, -32, 32);
      critter.mesh.rotation.y = Math.atan2(critter.vel.x, critter.vel.z);
      this.animateCapyLegs(critter.mesh, dt, 9);
    }
  }

  private tickBreakoutEcosystemOnly(dt: number) {
    if (!this.breakoutPaddle) return;
    // Autonomous rally by paddleCapy while Hero explores other districts
    const leadBall = this.breakoutBalls[0];
    if (leadBall) {
      const targetX = THREE.MathUtils.clamp(leadBall.mesh.position.x, -6.2, 6.2);
      this.breakoutPaddle.position.x = THREE.MathUtils.lerp(
        this.breakoutPaddle.position.x,
        targetX,
        1 - Math.exp(-5.5 * dt)
      );
    }
    this.stepBreakoutBallsAndBlocks(dt, false);
  }

  private tickRunnerEcosystemOnly(dt: number) {
    for (let i = 0; i < this.runnerHerdMeshes.length; i++) {
      this.animateCapyLegs(this.runnerHerdMeshes[i], dt, 10);
    }
  }

  private tickFallGuysEcosystemOnly(dt: number) {
    const seeSawTilt = this.physicsBridge.getSeeSawTiltAngle();
    for (let i = 0; i < this.seeSaws.length; i++) {
      const ss = this.seeSaws[i];
      ss.phase += dt * 1.4;
      ss.mesh.rotation.z = seeSawTilt + Math.sin(ss.phase) * 0.08;
    }
    for (let i = 0; i < this.fallGuysRivals.length; i++) {
      const rival = this.fallGuysRivals[i];
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

    const prevX = this.heroLocalPos.x;
    const prevZ = this.heroLocalPos.z;

    const pool = this.homePool;
    const dPoolCenter = pool
      ? Math.hypot(this.heroLocalPos.x - pool.centerX, this.heroLocalPos.z - pool.centerZ)
      : 999;
    const inPoolBasin = pool ? dPoolCenter < pool.basinRadius - 0.32 : false;
    this.isSwimmingInPool = inPoolBasin;

    // 1. Evaluate 3D foot sole ground contact BEFORE applying walking propulsion!
    this.evaluateFootContactsAndTraction();

    const swimSpeedMult = inPoolBasin ? 0.82 : 1.0;
    const speed = this.baseHeroSpeed * this.getEffectiveSpeedMultiplier() * swimSpeedMult;
    const lengthZoomFactor = 1 + Math.min(0.78, (this.snakeSegmentCount - 1) * 0.035);
    const camHeight = 6.8 * lengthZoomFactor;
    const camDist = 11.5 * lengthZoomFactor;

    const { forwardInput, walkDir, hasWalkIntent } = this.applyPlayerMovementAndCamera(
      dt,
      speed,
      camHeight,
      camDist,
      true
    );

    // 2. Step Rapier3D Wasm + Shallow-Water Fluid Buoyancy + XPBD Soft-Body Pads
    if (this.suspendedFootTestHeight !== null) {
      this.heroLocalPos.y = this.suspendedFootTestHeight;
      this.heroVelocity.set(0, 0, 0);
      this.isGrounded = false;
    } else {
      const gravityScale = this.activeBiome?.gravityMultiplier ?? 1.0;
      const heroJumpScale = this.activeHeroSpec?.jumpMultiplier ?? 1.0;
      const wasAirborne = !this.isGrounded;
      const prevVy = this.heroVelocity.y;

      let jumpImpulseY = 0;
      if (this.isJumping) {
        if (this.groundedFeetCount > 0 || inPoolBasin) {
          jumpImpulseY =
            (10.5 + (this.stats.upgrades.bounciness - 1) * 1.2) * heroJumpScale;
          if (hasWalkIntent) {
            const launchSpeed = speed * (this.isWalkingBackward ? -0.65 : 0.85);
            this.heroVelocity.x = Math.sin(this.heroYaw) * launchSpeed;
            this.heroVelocity.z = Math.cos(this.heroYaw) * launchSpeed;
          }
          this.isGrounded = false;
          this.heroSoftSquashVel -= 1.6;
          AudioService.playJump();
        }
        this.isJumping = false;
      }

      // Coupled Shallow-Water Wave & Archimedes Buoyancy + XPBD Pad Step
      const physStep = this.physicsBridge.stepContiguousCharacterAndWorld(
        {
          wx: this.heroLocalPos.x,
          wy: this.heroLocalPos.y,
          wz: this.heroLocalPos.z,
          vx: 0,
          vy: this.heroVelocity.y,
          vz: 0,
          desiredMoveVx: (this.heroLocalPos.x - prevX) / Math.max(0.001, dt),
          desiredMoveVz: (this.heroLocalPos.z - prevZ) / Math.max(0.001, dt),
          radius: 0.68,
          halfHeight: 0.25,
          jumpImpulseY,
          gravityScale,
          dt,
        },
        this.breakoutPaddle?.position.x ?? 0,
        this.hammerWorldScratch
      );

      if (inPoolBasin && pool) {
        const targetPoolY =
          pool.waterMesh.position.y -
          0.34 +
          Math.sin(performance.now() * 0.0045) * 0.035;
        this.heroVelocity.y -= 24 * gravityScale * dt;
        this.heroLocalPos.y += this.heroVelocity.y * dt;
        if (this.heroLocalPos.y <= targetPoolY) {
          this.heroLocalPos.y = targetPoolY;
          this.heroVelocity.y = 0;
          this.heroVelocity.x = 0;
          this.heroVelocity.z = 0;
          this.isGrounded = true;
        }
      } else {
        this.heroLocalPos.y = physStep.wy;
        this.heroVelocity.y = physStep.vy;
        if (physStep.grounded) {
          this.isGrounded = true;
          this.heroVelocity.x = 0;
          this.heroVelocity.z = 0;
          if (wasAirborne && prevVy < -3.0) {
            this.heroSoftSquashVel += Math.min(2.2, -prevVy * 0.16);
          }
        }
        if (physStep.trampolineBoostY > 0) {
          this.heroVelocity.y = Math.max(16.5, physStep.trampolineBoostY);
          this.isGrounded = false;
          this.heroSoftSquashVel -= 1.8;
          AudioService.playJump();
          this.callbacks.onProgressEarned(1, 'sanctuary', this.bestSnakeSegments * 10);
          this.callbacks.onModeNotification?.('XPBD Soft-Body Mushroom Bounce! +1 Spore DNA!');
        }
      }
    }

    // Ambient Capybara buddies wandering around the orchard
    for (let i = 0; i < this.sanctuaryCapys.length; i++) {
      const buddy = this.sanctuaryCapys[i];
      buddy.stateTimer -= dt;
      if (buddy.stateTimer <= 0) {
        buddy.stateTimer = 4 + Math.random() * 5;
        const rad = 6.5 + Math.random() * 19.5;
        const ang = Math.random() * Math.PI * 2;
        buddy.target.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
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

    // 3. Solve Bidirectional Solid-Rod Spine, Coordinated Backward Walking & Multi-Body Non-Clipping!
    this.solveArticulatedSpineAndSolidCollisions(dt, forwardInput, speed);

    const movedDist = Math.hypot(this.heroLocalPos.x - prevX, this.heroLocalPos.z - prevZ);
    const shouldAnimateSpineFeet =
      movedDist > 0.0025 || hasWalkIntent || !this.isGrounded || inPoolBasin;
    if (inPoolBasin) {
      this.animateCapyLegs(this.heroCapy, dt, 10, walkDir);
    }
    this.recordSnakeBreadcrumb();
    this.updateDachshundTransforms(dt, shouldAnimateSpineFeet, walkDir);

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
    if (this.sporeDashCooldown > 0) this.sporeDashCooldown -= dt;

    let speed = this.baseHeroSpeed * 1.15 * this.getEffectiveSpeedMultiplier();
    let dashVx = 0;
    let dashVz = 0;
    if (this.isJumping && this.sporeDashCooldown <= 0) {
      this.sporeDashCooldown = 1.2;
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

    // Step contiguous physics with Shallow-Water Lagoon Buoyancy & NW Promenade Causeway continuity (no [-36,36] box trap!)
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
        gravityScale: 1.0,
        dt,
      },
      this.breakoutPaddle?.position.x ?? 0,
      this.hammerWorldScratch
    );

    this.heroLocalPos.set(phys.wx - zone.x, phys.wy, phys.wz - zone.z);
    this.heroVelocity.set(phys.vx, phys.vy, phys.vz);
    this.isSwimmingInPool = phys.inFluid;

    const magnetRad = this.getEffectiveMagnetRadius() * heroScale;
    for (const orb of this.sporeOrbs) {
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
        this.sporeMass += orb.value;
        const dnaGain = orb.isDna ? 2 : 0;
        this.sporeDnaEarned += dnaGain;
        AudioService.playCoin();
        this.callbacks.onProgressEarned(dnaGain, 'spore', this.sporeMass);
        const angle = Math.random() * Math.PI * 2;
        const rad = 4 + Math.random() * 28;
        orb.mesh.position.set(Math.cos(angle) * rad, 0.45, Math.sin(angle) * rad);
      }
    }

    for (const critter of this.sporeCritters) {
      critter.changeDirTimer -= dt;
      if (critter.changeDirTimer <= 0) {
        critter.changeDirTimer = 2 + Math.random() * 3;
        critter.vel.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
      }
      critter.mesh.position.addScaledVector(critter.vel, dt);
      critter.mesh.position.x = THREE.MathUtils.clamp(critter.mesh.position.x, -32, 32);
      critter.mesh.position.z = THREE.MathUtils.clamp(critter.mesh.position.z, -32, 32);
      critter.mesh.rotation.y = Math.atan2(critter.vel.x, critter.vel.z);
      this.animateCapyLegs(critter.mesh, dt, 10);

      const dCritter = Math.hypot(
        this.heroLocalPos.x - critter.mesh.position.x,
        this.heroLocalPos.z - critter.mesh.position.z
      );
      if (dCritter < 1.25 * heroScale && heroScale >= critter.scale * 0.9) {
        AudioService.playChomp();
        this.sporeMass += 18;
        this.sporeDnaEarned += 5;
        this.callbacks.onProgressEarned(5, 'spore', this.sporeMass);
        this.callbacks.onModeNotification?.('Chomped Spore Critter! +18 Mass & +5 DNA!');
        const ang = Math.random() * Math.PI * 2;
        critter.mesh.position.set(Math.cos(ang) * 26, 0, Math.sin(ang) * 26);
      }
    }

    this.updateWorldHeroAndCamera(dt, 7.5 + heroScale * 2.2, 11.0 + heroScale * 1.8);
  }

  // --- 3. YUZU BREAKOUT TICK (WALK-IN / WALK-OUT BASELINE PADDLE COUPLING + SWEPT BALL CCD) ---
  private tickBreakout(dt: number) {
    if (!this.breakoutPaddle) return;
    const zone = ZONE_LOCATIONS.breakout;

    const paddleWidthScale =
      (1 + (this.stats.upgrades.paddleSize - 1) * 0.12) * this.paddleWidthMultiplier;
    this.breakoutPaddle.scale.x = paddleWidthScale;

    // Allow full 2D free movement on the Breakout baseline & south forecourt so player can walk out onto NE Causeway!
    const prevLx = this.heroLocalPos.x;
    const prevLz = this.heroLocalPos.z;
    const moveSpeed = 12.5 * this.getEffectiveSpeedMultiplier();

    if (this.pointerTargetX !== null && this.heroLocalPos.z <= 12.2) {
      const targetX = THREE.MathUtils.clamp(this.pointerTargetX * 7.2, -6.4, 6.4);
      this.heroLocalPos.x = THREE.MathUtils.lerp(
        this.heroLocalPos.x,
        targetX,
        1 - Math.exp(-18 * dt)
      );
      this.animateCapyLegs(this.heroCapy, dt, 14);
    } else {
      // Direct court strafe + walk south/north so Left/Right strafes paddle AND Down/Back walks out to NE Causeway!
      const vxMove = this.moveInput.x * moveSpeed;
      const vzMove = this.moveInput.z * moveSpeed;
      this.heroLocalPos.x += vxMove * dt;
      this.heroLocalPos.z += vzMove * dt;
      // Prevent walking north into the crystal brick field past the paddle rail (z = 9.8), while leaving south (+Z) wide open!
      if (this.heroLocalPos.z < 9.8) {
        this.heroLocalPos.z = 9.8;
      }
      if (Math.hypot(vxMove, vzMove) > 0.2) {
        this.heroYaw = Math.atan2(vxMove, vzMove);
        this.heroCapy.rotation.y = this.heroYaw;
        this.animateCapyLegs(this.heroCapy, dt, 15);
      } else {
        this.heroYaw = Math.PI;
        this.heroCapy.rotation.y = this.heroYaw;
        this.resetCapyLegs(this.heroCapy, dt);
      }
    }

    const phys = this.physicsBridge.stepContiguousCharacterAndWorld(
      {
        wx: zone.x + prevLx,
        wy: this.heroLocalPos.y,
        wz: zone.z + prevLz,
        vx: 0,
        vy: this.heroVelocity.y,
        vz: 0,
        desiredMoveVx: (this.heroLocalPos.x - prevLx) / Math.max(0.001, dt),
        desiredMoveVz: (this.heroLocalPos.z - prevLz) / Math.max(0.001, dt),
        radius: 0.68,
        halfHeight: 0.25,
        jumpImpulseY: this.isJumping && this.isGrounded ? 9.5 : 0,
        gravityScale: 1.0,
        dt,
      },
      this.breakoutPaddle.position.x,
      this.hammerWorldScratch
    );
    this.isJumping = false;
    this.isGrounded = phys.grounded;
    this.heroLocalPos.set(
      phys.wx - zone.x,
      phys.wy,
      Math.max(9.8, phys.wz - zone.z)
    );
    this.heroVelocity.y = phys.vy;

    // Couple Breakout Deflector Paddle smoothly to Hero's X position while on the court apron
    const targetPaddleX = THREE.MathUtils.clamp(this.heroLocalPos.x, -6.4, 6.4);
    this.breakoutPaddle.position.x = THREE.MathUtils.lerp(
      this.breakoutPaddle.position.x,
      targetPaddleX,
      1 - Math.exp(-22 * dt)
    );

    this.heroCapy.position.set(
      zone.x + this.heroLocalPos.x,
      this.heroLocalPos.y,
      zone.z + this.heroLocalPos.z
    );

    const distScale = this.settings.cameraDistance || 1.0;
    const followX = this.settings.cameraFollowBehind ? this.breakoutPaddle.position.x * 0.45 : 0;
    _camTarget.set(
      zone.x + followX,
      17.5 * distScale,
      zone.z + Math.max(15.5, this.heroLocalPos.z + 5.0) * distScale
    );
    this.camera.position.lerp(_camTarget, 1 - Math.exp(-8 * dt));
    this.camera.lookAt(zone.x + followX * 0.5, 0, zone.z - 1.5);

    this.stepBreakoutBallsAndBlocks(dt, true);
  }

  private stepBreakoutBallsAndBlocks(dt: number, playerPresent: boolean) {
    if (!this.breakoutPaddle) return;
    const paddleWidthScale =
      (1 + (this.stats.upgrades.paddleSize - 1) * 0.12) * this.paddleWidthMultiplier;
    const halfPaddleW = 1.9 * paddleWidthScale;

    // Update falling powerup capsules
    for (let i = this.breakoutPowerups.length - 1; i >= 0; i--) {
      const p = this.breakoutPowerups[i];
      p.mesh.position.z += 6.5 * dt;
      p.mesh.rotation.y += 3 * dt;
      if (
        p.mesh.position.z >= 8.4 &&
        p.mesh.position.z <= 9.8 &&
        Math.abs(p.mesh.position.x - this.breakoutPaddle.position.x) < halfPaddleW + 0.5
      ) {
        if (playerPresent) AudioService.playPrestigeFanfare();
        if (p.type === 'multiball' && this.breakoutBalls.length < 6) {
          this.spawnBreakoutBall(this.breakoutPaddle.position.x, 8.2, -4.5, -9.5);
          this.spawnBreakoutBall(this.breakoutPaddle.position.x, 8.2, 4.5, -9.5);
          if (playerPresent) {
            this.callbacks.onModeNotification?.('MULTIBALL UNLEASHED! 3x Yuzu Melons!');
          }
        } else {
          this.paddleWidthMultiplier = 1.35;
          if (playerPresent) {
            this.callbacks.onModeNotification?.('MEGA PADDLE ACTIVATED!');
          }
        }
        this.breakoutGroup.remove(p.mesh);
        this.breakoutPowerups.splice(i, 1);
      } else if (p.mesh.position.z > 12) {
        this.breakoutGroup.remove(p.mesh);
        this.breakoutPowerups.splice(i, 1);
      }
    }

    // Swept CCD sub-stepping on high-speed Breakout multiballs (zero brick tunneling!)
    for (let bIdx = this.breakoutBalls.length - 1; bIdx >= 0; bIdx--) {
      const b = this.breakoutBalls[bIdx];
      if (!b.active) continue;
      const speed = Math.hypot(b.vel.x, b.vel.z);
      const substeps = Math.min(4, Math.max(1, Math.ceil((speed * dt) / 0.28)));
      const subDt = dt / substeps;

      let removed = false;
      for (let s = 0; s < substeps && !removed; s++) {
        b.mesh.position.addScaledVector(b.vel, subDt);

        if (b.mesh.position.x <= -7.8) {
          b.mesh.position.x = -7.8;
          b.vel.x = Math.abs(b.vel.x);
          if (playerPresent) AudioService.playBrickHit(0.85);
        } else if (b.mesh.position.x >= 7.8) {
          b.mesh.position.x = 7.8;
          b.vel.x = -Math.abs(b.vel.x);
          if (playerPresent) AudioService.playBrickHit(0.85);
        }

        if (b.mesh.position.z <= -10.8) {
          b.mesh.position.z = -10.8;
          b.vel.z = Math.abs(b.vel.z);
          if (playerPresent) AudioService.playBrickHit(0.9);
        }

        if (
          b.vel.z > 0 &&
          b.mesh.position.z >= 8.3 &&
          b.mesh.position.z <= 9.6 &&
          Math.abs(b.mesh.position.x - this.breakoutPaddle.position.x) < halfPaddleW + 0.35
        ) {
          b.vel.z = -Math.abs(b.vel.z);
          const hitOffset = (b.mesh.position.x - this.breakoutPaddle.position.x) / halfPaddleW;
          b.vel.x = hitOffset * 8.2;
          this.breakoutCombo = 1;
          if (playerPresent) AudioService.playJump();
        }

        if (b.mesh.position.z > 12.2) {
          if (this.breakoutBalls.length > 1) {
            this.breakoutGroup.remove(b.mesh);
            this.breakoutBalls.splice(bIdx, 1);
            removed = true;
            break;
          } else {
            b.mesh.position.set(this.breakoutPaddle.position.x, 0.5, 7.5);
            b.vel.set((Math.random() - 0.5) * 5, 0, -9.2);
            this.breakoutCombo = 1;
            if (playerPresent) AudioService.playSplash();
          }
        }

        for (let i = this.breakoutBlocks.length - 1; i >= 0; i--) {
          const blk = this.breakoutBlocks[i];
          const dx = Math.abs(b.mesh.position.x - blk.mesh.position.x);
          const dz = Math.abs(b.mesh.position.z - blk.mesh.position.z);
          if (dx < 1.1 && dz < 0.65) {
            b.vel.z = -b.vel.z;
            blk.hp--;
            if (playerPresent) {
              this.breakoutCombo = Math.min(10, this.breakoutCombo + 1);
              const pts = 25 * this.breakoutCombo * this.breakoutWave;
              this.breakoutScore += pts;
            }

            if (blk.hp <= 0) {
              if (playerPresent && (blk.isBonus || Math.random() > 0.82)) {
                const pMesh = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.28, 0.28, 0.6, 12),
                  new THREE.MeshStandardMaterial({
                    color: 0x38bdf8,
                    emissive: 0x0284c7,
                    emissiveIntensity: 0.5,
                  })
                );
                pMesh.rotation.z = Math.PI / 2;
                pMesh.position.copy(blk.mesh.position);
                this.breakoutGroup.add(pMesh);
                this.breakoutPowerups.push({
                  mesh: pMesh,
                  type: Math.random() > 0.35 ? 'multiball' : 'wide',
                });
              }

              this.breakoutGroup.remove(blk.mesh);
              this.breakoutBlocks.splice(i, 1);
              if (playerPresent) {
                AudioService.playBrickHit(1.1 + this.breakoutCombo * 0.08);
                this.addCameraTrauma(0.24);
                NativeBridge.haptic('tick');
                this.vfxEngine?.emitBurst(
                  ZONE_LOCATIONS.breakout.x + blk.mesh.position.x,
                  blk.mesh.position.y,
                  ZONE_LOCATIONS.breakout.z + blk.mesh.position.z,
                  'citrus_burst',
                  7,
                  blk.isBonus ? 0x38bdf8 : 0xfbbf24
                );
                this.callbacks.onProgressEarned(
                  blk.isBonus ? 1 : 0,
                  'breakout',
                  this.breakoutScore
                );
              }
            } else if (playerPresent) {
              AudioService.playBrickHit(0.95);
            }

            if (this.breakoutBlocks.length === 0) {
              this.breakoutWave++;
              if (playerPresent) {
                AudioService.playPrestigeFanfare();
                const waveBonus = 120 * this.breakoutWave;
                this.breakoutScore += waveBonus;
                this.callbacks.onProgressEarned(3, 'breakout', this.breakoutScore);
                this.callbacks.onModeNotification?.(
                  `Wave ${this.breakoutWave - 1} Cleared! +3 Spore DNA! Launching Wave ${this.breakoutWave}!`
                );
              }
              this.resetBreakoutGame(false);
            }
            break;
          }
        }
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

    const phys = this.physicsBridge.stepContiguousCharacterAndWorld(
      {
        wx: zone.x + prevLx,
        wy: this.heroLocalPos.y,
        wz: zone.z + prevLz,
        vx: 0,
        vy: this.heroVelocity.y,
        vz: 0,
        desiredMoveVx: (this.heroLocalPos.x - prevLx) / Math.max(0.001, dt),
        desiredMoveVz: (this.heroLocalPos.z - prevLz) / Math.max(0.001, dt),
        radius: 0.68,
        halfHeight: 0.25,
        jumpImpulseY: this.isJumping && this.isGrounded ? 10.0 : 0,
        gravityScale: 1.0,
        dt,
      },
      this.breakoutPaddle?.position.x ?? 0,
      this.hammerWorldScratch
    );
    this.isJumping = false;
    this.isGrounded = phys.grounded;
    this.heroLocalPos.set(phys.wx - zone.x, phys.wy, phys.wz - zone.z);
    this.heroVelocity.y = phys.vy;

    // Update visible 3D Herd followers in formation around the hero
    for (let i = 0; i < this.runnerHerdMeshes.length; i++) {
      const mini = this.runnerHerdMeshes[i];
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
    for (const gate of this.runnerGates) {
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
          this.runnerCapyCount = Math.max(1, this.runnerCapyCount - gate.value);
          AudioService.playSplash();
        }
        this.syncRunnerHerdVisuals();

        this.callbacks.onProgressEarned(
          gate.type === 'multiply' ? 1 : 0,
          'runner',
          this.runnerCapyCount * 10 + Math.round(this.runnerDistance)
        );
        this.callbacks.onModeNotification?.(
          `Stampede Herd: ${this.runnerCapyCount} Capybaras!`
        );
      }
    }
  }

  private refreshRunnerCircuitGates() {
    this.runnerGates.forEach((g) => this.runnerGroup.remove(g.mesh));
    this.runnerGates = [];
    for (let i = 1; i < 4; i++) {
      this.spawnRunnerGatePair(-i * 24);
    }
  }

  // --- 5. YUZU MOUNTAIN PARKOUR TICK (RIGID HAMMER IMPULSES, TORQUE SEE-SAWS & XPBD LAUNCH PAD) ---
  private tickFallGuys(dt: number) {
    const zone = ZONE_LOCATIONS.fallguys;
    const prevLx = this.heroLocalPos.x;
    const prevLz = this.heroLocalPos.z;

    const speed = 9.8 * this.getEffectiveSpeedMultiplier();
    this.applyPlayerMovementAndCamera(dt, speed, 6.2, 10.2);

    let jumpImpulseY = 0;
    if (this.isJumping && this.isGrounded) {
      jumpImpulseY = 11.5 + (this.stats.upgrades.bounciness - 1) * 1.0;
      this.isGrounded = false;
      this.isJumping = false;
      AudioService.playJump();
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
        gravityScale: 1.0,
        dt,
      },
      this.breakoutPaddle?.position.x ?? 0,
      this.hammerWorldScratch
    );

    this.heroLocalPos.set(phys.wx - zone.x, phys.wy, phys.wz - zone.z);
    this.heroVelocity.set(phys.vx, phys.vy, phys.vz);
    this.isGrounded = phys.grounded;

    if (phys.trampolineBoostY > 0) {
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

    // Apply dynamic torque-coupled See-Saw tilt angle to visual plank mesh
    const seeSawTilt = this.physicsBridge.getSeeSawTiltAngle();
    for (const ss of this.seeSaws) {
      ss.phase += dt * 1.2;
      ss.mesh.rotation.z = seeSawTilt + Math.sin(ss.phase) * 0.04;
    }

    // AI Rival Bean-Capys racing forward
    for (const rival of this.fallGuysRivals) {
      rival.capy.position.z -= rival.speed * dt;
      rival.capy.position.x =
        rival.laneOffset + Math.sin(rival.capy.position.z * 0.35) * 1.1;
      this.animateCapyLegs(rival.capy, dt, 14);
      if (rival.capy.position.z < -60) {
        rival.capy.position.z = 0;
      }
    }

    // Check Golden Crown Finish Line at Z <= -57 & |X| <= 4.5
    if (this.heroLocalPos.z <= -57 && Math.abs(this.heroLocalPos.x) <= 4.5) {
      this.fallGuysCrowns++;
      this.fallGuysRound++;
      AudioService.playPrestigeFanfare();
      this.callbacks.onProgressEarned(4, 'fallguys', this.fallGuysCrowns);
      this.callbacks.onModeNotification?.(
        `GOLDEN CROWN #${this.fallGuysCrowns} CLAIMED! +4 Spore DNA! Advancing to Round ${this.fallGuysRound}!`
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
    if (this.autoZoomDirection !== 0) {
      const nextTarget =
        this.targetLogScaleMeters + this.autoZoomDirection * 3.4 * dt;
      if (nextTarget >= MAX_UNIVERSE_LOG_METERS) {
        this.targetLogScaleMeters = MAX_UNIVERSE_LOG_METERS;
        this.autoZoomDirection = 0;
      } else if (nextTarget <= MIN_UNIVERSE_LOG_METERS) {
        this.targetLogScaleMeters = MIN_UNIVERSE_LOG_METERS;
        this.autoZoomDirection = 0;
      } else {
        this.targetLogScaleMeters = nextTarget;
      }
    }

    this.currentLogScaleMeters = THREE.MathUtils.damp(
      this.currentLogScaleMeters,
      this.targetLogScaleMeters,
      9.5,
      dt
    );

    const logVal = this.currentLogScaleMeters;

    // Seamless automatic handover into live surface gameplay when steering/jumping inside Capybara Forest!
    const hasSurfaceSteerIntent =
      Math.abs(this.moveInput.x) > 0.06 ||
      Math.abs(this.moveInput.z) > 0.06 ||
      this.isJumping;
    if (
      this.autoZoomDirection === 0 &&
      hasSurfaceSteerIntent &&
      Math.abs(logVal - CAPYBARA_FOREST_LOG_METERS) <= 0.65 &&
      Math.abs(this.targetLogScaleMeters - CAPYBARA_FOREST_LOG_METERS) <= 0.65
    ) {
      this.resumeSurfacePlayFromForest(false);
      return;
    }

    const inForestWindow = logVal >= -0.85 && logVal <= 3.1;

    this.cosmicBuilder.rootGroup.visible = false;
    this.worldBaseGroup.visible = inForestWindow;
    this.sanctuaryGroup.visible = inForestWindow;
    this.seamlessUniverse.forestGroveGroup.visible = inForestWindow;
    this.sporeGroup.visible = inForestWindow;
    this.breakoutGroup.visible = inForestWindow;
    this.runnerGroup.visible = inForestWindow;
    this.fallGuysGroup.visible = inForestWindow;
    this.selectableCapyGroup.visible = false;
    this.heroCapy.visible = inForestWindow;
    if (this.dachshundGroup) {
      this.dachshundGroup.visible = inForestWindow && this.currentMode === 'sanctuary';
    }
    this.scene.fog = null;

    // Keep sanctuary companion Capybaras & portals gently alive while zooming through the forest!
    if (inForestWindow) {
      for (let i = 0; i < this.sanctuaryCapys.length; i++) {
        const buddy = this.sanctuaryCapys[i];
        buddy.stateTimer -= dt;
        if (buddy.stateTimer <= 0) {
          buddy.stateTimer = 4 + Math.random() * 5;
          const rad = 6.5 + Math.random() * 19.5;
          const ang = Math.random() * Math.PI * 2;
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

    // Free orbital camera steering with drag / WASD across every cosmic & quantum scale
    this.cosmicOrbitYaw += (0.04 - this.moveInput.x * 1.45) * dt;
    this.cosmicOrbitPitch = THREE.MathUtils.clamp(
      this.cosmicOrbitPitch + this.moveInput.z * 0.95 * dt,
      inForestWindow ? 0.14 : -0.68,
      1.18
    );

    // Compute projective-invariant camera radius & smooth multi-sector focal anchor:
    // Smoothly blends between active Hero Capybara position (across any of the 5 sectors)
    // and world origin (0,0,0) across [-0.85, +3.1] so there is zero focal snap!
    const canonicalRadius = 38.0;
    let camRadius = canonicalRadius;

    if (inForestWindow) {
      const lowBlend = THREE.MathUtils.smoothstep(logVal, -0.85, -0.22);
      const highBlend = 1 - THREE.MathUtils.smoothstep(logVal, 1.85, 3.1);
      const anchorWeight = lowBlend * highBlend;
      _seamlessFocalPos.set(
        this.heroCapy.position.x * anchorWeight,
        (this.heroCapy.position.y + 0.96) * anchorWeight,
        (this.heroCapy.position.z + 0.2) * anchorWeight
      );
      if (logVal >= 0.8) {
        const t = THREE.MathUtils.clamp((logVal - 0.8) / (3.1 - 0.8), 0, 1);
        const s = t * t * (3 - 2 * t);
        camRadius = THREE.MathUtils.lerp(7.6, canonicalRadius, s);
      } else if (logVal >= -0.15) {
        const t = THREE.MathUtils.clamp((logVal - -0.15) / (0.8 - -0.15), 0, 1);
        const s = t * t * (3 - 2 * t);
        camRadius = THREE.MathUtils.lerp(1.25, 7.6, s);
      } else {
        const t = THREE.MathUtils.clamp((logVal - -0.85) / (-0.15 - -0.85), 0, 1);
        const s = t * t * (3 - 2 * t);
        camRadius = THREE.MathUtils.lerp(canonicalRadius, 1.25, s);
      }
      if (this.camera.near !== 0.04 || this.camera.far !== 3500) {
        this.camera.near = 0.04;
        this.camera.far = 3500;
        this.camera.updateProjectionMatrix();
      }
    } else {
      _seamlessFocalPos.set(0, 0, 0);
      if (this.camera.near !== 0.1 || this.camera.far !== 3500) {
        this.camera.near = 0.1;
        this.camera.far = 3500;
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
      paletteMode
    );
    this.seamlessUniverse.rootGroup.scale.setScalar(camRadius / canonicalRadius);

    // Blend sky dome color in sunny forest & ecosystem window
    if (inForestWindow && logVal >= -0.15 && logVal <= 2.35) {
      _colorHelper.setHex(this.activeBiome?.skyHex ?? 0x38bdf8);
      const forestBlend = Math.min(
        1,
        Math.min((logVal - -0.15) / 0.5, (2.35 - logVal) / 0.7)
      );
      _seamlessSkyColor.lerp(_colorHelper, THREE.MathUtils.clamp(forestBlend, 0, 1));
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(_seamlessSkyColor);
    } else {
      this.scene.background = _seamlessSkyColor.clone();
    }

    _camTarget.set(
      _seamlessFocalPos.x +
        Math.sin(this.cosmicOrbitYaw) * Math.cos(this.cosmicOrbitPitch) * camRadius,
      _seamlessFocalPos.y + Math.sin(this.cosmicOrbitPitch) * camRadius,
      _seamlessFocalPos.z +
        Math.cos(this.cosmicOrbitYaw) * Math.cos(this.cosmicOrbitPitch) * camRadius
    );
    this.camera.position.copy(_camTarget);
    this.camera.lookAt(_seamlessFocalPos);

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
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public setShowObjectMarkers(show: boolean) {
    this.settings = { ...this.settings, showObjectMarkers: show };
    ProgressionService.saveSettings(this.settings);
    if (this.seamlessZoomActive) {
      this.tickSeamlessUniverse(0.001);
    }
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public setAstrophysicsPalette(palette: AstrophysicsPaletteMode) {
    this.settings = { ...this.settings, astrophysicsPalette: palette };
    ProgressionService.saveSettings(this.settings);
    if (this.seamlessZoomActive) {
      this.tickSeamlessUniverse(0.001);
    }
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
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
      this.cosmicOrbitPitch = Math.max(0.24, this.cosmicOrbitPitch);
      if (this.camera.zoom !== 1.0) {
        this.camera.zoom = 1.0;
        this.camera.updateProjectionMatrix();
      }
    }
    this.targetLogScaleMeters = clamped;
    if (immediate) {
      this.currentLogScaleMeters = clamped;
      this.tickSeamlessUniverse(0.016);
    }
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public jumpToScaleBand(bandId: UniverseScaleBandId, immediate: boolean = false) {
    const spec = this.seamlessUniverse.getBandById(bandId);
    if (bandId === 'single_electron') {
      this.quantumFocusMode = 'electron';
    } else if (bandId === 'single_photon') {
      this.quantumFocusMode = 'photon';
    } else if (spec.logMeters > -20.0) {
      this.quantumFocusMode = 'auto';
    }
    this.autoZoomDirection = 0;
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
    if (direction !== 0 && this.autoZoomDirection === direction) {
      this.autoZoomDirection = 0;
    } else {
      this.autoZoomDirection = direction;
      if (direction !== 0 && !this.seamlessZoomActive) {
        this.setSeamlessLogScale(this.currentLogScaleMeters, false);
      }
    }
    AudioService.playCoin();
    this.callbacks.onUniverseScaleChange?.(this.getUniverseScaleTelemetry());
  }

  public resumeSurfacePlayFromForest(snapCamera: boolean = true) {
    this.autoZoomDirection = 0;
    const savedCamPos = _tempVec3.copy(this.camera.position);
    AudioService.playCoin();
    this.setCosmicStage('playing');
    if (!snapCamera) {
      this.camera.position.copy(savedCamPos);
      this.camera.lookAt(
        this.heroCapy.position.x,
        this.heroCapy.position.y + 0.9,
        this.heroCapy.position.z
      );
    }
  }

  public adjustZoom(delta: number): number {
    // Seamless orders-of-magnitude zoom across all 63 powers of 10 (+28 Big Bang <-> -35 Photon)
    // Positive delta zooms IN (smaller logScaleMeters); negative delta zooms OUT (larger logScaleMeters)
    this.autoZoomDirection = 0;
    const nextLog = this.targetLogScaleMeters - delta * 6.5;
    this.setSeamlessLogScale(nextLog, false);
    return this.currentLogScaleMeters;
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
        this.gpuEngine.sunLight.position,
        this.worldEnv?.currentNightFactor ?? 0,
        this.settings.weatherMode === 'storm' ? 1 : this.settings.weatherMode === 'rain' ? 0.5 : 0,
        !this.seamlessZoomActive && this.cosmicStage === 'playing'
      );
    }
  }

  public handleResize(width: number, height: number) {
    const safeW = Math.max(1, Math.floor(width));
    const safeH = Math.max(1, Math.floor(height));
    const curSize = this.renderer.getSize(_rendererSizeVec2);
    if (Math.floor(curSize.x) === safeW && Math.floor(curSize.y) === safeH) {
      return;
    }
    this.camera.aspect = safeW / safeH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(safeW, safeH);
    this.gpuEngine?.handleResize(safeW, safeH);
    this.vfxEngine?.setPixelRatio(this.renderer.getPixelRatio());
    this.gpuEngine?.render();
  }

  public dispose() {
    this.cancelBuildingPlacementGhost(true);
    this.physicsBridge?.dispose();
    this.vfxEngine?.dispose();
    this.gpuEngine?.dispose();
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }
}
