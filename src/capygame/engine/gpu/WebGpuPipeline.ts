import * as THREE from 'three';
import * as THREE_WEBGPU from 'three/webgpu';
import {
  abs,
  cameraPosition,
  clamp,
  color,
  cos,
  dot,
  exp,
  float,
  Fn,
  hash,
  If,
  instancedArray,
  instancedBufferAttribute,
  instanceIndex,
  length,
  luminance,
  max,
  mix,
  mrt,
  normalView,
  normalWorld,
  normalize,
  output,
  pass,
  positionLocal,
  positionView,
  positionWorld,
  pow,
  screenUV,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import {
  GPU_VISUAL_FILTER_PROFILES,
  type GpuPipelineConfig,
  type GpuRenderBackendMode,
} from './GpuEngineTypes';
import {
  selectBestGpuBackend,
  type BackendBenchSample,
} from './FramePerformanceGovernor';
import { createStarPsfMaterial } from '../UniverseShaders';
import { disposeObject3DTree } from './ThreeDisposal';

const GPU_BENCH_CACHE_KEY = 'capy_gpu_backend_bench_v1';
const GPU_BENCH_VERSION = 1;
const GPU_BENCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface WebGpuBenchmarkCacheEntry {
  version: number;
  signature: string;
  winner: 'webgpu' | 'webgl2';
  webGpuAvgMs: number;
  webGpuMaxMs: number;
  webGl2AvgMs: number;
  webGl2MaxMs: number;
  summary: string;
  testedAtMs: number;
}

export interface WebGpuProbeResult {
  supported: boolean;
  shouldUseWebGpu: boolean;
  adapterName: string;
  isFallbackAdapter: boolean;
  features: string[];
  benchmarkedWinner?: 'webgpu' | 'webgl2';
  benchmarkSummary?: string;
}

function queryGlRendererIdentity(): string {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const str = String(gl.getParameter(param) || 'WebGL2');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return str;
  } catch {
    return 'webgl-error';
  }
}

export function getCachedGpuBackendBenchmark(signature?: string): WebGpuBenchmarkCacheEntry | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(GPU_BENCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WebGpuBenchmarkCacheEntry>;
    if (
      parsed.version !== GPU_BENCH_VERSION ||
      (parsed.winner !== 'webgpu' && parsed.winner !== 'webgl2') ||
      typeof parsed.testedAtMs !== 'number' ||
      Date.now() - parsed.testedAtMs > GPU_BENCH_TTL_MS
    ) {
      return null;
    }
    if (signature && parsed.signature !== signature) {
      return null;
    }
    return parsed as WebGpuBenchmarkCacheEntry;
  } catch {
    return null;
  }
}

export function clearGpuBackendBenchmarkCache(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(GPU_BENCH_CACHE_KEY);
    }
  } catch {
    // Ignore storage issues
  }
}

function buildGpuBenchmarkScene(forWebGpu: boolean): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050816);
  const camera = new THREE.PerspectiveCamera(58, 320 / 240, 0.1, 250);
  camera.position.set(0, 3.2, 18.0);
  camera.lookAt(0, 0, 0);

  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  const dir = new THREE.DirectionalLight(0xfff4dc, 2.2);
  dir.position.set(12, 18, 14);
  scene.add(amb, dir);

  const sphereGeo = new THREE.SphereGeometry(0.85, 20, 14);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0xd99b66,
    roughness: 0.45,
    metalness: 0.25,
  });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const mesh = new THREE.Mesh(sphereGeo, sphereMat);
    mesh.position.set(Math.cos(a) * 5.2, Math.sin(i * 1.3) * 1.4, Math.sin(a) * 5.2);
    scene.add(mesh);
  }

  const starCount = 480;
  const pos = new Float32Array(starCount * 3);
  const col = new Float32Array(starCount * 3);
  const scales = new Float32Array(starCount);
  const lums = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const a = i * 2.39996;
    const r = 4.0 + (i / starCount) * 14.0;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = ((i % 17) - 8) * 0.55;
    pos[i * 3 + 2] = Math.sin(a) * r;
    col[i * 3] = 0.72 + (i % 5) * 0.06;
    col[i * 3 + 1] = 0.84;
    col[i * 3 + 2] = 1.0;
    scales[i] = 0.6 + (i % 7) * 0.22;
    lums[i] = 0.4 + (i % 4) * 0.18;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  starGeo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  starGeo.setAttribute('aLuminosity', new THREE.BufferAttribute(lums, 1));
  scene.add(
    new THREE.Points(
      starGeo,
      createStarPsfMaterial({
        baseSize: 11.0,
        minPixelSize: 1.8,
        maxPixelSize: 20.0,
        diffractionStrength: 0.35,
        opacity: 0.88,
      })
    )
  );

  if (forWebGpu) {
    convertLegacyShaderMaterialsToTsl(scene);
  }
  return { scene, camera };
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function benchmarkGpuBackends(
  adapterName: string,
  glIdentity: string
): Promise<WebGpuBenchmarkCacheEntry> {
  const signature = `${GPU_BENCH_VERSION}|${adapterName}|${glIdentity}`;
  const FRAME_COUNT = 10;

  // 1. Benchmark WebGL2 sequentially in isolation
  const glSample: BackendBenchSample = { supported: false, avgMs: 999, maxMs: 999, hadError: true };
  {
    const glCanvas = document.createElement('canvas');
    glCanvas.width = 320;
    glCanvas.height = 240;
    let glRenderer: THREE.WebGLRenderer | null = null;
    const { scene, camera } = buildGpuBenchmarkScene(false);
    try {
      glRenderer = new THREE.WebGLRenderer({
        canvas: glCanvas,
        antialias: false,
        powerPreference: 'high-performance',
      });
      glRenderer.setPixelRatio(1);
      glRenderer.setSize(320, 240, false);
      const gl = glRenderer.getContext();
      glRenderer.compile(scene, camera);
      for (let w = 0; w < 2; w++) {
        glRenderer.render(scene, camera);
      }
      gl.finish();

      let totalMs = 0;
      let maxMs = 0;
      for (let i = 0; i < FRAME_COUNT; i++) {
        const ang = i * 0.14;
        camera.position.set(Math.sin(ang) * 18, 3.2, Math.cos(ang) * 18);
        camera.lookAt(0, 0, 0);
        const t0 = performance.now();
        glRenderer.render(scene, camera);
        gl.finish();
        const dt = Math.max(0.05, performance.now() - t0);
        totalMs += dt;
        if (dt > maxMs) maxMs = dt;
      }
      glSample.supported = true;
      glSample.hadError = false;
      glSample.avgMs = totalMs / FRAME_COUNT;
      glSample.maxMs = maxMs;
    } catch {
      glSample.hadError = true;
    } finally {
      disposeObject3DTree(scene);
      try {
        glRenderer?.getContext()?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // Ignore
      }
      glRenderer?.dispose();
    }
  }

  // Yield briefly so previous GL context tears down cleanly before WebGPU bench
  await new Promise((r) => setTimeout(r, 12));

  // 2. Benchmark WebGPU WGSL + TSL Sprites sequentially in isolation
  const wgSample: BackendBenchSample = await runWithTimeout(
    (async (): Promise<BackendBenchSample> => {
      const sample: BackendBenchSample = { supported: false, avgMs: 999, maxMs: 999, hadError: false };
      const wgCanvas = document.createElement('canvas');
      wgCanvas.width = 320;
      wgCanvas.height = 240;
      let wgRenderer: THREE_WEBGPU.WebGPURenderer | null = null;
      const { scene, camera } = buildGpuBenchmarkScene(true);
      try {
        wgRenderer = new THREE_WEBGPU.WebGPURenderer({
          canvas: wgCanvas,
          antialias: false,
          powerPreference: 'high-performance',
        });
        wgRenderer.setPixelRatio(1);
        wgRenderer.setSize(320, 240, false);
        await wgRenderer.init();
        const gpuDev = (wgRenderer.backend as { device?: GPUDevice })?.device;
        const onUncaptured = () => {
          sample.hadError = true;
        };
        if (gpuDev && typeof gpuDev.addEventListener === 'function') {
          gpuDev.addEventListener('uncapturederror', onUncaptured);
        }
        try {
          for (let w = 0; w < 2; w++) {
            wgRenderer.render(scene, camera);
            if (gpuDev?.queue?.onSubmittedWorkDone) {
              await gpuDev.queue.onSubmittedWorkDone();
            }
          }

          let totalMs = 0;
          let maxMs = 0;
          for (let i = 0; i < FRAME_COUNT; i++) {
            const ang = i * 0.14;
            camera.position.set(Math.sin(ang) * 18, 3.2, Math.cos(ang) * 18);
            camera.lookAt(0, 0, 0);
            const t0 = performance.now();
            wgRenderer.render(scene, camera);
            if (gpuDev?.queue?.onSubmittedWorkDone) {
              await gpuDev.queue.onSubmittedWorkDone();
            }
            const dt = Math.max(0.05, performance.now() - t0);
            totalMs += dt;
            if (dt > maxMs) maxMs = dt;
          }
          sample.supported = true;
          sample.avgMs = totalMs / FRAME_COUNT;
          sample.maxMs = maxMs;
        } finally {
          if (gpuDev && typeof gpuDev.removeEventListener === 'function') {
            gpuDev.removeEventListener('uncapturederror', onUncaptured);
          }
        }
      } catch {
        sample.hadError = true;
      } finally {
        disposeObject3DTree(scene);
        try {
          wgRenderer?.dispose();
        } catch {
          // Ignore
        }
      }
      return sample;
    })(),
    2200,
    { supported: false, avgMs: 999, maxMs: 999, hadError: true }
  );

  const selection = selectBestGpuBackend(wgSample, glSample);
  const wgLabel =
    wgSample.supported && !wgSample.hadError ? `${wgSample.avgMs.toFixed(1)}ms` : 'ERR';
  const glLabel =
    glSample.supported && !glSample.hadError ? `${glSample.avgMs.toFixed(1)}ms` : 'ERR';
  const entry: WebGpuBenchmarkCacheEntry = {
    version: GPU_BENCH_VERSION,
    signature,
    winner: selection.winner,
    webGpuAvgMs: Number.isFinite(wgSample.avgMs) ? +wgSample.avgMs.toFixed(2) : 999,
    webGpuMaxMs: Number.isFinite(wgSample.maxMs) ? +wgSample.maxMs.toFixed(2) : 999,
    webGl2AvgMs: Number.isFinite(glSample.avgMs) ? +glSample.avgMs.toFixed(2) : 999,
    webGl2MaxMs: Number.isFinite(glSample.maxMs) ? +glSample.maxMs.toFixed(2) : 999,
    summary: `Auto-Bench picked ${selection.winner === 'webgpu' ? 'WebGPU' : 'WebGL2'} (WebGPU ${wgLabel} vs WebGL2 ${glLabel})`,
    testedAtMs: Date.now(),
  };

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(GPU_BENCH_CACHE_KEY, JSON.stringify(entry));
    }
  } catch {
    // Ignore storage issues
  }
  return entry;
}

export async function probeWebGpuBackend(
  preference: GpuRenderBackendMode = 'auto',
  isSoftwareGl: boolean = false,
  forceRetest: boolean = false
): Promise<WebGpuProbeResult> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return {
      supported: false,
      shouldUseWebGpu: false,
      adapterName: 'Unavailable',
      isFallbackAdapter: false,
      features: [],
    };
  }
  try {
    const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
    if (!gpu || typeof gpu.requestAdapter !== 'function') {
      return {
        supported: false,
        shouldUseWebGpu: false,
        adapterName: 'Unavailable',
        isFallbackAdapter: false,
        features: [],
      };
    }
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      return {
        supported: false,
        shouldUseWebGpu: false,
        adapterName: 'No Hardware Adapter',
        isFallbackAdapter: false,
        features: [],
      };
    }
    const info = (adapter as unknown as { info?: { vendor?: string; architecture?: string; description?: string; isFallbackAdapter?: boolean } }).info;
    const isFallback = Boolean(
      info?.isFallbackAdapter ||
        isSoftwareGl ||
        /SwiftShader|llvmpipe|softpipe|Microsoft Basic Render/i.test(
          `${info?.description || ''} ${info?.vendor || ''}`
        )
    );
    const desc =
      info?.description ||
      [info?.vendor, info?.architecture].filter(Boolean).join(' ') ||
      'WebGPU Adapter';
    const featureList: string[] = [];
    if (adapter.features) {
      adapter.features.forEach((f) => {
        if (featureList.length < 8) featureList.push(f);
      });
    }
    if (isFallback || preference === 'webgl2') {
      return {
        supported: !isFallback,
        shouldUseWebGpu: false,
        adapterName: desc,
        isFallbackAdapter: isFallback,
        features: featureList,
      };
    }
    if (preference === 'webgpu') {
      return {
        supported: true,
        shouldUseWebGpu: true,
        adapterName: desc,
        isFallbackAdapter: false,
        features: featureList,
      };
    }

    // preference === 'auto': run or reuse hardware benchmark comparing WebGPU vs WebGL2
    const glId = queryGlRendererIdentity();
    const signature = `${GPU_BENCH_VERSION}|${desc}|${glId}`;
    const bench =
      (!forceRetest ? getCachedGpuBackendBenchmark(signature) : null) ??
      (await benchmarkGpuBackends(desc, glId));

    return {
      supported: true,
      shouldUseWebGpu: bench.winner === 'webgpu',
      adapterName: desc,
      isFallbackAdapter: false,
      features: featureList,
      benchmarkedWinner: bench.winner,
      benchmarkSummary: bench.summary,
    };
  } catch {
    return {
      supported: false,
      shouldUseWebGpu: false,
      adapterName: 'Probe Blocked',
      isFallbackAdapter: false,
      features: [],
    };
  }
}

/**
 * TSL WGSL Rayleigh + Mie Sky Dome Material for WebGPURenderer.
 */
export function createTslSkyNodeMaterial(sharedUniforms: {
  uSunDir: { value: THREE.Vector3 };
  uZenithColor: { value: THREE.Color };
  uHorizonColor: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
  uStarIntensity: { value: number };
  uCloudCover: { value: number };
  uTime: { value: number };
}) {
  const mat = new THREE_WEBGPU.MeshBasicNodeMaterial();
  mat.side = THREE.BackSide;
  mat.depthWrite = false;

  const uSunDir = uniform(sharedUniforms.uSunDir.value);
  const uZenith = uniform(sharedUniforms.uZenithColor.value);
  const uHorizon = uniform(sharedUniforms.uHorizonColor.value);
  const uSunCol = uniform(sharedUniforms.uSunColor.value);
  const uStars = uniform(sharedUniforms.uStarIntensity.value);
  const uClouds = uniform(sharedUniforms.uCloudCover.value);
  const uTime = uniform(sharedUniforms.uTime.value);

  mat.userData.__tslSkyUniforms = {
    uSunDir,
    uZenith,
    uHorizon,
    uSunCol,
    uStars,
    uClouds,
    uTime,
  };

  mat.colorNode = Fn(() => {
    const dir = normalize(positionLocal);
    const elev = clamp(dir.y, 0.0, 1.0);
    const horizMix = pow(float(1.0).sub(elev), 2.35);
    const sky = mix(uZenith, uHorizon, horizMix).toVar();

    // Mie solar aura & disk
    const sunDot = max(float(0.0), dot(dir, normalize(uSunDir)));
    const mieHalo = pow(sunDot, 12.0).mul(0.42).add(pow(sunDot, 64.0).mul(0.85));
    const sunDisk = smoothstep(0.9985, 0.9996, sunDot).mul(2.4);
    sky.addAssign(uSunCol.mul(mieHalo.add(sunDisk)).mul(float(1.0).sub(uClouds.mul(0.75))));

    // Crisp procedural celestial night starfield
    const starCell = dir.mul(160.0).floor();
    const starSeed = hash(starCell);
    const starOn = smoothstep(0.991, 0.999, starSeed);
    const starMask = uStars.mul(smoothstep(0.06, 0.35, elev)).mul(float(1.0).sub(uClouds.mul(0.85)));
    sky.addAssign(vec3(0.88, 0.94, 1.0).mul(starOn.mul(starMask).mul(1.6)));

    // High-altitude wispy cirrus ribbons
    const windP = dir.xz.div(max(float(0.18), elev.add(0.15))).mul(1.8).add(vec2(uTime.mul(0.015), uTime.mul(0.008)));
    const wisp = sin(windP.x.mul(3.1).add(cos(windP.y.mul(2.3)))).mul(0.5).add(0.5);
    const cloudMask = smoothstep(0.45, 0.92, wisp).mul(smoothstep(0.02, 0.25, elev)).mul(uClouds.mul(0.55).add(0.12));
    sky.assign(mix(sky, uHorizon.mul(0.85).add(vec3(0.15)), cloudMask.mul(0.42)));

    return sky;
  })();

  return mat;
}

/**
 * TSL WGSL Sky-Dome Material for PMREMGenerator IBL capture.
 */
export function createTslIblSkyDomeMaterial() {
  const mat = new THREE_WEBGPU.MeshBasicNodeMaterial();
  mat.side = THREE.BackSide;
  mat.colorNode = Fn(() => {
    const dir = normalize(positionLocal);
    const up = clamp(dir.y, -1.0, 1.0);
    const skyT = smoothstep(-0.1, 0.75, up);
    const groundCol = vec3(0.09, 0.14, 0.11);
    const horizonCol = vec3(0.68, 0.86, 0.98);
    const zenithCol = vec3(0.18, 0.52, 0.88);
    const col = mix(groundCol, horizonCol, smoothstep(-0.25, 0.1, up)).toVar();
    col.assign(mix(col, zenithCol, skyT));
    const sunDot = max(float(0.0), dot(dir, normalize(vec3(0.44, 0.82, 0.37))));
    col.addAssign(vec3(1.0, 0.96, 0.88).mul(pow(sunDot, 28.0).mul(1.6)));
    return col;
  })();
  return mat;
}

/**
 * TSL WGSL Ocean / Lagoon Clearcoat Physical Material with Solar & Lunar Glint Reflections.
 */
export function createTslWaterPhysicalNodeMaterial(opts: {
  baseColorHex: number;
  normalMap: THREE.Texture;
  clearcoatNormalMap?: THREE.Texture;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  roughness?: number;
  opacity?: number;
  transparent?: boolean;
}) {
  const mat = new THREE_WEBGPU.MeshPhysicalNodeMaterial();
  mat.color.setHex(opts.baseColorHex);
  mat.roughness = opts.roughness ?? 0.05;
  mat.metalness = 0.0;
  mat.ior = 1.333;
  mat.reflectivity = 0.92;
  mat.clearcoat = 1.0;
  mat.clearcoatRoughness = 0.035;
  mat.normalMap = opts.normalMap;
  mat.normalScale.set(0.65, 0.65);
  if (opts.clearcoatNormalMap) {
    mat.clearcoatNormalMap = opts.clearcoatNormalMap;
    mat.clearcoatNormalScale.set(0.45, 0.45);
  }
  if (opts.transparent) {
    mat.transparent = true;
    mat.opacity = opts.opacity ?? 0.88;
  }

  const uSunDir = uniform(opts.sunDir);
  const uSunCol = uniform(opts.sunColor);
  const uSunStrength = uniform(1.0);
  const uWaterTime = uniform(0.0);

  mat.userData.__tslWaterUniforms = {
    uSunDir,
    uSunCol,
    uSunStrength,
    uWaterTime,
  };

  // Directional Sun/Moon specular water sparkle reflection ONLY when sun/moon illuminates water surface
  mat.emissiveNode = Fn(() => {
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const waveN = normalize(
      vec3(
        sin(positionWorld.x.mul(1.8).add(uWaterTime.mul(1.4))).mul(0.06),
        float(1.0),
        cos(positionWorld.z.mul(1.6).sub(uWaterTime.mul(1.1))).mul(0.06)
      )
    );
    const L = normalize(uSunDir);
    const H = normalize(L.add(viewDir));
    const nDotH = max(float(0.0), dot(waveN, H));
    const specTight = pow(nDotH, 140.0).mul(1.35);
    const specBroad = pow(nDotH, 28.0).mul(0.18);
    const fres = float(0.04).add(pow(float(1.0).sub(max(float(0.0), dot(waveN, viewDir))), 5.0).mul(0.65));
    return uSunCol.mul(specTight.add(specBroad).mul(fres.add(0.35))).mul(uSunStrength);
  })();

  return mat;
}

/**
 * Attaches a TSL WGSL whole-screen sightline fade to a standard/physical material on WebGPU.
 */
export function upgradeMaterialWithTslSightlineFade(mat: THREE.Material): { value: number } {
  const blendUniform = uniform(0.0);
  const nodeMat = mat as unknown as {
    opacityNode?: unknown;
    transparent: boolean;
  };
  const baseOpacity = typeof mat.opacity === 'number' ? mat.opacity : 1.0;
  nodeMat.transparent = true;
  nodeMat.opacityNode = Fn(() => {
    const bx = abs(screenUV.x.mul(2.0).sub(1.0));
    const by = abs(screenUV.y.mul(2.0).sub(1.0));
    const rx = max(bx.sub(0.978), 0.0).div(0.022);
    const ry = max(by.sub(0.978), 0.0).div(0.022);
    const edgeDist = clamp(length(vec2(rx, ry)), 0.0, 1.0);
    const screenEdgeFade = edgeDist.mul(edgeDist).mul(float(3.0).sub(edgeDist.mul(2.0)));
    const targetOcc = screenEdgeFade.mul(float(0.75).add(screenEdgeFade.mul(0.25))).mul(0.05);
    return clamp(mix(float(baseOpacity), targetOcc, blendUniform), 0.0, 1.0);
  })();
  return blendUniform as unknown as { value: number };
}

/**
 * TSL WGSL Instanced Star PSF Sprite Material (replaces WebGL Points gl_PointSize on WebGPU).
 */
export function createTslStarPsfSprite(
  posAttr: THREE.BufferAttribute,
  colAttr: THREE.BufferAttribute,
  scaleAttr?: THREE.BufferAttribute,
  opts: {
    baseSize?: number;
    distFactor?: number;
    minPixelSize?: number;
    maxPixelSize?: number;
    opacity?: number;
    additive?: boolean;
  } = {}
): { sprite: THREE_WEBGPU.Sprite; opacityUniform: { value: number } } {
  const mat = new THREE_WEBGPU.PointsNodeMaterial();
  mat.transparent = true;
  mat.depthWrite = false;
  mat.sizeAttenuation = false;
  mat.blending = opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending;
  mat.normalNode = vec3(0.0, 0.0, 1.0);

  const uOpacity = uniform(opts.opacity ?? 1.0);
  const uBaseSize = uniform(opts.baseSize ?? 14.0);
  const distFactor = opts.distFactor ?? 28.0;
  const minPixelSize = opts.minPixelSize ?? 1.8;
  const maxPixelSize = opts.maxPixelSize ?? 22.0;

  mat.positionNode = instancedBufferAttribute(posAttr);
  mat.colorNode = instancedBufferAttribute(colAttr);
  const dist = max(float(0.35), positionView.z.negate());
  const rawSize = scaleAttr
    ? instancedBufferAttribute(scaleAttr).mul(uBaseSize)
    : uBaseSize;
  mat.sizeNode = clamp(
    rawSize.mul(float(distFactor).div(dist)),
    float(minPixelSize),
    float(maxPixelSize)
  );

  mat.opacityNode = Fn(() => {
    const p = uv().sub(0.5).mul(2.0);
    const r = length(p);
    const core = exp(r.mul(r).mul(-14.0));
    const halo = exp(r.mul(-4.2)).mul(0.38).mul(float(1.0).sub(smoothstep(0.65, 1.0, r)));
    return clamp(core.add(halo).mul(uOpacity), 0.0, 1.0);
  })();

  const sprite = new THREE_WEBGPU.Sprite(mat);
  sprite.count = posAttr.count;
  sprite.frustumCulled = false;
  mat.userData.__tslOpacityUniform = uOpacity;
  return {
    sprite,
    opacityUniform: uOpacity as unknown as { value: number },
  };
}

/**
 * Converts a legacy GLSL ShaderMaterial mesh/group in the scene into a safe TSL NodeMaterial
 * so WebGPURenderer (WGSL) NEVER sees an incompatible raw GLSL ShaderMaterial.
 */
export function convertLegacyShaderMaterialsToTsl(root: THREE.Object3D): number {
  let convertedCount = 0;
  const pointUpgrades: Array<{
    parent: THREE.Object3D;
    oldPoints: THREE.Points;
    sprite: THREE_WEBGPU.Sprite;
  }> = [];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const points = obj as THREE.Points;
    const mat = mesh.material as THREE.ShaderMaterial | undefined;
    if (!mat || !(mat as THREE.ShaderMaterial).isShaderMaterial) return;

    // 1. Points with ShaderMaterial -> single-draw instanced THREE_WEBGPU.Sprite(PointsNodeMaterial)
    if (points.isPoints && points.geometry && points.parent) {
      const posAttr = points.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (posAttr) {
        let colAttr = points.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
        if (!colAttr) {
          const fallbackCols = new Float32Array(posAttr.count * 3).fill(1.0);
          colAttr = new THREE.BufferAttribute(fallbackCols, 3);
        }
        const scaleAttr = points.geometry.getAttribute('aScale') as THREE.BufferAttribute | undefined;
        const hasBaseSize = typeof mat.uniforms?.uBaseSize?.value === 'number';
        const { sprite } = createTslStarPsfSprite(posAttr, colAttr, scaleAttr, {
          baseSize: hasBaseSize ? (mat.uniforms.uBaseSize.value as number) : 1.0,
          distFactor: hasBaseSize ? 28.0 : 120.0,
          minPixelSize:
            (mat.uniforms?.uMinPx?.value as number | undefined) ?? (hasBaseSize ? 1.8 : 2.2),
          maxPixelSize:
            (mat.uniforms?.uMaxPx?.value as number | undefined) ?? (hasBaseSize ? 22.0 : 26.0),
          opacity: (mat.uniforms?.uOpacity?.value as number | undefined) ?? 0.9,
          additive: mat.blending === THREE.AdditiveBlending,
        });
        sprite.position.copy(points.position);
        sprite.rotation.copy(points.rotation);
        sprite.scale.copy(points.scale);
        sprite.visible = points.visible;
        sprite.name = points.name;
        pointUpgrades.push({ parent: points.parent, oldPoints: points, sprite });
        convertedCount++;
      }
      return;
    }

    // 2. Mesh with ShaderMaterial -> Procedural TSL MeshBasicNodeMaterial / MeshStandardNodeMaterial
    if (mesh.isMesh) {
      const u = mat.uniforms || {};
      const nodeMat = new THREE_WEBGPU.MeshBasicNodeMaterial();
      nodeMat.transparent = mat.transparent;
      nodeMat.depthWrite = mat.depthWrite;
      nodeMat.side = mat.side;
      nodeMat.blending = mat.blending;
      nodeMat.normalNode = vec3(0.0, 0.0, 1.0);

      const baseColHex =
        u.uBaseCol?.value instanceof THREE.Color
          ? u.uBaseCol.value
          : u.uRayleigh?.value instanceof THREE.Color
            ? u.uRayleigh.value
            : new THREE.Color(0x38bdf8);
      const uCol = uniform(baseColHex);
      const uOp = uniform(
        typeof u.uOpacity?.value === 'number' ? u.uOpacity.value : 0.85
      );
      nodeMat.userData.__tslOpacityUniform = uOp;
      nodeMat.colorNode = Fn(() => {
        const n = sin(positionLocal.x.mul(3.0).add(positionLocal.y.mul(2.5))).mul(0.18).add(0.82);
        return uCol.mul(n);
      })();
      nodeMat.opacityNode = Fn(() => {
        const edge = float(1.0).sub(clamp(length(uv().sub(0.5).mul(2.0)), 0.0, 1.0));
        return clamp(edge.mul(1.25).mul(uOp), 0.0, 1.0);
      })();
      mesh.material = nodeMat;
      mat.dispose();
      convertedCount++;
    }
  });

  for (let i = 0; i < pointUpgrades.length; i++) {
    const up = pointUpgrades[i];
    up.parent.add(up.sprite);
    up.parent.remove(up.oldPoints);
    if (Array.isArray(up.oldPoints.material)) {
      up.oldPoints.material.forEach((m) => m.dispose());
    } else {
      up.oldPoints.material?.dispose();
    }
  }

  return convertedCount;
}

const COMPUTE_MOTE_COUNT = 1024;

/**
 * Full WebGPU Pipeline:
 * - `THREE_WEBGPU.WebGPURenderer` (WGSL backend)
 * - TSL `PostProcessing` graph: MRT(`output`, `normalView`) -> GTAO(`ao`) -> HDR `bloom` -> Color Grade -> `fxaa`
 * - WGSL Compute Particle System (`1024` atmospheric fireflies/pollen motes simulated completely on GPU)
 */
export class WebGpuPostAndComputePipeline {
  public readonly renderer: THREE_WEBGPU.WebGPURenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly adapterName: string;

  private postProcessing: THREE_WEBGPU.PostProcessing | null = null;
  private config: GpuPipelineConfig;

  // TSL Color Grading & Bloom uniforms
  private readonly uBloomStrength = uniform(0.24);
  private readonly uAoStrength = uniform(0.32);
  private readonly uSaturation = uniform(1.04);
  private readonly uContrast = uniform(1.03);
  private readonly uLift = uniform(0.0);
  private readonly uGamma = uniform(1.0);
  private readonly uTint = uniform(new THREE.Vector3(1.0, 1.0, 1.0));
  private readonly uVignette = uniform(0.18);

  // WGSL GPU Compute Particle System (`1024` fireflies / sunlit pollen motes)
  private readonly computeDelta = uniform(0.016);
  private readonly computeTime = uniform(0.0);
  private readonly computeAnchor = uniform(new THREE.Vector3(0, 0, 0));
  private readonly computeNight = uniform(0.0);
  private computeInitNode: THREE_WEBGPU.ComputeNode | null = null;
  private computeUpdateNode: THREE_WEBGPU.ComputeNode | null = null;
  public readonly computeSprite: THREE_WEBGPU.Sprite;
  private computeInitialized = false;
  private disposed = false;

  constructor(
    renderer: THREE_WEBGPU.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    adapterName: string,
    initialConfig: GpuPipelineConfig
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.adapterName = adapterName;
    this.config = { ...initialConfig };

    // Build WGSL GPU Compute Shader for 1024 ambient firefly / daylight pollen motes
    const positions = instancedArray(COMPUTE_MOTE_COUNT, 'vec3');
    const velocities = instancedArray(COMPUTE_MOTE_COUNT, 'vec3');
    const phases = instancedArray(COMPUTE_MOTE_COUNT, 'float');

    this.computeInitNode = Fn(() => {
      const pos = positions.element(instanceIndex);
      const vel = velocities.element(instanceIndex);
      const ph = phases.element(instanceIndex);
      const rx = hash(instanceIndex).sub(0.5).mul(46.0);
      const ry = hash(instanceIndex.add(101)).mul(6.2).add(0.45);
      const rz = hash(instanceIndex.add(203)).sub(0.5).mul(46.0);
      pos.assign(vec3(rx, ry, rz));
      vel.assign(
        vec3(
          hash(instanceIndex.add(307)).sub(0.5).mul(0.8),
          hash(instanceIndex.add(409)).sub(0.5).mul(0.35),
          hash(instanceIndex.add(503)).sub(0.5).mul(0.8)
        )
      );
      ph.assign(hash(instanceIndex.add(617)).mul(6.28318));
    })().compute(COMPUTE_MOTE_COUNT);

    this.computeUpdateNode = Fn(() => {
      const pos = positions.element(instanceIndex);
      const vel = velocities.element(instanceIndex);
      const ph = phases.element(instanceIndex);
      const dt = this.computeDelta;
      const t = this.computeTime;

      const swirlX = sin(t.mul(0.85).add(ph)).mul(0.45);
      const swirlY = cos(t.mul(1.25).add(ph.mul(1.3))).mul(0.22);
      const swirlZ = cos(t.mul(0.75).sub(ph)).mul(0.45);
      pos.x.addAssign(vel.x.add(swirlX).mul(dt));
      pos.y.addAssign(vel.y.add(swirlY).mul(dt));
      pos.z.addAssign(vel.z.add(swirlZ).mul(dt));

      // Keep motes orbiting cleanly inside 28m dome around active Sanctuary focus
      const dx = pos.x.sub(this.computeAnchor.x);
      const dz = pos.z.sub(this.computeAnchor.z);
      If(dx.greaterThan(26.0), () => {
        pos.x.subAssign(52.0);
      });
      If(dx.lessThan(-26.0), () => {
        pos.x.addAssign(52.0);
      });
      If(dz.greaterThan(26.0), () => {
        pos.z.subAssign(52.0);
      });
      If(dz.lessThan(-26.0), () => {
        pos.z.addAssign(52.0);
      });
      If(pos.y.lessThan(0.3), () => {
        pos.y.assign(5.8);
      });
      If(pos.y.greaterThan(7.0), () => {
        pos.y.assign(0.5);
      });
    })().compute(COMPUTE_MOTE_COUNT);

    const moteMat = new THREE_WEBGPU.PointsNodeMaterial();
    moteMat.transparent = true;
    moteMat.depthWrite = false;
    moteMat.sizeAttenuation = false;
    moteMat.blending = THREE.AdditiveBlending;
    moteMat.normalNode = vec3(0.0, 0.0, 1.0);
    moteMat.positionNode = positions.element(instanceIndex);
    const moteDist = max(float(1.5), positionView.z.negate());
    moteMat.sizeNode = clamp(
      float(5.5).add(this.computeNight.mul(4.5)).mul(float(14.0).div(moteDist)),
      float(2.5),
      float(14.0)
    );
    moteMat.colorNode = Fn(() => {
      const dayCol = vec3(1.0, 0.94, 0.72);
      const nightCol = vec3(0.45, 0.98, 0.75);
      const twinkle = sin(this.computeTime.mul(3.2).add(phases.element(instanceIndex))).mul(0.35).add(0.65);
      return mix(dayCol, nightCol, this.computeNight).mul(twinkle);
    })();
    moteMat.opacityNode = Fn(() => {
      const p = uv().sub(0.5).mul(2.0);
      const r = length(p);
      const falloff = exp(r.mul(r).mul(-8.5));
      return clamp(falloff.mul(float(0.28).add(this.computeNight.mul(0.48))), 0.0, 0.85);
    })();

    this.computeSprite = new THREE_WEBGPU.Sprite(moteMat);
    this.computeSprite.count = COMPUTE_MOTE_COUNT;
    this.computeSprite.frustumCulled = false;
    this.computeSprite.userData.ignoreCameraFade = true;
    this.scene.add(this.computeSprite);

    this.rebuildPostProcessing();
    this.applyConfig(this.config);
  }

  public rebuildPostProcessing(): void {
    if (this.postProcessing) {
      this.postProcessing.dispose();
      this.postProcessing = null;
    }
    if (!this.config.postProcessingEnabled) {
      return;
    }

    const postProcessing = new THREE_WEBGPU.PostProcessing(this.renderer);
    const scenePass = pass(this.scene, this.camera);
    scenePass.setMRT(
      mrt({
        output,
        normal: normalView,
      })
    );
    const scenePassColor = scenePass.getTextureNode('output');
    const scenePassDepth = scenePass.getTextureNode('depth');
    const scenePassNormal = scenePass.getTextureNode('normal');

    // 1. TSL Ground-Truth Ambient Occlusion (GTAO) when SSAO enabled
    const afterAo = this.config.ssaoEnabled
      ? (() => {
          const aoPass = ao(scenePassDepth, scenePassNormal, this.camera);
          aoPass.resolutionScale = this.config.qualityPreset === 'ultra' ? 0.85 : 0.6;
          const aoFactor = mix(float(1.0), aoPass.getTextureNode(), this.uAoStrength);
          return scenePassColor.mul(aoFactor);
        })()
      : scenePassColor;

    // 2. TSL Filmic HDR Bloom
    const workingColor = this.config.bloomEnabled
      ? (() => {
          const bloomPass = bloom(
            afterAo,
            this.config.bloomStrength ?? 0.24,
            0.42,
            0.82
          );
          return afterAo.add(
            bloomPass.mul(
              this.uBloomStrength.div(Math.max(0.01, this.config.bloomStrength || 0.24))
            )
          );
        })()
      : afterAo;

    // 3. TSL Color Grading + Optical Vignette
    const graded = Fn(() => {
      let c = max(vec3(0.0), workingColor.rgb.add(vec3(this.uLift)).mul(this.uTint));
      c = pow(max(c, vec3(0.0001)), vec3(this.uGamma));
      c = max(vec3(0.0), c.sub(0.18).mul(this.uContrast).add(0.18));
      const luma = luminance(c);
      c = max(vec3(0.0), mix(vec3(luma), c, this.uSaturation));
      const dist = length(uv().sub(0.5));
      const vig = clamp(float(1.0).sub(dist.mul(dist).mul(this.uVignette).mul(1.45)), 0.28, 1.0);
      return vec4(c.mul(vig), workingColor.a);
    })();

    // 4. TSL Hardware FXAA
    postProcessing.outputNode =
      this.config.antiAliasing === 'none' ? graded : fxaa(graded);
    this.postProcessing = postProcessing;
  }

  public applyConfig(cfg: GpuPipelineConfig): void {
    const needRebuild =
      cfg.postProcessingEnabled !== this.config.postProcessingEnabled ||
      cfg.bloomEnabled !== this.config.bloomEnabled ||
      cfg.ssaoEnabled !== this.config.ssaoEnabled ||
      cfg.antiAliasing !== this.config.antiAliasing ||
      cfg.qualityPreset !== this.config.qualityPreset;

    this.config = { ...cfg };

    const tm =
      cfg.toneMapping === 'aces'
        ? THREE.ACESFilmicToneMapping
        : cfg.toneMapping === 'neutral'
          ? THREE.NeutralToneMapping
          : cfg.toneMapping === 'reinhard'
            ? THREE.ReinhardToneMapping
            : THREE.AgXToneMapping;
    this.renderer.toneMapping = tm;
    this.renderer.toneMappingExposure = cfg.exposure;

    const profile =
      GPU_VISUAL_FILTER_PROFILES[cfg.visualFilterPreset] ??
      GPU_VISUAL_FILTER_PROFILES.natural_pbr;
    this.uSaturation.value = profile.saturation;
    this.uContrast.value = profile.contrast;
    this.uLift.value = profile.brightnessLift;
    this.uGamma.value = profile.gamma;
    this.uTint.value.set(
      profile.temperatureTintR,
      profile.temperatureTintG,
      profile.temperatureTintB
    );
    this.uVignette.value = profile.vignetteIntensity;
    this.uBloomStrength.value = cfg.bloomEnabled ? cfg.bloomStrength : 0;
    this.uAoStrength.value = cfg.ssaoEnabled ? 0.34 : 0;

    if (needRebuild) {
      this.rebuildPostProcessing();
    }
  }

  public stepComputeAndRender(
    dt: number,
    focusX: number,
    focusY: number,
    focusZ: number,
    nightFactor: number,
    surfaceParticlesVisible: boolean
  ): void {
    if (this.disposed) return;

    if (this.renderer.info?.autoReset !== false) {
      this.renderer.info?.reset?.();
    }

    this.computeSprite.visible = surfaceParticlesVisible;
    if (surfaceParticlesVisible && this.computeInitNode && this.computeUpdateNode) {
      if (!this.computeInitialized) {
        this.renderer.compute(this.computeInitNode);
        this.computeInitialized = true;
      }
      this.computeDelta.value = Math.min(0.05, Math.max(0.001, dt));
      this.computeTime.value += this.computeDelta.value;
      this.computeAnchor.value.set(focusX, focusY, focusZ);
      this.computeNight.value = nightFactor;
      this.renderer.compute(this.computeUpdateNode);
    }

    if (this.postProcessing && this.config.postProcessingEnabled) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setSize(width: number, height: number, dpr: number): void {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(Math.max(1, width), Math.max(1, height));
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.computeSprite);
    this.computeSprite.geometry.dispose();
    (this.computeSprite.material as THREE.Material).dispose();
    this.postProcessing?.dispose();
    this.postProcessing = null;
  }
}

export { texture };
