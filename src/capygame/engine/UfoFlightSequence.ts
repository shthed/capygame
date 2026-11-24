/**
 * Pure, zero-allocation state machine & kinematics module for CapyGame's
 * seamless Orbit -> Atmosphere -> Ground Touchdown -> Pilot Disembark -> Parked UFO
 * -> Pilot Boarding -> Liftoff -> Orbit flight loop.
 *
 * Designed to be 100% deterministic and unit-testable without Three.js or DOM dependencies.
 */

export type UfoFlightPhase =
  | 'orbit_flight'
  | 'orbital_descent'
  | 'touchdown'
  | 'disembark'
  | 'parked_on_ground'
  | 'boarding'
  | 'liftoff';

export type UfoLandingSiteId = 'sanctuary' | 'capytorio';

export interface UfoLandingSiteSpec {
  id: UfoLandingSiteId;
  padX: number;
  padSurfaceY: number;
  padZ: number;
  padYaw: number;
  disembarkX: number;
  disembarkGroundY: number;
  disembarkZ: number;
}

export const UFO_TOUCHDOWN_DURATION_SEC = 1.35;
export const UFO_DISEMBARK_DURATION_SEC = 0.85;
export const UFO_BOARDING_DURATION_SEC = 0.72;
export const UFO_LIFTOFF_DURATION_SEC = 1.65;

export const UFO_APPROACH_ALTITUDE_OFFSET = 4.6;
export const UFO_LIFTOFF_HANDOFF_ALTITUDE = 24.0;
export const UFO_GROUNDED_FOOT_CLEARANCE = 0.26; // local Y of extended landing feet below vessel origin
export const UFO_COCKPIT_SEAT_OFFSET_Y = 0.42; // world Y offset from resting vessel origin to cockpit seat
export const UFO_BOARDING_PROXIMITY_RADIUS = 5.4;
export const UFO_CLICK_BOARD_MAX_RADIUS = 16.0;

export const UFO_ORBIT_TARGET_LOG_METERS = 7.1; // Planetary orbit framing the globe
export const UFO_ORBIT_DESCENT_ENTRY_MAX_LOG = 7.6; // Clamp deep cosmos smoothly to high orbit
export const UFO_ORBIT_DESCENT_START_LOG = 7.15;
export const UFO_FOREST_APPROACH_LOG_METERS = 0.8;
export const UFO_LIFTOFF_ORBIT_HANDOFF_LOG = 1.18;

export interface UfoFlightState {
  phase: UfoFlightPhase;
  phaseElapsedSec: number;
  site: UfoLandingSiteSpec;
  vesselScale: number;
  // Starting pose captured at phase handoff for zero-pop continuity
  startVesselX: number;
  startVesselY: number;
  startVesselZ: number;
  startVesselYaw: number;
  // Hero start pose captured when boarding from arbitrary ground position
  heroStartX: number;
  heroStartY: number;
  heroStartZ: number;
  heroStartYaw: number;
  // Target orbit log altitude when launching back to space
  launchTargetLogMeters: number;
  // One-shot milestone latch flags inside phases
  touchdownImpactEmitted: boolean;
  liftoffIgnitionEmitted: boolean;
}

export interface UfoFlightSample {
  phase: UfoFlightPhase;
  phaseProgress01: number;
  vesselVisible: boolean;
  pilotInVesselVisible: boolean;
  heroVisible: boolean;
  controlsLocked: boolean;
  groundedIdle: boolean;
  landingGear01: number;
  thrusterPower: number;
  // Vessel transform in world space
  vesselX: number;
  vesselY: number;
  vesselZ: number;
  vesselYaw: number;
  vesselPitch: number;
  vesselRoll: number;
  vesselScale: number;
  // Hero transform in world space (meaningful during disembark / boarding)
  heroX: number;
  heroY: number;
  heroZ: number;
  heroYaw: number;
  heroAirborne: boolean;
  heroSquashImpulse: number;
  // Camera guidance weight & focus point
  cameraFocusX: number;
  cameraFocusY: number;
  cameraFocusZ: number;
  // One-shot events triggered on this tick
  justTouchedDown: boolean;
  justStartedDisembark: boolean;
  justFinishedDisembark: boolean;
  justEnteredCockpit: boolean;
  justIgnitedLiftoff: boolean;
  justEnteredOrbitAscent: boolean;
}

function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * clamp01(t);
}

export function getUfoLandingSiteSpec(
  siteId: UfoLandingSiteId,
  sanctuaryPadX: number = 9.8,
  sanctuaryPadZ: number = 12.6,
  capytorioOriginX: number = 1200,
  capytorioOriginZ: number = 0
): UfoLandingSiteSpec {
  if (siteId === 'capytorio') {
    return {
      id: 'capytorio',
      padX: capytorioOriginX + 4.4,
      padSurfaceY: 0.0,
      padZ: capytorioOriginZ + 5.2,
      padYaw: -Math.PI * 0.22,
      disembarkX: capytorioOriginX + 0.5,
      disembarkGroundY: 0.0,
      disembarkZ: capytorioOriginZ + 3.2,
    };
  }
  return {
    id: 'sanctuary',
    padX: sanctuaryPadX,
    padSurfaceY: 0.22,
    padZ: sanctuaryPadZ,
    padYaw: Math.PI * 0.25,
    disembarkX: sanctuaryPadX - 3.3,
    disembarkGroundY: 0.0,
    disembarkZ: sanctuaryPadZ + 2.8,
  };
}

export function computeUfoRestingY(padSurfaceY: number, vesselScale: number): number {
  return padSurfaceY + UFO_GROUNDED_FOOT_CLEARANCE * vesselScale;
}

export function computeUfoApproachY(padSurfaceY: number, vesselScale: number): number {
  return computeUfoRestingY(padSurfaceY, vesselScale) + UFO_APPROACH_ALTITUDE_OFFSET;
}

export function computeUfoCockpitSeatY(padSurfaceY: number, vesselScale: number): number {
  return computeUfoRestingY(padSurfaceY, vesselScale) + UFO_COCKPIT_SEAT_OFFSET_Y;
}

/**
 * Smooth space-to-ground orbital descent log-scale speed profile (log-meters/sec).
 * Fast & exhilarating in high orbit, gliding cleanly through clouds, gently flaring into pad approach.
 */
export function computeOrbitalDescentLogSpeed(
  currentLogMeters: number,
  targetLogMeters: number = UFO_FOREST_APPROACH_LOG_METERS
): number {
  const dist = Math.abs(currentLogMeters - targetLogMeters);
  if (dist <= 0.005) return 0;
  // Three blended speed regimes: brisk orbital plunge -> cloud glide -> gentle pad flare
  const highOrbitWeight = smoothstep01(3.2, 5.8, currentLogMeters);
  const finalFlareWeight = 1 - smoothstep01(0.85, 2.05, currentLogMeters);
  const baseSpeed = 1.92 + highOrbitWeight * 0.96 - finalFlareWeight * 0.98;
  // Smooth asymptotic arrival so velocity never overshoots or snaps
  const arrivalCap = Math.max(0.52, dist * 1.85);
  return Math.min(baseSpeed, arrivalCap);
}

/**
 * Smooth liftoff-to-orbit climb velocity profile after handing off from ground liftoff into seamless zoom.
 */
export function computeOrbitalAscentLogSpeed(
  currentLogMeters: number,
  targetLogMeters: number = UFO_ORBIT_TARGET_LOG_METERS
): number {
  const dist = Math.abs(targetLogMeters - currentLogMeters);
  if (dist <= 0.005) return 0;
  const climbWeight = smoothstep01(1.15, 3.6, currentLogMeters);
  const baseSpeed = 1.55 + climbWeight * 1.15;
  const arrivalCap = Math.max(0.45, dist * 1.65);
  return Math.min(baseSpeed, arrivalCap);
}

/**
 * Computes starting log scale when initiating smooth orbital landing from arbitrary cosmic scale.
 * Never skips planetary orbit if already near/inside orbit (<= 7.6); only brings far deep-cosmos
 * views gently to high planetary orbit (7.15) so the player experiences the full orbital descent.
 */
export function resolveSmoothDescentStartLog(currentLogMeters: number): number {
  if (currentLogMeters > UFO_ORBIT_DESCENT_ENTRY_MAX_LOG) {
    return UFO_ORBIT_DESCENT_START_LOG;
  }
  if (currentLogMeters < -1.2) {
    return -0.35;
  }
  return currentLogMeters;
}

export function isNearParkedUfo(
  heroX: number,
  heroZ: number,
  padX: number,
  padZ: number,
  maxRadius: number = UFO_BOARDING_PROXIMITY_RADIUS
): boolean {
  const dx = heroX - padX;
  const dz = heroZ - padZ;
  return dx * dx + dz * dz <= maxRadius * maxRadius;
}

export function createUfoFlightState(
  initialPhase: UfoFlightPhase = 'orbit_flight',
  site: UfoLandingSiteSpec = getUfoLandingSiteSpec('sanctuary'),
  vesselScale: number = 3.85
): UfoFlightState {
  const restY = computeUfoRestingY(site.padSurfaceY, vesselScale);
  return {
    phase: initialPhase,
    phaseElapsedSec: 0,
    site,
    vesselScale,
    startVesselX: site.padX,
    startVesselY: restY,
    startVesselZ: site.padZ,
    startVesselYaw: site.padYaw,
    heroStartX: site.disembarkX,
    heroStartY: site.disembarkGroundY,
    heroStartZ: site.disembarkZ,
    heroStartYaw: site.padYaw,
    launchTargetLogMeters: UFO_ORBIT_TARGET_LOG_METERS,
    touchdownImpactEmitted: false,
    liftoffIgnitionEmitted: false,
  };
}

export function createUfoFlightSample(): UfoFlightSample {
  return {
    phase: 'orbit_flight',
    phaseProgress01: 0,
    vesselVisible: true,
    pilotInVesselVisible: true,
    heroVisible: false,
    controlsLocked: false,
    groundedIdle: false,
    landingGear01: 0,
    thrusterPower: 0.5,
    vesselX: 0,
    vesselY: 0,
    vesselZ: 0,
    vesselYaw: 0,
    vesselPitch: 0,
    vesselRoll: 0,
    vesselScale: 3.85,
    heroX: 0,
    heroY: 0,
    heroZ: 0,
    heroYaw: 0,
    heroAirborne: false,
    heroSquashImpulse: 0,
    cameraFocusX: 0,
    cameraFocusY: 0,
    cameraFocusZ: 0,
    justTouchedDown: false,
    justStartedDisembark: false,
    justFinishedDisembark: false,
    justEnteredCockpit: false,
    justIgnitedLiftoff: false,
    justEnteredOrbitAscent: false,
  };
}

export function beginOrbitalDescent(
  state: UfoFlightState,
  site: UfoLandingSiteSpec,
  vesselScale: number = 3.85
): void {
  state.phase = 'orbital_descent';
  state.phaseElapsedSec = 0;
  state.site = site;
  state.vesselScale = vesselScale;
  state.startVesselX = site.padX;
  state.startVesselY = computeUfoApproachY(site.padSurfaceY, vesselScale);
  state.startVesselZ = site.padZ;
  state.startVesselYaw = site.padYaw;
  state.touchdownImpactEmitted = false;
  state.liftoffIgnitionEmitted = false;
}

export function beginFinalTouchdown(
  state: UfoFlightState,
  site: UfoLandingSiteSpec,
  vesselX: number,
  vesselY: number,
  vesselZ: number,
  vesselYaw: number,
  vesselScale: number = 3.85
): void {
  const restY = computeUfoRestingY(site.padSurfaceY, vesselScale);
  state.phase = 'touchdown';
  state.phaseElapsedSec = 0;
  state.site = site;
  state.vesselScale = vesselScale;
  state.startVesselX = vesselX;
  state.startVesselY = Math.max(restY + 0.85, vesselY);
  state.startVesselZ = vesselZ;
  state.startVesselYaw = vesselYaw;
  state.touchdownImpactEmitted = false;
  state.liftoffIgnitionEmitted = false;
}

export function setParkedOnGroundImmediate(
  state: UfoFlightState,
  site: UfoLandingSiteSpec,
  vesselScale: number = 3.85
): void {
  state.phase = 'parked_on_ground';
  state.phaseElapsedSec = 0;
  state.site = site;
  state.vesselScale = vesselScale;
  state.startVesselX = site.padX;
  state.startVesselY = computeUfoRestingY(site.padSurfaceY, vesselScale);
  state.startVesselZ = site.padZ;
  state.startVesselYaw = site.padYaw;
  state.touchdownImpactEmitted = true;
  state.liftoffIgnitionEmitted = false;
}

export function beginBoardingSequence(
  state: UfoFlightState,
  heroX: number,
  heroY: number,
  heroZ: number,
  heroYaw: number,
  launchTargetLogMeters: number = UFO_ORBIT_TARGET_LOG_METERS
): boolean {
  if (state.phase !== 'parked_on_ground') {
    return false;
  }
  state.phase = 'boarding';
  state.phaseElapsedSec = 0;
  state.heroStartX = heroX;
  state.heroStartY = heroY;
  state.heroStartZ = heroZ;
  state.heroStartYaw = heroYaw;
  state.launchTargetLogMeters = launchTargetLogMeters;
  state.liftoffIgnitionEmitted = false;
  return true;
}

/**
 * Advances the ground-side cinematic sequences (`touchdown` -> `disembark` -> `parked_on_ground`,
 * and `boarding` -> `liftoff` -> `orbit_flight`) with zero heap allocations.
 */
export function stepUfoFlightSequence(
  state: UfoFlightState,
  dt: number,
  out: UfoFlightSample
): UfoFlightSample {
  const safeDt = dt > 0 && Number.isFinite(dt) ? Math.min(dt, 0.1) : 0;

  out.justTouchedDown = false;
  out.justStartedDisembark = false;
  out.justFinishedDisembark = false;
  out.justEnteredCockpit = false;
  out.justIgnitedLiftoff = false;
  out.justEnteredOrbitAscent = false;
  out.heroSquashImpulse = 0;

  const site = state.site;
  const restY = computeUfoRestingY(site.padSurfaceY, state.vesselScale);
  const cockpitY = computeUfoCockpitSeatY(site.padSurfaceY, state.vesselScale);

  if (state.phase === 'orbit_flight' || state.phase === 'orbital_descent') {
    state.phaseElapsedSec += safeDt;
    out.phase = state.phase;
    out.phaseProgress01 = 0;
    out.vesselVisible = true;
    out.pilotInVesselVisible = true;
    out.heroVisible = false;
    out.controlsLocked = state.phase === 'orbital_descent';
    out.groundedIdle = false;
    out.landingGear01 = 0;
    out.thrusterPower = 0.85;
    out.vesselX = site.padX;
    out.vesselY = computeUfoApproachY(site.padSurfaceY, state.vesselScale);
    out.vesselZ = site.padZ;
    out.vesselYaw = site.padYaw;
    out.vesselPitch = 0;
    out.vesselRoll = 0;
    out.vesselScale = state.vesselScale;
    out.heroX = site.disembarkX;
    out.heroY = site.disembarkGroundY;
    out.heroZ = site.disembarkZ;
    out.heroYaw = site.padYaw;
    out.heroAirborne = false;
    out.cameraFocusX = site.padX;
    out.cameraFocusY = site.padSurfaceY + 1.1;
    out.cameraFocusZ = site.padZ;
    return out;
  }

  if (state.phase === 'touchdown') {
    state.phaseElapsedSec += safeDt;
    const t = clamp01(state.phaseElapsedSec / UFO_TOUCHDOWN_DURATION_SEC);
    const horizEase = easeInOutCubic(Math.min(1, t / 0.72));
    // Smooth flare descent with gentle pneumatic settle onto struts
    const vertEase = easeOutCubic(Math.min(1, t / 0.88));
    const settleCompression =
      t > 0.88 ? Math.sin(((t - 0.88) / 0.12) * Math.PI) * -0.025 : 0;

    const vx = state.startVesselX + (site.padX - state.startVesselX) * horizEase;
    const vz = state.startVesselZ + (site.padZ - state.startVesselZ) * horizEase;
    const vy = Math.max(
      restY - 0.025,
      state.startVesselY + (restY - state.startVesselY) * vertEase + settleCompression
    );

    const gear01 = smoothstep01(0.14, 0.68, t);
    const retroThruster =
      t < 0.85
        ? 0.92 * (1 - smoothstep01(0.55, 0.88, t)) + 0.14
        : 0.14 * (1 - smoothstep01(0.85, 1.0, t)) + 0.04;

    // Gentle leveling flare pitch as saucer brakes to a stop
    const flarePitch = Math.sin(t * Math.PI) * 0.085 * (1 - smoothstep01(0.65, 0.92, t));
    const swayRoll = Math.sin(t * Math.PI * 2.0) * 0.035 * (1 - smoothstep01(0.55, 0.88, t));

    if (!state.touchdownImpactEmitted && t >= 0.88) {
      state.touchdownImpactEmitted = true;
      out.justTouchedDown = true;
    }

    out.phase = 'touchdown';
    out.phaseProgress01 = t;
    out.vesselVisible = true;
    out.pilotInVesselVisible = true;
    out.heroVisible = false;
    out.controlsLocked = true;
    out.groundedIdle = t >= 0.88;
    out.landingGear01 = gear01;
    out.thrusterPower = retroThruster;
    out.vesselX = vx;
    out.vesselY = vy;
    out.vesselZ = vz;
    out.vesselYaw = lerpAngle(state.startVesselYaw, site.padYaw, easeInOutCubic(t));
    out.vesselPitch = flarePitch;
    out.vesselRoll = swayRoll;
    out.vesselScale = state.vesselScale;
    out.heroX = site.padX;
    out.heroY = cockpitY;
    out.heroZ = site.padZ;
    out.heroYaw = Math.atan2(site.disembarkX - site.padX, site.disembarkZ - site.padZ);
    out.heroAirborne = false;
    out.cameraFocusX = vx;
    out.cameraFocusY = vy + 0.35;
    out.cameraFocusZ = vz;

    if (t >= 1) {
      state.phase = 'disembark';
      state.phaseElapsedSec = 0;
      out.justStartedDisembark = true;
      out.phase = 'disembark';
      out.phaseProgress01 = 0;
      out.pilotInVesselVisible = false;
      out.heroVisible = true;
      out.heroAirborne = true;
      out.heroSquashImpulse = 1.6;
    }
    return out;
  }

  if (state.phase === 'disembark') {
    state.phaseElapsedSec += safeDt;
    const t = clamp01(state.phaseElapsedSec / UFO_DISEMBARK_DURATION_SEC);
    const horizT = easeOutCubic(t);
    const hx = site.padX + (site.disembarkX - site.padX) * horizT;
    const hz = site.padZ + (site.disembarkZ - site.padZ) * horizT;
    const linearY = cockpitY + (site.disembarkGroundY - cockpitY) * t;
    const arcLift = Math.sin(t * Math.PI) * 1.85;
    const hy = Math.max(site.disembarkGroundY, linearY + arcLift);
    const jumpYaw = Math.atan2(site.disembarkX - site.padX, site.disembarkZ - site.padZ);

    out.phase = 'disembark';
    out.phaseProgress01 = t;
    out.vesselVisible = true;
    out.pilotInVesselVisible = false;
    out.heroVisible = true;
    out.controlsLocked = true;
    out.groundedIdle = true;
    out.landingGear01 = 1;
    out.thrusterPower = 0.04;
    out.vesselX = site.padX;
    out.vesselY = restY;
    out.vesselZ = site.padZ;
    out.vesselYaw = site.padYaw;
    out.vesselPitch = 0;
    out.vesselRoll = 0;
    out.vesselScale = state.vesselScale;
    out.heroX = hx;
    out.heroY = hy;
    out.heroZ = hz;
    out.heroYaw = jumpYaw;
    out.heroAirborne = t < 0.96;
    // Smoothly blend focus from UFO pad over to the jumping/landing hero
    const focusBlend = easeInOutCubic(t);
    out.cameraFocusX = site.padX + (hx - site.padX) * focusBlend;
    out.cameraFocusY = restY + 0.45 + (hy + 0.9 - (restY + 0.45)) * focusBlend;
    out.cameraFocusZ = site.padZ + (hz - site.padZ) * focusBlend;

    if (t >= 1) {
      state.phase = 'parked_on_ground';
      state.phaseElapsedSec = 0;
      out.phase = 'parked_on_ground';
      out.phaseProgress01 = 1;
      out.controlsLocked = false;
      out.heroX = site.disembarkX;
      out.heroY = site.disembarkGroundY;
      out.heroZ = site.disembarkZ;
      out.heroAirborne = false;
      out.heroSquashImpulse = -2.2;
      out.justFinishedDisembark = true;
    }
    return out;
  }

  if (state.phase === 'parked_on_ground') {
    state.phaseElapsedSec += safeDt;
    out.phase = 'parked_on_ground';
    out.phaseProgress01 = 1;
    out.vesselVisible = true;
    out.pilotInVesselVisible = false;
    out.heroVisible = true;
    out.controlsLocked = false;
    out.groundedIdle = true;
    out.landingGear01 = 1;
    out.thrusterPower = 0.04;
    out.vesselX = site.padX;
    out.vesselY = restY;
    out.vesselZ = site.padZ;
    out.vesselYaw = site.padYaw;
    out.vesselPitch = 0;
    out.vesselRoll = 0;
    out.vesselScale = state.vesselScale;
    out.heroX = site.disembarkX;
    out.heroY = site.disembarkGroundY;
    out.heroZ = site.disembarkZ;
    out.heroYaw = site.padYaw;
    out.heroAirborne = false;
    out.cameraFocusX = site.padX;
    out.cameraFocusY = restY + 0.5;
    out.cameraFocusZ = site.padZ;
    return out;
  }

  if (state.phase === 'boarding') {
    state.phaseElapsedSec += safeDt;
    const t = clamp01(state.phaseElapsedSec / UFO_BOARDING_DURATION_SEC);
    const horizT = easeInOutCubic(t);
    const hx = state.heroStartX + (site.padX - state.heroStartX) * horizT;
    const hz = state.heroStartZ + (site.padZ - state.heroStartZ) * horizT;
    const linearY = state.heroStartY + (cockpitY - state.heroStartY) * t;
    const arcLift = Math.sin(t * Math.PI) * 1.75;
    const hy = Math.max(state.heroStartY, linearY + arcLift);
    const boardYaw =
      Math.hypot(site.padX - state.heroStartX, site.padZ - state.heroStartZ) > 0.05
        ? Math.atan2(site.padX - state.heroStartX, site.padZ - state.heroStartZ)
        : state.heroStartYaw;

    // Pre-spool ventral anti-gravity hum as hero leaps in
    const preSpool = 0.06 + smoothstep01(0.45, 1.0, t) * 0.42;

    out.phase = 'boarding';
    out.phaseProgress01 = t;
    out.vesselVisible = true;
    out.pilotInVesselVisible = false;
    out.heroVisible = true;
    out.controlsLocked = true;
    out.groundedIdle = true;
    out.landingGear01 = 1;
    out.thrusterPower = preSpool;
    out.vesselX = site.padX;
    out.vesselY = restY;
    out.vesselZ = site.padZ;
    out.vesselYaw = site.padYaw;
    out.vesselPitch = 0;
    out.vesselRoll = 0;
    out.vesselScale = state.vesselScale;
    out.heroX = hx;
    out.heroY = hy;
    out.heroZ = hz;
    out.heroYaw = lerpAngle(state.heroStartYaw, boardYaw, Math.min(1, t * 2.5));
    out.heroAirborne = true;
    out.cameraFocusX = hx + (site.padX - hx) * smoothstep01(0.25, 1.0, t);
    out.cameraFocusY = hy + 0.6;
    out.cameraFocusZ = hz + (site.padZ - hz) * smoothstep01(0.25, 1.0, t);

    if (t >= 1) {
      state.phase = 'liftoff';
      state.phaseElapsedSec = 0;
      state.liftoffIgnitionEmitted = false;
      out.phase = 'liftoff';
      out.phaseProgress01 = 0;
      out.pilotInVesselVisible = true;
      out.heroVisible = false;
      out.heroAirborne = false;
      out.justEnteredCockpit = true;
    }
    return out;
  }

  // phase === 'liftoff'
  state.phaseElapsedSec += safeDt;
  const t = clamp01(state.phaseElapsedSec / UFO_LIFTOFF_DURATION_SEC);
  const hoverPhase = smoothstep01(0.0, 0.28, t);
  const climbT = clamp01((t - 0.24) / 0.76);
  const climbAccel = climbT * climbT * climbT * 0.65 + climbT * climbT * 0.35;

  const vy = restY + hoverPhase * 0.55 + climbAccel * UFO_LIFTOFF_HANDOFF_ALTITUDE;
  const gear01 = 1 - smoothstep01(0.22, 0.58, t);
  const thruster = 0.52 + smoothstep01(0.0, 0.32, t) * 1.32;
  const climbPitch = smoothstep01(0.24, 0.85, t) * 0.22;
  const gentleYawSpin = site.padYaw + climbAccel * 0.35;

  if (!state.liftoffIgnitionEmitted && t >= 0.08) {
    state.liftoffIgnitionEmitted = true;
    out.justIgnitedLiftoff = true;
  }

  out.phase = 'liftoff';
  out.phaseProgress01 = t;
  out.vesselVisible = true;
  out.pilotInVesselVisible = true;
  out.heroVisible = false;
  out.controlsLocked = true;
  out.groundedIdle = false;
  out.landingGear01 = gear01;
  out.thrusterPower = thruster;
  out.vesselX = site.padX;
  out.vesselY = vy;
  out.vesselZ = site.padZ;
  out.vesselYaw = gentleYawSpin;
  out.vesselPitch = climbPitch;
  out.vesselRoll = 0;
  out.vesselScale = state.vesselScale;
  out.heroX = site.padX;
  out.heroY = vy;
  out.heroZ = site.padZ;
  out.heroYaw = gentleYawSpin;
  out.heroAirborne = true;
  out.cameraFocusX = site.padX;
  out.cameraFocusY = vy + 0.5;
  out.cameraFocusZ = site.padZ;

  if (t >= 1) {
    state.phase = 'orbit_flight';
    state.phaseElapsedSec = 0;
    out.phase = 'orbit_flight';
    out.phaseProgress01 = 1;
    out.justEnteredOrbitAscent = true;
  }
  return out;
}
