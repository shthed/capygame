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
  -8.0,
  -5.5,
  -3.2,
  -1.6,
  -0.65,
  0.0,
  0.65,
  1.6,
  3.2,
  5.5,
  8.0,
];

export const MAX_FLIGHT_SPEED_MAGNITUDE = 12.0;

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
      if (FLIGHT_SPEED_GEARS[i] > currentForward + 0.08) {
        const next = -FLIGHT_SPEED_GEARS[i];
        return next === 0 ? 0 : next;
      }
    }
    const maxGear = -FLIGHT_SPEED_GEARS[FLIGHT_SPEED_GEARS.length - 1];
    return maxGear === 0 ? 0 : maxGear;
  } else {
    // Slower -> find highest gear strictly less than currentForward - epsilon
    for (let i = FLIGHT_SPEED_GEARS.length - 1; i >= 0; i--) {
      if (FLIGHT_SPEED_GEARS[i] < currentForward - 0.08) {
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
  return Math.abs(clamped) < 0.08 ? 0 : Math.round(clamped * 100) / 100;
}

export function formatFlightSpeedReadout(cruiseVelLogPerSec: number): {
  mode: 'forward' | 'reverse' | 'hover';
  forwardSpeed: number;
  shortLabel: string;
  kidLabel: string;
} {
  const forwardSpeed = Math.abs(cruiseVelLogPerSec) < 0.08 ? 0 : -cruiseVelLogPerSec;
  if (forwardSpeed === 0) {
    return {
      mode: 'hover',
      forwardSpeed: 0,
      shortLabel: 'Hover',
      kidLabel: 'Stopped',
    };
  }
  const abs = Math.abs(forwardSpeed);
  const mag = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
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
