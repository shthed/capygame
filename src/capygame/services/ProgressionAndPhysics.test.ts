import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PLAYER_STATS, UNIVERSE_SCALE_BANDS } from '../types';
import { ProgressionService } from './ProgressionService';
import {
  clampStarSystemIndex,
  resolveCircleRotatedBox2D,
} from '../engine/physics/ColliderMath';
import {
  computeBloomRenderScale,
  computeDistrictTickStride,
  computeEffectivePixelRatio,
  computeTexelSnappedShadowOrigin,
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
  // Point at world (3.0, 3.0): along local Z axis (perpendicular to the plank!), far outside halfZ = 0.5
  // Note: An unrotated AABB check [-5, 5] x [-0.5, 0.5] would miss (3.0, -3.0) along the plank diagonal,
  // whereas at (2.8, -2.8) (which IS right on the rotated plank centerline: localX ~ 3.96 <= 5.0, localZ ~ 0.0!),
  // a circle of radius 0.6 MUST collide and be pushed perpendicular to the 45-deg plank!
  const hitOnDiagonal = resolveCircleRotatedBox2D(2.8, -2.7, 0.6, 0, 0, 5.0, 0.5, rotY);
  assert.equal(hitOnDiagonal.collided, true);

  // Verify pushed point is now >= 0.5 + 0.6 = 1.1m perpendicular to the plank centerline (x + z = 0)
  const perpDistAfterPush = Math.abs(
    hitOnDiagonal.wx * Math.sin(rotY) + hitOnDiagonal.wz * Math.cos(rotY)
  );
  assert.ok(
    Math.abs(perpDistAfterPush - 1.1) < 1e-4,
    `Expected perpendicular clearance 1.1m, got ${perpDistAfterPush}`
  );

  // Conversely, at (3.5, 0.0) an unrotated [-5, 5] x [-0.5, 0.5] AABB would collide,
  // whereas for the 45-deg rotated plank: localX = 2.47, localZ = 2.47 > halfZ (0.5) + radius (0.6) -> NO collision!
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
