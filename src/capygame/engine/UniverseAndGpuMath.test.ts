import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { INITIAL_PLAYER_STATS, UNIVERSE_SCALE_BANDS } from '../types';
import { ProgressionService } from '../services/ProgressionService';
import { ShallowWaterFluidSolver } from './physics/ContiguousWorldTopology';
import {
  CAPYTORIO_OBLIQUE_BASE_RADIUS_M,
  CAPYTORIO_ORBIT_HANDOFF_DIST,
  CAPYTORIO_ORBIT_HANDOFF_LOG_METERS,
  CAPYTORIO_ZOOM_MIN_DIST,
  FLIGHT_SPEED_GEARS,
  SURFACE_ZOOM_ORBIT_THRESHOLD,
  clampForwardFlightSpeed,
  computeCapytorioZoomStep,
  computeOrbitalZoomThrottleStep,
  computeSpiralOrbitAngleRadians,
  computeSurfaceZoomStep,
  formatFlightSpeedReadout,
  formatRealisticScaleMeters,
  mergeDiscoveredSpecimen,
  sanitizeDiscoveredSpecimens,
  stepFlightSpeedGear,
  stepMediaSpeedControl,
  stepSteadyLogScaleTowardTarget,
} from './UniverseScaleMath';
import {
  applyBountyEvent,
  computeContinuousDescentCamRadius,
  computeDescentApproachDampingFactor,
  computeOrbitalSurfaceBlend,
  createEmptyComboState,
  registerComboHit,
  sanitizeBountyState,
  tickComboDecay,
} from './GameplayFunMath';
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
import { HardwareGpuEngine } from './gpu/HardwareGpuEngine';
import { computeEffectivePixelRatio } from './gpu/FramePerformanceGovernor';
import { PbrTextureSynthesizer } from './gpu/PbrTextureSynthesizer';
import { disposeObject3DTree } from './gpu/ThreeDisposal';
import { installSightlineEdgeFadeShader } from './RealisticWorldEnvironment';
import { createLiveTelemetryStore } from '../components/TelemetryReadout';

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

test('Smooth orbital descent curves damp spiral spin cleanly and crossfade lighting & camera without snaps', () => {
  assert.equal(computeDescentApproachDampingFactor(6.0), 1.0);
  assert.equal(computeDescentApproachDampingFactor(2.0), 0.0);
  const midDamp = computeDescentApproachDampingFactor(3.65);
  assert.ok(midDamp > 0.1 && midDamp < 0.9, `Expected smooth mid-approach damping, got ${midDamp}`);

  const highOrbit = computeOrbitalSurfaceBlend(5.0, false);
  assert.equal(highOrbit.inSurfaceWindow, false);
  assert.equal(highOrbit.terrestrialBlend, 0);
  assert.equal(highOrbit.archipelagoVisible, false);

  const upperAtmos = computeOrbitalSurfaceBlend(3.2, false);
  assert.equal(upperAtmos.inSurfaceWindow, true);
  assert.equal(upperAtmos.archipelagoVisible, true);
  assert.ok(upperAtmos.terrestrialBlend > 0.05 && upperAtmos.terrestrialBlend < 0.55);

  const canopy = computeOrbitalSurfaceBlend(0.8, false);
  assert.equal(canopy.inSurfaceWindow, true);
  assert.equal(canopy.terrestrialBlend, 1.0);

  const chaseDist = 11.4;
  assert.equal(computeContinuousDescentCamRadius(4.0, chaseDist), 38.0);
  assert.equal(computeContinuousDescentCamRadius(0.8, chaseDist), chaseDist);
  const midCam = computeContinuousDescentCamRadius(1.85, chaseDist);
  assert.ok(midCam > chaseDist && midCam < 38.0);
});

test('Arcade Combo Multiplier, Yuzu Fever state & Rotating 3-Slot Bounties persist and migrate cleanly', () => {
  const combo = createEmptyComboState();
  let hit = registerComboHit(combo, 'Yuzu Chomp!');
  assert.equal(hit.count, 1);
  assert.equal(hit.multiplier, 1);
  assert.equal(hit.feverJustTriggered, false);

  registerComboHit(combo, 'Dash');
  registerComboHit(combo, 'Bounce');
  hit = registerComboHit(combo, 'Splash!');
  assert.equal(hit.count, 4);
  assert.equal(hit.multiplier, 3);
  assert.equal(hit.feverJustTriggered, true);
  assert.equal(combo.feverActive, true);

  tickComboDecay(combo, 5.0);
  assert.equal(combo.active, false);
  assert.equal(combo.count, 0);
  assert.equal(combo.feverActive, false);

  // Legacy save backfill adds 3 valid default bounties
  const legacyCleaned = sanitizeBountyState(undefined);
  assert.equal(legacyCleaned.length, 3);
  assert.equal(legacyCleaned[0].id, 'descent_rings');

  // Completing a bounty slot awards rewards and rotates to a fresh objective
  const prog1 = ProgressionService.recordBountyProgress(INITIAL_PLAYER_STATS, 'collect_yuzu', 5);
  assert.equal(prog1.completed.length, 1);
  assert.ok(prog1.stats.coins > INITIAL_PLAYER_STATS.coins);
  assert.ok(prog1.stats.dna > INITIAL_PLAYER_STATS.dna);
  assert.equal(prog1.stats.bounties?.length, 3);
  assert.ok(!prog1.stats.bounties?.some((b) => b.id === 'collect_yuzu'));

  const applied = applyBountyEvent(prog1.stats.bounties, 'ground_pound_splash', 1);
  assert.equal(applied.changed, true);
  const gpSlot = applied.nextItems.find((b) => b.id === 'ground_pound_splash');
  assert.equal(gpSlot?.progress, 1);
});

test('Surface zoom pulls back smoothly and launches straight into Orbit & Deep Cosmos with no max ceiling', () => {
  // Small in/out tweak stays on surface (e.g. Capytorio zoom + then -)
  const zoomIn = computeSurfaceZoomStep(1.0, 0.24, true);
  assert.equal(zoomIn.launchToOrbit, false);
  assert.ok(zoomIn.nextDistance < 1.0);
  const zoomBack = computeSurfaceZoomStep(zoomIn.nextDistance, -0.24, true);
  assert.equal(zoomBack.launchToOrbit, false);
  assert.ok(zoomBack.nextDistance < SURFACE_ZOOM_ORBIT_THRESHOLD);

  // Repeated zoom-out taps reach and cross threshold into Orbit
  let dist = 1.0;
  let launched = false;
  for (let i = 0; i < 6; i++) {
    const step = computeSurfaceZoomStep(dist, -0.28, true);
    dist = step.nextDistance;
    if (step.launchToOrbit) {
      launched = true;
      assert.ok(step.launchTargetLogMeters > 0.8);
      break;
    }
  }
  assert.equal(launched, true);

  // Strong zoom-out gesture launches immediately
  const quickLaunch = computeSurfaceZoomStep(1.0, -0.35, true);
  assert.equal(quickLaunch.launchToOrbit, true);

  // Orbital zoom steps accelerate cleanly outward up to 2.5 log/s and reverse smoothly inward
  let vel = computeOrbitalZoomThrottleStep(0, -0.28, true);
  assert.ok(vel >= 0.55);
  for (let i = 0; i < 6; i++) {
    vel = computeOrbitalZoomThrottleStep(vel, -0.28, false);
  }
  assert.equal(vel, 2.5);

  // Zooming in brakes outward velocity and smoothly flips negative (inward descent)
  for (let i = 0; i < 8; i++) {
    vel = computeOrbitalZoomThrottleStep(vel, 0.28, false);
  }
  assert.ok(vel < 0, `Expected negative inward velocity after zooming in, got ${vel}`);
});

test('Capytorio top-down zoom climbs past low surface cutoff to planetary sub-pixel handoff before spaceship launch', () => {
  // Single strong zoom-out gesture in Capytorio stays in top-down view beyond Sanctuary cutoff (2.2x)
  const firstOut = computeCapytorioZoomStep(1.0, -0.5);
  assert.equal(firstOut.launchToOrbit, false);
  assert.ok(firstOut.nextDistance > SURFACE_ZOOM_ORBIT_THRESHOLD === false || firstOut.nextDistance > 1.5);

  const kmScale = computeCapytorioZoomStep(120, -0.35);
  assert.equal(kmScale.launchToOrbit, false);
  assert.ok(kmScale.nextDistance > 120 && kmScale.nextDistance < CAPYTORIO_ORBIT_HANDOFF_DIST);

  // Repeated zoom-out climbs smoothly past 100 km until reaching orbital handoff (~234 km)
  let capyDist = 1.0;
  let capyLaunched = false;
  let handoffLog = 0;
  for (let i = 0; i < 40; i++) {
    const step = computeCapytorioZoomStep(capyDist, -0.3);
    capyDist = step.nextDistance;
    if (step.launchToOrbit) {
      capyLaunched = true;
      handoffLog = step.launchTargetLogMeters;
      break;
    }
  }
  assert.equal(capyLaunched, true);
  assert.equal(capyDist, CAPYTORIO_ORBIT_HANDOFF_DIST);
  assert.ok(handoffLog >= CAPYTORIO_ORBIT_HANDOFF_LOG_METERS);
  assert.ok(CAPYTORIO_OBLIQUE_BASE_RADIUS_M * CAPYTORIO_ORBIT_HANDOFF_DIST >= 200_000);

  // Zooming in clamps cleanly at minimum close-up distance
  let closeDist = 1.0;
  for (let i = 0; i < 12; i++) {
    closeDist = computeCapytorioZoomStep(closeDist, 0.35).nextDistance;
  }
  assert.equal(closeDist, CAPYTORIO_ZOOM_MIN_DIST);
});

test('HardwareGpuEngine composerFaulted circuit-breaker falls back cleanly and resets only on preset change or context restore', () => {
  const listeners = new Map<string, Set<(e: Event) => void>>();
  let directRenderCount = 0;
  let pixelRatio = 1;
  const mockRenderer = {
    domElement: {
      addEventListener: (ev: string, fn: (e: Event) => void) => {
        if (!listeners.has(ev)) listeners.set(ev, new Set());
        listeners.get(ev)!.add(fn);
      },
      removeEventListener: (ev: string, fn: (e: Event) => void) => {
        listeners.get(ev)?.delete(fn);
      },
    },
    capabilities: { isWebGL2: true, maxTextureSize: 4096, getMaxAnisotropy: () => 8 },
    getContext: () => ({
      RENDERER: 0x1f01,
      getExtension: () => null,
      getParameter: () => 'Mock Software GL',
    }),
    getPixelRatio: () => pixelRatio,
    setPixelRatio: (pr: number) => {
      pixelRatio = pr;
    },
    setSize: () => {},
    setRenderTarget: () => {},
    render: () => {
      directRenderCount++;
    },
    shadowMap: { enabled: false, autoUpdate: false, type: THREE.PCFSoftShadowMap, needsUpdate: false },
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    info: { render: { calls: 0, triangles: 0 }, memory: { textures: 0, geometries: 0 } },
  } as unknown as THREE.WebGLRenderer;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const sunLight = new THREE.DirectionalLight(0xffffff, 1);

  const engine = new HardwareGpuEngine(
    mockRenderer,
    scene,
    camera,
    sunLight,
    true, // isSoftwareGl=true keeps PMREM pure CPU DataTexture with no real GL context
    1280,
    720,
    { postProcessingEnabled: true, visualFilterPreset: 'cinema_filmic' }
  );

  // Inject a failing mock composer & passes to exercise the circuit-breaker deterministically
  let composerRenderAttempts = 0;
  let bloomDisposed = 0;
  let masterDisposed = 0;
  let outputDisposed = 0;
  let fxaaDisposed = 0;
  const enginePriv = engine as unknown as Record<string, unknown>;
  enginePriv.composer = {
    render: () => {
      composerRenderAttempts++;
      throw new Error('Simulated mobile FBO incomplete error');
    },
    dispose: () => {},
    setPixelRatio: () => {},
    setSize: () => {},
  };
  enginePriv.bloomPass = { dispose: () => { bloomDisposed++; }, enabled: true, strength: 0.24, resolution: new THREE.Vector2(640, 360) };
  enginePriv.masterFilterPass = { dispose: () => { masterDisposed++; }, uniforms: {} };
  enginePriv.outputPass = { dispose: () => { outputDisposed++; } };
  enginePriv.fxaaPass = { dispose: () => { fxaaDisposed++; }, enabled: true, material: { uniforms: { resolution: { value: new THREE.Vector2() } } } };

  let rebuildCalls = 0;
  let healthyComposerRenders = 0;
  enginePriv.rebuildComposer = () => {
    rebuildCalls++;
    enginePriv.composer = {
      render: () => {
        healthyComposerRenders++;
      },
      dispose: () => {},
      setPixelRatio: () => {},
      setSize: () => {},
    };
  };

  assert.equal(engine.isComposerFaulted(), false);

  // Frame 1: composer throws -> circuit-breaker trips, passes disposed, falls back to direct render
  engine.render();
  assert.equal(composerRenderAttempts, 1);
  assert.equal(engine.isComposerFaulted(), true);
  assert.equal(directRenderCount, 1);
  assert.equal(bloomDisposed, 1);
  assert.equal(masterDisposed, 1);
  assert.equal(outputDisposed, 1);
  assert.equal(fxaaDisposed, 1);

  // Frames 2..5: stays in clean direct-render fallback with ZERO composer rebuild attempts
  const rebuildsAfterFault = rebuildCalls;
  engine.render();
  engine.render();
  engine.render();
  assert.equal(composerRenderAttempts, 1);
  assert.equal(rebuildCalls, rebuildsAfterFault);
  assert.equal(directRenderCount, 4);

  // Generic applyConfig does NOT clear composerFaulted
  engine.applyConfig({ bloomStrength: 0.3 });
  assert.equal(engine.isComposerFaulted(), true);

  // Explicit graphics preset change resets composerFaulted and rebuilds composer
  engine.applyQualityPreset('balanced');
  assert.equal(engine.isComposerFaulted(), false);
  assert.equal(rebuildCalls, rebuildsAfterFault + 1);

  // Trip again and verify webglcontextrestored resets composerFaulted and renders via restored composer
  enginePriv.composerFaulted = true;
  assert.equal(engine.isComposerFaulted(), true);
  const restoredHandlers = listeners.get('webglcontextrestored');
  assert.ok(restoredHandlers && restoredHandlers.size === 1);
  for (const h of restoredHandlers) h(new Event('webglcontextrestored'));
  assert.equal(engine.isComposerFaulted(), false);
  assert.ok(healthyComposerRenders >= 1);

  engine.dispose();
});

test('disposeObject3DTree disposes cloned __occMaterial and __origMaterial, and installSightlineEdgeFadeShader chains onBeforeCompile', () => {
  const root = new THREE.Group();
  const origMat = new THREE.MeshStandardMaterial();
  const occMat = origMat.clone();
  let origDisposed = 0;
  let occDisposed = 0;
  origMat.dispose = () => { origDisposed++; };
  occMat.dispose = () => { occDisposed++; };

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), origMat);
  mesh.userData.__origMaterial = origMat;
  mesh.userData.__occMaterial = occMat;
  root.add(mesh);

  disposeObject3DTree(root);
  assert.equal(origDisposed, 1);
  assert.equal(occDisposed, 1);
  assert.equal(mesh.userData.__origMaterial, undefined);
  assert.equal(mesh.userData.__occMaterial, undefined);

  // Verify installSightlineEdgeFadeShader chains pre-existing onBeforeCompile
  const chainedMat = new THREE.MeshStandardMaterial();
  let prevCalled = false;
  chainedMat.onBeforeCompile = (shader) => {
    prevCalled = true;
    shader.fragmentShader = '// PREV_HOOK\n' + shader.fragmentShader;
  };
  installSightlineEdgeFadeShader(chainedMat, false);
  const mockShader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: '',
    fragmentShader: '#include <clipping_planes_fragment>\nvoid main() {}',
  };
  chainedMat.onBeforeCompile(mockShader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  assert.equal(prevCalled, true);
  assert.ok(mockShader.fragmentShader.includes('// PREV_HOOK'));
  assert.ok(mockShader.fragmentShader.includes('capyComputeThirdPersonOccDensity'));
});

test('HardwareGpuEngine enforces mutually exclusive sun/moon shadows, skips RectAreaLight on low/medium presets, and caps WebGL2 DPR to 1.5', () => {
  // 1. DPR cap: WebGL2 & mobile cap at 1.5 on 3x HiDPI displays
  assert.equal(computeEffectivePixelRatio(3.0, 'ultra', true, false, 1.0, false, false), 1.5);
  assert.equal(computeEffectivePixelRatio(3.0, 'high', true, false, 1.0, false, false), 1.5);
  assert.equal(computeEffectivePixelRatio(3.0, 'balanced', true, false, 1.0, false, false), 1.35);
  assert.equal(computeEffectivePixelRatio(3.0, 'performance', true, false, 1.0, false, false), 1.0);
  assert.equal(computeEffectivePixelRatio(3.0, 'ultra', true, false, 1.0, true, true), 1.5);
  // Desktop WebGPU retains higher cap
  assert.ok(computeEffectivePixelRatio(2.0, 'ultra', true, false, 1.0, true, false) >= 2.0);

  // 2. Mutually exclusive sunLight.castShadow & moonLight.castShadow + RectAreaLight preset gating
  let pixelRatio = 1;
  const mockRenderer = {
    domElement: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    capabilities: { isWebGL2: true, maxTextureSize: 4096, getMaxAnisotropy: () => 8 },
    getContext: () => ({
      RENDERER: 0x1f01,
      getExtension: () => null,
      getParameter: () => 'Mock Hardware GL',
    }),
    getPixelRatio: () => pixelRatio,
    setPixelRatio: (pr: number) => {
      pixelRatio = pr;
    },
    setSize: () => {},
    setRenderTarget: () => {},
    render: () => {},
    shadowMap: { enabled: false, autoUpdate: false, type: THREE.PCFSoftShadowMap, needsUpdate: false },
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    info: { render: { calls: 0, triangles: 0 }, memory: { textures: 0, geometries: 0 } },
  } as unknown as THREE.WebGLRenderer;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const sunLight = new THREE.DirectionalLight(0xffffff, 1);
  const moonLight = new THREE.DirectionalLight(0xaaccff, 0.5);
  scene.add(sunLight, moonLight);

  const engine = new HardwareGpuEngine(mockRenderer, scene, camera, sunLight, true, 1280, 720, {
    qualityPreset: 'balanced',
    shadowQuality: 'pcf_soft',
    postProcessingEnabled: false,
  });
  engine.setMoonLight(moonLight);

  const enginePriv = engine as unknown as {
    isSoftwareGl: boolean;
    studioAreaLight: THREE.RectAreaLight | null;
    shouldEnableStudioAreaLight: (preset: 'performance' | 'balanced' | 'high' | 'ultra') => boolean;
  };
  assert.equal(enginePriv.studioAreaLight, null, 'RectAreaLight skipped on balanced/software preset');
  assert.equal(enginePriv.shouldEnableStudioAreaLight('performance'), false);
  assert.equal(enginePriv.shouldEnableStudioAreaLight('balanced'), false);

  // Switch off software-GL guard after PMREM init so hardware shadow exclusivity executes deterministically
  enginePriv.isSoftwareGl = false;
  mockRenderer.shadowMap.enabled = true;
  const sunDir = new THREE.Vector3(0.4, 0.85, 0.3).normalize();
  const moonDir = new THREE.Vector3(-0.35, 0.78, -0.45).normalize();

  // Daytime (nightFactor = 0.0) -> sun casts shadow, moon does NOT
  engine.updateLightingAndShadowCascade(0.016, 0, 1, 0, 0, true, 0.0, sunDir, moonDir, 'sun');
  assert.equal(sunLight.castShadow, true, 'Sun casts shadow during day');
  assert.equal(moonLight.castShadow, false, 'Moon never casts shadow during day');
  assert.equal(engine.getTelemetry().shadowCasterMode, 'sun');

  // Nighttime (nightFactor = 0.9) -> moon casts shadow, sun does NOT
  engine.updateLightingAndShadowCascade(0.016, 0, 1, 0, 0, true, 0.9, sunDir, moonDir, 'moon');
  assert.equal(sunLight.castShadow, false, 'Sun never casts shadow during deep night');
  assert.equal(moonLight.castShadow, true, 'Moon casts shadow during night');
  assert.equal(engine.getTelemetry().shadowCasterMode, 'moon');

  // Even if caller passes 'sun' during deep night (nightFactor >= 0.55), only one casts shadow
  engine.updateLightingAndShadowCascade(0.016, 0, 1, 0, 0, true, 0.8, sunDir, moonDir, 'sun');
  assert.notEqual(sunLight.castShadow, moonLight.castShadow, 'Sun and moon never cast shadows in the same frame');

  // Surface hidden (space/orbit) -> neither casts shadow
  engine.updateLightingAndShadowCascade(0.016, 0, 1, 0, 0, false, 0.0, sunDir, moonDir, 'sun');
  assert.equal(sunLight.castShadow, false);
  assert.equal(moonLight.castShadow, false);

  engine.dispose();
});

test('PbrTextureSynthesizer packs roughness (G) and AO (R/B) into one shared ORM DataTexture and uses 256x256 in lean mode', () => {
  PbrTextureSynthesizer.clearSurfaceCache();
  try {
    // Lean / mobile mode -> 256x256 packed ORM
    PbrTextureSynthesizer.setLeanTextureMode(true);
    assert.equal(PbrTextureSynthesizer.getSurfaceMapResolution(), 256);

    const leanMaps = PbrTextureSynthesizer.getSurfaceMaps('grass');
    assert.equal(leanMaps.normal.image.width, 256);
    assert.equal(leanMaps.normal.image.height, 256);
    assert.equal(leanMaps.orm.image.width, 256);
    assert.equal(leanMaps.orm.image.height, 256);
    assert.equal(leanMaps.roughness, leanMaps.orm, 'roughness shares single ORM DataTexture');
    assert.equal(leanMaps.ao, leanMaps.orm, 'ao shares single ORM DataTexture');

    const data = leanMaps.orm.image.data as Uint8Array;
    assert.equal(data.length, 256 * 256 * 4);
    // Verify R === B (AO channel parity), G > 0 (roughness packed), A === 255
    for (let i = 0; i < 64; i++) {
      const idx = i * 4;
      assert.equal(data[idx], data[idx + 2], 'ORM R and B channels carry matching AO values');
      assert.ok(data[idx + 1] > 0, 'ORM G channel carries roughness');
      assert.equal(data[idx + 3], 255);
    }

    // Desktop mode -> 512x512 packed ORM
    PbrTextureSynthesizer.setLeanTextureMode(false);
    assert.equal(PbrTextureSynthesizer.getSurfaceMapResolution(), 512);
    const deskMaps = PbrTextureSynthesizer.getSurfaceMaps('cobble');
    assert.equal(deskMaps.orm.image.width, 512);
    assert.equal(deskMaps.roughness, deskMaps.ao);
  } finally {
    PbrTextureSynthesizer.setLeanTextureMode(false);
    PbrTextureSynthesizer.clearSurfaceCache();
  }
});

test('LiveTelemetryStore publishes telemetry snapshots to subscribers cleanly without coupling to parent state', () => {
  const store = createLiveTelemetryStore();
  let calls = 0;
  const unsub = store.subscribe(() => {
    calls++;
  });

  store.publish({
    mode: 'capytorio',
    primaryLabel: 'Factory',
    primaryValue: '12 machines',
    secondaryLabel: 'Power',
    secondaryValue: '100% Grid',
    zoneCoordsLabel: '(0, 0)',
  });
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().mode, 'capytorio');
  assert.equal(store.getSnapshot().primaryValue, '12 machines');

  unsub();
  store.publish({
    ...store.getSnapshot(),
    primaryValue: '13 machines',
  });
  assert.equal(calls, 1, 'Unsubscribed listener is no longer notified');
  assert.equal(store.getSnapshot().primaryValue, '13 machines');
});



