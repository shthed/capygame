import * as THREE from 'three';
import {
  COSMIC_GALAXIES,
  CosmicGalaxySpec,
  CosmicStage,
  CosmicPlanetType,
  CosmicAsteroidBeltSpec,
  OrbitTimeScaleId,
  ORBIT_TIME_SCALES,
  OrbitTelemetry,
} from '../types';

const MAX_HARDWARE_PARTICLES = 48000;
const MAX_SOFTWARE_PARTICLES = 9000;
const DEEP_FIELD_GALAXY_COUNT = 58;
const TOTAL_HALO_COUNT = COSMIC_GALAXIES.length + DEEP_FIELD_GALAXY_COUNT;
const SUPERNOVA_POOL_SIZE = 18;
const TRAIL_POINT_COUNT = 36;

export type CosmicGenesisEpoch =
  | 'inflation'
  | 'gravitational_collapse'
  | 'spiral_coalescence'
  | 'virial_equilibrium';

export type StellarColorMappingMode =
  | 'hr_blackbody'
  | 'mass_spectrum'
  | 'age_gradient';

export interface TrackedStarTelemetry {
  starIndex: number;
  catalogId: string;
  hostGalaxyIndex: number;
  hostGalaxyName: string;
  hostStarSystemIndex: number;
  hostStarSystemName: string;
  hostPlanetName: string;
  generation: 1 | 2 | 3;
  generationLabel: string;
   evolutionaryStageLabel: string;
  massSolar: number;
  ageGyr: number;
  tempKelvin: number;
  spectralClass: string;
  metallicityZ: number;
  supernovaAncestors: number;
  hasProtoplanetaryDisk: boolean;
  elements: {
    hydrogenPct: number;
    heliumPct: number;
    carbonOxygenPct: number;
    siliconMagnesiumPct: number;
    ironHeavyPct: number;
  };
  posX: number;
  posY: number;
  posZ: number;
  velocityKmS: number;
}

export interface CosmicSimTelemetry {
  epoch: CosmicGenesisEpoch;
  epochLabel: string;
  cosmicAgeGyr: number;
  gravityMultiplier: number;
  fluidViscosity: number;
  meanVelocityKmS: number;
  coalescencePercent: number;
  activeHalos: number;
  stellarColorMode: StellarColorMappingMode;
  stellarColorModeLabel: string;
  meanStellarMassSolar: number;
  meanStellarAgeGyr: number;
  meanTempKelvin: number;
  obStarPercent: number;
  redGiantPercent: number;
  totalSupernovae: number;
  meanMetallicitySolar: number;
  isFollowingTrackedStar: boolean;
  trackedStar: TrackedStarTelemetry;
}

const STAR_PARTICLE_VERTEX_SHADER = `
  attribute float aSize;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = max(1.2, -mvPosition.z);
    gl_PointSize = clamp(aSize * (215.0 / dist), 1.0, 24.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_PARTICLE_FRAGMENT_SHADER = `
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;

    // Realistic stellar Airy disk: intense hot core + exponential corona falloff
    float core = exp(-d * d * 14.0);
    float halo = exp(-d * 3.4) * 0.56;
    float intensity = core + halo;

    vec3 finalCol = mix(vColor, vec3(1.0, 0.99, 0.97), core * 0.58);
    gl_FragColor = vec4(finalCol, clamp(intensity, 0.0, 0.96));
  }
`;

const BLACK_HOLE_LENSING_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BLACK_HOLE_LENSING_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uCoreColor;
  uniform vec3 uArmColor;
  varying vec2 vUv;

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float r = length(centered);
    if (r > 1.0) discard;

    float angle = atan(centered.y, centered.x);

    // Schwarzschild Event Horizon shadow
    if (r < 0.195) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.99);
      return;
    }

    // Relativistic gravitational deflection & frame dragging
    float deflection = 0.048 / max(0.018, r - 0.185);
    float warpedAngle = angle + deflection * 2.9 - uTime * 1.15;

    // Sharp photon sphere ring at r = 0.215
    float photonRing = exp(-pow((r - 0.215) * 38.0, 2.0)) * 1.75;

    // Relativistic Doppler beaming (approaching side brighter)
    float doppler = 0.72 + 0.42 * cos(angle + 0.45);

    // Accretion turbulence & lensed secondary Einstein ring
    float turbulence = 0.55 + 0.45 * sin(warpedAngle * 5.0 + r * 24.0 - uTime * 2.1);
    float innerDisk = exp(-pow((r - 0.31) * 15.0, 2.0)) * turbulence * doppler * 0.95;
    float outerLensing = exp(-pow((r - 0.52) * 8.5, 2.0)) * (0.5 + 0.5 * cos(warpedAngle * 3.0 - uTime * 1.2)) * 0.42;

    float intensity = photonRing + innerDisk + outerLensing;
    float edgeFade = smoothstep(1.0, 0.21, r);

    vec3 col = mix(uArmColor, uCoreColor, clamp(photonRing * 0.7 + 0.35, 0.0, 1.0));
    col += vec3(1.0, 0.98, 0.94) * photonRing * 0.95;

    float alpha = clamp(intensity * edgeFade, 0.0, 0.96);
    gl_FragColor = vec4(col, alpha);
  }
`;

interface SupernovaShockwave {
  mesh: THREE.Mesh;
  active: boolean;
  elapsed: number;
  duration: number;
  maxRadius: number;
}

export class CosmicUniverseBuilder {
  public readonly rootGroup = new THREE.Group();
  public readonly singularityGroup = new THREE.Group();
  public readonly universeGroup = new THREE.Group();
  public readonly galaxyViewGroup = new THREE.Group();
  public readonly starSystemGroup = new THREE.Group();
  public readonly planetOrbitGroup = new THREE.Group();

  public singularityMesh!: THREE.Mesh;
  public singularityHalo!: THREE.Mesh;
  public inflationSphere!: THREE.Mesh;

  // Persistent Tracked Star 3D Reticle & Trajectory Trail
  public trackedStarMarker!: THREE.Group;
  private trackedStarOuterRing!: THREE.Mesh;
  private trackedStarInnerRing!: THREE.Mesh;
  private trackedStarTrail!: THREE.Line;
  private trackedStarTrailPositions = new Float32Array(TRAIL_POINT_COUNT * 3);

  // Pool of 3D Expanding Supernova Remnant Shockwaves
  private supernovaPool: SupernovaShockwave[] = [];
  private supernovaSpawnTimer = 0;

  private readonly maxParticles: number;
  private readonly animatedParticleLimit: number;
  private activeParticleCount: number;
  private currentFps: number = 60;
  private fpsMonitorTimer: number = 0;

  private particlePoints!: THREE.Points;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;
  private particleInitialVel: Float32Array;
  private particleColors: Float32Array;
  private particleMatureColors: Float32Array;
  private particleSizes: Float32Array;
  private particleBaseSizes: Float32Array;

  // Per-star Astrophysical Mass (M/M_sun), Age (Gyr), Generation (Pop III/II/I) & Metallicity Z
  private particleStellarMass: Float32Array;
  private particleInitialPop3Mass: Float32Array;
  private particlePop2Mass: Float32Array;
  private particlePop1Mass: Float32Array;
  private particleStellarAgeGyr: Float32Array;
  private particleBirthEpochGyr: Float32Array;
  private particleRadialFrac: Float32Array;
  private particleGeneration: Uint8Array;
  private particleSupernovaCount: Uint8Array;
  private particleMetallicityZ: Float32Array;

  // Per-particle gravitational & fluid disk state (Zero per-frame allocation)
  private particleHaloIndex: Uint8Array;
  private particleTargetRadius: Float32Array;
  private particleTargetAngle: Float32Array;
  private particleTargetHeight: Float32Array;
  private particleOrbitSpeed: Float32Array;

  // 64 Proto-Galactic Dark Matter + Supermassive Black Hole (SMBH) Halos
  private haloPos: Float32Array = new Float32Array(TOTAL_HALO_COUNT * 3);
  private haloVel: Float32Array = new Float32Array(TOTAL_HALO_COUNT * 3);
  private haloSpinAxis: Float32Array = new Float32Array(TOTAL_HALO_COUNT * 3);
  private haloBasisU: Float32Array = new Float32Array(TOTAL_HALO_COUNT * 3);
  private haloBasisV: Float32Array = new Float32Array(TOTAL_HALO_COUNT * 3);
  private haloMass: Float32Array = new Float32Array(TOTAL_HALO_COUNT);
  private haloScaleRadius: Float32Array = new Float32Array(TOTAL_HALO_COUNT);
  private haloArmCount: Uint8Array = new Uint8Array(TOTAL_HALO_COUNT);
  private haloRotationSpeed: Float32Array = new Float32Array(TOTAL_HALO_COUNT);

  private galaxyNodes: THREE.Group[] = [];
  private blackHoleLensingDisps: THREE.Mesh[] = [];
  private blackHoleAccretionDisks: THREE.Mesh[] = [];
  private blackHoleShaderUniforms: Array<{ uTime: { value: number } }> = [];

  private starNodes: THREE.Group[] = [];
  private planetNodes: Array<{
    orbitGroup: THREE.Group;
    meshGroup: THREE.Group;
    orbitRadius: number;
    orbitSpeed: number;
    semiMajorAu: number;
    planetType: CosmicPlanetType;
    name: string;
    specIndex: number;
    angle: number;
  }> = [];
  private orbitGlobeGroup = new THREE.Group();
  private orbitCloudMesh: THREE.Mesh | null = null;
  private landingBeaconMeshes: THREE.Group[] = [];

  // Unified Planetary & Asteroid Belt Orbit Time Simulation State
  private orbitTimeScale: OrbitTimeScaleId = '1_orbit_min';
  private simElapsedSeconds: number = 0;
  private asteroidBeltGroup: THREE.Group | null = null;
  private asteroidBeltHitMesh: THREE.Mesh | null = null;
  private asteroidBeltAngle: number = 0;
  private currentActiveStarIndex: number = 0;
  private currentActiveGalaxyIndex: number = 0;

  public readonly clickableObjects: THREE.Object3D[] = [];

  private bigBangElapsed = 0;
  private elapsedTime = 0;
  private flashIntensity = 0;

  // Real-time Gravity, Fluid, Nucleosynthesis & Tracked Star Telemetry
  private genesisEpoch: CosmicGenesisEpoch = 'inflation';
  private gravityMultiplier = 1.0;
  private fluidViscosity = 1.0;
  private meanVelocityKmS = 0;
  private coalescencePercent = 0;

  private stellarColorMode: StellarColorMappingMode = 'hr_blackbody';
  private meanStellarMassSolar = 1.42;
  private meanStellarAgeGyr = 4.6;
  private meanTempKelvin = 6840;
  private obStarPercent = 18;
  private redGiantPercent = 14;
  private totalSupernovae = 0;
  private meanMetallicitySolar = 0.01;

  // Persistent Tracked Star State (randomly picked at creation, persisted to planet surface)
  private trackedStarIndex: number = 0;
  private isFollowingTrackedStar: boolean = true;
  private trackedStarLastGen: number = 1;

  // Scratch buffers for zero-allocation color evaluation
  private readonly _rgbScratch = new Float32Array(3);
  private readonly _tempVec3 = new THREE.Vector3();
  private readonly _tempAxis = new THREE.Vector3();
  private readonly _tempU = new THREE.Vector3();
  private readonly _tempV = new THREE.Vector3();
  private readonly _intersectPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(isSoftwareGl: boolean = false) {
    this.maxParticles = isSoftwareGl ? MAX_SOFTWARE_PARTICLES : MAX_HARDWARE_PARTICLES;
    this.animatedParticleLimit = isSoftwareGl ? 9000 : 28000;
    this.activeParticleCount = isSoftwareGl ? 7500 : 36000;

    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleVelocities = new Float32Array(this.maxParticles * 3);
    this.particleInitialVel = new Float32Array(this.maxParticles * 3);
    this.particleColors = new Float32Array(this.maxParticles * 3);
    this.particleMatureColors = new Float32Array(this.maxParticles * 3);
    this.particleSizes = new Float32Array(this.maxParticles);
    this.particleBaseSizes = new Float32Array(this.maxParticles);

    this.particleStellarMass = new Float32Array(this.maxParticles);
    this.particleInitialPop3Mass = new Float32Array(this.maxParticles);
    this.particlePop2Mass = new Float32Array(this.maxParticles);
    this.particlePop1Mass = new Float32Array(this.maxParticles);
    this.particleStellarAgeGyr = new Float32Array(this.maxParticles);
    this.particleBirthEpochGyr = new Float32Array(this.maxParticles);
    this.particleRadialFrac = new Float32Array(this.maxParticles);
    this.particleGeneration = new Uint8Array(this.maxParticles);
    this.particleSupernovaCount = new Uint8Array(this.maxParticles);
    this.particleMetallicityZ = new Float32Array(this.maxParticles);

    this.particleHaloIndex = new Uint8Array(this.maxParticles);
    this.particleTargetRadius = new Float32Array(this.maxParticles);
    this.particleTargetAngle = new Float32Array(this.maxParticles);
    this.particleTargetHeight = new Float32Array(this.maxParticles);
    this.particleOrbitSpeed = new Float32Array(this.maxParticles);

    this.rootGroup.name = 'CosmicUniverseRoot';
    this.rootGroup.add(
      this.singularityGroup,
      this.universeGroup,
      this.galaxyViewGroup,
      this.starSystemGroup,
      this.planetOrbitGroup
    );

    this.buildSingularity();
    this.buildTrackedStarReticleAndSupernovaPool();
    this.initializeGravityHalosAndParticles();
    this.pickRandomTrackedStar();
  }

  public getSimulationStats(): {
    activeStars: number;
    maxStars: number;
    totalGalaxies: number;
    fps: number;
  } {
    return {
      activeStars: this.activeParticleCount,
      maxStars: this.maxParticles,
      totalGalaxies: TOTAL_HALO_COUNT,
      fps: Math.round(this.currentFps),
    };
  }

  public isCameraFollowingTrackedStar(): boolean {
    return this.isFollowingTrackedStar;
  }

  public setCameraFollowingTrackedStar(follow: boolean) {
    this.isFollowingTrackedStar = follow;
  }

  public toggleCameraFollowingTrackedStar(): boolean {
    this.isFollowingTrackedStar = !this.isFollowingTrackedStar;
    return this.isFollowingTrackedStar;
  }

  public getTrackedStarWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    const i3 = this.trackedStarIndex * 3;
    return out.set(
      this.particlePositions[i3],
      this.particlePositions[i3 + 1],
      this.particlePositions[i3 + 2]
    );
  }

  /**
   * Randomly selects a persistent star parcel within the primary interactive galaxies
   * to follow from the Big Bang (T = 0) through Pop III -> Pop II -> Pop I supernova nucleosynthesis
   * all the way to planetary system formation and surface landing.
   */
  public pickRandomTrackedStar(preferredGalaxyIdx?: number): number {
    const primaryCount = COSMIC_GALAXIES.length;
    const starsPerPrimary = Math.floor(this.animatedParticleLimit / primaryCount);
    const targetGal =
      typeof preferredGalaxyIdx === 'number'
        ? THREE.MathUtils.clamp(preferredGalaxyIdx, 0, primaryCount - 1)
        : Math.floor(Math.random() * primaryCount);

    // Pick a star in the intermediate spiral disk zone (0.28..0.75) so it clearly shows spiral arm orbit
    const minOffset = Math.floor(starsPerPrimary * 0.28);
    const maxOffset = Math.floor(starsPerPrimary * 0.78);
    const offset = minOffset + Math.floor(Math.random() * Math.max(1, maxOffset - minOffset));

    this.trackedStarIndex = Math.min(
      this.activeParticleCount - 1,
      targetGal * starsPerPrimary + offset
    );
    this.trackedStarLastGen = this.particleGeneration[this.trackedStarIndex] || 1;
    this.resetTrackedStarTrail();
    return this.trackedStarIndex;
  }

  private resetTrackedStarTrail() {
    const i3 = this.trackedStarIndex * 3;
    const px = this.particlePositions[i3];
    const py = this.particlePositions[i3 + 1];
    const pz = this.particlePositions[i3 + 2];
    for (let k = 0; k < TRAIL_POINT_COUNT; k++) {
      this.trackedStarTrailPositions[k * 3] = px;
      this.trackedStarTrailPositions[k * 3 + 1] = py;
      this.trackedStarTrailPositions[k * 3 + 2] = pz;
    }
    if (this.trackedStarTrail) {
      const attr = this.trackedStarTrail.geometry.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }
  }

  /**
   * Triggers a Core-Collapse Supernova detonation on the currently tracked star (or any specified star),
   * spawning a 3D expanding shockwave remnant, enriching local metallicity Z with heavy elements (C, O, Si, Fe),
   * and collapsing the enriched remnant nebula into the next stellar generation!
   */
  public triggerTrackedStarSupernova() {
    const idx = this.trackedStarIndex;
    const i3 = idx * 3;
    const px = this.particlePositions[i3];
    const py = this.particlePositions[i3 + 1];
    const pz = this.particlePositions[i3 + 2];

    const currentGen = this.particleGeneration[idx];
    const nextGen = Math.min(3, currentGen + 1) as 1 | 2 | 3;
    this.particleGeneration[idx] = nextGen;
    this.trackedStarLastGen = Math.max(this.trackedStarLastGen, nextGen);
    this.particleSupernovaCount[idx] = Math.min(255, this.particleSupernovaCount[idx] + 1);

    if (nextGen === 2) {
      this.particleStellarMass[idx] = this.particlePop2Mass[idx];
      this.particleMetallicityZ[idx] = Math.max(0.0035, this.particleMetallicityZ[idx] + 0.004);
    } else {
      this.particleStellarMass[idx] = this.particlePop1Mass[idx];
      this.particleMetallicityZ[idx] = Math.max(0.018, this.particleMetallicityZ[idx] + 0.014);
    }

    this.particleStellarAgeGyr[idx] = 0.05;
    this.totalSupernovae += 1;

    // Spawn 3D Supernova Shockwave Shell at the tracked star's exact 3D position
    this.spawnSupernovaShockwave(
      px,
      py,
      pz,
      nextGen === 2 ? 0x38bdf8 : 0xfbbf24,
      16.0
    );

    // Enrich neighboring stars in the same proto-galactic cloud with heavy elements & radial shockwave kick
    this.triggerGravityWaveBurst(px, py, pz, 0.45);
  }

  private getSpectralClassFromTemp(kelvin: number, massSolar: number): string {
    if (kelvin >= 28000) return 'Class O5V (Blue Hypergiant)';
    if (kelvin >= 11000) return 'Class B2V (Blue-White Giant)';
    if (kelvin >= 7600) return 'Class A1V (Cyan-White Main Seq)';
    if (kelvin >= 6100) return 'Class F5V (Yellow-White Main Seq)';
    if (kelvin >= 5200) return 'Class G2V (Solar Main Sequence)';
    if (kelvin >= 3900) {
      return massSolar > 1.15 ? 'Class K2III (Orange Red Giant)' : 'Class K5V (Orange Dwarf)';
    }
    return massSolar > 1.1 ? 'Class M1I (Red Supergiant)' : 'Class M4V (Red Dwarf)';
  }

  public getTrackedStarTelemetry(): TrackedStarTelemetry {
    const idx = this.trackedStarIndex;
    const i3 = idx * 3;
    const hIdx = this.particleHaloIndex[idx];
    const primaryIdx = hIdx < COSMIC_GALAXIES.length ? hIdx : idx % COSMIC_GALAXIES.length;
    const galaxy = COSMIC_GALAXIES[primaryIdx] || COSMIC_GALAXIES[0];
    const starSysIdx = idx % galaxy.starSystems.length;
    const starSys = galaxy.starSystems[starSysIdx] || galaxy.starSystems[0];
    const planet = starSys.planets[0];

    const gen = (this.particleGeneration[idx] || 1) as 1 | 2 | 3;
    const massSolar = this.particleStellarMass[idx] || 1.0;
    const ageGyr = this.particleStellarAgeGyr[idx] || 0.1;
    const zMetal = this.particleMetallicityZ[idx] || 0.0;
    const snCount = this.particleSupernovaCount[idx] || 0;

    const effTempK = this.evaluateStarColorAndEvolution(
      idx,
      massSolar,
      ageGyr,
      this.particleRadialFrac[idx],
      this.stellarColorMode
    );

    let generationLabel = 'Gen 1 · Pop III (Primordial H/He)';
    let evolutionaryStageLabel = 'Massive Primordial Core Fusion';
    if (gen === 2) {
      generationLabel = 'Gen 2 · Pop II (Fe/O Enriched)';
      evolutionaryStageLabel =
        massSolar > 6.5 ? 'Core-Collapse Supernova Progenitor' : 'Low-Metallicity Halo Star';
    } else if (gen === 3) {
      generationLabel = 'Gen 3 · Pop I (Planetary Disk Host)';
      evolutionaryStageLabel =
        zMetal >= 0.012
          ? 'Heavy-Element Terrestrial Planet Host'
          : 'Metal-Rich Main Sequence Disk Star';
    }

    // Nucleosynthesis Mass Fractions (X + Y + Z = 100%)
    const zPct = THREE.MathUtils.clamp(zMetal * 100, 0.0, 3.8);
    const heliumPct = THREE.MathUtils.clamp(24.8 + snCount * 1.45 + ageGyr * 0.18, 24.8, 29.5);
    const hydrogenPct = Math.max(65.0, 100.0 - heliumPct - zPct);

    const carbonOxygenPct = Number((zPct * 0.56).toFixed(2));
    const siliconMagnesiumPct = Number((zPct * 0.26).toFixed(2));
    const ironHeavyPct = Number((zPct * 0.18).toFixed(2));

    const vx = this.particleVelocities[i3];
    const vy = this.particleVelocities[i3 + 1];
    const vz = this.particleVelocities[i3 + 2];

    return {
      starIndex: idx,
      catalogId: `HD-${10000 + (idx % 89999)}`,
      hostGalaxyIndex: primaryIdx,
      hostGalaxyName: galaxy.name,
      hostStarSystemIndex: starSysIdx,
      hostStarSystemName: starSys.name,
      hostPlanetName: planet.name,
      generation: gen,
      generationLabel,
      evolutionaryStageLabel,
      massSolar: Number(massSolar.toFixed(2)),
      ageGyr: Number(ageGyr.toFixed(2)),
      tempKelvin: Math.round(effTempK),
      spectralClass: this.getSpectralClassFromTemp(effTempK, massSolar),
      metallicityZ: Number(zMetal.toFixed(4)),
      supernovaAncestors: snCount,
      hasProtoplanetaryDisk: gen === 3 && zMetal >= 0.012,
      elements: {
        hydrogenPct: Number(hydrogenPct.toFixed(1)),
        heliumPct: Number(heliumPct.toFixed(1)),
        carbonOxygenPct,
        siliconMagnesiumPct,
        ironHeavyPct,
      },
      posX: Number(this.particlePositions[i3].toFixed(1)),
      posY: Number(this.particlePositions[i3 + 1].toFixed(1)),
      posZ: Number(this.particlePositions[i3 + 2].toFixed(1)),
      velocityKmS: Math.round(Math.hypot(vx, vy, vz) * 18.5),
    };
  }

  public getCosmicSimTelemetry(): CosmicSimTelemetry {
    let epochLabel = 'Big Bang Nucleosynthesis (75% H, 25% He)';
    if (this.genesisEpoch === 'gravitational_collapse') {
      epochLabel = 'Pop III Ignition & Pair-Instability Supernovae';
    } else if (this.genesisEpoch === 'spiral_coalescence') {
      epochLabel = 'Pop II -> Pop I Supernova Enrichment & Disk Accretion';
    } else if (this.genesisEpoch === 'virial_equilibrium') {
      epochLabel = 'Virialized Spiral Galaxies & Planetary Systems';
    }

    let stellarColorModeLabel = 'H-R Blackbody (Mass & Age)';
    if (this.stellarColorMode === 'mass_spectrum') {
      stellarColorModeLabel = 'Initial Mass Function (M/M☉)';
    } else if (this.stellarColorMode === 'age_gradient') {
      stellarColorModeLabel = 'Stellar Age Gradient (Gyr)';
    }

    return {
      epoch: this.genesisEpoch,
      epochLabel,
      cosmicAgeGyr: Math.min(13.8, this.bigBangElapsed * 3.1),
      gravityMultiplier: this.gravityMultiplier,
      fluidViscosity: this.fluidViscosity,
      meanVelocityKmS: Math.round(this.meanVelocityKmS),
      coalescencePercent: Math.round(this.coalescencePercent),
      activeHalos: TOTAL_HALO_COUNT,
      stellarColorMode: this.stellarColorMode,
      stellarColorModeLabel,
      meanStellarMassSolar: Number(this.meanStellarMassSolar.toFixed(2)),
      meanStellarAgeGyr: Number(this.meanStellarAgeGyr.toFixed(2)),
      meanTempKelvin: Math.round(this.meanTempKelvin),
      obStarPercent: Math.round(this.obStarPercent),
      redGiantPercent: Math.round(this.redGiantPercent),
      totalSupernovae: this.totalSupernovae,
      meanMetallicitySolar: Number(this.meanMetallicitySolar.toFixed(2)),
      isFollowingTrackedStar: this.isFollowingTrackedStar,
      trackedStar: this.getTrackedStarTelemetry(),
    };
  }

  public getStellarColorMode(): StellarColorMappingMode {
    return this.stellarColorMode;
  }

  public setStellarColorMode(mode: StellarColorMappingMode) {
    this.stellarColorMode = mode;
    const simAgeGyr =
      this.genesisEpoch === 'virial_equilibrium'
        ? 13.8
        : Math.min(13.8, Math.max(0.4, this.bigBangElapsed * 3.1));
    this.recomputeStellarColorsForCosmicAge(simAgeGyr, true);
  }

  public cycleStellarColorMode(): StellarColorMappingMode {
    const order: StellarColorMappingMode[] = [
      'hr_blackbody',
      'mass_spectrum',
      'age_gradient',
    ];
    const nextIdx = (order.indexOf(this.stellarColorMode) + 1) % order.length;
    this.setStellarColorMode(order[nextIdx]);
    return this.stellarColorMode;
  }

  public adjustGravityConstant(delta: number) {
    this.gravityMultiplier = THREE.MathUtils.clamp(this.gravityMultiplier + delta, 0.4, 2.8);
  }

  private evaluatePlanckianBlackbodyRGB(kelvin: number, outRgb: Float32Array) {
    const temp = THREE.MathUtils.clamp(kelvin, 1800.0, 40000.0) / 100.0;
    let r = 1.0;
    let g = 1.0;
    let b = 1.0;

    if (temp <= 66.0) {
      r = 1.0;
    } else {
      r = 1.292936186 * Math.pow(temp - 60.0, -0.1332047592);
    }

    if (temp <= 66.0) {
      g = 0.3900815788 * Math.log(Math.max(1.0, temp)) - 0.6318414438;
    } else {
      g = 1.129890861 * Math.pow(temp - 60.0, -0.0755148492);
    }

    if (temp >= 66.0) {
      b = 1.0;
    } else if (temp <= 19.0) {
      b = 0.0;
    } else {
      b = 0.5432067891 * Math.log(temp - 10.0) - 1.1962540891;
    }

    outRgb[0] = THREE.MathUtils.clamp(r, 0.0, 1.0);
    outRgb[1] = THREE.MathUtils.clamp(g, 0.0, 1.0);
    outRgb[2] = THREE.MathUtils.clamp(b, 0.0, 1.0);
  }

  private evaluateStarColorAndEvolution(
    starIndex: number,
    massSolar: number,
    ageGyr: number,
    radialFrac: number,
    mode: StellarColorMappingMode
  ): number {
    const msLifetimeGyr = 10.0 * Math.pow(Math.max(0.12, massSolar), -1.65);

    const effectiveAgeGyr =
      massSolar > 3.5 && radialFrac > 0.2 && radialFrac < 0.82
        ? (ageGyr % Math.max(0.08, msLifetimeGyr * 1.18))
        : ageGyr;

    const lifePhase = effectiveAgeGyr / Math.max(0.02, msLifetimeGyr);
    const zamsTempK = 5778.0 * Math.pow(massSolar, 0.54);
    let effTempK = zamsTempK;
    let sizeEvoMultiplier = 1.0;

    if (lifePhase < 0.06) {
      const protoT = lifePhase / 0.06;
      effTempK = 3100.0 + (zamsTempK - 3100.0) * protoT;
      sizeEvoMultiplier = 1.18 - 0.18 * protoT;
    } else if (lifePhase < 0.82) {
      const msFrac = (lifePhase - 0.06) / 0.76;
      effTempK = zamsTempK * (1.0 - 0.08 * msFrac);
      sizeEvoMultiplier = 1.0 + 0.15 * msFrac;
    } else if (lifePhase < 1.14) {
      const rgbFrac = (lifePhase - 0.82) / 0.32;
      const giantTargetK = massSolar > 6.0 ? 3550.0 : 3250.0 + (starIndex % 7) * 110.0;
      effTempK = zamsTempK * (1.0 - rgbFrac) + giantTargetK * rgbFrac;
      sizeEvoMultiplier = 1.15 + Math.sin(rgbFrac * Math.PI) * 0.65;
    } else {
      effTempK = 16500.0 + (starIndex % 11) * 1200.0;
      sizeEvoMultiplier = 0.72;
    }

    this.particleSizes[starIndex] =
      this.particleBaseSizes[starIndex] *
      sizeEvoMultiplier *
      (starIndex === this.trackedStarIndex ? 2.4 : 1.0);

    if (mode === 'hr_blackbody') {
      this.evaluatePlanckianBlackbodyRGB(effTempK, this._rgbScratch);

      if (effTempK > 12000.0) {
        const hotBoost = Math.min(1.0, (effTempK - 12000.0) / 18000.0);
        this._rgbScratch[0] = this._rgbScratch[0] * (1.0 - 0.28 * hotBoost) + 0.38 * hotBoost;
        this._rgbScratch[1] = this._rgbScratch[1] * (1.0 - 0.15 * hotBoost) + 0.68 * hotBoost;
        this._rgbScratch[2] = 1.0;
      } else if (effTempK < 4400.0) {
        const coolBoost = Math.min(1.0, (4400.0 - effTempK) / 1800.0);
        this._rgbScratch[0] = 1.0;
        this._rgbScratch[1] = this._rgbScratch[1] * (1.0 - 0.25 * coolBoost) + 0.32 * coolBoost;
        this._rgbScratch[2] = this._rgbScratch[2] * (1.0 - 0.55 * coolBoost) + 0.08 * coolBoost;
      }

      if (massSolar > 9.5 && radialFrac > 0.24 && radialFrac < 0.76 && starIndex % 19 === 0) {
        this._rgbScratch[0] = Math.min(1.0, this._rgbScratch[0] * 0.45 + 0.55);
        this._rgbScratch[1] = this._rgbScratch[1] * 0.42 + 0.12;
        this._rgbScratch[2] = Math.min(1.0, this._rgbScratch[2] * 0.5 + 0.45);
      }
    } else if (mode === 'mass_spectrum') {
      const logMass = Math.log10(Math.max(0.12, massSolar));
      const normMass = THREE.MathUtils.clamp((logMass + 0.85) / 2.25, 0.0, 1.0);
      if (normMass < 0.38) {
        const t = normMass / 0.38;
        this._rgbScratch[0] = 0.96;
        this._rgbScratch[1] = 0.22 + 0.62 * t;
        this._rgbScratch[2] = 0.12 + 0.18 * t;
      } else if (normMass < 0.72) {
        const t = (normMass - 0.38) / 0.34;
        this._rgbScratch[0] = 0.96 * (1.0 - t) + 0.25 * t;
        this._rgbScratch[1] = 0.84 + 0.12 * t;
        this._rgbScratch[2] = 0.3 + 0.65 * t;
      } else {
        const t = (normMass - 0.72) / 0.28;
        this._rgbScratch[0] = 0.25 + 0.42 * t;
        this._rgbScratch[1] = 0.96 * (1.0 - 0.35 * t);
        this._rgbScratch[2] = 1.0;
      }
    } else {
      const normAge = THREE.MathUtils.clamp(effectiveAgeGyr / 11.5, 0.0, 1.0);
      if (normAge < 0.25) {
        const t = normAge / 0.25;
        this._rgbScratch[0] = 0.32 + 0.55 * t;
        this._rgbScratch[1] = 0.82 + 0.14 * t;
        this._rgbScratch[2] = 1.0 - 0.22 * t;
      } else if (normAge < 0.62) {
        const t = (normAge - 0.25) / 0.37;
        this._rgbScratch[0] = 0.87 + 0.13 * t;
        this._rgbScratch[1] = 0.96 - 0.32 * t;
        this._rgbScratch[2] = 0.78 - 0.56 * t;
      } else {
        const t = (normAge - 0.62) / 0.38;
        this._rgbScratch[0] = 1.0 - 0.12 * t;
        this._rgbScratch[1] = 0.64 - 0.42 * t;
        this._rgbScratch[2] = 0.22 - 0.12 * t;
      }
    }

    return effTempK;
  }

  public recomputeStellarColorsForCosmicAge(
    cosmicAgeGyr: number,
    syncLiveBuffer: boolean = false
  ) {
    let massSum = 0;
    let ageSum = 0;
    let tempSum = 0;
    let metalSum = 0;
    let obCount = 0;
    let giantCount = 0;

    for (let i = 0; i < this.maxParticles; i++) {
      const i3 = i * 3;
      const massSolar = this.particleStellarMass[i];
      const birthGyr = this.particleBirthEpochGyr[i];
      const starAgeGyr = Math.max(0.02, cosmicAgeGyr - birthGyr);
      this.particleStellarAgeGyr[i] = starAgeGyr;

      const radialFrac = this.particleRadialFrac[i];
      const effTempK = this.evaluateStarColorAndEvolution(
        i,
        massSolar,
        starAgeGyr,
        radialFrac,
        this.stellarColorMode
      );

      this.particleMatureColors[i3] = this._rgbScratch[0];
      this.particleMatureColors[i3 + 1] = this._rgbScratch[1];
      this.particleMatureColors[i3 + 2] = this._rgbScratch[2];

      if (syncLiveBuffer) {
        this.particleColors[i3] = this._rgbScratch[0];
        this.particleColors[i3 + 1] = this._rgbScratch[1];
        this.particleColors[i3 + 2] = this._rgbScratch[2];
      }

      massSum += massSolar;
      ageSum += starAgeGyr;
      tempSum += effTempK;
      metalSum += this.particleMetallicityZ[i];
      if (effTempK >= 10000.0) obCount++;
      if (effTempK <= 4350.0 && massSolar >= 0.75) giantCount++;
    }

    this.meanStellarMassSolar = massSum / this.maxParticles;
    this.meanStellarAgeGyr = ageSum / this.maxParticles;
    this.meanTempKelvin = tempSum / this.maxParticles;
    this.meanMetallicitySolar = (metalSum / this.maxParticles) / 0.014;
    this.obStarPercent = (obCount / this.maxParticles) * 100;
    this.redGiantPercent = (giantCount / this.maxParticles) * 100;

    if (syncLiveBuffer && this.particlePoints) {
      const colAttr = this.particlePoints.geometry.getAttribute('color') as THREE.BufferAttribute;
      const sizeAttr = this.particlePoints.geometry.getAttribute('aSize') as THREE.BufferAttribute;
      colAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    }
  }

  public triggerGravityWaveBurst(
    originX: number = 0,
    originY: number = 0,
    originZ: number = 0,
    strengthScale: number = 1.0
  ) {
    const count = this.activeParticleCount;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const dx = this.particlePositions[i3] - originX;
      const dy = this.particlePositions[i3 + 1] - originY;
      const dz = this.particlePositions[i3 + 2] - originZ;
      const distSq = dx * dx + dy * dy + dz * dz + 36.0;
      const dist = Math.sqrt(distSq);

      const impulse = (420.0 / (distSq + 120.0)) * this.gravityMultiplier * strengthScale;
      this.particleVelocities[i3] += (dx / dist - 0.35 * (dz / dist)) * impulse;
      this.particleVelocities[i3 + 1] += (dy / dist) * impulse * 0.65;
      this.particleVelocities[i3 + 2] += (dz / dist + 0.35 * (dx / dist)) * impulse;
    }
  }

  public handleBigBangRaycastPerturbation(
    raycaster: THREE.Raycaster,
    camera: THREE.Camera
  ): boolean {
    camera.getWorldDirection(this._tempVec3);
    this._intersectPlane.setFromNormalAndCoplanarPoint(
      this._tempVec3,
      new THREE.Vector3(0, 0, 0)
    );
    if (raycaster.ray.intersectPlane(this._intersectPlane, this._tempVec3)) {
      // Find the nearest persistent star to the clicked 3D ray and lock tracking onto it
      let bestIdx = this.trackedStarIndex;
      let bestDistSq = Infinity;
      const limit = Math.min(this.activeParticleCount, this.animatedParticleLimit);
      for (let i = 0; i < limit; i += 7) {
        const i3 = i * 3;
        const dSq =
          Math.pow(this.particlePositions[i3] - this._tempVec3.x, 2) +
          Math.pow(this.particlePositions[i3 + 1] - this._tempVec3.y, 2) +
          Math.pow(this.particlePositions[i3 + 2] - this._tempVec3.z, 2);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
      if (bestDistSq < 1800) {
        this.trackedStarIndex = bestIdx;
        this.resetTrackedStarTrail();
      }
      this.triggerGravityWaveBurst(this._tempVec3.x, this._tempVec3.y, this._tempVec3.z, 0.75);
      return true;
    }
    return false;
  }

  private buildSingularity() {
    const coreGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.singularityMesh = new THREE.Mesh(coreGeo, coreMat);
    this.singularityMesh.userData = { cosmicType: 'singularity', index: 0 };

    const haloGeo = new THREE.SphereGeometry(1.65, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.singularityHalo = new THREE.Mesh(haloGeo, haloMat);
    this.singularityHalo.userData = { cosmicType: 'singularity', index: 0 };

    const inflationGeo = new THREE.SphereGeometry(1.0, 32, 32);
    const inflationMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.inflationSphere = new THREE.Mesh(inflationGeo, inflationMat);
    this.inflationSphere.visible = false;

    this.singularityGroup.add(this.singularityMesh, this.singularityHalo, this.inflationSphere);
  }

  private buildTrackedStarReticleAndSupernovaPool() {
    // 1. Scientific 3D Spectroscopic Target Reticle for the Persistent Tracked Star
    this.trackedStarMarker = new THREE.Group();
    this.trackedStarMarker.name = 'TrackedStarReticle';

    const outerGeo = new THREE.RingGeometry(1.65, 1.95, 32);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.trackedStarOuterRing = new THREE.Mesh(outerGeo, outerMat);

    const innerGeo = new THREE.RingGeometry(0.65, 0.88, 24);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.trackedStarInnerRing = new THREE.Mesh(innerGeo, innerMat);

    this.trackedStarMarker.add(this.trackedStarOuterRing, this.trackedStarInnerRing);
    this.universeGroup.add(this.trackedStarMarker);

    // 2. Trajectory Trail Line showing the Tracked Star's path from the Big Bang into its galaxy
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.trackedStarTrailPositions, 3)
    );
    const trailMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    this.trackedStarTrail = new THREE.Line(trailGeo, trailMat);
    this.trackedStarTrail.frustumCulled = false;
    this.universeGroup.add(this.trackedStarTrail);

    // 3. Pool of 3D Expanding Supernova Shockwave Shells (Type II / Pair-Instability Remnants)
    const snGeo = new THREE.SphereGeometry(1.0, 24, 24);
    for (let s = 0; s < SUPERNOVA_POOL_SIZE; s++) {
      const snMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        wireframe: s % 2 === 1,
      });
      const mesh = new THREE.Mesh(snGeo, snMat);
      mesh.visible = false;
      this.universeGroup.add(mesh);
      this.supernovaPool.push({
        mesh,
        active: false,
        elapsed: 0,
        duration: 0.85,
        maxRadius: 11.0,
      });
    }
  }

  private spawnSupernovaShockwave(
    x: number,
    y: number,
    z: number,
    colorHex: number = 0x7dd3fc,
    maxRadius: number = 11.5
  ) {
    let slot = this.supernovaPool.find((s) => !s.active);
    if (!slot) {
      slot = this.supernovaPool[0];
    }
    slot.active = true;
    slot.elapsed = 0;
    slot.duration = 0.75 + Math.random() * 0.35;
    slot.maxRadius = maxRadius;
    slot.mesh.position.set(x, y, z);
    slot.mesh.scale.setScalar(0.4);
    slot.mesh.visible = true;
    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = 0.92;
  }

  private updateSupernovaShockwaves(dt: number) {
    for (let i = 0; i < this.supernovaPool.length; i++) {
      const sn = this.supernovaPool[i];
      if (!sn.active) continue;
      sn.elapsed += dt;
      const t = sn.elapsed / sn.duration;
      if (t >= 1.0) {
        sn.active = false;
        sn.mesh.visible = false;
        continue;
      }
      const easeOut = 1.0 - Math.pow(1.0 - t, 2.4);
      sn.mesh.scale.setScalar(0.5 + easeOut * sn.maxRadius);
      const mat = sn.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1.0 - t) * 0.82;
    }
  }

  private setHaloBasisFromTilt(haloIdx: number, tiltX: number, tiltZ: number) {
    const cosX = Math.cos(tiltX);
    const sinX = Math.sin(tiltX);
    const cosZ = Math.cos(tiltZ);
    const sinZ = Math.sin(tiltZ);

    this._tempU.set(cosZ, sinZ, 0).normalize();
    this._tempV.set(sinX * sinZ, -sinX * cosZ, cosX).normalize();
    this._tempAxis.set(-cosX * sinZ, cosX * cosZ, sinX).normalize();

    const h3 = haloIdx * 3;
    this.haloBasisU[h3] = this._tempU.x;
    this.haloBasisU[h3 + 1] = this._tempU.y;
    this.haloBasisU[h3 + 2] = this._tempU.z;

    this.haloBasisV[h3] = this._tempV.x;
    this.haloBasisV[h3 + 1] = this._tempV.y;
    this.haloBasisV[h3 + 2] = this._tempV.z;

    this.haloSpinAxis[h3] = this._tempAxis.x;
    this.haloSpinAxis[h3 + 1] = this._tempAxis.y;
    this.haloSpinAxis[h3 + 2] = this._tempAxis.z;
  }

  /**
   * Initializes the 64 Dark Matter + SMBH Halos and 48,000 persistent star/baryon parcels
   * with 3-generation stellar nucleosynthesis masses (Pop III -> Pop II -> Pop I).
   */
  private initializeGravityHalosAndParticles() {
    const primaryCount = COSMIC_GALAXIES.length;

    for (let g = 0; g < primaryCount; g++) {
      const spec = COSMIC_GALAXIES[g];
      const g3 = g * 3;
      this.haloPos[g3] = spec.posX;
      this.haloPos[g3 + 1] = spec.posY;
      this.haloPos[g3 + 2] = spec.posZ;
      this.haloVel[g3] = 0;
      this.haloVel[g3 + 1] = 0;
      this.haloVel[g3 + 2] = 0;

      this.haloMass[g] = 1850.0 * spec.radiusScale;
      this.haloScaleRadius[g] = 25.0 * spec.radiusScale;
      this.haloArmCount[g] = spec.armCount;
      this.haloRotationSpeed[g] = spec.rotationSpeed || 1.0;
      this.setHaloBasisFromTilt(g, spec.tiltX, spec.tiltZ);
    }

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let d = 0; d < DEEP_FIELD_GALAXY_COUNT; d++) {
      const h = primaryCount + d;
      const h3 = h * 3;

      const u = (d + 0.5) / DEEP_FIELD_GALAXY_COUNT;
      const inclination = Math.acos(1 - 2 * u);
      const azimuth = d * goldenAngle;
      const shellR = 96.0 + (d % 6) * 21.0 + Math.sin(d * 1.7) * 14.0;
      const webCompression = 0.68 + 0.32 * Math.cos(azimuth * 2.0);

      this.haloPos[h3] = Math.sin(inclination) * Math.cos(azimuth) * shellR;
      this.haloPos[h3 + 1] = Math.cos(inclination) * shellR * 0.52 * webCompression;
      this.haloPos[h3 + 2] = Math.sin(inclination) * Math.sin(azimuth) * shellR;
      this.haloVel[h3] = 0;
      this.haloVel[h3 + 1] = 0;
      this.haloVel[h3 + 2] = 0;

      const radius = 9.0 + (d % 5) * 3.8;
      this.haloMass[h] = 720.0 + (d % 5) * 240.0;
      this.haloScaleRadius[h] = radius;
      this.haloArmCount[h] = 2 + (d % 3);
      this.haloRotationSpeed[h] = (d % 2 === 0 ? 1 : -1) * (0.75 + (d % 5) * 0.12);

      const tiltX = ((d * 43) % 100) * 0.031 - 1.5;
      const tiltZ = ((d * 71) % 100) * 0.031 - 1.5;
      this.setHaloBasisFromTilt(h, tiltX, tiltZ);
    }

    const primaryStarsLimit = this.animatedParticleLimit;
    const starsPerPrimary = Math.floor(primaryStarsLimit / primaryCount);

    for (let i = 0; i < this.maxParticles; i++) {
      const i3 = i * 3;
      let hIdx = 0;
      let localStarIdx = i;
      let totalInHalo = starsPerPrimary;

      if (i < primaryStarsLimit) {
        hIdx = Math.min(primaryCount - 1, Math.floor(i / starsPerPrimary));
        localStarIdx = i % starsPerPrimary;
        totalInHalo = starsPerPrimary;
      } else {
        hIdx = primaryCount + ((i - primaryStarsLimit) % DEEP_FIELD_GALAXY_COUNT);
        localStarIdx = Math.floor((i - primaryStarsLimit) / DEEP_FIELD_GALAXY_COUNT);
        totalInHalo = Math.ceil((this.maxParticles - primaryStarsLimit) / DEEP_FIELD_GALAXY_COUNT);
      }

      this.particleHaloIndex[i] = hIdx;
      const h3 = hIdx * 3;
      const galRadius = this.haloScaleRadius[hIdx];
      const arms = this.haloArmCount[hIdx];

      const armIndex = i % arms;
      const armBaseAngle = (armIndex / arms) * Math.PI * 2;
      const uFrac = (localStarIdx + 0.5) / Math.max(1, totalInHalo);
      const radialFrac =
        uFrac < 0.22 ? Math.pow(uFrac / 0.22, 1.45) * 0.18 : Math.pow(uFrac, 0.82);
      const radius = 1.35 + radialFrac * galRadius;
      const spiralTwist = Math.log(1.0 + radialFrac * 6.5) * 2.45;
      const rawSpread = ((i * 37) % 100) / 100 - 0.5;
      const armSpread = rawSpread * (0.26 + radialFrac * 0.48);
      const angle = armBaseAngle + spiralTwist + armSpread;

      this.particleRadialFrac[i] = radialFrac;
      this.particleTargetRadius[i] = radius;
      this.particleTargetAngle[i] = angle;
      this.particleTargetHeight[i] =
        ((((i * 53) % 100) / 100) - 0.5) * (2.2 * Math.exp(-radialFrac * 2.1));
      this.particleOrbitSpeed[i] =
        (0.42 / Math.sqrt(Math.max(1.8, radius))) *
        (0.88 + ((i % 17) / 17) * 0.24) *
        this.haloRotationSpeed[hIdx];

      // --- 3-GENERATION STELLAR NUCLEOSYNTHESIS MASSES (Pop III -> Pop II -> Pop I) ---
      const xi1 = (((i * 1103515245 + 12345) >>> 0) % 10000) / 10000;
      const xi2 = (((i * 214013 + 2531011) >>> 0) % 10000) / 10000;
      const ridgeProximity = Math.max(0.0, 1.0 - Math.abs(rawSpread) * 2.4);

      // Generation 1 (Pop III): Primordial metal-free H/He stars have high Jeans mass (18 - 65 M_sun)
      this.particleInitialPop3Mass[i] = 16.0 + Math.pow(xi1, 1.2) * 32.0;

      // Generation 2 (Pop II): Formed from Pop III supernova ejecta (2.5 - 16 M_sun in disk, 0.6 - 2.2 in halo)
      this.particlePop2Mass[i] =
        radialFrac < 0.25 ? 0.8 + xi1 * 2.4 : 3.2 + Math.pow(xi2, 1.4) * 11.5;

      // Generation 3 (Pop I): Present-day metal-rich stars with terrestrial planetary systems
      let pop1Mass = 1.0;
      let birthEpochGyr = 2.0;

      if (radialFrac < 0.22) {
        birthEpochGyr = 0.25 + xi2 * 2.2;
        if (xi1 < 0.24) {
          const targetAge = 13.8 - birthEpochGyr;
          const rgMass = Math.pow(targetAge / 9.8, -1.0 / 1.65);
          pop1Mass = rgMass * (0.96 + 0.08 * xi2);
        } else {
          pop1Mass = 0.35 + Math.pow(xi1, 1.4) * 0.82;
        }
      } else if (radialFrac < 0.78 && ridgeProximity > 0.42) {
        birthEpochGyr = 11.2 + xi2 * 2.55;
        pop1Mass = 1.65 + Math.pow(xi1, 1.85) * (12.0 + 18.0 * ridgeProximity);
      } else {
        birthEpochGyr = 1.5 + xi2 * 9.5;
        if (xi1 < 0.14) {
          const targetAge = Math.max(1.5, 13.8 - birthEpochGyr);
          pop1Mass = Math.pow(targetAge / 9.8, -1.0 / 1.65);
        } else {
          pop1Mass = 0.45 + Math.pow(xi1, 1.5) * 1.85;
        }
      }

      this.particlePop1Mass[i] = THREE.MathUtils.clamp(pop1Mass, 0.15, 36.0);
      this.particleStellarMass[i] = this.particlePop1Mass[i];
      this.particleBirthEpochGyr[i] = THREE.MathUtils.clamp(birthEpochGyr, 0.15, 13.72);
      this.particleGeneration[i] = 3;
      this.particleSupernovaCount[i] = 2;
      this.particleMetallicityZ[i] = 0.014 + radialFrac * 0.012;

      this.particleBaseSizes[i] =
        (radialFrac < 0.16 ? 1.55 : 0.72) +
        Math.min(1.65, Math.pow(this.particlePop1Mass[i], 0.36) * 0.42);
      this.particleSizes[i] = this.particleBaseSizes[i];

      const fibPhi = Math.acos(1 - (2 * ((i * 7919) % this.maxParticles + 0.5)) / this.maxParticles);
      const fibTheta = i * goldenAngle;
      const isoX = Math.sin(fibPhi) * Math.cos(fibTheta);
      const isoY = Math.cos(fibPhi);
      const isoZ = Math.sin(fibPhi) * Math.sin(fibTheta);

      const haloDist = Math.max(1.0, Math.hypot(this.haloPos[h3], this.haloPos[h3 + 1], this.haloPos[h3 + 2]));
      const dirToHaloX = this.haloPos[h3] / haloDist;
      const dirToHaloY = this.haloPos[h3 + 1] / haloDist;
      const dirToHaloZ = this.haloPos[h3 + 2] / haloDist;

      const speed = 58.0 + ((i * 193) % 100) * 1.15 + (hIdx >= primaryCount ? 48.0 : 0.0);
      this.particleInitialVel[i3] = (isoX * 0.58 + dirToHaloX * 0.42) * speed;
      this.particleInitialVel[i3 + 1] = (isoY * 0.58 + dirToHaloY * 0.42) * speed;
      this.particleInitialVel[i3 + 2] = (isoZ * 0.58 + dirToHaloZ * 0.42) * speed;

      this.particlePositions[i3] = 0;
      this.particlePositions[i3 + 1] = 0;
      this.particlePositions[i3 + 2] = 0;

      this.particleVelocities[i3] = this.particleInitialVel[i3];
      this.particleVelocities[i3 + 1] = this.particleInitialVel[i3 + 1];
      this.particleVelocities[i3 + 2] = this.particleInitialVel[i3 + 2];

      this.particleColors[i3] = 1.0;
      this.particleColors[i3 + 1] = 1.0;
      this.particleColors[i3 + 2] = 1.0;
    }

    this.recomputeStellarColorsForCosmicAge(13.8, false);

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));
    particleGeo.setAttribute('aSize', new THREE.BufferAttribute(this.particleSizes, 1));
    particleGeo.setDrawRange(0, this.activeParticleCount);

    const particleMat = new THREE.ShaderMaterial({
      vertexShader: STAR_PARTICLE_VERTEX_SHADER,
      fragmentShader: STAR_PARTICLE_FRAGMENT_SHADER,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particlePoints = new THREE.Points(particleGeo, particleMat);
    this.particlePoints.frustumCulled = false;
    this.universeGroup.add(this.particlePoints);

    COSMIC_GALAXIES.forEach((galaxy, index) => {
      const gNode = this.createGalaxyBlackHoleNode(galaxy, index);
      gNode.visible = false;
      this.galaxyNodes.push(gNode);
      this.universeGroup.add(gNode);
    });
  }

  /**
   * Resets all 48,000 persistent stars back to the central Big Bang singularity (0, 0, 0)
   * as Generation 1 (Population III) primordial H/He gas parcels ($Z = 0.0000$).
   */
  public resetBigBangSimulation() {
    this.bigBangElapsed = 0;
    this.flashIntensity = 1.0;
    this.genesisEpoch = 'inflation';
    this.coalescencePercent = 0;
    this.totalSupernovae = 0;
    this.meanMetallicitySolar = 0.0;
    this.trackedStarLastGen = 1;

    for (let i = 0; i < this.maxParticles; i++) {
      const i3 = i * 3;
      const qR = 0.08 + ((i % 13) / 13) * 0.25;
      const vx = this.particleInitialVel[i3];
      const vy = this.particleInitialVel[i3 + 1];
      const vz = this.particleInitialVel[i3 + 2];
      const vMag = Math.max(1.0, Math.hypot(vx, vy, vz));

      this.particlePositions[i3] = (vx / vMag) * qR;
      this.particlePositions[i3 + 1] = (vy / vMag) * qR;
      this.particlePositions[i3 + 2] = (vz / vMag) * qR;

      this.particleVelocities[i3] = vx;
      this.particleVelocities[i3 + 1] = vy;
      this.particleVelocities[i3 + 2] = vz;

      // Start at T = 0 as Generation 1 (Pop III primordial metal-free massive star progenitors)
      this.particleGeneration[i] = 1;
      this.particleSupernovaCount[i] = 0;
      this.particleMetallicityZ[i] = 0.0;
      this.particleStellarMass[i] = this.particleInitialPop3Mass[i];
      this.particleStellarAgeGyr[i] = 0.01;

      this.particleColors[i3] = 1.0;
      this.particleColors[i3 + 1] = 1.0;
      this.particleColors[i3 + 2] = 1.0;
    }

    this.resetTrackedStarTrail();

    const posAttr = this.particlePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.particlePoints.geometry.getAttribute('color') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  private createGalaxyBlackHoleNode(galaxy: CosmicGalaxySpec, index: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(galaxy.posX, galaxy.posY, galaxy.posZ);
    group.rotation.set(galaxy.tiltX, 0, galaxy.tiltZ);

    const ehRadius = 2.0 * galaxy.radiusScale;
    const ehGeo = new THREE.SphereGeometry(ehRadius, 32, 32);
    const ehMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const ehMesh = new THREE.Mesh(ehGeo, ehMat);
    group.add(ehMesh);

    const diskGeo = new THREE.RingGeometry(ehRadius * 1.15, ehRadius * 3.4, 64);
    const diskMat = new THREE.MeshBasicMaterial({
      color: galaxy.coreColorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const diskMesh = new THREE.Mesh(diskGeo, diskMat);
    diskMesh.rotation.x = Math.PI * 0.44;
    group.add(diskMesh);
    this.blackHoleAccretionDisks.push(diskMesh);

    const uTime = { value: 0 };
    this.blackHoleShaderUniforms.push({ uTime });
    const lensGeo = new THREE.PlaneGeometry(ehRadius * 9.0, ehRadius * 9.0);
    const lensMat = new THREE.ShaderMaterial({
      vertexShader: BLACK_HOLE_LENSING_VERTEX_SHADER,
      fragmentShader: BLACK_HOLE_LENSING_FRAGMENT_SHADER,
      uniforms: {
        uTime,
        uCoreColor: { value: new THREE.Color(galaxy.coreColorHex) },
        uArmColor: { value: new THREE.Color(galaxy.armColorHex) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    group.add(lensMesh);
    this.blackHoleLensingDisps.push(lensMesh);

    const galaxyRadius = 26 * galaxy.radiusScale;
    const hitGeo = new THREE.SphereGeometry(galaxyRadius * 0.85, 16, 16);
    const hitMat = new THREE.MeshBasicMaterial({
      color: galaxy.armColorHex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.userData = { cosmicType: 'galaxy', index };
    group.add(hitMesh);

    return group;
  }

  public populateGalaxyView(galaxyIndex: number) {
    this.clearGroup(this.galaxyViewGroup);
    this.starNodes = [];

    const galaxy = COSMIC_GALAXIES[galaxyIndex] || COSMIC_GALAXIES[0];

    const centerBH = this.createDetailedBlackHole(
      galaxy.coreColorHex,
      galaxy.armColorHex,
      4.0 * galaxy.radiusScale
    );
    this.galaxyViewGroup.add(centerBH);

    for (let r = 12; r <= 36; r += 12) {
      const ringGeo = new THREE.RingGeometry(r - 0.08, r + 0.08, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: galaxy.armColorHex,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      this.galaxyViewGroup.add(ring);
    }

    galaxy.starSystems.forEach((star, idx) => {
      const sGroup = new THREE.Group();
      sGroup.position.set(star.localX * 2.2, star.localY * 2.2, star.localZ * 2.2);

      const coreGeo = new THREE.SphereGeometry(2.1 * star.starScale, 32, 32);
      const coreMat = new THREE.MeshBasicMaterial({ color: star.starColorHex });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      sGroup.add(coreMesh);

      const coronaGeo = new THREE.SphereGeometry(4.4 * star.starScale, 32, 32);
      const coronaMat = new THREE.MeshBasicMaterial({
        color: star.coronaHex,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
      sGroup.add(coronaMesh);

      const orbitRingGeo = new THREE.RingGeometry(5.2 * star.starScale, 5.45 * star.starScale, 48);
      const orbitRingMat = new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
      orbitRing.rotation.x = Math.PI / 2;
      sGroup.add(orbitRing);

      const hitGeo = new THREE.SphereGeometry(8.5, 16, 16);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { cosmicType: 'star', index: idx };
      sGroup.add(hitMesh);

      this.starNodes.push(sGroup);
      this.galaxyViewGroup.add(sGroup);
    });
  }

  public populateStarSystemView(galaxyIndex: number, starIndex: number) {
    this.clearGroup(this.starSystemGroup);
    this.planetNodes = [];
    this.currentActiveGalaxyIndex = galaxyIndex;
    this.currentActiveStarIndex = starIndex;

    const galaxy = COSMIC_GALAXIES[galaxyIndex] || COSMIC_GALAXIES[0];
    const star = galaxy.starSystems[starIndex] || galaxy.starSystems[0];

    // 1. Central Star & Corona Photosphere
    const starGeo = new THREE.SphereGeometry(4.0 * star.starScale, 48, 48);
    const starMat = new THREE.MeshBasicMaterial({ color: star.starColorHex });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    this.starSystemGroup.add(starMesh);

    const coronaGeo = new THREE.SphereGeometry(7.0 * star.starScale, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: star.coronaHex,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    this.starSystemGroup.add(coronaMesh);

    const pointLight = new THREE.PointLight(star.starColorHex, 3.2, 260);
    this.starSystemGroup.add(pointLight);
    const ambient = new THREE.AmbientLight(0x94a3b8, 0.6);
    this.starSystemGroup.add(ambient);

    // 2. Planets (Rocky Worlds, Habitable Sanctuaries, Gas Giants & Ice Giants)
    star.planets.forEach((planet, idx) => {
      const scaledOrbitR = planet.orbitRadius * 2.0;
      const trackGeo = new THREE.RingGeometry(scaledOrbitR - 0.08, scaledOrbitR + 0.08, 128);
      const trackMat = new THREE.MeshBasicMaterial({
        color: planet.atmosphereHex,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const trackMesh = new THREE.Mesh(trackGeo, trackMat);
      trackMesh.rotation.x = Math.PI / 2;
      this.starSystemGroup.add(trackMesh);

      const orbitGroup = new THREE.Group();
      const meshGroup = new THREE.Group();
      const startAngle = idx * 1.85 + 0.5;
      meshGroup.position.set(
        Math.cos(startAngle) * scaledOrbitR,
        0,
        Math.sin(startAngle) * scaledOrbitR
      );

      const pRadius = 1.9 * planet.size;
      const planetType = planet.planetType || (planet.hasRings ? 'gas_giant' : 'habitable');

      if (planetType === 'rocky') {
        // Cratered, silicate/basalt terrestrial planet
        const rockyGeo = new THREE.IcosahedronGeometry(pRadius, 3);
        const rockyMat = new THREE.MeshStandardMaterial({
          color: planet.colorHex,
          roughness: 0.88,
          metalness: 0.18,
        });
        const rockyMesh = new THREE.Mesh(rockyGeo, rockyMat);
        meshGroup.add(rockyMesh);

        // Dark basalt caldera patches
        const calderaGeo = new THREE.IcosahedronGeometry(pRadius * 1.01, 1);
        const calderaMat = new THREE.MeshStandardMaterial({
          color: planet.continentHex,
          roughness: 0.95,
        });
        const calderaMesh = new THREE.Mesh(calderaGeo, calderaMat);
        calderaMesh.scale.set(0.98, 0.92, 1.02);
        meshGroup.add(calderaMesh);

        // Very thin tenuous exosphere
        const thinAtmoGeo = new THREE.SphereGeometry(pRadius * 1.06, 24, 24);
        const thinAtmoMat = new THREE.MeshBasicMaterial({
          color: planet.atmosphereHex,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        meshGroup.add(new THREE.Mesh(thinAtmoGeo, thinAtmoMat));
      } else if (planetType === 'gas_giant') {
        // Massive Jovian gas giant with distinct atmospheric storm cloud bands
        const gasGeo = new THREE.SphereGeometry(pRadius, 48, 48);
        const gasMat = new THREE.MeshStandardMaterial({
          color: planet.colorHex,
          roughness: 0.52,
          metalness: 0.05,
        });
        meshGroup.add(new THREE.Mesh(gasGeo, gasMat));

        // Equatorial & tropical atmospheric bands
        const bandGeo = new THREE.SphereGeometry(pRadius * 1.008, 40, 20);
        const bandMat = new THREE.MeshStandardMaterial({
          color: planet.continentHex,
          roughness: 0.65,
          transparent: true,
          opacity: 0.62,
        });
        const bandMesh = new THREE.Mesh(bandGeo, bandMat);
        bandMesh.scale.set(1.03, 0.65, 1.03);
        meshGroup.add(bandMesh);

        // Deep haze halo
        const hazeGeo = new THREE.SphereGeometry(pRadius * 1.12, 32, 32);
        const hazeMat = new THREE.MeshBasicMaterial({
          color: planet.atmosphereHex,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        meshGroup.add(new THREE.Mesh(hazeGeo, hazeMat));

        if (planet.hasRings && planet.ringColorHex) {
          const pRingGeo = new THREE.RingGeometry(pRadius * 1.45, pRadius * 2.5, 96);
          const pRingMat = new THREE.MeshBasicMaterial({
            color: planet.ringColorHex,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
          });
          const pRing = new THREE.Mesh(pRingGeo, pRingMat);
          pRing.rotation.x = Math.PI * 0.36;
          meshGroup.add(pRing);
        }
      } else if (planetType === 'ice_giant') {
        // Azure / methane ice giant with high-altitude cryo-cirrus
        const iceGeo = new THREE.SphereGeometry(pRadius, 40, 40);
        const iceMat = new THREE.MeshStandardMaterial({
          color: planet.colorHex,
          roughness: 0.38,
          metalness: 0.08,
        });
        meshGroup.add(new THREE.Mesh(iceGeo, iceMat));

        const cryoAtmoGeo = new THREE.SphereGeometry(pRadius * 1.14, 32, 32);
        const cryoAtmoMat = new THREE.MeshBasicMaterial({
          color: planet.atmosphereHex,
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        meshGroup.add(new THREE.Mesh(cryoAtmoGeo, cryoAtmoMat));

        if (planet.hasRings && planet.ringColorHex) {
          const pRingGeo = new THREE.RingGeometry(pRadius * 1.35, pRadius * 2.2, 80);
          const pRingMat = new THREE.MeshBasicMaterial({
            color: planet.ringColorHex,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
          });
          const pRing = new THREE.Mesh(pRingGeo, pRingMat);
          pRing.rotation.x = Math.PI * 0.42;
          meshGroup.add(pRing);
        }
      } else {
        // Habitable sanctuary world (oceans, continents, atmosphere)
        const oceanGeo = new THREE.SphereGeometry(pRadius, 36, 36);
        const oceanMat = new THREE.MeshStandardMaterial({
          color: planet.colorHex,
          roughness: 0.42,
          metalness: 0.12,
        });
        meshGroup.add(new THREE.Mesh(oceanGeo, oceanMat));

        const contGeo = new THREE.IcosahedronGeometry(pRadius * 1.015, 2);
        const contMat = new THREE.MeshStandardMaterial({
          color: planet.continentHex,
          roughness: 0.82,
        });
        const contMesh = new THREE.Mesh(contGeo, contMat);
        contMesh.scale.set(1.03, 0.9, 0.97);
        meshGroup.add(contMesh);

        const atmoGeo = new THREE.SphereGeometry(pRadius * 1.15, 32, 32);
        const atmoMat = new THREE.MeshBasicMaterial({
          color: planet.atmosphereHex,
          transparent: true,
          opacity: 0.24,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        meshGroup.add(new THREE.Mesh(atmoGeo, atmoMat));

        if (planet.hasRings && planet.ringColorHex) {
          const pRingGeo = new THREE.RingGeometry(pRadius * 1.45, pRadius * 2.35, 64);
          const pRingMat = new THREE.MeshBasicMaterial({
            color: planet.ringColorHex,
            transparent: true,
            opacity: 0.58,
            side: THREE.DoubleSide,
          });
          const pRing = new THREE.Mesh(pRingGeo, pRingMat);
          pRing.rotation.x = Math.PI * 0.38;
          meshGroup.add(pRing);
        }
      }

      // Invisible raycast hit sphere
      const hitGeo = new THREE.SphereGeometry(Math.max(5.5, pRadius * 2.4), 16, 16);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { cosmicType: 'planet', index: idx };
      meshGroup.add(hitMesh);

      orbitGroup.add(meshGroup);
      this.starSystemGroup.add(orbitGroup);

      this.planetNodes.push({
        orbitGroup,
        meshGroup,
        orbitRadius: scaledOrbitR,
        orbitSpeed: planet.orbitSpeed,
        semiMajorAu: planet.semiMajorAu || (planet.orbitRadius / 9.0),
        planetType,
        name: planet.name,
        specIndex: idx,
        angle: startAngle,
      });
    });

    // 3. 3D Main Asteroid Belt (orbiting between inner terrestrial and outer Jovian planets)
    const beltSpec = star.asteroidBelt || {
      id: `${star.id}_belt`,
      name: `${star.name} Asteroid Belt`,
      subtitle: 'Main Belt Planetesimals',
      semiMajorAu: 2.8,
      widthAu: 0.8,
      rockCount: 360,
      orbitalPeriodYears: 4.69,
      colorHex: 0xd6d3d1,
    };

    const beltRadius = beltSpec.semiMajorAu * 4.8; // ~13.44 world units

    // Belt orbital track hairline
    const beltTrackGeo = new THREE.RingGeometry(beltRadius - 0.75, beltRadius + 0.75, 96);
    const beltTrackMat = new THREE.MeshBasicMaterial({
      color: beltSpec.colorHex,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beltTrackMesh = new THREE.Mesh(beltTrackGeo, beltTrackMat);
    beltTrackMesh.rotation.x = Math.PI / 2;
    this.starSystemGroup.add(beltTrackMesh);

    // 3D Instanced Rock Boulders
    this.asteroidBeltGroup = new THREE.Group();
    const rockCount = Math.min(280, beltSpec.rockCount);
    const rockGeo = new THREE.DodecahedronGeometry(0.32, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: beltSpec.colorHex,
      roughness: 0.92,
      metalness: 0.12,
    });
    const rockInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    const dummy = new THREE.Object3D();

    for (let r = 0; r < rockCount; r++) {
      const radiusOffset = ((r * 17) % 100 - 50) / 50 * 1.4;
      const rockR = beltRadius + radiusOffset;
      const rockAngle = (r / rockCount) * Math.PI * 2 + (((r * 31) % 50) / 50) * 0.12;
      const rockY = (((r * 43) % 100 - 50) / 50) * 0.65;
      const rockScale = 0.45 + (((r * 23) % 100) / 100) * 0.9;

      dummy.position.set(
        Math.cos(rockAngle) * rockR,
        rockY,
        Math.sin(rockAngle) * rockR
      );
      dummy.rotation.set(
        (r * 0.7) % Math.PI,
        (r * 1.3) % Math.PI,
        (r * 0.5) % Math.PI
      );
      dummy.scale.set(
        rockScale * (0.8 + ((r % 5) / 10)),
        rockScale,
        rockScale * (0.85 + ((r % 7) / 10))
      );
      dummy.updateMatrix();
      rockInstanced.setMatrixAt(r, dummy.matrix);
    }
    rockInstanced.instanceMatrix.needsUpdate = true;
    this.asteroidBeltGroup.add(rockInstanced);

    // Fine glittering dust & planetesimal glints
    const dustCount = 360;
    const dustPos = new Float32Array(dustCount * 3);
    for (let d = 0; d < dustCount; d++) {
      const dOffset = (((d * 19) % 100 - 50) / 50) * 1.7;
      const dRadius = beltRadius + dOffset;
      const dAngle = (d / dustCount) * Math.PI * 2;
      const dY = (((d * 37) % 100 - 50) / 50) * 0.8;
      dustPos[d * 3] = Math.cos(dAngle) * dRadius;
      dustPos[d * 3 + 1] = dY;
      dustPos[d * 3 + 2] = Math.sin(dAngle) * dRadius;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 1.8,
      color: beltSpec.colorHex,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    this.asteroidBeltGroup.add(dustPoints);

    // Invisible raycast hit torus for clicking or inspecting the asteroid belt
    const beltHitGeo = new THREE.TorusGeometry(beltRadius, 1.8, 8, 48);
    beltHitGeo.rotateX(Math.PI / 2);
    const beltHitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.asteroidBeltHitMesh = new THREE.Mesh(beltHitGeo, beltHitMat);
    this.asteroidBeltHitMesh.userData = { cosmicType: 'asteroid_belt', index: 0 };
    this.starSystemGroup.add(this.asteroidBeltHitMesh);

    this.starSystemGroup.add(this.asteroidBeltGroup);
  }

  public populatePlanetOrbitView(galaxyIndex: number, starIndex: number, planetIndex: number) {
    this.clearGroup(this.planetOrbitGroup);
    this.orbitGlobeGroup = new THREE.Group();
    this.landingBeaconMeshes = [];

    const galaxy = COSMIC_GALAXIES[galaxyIndex] || COSMIC_GALAXIES[0];
    const star = galaxy.starSystems[starIndex] || galaxy.starSystems[0];
    const planet = star.planets[planetIndex] || star.planets[0];

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
    sunLight.position.set(38, 22, 42);
    this.planetOrbitGroup.add(sunLight);
    this.planetOrbitGroup.add(new THREE.AmbientLight(planet.atmosphereHex, 0.65));

    const globeRadius = 11.0;

    const oceanGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: planet.colorHex,
      roughness: 0.35,
      metalness: 0.15,
    });
    this.orbitGlobeGroup.add(new THREE.Mesh(oceanGeo, oceanMat));

    for (let i = 0; i < 9; i++) {
      const lat = ((i * 37) % 120) - 60;
      const lon = (i * 83) % 360;
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;

      const landGeo = new THREE.IcosahedronGeometry(globeRadius * (0.26 + (i % 3) * 0.07), 3);
      const landMat = new THREE.MeshStandardMaterial({
        color: planet.continentHex,
        roughness: 0.86,
      });
      const landMesh = new THREE.Mesh(landGeo, landMat);
      const dist = globeRadius * 0.85;
      landMesh.position.set(
        dist * Math.cos(latRad) * Math.cos(lonRad),
        dist * Math.sin(latRad),
        dist * Math.cos(latRad) * Math.sin(lonRad)
      );
      landMesh.lookAt(0, 0, 0);
      landMesh.scale.set(1.32, 1.12, 0.42);
      this.orbitGlobeGroup.add(landMesh);
    }

    const cloudGeo = new THREE.SphereGeometry(globeRadius * 1.028, 48, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      roughness: 1.0,
      depthWrite: false,
    });
    this.orbitCloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.orbitGlobeGroup.add(this.orbitCloudMesh);

    const atmoGeo = new THREE.SphereGeometry(globeRadius * 1.12, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: planet.atmosphereHex,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.orbitGlobeGroup.add(new THREE.Mesh(atmoGeo, atmoMat));

    if (planet.hasRings && planet.ringColorHex) {
      const ringGeo = new THREE.RingGeometry(globeRadius * 1.45, globeRadius * 2.25, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: planet.ringColorHex,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI * 0.4;
      this.planetOrbitGroup.add(ringMesh);
    }

    planet.landingSpots.forEach((spot, idx) => {
      const latRad = (spot.lat * Math.PI) / 180;
      const lonRad = (spot.lon * Math.PI) / 180;
      const surfaceR = globeRadius * 1.035;

      const x = surfaceR * Math.cos(latRad) * Math.cos(lonRad);
      const y = surfaceR * Math.sin(latRad);
      const z = surfaceR * Math.cos(latRad) * Math.sin(lonRad);

      const beaconGroup = new THREE.Group();
      beaconGroup.position.set(x, y, z);

      this._tempVec3.set(x * 2, y * 2, z * 2);
      beaconGroup.lookAt(this._tempVec3);

      const ringGeo = new THREE.RingGeometry(0.65, 0.92, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: spot.biome.floraPaletteHexes?.[0] || 0x38bdf8,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      beaconGroup.add(ringMesh);

      const pillarGeo = new THREE.CylinderGeometry(0.08, 0.22, 1.8, 12);
      const pillarMat = new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.85,
      });
      const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
      pillarMesh.rotation.x = Math.PI / 2;
      pillarMesh.position.z = 0.9;
      beaconGroup.add(pillarMesh);

      const hitGeo = new THREE.SphereGeometry(2.8, 16, 16);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { cosmicType: 'landing', index: idx };
      beaconGroup.add(hitMesh);

      this.landingBeaconMeshes.push(beaconGroup);
      this.orbitGlobeGroup.add(beaconGroup);
    });

    this.planetOrbitGroup.add(this.orbitGlobeGroup);
  }

  private createDetailedBlackHole(coreColor: number, armColor: number, radius: number): THREE.Group {
    const group = new THREE.Group();

    const ehGeo = new THREE.SphereGeometry(radius, 32, 32);
    const ehMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    group.add(new THREE.Mesh(ehGeo, ehMat));

    const diskGeo = new THREE.RingGeometry(radius * 1.18, radius * 3.2, 64);
    const diskMat = new THREE.MeshBasicMaterial({
      color: coreColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = Math.PI * 0.38;
    group.add(disk);

    const uTime = { value: this.elapsedTime };
    this.blackHoleShaderUniforms.push({ uTime });
    const lensGeo = new THREE.PlaneGeometry(radius * 8.0, radius * 8.0);
    const lensMat = new THREE.ShaderMaterial({
      vertexShader: BLACK_HOLE_LENSING_VERTEX_SHADER,
      fragmentShader: BLACK_HOLE_LENSING_FRAGMENT_SHADER,
      uniforms: {
        uTime,
        uCoreColor: { value: new THREE.Color(coreColor) },
        uArmColor: { value: new THREE.Color(armColor) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    group.add(lensMesh);
    this.blackHoleLensingDisps.push(lensMesh);

    return group;
  }

  public syncStageVisibility(stage: CosmicStage) {
    this.rootGroup.visible = stage !== 'capy_selection' && stage !== 'playing';
    this.singularityGroup.visible = stage === 'singularity' || stage === 'big_bang';
    this.universeGroup.visible =
      stage === 'big_bang' ||
      stage === 'universe_flight' ||
      stage === 'galaxy_view' ||
      stage === 'star_system_view';
    this.galaxyViewGroup.visible = stage === 'galaxy_view';
    this.starSystemGroup.visible = stage === 'star_system_view';
    this.planetOrbitGroup.visible = stage === 'planet_orbit' || stage === 'planet_descent';

    const showTrackedReticle = stage === 'big_bang' || stage === 'universe_flight';
    this.trackedStarMarker.visible = showTrackedReticle;
    this.trackedStarTrail.visible = showTrackedReticle;

    this.clickableObjects.length = 0;

    if (stage === 'singularity') {
      this.clickableObjects.push(this.singularityMesh, this.singularityHalo);
      this.singularityMesh.visible = true;
      this.singularityHalo.visible = true;
      this.inflationSphere.visible = false;
      this.bigBangElapsed = 0;
      this.flashIntensity = 0;
      this.genesisEpoch = 'inflation';
      this.galaxyNodes.forEach((g) => {
        g.visible = false;
      });
    } else if (stage === 'big_bang') {
      this.resetBigBangSimulation();
      this.singularityMesh.visible = true;
      this.singularityHalo.visible = true;
      this.inflationSphere.visible = true;
      this.inflationSphere.scale.setScalar(1.0);
      this.galaxyNodes.forEach((g) => {
        g.visible = false;
      });
    } else if (stage === 'universe_flight') {
      this.flashIntensity = 0;
      this.inflationSphere.visible = false;
      this.singularityMesh.visible = false;
      this.singularityHalo.visible = false;
      this.genesisEpoch = 'virial_equilibrium';
      this.coalescencePercent = 100;
      this.settleParticlesIntoGalacticOrbits();
      this.galaxyNodes.forEach((g) => {
        g.visible = true;
        g.scale.setScalar(1.0);
        g.traverse((child) => {
          if (child.userData?.cosmicType === 'galaxy') {
            this.clickableObjects.push(child);
          }
        });
      });
    } else if (stage === 'galaxy_view') {
      this.galaxyNodes.forEach((g) => {
        g.visible = false;
      });
      this.starNodes.forEach((s) => {
        s.traverse((child) => {
          if (child.userData?.cosmicType === 'star') {
            this.clickableObjects.push(child);
          }
        });
      });
    } else if (stage === 'star_system_view') {
      this.galaxyNodes.forEach((g) => {
        g.visible = false;
      });
      this.planetNodes.forEach((p) => {
        p.meshGroup.traverse((child) => {
          if (child.userData?.cosmicType === 'planet') {
            this.clickableObjects.push(child);
          }
        });
      });
      if (this.asteroidBeltHitMesh) {
        this.clickableObjects.push(this.asteroidBeltHitMesh);
      }
    } else if (stage === 'planet_orbit') {
      this.landingBeaconMeshes.forEach((b) => {
        b.traverse((child) => {
          if (child.userData?.cosmicType === 'landing') {
            this.clickableObjects.push(child);
          }
        });
      });
    }
  }

  /**
   * Places all persistent stars on their rotating galactic disk trajectories at present-day cosmic age (13.8 Gyr)
   * after 2 prior generations of supernova nucleosynthesis have enriched the disk to Population I metallicity.
   */
  private settleParticlesIntoGalacticOrbits() {
    for (let i = 0; i < this.maxParticles; i++) {
      const rf = this.particleRadialFrac[i];
      this.particleGeneration[i] = rf < 0.22 ? 2 : 3;
      this.particleSupernovaCount[i] = rf < 0.22 ? 1 : 2;
      this.particleMetallicityZ[i] = rf < 0.22 ? 0.004 : 0.016 + rf * 0.012;
      this.particleStellarMass[i] = this.particlePop1Mass[i];
    }

    if (this.totalSupernovae < 1420) {
      this.totalSupernovae = 1840;
    }

    this.recomputeStellarColorsForCosmicAge(13.8, false);

    for (let i = 0; i < this.maxParticles; i++) {
      const i3 = i * 3;
      const h = this.particleHaloIndex[i];
      const h3 = h * 3;

      const r = this.particleTargetRadius[i];
      const ang = this.particleTargetAngle[i];
      const height = this.particleTargetHeight[i];

      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      const ux = this.haloBasisU[h3];
      const uy = this.haloBasisU[h3 + 1];
      const uz = this.haloBasisU[h3 + 2];

      const vx = this.haloBasisV[h3];
      const vy = this.haloBasisV[h3 + 1];
      const vz = this.haloBasisV[h3 + 2];

      const nx = this.haloSpinAxis[h3];
      const ny = this.haloSpinAxis[h3 + 1];
      const nz = this.haloSpinAxis[h3 + 2];

      this.particlePositions[i3] = this.haloPos[h3] + (ux * cosA + vx * sinA) * r + nx * height;
      this.particlePositions[i3 + 1] =
        this.haloPos[h3 + 1] + (uy * cosA + vy * sinA) * r + ny * height;
      this.particlePositions[i3 + 2] =
        this.haloPos[h3 + 2] + (uz * cosA + vz * sinA) * r + nz * height;

      const vCirc = this.particleOrbitSpeed[i] * r * 1.45;
      const tx = -ux * sinA + vx * cosA;
      const ty = -uy * sinA + vy * cosA;
      const tz = -uz * sinA + vz * cosA;

      this.particleVelocities[i3] = tx * vCirc;
      this.particleVelocities[i3 + 1] = ty * vCirc;
      this.particleVelocities[i3 + 2] = tz * vCirc;

      this.particleColors[i3] = this.particleMatureColors[i3];
      this.particleColors[i3 + 1] = this.particleMatureColors[i3 + 1];
      this.particleColors[i3 + 2] = this.particleMatureColors[i3 + 2];
    }

    this.updateTrackedStarMarkerAndTrail();

    const posAttr = this.particlePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.particlePoints.geometry.getAttribute('color') as THREE.BufferAttribute;
    const sizeAttr = this.particlePoints.geometry.getAttribute('aSize') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  }

  private updateTrackedStarMarkerAndTrail(camera?: THREE.Camera) {
    const i3 = this.trackedStarIndex * 3;
    const px = this.particlePositions[i3];
    const py = this.particlePositions[i3 + 1];
    const pz = this.particlePositions[i3 + 2];

    this.trackedStarMarker.position.set(px, py, pz);
    if (camera) {
      this.trackedStarMarker.lookAt(camera.position);
    }
    const pulse = 1.0 + 0.16 * Math.sin(this.elapsedTime * 6.5);
    this.trackedStarOuterRing.scale.setScalar(pulse);
    this.trackedStarInnerRing.rotation.z = -this.elapsedTime * 2.2;

    // Shift trail history and append current tracked star position
    for (let k = TRAIL_POINT_COUNT - 1; k > 0; k--) {
      const dst = k * 3;
      const src = (k - 1) * 3;
      this.trackedStarTrailPositions[dst] = this.trackedStarTrailPositions[src];
      this.trackedStarTrailPositions[dst + 1] = this.trackedStarTrailPositions[src + 1];
      this.trackedStarTrailPositions[dst + 2] = this.trackedStarTrailPositions[src + 2];
    }
    this.trackedStarTrailPositions[0] = px;
    this.trackedStarTrailPositions[1] = py;
    this.trackedStarTrailPositions[2] = pz;

    const trailAttr = this.trackedStarTrail.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    trailAttr.needsUpdate = true;
  }

  public getFlashIntensity(): number {
    return this.flashIntensity;
  }

  public tick(dt: number, stage: CosmicStage, camera: THREE.Camera): boolean {
    this.elapsedTime += dt;
    let shouldAdvanceToUniverseFlight = false;

    const instantFps = 1.0 / Math.max(0.001, dt);
    this.currentFps = this.currentFps * 0.9 + instantFps * 0.1;
    this.fpsMonitorTimer += dt;
    if (this.fpsMonitorTimer >= 0.25) {
      this.fpsMonitorTimer = 0;
      if (this.currentFps < 58 && this.activeParticleCount > 8000) {
        this.activeParticleCount = Math.max(8000, Math.floor(this.activeParticleCount * 0.88));
        this.particlePoints.geometry.setDrawRange(0, this.activeParticleCount);
      } else if (this.currentFps >= 59.5 && this.activeParticleCount < this.maxParticles) {
        this.activeParticleCount = Math.min(
          this.maxParticles,
          this.activeParticleCount + 3000
        );
        this.particlePoints.geometry.setDrawRange(0, this.activeParticleCount);
      }
    }

    for (let i = 0; i < this.blackHoleShaderUniforms.length; i++) {
      this.blackHoleShaderUniforms[i].uTime.value = this.elapsedTime;
    }
    for (let i = 0; i < this.blackHoleLensingDisps.length; i++) {
      const disp = this.blackHoleLensingDisps[i];
      if (disp.parent) {
        disp.lookAt(camera.position);
      }
    }
    for (let i = 0; i < this.blackHoleAccretionDisks.length; i++) {
      this.blackHoleAccretionDisks[i].rotation.z += dt * 1.4;
    }

    this.updateSupernovaShockwaves(dt);

    if (stage === 'singularity') {
      const pulse = 1.0 + Math.sin(this.elapsedTime * 4.5) * 0.16;
      this.singularityMesh.scale.setScalar(pulse);
      this.singularityHalo.scale.setScalar(pulse * 1.3);
      return false;
    }

    if (stage === 'big_bang') {
      shouldAdvanceToUniverseFlight = this.tickGravityFluidGalaxyFormation(dt, camera);
    } else if (stage === 'universe_flight') {
      this.updateRotatingGalaxyParticles(dt, camera);
    }

    if (stage === 'star_system_view') {
      const scaleSpec =
        ORBIT_TIME_SCALES.find((s) => s.id === this.orbitTimeScale) || ORBIT_TIME_SCALES[4];
      const effectiveMult = scaleSpec.multiplier;
      this.simElapsedSeconds += dt * effectiveMult;

      let baseEarthRadSec = 0;
      if (
        this.orbitTimeScale !== 'paused' &&
        Number.isFinite(scaleSpec.earthOrbitDurationSec) &&
        scaleSpec.earthOrbitDurationSec > 0
      ) {
        baseEarthRadSec = (Math.PI * 2) / scaleSpec.earthOrbitDurationSec;
      }

      for (let i = 0; i < this.planetNodes.length; i++) {
        const p = this.planetNodes[i];
        const semiMajor = Math.max(0.2, p.semiMajorAu || 1.0);
        // Kepler's Third Law: omega = omega_Earth * (a)^(-1.5)
        const keplerOmega = baseEarthRadSec * Math.pow(semiMajor, -1.5);
        p.angle += dt * keplerOmega;
        p.meshGroup.position.set(
          Math.cos(p.angle) * p.orbitRadius,
          0,
          Math.sin(p.angle) * p.orbitRadius
        );
        p.meshGroup.rotation.y += dt * 0.8;
      }

      if (this.asteroidBeltGroup) {
        const beltSemiMajor = 2.8;
        const beltKeplerOmega = baseEarthRadSec * Math.pow(beltSemiMajor, -1.5);
        this.asteroidBeltAngle += dt * beltKeplerOmega;
        this.asteroidBeltGroup.rotation.y = this.asteroidBeltAngle;
      }
    }

    if (stage === 'planet_orbit' || stage === 'planet_descent') {
      this.orbitGlobeGroup.rotation.y += dt * 0.12;
      if (this.orbitCloudMesh) {
        this.orbitCloudMesh.rotation.y += dt * 0.08;
      }
    }

    return shouldAdvanceToUniverseFlight;
  }

  /**
   * Real-time 3D N-Body Gravitational, Hydrodynamic Fluid & Multi-Generation Stellar Nucleosynthesis Simulation:
   * - Follows all 48,000 persistent star/baryon parcels (including `trackedStarIndex`) from T = 0:
   *   1. Gen 1 (Pop III, 0.3 - 1.6s): Massive primordial H/He stars ignite and detonate in Pair-Instability Supernovae,
   *      synthesizing first C, O, Mg, Si, Fe.
   *   2. Gen 2 (Pop II, 1.6 - 3.1s): Enriched gas collapses into dark-matter halos; massive Pop II stars detonate
   *      as Type II Supernovae, raising metallicity Z above the planet-formation threshold.
   *   3. Gen 3 (Pop I, 3.1 - 5.2s): Metal-rich disk stars & terrestrial planetary systems coalesce in rotating spiral arms.
   */
  private tickGravityFluidGalaxyFormation(dt: number, camera: THREE.Camera): boolean {
    const stepDt = Math.min(dt, 0.04);
    this.bigBangElapsed += stepDt;

    const posAttr = this.particlePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.particlePoints.geometry.getAttribute('color') as THREE.BufferAttribute;
    const sizeAttr = this.particlePoints.geometry.getAttribute('aSize') as THREE.BufferAttribute;

    if (this.bigBangElapsed < 0.65) {
      this.genesisEpoch = 'inflation';
      const t = this.bigBangElapsed / 0.65;
      this.inflationSphere.visible = true;
      this.inflationSphere.scale.setScalar(1.0 + t * t * 185.0);
      const infMat = this.inflationSphere.material as THREE.MeshBasicMaterial;
      infMat.opacity = t < 0.25 ? t / 0.25 : Math.max(0, 1.0 - (t - 0.25) / 0.75) * 0.85;

      this.flashIntensity =
        t < 0.22 ? (t / 0.22) * 0.92 : Math.max(0, 0.92 * (1.0 - (t - 0.22) / 0.78));
      this.singularityMesh.visible = t < 0.45;
      this.singularityHalo.visible = t < 0.6;
      this.singularityMesh.scale.setScalar(1.0 + t * 8.0);
      this.singularityHalo.scale.setScalar(1.0 + t * 16.0);
    } else {
      this.inflationSphere.visible = false;
      this.singularityMesh.visible = false;
      this.singularityHalo.visible = false;
      this.flashIntensity = Math.max(0, this.flashIntensity - stepDt * 2.2);

      if (this.bigBangElapsed < 2.25) {
        this.genesisEpoch = 'gravitational_collapse';
      } else {
        this.genesisEpoch = 'spiral_coalescence';
      }
    }

    const bhReveal = THREE.MathUtils.clamp((this.bigBangElapsed - 1.55) / 1.8, 0.0, 1.0);
    for (let g = 0; g < this.galaxyNodes.length; g++) {
      this.galaxyNodes[g].visible = bhReveal > 0.02;
      if (bhReveal > 0.02) {
        this.galaxyNodes[g].scale.setScalar(bhReveal);
      }
    }

    const gravityRamp =
      THREE.MathUtils.smoothstep(this.bigBangElapsed, 0.25, 1.75) * this.gravityMultiplier;
    const diskViscosityRamp =
      THREE.MathUtils.smoothstep(this.bigBangElapsed, 1.25, 3.6) * this.fluidViscosity;
    const colorCoolRamp = THREE.MathUtils.smoothstep(this.bigBangElapsed, 0.32, 1.65);
    const currentCosmicAgeGyr = Math.min(13.8, (this.bigBangElapsed / 5.1) * 13.8);
    this.coalescencePercent = Math.min(100, (this.bigBangElapsed / 5.1) * 100);

    // Spawn visual 3D Supernova Remnant Shockwaves during Pop III -> Pop II and Pop II -> Pop I epochs
    this.supernovaSpawnTimer += stepDt;
    if (this.bigBangElapsed > 0.85 && this.bigBangElapsed < 4.6 && this.supernovaSpawnTimer >= 0.14) {
      this.supernovaSpawnTimer = 0;
      const randStar = Math.floor(Math.random() * this.activeParticleCount);
      const r3 = randStar * 3;
      const isPop3Epoch = this.bigBangElapsed < 2.3;
      this.spawnSupernovaShockwave(
        this.particlePositions[r3],
        this.particlePositions[r3 + 1],
        this.particlePositions[r3 + 2],
        isPop3Epoch ? 0x38bdf8 : 0xfbbf24,
        isPop3Epoch ? 13.5 : 9.5
      );
      this.totalSupernovae += 28;
    }

    let speedSum = 0;
    let tempSum = 0;
    let ageSum = 0;
    let metalSum = 0;
    let obCount = 0;
    let giantCount = 0;
    const count = this.activeParticleCount;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const h = this.particleHaloIndex[i];
      const h3 = h * 3;

      let px = this.particlePositions[i3];
      let py = this.particlePositions[i3 + 1];
      let pz = this.particlePositions[i3 + 2];

      let vx = this.particleVelocities[i3];
      let vy = this.particleVelocities[i3 + 1];
      let vz = this.particleVelocities[i3 + 2];

      const dx = px - this.haloPos[h3];
      const dy = py - this.haloPos[h3 + 1];
      const dz = pz - this.haloPos[h3 + 2];

      const ux = this.haloBasisU[h3];
      const uy = this.haloBasisU[h3 + 1];
      const uz = this.haloBasisU[h3 + 2];

      const bx = this.haloBasisV[h3];
      const by = this.haloBasisV[h3 + 1];
      const bz = this.haloBasisV[h3 + 2];

      const nx = this.haloSpinAxis[h3];
      const ny = this.haloSpinAxis[h3 + 1];
      const nz = this.haloSpinAxis[h3 + 2];

      const localU = dx * ux + dy * uy + dz * uz;
      const localV = dx * bx + dy * by + dz * bz;
      const localZ = dx * nx + dy * ny + dz * nz;

      const targetAngle =
        this.particleTargetAngle[i] +
        stepDt * this.particleOrbitSpeed[i] * (0.4 + 1.05 * diskViscosityRamp);
      this.particleTargetAngle[i] = targetAngle;

      const targetR = this.particleTargetRadius[i];
      const targetH = this.particleTargetHeight[i];
      const cosA = Math.cos(targetAngle);
      const sinA = Math.sin(targetAngle);

      const eqX = this.haloPos[h3] + (ux * cosA + bx * sinA) * targetR + nx * targetH;
      const eqY = this.haloPos[h3 + 1] + (uy * cosA + by * sinA) * targetR + ny * targetH;
      const eqZ = this.haloPos[h3 + 2] + (uz * cosA + bz * sinA) * targetR + nz * targetH;

      const rSq = dx * dx + dy * dy + dz * dz + 28.0;
      const rDist = Math.sqrt(rSq);
      const gPull = (this.haloMass[h] * gravityRamp) / (rSq * rDist);
      let ax = -dx * gPull;
      let ay = -dy * gPull;
      let az = -dz * gPull;

      const planeR = Math.max(0.5, Math.hypot(localU, localV));
      const tangX = (-ux * localV + bx * localU) / planeR;
      const tangY = (-uy * localV + by * localU) / planeR;
      const tangZ = (-uz * localV + bz * localU) / planeR;
      const vCirc = this.particleOrbitSpeed[i] * targetR * 1.45;
      const swirlGain = 3.2 * gravityRamp;
      ax += (tangX * vCirc - vx * 0.35) * swirlGain;
      ay += (tangY * vCirc - vy * 0.35) * swirlGain;
      az += (tangZ * vCirc - vz * 0.35) * swirlGain;

      const spiralSpring = 5.8 * diskViscosityRamp * this.gravityMultiplier;
      ax += (eqX - px) * spiralSpring - nx * (localZ - targetH) * (6.5 * diskViscosityRamp);
      ay += (eqY - py) * spiralSpring - ny * (localZ - targetH) * (6.5 * diskViscosityRamp);
      az += (eqZ - pz) * spiralSpring - nz * (localZ - targetH) * (6.5 * diskViscosityRamp);

      const fluidDrag = Math.exp(-(1.4 + 2.8 * diskViscosityRamp) * stepDt);
      vx = (vx + ax * stepDt) * fluidDrag;
      vy = (vy + ay * stepDt) * fluidDrag;
      vz = (vz + az * stepDt) * fluidDrag;

      px += vx * stepDt;
      py += vy * stepDt;
      pz += vz * stepDt;

      if (diskViscosityRamp > 0.65) {
        const lockBlend = ((diskViscosityRamp - 0.65) / 0.35) * 4.5 * stepDt;
        px += (eqX - px) * lockBlend;
        py += (eqY - py) * lockBlend;
        pz += (eqZ - pz) * lockBlend;
      }

      this.particlePositions[i3] = px;
      this.particlePositions[i3 + 1] = py;
      this.particlePositions[i3 + 2] = pz;

      this.particleVelocities[i3] = vx;
      this.particleVelocities[i3 + 1] = vy;
      this.particleVelocities[i3 + 2] = vz;

      speedSum += Math.hypot(vx, vy, vz);

      // --- MULTI-GENERATION STELLAR EVOLUTION & SUPERNOVA NUCLEOSYNTHESIS ---
      const starPhaseShift = ((i % 29) / 29) * 0.55;
      const evolClock = this.bigBangElapsed + starPhaseShift;
      const radialFrac = this.particleRadialFrac[i];

      const isManuallyEnrichedTracked =
        i === this.trackedStarIndex &&
        this.particleGeneration[i] > (evolClock < 1.65 ? 1 : evolClock < 3.15 ? 2 : 3);

      if (isManuallyEnrichedTracked) {
        this.particleStellarAgeGyr[i] += dt * 0.45;
      } else if (evolClock < 1.65) {
        // Generation 1: Population III (Metal-free primordial massive blue stars)
        this.particleGeneration[i] = 1;
        this.particleSupernovaCount[i] = 0;
        this.particleMetallicityZ[i] = 0.0;
        this.particleStellarMass[i] = this.particleInitialPop3Mass[i];
        this.particleStellarAgeGyr[i] = Math.max(0.01, evolClock * 0.35);
      } else if (evolClock < 3.15) {
        // Generation 2: Population II (Formed from Pop III Supernova ejecta; C/O/Mg/Fe enriched)
        if (i === this.trackedStarIndex && this.trackedStarLastGen < 2) {
          this.trackedStarLastGen = 2;
          this.spawnSupernovaShockwave(px, py, pz, 0x38bdf8, 16.0);
        }
        this.particleGeneration[i] = 2;
        this.particleSupernovaCount[i] = Math.max(this.particleSupernovaCount[i], 1);
        this.particleMetallicityZ[i] = Math.max(
          this.particleMetallicityZ[i],
          0.0038 + radialFrac * 0.0025
        );
        this.particleStellarMass[i] = this.particlePop2Mass[i];
        this.particleStellarAgeGyr[i] = Math.max(0.05, (evolClock - 1.65) * 1.8);
      } else {
        // Generation 3: Population I (Formed from Pop II Type II/Ia Supernovae; rocky planet disk host!)
        if (i === this.trackedStarIndex && this.trackedStarLastGen < 3) {
          this.trackedStarLastGen = 3;
          this.spawnSupernovaShockwave(px, py, pz, 0xfbbf24, 15.0);
        }
        this.particleGeneration[i] = 3;
        this.particleSupernovaCount[i] = Math.max(this.particleSupernovaCount[i], 2);
        this.particleMetallicityZ[i] = Math.max(
          this.particleMetallicityZ[i],
          0.014 + radialFrac * 0.012
        );
        this.particleStellarMass[i] = this.particlePop1Mass[i];
        const birthGyr = this.particleBirthEpochGyr[i] * 0.65;
        this.particleStellarAgeGyr[i] = Math.max(0.05, currentCosmicAgeGyr - birthGyr);
      }

      const massSolar = this.particleStellarMass[i];
      const starAgeGyr = this.particleStellarAgeGyr[i];

      const effTempK = this.evaluateStarColorAndEvolution(
        i,
        massSolar,
        starAgeGyr,
        radialFrac,
        this.stellarColorMode
      );

      tempSum += effTempK;
      ageSum += starAgeGyr;
      metalSum += this.particleMetallicityZ[i];
      if (effTempK >= 10000.0) obCount++;
      if (effTempK <= 4350.0 && massSolar >= 0.75) giantCount++;

      this.particleColors[i3] = 1.0 + (this._rgbScratch[0] - 1.0) * colorCoolRamp;
      this.particleColors[i3 + 1] = 1.0 + (this._rgbScratch[1] - 1.0) * colorCoolRamp;
      this.particleColors[i3 + 2] = 1.0 + (this._rgbScratch[2] - 1.0) * colorCoolRamp;
    }

    this.meanVelocityKmS = (speedSum / Math.max(1, count)) * 18.5;
    this.meanTempKelvin = tempSum / Math.max(1, count);
    this.meanStellarAgeGyr = ageSum / Math.max(1, count);
    this.meanMetallicitySolar = (metalSum / Math.max(1, count)) / 0.014;
    this.obStarPercent = (obCount / Math.max(1, count)) * 100;
    this.redGiantPercent = (giantCount / Math.max(1, count)) * 100;

    this.updateTrackedStarMarkerAndTrail(camera);

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    if (this.bigBangElapsed >= 5.15) {
      this.genesisEpoch = 'virial_equilibrium';
      this.coalescencePercent = 100;
      return true;
    }

    return false;
  }

  private updateRotatingGalaxyParticles(dt: number, camera: THREE.Camera) {
    const posAttr = this.particlePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const countToUpdate = Math.min(this.activeParticleCount, this.animatedParticleLimit);
    let speedSum = 0;

    // Occasional deep-space Type II Supernova in spiral arms during universe flight
    this.supernovaSpawnTimer += dt;
    if (this.supernovaSpawnTimer >= 1.2) {
      this.supernovaSpawnTimer = 0;
      const randStar = Math.floor(Math.random() * countToUpdate);
      const r3 = randStar * 3;
      this.spawnSupernovaShockwave(
        this.particlePositions[r3],
        this.particlePositions[r3 + 1],
        this.particlePositions[r3 + 2],
        0x7dd3fc,
        8.5
      );
      this.totalSupernovae += 1;
    }

    for (let i = 0; i < countToUpdate; i++) {
      const i3 = i * 3;
      const h = this.particleHaloIndex[i];
      const h3 = h * 3;

      const currentAngle =
        this.particleTargetAngle[i] + dt * this.particleOrbitSpeed[i] * 1.45 * this.gravityMultiplier;
      this.particleTargetAngle[i] = currentAngle;

      const r = this.particleTargetRadius[i];
      const height = this.particleTargetHeight[i];
      const cosA = Math.cos(currentAngle);
      const sinA = Math.sin(currentAngle);

      const ux = this.haloBasisU[h3];
      const uy = this.haloBasisU[h3 + 1];
      const uz = this.haloBasisU[h3 + 2];

      const bx = this.haloBasisV[h3];
      const by = this.haloBasisV[h3 + 1];
      const bz = this.haloBasisV[h3 + 2];

      const nx = this.haloSpinAxis[h3];
      const ny = this.haloSpinAxis[h3 + 1];
      const nz = this.haloSpinAxis[h3 + 2];

      const targetX = this.haloPos[h3] + (ux * cosA + bx * sinA) * r + nx * height;
      const targetY = this.haloPos[h3 + 1] + (uy * cosA + by * sinA) * r + ny * height;
      const targetZ = this.haloPos[h3 + 2] + (uz * cosA + bz * sinA) * r + nz * height;

      this.particlePositions[i3] = targetX;
      this.particlePositions[i3 + 1] = targetY;
      this.particlePositions[i3 + 2] = targetZ;

      speedSum += Math.abs(this.particleOrbitSpeed[i] * r);
    }

    this.meanVelocityKmS = (speedSum / Math.max(1, countToUpdate)) * 42.0;
    this.updateTrackedStarMarkerAndTrail(camera);
    posAttr.needsUpdate = true;
  }

  public getPlanetWorldPosition(planetIndex: number, out: THREE.Vector3): THREE.Vector3 {
    const node = this.planetNodes[planetIndex] || this.planetNodes[0];
    if (!node) return out.set(0, 0, 0);
    node.meshGroup.getWorldPosition(out);
    return out;
  }

  public getLandingBeaconWorldPosition(landingIndex: number, out: THREE.Vector3): THREE.Vector3 {
    const beacon = this.landingBeaconMeshes[landingIndex] || this.landingBeaconMeshes[0];
    if (!beacon) return out.set(0, 0, 11);
    beacon.getWorldPosition(out);
    return out;
  }

  public setOrbitTimeScale(scaleId: OrbitTimeScaleId) {
    this.orbitTimeScale = scaleId;
  }

  public getOrbitTimeScale(): OrbitTimeScaleId {
    return this.orbitTimeScale;
  }

  public getSimElapsedSeconds(): number {
    return this.simElapsedSeconds;
  }

  public getOrbitTelemetry(activePlanetIndex: number = 0): OrbitTelemetry {
    const scaleSpec =
      ORBIT_TIME_SCALES.find((s) => s.id === this.orbitTimeScale) || ORBIT_TIME_SCALES[4];
    const totalDays = this.simElapsedSeconds / 86400;
    const years = Math.floor(totalDays / 365.25);
    const days = Math.floor(totalDays % 365.25);

    const activeNode = this.planetNodes[activePlanetIndex] || this.planetNodes[0];
    let activeBodyInfo: OrbitTelemetry['activeBody'] = undefined;

    if (activeNode) {
      const a = activeNode.semiMajorAu || 1.0;
      const periodYrs = Math.pow(a, 1.5);
      const orbitalSpeedKmS = 29.78 / Math.sqrt(a);
      const angleDeg = ((activeNode.angle * 180) / Math.PI) % 360;
      activeBodyInfo = {
        name: activeNode.name,
        type: activeNode.planetType,
        semiMajorAu: Number(a.toFixed(2)),
        orbitalPeriodYears: Number(periodYrs.toFixed(2)),
        orbitalSpeedKmS: Number(orbitalSpeedKmS.toFixed(1)),
        currentAngleDeg: Math.round((angleDeg + 360) % 360),
      };
    }

    return {
      scaleId: this.orbitTimeScale,
      multiplier: scaleSpec.multiplier,
      simElapsedYears: years,
      simElapsedDays: days,
      earthOrbitDurationSec: scaleSpec.earthOrbitDurationSec,
      activeBody: activeBodyInfo,
    };
  }

  private clearGroup(group: THREE.Group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }
  }
}
