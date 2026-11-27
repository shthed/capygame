import * as THREE from 'three';
import {
  CapyLodTier,
  HEAD_ORANGE_VARIETIES,
  PLAYABLE_CAPY_HEROES,
  PlayStyle,
  PlayerStats,
  ZONE_LOCATIONS,
} from '../types';
import { ProceduralGameConfig, parseHexColorString } from '../config/ProceduralGameConfig';
import {
  CapyMeshGroup,
  CapyModelGenerator,
  DachshundCabooseGroup,
} from './CapyModelGenerator';
import {
  ExponentialFruitTree,
  HomePoolSystem,
  RealisticWorldEnvironment,
} from './RealisticWorldEnvironment';
import { SanctuaryChronoPadSystem, createSanctuaryChronoPad } from './ChronoVesselRig';
import { PbrTextureSynthesizer } from './gpu/PbrTextureSynthesizer';
import { installFastMatrixCull } from './gpu/FramePerformanceGovernor';
import {
  FOREST_UNIFIED_ISLAND_BEACH_OUTER_RADIUS,
  FOREST_UNIFIED_ISLAND_CENTER_X,
  FOREST_UNIFIED_ISLAND_CENTER_Z,
  FOREST_UNIFIED_ISLAND_RADIUS,
} from './physics/ContiguousWorldTopology';

const MAX_SANCTUARY_BUDDIES = 12;
const MAX_SPORE_ORBS = 45;
const MAX_SPORE_CRITTERS = 14;
const MAX_RUNNER_HERD = 26;

const _dummyObj = new THREE.Object3D();
const _colorHelper = new THREE.Color();

/**
 * Narrow mutable host surface implemented by PlayStyleManager so all Forest
 * island 3D district builders can live in an on-demand async chunk without
 * duplicating state or introducing per-frame allocations.
 */
export interface ForestBuilderHost {
  scene: THREE.Scene;
  isSoftwareGl: boolean;
  worldEnv: RealisticWorldEnvironment;
  proceduralConfig: ProceduralGameConfig;
  stats: PlayerStats;
  currentCapyLodTier: CapyLodTier;
  selectedCapyHeroIndex: number;
  activeHeadOrangeIndex: number;
  chronoPadX: number;
  chronoPadZ: number;

  // Groups
  worldBaseGroup: THREE.Group;
  archipelagoStructuresGroup: THREE.Group;
  sanctuaryGroup: THREE.Group;
  fruitsGroup: THREE.Group;
  dachshundGroup: THREE.Group;
  selectableCapyGroup: THREE.Group;
  sporeGroup: THREE.Group;
  runnerGroup: THREE.Group;
  fallGuysGroup: THREE.Group;

  // Assigned meshes & pools
  oceanMesh: THREE.Mesh | null;
  causewayLanternMat: THREE.MeshStandardMaterial | null;
  sanctuaryBeachMesh: THREE.Mesh | null;
  sanctuaryIslandMesh: THREE.Mesh | null;
  homePool: HomePoolSystem | null;
  sanctuaryTrees: ExponentialFruitTree[];
  sanctuaryPortals: Array<{
    mesh: THREE.Group;
    mode: PlayStyle;
    x: number;
    z: number;
    rotY: number;
  }>;
  chronoPad: SanctuaryChronoPadSystem | null;
  sanctuaryDecorMesh: THREE.InstancedMesh | null;
  dachshundCaboose: DachshundCabooseGroup | null;
  fruitsCarried: number;
  eatenFruitMass: number;
  snakeSegmentCount: number;
  sanctuaryCapys: Array<{
    capy: CapyMeshGroup;
    target: THREE.Vector3;
    stateTimer: number;
  }>;

  selectableCapyRings: THREE.Mesh[];
  selectableCapyHitMeshes: THREE.Object3D[];

  sporeRippleTexture: THREE.DataTexture | null;
  sporeWaterMat: THREE.MeshPhysicalMaterial | null;
  sporeWaterMesh: THREE.Mesh | null;
  sporePoolsInitialized: boolean;
  sporeOrbSphereGeo: THREE.SphereGeometry | null;
  sporeOrbDnaGeo: THREE.OctahedronGeometry | null;
  sporeOrbPlanktonMat: THREE.MeshStandardMaterial | null;
  sporeOrbDnaMat: THREE.MeshStandardMaterial | null;
  sporeOrbs: Array<{
    mesh: THREE.Mesh;
    isDna: boolean;
    value: number;
    active: boolean;
  }>;
  sporeCritters: Array<{
    mesh: CapyMeshGroup;
    scale: number;
    vel: THREE.Vector3;
    changeDirTimer: number;
    active: boolean;
  }>;

  runnerPoolsInitialized: boolean;
  runnerTrackSegments: THREE.Group[];
  runnerGates: Array<{
    mesh: THREE.Group;
    panelMat: THREE.MeshBasicMaterial;
    type: 'add' | 'mul';
    value: number;
    z: number;
    triggered: boolean;
  }>;
  runnerHerdMeshes: CapyMeshGroup[];

  fallGuysInitialized: boolean;
  fallGuysRound: number;
  spinningObstacles: Array<{ mesh: THREE.Mesh; speed: number; dir: number }>;
  seeSaws: Array<{ mesh: THREE.Mesh; phase: number }>;
  fallGuysRivals: Array<{
    capy: CapyMeshGroup;
    speed: number;
    laneOffset: number;
    vy: number;
  }>;
  fallGuysGhostCapy: CapyMeshGroup | null;
  fallGuysGhostMat: THREE.MeshStandardMaterial | null;

  // Callbacks on host
  getNpcCapyLodTier(): CapyLodTier;
  getDesiredBuddyCount(): number;
  proceduralPrng(): number;
  growDachshundBody(count: number, silent?: boolean): void;
  syncLogarithmicBodyLength(immediate?: boolean): void;
  resetDachshundTrail(): void;
  updateDachshundTransforms(dt: number): void;
  refreshSanctuaryBuildings(): void;
  resetSporeGame(): void;
  getCachedRunnerBannerTexture(
    labelText: string,
    subText: string,
    bgHex: string,
    accentHex: string
  ): THREE.CanvasTexture;
}

export function buildSharedArchipelagoBaseOnHost(host: ForestBuilderHost): void {
  // GPU Rayleigh/Mie Sky Dome, 360° Snow-Capped Alpine Mountains, Clouds & Weather Precipitation
  host.worldEnv.skyMesh.userData.ignoreCameraFade = true;
  host.worldEnv.mountainMesh.userData.ignoreCameraFade = true;
  host.worldEnv.weatherMesh.userData.ignoreCameraFade = true;
  host.worldBaseGroup.add(host.worldEnv.skyMesh);
  host.worldBaseGroup.add(host.worldEnv.mountainMesh);
  host.worldBaseGroup.add(host.worldEnv.cloudGroup);
  host.worldBaseGroup.add(host.worldEnv.weatherMesh);

  // Endless Open-World Clearcoat Specular Ocean spanning past every island & horizon
  const oceanGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
    new THREE.CylinderGeometry(1200, 1200, 0.6, 64)
  );
  const oceanMat = RealisticWorldEnvironment.createOceanWaterMaterial(host.isSoftwareGl);
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.position.set(0, -1.25, 0);
  ocean.receiveShadow = true;
  ocean.userData.ignoreCameraFade = true;
  host.oceanMesh = ocean;
  host.worldBaseGroup.add(ocean);
  installFastMatrixCull(host.archipelagoStructuresGroup);
  host.worldBaseGroup.add(host.archipelagoStructuresGroup);

  // One Unified Contiguous Forest Island encompassing Sanctuary, Spore Lagoon, Number Stampede & Yuzu Mountain
  const cobbleTex = RealisticWorldEnvironment.getTextureSet('cobble', 8);
  const timberTex = RealisticWorldEnvironment.getTextureSet('timber', 6);
  const sandTex = RealisticWorldEnvironment.getTextureSet('sand', 8);
  const grassTex = RealisticWorldEnvironment.getTextureSet('grass', 18);

  const unifiedBeachMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    map: sandTex.albedo,
    normalMap: sandTex.normal,
    normalScale: new THREE.Vector2(0.68, 0.68),
    roughnessMap: sandTex.roughness,
    aoMap: sandTex.ao,
    aoMapIntensity: 0.6,
    roughness: 0.86,
    metalness: 0.02,
  });
  host.worldEnv.registerWettableMaterial(unifiedBeachMat, 0.86);
  const unifiedBeachGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
    new THREE.CylinderGeometry(
      FOREST_UNIFIED_ISLAND_RADIUS + 4.0,
      FOREST_UNIFIED_ISLAND_BEACH_OUTER_RADIUS,
      1.7,
      64
    )
  );
  const unifiedBeach = new THREE.Mesh(unifiedBeachGeo, unifiedBeachMat);
  unifiedBeach.position.set(
    FOREST_UNIFIED_ISLAND_CENTER_X,
    -1.07,
    FOREST_UNIFIED_ISLAND_CENTER_Z
  );
  unifiedBeach.receiveShadow = true;
  unifiedBeach.userData.ignoreCameraFade = true;
  host.archipelagoStructuresGroup.add(unifiedBeach);

  const unifiedMeadowMat = new THREE.MeshStandardMaterial({
    color: 0x74d98c,
    map: grassTex.albedo,
    normalMap: grassTex.normal,
    normalScale: new THREE.Vector2(0.74, 0.74),
    roughnessMap: grassTex.roughness,
    aoMap: grassTex.ao,
    aoMapIntensity: 0.72,
    roughness: 0.85,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  host.worldEnv.registerWettableMaterial(unifiedMeadowMat, 0.85);
  const unifiedMeadowGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
    new THREE.CylinderGeometry(
      FOREST_UNIFIED_ISLAND_RADIUS,
      FOREST_UNIFIED_ISLAND_RADIUS + 5.0,
      1.6,
      64
    )
  );
  const unifiedMeadow = new THREE.Mesh(unifiedMeadowGeo, unifiedMeadowMat);
  unifiedMeadow.position.set(
    FOREST_UNIFIED_ISLAND_CENTER_X,
    -0.85,
    FOREST_UNIFIED_ISLAND_CENTER_Z
  );
  unifiedMeadow.receiveShadow = true;
  unifiedMeadow.userData.ignoreCameraFade = true;
  host.archipelagoStructuresGroup.add(unifiedMeadow);

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
  host.causewayLanternMat = lanternMat;
  host.worldEnv.registerWettableMaterial(promenadeDeckMat, 0.58);
  host.worldEnv.registerWettableMaterial(promenadeCurbMat, 0.45);

  const meadowTrailMat = new THREE.MeshStandardMaterial({
    color: 0xd9c293,
    map: sandTex.albedo,
    normalMap: sandTex.normal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.9,
    metalness: 0.01,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  host.worldEnv.registerWettableMaterial(meadowTrailMat, 0.9);
  const trailLinks: Array<{ sx: number; sz: number; ex: number; ez: number }> = [
    { sx: -24, sz: -24, ex: ZONE_LOCATIONS.spore.x + 34, ez: ZONE_LOCATIONS.spore.z + 34 },
    { sx: -24, sz: 24, ex: ZONE_LOCATIONS.runner.x, ez: ZONE_LOCATIONS.runner.z + 10 },
    { sx: 24, sz: 24, ex: ZONE_LOCATIONS.fallguys.x, ez: ZONE_LOCATIONS.fallguys.z + 10 },
  ];
  for (let tIdx = 0; tIdx < trailLinks.length; tIdx++) {
    const tr = trailLinks[tIdx];
    const dx = tr.ex - tr.sx;
    const dz = tr.ez - tr.sz;
    const len = Math.hypot(dx, dz);
    const trailGeo = PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.PlaneGeometry(6.8, len));
    const trailMesh = new THREE.Mesh(trailGeo, meadowTrailMat);
    trailMesh.rotation.order = 'YXZ';
    trailMesh.rotation.x = -Math.PI / 2;
    trailMesh.rotation.y = Math.atan2(dx, dz);
    trailMesh.position.set((tr.sx + tr.ex) * 0.5, -0.025, (tr.sz + tr.ez) * 0.5);
    trailMesh.receiveShadow = true;
    trailMesh.userData.ignoreCameraFade = true;
    host.archipelagoStructuresGroup.add(trailMesh);
  }

  // Welcoming Sandy Beach Rim around Spore Lagoon
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
  host.archipelagoStructuresGroup.add(lagoonRim);

  // Number Stampede Forecourt, Side Return Boardwalks & Turnaround Deck
  const runnerForecourt = new THREE.Mesh(
    PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(16.8, 0.44, 14.0)),
    promenadeDeckMat
  );
  runnerForecourt.position.set(ZONE_LOCATIONS.runner.x, -0.205, ZONE_LOCATIONS.runner.z + 6.5);
  runnerForecourt.receiveShadow = true;
  runnerForecourt.userData.ignoreCameraFade = true;
  host.archipelagoStructuresGroup.add(runnerForecourt);

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
    host.archipelagoStructuresGroup.add(boardwalk);
  }

  const runnerTurnaround = new THREE.Mesh(
    new THREE.BoxGeometry(16.8, 0.44, 12.0),
    promenadeDeckMat
  );
  runnerTurnaround.position.set(ZONE_LOCATIONS.runner.x, -0.205, ZONE_LOCATIONS.runner.z - 92.0);
  runnerTurnaround.receiveShadow = true;
  runnerTurnaround.userData.ignoreCameraFade = true;
  host.archipelagoStructuresGroup.add(runnerTurnaround);

  // Yuzu Mountain Entry Ramp & Continuous Safety Promenade
  const fgRamp = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.5, 11.0), promenadeDeckMat);
  fgRamp.position.set(ZONE_LOCATIONS.fallguys.x, 0.05, ZONE_LOCATIONS.fallguys.z + 7.0);
  fgRamp.rotation.x = 0.08;
  fgRamp.receiveShadow = true;
  fgRamp.userData.ignoreCameraFade = true;
  host.archipelagoStructuresGroup.add(fgRamp);

  const fgUnderDeck = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.8, 76.0), promenadeDeckMat);
  fgUnderDeck.position.set(ZONE_LOCATIONS.fallguys.x, 0.08, ZONE_LOCATIONS.fallguys.z - 29.0);
  fgUnderDeck.receiveShadow = true;
  fgUnderDeck.userData.ignoreCameraFade = true;
  host.archipelagoStructuresGroup.add(fgUnderDeck);
}

export function buildSelectableCapyHeroCircleOnHost(host: ForestBuilderHost): void {
  host.selectableCapyGroup.name = 'SelectableCapyHeroCircle';
  host.selectableCapyRings = [];
  host.selectableCapyHitMeshes = [];

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
      hero.mutations,
      host.getNpcCapyLodTier()
    );
    node.add(capyMesh);

    const ringGeo = new THREE.RingGeometry(0.95, 1.32, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: idx === host.selectedCapyHeroIndex ? 0xfacc15 : 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: idx === host.selectedCapyHeroIndex ? 0.95 : 0.42,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.06;
    node.add(ringMesh);
    host.selectableCapyRings.push(ringMesh);

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
    host.selectableCapyHitMeshes.push(hitMesh);

    host.selectableCapyGroup.add(node);
  });

  host.sanctuaryGroup.add(host.selectableCapyGroup);
}

export function buildSanctuaryOnHost(host: ForestBuilderHost): void {
  const sandTex = RealisticWorldEnvironment.getTextureSet('sand');
  const grassTex = RealisticWorldEnvironment.getTextureSet('grass');
  const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');

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
  host.worldEnv.registerWettableMaterial(beachMat, 0.86);
  const beachGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
    new THREE.CylinderGeometry(36.5, 38.5, 1.5, 48)
  );
  const beach = new THREE.Mesh(beachGeo, beachMat);
  beach.position.set(0, -0.9, 0);
  beach.receiveShadow = true;
  beach.userData.ignoreCameraFade = true;
  host.sanctuaryBeachMesh = beach;
  host.sanctuaryGroup.add(beach);

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
  host.worldEnv.registerWettableMaterial(islandMat, 0.82);
  const islandGeo = PbrTextureSynthesizer.prepareGeometryForPbr(
    new THREE.CylinderGeometry(34.5, 30.0, 4, 48)
  );
  const island = new THREE.Mesh(islandGeo, islandMat);
  island.position.set(0, -2, 0);
  island.receiveShadow = true;
  island.userData.ignoreCameraFade = true;
  host.sanctuaryIslandMesh = island;
  host.sanctuaryGroup.add(island);

  host.homePool = host.worldEnv.createHomePool(-8.8, 3.0);
  host.sanctuaryGroup.add(host.homePool.group);
  if (host.isSoftwareGl) {
    host.homePool.lanternLight.visible = false;
    host.homePool.group.remove(host.homePool.lanternLight);
  } else {
    const lanternWorldPos = new THREE.Vector3();
    host.homePool.group.updateMatrixWorld(true);
    host.homePool.lanternLight.getWorldPosition(lanternWorldPos);
    host.homePool.group.remove(host.homePool.lanternLight);
    host.homePool.lanternLight.position.copy(lanternWorldPos);
    host.scene.add(host.homePool.lanternLight);
  }

  const treeBlueprints: Array<{
    tier: number;
    x: number;
    z: number;
    matchesHead: boolean;
    altOffset: number;
  }> = [
    { tier: 0, x: 0.0, z: 0.9, matchesHead: true, altOffset: 0 },
    { tier: 1, x: 6.2, z: -2.6, matchesHead: true, altOffset: 0 },
    { tier: 2, x: 13.6, z: -9.2, matchesHead: true, altOffset: 0 },
    { tier: 3, x: -14.2, z: -10.8, matchesHead: true, altOffset: 0 },
    { tier: 4, x: 1.4, z: -17.0, matchesHead: true, altOffset: 0 },
    { tier: 0, x: 15.8, z: 5.4, matchesHead: false, altOffset: 1 },
    { tier: 1, x: -19.5, z: -2.4, matchesHead: false, altOffset: 2 },
    { tier: 2, x: -14.8, z: 12.6, matchesHead: false, altOffset: 3 },
  ];

  host.sanctuaryTrees = [];
  for (let i = 0; i < treeBlueprints.length; i++) {
    const bp = treeBlueprints[i];
    const vIdx = bp.matchesHead
      ? host.activeHeadOrangeIndex
      : (host.activeHeadOrangeIndex + bp.altOffset) % HEAD_ORANGE_VARIETIES.length;
    const tree = host.worldEnv.createExponentialTree(i, bp.tier, bp.x, bp.z, bp.matchesHead, vIdx);
    host.sanctuaryGroup.add(tree.rootGroup);
    host.sanctuaryTrees.push(tree);
  }

  host.fruitsGroup.name = 'PhysicsRollingFruitsGroup';
  host.sanctuaryGroup.add(host.fruitsGroup);

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
      sub: 'NW MEADOW PATH',
      color: 0x06b6d4,
      accent: '#22d3ee',
      x: -20.5,
      z: -20.5,
      rotY: Math.atan2(-1, -1),
    },
    {
      mode: 'runner',
      title: 'STAMPEDE',
      sub: 'SW MEADOW PATH',
      color: 0xf59e0b,
      accent: '#fbbf24',
      x: -20.5,
      z: 20.5,
      rotY: Math.atan2(-89.5, 121.0),
    },
    {
      mode: 'fallguys',
      title: 'PARKOUR',
      sub: 'SE MEADOW PATH',
      color: 0xec4899,
      accent: '#f472b6',
      x: 20.5,
      z: 20.5,
      rotY: Math.atan2(89.5, 121.5),
    },
  ];

  for (const p of portalSpecs) {
    const portalMesh = CapyModelGenerator.createWorldPortal(p.title, p.sub, p.color, p.accent);
    portalMesh.position.set(p.x, 0, p.z);
    portalMesh.rotation.y = p.rotY;
    portalMesh.userData.__occluderRoot = portalMesh;
    host.sanctuaryGroup.add(portalMesh);
    host.sanctuaryPortals.push({
      mesh: portalMesh,
      mode: p.mode,
      x: p.x,
      z: p.z,
      rotY: p.rotY,
    });
  }

  host.chronoPad = createSanctuaryChronoPad(host.chronoPadX, host.chronoPadZ);
  host.chronoPad.group.userData.ignoreCameraFade = true;
  host.sanctuaryGroup.add(host.chronoPad.group);
  if (host.isSoftwareGl) {
    host.chronoPad.beaconLight.visible = false;
    host.chronoPad.group.remove(host.chronoPad.beaconLight);
  } else {
    host.chronoPad.group.remove(host.chronoPad.beaconLight);
    host.chronoPad.beaconLight.position.set(host.chronoPadX, 0.85, host.chronoPadZ);
    host.scene.add(host.chronoPad.beaconLight);
  }

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
  host.sanctuaryDecorMesh = instancedDecor;
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
    if (Math.hypot(px - host.homePool.centerX, pz - host.homePool.centerZ) < 5.6) continue;
    if (Math.hypot(px - host.chronoPadX, pz - host.chronoPadZ) < 3.6) continue;
    let hitsStatic = false;
    for (let t = 0; t < host.sanctuaryTrees.length; t++) {
      const tr = host.sanctuaryTrees[t];
      if (Math.hypot(px - tr.x, pz - tr.z) < tr.trunkRadius + 0.85) {
        hitsStatic = true;
        break;
      }
    }
    for (let p = 0; p < host.sanctuaryPortals.length; p++) {
      const po = host.sanctuaryPortals[p];
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
  host.sanctuaryGroup.add(instancedDecor);

  host.dachshundGroup.name = 'DachshundSnakeBodyGroup';
  host.sanctuaryGroup.add(host.dachshundGroup);

  host.dachshundCaboose = CapyModelGenerator.createDachshundCaboose(
    host.stats.activeSkin,
    host.currentCapyLodTier
  );
  host.dachshundGroup.add(host.dachshundCaboose);

  host.fruitsCarried = 1;
  host.eatenFruitMass = 0;
  host.snakeSegmentCount = 0;
  host.growDachshundBody(1, true);
  host.syncLogarithmicBodyLength(true);
  host.resetDachshundTrail();
  host.updateDachshundTransforms(0);

  const skins = ['classic', 'golden', 'sakura', 'matcha'];
  const hats = ['flower', 'yuzu', 'party', 'crown'];
  const buddySpawns: Array<[number, number]> = [
    [-4.2, 13.5],
    [17.5, -1.8],
    [17.6, 12.5],
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
  const desiredBuddies = host.getDesiredBuddyCount();
  for (let i = 0; i < MAX_SANCTUARY_BUDDIES; i++) {
    const buddy = CapyModelGenerator.createCapybara(
      hats[i % hats.length],
      0.84,
      skins[i % skins.length],
      [],
      host.getNpcCapyLodTier()
    );
    const [bx, bz] = buddySpawns[i % buddySpawns.length];
    buddy.position.set(bx, 0, bz);
    buddy.visible = i < desiredBuddies;
    buddy.userData.__occluderRoot = buddy;
    host.sanctuaryGroup.add(buddy);
    host.sanctuaryCapys.push({
      capy: buddy,
      target: new THREE.Vector3(bx * 0.9, 0, bz * 0.9),
      stateTimer: 1.5 + i * 0.7,
    });
  }

  host.refreshSanctuaryBuildings();
}

export function initSporePoolsOnHost(host: ForestBuilderHost): void {
  if (host.sporePoolsInitialized) return;
  host.sporePoolsInitialized = true;

  host.sporeOrbSphereGeo = new THREE.SphereGeometry(0.28, 10, 10);
  host.sporeOrbDnaGeo = new THREE.OctahedronGeometry(0.38, 1);
  host.sporeOrbPlanktonMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.48,
    roughness: 0.2,
  });
  host.sporeOrbDnaMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });

  for (let i = 0; i < MAX_SPORE_ORBS; i++) {
    const isDna = i % 3 === 0;
    const mesh = new THREE.Mesh(
      isDna ? host.sporeOrbDnaGeo : host.sporeOrbSphereGeo,
      isDna ? host.sporeOrbDnaMat : host.sporeOrbPlanktonMat
    );
    mesh.visible = false;
    host.sporeGroup.add(mesh);
    host.sporeOrbs.push({
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
      ['flippers'],
      host.getNpcCapyLodTier()
    );
    critter.visible = false;
    host.sporeGroup.add(critter);
    host.sporeCritters.push({
      mesh: critter,
      scale,
      vel: new THREE.Vector3(),
      changeDirTimer: 2,
      active: false,
    });
  }
}

export function buildSporeWorldOnHost(host: ForestBuilderHost): void {
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
  host.sporeGroup.add(seabed);

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
  const coralGeo = PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.DodecahedronGeometry(0.9));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const dist = 10 + (i % 3) * 8;
    const pad = new THREE.Mesh(lilyGeo, lilyMat);
    pad.position.set(Math.cos(a) * dist, 0.08, Math.sin(a) * dist);
    pad.receiveShadow = true;
    pad.userData.ignoreCameraFade = true;
    host.sporeGroup.add(pad);

    if (i % 2 === 0) {
      const coral = new THREE.Mesh(coralGeo, coralMat);
      coral.position.set(Math.cos(a) * dist, 0.65, Math.sin(a) * dist);
      coral.castShadow = true;
      host.sporeGroup.add(coral);
    }
  }

  host.sporeRippleTexture = RealisticWorldEnvironment.createWaterRippleDataTexture();
  const lagoonWaterHex = parseHexColorString(host.proceduralConfig.world.waterColorHex, 0x0ea5e9);
  host.sporeWaterMat = RealisticWorldEnvironment.createRipplingWaterMaterial(
    host.sporeRippleTexture,
    {
      colorHex: lagoonWaterHex,
      opacity: 0.78,
      rippleAmp: 0.11,
      isSoftwareGl: host.isSoftwareGl,
    }
  );
  host.sporeWaterMesh = new THREE.Mesh(
    RealisticWorldEnvironment.createSubdividedWaterDiscGeometry(35.6, 36, 12),
    host.sporeWaterMat
  );
  host.sporeWaterMesh.position.set(0, 0.06, 0);
  host.sporeWaterMesh.renderOrder = 2;
  host.sporeWaterMesh.receiveShadow = true;
  host.sporeWaterMesh.userData.ignoreCameraFade = true;
  host.sporeGroup.add(host.sporeWaterMesh);

  initSporePoolsOnHost(host);
  host.resetSporeGame();
}

export function spawnRunnerTrackSegmentOnHost(host: ForestBuilderHost, zPos: number): void {
  const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');
  const timberTex = RealisticWorldEnvironment.getTextureSet('timber');
  const segment = new THREE.Group();
  segment.position.set(0, 0, zPos);
  segment.userData.ignoreCameraFade = true;

  const trackGeo = PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(9.2, 0.4, 24));
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
  const railGeo = PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(0.3, 0.35, 24));
  const railL = new THREE.Mesh(railGeo, railMat);
  railL.position.set(-4.5, 0.1, 0);
  const railR = railL.clone();
  railR.position.x = 4.5;
  segment.add(railL, railR);

  host.runnerGroup.add(segment);
  host.runnerTrackSegments.push(segment);
}

export function initRunnerPoolsOnHost(host: ForestBuilderHost): void {
  if (host.runnerPoolsInitialized) return;
  host.runnerPoolsInitialized = true;

  for (let i = 0; i < 4; i++) {
    spawnRunnerTrackSegmentOnHost(host, -i * 24);
  }

  const panelGeo = new THREE.BoxGeometry(3.6, 2.5, 0.18);
  const defaultTex = host.getCachedRunnerBannerTexture('+3', 'ADD CAPYS', '#1e3a8a', '#60a5fa');
  for (let i = 1; i <= 3; i++) {
    const zPos = -i * 24;
    for (const xPos of [-2.1, 2.1]) {
      const gateGroup = new THREE.Group();
      gateGroup.position.set(xPos, 0, zPos);
      const panelMat = new THREE.MeshBasicMaterial({ map: defaultTex });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(0, 1.4, 0);
      gateGroup.add(panel);
      host.runnerGroup.add(gateGroup);
      host.runnerGates.push({
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
      idx % 4 === 0 ? 'golden' : 'classic',
      [],
      host.getNpcCapyLodTier()
    );
    mini.rotation.y = Math.PI;
    mini.visible = false;
    mini.userData.ignoreCameraFade = true;
    host.runnerGroup.add(mini);
    host.runnerHerdMeshes.push(mini);
  }
}

export function initFallGuysArenaOnHost(host: ForestBuilderHost): void {
  if (host.fallGuysInitialized) return;
  host.fallGuysInitialized = true;

  const fCfg = host.proceduralConfig.districts.fallguys;
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
  host.fallGuysGroup.add(startPlat);

  const plat2 = new THREE.Mesh(
    PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.BoxGeometry(11, 1, 18)),
    cyanMat
  );
  plat2.position.set(0, 0, -16);
  plat2.receiveShadow = true;
  plat2.userData.ignoreCameraFade = true;
  host.fallGuysGroup.add(plat2);

  for (const zOff of [-12, -20]) {
    const post = new THREE.Mesh(
      PbrTextureSynthesizer.prepareGeometryForPbr(new THREE.CylinderGeometry(0.5, 0.5, 3, 16)),
      yellowMat
    );
    post.position.set(0, 1.5, zOff);
    host.fallGuysGroup.add(post);

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 0.75, 0.75),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.28, metalness: 0.2 })
    );
    bar.position.set(0, 1.15, zOff);
    bar.castShadow = true;
    host.fallGuysGroup.add(bar);
    const dir = zOff === -12 ? 1 : -1;
    host.spinningObstacles.push({
      mesh: bar,
      speed: dir * (2.2 + host.fallGuysRound * 0.25) * fCfg.hammerSpeedMultiplier,
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
  host.fallGuysGroup.add(seeSaw);
  host.seeSaws.push({ mesh: seeSaw, phase: 0 });

  const plat3 = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 5.5, 1, 24),
    new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.25 })
  );
  plat3.position.set(0, 0, -46);
  plat3.userData.ignoreCameraFade = true;
  host.fallGuysGroup.add(plat3);

  const finishPlat = new THREE.Mesh(
    new THREE.BoxGeometry(12, 1, 12),
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 })
  );
  finishPlat.position.set(0, 0, -60);
  finishPlat.userData.ignoreCameraFade = true;
  host.fallGuysGroup.add(finishPlat);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.3, 1.6, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.12,
    })
  );
  crown.position.set(0, 2.4, -60);
  host.fallGuysGroup.add(crown);

  const rivalSkins = ['sakura', 'matcha', 'golden', 'cosmic', 'classic'];
  const rivalHats = ['party', 'wizard', 'flower', 'crown', 'yuzu'];
  for (let i = 0; i < 5; i++) {
    const rival = CapyModelGenerator.createCapybara(
      rivalHats[i],
      0.92,
      rivalSkins[i],
      [],
      host.getNpcCapyLodTier()
    );
    const laneX = (i - 2) * 1.9;
    rival.position.set(laneX, 0.6, 1.5);
    rival.rotation.y = Math.PI;
    host.fallGuysGroup.add(rival);
    host.fallGuysRivals.push({
      capy: rival,
      speed: 5.8 + host.proceduralPrng() * 2.4,
      laneOffset: laneX,
      vy: 0,
    });
  }

  const ghostCapy = CapyModelGenerator.createCapybara(
    'crown',
    0.94,
    'cosmic',
    [],
    host.getNpcCapyLodTier()
  );
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
  host.fallGuysGroup.add(ghostCapy);
  host.fallGuysGhostCapy = ghostCapy;
  host.fallGuysGhostMat = ghostMat;
}
