/**
 * FPS-driven adaptive render distance and foliage quality governor for Capytorio.
 *
 * Defaults to full unrestricted view distance (up to 112 tiles / 225x225 span, 8192 trees,
 * 8192 ore tiles, full shadows and citrus fruits). Only reduces foliage quality or view
 * distance when sustained frame rate drops below target FPS, and automatically recovers
 * once frame rate stabilizes. Zero heap allocations per frame.
 */

export const CAPYTORIO_MAX_VIEW_RADIUS_TILES = 112;
export const CAPYTORIO_MIN_VIEW_RADIUS_TILES = 36;
export const CAPYTORIO_MAX_TREE_BUDGET = 8192;
export const CAPYTORIO_MAX_ORE_BUDGET = 8192;
export const CAPYTORIO_MAX_ORANGE_BUDGET = 3072;

export interface CapytorioAdaptiveLodState {
  smoothedFps: number;
  lowFpsSeconds: number;
  highFpsSeconds: number;
  /** 0 = full quality & max view distance, 1 = foliage fruits off, 2 = foliage shadows off, 3..5 = progressive distance trim */
  qualityTier: number;
  viewDistanceScale: number;
  enableTreeFruits: boolean;
  enableTreeShadows: boolean;
  maxTreeBudget: number;
  maxOreBudget: number;
  warmupFrames: number;
}

const TIER_VIEW_SCALES: readonly number[] = [1.0, 1.0, 1.0, 0.82, 0.64, 0.48];
const TIER_TREE_BUDGETS: readonly number[] = [8192, 8192, 8192, 5600, 3600, 2200];
const TIER_ORE_BUDGETS: readonly number[] = [8192, 8192, 8192, 6144, 4096, 2560];
const MAX_QUALITY_TIER = TIER_VIEW_SCALES.length - 1;

export function createCapytorioAdaptiveLodState(): CapytorioAdaptiveLodState {
  return {
    smoothedFps: 60,
    lowFpsSeconds: 0,
    highFpsSeconds: 0,
    qualityTier: 0,
    viewDistanceScale: 1.0,
    enableTreeFruits: true,
    enableTreeShadows: true,
    maxTreeBudget: CAPYTORIO_MAX_TREE_BUDGET,
    maxOreBudget: CAPYTORIO_MAX_ORE_BUDGET,
    warmupFrames: 12,
  };
}

function applyQualityTier(state: CapytorioAdaptiveLodState, tier: number): void {
  const clamped = Math.max(0, Math.min(MAX_QUALITY_TIER, tier | 0));
  state.qualityTier = clamped;
  state.viewDistanceScale = TIER_VIEW_SCALES[clamped];
  state.enableTreeFruits = clamped === 0;
  state.enableTreeShadows = clamped <= 1;
  state.maxTreeBudget = TIER_TREE_BUDGETS[clamped];
  state.maxOreBudget = TIER_ORE_BUDGETS[clamped];
}

/**
 * Updates the FPS governor in-place with zero allocations.
 * Returns true if the quality tier changed (so the renderer knows to refresh instanced buffers).
 */
export function stepCapytorioAdaptiveLod(
  state: CapytorioAdaptiveLodState,
  dtSec: number,
  measuredFpsOverride?: number
): boolean {
  if (!Number.isFinite(dtSec) || dtSec <= 0.0005 || dtSec > 0.35) {
    return false;
  }
  if (state.warmupFrames > 0) {
    state.warmupFrames--;
    return false;
  }

  const instantFps =
    typeof measuredFpsOverride === 'number' && Number.isFinite(measuredFpsOverride) && measuredFpsOverride > 0
      ? Math.max(5, Math.min(240, measuredFpsOverride))
      : Math.max(5, Math.min(240, 1 / dtSec));

  state.smoothedFps = state.smoothedFps * 0.88 + instantFps * 0.12;

  const prevTier = state.qualityTier;
  // Degrade quality ONLY when sustained FPS impacts smoothness (< 38 FPS for tier 0..2, < 34 FPS for distance trim)
  const degradeThreshold = state.qualityTier < 2 ? 38 : 34;
  if (state.smoothedFps < degradeThreshold) {
    state.lowFpsSeconds += dtSec;
    state.highFpsSeconds = 0;
    const holdNeeded = state.smoothedFps < 22 ? 0.45 : 0.85;
    if (state.lowFpsSeconds >= holdNeeded && state.qualityTier < MAX_QUALITY_TIER) {
      applyQualityTier(state, state.qualityTier + 1);
      state.lowFpsSeconds = 0;
    }
  } else if (state.smoothedFps >= 48) {
    state.highFpsSeconds += dtSec;
    state.lowFpsSeconds = 0;
    if (state.highFpsSeconds >= 1.35 && state.qualityTier > 0) {
      applyQualityTier(state, state.qualityTier - 1);
      state.highFpsSeconds = 0;
    }
  } else {
    // Hysteresis deadband (38..48 FPS): gently decay counters to prevent oscillation
    state.lowFpsSeconds = Math.max(0, state.lowFpsSeconds - dtSec * 0.5);
    state.highFpsSeconds = Math.max(0, state.highFpsSeconds - dtSec * 0.5);
  }

  return state.qualityTier !== prevTier;
}

/**
 * Computes desired visible tile radius around camera target for trees and ores.
 * Scales generously with camera altitude so all visible trees render edge-to-edge,
 * and only contracts when `state.viewDistanceScale < 1` due to sustained low FPS.
 */
export function computeCapytorioVisibleTileRadius(
  altitudeRadius: number,
  state: CapytorioAdaptiveLodState
): number {
  if (altitudeRadius > 1400) return 0;
  // Match perspective frustum footprint generously so forests never cut off on-screen
  const desired = Math.min(
    CAPYTORIO_MAX_VIEW_RADIUS_TILES,
    Math.max(CAPYTORIO_MIN_VIEW_RADIUS_TILES, Math.round(altitudeRadius * 0.62 + 16))
  );
  const scaled = Math.round(desired * state.viewDistanceScale);
  // Quantize upward to 8-tile bands so smooth camera zooming never churns 50k-tile prop scans every frame
  const quantized = Math.ceil(Math.max(24, scaled) / 8) * 8;
  return Math.max(24, Math.min(CAPYTORIO_MAX_VIEW_RADIUS_TILES, quantized));
}
