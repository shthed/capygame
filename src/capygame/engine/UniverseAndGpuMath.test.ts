import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { INITIAL_PLAYER_STATS, UNIVERSE_SCALE_BANDS } from '../types';
import { ProgressionService } from '../services/ProgressionService';
import { ShallowWaterFluidSolver } from './physics/ContiguousWorldTopology';
import {
  FLIGHT_SPEED_GEARS,
  clampForwardFlightSpeed,
  computeSpiralOrbitAngleRadians,
  formatFlightSpeedReadout,
  formatRealisticScaleMeters,
  mergeDiscoveredSpecimen,
  sanitizeDiscoveredSpecimens,
  stepFlightSpeedGear,
  stepMediaSpeedControl,
  stepSteadyLogScaleTowardTarget,
} from './UniverseScaleMath';
import {
  GPU_WATER_CELL_COUNT,
  GPU_WATER_GRID_SIZE,
  TOTAL_FRUSTUM_CLUSTERS,
  binLightsIntoFrustumClusters,
  computeClusterDepthSlice,
  computeVolumetricSunShaftProjection,
  evaluateBoundingSphereVisibility,
  extractFrustumPlanesInto,
  packIndirectDrawBuffer,
  type ClusteredLightEmitter,
  type FrustumPlane6,
  type IndirectDrawBatchSpec,
  type VolumetricShaftProjection,
} from './gpu/GpuCullingAndClusterMath';

test('Flight throttle gears & 3-button media controls (Fast Forward, Play/Pause, Rewind) run slow and steady', () => {
  let cruiseVel = 0; // Hover
  cruiseVel = stepFlightSpeedGear(cruiseVel, 1); // Faster -> Forward 0.08x (internal -0.08)
  assert.equal(cruiseVel, -0.08);
  assert.equal(formatFlightSpeedReadout(cruiseVel).mode, 'forward');

  cruiseVel = stepFlightSpeedGear(cruiseVel, 1); // Forward 0.16x
  assert.equal(cruiseVel, -0.16);

  // Decelerate step-by-step back down through 0.08 -> Hover (0) -> Reverse
  cruiseVel = stepFlightSpeedGear(cruiseVel, -1);
  assert.equal(cruiseVel, -0.08);
  cruiseVel = stepFlightSpeedGear(cruiseVel, -1);
  assert.equal(cruiseVel, 0);
  assert.equal(formatFlightSpeedReadout(cruiseVel).shortLabel, 'Hover');

  cruiseVel = stepFlightSpeedGear(cruiseVel, -1); // Back 0.08x (internal +0.08)
  assert.equal(cruiseVel, 0.08);
  assert.equal(formatFlightSpeedReadout(cruiseVel).mode, 'reverse');

  // 3-Button Media Transport (Play/Pause, Fast Forward, Rewind)
  let mediaVel = 0;
  mediaVel = stepMediaSpeedControl(mediaVel, 'play_pause', 0.16); // Play forward calmly
  assert.equal(mediaVel, -0.16);
  mediaVel = stepMediaSpeedControl(mediaVel, 'fast_forward'); // Faster forward
  assert.equal(mediaVel, -0.32);
  mediaVel = stepMediaSpeedControl(mediaVel, 'play_pause'); // Pause
  assert.equal(mediaVel, 0);
  mediaVel = stepMediaSpeedControl(mediaVel, 'play_pause', 0.32); // Resume forward speed
  assert.equal(mediaVel, -0.32);
  mediaVel = stepMediaSpeedControl(mediaVel, 'rewind'); // Immediate gentle rewind
  assert.equal(mediaVel, 0.16);
  mediaVel = stepMediaSpeedControl(mediaVel, 'rewind'); // Faster rewind
  assert.equal(mediaVel, 0.32);
  mediaVel = stepMediaSpeedControl(mediaVel, 'fast_forward'); // Back into forward flight
  assert.equal(mediaVel, -0.32);

  assert.equal(clampForwardFlightSpeed(0.01), 0);
  assert.equal(clampForwardFlightSpeed(99), 2.0);
  assert.equal(clampForwardFlightSpeed(-99), -2.0);
  assert.equal(FLIGHT_SPEED_GEARS.includes(0), true);
});

test('Target scale flight advances steadily through intervening space without jumping', () => {
  let current = 30.0;
  const target = 20.0;
  const steps: number[] = [];
  for (let i = 0; i < 10; i++) {
    current = stepSteadyLogScaleTowardTarget(current, target, 0.5);
    steps.push(current);
  }
  // Over 5.0 seconds at <= 0.90 log/s, it must progress steadily (~4.5 units) rather than jumping straight to 20.0
  assert.ok(current > 24.5 && current < 26.5, `Expected smooth intermediate progression after 5s, got ${current}`);
  // Step deltas far from target must be uniform (steady cruise rate)
  const delta0 = Math.abs(steps[1] - steps[0]);
  const delta1 = Math.abs(steps[2] - steps[1]);
  assert.ok(Math.abs(delta0 - delta1) < 1e-6 && delta0 <= 0.4501);
  // Eventually settles cleanly on exact target
  for (let i = 0; i < 30; i++) {
    current = stepSteadyLogScaleTowardTarget(current, target, 0.5);
  }
  assert.equal(current, target);
});

test('Spiral flight curve is the default trajectory (migrating legacy saves) and sweeps 360° (2π rad) per band', () => {
  assert.equal(ProgressionService.sanitizeGameSettings(null).flightTrajectory, 'spiral');
  // Legacy localStorage settings saved before spiral became default must migrate to spiral
  assert.equal(
    ProgressionService.sanitizeGameSettings({ flightTrajectory: 'straight' }).flightTrajectory,
    'spiral'
  );
  // Explicit user toggle to straight persists cleanly
  assert.equal(
    ProgressionService.sanitizeGameSettings({
      flightTrajectory: 'straight',
      flightTrajectoryUserSelected: true,
    }).flightTrajectory,
    'straight'
  );

  const bandLogs = UNIVERSE_SCALE_BANDS.map((b) => b.logMeters);
  for (let i = 0; i < bandLogs.length - 1; i++) {
    const startAngle = computeSpiralOrbitAngleRadians(bandLogs[i], bandLogs);
    const midAngle = computeSpiralOrbitAngleRadians((bandLogs[i] + bandLogs[i + 1]) * 0.5, bandLogs);
    const endAngle = computeSpiralOrbitAngleRadians(bandLogs[i + 1], bandLogs);
    assert.ok(
      Math.abs((midAngle - startAngle) - Math.PI) < 1e-6,
      `Expected halfway through band ${i} -> ${i + 1} to rotate 180°, got ${midAngle - startAngle}`
    );
    assert.ok(
      Math.abs((endAngle - startAngle) - Math.PI * 2) < 1e-6,
      `Expected full band ${i} -> ${i + 1} to rotate 360° (2π), got ${endAngle - startAngle}`
    );
  }
});

test('Realistic zoom scale formatting produces physically consistent units across all 27 bands', () => {
  assert.equal(formatRealisticScaleMeters(30.0), '1.0×10^30 m');
  assert.equal(formatRealisticScaleMeters(28.0), '1.0×10^28 m');
  assert.equal(formatRealisticScaleMeters(26.94), '92.1 Gly');
  assert.equal(formatRealisticScaleMeters(24.0), '106 Mly');
  assert.equal(formatRealisticScaleMeters(21.0), '105,700 ly');
  assert.equal(formatRealisticScaleMeters(19.4), '2,655 ly');
  assert.equal(formatRealisticScaleMeters(12.95), '59.6 AU');
  assert.equal(formatRealisticScaleMeters(7.1), '12,589 km');
  assert.equal(formatRealisticScaleMeters(-9.47), '3.39 Å');
  assert.equal(formatRealisticScaleMeters(-35.0), '0.62 l_P');

  for (const band of UNIVERSE_SCALE_BANDS) {
    const label = formatRealisticScaleMeters(band.logMeters);
    assert.ok(label.length > 0 && !label.includes('NaN') && !label.includes('Infinity'));
  }
});

test('Forest Micro-Glade Sticker Book sanitization & discovery persist uniquely for all 11 specimens', () => {
  const sanitized = sanitizeDiscoveredSpecimens([
    'fur',
    'invalid_item',
    'leaf',
    'fur',
    123,
    'amoeba',
  ]);
  assert.deepEqual(sanitized, ['fur', 'leaf', 'amoeba']);

  const added = mergeDiscoveredSpecimen(sanitized, 'butterfly');
  assert.equal(added.isNew, true);
  assert.deepEqual(added.list, ['fur', 'leaf', 'amoeba', 'butterfly']);

  const duplicate = mergeDiscoveredSpecimen(added.list, 'leaf');
  assert.equal(duplicate.isNew, false);
  assert.equal(duplicate.list.length, 4);

  const disc1 = ProgressionService.discoverForestSpecimen(INITIAL_PLAYER_STATS, 'mushroom');
  assert.equal(disc1.isNew, true);
  assert.deepEqual(disc1.stats.discoveredForestSpecimens, ['mushroom']);

  const discDup = ProgressionService.discoverForestSpecimen(disc1.stats, 'mushroom');
  assert.equal(discDup.isNew, false);
  assert.deepEqual(discDup.stats.discoveredForestSpecimens, ['mushroom']);
});

test('GPU Indirect Culling, 16x9x24 Clustered Forward+ binning & 128x128 Wake params stay zero-error', () => {
  assert.equal(GPU_WATER_GRID_SIZE, 128);
  assert.equal(GPU_WATER_CELL_COUNT, 16384);
  assert.equal(TOTAL_FRUSTUM_CLUSTERS, 16 * 9 * 24);

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 500);
  camera.position.set(0, 5, 25);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  const pvMatrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );

  const planes: FrustumPlane6[] = Array.from({ length: 6 }, () => ({
    nx: 0,
    ny: 0,
    nz: 0,
    d: 0,
  }));
  extractFrustumPlanesInto(pvMatrix.elements, planes);

  assert.equal(
    evaluateBoundingSphereVisibility(0, 0, 0, 2.0, 0, 5, 25, 500, planes),
    true
  );
  assert.equal(
    evaluateBoundingSphereVisibility(0, 0, 100, 1.0, 0, 5, 25, 500, planes),
    false
  );

  const batches: IndirectDrawBatchSpec[] = [
    { indexCount: 36, instanceCount: 4, firstIndex: 0, baseVertex: 0, firstInstance: 0 },
    { indexCount: 48, instanceCount: 2, firstIndex: 36, baseVertex: 12, firstInstance: 4 },
  ];
  const indirect = new Uint32Array(10);
  const visibility = new Uint8Array([1, 0]);
  const visibleCount = packIndirectDrawBuffer(batches, visibility, indirect);
  assert.equal(visibleCount, 1);
  assert.equal(indirect[1], 4);
  assert.equal(indirect[6], 0);

  assert.equal(computeClusterDepthSlice(0.5, 0.5, 500), 0);
  assert.equal(computeClusterDepthSlice(499.9, 0.5, 500), 23);

  const emitters: ClusteredLightEmitter[] = [
    { wx: 0, wy: 1, wz: 0, radius: 12, r: 1, g: 0.75, b: 0.25, intensity: 2.0 },
    { wx: 0, wy: 2, wz: 150, radius: 4, r: 0.2, g: 0.7, b: 1, intensity: 1.5 }, // behind camera (+z)
  ];
  const counts = new Uint32Array(TOTAL_FRUSTUM_CLUSTERS);
  const assignments = binLightsIntoFrustumClusters(
    emitters,
    camera.matrixWorldInverse.elements,
    60,
    16 / 9,
    0.5,
    500,
    counts
  );
  assert.ok(assignments > 0);

  const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const shaftOut: VolumetricShaftProjection = { uvX: 0.5, uvY: 0.5, strength: 0, facingSun: 0 };
  computeVolumetricSunShaftProjection(
    0,
    0.35,
    -1.0,
    pvMatrix.elements,
    camForward.x,
    camForward.y,
    camForward.z,
    0,
    0.1,
    shaftOut
  );
  assert.ok(shaftOut.uvX > 0.3 && shaftOut.uvX < 0.7);
  assert.ok(shaftOut.strength > 0);

  const solver = new ShallowWaterFluidSolver();
  const wakeOut = new Float32Array(4);
  const active = solver.writeGpuWakeParams(-8.8, 3.0, 4.5, wakeOut);
  assert.equal(active, true);
  assert.ok(wakeOut[0] > 0.1 && wakeOut[0] < 0.9);
  assert.ok(wakeOut[2] > 0.01 && wakeOut[2] <= 0.16);
  assert.equal(wakeOut[3], 1.0);
});
