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
    classic: 0x8d5b36,
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
  private static sharedFurBumpMap: THREE.CanvasTexture | null = null;
  private static sharedCitrusBumpMap: THREE.CanvasTexture | null = null;

  // Shared anatomical sub-materials (varied roughness >= 0.25 for realistic PBR contrast)
  private static snoutMaterial = new THREE.MeshStandardMaterial({
    color: 0x462916,
    roughness: 0.86,
    metalness: 0.02,
  });

  private static rhinariumMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c1009,
    roughness: 0.28,
    metalness: 0.08,
  });

  private static eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0908,
    roughness: 0.08,
    metalness: 0.14,
  });

  private static eyeCatchlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  private static innerEarMaterial = new THREE.MeshStandardMaterial({
    color: 0x7c4a3a,
    roughness: 0.72,
    metalness: 0.02,
  });

  private static incisorMaterial = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.24,
    metalness: 0.05,
  });

  private static legMaterial = new THREE.MeshStandardMaterial({
    color: 0x5c3419,
    roughness: 0.84,
    metalness: 0.04,
  });

  private static webbingMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b2110,
    roughness: 0.68,
    metalness: 0.04,
  });

  private static clawMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f140d,
    roughness: 0.32,
    metalness: 0.18,
  });

  private static whiskerMaterial = new THREE.MeshStandardMaterial({
    color: 0xe7d5c0,
    roughness: 0.42,
    metalness: 0.05,
  });

  private static yuzuMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8800,
    normalMap: PbrTextureSynthesizer.getCitrusPeelNormalMap(),
    normalScale: new THREE.Vector2(0.48, 0.48),
    roughness: 0.26,
    metalness: 0.08,
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

  // Cached geometries so creating/growing Dachshund segments has near-zero CPU cost
  private static sharedTorsoGeo: THREE.BufferGeometry | null = null;
  private static sharedHeadGeo: THREE.BufferGeometry | null = null;
  private static sharedSnoutGeo: THREE.BufferGeometry | null = null;
  private static sharedFurTuftGeo: THREE.BufferGeometry | null = null;
  private static sharedDachshundBarrelGeo: THREE.BufferGeometry | null = null;

  private static getFurBumpTexture(): THREE.CanvasTexture {
    if (this.sharedFurBumpMap) return this.sharedFurBumpMap;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 3200; i++) {
        const x = (i * 73) % 256;
        const y = (i * 137) % 256;
        const lum = 75 + ((i * 29) % 135);
        ctx.strokeStyle = `rgb(${lum},${lum},${lum})`;
        ctx.lineWidth = 1 + (i % 2) * 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (((i % 5) - 2) * 1.4), y + 7 + (i % 6));
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    PbrTextureSynthesizer.registerManagedTexture(tex);
    this.sharedFurBumpMap = tex;
    return tex;
  }

  private static getFurAlbedoTexture(baseHex: number): THREE.CanvasTexture {
    const cached = this.furAlbedoCache.get(baseHex);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const baseCol = new THREE.Color(baseHex);
    const darkCol = baseCol.clone().multiplyScalar(0.68);
    const midCol = baseCol.clone().multiplyScalar(0.92);
    const lightCol = baseCol.clone().lerp(new THREE.Color(0xfffbeb), 0.24);

    if (ctx) {
      ctx.fillStyle = `#${baseCol.getHexString()}`;
      ctx.fillRect(0, 0, 256, 256);

      const palette = [
        `#${darkCol.getHexString()}`,
        `#${midCol.getHexString()}`,
        `#${baseCol.getHexString()}`,
        `#${lightCol.getHexString()}`,
      ];

      // Paint 2,800 coarse directional bristle hairs characteristic of capybara coats
      for (let i = 0; i < 2800; i++) {
        const x = (i * 97 + (i % 13) * 7) % 256;
        const y = (i * 53 + (i % 17) * 11) % 256;
        ctx.strokeStyle = palette[i % palette.length];
        ctx.globalAlpha = 0.42 + (i % 4) * 0.12;
        ctx.lineWidth = 1.1 + (i % 3) * 0.45;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const sway = ((i % 7) - 3) * 1.1;
        ctx.quadraticCurveTo(x + sway * 0.5, y + 4, x + sway, y + 8 + (i % 5));
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

  private static createFurMaterial(skin: string): THREE.MeshStandardMaterial {
    const furColor = this.skinColors[skin] ?? this.skinColors.classic;
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.getFurAlbedoTexture(furColor),
      normalMap: PbrTextureSynthesizer.getCapyFurNormalMap(),
      normalScale: new THREE.Vector2(0.58, 0.58),
      roughness: skin === 'golden' ? 0.45 : 0.84,
      metalness: skin === 'golden' ? 0.38 : 0.04,
    });
  }

  private static createUnderbellyMaterial(skin: string): THREE.MeshStandardMaterial {
    const base = new THREE.Color(this.skinColors[skin] ?? this.skinColors.classic);
    base.lerp(new THREE.Color(0xfef3c7), 0.38);
    return new THREE.MeshStandardMaterial({
      color: base,
      normalMap: PbrTextureSynthesizer.getCapyFurNormalMap(),
      normalScale: new THREE.Vector2(0.36, 0.36),
      roughness: 0.9,
      metalness: 0.02,
    });
  }

  private static getTorsoGeometry(): THREE.BufferGeometry {
    if (this.sharedTorsoGeo) return this.sharedTorsoGeo;
    // Anatomical capybara barrel profile revolved along spine, then rotated to Z
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.001, -0.82),
      new THREE.Vector2(0.28, -0.78),
      new THREE.Vector2(0.49, -0.64),
      new THREE.Vector2(0.58, -0.38), // plump capybara rump
      new THREE.Vector2(0.60, -0.05), // deep barrel ribcage
      new THREE.Vector2(0.57, 0.28),
      new THREE.Vector2(0.52, 0.56), // muscular chest/shoulders
      new THREE.Vector2(0.40, 0.76),
      new THREE.Vector2(0.18, 0.86),
      new THREE.Vector2(0.001, 0.89),
    ];
    const geo = new THREE.LatheGeometry(profile, 24);
    geo.rotateX(Math.PI / 2);
    geo.scale(0.94, 1.04, 1.0);
    geo.computeVertexNormals();
    PbrTextureSynthesizer.prepareGeometryForPbr(geo);
    this.sharedTorsoGeo = geo;
    return geo;
  }

  private static getHeadGeometry(): THREE.BufferGeometry {
    if (this.sharedHeadGeo) return this.sharedHeadGeo;
    // Iconic flat-topped, deep-jawed rectangular Capybara skull with smooth bevels
    const shape = new THREE.Shape();
    const w = 0.27;
    const h = 0.24;
    const r = 0.08;
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w * 0.92, h - r);
    shape.quadraticCurveTo(w * 0.92, h, w * 0.92 - r, h);
    shape.lineTo(-w * 0.92 + r, h);
    shape.quadraticCurveTo(-w * 0.92, h, -w * 0.92, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);

    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 2,
      depth: 0.56,
      bevelEnabled: true,
      bevelThickness: 0.11,
      bevelSize: 0.09,
      bevelSegments: 4,
    });
    geo.center();
    geo.computeVertexNormals();
    PbrTextureSynthesizer.prepareGeometryForPbr(geo);
    this.sharedHeadGeo = geo;
    return geo;
  }

  private static getSnoutGeometry(): THREE.BufferGeometry {
    if (this.sharedSnoutGeo) return this.sharedSnoutGeo;
    const shape = new THREE.Shape();
    const w = 0.23;
    const h = 0.20;
    const r = 0.07;
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w * 0.95, h - r);
    shape.quadraticCurveTo(w * 0.95, h, w * 0.95 - r, h);
    shape.lineTo(-w * 0.95 + r, h);
    shape.quadraticCurveTo(-w * 0.95, h, -w * 0.95, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);

    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: 0.38,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.08,
      bevelSegments: 3,
    });
    geo.center();
    geo.computeVertexNormals();
    this.sharedSnoutGeo = geo;
    return geo;
  }

  private static getFurTuftGeometry(): THREE.BufferGeometry {
    if (this.sharedFurTuftGeo) return this.sharedFurTuftGeo;
    const geo = new THREE.ConeGeometry(0.052, 0.21, 5);
    geo.scale(0.68, 1.0, 1.25);
    geo.translate(0, 0.08, 0);
    geo.rotateX(-Math.PI * 0.34);
    this.sharedFurTuftGeo = geo;
    return geo;
  }

  private static getDachshundBarrelGeometry(): THREE.BufferGeometry {
    if (this.sharedDachshundBarrelGeo) return this.sharedDachshundBarrelGeo;
    // Smooth overlapping Wiener-dog / Dachshund Capybara torso segment
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.001, -0.56),
      new THREE.Vector2(0.34, -0.52),
      new THREE.Vector2(0.50, -0.36),
      new THREE.Vector2(0.54, 0.0),
      new THREE.Vector2(0.50, 0.36),
      new THREE.Vector2(0.34, 0.52),
      new THREE.Vector2(0.001, 0.56),
    ];
    const geo = new THREE.LatheGeometry(profile, 20);
    geo.rotateX(Math.PI / 2);
    geo.scale(0.94, 1.02, 1.0);
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

    // Tier 0: Upper limb thigh/humerus column hinged at hip/shoulder (limbRoot origin)
    const upperGeo = new THREE.CylinderGeometry(0.155, 0.13, 0.30, 12);
    upperGeo.translate(0, -0.14, 0);
    const upperMesh = new THREE.Mesh(upperGeo, this.legMaterial);
    upperMesh.castShadow = true;
    limbRoot.add(upperMesh);

    // Tier 1: Muscular shoulder/thigh haunch on upper limb
    const haunchGeo = new THREE.SphereGeometry(isFront ? 0.21 : 0.25, 12, 10);
    haunchGeo.scale(0.82, 1.18, isFront ? 1.05 : 1.25);
    const haunch = new THREE.Mesh(haunchGeo, furMat);
    haunch.name = 'capyBody';
    haunch.position.set(isLeft ? -0.03 : 0.03, -0.02, isFront ? -0.02 : -0.04);
    limbRoot.add(haunch);
    tier1Bucket.push(haunch);

    // Articulated Knee / Carpus Lower Joint at y = -0.26 for realistic swing-flex & stance plant!
    const lowerJoint = new THREE.Group();
    lowerJoint.position.set(0, -0.26, 0);
    limbRoot.add(lowerJoint);

    const lowerBaseGeo = new THREE.CylinderGeometry(0.125, 0.135, 0.28, 10);
    lowerBaseGeo.translate(0, -0.14, 0);
    const lowerMesh = new THREE.Mesh(lowerBaseGeo, this.legMaterial);
    lowerMesh.castShadow = true;
    lowerJoint.add(lowerMesh);

    // Articulated Ankle / Webbed Paw Group at y = -0.25 below knee (total rest sole Y = -0.53)
    const pawGroup = new THREE.Group();
    pawGroup.position.set(0, -0.25, 0);
    lowerJoint.add(pawGroup);

    const pawPadGeo = new THREE.BoxGeometry(0.25, 0.08, 0.32);
    const pawPad = new THREE.Mesh(pawPadGeo, this.webbingMaterial);
    pawPad.position.set(0, 0, 0.06);
    pawGroup.add(pawPad);
    tier1Bucket.push(pawPad);

    // Tier 2: Anatomically authentic Capybara toes (4 front toes, 3 hind toes) + webbing + keratin claws
    const toeGroup = new THREE.Group();
    toeGroup.position.set(0, 0, 0.16);
    const toeCount = isFront ? 4 : 3;
    const spread = isFront ? 0.22 : 0.20;

    const toeGeo = new THREE.CapsuleGeometry(0.032, 0.09, 4, 6);
    toeGeo.rotateX(Math.PI / 2);
    const clawGeo = new THREE.ConeGeometry(0.024, 0.075, 5);
    clawGeo.rotateX(Math.PI * 0.56);

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
    const webGeo = new THREE.CylinderGeometry(
      0.13,
      0.14,
      0.025,
      8,
      1,
      false,
      -Math.PI * 0.4,
      Math.PI * 0.8
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
    tier2Bucket: THREE.Object3D[]
  ): {
    group: THREE.Group;
    fruitMesh: THREE.Mesh;
    fruitMat: THREE.MeshStandardMaterial;
  } {
    const group = new THREE.Group();
    const fruitMat = new THREE.MeshStandardMaterial({
      color: orangeColorHex,
      emissive: emissiveHex,
      emissiveIntensity: 0.18,
      normalMap: PbrTextureSynthesizer.getCitrusPeelNormalMap(),
      normalScale: new THREE.Vector2(0.52, 0.52),
      bumpMap: this.getCitrusPeelBumpTexture(),
      bumpScale: 0.025,
      roughness: 0.24,
      metalness: 0.06,
    });

    const orangeGeo = new THREE.SphereGeometry(0.255, 22, 18);
    orangeGeo.scale(1.04, 0.88, 1.04);
    const fruitMesh = new THREE.Mesh(orangeGeo, fruitMat);
    fruitMesh.position.set(0, 0.20, 0);
    fruitMesh.castShadow = true;
    group.add(fruitMesh);

    // Simple leaf visible at Tier 0/1
    const baseLeafGeo = new THREE.ConeGeometry(0.065, 0.17, 6);
    baseLeafGeo.scale(1.3, 1.0, 0.35);
    baseLeafGeo.rotateZ(Math.PI / 3);
    const baseLeaf = new THREE.Mesh(baseLeafGeo, this.leafMaterial);
    baseLeaf.position.set(0.08, 0.42, 0);
    group.add(baseLeaf);

    // Tier 2+: Detailed 5-point green calyx star, woody pedicel stem, and secondary leaf
    const botanicalDetail = new THREE.Group();
    botanicalDetail.position.set(0, 0.41, 0);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.026, 0.09, 6),
      this.stemMaterial
    );
    stem.position.set(0, 0.035, 0);
    stem.rotation.z = -0.15;
    botanicalDetail.add(stem);

    const sepalGeo = new THREE.ConeGeometry(0.028, 0.085, 4);
    sepalGeo.rotateX(Math.PI * 0.46);
    for (let s = 0; s < 5; s++) {
      const sepal = new THREE.Mesh(sepalGeo, this.leafMaterial);
      sepal.rotation.y = (s / 5) * Math.PI * 2;
      sepal.translateZ(0.035);
      botanicalDetail.add(sepal);
    }

    const secondLeafGeo = new THREE.SphereGeometry(0.075, 8, 6);
    secondLeafGeo.scale(1.55, 0.22, 0.65);
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
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 240, 28);
    ctx.fill();

    ctx.lineWidth = 10;
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = subtitle ? '900 72px system-ui, sans-serif' : '900 110px system-ui, sans-serif';
    ctx.fillText(title, 256, subtitle ? 105 : 132);

    if (subtitle) {
      ctx.fillStyle = accentColor;
      ctx.font = '700 36px system-ui, sans-serif';
      ctx.fillText(subtitle, 256, 185);
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
    overrideOrangeHex?: number
  ): CapyMeshGroup {
    const group = new THREE.Group() as CapyMeshGroup;

    const furMat = this.createFurMaterial(skin);
    const bellyMat = this.createUnderbellyMaterial(skin);

    const lodTier1Group = new THREE.Group();
    const lodTier2Group = new THREE.Group();
    const lodTier3Group = new THREE.Group();
    group.add(lodTier1Group, lodTier2Group, lodTier3Group);

    // Collect references to Limb sub-parts that also respond to LOD tiers
    const limbTier1Refs: THREE.Object3D[] = [];
    const limbTier2Refs: THREE.Object3D[] = [];

    // --- 1. PRIMARY ORGANIC SCULPTED BARREL TORSO ---
    const bodyMesh = new THREE.Mesh(this.getTorsoGeometry(), furMat);
    bodyMesh.name = 'capyBody';
    bodyMesh.position.set(0, 0.74, 0.04);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Tier 1: Soft contoured cream/fawn underbelly & chest bib
    const bellyGeo = new THREE.SphereGeometry(0.49, 18, 12);
    bellyGeo.scale(0.84, 0.58, 1.42);
    const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
    bellyMesh.position.set(0, 0.49, 0.08);
    lodTier1Group.add(bellyMesh);

    // Tier 2: Muscular neck dewlap / collar folds connecting chest to skull
    const neckDewlapGeo = new THREE.SphereGeometry(0.42, 16, 12);
    neckDewlapGeo.scale(0.92, 0.88, 0.85);
    const neckDewlap = new THREE.Mesh(neckDewlapGeo, furMat);
    neckDewlap.name = 'capyBody';
    neckDewlap.position.set(0, 0.84, 0.64);
    lodTier2Group.add(neckDewlap);

    // --- 2. SCULPTED SOUTH AMERICAN CAPYBARA HEAD ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.02, 0.82);

    const headMesh = new THREE.Mesh(this.getHeadGeometry(), furMat);
    headMesh.name = 'capyHead';
    headMesh.position.set(0, 0.14, 0.02);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headGroup.add(headMesh);

    // Blunt dark chestnut muzzle
    const snoutMesh = new THREE.Mesh(this.getSnoutGeometry(), this.snoutMaterial);
    snoutMesh.position.set(0, 0.06, 0.44);
    snoutMesh.castShadow = true;
    headGroup.add(snoutMesh);

    // Tier 1: Lower mandible jaw, moist rhinarium nose pad, recessed nostrils & philtrum cleft
    const headTier1 = new THREE.Group();
    const jawGeo = new THREE.SphereGeometry(0.24, 12, 10);
    jawGeo.scale(0.95, 0.52, 1.35);
    const jawMesh = new THREE.Mesh(jawGeo, bellyMat);
    jawMesh.position.set(0, -0.17, 0.30);
    headTier1.add(jawMesh);

    const rhinariumGeo = new THREE.SphereGeometry(0.20, 14, 10);
    rhinariumGeo.scale(1.12, 0.76, 0.52);
    const rhinarium = new THREE.Mesh(rhinariumGeo, this.rhinariumMaterial);
    rhinarium.position.set(0, 0.14, 0.68);
    headTier1.add(rhinarium);

    const philtrum = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.22, 0.05),
      this.rhinariumMaterial
    );
    philtrum.position.set(0, 0.0, 0.72);
    headTier1.add(philtrum);
    headGroup.add(headTier1);
    limbTier1Refs.push(headTier1);

    // Slanted capybara nostrils
    const nostrilGeo = new THREE.SphereGeometry(0.048, 8, 8);
    nostrilGeo.scale(1.25, 0.68, 0.65);
    const nostrilL = new THREE.Mesh(nostrilGeo, this.rhinariumMaterial);
    nostrilL.position.set(-0.12, 0.17, 0.74);
    nostrilL.rotation.z = 0.38;
    const nostrilR = nostrilL.clone();
    nostrilR.position.x = 0.12;
    nostrilR.rotation.z = -0.38;
    headGroup.add(nostrilL, nostrilR);

    // Expressive high-set capybara eyes (positioned near upper-back of skull like semi-aquatic mammals!)
    const eyeGeo = new THREE.SphereGeometry(0.076, 14, 12);
    const eyeL = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    eyeL.position.set(-0.33, 0.29, 0.16);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.33;
    headGroup.add(eyeL, eyeR);

    // Tier 1: Glossy corneal catchlight reflections
    const catchGeo = new THREE.SphereGeometry(0.024, 8, 8);
    const catchL = new THREE.Mesh(catchGeo, this.eyeCatchlightMaterial);
    catchL.position.set(-0.375, 0.315, 0.205);
    const catchR = catchL.clone();
    catchR.position.x = 0.375;
    headGroup.add(catchL, catchR);
    limbTier1Refs.push(catchL, catchR);

    // Tier 2: Cheek jowls, supraorbital brow ridges, blinking eyelids & tiny incisor peek
    const headTier2 = new THREE.Group();

    const jowlGeo = new THREE.SphereGeometry(0.19, 12, 10);
    jowlGeo.scale(0.85, 0.78, 1.15);
    const jowlL = new THREE.Mesh(jowlGeo, furMat);
    jowlL.name = 'capyHead';
    jowlL.position.set(-0.26, -0.04, 0.24);
    const jowlR = jowlL.clone();
    jowlR.position.x = 0.26;
    headTier2.add(jowlL, jowlR);

    const browGeo = new THREE.CapsuleGeometry(0.036, 0.15, 4, 8);
    browGeo.rotateX(Math.PI / 2);
    const browL = new THREE.Mesh(browGeo, this.snoutMaterial);
    browL.position.set(-0.33, 0.365, 0.16);
    browL.rotation.z = 0.14;
    const browR = browL.clone();
    browR.position.x = 0.33;
    browR.rotation.z = -0.14;
    headTier2.add(browL, browR);

    const incisorGeo = new THREE.BoxGeometry(0.055, 0.055, 0.025);
    const incisorL = new THREE.Mesh(incisorGeo, this.incisorMaterial);
    incisorL.position.set(-0.032, -0.115, 0.69);
    const incisorR = incisorL.clone();
    incisorR.position.x = 0.032;
    headTier2.add(incisorL, incisorR);

    headGroup.add(headTier2);
    limbTier2Refs.push(headTier2);

    // Blinking upper eyelids
    const eyelidGeo = new THREE.SphereGeometry(0.082, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const eyelidL = new THREE.Mesh(eyelidGeo, this.snoutMaterial);
    eyelidL.position.set(-0.33, 0.295, 0.16);
    eyelidL.rotation.z = 0.22;
    eyelidL.scale.y = 0.15; // open by default, scales to 1.0 during blink
    const eyelidR = eyelidL.clone();
    eyelidR.position.x = 0.33;
    eyelidR.rotation.z = -0.22;
    headGroup.add(eyelidL, eyelidR);
    limbTier2Refs.push(eyelidL, eyelidR);

    // Folded cupped Pinna Ears
    const buildEar = (isLeft: boolean) => {
      const earRoot = new THREE.Group();
      const s = isLeft ? -1 : 1;
      earRoot.position.set(s * 0.29, 0.44, -0.18);
      earRoot.rotation.set(-0.22, s * -0.35, s * 0.42);

      const outerEarGeo = new THREE.SphereGeometry(0.115, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
      outerEarGeo.scale(0.72, 1.18, 0.85);
      const outerEar = new THREE.Mesh(outerEarGeo, this.snoutMaterial);
      outerEar.rotation.x = -Math.PI * 0.45;
      earRoot.add(outerEar);

      const innerEarGeo = new THREE.SphereGeometry(0.082, 10, 8);
      innerEarGeo.scale(0.6, 0.95, 0.35);
      const innerEar = new THREE.Mesh(innerEarGeo, this.innerEarMaterial);
      innerEar.position.set(0, 0.01, 0.035);
      earRoot.add(innerEar);
      limbTier1Refs.push(innerEar);

      return earRoot;
    };
    const earL = buildEar(true);
    const earR = buildEar(false);
    headGroup.add(earL, earR);

    // Tier 3: 12 Tapered Muzzle Vibrissae Whiskers + 4 Supraorbital Brow Whiskers
    const whiskerGroup = new THREE.Group();
    const whiskerGeo = new THREE.CylinderGeometry(0.003, 0.011, 0.36, 5);
    whiskerGeo.translate(0, 0.18, 0);
    whiskerGeo.rotateZ(Math.PI / 2);

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
      limbTier2Refs
    );
    const headOrangeGroup = headOrangeData.group;
    headOrangeGroup.position.set(0, 0.42, 0.04);

    // Pre-build up to 6 extra stacked Head Fruits that appear as you eat fruits
    // and wash off one-by-one when swimming under the Home Pool tap water!
    const headStackMeshes: THREE.Mesh[] = [];
    const stackSphereGeo = new THREE.SphereGeometry(0.185, 14, 12);
    stackSphereGeo.scale(1.04, 0.88, 1.04);
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

    const tailGeo = new THREE.SphereGeometry(0.115, 10, 10);
    tailGeo.scale(0.9, 0.85, 1.15);
    const tail = new THREE.Mesh(tailGeo, this.snoutMaterial);
    tail.position.set(0, 0.68, -0.86);

    rearAssemblyGroup.add(legBL, legBR, tail);
    group.add(rearAssemblyGroup);

    // --- 6. TIER 3: 3D LAYERED BRISTLE FUR TUFTS (INSTANCED FOR ZERO DRAW-CALL OVERHEAD) ---
    const tuftGeo = this.getFurTuftGeometry();
    const frontTuftCount = 72;
    const furInstancedMesh = new THREE.InstancedMesh(tuftGeo, furMat, frontTuftCount);
    furInstancedMesh.name = 'capyBody';
    furInstancedMesh.frustumCulled = false;

    for (let i = 0; i < frontTuftCount; i++) {
      const u = i / frontTuftCount;
      // Distribute tufts along dorsal crest, neck ruff, chest, and flanks
      const z = -0.35 + u * 1.12;
      const band = (i % 7) - 3; // -3..+3 across top & upper flanks
      const theta = band * 0.34 + ((i % 3) - 1) * 0.08;
      const rx = 0.50 * (1 - Math.abs(z - 0.1) * 0.22);
      const ry = 0.56 * (1 - Math.abs(z - 0.1) * 0.18);

      const px = Math.sin(theta) * rx;
      const py = 0.74 + Math.cos(theta) * ry;
      _furDummy.position.set(px, py, z);
      _furDummy.rotation.set(-0.22 + (i % 4) * 0.06, theta * 0.55, -theta * 0.85);
      const s = 0.82 + (i % 5) * 0.11;
      _furDummy.scale.set(s, s * (1.0 + (z > 0.45 ? 0.25 : 0)), s);
      _furDummy.updateMatrix();
      furInstancedMesh.setMatrixAt(i, _furDummy.matrix);
    }
    furInstancedMesh.instanceMatrix.needsUpdate = true;
    lodTier3Group.add(furInstancedMesh);

    // Rear rump fur tufts (inside rearAssemblyGroup so they hide cleanly when Dachshund Caboose takes over)
    const rearTuftCount = 24;
    const rearFurInstancedMesh = new THREE.InstancedMesh(tuftGeo, furMat, rearTuftCount);
    rearFurInstancedMesh.name = 'capyBody';
    rearFurInstancedMesh.frustumCulled = false;
    for (let i = 0; i < rearTuftCount; i++) {
      const z = -0.78 + (i / rearTuftCount) * 0.44;
      const band = (i % 5) - 2;
      const theta = band * 0.42;
      const radiusScale = 1 - Math.max(0, (-z - 0.45) * 0.85);
      _furDummy.position.set(
        Math.sin(theta) * 0.48 * radiusScale,
        0.72 + Math.cos(theta) * 0.52 * radiusScale,
        z
      );
      _furDummy.rotation.set(-0.35, theta * 0.5, -theta * 0.85);
      _furDummy.scale.setScalar(0.85 + (i % 3) * 0.12);
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
    barrel.position.set(0, 0.73, 0);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    group.add(barrel);

    const lodTier1Group = new THREE.Group();
    const lodTier2Group = new THREE.Group();
    const lodTier3Group = new THREE.Group();
    group.add(lodTier1Group, lodTier2Group, lodTier3Group);

    // Tier 1: Seamless cream underbelly band along the elongated Dachshund torso
    const bellyGeo = new THREE.SphereGeometry(0.45, 14, 10);
    bellyGeo.scale(0.82, 0.54, 1.08);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, 0.49, 0);
    lodTier1Group.add(belly);

    // Tier 2: Every 3rd Dachshund segment balances a matching mini Head-Orange on its back!
    let riderOrangeMat: THREE.MeshStandardMaterial | null = null;
    if (segmentIndex % 3 === 1) {
      riderOrangeMat = new THREE.MeshStandardMaterial({
        color: orangeColorHex,
        normalMap: PbrTextureSynthesizer.getCitrusPeelNormalMap(),
        normalScale: new THREE.Vector2(0.46, 0.46),
        bumpMap: this.getCitrusPeelBumpTexture(),
        bumpScale: 0.022,
        roughness: 0.25,
        metalness: 0.06,
      });
      const miniOrange = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), riderOrangeMat);
      miniOrange.scale.set(1.04, 0.88, 1.04);
      miniOrange.position.set(0, 1.33, 0);
      miniOrange.castShadow = true;

      const miniLeaf = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 5), this.leafMaterial);
      miniLeaf.rotation.z = Math.PI / 3;
      miniLeaf.position.set(0.05, 0.15, 0);
      miniOrange.add(miniLeaf);

      lodTier2Group.add(miniOrange);
    }

    // Articulated 2-joint Dachshund walking legs on EVERY body segment so all segments step forward & backward!
    const segT1Refs: THREE.Object3D[] = [];
    const segT2Refs: THREE.Object3D[] = [];
    const midLegL = this.buildDetailedLimb(false, true, furMat, segT1Refs, segT2Refs);
    midLegL.position.set(-0.35, 0.49, 0);
    midLegL.scale.set(0.86, 0.92, 0.86);

    const midLegR = this.buildDetailedLimb(false, false, furMat, segT1Refs, segT2Refs);
    midLegR.position.set(0.35, 0.49, 0);
    midLegR.scale.set(0.86, 0.92, 0.86);
    group.add(midLegL, midLegR);
    lodTier1Group.userData.linkedNodes = segT1Refs;
    lodTier2Group.userData.linkedNodes = segT2Refs;

    // Tier 3: 24-tuft 3D bristle fur along each Dachshund torso segment
    const segTuftCount = 24;
    const furInstancedMesh = new THREE.InstancedMesh(
      this.getFurTuftGeometry(),
      furMat,
      segTuftCount
    );
    furInstancedMesh.frustumCulled = false;
    for (let i = 0; i < segTuftCount; i++) {
      const z = -0.38 + (i / segTuftCount) * 0.76;
      const band = (i % 5) - 2;
      const theta = band * 0.38;
      _furDummy.position.set(Math.sin(theta) * 0.47, 0.73 + Math.cos(theta) * 0.51, z);
      _furDummy.rotation.set(-0.24, theta * 0.5, -theta * 0.85);
      _furDummy.scale.setScalar(0.84 + (i % 4) * 0.1);
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
   * Creates the trailing Capybara Hindquarters Caboose (sculpted rump, muscular hind thighs,
   * webbed 3-toed hind legs, and wiggly stub tail) that caps the back of the Dachshund-Snake.
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

    // Rounded furry capybara rump cap
    const rumpGeo = new THREE.SphereGeometry(0.54, 20, 16);
    rumpGeo.scale(0.95, 1.02, 1.18);
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

    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.68, -0.54);
    const tailGeo = new THREE.SphereGeometry(0.125, 12, 10);
    tailGeo.scale(0.92, 0.88, 1.2);
    const tailMesh = new THREE.Mesh(tailGeo, this.snoutMaterial);
    tailGroup.add(tailMesh);
    group.add(tailGroup);

    // Tier 3 rump bristle fur tufts
    const furCount = 28;
    const furInstancedMesh = new THREE.InstancedMesh(this.getFurTuftGeometry(), furMat, furCount);
    furInstancedMesh.frustumCulled = false;
    for (let i = 0; i < furCount; i++) {
      const z = -0.44 + (i / furCount) * 0.72;
      const band = (i % 5) - 2;
      const theta = band * 0.42;
      const rScale = 1 - Math.max(0, (-z - 0.15) * 0.65);
      _furDummy.position.set(
        Math.sin(theta) * 0.48 * rScale,
        0.72 + Math.cos(theta) * 0.52 * rScale,
        z
      );
      _furDummy.rotation.set(-0.32, theta * 0.5, -theta * 0.85);
      _furDummy.scale.setScalar(0.86 + (i % 3) * 0.1);
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
      emissiveIntensity: 0.2,
      normalMap: PbrTextureSynthesizer.getCitrusPeelNormalMap(),
      normalScale: new THREE.Vector2(0.52, 0.52),
      bumpMap: this.getCitrusPeelBumpTexture(),
      bumpScale: 0.028,
      roughness: 0.22,
      metalness: 0.06,
    });

    const sphereGeo = new THREE.SphereGeometry(radius, 20, 16);
    sphereGeo.scale(1.03, 0.94, 1.03);
    const fruitMesh = new THREE.Mesh(sphereGeo, fruitMat);
    fruitMesh.castShadow = true;
    fruitMesh.receiveShadow = true;
    rollGroup.add(fruitMesh);

    const leafGroup = new THREE.Group();
    leafGroup.position.set(0, radius * 0.88, 0);
    const stemScale = radius / 0.28;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02 * stemScale, 0.028 * stemScale, 0.09 * stemScale, 6),
      this.stemMaterial
    );
    stem.position.y = 0.035 * stemScale;
    leafGroup.add(stem);

    const leafGeo = new THREE.SphereGeometry(0.095 * stemScale, 8, 6);
    leafGeo.scale(1.5, 0.24, 0.68);
    const leaf = new THREE.Mesh(leafGeo, this.leafMaterial);
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
      new THREE.RingGeometry(radius * 0.92, radius * 1.22, 24),
      haloMat
    );
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

  public static setHeadFruitStackCount(capy: CapyMeshGroup, totalCarriedFruits: number) {
    if (!capy?.userData?.headStackMeshes) return;
    const extraCount = Math.max(0, totalCarriedFruits - 1);
    const meshes = capy.userData.headStackMeshes;
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].visible = i < extraCount;
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
    overrideOrangeHex?: number
  ) {
    this.attachHat(capy.userData.hatGroup, hat);
    this.attachMutations(capy.userData.mutationGroup, mutations);
    capy.userData.skin = skin;

    const furColor = this.skinColors[skin] ?? this.skinColors.classic;
    const furTex = this.getFurAlbedoTexture(furColor);

    capy.traverse((obj) => {
      if (obj instanceof THREE.Mesh && (obj.name === 'capyBody' || obj.name === 'capyHead')) {
        const mat = obj.material as THREE.MeshStandardMaterial;
        mat.color.setHex(0xffffff);
        mat.map = furTex;
        mat.roughness = skin === 'golden' ? 0.45 : 0.84;
        mat.metalness = skin === 'golden' ? 0.38 : 0.04;
        mat.needsUpdate = true;
      }
    });

    if (capy.userData.furInstancedMesh) {
      const fMat = capy.userData.furInstancedMesh.material as THREE.MeshStandardMaterial;
      fMat.map = furTex;
      fMat.needsUpdate = true;
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
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.88,
        roughness: 0.16,
      });
      // Golden crown ring encircling the base of the Head Orange
      const crownGeo = new THREE.CylinderGeometry(0.31, 0.28, 0.14, 8, 1, true);
      const crownMesh = new THREE.Mesh(crownGeo, crownMat);
      crownMesh.position.set(0, 0.10, 0);
      hatGroup.add(crownMesh);
    } else if (hatType === 'flower') {
      const flowerMat = new THREE.MeshStandardMaterial({
        color: 0xff69b4,
        roughness: 0.4,
      });
      const petalGeo = new THREE.SphereGeometry(0.11, 8, 8);
      petalGeo.scale(1.2, 0.35, 0.6);
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(petalGeo, flowerMat);
        petal.position.set(-0.22, 0.10, 0.08);
        petal.rotation.y = (i * Math.PI * 2) / 5;
        petal.translateX(0.09);
        hatGroup.add(petal);
      }
    } else if (hatType === 'party') {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.34, 12),
        new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.3 })
      );
      cone.position.set(-0.22, 0.32, -0.06);
      cone.rotation.z = 0.35;
      const pom = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfacc15 })
      );
      pom.position.set(-0.33, 0.48, -0.06);
      hatGroup.add(cone, pom);
    } else if (hatType === 'wizard') {
      const wizMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
      const brim = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.44, 18), wizMat);
      brim.rotation.x = Math.PI / 2;
      brim.position.set(0, 0.03, 0);
      hatGroup.add(brim);
    } else if (hatType === 'halo') {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.30, 0.038, 12, 24),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfacc15,
          emissiveIntensity: 0.6,
          roughness: 0.1,
        })
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
      const tuskMat = new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.25 });
      const tuskGeo = new THREE.ConeGeometry(0.06, 0.38, 8);
      tuskGeo.rotateX(Math.PI / 3);
      const tuskL = new THREE.Mesh(tuskGeo, tuskMat);
      tuskL.position.set(-0.28, 1.0, 1.44);
      const tuskR = tuskL.clone();
      tuskR.position.x = 0.28;
      mutationGroup.add(tuskL, tuskR);
    }

    if (mutations.includes('horn')) {
      const hornMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.15,
      });
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.52, 10), hornMat);
      horn.rotation.x = Math.PI / 4.2;
      horn.position.set(0, 1.48, 1.24);
      mutationGroup.add(horn);
    }

    if (mutations.includes('shell')) {
      const shellMat = new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.5,
        metalness: 0.2,
      });
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.64, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        shellMat
      );
      shell.scale.set(0.96, 0.75, 1.25);
      shell.position.set(0, 0.84, 0.02);
      mutationGroup.add(shell);

      for (let i = -1; i <= 1; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 6), this.yuzuMaterial);
        spike.position.set(0, 1.38, i * 0.42);
        mutationGroup.add(spike);
      }
    }

    if (mutations.includes('wings')) {
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.3,
        metalness: 0.1,
      });
      const wingGeo = new THREE.BoxGeometry(0.95, 0.08, 0.55);
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-0.85, 1.05, 0.12);
      wingL.rotation.z = 0.25;

      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(0.85, 1.05, 0.12);
      wingR.rotation.z = -0.25;
      mutationGroup.add(wingL, wingR);
    }

    if (mutations.includes('flippers')) {
      const flipMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.35 });
      const flipGeo = new THREE.BoxGeometry(0.32, 0.06, 0.42);
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
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0xa855f7,
        emissiveIntensity: 0.75,
        roughness: 0.18,
      });
      glowMat.userData.isBioluminescentTail = true;
      const tailPlume = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.68, 12), glowMat);
      tailPlume.userData.isBioluminescentTail = true;
      tailPlume.rotation.x = -Math.PI / 3;
      tailPlume.position.set(0, 0.88, -1.02);

      const tipMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.95,
        roughness: 0.12,
      });
      tipMat.userData.isBioluminescentTail = true;
      const tipOrb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), tipMat);
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
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(radius - 0.2, radius - 0.2, 0.22, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0x0ea5e9,
        roughness: 0.08,
        clearcoat: 1.0,
        normalMap: waterNorms.primary,
        normalScale: new THREE.Vector2(0.45, 0.45),
        clearcoatNormalMap: waterNorms.secondary,
        clearcoatNormalScale: new THREE.Vector2(0.3, 0.3),
        transparent: true,
        opacity: 0.86,
      })
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
      metalness: 0.85,
      roughness: 0.2,
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
