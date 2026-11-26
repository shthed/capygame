import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/**
 * Renders the 3D scene + hardware DepthTexture into an isolated off-ping-pong FBO
 * (`sceneCaptureTarget`) and blits HDR color into EffectComposer's `readBuffer`.
 * This guarantees `depthTexture` is NEVER bound as a DRAW_FRAMEBUFFER attachment
 * when `CapyGpuMasterFilterShader` samples `tDepth` (eliminating WebGL2 feedback-loop flicker).
 */
export class SceneDepthCapturePass extends Pass {
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

export interface WebGl2ComposerBuildParams {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderTarget: THREE.WebGLRenderTarget;
  sceneCaptureTarget: THREE.WebGLRenderTarget | null;
  viewportWidth: number;
  viewportHeight: number;
  bloomScale: number;
  bloomStrength: number;
  bloomEnabled: boolean;
  antiAliasingEnabled: boolean;
  masterFilterShader: {
    uniforms: Record<string, { value: unknown }>;
    vertexShader: string;
    fragmentShader: string;
  };
}

export interface WebGl2ComposerBundle {
  composer: EffectComposer;
  renderPass: SceneDepthCapturePass;
  bloomPass: UnrealBloomPass;
  masterFilterPass: ShaderPass;
  outputPass: OutputPass;
  fxaaPass: ShaderPass;
}

export const SPECULAR_SAFE_BLOOM_THRESHOLD = 1.85;
export const SPECULAR_SAFE_BLOOM_SOFT_KNEE = 0.35;
export const SPECULAR_SAFE_BLOOM_MAX_RADIANCE = 0.52;
export const SPECULAR_SAFE_BLOOM_RADIUS = 0.20;

/**
 * Pure mirror of the GLSL specular-safe bloom high-pass response used on UnrealBloomPass.
 * Rejects normal PBR diffuse/specular highlights below `threshold`, smoothly compresses
 * extreme HDR fireflies, and suppresses near-achromatic specular glare spikes so shiny
 * glass/metal/water reflections never erupt into unrealistic glowing white halos.
 */
export function evaluateSpecularSafeBloomGain(
  r: number,
  g: number,
  b: number,
  threshold: number = SPECULAR_SAFE_BLOOM_THRESHOLD,
  maxOutput: number = SPECULAR_SAFE_BLOOM_MAX_RADIANCE
): number {
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return 0;
  const sr = Math.max(0, Math.min(64, r));
  const sg = Math.max(0, Math.min(64, g));
  const sb = Math.max(0, Math.min(64, b));
  const luma = sr * 0.2126 + sg * 0.7152 + sb * 0.0722;
  if (luma <= threshold) return 0;

  const maxC = Math.max(sr, sg, sb);
  const minC = Math.min(sr, sg, sb);
  const saturation = maxC > 0.0001 ? (maxC - minC) / maxC : 0;

  // Specular highlights from white/warm sun & studio lights have low chroma (<0.22);
  // smoothly suppress achromatic specular glare so only intentional vibrant emissives bloom.
  const chromaGate = Math.max(0, Math.min(1, (saturation - 0.14) / 0.28));
  if (chromaGate <= 0) return 0;

  const t = Math.max(0, Math.min(1, (luma - threshold) / SPECULAR_SAFE_BLOOM_SOFT_KNEE));
  const knee = t * t * (3 - 2 * t);
  const excess = luma - threshold;
  const compressed = (excess / (1 + excess * 1.45)) * knee * chromaGate;
  return Math.min(maxOutput, compressed) / luma;
}

const SpecularSafeBloomHighPassShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    luminosityThreshold: { value: SPECULAR_SAFE_BLOOM_THRESHOLD },
    smoothWidth: { value: SPECULAR_SAFE_BLOOM_SOFT_KNEE },
    defaultColor: { value: new THREE.Color(0x000000) },
    defaultOpacity: { value: 0.0 },
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
    uniform float luminosityThreshold;
    uniform float smoothWidth;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      bool allFinite = (texel.r == texel.r) && (texel.g == texel.g) && (texel.b == texel.b)
        && (abs(texel.r) < 65000.0) && (abs(texel.g) < 65000.0) && (abs(texel.b) < 65000.0);
      if (!allFinite) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      vec3 c = clamp(texel.rgb, vec3(0.0), vec3(64.0));
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float maxC = max(c.r, max(c.g, c.b));
      float minC = min(c.r, min(c.g, c.b));
      float saturation = (maxC > 0.0001) ? ((maxC - minC) / maxC) : 0.0;

      // Reject achromatic white/warm specular reflections off shiny glass, metal & water
      float chromaGate = smoothstep(0.14, 0.42, saturation);
      float knee = smoothstep(luminosityThreshold, luminosityThreshold + max(0.05, smoothWidth), luma);
      float excess = max(0.0, luma - luminosityThreshold);
      float compressed = min(${SPECULAR_SAFE_BLOOM_MAX_RADIANCE.toFixed(2)}, (excess / (1.0 + excess * 1.45)) * knee * chromaGate);
      float gain = (luma > 0.0001) ? (compressed / luma) : 0.0;

      gl_FragColor = vec4(c * gain, 1.0);
    }
  `,
};

export function buildWebGl2PostProcessingComposer(
  params: WebGl2ComposerBuildParams
): WebGl2ComposerBundle {
  const {
    renderer,
    scene,
    camera,
    renderTarget,
    sceneCaptureTarget,
    viewportWidth,
    viewportHeight,
    bloomScale,
    bloomStrength,
    bloomEnabled,
    antiAliasingEnabled,
    masterFilterShader,
  } = params;

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(viewportWidth, viewportHeight);

  const renderPass = new SceneDepthCapturePass(scene, camera, sceneCaptureTarget);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(
      Math.max(1, Math.floor(viewportWidth * bloomScale)),
      Math.max(1, Math.floor(viewportHeight * bloomScale))
    ),
    bloomStrength,
    SPECULAR_SAFE_BLOOM_RADIUS,
    SPECULAR_SAFE_BLOOM_THRESHOLD
  );
  // Replace Three.js's unclamped LuminosityHighPassShader with our specular-safe filter
  // so crisp specular highlights on glossy surfaces never bloom into white glowing clouds.
  const prevHighPass = bloomPass.materialHighPassFilter;
  const highPassUniforms = THREE.UniformsUtils.clone(
    SpecularSafeBloomHighPassShader.uniforms
  ) as Record<string, THREE.IUniform>;
  highPassUniforms['luminosityThreshold'].value = SPECULAR_SAFE_BLOOM_THRESHOLD;
  highPassUniforms['smoothWidth'].value = SPECULAR_SAFE_BLOOM_SOFT_KNEE;
  bloomPass.highPassUniforms = highPassUniforms;
  bloomPass.materialHighPassFilter = new THREE.ShaderMaterial({
    uniforms: highPassUniforms,
    vertexShader: SpecularSafeBloomHighPassShader.vertexShader,
    fragmentShader: SpecularSafeBloomHighPassShader.fragmentShader,
  });
  prevHighPass?.dispose();

  bloomPass.enabled = bloomEnabled;
  composer.addPass(bloomPass);

  const masterFilterPass = new ShaderPass(masterFilterShader);
  composer.addPass(masterFilterPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.enabled = antiAliasingEnabled;
  composer.addPass(fxaaPass);

  return {
    composer,
    renderPass,
    bloomPass,
    masterFilterPass,
    outputPass,
    fxaaPass,
  };
}
