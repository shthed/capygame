import * as THREE from 'three';
import { HEAD_ORANGE_VARIETIES, WeatherType } from '../types';
import {
  PbrSurfaceMaterialKind,
  PbrTextureSynthesizer,
} from './gpu/PbrTextureSynthesizer';
import { evaluatePlayerSightlineCutoutAlpha } from './gpu/FramePerformanceGovernor';

// Zero-allocation scratch helpers for GPU particle & shader updates
const _matDummy = new THREE.Object3D();
const _sunDir = new THREE.Vector3(0.4, 0.8, 0.35);
const _skyZenith = new THREE.Color();
const _skyHorizon = new THREE.Color();
const _sunColor = new THREE.Color();
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();
const _fogColor = new THREE.Color();
const _unripeGreen = new THREE.Color(0x4d7c0f);
const _ripeColor = new THREE.Color();

const _chartreuseMid = new THREE.Color(0xa3e635);

// Shared zero-allocation screen-space & linear view-depth uniforms updated once per frame by PlayStyleManager
export const SHARED_OCCLUDER_VIEWPORT = new THREE.Vector2(1280, 720);
export const SHARED_OCCLUDER_HEAD_UV = new THREE.Vector2(0.5, 0.5);
// x = headUvX, y = headUvY, z = headViewDepth (m), w = innerRadiusNorm (fraction of min viewport dim)
export const SHARED_OCCLUDER_HEAD_CLIP = new THREE.Vector4(0.5, 0.5, 10.0, 0.16);
// x = tailUvX, y = tailUvY, z = tailViewDepth (m), w = featherNorm (fraction of min viewport dim)
export const SHARED_OCCLUDER_TAIL_CLIP = new THREE.Vector4(0.5, 0.42, 10.4, 0.08);

export interface OccluderEdgeShaderUniforms {
  uCapyOccBlend: { value: number };
  uCapyOccBounds: { value: THREE.Vector3 };
  uCapyViewport: { value: THREE.Vector2 };
  uCapyHeadUv: { value: THREE.Vector2 };
  uCapySightHead: { value: THREE.Vector4 };
  uCapySightTail: { value: THREE.Vector4 };
}

/**
 * Installs a zero-allocation GLSL shader hook on any Three.js mesh material so that when
 * `uCapyOccBlend` ramps from 0 -> 1 (blocking the camera-to-player sightline):
 * - Visually hides (`discard`) ONLY fragments strictly closer to the camera than the player
 *   (`vCapyViewDepth < playerCutDepth`) inside the smooth aspect-normalized screen capsule
 *   around the player (`[uCapySightHead.xy -> uCapySightTail.xy]`).
 * - Keeps all non-blocking parts of the same tree/building (side branches, upper canopy,
 *   offscreen edges, and back-side foliage behind the player) 100% solid with `depthWrite = true`.
 */
export function installSightlineEdgeFadeShader(
  mat: THREE.Material
): OccluderEdgeShaderUniforms {
  if (
    mat.userData.__occUniforms &&
    mat.userData.__occUniforms.uCapyViewport?.value === SHARED_OCCLUDER_VIEWPORT &&
    mat.userData.__occUniforms.uCapySightHead?.value === SHARED_OCCLUDER_HEAD_CLIP
  ) {
    return mat.userData.__occUniforms as OccluderEdgeShaderUniforms;
  }

  const uniforms: OccluderEdgeShaderUniforms = {
    uCapyOccBlend: { value: 0.0 },
    uCapyOccBounds: { value: new THREE.Vector3(0.5, 0.5, 0.85) },
    uCapyViewport: { value: SHARED_OCCLUDER_VIEWPORT },
    uCapyHeadUv: { value: SHARED_OCCLUDER_HEAD_UV },
    uCapySightHead: { value: SHARED_OCCLUDER_HEAD_CLIP },
    uCapySightTail: { value: SHARED_OCCLUDER_TAIL_CLIP },
  };

  mat.userData.__occUniforms = uniforms;
  mat.userData.__origOpacity = mat.opacity;
  mat.userData.__origDepthWrite = mat.depthWrite;
  mat.userData.__occBlend = 0.0;
  mat.userData.__centerScreenOpacity = 1.0;
  mat.userData.__edgeOutlineMaxOpacity = 1.0;
  // Keep transparent=true and depthWrite=origDepthWrite permanently once installed so Three.js
  // never recompiles WebGLPrograms and non-occluding fragments retain crisp hardware Z-buffer sorting.
  mat.transparent = true;
  mat.depthWrite = Boolean(mat.userData.__origDepthWrite ?? true);

  const baseType = mat.type;
  mat.customProgramCacheKey = () => `capy_occ_aperture_${baseType}`;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCapyOccBlend = uniforms.uCapyOccBlend;
    shader.uniforms.uCapyOccBounds = uniforms.uCapyOccBounds;
    shader.uniforms.uCapyViewport = uniforms.uCapyViewport;
    shader.uniforms.uCapyHeadUv = uniforms.uCapyHeadUv;
    shader.uniforms.uCapySightHead = uniforms.uCapySightHead;
    shader.uniforms.uCapySightTail = uniforms.uCapySightTail;

    shader.vertexShader =
      'varying float vCapyViewDepth;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vCapyViewDepth = -mvPosition.z;'
      );

    shader.fragmentShader =
      'uniform float uCapyOccBlend;\n' +
      'uniform vec2 uCapyViewport;\n' +
      'uniform vec4 uCapySightHead;\n' +
      'uniform vec4 uCapySightTail;\n' +
      'varying float vCapyViewDepth;\n' +
      'float capyComputePlayerSightlineCutout() {\n' +
      '  vec2 vp = uCapyViewport;\n' +
      '  if (uCapyOccBlend <= 0.001 || vp.x < 10.0 || vp.y < 10.0) {\n' +
      '    return 0.0;\n' +
      '  }\n' +
      '  float playerCutDepth = max(uCapySightHead.z, uCapySightTail.z) - 0.12;\n' +
      '  float depthMask = 1.0 - smoothstep(playerCutDepth - 0.45, playerCutDepth + 0.08, vCapyViewDepth);\n' +
      '  if (depthMask <= 0.001) {\n' +
      '    return 0.0;\n' +
      '  }\n' +
      '  vec2 sUv = gl_FragCoord.xy / vp;\n' +
      '  float minDim = max(10.0, min(vp.x, vp.y));\n' +
      '  vec2 aspectScale = vp / minDim;\n' +
      '  vec2 pa = (sUv - uCapySightHead.xy) * aspectScale;\n' +
      '  vec2 ba = (uCapySightTail.xy - uCapySightHead.xy) * aspectScale;\n' +
      '  float baLenSq = dot(ba, ba);\n' +
      '  float h = baLenSq > 1e-5 ? clamp(dot(pa, ba) / baLenSq, 0.0, 1.0) : 0.0;\n' +
      '  float dNorm = length(pa - ba * h);\n' +
      '  float safeInner = max(0.05, uCapySightHead.w);\n' +
      '  float safeOuter = safeInner + max(0.02, uCapySightTail.w);\n' +
      '  float screenMask = 1.0 - smoothstep(safeInner, safeOuter, dNorm);\n' +
      '  return clamp(uCapyOccBlend * depthMask * screenMask, 0.0, 1.0);\n' +
      '}\n' +
      shader.fragmentShader
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
        float capyOccCutout = uCapyOccBlend > 0.001 ? capyComputePlayerSightlineCutout() : 0.0;
        if (capyOccCutout > 0.88) {
          discard;
        }`
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
        if (capyOccCutout > 0.004) {
          float remAlpha = gl_FragColor.a * (1.0 - capyOccCutout);
          if (remAlpha < 0.02) {
            discard;
          }
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.86, 0.96, 1.0), 0.20 * capyOccCutout);
          gl_FragColor.a = remAlpha;
        }`
        );
  };

  return uniforms;
}

/**
 * Pure CPU mirror of the localized player-sightline cutout shader for telemetry & E2E verification.
 */
export function evaluateSightlineEdgeAlphaAtScreenUv(
  sUvX: number,
  sUvY: number,
  occBlend: number,
  _boundsX: number,
  _boundsY: number,
  _boundsR: number,
  viewportW: number,
  viewportH: number,
  headUvX: number,
  headUvY: number,
  fragViewDepth?: number
): number {
  const effectiveDepth =
    fragViewDepth !== undefined ? fragViewDepth : SHARED_OCCLUDER_HEAD_CLIP.z - 2.0;
  return evaluatePlayerSightlineCutoutAlpha(
    sUvX,
    sUvY,
    effectiveDepth,
    occBlend,
    viewportW,
    viewportH,
    headUvX,
    headUvY,
    SHARED_OCCLUDER_HEAD_CLIP.z,
    SHARED_OCCLUDER_HEAD_CLIP.w,
    SHARED_OCCLUDER_TAIL_CLIP.x,
    SHARED_OCCLUDER_TAIL_CLIP.y,
    SHARED_OCCLUDER_TAIL_CLIP.z,
    SHARED_OCCLUDER_TAIL_CLIP.w
  );
}

export interface PbrTextureSet {
  albedo: THREE.Texture;
  normal: THREE.DataTexture;
  bump: THREE.Texture;
  roughness: THREE.DataTexture;
  ao: THREE.DataTexture;
}

export type FruitGrowthStage = 'blossom' | 'ovary_bud' | 'swelling' | 'ripe';

export interface TreeBranchFruitSlot {
  mesh: THREE.Group;
  fruitSphere: THREE.Mesh;
  blossomGroup: THREE.Group;
  calyxGroup: THREE.Group;
  fruitMat: THREE.MeshStandardMaterial;
  localOffset: THREE.Vector3;
  baseY: number;
  growth: number; // 0.06 (blossom bud) -> 1.0 (heavy ripe hesperidium)
  growthRate: number;
  stage: FruitGrowthStage;
}

export interface ExponentialFruitTree {
  id: number;
  tier: number; // 0..4 exponential size tier
  scale: number; // 1.48^tier
  fruitRadius: number; // matches tree size exponentially!
  crownRadius: number; // outer procedural canopy radius for zero-clipping layout
  trunkHeight: number; // height of primary crown fork for 3D camera-frustum occlusion
  matchesPlayerHead: boolean;
  varietyIndex: number;
  x: number;
  z: number;
  trunkRadius: number;
  branchCount: number;
  leafCount: number;
  rootGroup: THREE.Group;
  swayPivot: THREE.Group;
  skeletonMesh: THREE.Mesh;
  leafInstancedMesh: THREE.InstancedMesh;
  ringMat: THREE.MeshStandardMaterial;
  swayX: number;
  swayZ: number;
  swayVelX: number;
  swayVelZ: number;
  bumpCooldown: number;
  slots: TreeBranchFruitSlot[];
}

export interface StoneCollider {
  x: number;
  z: number;
  radius: number;
}

export interface HomePoolSystem {
  group: THREE.Group;
  tapFixtureGroup: THREE.Group;
  centerX: number;
  centerZ: number;
  basinRadius: number;
  floorY: number;
  baseWaterY: number;
  rimY: number;
  tapStreamWorldX: number;
  tapStreamWorldZ: number;
  tapNozzleY: number;
  waterMesh: THREE.Mesh;
  waterMat: THREE.MeshPhysicalMaterial;
  tapStreamMesh: THREE.Mesh;
  tapFoamRing: THREE.Mesh;
  lanternLight: THREE.PointLight;
  rimColliders: StoneCollider[];
  messGroup: THREE.Group;
  messLobes: THREE.Mesh[];
  splashInstanced: THREE.InstancedMesh;
}

// Deterministic hash & FBM ridged noise for realistic alpine mountains & textures
function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function ridgedMountainHeight(x: number, z: number): number {
  let sum = 0;
  let amp = 1.0;
  let freq = 0.018;
  let weight = 1.0;
  for (let oct = 0; oct < 5; oct++) {
    let signal = 1.0 - Math.abs(valueNoise2D(x * freq, z * freq) * 2.0 - 1.0);
    signal = signal * signal * weight;
    weight = THREE.MathUtils.clamp(signal * 1.8, 0.0, 1.0);
    sum += signal * amp;
    freq *= 2.12;
    amp *= 0.48;
  }
  return sum;
}

/**
 * Hardware-accelerated photorealistic environment, procedural PBR texture suite,
 * 360-degree snow-capped mountain range, GPU Rayleigh/Mie sky dome, Day/Night + Weather,
 * Home Pool with running tap water & overflow splash mess, and Exponential Fruit Trees.
 */
export class RealisticWorldEnvironment {
  private static textureCache = new Map<string, PbrTextureSet>();
  private static waterNormalTex: THREE.CanvasTexture | null = null;
  private static peelBumpTex: THREE.CanvasTexture | null = null;
  private static sharedLeafGeo: THREE.BufferGeometry | null = null;
  private static sharedBlossomCorollaGeo: THREE.BufferGeometry | null = null;
  private static sharedCalyxStarGeo: THREE.BufferGeometry | null = null;
  private static sharedUnitRibbedFruitGeo: THREE.BufferGeometry | null = null;

  public readonly skyMesh: THREE.Mesh;
  public readonly skyMaterial: THREE.ShaderMaterial;
  public readonly mountainMesh: THREE.Mesh;
  public readonly cloudGroup = new THREE.Group();
  public readonly weatherMesh: THREE.InstancedMesh;

  // Lighting rig controlled by Day/Night & Weather
  public readonly sunLight: THREE.DirectionalLight;
  public readonly moonLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly ambientLight: THREE.AmbientLight;

  // Dynamic Day/Night & Weather state
  public timeOfDayHours: number = 9.5; // 0..24
  public activeWeather: WeatherType = 'clear';
  public currentNightFactor: number = 0.0;
  public currentDuskFactor: number = 0.0;
  public readonly currentSunDir = new THREE.Vector3(0.4, 0.8, 0.35).normalize();
  private weatherAutoTimer: number = 0;
  private lightningFlash: number = 0;
  public elapsedSeconds: number = 0;

  // Pre-allocated GPU rain/snow particle buffers (zero GC)
  private readonly maxWeatherParticles: number;
  private readonly pX: Float32Array;
  private readonly pY: Float32Array;
  private readonly pZ: Float32Array;
  private readonly pSpeed: Float32Array;

  // Pre-allocated Pond Overflow Splash droplet buffers (zero GC)
  private readonly maxSplashDroplets = 96;
  private readonly sX = new Float32Array(96);
  private readonly sY = new Float32Array(96);
  private readonly sZ = new Float32Array(96);
  private readonly sVx = new Float32Array(96);
  private readonly sVy = new Float32Array(96);
  private readonly sVz = new Float32Array(96);
  private readonly sLife = new Float32Array(96);
  private splashSpawnCursor = 0;

  // Track PBR materials whose roughness reacts to rain wetness
  private wettableMaterials: Array<{ mat: THREE.MeshStandardMaterial; dryRoughness: number }> = [];
  private lastAppliedWetness: number = -1;

  constructor(
    renderer: THREE.WebGLRenderer,
    isSoftwareGl: boolean,
    ambientLight: THREE.AmbientLight,
    hemiLight: THREE.HemisphereLight,
    sunLight: THREE.DirectionalLight
  ) {
    this.ambientLight = ambientLight;
    this.hemiLight = hemiLight;
    this.sunLight = sunLight;

    const maxAniso = isSoftwareGl ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());
    RealisticWorldEnvironment.ensureCoreTextures(maxAniso);

    // Cool silvery directional moonlight for nighttime specular highlights
    this.moonLight = new THREE.DirectionalLight(0x93c5fd, 0.25);
    this.moonLight.position.set(-40, 55, -35);

    // 1. Hardware-Accelerated Atmospheric Sky Dome Shader (Rayleigh/Mie + Sun + Moon + Night Stars)
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.4, 0.75, 0.3) },
        uZenithColor: { value: new THREE.Color(0x0c4a6e) },
        uHorizonColor: { value: new THREE.Color(0xbae6fd) },
        uSunColor: { value: new THREE.Color(0xfff7ed) },
        uStarIntensity: { value: 0.0 },
        uCloudCover: { value: 0.15 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldDir;
        uniform vec3 uSunDir;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform float uStarIntensity;
        uniform float uCloudCover;
        uniform float uTime;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float elev = clamp(dir.y, 0.0, 1.0);
          float horizonFactor = pow(1.0 - elev, 2.4);
          vec3 sky = mix(uZenithColor, uHorizonColor, horizonFactor);

          // Mie solar scattering & crisp solar disk
          float sunCos = max(0.0, dot(dir, normalize(uSunDir)));
          float mieHalo = pow(sunCos, 12.0) * 0.42 + pow(sunCos, 96.0) * 0.65;
          float sunDisk = smoothstep(0.9982, 0.9994, sunCos);
          sky += uSunColor * (mieHalo * (1.0 - uCloudCover * 0.7) + sunDisk * 2.2 * (1.0 - uCloudCover * 0.85));

          // Opposite lunar disk at night
          float moonCos = max(0.0, dot(dir, normalize(-uSunDir)));
          float moonDisk = smoothstep(0.9988, 0.9995, moonCos) * uStarIntensity;
          float moonHalo = pow(moonCos, 48.0) * 0.22 * uStarIntensity;
          sky += vec3(0.78, 0.88, 1.0) * (moonDisk * 1.4 + moonHalo);

          // Procedural high-altitude FBM cloud veil
          if (dir.y > 0.03) {
            vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.4 + vec2(uTime * 0.012, uTime * 0.006);
            float c = noise2(cloudUv) * 0.6 + noise2(cloudUv * 2.3) * 0.4;
            float cloudMask = smoothstep(0.58 - uCloudCover * 0.38, 0.88, c) * smoothstep(0.03, 0.22, dir.y);
            vec3 cloudTint = mix(uHorizonColor * 1.08, vec3(0.24, 0.27, 0.33), uCloudCover * 0.72);
            sky = mix(sky, cloudTint, cloudMask * (0.35 + uCloudCover * 0.55));
          }

          // Crisp night-sky starfield
          if (uStarIntensity > 0.02 && dir.y > 0.04) {
            vec2 starCell = floor(dir.xz / (dir.y + 0.35) * 210.0);
            float rnd = hash(starCell);
            if (rnd > 0.993) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 3.0 + rnd * 90.0);
              sky += vec3(0.9, 0.95, 1.0) * twinkle * uStarIntensity * (1.0 - uCloudCover * 0.85);
            }
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(720, 32, 20), this.skyMaterial);
    this.skyMesh.frustumCulled = false;

    // 2. Sculpted 360-Degree Photorealistic Alpine Mountain Range
    this.mountainMesh = this.buildAlpineMountainRange(isSoftwareGl ? 72 : 128);

    // 3. Volumetric Low-Altitude Drifting Cloud Clusters
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.92,
      metalness: 0.0,
      transparent: true,
      opacity: 0.78,
    });
    const puffGeo = new THREE.DodecahedronGeometry(10, 1);
    puffGeo.scale(1.8, 0.48, 1.25);
    const cloudCount = isSoftwareGl ? 8 : 16;
    for (let i = 0; i < cloudCount; i++) {
      const a = (i / cloudCount) * Math.PI * 2;
      const dist = 95 + (i % 3) * 42;
      const cluster = new THREE.Group();
      cluster.position.set(Math.cos(a) * dist, 52 + (i % 4) * 7, Math.sin(a) * dist);
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set((p - 1) * 11, (p % 2) * 2.5, (p - 1) * 4);
        puff.scale.setScalar(0.75 + ((i + p) % 3) * 0.25);
        cluster.add(puff);
      }
      this.cloudGroup.add(cluster);
    }

    // 4. Hardware-Accelerated GPU Weather Precipitation InstancedMesh (Rain / Storm / Snow)
    this.maxWeatherParticles = isSoftwareGl ? 260 : 780;
    this.pX = new Float32Array(this.maxWeatherParticles);
    this.pY = new Float32Array(this.maxWeatherParticles);
    this.pZ = new Float32Array(this.maxWeatherParticles);
    this.pSpeed = new Float32Array(this.maxWeatherParticles);

    const dropGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.85, 4);
    const dropMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    this.weatherMesh = new THREE.InstancedMesh(dropGeo, dropMat, this.maxWeatherParticles);
    this.weatherMesh.frustumCulled = false;
    this.weatherMesh.count = 0;

    for (let i = 0; i < this.maxWeatherParticles; i++) {
      this.pX[i] = (Math.random() - 0.5) * 68;
      this.pY[i] = Math.random() * 28;
      this.pZ[i] = (Math.random() - 0.5) * 68;
      this.pSpeed[i] = 17 + Math.random() * 9;
    }
  }

  // ============================================================================
  // PROCEDURAL HIGH-RES PBR TEXTURE SUITE (ALBEDO + BUMP + ROUGHNESS)
  // ============================================================================
  public static getTextureSet(
    kind: PbrSurfaceMaterialKind,
    anisotropy: number = 8
  ): PbrTextureSet {
    const existing = this.textureCache.get(kind);
    if (existing) return existing;

    if (kind === 'cobble') {
      const synth = PbrTextureSynthesizer.getSurfaceMaps('cobble');
      const cobbleSet: PbrTextureSet = {
        albedo: synth.albedo,
        normal: synth.normal,
        bump: synth.bump,
        roughness: synth.roughness,
        ao: synth.ao,
      };
      this.textureCache.set(kind, cobbleSet);
      return cobbleSet;
    }

    const size = kind === 'grass' || kind === 'mountain' || kind === 'sand' ? 512 : 256;
    const albCanvas = document.createElement('canvas');
    albCanvas.width = size;
    albCanvas.height = size;
    const actx = albCanvas.getContext('2d')!;

    const bmpCanvas = document.createElement('canvas');
    bmpCanvas.width = size;
    bmpCanvas.height = size;
    const bctx = bmpCanvas.getContext('2d')!;

    const rghCanvas = document.createElement('canvas');
    rghCanvas.width = size;
    rghCanvas.height = size;
    const rctx = rghCanvas.getContext('2d')!;

    let seed = kind.charCodeAt(0) * 1337 + kind.charCodeAt(1) * 7919;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    if (kind === 'grass') {
      actx.fillStyle = '#2f6f34';
      actx.fillRect(0, 0, size, size);
      bctx.fillStyle = '#707070';
      bctx.fillRect(0, 0, size, size);
      rctx.fillStyle = '#c8c8c8';
      rctx.fillRect(0, 0, size, size);

      // Soil & moss patches
      for (let i = 0; i < 180; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const rad = 10 + rnd() * 28;
        const g = actx.createRadialGradient(x, y, 1, x, y, rad);
        g.addColorStop(0, rnd() > 0.3 ? 'rgba(34, 92, 38, 0.45)' : 'rgba(92, 68, 42, 0.28)');
        g.addColorStop(1, 'rgba(47, 111, 52, 0)');
        actx.fillStyle = g;
        actx.beginPath();
        actx.arc(x, y, rad, 0, Math.PI * 2);
        actx.fill();
      }

      // Thousands of individual grass blades & clover leaves
      const greens = ['#3f8f42', '#4ea84f', '#255c29', '#65b755', '#347839'];
      for (let i = 0; i < 6500; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const len = 4 + rnd() * 9;
        const ang = -Math.PI * 0.5 + (rnd() - 0.5) * 0.9;
        actx.strokeStyle = greens[i % greens.length];
        actx.lineWidth = 1.0 + rnd() * 1.4;
        actx.beginPath();
        actx.moveTo(x, y);
        actx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        actx.stroke();

        const bVal = Math.floor(110 + rnd() * 135);
        bctx.strokeStyle = `rgb(${bVal},${bVal},${bVal})`;
        bctx.lineWidth = 1.2;
        bctx.beginPath();
        bctx.moveTo(x, y);
        bctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        bctx.stroke();
      }
    } else if (kind === 'sand') {
      actx.fillStyle = '#d6b882';
      actx.fillRect(0, 0, size, size);
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, size, size);
      rctx.fillStyle = '#b0b0b0';
      rctx.fillRect(0, 0, size, size);

      // Wave ripple bands & mineral sand grains
      for (let y = 0; y < size; y += 8) {
        actx.fillStyle = y % 16 === 0 ? 'rgba(245,228,190,0.16)' : 'rgba(160,128,84,0.14)';
        actx.fillRect(0, y, size, 4);
        bctx.fillStyle = y % 16 === 0 ? 'rgba(210,210,210,0.22)' : 'rgba(90,90,90,0.22)';
        bctx.fillRect(0, y, size, 4);
      }
      for (let i = 0; i < 5200; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const r = 0.7 + rnd() * 2.1;
        const shade = Math.floor(165 + rnd() * 80);
        actx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.87)}, ${Math.floor(shade * 0.65)})`;
        actx.fillRect(x, y, r, r);
        const bv = Math.floor(90 + rnd() * 150);
        bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
        bctx.fillRect(x, y, r, r);
      }
    } else if (kind === 'mountain') {
      actx.fillStyle = '#57534e';
      actx.fillRect(0, 0, size, size);
      bctx.fillStyle = '#787878';
      bctx.fillRect(0, 0, size, size);
      rctx.fillStyle = '#d4d4d4';
      rctx.fillRect(0, 0, size, size);

      // Diagonal tectonic rock strata & sharp granite fractures
      for (let i = 0; i < 420; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const w = 18 + rnd() * 65;
        const h = 4 + rnd() * 16;
        const v = Math.floor(62 + rnd() * 85);
        actx.save();
        actx.translate(x, y);
        actx.rotate(-0.35 + (rnd() - 0.5) * 0.4);
        actx.fillStyle = `rgba(${v}, ${v - 2}, ${v - 5}, 0.55)`;
        actx.fillRect(-w / 2, -h / 2, w, h);
        actx.restore();

        const bv = Math.floor(45 + rnd() * 195);
        bctx.save();
        bctx.translate(x, y);
        bctx.rotate(-0.35 + (rnd() - 0.5) * 0.4);
        bctx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.65)`;
        bctx.fillRect(-w / 2, -h / 2, w, h);
        bctx.restore();
      }
    } else if (kind === 'bark') {
      actx.fillStyle = '#4a3222';
      actx.fillRect(0, 0, size, size);
      bctx.fillStyle = '#686868';
      bctx.fillRect(0, 0, size, size);
      rctx.fillStyle = '#e2e2e2';
      rctx.fillRect(0, 0, size, size);

      for (let i = 0; i < 650; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const h = 24 + rnd() * 60;
        const w = 2 + rnd() * 5;
        const dark = rnd() > 0.45;
        actx.fillStyle = dark ? '#2d1c11' : '#6b4932';
        actx.fillRect(x, y, w, h);
        bctx.fillStyle = dark ? '#282828' : '#dcdcdc';
        bctx.fillRect(x, y, w, h);
      }
    } else if (kind === 'foliage') {
      actx.fillStyle = '#1e5e2a';
      actx.fillRect(0, 0, size, size);
      bctx.fillStyle = '#707070';
      bctx.fillRect(0, 0, size, size);
      rctx.fillStyle = '#8f8f8f';
      rctx.fillRect(0, 0, size, size);

      const leafShades = ['#166534', '#228b3b', '#15803d', '#3a9d42', '#14532d'];
      for (let i = 0; i < 1100; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const rx = 5 + rnd() * 9;
        const ry = 2.5 + rnd() * 4.5;
        const rot = rnd() * Math.PI;
        actx.save();
        actx.translate(x, y);
        actx.rotate(rot);
        actx.fillStyle = leafShades[i % leafShades.length];
        actx.beginPath();
        actx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        actx.fill();
        actx.restore();

        const bv = Math.floor(105 + rnd() * 135);
        bctx.save();
        bctx.translate(x, y);
        bctx.rotate(rot);
        bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
        bctx.beginPath();
        bctx.ellipse(0, 0, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
        bctx.fill();
        bctx.restore();
      }
    } else if (kind === 'basalt') {
      actx.fillStyle = '#475569';
      actx.fillRect(0, 0, size, size);
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, size, size);
      rctx.fillStyle = '#686868';
      rctx.fillRect(0, 0, size, size);

      for (let i = 0; i < 420; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const r = 4 + rnd() * 18;
        const v = Math.floor(52 + rnd() * 68);
        actx.fillStyle =
          rnd() > 0.86 ? 'rgba(54, 108, 52, 0.42)' : `rgba(${v}, ${v + 6}, ${v + 14}, 0.55)`;
        actx.beginPath();
        actx.arc(x, y, r, 0, Math.PI * 2);
        actx.fill();

        const bv = Math.floor(60 + rnd() * 175);
        bctx.fillStyle = `rgba(${bv},${bv},${bv},0.5)`;
        bctx.beginPath();
        bctx.arc(x, y, r, 0, Math.PI * 2);
        bctx.fill();
      }
    } else {
      // timber
      actx.fillStyle = '#7c4a24';
      actx.fillRect(0, 0, size, size);
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, size, size);
      rctx.fillStyle = '#b4b4b4';
      rctx.fillRect(0, 0, size, size);

      for (let i = 0; i < 360; i++) {
        const x = rnd() * size;
        actx.fillStyle = i % 2 === 0 ? 'rgba(92,52,22,0.36)' : 'rgba(154,98,52,0.28)';
        actx.fillRect(x, 0, 1.5 + rnd() * 3, size);
        bctx.fillStyle = i % 2 === 0 ? 'rgba(95,95,95,0.4)' : 'rgba(185,185,185,0.4)';
        bctx.fillRect(x, 0, 2, size);
      }
    }

    const albedo = new THREE.CanvasTexture(albCanvas);
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = THREE.RepeatWrapping;
    albedo.wrapT = THREE.RepeatWrapping;
    albedo.anisotropy = anisotropy;

    const bump = new THREE.CanvasTexture(bmpCanvas);
    bump.colorSpace = THREE.NoColorSpace;
    bump.wrapS = THREE.RepeatWrapping;
    bump.wrapT = THREE.RepeatWrapping;
    bump.anisotropy = anisotropy;

    const synth = PbrTextureSynthesizer.getSurfaceMaps(kind, albedo, bump);

    const set: PbrTextureSet = {
      albedo,
      normal: synth.normal,
      bump,
      roughness: synth.roughness,
      ao: synth.ao,
    };
    this.textureCache.set(kind, set);
    return set;
  }

  public static getWaterRippleTexture(): THREE.CanvasTexture {
    if (this.waterNormalTex) return this.waterNormalTex;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const nx = (x / size) * Math.PI * 2;
        const ny = (y / size) * Math.PI * 2;
        const w =
          Math.sin(nx * 4 + Math.cos(ny * 3)) * 0.4 +
          Math.cos(ny * 5 - Math.sin(nx * 4)) * 0.35 +
          Math.sin((nx + ny) * 6) * 0.25;
        const v = Math.floor(128 + w * 95);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    this.waterNormalTex = tex;
    return tex;
  }

  private static getPeelBump(): THREE.CanvasTexture {
    if (this.peelBumpTex) return this.peelBumpTex;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#909090';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 400; i++) {
      const x = (i * 73) % 128;
      const y = (i * 41) % 128;
      ctx.fillStyle = i % 2 === 0 ? '#505050' : '#d0d0d0';
      ctx.fillRect(x, y, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.peelBumpTex = tex;
    return tex;
  }

  public static ensureCoreTextures(anisotropy: number) {
    const kinds: PbrSurfaceMaterialKind[] = [
      'grass',
      'sand',
      'mountain',
      'bark',
      'foliage',
      'basalt',
      'timber',
      'cobble',
    ];
    for (const k of kinds) {
      this.getTextureSet(k, anisotropy);
    }
    PbrTextureSynthesizer.registerManagedTexture(this.getWaterRippleTexture());
    PbrTextureSynthesizer.getWaterNormalMaps();
  }

  public registerWettableMaterial(mat: THREE.MeshStandardMaterial, dryRoughness: number) {
    this.wettableMaterials.push({ mat, dryRoughness });
    this.lastAppliedWetness = -1;
  }

  // ============================================================================
  // 3D BACKGROUND ALPINE MOUNTAIN RANGE
  // ============================================================================
  private buildAlpineMountainRange(radialSegs: number): THREE.Mesh {
    const ringSegs = 20;
    const innerR = 148;
    const outerR = 355;

    const vertCount = (radialSegs + 1) * (ringSegs + 1);
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices: number[] = [];

    const foothillCol = new THREE.Color(0x274e2a);
    const cliffCol = new THREE.Color(0x645f5a);
    const snowCol = new THREE.Color(0xf8fafc);
    const scratchCol = new THREE.Color();

    let ptr = 0;
    let uvPtr = 0;
    for (let r = 0; r <= ringSegs; r++) {
      const v = r / ringSegs; // 0 (inner shore) -> 1 (outer horizon)
      const rad = innerR + v * (outerR - innerR);
      // Bell-shaped radial envelope so mountains rise steeply from ocean and taper at far horizon
      const radialEnvelope = Math.sin(Math.pow(v, 0.72) * Math.PI);

      for (let a = 0; a <= radialSegs; a++) {
        const u = a / radialSegs;
        const theta = u * Math.PI * 2;
        const wx = Math.cos(theta) * rad;
        const wz = Math.sin(theta) * rad;

        const ridge = ridgedMountainHeight(wx, wz);
        const macroPeak = 0.68 + 0.45 * Math.sin(theta * 5.0 + 0.8) + 0.25 * Math.cos(theta * 9.0);
        const height = Math.max(-1.6, ridge * macroPeak * radialEnvelope * 56.0 - 1.5);

        positions[ptr] = wx;
        positions[ptr + 1] = height;
        positions[ptr + 2] = wz;

        // Elevation + slope color ramp: lush pine foothills -> granite rock -> bright snow caps
        if (height < 14) {
          scratchCol.copy(foothillCol).lerp(cliffCol, THREE.MathUtils.clamp(height / 14, 0, 1));
        } else if (height < 36) {
          scratchCol.copy(cliffCol);
        } else {
          scratchCol
            .copy(cliffCol)
            .lerp(snowCol, THREE.MathUtils.clamp((height - 34) / 14, 0, 1));
        }

        colors[ptr] = scratchCol.r;
        colors[ptr + 1] = scratchCol.g;
        colors[ptr + 2] = scratchCol.b;
        ptr += 3;

        uvs[uvPtr] = u * 28;
        uvs[uvPtr + 1] = v * 10;
        uvPtr += 2;
      }
    }

    for (let r = 0; r < ringSegs; r++) {
      for (let a = 0; a < radialSegs; a++) {
        const i0 = r * (radialSegs + 1) + a;
        const i1 = i0 + 1;
        const i2 = i0 + (radialSegs + 1);
        const i3 = i2 + 1;
        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const uvAttr = new THREE.BufferAttribute(uvs, 2);
    geo.setAttribute('uv', uvAttr);
    geo.setAttribute('uv2', uvAttr);
    geo.setIndex(indices);
    geo.computeVertexNormals();
    PbrTextureSynthesizer.prepareGeometryForPbr(geo);

    const mtnTex = RealisticWorldEnvironment.getTextureSet('mountain');
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: mtnTex.albedo,
      normalMap: mtnTex.normal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: mtnTex.roughness,
      aoMap: mtnTex.ao,
      aoMapIntensity: 0.72,
      roughness: 0.86,
      metalness: 0.06,
    });
    this.registerWettableMaterial(mat, 0.86);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'BackgroundAlpineMountains';
    return mesh;
  }

  // ============================================================================
  // HOME POOL WITH RUNNING TAP WATER & OVERFLOW PUDDLE MESS
  // ============================================================================
  public createHomePool(centerX: number, centerZ: number): HomePoolSystem {
    const group = new THREE.Group();
    group.name = 'CapyHomePool';
    group.position.set(centerX, 0, centerZ);

    const basinRadius = 3.85;
    const floorY = -0.42;
    const baseWaterY = 0.16;
    const rimY = 0.34;

    const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');
    const sandTex = RealisticWorldEnvironment.getTextureSet('sand');
    const timberTex = RealisticWorldEnvironment.getTextureSet('timber');

    // Sunken pebbled pool basin floor & inner stone wall
    const basinFloorMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      map: sandTex.albedo,
      normalMap: sandTex.normal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: sandTex.roughness,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const floorMesh = new THREE.Mesh(
      PbrTextureSynthesizer.prepareGeometryForPbr(
        new THREE.CylinderGeometry(basinRadius, basinRadius - 0.25, 0.24, 32)
      ),
      basinFloorMat
    );
    floorMesh.position.set(0, -0.02, 0);
    floorMesh.receiveShadow = true;
    floorMesh.userData.ignoreCameraFade = true;
    group.add(floorMesh);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      map: basaltTex.albedo,
      normalMap: basaltTex.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: basaltTex.roughness,
      aoMap: basaltTex.ao,
      aoMapIntensity: 0.65,
      roughness: 0.42,
      metalness: 0.12,
    });
    this.registerWettableMaterial(wallMat, 0.42);

    // 20 Sculpted River-Basalt Rim Boulders with an entry step opening facing East (+X toward spawn!)
    const rimColliders: StoneCollider[] = [];
    const rockCount = 20;
    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2;
      // Leave a welcoming gentle wading entrance on the +X side (angle near 0) so Capybara walks right in!
      if (Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < 0.46) {
        const stepStone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.65, 0.14, 10),
          wallMat
        );
        stepStone.position.set(
          Math.cos(angle) * (basinRadius - 0.1),
          0.07,
          Math.sin(angle) * (basinRadius - 0.1)
        );
        stepStone.receiveShadow = true;
        stepStone.userData.ignoreCameraFade = true;
        group.add(stepStone);
        continue;
      }

      const rockRadius = 0.58;
      const rockGeo = new THREE.DodecahedronGeometry(rockRadius, 1);
      const rock = new THREE.Mesh(rockGeo, wallMat);
      const rx = Math.cos(angle) * basinRadius;
      const rz = Math.sin(angle) * basinRadius;
      rock.position.set(rx, 0.24, rz);
      rock.scale.set(1.12, 0.72, 1.12);
      rock.rotation.set(i * 0.4, angle, i * 0.2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      rock.userData.ignoreCameraFade = true;
      group.add(rock);

      rimColliders.push({
        x: centerX + rx,
        z: centerZ + rz,
        radius: 0.56,
      });
    }

    // Photorealistic Clearcoat Specular Pool Water Surface with Dual-Octave Tangent-Space Normal Maps
    const waterNorms = PbrTextureSynthesizer.getWaterNormalMaps();
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      roughness: 0.05,
      metalness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      normalMap: waterNorms.primary,
      normalScale: new THREE.Vector2(0.55, 0.55),
      clearcoatNormalMap: waterNorms.secondary,
      clearcoatNormalScale: new THREE.Vector2(0.42, 0.42),
      transparent: true,
      opacity: 0.84,
    });
    const waterMesh = new THREE.Mesh(
      PbrTextureSynthesizer.prepareGeometryForPbr(
        new THREE.CylinderGeometry(basinRadius - 0.18, basinRadius - 0.22, 0.18, 36)
      ),
      waterMat
    );
    waterMesh.position.set(0, baseWaterY, 0);
    waterMesh.receiveShadow = true;
    waterMesh.userData.ignoreCameraFade = true;
    group.add(waterMesh);

    // Weathered Cedar Tap Post + Brushed Brass Faucet Spout pouring fresh Tap Water!
    const timberMat = new THREE.MeshStandardMaterial({
      color: 0xb47b48,
      map: timberTex.albedo,
      normalMap: timberTex.normal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: timberTex.roughness,
      roughness: 0.72,
    });
    this.registerWettableMaterial(timberMat, 0.72);

    const tapFixtureGroup = new THREE.Group();
    tapFixtureGroup.name = 'HomePoolTapFixtureGroup';
    tapFixtureGroup.userData.__occluderRoot = tapFixtureGroup;
    group.add(tapFixtureGroup);

    const postX = -basinRadius + 0.35;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.35, 12), timberMat);
    post.position.set(postX, 1.15, 0);
    post.castShadow = true;
    tapFixtureGroup.add(post);

    // Add post collider so Capybaras never clip into the wooden tap post
    rimColliders.push({ x: centerX + postX, z: centerZ, radius: 0.28 });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.86,
      roughness: 0.22,
    });
    const horizontalPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 1.45, 10),
      brassMat
    );
    horizontalPipe.rotation.z = Math.PI / 2;
    horizontalPipe.position.set(postX + 0.72, 2.02, 0);
    horizontalPipe.castShadow = true;
    tapFixtureGroup.add(horizontalPipe);

    const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 16), brassMat);
    valveWheel.rotation.x = Math.PI / 2;
    valveWheel.position.set(postX + 0.35, 2.18, 0);
    tapFixtureGroup.add(valveWheel);

    const tapLocalX = postX + 1.38; // ~ -2.12 local -> inside pool water!
    const tapNozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.068, 0.28, 10),
      brassMat
    );
    tapNozzle.position.set(tapLocalX, 1.92, 0);
    tapFixtureGroup.add(tapNozzle);

    // Flowing 3D Tap Water Column + White Foam Impact Ring
    const streamMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.22,
      roughness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.78,
    });
    const tapStreamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.125, 1.68, 12),
      streamMat
    );
    tapStreamMesh.position.set(tapLocalX, 1.02, 0);
    tapStreamMesh.userData.ignoreCameraFade = true;
    group.add(tapStreamMesh);

    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xf0f9ff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    const tapFoamRing = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.42, 20), foamMat);
    tapFoamRing.rotation.x = Math.PI / 2;
    tapFoamRing.position.set(tapLocalX, baseWaterY + 0.1, 0);
    tapFoamRing.userData.ignoreCameraFade = true;
    group.add(tapFoamRing);

    // Warm Wooden Lantern on top of Tap Post (glows warmly at dusk & night)
    const lanternFrame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.36), timberMat);
    lanternFrame.position.set(postX, 2.52, 0);
    const lanternCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    lanternCore.position.set(postX, 2.52, 0);
    tapFixtureGroup.add(lanternFrame, lanternCore);

    const lanternLight = new THREE.PointLight(0xfbbf24, 0.4, 18, 1.8);
    lanternLight.position.set(postX, 2.6, 0);
    group.add(lanternLight);

    // Persistent Overflow Wet Puddle & Muddy Mess Group around the outside of the Home Pool
    const messGroup = new THREE.Group();
    messGroup.visible = false;
    const puddleMat = new THREE.MeshPhysicalMaterial({
      color: 0x0369a1,
      roughness: 0.04,
      metalness: 0.25,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mudMat = new THREE.MeshStandardMaterial({
      color: 0x452c1e,
      roughness: 0.18,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const messLobes: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + 0.25;
      const dist = basinRadius + 0.85 + (i % 3) * 0.55;
      const lobe = new THREE.Mesh(
        new THREE.CircleGeometry(1.15 + (i % 3) * 0.35, 18),
        i % 3 === 0 ? mudMat : puddleMat
      );
      lobe.rotation.x = -Math.PI / 2;
      lobe.position.set(Math.cos(ang) * dist, 0.025 + (i % 3) * 0.004, Math.sin(ang) * dist);
      lobe.scale.setScalar(0.01);
      lobe.userData.ignoreCameraFade = true;
      messGroup.add(lobe);
      messLobes.push(lobe);
    }
    group.add(messGroup);

    // GPU Instanced Splash-Out Droplets when Pond Overflows
    const splashGeo = new THREE.SphereGeometry(0.085, 6, 6);
    const splashMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.3,
      roughness: 0.08,
    });
    const splashInstanced = new THREE.InstancedMesh(splashGeo, splashMat, this.maxSplashDroplets);
    splashInstanced.frustumCulled = false;
    splashInstanced.userData.ignoreCameraFade = true;
    for (let i = 0; i < this.maxSplashDroplets; i++) {
      this.sLife[i] = 0;
      _matDummy.position.set(0, -20, 0);
      _matDummy.scale.setScalar(0.001);
      _matDummy.updateMatrix();
      splashInstanced.setMatrixAt(i, _matDummy.matrix);
    }
    splashInstanced.instanceMatrix.needsUpdate = true;
    group.add(splashInstanced);

    return {
      group,
      tapFixtureGroup,
      centerX,
      centerZ,
      basinRadius,
      floorY,
      baseWaterY,
      rimY,
      tapStreamWorldX: centerX + tapLocalX,
      tapStreamWorldZ: centerZ,
      tapNozzleY: 1.92,
      waterMesh,
      waterMat,
      tapStreamMesh,
      tapFoamRing,
      lanternLight,
      rimColliders,
      messGroup,
      messLobes,
      splashInstanced,
    };
  }

  public triggerPondSplashBurst(pool: HomePoolSystem, count: number = 14) {
    for (let c = 0; c < count; c++) {
      const idx = this.splashSpawnCursor;
      this.splashSpawnCursor = (this.splashSpawnCursor + 1) % this.maxSplashDroplets;
      const angle = Math.random() * Math.PI * 2;
      const startR = (pool.basinRadius - 0.4) * (0.4 + Math.random() * 0.6);
      this.sX[idx] = Math.cos(angle) * startR;
      this.sY[idx] = pool.waterMesh.position.y + 0.12;
      this.sZ[idx] = Math.sin(angle) * startR;
      const outSpeed = 2.6 + Math.random() * 4.2;
      this.sVx[idx] = Math.cos(angle) * outSpeed;
      this.sVy[idx] = 3.5 + Math.random() * 4.5;
      this.sVz[idx] = Math.sin(angle) * outSpeed;
      this.sLife[idx] = 0.65 + Math.random() * 0.45;
    }
  }

  public updateHomePoolEffects(
    pool: HomePoolSystem,
    dt: number,
    displacedRise: number,
    isOverflowing: boolean,
    messLevel: number
  ) {
    // Animate rising water level + gentle slosh
    const targetWaterY =
      pool.baseWaterY +
      Math.min(0.28, displacedRise) +
      (isOverflowing ? Math.sin(this.elapsedSeconds * 9.0) * 0.035 : 0);
    pool.waterMesh.position.y = THREE.MathUtils.lerp(
      pool.waterMesh.position.y,
      targetWaterY,
      1 - Math.exp(-8 * dt)
    );
    if (isOverflowing) {
      pool.waterMesh.rotation.x = Math.sin(this.elapsedSeconds * 6.5) * 0.04;
      pool.waterMesh.rotation.z = Math.cos(this.elapsedSeconds * 5.8) * 0.04;
      this.triggerPondSplashBurst(pool, 3);
    } else {
      pool.waterMesh.rotation.x *= 0.9;
      pool.waterMesh.rotation.z *= 0.9;
    }

    // Animate running tap water stream & foam ring
    const streamPulse = 1.0 + Math.sin(this.elapsedSeconds * 18.0) * 0.08;
    pool.tapStreamMesh.scale.set(streamPulse, 1.0, streamPulse);
    pool.tapFoamRing.position.y = pool.waterMesh.position.y + 0.1;
    pool.tapFoamRing.scale.setScalar(0.92 + Math.sin(this.elapsedSeconds * 12.0) * 0.14);

    // Scroll water bump map on GPU
    const waterNormal = RealisticWorldEnvironment.getWaterRippleTexture();
    waterNormal.offset.x = (this.elapsedSeconds * 0.045) % 1;
    waterNormal.offset.y = (this.elapsedSeconds * 0.032) % 1;

    // Expand wet overflow puddle & muddy splash mess around the pool
    if (messLevel > 0.01) {
      pool.messGroup.visible = true;
      for (let i = 0; i < pool.messLobes.length; i++) {
        const lobeScale = THREE.MathUtils.clamp(messLevel * (0.75 + (i % 3) * 0.22), 0.01, 1.45);
        pool.messLobes[i].scale.setScalar(lobeScale);
      }
    } else {
      pool.messGroup.visible = false;
    }

    // Integrate ballistic splash droplets with zero heap allocations
    let dirty = false;
    for (let i = 0; i < this.maxSplashDroplets; i++) {
      if (this.sLife[i] <= 0) continue;
      dirty = true;
      this.sLife[i] -= dt;
      if (this.sLife[i] <= 0 || this.sY[i] < 0) {
        this.sLife[i] = 0;
        _matDummy.position.set(0, -20, 0);
        _matDummy.scale.setScalar(0.001);
      } else {
        this.sVy[i] -= 16.5 * dt;
        this.sX[i] += this.sVx[i] * dt;
        this.sY[i] += this.sVy[i] * dt;
        this.sZ[i] += this.sVz[i] * dt;
        _matDummy.position.set(this.sX[i], this.sY[i], this.sZ[i]);
        _matDummy.scale.setScalar(0.65 + this.sLife[i] * 0.6);
      }
      _matDummy.updateMatrix();
      pool.splashInstanced.setMatrixAt(i, _matDummy.matrix);
    }
    if (dirty) {
      pool.splashInstanced.instanceMatrix.needsUpdate = true;
    }
  }

  // ============================================================================
  // PROCEDURAL BOTANICAL GEOMETRY: LEAF, BLOSSOM PETAL, RIBBED CITRUS & BRANCHES
  // ============================================================================
  private static getProceduralLeafGeometry(): THREE.BufferGeometry {
    if (this.sharedLeafGeo) return this.sharedLeafGeo;

    // Procedurally generate a 3D arched, V-folded, acuminate-tipped citrus leaf blade (length = 1.0 along +Z)
    const lengthSteps = 6;
    const widthSteps = 4; // -1, -0.5, 0 (midrib crease), +0.5, +1
    const vertCount = (lengthSteps + 1) * (widthSteps + 1);
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices: number[] = [];

    let p = 0;
    let uPtr = 0;
    for (let i = 0; i <= lengthSteps; i++) {
      const v = i / lengthSteps; // 0 = petiole base, 1 = pointed leaf apex
      // Botanical elliptic-lanceolate citrus lamina width profile with winged petiole base
      const petioleBase = v < 0.12 ? 0.12 + (v / 0.12) * 0.25 : 1.0;
      const laminaWidth = Math.sin(Math.pow(v, 0.78) * Math.PI) * 0.36 * petioleBase;
      // Subtle serration undulation along outer margin
      const serration = 1.0 + Math.sin(v * Math.PI * 10) * 0.045;
      // Graceful downward arch from petiole to dripping tip
      const midribArchY = Math.sin(v * Math.PI * 0.85) * 0.11 - v * v * 0.16;

      for (let j = 0; j <= widthSteps; j++) {
        const s = (j / widthSteps) * 2 - 1; // -1 .. +1 across leaf blade
        const absS = Math.abs(s);
        const x = s * laminaWidth * serration;
        // V-fold dihedral along central midrib vein for crisp specular leaf catchlights
        const vFoldY = absS * 0.055 * Math.sin(v * Math.PI);
        const z = v * 1.0;

        positions[p++] = x;
        positions[p++] = midribArchY + vFoldY;
        positions[p++] = z;

        uvs[uPtr++] = j / widthSteps;
        uvs[uPtr++] = v;
      }
    }

    const rowStride = widthSteps + 1;
    for (let i = 0; i < lengthSteps; i++) {
      for (let j = 0; j < widthSteps; j++) {
        const a = i * rowStride + j;
        const b = a + 1;
        const c = a + rowStride;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    this.sharedLeafGeo = geo;
    return geo;
  }

  private static getMergedBlossomCorollaGeometry(): THREE.BufferGeometry {
    if (this.sharedBlossomCorollaGeo) return this.sharedBlossomCorollaGeo;
    // Unit-radius 5-petal cupped white citrus blossom corolla merged into 1 single draw call
    const lSteps = 4;
    const wSteps = 2;
    const basePos: number[] = [];
    const baseIdx: number[] = [];
    for (let i = 0; i <= lSteps; i++) {
      const v = i / lSteps;
      const w = Math.sin(Math.pow(v, 0.7) * Math.PI) * 0.34;
      const cupY = Math.sin(v * Math.PI) * 0.14;
      for (let j = 0; j <= wSteps; j++) {
        const s = (j / wSteps) * 2 - 1;
        basePos.push(s * w, cupY - s * s * 0.04, v);
      }
    }
    const stride = wSteps + 1;
    for (let i = 0; i < lSteps; i++) {
      for (let j = 0; j < wSteps; j++) {
        const a = i * stride + j;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        baseIdx.push(a, c, b, b, c, d);
      }
    }

    const mergedPos: number[] = [];
    const mergedIdx: number[] = [];
    const vtxCount = basePos.length / 3;
    const mat = new THREE.Matrix4();
    const euler = new THREE.Euler(0, 0, 0, 'XYZ');
    const scaleVec = new THREE.Vector3(1.45, 1.45, 1.45);
    const posVec = new THREE.Vector3();
    const zeroPos = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    for (let k = 0; k < 5; k++) {
      euler.set(-0.35, (k / 5) * Math.PI * 2 + 0.3, 0, 'XYZ');
      quat.setFromEuler(euler);
      mat.compose(zeroPos, quat, scaleVec);
      const offset = k * vtxCount;
      for (let i = 0; i < vtxCount; i++) {
        posVec
          .set(basePos[i * 3], basePos[i * 3 + 1], basePos[i * 3 + 2])
          .applyMatrix4(mat);
        mergedPos.push(posVec.x, posVec.y, posVec.z);
      }
      for (let i = 0; i < baseIdx.length; i++) {
        mergedIdx.push(baseIdx[i] + offset);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(mergedPos, 3));
    geo.setIndex(mergedIdx);
    geo.computeVertexNormals();
    this.sharedBlossomCorollaGeo = geo;
    return geo;
  }

  private static getMergedCalyxGeometry(): THREE.BufferGeometry {
    if (this.sharedCalyxStarGeo) return this.sharedCalyxStarGeo;
    // Unit-radius woody hanging pedicel + 5-pointed star calyx sepals merged into 1 draw call
    const parts: THREE.BufferGeometry[] = [];
    const pedicelLen = 0.85;
    const pedicelGeo = new THREE.CylinderGeometry(0.08, 0.11, pedicelLen, 6);
    pedicelGeo.translate(0, 0.88 + pedicelLen * 0.42, 0);
    parts.push(pedicelGeo);

    for (let k = 0; k < 5; k++) {
      const sepal = new THREE.ConeGeometry(0.12, 0.36, 4);
      sepal.rotateX(Math.PI * 0.48);
      sepal.translate(0, 0, 0.14);
      sepal.rotateY((k / 5) * Math.PI * 2);
      sepal.translate(0, 0.88, 0);
      parts.push(sepal);
    }

    const mergedPos: number[] = [];
    const mergedNorm: number[] = [];
    const mergedIdx: number[] = [];
    let vtxOffset = 0;
    for (const part of parts) {
      const posAttr = part.getAttribute('position');
      const normAttr = part.getAttribute('normal');
      for (let i = 0; i < posAttr.count; i++) {
        mergedPos.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        mergedNorm.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      }
      const idx = part.getIndex();
      if (idx) {
        for (let i = 0; i < idx.count; i++) {
          mergedIdx.push(idx.getX(i) + vtxOffset);
        }
      }
      vtxOffset += posAttr.count;
      part.dispose();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(mergedPos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(mergedNorm, 3));
    geo.setIndex(mergedIdx);
    this.sharedCalyxStarGeo = geo;
    return geo;
  }

  private static getUnitRibbedFruitGeometry(): THREE.BufferGeometry {
    if (this.sharedUnitRibbedFruitGeo) return this.sharedUnitRibbedFruitGeo;
    // Unit-radius (R=1) organic 9-carpel ribbed citrus hesperidium with basal calyx dimple & stylar apex
    const latSegs = 16;
    const lonSegs = 24;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y <= latSegs; y++) {
      const v = y / latSegs;
      const phi = v * Math.PI; // 0 = top stem pole, PI = bottom blossom end
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      // Slight oblate citrus spheroid + concave dimples at stem & stylar poles
      const poleIndent = 1.0 - 0.12 * Math.pow(Math.abs(cosPhi), 6);

      for (let x = 0; x <= lonSegs; x++) {
        const u = x / lonSegs;
        const theta = u * Math.PI * 2;
        // 9 subtle carpel lobes strongest around equator
        const carpelRib = 1.0 + 0.036 * Math.cos(theta * 9) * sinPhi * sinPhi;
        const r = poleIndent * carpelRib;

        positions.push(
          -r * Math.cos(theta) * sinPhi * 1.03,
          r * cosPhi * 0.91,
          r * Math.sin(theta) * sinPhi * 1.03
        );
        uvs.push(u * 2, v * 2);
      }
    }

    const row = lonSegs + 1;
    for (let y = 0; y < latSegs; y++) {
      for (let x = 0; x < lonSegs; x++) {
        const a = y * row + x;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    this.sharedUnitRibbedFruitGeo = geo;
    return geo;
  }

  /**
   * Appends a procedural curved, fluted cylindrical tube segment along a 3D spline into merged arrays.
   */
  private appendProceduralLimbTube(
    pts: THREE.Vector3[],
    rStart: number,
    rEnd: number,
    radialSegs: number,
    lengthSegs: number,
    fluteCount: number,
    fluteAmp: number,
    posOut: number[],
    uvOut: number[],
    idxOut: number[]
  ) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const frames = curve.computeFrenetFrames(lengthSegs, false);
    const baseVertex = posOut.length / 3;
    const p = new THREE.Vector3();

    for (let i = 0; i <= lengthSegs; i++) {
      const t = i / lengthSegs;
      curve.getPointAt(t, p);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      // Smooth exponential taper + root/collar flare at t -> 0
      const baseRadius = THREE.MathUtils.lerp(rStart, rEnd, Math.pow(t, 0.78));

      for (let j = 0; j <= radialSegs; j++) {
        const u = j / radialSegs;
        const ang = u * Math.PI * 2;
        const flute =
          fluteAmp > 0
            ? 1.0 + fluteAmp * (1.0 - t * 0.75) * Math.cos(ang * fluteCount + t * 2.2)
            : 1.0;
        const r = baseRadius * flute;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);

        posOut.push(
          p.x + (cosA * N.x + sinA * B.x) * r,
          p.y + (cosA * N.y + sinA * B.y) * r,
          p.z + (cosA * N.z + sinA * B.z) * r
        );
        uvOut.push(u * 2.0, t * 3.5);
      }
    }

    const stride = radialSegs + 1;
    for (let i = 0; i < lengthSegs; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = baseVertex + i * stride + j;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        idxOut.push(a, c, b, b, c, d);
      }
    }
  }

  // ============================================================================
  // PROCEDURAL EXPONENTIAL FRUIT TREES (TRUNK, BRANCHES, LEAVES & FRUIT GROWTH)
  // ============================================================================
  public createExponentialTree(
    id: number,
    tier: number,
    x: number,
    z: number,
    matchesPlayerHead: boolean,
    varietyIndex: number
  ): ExponentialFruitTree {
    // Exponential scale: 1.00x, 1.48x, 2.19x, 3.24x, 4.80x
    const scale = Math.pow(1.48, tier);
    // Fruit size matches tree size exponentially!
    const fruitRadius = +(0.24 * scale).toFixed(3);
    const trunkRadius = 0.28 * scale;
    const crownRadius = 1.42 * scale;

    // Seeded deterministic PRNG so each tree has a unique organic silhouette, branch fork & leaf canopy
    let seed = (id * 977 + tier * 313 + 104729) >>> 0;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const barkSet = RealisticWorldEnvironment.getTextureSet('bark');
    const foliageSet = RealisticWorldEnvironment.getTextureSet('foliage');
    const variety = HEAD_ORANGE_VARIETIES[varietyIndex] ?? HEAD_ORANGE_VARIETIES[0];

    const rootGroup = new THREE.Group();
    rootGroup.name = `ProceduralFruitTree_${id}_Tier${tier}`;
    rootGroup.position.set(x, 0, z);
    rootGroup.userData.__occluderRoot = rootGroup;

    // Subtle ground collar ring tinted with variety color (ignored by camera head-occluder fader)
    const ringMat = new THREE.MeshStandardMaterial({
      color: variety.colorHex,
      emissive: variety.emissiveHex,
      emissiveIntensity: 0.32,
      roughness: 0.45,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const collar = new THREE.Mesh(
      new THREE.RingGeometry(trunkRadius * 1.2, trunkRadius * 1.72, 24),
      ringMat
    );
    collar.rotation.x = -Math.PI / 2;
    collar.position.y = 0.03;
    collar.userData.ignoreCameraFade = true;
    rootGroup.add(collar);

    // Elastic trunk & canopy sway pivot (bends organically when bumped!)
    const swayPivot = new THREE.Group();
    rootGroup.add(swayPivot);

    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x8c6244,
      map: barkSet.albedo,
      bumpMap: barkSet.bump,
      bumpScale: 0.15,
      roughness: 0.88,
      side: THREE.DoubleSide,
    });
    this.registerWettableMaterial(barkMat, 0.88);

    // --- 1. PROCEDURALLY GENERATED CURVED TRUNK, FLARED ROOTS & 3-LEVEL BRANCH SKELETON ---
    const posArr: number[] = [];
    const uvArr: number[] = [];
    const idxArr: number[] = [];
    let branchCount = 0;

    const trunkHeight = (2.12 + rnd() * 0.24) * scale;
    const leanX = (rnd() - 0.5) * 0.26 * scale;
    const leanZ = (rnd() - 0.5) * 0.26 * scale;
    const crownOrigin = new THREE.Vector3(leanX * 0.85, trunkHeight, leanZ * 0.85);

    // Main gnarled fluted trunk from ground (y=-0.04) up to primary fork
    this.appendProceduralLimbTube(
      [
        new THREE.Vector3(0, -0.05, 0),
        new THREE.Vector3(leanX * 0.35, trunkHeight * 0.34, leanZ * 0.35),
        new THREE.Vector3(-leanX * 0.2, trunkHeight * 0.68, leanZ * 0.55),
        crownOrigin,
      ],
      trunkRadius * 1.24,
      trunkRadius * 0.62,
      12,
      9,
      5 + (id % 3),
      0.14,
      posArr,
      uvArr,
      idxArr
    );

    // 5 Organic spreading surface buttress roots gripping the earth
    const rootTendrilCount = 5;
    for (let r = 0; r < rootTendrilCount; r++) {
      const rAng = (r / rootTendrilCount) * Math.PI * 2 + rnd() * 0.45;
      const rReach = trunkRadius * (2.05 + rnd() * 0.65);
      const rHeight = trunkHeight * (0.24 + rnd() * 0.08);
      this.appendProceduralLimbTube(
        [
          new THREE.Vector3(
            Math.cos(rAng) * trunkRadius * 0.42,
            rHeight,
            Math.sin(rAng) * trunkRadius * 0.42
          ),
          new THREE.Vector3(
            Math.cos(rAng + 0.12) * rReach * 0.62,
            rHeight * 0.32,
            Math.sin(rAng + 0.12) * rReach * 0.62
          ),
          new THREE.Vector3(Math.cos(rAng + 0.2) * rReach, -0.04, Math.sin(rAng + 0.2) * rReach),
        ],
        trunkRadius * 0.42,
        trunkRadius * 0.09,
        7,
        5,
        3,
        0.08,
        posArr,
        uvArr,
        idxArr
      );
      branchCount++;
    }

    // Collect foliar attachment anchors & outer fruiting twig tips
    const foliageNodes: Array<{ pos: THREE.Vector3; dir: THREE.Vector3; radius: number }> = [];
    const fruitingTwigTips: Array<{ pos: THREE.Vector3; dir: THREE.Vector3 }> = [];

    // Primary scaffold boughs (golden-angle divergence + Da Vinci area-preserving radii)
    const primaryCount = 5 + (tier >= 2 ? 1 : 0);
    const goldenAngle = 2.39996323;
    const baseAzimuth = rnd() * Math.PI * 2;

    for (let b = 0; b < primaryCount; b++) {
      const az = baseAzimuth + b * goldenAngle + (rnd() - 0.5) * 0.28;
      const elev = 0.42 + (b / primaryCount) * 0.38 + (rnd() - 0.5) * 0.1;
      const bLen = (1.05 + rnd() * 0.32) * scale;
      const bStart = new THREE.Vector3(
        crownOrigin.x * (0.82 + 0.18 * (b / primaryCount)),
        trunkHeight * (0.76 + 0.22 * (b / primaryCount)),
        crownOrigin.z * (0.82 + 0.18 * (b / primaryCount))
      );
      const bDir = new THREE.Vector3(
        Math.cos(az) * Math.cos(elev),
        Math.sin(elev),
        Math.sin(az) * Math.cos(elev)
      ).normalize();
      const bMid = bStart
        .clone()
        .addScaledVector(bDir, bLen * 0.52)
        .add(new THREE.Vector3(0, 0.12 * scale, 0));
      const bEnd = bStart
        .clone()
        .addScaledVector(bDir, bLen)
        .add(new THREE.Vector3(0, -0.05 * scale, 0));

      const rBough = trunkRadius * 0.44;
      this.appendProceduralLimbTube(
        [bStart, bMid, bEnd],
        rBough,
        rBough * 0.54,
        8,
        6,
        4,
        0.06,
        posArr,
        uvArr,
        idxArr
      );
      branchCount++;
      foliageNodes.push({ pos: bMid.clone(), dir: bDir.clone(), radius: 0.42 * scale });

      // Secondary bifurcating limbs per primary bough
      const secCount = 2 + (b % 2);
      for (let s = 0; s < secCount; s++) {
        const sSpread = (s - (secCount - 1) * 0.5) * 0.68 + (rnd() - 0.5) * 0.22;
        const sAz = az + sSpread;
        const sElev = elev * 0.72 + 0.18 + (rnd() - 0.5) * 0.22;
        const sLen = bLen * (0.58 + rnd() * 0.2);
        const sDir = new THREE.Vector3(
          Math.cos(sAz) * Math.cos(sElev),
          Math.sin(sElev),
          Math.sin(sAz) * Math.cos(sElev)
        ).normalize();
        const sOrigin = s === 0 ? bEnd : bMid.clone().lerp(bEnd, 0.65);
        const sMid = sOrigin
          .clone()
          .addScaledVector(sDir, sLen * 0.55)
          .add(new THREE.Vector3(0, 0.05 * scale, 0));
        // Outer fruiting twigs arch gently outward/downward at tips
        const sTip = sOrigin
          .clone()
          .addScaledVector(sDir, sLen)
          .add(new THREE.Vector3(0, -0.11 * scale, 0));

        const rSec = rBough * 0.52;
        this.appendProceduralLimbTube(
          [sOrigin, sMid, sTip],
          rSec,
          rSec * 0.36,
          6,
          5,
          0,
          0,
          posArr,
          uvArr,
          idxArr
        );
        branchCount++;
        foliageNodes.push({ pos: sMid.clone(), dir: sDir.clone(), radius: 0.36 * scale });
        foliageNodes.push({ pos: sTip.clone(), dir: sDir.clone(), radius: 0.44 * scale });

        // Record outer lower/mid canopy tips as authentic hanging fruit sockets
        if (s === 0) {
          fruitingTwigTips.push({ pos: sTip.clone(), dir: sDir.clone() });
        }

        // Tertiary fine leaf shoots
        const tertAz = sAz + (s % 2 === 0 ? 0.52 : -0.52);
        const tertDir = new THREE.Vector3(
          Math.cos(tertAz) * 0.85,
          0.42 + rnd() * 0.25,
          Math.sin(tertAz) * 0.85
        ).normalize();
        const tertLen = sLen * 0.52;
        const tertTip = sMid.clone().addScaledVector(tertDir, tertLen);
        this.appendProceduralLimbTube(
          [sMid, tertTip],
          rSec * 0.42,
          rSec * 0.18,
          5,
          3,
          0,
          0,
          posArr,
          uvArr,
          idxArr
        );
        branchCount++;
        foliageNodes.push({ pos: tertTip, dir: tertDir, radius: 0.34 * scale });
      }
    }

    // Apical leader crown shoot at top of tree
    const apexBase = crownOrigin.clone();
    const apexTop = crownOrigin.clone().add(new THREE.Vector3(0, 0.92 * scale, 0));
    this.appendProceduralLimbTube(
      [apexBase, apexTop],
      trunkRadius * 0.42,
      trunkRadius * 0.14,
      7,
      4,
      0,
      0,
      posArr,
      uvArr,
      idxArr
    );
    branchCount++;
    foliageNodes.push({
      pos: apexTop,
      dir: new THREE.Vector3(0, 1, 0),
      radius: 0.52 * scale,
    });

    const skeletonGeo = new THREE.BufferGeometry();
    skeletonGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    skeletonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    skeletonGeo.setIndex(idxArr);
    skeletonGeo.computeVertexNormals();

    const skeletonMesh = new THREE.Mesh(skeletonGeo, barkMat);
    skeletonMesh.name = 'ProceduralTreeBranchSkeleton';
    skeletonMesh.userData.__ownOccluderMaterials = true;
    skeletonMesh.castShadow = true;
    skeletonMesh.receiveShadow = true;
    swayPivot.add(skeletonMesh);

    // --- 2. PROCEDURALLY GENERATED PHYLLOTACTIC 3D LEAF SPRAYS (INSTANCED) ---
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: foliageSet.albedo,
      bumpMap: foliageSet.bump,
      bumpScale: 0.08,
      roughness: 0.56,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    this.registerWettableMaterial(leafMat, 0.56);

    const leavesPerNode = 11;
    const totalLeaves = foliageNodes.length * leavesPerNode;
    const leafInstancedMesh = new THREE.InstancedMesh(
      RealisticWorldEnvironment.getProceduralLeafGeometry(),
      leafMat,
      totalLeaves
    );
    leafInstancedMesh.name = 'ProceduralBotanicalLeafCanopy';
    leafInstancedMesh.userData.__ownOccluderMaterials = true;
    leafInstancedMesh.castShadow = true;
    leafInstancedMesh.receiveShadow = true;

    const leafPalette = [0x22c55e, 0x16a34a, 0x4ade80, 0x15803d, 0x65a30d];
    const leafCol = new THREE.Color();
    const leafDummy = new THREE.Object3D();
    let leafCursor = 0;

    for (let n = 0; n < foliageNodes.length; n++) {
      const node = foliageNodes[n];
      for (let l = 0; l < leavesPerNode; l++) {
        const spiralAng = l * goldenAngle + n * 0.7;
        const radial = node.radius * (0.18 + 0.82 * Math.sqrt((l + 0.5) / leavesPerNode));
        const lift = ((l % 3) - 1) * 0.14 * scale;
        leafDummy.position.set(
          node.pos.x + Math.cos(spiralAng) * radial,
          node.pos.y + lift,
          node.pos.z + Math.sin(spiralAng) * radial
        );
        // Orient leaf outward from twig shoot with natural botanical droop & roll
        leafDummy.rotation.set(
          0.22 + (rnd() - 0.5) * 0.45,
          spiralAng + Math.PI * 0.5,
          (rnd() - 0.5) * 0.35
        );
        const leafSize = (0.38 + rnd() * 0.24) * scale;
        leafDummy.scale.set(leafSize, leafSize, leafSize);
        leafDummy.updateMatrix();
        leafInstancedMesh.setMatrixAt(leafCursor, leafDummy.matrix);

        leafCol.setHex(leafPalette[(n + l) % leafPalette.length]);
        // Sunlit top-crown leaves are brighter chartreuse-green
        if (node.pos.y > trunkHeight * 1.15) {
          leafCol.lerp(_chartreuseMid, 0.28);
        }
        leafInstancedMesh.setColorAt(leafCursor, leafCol);
        leafCursor++;
      }
    }
    leafInstancedMesh.instanceMatrix.needsUpdate = true;
    if (leafInstancedMesh.instanceColor) leafInstancedMesh.instanceColor.needsUpdate = true;
    leafInstancedMesh.computeBoundingSphere();
    swayPivot.add(leafInstancedMesh);

    // --- 3. PROCEDURAL MULTI-STAGE FRUIT GROWTH SOCKETS ON TERMINAL TWIG TIPS ---
    const slots: TreeBranchFruitSlot[] = [];
    const peelBump = RealisticWorldEnvironment.getPeelBump();
    const unitFruitGeo = RealisticWorldEnvironment.getUnitRibbedFruitGeometry();
    const corollaGeo = RealisticWorldEnvironment.getMergedBlossomCorollaGeometry();
    const calyxStarGeo = RealisticWorldEnvironment.getMergedCalyxGeometry();

    const calyxMat = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.62,
      side: THREE.DoubleSide,
    });
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef3c7,
      emissiveIntensity: 0.18,
      roughness: 0.38,
      side: THREE.DoubleSide,
    });

    const slotCount = Math.min(5, fruitingTwigTips.length);
    for (let s = 0; s < slotCount; s++) {
      const tip = fruitingTwigTips[s];
      // Hang fruit just below the procedural terminal twig tip
      const localOffset = new THREE.Vector3(
        tip.pos.x,
        tip.pos.y - fruitRadius * 0.75,
        tip.pos.z
      );

      const fruitMat = new THREE.MeshStandardMaterial({
        color: variety.colorHex,
        emissive: variety.emissiveHex,
        emissiveIntensity: 0.18,
        bumpMap: peelBump,
        bumpScale: 0.038,
        roughness: 0.22,
        metalness: 0.05,
      });

      const fGroup = new THREE.Group();
      fGroup.position.copy(localOffset);

      // Merged woody pedicel stalk + 5-pointed star calyx sepals (1 draw call)
      const calyxGroup = new THREE.Group();
      const calyxMesh = new THREE.Mesh(calyxStarGeo, calyxMat);
      calyxMesh.scale.setScalar(fruitRadius);
      calyxGroup.add(calyxMesh);
      fGroup.add(calyxGroup);

      // Merged 5-petal white citrus blossom corolla (1 draw call during 'blossom' -> 'ovary_bud')
      const blossomGroup = new THREE.Group();
      blossomGroup.position.y = fruitRadius * 0.72;
      const corollaMesh = new THREE.Mesh(corollaGeo, petalMat);
      corollaMesh.scale.setScalar(fruitRadius);
      blossomGroup.add(corollaMesh);
      fGroup.add(blossomGroup);

      // Ribbed 9-carpel citrus hesperidium mesh
      const fruitSphere = new THREE.Mesh(unitFruitGeo, fruitMat);
      fruitSphere.userData.targetRadius = fruitRadius;
      fruitSphere.scale.setScalar(fruitRadius);
      fruitSphere.castShadow = true;
      fruitSphere.receiveShadow = true;
      fGroup.add(fruitSphere);

      swayPivot.add(fGroup);

      // First 4 fruits start ripe (1.0) so bumping a matching tree drops fruits immediately;
      // 5th fruit starts in early blossom/bud stage (0.18) so live procedural botanical growth is visible!
      const initGrowth = s < 4 ? 1.0 : 0.18;
      const slot: TreeBranchFruitSlot = {
        mesh: fGroup,
        fruitSphere,
        blossomGroup,
        calyxGroup,
        fruitMat,
        localOffset,
        baseY: localOffset.y,
        growth: initGrowth,
        growthRate: 0.14 + (s % 3) * 0.03,
        stage: initGrowth >= 0.88 ? 'ripe' : 'blossom',
      };
      this.applyProceduralFruitGrowthVisuals(slot, variety.colorHex);
      slots.push(slot);
    }

    return {
      id,
      tier,
      scale,
      fruitRadius,
      crownRadius,
      trunkHeight,
      matchesPlayerHead,
      varietyIndex,
      x,
      z,
      trunkRadius,
      branchCount,
      leafCount: totalLeaves,
      rootGroup,
      swayPivot,
      skeletonMesh,
      leafInstancedMesh,
      ringMat,
      swayX: 0,
      swayZ: 0,
      swayVelX: 0,
      swayVelZ: 0,
      bumpCooldown: 0,
      slots,
    };
  }

  /**
   * Zero-allocation procedural 4-stage botanical fruit morphogenesis:
   * 1. 'blossom' (0.06..0.28): Fragrant 5-petal white citrus flower open around tiny emerald ovary pistil.
   * 2. 'ovary_bud' (0.28..0.55): Blossom petals curl & shed while deep-green ribbed ovary swells.
   * 3. 'swelling' (0.55..0.88): Hesperidium expands rapidly, shifting green -> chartreuse -> variedad tint, bending stalk.
   * 4. 'ripe' (0.88..1.00): Full tree-scaled dimpled citrus gleaming with peel oils, ready to shake loose!
   */
  public applyProceduralFruitGrowthVisuals(slot: TreeBranchFruitSlot, ripeColorHex: number) {
    const g = slot.growth;
    _ripeColor.setHex(ripeColorHex);

    if (g < 0.28) {
      slot.stage = 'blossom';
      const bloomOpen = THREE.MathUtils.smoothstep(g, 0.05, 0.24);
      slot.blossomGroup.visible = true;
      slot.blossomGroup.scale.setScalar(0.55 + bloomOpen * 0.65);
    } else if (g < 0.55) {
      slot.stage = 'ovary_bud';
      const petalFade = 1.0 - THREE.MathUtils.smoothstep(g, 0.28, 0.44);
      slot.blossomGroup.visible = petalFade > 0.02;
      slot.blossomGroup.scale.setScalar(Math.max(0.01, petalFade * 1.1));
    } else if (g < 0.88) {
      slot.stage = 'swelling';
      slot.blossomGroup.visible = false;
    } else {
      slot.stage = 'ripe';
      slot.blossomGroup.visible = false;
    }

    // Calyx stays crisp even on young buds while fruit swells nonlinearly
    const calyxScale = THREE.MathUtils.lerp(0.42, 1.0, THREE.MathUtils.smoothstep(g, 0.06, 0.6));
    slot.calyxGroup.scale.setScalar(calyxScale);

    // Young ovary is slightly elongated; mature citrus widens equatorially
    const fruitScale = Math.max(0.08, Math.pow(g, 1.12));
    const equatorialRoundness = THREE.MathUtils.lerp(0.84, 1.04, g);
    const targetR = (slot.fruitSphere.userData.targetRadius as number) || 0.24;
    slot.fruitSphere.scale.set(
      targetR * fruitScale * equatorialRoundness,
      targetR * fruitScale,
      targetR * fruitScale * equatorialRoundness
    );

    // Branch tip droops downward slightly as fruit gains mass (g^2)
    const weightDroop = g * g * targetR * 0.36;
    slot.mesh.position.y = slot.baseY - weightDroop;
    slot.localOffset.y = slot.mesh.position.y;

    // Botanical chlorophyll -> carotenoid/anthocyanin color transition
    if (g < 0.52) {
      slot.fruitMat.color.copy(_unripeGreen);
      slot.fruitMat.roughness = 0.46;
      slot.fruitMat.emissiveIntensity = 0.03;
    } else if (g < 0.78) {
      const tMid = (g - 0.52) / 0.26;
      slot.fruitMat.color.copy(_unripeGreen).lerp(_chartreuseMid, tMid);
      slot.fruitMat.roughness = THREE.MathUtils.lerp(0.46, 0.3, tMid);
      slot.fruitMat.emissiveIntensity = 0.08;
    } else {
      const tRipe = THREE.MathUtils.clamp((g - 0.78) / 0.2, 0, 1);
      slot.fruitMat.color.copy(_chartreuseMid).lerp(_ripeColor, tRipe);
      slot.fruitMat.roughness = THREE.MathUtils.lerp(0.3, 0.21, tRipe);
      slot.fruitMat.emissiveIntensity = THREE.MathUtils.lerp(0.08, 0.22, tRipe);
    }
  }

  public tickTrees(trees: ExponentialFruitTree[], dt: number) {
    for (let t = 0; t < trees.length; t++) {
      const tree = trees[t];
      if (tree.bumpCooldown > 0) tree.bumpCooldown -= dt;

      // Damped harmonic trunk/canopy sway after Capybara bump + gentle wind breeze
      const windBreeze =
        this.activeWeather === 'storm' ? 0.038 : this.activeWeather === 'rain' ? 0.018 : 0.008;
      const windX = Math.sin(this.elapsedSeconds * 1.7 + tree.id) * windBreeze;
      const springK = 38.0;
      const damping = 5.5;
      tree.swayVelX += (-springK * (tree.swayX - windX) - damping * tree.swayVelX) * dt;
      tree.swayVelZ += (-springK * tree.swayZ - damping * tree.swayVelZ) * dt;
      tree.swayX += tree.swayVelX * dt;
      tree.swayZ += tree.swayVelZ * dt;
      tree.swayPivot.rotation.z = -tree.swayX;
      tree.swayPivot.rotation.x = tree.swayZ;

      // Advance procedural 4-stage fruit morphogenesis on terminal twigs!
      const variety = HEAD_ORANGE_VARIETIES[tree.varietyIndex] ?? HEAD_ORANGE_VARIETIES[0];
      for (let s = 0; s < tree.slots.length; s++) {
        const slot = tree.slots[s];
        if (slot.growth < 1.0) {
          slot.growth = Math.min(1.0, slot.growth + slot.growthRate * dt);
          this.applyProceduralFruitGrowthVisuals(slot, variety.colorHex);
        }
      }
    }
  }

  // ============================================================================
  // CONTINUOUS DAY/NIGHT CYCLE & DYNAMIC WEATHER SIMULATION
  // ============================================================================
  public getDayPhaseLabel(): string {
    const h = ((this.timeOfDayHours % 24) + 24) % 24;
    if (h >= 5.2 && h < 8.0) return 'Golden Dawn';
    if (h >= 8.0 && h < 17.2) return 'Daylight';
    if (h >= 17.2 && h < 20.2) return 'Crimson Dusk';
    return 'Starlight Night';
  }

  public getWeatherLabel(): string {
    switch (this.activeWeather) {
      case 'clear':
        return 'Clear Skies';
      case 'rain':
        return 'Warm Rain';
      case 'storm':
        return 'Thunderstorm';
      case 'mist':
        return 'Mountain Mist';
      case 'snow':
        return 'Alpine Snow';
    }
  }

  public tickAtmosphereAndWeather(
    dt: number,
    autoDayNight: boolean,
    manualTimeHours: number,
    weatherMode: 'auto' | WeatherType,
    focusWorldX: number,
    focusWorldZ: number,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    fogEnabled: boolean,
    poolLantern?: THREE.PointLight,
    exposureScale: number = 1.0
  ) {
    this.elapsedSeconds += dt;

    // Scroll dual-octave Gerstner + capillary water normal maps smoothly with zero allocations
    const waterNorms = PbrTextureSynthesizer.getWaterNormalMaps();
    waterNorms.primary.offset.x = (this.elapsedSeconds * 0.018) % 1;
    waterNorms.primary.offset.y = (this.elapsedSeconds * 0.012) % 1;
    waterNorms.secondary.offset.x = (-this.elapsedSeconds * 0.026) % 1;
    waterNorms.secondary.offset.y = (this.elapsedSeconds * 0.021) % 1;

    // 1. Advance Day/Night solar clock (1 full 24h cycle every ~144 real seconds -> 0.166 hr/sec)
    if (autoDayNight) {
      this.timeOfDayHours = (this.timeOfDayHours + dt * 0.165) % 24;
    } else {
      this.timeOfDayHours = ((manualTimeHours % 24) + 24) % 24;
    }

    // 2. Weather state machine
    if (weatherMode === 'auto') {
      this.weatherAutoTimer += dt;
      if (this.weatherAutoTimer >= 28) {
        this.weatherAutoTimer = 0;
        const cycle: WeatherType[] = ['clear', 'rain', 'clear', 'mist', 'storm', 'snow'];
        const nextIdx = (cycle.indexOf(this.activeWeather) + 1) % cycle.length;
        this.activeWeather = cycle[nextIdx];
      }
    } else {
      this.activeWeather = weatherMode;
    }

    // Solar elevation angle (-1 midnight .. +1 solar noon at 12:00)
    const sunPhase = ((this.timeOfDayHours - 6.0) / 24.0) * Math.PI * 2.0;
    const sunElev = Math.sin(sunPhase);
    const sunAzimuth = Math.cos(sunPhase);

    _sunDir.set(sunAzimuth * 0.85, sunElev, 0.38).normalize();
    this.currentSunDir.copy(_sunDir);
    const tgt = this.sunLight.target.position;
    this.sunLight.position.set(
      tgt.x + _sunDir.x * 96,
      Math.max(12, _sunDir.y * 96),
      tgt.z + _sunDir.z * 96
    );
    this.moonLight.position.set(-_sunDir.x * 75, Math.max(12, -_sunDir.y * 80), -_sunDir.z * 75);

    const dayFactor = THREE.MathUtils.smoothstep(sunElev, -0.14, 0.28);
    const duskFactor = Math.max(0, 1.0 - Math.abs(sunElev - 0.04) * 4.2);
    const nightFactor = 1.0 - dayFactor;
    this.currentNightFactor = nightFactor;
    this.currentDuskFactor = duskFactor;

    const cloudCover =
      this.activeWeather === 'storm'
        ? 0.92
        : this.activeWeather === 'rain'
        ? 0.72
        : this.activeWeather === 'mist'
        ? 0.65
        : this.activeWeather === 'snow'
        ? 0.68
        : 0.14;

    // Sky Zenith & Horizon color blending across Night / Golden Hour / Noon + Weather overcast
    _skyZenith.setHex(0x020617).lerp(_hemiSky.setHex(0x075985), dayFactor);
    _skyHorizon.setHex(0x0f172a).lerp(_hemiGround.setHex(0xbae6fd), dayFactor);
    if (duskFactor > 0.01) {
      _skyHorizon.lerp(_sunColor.setHex(0xf97316), duskFactor * 0.72 * (1 - cloudCover * 0.6));
      _skyZenith.lerp(_sunColor.setHex(0x312e81), duskFactor * 0.38);
    }
    if (cloudCover > 0.3) {
      const overcast = _sunColor.setHex(dayFactor > 0.4 ? 0x475569 : 0x0f172a);
      _skyZenith.lerp(overcast, (cloudCover - 0.2) * 0.65);
      _skyHorizon.lerp(overcast, (cloudCover - 0.2) * 0.65);
    }

    // Lightning flash during storm
    if (this.activeWeather === 'storm') {
      if (this.lightningFlash > 0) {
        this.lightningFlash = Math.max(0, this.lightningFlash - dt * 5.5);
      } else if (Math.random() < dt * 0.35) {
        this.lightningFlash = 1.0;
      }
    } else {
      this.lightningFlash = 0;
    }

    this.skyMaterial.uniforms.uSunDir.value.copy(_sunDir);
    this.skyMaterial.uniforms.uZenithColor.value.copy(_skyZenith);
    this.skyMaterial.uniforms.uHorizonColor.value.copy(_skyHorizon);
    this.skyMaterial.uniforms.uSunColor.value.setHex(duskFactor > 0.35 ? 0xfb923c : 0xfffbeb);
    this.skyMaterial.uniforms.uStarIntensity.value = nightFactor;
    this.skyMaterial.uniforms.uCloudCover.value = cloudCover;
    this.skyMaterial.uniforms.uTime.value = this.elapsedSeconds;

    // Update Sun, Moon, Hemisphere & Lantern lights
    const weatherDim = 1.0 - cloudCover * 0.48;
    this.sunLight.intensity =
      Math.max(0, dayFactor * 1.65 * weatherDim) + this.lightningFlash * 2.4;
    this.sunLight.color.setHex(duskFactor > 0.35 ? 0xfdba74 : 0xfff7ed);
    this.moonLight.intensity = nightFactor * 0.55;
    this.hemiLight.color.copy(_skyHorizon);
    this.hemiLight.groundColor.setHex(dayFactor > 0.3 ? 0x2d4a2e : 0x0f172a);
    this.hemiLight.intensity = 0.38 + dayFactor * 0.58;
    this.ambientLight.intensity = 0.24 + dayFactor * 0.36 + this.lightningFlash * 0.6;
    renderer.toneMappingExposure =
      (0.88 + dayFactor * 0.24 + this.lightningFlash * 0.35) * exposureScale;

    if (poolLantern) {
      poolLantern.intensity = 0.3 + nightFactor * 2.2 + (cloudCover > 0.6 ? 0.6 : 0);
    }

    // Update atmospheric fog to blend distant mountain bases seamlessly
    _fogColor.copy(_skyHorizon);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(_fogColor);
      const mistPull =
        this.activeWeather === 'mist'
          ? 0.48
          : this.activeWeather === 'storm'
          ? 0.62
          : this.activeWeather === 'rain'
          ? 0.76
          : 1.0;
      scene.fog.near = (fogEnabled ? 68 : 160) * mistPull;
      scene.fog.far = (fogEnabled ? 340 : 520) * mistPull;
    }

    // Wet surface specular response during rain/storm (dirty-checked so clear frames cost 0 iterations)
    const wetness =
      this.activeWeather === 'storm' ? 0.58 : this.activeWeather === 'rain' ? 0.42 : 0.0;
    if (Math.abs(wetness - this.lastAppliedWetness) > 0.002) {
      this.lastAppliedWetness = wetness;
      for (let i = 0; i < this.wettableMaterials.length; i++) {
        const entry = this.wettableMaterials[i];
        entry.mat.roughness = Math.max(0.12, entry.dryRoughness * (1.0 - wetness));
      }
    }

    // Drift volumetric clouds slowly across the sky
    this.cloudGroup.rotation.y += dt * (this.activeWeather === 'storm' ? 0.028 : 0.007);

    // Update GPU Instanced Rain / Snow precipitation around player focus
    const isRain = this.activeWeather === 'rain' || this.activeWeather === 'storm';
    const isSnow = this.activeWeather === 'snow';
    if (!isRain && !isSnow) {
      this.weatherMesh.count = 0;
      return;
    }

    const activeCount =
      this.activeWeather === 'storm'
        ? this.maxWeatherParticles
        : Math.floor(this.maxWeatherParticles * 0.65);
    this.weatherMesh.count = activeCount;
    const wMat = this.weatherMesh.material as THREE.MeshBasicMaterial;
    wMat.color.setHex(isSnow ? 0xffffff : 0xbfdbfe);
    wMat.opacity = isSnow ? 0.82 : 0.52;

    const fallMult = isSnow ? 0.24 : this.activeWeather === 'storm' ? 1.35 : 1.0;
    const windSlant = this.activeWeather === 'storm' ? 0.26 : isRain ? 0.1 : 0.0;

    for (let i = 0; i < activeCount; i++) {
      this.pY[i] -= this.pSpeed[i] * fallMult * dt;
      this.pX[i] += windSlant * 14 * dt + (isSnow ? Math.sin(this.elapsedSeconds * 2 + i) * dt : 0);
      if (this.pY[i] < 0) {
        this.pY[i] = 24 + (i % 7);
        this.pX[i] = focusWorldX + (((i * 73) % 64) - 32);
        this.pZ[i] = focusWorldZ + (((i * 137) % 64) - 32);
      }
      _matDummy.position.set(this.pX[i], this.pY[i], this.pZ[i]);
      _matDummy.rotation.set(0, 0, -windSlant);
      if (isSnow) {
        _matDummy.scale.set(3.2, 0.14, 3.2);
      } else {
        _matDummy.scale.set(1.0, this.activeWeather === 'storm' ? 1.35 : 1.0, 1.0);
      }
      _matDummy.updateMatrix();
      this.weatherMesh.setMatrixAt(i, _matDummy.matrix);
    }
    this.weatherMesh.instanceMatrix.needsUpdate = true;
  }
}
