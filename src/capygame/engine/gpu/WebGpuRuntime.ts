import type * as THREE from 'three';
import type { GpuPipelineConfig } from './GpuEngineTypes';
import type { WebGpuPostAndComputePipeline } from './WebGpuPipeline';

export const GPU_BENCH_CACHE_KEY = 'capy_gpu_backend_bench_v1';

export interface WebGpuProbeResult {
  supported: boolean;
  shouldUseWebGpu: boolean;
  adapterName: string;
  isFallbackAdapter: boolean;
  features: string[];
  benchmarkedWinner?: 'webgpu' | 'webgl2';
  benchmarkSummary?: string;
}

export interface WebGpuWaterMaterialOptions {
  baseColorHex: number;
  normalMap: THREE.DataTexture;
  clearcoatNormalMap: THREE.DataTexture;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  roughness?: number;
  opacity?: number;
  transparent?: boolean;
}

export interface WebGpuTslGodRayHandle {
  material: THREE.Material;
  colorUniform: { value: THREE.Color };
  opacityUniform: { value: number };
}

export interface WebGpuRuntimeBridge {
  createTslIblSkyDomeMaterial(): THREE.Material;
  createTslSkyNodeMaterial(uniforms: {
    uSunDir: { value: THREE.Vector3 };
    uZenithColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uStarIntensity: { value: number };
    uCloudCover: { value: number };
    uTime: { value: number };
    uSkyAlpha: { value: number };
  }): THREE.Material;
  createTslWaterPhysicalNodeMaterial(options: WebGpuWaterMaterialOptions): THREE.Material;
  upgradeMaterialWithTslSightlineFade(
    mat: THREE.Material,
    viewportVec2: THREE.Vector2,
    headClipVec4: THREE.Vector4,
    tailClipVec4: THREE.Vector4
  ): { value: number };
  convertLegacyShaderMaterialsToTsl(root: THREE.Object3D): void;
  createTslVfxMotesMaterial(): THREE.Material;
  createTslGodRayMaterial(initialOpacity: number): WebGpuTslGodRayHandle;
  createPmremGenerator(renderer: unknown): {
    fromScene: (scene: THREE.Scene, sigma?: number) => { texture: THREE.Texture };
    dispose: () => void;
  };
  createWebGpuPostAndComputePipeline(
    renderer: unknown,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    adapterName: string,
    initialConfig: GpuPipelineConfig
  ): WebGpuPostAndComputePipeline;
}

let activeWebGpuRuntime: WebGpuRuntimeBridge | null = null;

export function registerWebGpuRuntime(runtime: WebGpuRuntimeBridge): void {
  activeWebGpuRuntime = runtime;
}

export function getWebGpuRuntime(): WebGpuRuntimeBridge | null {
  return activeWebGpuRuntime;
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
