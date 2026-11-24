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
    0.32,
    1.18
  );
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
