import { GpuQualityPreset } from '../../types';

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
 * Computes optimal WebGL devicePixelRatio cap to sustain locked 60 FPS on 2x-3x HiDPI displays
 * without sacrificing crisp silhouette edges.
 */
export function computeEffectivePixelRatio(
  devicePixelRatio: number,
  preset: AnyGpuPreset,
  postProcessingEnabled: boolean,
  isSoftwareGl: boolean
): number {
  const safeDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  if (isSoftwareGl || preset === 'low' || preset === 'performance') {
    return 1.0;
  }
  if (preset === 'balanced') {
    return Math.min(safeDpr, postProcessingEnabled ? 1.35 : 1.5);
  }
  if (preset === 'high') {
    return Math.min(safeDpr, postProcessingEnabled ? 1.65 : 2.0);
  }
  return Math.min(safeDpr, 2.0);
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
  private entries: Array<{
    id: number;
    timestampMs: number;
    elapsedLabel: string;
    severity: 'warn' | 'critical';
    fps: number;
    frameMs: number;
    stageLabel: string;
    cause: string;
    mitigation: string;
  }> = [];
  private nextEntryId = 1;
  private droppedFramesCount = 0;
  private lastAlertTimestampMs = -10000;
  private lastSampleMs = 16.67;
  private liveFps = 60;
  private smoothedFps = 60;
  private warmupFramesRemaining = 4;
  private startTimestampMs = 0;
  public lock60FpsEnabled = true;

  constructor(startTimeMs: number = Date.now()) {
    this.startTimestampMs = startTimeMs;
    this.fpsHistory.fill(60);
    this.msHistory.fill(16.67);
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
    if (this.warmupFramesRemaining > 0) {
      this.warmupFramesRemaining--;
      this.liveFps = this.lock60FpsEnabled
        ? Math.min(60, Math.round(this.smoothedFps))
        : Math.round(this.smoothedFps);
      return { isLagDrop: false, shouldReduceLoad: false };
    }

    // On software GL headless pacing, measure actual CPU+GL draw execution time against 16.67ms budget
    // so intentional sleep timers aren't misreported as lag, while real frame execution >22ms IS caught.
    const effectiveMs = isSoftwareGl
      ? Math.max(0.5, frameWorkMs)
      : Math.max(0.5, wallIntervalMs);
    const rawInstantFps = Math.min(240, Math.round((1000 / Math.max(4, effectiveMs)) * 10) / 10);
    const recordedFps = this.lock60FpsEnabled ? Math.min(60, rawInstantFps) : rawInstantFps;

    this.fpsHistory[this.writeIdx] = recordedFps;
    this.msHistory[this.writeIdx] = effectiveMs;
    this.writeIdx = (this.writeIdx + 1) % PERF_HISTORY_LEN;
    if (this.sampleCount < PERF_HISTORY_LEN) this.sampleCount++;

    this.lastSampleMs = effectiveMs;
    this.smoothedFps = this.smoothedFps * 0.72 + recordedFps * 0.28;
    const maxCap = this.lock60FpsEnabled ? 60 : 240;
    this.liveFps = Math.max(1, Math.min(maxCap, Math.round(this.smoothedFps)));

    const isCrit = effectiveMs > 33.4 || rawInstantFps < 35;
    const isWarn = effectiveMs > 20.5 || rawInstantFps < 54;
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
          isSoftwareGl ? 'Software GL CPU raster spike' : isCrit ? 'Heavy GPU/physics frame hitch (>33ms)' : 'Frame budget exceeded (>20.5ms)',
          mitigationLabel
        );
      }
    }

    return {
      isLagDrop,
      shouldReduceLoad: this.lock60FpsEnabled && (isLagDrop || this.getAvgFrameMs() > 18.2),
    };
  }

  public recordSyntheticLagSpike(
    frameMs: number,
    stageLabel: string,
    mitigation: string = 'Dropped LOD / Post-FX load to restore 60 FPS',
    nowMs: number = Date.now()
  ) {
    const fps = Math.max(1, Math.round(1000 / Math.max(4, frameMs)));
    const cappedFps = this.lock60FpsEnabled ? Math.min(60, fps) : fps;
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

    this.entries.unshift({
      id: this.nextEntryId++,
      timestampMs: nowMs,
      elapsedLabel,
      severity,
      fps,
      frameMs: Math.round(frameMs * 10) / 10,
      stageLabel,
      cause,
      mitigation,
    });
    if (this.entries.length > PERF_MAX_LOG_ENTRIES) {
      this.entries.length = PERF_MAX_LOG_ENTRIES;
    }
  }

  public clear(nowMs: number = Date.now()) {
    this.entries.length = 0;
    this.droppedFramesCount = 0;
    this.lastAlertTimestampMs = nowMs - 10000;
    this.fpsHistory.fill(60);
    this.msHistory.fill(16.67);
    this.lastSampleMs = 16.67;
    this.smoothedFps = 60;
    this.liveFps = 60;
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
      lastAlertSummary: latest ? `${latest.fps} FPS (${latest.frameMs}ms) · ${latest.stageLabel}` : null,
      lock60FpsEnabled: this.lock60FpsEnabled,
      entries: this.entries.slice(),
    };
  }
}

