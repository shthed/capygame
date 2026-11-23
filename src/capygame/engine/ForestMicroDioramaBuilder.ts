import * as THREE from 'three';
import {
  FOREST_MICRO_SPECIMENS,
  ForestMicroSpecimenId,
  ForestMicroSpecimenSpec,
  getForestSpecimenSpec,
} from './forestMicroSpecimens';

interface DioramaSpecimenNode {
  spec: ForestMicroSpecimenSpec;
  root: THREE.Group;
  gladePos: THREE.Vector3;
  gladeScale: number;
  heroScale: number;
  baseY: number;
  phase: number;
  heroOnlySpin?: THREE.Object3D;
}

interface AnimatedButterfly {
  root: THREE.Group;
  leftWing: THREE.Object3D;
  rightWing: THREE.Object3D;
  baseX: number;
  baseY: number;
  baseZ: number;
  flapSpeed: number;
  orbitSpeed: number;
  phase: number;
}

export interface ForestMicroDioramaHandle {
  activeSpecimenId: ForestMicroSpecimenId;
  setActiveSpecimen: (id: ForestMicroSpecimenId) => void;
  tick: (dt: number, elapsed: number) => void;
}

function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Builds an illustrated storybook sunlit woodland clearing diorama at the Leaf & Fur micro-scale (10^-2 m).
 * Draws all 11 requested subjects (Fur, Butterfly, Flower, Leaf, Wood, Mushroom, Amoeba, Bacterial,
 * Virus, Clay, Rock) together in a lush forest clearing with canopy trees, treehouse nook, creek, path,
 * sunbeams, and capybara friends, while spotlighting one randomly chosen centerpiece specimen at (0,0,0).
 */
export function buildForestMicroDiorama(
  parentGroup: THREE.Group,
  glowTex: THREE.CanvasTexture,
  isSoftwareGl: boolean,
  initialSpecimen: ForestMicroSpecimenId
): ForestMicroDioramaHandle {
  const dioramaRoot = new THREE.Group();
  parentGroup.add(dioramaRoot);

  // Shared PBR material palette (natural daylight shading without bloom-clipping emissive washout)
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x358c3e,
    emissive: 0x0a210f,
    emissiveIntensity: 0.1,
    roughness: 0.88,
  });
  const grassEdgeMat = new THREE.MeshStandardMaterial({
    color: 0x4ca644,
    emissive: 0x0d2610,
    emissiveIntensity: 0.1,
    roughness: 0.84,
  });
  const trailMat = new THREE.MeshStandardMaterial({
    color: 0xd6b87c,
    emissive: 0x2e200d,
    emissiveIntensity: 0.08,
    roughness: 0.92,
  });
  const creekMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0369a1,
    emissiveIntensity: 0.16,
    roughness: 0.16,
    metalness: 0.14,
    transparent: true,
    opacity: 0.88,
  });
  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x734625,
    emissive: 0x1a0d04,
    emissiveIntensity: 0.08,
    roughness: 0.94,
  });
  const woodHeartMat = new THREE.MeshStandardMaterial({
    color: 0xd99b52,
    emissive: 0x381e06,
    emissiveIntensity: 0.09,
    roughness: 0.76,
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x2c8a3a,
    emissive: 0x08260e,
    emissiveIntensity: 0.1,
    roughness: 0.82,
  });
  const foliageLightMat = new THREE.MeshStandardMaterial({
    color: 0x6abf40,
    emissive: 0x16380c,
    emissiveIntensity: 0.1,
    roughness: 0.76,
  });
  const fernMat = new THREE.MeshStandardMaterial({
    color: 0x1f9242,
    emissive: 0x062411,
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
    roughness: 0.55,
  });
  const whiteCreamMat = new THREE.MeshStandardMaterial({
    color: 0xf7ecd0,
    emissive: 0x2b200d,
    emissiveIntensity: 0.08,
    roughness: 0.62,
  });
  const redCapMat = new THREE.MeshStandardMaterial({
    color: 0xdc3b3b,
    emissive: 0x5c1414,
    emissiveIntensity: 0.12,
    roughness: 0.36,
  });
  const amberFurMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0x3b1502,
    emissiveIntensity: 0.12,
    roughness: 0.46,
    metalness: 0.05,
  });
  const clayTerracottaMat = new THREE.MeshStandardMaterial({
    color: 0xc26d3a,
    emissive: 0x2b1204,
    emissiveIntensity: 0.1,
    roughness: 0.72,
    metalness: 0.06,
  });
  const slateRockMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    emissive: 0x151e2c,
    emissiveIntensity: 0.1,
    roughness: 0.68,
    metalness: 0.1,
    flatShading: true,
  });
  const quartzMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.18,
    roughness: 0.14,
    metalness: 0.18,
    transparent: true,
    opacity: 0.88,
  });

  // ---------------------------------------------------------------------------
  // 1. SUNLIT STORYBOOK FOREST GLADE STAGE, TRAILS, STREAM & SEAMLESS GROUND
  // ---------------------------------------------------------------------------
  const terrainGroup = new THREE.Group();
  terrainGroup.position.y = -1.25;
  dioramaRoot.add(terrainGroup);

  // Seamless wide multi-ring woodland meadow ground blending radially from sunlit glade grass -> deep forest floor (#1b4328)
  const radSegs = isSoftwareGl ? 28 : 44;
  const ringRadii = [0, 4.5, 9.0, 13.5, 18.0, 24.0, 32.0, 42.0, 56.0];
  const mpVerts: number[] = [];
  const mpColors: number[] = [];
  const mpIndices: number[] = [];
  const cInner = new THREE.Color(0x3a9142);
  const cMid = new THREE.Color(0x276832);
  const cOuter = new THREE.Color(0x1b4328);
  const cTmp = new THREE.Color();
  for (let ri = 0; ri < ringRadii.length; ri++) {
    const rad = ringRadii[ri];
    for (let si = 0; si < radSegs; si++) {
      const ang = (si / radSegs) * Math.PI * 2;
      const px = Math.cos(ang) * rad;
      const pz = Math.sin(ang) * rad;
      const rimUndul =
        rad > 14.0
          ? (Math.sin(ang * 3 + rad * 0.08) * 0.5 + 0.5) * Math.min(2.6, (rad - 14.0) * 0.075)
          : 0;
      mpVerts.push(px, rimUndul - 0.04, pz);
      if (rad <= 14.0) {
        cTmp.copy(cInner).lerp(cMid, rad / 14.0);
      } else {
        cTmp.copy(cMid).lerp(cOuter, Math.min(1.0, (rad - 14.0) / 30.0));
      }
      mpColors.push(cTmp.r, cTmp.g, cTmp.b);
      if (ri < ringRadii.length - 1) {
        const nextSi = (si + 1) % radSegs;
        const a = ri * radSegs + si;
        const b = ri * radSegs + nextSi;
        const c = (ri + 1) * radSegs + si;
        const d = (ri + 1) * radSegs + nextSi;
        mpIndices.push(a, b, c, b, d, c);
      }
    }
  }
  const meadowPlaneGeo = new THREE.BufferGeometry();
  meadowPlaneGeo.setAttribute('position', new THREE.Float32BufferAttribute(mpVerts, 3));
  meadowPlaneGeo.setAttribute('color', new THREE.Float32BufferAttribute(mpColors, 3));
  meadowPlaneGeo.setIndex(mpIndices);
  meadowPlaneGeo.computeVertexNormals();
  const seamlessFloorMesh = new THREE.Mesh(
    meadowPlaneGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })
  );
  terrainGroup.add(seamlessFloorMesh);

  // Subtle soft forest-canopy mist accent far behind the clearing (bloom-safe low opacity)
  const backCanopyGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x4ade80,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  backCanopyGlow.position.set(0, 8.8, -14.5);
  backCanopyGlow.scale.set(28, 16, 1);
  terrainGroup.add(backCanopyGlow);

  // Gentle lush center clearing moss mound where active hero specimen rests
  const pedestalHill = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 5.4, 0.38, isSoftwareGl ? 20 : 32),
    grassEdgeMat
  );
  pedestalHill.position.y = 0.14;
  terrainGroup.add(pedestalHill);

  // Winding golden earthen path meandering foreground -> misty sunlit horizon
  const trailPts = [
    new THREE.Vector3(-4.2, 0.05, 13.5),
    new THREE.Vector3(-1.4, 0.05, 7.6),
    new THREE.Vector3(0.4, 0.06, 2.5),
    new THREE.Vector3(-0.6, 0.05, -4.5),
    new THREE.Vector3(0.5, 0.05, -12.8),
  ];
  const trailCurve = new THREE.CatmullRomCurve3(trailPts);
  const trailSegs = 26;
  const trailGeo = new THREE.BufferGeometry();
  const tVerts: number[] = [];
  const tIndices: number[] = [];
  for (let i = 0; i <= trailSegs; i++) {
    const u = i / trailSegs;
    const p = trailCurve.getPoint(u);
    const tang = trailCurve.getTangent(u);
    const nx = -tang.z;
    const nz = tang.x;
    const halfW = 1.45 - u * 0.48;
    tVerts.push(p.x - nx * halfW, p.y, p.z - nz * halfW);
    tVerts.push(p.x + nx * halfW, p.y, p.z + nz * halfW);
    if (i < trailSegs) {
      const a = i * 2;
      tIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(tVerts, 3));
  trailGeo.setIndex(tIndices);
  trailGeo.computeVertexNormals();
  const trailMesh = new THREE.Mesh(trailGeo, trailMat);
  terrainGroup.add(trailMesh);

  // Sparkling azure shallow woodland creek along the lower-right bank
  const creek = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.9, 0.16, isSoftwareGl ? 20 : 32),
    creekMat
  );
  creek.scale.set(1.25, 1.0, 1.55);
  creek.position.set(7.4, -0.02, 5.2);
  creek.rotation.y = -0.35;
  terrainGroup.add(creek);

  // Perimeter woodland oak trees + lush arched leafy canopy framing the clearing (keeping right treehouse & sightline clear)
  const treePlacements = [
    { x: -11.4, z: -2.2, r: 1.05, h: 12.2 },
    { x: -9.8, z: -9.2, r: 0.85, h: 13.0 },
    { x: -5.2, z: -13.4, r: 0.72, h: 13.5 },
    { x: 4.4, z: -13.6, r: 0.74, h: 13.5 },
    { x: 11.4, z: -9.6, r: 0.92, h: 12.8 },
    { x: 13.8, z: -2.6, r: 1.05, h: 12.4 },
    { x: -12.0, z: 6.8, r: 0.95, h: 11.5 },
    { x: 14.2, z: 6.4, r: 0.86, h: 11.2 },
  ];
  const trunkCylGeo = new THREE.CylinderGeometry(0.65, 1.05, 1.0, 9);
  const canopyBallGeo = new THREE.DodecahedronGeometry(3.1, 1);

  for (let i = 0; i < treePlacements.length; i++) {
    const tp = treePlacements[i];
    const tGroup = new THREE.Group();
    tGroup.position.set(tp.x, 0, tp.z);

    const trunk = new THREE.Mesh(trunkCylGeo, barkMat);
    trunk.scale.set(tp.r, tp.h, tp.r);
    trunk.position.y = tp.h * 0.5;
    tGroup.add(trunk);

    // Flared buttress root toes
    for (let b = 0; b < 3; b++) {
      const ba = b * 2.1 + i * 0.5;
      const root = new THREE.Mesh(trunkCylGeo, barkMat);
      root.scale.set(tp.r * 0.36, 1.9, tp.r * 0.36);
      root.position.set(Math.cos(ba) * tp.r * 0.85, 0.7, Math.sin(ba) * tp.r * 0.85);
      root.rotation.z = -Math.cos(ba) * 0.42;
      root.rotation.x = Math.sin(ba) * 0.42;
      tGroup.add(root);
    }

    // Dual-tone leafy canopy cluster
    const crownA = new THREE.Mesh(canopyBallGeo, foliageMat);
    crownA.position.set(0, tp.h + 0.6, 0);
    crownA.scale.set(tp.r * 1.15, 0.72, tp.r * 1.15);
    tGroup.add(crownA);

    const crownB = new THREE.Mesh(canopyBallGeo, foliageLightMat);
    crownB.position.set(-tp.x * 0.14, tp.h - 0.6, -tp.z * 0.14);
    crownB.scale.set(tp.r * 0.9, 0.6, tp.r * 0.9);
    tGroup.add(crownB);

    terrainGroup.add(tGroup);
  }

  // Cozy Woodland Treehouse nook nestled clearly in the right-side Oak (echoing the illustration)
  const houseGroup = new THREE.Group();
  houseGroup.position.set(8.4, 3.6, -2.8);
  houseGroup.rotation.y = -0.62;
  const cabinWallMat = new THREE.MeshStandardMaterial({
    color: 0xd99b52,
    emissive: 0x3f2408,
    emissiveIntensity: 0.2,
    roughness: 0.75,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x6b4226,
    roughness: 0.84,
  });
  const blueDoorMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    emissive: 0x1e40af,
    emissiveIntensity: 0.3,
    roughness: 0.4,
  });
  const glowWindowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const treeTrunk = new THREE.Mesh(trunkCylGeo, barkMat);
  treeTrunk.scale.set(1.55, 11.5, 1.55);
  treeTrunk.position.set(0, 1.9, 0);
  houseGroup.add(treeTrunk);

  const blueDoor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.25, 12),
    blueDoorMat
  );
  blueDoor.rotation.x = Math.PI / 2;
  blueDoor.position.set(0, -2.55, 1.38);
  houseGroup.add(blueDoor);

  const cabinBox = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.4), cabinWallMat);
  cabinBox.position.set(-0.2, 1.8, 0.9);
  houseGroup.add(cabinBox);

  const cabinRoof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.65, 4), roofMat);
  cabinRoof.rotation.y = Math.PI / 4;
  cabinRoof.position.set(-0.2, 3.7, 0.9);
  houseGroup.add(cabinRoof);

  const cabinWindow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), glowWindowMat);
  cabinWindow.position.set(-0.2, 2.1, 2.12);
  houseGroup.add(cabinWindow);

  const balconyDeck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.1), woodHeartMat);
  balconyDeck.position.set(1.4, 0.85, 1.3);
  houseGroup.add(balconyDeck);

  // Cute wooden rope ladder leaning up to balcony
  for (const lx of [-0.28, 0.28]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.6, 6), woodHeartMat);
    rail.position.set(1.4 + lx, -1.4, 1.65);
    rail.rotation.z = -0.14;
    houseGroup.add(rail);
  }
  terrainGroup.add(houseGroup);

  // Miniature Storybook Capybara & Dachshund resting in the clearing behind the foreground specimen
  const buildTinyCritter = (x: number, z: number, yaw: number, isDachshund: boolean) => {
    const g = new THREE.Group();
    g.position.set(x, 0.05, z);
    g.rotation.y = yaw;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(isDachshund ? 0.26 : 0.62, isDachshund ? 0.72 : 0.78, 6, 10),
      isDachshund
        ? new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.7 })
        : amberFurMat
    );
    body.rotation.z = Math.PI / 2;
    body.position.y = isDachshund ? 0.42 : 0.82;
    g.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(isDachshund ? 0.24 : 0.44, 10, 10),
      body.material
    );
    head.scale.set(1.2, 0.92, 0.9);
    head.position.set(isDachshund ? 0.56 : 0.72, isDachshund ? 0.65 : 1.12, 0);
    g.add(head);
    terrainGroup.add(g);
  };
  buildTinyCritter(-4.2, -3.5, 0.5, false);
  buildTinyCritter(-2.3, -2.8, -2.5, true);
  buildTinyCritter(5.8, 3.1, -0.6, false);

  // Soft rounded leafy fern shrubs & mossy clover tufts framing the clearing perimeter
  const fernBladeGeo = new THREE.DodecahedronGeometry(0.68, 1);
  const bushCount = isSoftwareGl ? 18 : 30;
  const fernInst = new THREE.InstancedMesh(fernBladeGeo, fernMat, bushCount * 3);
  const _dummy = new THREE.Object3D();
  for (let i = 0; i < bushCount; i++) {
    const a = (i / bushCount) * Math.PI * 2 + 0.15;
    const rad = 11.2 + seededRand(i * 5 + 1) * 4.2;
    const bx = Math.cos(a) * rad;
    const bz = Math.sin(a) * rad;
    for (let f = 0; f < 3; f++) {
      const idx = i * 3 + f;
      const fa = a + f * 2.05;
      _dummy.position.set(bx + Math.cos(fa) * 0.45, 0.42 + (f === 1 ? 0.25 : 0), bz + Math.sin(fa) * 0.45);
      _dummy.rotation.set(0, fa, 0);
      const sc = 0.72 + seededRand(idx) * 0.48;
      _dummy.scale.set(sc * 1.15, sc * 0.72, sc * 1.15);
      _dummy.updateMatrix();
      fernInst.setMatrixAt(idx, _dummy.matrix);
    }
  }
  fernInst.instanceMatrix.needsUpdate = true;
  fernInst.computeBoundingSphere();
  terrainGroup.add(fernInst);

  // Soft Dappled Sunbeam Accent & Gentle Pollen Fireflies (calibrated below bloom blowout threshold)
  const sunbeamHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfef08a,
      opacity: 0.11,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sunbeamHalo.position.set(1.2, 8.6, -11.5);
  sunbeamHalo.scale.set(18, 12, 1);
  dioramaRoot.add(sunbeamHalo);

  const pollenCount = isSoftwareGl ? 24 : 52;
  const pollenPos = new Float32Array(pollenCount * 3);
  for (let i = 0; i < pollenCount; i++) {
    pollenPos[i * 3] = (seededRand(i * 3 + 11) - 0.5) * 20;
    pollenPos[i * 3 + 1] = -1.0 + seededRand(i * 3 + 12) * 8.5;
    pollenPos[i * 3 + 2] = (seededRand(i * 3 + 13) - 0.5) * 20;
  }
  const pollenGeo = new THREE.BufferGeometry();
  pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
  const pollenPoints = new THREE.Points(
    pollenGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      color: 0xfef08a,
      size: 0.34,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  dioramaRoot.add(pollenPoints);

  // Subtle dappled spotlight accent under whichever Hero Specimen sits at center glade mound
  const heroSpotlight = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfde047,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  heroSpotlight.position.set(0, -0.55, 0);
  heroSpotlight.scale.setScalar(6.2);
  dioramaRoot.add(heroSpotlight);

  // ---------------------------------------------------------------------------
  // 2. PROCEDURAL 3D MODELS FOR ALL 11 FOREST MICRO-SPECIMENS
  // ---------------------------------------------------------------------------
  const butterfliesToFlap: AnimatedButterfly[] = [];
  const specimenNodes: DioramaSpecimenNode[] = [];
  const specimenById = new Map<ForestMicroSpecimenId, DioramaSpecimenNode>();

  const buildSpecimenGroup = (id: ForestMicroSpecimenId): { root: THREE.Group; spinTarget?: THREE.Object3D } => {
    const root = new THREE.Group();

    switch (id) {
      case 'fur': {
        // Cushioned golden suede tuft with 9 gently arched curved capybara keratin guard hairs
        const cushion = new THREE.Mesh(
          new THREE.CylinderGeometry(1.75, 2.05, 0.55, 14),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 })
        );
        cushion.position.y = 0.25;
        root.add(cushion);
        for (let i = 0; i < 9; i++) {
          const ang = (i / 9) * Math.PI * 2;
          const rad = i === 0 ? 0.0 : 0.65 + (i % 2) * 0.42;
          const sx = Math.cos(ang) * rad;
          const sz = Math.sin(ang) * rad;
          const hCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(sx, 0.35, sz),
            new THREE.Vector3(sx * 1.25 + 0.35, 2.1, sz * 1.25),
            new THREE.Vector3(sx * 1.45 + 0.85, 3.85 + (i % 3) * 0.35, sz * 1.45 + 0.2),
          ]);
          const hair = new THREE.Mesh(new THREE.TubeGeometry(hCurve, 10, 0.14, 7, false), amberFurMat);
          root.add(hair);

          // Tiny golden dew bead clinging to bristle tip
          if (i % 3 === 0) {
            const dew = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), quartzMat);
            dew.position.set(sx * 1.3 + 0.55, 2.95, sz * 1.3);
            root.add(dew);
          }
        }
        return { root };
      }

      case 'butterfly': {
        const bGroup = new THREE.Group();
        const isMonarch = true;
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.42,
          roughness: 0.28,
          metalness: 0.25,
          side: THREE.DoubleSide,
        });
        const trimWingMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0x78350f,
          emissiveIntensity: 0.25,
          roughness: 0.35,
          side: THREE.DoubleSide,
        });
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x1e1b4b,
          roughness: 0.6,
        });

        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.35, 6, 10), bodyMat);
        body.rotation.x = Math.PI / 2;
        bGroup.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), bodyMat);
        head.position.set(0, 0.08, 0.85);
        bGroup.add(head);

        const foreShape = new THREE.Shape();
        foreShape.moveTo(0, 0.1);
        foreShape.bezierCurveTo(1.2, 1.4, 2.5, 1.3, 2.35, -0.15);
        foreShape.bezierCurveTo(1.8, -0.75, 0.6, -0.6, 0, -0.15);
        const hindShape = new THREE.Shape();
        hindShape.moveTo(0, -0.15);
        hindShape.bezierCurveTo(1.4, -0.35, 1.9, -1.65, 0.9, -1.9);
        hindShape.bezierCurveTo(0.25, -1.6, 0.05, -0.8, 0, -0.15);

        const foreGeo = new THREE.ShapeGeometry(foreShape, 12);
        foreGeo.rotateX(-Math.PI / 2);
        const hindGeo = new THREE.ShapeGeometry(hindShape, 10);
        hindGeo.rotateX(-Math.PI / 2);

        const rightWing = new THREE.Group();
        rightWing.add(new THREE.Mesh(foreGeo, isMonarch ? wingMat : trimWingMat));
        rightWing.add(new THREE.Mesh(hindGeo, trimWingMat));
        bGroup.add(rightWing);

        const leftWing = new THREE.Group();
        leftWing.scale.x = -1;
        leftWing.add(new THREE.Mesh(foreGeo, isMonarch ? wingMat : trimWingMat));
        leftWing.add(new THREE.Mesh(hindGeo, trimWingMat));
        bGroup.add(leftWing);

        bGroup.position.y = 1.65;
        bGroup.rotation.x = 0.25;
        root.add(bGroup);

        butterfliesToFlap.push({
          root: bGroup,
          leftWing,
          rightWing,
          baseX: 0,
          baseY: 1.65,
          baseZ: 0,
          flapSpeed: 6.2,
          orbitSpeed: 0,
          phase: 0.4,
        });
        return { root, spinTarget: bGroup };
      }

      case 'flower': {
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.18, 2.2, 8),
          fernMat
        );
        stem.position.y = 1.1;
        root.add(stem);

        const head = new THREE.Group();
        head.position.y = 2.25;
        head.rotation.x = 0.28;
        root.add(head);

        const centerPollen = new THREE.Mesh(
          new THREE.SphereGeometry(0.75, 14, 14),
          new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            emissive: 0x854d0e,
            emissiveIntensity: 0.35,
            roughness: 0.45,
          })
        );
        centerPollen.scale.y = 0.55;
        head.add(centerPollen);

        const petalShape = new THREE.Shape();
        petalShape.moveTo(0, 0);
        petalShape.bezierCurveTo(-0.55, 0.9, -0.45, 2.25, 0, 2.55);
        petalShape.bezierCurveTo(0.45, 2.25, 0.55, 0.9, 0, 0);
        const petalGeo = new THREE.ShapeGeometry(petalShape, 10);
        petalGeo.rotateX(-Math.PI / 2);

        const petalMat = new THREE.MeshStandardMaterial({
          color: 0xd8b4fe,
          emissive: 0x6b21a8,
          emissiveIntensity: 0.28,
          roughness: 0.34,
          side: THREE.DoubleSide,
        });

        for (let p = 0; p < 8; p++) {
          const pMesh = new THREE.Mesh(petalGeo, petalMat);
          pMesh.rotation.y = (p / 8) * Math.PI * 2;
          pMesh.rotation.x = -0.18;
          head.add(pMesh);
        }
        return { root, spinTarget: head };
      }

      case 'leaf': {
        const leafShape = new THREE.Shape();
        leafShape.moveTo(-2.8, 0);
        leafShape.bezierCurveTo(-2.0, 1.45, -0.3, 1.85, 1.3, 1.2);
        leafShape.bezierCurveTo(2.3, 0.78, 2.8, 0.25, 3.1, 0);
        leafShape.bezierCurveTo(2.8, -0.25, 2.3, -0.78, 1.3, -1.2);
        leafShape.bezierCurveTo(-0.3, -1.85, -2.0, -1.45, -2.8, 0);

        const lGeo = new THREE.ShapeGeometry(leafShape, 16);
        const pAttr = lGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pAttr.count; i++) {
          const lx = pAttr.getX(i);
          const ly = pAttr.getY(i);
          pAttr.setZ(i, -0.08 * lx * lx + Math.abs(ly) * 0.14);
        }
        lGeo.computeVertexNormals();

        const bladeGroup = new THREE.Group();
        bladeGroup.position.y = 1.65;
        bladeGroup.rotation.x = -0.45;
        bladeGroup.rotation.z = 0.2;
        root.add(bladeGroup);

        bladeGroup.add(
          new THREE.Mesh(
            lGeo,
            new THREE.MeshStandardMaterial({
              color: 0x22c55e,
              emissive: 0x14532d,
              emissiveIntensity: 0.28,
              side: THREE.DoubleSide,
              roughness: 0.34,
            })
          )
        );
        const veinMat = new THREE.MeshStandardMaterial({
          color: 0xd9f99d,
          emissive: 0x3f6212,
          emissiveIntensity: 0.28,
          roughness: 0.4,
        });
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 6.2, 8), veinMat);
        rib.rotation.z = Math.PI / 2;
        rib.position.y = 0;
        bladeGroup.add(rib);

        for (let v = -2; v <= 2; v++) {
          for (const side of [-1, 1]) {
            const sub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 1.3, 6), veinMat);
            sub.position.set(v * 0.72 + 0.3, side * 0.58, 0.06);
            sub.rotation.z = side * -0.58;
            bladeGroup.add(sub);
          }
        }
        // Dew droplet pearl
        const dew = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), quartzMat);
        dew.position.set(0.4, 0.5, 0.35);
        bladeGroup.add(dew);
        return { root, spinTarget: bladeGroup };
      }

      case 'wood': {
        // Cut heartwood tree stump segment showing concentric growth rings & amber resin drop
        const outerBark = new THREE.Mesh(
          new THREE.CylinderGeometry(1.9, 2.05, 2.2, 14),
          barkMat
        );
        outerBark.position.y = 1.1;
        root.add(outerBark);

        const coreWood = new THREE.Mesh(
          new THREE.CylinderGeometry(1.62, 1.62, 2.24, 18),
          woodHeartMat
        );
        coreWood.position.y = 1.1;
        root.add(coreWood);

        const innerRing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 0.95, 2.28, 16),
          new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.68 })
        );
        innerRing.position.y = 1.1;
        root.add(innerRing);

        const amberResin = new THREE.Mesh(
          new THREE.SphereGeometry(0.38, 12, 12),
          new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xb45309,
            emissiveIntensity: 0.35,
            roughness: 0.16,
            transparent: true,
            opacity: 0.9,
          })
        );
        amberResin.position.set(1.65, 1.35, 0.5);
        root.add(amberResin);
        return { root };
      }

      case 'mushroom': {
        // Iconic crimson-and-white spotted fly-agaric mushroom cluster
        const buildToadstool = (ox: number, oz: number, sc: number) => {
          const m = new THREE.Group();
          m.position.set(ox, 0, oz);
          m.scale.setScalar(sc);
          const stalk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.64, 2.1, 12),
            whiteCreamMat
          );
          stalk.position.y = 1.05;
          m.add(stalk);

          const gill = new THREE.Mesh(
            new THREE.CylinderGeometry(1.45, 0.45, 0.25, 16),
            whiteCreamMat
          );
          gill.position.y = 2.02;
          m.add(gill);

          const capGeo = new THREE.SphereGeometry(1.52, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
          const cap = new THREE.Mesh(capGeo, redCapMat);
          cap.position.y = 1.95;
          cap.scale.set(1.05, 0.8, 1.05);
          m.add(cap);

          const spotOffsets = [
            [0.65, 2.85, 0.35],
            [-0.75, 2.75, 0.45],
            [0.15, 3.05, -0.55],
            [-0.45, 2.65, -0.78],
            [0.85, 2.5, -0.45],
          ];
          for (let s = 0; s < spotOffsets.length; s++) {
            const spot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), whiteCreamMat);
            spot.position.set(spotOffsets[s][0], spotOffsets[s][1], spotOffsets[s][2]);
            spot.scale.y = 0.45;
            m.add(spot);
          }
          root.add(m);
        };
        buildToadstool(0, 0, 1.05);
        buildToadstool(-1.35, 0.75, 0.55);
        buildToadstool(1.25, -0.65, 0.46);
        return { root };
      }

      case 'amoeba': {
        // Organic lobed translucent cell inside a glistening creek water droplet
        const droplet = new THREE.Mesh(
          new THREE.SphereGeometry(2.05, 18, 14),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0369a1,
            emissiveIntensity: 0.25,
            roughness: 0.1,
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
          })
        );
        droplet.scale.y = 0.62;
        droplet.position.y = 1.25;
        root.add(droplet);

        const amoebaGroup = new THREE.Group();
        amoebaGroup.position.y = 1.25;
        const membraneMat = new THREE.MeshStandardMaterial({
          color: 0x2dd4bf,
          emissive: 0x0f766e,
          emissiveIntensity: 0.42,
          roughness: 0.26,
          transparent: true,
          opacity: 0.78,
        });
        const lobeCoords = [
          [0, 0, 0, 1.0],
          [0.95, 0.1, 0.35, 0.62],
          [-0.85, 0.05, 0.52, 0.58],
          [-0.35, -0.05, -0.92, 0.65],
          [0.52, 0.08, -0.65, 0.52],
        ];
        for (const [lx, ly, lz, lr] of lobeCoords) {
          const lobe = new THREE.Mesh(new THREE.SphereGeometry(lr, 14, 12), membraneMat);
          lobe.scale.set(1.1, 0.48, 1.1);
          lobe.position.set(lx, ly, lz);
          amoebaGroup.add(lobe);
        }
        const nuc = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 12, 12),
          new THREE.MeshStandardMaterial({
            color: 0x818cf8,
            emissive: 0x4338ca,
            emissiveIntensity: 0.72,
            roughness: 0.25,
          })
        );
        amoebaGroup.add(nuc);
        root.add(amoebaGroup);
        return { root, spinTarget: amoebaGroup };
      }

      case 'bacterial': {
        // Cluster of iridescent rod bacilli + helical spirilla with whip flagella
        const cluster = new THREE.Group();
        cluster.position.y = 1.45;
        const bacMat = new THREE.MeshStandardMaterial({
          color: 0xa3e635,
          emissive: 0x3f6212,
          emissiveIntensity: 0.48,
          roughness: 0.28,
        });
        const flagMat = new THREE.MeshStandardMaterial({
          color: 0xd9f99d,
          roughness: 0.35,
        });

        for (let b = 0; b < 5; b++) {
          const ang = (b / 5) * Math.PI * 2;
          const bacHolder = new THREE.Group();
          bacHolder.position.set(Math.cos(ang) * 0.95, (b % 2) * 0.5 - 0.2, Math.sin(ang) * 0.95);
          bacHolder.rotation.set(0.35 * (b % 2), ang + 0.5, 0.45);

          const rod = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.05, 6, 10), bacMat);
          bacHolder.add(rod);

          const flagCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -0.72, 0),
            new THREE.Vector3(0.22, -1.15, 0.15),
            new THREE.Vector3(-0.2, -1.65, -0.15),
          ]);
          bacHolder.add(new THREE.Mesh(new THREE.TubeGeometry(flagCurve, 8, 0.04, 5, false), flagMat));
          cluster.add(bacHolder);
        }
        root.add(cluster);
        return { root, spinTarget: cluster };
      }

      case 'virus': {
        // Crystalline geometric bacteriophage + spiky crown virions in sunlit forest dew mist
        const capsidMat = new THREE.MeshStandardMaterial({
          color: 0xe879f9,
          emissive: 0x86198f,
          emissiveIntensity: 0.5,
          roughness: 0.22,
          metalness: 0.32,
          flatShading: true,
        });
        const spikeMat = new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          emissive: 0x9f1239,
          emissiveIntensity: 0.45,
          roughness: 0.3,
        });

        const vGroup = new THREE.Group();
        vGroup.position.y = 1.85;
        const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.92, 0), capsidMat);
        head.position.y = 0.85;
        vGroup.add(head);

        const sheath = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.22, 1.35, 8),
          capsidMat
        );
        sheath.position.y = -0.25;
        vGroup.add(sheath);

        for (let l = 0; l < 6; l++) {
          const la = (l / 6) * Math.PI * 2;
          const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.03, 1.35, 6),
            spikeMat
          );
          leg.position.set(Math.cos(la) * 0.62, -1.15, Math.sin(la) * 0.62);
          leg.rotation.z = -Math.cos(la) * 0.72;
          leg.rotation.x = Math.sin(la) * 0.72;
          vGroup.add(leg);
        }

        // Smaller companion crown virion sphere
        const virion = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 0), spikeMat);
        virion.position.set(1.45, 0.25, 0.4);
        vGroup.add(virion);

        root.add(vGroup);
        return { root, spinTarget: vGroup };
      }

      case 'clay': {
        // Stacked hexagonal kaolinite / phyllosilicate mineral platelets
        const clayGroup = new THREE.Group();
        clayGroup.position.y = 0.22;
        const plateGeo = new THREE.CylinderGeometry(1.15, 1.18, 0.24, 6);
        const altClayMat = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          emissive: 0x451a03,
          emissiveIntensity: 0.18,
          roughness: 0.72,
        });
        for (let i = 0; i < 7; i++) {
          const plate = new THREE.Mesh(plateGeo, i % 2 === 0 ? clayTerracottaMat : altClayMat);
          plate.position.set(
            ((i % 3) - 1) * 0.38,
            i * 0.26,
            (Math.floor(i / 3) - 0.5) * 0.35
          );
          plate.rotation.y = i * 0.42;
          plate.scale.setScalar(1.05 - i * 0.06);
          clayGroup.add(plate);
        }
        root.add(clayGroup);
        return { root, spinTarget: clayGroup };
      }

      case 'rock': {
        // Faceted mossy river granite boulder + clear hexagonal quartz crystal prisms
        const boulderA = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 0), slateRockMat);
        boulderA.position.set(0, 0.95, 0);
        boulderA.scale.set(1.25, 0.78, 1.1);
        root.add(boulderA);

        const boulderB = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), slateRockMat);
        boulderB.position.set(-1.1, 0.65, 0.65);
        root.add(boulderB);

        const mossCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
          mossMat
        );
        mossCap.position.set(-0.2, 1.32, 0.1);
        root.add(mossCap);

        for (let q = 0; q < 4; q++) {
          const qa = (q / 4) * Math.PI * 1.4 - 0.4;
          const crystal = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.28, 1.45, 6), quartzMat);
          crystal.position.set(Math.cos(qa) * 0.55 + 0.3, 1.72, Math.sin(qa) * 0.55);
          crystal.rotation.set(Math.sin(qa) * 0.35, qa, -Math.cos(qa) * 0.35);
          root.add(crystal);
        }
        return { root };
      }
    }
  };

  // Instantiate all 11 specimen stations in the forest diorama
  for (let i = 0; i < FOREST_MICRO_SPECIMENS.length; i++) {
    const spec = FOREST_MICRO_SPECIMENS[i];
    const { root, spinTarget } = buildSpecimenGroup(spec.id);
    const gx = Math.cos(spec.gladeAngleRad) * spec.gladeRadius;
    const gz = Math.sin(spec.gladeAngleRad) * spec.gladeRadius;
    const node: DioramaSpecimenNode = {
      spec,
      root,
      gladePos: new THREE.Vector3(gx, -1.05 + spec.gladeY, gz),
      gladeScale: 0.74,
      heroScale: 1.48,
      baseY: -0.68,
      phase: i * 0.75,
      heroOnlySpin: spinTarget,
    };
    dioramaRoot.add(root);
    specimenNodes.push(node);
    specimenById.set(spec.id, node);
  }

  // Plus 4 extra decorative ambient forest butterflies fluttering smoothly in sunbeams
  const extraButterflies: Array<{ x: number; y: number; z: number; hex: number; sc: number }> = [
    { x: -6.2, y: 2.4, z: -1.8, hex: 0xf97316, sc: 0.62 },
    { x: 4.5, y: 3.1, z: -2.5, hex: 0xfacc15, sc: 0.58 },
    { x: 7.4, y: 1.8, z: 3.2, hex: 0x38bdf8, sc: 0.64 },
    { x: -3.2, y: 3.6, z: -5.8, hex: 0xf472b6, sc: 0.54 },
  ];
  const ambBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.6 });
  const ambWingShape = new THREE.Shape();
  ambWingShape.moveTo(0, 0.2);
  ambWingShape.bezierCurveTo(1.1, 1.3, 2.0, 0.8, 1.8, -0.4);
  ambWingShape.bezierCurveTo(1.3, -1.2, 0.4, -1.0, 0, -0.2);
  const ambWingGeo = new THREE.ShapeGeometry(ambWingShape, 8);
  ambWingGeo.rotateX(-Math.PI / 2);

  for (let b = 0; b < extraButterflies.length; b++) {
    const cfg = extraButterflies[b];
    const bRoot = new THREE.Group();
    bRoot.position.set(cfg.x, cfg.y, cfg.z);
    bRoot.scale.setScalar(cfg.sc);

    const wMat = new THREE.MeshStandardMaterial({
      color: cfg.hex,
      emissive: cfg.hex,
      emissiveIntensity: 0.32,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.0, 4, 8), ambBodyMat);
    body.rotation.x = Math.PI / 2;
    bRoot.add(body);

    const rWing = new THREE.Group();
    rWing.add(new THREE.Mesh(ambWingGeo, wMat));
    const lWing = new THREE.Group();
    lWing.scale.x = -1;
    lWing.add(new THREE.Mesh(ambWingGeo, wMat));
    bRoot.add(rWing, lWing);
    dioramaRoot.add(bRoot);

    butterfliesToFlap.push({
      root: bRoot,
      leftWing: lWing,
      rightWing: rWing,
      baseX: cfg.x,
      baseY: cfg.y,
      baseZ: cfg.z,
      flapSpeed: 5.5 + b * 0.7,
      orbitSpeed: 0.45 + b * 0.12,
      phase: b * 1.5,
    });
  }

  let activeSpecimenId: ForestMicroSpecimenId = initialSpecimen;

  const setActiveSpecimen = (nextId: ForestMicroSpecimenId) => {
    const resolved = getForestSpecimenSpec(nextId);
    activeSpecimenId = resolved.id;
    const haloMat = heroSpotlight.material as THREE.SpriteMaterial;
    haloMat.color.setHex(resolved.accentHex);

    for (let i = 0; i < specimenNodes.length; i++) {
      const node = specimenNodes[i];
      if (node.spec.id === activeSpecimenId) {
        node.root.position.set(0, node.baseY, 0);
        node.root.scale.setScalar(node.heroScale);
      } else {
        node.root.position.copy(node.gladePos);
        node.root.scale.setScalar(node.gladeScale);
      }
    }
  };

  setActiveSpecimen(initialSpecimen);

  const handle: ForestMicroDioramaHandle = {
    get activeSpecimenId() {
      return activeSpecimenId;
    },
    setActiveSpecimen,
    tick: (dt, elapsed) => {
      pollenPoints.rotation.y += dt * 0.06;
      const activeNode = specimenById.get(activeSpecimenId);
      if (activeNode) {
        activeNode.root.position.y = activeNode.baseY + Math.sin(elapsed * 1.45) * 0.16;
        if (activeNode.heroOnlySpin) {
          activeNode.heroOnlySpin.rotation.y += dt * 0.42;
        } else {
          activeNode.root.rotation.y += dt * 0.24;
        }
      }

      for (let i = 0; i < butterfliesToFlap.length; i++) {
        const bf = butterfliesToFlap[i];
        const flap = Math.sin(elapsed * bf.flapSpeed + bf.phase) * 0.58;
        bf.leftWing.rotation.z = flap;
        bf.rightWing.rotation.z = -flap;
        if (bf.orbitSpeed > 0) {
          const ot = elapsed * bf.orbitSpeed + bf.phase;
          bf.root.position.x = bf.baseX + Math.cos(ot) * 1.15;
          bf.root.position.y = bf.baseY + Math.sin(ot * 2.1) * 0.45;
          bf.root.position.z = bf.baseZ + Math.sin(ot) * 1.15;
          bf.root.rotation.y = -ot;
        }
      }
    },
  };

  return handle;
}
