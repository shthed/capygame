/**
 * Multi-scale 5-ring GPU clipmap + live factory pixel rasterizer + dual-stratum GLSL patchy
 * clouds for Capytorio's continuous zoom from ground level (10 m) through high orbit (234 km+).
 *
 * - Zero per-frame heap allocations in sync()
 * - Hardware-mipmapped SRGB DataTextures with smooth circular edge feathering
 * - Frame-budgeted incremental chunk baking from genuine factorio-mapgen (scales 1..256)
 * - Live factory footprint rasterization so every machine and belt shrinks naturally to 1 px
 * - World-anchored drifting patchy clouds with smooth camera-altitude lens fade
 */

import * as THREE from 'three';
import type { CapytorioFactoryEngine } from '../CapytorioFactoryEngine';
import {
  CAPYTORIO_TILE_SIZE,
  CAPYTORIO_WORLD_ORIGIN_X,
  CAPYTORIO_WORLD_ORIGIN_Z,
} from '../CapytorioData';
import {
  CAPYTORIO_CLIPMAP_RINGS,
  CAPYTORIO_CLIPMAP_TEX_SIZE,
  CAPYTORIO_CLOUD_LOWER_Y,
  CAPYTORIO_CLOUD_UPPER_Y,
  evaluateClipmapRingAlpha,
  getCapytorioMachineProxyColorHex,
  type CapytorioAltitudeLodState,
  type CapytorioClipmapRingConfig,
} from './CapytorioOrbitalLodMath';
import {
  getCapytorioMapGenRevision,
  getOrBakeCapytorioClipmapChunkRGBA,
} from './CapytorioTerrainGen';

const CHUNK_SIZE = 32;
const CHUNKS_PER_AXIS = CAPYTORIO_CLIPMAP_TEX_SIZE / CHUNK_SIZE; // 8
const TOTAL_CHUNKS_PER_RING = CHUNKS_PER_AXIS * CHUNKS_PER_AXIS; // 64

// Precomputed center-outward chunk bake order (64 entries) so tiles right under the camera bake first
const CENTER_OUTWARD_SLOTS: readonly { sx: number; sy: number; idx: number }[] = (() => {
  const list: Array<{ sx: number; sy: number; idx: number; dist: number }> = [];
  const half = (CHUNKS_PER_AXIS - 1) * 0.5;
  for (let sy = 0; sy < CHUNKS_PER_AXIS; sy++) {
    for (let sx = 0; sx < CHUNKS_PER_AXIS; sx++) {
      const dx = sx - half;
      const dy = sy - half;
      list.push({ sx, sy, idx: sy * CHUNKS_PER_AXIS + sx, dist: dx * dx + dy * dy });
    }
  }
  list.sort((a, b) => a.dist - b.dist);
  return list.map(({ sx, sy, idx }) => ({ sx, sy, idx }));
})();

interface ClipmapShaderUniforms {
  uRingAlpha: { value: number };
  uFeatherInner: { value: number };
  uFeatherOuter: { value: number };
  uHazeStrength: { value: number };
  uHazeColor: { value: THREE.Color };
}

interface ClipmapRingRuntime {
  readonly config: CapytorioClipmapRingConfig;
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly texture: THREE.DataTexture;
  readonly terrainPixels: Uint8Array;
  readonly displayPixels: Uint8Array;
  readonly scratchShiftPixels: Uint8Array;
  readonly chunkBaked: Uint8Array;
  readonly scratchShiftBaked: Uint8Array;
  readonly uniforms: ClipmapShaderUniforms;
  originCx: number;
  originCy: number;
  initialized: boolean;
  dirtyChunkCount: number;
  factoryDirty: boolean;
  lastMapGenRev: number;
  lastTopoRev: number;
}

const CLOUD_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec2 vWorldXZ;
uniform vec2 uCenterXZ;
uniform float uPlaneSpan;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldXZ = worldPos.xz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const CLOUD_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec2 vWorldXZ;

uniform float uTime;
uniform float uOpacity;
uniform float uWorldScale;
uniform vec2 uWindVelocity;
uniform float uCoverageMin;
uniform float uCoverageMax;
uniform vec3 uSunColor;
uniform vec3 uShadowColor;
uniform float uWarmTint;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm3(vec2 p) {
  float v = 0.0;
  float amp = 0.54;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 3; i++) {
    v += amp * valueNoise(p);
    p = rot * p * 2.04 + vec2(17.1, 31.7);
    amp *= 0.48;
  }
  return v;
}

void main() {
  if (uOpacity <= 0.004) discard;

  // Smooth radial disk fade so cloud plane edges never show against the horizon
  float radial = length((vUv - vec2(0.5)) * 2.0);
  float rimFade = 1.0 - smoothstep(0.58, 0.98, radial);
  if (rimFade <= 0.003) discard;

  vec2 p = vWorldXZ * uWorldScale + uWindVelocity * uTime;
  float nBase = fbm3(p);
  // Early-out over open sky gaps (~60% of pixels skip detail and self-shadow octaves)
  if (nBase < uCoverageMin - 0.14) discard;

  float nDetail = valueNoise(p * 3.1 + vec2(nBase * 1.3, -nBase * 1.0) + uWindVelocity * (uTime * 0.4));
  float density = nBase * 0.74 + nDetail * 0.26;

  float cloudMask = smoothstep(uCoverageMin, uCoverageMax, density);
  if (cloudMask <= 0.004) discard;

  // Lightweight directional self-shadowing (sunlight from +X, +Z upper-left)
  float nSun = valueNoise(p * 1.4 + vec2(0.24, -0.18));
  float lit = clamp((density - nSun * 0.85) * 2.4 + 0.58, 0.0, 1.0);

  vec3 col = mix(uShadowColor, uSunColor, lit);
  col = mix(col, vec3(0.96, 0.98, 1.0), uWarmTint * lit * 0.25);

  float alpha = cloudMask * rimFade * uOpacity;
  gl_FragColor = vec4(col, alpha);
}
`;

export class CapytorioPlanetarySurfaceLayer {
  public readonly root: THREE.Group;

  private readonly rings: ClipmapRingRuntime[] = [];
  private readonly sharedPlaneGeo: THREE.PlaneGeometry;
  private readonly cloudLowerMesh: THREE.Mesh;
  private readonly cloudUpperMesh: THREE.Mesh;
  private readonly cloudLowerMat: THREE.ShaderMaterial;
  private readonly cloudUpperMat: THREE.ShaderMaterial;
  private readonly cloudPlaneGeo: THREE.PlaneGeometry;
  private readonly hazeColorDay = new THREE.Color(0x88c9f2);
  private readonly hazeColorHigh = new THREE.Color(0x4682c8);
  private readonly hazeColorScratch = new THREE.Color();
  private hasCompletedInitialWarmup = false;

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'CapytorioPlanetarySurfaceLayer';

    // Unit 1x1 horizontal plane with V=0 at North (-Z) and V=1 at South (+Z) matching DataTexture rows 0..255
    this.sharedPlaneGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.sharedPlaneGeo.rotateX(-Math.PI * 0.5);
    const uvAttr = this.sharedPlaneGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setY(i, 1.0 - uvAttr.getY(i));
    }
    uvAttr.needsUpdate = true;

    const initialMapGenRev = getCapytorioMapGenRevision();

    for (let i = 0; i < CAPYTORIO_CLIPMAP_RINGS.length; i++) {
      const cfg = CAPYTORIO_CLIPMAP_RINGS[i];
      const pixelBytes = cfg.texSize * cfg.texSize * 4;
      const terrainPixels = new Uint8Array(pixelBytes);
      const displayPixels = new Uint8Array(pixelBytes);
      const scratchShiftPixels = new Uint8Array(pixelBytes);

      // Initialize unbaked border chunks transparent (alpha=0) so inner rings never sit on a flat placeholder square
      for (let p = 0; p < pixelBytes; p += 4) {
        terrainPixels[p] = 112;
        terrainPixels[p + 1] = 148;
        terrainPixels[p + 2] = 86;
        terrainPixels[p + 3] = 0;
      }
      displayPixels.set(terrainPixels);

      const texture = new THREE.DataTexture(
        displayPixels,
        cfg.texSize,
        cfg.texSize,
        THREE.RGBAFormat
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = 8;
      texture.needsUpdate = true;

      const uniforms: ClipmapShaderUniforms = {
        uRingAlpha: { value: 1.0 },
        uFeatherInner: { value: i === CAPYTORIO_CLIPMAP_RINGS.length - 1 ? 0.68 : 0.72 },
        uFeatherOuter: { value: 0.99 },
        uHazeStrength: { value: 0.0 },
        uHazeColor: { value: new THREE.Color(0x88c9f2) },
      };

      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texture,
        roughness: 0.94,
        metalness: 0.0,
        envMapIntensity: 0.36,
        fog: false,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
      });

      material.customProgramCacheKey = () => 'capytorio-clipmap-ring-v1';
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uRingAlpha = uniforms.uRingAlpha;
        shader.uniforms.uFeatherInner = uniforms.uFeatherInner;
        shader.uniforms.uFeatherOuter = uniforms.uFeatherOuter;
        shader.uniforms.uHazeStrength = uniforms.uHazeStrength;
        shader.uniforms.uHazeColor = uniforms.uHazeColor;

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
uniform float uRingAlpha;
uniform float uFeatherInner;
uniform float uFeatherOuter;
uniform float uHazeStrength;
uniform vec3 uHazeColor;`
          )
          .replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
  float capyEdgeDist = length((vMapUv - vec2(0.5)) * 2.0);
  float capyFeather = 1.0 - smoothstep(uFeatherInner, uFeatherOuter, capyEdgeDist);
  float capyHaze = clamp(uHazeStrength * (0.75 + 0.45 * capyEdgeDist), 0.0, 0.72);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, capyHaze);
  gl_FragColor.a *= uRingAlpha * capyFeather;`
          );
      };

      const mesh = new THREE.Mesh(this.sharedPlaneGeo, material);
      mesh.scale.set(cfg.worldSpanMeters, 1, cfg.worldSpanMeters);
      mesh.position.set(CAPYTORIO_WORLD_ORIGIN_X, cfg.yOffset, CAPYTORIO_WORLD_ORIGIN_Z);
      mesh.renderOrder = cfg.renderOrder;
      mesh.receiveShadow = i === 0;
      mesh.frustumCulled = false;
      mesh.userData.ignoreCameraFade = true;
      this.root.add(mesh);

      this.rings.push({
        config: cfg,
        mesh,
        material,
        texture,
        terrainPixels,
        displayPixels,
        scratchShiftPixels,
        chunkBaked: new Uint8Array(TOTAL_CHUNKS_PER_RING),
        scratchShiftBaked: new Uint8Array(TOTAL_CHUNKS_PER_RING),
        uniforms,
        originCx: 0,
        originCy: 0,
        initialized: false,
        dirtyChunkCount: TOTAL_CHUNKS_PER_RING,
        factoryDirty: true,
        lastMapGenRev: initialMapGenRev,
        lastTopoRev: -1,
      });
    }

    // Two drifting patchy procedural cloud strata (lower cumulus & upper wispy stratocumulus)
    this.cloudPlaneGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.cloudPlaneGeo.rotateX(-Math.PI * 0.5);

    this.cloudLowerMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uCenterXZ: { value: new THREE.Vector2(0, 0) },
        uPlaneSpan: { value: 180_000 },
        uWorldScale: { value: 0.00052 },
        uWindVelocity: { value: new THREE.Vector2(0.011, 0.0045) },
        uCoverageMin: { value: 0.52 },
        uCoverageMax: { value: 0.79 },
        uSunColor: { value: new THREE.Color(0xf8fbff) },
        uShadowColor: { value: new THREE.Color(0xb6cce2) },
        uWarmTint: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.cloudLowerMesh = new THREE.Mesh(this.cloudPlaneGeo, this.cloudLowerMat);
    this.cloudLowerMesh.scale.set(180_000, 1, 180_000);
    this.cloudLowerMesh.position.set(
      CAPYTORIO_WORLD_ORIGIN_X,
      CAPYTORIO_CLOUD_LOWER_Y,
      CAPYTORIO_WORLD_ORIGIN_Z
    );
    this.cloudLowerMesh.renderOrder = 14;
    this.cloudLowerMesh.frustumCulled = false;
    this.cloudLowerMesh.visible = false;
    this.cloudLowerMesh.userData.ignoreCameraFade = true;
    this.root.add(this.cloudLowerMesh);

    this.cloudUpperMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uCenterXZ: { value: new THREE.Vector2(0, 0) },
        uPlaneSpan: { value: 280_000 },
        uWorldScale: { value: 0.00020 },
        uWindVelocity: { value: new THREE.Vector2(-0.0075, 0.0062) },
        uCoverageMin: { value: 0.51 },
        uCoverageMax: { value: 0.82 },
        uSunColor: { value: new THREE.Color(0xffffff) },
        uShadowColor: { value: new THREE.Color(0xc5d8eb) },
        uWarmTint: { value: 0.65 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.cloudUpperMesh = new THREE.Mesh(this.cloudPlaneGeo, this.cloudUpperMat);
    this.cloudUpperMesh.scale.set(280_000, 1, 280_000);
    this.cloudUpperMesh.position.set(
      CAPYTORIO_WORLD_ORIGIN_X,
      CAPYTORIO_CLOUD_UPPER_Y,
      CAPYTORIO_WORLD_ORIGIN_Z
    );
    this.cloudUpperMesh.renderOrder = 15;
    this.cloudUpperMesh.frustumCulled = false;
    this.cloudUpperMesh.visible = false;
    this.cloudUpperMesh.userData.ignoreCameraFade = true;
    this.root.add(this.cloudUpperMesh);
  }

  /**
   * Synchronizes all 5 nested clipmap rings, live factory pixels, and drifting patchy clouds
   * with zero per-frame heap allocations.
   */
  public sync(
    engine: CapytorioFactoryEngine,
    camX: number,
    camZ: number,
    timeSec: number,
    altitudeRadius: number,
    lod: CapytorioAltitudeLodState,
    fpsHealthy: boolean = true
  ): void {
    const camTileX = (camX - CAPYTORIO_WORLD_ORIGIN_X) / CAPYTORIO_TILE_SIZE;
    const camTileZ = (camZ - CAPYTORIO_WORLD_ORIGIN_Z) / CAPYTORIO_TILE_SIZE;
    const curMapGenRev = getCapytorioMapGenRevision();
    const curTopoRev = engine.topologyRevision;

    // Smooth atmospheric haze tint shift from sunlit cyan-blue to stratospheric azure above 20 km
    const highAtmoMix = Math.max(0, Math.min(1, (lod.logAlt - 3.9) / 1.1));
    this.hazeColorScratch.copy(this.hazeColorDay).lerp(this.hazeColorHigh, highAtmoMix);

    const frameStartMs = typeof performance !== 'undefined' ? performance.now() : 0;
    const bakeBudgetMs = !this.hasCompletedInitialWarmup ? 14.0 : fpsHealthy ? 7.5 : 2.5;
    let totalChunksBakedThisFrame = 0;

    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      const cfg = ring.config;
      const ringAlpha = evaluateClipmapRingAlpha(cfg, altitudeRadius, lod.clipmapOpacity);
      const isVisible = ringAlpha > 0.004;
      ring.mesh.visible = isVisible;
      if (!isVisible) continue;

      // Below 6.5 km: draw after skyDome (-50) and before 3D water/transparents (0) with depthTest ON.
      // Above 6.5 km: all 3D surface props & proxies are retired; draw AFTER Capy-Earth planetGlobeMesh (0)
      // and BEFORE patchy cloud strata (14..15) with depthTest OFF so Nauvis dissolves smoothly onto the globe!
      const isOrbitalComposite = altitudeRadius > 6_500;
      const wantDepthTest = !isOrbitalComposite;
      if (ring.material.depthTest !== wantDepthTest) {
        ring.material.depthTest = wantDepthTest;
      }
      ring.mesh.renderOrder = isOrbitalComposite ? 6 - i : cfg.renderOrder;

      ring.uniforms.uRingAlpha.value = ringAlpha;
      ring.uniforms.uHazeStrength.value = lod.hazeStrength;
      ring.uniforms.uHazeColor.value.copy(this.hazeColorScratch);

      if (ring.lastMapGenRev !== curMapGenRev) {
        ring.lastMapGenRev = curMapGenRev;
        ring.chunkBaked.fill(0);
        ring.dirtyChunkCount = TOTAL_CHUNKS_PER_RING;
        ring.factoryDirty = true;
      }

      if (ring.lastTopoRev !== curTopoRev) {
        ring.lastTopoRev = curTopoRev;
        ring.factoryDirty = true;
      }

      const chunkTileSpan = CHUNK_SIZE * cfg.scale;
      const desiredOriginCx = Math.floor(camTileX / chunkTileSpan) - CHUNKS_PER_AXIS / 2;
      const desiredOriginCy = Math.floor(camTileZ / chunkTileSpan) - CHUNKS_PER_AXIS / 2;

      if (!ring.initialized || desiredOriginCx !== ring.originCx || desiredOriginCy !== ring.originCy) {
        this.recenterRing(ring, desiredOriginCx, desiredOriginCy);
      }

      // Position ring plane cleanly aligned to chunk boundaries
      const startTileX = ring.originCx * chunkTileSpan;
      const startTileZ = ring.originCy * chunkTileSpan;
      const centerTileX = startTileX + (cfg.texSize * cfg.scale) * 0.5 - 0.5;
      const centerTileZ = startTileZ + (cfg.texSize * cfg.scale) * 0.5 - 0.5;
      ring.mesh.position.set(
        CAPYTORIO_WORLD_ORIGIN_X + centerTileX * CAPYTORIO_TILE_SIZE,
        cfg.yOffset,
        CAPYTORIO_WORLD_ORIGIN_Z + centerTileZ * CAPYTORIO_TILE_SIZE
      );

      // Incrementally bake dirty 32x32 chunks outward from ring center within frame budget
      let bakedAnyInRing = false;
      if (ring.dirtyChunkCount > 0) {
        for (let s = 0; s < CENTER_OUTWARD_SLOTS.length; s++) {
          const slot = CENTER_OUTWARD_SLOTS[s];
          if (ring.chunkBaked[slot.idx] === 1) continue;

          if (
            totalChunksBakedThisFrame >= (cfg.scale >= 16 ? 4 : 1) &&
            typeof performance !== 'undefined' &&
            performance.now() - frameStartMs >= bakeBudgetMs
          ) {
            break;
          }

          const chunkRgba = getOrBakeCapytorioClipmapChunkRGBA(
            cfg.scale,
            ring.originCx + slot.sx,
            ring.originCy + slot.sy
          );
          this.blitChunkToRing(ring, slot.sx, slot.sy, chunkRgba);
          ring.chunkBaked[slot.idx] = 1;
          ring.dirtyChunkCount--;
          bakedAnyInRing = true;
          totalChunksBakedThisFrame++;
        }
      }

      if (bakedAnyInRing || ring.factoryDirty) {
        this.compositeFactoryIntoRing(ring, engine);
        ring.factoryDirty = false;
        ring.texture.needsUpdate = true;
      }
    }

    if (totalChunksBakedThisFrame === 0) {
      this.hasCompletedInitialWarmup = true;
    }

    // Sync dual drifting patchy cloud strata
    const showLowerClouds = lod.cloudLayer1Opacity > 0.005;
    this.cloudLowerMesh.visible = showLowerClouds;
    if (showLowerClouds) {
      const span = Math.max(24_000, Math.min(260_000, altitudeRadius * 6.5));
      this.cloudLowerMesh.scale.set(span, 1, span);
      this.cloudLowerMesh.position.set(camX, CAPYTORIO_CLOUD_LOWER_Y, camZ);
      this.cloudLowerMat.uniforms.uTime.value = timeSec;
      this.cloudLowerMat.uniforms.uOpacity.value = lod.cloudLayer1Opacity;
      this.cloudLowerMat.uniforms.uPlaneSpan.value = span;
      this.cloudLowerMat.uniforms.uCenterXZ.value.set(camX, camZ);
    }

    const showUpperClouds = lod.cloudLayer2Opacity > 0.005;
    this.cloudUpperMesh.visible = showUpperClouds;
    if (showUpperClouds) {
      const span = Math.max(48_000, Math.min(360_000, altitudeRadius * 7.2));
      this.cloudUpperMesh.scale.set(span, 1, span);
      this.cloudUpperMesh.position.set(camX, CAPYTORIO_CLOUD_UPPER_Y, camZ);
      this.cloudUpperMat.uniforms.uTime.value = timeSec;
      this.cloudUpperMat.uniforms.uOpacity.value = lod.cloudLayer2Opacity;
      this.cloudUpperMat.uniforms.uPlaneSpan.value = span;
      this.cloudUpperMat.uniforms.uCenterXZ.value.set(camX, camZ);
    }
  }

  /**
   * Forces synchronous baking of all currently active visible chunks (used in tests or instant snaps).
   */
  public flushVisibleRings(engine: CapytorioFactoryEngine): void {
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (!ring.mesh.visible) continue;
      let changed = false;
      for (let s = 0; s < CENTER_OUTWARD_SLOTS.length; s++) {
        const slot = CENTER_OUTWARD_SLOTS[s];
        if (ring.chunkBaked[slot.idx] === 1) continue;
        const chunkRgba = getOrBakeCapytorioClipmapChunkRGBA(
          ring.config.scale,
          ring.originCx + slot.sx,
          ring.originCy + slot.sy
        );
        this.blitChunkToRing(ring, slot.sx, slot.sy, chunkRgba);
        ring.chunkBaked[slot.idx] = 1;
        ring.dirtyChunkCount--;
        changed = true;
      }
      if (changed || ring.factoryDirty) {
        this.compositeFactoryIntoRing(ring, engine);
        ring.factoryDirty = false;
        ring.texture.needsUpdate = true;
      }
    }
  }

  private recenterRing(ring: ClipmapRingRuntime, newOriginCx: number, newOriginCy: number): void {
    const texSize = ring.config.texSize;
    if (!ring.initialized) {
      ring.originCx = newOriginCx;
      ring.originCy = newOriginCy;
      ring.initialized = true;
      ring.chunkBaked.fill(0);
      for (let p = 3; p < ring.terrainPixels.length; p += 4) ring.terrainPixels[p] = 0;
      ring.dirtyChunkCount = TOTAL_CHUNKS_PER_RING;
      ring.factoryDirty = true;
      return;
    }

    const dxChunks = newOriginCx - ring.originCx;
    const dyChunks = newOriginCy - ring.originCy;
    ring.originCx = newOriginCx;
    ring.originCy = newOriginCy;

    if (Math.abs(dxChunks) >= CHUNKS_PER_AXIS || Math.abs(dyChunks) >= CHUNKS_PER_AXIS) {
      ring.chunkBaked.fill(0);
      for (let p = 3; p < ring.terrainPixels.length; p += 4) ring.terrainPixels[p] = 0;
      ring.dirtyChunkCount = TOTAL_CHUNKS_PER_RING;
      ring.factoryDirty = true;
      return;
    }

    // Copy overlapping chunks into scratch buffers so panning reuses already-baked terrain with zero WASM cost
    ring.scratchShiftBaked.fill(0);
    const dst = ring.scratchShiftPixels;
    for (let p = 3; p < dst.length; p += 4) dst[p] = 0;
    const src = ring.terrainPixels;
    let keptCount = 0;

    for (let sy = 0; sy < CHUNKS_PER_AXIS; sy++) {
      const oldSy = sy + dyChunks;
      for (let sx = 0; sx < CHUNKS_PER_AXIS; sx++) {
        const oldSx = sx + dxChunks;
        const newSlot = sy * CHUNKS_PER_AXIS + sx;
        if (
          oldSx >= 0 &&
          oldSx < CHUNKS_PER_AXIS &&
          oldSy >= 0 &&
          oldSy < CHUNKS_PER_AXIS &&
          ring.chunkBaked[oldSy * CHUNKS_PER_AXIS + oldSx] === 1
        ) {
          ring.scratchShiftBaked[newSlot] = 1;
          keptCount++;
          const srcX0 = oldSx * CHUNK_SIZE;
          const srcY0 = oldSy * CHUNK_SIZE;
          const dstX0 = sx * CHUNK_SIZE;
          const dstY0 = sy * CHUNK_SIZE;
          for (let row = 0; row < CHUNK_SIZE; row++) {
            const sOff = ((srcY0 + row) * texSize + srcX0) * 4;
            const dOff = ((dstY0 + row) * texSize + dstX0) * 4;
            dst.set(src.subarray(sOff, sOff + CHUNK_SIZE * 4), dOff);
          }
        }
      }
    }

    ring.terrainPixels.set(dst);
    ring.chunkBaked.set(ring.scratchShiftBaked);
    ring.dirtyChunkCount = TOTAL_CHUNKS_PER_RING - keptCount;
    ring.factoryDirty = true;
  }

  private blitChunkToRing(
    ring: ClipmapRingRuntime,
    slotX: number,
    slotY: number,
    chunkRgba: Uint8Array
  ): void {
    const texSize = ring.config.texSize;
    const dstX0 = slotX * CHUNK_SIZE;
    const dstY0 = slotY * CHUNK_SIZE;
    const dst = ring.terrainPixels;
    const rowBytes = CHUNK_SIZE * 4;

    for (let row = 0; row < CHUNK_SIZE; row++) {
      const sOff = row * rowBytes;
      const dOff = ((dstY0 + row) * texSize + dstX0) * 4;
      dst.set(chunkRgba.subarray(sOff, sOff + rowBytes), dOff);
    }
  }

  /**
   * Copies pure baked Nauvis terrain into the GPU texture buffer and stamps every live built
   * machine & transport belt footprint so the player's factory shrinks naturally down to 1 pixel.
   */
  private compositeFactoryIntoRing(ring: ClipmapRingRuntime, engine: CapytorioFactoryEngine): void {
    const display = ring.displayPixels;
    display.set(ring.terrainPixels);

    if (engine.machines.size === 0) return;

    const cfg = ring.config;
    const texSize = cfg.texSize;
    const scale = cfg.scale;
    const originTileX = ring.originCx * CHUNK_SIZE * scale;
    const originTileZ = ring.originCy * CHUNK_SIZE * scale;
    const maxTileX = originTileX + texSize * scale;
    const maxTileZ = originTileZ + texSize * scale;

    for (const m of engine.machines.values()) {
      const fp = engine.getMachineFootprint(m);
      const gx0 = m.gx;
      const gz0 = m.gz;
      const gx1 = gx0 + fp.width - 1;
      const gz1 = gz0 + fp.height - 1;

      if (gx1 < originTileX || gx0 >= maxTileX || gz1 < originTileZ || gz0 >= maxTileZ) {
        continue;
      }

      const hex = getCapytorioMachineProxyColorHex(m.type, m.variantItemId);
      const cr = (hex >> 16) & 0xff;
      const cg = (hex >> 8) & 0xff;
      const cb = hex & 0xff;

      const px0 = Math.max(0, Math.floor((gx0 - originTileX) / scale));
      const px1 = Math.min(texSize - 1, Math.floor((gx1 - originTileX) / scale));
      const pz0 = Math.max(0, Math.floor((gz0 - originTileZ) / scale));
      const pz1 = Math.min(texSize - 1, Math.floor((gz1 - originTileZ) / scale));

      // Subtle 3D roof highlight on Ring 0/1, crisp industrial beacon weight at orbital Ring 2..4
      const blend =
        scale === 1
          ? 0.96
          : scale <= 4
            ? 0.92
            : scale <= 16
              ? 0.88
              : 0.84;
      const invBlend = 1.0 - blend;

      for (let py = pz0; py <= pz1; py++) {
        const isSouthRim = scale === 1 && py === pz1 && pz1 > pz0;
        const rowOff = py * texSize;
        for (let px = px0; px <= px1; px++) {
          const isEastRim = scale === 1 && px === px1 && px1 > px0;
          const shade = isSouthRim || isEastRim ? 0.72 : 1.04;
          const idx = (rowOff + px) * 4;
          display[idx] = Math.min(255, Math.round(display[idx] * invBlend + cr * shade * blend));
          display[idx + 1] = Math.min(255, Math.round(display[idx + 1] * invBlend + cg * shade * blend));
          display[idx + 2] = Math.min(255, Math.round(display[idx + 2] * invBlend + cb * shade * blend));
          display[idx + 3] = 255;
        }
      }
    }
  }

  /** Diagnostic helper for unit tests verifying live factory rasterization and ring state */
  public getRingDebugInfo(index: number): {
    visible: boolean;
    scale: number;
    worldSpanMeters: number;
    displayPixels: Uint8Array;
    originTileX: number;
    originTileZ: number;
  } | null {
    const ring = this.rings[index];
    if (!ring) return null;
    return {
      visible: ring.mesh.visible,
      scale: ring.config.scale,
      worldSpanMeters: ring.config.worldSpanMeters,
      displayPixels: ring.displayPixels,
      originTileX: ring.originCx * CHUNK_SIZE * ring.config.scale,
      originTileZ: ring.originCy * CHUNK_SIZE * ring.config.scale,
    };
  }

  public dispose(): void {
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.texture.dispose();
      ring.material.dispose();
    }
    this.rings.length = 0;
    this.sharedPlaneGeo.dispose();
    this.cloudLowerMat.dispose();
    this.cloudUpperMat.dispose();
    this.cloudPlaneGeo.dispose();
    this.root.clear();
  }
}
