/**
 * Pure, zero-allocation 2D surface collision math for preventing the player
 * capybara from clipping through the parked UFO and solid factory/sanctuary buildings.
 *
 * Intentionally free of Three.js and Capytorio chunk imports so it stays in the
 * lightweight shared core without pulling feature chunks into cold boot.
 */

export const HERO_COLLISION_RADIUS = 0.68;
export const UFO_HULL_COLLISION_RADIUS = 2.05;
export const UFO_TOUCH_MARGIN = 0.62;
/**
 * Maximum center-to-center distance at which the player capybara is physically touching
 * or right up against the parked UFO's saucer rim (2.05 + 0.68 + 0.62 = 3.35 m).
 */
export const UFO_TOUCH_BOARDING_RADIUS =
  HERO_COLLISION_RADIUS + UFO_HULL_COLLISION_RADIUS + UFO_TOUCH_MARGIN;

export const CAPYTORIO_TILE_SIZE_METERS = 2.5;
export const CAPYTORIO_BUILDING_COLLISION_INSET = 0.14;

export interface CirclePushScratch {
  x: number;
  z: number;
  hit: boolean;
  nx: number;
  nz: number;
}

export interface Aabb2DScratch {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export function createCirclePushScratch(): CirclePushScratch {
  return { x: 0, z: 0, hit: false, nx: 0, nz: 0 };
}

export function createAabb2DScratch(): Aabb2DScratch {
  return { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
}

/**
 * Resolves overlap between a movable circle (cx, cz, cRadius) and a static circle (ox, oz, oRadius).
 * Writes the resolved center and outward normal into `out` with zero heap allocations.
 */
export function resolveCircleCirclePush(
  cx: number,
  cz: number,
  cRadius: number,
  ox: number,
  oz: number,
  oRadius: number,
  out: CirclePushScratch
): boolean {
  let dx = cx - ox;
  let dz = cz - oz;
  const minSep = cRadius + oRadius;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minSep * minSep) {
    out.x = cx;
    out.z = cz;
    out.hit = false;
    out.nx = 0;
    out.nz = 0;
    return false;
  }

  let dist = Math.sqrt(distSq);
  if (dist < 1e-5) {
    dx = 1;
    dz = 0;
    dist = 1;
  }
  const nx = dx / dist;
  const nz = dz / dist;
  out.x = ox + nx * minSep;
  out.z = oz + nz * minSep;
  out.hit = true;
  out.nx = nx;
  out.nz = nz;
  return true;
}

/**
 * Resolves overlap between a movable circle (cx, cz, cRadius) and a static axis-aligned box.
 * Handles both shallow edge/corner collisions and deep-interior escape cleanly.
 */
export function resolveCircleAabbPush(
  cx: number,
  cz: number,
  cRadius: number,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  out: CirclePushScratch
): boolean {
  const closestX = cx < minX ? minX : cx > maxX ? maxX : cx;
  const closestZ = cz < minZ ? minZ : cz > maxZ ? maxZ : cz;
  const dx = cx - closestX;
  const dz = cz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= cRadius * cRadius) {
    out.x = cx;
    out.z = cz;
    out.hit = false;
    out.nx = 0;
    out.nz = 0;
    return false;
  }

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const nz = dz / dist;
    out.x = closestX + nx * cRadius;
    out.z = closestZ + nz * cRadius;
    out.hit = true;
    out.nx = nx;
    out.nz = nz;
    return true;
  }

  // Center is inside or directly on the box boundary: push out through the nearest face
  const distLeft = cx - minX;
  const distRight = maxX - cx;
  const distTop = cz - minZ;
  const distBottom = maxZ - cz;

  if (distLeft <= distRight && distLeft <= distTop && distLeft <= distBottom) {
    out.x = minX - cRadius;
    out.z = cz;
    out.nx = -1;
    out.nz = 0;
  } else if (distRight <= distTop && distRight <= distBottom) {
    out.x = maxX + cRadius;
    out.z = cz;
    out.nx = 1;
    out.nz = 0;
  } else if (distTop <= distBottom) {
    out.x = cx;
    out.z = minZ - cRadius;
    out.nx = 0;
    out.nz = -1;
  } else {
    out.x = cx;
    out.z = maxZ + cRadius;
    out.nx = 0;
    out.nz = 1;
  }
  out.hit = true;
  return true;
}

/**
 * Transport belts stay flat and walkable so Factorio-style conveyor riding works;
 * all other Capytorio buildings and structures are solid colliders.
 */
export function isCapytorioMachineSolid(machineType: string): boolean {
  return machineType !== 'belt';
}

/**
 * Computes the world-space AABB for a Capytorio machine occupying [gx, gx + width - 1]
 * x [gz, gz + height - 1] in grid coordinates, writing directly into `out`.
 */
export function computeCapytorioMachineWorldAabb(
  originX: number,
  originZ: number,
  gx: number,
  gz: number,
  widthTiles: number,
  heightTiles: number,
  out: Aabb2DScratch,
  inset: number = CAPYTORIO_BUILDING_COLLISION_INSET
): Aabb2DScratch {
  const halfTile = CAPYTORIO_TILE_SIZE_METERS * 0.5;
  const rawMinX = originX + gx * CAPYTORIO_TILE_SIZE_METERS - halfTile;
  const rawMaxX = rawMinX + Math.max(1, widthTiles) * CAPYTORIO_TILE_SIZE_METERS;
  const rawMinZ = originZ + gz * CAPYTORIO_TILE_SIZE_METERS - halfTile;
  const rawMaxZ = rawMinZ + Math.max(1, heightTiles) * CAPYTORIO_TILE_SIZE_METERS;

  const safeInsetX = Math.min(inset, (rawMaxX - rawMinX) * 0.25);
  const safeInsetZ = Math.min(inset, (rawMaxZ - rawMinZ) * 0.25);

  out.minX = rawMinX + safeInsetX;
  out.maxX = rawMaxX - safeInsetX;
  out.minZ = rawMinZ + safeInsetZ;
  out.maxZ = rawMaxZ - safeInsetZ;
  return out;
}

/**
 * Returns true strictly when the hero capybara is touching / right up against the parked UFO hull.
 */
export function isTouchingParkedUfo(
  heroX: number,
  heroZ: number,
  padX: number,
  padZ: number,
  touchRadius: number = UFO_TOUCH_BOARDING_RADIUS
): boolean {
  const dx = heroX - padX;
  const dz = heroZ - padZ;
  return dx * dx + dz * dz <= touchRadius * touchRadius;
}
