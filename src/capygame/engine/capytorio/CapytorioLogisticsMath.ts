// Pure Deterministic Capytorio Grid, Eject Tile, Splitter Port & Power Satisfaction Math
// Zero Three.js dependencies — 100% unit-testable via node:test

export type CapytorioGridDir = 0 | 1 | 2 | 3; // 0: North (-Z), 1: East (+X), 2: South (+Z), 3: West (-X)

export const CAPYTORIO_DIR_DX: readonly [number, number, number, number] = [0, 1, 0, -1];
export const CAPYTORIO_DIR_DZ: readonly [number, number, number, number] = [-1, 0, 1, 0];

export interface MachineFrontEjectCoords {
  targetGx: number;
  targetGz: number;
  edgeGx: number;
  edgeGz: number;
}

export interface SplitterPortCoords {
  leftGx: number;
  leftGz: number;
  rightGx: number;
  rightGz: number;
  leftOutGx: number;
  leftOutGz: number;
  rightOutGx: number;
  rightOutGz: number;
}

/**
 * Computes the canonical front output/eject tile and edge tile for a rectangular machine footprint.
 */
export function computeMachineFrontEjectTile(
  gx: number,
  gz: number,
  width: number,
  height: number,
  dir: CapytorioGridDir
): MachineFrontEjectCoords {
  const midX = gx + Math.floor((width - 1) * 0.5);
  const midZ = gz + Math.floor((height - 1) * 0.5);
  if (dir === 0) {
    return { targetGx: midX, targetGz: gz - 1, edgeGx: midX, edgeGz: gz };
  }
  if (dir === 1) {
    return { targetGx: gx + width, targetGz: midZ, edgeGx: gx + width - 1, edgeGz: midZ };
  }
  if (dir === 2) {
    return { targetGx: midX, targetGz: gz + height, edgeGx: midX, edgeGz: gz + height - 1 };
  }
  return { targetGx: gx - 1, targetGz: midZ, edgeGx: gx, edgeGz: midZ };
}

/**
 * Returns the canonical Left (side 0) and Right (side 1) sub-tile coordinates of a 2x1 / 1x2 Splitter
 * relative to its forward direction `dir`, plus their corresponding forward exit tiles.
 */
export function computeSplitterPorts(
  gx: number,
  gz: number,
  dir: CapytorioGridDir
): SplitterPortCoords {
  const fwdDx = CAPYTORIO_DIR_DX[dir];
  const fwdDz = CAPYTORIO_DIR_DZ[dir];
  let leftGx = gx;
  let leftGz = gz;
  let rightGx = gx;
  let rightGz = gz;

  if (dir === 0) {
    leftGx = gx;
    leftGz = gz;
    rightGx = gx + 1;
    rightGz = gz;
  } else if (dir === 1) {
    leftGx = gx;
    leftGz = gz;
    rightGx = gx;
    rightGz = gz + 1;
  } else if (dir === 2) {
    leftGx = gx + 1;
    leftGz = gz;
    rightGx = gx;
    rightGz = gz;
  } else {
    leftGx = gx;
    leftGz = gz + 1;
    rightGx = gx;
    rightGz = gz;
  }

  return {
    leftGx,
    leftGz,
    rightGx,
    rightGz,
    leftOutGx: leftGx + fwdDx,
    leftOutGz: leftGz + fwdDz,
    rightOutGx: rightGx + fwdDx,
    rightOutGz: rightGz + fwdDz,
  };
}

/**
 * Computes electrical grid satisfaction ratio clamped to [0, 1].
 * When demand is 0, grid is trivially 100% satisfied (1.0) if any power exists, or 1.0 idle.
 */
export function computePowerGridSatisfaction(supplyKw: number, demandKw: number): number {
  const cleanDemand = Math.max(0, Number.isFinite(demandKw) ? demandKw : 0);
  const cleanSupply = Math.max(0, Number.isFinite(supplyKw) ? supplyKw : 0);
  if (cleanDemand <= 0.0001) return 1.0;
  return Math.max(0, Math.min(1, +(cleanSupply / cleanDemand).toFixed(4)));
}
