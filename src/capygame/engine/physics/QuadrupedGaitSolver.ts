/**
 * Pure, zero-allocation quadruped locomotion, gait kinematics, linear sausage-body
 * sizing, back-led reverse spine PBD solver, and weather near-plane clearance helpers.
 *
 * Designed so PlayStyleManager.ts and node:test suites run the exact same math.
 */

export const SANE_HERO_LINK_DIST = 0.86;
export const SANE_SEGMENT_SPACING = 1.08;
export const SANE_CABOOSE_LINK_DIST = 0.82;
export const SANE_MAX_SPINE_BEND_RAD = 0.52;

export interface LinearDachshundSize {
  collectedBackFruits: number;
  bodySegments: number;
  lengthMeters: number;
}

/**
 * Strictly linear sausage-body growth:
 * - Always 1 orange on the head (`fruitsCarried >= 1`)
 * - Every additional collected fruit (`fruitsCarried - 1`) sits on the back and adds
 *   1 linear body segment up to `maxSegments`.
 */
export function computeLinearDachshundState(
  fruitsCarried: number,
  segmentSpacing: number = SANE_SEGMENT_SPACING,
  maxSegments: number = 48,
  heroLinkDist: number = SANE_HERO_LINK_DIST,
  cabooseLinkDist: number = SANE_CABOOSE_LINK_DIST
): LinearDachshundSize {
  const safeCarried = Math.max(1, Math.floor(Number.isFinite(fruitsCarried) ? fruitsCarried : 1));
  const collectedBackFruits = Math.max(0, safeCarried - 1);
  const bodySegments = Math.max(1, Math.min(maxSegments, 1 + collectedBackFruits));
  const lengthMeters = +(
    1.75 +
    heroLinkDist +
    cabooseLinkDist +
    Math.max(0, bodySegments - 1) * segmentSpacing
  ).toFixed(2);
  return {
    collectedBackFruits,
    bodySegments,
    lengthMeters,
  };
}

/**
 * Advances quadruped gait phase from true planar displacement (`dist / strideRadius`) when
 * grounded so feet never ice-skate against walls or stoppages, with a steady searching/paddling
 * cadence when swimming or hovering with 0-foot traction active.
 */
export function advanceDisplacementCoupledGaitPhase(
  currentPhase: number,
  planarDisplacement: number,
  dt: number,
  options: {
    hasWalkIntent: boolean;
    isAirborne: boolean;
    isSwimming: boolean;
    strideRadius?: number;
    fallbackRateRadPerSec?: number;
  }
): number {
  const strideRadius = options.strideRadius ?? 0.24;
  const fallbackRate = options.fallbackRateRadPerSec ?? 9.5;
  if (planarDisplacement > 0.0015) {
    // True arc-length stride lock (+ tiny cadence floor while accelerating)
    const arcPhase = planarDisplacement / Math.max(0.08, strideRadius);
    return currentPhase + Math.max(arcPhase, options.hasWalkIntent ? dt * 3.5 : 0);
  }
  if ((options.isAirborne || options.isSwimming) && options.hasWalkIntent) {
    return currentPhase + dt * fallbackRate;
  }
  return currentPhase;
}

export interface RealisticLimbPose {
  hipPitch: number;
  kneePitch: number;
  anklePitch: number;
  hipDropFactor: number;
  suspensionBounce: number;
  pelvicRoll: number;
}

/**
 * Computes realistic 2-joint quadruped leg kinematics into a reusable output struct
 * (zero per-frame heap allocations when `out` is supplied).
 *
 * Uses a ~58% planted stance / ~42% lifted swing duty cycle:
 * - Stance (`u` in stance half): flat plantar contact sweeping opposite `walkDir`, gentle knee brace,
 *   and subtle stance load compression.
 * - Swing (`u` in swing half): hip protraction, genuine carpal/hock knee flexion lifting the paw
 *   clearly upward, and ankle dorsiflexion before smooth heel strike.
 */
export function evaluateRealisticLimbPose(
  phase: number,
  walkDir: 1 | -1,
  hipAmp: number = 0.40,
  strideScale: number = 1.0,
  out?: RealisticLimbPose
): RealisticLimbPose {
  const res: RealisticLimbPose = out ?? {
    hipPitch: 0,
    kneePitch: 0,
    anklePitch: 0,
    hipDropFactor: 1,
    suspensionBounce: 0,
    pelvicRoll: 0,
  };

  const twoPi = Math.PI * 2;
  const wrapped = ((phase % twoPi) + twoPi) % twoPi;
  const swingEnd = twoPi * 0.42; // 42% swing, 58% stance

  const amp = hipAmp * Math.max(0.25, Math.min(1.35, strideScale));

  let hipPitch: number;
  let kneePitch: number;
  let anklePitch: number;
  let verticalLiftNorm = 0;

  if (wrapped < swingEnd) {
    // Swing phase: u from 0 (toe-off) -> 1 (heel-strike)
    const u = wrapped / swingEnd;
    const bell = Math.sin(u * Math.PI); // 0 -> 1 -> 0
    const sweep = Math.cos(u * Math.PI); // +1 -> -1
    hipPitch = walkDir * sweep * amp;
    // Knee flexes backward relative to swing progression to clear paw off ground
    kneePitch = -walkDir * bell * (0.76 * Math.min(1.2, strideScale));
    // Ankle clears toes mid-swing and levels cleanly before touch-down
    anklePitch = -(hipPitch * 0.65 + kneePitch * 0.52) + walkDir * bell * 0.14;
    verticalLiftNorm = bell;
  } else {
    // Stance phase: u from 0 (touch-down) -> 1 (push-off)
    const u = (wrapped - swingEnd) / (twoPi - swingEnd);
    const sweep = -Math.cos(u * Math.PI); // -1 -> +1
    hipPitch = walkDir * sweep * amp * 0.94;
    // Subtle weight-acceptance knee yield near mid-stance
    const loadYield = Math.sin(u * Math.PI);
    kneePitch = walkDir * loadYield * 0.11;
    // Flat foot plantar contact against ground plane
    anklePitch = -(hipPitch + kneePitch) * 0.96;
    verticalLiftNorm = 0;
  }

  const upperDrop = Math.cos(hipPitch);
  const lowerDrop = Math.cos(hipPitch + kneePitch);
  res.hipPitch = hipPitch;
  res.kneePitch = kneePitch;
  res.anklePitch = anklePitch;
  res.hipDropFactor = 0.49 * upperDrop + 0.51 * lowerDrop;
  // Double-frequency hip bob: lowest at mid-stance push, slight spring lift during double-support
  res.suspensionBounce = -0.022 * Math.sin(wrapped * 2.0) * Math.min(1, strideScale);
  res.pelvicRoll = 0.042 * Math.sin(wrapped) * Math.min(1, strideScale) + verticalLiftNorm * 0.008;
  return res;
}

export function normalizeSignedAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Solves a bidirectional inextensible articulated spine chain in-place.
 *
 * - Forward mode (`isWalkingBackward = false`):
 *   Node `0` (`heroCapy`) is the fixed/steered leader; links solve `0 -> N` so segments
 *   and caboose trail smoothly behind the head.
 * - Backward mode (`isWalkingBackward = true`):
 *   Node `N = totalNodes - 1` (`dachshundCaboose`) IS the active leader! Links solve in reverse
 *   from `N -> 0` so intermediate torso segments and the front chest/head naturally trail
 *   along behind the reversing tail leader without folding or jackknifing.
 */
export function solveBidirectionalSpinePass(
  spineX: Float32Array,
  spineZ: Float32Array,
  spineYaw: Float32Array,
  totalNodes: number,
  isWalkingBackward: boolean,
  segmentSpacing: number = SANE_SEGMENT_SPACING,
  heroLinkDist: number = SANE_HERO_LINK_DIST,
  cabooseLinkDist: number = SANE_CABOOSE_LINK_DIST,
  maxBendRad: number = SANE_MAX_SPINE_BEND_RAD,
  anchorLeader: boolean = true
): void {
  if (totalNodes < 2) return;

  const getLinkLength = (frontIdx: number): number => {
    if (frontIdx === 0) return heroLinkDist;
    if (frontIdx === totalNodes - 2) return cabooseLinkDist;
    return segmentSpacing;
  };

  if (!isWalkingBackward) {
    // Forward pass: Hero node 0 leads, nodes 1..totalNodes-1 follow
    for (let n = 1; n < totalNodes; n++) {
      const restLen = getLinkLength(n - 1);
      let dx = spineX[n - 1] - spineX[n];
      let dz = spineZ[n - 1] - spineZ[n];
      let dist = Math.hypot(dx, dz);
      if (dist < 0.0001) {
        dx = Math.sin(spineYaw[n - 1]);
        dz = Math.cos(spineYaw[n - 1]);
        dist = 1;
      }

      const targetLen = Math.max(restLen * 0.96, Math.min(restLen, dist));
      const nx = dx / dist;
      const nz = dz / dist;
      const err = dist - targetLen;

      if (anchorLeader && n === 1) {
        spineX[n] += nx * err;
        spineZ[n] += nz * err;
      } else {
        const frontShare = anchorLeader ? 0.14 : 0.35;
        const backShare = 1 - frontShare;
        spineX[n - 1] -= nx * err * frontShare;
        spineZ[n - 1] -= nz * err * frontShare;
        spineX[n] += nx * err * backShare;
        spineZ[n] += nz * err * backShare;
      }

      dx = spineX[n - 1] - spineX[n];
      dz = spineZ[n - 1] - spineZ[n];
      const linkYaw = Math.atan2(dx, dz);
      const refYaw = spineYaw[n - 1];
      const bendDiff = normalizeSignedAngle(linkYaw - refYaw);

      if (Math.abs(bendDiff) > maxBendRad) {
        const clampedYaw = refYaw + Math.sign(bendDiff) * maxBendRad;
        const desiredBackX = spineX[n - 1] - Math.sin(clampedYaw) * restLen;
        const desiredBackZ = spineZ[n - 1] - Math.cos(clampedYaw) * restLen;
        spineX[n] += (desiredBackX - spineX[n]) * 0.9;
        spineZ[n] += (desiredBackZ - spineZ[n]) * 0.9;
        spineYaw[n] = clampedYaw;
      } else {
        spineYaw[n] = linkYaw;
      }
    }
  } else {
    // True Reverse Back-Led Pass: Caboose (totalNodes - 1) leads, nodes totalNodes-2 .. 0 follow behind!
    const cabNode = totalNodes - 1;
    for (let b = cabNode; b >= 1; b--) {
      const f = b - 1; // frontward neighbor trailing behind the reversing caboose leader
      const restLen = getLinkLength(f);

      // Vector from back leader (b) toward trailing front node (f)
      let dx = spineX[f] - spineX[b];
      let dz = spineZ[f] - spineZ[b];
      let dist = Math.hypot(dx, dz);
      if (dist < 0.0001) {
        dx = Math.sin(spineYaw[b]);
        dz = Math.cos(spineYaw[b]);
        dist = 1;
      }

      const targetLen = Math.max(restLen * 0.96, Math.min(restLen, dist));
      const nx = dx / dist;
      const nz = dz / dist;
      const err = dist - targetLen;

      if (anchorLeader && b === cabNode) {
        spineX[f] -= nx * err;
        spineZ[f] -= nz * err;
      } else {
        const leaderShare = anchorLeader ? 0.16 : 0.35;
        const trailerShare = 1 - leaderShare;
        spineX[b] += nx * err * leaderShare;
        spineZ[b] += nz * err * leaderShare;
        spineX[f] -= nx * err * trailerShare;
        spineZ[f] -= nz * err * trailerShare;
      }

      dx = spineX[f] - spineX[b];
      dz = spineZ[f] - spineZ[b];
      // Yaw faces from back node b toward front node f so head/torso orientation remains anatomically forward!
      const linkYaw = Math.atan2(dx, dz);
      const refYaw = spineYaw[b];
      const bendDiff = normalizeSignedAngle(linkYaw - refYaw);

      if (Math.abs(bendDiff) > maxBendRad) {
        const clampedYaw = refYaw + Math.sign(bendDiff) * maxBendRad;
        const desiredFrontX = spineX[b] + Math.sin(clampedYaw) * restLen;
        const desiredFrontZ = spineZ[b] + Math.cos(clampedYaw) * restLen;
        spineX[f] += (desiredFrontX - spineX[f]) * 0.9;
        spineZ[f] += (desiredFrontZ - spineZ[f]) * 0.9;
        spineYaw[f] = clampedYaw;
      } else {
        spineYaw[f] = linkYaw;
      }
    }
  }
}

/**
 * Computes terrain pitch tilt (radians) along a node's forward heading.
 */
export function computeTerrainPitchAngle(
  frontGroundY: number,
  rearGroundY: number,
  spanDist: number = 0.85,
  maxPitchRad: number = 0.42
): number {
  const raw = -Math.atan2(frontGroundY - rearGroundY, Math.max(0.25, spanDist));
  if (raw > maxPitchRad) return maxPitchRad;
  if (raw < -maxPitchRad) return -maxPitchRad;
  return raw;
}

/**
 * Keeps precipitation particles (snow discs & rain streaks) outside a strict camera exclusion
 * sphere so no particle ever slices across `camera.near` as a screen-spanning gray bar.
 */
export function enforceWeatherParticleCameraClearance(
  px: number,
  py: number,
  pz: number,
  camX: number,
  camY: number,
  camZ: number,
  minClearDist: number = 3.0,
  out?: { x: number; y: number; z: number }
): { x: number; y: number; z: number } {
  const res = out ?? { x: px, y: py, z: pz };
  const dx = px - camX;
  const dy = py - camY;
  const dz = pz - camZ;
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq >= minClearDist * minClearDist) {
    res.x = px;
    res.y = py;
    res.z = pz;
    return res;
  }
  const hDist = Math.hypot(dx, dz);
  if (hDist < 0.001) {
    res.x = camX + minClearDist;
    res.y = py;
    res.z = camZ;
  } else {
    const scale = (minClearDist + 0.35) / hDist;
    res.x = camX + dx * scale;
    res.y = py;
    res.z = camZ + dz * scale;
  }
  return res;
}
