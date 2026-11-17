import * as THREE from 'three';
import {
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_TILE_SIZE,
  CAPYTORIO_WORLD_ORIGIN_X,
  CAPYTORIO_WORLD_ORIGIN_Z,
  getCapytorioItemMeta,
  type CapytorioDirection,
  type CapytorioMachineType,
} from './CapytorioData';
import {
  CapytorioFactoryEngine,
  DIR_DX,
  DIR_DZ,
  capytorioGridToWorldX,
  capytorioGridToWorldZ,
  tileKey,
} from './CapytorioFactoryEngine';

const MAX_ORE_INSTANCES = 1024;
const MAX_BELT_INSTANCES = 1400;
const MAX_ITEM_INSTANCES = 1600;
const MAX_VISIBLE_RADIUS_TILES = 22;

// Module-scoped zero-allocation math helpers
const _dummy = new THREE.Object3D();
const _mat4 = new THREE.Matrix4();
const _color = new THREE.Color();
const _activeKeysScratch = new Set<string>();

function dirToRotY(dir: CapytorioDirection): number {
  return -dir * (Math.PI * 0.5);
}

function hashTile(gx: number, gz: number): number {
  let h = (gx * 374761393 + gz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function createIndustrialDeckTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Sunlit warm mineral limestone base with subtle geological speckle
  ctx.fillStyle = '#c8c3b8';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 1800; i++) {
    const x = (i * 197) % 512;
    const y = (i * 331) % 512;
    const v = 175 + ((i * 53) % 45);
    ctx.fillStyle = `rgb(${v},${v - 5},${v - 14})`;
    ctx.fillRect(x, y, 3, 3);
  }

  // Crisp subtle blueprint grid border per tile
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.24)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 508);

  // Corner surveyor crosshairs
  ctx.fillStyle = 'rgba(51, 65, 85, 0.35)';
  ctx.fillRect(0, 0, 18, 4);
  ctx.fillRect(0, 0, 4, 18);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // 320m / 2.5m tile = 128 tiles
  tex.repeat.set(128, 128);
  tex.anisotropy = 8;
  return tex;
}

function createDeckBumpTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const x = (i * 113) % 256;
    const y = (i * 211) % 256;
    const g = 105 + ((i * 37) % 55);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = '#505050';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, 254, 254);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(128, 128);
  return tex;
}

export class Capytorio3DRenderer {
  public readonly root = new THREE.Group();

  // Endless snapping ground deck
  private groundDeck: THREE.Mesh;
  private groundEdgeStrip: THREE.Mesh;
  private beaconPillarGroup = new THREE.Group();

  // Instanced meshes for high-density ores, belts & moving items
  private orePlateInstanced: THREE.InstancedMesh;
  private oreCrystalInstanced: THREE.InstancedMesh;
  private beltBaseInstanced: THREE.InstancedMesh;
  private beltChevronInstanced: THREE.InstancedMesh;
  private itemInstanced: THREE.InstancedMesh;

  // Pooled composite machine groups
  private readonly activeMachineGroups = new Map<string, THREE.Group>();
  private readonly inactivePoolByType = new Map<CapytorioMachineType, THREE.Group[]>();

  // Cursor, directional build ghost & inspector ring
  private cursorGroup = new THREE.Group();
  private cursorFrameMat: THREE.MeshStandardMaterial;
  private ghostArrowMesh: THREE.Mesh;
  private ghostBodyMesh: THREE.Mesh;
  private inspectRingMesh: THREE.Mesh;

  // Shared geometries & materials for composite machines
  private sharedMaterials: THREE.Material[] = [];
  private sharedGeometries: THREE.BufferGeometry[] = [];
  private matSteelDark: THREE.MeshStandardMaterial;
  private matSteelLight: THREE.MeshStandardMaterial;
  private matBrass: THREE.MeshStandardMaterial;
  private matHazardYellow: THREE.MeshStandardMaterial;
  private matBrick: THREE.MeshStandardMaterial;
  private matCopper: THREE.MeshStandardMaterial;
  private matLabGlass: THREE.MeshStandardMaterial;

  private lastBeltScrollPhase = 0;

  constructor() {
    this.root.name = 'Capytorio3DRendererRoot';
    this.root.userData.ignoreCameraFade = true;

    // Shared calibrated PBR materials (roughness/metalness deltas >= 0.25 between parts)
    this.matSteelDark = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.72,
      metalness: 0.55,
    });
    this.matSteelLight = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.34,
      metalness: 0.82,
    });
    this.matBrass = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.26,
      metalness: 0.85,
    });
    this.matHazardYellow = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.5,
      metalness: 0.15,
    });
    this.matBrick = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.88,
      metalness: 0.08,
    });
    this.matCopper = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.32,
      metalness: 0.8,
    });
    this.matLabGlass = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.14,
      metalness: 0.12,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    this.sharedMaterials.push(
      this.matSteelDark,
      this.matSteelLight,
      this.matBrass,
      this.matHazardYellow,
      this.matBrick,
      this.matCopper,
      this.matLabGlass
    );

    // 1. Infinite Industrial Limestone Deck (320m x 320m snapping smoothly in 10m steps)
    const deckTex = createIndustrialDeckTexture();
    const bumpTex = createDeckBumpTexture();
    const deckGeo = new THREE.PlaneGeometry(320, 320, 1, 1);
    deckGeo.rotateX(-Math.PI * 0.5);
    const deckMat = new THREE.MeshStandardMaterial({
      color: deckTex ? 0xffffff : 0xcbd5e1,
      map: deckTex ?? null,
      bumpMap: bumpTex ?? null,
      bumpScale: 0.04,
      roughness: 0.86,
      metalness: 0.08,
    });
    this.groundDeck = new THREE.Mesh(deckGeo, deckMat);
    this.groundDeck.position.set(CAPYTORIO_WORLD_ORIGIN_X, -0.02, CAPYTORIO_WORLD_ORIGIN_Z);
    this.groundDeck.receiveShadow = true;
    this.groundDeck.userData.ignoreCameraFade = true;
    this.root.add(this.groundDeck);
    this.sharedGeometries.push(deckGeo);
    this.sharedMaterials.push(deckMat);

    // Sandy coastline shelf along x = 500 facing Sanctuary across the sea
    const coastGeo = new THREE.BoxGeometry(12, 1.8, 360);
    const coastMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.9,
      metalness: 0.02,
    });
    this.groundEdgeStrip = new THREE.Mesh(coastGeo, coastMat);
    this.groundEdgeStrip.position.set(496, -0.92, 0);
    this.groundEdgeStrip.receiveShadow = true;
    this.groundEdgeStrip.userData.ignoreCameraFade = true;
    this.root.add(this.groundEdgeStrip);
    this.sharedGeometries.push(coastGeo);
    this.sharedMaterials.push(coastMat);

    // Tall Landmark Landing Beacon at Origin (1200, 0, 0) + perimeter corner pylons
    this.buildLandingBeaconLandmark();
    this.root.add(this.beaconPillarGroup);

    // 2. Instanced Ore Patches (Bed disc + 3D Crystal Cluster)
    const orePlateGeo = new THREE.CylinderGeometry(1.06, 1.16, 0.04, 8);
    const orePlateMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.2,
    });
    this.orePlateInstanced = new THREE.InstancedMesh(orePlateGeo, orePlateMat, MAX_ORE_INSTANCES);
    this.orePlateInstanced.frustumCulled = false;
    this.orePlateInstanced.count = 0;
    this.orePlateInstanced.receiveShadow = true;
    this.orePlateInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.orePlateInstanced);

    const oreCrystalGeo = new THREE.DodecahedronGeometry(0.42, 0);
    const oreCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.55,
    });
    this.oreCrystalInstanced = new THREE.InstancedMesh(
      oreCrystalGeo,
      oreCrystalMat,
      MAX_ORE_INSTANCES
    );
    this.oreCrystalInstanced.frustumCulled = false;
    this.oreCrystalInstanced.count = 0;
    this.oreCrystalInstanced.castShadow = true;
    this.oreCrystalInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.oreCrystalInstanced);
    this.sharedGeometries.push(orePlateGeo, oreCrystalGeo);
    this.sharedMaterials.push(orePlateMat, oreCrystalMat);

    // 3. Instanced Transport Belts (Steel Track + Animated Directional Chevron)
    const beltBaseGeo = new THREE.BoxGeometry(
      CAPYTORIO_TILE_SIZE * 0.78,
      0.16,
      CAPYTORIO_TILE_SIZE * 0.96
    );
    const beltBaseMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.65,
      metalness: 0.55,
    });
    this.beltBaseInstanced = new THREE.InstancedMesh(
      beltBaseGeo,
      beltBaseMat,
      MAX_BELT_INSTANCES
    );
    this.beltBaseInstanced.frustumCulled = false;
    this.beltBaseInstanced.count = 0;
    this.beltBaseInstanced.receiveShadow = true;
    this.beltBaseInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.beltBaseInstanced);

    // Chevron arrow pointing -Z (North in local coordinates)
    const chevShape = new THREE.Shape();
    chevShape.moveTo(0, -0.58);
    chevShape.lineTo(0.46, 0.2);
    chevShape.lineTo(0.2, 0.2);
    chevShape.lineTo(0.2, 0.52);
    chevShape.lineTo(-0.2, 0.52);
    chevShape.lineTo(-0.2, 0.2);
    chevShape.lineTo(-0.46, 0.2);
    chevShape.closePath();
    const beltChevGeo = new THREE.ExtrudeGeometry(chevShape, {
      depth: 0.05,
      bevelEnabled: false,
    });
    beltChevGeo.rotateX(Math.PI * 0.5); // Lies flat facing -Z
    const beltChevMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.42,
      roughness: 0.35,
      metalness: 0.25,
    });
    this.beltChevronInstanced = new THREE.InstancedMesh(
      beltChevGeo,
      beltChevMat,
      MAX_BELT_INSTANCES
    );
    this.beltChevronInstanced.frustumCulled = false;
    this.beltChevronInstanced.count = 0;
    this.beltChevronInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.beltChevronInstanced);
    this.sharedGeometries.push(beltBaseGeo, beltChevGeo);
    this.sharedMaterials.push(beltBaseMat, beltChevMat);

    // 4. Instanced Moving Items (Belts, Splitters, Tunnels)
    const itemGeo = new THREE.BoxGeometry(0.44, 0.32, 0.44);
    const itemMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.32,
      metalness: 0.35,
    });
    this.itemInstanced = new THREE.InstancedMesh(itemGeo, itemMat, MAX_ITEM_INSTANCES);
    this.itemInstanced.frustumCulled = false;
    this.itemInstanced.count = 0;
    this.itemInstanced.castShadow = true;
    this.itemInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.itemInstanced);
    this.sharedGeometries.push(itemGeo);
    this.sharedMaterials.push(itemMat);

    // 5. Build Ghost & Ground Cursor Overlay
    this.cursorFrameMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const ghostPlateGeo = new THREE.BoxGeometry(
      CAPYTORIO_TILE_SIZE * 0.94,
      0.06,
      CAPYTORIO_TILE_SIZE * 0.94
    );
    this.cursorGroup.userData.ignoreCameraFade = true;
    this.ghostBodyMesh = new THREE.Mesh(ghostPlateGeo, this.cursorFrameMat);
    this.ghostBodyMesh.position.y = 0.04;
    this.ghostBodyMesh.userData.ignoreCameraFade = true;
    this.cursorGroup.add(this.ghostBodyMesh);

    const arrowGeo = new THREE.ConeGeometry(0.42, 0.95, 4);
    arrowGeo.rotateX(-Math.PI * 0.5);
    this.ghostArrowMesh = new THREE.Mesh(arrowGeo, this.cursorFrameMat);
    this.ghostArrowMesh.position.set(0, 0.42, -0.35);
    this.ghostArrowMesh.userData.ignoreCameraFade = true;
    this.cursorGroup.add(this.ghostArrowMesh);
    this.root.add(this.cursorGroup);

    // Inspected machine selection halo
    const ringGeo = new THREE.RingGeometry(1.15, 1.38, 24);
    ringGeo.rotateX(-Math.PI * 0.5);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.inspectRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.inspectRingMesh.visible = false;
    this.inspectRingMesh.userData.ignoreCameraFade = true;
    this.root.add(this.inspectRingMesh);

    this.sharedGeometries.push(ghostPlateGeo, arrowGeo, ringGeo);
    this.sharedMaterials.push(this.cursorFrameMat, ringMat);
  }

  private buildLandingBeaconLandmark(): void {
    // Low-profile architectural Drop-Pod Surveyor Beacon slightly off spawn pad (-3.5, -3.5) -> clear vista
    const pylon = new THREE.Group();
    pylon.position.set(CAPYTORIO_WORLD_ORIGIN_X, 0, CAPYTORIO_WORLD_ORIGIN_Z - 6.8);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.8, 0.35, 8),
      this.matSteelDark
    );
    base.position.y = 0.175;
    pylon.add(base);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 4.6, 8),
      this.matSteelLight
    );
    mast.position.y = 2.5;
    pylon.add(mast);

    const dish = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.09, 8, 20),
      this.matBrass
    );
    dish.position.y = 4.6;
    dish.rotation.x = Math.PI * 0.32;
    pylon.add(dish);

    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.1,
      roughness: 0.15,
      metalness: 0.2,
    });
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), orbMat);
    orb.position.y = 5.3;
    pylon.add(orb);
    this.sharedMaterials.push(orbMat);

    this.beaconPillarGroup.add(pylon);
  }

  /**
   * Returns only tall composite structures & beacon landmarks that might occlude the camera-to-player sightline.
   * Never yields `root`, ground deck, ores, belts, or cursor overlays.
   */
  public collectOccluderCandidates(out: THREE.Object3D[]): void {
    if (this.beaconPillarGroup.visible) {
      out.push(this.beaconPillarGroup);
    }
    for (const group of this.activeMachineGroups.values()) {
      if (group.visible) {
        out.push(group);
      }
    }
  }

  private acquireMachineGroup(type: CapytorioMachineType): THREE.Group {
    const pool = this.inactivePoolByType.get(type);
    if (pool && pool.length > 0) {
      const g = pool.pop()!;
      g.visible = true;
      return g;
    }
    return this.createCompositeMachineMesh(type);
  }

  private releaseMachineGroup(type: CapytorioMachineType, group: THREE.Group): void {
    group.visible = false;
    this.root.remove(group);
    let pool = this.inactivePoolByType.get(type);
    if (!pool) {
      pool = [];
      this.inactivePoolByType.set(type, pool);
    }
    pool.push(group);
  }

  private createCompositeMachineMesh(type: CapytorioMachineType): THREE.Group {
    const g = new THREE.Group();
    const spec = CAPYTORIO_MACHINE_SPECS[type];
    const accentMat = new THREE.MeshStandardMaterial({
      color: spec.colorHex,
      roughness: 0.38,
      metalness: 0.35,
    });
    this.sharedMaterials.push(accentMat);

    // Base chassis plinth sitting flush on y = 0
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.24, 2.05),
      this.matSteelDark
    );
    plinth.position.y = 0.12;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    g.add(plinth);

    if (type === 'drill') {
      // Twin A-frame pillars + rotating drill auger + output chute pointing -Z
      for (const sx of [-0.72, 0.72]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.45, 0.36), this.matSteelLight);
        leg.position.set(sx, 0.92, 0);
        g.add(leg);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.34, 0.9), accentMat);
      bridge.position.set(0, 1.56, 0);
      g.add(bridge);

      const augerGroup = new THREE.Group();
      augerGroup.position.set(0, 0.86, 0);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.46, 1.18, 8),
        this.matBrass
      );
      cone.rotation.x = Math.PI;
      augerGroup.add(cone);
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.08, 6, 14),
        this.matSteelLight
      );
      collar.rotation.x = Math.PI * 0.5;
      collar.position.y = 0.25;
      augerGroup.add(collar);
      g.add(augerGroup);
      g.userData.spinPart = augerGroup;

      const chute = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.65), this.matHazardYellow);
      chute.position.set(0, 0.36, -0.98);
      g.add(chute);
    } else if (type === 'inserter') {
      // Articulated swinging arm from +Z (back) -> -Z (front)
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.72, 0.35, 8),
        this.matSteelLight
      );
      ped.position.y = 0.4;
      g.add(ped);

      const turret = new THREE.Group();
      turret.position.set(0, 0.6, 0);
      const joint = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), accentMat);
      turret.add(joint);

      const armPivot = new THREE.Group();
      const armRod = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.7), this.matHazardYellow);
      armRod.position.set(0, 0.45, -0.35);
      armPivot.add(armRod);

      const claw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.36), this.matSteelLight);
      claw.position.set(0, 0.42, -1.18);
      armPivot.add(claw);

      const heldMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.3,
      });
      const heldMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.38), heldMat);
      heldMesh.position.set(0, 0.42, -1.25);
      heldMesh.visible = false;
      armPivot.add(heldMesh);
      this.sharedMaterials.push(heldMat);

      turret.add(armPivot);
      g.add(turret);
      g.userData.turret = turret;
      g.userData.heldMesh = heldMesh;
      g.userData.heldMat = heldMat;
    } else if (type === 'furnace') {
      const kiln = new THREE.Mesh(
        new THREE.CylinderGeometry(0.86, 1.0, 1.35, 8),
        this.matBrick
      );
      kiln.position.y = 0.9;
      g.add(kiln);

      const chimneyL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.0, 8), this.matSteelDark);
      chimneyL.position.set(-0.46, 1.85, 0.35);
      g.add(chimneyL);

      const chimneyR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.0, 8), this.matSteelDark);
      chimneyR.position.set(0.46, 1.85, 0.35);
      g.add(chimneyR);

      const hearthMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 0.9,
        roughness: 0.25,
      });
      const hearth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.52, 0.2), hearthMat);
      hearth.position.set(0, 0.65, -0.88);
      g.add(hearth);
      this.sharedMaterials.push(hearthMat);
      g.userData.glowMat = hearthMat;

      const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.08, 6, 12), this.matCopper);
      capRing.rotation.x = Math.PI * 0.5;
      capRing.position.y = 1.56;
      g.add(capRing);

      const furnaceOutPort = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.34), this.matHazardYellow);
      furnaceOutPort.position.set(0, 0.28, -0.96);
      g.add(furnaceOutPort);
    } else if (type === 'assembler') {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.86, 1.05, 1.86), accentMat);
      hull.position.y = 0.76;
      hull.castShadow = true;
      g.add(hull);

      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.3, 1.42), this.matSteelLight);
      hood.position.y = 1.42;
      g.add(hood);

      const gearA = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 8), this.matBrass);
      gearA.position.set(-0.36, 1.66, 0);
      g.add(gearA);

      const gearB = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 6), this.matSteelLight);
      gearB.position.set(0.38, 1.66, 0);
      g.add(gearB);

      const portOut = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.28), this.matHazardYellow);
      portOut.position.set(0, 0.46, -0.98);
      g.add(portOut);

      g.userData.gearA = gearA;
      g.userData.gearB = gearB;
    } else if (type === 'generator') {
      // Heavy horizontal steam boiler + copper condenser pipes + flywheel + firebox + stack
      const boiler = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.68, 1.65, 12),
        accentMat
      );
      boiler.rotation.x = Math.PI * 0.5;
      boiler.position.set(0, 0.98, 0);
      g.add(boiler);

      const fireboxMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.2,
        roughness: 0.25,
      });
      const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.44, 0.22), fireboxMat);
      firebox.position.set(0, 0.65, -0.82);
      g.add(firebox);
      this.sharedMaterials.push(fireboxMat);
      g.userData.fuelGlowMat = fireboxMat;

      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.4, 8), this.matSteelDark);
      stack.position.set(0.45, 1.9, 0.42);
      g.add(stack);

      const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.1, 6, 12), this.matCopper);
      pipe.position.set(-0.52, 1.15, -0.2);
      pipe.rotation.y = Math.PI * 0.5;
      g.add(pipe);

      const flywheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.62, 0.18, 12),
        this.matBrass
      );
      flywheel.rotation.z = Math.PI * 0.5;
      flywheel.position.set(-0.88, 0.98, 0.15);
      g.add(flywheel);
      g.userData.flywheel = flywheel;
    } else if (type === 'lab') {
      // Hex base + translucent domed glass + spinning interior plasma core
      const consoleBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.05, 0.45, 6),
        this.matSteelLight
      );
      consoleBase.position.y = 0.46;
      g.add(consoleBase);

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 1.0,
        roughness: 0.18,
      });
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), coreMat);
      core.position.y = 1.25;
      g.add(core);
      this.sharedMaterials.push(coreMat);
      g.userData.labCoreMat = coreMat;

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.88, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        this.matLabGlass
      );
      dome.position.y = 0.68;
      dome.renderOrder = 3;
      g.add(dome);
      g.userData.spinPart = core;
    } else if (type === 'splitter') {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 1.25), accentMat);
      bridge.position.y = 0.54;
      g.add(bridge);

      const dial = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.45, 4), this.matHazardYellow);
      dial.rotation.x = -Math.PI * 0.5;
      dial.position.set(0, 0.98, -0.15);
      g.add(dial);
    } else if (type === 'tunnel') {
      const arch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.85, 1.5, 10, 1, false, 0, Math.PI),
        accentMat
      );
      arch.rotation.z = Math.PI * 0.5;
      arch.rotation.y = Math.PI * 0.5;
      arch.position.set(0, 0.3, 0);
      g.add(arch);

      const signArrow = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.65, 4), this.matHazardYellow);
      signArrow.rotation.x = -Math.PI * 0.5;
      signArrow.position.set(0, 1.15, -0.1);
      g.add(signArrow);
    } else if (type === 'chest') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.88, 1.5), accentMat);
      body.position.y = 0.66;
      g.add(body);

      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 1.6), this.matBrass);
      lid.position.y = 1.18;
      g.add(lid);
    }

    return g;
  }

  public sync(
    engine: CapytorioFactoryEngine,
    camX: number,
    camZ: number,
    dt: number,
    timeSec: number,
    visible: boolean
  ): void {
    this.root.visible = visible;
    if (!visible) return;

    // 1. Snap endless limestone floor deck smoothly every 10m around camera
    const snapStep = CAPYTORIO_TILE_SIZE * 4;
    const deckX = Math.max(
      500 + 160,
      Math.round(camX / snapStep) * snapStep
    );
    const deckZ = Math.round(camZ / snapStep) * snapStep;
    this.groundDeck.position.set(deckX, -0.02, deckZ);
    this.groundEdgeStrip.position.z = deckZ;

    // 2. Determine visible tile window around camera target
    const centerGx = Math.round((camX - CAPYTORIO_WORLD_ORIGIN_X) / CAPYTORIO_TILE_SIZE);
    const centerGz = Math.round((camZ - CAPYTORIO_WORLD_ORIGIN_Z) / CAPYTORIO_TILE_SIZE);

    let oreCount = 0;
    for (let dx = -MAX_VISIBLE_RADIUS_TILES; dx <= MAX_VISIBLE_RADIUS_TILES; dx++) {
      const gx = centerGx + dx;
      const wx = capytorioGridToWorldX(gx);
      if (wx < 504) continue; // Keep ocean shelf clean
      for (let dz = -MAX_VISIBLE_RADIUS_TILES; dz <= MAX_VISIBLE_RADIUS_TILES; dz++) {
        if (oreCount >= MAX_ORE_INSTANCES) break;
        const gz = centerGz + dz;
        const res = engine.getResourceAt(gx, gz);
        if (!res) continue;

        const wz = capytorioGridToWorldZ(gz);
        const h = hashTile(gx, gz);
        const meta = getCapytorioItemMeta(res.resource);

        // Mineral floor plate
        _dummy.position.set(wx, 0.02, wz);
        _dummy.rotation.set(0, h * Math.PI, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.orePlateInstanced.setMatrixAt(oreCount, _dummy.matrix);
        _color.setHex(meta.colorHex).multiplyScalar(0.55);
        this.orePlateInstanced.setColorAt(oreCount, _color);

        // 3D Crystal cluster
        const hasDrill = engine.machines.get(tileKey(gx, gz))?.type === 'drill';
        const crystalScale = hasDrill ? 0.55 : 0.78 + h * 0.45;
        _dummy.position.set(
          wx + (h - 0.5) * 0.5,
          hasDrill ? 0.14 : 0.24 * crystalScale,
          wz + ((h * 7) % 1 - 0.5) * 0.5
        );
        _dummy.rotation.set(h * 1.1, h * 5.2, h * 0.7);
        _dummy.scale.setScalar(crystalScale);
        _dummy.updateMatrix();
        this.oreCrystalInstanced.setMatrixAt(oreCount, _dummy.matrix);
        _color.setHex(meta.colorHex);
        this.oreCrystalInstanced.setColorAt(oreCount, _color);

        oreCount++;
      }
    }
    this.orePlateInstanced.count = oreCount;
    this.orePlateInstanced.instanceMatrix.needsUpdate = true;
    if (this.orePlateInstanced.instanceColor) this.orePlateInstanced.instanceColor.needsUpdate = true;
    this.oreCrystalInstanced.count = oreCount;
    this.oreCrystalInstanced.instanceMatrix.needsUpdate = true;
    if (this.oreCrystalInstanced.instanceColor) this.oreCrystalInstanced.instanceColor.needsUpdate = true;

    // 3. Reconcile composite machines, instanced belts, and moving items
    this.lastBeltScrollPhase = (this.lastBeltScrollPhase + dt * engine.getBeltSpeedTilesPerSec()) % 1.0;
    let beltCount = 0;
    let itemCount = 0;
    _activeKeysScratch.clear();

    const maxVisibleMeters = (MAX_VISIBLE_RADIUS_TILES + 4) * CAPYTORIO_TILE_SIZE;

    for (const [k, m] of engine.machines) {
      const wx = capytorioGridToWorldX(m.gx);
      const wz = capytorioGridToWorldZ(m.gz);
      if (Math.abs(wx - camX) > maxVisibleMeters || Math.abs(wz - camZ) > maxVisibleMeters) {
        continue;
      }

      if (m.type === 'belt') {
        if (beltCount < MAX_BELT_INSTANCES) {
          const rotY = dirToRotY(m.dir);
          _dummy.position.set(wx, 0.08, wz);
          _dummy.rotation.set(0, rotY, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          this.beltBaseInstanced.setMatrixAt(beltCount, _dummy.matrix);

          // Offset directional chevron gently along belt flow direction
          const slide = (this.lastBeltScrollPhase - 0.5) * 0.42;
          _dummy.position.set(
            wx + DIR_DX[m.dir] * slide,
            0.21,
            wz + DIR_DZ[m.dir] * slide
          );
          _dummy.rotation.set(0, rotY, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          this.beltChevronInstanced.setMatrixAt(beltCount, _dummy.matrix);
          beltCount++;
        }
      } else {
        _activeKeysScratch.add(k);
        let group = this.activeMachineGroups.get(k);
        if (!group || group.userData.machineType !== m.type) {
          if (group) {
            this.releaseMachineGroup(group.userData.machineType as CapytorioMachineType, group);
          }
          group = this.acquireMachineGroup(m.type);
          group.userData.machineType = m.type;
          this.activeMachineGroups.set(k, group);
          this.root.add(group);
        }

        group.position.set(wx, 0, wz);
        group.rotation.y = dirToRotY(m.dir);

        // Zero-allocation mechanical animations
        if (m.type === 'drill' && group.userData.spinPart) {
          (group.userData.spinPart as THREE.Object3D).rotation.y =
            timeSec * 5.2 * engine.powerEfficiency;
        } else if (m.type === 'assembler') {
          const spin = timeSec * 3.4 * engine.getCraftSpeedMultiplier() * engine.powerEfficiency;
          if (group.userData.gearA) (group.userData.gearA as THREE.Object3D).rotation.y = spin;
          if (group.userData.gearB) (group.userData.gearB as THREE.Object3D).rotation.y = -spin * 1.3;
        } else if (m.type === 'generator') {
          if (group.userData.flywheel) {
            const genRate = m.fuelTimer > 0 ? 7.5 : 1.8;
            (group.userData.flywheel as THREE.Object3D).rotation.x = timeSec * genRate;
          }
          if (group.userData.fuelGlowMat) {
            const firebox = group.userData.fuelGlowMat as THREE.MeshStandardMaterial;
            firebox.emissiveIntensity =
              m.fuelTimer > 0 ? 1.55 + Math.sin(timeSec * 8.0) * 0.35 : 0.18;
          }
        } else if (m.type === 'lab' && group.userData.spinPart) {
          const core = group.userData.spinPart as THREE.Object3D;
          core.rotation.y = timeSec * (m.craftProgress > 0.01 ? 4.8 : 2.4);
          core.position.y = 1.25 + Math.sin(timeSec * 3.2) * 0.08;
          if (group.userData.labCoreMat) {
            (group.userData.labCoreMat as THREE.MeshStandardMaterial).emissiveIntensity =
              m.craftProgress > 0.01 ? 1.85 : 0.85;
          }
        } else if (m.type === 'inserter' && group.userData.turret) {
          const turret = group.userData.turret as THREE.Object3D;
          // Swing smoothly from rear (+Z = PI) to front (-Z = 0)
          turret.rotation.y = (1.0 - m.armSwing) * Math.PI;
          const heldMesh = group.userData.heldMesh as THREE.Mesh | undefined;
          const heldMat = group.userData.heldMat as THREE.MeshStandardMaterial | undefined;
          if (heldMesh && heldMat) {
            if (m.holdingItem) {
              heldMesh.visible = true;
              heldMat.color.setHex(getCapytorioItemMeta(m.holdingItem).colorHex);
            } else {
              heldMesh.visible = false;
            }
          }
        } else if (m.type === 'furnace' && group.userData.glowMat) {
          const glow = group.userData.glowMat as THREE.MeshStandardMaterial;
          glow.emissiveIntensity = m.craftProgress > 0.01 ? 1.55 : 0.45;
        }
      }

      // Render items riding on belts / splitters / tunnels
      for (let bi = 0; bi < m.beltItems.length && itemCount < MAX_ITEM_INSTANCES; bi++) {
        const bItem = m.beltItems[bi];
        const offsetAlong = (bItem.progress - 0.5) * CAPYTORIO_TILE_SIZE;
        _dummy.position.set(
          wx + DIR_DX[m.dir] * offsetAlong,
          0.34,
          wz + DIR_DZ[m.dir] * offsetAlong
        );
        _dummy.rotation.set(0, dirToRotY(m.dir), 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.itemInstanced.setMatrixAt(itemCount, _dummy.matrix);
        _color.setHex(getCapytorioItemMeta(bItem.item).colorHex);
        this.itemInstanced.setColorAt(itemCount, _color);
        itemCount++;
      }
    }

    // Release out-of-range or demolished composite machine groups back to pool
    for (const [k, group] of this.activeMachineGroups) {
      if (!_activeKeysScratch.has(k)) {
        this.releaseMachineGroup(group.userData.machineType as CapytorioMachineType, group);
        this.activeMachineGroups.delete(k);
      }
    }

    this.beltBaseInstanced.count = beltCount;
    this.beltBaseInstanced.instanceMatrix.needsUpdate = true;
    this.beltChevronInstanced.count = beltCount;
    this.beltChevronInstanced.instanceMatrix.needsUpdate = true;
    this.itemInstanced.count = itemCount;
    this.itemInstanced.instanceMatrix.needsUpdate = true;
    if (this.itemInstanced.instanceColor) this.itemInstanced.instanceColor.needsUpdate = true;

    // 4. Update Cursor Hover Tile & Directional Ghost Preview
    const hWx = capytorioGridToWorldX(engine.hoveredGx);
    const hWz = capytorioGridToWorldZ(engine.hoveredGz);
    this.cursorGroup.position.set(hWx, 0.01, hWz);
    this.cursorGroup.rotation.y = dirToRotY(engine.selectedDir);
    if (engine.selectedTool === 'demolish') {
      this.cursorFrameMat.color.setHex(0xef4444);
      this.cursorFrameMat.emissive.setHex(0xdc2626);
      this.ghostArrowMesh.visible = false;
    } else if (engine.selectedTool === 'mine') {
      this.cursorFrameMat.color.setHex(0xfacc15);
      this.cursorFrameMat.emissive.setHex(0xca8a04);
      this.ghostArrowMesh.visible = false;
    } else {
      const validDrill =
        engine.selectedTool !== 'drill' ||
        engine.getResourceAt(engine.hoveredGx, engine.hoveredGz) !== null;
      this.cursorFrameMat.color.setHex(validDrill ? 0x22c55e : 0xef4444);
      this.cursorFrameMat.emissive.setHex(validDrill ? 0x16a34a : 0xb91c1c);
      this.ghostArrowMesh.visible = true;
    }

    // 5. Inspected Machine Selection Halo
    if (engine.inspectedKey) {
      const insp = engine.machines.get(engine.inspectedKey);
      if (insp) {
        this.inspectRingMesh.visible = true;
        this.inspectRingMesh.position.set(
          capytorioGridToWorldX(insp.gx),
          0.05,
          capytorioGridToWorldZ(insp.gz)
        );
      } else {
        this.inspectRingMesh.visible = false;
      }
    } else {
      this.inspectRingMesh.visible = false;
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.sharedGeometries.length; i++) {
      this.sharedGeometries[i].dispose();
    }
    for (let i = 0; i < this.sharedMaterials.length; i++) {
      this.sharedMaterials[i].dispose();
    }
    this.activeMachineGroups.clear();
    this.inactivePoolByType.clear();
  }
}
