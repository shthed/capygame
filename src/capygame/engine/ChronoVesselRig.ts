import * as THREE from 'three';
import type { ChronoVesselViewMode } from '../types';
import { PbrTextureSynthesizer } from './gpu/PbrTextureSynthesizer';

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
  private readonly saucerHullMesh: THREE.Mesh;
  private readonly brassAstrolabe: THREE.Mesh;
  private readonly canopyMesh: THREE.Mesh;
  private readonly consoleReticle: THREE.Mesh;
  private readonly ventralHoverRing: THREE.Mesh;
  private readonly plumeLeft: THREE.Mesh;
  private readonly plumeRight: THREE.Mesh;
  private readonly dorsalBeaconMat: THREE.MeshStandardMaterial;
  private readonly brassMat: THREE.MeshPhysicalMaterial;
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

    // 1. Classic Flying Saucer Base Dish (compact ~0.46m radius lathe silhouette)
    const titaniumMat = new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      metalness: 0.92,
      roughness: 0.15,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.35,
    });
    const saucerPoints: THREE.Vector2[] = [
      new THREE.Vector2(0.0, -0.14),
      new THREE.Vector2(0.18, -0.125),
      new THREE.Vector2(0.36, -0.075),
      new THREE.Vector2(0.47, -0.015),
      new THREE.Vector2(0.465, 0.025),
      new THREE.Vector2(0.35, 0.07),
      new THREE.Vector2(0.24, 0.09),
      new THREE.Vector2(0.22, 0.03),
      new THREE.Vector2(0.0, 0.015),
    ];
    const saucerGeo = new THREE.LatheGeometry(saucerPoints, 32);
    PbrTextureSynthesizer.prepareGeometryForPbr(saucerGeo);
    this.saucerHullMesh = new THREE.Mesh(saucerGeo, titaniumMat);
    this.saucerHullMesh.castShadow = true;
    this.saucerHullMesh.receiveShadow = true;
    this.craftGroup.add(this.saucerHullMesh);

    // 2. Grogu Hover-Pram Hooded Back Cradle & Cushion Interior
    const pramShellMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      metalness: 0.55,
      roughness: 0.36,
      clearcoat: 0.4,
      side: THREE.DoubleSide,
    });
    // Rear wraparound Grogu-pram cradle (phi in [0.12*PI, 0.88*PI] puts shell on +Z rear/sides, open toward -Z front)
    const hoodGeo = new THREE.SphereGeometry(
      0.26,
      24,
      14,
      Math.PI * 0.12,
      Math.PI * 0.76,
      Math.PI * 0.24,
      Math.PI * 0.38
    );
    const pramHood = new THREE.Mesh(hoodGeo, pramShellMat);
    pramHood.position.set(0, 0.045, 0.02);
    this.craftGroup.add(pramHood);

    // Cushioned interior basin rim
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.1,
    });
    const cushionRimGeo = new THREE.TorusGeometry(0.225, 0.036, 10, 24);
    const cushionRim = new THREE.Mesh(cushionRimGeo, cushionMat);
    cushionRim.rotation.x = Math.PI * 0.5;
    cushionRim.position.set(0, 0.08, 0.01);
    this.craftGroup.add(cushionRim);

    // 3. Sleek Brass / Alloy Equatorial Saucer Trim & Pram Collar Arch
    this.brassMat = new THREE.MeshPhysicalMaterial({
      color: 0xeab308,
      metalness: 0.9,
      roughness: 0.14,
      clearcoat: 0.45,
      envMapIntensity: 1.35,
    });
    const astrolabeGeo = new THREE.TorusGeometry(0.495, 0.018, 10, 40);
    this.brassAstrolabe = new THREE.Mesh(astrolabeGeo, this.brassMat);
    this.brassAstrolabe.rotation.set(Math.PI * 0.5, 0.0, 0.06);
    this.craftGroup.add(this.brassAstrolabe);

    const pramArchGeo = new THREE.TorusGeometry(0.262, 0.015, 8, 24, Math.PI);
    const pramArch = new THREE.Mesh(pramArchGeo, this.brassMat);
    pramArch.position.set(0, 0.08, 0.02);
    pramArch.rotation.x = 0.42; // Tilted slightly back to frame the open-top pram collar
    this.craftGroup.add(pramArch);

    // 4. Translucent Open-Top Forward Windscreen Shield (phi in [1.15*PI, 1.85*PI] -> -Z front arc)
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
    const canopyGeo = new THREE.SphereGeometry(
      0.29,
      24,
      12,
      Math.PI * 1.15,
      Math.PI * 0.7,
      Math.PI * 0.16,
      Math.PI * 0.34
    );
    this.canopyMesh = new THREE.Mesh(canopyGeo, this.canopyMat);
    this.canopyMesh.position.set(0, 0.055, 0.01);
    this.canopyMesh.renderOrder = 5;
    this.craftGroup.add(this.canopyMesh);

    // 5. Cherenkov Glow Materials + UFO Perimeter Porthole Lights + Ventral Anti-Gravity Ring
    this.cherenkovMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.45,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    this.visorMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.55,
      roughness: 0.1,
      metalness: 0.25,
      transparent: true,
      opacity: 0.9,
    });

    const nodeOrbGeo = new THREE.SphereGeometry(0.024, 8, 8);
    const nodeCount = 10;
    for (let i = 0; i < nodeCount; i++) {
      const a = (i / nodeCount) * Math.PI * 2;
      const orb = new THREE.Mesh(nodeOrbGeo, this.cherenkovMat);
      orb.position.set(Math.cos(a) * 0.44, 0.005, Math.sin(a) * 0.44);
      this.craftGroup.add(orb);
    }

    const ventralRingGeo = new THREE.TorusGeometry(0.24, 0.018, 8, 28);
    this.ventralHoverRing = new THREE.Mesh(ventralRingGeo, this.cherenkovMat);
    this.ventralHoverRing.rotation.x = Math.PI * 0.5;
    this.ventralHoverRing.position.set(0, -0.11, 0);
    this.craftGroup.add(this.ventralHoverRing);

    const ventralCoreGeo = new THREE.SphereGeometry(0.075, 12, 8);
    ventralCoreGeo.scale(1.0, 0.35, 1.0);
    const ventralCore = new THREE.Mesh(ventralCoreGeo, this.cherenkovMat);
    ventralCore.position.set(0, -0.135, 0);
    this.craftGroup.add(ventralCore);

    // 6. Adorable Future Capybara Pilot Sitting in the Grogu Hover-Pram
    this.pilotGroup = new THREE.Group();
    this.pilotGroup.position.set(0, 0.055, 0.015);
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

    // Plump seated torso tucked inside the pram cushion
    const pilotTorsoGeo = new THREE.CapsuleGeometry(0.105, 0.1, 6, 12);
    const pilotTorso = new THREE.Mesh(pilotTorsoGeo, this.furMat);
    pilotTorso.position.set(0, 0.07, 0.025);
    pilotTorso.rotation.x = 0.16;
    this.pilotGroup.add(pilotTorso);

    // Tiny paws resting forward on the pram lip (classic Grogu pose)
    const pawGeo = new THREE.SphereGeometry(0.032, 8, 8);
    const pawL = new THREE.Mesh(pawGeo, this.snoutMat);
    pawL.position.set(-0.095, 0.055, -0.145);
    const pawR = new THREE.Mesh(pawGeo, this.snoutMat);
    pawR.position.set(0.095, 0.055, -0.145);
    this.pilotGroup.add(pawL, pawR);

    // Capybara head & blocky gentle snout peeking cleanly above the pram rim
    const pilotHeadGeo = new THREE.SphereGeometry(0.102, 14, 12);
    const pilotHead = new THREE.Mesh(pilotHeadGeo, this.furMat);
    pilotHead.position.set(0, 0.215, -0.015);
    pilotHead.scale.set(0.95, 0.92, 1.18);
    this.pilotGroup.add(pilotHead);

    const pilotSnoutGeo = new THREE.BoxGeometry(0.098, 0.072, 0.1);
    const pilotSnout = new THREE.Mesh(pilotSnoutGeo, this.snoutMat);
    pilotSnout.position.set(0, 0.198, -0.105);
    this.pilotGroup.add(pilotSnout);

    const earGeo = new THREE.SphereGeometry(0.028, 8, 8);
    const earL = new THREE.Mesh(earGeo, this.snoutMat);
    earL.position.set(-0.07, 0.285, 0.02);
    const earR = new THREE.Mesh(earGeo, this.snoutMat);
    earR.position.set(0.07, 0.285, 0.02);
    this.pilotGroup.add(earL, earR);

    const visorGeo = new THREE.BoxGeometry(0.155, 0.04, 0.055);
    const pilotVisor = new THREE.Mesh(visorGeo, this.visorMat);
    pilotVisor.position.set(0, 0.228, -0.082);
    this.pilotGroup.add(pilotVisor);

    const headYuzuGeo = new THREE.SphereGeometry(0.044, 10, 10);
    this.headYuzuMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.26,
      metalness: 0.04,
    });
    const headYuzu = new THREE.Mesh(headYuzuGeo, this.headYuzuMat);
    headYuzu.position.set(0, 0.325, 0.005);
    this.pilotGroup.add(headYuzu);

    // Pre-built pilot headgear accessories toggled via .visible (zero runtime allocations)
    this.hatCrownGroup = new THREE.Group();
    const pilotCrownGeo = new THREE.CylinderGeometry(0.068, 0.058, 0.042, 8, 1, true);
    const pilotCrownMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.92,
      roughness: 0.14,
      envMapIntensity: 1.35,
      side: THREE.DoubleSide,
    });
    const pilotCrownMesh = new THREE.Mesh(pilotCrownGeo, pilotCrownMat);
    pilotCrownMesh.position.set(0, 0.315, 0.005);
    this.hatCrownGroup.add(pilotCrownMesh);
    this.hatCrownGroup.visible = false;
    this.pilotGroup.add(this.hatCrownGroup);

    this.hatFlowerGroup = new THREE.Group();
    const petalGeo = new THREE.SphereGeometry(0.026, 8, 8);
    petalGeo.scale(1.2, 0.4, 0.65);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.4 });
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(petalGeo, petalMat);
      p.position.set(-0.052, 0.31, 0.015);
      p.rotation.y = (i * Math.PI * 2) / 5;
      p.translateX(0.02);
      this.hatFlowerGroup.add(p);
    }
    this.hatFlowerGroup.visible = false;
    this.pilotGroup.add(this.hatFlowerGroup);

    this.hatWizardGroup = new THREE.Group();
    const wizMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.42 });
    const wizBrimGeo = new THREE.RingGeometry(0.052, 0.105, 16);
    const wizBrim = new THREE.Mesh(wizBrimGeo, wizMat);
    wizBrim.rotation.x = Math.PI * 0.5;
    wizBrim.position.set(0, 0.295, 0.005);
    const wizConeGeo = new THREE.ConeGeometry(0.058, 0.115, 12);
    const wizCone = new THREE.Mesh(wizConeGeo, wizMat);
    wizCone.position.set(0, 0.355, 0.005);
    this.hatWizardGroup.add(wizBrim, wizCone);
    this.hatWizardGroup.visible = false;
    this.pilotGroup.add(this.hatWizardGroup);

    const haloGeo = new THREE.TorusGeometry(0.08, 0.012, 10, 22);
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.75,
      roughness: 0.12,
    });
    this.hatHaloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.hatHaloMesh.rotation.x = Math.PI * 0.5;
    this.hatHaloMesh.position.set(0, 0.39, 0.005);
    this.hatHaloMesh.visible = false;
    this.pilotGroup.add(this.hatHaloMesh);

    this.hatPartyGroup = new THREE.Group();
    const partyConeGeo = new THREE.ConeGeometry(0.04, 0.095, 12);
    const partyConeMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.32 });
    const partyCone = new THREE.Mesh(partyConeGeo, partyConeMat);
    partyCone.position.set(-0.05, 0.355, -0.005);
    partyCone.rotation.z = 0.35;
    const partyPomGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const partyPomMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
    const partyPom = new THREE.Mesh(partyPomGeo, partyPomMat);
    partyPom.position.set(-0.08, 0.4, -0.005);
    this.hatPartyGroup.add(partyCone, partyPom);
    this.hatPartyGroup.visible = false;
    this.pilotGroup.add(this.hatPartyGroup);

    // 7. Compact Micro-Reticle & Subtle Rear Thruster Glow Vents on Saucer Aft Rim
    const reticleGeo = new THREE.RingGeometry(0.11, 0.126, 24);
    this.consoleReticle = new THREE.Mesh(reticleGeo, this.cherenkovMat);
    this.consoleReticle.position.set(0, 0.145, -0.245);
    this.consoleReticle.rotation.x = -0.55;
    this.craftGroup.add(this.consoleReticle);

    const plumeGeo = new THREE.ConeGeometry(0.036, 0.22, 10);
    plumeGeo.rotateX(Math.PI * 0.5);
    this.plumeLeft = new THREE.Mesh(plumeGeo, this.cherenkovMat);
    this.plumeLeft.position.set(-0.2, -0.02, 0.52);
    this.plumeRight = new THREE.Mesh(plumeGeo, this.cherenkovMat);
    this.plumeRight.position.set(0.2, -0.02, 0.52);
    this.craftGroup.add(this.plumeLeft, this.plumeRight);

    // 8. Low-Profile Dorsal Micro-Beacon behind Pram Hood
    const spireGeo = new THREE.ConeGeometry(0.025, 0.09, 6);
    const spire = new THREE.Mesh(spireGeo, this.brassMat);
    spire.position.set(0, 0.11, 0.35);
    this.craftGroup.add(spire);

    this.dorsalBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    const beaconOrbGeo = new THREE.OctahedronGeometry(0.03, 0);
    const beaconOrb = new THREE.Mesh(beaconOrbGeo, this.dorsalBeaconMat);
    beaconOrb.position.set(0, 0.175, 0.35);
    this.craftGroup.add(beaconOrb);

    this.geometriesToDispose.push(
      saucerGeo,
      hoodGeo,
      cushionRimGeo,
      astrolabeGeo,
      pramArchGeo,
      canopyGeo,
      nodeOrbGeo,
      ventralRingGeo,
      ventralCoreGeo,
      pilotTorsoGeo,
      pawGeo,
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
      plumeGeo,
      spireGeo,
      beaconOrbGeo
    );
    this.materialsToDispose.push(
      titaniumMat,
      pramShellMat,
      cushionMat,
      this.brassMat,
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

    // Gentle equatorial saucer gyro precession + float hover bobbing like a hover pram
    this.brassAstrolabe.rotation.z += dt * (0.65 + Math.abs(scaleVelocity) * 0.45);
    this.brassAstrolabe.rotation.y = Math.sin(this.simTime * 1.2) * 0.08;
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
    this.craftGroup.position.y = Math.sin(this.simTime * 2.3) * 0.032;

    // Subtle reactive Cherenkov thruster vents & ventral anti-gravity pulse
    const thrustNorm = THREE.MathUtils.clamp(Math.abs(scaleVelocity) / 4.2, 0.12, 1.85);
    const flicker = 1.0 + Math.sin(this.simTime * 34.0) * 0.08;
    const plumeZ = (0.35 + thrustNorm * 0.85) * flicker;
    this.plumeLeft.scale.set(0.85 + thrustNorm * 0.2, 0.85 + thrustNorm * 0.2, plumeZ);
    this.plumeRight.scale.set(0.85 + thrustNorm * 0.2, 0.85 + thrustNorm * 0.2, plumeZ);
    const hoverPulse = 0.96 + Math.sin(this.simTime * 6.0) * 0.05;
    this.ventralHoverRing.scale.setScalar(hoverPulse);
    this.cherenkovMat.emissiveIntensity = 1.1 + thrustNorm * 1.35;

    // Smoothly fade craft hull in Telescope view so central astronomical optics stay clear
    const targetOpacity = this.mode === 'telescope_first_person' ? 0.0 : 1.0;
    this.hullOpacity = THREE.MathUtils.damp(this.hullOpacity, targetOpacity, 10.0, dt);
    this.root.visible = this.hullOpacity > 0.02;
    this.canopyMat.opacity = 0.3 * this.hullOpacity;
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
    metalness: 0.92,
    roughness: 0.15,
    envMapIntensity: 1.35,
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
