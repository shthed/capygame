import * as THREE from 'three';

// Procedural 3D model builder for Capybara character, hats, and sanctuary structures
// Strictly adhering to composite 3-12 part groups, bottom-center pivoting, and PBR materials

export interface CapyMeshGroup extends THREE.Group {
  userData: {
    legFL: THREE.Mesh;
    legFR: THREE.Mesh;
    legBL: THREE.Mesh;
    legBR: THREE.Mesh;
    head: THREE.Group;
    hatGroup: THREE.Group;
    walkCycle: number;
  };
}

export class CapyModelGenerator {
  // Shared materials for high performance and zero leak
  private static furMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d5b36, // Warm Capybara brown
    roughness: 0.85,
    metalness: 0.05,
    name: 'capyFur',
  });

  private static snoutMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a361e, // Darker chocolate snout
    roughness: 0.9,
    metalness: 0.02,
    name: 'capySnout',
  });

  private static eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.2,
    metalness: 0.1,
    name: 'capyEye',
  });

  private static noseMaterial = new THREE.MeshStandardMaterial({
    color: 0x24140b,
    roughness: 0.6,
    metalness: 0.05,
    name: 'capyNose',
  });

  private static legMaterial = new THREE.MeshStandardMaterial({
    color: 0x734524,
    roughness: 0.8,
    metalness: 0.05,
    name: 'capyLeg',
  });

  private static yuzuMaterial = new THREE.MeshStandardMaterial({
    color: 0xffaa00, // Golden citrus
    roughness: 0.35,
    metalness: 0.1,
    name: 'yuzuFruit',
  });

  private static leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e7d32, // Fresh green leaf
    roughness: 0.6,
    metalness: 0.0,
    name: 'yuzuLeaf',
  });

  // Creates a composite 10-part procedural Capybara character
  public static createCapybara(hat: string = 'yuzu', scale: number = 1.0): CapyMeshGroup {
    const group = new THREE.Group() as CapyMeshGroup;

    // 1. Primary silhouette: Barrel Body
    // Rounded box / capsule approximation
    const bodyGeo = new THREE.CylinderGeometry(0.52, 0.58, 1.4, 16);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.furMaterial);
    bodyMesh.position.set(0, 0.72, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // 2. Head Group (pivoted near neck)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.95, 0.75);

    // Head base (boxy rounded head)
    const headGeo = new THREE.BoxGeometry(0.68, 0.62, 0.75);
    const headMesh = new THREE.Mesh(headGeo, this.furMaterial);
    headMesh.position.set(0, 0.15, 0);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // 3. Iconic elongated snout
    const snoutGeo = new THREE.BoxGeometry(0.62, 0.5, 0.55);
    const snoutMesh = new THREE.Mesh(snoutGeo, this.snoutMaterial);
    snoutMesh.position.set(0, 0.05, 0.48);
    snoutMesh.castShadow = true;
    headGroup.add(snoutMesh);

    // 4. Nostrils
    const nostrilGeo = new THREE.BoxGeometry(0.1, 0.06, 0.05);
    const nostrilL = new THREE.Mesh(nostrilGeo, this.noseMaterial);
    nostrilL.position.set(-0.14, 0.18, 0.76);
    const nostrilR = nostrilL.clone();
    nostrilR.position.x = 0.14;
    headGroup.add(nostrilL);
    headGroup.add(nostrilR);

    // 5. Blinking serene eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 10, 8);
    const eyeL = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    eyeL.position.set(-0.35, 0.32, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.35;
    headGroup.add(eyeL);
    headGroup.add(eyeR);

    // 6. Cute small twitching ears
    const earGeo = new THREE.CylinderGeometry(0.04, 0.12, 0.18, 8);
    earGeo.rotateZ(Math.PI / 6);
    const earL = new THREE.Mesh(earGeo, this.snoutMaterial);
    earL.position.set(-0.32, 0.5, -0.15);
    const earR = earL.clone();
    earR.rotation.z = -Math.PI / 6;
    earR.position.x = 0.32;
    headGroup.add(earL);
    headGroup.add(earR);

    // 7. Hat slot on top of head
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.48, 0.05);
    this.attachHat(hatGroup, hat);
    headGroup.add(hatGroup);

    group.add(headGroup);

    // 8. Four stubby animated legs
    const legGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.55, 10);
    legGeo.translate(0, -0.25, 0); // Pivot at top joint

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

    group.add(legFL);
    group.add(legFR);
    group.add(legBL);
    group.add(legBR);

    // 9. Tiny cute tail bump
    const tailGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const tail = new THREE.Mesh(tailGeo, this.snoutMaterial);
    tail.position.set(0, 0.65, -0.72);
    group.add(tail);

    if (scale !== 1.0) {
      group.scale.setScalar(scale);
    }

    // Attach refs for animation
    group.userData = {
      legFL,
      legFR,
      legBL,
      legBR,
      head: headGroup,
      hatGroup,
      walkCycle: 0,
    };

    return group;
  }

  // Hat attachment switcher
  public static attachHat(hatGroup: THREE.Group, hatType: string) {
    // Clear existing hat
    while (hatGroup.children.length > 0) {
      hatGroup.remove(hatGroup.children[0]);
    }

    if (hatType === 'yuzu') {
      // Iconic Onsen Yuzu fruit balanced on head
      const yuzuGeo = new THREE.SphereGeometry(0.24, 16, 12);
      yuzuGeo.scale(1, 0.9, 1);
      const yuzuMesh = new THREE.Mesh(yuzuGeo, this.yuzuMaterial);
      yuzuMesh.position.set(0, 0.22, 0);
      yuzuMesh.castShadow = true;

      // Little green leaf on top
      const leafGeo = new THREE.ConeGeometry(0.08, 0.16, 5);
      leafGeo.rotateZ(Math.PI / 4);
      const leafMesh = new THREE.Mesh(leafGeo, this.leafMaterial);
      leafMesh.position.set(0.06, 0.42, 0);
      yuzuMesh.add(leafMesh);

      hatGroup.add(yuzuMesh);
    } else if (hatType === 'crown') {
      // Golden Prestige Crown
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.85,
        roughness: 0.2,
      });
      const crownGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.24, 6);
      const crownMesh = new THREE.Mesh(crownGeo, crownMat);
      crownMesh.position.set(0, 0.14, 0);
      crownMesh.castShadow = true;
      hatGroup.add(crownMesh);
    } else if (hatType === 'flower') {
      // Lotus flower blossom
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
      const centerGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const centerMesh = new THREE.Mesh(
        centerGeo,
        new THREE.MeshStandardMaterial({ color: 0xffeb3b })
      );
      centerMesh.position.set(0, 0.08, 0);
      hatGroup.add(centerMesh);
    } else if (hatType === 'party') {
      // Party cone hat
      const partyMat = new THREE.MeshStandardMaterial({
        color: 0x9c27b0,
        roughness: 0.3,
      });
      const coneGeo = new THREE.ConeGeometry(0.2, 0.45, 12);
      const cone = new THREE.Mesh(coneGeo, partyMat);
      cone.position.set(0, 0.24, 0);
      hatGroup.add(cone);
    }
  }

  // Procedural Onsen Hot Spring structure
  public static createHotSpring(): THREE.Group {
    const group = new THREE.Group();

    // 1. Rock ring perimeter
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x555c65,
      roughness: 0.9,
      metalness: 0.1,
    });
    const rockCount = 12;
    const radius = 2.4;
    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2;
      const rockGeo = new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.15);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(
        Math.cos(angle) * radius,
        0.25,
        Math.sin(angle) * radius
      );
      rock.scale.set(1 + Math.random() * 0.3, 0.8, 1 + Math.random() * 0.3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
    }

    // 2. Steamy blue mineral water pool
    const waterGeo = new THREE.CylinderGeometry(radius - 0.2, radius - 0.2, 0.2, 24);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(0, 0.15, 0);
    water.receiveShadow = true;
    group.add(water);

    // 3. Wooden bamboo water spout
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xa16207,
      roughness: 0.7,
    });
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(-radius + 0.3, 0.6, 0);
    post.castShadow = true;
    group.add(post);

    const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8);
    pipeGeo.rotateZ(-Math.PI / 3);
    const pipe = new THREE.Mesh(pipeGeo, woodMat);
    pipe.position.set(-radius + 0.7, 1.0, 0);
    pipe.castShadow = true;
    group.add(pipe);

    // 4. Floating wooden bucket with yuzu
    const bucketGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.14, 10);
    const bucket = new THREE.Mesh(bucketGeo, woodMat);
    bucket.position.set(0.6, 0.25, 0.4);
    group.add(bucket);

    const floatYuzu = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      this.yuzuMaterial
    );
    floatYuzu.position.set(0.6, 0.32, 0.4);
    group.add(floatYuzu);

    return group;
  }

  // Procedural Yuzu Tree
  public static createYuzuTree(): THREE.Group {
    const group = new THREE.Group();

    // Trunk
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.85,
    });
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.2, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(0, 1.1, 0);
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage canopy (layered spheres)
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.8,
    });
    const sphere1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), foliageMat);
    sphere1.position.set(0, 2.5, 0);
    sphere1.castShadow = true;
    group.add(sphere1);

    const sphere2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9), foliageMat);
    sphere2.position.set(0.5, 2.9, 0.2);
    sphere2.castShadow = true;
    group.add(sphere2);

    // Ripe hanging yuzu fruit
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), this.yuzuMaterial);
      fruit.position.set(
        Math.cos(angle) * 0.95,
        2.2 + (i % 2) * 0.4,
        Math.sin(angle) * 0.95
      );
      fruit.castShadow = true;
      group.add(fruit);
    }

    return group;
  }
}
