import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SanctuaryClearanceContext,
  findClearSanctuarySpot,
  getSanctuaryBuildingRadius,
  isSanctuarySpotClear,
} from './ForestPlacementMath';

describe('ForestPlacementMath (Pure Sanctuary Building Clearance)', () => {
  const baseCtx: SanctuaryClearanceContext = {
    chronoPadX: 12,
    chronoPadZ: -10,
    homePool: { centerX: -8.8, centerZ: 3.0 },
    trees: [{ x: 6, z: 6, trunkRadius: 0.9, crownRadius: 3.2 }],
    portals: [{ x: 0, z: -20 }],
    buildings: [{ type: 'hot_spring', x: -14.8, z: 11.6 }],
  };

  it('rejects spots colliding with hero spawn, chrono pad, pool, trees, portals, or shoreline', () => {
    assert.equal(isSanctuarySpotClear(baseCtx, 0, 4.0), false);
    assert.equal(isSanctuarySpotClear(baseCtx, 12, -10), false);
    assert.equal(isSanctuarySpotClear(baseCtx, -8.8, 3.0), false);
    assert.equal(isSanctuarySpotClear(baseCtx, 6, 6), false);
    assert.equal(isSanctuarySpotClear(baseCtx, 0, -20), false);
    assert.equal(isSanctuarySpotClear(baseCtx, 29, 0), false);
    assert.equal(isSanctuarySpotClear(baseCtx, Number.NaN, 0), false);
  });

  it('respects ignoreBuildingIndex when validating an existing structure in place', () => {
    assert.equal(isSanctuarySpotClear(baseCtx, -14.8, 11.6, 2.05, -1), false);
    assert.equal(isSanctuarySpotClear(baseCtx, -14.8, 11.6, 2.05, 0), true);
  });

  it('finds a valid non-overlapping clear spot via golden-angle spiral', () => {
    const spot = findClearSanctuarySpot(baseCtx, 0);
    assert.equal(isSanctuarySpotClear(baseCtx, spot.x, spot.z), true);
    assert.equal(getSanctuaryBuildingRadius('trampoline_pad'), 1.65);
    assert.equal(getSanctuaryBuildingRadius('zen_pagoda'), 2.05);
  });
});
