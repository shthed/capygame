import * as THREE from 'three';
import { BuildingType, MutationId } from '../types';

export interface CapyMeshGroup extends THREE.Group {
  userData: {
    legFL: THREE.Mesh;
    legFR: THREE.Mesh;
    legBL: THREE.Mesh;
    legBR: THREE.Mesh;
    head: THREE.Group;
    hatGroup: THREE.Group;
    mutationGroup: THREE.Group;
    walkCycle: number;
  };
}

export class CapyModelGenerator {
  private static skinColors: Record<string, number> = {
    classic: 0x8d5b36,
    golden: 0xeab308,
    sakura: 0xf472b6,
    matcha: 0x4ade80,
    cosmic: 0x6366f1,
  };

  private static snoutMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a2c18,
    roughness: 0.88,
    metalness: 0.02,
  });

  private static eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.15,
    metalness: 0.1,
  });

  private static noseMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f1108,
    roughness: 0.6,
    metalness: 0.05,
  });

  private static legMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b3e20,
    roughness: 0.8,
    metalness: 0.05,
  });

  private static yuzuMaterial = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    roughness: 0.3,
    metalness: 0.1,
  });

  private static leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e7d32,
    roughness: 0.55,
    metalness: 0.0,
  });

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
    mutations: MutationId[] = []
  ): CapyMeshGroup {
    const group = new THREE.Group() as CapyMeshGroup;

    const furColor = this.skinColors[skin] ?? this.skinColors.classic;
    const furMat = new THREE.MeshStandardMaterial({
      color: furColor,
      roughness: 0.82,
      metalness: skin === 'golden' ? 0.35 : 0.05,
    });

    const bodyGeo = new THREE.CylinderGeometry(0.52, 0.58, 1.4, 16);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, furMat);
    bodyMesh.name = 'capyBody';
    bodyMesh.position.set(0, 0.72, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    const capGeo = new THREE.SphereGeometry(0.54, 14, 12);
    const chestCap = new THREE.Mesh(capGeo, furMat);
    chestCap.position.set(0, 0.72, 0.65);
    group.add(chestCap);
    const rumpCap = new THREE.Mesh(capGeo, furMat);
    rumpCap.position.set(0, 0.72, -0.65);
    group.add(rumpCap);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.96, 0.78);

    const headGeo = new THREE.BoxGeometry(0.68, 0.62, 0.75);
    const headMesh = new THREE.Mesh(headGeo, furMat);
    headMesh.name = 'capyHead';
    headMesh.position.set(0, 0.15, 0);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    const snoutGeo = new THREE.BoxGeometry(0.62, 0.5, 0.55);
    const snoutMesh = new THREE.Mesh(snoutGeo, this.snoutMaterial);
    snoutMesh.position.set(0, 0.05, 0.48);
    snoutMesh.castShadow = true;
    headGroup.add(snoutMesh);

    const nostrilGeo = new THREE.BoxGeometry(0.1, 0.06, 0.05);
    const nostrilL = new THREE.Mesh(nostrilGeo, this.noseMaterial);
    nostrilL.position.set(-0.14, 0.18, 0.76);
    const nostrilR = nostrilL.clone();
    nostrilR.position.x = 0.14;
    headGroup.add(nostrilL);
    headGroup.add(nostrilR);

    const eyeGeo = new THREE.SphereGeometry(0.08, 10, 8);
    const eyeL = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    eyeL.position.set(-0.35, 0.32, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.35;
    headGroup.add(eyeL);
    headGroup.add(eyeR);

    const earGeo = new THREE.CylinderGeometry(0.04, 0.12, 0.18, 8);
    earGeo.rotateZ(Math.PI / 6);
    const earL = new THREE.Mesh(earGeo, this.snoutMaterial);
    earL.position.set(-0.32, 0.5, -0.15);
    const earR = earL.clone();
    earR.rotation.z = -Math.PI / 6;
    earR.position.x = 0.32;
    headGroup.add(earL);
    headGroup.add(earR);

    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.48, 0.05);
    this.attachHat(hatGroup, hat);
    headGroup.add(hatGroup);

    group.add(headGroup);

    const legGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.55, 10);
    legGeo.translate(0, -0.25, 0);

    const legFL = new THREE.Mesh(legGeo, this.legMaterial);
    legFL.position.set(-0.35, 0.55, 0.45);
    legFL.castShadow = true;

    const legFR = new THREE.Mesh(legGeo, this.legMaterial);
    legFR.position.set(0.35, 0.55, 0.45);
    legFR.castShadow = true;

    const legBL = new THREE.Mesh(legGeo, this.legMaterial);
    legBL.position.set(-0.36, 0.55, -0.45);
    legBL.castShadow = true;

    const legBR = new THREE.Mesh(legGeo, this.legMaterial);
    legBR.position.set(0.36, 0.55, -0.45);
    legBR.castShadow = true;

    group.add(legFL, legFR, legBL, legBR);

    const tailGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const tail = new THREE.Mesh(tailGeo, this.snoutMaterial);
    tail.position.set(0, 0.65, -0.82);
    group.add(tail);

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
      hatGroup,
      mutationGroup,
      walkCycle: 0,
    };

    return group;
  }

  public static updateCapyAppearance(
    capy: CapyMeshGroup,
    hat: string,
    skin: string,
    mutations: MutationId[]
  ) {
    this.attachHat(capy.userData.hatGroup, hat);
    this.attachMutations(capy.userData.mutationGroup, mutations);

    const furColor = this.skinColors[skin] ?? this.skinColors.classic;
    capy.traverse((obj) => {
      if (obj instanceof THREE.Mesh && (obj.name === 'capyBody' || obj.name === 'capyHead')) {
        const mat = obj.material as THREE.MeshStandardMaterial;
        mat.color.setHex(furColor);
        mat.metalness = skin === 'golden' ? 0.35 : 0.05;
      }
    });
  }

  public static attachHat(hatGroup: THREE.Group, hatType: string) {
    while (hatGroup.children.length > 0) {
      hatGroup.remove(hatGroup.children[0]);
    }

    if (hatType === 'yuzu') {
      const yuzuGeo = new THREE.SphereGeometry(0.24, 16, 12);
      yuzuGeo.scale(1, 0.9, 1);
      const yuzuMesh = new THREE.Mesh(yuzuGeo, this.yuzuMaterial);
      yuzuMesh.position.set(0, 0.22, 0);
      yuzuMesh.castShadow = true;

      const leafGeo = new THREE.ConeGeometry(0.08, 0.16, 5);
      leafGeo.rotateZ(Math.PI / 4);
      const leafMesh = new THREE.Mesh(leafGeo, this.leafMaterial);
      leafMesh.position.set(0.06, 0.22, 0);
      yuzuMesh.add(leafMesh);

      hatGroup.add(yuzuMesh);
    } else if (hatType === 'crown') {
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.85,
        roughness: 0.18,
      });
      const crownGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.24, 6);
      const crownMesh = new THREE.Mesh(crownGeo, crownMat);
      crownMesh.position.set(0, 0.14, 0);
      crownMesh.castShadow = true;
      hatGroup.add(crownMesh);
    } else if (hatType === 'flower') {
      const flowerMat = new THREE.MeshStandardMaterial({
        color: 0xff69b4,
        roughness: 0.4,
      });
      const petalGeo = new THREE.SphereGeometry(0.14, 8, 8);
      petalGeo.scale(1.2, 0.4, 0.6);
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(petalGeo, flowerMat);
        petal.position.set(0, 0.08, 0);
        petal.rotation.y = (i * Math.PI * 2) / 5;
        petal.translateX(0.12);
        hatGroup.add(petal);
      }
      const centerMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffeb3b })
      );
      centerMesh.position.set(0, 0.08, 0);
      hatGroup.add(centerMesh);
    } else if (hatType === 'party') {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.48, 12),
        new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.3 })
      );
      cone.position.set(0, 0.25, 0);
      const pom = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfacc15 })
      );
      pom.position.set(0, 0.5, 0);
      hatGroup.add(cone, pom);
    } else if (hatType === 'wizard') {
      const wizMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16), wizMat);
      brim.position.set(0, 0.05, 0);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.62, 12), wizMat);
      spire.position.set(0, 0.34, 0);
      hatGroup.add(brim, spire);
    } else if (hatType === 'halo') {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.045, 12, 24),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfacc15,
          emissiveIntensity: 0.6,
          roughness: 0.1,
        })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 0.35, 0);
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
      tuskL.position.set(-0.28, 1.0, 1.42);
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
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 10), hornMat);
      horn.rotation.x = Math.PI / 5;
      horn.position.set(0, 1.52, 1.15);
      mutationGroup.add(horn);
    }

    if (mutations.includes('shell')) {
      const shellMat = new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.5,
        metalness: 0.2,
      });
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.64, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
        shellMat
      );
      shell.scale.set(0.95, 0.75, 1.25);
      shell.position.set(0, 0.82, -0.05);
      mutationGroup.add(shell);

      for (let i = -1; i <= 1; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 6), this.yuzuMaterial);
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
      wingL.position.set(-0.85, 1.05, 0.05);
      wingL.rotation.z = 0.25;

      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(0.85, 1.05, 0.05);
      wingR.rotation.z = -0.25;
      mutationGroup.add(wingL, wingR);
    }

    if (mutations.includes('flippers')) {
      const flipMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.35 });
      const flipGeo = new THREE.BoxGeometry(0.32, 0.06, 0.42);
      const positions = [
        [-0.36, 0.04, 0.55],
        [0.36, 0.04, 0.55],
        [-0.36, 0.04, -0.38],
        [0.36, 0.04, -0.38],
      ];
      for (const [x, y, z] of positions) {
        const f = new THREE.Mesh(flipGeo, flipMat);
        f.position.set(x, y, z);
        mutationGroup.add(f);
      }
    }

    if (mutations.includes('glow_tail')) {
      const tailPlume = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.7, 10),
        new THREE.MeshStandardMaterial({
          color: 0xa855f7,
          emissive: 0x9333ea,
          emissiveIntensity: 0.7,
          roughness: 0.2,
        })
      );
      tailPlume.rotation.x = -Math.PI / 3;
      tailPlume.position.set(0, 0.85, -1.05);
      mutationGroup.add(tailPlume);
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
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.88,
      metalness: 0.1,
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

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(radius - 0.2, radius - 0.2, 0.22, 24),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.12,
        metalness: 0.25,
        transparent: true,
        opacity: 0.86,
      })
    );
    water.position.set(0, 0.16, 0);
    group.add(water);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.7 });
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
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.38, 2.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 })
    );
    trunk.position.set(0, 1.15, 0);
    trunk.castShadow = true;
    group.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 });
    const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3), foliageMat);
    c1.position.set(0, 2.6, 0);
    c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95), foliageMat);
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
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 1.1, 14),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
    );
    stem.position.set(0, 0.55, 0);
    stem.castShadow = true;
    group.add(stem);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.85, 0.45, 24),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 })
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
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.45 });
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
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.4,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.85,
      roughness: 0.2,
    });

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

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.15 * scale, 0.65, 4),
        roofMat
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, yBase + 1.35, 0);
      roof.castShadow = true;
      group.add(roof);
    }

    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 1.1, 10), goldMat);
    finial.position.set(0, 4.6, 0);
    group.add(finial);
    return group;
  }

  public static createCapyMonument(_level: number = 1): THREE.Group {
    const group = new THREE.Group();
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.65, 1.1, 16),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 })
    );
    pedestal.position.set(0, 0.55, 0);
    pedestal.castShadow = true;
    group.add(pedestal);

    const goldenCapy = this.createCapybara('crown', 1.25, 'golden');
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
      roughness: 0.25,
      metalness: 0.6,
    });

    const pillarGeo = new THREE.CylinderGeometry(0.24, 0.28, 3.6, 12);
    const leftPillar = new THREE.Mesh(pillarGeo, frameMat);
    leftPillar.position.set(-1.6, 1.8, 0);
    leftPillar.castShadow = true;

    const rightPillar = leftPillar.clone();
    rightPillar.position.x = 1.6;
    group.add(leftPillar, rightPillar);

    const vortexMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      side: THREE.DoubleSide,
    });
    const vortex = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.12, 24), vortexMat);
    vortex.rotation.x = Math.PI / 2;
    vortex.position.set(0, 1.8, 0);
    group.add(vortex);

    const bannerTex = this.createTextBannerTexture(title, subtitle, '#0f172a', accentCss);
    const signMat = new THREE.MeshBasicMaterial({ map: bannerTex });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.25, 0.22), signMat);
    sign.position.set(0, 3.9, 0);
    group.add(sign);

    return group;
  }
}
