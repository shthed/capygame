import * as THREE from 'three';
import { BuildingType, CapyLodTier, HEAD_ORANGE_VARIETIES, MutationId } from '../types';
import { RealisticWorldEnvironment } from './RealisticWorldEnvironment';
import { PbrTextureSynthesizer } from './gpu/PbrTextureSynthesizer';

export interface CapyMeshGroup extends THREE.Group {
  userData: {
    legFL: THREE.Group;
    legFR: THREE.Group;
    legBL: THREE.Group;
    legBR: THREE.Group;
    head: THREE.Group;
    earL: THREE.Group;
    earR: THREE.Group;
    eyelidL: THREE.Mesh;
    eyelidR: THREE.Mesh;
    hatGroup: THREE.Group;
    headOrangeGroup: THREE.Group;
    headOrangeMesh: THREE.Mesh;
    headOrangeMat: THREE.MeshStandardMaterial;
    headStackMeshes: THREE.Mesh[];
    headOrangeColorHex: number;
    mutationGroup: THREE.Group;
    rearAssemblyGroup: THREE.Group;
    lodTier1Group: THREE.Group;
    lodTier2Group: THREE.Group;
    lodTier3Group: THREE.Group;
    furInstancedMesh: THREE.InstancedMesh;
    rearFurInstancedMesh: THREE.InstancedMesh;
    walkCycle: number;
    blinkTimer: number;
    lodTier: CapyLodTier;
    skin: string;
    __occluderRoot?: THREE.Object3D;
    __cachedFadeMeshes?: THREE.Mesh[];
    ignoreCameraFade?: boolean;
  };
}

export interface DachshundSegmentGroup extends THREE.Group {
  userData: {
    bodyMat: THREE.MeshStandardMaterial;
    lodTier1Group: THREE.Group;
    lodTier2Group: THREE.Group;
    lodTier3Group: THREE.Group;
    furInstancedMesh: THREE.InstancedMesh;
    midLegL: THREE.Group;
    midLegR: THREE.Group;
    walkCycle: number;
    riderOrangeGroup: THREE.Group | null;
    riderOrangeMat: THREE.MeshStandardMaterial | null;
    segmentIndex: number;
    lodTier: CapyLodTier;
    __occluderRoot?: THREE.Object3D;
    __cachedFadeMeshes?: THREE.Mesh[];
    __isDachshundSegment?: boolean;
    ignoreCameraFade?: boolean;
  };
}

export interface DachshundCabooseGroup extends THREE.Group {
  userData: {
    bodyMat: THREE.MeshStandardMaterial;
    legBL: THREE.Group;
    legBR: THREE.Group;
    tailGroup: THREE.Group;
    lodTier1Group: THREE.Group;
    lodTier2Group: THREE.Group;
    lodTier3Group: THREE.Group;
    furInstancedMesh: THREE.InstancedMesh;
    walkCycle: number;
    lodTier: CapyLodTier;
    __occluderRoot?: THREE.Object3D;
    __cachedFadeMeshes?: THREE.Mesh[];
    ignoreCameraFade?: boolean;
  };
}

export interface CollectibleOrangeGroup extends THREE.Group {
  userData: {
    rollGroup: THREE.Group;
    squashGroup: THREE.Group;
    fruitMat: THREE.MeshStandardMaterial;
    haloRing: THREE.Mesh;
    haloMat: THREE.MeshBasicMaterial;
    leafGroup: THREE.Group;
    radius: number;
    __occluderRoot?: THREE.Object3D;
    __cachedFadeMeshes?: THREE.Mesh[];
    ignoreCameraFade?: boolean;
  };
}
const _furDummy = new THREE.Object3D();

export class CapyModelGenerator {
  public static readonly skinColors: Record<string, number> = {
    classic: 0x9b643b,
    golden: 0xeab308,
    sakura: 0xf472b6,
    matcha: 0x4ade80,
    cosmic: 0x6366f1,
  };

  public static readonly skinDefaultOrangeIndex: Record<string, number> = {
    classic: 0, // Tangerine Orange (#ff7a00)
    golden: 1, // Valencia Gold (#ffb703)
    sakura: 2, // Blood Orange (#f43f5e)
    matcha: 3, // Key-Lime Citrus (#84cc16)
    cosmic: 4, // Azure Mandarin (#38bdf8)
  };

  // Approximate triangle budget per Capybara at each dynamic 60 FPS LOD tier
  public static readonly LOD_TRIANGLE_ESTIMATES: Record<CapyLodTier, number> = {
    0: 760,
    1: 1840,
    2: 3420,
    3: 6480,
  };

  public static readonly LOD_LABELS: Record<CapyLodTier, string> = {
    0: 'Performance LOD',
    1: 'Balanced LOD',
    2: 'High Detail LOD',
    3: 'Ultra Bristle LOD',
  };

  private static furAlbedoCache = new Map<number, THREE.CanvasTexture>();
  private static sharedCitrusBumpMap: THREE.CanvasTexture | null = null;

  // Shared anatomical sub-materials (varied roughness >= 0.25 for realistic PBR contrast)
  private static rhinariumMaterial = new THREE.MeshStandardMaterial({
    color: 0x26150e,
    roughness: 0.24,
    metalness: 0.06,
  });

  private static eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x120b07,
    roughness: 0.06,
    metalness: 0.12,
  });

  private static eyeCatchlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  private static innerEarMaterial = new THREE.MeshStandardMaterial({
    color: 0xa66b59,
    roughness: 0.76,
    metalness: 0.02,
  });

  private static cheekBlushMaterial = new THREE.MeshStandardMaterial({
    color: 0xc97b63,
    roughness: 0.90,
    metalness: 0.0,
  });

  private static incisorMaterial = new THREE.MeshStandardMaterial({
    color: 0xfef9e7,
    roughness: 0.22,
    metalness: 0.04,
  });

  private static legMaterial = new THREE.MeshStandardMaterial({
    color: 0x663a1e,
    roughness: 0.82,
    metalness: 0.03,
  });

  private static webbingMaterial = new THREE.MeshStandardMaterial({
    color: 0x472814,
    roughness: 0.66,
    metalness: 0.04,
  });

  private static clawMaterial = new THREE.MeshStandardMaterial({
    color: 0x291a10,
    roughness: 0.30,
    metalness: 0.16,
  });

  private static whiskerMaterial = new THREE.MeshStandardMaterial({
    color: 0xe7d5c0,
    roughness: 0.42,
    metalness: 0.05,
  });

  private static yuzuMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8800,
    normalMap: PbrTextureSynthesizer.getCitrusPeelNormalMap(),
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughness: 0.24,
    metalness: 0.06,
  });

  private static leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.48,
    metalness: 0.02,
  });

  private static stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x452711,
    roughness: 0.82,
    metalness: 0.02,
  });

  // Soft golden-tan eyebrow accent material

  private static dachshundTanPointMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdfa763,
    roughness: 0.82,
    metalness: 0.02,
    sheen: 0.62,
    sheenRoughness: 0.60,
    sheenColor: new THREE.Color(0xfef0d4),
  });

  // Cached geometries & materials so NPCs/critters/herd/segments reuse existing GPU buffers
  private static sharedTorsoGeo: THREE.BufferGeometry | null = null;
  private static sharedHeadGeo: THREE.BufferGeometry | null = null;
  private static sharedSnoutGeo: THREE.BufferGeometry | null = null;
  private static sharedFurTuftGeo: THREE.BufferGeometry | null = null;
  private static sharedDachshundBarrelGeo: THREE.BufferGeometry | null = null;
  private static geoCache = new Map<string, THREE.BufferGeometry>();
  private static matCache = new Map<string, THREE.Material>();
  private static leanTextureMode: boolean = false;

  public static setLeanTextureMode(lean: boolean): void {
    this.leanTextureMode = lean;
  }

  private static getCachedGeo<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
    const existing = this.geoCache.get(key);
    if (existing) return existing as T;
    const created = factory();
    this.geoCache.set(key, created);
    return created;
  }

  private static getCachedMat<T extends THREE.Material>(key: string, factory: () => T): T {
    const existing = this.matCache.get(key);
    if (existing) return existing as T;
    const created = factory();
    this.matCache.set(key, created);
    return created;
  }

  private static getFurAlbedoTexture(baseHex: number): THREE.CanvasTexture {
    const cached = this.furAlbedoCache.get(baseHex);
    if (cached) return cached;

    const texSize = this.leanTextureMode ? 128 : 256;
    const scale = texSize / 256;
    const canvas = document.createElement('canvas');
    canvas.width = texSize;
    canvas.height = texSize;
    const ctx = canvas.getContext('2d');
    const baseCol = new THREE.Color(baseHex);
    const shadowCol = baseCol.clone().multiplyScalar(0.84);
    const warmCol = baseCol.clone().lerp(new THREE.Color(0xffe8c2), 0.16);
    const lightTipCol = baseCol.clone().lerp(new THREE.Color(0xfff5db), 0.28);

    if (ctx) {
      // Uniform warm chestnut base with ZERO vertical gradient seams when tiled around limbs & body
      ctx.fillStyle = `#${baseCol.getHexString()}`;
      ctx.fillRect(0, 0, texSize, texSize);

      // Wrap-safe gentle mottled undercoat softness across tile boundaries
      for (let c = 0; c < 42; c++) {
        const cx = ((c * 67 + 19) % 256) * scale;
        const cy = ((c * 113 + 31) % 256) * scale;
        const rad = (20 + (c % 4) * 6) * scale;
        const col = c % 2 === 0 ? warmCol : shadowCol;
        const rgba0 = `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},0.10)`;
        const rgba1 = `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},0)`;
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const tx = cx + ox * texSize;
            const ty = cy + oy * texSize;
            if (tx < -rad || tx > texSize + rad || ty < -rad || ty > texSize + rad) continue;
            const grad = ctx.createRadialGradient(tx, ty, 1, tx, ty, rad);
            grad.addColorStop(0, rgba0);
            grad.addColorStop(1, rgba1);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(tx, ty, rad, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      const palette = [
        `#${shadowCol.getHexString()}`,
        `#${baseCol.getHexString()}`,
        `#${warmCol.getHexString()}`,
        `#${lightTipCol.getHexString()}`,
      ];

      // Subtle short silky plush coat flecks (zero harsh scratch strokes or UV stripes)
      const hairCount = this.leanTextureMode ? 1400 : 3600;
      ctx.lineCap = 'round';
      for (let i = 0; i < hairCount; i++) {
        const x = ((i * 97 + (i % 13) * 11) % 256) * scale;
        const y = ((i * 53 + (i % 17) * 7) % 256) * scale;
        ctx.strokeStyle = palette[i % palette.length];
        ctx.globalAlpha = 0.045 + (i % 4) * 0.015;
        ctx.lineWidth = (0.65 + (i % 3) * 0.16) * scale;
        const dx = ((i % 5) - 2) * 0.26 * scale;
        const len = (2.6 + (i % 3) * 0.85) * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx, y + len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.needsUpdate = true;
    PbrTextureSynthesizer.registerManagedTexture(tex);
    this.furAlbedoCache.set(baseHex, tex);
    return tex;
  }

  private static getCitrusPeelBumpTexture(): THREE.CanvasTexture {
    if (this.sharedCitrusBumpMap) return this.sharedCitrusBumpMap;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#909090';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 650; i++) {
        const x = (i * 47 + (i % 11) * 5) % 128;
        const y = (i * 83 + (i % 7) * 9) % 128;
        const r = 1.1 + (i % 3) * 0.55;
        ctx.fillStyle = i % 3 === 0 ? '#525252' : '#b8b8b8';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    PbrTextureSynthesizer.registerManagedTexture(tex);
    this.sharedCitrusBumpMap = tex;
    return tex;
  }

  private static createFurMaterial(
    skin: string,
    share: boolean = true
  ): THREE.MeshPhysicalMaterial {
    const makeMat = () => {
      const furColor = this.skinColors[skin] ?? this.skinColors.classic;
      const sheenCol = new THREE.Color(furColor).lerp(new THREE.Color(0xfff1d6), 0.58);
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: this.getFurAlbedoTexture(furColor),
        normalMap: PbrTextureSynthesizer.getCapyFurNormalMap(),
        normalScale: new THREE.Vector2(0.18, 0.15),
        roughness: skin === 'golden' ? 0.42 : 0.78,
        metalness: skin === 'golden' ? 0.34 : 0.02,
        sheen: 0.78,
        sheenRoughness: 0.56,
        sheenColor: sheenCol,
      });
    };
    return share ? this.getCachedMat(`fur:${skin}`, makeMat) : makeMat();
  }

  private static createMuzzleMaterial(
    skin: string,
    share: boolean = true
  ): THREE.MeshPhysicalMaterial {
    const makeMat = () => {
      const base = new THREE.Color(this.skinColors[skin] ?? this.skinColors.classic);
      const cocoa = new THREE.Color(skin === 'classic' ? 0x673c22 : 0x523120);
      const blended = base.clone().lerp(cocoa, skin === 'classic' ? 0.58 : 0.34);
      const sheenCol = blended.clone().lerp(new THREE.Color(0xffe8cc), 0.42);
      return new THREE.MeshPhysicalMaterial({
        color: blended,
        normalMap: PbrTextureSynthesizer.getCapyFurNormalMap(),
        normalScale: new THREE.Vector2(0.14, 0.12),
        roughness: 0.80,
        metalness: 0.02,
        sheen: 0.60,
        sheenRoughness: 0.64,
        sheenColor: sheenCol,
      });
    };
    return share ? this.getCachedMat(`muzzle:${skin}`, makeMat) : makeMat();
  }

  private static createUnderbellyMaterial(
    skin: string,
    share: boolean = true
  ): THREE.MeshPhysicalMaterial {
    const makeMat = () => {
      const base = new THREE.Color(this.skinColors[skin] ?? this.skinColors.classic);
      base.lerp(new THREE.Color(0xfef3d4), 0.44);
      return new THREE.MeshPhysicalMaterial({
        color: base,
        normalMap: PbrTextureSynthesizer.getCapyFurNormalMap(),
        normalScale: new THREE.Vector2(0.14, 0.12),
        roughness: 0.84,
        metalness: 0.01,
        sheen: 0.68,
        sheenRoughness: 0.62,
        sheenColor: new THREE.Color(0xfff8e7),
      });
    };
    return share ? this.getCachedMat(`belly:${skin}`, makeMat) : makeMat();
  }

  private static getTorsoGeometry(): THREE.BufferGeometry {
    if (this.sharedTorsoGeo) return this.sharedTorsoGeo;
    // Plump, cozy rounded-loaf capybara body profile revolved along spine
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.001, -0.82),
      new THREE.Vector2(0.32, -0.76),
      new THREE.Vector2(0.52, -0.60),
      new THREE.Vector2(0.60, -0.34), // plump cozy rump
      new THREE.Vector2(0.615, -0.02), // soft rounded barrel ribcage
      new THREE.Vector2(0.585, 0.30),
      new THREE.Vector2(0.535, 0.56), // rounded shoulders
      new THREE.Vector2(0.41, 0.76),
      new THREE.Vector2(0.19, 0.86),
      new THREE.Vector2(0.001, 0.89),
    ];
    const geo = new THREE.LatheGeometry(profile, 28);
    geo.rotateX(Math.PI / 2);
    geo.scale(0.98, 1.03, 1.0);
    geo.computeVertexNormals();
    PbrTextureSynthesizer.prepareGeometryForPbr(geo);
    this.sharedTorsoGeo = geo;
    return geo;
  }

  private static getHeadGeometry(): THREE.BufferGeometry {
    if (this.sharedHeadGeo) return this.sharedHeadGeo;
    // Soft, organic, super-smooth sculpted South American capybara head (zero flat bevel facets!)
    const geo = new THREE.SphereGeometry(0.41, 28, 22);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      // Taper gently upward toward gentle crown & slightly elongate depth forward-back
      const crownPinch = y > 0 ? 1.0 - Math.pow(y / 0.41, 2) * 0.14 : 1.0 + Math.abs(y / 0.41) * 0.06;
      x *= 0.94 * crownPinch;
      y *= 0.88;
      z *= 1.12;
      // Softly flatten forehead nose bridge slightly for authentic calm capybara profile
      if (z > 0.12 && y > 0.04) {
        y -= (z - 0.12) * 0.08;
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    PbrTextureSynthesizer.prepareGeometryForPbr(geo);
    this.sharedHeadGeo = geo;
    return geo;
  }

  private static getSnoutGeometry(): THREE.BufferGeometry {
    if (this.sharedSnoutGeo) return this.sharedSnoutGeo;
    // Soft plush rounded blunt muzzle cushion (no sharp boxy bevel corners)
    const geo = new THREE.SphereGeometry(0.32, 24, 18);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      x *= 0.96;
      y *= 0.86;
      z *= 0.96;
      // Softly cushion/flatten only the very front tip where the adorable nose & smile sit
      if (z > 0.18) {
        z = 0.18 + (z - 0.18) * 0.56;
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    PbrTextureSynthesizer.prepareGeometryForPbr(geo);
    this.sharedSnoutGeo = geo;
    return geo;
  }

  private static getFurTuftGeometry(): THREE.BufferGeometry {
    if (this.sharedFurTuftGeo) return this.sharedFurTuftGeo;
    // Soft, gentle underside plush fleece cushion tucked cleanly along chest & belly contour
    const geo = new THREE.SphereGeometry(0.036, 8, 6);
    geo.scale(0.86, 0.36, 1.32);
    this.sharedFurTuftGeo = geo;
    return geo;
  }

  private static getDachshundBarrelGeometry(): THREE.BufferGeometry {
    if (this.sharedDachshundBarrelGeo) return this.sharedDachshundBarrelGeo;
    // Longer elongated Wiener-dog / Dachshund Capybara back segment (1.64m total span with seamless end overlap)
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.001, -0.82),
      new THREE.Vector2(0.32, -0.77),
      new THREE.Vector2(0.49, -0.58),
      new THREE.Vector2(0.535, -0.24),
      new THREE.Vector2(0.54, 0.0),
      new THREE.Vector2(0.535, 0.24),
      new THREE.Vector2(0.49, 0.58),
      new THREE.Vector2(0.32, 0.77),
      new THREE.Vector2(0.001, 0.82),
    ];
    const geo = new THREE.LatheGeometry(profile, 22);
    geo.rotateX(Math.PI / 2);
    geo.scale(0.92, 1.0, 1.0);
    geo.computeVertexNormals();
    PbrTextureSynthesizer.prepareGeometryForPbr(geo);
    this.sharedDachshundBarrelGeo = geo;
    return geo;
  }

  private static buildDetailedLimb(
    isFront: boolean,
    isLeft: boolean,
    furMat: THREE.MeshStandardMaterial,
    tier1Bucket: THREE.Object3D[],
    tier2Bucket: THREE.Object3D[]
  ): THREE.Group {
    const limbRoot = new THREE.Group();

    // Tier 0: Soft furry upper thigh/shoulder limb sleeve matching coat seamlessly
    const upperGeo = this.getCachedGeo('limb_upper', () => {
      const g = new THREE.CylinderGeometry(0.175, 0.142, 0.30, 14);
      g.translate(0, -0.14, 0);
      return g;
    });
    const upperMesh = new THREE.Mesh(upperGeo, furMat);
    upperMesh.name = 'capyBody';
    upperMesh.castShadow = true;
    limbRoot.add(upperMesh);

    // Tier 1: Smooth rounded shoulder/thigh haunch blending smoothly into torso
    const haunchGeo = this.getCachedGeo(isFront ? 'limb_haunch_f' : 'limb_haunch_b', () => {
      const g = new THREE.SphereGeometry(isFront ? 0.215 : 0.255, 14, 12);
      g.scale(0.86, 1.12, isFront ? 1.06 : 1.20);
      return g;
    });
    const haunch = new THREE.Mesh(haunchGeo, furMat);
    haunch.name = 'capyBody';
    haunch.position.set(isLeft ? 0.02 : -0.02, 0.02, isFront ? -0.02 : -0.02);
    limbRoot.add(haunch);
    tier1Bucket.push(haunch);

    // Articulated Knee / Carpus Lower Joint at y = -0.26 for realistic swing-flex & stance plant!
    const lowerJoint = new THREE.Group();
    lowerJoint.position.set(0, -0.26, 0);
    limbRoot.add(lowerJoint);

    const lowerBaseGeo = this.getCachedGeo('limb_lower', () => {
      const g = new THREE.CylinderGeometry(0.125, 0.135, 0.28, 10);
      g.translate(0, -0.14, 0);
      return g;
    });
    const lowerMesh = new THREE.Mesh(lowerBaseGeo, this.legMaterial);
    lowerMesh.castShadow = true;
    lowerJoint.add(lowerMesh);

    // Articulated Ankle / Webbed Paw Group at y = -0.25 below knee (total rest sole Y = -0.53)
    const pawGroup = new THREE.Group();
    pawGroup.position.set(0, -0.25, 0);
    lowerJoint.add(pawGroup);

    const pawPadGeo = this.getCachedGeo('limb_paw_pad', () => new THREE.BoxGeometry(0.25, 0.08, 0.32));
    const pawPad = new THREE.Mesh(pawPadGeo, this.webbingMaterial);
    pawPad.position.set(0, 0, 0.06);
    pawGroup.add(pawPad);
    tier1Bucket.push(pawPad);

    // Tier 2: Anatomically authentic Capybara toes (4 front toes, 3 hind toes) + webbing + keratin claws
    const toeGroup = new THREE.Group();
    toeGroup.position.set(0, 0, 0.16);
    const toeCount = isFront ? 4 : 3;
    const spread = isFront ? 0.22 : 0.20;

    const toeGeo = this.getCachedGeo('limb_toe', () => {
      const g = new THREE.CapsuleGeometry(0.032, 0.09, 4, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const clawGeo = this.getCachedGeo('limb_claw', () => {
      const g = new THREE.ConeGeometry(0.024, 0.075, 5);
      g.rotateX(Math.PI * 0.56);
      return g;
    });

    for (let t = 0; t < toeCount; t++) {
      const frac = t / (toeCount - 1) - 0.5;
      const tx = frac * spread;
      const tz = Math.cos(frac * 1.4) * 0.06;

      const toe = new THREE.Mesh(toeGeo, this.legMaterial);
      toe.position.set(tx, 0.005, tz);
      toe.rotation.y = -frac * 0.32;
      toeGroup.add(toe);

      const claw = new THREE.Mesh(clawGeo, this.clawMaterial);
      claw.position.set(tx * 1.08, -0.01, tz + 0.075);
      claw.rotation.y = -frac * 0.32;
      toeGroup.add(claw);
    }

    // Interdigital webbing fan between toes
    const webGeo = this.getCachedGeo(
      'limb_web',
      () =>
        new THREE.CylinderGeometry(
          0.13,
          0.14,
          0.025,
          8,
          1,
          false,
          -Math.PI * 0.4,
          Math.PI * 0.8
        )
    );
    const webMesh = new THREE.Mesh(webGeo, this.webbingMaterial);
    webMesh.position.set(0, -0.01, 0.01);
    toeGroup.add(webMesh);

    pawGroup.add(toeGroup);
    tier2Bucket.push(toeGroup);

    limbRoot.userData.lowerJoint = lowerJoint;
    limbRoot.userData.pawGroup = pawGroup;

    return limbRoot;
  }

  private static createSculptedHeadOrange(
    orangeColorHex: number,
    emissiveHex: number,
    tier2Bucket: THREE.Object3D[],
    shareMaterial: boolean = true
  ): {
    group: THREE.Group;
    fruitMesh: THREE.Mesh;
    fruitMat: THREE.MeshStandardMaterial;
  } {
    const group = new THREE.Group();
    const makeFruitMat = () =>
      new THREE.MeshStandardMaterial({
        color: orangeColorHex,
        emissive: emissiveHex,
        emissiveIntensity: 0.0,
        normalMap: PbrTextureSynthesizer.getCitrusPeelNormalMap(),
        normalScale: new THREE.Vector2(0.24, 0.24),
        bumpMap: this.getCitrusPeelBumpTexture(),
        bumpScale: 0.008,
        roughness: 0.24,
        metalness: 0.04,
      });
    const fruitMat = shareMaterial
      ? this.getCachedMat(`orange:${orangeColorHex}:${emissiveHex}`, makeFruitMat)
      : makeFruitMat();

    const orangeGeo = this.getCachedGeo('head_orange_main', () => {
      const g = new THREE.SphereGeometry(0.255, 22, 18);
      g.scale(1.04, 0.88, 1.04);
      return g;
    });
    const fruitMesh = new THREE.Mesh(orangeGeo, fruitMat);
    fruitMesh.position.set(0, 0.20, 0);
    fruitMesh.castShadow = true;
    group.add(fruitMesh);

    // Simple leaf visible at Tier 0/1
    const baseLeafGeo = this.getCachedGeo('head_orange_base_leaf', () => {
      const g = new THREE.ConeGeometry(0.065, 0.17, 6);
      g.scale(1.3, 1.0, 0.35);
      g.rotateZ(Math.PI / 3);
      return g;
    });
    const baseLeaf = new THREE.Mesh(baseLeafGeo, this.leafMaterial);
    baseLeaf.position.set(0.08, 0.42, 0);
    group.add(baseLeaf);

    // Tier 2+: Detailed 5-point green calyx star, woody pedicel stem, and secondary leaf
    const botanicalDetail = new THREE.Group();
    botanicalDetail.position.set(0, 0.41, 0);

    const stem = new THREE.Mesh(
      this.getCachedGeo('head_orange_stem', () => new THREE.CylinderGeometry(0.018, 0.026, 0.09, 6)),
      this.stemMaterial
    );
    stem.position.set(0, 0.035, 0);
    stem.rotation.z = -0.15;
    botanicalDetail.add(stem);

    const sepalGeo = this.getCachedGeo('head_orange_sepal', () => {
      const g = new THREE.ConeGeometry(0.028, 0.085, 4);
      g.rotateX(Math.PI * 0.46);
      return g;
    });
    for (let s = 0; s < 5; s++) {
      const sepal = new THREE.Mesh(sepalGeo, this.leafMaterial);
      sepal.rotation.y = (s / 5) * Math.PI * 2;
      sepal.translateZ(0.035);
      botanicalDetail.add(sepal);
    }

    const secondLeafGeo = this.getCachedGeo('head_orange_second_leaf', () => {
      const g = new THREE.SphereGeometry(0.075, 8, 6);
      g.scale(1.55, 0.22, 0.65);
      return g;
    });
    const secondLeaf = new THREE.Mesh(secondLeafGeo, this.leafMaterial);
    secondLeaf.position.set(-0.085, 0.025, 0.03);
    secondLeaf.rotation.set(0.2, 0.4, -0.35);
    botanicalDetail.add(secondLeaf);

    group.add(botanicalDetail);
    tier2Bucket.push(botanicalDetail);

    return { group, fruitMesh, fruitMat };
  }

  public static getDefaultOrangeForSkin(skin: string) {
    const idx = this.skinDefaultOrangeIndex[skin] ?? 0;
    return HEAD_ORANGE_VARIETIES[idx] || HEAD_ORANGE_VARIETIES[0];
  }

  public static createTextBannerTexture(
    title: string,
    subtitle: string = '',
    bgColor: string = '#0f172a',
    accentColor: string = '#fbbf24'
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 120, 14);
    ctx.fill();

    ctx.lineWidth = 5;
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = subtitle ? '900 36px system-ui, sans-serif' : '900 55px system-ui, sans-serif';
    ctx.fillText(title, 128, subtitle ? 52 : 66);

    if (subtitle) {
      ctx.fillStyle = accentColor;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText(subtitle, 128, 92);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  public static createCapybara(
    hat: string = 'yuzu',
    scale: number = 1.0,
    skin: string = 'classic',
    mutations: MutationId[] = [],
    initialLodTier: CapyLodTier = 3,
    overrideOrangeHex?: number,
    shareMaterials: boolean = true
  ): CapyMeshGroup {
    const group = new THREE.Group() as CapyMeshGroup;

    const furMat = this.createFurMaterial(skin, shareMaterials);
    const muzzleMat = this.createMuzzleMaterial(skin, shareMaterials);
    const bellyMat = this.createUnderbellyMaterial(skin, shareMaterials);

    const lodTier1Group = new THREE.Group();
    const lodTier2Group = new THREE.Group();
    const lodTier3Group = new THREE.Group();
    group.add(lodTier1Group, lodTier2Group, lodTier3Group);

    // Collect references to Limb sub-parts that also respond to LOD tiers
    const limbTier1Refs: THREE.Object3D[] = [];
    const limbTier2Refs: THREE.Object3D[] = [];

    // --- 1. PRIMARY ORGANIC SCULPTED COZY LOAF TORSO ---
    const bodyMesh = new THREE.Mesh(this.getTorsoGeometry(), furMat);
    bodyMesh.name = 'capyBody';
    bodyMesh.position.set(0, 0.74, 0.04);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Tier 1: Soft contoured warm cream/caramel underbelly + cozy chest fluff
    const bellyGeo = this.getCachedGeo('capy_belly', () => {
      const g = new THREE.SphereGeometry(0.49, 18, 12);
      g.scale(0.86, 0.56, 1.38);
      return g;
    });
    const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
    bellyMesh.position.set(0, 0.49, 0.06);
    lodTier1Group.add(bellyMesh);

    const keelGeo = this.getCachedGeo('capy_chest_fluff', () => {
      const g = new THREE.SphereGeometry(0.36, 16, 12);
      g.scale(0.88, 0.74, 1.15);
      return g;
    });
    const keelMesh = new THREE.Mesh(keelGeo, bellyMat);
    keelMesh.position.set(0, 0.48, 0.44);
    lodTier1Group.add(keelMesh);

    // Tier 2: Smooth neck-shoulder blend connecting torso and cute head seamlessly
    const neckDewlapGeo = this.getCachedGeo('capy_dewlap', () => {
      const g = new THREE.SphereGeometry(0.42, 18, 14);
      g.scale(0.94, 0.84, 1.02);
      return g;
    });
    const neckDewlap = new THREE.Mesh(neckDewlapGeo, furMat);
    neckDewlap.name = 'capyBody';
    neckDewlap.position.set(0, 0.82, 0.55);
    lodTier2Group.add(neckDewlap);

    // --- 2. SCULPTED CUTE SOUTH AMERICAN CAPYBARA HEAD ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.02, 0.82);

    const headMesh = new THREE.Mesh(this.getHeadGeometry(), furMat);
    headMesh.name = 'capyHead';
    headMesh.position.set(0, 0.14, 0.02);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headGroup.add(headMesh);

    // Soft blended muzzle fur nose-bridge transitioning naturally out of head
    const snoutMesh = new THREE.Mesh(this.getSnoutGeometry(), muzzleMat);
    snoutMesh.name = 'capyMuzzle';
    snoutMesh.position.set(0, 0.045, 0.40);
    snoutMesh.castShadow = true;
    headGroup.add(snoutMesh);

    // Tier 1: Soft tucked chin, velvety dark rhinarium nose pad, nostrils & gentle philtrum
    const headTier1 = new THREE.Group();
    const jawGeo = this.getCachedGeo('capy_jaw', () => {
      const g = new THREE.SphereGeometry(0.22, 14, 10);
      g.scale(0.92, 0.44, 1.24);
      return g;
    });
    const jawMesh = new THREE.Mesh(jawGeo, bellyMat);
    jawMesh.position.set(0, -0.145, 0.27);
    headTier1.add(jawMesh);

    const rhinariumGeo = this.getCachedGeo('capy_rhinarium', () => {
      const g = new THREE.SphereGeometry(0.155, 16, 12);
      g.scale(1.16, 0.70, 0.48);
      return g;
    });
    const rhinarium = new THREE.Mesh(rhinariumGeo, this.rhinariumMaterial);
    rhinarium.position.set(0, 0.125, 0.635);
    headTier1.add(rhinarium);

    const philtrum = new THREE.Mesh(
      this.getCachedGeo('capy_philtrum', () => new THREE.BoxGeometry(0.018, 0.165, 0.032)),
      this.rhinariumMaterial
    );
    philtrum.position.set(0, 0.015, 0.648);
    headTier1.add(philtrum);

    // Cute subtle "-w-" capybara smile curves
    const smileGeo = this.getCachedGeo('capy_smile_arc', () => {
      const g = new THREE.TorusGeometry(0.052, 0.010, 6, 12, Math.PI * 0.78);
      return g;
    });
    const smileL = new THREE.Mesh(smileGeo, this.rhinariumMaterial);
    smileL.position.set(-0.046, -0.048, 0.645);
    smileL.rotation.set(0.18, -0.12, Math.PI * 1.11);
    const smileR = new THREE.Mesh(smileGeo, this.rhinariumMaterial);
    smileR.position.set(0.046, -0.048, 0.645);
    smileR.rotation.set(0.18, 0.12, Math.PI * 1.11);
    headTier1.add(smileL, smileR);

    headGroup.add(headTier1);
    limbTier1Refs.push(headTier1);

    // Cute slanted capybara nostrils
    const nostrilGeo = this.getCachedGeo('capy_nostril', () => {
      const g = new THREE.SphereGeometry(0.036, 10, 8);
      g.scale(1.22, 0.66, 0.60);
      return g;
    });
    const nostrilL = new THREE.Mesh(nostrilGeo, this.rhinariumMaterial);
    nostrilL.position.set(-0.098, 0.142, 0.678);
    nostrilL.rotation.z = 0.38;
    const nostrilR = nostrilL.clone();
    nostrilR.position.x = 0.098;
    nostrilR.rotation.z = -0.38;
    headGroup.add(nostrilL, nostrilR);

    // Soulful, gentle high-set capybara eyes with dual glossy catchlights
    const eyeGeo = this.getCachedGeo('capy_eye', () => {
      const g = new THREE.SphereGeometry(0.088, 18, 14);
      g.scale(0.88, 1.02, 1.06);
      return g;
    });
    const eyeL = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    eyeL.position.set(-0.320, 0.255, 0.17);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.320;
    headGroup.add(eyeL, eyeR);

    // Tier 1: Primary & secondary glossy catchlights
    const catchGeo = this.getCachedGeo('capy_catch', () => new THREE.SphereGeometry(0.028, 8, 8));
    const catchL = new THREE.Mesh(catchGeo, this.eyeCatchlightMaterial);
    catchL.position.set(-0.368, 0.285, 0.212);
    const catchR = catchL.clone();
    catchR.position.x = 0.368;

    const catchSubGeo = this.getCachedGeo('capy_catch_sub', () => new THREE.SphereGeometry(0.013, 6, 6));
    const catchSubL = new THREE.Mesh(catchSubGeo, this.eyeCatchlightMaterial);
    catchSubL.position.set(-0.370, 0.236, 0.145);
    const catchSubR = catchSubL.clone();
    catchSubR.position.x = 0.370;

    headGroup.add(catchL, catchR, catchSubL, catchSubR);
    limbTier1Refs.push(catchL, catchR, catchSubL, catchSubR);

    // Tier 2: Soft chubby fur cheeks, flush cheek blush tint & smooth blinking upper eyelids
    const headTier2 = new THREE.Group();

    const jowlGeo = this.getCachedGeo('capy_jowl', () => {
      const g = new THREE.SphereGeometry(0.225, 16, 12);
      g.scale(0.92, 0.84, 1.24);
      return g;
    });
    const jowlL = new THREE.Mesh(jowlGeo, furMat);
    jowlL.name = 'capyHead';
    jowlL.position.set(-0.22, -0.04, 0.20);
    const jowlR = jowlL.clone();
    jowlR.position.x = 0.22;
    headTier2.add(jowlL, jowlR);

    const blushGeo = this.getCachedGeo('capy_cheek_blush', () => {
      const g = new THREE.SphereGeometry(0.078, 12, 10);
      g.scale(0.22, 0.56, 0.92);
      return g;
    });
    const blushL = new THREE.Mesh(blushGeo, this.cheekBlushMaterial);
    blushL.position.set(-0.352, 0.088, 0.19);
    const blushR = blushL.clone();
    blushR.position.x = 0.352;
    headTier2.add(blushL, blushR);

    const browGeo = this.getCachedGeo('capy_brow_soft', () => {
      const g = new THREE.SphereGeometry(0.040, 10, 8);
      g.scale(0.58, 0.42, 1.45);
      return g;
    });
    const browL = new THREE.Mesh(browGeo, this.dachshundTanPointMaterial);
    browL.position.set(-0.285, 0.358, 0.18);
    const browR = browL.clone();
    browR.position.x = 0.285;
    headTier2.add(browL, browR);

    const incisorGeo = this.getCachedGeo('capy_incisor', () => new THREE.BoxGeometry(0.044, 0.040, 0.020));
    const incisorL = new THREE.Mesh(incisorGeo, this.incisorMaterial);
    incisorL.position.set(-0.025, -0.092, 0.618);
    const incisorR = incisorL.clone();
    incisorR.position.x = 0.025;
    headTier2.add(incisorL, incisorR);

    headGroup.add(headTier2);
    limbTier2Refs.push(headTier2);

    // Gentle soft-curved upper eyelids matching coat (clean resting arch, closes cleanly on blink)
    const eyelidGeo = this.getCachedGeo(
      'capy_eyelid',
      () => new THREE.SphereGeometry(0.092, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52)
    );
    const eyelidL = new THREE.Mesh(eyelidGeo, furMat);
    eyelidL.name = 'capyHead';
    eyelidL.position.set(-0.320, 0.268, 0.17);
    eyelidL.rotation.z = 0.12;
    eyelidL.scale.y = 0.09; // open by default, scales to 1.0 during blink
    const eyelidR = eyelidL.clone();
    eyelidR.position.x = 0.320;
    eyelidR.rotation.z = -0.12;
    headGroup.add(eyelidL, eyelidR);
    limbTier2Refs.push(eyelidL, eyelidR);

    // Adorable Compact Cupped Velvet Capybara Ears framing the crown cleanly
    const outerEarGeo = this.getCachedGeo('capy_outer_ear', () => {
      const g = new THREE.SphereGeometry(0.132, 14, 12);
      g.scale(0.56, 1.04, 0.92);
      return g;
    });
    const houndFlapGeo = this.getCachedGeo('capy_ear_rim', () => {
      const g = new THREE.SphereGeometry(0.095, 10, 8);
      g.scale(0.42, 0.72, 0.78);
      return g;
    });
    const innerEarGeo = this.getCachedGeo('capy_inner_ear', () => {
      const g = new THREE.SphereGeometry(0.088, 10, 8);
      g.scale(0.48, 0.88, 0.62);
      return g;
    });
    const buildEar = (isLeft: boolean) => {
      const earRoot = new THREE.Group();
      const s = isLeft ? -1 : 1;
      earRoot.position.set(s * 0.31, 0.365, -0.095);
      earRoot.rotation.set(0.16, s * -0.28, s * 0.28);

      const outerEar = new THREE.Mesh(outerEarGeo, muzzleMat);
      outerEar.name = 'capyMuzzle';
      outerEar.rotation.x = -Math.PI * 0.18;
      outerEar.castShadow = true;
      earRoot.add(outerEar);

      const earLobe = new THREE.Mesh(houndFlapGeo, muzzleMat);
      earLobe.name = 'capyMuzzle';
      earLobe.position.set(s * 0.028, -0.068, 0.015);
      earLobe.rotation.set(0.08, 0, s * -0.12);
      earRoot.add(earLobe);

      const innerEar = new THREE.Mesh(innerEarGeo, this.innerEarMaterial);
      innerEar.position.set(s * 0.012, -0.01, 0.042);
      earRoot.add(innerEar);
      limbTier1Refs.push(innerEar);

      return earRoot;
    };
    const earL = buildEar(true);
    const earR = buildEar(false);
    headGroup.add(earL, earR);

    // Tier 3: 12 Tapered Muzzle Vibrissae Whiskers + 4 Supraorbital Brow Whiskers
    const whiskerGroup = new THREE.Group();
    const whiskerGeo = this.getCachedGeo('capy_whisker', () => {
      const g = new THREE.CylinderGeometry(0.003, 0.011, 0.36, 5);
      g.translate(0, 0.18, 0);
      g.rotateZ(Math.PI / 2);
      return g;
    });

    for (let side = -1; side <= 1; side += 2) {
      for (let w = 0; w < 6; w++) {
        const row = Math.floor(w / 2);
        const col = w % 2;
        const whisker = new THREE.Mesh(whiskerGeo, this.whiskerMaterial);
        whisker.position.set(side * 0.24, 0.06 - row * 0.055, 0.50 + col * 0.08);
        const fanYaw = side * (0.18 + col * 0.22);
        const droop = -0.12 - row * 0.14;
        whisker.scale.set(side, 1, 1);
        whisker.rotation.set(0, fanYaw, side * droop);
        whiskerGroup.add(whisker);
      }
      // Supraorbital brow whiskers
      for (let b = 0; b < 2; b++) {
        const bw = new THREE.Mesh(whiskerGeo, this.whiskerMaterial);
        bw.scale.set(side * 0.58, 0.7, 0.7);
        bw.position.set(side * 0.31, 0.37, 0.14 + b * 0.05);
        bw.rotation.set(0, side * 0.15, side * 0.55);
        whiskerGroup.add(bw);
      }
    }
    headGroup.add(whiskerGroup);

    // --- 3. SIGNATURE HEAD ORANGE + OPTIONAL HAT ACCESSORY ---
    const defaultVariety = this.getDefaultOrangeForSkin(skin);
    const activeOrangeHex = overrideOrangeHex ?? defaultVariety.colorHex;
    const matchedVariety =
      HEAD_ORANGE_VARIETIES.find((v) => v.colorHex === activeOrangeHex) ?? defaultVariety;

    const headOrangeData = this.createSculptedHeadOrange(
      activeOrangeHex,
      matchedVariety.emissiveHex,
      limbTier2Refs,
      shareMaterials
    );
    const headOrangeGroup = headOrangeData.group;
    headOrangeGroup.position.set(0, 0.42, 0.04);

    // Pre-build up to 6 extra stacked Head Fruits that appear as you eat fruits
    // and wash off one-by-one when swimming under the Home Pool tap water!
    const headStackMeshes: THREE.Mesh[] = [];
    const stackSphereGeo = this.getCachedGeo('capy_head_stack_orange', () => {
      const g = new THREE.SphereGeometry(0.185, 14, 12);
      g.scale(1.04, 0.88, 1.04);
      return g;
    });
    for (let s = 0; s < 6; s++) {
      const stackFruit = new THREE.Mesh(stackSphereGeo, headOrangeData.fruitMat);
      stackFruit.position.set(0, 0.48 + s * 0.27, 0);
      stackFruit.scale.setScalar(Math.pow(0.93, s));
      stackFruit.castShadow = true;
      stackFruit.visible = false;
      headOrangeGroup.add(stackFruit);
      headStackMeshes.push(stackFruit);
    }

    headGroup.add(headOrangeGroup);

    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.42, 0.04);
    this.attachHat(hatGroup, hat);
    headGroup.add(hatGroup);

    group.add(headGroup);

    // --- 4. ARTICULATED FRONT LIMBS (STAY AT FRONT CHEST IN DACHSHUND MODE) ---
    const legFL = this.buildDetailedLimb(true, true, furMat, limbTier1Refs, limbTier2Refs);
    legFL.position.set(-0.36, 0.53, 0.52);

    const legFR = this.buildDetailedLimb(true, false, furMat, limbTier1Refs, limbTier2Refs);
    legFR.position.set(0.36, 0.53, 0.52);

    group.add(legFL, legFR);

    // --- 5. REAR ASSEMBLY (HIND LEGS + RUMP TAIL — MOVES TO CABOOSE WHEN DACHSHUND GROWS) ---
    const rearAssemblyGroup = new THREE.Group();
    const legBL = this.buildDetailedLimb(false, true, furMat, limbTier1Refs, limbTier2Refs);
    legBL.position.set(-0.37, 0.53, -0.48);

    const legBR = this.buildDetailedLimb(false, false, furMat, limbTier1Refs, limbTier2Refs);
    legBR.position.set(0.37, 0.53, -0.48);

    const tailGeo = this.getCachedGeo('capy_tail', () => {
      const g = new THREE.SphereGeometry(0.115, 10, 10);
      g.scale(0.9, 0.85, 1.15);
      return g;
    });
    const tail = new THREE.Mesh(tailGeo, muzzleMat);
    tail.name = 'capyMuzzle';
    tail.position.set(0, 0.68, -0.86);

    rearAssemblyGroup.add(legBL, legBR, tail);
    group.add(rearAssemblyGroup);

    // --- 6. TIER 3: SOFT UNDERSIDE CHEST & BELLY PLUSH FLEECE (SILKY CONTINUOUS VELVET TOP/BACK) ---
    const tuftGeo = this.getFurTuftGeometry();
    const frontTuftCount = 72;
    const furInstancedMesh = new THREE.InstancedMesh(tuftGeo, furMat, frontTuftCount);
    furInstancedMesh.name = 'capyBody';
    furInstancedMesh.receiveShadow = true;
    furInstancedMesh.frustumCulled = false;

    for (let i = 0; i < frontTuftCount; i++) {
      // Cluster along underside throat/chest & belly (theta centered around Math.PI = bottom)
      const ring = Math.floor(i / 18); // 0..3
      const slot = i % 18;
      const z = -0.10 + ring * 0.22;
      const theta = Math.PI + ((slot / 17) - 0.5) * Math.PI * 0.62;
      const profileR = 0.51 - ring * 0.025;
      const px = Math.sin(theta) * profileR * 0.86;
      const py = 0.72 + Math.cos(theta) * profileR * 0.84;
      _furDummy.position.set(px, py, z);
      _furDummy.rotation.set(0.14, theta * 0.12, -theta * 0.94);
      const s = 0.96 + (i % 3) * 0.10;
      _furDummy.scale.set(s, s * 0.72, s * 1.15);
      _furDummy.updateMatrix();
      furInstancedMesh.setMatrixAt(i, _furDummy.matrix);
    }
    furInstancedMesh.instanceMatrix.needsUpdate = true;
    lodTier3Group.add(furInstancedMesh);

    // Rear underside plush fleece (inside rearAssemblyGroup, hidden from top/back rings)
    const rearTuftCount = 24;
    const rearFurInstancedMesh = new THREE.InstancedMesh(tuftGeo, furMat, rearTuftCount);
    rearFurInstancedMesh.name = 'capyBody';
    rearFurInstancedMesh.receiveShadow = true;
    rearFurInstancedMesh.frustumCulled = false;
    for (let i = 0; i < rearTuftCount; i++) {
      const ring = Math.floor(i / 12);
      const slot = i % 12;
      const z = -0.44 - ring * 0.16;
      const theta = Math.PI + ((slot / 11) - 0.5) * Math.PI * 0.52;
      const r = 0.44 - ring * 0.05;
      _furDummy.position.set(
        Math.sin(theta) * r * 0.84,
        0.70 + Math.cos(theta) * r * 0.82,
        z
      );
      _furDummy.rotation.set(0.14, theta * 0.12, -theta * 0.94);
      const s = 0.92 + (i % 3) * 0.08;
      _furDummy.scale.set(s, s * 0.7, s);
      _furDummy.updateMatrix();
      rearFurInstancedMesh.setMatrixAt(i, _furDummy.matrix);
    }
    rearFurInstancedMesh.instanceMatrix.needsUpdate = true;
    rearAssemblyGroup.add(rearFurInstancedMesh);

    // Store hierarchical limb/head detail refs onto lodTier1Group/lodTier2Group userData for O(1) toggling
    lodTier1Group.userData.linkedNodes = limbTier1Refs;
    lodTier2Group.userData.linkedNodes = limbTier2Refs;
    lodTier3Group.userData.linkedNodes = [whiskerGroup, rearFurInstancedMesh];

    const mutationGroup = new THREE.Group();
    group.add(mutationGroup);
    this.attachMutations(mutationGroup, mutations);

    if (scale !== 1.0) {
      group.scale.setScalar(scale);
    }

    group.userData = {
      legFL,
      legFR,
      legBL,
      legBR,
      head: headGroup,
      earL,
      earR,
      eyelidL,
      eyelidR,
      hatGroup,
      headOrangeGroup,
      headOrangeMesh: headOrangeData.fruitMesh,
      headOrangeMat: headOrangeData.fruitMat,
      headStackMeshes,
      headOrangeColorHex: activeOrangeHex,
      mutationGroup,
      rearAssemblyGroup,
      lodTier1Group,
      lodTier2Group,
      lodTier3Group,
      furInstancedMesh,
      rearFurInstancedMesh,
      walkCycle: 0,
      blinkTimer: 1.5 + Math.random() * 2.5,
      lodTier: initialLodTier,
      skin,
    };

    this.applyLodTier(group, initialLodTier);
    return group;
  }

  /**
   * Zero-allocation O(1) dynamic 60 FPS Level-of-Detail switcher for any Capybara mesh.
   */
  public static applyLodTier(capy: CapyMeshGroup, tier: CapyLodTier) {
    if (!capy?.userData) return;
    capy.userData.lodTier = tier;

    const showT1 = tier >= 1;
    const showT2 = tier >= 2;
    const showT3 = tier >= 3;

    capy.userData.lodTier1Group.visible = showT1;
    const t1Linked = capy.userData.lodTier1Group.userData?.linkedNodes as
      | THREE.Object3D[]
      | undefined;
    if (t1Linked) {
      for (let i = 0; i < t1Linked.length; i++) t1Linked[i].visible = showT1;
    }

    capy.userData.lodTier2Group.visible = showT2;
    const t2Linked = capy.userData.lodTier2Group.userData?.linkedNodes as
      | THREE.Object3D[]
      | undefined;
    if (t2Linked) {
      for (let i = 0; i < t2Linked.length; i++) t2Linked[i].visible = showT2;
    }

    capy.userData.lodTier3Group.visible = showT3;
    const t3Linked = capy.userData.lodTier3Group.userData?.linkedNodes as
      | THREE.Object3D[]
      | undefined;
    if (t3Linked) {
      for (let i = 0; i < t3Linked.length; i++) t3Linked[i].visible = showT3;
    }

    capy.userData.furInstancedMesh.count = showT3 ? 72 : 0;
    capy.userData.rearFurInstancedMesh.count = showT3 ? 24 : 0;
  }

  /**
   * Creates an articulated Dachshund-Snake mid-torso segment that overlaps seamlessly
   * between the front Capybara chest and the trailing Hindquarters Caboose.
   */
  public static createDachshundSegment(
    skin: string = 'classic',
    orangeColorHex: number = 0xff7a00,
    segmentIndex: number = 0,
    initialLodTier: CapyLodTier = 3
  ): DachshundSegmentGroup {
    const group = new THREE.Group() as DachshundSegmentGroup;
    const furMat = this.createFurMaterial(skin);
    const bellyMat = this.createUnderbellyMaterial(skin);

    const barrel = new THREE.Mesh(this.getDachshundBarrelGeometry(), furMat);
    barrel.name = 'capyBody';
    barrel.position.set(0, 0.72, 0);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    group.add(barrel);

    const lodTier1Group = new THREE.Group();
    const lodTier2Group = new THREE.Group();
    const lodTier3Group = new THREE.Group();
    group.add(lodTier1Group, lodTier2Group, lodTier3Group);

    // Tier 1: Seamless cozy warm underbelly along Z (continuous velvet back on top — zero harsh stripe cap)
    const bellyGeo = this.getCachedGeo('dac_belly_long', () => {
      const g = new THREE.SphereGeometry(0.45, 16, 10);
      g.scale(0.82, 0.50, 1.50);
      return g;
    });
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, 0.45, 0);
    lodTier1Group.add(belly);

    // Mounted Back-Counter Fruit Slot on EVERY Dachshund segment (1 fruit per added segment!)
    // Kept directly inside segment group so it stays visible across all LOD tiers whenever active.
    const riderOrangeMat = new THREE.MeshStandardMaterial({
      color: orangeColorHex,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.0,
      normalMap: PbrTextureSynthesizer.getCitrusPeelNormalMap(),
      normalScale: new THREE.Vector2(0.46, 0.46),
      bumpMap: this.getCitrusPeelBumpTexture(),
      bumpScale: 0.022,
      roughness: 0.24,
      metalness: 0.06,
    });
    const riderOrangeGroup = new THREE.Group();
    riderOrangeGroup.position.set(0, 1.32, 0);
    riderOrangeGroup.visible = false; // Toggled dynamically by collected back fruit count!

    const miniOrange = new THREE.Mesh(
      this.getCachedGeo('dac_mini_orange', () => new THREE.SphereGeometry(0.20, 14, 12)),
      riderOrangeMat
    );
    miniOrange.scale.set(1.05, 0.88, 1.05);
    miniOrange.castShadow = true;

    const miniStem = new THREE.Mesh(
      this.getCachedGeo('dac_mini_stem', () => new THREE.CylinderGeometry(0.018, 0.024, 0.075, 6)),
      this.stemMaterial
    );
    miniStem.position.set(0, 0.18, 0);
    miniOrange.add(miniStem);

    const miniLeaf = new THREE.Mesh(
      this.getCachedGeo('dac_mini_leaf', () => new THREE.ConeGeometry(0.052, 0.13, 5)),
      this.leafMaterial
    );
    miniLeaf.rotation.z = Math.PI / 3;
    miniLeaf.position.set(0.065, 0.175, 0);
    miniOrange.add(miniLeaf);

    riderOrangeGroup.add(miniOrange);
    group.add(riderOrangeGroup);

    // Articulated 2-joint Dachshund walking legs on EVERY longer back segment
    const segT1Refs: THREE.Object3D[] = [];
    const segT2Refs: THREE.Object3D[] = [];
    const midLegL = this.buildDetailedLimb(false, true, furMat, segT1Refs, segT2Refs);
    midLegL.position.set(-0.35, 0.49, 0);
    midLegL.scale.set(0.88, 0.92, 0.88);

    const midLegR = this.buildDetailedLimb(false, false, furMat, segT1Refs, segT2Refs);
    midLegR.position.set(0.35, 0.49, 0);
    midLegR.scale.set(0.88, 0.92, 0.88);
    group.add(midLegL, midLegR);
    lodTier1Group.userData.linkedNodes = segT1Refs;
    lodTier2Group.userData.linkedNodes = segT2Refs;

    // Tier 3: Flush soft plush fleece along lower flank-belly joints (smooth velvet back on top!)
    const segTuftCount = 24;
    const furInstancedMesh = new THREE.InstancedMesh(
      this.getFurTuftGeometry(),
      furMat,
      segTuftCount
    );
    furInstancedMesh.name = 'capyBody';
    furInstancedMesh.receiveShadow = true;
    furInstancedMesh.frustumCulled = false;
    for (let i = 0; i < segTuftCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const idx = Math.floor(i / 2); // 0..11
      const z = -0.58 + (idx / 11) * 1.16;
      const theta = Math.PI + side * (0.28 + (i % 3) * 0.14);
      _furDummy.position.set(Math.sin(theta) * 0.42, 0.72 + Math.cos(theta) * 0.44, z);
      _furDummy.rotation.set(0.08, theta * 0.12, -theta * 0.94);
      const s = 0.92 + (i % 3) * 0.08;
      _furDummy.scale.set(s, s * 0.68, s * 1.15);
      _furDummy.updateMatrix();
      furInstancedMesh.setMatrixAt(i, _furDummy.matrix);
    }
    furInstancedMesh.instanceMatrix.needsUpdate = true;
    lodTier3Group.add(furInstancedMesh);

    group.userData = {
      bodyMat: furMat,
      lodTier1Group,
      lodTier2Group,
      lodTier3Group,
      furInstancedMesh,
      midLegL,
      midLegR,
      walkCycle: segmentIndex * 1.15,
      riderOrangeGroup,
      riderOrangeMat,
      segmentIndex,
      lodTier: initialLodTier,
    };

    this.applySegmentLodTier(group, initialLodTier);
    return group;
  }

  public static applySegmentLodTier(seg: DachshundSegmentGroup, tier: CapyLodTier) {
    if (!seg?.userData) return;
    seg.userData.lodTier = tier;
    const showT1 = tier >= 1;
    const showT2 = tier >= 2;
    const showT3 = tier >= 3;
    seg.userData.lodTier1Group.visible = showT1;
    const t1 = seg.userData.lodTier1Group.userData?.linkedNodes as THREE.Object3D[] | undefined;
    if (t1) for (let i = 0; i < t1.length; i++) t1[i].visible = showT1;

    seg.userData.lodTier2Group.visible = showT2;
    const t2 = seg.userData.lodTier2Group.userData?.linkedNodes as THREE.Object3D[] | undefined;
    if (t2) for (let i = 0; i < t2.length; i++) t2[i].visible = showT2;

    seg.userData.lodTier3Group.visible = showT3;
    seg.userData.furInstancedMesh.count = showT3 ? 24 : 0;
  }

  /**
   * Creates the trailing Capybara–Dachshund Hindquarters Caboose (sculpted rump, muscular hind thighs,
   * dark dorsal saddle cap, webbed 3-toed hind legs, and curved tapered Dachshund whip tail).
   */
  public static createDachshundCaboose(
    skin: string = 'classic',
    initialLodTier: CapyLodTier = 3
  ): DachshundCabooseGroup {
    const group = new THREE.Group() as DachshundCabooseGroup;
    const furMat = this.createFurMaterial(skin);

    const lodTier1Group = new THREE.Group();
    const lodTier2Group = new THREE.Group();
    const lodTier3Group = new THREE.Group();
    group.add(lodTier1Group, lodTier2Group, lodTier3Group);

    const t1Refs: THREE.Object3D[] = [];
    const t2Refs: THREE.Object3D[] = [];

    // Rounded furry capybara-dachshund rump cap
    const rumpGeo = this.getCachedGeo('dac_rump_hybrid', () => {
      const g = new THREE.SphereGeometry(0.54, 20, 16);
      g.scale(0.93, 1.0, 1.24);
      return g;
    });
    const rumpMesh = new THREE.Mesh(rumpGeo, furMat);
    rumpMesh.name = 'capyBody';
    rumpMesh.position.set(0, 0.72, 0.04);
    rumpMesh.castShadow = true;
    rumpMesh.receiveShadow = true;
    group.add(rumpMesh);

    const legBL = this.buildDetailedLimb(false, true, furMat, t1Refs, t2Refs);
    legBL.position.set(-0.37, 0.53, -0.06);

    const legBR = this.buildDetailedLimb(false, false, furMat, t1Refs, t2Refs);
    legBR.position.set(0.37, 0.53, -0.06);
    group.add(legBL, legBR);

    // Cute plump vestigial capybara tail nub matching coat seamlessly (still wags inside tailGroup!)
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.68, -0.58);
    const tailBaseGeo = this.getCachedGeo('dac_capy_tail_nub', () => {
      const g = new THREE.SphereGeometry(0.115, 12, 10);
      g.scale(0.92, 0.86, 1.22);
      return g;
    });
    const tailBase = new THREE.Mesh(tailBaseGeo, furMat);
    tailBase.name = 'capyBody';
    tailBase.position.set(0, 0.0, -0.04);
    tailBase.castShadow = true;

    const tailTipGeo = this.getCachedGeo('dac_capy_tail_tip', () => {
      const g = new THREE.SphereGeometry(0.068, 10, 8);
      g.scale(0.9, 0.85, 1.15);
      return g;
    });
    const tailTip = new THREE.Mesh(tailTipGeo, this.createMuzzleMaterial(skin));
    tailTip.position.set(0, -0.01, -0.09);
    tailTip.castShadow = true;
    tailBase.add(tailTip);

    tailGroup.add(tailBase);
    group.add(tailGroup);

    // Tier 3 plush fleece clustered cleanly around tail base & lower haunch transition (smooth butt top!)
    const furCount = 28;
    const furInstancedMesh = new THREE.InstancedMesh(this.getFurTuftGeometry(), furMat, furCount);
    furInstancedMesh.name = 'capyBody';
    furInstancedMesh.receiveShadow = true;
    furInstancedMesh.frustumCulled = false;
    for (let i = 0; i < furCount; i++) {
      const ring = Math.floor(i / 14);
      const slot = i % 14;
      const z = -0.18 - ring * 0.18;
      const theta = Math.PI + ((slot / 13) - 0.5) * Math.PI * 0.54;
      const rScale = 0.43 - ring * 0.04;
      _furDummy.position.set(
        Math.sin(theta) * rScale * 0.84,
        0.70 + Math.cos(theta) * rScale * 0.82,
        z
      );
      _furDummy.rotation.set(0.14, theta * 0.12, -theta * 0.94);
      const s = 0.92 + (i % 3) * 0.08;
      _furDummy.scale.set(s, s * 0.68, s);
      _furDummy.updateMatrix();
      furInstancedMesh.setMatrixAt(i, _furDummy.matrix);
    }
    furInstancedMesh.instanceMatrix.needsUpdate = true;
    lodTier3Group.add(furInstancedMesh);

    lodTier1Group.userData.linkedNodes = t1Refs;
    lodTier2Group.userData.linkedNodes = t2Refs;

    group.userData = {
      bodyMat: furMat,
      legBL,
      legBR,
      tailGroup,
      lodTier1Group,
      lodTier2Group,
      lodTier3Group,
      furInstancedMesh,
      walkCycle: 0,
      lodTier: initialLodTier,
    };

    this.applyCabooseLodTier(group, initialLodTier);
    return group;
  }

  public static applyCabooseLodTier(caboose: DachshundCabooseGroup, tier: CapyLodTier) {
    if (!caboose?.userData) return;
    caboose.userData.lodTier = tier;
    const showT1 = tier >= 1;
    const showT2 = tier >= 2;
    const showT3 = tier >= 3;

    caboose.userData.lodTier1Group.visible = showT1;
    const t1 = caboose.userData.lodTier1Group.userData?.linkedNodes as
      | THREE.Object3D[]
      | undefined;
    if (t1) for (let i = 0; i < t1.length; i++) t1[i].visible = showT1;

    caboose.userData.lodTier2Group.visible = showT2;
    const t2 = caboose.userData.lodTier2Group.userData?.linkedNodes as
      | THREE.Object3D[]
      | undefined;
    if (t2) for (let i = 0; i < t2.length; i++) t2[i].visible = showT2;

    caboose.userData.lodTier3Group.visible = showT3;
    caboose.userData.furInstancedMesh.count = showT3 ? 28 : 0;
  }

  /**
   * Creates a physically simulated 3D dimpled citrus fruit of any exponential radius
   * with separate rollGroup (3-axis rolling angular spin) and squashGroup (soft-body impact bounce).
   */
  public static createCollectibleOrange(
    colorHex: number = 0xff7a00,
    emissiveHex: number = 0x7c2d12,
    radius: number = 0.28
  ): CollectibleOrangeGroup {
    const group = new THREE.Group() as CollectibleOrangeGroup;

    const squashGroup = new THREE.Group();
    const rollGroup = new THREE.Group();
    squashGroup.add(rollGroup);
    group.add(squashGroup);

    const fruitMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: emissiveHex,
      emissiveIntensity: 0.0,
      normalMap: PbrTextureSynthesizer.getCitrusPeelNormalMap(),
      normalScale: new THREE.Vector2(0.52, 0.52),
      bumpMap: this.getCitrusPeelBumpTexture(),
      bumpScale: 0.028,
      roughness: 0.22,
      metalness: 0.04,
    });

    const sphereGeo = this.getCachedGeo('unit_orange_sphere', () => {
      const g = new THREE.SphereGeometry(1.0, 20, 16);
      g.scale(1.03, 0.94, 1.03);
      return g;
    });
    const fruitMesh = new THREE.Mesh(sphereGeo, fruitMat);
    fruitMesh.scale.setScalar(radius);
    fruitMesh.castShadow = true;
    fruitMesh.receiveShadow = true;
    rollGroup.add(fruitMesh);

    const leafGroup = new THREE.Group();
    leafGroup.position.set(0, radius * 0.88, 0);
    const stemScale = radius / 0.28;

    const stem = new THREE.Mesh(
      this.getCachedGeo('unit_orange_stem', () => new THREE.CylinderGeometry(0.02, 0.028, 0.09, 6)),
      this.stemMaterial
    );
    stem.scale.setScalar(stemScale);
    stem.position.y = 0.035 * stemScale;
    leafGroup.add(stem);

    const leafGeo = this.getCachedGeo('unit_orange_leaf', () => {
      const g = new THREE.SphereGeometry(0.095, 8, 6);
      g.scale(1.5, 0.24, 0.68);
      return g;
    });
    const leaf = new THREE.Mesh(leafGeo, this.leafMaterial);
    leaf.scale.setScalar(stemScale);
    leaf.position.set(0.09 * stemScale, 0.028 * stemScale, 0);
    leaf.rotation.z = 0.28;
    leafGroup.add(leaf);
    rollGroup.add(leafGroup);

    // Subtle ground contact ring (stays horizontal beneath the rolling fruit)
    const haloMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.42,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const haloRing = new THREE.Mesh(
      this.getCachedGeo('unit_orange_halo', () => new THREE.RingGeometry(0.92, 1.22, 24)),
      haloMat
    );
    haloRing.scale.setScalar(radius);
    haloRing.rotation.x = Math.PI / 2;
    haloRing.position.y = -radius + 0.02;
    haloRing.userData.ignoreCameraFade = true;
    group.add(haloRing);

    group.userData = {
      rollGroup,
      squashGroup,
      fruitMat,
      haloRing,
      haloMat,
      leafGroup,
      radius,
    };

    return group;
  }

  public static setHeadFruitStackCount(capy: CapyMeshGroup, _totalCarriedFruits: number) {
    if (!capy?.userData?.headStackMeshes) return;
    // STRICT RULE: Only 1 orange ever sits on the player's head; collected fruit sits on the back!
    const meshes = capy.userData.headStackMeshes;
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].visible = false;
    }
  }

  public static setDachshundSegmentFruitState(
    seg: DachshundSegmentGroup,
    visible: boolean,
    colorHex?: number,
    emissiveHex: number = 0x7c2d12
  ) {
    if (!seg?.userData?.riderOrangeGroup) return;
    seg.userData.riderOrangeGroup.visible = visible;
    if (visible && seg.userData.riderOrangeMat && typeof colorHex === 'number') {
      seg.userData.riderOrangeMat.color.setHex(colorHex);
      seg.userData.riderOrangeMat.emissive.setHex(emissiveHex);
    }
  }

  public static setHeadOrangeColor(
    capy: CapyMeshGroup,
    colorHex: number,
    emissiveHex: number = 0x7c2d12
  ) {
    if (!capy?.userData?.headOrangeMat) return;
    capy.userData.headOrangeColorHex = colorHex;
    capy.userData.headOrangeMat.color.setHex(colorHex);
    capy.userData.headOrangeMat.emissive.setHex(emissiveHex);
  }

  public static updateCapyAppearance(
    capy: CapyMeshGroup,
    hat: string,
    skin: string,
    mutations: MutationId[],
    overrideOrangeHex?: number,
    overrideFurHex?: number
  ) {
    this.attachHat(capy.userData.hatGroup, hat);
    this.attachMutations(capy.userData.mutationGroup, mutations);
    capy.userData.skin = skin;

    const furColor =
      typeof overrideFurHex === 'number' && Number.isFinite(overrideFurHex)
        ? overrideFurHex
        : (this.skinColors[skin] ?? this.skinColors.classic);
    const furTex = this.getFurAlbedoTexture(furColor);
    const sheenColor = new THREE.Color(furColor).lerp(new THREE.Color(0xfff1d6), 0.58);
    const muzzleColor = new THREE.Color(furColor).lerp(
      new THREE.Color(skin === 'classic' ? 0x673c22 : 0x523120),
      skin === 'classic' ? 0.58 : 0.34
    );
    const muzzleSheenColor = muzzleColor.clone().lerp(new THREE.Color(0xffe8cc), 0.42);

    capy.traverse((obj) => {
      if (obj instanceof THREE.Mesh && (obj.name === 'capyBody' || obj.name === 'capyHead')) {
        const mat = obj.material as THREE.MeshPhysicalMaterial;
        mat.color.setHex(0xffffff);
        mat.map = furTex;
        mat.roughness = skin === 'golden' ? 0.42 : 0.78;
        mat.metalness = skin === 'golden' ? 0.34 : 0.02;
        if (mat.sheenColor) {
          mat.sheen = 0.78;
          mat.sheenRoughness = 0.56;
          mat.sheenColor.copy(sheenColor);
        }
        mat.needsUpdate = true;
      } else if (obj instanceof THREE.Mesh && obj.name === 'capyMuzzle') {
        const mat = obj.material as THREE.MeshPhysicalMaterial;
        mat.color.copy(muzzleColor);
        if (mat.sheenColor) {
          mat.sheenColor.copy(muzzleSheenColor);
        }
        mat.needsUpdate = true;
      }
    });

    if (capy.userData.furInstancedMesh) {
      const fMat = capy.userData.furInstancedMesh.material as THREE.MeshPhysicalMaterial;
      fMat.map = furTex;
      if (fMat.sheenColor) {
        fMat.sheenColor.copy(sheenColor);
      }
      fMat.needsUpdate = true;
    }
    if (capy.userData.rearFurInstancedMesh) {
      const rfMat = capy.userData.rearFurInstancedMesh.material as THREE.MeshPhysicalMaterial;
      rfMat.map = furTex;
      if (rfMat.sheenColor) {
        rfMat.sheenColor.copy(sheenColor);
      }
      rfMat.needsUpdate = true;
    }

    const variety =
      overrideOrangeHex !== undefined
        ? (HEAD_ORANGE_VARIETIES.find((v) => v.colorHex === overrideOrangeHex) ??
            this.getDefaultOrangeForSkin(skin))
        : this.getDefaultOrangeForSkin(skin);
    this.setHeadOrangeColor(capy, overrideOrangeHex ?? variety.colorHex, variety.emissiveHex);
  }

  public static attachHat(hatGroup: THREE.Group, hatType: string) {
    while (hatGroup.children.length > 0) {
      hatGroup.remove(hatGroup.children[0]);
    }

    // Note: The signature sculpted Head Orange (`headOrangeGroup`) ALWAYS stays visible on the
    // Capybara's head so the player can always match its color! Accessory hats frame or crown it.
    if (hatType === 'yuzu') {
      // Head Orange stands solo in full glory
      return;
    } else if (hatType === 'crown') {
      const crownMat = this.getCachedMat(
        'hat_crown',
        () =>
          new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.92,
            roughness: 0.13,
            envMapIntensity: 1.35,
          })
      );
      // Golden crown ring encircling the base of the Head Orange
      const crownGeo = this.getCachedGeo(
        'hat_crown',
        () => new THREE.CylinderGeometry(0.31, 0.28, 0.14, 8, 1, true)
      );
      const crownMesh = new THREE.Mesh(crownGeo, crownMat);
      crownMesh.position.set(0, 0.10, 0);
      hatGroup.add(crownMesh);
    } else if (hatType === 'flower') {
      const flowerMat = this.getCachedMat(
        'hat_flower',
        () =>
          new THREE.MeshStandardMaterial({
            color: 0xff69b4,
            roughness: 0.4,
          })
      );
      const petalGeo = this.getCachedGeo('hat_flower_petal', () => {
        const g = new THREE.SphereGeometry(0.11, 8, 8);
        g.scale(1.2, 0.35, 0.6);
        return g;
      });
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(petalGeo, flowerMat);
        petal.position.set(-0.22, 0.10, 0.08);
        petal.rotation.y = (i * Math.PI * 2) / 5;
        petal.translateX(0.09);
        hatGroup.add(petal);
      }
    } else if (hatType === 'party') {
      const cone = new THREE.Mesh(
        this.getCachedGeo('hat_party_cone', () => new THREE.ConeGeometry(0.14, 0.34, 12)),
        this.getCachedMat('hat_party_cone', () => new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.3 }))
      );
      cone.position.set(-0.22, 0.32, -0.06);
      cone.rotation.z = 0.35;
      const pom = new THREE.Mesh(
        this.getCachedGeo('hat_party_pom', () => new THREE.SphereGeometry(0.055, 8, 8)),
        this.getCachedMat('hat_party_pom', () => new THREE.MeshStandardMaterial({ color: 0xfacc15 }))
      );
      pom.position.set(-0.33, 0.48, -0.06);
      hatGroup.add(cone, pom);
    } else if (hatType === 'wizard') {
      const wizMat = this.getCachedMat(
        'hat_wizard',
        () => new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 })
      );
      const brim = new THREE.Mesh(
        this.getCachedGeo('hat_wizard_brim', () => new THREE.RingGeometry(0.26, 0.44, 18)),
        wizMat
      );
      brim.rotation.x = Math.PI / 2;
      brim.position.set(0, 0.03, 0);
      hatGroup.add(brim);
    } else if (hatType === 'halo') {
      const halo = new THREE.Mesh(
        this.getCachedGeo('hat_halo', () => new THREE.TorusGeometry(0.30, 0.038, 12, 24)),
        this.getCachedMat(
          'hat_halo',
          () =>
            new THREE.MeshStandardMaterial({
              color: 0xfef08a,
              emissive: 0xfacc15,
              emissiveIntensity: 0.6,
              roughness: 0.1,
            })
        )
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 0.56, 0);
      hatGroup.add(halo);
    }
  }

  public static attachMutations(mutationGroup: THREE.Group, mutations: MutationId[]) {
    while (mutationGroup.children.length > 0) {
      mutationGroup.remove(mutationGroup.children[0]);
    }

    if (mutations.includes('tusks')) {
      const tuskMat = this.getCachedMat(
        'mut_tusk',
        () => new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.25 })
      );
      const tuskGeo = this.getCachedGeo('mut_tusk', () => {
        const g = new THREE.ConeGeometry(0.06, 0.38, 8);
        g.rotateX(Math.PI / 3);
        return g;
      });
      const tuskL = new THREE.Mesh(tuskGeo, tuskMat);
      tuskL.position.set(-0.28, 1.0, 1.44);
      const tuskR = tuskL.clone();
      tuskR.position.x = 0.28;
      mutationGroup.add(tuskL, tuskR);
    }

    if (mutations.includes('horn')) {
      const hornMat = this.getCachedMat(
        'mut_horn',
        () =>
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.5,
            metalness: 0.7,
            roughness: 0.15,
          })
      );
      const horn = new THREE.Mesh(
        this.getCachedGeo('mut_horn', () => new THREE.ConeGeometry(0.09, 0.52, 10)),
        hornMat
      );
      horn.rotation.x = Math.PI / 4.2;
      horn.position.set(0, 1.48, 1.24);
      mutationGroup.add(horn);
    }

    if (mutations.includes('shell')) {
      const shellMat = this.getCachedMat(
        'mut_shell',
        () =>
          new THREE.MeshStandardMaterial({
            color: 0x15803d,
            roughness: 0.5,
            metalness: 0.2,
          })
      );
      const shell = new THREE.Mesh(
        this.getCachedGeo(
          'mut_shell',
          () => new THREE.SphereGeometry(0.64, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)
        ),
        shellMat
      );
      shell.scale.set(0.96, 0.75, 1.25);
      shell.position.set(0, 0.84, 0.02);
      mutationGroup.add(shell);

      const spikeGeo = this.getCachedGeo('mut_shell_spike', () => new THREE.ConeGeometry(0.085, 0.24, 6));
      for (let i = -1; i <= 1; i++) {
        const spike = new THREE.Mesh(spikeGeo, this.yuzuMaterial);
        spike.position.set(0, 1.38, i * 0.42);
        mutationGroup.add(spike);
      }
    }

    if (mutations.includes('wings')) {
      const wingMat = this.getCachedMat(
        'mut_wing',
        () =>
          new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.3,
            metalness: 0.1,
          })
      );
      const wingGeo = this.getCachedGeo('mut_wing', () => new THREE.BoxGeometry(0.95, 0.08, 0.55));
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-0.85, 1.05, 0.12);
      wingL.rotation.z = 0.25;

      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(0.85, 1.05, 0.12);
      wingR.rotation.z = -0.25;
      mutationGroup.add(wingL, wingR);
    }

    if (mutations.includes('flippers')) {
      const flipMat = this.getCachedMat(
        'mut_flipper',
        () => new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.35 })
      );
      const flipGeo = this.getCachedGeo('mut_flipper', () => new THREE.BoxGeometry(0.32, 0.06, 0.42));
      const positions = [
        [-0.36, 0.04, 0.58],
        [0.36, 0.04, 0.58],
      ];
      for (const [x, y, z] of positions) {
        const f = new THREE.Mesh(flipGeo, flipMat);
        f.position.set(x, y, z);
        mutationGroup.add(f);
      }
    }

    if (mutations.includes('glow_tail')) {
      const glowMat = this.getCachedMat('mut_glow_plume', () => {
        const m = new THREE.MeshStandardMaterial({
          color: 0xc084fc,
          emissive: 0xa855f7,
          emissiveIntensity: 0.75,
          roughness: 0.18,
        });
        m.userData.isBioluminescentTail = true;
        return m;
      });
      const tailPlume = new THREE.Mesh(
        this.getCachedGeo('mut_glow_plume', () => new THREE.ConeGeometry(0.22, 0.68, 12)),
        glowMat
      );
      tailPlume.userData.isBioluminescentTail = true;
      tailPlume.rotation.x = -Math.PI / 3;
      tailPlume.position.set(0, 0.88, -1.02);

      const tipMat = this.getCachedMat('mut_glow_tip', () => {
        const m = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x22d3ee,
          emissiveIntensity: 0.95,
          roughness: 0.12,
        });
        m.userData.isBioluminescentTail = true;
        return m;
      });
      const tipOrb = new THREE.Mesh(
        this.getCachedGeo('mut_glow_orb', () => new THREE.SphereGeometry(0.11, 10, 10)),
        tipMat
      );
      tipOrb.userData.isBioluminescentTail = true;
      tipOrb.position.set(0, 1.06, -1.32);

      mutationGroup.add(tailPlume, tipOrb);
    }
  }

  public static createBuildingByType(type: BuildingType, level: number = 1): THREE.Group {
    switch (type) {
      case 'hot_spring':
        return this.createHotSpring(level);
      case 'yuzu_orchard':
        return this.createYuzuTree(level);
      case 'trampoline_pad':
        return this.createMushroomPad(level);
      case 'bamboo_grove':
        return this.createBambooGrove(level);
      case 'zen_pagoda':
        return this.createZenPagoda(level);
      case 'capy_statue':
        return this.createCapyMonument(level);
    }
  }

  public static createHotSpring(_level: number = 1): THREE.Group {
    const group = new THREE.Group();
    group.userData.ignoreCameraFade = true;
    const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');
    const timberTex = RealisticWorldEnvironment.getTextureSet('timber');
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      map: basaltTex.albedo,
      normalMap: basaltTex.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: basaltTex.roughness,
      roughness: 0.62,
      metalness: 0.12,
    });
    const radius = 2.4;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48), rockMat);
      rock.position.set(Math.cos(angle) * radius, 0.25, Math.sin(angle) * radius);
      rock.scale.set(1.15, 0.75, 1.15);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
    }

    const waterNorms = PbrTextureSynthesizer.getWaterNormalMaps();
    const waterMat = this.leanTextureMode
      ? new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          roughness: 0.14,
          metalness: 0.12,
          normalMap: waterNorms.primary,
          normalScale: new THREE.Vector2(0.45, 0.45),
          transparent: true,
          opacity: 0.86,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0x0ea5e9,
          roughness: 0.08,
          clearcoat: 1.0,
          normalMap: waterNorms.primary,
          normalScale: new THREE.Vector2(0.45, 0.45),
          clearcoatNormalMap: waterNorms.secondary,
          clearcoatNormalScale: new THREE.Vector2(0.3, 0.3),
          transparent: true,
          opacity: 0.86,
        });
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(radius - 0.2, radius - 0.2, 0.22, 24),
      waterMat
    );
    water.position.set(0, 0.16, 0);
    water.userData.ignoreCameraFade = true;
    group.add(water);

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xb47b48,
      map: timberTex.albedo,
      normalMap: timberTex.normal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: timberTex.roughness,
      roughness: 0.7,
    });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), woodMat);
    post.position.set(-radius + 0.3, 0.6, 0);
    group.add(post);

    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8), woodMat);
    pipe.rotation.z = -Math.PI / 3;
    pipe.position.set(-radius + 0.7, 1.0, 0);
    group.add(pipe);

    for (let i = 0; i < 4; i++) {
      const fy = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), this.yuzuMaterial);
      fy.position.set(Math.cos(i * 1.7) * 0.9, 0.28, Math.sin(i * 1.7) * 0.9);
      group.add(fy);
    }

    return group;
  }

  public static createYuzuTree(_level: number = 1): THREE.Group {
    const group = new THREE.Group();
    const barkTex = RealisticWorldEnvironment.getTextureSet('bark');
    const foliageTex = RealisticWorldEnvironment.getTextureSet('foliage');
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.38, 2.3, 10),
      new THREE.MeshStandardMaterial({
        color: 0x8c6244,
        map: barkTex.albedo,
        bumpMap: barkTex.bump,
        bumpScale: 0.12,
        roughness: 0.85,
      })
    );
    trunk.position.set(0, 1.15, 0);
    trunk.castShadow = true;
    group.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      map: foliageTex.albedo,
      bumpMap: foliageTex.bump,
      bumpScale: 0.1,
      roughness: 0.76,
    });
    const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 2), foliageMat);
    c1.position.set(0, 2.6, 0);
    c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 2), foliageMat);
    c2.position.set(0.55, 3.05, 0.25);
    c2.castShadow = true;
    group.add(c1, c2);

    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), this.yuzuMaterial);
      fruit.position.set(Math.cos(angle) * 1.05, 2.25 + (i % 2) * 0.45, Math.sin(angle) * 1.05);
      group.add(fruit);
    }
    return group;
  }

  public static createMushroomPad(_level: number = 1): THREE.Group {
    const group = new THREE.Group();
    const timberTex = RealisticWorldEnvironment.getTextureSet('timber');
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 1.1, 14),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        bumpMap: timberTex.bump,
        bumpScale: 0.04,
        roughness: 0.7,
      })
    );
    stem.position.set(0, 0.55, 0);
    stem.castShadow = true;
    group.add(stem);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.85, 0.45, 24),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        bumpMap: this.getCitrusPeelBumpTexture(),
        bumpScale: 0.03,
        roughness: 0.35,
      })
    );
    cap.position.set(0, 1.2, 0);
    cap.castShadow = true;
    group.add(cap);

    const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 12), dotMat);
      dot.position.set(Math.cos(a) * 0.95, 1.44, Math.sin(a) * 0.95);
      group.add(dot);
    }
    return group;
  }

  public static createBambooGrove(_level: number = 1): THREE.Group {
    const group = new THREE.Group();
    const timberTex = RealisticWorldEnvironment.getTextureSet('timber');
    const stalkMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      bumpMap: timberTex.bump,
      bumpScale: 0.05,
      roughness: 0.38,
    });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 });

    const offsets = [
      [-0.6, -0.4],
      [0.5, -0.5],
      [0, 0.4],
      [-0.4, 0.6],
      [0.7, 0.3],
    ];

    for (const [ox, oz] of offsets) {
      const h = 3.2 + Math.random() * 1.4;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, h, 10), stalkMat);
      stalk.position.set(ox, h / 2, oz);
      stalk.castShadow = true;
      group.add(stalk);

      for (let y = 0.8; y < h; y += 0.9) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.025, 6, 12), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(ox, y, oz);
        group.add(ring);
      }
    }
    return group;
  }

  public static createZenPagoda(_level: number = 1): THREE.Group {
    const group = new THREE.Group();
    const timberTex = RealisticWorldEnvironment.getTextureSet('timber');
    const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      map: timberTex.albedo,
      bumpMap: timberTex.bump,
      bumpScale: 0.06,
      roughness: 0.52,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      map: basaltTex.albedo,
      bumpMap: basaltTex.bump,
      bumpScale: 0.08,
      roughness: 0.38,
      metalness: 0.35,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.92,
      roughness: 0.14,
      envMapIntensity: 1.35,
    });

    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.45,
      roughness: 0.22,
    });
    lanternMat.userData.isNightLantern = true;

    for (let tier = 0; tier < 3; tier++) {
      const scale = 1 - tier * 0.22;
      const yBase = tier * 1.35;

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.2 * scale, 1.1, 2.2 * scale),
        wallMat
      );
      body.position.set(0, yBase + 0.55, 0);
      body.castShadow = true;
      group.add(body);

      // Warm shoji paper-lantern window band around each pagoda tier
      const shojiBand = new THREE.Mesh(
        new THREE.BoxGeometry(2.24 * scale, 0.34, 1.18 * scale),
        lanternMat
      );
      shojiBand.position.set(0, yBase + 0.58, 0);
      const shojiBandCross = new THREE.Mesh(
        new THREE.BoxGeometry(1.18 * scale, 0.34, 2.24 * scale),
        lanternMat
      );
      shojiBandCross.position.set(0, yBase + 0.58, 0);
      group.add(shojiBand, shojiBandCross);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.15 * scale, 0.65, 4),
        roofMat
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, yBase + 1.35, 0);
      roof.castShadow = true;
      group.add(roof);

      // Hanging corner eave lanterns on the ground & middle tiers
      if (tier < 2) {
        const eaveR = 1.42 * scale;
        const corners = [
          [eaveR, eaveR],
          [-eaveR, eaveR],
          [eaveR, -eaveR],
          [-eaveR, -eaveR],
        ];
        for (const [cx, cz] of corners) {
          const globe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.1, 0.24, 8),
            lanternMat
          );
          globe.position.set(cx, yBase + 0.96, cz);
          group.add(globe);
        }
      }
    }

    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 1.1, 10), goldMat);
    finial.position.set(0, 4.6, 0);
    group.add(finial);

    // Additive warm courtyard light-pool halo (zero PointLight shader recompilation!)
    const pagodaGlowMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const pagodaGlowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 24),
      pagodaGlowMat
    );
    pagodaGlowDisc.rotation.x = -Math.PI / 2;
    pagodaGlowDisc.position.set(0, 0.06, 0);
    pagodaGlowDisc.userData.ignoreCameraFade = true;
    group.add(pagodaGlowDisc);

    group.userData.pagodaGlowMat = pagodaGlowMat;
    group.userData.pagodaLanternMat = lanternMat;

    return group;
  }

  public static createCapyMonument(_level: number = 1): THREE.Group {
    const group = new THREE.Group();
    const basaltTex = RealisticWorldEnvironment.getTextureSet('basalt');
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.65, 1.1, 16),
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        map: basaltTex.albedo,
        bumpMap: basaltTex.bump,
        bumpScale: 0.09,
        roughness: 0.55,
      })
    );
    pedestal.position.set(0, 0.55, 0);
    pedestal.castShadow = true;
    group.add(pedestal);

    const goldenCapy = this.createCapybara('crown', 1.25, 'golden', [], 2);
    goldenCapy.position.set(0, 1.1, 0);
    group.add(goldenCapy);
    return group;
  }

  public static createWorldPortal(
    title: string,
    subtitle: string,
    colorHex: number,
    accentCss: string
  ): THREE.Group {
    const group = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.18,
      roughness: 0.25,
      metalness: 0.6,
    });
    frameMat.userData.isPortalFrame = true;

    const pillarGeo = new THREE.CylinderGeometry(0.24, 0.28, 3.6, 12);
    const leftPillar = new THREE.Mesh(pillarGeo, frameMat);
    leftPillar.position.set(-1.6, 1.8, 0);
    leftPillar.castShadow = true;

    const rightPillar = leftPillar.clone();
    rightPillar.position.x = 1.6;
    group.add(leftPillar, rightPillar);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: colorHex,
      emissiveIntensity: 0.75,
      roughness: 0.12,
    });
    beaconMat.userData.isPortalBeacon = true;
    const beaconL = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), beaconMat);
    beaconL.position.set(-1.6, 3.72, 0);
    const beaconR = beaconL.clone();
    beaconR.position.x = 1.6;
    group.add(beaconL, beaconR);

    const vortexMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.68,
      roughness: 0.1,
      side: THREE.DoubleSide,
    });
    vortexMat.userData.isPortalVortex = true;
    const vortex = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.12, 24), vortexMat);
    vortex.rotation.x = Math.PI / 2;
    vortex.position.set(0, 1.8, 0);
    group.add(vortex);

    const bannerTex = this.createTextBannerTexture(title, subtitle, '#0f172a', accentCss);
    const signMat = new THREE.MeshBasicMaterial({ map: bannerTex });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.25, 0.22), signMat);
    sign.position.set(0, 3.9, 0);
    group.add(sign);

    group.userData.vortexMat = vortexMat;
    group.userData.frameMat = frameMat;
    group.userData.beaconMat = beaconMat;

    return group;
  }
}
