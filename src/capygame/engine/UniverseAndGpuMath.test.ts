import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { INITIAL_PLAYER_STATS, UNIVERSE_SCALE_BANDS } from '../types';
import { ProgressionService } from '../services/ProgressionService';
import { ShallowWaterFluidSolver } from './physics/ContiguousWorldTopology';
import { PhysicsWorldBridge } from './physics/PhysicsWorldBridge';
import { GamePauseController } from './GamePauseController';
import {
  CAPYTORIO_OBLIQUE_BASE_RADIUS_M,
  CAPYTORIO_ORBIT_HANDOFF_DIST,
  CAPYTORIO_ORBIT_HANDOFF_LOG_METERS,
  CAPYTORIO_ZOOM_MIN_DIST,
  FLIGHT_SPEED_GEARS,
  FOREST_GAMES_ZOOM_MAX_DIST,
  SURFACE_ZOOM_MIN_DIST,
  SURFACE_ZOOM_ORBIT_THRESHOLD,
  CHROMATIN_BRIDGE_LOG_METERS,
  clampForwardFlightSpeed,
  computeAdaptiveCruiseSpeedMultiplier,
  computeCapytorioZoomStep,
  computeInfiniteZoomHorizonMinPitch,
  computeOrbitalZoomThrottleStep,
  computeSpiralOrbitAngleRadians,
  computeSurfaceZoomStep,
  evaluateActiveSimulationSubsystems,
  evaluateCellNucleusOpacity,
  evaluateChromatinBridgeAlpha,
  evaluateInfiniteZoomBandAlpha,
  formatFlightSpeedReadout,
  formatRealisticScaleMeters,
  mergeDiscoveredSpecimen,
  resolveTopLevelGameMode,
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
import { DEFAULT_GPU_PIPELINE_CONFIG } from './gpu/GpuEngineTypes';
import { HardwareGpuEngine } from './gpu/HardwareGpuEngine';
import {
  PerformanceLogTracker,
  computeAdaptiveGpuMitigation,
  computeEffectivePixelRatio,
  type AdaptiveGpuMitigationResult,
} from './gpu/FramePerformanceGovernor';
import { PerformanceProfiler } from './gpu/PerformanceProfiler';
import { AaaWorldVfxEngine } from './gpu/AaaWorldVfxEngine';
import { PbrTextureSynthesizer } from './gpu/PbrTextureSynthesizer';
import { disposeObject3DTree } from './gpu/ThreeDisposal';
import { createSpacetimeManifoldMaterial } from './UniverseShaders';
import {
  RealisticWorldEnvironment,
  installSightlineEdgeFadeShader,
} from './RealisticWorldEnvironment';
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
  installSightlineEdgeFadeShader(chainedMat);
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
  assert.equal(computeEffectivePixelRatio(3.0, 'ultra', true, false, 1.0, false), 1.5);
  assert.equal(computeEffectivePixelRatio(3.0, 'high', true, false, 1.0, false), 1.5);
  assert.equal(computeEffectivePixelRatio(3.0, 'balanced', true, false, 1.0, false), 1.35);
  assert.equal(computeEffectivePixelRatio(3.0, 'performance', true, false, 1.0, false), 1.0);
  assert.equal(computeEffectivePixelRatio(3.0, 'ultra', true, false, 1.0, true), 1.5);
  assert.equal(computeEffectivePixelRatio(2.0, 'ultra', true, false, 1.25, false), 1.88);

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

test('PbrTextureSynthesizer packs roughness (G) and AO (R/B) into one shared ORM DataTexture and uses 64/128 resolutions', () => {
  PbrTextureSynthesizer.clearSurfaceCache();
  try {
    // Lean / mobile mode -> 64x64 packed ORM + 64x64 normal maps
    PbrTextureSynthesizer.setLeanTextureMode(true);
    assert.equal(PbrTextureSynthesizer.getSurfaceMapResolution(), 64);

    const leanMaps = PbrTextureSynthesizer.getSurfaceMaps('grass');
    assert.equal(leanMaps.normal.image.width, 64);
    assert.equal(leanMaps.normal.image.height, 64);
    assert.equal(leanMaps.orm.image.width, 64);
    assert.equal(leanMaps.orm.image.height, 64);
    assert.equal(leanMaps.roughness, leanMaps.orm, 'roughness shares single ORM DataTexture');
    assert.equal(leanMaps.ao, leanMaps.orm, 'ao shares single ORM DataTexture');

    const leanWater = PbrTextureSynthesizer.getWaterNormalMaps();
    assert.equal(leanWater.primary.image.width, 64);
    assert.equal(leanWater.secondary.image.width, 64);
    assert.equal(PbrTextureSynthesizer.getCapyFurNormalMap().image.width, 64);
    assert.equal(PbrTextureSynthesizer.getCitrusPeelNormalMap().image.width, 64);

    const data = leanMaps.orm.image.data as Uint8Array;
    assert.equal(data.length, 64 * 64 * 4);
    // Verify R === B (AO channel parity), G > 0 (roughness packed), A === 255
    for (let i = 0; i < 64; i++) {
      const idx = i * 4;
      assert.equal(data[idx], data[idx + 2], 'ORM R and B channels carry matching AO values');
      assert.ok(data[idx + 1] > 0, 'ORM G channel carries roughness');
      assert.equal(data[idx + 3], 255);
    }

    // Desktop mode -> 128x128 packed ORM + 128x128 water/fur/citrus normal maps
    PbrTextureSynthesizer.setLeanTextureMode(false);
    PbrTextureSynthesizer.clearSurfaceCache();
    assert.equal(PbrTextureSynthesizer.getSurfaceMapResolution(), 128);
    const deskMaps = PbrTextureSynthesizer.getSurfaceMaps('cobble');
    assert.equal(deskMaps.orm.image.width, 128);
    assert.equal(deskMaps.roughness, deskMaps.ao);

    const deskWater = PbrTextureSynthesizer.getWaterNormalMaps();
    assert.equal(deskWater.primary.image.width, 128);
    assert.equal(deskWater.secondary.image.width, 128);
    assert.equal(PbrTextureSynthesizer.getCapyFurNormalMap().image.width, 128);
    assert.equal(PbrTextureSynthesizer.getCitrusPeelNormalMap().image.width, 128);
  } finally {
    PbrTextureSynthesizer.setLeanTextureMode(false);
    PbrTextureSynthesizer.clearSurfaceCache();
  }
});

test('GamePauseController transitions deterministically between running and paused states', () => {
  const ctrl = new GamePauseController();
  assert.equal(ctrl.isPaused, false);
  assert.equal(ctrl.getSnapshot().totalPausedMs, 0);

  // Pausing once succeeds; pausing again is idempotent
  assert.equal(ctrl.pause(1000), true);
  assert.equal(ctrl.pause(1200), false);
  assert.equal(ctrl.isPaused, true);
  assert.equal(ctrl.getSnapshot().pauseCount, 1);

  // Resuming accumulates duration and transitions back cleanly
  const res1 = ctrl.resume(2500);
  assert.equal(res1.resumed, true);
  assert.equal(res1.pausedDurationMs, 1500);
  assert.equal(ctrl.resume(2600).resumed, false);
  assert.equal(ctrl.isPaused, false);
  assert.equal(ctrl.getSnapshot().totalPausedMs, 1500);

  // Toggle flips state cleanly
  assert.equal(ctrl.toggle(3000), true);
  assert.equal(ctrl.isPaused, true);
  assert.equal(ctrl.toggle(3400), false);
  assert.equal(ctrl.isPaused, false);
  assert.equal(ctrl.getSnapshot().totalPausedMs, 1900);
});

test('HardwareGpuEngine boots with fast IBL, defers PMREM upgrade, and frees composer FBOs on pause', () => {
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
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  scene.add(sunLight);

  const engine = new HardwareGpuEngine(mockRenderer, scene, camera, sunLight, false, 1280, 720, {
    qualityPreset: 'balanced',
    postProcessingEnabled: false,
  });

  // Boots with fast 64x32 IBL (not full PMREM cubemap)
  assert.equal(engine.isPmremUpgraded(), false);
  assert.ok(scene.environment !== null, 'Fast boot IBL environment is populated immediately');
  assert.equal(
    (scene.environment as THREE.DataTexture).image.width,
    64,
    'Fast boot IBL uses instant 64x32 DataTexture before deferred PMREM upgrade'
  );

  // Attach a fake composer and verify suspendForPause() disposes it cleanly
  let composerDisposed = false;
  const enginePriv = engine as unknown as {
    composer: { dispose: () => void; render: () => void } | null;
  };
  enginePriv.composer = {
    dispose: () => {
      composerDisposed = true;
    },
    render: () => {},
  };

  engine.suspendForPause();
  assert.equal(composerDisposed, true, 'Composer FBOs disposed on pause to release VRAM');
  assert.equal(enginePriv.composer, null);

  engine.resumeFromPause();
  engine.dispose();
});

test('PhysicsWorldBridge suspends cleanly on pause and resets suspended flag on resume', () => {
  const bridge = new PhysicsWorldBridge();
  assert.equal(bridge.isPausedSuspended(), false);

  bridge.suspendForPause();
  assert.equal(bridge.isPausedSuspended(), true);
  assert.equal(bridge.getTelemetry().workerActive, false);

  bridge.resumeFromPause();
  assert.equal(bridge.isPausedSuspended(), false);
  bridge.dispose();
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

test('Phase 1 P0 Disposal: disposeObject3DTree preserves sharedAsset, disposes renderable root, InstancedMesh, extended PBR maps & ShaderMaterial uniforms', () => {
  // 1. Shared geometry, material, and texture must NOT be disposed
  const sharedGeo = new THREE.BoxGeometry(1, 1, 1);
  sharedGeo.userData.sharedAsset = true;
  let sharedGeoDisposed = 0;
  sharedGeo.dispose = () => { sharedGeoDisposed++; };

  const sharedTex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  sharedTex.userData.sharedAsset = true;
  let sharedTexDisposed = 0;
  sharedTex.dispose = () => { sharedTexDisposed++; };

  const sharedMat = new THREE.MeshStandardMaterial({ map: sharedTex });
  sharedMat.userData.sharedAsset = true;
  let sharedMatDisposed = 0;
  sharedMat.dispose = () => { sharedMatDisposed++; };

  const sharedMesh = new THREE.Mesh(sharedGeo, sharedMat);
  disposeObject3DTree(sharedMesh);
  assert.equal(sharedGeoDisposed, 0, 'shared geometry must survive disposal');
  assert.equal(sharedMatDisposed, 0, 'shared material must survive disposal');
  assert.equal(sharedTexDisposed, 0, 'shared texture must survive disposal');

  // 2. Renderable root Mesh/InstancedMesh itself MUST be disposed, including extended PBR maps & ShaderMaterial uniform textures
  const envTex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const lightTex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const dispTex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const uniformTex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  let envDisposed = 0;
  let lightDisposed = 0;
  let dispDisposed = 0;
  let uniformDisposed = 0;
  envTex.dispose = () => { envDisposed++; };
  lightTex.dispose = () => { lightDisposed++; };
  dispTex.dispose = () => { dispDisposed++; };
  uniformTex.dispose = () => { uniformDisposed++; };

  const pbrMat = new THREE.MeshStandardMaterial({
    envMap: envTex,
    lightMap: lightTex,
    displacementMap: dispTex,
  });
  const instGeo = new THREE.BoxGeometry(1, 1, 1);
  let instGeoDisposed = 0;
  instGeo.dispose = () => { instGeoDisposed++; };
  let instMeshDisposed = 0;
  const instMesh = new THREE.InstancedMesh(instGeo, pbrMat, 4);
  instMesh.dispose = () => { instMeshDisposed++; return instMesh; };

  const shaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uCustomMap: { value: uniformTex },
      uSharedMap: { value: sharedTex },
    },
  });
  const shaderMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shaderMat);
  instMesh.add(shaderMesh);

  disposeObject3DTree(instMesh);
  assert.equal(instMeshDisposed, 1, 'InstancedMesh root itself is disposed');
  assert.equal(instGeoDisposed, 1, 'InstancedMesh geometry is disposed');
  assert.equal(envDisposed, 1, 'envMap is disposed');
  assert.equal(lightDisposed, 1, 'lightMap is disposed');
  assert.equal(dispDisposed, 1, 'displacementMap is disposed');
  assert.equal(uniformDisposed, 1, 'unshared ShaderMaterial uniform texture is disposed');
  assert.equal(sharedTexDisposed, 0, 'shared ShaderMaterial uniform texture is preserved');
});

test('Phase 1 P0 Geometry Winding: ribbed fruit has outward normals & positive signed volume; alpine mountains face upward (+Y)', () => {
  const fruitGeo = RealisticWorldEnvironment.getUnitRibbedFruitGeometry();
  assert.equal(fruitGeo.userData.sharedAsset, true, 'Unit ribbed fruit geometry is marked sharedAsset');

  const pos = fruitGeo.getAttribute('position') as THREE.BufferAttribute;
  const norm = fruitGeo.getAttribute('normal') as THREE.BufferAttribute;
  const idx = fruitGeo.getIndex()!;

  // Compute signed volume = sum(v0 · (v1 x v2)) / 6; outward CCW winding => positive signed volume
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const cross = new THREE.Vector3();
  let signedVol6 = 0;
  for (let i = 0; i < idx.count; i += 3) {
    v0.fromBufferAttribute(pos, idx.getX(i));
    v1.fromBufferAttribute(pos, idx.getX(i + 1));
    v2.fromBufferAttribute(pos, idx.getX(i + 2));
    cross.crossVectors(v1, v2);
    signedVol6 += v0.dot(cross);
  }
  assert.ok(signedVol6 / 6 > 1.0, `Expected positive outward signed volume for ribbed fruit, got ${(signedVol6 / 6).toFixed(4)}`);

  // Verify vertex normals point outward from origin
  let outwardCount = 0;
  for (let i = 0; i < pos.count; i++) {
    const dot =
      pos.getX(i) * norm.getX(i) +
      pos.getY(i) * norm.getY(i) +
      pos.getZ(i) * norm.getZ(i);
    if (dot > 0) outwardCount++;
  }
  assert.ok(outwardCount / pos.count > 0.95, `Expected outward vertex normals on ribbed fruit (${outwardCount}/${pos.count})`);

  // Alpine mountain ring must have upward-facing (+Y) normals so inner slopes are not backface-culled
  const mtnGeo = RealisticWorldEnvironment.buildAlpineMountainGeometry(24);
  const mtnNorm = mtnGeo.getAttribute('normal') as THREE.BufferAttribute;
  let sumNy = 0;
  for (let i = 0; i < mtnNorm.count; i++) {
    sumNy += mtnNorm.getY(i);
  }
  assert.ok(sumNy / mtnNorm.count > 0.3, `Expected upward (+Y) average normal on alpine mountain ring, got ${(sumNy / mtnNorm.count).toFixed(4)}`);
  mtnGeo.dispose();
});

test('Phase 1 P0 Scale & PhysicsWorldBridge: dt<=0 guards, tuning sanitization, and sweeper hammer tangential impulse sign', () => {
  // 1. stepSteadyLogScaleTowardTarget returns currentLog (not targetLog) on dt<=0 or NaN
  assert.equal(stepSteadyLogScaleTowardTarget(12.5, 5.0, 0), 12.5);
  assert.equal(stepSteadyLogScaleTowardTarget(12.5, 5.0, -0.5), 12.5);
  assert.equal(stepSteadyLogScaleTowardTarget(12.5, 5.0, Number.NaN), 12.5);
  assert.equal(stepSteadyLogScaleTowardTarget(5.0002, 5.0, 0.016), 5.0);

  // 2. PhysicsWorldBridge guards NaN/<=0 dt and NaN tuning values
  const bridge = new PhysicsWorldBridge();
  bridge.setPhysicsTuning({
    seesawStiffnessScale: Number.NaN,
    waterWaveSpeedScale: Number.POSITIVE_INFINITY,
    fluidViscosityScale: Number.NaN,
    trampolineBoostMultiplier: Number.NaN,
  });

  const noopRes = bridge.stepContiguousCharacterAndWorld(
    {
      wx: 2,
      wy: 0.5,
      wz: 3,
      vx: 1,
      vy: 0,
      vz: -1,
      desiredMoveVx: 4,
      desiredMoveVz: 4,
      radius: 0.68,
      halfHeight: 0.55,
      jumpImpulseY: 0,
      gravityScale: 1,
      dt: Number.NaN,
    },
    0,
    []
  );
  assert.equal(noopRes.wx, 2);
  assert.equal(noopRes.wz, 3);
  assert.equal(noopRes.ccdSubsteps, 0);

  // 3. Sweeper hammer tangential impulse obeys right-handed omega x r = omega * proj * (dirZ, -dirX)
  // Hammer at (0, 0), angleY = 0 => arm axis dir = (1, 0), angularSpeed = +3.0 rad/s (CCW around +Y)
  // At +X end (proj = +3.0, player at (3.0, 0.5, 0.1)): omega x (+3, 0, 0) = (0, 0, -9) => impZ < 0
  const hitPosArm = bridge.stepContiguousCharacterAndWorld(
    {
      wx: 3.0,
      wy: 0.5,
      wz: 0.1,
      vx: 0,
      vy: 0,
      vz: 0,
      desiredMoveVx: 0,
      desiredMoveVz: 0,
      radius: 0.68,
      halfHeight: 0.55,
      jumpImpulseY: 0,
      gravityScale: 1,
      dt: 0.016,
    },
    0,
    [{ wx: 0, wz: 0, angleY: 0, angularSpeed: 3.0, halfLen: 5.0 }]
  );
  const posArmImpZ = hitPosArm.hammerImpulseZ;
  // At -X end (proj = -3.0, player at (-3.0, 0.5, -0.1)): omega x (-3, 0, 0) = (0, 0, +9) => impZ > 0
  const hitNegArm = bridge.stepContiguousCharacterAndWorld(
    {
      wx: -3.0,
      wy: 0.5,
      wz: -0.1,
      vx: 0,
      vy: 0,
      vz: 0,
      desiredMoveVx: 0,
      desiredMoveVz: 0,
      radius: 0.68,
      halfHeight: 0.55,
      jumpImpulseY: 0,
      gravityScale: 1,
      dt: 0.016,
    },
    0,
    [{ wx: 0, wz: 0, angleY: 0, angularSpeed: 3.0, halfLen: 5.0 }]
  );
  const negArmImpZ = hitNegArm.hammerImpulseZ;

  assert.ok(posArmImpZ < -2.0, `Expected -Z tangential impulse on +X arm, got ${posArmImpZ}`);
  assert.ok(negArmImpZ > 2.0, `Expected +Z tangential impulse on -X arm, got ${negArmImpZ}`);
  bridge.dispose();
});

test('Phase 3: PerformanceLogTracker.recordFrame and computeAdaptiveGpuMitigation reuse scratch buffers with zero per-frame allocation', () => {
  const tracker = new PerformanceLogTracker(1000);
  const firstRef = tracker.recordFrame(8, 16.6, false, 'Sanctuary', 1016);
  const secondRef = tracker.recordFrame(9, 16.6, false, 'Sanctuary', 1032);
  // Drain warmup (4 frames) and verify steady-state call returns identical object reference
  tracker.recordFrame(9, 16.6, false, 'Sanctuary', 1048);
  tracker.recordFrame(9, 16.6, false, 'Sanctuary', 1064);
  const steadyRef = tracker.recordFrame(12, 16.6, false, 'Sanctuary', 1080);
  assert.strictEqual(firstRef, secondRef, 'Warmup recordFrame reuses scratch object');
  assert.strictEqual(firstRef, steadyRef, 'Steady-state recordFrame reuses exact same scratch object');

  const out: AdaptiveGpuMitigationResult = {
    level: 0,
    postProcessingEnabled: true,
    ssaoEnabled: true,
    bloomEnabled: true,
    shadowQuality: 'pcf_soft',
    antiAliasing: 'msaa_fxaa',
    resolutionScale: 1,
    maxCapyLodTier: 3,
    disabledFeatures: [],
  };
  const featuresArrRef = out.disabledFeatures;
  const res1 = computeAdaptiveGpuMitigation(DEFAULT_GPU_PIPELINE_CONFIG, true, 3, 4, out);
  assert.strictEqual(res1, out);
  assert.strictEqual(res1.disabledFeatures, featuresArrRef, 'Reuses out.disabledFeatures array');
  assert.ok(res1.disabledFeatures.length > 0);
  computeAdaptiveGpuMitigation(DEFAULT_GPU_PIPELINE_CONFIG, true, 3, 0, out);
  assert.strictEqual(out.disabledFeatures, featuresArrRef, 'Resets and reuses out.disabledFeatures at tier 0');
  assert.equal(out.disabledFeatures.length, 0);
});

test('Phase 3: PerformanceProfiler O(1) phase lookup and WebGLQuery dispose()', () => {
  const profiler = new PerformanceProfiler(1000);
  profiler.setEnabled(true);
  const deletedQueries: unknown[] = [];
  const fakeActive = { id: 'qActive' };
  const fakePending = { id: 'qPending' };
  const pPriv = profiler as unknown as {
    glContext: { deleteQuery: (q: unknown) => void } | null;
    queryActive: unknown;
    queryPending: unknown;
  };
  pPriv.glContext = { deleteQuery: (q: unknown) => deletedQueries.push(q) };
  pPriv.queryActive = fakeActive;
  pPriv.queryPending = fakePending;

  profiler.beginFrame();
  profiler.startPhase('gpu_render_submit');
  profiler.endPhase('gpu_render_submit');
  profiler.endFrame();
  const snap = profiler.getTelemetrySnapshot();
  assert.ok(snap.modules.some((m) => m.id === 'gpu_render_submit'));

  profiler.dispose();
  assert.deepEqual(deletedQueries, [fakeActive, fakePending], 'dispose() deletes active and pending WebGLQuery handles');
  assert.equal(pPriv.glContext, null);
  assert.equal(pPriv.queryActive, null);
  assert.equal(pPriv.queryPending, null);
});

test('Phase 3: HardwareGpuEngine updates uTexelSize without FXAA, resizes bloom via setSize, preserves camera layers, and cleans up scene on dispose', () => {
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
    getPixelRatio: () => 2,
    setPixelRatio: () => {},
    setSize: () => {},
    setRenderTarget: () => {},
    render: () => {},
    shadowMap: { enabled: false, autoUpdate: false, type: THREE.PCFSoftShadowMap, needsUpdate: false },
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    info: { render: { calls: 0, triangles: 0 }, memory: { textures: 0, geometries: 0 } },
  } as unknown as THREE.WebGLRenderer;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.layers.enable(1); // Non-default mask (layers 0 + 1)
  const expectedMask = camera.layers.mask;
  const sunLight = new THREE.DirectionalLight(0xffffff, 1);
  let shadowMapDisposed = 0;
  sunLight.shadow.map = { dispose: () => { shadowMapDisposed++; } } as unknown as THREE.WebGLRenderTarget;
  scene.add(sunLight);

  const engine = new HardwareGpuEngine(mockRenderer, scene, camera, sunLight, true, 1000, 500, {
    qualityPreset: 'balanced',
    postProcessingEnabled: false,
  });

  const priv = engine as unknown as {
    fxaaPass: null;
    masterFilterPass: { uniforms: Record<string, { value: THREE.Vector2 }> } | null;
    bloomPass: { setSize: (w: number, h: number) => void } | null;
    rimLight: THREE.DirectionalLight;
    heroContactShadowMesh: THREE.Mesh;
  };

  let bloomSetSizeArgs: [number, number] | null = null;
  const texelVec = new THREE.Vector2(0, 0);
  priv.fxaaPass = null;
  priv.masterFilterPass = {
    uniforms: {
      tDepth: { value: null },
      uHasDepth: { value: 0 },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 1000 },
      uSsaoStrength: { value: 0 },
      uSharpen: { value: 0 },
      uSaturation: { value: 1 },
      uContrast: { value: 1 },
      uLift: { value: 0 },
      uGamma: { value: 1 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uVignette: { value: 0 },
      uChromatic: { value: 0 },
      uScanlines: { value: 0 },
      uTexelSize: { value: texelVec },
    } as unknown as Record<string, { value: THREE.Vector2 }>,
  };
  priv.bloomPass = { setSize: (w: number, h: number) => { bloomSetSizeArgs = [w, h]; } };

  engine.handleResize(800, 400);
  assert.ok(bloomSetSizeArgs !== null, 'handleResize invokes bloomPass.setSize(...)');
  assert.ok(Math.abs(texelVec.x - 1 / 1600) < 1e-6, 'uTexelSize updated even when fxaaPass is null');
  assert.ok(Math.abs(texelVec.y - 1 / 800) < 1e-6);

  // Crisp overlay pass preserves arbitrary camera layer masks
  engine.setCrispOverlayActive(true);
  engine.render();
  assert.equal(camera.layers.mask, expectedMask, 'renderCrispOverlayPass restores prior camera.layers.mask');

  // Clear mock passes before dispose so dispose() doesn't call .dispose() on mock objects
  priv.masterFilterPass = null;
  priv.bloomPass = null;
  engine.dispose();
  assert.equal(shadowMapDisposed, 1, 'dispose() frees sunLight.shadow.map');
  assert.equal(priv.rimLight.parent, null, 'dispose() removes rimLight from scene');
  assert.equal(priv.heroContactShadowMesh.parent, null, 'dispose() removes heroContactShadowMesh from scene');
});

test('Phase 3: AaaWorldVfxEngine preserves disabled motes visibility and guards zero sunDirection; shaders and __sourceGeometry dispose safely', () => {
  const vfxScene = new THREE.Scene();
  const vfx = new AaaWorldVfxEngine(vfxScene, false, 1);
  const vfxPriv = vfx as unknown as {
    motesPoints: THREE.Points;
    godRayGroup: THREE.Group;
  };
  assert.equal(vfxPriv.motesPoints.visible, false);
  vfx.update(0.016, 1.0, 0, 1, 0, new THREE.Vector3(0, 0, 0), 0, 0, true, false);
  assert.equal(vfxPriv.motesPoints.visible, false, 'update() never re-enables disabled motesPoints');
  for (const child of vfxPriv.godRayGroup.children) {
    assert.ok(Number.isFinite(child.quaternion.x) && Number.isFinite(child.quaternion.w), 'Zero sun vector yields finite god-ray quaternion');
  }
  vfx.dispose();

  const manifoldMat = createSpacetimeManifoldMaterial();
  assert.ok(manifoldMat.fragmentShader.includes('max(fwidth('), 'Spacetime manifold guards fwidth against zero division');
  assert.ok(manifoldMat.fragmentShader.includes('x = max(x, vec3(0.0))'), 'acesToneMap clamps negative HDR inputs');
  manifoldMat.dispose();

  // Verify __sourceGeometry cleanup in disposeObject3DTree
  const group = new THREE.Group();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  const srcGeo = new THREE.BufferGeometry();
  let srcGeoDisposed = 0;
  srcGeo.dispose = () => { srcGeoDisposed++; };
  sprite.userData.__sourceGeometry = srcGeo;
  group.add(sprite);
  disposeObject3DTree(group);
  assert.equal(srcGeoDisposed, 1, 'disposeObject3DTree disposes unshared __sourceGeometry');
});

test('Standalone 3-game separation: clean simulation pausing, Capytorio UFO orbital flight preservation, and Forest zoom clamp', () => {
  // 1. Mode resolution cleanly separates Infinite Zoom, Forest Games, and Capytorio
  assert.equal(resolveTopLevelGameMode(true, 'sanctuary', false), 'infinite_zoom');
  assert.equal(resolveTopLevelGameMode(false, 'sanctuary', false), 'forest_games');
  assert.equal(resolveTopLevelGameMode(false, 'spore', false), 'forest_games');
  assert.equal(resolveTopLevelGameMode(false, 'runner', false), 'forest_games');
  assert.equal(resolveTopLevelGameMode(false, 'fallguys', false), 'forest_games');
  assert.equal(resolveTopLevelGameMode(false, 'capytorio', false), 'capytorio');
  assert.equal(resolveTopLevelGameMode(true, 'capytorio', true), 'capytorio');

  // 2. Simulation pausing masks guarantee zero cross-game ticking and zero per-frame allocations
  const izMask = evaluateActiveSimulationSubsystems('infinite_zoom', false);
  assert.equal(izMask.runInfiniteZoom, true);
  assert.equal(izMask.runForestGames, false);
  assert.equal(izMask.runForestWeatherAndWater, false);
  assert.equal(izMask.runCapytorioFactory, false);
  assert.strictEqual(izMask, evaluateActiveSimulationSubsystems('infinite_zoom', false));

  const fgMask = evaluateActiveSimulationSubsystems('forest_games', false);
  assert.equal(fgMask.runInfiniteZoom, false);
  assert.equal(fgMask.runForestGames, true);
  assert.equal(fgMask.runForestWeatherAndWater, true);
  assert.equal(fgMask.runCapytorioFactory, false);

  const capSurfaceMask = evaluateActiveSimulationSubsystems('capytorio', false);
  assert.equal(capSurfaceMask.runInfiniteZoom, false);
  assert.equal(capSurfaceMask.runForestGames, false);
  assert.equal(capSurfaceMask.runForestWeatherAndWater, false);
  assert.equal(capSurfaceMask.runCapytorioFactory, true);

  // Capytorio UFO orbital flight runs orbital flight visuals while pausing factory & Forest loops
  const capOrbitalMask = evaluateActiveSimulationSubsystems('capytorio', true);
  assert.equal(capOrbitalMask.runInfiniteZoom, true);
  assert.equal(capOrbitalMask.runForestGames, false);
  assert.equal(capOrbitalMask.runForestWeatherAndWater, false);
  assert.equal(capOrbitalMask.runCapytorioFactory, false);

  // 3. Forest Games zoom-out clamps comfortably and NEVER accidentally launches into Infinite Zoom
  let dist = 1.0;
  for (let i = 0; i < 30; i++) {
    const out = computeSurfaceZoomStep(dist, -0.45, true, false);
    assert.equal(out.launchToOrbit, false, 'Forest Games zoom-out must never launch Infinite Zoom');
    assert.ok(out.nextDistance >= SURFACE_ZOOM_MIN_DIST && out.nextDistance <= FOREST_GAMES_ZOOM_MAX_DIST);
    dist = out.nextDistance;
  }
  assert.equal(dist, FOREST_GAMES_ZOOM_MAX_DIST);

  // 4. Capytorio oblique zoom-out still hands off cleanly into orbital UFO flight
  let capDist = 1.0;
  let capLaunched = false;
  for (let i = 0; i < 120; i++) {
    const out = computeCapytorioZoomStep(capDist, -0.2);
    capDist = out.nextDistance;
    if (out.launchToOrbit) {
      capLaunched = true;
      break;
    }
  }
  assert.equal(capLaunched, true, 'Capytorio zoom-out must still support orbital UFO handoff');
});

test('Infinite Zoom transition polish: zero visibility gaps, <=2 terrain/cloud overlap, nucleus dissolve, Chromatin bridge, continuous pitch, adaptive pacing', () => {
  const fullChainBands = [
    'planet',
    'atmosphere',
    'land_masses',
    'ecosystems',
    'capybara_forest',
    'leaf_fur_micro',
    'biological_cells',
    'dna_molecules',
  ] as const;
  const terrainCloudBands = ['planet', 'atmosphere', 'land_masses', 'ecosystems'] as const;

  // 1. Dense 0.05-dex sweep from Planet (7.10) down to DNA (-8.60): zero blank gaps & <=2 terrain/cloud layers at once
  for (let i = 0; i <= 314; i++) {
    const log = Number((7.1 - i * 0.05).toFixed(4));
    let maxAlpha = evaluateChromatinBridgeAlpha(log, 1.0);
    for (const bandId of fullChainBands) {
      const a = evaluateInfiniteZoomBandAlpha(bandId, log, 1.0, false, false);
      if (a > maxAlpha) maxAlpha = a;
    }
    assert.ok(
      maxAlpha >= 0.45,
      `Expected zero visibility gap at log=${log}, got maxAlpha=${maxAlpha.toFixed(3)}`
    );

    let activeTerrainLayers = 0;
    for (const bandId of terrainCloudBands) {
      const a = evaluateInfiniteZoomBandAlpha(bandId, log, 1.0, false, false);
      if (a > 0.01) activeTerrainLayers++;
    }
    assert.ok(
      activeTerrainLayers <= 2,
      `Expected <=2 overlapping terrain/cloud layers at log=${log}, got ${activeTerrainLayers}`
    );
  }

  // 2. Capytorio orbital descent preserves full planet visibility while suppressing woodland surface bands
  assert.ok(
    evaluateInfiniteZoomBandAlpha('planet', 3.0, 1.0, true, true) > 0.9,
    'Capytorio orbital descent must retain planet mesh down to log 3.0'
  );
  for (const woodlandId of ['land_masses', 'ecosystems', 'capybara_forest', 'leaf_fur_micro']) {
    assert.equal(
      evaluateInfiniteZoomBandAlpha(woodlandId, 1.5, 1.0, true, true),
      0,
      `Woodland band ${woodlandId} must be suppressed during Capytorio orbital flight`
    );
  }

  // 3. Cell nucleus sphere (r=2.2 at -4.3) dissolves completely BEFORE camera reaches wall at -5.537
  assert.equal(evaluateCellNucleusOpacity(-4.3), 1);
  const midNucleus = evaluateCellNucleusOpacity(-5.1);
  assert.ok(midNucleus > 0 && midNucleus < 1, `Expected smooth fade at -5.1, got ${midNucleus}`);
  assert.equal(
    evaluateCellNucleusOpacity(-5.35),
    0,
    'Cell nucleus must finish dissolving before camera shell intersection at -5.537'
  );

  // 4. Chromatin fiber bridge peaks cleanly at -6.40 and overlaps both Biological Cells and DNA Helix
  assert.equal(evaluateChromatinBridgeAlpha(CHROMATIN_BRIDGE_LOG_METERS, 1.0), 1);
  assert.ok(
    evaluateChromatinBridgeAlpha(-5.4, 1.0) > 0.4 &&
      evaluateInfiniteZoomBandAlpha('biological_cells', -5.4, 1.0, false, false) > 0.4,
    'Chromatin bridge must smoothly overlap Biological Cells'
  );
  assert.ok(
    evaluateChromatinBridgeAlpha(-7.4, 1.0) > 0.4 &&
      evaluateInfiniteZoomBandAlpha('dna_molecules', -7.4, 1.0, false, false) > 0.4,
    'Chromatin bridge must smoothly overlap DNA Helix'
  );

  // 5. Continuous C1-smooth horizonMinPitch floor with zero snap discontinuity across [-10, 10]
  assert.equal(computeInfiniteZoomHorizonMinPitch(0.8, false), 0.14);
  assert.equal(computeInfiniteZoomHorizonMinPitch(7.1, false), -0.68);
  assert.equal(computeInfiniteZoomHorizonMinPitch(-5.0, false), -0.68);
  assert.equal(computeInfiniteZoomHorizonMinPitch(7.1, true), 0.14);

  let maxPitchStep = 0;
  let prevPitch = computeInfiniteZoomHorizonMinPitch(-10.0, false);
  for (let i = 1; i <= 400; i++) {
    const log = -10.0 + i * 0.05;
    const nextPitch = computeInfiniteZoomHorizonMinPitch(log, false);
    const delta = Math.abs(nextPitch - prevPitch);
    if (delta > maxPitchStep) maxPitchStep = delta;
    prevPitch = nextPitch;
  }
  assert.ok(
    maxPitchStep < 0.06,
    `Expected smooth horizonMinPitch transitions (<0.06 rad per 0.05 dex), got ${maxPitchStep.toFixed(4)}`
  );

  // 6. Adaptive cruise pacing holds 1.0x at landmarks and accelerates smoothly (>1.4x) across wide gaps
  for (const landmark of [7.1, 0.8, -4.3, -8.47, -14.27]) {
    assert.equal(
      computeAdaptiveCruiseSpeedMultiplier(landmark),
      1.0,
      `Cruise pace must settle to 1.0x at landmark log=${landmark}`
    );
  }
  const chromatinPace = computeAdaptiveCruiseSpeedMultiplier(-6.4);
  const subatomicPace = computeAdaptiveCruiseSpeedMultiplier(-11.8);
  assert.ok(chromatinPace > 1.4 && chromatinPace <= 1.85, `Expected wide-gap boost at -6.4, got ${chromatinPace}`);
  assert.ok(subatomicPace > 1.4 && subatomicPace <= 1.85, `Expected wide-gap boost at -11.8, got ${subatomicPace}`);
  for (let log = -35; log <= 30; log += 0.25) {
    const m = computeAdaptiveCruiseSpeedMultiplier(log);
    assert.ok(m >= 1.0 && m <= 1.85, `Adaptive cruise multiplier out of [1.0, 1.85] at log=${log}: ${m}`);
  }
});






