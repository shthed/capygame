import { FOREST_MICRO_SPECIMENS, type ForestMicroSpecimenId } from './forestMicroSpecimens';

/**
 * Discrete smooth cruise-velocity gears expressed in UI "Forward Speed" units:
 * Positive = fly INWARD / FORWARD (decreasing log10 meters toward Forest & Quantum scales)
 * Negative = fly BACKWARD / OUTWARD (increasing log10 meters toward Galaxy & Multiverse)
 * Zero     = Hover / Hold stationary
 *
 * Notice the engine's internal `cruiseVelocityLogPerSec` has the opposite sign:
 * `cruiseVelocityLogPerSec = -forwardSpeed`.
 */
export const FLIGHT_SPEED_GEARS: readonly number[] = [
  -1.25,
  -0.65,
  -0.32,
  -0.16,
  -0.08,
  0.0,
  0.08,
  0.16,
  0.32,
  0.65,
  1.25,
];

export const MAX_FLIGHT_SPEED_MAGNITUDE = 2.0;

/**
 * Steps to the next discrete smooth speed gear (`direction: +1` for Faster / more forward,
 * `-1` for Slower / toward reverse) without abrupt universe band jumps.
 */
export function stepFlightSpeedGear(
  currentCruiseVelLogPerSec: number,
  direction: -1 | 1
): number {
  // Convert internal engine vel (negative = inward) to user-facing forward speed (+ = inward/forward)
  const currentForward = -currentCruiseVelLogPerSec;

  if (direction > 0) {
    // Faster -> find first gear strictly greater than currentForward + epsilon
    for (let i = 0; i < FLIGHT_SPEED_GEARS.length; i++) {
      if (FLIGHT_SPEED_GEARS[i] > currentForward + 0.025) {
        const next = -FLIGHT_SPEED_GEARS[i];
        return next === 0 ? 0 : next;
      }
    }
    const maxGear = -FLIGHT_SPEED_GEARS[FLIGHT_SPEED_GEARS.length - 1];
    return maxGear === 0 ? 0 : maxGear;
  } else {
    // Slower -> find highest gear strictly less than currentForward - epsilon
    for (let i = FLIGHT_SPEED_GEARS.length - 1; i >= 0; i--) {
      if (FLIGHT_SPEED_GEARS[i] < currentForward - 0.025) {
        const prev = -FLIGHT_SPEED_GEARS[i];
        return prev === 0 ? 0 : prev;
      }
    }
    const minGear = -FLIGHT_SPEED_GEARS[0];
    return minGear === 0 ? 0 : minGear;
  }
}

export function clampForwardFlightSpeed(forwardSpeed: number): number {
  if (!Number.isFinite(forwardSpeed)) return 0;
  const clamped = Math.max(-MAX_FLIGHT_SPEED_MAGNITUDE, Math.min(MAX_FLIGHT_SPEED_MAGNITUDE, forwardSpeed));
  return Math.abs(clamped) < 0.03 ? 0 : Math.round(clamped * 100) / 100;
}

export function formatFlightSpeedReadout(cruiseVelLogPerSec: number): {
  mode: 'forward' | 'reverse' | 'hover';
  forwardSpeed: number;
  shortLabel: string;
  kidLabel: string;
} {
  const forwardSpeed = Math.abs(cruiseVelLogPerSec) < 0.03 ? 0 : -cruiseVelLogPerSec;
  if (forwardSpeed === 0) {
    return {
      mode: 'hover',
      forwardSpeed: 0,
      shortLabel: 'Hover',
      kidLabel: 'Stopped',
    };
  }
  const abs = Math.abs(forwardSpeed);
  const mag = abs >= 10 ? abs.toFixed(0) : abs >= 1.0 ? abs.toFixed(1) : abs.toFixed(2);
  if (forwardSpeed > 0) {
    return {
      mode: 'forward',
      forwardSpeed,
      shortLabel: `Fwd ${mag}x`,
      kidLabel: `Forward ${mag}x`,
    };
  }
  return {
    mode: 'reverse',
    forwardSpeed,
    shortLabel: `Rev ${mag}x`,
    kidLabel: `Back ${mag}x`,
  };
}

export type FlightTrajectoryMode = 'straight' | 'spiral';
export type MediaSpeedAction = 'rewind' | 'play_pause' | 'fast_forward';

export const MEDIA_SPEED_GEARS: readonly number[] = [0.08, 0.16, 0.32, 0.65, 1.25];
export const STEADY_TARGET_GLIDE_MAX_LOG_PER_SEC = 0.9;

/**
 * Advances `currentLog` steadily through space toward `targetLog` at a bounded,
 * constant cruise rate with a gentle arrival cushion instead of exponential warping.
 */
export function stepSteadyLogScaleTowardTarget(
  currentLog: number,
  targetLog: number,
  dt: number,
  maxRateLogPerSec: number = STEADY_TARGET_GLIDE_MAX_LOG_PER_SEC
): number {
  if (!Number.isFinite(dt) || dt <= 0) return currentLog;
  const diff = targetLog - currentLog;
  const absDiff = Math.abs(diff);
  if (absDiff < 0.0004) return targetLog;
  const easeWindow = 0.25;
  const easeFactor = absDiff < easeWindow ? Math.max(0.3, absDiff / easeWindow) : 1.0;
  const step = Math.min(absDiff, Math.max(0.005 * dt, maxRateLogPerSec * easeFactor * dt));
  return currentLog + Math.sign(diff) * step;
}

/**
 * Steps cruise velocity using a clean 3-button transport interface:
 * Rewind (zoom outward) · Play/Pause · Fast Forward (zoom inward).
 */
export function stepMediaSpeedControl(
  currentCruiseVelLogPerSec: number,
  action: MediaSpeedAction,
  resumeForwardMagnitude: number = 0.16
): number {
  const currentForward = Math.abs(currentCruiseVelLogPerSec) < 0.03 ? 0 : -currentCruiseVelLogPerSec;

  if (action === 'play_pause') {
    if (Math.abs(currentForward) > 0.03) {
      return 0;
    }
    const clampedResume = Math.max(0.08, Math.min(1.25, Math.abs(resumeForwardMagnitude) || 0.16));
    return -clampedResume;
  }

  if (action === 'fast_forward') {
    if (currentForward <= 0.03) {
      return -0.32;
    }
    for (let i = 0; i < MEDIA_SPEED_GEARS.length; i++) {
      if (MEDIA_SPEED_GEARS[i] > currentForward + 0.025) {
        return -MEDIA_SPEED_GEARS[i];
      }
    }
    return -MEDIA_SPEED_GEARS[MEDIA_SPEED_GEARS.length - 1];
  }

  // action === 'rewind'
  if (currentForward >= -0.03) {
    return 0.16;
  }
  const currentReverseMag = -currentForward;
  for (let i = 0; i < MEDIA_SPEED_GEARS.length; i++) {
    if (MEDIA_SPEED_GEARS[i] > currentReverseMag + 0.025) {
      return MEDIA_SPEED_GEARS[i];
    }
  }
  return MEDIA_SPEED_GEARS[MEDIA_SPEED_GEARS.length - 1];
}

export const SURFACE_ZOOM_MIN_DIST = 0.45;
export const SURFACE_ZOOM_ORBIT_THRESHOLD = 2.2;
export const FOREST_GAMES_ZOOM_MAX_DIST = 2.35;
export const CAPYBARA_FOREST_LAUNCH_BASE_LOG = 0.8;
export const CAPYTORIO_OBLIQUE_BASE_RADIUS_M = 26.0;
export const CAPYTORIO_ZOOM_MIN_DIST = 0.45;
export const CAPYTORIO_ORBIT_HANDOFF_DIST = 9000;
export const CAPYTORIO_ORBIT_HANDOFF_LOG_METERS = Math.log10(
  CAPYTORIO_OBLIQUE_BASE_RADIUS_M * CAPYTORIO_ORBIT_HANDOFF_DIST
);

export interface SurfaceZoomStepResult {
  nextDistance: number;
  launchToOrbit: boolean;
  launchTargetLogMeters: number;
}

export type StandaloneGameMode = 'infinite_zoom' | 'forest_games' | 'capytorio';

export interface ActiveSimulationMask {
  runInfiniteZoom: boolean;
  runForestGames: boolean;
  runForestWeatherAndWater: boolean;
  runCapytorioFactory: boolean;
}

/**
 * Resolves the active standalone top-level game from engine flags.
 * Capytorio UFO orbital flight remains part of the Capytorio standalone mode
 * rather than mixing back into Forest Games.
 */
export function resolveTopLevelGameMode(
  seamlessZoomActive: boolean,
  activeSurfaceMode: string,
  isCapytorioOrbitalFlight: boolean = false
): StandaloneGameMode {
  if (isCapytorioOrbitalFlight) return 'capytorio';
  if (seamlessZoomActive) return 'infinite_zoom';
  return activeSurfaceMode === 'capytorio' ? 'capytorio' : 'forest_games';
}

/**
 * Determines which simulation subsystems are allowed to tick in the active standalone game.
 * Guarantees strict isolation: Capytorio pauses outside Capytorio, Forest pauses outside
 * Forest Games, and Infinite Zoom pauses outside Infinite Zoom (except Capytorio's UFO flight).
 */
const SIM_MASK_INFINITE_ZOOM: Readonly<ActiveSimulationMask> = Object.freeze({
  runInfiniteZoom: true,
  runForestGames: false,
  runForestWeatherAndWater: false,
  runCapytorioFactory: false,
});

const SIM_MASK_FOREST_GAMES: Readonly<ActiveSimulationMask> = Object.freeze({
  runInfiniteZoom: false,
  runForestGames: true,
  runForestWeatherAndWater: true,
  runCapytorioFactory: false,
});

const SIM_MASK_CAPYTORIO_SURFACE: Readonly<ActiveSimulationMask> = Object.freeze({
  runInfiniteZoom: false,
  runForestGames: false,
  runForestWeatherAndWater: false,
  runCapytorioFactory: true,
});

const SIM_MASK_CAPYTORIO_ORBITAL: Readonly<ActiveSimulationMask> = Object.freeze({
  runInfiniteZoom: true,
  runForestGames: false,
  runForestWeatherAndWater: false,
  runCapytorioFactory: false,
});

export function evaluateActiveSimulationSubsystems(
  activeGame: StandaloneGameMode,
  isCapytorioOrbitalFlight: boolean = false
): ActiveSimulationMask {
  if (activeGame === 'infinite_zoom') {
    return SIM_MASK_INFINITE_ZOOM;
  }
  if (activeGame === 'forest_games') {
    return SIM_MASK_FOREST_GAMES;
  }
  return isCapytorioOrbitalFlight ? SIM_MASK_CAPYTORIO_ORBITAL : SIM_MASK_CAPYTORIO_SURFACE;
}

/**
 * Computes surface camera zoom distance step across Forest Games and surface views.
 * When `allowOrbitLaunch` is false (standalone Forest Games), distance clamps cleanly
 * to comfortable playable distances `[SURFACE_ZOOM_MIN_DIST, FOREST_GAMES_ZOOM_MAX_DIST]`
 * so scrolling out never accidentally launches into Infinite Zoom.
 */
export function computeSurfaceZoomStep(
  currentDist: number,
  delta: number,
  inPlayingStage: boolean,
  allowOrbitLaunch: boolean = true
): SurfaceZoomStepResult {
  const safeCur = Number.isFinite(currentDist) ? currentDist : 1.0;
  const rawDist = safeCur - delta * 1.15;
  if (
    allowOrbitLaunch &&
    delta < 0 &&
    (rawDist >= SURFACE_ZOOM_ORBIT_THRESHOLD || (delta <= -0.3 && inPlayingStage))
  ) {
    return {
      nextDistance: SURFACE_ZOOM_ORBIT_THRESHOLD,
      launchToOrbit: true,
      launchTargetLogMeters:
        CAPYBARA_FOREST_LAUNCH_BASE_LOG + Math.max(0.55, Math.abs(delta) * 1.45),
    };
  }
  const maxDist = allowOrbitLaunch ? SURFACE_ZOOM_ORBIT_THRESHOLD : FOREST_GAMES_ZOOM_MAX_DIST;
  const clamped = Math.max(SURFACE_ZOOM_MIN_DIST, Math.min(maxDist, rawDist));
  return {
    nextDistance: Math.round(clamped * 100) / 100,
    launchToOrbit: false,
    launchTargetLogMeters: CAPYBARA_FOREST_LAUNCH_BASE_LOG,
  };
}

/**
 * Computes proportional overhead zoom distance for Capytorio mode, staying in the
 * top-down view all the way up to ~234 km (~<0.5px factory footprint inside the
 * planet surface texture) before transitioning smoothly into orbital spaceflight.
 */
export function computeCapytorioZoomStep(
  currentDist: number,
  delta: number
): SurfaceZoomStepResult {
  const safeCur =
    Number.isFinite(currentDist) && currentDist > 0
      ? Math.max(CAPYTORIO_ZOOM_MIN_DIST, Math.min(CAPYTORIO_ORBIT_HANDOFF_DIST, currentDist))
      : 1.0;
  const factor = Math.exp(-delta * 1.15);
  const rawDist = safeCur * factor;

  if (delta < 0 && rawDist >= CAPYTORIO_ORBIT_HANDOFF_DIST) {
    return {
      nextDistance: CAPYTORIO_ORBIT_HANDOFF_DIST,
      launchToOrbit: true,
      launchTargetLogMeters: CAPYTORIO_ORBIT_HANDOFF_LOG_METERS + Math.max(0.32, Math.abs(delta) * 0.8),
    };
  }

  const clamped = Math.max(
    CAPYTORIO_ZOOM_MIN_DIST,
    Math.min(CAPYTORIO_ORBIT_HANDOFF_DIST, rawDist)
  );
  return {
    nextDistance: Math.round(clamped * 1000) / 1000,
    launchToOrbit: false,
    launchTargetLogMeters: CAPYTORIO_ORBIT_HANDOFF_LOG_METERS,
  };
}

/**
 * Adjusts orbital/cosmic log-scale cruise velocity smoothly in response to zoom +/-
 * gestures, wheels, or mobile zoom buttons without artificial ceiling stalls.
 */
export function computeOrbitalZoomThrottleStep(
  currentTargetVelLogPerSec: number,
  wheelDelta: number,
  justLaunched: boolean = false
): number {
  const safeCur = Number.isFinite(currentTargetVelLogPerSec) ? currentTargetVelLogPerSec : 0;
  if (justLaunched && wheelDelta < 0) {
    return Math.max(0.55, Math.min(2.5, Math.abs(wheelDelta) * 1.6));
  }
  const impulse = -wheelDelta * 1.35;
  let nextTarget = Math.max(-2.5, Math.min(2.5, safeCur + impulse));
  if (Math.abs(nextTarget) < 0.04) {
    nextTarget = 0;
  }
  return Math.round(nextTarget * 1000) / 1000;
}

/**
 * Computes cumulative orbital spiral angle in radians across `UNIVERSE_SCALE_BANDS`
 * so flying smoothly through any zoom band completes an exact full 360° (2π rad) circle.
 */
export function computeSpiralOrbitAngleRadians(
  logMeters: number,
  bandLogMetersDescending: readonly number[]
): number {
  const count = bandLogMetersDescending.length;
  if (count < 2) return 0;
  if (logMeters >= bandLogMetersDescending[0]) return 0;
  if (logMeters <= bandLogMetersDescending[count - 1]) {
    return (count - 1) * Math.PI * 2;
  }
  for (let i = 0; i < count - 1; i++) {
    const hi = bandLogMetersDescending[i];
    const lo = bandLogMetersDescending[i + 1];
    if (logMeters <= hi && logMeters >= lo) {
      const span = Math.max(1e-6, hi - lo);
      const frac = (hi - logMeters) / span;
      return (i + frac) * Math.PI * 2;
    }
  }
  return 0;
}

const VALID_SPECIMEN_SET: ReadonlySet<string> = new Set(
  FOREST_MICRO_SPECIMENS.map((s) => s.id)
);

export function sanitizeDiscoveredSpecimens(raw: unknown): ForestMicroSpecimenId[] {
  if (!Array.isArray(raw)) return [];
  const unique: ForestMicroSpecimenId[] = [];
  for (let i = 0; i < raw.length; i++) {
    const val = raw[i];
    if (typeof val === 'string' && VALID_SPECIMEN_SET.has(val) && !unique.includes(val as ForestMicroSpecimenId)) {
      unique.push(val as ForestMicroSpecimenId);
    }
  }
  return unique;
}

export function mergeDiscoveredSpecimen(
  current: readonly ForestMicroSpecimenId[] | undefined,
  specimenId: ForestMicroSpecimenId
): { list: ForestMicroSpecimenId[]; isNew: boolean } {
  const existing = current ? [...current] : [];
  if (!VALID_SPECIMEN_SET.has(specimenId) || existing.includes(specimenId)) {
    return { list: existing, isNew: false };
  }
  existing.push(specimenId);
  return { list: existing, isNew: true };
}

/**
 * Formats an exponent `log10(meters)` into astronomically and physically realistic
 * human-readable units across all 65 orders of magnitude (10^-35 m -> 10^+30 m).
 */
export function formatRealisticScaleMeters(logMeters: number): string {
  const meters = Math.pow(10, logMeters);

  // Above Observable Horizon (~8.80e26 m = 93.0 Gly, log >= 27.0): use clean scientific notation
  if (logMeters >= 27.0) {
    const exp = Math.floor(logMeters);
    const mantissa = Math.pow(10, logMeters - exp);
    const roundedMant = mantissa >= 9.95 ? 1.0 : mantissa;
    const finalExp = mantissa >= 9.95 ? exp + 1 : exp;
    return `${roundedMant.toFixed(1)}×10^${finalExp} m`;
  }
  if (logMeters >= 25.0) {
    const gly = meters / 9.46073e24;
    return `${gly >= 10 ? gly.toFixed(1) : gly.toFixed(2)} Gly`;
  }
  if (logMeters >= 22.0) {
    const mly = meters / 9.46073e21;
    return `${mly >= 100 ? mly.toFixed(0) : mly >= 10 ? mly.toFixed(1) : mly.toFixed(2)} Mly`;
  }
  if (logMeters >= 15.98) {
    const ly = meters / 9.46073e15;
    if (ly >= 1000) {
      return `${Math.round(ly).toLocaleString('en-US')} ly`;
    }
    return `${ly >= 100 ? ly.toFixed(0) : ly.toFixed(2)} ly`;
  }
  if (logMeters >= 11.0) {
    const au = meters / 1.4959787e11;
    return `${au >= 100 ? Math.round(au).toLocaleString('en-US') : au >= 10 ? au.toFixed(1) : au.toFixed(2)} AU`;
  }
  if (logMeters >= 3.0) {
    const km = meters / 1e3;
    if (km >= 1000) {
      return `${Math.round(km).toLocaleString('en-US')} km`;
    }
    return km >= 100 ? `${km.toFixed(0)} km` : `${km.toFixed(2)} km`;
  }
  if (logMeters >= 0.0) {
    return `${meters >= 100 ? meters.toFixed(0) : meters >= 10 ? meters.toFixed(1) : meters.toFixed(2)} m`;
  }
  if (logMeters >= -2.5) {
    return `${(meters * 100).toFixed(2)} cm`;
  }
  if (logMeters >= -3.5) {
    return `${(meters * 1e3).toFixed(2)} mm`;
  }
  if (logMeters >= -6.5) {
    return `${(meters * 1e6).toFixed(2)} µm`;
  }
  if (logMeters >= -9.15) {
    return `${(meters * 1e9).toFixed(2)} nm`;
  }
  if (logMeters >= -10.35) {
    // Atomic Angstrom regime (1 Å = 10^-10 m)
    return `${(meters * 1e10).toFixed(2)} Å`;
  }
  if (logMeters >= -12.5) {
    return `${(meters * 1e12).toFixed(2)} pm`;
  }
  if (logMeters >= -16.5) {
    return `${(meters * 1e15).toFixed(2)} fm`;
  }
  if (logMeters >= -20.5) {
    return `${(meters * 1e18).toFixed(2)} am`;
  }
  if (logMeters >= -23.5) {
    return `${(meters * 1e21).toFixed(2)} zm`;
  }
  if (logMeters >= -26.5) {
    return `${(meters * 1e24).toFixed(2)} ym`;
  }
  if (logMeters <= -34.0) {
    const planckLengths = Math.pow(10, logMeters - -34.7915);
    return `${planckLengths.toFixed(2)} l_P`;
  }
  const exp = Math.floor(logMeters);
  const mant = Math.pow(10, logMeters - exp);
  const adjMant = mant >= 9.95 ? 1.0 : mant;
  const adjExp = mant >= 9.95 ? exp + 1 : exp;
  return `${adjMant.toFixed(1)}×10^${adjExp} m`;
}

// ============================================================================
// INFINITE ZOOM TRANSITION POLISH MATH (ZERO ALLOCATION, SHARED BY RUNTIME & TESTS)
// ============================================================================

export const CHROMATIN_BRIDGE_LOG_METERS = -6.4;

function smoothstepUnit(edge0: number, edge1: number, x: number): number {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-9) return x >= edge1 ? 1 : 0;
  const raw = (x - edge0) / denom;
  const t = raw <= 0 ? 0 : raw >= 1 ? 1 : raw;
  return t * t * (3 - 2 * t);
}

/**
 * Canonical descending log10(m) landmark centers matching `UNIVERSE_SCALE_BANDS`,
 * pre-allocated at module scope for zero per-frame allocation in cruise pacing.
 */
const CANONICAL_UNIVERSE_BAND_LOGS_DESC: readonly number[] = [
  30.0, 27.6, 26.8, 25.4, 24.0, 22.9, 21.0, 16.0, 14.2, 12.6, 8.85, 7.1, 4.9, 3.6,
  2.2, 0.8, -2.0, -4.3, -8.47, -9.47, -14.27, -18.0, -23.0, -29.0, -35.0,
];

/**
 * Continuous, C1-smooth camera minimum pitch floor across all 65 orders of magnitude.
 * Smoothly lifts from -0.68 rad in deep space to +0.14 rad through terrestrial layers
 * (Atmosphere -> Land Masses -> Ecosystems -> Forest Glade -> Leaf & Fur) and gently
 * relaxes back to -0.68 rad entering Biological Cells & Quantum scales with zero snap.
 */
export function computeInfiniteZoomHorizonMinPitch(
  logScaleMeters: number,
  showPlayableSurface: boolean = false
): number {
  if (showPlayableSurface) return 0.14;
  const upperRamp = smoothstepUnit(5.8, 4.4, logScaleMeters);
  const lowerRamp = smoothstepUnit(-3.6, -2.2, logScaleMeters);
  const terrestrialWeight = upperRamp * lowerRamp;
  return -0.68 + (0.14 - -0.68) * terrestrialWeight;
}

/**
 * Adaptive auto-zoom / glide speed multiplier: holds a calm 1.0x pace near every
 * scale landmark and smoothly accelerates up to 1.85x across wide inter-band spans
 * (such as Cells -4.3 -> DNA -8.47 or Atom -9.47 -> Nucleus -14.27).
 */
export function computeAdaptiveCruiseSpeedMultiplier(
  logScaleMeters: number,
  bandLogMetersDescending: readonly number[] = CANONICAL_UNIVERSE_BAND_LOGS_DESC
): number {
  const count = bandLogMetersDescending.length;
  if (count < 2 || !Number.isFinite(logScaleMeters)) return 1.0;
  if (logScaleMeters >= bandLogMetersDescending[0] || logScaleMeters <= bandLogMetersDescending[count - 1]) {
    return 1.0;
  }
  for (let i = 0; i < count - 1; i++) {
    const hi = bandLogMetersDescending[i];
    const lo = bandLogMetersDescending[i + 1];
    if (logScaleMeters <= hi && logScaleMeters >= lo) {
      const gapDex = Math.max(0.01, hi - lo);
      if (gapDex <= 1.8) return 1.0;
      const frac = (hi - logScaleMeters) / gapDex;
      const bell = Math.sin(Math.PI * frac);
      const extra = Math.min(0.85, (gapDex - 1.8) * 0.24);
      return 1.0 + extra * bell;
    }
  }
  return 1.0;
}

/**
 * Smoothly dissolves the 10 µm cell nucleus sphere (r=2.2 at log -4.3) across
 * -4.85 .. -5.32 BEFORE the camera reaches its spherical shell at log ≈ -5.537,
 * preventing sudden backface-culling pops.
 */
export function evaluateCellNucleusOpacity(logScaleMeters: number): number {
  return smoothstepUnit(-5.32, -4.85, logScaleMeters);
}

/**
 * Evaluates opacity of the luminous Chromatin Fiber / Nucleosome transition sub-group
 * centered at -6.40, bridging Biological Cells (-4.3) and B-DNA (-8.47) with zero void.
 */
export function evaluateChromatinBridgeAlpha(
  logScaleMeters: number,
  gamma: number = 1.0
): number {
  const effLog = CHROMATIN_BRIDGE_LOG_METERS - (CHROMATIN_BRIDGE_LOG_METERS - logScaleMeters) * gamma;
  return smoothstepUnit(-4.85, -5.65, effLog) * smoothstepUnit(-8.05, -7.15, effLog);
}

/**
 * Unified Infinite Zoom visibility curves for Planet -> Atmosphere -> Land Masses ->
 * Ecosystems -> Forest Glade -> Leaf & Fur -> Biological Cells -> DNA Helix.
 * Guarantees zero visibility gaps and at most 2 overlapping terrain/cloud layers at once
 * in pure Infinite Zoom, while preserving Capytorio's full planet descent when
 * `suppressWoodlandSurfaceLayers` is true.
 * Returns -1 for outer cosmic / deep quantum bands handled by the general scale curve.
 */
export function evaluateInfiniteZoomBandAlpha(
  bandId: string,
  logScaleMeters: number,
  gamma: number = 1.0,
  suppressWoodlandSurfaceLayers: boolean = false,
  suppressGladeForSurfaceLanding: boolean = false
): number {
  if (bandId === 'planet') {
    const scaledDelta = (7.1 - logScaleMeters) * gamma;
    if (scaledDelta < 0) {
      return smoothstepUnit(-3.45, -2.05, scaledDelta);
    }
    if (suppressWoodlandSurfaceLayers) {
      return smoothstepUnit(2.1, 2.75, logScaleMeters);
    }
    const effLog = 7.1 - scaledDelta;
    return smoothstepUnit(3.85, 4.4, effLog);
  }

  if (bandId === 'atmosphere') {
    const effLog = 4.9 - (4.9 - logScaleMeters) * gamma;
    if (suppressWoodlandSurfaceLayers) {
      return smoothstepUnit(6.05, 5.15, effLog) * smoothstepUnit(3.55, 4.55, effLog);
    }
    return smoothstepUnit(5.5, 5.0, effLog) * smoothstepUnit(4.45, 4.8, effLog);
  }

  if (bandId === 'land_masses') {
    if (suppressWoodlandSurfaceLayers) return 0;
    const effLog = 3.6 - (3.6 - logScaleMeters) * gamma;
    let alpha = smoothstepUnit(4.4, 3.85, effLog) * smoothstepUnit(2.6, 3.1, effLog);
    if (suppressGladeForSurfaceLanding) {
      alpha *= smoothstepUnit(2.2, 3.4, logScaleMeters);
    }
    return alpha;
  }

  if (bandId === 'ecosystems') {
    if (suppressWoodlandSurfaceLayers) return 0;
    const effLog = 2.2 - (2.2 - logScaleMeters) * gamma;
    let alpha = smoothstepUnit(3.1, 2.6, effLog) * smoothstepUnit(1.1, 1.65, effLog);
    if (suppressGladeForSurfaceLanding) {
      alpha *= smoothstepUnit(2.2, 3.4, logScaleMeters);
    }
    return alpha;
  }

  if (bandId === 'capybara_forest') {
    if (suppressWoodlandSurfaceLayers) return 0;
    const effLog = 0.8 - (0.8 - logScaleMeters) * gamma;
    let alpha = smoothstepUnit(1.65, 1.1, effLog) * smoothstepUnit(-1.05, -0.25, effLog);
    if (suppressGladeForSurfaceLanding) {
      alpha *= smoothstepUnit(2.2, 3.4, logScaleMeters);
    }
    return alpha;
  }

  if (bandId === 'leaf_fur_micro') {
    if (suppressWoodlandSurfaceLayers) return 0;
    const effLog = -2.0 - (-2.0 - logScaleMeters) * gamma;
    let alpha = smoothstepUnit(0.75, -0.25, effLog) * smoothstepUnit(-3.85, -2.75, effLog);
    if (suppressGladeForSurfaceLanding) {
      alpha *= smoothstepUnit(-1.4, -2.0, logScaleMeters);
    }
    return alpha;
  }

  if (bandId === 'biological_cells') {
    const effLog = -4.3 - (-4.3 - logScaleMeters) * gamma;
    return smoothstepUnit(-2.85, -3.75, effLog) * smoothstepUnit(-6.1, -5.1, effLog);
  }

  if (bandId === 'dna_molecules') {
    const effLog = -8.47 - (-8.47 - logScaleMeters) * gamma;
    return smoothstepUnit(-6.85, -7.85, effLog) * smoothstepUnit(-9.92, -8.85, effLog);
  }

  return -1;
}
