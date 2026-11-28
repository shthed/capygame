import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UFO_AIR_CRUISE_ALTITUDE_Y,
  UFO_AIR_LIFTOFF_DURATION_SEC,
  UFO_BOARDING_DURATION_SEC,
  UFO_BOARDING_PROXIMITY_RADIUS,
  UFO_DISEMBARK_DURATION_SEC,
  UFO_FOREST_APPROACH_LOG_METERS,
  UFO_LIFTOFF_DURATION_SEC,
  UFO_ORBIT_DESCENT_START_LOG,
  UFO_ORBIT_TARGET_LOG_METERS,
  UFO_TOUCHDOWN_DURATION_SEC,
  UFO_TOUCH_BOARDING_RADIUS,
  beginAirFlightBoarding,
  beginAirFlightTouchdown,
  beginBoardingSequence,
  beginFinalTouchdown,
  beginOrbitalDescent,
  computeAirFlightSpeedForAltitude,
  computeOrbitalAscentLogSpeed,
  computeOrbitalDescentLogSpeed,
  computeUfoApproachY,
  computeUfoCockpitSeatY,
  computeUfoRestingY,
  createUfoFlightSample,
  createUfoFlightState,
  getUfoLandingSiteSpec,
  isNearParkedUfo,
  resolveSmoothDescentStartLog,
  setParkedOnGroundImmediate,
  stepAirFlightKinematics,
  stepUfoFlightSequence,
} from './UfoFlightSequence.ts';
import {
  HERO_COLLISION_RADIUS,
  UFO_HULL_COLLISION_RADIUS,
  computeCapytorioMachineWorldAabb,
  createAabb2DScratch,
  createCirclePushScratch,
  isCapytorioMachineSolid,
  isTouchingParkedUfo,
  resolveCircleAabbPush,
  resolveCircleCirclePush,
} from './SurfaceCollisionMath.ts';

test('resolveSmoothDescentStartLog preserves planetary orbit altitude without snapping past planet', () => {
  // Already in planetary orbit (~7.1) or atmosphere (~3.4) -> ZERO warp/teleport!
  assert.equal(resolveSmoothDescentStartLog(7.1), 7.1);
  assert.equal(resolveSmoothDescentStartLog(4.8), 4.8);
  assert.equal(resolveSmoothDescentStartLog(2.4), 2.4);

  // Far deep cosmos (> 7.6) enters smoothly at high planetary orbit (7.15)
  assert.equal(resolveSmoothDescentStartLog(22.0), UFO_ORBIT_DESCENT_START_LOG);
  assert.equal(resolveSmoothDescentStartLog(30.0), UFO_ORBIT_DESCENT_START_LOG);

  // Sub-quantum climbs from near-surface micro scale
  assert.equal(resolveSmoothDescentStartLog(-15.0), -0.35);
});

test('orbital descent and ascent speed profiles decelerate smoothly with zero overshoot', () => {
  const highOrbitSpeed = computeOrbitalDescentLogSpeed(6.8, UFO_FOREST_APPROACH_LOG_METERS);
  const midCloudSpeed = computeOrbitalDescentLogSpeed(2.6, UFO_FOREST_APPROACH_LOG_METERS);
  const flareSpeed = computeOrbitalDescentLogSpeed(1.0, UFO_FOREST_APPROACH_LOG_METERS);
  assert.ok(highOrbitSpeed > midCloudSpeed, 'High orbit should descend faster than mid cloud glide');
  assert.ok(midCloudSpeed > flareSpeed, 'Final approach flare should slow smoothly before pad');
  assert.ok(flareSpeed > 0.3, 'Flare speed stays positive so vessel never stalls before pad');
  assert.equal(computeOrbitalDescentLogSpeed(UFO_FOREST_APPROACH_LOG_METERS, UFO_FOREST_APPROACH_LOG_METERS), 0);

  const lowAscent = computeOrbitalAscentLogSpeed(1.3, UFO_ORBIT_TARGET_LOG_METERS);
  const midAscent = computeOrbitalAscentLogSpeed(4.2, UFO_ORBIT_TARGET_LOG_METERS);
  assert.ok(midAscent > lowAscent, 'Liftoff accelerates smoothly through stratosphere');
  assert.equal(computeOrbitalAscentLogSpeed(UFO_ORBIT_TARGET_LOG_METERS, UFO_ORBIT_TARGET_LOG_METERS), 0);
});

test('full round-trip lifecycle: touchdown -> disembark -> parked -> boarding -> liftoff -> orbit', () => {
  const site = getUfoLandingSiteSpec('sanctuary');
  const scale = 3.85;
  const restY = computeUfoRestingY(site.padSurfaceY, scale);
  const approachY = computeUfoApproachY(site.padSurfaceY, scale);
  const cockpitY = computeUfoCockpitSeatY(site.padSurfaceY, scale);

  const state = createUfoFlightState('orbit_flight', site, scale);
  const sample = createUfoFlightSample();

  beginOrbitalDescent(state, site, scale);
  stepUfoFlightSequence(state, 0.016, sample);
  assert.equal(sample.phase, 'orbital_descent');
  assert.equal(sample.pilotInVesselVisible, true);
  assert.equal(sample.heroVisible, false, 'Ground hero must stay hidden while pilot is flying UFO');

  // Hand off into final touchdown from approach hover
  beginFinalTouchdown(state, site, site.padX + 0.4, approachY, site.padZ - 0.3, 0.1, scale);
  let sawTouchdownEvent = false;
  let sawStartDisembark = false;
  let minVesselY = Infinity;

  const dt = 0.02;
  const touchdownSteps = Math.ceil(UFO_TOUCHDOWN_DURATION_SEC / dt) + 2;
  for (let i = 0; i < touchdownSteps; i++) {
    stepUfoFlightSequence(state, dt, sample);
    assert.ok(Number.isFinite(sample.vesselY) && Number.isFinite(sample.heroY));
    minVesselY = Math.min(minVesselY, sample.vesselY);
    if (sample.justTouchedDown) sawTouchdownEvent = true;
    if (sample.justStartedDisembark) {
      sawStartDisembark = true;
      break;
    }
    // Never show both pilot inside UFO AND hero on ground at the same time!
    assert.notEqual(
      sample.pilotInVesselVisible && sample.heroVisible,
      true,
      'Pilot inside UFO and ground hero must never be simultaneously visible'
    );
  }

  assert.equal(sawTouchdownEvent, true, 'Touchdown impact event must fire before disembark');
  assert.equal(sawStartDisembark, true, 'Touchdown must automatically transition to disembark');
  assert.equal(state.phase, 'disembark');
  assert.ok(minVesselY >= restY - 0.03, 'UFO must not sink beneath landing pad surface');

  // Step through pilot jumping out of the UFO onto the ground
  let maxHeroJumpY = -Infinity;
  let sawFinishedDisembark = false;
  const disembarkSteps = Math.ceil(UFO_DISEMBARK_DURATION_SEC / dt) + 2;
  for (let i = 0; i < disembarkSteps; i++) {
    stepUfoFlightSequence(state, dt, sample);
    maxHeroJumpY = Math.max(maxHeroJumpY, sample.heroY);
    assert.equal(sample.pilotInVesselVisible, false, 'UFO cockpit must be empty while pilot hops out');
    assert.equal(sample.heroVisible, true, 'Hero capybara must be visible during jump out');
    assert.equal(sample.landingGear01, 1, 'Landing struts remain deployed while parked');
    if (sample.justFinishedDisembark) {
      sawFinishedDisembark = true;
      break;
    }
  }

  assert.equal(sawFinishedDisembark, true, 'Disembark must finish cleanly');
  assert.equal(state.phase, 'parked_on_ground');
  assert.equal(sample.controlsLocked, false, 'Player regains movement control once landed');
  assert.ok(maxHeroJumpY > cockpitY + 0.9, 'Pilot jump arc must clear saucer rim');
  assert.ok(Math.abs(sample.heroX - site.disembarkX) < 0.001);
  assert.ok(Math.abs(sample.heroZ - site.disembarkZ) < 0.001);
  assert.equal(sample.heroY, site.disembarkGroundY);

  // Verify UFO stays parked and empty on ground and detects boarding proximity
  stepUfoFlightSequence(state, 0.05, sample);
  assert.equal(sample.phase, 'parked_on_ground');
  assert.equal(sample.vesselVisible, true);
  assert.equal(sample.pilotInVesselVisible, false);
  assert.equal(sample.groundedIdle, true);
  assert.equal(sample.vesselY, restY);
  assert.equal(
    isNearParkedUfo(site.disembarkX, site.disembarkZ, site.padX, site.padZ, UFO_BOARDING_PROXIMITY_RADIUS),
    true,
    'Disembark spot should be within easy boarding proximity of parked UFO'
  );
  assert.equal(
    isNearParkedUfo(site.padX + 12, site.padZ + 12, site.padX, site.padZ, UFO_BOARDING_PROXIMITY_RADIUS),
    false
  );

  // Board parked UFO and launch back to orbit
  const startedBoarding = beginBoardingSequence(
    state,
    site.disembarkX,
    site.disembarkGroundY,
    site.disembarkZ,
    0.4,
    UFO_ORBIT_TARGET_LOG_METERS
  );
  assert.equal(startedBoarding, true);
  assert.equal(state.phase, 'boarding');

  let sawEnteredCockpit = false;
  let maxBoardJumpY = -Infinity;
  const boardingSteps = Math.ceil(UFO_BOARDING_DURATION_SEC / dt) + 2;
  for (let i = 0; i < boardingSteps; i++) {
    stepUfoFlightSequence(state, dt, sample);
    maxBoardJumpY = Math.max(maxBoardJumpY, sample.heroY);
    if (sample.justEnteredCockpit) {
      sawEnteredCockpit = true;
      break;
    }
    assert.equal(sample.pilotInVesselVisible, false);
    assert.equal(sample.heroVisible, true);
  }
  assert.equal(sawEnteredCockpit, true, 'Boarding jump must deliver pilot into cockpit');
  assert.ok(maxBoardJumpY > cockpitY + 0.85, 'Boarding jump must arc into open cockpit');
  assert.equal(state.phase, 'liftoff');
  assert.equal(sample.pilotInVesselVisible, true);
  assert.equal(sample.heroVisible, false);

  // Step through liftoff back into orbit ascent
  let sawIgnition = false;
  let sawOrbitHandoff = false;
  let prevY = restY;
  const liftoffSteps = Math.ceil(UFO_LIFTOFF_DURATION_SEC / dt) + 2;
  for (let i = 0; i < liftoffSteps; i++) {
    stepUfoFlightSequence(state, dt, sample);
    if (sample.justIgnitedLiftoff) sawIgnition = true;
    assert.ok(sample.vesselY >= prevY - 1e-6, 'Liftoff altitude must rise monotonically');
    prevY = sample.vesselY;
    assert.equal(sample.pilotInVesselVisible, true);
    assert.equal(sample.heroVisible, false);
    if (sample.justEnteredOrbitAscent) {
      sawOrbitHandoff = true;
      break;
    }
  }
  assert.equal(sawIgnition, true, 'Liftoff ignition milestone must fire');
  assert.equal(sawOrbitHandoff, true, 'Liftoff must hand off cleanly into orbit ascent');
  assert.equal(state.phase, 'orbit_flight');
  assert.ok(prevY > restY + 20, 'UFO climbs well above ground before seamless orbit handoff');
  assert.equal(sample.landingGear01, 0, 'Landing gear must retract during liftoff');
});

test('setParkedOnGroundImmediate puts UFO cleanly on ground and supports Capytorio site', () => {
  const capySite = getUfoLandingSiteSpec('capytorio');
  const state = createUfoFlightState('orbit_flight');
  const sample = createUfoFlightSample();

  setParkedOnGroundImmediate(state, capySite, 3.85);
  stepUfoFlightSequence(state, 0.016, sample);
  assert.equal(sample.phase, 'parked_on_ground');
  assert.equal(sample.vesselVisible, true);
  assert.equal(sample.pilotInVesselVisible, false);
  assert.equal(sample.landingGear01, 1);
  assert.equal(sample.vesselX, capySite.padX);
  assert.equal(sample.vesselZ, capySite.padZ);
  assert.equal(sample.vesselY, computeUfoRestingY(0.0, 3.85));
});

test('SurfaceCollisionMath blocks capybara clipping through parked UFO and solid buildings while keeping belts walkable', () => {
  const push = createCirclePushScratch();
  const padX = 1204.4;
  const padZ = 5.2;

  // Pushing directly into parked UFO center ejects capybara cleanly to rim separation (2.05 + 0.68 = 2.73 m)
  const hitCenter = resolveCircleCirclePush(
    padX + 0.4,
    padZ + 0.3,
    HERO_COLLISION_RADIUS,
    padX,
    padZ,
    UFO_HULL_COLLISION_RADIUS,
    push
  );
  assert.equal(hitCenter, true);
  assert.equal(push.hit, true);
  const sep = Math.hypot(push.x - padX, push.z - padZ);
  assert.ok(
    Math.abs(sep - (HERO_COLLISION_RADIUS + UFO_HULL_COLLISION_RADIUS)) < 1e-6,
    `Expected exact rim separation, got ${sep}`
  );

  // Touching-only boarding radius triggers strictly when touching the UFO rim, NOT at spawn/disembark (~4.4 m)
  assert.equal(isTouchingParkedUfo(push.x, push.z, padX, padZ), true);
  assert.equal(isTouchingParkedUfo(padX + 3.1, padZ, padX, padZ), true);
  assert.equal(isTouchingParkedUfo(1200.0, 3.0, padX, padZ), false, 'Capytorio spawn must not show Board UFO');
  assert.equal(
    isTouchingParkedUfo(padX + UFO_TOUCH_BOARDING_RADIUS + 0.25, padZ, padX, padZ),
    false
  );

  // Capytorio machine solidness: belts remain walkable, buildings are solid
  assert.equal(isCapytorioMachineSolid('belt'), false);
  assert.equal(isCapytorioMachineSolid('assembler'), true);
  assert.equal(isCapytorioMachineSolid('furnace'), true);
  assert.equal(isCapytorioMachineSolid('drill'), true);
  assert.equal(isCapytorioMachineSolid('chest'), true);

  // 3x3 Assembler at grid (2, 2) world AABB blocks both edge approach and deep interior clipping
  const aabb = createAabb2DScratch();
  computeCapytorioMachineWorldAabb(1200, 0, 2, 2, 3, 3, aabb);
  assert.ok(aabb.maxX - aabb.minX > 7.0 && aabb.maxZ - aabb.minZ > 7.0);

  // Approach from west side into west wall
  const edgeHit = resolveCircleAabbPush(
    aabb.minX - 0.2,
    (aabb.minZ + aabb.maxZ) * 0.5,
    HERO_COLLISION_RADIUS,
    aabb.minX,
    aabb.minZ,
    aabb.maxX,
    aabb.maxZ,
    push
  );
  assert.equal(edgeHit, true);
  assert.ok(push.x <= aabb.minX - HERO_COLLISION_RADIUS + 1e-6);

  // Deep interior escape pushes cleanly outside nearest wall
  const interiorHit = resolveCircleAabbPush(
    aabb.minX + 0.4,
    (aabb.minZ + aabb.maxZ) * 0.5,
    HERO_COLLISION_RADIUS,
    aabb.minX,
    aabb.minZ,
    aabb.maxX,
    aabb.maxZ,
    push
  );
  assert.equal(interiorHit, true);
  assert.ok(push.x <= aabb.minX - HERO_COLLISION_RADIUS + 1e-6);
});

test('local-air UFO fast-travel launches into air (never orbit), flies across map, and lands anywhere', () => {
  const startSite = getUfoLandingSiteSpec('capytorio');
  const state = createUfoFlightState('parked_on_ground', startSite, 3.85);
  const sample = createUfoFlightSample();

  const started = beginAirFlightBoarding(
    state,
    startSite.padX - 2.8,
    0,
    startSite.padZ,
    0,
    UFO_AIR_CRUISE_ALTITUDE_Y
  );
  assert.equal(started, true);
  assert.equal(state.phase, 'boarding');
  assert.equal(state.flightMode, 'local_air');

  const dt = 0.02;
  let enteredAirFlight = false;
  let enteredOrbit = false;
  const maxSteps = Math.ceil((UFO_BOARDING_DURATION_SEC + UFO_AIR_LIFTOFF_DURATION_SEC) / dt) + 8;
  for (let i = 0; i < maxSteps; i++) {
    stepUfoFlightSequence(state, dt, sample);
    if (sample.justEnteredOrbitAscent) enteredOrbit = true;
    if (sample.justEnteredAirFlight) {
      enteredAirFlight = true;
      break;
    }
  }
  assert.equal(enteredOrbit, false, 'Local-air UFO takeoff must NEVER transition to orbital space ascent');
  assert.equal(enteredAirFlight, true, 'Local-air UFO takeoff must enter air_flight');
  assert.equal(state.phase, 'air_flight');
  assert.equal(sample.controlsLocked, false);
  assert.equal(sample.pilotInVesselVisible, true);
  assert.equal(sample.heroVisible, false);

  // Speed scales smoothly with altitude and boost
  const lowSpeed = computeAirFlightSpeedForAltitude(35, false);
  const highSpeed = computeAirFlightSpeedForAltitude(320, false);
  const boostSpeed = computeAirFlightSpeedForAltitude(320, true);
  assert.ok(highSpeed > lowSpeed * 2, 'Zooming out must increase UFO fast-travel speed');
  assert.ok(boostSpeed > highSpeed * 1.5, 'Boost must accelerate UFO fast-travel speed');

  // Fly east-northeast across the map for 2 seconds
  for (let i = 0; i < 100; i++) {
    stepAirFlightKinematics(state, 1, -0.5, 90, dt, sample);
  }
  const travelDist = Math.hypot(
    state.airPosX - startSite.padX,
    state.airPosZ - startSite.padZ
  );
  assert.ok(travelDist > 120, `UFO should fast-travel > 120m in 2s, traveled ${travelDist.toFixed(1)}m`);

  // Land at the new arbitrary spot on the map
  const newPadX = state.airPosX;
  const newPadZ = state.airPosZ;
  const newDisembarkX = newPadX;
  const newDisembarkZ = newPadZ + 4.35;
  const landingStarted = beginAirFlightTouchdown(
    state,
    newPadX,
    0,
    newPadZ,
    newDisembarkX,
    0,
    newDisembarkZ
  );
  assert.equal(landingStarted, true);
  assert.equal(state.phase, 'touchdown');

  const landSteps = Math.ceil((UFO_TOUCHDOWN_DURATION_SEC + UFO_DISEMBARK_DURATION_SEC) / dt) + 8;
  for (let i = 0; i < landSteps; i++) {
    stepUfoFlightSequence(state, dt, sample);
    if (sample.justFinishedDisembark) break;
  }
  assert.equal(state.phase, 'parked_on_ground');
  assert.ok(Math.abs(state.site.padX - newPadX) < 0.001, 'UFO parked padX must persist at new landing site');
  assert.ok(Math.abs(state.site.padZ - newPadZ) < 0.001, 'UFO parked padZ must persist at new landing site');
  assert.ok(Math.abs(sample.heroX - newDisembarkX) < 0.001);
  assert.ok(Math.abs(sample.heroZ - newDisembarkZ) < 0.001);
});
