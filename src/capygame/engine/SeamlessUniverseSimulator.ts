import * as THREE from 'three';
import {
  AstrophysicsPaletteMode,
  CapyLodTier,
  ProjectedObjectMarker,
  QuantumFocusMode,
  UNIVERSE_SCALE_BANDS,
  UniverseScaleBandId,
  UniverseScaleBandSpec,
} from '../types';
import { CapyMeshGroup, CapyModelGenerator } from './CapyModelGenerator';
import {
  blackbodyKelvinToRgb,
  createAtmosphereScatteringMaterial,
  createCmbAnisotropyMaterial,
  createCosmicFilamentRibbonMaterial,
  createDeepFieldGalaxyMaterial,
  createDustPillarMaterial,
  createGasGiantMaterial,
  createHabitablePlanetMaterial,
  createPlanetCloudMaterial,
  createPlanetaryRingMaterial,
  createRockyBodyMaterial,
  createSolarPhotosphereMaterial,
  createSpiralGalaxyDiscMaterial,
  createStarPsfMaterial,
  createVolumetricNebulaMaterial,
} from './UniverseShaders';

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
  orbitLine: THREE.LineLoop;
  baseOrbitPoints: Float32Array;
  targetLogMeters: number;
  colorCss: string;
}

interface JovianMoonEntry {
  name: string;
  orbitPlanetRadii: number;
  moonToPlanetRadiusRatio: number;
  angularSpeed: number;
  pivot: THREE.Group;
  moonMesh: THREE.Mesh;
  glintPoint: THREE.Points;
  orbitLine: THREE.LineLoop;
}

const MAX_PROJECTED_MARKERS = 12;

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

function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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
  private solarSunMesh: THREE.Mesh | null = null;
  private solarCoronaSprite: THREE.Sprite | null = null;
  private solarBeltPoints: THREE.Points | null = null;
  private solarBeltBaseAu: Float32Array | null = null;

  private jovianMoons: JovianMoonEntry[] = [];
  private habitableMoonPivot: THREE.Group | null = null;
  private habitableMoonMesh: THREE.Mesh | null = null;
  private habitableMoonOrbitLine: THREE.LineLoop | null = null;

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

  constructor(isSoftwareGl: boolean = false) {
    this.isSoftwareGl = isSoftwareGl;
    this.rootGroup.name = 'SeamlessUniverseSimulatorRoot';
    this.rootGroup.visible = false;
    this.rootGroup.userData.ignoreCameraFade = true;

    this.celestialBackdropGroup.name = 'DeepSkyCelestialBackdrop';
    this.celestialBackdropGroup.visible = false;
    this.celestialBackdropGroup.userData.ignoreCameraFade = true;

    this.forestGroveGroup.name = 'WoodlandCapybaraForestGrove';
    this.forestGroveGroup.visible = !isSoftwareGl;
    this.forestGroveGroup.userData.ignoreCameraFade = true;

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

    if (!isSoftwareGl) {
      this.ensureWoodlandGroveBuilt();
    }
  }

  public ensureWoodlandGroveBuilt() {
    if (this.groveBuilt) return;
    this.groveBuilt = true;
    this.buildWoodlandCapybaraGrove();
  }

  public ensureLayersBuilt() {
    this.ensureWoodlandGroveBuilt();
    if (this.layersBuilt) return;
    this.layersBuilt = true;
    this.buildCelestialStarBackdrop();
    this.buildAllScaleLayers();
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
  ): { line: THREE.LineLoop; unitCoords: Float32Array } {
    const unitCoords = new Float32Array(segments * 3);
    const positions = new Float32Array(segments * 3);
    const bRatio = Math.sqrt(Math.max(0.1, 1 - eccentricity * eccentricity));
    for (let i = 0; i < segments; i++) {
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
    const line = new THREE.LineLoop(
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
      baseSize: 34.0,
      minPixelSize: 1.5,
      maxPixelSize: 14.0,
      diffractionStrength: 0.48,
      opacity: 0.92,
    });
    const stars = new THREE.Points(geo, psfMat);
    stars.frustumCulled = false;
    this.celestialBackdropGroup.add(stars);
    this.celestialBackdropMats = this.collectLayerMaterials(this.celestialBackdropGroup);
  }

  // ============================================================================
  // BUILD ALL 25 REAL-SCALE HUBBLE / SPACEENGINE 3D LAYERS
  // ============================================================================

  private buildAllScaleLayers() {
    const glowWarm = this.createSoftRadialTexture(
      'rgba(255,252,235,1)',
      'rgba(251,191,36,0.42)'
    );
    const glowCool = this.createSoftRadialTexture(
      'rgba(235,248,255,1)',
      'rgba(56,189,248,0.38)'
    );

    for (let i = 0; i < UNIVERSE_SCALE_BANDS.length; i++) {
      const spec = UNIVERSE_SCALE_BANDS[i];
      const group = new THREE.Group();
      group.name = `ScaleLayer_${spec.id}`;
      group.visible = false;
      group.userData.ignoreCameraFade = true;

      let tickFn:
        | ((dt: number, elapsed: number, gamma: number, showMarkers: boolean) => void)
        | undefined;

      switch (spec.id) {
        case 'big_bang':
          tickFn = this.populateBigBangLayer(group, glowWarm);
          break;
        case 'entire_cosmos':
          tickFn = this.populateEntireCosmosLayer(group);
          break;
        case 'supercluster_a':
          tickFn = this.populateSuperclusterALayer(group, glowWarm);
          break;
        case 'galaxy_filaments':
          tickFn = this.populateGalaxyFilamentsLayer(group);
          break;
        case 'galaxies':
          tickFn = this.populateSpiralGalaxyLayer(group, glowWarm);
          break;
        case 'nebulas':
          tickFn = this.populateNebulaLayer(group);
          break;
        case 'stellar_nurseries':
          tickFn = this.populateStellarNurseryLayer(group, glowCool);
          break;
        case 'solar_systems':
          tickFn = this.populateSolarSystemLayer(group, glowWarm);
          break;
        case 'asteroid_clouds':
          tickFn = this.populateAsteroidCloudLayer(group);
          break;
        case 'gas_giants':
          tickFn = this.populateGasGiantLayer(group);
          break;
        case 'rocky_planets_moons':
          tickFn = this.populateRockyPlanetsMoonsLayer(group);
          break;
        case 'habitable_planets':
          tickFn = this.populateHabitablePlanetLayer(group);
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
          tickFn = this.populateLeafAndFurMicroLayer(group);
          break;
        case 'biological_cells':
          tickFn = this.populateBiologicalCellsLayer(group);
          break;
        case 'dna_molecules':
          tickFn = this.populateDnaHelixLayer(group);
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

      const materials = this.collectLayerMaterials(group);
      this.rootGroup.add(group);
      this.layers.push({
        index: i,
        spec,
        group,
        materials,
        tickFn,
      });
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

  // --- 1. BIG BANG & PRIMORDIAL INFLATION PLASMA (+28.0) ---
  private populateBigBangLayer(
    group: THREE.Group,
    glowTex: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    // Replace wireframe icosahedron cages with volumetric quark-gluon plasma & inflationary PSF burst
    for (let s = 0; s < 3; s++) {
      const plasmaPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(36, 36),
        createVolumetricNebulaMaterial({
          seedOffset: 11.4 + s * 4.7,
          hubblePaletteMix: 0.75,
          opacity: 0.62,
          isInnerCore: s === 0,
        })
      );
      plasmaPlane.rotation.set(s * 1.05, s * 0.92, s * 0.55);
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

    return (dt, elapsed) => {
      group.rotation.y += dt * 0.06;
      const pulse = 17.2 + Math.sin(elapsed * 1.8) * 1.1;
      coreHalo.scale.setScalar(pulse);
    };
  }

  // --- 2. ENTIRE OBSERVABLE COSMOS · 93.0 GLY CMB SPHERE (+26.94) ---
  private populateEntireCosmosLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const cmbShell = new THREE.Mesh(
      new THREE.SphereGeometry(21.5, this.isSoftwareGl ? 32 : 56, this.isSoftwareGl ? 24 : 40),
      createCmbAnisotropyMaterial(0.84)
    );
    group.add(cmbShell);

    // Interior Hubble Ultra Deep Field of 2,400 superclusters inside the 93 Gly particle horizon
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
      // Cosmological redshift gradient (z = 0 blue/gold interior -> z > 8 redshifted outer shell)
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

    const laniakeaAnchor = new THREE.Object3D();
    group.add(laniakeaAnchor);
    this.registerMarkerAnchor({
      id: 'marker_laniakea',
      label: 'Laniakea Supercluster',
      sublabel: '520 Mly · Local Basin',
      node: laniakeaAnchor,
      layerBandId: 'entire_cosmos',
      minLog: 25.4,
      maxLog: 27.8,
      targetLogMeters: 24.69,
      colorCss: '#fbbf24',
      physicalRadiusWorldAtOneToOne: 0.12,
    });

    return (dt) => {
      group.rotation.y += dt * 0.035;
    };
  }

  // --- 3. SUPERCLUSTER A · LANIAKEA GRAVITATIONAL WATERSHED (+24.69 · 520 Mly) ---
  private populateSuperclusterALayer(
    group: THREE.Group,
    glowTex: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    // 100,000-galaxy Laniakea peculiar-velocity flow streams converging toward the Great Attractor
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

        // Golden-ivory dense cluster core -> sapphire-amber filament outskirts
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

    const virgoNode = new THREE.Object3D();
    virgoNode.position.set(4.2, 0.8, 2.6);
    group.add(virgoNode);
    this.registerMarkerAnchor({
      id: 'marker_virgo_strand',
      label: 'Virgo Filament',
      sublabel: '30 Mly · Local Web',
      node: virgoNode,
      layerBandId: 'supercluster_a',
      minLog: 23.8,
      maxLog: 25.5,
      targetLogMeters: 23.45,
      colorCss: '#818cf8',
      physicalRadiusWorldAtOneToOne: 0.8,
    });

    return (dt) => {
      group.rotation.y += dt * 0.04;
    };
  }

  // --- 4. GALAXY FILAMENTS & ILLUSTRIS-TNG COSMIC WEB (+23.45 · 30 Mly) ---
  private populateGalaxyFilamentsLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    // Organic 3D Voronoi / curl-warped gravitational dark-matter & WHIM filaments (ZERO cylinder cages!)
    const clusterNodes: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
    const nodeCount = 18;
    for (let i = 1; i < nodeCount; i++) {
      const theta = Math.acos(2 * seededRand(i * 13 + 1) - 1);
      const phi = seededRand(i * 13 + 2) * Math.PI * 2;
      const r = 7.0 + seededRand(i * 13 + 3) * 14.5;
      clusterNodes.push(
        new THREE.Vector3(
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.cos(theta) * 0.68,
          r * Math.sin(theta) * Math.sin(phi)
        )
      );
    }

    const filamentCurves: THREE.QuadraticBezierCurve3[] = [];
    const ribbonMat = createCosmicFilamentRibbonMaterial(0.46);

    for (let i = 0; i < clusterNodes.length; i++) {
      for (let j = i + 1; j < clusterNodes.length; j++) {
        const a = clusterNodes[i];
        const b = clusterNodes[j];
        const d = a.distanceTo(b);
        if (d < 13.2 || (i === 0 && d < 16.0)) {
          // Organic gravitational saddle bow midpoint (never straight wireframe sticks!)
          const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
          const seed = i * 31 + j * 17;
          mid.x += (seededRand(seed + 1) - 0.5) * d * 0.34;
          mid.y += (seededRand(seed + 2) - 0.5) * d * 0.34;
          mid.z += (seededRand(seed + 3) - 0.5) * d * 0.34;
          const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
          filamentCurves.push(curve);

          // Crossed soft-Gaussian WHIM gas ribbons along curve (zero hard edges!)
          const steps = this.isSoftwareGl ? 10 : 18;
          for (let planeIdx = 0; planeIdx < 2; planeIdx++) {
            const stripGeo = new THREE.PlaneGeometry(1, 1, 1, steps);
            const posAttr = stripGeo.attributes.position;
            const halfW = i === 0 ? 0.85 : 0.58;
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

    // 4,500 PSF Galaxies & Cluster Halos concentrated organically along curved cosmic web filaments
    const galCount = this.isSoftwareGl ? 1400 : 4500;
    const gPos = new Float32Array(galCount * 3);
    const gCol = new Float32Array(galCount * 3);
    const gScale = new Float32Array(galCount);
    const gSeed = new Float32Array(galCount);

    for (let g = 0; g < galCount; g++) {
      const curve = filamentCurves[g % Math.max(1, filamentCurves.length)];
      // Bias galaxies toward dense cluster intersections (t near 0 or 1)
      const u = seededRand(g * 5 + 1);
      const t = u < 0.5 ? 0.5 * Math.pow(u * 2, 1.5) : 1 - 0.5 * Math.pow((1 - u) * 2, 1.5);
      curve.getPoint(t, _scratchVecA);

      // Gaussian transverse filament thickness
      const sigma = 0.28 + 0.95 * Math.sin(t * Math.PI);
      const rx = (seededRand(g * 5 + 2) + seededRand(g * 5 + 3) - 1.0) * sigma * 1.8;
      const ry = (seededRand(g * 5 + 4) + seededRand(g * 7 + 1) - 1.0) * sigma * 1.8;
      const rz = (seededRand(g * 7 + 2) + seededRand(g * 7 + 3) - 1.0) * sigma * 1.8;

      gPos[g * 3] = _scratchVecA.x + rx;
      gPos[g * 3 + 1] = _scratchVecA.y + ry;
      gPos[g * 3 + 2] = _scratchVecA.z + rz;

      // Ellipticals in cluster knots are golden-amber (4,200K); field spirals along filaments are sapphire-white (8,500K)
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

    const localGalaxyAnchor = new THREE.Object3D();
    group.add(localGalaxyAnchor);
    this.registerMarkerAnchor({
      id: 'marker_milky_way_spiral',
      label: 'Spiral Galaxy',
      sublabel: '105,700 ly · Local Group',
      node: localGalaxyAnchor,
      layerBandId: 'galaxy_filaments',
      minLog: 21.6,
      maxLog: 24.1,
      targetLogMeters: 21.0,
      colorCss: '#60a5fa',
      physicalRadiusWorldAtOneToOne: 0.08,
    });

    return (dt) => {
      group.rotation.y -= dt * 0.035;
    };
  }

  // --- 5. GRAND-DESIGN SPIRAL GALAXIES (+21.0 · 105,700 ly) ---
  private populateSpiralGalaxyLayer(
    group: THREE.Group,
    glowTex: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const galaxyTilt = new THREE.Group();
    galaxyTilt.rotation.x = 0.58;
    galaxyTilt.rotation.z = -0.22;
    group.add(galaxyTilt);

    // 1. Volumetric Stellar Continuum + Dark Absorbing Spiral Dust Lanes Shader Plane
    const discMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      createSpiralGalaxyDiscMaterial({ arms: 2, opacity: 0.95 })
    );
    discMesh.rotation.x = -Math.PI / 2;
    galaxyTilt.add(discMesh);

    // 2. 4,200 PSF OB Star Associations, H-II Star-Forming Knots & 3D Globular Cluster Halo
    const starCount = this.isSoftwareGl ? 1400 : 4400;
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const sc = new Float32Array(starCount);
    const lum = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const isHaloCluster = i % 16 === 0;
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
      } else {
        const u = Math.max(0.02, Math.pow(seededRand(i * 7 + 1), 0.78));
        const r = u * 19.5;
        const armIdx = i % 2;
        const logAngle = (armIdx * Math.PI) + 2.4 * Math.log(Math.max(0.035, u));
        const scatter = (0.22 + u * 0.55) * (seededRand(i * 7 + 2) + seededRand(i * 7 + 3) - 1.0);
        const ang = logAngle + scatter;
        const zThick = (seededRand(i * 7 + 4) - 0.5) * (1.5 / (1 + r * 0.25));

        pos[i * 3] = Math.cos(ang) * r;
        pos[i * 3 + 1] = zThick;
        pos[i * 3 + 2] = Math.sin(ang) * r;

        if (r < 3.4) {
          blackbodyKelvinToRgb(4400 + seededRand(i * 3 + 1) * 1200, _scratchColorA);
          sc[i] = 0.8 + seededRand(i * 3 + 2) * 1.1;
          lum[i] = 0.85;
        } else if (i % 9 === 0) {
          // H-alpha 656nm Crimson-Rose H-II Emission Nebula Knot!
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
    galaxyTilt.add(
      new THREE.Points(
        starGeo,
        createStarPsfMaterial({ baseSize: 11.5, diffractionStrength: 0.38, opacity: 0.95 })
      )
    );

    // 3D Warm Old-Star Sersic Bulge Halo
    const bulgeHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffedd5,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    bulgeHalo.scale.set(11.0, 7.2, 1.0);
    galaxyTilt.add(bulgeHalo);

    // Orion-Arm Nebula Marker inside Spiral Galaxy!
    const armNebulaAnchor = new THREE.Object3D();
    armNebulaAnchor.position.set(0, 0, 0);
    galaxyTilt.add(armNebulaAnchor);
    this.registerMarkerAnchor({
      id: 'marker_h2_nebula',
      label: 'Orion-Spur H-II Nebula',
      sublabel: '30 ly · Star-Forming Cloud',
      node: armNebulaAnchor,
      layerBandId: 'galaxies',
      minLog: 18.2,
      maxLog: 21.6,
      targetLogMeters: 17.45,
      colorCss: '#f43f5e',
      physicalRadiusWorldAtOneToOne: 0.006,
    });

    return (dt) => {
      galaxyTilt.rotation.y += dt * 0.08;
    };
  }

  // --- 6. EMISSION & REFLECTION NEBULAS (+17.45 · 30 ly · HUBBLE ORION / CARINA) ---
  private populateNebulaLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    // Multi-angle crossed volumetric FBM emission + Bok-globule extinction shader planes
    // NormalBlending + ACES Filmic HDR Tone Mapping => ZERO #FFFFFF whiteout & ZERO polygon edges!
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
          hubblePaletteMix: 0.25,
          opacity: inner ? 0.68 : 0.76,
          isInnerCore: inner,
        })
      );
      plane.rotation.set(rx, ry, rz);
      plane.renderOrder = i;
      group.add(plane);
    }

    // Embedded Trapezium OB Young Open Star Cluster with crisp HST diffraction spikes!
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

    const pillarsCoreAnchor = new THREE.Object3D();
    group.add(pillarsCoreAnchor);
    this.registerMarkerAnchor({
      id: 'marker_pillars_nursery',
      label: 'Molecular Dust Pillars',
      sublabel: '4.5 ly · Stellar Nursery',
      node: pillarsCoreAnchor,
      layerBandId: 'nebulas',
      minLog: 16.9,
      maxLog: 18.4,
      targetLogMeters: 16.63,
      colorCss: '#f59e0b',
      physicalRadiusWorldAtOneToOne: 3.2,
    });

    return (dt) => {
      group.rotation.y += dt * 0.025;
    };
  }

  // --- 7. STELLAR NURSERIES & HUBBLE M16 PILLARS OF CREATION (+16.63 · 4.5 ly) ---
  private populateStellarNurseryLayer(
    group: THREE.Group,
    glowCool: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    // Ambient [O III] cyan-sapphire ionized nursery cavity glow behind the dark absorptive pillars
    const cavityBg = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 44),
      createVolumetricNebulaMaterial({
        seedOffset: 19.3,
        hubblePaletteMix: 0.65,
        opacity: 0.62,
        isInnerCore: true,
      })
    );
    cavityBg.position.z = -5.5;
    cavityBg.renderOrder = 0;
    group.add(cavityBg);

    // 3 Towering M16-style Absorptive Molecular H2 Dust Pillars (crossed volumetric billboards -> 3D parallax, ZERO clay cylinder cones!)
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

      const matA = createDustPillarMaterial({ seed: cfg.seed, hubblePaletteMix: 0.5, opacity: 0.96 });
      const quadA = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.h), matA);
      quadA.renderOrder = 2 + i * 2;
      pillarHolder.add(quadA);

      if (!this.isSoftwareGl) {
        const matB = createDustPillarMaterial({
          seed: cfg.seed + 0.85,
          hubblePaletteMix: 0.5,
          opacity: 0.72,
        });
        const quadB = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w * 0.92, cfg.h), matB);
        quadB.rotation.y = Math.PI * 0.38;
        quadB.renderOrder = 3 + i * 2;
        pillarHolder.add(quadB);
      }
      group.add(pillarHolder);
    }

    // Delicate Collimated Herbig-Haro Bipolar Protostellar Shock Jet at (0,0,0) leading down to Solar System!
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

    const solAnchor = new THREE.Object3D();
    group.add(solAnchor);
    this.registerMarkerAnchor({
      id: 'marker_nascent_solar_system',
      label: 'G2V Solar System',
      sublabel: '60.2 AU · 1/4,786 of Pillar',
      node: solAnchor,
      layerBandId: 'stellar_nurseries',
      minLog: 13.5,
      maxLog: 17.1,
      targetLogMeters: 12.95,
      colorCss: '#facc15',
      physicalRadiusWorldAtOneToOne: 0.0046,
    });

    // Foreground & background young nursery stars with HST diffraction spikes
    const starCount = this.isSoftwareGl ? 140 : 380;
    const sPos = new Float32Array(starCount * 3);
    const sCol = new Float32Array(starCount * 3);
    const sSc = new Float32Array(starCount);
    const sLum = new Float32Array(starCount);
    for (let s = 0; s < starCount; s++) {
      sPos[s * 3] = (seededRand(s * 5 + 1) - 0.5) * 42;
      sPos[s * 3 + 1] = (seededRand(s * 5 + 2) - 0.35) * 38;
      sPos[s * 3 + 2] = (seededRand(s * 5 + 3) - 0.5) * 28;
      blackbodyKelvinToRgb(3400 + Math.pow(seededRand(s * 5 + 4), 2.0) * 22000, _scratchColorA);
      sCol[s * 3] = _scratchColorA.r;
      sCol[s * 3 + 1] = _scratchColorA.g;
      sCol[s * 3 + 2] = _scratchColorA.b;
      const bright = Math.pow(seededRand(s * 5 + 5), 3.0);
      sSc[s] = 0.65 + bright * 2.4;
      sLum[s] = 0.35 + bright * 0.65;
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    sGeo.setAttribute('aScale', new THREE.BufferAttribute(sSc, 1));
    sGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(sLum, 1));
    const nurseryStars = new THREE.Points(
      sGeo,
      createStarPsfMaterial({ baseSize: 15.0, diffractionStrength: 0.78, opacity: 0.96 })
    );
    nurseryStars.renderOrder = 12;
    group.add(nurseryStars);

    return (dt) => {
      group.rotation.y += dt * 0.022;
    };
  }

  // --- 8. SOLAR SYSTEMS & TRUE 1:1 AU PLANETARY ORBITS (+12.95 · 60.2 AU) ---
  private populateSolarSystemLayer(
    group: THREE.Group,
    glowWarm: THREE.CanvasTexture
  ): (dt: number, elapsed: number, gamma: number, showMarkers: boolean) => void {
    const ecliptic = new THREE.Group();
    ecliptic.rotation.x = 0.34;
    group.add(ecliptic);

    // Canonical scale: 22.0 world units === 30.07 AU (Neptune semi-major axis)
    // True 1:1 Sun radius = 0.00465047 AU => 22.0 * (0.00465047 / 30.07) = 0.003402 world units!
    const sunGeo = new THREE.SphereGeometry(1.0, this.isSoftwareGl ? 24 : 40, 24);
    const sunMat = createSolarPhotosphereMaterial();
    this.solarSunMesh = new THREE.Mesh(sunGeo, sunMat);
    ecliptic.add(this.solarSunMesh);

    // Flux-conserving G2V solar PSF diffraction beacon + HDR solar corona
    const sunStarBeacon = this.createSinglePointGlint(0xfff7ed, 22.0, 0.85);
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
      label: 'G2V Central Star',
      sublabel: '1.39M km · 0.0093 AU',
      node: sunAnchor,
      layerBandId: 'solar_systems',
      minLog: 10.2,
      maxLog: 14.8,
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
        name: 'Capy-Earth (Habitable)',
        sub: '1.00 AU · 12,742 km',
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
      if (def.ringed) {
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

      this.solarPlanets.push({
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
      });

      this.registerMarkerAnchor({
        id: `marker_planet_${def.id}`,
        label: def.name,
        sublabel: def.sub,
        node: bodyMesh,
        layerBandId: 'solar_systems',
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

    this.applySolarSystemRescaler(1.0);

    return (dt, _elapsed, gamma, showMarkers) => {
      if (Math.abs(gamma - this.lastGammaApplied) > 0.002) {
        this.applySolarSystemRescaler(gamma);
      }
      for (let i = 0; i < this.solarPlanets.length; i++) {
        const p = this.solarPlanets[i];
        p.pivot.rotation.y += p.angularSpeed * 0.14 * dt;
        p.orbitLine.visible = showMarkers || gamma < 0.92;
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

    void sunWorldR;
  }

  // --- 9. ASTEROID CLOUDS & MAIN BELT PLANETESIMALS (+11.65 · 3.0 AU) ---
  private populateAsteroidCloudLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const rockMat = createRockyBodyMaterial({
      sunDir: _sharedSunDir,
      baseColorHex: 0x6b645e,
      highlandColorHex: 0xa8a29e,
    });

    // Craggy high-subdivision rubble-pile asteroid (Itokawa / Bennu / Ryugu morphology)
    const heroGeo = new THREE.SphereGeometry(2.4, this.isSoftwareGl ? 20 : 36, 24);
    const hPos = heroGeo.attributes.position;
    for (let v = 0; v < hPos.count; v++) {
      const x = hPos.getX(v);
      const y = hPos.getY(v);
      const z = hPos.getZ(v);
      // Bi-lobed contact-binary waist + multi-octave impact facets
      const lobe = 1.0 + 0.28 * Math.cos(x * 0.85) - 0.18 * Math.exp(-x * x * 0.6);
      const crag =
        1.0 +
        0.14 * Math.sin(x * 1.9 + y * 2.3) * Math.cos(z * 2.1) +
        0.06 * Math.cos(x * 4.7 - z * 4.3);
      hPos.setXYZ(v, x * 1.32 * lobe * crag, y * 0.78 * crag, z * 0.88 * crag);
    }
    heroGeo.computeVertexNormals();
    const heroAsteroid = new THREE.Mesh(heroGeo, rockMat);
    group.add(heroAsteroid);

    // Swarm of distant sunlit silicate planetesimals (sparse, realistic low spatial density)
    const count = this.isSoftwareGl ? 95 : 260;
    const subGeo = new THREE.IcosahedronGeometry(0.26, 2);
    const inst = new THREE.InstancedMesh(subGeo, rockMat, count);
    for (let i = 0; i < count; i++) {
      const ang = seededRand(i * 7 + 1) * Math.PI * 2;
      const rad = 5.5 + seededRand(i * 7 + 2) * 22.0;
      const y = (seededRand(i * 7 + 3) - 0.5) * 6.5;
      _dummyObj.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
      _dummyObj.rotation.set(
        seededRand(i * 7 + 4) * Math.PI,
        seededRand(i * 7 + 5) * Math.PI,
        seededRand(i * 7 + 6) * Math.PI
      );
      const s = 0.22 + Math.pow(seededRand(i * 11 + 1), 2.5) * 1.35;
      _dummyObj.scale.set(s * 1.3, s * 0.82, s * 0.95);
      _dummyObj.updateMatrix();
      inst.setMatrixAt(i, _dummyObj.matrix);
    }
    group.add(inst);

    return (dt) => {
      heroAsteroid.rotation.y += dt * 0.16;
      heroAsteroid.rotation.z += dt * 0.05;
      inst.rotation.y += dt * 0.03;
    };
  }

  // --- 10. GAS GIANTS & RINGED JOVIANS (+8.93 · 850,000 km SYSTEM SPAN) ---
  private populateGasGiantLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number, gamma: number, showMarkers: boolean) => void {
    const systemTilt = new THREE.Group();
    systemTilt.rotation.z = 0.26;
    systemTilt.rotation.x = 0.20;
    group.add(systemTilt);

    // Canonical scale: 22.0 units === 425,000 km radius (850,000 km diameter, Io's 421,700 km orbit!)
    // True 1:1 Jupiter equatorial radius = 71,492 km => 22.0 * (71,492 / 425,000) = 3.70 units!
    const planetRadius = 3.70;
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(
        planetRadius,
        this.isSoftwareGl ? 32 : 56,
        this.isSoftwareGl ? 24 : 42
      ),
      createGasGiantMaterial(_sharedSunDir)
    );
    // Authentic 6.5% rapid-rotation polar oblateness!
    body.scale.set(1.0, 0.935, 1.0);
    systemTilt.add(body);

    // Subtle Rayleigh/H2 upper-troposphere limb haze shell
    const hazeShell = new THREE.Mesh(
      new THREE.SphereGeometry(planetRadius * 1.032, 36, 28),
      createAtmosphereScatteringMaterial({
        sunDir: _sharedSunDir,
        rayleighColor: new THREE.Color(0.58, 0.72, 0.96),
        intensity: 0.75,
      })
    );
    hazeShell.scale.set(1.0, 0.935, 1.0);
    systemTilt.add(hazeShell);

    // High-resolution Cassini/Encke optical-depth ring disc receiving real planet shadow!
    const ringInner = planetRadius * 1.28;
    const ringOuter = planetRadius * 2.32;
    const rings = new THREE.Mesh(
      new THREE.RingGeometry(ringInner, ringOuter, this.isSoftwareGl ? 64 : 128),
      createPlanetaryRingMaterial({
        innerRadius: ringInner,
        outerRadius: ringOuter,
        planetRadius,
        sunDir: _sharedSunDir,
      })
    );
    rings.rotation.x = Math.PI / 2;
    systemTilt.add(rings);

    // 4 Galilean Moons at TRUE real-life orbital radii (in Jupiter radii R_J) & TRUE moon-to-Jupiter radius ratios!
    // Io: 5.90 R_J (r = 0.0255 R_J), Europa: 9.39 R_J (r = 0.0218 R_J), Ganymede: 14.97 R_J (r = 0.0368 R_J), Callisto: 26.33 R_J (r = 0.0337 R_J)
    const moonDefs = [
      { id: 'io', name: 'Io (Volcanic)', rRj: 5.90, sizeRatio: 0.0255, hex: 0xfacc15, css: '#fde047', speed: 0.85 },
      { id: 'europa', name: 'Europa (Ice Ocean)', rRj: 9.39, sizeRatio: 0.0218, hex: 0xe0f2fe, css: '#7dd3fc', speed: 0.42 },
      { id: 'ganymede', name: 'Ganymede', rRj: 14.97, sizeRatio: 0.0368, hex: 0xd6d3d1, css: '#cbd5e1', speed: 0.21 },
      { id: 'callisto', name: 'Callisto', rRj: 26.33, sizeRatio: 0.0337, hex: 0x94a3b8, css: '#94a3b8', speed: 0.09 },
    ];

    this.jovianMoons = [];
    for (let m = 0; m < moonDefs.length; m++) {
      const md = moonDefs[m];
      const orbitWorld = planetRadius * md.rRj;
      const { line } = this.createOrbitHairline(orbitWorld, 0.004, 0x64748b, 80);
      systemTilt.add(line);

      const pivot = new THREE.Group();
      pivot.rotation.y = m * 1.45 + 0.6;
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 18, 16),
        createRockyBodyMaterial({
          sunDir: _sharedSunDir,
          baseColorHex: md.hex,
          highlandColorHex: 0xf8fafc,
        })
      );
      const glint = this.createSinglePointGlint(md.hex, 7.5, 0.22);
      moonMesh.add(glint);
      pivot.add(moonMesh);
      systemTilt.add(pivot);

      this.jovianMoons.push({
        name: md.name,
        orbitPlanetRadii: md.rRj,
        moonToPlanetRadiusRatio: md.sizeRatio,
        angularSpeed: md.speed,
        pivot,
        moonMesh,
        glintPoint: glint,
        orbitLine: line,
      });

      this.registerMarkerAnchor({
        id: `marker_jovian_${md.id}`,
        label: md.name,
        sublabel: `${md.rRj.toFixed(1)} R_J`,
        node: moonMesh,
        layerBandId: 'gas_giants',
        minLog: 8.1,
        maxLog: 9.9,
        targetLogMeters: 7.85,
        colorCss: md.css,
        physicalRadiusWorldAtOneToOne: planetRadius * md.sizeRatio,
      });
    }

    return (dt, _elapsed, gamma, showMarkers) => {
      body.rotation.y += dt * 0.24;
      for (let i = 0; i < this.jovianMoons.length; i++) {
        const jm = this.jovianMoons[i];
        jm.pivot.rotation.y += jm.angularSpeed * 0.22 * dt;
        const dist = planetRadius * Math.pow(jm.orbitPlanetRadii, gamma);
        const rad = planetRadius * Math.pow(jm.moonToPlanetRadiusRatio, gamma);
        jm.moonMesh.position.set(dist, 0, 0);
        jm.moonMesh.scale.setScalar(rad);
        jm.orbitLine.scale.setScalar(dist / (planetRadius * jm.orbitPlanetRadii));
        jm.orbitLine.visible = showMarkers || gamma < 0.92;
      }
    };
  }

  // --- 11. ROCKY PLANETS & INNER ORBITING MOONS (+7.85 · 71,000 km · MARS / PHOBOS-DEIMOS) ---
  private populateRockyPlanetsMoonsLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number, gamma: number, showMarkers: boolean) => void {
    // True Mars-Phobos-Deimos proportions:
    // Viewport span 71,000 km -> 44.0 world units (1 unit = 1,613 km).
    // Mars radius = 3,390 km => 2.10 units; Phobos orbit = 9,376 km (5.81 units); Deimos orbit = 23,463 km (14.55 units)!
    const planetRadius = 2.65;
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(
        planetRadius,
        this.isSoftwareGl ? 28 : 48,
        this.isSoftwareGl ? 20 : 36
      ),
      createRockyBodyMaterial({
        sunDir: _sharedSunDir,
        baseColorHex: 0xb45309,
        highlandColorHex: 0xfdba74,
      })
    );
    group.add(body);

    // Thin dusty CO2 salmon-rose Martian limb haze
    const co2Atmo = new THREE.Mesh(
      new THREE.SphereGeometry(planetRadius * 1.028, 32, 24),
      createAtmosphereScatteringMaterial({
        sunDir: _sharedSunDir,
        rayleighColor: new THREE.Color(0.92, 0.54, 0.34),
        intensity: 0.62,
      })
    );
    group.add(co2Atmo);

    const phobosOrbit = this.createOrbitHairline(5.81, 0.015, 0xfb923c, 64);
    const deimosOrbit = this.createOrbitHairline(14.55, 0.001, 0x94a3b8, 72);
    group.add(phobosOrbit.line, deimosOrbit.line);

    const phobosPivot = new THREE.Group();
    const phobosMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.0, 1),
      createRockyBodyMaterial({ sunDir: _sharedSunDir, baseColorHex: 0x78716c, highlandColorHex: 0xd6d3d1 })
    );
    phobosMesh.add(this.createSinglePointGlint(0xfdba74, 6.5, 0.12));
    phobosPivot.add(phobosMesh);

    const deimosPivot = new THREE.Group();
    deimosPivot.rotation.y = 2.1;
    const deimosMesh = phobosMesh.clone();
    deimosPivot.add(deimosMesh);
    group.add(phobosPivot, deimosPivot);

    this.registerMarkerAnchor({
      id: 'marker_phobos',
      label: 'Phobos Moonlet',
      sublabel: '9,376 km · 22.2 km',
      node: phobosMesh,
      layerBandId: 'rocky_planets_moons',
      minLog: 7.4,
      maxLog: 8.4,
      targetLogMeters: 7.11,
      colorCss: '#fdba74',
      physicalRadiusWorldAtOneToOne: 0.015,
    });

    return (dt, _elapsed, gamma, showMarkers) => {
      body.rotation.y += dt * 0.14;
      phobosPivot.rotation.y += dt * 0.62;
      deimosPivot.rotation.y += dt * 0.24;
      const mScale = planetRadius * Math.pow(0.004, gamma);
      phobosMesh.position.set(5.81, 0, 0);
      phobosMesh.scale.set(mScale * 1.3, mScale * 0.9, mScale);
      deimosMesh.position.set(14.55, 0, 0);
      deimosMesh.scale.setScalar(mScale * 0.75);
      phobosOrbit.line.visible = showMarkers || gamma < 0.92;
      deimosOrbit.line.visible = showMarkers || gamma < 0.92;
    };
  }

  // --- 12. HABITABLE BIOSPHERE PLANET (+7.11 · 12,742 km EARTH + MOON AT 30.17x D_EARTH) ---
  private populateHabitablePlanetLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number, gamma: number, showMarkers: boolean) => void {
    const axialTilt = new THREE.Group();
    axialTilt.rotation.z = THREE.MathUtils.degToRad(23.44);
    group.add(axialTilt);

    // Earth equatorial radius = 8.0 world units => Diameter D_Earth = 16.0 units === 12,742 km!
    const earthR = 8.0;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(
        earthR,
        this.isSoftwareGl ? 36 : 64,
        this.isSoftwareGl ? 28 : 48
      ),
      createHabitablePlanetMaterial(_sharedSunDir)
    );
    axialTilt.add(globe);

    // Independent rotating Cumulus & Cyclone Cloud Deck Sphere (1.012 R_Earth)
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(
        earthR * 1.013,
        this.isSoftwareGl ? 32 : 56,
        this.isSoftwareGl ? 24 : 40
      ),
      createPlanetCloudMaterial(_sharedSunDir)
    );
    axialTilt.add(clouds);

    // SpaceEngine / ISS Rayleigh + Mie Sapphire-Cyan Atmospheric Horizon Limb Shell (1.038 R_Earth)
    const atmoShell = new THREE.Mesh(
      new THREE.SphereGeometry(
        earthR * 1.042,
        this.isSoftwareGl ? 32 : 56,
        this.isSoftwareGl ? 24 : 40
      ),
      createAtmosphereScatteringMaterial({
        sunDir: _sharedSunDir,
        rayleighColor: new THREE.Color(0.16, 0.56, 1.0),
        intensity: 1.48,
      })
    );
    axialTilt.add(atmoShell);

    // Companion Moon ("Luna"):
    // True 1:1 radius = 0.2727 * R_Earth = 2.182 units (3,474 km)
    // True 1:1 orbital semi-major axis = 30.17 * D_Earth = 30.17 * 16.0 = 482.7 units (384,400 km)!
    this.habitableMoonPivot = new THREE.Group();
    this.habitableMoonPivot.rotation.x = 0.09; // 5.14 deg lunar orbital inclination
    this.habitableMoonPivot.rotation.y = 0.72;
    this.habitableMoonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.182, this.isSoftwareGl ? 20 : 32, 24),
      createRockyBodyMaterial({
        sunDir: _sharedSunDir,
        baseColorHex: 0x64748b,
        highlandColorHex: 0xe2e8f0,
      })
    );
    this.habitableMoonMesh.add(this.createSinglePointGlint(0xf1f5f9, 8.0, 0.2));
    this.habitableMoonPivot.add(this.habitableMoonMesh);
    group.add(this.habitableMoonPivot);

    const lunarOrbit = this.createOrbitHairline(482.7, 0.055, 0x38bdf8, 128);
    lunarOrbit.line.rotation.x = 0.09;
    this.habitableMoonOrbitLine = lunarOrbit.line;
    group.add(lunarOrbit.line);

    this.registerMarkerAnchor({
      id: 'marker_luna_moon',
      label: 'Luna (Companion Moon)',
      sublabel: '384,400 km · 30.2× Earth Diam.',
      node: this.habitableMoonMesh,
      layerBandId: 'habitable_planets',
      minLog: 6.6,
      maxLog: 9.2,
      targetLogMeters: 7.85,
      colorCss: '#e2e8f0',
      physicalRadiusWorldAtOneToOne: 2.182,
    });

    const sanctuaryEntryAnchor = new THREE.Object3D();
    sanctuaryEntryAnchor.position.set(0, 0, earthR);
    axialTilt.add(sanctuaryEntryAnchor);
    this.registerMarkerAnchor({
      id: 'marker_sanctuary_archipelago',
      label: 'Capybara Forest Archipelago',
      sublabel: 'Atmospheric Entry · 6.3 m',
      node: sanctuaryEntryAnchor,
      layerBandId: 'habitable_planets',
      minLog: 5.5,
      maxLog: 7.6,
      targetLogMeters: 0.8,
      colorCss: '#34d399',
      physicalRadiusWorldAtOneToOne: 0.001,
    });

    return (dt, _elapsed, gamma, showMarkers) => {
      globe.rotation.y += dt * 0.08;
      clouds.rotation.y += dt * 0.105;
      if (this.habitableMoonPivot && this.habitableMoonMesh && this.habitableMoonOrbitLine) {
        this.habitableMoonPivot.rotation.y += dt * 0.045;
        // At gamma=1.0: exact 30.17 * 16.0 = 482.7 units! Under Reality Rescaler: 16.0 * (30.17^gamma)!
        const moonDist = 16.0 * Math.pow(30.17, gamma);
        this.habitableMoonMesh.position.set(moonDist, 0, 0);
        this.habitableMoonOrbitLine.scale.setScalar(moonDist / 482.7);
        this.habitableMoonOrbitLine.visible = showMarkers || gamma < 0.92;
      }
    };
  }

  // --- 13. ATMOSPHERE & STRATOSPHERIC CLOUD DECKS (+4.9 · 80 km KÁRMÁN LIMB) ---
  private populateAtmosphereLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    // Curved planetary Rayleigh limb + cumulus cloud sea below with open descent corridor at (0,0)
    const limbCurvature = new THREE.Mesh(
      new THREE.SphereGeometry(52, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.36),
      createHabitablePlanetMaterial(_sharedSunDir)
    );
    limbCurvature.position.y = -51.5;
    group.add(limbCurvature);

    const rayleighCap = new THREE.Mesh(
      new THREE.SphereGeometry(53.4, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.36),
      createAtmosphereScatteringMaterial({
        sunDir: _sharedSunDir,
        rayleighColor: new THREE.Color(0.20, 0.58, 1.0),
        intensity: 1.6,
      })
    );
    rayleighCap.position.y = -51.5;
    group.add(rayleighCap);

    // Multi-layered soft volumetric FBM cloud deck planes parting cleanly around (0,0)
    for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
      const deck = new THREE.Mesh(
        new THREE.PlaneGeometry(54, 54),
        createPlanetCloudMaterial(_sharedSunDir)
      );
      deck.rotation.x = -Math.PI / 2;
      deck.position.y = -3.8 + layerIdx * 1.8;
      deck.rotation.z = layerIdx * 1.1;
      group.add(deck);
    }

    return (dt) => {
      limbCurvature.rotation.y += dt * 0.015;
    };
  }

  // --- 14. LAND MASSES & CORDILLERAS (+3.6 · 4.0 km) ---
  private populateLandMassesLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const segs = this.isSoftwareGl ? 32 : 64;
    const terrainGeo = new THREE.PlaneGeometry(46, 46, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const islandMask = Math.max(0, 1 - Math.pow(r / 21.0, 2.2));
      const ridge =
        Math.abs(Math.sin(x * 0.21 + 0.5) * Math.cos(z * 0.21)) * 5.4 +
        Math.sin(x * 0.58 + z * 0.44) * 1.25 +
        Math.cos(x * 1.2 - z * 1.1) * 0.42;
      const centerBasin = smoothstep01(1.8, 7.8, r);
      const h = -1.2 + islandMask * (1.5 + ridge * centerBasin);
      pos.setY(i, h);

      if (h < 0.0) {
        _scratchColorA.setHex(0x0369a1);
      } else if (h < 0.38) {
        _scratchColorA.setHex(0xd6c79c);
      } else if (h < 2.3) {
        _scratchColorA.setHex(0x166534);
      } else if (h < 3.8) {
        _scratchColorA.setHex(0x57534e);
      } else {
        _scratchColorA.setHex(0xf1f5f9);
      }
      colors[i * 3] = _scratchColorA.r;
      colors[i * 3 + 1] = _scratchColorA.g;
      colors[i * 3 + 2] = _scratchColorA.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrain = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.86,
      })
    );
    terrain.position.y = -4.5;
    group.add(terrain);

    return () => {};
  }

  // --- 15. FOREST & WETLAND ECOSYSTEMS (+2.2 · 160 m) ---
  private populateEcosystemsLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const meadow = new THREE.Mesh(
      new THREE.CircleGeometry(23, 48),
      new THREE.MeshStandardMaterial({
        color: 0x14532d,
        roughness: 0.9,
      })
    );
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.y = -2.4;
    group.add(meadow);

    const river = new THREE.Mesh(
      new THREE.RingGeometry(5.2, 6.6, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.18,
        metalness: 0.25,
        side: THREE.DoubleSide,
        opacity: 0.88,
      })
    );
    river.rotation.x = -Math.PI / 2;
    river.position.y = -2.34;
    group.add(river);

    const treeCount = this.isSoftwareGl ? 56 : 140;
    const crownGeo = new THREE.DodecahedronGeometry(1.05, 1);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.82,
    });
    const canopy = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
    for (let i = 0; i < treeCount; i++) {
      const ang = seededRand(i * 3 + 1) * Math.PI * 2;
      const r = 2.8 + seededRand(i * 3 + 2) * 18.2;
      const s = 0.72 + seededRand(i * 3 + 3) * 0.95;
      _dummyObj.position.set(Math.cos(ang) * r, -2.4 + 0.95 * s, Math.sin(ang) * r);
      _dummyObj.scale.set(s * 1.15, s * 0.92, s * 1.1);
      _dummyObj.rotation.y = ang;
      _dummyObj.updateMatrix();
      canopy.setMatrixAt(i, _dummyObj.matrix);
      _scratchColorA.setHex(
        i % 6 === 0 ? 0x4d7c0f : i % 9 === 0 ? 0xb45309 : 0x166534
      );
      canopy.setColorAt(i, _scratchColorA);
    }
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
    group.add(canopy);

    return () => {};
  }

  // --- 16. FOREST WITH CAPYBARAS SUNLIT CANOPY MOTES (+0.8 · 6.3 m) ---
  private populateForestCanopyMotesLayer(
    group: THREE.Group,
    glowTex: THREE.CanvasTexture
  ): (dt: number, elapsed: number) => void {
    const moteCount = this.isSoftwareGl ? 32 : 84;
    const pos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      pos[i * 3] = (seededRand(i * 3 + 1) - 0.5) * 18;
      pos[i * 3 + 1] = seededRand(i * 3 + 2) * 6.5 - 1.0;
      pos[i * 3 + 2] = (seededRand(i * 3 + 3) - 0.5) * 18;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const motes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: glowTex,
        color: 0xfef08a,
        size: 0.35,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    group.add(motes);

    return (dt) => {
      motes.rotation.y += dt * 0.08;
    };
  }

  // --- 17. CITRUS LEAF & CAPYBARA FUR MICROSTRUCTURE (-2.0 · 1.0 cm) ---
  private populateLeafAndFurMicroLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const leafBlade = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 16, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0x15803d,
        emissive: 0x052e16,
        emissiveIntensity: 0.38,
        side: THREE.DoubleSide,
        roughness: 0.48,
        opacity: 0.88,
      })
    );
    leafBlade.rotation.x = -0.55;
    group.add(leafBlade);

    const veinMat = new THREE.MeshStandardMaterial({
      color: 0xa3e635,
      emissive: 0x3f6212,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const midrib = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 25.0, 10), veinMat);
    midrib.rotation.z = Math.PI / 2;
    midrib.position.z = 0.08;
    leafBlade.add(midrib);

    for (let v = -5; v <= 5; v++) {
      for (const side of [-1, 1]) {
        const subVein = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.10, 7.6, 8),
          veinMat
        );
        subVein.position.set(v * 2.1, side * 3.2, 0.08);
        subVein.rotation.z = side * -0.68;
        leafBlade.add(subVein);
      }
    }

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.36,
      metalness: 0.18,
    });
    for (let h = 0; h < 10; h++) {
      const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.32, 24, 10), hairMat);
      hair.position.set((h - 4.5) * 2.6, 4.2 + (h % 2) * 1.8, -3.5 + (h % 3) * 2.2);
      hair.rotation.z = 0.52 + (h % 3) * 0.08;
      hair.rotation.x = 0.25;
      group.add(hair);
    }

    return (_dt, elapsed) => {
      leafBlade.rotation.z = Math.sin(elapsed * 0.8) * 0.03;
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
    const nucleus = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x4338ca,
        emissiveIntensity: 0.55,
        roughness: 0.28,
      })
    );
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

  // --- 19. B-DNA DOUBLE HELIX & MOLECULES (-8.47 · 3.4 nm PITCH, 2.0 nm DIAMETER) ---
  private populateDnaHelixLayer(
    group: THREE.Group
  ): (dt: number, elapsed: number) => void {
    const helix = new THREE.Group();
    helix.rotation.z = 0.28;
    group.add(helix);

    // Accurate Watson-Crick B-DNA geometry: 10.5 base pairs per 3.4 nm helical turn,
    // major groove (2.2 nm) vs minor groove (1.2 nm) phase offset (2.45 rad instead of pi)!
    const pairs = this.isSoftwareGl ? 28 : 44;
    const heightSpan = 30.0;
    const radius = 3.8;

    const backboneMatA = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.42,
      roughness: 0.24,
    });
    const backboneMatB = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0x9d174d,
      emissiveIntensity: 0.42,
      roughness: 0.24,
    });
    const baseColors = [0x34d399, 0xfbbf24, 0x60a5fa, 0xf43f5e];
    const atomGeo = new THREE.SphereGeometry(0.58, 12, 12);
    const rungGeo = new THREE.CylinderGeometry(0.18, 0.18, radius * 0.92, 8);

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

      const halfA = new THREE.Mesh(
        rungGeo,
        new THREE.MeshStandardMaterial({
          color: baseColors[i % 4],
          emissive: baseColors[i % 4],
          emissiveIntensity: 0.28,
          roughness: 0.35,
        })
      );
      halfA.position.set(x1 + _scratchVecA.x * chordLen * 0.25, y, z1 + _scratchVecA.z * chordLen * 0.25);
      halfA.quaternion.setFromUnitVectors(_upUnitVec, _scratchVecA);
      halfA.scale.set(1, (chordLen * 0.48) / (radius * 0.92), 1);

      const halfB = new THREE.Mesh(
        rungGeo,
        new THREE.MeshStandardMaterial({
          color: baseColors[(i + 2) % 4],
          emissive: baseColors[(i + 2) % 4],
          emissiveIntensity: 0.28,
          roughness: 0.35,
        })
      );
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
    group.add(
      new THREE.Points(
        cloudGeo,
        createStarPsfMaterial({
          baseSize: 13.5,
          diffractionStrength: 0.0,
          opacity: 0.62,
        })
      )
    );

    const waveHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowCool,
        color: 0x38bdf8,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    waveHalo.scale.setScalar(26);
    group.add(waveHalo);

    this.electronMarkers = [];

    return (dt, _elapsed, gamma) => {
      group.rotation.y += dt * 0.14;
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
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.setScalar(11.0);
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
      createStarPsfMaterial({ baseSize: 12.0, diffractionStrength: 0.0, opacity: 0.78 })
    );
    torusCloud.rotation.x = 0.35;
    group.add(torusCloud);

    return (dt, elapsed) => {
      torusCloud.rotation.y += dt * 1.4;
      halo.scale.setScalar(10.5 + Math.sin(elapsed * 5.0) * 0.8);
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
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      })
    );
    this.photonMagneticLine = new THREE.Line(
      bGeo,
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
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
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const bBarMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      opacity: 0.65,
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

    const core = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowWarm,
        color: 0xfef9c3,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    core.scale.setScalar(9.0);
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
    const phase = -elapsed * 8.5;
    for (let i = 0; i < samples; i++) {
      const u = i / (samples - 1) - 0.5;
      const x = u * 30.0;
      const env = Math.exp(-u * u * 14.0) * 7.8;
      const wave = Math.sin(u * 26.0 + phase) * env;
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
        const env = Math.exp(-u * u * 14.0) * 7.8;
        const amp = Math.sin(u * 26.0 + phase) * env;
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
    this.planckFoamBaseZ = new Float32Array(gridGeo.attributes.position.count * 2);
    for (let i = 0; i < gridGeo.attributes.position.count; i++) {
      this.planckFoamBaseZ[i * 2] = gridGeo.attributes.position.getX(i);
      this.planckFoamBaseZ[i * 2 + 1] = gridGeo.attributes.position.getZ(i);
    }

    const foamMesh = new THREE.Mesh(
      gridGeo,
      new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        wireframe: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    foamMesh.position.y = -2.2;
    group.add(foamMesh);

    const spark = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowCool,
        color: 0xe0f2fe,
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
      if (Math.abs(Math.sin(ang * 2)) > 0.94) continue;
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

    const herdSpecs = this.isSoftwareGl ? allHerdSpecs.slice(0, 3) : allHerdSpecs;
    const lodTier: CapyLodTier = this.isSoftwareGl ? 0 : 2;
    for (let i = 0; i < herdSpecs.length; i++) {
      const hs = herdSpecs[i];
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

  public tickWoodlandCapys(dt: number) {
    this.elapsed += dt;
    for (let i = 0; i < this.woodlandCapys.length; i++) {
      const w = this.woodlandCapys[i];
      const t = this.elapsed * w.speed + w.phase;
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
    astrophysicsPalette: AstrophysicsPaletteMode = 'natural'
  ): UniverseScaleBandSpec {
    this.ensureLayersBuilt();
    this.elapsed += dt;

    const gamma = THREE.MathUtils.clamp(realityScaleGamma, 0.28, 1.0);
    const hubbleMix = astrophysicsPalette === 'hubble' ? 0.92 : 0.18;

    this.rootGroup.visible = true;
    this.rootGroup.position.copy(focalWorldPos);

    // 1. Update Persistent 3D Celestial PSF Starfield & Milky Way Band above Troposphere (+4.0m .. +27.5m)
    const starSkyAlpha =
      smoothstep01(3.8, 5.8, logScaleMeters) * (1 - smoothstep01(26.4, 27.6, logScaleMeters));
    if (starSkyAlpha > 0.01) {
      this.celestialBackdropGroup.visible = true;
      this.celestialBackdropGroup.position.copy(focalWorldPos);
      for (let m = 0; m < this.celestialBackdropMats.length; m++) {
        const entry = this.celestialBackdropMats[m];
        if (entry.shaderOpacityUniform) {
          entry.shaderOpacityUniform.value = entry.baseOpacity * starSkyAlpha;
        } else {
          entry.mat.opacity = entry.baseOpacity * starSkyAlpha;
        }
      }
    } else {
      this.celestialBackdropGroup.visible = false;
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
      _scratchColorA.setHex(hiSpec.skyHex);
      _scratchColorB.setHex(loSpec.skyHex);
      outSkyColor.copy(_scratchColorA).lerp(_scratchColorB, frac);
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

      const scaledDelta = deltaLog * gamma;

      // Neighbor-aware visibility bounds:
      // At strict 1:1 (gamma = 1.0): parent layers fade out cleanly by 10^+1.18x (15x viewport) so giant
      // dust pillars at +16.63 NEVER slice through Solar System orbits at +13.7!
      // When Reality Rescaler compresses gamma -> 0.30, scaledDelta shrinks so multi-scale parent & child
      // structures stay nested on screen simultaneously!
      const maxExpandDex = 1.16;
      const maxShrinkDex = -2.35;

      if (scaledDelta > maxExpandDex || scaledDelta < maxShrinkDex) {
        if (layer.group.visible) {
          layer.group.visible = false;
        }
        continue;
      }

      let alpha = 1.0;
      if (scaledDelta < 0) {
        alpha = smoothstep01(maxShrinkDex, -0.32, scaledDelta);
      } else {
        alpha = 1.0 - smoothstep01(0.30, maxExpandDex, scaledDelta);
      }
      alpha *= focusBoost;

      if (alpha <= 0.008) {
        layer.group.visible = false;
        continue;
      }

      // TRUE BASE-10 PHYSICAL SCALE RATIO (exact 10^deltaLog when gamma === 1.0!)
      const visualScale = Math.pow(10, scaledDelta);
      layer.group.visible = true;
      layer.group.scale.setScalar(visualScale);

      for (let m = 0; m < layer.materials.length; m++) {
        const entry = layer.materials[m];
        const finalOpacity = entry.baseOpacity * alpha;
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
        entry.mat.depthWrite = alpha > 0.85 ? entry.defaultDepthWrite : false;
      }

      if (layer.tickFn) {
        layer.tickFn(dt, this.elapsed, gamma, showObjectMarkers);
      }
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
    this.celestialBackdropGroup.visible = false;
  }

  public getBandById(id: UniverseScaleBandId): UniverseScaleBandSpec {
    return UNIVERSE_SCALE_BANDS.find((b) => b.id === id) || UNIVERSE_SCALE_BANDS[0];
  }
}
