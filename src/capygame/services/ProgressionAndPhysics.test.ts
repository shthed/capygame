import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PLAYER_STATS, UNIVERSE_SCALE_BANDS } from '../types';
import { ProgressionService } from './ProgressionService';
import {
  clampStarSystemIndex,
  resolveCircleRotatedBox2D,
} from '../engine/physics/ColliderMath';

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
