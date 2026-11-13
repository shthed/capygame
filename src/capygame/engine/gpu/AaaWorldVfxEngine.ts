import * as THREE from 'three';
import * as THREE_WEBGPU from 'three/webgpu';
import { abs, dot, float, normalize, normalView, positionViewDirection, pow, smoothstep, uniform, uv } from 'three/tsl';

export type VfxBurstKind = 'turf_dust' | 'cobble_spark' | 'water_splash' | 'citrus_burst' | 'xpbd_launch';

const MAX_BURST_PARTICLES_HW = 192;
const MAX_BURST_PARTICLES_SW = 64;
const MOTES_COUNT_HW = 220;
const MOTES_COUNT_SW = 64;
const GOD_RAY_CONES = 4;

const ATMOSPHERIC_MOTES_VERT = /* glsl */ `
  attribute float aPhase;
  attribute float aScale;
  attribute vec3 aOrbit;

  uniform float uTime;
  uniform float uNightFactor;
  uniform vec3 uFocusCenter;
  uniform float uPixelRatio;

  varying float vAlpha;
  varying float vNightMix;
  varying float vTwinkle;

  void main() {
    // Wrap motes smoothly inside a 56m x 14m x 56m volume centered on the Hero!
    vec3 rel = position - uFocusCenter;
    rel.x = mod(rel.x + 28.0, 56.0) - 28.0;
    rel.z = mod(rel.z + 28.0, 56.0) - 28.0;

    float driftT = uTime * (0.45 + aOrbit.z * 0.35) + aPhase;
    vec3 worldPos = uFocusCenter + rel;
    worldPos.x += sin(driftT * 1.1 + aOrbit.x) * 0.85;
    worldPos.y = clamp(position.y + sin(driftT * 1.45 + aPhase) * 0.65, 0.35, 11.5);
    worldPos.z += cos(driftT * 0.95 + aOrbit.y) * 0.85;

    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
    float dist = max(1.5, -mvPosition.z);

    // Bioluminescent firefly pulse at night vs gentle Tyndall sun-mote shimmer by day
    float fireflyPulse = pow(0.5 + 0.5 * sin(uTime * 3.1 + aPhase * 6.2831), 2.4);
    float dayShimmer = 0.55 + 0.45 * sin(uTime * 1.6 + aPhase * 4.0);
    vTwinkle = mix(dayShimmer, fireflyPulse, uNightFactor);
    vNightMix = uNightFactor;

    float edgeFade = 1.0 - smoothstep(20.0, 27.5, length(rel.xz));
    vAlpha = edgeFade * mix(0.42, 0.92, uNightFactor) * vTwinkle;

    float baseSize = aScale * mix(22.0, 34.0, uNightFactor) * uPixelRatio;
    gl_PointSize = clamp(baseSize / dist, 1.5, 22.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ATMOSPHERIC_MOTES_FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vNightMix;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0) discard;

    // Soft optical bokeh disc with bright core
    float core = exp(-r2 * 4.2);
    float halo = (1.0 - r2) * (1.0 - r2) * 0.55;
    float intensity = core + halo;

    vec3 daySunMote = vec3(1.0, 0.93, 0.72);
    vec3 nightFirefly = mix(vec3(0.32, 0.98, 0.68), vec3(1.0, 0.84, 0.28), vTwinkle);
    vec3 col = mix(daySunMote, nightFirefly, vNightMix);

    gl_FragColor = vec4(col * (1.15 + vNightMix * 0.95), vAlpha * intensity);
  }
`;

const GOD_RAY_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const GOD_RAY_FRAG = /* glsl */ `
  uniform vec3 uRayColor;
  uniform float uRayOpacity;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    // Grazing-angle silhouette fade + vertical atmospheric attenuation (zero hard cone edges!)
    float fresnel = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 1.85);
    float verticalFade = smoothstep(0.0, 0.28, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
    float alpha = fresnel * verticalFade * uRayOpacity;
    if (alpha <= 0.0015) discard;
    gl_FragColor = vec4(uRayColor, alpha);
  }
`;

/**
 * AAA Zero-Allocation GPU Visual Effects & Atmospheric Subsystem:
 * 1. Pre-allocated `InstancedMesh` ring-buffer particle pool for sprint turf dust, cobblestone sparks,
 *    water splash droplets, citrus harvest bursts, and XPBD soft-body launch shockwaves.
 * 2. Hero-centered GPU vertex-wrapped Tyndall Sun Motes (day) & Bioluminescent Fireflies (dusk/night).
 * 3. Grazing-faded Volumetric Crepuscular Solar God-Ray Shafts aligned to the live directional sun vector.
 */
export class AaaWorldVfxEngine {
  public readonly rootGroup: THREE.Group;
  public readonly burstInstancedMesh: THREE.InstancedMesh;
  public readonly motesPoints: THREE.Points;
  public readonly godRayGroup: THREE.Group;

  private readonly maxParticles: number;
  private readonly isSoftwareGl: boolean;
  private cursor: number = 0;
  private activeParticleCount: number = 0;
  private hasLiveBurstParticles: boolean = false;

  // Strictly pre-allocated Structure-of-Arrays (SoA) buffers — ZERO per-frame heap allocations!
  private readonly posX: Float32Array;
  private readonly posY: Float32Array;
  private readonly posZ: Float32Array;
  private readonly velX: Float32Array;
  private readonly velY: Float32Array;
  private readonly velZ: Float32Array;
  private readonly age: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly baseScale: Float32Array;
  private readonly gravityScale: Float32Array;
  private readonly dragRate: Float32Array;

  // Scratch math objects reused across every tick & spawn
  private readonly _mat4 = new THREE.Matrix4();
  private readonly _pos = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _scale = new THREE.Vector3();
  private readonly _color = new THREE.Color();
  private readonly _upVec = new THREE.Vector3(0, 1, 0);
  private readonly _sunDirNorm = new THREE.Vector3(0.4, 0.8, 0.3);

  private readonly motesMat: THREE.ShaderMaterial | null;
  private readonly godRayMat: THREE.ShaderMaterial | THREE_WEBGPU.MeshBasicNodeMaterial;
  private readonly godRayTslColor: { value: THREE.Color } | null = null;
  private readonly godRayTslOpacity: { value: number } | null = null;
  private readonly isWebGpu: boolean;
  private footstepAccumDist: number = 0;

  constructor(
    scene: THREE.Scene,
    isSoftwareGl: boolean,
    pixelRatio: number = 1,
    isWebGpu: boolean = false
  ) {
    this.isSoftwareGl = isSoftwareGl;
    this.isWebGpu = isWebGpu;
    this.maxParticles = isSoftwareGl ? MAX_BURST_PARTICLES_SW : MAX_BURST_PARTICLES_HW;

    this.posX = new Float32Array(this.maxParticles);
    this.posY = new Float32Array(this.maxParticles);
    this.posZ = new Float32Array(this.maxParticles);
    this.velX = new Float32Array(this.maxParticles);
    this.velY = new Float32Array(this.maxParticles);
    this.velZ = new Float32Array(this.maxParticles);
    this.age = new Float32Array(this.maxParticles);
    this.maxLife = new Float32Array(this.maxParticles);
    this.baseScale = new Float32Array(this.maxParticles);
    this.gravityScale = new Float32Array(this.maxParticles);
    this.dragRate = new Float32Array(this.maxParticles);

    // Mark all slots inactive initially (age >= maxLife)
    for (let i = 0; i < this.maxParticles; i++) {
      this.age[i] = 1;
      this.maxLife[i] = 0;
    }

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'AaaWorldVfxRoot';

    // 1. Pre-allocated GPU Instanced Particle Pool (low-poly icosahedron puff/droplet)
    const puffGeo = new THREE.IcosahedronGeometry(0.16, 1);
    const puffMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.burstInstancedMesh = new THREE.InstancedMesh(puffGeo, puffMat, this.maxParticles);
    this.burstInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.burstInstancedMesh.frustumCulled = false;
    this.burstInstancedMesh.userData.ignoreCameraFade = true;

    // Initialize instanceColor buffer up front
    this._scale.setScalar(0);
    this._mat4.compose(this._pos, this._quat, this._scale);
    this._color.setHex(0xffffff);
    for (let i = 0; i < this.maxParticles; i++) {
      this.burstInstancedMesh.setMatrixAt(i, this._mat4);
      this.burstInstancedMesh.setColorAt(i, this._color);
    }
    this.burstInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.burstInstancedMesh.instanceColor) {
      this.burstInstancedMesh.instanceColor.needsUpdate = true;
    }
    this.rootGroup.add(this.burstInstancedMesh);

    // 2. Hero-Centered Atmospheric Sun-Motes & Bioluminescent Fireflies
    const motesCount = isSoftwareGl ? MOTES_COUNT_SW : MOTES_COUNT_HW;
    const motePositions = new Float32Array(motesCount * 3);
    const motePhases = new Float32Array(motesCount);
    const moteScales = new Float32Array(motesCount);
    const moteOrbits = new Float32Array(motesCount * 3);

    let seed = 0x51f3a9;
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < motesCount; i++) {
      motePositions[i * 3] = (nextRand() - 0.5) * 56.0;
      motePositions[i * 3 + 1] = 0.6 + nextRand() * 9.5;
      motePositions[i * 3 + 2] = (nextRand() - 0.5) * 56.0;
      motePhases[i] = nextRand() * Math.PI * 2;
      moteScales[i] = 0.65 + nextRand() * 0.95;
      moteOrbits[i * 3] = nextRand() * 6.28;
      moteOrbits[i * 3 + 1] = nextRand() * 6.28;
      moteOrbits[i * 3 + 2] = nextRand();
    }

    const motesGeo = new THREE.BufferGeometry();
    motesGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    motesGeo.setAttribute('aPhase', new THREE.BufferAttribute(motePhases, 1));
    motesGeo.setAttribute('aScale', new THREE.BufferAttribute(moteScales, 1));
    motesGeo.setAttribute('aOrbit', new THREE.BufferAttribute(moteOrbits, 3));

    if (this.isWebGpu) {
      this.motesMat = null;
      this.motesPoints = new THREE.Points(
        motesGeo,
        new THREE_WEBGPU.PointsNodeMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      this.motesPoints.visible = false;
    } else {
      this.motesMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uNightFactor: { value: 0 },
          uFocusCenter: { value: new THREE.Vector3(0, 0, 0) },
          uPixelRatio: { value: Math.max(1, pixelRatio) },
        },
        vertexShader: ATMOSPHERIC_MOTES_VERT,
        fragmentShader: ATMOSPHERIC_MOTES_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.motesPoints = new THREE.Points(motesGeo, this.motesMat);
      this.motesPoints.frustumCulled = false;
      this.motesPoints.visible = false; // Disabled: sparkles only come from physical sun reflections on water/metal
    }
    this.motesPoints.userData.ignoreCameraFade = true;
    this.rootGroup.add(this.motesPoints);

    // 3. Crepuscular Solar God-Ray Shafts (Fresnel-softened open-ended cones aligned to Sun)
    this.godRayGroup = new THREE.Group();
    this.godRayGroup.name = 'CrepuscularGodRays';
    if (this.isWebGpu) {
      const tslRayCol = uniform(new THREE.Color(0xfff3c4));
      const tslRayOp = uniform(isSoftwareGl ? 0.0 : 0.055);
      const tslMat = new THREE_WEBGPU.MeshBasicNodeMaterial();
      tslMat.transparent = true;
      tslMat.blending = THREE.AdditiveBlending;
      tslMat.depthWrite = false;
      tslMat.side = THREE.DoubleSide;
      tslMat.colorNode = tslRayCol;
      tslMat.opacityNode = (() => {
        const fresnel = pow(abs(dot(normalize(normalView), normalize(positionViewDirection))), 1.85);
        const vUv = uv().y;
        const verticalFade = smoothstep(0.0, 0.28, vUv).mul(float(1.0).sub(smoothstep(0.55, 1.0, vUv)));
        return fresnel.mul(verticalFade).mul(tslRayOp);
      })();
      this.godRayMat = tslMat;
      this.godRayTslColor = tslRayCol as unknown as { value: THREE.Color };
      this.godRayTslOpacity = tslRayOp as unknown as { value: number };
    } else {
      this.godRayMat = new THREE.ShaderMaterial({
        uniforms: {
          uRayColor: { value: new THREE.Color(0xfff3c4) },
          uRayOpacity: { value: isSoftwareGl ? 0.0 : 0.055 },
        },
        vertexShader: GOD_RAY_VERT,
        fragmentShader: GOD_RAY_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    }

    const rayOffsets: ReadonlyArray<[number, number, number, number]> = [
      [-11.5, 4.5, 3.6, 26.0],
      [9.2, -7.8, 4.4, 30.0],
      [-4.0, -14.5, 3.2, 24.0],
      [15.0, 8.5, 4.8, 32.0],
    ];
    for (let i = 0; i < GOD_RAY_CONES; i++) {
      const [ox, oz, radius, height] = rayOffsets[i];
      const coneGeo = new THREE.CylinderGeometry(radius * 0.42, radius, height, 14, 1, true);
      const cone = new THREE.Mesh(coneGeo, this.godRayMat);
      cone.position.set(ox, height * 0.42, oz);
      cone.frustumCulled = false;
      cone.userData.ignoreCameraFade = true;
      this.godRayGroup.add(cone);
    }
    this.godRayGroup.visible = !isSoftwareGl;
    this.rootGroup.add(this.godRayGroup);

    scene.add(this.rootGroup);
  }

  /**
   * Emits a zero-allocation burst of 3D instanced particles at `(wx, wy, wz)`.
   */
  public emitBurst(
    wx: number,
    wy: number,
    wz: number,
    kind: VfxBurstKind,
    count: number = 6,
    customHexColor?: number
  ): void {
    this.hasLiveBurstParticles = true;
    const clampedCount = Math.min(this.isSoftwareGl ? 6 : 18, Math.max(1, count | 0));
    let baseHex = 0xe7e5e4;
    let speed = 2.4;
    let upBias = 2.2;
    let life = 0.52;
    let scale = 0.85;
    let grav = 5.5;
    let drag = 3.2;

    switch (kind) {
      case 'turf_dust':
        baseHex = 0xd6d3d1;
        speed = 1.45;
        upBias = 1.15;
        life = 0.44;
        scale = 0.72;
        grav = -0.6; // gently billows upward!
        drag = 4.2;
        break;
      case 'cobble_spark':
        baseHex = 0xa8a29e; // Subtle matte stone dust instead of bright sparks
        speed = 1.15;
        upBias = 0.85;
        life = 0.3;
        scale = 0.36;
        grav = 3.8;
        drag = 4.4;
        break;
      case 'water_splash':
        baseHex = 0x7dd3fc;
        speed = 2.6;
        upBias = 3.4;
        life = 0.55;
        scale = 0.78;
        grav = 9.2;
        drag = 2.0;
        break;
      case 'citrus_burst':
        baseHex = 0xfbbf24;
        speed = 3.8;
        upBias = 4.2;
        life = 0.62;
        scale = 0.95;
        grav = 8.4;
        drag = 2.2;
        break;
      case 'xpbd_launch':
        baseHex = 0x38bdf8;
        speed = 5.2;
        upBias = 5.8;
        life = 0.68;
        scale = 1.25;
        grav = 6.5;
        drag = 2.6;
        break;
    }

    if (customHexColor !== undefined) {
      baseHex = customHexColor;
    }
    this._color.setHex(baseHex);

    for (let i = 0; i < clampedCount; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.maxParticles;

      const angle = (i / clampedCount) * Math.PI * 2 + (idx & 7) * 0.41;
      const radial = speed * (0.55 + ((idx * 17 + i * 31) % 10) * 0.065);

      this.posX[idx] = wx + Math.cos(angle) * 0.18;
      this.posY[idx] = wy + 0.06;
      this.posZ[idx] = wz + Math.sin(angle) * 0.18;

      this.velX[idx] = Math.cos(angle) * radial;
      this.velY[idx] = upBias * (0.7 + ((idx + i) % 5) * 0.14);
      this.velZ[idx] = Math.sin(angle) * radial;

      this.age[idx] = 0;
      this.maxLife[idx] = life * (0.82 + (i % 3) * 0.12);
      this.baseScale[idx] = scale * (0.78 + (i % 4) * 0.11);
      this.gravityScale[idx] = grav;
      this.dragRate[idx] = drag;

      this.burstInstancedMesh.setColorAt(idx, this._color);
    }

    if (this.burstInstancedMesh.instanceColor) {
      this.burstInstancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Emits cadence-paced sprint dust, cobblestone puffs, or water splash droplets as the Hero moves.
   * Returns `'turf' | 'cobble' | 'water' | null` when a footstep event fires so AudioService can play foley!
   */
  public recordHeroMovementStep(
    wx: number,
    wy: number,
    wz: number,
    planarSpeed: number,
    dt: number,
    inWater: boolean,
    onCauseway: boolean
  ): 'turf' | 'cobble' | 'water' | null {
    if (planarSpeed < 2.2) return null;
    this.footstepAccumDist += planarSpeed * dt;
    const stepStride = inWater ? 1.55 : 1.85;
    if (this.footstepAccumDist < stepStride) return null;
    this.footstepAccumDist = 0;

    if (inWater) {
      this.emitBurst(wx, wy + 0.08, wz, 'water_splash', 4);
      return 'water';
    }
    if (onCauseway) {
      this.emitBurst(wx, wy + 0.04, wz, 'cobble_spark', 3);
      return 'cobble';
    }
    this.emitBurst(wx, wy + 0.04, wz, 'turf_dust', 3);
    return 'turf';
  }

  /**
   * Zero-allocation per-frame simulation & instance matrix upload.
   */
  public update(
    dt: number,
    elapsedTime: number,
    heroWorldX: number,
    heroWorldY: number,
    heroWorldZ: number,
    sunDirection: THREE.Vector3,
    nightFactor: number,
    stormFactor: number,
    visible: boolean,
    perfMode: boolean = false
  ): void {
    this.rootGroup.visible = visible;
    if (!visible) return;

    this.motesPoints.visible = !perfMode;
    if (perfMode) {
      this.godRayGroup.visible = false;
    }

    // 1. Update Atmospheric Sun-Motes / Bioluminescent Fireflies Uniforms (WebGL2 only)
    if (!perfMode && this.motesMat) {
      this.motesMat.uniforms.uTime.value = elapsedTime;
      this.motesMat.uniforms.uNightFactor.value = nightFactor;
      (this.motesMat.uniforms.uFocusCenter.value as THREE.Vector3).set(
        heroWorldX,
        heroWorldY,
        heroWorldZ
      );
    }

    // 2. Align Crepuscular Solar God-Rays to Live Sun Vector (Hardware GPUs)
    if (!perfMode && !this.isSoftwareGl) {
      this._sunDirNorm.copy(sunDirection).normalize();
      const sunElev = this._sunDirNorm.y;
      const dayClear = Math.max(0, 1.0 - nightFactor * 1.35) * (1.0 - stormFactor * 0.85);
      // Peak crepuscular scattering during golden hour (0.12 <= sunElev <= 0.65)
      const goldenBoost =
        sunElev > 0.05 ? Math.min(1.35, 0.55 + (1.0 - Math.abs(sunElev - 0.36)) * 0.75) : 0.0;
      const rayOpacity = 0.024 * dayClear * goldenBoost;

      this.godRayGroup.visible = rayOpacity > 0.004;
      if (this.godRayGroup.visible) {
        this.godRayGroup.position.set(heroWorldX, 0, heroWorldZ);
        this._quat.setFromUnitVectors(this._upVec, this._sunDirNorm);
        for (let i = 0; i < this.godRayGroup.children.length; i++) {
          this.godRayGroup.children[i].quaternion.copy(this._quat);
        }
        if (this.godRayTslOpacity && this.godRayTslColor) {
          this.godRayTslOpacity.value = rayOpacity;
          this.godRayTslColor.value.setRGB(
            1.0,
            0.82 + Math.min(0.15, sunElev * 0.22),
            0.56 + Math.min(0.32, sunElev * 0.45)
          );
        } else if ((this.godRayMat as THREE.ShaderMaterial).uniforms) {
          const gMat = this.godRayMat as THREE.ShaderMaterial;
          gMat.uniforms.uRayOpacity.value = rayOpacity;
          (gMat.uniforms.uRayColor.value as THREE.Color).setRGB(
            1.0,
            0.82 + Math.min(0.15, sunElev * 0.22),
            0.56 + Math.min(0.32, sunElev * 0.45)
          );
        }
      }
    }

    // 3. Step Pre-Allocated Instanced Particle Pool (O(1) fast-skip when idle!)
    if (!this.hasLiveBurstParticles) {
      this.activeParticleCount = 0;
      return;
    }

    let liveCount = 0;
    let matrixDirty = false;

    for (let i = 0; i < this.maxParticles; i++) {
      const life = this.maxLife[i];
      if (life <= 0 || this.age[i] >= life) continue;

      this.age[i] += dt;
      matrixDirty = true;

      if (this.age[i] >= life) {
        this._pos.set(0, -999, 0);
        this._scale.setScalar(0);
        this._mat4.compose(this._pos, this._quat.identity(), this._scale);
        this.burstInstancedMesh.setMatrixAt(i, this._mat4);
        continue;
      }

      liveCount++;
      const tNorm = this.age[i] / life;
      const damp = Math.max(0, 1.0 - this.dragRate[i] * dt);
      this.velX[i] *= damp;
      this.velZ[i] *= damp;
      this.velY[i] -= this.gravityScale[i] * dt;

      this.posX[i] += this.velX[i] * dt;
      this.posY[i] += this.velY[i] * dt;
      this.posZ[i] += this.velZ[i] * dt;

      // Smooth bell-curve scale envelope: quick pop-in -> gentle dissipate
      const envelope = Math.sin(tNorm * Math.PI) * (1.0 - tNorm * 0.35);
      const s = Math.max(0.001, this.baseScale[i] * envelope);

      this._pos.set(this.posX[i], this.posY[i], this.posZ[i]);
      this._quat.identity();
      this._scale.setScalar(s);
      this._mat4.compose(this._pos, this._quat, this._scale);
      this.burstInstancedMesh.setMatrixAt(i, this._mat4);
    }

    this.activeParticleCount = liveCount;
    this.hasLiveBurstParticles = liveCount > 0;
    if (matrixDirty) {
      this.burstInstancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public getActiveParticleCount(): number {
    return this.activeParticleCount;
  }

  public setPixelRatio(pixelRatio: number): void {
    if (this.motesMat) {
      this.motesMat.uniforms.uPixelRatio.value = Math.max(1, pixelRatio);
    }
  }

  public dispose(): void {
    this.burstInstancedMesh.geometry.dispose();
    (this.burstInstancedMesh.material as THREE.Material).dispose();
    this.motesPoints.geometry.dispose();
    if (this.motesMat) {
      this.motesMat.dispose();
    } else {
      (this.motesPoints.material as THREE.Material).dispose();
    }
    this.godRayGroup.children.forEach((c) => {
      if ((c as THREE.Mesh).geometry) {
        (c as THREE.Mesh).geometry.dispose();
      }
    });
    this.godRayMat.dispose();
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
