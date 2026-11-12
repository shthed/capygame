import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  DEFAULT_GPU_PIPELINE_CONFIG,
  GPU_VISUAL_FILTER_PROFILES,
  type GpuEngineTelemetry,
  type GpuPipelineConfig,
  type GpuQualityPreset,
} from './GpuEngineTypes';
import { PbrTextureSynthesizer } from './PbrTextureSynthesizer';
import {
  computeBloomRenderScale,
  computeEffectivePixelRatio,
  computeTexelSnappedShadowOrigin,
} from './FramePerformanceGovernor';

// Zero-allocation scratch vectors for shadow cascade snapping & rim light positioning
const _sunOffsetDir = new THREE.Vector3(0.44, 0.82, 0.37).normalize();

/**
 * Fused single-pass GPU screen-space post-processing shader combining:
 * 1. Linearized Depth-Buffer Screen-Space Cavity / Ambient Occlusion (4-tap cross SSAO)
 * 2. Contrast-Adaptive Unsharp Mask (CAS) Texture Sharpening
 * 3. Radial Lens Chromatic Dispersion
 * 4. Smooth Cosine-Fourth Optical Vignette
 * 5. Parametric Color Grading (Lift / Gamma / Contrast / Saturation / Color Temperature / CRT Scanlines)
 */
const CapyGpuMasterFilterShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.DepthTexture | null },
    uHasDepth: { value: 0.0 },
    uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uCameraNear: { value: 0.1 },
    uCameraFar: { value: 1350.0 },
    uSsaoStrength: { value: 0.28 },
    uSharpen: { value: 0.28 },
    uSaturation: { value: 1.04 },
    uContrast: { value: 1.03 },
    uLift: { value: 0.0 },
    uGamma: { value: 1.0 },
    uTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    uVignette: { value: 0.16 },
    uChromatic: { value: 0.0006 },
    uScanlines: { value: 0.0 },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float uHasDepth;
    uniform vec2 uTexelSize;
    uniform float uCameraNear;
    uniform float uCameraFar;
    uniform float uSsaoStrength;
    uniform float uSharpen;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uLift;
    uniform float uGamma;
    uniform vec3 uTint;
    uniform float uVignette;
    uniform float uChromatic;
    uniform float uScanlines;
    uniform float uTime;

    varying vec2 vUv;

    float readLinearDepth(vec2 uv) {
      float z_b = texture2D(tDepth, uv).x;
      float z_n = 2.0 * z_b - 1.0;
      return (2.0 * uCameraNear * uCameraFar) /
        max(0.0001, uCameraFar + uCameraNear - z_n * (uCameraFar - uCameraNear));
    }

    void main() {
      vec2 centerOffset = vUv - vec2(0.5);
      float radialDist = length(centerOffset);

      // 1. Radial Lens Chromatic Dispersion + Single-Tap Center Fetch
      vec4 baseTap = texture2D(tDiffuse, vUv);
      vec3 col = baseTap.rgb;
      float alpha = baseTap.a;
      if (uChromatic > 0.00005) {
        vec2 disp = centerOffset * uChromatic * radialDist * 1.8;
        col.r = texture2D(tDiffuse, clamp(vUv - disp, 0.001, 0.999)).r;
        col.b = texture2D(tDiffuse, clamp(vUv + disp, 0.001, 0.999)).b;
      }

      float dCenter = (uHasDepth > 0.5) ? readLinearDepth(vUv) : 18.0;
      float farDofMix = (uHasDepth > 0.5 && dCenter < uCameraFar * 0.90)
        ? smoothstep(95.0, 265.0, dCenter) * 0.42
        : 0.0;

      // 2. Contrast-Adaptive Unsharp Mask (CAS) Foreground Sharpening + Far-Horizon Optical Depth-of-Field Bokeh
      if (uSharpen > 0.005 || farDofMix > 0.005) {
        vec2 tapStep = uTexelSize * (1.0 + farDofMix * 2.2);
        vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, tapStep.y)).rgb;
        vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, tapStep.y)).rgb;
        vec3 e = texture2D(tDiffuse, vUv + vec2(tapStep.x, 0.0)).rgb;
        vec3 w = texture2D(tDiffuse, vUv - vec2(tapStep.x, 0.0)).rgb;
        vec3 avg = (n + s + e + w) * 0.25;

        if (farDofMix > 0.005) {
          col = mix(col, avg, farDofMix);
        } else if (uSharpen > 0.005) {
          vec3 minC = min(col, min(min(n, s), min(e, w)));
          vec3 maxC = max(col, max(max(n, s), max(e, w)));
          vec3 localRange = maxC - minC;
          float casWeight = clamp(1.0 - dot(localRange, vec3(0.333)) * 0.65, 0.15, 1.0);
          col = max(vec3(0.0), col + (col - avg) * (uSharpen * 1.35 * casWeight));
        }
      }

      // 3. Hardware Depth-Buffer Screen-Space Cavity / Contact Ambient Occlusion (Smooth C1 Depth Rejection)
      if (uHasDepth > 0.5 && uSsaoStrength > 0.005) {
        // Skip sky / far cosmic background
        if (dCenter < uCameraFar * 0.65) {
          vec2 step1 = uTexelSize * 2.5;
          vec2 step2 = uTexelSize * 5.5;
          float dN = readLinearDepth(vUv + vec2(0.0, step1.y));
          float dS = readLinearDepth(vUv - vec2(0.0, step1.y));
          float dE = readLinearDepth(vUv + vec2(step1.x, 0.0));
          float dW = readLinearDepth(vUv - vec2(step1.x, 0.0));
          float dNE = readLinearDepth(vUv + step2 * 0.707);
          float dSW = readLinearDepth(vUv - step2 * 0.707);

          float occ = 0.0;
          float scaleNorm = max(0.35, dCenter * 0.045);
          float diff1 = (dCenter - dN) / scaleNorm;
          occ += max(0.0, diff1) * smoothstep(0.02, 0.12, diff1) * (1.0 - smoothstep(0.70, 1.40, diff1));
          float diff2 = (dCenter - dS) / scaleNorm;
          occ += max(0.0, diff2) * smoothstep(0.02, 0.12, diff2) * (1.0 - smoothstep(0.70, 1.40, diff2));
          float diff3 = (dCenter - dE) / scaleNorm;
          occ += max(0.0, diff3) * smoothstep(0.02, 0.12, diff3) * (1.0 - smoothstep(0.70, 1.40, diff3));
          float diff4 = (dCenter - dW) / scaleNorm;
          occ += max(0.0, diff4) * smoothstep(0.02, 0.12, diff4) * (1.0 - smoothstep(0.70, 1.40, diff4));
          float diff5 = (dCenter - (dNE + dSW) * 0.5) / (scaleNorm * 1.4);
          occ += max(0.0, diff5) * smoothstep(0.02, 0.12, diff5) * (1.0 - smoothstep(0.70, 1.40, diff5));

          float aoFactor = 1.0 - clamp(occ * 0.24 * uSsaoStrength, 0.0, 0.38);
          col *= aoFactor;
        }
      }

      // 4. Parametric Filmic Color Grading (Color Temperature, Lift, Gamma, Contrast, Saturation)
      col = max(vec3(0.0), (col + vec3(uLift)) * uTint);
      if (abs(uGamma - 1.0) > 0.005) {
        col = pow(max(col, vec3(0.0001)), vec3(uGamma));
      }
      col = max(vec3(0.0), (col - 0.18) * uContrast + 0.18);
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = max(vec3(0.0), mix(vec3(luma), col, uSaturation));

      // 5. Optional Retro CRT Phosphor Scanlines (stationary row phase so scanlines never strobe)
      if (uScanlines > 0.005) {
        float row = vUv.y / max(0.0005, uTexelSize.y);
        float scan = 1.0 - uScanlines * (0.5 + 0.5 * sin(row * 3.14159265));
        col *= scan;
      }

      // 6. Smooth Optical Vignette
      if (uVignette > 0.005) {
        float vig = clamp(1.0 - radialDist * radialDist * uVignette * 1.45, 0.28, 1.0);
        col *= vig;
      }

      gl_FragColor = vec4(col, alpha);
    }
  `,
};

/**
 * Renders the 3D scene + hardware DepthTexture into an isolated off-ping-pong FBO
 * (`sceneCaptureTarget`) and blits HDR color into EffectComposer's `readBuffer`.
 * This guarantees `depthTexture` is NEVER bound as a DRAW_FRAMEBUFFER attachment
 * when `CapyGpuMasterFilterShader` samples `tDepth` (eliminating WebGL2 feedback-loop flicker).
 */
class SceneDepthCapturePass extends Pass {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly sceneCaptureTarget: THREE.WebGLRenderTarget | null;
  private readonly copyMaterial: THREE.ShaderMaterial;
  private readonly fsQuad: FullScreenQuad;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    sceneCaptureTarget: THREE.WebGLRenderTarget | null
  ) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.sceneCaptureTarget = sceneCaptureTarget;
    this.needsSwap = false;

    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      transparent: false,
      depthTest: false,
      depthWrite: false,
    });
    this.fsQuad = new FullScreenQuad(this.copyMaterial);
  }

  public override render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ): void {
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    if (this.sceneCaptureTarget) {
      renderer.setRenderTarget(this.sceneCaptureTarget);
      renderer.clear(true, true, false);
      renderer.render(this.scene, this.camera);

      this.copyMaterial.uniforms['tDiffuse'].value = this.sceneCaptureTarget.texture;
      renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
      if (!this.renderToScreen) {
        renderer.clear(true, false, false);
      }
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
      renderer.clear(true, true, false);
      renderer.render(this.scene, this.camera);
    }

    renderer.autoClear = prevAutoClear;
  }

  public override dispose(): void {
    this.copyMaterial.dispose();
    this.fsQuad.dispose();
  }
}

/**
 * Hardware-Accelerated 3D GPU Engine managing:
 * - WebGL2 HDR Renderer, GPU capability probing, and WebGL context-loss recovery
 * - Studio & Outdoor 3-Point Lighting + Rim Backlight + Hardware `RectAreaLight` Softbox
 * - Texel-Snapped Hero-Centered Directional Shadow Cascade (`2048` / `4096`) across the entire contiguous world
 * - Soft Gaussian Hero Contact Shadow Grounding Decal
 * - Multi-Pass HDR Post-Processing (`EffectComposer`: MSAA `HalfFloatType` RenderTarget + DepthTexture +
 *   `UnrealBloomPass` + Fused `CapyGpuMasterFilterShader` [SSAO Cavity + CAS Sharpen + Chromatic + Vignette +
 *   6 Color Grading Filters] + `OutputPass` + `FXAAShader`)
 */
export class HardwareGpuEngine {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly isSoftwareGl: boolean;
  public readonly gpuRendererString: string;
  public readonly maxHardwareAnisotropy: number;
  public readonly maxTextureSize: number;

  // Upgraded Studio + Outdoor Lighting Rig & IBL Environment
  public readonly sunLight: THREE.DirectionalLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly studioAreaLight: THREE.RectAreaLight | null;
  public readonly iblEnvironmentTexture: THREE.Texture | null;
  public readonly heroContactShadowMesh: THREE.Mesh;
  private readonly heroContactShadowMat: THREE.MeshBasicMaterial;

  // Multi-Pass Post-Processing Composer & Render Targets
  private composer: EffectComposer | null = null;
  private renderTarget: THREE.WebGLRenderTarget | null = null;
  private sceneCaptureTarget: THREE.WebGLRenderTarget | null = null;
  private depthTexture: THREE.DepthTexture | null = null;
  private renderPass: SceneDepthCapturePass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private masterFilterPass: ShaderPass | null = null;
  private outputPass: OutputPass | null = null;
  private fxaaPass: ShaderPass | null = null;

  private config: GpuPipelineConfig = { ...DEFAULT_GPU_PIPELINE_CONFIG };
  private viewportWidth: number = 1280;
  private viewportHeight: number = 720;
  private activeMsaaSamples: number = 0;
  private activeShadowMapSize: number = 2048;
  private contextLost: boolean = false;
  private elapsedTime: number = 0;
  private forceSoftwarePostProcess: boolean = false;
  private lastSnappedShadowX: number = Number.NaN;
  private lastSnappedShadowZ: number = Number.NaN;

  // Cached event listeners for clean disposal
  private readonly onContextLostHandler: (e: Event) => void;
  private readonly onContextRestoredHandler: () => void;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    sunLight: THREE.DirectionalLight,
    isSoftwareGl: boolean,
    initialWidth: number,
    initialHeight: number,
    initialConfig?: Partial<GpuPipelineConfig>
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sunLight = sunLight;
    this.isSoftwareGl = isSoftwareGl;
    this.viewportWidth = Math.max(1, initialWidth);
    this.viewportHeight = Math.max(1, initialHeight);

    // Probe real hardware GPU limits and renderer string
    this.gpuRendererString = this.queryGpuRendererString();
    this.maxHardwareAnisotropy = Math.max(
      1,
      Math.min(16, this.renderer.capabilities.getMaxAnisotropy() || 1)
    );
    this.maxTextureSize = this.renderer.capabilities.maxTextureSize || 4096;

    // Ensure sunLight.target is added to the scene so hero-tracking shadow cascades move cleanly
    if (!this.sunLight.target.parent) {
      this.scene.add(this.sunLight.target);
    }
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.026;
    this.sunLight.shadow.radius = 2.6;

    // 1. Grazing Rim / Backlight DirectionalLight for crisp 3-point silhouette separation (zero shadow cost)
    this.rimLight = new THREE.DirectionalLight(0xbae6fd, 0.42);
    this.rimLight.position.set(-42, 28, -46);
    this.rimLight.castShadow = false;
    this.scene.add(this.rimLight);

    // 2. Studio Specular Softbox (`RectAreaLight`) on hardware GPUs for luxury specular bevels on crowns & water
    if (!this.isSoftwareGl) {
      try {
        RectAreaLightUniformsLib.init();
        this.studioAreaLight = new THREE.RectAreaLight(0xfff7ed, 1.35, 14, 8);
        this.studioAreaLight.position.set(0, 9.5, 12.5);
        this.studioAreaLight.lookAt(0, 0.8, 2.0);
        this.scene.add(this.studioAreaLight);
      } catch {
        this.studioAreaLight = null;
      }
    } else {
      this.studioAreaLight = null;
    }

    // 3. Soft Gaussian Hero Contact Shadow Grounding Decal (grounds the Hero even on software GL or in shade)
    const contactTex = PbrTextureSynthesizer.getContactShadowTexture();
    this.heroContactShadowMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.heroContactShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.15, 2.55),
      this.heroContactShadowMat
    );
    this.heroContactShadowMesh.rotation.x = -Math.PI / 2;
    this.heroContactShadowMesh.position.set(0, 0.024, 4);
    this.heroContactShadowMesh.renderOrder = 1;
    this.heroContactShadowMesh.userData.ignoreCameraFade = true;
    this.scene.add(this.heroContactShadowMesh);

    // 4. Procedural Sky + Studio Environment Map (PMREM cubemap on hardware GPUs; fast Analytic Rim+Hemi on Software GL to avoid WebGLEnvironments 20-pass CubeUV stall)
    this.iblEnvironmentTexture = PbrTextureSynthesizer.createStudioAndSkyEnvironmentMap(
      this.renderer,
      this.isSoftwareGl
    );
    if (!this.isSoftwareGl && !this.scene.environment && this.iblEnvironmentTexture) {
      this.scene.environment = this.iblEnvironmentTexture;
    }

    // 5. WebGL Context Loss & Restoration Resilience
    this.onContextLostHandler = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
    };
    this.onContextRestoredHandler = () => {
      this.contextLost = false;
      if (!this.isSoftwareGl || this.shouldActivateComposer()) {
        this.rebuildComposer();
      }
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLostHandler, false);
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.onContextRestoredHandler,
      false
    );

    // 6. Initialize Post-Processing Pipeline & Apply Initial Config
    if (initialConfig) {
      this.config = { ...this.config, ...initialConfig };
    }
    if (!this.isSoftwareGl || this.shouldActivateComposer()) {
      this.rebuildComposer();
    }
    this.applyConfig(this.config);
  }

  private queryGpuRendererString(): string {
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const raw = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
        if (raw) return raw;
      }
      return String(gl.getParameter(gl.RENDERER) || 'WebGL2 GPU');
    } catch {
      return 'WebGL2 GPU';
    }
  }

  private buildComposerTargets(
    width: number,
    height: number,
    samples: number
  ): {
    pingPongTarget: THREE.WebGLRenderTarget;
    sceneCaptureTarget: THREE.WebGLRenderTarget | null;
  } {
    const pixelRatio = this.renderer.getPixelRatio();
    const rtW = Math.max(1, Math.floor(width * pixelRatio));
    const rtH = Math.max(1, Math.floor(height * pixelRatio));

    const canDepthTex = this.renderer.capabilities.isWebGL2;
    const useDepthCapture = canDepthTex && this.config.ssaoEnabled;
    const effectiveSamples =
      !this.isSoftwareGl && this.renderer.capabilities.isWebGL2 && !useDepthCapture
        ? samples
        : 0;
    this.activeMsaaSamples = effectiveSamples;

    const rtType =
      !this.isSoftwareGl && this.renderer.capabilities.isWebGL2
        ? THREE.HalfFloatType
        : THREE.UnsignedByteType;

    // Ping-pong target used by EffectComposer NEVER carries `depthTexture` so ShaderPass
    // never triggers a WebGL2 framebuffer-texture feedback loop!
    const pingPongTarget = new THREE.WebGLRenderTarget(rtW, rtH, {
      type: rtType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      samples: effectiveSamples,
      depthBuffer: !useDepthCapture,
      stencilBuffer: false,
    });

    if (useDepthCapture) {
      this.depthTexture?.dispose();
      this.depthTexture = new THREE.DepthTexture(rtW, rtH);
      this.depthTexture.format = THREE.DepthFormat;
      this.depthTexture.type = THREE.UnsignedIntType;

      const captureRt = new THREE.WebGLRenderTarget(rtW, rtH, {
        type: rtType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        samples: 0,
        depthBuffer: true,
        stencilBuffer: false,
      });
      captureRt.depthTexture = this.depthTexture;
      return { pingPongTarget, sceneCaptureTarget: captureRt };
    }

    this.depthTexture?.dispose();
    this.depthTexture = null;
    return { pingPongTarget, sceneCaptureTarget: null };
  }

  private rebuildComposer(): void {
    try {
      this.renderPass?.dispose();
      this.composer?.dispose();
      this.renderTarget?.dispose();
      this.sceneCaptureTarget?.dispose();

      const desiredMsaa =
        this.config.antiAliasing === 'msaa_fxaa'
          ? this.config.qualityPreset === 'ultra'
            ? 4
            : 2
          : 0;

      const targets = this.buildComposerTargets(
        this.viewportWidth,
        this.viewportHeight,
        desiredMsaa
      );
      this.renderTarget = targets.pingPongTarget;
      this.sceneCaptureTarget = targets.sceneCaptureTarget;

      this.composer = new EffectComposer(this.renderer, this.renderTarget);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(this.viewportWidth, this.viewportHeight);

      this.renderPass = new SceneDepthCapturePass(
        this.scene,
        this.camera,
        this.sceneCaptureTarget
      );
      this.composer.addPass(this.renderPass);

      const bloomScale = computeBloomRenderScale(this.config.qualityPreset, this.isSoftwareGl);
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(
          Math.max(1, Math.floor(this.viewportWidth * bloomScale)),
          Math.max(1, Math.floor(this.viewportHeight * bloomScale))
        ),
        this.config.bloomStrength,
        0.42,
        0.84
      );
      this.bloomPass.enabled = this.config.bloomEnabled;
      this.composer.addPass(this.bloomPass);

      this.masterFilterPass = new ShaderPass(CapyGpuMasterFilterShader);
      this.syncMasterFilterUniforms();
      this.composer.addPass(this.masterFilterPass);

      this.outputPass = new OutputPass();
      this.composer.addPass(this.outputPass);

      this.fxaaPass = new ShaderPass(FXAAShader);
      this.fxaaPass.enabled = this.config.antiAliasing !== 'none';
      this.syncFxaaResolution();
      this.composer.addPass(this.fxaaPass);
    } catch {
      this.composer = null;
    }
  }

  private syncFxaaResolution(): void {
    if (!this.fxaaPass) return;
    const pr = this.renderer.getPixelRatio();
    const invW = 1 / Math.max(1, this.viewportWidth * pr);
    const invH = 1 / Math.max(1, this.viewportHeight * pr);
    this.fxaaPass.material.uniforms['resolution'].value.set(invW, invH);
    if (this.masterFilterPass) {
      this.masterFilterPass.uniforms['uTexelSize'].value.set(invW, invH);
    }
  }

  private syncMasterFilterUniforms(): void {
    if (!this.masterFilterPass) return;
    const profile =
      GPU_VISUAL_FILTER_PROFILES[this.config.visualFilterPreset] ||
      GPU_VISUAL_FILTER_PROFILES.natural_pbr;
    const u = this.masterFilterPass.uniforms;

    u['tDepth'].value = this.depthTexture;
    u['uHasDepth'].value = this.depthTexture && this.config.ssaoEnabled ? 1.0 : 0.0;
    u['uCameraNear'].value = this.camera.near;
    u['uCameraFar'].value = this.camera.far;
    u['uSsaoStrength'].value = this.config.ssaoEnabled ? 0.34 : 0.0;
    u['uSharpen'].value = THREE.MathUtils.clamp(this.config.sharpenAmount, 0, 1);
    u['uSaturation'].value = profile.saturation;
    u['uContrast'].value = profile.contrast;
    u['uLift'].value = profile.brightnessLift;
    u['uGamma'].value = profile.gamma;
    u['uTint'].value.set(
      profile.temperatureTintR,
      profile.temperatureTintG,
      profile.temperatureTintB
    );
    u['uVignette'].value = profile.vignetteIntensity;
    u['uChromatic'].value = profile.chromaticAberration;
    u['uScanlines'].value = profile.scanlineIntensity;
  }

  public applyQualityPreset(preset: GpuQualityPreset): GpuPipelineConfig {
    let next: GpuPipelineConfig;
    if (preset === 'performance') {
      next = {
        ...this.config,
        qualityPreset: 'performance',
        postProcessingEnabled: false,
        bloomEnabled: false,
        ssaoEnabled: false,
        sharpenAmount: 0.0,
        textureFilter: 'bilinear',
        anisotropyLevel: 1,
        shadowQuality: 'off',
        antiAliasing: 'none',
      };
    } else if (preset === 'balanced') {
      next = {
        ...this.config,
        qualityPreset: 'balanced',
        postProcessingEnabled: true,
        bloomEnabled: true,
        bloomStrength: 0.28,
        ssaoEnabled: false,
        sharpenAmount: 0.18,
        textureFilter: 'trilinear_aniso',
        anisotropyLevel: 4,
        shadowQuality: 'pcf',
        antiAliasing: 'fxaa',
      };
    } else if (preset === 'ultra') {
      next = {
        ...this.config,
        qualityPreset: 'ultra',
        postProcessingEnabled: true,
        bloomEnabled: true,
        bloomStrength: 0.44,
        ssaoEnabled: true,
        sharpenAmount: 0.36,
        textureFilter: 'trilinear_aniso',
        anisotropyLevel: 16,
        shadowQuality: 'pcf_soft',
        antiAliasing: 'msaa_fxaa',
      };
    } else {
      next = {
        ...this.config,
        qualityPreset: 'high',
        postProcessingEnabled: true,
        bloomEnabled: true,
        bloomStrength: 0.36,
        ssaoEnabled: true,
        sharpenAmount: 0.28,
        textureFilter: 'trilinear_aniso',
        anisotropyLevel: 8,
        shadowQuality: 'pcf_soft',
        antiAliasing: 'msaa_fxaa',
      };
    }
    this.applyConfig(next);
    return { ...this.config };
  }

  public applyConfig(partial: Partial<GpuPipelineConfig>): void {
    const prevSsao = this.config.ssaoEnabled;
    const prevAa = this.config.antiAliasing;
    this.config = { ...this.config, ...partial };

    // 1. Tone Mapping & Exposure
    switch (this.config.toneMapping) {
      case 'agx':
        this.renderer.toneMapping = THREE.AgXToneMapping;
        break;
      case 'neutral':
        this.renderer.toneMapping = THREE.NeutralToneMapping;
        break;
      case 'reinhard':
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        break;
      case 'aces':
      default:
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        break;
    }
    this.renderer.toneMappingExposure = THREE.MathUtils.clamp(this.config.exposure, 0.4, 2.2);

    // 2. Shadow Map Mode & Resolution
    if (this.isSoftwareGl || this.config.shadowQuality === 'off') {
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
      this.activeShadowMapSize = 0;
    } else {
      const prevEnabled = this.renderer.shadowMap.enabled;
      const prevType = this.renderer.shadowMap.type;
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;

      if (this.config.shadowQuality === 'vsm') {
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
      } else if (this.config.shadowQuality === 'pcf') {
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
      } else {
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }

      const desiredMapSize =
        this.config.qualityPreset === 'ultra'
          ? Math.min(4096, this.maxTextureSize)
          : this.config.qualityPreset === 'balanced'
            ? 1024
            : 2048;

      if (
        this.sunLight.shadow.mapSize.width !== desiredMapSize ||
        prevEnabled !== this.renderer.shadowMap.enabled ||
        prevType !== this.renderer.shadowMap.type
      ) {
        this.sunLight.shadow.mapSize.set(desiredMapSize, desiredMapSize);
        this.sunLight.shadow.map?.dispose();
        this.sunLight.shadow.map = null;
      }
      this.activeShadowMapSize = desiredMapSize;
      this.renderer.shadowMap.needsUpdate = true;
    }

    // 3. Global Texture Filtering & Hardware Anisotropy across all PBR DataTextures & CanvasTextures
    PbrTextureSynthesizer.applyGlobalTextureFiltering(
      this.config.textureFilter,
      this.config.anisotropyLevel,
      this.maxHardwareAnisotropy
    );

    // 4. Cap Device Pixel Ratio smartly to sustain locked 60 FPS on HiDPI displays
    const desiredPr = computeEffectivePixelRatio(
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      this.config.qualityPreset,
      this.shouldActivateComposer(),
      this.isSoftwareGl
    );
    const prChanged = Math.abs(this.renderer.getPixelRatio() - desiredPr) > 0.01;
    if (prChanged) {
      this.renderer.setPixelRatio(desiredPr);
      this.renderer.setSize(this.viewportWidth, this.viewportHeight);
    }

    // 5. Rebuild Composer RenderTarget if MSAA / DepthTexture / PixelRatio requirements changed,
    // or lazily initialize on software WebGL when a visual filter is activated.
    if (this.shouldActivateComposer() && !this.composer) {
      this.rebuildComposer();
    } else if (
      this.composer &&
      (prevSsao !== this.config.ssaoEnabled ||
        prevAa !== this.config.antiAliasing ||
        prChanged)
    ) {
      this.rebuildComposer();
    }

    if (this.bloomPass) {
      this.bloomPass.enabled = this.config.bloomEnabled;
      this.bloomPass.strength = this.config.bloomStrength;
      const bloomScale = computeBloomRenderScale(this.config.qualityPreset, this.isSoftwareGl);
      this.bloomPass.resolution.set(
        Math.max(1, Math.floor(this.viewportWidth * bloomScale)),
        Math.max(1, Math.floor(this.viewportHeight * bloomScale))
      );
    }
    if (this.fxaaPass) {
      this.fxaaPass.enabled = this.config.antiAliasing !== 'none';
    }
    this.syncMasterFilterUniforms();
    this.syncFxaaResolution();
  }

  public setForceSoftwarePostProcess(force: boolean): void {
    this.forceSoftwarePostProcess = force;
    if (force && !this.composer) {
      this.rebuildComposer();
    }
  }

  public getConfig(): GpuPipelineConfig {
    return { ...this.config };
  }

  /**
   * Updates the texel-snapped hero-centered shadow cascade, rim light counter-azimuth,
   * studio softbox anchor, and soft Gaussian contact shadow decal every frame with ZERO allocations.
   */
  public updateLightingAndShadowCascade(
    dt: number,
    heroWorldX: number,
    heroWorldY: number,
    heroWorldZ: number,
    groundY: number,
    isSurfaceVisible: boolean,
    nightFactor: number,
    sunDirection?: THREE.Vector3
  ): void {
    this.elapsedTime += dt;

    // 1. Hero Contact Shadow Grounding Decal
    this.heroContactShadowMesh.visible = isSurfaceVisible;
    if (isSurfaceVisible) {
      const heightAboveGround = Math.max(0, heroWorldY - groundY);
      const scaleFade = 1.0 + Math.min(1.2, heightAboveGround * 0.22);
      const opacityFade = Math.max(0.06, 0.46 * Math.exp(-heightAboveGround * 0.45)) * (1.0 - nightFactor * 0.45);
      this.heroContactShadowMesh.position.set(heroWorldX, groundY + 0.025, heroWorldZ);
      this.heroContactShadowMesh.scale.set(scaleFade, scaleFade, 1.0);
      this.heroContactShadowMat.opacity = opacityFade;
    }

    // 2. Texel-Snapped Directional Shadow Cascade centered on the Hero (tight 42m half-extent = 2.6x sharper texels, zero district azimuth warp!)
    if (isSurfaceVisible) {
      const frustumHalfExtent = 42;
      const shCam = this.sunLight.shadow.camera;
      if (shCam.right !== frustumHalfExtent) {
        shCam.left = -frustumHalfExtent;
        shCam.right = frustumHalfExtent;
        shCam.top = frustumHalfExtent;
        shCam.bottom = -frustumHalfExtent;
        shCam.updateProjectionMatrix();
      }

      if (sunDirection && sunDirection.lengthSq() > 0.001) {
        _sunOffsetDir.copy(sunDirection).normalize();
      } else {
        _sunOffsetDir.set(0.44, 0.82, 0.37).normalize();
      }

      const mapRes = Math.max(512, this.activeShadowMapSize || 2048);
      const snappedPose = computeTexelSnappedShadowOrigin(
        heroWorldX,
        heroWorldZ,
        _sunOffsetDir.x,
        _sunOffsetDir.y,
        _sunOffsetDir.z,
        frustumHalfExtent,
        mapRes,
        96
      );

      if (
        snappedPose.targetX !== this.lastSnappedShadowX ||
        snappedPose.targetZ !== this.lastSnappedShadowZ
      ) {
        this.lastSnappedShadowX = snappedPose.targetX;
        this.lastSnappedShadowZ = snappedPose.targetZ;
        this.sunLight.target.position.set(snappedPose.targetX, 0, snappedPose.targetZ);
        this.sunLight.target.updateMatrixWorld();
      }
      this.sunLight.position.set(snappedPose.lightX, snappedPose.lightY, snappedPose.lightZ);

      // Position grazing Rim/Backlight opposite the true sun azimuth relative to Hero for 3-point separation
      this.rimLight.position.set(
        heroWorldX - _sunOffsetDir.x * 58,
        24,
        heroWorldZ - _sunOffsetDir.z * 58
      );
      this.rimLight.target.position.set(heroWorldX, 1.0, heroWorldZ);
      if (!this.rimLight.target.parent) {
        this.scene.add(this.rimLight.target);
      }
      this.rimLight.target.updateMatrixWorld();
      this.rimLight.intensity = THREE.MathUtils.lerp(0.42, 0.62, nightFactor);

      if (this.studioAreaLight) {
        this.studioAreaLight.position.set(heroWorldX + 4.5, heroWorldY + 8.5, heroWorldZ + 9.5);
        this.studioAreaLight.lookAt(heroWorldX, heroWorldY + 0.6, heroWorldZ);
      }
    }

    // 3. Modulate HDR Bloom gently between luminous Cosmic Space & Nighttime Bioluminescence vs Bright Daylight
    if (this.bloomPass && this.config.bloomEnabled) {
      const cosmicOrNightBoost = !isSurfaceVisible ? 1.28 : 1.0 + nightFactor * 0.35;
      this.bloomPass.strength = this.config.bloomStrength * cosmicOrNightBoost;
    }

    if (this.masterFilterPass) {
      this.masterFilterPass.uniforms['uTime'].value = this.elapsedTime;
      this.masterFilterPass.uniforms['uCameraNear'].value = this.camera.near;
      this.masterFilterPass.uniforms['uCameraFar'].value = this.camera.far;
    }
  }

  private shouldActivateComposer(): boolean {
    if (!this.config.postProcessingEnabled || this.contextLost) {
      return false;
    }
    if (
      this.isSoftwareGl &&
      !this.forceSoftwarePostProcess &&
      this.config.visualFilterPreset === 'natural_pbr'
    ) {
      return false;
    }
    return true;
  }

  public isPostProcessingRunning(): boolean {
    if (!this.shouldActivateComposer()) return false;
    if (!this.composer) {
      this.rebuildComposer();
    }
    return Boolean(this.composer);
  }

  public render(): void {
    if (this.contextLost) return;
    if (this.isPostProcessingRunning() && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public handleResize(width: number, height: number): void {
    const nextW = Math.max(1, Math.floor(width));
    const nextH = Math.max(1, Math.floor(height));
    if (nextW === this.viewportWidth && nextH === this.viewportHeight) {
      return;
    }
    this.viewportWidth = nextW;
    this.viewportHeight = nextH;

    if (this.sceneCaptureTarget) {
      const pr = this.renderer.getPixelRatio();
      const rtW = Math.max(1, Math.floor(this.viewportWidth * pr));
      const rtH = Math.max(1, Math.floor(this.viewportHeight * pr));
      this.sceneCaptureTarget.setSize(rtW, rtH);
    }
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(this.viewportWidth, this.viewportHeight);
    }
    if (this.bloomPass) {
      const bloomScale = computeBloomRenderScale(this.config.qualityPreset, this.isSoftwareGl);
      this.bloomPass.resolution.set(
        Math.max(1, Math.floor(this.viewportWidth * bloomScale)),
        Math.max(1, Math.floor(this.viewportHeight * bloomScale))
      );
    }
    this.syncMasterFilterUniforms();
    this.syncFxaaResolution();
  }

  public getTelemetry(): GpuEngineTelemetry {
    const profile =
      GPU_VISUAL_FILTER_PROFILES[this.config.visualFilterPreset] ||
      GPU_VISUAL_FILTER_PROFILES.natural_pbr;
    const renderInfo = this.renderer.info.render;
    const memInfo = this.renderer.info.memory;
    const programsCount = this.renderer.info.programs ? this.renderer.info.programs.length : 0;
    const activeAniso =
      this.config.textureFilter === 'trilinear_aniso'
        ? Math.min(this.maxHardwareAnisotropy, this.config.anisotropyLevel)
        : 1;

    return {
      backendLabel: this.isSoftwareGl
        ? 'WebGL2 Software Rasterizer'
        : 'WebGL2 Hardware Accelerated GPU',
      gpuRenderer: this.gpuRendererString,
      isSoftwareGl: this.isSoftwareGl,
      contextLost: this.contextLost,
      qualityPreset: this.config.qualityPreset,
      postProcessingActive: this.isPostProcessingRunning(),
      visualFilterPreset: this.config.visualFilterPreset,
      visualFilterLabel: profile.label,
      toneMapping: this.config.toneMapping,
      exposure: +this.renderer.toneMappingExposure.toFixed(2),
      textureFilter: this.config.textureFilter,
      activeAnisotropy: activeAniso,
      maxHardwareAnisotropy: this.maxHardwareAnisotropy,
      maxTextureSize: this.maxTextureSize,
      shadowQuality: this.isSoftwareGl ? 'off' : this.config.shadowQuality,
      shadowMapSize: this.activeShadowMapSize,
      msaaSamples: this.activeMsaaSamples,
      bloomEnabled: this.config.bloomEnabled,
      ssaoEnabled: this.config.ssaoEnabled && Boolean(this.depthTexture),
      sharpenAmount: +this.config.sharpenAmount.toFixed(2),
      drawCalls: renderInfo.calls,
      triangles: renderInfo.triangles,
      texturesInVram: memInfo.textures,
      geometriesInVram: memInfo.geometries,
      shaderPrograms: programsCount,
      registeredPbrTextures: PbrTextureSynthesizer.getRegisteredTextureCount(),
    };
  }

  public dispose(): void {
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLostHandler);
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.onContextRestoredHandler
    );
    this.renderPass?.dispose();
    this.composer?.dispose();
    this.renderTarget?.dispose();
    this.sceneCaptureTarget?.dispose();
    this.depthTexture?.dispose();
    this.heroContactShadowMesh.geometry.dispose();
    this.heroContactShadowMat.dispose();
  }
}
