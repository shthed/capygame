import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMachineFrontEjectTile,
  computePowerGridSatisfaction,
  computeSplitterPorts,
} from './CapytorioLogisticsMath';

describe('CapytorioLogisticsMath (Pure Grid, Splitter & Power Math)', () => {
  it('computes front eject coordinates accurately for all four cardinal directions', () => {
    // 2x2 drill at (10, 20)
    assert.deepEqual(computeMachineFrontEjectTile(10, 20, 2, 2, 0), {
      targetGx: 10,
      targetGz: 19,
      edgeGx: 10,
      edgeGz: 20,
    });
    assert.deepEqual(computeMachineFrontEjectTile(10, 20, 2, 2, 1), {
      targetGx: 12,
      targetGz: 20,
      edgeGx: 11,
      edgeGz: 20,
    });
    assert.deepEqual(computeMachineFrontEjectTile(10, 20, 2, 2, 2), {
      targetGx: 10,
      targetGz: 22,
      edgeGx: 10,
      edgeGz: 21,
    });
    assert.deepEqual(computeMachineFrontEjectTile(10, 20, 2, 2, 3), {
      targetGx: 9,
      targetGz: 20,
      edgeGx: 10,
      edgeGz: 20,
    });
  });

  it('resolves canonical left/right splitter ports and forward outputs across rotations', () => {
    const north = computeSplitterPorts(4, 8, 0);
    assert.equal(north.leftGx, 4);
    assert.equal(north.rightGx, 5);
    assert.equal(north.leftOutGz, 7);
    assert.equal(north.rightOutGz, 7);

    const south = computeSplitterPorts(4, 8, 2);
    assert.equal(south.leftGx, 5);
    assert.equal(south.rightGx, 4);
    assert.equal(south.leftOutGz, 9);
    assert.equal(south.rightOutGz, 9);

    const east = computeSplitterPorts(4, 8, 1);
    assert.equal(east.leftGz, 8);
    assert.equal(east.rightGz, 9);
    assert.equal(east.leftOutGx, 5);
    assert.equal(east.rightOutGx, 5);
  });

  it('computes clamped power grid satisfaction cleanly', () => {
    assert.equal(computePowerGridSatisfaction(0, 0), 1);
    assert.equal(computePowerGridSatisfaction(900, 450), 1);
    assert.equal(computePowerGridSatisfaction(450, 900), 0.5);
    assert.equal(computePowerGridSatisfaction(-20, 500), 0);
  });
});
