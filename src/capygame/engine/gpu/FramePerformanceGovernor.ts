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
  const targetOccAlpha = screenEdgeFade * (0.75 + 0.25 * screenEdgeFade) * 0.18;

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
