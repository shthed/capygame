export type GpuQualityPreset = 'performance' | 'balanced' | 'high' | 'ultra';

export type GpuToneMappingMode = 'agx' | 'aces' | 'neutral' | 'reinhard';

export type GpuTextureFilterMode = 'trilinear_aniso' | 'bilinear' | 'nearest_retro';

export type GpuShadowQualityMode = 'pcf_soft' | 'pcf' | 'vsm' | 'off';

export type GpuVisualFilterPreset =
  | 'natural_pbr'
  | 'cinema_filmic'
  | 'vibrant_hdr'
  | 'golden_hour'
  | 'noir_contrast'
  | 'retro_crt';

export type GpuAntiAliasingMode = 'msaa_fxaa' | 'fxaa' | 'none';

export interface GpuFilterUniformProfile {
  id: GpuVisualFilterPreset;
  label: string;
  saturation: number;
  contrast: number;
  brightnessLift: number;
  gamma: number;
  temperatureTintR: number;
  temperatureTintG: number;
  temperatureTintB: number;
  vignetteIntensity: number;
  chromaticAberration: number;
  scanlineIntensity: number;
}

export const GPU_VISUAL_FILTER_PROFILES: Record<
  GpuVisualFilterPreset,
  GpuFilterUniformProfile
> = {
  natural_pbr: {
    id: 'natural_pbr',
    label: 'Natural PBR',
    saturation: 1.04,
    contrast: 1.03,
    brightnessLift: 0.0,
    gamma: 1.0,
    temperatureTintR: 1.0,
    temperatureTintG: 1.0,
    temperatureTintB: 1.0,
    vignetteIntensity: 0.16,
    chromaticAberration: 0.0006,
    scanlineIntensity: 0.0,
  },
  cinema_filmic: {
    id: 'cinema_filmic',
    label: 'Cinema Filmic',
    saturation: 0.94,
    contrast: 1.14,
    brightnessLift: -0.012,
    gamma: 0.96,
    temperatureTintR: 1.03,
    temperatureTintG: 1.0,
    temperatureTintB: 0.97,
    vignetteIntensity: 0.34,
    chromaticAberration: 0.0016,
    scanlineIntensity: 0.0,
  },
  vibrant_hdr: {
    id: 'vibrant_hdr',
    label: 'Vibrant HDR',
    saturation: 1.28,
    contrast: 1.12,
    brightnessLift: 0.008,
    gamma: 0.98,
    temperatureTintR: 1.02,
    temperatureTintG: 1.01,
    temperatureTintB: 1.04,
    vignetteIntensity: 0.18,
    chromaticAberration: 0.0008,
    scanlineIntensity: 0.0,
  },
  golden_hour: {
    id: 'golden_hour',
    label: 'Golden Hour',
    saturation: 1.14,
    contrast: 1.08,
    brightnessLift: 0.01,
    gamma: 0.97,
    temperatureTintR: 1.12,
    temperatureTintG: 1.01,
    temperatureTintB: 0.88,
    vignetteIntensity: 0.26,
    chromaticAberration: 0.001,
    scanlineIntensity: 0.0,
  },
  noir_contrast: {
    id: 'noir_contrast',
    label: 'Noir Monochrome',
    saturation: 0.08,
    contrast: 1.32,
    brightnessLift: -0.02,
    gamma: 0.92,
    temperatureTintR: 0.98,
    temperatureTintG: 1.0,
    temperatureTintB: 1.04,
    vignetteIntensity: 0.44,
    chromaticAberration: 0.0014,
    scanlineIntensity: 0.0,
  },
  retro_crt: {
    id: 'retro_crt',
    label: 'Retro CRT Phosphor',
    saturation: 1.18,
    contrast: 1.16,
    brightnessLift: 0.006,
    gamma: 0.95,
    temperatureTintR: 0.96,
    temperatureTintG: 1.05,
    temperatureTintB: 0.98,
    vignetteIntensity: 0.42,
    chromaticAberration: 0.0038,
    scanlineIntensity: 0.28,
  },
};

export interface GpuPipelineConfig {
  qualityPreset: GpuQualityPreset;
  postProcessingEnabled: boolean;
  visualFilterPreset: GpuVisualFilterPreset;
  toneMapping: GpuToneMappingMode;
  exposure: number;
  textureFilter: GpuTextureFilterMode;
  anisotropyLevel: 1 | 4 | 8 | 16;
  shadowQuality: GpuShadowQualityMode;
  antiAliasing: GpuAntiAliasingMode;
  bloomEnabled: boolean;
  bloomStrength: number;
  ssaoEnabled: boolean;
  sharpenAmount: number;
}

export const DEFAULT_GPU_PIPELINE_CONFIG: GpuPipelineConfig = {
  qualityPreset: 'high',
  postProcessingEnabled: true,
  visualFilterPreset: 'natural_pbr',
  toneMapping: 'agx',
  exposure: 1.12,
  textureFilter: 'trilinear_aniso',
  anisotropyLevel: 8,
  shadowQuality: 'pcf_soft',
  antiAliasing: 'msaa_fxaa',
  bloomEnabled: true,
  bloomStrength: 0.36,
  ssaoEnabled: true,
  sharpenAmount: 0.28,
};

export interface GpuEngineTelemetry {
  backendLabel: string;
  gpuRenderer: string;
  isSoftwareGl: boolean;
  contextLost: boolean;
  qualityPreset: GpuQualityPreset;
  postProcessingActive: boolean;
  visualFilterPreset: GpuVisualFilterPreset;
  visualFilterLabel: string;
  toneMapping: GpuToneMappingMode;
  exposure: number;
  textureFilter: GpuTextureFilterMode;
  activeAnisotropy: number;
  maxHardwareAnisotropy: number;
  maxTextureSize: number;
  shadowQuality: GpuShadowQualityMode;
  shadowMapSize: number;
  msaaSamples: number;
  bloomEnabled: boolean;
  ssaoEnabled: boolean;
  sharpenAmount: number;
  drawCalls: number;
  triangles: number;
  texturesInVram: number;
  geometriesInVram: number;
  shaderPrograms: number;
  registeredPbrTextures: number;
}
