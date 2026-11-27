import * as THREE from 'three';
import {
  AstrophysicsPaletteMode,
  CapyLodTier,
  GalaxyMorphology,
  ProjectedObjectMarker,
  QuantumFocusMode,
  UNIVERSE_SCALE_BANDS,
  UniverseScaleBandId,
  UniverseScaleBandSpec,
  OrbitTimeScaleId,
  ORBIT_TIME_SCALES,
} from '../types';
import { CapyMeshGroup, CapyModelGenerator } from './CapyModelGenerator';
import { disposeObject3DTree } from './gpu/ThreeDisposal';
import {
  blackbodyKelvinToRgb,
  createAtmosphereScatteringMaterial,
  createCmbAnisotropyMaterial,
  createCosmicFilamentRibbonMaterial,
  createDeepFieldGalaxyMaterial,
  createDustPillarMaterial,
  createGasGiantMaterial,
  createHabitablePlanetMaterial,
  createMultiverseBubbleMaterial,
  createPlanetCloudMaterial,
  createPlanetaryRingMaterial,
  createRockyBodyMaterial,
  createSolarPhotosphereMaterial,
  createSpacetimeManifoldMaterial,
  createSpiralGalaxyDiscMaterial,
  createStarPsfMaterial,
  createVolumetricNebulaMaterial,
} from './UniverseShaders';
import {
  computeSolarPlanetFocusOffset,
  computePlanetSurfaceLandmassFocusOffset,
  computeSpiralGalaxyFocusOffset,
  HOME_GALAXY_ARM_RADIUS,
  HOME_GALAXY_ARM_THETA,
  SANCTUARY_SURFACE_LAT_DEG,
  SANCTUARY_SURFACE_LON_DEG,
  installFastMatrixCull,
} from './gpu/FramePerformanceGovernor';
import type {
  ForestMicroDioramaHandle,
} from './ForestMicroDioramaBuilder';
import {
  ForestMicroSpecimenId,
  ForestMicroSpecimenSpec,
  getForestSpecimenSpec,
  pickRandomForestSpecimen,
} from './forestMicroSpecimens';
import {
  CHROMATIN_BRIDGE_LOG_METERS,
  evaluateCellNucleusOpacity,
  evaluateChromatinBridgeAlpha,
  evaluateInfiniteZoomBandAlpha,
} from './UniverseScaleMath';

interface TrackedMaterialEntry {
  mat: THREE.Material;
  baseOpacity: number;
  defaultDepthWrite: boolean;
  shaderOpacityUniform?: { value: number };
  shaderTimeUniform?: { value: number };
  shaderHubbleUniform?: { value: number };
}

interface ScaleLayerRuntime {
  index: number;
  spec: UniverseScaleBandSpec;
  group: THREE.Group;
  materials: TrackedMaterialEntry[];
  populated: boolean;
  tickFn?: (dt: number, elapsed: number, gamma: number, showMarkers: boolean) => void;
}

interface WoodlandCapyEntry {
  capy: CapyMeshGroup;
  anchorX: number;
  anchorZ: number;
  orbitRadius: number;
  speed: number;
  phase: number;
}

interface WorldMarkerAnchor {
  id: string;
  label: string;
  sublabel: string;
  node: THREE.Object3D;
  layerBandId: UniverseScaleBandId;
  minLog: number;
  maxLog: number;
  targetLogMeters: number;
  colorCss: string;
  physicalRadiusWorldAtOneToOne: number;
}

interface SolarPlanetEntry {
  name: string;
  semiMajorAu: number;
  radiusAu: number;
  eccentricity: number;
  inclinationRad: number;
  angularSpeed: number;
  pivot: THREE.Group;
  bodyMesh: THREE.Mesh;
  glintPoint: THREE.Points;
  orbitLine: THREE.Line;
  baseOrbitPoints: Float32Array;
  targetLogMeters: number;
  colorCss: string;
}


const MAX_PROJECTED_MARKERS = 12;

// Unified Single Continuous Planet Constants (1:1 Physical Proportions)
export const PLANET_CANON_LOG = 7.10;
export const PLANET_BASE_RADIUS = 9.0;
export const MOON_ORBIT_RADIUS_AT_8_85 = 9.65;
export const MOON_RADIUS_AT_8_85 = 0.04365;
export const MINIMOON_ORBIT_RADIUS_AT_8_85 = 5.0;
export const MINIMOON_RADIUS_AT_8_85 = 0.032;

export function computeSinglePlanetWorldRadius(
  logScaleMeters: number,
  gamma: number = 1.0
): number {
  return PLANET_BASE_RADIUS * Math.pow(10, (PLANET_CANON_LOG - logScaleMeters) * gamma);
}

// Pre-allocated module scratch objects for zero per-frame GC pressure (AGENTS.md Rule 6)
const _dummyObj = new THREE.Object3D();
const _scratchColorA = new THREE.Color();
const _scratchColorB = new THREE.Color();
const _scratchVecA = new THREE.Vector3();
const _scratchVecB = new THREE.Vector3();
const _scratchVecC = new THREE.Vector3();
const _projWorldPos = new THREE.Vector3();
const _projNdcPos = new THREE.Vector3();
const _upUnitVec = new THREE.Vector3(0, 1, 0);
const _sharedSunDir = new THREE.Vector3(0.82, 0.28, 0.50).normalize();
const _sanctuaryLatRad = SANCTUARY_SURFACE_LAT_DEG * (Math.PI / 180);
const _sanctuaryLonRad = SANCTUARY_SURFACE_LON_DEG * (Math.PI / 180);
const _sanctuaryDir = new THREE.Vector3(
  Math.cos(_sanctuaryLatRad) * Math.sin(_sanctuaryLonRad),
  Math.sin(_sanctuaryLatRad),
  Math.cos(_sanctuaryLatRad) * Math.cos(_sanctuaryLonRad)
).normalize();
const _identityQuat = new THREE.Quaternion();
const _sanctuaryUpQuat = new THREE.Quaternion().setFromUnitVectors(_sanctuaryDir, _upUnitVec);
const _galaxyNavState = {
  focusBlend: 0,
  navActiveWeight: 0,
};

function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Maps continuous logarithmic scale (`10^28 m` Big Bang .. `<= 10^23.4 m` virialized galaxies)
 * monotonically to Cosmic Epoch Age in Gigayears (`0.00 Gyr` .. `13.80 Gyr`).
 */
export function computeCosmicAgeGyr(logScaleMeters: number): number {
  if (logScaleMeters >= 28.0) return 0.0;
  if (logScaleMeters <= 23.4) return 13.8;
  const p = THREE.MathUtils.clamp((28.0 - logScaleMeters) / (28.0 - 23.4), 0, 1);
  return +(13.8 * Math.pow(p, 1.35)).toFixed(2);
}

export class SeamlessUniverseSimulator {
  public readonly rootGroup: THREE.Group = new THREE.Group();
  public readonly forestGroveGroup: THREE.Group = new THREE.Group();
  public readonly celestialBackdropGroup: THREE.Group = new THREE.Group();

  private readonly isSoftwareGl: boolean;
  private readonly layers: ScaleLayerRuntime[] = [];
  private readonly woodlandCapys: WoodlandCapyEntry[] = [];
  private readonly markerAnchors: WorldMarkerAnchor[] = [];
  private readonly projectedMarkerPool: ProjectedObjectMarker[] = [];
  private activeProjectedMarkers: ProjectedObjectMarker[] = [];

  private celestialBackdropMats: TrackedMaterialEntry[] = [];
  private glowWarmTex: THREE.CanvasTexture | null = null;
  private glowCoolTex: THREE.CanvasTexture | null = null;
  private nextWarmLayerIdx: number = 0;
  private elapsed: number = 0;
  private lastGammaApplied: number = -1;

  // Dynamic Photon wave-packet geometry buffers updated in-place (zero allocations)
  private photonElectricPositions: Float32Array | null = null;
  private photonMagneticPositions: Float32Array | null = null;
  private photonElectricLine: THREE.Line | null = null;
  private photonMagneticLine: THREE.Line | null = null;
  private photonVectorGroup: THREE.Group | null = null;

  // Dynamic Solar, Planetary, Lunar, Atomic & Quantum references updated in-place
  private solarPlanets: SolarPlanetEntry[] = [];
  private solarFocusContainer: THREE.Group | null = null;
  private solarEclipticGroup: THREE.Group | null = null;
  private capyEarthPlanet: SolarPlanetEntry | null = null;
  private solarSunMesh: THREE.Mesh | null = null;
  private solarCoronaSprite: THREE.Sprite | null = null;
  private sunStarBeacon: THREE.Points | null = null;
  private solarBeltPoints: THREE.Points | null = null;
  private solarBeltBaseAu: Float32Array | null = null;
  private solarOortPoints: THREE.Points | null = null;
  private orbitTimeScaleId: OrbitTimeScaleId = '1_orbit_min';

  // Multiverse & subatomic per-layer dynamic shader/sprite references
  private multiverseHomeBubbleMesh: THREE.Mesh | null = null;
  private multiverseHomeBubbleMat: THREE.ShaderMaterial | null = null;
  private atomicOrbitalsWaveHalo: THREE.Sprite | null = null;
  private singleElectronHalo: THREE.Sprite | null = null;
  private singlePhotonCore: THREE.Sprite | null = null;

  // Unified Galactic Disc + Spiral Arms (Orion-Cygnus Spur) references
  private spiralGalaxyTiltGroup: THREE.Group | null = null;
  private spiralGalaxySpinGroup: THREE.Group | null = null;
  private spiralGalaxyDiscMesh: THREE.Mesh | null = null;
  private spiralGalaxyBulgeHalo: THREE.Sprite | null = null;
  private spiralGalaxyArmRibbons: THREE.Mesh[] = [];
  private lastGalaxyFocusBlend: number = 0;

  // Planetary System (Hill sphere, Moon orbits — shares single Capy-Earth in planet layer!)
  private planetarySystemGroup: THREE.Group | null = null;
  private planetaryMoonMesh: THREE.Mesh | null = null;
  private planetaryMoonPivot: THREE.Group | null = null;
  private planetaryMinimoonPivot: THREE.Group | null = null;
  private planetaryRingMesh: THREE.Mesh | null = null;

  // Unified Single Planet (Capy-Earth orbit -> continents -> clouds -> landing archipelago)
  private planetSurfaceAlignGroup: THREE.Group | null = null;
  private planetGlobeContainer: THREE.Group | null = null;
  private planetSurfaceAnchorGroup: THREE.Group | null = null;
  private planetGlobeMesh: THREE.Mesh | null = null;
  private planetGlobeMat: THREE.ShaderMaterial | null = null;
  private planetCloudMesh: THREE.Mesh | null = null;
  private planetCloudSphereMat: THREE.ShaderMaterial | null = null;
  private planetRayleighMesh: THREE.Mesh | null = null;
  private planetRayleighMat: THREE.ShaderMaterial | null = null;
  private planetOrbitalGlint: THREE.Points | null = null;
  private planetLod1Mesh: THREE.Mesh | null = null;
  private planetLod2Mesh: THREE.Mesh | null = null;
  private planetLod3Mesh: THREE.Mesh | null = null;
  private planetLodMats: THREE.ShaderMaterial[] = [];
  private planetCloudPatchMeshes: THREE.Mesh[] = [];
  private planetCloudPatchMats: THREE.ShaderMaterial[] = [];

  private atomicNuclearClusterGroup: THREE.Group | null = null;
  private nucleonMeshes: Array<{
    mesh: THREE.Mesh;
    basePos: THREE.Vector3;
    phase: number;
  }> = [];
  private quarkMeshes: Array<{
    mesh: THREE.Mesh;
    basePos: THREE.Vector3;
    tube: THREE.Mesh;
    phase: number;
  }> = [];
  private electronMarkers: Array<{
    pivot: THREE.Group;
    speedX: number;
    speedY: number;
  }> = [];
  private planckFoamGridGeo: THREE.PlaneGeometry | null = null;
  private planckFoamBaseZ: Float32Array | null = null;

  private layersBuilt: boolean = false;
  private groveBuilt: boolean = false;

  // Live procedural universe/biome customization handles (mutated in-place, zero allocations)
  private bigBangSpeedScale: number = 1.0;
  private fineStructureInverse: number = 137.036;
  private fineStructureRatio: number = 1.0;
  private atomicCloudPoints: THREE.Points | null = null;
  private singleElectronTorus: THREE.Points | null = null;
  private solarSunMat: THREE.ShaderMaterial | null = null;
  private capyEarthRingMesh: THREE.Mesh | null = null;
  private capyEarthBodyMat: THREE.ShaderMaterial | null = null;
  private atmosphereRayleighMat: THREE.ShaderMaterial | null = null;
  private atmosphereCloudMats: THREE.ShaderMaterial[] = [];
  private ecosystemMeadowMat: THREE.MeshStandardMaterial | null = null;
  private ecosystemRiverMat: THREE.MeshStandardMaterial | null = null;
  private cellNucleusMesh: THREE.Mesh | null = null;
  private cellNucleusMat: THREE.MeshStandardMaterial | null = null;
  private chromatinBridgeGroup: THREE.Group | null = null;
  private chromatinBridgeMats: Array<{
    mat: THREE.Material;
    baseOpacity: number;
    defaultDepthWrite: boolean;
  }> = [];
  private galaxyMorphology: GalaxyMorphology = 'spiral';
  private spiralGalaxyDiscMat: THREE.ShaderMaterial | null = null;
  private forestDiorama: ForestMicroDioramaHandle | null = null;
  private activeForestSpecimenId: ForestMicroSpecimenId = pickRandomForestSpecimen();
  private celestialStarPoints: THREE.Points | null = null;
  private celestialStarMat: THREE.ShaderMaterial | null = null;
  private quantumFieldPoints: THREE.Points | null = null;
  private quantumFieldMat: THREE.ShaderMaterial | null = null;
  private pendingProceduralBiome: {
    bigBangSpeed?: number;
    fineStructureInverse?: number;
    oceanColorHex?: number;
    landColorHex?: number;
    atmosphereColorHex?: number;
    cloudDensity?: number;
    ringSystemEnabled?: boolean;
    grassPrimaryHex?: number;
    waterColorHex?: number;
  } | null = null;

  public getActiveForestSpecimenSpec(): ForestMicroSpecimenSpec {
    return getForestSpecimenSpec(this.activeForestSpecimenId);
  }

  public rerollForestSpecimen(specificId?: ForestMicroSpecimenId): ForestMicroSpecimenSpec {
    this.activeForestSpecimenId =
      specificId ?? pickRandomForestSpecimen(Math.random, this.activeForestSpecimenId);
    if (this.forestDiorama) {
      this.forestDiorama.setActiveSpecimen(this.activeForestSpecimenId);
    }
    return this.getActiveForestSpecimenSpec();
  }

  public setGalaxyMorphology(morphology: GalaxyMorphology): void {
    this.galaxyMorphology = morphology;
    if (this.spiralGalaxyDiscMat && this.spiralGalaxyDiscMat.uniforms?.uMorphology) {
      const morphologyVal =
        morphology === 'barred_spiral'
          ? 1.0
          : morphology === 'elliptical'
            ? 2.0
            : morphology === 'irregular'
              ? 3.0
              : 0.0;
      this.spiralGalaxyDiscMat.uniforms.uMorphology.value = morphologyVal;
    }
  }

  public getGalaxyMorphology(): GalaxyMorphology {
    return this.galaxyMorphology;
  }

  /**
   * Zero-allocation query returning the world-space direction from the Milky Way core toward
   * Earth's Orion-Cygnus Spur plus current navigation transit weight (`sin(PI * focusBlend)`).
   */
  public getSpiralArmNavigationState(outWorldDir: THREE.Vector3): {
    focusBlend: number;
    navActiveWeight: number;
  } {
    const blend = this.lastGalaxyFocusBlend;
    const armX = Math.cos(HOME_GALAXY_ARM_THETA) * HOME_GALAXY_ARM_RADIUS;
    const armZ = -Math.sin(HOME_GALAXY_ARM_THETA) * HOME_GALAXY_ARM_RADIUS;
    const phi = this.spiralGalaxySpinGroup ? this.spiralGalaxySpinGroup.rotation.y : 0;
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    outWorldDir.set(
      armX * cosP + armZ * sinP,
      0,
      -armX * sinP + armZ * cosP
    );
    if (this.spiralGalaxyTiltGroup) {
      outWorldDir.applyQuaternion(this.spiralGalaxyTiltGroup.quaternion);
    }
    if (outWorldDir.lengthSq() > 1e-6) {
      outWorldDir.normalize();
    } else {
      outWorldDir.set(0.35, 0.25, -0.9).normalize();
    }
    _galaxyNavState.focusBlend = blend;
    _galaxyNavState.navActiveWeight = Math.sin(Math.PI * THREE.MathUtils.clamp(blend, 0, 1));
    return _galaxyNavState;
  }

  constructor(isSoftwareGl: boolean = false) {
    this.isSoftwareGl = isSoftwareGl;
    this.rootGroup.name = 'SeamlessUniverseSimulatorRoot';
    this.rootGroup.visible = false;
    this.rootGroup.matrixWorldAutoUpdate = false;
    this.rootGroup.userData.ignoreCameraFade = true;
    installFastMatrixCull(this.rootGroup);

    this.celestialBackdropGroup.name = 'DeepSkyCelestialBackdrop';
    this.celestialBackdropGroup.visible = false;
    this.celestialBackdropGroup.matrixWorldAutoUpdate = false;
    this.celestialBackdropGroup.userData.ignoreCameraFade = true;
    installFastMatrixCull(this.celestialBackdropGroup);

    this.forestGroveGroup.name = 'WoodlandCapybaraForestGrove';
    this.forestGroveGroup.visible = false;
    this.forestGroveGroup.matrixWorldAutoUpdate = false;
    this.forestGroveGroup.userData.ignoreCameraFade = true;
    installFastMatrixCull(this.forestGroveGroup);

    for (let i = 0; i < MAX_PROJECTED_MARKERS; i++) {
      this.projectedMarkerPool.push({
        id: '',
        label: '',
        sublabel: '',
        screenX: 0,
        screenY: 0,
        colorCss: '#38bdf8',
        targetLogMeters: 0,
        isSubPixel: false,
      });
    }
  }

  public getSharedSunDir(): THREE.Vector3 {
    return _sharedSunDir;
  }

  public ensureWoodlandGroveBuilt() {
    if (this.groveBuilt) return;
    this.groveBuilt = true;
    this.buildWoodlandCapybaraGrove();
  }

  public ensureLayersBuilt() {
    if (this.layersBuilt) return;
    this.layersBuilt = true;
    this.buildCelestialStarBackdrop();
    this.buildAllScaleLayers();
  }

  public warmNextPendingLayer(): boolean {
    if (!this.layersBuilt) {
      this.ensureLayersBuilt();
    }
    while (this.nextWarmLayerIdx < this.layers.length) {
      const layer = this.layers[this.nextWarmLayerIdx++];
      if (!layer.populated) {
        this.populateScaleLayer(layer);
        return this.nextWarmLayerIdx < this.layers.length;
      }
    }
    return false;
  }

  // ============================================================================
  // REUSABLE TEXTURE & POINT-BEACON HELPERS (BUILT ONCE AT INIT)
  // ============================================================================

  private createSoftRadialTexture(
    innerStopCss: string,
    midStopCss: string,
    outerStopCss: string = 'rgba(0,0,0,0)'
  ): THREE.CanvasTexture {
    const size = this.isSoftwareGl ? 64 : 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const r = size * 0.5;
      const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0.0, innerStopCss);
      grad.addColorStop(0.28, midStopCss);
      grad.addColorStop(1.0, outerStopCss);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createSinglePointGlint(
    colorHex: number,
    baseSize: number = 9.0,
    diffraction: number = 0.35
  ): THREE.Points {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array([0, 0, 0]);
    _scratchColorA.setHex(colorHex);
    const col = new Float32Array([_scratchColorA.r, _scratchColorA.g, _scratchColorA.b]);
    const scale = new Float32Array([1.0]);
    const lum = new Float32Array([0.92]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    const mat = createStarPsfMaterial({
      baseSize,
      minPixelSize: 2.6,
      maxPixelSize: 22.0,
      diffractionStrength: diffraction,
      opacity: 0.95,
    });
    const pt = new THREE.Points(geo, mat);
    pt.frustumCulled = false;
    return pt;
  }

  private createOrbitHairline(
    radius: number,
    eccentricity: number,
    colorHex: number,
    segments: number = 96
  ): { line: THREE.Line; unitCoords: Float32Array } {
    const pointCount = segments + 1;
    const unitCoords = new Float32Array(pointCount * 3);
    const positions = new Float32Array(pointCount * 3);
    const bRatio = Math.sqrt(Math.max(0.1, 1 - eccentricity * eccentricity));
    for (let i = 0; i <= segments; i++) {
      const ang = (i / segments) * Math.PI * 2;
      const ux = Math.cos(ang) - eccentricity;
      const uz = Math.sin(ang) * bRatio;
      unitCoords[i * 3] = ux;
      unitCoords[i * 3 + 1] = 0;
      unitCoords[i * 3 + 2] = uz;
      positions[i * 3] = ux * radius;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = uz * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      })
    );
    line.visible = false; // Strict 1:1 pure telescope view by default; shown when Object Markers enabled!
    return { line, unitCoords };
  }

  private registerMarkerAnchor(anchor: WorldMarkerAnchor) {
    this.markerAnchors.push(anchor);
  }

  // ============================================================================
  // PERSISTENT 3D CELESTIAL PSF STARFIELD & GALACTIC BAND SKYBOX
  // ============================================================================

  private buildCelestialStarBackdrop() {
    const starCount = this.isSoftwareGl ? 900 : 2800;
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const scales = new Float32Array(starCount);
    const lums = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Concentrate 55% of stars gently along an inclined Milky Way galactic plane
      const inBand = i % 20 < 11;
      const phi = seededRand(i * 7 + 1) * Math.PI * 2;
      let sinLat: number;
      if (inBand) {
        const g = (seededRand(i * 7 + 2) + seededRand(i * 7 + 3) - 1.0) * 0.24;
        sinLat = THREE.MathUtils.clamp(g, -0.99, 0.99);
      } else {
        sinLat = 2 * seededRand(i * 7 + 2) - 1;
      }
      const cosLat = Math.sqrt(Math.max(0, 1 - sinLat * sinLat));
      const r = 880 + seededRand(i * 7 + 4) * 80;

      // Tilt galactic plane by ~62 degrees like real Milky Way ecliptic inclination
      const lx = r * cosLat * Math.cos(phi);
      const ly = r * sinLat;
      const lz = r * cosLat * Math.sin(phi);
      const tilt = 1.08;
      pos[i * 3] = lx;
      pos[i * 3 + 1] = ly * Math.cos(tilt) - lz * Math.sin(tilt);
      pos[i * 3 + 2] = ly * Math.sin(tilt) + lz * Math.cos(tilt);

      // Realistic IMF-weighted Planckian blackbody temperatures (3,000K M-dwarfs to 26,000K OB stars)
      const uTemp = seededRand(i * 7 + 5);
      const kelvin =
        uTemp < 0.58
          ? 3100 + uTemp * 3600
          : uTemp < 0.88
            ? 5400 + (uTemp - 0.58) * 12000
            : 11000 + (uTemp - 0.88) * 140000;
      blackbodyKelvinToRgb(kelvin, _scratchColorA);
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;

      const magRoll = Math.pow(seededRand(i * 7 + 6), 3.2);
      scales[i] = 0.55 + magRoll * 2.6;
      lums[i] = 0.25 + magRoll * 0.75;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aLuminosity', new THREE.BufferAttribute(lums, 1));

    const psfMat = createStarPsfMaterial({
      baseSize: 66.0,
      minPixelSize: 1.9,
      maxPixelSize: 18.0,
      diffractionStrength: 0.62,
      opacity: 1.0,
    });
    const stars = new THREE.Points(geo, psfMat);
    stars.frustumCulled = false;
    this.celestialStarPoints = stars;
    this.celestialStarMat = psfMat;
    this.celestialBackdropGroup.add(stars);

    // Subtle deep-quantum QED vacuum fluctuation backdrop (-15.5m .. -35.0m) preventing pitch-black voids between subatomic scales
    const qCount = this.isSoftwareGl ? 90 : 180;
    const qPos = new Float32Array(qCount * 3);
    const qCol = new Float32Array(qCount * 3);
    const qScales = new Float32Array(qCount);
    const qLums = new Float32Array(qCount);
    for (let i = 0; i < qCount; i++) {
      const r = 460 + seededRand(i * 5 + 1) * 380;
      const th = Math.acos(2 * seededRand(i * 5 + 2) - 1);
      const ph = seededRand(i * 5 + 3) * Math.PI * 2;
      qPos[i * 3] = r * Math.sin(th) * Math.cos(ph);
      qPos[i * 3 + 1] = r * Math.cos(th);
      qPos[i * 3 + 2] = r * Math.sin(th) * Math.sin(ph);
      const huePick = seededRand(i * 5 + 4);
      _scratchColorA.setHSL(
        huePick < 0.45 ? 0.54 : huePick < 0.8 ? 0.76 : 0.13,
        0.85,
        0.65
      );
      qCol[i * 3] = _scratchColorA.r;
      qCol[i * 3 + 1] = _scratchColorA.g;
      qCol[i * 3 + 2] = _scratchColorA.b;
      qScales[i] = 0.65 + seededRand(i * 5 + 5) * 1.45;
      qLums[i] = 0.25 + seededRand(i * 7 + 1) * 0.45;
    }
    const qGeo = new THREE.BufferGeometry();
    qGeo.setAttribute('position', new THREE.BufferAttribute(qPos, 3));
    qGeo.setAttribute('color', new THREE.BufferAttribute(qCol, 3));
    qGeo.setAttribute('aScale', new THREE.BufferAttribute(qScales, 1));
    qGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(qLums, 1));
    const qMat = createStarPsfMaterial({
      baseSize: 48.0,
      minPixelSize: 1.5,
      maxPixelSize: 12.0,
      diffractionStrength: 0.0,
      opacity: 0.45,
    });
    const qPoints = new THREE.Points(qGeo, qMat);
    qPoints.frustumCulled = false;
    qPoints.visible = false;
    this.quantumFieldPoints = qPoints;
    this.quantumFieldMat = qMat;
    this.celestialBackdropGroup.add(qPoints);

    this.celestialBackdropMats = this.collectLayerMaterials(this.celestialBackdropGroup);
  }

  // ============================================================================
  // BUILD ALL 25 REAL-SCALE HUBBLE / SPACEENGINE 3D LAYERS
  // ============================================================================

  private buildAllScaleLayers() {
    this.glowWarmTex = this.createSoftRadialTexture(
      'rgba(255,252,235,1)',
      'rgba(251,191,36,0.42)'
    );
    this.glowWarmTex.userData.sharedAsset = true;
    this.glowCoolTex = this.createSoftRadialTexture(
      'rgba(235,248,255,1)',
      'rgba(56,189,248,0.38)'
    );
    this.glowCoolTex.userData.sharedAsset = true;

    for (let i = 0; i < UNIVERSE_SCALE_BANDS.length; i++) {
      const spec = UNIVERSE_SCALE_BANDS[i];
      const group = new THREE.Group();
      group.name = `ScaleLayer_${spec.id}`;
      group.visible = false;
      group.matrixWorldAutoUpdate = false;
      group.userData.ignoreCameraFade = true;
      installFastMatrixCull(group);

      this.rootGroup.add(group);
      this.layers.push({
        index: i,
        spec,
        group,
        materials: [],
        populated: false,
      });
    }
  }

  private populateScaleLayer(layer: ScaleLayerRuntime): void {
    if (layer.populated) return;
    layer.populated = true;
    if (!this.glowWarmTex) {
      this.glowWarmTex = this.createSoftRadialTexture(
        'rgba(255,252,235,1)',
        'rgba(251,191,36,0.42)'
      );
      this.glowWarmTex.userData.sharedAsset = true;
    }
    if (!this.glowCoolTex) {
      this.glowCoolTex = this.createSoftRadialTexture(
        'rgba(235,248,255,1)',
        'rgba(56,189,248,0.38)'
      );
      this.glowCoolTex.userData.sharedAsset = true;
    }
    const glowWarm = this.glowWarmTex;
    const glowCool = this.glowCoolTex;

    const { spec, group } = layer;
    let tickFn:
      | ((dt: number, elapsed: number, gamma: number, showMarkers: boolean) => void)
      | undefined;

    switch (spec.id) {
      case 'multiverse':
        tickFn = this.populateMultiverseLayer(group, glowWarm);
        break;
      case 'big_bang':
        tickFn = this.populateBigBangLayer(group, glowWarm);
        break;
      case 'universe':
        tickFn = this.populateUniverseManifoldLayer(group);
        break;
      case 'observable':
        tickFn = this.populateObservableUniverseLayer(group);
        break;
      case 'cosmic_web':
        tickFn = this.populateCosmicWebLayer(group);
        break;
      case 'filament':
        tickFn = this.populateFilamentLayer(group);
        break;
      case 'supercluster':
        tickFn = this.populateSuperclusterLayer(group, glowWarm);
        break;
      case 'cluster':
        tickFn = this.populateClusterLayer(group, glowCool);
        break;
      case 'galaxy':
        tickFn = this.populateGalaxyLayer(group, glowWarm);
        break;
      case 'spiral_arms':
        tickFn = this.populateSpiralArmsLayer(group, glowCool);
        break;
      case 'nebulas':
        tickFn = this.populateNebulaLayer(group, glowCool);
        break;
      case 'stellar_systems':
        tickFn = this.populateSolarSystemLayer(group, glowWarm);
        break;
      case 'planetary_system':
        tickFn = this.populatePlanetarySystemLayer(group);
        break;
      case 'planet':
        tickFn = this.populatePlanetGlobeLayer(group);
        break;
      case 'atmosphere':
        tickFn = this.populateAtmosphereLayer(group);
        break;
      case 'land_masses':
        tickFn = this.populateLandMassesLayer(group);
        break;
      case 'ecosystems':
        tickFn = this.populateEcosystemsLayer(group);
        break;
      case 'capybara_forest':
        tickFn = this.populateForestCanopyMotesLayer(group, glowWarm);
        break;
      case 'leaf_fur_micro':
        tickFn = this.populateLeafAndFurMicroLayer(layer, group, glowWarm);
        break;
      case 'biological_cells':
        tickFn = this.populateBiologicalCellsLayer(group);
        break;
      case 'dna_molecules':
        tickFn = this.populateDnaHelixLayer(group, glowCool);
        break;
      case 'atomic_orbitals':
        tickFn = this.populateAtomicOrbitalsLayer(group, glowCool);
        break;
      case 'atomic_nucleus':
        tickFn = this.populateAtomicNucleusLayer(group, glowWarm);
        break;
      case 'quarks_gluons':
        tickFn = this.populateQuarksGluonsLayer(group, glowWarm);
        break;
      case 'single_electron':
        tickFn = this.populateSingleElectronLayer(group, glowCool);
        break;
      case 'single_photon':
        tickFn = this.populateSinglePhotonLayer(group, glowWarm);
        break;
      case 'planck_quantum_foam':
        tickFn = this.populatePlanckQuantumFoamLayer(group, glowCool);
        break;
    }

    layer.materials = this.collectLayerMaterials(group);
    layer.tickFn = tickFn;

    // Re-sync any procedural biome / galaxy morphology / forest specimen choices onto the newly built layer
    if (this.pendingProceduralBiome) {
      this.applyProceduralConfig(this.pendingProceduralBiome);
    }
    if (spec.id === 'galaxy' && this.galaxyMorphology !== 'spiral') {
      this.setGalaxyMorphology(this.galaxyMorphology);
    }
    if (spec.id === 'leaf_fur_micro' && this.forestDiorama) {
      this.forestDiorama.setActiveSpecimen(this.activeForestSpecimenId);
    }
  }

  private collectLayerMaterials(root: THREE.Group): TrackedMaterialEntry[] {
    const entries: TrackedMaterialEntry[] = [];
    const seen = new Set<THREE.Material>();
    root.traverse((obj) => {
      obj.userData.ignoreCameraFade = true;
      const renderable = obj as THREE.Mesh;
      if (!renderable.material) return;
      const mats = Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material];
      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i];
        if (!mat || seen.has(mat)) continue;
        seen.add(mat);
        mat.transparent = true;
        const shaderMat = mat as THREE.ShaderMaterial;
        const uOpacity = shaderMat.uniforms?.uOpacity;
        const uTime = shaderMat.uniforms?.uTime;
        const uHubbleMix = shaderMat.uniforms?.uHubbleMix;
        const baseOpacity = uOpacity
          ? Number(uOpacity.value)
          : mat.opacity !== undefined
            ? mat.opacity
            : 1.0;
        entries.push({
          mat,
          baseOpacity,
          defaultDepthWrite: mat.depthWrite,
          shaderOpacityUniform: uOpacity,
          shaderTimeUniform: uTime,
          shaderHubbleUniform: uHubbleMix,
        });
      }
    });
    return entries;
  }

  // --- 1. MULTIVERSE & POCKET BUBBLE UNIVERSES (+30.0) ---
  private populateMultiverseLayer(
    group: THREE.Group,
    glowTex: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    // 1. Central Home Universe Bubble Sphere with iridescent Fresnel membrane
    const homeBubbleGeo = new THREE.SphereGeometry(
      9.8,
      this.isSoftwareGl ? 32 : 56,
      this.isSoftwareGl ? 24 : 40
    );
    const homeBubbleMat = createMultiverseBubbleMaterial({
      isHomeUniverse: true,
      opacity: 0.94,
    });
    const homeBubbleMesh = new THREE.Mesh(homeBubbleGeo, homeBubbleMat);
    this.multiverseHomeBubbleMesh = homeBubbleMesh;
    this.multiverseHomeBubbleMat = homeBubbleMat;
    group.add(homeBubbleMesh);

    // Radiant entrance corona halo sprite on home universe
    const homeCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xc084fc,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.78,
      })
    );
    homeCorona.scale.setScalar(24.0);
    group.add(homeCorona);

    // 2. Surrounding pocket universe bubbles nucleating in the higher-dimensional quantum false vacuum
    const pocketCount = this.isSoftwareGl ? 8 : 16;
    const bubbleMat = createMultiverseBubbleMaterial({
      isHomeUniverse: false,
      opacity: 0.72,
    });
    for (let b = 0; b < pocketCount; b++) {
      const radius = 2.4 + seededRand(b * 7 + 1) * 4.6;
      const dist = 18.0 + seededRand(b * 7 + 2) * 22.0;
      const theta = Math.acos(2 * seededRand(b * 7 + 3) - 1);
      const phi = seededRand(b * 7 + 4) * Math.PI * 2;

      const px = dist * Math.sin(theta) * Math.cos(phi);
      const py = dist * Math.cos(theta) * 0.72;
      const pz = dist * Math.sin(theta) * Math.sin(phi);

      const pBubble = new THREE.Mesh(
        new THREE.SphereGeometry(radius, this.isSoftwareGl ? 18 : 28, 16),
        bubbleMat
      );
      pBubble.position.set(px, py, pz);
      group.add(pBubble);
    }

    // 3. Higher-dimensional quantum vacuum fluctuation glints
    const glintCount = this.isSoftwareGl ? 400 : 1200;
    const pos = new Float32Array(glintCount * 3);
    const col = new Float32Array(glintCount * 3);
    const sc = new Float32Array(glintCount);
    const lum = new Float32Array(glintCount);
    for (let i = 0; i < glintCount; i++) {
      const r = 12.0 + Math.pow(seededRand(i * 5 + 1), 1.2) * 36.0;
      const theta = Math.acos(2 * seededRand(i * 5 + 2) - 1);
      const phi = seededRand(i * 5 + 3) * Math.PI * 2;
      pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.cos(theta) * 0.65;
      pos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

      const t = seededRand(i * 5 + 4);
      _scratchColorA.setHSL(0.72 + t * 0.35, 0.85, 0.65);
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;
      sc[i] = 0.6 + seededRand(i * 5 + 5) * 1.5;
      lum[i] = 0.4 + seededRand(i * 7 + 1) * 0.6;
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    gGeo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    gGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    group.add(
      new THREE.Points(
        gGeo,
        createStarPsfMaterial({ baseSize: 11.0, diffractionStrength: 0.45, opacity: 0.82 })
      )
    );

    const homeBubbleAnchor = new THREE.Object3D();
    group.add(homeBubbleAnchor);
    this.registerMarkerAnchor({
      id: 'marker_home_pocket_universe',
      label: 'Home Universe Bubble',
      sublabel: 'Nucleating Inflationary Singularity · 10^+28 m',
      node: homeBubbleAnchor,
      layerBandId: 'multiverse',
      minLog: 28.5,
      maxLog: 30.5,
      targetLogMeters: 28.0,
      colorCss: '#a855f7',
      physicalRadiusWorldAtOneToOne: 9.8,
    });

    return (dt, elapsed) => {
      group.rotation.y += dt * 0.02;
      const coronaPulse = 23.5 + Math.sin(elapsed * 1.4) * 1.2;
      homeCorona.scale.setScalar(coronaPulse);
    };
  }

  // --- 2. BIG BANG & COSMIC INFLATION SINGULARITY (+28.0) ---
  private populateBigBangLayer(
    group: THREE.Group,
    glowTex: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    // Two orthogonal crossed volumetric plasma slices eliminate 3x CPU/GPU fragment overdraw during dive
    for (let s = 0; s < 2; s++) {
      const plasmaPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(28, 28),
        createVolumetricNebulaMaterial({
          seedOffset: 11.4 + s * 5.3,
          hubblePaletteMix: 0.75,
          opacity: 0.68,
          isInnerCore: s === 0,
        })
      );
      plasmaPlane.rotation.set(s * 0.72, s * (Math.PI * 0.45), s * 0.35);
      group.add(plasmaPlane);
    }

    const coreHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xfff7ed,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.85,
      })
    );
    coreHalo.scale.setScalar(18.0);
    group.add(coreHalo);

    const count = this.isSoftwareGl ? 800 : 2600;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sc = new Float32Array(count);
    const lum = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(seededRand(i * 5 + 1), 1.6) * 20.5;
      const theta = Math.acos(2 * seededRand(i * 5 + 2) - 1);
      const phi = seededRand(i * 5 + 3) * Math.PI * 2;
      pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.cos(theta);
      pos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
      // Cooling plasma gradient: 28,000K blue-white center -> 3,000K recombination amber rim
      const tempK = THREE.MathUtils.lerp(28000, 3200, Math.min(1, r / 19.0));
      blackbodyKelvinToRgb(tempK, _scratchColorA);
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;
      sc[i] = 0.6 + seededRand(i * 5 + 4) * 1.8;
      lum[i] = 0.45 + (1 - r / 21.0) * 0.55;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    geo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    group.add(
      new THREE.Points(
        geo,
        createStarPsfMaterial({ baseSize: 14.0, diffractionStrength: 0.35, opacity: 0.9 })
      )
    );

    const bigBangSingularityAnchor = new THREE.Object3D();
    group.add(bigBangSingularityAnchor);
    this.registerMarkerAnchor({
      id: 'marker_inflation_singularity',
      label: 'Cosmic Inflation Envelope',
      sublabel: 'Relativistic Quark-Gluon Plasma · 10^+27.2 m',
      node: bigBangSingularityAnchor,
      layerBandId: 'big_bang',
      minLog: 27.2,
      maxLog: 29.5,
      targetLogMeters: 27.2,
      colorCss: '#fef08a',
      physicalRadiusWorldAtOneToOne: 18.0,
    });

    return (dt, elapsed) => {
      group.rotation.y += dt * 0.06 * this.bigBangSpeedScale;
      const pulse = 17.2 + Math.sin(elapsed * 1.8 * this.bigBangSpeedScale) * 1.1;
      coreHalo.scale.setScalar(pulse);
    };
  }

  // --- 3. ENTIRE EVOLVED UNIVERSE SPACETIME MANIFOLD (+27.2) ---
  private populateUniverseManifoldLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    // 1. Metric expansion grid plane with BAO acoustic ripples
    const manifoldMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 52, this.isSoftwareGl ? 32 : 54, this.isSoftwareGl ? 32 : 54),
      createSpacetimeManifoldMaterial({ opacity: 0.88 })
    );
    manifoldMesh.rotation.x = -Math.PI / 2.35;
    group.add(manifoldMesh);

    // 2. Cosmic horizon boundary sphere (kept translucent so Observable CMB sphere stays primary)
    const horizonSphere = new THREE.Mesh(
      new THREE.SphereGeometry(22.0, this.isSoftwareGl ? 24 : 44, this.isSoftwareGl ? 18 : 32),
      createCmbAnisotropyMaterial(0.22)
    );
    group.add(horizonSphere);

    // 3. Primordial perturbation nodes seeding future cosmic web
    const nodeCount = this.isSoftwareGl ? 500 : 1600;
    const pos = new Float32Array(nodeCount * 3);
    const col = new Float32Array(nodeCount * 3);
    const sc = new Float32Array(nodeCount);
    const lum = new Float32Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) {
      const r = Math.pow(seededRand(i * 7 + 1), 0.75) * 20.0;
      const theta = Math.acos(2 * seededRand(i * 7 + 2) - 1);
      const phi = seededRand(i * 7 + 3) * Math.PI * 2;
      pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.cos(theta) * 0.45;
      pos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

      blackbodyKelvinToRgb(THREE.MathUtils.lerp(18000, 3800, r / 20.0), _scratchColorA);
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;
      sc[i] = 0.5 + seededRand(i * 7 + 4) * 1.6;
      lum[i] = 0.4 + seededRand(i * 7 + 5) * 0.6;
    }
    const nGeo = new THREE.BufferGeometry();
    nGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    nGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    nGeo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    nGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    group.add(
      new THREE.Points(
        nGeo,
        createStarPsfMaterial({ baseSize: 12.0, diffractionStrength: 0.28, opacity: 0.88 })
      )
    );

    const observableAnchor = new THREE.Object3D();
    group.add(observableAnchor);
    this.registerMarkerAnchor({
      id: 'marker_observable_horizon',
      label: 'Observable Horizon (CMB)',
      sublabel: '93.0 Gly Particle Horizon · 10^+26.94 m',
      node: observableAnchor,
      layerBandId: 'universe',
      minLog: 26.8,
      maxLog: 27.8,
      targetLogMeters: 26.94,
      colorCss: '#60a5fa',
      physicalRadiusWorldAtOneToOne: 0.15,
    });

    return (dt) => {
      group.rotation.y += dt * 0.024;
    };
  }

  // --- 4. OBSERVABLE UNIVERSE · 93.0 GLY CMB SPHERE (+26.94) ---
  private populateObservableUniverseLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const cmbShell = new THREE.Mesh(
      new THREE.SphereGeometry(21.5, this.isSoftwareGl ? 32 : 56, this.isSoftwareGl ? 24 : 40),
      createCmbAnisotropyMaterial(0.84)
    );
    group.add(cmbShell);

    const count = this.isSoftwareGl ? 700 : 2400;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sc = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 19.8 * Math.cbrt(seededRand(i * 7 + 1));
      const theta = Math.acos(2 * seededRand(i * 7 + 2) - 1);
      const phi = seededRand(i * 7 + 3) * Math.PI * 2;
      pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.cos(theta);
      pos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
      const redshift = r / 19.8;
      blackbodyKelvinToRgb(THREE.MathUtils.lerp(9500, 2900, redshift), _scratchColorA);
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;
      sc[i] = 0.7 + seededRand(i * 7 + 4) * 1.6;
      seeds[i] = seededRand(i * 7 + 5);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    group.add(new THREE.Points(geo, createDeepFieldGalaxyMaterial(0.92)));

    const cosmicWebAnchor = new THREE.Object3D();
    group.add(cosmicWebAnchor);
    this.registerMarkerAnchor({
      id: 'marker_cosmic_web',
      label: 'Cosmic Web Filaments',
      sublabel: 'Dark Matter Halos & 100 Mly Boötes Voids · 10^+25.2 m',
      node: cosmicWebAnchor,
      layerBandId: 'observable',
      minLog: 25.0,
      maxLog: 27.2,
      targetLogMeters: 25.2,
      colorCss: '#818cf8',
      physicalRadiusWorldAtOneToOne: 0.12,
    });

    return (dt) => {
      group.rotation.y += dt * 0.035;
    };
  }

  // --- 5. COSMIC WEB & INTERGALACTIC VOIDS (+25.2 · 1.7 Gly) ---
  private populateCosmicWebLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const clusterNodes: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
    const nodeCount = 18;
    for (let i = 1; i < nodeCount; i++) {
      const theta = Math.acos(2 * seededRand(i * 13 + 1) - 1);
      const phi = seededRand(i * 13 + 2) * Math.PI * 2;
      const r = 8.5 + seededRand(i * 13 + 3) * 15.0;
      clusterNodes.push(
        new THREE.Vector3(
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.cos(theta) * 0.65,
          r * Math.sin(theta) * Math.sin(phi)
        )
      );
    }

    const filamentCurves: THREE.QuadraticBezierCurve3[] = [];
    const ribbonMat = createCosmicFilamentRibbonMaterial(0.42);

    for (let i = 0; i < clusterNodes.length; i++) {
      for (let j = i + 1; j < clusterNodes.length; j++) {
        const a = clusterNodes[i];
        const b = clusterNodes[j];
        const d = a.distanceTo(b);
        if (d < 14.5 || (i === 0 && d < 18.0)) {
          const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
          const seed = i * 31 + j * 17;
          mid.x += (seededRand(seed + 1) - 0.5) * d * 0.32;
          mid.y += (seededRand(seed + 2) - 0.5) * d * 0.32;
          mid.z += (seededRand(seed + 3) - 0.5) * d * 0.32;
          const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
          filamentCurves.push(curve);

          const steps = this.isSoftwareGl ? 8 : 14;
          for (let planeIdx = 0; planeIdx < 2; planeIdx++) {
            const stripGeo = new THREE.PlaneGeometry(1, 1, 1, steps);
            const posAttr = stripGeo.attributes.position;
            const halfW = i === 0 ? 0.95 : 0.65;
            for (let s = 0; s <= steps; s++) {
              const t = s / steps;
              curve.getPoint(t, _scratchVecA);
              curve.getTangent(t, _scratchVecB);
              if (planeIdx === 0) {
                _scratchVecC.crossVectors(_scratchVecB, _upUnitVec);
                if (_scratchVecC.lengthSq() < 0.001) _scratchVecC.set(1, 0, 0);
                _scratchVecC.normalize();
              } else {
                _scratchVecC.crossVectors(_scratchVecB, _upUnitVec).normalize();
                _scratchVecC.crossVectors(_scratchVecC, _scratchVecB).normalize();
              }
              const pinch = halfW * (1.35 - 0.55 * Math.sin(t * Math.PI));
              posAttr.setXYZ(
                s * 2,
                _scratchVecA.x - _scratchVecC.x * pinch,
                _scratchVecA.y - _scratchVecC.y * pinch,
                _scratchVecA.z - _scratchVecC.z * pinch
              );
              posAttr.setXYZ(
                s * 2 + 1,
                _scratchVecA.x + _scratchVecC.x * pinch,
                _scratchVecA.y + _scratchVecC.y * pinch,
                _scratchVecA.z + _scratchVecC.z * pinch
              );
            }
            group.add(new THREE.Mesh(stripGeo, ribbonMat));
          }
        }
      }
    }

    const galCount = this.isSoftwareGl ? 1200 : 3800;
    const gPos = new Float32Array(galCount * 3);
    const gCol = new Float32Array(galCount * 3);
    const gScale = new Float32Array(galCount);
    const gSeed = new Float32Array(galCount);

    for (let g = 0; g < galCount; g++) {
      const curve = filamentCurves[g % Math.max(1, filamentCurves.length)];
      const u = seededRand(g * 5 + 1);
      const t = u < 0.5 ? 0.5 * Math.pow(u * 2, 1.5) : 1 - 0.5 * Math.pow((1 - u) * 2, 1.5);
      curve.getPoint(t, _scratchVecA);

      const sigma = 0.32 + 1.1 * Math.sin(t * Math.PI);
      const rx = (seededRand(g * 5 + 2) + seededRand(g * 5 + 3) - 1.0) * sigma * 1.8;
      const ry = (seededRand(g * 5 + 4) + seededRand(g * 7 + 1) - 1.0) * sigma * 1.8;
      const rz = (seededRand(g * 7 + 2) + seededRand(g * 7 + 3) - 1.0) * sigma * 1.8;

      gPos[g * 3] = _scratchVecA.x + rx;
      gPos[g * 3 + 1] = _scratchVecA.y + ry;
      gPos[g * 3 + 2] = _scratchVecA.z + rz;

      const knotProx = 1 - Math.sin(t * Math.PI);
      blackbodyKelvinToRgb(
        THREE.MathUtils.lerp(9200, 4100, knotProx * 0.85 + seededRand(g * 3 + 4) * 0.15),
        _scratchColorA
      );
      gCol[g * 3] = _scratchColorA.r;
      gCol[g * 3 + 1] = _scratchColorA.g;
      gCol[g * 3 + 2] = _scratchColorA.b;
      gScale[g] = 0.55 + Math.pow(seededRand(g * 9 + 1), 2.4) * 2.2;
      gSeed[g] = seededRand(g * 9 + 2);
    }

    const galGeo = new THREE.BufferGeometry();
    galGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    galGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
    galGeo.setAttribute('aScale', new THREE.BufferAttribute(gScale, 1));
    galGeo.setAttribute('aSeed', new THREE.BufferAttribute(gSeed, 1));
    group.add(new THREE.Points(galGeo, createDeepFieldGalaxyMaterial(0.95)));

    const majorFilamentAnchor = new THREE.Object3D();
    group.add(majorFilamentAnchor);
    this.registerMarkerAnchor({
      id: 'marker_major_filament',
      label: 'Cosmic Filament Wall',
      sublabel: '105 Mly · Dark Matter Bridge to Superclusters · 10^+24.0 m',
      node: majorFilamentAnchor,
      layerBandId: 'cosmic_web',
      minLog: 23.8,
      maxLog: 25.5,
      targetLogMeters: 24.0,
      colorCss: '#67e8f9',
      physicalRadiusWorldAtOneToOne: 0.14,
    });

    return (dt) => {
      group.rotation.y -= dt * 0.032;
    };
  }

  // --- 6. COSMIC FILAMENT WALL (+24.0 · 105 Mly) ---
  private populateFilamentLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const spinePoints = [
      new THREE.Vector3(-18.0, -4.5, -8.0),
      new THREE.Vector3(-8.0, -1.2, -2.5),
      new THREE.Vector3(0.0, 0.0, 0.0),
      new THREE.Vector3(9.5, 2.1, 4.0),
      new THREE.Vector3(20.0, 5.2, 9.5),
    ];
    const spineCurve = new THREE.CatmullRomCurve3(spinePoints);

    const ribbonMat = createCosmicFilamentRibbonMaterial(0.55);
    const steps = this.isSoftwareGl ? 14 : 28;
    for (let p = 0; p < 3; p++) {
      const planeGeo = new THREE.PlaneGeometry(1, 1, 1, steps);
      const posAttr = planeGeo.attributes.position;
      const angle = (p * Math.PI) / 3;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        spineCurve.getPoint(t, _scratchVecA);
        spineCurve.getTangent(t, _scratchVecB);
        _scratchVecC.crossVectors(_scratchVecB, _upUnitVec);
        if (_scratchVecC.lengthSq() < 0.001) _scratchVecC.set(1, 0, 0);
        _scratchVecC.normalize().applyAxisAngle(_scratchVecB, angle);

        const width = 2.4 * (1.15 - 0.45 * Math.sin(t * Math.PI));
        posAttr.setXYZ(
          s * 2,
          _scratchVecA.x - _scratchVecC.x * width,
          _scratchVecA.y - _scratchVecC.y * width,
          _scratchVecA.z - _scratchVecC.z * width
        );
        posAttr.setXYZ(
          s * 2 + 1,
          _scratchVecA.x + _scratchVecC.x * width,
          _scratchVecA.y + _scratchVecC.y * width,
          _scratchVecA.z + _scratchVecC.z * width
        );
      }
      group.add(new THREE.Mesh(planeGeo, ribbonMat));
    }

    const galCount = this.isSoftwareGl ? 900 : 2600;
    const gPos = new Float32Array(galCount * 3);
    const gCol = new Float32Array(galCount * 3);
    const gScale = new Float32Array(galCount);
    const gSeed = new Float32Array(galCount);

    for (let g = 0; g < galCount; g++) {
      const t = seededRand(g * 7 + 1);
      spineCurve.getPoint(t, _scratchVecA);

      const rScatter = Math.pow(seededRand(g * 7 + 2), 1.6) * 3.4;
      const phi = seededRand(g * 7 + 3) * Math.PI * 2;
      gPos[g * 3] = _scratchVecA.x + rScatter * Math.cos(phi);
      gPos[g * 3 + 1] = _scratchVecA.y + rScatter * Math.sin(phi) * 0.75;
      gPos[g * 3 + 2] = _scratchVecA.z + (seededRand(g * 7 + 4) - 0.5) * 1.5;

      blackbodyKelvinToRgb(
        THREE.MathUtils.lerp(8800, 4200, seededRand(g * 7 + 5)),
        _scratchColorA
      );
      gCol[g * 3] = _scratchColorA.r;
      gCol[g * 3 + 1] = _scratchColorA.g;
      gCol[g * 3 + 2] = _scratchColorA.b;
      gScale[g] = 0.6 + seededRand(g * 7 + 6) * 1.8;
      gSeed[g] = seededRand(g * 7 + 7);
    }

    const galGeo = new THREE.BufferGeometry();
    galGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    galGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
    galGeo.setAttribute('aScale', new THREE.BufferAttribute(gScale, 1));
    galGeo.setAttribute('aSeed', new THREE.BufferAttribute(gSeed, 1));
    group.add(new THREE.Points(galGeo, createDeepFieldGalaxyMaterial(0.94)));

    const superclusterAnchor = new THREE.Object3D();
    group.add(superclusterAnchor);
    this.registerMarkerAnchor({
      id: 'marker_laniakea_supercluster',
      label: 'Laniakea Supercluster',
      sublabel: 'Gravitational Basin · 100,000 Galaxies Flow to Great Attractor · 10^+23.0 m',
      node: superclusterAnchor,
      layerBandId: 'filament',
      minLog: 22.8,
      maxLog: 24.3,
      targetLogMeters: 23.0,
      colorCss: '#fbbf24',
      physicalRadiusWorldAtOneToOne: 0.16,
    });

    return (dt) => {
      group.rotation.y += dt * 0.034;
    };
  }

  // --- 7. SUPERCLUSTER · LANIAKEA GRAVITATIONAL WATERSHED (+23.0 · 10.5 Mly) ---
  private populateSuperclusterLayer(
    group: THREE.Group,
    glowTex: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const streamCount = this.isSoftwareGl ? 48 : 110;
    const ptsPerStream = this.isSoftwareGl ? 24 : 46;
    const totalPts = streamCount * ptsPerStream;
    const pos = new Float32Array(totalPts * 3);
    const col = new Float32Array(totalPts * 3);
    const sc = new Float32Array(totalPts);
    const lum = new Float32Array(totalPts);

    let idx = 0;
    for (let s = 0; s < streamCount; s++) {
      const theta = Math.acos(2 * seededRand(s * 11 + 1) - 1);
      const phi = seededRand(s * 11 + 2) * Math.PI * 2;
      const maxR = 14.0 + seededRand(s * 11 + 3) * 9.0;
      const curlA = (seededRand(s * 11 + 4) - 0.5) * 1.9;
      const curlB = (seededRand(s * 11 + 5) - 0.5) * 2.4;

      for (let p = 0; p < ptsPerStream; p++) {
        const t = p / (ptsPerStream - 1);
        const r = maxR * Math.pow(1 - t * 0.96, 0.85);
        const ang = phi + curlA * t;
        const scatter = (0.18 + (1 - t) * 0.45) * (seededRand(idx * 3 + 1) - 0.5);
        pos[idx * 3] = r * Math.sin(theta) * Math.cos(ang) + scatter;
        pos[idx * 3 + 1] =
          r * Math.cos(theta) * 0.52 + Math.sin(t * 4.2 + curlB) * 1.1 + scatter;
        pos[idx * 3 + 2] = r * Math.sin(theta) * Math.sin(ang) + scatter;

        blackbodyKelvinToRgb(THREE.MathUtils.lerp(8200, 4100, Math.pow(t, 0.7)), _scratchColorA);
        col[idx * 3] = _scratchColorA.r;
        col[idx * 3 + 1] = _scratchColorA.g;
        col[idx * 3 + 2] = _scratchColorA.b;
        sc[idx] = 0.45 + Math.pow(t, 1.5) * 1.65;
        lum[idx] = 0.35 + t * 0.65;
        idx++;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    geo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    group.add(
      new THREE.Points(
        geo,
        createStarPsfMaterial({ baseSize: 12.5, diffractionStrength: 0.22, opacity: 0.94 })
      )
    );

    const attractorGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xfde68a,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    attractorGlow.scale.setScalar(9.5);
    group.add(attractorGlow);

    const virgoClusterAnchor = new THREE.Object3D();
    virgoClusterAnchor.position.set(4.2, 0.8, 2.6);
    group.add(virgoClusterAnchor);
    this.registerMarkerAnchor({
      id: 'marker_virgo_cluster',
      label: 'Virgo Galaxy Cluster',
      sublabel: '2,000 Bound Galaxies in Hot X-Ray Plasma · 10^+22.2 m',
      node: virgoClusterAnchor,
      layerBandId: 'supercluster',
      minLog: 21.8,
      maxLog: 23.4,
      targetLogMeters: 22.2,
      colorCss: '#f472b6',
      physicalRadiusWorldAtOneToOne: 0.25,
    });

    return (dt) => {
      group.rotation.y += dt * 0.04;
    };
  }

  // --- 8. GALAXY CLUSTER (VIRGO / COMA SWARM) (+22.2 · 1.7 Mly) ---
  private populateClusterLayer(
    group: THREE.Group,
    glowCool: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const icmPlasma = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      createVolumetricNebulaMaterial({
        seedOffset: 7.8,
        hubblePaletteMix: 0.35,
        opacity: 0.48,
        isInnerCore: true,
      })
    );
    icmPlasma.rotation.x = -Math.PI / 2.2;
    group.add(icmPlasma);

    const count = this.isSoftwareGl ? 700 : 2200;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sc = new Float32Array(count);
    const lum = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const u = seededRand(i * 9 + 1);
      const r = 16.5 * (u / Math.sqrt(1 + (u * 14.0) * (u * 14.0)) * 14.0);
      const theta = Math.acos(2 * seededRand(i * 9 + 2) - 1);
      const phi = seededRand(i * 9 + 3) * Math.PI * 2;

      pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.cos(theta) * 0.58;
      pos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

      const coreFrac = THREE.MathUtils.clamp(1.0 - r / 12.0, 0, 1);
      blackbodyKelvinToRgb(
        THREE.MathUtils.lerp(8600, 3900, coreFrac * 0.8 + seededRand(i * 9 + 4) * 0.2),
        _scratchColorA
      );
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;
      sc[i] = 0.65 + coreFrac * 1.5 + seededRand(i * 9 + 5) * 1.2;
      lum[i] = 0.4 + coreFrac * 0.6;
    }

    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    cGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    cGeo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    cGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    group.add(
      new THREE.Points(
        cGeo,
        createDeepFieldGalaxyMaterial(0.95)
      )
    );

    const localMilkyWayAnchor = new THREE.Object3D();
    localMilkyWayAnchor.position.set(-2.8, -0.6, 3.4);
    group.add(localMilkyWayAnchor);
    this.registerMarkerAnchor({
      id: 'marker_milky_way_disc',
      label: 'Milky Way Galaxy Disc',
      sublabel: '105,700 ly Stellar Disc & Central Sgr A* Core · 10^+21.0 m',
      node: localMilkyWayAnchor,
      layerBandId: 'cluster',
      minLog: 20.8,
      maxLog: 22.6,
      targetLogMeters: 21.0,
      colorCss: '#60a5fa',
      physicalRadiusWorldAtOneToOne: 0.12,
    });

    return (dt) => {
      group.rotation.y -= dt * 0.045;
    };
  }

  // --- 9 & 10 UNIFIED. MILKY WAY GALAXY & SPIRAL ARMS (+21.0 -> +19.4 · ORION-CYGNUS SPUR) ---
  // Combines galactic disc, Sagittarius A* bulge, globular halo, spiral arms, OB associations,
  // and Orion-Cygnus Spur gas ribbons into ONE continuous structure across Galaxy & Spiral Arms.
  private populateGalaxyLayer(
    group: THREE.Group,
    glowTex: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const galaxyTilt = new THREE.Group();
    galaxyTilt.rotation.x = 0.58;
    galaxyTilt.rotation.z = -0.22;
    group.add(galaxyTilt);
    this.spiralGalaxyTiltGroup = galaxyTilt;

    const galaxySpin = new THREE.Group();
    galaxyTilt.add(galaxySpin);
    this.spiralGalaxySpinGroup = galaxySpin;

    // 1. Morphology-reactive Volumetric Stellar Continuum + Dark Absorbing Spiral/Bar Dust Lanes
    this.spiralGalaxyDiscMat = createSpiralGalaxyDiscMaterial({
      arms: 2,
      opacity: 0.95,
      morphology: this.galaxyMorphology,
    });
    const discMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      this.spiralGalaxyDiscMat
    );
    discMesh.rotation.x = -Math.PI / 2;
    galaxySpin.add(discMesh);
    this.spiralGalaxyDiscMesh = discMesh;

    // 2. Sagittarius A* Supermassive Black Hole Event Horizon + Gravitational Lensing Glint
    const smbhAnchor = new THREE.Object3D();
    smbhAnchor.position.set(0, 0, 0);
    galaxySpin.add(smbhAnchor);
    const smbhGlint = this.createSinglePointGlint(0xffedd5, 18.0, 0.95);
    galaxySpin.add(smbhGlint);

    this.registerMarkerAnchor({
      id: 'marker_smbh_sagittarius_a',
      label: 'Sagittarius A* SMBH',
      sublabel: '4.15M Solar Masses · Galactic Core · 10^+21.0 m',
      node: smbhAnchor,
      layerBandId: 'galaxy',
      minLog: 19.6,
      maxLog: 22.2,
      targetLogMeters: 21.0,
      colorCss: '#fde68a',
      physicalRadiusWorldAtOneToOne: 0.002,
    });

    // Earth / Solar System Milky Way position on Orion-Cygnus Spur (~26,000 ly out of 52,850 ly)
    const armX = Math.cos(HOME_GALAXY_ARM_THETA) * HOME_GALAXY_ARM_RADIUS;
    const armZ = -Math.sin(HOME_GALAXY_ARM_THETA) * HOME_GALAXY_ARM_RADIUS;

    // 3. 4,400 PSF Galactic Disc Stars, Spiral Arm Clusters, Orion Spur Bridge & Globular Halo
    const starCount = this.isSoftwareGl ? 1400 : 4400;
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const sc = new Float32Array(starCount);
    const lum = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const isHaloCluster = i % 16 === 0;
      const isOrionBridge = !isHaloCluster && i % 11 === 0;
      if (isHaloCluster) {
        const r = 3.0 + Math.pow(seededRand(i * 7 + 1), 1.4) * 18.5;
        const theta = Math.acos(2 * seededRand(i * 7 + 2) - 1);
        const phi = seededRand(i * 7 + 3) * Math.PI * 2;
        pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
        pos[i * 3 + 1] = r * Math.cos(theta) * 0.65;
        pos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
        blackbodyKelvinToRgb(4300, _scratchColorA);
        sc[i] = 0.85;
        lum[i] = 0.6;
      } else if (isOrionBridge) {
        // Dedicated Milky Way Orion-Cygnus Spur stellar bridge connecting through Earth's neighborhood
        const uSpur = seededRand(i * 7 + 1) - 0.5;
        const r = HOME_GALAXY_ARM_RADIUS + uSpur * 4.4;
        const ang =
          HOME_GALAXY_ARM_THETA +
          uSpur * 0.62 +
          (seededRand(i * 7 + 2) - 0.5) * 0.16;
        const zThick = (seededRand(i * 7 + 4) - 0.5) * 0.45;
        pos[i * 3] = Math.cos(ang) * r;
        pos[i * 3 + 1] = zThick;
        pos[i * 3 + 2] = -Math.sin(ang) * r;
        blackbodyKelvinToRgb(11500 + seededRand(i * 3 + 1) * 14500, _scratchColorA);
        sc[i] = 0.65 + seededRand(i * 3 + 2) * 1.05;
        lum[i] = 0.6 + seededRand(i * 3 + 3) * 0.35;
      } else {
        const u = Math.max(0.02, Math.pow(seededRand(i * 7 + 1), 0.78));
        const r = u * 19.5;
        const armIdx = i % 2;
        const logAngle = armIdx * Math.PI + 2.4 * Math.log(Math.max(0.035, u));
        const scatter =
          (0.22 + u * 0.52) *
          (seededRand(i * 7 + 2) + seededRand(i * 7 + 3) - 1.0);
        const ang = logAngle + scatter;
        const zThick = (seededRand(i * 7 + 4) - 0.5) * (1.5 / (1 + r * 0.25));

        pos[i * 3] = Math.cos(ang) * r;
        pos[i * 3 + 1] = zThick;
        pos[i * 3 + 2] = -Math.sin(ang) * r;

        if (r < 3.4) {
          blackbodyKelvinToRgb(4400 + seededRand(i * 3 + 1) * 1200, _scratchColorA);
          sc[i] = 0.8 + seededRand(i * 3 + 2) * 1.1;
          lum[i] = 0.85;
        } else if (i % 9 === 0) {
          // H-alpha 656nm Crimson-Rose H-II Emission Nebula Knot
          _scratchColorA.setRGB(0.98, 0.24, 0.46);
          sc[i] = 1.25 + seededRand(i * 3 + 2) * 1.2;
          lum[i] = 0.92;
        } else {
          // Young OB Blue-White Spiral Arm Supergiants
          blackbodyKelvinToRgb(10500 + seededRand(i * 3 + 1) * 14000, _scratchColorA);
          sc[i] = 0.5 + seededRand(i * 3 + 2) * 1.15;
          lum[i] = 0.5 + seededRand(i * 3 + 3) * 0.45;
        }
      }
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    starGeo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    starGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    galaxySpin.add(
      new THREE.Points(
        starGeo,
        createStarPsfMaterial({ baseSize: 11.5, diffractionStrength: 0.38, opacity: 0.95 })
      )
    );

    // 4. Combined Spiral Arm Dense OB Supergiants, Open Clusters & H-II Star-Forming Knots
    // Embedded directly along the Orion-Cygnus Spur around Earth's galactic coordinates so
    // zooming into Spiral Arms (19.4) expands the exact same galactic starfield seamlessly.
    const spurTangentAngle = HOME_GALAXY_ARM_THETA + Math.PI * 0.5 - 0.26;
    const tangX = Math.cos(spurTangentAngle);
    const tangZ = -Math.sin(spurTangentAngle);
    const perpX = Math.cos(HOME_GALAXY_ARM_THETA);
    const perpZ = -Math.sin(HOME_GALAXY_ARM_THETA);

    const spurStarCount = this.isSoftwareGl ? 750 : 2600;
    const sPos = new Float32Array(spurStarCount * 3);
    const sCol = new Float32Array(spurStarCount * 3);
    const sSc = new Float32Array(spurStarCount);
    const sLum = new Float32Array(spurStarCount);

    for (let i = 0; i < spurStarCount; i++) {
      const isLocalNeighborhood = i % 3 === 0;
      const along = isLocalNeighborhood
        ? (seededRand(i * 11 + 1) - 0.5) * 1.15
        : (seededRand(i * 11 + 1) - 0.5) * 6.4;
      const across = isLocalNeighborhood
        ? (seededRand(i * 11 + 2) + seededRand(i * 11 + 3) - 1.0) * 0.42
        : (seededRand(i * 11 + 2) + seededRand(i * 11 + 3) - 1.0) * 1.05;
      const vert = isLocalNeighborhood
        ? (seededRand(i * 11 + 4) - 0.5) * 0.22
        : (seededRand(i * 11 + 4) - 0.5) * 0.46;

      // Subtle spiral curvature along the Orion-Cygnus Spur arc
      const curveBend = along * along * 0.055;
      sPos[i * 3] = armX + tangX * along + perpX * (across - curveBend);
      sPos[i * 3 + 1] = vert;
      sPos[i * 3 + 2] = armZ + tangZ * along + perpZ * (across - curveBend);

      if (i % 7 === 0) {
        // H-II ionized emission node
        _scratchColorA.setRGB(0.96, 0.22, 0.44);
        sSc[i] = isLocalNeighborhood ? 0.95 + seededRand(i * 7 + 5) * 0.95 : 1.15 + seededRand(i * 7 + 5) * 1.05;
        sLum[i] = 0.88;
      } else {
        // Young OB Supergiants & Solar-type neighborhood stars (4,800–30,000 K)
        const kelvin =
          i % 4 === 0
            ? 4800 + seededRand(i * 7 + 5) * 3200
            : 12000 + seededRand(i * 7 + 5) * 18000;
        blackbodyKelvinToRgb(kelvin, _scratchColorA);
        sSc[i] = (isLocalNeighborhood ? 0.55 : 0.45) + seededRand(i * 7 + 6) * 1.15;
        sLum[i] = 0.48 + seededRand(i * 7 + 7) * 0.52;
      }
      sCol[i * 3] = _scratchColorA.r;
      sCol[i * 3 + 1] = _scratchColorA.g;
      sCol[i * 3 + 2] = _scratchColorA.b;
    }

    const spurStarGeo = new THREE.BufferGeometry();
    spurStarGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    spurStarGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    spurStarGeo.setAttribute('aScale', new THREE.BufferAttribute(sSc, 1));
    spurStarGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(sLum, 1));
    galaxySpin.add(
      new THREE.Points(
        spurStarGeo,
        createStarPsfMaterial({
          baseSize: 10.5,
          minPixelSize: 1.4,
          maxPixelSize: 22.0,
          diffractionStrength: 0.44,
          opacity: 0.94,
        })
      )
    );

    // 5. Combined Orion-Cygnus Spur Density-Wave Nebula Ribbons & Dust Rifts (at physical 1:1 scale)
    this.spiralGalaxyArmRibbons = [];
    const ribbonCount = this.isSoftwareGl ? 3 : 6;
    for (let r = 0; r < ribbonCount; r++) {
      const frac = ribbonCount > 1 ? r / (ribbonCount - 1) - 0.5 : 0;
      const along = frac * 0.85;
      const across = (seededRand(r * 13 + 3) - 0.5) * 0.24;
      const vert = (r - ribbonCount / 2) * 0.032;
      const ribbonPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.34),
        createVolumetricNebulaMaterial({
          seedOffset: 12.4 + r * 3.1,
          hubblePaletteMix: 0.22,
          opacity: 0.62,
          isInnerCore: r % 2 === 0,
        })
      );
      ribbonPlane.position.set(
        armX + tangX * along + perpX * across,
        vert,
        armZ + tangZ * along + perpZ * across
      );
      ribbonPlane.rotation.y = spurTangentAngle + (r % 2 === 0 ? 0.25 : -0.25);
      ribbonPlane.rotation.x = (r - ribbonCount / 2) * 0.14;
      galaxySpin.add(ribbonPlane);
      this.spiralGalaxyArmRibbons.push(ribbonPlane);
    }

    // 6. 3D Warm Old-Star Sersic Bulge Halo (restrained opacity so edge-on spiral view stays crisp)
    const bulgeHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffedd5,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    bulgeHalo.scale.set(9.5, 6.2, 1.0);
    galaxySpin.add(bulgeHalo);
    this.spiralGalaxyBulgeHalo = bulgeHalo;

    // 7. Orion-Cygnus Spur Marker Anchor (Earth's Milky Way Spiral Arm Location)
    const armSpurAnchor = new THREE.Object3D();
    armSpurAnchor.position.set(armX, 0, armZ);
    galaxySpin.add(armSpurAnchor);

    const homeSpurBeacon = this.createSinglePointGlint(0x38bdf8, 19.0, 0.88);
    homeSpurBeacon.position.set(armX, 0, armZ);
    galaxySpin.add(homeSpurBeacon);

    this.registerMarkerAnchor({
      id: 'marker_orion_capy_spur',
      label: 'CapySol System · Orion Spur',
      sublabel: 'CapyWay Galaxy · 26,000 ly from Core · 10^+19.4 m',
      node: armSpurAnchor,
      layerBandId: 'galaxy',
      minLog: 18.6,
      maxLog: 23.0,
      targetLogMeters: 19.4,
      colorCss: '#60a5fa',
      physicalRadiusWorldAtOneToOne: 0.008,
    });

    // 8. Local Giant Molecular Cloud Core Marker inside the Orion Spur leading down to Nebulas
    const h2CoreAnchor = new THREE.Object3D();
    h2CoreAnchor.position.set(armX + tangX * 0.035, 0.004, armZ + tangZ * 0.035);
    galaxySpin.add(h2CoreAnchor);

    const h2CoreBeacon = this.createSinglePointGlint(0xf43f5e, 15.0, 0.5);
    h2CoreBeacon.position.copy(h2CoreAnchor.position);
    galaxySpin.add(h2CoreBeacon);

    this.registerMarkerAnchor({
      id: 'marker_h2_nebula_core',
      label: 'H-II Star-Forming Nebula',
      sublabel: 'Giant Molecular Cloud & Pillars · 10^+17.2 m',
      node: h2CoreAnchor,
      layerBandId: 'galaxy',
      minLog: 16.8,
      maxLog: 20.0,
      targetLogMeters: 17.2,
      colorCss: '#f43f5e',
      physicalRadiusWorldAtOneToOne: 0.024,
    });

    return (dt) => {
      // Gently decelerate galactic spin once locked into the co-rotating Orion-Cygnus Spur frame
      const spinRate = 0.045 * (1.0 - 0.84 * this.lastGalaxyFocusBlend);
      galaxySpin.rotation.y += dt * spinRate;
    };
  }

  // --- 10. SPIRAL ARMS (+19.4 · SHARED CONTINUOUS ORION-CYGNUS SPUR) ---
  // Geometry, ribbons & stars are combined directly inside ScaleLayer_galaxy so zooming from Galaxy
  // into Spiral Arms never swaps scenes; this band retains scale telemetry & sky interpolation.
  private populateSpiralArmsLayer(
    _group: THREE.Group,
    _glowCool: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    return () => {};
  }

  // --- 11. NEBULAS & MOLECULAR CLOUDS (+17.2 · 50 ly · M16 PILLARS & STELLAR NURSERY) ---
  private populateNebulaLayer(
    group: THREE.Group,
    glowCool: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    // 1. Multi-angle crossed volumetric FBM emission + Bok-globule extinction shader planes
    const sliceAngles: Array<[number, number, number, number, boolean]> = [
      [0.0, 0.0, 0.0, 1.1, false],
      [0.42, 0.78, 0.18, 2.7, false],
      [-0.52, -0.68, 0.35, 4.3, false],
      [0.88, 0.15, -0.44, 6.1, true],
      [-0.22, 1.32, 0.52, 8.4, true],
    ];

    const count = this.isSoftwareGl ? 3 : sliceAngles.length;
    for (let i = 0; i < count; i++) {
      const [rx, ry, rz, seed, inner] = sliceAngles[i];
      const size = inner ? 28 : 42;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        createVolumetricNebulaMaterial({
          seedOffset: seed,
          hubblePaletteMix: 0.35,
          opacity: inner ? 0.68 : 0.76,
          isInnerCore: inner,
        })
      );
      plane.rotation.set(rx, ry, rz);
      plane.renderOrder = i;
      group.add(plane);
    }

    // 2. Towering M16 Absorptive Molecular H2 Dust Pillars (crossed volumetric billboards)
    const pillarConfigs = [
      { x: -5.4, y: -1.2, z: -1.4, w: 11.5, h: 25.5, tiltZ: -0.20, seed: 1.3 },
      { x: 0.2, y: 0.4, z: 0.0, w: 12.8, h: 28.5, tiltZ: -0.10, seed: 3.7 },
      { x: 5.8, y: -2.8, z: 1.5, w: 9.8, h: 20.5, tiltZ: -0.24, seed: 6.1 },
    ];

    for (let i = 0; i < pillarConfigs.length; i++) {
      const cfg = pillarConfigs[i];
      const pillarHolder = new THREE.Group();
      pillarHolder.position.set(cfg.x, cfg.y, cfg.z);
      pillarHolder.rotation.z = cfg.tiltZ;

      const matA = createDustPillarMaterial({ seed: cfg.seed, hubblePaletteMix: 0.5, opacity: 0.78 });
      const quadA = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.h), matA);
      quadA.renderOrder = 2 + i * 2;
      pillarHolder.add(quadA);

      if (!this.isSoftwareGl) {
        const matB = createDustPillarMaterial({
          seed: cfg.seed + 0.85,
          hubblePaletteMix: 0.5,
          opacity: 0.56,
        });
        const quadB = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w * 0.92, cfg.h), matB);
        quadB.rotation.y = Math.PI * 0.38;
        quadB.renderOrder = 3 + i * 2;
        pillarHolder.add(quadB);
      }
      group.add(pillarHolder);
    }

    // 3. Embedded Trapezium OB Young Open Star Cluster with crisp HST diffraction spikes
    const starCount = this.isSoftwareGl ? 180 : 520;
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const sc = new Float32Array(starCount);
    const lum = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const isTrapezium = i < 7;
      const r = isTrapezium
        ? Math.pow(seededRand(i * 5 + 1), 1.2) * 2.6
        : 2.2 + Math.pow(seededRand(i * 5 + 1), 0.9) * 18.0;
      const theta = Math.acos(2 * seededRand(i * 5 + 2) - 1);
      const phi = seededRand(i * 5 + 3) * Math.PI * 2;
      pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.cos(theta);
      pos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

      const kelvin = isTrapezium ? 28000 : 4200 + seededRand(i * 5 + 4) * 20000;
      blackbodyKelvinToRgb(kelvin, _scratchColorA);
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;
      sc[i] = isTrapezium ? 2.4 + (i === 0 ? 1.1 : 0.0) : 0.55 + seededRand(i * 5 + 5) * 1.4;
      lum[i] = isTrapezium ? 1.0 : 0.35 + seededRand(i * 7 + 1) * 0.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    geo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    const obCluster = new THREE.Points(
      geo,
      createStarPsfMaterial({
        baseSize: 16.0,
        maxPixelSize: 42.0,
        diffractionStrength: 0.72,
        opacity: 0.98,
      })
    );
    obCluster.renderOrder = 10;
    group.add(obCluster);

    // 4. Collimated Herbig-Haro Bipolar Protostellar Shock Jet at (0,0,0) leading down to Solar System!
    const hhGroup = new THREE.Group();
    hhGroup.rotation.z = 0.26;
    const jetSpriteTop = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowCool,
        color: 0x38bdf8,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    jetSpriteTop.position.set(0, 3.2, 0.5);
    jetSpriteTop.scale.set(1.2, 6.8, 1);
    const jetSpriteBot = jetSpriteTop.clone();
    jetSpriteBot.position.set(0, -3.2, 0.5);
    hhGroup.add(jetSpriteTop, jetSpriteBot);

    const protostarPinpoint = this.createSinglePointGlint(0xfffbeb, 15.0, 0.85);
    hhGroup.add(protostarPinpoint);
    group.add(hhGroup);

    // 5. Nascent Solar System Marker Anchor at (0,0,0)
    const solAnchor = new THREE.Object3D();
    group.add(solAnchor);
    this.registerMarkerAnchor({
      id: 'marker_nascent_solar_system',
      label: 'G2V Solar System',
      sublabel: 'Protostellar Disk & Heliopause · 10^+12.95 m',
      node: solAnchor,
      layerBandId: 'nebulas',
      minLog: 12.5,
      maxLog: 17.5,
      targetLogMeters: 12.95,
      colorCss: '#facc15',
      physicalRadiusWorldAtOneToOne: 0.005,
    });

    return (dt) => {
      group.rotation.y += dt * 0.022;
    };
  }

  // --- 8. SOLAR SYSTEMS & TRUE 1:1 AU PLANETARY ORBITS (+12.95 · 60.2 AU) ---
  private populateSolarSystemLayer(
    group: THREE.Group,
    glowWarm: THREE.CanvasTexture
  ): (dt: number, elapsed: number, gamma: number, showMarkers: boolean) => void {
    const solarFocusContainer = new THREE.Group();
    solarFocusContainer.rotation.x = 0.34;
    group.add(solarFocusContainer);
    this.solarFocusContainer = solarFocusContainer;

    const ecliptic = new THREE.Group();
    solarFocusContainer.add(ecliptic);
    this.solarEclipticGroup = ecliptic;
    this.capyEarthPlanet = null;

    // Canonical scale: 22.0 world units === 30.07 AU (Neptune semi-major axis)
    // True 1:1 Sun radius = 0.00465047 AU => 22.0 * (0.00465047 / 30.07) = 0.003402 world units!
    const sunGeo = new THREE.SphereGeometry(1.0, this.isSoftwareGl ? 24 : 40, 24);
    const sunMat = createSolarPhotosphereMaterial();
    sunMat.uniforms.uAlphaRatio.value = this.fineStructureRatio;
    this.solarSunMat = sunMat;
    this.solarSunMesh = new THREE.Mesh(sunGeo, sunMat);
    ecliptic.add(this.solarSunMesh);

    // Flux-conserving G2V solar PSF diffraction beacon + HDR solar corona
    const sunStarBeacon = this.createSinglePointGlint(0xfff7ed, 22.0, 0.85);
    this.sunStarBeacon = sunStarBeacon;
    ecliptic.add(sunStarBeacon);

    this.solarCoronaSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowWarm,
        color: 0xfde68a,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ecliptic.add(this.solarCoronaSprite);

    const sunAnchor = new THREE.Object3D();
    ecliptic.add(sunAnchor);
    this.registerMarkerAnchor({
      id: 'marker_sun_g2v',
      label: 'CapySol Star (G2V)',
      sublabel: '1.39M km · Heart of CapySol System',
      node: sunAnchor,
      layerBandId: 'stellar_systems',
      minLog: 10.2,
      maxLog: 15.2,
      targetLogMeters: 9.14,
      colorCss: '#facc15',
      physicalRadiusWorldAtOneToOne: 0.0034,
    });

    // Real-Life Astronomical Semi-Major Axes (AU) & True Physical Body Radii (in AU)!
    // 1 AU = 149,597,870.7 km
    const planetDefs: Array<{
      id: string;
      name: string;
      sub: string;
      aAu: number;
      rAu: number;
      ecc: number;
      incDeg: number;
      speed: number;
      colorHex: number;
      colorCss: string;
      ringed: boolean;
      targetLog: number;
    }> = [
      {
        id: 'mercury',
        name: 'Mercury',
        sub: '0.39 AU · 4,879 km',
        aAu: 0.387,
        rAu: 2439.7 / 149597870.7,
        ecc: 0.205,
        incDeg: 7.0,
        speed: 1.65,
        colorHex: 0xa8a29e,
        colorCss: '#d6d3d1',
        ringed: false,
        targetLog: 7.85,
      },
      {
        id: 'venus',
        name: 'Venus',
        sub: '0.72 AU · 12,104 km',
        aAu: 0.723,
        rAu: 6051.8 / 149597870.7,
        ecc: 0.007,
        incDeg: 3.4,
        speed: 1.15,
        colorHex: 0xfde68a,
        colorCss: '#fde68a',
        ringed: false,
        targetLog: 7.85,
      },
      {
        id: 'capy_earth',
        name: 'CapyWorld Planet',
        sub: '1.00 AU · 12,742 km · Habitable',
        aAu: 1.000,
        rAu: 6371.0 / 149597870.7,
        ecc: 0.017,
        incDeg: 0.0,
        speed: 0.85,
        colorHex: 0x38bdf8,
        colorCss: '#34d399',
        ringed: false,
        targetLog: 7.11,
      },
      {
        id: 'mars',
        name: 'Mars',
        sub: '1.52 AU · 6,779 km',
        aAu: 1.524,
        rAu: 3389.5 / 149597870.7,
        ecc: 0.093,
        incDeg: 1.85,
        speed: 0.58,
        colorHex: 0xf97316,
        colorCss: '#fb923c',
        ringed: false,
        targetLog: 7.85,
      },
      {
        id: 'jupiter',
        name: 'Jovian Giant',
        sub: '5.20 AU · 142,984 km',
        aAu: 5.203,
        rAu: 71492.0 / 149597870.7,
        ecc: 0.049,
        incDeg: 1.3,
        speed: 0.28,
        colorHex: 0xf59e0b,
        colorCss: '#fbbf24',
        ringed: false,
        targetLog: 8.93,
      },
      {
        id: 'saturn',
        name: 'Ringed Kronos',
        sub: '9.54 AU · 120,536 km',
        aAu: 9.537,
        rAu: 60268.0 / 149597870.7,
        ecc: 0.056,
        incDeg: 2.49,
        speed: 0.17,
        colorHex: 0xfef08a,
        colorCss: '#fde047',
        ringed: true,
        targetLog: 8.93,
      },
      {
        id: 'uranus',
        name: 'Uranus (Ice Giant)',
        sub: '19.2 AU · 51,118 km',
        aAu: 19.19,
        rAu: 25559.0 / 149597870.7,
        ecc: 0.046,
        incDeg: 0.77,
        speed: 0.095,
        colorHex: 0x67e8f9,
        colorCss: '#67e8f9',
        ringed: false,
        targetLog: 8.93,
      },
      {
        id: 'neptune',
        name: 'Neptune',
        sub: '30.1 AU · 49,528 km',
        aAu: 30.07,
        rAu: 24764.0 / 149597870.7,
        ecc: 0.009,
        incDeg: 1.77,
        speed: 0.062,
        colorHex: 0x3b82f6,
        colorCss: '#60a5fa',
        ringed: false,
        targetLog: 8.93,
      },
    ];

    this.solarPlanets = [];
    for (let i = 0; i < planetDefs.length; i++) {
      const def = planetDefs[i];
      const orbitPlane = new THREE.Group();
      orbitPlane.rotation.z = THREE.MathUtils.degToRad(def.incDeg);
      ecliptic.add(orbitPlane);

      const { line, unitCoords } = this.createOrbitHairline(
        22.0 * (def.aAu / 30.07),
        def.ecc,
        def.id === 'capy_earth' ? 0x34d399 : 0x475569
      );
      orbitPlane.add(line);

      const pivot = new THREE.Group();
      pivot.rotation.y = i * 0.94 + 0.45;
      orbitPlane.add(pivot);

      const bodyMat =
        def.id === 'capy_earth'
          ? createHabitablePlanetMaterial(_sharedSunDir)
          : def.id === 'jupiter' || def.id === 'saturn'
            ? createGasGiantMaterial(_sharedSunDir)
            : createRockyBodyMaterial({
                sunDir: _sharedSunDir,
                baseColorHex: def.colorHex,
                highlandColorHex: 0xe2e8f0,
              });

      const bodyMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, this.isSoftwareGl ? 18 : 28, 20),
        bodyMat
      );
      if (def.id === 'capy_earth') {
        this.capyEarthBodyMat = bodyMat as THREE.ShaderMaterial;
        const customRingMesh = new THREE.Mesh(
          new THREE.RingGeometry(1.38, 2.25, 48),
          createPlanetaryRingMaterial({
            innerRadius: 1.38,
            outerRadius: 2.25,
            planetRadius: 1.0,
            sunDir: _sharedSunDir,
          })
        );
        customRingMesh.rotation.x = Math.PI * 0.43;
        customRingMesh.visible = false;
        bodyMesh.add(customRingMesh);
        this.capyEarthRingMesh = customRingMesh;
      } else if (def.ringed) {
        const ringMesh = new THREE.Mesh(
          new THREE.RingGeometry(1.35, 2.32, 48),
          createPlanetaryRingMaterial({
            innerRadius: 1.35,
            outerRadius: 2.32,
            planetRadius: 1.0,
            sunDir: _sharedSunDir,
          })
        );
        ringMesh.rotation.x = Math.PI * 0.43;
        bodyMesh.add(ringMesh);
      }

      // Flux-conserving reflected-sunlight PSF pinpoint ("Pale Blue Dot" at 1:1 AU scale!)
      const glintPoint = this.createSinglePointGlint(
        def.colorHex,
        def.aAu >= 5.0 ? 8.5 : 6.8,
        0.18
      );
      bodyMesh.add(glintPoint);
      pivot.add(bodyMesh);

      const planetEntry: SolarPlanetEntry = {
        name: def.name,
        semiMajorAu: def.aAu,
        radiusAu: def.rAu,
        eccentricity: def.ecc,
        inclinationRad: THREE.MathUtils.degToRad(def.incDeg),
        angularSpeed: def.speed,
        pivot,
        bodyMesh,
        glintPoint,
        orbitLine: line,
        baseOrbitPoints: unitCoords,
        targetLogMeters: def.targetLog,
        colorCss: def.colorCss,
      };
      this.solarPlanets.push(planetEntry);
      if (def.id === 'capy_earth') {
        this.capyEarthPlanet = planetEntry;
      }

      this.registerMarkerAnchor({
        id: `marker_planet_${def.id}`,
        label: def.name,
        sublabel: def.sub,
        node: bodyMesh,
        layerBandId: 'stellar_systems',
        minLog: 10.6,
        maxLog: 14.5,
        targetLogMeters: def.targetLog,
        colorCss: def.colorCss,
        physicalRadiusWorldAtOneToOne: 22.0 * (def.rAu / 30.07),
      });
    }

    // Main Asteroid Belt (2.2-3.2 AU) & Kuiper Scattered Disk (31-48 AU) PSF dust/planetesimal glints
    const beltCount = this.isSoftwareGl ? 360 : 1200;
    this.solarBeltBaseAu = new Float32Array(beltCount * 3); // [rAu, angle, yRatio]
    const bPos = new Float32Array(beltCount * 3);
    const bCol = new Float32Array(beltCount * 3);
    const bSc = new Float32Array(beltCount);
    const bLum = new Float32Array(beltCount);

    for (let b = 0; b < beltCount; b++) {
      const isKuiper = b % 5 < 3;
      const rAu = isKuiper
        ? 30.5 + Math.pow(seededRand(b * 5 + 1), 1.3) * 19.5
        : 2.15 + seededRand(b * 5 + 1) * 1.1;
      const ang = seededRand(b * 5 + 2) * Math.PI * 2;
      const yRatio = (seededRand(b * 5 + 3) - 0.5) * (isKuiper ? 0.16 : 0.09);
      this.solarBeltBaseAu[b * 3] = rAu;
      this.solarBeltBaseAu[b * 3 + 1] = ang;
      this.solarBeltBaseAu[b * 3 + 2] = yRatio;

      _scratchColorA.setHex(isKuiper ? 0xbae6fd : 0xd6d3d1);
      bCol[b * 3] = _scratchColorA.r;
      bCol[b * 3 + 1] = _scratchColorA.g;
      bCol[b * 3 + 2] = _scratchColorA.b;
      bSc[b] = 0.45 + seededRand(b * 5 + 4) * 0.65;
      bLum[b] = isKuiper ? 0.32 : 0.42;
    }
    const beltGeo = new THREE.BufferGeometry();
    beltGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    beltGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    beltGeo.setAttribute('aScale', new THREE.BufferAttribute(bSc, 1));
    beltGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(bLum, 1));
    this.solarBeltPoints = new THREE.Points(
      beltGeo,
      createStarPsfMaterial({
        baseSize: 6.5,
        minPixelSize: 1.4,
        maxPixelSize: 5.5,
        diffractionStrength: 0.0,
        opacity: 0.55,
      })
    );
    ecliptic.add(this.solarBeltPoints);

    // Main Asteroid Belt & Kuiper Belt registered navigational markers
    const asteroidBeltAnchor = new THREE.Object3D();
    asteroidBeltAnchor.position.set(2.8 * (22.0 / 30.07), 0, 0);
    ecliptic.add(asteroidBeltAnchor);
    this.registerMarkerAnchor({
      id: 'marker_asteroid_belt',
      label: 'Main Asteroid Belt',
      sublabel: '2.2–3.2 AU · Ceres & Silicates',
      node: asteroidBeltAnchor,
      layerBandId: 'stellar_systems',
      minLog: 10.4,
      maxLog: 14.2,
      targetLogMeters: 11.65,
      colorCss: '#d6d3d1',
      physicalRadiusWorldAtOneToOne: 2.8 * (22.0 / 30.07),
    });

    const kuiperAnchor = new THREE.Object3D();
    kuiperAnchor.position.set(38.0 * (22.0 / 30.07), 0, 0);
    ecliptic.add(kuiperAnchor);
    this.registerMarkerAnchor({
      id: 'marker_kuiper_belt',
      label: 'Kuiper Belt & Scattered Disk',
      sublabel: '30–50 AU · Pluto & Icy Bodies',
      node: kuiperAnchor,
      layerBandId: 'stellar_systems',
      minLog: 10.8,
      maxLog: 14.8,
      targetLogMeters: 12.95,
      colorCss: '#7dd3fc',
      physicalRadiusWorldAtOneToOne: 38.0 * (22.0 / 30.07),
    });

    // Outer Spherical Oort Cloud (2,000–100,000 AU / ~10^15–10^16 m)
    // Envelops the central star and planetary system in an isotropic 3D spherical shell of icy comets
    const oortCount = this.isSoftwareGl ? 450 : 1600;
    const oPos = new Float32Array(oortCount * 3);
    const oCol = new Float32Array(oortCount * 3);
    const oSc = new Float32Array(oortCount);
    const oLum = new Float32Array(oortCount);

    for (let k = 0; k < oortCount; k++) {
      // Isotropic spherical shell: radius 60.0 to 140.0 world units
      const r = 60.0 + Math.pow(seededRand(k * 7 + 1), 0.85) * 80.0;
      const theta = Math.acos(2 * seededRand(k * 7 + 2) - 1);
      const phi = seededRand(k * 7 + 3) * Math.PI * 2;
      oPos[k * 3] = r * Math.sin(theta) * Math.cos(phi);
      oPos[k * 3 + 1] = r * Math.cos(theta);
      oPos[k * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

      // Pristine volatile cometary ice composition: cyan-white / pale azure glints
      const isInnerHills = r < 90.0;
      _scratchColorA.setHex(isInnerHills ? 0xcffafe : 0xe0f2fe);
      oCol[k * 3] = _scratchColorA.r;
      oCol[k * 3 + 1] = _scratchColorA.g;
      oCol[k * 3 + 2] = _scratchColorA.b;
      oSc[k] = 0.5 + seededRand(k * 7 + 4) * 0.9;
      oLum[k] = 0.35 + seededRand(k * 7 + 5) * 0.45;
    }

    const oortGeo = new THREE.BufferGeometry();
    oortGeo.setAttribute('position', new THREE.BufferAttribute(oPos, 3));
    oortGeo.setAttribute('color', new THREE.BufferAttribute(oCol, 3));
    oortGeo.setAttribute('aScale', new THREE.BufferAttribute(oSc, 1));
    oortGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(oLum, 1));
    this.solarOortPoints = new THREE.Points(
      oortGeo,
      createStarPsfMaterial({
        baseSize: 6.8,
        minPixelSize: 1.2,
        maxPixelSize: 4.8,
        diffractionStrength: 0.0,
        opacity: 0.65,
      })
    );
    group.add(this.solarOortPoints);

    const oortAnchor = new THREE.Object3D();
    oortAnchor.position.set(0, 0, 85.0);
    group.add(oortAnchor);
    this.registerMarkerAnchor({
      id: 'marker_oort_cloud',
      label: 'Oort Cometary Cloud',
      sublabel: '2,000–100,000 AU · Spherical Reservoir',
      node: oortAnchor,
      layerBandId: 'stellar_systems',
      minLog: 11.2,
      maxLog: 15.2,
      targetLogMeters: 12.95,
      colorCss: '#38bdf8',
      physicalRadiusWorldAtOneToOne: 85.0,
    });

    this.applySolarSystemRescaler(1.0);

    return (dt, _elapsed, gamma, showMarkers) => {
      if (Math.abs(gamma - this.lastGammaApplied) > 0.002) {
        this.applySolarSystemRescaler(gamma);
      }

      const scaleSpec =
        ORBIT_TIME_SCALES.find((s) => s.id === this.orbitTimeScaleId) || ORBIT_TIME_SCALES[4];
      let baseEarthRadSec = 0;
      if (
        this.orbitTimeScaleId !== 'paused' &&
        Number.isFinite(scaleSpec.earthOrbitDurationSec) &&
        scaleSpec.earthOrbitDurationSec > 0
      ) {
        baseEarthRadSec = (Math.PI * 2) / scaleSpec.earthOrbitDurationSec;
      }

      for (let i = 0; i < this.solarPlanets.length; i++) {
        const p = this.solarPlanets[i];
        const semiMajor = Math.max(0.2, p.semiMajorAu || 1.0);
        const keplerOmega = baseEarthRadSec * Math.pow(semiMajor, -1.5);
        p.pivot.rotation.y += keplerOmega * dt;
        p.orbitLine.visible = showMarkers || gamma < 0.92;
      }

      if (this.solarBeltPoints) {
        const beltSemiMajor = 2.8;
        const beltKeplerOmega = baseEarthRadSec * Math.pow(beltSemiMajor, -1.5);
        this.solarBeltPoints.rotation.y += beltKeplerOmega * dt;
      }

      if (this.solarOortPoints) {
        this.solarOortPoints.rotation.y += dt * 0.003;
        this.solarOortPoints.rotation.x += dt * 0.0015;
      }

      if (this.solarCoronaSprite) {
        const coronaMat = this.solarCoronaSprite.material as THREE.SpriteMaterial;
        coronaMat.opacity = THREE.MathUtils.clamp(
          0.72 + 0.14 * THREE.MathUtils.clamp(this.fineStructureRatio, 0.55, 2.2),
          0.45,
          0.98
        );
      }
    };
  }

  private applySolarSystemRescaler(gamma: number) {
    this.lastGammaApplied = gamma;
    const canonOuterUnits = 22.0;
    const neptuneAu = 30.07;

    // 1. Sun radius: exact 0.00465047 AU at gamma=1.0; smoothly scales via (R_sun / 30.07)^gamma
    const sunRatio = 0.00465047 / neptuneAu;
    const sunWorldR = canonOuterUnits * Math.pow(sunRatio, gamma * 0.92 + 0.08 * 1.0);
    // At gamma=1.0: exact 0.003402 units; at gamma=0.30: ~1.85 units!
    const exactOrScaledSunR =
      gamma >= 0.995
        ? canonOuterUnits * sunRatio
        : canonOuterUnits * Math.pow(sunRatio, gamma) * 0.58;
    if (this.solarSunMesh) {
      this.solarSunMesh.scale.setScalar(Math.max(0.0034, exactOrScaledSunR));
    }
    if (this.solarCoronaSprite) {
      // Inverse-square optical glare stays crisp as a star at 1:1 and expands gently with Sun body
      this.solarCoronaSprite.scale.setScalar(Math.max(2.6, exactOrScaledSunR * 5.2));
    }

    // 2. Planets & Keplerian Ellipses: exact 1:1 AU & 1:1 body radii at gamma=1.0!
    for (let i = 0; i < this.solarPlanets.length; i++) {
      const p = this.solarPlanets[i];
      const orbitR = canonOuterUnits * Math.pow(p.semiMajorAu / neptuneAu, gamma);
      const bodyRatio = p.radiusAu / neptuneAu;
      const bodyR =
        gamma >= 0.995
          ? canonOuterUnits * bodyRatio
          : canonOuterUnits * Math.pow(bodyRatio, gamma) * 0.44;

      p.bodyMesh.position.set(orbitR * (1 - p.eccentricity), 0, 0);
      p.bodyMesh.scale.setScalar(Math.max(1e-5, bodyR));

      // Update orbit hairline vertices in-place (zero allocations)
      const posAttr = p.orbitLine.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const unit = p.baseOrbitPoints;
      for (let k = 0; k < arr.length; k += 3) {
        arr[k] = unit[k] * orbitR;
        arr[k + 1] = 0;
        arr[k + 2] = unit[k + 2] * orbitR;
      }
      posAttr.needsUpdate = true;
    }

    // 3. Asteroid Belt & Kuiper Disk radial rescale in-place
    if (this.solarBeltPoints && this.solarBeltBaseAu) {
      const posAttr = this.solarBeltPoints.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const count = this.solarBeltBaseAu.length / 3;
      for (let b = 0; b < count; b++) {
        const rAu = this.solarBeltBaseAu[b * 3];
        const ang = this.solarBeltBaseAu[b * 3 + 1];
        const yRatio = this.solarBeltBaseAu[b * 3 + 2];
        const rWorld = canonOuterUnits * Math.pow(rAu / neptuneAu, gamma);
        arr[b * 3] = Math.cos(ang) * rWorld;
        arr[b * 3 + 1] = rWorld * yRatio;
        arr[b * 3 + 2] = Math.sin(ang) * rWorld;
      }
      posAttr.needsUpdate = true;
    }

    if (this.solarOortPoints) {
      this.solarOortPoints.scale.setScalar(Math.pow(1.0, gamma));
    }
  }

  // --- 8B. PLANETARY SYSTEM & MOON ORBITS (+8.85 · 7.1×10^8 m · HILL SPHERE & MOONS) ---
  // Calibrated 1:1 to the single Capy-Earth in ScaleLayer_planet (R_earth = 9.0 at 7.10 => 0.160 at 8.85)
  private populatePlanetarySystemLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number, gamma: number, showMarkers: boolean) => void {
    const systemGroup = new THREE.Group();
    systemGroup.rotation.x = 0.41; // 23.4° Earth equatorial / lunar orbital inclination
    group.add(systemGroup);
    this.planetarySystemGroup = systemGroup;

    // 1. Capy-Moon (exact 60.3x Earth-radius orbit = 9.65 units, 0.2727x Earth radius = 0.04365 units)
    const moonOrbitPlane = new THREE.Group();
    moonOrbitPlane.rotation.z = THREE.MathUtils.degToRad(5.14); // 5.14° lunar orbital inclination
    systemGroup.add(moonOrbitPlane);

    const { line: moonOrbitLine } = this.createOrbitHairline(
      MOON_ORBIT_RADIUS_AT_8_85,
      0.055,
      0x94a3b8
    );
    moonOrbitPlane.add(moonOrbitLine);

    const moonPivot = new THREE.Group();
    moonOrbitPlane.add(moonPivot);
    this.planetaryMoonPivot = moonPivot;

    const moonMat = createRockyBodyMaterial({
      sunDir: _sharedSunDir,
      baseColorHex: 0x94a3b8,
      highlandColorHex: 0xf1f5f9,
    });
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_RADIUS_AT_8_85, this.isSoftwareGl ? 14 : 22, 14),
      moonMat
    );
    moonMesh.position.set(MOON_ORBIT_RADIUS_AT_8_85 * (1 - 0.055), 0, 0);
    moonPivot.add(moonMesh);
    this.planetaryMoonMesh = moonMesh;

    const moonGlint = this.createSinglePointGlint(0xf1f5f9, 13.5, 0.46);
    moonMesh.add(moonGlint);

    // 2. Shepherd Asteroid / Minimoon "Yuzu-1" (5.0 units orbit, 0.032 units radius)
    const minimoonPivot = new THREE.Group();
    minimoonPivot.rotation.y = 1.85;
    systemGroup.add(minimoonPivot);
    this.planetaryMinimoonPivot = minimoonPivot;

    const { line: miniOrbitLine } = this.createOrbitHairline(
      MINIMOON_ORBIT_RADIUS_AT_8_85,
      0.02,
      0xfacc15
    );
    systemGroup.add(miniOrbitLine);

    const minimoonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(MINIMOON_RADIUS_AT_8_85, this.isSoftwareGl ? 10 : 16, 10),
      createRockyBodyMaterial({
        sunDir: _sharedSunDir,
        baseColorHex: 0xfacc15,
        highlandColorHex: 0xfef08a,
      })
    );
    minimoonMesh.position.set(MINIMOON_ORBIT_RADIUS_AT_8_85, 0, 0);
    minimoonPivot.add(minimoonMesh);

    const miniGlint = this.createSinglePointGlint(0xfacc15, 10.5, 0.36);
    minimoonMesh.add(miniGlint);

    // 3. Outer Hill Sphere Gravitational Boundary Hairline (21.0 units)
    const { line: hillLine } = this.createOrbitHairline(21.0, 0.0, 0x38bdf8);
    systemGroup.add(hillLine);

    const moonOrbitMat = moonOrbitLine.material as THREE.LineBasicMaterial;
    const miniOrbitMat = miniOrbitLine.material as THREE.LineBasicMaterial;
    const hillOrbitMat = hillLine.material as THREE.LineBasicMaterial;

    // Registered Navigational Markers
    const earthAnchor = new THREE.Object3D();
    systemGroup.add(earthAnchor);
    this.registerMarkerAnchor({
      id: 'marker_capy_earth_globe',
      label: 'Capy-Earth (Habitable)',
      sublabel: '12,742 km · Primary World',
      node: earthAnchor,
      layerBandId: 'planetary_system',
      minLog: 6.8,
      maxLog: 10.5,
      targetLogMeters: PLANET_CANON_LOG,
      colorCss: '#34d399',
      physicalRadiusWorldAtOneToOne: PLANET_BASE_RADIUS * Math.pow(10, PLANET_CANON_LOG - 8.85),
    });

    this.registerMarkerAnchor({
      id: 'marker_capy_moon',
      label: 'Capy-Moon',
      sublabel: '3,474 km · 384,400 km Orbit',
      node: moonMesh,
      layerBandId: 'planetary_system',
      minLog: 7.2,
      maxLog: 10.5,
      targetLogMeters: 7.85,
      colorCss: '#94a3b8',
      physicalRadiusWorldAtOneToOne: MOON_RADIUS_AT_8_85,
    });

    this.registerMarkerAnchor({
      id: 'marker_planetary_ring_plane',
      label: 'Ring Plane & Minimoon Yuzu-1',
      sublabel: 'Ice & Silicate Ring System',
      node: minimoonMesh,
      layerBandId: 'planetary_system',
      minLog: 7.4,
      maxLog: 10.2,
      targetLogMeters: 8.85,
      colorCss: '#facc15',
      physicalRadiusWorldAtOneToOne: MINIMOON_RADIUS_AT_8_85,
    });

    return (dt, _elapsed, _gamma, showMarkers) => {
      moonPivot.rotation.y += dt * 0.018;
      minimoonPivot.rotation.y += dt * 0.045;
      moonOrbitLine.visible = true;
      miniOrbitLine.visible = true;
      hillLine.visible = showMarkers;
      if (moonOrbitMat) moonOrbitMat.opacity = showMarkers ? 0.56 : 0.28;
      if (miniOrbitMat) miniOrbitMat.opacity = showMarkers ? 0.52 : 0.24;
      if (hillOrbitMat) hillOrbitMat.opacity = 0.34;
    };
  }

  /**
   * Generates a Float32-precision-safe curved spherical surface patch centered around `centerDir`
   * at `localPos = (dir - centerDir) * radius` so deep orbital-to-surface magnifications (> 100,000x)
   * exhibit zero vertex quantization jitter and share identical spherical coordinates (`aSphereDir`).
   */
  private createCurvedSurfacePatchGeometry(
    centerDir: THREE.Vector3,
    radius: number,
    halfAngleRad: number,
    segments: number
  ): THREE.BufferGeometry {
    const vertsPerAxis = segments + 1;
    const vertCount = vertsPerAxis * vertsPerAxis;
    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const sphereDirs = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);

    // Orthonormal tangent basis (tangentU, tangentV) perpendicular to centerDir
    const tangentU = new THREE.Vector3(0, 1, 0).cross(centerDir);
    if (tangentU.lengthSq() < 1e-6) {
      tangentU.set(1, 0, 0).cross(centerDir);
    }
    tangentU.normalize();
    const tangentV = new THREE.Vector3().crossVectors(centerDir, tangentU).normalize();

    const maxTan = Math.tan(halfAngleRad);
    const dir = new THREE.Vector3();

    let vIdx = 0;
    let uvIdx = 0;
    for (let j = 0; j < vertsPerAxis; j++) {
      const fy = j / segments;
      const v = (fy * 2 - 1) * maxTan;
      for (let i = 0; i < vertsPerAxis; i++) {
        const fx = i / segments;
        const u = (fx * 2 - 1) * maxTan;

        dir
          .set(centerDir.x, centerDir.y, centerDir.z)
          .addScaledVector(tangentU, u)
          .addScaledVector(tangentV, v)
          .normalize();

        positions[vIdx] = (dir.x - centerDir.x) * radius;
        positions[vIdx + 1] = (dir.y - centerDir.y) * radius;
        positions[vIdx + 2] = (dir.z - centerDir.z) * radius;

        normals[vIdx] = dir.x;
        normals[vIdx + 1] = dir.y;
        normals[vIdx + 2] = dir.z;

        sphereDirs[vIdx] = dir.x;
        sphereDirs[vIdx + 1] = dir.y;
        sphereDirs[vIdx + 2] = dir.z;

        uvs[uvIdx] = fx;
        uvs[uvIdx + 1] = fy;

        vIdx += 3;
        uvIdx += 2;
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = j * vertsPerAxis + i;
        const b = a + 1;
        const c = a + vertsPerAxis;
        const d = c + 1;
        // Counter-clockwise outward triangle winding ((b - a) x (c - a) = tangentU x tangentV = +centerDir)
        indices.push(a, b, c, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('aSphereDir', new THREE.BufferAttribute(sphereDirs, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  // --- 8C. UNIFIED SINGLE PLANET (+7.10 -> SURFACE · CONTINUOUS CAPY-EARTH LOD ARCHITECTURE) ---
  private populatePlanetGlobeLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const surfaceAlignGroup = new THREE.Group();
    group.add(surfaceAlignGroup);
    this.planetSurfaceAlignGroup = surfaceAlignGroup;

    const globeContainer = new THREE.Group();
    surfaceAlignGroup.add(globeContainer);
    this.planetGlobeContainer = globeContainer;

    const planetR = PLANET_BASE_RADIUS;

    // 1. Primary 3D Habitable Planet Sphere (same single Capy-Earth from Moon orbit down to stratosphere)
    const planetMat = createHabitablePlanetMaterial(_sharedSunDir, {
      sanctuaryDir: _sanctuaryDir,
    });
    this.planetGlobeMat = planetMat;
    const globeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(planetR, this.isSoftwareGl ? 32 : 64, this.isSoftwareGl ? 22 : 42),
      planetMat
    );
    globeContainer.add(globeMesh);
    this.planetGlobeMesh = globeMesh;

    // 2. Translucent Volumetric Cloud Sphere (1.005x planet radius ~ 32 km cloud tops)
    const cloudMat = createPlanetCloudMaterial(_sharedSunDir, {
      sanctuaryDir: _sanctuaryDir,
    });
    this.planetCloudSphereMat = cloudMat;
    const cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(planetR * 1.005, this.isSoftwareGl ? 28 : 52, this.isSoftwareGl ? 18 : 34),
      cloudMat
    );
    globeContainer.add(cloudMesh);
    this.planetCloudMesh = cloudMesh;

    // 3. Rayleigh Scattering Atmospheric Limb Shell (1.018x planet radius ~ 115 km Kármán glow)
    const rayleighMat = createAtmosphereScatteringMaterial({
      sunDir: _sharedSunDir,
      rayleighColor: new THREE.Color(0.2, 0.6, 1.0),
      intensity: 1.85,
    });
    this.planetRayleighMat = rayleighMat;
    this.atmosphereRayleighMat = rayleighMat;
    const rayleighMesh = new THREE.Mesh(
      new THREE.SphereGeometry(planetR * 1.018, this.isSoftwareGl ? 28 : 52, this.isSoftwareGl ? 18 : 34),
      rayleighMat
    );
    globeContainer.add(rayleighMesh);
    this.planetRayleighMesh = rayleighMesh;

    // 4. Concentric Planetary Ring Plane anchored directly to Capy-Earth (never clips Earth at any gamma)
    const ringMat = createPlanetaryRingMaterial({
      innerRadius: planetR * 1.65,
      outerRadius: planetR * 2.85,
      planetRadius: planetR,
      sunDir: _sharedSunDir,
    });
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(planetR * 1.65, planetR * 2.85, this.isSoftwareGl ? 36 : 64),
      ringMat
    );
    ringMesh.rotation.x = Math.PI * 0.5;
    ringMesh.visible = this.pendingProceduralBiome?.ringSystemEnabled ?? false;
    globeContainer.add(ringMesh);
    this.planetaryRingMesh = ringMesh;

    // 5. Distant Orbital Pale-Blue-Dot Glint (visible when zoomed out to 8.85 Planetary System)
    const orbitalGlint = this.createSinglePointGlint(0x38bdf8, 17.5, 0.72);
    orbitalGlint.visible = false;
    globeContainer.add(orbitalGlint);
    this.planetOrbitalGlint = orbitalGlint;

    // 6. Sanctuary Archipelago Surface Landmass Anchor & Waypoint (22.5°N, 42.0°E)
    const surfacePoint = new THREE.Object3D();
    surfacePoint.position.copy(_sanctuaryDir).multiplyScalar(planetR);
    globeContainer.add(surfacePoint);

    const surfaceBeacon = this.createSinglePointGlint(0x34d399, 13.0, 0.35);
    surfaceBeacon.position.copy(_sanctuaryDir).multiplyScalar(planetR * 1.001);
    globeContainer.add(surfaceBeacon);

    this.registerMarkerAnchor({
      id: 'marker_sanctuary_landmass',
      label: 'Capybara Sanctuary Archipelago',
      sublabel: 'Home Surface Landmass · 22.5°N 42.0°E',
      node: surfacePoint,
      layerBandId: 'planet',
      minLog: 4.8,
      maxLog: 8.2,
      targetLogMeters: 4.90,
      colorCss: '#34d399',
      physicalRadiusWorldAtOneToOne: 0.15,
    });

    // 7. Nested Float32-Safe Curved Surface LOD Patches + Curved Cloud Decks
    // Anchored identically on the ONE planet surface at `_sanctuaryDir * planetR` so zooming down
    // never swaps to a flat square or a smaller fake sphere inside Earth!
    const surfaceAnchorGroup = new THREE.Group();
    surfaceAnchorGroup.position.copy(_sanctuaryDir).multiplyScalar(planetR);
    surfaceAlignGroup.add(surfaceAnchorGroup);
    this.planetSurfaceAnchorGroup = surfaceAnchorGroup;

    this.planetLodMats = [];
    const segs = this.isSoftwareGl ? 36 : 68;

    const buildSurfaceLodPatch = (
      radius: number,
      halfAngleRad: number,
      patchSegs: number,
      polyFactor: number
    ) => {
      const mat = createHabitablePlanetMaterial(_sharedSunDir, {
        useSphereDirAttr: true,
        sanctuaryDir: _sanctuaryDir,
      });
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = polyFactor;
      mat.polygonOffsetUnits = polyFactor;
      const geo = this.createCurvedSurfacePatchGeometry(_sanctuaryDir, radius, halfAngleRad, patchSegs);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      surfaceAnchorGroup.add(mesh);
      this.planetLodMats.push(mat);
      return mesh;
    };

    this.planetLod1Mesh = buildSurfaceLodPatch(planetR, 0.40, segs, -1);
    this.planetLod2Mesh = buildSurfaceLodPatch(planetR, 0.075, segs, -2);
    this.planetLod3Mesh = buildSurfaceLodPatch(
      planetR,
      0.014,
      this.isSoftwareGl ? 32 : 64,
      -3
    );

    // Dual-layer curved troposphere & stratosphere cloud patches along the same sphere curvature
    this.planetCloudPatchMeshes = [];
    this.planetCloudPatchMats = [];
    this.atmosphereCloudMats = [];
    const cloudHeights = [1.005, 1.010];
    for (let c = 0; c < cloudHeights.length; c++) {
      const cMat = createPlanetCloudMaterial(_sharedSunDir, {
        useSphereDirAttr: true,
        sanctuaryDir: _sanctuaryDir,
        doubleSide: true,
      });
      const cGeo = this.createCurvedSurfacePatchGeometry(
        _sanctuaryDir,
        planetR * cloudHeights[c],
        0.42,
        this.isSoftwareGl ? 24 : 44
      );
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.visible = false;
      cMesh.renderOrder = 3 + c;
      surfaceAnchorGroup.add(cMesh);
      this.planetCloudPatchMeshes.push(cMesh);
      this.planetCloudPatchMats.push(cMat);
      this.atmosphereCloudMats.push(cMat);
    }

    return (dt) => {
      if (ringMesh.visible) {
        ringMesh.rotation.z += dt * 0.003;
      }
    };
  }

  // --- 9. ATMOSPHERE & STRATOSPHERIC CLOUD DECKS (+4.9 · 80 km KÁRMÁN LIMB) ---
  // Sky optics + landing waypoint only; curved planet & cloud decks come directly from the single Capy-Earth!
  private populateAtmosphereLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const sanctuaryEntryAnchor = new THREE.Object3D();
    sanctuaryEntryAnchor.position.set(0, 0, 0);
    group.add(sanctuaryEntryAnchor);
    this.registerMarkerAnchor({
      id: 'marker_sanctuary_archipelago',
      label: 'Capybara Forest Archipelago',
      sublabel: 'Atmospheric Entry · 6.3 m',
      node: sanctuaryEntryAnchor,
      layerBandId: 'atmosphere',
      minLog: 3.5,
      maxLog: 6.5,
      targetLogMeters: 0.8,
      colorCss: '#34d399',
      physicalRadiusWorldAtOneToOne: 0.001,
    });

    // Sunlit parted cumulus cloud deck framing the descent from orbit down onto the emerald valley
    const bankCount = this.isSoftwareGl ? 14 : 22;
    const puffsPerBank = 4;
    const cloudGeo = new THREE.SphereGeometry(2.4, 12, 8);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.28,
      roughness: 0.95,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    const cloudBanks = new THREE.InstancedMesh(cloudGeo, cloudMat, bankCount * puffsPerBank);
    let instIdx = 0;
    for (let b = 0; b < bankCount; b++) {
      const ang = (b / bankCount) * Math.PI * 2 + seededRand(b * 11 + 3) * 0.22;
      const dist = 22.0 + seededRand(b * 17 + 5) * 28.0;
      const bx = Math.cos(ang) * dist;
      const bz = Math.sin(ang) * dist;
      // Keep a clear sunlit corridor directly in front of the descending camera (+Z near center)
      const inCameraCorridor = bz > 12.0 && Math.abs(bx) < 16.0;
      const adjX = inCameraCorridor ? (bx >= 0 ? bx + 16.0 : bx - 16.0) : bx;
      const baseY = 1.8 + seededRand(b * 13 + 7) * 5.2;
      for (let p = 0; p < puffsPerBank; p++) {
        const ox = (p - 1.5) * 3.2 + (seededRand(instIdx * 5 + 1) - 0.5) * 1.8;
        const oz = (seededRand(instIdx * 9 + 2) - 0.5) * 3.0;
        const oy = (p === 1 || p === 2 ? 0.75 : 0.0) + (seededRand(instIdx * 3 + 4) - 0.5) * 0.6;
        const sx = (p === 1 || p === 2 ? 1.95 : 1.35) + seededRand(instIdx * 7 + 3) * 0.65;
        const sy = 0.44 + seededRand(instIdx * 13 + 6) * 0.22;
        _dummyObj.position.set(adjX + ox, baseY + oy, bz + oz);
        _dummyObj.scale.set(sx, sy, sx * 0.85);
        _dummyObj.rotation.set(0, ang, 0);
        _dummyObj.updateMatrix();
        cloudBanks.setMatrixAt(instIdx++, _dummyObj.matrix);
      }
    }
    cloudBanks.instanceMatrix.needsUpdate = true;
    cloudBanks.computeBoundingSphere();
    group.add(cloudBanks);

    return (dt) => {
      cloudBanks.rotation.y += dt * 0.004;
    };
  }

  // --- 14. LAND MASSES & CORDILLERAS (+3.6 · 4.0 km) ---
  // Coherent emerald mountain-ringed woodland valley with winding river & parting troposphere cloud puffs
  private populateLandMassesLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const radSegs = this.isSoftwareGl ? 32 : 48;
    const ringRadii = [0, 2.8, 6.2, 10.5, 16.0, 22.5, 30.0, 39.0, 50.0, 64.0];
    const verts: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const cCenter = new THREE.Color(0x47a348); // sunlit central glade meadow
    const cValley = new THREE.Color(0x287436); // emerald woodland basin
    const cSlope = new THREE.Color(0x1f592d);  // deep conifer foothills
    const cRock = new THREE.Color(0x525c68);   // alpine granite ridges
    const cSnow = new THREE.Color(0xdbeafe);   // distant mountain snowcaps
    const cTmp = new THREE.Color();

    for (let ri = 0; ri < ringRadii.length; ri++) {
      const r = ringRadii[ri];
      for (let si = 0; si < radSegs; si++) {
        const ang = (si / radSegs) * Math.PI * 2;
        const px = Math.cos(ang) * r;
        const pz = Math.sin(ang) * r;
        // Calm flat valley basin around (0,0), rising into forested hills and distant cordilleras
        const ridgeWave =
          Math.sin(ang * 5.0 + 0.6) * 0.45 +
          Math.cos(ang * 9.0 - 1.2) * 0.32 +
          Math.sin(ang * 3.0 + r * 0.09) * 0.23;
        const riverGap = Math.exp(-Math.pow((ang - 0.68) * 2.4, 2.0));
        let h = -0.8;
        if (r > 9.0) {
          const tHill = Math.min(1.0, (r - 9.0) / 38.0);
          h += (tHill * tHill * 11.5 * (0.55 + 0.55 * Math.max(0, ridgeWave))) * (1.0 - riverGap * 0.72);
        }
        verts.push(px, h, pz);

        if (r < 5.5) {
          cTmp.copy(cCenter).lerp(cValley, r / 5.5);
        } else if (h < 3.6) {
          cTmp.copy(cValley).lerp(cSlope, Math.min(1.0, (r - 5.5) / 22.0));
        } else if (h < 7.2) {
          cTmp.copy(cSlope).lerp(cRock, Math.min(1.0, (h - 3.6) / 3.6));
        } else {
          cTmp.copy(cRock).lerp(cSnow, Math.min(1.0, (h - 7.2) / 3.2));
        }
        colors.push(cTmp.r, cTmp.g, cTmp.b);

        if (ri < ringRadii.length - 1) {
          const nextSi = (si + 1) % radSegs;
          const a = ri * radSegs + si;
          const b = ri * radSegs + nextSi;
          const c = (ri + 1) * radSegs + si;
          const d = (ri + 1) * radSegs + nextSi;
          indices.push(a, b, c, b, d, c);
        }
      }
    }

    const basinGeo = new THREE.BufferGeometry();
    basinGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    basinGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    basinGeo.setIndex(indices);
    basinGeo.computeVertexNormals();
    const basinMesh = new THREE.Mesh(
      basinGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
      })
    );
    group.add(basinMesh);

    // Subtle instanced emerald woodland canopy clusters across the valley floor (r = 5..24) bridging cleanly into Ecosystems (2.20)
    const canopyPatchCount = this.isSoftwareGl ? 64 : 120;
    const canopyPatchGeo = new THREE.DodecahedronGeometry(1.15, 1);
    const canopyPatchMat = new THREE.MeshStandardMaterial({
      color: 0x267534,
      roughness: 0.88,
    });
    const canopyPatches = new THREE.InstancedMesh(canopyPatchGeo, canopyPatchMat, canopyPatchCount);
    for (let i = 0; i < canopyPatchCount; i++) {
      const ang = seededRand(i * 19 + 3) * Math.PI * 2;
      const dist = 5.2 + Math.pow(seededRand(i * 23 + 7), 0.82) * 20.0;
      const cx = Math.cos(ang) * dist;
      const cz = Math.sin(ang) * dist;
      const tHill = dist > 9.0 ? Math.min(1.0, (dist - 9.0) / 38.0) : 0;
      const ridgeWave =
        Math.sin(ang * 5.0 + 0.6) * 0.45 +
        Math.cos(ang * 9.0 - 1.2) * 0.32 +
        Math.sin(ang * 3.0 + dist * 0.09) * 0.23;
      const riverGap = Math.exp(-Math.pow((ang - 0.68) * 2.4, 2.0));
      const baseH =
        -0.75 +
        tHill * tHill * 11.5 * (0.55 + 0.55 * Math.max(0, ridgeWave)) * (1.0 - riverGap * 0.72);
      const sx = 0.85 + seededRand(i * 7 + 2) * 1.15;
      _dummyObj.position.set(cx, baseH + 0.32 * sx, cz);
      _dummyObj.scale.set(sx * 1.2, sx * 0.52, sx * 1.2);
      _dummyObj.rotation.set(0, ang, 0);
      _dummyObj.updateMatrix();
      canopyPatches.setMatrixAt(i, _dummyObj.matrix);
      _scratchColorA.setHex(i % 3 === 0 ? 0x2d8a3c : i % 2 === 0 ? 0x226e32 : 0x1a562a);
      canopyPatches.setColorAt(i, _scratchColorA);
    }
    canopyPatches.instanceMatrix.needsUpdate = true;
    if (canopyPatches.instanceColor) canopyPatches.instanceColor.needsUpdate = true;
    canopyPatches.computeBoundingSphere();
    group.add(canopyPatches);

    // Winding azure river flowing past the lower-right side of the emerald clearing
    const riverPts = [
      new THREE.Vector3(38.0, -0.58, 30.0),
      new THREE.Vector3(21.0, -0.58, 16.5),
      new THREE.Vector3(9.5, -0.58, 6.8),
      new THREE.Vector3(6.8, -0.58, -1.8),
      new THREE.Vector3(12.5, -0.58, -14.0),
      new THREE.Vector3(26.0, -0.58, -32.0),
    ];
    const riverCurve = new THREE.CatmullRomCurve3(riverPts);
    const riverSegs = 28;
    const rVerts: number[] = [];
    const rIdx: number[] = [];
    for (let i = 0; i <= riverSegs; i++) {
      const u = i / riverSegs;
      const p = riverCurve.getPoint(u);
      const t = riverCurve.getTangent(u);
      const nx = -t.z;
      const nz = t.x;
      const halfW = 1.65 + Math.sin(u * Math.PI) * 0.85;
      rVerts.push(p.x - nx * halfW, p.y, p.z - nz * halfW);
      rVerts.push(p.x + nx * halfW, p.y, p.z + nz * halfW);
      if (i < riverSegs) {
        const a = i * 2;
        rIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const riverGeo = new THREE.BufferGeometry();
    riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rVerts, 3));
    riverGeo.setIndex(rIdx);
    riverGeo.computeVertexNormals();
    const riverMesh = new THREE.Mesh(
      riverGeo,
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0369a1,
        emissiveIntensity: 0.14,
        roughness: 0.2,
        metalness: 0.15,
        side: THREE.DoubleSide,
      })
    );
    group.add(riverMesh);

    // Distant sunlit cumulus cloud banks framing the OUTER mountain horizon (r = 38..58) so the valley stays crystal clear
    const bankCount = this.isSoftwareGl ? 10 : 16;
    const puffsPerBank = 3;
    const puffGeo = new THREE.SphereGeometry(1.85, 12, 8);
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.2,
      roughness: 0.95,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const puffInst = new THREE.InstancedMesh(puffGeo, puffMat, bankCount * puffsPerBank);
    for (let b = 0; b < bankCount; b++) {
      const baseAng = (b / bankCount) * Math.PI * 2 + seededRand(b * 7 + 3) * 0.24;
      const baseDist = 38.0 + seededRand(b * 11 + 5) * 18.0;
      const baseY = 12.5 + seededRand(b * 13 + 7) * 4.5;
      const bx = Math.cos(baseAng) * baseDist;
      const bz = Math.sin(baseAng) * baseDist;
      for (let p = 0; p < puffsPerBank; p++) {
        const idx = b * puffsPerBank + p;
        const ox = (p - 1) * 3.1 + (seededRand(idx * 5 + 1) - 0.5) * 1.4;
        const oz = (seededRand(idx * 9 + 2) - 0.5) * 2.2;
        const oy = (p === 1 ? 0.65 : 0) + (seededRand(idx * 3 + 4) - 0.5) * 0.5;
        const sx = (p === 1 ? 1.85 : 1.35) + seededRand(idx * 17 + 3) * 0.55;
        const sy = 0.52 + seededRand(idx * 13 + 6) * 0.22;
        _dummyObj.position.set(bx + ox, baseY + oy, bz + oz);
        _dummyObj.scale.set(sx, sy, sx * 0.85);
        _dummyObj.rotation.set(0, baseAng, 0);
        _dummyObj.updateMatrix();
        puffInst.setMatrixAt(idx, _dummyObj.matrix);
      }
    }
    puffInst.instanceMatrix.needsUpdate = true;
    puffInst.computeBoundingSphere();
    group.add(puffInst);

    return (dt) => {
      puffInst.rotation.y += dt * 0.006;
    };
  }

  // --- 15. FOREST & WETLAND ECOSYSTEMS (+2.2 · 160 m) ---
  // Continuous emerald woodland valley & dense multi-ring canopy encircling the sunlit central Glade
  private populateEcosystemsLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    this.ecosystemMeadowMat = new THREE.MeshStandardMaterial({
      color: 0x267d39,
      roughness: 0.86,
    });
    this.ecosystemRiverMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.14,
      roughness: 0.2,
      metalness: 0.16,
      side: THREE.DoubleSide,
    });

    // Seamless radial forest valley floor matching Land Masses above and Forest Glade below
    const radSegs = this.isSoftwareGl ? 28 : 44;
    const ringRadii = [0, 3.5, 7.5, 13.0, 21.0, 32.0, 46.0, 62.0];
    const gVerts: number[] = [];
    const gColors: number[] = [];
    const gIdx: number[] = [];
    const cGlade = new THREE.Color(0x4ca644);
    const cCanopyFloor = new THREE.Color(0x256c32);
    const cOuterHills = new THREE.Color(0x1b4e27);
    const cTmp = new THREE.Color();
    for (let ri = 0; ri < ringRadii.length; ri++) {
      const r = ringRadii[ri];
      for (let si = 0; si < radSegs; si++) {
        const ang = (si / radSegs) * Math.PI * 2;
        const px = Math.cos(ang) * r;
        const pz = Math.sin(ang) * r;
        const hill =
          r > 18.0
            ? (Math.sin(ang * 4.0 + r * 0.08) * 0.5 + 0.5) * Math.min(4.8, (r - 18.0) * 0.11)
            : 0;
        gVerts.push(px, hill - 0.55, pz);
        if (r < 7.5) {
          cTmp.copy(cGlade).lerp(cCanopyFloor, r / 7.5);
        } else {
          cTmp.copy(cCanopyFloor).lerp(cOuterHills, Math.min(1.0, (r - 7.5) / 36.0));
        }
        gColors.push(cTmp.r, cTmp.g, cTmp.b);
        if (ri < ringRadii.length - 1) {
          const nextSi = (si + 1) % radSegs;
          const a = ri * radSegs + si;
          const b = ri * radSegs + nextSi;
          const c = (ri + 1) * radSegs + si;
          const d = (ri + 1) * radSegs + nextSi;
          gIdx.push(a, b, c, b, d, c);
        }
      }
    }
    const groundGeo = new THREE.BufferGeometry();
    groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(gVerts, 3));
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(gColors, 3));
    groundGeo.setIndex(gIdx);
    groundGeo.computeVertexNormals();
    const groundMesh = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        side: THREE.DoubleSide,
      })
    );
    group.add(groundMesh);

    // Matching winding creek along the lower-right bank & golden woodland footpath curving into center clearing
    const creekPts = [
      new THREE.Vector3(24.0, -0.45, 22.0),
      new THREE.Vector3(12.5, -0.45, 10.2),
      new THREE.Vector3(6.2, -0.45, 3.8),
      new THREE.Vector3(8.5, -0.45, -5.5),
      new THREE.Vector3(18.0, -0.45, -20.0),
    ];
    const creekCurve = new THREE.CatmullRomCurve3(creekPts);
    const cSegs = 22;
    const cVerts: number[] = [];
    const cIdx: number[] = [];
    for (let i = 0; i <= cSegs; i++) {
      const u = i / cSegs;
      const p = creekCurve.getPoint(u);
      const t = creekCurve.getTangent(u);
      const nx = -t.z;
      const nz = t.x;
      const hw = 1.45;
      cVerts.push(p.x - nx * hw, p.y, p.z - nz * hw);
      cVerts.push(p.x + nx * hw, p.y, p.z + nz * hw);
      if (i < cSegs) {
        const a = i * 2;
        cIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const creekGeo = new THREE.BufferGeometry();
    creekGeo.setAttribute('position', new THREE.Float32BufferAttribute(cVerts, 3));
    creekGeo.setIndex(cIdx);
    creekGeo.computeVertexNormals();
    group.add(new THREE.Mesh(creekGeo, this.ecosystemRiverMat));

    const pathPts = [
      new THREE.Vector3(-14.0, -0.46, 20.0),
      new THREE.Vector3(-4.5, -0.46, 8.2),
      new THREE.Vector3(0.0, -0.45, 0.0),
      new THREE.Vector3(-1.2, -0.46, -12.0),
      new THREE.Vector3(2.5, -0.46, -24.0),
    ];
    const pathCurve = new THREE.CatmullRomCurve3(pathPts);
    const pVerts: number[] = [];
    const pIdx: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const p = pathCurve.getPoint(u);
      const t = pathCurve.getTangent(u);
      const nx = -t.z;
      const nz = t.x;
      const hw = 0.65;
      pVerts.push(p.x - nx * hw, p.y, p.z - nz * hw);
      pVerts.push(p.x + nx * hw, p.y, p.z + nz * hw);
      if (i < 20) {
        const a = i * 2;
        pIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const pathGeo = new THREE.BufferGeometry();
    pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pVerts, 3));
    pathGeo.setIndex(pIdx);
    pathGeo.computeVertexNormals();
    group.add(
      new THREE.Mesh(
        pathGeo,
        new THREE.MeshStandardMaterial({
          color: 0xd6b87c,
          roughness: 0.92,
          side: THREE.DoubleSide,
        })
      )
    );

    // Dense layered broadleaf oak & conifer woodland surrounding the sunlit central Glade opening (r = 5.2..36)
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.92 });
    const oakCrownGeo = new THREE.DodecahedronGeometry(1.35, 1);
    const pineCrownGeo = new THREE.ConeGeometry(1.1, 2.6, 7);

    const oakCount = this.isSoftwareGl ? 68 : 140;
    const pineCount = this.isSoftwareGl ? 56 : 110;
    const oakTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, oakCount);
    const oakCrowns = new THREE.InstancedMesh(oakCrownGeo, this.ecosystemMeadowMat, oakCount);
    const pineTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pineCount);
    const pineCrowns = new THREE.InstancedMesh(pineCrownGeo, this.ecosystemMeadowMat, pineCount);

    for (let i = 0; i < oakCount; i++) {
      const ang = seededRand(i * 17 + 1) * Math.PI * 2;
      const r = 5.2 + Math.pow(seededRand(i * 19 + 3), 0.85) * 32.0;
      const wx = Math.cos(ang) * r;
      const wz = Math.sin(ang) * r;
      // Keep the creek channel slightly clearer
      const nearCreek = wx > 4.5 && wx < 16.0 && wz > -4.0 && wz < 14.0 ? 2.8 : 0;
      const fx = wx + nearCreek;
      const s = 0.72 + seededRand(i * 7 + 5) * 0.72;
      const baseY = -0.5 + (r > 18.0 ? Math.min(3.0, (r - 18.0) * 0.06) : 0);

      _dummyObj.position.set(fx, baseY + 0.7 * s, wz);
      _dummyObj.scale.set(s, s, s);
      _dummyObj.rotation.set(0, ang, 0);
      _dummyObj.updateMatrix();
      oakTrunks.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(fx, baseY + 2.0 * s, wz);
      _dummyObj.scale.set(s * 1.15, s * 0.86, s * 1.15);
      _dummyObj.updateMatrix();
      oakCrowns.setMatrixAt(i, _dummyObj.matrix);

      _scratchColorA.setHex(
        i % 4 === 0 ? 0x4ca644 : i % 3 === 0 ? 0x2e8b3c : 0x236f32
      );
      oakCrowns.setColorAt(i, _scratchColorA);
    }

    for (let i = 0; i < pineCount; i++) {
      const ang = seededRand(i * 23 + 11) * Math.PI * 2;
      const r = 8.5 + seededRand(i * 29 + 7) * 36.0;
      const wx = Math.cos(ang) * r;
      const wz = Math.sin(ang) * r;
      const s = 0.8 + seededRand(i * 13 + 4) * 0.75;
      const baseY = -0.5 + (r > 18.0 ? Math.min(3.5, (r - 18.0) * 0.08) : 0);

      _dummyObj.position.set(wx, baseY + 0.65 * s, wz);
      _dummyObj.scale.set(s * 0.9, s, s * 0.9);
      _dummyObj.rotation.set(0, ang, 0);
      _dummyObj.updateMatrix();
      pineTrunks.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(wx, baseY + 2.2 * s, wz);
      _dummyObj.scale.set(s, s * 1.15, s);
      _dummyObj.updateMatrix();
      pineCrowns.setMatrixAt(i, _dummyObj.matrix);

      _scratchColorA.setHex(i % 3 === 0 ? 0x166534 : 0x1e5631);
      pineCrowns.setColorAt(i, _scratchColorA);
    }

    oakTrunks.instanceMatrix.needsUpdate = true;
    oakCrowns.instanceMatrix.needsUpdate = true;
    pineTrunks.instanceMatrix.needsUpdate = true;
    pineCrowns.instanceMatrix.needsUpdate = true;
    if (oakCrowns.instanceColor) oakCrowns.instanceColor.needsUpdate = true;
    if (pineCrowns.instanceColor) pineCrowns.instanceColor.needsUpdate = true;
    oakTrunks.computeBoundingSphere();
    oakCrowns.computeBoundingSphere();
    pineTrunks.computeBoundingSphere();
    pineCrowns.computeBoundingSphere();
    group.add(oakTrunks, oakCrowns, pineTrunks, pineCrowns);

    return () => {};
  }

  // --- 16. SUNLIT FOREST GLADE (+0.8 · 6.3 m) ---
  // Coherent woodland clearing matching Ecosystems above and Glade-Leaf below (no playable Capybara Forest until selected!)
  private populateForestCanopyMotesLayer(
    group: THREE.Group,
    glowTex: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    // Outer surrounding woodland forest ring (r = 15..42) framing the ONE unified Forest Glade (ForestMicroDiorama)
    // so zooming from Ecosystems (2.20) -> Forest Glade (0.80) -> Glade-Leaf (-2.00) has ZERO duplicate nested forests!
    const gladeRoot = new THREE.Group();
    gladeRoot.position.y = -0.82;
    group.add(gladeRoot);

    // Sunlit mossy woodland clearing floor grounding Forest Glade (0.8) smoothly into Leaf & Fur (-2.0)
    const clearingDisc = new THREE.Mesh(
      new THREE.CircleGeometry(21.5, 36),
      new THREE.MeshStandardMaterial({
        color: 0x3b7a42,
        roughness: 0.92,
        metalness: 0.0,
      })
    );
    clearingDisc.rotation.x = -Math.PI / 2;
    clearingDisc.position.y = -0.02;
    gladeRoot.add(clearingDisc);

    const outerFloorRing = new THREE.Mesh(
      new THREE.RingGeometry(18.5, 46.0, 40),
      new THREE.MeshStandardMaterial({
        color: 0x245d32,
        roughness: 0.95,
        metalness: 0.0,
      })
    );
    outerFloorRing.rotation.x = -Math.PI / 2;
    outerFloorRing.position.y = -0.05;
    gladeRoot.add(outerFloorRing);

    const trunkGeo = new THREE.CylinderGeometry(0.42, 0.72, 1.0, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.94 });
    const oakCrownGeo = new THREE.DodecahedronGeometry(2.35, 1);
    const pineCrownGeo = new THREE.ConeGeometry(1.9, 4.4, 7);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2a7f37, roughness: 0.84 });

    const oakCount = this.isSoftwareGl ? 24 : 44;
    const pineCount = this.isSoftwareGl ? 18 : 34;
    const oakTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, oakCount);
    const oakCrowns = new THREE.InstancedMesh(oakCrownGeo, canopyMat, oakCount);
    const pineTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pineCount);
    const pineCrowns = new THREE.InstancedMesh(pineCrownGeo, canopyMat, pineCount);

    for (let i = 0; i < oakCount; i++) {
      const ang = (i / oakCount) * Math.PI * 2 + seededRand(i * 11 + 3) * 0.25;
      const rad = 16.5 + seededRand(i * 17 + 5) * 24.0;
      const rawX = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad;
      const tx = tz > 2.5 && Math.abs(rawX) < 14.5 ? (rawX >= 0 ? rawX + 14.5 : rawX - 14.5) : rawX;
      const sc = 0.85 + seededRand(i * 7 + 2) * 0.55;
      const h = 6.2 * sc;

      _dummyObj.position.set(tx, h * 0.5, tz);
      _dummyObj.scale.set(sc, h, sc);
      _dummyObj.rotation.set(0, ang, 0);
      _dummyObj.updateMatrix();
      oakTrunks.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(tx, h + 0.65 * sc, tz);
      _dummyObj.scale.set(sc * 1.15, sc * 0.78, sc * 1.15);
      _dummyObj.updateMatrix();
      oakCrowns.setMatrixAt(i, _dummyObj.matrix);

      _scratchColorA.setHex(i % 3 === 0 ? 0x3b9642 : i % 2 === 0 ? 0x267534 : 0x1d5e2b);
      oakCrowns.setColorAt(i, _scratchColorA);
    }

    for (let i = 0; i < pineCount; i++) {
      const ang = (i / pineCount) * Math.PI * 2 + seededRand(i * 23 + 7) * 0.3;
      const rad = 19.0 + seededRand(i * 29 + 11) * 26.0;
      const rawX = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad;
      const tx = tz > 2.5 && Math.abs(rawX) < 15.5 ? (rawX >= 0 ? rawX + 15.5 : rawX - 15.5) : rawX;
      const sc = 0.9 + seededRand(i * 13 + 4) * 0.65;
      const h = 5.4 * sc;

      _dummyObj.position.set(tx, h * 0.5, tz);
      _dummyObj.scale.set(sc * 0.85, h, sc * 0.85);
      _dummyObj.rotation.set(0, ang, 0);
      _dummyObj.updateMatrix();
      pineTrunks.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(tx, h + 1.4 * sc, tz);
      _dummyObj.scale.set(sc, sc * 1.15, sc);
      _dummyObj.updateMatrix();
      pineCrowns.setMatrixAt(i, _dummyObj.matrix);

      _scratchColorA.setHex(i % 2 === 0 ? 0x166534 : 0x1e5631);
      pineCrowns.setColorAt(i, _scratchColorA);
    }

    oakTrunks.instanceMatrix.needsUpdate = true;
    oakCrowns.instanceMatrix.needsUpdate = true;
    pineTrunks.instanceMatrix.needsUpdate = true;
    pineCrowns.instanceMatrix.needsUpdate = true;
    if (oakCrowns.instanceColor) oakCrowns.instanceColor.needsUpdate = true;
    if (pineCrowns.instanceColor) pineCrowns.instanceColor.needsUpdate = true;
    oakTrunks.computeBoundingSphere();
    oakCrowns.computeBoundingSphere();
    pineTrunks.computeBoundingSphere();
    pineCrowns.computeBoundingSphere();
    gladeRoot.add(oakTrunks, oakCrowns, pineTrunks, pineCrowns);

    // Gentle sunlit golden canopy pollen motes
    const moteCount = this.isSoftwareGl ? 28 : 64;
    const pos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      pos[i * 3] = (seededRand(i * 3 + 1) - 0.5) * 18;
      pos[i * 3 + 1] = seededRand(i * 3 + 2) * 6.5;
      pos[i * 3 + 2] = (seededRand(i * 3 + 3) - 0.5) * 18;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        color: 0xfef08a,
        size: 0.32,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    gladeRoot.add(motes);

    return (dt) => {
      motes.rotation.y += dt * 0.06;
    };
  }

  // --- 17. FOREST MICRO-GLADE · RANDOMIZED 11-SPECIMEN STORYBOOK CLEARING (-2.0 · 1.0 cm) ---
  private populateLeafAndFurMicroLayer(
    layer: ScaleLayerRuntime,
    group: THREE.Group,
    glowWarm: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    let loaded = false;
    void import('./ForestMicroDioramaBuilder').then(({ buildForestMicroDiorama }) => {
      if (loaded || !group.parent) return;
      loaded = true;
      const diorama = buildForestMicroDiorama(
        group,
        glowWarm,
        this.isSoftwareGl,
        this.activeForestSpecimenId
      );
      this.forestDiorama = diorama;
      layer.materials = this.collectLayerMaterials(group);
      diorama.setActiveSpecimen(this.activeForestSpecimenId);
    });
    return (dt, elapsed) => {
      this.forestDiorama?.tick(dt, elapsed);
    };
  }

  // --- 18. BIOLOGICAL CELLS & CHLOROPLASTS (-4.3 · 50 µm) ---
  private populateBiologicalCellsLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      emissiveIntensity: 0.42,
      roughness: 0.32,
      opacity: 0.55,
    });

    const hexRadius = 5.6;
    const offsets = [
      [0, 0],
      [9.9, 0],
      [-9.9, 0],
      [4.95, 8.55],
      [-4.95, 8.55],
      [4.95, -8.55],
      [-4.95, -8.55],
    ];
    for (let c = 0; c < offsets.length; c++) {
      const [ox, oz] = offsets[c];
      const hexWall = new THREE.Mesh(
        new THREE.CylinderGeometry(hexRadius, hexRadius, 3.8, 6, 1, true),
        wallMat
      );
      hexWall.position.set(ox, 0, oz);
      group.add(hexWall);
    }

    // 10 µm Chromatin Nucleus at cell center (1/5 of 50 µm palisade cell!)
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x4338ca,
      emissiveIntensity: 0.55,
      roughness: 0.28,
      transparent: true,
    });
    const nucleus = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 24), nucleusMat);
    this.cellNucleusMesh = nucleus;
    this.cellNucleusMat = nucleusMat;
    group.add(nucleus);

    // 5 µm Discoid Chloroplasts (~1/10 of 50 µm cell!) streaming around vacuole
    const chloroGroup = new THREE.Group();
    const chloroMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x14532d,
      emissiveIntensity: 0.48,
      roughness: 0.28,
    });
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.56, 14, 14), chloroMat);
      ch.scale.set(1.55, 0.58, 0.95);
      ch.position.set(Math.cos(ang) * 3.9, Math.sin(ang * 2) * 0.45, Math.sin(ang) * 3.9);
      ch.rotation.y = -ang;
      chloroGroup.add(ch);
    }
    group.add(chloroGroup);
    group.rotation.x = 0.58;

    this.registerMarkerAnchor({
      id: 'marker_cell_dna_chromatin',
      label: 'Chromatin DNA Helix',
      sublabel: '3.4 nm Pitch · Inside Nucleus',
      node: nucleus,
      layerBandId: 'biological_cells',
      minLog: -8.0,
      maxLog: -3.6,
      targetLogMeters: -8.47,
      colorCss: '#2dd4bf',
      physicalRadiusWorldAtOneToOne: 0.002,
    });

    return (dt) => {
      chloroGroup.rotation.y += dt * 0.3;
    };
  }

  /**
   * Builds the luminous 30 nm Chromatin Solenoid Fiber & Histone Nucleosome bridge
   * (centered at log -6.40) linking Biological Cells (-4.3) smoothly into B-DNA (-8.47)
   * with zero per-frame heap allocations.
   */
  private ensureChromatinBridgeBuilt(): void {
    if (this.chromatinBridgeGroup) return;
    const bridge = new THREE.Group();
    bridge.name = 'scale_bridge_chromatin_nucleosome';
    bridge.visible = false;
    bridge.matrixWorldAutoUpdate = false;
    bridge.rotation.z = 0.24;
    installFastMatrixCull(bridge);
    this.rootGroup.add(bridge);
    this.chromatinBridgeGroup = bridge;
    this.chromatinBridgeMats.length = 0;

    if (!this.glowCoolTex) {
      this.glowCoolTex = this.createSoftRadialTexture(
        'rgba(235,248,255,1)',
        'rgba(56,189,248,0.38)'
      );
      this.glowCoolTex.userData.sharedAsset = true;
    }
    const glowCool = this.glowCoolTex;
    const coreGlowMat = new THREE.SpriteMaterial({
      map: glowCool,
      color: 0x38bdf8,
      opacity: 0.42,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coreGlow = new THREE.Sprite(coreGlowMat);
    coreGlow.scale.setScalar(24.0);
    bridge.add(coreGlow);
    this.chromatinBridgeMats.push({
      mat: coreGlowMat,
      baseOpacity: 0.42,
      defaultDepthWrite: false,
    });

    const beadCount = this.isSoftwareGl ? 28 : 44;
    const heightSpan = 26.0;
    const solenoidRadius = 5.4;
    const turns = 4.5;

    const histoneGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.48, 12);
    const histoneMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x3730a3,
      emissiveIntensity: 0.52,
      roughness: 0.28,
      transparent: true,
      opacity: 0.96,
    });
    const histoneInst = new THREE.InstancedMesh(histoneGeo, histoneMat, beadCount);
    const curvePts: THREE.Vector3[] = [];

    for (let i = 0; i < beadCount; i++) {
      const u = i / (beadCount - 1);
      const ang = u * Math.PI * 2 * turns;
      const y = (u - 0.5) * heightSpan;
      const rMod = solenoidRadius * (0.88 + 0.14 * Math.sin(u * Math.PI * 3));
      const px = Math.cos(ang) * rMod;
      const pz = Math.sin(ang) * rMod;
      curvePts.push(new THREE.Vector3(px, y, pz));

      _dummyObj.position.set(px, y, pz);
      _dummyObj.rotation.set(0.35, -ang, Math.PI * 0.5 + 0.22);
      _dummyObj.scale.setScalar(0.92 + 0.16 * Math.sin(i * 1.7));
      _dummyObj.updateMatrix();
      histoneInst.setMatrixAt(i, _dummyObj.matrix);

      _scratchColorA.setHex(i % 3 === 0 ? 0x818cf8 : i % 2 === 0 ? 0x38bdf8 : 0x2dd4bf);
      histoneInst.setColorAt(i, _scratchColorA);
    }
    histoneInst.instanceMatrix.needsUpdate = true;
    if (histoneInst.instanceColor) histoneInst.instanceColor.needsUpdate = true;
    histoneInst.computeBoundingSphere();
    bridge.add(histoneInst);
    this.chromatinBridgeMats.push({
      mat: histoneMat,
      baseOpacity: 0.96,
      defaultDepthWrite: true,
    });

    const linkerCurve = new THREE.CatmullRomCurve3(curvePts);
    const linkerGeo = new THREE.TubeGeometry(
      linkerCurve,
      this.isSoftwareGl ? 64 : 112,
      0.2,
      8,
      false
    );
    const linkerMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.62,
      roughness: 0.24,
      transparent: true,
      opacity: 0.92,
    });
    const linkerMesh = new THREE.Mesh(linkerGeo, linkerMat);
    bridge.add(linkerMesh);
    this.chromatinBridgeMats.push({
      mat: linkerMat,
      baseOpacity: 0.92,
      defaultDepthWrite: true,
    });
  }

  // --- 19. B-DNA DOUBLE HELIX & MOLECULES (-8.47 · 3.4 nm PITCH, 2.0 nm DIAMETER) ---
  private populateDnaHelixLayer(
    group: THREE.Group,
    glowCool: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const helix = new THREE.Group();
    helix.rotation.z = 0.28;
    group.add(helix);

    // Subtle luminous core backdrop sprite so DNA gleams visibly behind/around vessel during approach
    const dnaHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowCool,
        color: 0x2dd4bf,
        opacity: 0.44,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    dnaHalo.scale.setScalar(26.0);
    group.add(dnaHalo);

    // Accurate Watson-Crick B-DNA geometry with shared base-pair materials (4 shared materials vs 56 duplicates)
    const pairs = this.isSoftwareGl ? 28 : 44;
    const heightSpan = 38.0;
    const radius = 5.4;

    const backboneMatA = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.45,
      roughness: 0.24,
      transparent: true,
    });
    const backboneMatB = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0x9d174d,
      emissiveIntensity: 0.45,
      roughness: 0.24,
      transparent: true,
    });
    const baseColors = [0x34d399, 0xfbbf24, 0x60a5fa, 0xf43f5e];
    const baseMats = baseColors.map(
      (hex) =>
        new THREE.MeshStandardMaterial({
          color: hex,
          emissive: hex,
          emissiveIntensity: 0.34,
          roughness: 0.32,
          transparent: true,
        })
    );
    const atomGeo = new THREE.SphereGeometry(0.72, 12, 12);
    const rungGeo = new THREE.CylinderGeometry(0.22, 0.22, radius * 0.92, 8);

    for (let i = 0; i < pairs; i++) {
      const t = i / (pairs - 1) - 0.5;
      const y = t * heightSpan;
      const angleA = i * ((Math.PI * 2) / 10.5);
      const angleB = angleA + 2.42; // Authentic B-DNA major/minor groove asymmetry!
      const x1 = Math.cos(angleA) * radius;
      const z1 = Math.sin(angleA) * radius;
      const x2 = Math.cos(angleB) * radius;
      const z2 = Math.sin(angleB) * radius;

      const s1 = new THREE.Mesh(atomGeo, backboneMatA);
      s1.position.set(x1, y, z1);
      const s2 = new THREE.Mesh(atomGeo, backboneMatB);
      s2.position.set(x2, y, z2);
      helix.add(s1, s2);

      _scratchVecA.set(x2 - x1, 0, z2 - z1);
      const chordLen = _scratchVecA.length();
      _scratchVecA.normalize();

      const halfA = new THREE.Mesh(rungGeo, baseMats[i % 4]);
      halfA.position.set(x1 + _scratchVecA.x * chordLen * 0.25, y, z1 + _scratchVecA.z * chordLen * 0.25);
      halfA.quaternion.setFromUnitVectors(_upUnitVec, _scratchVecA);
      halfA.scale.set(1, (chordLen * 0.48) / (radius * 0.92), 1);

      const halfB = new THREE.Mesh(rungGeo, baseMats[(i + 2) % 4]);
      halfB.position.set(x1 + _scratchVecA.x * chordLen * 0.75, y, z1 + _scratchVecA.z * chordLen * 0.75);
      halfB.quaternion.copy(halfA.quaternion);
      halfB.scale.copy(halfA.scale);

      helix.add(halfA, halfB);
    }

    return (dt) => {
      helix.rotation.y += dt * 0.42;
    };
  }

  // --- 20. CARBON ATOM & SPHERICAL-HARMONIC ELECTRON CLOUD (-9.47 · 3.4 Å) ---
  private populateAtomicOrbitalsLayer(
    group: THREE.Group,
    glowCool: THREE.CanvasTexture
  ): (dt: number, elapsed: number, gamma: number) => void {
    // True 1:1 Atom-to-Nucleus Empty Space!
    // Carbon van der Waals diameter = 3.4×10^-10 m; Carbon-12 Nucleus = 5.4×10^-15 m (1 / 62,963 of atom!)
    // At gamma = 1.0, the nucleus is a femtometer Coulomb point glint; under Reality Rescaler, it magnifies smoothly!
    this.atomicNuclearClusterGroup = new THREE.Group();
    const miniNuc = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfb7185 })
    );
    this.atomicNuclearClusterGroup.add(miniNuc);
    group.add(this.atomicNuclearClusterGroup);

    const coulombPinpoint = this.createSinglePointGlint(0xf43f5e, 11.0, 0.45);
    group.add(coulombPinpoint);

    const nucAnchor = new THREE.Object3D();
    group.add(nucAnchor);
    this.registerMarkerAnchor({
      id: 'marker_c12_nucleus',
      label: 'Carbon-12 Nucleus',
      sublabel: '5.4 fm · 1/63,000 of Atom',
      node: nucAnchor,
      layerBandId: 'atomic_orbitals',
      minLog: -13.8,
      maxLog: -9.0,
      targetLogMeters: -14.27,
      colorCss: '#f43f5e',
      physicalRadiusWorldAtOneToOne: 0.0003,
    });

    // Monte-Carlo sampled |psi(r,theta,phi)|^2 quantum probability density cloud (1s + 2s + 2p_x/y/z) using PSF shader!
    const sampleCount = this.isSoftwareGl ? 1100 : 3800;
    const pos = new Float32Array(sampleCount * 3);
    const col = new Float32Array(sampleCount * 3);
    const sc = new Float32Array(sampleCount);
    const lum = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const orbitalType = i % 6; // 2 in 1s, 2 in 2s, 2 in 2p
      let x = 0;
      let y = 0;
      let z = 0;
      if (orbitalType < 2) {
        // Inner 1s core shell
        const r = Math.pow(seededRand(i * 5 + 1), 0.65) * 3.8;
        const th = Math.acos(2 * seededRand(i * 5 + 2) - 1);
        const ph = seededRand(i * 5 + 3) * Math.PI * 2;
        x = r * Math.sin(th) * Math.cos(ph);
        y = r * Math.cos(th);
        z = r * Math.sin(th) * Math.sin(ph);
        _scratchColorA.setRGB(0.95, 0.88, 0.55);
      } else {
        // Outer 2p dumbbell lobes along X, Y, Z
        const axis = i % 3;
        const sign = seededRand(i * 5 + 4) < 0.5 ? -1 : 1;
        const lobeDist = 4.2 + Math.pow(seededRand(i * 5 + 1), 0.75) * 14.2;
        const spread = (1.2 + lobeDist * 0.28) * (seededRand(i * 5 + 2) + seededRand(i * 5 + 3) - 1.0);
        const spread2 = (1.2 + lobeDist * 0.28) * (seededRand(i * 7 + 1) + seededRand(i * 7 + 2) - 1.0);
        if (axis === 0) {
          x = sign * lobeDist;
          y = spread;
          z = spread2;
          _scratchColorA.setRGB(0.22, 0.74, 0.98);
        } else if (axis === 1) {
          x = spread;
          y = sign * lobeDist;
          z = spread2;
          _scratchColorA.setRGB(0.50, 0.55, 0.98);
        } else {
          x = spread;
          y = spread2;
          z = sign * lobeDist;
          _scratchColorA.setRGB(0.18, 0.84, 0.75);
        }
      }
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;
      sc[i] = 0.85 + seededRand(i * 3 + 3) * 1.1;
      lum[i] = 0.35 + seededRand(i * 3 + 4) * 0.45;
    }

    const cloudGeo = new THREE.BufferGeometry();
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    cloudGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    cloudGeo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    cloudGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    this.atomicCloudPoints = new THREE.Points(
      cloudGeo,
      createStarPsfMaterial({
        baseSize: 22.0,
        maxPixelSize: 28.0,
        diffractionStrength: 0.0,
        opacity: 0.90,
      })
    );
    group.add(this.atomicCloudPoints);

    const waveHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowCool,
        color: 0x38bdf8,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    waveHalo.scale.setScalar(30);
    this.atomicOrbitalsWaveHalo = waveHalo;
    group.add(waveHalo);

    this.electronMarkers = [];

    return (dt, _elapsed, gamma) => {
      const alphaRate = THREE.MathUtils.clamp(this.fineStructureRatio, 0.55, 2.3);
      const bohrRadiusScale = THREE.MathUtils.clamp(1.0 / alphaRate, 0.45, 2.2);
      group.rotation.y += dt * 0.14 * alphaRate;
      if (this.atomicCloudPoints) {
        this.atomicCloudPoints.scale.setScalar(bohrRadiusScale);
      }
      waveHalo.scale.setScalar(26 * bohrRadiusScale);
      if (this.atomicNuclearClusterGroup) {
        // Exact 1/62,963 ratio at gamma=1.0; expands smoothly to ~1.5 units as gamma -> 0.28!
        const nucScale = 19.0 * Math.pow(1 / 62963, gamma);
        this.atomicNuclearClusterGroup.scale.setScalar(Math.max(0.0003, nucScale));
      }
    };
  }

  // --- 21. ATOMIC NUCLEUS · PROTONS & NEUTRONS (-14.27 · 5.4 fm) ---
  private populateAtomicNucleusLayer(
    group: THREE.Group,
    glowWarm: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const protonMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0x9f1239,
      emissiveIntensity: 0.62,
      roughness: 0.18,
      metalness: 0.12,
    });
    const neutronMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x075985,
      emissiveIntensity: 0.62,
      roughness: 0.18,
      metalness: 0.12,
    });
    const nucGeo = new THREE.SphereGeometry(2.65, this.isSoftwareGl ? 18 : 28, 20);

    const phiGold = (1 + Math.sqrt(5)) / 2;
    const coords: Array<[number, number, number]> = [
      [0, 1, phiGold],
      [0, -1, phiGold],
      [0, 1, -phiGold],
      [0, -1, -phiGold],
      [1, phiGold, 0],
      [-1, phiGold, 0],
      [1, -phiGold, 0],
      [-1, -phiGold, 0],
      [phiGold, 0, 1],
      [-phiGold, 0, 1],
      [phiGold, 0, -1],
      [-phiGold, 0, -1],
    ];

    this.nucleonMeshes = [];
    for (let i = 0; i < coords.length; i++) {
      const basePos = new THREE.Vector3(coords[i][0], coords[i][1], coords[i][2]).multiplyScalar(
        2.52
      );
      const mesh = new THREE.Mesh(nucGeo, i % 2 === 0 ? protonMat : neutronMat);
      mesh.position.copy(basePos);
      group.add(mesh);
      this.nucleonMeshes.push({ mesh, basePos, phase: i * 0.85 });
    }

    const yukawaHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowWarm,
        color: 0xfb7185,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    yukawaHalo.scale.setScalar(20);
    group.add(yukawaHalo);

    const quarkAnchor = new THREE.Object3D();
    group.add(quarkAnchor);
    this.registerMarkerAnchor({
      id: 'marker_valence_quarks',
      label: 'u-u-d Valence Quarks',
      sublabel: '10^-18 m · QCD Confinement',
      node: quarkAnchor,
      layerBandId: 'atomic_nucleus',
      minLog: -17.5,
      maxLog: -13.8,
      targetLogMeters: -18.0,
      colorCss: '#c084fc',
      physicalRadiusWorldAtOneToOne: 0.004,
    });

    return (dt, elapsed) => {
      group.rotation.y += dt * 0.32;
      for (let i = 0; i < this.nucleonMeshes.length; i++) {
        const n = this.nucleonMeshes[i];
        const j = 1 + Math.sin(elapsed * 9.0 + n.phase) * 0.06;
        n.mesh.position.copy(n.basePos).multiplyScalar(j);
      }
    };
  }

  // --- 22. QUARKS & QCD GLUON FLUX TUBES (-18.0 · 1.0 am) ---
  private populateQuarksGluonsLayer(
    group: THREE.Group,
    glowWarm: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const qcdGlint = this.createSinglePointGlint(0xc084fc, 16.0, 0.55);
    group.add(qcdGlint);

    // Soft translucent QCD hadron bag haze instead of wireframe sphere
    const bagHaze = new THREE.Mesh(
      new THREE.SphereGeometry(14.0, 32, 24),
      createAtmosphereScatteringMaterial({
        sunDir: _sharedSunDir,
        rayleighColor: new THREE.Color(0.55, 0.36, 0.96),
        intensity: 0.95,
      })
    );
    group.add(bagHaze);

    const quarkDefs = [
      { angle: 0, hex: 0xf43f5e },
      { angle: (Math.PI * 2) / 3, hex: 0x22c55e },
      { angle: (Math.PI * 4) / 3, hex: 0x38bdf8 },
    ];

    const ribbonMat = createCosmicFilamentRibbonMaterial(0.85);
    this.quarkMeshes = [];
    for (let q = 0; q < quarkDefs.length; q++) {
      const def = quarkDefs[q];
      const basePos = new THREE.Vector3(
        Math.cos(def.angle) * 7.8,
        Math.sin(def.angle) * 7.8,
        0
      );
      const qMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      qMesh.position.copy(basePos);

      const qGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowWarm,
          color: def.hex,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      qGlow.scale.setScalar(8.2);
      qMesh.add(qGlow);
      group.add(qMesh);

      const tube = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 1, 10), ribbonMat);
      group.add(tube);
      this.quarkMeshes.push({ mesh: qMesh, basePos, tube, phase: q * 2.1 });
    }

    return (dt, elapsed) => {
      group.rotation.z += dt * 0.25;
      group.rotation.y += dt * 0.2;
      for (let i = 0; i < this.quarkMeshes.length; i++) {
        const q = this.quarkMeshes[i];
        q.mesh.position.set(
          q.basePos.x + Math.sin(elapsed * 6.0 + q.phase) * 1.1,
          q.basePos.y + Math.cos(elapsed * 5.4 + q.phase) * 1.1,
          Math.sin(elapsed * 6.8 + q.phase) * 1.2
        );
        const len = q.mesh.position.length();
        q.tube.position.copy(q.mesh.position).multiplyScalar(0.5);
        _scratchVecA.copy(q.mesh.position).normalize();
        q.tube.quaternion.setFromUnitVectors(_upUnitVec, _scratchVecA);
        q.tube.scale.set(1 + Math.sin(elapsed * 12 + q.phase) * 0.2, len, 1);
      }
    };
  }

  // --- 23. SINGLE ELECTRON · DIRAC SPINOR PROBABILITY CURRENT (-23.0) ---
  private populateSingleElectronLayer(
    group: THREE.Group,
    glowCool: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    // Point-like fundamental fermion excitation + smooth PSF Dirac spin-1/2 toroidal current cloud
    const core = this.createSinglePointGlint(0xe0f2fe, 28.0, 0.92);
    group.add(core);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowCool,
        color: 0x22d3ee,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.setScalar(13.0);
    this.singleElectronHalo = halo;
    group.add(halo);

    const count = this.isSoftwareGl ? 600 : 2200;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sc = new Float32Array(count);
    const lum = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = (i / count) * Math.PI * 2;
      const v = seededRand(i * 5 + 1) * Math.PI * 2;
      const minorR = 2.4 * Math.pow(seededRand(i * 5 + 2), 0.6);
      const majorR = 7.2;
      pos[i * 3] = (majorR + minorR * Math.cos(v)) * Math.cos(u);
      pos[i * 3 + 1] = minorR * Math.sin(v) * 1.4;
      pos[i * 3 + 2] = (majorR + minorR * Math.cos(v)) * Math.sin(u);
      _scratchColorA.setHSL(0.52 + 0.08 * Math.sin(u * 2), 0.92, 0.68);
      col[i * 3] = _scratchColorA.r;
      col[i * 3 + 1] = _scratchColorA.g;
      col[i * 3 + 2] = _scratchColorA.b;
      sc[i] = 0.75 + seededRand(i * 5 + 3) * 1.1;
      lum[i] = 0.55;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    geo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));
    const torusCloud = new THREE.Points(
      geo,
      createStarPsfMaterial({ baseSize: 16.0, maxPixelSize: 24.0, diffractionStrength: 0.0, opacity: 0.92 })
    );
    torusCloud.rotation.x = 0.35;
    this.singleElectronTorus = torusCloud;
    group.add(torusCloud);

    return (dt, elapsed) => {
      const alphaRate = THREE.MathUtils.clamp(this.fineStructureRatio, 0.55, 2.3);
      const comptonScale = THREE.MathUtils.clamp(1.0 / Math.sqrt(alphaRate), 0.72, 1.35);
      torusCloud.scale.setScalar(comptonScale);
      torusCloud.rotation.y += dt * 1.4 * alphaRate;
      halo.scale.setScalar((10.5 + Math.sin(elapsed * 5.0 * alphaRate) * 0.8) * comptonScale);
    };
  }

  // --- 24. SINGLE PHOTON · QUANTIZED E ⊥ B WAVE-PACKET (-29.0) ---
  private populateSinglePhotonLayer(
    group: THREE.Group,
    glowWarm: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const samples = this.isSoftwareGl ? 64 : 128;
    this.photonElectricPositions = new Float32Array(samples * 3);
    this.photonMagneticPositions = new Float32Array(samples * 3);

    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(this.photonElectricPositions, 3));
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(this.photonMagneticPositions, 3));

    this.photonElectricLine = new THREE.Line(
      eGeo,
      new THREE.LineBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      })
    );
    this.photonMagneticLine = new THREE.Line(
      bGeo,
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      })
    );
    group.add(this.photonElectricLine, this.photonMagneticLine);

    this.photonVectorGroup = new THREE.Group();
    const barCount = 28;
    const barGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 6);
    const eBarMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const bBarMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < barCount; i++) {
      const u = i / (barCount - 1) - 0.5;
      const x = u * 28;
      const eBar = new THREE.Mesh(barGeo, eBarMat);
      eBar.position.set(x, 0, 0);
      eBar.userData.barNormX = u;
      eBar.userData.isElectric = true;

      const bBar = new THREE.Mesh(barGeo, bBarMat);
      bBar.position.set(x, 0, 0);
      bBar.rotation.x = Math.PI / 2;
      bBar.userData.barNormX = u;
      bBar.userData.isElectric = false;

      this.photonVectorGroup.add(eBar, bBar);
    }
    group.add(this.photonVectorGroup);

    const photonGlint = this.createSinglePointGlint(0xfef08a, 24.0, 0.65);
    group.add(photonGlint);

    const core = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowWarm,
        color: 0xfef9c3,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    core.scale.setScalar(12.0);
    this.singlePhotonCore = core;
    group.add(core);

    group.rotation.y = -0.35;
    group.rotation.x = 0.22;

    this.updatePhotonWavePacket(0);
    return (_dt, elapsed) => {
      this.updatePhotonWavePacket(elapsed);
    };
  }

  private updatePhotonWavePacket(elapsed: number) {
    if (
      !this.photonElectricPositions ||
      !this.photonMagneticPositions ||
      !this.photonElectricLine ||
      !this.photonMagneticLine
    ) {
      return;
    }

    const samples = this.photonElectricPositions.length / 3;
    const alphaRate = THREE.MathUtils.clamp(this.fineStructureRatio, 0.55, 2.3);
    const kFreq = 26.0 * THREE.MathUtils.clamp(0.75 + 0.25 * alphaRate, 0.65, 1.65);
    const ampScale = THREE.MathUtils.clamp(0.82 + 0.18 * alphaRate, 0.7, 1.35);
    const phase = -elapsed * (8.5 * (0.8 + 0.2 * alphaRate));
    for (let i = 0; i < samples; i++) {
      const u = i / (samples - 1) - 0.5;
      const x = u * 30.0;
      const env = Math.exp(-u * u * 14.0) * 7.8 * ampScale;
      const wave = Math.sin(u * kFreq + phase) * env;
      this.photonElectricPositions[i * 3] = x;
      this.photonElectricPositions[i * 3 + 1] = wave;
      this.photonElectricPositions[i * 3 + 2] = 0;
      this.photonMagneticPositions[i * 3] = x;
      this.photonMagneticPositions[i * 3 + 1] = 0;
      this.photonMagneticPositions[i * 3 + 2] = wave;
    }
    this.photonElectricLine.geometry.attributes.position.needsUpdate = true;
    this.photonMagneticLine.geometry.attributes.position.needsUpdate = true;

    if (this.photonVectorGroup) {
      const children = this.photonVectorGroup.children;
      for (let i = 0; i < children.length; i++) {
        const bar = children[i] as THREE.Mesh;
        const u = bar.userData.barNormX as number;
        const env = Math.exp(-u * u * 14.0) * 7.8 * ampScale;
        const amp = Math.sin(u * kFreq + phase) * env;
        const absAmp = Math.max(0.05, Math.abs(amp));
        if (bar.userData.isElectric) {
          bar.position.y = amp * 0.5;
          bar.scale.set(1, absAmp, 1);
        } else {
          bar.position.z = amp * 0.5;
          bar.scale.set(1, absAmp, 1);
        }
      }
    }
  }

  // --- 25. PLANCK QUANTUM FOAM (-35.0 · 1.616×10^-35 m) ---
  private populatePlanckQuantumFoamLayer(
    group: THREE.Group,
    glowCool: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const segs = this.isSoftwareGl ? 20 : 36;
    const gridGeo = new THREE.PlaneGeometry(36, 36, segs, segs);
    gridGeo.rotateX(-Math.PI / 2);
    this.planckFoamGridGeo = gridGeo;
    const vCount = gridGeo.attributes.position.count;
    this.planckFoamBaseZ = new Float32Array(vCount * 2);
    const vColors = new Float32Array(vCount * 3);
    for (let i = 0; i < vCount; i++) {
      const vx = gridGeo.attributes.position.getX(i);
      const vz = gridGeo.attributes.position.getZ(i);
      this.planckFoamBaseZ[i * 2] = vx;
      this.planckFoamBaseZ[i * 2 + 1] = vz;
      // Radial perimeter falloff so additive wireframe grid fades smoothly into deep quantum vacuum
      const r = Math.hypot(vx, vz);
      const falloff = 1.0 - smoothstep01(7.0, 17.5, r);
      vColors[i * 3] = 0.52 * falloff;
      vColors[i * 3 + 1] = 0.56 * falloff;
      vColors[i * 3 + 2] = 1.0 * falloff;
    }
    gridGeo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));

    const foamMesh = new THREE.Mesh(
      gridGeo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        wireframe: true,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    foamMesh.position.y = -2.2;
    group.add(foamMesh);

    const planckGlint = this.createSinglePointGlint(0xe879f9, 20.0, 0.55);
    group.add(planckGlint);

    const spark = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowCool,
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    spark.scale.setScalar(9.5);
    group.add(spark);

    return (_dt, elapsed) => {
      if (!this.planckFoamGridGeo || !this.planckFoamBaseZ) return;
      const pos = this.planckFoamGridGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = this.planckFoamBaseZ[i * 2];
        const z = this.planckFoamBaseZ[i * 2 + 1];
        const foam =
          Math.sin(x * 0.55 + elapsed * 4.2) *
            Math.cos(z * 0.55 - elapsed * 3.7) *
            2.4 +
          Math.sin((x + z) * 0.9 + elapsed * 6.5) * 0.95;
        pos.setY(i, foam);
      }
      pos.needsUpdate = true;
    };
  }

  // ============================================================================
  // WOODLAND CAPYBARA FOREST GROVE (LIVE GRAZING HERD + PERIMETER WOODLAND)
  // ============================================================================

  private buildWoodlandCapybaraGrove() {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.9,
    });
    const pineMat = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.8,
    });

    const placements: Array<{ x: number; z: number; s: number }> = [];
    const pineCandidates = 18;
    for (let i = 0; i < pineCandidates; i++) {
      const ang = (i / pineCandidates) * Math.PI * 2 + 0.19;
      if (Math.abs(Math.sin(ang * 2)) > 0.84) continue;
      const r = 27.5 + (i % 3) * 1.9;
      placements.push({
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        s: 0.85 + (i % 3) * 0.22,
      });
    }

    const trunkInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.28, 0.42, 2.6, 7),
      trunkMat,
      placements.length
    );
    trunkInst.userData.ignoreCameraFade = true;

    const coneInst = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1.65, 2.4, 8),
      pineMat,
      placements.length * 3
    );
    coneInst.userData.ignoreCameraFade = true;

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      _dummyObj.position.set(p.x, 1.3 * p.s, p.z);
      _dummyObj.rotation.set(0, i * 0.7, 0);
      _dummyObj.scale.setScalar(p.s);
      _dummyObj.updateMatrix();
      trunkInst.setMatrixAt(i, _dummyObj.matrix);

      for (let tier = 0; tier < 3; tier++) {
        const ts = p.s * (1 - tier * 0.22);
        _dummyObj.position.set(p.x, (2.3 + tier * 1.35) * p.s, p.z);
        _dummyObj.scale.set(ts, p.s, ts);
        _dummyObj.updateMatrix();
        coneInst.setMatrixAt(i * 3 + tier, _dummyObj.matrix);
      }
    }
    trunkInst.instanceMatrix.needsUpdate = true;
    coneInst.instanceMatrix.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    coneInst.computeBoundingSphere();
    this.forestGroveGroup.add(trunkInst, coneInst);

    const allHerdSpecs: Array<{
      x: number;
      z: number;
      scale: number;
      hat: string;
      skin: string;
      radius: number;
      speed: number;
    }> = [
      { x: 4.8, z: 4.6, scale: 0.92, hat: 'flower', skin: 'classic', radius: 1.1, speed: 0.55 },
      { x: 6.1, z: 5.5, scale: 0.58, hat: 'yuzu', skin: 'golden', radius: 0.85, speed: 0.82 },
      { x: -4.6, z: 5.8, scale: 0.88, hat: 'yuzu', skin: 'cocoa', radius: 1.0, speed: 0.48 },
      { x: 10.2, z: -6.2, scale: 0.95, hat: 'none', skin: 'classic', radius: 1.25, speed: 0.52 },
      { x: -6.2, z: -5.4, scale: 0.64, hat: 'flower', skin: 'sakura', radius: 0.9, speed: 0.74 },
    ];

    const lodTier: CapyLodTier = 2;
    for (let i = 0; i < allHerdSpecs.length; i++) {
      const hs = allHerdSpecs[i];
      const capy = CapyModelGenerator.createCapybara(
        hs.hat,
        hs.scale,
        hs.skin,
        [],
        lodTier
      );
      capy.traverse((node) => {
        node.userData.ignoreCameraFade = true;
      });
      capy.position.set(hs.x, 0, hs.z);
      this.forestGroveGroup.add(capy);
      this.woodlandCapys.push({
        capy,
        anchorX: hs.x,
        anchorZ: hs.z,
        orbitRadius: hs.radius,
        speed: hs.speed,
        phase: i * 1.35,
      });
    }
  }

  private woodlandElapsed = 0;

  public tickWoodlandCapys(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.woodlandElapsed += dt;
    for (let i = 0; i < this.woodlandCapys.length; i++) {
      const w = this.woodlandCapys[i];
      const t = this.woodlandElapsed * w.speed + w.phase;
      const nx = w.anchorX + Math.cos(t) * w.orbitRadius;
      const nz = w.anchorZ + Math.sin(t) * w.orbitRadius;
      const dx = nx - w.capy.position.x;
      const dz = nz - w.capy.position.z;
      w.capy.position.x = nx;
      w.capy.position.z = nz;
      if (Math.abs(dx) + Math.abs(dz) > 0.0001) {
        w.capy.rotation.y = Math.atan2(dx, dz);
      }
      w.capy.position.y = Math.abs(Math.sin(t * 3.2)) * 0.04;
    }
  }

  // ============================================================================
  // TRUE BASE-10 (1:1) + LOGARITHMIC/EXPONENTIAL REALITY RESCALER UPDATE
  // ============================================================================

  public updateForLogScale(
    logScaleMeters: number,
    dt: number,
    quantumFocus: QuantumFocusMode,
    focalWorldPos: THREE.Vector3,
    outSkyColor: THREE.Color,
    realityScaleGamma: number = 1.0,
    showObjectMarkers: boolean = false,
    astrophysicsPalette: AstrophysicsPaletteMode = 'natural',
    suppressGladeForSurfaceLanding: boolean = false,
    suppressWoodlandSurfaceLayers: boolean = false
  ): UniverseScaleBandSpec {
    this.ensureLayersBuilt();
    this.elapsed += dt;

    const gamma = THREE.MathUtils.clamp(realityScaleGamma, 0.28, 1.0);
    const hubbleMix = astrophysicsPalette === 'hubble' ? 0.92 : 0.18;

    this.rootGroup.visible = true;
    this.rootGroup.matrixWorldAutoUpdate = true;
    this.rootGroup.position.copy(focalWorldPos);

    // 1. Update Persistent 3D Celestial PSF Starfield (+3.8m .. +29.0m) & Deep Quantum Vacuum Field (-15.5m .. -35.0m)
    const starSkyAlpha =
      smoothstep01(3.8, 5.8, logScaleMeters) * (1 - smoothstep01(27.2, 29.0, logScaleMeters));
    const quantumFieldAlpha =
      0.46 * smoothstep01(-15.2, -18.2, logScaleMeters);
    if (starSkyAlpha > 0.01 || quantumFieldAlpha > 0.01) {
      this.celestialBackdropGroup.visible = true;
      this.celestialBackdropGroup.matrixWorldAutoUpdate = true;
      this.celestialBackdropGroup.position.copy(focalWorldPos);
      if (this.celestialStarPoints && this.celestialStarMat) {
        this.celestialStarPoints.visible = starSkyAlpha > 0.01;
        this.celestialStarMat.opacity = starSkyAlpha;
      }
      if (this.quantumFieldPoints && this.quantumFieldMat) {
        this.quantumFieldPoints.visible = quantumFieldAlpha > 0.01;
        this.quantumFieldMat.opacity = quantumFieldAlpha;
        this.quantumFieldPoints.rotation.y += dt * 0.035;
      }
    } else {
      this.celestialBackdropGroup.visible = false;
      this.celestialBackdropGroup.matrixWorldAutoUpdate = false;
    }

    // 2. Interpolate background sky color smoothly between bracketing scale bands
    let upperIdx = 0;
    let lowerIdx = this.layers.length - 1;
    for (let i = 0; i < this.layers.length - 1; i++) {
      const hi = this.layers[i].spec.logMeters;
      const lo = this.layers[i + 1].spec.logMeters;
      if (logScaleMeters <= hi && logScaleMeters >= lo) {
        upperIdx = i;
        lowerIdx = i + 1;
        break;
      }
    }
    if (logScaleMeters > this.layers[0].spec.logMeters) {
      outSkyColor.setHex(this.layers[0].spec.skyHex);
    } else if (logScaleMeters < this.layers[this.layers.length - 1].spec.logMeters) {
      outSkyColor.setHex(this.layers[this.layers.length - 1].spec.skyHex);
    } else {
      const hiSpec = this.layers[upperIdx].spec;
      const loSpec = this.layers[lowerIdx].spec;
      const span = Math.max(0.001, hiSpec.logMeters - loSpec.logMeters);
      const frac = THREE.MathUtils.clamp((hiSpec.logMeters - logScaleMeters) / span, 0, 1);
      const smoothFrac = frac * frac * (3 - 2 * frac);
      _scratchColorA.setHex(hiSpec.skyHex);
      _scratchColorB.setHex(loSpec.skyHex);
      outSkyColor.copy(_scratchColorA).lerp(_scratchColorB, smoothFrac);
    }

    // 3. Evaluate True Physical 10^(gamma * deltaLog) Scale & Smooth Radiative Cross-Fade per Layer
    let primaryLayer = this.layers[0];
    let minAbsDiff = Infinity;

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const centerLog = layer.spec.logMeters;
      const absDiff = Math.abs(centerLog - logScaleMeters);
      if (absDiff < minAbsDiff) {
        minAbsDiff = absDiff;
        primaryLayer = layer;
      }

      // Physical order-of-magnitude offset from active viewport:
      // deltaLog < 0 => child object smaller than viewport (shrinks by 10^(gamma*deltaLog) at center)
      // deltaLog === 0 => exact 1.0x canonical viewport match
      // deltaLog > 0 => parent structure larger than viewport (expands by 10^(gamma*deltaLog) past camera)
      let deltaLog = centerLog - logScaleMeters;

      // Optional Quantum Focus override below 10^-20 m for inspecting Electron vs Photon
      let focusBoost = 1.0;
      if (logScaleMeters <= -20.0 && quantumFocus !== 'auto') {
        if (quantumFocus === 'electron' && layer.spec.id === 'single_electron') {
          deltaLog = THREE.MathUtils.clamp(deltaLog, -0.35, 0.35);
        } else if (quantumFocus === 'photon' && layer.spec.id === 'single_photon') {
          deltaLog = THREE.MathUtils.clamp(deltaLog, -0.35, 0.35);
        } else if (
          (quantumFocus === 'electron' && layer.spec.id === 'single_photon') ||
          (quantumFocus === 'photon' && layer.spec.id === 'single_electron')
        ) {
          focusBoost = 0.14;
        }
      }

      // Neighbor-aware visibility bounds:
      // At strict 1:1 (gamma = 1.0): parent layers overlap neighboring bands seamlessly so no transition ever goes blank,
      // while giant cosmic/planet structures still fade cleanly before camera membrane intersections.
      const layerId = layer.spec.id;
      const isMultiverse = layerId === 'multiverse';
      const isBigBang = layerId === 'big_bang';
      const isUniverse = layerId === 'universe';
      const isObservable = layerId === 'observable';
      const isGalaxy = layerId === 'galaxy';
      const isStellarSystems = layerId === 'stellar_systems';
      const isNebulas = layerId === 'nebulas';
      const isPlanetarySystem = layerId === 'planetary_system';
      const isPlanet = layerId === 'planet';
      const isAtmosphere = layerId === 'atmosphere';
      const isLandMasses = layerId === 'land_masses';
      const isEcosystems = layerId === 'ecosystems';
      const isForestGlade = layerId === 'capybara_forest';
      const isLeafGlade = layerId === 'leaf_fur_micro';
      const isBiologicalCells = layerId === 'biological_cells';
      const isDna = layerId === 'dna_molecules';
      const isAtomicOrbitals = layerId === 'atomic_orbitals';
      const isAtomicNucleus = layerId === 'atomic_nucleus';
      const isQuarksGluons = layerId === 'quarks_gluons';
      const isSingleElectron = layerId === 'single_electron';
      const isSinglePhoton = layerId === 'single_photon';
      const isPlanckFoam = layerId === 'planck_quantum_foam';

      // When zooming out from Capytorio (industrial meadow/aquatic world), never fade in
      // Sanctuary's woodland glade / giant pine ecosystem / valley canopy meshes on top of the factory!
      if (
        suppressWoodlandSurfaceLayers &&
        (isLandMasses || isEcosystems || isForestGlade || isLeafGlade)
      ) {
        if (layer.group.visible) {
          layer.group.visible = false;
        }
        layer.group.matrixWorldAutoUpdate = false;
        continue;
      }

      // Unified Forest Glade continuous zoom curve:
      // Makes the ONE ForestMicroDiorama emerge smoothly inside Ecosystems (2.20), open into a wide
      // establishing Forest Glade at 0.80 (0.66x), and glide seamlessly closer to 1.00x at Glade-Leaf (-2.00)
      // with ZERO duplicate nested forests!
      let scaledDelta = deltaLog * gamma;
      if (isLeafGlade && logScaleMeters > -2.0) {
        if (logScaleMeters <= 0.8) {
          const tGlade = (0.8 - logScaleMeters) / 2.8;
          scaledDelta = THREE.MathUtils.lerp(-0.18, 0.0, tGlade);
        } else {
          scaledDelta = -0.18 - (logScaleMeters - 0.8) * gamma;
        }
      }

      let maxExpandDex = 1.65;
      if (isMultiverse) {
        maxExpandDex = 2.6;
      } else if (isBigBang) {
        maxExpandDex = 2.2;
      } else if (isUniverse) {
        maxExpandDex = 2.6;
      } else if (isObservable) {
        maxExpandDex = 2.8;
      } else if (isGalaxy) {
        maxExpandDex = 3.55;
      } else if (isStellarSystems) {
        maxExpandDex = 4.45;
      } else if (isNebulas) {
        maxExpandDex = 2.05;
      } else if (isPlanetarySystem) {
        maxExpandDex = 1.65;
      } else if (isPlanet) {
        maxExpandDex = suppressWoodlandSurfaceLayers ? 6.5 : 3.35;
      } else if (isAtmosphere) {
        maxExpandDex = suppressWoodlandSurfaceLayers ? 1.45 : 0.65;
      } else if (isLandMasses) {
        maxExpandDex = 1.15;
      } else if (isEcosystems) {
        maxExpandDex = 1.25;
      } else if (isForestGlade) {
        maxExpandDex = 2.0;
      } else if (isLeafGlade) {
        maxExpandDex = 2.0;
      } else if (isBiologicalCells) {
        maxExpandDex = 2.0;
      } else if (isDna) {
        // Bridge DNA double-helix smoothly into Carbon-12 electron orbitals (-9.47)
        maxExpandDex = 1.6;
      } else if (isAtomicOrbitals) {
        maxExpandDex = 3.8;
      } else if (isAtomicNucleus) {
        maxExpandDex = 1.65;
      } else if (isQuarksGluons) {
        maxExpandDex = 1.45;
      } else if (isSingleElectron) {
        maxExpandDex = 1.45;
      } else if (isSinglePhoton) {
        maxExpandDex = 1.25;
      }

      let maxShrinkDex = -2.45;
      if (isBigBang) {
        maxShrinkDex = -3.0;
      } else if (isUniverse || isObservable) {
        maxShrinkDex = -2.6;
      } else if (isStellarSystems) {
        maxShrinkDex = -4.6;
      } else if (isPlanetarySystem) {
        maxShrinkDex = -2.6;
      } else if (isPlanet) {
        maxShrinkDex = -3.45;
      } else if (isAtmosphere) {
        maxShrinkDex = suppressWoodlandSurfaceLayers ? -1.25 : -0.75;
      } else if (isLandMasses) {
        maxShrinkDex = -0.95;
      } else if (isEcosystems) {
        maxShrinkDex = -1.05;
      } else if (isForestGlade) {
        maxShrinkDex = -1.0;
      } else if (isLeafGlade) {
        maxShrinkDex = -2.85;
      } else if (isBiologicalCells) {
        maxShrinkDex = -1.65;
      } else if (isDna) {
        maxShrinkDex = -1.75;
      } else if (isAtomicOrbitals) {
        maxShrinkDex = -2.8;
      } else if (isAtomicNucleus) {
        maxShrinkDex = -4.8;
      } else if (isQuarksGluons) {
        maxShrinkDex = -4.8;
      } else if (isSingleElectron) {
        maxShrinkDex = -5.8;
      } else if (isSinglePhoton) {
        maxShrinkDex = -5.8;
      } else if (isPlanckFoam) {
        maxShrinkDex = -5.8;
      }

      if (scaledDelta > maxExpandDex || scaledDelta < maxShrinkDex) {
        if (layer.group.visible) {
          layer.group.visible = false;
        }
        layer.group.matrixWorldAutoUpdate = false;
        continue;
      }

      let alpha = 1.0;
      const polishedAlpha = evaluateInfiniteZoomBandAlpha(
        layerId,
        logScaleMeters,
        gamma,
        suppressWoodlandSurfaceLayers,
        suppressGladeForSurfaceLanding
      );
      if (polishedAlpha >= 0) {
        alpha = polishedAlpha;
      } else if (isGalaxy) {
        if (scaledDelta < 0) {
          alpha = smoothstep01(maxShrinkDex, -0.32, scaledDelta);
        } else {
          alpha = 1.0 - smoothstep01(3.15, maxExpandDex, scaledDelta);
        }
      } else if (scaledDelta < 0) {
        alpha = smoothstep01(maxShrinkDex, -0.32, scaledDelta);
      } else {
        const isQuantumFadeLayer =
          isAtomicNucleus || isQuarksGluons || isSingleElectron || isSinglePhoton;
        const expandFadeStart = isQuantumFadeLayer
          ? 0.22
          : maxExpandDex > 2.2
            ? maxExpandDex * 0.48
            : 0.35;
        alpha = 1.0 - smoothstep01(expandFadeStart, maxExpandDex, scaledDelta);
      }
      alpha *= focusBoost;

      if (alpha <= 0.008) {
        layer.group.visible = false;
        layer.group.matrixWorldAutoUpdate = false;
        continue;
      }

      // Lazy on-demand band population (Frame 1 at Multiverse only builds Multiverse + Big Bang!)
      if (!layer.populated) {
        this.populateScaleLayer(layer);
      }

      // TRUE BASE-10 PHYSICAL SCALE RATIO (exact 10^deltaLog when gamma === 1.0!)
      const visualScale = Math.pow(10, scaledDelta);
      layer.group.visible = true;
      layer.group.matrixWorldAutoUpdate = true;
      layer.group.scale.setScalar(visualScale);

      const densityMod =
        this.pendingProceduralBiome?.cloudDensity !== undefined
          ? this.pendingProceduralBiome.cloudDensity
          : 1.0;

      for (let m = 0; m < layer.materials.length; m++) {
        const entry = layer.materials[m];
        if (isPlanet) {
          // Planet LOD meshes, spheres, and cloud decks have dedicated multi-altitude crossfades below
          if (entry.shaderTimeUniform) {
            entry.shaderTimeUniform.value = this.elapsed;
          }
          if (entry.shaderHubbleUniform) {
            entry.shaderHubbleUniform.value = hubbleMix;
          }
          continue;
        }
        const isCloudMat = this.atmosphereCloudMats.includes(entry.mat as THREE.ShaderMaterial);
        const finalOpacity = Math.min(
          1.0,
          entry.baseOpacity * alpha * (isCloudMat ? densityMod : 1.0)
        );
        if (entry.shaderOpacityUniform) {
          entry.shaderOpacityUniform.value = finalOpacity;
        } else {
          entry.mat.opacity = finalOpacity;
        }
        if (entry.shaderTimeUniform) {
          entry.shaderTimeUniform.value = this.elapsed;
        }
        if (entry.shaderHubbleUniform) {
          entry.shaderHubbleUniform.value = hubbleMix;
        }
        // Preserve crisp 3D depth-sorting down to low fade alpha so opaque dioramas never pop/X-ray mid-fade
        entry.mat.depthWrite = alpha > 0.14 ? entry.defaultDepthWrite : false;
      }

      if (isBiologicalCells && this.cellNucleusMesh && this.cellNucleusMat) {
        // Dissolve the r=2.2 cell nucleus cleanly across -4.85 .. -5.32 BEFORE camera intersects wall at -5.537
        const nucFade = alpha * evaluateCellNucleusOpacity(logScaleMeters);
        this.cellNucleusMesh.visible = nucFade > 0.01;
        this.cellNucleusMat.opacity = nucFade;
        this.cellNucleusMat.depthWrite = nucFade > 0.14;
      }

      if (isMultiverse && this.multiverseHomeBubbleMesh && this.multiverseHomeBubbleMat) {
        // Fade the foreground r=9.8 home-universe shell before camera passes through it (~29.4)
        const homeShellFade = alpha * smoothstep01(29.15, 29.75, logScaleMeters);
        this.multiverseHomeBubbleMesh.visible = homeShellFade > 0.01;
        if (this.multiverseHomeBubbleMat.uniforms?.uOpacity) {
          this.multiverseHomeBubbleMat.uniforms.uOpacity.value = 0.94 * homeShellFade;
        } else {
          this.multiverseHomeBubbleMat.opacity = 0.94 * homeShellFade;
        }
      }

      if (layer.tickFn) {
        layer.tickFn(dt, this.elapsed, gamma, showObjectMarkers);
      }

      // Reroute unified Milky Way galaxy in rotating-arm coordinates onto Earth's Orion-Cygnus Spur (~26,000 ly)
      if (isGalaxy && this.spiralGalaxySpinGroup) {
        const galaxyFocus = computeSpiralGalaxyFocusOffset(logScaleMeters);
        this.lastGalaxyFocusBlend = galaxyFocus.galaxyFocusBlend;
        const phi = this.spiralGalaxySpinGroup.rotation.y;
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);
        const ox = galaxyFocus.armOffsetX * cosP + galaxyFocus.armOffsetZ * sinP;
        const oz = -galaxyFocus.armOffsetX * sinP + galaxyFocus.armOffsetZ * cosP;
        this.spiralGalaxySpinGroup.position.set(ox, galaxyFocus.armOffsetY, oz);

        // Fade giant flat continuum disc gently below Spiral Arms so far-plane clipping never hits
        const discFade = alpha * smoothstep01(17.95, 19.45, logScaleMeters);
        if (this.spiralGalaxyDiscMesh && this.spiralGalaxyDiscMat) {
          this.spiralGalaxyDiscMesh.visible = discFade > 0.01;
          if (this.spiralGalaxyDiscMat.uniforms?.uOpacity) {
            this.spiralGalaxyDiscMat.uniforms.uOpacity.value = 0.95 * discFade;
          }
        }
        if (this.spiralGalaxyBulgeHalo) {
          const bMat = this.spiralGalaxyBulgeHalo.material as THREE.SpriteMaterial;
          const bulgeFade = discFade * smoothstep01(18.6, 20.2, logScaleMeters);
          bMat.opacity = 0.36 * bulgeFade;
          this.spiralGalaxyBulgeHalo.visible = bulgeFade > 0.01;
        }
        const ribbonScale = THREE.MathUtils.lerp(
          0.34,
          1.0,
          smoothstep01(20.85, 19.55, logScaleMeters)
        );
        const ribbonHorizonFade = smoothstep01(17.7, 18.85, logScaleMeters);
        for (let r = 0; r < this.spiralGalaxyArmRibbons.length; r++) {
          const rMesh = this.spiralGalaxyArmRibbons[r];
          const rOp = 0.62 * alpha * ribbonScale * ribbonHorizonFade;
          rMesh.visible = rOp > 0.008;
          const rMat = rMesh.material as THREE.ShaderMaterial;
          if (rMat.uniforms?.uOpacity) {
            rMat.uniforms.uOpacity.value = rOp;
          }
        }
      }

      // Reroute solar system from central Sun to Capy-Earth orbital position
      if (layer.spec.id === 'stellar_systems' && this.solarEclipticGroup && this.capyEarthPlanet) {
        let focusBlend = 0;
        if (logScaleMeters >= 3.2 && logScaleMeters <= 14.5) {
          const orbitR = Math.hypot(
            this.capyEarthPlanet.bodyMesh.position.x,
            this.capyEarthPlanet.bodyMesh.position.z
          );
          const tiltX = this.solarFocusContainer?.rotation.x ?? 0.34;
          const focus = computeSolarPlanetFocusOffset(
            logScaleMeters,
            orbitR,
            this.capyEarthPlanet.pivot.rotation.y,
            tiltX
          );
          focusBlend = focus.focusBlend;
          this.solarEclipticGroup.position.set(
            focus.eclipticOffsetX,
            focus.eclipticOffsetY,
            focus.eclipticOffsetZ
          );
          if (focus.focusBlend > 0.05) {
            _sharedSunDir.set(focus.sunDirX, focus.sunDirY, focus.sunDirZ).normalize();
          }
        } else {
          this.solarEclipticGroup.position.set(0, 0, 0);
        }

        // Suppress unresolved Pale-Blue-Dot glints & giant solar corona billboard once zoomed near planets
        const showPointGlints = focusBlend < 0.25 && logScaleMeters >= 11.2;
        for (let pIdx = 0; pIdx < this.solarPlanets.length; pIdx++) {
          this.solarPlanets[pIdx].glintPoint.visible = showPointGlints;
        }
        const sunGlareFade =
          (1.0 - smoothstep01(1.4, 3.6, scaledDelta)) * (1.0 - focusBlend * 0.9);
        if (this.solarCoronaSprite) {
          const coronaOpacity =
            THREE.MathUtils.clamp(
              0.72 + 0.14 * THREE.MathUtils.clamp(this.fineStructureRatio, 0.55, 2.2),
              0.45,
              0.98
            ) *
            THREE.MathUtils.clamp(sunGlareFade, 0, 1) *
            alpha;
          this.solarCoronaSprite.visible = coronaOpacity > 0.015;
          const cMat = this.solarCoronaSprite.material as THREE.SpriteMaterial;
          cMat.opacity = coronaOpacity;
        }
        if (this.sunStarBeacon) {
          this.sunStarBeacon.visible = sunGlareFade > 0.02;
        }
      }

      // Unified Single Planet multi-LOD update + horizon alignment toward Sanctuary Archipelago (22.5°N, 42.0°E)
      if (layer.spec.id === 'planet' && this.planetGlobeContainer && this.planetSurfaceAlignGroup) {
        const planetFocus = computePlanetSurfaceLandmassFocusOffset(
          logScaleMeters,
          PLANET_BASE_RADIUS
        );
        const blend = planetFocus.surfaceFocusBlend;
        this.planetGlobeContainer.position.set(
          planetFocus.planetOffsetX,
          planetFocus.planetOffsetY,
          planetFocus.planetOffsetZ
        );
        if (this.planetSurfaceAnchorGroup) {
          this.planetSurfaceAnchorGroup.position.set(
            planetFocus.surfaceTargetX * (1 - blend),
            planetFocus.surfaceTargetY * (1 - blend),
            planetFocus.surfaceTargetZ * (1 - blend)
          );
        }
        // Slerp Sanctuary normal smoothly to +Y as we enter the atmosphere so the curved horizon matches camera up
        this.planetSurfaceAlignGroup.quaternion.slerpQuaternions(
          _identityQuat,
          _sanctuaryUpQuat,
          blend
        );

        const detailScale = smoothstep01(6.8, 3.0, logScaleMeters);
        const cloudClear = smoothstep01(4.75, 3.55, logScaleMeters);

        // 1. Full globe sphere (visible from Planetary System 8.85 down to atmosphere/valley handoff)
        const globeFadeLow = this.isSoftwareGl ? 3.65 : 4.70;
        const globeFadeHigh = this.isSoftwareGl ? 4.30 : 5.20;
        const globeOpacity = alpha * smoothstep01(globeFadeLow, globeFadeHigh, logScaleMeters);
        if (this.planetGlobeMesh && this.planetGlobeMat) {
          this.planetGlobeMesh.visible = globeOpacity > 0.01;
          if (this.planetGlobeMat.uniforms?.uOpacity) {
            this.planetGlobeMat.uniforms.uOpacity.value = globeOpacity;
          }
          if (this.planetGlobeMat.uniforms?.uDetailScale) {
            this.planetGlobeMat.uniforms.uDetailScale.value = this.isSoftwareGl ? 0.0 : detailScale;
          }
          this.planetGlobeMat.depthWrite = globeOpacity > 0.18 && logScaleMeters > 1.85;
        }

        // 2. Full globe cloud sphere (hands off cleanly before camera passes cloud-top altitude)
        const cloudFadeLow = this.isSoftwareGl ? 4.10 : 4.75;
        const cloudFadeHigh = this.isSoftwareGl ? 4.75 : 5.25;
        const cloudSphereOpacity =
          Math.min(1.0, 0.86 * densityMod * alpha * smoothstep01(cloudFadeLow, cloudFadeHigh, logScaleMeters));
        if (this.planetCloudMesh && this.planetCloudSphereMat) {
          this.planetCloudMesh.visible = cloudSphereOpacity > 0.01;
          if (this.planetCloudSphereMat.uniforms?.uOpacity) {
            this.planetCloudSphereMat.uniforms.uOpacity.value = cloudSphereOpacity;
          }
          if (this.planetCloudSphereMat.uniforms?.uDetailScale) {
            this.planetCloudSphereMat.uniforms.uDetailScale.value = this.isSoftwareGl ? 0.0 : detailScale;
          }
          if (this.planetCloudSphereMat.uniforms?.uCloudClear) {
            this.planetCloudSphereMat.uniforms.uCloudClear.value = cloudClear;
          }
        }

        // 3. Rayleigh atmospheric scattering limb shell (fades cleanly BEFORE camera crosses limb radius so UFO never washes out)
        const rayleighOpacity = alpha * smoothstep01(4.65, 5.45, logScaleMeters);
        if (this.planetRayleighMesh && this.planetRayleighMat) {
          this.planetRayleighMesh.visible = rayleighOpacity > 0.01;
          if (this.planetRayleighMat.uniforms?.uOpacity) {
            this.planetRayleighMat.uniforms.uOpacity.value = rayleighOpacity;
          }
        }

        // 4. Concentric ring plane (fades gently before sweeping behind camera)
        if (this.planetaryRingMesh) {
          const wantRings = this.pendingProceduralBiome?.ringSystemEnabled ?? false;
          const ringFade = smoothstep01(5.4, 6.4, logScaleMeters);
          this.planetaryRingMesh.visible = wantRings && ringFade > 0.01;
          const rMat = this.planetaryRingMesh.material as THREE.ShaderMaterial;
          if (rMat?.uniforms?.uOpacity) {
            rMat.uniforms.uOpacity.value = alpha * ringFade;
          }
        }

        // 5. Orbital glint at 8.85 Moon-orbit distances so the 0.16-unit Earth reads crisply
        if (this.planetOrbitalGlint) {
          const glintFade = alpha * smoothstep01(7.95, 8.65, logScaleMeters);
          this.planetOrbitalGlint.visible = glintFade > 0.01;
          const gMat = this.planetOrbitalGlint.material as THREE.ShaderMaterial;
          if (gMat?.uniforms?.uOpacity) {
            gMat.uniforms.uOpacity.value = 0.95 * glintFade;
          }
        }

        // 6. Nested Float32-safe curved surface LOD patches (in pure Infinite Zoom, hand off cleanly after lod1 -> Land Masses;
        //    keep full lod1/lod2/lod3 cascade during Capytorio orbital flight when suppressWoodlandSurfaceLayers is true)
        const lod1Op = this.isSoftwareGl
          ? 0
          : suppressWoodlandSurfaceLayers
            ? alpha *
              smoothstep01(5.25, 4.75, logScaleMeters) *
              smoothstep01(3.85, 4.25, logScaleMeters)
            : alpha *
              smoothstep01(5.2, 4.65, logScaleMeters) *
              smoothstep01(3.85, 4.4, logScaleMeters);
        const lod2Op =
          this.isSoftwareGl || !suppressWoodlandSurfaceLayers
            ? 0
            : alpha *
              smoothstep01(4.25, 3.85, logScaleMeters) *
              smoothstep01(3.05, 3.4, logScaleMeters);
        const lod3Op =
          this.isSoftwareGl || !suppressWoodlandSurfaceLayers
            ? 0
            : alpha *
              smoothstep01(3.5, 3.05, logScaleMeters) *
              smoothstep01(2.15, 2.75, logScaleMeters);

        const lodMat0 = this.planetLodMats[0];
        if (this.planetLod1Mesh && lodMat0) {
          this.planetLod1Mesh.visible = lod1Op > 0.01;
          if (lodMat0.uniforms?.uOpacity) lodMat0.uniforms.uOpacity.value = lod1Op;
          if (lodMat0.uniforms?.uDetailScale) lodMat0.uniforms.uDetailScale.value = detailScale;
          lodMat0.depthWrite = lod1Op > 0.18 && logScaleMeters > 2.85;
        }
        const lodMat1 = this.planetLodMats[1];
        if (this.planetLod2Mesh && lodMat1) {
          this.planetLod2Mesh.visible = lod2Op > 0.01;
          if (lodMat1.uniforms?.uOpacity) lodMat1.uniforms.uOpacity.value = lod2Op;
          if (lodMat1.uniforms?.uDetailScale) lodMat1.uniforms.uDetailScale.value = detailScale;
          lodMat1.depthWrite = lod2Op > 0.18 && logScaleMeters > 2.85;
        }
        const lodMat2 = this.planetLodMats[2];
        if (this.planetLod3Mesh && lodMat2) {
          this.planetLod3Mesh.visible = lod3Op > 0.01;
          if (lodMat2.uniforms?.uOpacity) lodMat2.uniforms.uOpacity.value = lod3Op;
          if (lodMat2.uniforms?.uDetailScale) lodMat2.uniforms.uDetailScale.value = detailScale;
          lodMat2.depthWrite = lod3Op > 0.18 && logScaleMeters > 2.85;
        }

        // 7. Curved Troposphere / Stratosphere Cloud Deck Patches (skip in software WebGL; clear cleanly before UFO approach)
        const cloudPatchFade = this.isSoftwareGl
          ? 0
          : Math.min(
              1.0,
              0.78 *
                densityMod *
                alpha *
                smoothstep01(5.05, 4.55, logScaleMeters) *
                smoothstep01(3.65, 4.20, logScaleMeters)
            );
        for (let c = 0; c < this.planetCloudPatchMeshes.length; c++) {
          const cMesh = this.planetCloudPatchMeshes[c];
          const cMat = this.planetCloudPatchMats[c];
          cMesh.visible = cloudPatchFade > 0.01;
          if (cMat?.uniforms?.uOpacity) {
            cMat.uniforms.uOpacity.value = cloudPatchFade * (c === 0 ? 1.0 : 0.68);
          }
          if (cMat?.uniforms?.uDetailScale) {
            cMat.uniforms.uDetailScale.value = detailScale;
          }
          if (cMat?.uniforms?.uCloudClear) {
            cMat.uniforms.uCloudClear.value = cloudClear;
          }
        }
      }
    }

    // 4. Update luminous Chromatin Fiber / Nucleosome transition bridge (-4.85 .. -8.05)
    const chromatinAlpha = evaluateChromatinBridgeAlpha(logScaleMeters, gamma);
    if (chromatinAlpha > 0.008) {
      this.ensureChromatinBridgeBuilt();
      if (this.chromatinBridgeGroup) {
        const bridgeScaledDelta = (CHROMATIN_BRIDGE_LOG_METERS - logScaleMeters) * gamma;
        this.chromatinBridgeGroup.visible = true;
        this.chromatinBridgeGroup.matrixWorldAutoUpdate = true;
        this.chromatinBridgeGroup.scale.setScalar(Math.pow(10, bridgeScaledDelta));
        this.chromatinBridgeGroup.rotation.y += dt * 0.24;
        for (let b = 0; b < this.chromatinBridgeMats.length; b++) {
          const entry = this.chromatinBridgeMats[b];
          entry.mat.opacity = Math.min(1.0, entry.baseOpacity * chromatinAlpha);
          entry.mat.depthWrite = chromatinAlpha > 0.14 ? entry.defaultDepthWrite : false;
        }
      }
    } else if (this.chromatinBridgeGroup && this.chromatinBridgeGroup.visible) {
      this.chromatinBridgeGroup.visible = false;
      this.chromatinBridgeGroup.matrixWorldAutoUpdate = false;
    }

    return primaryLayer.spec;
  }

  /**
   * Zero-Allocation Screen-Space Projection for Unlockable Object Finder Markers.
   * Projects active 3D world anchors into CSS pixel coordinates so players can locate
   * and click sub-pixel 1:1 planets, moons, stellar cores, and atomic nuclei.
   */
  public projectVisibleMarkers(
    camera: THREE.PerspectiveCamera,
    viewportW: number,
    viewportH: number,
    logScaleMeters: number,
    enabled: boolean
  ): ProjectedObjectMarker[] {
    this.activeProjectedMarkers.length = 0;
    if (!enabled || !this.rootGroup.visible || viewportW <= 0 || viewportH <= 0) {
      return this.activeProjectedMarkers;
    }

    this.rootGroup.updateMatrixWorld(true);
    camera.updateMatrixWorld();

    let count = 0;
    for (let i = 0; i < this.markerAnchors.length && count < MAX_PROJECTED_MARKERS; i++) {
      const anchor = this.markerAnchors[i];
      if (logScaleMeters < anchor.minLog || logScaleMeters > anchor.maxLog) {
        continue;
      }

      // Check parent ScaleLayer visibility
      let parentVisible = true;
      let cur: THREE.Object3D | null = anchor.node;
      while (cur) {
        if (!cur.visible) {
          parentVisible = false;
          break;
        }
        cur = cur.parent;
      }
      if (!parentVisible) continue;

      anchor.node.getWorldPosition(_projWorldPos);
      _projNdcPos.copy(_projWorldPos).project(camera);
      // Skip behind-camera or off-screen anchors
      if (
        _projNdcPos.z < -1 ||
        _projNdcPos.z > 1 ||
        _projNdcPos.x < -0.96 ||
        _projNdcPos.x > 0.96 ||
        _projNdcPos.y < -0.92 ||
        _projNdcPos.y > 0.86
      ) {
        continue;
      }

      const sx = (_projNdcPos.x * 0.5 + 0.5) * viewportW;
      const sy = (-_projNdcPos.y * 0.5 + 0.5) * viewportH;

      // Light screen-space de-cluttering (avoid stacking labels within 34px unless highest priority)
      let tooClose = false;
      for (let prev = 0; prev < count; prev++) {
        const pm = this.projectedMarkerPool[prev];
        if (Math.hypot(pm.screenX - sx, pm.screenY - sy) < 34) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const camDist = Math.max(0.1, camera.position.distanceTo(_projWorldPos));
      const approxPx = (anchor.physicalRadiusWorldAtOneToOne / camDist) * viewportH;

      const slot = this.projectedMarkerPool[count];
      slot.id = anchor.id;
      slot.label = anchor.label;
      slot.sublabel = anchor.sublabel;
      slot.screenX = Math.round(sx);
      slot.screenY = Math.round(sy);
      slot.colorCss = anchor.colorCss;
      slot.targetLogMeters = anchor.targetLogMeters;
      slot.isSubPixel = approxPx < 4.0;
      this.activeProjectedMarkers.push(slot);
      count++;
    }

    return this.activeProjectedMarkers;
  }

  public hide() {
    this.rootGroup.visible = false;
    this.rootGroup.matrixWorldAutoUpdate = false;
    this.celestialBackdropGroup.visible = false;
    this.celestialBackdropGroup.matrixWorldAutoUpdate = false;
  }

  public setOrbitTimeScale(scaleId: OrbitTimeScaleId) {
    this.orbitTimeScaleId = scaleId;
  }

  public getOrbitTimeScale(): OrbitTimeScaleId {
    return this.orbitTimeScaleId;
  }

  public getBandById(id: UniverseScaleBandId): UniverseScaleBandSpec {
    return UNIVERSE_SCALE_BANDS.find((b) => b.id === id) || UNIVERSE_SCALE_BANDS[0];
  }

  public applyProceduralConfig(opts: {
    bigBangSpeed?: number;
    fineStructureInverse?: number;
    oceanColorHex?: number;
    landColorHex?: number;
    atmosphereColorHex?: number;
    cloudDensity?: number;
    ringSystemEnabled?: boolean;
    grassPrimaryHex?: number;
    waterColorHex?: number;
  }): void {
    this.pendingProceduralBiome = { ...this.pendingProceduralBiome, ...opts };
    if (typeof opts.bigBangSpeed === 'number') {
      this.bigBangSpeedScale = Math.max(0.2, Math.min(4.0, opts.bigBangSpeed));
    }
    if (typeof opts.fineStructureInverse === 'number' && Number.isFinite(opts.fineStructureInverse)) {
      this.fineStructureInverse = Math.max(60.0, Math.min(220.0, opts.fineStructureInverse));
      this.fineStructureRatio = 137.036 / this.fineStructureInverse;
      if (this.solarSunMat?.uniforms?.uAlphaRatio) {
        this.solarSunMat.uniforms.uAlphaRatio.value = this.fineStructureRatio;
      }
    }
    if (this.capyEarthRingMesh && typeof opts.ringSystemEnabled === 'boolean') {
      this.capyEarthRingMesh.visible = opts.ringSystemEnabled;
    }
    if (this.planetaryRingMesh && typeof opts.ringSystemEnabled === 'boolean') {
      this.planetaryRingMesh.visible = opts.ringSystemEnabled;
    }
    if (this.atmosphereRayleighMat && typeof opts.atmosphereColorHex === 'number') {
      const uColor = this.atmosphereRayleighMat.uniforms?.uRayleighColor;
      if (uColor && uColor.value instanceof THREE.Color) {
        uColor.value.setHex(opts.atmosphereColorHex);
      }
    }
    for (const pMat of [this.capyEarthBodyMat, this.planetGlobeMat, ...this.planetLodMats]) {
      if (!pMat?.uniforms) continue;
      if (typeof opts.oceanColorHex === 'number' && pMat.uniforms.uOceanColor?.value instanceof THREE.Color) {
        pMat.uniforms.uOceanColor.value.setHex(opts.oceanColorHex);
      }
      if (typeof opts.landColorHex === 'number' && pMat.uniforms.uLandColor?.value instanceof THREE.Color) {
        pMat.uniforms.uLandColor.value.setHex(opts.landColorHex);
      }
    }
    if (this.ecosystemMeadowMat && typeof opts.grassPrimaryHex === 'number') {
      this.ecosystemMeadowMat.color.setHex(opts.grassPrimaryHex);
    }
    if (this.ecosystemRiverMat && typeof opts.waterColorHex === 'number') {
      this.ecosystemRiverMat.color.setHex(opts.waterColorHex);
    }
  }

  public dispose() {
    this.markerAnchors.length = 0;
    this.activeProjectedMarkers.length = 0;
    this.woodlandCapys.length = 0;
    this.solarPlanets.length = 0;
    this.planetLodMats.length = 0;
    this.planetCloudPatchMeshes.length = 0;
    this.planetCloudPatchMats.length = 0;
    this.celestialBackdropMats.length = 0;
    this.chromatinBridgeMats.length = 0;
    this.chromatinBridgeGroup = null;
    this.cellNucleusMesh = null;
    this.cellNucleusMat = null;
    this.layers.length = 0;
    disposeObject3DTree(this.forestGroveGroup);
    disposeObject3DTree(this.celestialBackdropGroup);
    disposeObject3DTree(this.rootGroup);
    if (this.glowWarmTex) {
      this.glowWarmTex.userData.sharedAsset = false;
      this.glowWarmTex.dispose();
      this.glowWarmTex = null;
    }
    if (this.glowCoolTex) {
      this.glowCoolTex.userData.sharedAsset = false;
      this.glowCoolTex.dispose();
      this.glowCoolTex = null;
    }
    this.layersBuilt = false;
    this.groveBuilt = false;
  }
}
