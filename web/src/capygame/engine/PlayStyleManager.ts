import * as THREE from 'three';
import { CapyModelGenerator, CapyMeshGroup } from './CapyModelGenerator';
import { LiveModeTelemetry, PlayStyle, PlayerStats } from '../types';
import { AudioService } from '../services/AudioService';
import { ProgressionService } from '../services/ProgressionService';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Pre-allocated math helpers for zero per-frame garbage collection
const _tempVec3 = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();

export interface GameEventCallbacks {
  onRewardEarned: (coins: number, dna: number, mode: PlayStyle, score: number) => void;
  onTelemetryUpdate: (telemetry: LiveModeTelemetry) => void;
  onModeNotification?: (msg: string) => void;
  onPortalEntered?: (targetMode: PlayStyle) => void;
}

export class PlayStyleManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public readonly isSoftwareGl: boolean;

  public currentMode: PlayStyle = 'sanctuary';
  private stats: PlayerStats;
  private callbacks: GameEventCallbacks;
  private telemetryTimer: number = 0;

  // Mode scene groups
  private sanctuaryGroup = new THREE.Group();
  private sporeGroup = new THREE.Group();
  private breakoutGroup = new THREE.Group();
  private runnerGroup = new THREE.Group();
  private fallGuysGroup = new THREE.Group();

  // Hero Capybara
  public heroCapy: CapyMeshGroup;
  private heroVelocity = new THREE.Vector3();
  private isGrounded: boolean = true;
  private baseHeroSpeed: number = 8.0;

  // Unified Input State (Keyboard + Touch D-pad + Pointer Drag)
  public moveInput = { x: 0, z: 0 };
  public pointerTargetX: number | null = null;
  public isJumping: boolean = false;

  // --- 1. Sanctuary State ---
  private sanctuaryCapys: Array<{
    capy: CapyMeshGroup;
    target: THREE.Vector3;
    stateTimer: number;
  }> = [];
  private sanctuaryFruits: Array<{
    mesh: THREE.Mesh;
    baseY: number;
    phase: number;
  }> = [];
  private sanctuaryPortals: Array<{
    mesh: THREE.Group;
    mode: PlayStyle;
    x: number;
    z: number;
  }> = [];
  private portalCooldown: number = 0;

  // --- 2. Spore Evolution State ---
  private sporeMass: number = 10;
  private sporeEpoch: number = 1;
  private sporeDnaEarned: number = 0;
  private sporeOrbs: Array<{
    mesh: THREE.Mesh;
    isDna: boolean;
    value: number;
  }> = [];
  private sporeCritters: Array<{
    mesh: CapyMeshGroup;
    scale: number;
    vel: THREE.Vector3;
    changeDirTimer: number;
  }> = [];
  private sporeDashCooldown: number = 0;

  // --- 3. Breakout State ---
  private breakoutPaddle: THREE.Mesh | null = null;
  private breakoutBalls: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    active: boolean;
  }> = [];
  private breakoutBlocks: Array<{
    mesh: THREE.Mesh;
    hp: number;
    isBonus: boolean;
  }> = [];
  private breakoutPowerups: Array<{
    mesh: THREE.Mesh;
    type: 'multiball' | 'wide';
  }> = [];
  private breakoutScore: number = 0;
  private breakoutWave: number = 1;
  private breakoutCombo: number = 1;
  private paddleWidthMultiplier: number = 1.0;

  // --- 4. Runner State ---
  private runnerHerdMeshes: CapyMeshGroup[] = [];
  private runnerTrackSegments: THREE.Group[] = [];
  private runnerDistance: number = 0;
  private runnerCapyCount: number = 1;
  private runnerWave: number = 1;
  private runnerSpeed: number = 15.0;
  private runnerGates: Array<{
    mesh: THREE.Group;
    type: 'add' | 'multiply' | 'sub';
    value: number;
    z: number;
    triggered: boolean;
  }> = [];
  private runnerBarrels: Array<{
    mesh: THREE.Mesh;
    z: number;
    smashed: boolean;
  }> = [];

  // --- 5. Fall Guys State ---
  private fallGuysCrowns: number = 0;
  private fallGuysRound: number = 1;
  private spinningObstacles: Array<{ mesh: THREE.Mesh; speed: number }> = [];
  private seeSaws: Array<{ mesh: THREE.Mesh; phase: number }> = [];
  private fallGuysRivals: Array<{
    capy: CapyMeshGroup;
    speed: number;
    laneOffset: number;
    vy: number;
  }> = [];

  constructor(
    container: HTMLElement,
    initialStats: PlayerStats,
    callbacks: GameEventCallbacks
  ) {
    this.stats = initialStats;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6ee7b7);
    this.scene.fog = new THREE.Fog(0x6ee7b7, 28, 105);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 220);
    this.camera.position.set(0, 7.5, 11);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // 3. Studio Environment & Warm/Cool Lighting Rig
    if (!this.isSoftwareGl) {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x334155, 0.95);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffedd5, 1.35);
    dirLight.position.set(22, 38, 18);
    dirLight.castShadow = !this.isSoftwareGl;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 110;
    const d = 28;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Rim light for crisp 3D silhouettes
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-18, 12, -20);
    this.scene.add(rimLight);

    // 4. Hero Capybara
    this.heroCapy = CapyModelGenerator.createCapybara(
      this.stats.activeHat,
      1.0,
      this.stats.activeSkin,
      this.stats.activeMutations
    );
    this.scene.add(this.heroCapy);

    // 5. Mode Groups
    this.scene.add(this.sanctuaryGroup);
    this.scene.add(this.sporeGroup);
    this.scene.add(this.breakoutGroup);
    this.scene.add(this.runnerGroup);
    this.scene.add(this.fallGuysGroup);

    // Build all 5 procedural worlds
    this.buildSanctuary();
    this.buildSporeWorld();
    this.buildBreakout();
    this.buildRunner();
    this.buildFallGuys();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.switchMode(this.stats.selectedPlayStyle);
  }

  public switchMode(mode: PlayStyle) {
    this.currentMode = mode;
    this.sanctuaryGroup.visible = mode === 'sanctuary';
    this.sporeGroup.visible = mode === 'spore';
    this.breakoutGroup.visible = mode === 'breakout';
    this.runnerGroup.visible = mode === 'runner';
    this.fallGuysGroup.visible = mode === 'fallguys';

    this.heroVelocity.set(0, 0, 0);
    this.pointerTargetX = null;
    this.heroCapy.scale.setScalar(1.0);
    this.heroCapy.rotation.set(0, 0, 0);
    this.portalCooldown = 2.0;

    if (mode === 'sanctuary') {
      this.heroCapy.visible = true;
      this.heroCapy.position.set(0, 0, 4);
      this.camera.position.set(0, 7.5, 15.5);
      this.camera.lookAt(0, 1.0, 2);
      this.scene.background = new THREE.Color(0x6ee7b7);
      this.scene.fog = new THREE.Fog(0x6ee7b7, 30, 105);
      this.callbacks.onModeNotification?.(
        'Sanctuary Island: Walk into any 3D Portal or build your paradise!'
      );
    } else if (mode === 'spore') {
      this.heroCapy.visible = true;
      this.heroCapy.position.set(0, 0, 0);
      this.camera.position.set(0, 10.5, 13.5);
      this.camera.lookAt(0, 0.8, 0);
      this.scene.background = new THREE.Color(0x0284c7);
      this.scene.fog = new THREE.Fog(0x0284c7, 25, 95);
      this.resetSporeGame();
      this.callbacks.onModeNotification?.(
        'Spore Lagoon: Eat Yuzu Plankton & DNA Helixes to grow & evolve!'
      );
    } else if (mode === 'breakout') {
      this.heroCapy.visible = false;
      this.camera.position.set(0, 16.5, 14.5);
      this.camera.lookAt(0, 0, -2);
      this.scene.background = new THREE.Color(0x0f172a);
      this.scene.fog = new THREE.Fog(0x0f172a, 30, 85);
      this.resetBreakoutGame(true);
      this.callbacks.onModeNotification?.(
        'Yuzu Breakout: Drag or steer paddle to smash endless crystal waves!'
      );
    } else if (mode === 'runner') {
      this.heroCapy.visible = true;
      this.heroCapy.position.set(0, 0, 0);
      this.heroCapy.rotation.y = Math.PI;
      this.camera.position.set(0, 6.8, 10.5);
      this.camera.lookAt(0, 1.0, -8);
      this.scene.background = new THREE.Color(0xfde047);
      this.scene.fog = new THREE.Fog(0xfde047, 35, 115);
      this.resetRunnerGame();
      this.callbacks.onModeNotification?.(
        'Number Stampede: Steer through + and × gates to multiply your 3D herd!'
      );
    } else if (mode === 'fallguys') {
      this.heroCapy.visible = true;
      this.heroCapy.position.set(0, 0.6, 0);
      this.heroCapy.rotation.y = Math.PI;
      this.camera.position.set(0, 6.8, 10.2);
      this.camera.lookAt(0, 1.6, -6);
      this.scene.background = new THREE.Color(0xf9a8d4);
      this.scene.fog = new THREE.Fog(0xf9a8d4, 30, 110);
      this.resetFallGuysGame(false);
      this.callbacks.onModeNotification?.(
        'Chaos Parkour: Race rival Capys past windmills & see-saws to the Crown!'
      );
    }

    this.emitTelemetry();
    this.tick(0.016);
  }

  public updateStats(newStats: PlayerStats) {
    this.stats = newStats;
    CapyModelGenerator.updateCapyAppearance(
      this.heroCapy,
      newStats.activeHat,
      newStats.activeSkin,
      newStats.activeMutations
    );
  }

  private getEffectiveSpeedMultiplier(): number {
    const upgBonus = (this.stats.upgrades.speedBoost - 1) * 0.15;
    const { speedBonus } = ProgressionService.getMutationBonuses(this.stats);
    return 1 + upgBonus + speedBonus;
  }

  private getEffectiveMagnetRadius(): number {
    const base = 2.2 + (this.stats.upgrades.coinMagnet - 1) * 0.9;
    const { magnetBonus } = ProgressionService.getMutationBonuses(this.stats);
    return base * (1 + magnetBonus);
  }

  // ============================================================================
  // 1. SANCTUARY WORLD BUILDER & 3D PORTAL HUB
  // ============================================================================
  private buildSanctuary() {
    // Ocean water expanse around the island
    const ocean = new THREE.Mesh(
      new THREE.CylinderGeometry(85, 85, 0.5, 32),
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        roughness: 0.15,
        metalness: 0.2,
      })
    );
    ocean.position.set(0, -1.2, 0);
    this.sanctuaryGroup.add(ocean);

    // Sandy beach ring
    const beach = new THREE.Mesh(
      new THREE.CylinderGeometry(24.5, 26, 1.5, 36),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 })
    );
    beach.position.set(0, -0.9, 0);
    beach.receiveShadow = true;
    this.sanctuaryGroup.add(beach);

    // Main emerald pasture island
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(22.5, 19, 4, 36),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.78 })
    );
    island.position.set(0, -2, 0);
    island.receiveShadow = true;
    this.sanctuaryGroup.add(island);

    // Instanced decorative meadow flowers & pebbles (>20 instances via InstancedMesh)
    const pebbleGeo = new THREE.DodecahedronGeometry(0.22);
    const pebbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const instancedDecor = new THREE.InstancedMesh(pebbleGeo, pebbleMat, 48);
    const palette = [0xfef08a, 0xf472b6, 0x93c5fd, 0xd8b4fe, 0xe2e8f0];
    const colorHelper = new THREE.Color();

    for (let i = 0; i < 48; i++) {
      const r = 3 + (i / 48) * 17.5;
      const theta = i * 2.39996; // Golden angle distribution
      _dummyObj.position.set(Math.cos(theta) * r, 0.05, Math.sin(theta) * r);
      _dummyObj.scale.setScalar(0.75 + (i % 5) * 0.12);
      _dummyObj.rotation.set(0, theta, 0);
      _dummyObj.updateMatrix();
      instancedDecor.setMatrixAt(i, _dummyObj.matrix);
      colorHelper.setHex(palette[i % palette.length]);
      instancedDecor.setColorAt(i, colorHelper);
    }
    instancedDecor.instanceMatrix.needsUpdate = true;
    if (instancedDecor.instanceColor) instancedDecor.instanceColor.needsUpdate = true;
    instancedDecor.computeBoundingSphere();
    this.sanctuaryGroup.add(instancedDecor);

    // 4 Interactive 3D World Portals along the Northern & Side Rim
    const portalSpecs: Array<{
      mode: PlayStyle;
      title: string;
      sub: string;
      color: number;
      accent: string;
      x: number;
      z: number;
      rotY: number;
    }> = [
      {
        mode: 'spore',
        title: 'SPORE',
        sub: 'EVOLVE & DNA',
        color: 0x06b6d4,
        accent: '#22d3ee',
        x: -14,
        z: -11,
        rotY: Math.PI / 5,
      },
      {
        mode: 'breakout',
        title: 'BREAKOUT',
        sub: 'YUZU ARCADE',
        color: 0x3b82f6,
        accent: '#60a5fa',
        x: -5,
        z: -16,
        rotY: Math.PI / 14,
      },
      {
        mode: 'runner',
        title: 'STAMPEDE',
        sub: 'MATH RUNNER',
        color: 0xf59e0b,
        accent: '#fbbf24',
        x: 5,
        z: -16,
        rotY: -Math.PI / 14,
      },
      {
        mode: 'fallguys',
        title: 'PARKOUR',
        sub: 'CROWN CHAOS',
        color: 0xec4899,
        accent: '#f472b6',
        x: 14,
        z: -11,
        rotY: -Math.PI / 5,
      },
    ];

    for (const p of portalSpecs) {
      const portalMesh = CapyModelGenerator.createWorldPortal(p.title, p.sub, p.color, p.accent);
      portalMesh.position.set(p.x, 0, p.z);
      portalMesh.rotation.y = p.rotY;
      this.sanctuaryGroup.add(portalMesh);
      this.sanctuaryPortals.push({
        mesh: portalMesh,
        mode: p.mode,
        x: p.x,
        z: p.z,
      });
    }

    // Spawn collectible Golden Yuzu fruits around the island
    const yuzuGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const yuzuMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
      roughness: 0.25,
    });
    for (let i = 0; i < 8; i++) {
      const fruit = new THREE.Mesh(yuzuGeo, yuzuMat);
      const angle = (i / 8) * Math.PI * 2;
      fruit.position.set(Math.cos(angle) * 9, 0.35, Math.sin(angle) * 9);
      fruit.castShadow = true;
      this.sanctuaryGroup.add(fruit);
      this.sanctuaryFruits.push({
        mesh: fruit,
        baseY: 0.35,
        phase: i * 0.9,
      });
    }

    // Ambient wandering Capybara buddies
    const skins = ['classic', 'golden', 'sakura', 'matcha'];
    const hats = ['flower', 'yuzu', 'party', 'crown'];
    for (let i = 0; i < 6; i++) {
      const buddy = CapyModelGenerator.createCapybara(
        hats[i % hats.length],
        0.82,
        skins[i % skins.length]
      );
      const angle = (i / 6) * Math.PI * 2;
      buddy.position.set(Math.cos(angle) * 7, 0, Math.sin(angle) * 7);
      this.sanctuaryGroup.add(buddy);
      this.sanctuaryCapys.push({
        capy: buddy,
        target: new THREE.Vector3(Math.cos(angle) * 5, 0, Math.sin(angle) * 5),
        stateTimer: Math.random() * 4,
      });
    }

    this.refreshSanctuaryBuildings();
  }

  public refreshSanctuaryBuildings() {
    const toRemove: THREE.Object3D[] = [];
    this.sanctuaryGroup.children.forEach((child) => {
      if (child.name.startsWith('building_')) toRemove.push(child);
    });
    toRemove.forEach((c) => this.sanctuaryGroup.remove(c));

    this.stats.buildings.forEach((b) => {
      const bMesh = CapyModelGenerator.createBuildingByType(b.type, b.level);
      bMesh.name = `building_${b.id}`;
      bMesh.position.set(b.x, 0, b.z);
      const levelScale = 1 + Math.min(0.5, (b.level - 1) * 0.08);
      bMesh.scale.setScalar(levelScale);
      this.sanctuaryGroup.add(bMesh);
    });
  }

  // ============================================================================
  // 2. SPORE EVOLUTION LAGOON (ENDLESS EAT, GROW & MUTATE)
  // ============================================================================
  private buildSporeWorld() {
    // Primordial Lagoon seabed floor
    const seabed = new THREE.Mesh(
      new THREE.CylinderGeometry(42, 42, 1, 36),
      new THREE.MeshStandardMaterial({
        color: 0x0369a1,
        roughness: 0.5,
        metalness: 0.15,
      })
    );
    seabed.position.set(0, -0.5, 0);
    seabed.receiveShadow = true;
    this.sporeGroup.add(seabed);

    // Coral & Lilypad Islands around the lagoon
    const coralMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.6 });
    const lilyMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const dist = 10 + (i % 3) * 8;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 16), lilyMat);
      pad.position.set(Math.cos(a) * dist, 0.08, Math.sin(a) * dist);
      this.sporeGroup.add(pad);

      if (i % 2 === 0) {
        const coral = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9), coralMat);
        coral.position.set(Math.cos(a) * dist, 0.65, Math.sin(a) * dist);
        this.sporeGroup.add(coral);
      }
    }

    this.resetSporeGame();
  }

  private resetSporeGame() {
    this.sporeMass = 10 + (this.stats.evolutionStage - 1) * 5;
    this.sporeEpoch = this.stats.evolutionStage;
    this.sporeDnaEarned = 0;

    // Clear existing orbs & critters
    this.sporeOrbs.forEach((o) => this.sporeGroup.remove(o.mesh));
    this.sporeOrbs = [];
    this.sporeCritters.forEach((c) => this.sporeGroup.remove(c.mesh));
    this.sporeCritters = [];

    // Spawn 28 Plankton & DNA Orbs
    for (let i = 0; i < 28; i++) {
      this.spawnSporeOrb();
    }

    // Spawn 8 AI Spore Critters of varying sizes
    const skins = ['matcha', 'sakura', 'cosmic', 'golden'];
    for (let i = 0; i < 8; i++) {
      const scale = 0.55 + (i % 4) * 0.32;
      const critter = CapyModelGenerator.createCapybara(
        i % 2 === 0 ? 'flower' : 'yuzu',
        scale,
        skins[i % skins.length],
        ['flippers']
      );
      const angle = (i / 8) * Math.PI * 2;
      const rad = 8 + Math.random() * 18;
      critter.position.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad);
      this.sporeGroup.add(critter);
      this.sporeCritters.push({
        mesh: critter,
        scale,
        vel: new THREE.Vector3((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5),
        changeDirTimer: 2 + Math.random() * 3,
      });
    }
  }

  private spawnSporeOrb() {
    const isDna = Math.random() > 0.62;
    const mesh = new THREE.Mesh(
      isDna
        ? new THREE.OctahedronGeometry(0.38, 1)
        : new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({
        color: isDna ? 0x38bdf8 : 0xfacc15,
        emissive: isDna ? 0x0284c7 : 0xca8a04,
        emissiveIntensity: 0.55,
        roughness: 0.2,
      })
    );
    const angle = Math.random() * Math.PI * 2;
    const rad = 2 + Math.random() * 30;
    mesh.position.set(Math.cos(angle) * rad, 0.45, Math.sin(angle) * rad);
    this.sporeGroup.add(mesh);
    this.sporeOrbs.push({
      mesh,
      isDna,
      value: isDna ? 3 : 5,
    });
  }

  // ============================================================================
  // 3. YUZU BREAKOUT (ENDLESS 3D ARCADE BUMPER)
  // ============================================================================
  private buildBreakout() {
    const arenaMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.6,
    });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.4, 23), arenaMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    this.breakoutGroup.add(floor);

    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 23), arenaMat);
    wallL.position.set(-8.6, 0.8, 0);
    this.breakoutGroup.add(wallL);

    const wallR = wallL.clone();
    wallR.position.x = 8.6;
    this.breakoutGroup.add(wallR);

    const wallTop = new THREE.Mesh(new THREE.BoxGeometry(18.0, 1.8, 0.8), arenaMat);
    wallTop.position.set(0, 0.8, -11.6);
    this.breakoutGroup.add(wallTop);

    const paddleGeo = new THREE.BoxGeometry(3.8, 0.8, 0.9);
    const paddleMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.45,
    });
    this.breakoutPaddle = new THREE.Mesh(paddleGeo, paddleMat);
    this.breakoutPaddle.position.set(0, 0.5, 9.2);
    this.breakoutPaddle.castShadow = true;
    this.breakoutGroup.add(this.breakoutPaddle);

    const paddleCapy = CapyModelGenerator.createCapybara('yuzu', 0.58);
    paddleCapy.position.set(0, 0.42, 0);
    paddleCapy.rotation.y = Math.PI;
    this.breakoutPaddle.add(paddleCapy);

    this.resetBreakoutGame(true);
  }

  private spawnBreakoutBall(x: number, z: number, vx: number, vz: number) {
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffbb00,
        roughness: 0.15,
        metalness: 0.3,
        emissive: 0x78350f,
      })
    );
    ballMesh.position.set(x, 0.5, z);
    ballMesh.castShadow = true;
    this.breakoutGroup.add(ballMesh);
    this.breakoutBalls.push({
      mesh: ballMesh,
      vel: new THREE.Vector3(vx, 0, vz),
      active: true,
    });
  }

  private resetBreakoutGame(fullReset: boolean = false) {
    if (fullReset) {
      this.breakoutScore = 0;
      this.breakoutWave = 1;
      this.breakoutCombo = 1;
    }

    this.breakoutBlocks.forEach((b) => this.breakoutGroup.remove(b.mesh));
    this.breakoutBlocks = [];
    this.breakoutBalls.forEach((b) => this.breakoutGroup.remove(b.mesh));
    this.breakoutBalls = [];
    this.breakoutPowerups.forEach((p) => this.breakoutGroup.remove(p.mesh));
    this.breakoutPowerups = [];

    const speedScale = 1 + (this.breakoutWave - 1) * 0.08;
    this.spawnBreakoutBall(0, 6.5, 4.2 * speedScale, -9.2 * speedScale);

    const blockColors = [0xef4444, 0xf97316, 0xeab308, 0x10b981, 0x06b6d4, 0x8b5cf6];
    const rows = Math.min(7, 4 + Math.floor(this.breakoutWave / 2));
    const cols = 7;
    const blockW = 2.0;
    const blockD = 0.95;
    const startX = -((cols - 1) * blockW) / 2;
    const startZ = -9.5;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Procedural pattern variation based on wave
        if (this.breakoutWave % 2 === 0 && (r + c) % 5 === 0) continue;
        const isBonus = (r === 0 && c === 3) || Math.random() > 0.86;
        const hp = isBonus ? 2 : 1;
        const mat = new THREE.MeshStandardMaterial({
          color: isBonus ? 0xfacc15 : blockColors[r % blockColors.length],
          roughness: 0.22,
          metalness: isBonus ? 0.75 : 0.3,
        });
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(blockW - 0.18, 0.7, blockD - 0.18),
          mat
        );
        block.position.set(startX + c * blockW, 0.5, startZ + r * blockD);
        block.castShadow = true;
        this.breakoutGroup.add(block);
        this.breakoutBlocks.push({ mesh: block, hp, isBonus });
      }
    }
  }

  // ============================================================================
  // 4. NUMBER RUNNER STAMPEDE (READABLE MATH GATES + VISIBLE 3D HERD)
  // ============================================================================
  private buildRunner() {
    this.resetRunnerGame();
  }

  private resetRunnerGame() {
    this.runnerDistance = 0;
    this.runnerCapyCount = this.stats.upgrades.herdSize;
    this.runnerWave = 1;

    this.runnerTrackSegments.forEach((s) => this.runnerGroup.remove(s));
    this.runnerTrackSegments = [];
    this.runnerGates.forEach((g) => this.runnerGroup.remove(g.mesh));
    this.runnerGates = [];
    this.runnerBarrels.forEach((b) => this.runnerGroup.remove(b.mesh));
    this.runnerBarrels = [];
    this.runnerHerdMeshes.forEach((m) => this.runnerGroup.remove(m));
    this.runnerHerdMeshes = [];

    for (let i = 0; i < 8; i++) {
      this.spawnRunnerTrackSegment(-i * 24);
    }

    this.syncRunnerHerdVisuals();
  }

  private syncRunnerHerdVisuals() {
    // Render up to 22 visual companion Capybaras around the hero
    const desiredVisualCount = Math.min(22, Math.max(0, this.runnerCapyCount - 1));
    while (this.runnerHerdMeshes.length < desiredVisualCount) {
      const idx = this.runnerHerdMeshes.length;
      const mini = CapyModelGenerator.createCapybara(
        idx % 3 === 0 ? 'yuzu' : 'flower',
        0.58,
        idx % 4 === 0 ? 'golden' : 'classic'
      );
      mini.rotation.y = Math.PI;
      this.runnerGroup.add(mini);
      this.runnerHerdMeshes.push(mini);
    }
    while (this.runnerHerdMeshes.length > desiredVisualCount) {
      const removed = this.runnerHerdMeshes.pop()!;
      this.runnerGroup.remove(removed);
    }
  }

  private spawnRunnerTrackSegment(zPos: number) {
    const segment = new THREE.Group();
    segment.position.set(0, 0, zPos);

    const track = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 0.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55 })
    );
    track.position.set(0, -0.2, 0);
    track.receiveShadow = true;
    segment.add(track);

    // Golden side rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 24), railMat);
    railL.position.set(-4.5, 0.1, 0);
    const railR = railL.clone();
    railR.position.x = 4.5;
    segment.add(railL, railR);

    this.runnerGroup.add(segment);
    this.runnerTrackSegments.push(segment);

    if (Math.abs(zPos) > 16) {
      this.spawnRunnerGatePair(zPos);
    }
  }

  private spawnRunnerGatePair(zPos: number) {
    // Spawn left & right math gate choices with readable CanvasTexture banners
    const sides = [-2.1, 2.1];
    for (const xPos of sides) {
      const roll = Math.random();
      let type: 'add' | 'multiply' | 'sub' = 'add';
      let value = Math.floor(Math.random() * 7) + 3;
      if (roll > 0.62) {
        type = 'multiply';
        value = Math.random() > 0.7 ? 3 : 2;
      } else if (roll < 0.18 && xPos > 0) {
        type = 'sub';
        value = Math.floor(Math.random() * 4) + 2;
      }

      const labelText =
        type === 'multiply' ? `×${value}` : type === 'add' ? `+${value}` : `-${value}`;
      const subText =
        type === 'multiply' ? 'MULTIPLY HERD' : type === 'add' ? 'ADD CAPYS' : 'HAZARD';
      const bgHex =
        type === 'multiply' ? '#065f46' : type === 'add' ? '#1e3a8a' : '#7f1d1d';
      const accentHex =
        type === 'multiply' ? '#34d399' : type === 'add' ? '#60a5fa' : '#f87171';

      const gateGroup = new THREE.Group();
      gateGroup.position.set(xPos, 0, zPos);

      const bannerTex = CapyModelGenerator.createTextBannerTexture(
        labelText,
        subText,
        bgHex,
        accentHex
      );
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 2.5, 0.18),
        new THREE.MeshBasicMaterial({ map: bannerTex })
      );
      panel.position.set(0, 1.4, 0);
      gateGroup.add(panel);

      this.runnerGroup.add(gateGroup);
      this.runnerGates.push({
        mesh: gateGroup,
        type,
        value,
        z: zPos,
        triggered: false,
      });
    }
  }

  // ============================================================================
  // 5. FALL GUYS CHAOS PARKOUR (ENDLESS OBSTACLE ROUNDS + AI RIVALS)
  // ============================================================================
  private buildFallGuys() {
    this.resetFallGuysGame(true);
  }

  private resetFallGuysGame(resetRound: boolean = false) {
    if (resetRound) {
      this.fallGuysCrowns = 0;
      this.fallGuysRound = 1;
    }

    while (this.fallGuysGroup.children.length > 0) {
      this.fallGuysGroup.remove(this.fallGuysGroup.children[0]);
    }
    this.spinningObstacles = [];
    this.seeSaws = [];
    this.fallGuysRivals = [];

    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.4 });
    const cyanMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.35 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25 });

    // Start Platform
    const startPlat = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 12), pinkMat);
    startPlat.position.set(0, 0, 0);
    startPlat.receiveShadow = true;
    this.fallGuysGroup.add(startPlat);

    // Stage 1: Twin Spinning Windmill Sweepers
    const plat2 = new THREE.Mesh(new THREE.BoxGeometry(11, 1, 18), cyanMat);
    plat2.position.set(0, 0, -16);
    plat2.receiveShadow = true;
    this.fallGuysGroup.add(plat2);

    for (const zOff of [-12, -20]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 16), yellowMat);
      post.position.set(0, 1.5, zOff);
      this.fallGuysGroup.add(post);

      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(9.5, 0.75, 0.75),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
      );
      bar.position.set(0, 1.15, zOff);
      bar.castShadow = true;
      this.fallGuysGroup.add(bar);
      this.spinningObstacles.push({
        mesh: bar,
        speed: (zOff === -12 ? 1 : -1) * (2.2 + this.fallGuysRound * 0.25),
      });
    }

    // Stage 2: Tilting See-Saw Bridge
    const seeSaw = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 12), yellowMat);
    seeSaw.position.set(0, 0.2, -33);
    seeSaw.castShadow = true;
    this.fallGuysGroup.add(seeSaw);
    this.seeSaws.push({ mesh: seeSaw, phase: 0 });

    // Stage 3: Bouncy Trampoline Pad Platform
    const plat3 = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 5.5, 1, 24),
      new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.25 })
    );
    plat3.position.set(0, 0, -46);
    this.fallGuysGroup.add(plat3);

    // Stage 4: Final Crown Finish Arena
    const finishPlat = new THREE.Mesh(
      new THREE.BoxGeometry(12, 1, 12),
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 })
    );
    finishPlat.position.set(0, 0, -60);
    this.fallGuysGroup.add(finishPlat);

    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.3, 1.6, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.12,
      })
    );
    crown.position.set(0, 2.4, -60);
    this.fallGuysGroup.add(crown);

    // Spawn 5 AI Rival Capybaras racing alongside the player
    const rivalSkins = ['sakura', 'matcha', 'golden', 'cosmic', 'classic'];
    const rivalHats = ['party', 'wizard', 'flower', 'crown', 'yuzu'];
    for (let i = 0; i < 5; i++) {
      const rival = CapyModelGenerator.createCapybara(
        rivalHats[i],
        0.92,
        rivalSkins[i]
      );
      const laneX = (i - 2) * 1.9;
      rival.position.set(laneX, 0.6, 1.5);
      rival.rotation.y = Math.PI;
      this.fallGuysGroup.add(rival);
      this.fallGuysRivals.push({
        capy: rival,
        speed: 5.8 + Math.random() * 2.4,
        laneOffset: laneX,
        vy: 0,
      });
    }
  }

  // ============================================================================
  // PER-FRAME GAME LOOP
  // ============================================================================
  public tick(delta: number) {
    const dt = Math.min(delta, 0.1);
    if (this.portalCooldown > 0) this.portalCooldown -= dt;

    if (this.currentMode === 'sanctuary') {
      this.tickSanctuary(dt);
    } else if (this.currentMode === 'spore') {
      this.tickSpore(dt);
    } else if (this.currentMode === 'breakout') {
      this.tickBreakout(dt);
    } else if (this.currentMode === 'runner') {
      this.tickRunner(dt);
    } else if (this.currentMode === 'fallguys') {
      this.tickFallGuys(dt);
    }

    this.telemetryTimer += dt;
    if (this.telemetryTimer >= 0.25) {
      this.telemetryTimer = 0;
      this.emitTelemetry();
    }

    this.renderer.render(this.scene, this.camera);
  }

  private emitTelemetry() {
    const mult = Math.round(ProgressionService.getGlobalMultiplier(this.stats) * 10) / 10;
    if (this.currentMode === 'sanctuary') {
      this.callbacks.onTelemetryUpdate({
        mode: 'sanctuary',
        primaryLabel: 'Structures',
        primaryValue: this.stats.buildings.length,
        secondaryLabel: 'Portals Active',
        secondaryValue: 4,
        comboMultiplier: mult,
      });
    } else if (this.currentMode === 'spore') {
      this.callbacks.onTelemetryUpdate({
        mode: 'spore',
        primaryLabel: 'Spore Mass',
        primaryValue: `${Math.round(this.sporeMass)} kg`,
        secondaryLabel: 'DNA Harvested',
        secondaryValue: `+${this.sporeDnaEarned}`,
        comboMultiplier: mult,
      });
    } else if (this.currentMode === 'breakout') {
      this.callbacks.onTelemetryUpdate({
        mode: 'breakout',
        primaryLabel: 'Score',
        primaryValue: this.breakoutScore.toLocaleString(),
        secondaryLabel: 'Endless Wave',
        secondaryValue: `Wave ${this.breakoutWave}`,
        comboMultiplier: this.breakoutCombo,
      });
    } else if (this.currentMode === 'runner') {
      this.callbacks.onTelemetryUpdate({
        mode: 'runner',
        primaryLabel: 'Capy Herd',
        primaryValue: `${this.runnerCapyCount} Capys`,
        secondaryLabel: 'Distance',
        secondaryValue: `${Math.round(this.runnerDistance)}m`,
        comboMultiplier: mult,
      });
    } else if (this.currentMode === 'fallguys') {
      this.callbacks.onTelemetryUpdate({
        mode: 'fallguys',
        primaryLabel: 'Crowns Won',
        primaryValue: this.fallGuysCrowns,
        secondaryLabel: 'Course Round',
        secondaryValue: `Round ${this.fallGuysRound}`,
        comboMultiplier: mult,
      });
    }
  }

  private animateCapyLegs(capy: CapyMeshGroup, dt: number, speedFactor: number = 12) {
    capy.userData.walkCycle += dt * speedFactor;
    const swing = Math.sin(capy.userData.walkCycle) * 0.48;
    capy.userData.legFL.rotation.x = swing;
    capy.userData.legBR.rotation.x = swing;
    capy.userData.legFR.rotation.x = -swing;
    capy.userData.legBL.rotation.x = -swing;
  }

  private resetCapyLegs(capy: CapyMeshGroup) {
    capy.userData.legFL.rotation.x = 0;
    capy.userData.legFR.rotation.x = 0;
    capy.userData.legBL.rotation.x = 0;
    capy.userData.legBR.rotation.x = 0;
  }

  // --- 1. SANCTUARY TICK ---
  private tickSanctuary(dt: number) {
    const speed = this.baseHeroSpeed * this.getEffectiveSpeedMultiplier();
    const moveX = this.moveInput.x * speed;
    const moveZ = this.moveInput.z * speed;

    this.heroCapy.position.x += moveX * dt;
    this.heroCapy.position.z += moveZ * dt;

    // Gravity & Jump in Sanctuary
    this.heroVelocity.y -= 24 * dt;
    this.heroCapy.position.y += this.heroVelocity.y * dt;
    if (this.heroCapy.position.y <= 0) {
      this.heroCapy.position.y = 0;
      this.heroVelocity.y = 0;
      this.isGrounded = true;
    }

    if (this.isJumping && this.isGrounded) {
      this.heroVelocity.y = 10.5 + (this.stats.upgrades.bounciness - 1) * 1.2;
      this.isGrounded = false;
      this.isJumping = false;
      AudioService.playJump();
    }

    // Clamp to island shoreline
    const dist = Math.hypot(this.heroCapy.position.x, this.heroCapy.position.z);
    if (dist > 22) {
      this.heroCapy.position.x = (this.heroCapy.position.x / dist) * 22;
      this.heroCapy.position.z = (this.heroCapy.position.z / dist) * 22;
    }

    if (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05) {
      this.heroCapy.rotation.y = Math.atan2(moveX, moveZ);
      this.animateCapyLegs(this.heroCapy, dt, 14);
    } else {
      this.resetCapyLegs(this.heroCapy);
    }

    // Check Bouncy Mushroom Pads in Sanctuary
    for (const b of this.stats.buildings) {
      if (b.type === 'trampoline_pad') {
        const dPad = Math.hypot(this.heroCapy.position.x - b.x, this.heroCapy.position.z - b.z);
        if (dPad < 2.0 && this.heroCapy.position.y < 1.5 && this.heroVelocity.y <= 0) {
          this.heroVelocity.y = 16.5;
          this.isGrounded = false;
          AudioService.playJump();
          this.callbacks.onRewardEarned(15 * b.level, 1, 'sanctuary', 0);
          this.callbacks.onModeNotification?.(
            `Mushroom Bounce! +${15 * b.level} Coins & +1 DNA!`
          );
        }
      }
    }

    // Magnetize & collect Golden Yuzu fruits
    const magnetRad = this.getEffectiveMagnetRadius();
    for (const f of this.sanctuaryFruits) {
      f.phase += dt * 3;
      f.mesh.position.y = f.baseY + Math.sin(f.phase) * 0.12;
      const df = Math.hypot(
        this.heroCapy.position.x - f.mesh.position.x,
        this.heroCapy.position.z - f.mesh.position.z
      );
      if (df < magnetRad) {
        _tempVec3.subVectors(this.heroCapy.position, f.mesh.position).normalize();
        f.mesh.position.addScaledVector(_tempVec3, 12 * dt);
      }
      if (df < 1.1) {
        AudioService.playCoin();
        this.callbacks.onRewardEarned(12, 1, 'sanctuary', 0);
        const angle = Math.random() * Math.PI * 2;
        const rad = 4 + Math.random() * 14;
        f.mesh.position.set(Math.cos(angle) * rad, f.baseY, Math.sin(angle) * rad);
      }
    }

    // Check if player walked into any of the 4 3D World Portals
    if (this.portalCooldown <= 0) {
      for (const portal of this.sanctuaryPortals) {
        const dp = Math.hypot(
          this.heroCapy.position.x - portal.x,
          this.heroCapy.position.z - portal.z
        );
        if (dp < 1.9) {
          AudioService.playPrestigeFanfare();
          this.callbacks.onPortalEntered?.(portal.mode);
          return;
        }
      }
    }

    // Smooth camera follow
    _camTarget.set(
      this.heroCapy.position.x,
      this.heroCapy.position.y + 7.5,
      this.heroCapy.position.z + 11.5
    );
    this.camera.position.lerp(_camTarget, 1 - Math.exp(-6 * dt));
    _lookTarget.set(this.heroCapy.position.x, 1.0, this.heroCapy.position.z - 2);
    this.camera.lookAt(_lookTarget);

    // Ambient Capybara buddies wandering
    for (const buddy of this.sanctuaryCapys) {
      buddy.stateTimer -= dt;
      if (buddy.stateTimer <= 0) {
        buddy.stateTimer = 4 + Math.random() * 5;
        const rad = 2 + Math.random() * 13;
        const ang = Math.random() * Math.PI * 2;
        buddy.target.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
      }
      _tempVec3.subVectors(buddy.target, buddy.capy.position);
      if (_tempVec3.length() > 0.35) {
        _tempVec3.normalize();
        buddy.capy.position.addScaledVector(_tempVec3, 2.1 * dt);
        buddy.capy.rotation.y = Math.atan2(_tempVec3.x, _tempVec3.z);
        this.animateCapyLegs(buddy.capy, dt, 7);
      } else {
        this.resetCapyLegs(buddy.capy);
      }
    }
  }

  // --- 2. SPORE EVOLUTION TICK ---
  private tickSpore(dt: number) {
    if (this.sporeDashCooldown > 0) this.sporeDashCooldown -= dt;

    let speed = this.baseHeroSpeed * 1.15 * this.getEffectiveSpeedMultiplier();
    if (this.isJumping && this.sporeDashCooldown <= 0) {
      this.sporeDashCooldown = 1.2;
      this.isJumping = false;
      AudioService.playChomp();
      speed *= 2.4;
      // Lunge forward in facing direction
      this.heroCapy.position.x += Math.sin(this.heroCapy.rotation.y) * 2.6;
      this.heroCapy.position.z += Math.cos(this.heroCapy.rotation.y) * 2.6;
    }

    const moveX = this.moveInput.x * speed;
    const moveZ = this.moveInput.z * speed;
    this.heroCapy.position.x = THREE.MathUtils.clamp(
      this.heroCapy.position.x + moveX * dt,
      -36,
      36
    );
    this.heroCapy.position.z = THREE.MathUtils.clamp(
      this.heroCapy.position.z + moveZ * dt,
      -36,
      36
    );

    // Scale Capybara dynamically with Spore Mass!
    const heroScale = Math.min(2.6, 0.85 + Math.log10(Math.max(10, this.sporeMass)) * 0.48);
    this.heroCapy.scale.setScalar(heroScale);

    if (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05) {
      this.heroCapy.rotation.y = Math.atan2(moveX, moveZ);
      this.animateCapyLegs(this.heroCapy, dt, 15);
    }

    // Magnetize & Eat Plankton / DNA Helixes
    const magnetRad = this.getEffectiveMagnetRadius() * heroScale;
    for (const orb of this.sporeOrbs) {
      orb.mesh.rotation.y += dt * 2.5;
      const d = Math.hypot(
        this.heroCapy.position.x - orb.mesh.position.x,
        this.heroCapy.position.z - orb.mesh.position.z
      );
      if (d < magnetRad) {
        _tempVec3.subVectors(this.heroCapy.position, orb.mesh.position).normalize();
        orb.mesh.position.addScaledVector(_tempVec3, 14 * dt);
      }
      if (d < 1.15 * heroScale) {
        this.sporeMass += orb.value;
        const dnaGain = orb.isDna ? 2 : 0;
        this.sporeDnaEarned += dnaGain;
        AudioService.playCoin();
        this.callbacks.onRewardEarned(
          orb.value * 3,
          dnaGain,
          'spore',
          this.sporeMass
        );
        // Respawn orb at new random location
        const angle = Math.random() * Math.PI * 2;
        const rad = 4 + Math.random() * 30;
        orb.mesh.position.set(Math.cos(angle) * rad, 0.45, Math.sin(angle) * rad);
      }
    }

    // Update AI Spore Critters & chomp smaller critters!
    for (const critter of this.sporeCritters) {
      critter.changeDirTimer -= dt;
      if (critter.changeDirTimer <= 0) {
        critter.changeDirTimer = 2 + Math.random() * 3;
        critter.vel.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
      }
      critter.mesh.position.addScaledVector(critter.vel, dt);
      critter.mesh.position.x = THREE.MathUtils.clamp(critter.mesh.position.x, -34, 34);
      critter.mesh.position.z = THREE.MathUtils.clamp(critter.mesh.position.z, -34, 34);
      critter.mesh.rotation.y = Math.atan2(critter.vel.x, critter.vel.z);
      this.animateCapyLegs(critter.mesh, dt, 10);

      const dCritter = Math.hypot(
        this.heroCapy.position.x - critter.mesh.position.x,
        this.heroCapy.position.z - critter.mesh.position.z
      );
      if (dCritter < 1.25 * heroScale) {
        if (heroScale >= critter.scale * 0.9) {
          // Chomp smaller/equal critter for huge DNA & mass burst!
          AudioService.playChomp();
          this.sporeMass += 18;
          this.sporeDnaEarned += 5;
          this.callbacks.onRewardEarned(45, 5, 'spore', this.sporeMass);
          this.callbacks.onModeNotification?.(
            'Chomped Spore Critter! +5 DNA & +45 CapyCoins!'
          );
          const ang = Math.random() * Math.PI * 2;
          critter.mesh.position.set(Math.cos(ang) * 28, 0, Math.sin(ang) * 28);
        }
      }
    }

    _camTarget.set(
      this.heroCapy.position.x,
      7.5 + heroScale * 2.5,
      this.heroCapy.position.z + 10.5 + heroScale * 2.0
    );
    this.camera.position.lerp(_camTarget, 1 - Math.exp(-6 * dt));
    this.camera.lookAt(this.heroCapy.position.x, 0.8, this.heroCapy.position.z);
  }

  // --- 3. BREAKOUT TICK ---
  private tickBreakout(dt: number) {
    if (!this.breakoutPaddle) return;

    const paddleWidthScale =
      (1 + (this.stats.upgrades.paddleSize - 1) * 0.12) * this.paddleWidthMultiplier;
    this.breakoutPaddle.scale.x = paddleWidthScale;
    const halfPaddleW = 1.9 * paddleWidthScale;

    if (this.pointerTargetX !== null) {
      const targetX = THREE.MathUtils.clamp(this.pointerTargetX * 7.2, -6.4, 6.4);
      this.breakoutPaddle.position.x = THREE.MathUtils.lerp(
        this.breakoutPaddle.position.x,
        targetX,
        1 - Math.exp(-18 * dt)
      );
    } else {
      const paddleSpeed = 16.5 * this.getEffectiveSpeedMultiplier();
      this.breakoutPaddle.position.x += this.moveInput.x * paddleSpeed * dt;
      this.breakoutPaddle.position.x = THREE.MathUtils.clamp(
        this.breakoutPaddle.position.x,
        -6.4,
        6.4
      );
    }

    this.camera.position.set(0, 18.5, 15.5);
    this.camera.lookAt(0, 0, -1);

    // Update falling powerup capsules
    for (let i = this.breakoutPowerups.length - 1; i >= 0; i--) {
      const p = this.breakoutPowerups[i];
      p.mesh.position.z += 6.5 * dt;
      p.mesh.rotation.y += 3 * dt;
      if (
        p.mesh.position.z >= 8.4 &&
        p.mesh.position.z <= 9.8 &&
        Math.abs(p.mesh.position.x - this.breakoutPaddle.position.x) < halfPaddleW + 0.5
      ) {
        AudioService.playPrestigeFanfare();
        if (p.type === 'multiball' && this.breakoutBalls.length < 6) {
          this.spawnBreakoutBall(this.breakoutPaddle.position.x, 8.2, -4.5, -9.5);
          this.spawnBreakoutBall(this.breakoutPaddle.position.x, 8.2, 4.5, -9.5);
          this.callbacks.onModeNotification?.('MULTIBALL UNLEASHED! 3x Yuzu Melons!');
        } else {
          this.paddleWidthMultiplier = 1.35;
          this.callbacks.onModeNotification?.('MEGA PADDLE ACTIVATED!');
        }
        this.breakoutGroup.remove(p.mesh);
        this.breakoutPowerups.splice(i, 1);
      } else if (p.mesh.position.z > 12) {
        this.breakoutGroup.remove(p.mesh);
        this.breakoutPowerups.splice(i, 1);
      }
    }

    // Update balls
    for (let bIdx = this.breakoutBalls.length - 1; bIdx >= 0; bIdx--) {
      const b = this.breakoutBalls[bIdx];
      if (!b.active) continue;
      b.mesh.position.addScaledVector(b.vel, dt);

      if (b.mesh.position.x <= -7.8) {
        b.mesh.position.x = -7.8;
        b.vel.x = Math.abs(b.vel.x);
        AudioService.playBrickHit(0.85);
      } else if (b.mesh.position.x >= 7.8) {
        b.mesh.position.x = 7.8;
        b.vel.x = -Math.abs(b.vel.x);
        AudioService.playBrickHit(0.85);
      }

      if (b.mesh.position.z <= -10.8) {
        b.mesh.position.z = -10.8;
        b.vel.z = Math.abs(b.vel.z);
        AudioService.playBrickHit(0.9);
      }

      // Paddle bounce
      if (
        b.vel.z > 0 &&
        b.mesh.position.z >= 8.3 &&
        b.mesh.position.z <= 9.6 &&
        Math.abs(b.mesh.position.x - this.breakoutPaddle.position.x) < halfPaddleW + 0.35
      ) {
        b.vel.z = -Math.abs(b.vel.z);
        const hitOffset = (b.mesh.position.x - this.breakoutPaddle.position.x) / halfPaddleW;
        b.vel.x = hitOffset * 8.2;
        this.breakoutCombo = 1;
        AudioService.playJump();
      }

      // Ball fell past bottom
      if (b.mesh.position.z > 12.2) {
        if (this.breakoutBalls.length > 1) {
          this.breakoutGroup.remove(b.mesh);
          this.breakoutBalls.splice(bIdx, 1);
          continue;
        } else {
          // Endless arcade mode: respawn ball at paddle with combo reset
          b.mesh.position.set(this.breakoutPaddle.position.x, 0.5, 7.5);
          b.vel.set((Math.random() - 0.5) * 5, 0, -9.2);
          this.breakoutCombo = 1;
          AudioService.playSplash();
        }
      }

      // Block collisions
      for (let i = this.breakoutBlocks.length - 1; i >= 0; i--) {
        const blk = this.breakoutBlocks[i];
        const dx = Math.abs(b.mesh.position.x - blk.mesh.position.x);
        const dz = Math.abs(b.mesh.position.z - blk.mesh.position.z);
        if (dx < 1.1 && dz < 0.65) {
          b.vel.z = -b.vel.z;
          blk.hp--;
          this.breakoutCombo = Math.min(10, this.breakoutCombo + 1);
          const pts = 25 * this.breakoutCombo * this.breakoutWave;
          this.breakoutScore += pts;

          if (blk.hp <= 0) {
            // Chance to drop a 3D powerup capsule
            if (blk.isBonus || Math.random() > 0.82) {
              const pMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.28, 0.28, 0.6, 12),
                new THREE.MeshStandardMaterial({
                  color: 0x38bdf8,
                  emissive: 0x0284c7,
                  emissiveIntensity: 0.5,
                })
              );
              pMesh.rotation.z = Math.PI / 2;
              pMesh.position.copy(blk.mesh.position);
              this.breakoutGroup.add(pMesh);
              this.breakoutPowerups.push({
                mesh: pMesh,
                type: Math.random() > 0.35 ? 'multiball' : 'wide',
              });
            }

            this.breakoutGroup.remove(blk.mesh);
            this.breakoutBlocks.splice(i, 1);
            AudioService.playBrickHit(1.1 + this.breakoutCombo * 0.08);
            this.callbacks.onRewardEarned(
              6 * this.breakoutCombo,
              blk.isBonus ? 1 : 0,
              'breakout',
              this.breakoutScore
            );
          } else {
            AudioService.playBrickHit(0.95);
          }

          if (this.breakoutBlocks.length === 0) {
            this.breakoutWave++;
            AudioService.playPrestigeFanfare();
            const waveBonus = 120 * this.breakoutWave;
            this.breakoutScore += waveBonus;
            this.callbacks.onRewardEarned(waveBonus, 3, 'breakout', this.breakoutScore);
            this.callbacks.onModeNotification?.(
              `Wave ${this.breakoutWave - 1} Cleared! +${waveBonus} Coins & +3 DNA! Launching Wave ${this.breakoutWave}!`
            );
            this.resetBreakoutGame(false);
          }
          break;
        }
      }
    }
  }

  // --- 4. RUNNER TICK ---
  private tickRunner(dt: number) {
    if (this.pointerTargetX !== null) {
      const targetX = THREE.MathUtils.clamp(this.pointerTargetX * 3.8, -3.5, 3.5);
      this.heroCapy.position.x = THREE.MathUtils.lerp(
        this.heroCapy.position.x,
        targetX,
        1 - Math.exp(-15 * dt)
      );
    } else {
      const steerSpeed = 13.0 * this.getEffectiveSpeedMultiplier();
      this.heroCapy.position.x += this.moveInput.x * steerSpeed * dt;
      this.heroCapy.position.x = THREE.MathUtils.clamp(
        this.heroCapy.position.x,
        -3.5,
        3.5
      );
    }

    const speed = this.runnerSpeed * (1 + Math.min(0.6, this.runnerDistance / 1500));
    this.runnerDistance += speed * dt;
    this.heroCapy.position.z -= speed * dt;
    this.heroCapy.rotation.y = Math.PI;
    this.animateCapyLegs(this.heroCapy, dt, 18);

    // Update visible 3D Herd followers in formation around the hero
    for (let i = 0; i < this.runnerHerdMeshes.length; i++) {
      const mini = this.runnerHerdMeshes[i];
      const ring = Math.floor(i / 6) + 1;
      const angle = ((i % 6) / 6) * Math.PI * 2 + this.runnerDistance * 0.05;
      const offsetX = Math.cos(angle) * (0.75 * ring);
      const offsetZ = Math.sin(angle) * (0.65 * ring) + 0.9 * ring;
      mini.position.set(
        THREE.MathUtils.clamp(this.heroCapy.position.x + offsetX, -4.1, 4.1),
        0,
        this.heroCapy.position.z + offsetZ
      );
      this.animateCapyLegs(mini, dt, 20);
    }

    this.camera.position.set(
      this.heroCapy.position.x * 0.45,
      5.2,
      this.heroCapy.position.z + 9.8
    );
    this.camera.lookAt(
      this.heroCapy.position.x * 0.4,
      1.2,
      this.heroCapy.position.z - 14
    );

    // Gate collisions
    for (const gate of this.runnerGates) {
      if (
        !gate.triggered &&
        Math.abs(gate.z - this.heroCapy.position.z) < 1.35 &&
        Math.abs(gate.mesh.position.x - this.heroCapy.position.x) < 1.95
      ) {
        gate.triggered = true;
        gate.mesh.visible = false;
        if (gate.type === 'multiply') {
          this.runnerCapyCount = Math.min(999, this.runnerCapyCount * gate.value);
          AudioService.playPrestigeFanfare();
        } else if (gate.type === 'add') {
          this.runnerCapyCount = Math.min(999, this.runnerCapyCount + gate.value);
          AudioService.playCoin();
        } else {
          this.runnerCapyCount = Math.max(1, this.runnerCapyCount - gate.value);
          AudioService.playSplash();
        }
        this.syncRunnerHerdVisuals();

        const coinReward = Math.max(5, Math.round(this.runnerCapyCount * 1.5));
        this.callbacks.onRewardEarned(
          coinReward,
          gate.type === 'multiply' ? 1 : 0,
          'runner',
          this.runnerCapyCount * 10 + Math.round(this.runnerDistance)
        );
        this.callbacks.onModeNotification?.(
          `Stampede Herd: ${this.runnerCapyCount} Capybaras! (+${coinReward} Coins)`
        );
      }
    }

    // Recycle track segments endlessly
    const firstSegment = this.runnerTrackSegments[0];
    if (firstSegment && firstSegment.position.z > this.heroCapy.position.z + 24) {
      const lastSegment = this.runnerTrackSegments[this.runnerTrackSegments.length - 1];
      firstSegment.position.z = lastSegment.position.z - 24;
      this.runnerTrackSegments.push(this.runnerTrackSegments.shift()!);
      this.spawnRunnerGatePair(firstSegment.position.z);
    }
  }

  // --- 5. FALL GUYS TICK ---
  private tickFallGuys(dt: number) {
    for (const obs of this.spinningObstacles) {
      obs.mesh.rotation.y += obs.speed * dt;
      // Check sweeper bar knockback against player
      const dz = Math.abs(this.heroCapy.position.z - obs.mesh.position.z);
      if (dz < 1.2 && this.heroCapy.position.y < 1.6) {
        const barAngle = obs.mesh.rotation.y;
        const playerAngle = Math.atan2(
          this.heroCapy.position.x - obs.mesh.position.x,
          this.heroCapy.position.z - obs.mesh.position.z
        );
        const angleDiff = Math.abs(Math.sin(barAngle - playerAngle));
        if (angleDiff < 0.22 && Math.abs(this.heroCapy.position.x) < 4.5) {
          this.heroVelocity.y = 7.5;
          this.heroCapy.position.x += (obs.speed > 0 ? 1 : -1) * 2.2;
          AudioService.playJump();
        }
      }
    }

    // See-saw tilting physics
    for (const ss of this.seeSaws) {
      ss.phase += dt * 1.8;
      ss.mesh.rotation.z = Math.sin(ss.phase) * 0.22;
    }

    const speed = 9.2 * this.getEffectiveSpeedMultiplier();
    const moveX = this.moveInput.x * speed;
    const moveZ = this.moveInput.z * speed;

    this.heroCapy.position.x = THREE.MathUtils.clamp(
      this.heroCapy.position.x + moveX * dt,
      -5.2,
      5.2
    );
    this.heroCapy.position.z += moveZ * dt;

    // Gravity & Jump
    this.heroVelocity.y -= 25 * dt;
    this.heroCapy.position.y += this.heroVelocity.y * dt;

    if (this.heroCapy.position.y <= 0.6) {
      this.heroCapy.position.y = 0.6;
      this.heroVelocity.y = 0;
      this.isGrounded = true;
    }

    // Stage 3 Trampoline Pad auto-boost at Z = -46
    const dTramp = Math.hypot(
      this.heroCapy.position.x,
      this.heroCapy.position.z - -46
    );
    if (dTramp < 4.5 && this.heroCapy.position.y <= 0.8) {
      this.heroVelocity.y = 14.5;
      this.isGrounded = false;
      AudioService.playJump();
    }

    if (this.isJumping && this.isGrounded) {
      this.heroVelocity.y = 11.5 + (this.stats.upgrades.bounciness - 1) * 1.0;
      this.isGrounded = false;
      this.isJumping = false;
      AudioService.playJump();
    }

    if (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05) {
      this.heroCapy.rotation.y = Math.atan2(moveX, moveZ);
      this.animateCapyLegs(this.heroCapy, dt, 15);
    } else {
      this.resetCapyLegs(this.heroCapy);
    }

    // AI Rival Bean-Capys racing forward
    for (const rival of this.fallGuysRivals) {
      rival.capy.position.z -= rival.speed * dt;
      rival.capy.position.x =
        rival.laneOffset + Math.sin(rival.capy.position.z * 0.35) * 1.1;
      this.animateCapyLegs(rival.capy, dt, 14);
      if (rival.capy.position.z < -60) {
        rival.capy.position.z = 0;
      }
    }

    // Check Golden Crown Finish Line at Z <= -57
    if (this.heroCapy.position.z <= -57) {
      this.fallGuysCrowns++;
      this.fallGuysRound++;
      const crownCoins = 200 * this.fallGuysRound;
      AudioService.playPrestigeFanfare();
      this.callbacks.onRewardEarned(
        crownCoins,
        4,
        'fallguys',
        this.fallGuysCrowns
      );
      this.callbacks.onModeNotification?.(
        `GOLDEN CROWN #${this.fallGuysCrowns} CLAIMED! +${crownCoins} Coins & +4 DNA! Advancing to Round ${this.fallGuysRound}!`
      );
      this.heroCapy.position.set(0, 1.0, 0);
      this.resetFallGuysGame(false);
    }

    _camTarget.set(
      this.heroCapy.position.x * 0.65,
      this.heroCapy.position.y + 6.2,
      this.heroCapy.position.z + 10.2
    );
    this.camera.position.lerp(_camTarget, 1 - Math.exp(-7 * dt));
    this.camera.lookAt(
      this.heroCapy.position.x,
      this.heroCapy.position.y + 1.0,
      this.heroCapy.position.z - 6
    );
  }

  public adjustZoom(delta: number): number {
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom + delta, 0.65, 1.75);
    this.camera.updateProjectionMatrix();
    return this.camera.zoom;
  }

  public handleResize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose() {
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }
}
