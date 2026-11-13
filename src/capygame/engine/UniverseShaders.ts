import * as THREE from 'three';

/**
 * Shared GLSL 3D Simplex/Gradient Noise, Fractional Brownian Motion (FBM),
 * Planckian Blackbody Locus, and ACES Filmic HDR Tone Mapping utilities.
 * Compatible with both Hardware WebGL2 and ANGLE/SwiftShader environments.
 */
const GLSL_NOISE_AND_ACES = /* glsl */ `
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float noise3D(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float fbm4(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  mat3 rot = mat3(
    0.00,  0.80,  0.60,
   -0.80,  0.36, -0.48,
   -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 4; i++) {
    v += a * noise3D(p);
    p = rot * p * 2.03 + vec3(13.7, 7.3, 5.1);
    a *= 0.5;
  }
  return v;
}

float fbm5(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  mat3 rot = mat3(
    0.00,  0.80,  0.60,
   -0.80,  0.36, -0.48,
   -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 5; i++) {
    v += a * noise3D(p);
    p = rot * p * 2.05 + vec3(17.1, 9.2, 3.7);
    a *= 0.5;
  }
  return v;
}

float ridgedFbm4(vec3 p) {
  float v = 0.0;
  float a = 0.55;
  float weight = 1.0;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(noise3D(p) * 2.0 - 1.0);
    n = n * n * weight;
    weight = clamp(n * 1.8, 0.0, 1.0);
    v += n * a;
    p = p * 2.12 + vec3(5.3, 11.9, 8.4);
    a *= 0.48;
  }
  return v;
}

vec3 acesToneMap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
`;

/**
 * Converts stellar effective temperature (Kelvin, 2200K - 35000K) to linear RGB
 * matching real astrophysical Planckian blackbody star colors.
 */
export function blackbodyKelvinToRgb(kelvin: number, out: THREE.Color): THREE.Color {
  const temp = THREE.MathUtils.clamp(kelvin, 2000, 40000) / 100;
  let r: number;
  let g: number;
  let b: number;

  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    b = 255;
  }

  out.setRGB(
    THREE.MathUtils.clamp(r / 255, 0, 1),
    THREE.MathUtils.clamp(g / 255, 0, 1),
    THREE.MathUtils.clamp(b / 255, 0, 1)
  );
  return out;
}

export interface StarPsfOptions {
  baseSize?: number;
  minPixelSize?: number;
  maxPixelSize?: number;
  diffractionStrength?: number;
  opacity?: number;
  additive?: boolean;
}

/**
 * Hubble / SpaceEngine Point-Spread-Function (PSF) Star & Galaxy Field Material.
 * Replaces square PointsMaterial pixels with circular Airy cores, King-profile optical wings,
 * sub-pixel luminous flux conservation, and 4-vane secondary-mirror diffraction spikes.
 */
export function createStarPsfMaterial(opts: StarPsfOptions = {}): THREE.ShaderMaterial {
  const {
    baseSize = 16.0,
    minPixelSize = 1.8,
    maxPixelSize = 44.0,
    diffractionStrength = 0.55,
    opacity = 1.0,
    additive = true,
  } = opts;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uBaseSize: { value: baseSize },
      uMinPx: { value: minPixelSize },
      uMaxPx: { value: maxPixelSize },
      uDiffraction: { value: diffractionStrength },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aScale;
      attribute float aLuminosity;
      varying vec3 vStarColor;
      varying float vLum;
      varying float vFluxAtten;
      uniform float uBaseSize;
      uniform float uMinPx;
      uniform float uMaxPx;

      void main() {
        vStarColor = color;
        vLum = aLuminosity;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = max(0.35, -mvPosition.z);
        float rawPx = uBaseSize * aScale * (28.0 / dist);
        // Conserve luminous flux when physical point size falls below uMinPx
        vFluxAtten = clamp(rawPx / uMinPx, 0.18, 1.0);
        gl_PointSize = clamp(rawPx, uMinPx, uMaxPx);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vStarColor;
      varying float vLum;
      varying float vFluxAtten;
      uniform float uDiffraction;
      uniform float uOpacity;

      void main() {
        vec2 uv = (gl_PointCoord - 0.5) * 2.0;
        float r = length(uv);
        if (r > 1.0) discard;

        // Sharp Airy core + smooth optical halo falloff (zero square corners)
        float core = exp(-r * r * 22.0);
        float halo = 0.42 * exp(-r * 4.4) * (1.0 - smoothstep(0.68, 1.0, r));

        // Subtle 45-deg rotated HST 4-vane secondary-mirror spider diffraction spikes
        vec2 rotUv = vec2(uv.x * 0.966 - uv.y * 0.259, uv.x * 0.259 + uv.y * 0.966);
        float spikeX = exp(-abs(rotUv.y) * 30.0) * exp(-abs(rotUv.x) * 2.8);
        float spikeY = exp(-abs(rotUv.x) * 30.0) * exp(-abs(rotUv.y) * 2.8);
        float spikes = (spikeX + spikeY) * uDiffraction * smoothstep(0.45, 1.0, vLum) * (1.0 - r);

        float intensity = (core * 1.45 + halo + spikes) * (0.45 + 0.85 * vLum) * vFluxAtten;
        vec3 hdr = mix(vStarColor, vec3(1.0, 0.99, 0.97), clamp(core * 0.78, 0.0, 1.0)) * intensity;
        // Soft highlight compression prevents harsh white square clipping
        vec3 mapped = hdr / (vec3(1.0) + hdr * 0.42);
        float alpha = clamp(intensity * uOpacity, 0.0, 1.0);
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(mapped, alpha);
      }
    `,
  });
}

/**
 * Miniature Resolved Background Galaxy Impostor Shader (Hubble Ultra Deep Field).
 * Renders tiny inclined spiral and golden elliptical galaxies across cosmic voids.
 */
export function createDeepFieldGalaxyMaterial(opacity: number = 0.92): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aScale;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vSeed;

      void main() {
        vColor = color;
        vSeed = aSeed;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = max(1.0, -mvPosition.z);
        gl_PointSize = clamp(aScale * (120.0 / dist), 2.2, 26.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vSeed;
      uniform float uOpacity;

      void main() {
        vec2 p = (gl_PointCoord - 0.5) * 2.0;
        float angle = vSeed * 6.2831853;
        float ca = cos(angle);
        float sa = sin(angle);
        vec2 q = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
        // Inclination squash simulates edge-on vs face-on deep-field galaxies
        float incl = 0.32 + 0.68 * fract(vSeed * 7.13);
        q.y /= incl;
        float r = length(q);
        if (r > 1.0) discard;

        float isSpiral = step(0.35, fract(vSeed * 13.7));
        float theta = atan(q.y, q.x);
        float armWave = 0.5 + 0.5 * cos(2.0 * theta - 7.5 * log(max(0.06, r)));
        float bulge = exp(-r * r * 18.0);
        float disk = exp(-r * 3.4) * mix(1.0, 0.45 + 0.75 * armWave, isSpiral * smoothstep(0.1, 0.45, r));
        float edgeFade = 1.0 - smoothstep(0.65, 1.0, r);
        float lum = (bulge * 1.3 + disk * 0.75) * edgeFade;

        vec3 coreCol = vec3(1.0, 0.93, 0.78);
        vec3 col = mix(vColor, coreCol, clamp(bulge * 1.2, 0.0, 1.0)) * lum;
        col = col / (vec3(1.0) + col * 0.5);
        gl_FragColor = vec4(col, clamp(lum * uOpacity, 0.0, 0.95));
      }
    `,
  });
}

/**
 * Volumetric FBM Emission & Reflection Nebula Impostor / Envelope Material.
 * Uses NormalBlending with internal optical-depth self-shielding and ACES filmic tone mapping
 * so overlapping ionized cores NEVER blow out to flat #FFFFFF white, and smooth radial envelope
 * falloff guarantees ZERO polygonal triangle edges.
 */
export function createVolumetricNebulaMaterial(opts: {
  seedOffset?: number;
  hubblePaletteMix?: number;
  opacity?: number;
  isInnerCore?: boolean;
}): THREE.ShaderMaterial {
  const {
    seedOffset = 0.0,
    hubblePaletteMix = 0.35,
    opacity = 0.88,
    isInnerCore = false,
  } = opts;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seedOffset },
      uHubbleMix: { value: hubblePaletteMix },
      uOpacity: { value: opacity },
      uInnerCore: { value: isInnerCore ? 1.0 : 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vViewDir;
      varying vec3 vNormalView;

      void main() {
        vUv = uv;
        vLocalPos = position;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vViewDir;
      varying vec3 vNormalView;
      uniform float uTime;
      uniform float uSeed;
      uniform float uHubbleMix;
      uniform float uOpacity;
      uniform float uInnerCore;

      void main() {
        vec2 centered = (vUv - 0.5) * 2.0;
        float r2d = length(centered);
        // Smooth radial falloff to strict 0 before quad perimeter -> zero polygon edges!
        float radialMask = pow(clamp(1.0 - r2d, 0.0, 1.0), 1.85);
        if (radialMask <= 0.002) discard;

        vec3 sampleCoord = vLocalPos * 0.14 + vec3(uSeed * 3.7, uSeed * 1.9, uTime * 0.012);
        // Domain-warped turbulent gas filaments (Orion / Carina H-II shock structure)
        vec3 warp = vec3(
          fbm4(sampleCoord * 1.15 + vec3(1.2, 4.5, 2.1)),
          fbm4(sampleCoord * 1.15 + vec3(6.8, 2.3, 8.4)),
          fbm4(sampleCoord * 1.15 + vec3(3.9, 9.1, 5.2))
        );
        float gas = fbm5(sampleCoord * 1.6 + (warp - 0.5) * 2.35);
        float ridges = ridgedFbm4(sampleCoord * 2.1 + (warp - 0.5) * 1.8);
        float dust = fbm4(sampleCoord * 2.6 - warp * 1.4 + vec3(11.0));

        // Central stellar-wind cavity (Trapezium-like blown bubble) + bright ionization wall
        float cavity = smoothstep(0.06, 0.44, r2d + (gas - 0.5) * 0.26);
        float ionWall = exp(-pow((r2d - 0.34 + (ridges - 0.5) * 0.22) * 3.8, 2.0));

        // Natural Broadband (H-alpha crimson-rose + O-III cyan-teal + reflection blue)
        vec3 hAlphaNat = vec3(0.88, 0.16, 0.30);
        vec3 oIII_Nat  = vec3(0.10, 0.68, 0.86);
        vec3 reflBlue  = vec3(0.22, 0.44, 0.95);

        // Hubble SHO Narrowband (S-II ruby-gold, H-alpha warm gold-emerald, O-III deep sapphire-cyan)
        vec3 sII_Sho   = vec3(0.95, 0.46, 0.14);
        vec3 hAlphaSho = vec3(0.86, 0.66, 0.24);
        vec3 oIII_Sho  = vec3(0.08, 0.62, 0.88);

        vec3 colOuter = mix(hAlphaNat, sII_Sho, uHubbleMix);
        vec3 colMid   = mix(reflBlue, hAlphaSho, uHubbleMix);
        vec3 colInner = mix(oIII_Nat, oIII_Sho, uHubbleMix);

        float o3Weight = clamp(ionWall * 0.9 + (1.0 - r2d) * 0.55 + uInnerCore * 0.35, 0.0, 1.0);
        vec3 emission = mix(colOuter, colMid, clamp(ridges, 0.0, 1.0));
        emission = mix(emission, colInner, o3Weight);

        // Bright ionization shock ridges without whiteout
        float shockGlow = pow(clamp(ridges, 0.0, 1.0), 2.4) * 1.35 + ionWall * 0.75;
        vec3 hdr = emission * (0.42 + gas * 1.15 + shockGlow) * mix(0.62, 1.0, cavity);

        // Dark foreground Bok-globule dust lanes absorbing background emission!
        float dustLane = smoothstep(0.54, 0.82, dust) * smoothstep(0.15, 0.75, r2d);
        vec3 dustTint = vec3(0.035, 0.022, 0.028);
        vec3 toneMapped = acesToneMap(hdr * 1.15);
        vec3 finalRgb = mix(toneMapped, dustTint, dustLane * 0.84);

        float density = clamp((gas * 0.72 + ridges * 0.52 + dustLane * 0.45) * radialMask, 0.0, 1.0);
        float alpha = clamp(density * uOpacity, 0.0, 0.88);
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(finalRgb, alpha);
      }
    `,
  });
}

/**
 * Hubble / JWST M16 "Pillars of Creation" Absorptive Molecular Dust Pillar Shader.
 * Renders towering, craggy, dark light-absorbing H2 dust silhouettes with luminous
 * photo-evaporative cyan/gold UV ionization rims and zero hard cylinder/polygon edges.
 */
export function createDustPillarMaterial(opts: {
  seed?: number;
  hubblePaletteMix?: number;
  opacity?: number;
}): THREE.ShaderMaterial {
  const { seed = 1.0, hubblePaletteMix = 0.45, opacity = 0.96 } = opts;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uHubbleMix: { value: hubblePaletteMix },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vLocalPos;

      void main() {
        vUv = uv;
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec2 vUv;
      varying vec3 vLocalPos;
      uniform float uTime;
      uniform float uSeed;
      uniform float uHubbleMix;
      uniform float uOpacity;

      void main() {
        // vUv.y: 0.0 = wide dusty base, 1.0 = photo-evaporating protostellar tip
        float y = vUv.y;
        float x = (vUv.x - 0.5) * 2.0;

        vec3 p = vec3(x * 2.4, y * 4.6, uSeed * 5.3 + uTime * 0.01);
        float billow = fbm5(p * 1.45);
        float crags  = ridgedFbm4(p * 2.6 + vec3(billow * 1.2));

        // Tapering trunk width with organic FBM billowing fingers near top
        float halfWidth = mix(0.62, 0.20, pow(y, 0.82)) + (billow - 0.5) * 0.38;
        // Rounded protostellar head cap around y ~ 0.84, fading to wispy evaporating streamers above
        float capDist = length(vec2(x / max(0.12, halfWidth), max(0.0, (y - 0.82) / 0.16)));
        float bodyField = 1.0 - smoothstep(0.58, 1.02, max(abs(x) / max(0.12, halfWidth), capDist - 0.12));
        // Soft base fade so bottom never shows a flat horizontal cut
        float baseFade = smoothstep(0.0, 0.22, y);
        float silhouette = clamp(bodyField * baseFade * (0.65 + 0.65 * billow), 0.0, 1.0);

        // Outer UV-ionized photo-evaporative halo & crisp rim lighting from OB stars above (+Y)
        float outerHalo = (1.0 - smoothstep(0.75, 1.42, max(abs(x) / max(0.14, halfWidth), capDist - 0.05))) * baseFade;
        float rimBand = clamp(outerHalo - silhouette * 0.82, 0.0, 1.0);
        float topIllum = smoothstep(0.32, 0.92, y + (crags - 0.5) * 0.25);

        // Cold opaque dark dust core vs warm infrared dust folds vs bright ionized rim
        vec3 darkCore = vec3(0.032, 0.020, 0.024);
        vec3 warmFold = mix(vec3(0.34, 0.13, 0.07), vec3(0.42, 0.20, 0.06), uHubbleMix);
        vec3 rimGold  = mix(vec3(0.95, 0.42, 0.24), vec3(1.0, 0.72, 0.26), uHubbleMix);
        vec3 rimCyan  = vec3(0.14, 0.78, 0.96);

        vec3 interior = mix(darkCore, warmFold, clamp(crags * 0.65 * (0.35 + 0.65 * topIllum), 0.0, 0.85));
        vec3 rimHdr = rimGold * (rimBand * (1.6 + 1.8 * topIllum)) + rimCyan * (outerHalo * 0.45 * topIllum);

        // Embedded nascent protostar IR glint right inside the pillar tip
        float tipDist = length(vec2(x * 2.8, (y - 0.80) * 5.5));
        vec3 irStar = vec3(1.0, 0.82, 0.52) * exp(-tipDist * tipDist * 9.0) * 1.4;

        vec3 rgb = acesToneMap(interior + rimHdr + irStar);
        float alpha = clamp((silhouette * 0.94 + outerHalo * 0.36 * topIllum) * uOpacity, 0.0, 0.96);
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(rgb, alpha);
      }
    `,
  });
}

/**
 * Grand-Design Spiral Galaxy Volumetric Continuum & Dark Dust-Lane Disc Shader.
 * Renders the smooth Sersic stellar bulge, logarithmic density-wave arms, H-II emission glows,
 * and dark absorbing fractal dust lanes threading the inner spiral arms.
 */
export function createSpiralGalaxyDiscMaterial(opts: {
  arms?: number;
  opacity?: number;
  morphology?: 'spiral' | 'barred_spiral' | 'elliptical' | 'irregular';
}): THREE.ShaderMaterial {
  const { arms = 2, opacity = 0.94, morphology = 'spiral' } = opts;
  const morphologyVal =
    morphology === 'barred_spiral'
      ? 1.0
      : morphology === 'elliptical'
        ? 2.0
        : morphology === 'irregular'
          ? 3.0
          : 0.0;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uArms: { value: arms },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uMorphology: { value: morphologyVal },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec2 vUv;
      uniform float uArms;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uMorphology;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;

        float theta = atan(p.y, p.x);
        vec3 nCoord = vec3(p * 4.5, uTime * 0.01);
        vec3 mapped = vec3(0.0);
        float alpha = 0.0;

        if (uMorphology < 0.5) {
          // --- 0. GRAND-DESIGN SPIRAL GALAXY ---
          float logR = log(max(0.035, r));
          float spiralPhase = uArms * theta - 4.8 * logR;
          float arm = pow(0.5 + 0.5 * cos(spiralPhase), 2.2);
          float spur = pow(0.5 + 0.5 * cos(spiralPhase * 2.0 + 1.1), 3.5) * 0.45;
          // Orion-Cygnus Spur bridge around Earth's galactic location (~26,000 ly = 0.495 R_gal, theta ~ 1.22)
          vec2 orionLocal = p - vec2(0.495 * cos(1.22), 0.495 * sin(1.22));
          float orionSpur = exp(-dot(orionLocal, orionLocal) * 32.0) * 0.65;

          float turb = fbm5(nCoord + vec3(cos(spiralPhase) * 0.4, sin(spiralPhase) * 0.4, 0.0));
          float dustNoise = ridgedFbm4(nCoord * 1.9 + vec3(3.1));

          float bulge = exp(-pow(r / 0.19, 1.35)) * 2.4 + exp(-r * r * 140.0) * 2.2;
          float discEnv = exp(-r * 3.1) * (1.0 - smoothstep(0.76, 1.0, r));
          float armDensity = discEnv * (0.28 + 1.25 * (arm + spur + orionSpur) * (0.55 + 0.75 * turb));

          float dustPhase = pow(0.5 + 0.5 * cos(spiralPhase + 0.58), 5.0);
          float dustLane = dustPhase * dustNoise * smoothstep(0.08, 0.24, r) * (1.0 - smoothstep(0.68, 0.95, r));
          float hiiKnots = (pow(arm, 4.0) + orionSpur * 0.55) * smoothstep(0.58, 0.85, turb) * smoothstep(0.14, 0.35, r) * discEnv;

          vec3 bulgeCol = vec3(1.0, 0.86, 0.64);
          vec3 armCol   = vec3(0.48, 0.70, 1.0);
          vec3 hiiCol   = vec3(0.96, 0.24, 0.48);
          vec3 dustCol  = vec3(0.035, 0.022, 0.026);

          vec3 hdr = bulgeCol * bulge + armCol * armDensity * 1.35 + hiiCol * hiiKnots * 2.6;
          mapped = acesToneMap(hdr);
          mapped = mix(mapped, dustCol, clamp(dustLane * 1.35, 0.0, 0.88));
          alpha = clamp((bulge * 0.55 + armDensity * 1.15 + dustLane * 0.55), 0.0, 0.95) * uOpacity;
        } else if (uMorphology < 1.5) {
          // --- 1. BARRED SPIRAL GALAXY (SBb) ---
          float barDist = length(vec2(p.x * 0.9, p.y * 3.2));
          float barBody = exp(-pow(barDist / 0.42, 2.0)) * smoothstep(0.48, 0.04, abs(p.y)) * 2.9;
          float barBulge = exp(-pow(r / 0.16, 1.35)) * 3.1 + exp(-r * r * 160.0) * 2.4;

          float logR = log(max(0.18, r));
          float barSpiralPhase = 2.0 * theta - 4.4 * logR + 0.75;
          float barArm = pow(0.5 + 0.5 * cos(barSpiralPhase), 2.8) * smoothstep(0.24, 0.55, r);
          vec2 orionLocal = p - vec2(0.495 * cos(1.22), 0.495 * sin(1.22));
          float orionSpur = exp(-dot(orionLocal, orionLocal) * 30.0) * 0.6;

          float turb = fbm5(nCoord * 1.1 + vec3(0.4, 0.8, 0.0));
          float dustNoise = ridgedFbm4(nCoord * 2.2 + vec3(1.7));
          float discEnv = exp(-r * 2.9) * (1.0 - smoothstep(0.78, 1.0, r));
          float barArmDensity = discEnv * (0.24 + 1.35 * (barArm + orionSpur) * (0.6 + 0.7 * turb));

          // Leading-edge dust lanes along stellar bar and inner spiral arms
          float barDust = smoothstep(0.03, 0.12, abs(p.y)) * smoothstep(0.45, 0.05, abs(p.y)) * smoothstep(0.05, 0.38, abs(p.x)) * dustNoise * 0.85;
          float armDust = pow(0.5 + 0.5 * cos(barSpiralPhase + 0.62), 4.6) * dustNoise * smoothstep(0.22, 0.75, r);
          float totalDust = clamp(barDust + armDust, 0.0, 1.0);

          float hiiKnots = (pow(barArm, 3.5) + orionSpur * 0.5) * smoothstep(0.55, 0.82, turb) * smoothstep(0.25, 0.45, r) * discEnv;

          vec3 bulgeCol = vec3(1.0, 0.88, 0.66);
          vec3 barCol   = vec3(0.95, 0.82, 0.60);
          vec3 armCol   = vec3(0.44, 0.68, 1.0);
          vec3 hiiCol   = vec3(0.98, 0.22, 0.46);
          vec3 dustCol  = vec3(0.03, 0.018, 0.022);

          vec3 hdr = bulgeCol * barBulge + barCol * barBody * 1.2 + armCol * barArmDensity * 1.4 + hiiCol * hiiKnots * 2.8;
          mapped = acesToneMap(hdr);
          mapped = mix(mapped, dustCol, clamp(totalDust * 1.3, 0.0, 0.88));
          alpha = clamp((barBulge * 0.55 + barBody * 0.65 + barArmDensity * 1.1 + totalDust * 0.5), 0.0, 0.95) * uOpacity;
        } else if (uMorphology < 2.5) {
          // --- 2. GIANT ELLIPTICAL GALAXY (E3) ---
          float ellipR = length(vec2(p.x, p.y * 1.35));
          float deVauc = exp(-7.67 * (pow(max(0.001, ellipR / 0.32), 0.25) - 1.0));
          float ellipCore = exp(-pow(ellipR / 0.13, 1.2)) * 3.4;
          float ellipHalo = exp(-ellipR * 2.3) * (1.0 - smoothstep(0.80, 1.0, ellipR));

          float subtleGranulation = fbm4(vec3(p * 2.5, uTime * 0.005)) * 0.12;

          vec3 ellipCenterCol = vec3(1.0, 0.90, 0.72);
          vec3 ellipMidCol    = vec3(0.96, 0.78, 0.54);
          vec3 ellipOuterCol  = vec3(0.85, 0.62, 0.40);
          vec3 col = mix(ellipCenterCol, ellipMidCol, smoothstep(0.05, 0.45, ellipR));
          col = mix(col, ellipOuterCol, smoothstep(0.45, 0.85, ellipR));

          vec3 hdr = col * (deVauc * 1.85 + ellipCore + ellipHalo * 0.9 + subtleGranulation);
          mapped = acesToneMap(hdr);
          alpha = clamp((deVauc * 1.45 + ellipCore * 0.75 + ellipHalo * 0.85), 0.0, 0.95) * uOpacity;
        } else {
          // --- 3. CLUMPY IRREGULAR / STARBURST GALAXY (Irr / LMC) ---
          vec2 irrP = p - vec2(0.12, -0.09);
          float irrR = length(irrP);
          float irrTurb = fbm5(vec3(p * 3.6, uTime * 0.012));
          float irrTurb2 = fbm4(vec3((p + 1.4) * 5.4, uTime * 0.018));
          float dustNoise = ridgedFbm4(vec3(p * 3.2, 0.5));

          float irrCore = exp(-pow(irrR / 0.24, 1.4)) * 2.4;
          float discEnv = exp(-length(p) * 2.2) * (1.0 - smoothstep(0.74, 1.0, length(p)));
          float irrClumps = pow(irrTurb, 2.2) * discEnv * 3.8;
          float hiiStarburst = pow(irrTurb2, 3.2) * smoothstep(0.42, 0.82, irrTurb) * discEnv * 4.2;

          // Asymmetric chaotic dust ribbons
          float irrDust = dustNoise * smoothstep(0.35, 0.75, irrTurb) * smoothstep(0.1, 0.6, length(p));

          vec3 coreCol = vec3(1.0, 0.85, 0.66);
          vec3 clumpCol = vec3(0.45, 0.74, 1.0);
          vec3 hiiCol = vec3(0.98, 0.20, 0.52);
          vec3 dustCol = vec3(0.03, 0.02, 0.025);

          vec3 hdr = coreCol * irrCore + clumpCol * irrClumps * 1.35 + hiiCol * hiiStarburst * 2.5;
          mapped = acesToneMap(hdr);
          mapped = mix(mapped, dustCol, clamp(irrDust * 1.1, 0.0, 0.84));
          alpha = clamp((irrCore * 0.65 + irrClumps * 1.1 + hiiStarburst * 0.85 + irrDust * 0.4), 0.0, 0.95) * uOpacity;
        }

        alpha *= 1.0 - smoothstep(0.82, 1.0, r);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(mapped, alpha);
      }
    `,
  });
}

/**
 * Cosmological Warm-Hot Intergalactic Medium (WHIM) Soft Filament Ribbon Material.
 * Eliminates hard purple wireframe cylinder edges with soft transverse Gaussian density.
 */
export function createCosmicFilamentRibbonMaterial(opacity: number = 0.55): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec2 vUv;
      varying vec3 vPos;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        // Transverse cross-section fade: 0 at ribbon edges, 1 along central gravitational spine
        float crossProfile = pow(sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265), 2.2);
        float endFade = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265);
        float n = fbm4(vPos * 0.35 + vec3(0.0, 0.0, uTime * 0.02));
        float density = crossProfile * pow(endFade, 0.55) * (0.45 + 0.85 * n);

        // Warm golden cluster nodes at ends -> cool cobalt-violet WHIM baryon bridge in voids
        float nodeProximity = 1.0 - endFade;
        vec3 whimCol = mix(vec3(0.28, 0.46, 0.92), vec3(0.98, 0.78, 0.42), pow(nodeProximity, 1.6));
        vec3 col = acesToneMap(whimCol * density * 1.35);
        float alpha = clamp(density * uOpacity, 0.0, 0.75);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/**
 * Planck / WMAP Cosmic Microwave Background (CMB) Spherical Acoustic Anisotropy Shader.
 * Computes multi-scale spherical temperature fluctuations without low-res 2D canvas seams.
 */
export function createCmbAnisotropyMaterial(opacity: number = 0.82): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec3 vDir;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        // Acoustic baryon-photon oscillation peaks (1 deg scale speckles + Sachs-Wolfe quadrupole)
        float largeScale = fbm4(vDir * 2.6);
        float acousticPeak = fbm5(vDir * 14.5 + vec3(largeScale * 0.8));
        float fineScale = noise3D(vDir * 36.0) * 0.22;
        float dt = clamp(0.48 * acousticPeak + 0.34 * largeScale + fineScale, 0.0, 1.0);

        // Authentic Planck Collaboration microkelvin temperature colormap
        vec3 coldDeep = vec3(0.02, 0.08, 0.34);
        vec3 coldCyan = vec3(0.08, 0.48, 0.78);
        vec3 neutral  = vec3(0.88, 0.89, 0.76);
        vec3 warmGold = vec3(0.94, 0.54, 0.14);
        vec3 hotRed   = vec3(0.62, 0.08, 0.05);

        vec3 col;
        if (dt < 0.35) {
          col = mix(coldDeep, coldCyan, dt / 0.35);
        } else if (dt < 0.52) {
          col = mix(coldCyan, neutral, (dt - 0.35) / 0.17);
        } else if (dt < 0.72) {
          col = mix(neutral, warmGold, (dt - 0.52) / 0.20);
        } else {
          col = mix(warmGold, hotRed, (dt - 0.72) / 0.28);
        }

        gl_FragColor = vec4(col * 0.88, uOpacity);
      }
    `,
  });
}

/**
 * G2V Solar Photosphere Shader: 3D convective granulation cells, limb darkening,
 * magnetic sunspot groups, and bright faculae.
 */
export function createSolarPhotosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1.0 },
      uAlphaRatio: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalObj;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vNormalObj = normalize(position);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec3 vNormalObj;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uAlphaRatio;

      void main() {
        float mu = clamp(dot(vNormalView, vViewDir), 0.0, 1.0);
        // Eddington solar limb darkening law I(mu) = 0.4 + 0.6*mu
        float limb = pow(mu, 0.52);

        vec3 p = vNormalObj * 9.5 + vec3(uTime * 0.08, -uTime * 0.05, uTime * 0.06);
        float gran = fbm5(p * 2.2);
        float superGran = ridgedFbm4(vNormalObj * 5.0 + vec3(uTime * 0.04));
        float spotField = fbm4(vNormalObj * 3.8 + vec3(2.4));
        float sunspot = smoothstep(0.73, 0.81, spotField) * smoothstep(0.55, 0.15, abs(vNormalObj.y));

        vec3 coreWhite = vec3(1.0, 0.97, 0.88);
        vec3 midGold   = vec3(1.0, 0.72, 0.22);
        vec3 limbAmber = vec3(0.88, 0.32, 0.06);
        vec3 umbra     = vec3(0.18, 0.05, 0.01);

        vec3 photo = mix(limbAmber, midGold, smoothstep(0.0, 0.58, limb));
        photo = mix(photo, coreWhite, smoothstep(0.45, 1.0, limb) * (0.55 + 0.45 * gran));
        photo += vec3(0.28, 0.16, 0.04) * superGran * (1.0 - limb * 0.5);
        photo = mix(photo, umbra, sunspot * 0.85);

        float alphaBoost = clamp(uAlphaRatio, 0.55, 2.3);
        vec3 tempTint = mix(vec3(0.86, 0.94, 1.06), vec3(1.10, 0.94, 0.82), smoothstep(0.65, 1.85, alphaBoost));
        photo *= tempTint * (0.78 + 0.22 * alphaBoost);

        gl_FragColor = vec4(acesToneMap(photo * 1.45), uOpacity);
      }
    `,
  });
}

/**
 * SpaceEngine-Grade Habitable Planet Surface Shader (FBM Continents, Bathymetry,
 * Cordilleras, Polar Ice Caps, Specular Ocean Sun-Glint & Night-Side Sanctuary Lights).
 */
export function createHabitablePlanetMaterial(
  sunDir: THREE.Vector3,
  opts?: { useSphereDirAttr?: boolean; sanctuaryDir?: THREE.Vector3 }
): THREE.ShaderMaterial {
  const defaultSancDir = (
    opts?.sanctuaryDir ?? new THREE.Vector3(0.6188, 0.3827, 0.6867)
  )
    .clone()
    .normalize();

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uTime: { value: 0 },
      uOpacity: { value: 1.0 },
      uUseSphereDirAttr: { value: opts?.useSphereDirAttr ? 1.0 : 0.0 },
      uDetailScale: { value: 0.0 },
      uSanctuaryDir: { value: defaultSancDir },
    },
    vertexShader: /* glsl */ `
      ${opts?.useSphereDirAttr ? 'attribute vec3 aSphereDir;' : ''}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vObjPos = ${opts?.useSphereDirAttr ? 'normalize(aSphereDir)' : 'normalize(position)'};
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uDetailScale;
      uniform vec3 uSanctuaryDir;

      float evalTerrainHeight(vec3 p, float detailWeight, out float ridgesOut, out float detailOut) {
        vec3 warp = vec3(
          fbm4(p * 2.1 + vec3(1.7)),
          fbm4(p * 2.1 + vec3(8.3)),
          fbm4(p * 2.1 + vec3(4.9))
        );
        float cont = fbm5(p * 2.65 + (warp - 0.5) * 0.85);
        float ridges = ridgedFbm4(p * 9.5 + warp * 1.4);
        float detail = fbm4(p * 22.0);

        // Anchor the primary Sanctuary continent & archipelago smoothly around uSanctuaryDir (22.5N, 42.0E)
        float dSanc = length(p - normalize(uSanctuaryDir));
        float continentPedestal = exp(-pow(dSanc / 0.23, 2.1)) * 0.165;
        float islandArchipelago = exp(-pow(dSanc / 0.036, 2.0)) * 0.085;
        // Gentle sunny landing lagoon indentation beside core meadow
        float lagoonCut = exp(-pow(length((p - normalize(uSanctuaryDir)) * vec3(1.0, 1.4, 1.0) - vec3(0.011, 0.0, -0.008)) / 0.0075, 2.0)) * 0.065;

        float microTerrain = 0.0;
        if (detailWeight > 0.01) {
          float mesoRidge = (ridgedFbm4(p * 38.0 + warp * 0.6) - 0.35) * 0.075;
          float coastalFbm = (fbm4(p * 145.0) - 0.48) * 0.045;
          float fineGeo = (fbm4(p * 540.0) - 0.48) * 0.025;
          microTerrain = (mesoRidge + coastalFbm + fineGeo) * detailWeight;
          ridges = mix(ridges, clamp(ridges * 0.65 + ridgedFbm4(p * 42.0) * 0.55, 0.0, 1.0), detailWeight * 0.72);
          detail = mix(detail, clamp(detail * 0.55 + fbm4(p * 165.0) * 0.55, 0.0, 1.0), detailWeight * 0.75);
        }

        // Flatten immediate Sanctuary meadow bowl near dSanc < 0.0022 so it transitions cleanly into Ecosystems/Forest
        float landingBowl = smoothstep(0.0008, 0.0045, dSanc);
        microTerrain *= mix(0.22, 1.0, landingBowl);

        ridgesOut = ridges;
        detailOut = detail;
        return cont + continentPedestal + islandArchipelago - lagoonCut + microTerrain;
      }

      void main() {
        vec3 p = normalize(vObjPos);
        float detailWeight = clamp(uDetailScale, 0.0, 1.0);
        float ridges = 0.0;
        float detail = 0.0;
        float cont = evalTerrainHeight(p, detailWeight, ridges, detail);

        float seaLevel = 0.505;
        float coastFeather = mix(0.012, 0.0035, detailWeight);
        float isLand = smoothstep(seaLevel - coastFeather * 0.7, seaLevel + coastFeather, cont);
        float elev = clamp((cont - seaLevel) / (1.0 - seaLevel), 0.0, 1.0);
        float mountain = pow(ridges, 2.1) * smoothstep(0.04, 0.38, elev);

        // Perturb surface normal along adaptive tangent resolution for crisp orbital & atmospheric cordillera relief
        float eps = mix(0.008, 0.0008, detailWeight);
        float rDummy = 0.0;
        float dDummy = 0.0;
        float hC = cont;
        float hX = evalTerrainHeight(normalize(p + vec3(eps, 0.0, 0.0)), detailWeight, rDummy, dDummy);
        float hY = evalTerrainHeight(normalize(p + vec3(0.0, eps, 0.0)), detailWeight, rDummy, dDummy);
        vec3 gradLocal = vec3(hC - hX, hC - hY, 0.0) / max(eps * 60.0, 0.04);
        vec3 N = normalize(vWorldNormal + clamp(gradLocal, -0.45, 0.45) * isLand * mix(0.85, 1.35, detailWeight));
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vWorldPos);

        float lat = abs(p.y);
        float polarIce = smoothstep(0.76 - detail * 0.08, 0.86, lat + mountain * 0.18);

        // Bathymetric ocean colors
        float shelf = smoothstep(seaLevel - 0.085, seaLevel, cont);
        vec3 abyssalOcean = vec3(0.014, 0.052, 0.145);
        vec3 shallowReef  = vec3(0.04, 0.32, 0.45);
        vec3 beachSand    = vec3(0.76, 0.69, 0.52);
        vec3 oceanAlbedo  = mix(abyssalOcean, shallowReef, pow(shelf, 2.2));

        // Realistic biomes by latitude & elevation
        float dSanc = length(p - normalize(uSanctuaryDir));
        float aridity = smoothstep(0.16, 0.38, lat) * (1.0 - smoothstep(0.38, 0.62, lat)) * smoothstep(0.38, 0.68, detail);
        // Keep Sanctuary landing region emerald-lush even near subtropical belt
        aridity *= smoothstep(0.02, 0.14, dSanc);

        vec3 lushForest  = vec3(0.055, 0.215, 0.072);
        vec3 savanna     = vec3(0.34, 0.31, 0.15);
        vec3 desertSand  = vec3(0.62, 0.50, 0.34);
        vec3 alpineRock  = vec3(0.28, 0.26, 0.25);
        vec3 snowCap     = vec3(0.92, 0.95, 0.98);

        vec3 landAlbedo = mix(lushForest, savanna, smoothstep(0.35, 0.68, detail));
        landAlbedo = mix(landAlbedo, desertSand, aridity * 0.82);
        landAlbedo = mix(landAlbedo, alpineRock, smoothstep(0.22, 0.56, mountain + elev * 0.45));
        landAlbedo = mix(landAlbedo, snowCap, smoothstep(0.56, 0.80, mountain + elev * 0.35));

        // Warm golden coastal beaches resolve smoothly as camera descends
        float beachMask = (1.0 - smoothstep(0.0, 0.045, elev)) * isLand * detailWeight;
        landAlbedo = mix(landAlbedo, beachSand, beachMask * 0.72);

        vec3 albedo = mix(oceanAlbedo, landAlbedo, isLand);
        albedo = mix(albedo, snowCap, polarIce);

        // Solar illumination + warm sunset terminator scattering + Fresnel ocean sun-glint
        float ndl = dot(N, L);
        float dayFactor = smoothstep(-0.08, 0.12, ndl);
        float diffuse = max(0.0, ndl);
        float twilight = exp(-pow((ndl + 0.01) * 9.5, 2.0)) * 0.35;

        vec3 H = normalize(L + V);
        float fresnel = 0.03 + 0.97 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
        float spec = pow(max(0.0, dot(N, H)), 96.0) * (1.0 - isLand) * (1.0 - polarIce) * dayFactor;
        vec3 glint = vec3(1.0, 0.90, 0.72) * spec * (0.65 + 0.85 * fresnel);

        // Subtle warm golden Capybara Sanctuary coastal lights on night side
        float nightMask = smoothstep(0.02, -0.18, ndl) * isLand * (1.0 - polarIce);
        float coastal = (1.0 - smoothstep(0.0, 0.16, elev));
        float cityClusters = pow(smoothstep(0.60, 0.82, detail), 2.5) * coastal;
        vec3 nightLights = vec3(1.0, 0.72, 0.32) * cityClusters * nightMask * 0.55;

        vec3 ambientNight = albedo * mix(0.022, 0.09, detailWeight);
        vec3 sunsetTint = vec3(0.92, 0.36, 0.14) * twilight * albedo * 1.4;
        vec3 lit = albedo * (diffuse * 1.35) + sunsetTint + glint + nightLights + ambientNight;

        gl_FragColor = vec4(acesToneMap(lit), uOpacity);
      }
    `,
  });
}

/**
 * Planetary Rotating Cumulus & Cyclone Cloud Deck Sphere/Patch Shader.
 */
export function createPlanetCloudMaterial(
  sunDir: THREE.Vector3,
  opts?: { useSphereDirAttr?: boolean; sanctuaryDir?: THREE.Vector3; doubleSide?: boolean }
): THREE.ShaderMaterial {
  const defaultSancDir = (
    opts?.sanctuaryDir ?? new THREE.Vector3(0.6188, 0.3827, 0.6867)
  )
    .clone()
    .normalize();

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: opts?.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uTime: { value: 0 },
      uOpacity: { value: 0.88 },
      uUseSphereDirAttr: { value: opts?.useSphereDirAttr ? 1.0 : 0.0 },
      uDetailScale: { value: 0.0 },
      uCloudClear: { value: 0.0 },
      uSanctuaryDir: { value: defaultSancDir },
    },
    vertexShader: /* glsl */ `
      ${opts?.useSphereDirAttr ? 'attribute vec3 aSphereDir;' : ''}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;

      void main() {
        vObjPos = ${opts?.useSphereDirAttr ? 'normalize(aSphereDir)' : 'normalize(position)'};
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uDetailScale;
      uniform float uCloudClear;
      uniform vec3 uSanctuaryDir;

      void main() {
        vec3 dir = normalize(vObjPos);
        vec3 p = dir * 3.4 + vec3(uTime * 0.008, 0.0, -uTime * 0.006);
        // Coriolis zonal trade-wind swirl
        p.x += sin(dir.y * 7.0) * 0.45;
        vec3 warp = vec3(fbm4(p * 1.3), fbm4(p * 1.3 + vec3(5.2)), fbm4(p * 1.3 + vec3(9.1)));
        float n = fbm5(p * 1.85 + (warp - 0.5) * 1.6);

        if (uDetailScale > 0.02) {
          float fineCumulus = fbm4(dir * 48.0 + vec3(uTime * 0.02, 0.0, -uTime * 0.015));
          n = mix(n, clamp(n * 0.65 + fineCumulus * 0.48, 0.0, 1.0), clamp(uDetailScale, 0.0, 1.0) * 0.72);
        }

        // Smoothly open a sunlit atmospheric descent window over Sanctuary Archipelago when entering troposphere
        float dSanc = length(dir - normalize(uSanctuaryDir));
        float clearWindow = mix(1.0, smoothstep(0.018, 0.145, dSanc), clamp(uCloudClear, 0.0, 1.0));

        float cloud = smoothstep(0.47, 0.74, n) * clearWindow;
        if (cloud < 0.01) discard;

        float ndl = dot(normalize(vWorldNormal), normalize(uSunDir));
        float day = smoothstep(-0.14, 0.22, ndl);
        float sunset = exp(-pow((ndl + 0.02) * 7.5, 2.0));

        vec3 dayWhite = vec3(0.98, 0.99, 1.0);
        vec3 duskCoral = vec3(0.98, 0.48, 0.24);
        vec3 nightCloud = vec3(0.015, 0.025, 0.045);

        vec3 col = mix(nightCloud, dayWhite * (0.35 + 0.75 * max(0.0, ndl)), day);
        col += duskCoral * sunset * 0.48;
        gl_FragColor = vec4(acesToneMap(col), cloud * uOpacity);
      }
    `,
  });
}

/**
 * Physically Inspired Rayleigh + Mie Atmospheric Limb Scattering Shell Shader (SpaceEngine / ISS look).
 * Renders on a slightly larger outer sphere (e.g. 1.038x planet radius) using BackSide + AdditiveBlending
 * for a crisp sapphire-cyan horizon limb that reddens naturally across the solar terminator.
 */
export function createAtmosphereScatteringMaterial(opts: {
  sunDir: THREE.Vector3;
  rayleighColor?: THREE.Color;
  intensity?: number;
}): THREE.ShaderMaterial {
  const {
    sunDir,
    rayleighColor = new THREE.Color(0.18, 0.54, 1.0),
    intensity = 1.35,
  } = opts;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uRayleigh: { value: rayleighColor },
      uIntensity: { value: intensity },
      uOpacity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      uniform vec3 uSunDir;
      uniform vec3 uRayleigh;
      uniform float uIntensity;
      uniform float uOpacity;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // BackSide normal faces outward from sphere center; grazing limb is where dot(N, -V) -> 0
        float viewGrazing = clamp(1.0 - abs(dot(N, V)), 0.0, 1.0);
        float limbOpticalDepth = pow(viewGrazing, 2.8) * smoothstep(0.0, 0.42, viewGrazing);

        float sunAngle = dot(N, L);
        float dayScatter = smoothstep(-0.28, 0.45, sunAngle);
        float terminatorGlow = exp(-pow((sunAngle + 0.06) * 5.2, 2.0));
        // Forward Mie scattering when looking near the Sun behind the planet limb
        float cosTheta = clamp(dot(-V, L), 0.0, 1.0);
        float mieForward = pow(cosTheta, 6.0) * 0.55;

        vec3 sunsetAmber = vec3(1.0, 0.38, 0.12);
        vec3 scatterCol = mix(uRayleigh, sunsetAmber, clamp(terminatorGlow * 0.72, 0.0, 0.85));
        vec3 hdr = scatterCol * limbOpticalDepth * (dayScatter + terminatorGlow * 0.55 + mieForward) * uIntensity;
        vec3 mapped = acesToneMap(hdr);
        float alpha = clamp(length(mapped) * uOpacity, 0.0, 0.95);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(mapped, alpha);
      }
    `,
  });
}

/**
 * SpaceEngine-Grade Cratered Rocky Planet / Moon Surface Shader (Basalt Maria,
 * Highland Regolith, Multi-Scale Impact Craters & Crisp Solar Terminator).
 */
export function createRockyBodyMaterial(opts: {
  sunDir: THREE.Vector3;
  baseColorHex?: number;
  highlandColorHex?: number;
}): THREE.ShaderMaterial {
  const {
    sunDir,
    baseColorHex = 0x8b7e74,
    highlandColorHex = 0xcbd5e1,
  } = opts;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uBaseCol: { value: new THREE.Color(baseColorHex) },
      uHighCol: { value: new THREE.Color(highlandColorHex) },
      uOpacity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;

      void main() {
        vObjPos = normalize(position);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      uniform vec3 uSunDir;
      uniform vec3 uBaseCol;
      uniform vec3 uHighCol;
      uniform float uOpacity;

      float craterHeight(vec3 p) {
        float maria = fbm4(p * 2.2);
        float r1 = ridgedFbm4(p * 7.5);
        float r2 = ridgedFbm4(p * 18.0) * 0.45;
        return maria * 0.55 + r1 * 0.32 + r2 * 0.18;
      }

      void main() {
        vec3 p = vObjPos;
        float h = craterHeight(p);
        float eps = 0.01;
        float dx = craterHeight(p + vec3(eps, 0.0, 0.0)) - h;
        float dy = craterHeight(p + vec3(0.0, eps, 0.0)) - h;
        vec3 N = normalize(vWorldNormal + vec3(dx, dy, 0.0) * 6.5);
        vec3 L = normalize(uSunDir);

        // Lommel-Seeliger lunar regolith reflectance (authentic crisp opposition & terminator!)
        float ndl = max(0.0, dot(N, L));
        vec3 albedo = mix(uBaseCol * 0.52, uHighCol, smoothstep(0.38, 0.72, h));
        // Bright ray-crater ejecta streaks
        float rays = pow(clamp(ridgedFbm4(p * 14.0), 0.0, 1.0), 4.0);
        albedo += vec3(0.18) * rays;

        vec3 lit = albedo * (ndl * 1.42 + 0.012);
        gl_FragColor = vec4(acesToneMap(lit), uOpacity);
      }
    `,
  });
}

/**
 * Jovian / Saturnian Gas Giant Turbulent Zonal Jet-Stream & Anticyclonic Storm Shader.
 */
export function createGasGiantMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uTime: { value: 0 },
      uOpacity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;

      void main() {
        vObjPos = normalize(position);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uOpacity;

      void main() {
        vec3 p = vObjPos;
        float lat = asin(clamp(p.y, -1.0, 1.0));
        float lon = atan(p.z, p.x);

        // Kelvin-Helmholtz shear eddies along alternating zonal ammonia/hydrosulfide cloud belts
        float eddy = fbm5(vec3(p.x * 5.5 + uTime * 0.03, lat * 12.0, p.z * 5.5));
        float fineCurl = fbm4(vec3(p.x * 14.0 - eddy * 2.2, lat * 26.0, p.z * 14.0));
        float warpedLat = lat + (eddy - 0.5) * 0.16 + (fineCurl - 0.5) * 0.06;

        float band1 = sin(warpedLat * 18.0);
        float band2 = cos(warpedLat * 34.0) * 0.45;
        float beltFactor = clamp(0.5 + 0.36 * band1 + 0.22 * band2, 0.0, 1.0);

        // Great Anticyclonic Vortex at southern tropical belt (lat ~ -0.36)
        float dLon = mod(lon - 1.1 + 3.14159, 6.28318) - 3.14159;
        vec2 stormCoord = vec2(dLon * 2.4, (lat + 0.36) * 6.2);
        float stormR = length(stormCoord);
        float stormMask = 1.0 - smoothstep(0.55, 1.05, stormR);
        float stormSwirl = fbm4(vec3(stormCoord * 3.5, stormR * 4.0 - uTime * 0.12));

        vec3 ammoniaCream = vec3(0.93, 0.86, 0.74);
        vec3 ochreBelt    = vec3(0.76, 0.48, 0.28);
        vec3 deepUmber    = vec3(0.42, 0.24, 0.16);
        vec3 polarHaze    = vec3(0.38, 0.44, 0.54);
        vec3 vortexRust   = vec3(0.84, 0.31, 0.16);

        vec3 col = mix(deepUmber, ochreBelt, smoothstep(0.18, 0.52, beltFactor));
        col = mix(col, ammoniaCream, smoothstep(0.52, 0.86, beltFactor));
        col = mix(col, mix(vortexRust, ammoniaCream, stormSwirl * 0.42), stormMask * 0.92);
        col = mix(col, polarHaze, smoothstep(0.72, 0.96, abs(p.y)));

        float ndl = max(0.0, dot(normalize(vWorldNormal), normalize(uSunDir)));
        // Subtle atmospheric limb softening
        vec3 lit = col * (pow(ndl, 0.85) * 1.32 + 0.015);
        gl_FragColor = vec4(acesToneMap(lit), uOpacity);
      }
    `,
  });
}

/**
 * Planetary Ice-Ring Optical Depth & Planet-Shadow Shader (Cassini, Encke & Colombo Gaps).
 */
export function createPlanetaryRingMaterial(opts: {
  innerRadius: number;
  outerRadius: number;
  planetRadius: number;
  sunDir: THREE.Vector3;
}): THREE.ShaderMaterial {
  const { innerRadius, outerRadius, planetRadius, sunDir } = opts;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uInner: { value: innerRadius },
      uOuter: { value: outerRadius },
      uPlanetR: { value: planetRadius },
      uSunDir: { value: sunDir.clone().normalize() },
      uOpacity: { value: 0.92 },
    },
    vertexShader: /* glsl */ `
      uniform float uPlanetR;
      varying vec3 vLocalPos;
      varying vec3 vRelWorld;
      varying float vScaledPlanetR;

      void main() {
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 planetCenterWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vRelWorld = wp.xyz - planetCenterWorld;
        float worldScale = length(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
        vScaledPlanetR = uPlanetR * worldScale;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec3 vLocalPos;
      varying vec3 vRelWorld;
      varying float vScaledPlanetR;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uSunDir;
      uniform float uOpacity;

      void main() {
        // RingGeometry lies in XY plane before rotation
        float r = length(vLocalPos.xy);
        float u = clamp((r - uInner) / max(0.001, uOuter - uInner), 0.0, 1.0);
        if (u <= 0.001 || u >= 0.999) discard;

        // Multi-frequency radial ringlets + Cassini Division (u ~ 0.61..0.67) + Encke Gap (u ~ 0.88)
        float ringlets = 0.55 + 0.45 * sin(u * 190.0) * cos(u * 73.0);
        float fineRinglets = 0.75 + 0.25 * sin(u * 520.0);
        float cRing = smoothstep(0.0, 0.16, u) * 0.35 + smoothstep(0.16, 0.22, u) * 0.65;
        float cassini = 1.0 - 0.92 * exp(-pow((u - 0.64) * 34.0, 2.0));
        float encke   = 1.0 - 0.78 * exp(-pow((u - 0.88) * 95.0, 2.0));
        float outerFade = 1.0 - smoothstep(0.94, 1.0, u);

        float opticalDepth = clamp(cRing * ringlets * fineRinglets * cassini * encke * outerFade, 0.0, 1.0);

        // Crisp cylindrical shadow cast by the gas giant body onto the anti-solar side of the rings!
        vec3 L = normalize(uSunDir);
        float alongSun = dot(vRelWorld, L);
        float perpDist = length(vRelWorld - L * alongSun);
        float inShadow = alongSun < 0.0
          ? 1.0 - smoothstep(vScaledPlanetR * 0.96, vScaledPlanetR * 1.04, perpDist)
          : 0.0;

        vec3 iceCream = vec3(0.95, 0.89, 0.78);
        vec3 dustyTan = vec3(0.74, 0.62, 0.48);
        vec3 col = mix(dustyTan, iceCream, smoothstep(0.2, 0.6, u) * ringlets);
        col *= mix(1.15, 0.035, inShadow);

        float alpha = opticalDepth * 0.86 * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(acesToneMap(col), alpha);
      }
    `,
  });
}

/**
 * Higher-Dimensional Multiverse Quantum Vacuum Bubble Universe Material.
 * Renders an iridescent thin-film bubble membrane with chromatic dispersion,
 * angle-dependent Fresnel highlights, quantum vacuum fluctuation glints,
 * and an optional luminous golden-violet entry corona for the home pocket universe.
 */
export function createMultiverseBubbleMaterial(opts: {
  isHomeUniverse?: boolean;
  opacity?: number;
}): THREE.ShaderMaterial {
  const { isHomeUniverse = false, opacity = 0.88 } = opts;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uIsHomeUniverse: { value: isHomeUniverse ? 1.0 : 0.0 },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      uniform float uIsHomeUniverse;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);
        float NdotV = max(0.0, dot(N, V));
        float fresnel = pow(1.0 - NdotV, 2.4);

        // Thin-film interference thickness modulated by quantum vacuum ripples
        vec3 p = vWorldPos * 0.12 + vec3(uTime * 0.02, -uTime * 0.015, uTime * 0.01);
        float noise = fbm4(p * 2.2);
        float filmThickness = noise * 1.8 + fresnel * 1.2;

        // Chromatic interference color cycle
        vec3 iridescentCol;
        iridescentCol.r = 0.5 + 0.5 * cos(filmThickness * 6.28318 + 0.0);
        iridescentCol.g = 0.5 + 0.5 * cos(filmThickness * 6.28318 + 2.094);
        iridescentCol.b = 0.5 + 0.5 * cos(filmThickness * 6.28318 + 4.188);

        // Core deep-vacuum interior
        vec3 deepVoid = vec3(0.04, 0.015, 0.08);
        vec3 baseCol = mix(deepVoid, iridescentCol, fresnel * 0.85 + noise * 0.25);

        // Quantum vacuum shimmer glints
        float glint = pow(noise3D(vWorldPos * 1.8 + vec3(uTime * 0.08)), 6.0) * 2.2;
        baseCol += vec3(0.7, 0.85, 1.0) * glint;

        // Home universe entrance corona
        if (uIsHomeUniverse > 0.5) {
          float pulse = 0.85 + 0.15 * sin(uTime * 2.5);
          vec3 coronaCol = vec3(1.0, 0.82, 0.45);
          float rimGlow = pow(1.0 - NdotV, 1.6) * 1.6 * pulse;
          baseCol = mix(baseCol, coronaCol, rimGlow * 0.65) + coronaCol * (rimGlow * 0.5);
        }

        float alpha = clamp((fresnel * 0.82 + noise * 0.18 + (uIsHomeUniverse > 0.5 ? 0.25 : 0.08)), 0.0, 0.95) * uOpacity;
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(acesToneMap(baseCol), alpha);
      }
    `,
  });
}

/**
 * Total Evolved Universe Flat Spacetime Manifold & Metric Expansion Material.
 * Renders the cosmological metric grid with expanding coordinate lines,
 * Baryon Acoustic Oscillation (BAO) ripple shells, and relativistic curvature well.
 */
export function createSpacetimeManifoldMaterial(opts?: {
  opacity?: number;
}): THREE.ShaderMaterial {
  const { opacity = 0.82 } = opts || {};

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE_AND_ACES}
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;

        // Metric expansion grid lines
        vec2 grid = abs(fract(p * 14.0 - 0.5) - 0.5) / fwidth(p * 14.0);
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);

        // Relic Baryon Acoustic Oscillation (BAO) spherical acoustic sound wave ripples
        float baoSpeed = uTime * 0.05;
        float baoWave = sin((r * 22.0 - baoSpeed * 6.28318)) * 0.5 + 0.5;
        float baoShell = pow(baoWave, 3.5) * smoothstep(0.1, 0.8, r);

        // Expanding Hubble horizon glow ring at outer rim
        float horizonRing = smoothstep(0.85, 0.98, r) * (1.0 - smoothstep(0.98, 1.0, r));

        // Central gravitational curvature well
        float centralWell = exp(-r * 4.2) * 2.5;

        vec3 gridCol    = vec3(0.25, 0.50, 0.95);
        vec3 baoCol     = vec3(0.40, 0.85, 1.0);
        vec3 horizonCol = vec3(0.70, 0.40, 1.0);
        vec3 centerCol  = vec3(1.0, 0.90, 0.65);

        vec3 col = gridCol * (line * 0.65)
                 + baoCol * (baoShell * 0.85)
                 + horizonCol * (horizonRing * 2.0)
                 + centerCol * (centralWell * 0.7);

        float alpha = clamp(line * 0.55 + baoShell * 0.45 + horizonRing * 0.85 + centralWell * 0.5, 0.0, 0.95) * uOpacity;
        alpha *= (1.0 - smoothstep(0.92, 1.0, r));
        if (alpha < 0.004) discard;

        gl_FragColor = vec4(acesToneMap(col), alpha);
      }
    `,
  });
}

