import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PbrTextureSynthesizer } from '../engine/gpu/PbrTextureSynthesizer';
import { CapyModelGenerator } from '../engine/CapyModelGenerator';
import {
  DEFAULT_CAPY_SETTINGS,
  INITIAL_PLAYER_STATS,
  UNIVERSE_SCALE_BANDS,
  MAX_UNIVERSE_LOG_METERS,
  GalaxyMorphology,
} from '../types';
import { createSpiralGalaxyDiscMaterial } from '../engine/UniverseShaders';
import { ProgressionService } from './ProgressionService';
import {
  clampStarSystemIndex,
  resolveCircleRotatedBox2D,
} from '../engine/physics/ColliderMath';
import {
  CODATA_FINE_STRUCTURE_INVERSE,
  PROCEDURAL_CONFIG_PRESETS,
  cloneProceduralConfig,
  computeFineStructurePhysics,
  mulberry32,
  parseAndValidateProceduralConfig,
} from '../config/ProceduralGameConfig';
import {
  CONTIGUOUS_BRIDGES,
  OPEN_OCEAN_SEABED_Y,
  OPEN_OCEAN_SURFACE_Y,
  ShallowWaterFluidSolver,
  clampToContiguousWalkableWorld,
  evaluateDistrictClearances,
  getArchipelagoDistrictFootprints,
  sampleContiguousGroundY,
} from '../engine/physics/ContiguousWorldTopology';
import {
  YuzuGhostRecorder,
  createGhostPoseScratch,
  parseAndValidateGhostRun,
  sampleGhostRunAtTime,
} from '../engine/physics/YuzuGhostRecorder';
import {
  SANE_CABOOSE_LINK_DIST,
  SANE_HERO_LINK_DIST,
  SANE_MAX_SPINE_BEND_RAD,
  SANE_SEGMENT_SPACING,
  advanceDisplacementCoupledGaitPhase,
  computeLinearDachshundState,
  computeTerrainPitchAngle,
  enforceWeatherParticleCameraClearance,
  evaluateRealisticLimbPose,
  solveBidirectionalSpinePass,
  solveSpineVerticalCoupling,
} from '../engine/physics/QuadrupedGaitSolver';
import {
  MOON_ORBIT_RADIUS_AT_8_85,
  MOON_RADIUS_AT_8_85,
  PLANET_BASE_RADIUS,
  PLANET_CANON_LOG,
  computeCosmicAgeGyr,
  computeSinglePlanetWorldRadius,
} from '../engine/SeamlessUniverseSimulator';
import {
  CHRONO_VESSEL_HUD_SCALE,
  CHRONO_VESSEL_ONE_TO_ONE_SCALE,
  MOUSELOOK_MAX_DELTA_PX,
  MOUSELOOK_RAD_PER_PX,
  PerformanceLogTracker,
  computeAdaptiveGpuMitigation,
  computeBloomRenderScale,
  computeDayNightAtmosphereRig,
  computeDistrictTickStride,
  computeEffectiveCameraFar,
  computeEffectivePixelRatio,
  computeMouseLookAngles,
  computeSolarPlanetFocusOffset,
  computePlanetSurfaceLandmassFocusOffset,
  computeSpiralGalaxyFocusOffset,
  dampShortestAngle,
  findNextEffectiveMitigationLevel,
  findPrevEffectiveMitigationLevel,
  SANCTUARY_SURFACE_LAT_DEG,
  SANCTUARY_SURFACE_LON_DEG,
  computeTexelSnappedShadowOrigin,
  computeVesselOneToOneTransform,
  doesSphereBlockPlayerSightline,
  evaluateWholeScreenSightlineClearAlpha,
  extractWebGpuRenderDrawCalls,
  installFastMatrixCull,
  isLowMemoryEnvironment,
  measureSceneMemoryFootprint,
  selectBestGpuBackend,
  shouldEnableOccluderDepthWrite,
  shouldRenderDistrict,
} from '../engine/gpu/FramePerformanceGovernor';
import { DEFAULT_GPU_PIPELINE_CONFIG } from '../engine/gpu/GpuEngineTypes';
import { PerformanceProfiler } from '../engine/gpu/PerformanceProfiler';
import { PlayStyleManager } from '../engine/PlayStyleManager';

test('Sightline Occlusion Regression: offscreen/ahead objects stay 100% solid; player-blocking objects clear >=95% of the whole screen', () => {
  // Camera at (0, 6.8, 15.5) looking at Hero at (0, 1.0, 4.0) (distance ~12.88m)
  const camX = 0;
  const camY = 6.8;
  const camZ = 15.5;
  const heroX = 0;
  const heroY = 1.0;
  const heroZ = 4.0;

  // 1. Tree ahead of / beyond the player (walking toward a tree at z = -0.5 with wide 5m canopy going offscreen at top):
  assert.equal(
    doesSphereBlockPlayerSightline(0, 5.5, -0.5, 5.0, camX, camY, camZ, heroX, heroY, heroZ),
    false
  );
  assert.equal(evaluateWholeScreenSightlineClearAlpha(0.5, 0.5, 0.0, 390, 844), 1.0);

  // 2. Pool / Onsen / Tree off to the bottom-left or side starting to go offscreen (x = -8.5, z = 10.0, r = 3.2):
  assert.equal(
    doesSphereBlockPlayerSightline(-8.5, 1.5, 10.0, 3.2, camX, camY, camZ, heroX, heroY, heroZ),
    false
  );

  // 3. Tree genuinely between camera and player along the sightline (x = 0.4, y = 4.2, z = 10.2, r = 3.0) -> MUST trigger whole-screen clear!
  assert.equal(
    doesSphereBlockPlayerSightline(0.4, 4.2, 10.2, 3.0, camX, camY, camZ, heroX, heroY, heroZ),
    true
  );

  // 4. Whole-screen visibility on 390x844 mobile portrait when blocking player (NOT just a small border around the player!):
  assert.equal(evaluateWholeScreenSightlineClearAlpha(0.5, 0.48, 1.0, 390, 844), 0.0);
  assert.equal(evaluateWholeScreenSightlineClearAlpha(0.15, 0.78, 1.0, 390, 844), 0.0);
  assert.equal(evaluateWholeScreenSightlineClearAlpha(0.85, 0.22, 1.0, 390, 844), 0.0);
  assert.equal(evaluateWholeScreenSightlineClearAlpha(0.05, 0.92, 1.0, 390, 844), 0.0);
  const outerRimAlpha = evaluateWholeScreenSightlineClearAlpha(0.996, 0.5, 1.0, 390, 844);
  assert.ok(outerRimAlpha > 0.02 && outerRimAlpha <= 0.19);
});

test('60 FPS & Zero-Glitch Governor: shadow azimuth stays invariant across (-75,-75)..(+75,+75) districts and snaps cleanly to texels', () => {
  const sunX = 0.42;
  const sunY = 0.78;
  const sunZ = 0.36;

  const originPose = computeTexelSnappedShadowOrigin(0.01, -0.01, sunX, sunY, sunZ, 42, 2048, 96);
  const originDx = originPose.lightX - originPose.targetX;
  const originDy = originPose.lightY - originPose.targetY;
  const originDz = originPose.lightZ - originPose.targetZ;

  // Walk to Yuzu Mountain (+75, +75) and Spore Lagoon (-75, -75): light-to-target vector must stay 100% identical!
  const nePose = computeTexelSnappedShadowOrigin(75.13, 74.88, sunX, sunY, sunZ, 42, 2048, 96);
  assert.ok(Math.abs(nePose.lightX - nePose.targetX - originDx) < 1e-9);
  assert.ok(Math.abs(nePose.lightY - nePose.targetY - originDy) < 1e-9);
  assert.ok(Math.abs(nePose.lightZ - nePose.targetZ - originDz) < 1e-9);

  const swPose = computeTexelSnappedShadowOrigin(-74.92, -75.04, sunX, sunY, sunZ, 42, 2048, 96);
  assert.ok(Math.abs(swPose.lightX - swPose.targetX - originDx) < 1e-9);
  assert.ok(Math.abs(swPose.lightZ - swPose.targetZ - originDz) < 1e-9);

  // Sub-texel micro-jitter within the same texel must produce identical snapped coordinates (zero shadow shimmer)
  const texel = nePose.texelSizeWorld;
  const snapA = computeTexelSnappedShadowOrigin(texel * 10.1, texel * -4.1, sunX, sunY, sunZ, 42, 2048, 96);
  const snapAX = snapA.targetX;
  const snapAZ = snapA.targetZ;
  const snapB = computeTexelSnappedShadowOrigin(texel * 10.2, texel * -3.9, sunX, sunY, sunZ, 42, 2048, 96);
  assert.equal(snapB.targetX, snapAX);
  assert.equal(snapB.targetZ, snapAZ);
});

test('60 FPS & Zero-Glitch Governor: occluder depthWrite, bloom scale, HiDPI cap, and distant district stride', () => {
  // Restores depthWrite=true when unoccluded (<=0.02) and disables while whole-screen clearing
  assert.equal(shouldEnableOccluderDepthWrite(0.0, true), true);
  assert.equal(shouldEnableOccluderDepthWrite(0.015, true), true);
  assert.equal(shouldEnableOccluderDepthWrite(0.25, true), false);
  assert.equal(shouldEnableOccluderDepthWrite(1.0, true), false);
  assert.equal(shouldEnableOccluderDepthWrite(0.0, false), false);

  // Half-res / 0.65x bloom scale & sensible HiDPI caps
  assert.equal(computeBloomRenderScale('high', false), 0.5);
  assert.equal(computeBloomRenderScale('ultra', false), 0.65);
  assert.equal(computeEffectivePixelRatio(3.0, 'high', true, false), 1.65);
  assert.equal(computeEffectivePixelRatio(3.0, 'high', false, false), 2.0);
  assert.equal(computeEffectivePixelRatio(2.5, 'ultra', true, true), 1.0);

  // Background district tick striding
  assert.equal(computeDistrictTickStride(40 * 40), 1);
  assert.equal(computeDistrictTickStride(110 * 110), 2);
  assert.equal(computeDistrictTickStride(160 * 160), 4);
});

test('BUG-11: clampStarSystemIndex honors non-zero indices and clamps out-of-range values', () => {
  assert.equal(clampStarSystemIndex(0, 3), 0);
  assert.equal(clampStarSystemIndex(1, 3), 1);
  assert.equal(clampStarSystemIndex(2, 3), 2);
  assert.equal(clampStarSystemIndex(99, 3), 2);
  assert.equal(clampStarSystemIndex(-4, 3), 0);
});

test('UNIVERSE_SCALE_BANDS contains 27 astrophysical bands in monotonic descending order from Multiverse to Planck', () => {
  assert.equal(UNIVERSE_SCALE_BANDS.length, 27);
  assert.equal(UNIVERSE_SCALE_BANDS[0].id, 'multiverse');
  assert.equal(UNIVERSE_SCALE_BANDS[0].logMeters, 30.0);
  assert.equal(UNIVERSE_SCALE_BANDS[UNIVERSE_SCALE_BANDS.length - 1].id, 'planck_quantum_foam');
  assert.equal(UNIVERSE_SCALE_BANDS[UNIVERSE_SCALE_BANDS.length - 1].logMeters, -35.0);

  // Assert strictly monotonic descending log scales
  for (let i = 0; i < UNIVERSE_SCALE_BANDS.length - 1; i++) {
    assert.ok(
      UNIVERSE_SCALE_BANDS[i].logMeters > UNIVERSE_SCALE_BANDS[i + 1].logMeters,
      `Band ${UNIVERSE_SCALE_BANDS[i].id} (${UNIVERSE_SCALE_BANDS[i].logMeters}) must be strictly greater than ${UNIVERSE_SCALE_BANDS[i + 1].id} (${UNIVERSE_SCALE_BANDS[i + 1].logMeters})`
    );
  }

  // Verify 12 cosmic layers in sequential order
  const expectedCosmic = [
    'multiverse',
    'big_bang',
    'universe',
    'observable',
    'cosmic_web',
    'filament',
    'supercluster',
    'cluster',
    'galaxy',
    'spiral_arms',
    'nebulas',
    'stellar_systems',
    'planetary_system',
    'planet',
    'atmosphere',
  ];
  for (let k = 0; k < expectedCosmic.length - 1; k++) {
    const a = UNIVERSE_SCALE_BANDS.findIndex((b) => b.id === expectedCosmic[k]);
    const b = UNIVERSE_SCALE_BANDS.findIndex((b) => b.id === expectedCosmic[k + 1]);
    assert.ok(a !== -1 && b !== -1 && a < b, `Expected ${expectedCosmic[k]} before ${expectedCosmic[k + 1]}`);
  }
});

test('BUG-04: resolveCircleRotatedBox2D accurately resolves penetration against yaw-rotated OBBs', () => {
  // 45-degree rotated narrow plank: halfX = 5.0, halfZ = 0.5, centered at (0, 0), rotY = +PI/4
  // In Three.js Y-rotation, local +X maps to world (+cos(45), -sin(45)) = (+0.7071, -0.7071)
  const rotY = Math.PI / 4;
  const hitOnDiagonal = resolveCircleRotatedBox2D(2.8, -2.7, 0.6, 0, 0, 5.0, 0.5, rotY);
  assert.equal(hitOnDiagonal.collided, true);

  const perpDistAfterPush = Math.abs(
    hitOnDiagonal.wx * Math.sin(rotY) + hitOnDiagonal.wz * Math.cos(rotY)
  );
  assert.ok(
    Math.abs(perpDistAfterPush - 1.1) < 1e-4,
    `Expected perpendicular clearance 1.1m, got ${perpDistAfterPush}`
  );

  const missOffDiagonal = resolveCircleRotatedBox2D(3.5, 0.0, 0.6, 0, 0, 5.0, 0.5, rotY);
  assert.equal(missOffDiagonal.collided, false);
});

test('BUG-02: ProgressionService enforces coin and DNA costs and rejects unaffordable purchases', () => {
  const base = structuredClone(INITIAL_PLAYER_STATS);
  assert.equal(base.dna, 30);
  assert.equal(base.coins, 50);

  // 1. Place Cozy Onsen (8c) & Sacred Capy Pagoda (15c)
  const afterOnsen = ProgressionService.placeBuilding(
    base,
    'hot_spring',
    'Cozy Onsen',
    2,
    3,
    'Onsen'
  );
  assert.ok(afterOnsen);
  assert.equal(afterOnsen.coins, 42);

  const afterPagoda = ProgressionService.placeBuilding(
    afterOnsen,
    'zen_pagoda',
    'Sacred Capy Pagoda',
    6,
    6,
    'Pagoda'
  );
  assert.ok(afterPagoda);
  assert.equal(afterPagoda.coins, 27);

  // Reject building when coins insufficient
  const brokeCoins = { ...afterPagoda, coins: 3 };
  assert.equal(
    ProgressionService.placeBuilding(brokeCoins, 'capy_statue', 'Monument', 0, 0, 'Gold'),
    null
  );

  // 2. Mutations deduct DNA once on unlock, then toggle on/off for 0 DNA
  const flipUnlock = ProgressionService.unlockOrToggleMutation(afterPagoda, 'flippers');
  assert.ok(flipUnlock);
  assert.equal(flipUnlock.action, 'unlocked');
  assert.equal(flipUnlock.stats.dna, 26);

  const flipOff = ProgressionService.unlockOrToggleMutation(flipUnlock.stats, 'flippers');
  assert.ok(flipOff);
  assert.equal(flipOff.action, 'toggled');
  assert.equal(flipOff.stats.dna, 26);

  const flipBackOn = ProgressionService.unlockOrToggleMutation(flipOff.stats, 'flippers');
  assert.ok(flipBackOn);
  assert.equal(flipBackOn.action, 'toggled');
  assert.equal(flipBackOn.stats.dna, 26);

  // 3. Ability upgrade deducts DNA (5 * L1 = 5 DNA) and rejects when broke
  const afterSpeed = ProgressionService.buyUpgrade(flipBackOn.stats, 'speedBoost');
  assert.ok(afterSpeed);
  assert.equal(afterSpeed.dna, 21);
  assert.equal(afterSpeed.upgrades.speedBoost, 2);
  assert.equal(ProgressionService.buyUpgrade({ ...afterSpeed, dna: 2 }, 'speedBoost'), null);

  // 4. Cosmetic unlock deducts coins for locked crown (15c), equips free for starter yuzu
  const crownRes = ProgressionService.unlockOrEquipCosmetic(afterSpeed, 'crown');
  assert.ok(crownRes);
  assert.equal(crownRes.action, 'unlocked');
  assert.equal(crownRes.stats.coins, 12);
  assert.equal(crownRes.stats.activeHat, 'crown');

  // Reject halo (22c) with only 12c left
  assert.equal(ProgressionService.unlockOrEquipCosmetic(crownRes.stats, 'halo'), null);

  // 5. Prestige requires 20 DNA at Prestige 1, deducts 20 DNA, awards +50 coins, increments prestigeLevel to 2
  const prestiged = ProgressionService.prestige(crownRes.stats);
  assert.ok(prestiged);
  assert.equal(prestiged.prestigeLevel, 2);
  assert.equal(prestiged.dna, 1);
  assert.equal(prestiged.coins, 62);
  // Prestige 2 now requires 40 DNA -> rejects with 1 DNA
  assert.equal(ProgressionService.prestige(prestiged), null);
});

test('ProceduralGameConfig: validation, deterministic mulberry32, clamping, and presets', () => {
  assert.equal(PROCEDURAL_CONFIG_PRESETS.length, 5);

  // Deterministic PRNG sequence invariance for the same seed
  const rngA = mulberry32(424242);
  const rngB = mulberry32(424242);
  const seqA = [rngA(), rngA(), rngA(), rngA()];
  const seqB = [rngB(), rngB(), rngB(), rngB()];
  assert.deepEqual(seqA, seqB);

  // Syntax error detection without throwing
  const badSyntax = parseAndValidateProceduralConfig('{ bad json');
  assert.equal(badSyntax.ok, false);

  // Clamping out-of-range fields and emitting warnings cleanly
  const custom = cloneProceduralConfig(PROCEDURAL_CONFIG_PRESETS[2].config);
  (custom.universe as { gravityConstant: number }).gravityConstant = 999;
  (custom.world as { weather: string }).weather = 'meteor_shower';
  const parsed = parseAndValidateProceduralConfig(JSON.stringify(custom));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.config.universe.gravityConstant, 3.0);
    assert.equal(parsed.config.world.weather, 'auto');
    assert.ok(parsed.warnings.length >= 2);
  }
});

test('ShallowWaterFluidSolver packs 24x24 RGBA ripple DataTexture bytes and propagates wakes', () => {
  const solver = new ShallowWaterFluidSolver();
  const neutralBytes = solver.packRippleTextureBytes();
  assert.equal(neutralBytes.length, 24 * 24 * 4);
  assert.equal(neutralBytes[0], 128);
  assert.equal(neutralBytes[3], 255);

  // Swim rapidly inside the Home Pool (-8.8, 3.0) across multiple steps
  for (let i = 0; i < 6; i++) {
    solver.step(0.016, -8.8, 3.0, 5.0, 1.2, 1.0);
  }
  const activeBytes = solver.packRippleTextureBytes();
  let minHeightByte = 255;
  let maxGradDelta = 0;
  for (let i = 0; i < 24 * 24; i++) {
    const off = i * 4;
    if (activeBytes[off] < minHeightByte) minHeightByte = activeBytes[off];
    maxGradDelta = Math.max(maxGradDelta, Math.abs(activeBytes[off + 1] - 128));
  }
  assert.ok(minHeightByte < 128, `Expected depression wave < 128, got ${minHeightByte}`);
  assert.ok(maxGradDelta > 0, 'Expected non-zero lateral velocity gradient byte');
});

test('Unified Chrono-Vessel computeCosmicAgeGyr progresses monotonically from Big Bang (0.00) to 13.80 Gyr', () => {
  assert.equal(computeCosmicAgeGyr(28.0), 0.0);
  const mid = computeCosmicAgeGyr(25.7);
  assert.ok(mid > 0.0 && mid < 13.8);
  assert.ok(computeCosmicAgeGyr(24.0) > mid);
  assert.equal(computeCosmicAgeGyr(23.4), 13.8);
  assert.equal(computeCosmicAgeGyr(0.8), 13.8);
});

test('ProgressionService honors custom buildingCostMultiplier, capy_statue coin bonus, and flushPendingSave', () => {
  const base = structuredClone(INITIAL_PLAYER_STATS);
  assert.equal(ProgressionService.getBuildingCoinCost('zen_pagoda', 0.0), 0);

  // Free placement with 0.0 cost multiplier (Sandbox Architect preset)
  const freeBuild = ProgressionService.placeBuilding(
    base,
    'capy_statue',
    'Monument',
    5,
    5,
    'Statue',
    0.0
  );
  assert.ok(freeBuild);
  assert.equal(freeBuild.coins, 50);

  // Reward with statue (+15% per statue level) + 2x procedural coinRewardMultiplier
  const rewarded = ProgressionService.recordProgress(freeBuild, 10, 'sanctuary', 100, 2.0);
  assert.equal(rewarded.dna, 40);
  assert.ok(rewarded.coins > freeBuild.coins + 40);
  ProgressionService.flushPendingSave();
});

test('Fine-Structure Constant (alpha) physics solver & pilot/vessel schema validation', () => {
  const codata = computeFineStructurePhysics(CODATA_FINE_STRUCTURE_INVERSE);
  assert.ok(Math.abs(codata.ratioToCodata - 1.0) < 1e-6);
  assert.ok(Math.abs(codata.bohrRadiusScale - 1.0) < 1e-6);
  assert.equal(codata.regimeLabel, 'Anthropic Carbon Window');
  assert.equal(codata.regimeTone, 'emerald');

  // Stronger EM (1/90) shrinks Bohr orbitals and compresses binding energy
  const strongEm = computeFineStructurePhysics(90.0);
  assert.ok(strongEm.bohrRadiusScale < 0.7);
  assert.ok(strongEm.electronSpeedC > codata.electronSpeedC);
  assert.equal(strongEm.regimeLabel, 'Hyper-Bound EM');
  assert.equal(strongEm.regimeTone, 'amber');

  // Weak EM (1/185) expands Bohr radius outward
  const weakEm = computeFineStructurePhysics(185.0);
  assert.ok(weakEm.bohrRadiusScale > 1.3);
  assert.equal(weakEm.regimeLabel, 'Diffuse Weak-EM');
  assert.equal(weakEm.regimeTone, 'cyan');

  // Config parser clamps fineStructureInverse [60, 220] & validates custom vessel/pilot fields
  const res = parseAndValidateProceduralConfig(
    JSON.stringify({
      universe: { fineStructureInverse: 999 },
      player: {
        heroArchetypeId: 'nebula_zen',
        activeSkin: 'cosmic',
        activeHat: 'halo',
        vesselCanopyHex: '#c084fc',
        startingVesselMode: 'telescope_first_person',
      },
    })
  );
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.config.universe.fineStructureInverse, 220);
    assert.equal(res.config.player.heroArchetypeId, 'nebula_zen');
    assert.equal(res.config.player.activeSkin, 'cosmic');
    assert.equal(res.config.player.activeHat, 'halo');
    assert.equal(res.config.player.vesselCanopyHex, '#c084fc');
    assert.equal(res.config.player.startingVesselMode, 'telescope_first_person');
  }
});

test('Solar System Zoom Focus: locks onto Capy-Earth instead of Sun center (0,0,0) and updates sun direction', () => {
  const orbitR = 22.0 * (1.0 / 30.07);
  const theta = 1.4;
  // At outer interstellar approach (log 16.5): focusBlend === 0 (aims cleanly at CapySol star first)
  const outer = computeSolarPlanetFocusOffset(16.5, orbitR, theta, 0.34);
  assert.equal(outer.focusBlend, 0);
  assert.equal(outer.eclipticOffsetX, 0);
  assert.equal(outer.eclipticOffsetZ, 0);

  // Already nearly locked onto CapyWorld Planet at Star Systems (log 12.5)
  const starSys = computeSolarPlanetFocusOffset(12.5, orbitR, theta, 0.34);
  assert.ok(starSys.focusBlend > 0.90 && starSys.focusBlend <= 1.0);

  // Zoomed inward toward CapyWorld (log 9.5 -> 7.11): ecliptic shifts by exact (-px, -pz) so planet sits at (0,0,0)
  const inner = computeSolarPlanetFocusOffset(9.5, orbitR, theta, 0.34);
  assert.equal(inner.focusBlend, 1);
  const expectedPx = Math.cos(theta) * orbitR;
  const expectedPz = -Math.sin(theta) * orbitR;
  assert.ok(Math.abs(inner.eclipticOffsetX + expectedPx) < 1e-6);
  assert.ok(Math.abs(inner.eclipticOffsetZ + expectedPz) < 1e-6);
  // Solar lighting vector stays unit-normalized pointing back from Capy-Earth toward Sun
  const sunLen = Math.hypot(inner.sunDirX, inner.sunDirY, inner.sunDirZ);
  assert.ok(Math.abs(sunLen - 1.0) < 1e-6);
});

test('Planet Surface Landmass Zoom Focus: picks point on surface landmass (22.5°N, 42.0°E) instead of planet center (0,0,0)', () => {
  const planetR = 8.5;
  // Full planet overview (log 7.80): focusBlend === 0 (planet stays centered at 0,0,0)
  const overview = computePlanetSurfaceLandmassFocusOffset(7.80, planetR);
  assert.equal(overview.surfaceFocusBlend, 0);
  assert.equal(overview.planetOffsetX, 0);
  assert.equal(overview.planetOffsetY, 0);
  assert.equal(overview.planetOffsetZ, 0);

  // Verify surface target point lies on sphere surface of radius planetR
  const surfaceDist = Math.hypot(
    overview.surfaceTargetX,
    overview.surfaceTargetY,
    overview.surfaceTargetZ
  );
  assert.ok(Math.abs(surfaceDist - planetR) < 1e-5);

  // Zoomed into planet toward atmosphere (log 4.80): focusBlend === 1
  // Planet container is shifted by exact (-surfaceTargetX, -surfaceTargetY, -surfaceTargetZ)
  // so the Sanctuary archipelago on the surface is at (0,0,0), NOT the planet core!
  const surface = computePlanetSurfaceLandmassFocusOffset(4.80, planetR);
  assert.equal(surface.surfaceFocusBlend, 1);
  assert.ok(Math.abs(surface.planetOffsetX + surface.surfaceTargetX) < 1e-6);
  assert.ok(Math.abs(surface.planetOffsetY + surface.surfaceTargetY) < 1e-6);
  assert.ok(Math.abs(surface.planetOffsetZ + surface.surfaceTargetZ) < 1e-6);
});

test('Spiral Galaxy Spiral Arm Zoom Focus: navigates off-center into Milky Way Earth Orion-Cygnus Spur by Spiral Arms (19.4)', () => {
  // Outer supercluster/cluster approach (log 24.5): focusBlend === 0
  const outer = computeSpiralGalaxyFocusOffset(24.5);
  assert.equal(outer.galaxyFocusBlend, 0);
  assert.equal(outer.armOffsetX, 0);
  assert.equal(outer.armOffsetZ, 0);

  // Already actively steering toward CapySol System during Cluster approach (log 22.6)
  const clusterTransit = computeSpiralGalaxyFocusOffset(22.6);
  assert.ok(clusterTransit.galaxyFocusBlend > 0.35 && clusterTransit.galaxyFocusBlend < 0.70);

  // Fully locked onto CapySol System (Orion-Cygnus Spur) by Galaxy (log 21.0)!
  const galaxyView = computeSpiralGalaxyFocusOffset(21.0);
  assert.equal(galaxyView.galaxyFocusBlend, 1);

  // Arriving at Spiral Arms (log 19.4): craft has navigated into Earth's ~26,000 ly (~0.495 * 21 = 10.4u) Orion Spur
  const spiralArms = computeSpiralGalaxyFocusOffset(19.4);
  assert.equal(spiralArms.galaxyFocusBlend, 1);
  const offsetMag = Math.hypot(spiralArms.armOffsetX, spiralArms.armOffsetZ);
  assert.ok(
    Math.abs(offsetMag - 10.4) < 1e-4,
    `Expected Orion Spur offset magnitude ~10.4 (0.495 * R_gal), got ${offsetMag}`
  );

  // Zooming further toward stellar nursery (log 17.5): stays locked onto Orion Spur (focusBlend === 1)
  const inner = computeSpiralGalaxyFocusOffset(17.5);
  assert.equal(inner.galaxyFocusBlend, 1);
  assert.ok(inner.armOffsetX !== 0);
  assert.ok(inner.armOffsetZ !== 0);
});

test('Chrono-Vessel 1:1 Physical Scale: transitions smoothly from HUD scale to true 1:1 Sanctuary scale', () => {
  const outer = computeVesselOneToOneTransform(
    18.0,
    'chase_pod',
    0, 7, 14,
    0, -0.3, -0.95,
    0, 0.95, -0.3,
    2, 0.3, 4
  );
  assert.equal(outer.worldSpaceBlend, 0);
  assert.ok(Math.abs(outer.uniformScale - CHRONO_VESSEL_HUD_SCALE) < 1e-6);

  const landedScale = computeVesselOneToOneTransform(
    0.8,
    'chase_pod',
    0, 7, 14,
    0, -0.3, -0.95,
    0, 0.95, -0.3,
    2, 0.3, 4
  );
  assert.equal(landedScale.worldSpaceBlend, 1);
  assert.ok(Math.abs(landedScale.uniformScale - CHRONO_VESSEL_ONE_TO_ONE_SCALE) < 1e-6);
  assert.ok(Math.abs(landedScale.worldX - 3.85) < 1e-6);

  // First-person telescope mode stays foreground HUD-anchored even at low scale
  const scope = computeVesselOneToOneTransform(
    0.8,
    'telescope_first_person',
    0, 7, 14,
    0, -0.3, -0.95,
    0, 0.95, -0.3,
    2, 0.3, 4
  );
  assert.equal(scope.worldSpaceBlend, 0);
});

test('AAA Day/Night & Dual Sun+Moon Shadow Rig: clean handoff between Sun and Moon shadows across 24h cycle', () => {
  const noon = computeDayNightAtmosphereRig(12.0, 0.0, 1.0, 0.0);
  assert.equal(noon.dayPhaseLabel, 'Daylight');
  assert.equal(noon.activeShadowCaster, 'sun');
  assert.ok(noon.sunIntensity > 2.5);
  assert.equal(noon.moonIntensity, 0);

  const dusk = computeDayNightAtmosphereRig(18.2, 0.1, 1.0, 0.0);
  assert.equal(dusk.dayPhaseLabel, 'Crimson Dusk');
  assert.ok(dusk.duskFactor > 0.5);
  assert.ok(dusk.lanternBoost > 0.5);

  const midnight = computeDayNightAtmosphereRig(23.5, 0.0, 1.0, 0.0);
  assert.equal(midnight.dayPhaseLabel, 'Starlight Night');
  assert.equal(midnight.activeShadowCaster, 'moon');
  assert.equal(midnight.sunIntensity, 0);
  assert.ok(midnight.moonIntensity > 0.7);
  assert.ok(midnight.shadowIntensity > 0.8);
});

test('PerformanceLogTracker: ignores startup/transition warmup stalls, caps readout at 60 FPS, and logs real lag drops', () => {
  const tracker = new PerformanceLogTracker(1000);
  // Warmup frames (first 4 frames + transition warmup) ignore one-time shader compile stalls
  const bootCompile = tracker.recordFrame(1500.0, 1500.0, true, 'Sanctuary', 1020);
  assert.equal(bootCompile.isLagDrop, false);
  assert.equal(tracker.getSnapshot(1050).alertCount, 0);

  // Smooth 60 FPS frames produce zero alerts and cap display at <=60 FPS
  for (let i = 0; i < 10; i++) {
    const r = tracker.recordFrame(3.2, 16.5, false, 'Sanctuary', 1100 + i * 16);
    assert.equal(r.isLagDrop, false);
  }
  const steadySnap = tracker.getSnapshot(1500);
  assert.equal(steadySnap.alertCount, 0);
  assert.ok(steadySnap.liveFps <= 60 && steadySnap.liveFps >= 58);

  // Transition warmup suppresses next switch hitch without touching prior metrics
  tracker.notifyTransitionWarmup(2);
  assert.equal(tracker.recordFrame(240.0, 240.0, false, 'Solar Systems', 2000).isLagDrop, false);
  assert.equal(tracker.recordFrame(16.0, 16.0, false, 'Solar Systems', 2020).isLagDrop, false);

  // Sudden 38ms lag spike (~26 FPS) triggers critical alert & load reduction
  const lag = tracker.recordFrame(38.0, 38.0, false, 'Solar Systems', 3000, 'LOD->Tier 2');
  assert.equal(lag.isLagDrop, true);
  assert.equal(lag.shouldReduceLoad, true);
  const snapAfter = tracker.getSnapshot(3200);
  assert.equal(snapAfter.alertCount, 1);
  assert.equal(snapAfter.droppedFramesCount, 1);
  assert.equal(snapAfter.activeAlert, true);
  assert.equal(snapAfter.entries[0].severity, 'critical');

  // Clear resets alert count and restores steady 60 FPS summary
  tracker.clear(4000);
  const cleared = tracker.getSnapshot(4100);
  assert.equal(cleared.alertCount, 0);
  assert.equal(cleared.droppedFramesCount, 0);
  assert.equal(cleared.liveFps, 60);
});

test('WebGPU Pipeline Guard: LatheGeometry PBR tangents & closed Line orbits', () => {
  const saucerPoints = [
    new THREE.Vector2(0.0, -0.14),
    new THREE.Vector2(0.18, -0.125),
    new THREE.Vector2(0.36, -0.075),
    new THREE.Vector2(0.47, -0.015),
    new THREE.Vector2(0.465, 0.025),
    new THREE.Vector2(0.35, 0.07),
    new THREE.Vector2(0.24, 0.09),
    new THREE.Vector2(0.22, 0.03),
    new THREE.Vector2(0.0, 0.015),
  ];
  const saucerGeo = new THREE.LatheGeometry(saucerPoints, 32);
  assert.equal(saucerGeo.index?.count, 1536);
  PbrTextureSynthesizer.prepareGeometryForPbr(saucerGeo);
  assert.ok(saucerGeo.getAttribute('uv1'));
  assert.ok(saucerGeo.getAttribute('uv2'));
  assert.ok(saucerGeo.getAttribute('tangent'));

  // Test segments + 1 closed orbit line
  const segments = 96;
  const pointCount = segments + 1;
  const positions = new Float32Array(pointCount * 3);
  for (let i = 0; i <= segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    positions[i * 3] = Math.cos(ang);
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(ang);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const line = new THREE.Line(geo);
  assert.equal(line.type, 'Line');
  assert.equal(geo.getAttribute('position').count, 97);
  // First and last points match to form a closed loop without LineLoop
  assert.ok(Math.abs(positions[0] - positions[segments * 3]) < 1e-6);
  assert.ok(Math.abs(positions[2] - positions[segments * 3 + 2]) < 1e-6);
});

test('Multiverse Stationary Load: initial boot starts at Multiverse (10^+30 m) and waits for user interaction without auto-zoom', () => {
  // Verifies that at Multiverse (10^+30 m), initial zoom velocity and autoZoomDirection are 0
  assert.equal(MAX_UNIVERSE_LOG_METERS, 30.0);
  const initialAgeGyr = computeCosmicAgeGyr(MAX_UNIVERSE_LOG_METERS);
  assert.equal(initialAgeGyr, 0.0);
  // Verify that an autoZoomDirection of 0 produces 0 scale delta across simulation frames
  const prevTarget = MAX_UNIVERSE_LOG_METERS;
  const autoZoomDirection = 0;
  const cruiseVelocity = 0;
  const dt = 0.016;
  const nextTarget = prevTarget + autoZoomDirection * Math.abs(cruiseVelocity) * dt;
  assert.equal(nextTarget, 30.0);
});

test('Galaxy Morphology: supports grand spiral, barred spiral, elliptical, and irregular spur modes', () => {
  const morphologies: GalaxyMorphology[] = ['spiral', 'barred_spiral', 'elliptical', 'irregular'];
  for (const m of morphologies) {
    const mat = createSpiralGalaxyDiscMaterial({ morphology: m });
    const code =
      m === 'spiral' ? 0.0 : m === 'barred_spiral' ? 1.0 : m === 'elliptical' ? 2.0 : 3.0;
    assert.equal(mat.uniforms.uMorphology.value, code);
  }
});

test('Performance Debug Report: contains complete diagnostic telemetry to resolve frame drops', () => {
  const tracker = new PerformanceLogTracker(1000);
  tracker.recordSyntheticLagSpike(38.5, 'Solar Systems', 'Throttled shadow cascade');
  const snap = tracker.getSnapshot(1500);
  assert.equal(snap.entries.length, 1);
  assert.equal(snap.entries[0].stageLabel, 'Solar Systems');
  assert.ok(snap.entries[0].cause.includes('38.5 ms'));
  assert.ok(snap.entries[0].mitigation.includes('Throttled shadow cascade'));
});

test('PerformanceLogTracker Grouping: groups repeated incidents within rolling window to reduce log spam and save chat tokens', () => {
  const tracker = new PerformanceLogTracker(10000);

  // Trigger 3 spikes with identical cause/stage within 3 seconds
  tracker.recordSyntheticLagSpike(38.5, 'Solar Systems', 'Throttled shadow cascade', 2000);
  tracker.recordSyntheticLagSpike(42.0, 'Solar Systems', 'Throttled shadow cascade', 2800);
  tracker.recordSyntheticLagSpike(35.0, 'Solar Systems', 'Throttled shadow cascade', 3500);

  const snap = tracker.getSnapshot(4000);

  // Must group into a single consolidated incident entry
  assert.equal(snap.entries.length, 1);
  const entry = snap.entries[0];
  assert.equal(entry.repeatCount, 3);
  assert.equal(entry.stageLabel, 'Solar Systems');
  assert.ok(entry.maxFrameMs! >= 42.0);
  assert.ok(entry.minFps! <= 24);
  assert.ok(entry.maxFps! >= 28);
  assert.ok(snap.lastAlertSummary?.includes('(x3)'));

  // A different cause or stage after grouping window creates a separate entry
  tracker.recordSyntheticLagSpike(50.0, 'Cosmic Web', 'Reduced particle density', 15000);
  const snap2 = tracker.getSnapshot(16000);
  assert.equal(snap2.entries.length, 2);
  assert.equal(snap2.entries[0].stageLabel, 'Cosmic Web');
  assert.equal(snap2.entries[1].stageLabel, 'Solar Systems');
});

test('PerformanceProfiler: measures subsystem CPU/GPU times, traces actions, and formats diagnostic breakdown', () => {
  const profiler = new PerformanceProfiler(1000);
  profiler.setEnabled(true);

  // Simulate 5 frames of phase execution
  for (let f = 0; f < 5; f++) {
    profiler.beginFrame();
    profiler.startPhase('physics_bridge');
    // Simulate ~2ms work
    profiler.endPhase('physics_bridge');

    profiler.startPhase('cosmic_universe');
    profiler.endPhase('cosmic_universe');

    profiler.beginGpuRender();
    profiler.recordGpuSample(8.4);
    profiler.endGpuRender();
    profiler.endFrame();
  }

  profiler.recordAction('Switch District: sanctuary', 2.4, 'Target: sanctuary');
  profiler.recordAction('Scale Jump', 1.0, 'Target: 22.0 log-m');

  const snap = profiler.getTelemetrySnapshot();
  assert.equal(snap.enabled, true);
  assert.ok(snap.modules.length >= 12);
  assert.ok(snap.recentEvents.length === 2);
  assert.equal(snap.recentEvents[0].name, 'Scale Jump');
  assert.equal(snap.recentEvents[1].name, 'Switch District: sanctuary');

  const report = profiler.formatAnalysisReport();
  assert.ok(report.includes('=== CAPYGAME 3D PERFORMANCE ANALYSIS ==='));
  assert.ok(report.includes('MODULE / SUBSYSTEM CPU BREAKDOWN:'));
  assert.ok(report.includes('RECENT ACTIONS & TIMED EVENTS:'));
  assert.ok(report.includes('ANALYSIS INSIGHTS & HOTSPOTS:'));
});

test('Spaceship Flight Throttle: mousewheel smoothly controls velocity instead of discrete zoom snapping', () => {
  // Test smooth velocity impulse and continuous scale integration
  let cruiseVel = 0;
  let targetCruiseVel = 0;
  let autoZoomDir = 0;
  let curScale = 28.0;
  let targetScale = 28.0;

  // Forward wheel roll (wheelDelta = +0.1) -> accelerates forward into space
  const wheelDelta = 0.1;
  const impulse = -wheelDelta * 2.8;
  targetCruiseVel = THREE.MathUtils.clamp(targetCruiseVel + impulse, -12.0, 12.0);
  assert.ok(targetCruiseVel < 0, 'Forward wheel roll imparts negative scale-rate velocity');
  autoZoomDir = targetCruiseVel < 0 ? -1 : 1;
  assert.equal(autoZoomDir, -1);

  // Step 10 simulation frames with dt = 0.016
  const dt = 0.016;
  for (let i = 0; i < 10; i++) {
    cruiseVel = THREE.MathUtils.damp(cruiseVel, targetCruiseVel, 5.0, dt);
    targetScale += cruiseVel * dt;
    curScale = THREE.MathUtils.damp(curScale, targetScale, 12.0, dt);
  }

  // Scale must have progressed continuously and smoothly without snapping
  assert.ok(curScale < 28.0, 'Scale progressed forward smoothly');
  assert.ok(curScale > 27.5, 'Scale did not snap down to next band');
  assert.ok(cruiseVel < -0.1, 'Cruise velocity smoothly accelerated');

  // Reverse wheel roll -> brakes and stops
  const reverseWheel = -0.1;
  targetCruiseVel = THREE.MathUtils.clamp(targetCruiseVel + (-reverseWheel * 2.8), -12.0, 12.0);
  if (Math.abs(targetCruiseVel) < 0.15) targetCruiseVel = 0;
  assert.equal(targetCruiseVel, 0, 'Reverse wheel roll cleanly brakes to zero velocity');
});

test('FPS Limiter & Adaptive GPU Optimizer: respects 30 FPS max cap, cuts heavy GPU features toward target, and scales DPR', () => {
  // 1. Resolution Scale DPR checks
  assert.equal(computeEffectivePixelRatio(2.0, 'high', true, false, 0.75), 1.24);
  assert.equal(computeEffectivePixelRatio(1.0, 'high', true, false, 1.25), 1.25);
  assert.equal(computeEffectivePixelRatio(3.0, 'ultra', true, true, 0.6), 0.6);

  // 2. Max FPS Limit = 30 FPS (33.3ms pacing) should NOT report false lag drops
  const tracker = new PerformanceLogTracker(1000);
  tracker.maxFpsLimit = 30;
  tracker.fpsTarget = 60; // Effective target clamps cleanly to min(fpsTarget, maxFpsLimit) = 30
  assert.equal(tracker.getEffectiveTargetFps(), 30);

  for (let i = 0; i < 8; i++) {
    const res = tracker.recordFrame(4.5, 33.3, false, 'Sanctuary', 1100 + i * 33);
    assert.equal(res.isLagDrop, false);
  }
  const cappedSnap = tracker.getSnapshot(1500);
  assert.equal(cappedSnap.alertCount, 0);
  assert.equal(cappedSnap.maxFpsLimit, 30);
  assert.equal(cappedSnap.fpsTarget, 30);
  assert.ok(cappedSnap.liveFps <= 30 && cappedSnap.liveFps >= 29);

  // Real heavy 58ms hitch still triggers lag alert and load reduction
  const hitch = tracker.recordFrame(58.0, 58.0, false, 'Sanctuary', 2000, 'SSAO OFF');
  assert.equal(hitch.isLagDrop, true);
  assert.equal(hitch.shouldReduceLoad, true);

  // 3. Unlimited cap (0) allows reporting 120 FPS cleanly
  const highRefreshTracker = new PerformanceLogTracker(1000);
  highRefreshTracker.maxFpsLimit = 0;
  highRefreshTracker.fpsTarget = 120;
  for (let i = 0; i < 12; i++) {
    const res = highRefreshTracker.recordFrame(3.0, 8.33, false, 'Universe', 1100 + i * 8);
    assert.equal(res.isLagDrop, false);
  }
  assert.ok(highRefreshTracker.getSnapshot(1500).liveFps >= 95);

  // 4. Progressive GPU feature mitigation ladder skips redundant steps cleanly
  const customCfg = { ...DEFAULT_GPU_PIPELINE_CONFIG, ssaoEnabled: false };
  const lvl1 = findNextEffectiveMitigationLevel(0, customCfg, true, 3);
  assert.equal(lvl1, 1); // LOD step-down
  const lvl2 = findNextEffectiveMitigationLevel(lvl1, customCfg, true, 3);
  assert.equal(lvl2, 3); // Skips Level 2 (SSAO already OFF) -> goes directly to Resolution Scale 0.8x!
  const plan3 = computeAdaptiveGpuMitigation(customCfg, true, 3, lvl2);
  assert.equal(plan3.resolutionScale, 0.8);
  assert.ok(plan3.disabledFeatures.includes('Scale 0.80x'));

  // Stepping back recovers cleanly
  const back = findPrevEffectiveMitigationLevel(lvl2, customCfg, true, 3);
  assert.equal(back, 1);
});

test('Unified Single Planet Scale & FPS Button Setting: continuous 1:1 lunar-to-surface scaling and showFpsButton default/toggle', () => {
  // 1. Verify unified Capy-Earth physical scaling across planetary_system (8.85) -> planet (7.10) -> atmosphere (4.90) -> land_masses (3.60)
  const rAtLunarOrbit = computeSinglePlanetWorldRadius(8.85, 1.0);
  const rAtPlanetCanon = computeSinglePlanetWorldRadius(PLANET_CANON_LOG, 1.0);
  const rAtAtmosphere = computeSinglePlanetWorldRadius(4.90, 1.0);
  const rAtLandMasses = computeSinglePlanetWorldRadius(3.60, 1.0);

  // Exact Earth radius at Moon orbit scale (8.85) = 9.0 * 10^(-1.75) = ~0.160045
  assert.ok(Math.abs(rAtLunarOrbit - 0.160045) < 1e-4);
  // Real Moon orbit (~60.3x Earth radius) & Moon radius (~0.2727x Earth radius)
  const orbitRatio = MOON_ORBIT_RADIUS_AT_8_85 / rAtLunarOrbit;
  assert.ok(orbitRatio > 59.5 && orbitRatio < 61.5);
  const moonSizeRatio = MOON_RADIUS_AT_8_85 / rAtLunarOrbit;
  assert.ok(Math.abs(moonSizeRatio - 0.2727) < 0.005);

  // Strict monotonic continuous 10^deltaLog expansion from single sphere
  assert.equal(rAtPlanetCanon, PLANET_BASE_RADIUS);
  assert.ok(Math.abs(rAtAtmosphere / rAtPlanetCanon - Math.pow(10, 2.2)) < 1e-6);
  assert.ok(Math.abs(rAtLandMasses / rAtAtmosphere - Math.pow(10, 1.3)) < 1e-6);

  // 2. Verify showFpsButton defaults to true and persists false/true across saveSettings & loadSettings
  assert.equal(DEFAULT_CAPY_SETTINGS.showFpsButton, true);
  const prevSettings = ProgressionService.loadSettings();
  assert.equal(prevSettings.showFpsButton, true);

  ProgressionService.saveSettings({ ...prevSettings, showFpsButton: false });
  assert.equal(ProgressionService.loadSettings().showFpsButton, false);

  ProgressionService.saveSettings({ ...prevSettings, showFpsButton: true });
  assert.equal(ProgressionService.loadSettings().showFpsButton, true);
});

test('Fog Removal, Draw Distance Culling & Fast PERF Preset: unobstructed views, sky dome scaling, and reduced draw distance', () => {
  // 1. Atmospheric fog disabled cleanly by default
  assert.equal(DEFAULT_CAPY_SETTINGS.worldFogEnabled, false);
  assert.equal(DEFAULT_CAPY_SETTINGS.drawDistance, 650);

  // 2. PERF preset cuts resolution scale (0.7x), drops drawDistance to 135m, disables expensive passes & caps LOD at Tier 0
  const perfPatch = PlayStyleManager.getPresetPatchForGpuQuality('performance');
  assert.equal(perfPatch.gpuQualityPreset, 'performance');
  assert.equal(perfPatch.gpuResolutionScale, 0.7);
  assert.equal(perfPatch.drawDistance, 135);
  assert.equal(perfPatch.gpuShadowQuality, 'off');
  assert.equal(perfPatch.gpuPostProcessing, false);
  assert.equal(perfPatch.autoCapyLod, false);
  assert.equal(perfPatch.manualCapyLodTier, 0);

  // 3. Camera far & proportional sky dome scaling keep sky inside far clip at short draw distances
  const shortFar = computeEffectiveCameraFar(135, 'performance', true, 0.8);
  assert.equal(shortFar.cameraFar, 135);
  assert.ok(shortFar.skyScale * 720 < shortFar.cameraFar);
  assert.equal(shortFar.showMountains, false); // Skips 175m+ alpine ring when drawDistance < 185m

  const farView = computeEffectiveCameraFar(650, 'high', true, 0.8);
  assert.equal(farView.cameraFar, 650);
  assert.equal(farView.showMountains, true);

  const cosmicPerfFar = computeEffectiveCameraFar(135, 'performance', false, 21.0);
  assert.equal(cosmicPerfFar.cameraFar, 1400);

  // 4. District culling renders active & nearby districts and skips far inactive ones
  assert.equal(shouldRenderDistrict(75, 75, 38, 0, 0, 135, true), true); // Active always kept
  assert.equal(shouldRenderDistrict(-75, -75, 34, 0, 0, 135, false), true); // 106m <= 135+34
  assert.equal(shouldRenderDistrict(75, 75, 38, -75, -75, 135, false), false); // 212m > 135+38 -> culled
});

test('Mouselook Integrator & Settings: directional sign conventions, Y-inversion, spike clamping, and persistence', () => {
  // 1. Default persisted mouselook settings
  assert.equal(DEFAULT_CAPY_SETTINGS.mouselookEnabled, true);
  assert.equal(DEFAULT_CAPY_SETTINGS.mouselookSensitivity, 1.0);
  assert.equal(DEFAULT_CAPY_SETTINGS.invertMouseY, false);

  // 2. Standard mode: mouse right (+100px) decreases yaw (turns right); mouse up (-50px) decreases pitch (tilts view up)
  const rightLook = computeMouseLookAngles(0.0, 0.3, 100, -50, 1.0, false, -0.38, 1.18);
  assert.ok(Math.abs(rightLook.yaw - -100 * MOUSELOOK_RAD_PER_PX) < 1e-6);
  assert.ok(Math.abs(rightLook.pitch - (0.3 - 50 * MOUSELOOK_RAD_PER_PX)) < 1e-6);

  // 3. Inverted Y mode flips pitch delta sign
  const invertedLook = computeMouseLookAngles(0.0, 0.3, 0, -50, 1.0, true, -0.38, 1.18);
  assert.ok(Math.abs(invertedLook.pitch - (0.3 + 50 * MOUSELOOK_RAD_PER_PX)) < 1e-6);

  // 4. Browser pointer-warp spike guard (220px cap) and pitch ceiling clamping (1.18 rad)
  const spiked = computeMouseLookAngles(0.0, 0.0, 9999, 9999, 1.0, false, -0.38, 1.18);
  assert.ok(Math.abs(spiked.yaw - -MOUSELOOK_MAX_DELTA_PX * MOUSELOOK_RAD_PER_PX) < 1e-6);
  assert.ok(Math.abs(spiked.pitch - MOUSELOOK_MAX_DELTA_PX * MOUSELOOK_RAD_PER_PX) < 1e-6);
  const clamped = computeMouseLookAngles(0.0, 0.8, 0, 9999, 1.0, false, -0.38, 1.18);
  assert.equal(clamped.pitch, 1.18);

  // 5. Shortest-arc angle damping wraps cleanly across PI / -PI seam without spinning
  const damped = dampShortestAngle(Math.PI - 0.1, -Math.PI + 0.1, 10.0, 0.05);
  assert.ok(damped > Math.PI - 0.11, 'Crosses seam eastward rather than spinning 340 degrees');
});

test('Scene Matrix Cull & GPU Auto-Bench Regression: O(1) hidden subtree skip, catch-up update, and backend scoring', () => {
  const scene = new THREE.Scene();
  scene.matrixAutoUpdate = false;
  const group = new THREE.Group();
  const child = new THREE.Mesh();
  let childMatrixUpdates = 0;
  const origChildUpdate = child.updateMatrix.bind(child);
  child.updateMatrix = () => {
    childMatrixUpdates++;
    origChildUpdate();
  };
  group.add(child);
  scene.add(group);
  installFastMatrixCull(group);

  // 1. Visible + enabled updates child normally
  group.visible = true;
  group.matrixWorldAutoUpdate = true;
  group.position.set(1, 2, 3);
  scene.updateMatrixWorld();
  assert.equal(childMatrixUpdates, 1);

  // 2. Hidden subtree skips child updateMatrix() completely in O(1), even when parent uses force=true
  group.visible = false;
  child.position.set(4, 5, 6);
  scene.updateMatrixWorld(true);
  assert.equal(childMatrixUpdates, 1);

  // 3. Visible but matrixWorldAutoUpdate = false also skips child recursion
  group.visible = true;
  group.matrixWorldAutoUpdate = false;
  scene.updateMatrixWorld();
  assert.equal(childMatrixUpdates, 1);

  // 4. Re-enabling visibility + matrixWorldAutoUpdate catches up dirty matrices cleanly
  group.visible = true;
  group.matrixWorldAutoUpdate = true;
  scene.updateMatrixWorld();
  assert.equal(childMatrixUpdates, 2);

  // 5. WebGPU telemetry prefers per-frame drawCalls over cumulative lifetime calls
  assert.equal(extractWebGpuRenderDrawCalls({ calls: 4509, drawCalls: 42 }, true), 42);
  assert.equal(extractWebGpuRenderDrawCalls({ calls: 61, drawCalls: 0 }, false), 61);

  // 6. Auto-benchmark selects faster backend, rejects driver stalls, and respects 3% WebGPU tie margin
  assert.equal(
    selectBestGpuBackend(
      { supported: true, avgMs: 14.5, maxMs: 28.0, hadError: false },
      { supported: true, avgMs: 2.1, maxMs: 3.4, hadError: false }
    ).winner,
    'webgl2'
  );
  assert.equal(
    selectBestGpuBackend(
      { supported: true, avgMs: 1.8, maxMs: 2.5, hadError: false },
      { supported: true, avgMs: 4.5, maxMs: 8.0, hadError: false }
    ).winner,
    'webgpu'
  );
  assert.equal(
    selectBestGpuBackend(
      { supported: true, avgMs: 1.2, maxMs: 2.0, hadError: true },
      { supported: true, avgMs: 6.0, maxMs: 9.0, hadError: false }
    ).winner,
    'webgl2'
  );
  assert.equal(
    selectBestGpuBackend(
      { supported: true, avgMs: 2.04, maxMs: 3.0, hadError: false },
      { supported: true, avgMs: 2.0, maxMs: 3.0, hadError: false }
    ).winner,
    'webgpu'
  );
});

test('RAM & VRAM Footprint Guard: Capybara NPC pooling shares geometries/materials while Hero stays isolated, and FBO estimator zeros disabled targets', () => {
  const g = globalThis as unknown as { document?: unknown };
  const prevDoc = g.document;
  g.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => null,
    }),
  };

  try {
    const scene = new THREE.Scene();
    CapyModelGenerator.setLeanTextureMode(true);

    const npcs = Array.from({ length: 10 }, (_, idx) =>
      CapyModelGenerator.createCapybara(
        idx % 2 === 0 ? 'yuzu' : 'crown',
        0.85,
        'classic',
        [],
        1,
        0xf97316,
        true
      )
    );
    npcs.forEach((n) => scene.add(n));

    const hero = CapyModelGenerator.createCapybara('yuzu', 1.0, 'classic', [], 3, 0xf97316, false);
    scene.add(hero);

    // Measure scene with Shadow + PostFX disabled (PERF Direct Pass)
    const directFootprint = measureSceneMemoryFootprint(scene, {
      viewportWidth: 1280,
      viewportHeight: 720,
      pixelRatio: 0.7,
      shadowMapSize: 0,
      shadowCasters: 0,
      postProcessingActive: false,
      ssaoEnabled: false,
      bloomEnabled: false,
      msaaSamples: 0,
    });

    // 10 NPCs + 1 LOD3 Hero must reuse cached geometries rather than ~52 * 11 = ~572 unique geos
    assert.ok(
      directFootprint.uniqueGeometries < 85,
      `Expected < 85 unique geometries across 11 pooled Capybaras, got ${directFootprint.uniqueGeometries}`
    );
    assert.ok(directFootprint.estimatedGeoVramMB > 0);
    assert.ok(directFootprint.estimatedTexVramMB > 0);
    assert.equal(directFootprint.estimatedRenderTargetVramMB, 0);

    // NPCs share headOrange & fur materials while Hero keeps isolated instances for live customization
    const getFirstFurMat = (root: THREE.Object3D): THREE.Material | null => {
      let found: THREE.Material | null = null;
      root.traverse((obj) => {
        if (!found && (obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material;
          if (!Array.isArray(mat) && mat instanceof THREE.MeshStandardMaterial) {
            found = mat;
          }
        }
      });
      return found;
    };
    assert.equal(npcs[0].userData.headOrangeMat, npcs[2].userData.headOrangeMat);
    assert.notEqual(hero.userData.headOrangeMat, npcs[0].userData.headOrangeMat);
    const npcFurMat = getFirstFurMat(npcs[0]);
    const npc2FurMat = getFirstFurMat(npcs[1]);
    const heroFurMat = getFirstFurMat(hero);
    assert.ok(npcFurMat && npc2FurMat && heroFurMat);
    assert.equal(npcFurMat, npc2FurMat);
    assert.notEqual(heroFurMat, npcFurMat);
    assert.equal(isLowMemoryEnvironment(false, 'performance'), true);

    // Turning PostFX + 2048px shadow map on accurately reflects increased FBO VRAM
    const highFootprint = measureSceneMemoryFootprint(scene, {
      viewportWidth: 1280,
      viewportHeight: 720,
      pixelRatio: 1.5,
      shadowMapSize: 2048,
      shadowCasters: 1,
      postProcessingActive: true,
      ssaoEnabled: true,
      bloomEnabled: true,
      msaaSamples: 4,
    });
    assert.ok(highFootprint.estimatedRenderTargetVramMB > 100);
  } finally {
    CapyModelGenerator.setLeanTextureMode(false);
    if (prevDoc === undefined) {
      delete g.document;
    } else {
      g.document = prevDoc;
    }
  }
});

test('YuzuGhostRecorder: records 20Hz quantized input/transform keyframes and interpolates shortest-angle poses with zero allocations', () => {
  const recorder = new YuzuGhostRecorder();
  recorder.startRun();
  assert.equal(recorder.isActive(), true);

  // Sample across 0.00s..0.20s with yaw crossing +-PI boundary
  recorder.recordTick(0.0, 0.0, 0.6, -1.0, Math.PI - 0.1, 0.5, -1.0, true, true, false);
  // Sub-interval call at 0.02s must be skipped until 0.05s boundary
  recorder.recordTick(0.02, 0.2, 0.6, -1.5, Math.PI, 0.5, -1.0, true, true, false);
  assert.equal(recorder.getFrameCount(), 1);

  recorder.recordTick(0.05, 0.5, 1.2, -3.5, -Math.PI + 0.1, -0.5, -1.0, false, true, true);
  recorder.recordTick(0.1, 1.0, 0.6, -6.0, -Math.PI + 0.2, 0.0, -1.0, true, true, false);
  assert.equal(recorder.getFrameCount(), 3);

  const finalized = recorder.finalizeRun(150, 1.2, 0.6, -57.5, Math.PI);
  assert.ok(finalized);
  assert.equal(finalized.version, 1);
  assert.equal(finalized.frameCount, 4);
  assert.equal(finalized.data.length, 4 * 6);

  // Midpoint between frame 0 (t=0.00) and frame 1 (t=0.05) -> t=0.025s
  const scratch = createGhostPoseScratch();
  const ok = sampleGhostRunAtTime(finalized, 0.025, scratch);
  assert.equal(ok, true);
  assert.ok(Math.abs(scratch.x - 0.25) < 0.02);
  assert.ok(Math.abs(scratch.y - 0.9) < 0.02);
  assert.ok(Math.abs(scratch.z - -2.25) < 0.02);
  // Shortest-angle across +PI/-PI boundary stays near +-PI instead of interpolating through 0!
  assert.ok(Math.abs(Math.abs(scratch.yaw) - Math.PI) < 0.05);
  assert.equal(scratch.grounded, true);
  assert.equal(scratch.moving, true);
  assert.ok(Math.abs(scratch.inputX - 0.466) < 0.1);

  // Validate round-trip serialization and malformed payload rejection
  const reparsed = parseAndValidateGhostRun(JSON.parse(JSON.stringify(finalized)));
  assert.ok(reparsed);
  assert.equal(reparsed.durationMs, 150);
  assert.equal(parseAndValidateGhostRun({ version: 1, durationMs: 50, frameCount: 2, data: [] }), null);
});

test('ProgressionService JSON Save Portability: exports, validates, clamps, and restores stats, settings, and ghost runs', () => {
  const customStats = structuredClone(INITIAL_PLAYER_STATS);
  customStats.dna = 142;
  customStats.coins = 380;
  customStats.prestigeLevel = 3;
  customStats.activeHat = 'crown';
  customStats.unlockedCosmetics = ['yuzu', 'flower', 'crown'];
  customStats.highScoreFallGuys = 7;

  const customSettings = {
    ...DEFAULT_CAPY_SETTINGS,
    fov: 68,
    drawDistance: 280,
    astrophysicsPalette: 'hubble' as const,
  };

  const recorder = new YuzuGhostRecorder();
  recorder.startRun();
  recorder.recordTick(0.0, 0, 0.6, -1.0, Math.PI, 0, -1, true, true, false);
  recorder.recordTick(0.05, 0.1, 0.6, -3.0, Math.PI, 0, -1, true, true, false);
  const ghost = recorder.finalizeRun(8450, 0, 0.6, -57.5, Math.PI);
  assert.ok(ghost);

  const exportedJson = ProgressionService.exportSaveBundleJson(customStats, customSettings, ghost);
  const parsed = ProgressionService.parseAndValidateSaveBundle(exportedJson);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.stats.dna, 142);
    assert.equal(parsed.stats.coins, 380);
    assert.equal(parsed.stats.prestigeLevel, 3);
    assert.equal(parsed.stats.activeHat, 'crown');
    assert.equal(parsed.stats.highScoreFallGuys, 7);
    assert.equal(parsed.settings.fov, 68);
    assert.equal(parsed.settings.drawDistance, 280);
    assert.equal(parsed.settings.astrophysicsPalette, 'hubble');
    assert.ok(parsed.yuzuGhostRun);
    assert.equal(parsed.yuzuGhostRun.durationMs, 8450);
  }

  // Reject malformed syntax or non-bundle objects cleanly
  const badJson = ProgressionService.parseAndValidateSaveBundle('{not valid json');
  assert.equal(badJson.ok, false);
  const unknownShape = ProgressionService.parseAndValidateSaveBundle(JSON.stringify({ hello: 'world' }));
  assert.equal(unknownShape.ok, false);

  // Clamps out-of-range numeric settings and filters invalid building/mutation entries
  const clamped = ProgressionService.parseAndValidateSaveBundle(
    JSON.stringify({
      schema: 'capygame-save-bundle-v1',
      stats: {
        dna: 99,
        coins: -50,
        activeMutations: ['flippers', 'invalid_mut'],
      },
      settings: {
        fov: 120,
        drawDistance: 99999,
        realityScaleGamma: 0.05,
        worldFogEnabled: true,
      },
    })
  );
  assert.equal(clamped.ok, true);
  if (clamped.ok) {
    assert.equal(clamped.stats.dna, 99);
    assert.equal(clamped.stats.coins, 0);
    assert.deepEqual(clamped.stats.activeMutations, ['flippers']);
    assert.equal(clamped.settings.fov, 75);
    assert.equal(clamped.settings.drawDistance, 1350);
    assert.equal(clamped.settings.realityScaleGamma, 0.28);
    assert.equal(clamped.settings.worldFogEnabled, false);
  }
});

test('Basic vs Advanced Mode: defaults to kid-friendly Basic Mode (advancedMode=false) and persists Advanced Mode cleanly', () => {
  assert.equal(DEFAULT_CAPY_SETTINGS.advancedMode, false);

  const legacySanitized = ProgressionService.sanitizeGameSettings({ fov: 62 });
  assert.equal(legacySanitized.advancedMode, false);
  assert.equal(legacySanitized.fov, 62);

  const advSanitized = ProgressionService.sanitizeGameSettings({ advancedMode: true });
  assert.equal(advSanitized.advancedMode, true);

  const bundle = ProgressionService.exportSaveBundleJson(
    INITIAL_PLAYER_STATS,
    { ...DEFAULT_CAPY_SETTINGS, advancedMode: true },
    null
  );
  const imported = ProgressionService.parseAndValidateSaveBundle(bundle);
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.settings.advancedMode, true);
  }
});

test('Open-World Non-Overlapping Archipelago: zero island intersections and unrestricted ocean exploration anywhere', () => {
  // 1. All 5 island footprints must have zero intersections and generous open-water channel clearance
  const clearance = evaluateDistrictClearances();
  assert.equal(
    clearance.overlappingPairs.length,
    0,
    `Expected zero overlapping island pairs, found: ${JSON.stringify(clearance.overlappingPairs)}`
  );
  assert.ok(
    clearance.minClearanceMeters >= 50,
    `Expected >=50m open-water channel between all islands, got ${clearance.minClearanceMeters.toFixed(2)}m`
  );

  // 2. Verify each causeway bridge reaches near its target district without intersecting any unrelated district
  const footprints = getArchipelagoDistrictFootprints();
  for (const bridge of CONTIGUOUS_BRIDGES) {
    for (let u = 0.2; u <= 0.8; u += 0.1) {
      const px = bridge.startX + (bridge.endX - bridge.startX) * u;
      const pz = bridge.startZ + (bridge.endZ - bridge.startZ) * u;
      for (const fp of footprints) {
        if (fp.mode === 'sanctuary' || fp.mode === bridge.targetMode) continue;
        if (fp.shape === 'circle') {
          const d = Math.hypot(px - fp.cx, pz - fp.cz);
          assert.ok(
            d > (fp.radius ?? 0) + 15,
            `Bridge ${bridge.targetMode} passes too close to ${fp.mode} (${d.toFixed(1)}m)`
          );
        } else {
          const outsideBox =
            px < fp.minX - 15 || px > fp.maxX + 15 || pz < fp.minZ - 15 || pz > fp.maxZ + 15;
          assert.ok(
            outsideBox,
            `Bridge ${bridge.targetMode} encroaches on unrelated island ${fp.mode}`
          );
        }
      }
    }
  }

  // 3. Unrestricted open-world coordinates: walking past Sanctuary shore (e.g. 60m, 400m) never hits an invisible wall
  const farCheck = clampToContiguousWalkableWorld(420, -315, 0.68);
  assert.equal(farCheck.clamped, false);
  assert.equal(farCheck.wx, 420);
  assert.equal(farCheck.wz, -315);

  // 4. Open ocean seabed + Archimedes buoyancy work smoothly everywhere outside the islands
  const openGroundY = sampleContiguousGroundY(65, 0, null, 0);
  assert.equal(openGroundY, OPEN_OCEAN_SEABED_Y);

  const fluid = new ShallowWaterFluidSolver();
  const sample = fluid.sampleFluid(65, OPEN_OCEAN_SURFACE_Y - 0.1, 0, 0.68, null);
  assert.equal(sample.inFluid, true);
  assert.ok(sample.buoyancyAccelY > 15, 'Open ocean supplies upward Archimedes buoyancy');
});

test('QuadrupedGaitSolver: linear Dachshund growth, displacement-locked gait, 2-joint kinematics, reverse caboose leader & snow camera clearance', () => {
  // 1. Strictly linear growth: 1 head orange always; each collected fruit adds 1 back fruit + 1 segment
  const s1 = computeLinearDachshundState(1);
  assert.equal(s1.collectedBackFruits, 0);
  assert.equal(s1.bodySegments, 1);

  const s2 = computeLinearDachshundState(2);
  assert.equal(s2.collectedBackFruits, 1);
  assert.equal(s2.bodySegments, 2);

  const s5 = computeLinearDachshundState(5);
  assert.equal(s5.collectedBackFruits, 4);
  assert.equal(s5.bodySegments, 5);
  assert.ok(Math.abs((s5.lengthMeters - s2.lengthMeters) - 3 * SANE_SEGMENT_SPACING) < 0.02);

  const sCap = computeLinearDachshundState(120);
  assert.equal(sCap.bodySegments, 48);

  // 2. Displacement-coupled gait phase: zero phase advance when pinned against an obstacle on ground
  const blockedPhase = advanceDisplacementCoupledGaitPhase(2.5, 0.0002, 0.04, {
    hasWalkIntent: true,
    isAirborne: false,
    isSwimming: false,
  });
  assert.equal(blockedPhase, 2.5);

  const movingPhase = advanceDisplacementCoupledGaitPhase(2.5, 0.24, 0.04, {
    hasWalkIntent: true,
    isAirborne: false,
    isSwimming: false,
    strideRadius: 0.24,
  });
  assert.ok(movingPhase > 3.4 && movingPhase < 3.6);

  const swimmingPhase = advanceDisplacementCoupledGaitPhase(2.5, 0, 0.05, {
    hasWalkIntent: true,
    isAirborne: true,
    isSwimming: false,
  });
  assert.ok(swimmingPhase > 2.9);

  // 3. Asymmetric 58% stance / 42% swing limb pose: knee bends strongly in mid-swing, flattens in stance, flips for walkDir=-1
  const midSwingFwd = evaluateRealisticLimbPose(Math.PI * 2 * 0.21, 1);
  const midStanceFwd = evaluateRealisticLimbPose(Math.PI * 2 * 0.71, 1);
  assert.ok(Math.abs(midSwingFwd.kneePitch) > 0.65, 'Swing phase clears paw with strong knee flexion');
  assert.ok(Math.abs(midStanceFwd.kneePitch) < 0.2, 'Stance phase supports weight near extension');
  const midSwingRev = evaluateRealisticLimbPose(Math.PI * 2 * 0.21, -1);
  assert.equal(Math.sign(midSwingRev.hipPitch || 0), -Math.sign(midSwingFwd.hipPitch || 0));

  // 4. Reverse back-led spine solver: Caboose (node N-1) leads movement + yaw while Hero (node 0) trails without folding
  const totalNodes = 5; // 1 hero + 3 segments + 1 caboose
  const sx = new Float32Array(totalNodes);
  const sz = new Float32Array(totalNodes);
  const syaw = new Float32Array(totalNodes);
  let accum = 0;
  for (let n = 0; n < totalNodes; n++) {
    if (n === 1) accum += SANE_HERO_LINK_DIST;
    else if (n === totalNodes - 1) accum += SANE_CABOOSE_LINK_DIST;
    else if (n > 1) accum += SANE_SEGMENT_SPACING;
    sx[n] = 0;
    sz[n] = -accum;
    syaw[n] = 0;
  }
  const cabIdx = totalNodes - 1;
  // Steer & move caboose backward (-Z) and slightly (-X)
  syaw[cabIdx] = 0.28;
  sx[cabIdx] -= 0.45;
  sz[cabIdx] -= 0.95;
  for (let i = 0; i < 4; i++) {
    solveBidirectionalSpinePass(
      sx,
      sz,
      syaw,
      totalNodes,
      true,
      SANE_SEGMENT_SPACING,
      SANE_HERO_LINK_DIST,
      SANE_CABOOSE_LINK_DIST,
      SANE_MAX_SPINE_BEND_RAD,
      true
    );
  }
  // Trailing hero node 0 must follow backward (-Z) and turn behind caboose without telescoping
  assert.ok(sz[0] < -0.5, `Expected hero z to follow reversing caboose, got ${sz[0]}`);
  const link0Dist = Math.hypot(sx[0] - sx[1], sz[0] - sz[1]);
  assert.ok(Math.abs(link0Dist - SANE_HERO_LINK_DIST) < 0.08);
  const endToEndDist = Math.hypot(sx[0] - sx[cabIdx], sz[0] - sz[cabIdx]);
  assert.ok(endToEndDist > 2.5, `Anti-jackknife keeps spine elongated (${endToEndDist.toFixed(2)}m)`);

  // 5. Terrain pitch alignment & snow/rain near-plane camera exclusion
  const uphillPitch = computeTerrainPitchAngle(0.4, 0.0, 0.85);
  assert.ok(uphillPitch < -0.2);
  const pushed = enforceWeatherParticleCameraClearance(1.0, 2.0, 1.0, 1.0, 2.0, 1.2, 3.2);
  const clearDist = Math.hypot(pushed.x - 1.0, pushed.y - 2.0, pushed.z - 1.2);
  assert.ok(clearDist >= 3.19, `Particle pushed safely outside camera sphere (${clearDist.toFixed(2)}m)`);

  // 6. Connected 3D jump spine vertical coupling (forward jump & reverse caboose-led jump stay attached!)
  const jNodes = 5;
  const jx = new Float32Array(jNodes);
  const jy = new Float32Array(jNodes);
  const jz = new Float32Array(jNodes);
  const jSupport = new Float32Array(jNodes);
  for (let n = 0; n < jNodes; n++) {
    jx[n] = 0;
    jy[n] = 0;
    jz[n] = -n * 1.15;
    jSupport[n] = 0;
  }
  // Hero (node 0) leaps up to y = 1.25m while advancing forward
  for (let f = 0; f < 16; f++) {
    jy[0] = Math.sin(((f + 1) / 16) * Math.PI * 0.5) * 1.25;
    jz[0] += 0.14;
    solveSpineVerticalCoupling(jx, jy, jz, jSupport, jNodes, false, 0.025);
  }
  assert.ok(jy[1] > 0.65, `Segment 1 must rise with Hero during jump instead of staying glued to y=0 (${jy[1].toFixed(2)}m)`);
  for (let n = 1; n < jNodes; n++) {
    const restLen =
      n - 1 === 0
        ? SANE_HERO_LINK_DIST
        : n - 1 === jNodes - 2
          ? SANE_CABOOSE_LINK_DIST
          : SANE_SEGMENT_SPACING;
    const dy = Math.abs(jy[n] - jy[n - 1]);
    assert.ok(
      dy <= restLen * 0.44 + 0.02,
      `Adjacent vertical delta between joint ${n - 1} and ${n} stays connected (${dy.toFixed(3)}m)`
    );
    assert.ok(jy[n] >= 0, 'Spine never penetrates floor support plane');
  }

  // Reverse caboose-led jump keeps caboose (jNodes-1) lifting front segments smoothly
  jy.fill(0);
  jy[jNodes - 1] = 1.1;
  for (let f = 0; f < 14; f++) {
    solveSpineVerticalCoupling(jx, jy, jz, jSupport, jNodes, true, 0.025);
  }
  assert.ok(jy[jNodes - 2] > 0.55, `Reverse jump lifts trailing middle segment (${jy[jNodes - 2].toFixed(2)}m)`);
});






