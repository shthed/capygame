// Pure Deterministic Sanctuary Building Clearance & Golden-Angle Placement Math
// Zero Three.js dependencies — 100% unit-testable via node:test

export interface PlacementCircleObstacle {
  x: number;
  z: number;
  radius: number;
}

export interface SanctuaryBuildingPlacementLike {
  type: string;
  x: number;
  z: number;
}

export interface SanctuaryClearanceContext {
  chronoPadX: number;
  chronoPadZ: number;
  homePool?: { centerX: number; centerZ: number } | null;
  trees: ReadonlyArray<{ x: number; z: number; trunkRadius: number; crownRadius: number }>;
  portals: ReadonlyArray<{ x: number; z: number }>;
  buildings: ReadonlyArray<SanctuaryBuildingPlacementLike>;
}

export function getSanctuaryBuildingRadius(buildingType: string): number {
  return buildingType === 'trampoline_pad' ? 1.65 : 2.05;
}

/**
 * Checks whether a candidate Sanctuary structure footprint at (x, z) is completely clear of
 * the meadow shoreline, Hero spawn, Chrono-Vessel pad, Home Pool, trees, portals, and other buildings.
 */
export function isSanctuarySpotClear(
  ctx: SanctuaryClearanceContext,
  x: number,
  z: number,
  buildingRadius: number = 2.05,
  ignoreBuildingIndex: number = -1
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

  // Stay safely inside meadow shoreline, clear of Hero spawn (0, 4) & Chrono-Vessel Pad
  if (Math.hypot(x, z) > 29.5 - buildingRadius) return false;
  if (Math.hypot(x, z - 4.0) < buildingRadius + 1.8) return false;
  if (Math.hypot(x - ctx.chronoPadX, z - ctx.chronoPadZ) < 3.4 + buildingRadius) return false;

  // Clear of Home Pool + rim boulders + overflow splash apron
  if (ctx.homePool) {
    const dPool = Math.hypot(x - ctx.homePool.centerX, z - ctx.homePool.centerZ);
    if (dPool < 5.45 + buildingRadius) return false;
  }

  // Clear of procedural trees (crown & buttress root clearance)
  for (let t = 0; t < ctx.trees.length; t++) {
    const tree = ctx.trees[t];
    const treeClearance = Math.max(tree.trunkRadius + 1.2, tree.crownRadius * 0.92);
    if (Math.hypot(x - tree.x, z - tree.z) < treeClearance + buildingRadius) {
      return false;
    }
  }

  // Clear of northern portals
  for (let p = 0; p < ctx.portals.length; p++) {
    const portal = ctx.portals[p];
    if (Math.hypot(x - portal.x, z - portal.z) < 2.8 + buildingRadius) {
      return false;
    }
  }

  // Clear of other placed Sanctuary structures
  for (let i = 0; i < ctx.buildings.length; i++) {
    if (i === ignoreBuildingIndex) continue;
    const other = ctx.buildings[i];
    const otherR = getSanctuaryBuildingRadius(other.type);
    if (Math.hypot(x - other.x, z - other.z) < otherR + buildingRadius + 0.45) {
      return false;
    }
  }

  return true;
}

/**
 * Deterministically finds a non-overlapping Sanctuary spot using a golden-angle spiral.
 */
export function findClearSanctuarySpot(
  ctx: SanctuaryClearanceContext,
  preferredIdx: number = 0,
  buildingRadius: number = 2.05,
  ignoreBuildingIndex: number = -1,
  angleOffset: number = 0.42
): { x: number; z: number } {
  for (let step = 0; step < 260; step++) {
    const k = preferredIdx + step;
    const radius = 6.8 + (step / 260) * 21.5;
    const angle = k * 2.39996 + angleOffset;
    const cx = +(Math.cos(angle) * radius).toFixed(2);
    const cz = +(Math.sin(angle) * radius).toFixed(2);
    if (isSanctuarySpotClear(ctx, cx, cz, buildingRadius, ignoreBuildingIndex)) {
      return { x: cx, z: cz };
    }
  }
  return { x: 18.5, z: 14.5 };
}
