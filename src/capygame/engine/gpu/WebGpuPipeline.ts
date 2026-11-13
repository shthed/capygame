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

export interface WebGpuProbeResult {
  supported: boolean;
  shouldUseWebGpu: boolean;
  adapterName: string;
  isFallbackAdapter: boolean;
  features: string[];
}

export async function probeWebGpuBackend(
  preference: GpuRenderBackendMode = 'auto',
  isSoftwareGl: boolean = false
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
    const shouldUseWebGpu = !isFallback && preference !== 'webgl2';
    return {
      supported: !isFallback,
      shouldUseWebGpu,
      adapterName: desc,
      isFallbackAdapter: isFallback,
      features: featureList,
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
  opts: { baseSize?: number; opacity?: number; additive?: boolean } = {}
): { sprite: THREE_WEBGPU.Sprite; opacityUniform: { value: number } } {
  const mat = new THREE_WEBGPU.PointsNodeMaterial();
  mat.transparent = true;
  mat.depthWrite = false;
  mat.blending = opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending;
  mat.normalNode = vec3(0.0, 0.0, 1.0);

  const uOpacity = uniform(opts.opacity ?? 1.0);
  const uBaseSize = uniform(opts.baseSize ?? 14.0);

  mat.positionNode = instancedBufferAttribute(posAttr);
  mat.colorNode = instancedBufferAttribute(colAttr);
  mat.sizeNode = scaleAttr
    ? instancedBufferAttribute(scaleAttr).mul(uBaseSize)
    : uBaseSize;

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
        const { sprite } = createTslStarPsfSprite(posAttr, colAttr, scaleAttr, {
          baseSize: (mat.uniforms?.uBaseSize?.value as number | undefined) ?? 12.0,
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
    moteMat.blending = THREE.AdditiveBlending;
    moteMat.normalNode = vec3(0.0, 0.0, 1.0);
    moteMat.positionNode = positions.element(instanceIndex);
    moteMat.sizeNode = float(8.5).add(this.computeNight.mul(7.0));
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
    if (!this.config.postProcessingEnabled) {
      this.postProcessing = null;
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
