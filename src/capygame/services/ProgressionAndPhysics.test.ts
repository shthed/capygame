import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PLAYER_STATS, UNIVERSE_SCALE_BANDS } from '../types';
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
import { ShallowWaterFluidSolver } from '../engine/physics/ContiguousWorldTopology';
import { computeCosmicAgeGyr } from '../engine/SeamlessUniverseSimulator';
import {
  CHRONO_VESSEL_HUD_SCALE,
  CHRONO_VESSEL_ONE_TO_ONE_SCALE,
  PerformanceLogTracker,
  computeBloomRenderScale,
  computeDayNightAtmosphereRig,
  computeDistrictTickStride,
  computeEffectivePixelRatio,
  computeSolarPlanetFocusOffset,
  computeTexelSnappedShadowOrigin,
  computeVesselOneToOneTransform,
  doesSphereBlockPlayerSightline,
  evaluateWholeScreenSightlineClearAlpha,
  shouldEnableOccluderDepthWrite,
} from '../engine/gpu/FramePerformanceGovernor';

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

test('Consolidated UNIVERSE_SCALE_BANDS contains 21 unified logarithmic bands including solar_systems', () => {
  assert.equal(UNIVERSE_SCALE_BANDS.length, 21);
  assert.ok(UNIVERSE_SCALE_BANDS.some((b) => b.id === 'solar_systems'));
  assert.equal(
    UNIVERSE_SCALE_BANDS.some((b) =>
      ['asteroid_clouds', 'gas_giants', 'rocky_planets_moons', 'habitable_planets'].includes(b.id)
    ),
    false
  );
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
  // At outer Heliosphere (log 14.0): focusBlend === 0 (sun stays centered for full solar overview)
  const outer = computeSolarPlanetFocusOffset(14.0, orbitR, theta, 0.34);
  assert.equal(outer.focusBlend, 0);
  assert.equal(outer.eclipticOffsetX, 0);
  assert.equal(outer.eclipticOffsetZ, 0);

  // Zoomed inward toward Capy-Earth (log 9.5 -> 7.11): ecliptic shifts by exact (-px, -pz) so planet sits at (0,0,0)
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

