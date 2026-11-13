import * as THREE from 'three';
import type { ChronoVesselViewMode } from '../types';

export interface ChronoVesselConfigOptions {
  vesselScale?: number;
  vesselCherenkovHex?: number;
  vesselBrassHex?: number;
  vesselCanopyHex?: number;
  furPrimaryHex?: number;
  furSecondaryHex?: number;
  pilotHat?: string;
  pilotOrangeHex?: number;
}

export class ChronoVesselRig {
  public readonly root = new THREE.Group();
  public readonly craftGroup = new THREE.Group();
  private readonly primaryGimbal: THREE.Mesh;
  private readonly brassAstrolabe: THREE.Mesh;
  private readonly canopyMesh: THREE.Mesh;
  private readonly consoleReticle: THREE.Mesh;
  private readonly plumeLeft: THREE.Mesh;
  private readonly plumeRight: THREE.Mesh;
  private readonly dorsalBeaconMat: THREE.MeshStandardMaterial;
  private readonly brassMat: THREE.MeshStandardMaterial;
  private readonly cherenkovMat: THREE.MeshStandardMaterial;
  private readonly canopyMat: THREE.MeshPhysicalMaterial;
  private readonly pilotGroup: THREE.Group;
  private readonly furMat: THREE.MeshStandardMaterial;
  private readonly snoutMat: THREE.MeshStandardMaterial;
  private readonly visorMat: THREE.MeshStandardMaterial;
  private readonly headYuzuMat: THREE.MeshStandardMaterial;
  private readonly hatCrownGroup: THREE.Group;
  private readonly hatFlowerGroup: THREE.Group;
  private readonly hatWizardGroup: THREE.Group;
  private readonly hatHaloMesh: THREE.Mesh;
  private readonly hatPartyGroup: THREE.Group;

  private mode: ChronoVesselViewMode = 'chase_pod';
  private hullOpacity = 1.0;
  private simTime = 0;
  private bankRoll = 0;
  private bankPitch = 0;
  private baseVesselScale = 1.0;

  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];
  private readonly materialsToDispose: THREE.Material[] = [];

  constructor() {
    this.root.name = 'ChronoVesselRoot';
    this.craftGroup.name = 'ChronoVesselCraft';
    this.root.add(this.craftGroup);

    // 1. Primary brushed titanium outer gimbal ring (silhouette 1)
    const titaniumMat = new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      metalness: 0.92,
      roughness: 0.2,
      clearcoat: 0.55,
      clearcoatRoughness: 0.16,
    });
    const outerGimbalGeo = new THREE.TorusGeometry(0.95, 0.088, 16, 48);
    this.primaryGimbal = new THREE.Mesh(outerGimbalGeo, titaniumMat);
    this.primaryGimbal.rotation.x = Math.PI * 0.5;
    this.primaryGimbal.castShadow = true;
    this.craftGroup.add(this.primaryGimbal);

    // 2. Inclined warm brass temporal astrolabe ring (silhouette 2)
    this.brassMat = new THREE.MeshPhysicalMaterial({
      color: 0xeab308,
      metalness: 0.88,
      roughness: 0.18,
      clearcoat: 0.4,
    });
    const astrolabeGeo = new THREE.TorusGeometry(0.76, 0.036, 12, 42);
    this.brassAstrolabe = new THREE.Mesh(astrolabeGeo, this.brassMat);
    this.brassAstrolabe.rotation.set(0.55, 0.2, 0.35);
    this.craftGroup.add(this.brassAstrolabe);

    // 3. Faceted basalt-carbon ventral keel using ExtrudeGeometry with bevels
    const keelShape = new THREE.Shape();
    keelShape.moveTo(-0.55, -0.18);
    keelShape.lineTo(0.55, -0.18);
    keelShape.lineTo(0.32, 0.22);
    keelShape.lineTo(-0.32, 0.22);
    keelShape.closePath();
    const keelGeo = new THREE.ExtrudeGeometry(keelShape, {
      depth: 0.85,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    keelGeo.center();
    const keelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.48,
      roughness: 0.52,
    });
    const ventralKeel = new THREE.Mesh(keelGeo, keelMat);
    ventralKeel.position.set(0, -0.16, 0.02);
    ventralKeel.rotation.x = Math.PI * 0.5;
    this.craftGroup.add(ventralKeel);

    // 4. Optical sapphire dome canopy (software-GL safe transparent alpha, zero transmission)
    this.canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.12,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const canopyGeo = new THREE.SphereGeometry(0.64, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56);
    this.canopyMesh = new THREE.Mesh(canopyGeo, this.canopyMat);
    this.canopyMesh.position.set(0, -0.02, 0.02);
    this.canopyMesh.renderOrder = 5;
    this.craftGroup.add(this.canopyMesh);

    // 5. Future Pilot Capybara inside the cockpit seat
    this.pilotGroup = new THREE.Group();
    this.pilotGroup.position.set(0, -0.04, 0.04);
    this.craftGroup.add(this.pilotGroup);

    this.furMat = new THREE.MeshStandardMaterial({
      color: 0xb47442,
      roughness: 0.85,
      metalness: 0.04,
    });
    this.snoutMat = new THREE.MeshStandardMaterial({
      color: 0x6d3f1d,
      roughness: 0.82,
      metalness: 0.06,
    });
    const pilotTorsoGeo = new THREE.CapsuleGeometry(0.17, 0.22, 6, 12);
    const pilotTorso = new THREE.Mesh(pilotTorsoGeo, this.furMat);
    pilotTorso.position.set(0, 0.08, 0.06);
    pilotTorso.rotation.x = 0.22;
    this.pilotGroup.add(pilotTorso);

    const pilotHeadGeo = new THREE.SphereGeometry(0.145, 14, 12);
    const pilotHead = new THREE.Mesh(pilotHeadGeo, this.furMat);
    pilotHead.position.set(0, 0.27, -0.02);
    pilotHead.scale.set(0.95, 0.92, 1.18);
    this.pilotGroup.add(pilotHead);

    const pilotSnoutGeo = new THREE.BoxGeometry(0.14, 0.1, 0.14);
    const pilotSnout = new THREE.Mesh(pilotSnoutGeo, this.snoutMat);
    pilotSnout.position.set(0, 0.245, -0.15);
    this.pilotGroup.add(pilotSnout);

    const earGeo = new THREE.SphereGeometry(0.038, 8, 8);
    const earL = new THREE.Mesh(earGeo, this.snoutMat);
    earL.position.set(-0.095, 0.37, 0.03);
    const earR = new THREE.Mesh(earGeo, this.snoutMat);
    earR.position.set(0.095, 0.37, 0.03);
    this.pilotGroup.add(earL, earR);

    this.cherenkovMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.5,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    this.visorMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.65,
      roughness: 0.1,
      metalness: 0.25,
      transparent: true,
      opacity: 0.88,
    });
    const visorGeo = new THREE.BoxGeometry(0.22, 0.06, 0.08);
    const pilotVisor = new THREE.Mesh(visorGeo, this.visorMat);
    pilotVisor.position.set(0, 0.285, -0.115);
    this.pilotGroup.add(pilotVisor);

    const headYuzuGeo = new THREE.SphereGeometry(0.065, 10, 10);
    this.headYuzuMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x92400e,
      emissiveIntensity: 0.25,
      roughness: 0.42,
    });
    const headYuzu = new THREE.Mesh(headYuzuGeo, this.headYuzuMat);
    headYuzu.position.set(0, 0.43, 0.01);
    this.pilotGroup.add(headYuzu);

    // Pre-built pilot headgear accessories toggled via .visible (zero runtime allocations)
    this.hatCrownGroup = new THREE.Group();
    const pilotCrownGeo = new THREE.CylinderGeometry(0.095, 0.082, 0.055, 8, 1, true);
    const pilotCrownMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.88,
      roughness: 0.18,
      side: THREE.DoubleSide,
    });
    const pilotCrownMesh = new THREE.Mesh(pilotCrownGeo, pilotCrownMat);
    pilotCrownMesh.position.set(0, 0.415, 0.01);
    this.hatCrownGroup.add(pilotCrownMesh);
    this.hatCrownGroup.visible = false;
    this.pilotGroup.add(this.hatCrownGroup);

    this.hatFlowerGroup = new THREE.Group();
    const petalGeo = new THREE.SphereGeometry(0.036, 8, 8);
    petalGeo.scale(1.2, 0.4, 0.65);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.4 });
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(petalGeo, petalMat);
      p.position.set(-0.075, 0.41, 0.02);
      p.rotation.y = (i * Math.PI * 2) / 5;
      p.translateX(0.028);
      this.hatFlowerGroup.add(p);
    }
    this.hatFlowerGroup.visible = false;
    this.pilotGroup.add(this.hatFlowerGroup);

    this.hatWizardGroup = new THREE.Group();
    const wizMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.42 });
    const wizBrimGeo = new THREE.RingGeometry(0.075, 0.145, 16);
    const wizBrim = new THREE.Mesh(wizBrimGeo, wizMat);
    wizBrim.rotation.x = Math.PI * 0.5;
    wizBrim.position.set(0, 0.39, 0.01);
    const wizConeGeo = new THREE.ConeGeometry(0.08, 0.16, 12);
    const wizCone = new THREE.Mesh(wizConeGeo, wizMat);
    wizCone.position.set(0, 0.47, 0.01);
    this.hatWizardGroup.add(wizBrim, wizCone);
    this.hatWizardGroup.visible = false;
    this.pilotGroup.add(this.hatWizardGroup);

    const haloGeo = new THREE.TorusGeometry(0.11, 0.016, 10, 22);
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.75,
      roughness: 0.12,
    });
    this.hatHaloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.hatHaloMesh.rotation.x = Math.PI * 0.5;
    this.hatHaloMesh.position.set(0, 0.52, 0.01);
    this.hatHaloMesh.visible = false;
    this.pilotGroup.add(this.hatHaloMesh);

    this.hatPartyGroup = new THREE.Group();
    const partyConeGeo = new THREE.ConeGeometry(0.055, 0.13, 12);
    const partyConeMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.32 });
    const partyCone = new THREE.Mesh(partyConeGeo, partyConeMat);
    partyCone.position.set(-0.07, 0.47, -0.01);
    partyCone.rotation.z = 0.35;
    const partyPomGeo = new THREE.SphereGeometry(0.022, 8, 8);
    const partyPomMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
    const partyPom = new THREE.Mesh(partyPomGeo, partyPomMat);
    partyPom.position.set(-0.11, 0.53, -0.01);
    this.hatPartyGroup.add(partyCone, partyPom);
    this.hatPartyGroup.visible = false;
    this.pilotGroup.add(this.hatPartyGroup);

    // 6. Holographic cockpit navigation reticle
    const reticleGeo = new THREE.RingGeometry(0.24, 0.275, 28);
    this.consoleReticle = new THREE.Mesh(reticleGeo, this.cherenkovMat);
    this.consoleReticle.position.set(0, 0.16, -0.34);
    this.consoleReticle.rotation.x = -0.55;
    this.craftGroup.add(this.consoleReticle);

    // 7 & 8. Twin rear ion nacelles + reactive Cherenkov thruster plumes
    const nacelleGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.42, 12);
    const plumeGeo = new THREE.ConeGeometry(0.105, 0.65, 12);
    plumeGeo.rotateX(Math.PI * 0.5);
    const thrusterL = new THREE.Mesh(nacelleGeo, titaniumMat);
    thrusterL.rotation.x = Math.PI * 0.5;
    thrusterL.position.set(-0.56, -0.06, 0.72);
    const thrusterR = new THREE.Mesh(nacelleGeo, titaniumMat);
    thrusterR.rotation.x = Math.PI * 0.5;
    thrusterR.position.set(0.56, -0.06, 0.72);
    this.craftGroup.add(thrusterL, thrusterR);

    this.plumeLeft = new THREE.Mesh(plumeGeo, this.cherenkovMat);
    this.plumeLeft.position.set(-0.56, -0.06, 1.18);
    this.plumeRight = new THREE.Mesh(plumeGeo, this.cherenkovMat);
    this.plumeRight.position.set(0.56, -0.06, 1.18);
    this.craftGroup.add(this.plumeLeft, this.plumeRight);

    // 9. Dorsal temporal beacon spire
    const spireGeo = new THREE.ConeGeometry(0.06, 0.28, 6);
    const spire = new THREE.Mesh(spireGeo, this.brassMat);
    spire.position.set(0, 0.14, 0.76);
    this.craftGroup.add(spire);

    this.dorsalBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    const beaconOrbGeo = new THREE.OctahedronGeometry(0.075, 0);
    const beaconOrb = new THREE.Mesh(beaconOrbGeo, this.dorsalBeaconMat);
    beaconOrb.position.set(0, 0.31, 0.76);
    this.craftGroup.add(beaconOrb);

    this.geometriesToDispose.push(
      outerGimbalGeo,
      astrolabeGeo,
      keelGeo,
      canopyGeo,
      pilotTorsoGeo,
      pilotHeadGeo,
      pilotSnoutGeo,
      earGeo,
      visorGeo,
      headYuzuGeo,
      pilotCrownGeo,
      petalGeo,
      wizBrimGeo,
      wizConeGeo,
      haloGeo,
      partyConeGeo,
      partyPomGeo,
      reticleGeo,
      nacelleGeo,
      plumeGeo,
      spireGeo,
      beaconOrbGeo
    );
    this.materialsToDispose.push(
      titaniumMat,
      this.brassMat,
      keelMat,
      this.canopyMat,
      this.furMat,
      this.snoutMat,
      this.cherenkovMat,
      this.visorMat,
      this.headYuzuMat,
      pilotCrownMat,
      petalMat,
      wizMat,
      haloMat,
      partyConeMat,
      partyPomMat,
      this.dorsalBeaconMat
    );
  }

  public applyConfig(opts: ChronoVesselConfigOptions): void {
    if (typeof opts.vesselScale === 'number' && Number.isFinite(opts.vesselScale)) {
      this.baseVesselScale = Math.max(0.5, Math.min(2.0, opts.vesselScale));
      this.craftGroup.scale.setScalar(this.baseVesselScale);
    }
    if (typeof opts.vesselCherenkovHex === 'number') {
      this.cherenkovMat.color.setHex(opts.vesselCherenkovHex);
      this.cherenkovMat.emissive.setHex(opts.vesselCherenkovHex);
      this.visorMat.color.setHex(opts.vesselCherenkovHex);
      this.visorMat.emissive.setHex(opts.vesselCherenkovHex);
      this.dorsalBeaconMat.color.setHex(opts.vesselCherenkovHex);
      this.dorsalBeaconMat.emissive.setHex(opts.vesselCherenkovHex);
    }
    if (typeof opts.vesselBrassHex === 'number') {
      this.brassMat.color.setHex(opts.vesselBrassHex);
    }
    if (typeof opts.vesselCanopyHex === 'number') {
      this.canopyMat.color.setHex(opts.vesselCanopyHex);
    }
    if (typeof opts.furPrimaryHex === 'number') {
      this.furMat.color.setHex(opts.furPrimaryHex);
    }
    if (typeof opts.furSecondaryHex === 'number') {
      this.snoutMat.color.setHex(opts.furSecondaryHex);
    }
    if (typeof opts.pilotOrangeHex === 'number') {
      this.headYuzuMat.color.setHex(opts.pilotOrangeHex);
    }
    if (typeof opts.pilotHat === 'string') {
      this.hatCrownGroup.visible = opts.pilotHat === 'crown';
      this.hatFlowerGroup.visible = opts.pilotHat === 'flower';
      this.hatWizardGroup.visible = opts.pilotHat === 'wizard';
      this.hatHaloMesh.visible = opts.pilotHat === 'halo';
      this.hatPartyGroup.visible = opts.pilotHat === 'party';
    }
  }

  public setMode(mode: ChronoVesselViewMode): void {
    this.mode = mode;
  }

  public getMode(): ChronoVesselViewMode {
    return this.mode;
  }

  public update(
    dt: number,
    scaleVelocity: number,
    steerInput: number,
    pitchInput: number
  ): void {
    this.simTime += dt;

    // Precess temporal astrolabe & hover oscillation
    this.brassAstrolabe.rotation.y += dt * (0.65 + Math.abs(scaleVelocity) * 0.45);
    this.brassAstrolabe.rotation.z = 0.35 + Math.sin(this.simTime * 1.4) * 0.14;
    this.consoleReticle.rotation.z -= dt * 1.1;

    const targetRoll = THREE.MathUtils.clamp(-steerInput * 0.36, -0.45, 0.45);
    const targetPitch = THREE.MathUtils.clamp(
      pitchInput * 0.25 - scaleVelocity * 0.032,
      -0.38,
      0.38
    );
    this.bankRoll = THREE.MathUtils.damp(this.bankRoll, targetRoll, 7.0, dt);
    this.bankPitch = THREE.MathUtils.damp(this.bankPitch, targetPitch, 7.0, dt);
    this.craftGroup.rotation.z = this.bankRoll;
    this.craftGroup.rotation.x = this.bankPitch;
    this.craftGroup.position.y = Math.sin(this.simTime * 2.3) * 0.045;

    // Reactive Cherenkov thruster plumes
    const thrustNorm = THREE.MathUtils.clamp(Math.abs(scaleVelocity) / 4.2, 0.12, 1.85);
    const flicker = 1.0 + Math.sin(this.simTime * 34.0) * 0.08;
    const plumeZ = (0.35 + thrustNorm * 1.05) * flicker;
    this.plumeLeft.scale.set(0.85 + thrustNorm * 0.25, 0.85 + thrustNorm * 0.25, plumeZ);
    this.plumeRight.scale.set(0.85 + thrustNorm * 0.25, 0.85 + thrustNorm * 0.25, plumeZ);
    this.cherenkovMat.emissiveIntensity = 1.1 + thrustNorm * 1.4;

    // Smoothly fade craft hull in Telescope view so central astronomical optics stay clear
    const targetOpacity = this.mode === 'telescope_first_person' ? 0.0 : 1.0;
    this.hullOpacity = THREE.MathUtils.damp(this.hullOpacity, targetOpacity, 10.0, dt);
    this.root.visible = this.hullOpacity > 0.02;
    this.canopyMat.opacity = 0.36 * this.hullOpacity;
  }

  public dispose(): void {
    for (let i = 0; i < this.geometriesToDispose.length; i++) {
      this.geometriesToDispose[i].dispose();
    }
    for (let i = 0; i < this.materialsToDispose.length; i++) {
      this.materialsToDispose[i].dispose();
    }
  }
}

export interface SanctuaryChronoPadSystem {
  group: THREE.Group;
  ringMat: THREE.MeshStandardMaterial;
  beaconLight: THREE.PointLight;
  wx: number;
  wz: number;
  radius: number;
  update: (dt: number, docked: boolean, cherenkovHex?: number) => void;
  dispose: () => void;
}

/**
 * Grounded basalt-and-brass landing pad in Sanctuary with bottom-center pivot (y = 0)
 * and polygonOffset rings so coplanar surfaces never Z-fight.
 */
export function createSanctuaryChronoPad(
  wx: number,
  wz: number
): SanctuaryChronoPadSystem {
  const group = new THREE.Group();
  group.name = 'SanctuaryChronoPad';
  group.position.set(wx, 0, wz);

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const plinthGeo = new THREE.CylinderGeometry(2.35, 2.65, 0.22, 24);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.45,
    roughness: 0.58,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = 0.11;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);

  const brassRimGeo = new THREE.TorusGeometry(2.2, 0.07, 10, 36);
  const brassRimMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.88,
    roughness: 0.22,
  });
  const brassRim = new THREE.Mesh(brassRimGeo, brassRimMat);
  brassRim.rotation.x = Math.PI * 0.5;
  brassRim.position.y = 0.22;
  group.add(brassRim);

  const glyphGeo = new THREE.RingGeometry(1.15, 1.48, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.15,
    roughness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
  const glyphRing = new THREE.Mesh(glyphGeo, ringMat);
  glyphRing.rotation.x = -Math.PI * 0.5;
  glyphRing.position.y = 0.225;
  group.add(glyphRing);

  const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8);
  const bulbGeo = new THREE.SphereGeometry(0.09, 10, 8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const px = Math.cos(a) * 2.15;
    const pz = Math.sin(a) * 2.15;
    const post = new THREE.Mesh(postGeo, brassRimMat);
    post.position.set(px, 0.28, pz);
    const bulb = new THREE.Mesh(bulbGeo, ringMat);
    bulb.position.set(px, 0.58, pz);
    group.add(post, bulb);
  }

  const beaconLight = new THREE.PointLight(0x06b6d4, 0.75, 10, 1.8);
  beaconLight.position.set(0, 0.85, 0);
  group.add(beaconLight);

  geos.push(plinthGeo, brassRimGeo, glyphGeo, postGeo, bulbGeo);
  mats.push(plinthMat, brassRimMat, ringMat);

  let phase = 0;
  return {
    group,
    ringMat,
    beaconLight,
    wx,
    wz,
    radius: 2.65,
    update(dt: number, docked: boolean, cherenkovHex?: number) {
      phase += dt * (docked ? 1.8 : 4.2);
      if (typeof cherenkovHex === 'number') {
        ringMat.color.setHex(cherenkovHex);
        ringMat.emissive.setHex(cherenkovHex);
        beaconLight.color.setHex(cherenkovHex);
      }
      const pulse = 0.85 + Math.sin(phase) * 0.28;
      ringMat.emissiveIntensity = (docked ? 0.95 : 1.55) * pulse;
      beaconLight.intensity = (docked ? 0.65 : 1.25) * pulse;
    },
    dispose() {
      for (let i = 0; i < geos.length; i++) geos[i].dispose();
      for (let i = 0; i < mats.length; i++) mats[i].dispose();
    },
  };
}
