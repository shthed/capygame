import * as THREE from 'three';
import { GpuQualityPreset } from '../../types';
import type { GpuPipelineConfig, PerformanceLogEntry } from './GpuEngineTypes';
import type { CapyLodTier } from '../../types';

export interface SnappedShadowRigPose {
  targetX: number;
  targetY: number;
  targetZ: number;
  lightX: number;
  lightY: number;
  lightZ: number;
  texelSizeWorld: number;
}

const _snappedRigResult: SnappedShadowRigPose = {
  targetX: 0,
  targetY: 0,
  targetZ: 0,
  lightX: 0,
  lightY: 85,
  lightZ: 0,
  texelSizeWorld: 0.05,
};

export type AnyGpuPreset = GpuQualityPreset | 'performance' | 'low';

export const MAX_GPU_MITIGATION_LEVEL = 6;

export interface AdaptiveGpuMitigationResult {
  level: number;
  postProcessingEnabled: boolean;
  ssaoEnabled: boolean;
  bloomEnabled: boolean;
  shadowQuality: GpuPipelineConfig['shadowQuality'];
  antiAliasing: GpuPipelineConfig['antiAliasing'];
  resolutionScale: number;
  maxCapyLodTier: CapyLodTier;
  disabledFeatures: string[];
}

/**
 * Computes progressive GPU feature reductions for a given mitigation tier `level` (0..6)
 * relative to the user's base `GpuPipelineConfig` without mutating user preferences.
 */
export function computeAdaptiveGpuMitigation(
  baseConfig: GpuPipelineConfig,
  baseAutoLod: boolean,
  baseLodTier: CapyLodTier,
  level: number,
  out?: AdaptiveGpuMitigationResult
): AdaptiveGpuMitigationResult {
  const clampedLevel = Math.max(0, Math.min(MAX_GPU_MITIGATION_LEVEL, Math.round(level)));
  const baseScale = Math.max(0.5, Math.min(1.5, baseConfig.resolutionScale ?? 1.0));

  let postProcessingEnabled = baseConfig.postProcessingEnabled;
  let ssaoEnabled = baseConfig.ssaoEnabled;
  let bloomEnabled = baseConfig.bloomEnabled;
  let shadowQuality = baseConfig.shadowQuality;
  let antiAliasing = baseConfig.antiAliasing;
  let resolutionScale = baseScale;
  let maxCapyLodTier: CapyLodTier = baseAutoLod ? 3 : baseLodTier;

  if (clampedLevel >= 1 && baseAutoLod) {
    maxCapyLodTier = clampedLevel >= 5 ? 0 : clampedLevel >= 3 ? 1 : 2;
  }
  if (clampedLevel >= 2 && ssaoEnabled) {
    ssaoEnabled = false;
  }
  if (clampedLevel >= 3) {
    resolutionScale = Math.min(resolutionScale, 0.8);
  }
  if (clampedLevel >= 4 && bloomEnabled) {
    bloomEnabled = false;
  }
  if (clampedLevel >= 5) {
    resolutionScale = Math.min(resolutionScale, 0.7);
    if (shadowQuality === 'pcf_soft' || shadowQuality === 'vsm') {
      shadowQuality = 'pcf';
    } else if (shadowQuality === 'pcf') {
      shadowQuality = 'off';
    }
    if (antiAliasing === 'msaa_fxaa') {
      antiAliasing = 'fxaa';
    } else if (antiAliasing === 'fxaa') {
      antiAliasing = 'none';
    }
  }
  if (clampedLevel >= 6) {
    resolutionScale = Math.min(resolutionScale, 0.65);
    shadowQuality = 'off';
    postProcessingEnabled = false;
    bloomEnabled = false;
    ssaoEnabled = false;
    antiAliasing = 'none';
  }

  const features: string[] = [];
  if (baseAutoLod && maxCapyLodTier < 3) {
    features.push(`LOD<=T${maxCapyLodTier}`);
  }
  if (baseConfig.ssaoEnabled && !ssaoEnabled) features.push('SSAO OFF');
  if (baseConfig.bloomEnabled && !bloomEnabled) features.push('Bloom OFF');
  if (resolutionScale < baseScale - 0.01) {
    features.push(`Scale ${resolutionScale.toFixed(2)}x`);
  }
  if (shadowQuality !== baseConfig.shadowQuality) {
    features.push(shadowQuality === 'off' ? 'Shadows OFF' : `Shadows ${shadowQuality.toUpperCase()}`);
  }
  if (antiAliasing !== baseConfig.antiAliasing) {
    features.push(antiAliasing === 'none' ? 'AA OFF' : `AA ${antiAliasing.toUpperCase()}`);
  }
  if (baseConfig.postProcessingEnabled && !postProcessingEnabled) {
    features.push('Direct Pass');
  }

  if (out) {
    out.level = clampedLevel;
    out.postProcessingEnabled = postProcessingEnabled;
    out.ssaoEnabled = ssaoEnabled;
    out.bloomEnabled = bloomEnabled;
    out.shadowQuality = shadowQuality;
    out.antiAliasing = antiAliasing;
    out.resolutionScale = resolutionScale;
    out.maxCapyLodTier = maxCapyLodTier;
    out.disabledFeatures = features;
    return out;
  }

  return {
    level: clampedLevel,
    postProcessingEnabled,
    ssaoEnabled,
    bloomEnabled,
    shadowQuality,
    antiAliasing,
    resolutionScale,
    maxCapyLodTier,
    disabledFeatures: features,
  };
}

function mitigationSignature(m: AdaptiveGpuMitigationResult): string {
  return `${m.postProcessingEnabled}|${m.ssaoEnabled}|${m.bloomEnabled}|${m.shadowQuality}|${m.antiAliasing}|${m.resolutionScale.toFixed(2)}|${m.maxCapyLodTier}`;
}

/**
 * Advances to the next effective mitigation level that actually disables or reduces an active feature,
 * skipping no-op steps if the user already turned those features off manually.
 */
export function findNextEffectiveMitigationLevel(
  currentLevel: number,
  baseConfig: GpuPipelineConfig,
  baseAutoLod: boolean,
  baseLodTier: CapyLodTier
): number {
  const curSig = mitigationSignature(
    computeAdaptiveGpuMitigation(baseConfig, baseAutoLod, baseLodTier, currentLevel)
  );
  for (let lvl = currentLevel + 1; lvl <= MAX_GPU_MITIGATION_LEVEL; lvl++) {
    const next = computeAdaptiveGpuMitigation(baseConfig, baseAutoLod, baseLodTier, lvl);
    if (mitigationSignature(next) !== curSig) {
      return lvl;
    }
  }
  return currentLevel;
}

/**
 * Steps back to the previous effective mitigation level when sustained FPS headroom returns.
 */
export function findPrevEffectiveMitigationLevel(
  currentLevel: number,
  baseConfig: GpuPipelineConfig,
  baseAutoLod: boolean,
  baseLodTier: CapyLodTier
): number {
  const curSig = mitigationSignature(
    computeAdaptiveGpuMitigation(baseConfig, baseAutoLod, baseLodTier, currentLevel)
  );
  for (let lvl = currentLevel - 1; lvl >= 0; lvl--) {
    const prevSig = mitigationSignature(
      computeAdaptiveGpuMitigation(baseConfig, baseAutoLod, baseLodTier, lvl)
    );
    if (prevSig !== curSig) {
      let canonical = lvl;
      while (
        canonical > 0 &&
        mitigationSignature(
          computeAdaptiveGpuMitigation(baseConfig, baseAutoLod, baseLodTier, canonical - 1)
        ) === prevSig
      ) {
        canonical--;
      }
      return canonical;
    }
  }
  return 0;
}

/**
 * Computes resolution scale factor for UnrealBloomPass relative to drawing buffer dimensions.
 * Bloom is an intrinsically low-frequency Gaussian convolution; rendering its 5-mip chain at
 * 0.5x-0.65x cuts bloom fragment fill-rate by 58%-75% while eliminating sub-pixel bloom sparkle aliasing.
 */
export function computeBloomRenderScale(
  preset: AnyGpuPreset,
  isSoftwareGl: boolean
): number {
  if (isSoftwareGl || preset === 'low' || preset === 'performance') return 0.5;
  if (preset === 'ultra') return 0.65;
  return 0.5;
}

/**
 * Computes optimal WebGL devicePixelRatio cap scaled by user `resolutionScale` (`0.5`..`1.5`)
 * to sustain smooth FPS on 2x-3x HiDPI displays or allow crisp supersampling.
 */
export function computeEffectivePixelRatio(
  devicePixelRatio: number,
  preset: AnyGpuPreset,
  postProcessingEnabled: boolean,
  isSoftwareGl: boolean,
  resolutionScale: number = 1.0
): number {
  const safeDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const safeScale = Number.isFinite(resolutionScale)
    ? Math.max(0.5, Math.min(1.5, resolutionScale))
    : 1.0;
  if (isSoftwareGl) {
    return Math.max(0.5, Math.min(1.0, safeScale));
  }
  let baseCap = 2.0;
  if (preset === 'low' || preset === 'performance') {
    baseCap = 1.0;
  } else if (preset === 'balanced') {
    baseCap = postProcessingEnabled ? 1.35 : 1.5;
  } else if (preset === 'high') {
    baseCap = postProcessingEnabled ? 1.65 : 2.0;
  }
  const scaled = Math.min(safeDpr, baseCap) * safeScale;
  return Math.max(0.5, Math.min(2.25, Math.round(scaled * 100) / 100));
}

/**
 * Restores hardware Z-buffer writes (`depthWrite = origDepthWrite`) whenever `uCapyOccBlend <= 0.02`
 * so non-blocking trees/structures retain crisp Z-sorted foliage, and disables `depthWrite` while
 * an active player-blocking occluder clears >= 95% of the screen.
 */
export function shouldEnableOccluderDepthWrite(
  occBlend: number,
  origDepthWrite: boolean = true
): boolean {
  if (!origDepthWrite) return false;
  return occBlend <= 0.02;
}

/**
 * Tests whether a bounding sphere `(sx, sy, sz, radius)` genuinely lies inside the 3D sightline
 * corridor strictly BETWEEN the camera `(camX, camY, camZ)` and a player anchor `(targetX, targetY, targetZ)`.
 *
 * Guarantees:
 * - Objects centered at or beyond the player (`proj >= segLen - playerClearance`) NEVER trigger fading,
 *   even if they have wide canopies extending above/offscreen as the player walks toward them.
 * - Objects off to the sides, top, or bottom starting to go offscreen (`perpDist > radius * 0.9`) NEVER trigger fading.
 */
export function doesSphereBlockPlayerSightline(
  sx: number,
  sy: number,
  sz: number,
  radius: number,
  camX: number,
  camY: number,
  camZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  playerClearance: number = 0.35
): boolean {
  const abX = targetX - camX;
  const abY = targetY - camY;
  const abZ = targetZ - camZ;
  const segLen = Math.hypot(abX, abY, abZ);
  if (segLen <= 0.45 || radius <= 0.05) return false;

  const invLen = 1 / segLen;
  const dirX = abX * invLen;
  const dirY = abY * invLen;
  const dirZ = abZ * invLen;

  const relX = sx - camX;
  const relY = sy - camY;
  const relZ = sz - camZ;

  const proj = relX * dirX + relY * dirY + relZ * dirZ;
  // Entirely behind camera near plane
  if (proj + radius <= 0.14) return false;
  // Centered at or beyond the player (e.g., walking toward a tree ahead of the Capybara!)
  if (proj >= segLen - playerClearance) return false;

  const clampedProj = Math.max(0, Math.min(segLen - playerClearance, proj));
  const dx = relX - dirX * clampedProj;
  const dy = relY - dirY * clampedProj;
  const dz = relZ - dirZ * clampedProj;
  const effectiveRadius = radius * 0.9;
  return dx * dx + dy * dy + dz * dz <= effectiveRadius * effectiveRadius;
}

/**
 * Pure CPU mirror of the whole-screen sightline clear shader:
 * - When an object is NOT blocking the player (`occBlend === 0`), returns `1.0` everywhere (never disappears offscreen).
 * - When an object DOES block the player (`occBlend -> 1`), clears `>= 95.6%` of the entire viewport (`alpha = 0`,
 *   making the whole screen visible rather than a small peephole around the player), with only a faint `<= 0.18`
 *   whisper on the outermost `2.2%` screen rim.
 */
export function evaluateWholeScreenSightlineClearAlpha(
  sUvX: number,
  sUvY: number,
  occBlend: number,
  viewportW: number = 1280,
  viewportH: number = 720
): number {
  if (occBlend <= 0.001 || viewportW < 10 || viewportH < 10) return 1.0;

  const bx = Math.abs(sUvX * 2.0 - 1.0);
  const by = Math.abs(sUvY * 2.0 - 1.0);
  const rx = Math.max(bx - 0.978, 0.0) / 0.022;
  const ry = Math.max(by - 0.978, 0.0) / 0.022;
  const edgeDist = Math.min(1.0, Math.hypot(rx, ry));
  const screenEdgeFade = edgeDist * edgeDist * (3.0 - 2.0 * edgeDist);
  const targetOccAlpha = screenEdgeFade * (0.75 + 0.25 * screenEdgeFade) * 0.05;

  const finalAlpha = 1.0 + (targetOccAlpha - 1.0) * occBlend;
  if (occBlend > 0.85 && finalAlpha < 0.004) return 0.0;
  return Math.max(0.0, Math.min(1.0, finalAlpha));
}

/**
 * Computes frame-skipping stride (1 = 60 Hz, 2 = 30 Hz, 4 = 15 Hz) for non-active background
 * minigame districts based on squared horizontal distance to the closest viewer (Hero or Camera).
 */
export function computeDistrictTickStride(minViewerDistSq: number): 1 | 2 | 4 {
  if (minViewerDistSq <= 85 * 85) return 1;
  if (minViewerDistSq <= 135 * 135) return 2;
  return 4;
}

export interface EffectiveCameraFarResult {
  cameraFar: number;
  skyScale: number;
  showMountains: boolean;
}

const _effectiveCameraFarResult: EffectiveCameraFarResult = {
  cameraFar: 1350,
  skyScale: 1.0,
  showMountains: true,
};

/**
 * Pure zero-allocation distance check determining whether a background minigame district
 * lies within the active `drawDistanceMeters` frustum budget.
 */
export function shouldRenderDistrict(
  districtX: number,
  districtZ: number,
  districtRadius: number,
  camX: number,
  camZ: number,
  drawDistanceMeters: number,
  isActiveDistrict: boolean
): boolean {
  if (isActiveDistrict) return true;
  const maxReach = Math.max(40, drawDistanceMeters) + Math.max(0, districtRadius);
  const dx = camX - districtX;
  const dz = camZ - districtZ;
  return dx * dx + dz * dz <= maxReach * maxReach;
}

/**
 * Computes optimal `camera.far`, proportional sky dome scale (keeping the sky sphere inside
 * `camera.far` around the camera so reduced draw distance never clips the sky to black),
 * and whether distant alpine mountains (`innerR = 175m`) should render.
 */
export function computeEffectiveCameraFar(
  drawDistanceMeters: number,
  qualityPreset: AnyGpuPreset,
  isSurfaceVisible: boolean,
  logScaleMeters: number
): EffectiveCameraFarResult {
  if (!isSurfaceVisible && logScaleMeters > 3.1) {
    _effectiveCameraFarResult.cameraFar =
      qualityPreset === 'performance' || qualityPreset === 'low' ? 1400 : 3500;
    _effectiveCameraFarResult.skyScale = 1.0;
    _effectiveCameraFarResult.showMountains = false;
    return _effectiveCameraFarResult;
  }

  const safeDraw = Number.isFinite(drawDistanceMeters)
    ? Math.max(90, Math.min(1350, drawDistanceMeters))
    : 650;
  const effectiveFar = Math.max(115, safeDraw);
  _effectiveCameraFarResult.cameraFar = effectiveFar;
  _effectiveCameraFarResult.skyScale = Math.min(1.0, (effectiveFar * 0.88) / 720);
  _effectiveCameraFarResult.showMountains = safeDraw >= 185;
  return _effectiveCameraFarResult;
}

/**
 * Computes texel-snapped directional shadow target & light coordinates directly from a normalized
 * world sun direction vector so walking across distant districts ((-75,-75) .. (+75,+75)) never
 * warps shadow azimuth or triggers sub-texel shadow swimming.
 * Reuses a module-scoped result struct for zero per-frame heap allocations.
 */
export function computeTexelSnappedShadowOrigin(
  focusX: number,
  focusZ: number,
  sunDirX: number,
  sunDirY: number,
  sunDirZ: number,
  frustumHalfExtent: number,
  shadowMapSize: number,
  lightDistance: number = 96
): SnappedShadowShadowPoseAlias {
  const safeMapSize = Math.max(256, shadowMapSize);
  const texelSizeWorld = (frustumHalfExtent * 2) / safeMapSize;
  const snappedX = Math.round(focusX / texelSizeWorld) * texelSizeWorld;
  const snappedZ = Math.round(focusZ / texelSizeWorld) * texelSizeWorld;

  const len = Math.hypot(sunDirX, sunDirY, sunDirZ) || 1;
  const nx = sunDirX / len;
  const ny = Math.max(0.12, sunDirY / len);
  const nz = sunDirZ / len;
  const reNorm = Math.hypot(nx, ny, nz) || 1;

  _snappedRigResult.targetX = snappedX;
  _snappedRigResult.targetY = 0;
  _snappedRigResult.targetZ = snappedZ;
  _snappedRigResult.lightX = snappedX + (nx / reNorm) * lightDistance;
  _snappedRigResult.lightY = (ny / reNorm) * lightDistance;
  _snappedRigResult.lightZ = snappedZ + (nz / reNorm) * lightDistance;
  _snappedRigResult.texelSizeWorld = texelSizeWorld;
  return _snappedRigResult;
}

type SnappedShadowShadowPoseAlias = SnappedShadowRigPose;

// ============================================================================
// SOLAR SYSTEM PLANET DESTINATION LOCK (ZOOM INTO CAPY-EARTH, NOT SUN CENTER)
// ============================================================================
export interface SolarPlanetFocusResult {
  focusBlend: number;
  eclipticOffsetX: number;
  eclipticOffsetY: number;
  eclipticOffsetZ: number;
  sunDirX: number;
  sunDirY: number;
  sunDirZ: number;
}

const _solarFocusResult: SolarPlanetFocusResult = {
  focusBlend: 0,
  eclipticOffsetX: 0,
  eclipticOffsetY: 0,
  eclipticOffsetZ: 0,
  sunDirX: 0.58,
  sunDirY: 0.48,
  sunDirZ: 0.65,
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstepRange(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Computes the solar-system focal frame offset so zooming inward from Oort/Solar overview
 * (logVal ~ 13.8) down to Planetary/Atmosphere scale (logVal <= 10.6 -> 7.11 -> 4.9)
 * locks seamlessly onto the habitable planet (Capy-Earth) instead of diving into the Sun at (0,0,0),
 * and outputs the true planet-to-Sun lighting direction rotated by ecliptic inclination.
 */
export function computeSolarPlanetFocusOffset(
  logScaleMeters: number,
  planetOrbitRadius: number,
  planetOrbitTheta: number,
  eclipticTiltX: number = 0.34
): SolarPlanetFocusResult {
  // 0 at outer heliosphere/Oort (>= 13.8), ramping smoothly to 1.0 as camera passes Neptune -> Earth (<= 11.0)
  const focusBlend = smoothstepRange(13.8, 11.0, logScaleMeters);
  const px = Math.cos(planetOrbitTheta) * planetOrbitRadius;
  const pz = -Math.sin(planetOrbitTheta) * planetOrbitRadius;

  _solarFocusResult.focusBlend = focusBlend;
  _solarFocusResult.eclipticOffsetX = -px * focusBlend || 0;
  _solarFocusResult.eclipticOffsetY = 0;
  _solarFocusResult.eclipticOffsetZ = -pz * focusBlend || 0;

  // Direction from planet toward central Sun (0,0,0) in ecliptic-plane coordinates, tilted into world space
  const invR = planetOrbitRadius > 1e-6 ? 1 / planetOrbitRadius : 0;
  const lx = -px * invR;
  const lz = -pz * invR;
  const cosT = Math.cos(eclipticTiltX);
  const sinT = Math.sin(eclipticTiltX);
  const wx = lx;
  const wy = -lz * sinT;
  const wz = lz * cosT;
  const len = Math.hypot(wx, wy, wz) || 1;
  if (focusBlend > 0.05) {
    _solarFocusResult.sunDirX = wx / len;
    _solarFocusResult.sunDirY = wy / len;
    _solarFocusResult.sunDirZ = wz / len;
  } else {
    _solarFocusResult.sunDirX = 0.58;
    _solarFocusResult.sunDirY = 0.48;
    _solarFocusResult.sunDirZ = 0.65;
  }
  return _solarFocusResult;
}

// ============================================================================
// SPIRAL GALAXY SPIRAL ARM (ORION-CAPY SPUR) FOCUS REROUTING
// ============================================================================
export interface SpiralGalaxyFocusResult {
  galaxyFocusBlend: number;
  armOffsetX: number;
  armOffsetY: number;
  armOffsetZ: number;
}

const _spiralGalaxyFocusResult: SpiralGalaxyFocusResult = {
  galaxyFocusBlend: 0,
  armOffsetX: 0,
  armOffsetY: 0,
  armOffsetZ: 0,
};

export const GALAXY_DISC_RADIUS_UNITS = 21.0;
// Milky Way Solar System / Earth sits ~26,000 ly out of ~52,850 ly radius (~0.495 * R_gal = 10.4 units)
// along the inner Orion-Cygnus Spur between the Sagittarius and Perseus spiral arms.
export const HOME_GALAXY_ARM_RADIUS = 10.4;
export const HOME_GALAXY_ARM_THETA = 1.22;

/**
 * Computes spiral-galaxy focal frame offset so zooming from grand galaxy overview (logVal >= 20.95)
 * into Spiral Arms (logVal = 19.40) and down through Nebulas navigates smoothly off-center into
 * Earth's Orion-Cygnus Spur inside the Milky Way spiral arms rather than diving into Sagittarius A*.
 */
export function computeSpiralGalaxyFocusOffset(
  logScaleMeters: number,
  armRadius: number = HOME_GALAXY_ARM_RADIUS,
  armTheta: number = HOME_GALAXY_ARM_THETA
): SpiralGalaxyFocusResult {
  const blend = smoothstepRange(20.95, 19.4, logScaleMeters);
  const armX = Math.cos(armTheta) * armRadius;
  const armZ = -Math.sin(armTheta) * armRadius;

  _spiralGalaxyFocusResult.galaxyFocusBlend = blend;
  _spiralGalaxyFocusResult.armOffsetX = -armX * blend || 0;
  _spiralGalaxyFocusResult.armOffsetY = 0;
  _spiralGalaxyFocusResult.armOffsetZ = -armZ * blend || 0;
  return _spiralGalaxyFocusResult;
}

// ============================================================================
// PLANET SURFACE LANDMASS (CAPYBARA SANCTUARY ARCHIPELAGO) FOCUS REROUTING
// ============================================================================
export interface PlanetSurfaceFocusResult {
  surfaceFocusBlend: number;
  planetOffsetX: number;
  planetOffsetY: number;
  planetOffsetZ: number;
  surfaceTargetX: number;
  surfaceTargetY: number;
  surfaceTargetZ: number;
}

const _planetSurfaceFocusResult: PlanetSurfaceFocusResult = {
  surfaceFocusBlend: 0,
  planetOffsetX: 0,
  planetOffsetY: 0,
  planetOffsetZ: 0,
  surfaceTargetX: 0,
  surfaceTargetY: 0,
  surfaceTargetZ: 0,
};

export const SANCTUARY_SURFACE_LAT_DEG = 22.5;
export const SANCTUARY_SURFACE_LON_DEG = 42.0;

/**
 * Computes the planet-globe focal offset so zooming into Capy-Earth (logVal 7.3 down to 4.9)
 * picks a designated point on the sunny surface landmass (Capybara Sanctuary Archipelago at 22.5°N, 42.0°E)
 * rather than diving into the center of the planet sphere (0,0,0).
 */
export function computePlanetSurfaceLandmassFocusOffset(
  logScaleMeters: number,
  planetRadius: number = 8.5,
  latDeg: number = SANCTUARY_SURFACE_LAT_DEG,
  lonDeg: number = SANCTUARY_SURFACE_LON_DEG
): PlanetSurfaceFocusResult {
  const latRad = latDeg * (Math.PI / 180);
  const lonRad = lonDeg * (Math.PI / 180);
  const nx = Math.cos(latRad) * Math.sin(lonRad);
  const ny = Math.sin(latRad);
  const nz = Math.cos(latRad) * Math.cos(lonRad);

  const surfaceX = nx * planetRadius;
  const surfaceY = ny * planetRadius;
  const surfaceZ = nz * planetRadius;

  // Blends smoothly from 0.0 at full globe overview (log >= 7.30) to 1.0 approaching atmosphere (log <= 4.90)
  const blend = smoothstepRange(7.30, 4.90, logScaleMeters);

  _planetSurfaceFocusResult.surfaceFocusBlend = blend;
  _planetSurfaceFocusResult.planetOffsetX = -surfaceX * blend || 0;
  _planetSurfaceFocusResult.planetOffsetY = -surfaceY * blend || 0;
  _planetSurfaceFocusResult.planetOffsetZ = -surfaceZ * blend || 0;
  _planetSurfaceFocusResult.surfaceTargetX = surfaceX;
  _planetSurfaceFocusResult.surfaceTargetY = surfaceY;
  _planetSurfaceFocusResult.surfaceTargetZ = surfaceZ;

  return _planetSurfaceFocusResult;
}

// ============================================================================
// TRUE 1:1 SPACESHIP PHYSICAL SCALE & SMOOTH WORLD-SPACE TOUCHDOWN CONVERGENCE
// ============================================================================
export interface VesselOneToOneTransform {
  worldX: number;
  worldY: number;
  worldZ: number;
  uniformScale: number;
  worldSpaceBlend: number;
}

const _vesselTransformResult: VesselOneToOneTransform = {
  worldX: 0,
  worldY: 0,
  worldZ: 0,
  uniformScale: 0.54,
  worldSpaceBlend: 0,
};

/**
 * Calibrated 1:1 physical meter scale of ChronoVesselRig in surface world space:
 * Base saucer diameter is 0.94m and seated Capybara pilot is ~0.42m tall; at `1.75` uniformScale,
 * the hover-pram saucer spans 1.65m (fitting cleanly inside the 2.65m SanctuaryChronoPad) and the
 * seated pilot matches Hero Capybara's 1:1 meter body proportions.
 */
export const CHRONO_VESSEL_ONE_TO_ONE_SCALE = 1.75;
export const CHRONO_VESSEL_HUD_SCALE = 0.54;

export function computeVesselOneToOneTransform(
  logScaleMeters: number,
  vesselMode: 'chase_pod' | 'telescope_first_person' | 'landed',
  camX: number,
  camY: number,
  camZ: number,
  camForwardX: number,
  camForwardY: number,
  camForwardZ: number,
  camUpX: number,
  camUpY: number,
  camUpZ: number,
  heroX: number,
  heroY: number,
  heroZ: number
): VesselOneToOneTransform {
  const hudDist = vesselMode === 'telescope_first_person' ? 1.85 : 3.75;
  const hudDrop = vesselMode === 'telescope_first_person' ? -0.92 : -1.24;
  const hudX = camX + camForwardX * hudDist + camUpX * hudDrop;
  const hudY = camY + camForwardY * hudDist + camUpY * hudDrop;
  const hudZ = camZ + camForwardZ * hudDist + camUpZ * hudDrop;

  // Outside atmosphere/forest descent (logVal >= 2.95) or 1st-person telescope: remain foreground HUD silhouette
  const worldBlend =
    vesselMode === 'telescope_first_person'
      ? 0
      : smoothstepRange(2.95, 1.05, logScaleMeters);

  // Target true 1:1 world hover beside Hero Capybara so both Capybara & 1:1 saucer are side-by-side
  const targetWorldX = heroX + 1.85;
  const targetWorldY = heroY + 0.96;
  const targetWorldZ = heroZ - 0.55;

  _vesselTransformResult.worldSpaceBlend = worldBlend;
  _vesselTransformResult.worldX = hudX + (targetWorldX - hudX) * worldBlend;
  _vesselTransformResult.worldY = hudY + (targetWorldY - hudY) * worldBlend;
  _vesselTransformResult.worldZ = hudZ + (targetWorldZ - hudZ) * worldBlend;
  _vesselTransformResult.uniformScale =
    CHRONO_VESSEL_HUD_SCALE +
    (CHRONO_VESSEL_ONE_TO_ONE_SCALE - CHRONO_VESSEL_HUD_SCALE) * worldBlend;

  return _vesselTransformResult;
}

// ============================================================================
// AAA DAY / NIGHT DUAL SUN+MOON DIRECTIONAL SHADOWS & 5:1 CONTRAST RIG
// ============================================================================
export interface DayNightAtmosphereRig {
  timeOfDayHours: number;
  dayPhaseLabel: string;
  sunElev: number;
  dayFactor: number;
  duskFactor: number;
  nightFactor: number;
  sunDirX: number;
  sunDirY: number;
  sunDirZ: number;
  moonDirX: number;
  moonDirY: number;
  moonDirZ: number;
  activeShadowCaster: 'sun' | 'moon';
  shadowIntensity: number;
  sunIntensity: number;
  moonIntensity: number;
  hemiIntensity: number;
  ambientIntensity: number;
  iblEnvIntensity: number;
  lanternBoost: number;
  exposure: number;
}

const _dayNightRigResult: DayNightAtmosphereRig = {
  timeOfDayHours: 9.5,
  dayPhaseLabel: 'Daylight',
  sunElev: 0.78,
  dayFactor: 1,
  duskFactor: 0,
  nightFactor: 0,
  sunDirX: 0.44,
  sunDirY: 0.82,
  sunDirZ: 0.37,
  moonDirX: -0.44,
  moonDirY: 0.45,
  moonDirZ: -0.37,
  activeShadowCaster: 'sun',
  shadowIntensity: 1,
  sunIntensity: 2.85,
  moonIntensity: 0,
  hemiIntensity: 0.52,
  ambientIntensity: 0.1,
  iblEnvIntensity: 1.15,
  lanternBoost: 0.1,
  exposure: 1.02,
};

export function computeDayNightAtmosphereRig(
  timeOfDayHours: number,
  cloudCover: number,
  exposureScale: number = 1.0,
  lightningFlash: number = 0
): DayNightAtmosphereRig {
  const h = ((timeOfDayHours % 24) + 24) % 24;
  let dayPhaseLabel = 'Starlight Night';
  if (h >= 5.2 && h < 8.0) dayPhaseLabel = 'Golden Dawn';
  else if (h >= 8.0 && h < 17.2) dayPhaseLabel = 'Daylight';
  else if (h >= 17.2 && h < 20.2) dayPhaseLabel = 'Crimson Dusk';

  const sunPhase = ((h - 6.0) / 24.0) * Math.PI * 2.0;
  const sunElev = Math.sin(sunPhase);
  const sunAzimuth = Math.cos(sunPhase);

  const rawSx = sunAzimuth * 0.85;
  const rawSy = sunElev;
  const rawSz = -0.44;
  const sunLen = Math.hypot(rawSx, rawSy, rawSz) || 1;
  const sunDirX = rawSx / sunLen;
  const sunDirY = rawSy / sunLen;
  const sunDirZ = rawSz / sunLen;

  const rawMx = -sunAzimuth * 0.72;
  const rawMy = Math.max(0.24, -sunElev * 0.92 + 0.18);
  const rawMz = 0.42;
  const moonLen = Math.hypot(rawMx, rawMy, rawMz) || 1;
  const moonDirX = rawMx / moonLen;
  const moonDirY = rawMy / moonLen;
  const moonDirZ = rawMz / moonLen;

  const dayFactor = smoothstepRange(-0.14, 0.28, sunElev);
  const duskFactor = Math.max(0, 1.0 - Math.abs(sunElev - 0.04) * 4.2);
  const nightFactor = 1.0 - dayFactor;

  const weatherDim = 1.0 - clamp01(cloudCover) * 0.48;
  // Hand shadow caster cleanly to the Moon below +0.02 sun elevation so nocturnal shadows work smoothly!
  const activeShadowCaster: 'sun' | 'moon' = sunElev >= 0.02 ? 'sun' : 'moon';
  const sunShadowFade = smoothstepRange(0.02, 0.18, sunElev);
  const moonShadowFade = smoothstepRange(0.02, -0.18, sunElev);
  const shadowIntensity =
    (activeShadowCaster === 'sun' ? sunShadowFade : moonShadowFade) *
    (1.0 - clamp01(cloudCover) * 0.35);

  _dayNightRigResult.timeOfDayHours = h;
  _dayNightRigResult.dayPhaseLabel = dayPhaseLabel;
  _dayNightRigResult.sunElev = sunElev;
  _dayNightRigResult.dayFactor = dayFactor;
  _dayNightRigResult.duskFactor = duskFactor;
  _dayNightRigResult.nightFactor = nightFactor;
  _dayNightRigResult.sunDirX = sunDirX;
  _dayNightRigResult.sunDirY = sunDirY;
  _dayNightRigResult.sunDirZ = sunDirZ;
  _dayNightRigResult.moonDirX = moonDirX;
  _dayNightRigResult.moonDirY = moonDirY;
  _dayNightRigResult.moonDirZ = moonDirZ;
  _dayNightRigResult.activeShadowCaster = activeShadowCaster;
  _dayNightRigResult.shadowIntensity = shadowIntensity;
  _dayNightRigResult.sunIntensity = Math.max(0, dayFactor * 2.95 * weatherDim) + lightningFlash * 3.0;
  _dayNightRigResult.moonIntensity = nightFactor * (0.92 - cloudCover * 0.32);
  _dayNightRigResult.hemiIntensity = 0.28 + dayFactor * (0.44 + cloudCover * 0.12);
  _dayNightRigResult.ambientIntensity = 0.08 + dayFactor * 0.11 + lightningFlash * 0.35;
  _dayNightRigResult.iblEnvIntensity = 0.48 + dayFactor * 0.78 + duskFactor * 0.18;
  _dayNightRigResult.lanternBoost = 0.08 + nightFactor * 2.25 + duskFactor * 0.75;
  _dayNightRigResult.exposure = (0.96 + dayFactor * 0.12 + lightningFlash * 0.3) * exposureScale;
  return _dayNightRigResult;
}

// ============================================================================
// ZERO-ALLOCATION 60 FPS PERFORMANCE LOG & LAG/FRAME-DROP ALERT TRACKER
// ============================================================================
const PERF_HISTORY_LEN = 60;
const PERF_MAX_LOG_ENTRIES = 32;

export class PerformanceLogTracker {
  private readonly fpsHistory = new Float32Array(PERF_HISTORY_LEN);
  private readonly msHistory = new Float32Array(PERF_HISTORY_LEN);
  private readonly sortedScratch = new Float32Array(PERF_HISTORY_LEN);
  private writeIdx = 0;
  private sampleCount = 0;
  private entries: PerformanceLogEntry[] = [];
  private nextEntryId = 1;
  private droppedFramesCount = 0;
  private lastAlertTimestampMs = -10000;
  private lastSampleMs = 16.67;
  private liveFps = 60;
  private smoothedFps = 60;
  private warmupFramesRemaining = 4;
  private startTimestampMs = 0;
  public lock60FpsEnabled = true;
  public fpsTarget = 60;
  public maxFpsLimit = 60;
  public activeGovernorTier = 0;
  public disabledFeatures: string[] = [];

  constructor(startTimeMs: number = Date.now()) {
    this.startTimestampMs = startTimeMs;
    this.fpsHistory.fill(60);
    this.msHistory.fill(16.67);
  }

  public getEffectiveTargetFps(): number {
    const safeTarget = Math.max(24, Math.min(240, Math.round(this.fpsTarget || 60)));
    if (this.maxFpsLimit > 0) {
      return Math.max(24, Math.min(safeTarget, Math.round(this.maxFpsLimit)));
    }
    return safeTarget;
  }

  public getDisplayFpsCap(): number {
    return this.maxFpsLimit > 0 ? Math.max(24, Math.min(240, Math.round(this.maxFpsLimit))) : 240;
  }

  public notifyTransitionWarmup(frames: number = 4) {
    this.warmupFramesRemaining = Math.max(this.warmupFramesRemaining, frames);
  }

  public recordFrame(
    frameWorkMs: number,
    wallIntervalMs: number,
    isSoftwareGl: boolean,
    stageLabel: string,
    nowMs: number,
    mitigationLabel: string = 'Monitor'
  ): { isLagDrop: boolean; shouldReduceLoad: boolean } {
    const effTarget = this.getEffectiveTargetFps();
    const displayCap = this.getDisplayFpsCap();

    if (this.warmupFramesRemaining > 0) {
      this.warmupFramesRemaining--;
      this.liveFps = Math.min(displayCap, Math.round(this.smoothedFps));
      return { isLagDrop: false, shouldReduceLoad: false };
    }

    // On software GL headless pacing, measure actual CPU+GL draw execution time against budget
    // so intentional sleep timers aren't misreported as lag. When hardware maxFpsLimit intentionally paces
    // frames below monitor vsync (e.g. 30 FPS cap = 33.3ms), compare against effective budget too.
    const effectiveMs = isSoftwareGl
      ? Math.max(0.5, frameWorkMs)
      : Math.max(0.5, wallIntervalMs);
    const rawInstantFps = Math.min(240, Math.round((1000 / Math.max(4, effectiveMs)) * 10) / 10);
    const recordedFps = Math.min(displayCap, rawInstantFps);

    this.fpsHistory[this.writeIdx] = recordedFps;
    this.msHistory[this.writeIdx] = effectiveMs;
    this.writeIdx = (this.writeIdx + 1) % PERF_HISTORY_LEN;
    if (this.sampleCount < PERF_HISTORY_LEN) this.sampleCount++;

    this.lastSampleMs = effectiveMs;
    this.smoothedFps = this.smoothedFps * 0.72 + recordedFps * 0.28;
    this.liveFps = Math.max(1, Math.min(displayCap, Math.round(this.smoothedFps)));

    const budgetMs = 1000 / effTarget;
    const warnMs = effTarget === 60 ? 20.5 : Math.max(budgetMs * 1.23, budgetMs + 3.8);
    const critMs = effTarget === 60 ? 33.4 : Math.max(budgetMs * 2.0, budgetMs + 14.0);
    const warnFps = effTarget * 0.9;
    const critFps = effTarget * 0.583;

    // Also inspect CPU/GPU work time directly when capped so genuine heavy frames are caught
    const workOverBudget = this.maxFpsLimit > 0 && !isSoftwareGl && frameWorkMs > warnMs;
    const isCrit = effectiveMs > critMs || rawInstantFps < critFps || (workOverBudget && frameWorkMs > critMs);
    const isWarn = effectiveMs > warnMs || rawInstantFps < warnFps || workOverBudget;
    const isLagDrop = isWarn || isCrit;

    if (isLagDrop) {
      this.droppedFramesCount++;
      const debounceMs = isCrit ? 400 : 850;
      if (nowMs - this.lastAlertTimestampMs >= debounceMs) {
        this.pushEntry(
          nowMs,
          isCrit ? 'critical' : 'warn',
          Math.max(1, Math.round(rawInstantFps)),
          effectiveMs,
          stageLabel,
          isSoftwareGl
            ? 'Software GL CPU raster spike'
            : isCrit
              ? `Heavy GPU/physics frame hitch (>${critMs.toFixed(0)}ms)`
              : `Frame budget exceeded (>${warnMs.toFixed(1)}ms for ${effTarget} FPS)`,
          mitigationLabel
        );
      }
    }

    return {
      isLagDrop,
      shouldReduceLoad:
        this.lock60FpsEnabled && (isLagDrop || this.getAvgFrameMs() > budgetMs * 1.09),
    };
  }

  public recordSyntheticLagSpike(
    frameMs: number,
    stageLabel: string,
    mitigation: string = 'Dropped LOD / GPU load to hit FPS target',
    nowMs: number = Date.now()
  ) {
    const fps = Math.max(1, Math.round(1000 / Math.max(4, frameMs)));
    const cappedFps = Math.min(this.getDisplayFpsCap(), fps);
    this.fpsHistory[this.writeIdx] = cappedFps;
    this.msHistory[this.writeIdx] = frameMs;
    this.writeIdx = (this.writeIdx + 1) % PERF_HISTORY_LEN;
    if (this.sampleCount < PERF_HISTORY_LEN) this.sampleCount++;
    this.lastSampleMs = frameMs;
    this.smoothedFps = cappedFps;
    this.liveFps = cappedFps;
    this.droppedFramesCount++;
    this.pushEntry(
      nowMs,
      frameMs > 33.4 ? 'critical' : 'warn',
      fps,
      frameMs,
      stageLabel,
      `Detected ${frameMs.toFixed(1)} ms frame spike (${fps} FPS)`,
      mitigation
    );
  }

  private pushEntry(
    nowMs: number,
    severity: 'warn' | 'critical',
    fps: number,
    frameMs: number,
    stageLabel: string,
    cause: string,
    mitigation: string
  ) {
    this.lastAlertTimestampMs = nowMs;
    const elapsedSec = Math.max(0, (nowMs - this.startTimestampMs) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = Math.floor(elapsedSec % 60);
    const elapsedLabel = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    const roundedMs = Math.round(frameMs * 10) / 10;

    // Group repeated instances of the same incident within 8 seconds
    const latest = this.entries[0];
    const sameIncident =
      latest &&
      latest.stageLabel === stageLabel &&
      (latest.cause === cause ||
        latest.mitigation === mitigation ||
        (latest.cause.startsWith('Detected') && cause.startsWith('Detected')) ||
        nowMs - (latest.lastTimestampMs ?? latest.timestampMs) < 5000);

    if (latest && sameIncident && nowMs - (latest.lastTimestampMs ?? latest.timestampMs) < 8000) {
      latest.repeatCount = (latest.repeatCount ?? 1) + 1;
      latest.lastTimestampMs = nowMs;
      latest.lastElapsedLabel = elapsedLabel;
      latest.minFps = Math.min(latest.minFps ?? latest.fps, fps);
      latest.maxFps = Math.max(latest.maxFps ?? latest.fps, fps);
      latest.frameMs = roundedMs;
      latest.maxFrameMs = Math.max(latest.maxFrameMs ?? latest.frameMs, roundedMs);
      if (severity === 'critical') latest.severity = 'critical';
      return;
    }

    // Rate-limit creating brand-new distinct entries (at least 1200ms between new entries in same stage)
    if (latest && nowMs - (latest.lastTimestampMs ?? latest.timestampMs) < 1200 && latest.stageLabel === stageLabel) {
      latest.repeatCount = (latest.repeatCount ?? 1) + 1;
      latest.lastTimestampMs = nowMs;
      latest.lastElapsedLabel = elapsedLabel;
      latest.minFps = Math.min(latest.minFps ?? latest.fps, fps);
      latest.maxFps = Math.max(latest.maxFps ?? latest.fps, fps);
      latest.maxFrameMs = Math.max(latest.maxFrameMs ?? latest.frameMs, roundedMs);
      return;
    }

    this.entries.unshift({
      id: this.nextEntryId++,
      timestampMs: nowMs,
      lastTimestampMs: nowMs,
      elapsedLabel,
      lastElapsedLabel: elapsedLabel,
      severity,
      fps,
      minFps: fps,
      maxFps: fps,
      frameMs: roundedMs,
      maxFrameMs: roundedMs,
      stageLabel,
      cause,
      mitigation,
      repeatCount: 1,
    });
    if (this.entries.length > PERF_MAX_LOG_ENTRIES) {
      this.entries.length = PERF_MAX_LOG_ENTRIES;
    }
  }

  public clear(nowMs: number = Date.now()) {
    const resetFps = this.getEffectiveTargetFps();
    const resetMs = Math.round((1000 / resetFps) * 100) / 100;
    this.entries.length = 0;
    this.droppedFramesCount = 0;
    this.lastAlertTimestampMs = nowMs - 10000;
    this.fpsHistory.fill(resetFps);
    this.msHistory.fill(resetMs);
    this.lastSampleMs = resetMs;
    this.smoothedFps = resetFps;
    this.liveFps = resetFps;
  }

  public getAvgFrameMs(): number {
    const n = Math.max(1, this.sampleCount);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += this.msHistory[i];
    return sum / n;
  }

  public getSnapshot(nowMs: number = Date.now()) {
    const n = Math.max(1, this.sampleCount);
    let fpsSum = 0;
    let msSum = 0;
    let minFps = 240;
    let maxMs = 0;
    for (let i = 0; i < n; i++) {
      const f = this.fpsHistory[i];
      const m = this.msHistory[i];
      fpsSum += f;
      msSum += m;
      if (f < minFps) minFps = f;
      if (m > maxMs) maxMs = m;
      this.sortedScratch[i] = m;
    }
    // Simple insertion/selection sort on <=60 floats (0 heap allocations)
    for (let i = 1; i < n; i++) {
      const key = this.sortedScratch[i];
      let j = i - 1;
      while (j >= 0 && this.sortedScratch[j] > key) {
        this.sortedScratch[j + 1] = this.sortedScratch[j];
        j--;
      }
      this.sortedScratch[j + 1] = key;
    }
    const p95Idx = Math.min(n - 1, Math.floor(n * 0.95));
    const latest = this.entries[0] ?? null;
    const activeAlert = Boolean(latest && nowMs - this.lastAlertTimestampMs < 4000);
    const effTarget = this.getEffectiveTargetFps();
    const summaryFps = latest
      ? latest.minFps && latest.maxFps && latest.minFps !== latest.maxFps
        ? `${latest.minFps}-${latest.maxFps}`
        : `${latest.fps}`
      : String(effTarget);
    const repStr = latest && latest.repeatCount && latest.repeatCount > 1 ? ` (x${latest.repeatCount})` : '';

    return {
      liveFps: this.liveFps,
      avgFps: Math.round(fpsSum / n),
      minFps: Math.round(minFps),
      avgFrameMs: Math.round((msSum / n) * 10) / 10,
      p95FrameMs: Math.round(this.sortedScratch[p95Idx] * 10) / 10,
      maxFrameMs: Math.round(Math.max(maxMs, this.lastSampleMs) * 10) / 10,
      droppedFramesCount: this.droppedFramesCount,
      alertCount: this.entries.length,
      activeAlert,
      lastAlertSummary: latest
        ? `${summaryFps} FPS (${latest.maxFrameMs ?? latest.frameMs}ms)${repStr} · ${latest.stageLabel}`
        : null,
      lock60FpsEnabled: this.lock60FpsEnabled,
      fpsTarget: effTarget,
      maxFpsLimit: this.maxFpsLimit,
      autoOptimizerEnabled: this.lock60FpsEnabled,
      activeGovernorTier: this.activeGovernorTier,
      disabledFeatures: this.disabledFeatures.slice(),
      entries: this.entries.slice(),
    };
  }
}

// ============================================================================
// ZERO-ALLOCATION MOUSELOOK CAMERA INTEGRATOR
// ============================================================================
export interface MouseLookAngleResult {
  yaw: number;
  pitch: number;
}

const _mouseLookAngleResult: MouseLookAngleResult = {
  yaw: 0,
  pitch: 0,
};

/** Base angular sensitivity (~0.0042 rad/px ≈ 0.24 deg/px at 1.0x sensitivity). */
export const MOUSELOOK_RAD_PER_PX = 0.0042;
export const MOUSELOOK_MAX_DELTA_PX = 220;

/**
 * Zero-allocation mouselook integrator mapping pointer X/Y pixel deltas
 * to clamped camera yaw & pitch angles across both cosmic orbit and surface chase views.
 * Moving mouse right (+deltaX) decreases yaw (turns camera right);
 * moving mouse up (-deltaY) decreases orbit pitch (tilts view up unless invertY is true).
 */
export function computeMouseLookAngles(
  yaw: number,
  pitch: number,
  deltaX: number,
  deltaY: number,
  sensitivity: number = 1.0,
  invertY: boolean = false,
  minPitch: number = -0.68,
  maxPitch: number = 1.18
): MouseLookAngleResult {
  const safeDx = Number.isFinite(deltaX)
    ? Math.max(-MOUSELOOK_MAX_DELTA_PX, Math.min(MOUSELOOK_MAX_DELTA_PX, deltaX))
    : 0;
  const safeDy = Number.isFinite(deltaY)
    ? Math.max(-MOUSELOOK_MAX_DELTA_PX, Math.min(MOUSELOOK_MAX_DELTA_PX, deltaY))
    : 0;
  const safeSens = Number.isFinite(sensitivity)
    ? Math.max(0.2, Math.min(2.5, sensitivity))
    : 1.0;
  const radPerPx = MOUSELOOK_RAD_PER_PX * safeSens;
  const ySign = invertY ? -1 : 1;

  _mouseLookAngleResult.yaw = yaw - safeDx * radPerPx;
  const rawPitch = pitch + safeDy * ySign * radPerPx;
  _mouseLookAngleResult.pitch = Math.max(minPitch, Math.min(maxPitch, rawPitch));
  return _mouseLookAngleResult;
}

/**
 * Zero-allocation shortest-arc exponential angle damping helper.
 */
export function dampShortestAngle(
  current: number,
  target: number,
  lambda: number,
  dt: number
): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-lambda * dt));
}

// ============================================================================
// SCENE MATRIX GRAPH CULLING & WEBGPU TELEMETRY HELPERS
// ============================================================================

/**
 * Installs an O(1) subtree skip on `root.updateMatrixWorld(force)` so Three.js does NOT
 * waste CPU walking thousands of hidden or `matrixWorldAutoUpdate === false` descendants
 * every frame (Three.js's built-in `Object3D.updateMatrixWorld` recurses into children even when
 * `visible` or `matrixWorldAutoUpdate` is false). Calling `updateMatrixWorld(true)` still forces
 * a full recursive refresh when needed.
 */
export function installFastMatrixCull<T extends THREE.Object3D>(root: T): T {
  if (!root || root.userData.__fastMatrixCullInstalled) {
    return root;
  }
  root.userData.__fastMatrixCullInstalled = true;
  root.updateMatrixWorld = function fastUpdateMatrixWorld(force?: boolean): void {
    if (!this.visible || !this.matrixWorldAutoUpdate) {
      this.matrixWorldNeedsUpdate = true;
      return;
    }
    THREE.Object3D.prototype.updateMatrixWorld.call(this, force);
  };
  return root;
}

/**
 * Extracts accurate per-frame draw call counts across WebGPURenderer and WebGLRenderer.
 * In Three.js WebGPURenderer, `info.render.calls` counts lifetime `_renderScene` invocations
 * rather than current-frame draw calls, whereas `info.render.drawCalls` holds per-frame draws.
 */
export function extractWebGpuRenderDrawCalls(
  renderInfo: { calls?: number; drawCalls?: number } | undefined,
  isWebGpu: boolean
): number {
  if (!renderInfo) return 0;
  if (isWebGpu && typeof renderInfo.drawCalls === 'number') {
    return renderInfo.drawCalls;
  }
  return renderInfo.calls ?? 0;
}

export interface BackendBenchSample {
  supported: boolean;
  avgMs: number;
  maxMs: number;
  hadError: boolean;
}

export interface BackendBenchSelection {
  winner: 'webgpu' | 'webgl2';
  webGpuScoreMs: number;
  webGl2ScoreMs: number;
  reason: string;
}

/**
 * Picks the faster, cleaner graphics backend from live startup micro-benchmark results.
 * Weights average frame execution (72%) alongside worst-case tail spike (28%) so drivers with
 * severe command-queue stalls automatically yield to the smoother backend.
 */
export function selectBestGpuBackend(
  webGpu: BackendBenchSample,
  webGl2: BackendBenchSample
): BackendBenchSelection {
  const wgScore =
    webGpu.supported && !webGpu.hadError && Number.isFinite(webGpu.avgMs) && webGpu.avgMs > 0
      ? Math.round((webGpu.avgMs * 0.72 + Math.max(webGpu.avgMs, webGpu.maxMs) * 0.28) * 100) / 100
      : Number.POSITIVE_INFINITY;
  const glScore =
    webGl2.supported && !webGl2.hadError && Number.isFinite(webGl2.avgMs) && webGl2.avgMs > 0
      ? Math.round((webGl2.avgMs * 0.72 + Math.max(webGl2.avgMs, webGl2.maxMs) * 0.28) * 100) / 100
      : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(wgScore)) {
    return {
      winner: 'webgl2',
      webGpuScoreMs: wgScore,
      webGl2ScoreMs: glScore,
      reason: webGpu.hadError ? 'WebGPU driver error during bench -> WebGL2' : 'WebGPU unavailable -> WebGL2',
    };
  }
  if (!Number.isFinite(glScore)) {
    return {
      winner: 'webgpu',
      webGpuScoreMs: wgScore,
      webGl2ScoreMs: glScore,
      reason: 'WebGL2 unavailable -> WebGPU',
    };
  }

  // Slight <= 3% tolerance favors WebGPU compute capability on genuine ties; otherwise strictly faster wins
  if (wgScore <= glScore * 1.03) {
    return {
      winner: 'webgpu',
      webGpuScoreMs: wgScore,
      webGl2ScoreMs: glScore,
      reason: `WebGPU faster/tied (${webGpu.avgMs.toFixed(1)}ms vs WebGL2 ${webGl2.avgMs.toFixed(1)}ms)`,
    };
  }
  return {
    winner: 'webgl2',
    webGpuScoreMs: wgScore,
    webGl2ScoreMs: glScore,
    reason: `WebGL2 faster (${webGl2.avgMs.toFixed(1)}ms vs WebGPU ${webGpu.avgMs.toFixed(1)}ms)`,
  };
}

// ============================================================================
// RAM & VRAM MEMORY FOOTPRINT TELEMETRY + LOW-MEMORY DEVICE DETECTION
// ============================================================================

export function isLowMemoryEnvironment(
  isSoftwareGl: boolean = false,
  qualityPreset?: string
): boolean {
  if (qualityPreset === 'performance') return true;
  if (isSoftwareGl) return true;
  if (typeof navigator !== 'undefined') {
    const devMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    if (typeof devMem === 'number' && devMem > 0 && devMem <= 4) return true;
    if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) {
      return true;
    }
  }
  return false;
}

export interface SceneMemoryFootprint {
  jsHeapUsedMB: number | null;
  jsHeapTotalMB: number | null;
  deviceMemoryGb: number | null;
  estimatedGeoVramMB: number;
  estimatedTexVramMB: number;
  estimatedRenderTargetVramMB: number;
  estimatedTotalVramMB: number;
  uniqueGeometries: number;
  uniqueTextures: number;
}

const _memSeenGeos = new Set<string>();
const _memSeenTexs = new Set<string>();
const _memTexKeys = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'bumpMap',
  'emissiveMap',
  'alphaMap',
] as const;

/**
 * Computes exact JS Heap RAM (where exposed by Chromium) plus GPU VRAM estimates for unique
 * `BufferGeometry` buffers, uploaded `Texture` maps (+ mipmaps), and offscreen Shadow/PostFX targets.
 * Reuses static Sets so periodic telemetry polling avoids heap churn.
 */
export function measureSceneMemoryFootprint(
  scene: THREE.Scene,
  opts: {
    viewportWidth: number;
    viewportHeight: number;
    pixelRatio: number;
    shadowMapSize: number;
    shadowCasters?: number;
    postProcessingActive: boolean;
    ssaoEnabled: boolean;
    bloomEnabled: boolean;
    msaaSamples: number;
  }
): SceneMemoryFootprint {
  _memSeenGeos.clear();
  _memSeenTexs.clear();

  let geoBytes = 0;
  let texBytes = 0;

  const accountTex = (tex: THREE.Texture | null | undefined) => {
    if (!tex || _memSeenTexs.has(tex.uuid)) return;
    _memSeenTexs.add(tex.uuid);
    const img = tex.image as
      | { width?: number; height?: number; data?: { byteLength?: number } }
      | undefined;
    const srcData = (tex as unknown as { source?: { data?: { width?: number; height?: number } } })
      .source?.data;
    const w = img?.width || srcData?.width || 0;
    const h = img?.height || srcData?.height || 0;
    const rawBytes = img?.data?.byteLength || (w > 0 && h > 0 ? w * h * 4 : 0);
    const mipMult = tex.generateMipmaps ? 1.333 : 1.0;
    texBytes += rawBytes * mipMult;
  };

  scene.traverse((obj) => {
    const g = (obj as THREE.Mesh).geometry;
    if (g && !_memSeenGeos.has(g.uuid)) {
      _memSeenGeos.add(g.uuid);
      const attrs = g.attributes;
      if (attrs) {
        for (const key in attrs) {
          const attr = attrs[key];
          if (attr?.array?.byteLength) {
            geoBytes += attr.array.byteLength;
          }
        }
      }
      if (g.index?.array?.byteLength) {
        geoBytes += g.index.array.byteLength;
      }
    }

    const matProp = (obj as THREE.Mesh).material;
    if (matProp) {
      if (Array.isArray(matProp)) {
        for (let i = 0; i < matProp.length; i++) {
          const m = matProp[i] as unknown as Record<string, THREE.Texture | undefined>;
          for (let k = 0; k < _memTexKeys.length; k++) accountTex(m[_memTexKeys[k]]);
        }
      } else {
        const m = matProp as unknown as Record<string, THREE.Texture | undefined>;
        for (let k = 0; k < _memTexKeys.length; k++) accountTex(m[_memTexKeys[k]]);
      }
    }
  });
  accountTex(scene.environment);

  // Offscreen FBO / ShadowMap VRAM estimate (RGBA8/HalfFloat + depth)
  let rtBytes = 0;
  if (opts.shadowMapSize > 0) {
    const casters = Math.max(1, opts.shadowCasters ?? 1);
    rtBytes += opts.shadowMapSize * opts.shadowMapSize * 4 * casters;
  }
  if (opts.postProcessingActive) {
    const rtW = Math.max(1, Math.floor(opts.viewportWidth * opts.pixelRatio));
    const rtH = Math.max(1, Math.floor(opts.viewportHeight * opts.pixelRatio));
    const bpp = 8; // HalfFloat RGBA16F typical for HDR post-FX pipeline
    const msaaMult = Math.max(1, opts.msaaSamples || 1);
    // Ping-pong composer buffers (primary target + resolve/pass buffer)
    rtBytes += rtW * rtH * bpp * (msaaMult + 1);
    // Depth + color buffer
    rtBytes += rtW * rtH * 4;
    if (opts.ssaoEnabled) {
      rtBytes += rtW * rtH * 8;
    }
    if (opts.bloomEnabled) {
      // Mip pyramid (~1.33x quarter-res)
      rtBytes += (rtW * rtH * bpp * 0.25) * 1.333;
    }
  }

  let jsHeapUsedMB: number | null = null;
  let jsHeapTotalMB: number | null = null;
  if (typeof performance !== 'undefined') {
    const pMem = (
      performance as unknown as {
        memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
      }
    ).memory;
    if (pMem && typeof pMem.usedJSHeapSize === 'number') {
      jsHeapUsedMB = +(pMem.usedJSHeapSize / 1048576).toFixed(1);
    }
    if (pMem && typeof pMem.totalJSHeapSize === 'number') {
      jsHeapTotalMB = +(pMem.totalJSHeapSize / 1048576).toFixed(1);
    }
  }

  let deviceMemoryGb: number | null = null;
  if (typeof navigator !== 'undefined') {
    const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    if (typeof dm === 'number' && dm > 0) deviceMemoryGb = dm;
  }

  const uniqueGeometries = _memSeenGeos.size;
  const uniqueTextures = _memSeenTexs.size;
  _memSeenGeos.clear();
  _memSeenTexs.clear();

  const estimatedGeoVramMB = +(geoBytes / 1048576).toFixed(2);
  const estimatedTexVramMB = +(texBytes / 1048576).toFixed(2);
  const estimatedRenderTargetVramMB = +(rtBytes / 1048576).toFixed(2);

  return {
    jsHeapUsedMB,
    jsHeapTotalMB,
    deviceMemoryGb,
    estimatedGeoVramMB,
    estimatedTexVramMB,
    estimatedRenderTargetVramMB,
    estimatedTotalVramMB: +(
      estimatedGeoVramMB +
      estimatedTexVramMB +
      estimatedRenderTargetVramMB
    ).toFixed(2),
    uniqueGeometries,
    uniqueTextures,
  };
}


