import * as THREE from 'three';
import * as THREE_WEBGPU from 'three/webgpu';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GpuTextureFilterMode } from './GpuEngineTypes';
import { createTslIblSkyDomeMaterial } from './WebGpuPipeline';

export type PbrSurfaceMaterialKind =
  | 'grass'
  | 'sand'
  | 'mountain'
  | 'bark'
  | 'foliage'
  | 'basalt'
  | 'timber'
  | 'cobble';

export interface SynthesizedPbrMaterialMaps {
  albedo: THREE.Texture;
  normal: THREE.DataTexture;
  bump: THREE.Texture;
  roughness: THREE.DataTexture;
  ao: THREE.DataTexture;
}

// Periodic integer wrap so every synthesized DataTexture tiles seamlessly with zero UV seams
function wrapCoord(v: number, period: number): number {
  const m = v % period;
  return m < 0 ? m + period : m;
}

function periodicHash2D(ix: number, iy: number, period: number, seed: number): number {
  const wx = wrapCoord(ix, period);
  const wy = wrapCoord(iy, period);
  let h = (wx * 374761393 + wy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function periodicValueNoise(
  u: number,
  v: number,
  freq: number,
  seed: number
): number {
  const x = u * freq;
  const y = v * freq;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const a = periodicHash2D(ix, iy, freq, seed);
  const b = periodicHash2D(ix + 1, iy, freq, seed);
  const c = periodicHash2D(ix, iy + 1, freq, seed);
  const d = periodicHash2D(ix + 1, iy + 1, freq, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function periodicFbm(
  u: number,
  v: number,
  baseFreq: number,
  octaves: number,
  seed: number
): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = baseFreq;
  for (let o = 0; o < octaves; o++) {
    sum += periodicValueNoise(u, v, freq, seed + o * 97) * amp;
    norm += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return norm > 0 ? sum / norm : 0.5;
}

function periodicWorley(
  u: number,
  v: number,
  cells: number,
  seed: number
): { f1: number; f2: number; edge: number; cellId: number } {
  const px = u * cells;
  const py = v * cells;
  const cx = Math.floor(px);
  const cy = Math.floor(py);

  let d1 = 999;
  let d2 = 999;
  let bestId = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      const jx = periodicHash2D(nx, ny, cells, seed);
      const jy = periodicHash2D(nx, ny, cells, seed + 7919);
      const fx = nx + 0.15 + jx * 0.7 - px;
      const fy = ny + 0.15 + jy * 0.7 - py;
      const dist = Math.hypot(fx, fy);
      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        bestId = periodicHash2D(nx, ny, cells, seed + 31337);
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }
  return {
    f1: Math.min(1, d1),
    f2: Math.min(1, d2),
    edge: Math.min(1, Math.max(0, d2 - d1)),
    cellId: bestId,
  };
}

/**
 * Synthesizes true Tangent-Space Normal Maps (OpenGL +Y up, RGB in Linear NoColorSpace),
 * Roughness Maps, Cavity Ambient Occlusion (AO) Maps, Water Gerstner Normal Maps,
 * Contact Shadow Decals, and Studio + Sky PMREM IBL Environment Maps on the GPU,
 * with live runtime switching of texture filtering (`trilinear_aniso`, `bilinear`, `nearest_retro`)
 * and hardware anisotropic filtering (`1x` to `16x`).
 */
export class PbrTextureSynthesizer {
  private static managedTextures = new Set<THREE.Texture>();
  private static surfaceMapCache = new Map<PbrSurfaceMaterialKind, SynthesizedPbrMaterialMaps>();
  private static waterPrimaryNormal: THREE.DataTexture | null = null;
  private static waterSecondaryNormal: THREE.DataTexture | null = null;
  private static furNormalTex: THREE.DataTexture | null = null;
  private static citrusNormalTex: THREE.DataTexture | null = null;
  private static contactShadowTex: THREE.DataTexture | null = null;

  private static currentFilterMode: GpuTextureFilterMode = 'trilinear_aniso';
  private static currentAnisotropy: number = 8;

  public static registerManagedTexture(tex: THREE.Texture): THREE.Texture {
    this.managedTextures.add(tex);
    this.applyFilterStateToTexture(tex);
    return tex;
  }

  public static getRegisteredTextureCount(): number {
    return this.managedTextures.size;
  }

  public static applyGlobalTextureFiltering(
    mode: GpuTextureFilterMode,
    anisotropy: number,
    maxHardwareAniso: number
  ): void {
    const clampedAniso = Math.max(1, Math.min(maxHardwareAniso, anisotropy));
    this.currentFilterMode = mode;
    this.currentAnisotropy = mode === 'trilinear_aniso' ? clampedAniso : 1;

    for (const tex of this.managedTextures) {
      this.applyFilterStateToTexture(tex);
    }
  }

  private static applyFilterStateToTexture(tex: THREE.Texture): void {
    if (tex.userData.__isContactShadow) {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 1;
      return;
    }

    if (this.currentFilterMode === 'nearest_retro') {
      tex.generateMipmaps = false;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.anisotropy = 1;
    } else if (this.currentFilterMode === 'bilinear') {
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 1;
    } else {
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = this.currentAnisotropy;
    }
    tex.needsUpdate = true;
  }

  /**
   * Builds a Tangent-Space Normal Map + Roughness + Cavity AO DataTexture trio from a periodic heightfield.
   */
  private static bakePbrDataMapsFromHeightfield(
    size: number,
    normalStrength: number,
    baseRoughness: number,
    roughnessSpread: number,
    sampleHeight: (u: number, v: number) => number,
    sampleAlbedo?: (u: number, v: number, h: number, ao: number, outRgb: [number, number, number]) => void
  ): {
    albedoData: THREE.DataTexture | null;
    normal: THREE.DataTexture;
    roughness: THREE.DataTexture;
    ao: THREE.DataTexture;
  } {
    const heights = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        heights[y * size + x] = sampleHeight(u, v);
      }
    }

    const normalBytes = new Uint8Array(size * size * 4);
    const roughBytes = new Uint8Array(size * size * 4);
    const aoBytes = new Uint8Array(size * size * 4);
    const albedoBytes = sampleAlbedo ? new Uint8Array(size * size * 4) : null;
    const rgbScratch: [number, number, number] = [128, 128, 128];

    for (let y = 0; y < size; y++) {
      const ym1 = y === 0 ? size - 1 : y - 1;
      const yp1 = y === size - 1 ? 0 : y + 1;
      for (let x = 0; x < size; x++) {
        const xm1 = x === 0 ? size - 1 : x - 1;
        const xp1 = x === size - 1 ? 0 : x + 1;

        const idx = y * size + x;
        const p4 = idx * 4;

        // 3x3 Sobel tangent-space gradient for crisp, alias-resistant surface micro-normals
        const tl = heights[ym1 * size + xm1];
        const tc = heights[ym1 * size + x];
        const tr = heights[ym1 * size + xp1];
        const ml = heights[y * size + xm1];
        const mc = heights[idx];
        const mr = heights[y * size + xp1];
        const bl = heights[yp1 * size + xm1];
        const bc = heights[yp1 * size + x];
        const br = heights[yp1 * size + xp1];

        const dX = tr + 2 * mr + br - (tl + 2 * ml + bl);
        const dY = bl + 2 * bc + br - (tl + 2 * tc + tr);

        let nx = -dX * normalStrength;
        let ny = -dY * normalStrength;
        let nz = 1.0;
        const invLen = 1.0 / Math.hypot(nx, ny, nz);
        nx *= invLen;
        ny *= invLen;
        nz *= invLen;

        normalBytes[p4] = Math.max(0, Math.min(255, Math.round((nx * 0.5 + 0.5) * 255)));
        normalBytes[p4 + 1] = Math.max(0, Math.min(255, Math.round((ny * 0.5 + 0.5) * 255)));
        normalBytes[p4 + 2] = Math.max(0, Math.min(255, Math.round((nz * 0.5 + 0.5) * 255)));
        normalBytes[p4 + 3] = 255;

        // Local Laplacian curvature cavity AO: concave crevices darken, convex ridges stay bright
        const neighborMean = (tl + tc + tr + ml + mr + bl + bc + br) * 0.125;
        const cavity = Math.max(0, neighborMean - mc);
        const aoFloat = Math.max(0.28, Math.min(1.0, 1.0 - cavity * 5.2 - (1.0 - mc) * 0.18));
        const aoByte = Math.round(aoFloat * 255);
        aoBytes[p4] = aoByte;
        aoBytes[p4 + 1] = aoByte;
        aoBytes[p4 + 2] = aoByte;
        aoBytes[p4 + 3] = 255;

        // Micro-roughness modulated by height & slope (cavities rougher, polished peaks smoother)
        const slope = Math.min(1.0, Math.hypot(dX, dY) * 1.5);
        const rFloat = THREE.MathUtils.clamp(
          baseRoughness + (0.5 - mc) * roughnessSpread + slope * 0.08,
          0.06,
          0.98
        );
        const rByte = Math.round(rFloat * 255);
        roughBytes[p4] = rByte;
        roughBytes[p4 + 1] = rByte;
        roughBytes[p4 + 2] = rByte;
        roughBytes[p4 + 3] = 255;

        if (sampleAlbedo && albedoBytes) {
          sampleAlbedo(x / size, y / size, mc, aoFloat, rgbScratch);
          albedoBytes[p4] = Math.max(0, Math.min(255, Math.round(rgbScratch[0])));
          albedoBytes[p4 + 1] = Math.max(0, Math.min(255, Math.round(rgbScratch[1])));
          albedoBytes[p4 + 2] = Math.max(0, Math.min(255, Math.round(rgbScratch[2])));
          albedoBytes[p4 + 3] = 255;
        }
      }
    }

    const configureLinearDataTex = (bytes: Uint8Array): THREE.DataTexture => {
      const tex = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
      tex.colorSpace = THREE.NoColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      this.registerManagedTexture(tex);
      return tex;
    };

    let albedoData: THREE.DataTexture | null = null;
    if (albedoBytes) {
      albedoData = new THREE.DataTexture(albedoBytes, size, size, THREE.RGBAFormat);
      albedoData.colorSpace = THREE.SRGBColorSpace;
      albedoData.wrapS = THREE.RepeatWrapping;
      albedoData.wrapT = THREE.RepeatWrapping;
      this.registerManagedTexture(albedoData);
    }

    return {
      albedoData,
      normal: configureLinearDataTex(normalBytes),
      roughness: configureLinearDataTex(roughBytes),
      ao: configureLinearDataTex(aoBytes),
    };
  }

  public static getSurfaceMaps(
    kind: PbrSurfaceMaterialKind,
    existingAlbedo?: THREE.Texture,
    existingBump?: THREE.Texture
  ): SynthesizedPbrMaterialMaps {
    const cached = this.surfaceMapCache.get(kind);
    if (cached) return cached;

    if (existingAlbedo) this.registerManagedTexture(existingAlbedo);
    if (existingBump) this.registerManagedTexture(existingBump);

    let maps: ReturnType<typeof this.bakePbrDataMapsFromHeightfield>;

    if (kind === 'cobble') {
      // Fitted promenade flagstone / cobble pavers with chiseled bevels, mortar AO, and warm stone variation
      maps = this.bakePbrDataMapsFromHeightfield(
        128,
        3.2,
        0.64,
        0.26,
        (u, v) => {
          const cell = periodicWorley(u, v, 10, 419);
          const mortarBevel = THREE.MathUtils.smoothstep(cell.edge, 0.025, 0.14);
          const chisel = periodicFbm(u, v, 24, 3, 911) * 0.22;
          return mortarBevel * (0.74 + chisel + cell.cellId * 0.08);
        },
        (u, v, h, ao, out) => {
          const cell = periodicWorley(u, v, 10, 419);
          const isMortar = cell.edge < 0.055;
          if (isMortar) {
            out[0] = 92 * ao;
            out[1] = 88 * ao;
            out[2] = 82 * ao;
          } else {
            const warmShift = (cell.cellId - 0.5) * 26;
            const grain = (periodicFbm(u, v, 32, 2, 733) - 0.5) * 18;
            const base = (158 + h * 34 + grain) * (0.72 + 0.28 * ao);
            out[0] = base + warmShift * 0.65;
            out[1] = base - 4 + warmShift * 0.25;
            out[2] = base - 12 - warmShift * 0.35;
          }
        }
      );
    } else if (kind === 'grass') {
      maps = this.bakePbrDataMapsFromHeightfield(128, 2.2, 0.78, 0.22, (u, v) => {
        const tufts = periodicWorley(u, v, 18, 101);
        const blades = periodicFbm(u * 1.4, v * 3.2, 24, 3, 211);
        return (1.0 - tufts.f1 * 0.45) * 0.55 + blades * 0.45;
      });
    } else if (kind === 'sand') {
      maps = this.bakePbrDataMapsFromHeightfield(128, 1.85, 0.68, 0.2, (u, v) => {
        const ripple =
          0.5 +
          0.5 *
            Math.sin(
              v * Math.PI * 16 + periodicFbm(u, v, 6, 2, 307) * 2.4
            );
        const grains = periodicFbm(u, v, 48, 2, 331);
        return ripple * 0.65 + grains * 0.35;
      });
    } else if (kind === 'mountain') {
      maps = this.bakePbrDataMapsFromHeightfield(128, 3.6, 0.84, 0.22, (u, v) => {
        const strata = 1.0 - Math.abs(periodicFbm(u + v * 0.35, v, 10, 4, 503) * 2 - 1);
        const crags = periodicWorley(u, v, 12, 541).edge;
        return strata * 0.68 + crags * 0.32;
      });
    } else if (kind === 'bark') {
      maps = this.bakePbrDataMapsFromHeightfield(128, 3.4, 0.88, 0.18, (u, v) => {
        const ridges = Math.abs(Math.sin(u * Math.PI * 18 + periodicFbm(u, v, 8, 3, 601) * 3.2));
        const fissures = periodicFbm(u * 2.0, v * 0.5, 16, 3, 619);
        return ridges * 0.62 + fissures * 0.38;
      });
    } else if (kind === 'foliage') {
      maps = this.bakePbrDataMapsFromHeightfield(128, 1.9, 0.44, 0.2, (u, v) => {
        const cells = periodicWorley(u, v, 14, 701);
        const veins = periodicFbm(u, v, 24, 3, 719);
        return (1.0 - cells.f1 * 0.6) * 0.65 + veins * 0.35;
      });
    } else if (kind === 'basalt') {
      maps = this.bakePbrDataMapsFromHeightfield(128, 2.9, 0.46, 0.28, (u, v) => {
        const cells = periodicWorley(u, v, 9, 809);
        const pores = periodicFbm(u, v, 32, 3, 823);
        return THREE.MathUtils.smoothstep(cells.edge, 0.02, 0.22) * 0.72 + pores * 0.28;
      });
    } else {
      // timber
      maps = this.bakePbrDataMapsFromHeightfield(128, 2.1, 0.66, 0.22, (u, v) => {
        const plankSeam = Math.min(1, Math.abs(((u * 6) % 1) - 0.5) * 14);
        const woodGrain =
          0.5 +
          0.5 *
            Math.sin(
              u * Math.PI * 36 + periodicFbm(u, v * 0.25, 12, 3, 907) * 5.0
            );
        return plankSeam * (0.68 + woodGrain * 0.32);
      });
    }

    const fallbackAlbedo = maps.albedoData ?? existingAlbedo ?? maps.ao;
    const result: SynthesizedPbrMaterialMaps = {
      albedo: existingAlbedo ?? fallbackAlbedo,
      normal: maps.normal,
      bump: existingBump ?? maps.ao,
      roughness: maps.roughness,
      ao: maps.ao,
    };
    this.surfaceMapCache.set(kind, result);
    return result;
  }

  /**
   * Dual-octave seamless Gerstner + capillary wave Tangent-Space Normal Maps for clearcoat water.
   */
  public static getWaterNormalMaps(): {
    primary: THREE.DataTexture;
    secondary: THREE.DataTexture;
  } {
    if (!this.waterPrimaryNormal || !this.waterSecondaryNormal) {
      const p = this.bakePbrDataMapsFromHeightfield(128, 2.45, 0.08, 0.04, (u, v) => {
        const a = u * Math.PI * 2;
        const b = v * Math.PI * 2;
        const swell1 = Math.sin(a * 3 + b * 2) * 0.34;
        const swell2 = Math.cos(a * 2 - b * 4) * 0.28;
        const ripple = periodicFbm(u, v, 12, 3, 1201) * 0.38;
        return 0.5 + (swell1 + swell2) * 0.5 + (ripple - 0.19);
      });
      p.normal.repeat.set(18, 18);

      const s = this.bakePbrDataMapsFromHeightfield(128, 1.85, 0.08, 0.04, (u, v) => {
        const a = u * Math.PI * 2;
        const b = v * Math.PI * 2;
        const cap1 = Math.sin(a * 5 - b * 3) * 0.32;
        const cap2 = Math.cos(a * 4 + b * 6) * 0.26;
        const micro = periodicFbm(u, v, 20, 2, 1453) * 0.42;
        return 0.5 + (cap1 + cap2) * 0.5 + (micro - 0.21);
      });
      s.normal.repeat.set(31, 31);

      this.waterPrimaryNormal = p.normal;
      this.waterSecondaryNormal = s.normal;
    }
    return {
      primary: this.waterPrimaryNormal,
      secondary: this.waterSecondaryNormal,
    };
  }

  /**
   * Directional bristle fur Tangent-Space Normal Map for Capybara coats.
   */
  public static getCapyFurNormalMap(): THREE.DataTexture {
    if (!this.furNormalTex) {
      const m = this.bakePbrDataMapsFromHeightfield(128, 2.15, 0.76, 0.16, (u, v) => {
        const strands = periodicFbm(u * 4.0, v * 1.0, 32, 3, 1607);
        const tufts = periodicWorley(u * 2.0, v * 0.75, 16, 1621).f1;
        return strands * 0.72 + (1.0 - tufts) * 0.28;
      });
      m.normal.repeat.set(3, 3);
      this.furNormalTex = m.normal;
    }
    return this.furNormalTex;
  }

  /**
   * Hesperidium oil-gland pore Tangent-Space Normal Map for glossy citrus fruits.
   */
  public static getCitrusPeelNormalMap(): THREE.DataTexture {
    if (!this.citrusNormalTex) {
      const m = this.bakePbrDataMapsFromHeightfield(128, 2.35, 0.24, 0.14, (u, v) => {
        const oilPores = periodicWorley(u, v, 22, 1801);
        const dimple = THREE.MathUtils.smoothstep(oilPores.f1, 0.0, 0.42);
        const micro = periodicFbm(u, v, 24, 2, 1823) * 0.18;
        return dimple * 0.82 + micro;
      });
      m.normal.repeat.set(3, 3);
      this.citrusNormalTex = m.normal;
    }
    return this.citrusNormalTex;
  }

  /**
   * Soft Gaussian radial alpha DataTexture for Hero contact shadow grounding.
   */
  public static getContactShadowTexture(): THREE.DataTexture {
    if (this.contactShadowTex) return this.contactShadowTex;
    const size = 64;
    const bytes = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const dy = (y / (size - 1)) * 2 - 1;
      for (let x = 0; x < size; x++) {
        const dx = (x / (size - 1)) * 2 - 1;
        const rSq = dx * dx + dy * dy;
        const alpha = rSq >= 1.0 ? 0 : Math.pow(1.0 - rSq, 2.2);
        const p4 = (y * size + x) * 4;
        bytes[p4] = 8;
        bytes[p4 + 1] = 12;
        bytes[p4 + 2] = 20;
        bytes[p4 + 3] = Math.round(alpha * 255);
      }
    }
    const tex = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData.__isContactShadow = true;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.managedTextures.add(tex);
    this.contactShadowTex = tex;
    return tex;
  }

  /**
   * Generates a rich zero-dependency procedural Sky + Studio IBL environment map on EVERY device:
   * - Hardware GPUs: Full prefiltered mipmapped cubemap via `PMREMGenerator` + `RoomEnvironment` + solar sky dome.
   * - Software WebGL (`isSoftwareGl`): Instant 64x32 `EquirectangularReflectionMapping` Studio+Sky `DataTexture`
   *   synthesized in <0.5ms on CPU so software rasterizers never stall on 36-pass cubemap convolution.
   */
  public static createStudioAndSkyEnvironmentMap(
    renderer: THREE.WebGLRenderer | THREE_WEBGPU.WebGPURenderer,
    isSoftwareGl: boolean = false
  ): THREE.Texture | null {
    if (isSoftwareGl) {
      const w = 64;
      const h = 32;
      const bytes = new Uint8Array(w * h * 4);
      const sunX = 0.48;
      const sunY = 0.74;
      const sunZ = 0.42;
      const sunLen = Math.hypot(sunX, sunY, sunZ);
      const sx = sunX / sunLen;
      const sy = sunY / sunLen;
      const sz = sunZ / sunLen;

      for (let y = 0; y < h; y++) {
        const v = y / (h - 1);
        const theta = (1 - v) * Math.PI; // 0 at north pole (+Y), PI at south pole (-Y)
        const sinT = Math.sin(theta);
        const dy = Math.cos(theta);
        for (let x = 0; x < w; x++) {
          const u = x / w;
          const phi = u * Math.PI * 2;
          const dx = -sinT * Math.sin(phi);
          const dz = -sinT * Math.cos(phi);

          let r: number;
          let g: number;
          let b: number;
          if (dy >= 0) {
            const t = Math.min(1, dy);
            r = (0.75 * (1 - t) + 0.18 * t) * 255;
            g = (0.88 * (1 - t) + 0.46 * t) * 255;
            b = (1.0 * (1 - t) + 0.88 * t) * 255;
          } else {
            const t = Math.min(1, -dy * 2.2);
            r = (0.45 * (1 - t) + 0.18 * t) * 255;
            g = (0.52 * (1 - t) + 0.26 * t) * 255;
            b = (0.58 * (1 - t) + 0.16 * t) * 255;
          }
          const sunDot = Math.max(0, dx * sx + dy * sy + dz * sz);
          const spec = Math.pow(sunDot, 24) * 180;
          const p4 = (y * w + x) * 4;
          bytes[p4] = Math.min(255, Math.round(r + spec));
          bytes[p4 + 1] = Math.min(255, Math.round(g + spec * 0.92));
          bytes[p4 + 2] = Math.min(255, Math.round(b + spec * 0.78));
          bytes[p4 + 3] = 255;
        }
      }
      const envTex = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      envTex.colorSpace = THREE.SRGBColorSpace;
      envTex.minFilter = THREE.LinearFilter;
      envTex.magFilter = THREE.LinearFilter;
      envTex.needsUpdate = true;
      return envTex;
    }

    const isWebGpu = Boolean(
      (renderer as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer
    );
    let pmremGenerator: {
      fromScene: (scene: THREE.Scene, sigma?: number) => { texture: THREE.Texture };
      dispose: () => void;
    } | null = null;
    let envScene: THREE.Scene | null = null;
    const disposableGeos: THREE.BufferGeometry[] = [];
    const disposableMats: THREE.Material[] = [];

    try {
      pmremGenerator = isWebGpu
        ? (new THREE_WEBGPU.PMREMGenerator(
            renderer as THREE_WEBGPU.WebGPURenderer
          ) as unknown as {
            fromScene: (scene: THREE.Scene, sigma?: number) => { texture: THREE.Texture };
            dispose: () => void;
          })
        : new THREE.PMREMGenerator(renderer as THREE.WebGLRenderer);
      envScene = new RoomEnvironment();

      // Add a warm solar specular softbox dome + cool sky hemisphere + botanical ground bounce
      const skyDomeGeo = new THREE.SphereGeometry(14, 24, 16);
      const skyDomeMat: THREE.Material = isWebGpu
        ? createTslIblSkyDomeMaterial()
        : new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
            fragmentShader: `
          varying vec3 vDir;
          void main() {
            float y = vDir.y;
            vec3 sky = mix(vec3(0.68, 0.84, 1.0), vec3(0.12, 0.38, 0.82), clamp(y, 0.0, 1.0));
            vec3 ground = vec3(0.11, 0.16, 0.10);
            vec3 col = y >= 0.0 ? sky : mix(vec3(0.32, 0.38, 0.42), ground, clamp(-y * 2.4, 0.0, 1.0));
            float sunDot = max(0.0, dot(normalize(vDir), normalize(vec3(0.48, 0.74, 0.42))));
            col += vec3(1.8, 1.45, 1.05) * pow(sunDot, 28.0);
            col += vec3(7.5, 6.8, 5.4) * pow(sunDot, 220.0);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
          });
      disposableGeos.push(skyDomeGeo);
      disposableMats.push(skyDomeMat);
      envScene.add(new THREE.Mesh(skyDomeGeo, skyDomeMat));

      const rt = pmremGenerator.fromScene(envScene, 0.035);
      return rt.texture;
    } catch {
      return null;
    } finally {
      for (const g of disposableGeos) g.dispose();
      for (const m of disposableMats) m.dispose();
      if (envScene) {
        envScene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mm) => mm.dispose());
            } else {
              mesh.material?.dispose();
            }
          }
        });
      }
      pmremGenerator?.dispose();
    }
  }

  /**
   * Ensures a BufferGeometry has `uv1` + `uv2` for `aoMap` and vertex tangents for normal-mapped PBR.
   */
  public static prepareGeometryForPbr(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    const uv = geo.getAttribute('uv');
    if (uv) {
      if (!geo.getAttribute('uv1')) geo.setAttribute('uv1', uv);
      if (!geo.getAttribute('uv2')) geo.setAttribute('uv2', uv);
    }
    if (uv && geo.getAttribute('position') && geo.getAttribute('normal') && geo.index) {
      try {
        geo.computeTangents();
      } catch {
        // Ignore non-indexed or degenerate tangent edge cases
      }
    }
    return geo;
  }
}
