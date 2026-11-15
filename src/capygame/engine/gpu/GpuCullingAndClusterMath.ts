/**
 * Pure, zero-allocation CPU & WebGPU-mirrored math kernels for:
 * 1. Indirect draw batch descriptor packing & bounding-sphere frustum culling
 * 2. 16x9x24 Clustered Forward+ view-frustum light binning
 * 3. 128x128 Shallow-Water WGSL grid coordinate & step parameters
 * 4. Screen-space volumetric sun/moon crepuscular light-shaft projection
 */

export const CLUSTER_GRID_X = 16;
export const CLUSTER_GRID_Y = 9;
export const CLUSTER_GRID_Z = 24;
export const TOTAL_FRUSTUM_CLUSTERS = CLUSTER_GRID_X * CLUSTER_GRID_Y * CLUSTER_GRID_Z; // 3456
export const MAX_CLUSTERED_LIGHTS = 32;

export const GPU_WATER_GRID_SIZE = 128;
export const GPU_WATER_WORKGROUP_SIZE = 8;
export const GPU_WATER_CELL_COUNT = GPU_WATER_GRID_SIZE * GPU_WATER_GRID_SIZE; // 16384

export interface FrustumPlane6 {
  nx: number;
  ny: number;
  nz: number;
  d: number;
}

export interface IndirectDrawBatchSpec {
  indexCount: number;
  instanceCount: number;
  firstIndex: number;
  baseVertex: number;
  firstInstance: number;
}

export interface ClusteredLightEmitter {
  wx: number;
  wy: number;
  wz: number;
  radius: number;
  r: number;
  g: number;
  b: number;
  intensity: number;
}

export interface VolumetricShaftProjection {
  uvX: number;
  uvY: number;
  strength: number;
  facingSun: number;
}

/**
 * Extracts 6 normalized frustum planes (Left, Right, Bottom, Top, Near, Far)
 * from a column-major 4x4 projection * view matrix (`pvElements`, length 16)
 * into a pre-allocated array of 6 FrustumPlane6 objects. Zero allocations.
 */
export function extractFrustumPlanesInto(
  pvElements: ArrayLike<number>,
  outPlanes: FrustumPlane6[]
): void {
  const m0 = pvElements[0], m1 = pvElements[1], m2 = pvElements[2], m3 = pvElements[3];
  const m4 = pvElements[4], m5 = pvElements[5], m6 = pvElements[6], m7 = pvElements[7];
  const m8 = pvElements[8], m9 = pvElements[9], m10 = pvElements[10], m11 = pvElements[11];
  const m12 = pvElements[12], m13 = pvElements[13], m14 = pvElements[14], m15 = pvElements[15];

  const writePlane = (idx: number, a: number, b: number, c: number, d: number) => {
    const len = Math.hypot(a, b, c) || 1;
    const inv = 1 / len;
    const p = outPlanes[idx];
    p.nx = a * inv;
    p.ny = b * inv;
    p.nz = c * inv;
    p.d = d * inv;
  };

  // Left, Right, Bottom, Top, Near, Far
  writePlane(0, m3 + m0, m7 + m4, m11 + m8, m15 + m12);
  writePlane(1, m3 - m0, m7 - m4, m11 - m8, m15 - m12);
  writePlane(2, m3 + m1, m7 + m5, m11 + m9, m15 + m13);
  writePlane(3, m3 - m1, m7 - m5, m11 - m9, m15 - m13);
  writePlane(4, m3 + m2, m7 + m6, m11 + m10, m15 + m14);
  writePlane(5, m3 - m2, m7 - m6, m11 - m10, m15 - m14);
}

/**
 * Bounding-sphere frustum & distance-horizon occlusion test matching WGSL indirect culling pass.
 */
export function evaluateBoundingSphereVisibility(
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  camX: number,
  camY: number,
  camZ: number,
  maxDrawDistance: number,
  planes: readonly FrustumPlane6[]
): boolean {
  const dx = cx - camX;
  const dy = cy - camY;
  const dz = cz - camZ;
  const maxR = maxDrawDistance + radius;
  if (dx * dx + dy * dy + dz * dz > maxR * maxR) {
    return false;
  }
  for (let i = 0; i < 6; i++) {
    const p = planes[i];
    if (p.nx * cx + p.ny * cy + p.nz * cz + p.d < -radius) {
      return false;
    }
  }
  return true;
}

/**
 * Packs draw-indexed-indirect command arguments (5 uint32 words per batch)
 * into a pre-allocated Uint32Array for WebGPU `drawIndexedIndirect` or CPU parity checks.
 */
export function packIndirectDrawBuffer(
  batches: readonly IndirectDrawBatchSpec[],
  visibilityFlags: ArrayLike<number>,
  outBuffer: Uint32Array
): number {
  let visibleCount = 0;
  const count = Math.min(batches.length, Math.floor(outBuffer.length / 5));
  for (let i = 0; i < count; i++) {
    const b = batches[i];
    const vis = visibilityFlags[i] ? 1 : 0;
    const off = i * 5;
    outBuffer[off] = b.indexCount >>> 0;
    outBuffer[off + 1] = vis ? (b.instanceCount >>> 0) : 0;
    outBuffer[off + 2] = b.firstIndex >>> 0;
    outBuffer[off + 3] = b.baseVertex >>> 0;
    outBuffer[off + 4] = b.firstInstance >>> 0;
    if (vis) visibleCount++;
  }
  return visibleCount;
}

/**
 * Maps linear view-space depth [near, far] into exponential Z-slice index [0, CLUSTER_GRID_Z - 1].
 */
export function computeClusterDepthSlice(
  viewDepth: number,
  nearPlane: number,
  farPlane: number
): number {
  const safeNear = Math.max(0.01, nearPlane);
  const safeFar = Math.max(safeNear + 1.0, farPlane);
  if (viewDepth <= safeNear) return 0;
  if (viewDepth >= safeFar) return CLUSTER_GRID_Z - 1;
  const logRatio = Math.log(safeFar / safeNear);
  const t = Math.log(viewDepth / safeNear) / logRatio;
  return Math.max(0, Math.min(CLUSTER_GRID_Z - 1, Math.floor(t * CLUSTER_GRID_Z)));
}

/**
 * Assigns an emitter light to overlapping 16x9x24 view-frustum clusters into a pre-allocated
 * Uint32Array (one count per cluster) without allocations. Returns total cluster-light links.
 */
export function binLightsIntoFrustumClusters(
  lights: readonly ClusteredLightEmitter[],
  viewMatrixElements: ArrayLike<number>,
  fovDeg: number,
  aspect: number,
  nearPlane: number,
  farPlane: number,
  outClusterCounts: Uint32Array
): number {
  outClusterCounts.fill(0);
  const lightCount = Math.min(lights.length, MAX_CLUSTERED_LIGHTS);
  if (lightCount === 0) return 0;

  const tanHalfY = Math.tan(((fovDeg * Math.PI) / 180) * 0.5);
  const tanHalfX = tanHalfY * Math.max(0.4, aspect);

  let totalAssignments = 0;
  for (let l = 0; l < lightCount; l++) {
    const light = lights[l];
    // Transform world center into view space (-Z forward in Three.js)
    const vx =
      viewMatrixElements[0] * light.wx +
      viewMatrixElements[4] * light.wy +
      viewMatrixElements[8] * light.wz +
      viewMatrixElements[12];
    const vy =
      viewMatrixElements[1] * light.wx +
      viewMatrixElements[5] * light.wy +
      viewMatrixElements[9] * light.wz +
      viewMatrixElements[13];
    const vz =
      viewMatrixElements[2] * light.wx +
      viewMatrixElements[6] * light.wy +
      viewMatrixElements[10] * light.wz +
      viewMatrixElements[14];

    const viewDepth = -vz;
    if (viewDepth + light.radius < nearPlane || viewDepth - light.radius > farPlane) {
      continue;
    }

    const minDepth = Math.max(nearPlane, viewDepth - light.radius);
    const maxDepth = Math.min(farPlane, viewDepth + light.radius);
    const zMin = computeClusterDepthSlice(minDepth, nearPlane, farPlane);
    const zMax = computeClusterDepthSlice(maxDepth, nearPlane, farPlane);

    const refDepth = Math.max(nearPlane, viewDepth);
    const halfW = refDepth * tanHalfX;
    const halfH = refDepth * tanHalfY;
    const normMinX = (vx - light.radius) / halfW;
    const normMaxX = (vx + light.radius) / halfW;
    const normMinY = (vy - light.radius) / halfH;
    const normMaxY = (vy + light.radius) / halfH;

    const xMin = Math.max(0, Math.min(CLUSTER_GRID_X - 1, Math.floor((normMinX * 0.5 + 0.5) * CLUSTER_GRID_X)));
    const xMax = Math.max(0, Math.min(CLUSTER_GRID_X - 1, Math.floor((normMaxX * 0.5 + 0.5) * CLUSTER_GRID_X)));
    const yMin = Math.max(0, Math.min(CLUSTER_GRID_Y - 1, Math.floor((normMinY * 0.5 + 0.5) * CLUSTER_GRID_Y)));
    const yMax = Math.max(0, Math.min(CLUSTER_GRID_Y - 1, Math.floor((normMaxY * 0.5 + 0.5) * CLUSTER_GRID_Y)));

    for (let z = zMin; z <= zMax; z++) {
      const zOff = z * (CLUSTER_GRID_X * CLUSTER_GRID_Y);
      for (let y = yMin; y <= yMax; y++) {
        const yOff = zOff + y * CLUSTER_GRID_X;
        for (let x = xMin; x <= xMax; x++) {
          const cIdx = yOff + x;
          if (outClusterCounts[cIdx] < MAX_CLUSTERED_LIGHTS) {
            outClusterCounts[cIdx]++;
            totalAssignments++;
          }
        }
      }
    }
  }
  return totalAssignments;
}

/**
 * Projects sun/moon direction in world space into screen UV [0..1] + angular strength
 * for volumetric crepuscular light shafts without per-frame heap allocations.
 */
export function computeVolumetricSunShaftProjection(
  dirX: number,
  dirY: number,
  dirZ: number,
  pvMatrixElements: ArrayLike<number>,
  camForwardX: number,
  camForwardY: number,
  camForwardZ: number,
  nightFactor: number,
  cloudCover: number,
  out: VolumetricShaftProjection
): VolumetricShaftProjection {
  const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
  const nx = dirX / dirLen;
  const ny = dirY / dirLen;
  const nz = dirZ / dirLen;

  const facing = nx * camForwardX + ny * camForwardY + nz * camForwardZ;
  out.facingSun = facing;

  // Project distant sky vector along active sun/moon azimuth into clip space
  const farDist = 420.0;
  const sx = nx * farDist;
  const sy = ny * farDist;
  const sz = nz * farDist;

  const clipX = pvMatrixElements[0] * sx + pvMatrixElements[4] * sy + pvMatrixElements[8] * sz + pvMatrixElements[12];
  const clipY = pvMatrixElements[1] * sx + pvMatrixElements[5] * sy + pvMatrixElements[9] * sz + pvMatrixElements[13];
  const clipW = pvMatrixElements[3] * sx + pvMatrixElements[7] * sy + pvMatrixElements[11] * sz + pvMatrixElements[15];

  if (clipW <= 0.01 || facing <= 0.05 || ny < -0.08) {
    out.uvX = 0.5;
    out.uvY = 0.5;
    out.strength = 0;
    return out;
  }

  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  out.uvX = ndcX * 0.5 + 0.5;
  out.uvY = ndcY * 0.5 + 0.5;

  const elevFactor = Math.max(0, Math.min(1, (ny + 0.08) / 0.55));
  const facingFactor = Math.max(0, Math.min(1, (facing - 0.05) / 0.72));
  const radialFalloff = Math.max(0, 1.0 - Math.hypot(out.uvX - 0.5, out.uvY - 0.5) * 0.58);
  const weatherClear = Math.max(0.2, 1.0 - Math.max(0, Math.min(1, cloudCover)) * 0.72);
  const dayWarmth = 1.0 - Math.max(0, Math.min(1, nightFactor)) * 0.65;

  out.strength = Math.max(
    0,
    Math.min(0.42, 0.34 * elevFactor * facingFactor * radialFalloff * weatherClear * dayWarmth)
  );
  return out;
}
