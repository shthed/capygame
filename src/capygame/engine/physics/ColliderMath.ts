export interface RotatedBoxCollisionResult {
  collided: boolean;
  wx: number;
  wz: number;
  nx: number;
  nz: number;
}

const _defaultObbOut: RotatedBoxCollisionResult = {
  collided: false,
  wx: 0,
  wz: 0,
  nx: 0,
  nz: 0,
};

/**
 * Zero-allocation 2D circle vs yaw-rotated Oriented Bounding Box (OBB) projection.
 * Transforms circle center into box-local coordinates by -rotY, clamps to [-halfX, halfX] x [-halfZ, halfZ],
 * resolves penetration if closer than radius, and rotates pushback normal back into world space.
 */
export function resolveCircleRotatedBox2D(
  wx: number,
  wz: number,
  radius: number,
  boxWx: number,
  boxWz: number,
  halfX: number,
  halfZ: number,
  rotY: number = 0,
  out: RotatedBoxCollisionResult = _defaultObbOut
): RotatedBoxCollisionResult {
  const relX = wx - boxWx;
  const relZ = wz - boxWz;

  const cosY = rotY === 0 ? 1 : Math.cos(rotY);
  const sinY = rotY === 0 ? 0 : Math.sin(rotY);

  // Transform world delta into box-local space (inverse Three.js Y-rotation)
  const localX = relX * cosY - relZ * sinY;
  const localZ = relX * sinY + relZ * cosY;

  const clampX = Math.max(-halfX, Math.min(halfX, localX));
  const clampZ = Math.max(-halfZ, Math.min(halfZ, localZ));

  const dxL = localX - clampX;
  const dzL = localZ - clampZ;
  const distSq = dxL * dxL + dzL * dzL;

  if (distSq >= radius * radius) {
    out.collided = false;
    out.wx = wx;
    out.wz = wz;
    out.nx = 0;
    out.nz = 0;
    return out;
  }

  let localNx = 0;
  let localNz = 0;
  let pushedLocalX = clampX;
  let pushedLocalZ = clampZ;

  if (distSq > 1e-10) {
    const dist = Math.sqrt(distSq);
    localNx = dxL / dist;
    localNz = dzL / dist;
    pushedLocalX = clampX + localNx * radius;
    pushedLocalZ = clampZ + localNz * radius;
  } else {
    // Circle center is inside OBB: push out along shallowest axis
    const penX = halfX - Math.abs(localX);
    const penZ = halfZ - Math.abs(localZ);
    if (penX <= penZ) {
      localNx = localX >= 0 ? 1 : -1;
      localNz = 0;
      pushedLocalX = localNx * (halfX + radius);
      pushedLocalZ = localZ;
    } else {
      localNx = 0;
      localNz = localZ >= 0 ? 1 : -1;
      pushedLocalX = localX;
      pushedLocalZ = localNz * (halfZ + radius);
    }
  }

  // Rotate local pushed position and normal back into world space (+rotY)
  out.collided = true;
  out.wx = boxWx + pushedLocalX * cosY + pushedLocalZ * sinY;
  out.wz = boxWz - pushedLocalX * sinY + pushedLocalZ * cosY;
  out.nx = localNx * cosY + localNz * sinY;
  out.nz = -localNx * sinY + localNz * cosY;
  return out;
}

/**
 * Clamps a requested star-system index into [0, starCount - 1].
 */
export function clampStarSystemIndex(index: number, starCount: number): number {
  if (starCount <= 0 || !Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(starCount - 1, Math.trunc(index)));
}
