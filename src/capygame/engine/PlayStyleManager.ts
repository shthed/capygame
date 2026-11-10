import * as THREE from 'three';
import { CapyModelGenerator, CapyMeshGroup } from './CapyModelGenerator';
import { PlayStyle, PlayerStats } from '../types';
import { AudioService } from '../services/AudioService';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Pre-allocated vectors to guarantee zero GC per frame
const _tempVec3 = new THREE.Vector3();
const _camTarget = new THREE.Vector3();

export interface GameEventCallbacks {
  onScoreUpdate: (score: number, coinsEarned: number) => void;
  onGameOver?: (finalScore: number) => void;
  onModeNotification?: (msg: string) => void;
}

export class PlayStyleManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private isSoftwareGl: boolean;

  // Active state
  public currentMode: PlayStyle = 'sanctuary';
  private stats: PlayerStats;
  private callbacks: GameEventCallbacks;

  // Groups for each play style
  private sanctuaryGroup = new THREE.Group();
  private breakoutGroup = new THREE.Group();
  private runnerGroup = new THREE.Group();
  private fallGuysGroup = new THREE.Group();

  // Hero Capybara Player
  public heroCapy: CapyMeshGroup;
  private heroVelocity = new THREE.Vector3();
  private isGrounded: boolean = true;
  private heroSpeed: number = 7.0;

  // Input states
  public moveInput = { x: 0, z: 0 };
  public isJumping: boolean = false;

  // --- Breakout State ---
  private breakoutPaddle: THREE.Mesh | null = null;
  private breakoutBalls: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    active: boolean;
  }> = [];
  private breakoutBlocks: THREE.Mesh[] = [];
  private breakoutScore: number = 0;
  private breakoutLives: number = 3;

  // --- Runner State ---
  private runnerHerd: CapyMeshGroup[] = [];
  private runnerTrackSegments: THREE.Group[] = [];
  private runnerDistance: number = 0;
  private runnerCapyCount: number = 1;
  private runnerSpeed: number = 14.0;
  private runnerGates: Array<{
    mesh: THREE.Group;
    type: 'add' | 'multiply' | 'sub';
    value: number;
    z: number;
    triggered: boolean;
  }> = [];

  // --- Fall Guys State ---
  private fallGuysCheckpoints: THREE.Vector3[] = [];
  private fallGuysCurrentCp: number = 0;
  private spinningObstacles: THREE.Mesh[] = [];
  private seeSaws: THREE.Mesh[] = [];

  // Ambient herd in Sanctuary
  private sanctuaryCapys: Array<{
    capy: CapyMeshGroup;
    target: THREE.Vector3;
    stateTimer: number;
    isSoaking: boolean;
  }> = [];

  constructor(
    container: HTMLElement,
    initialStats: PlayerStats,
    callbacks: GameEventCallbacks
  ) {
    this.stats = initialStats;
    this.callbacks = callbacks;

    // Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 1. Scene & Camera setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa7f3d0); // Warm sunny pasture teal
    this.scene.fog = new THREE.Fog(0xa7f3d0, 25, 95);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
    this.camera.position.set(0, 7, 10);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 3. Environment & Studio Lighting Rig (3-point warm/cool)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xfff7ed, 0x475569, 0.85);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffedd5, 1.35);
    dirLight.position.set(20, 35, 15);
    dirLight.castShadow = !this.isSoftwareGl;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    const d = 25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // 4. Hero Capybara
    this.heroCapy = CapyModelGenerator.createCapybara(this.stats.activeHat);
    this.scene.add(this.heroCapy);

    // 5. Mount Groups
    this.scene.add(this.sanctuaryGroup);
    this.scene.add(this.breakoutGroup);
    this.scene.add(this.runnerGroup);
    this.scene.add(this.fallGuysGroup);

    // Build sub-modes
    this.buildSanctuary();
    this.buildBreakout();
    this.buildRunner();
    this.buildFallGuys();

    // Set initial mode visibility
    this.switchMode(this.stats.selectedPlayStyle);
  }

  // --- MODE SWITCHING ---
  public switchMode(mode: PlayStyle) {
    this.currentMode = mode;
    this.sanctuaryGroup.visible = mode === 'sanctuary';
    this.breakoutGroup.visible = mode === 'breakout';
    this.runnerGroup.visible = mode === 'runner';
    this.fallGuysGroup.visible = mode === 'fallguys';

    // Position Hero Capybara appropriately
    this.heroVelocity.set(0, 0, 0);

    if (mode === 'sanctuary') {
      this.heroCapy.visible = true;
      this.heroCapy.position.set(0, 0, 3);
      this.scene.background = new THREE.Color(0xa7f3d0);
      this.scene.fog = new THREE.Fog(0xa7f3d0, 25, 95);
      this.callbacks.onModeNotification?.('Welcome to your Peaceful Capy Sanctuary!');
    } else if (mode === 'breakout') {
      this.heroCapy.visible = false; // In breakout, the paddle is the hero!
      this.scene.background = new THREE.Color(0x0f172a); // Deep arcade blue
      this.scene.fog = new THREE.Fog(0x0f172a, 30, 80);
      this.resetBreakoutGame();
      this.callbacks.onModeNotification?.('Yuzu Breakout! Move paddle to bounce citrus melons!');
    } else if (mode === 'runner') {
      this.heroCapy.visible = true;
      this.heroCapy.position.set(0, 0, 0);
      this.scene.background = new THREE.Color(0xfef08a); // Golden sunset runner
      this.scene.fog = new THREE.Fog(0xfef08a, 40, 120);
      this.resetRunnerGame();
      this.callbacks.onModeNotification?.('Capy Math Stampede! Multiply your herd!');
    } else if (mode === 'fallguys') {
      this.heroCapy.visible = true;
      this.heroCapy.position.set(0, 1, 0);
      this.scene.background = new THREE.Color(0xfbcfe8); // Playful pastel pink
      this.scene.fog = new THREE.Fog(0xfbcfe8, 30, 110);
      this.resetFallGuysGame();
      this.callbacks.onModeNotification?.('Bouncy Chaos! Dodge windmills and reach the Golden Crown!');
    }
  }

  public updateStats(newStats: PlayerStats) {
    this.stats = newStats;
    CapyModelGenerator.attachHat(this.heroCapy.userData.hatGroup, newStats.activeHat);
  }

  // --- 1. SANCTUARY WORLD BUILDER ---
  private buildSanctuary() {
    // Large floating lush island
    const islandGeo = new THREE.CylinderGeometry(20, 16, 4, 32);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80, // Vibrant pasture green
      roughness: 0.8,
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.set(0, -2, 0);
    island.receiveShadow = true;
    this.sanctuaryGroup.add(island);

    // Earth under-strata
    const earthGeo = new THREE.ConeGeometry(16, 7, 24);
    earthGeo.rotateX(Math.PI);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.95,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.position.set(0, -7.5, 0);
    this.sanctuaryGroup.add(earth);

    // Initial buildings from stats
    this.refreshSanctuaryBuildings();

    // Spawn 4 ambient friendly capybaras
    for (let i = 0; i < 4; i++) {
      const buddy = CapyModelGenerator.createCapybara('flower', 0.85);
      const angle = (i / 4) * Math.PI * 2;
      buddy.position.set(Math.cos(angle) * 7, 0, Math.sin(angle) * 7);
      this.sanctuaryGroup.add(buddy);
      this.sanctuaryCapys.push({
        capy: buddy,
        target: new THREE.Vector3(Math.cos(angle) * 5, 0, Math.sin(angle) * 5),
        stateTimer: Math.random() * 4,
        isSoaking: false,
      });
    }
  }

  public refreshSanctuaryBuildings() {
    // Clear dynamic buildings
    const toRemove: THREE.Object3D[] = [];
    this.sanctuaryGroup.children.forEach((child) => {
      if (child.name.startsWith('building_')) toRemove.push(child);
    });
    toRemove.forEach((c) => this.sanctuaryGroup.remove(c));

    this.stats.buildings.forEach((b) => {
      let bMesh: THREE.Group;
      if (b.type === 'hot_spring') {
        bMesh = CapyModelGenerator.createHotSpring();
      } else if (b.type === 'yuzu_orchard') {
        bMesh = CapyModelGenerator.createYuzuTree();
      } else {
        bMesh = CapyModelGenerator.createYuzuTree();
      }
      bMesh.name = `building_${b.id}`;
      bMesh.position.set(b.x, 0, b.z);
      this.sanctuaryGroup.add(bMesh);
    });
  }

  // --- 2. BREAKOUT GAME ---
  private buildBreakout() {
    // 3D Arcade bounds
    const arenaMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.6,
    });

    // Arena Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 22), arenaMat);
    floor.position.set(0, -0.2, 0);
    this.breakoutGroup.add(floor);

    // Side Walls
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 22), arenaMat);
    wallL.position.set(-8.4, 1, 0);
    this.breakoutGroup.add(wallL);

    const wallR = wallL.clone();
    wallR.position.x = 8.4;
    this.breakoutGroup.add(wallR);

    const wallTop = new THREE.Mesh(new THREE.BoxGeometry(17.6, 2, 0.8), arenaMat);
    wallTop.position.set(0, 1, -11.4);
    this.breakoutGroup.add(wallTop);

    // Capybara Paddle at bottom
    const paddleGeo = new THREE.BoxGeometry(3.6, 0.8, 0.8);
    const paddleMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber Gold
      roughness: 0.3,
      metalness: 0.4,
    });
    this.breakoutPaddle = new THREE.Mesh(paddleGeo, paddleMat);
    this.breakoutPaddle.position.set(0, 0.5, 9);
    this.breakoutPaddle.castShadow = true;
    this.breakoutGroup.add(this.breakoutPaddle);

    // Add cute mini capy on top of paddle!
    const paddleCapy = CapyModelGenerator.createCapybara('yuzu', 0.55);
    paddleCapy.position.set(0, 0.4, 0);
    this.breakoutPaddle.add(paddleCapy);

    this.resetBreakoutGame();
  }

  private resetBreakoutGame() {
    this.breakoutScore = 0;
    this.breakoutLives = 3;

    // Clear blocks
    this.breakoutBlocks.forEach((b) => this.breakoutGroup.remove(b));
    this.breakoutBlocks = [];

    // Clear balls
    this.breakoutBalls.forEach((b) => this.breakoutGroup.remove(b.mesh));
    this.breakoutBalls = [];

    // Spawn 1 Yuzu Ball
    const ballGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xffbb00, // Shiny golden yuzu
      roughness: 0.2,
      metalness: 0.2,
      emissive: 0x553300,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.position.set(0, 0.5, 6);
    this.breakoutGroup.add(ballMesh);
    this.breakoutBalls.push({
      mesh: ballMesh,
      vel: new THREE.Vector3(3.5, 0, -8.0),
      active: true,
    });

    // Spawn grid of fruity blocks
    const blockColors = [0xef4444, 0xf97316, 0xeab308, 0x10b981, 0x06b6d4, 0x8b5cf6];
    const rows = 5;
    const cols = 7;
    const blockW = 1.8;
    const blockD = 0.9;
    const startX = -((cols - 1) * blockW) / 2;
    const startZ = -9;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const mat = new THREE.MeshStandardMaterial({
          color: blockColors[r % blockColors.length],
          roughness: 0.25,
          metalness: 0.3,
        });
        const block = new THREE.Mesh(new THREE.BoxGeometry(blockW - 0.2, 0.6, blockD - 0.2), mat);
        block.position.set(startX + c * blockW, 0.5, startZ + r * blockD);
        block.castShadow = true;
        this.breakoutGroup.add(block);
        this.breakoutBlocks.push(block);
      }
    }
  }

  // --- 3. RUNNER GAME ---
  private buildRunner() {
    this.resetRunnerGame();
  }

  private resetRunnerGame() {
    this.runnerDistance = 0;
    this.runnerCapyCount = 1;

    // Clear track
    this.runnerTrackSegments.forEach((s) => this.runnerGroup.remove(s));
    this.runnerTrackSegments = [];

    // Clear gates
    this.runnerGates.forEach((g) => this.runnerGroup.remove(g.mesh));
    this.runnerGates = [];

    // Clear herd
    this.runnerHerd.forEach((c) => this.runnerGroup.remove(c));
    this.runnerHerd = [];

    // Create 8 initial continuous floating track sections
    for (let i = 0; i < 8; i++) {
      this.spawnRunnerTrackSegment(-i * 24);
    }
  }

  private spawnRunnerTrackSegment(zPos: number) {
    const segment = new THREE.Group();
    segment.position.set(0, 0, zPos);

    // Track surface (3 lanes)
    const trackGeo = new THREE.BoxGeometry(8, 0.4, 24);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.6,
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.2, 0);
    track.receiveShadow = true;
    segment.add(track);

    // Lane divider stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 24), stripeMat);
    stripe1.position.set(-2.5, 0.02, 0);
    segment.add(stripe1);
    const stripe2 = stripe1.clone();
    stripe2.position.x = 2.5;
    segment.add(stripe2);

    this.runnerGroup.add(segment);
    this.runnerTrackSegments.push(segment);

    // Random math gate
    if (Math.abs(zPos) > 15) {
      this.spawnRunnerGate(zPos);
    }
  }

  private spawnRunnerGate(zPos: number) {
    const isMultiply = Math.random() > 0.4;
    const value = isMultiply ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 6) + 3;
    const type = isMultiply ? 'multiply' : 'add';

    const gateGroup = new THREE.Group();
    gateGroup.position.set((Math.random() > 0.5 ? 1 : -1) * 2, 0, zPos);

    // Arch frame
    const frameMat = new THREE.MeshStandardMaterial({
      color: type === 'multiply' ? 0x10b981 : 0x3b82f6,
      roughness: 0.3,
      metalness: 0.4,
    });
    const arch = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 0.4), frameMat);
    arch.position.set(0, 1.6, 0);
    gateGroup.add(arch);

    // Glowing gate plane
    const planeMat = new THREE.MeshStandardMaterial({
      color: type === 'multiply' ? 0x34d399 : 0x60a5fa,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), planeMat);
    plane.position.set(0, 1.6, 0.05);
    gateGroup.add(plane);

    this.runnerGroup.add(gateGroup);
    this.runnerGates.push({
      mesh: gateGroup,
      type,
      value,
      z: zPos,
      triggered: false,
    });
  }

  // --- 4. FALL GUYS GAME ---
  private buildFallGuys() {
    this.resetFallGuysGame();
  }

  private resetFallGuysGame() {
    this.spinningObstacles.forEach((o) => this.fallGuysGroup.remove(o));
    this.spinningObstacles = [];
    this.seeSaws = [];

    // Course starts with a platform
    const startGeo = new THREE.BoxGeometry(12, 1, 12);
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.4 });
    const startPlat = new THREE.Mesh(startGeo, pinkMat);
    startPlat.position.set(0, 0, 0);
    this.fallGuysGroup.add(startPlat);

    // Platform 2: Spinning Windmill Arm
    const plat2 = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 16), pinkMat);
    plat2.position.set(0, 0, -18);
    this.fallGuysGroup.add(plat2);

    // Center post with spinning sweeper bar
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 3, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 })
    );
    post.position.set(0, 1.5, -18);
    this.fallGuysGroup.add(post);

    const barMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 0.8), barMat);
    bar.position.set(0, 1.2, -18);
    bar.castShadow = true;
    this.fallGuysGroup.add(bar);
    this.spinningObstacles.push(bar);

    // Platform 3: Bouncy Trampoline Launch Pad
    const plat3 = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 1, 24),
      new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.2 })
    );
    plat3.position.set(0, 0, -36);
    this.fallGuysGroup.add(plat3);

    // Finish Crown Platform
    const finishPlat = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 10),
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 })
    );
    finishPlat.position.set(0, 0, -52);
    this.fallGuysGroup.add(finishPlat);

    // Giant Golden Crown at finish
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.1,
    });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 1.5, 8), crownMat);
    crown.position.set(0, 2.5, -52);
    this.fallGuysGroup.add(crown);
  }

  // --- MAIN PER-FRAME TICK LOOP ---
  public tick(delta: number) {
    const clampedDelta = Math.min(delta, 0.1);

    if (this.currentMode === 'sanctuary') {
      this.tickSanctuary(clampedDelta);
    } else if (this.currentMode === 'breakout') {
      this.tickBreakout(clampedDelta);
    } else if (this.currentMode === 'runner') {
      this.tickRunner(clampedDelta);
    } else if (this.currentMode === 'fallguys') {
      this.tickFallGuys(clampedDelta);
    }

    // Render frame
    this.renderer.render(this.scene, this.camera);
  }

  // 1. Sanctuary Tick
  private tickSanctuary(delta: number) {
    // Player movement
    const speed = this.heroSpeed * (1 + (this.stats.upgrades.speedBoost - 1) * 0.15);
    const moveX = this.moveInput.x * speed;
    const moveZ = this.moveInput.z * speed;

    this.heroCapy.position.x += moveX * delta;
    this.heroCapy.position.z += moveZ * delta;

    // Keep on island bounds
    const dist = Math.hypot(this.heroCapy.position.x, this.heroCapy.position.z);
    if (dist > 18) {
      this.heroCapy.position.x = (this.heroCapy.position.x / dist) * 18;
      this.heroCapy.position.z = (this.heroCapy.position.z / dist) * 18;
    }

    // Animate legs when moving
    const isMoving = Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05;
    if (isMoving) {
      const angle = Math.atan2(moveX, moveZ);
      this.heroCapy.rotation.y = angle;
      this.heroCapy.userData.walkCycle += delta * 12;
      const swing = Math.sin(this.heroCapy.userData.walkCycle) * 0.45;
      this.heroCapy.userData.legFL.rotation.x = swing;
      this.heroCapy.userData.legBR.rotation.x = swing;
      this.heroCapy.userData.legFR.rotation.x = -swing;
      this.heroCapy.userData.legBL.rotation.x = -swing;
    } else {
      this.heroCapy.userData.legFL.rotation.x = 0;
      this.heroCapy.userData.legFR.rotation.x = 0;
      this.heroCapy.userData.legBL.rotation.x = 0;
      this.heroCapy.userData.legBR.rotation.x = 0;
    }

    // Camera follow hero smoothly with exponential damping
    _camTarget.set(
      this.heroCapy.position.x,
      this.heroCapy.position.y + 6.5,
      this.heroCapy.position.z + 10.5
    );
    this.camera.position.lerp(_camTarget, 0.08);
    this.camera.lookAt(this.heroCapy.position.x, 1, this.heroCapy.position.z);

    // Ambient buddies wandering
    this.sanctuaryCapys.forEach((buddy) => {
      buddy.stateTimer -= delta;
      if (buddy.stateTimer <= 0) {
        buddy.stateTimer = 4 + Math.random() * 5;
        const rad = 2 + Math.random() * 12;
        const ang = Math.random() * Math.PI * 2;
        buddy.target.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
      }
      _tempVec3.subVectors(buddy.target, buddy.capy.position);
      if (_tempVec3.length() > 0.3) {
        _tempVec3.normalize();
        buddy.capy.position.addScaledVector(_tempVec3, 1.8 * delta);
        buddy.capy.rotation.y = Math.atan2(_tempVec3.x, _tempVec3.z);
        buddy.capy.userData.walkCycle += delta * 6;
        const sw = Math.sin(buddy.capy.userData.walkCycle) * 0.3;
        buddy.capy.userData.legFL.rotation.x = sw;
        buddy.capy.userData.legFR.rotation.x = -sw;
      }
    });
  }

  // 2. Breakout Tick
  private tickBreakout(delta: number) {
    if (!this.breakoutPaddle) return;

    // Paddle movement
    const paddleSpeed = 16.0 * (1 + (this.stats.upgrades.speedBoost - 1) * 0.1);
    this.breakoutPaddle.position.x += this.moveInput.x * paddleSpeed * delta;
    this.breakoutPaddle.position.x = THREE.MathUtils.clamp(
      this.breakoutPaddle.position.x,
      -6.2,
      6.2
    );

    // Camera fixed high arcade perspective
    this.camera.position.set(0, 18, 16);
    this.camera.lookAt(0, 0, 0);

    // Update balls
    this.breakoutBalls.forEach((b) => {
      if (!b.active) return;
      b.mesh.position.addScaledVector(b.vel, delta);

      // Bounce side walls
      if (b.mesh.position.x <= -7.8) {
        b.mesh.position.x = -7.8;
        b.vel.x = Math.abs(b.vel.x);
        AudioService.playBrickHit(0.8);
      } else if (b.mesh.position.x >= 7.8) {
        b.mesh.position.x = 7.8;
        b.vel.x = -Math.abs(b.vel.x);
        AudioService.playBrickHit(0.8);
      }

      // Bounce top wall
      if (b.mesh.position.z <= -10.8) {
        b.mesh.position.z = -10.8;
        b.vel.z = Math.abs(b.vel.z);
        AudioService.playBrickHit(0.8);
      }

      // Paddle collision
      if (
        b.mesh.position.z >= 8.4 &&
        b.mesh.position.z <= 9.2 &&
        Math.abs(b.mesh.position.x - this.breakoutPaddle!.position.x) < 2.0
      ) {
        b.vel.z = -Math.abs(b.vel.z);
        // Add curve based on paddle hit offset
        const hitOffset = (b.mesh.position.x - this.breakoutPaddle!.position.x) / 2.0;
        b.vel.x = hitOffset * 7.0;
        AudioService.playJump();
      }

      // Bottom death
      if (b.mesh.position.z > 12) {
        b.mesh.position.set(0, 0.5, 6);
        b.vel.set((Math.random() - 0.5) * 4, 0, -8);
        this.breakoutLives--;
        AudioService.playSplash();
        if (this.breakoutLives <= 0) {
          this.callbacks.onGameOver?.(this.breakoutScore);
          this.resetBreakoutGame();
        }
      }

      // Block collisions
      for (let i = this.breakoutBlocks.length - 1; i >= 0; i--) {
        const block = this.breakoutBlocks[i];
        const dx = Math.abs(b.mesh.position.x - block.position.x);
        const dz = Math.abs(b.mesh.position.z - block.position.z);
        if (dx < 1.0 && dz < 0.6) {
          // Smash block!
          this.breakoutGroup.remove(block);
          this.breakoutBlocks.splice(i, 1);
          b.vel.z = -b.vel.z;
          this.breakoutScore += 25;
          AudioService.playBrickHit(1.2);
          this.callbacks.onScoreUpdate(this.breakoutScore, 5);

          // All cleared? Respawn fresh wave with bonus!
          if (this.breakoutBlocks.length === 0) {
            AudioService.playPrestigeFanfare();
            this.callbacks.onModeNotification?.('Wave Cleared! Yuzu Harvest Bonus +100 Coins!');
            this.callbacks.onScoreUpdate(this.breakoutScore + 100, 100);
            this.resetBreakoutGame();
          }
          break;
        }
      }
    });
  }

  // 3. Runner Tick
  private tickRunner(delta: number) {
    // Steer hero smoothly across lanes
    const steerSpeed = 12.0;
    this.heroCapy.position.x += this.moveInput.x * steerSpeed * delta;
    this.heroCapy.position.x = THREE.MathUtils.clamp(this.heroCapy.position.x, -3.2, 3.2);

    // Constant forward motion
    const speed = this.runnerSpeed;
    this.runnerDistance += speed * delta;
    this.heroCapy.position.z -= speed * delta;

    // Animate hero trot
    this.heroCapy.userData.walkCycle += delta * 16;
    const swing = Math.sin(this.heroCapy.userData.walkCycle) * 0.45;
    this.heroCapy.userData.legFL.rotation.x = swing;
    this.heroCapy.userData.legBR.rotation.x = swing;
    this.heroCapy.userData.legFR.rotation.x = -swing;
    this.heroCapy.userData.legBL.rotation.x = -swing;

    // Camera third person behind runner
    this.camera.position.set(
      this.heroCapy.position.x * 0.5,
      4.5,
      this.heroCapy.position.z + 8.5
    );
    this.camera.lookAt(
      this.heroCapy.position.x * 0.5,
      1.5,
      this.heroCapy.position.z - 15
    );

    // Check gate collision
    this.runnerGates.forEach((gate) => {
      if (
        !gate.triggered &&
        Math.abs(gate.z - this.heroCapy.position.z) < 1.2 &&
        Math.abs(gate.mesh.position.x - this.heroCapy.position.x) < 2.0
      ) {
        gate.triggered = true;
        if (gate.type === 'multiply') {
          this.runnerCapyCount *= gate.value;
        } else {
          this.runnerCapyCount += gate.value;
        }
        AudioService.playCoin();
        this.callbacks.onScoreUpdate(
          Math.round(this.runnerDistance),
          gate.value * 5
        );
        this.callbacks.onModeNotification?.(
          `Herd Stampede grew to ${this.runnerCapyCount} Capybaras!`
        );
      }
    });

    // Infinite track generation: recycle segments
    const firstSegment = this.runnerTrackSegments[0];
    if (firstSegment && firstSegment.position.z > this.heroCapy.position.z + 24) {
      const lastSegment = this.runnerTrackSegments[this.runnerTrackSegments.length - 1];
      firstSegment.position.z = lastSegment.position.z - 24;
      this.runnerTrackSegments.push(this.runnerTrackSegments.shift()!);
      this.spawnRunnerGate(firstSegment.position.z);
    }
  }

  // 4. Fall Guys Tick
  private tickFallGuys(delta: number) {
    // Rotating obstacle windmills
    this.spinningObstacles.forEach((obs) => {
      obs.rotation.y += delta * 2.2;
    });

    // Player jump & run
    const speed = 8.5;
    this.heroCapy.position.x += this.moveInput.x * speed * delta;
    this.heroCapy.position.z += this.moveInput.z * speed * delta;

    // Apply gravity
    this.heroVelocity.y -= 25 * delta;
    this.heroCapy.position.y += this.heroVelocity.y * delta;

    if (this.heroCapy.position.y <= 0.6) {
      this.heroCapy.position.y = 0.6;
      this.heroVelocity.y = 0;
      this.isGrounded = true;
    }

    // Jump handling
    if (this.isJumping && this.isGrounded) {
      this.heroVelocity.y = 11.0;
      this.isGrounded = false;
      this.isJumping = false;
      AudioService.playJump();
    }

    // Checkpoint & Crown detection
    if (this.heroCapy.position.z <= -50) {
      // Reached Crown!
      AudioService.playPrestigeFanfare();
      this.callbacks.onModeNotification?.('Golden Crown Claimed! +250 Coins & Prestige Karma!');
      this.callbacks.onScoreUpdate(500, 250);
      this.heroCapy.position.set(0, 1, 0);
    }

    // Camera follow
    this.camera.position.set(
      this.heroCapy.position.x * 0.7,
      this.heroCapy.position.y + 6.0,
      this.heroCapy.position.z + 9.5
    );
    this.camera.lookAt(
      this.heroCapy.position.x,
      this.heroCapy.position.y + 1,
      this.heroCapy.position.z - 5
    );
  }

  public handleResize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose() {
    this.renderer.dispose();
  }
}
