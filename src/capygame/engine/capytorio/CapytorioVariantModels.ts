import * as THREE from 'three';
import { CAPYTORIO_TILE_SIZE } from '../CapytorioData';

export interface CapytorioVariantMaterials {
  steelDark: THREE.MeshStandardMaterial;
  steelLight: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  hazardYellow: THREE.MeshStandardMaterial;
  brick: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  labGlass: THREE.MeshStandardMaterial;
  darkVoid: THREE.MeshStandardMaterial;
  statusLampIdle: THREE.MeshStandardMaterial;
  statusLampOn: THREE.MeshStandardMaterial;
  furnaceHearthIdle: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  ceramicWhite: THREE.MeshStandardMaterial;
  solarBlue: THREE.MeshStandardMaterial;
  cyanGlow: THREE.MeshStandardMaterial;
  emeraldGlow: THREE.MeshStandardMaterial;
  rubyGlow: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
}

export interface CapytorioVariantBuildContext {
  getCachedGeo: (key: string, builder: () => THREE.BufferGeometry) => THREE.BufferGeometry;
  chamferedBox: (w: number, h: number, d: number, bevel?: number) => THREE.BufferGeometry;
  mergeGeos: (geos: THREE.BufferGeometry[]) => THREE.BufferGeometry;
  mats: CapytorioVariantMaterials;
  accentMat: THREE.MeshStandardMaterial;
  accentMeshes: THREE.Mesh[];
}

/**
 * Set of all placeable variant IDs that construct their own dedicated procedural 3D silhouette
 * (instead of inheriting the generic base archetype mesh).
 */
export const DEDICATED_CAPYTORIO_VARIANT_MODELS = new Set<string>([
  // Power distribution
  'small_electric_pole',
  'medium_electric_pole',
  'big_electric_pole',
  'substation',
  // Defenses
  'stone_wall',
  'gate',
  'gun_turret',
  'laser_turret',
  // Power generation
  'solar_panel',
  'accumulator',
  'nuclear_reactor',
  'steam_turbine',
  // Special buildings
  'offshore_pump',
  'beacon',
  'radar',
  'rocket_silo',
  // Furnace tiers
  'stone_furnace',
  'steel_furnace',
  'electric_furnace',
  // Fluids & Chemical
  'pipe',
  'pipe_to_ground',
  'pump',
  'oil_refinery',
  'chemical_plant',
  // Rail & Trains
  'rail',
  'train_stop',
  'locomotive',
  'cargo_wagon',
  // Robotics
  'roboport',
]);

/**
 * Returns true if the given variant builds its own full foundation/frame and should skip
 * the default generic cast-iron plinth.
 */
export function variantSkipsDefaultPlinth(variantItemId?: string): boolean {
  if (!variantItemId) return false;
  return (
    variantItemId === 'small_electric_pole' ||
    variantItemId === 'medium_electric_pole' ||
    variantItemId === 'big_electric_pole' ||
    variantItemId === 'stone_wall' ||
    variantItemId === 'gate' ||
    variantItemId === 'pipe' ||
    variantItemId === 'pipe_to_ground' ||
    variantItemId === 'pump' ||
    variantItemId === 'rail' ||
    variantItemId === 'train_stop' ||
    variantItemId === 'locomotive' ||
    variantItemId === 'cargo_wagon' ||
    variantItemId === 'offshore_pump'
  );
}

function addCastReceive(mesh: THREE.Mesh, cast = true, receive = true): THREE.Mesh {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * Populates `g` with a clean-room procedural 3D Capytorio model for `variantItemId`.
 * All BufferGeometries are cached via `ctx.getCachedGeo(...)` for zero VRAM leaks.
 * Returns `true` if a dedicated model was built, or `false` to fall back to the base archetype.
 */
export function buildDedicatedVariantModel(
  variantItemId: string,
  g: THREE.Group,
  ctx: CapytorioVariantBuildContext
): boolean {
  const { getCachedGeo, chamferedBox, mergeGeos, mats, accentMat, accentMeshes } = ctx;

  // =========================================================================
  // 1. POWER DISTRIBUTION (small/medium/big electric poles & substation)
  // =========================================================================
  if (variantItemId === 'small_electric_pole') {
    const base = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_sm_pole_base', () => {
          const collar = new THREE.CylinderGeometry(0.24, 0.34, 0.24, 8);
          collar.translate(0, 0.12, 0);
          const bracket = new THREE.BoxGeometry(0.92, 0.1, 0.14);
          bracket.translate(0, 2.08, 0);
          const braceL = new THREE.BoxGeometry(0.06, 0.42, 0.06);
          braceL.rotateZ(-0.68);
          braceL.translate(-0.22, 1.92, 0);
          const braceR = new THREE.BoxGeometry(0.06, 0.42, 0.06);
          braceR.rotateZ(0.68);
          braceR.translate(0.22, 1.92, 0);
          return mergeGeos([collar, bracket, braceL, braceR]);
        }),
        mats.steelDark
      )
    );
    g.add(base);

    const timber = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_sm_pole_timber', () => {
          const post = new THREE.CylinderGeometry(0.14, 0.19, 2.38, 8);
          post.translate(0, 1.19, 0);
          const arm = new THREE.BoxGeometry(1.18, 0.13, 0.16);
          arm.translate(0, 2.16, 0);
          return mergeGeos([post, arm]);
        }),
        mats.timber
      )
    );
    g.add(timber);

    const insulators = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_sm_pole_insulators', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const ix of [-0.46, 0, 0.46]) {
            const bell = new THREE.CylinderGeometry(0.075, 0.095, 0.18, 8);
            bell.translate(ix, 2.32, 0);
            parts.push(bell);
            const cap = new THREE.SphereGeometry(0.068, 7, 5);
            cap.translate(ix, 2.42, 0);
            parts.push(cap);
          }
          return mergeGeos(parts);
        }),
        mats.ceramicWhite
      )
    );
    g.add(insulators);

    const copperBind = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_sm_pole_copper', () => {
          const coil = new THREE.TorusGeometry(0.15, 0.03, 6, 12);
          coil.rotateX(Math.PI * 0.5);
          coil.translate(0, 1.96, 0);
          return coil;
        }),
        mats.copper
      ),
      false,
      false
    );
    g.add(copperBind);
    return true;
  }

  if (variantItemId === 'medium_electric_pole') {
    const mast = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_med_pole_mast', () => {
          const parts: THREE.BufferGeometry[] = [];
          const foot = chamferedBox(0.92, 0.18, 0.92, 0.08);
          foot.translate(0, 0.09, 0);
          parts.push(foot);
          // 4 tapered galvanized lattice corner legs
          for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
              const leg = new THREE.CylinderGeometry(0.045, 0.075, 2.66, 6);
              leg.rotateZ(sx * 0.075);
              leg.rotateX(-sz * 0.075);
              leg.translate(sx * 0.22, 1.44, sz * 0.22);
              parts.push(leg);
            }
          }
          // Lattice cross-rings
          for (const ly of [0.68, 1.32, 1.96, 2.52]) {
            const w = 0.64 - (ly / 2.66) * 0.34;
            const ringX1 = new THREE.BoxGeometry(w, 0.055, 0.055);
            ringX1.translate(0, ly, -w * 0.45);
            const ringX2 = new THREE.BoxGeometry(w, 0.055, 0.055);
            ringX2.translate(0, ly, w * 0.45);
            const ringZ1 = new THREE.BoxGeometry(0.055, 0.055, w);
            ringZ1.translate(-w * 0.45, ly, 0);
            const ringZ2 = new THREE.BoxGeometry(0.055, 0.055, w);
            ringZ2.translate(w * 0.45, ly, 0);
            parts.push(ringX1, ringX2, ringZ1, ringZ2);
          }
          // Dual galvanized crossarms
          const lowerArm = new THREE.BoxGeometry(1.48, 0.11, 0.14);
          lowerArm.translate(0, 2.24, 0);
          const upperArm = new THREE.BoxGeometry(1.16, 0.11, 0.14);
          upperArm.translate(0, 2.68, 0);
          parts.push(lowerArm, upperArm);
          return mergeGeos(parts);
        }),
        mats.steelLight
      )
    );
    g.add(mast);

    const insulators = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_med_pole_insulators', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const ix of [-0.62, 0.62]) {
            const b1 = new THREE.CylinderGeometry(0.065, 0.09, 0.22, 8);
            b1.translate(ix, 2.38, 0);
            parts.push(b1);
          }
          for (const ix of [-0.48, 0, 0.48]) {
            const b2 = new THREE.CylinderGeometry(0.065, 0.09, 0.22, 8);
            b2.translate(ix, 2.82, 0);
            parts.push(b2);
          }
          return mergeGeos(parts);
        }),
        mats.ceramicWhite
      )
    );
    g.add(insulators);

    const capAccent = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_med_pole_accent', () => {
          const box = new THREE.BoxGeometry(0.36, 0.26, 0.36);
          box.translate(0, 0.34, 0);
          return box;
        }),
        accentMat
      )
    );
    g.add(capAccent);
    accentMeshes.push(capAccent);
    return true;
  }

  if (variantItemId === 'big_electric_pole') {
    const tower = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_big_pole_tower', () => {
          const parts: THREE.BufferGeometry[] = [];
          // 4 concrete-bolted footings
          for (const sx of [-0.66, 0.66]) {
            for (const sz of [-0.66, 0.66]) {
              const pad = chamferedBox(0.36, 0.22, 0.36, 0.05);
              pad.translate(sx, 0.11, sz);
              parts.push(pad);
            }
          }
          // 4 tall angled truss legs meeting near top spire
          for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
              const leg = new THREE.CylinderGeometry(0.055, 0.1, 3.38, 6);
              leg.rotateZ(sx * 0.145);
              leg.rotateX(-sz * 0.145);
              leg.translate(sx * 0.38, 1.72, sz * 0.38);
              parts.push(leg);
            }
          }
          // Truss cross-girders
          for (const ly of [0.74, 1.48, 2.22, 2.94]) {
            const w = Math.max(0.34, 1.24 - (ly / 3.4) * 0.88);
            const g1 = new THREE.BoxGeometry(w, 0.07, 0.07);
            g1.translate(0, ly, -w * 0.45);
            const g2 = new THREE.BoxGeometry(w, 0.07, 0.07);
            g2.translate(0, ly, w * 0.45);
            const g3 = new THREE.BoxGeometry(0.07, 0.07, w);
            g3.translate(-w * 0.45, ly, 0);
            const g4 = new THREE.BoxGeometry(0.07, 0.07, w);
            g4.translate(w * 0.45, ly, 0);
            parts.push(g1, g2, g3, g4);
          }
          // Wide twin transmission truss arms + lightning spire
          const armMain = new THREE.BoxGeometry(2.14, 0.15, 0.18);
          armMain.translate(0, 2.86, 0);
          const armTop = new THREE.BoxGeometry(1.48, 0.12, 0.16);
          armTop.translate(0, 3.24, 0);
          const spire = new THREE.ConeGeometry(0.14, 0.56, 6);
          spire.translate(0, 3.6, 0);
          parts.push(armMain, armTop, spire);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(tower);

    const bells = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_big_pole_bells', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const [ix, iy] of [
            [-0.96, 2.66],
            [0.96, 2.66],
            [-0.64, 3.04],
            [0.64, 3.04],
          ]) {
            const bell1 = new THREE.CylinderGeometry(0.06, 0.12, 0.14, 8);
            bell1.translate(ix, iy, 0);
            const bell2 = new THREE.CylinderGeometry(0.06, 0.12, 0.14, 8);
            bell2.translate(ix, iy - 0.13, 0);
            parts.push(bell1, bell2);
          }
          return mergeGeos(parts);
        }),
        mats.ceramicWhite
      )
    );
    g.add(bells);

    const hazardBand = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_big_pole_hazard', () => {
          const band = new THREE.BoxGeometry(0.92, 0.22, 0.92);
          band.translate(0, 0.62, 0);
          return band;
        }),
        mats.hazardYellow
      )
    );
    g.add(hazardBand);
    return true;
  }

  if (variantItemId === 'substation') {
    // 2x2 transformer bay (scaled ~1.92x1.44x1.92 by resolveMachineVisualScale)
    const housing = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_substation_housing', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Central transformer core block
          const core = chamferedBox(1.22, 0.92, 1.04, 0.1);
          core.translate(0, 0.72, 0.08);
          parts.push(core);
          // Cooling radiator fins along left/right flanks
          for (const sx of [-0.72, 0.72]) {
            for (const fz of [-0.32, -0.1, 0.12, 0.34]) {
              const fin = new THREE.BoxGeometry(0.24, 0.76, 0.07);
              fin.translate(sx, 0.68, fz + 0.08);
              parts.push(fin);
            }
          }
          // Corner perimeter fence posts
          for (const px of [-0.88, 0.88]) {
            for (const pz of [-0.88, 0.88]) {
              const post = new THREE.CylinderGeometry(0.06, 0.07, 0.82, 6);
              post.translate(px, 0.62, pz);
              parts.push(post);
            }
          }
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(housing);

    const busbars = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_substation_busbars', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const bx of [-0.42, 0.42]) {
            const bar = new THREE.CylinderGeometry(0.055, 0.055, 1.24, 8);
            bar.rotateX(Math.PI * 0.5);
            bar.translate(bx, 1.54, 0.08);
            parts.push(bar);
          }
          const bridge = new THREE.BoxGeometry(0.96, 0.08, 0.14);
          bridge.translate(0, 1.54, 0.08);
          parts.push(bridge);
          return mergeGeos(parts);
        }),
        mats.copper
      )
    );
    g.add(busbars);

    const coils = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_substation_coils', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const cx of [-0.42, 0.42]) {
            for (const cz of [-0.32, 0.48]) {
              const col = new THREE.CylinderGeometry(0.11, 0.15, 0.54, 10);
              col.translate(cx, 1.38, cz);
              parts.push(col);
              const ringA = new THREE.TorusGeometry(0.16, 0.036, 6, 12);
              ringA.rotateX(Math.PI * 0.5);
              ringA.translate(cx, 1.28, cz);
              const ringB = new THREE.TorusGeometry(0.15, 0.036, 6, 12);
              ringB.rotateX(Math.PI * 0.5);
              ringB.translate(cx, 1.46, cz);
              parts.push(ringA, ringB);
            }
          }
          return mergeGeos(parts);
        }),
        mats.cyanGlow
      ),
      false,
      false
    );
    g.add(coils);

    const trim = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_substation_trim', () => {
          const cap = chamferedBox(1.06, 0.14, 0.92, 0.06);
          cap.translate(0, 1.22, 0.08);
          return cap;
        }),
        accentMat
      )
    );
    g.add(trim);
    accentMeshes.push(trim);
    return true;
  }

  // =========================================================================
  // 2. DEFENSES (stone_wall, gate, gun_turret, laser_turret)
  // =========================================================================
  if (variantItemId === 'stone_wall') {
    const masonry = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_stone_wall_body', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Wide base footing spanning full tile so walls connect cleanly
          const foot = chamferedBox(2.44, 0.28, 2.02, 0.1);
          foot.translate(0, 0.14, 0);
          parts.push(foot);
          // Main beveled battlement core
          const wall = chamferedBox(2.38, 1.12, 1.62, 0.12);
          wall.translate(0, 0.82, 0);
          parts.push(wall);
          // 4 reinforced corner buttresses
          for (const bx of [-0.94, 0.94]) {
            for (const bz of [-0.74, 0.74]) {
              const butt = chamferedBox(0.38, 1.04, 0.36, 0.06);
              butt.translate(bx, 0.66, bz);
              parts.push(butt);
            }
          }
          // Top crenelation merlons
          for (const mx of [-0.82, 0, 0.82]) {
            const merlonF = chamferedBox(0.56, 0.26, 0.28, 0.05);
            merlonF.translate(mx, 1.5, -0.56);
            const merlonB = chamferedBox(0.56, 0.26, 0.28, 0.05);
            merlonB.translate(mx, 1.5, 0.56);
            parts.push(merlonF, merlonB);
          }
          return mergeGeos(parts);
        }),
        mats.concrete
      )
    );
    g.add(masonry);

    const ironCaps = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_stone_wall_caps', () => {
          const rail = new THREE.BoxGeometry(2.36, 0.1, 0.94);
          rail.translate(0, 1.4, 0);
          return rail;
        }),
        mats.steelDark
      )
    );
    g.add(ironCaps);
    return true;
  }

  if (variantItemId === 'gate') {
    const frame = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_gate_frame', () => {
          const parts: THREE.BufferGeometry[] = [];
          const track = new THREE.BoxGeometry(2.42, 0.14, 1.68);
          track.translate(0, 0.07, 0);
          parts.push(track);
          // Twin armored side piers
          for (const px of [-0.98, 0.98]) {
            const pier = chamferedBox(0.46, 1.56, 1.48, 0.08);
            pier.translate(px, 0.86, 0);
            parts.push(pier);
          }
          // Overhead gantry arch
          const header = chamferedBox(2.4, 0.26, 1.02, 0.06);
          header.translate(0, 1.68, 0);
          parts.push(header);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(frame);

    const blastLeaf = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_gate_leaf', () => {
          const parts: THREE.BufferGeometry[] = [];
          const leaf = chamferedBox(1.52, 1.24, 0.44, 0.06);
          leaf.translate(0, 0.76, 0);
          parts.push(leaf);
          for (const rx of [-0.42, 0, 0.42]) {
            const rib = new THREE.BoxGeometry(0.14, 1.16, 0.56);
            rib.translate(rx, 0.76, 0);
            parts.push(rib);
          }
          return mergeGeos(parts);
        }),
        mats.steelLight
      )
    );
    g.add(blastLeaf);

    const hazard = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_gate_hazard', () => {
          const barF = new THREE.BoxGeometry(1.56, 0.2, 0.12);
          barF.translate(0, 1.54, -0.52);
          const barB = new THREE.BoxGeometry(1.56, 0.2, 0.12);
          barB.translate(0, 1.54, 0.52);
          return mergeGeos([barF, barB]);
        }),
        mats.hazardYellow
      )
    );
    g.add(hazard);
    return true;
  }

  if (variantItemId === 'gun_turret') {
    const pedestal = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_gun_turret_base', () => {
          const parts: THREE.BufferGeometry[] = [];
          const oct = new THREE.CylinderGeometry(0.76, 0.92, 0.52, 8);
          oct.translate(0, 0.48, 0);
          parts.push(oct);
          const collar = new THREE.CylinderGeometry(0.56, 0.68, 0.22, 10);
          collar.translate(0, 0.84, 0);
          parts.push(collar);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(pedestal);

    const turret = new THREE.Group();
    turret.position.set(0, 0.96, 0);
    g.add(turret);

    const housing = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_gun_turret_head', () => {
          const box = chamferedBox(0.92, 0.58, 1.08, 0.1);
          box.translate(0, 0.34, 0.08);
          const hatch = new THREE.CylinderGeometry(0.28, 0.32, 0.12, 8);
          hatch.translate(0, 0.68, 0.14);
          return mergeGeos([box, hatch]);
        }),
        accentMat
      )
    );
    turret.add(housing);
    accentMeshes.push(housing);

    const barrels = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_gun_turret_barrels', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const bx of [-0.18, 0.18]) {
            const barrel = new THREE.CylinderGeometry(0.068, 0.082, 1.18, 8);
            barrel.rotateX(Math.PI * 0.5);
            barrel.translate(bx, 0.38, -0.86);
            parts.push(barrel);
            const muzzle = new THREE.CylinderGeometry(0.095, 0.085, 0.18, 8);
            muzzle.rotateX(Math.PI * 0.5);
            muzzle.translate(bx, 0.38, -1.42);
            parts.push(muzzle);
          }
          const shroud = new THREE.BoxGeometry(0.52, 0.24, 0.42);
          shroud.translate(0, 0.38, -0.48);
          parts.push(shroud);
          return mergeGeos(parts);
        }),
        mats.steelLight
      )
    );
    turret.add(barrels);

    const ammoBox = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_gun_turret_ammo', () => {
          const drum = chamferedBox(0.32, 0.42, 0.52, 0.05);
          drum.translate(0.58, 0.3, 0.12);
          return drum;
        }),
        mats.brass
      )
    );
    turret.add(ammoBox);

    g.userData.turret = turret;
    g.userData.isSentryTurret = true;
    return true;
  }

  if (variantItemId === 'laser_turret') {
    const pedestal = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_laser_turret_base', () => {
          const parts: THREE.BufferGeometry[] = [];
          const hex = new THREE.CylinderGeometry(0.72, 0.9, 0.56, 6);
          hex.translate(0, 0.5, 0);
          parts.push(hex);
          for (let i = 0; i < 6; i++) {
            const ang = (i * Math.PI) / 3;
            const fin = new THREE.BoxGeometry(0.14, 0.48, 0.24);
            fin.rotateY(-ang);
            fin.translate(Math.cos(ang) * 0.78, 0.52, Math.sin(ang) * 0.78);
            parts.push(fin);
          }
          const neck = new THREE.CylinderGeometry(0.36, 0.48, 0.32, 10);
          neck.translate(0, 0.92, 0);
          parts.push(neck);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(pedestal);

    const turret = new THREE.Group();
    turret.position.set(0, 1.08, 0);
    g.add(turret);

    const gimbal = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_laser_turret_gimbal', () => {
          const parts: THREE.BufferGeometry[] = [];
          const body = chamferedBox(0.78, 0.54, 0.92, 0.12);
          body.translate(0, 0.32, 0.08);
          parts.push(body);
          // 3 focusing optical prongs around crystal emitter
          for (let i = 0; i < 3; i++) {
            const ang = (i * Math.PI * 2) / 3 + Math.PI / 6;
            const prong = new THREE.BoxGeometry(0.1, 0.1, 0.84);
            prong.translate(Math.cos(ang) * 0.26, 0.34 + Math.sin(ang) * 0.24, -0.68);
            parts.push(prong);
          }
          return mergeGeos(parts);
        }),
        mats.steelLight
      )
    );
    turret.add(gimbal);

    const emitterTrim = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_laser_turret_trim', () => {
          const cap = chamferedBox(0.84, 0.18, 0.72, 0.06);
          cap.translate(0, 0.62, 0.08);
          return cap;
        }),
        accentMat
      )
    );
    turret.add(emitterTrim);
    accentMeshes.push(emitterTrim);

    const crystal = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_laser_turret_crystal', () => {
          const lens = new THREE.OctahedronGeometry(0.24, 0);
          lens.scale(0.95, 0.95, 1.55);
          lens.translate(0, 0.34, -0.66);
          return lens;
        }),
        mats.rubyGlow
      ),
      false,
      false
    );
    turret.add(crystal);

    g.userData.turret = turret;
    g.userData.isSentryTurret = true;
    return true;
  }

  // =========================================================================
  // 3. POWER GENERATION (solar_panel, accumulator, nuclear_reactor, steam_turbine)
  // =========================================================================
  if (variantItemId === 'solar_panel') {
    const truss = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_solar_truss', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Front low legs & rear tall legs supporting angled PV deck
          for (const sx of [-0.72, 0.72]) {
            const legF = new THREE.CylinderGeometry(0.06, 0.08, 0.36, 6);
            legF.translate(sx, 0.36, -0.68);
            const legB = new THREE.CylinderGeometry(0.06, 0.08, 0.88, 6);
            legB.translate(sx, 0.62, 0.66);
            parts.push(legF, legB);
          }
          // Tilted frame surround
          const frame = chamferedBox(1.94, 0.12, 1.88, 0.05);
          frame.rotateX(0.32);
          frame.translate(0, 0.82, 0);
          parts.push(frame);
          // Rear inverter junction box
          const jbox = chamferedBox(0.56, 0.36, 0.36, 0.05);
          jbox.translate(0, 0.44, 0.56);
          parts.push(jbox);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(truss);

    const pvCells = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_solar_cells', () => {
          const slab = new THREE.BoxGeometry(1.78, 0.06, 1.72);
          slab.rotateX(0.32);
          slab.translate(0, 0.89, -0.02);
          return slab;
        }),
        mats.solarBlue
      )
    );
    g.add(pvCells);

    const silverGrid = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_solar_grid', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const gx of [-0.56, 0, 0.56]) {
            const bar = new THREE.BoxGeometry(0.036, 0.03, 1.72);
            bar.translate(gx, 0.055, 0);
            parts.push(bar);
          }
          for (const gz of [-0.54, 0, 0.54]) {
            const bar = new THREE.BoxGeometry(1.78, 0.03, 0.036);
            bar.translate(0, 0.055, gz);
            parts.push(bar);
          }
          const merged = mergeGeos(parts);
          merged.rotateX(0.32);
          merged.translate(0, 0.89, -0.02);
          return merged;
        }),
        mats.steelLight
      ),
      false,
      false
    );
    g.add(silverGrid);
    return true;
  }

  if (variantItemId === 'accumulator') {
    const bank = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_accum_bank', () => {
          const parts: THREE.BufferGeometry[] = [];
          const core = new THREE.CylinderGeometry(0.76, 0.82, 1.24, 8);
          core.translate(0, 0.86, 0);
          parts.push(core);
          // 4 heavy vertical clamping ribs
          for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI) / 2 + Math.PI / 4;
            const rib = new THREE.BoxGeometry(0.18, 1.32, 0.24);
            rib.rotateY(-ang);
            rib.translate(Math.cos(ang) * 0.78, 0.86, Math.sin(ang) * 0.78);
            parts.push(rib);
          }
          const cap = new THREE.CylinderGeometry(0.68, 0.78, 0.18, 8);
          cap.translate(0, 1.56, 0);
          parts.push(cap);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(bank);

    const chargeRings = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_accum_rings', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const ry of [0.56, 0.88, 1.2]) {
            const ring = new THREE.TorusGeometry(0.81, 0.068, 8, 16);
            ring.rotateX(Math.PI * 0.5);
            ring.translate(0, ry, 0);
            parts.push(ring);
          }
          const topOrb = new THREE.SphereGeometry(0.24, 10, 8);
          topOrb.translate(0, 1.72, 0);
          parts.push(topOrb);
          return mergeGeos(parts);
        }),
        mats.cyanGlow
      ),
      false,
      false
    );
    g.add(chargeRings);

    const terminals = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_accum_terminals', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const tx of [-0.42, 0.42]) {
            const post = new THREE.CylinderGeometry(0.1, 0.13, 0.44, 8);
            post.translate(tx, 1.82, 0);
            const cap = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 8);
            cap.translate(tx, 2.04, 0);
            parts.push(post, cap);
          }
          return mergeGeos(parts);
        }),
        mats.copper
      )
    );
    g.add(terminals);
    return true;
  }

  if (variantItemId === 'nuclear_reactor') {
    const containment = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_nuclear_pad', () => {
          const parts: THREE.BufferGeometry[] = [];
          const octPad = new THREE.CylinderGeometry(0.98, 1.06, 0.38, 8);
          octPad.translate(0, 0.42, 0);
          parts.push(octPad);
          // 4 heavy concrete shielding corner buttresses
          for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI) / 2 + Math.PI / 4;
            const shield = chamferedBox(0.42, 1.18, 0.42, 0.06);
            shield.rotateY(-ang);
            shield.translate(Math.cos(ang) * 0.78, 1.02, Math.sin(ang) * 0.78);
            parts.push(shield);
          }
          return mergeGeos(parts);
        }),
        mats.concrete
      )
    );
    g.add(containment);

    const shroud = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_nuclear_shroud', () => {
          const parts: THREE.BufferGeometry[] = [];
          const lowerRing = new THREE.CylinderGeometry(0.76, 0.84, 0.34, 12);
          lowerRing.translate(0, 0.72, 0);
          const upperDome = new THREE.CylinderGeometry(0.56, 0.78, 0.36, 12);
          upperDome.translate(0, 1.62, 0);
          const crown = new THREE.CylinderGeometry(0.32, 0.42, 0.24, 10);
          crown.translate(0, 1.9, 0);
          parts.push(lowerRing, upperDome, crown);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(shroud);

    const coreGlow = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_nuclear_core', () => {
          const core = new THREE.CylinderGeometry(0.62, 0.62, 0.64, 12);
          core.translate(0, 1.18, 0);
          const halo = new THREE.TorusGeometry(0.46, 0.06, 8, 16);
          halo.rotateX(Math.PI * 0.5);
          halo.translate(0, 1.82, 0);
          return mergeGeos([core, halo]);
        }),
        mats.emeraldGlow
      ),
      false,
      false
    );
    g.add(coreGlow);
    g.userData.nuclearCore = coreGlow;

    const heatPipes = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_nuclear_pipes', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI) / 2;
            const pipe = new THREE.CylinderGeometry(0.13, 0.13, 0.72, 8);
            pipe.rotateZ(Math.PI * 0.5);
            pipe.rotateY(ang);
            pipe.translate(Math.cos(ang) * 0.76, 0.76, Math.sin(ang) * 0.76);
            parts.push(pipe);
            const flange = new THREE.CylinderGeometry(0.19, 0.19, 0.1, 8);
            flange.rotateZ(Math.PI * 0.5);
            flange.rotateY(ang);
            flange.translate(Math.cos(ang) * 1.04, 0.76, Math.sin(ang) * 1.04);
            parts.push(flange);
          }
          return mergeGeos(parts);
        }),
        mats.copper
      )
    );
    g.add(heatPipes);
    return true;
  }

  if (variantItemId === 'steam_turbine') {
    const casing = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_turbine_casing', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Multi-stage stepped horizontal turbine drums along Z
          const hp = new THREE.CylinderGeometry(0.44, 0.48, 0.42, 12);
          hp.rotateX(Math.PI * 0.5);
          hp.translate(0, 0.92, -0.58);
          const mp = new THREE.CylinderGeometry(0.56, 0.58, 0.48, 12);
          mp.rotateX(Math.PI * 0.5);
          mp.translate(0, 0.96, -0.06);
          const lp = new THREE.CylinderGeometry(0.68, 0.68, 0.54, 12);
          lp.rotateX(Math.PI * 0.5);
          lp.translate(0, 1.0, 0.5);
          parts.push(hp, mp, lp);
          // Cooling ribs around stages
          for (const rz of [-0.66, -0.48, -0.18, 0.06, 0.36, 0.64]) {
            const rad = rz < -0.3 ? 0.5 : rz < 0.2 ? 0.61 : 0.72;
            const rib = new THREE.TorusGeometry(rad, 0.042, 6, 16);
            rib.translate(0, 0.96, rz);
            parts.push(rib);
          }
          // Heavy bed saddles
          for (const sz of [-0.54, 0.48]) {
            const saddle = new THREE.BoxGeometry(1.32, 0.46, 0.24);
            saddle.translate(0, 0.42, sz);
            parts.push(saddle);
          }
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(casing);

    const generatorBox = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_turbine_genbox', () => {
          const box = chamferedBox(1.12, 0.78, 0.52, 0.08);
          box.translate(0, 0.86, 0.74);
          return box;
        }),
        accentMat
      )
    );
    g.add(generatorBox);
    accentMeshes.push(generatorBox);

    const manifold = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_turbine_manifold', () => {
          const parts: THREE.BufferGeometry[] = [];
          const exhaust = new THREE.CylinderGeometry(0.24, 0.3, 0.72, 10);
          exhaust.translate(0, 1.66, -0.06);
          parts.push(exhaust);
          for (const sx of [-0.66, 0.66]) {
            const pipe = new THREE.CylinderGeometry(0.11, 0.11, 1.44, 8);
            pipe.rotateX(Math.PI * 0.5);
            pipe.translate(sx, 0.88, -0.04);
            parts.push(pipe);
          }
          return mergeGeos(parts);
        }),
        mats.copper
      )
    );
    g.add(manifold);

    const rotor = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_turbine_rotor', () => {
          const parts: THREE.BufferGeometry[] = [];
          const hub = new THREE.CylinderGeometry(0.18, 0.18, 0.22, 10);
          hub.rotateX(Math.PI * 0.5);
          parts.push(hub);
          for (let i = 0; i < 6; i++) {
            const blade = new THREE.BoxGeometry(0.1, 0.74, 0.06);
            blade.rotateZ((i * Math.PI) / 3);
            parts.push(blade);
          }
          const rim = new THREE.TorusGeometry(0.38, 0.045, 6, 16);
          parts.push(rim);
          return mergeGeos(parts);
        }),
        mats.brass
      )
    );
    rotor.position.set(0, 0.92, -0.88);
    g.add(rotor);
    g.userData.flywheel = rotor;
    g.userData.flywheelAxisZ = true;
    return true;
  }

  // =========================================================================
  // 4. SPECIAL BUILDINGS (offshore_pump, beacon, radar, rocket_silo)
  // =========================================================================
  if (variantItemId === 'offshore_pump') {
    const housing = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_offshore_pump_body', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Floating/shoreline mounting deck
          const deck = chamferedBox(1.56, 0.22, 1.62, 0.08);
          deck.translate(0, 0.14, 0);
          parts.push(deck);
          // Intake suction pipe plunging down into water
          const intake = new THREE.CylinderGeometry(0.28, 0.34, 0.88, 10);
          intake.translate(0, -0.18, 0.32);
          parts.push(intake);
          // Centrifugal volute snail housing
          const volute = new THREE.CylinderGeometry(0.48, 0.52, 0.44, 12);
          volute.translate(0, 0.48, 0.12);
          parts.push(volute);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(housing);

    const motor = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_offshore_pump_motor', () => {
          const cyl = new THREE.CylinderGeometry(0.34, 0.38, 0.56, 10);
          cyl.translate(0, 0.82, 0.12);
          return cyl;
        }),
        accentMat
      )
    );
    g.add(motor);
    accentMeshes.push(motor);

    const elbow = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_offshore_pump_elbow', () => {
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.48, -0.16),
            new THREE.Vector3(0, 0.56, -0.56),
            new THREE.Vector3(0, 0.44, -0.96),
          ]);
          const tube = new THREE.TubeGeometry(curve, 10, 0.17, 8, false);
          const flange = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10);
          flange.rotateX(Math.PI * 0.5);
          flange.translate(0, 0.44, -1.02);
          return mergeGeos([tube, flange]);
        }),
        mats.copper
      )
    );
    g.add(elbow);

    const impeller = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_offshore_pump_impeller', () => {
          const parts: THREE.BufferGeometry[] = [];
          const cap = new THREE.CylinderGeometry(0.14, 0.14, 0.14, 8);
          parts.push(cap);
          for (let i = 0; i < 4; i++) {
            const blade = new THREE.BoxGeometry(0.58, 0.08, 0.09);
            blade.rotateY((i * Math.PI) / 4);
            parts.push(blade);
          }
          return mergeGeos(parts);
        }),
        mats.brass
      )
    );
    impeller.position.set(0, 1.18, 0.12);
    g.add(impeller);
    g.userData.spinPart = impeller;
    g.userData.isPumpImpeller = true;
    return true;
  }

  if (variantItemId === 'beacon') {
    const base = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_beacon_base', () => {
          const parts: THREE.BufferGeometry[] = [];
          const tier1 = new THREE.CylinderGeometry(0.92, 1.04, 0.42, 8);
          tier1.translate(0, 0.44, 0);
          const tier2 = new THREE.CylinderGeometry(0.68, 0.84, 0.46, 8);
          tier2.translate(0, 0.88, 0);
          const spire = new THREE.CylinderGeometry(0.12, 0.24, 1.18, 8);
          spire.translate(0, 1.56, 0);
          parts.push(tier1, tier2, spire);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(base);

    const bayAccent = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_beacon_bays', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI) / 2;
            const bay = chamferedBox(0.46, 0.36, 0.24, 0.04);
            bay.rotateY(-ang);
            bay.translate(Math.cos(ang) * 0.82, 0.56, Math.sin(ang) * 0.82);
            parts.push(bay);
          }
          return mergeGeos(parts);
        }),
        accentMat
      )
    );
    g.add(bayAccent);
    accentMeshes.push(bayAccent);

    const emitter = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_beacon_emitter', () => {
          const orb = new THREE.OctahedronGeometry(0.28, 1);
          orb.translate(0, 2.16, 0);
          return orb;
        }),
        mats.cyanGlow
      ),
      false,
      false
    );
    g.add(emitter);

    const ringA = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_beacon_ring_a', () => new THREE.TorusGeometry(0.66, 0.048, 8, 18)),
        mats.steelLight
      )
    );
    ringA.position.set(0, 1.72, 0);
    g.add(ringA);

    const ringB = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_beacon_ring_b', () => new THREE.TorusGeometry(0.48, 0.042, 8, 18)),
        mats.cyanGlow
      ),
      false,
      false
    );
    ringB.position.set(0, 1.92, 0);
    g.add(ringB);

    g.userData.spinPart = emitter;
    g.userData.labRingA = ringA;
    g.userData.labRingB = ringB;
    g.userData.isBeaconAntennas = true;
    return true;
  }

  if (variantItemId === 'radar') {
    const tripod = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_radar_tripod', () => {
          const parts: THREE.BufferGeometry[] = [];
          const cabinet = chamferedBox(0.92, 0.52, 0.82, 0.06);
          cabinet.translate(0, 0.48, 0);
          parts.push(cabinet);
          for (let i = 0; i < 3; i++) {
            const ang = (i * Math.PI * 2) / 3 + Math.PI / 6;
            const leg = new THREE.CylinderGeometry(0.08, 0.13, 1.24, 6);
            leg.rotateZ(Math.cos(ang) * 0.24);
            leg.rotateX(-Math.sin(ang) * 0.24);
            leg.translate(Math.cos(ang) * 0.52, 0.82, Math.sin(ang) * 0.52);
            parts.push(leg);
          }
          const hub = new THREE.CylinderGeometry(0.28, 0.36, 0.32, 10);
          hub.translate(0, 1.38, 0);
          parts.push(hub);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(tripod);

    const dishGroup = new THREE.Group();
    dishGroup.position.set(0, 1.62, 0);
    g.add(dishGroup);

    const dish = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_radar_dish', () => {
          const pts = [
            new THREE.Vector2(0.01, 0.0),
            new THREE.Vector2(0.32, 0.06),
            new THREE.Vector2(0.64, 0.2),
            new THREE.Vector2(0.88, 0.42),
            new THREE.Vector2(0.82, 0.44),
            new THREE.Vector2(0.58, 0.24),
            new THREE.Vector2(0.28, 0.1),
            new THREE.Vector2(0.01, 0.06),
          ];
          const bowl = new THREE.LatheGeometry(pts, 14);
          bowl.rotateX(Math.PI * 0.36);
          bowl.translate(0, 0.28, 0.12);
          const feedRod = new THREE.CylinderGeometry(0.04, 0.05, 0.64, 6);
          feedRod.rotateX(Math.PI * 0.36);
          feedRod.translate(0, 0.44, -0.22);
          const feedHead = new THREE.SphereGeometry(0.11, 8, 6);
          feedHead.translate(0, 0.56, -0.48);
          return mergeGeos([bowl, feedRod, feedHead]);
        }),
        mats.steelLight
      )
    );
    dishGroup.add(dish);

    const dishRim = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_radar_rim', () => {
          const rim = new THREE.TorusGeometry(0.85, 0.045, 6, 16);
          rim.rotateX(Math.PI * 0.86);
          rim.translate(0, 0.48, -0.18);
          return rim;
        }),
        accentMat
      )
    );
    dishGroup.add(dishRim);
    accentMeshes.push(dishRim);

    g.userData.spinPart = dishGroup;
    g.userData.isRadarDish = true;
    return true;
  }

  if (variantItemId === 'rocket_silo') {
    // 3x3 recessed concrete launch bay + hazard perimeter + 4 gantry arms + emerging Capy-orange rocket nosecone
    const bay = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_silo_bay', () => {
          const parts: THREE.BufferGeometry[] = [];
          // 4 perimeter concrete blast walls framing recessed square launch shaft
          const wallN = chamferedBox(2.04, 0.68, 0.34, 0.05);
          wallN.translate(0, 0.56, -0.84);
          const wallS = chamferedBox(2.04, 0.68, 0.34, 0.05);
          wallS.translate(0, 0.56, 0.84);
          const wallW = chamferedBox(0.34, 0.68, 1.38, 0.05);
          wallW.translate(-0.84, 0.56, 0);
          const wallE = chamferedBox(0.34, 0.68, 1.38, 0.05);
          wallE.translate(0.84, 0.56, 0);
          parts.push(wallN, wallS, wallW, wallE);
          return mergeGeos(parts);
        }),
        mats.concrete
      )
    );
    g.add(bay);

    const pitVoid = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_silo_pit', () => {
          const floor = new THREE.BoxGeometry(1.36, 0.14, 1.36);
          floor.translate(0, 0.28, 0);
          return floor;
        }),
        mats.darkVoid
      ),
      false,
      false
    );
    g.add(pitVoid);

    const hazardRim = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_silo_hazard', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const sz of [-0.74, 0.74]) {
            const strip = new THREE.BoxGeometry(1.74, 0.08, 0.16);
            strip.translate(0, 0.94, sz);
            parts.push(strip);
          }
          for (const sx of [-0.74, 0.74]) {
            const strip = new THREE.BoxGeometry(0.16, 0.08, 1.44);
            strip.translate(sx, 0.94, 0);
            parts.push(strip);
          }
          return mergeGeos(parts);
        }),
        mats.hazardYellow
      )
    );
    g.add(hazardRim);

    const gantries = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_silo_gantries', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI) / 2 + Math.PI / 4;
            const tower = new THREE.BoxGeometry(0.22, 1.12, 0.22);
            tower.translate(Math.cos(ang) * 0.84, 1.36, Math.sin(ang) * 0.84);
            parts.push(tower);
            const arm = new THREE.BoxGeometry(0.56, 0.12, 0.12);
            arm.rotateY(-ang);
            arm.translate(Math.cos(ang) * 0.56, 1.72, Math.sin(ang) * 0.56);
            parts.push(arm);
          }
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(gantries);

    const rocketBody = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_silo_rocket_white', () => {
          const stage = new THREE.CylinderGeometry(0.42, 0.48, 0.98, 14);
          stage.translate(0, 0.88, 0);
          return stage;
        }),
        mats.ceramicWhite
      )
    );
    g.add(rocketBody);

    const nosecone = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_silo_rocket_nose', () => {
          const pts = [
            new THREE.Vector2(0.42, 1.36),
            new THREE.Vector2(0.36, 1.66),
            new THREE.Vector2(0.2, 1.98),
            new THREE.Vector2(0.01, 2.24),
          ];
          const cone = new THREE.LatheGeometry(pts, 14);
          // 4 rocket stabilizer fins
          const parts: THREE.BufferGeometry[] = [cone];
          for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI) / 2;
            const fin = new THREE.BoxGeometry(0.28, 0.52, 0.07);
            fin.rotateY(ang);
            fin.translate(Math.cos(ang) * 0.5, 0.72, Math.sin(ang) * 0.5);
            parts.push(fin);
          }
          return mergeGeos(parts);
        }),
        accentMat
      )
    );
    g.add(nosecone);
    accentMeshes.push(nosecone);
    g.userData.isRocketSilo = true;
    return true;
  }

  // =========================================================================
  // 5. DISTINCT FURNACE TIERS (stone_furnace, steel_furnace, electric_furnace)
  // =========================================================================
  if (variantItemId === 'stone_furnace') {
    const kiln = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_stone_furn_kiln', () => {
          const pts = [
            new THREE.Vector2(0.01, 0.22),
            new THREE.Vector2(0.98, 0.22),
            new THREE.Vector2(0.92, 0.78),
            new THREE.Vector2(0.76, 1.28),
            new THREE.Vector2(0.44, 1.66),
            new THREE.Vector2(0.36, 2.18),
            new THREE.Vector2(0.42, 2.28),
            new THREE.Vector2(0.01, 2.28),
          ];
          return new THREE.LatheGeometry(pts, 8);
        }),
        mats.brick
      )
    );
    g.add(kiln);

    const bands = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_stone_furn_bands', () => {
          const b1 = new THREE.TorusGeometry(0.93, 0.048, 6, 12);
          b1.rotateX(Math.PI * 0.5);
          b1.translate(0, 0.62, 0);
          const arch = new THREE.TorusGeometry(0.38, 0.07, 6, 10, Math.PI);
          arch.translate(0, 0.66, -0.88);
          return mergeGeos([b1, arch]);
        }),
        mats.steelDark
      )
    );
    g.add(bands);

    const hearth = new THREE.Mesh(
      getCachedGeo('var_furn_hearth', () => new THREE.BoxGeometry(0.68, 0.52, 0.18)),
      mats.furnaceHearthIdle
    );
    hearth.position.set(0, 0.5, -0.86);
    g.add(hearth);
    g.userData.hearthMesh = hearth;
    return true;
  }

  if (variantItemId === 'steel_furnace') {
    const hood = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_steel_furn_hood', () => {
          const parts: THREE.BufferGeometry[] = [];
          const body = chamferedBox(1.76, 1.04, 1.68, 0.14);
          body.translate(0, 0.76, 0);
          const slopedTop = chamferedBox(1.38, 0.44, 1.32, 0.16);
          slopedTop.translate(0, 1.44, 0.04);
          parts.push(body, slopedTop);
          // Dual angled exhaust cowls
          for (const sx of [-0.46, 0.46]) {
            const stack = new THREE.CylinderGeometry(0.18, 0.24, 0.96, 8);
            stack.translate(sx, 1.98, 0.26);
            parts.push(stack);
          }
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(hood);

    const plating = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_steel_furn_plating', () => {
          const visor = chamferedBox(1.24, 0.24, 0.24, 0.04);
          visor.translate(0, 1.18, -0.86);
          const ductL = new THREE.BoxGeometry(0.18, 0.88, 0.96);
          ductL.translate(-0.92, 0.74, 0);
          const ductR = new THREE.BoxGeometry(0.18, 0.88, 0.96);
          ductR.translate(0.92, 0.74, 0);
          return mergeGeos([visor, ductL, ductR]);
        }),
        mats.steelLight
      )
    );
    g.add(plating);

    const brassTrim = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_steel_furn_brass', () => {
          const cap = new THREE.CylinderGeometry(0.28, 0.34, 0.18, 8);
          cap.translate(0, 1.72, -0.18);
          return cap;
        }),
        mats.brass
      )
    );
    g.add(brassTrim);

    const hearth = new THREE.Mesh(
      getCachedGeo('var_steel_furn_hearth', () => new THREE.BoxGeometry(0.96, 0.56, 0.16)),
      mats.furnaceHearthIdle
    );
    hearth.position.set(0, 0.62, -0.86);
    g.add(hearth);
    g.userData.hearthMesh = hearth;
    return true;
  }

  if (variantItemId === 'electric_furnace') {
    const chassis = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_elec_furn_chassis', () => {
          const parts: THREE.BufferGeometry[] = [];
          const hull = chamferedBox(1.86, 1.12, 1.78, 0.12);
          hull.translate(0, 0.8, 0);
          parts.push(hull);
          // Side radiator fins
          for (const sx of [-0.96, 0.96]) {
            for (const fz of [-0.48, 0, 0.48]) {
              const fin = new THREE.BoxGeometry(0.14, 0.84, 0.16);
              fin.translate(sx, 0.82, fz);
              parts.push(fin);
            }
          }
          return mergeGeos(parts);
        }),
        mats.steelLight
      )
    );
    g.add(chassis);

    const coils = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_elec_furn_coils', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const sx of [-0.52, 0.52]) {
            const col = new THREE.CylinderGeometry(0.24, 0.28, 0.62, 10);
            col.translate(sx, 1.62, 0.12);
            parts.push(col);
            const ring = new THREE.TorusGeometry(0.32, 0.055, 6, 14);
            ring.rotateX(Math.PI * 0.5);
            ring.translate(sx, 1.56, 0.12);
            parts.push(ring);
          }
          return mergeGeos(parts);
        }),
        mats.copper
      )
    );
    g.add(coils);

    const inductionGlow = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_elec_furn_glow', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const sx of [-0.52, 0.52]) {
            const topRing = new THREE.TorusGeometry(0.28, 0.048, 6, 14);
            topRing.rotateX(Math.PI * 0.5);
            topRing.translate(sx, 1.82, 0.12);
            parts.push(topRing);
          }
          return mergeGeos(parts);
        }),
        mats.cyanGlow
      ),
      false,
      false
    );
    g.add(inductionGlow);

    const hearth = new THREE.Mesh(
      getCachedGeo('var_elec_furn_hearth', () => new THREE.BoxGeometry(0.92, 0.48, 0.16)),
      mats.furnaceHearthIdle
    );
    hearth.position.set(0, 0.72, -0.92);
    g.add(hearth);
    g.userData.hearthMesh = hearth;
    return true;
  }

  // =========================================================================
  // 6. FLUIDS & CHEMICAL PROCESSING (pipe, pipe_to_ground, pump, oil_refinery, chemical_plant)
  // =========================================================================
  if (variantItemId === 'pipe') {
    const conduit = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_pipe_body', () => {
          const parts: THREE.BufferGeometry[] = [];
          const tube = new THREE.CylinderGeometry(0.34, 0.34, CAPYTORIO_TILE_SIZE + 0.04, 12);
          tube.rotateX(Math.PI * 0.5);
          tube.translate(0, 0.54, 0);
          parts.push(tube);
          // Center and end bolted flanges
          for (const fz of [-1.08, 0, 1.08]) {
            const flange = new THREE.CylinderGeometry(0.46, 0.46, 0.14, 12);
            flange.rotateX(Math.PI * 0.5);
            flange.translate(0, 0.54, fz);
            parts.push(flange);
          }
          return mergeGeos(parts);
        }),
        mats.steelLight
      )
    );
    g.add(conduit);

    const cradle = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_pipe_cradle', () => {
          const foot = chamferedBox(1.06, 0.24, 0.56, 0.04);
          foot.translate(0, 0.12, 0);
          return foot;
        }),
        mats.steelDark
      )
    );
    g.add(cradle);

    const copperBand = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_pipe_band', () => {
          const band = new THREE.TorusGeometry(0.38, 0.048, 6, 14);
          band.translate(0, 0.54, 0);
          return band;
        }),
        mats.copper
      )
    );
    g.add(copperBand);
    return true;
  }

  if (variantItemId === 'pipe_to_ground') {
    const collar = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_ug_pipe_collar', () => {
          const pad = new THREE.CylinderGeometry(0.68, 0.78, 0.22, 12);
          pad.translate(0, 0.11, 0.24);
          return pad;
        }),
        mats.steelDark
      )
    );
    g.add(collar);

    const elbow = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_ug_pipe_elbow', () => {
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.08, 0.24),
            new THREE.Vector3(0, 0.52, 0.22),
            new THREE.Vector3(0, 0.54, -0.32),
            new THREE.Vector3(0, 0.54, -1.24),
          ]);
          const tube = new THREE.TubeGeometry(curve, 12, 0.32, 10, false);
          const endFlange = new THREE.CylinderGeometry(0.45, 0.45, 0.14, 12);
          endFlange.rotateX(Math.PI * 0.5);
          endFlange.translate(0, 0.54, -1.16);
          return mergeGeos([tube, endFlange]);
        }),
        mats.steelLight
      )
    );
    g.add(elbow);

    const hazardRing = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_ug_pipe_hazard', () => {
          const ring = new THREE.TorusGeometry(0.54, 0.06, 6, 14);
          ring.rotateX(Math.PI * 0.5);
          ring.translate(0, 0.24, 0.24);
          return ring;
        }),
        mats.hazardYellow
      )
    );
    g.add(hazardRing);
    return true;
  }

  if (variantItemId === 'pump') {
    const body = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_inline_pump_body', () => {
          const parts: THREE.BufferGeometry[] = [];
          const foot = chamferedBox(1.48, 0.2, 2.02, 0.06);
          foot.translate(0, 0.1, 0);
          const motor = new THREE.CylinderGeometry(0.48, 0.48, 1.48, 12);
          motor.rotateX(Math.PI * 0.5);
          motor.translate(0, 0.62, 0);
          const endA = new THREE.CylinderGeometry(0.44, 0.44, 0.16, 12);
          endA.rotateX(Math.PI * 0.5);
          endA.translate(0, 0.54, -1.14);
          const endB = new THREE.CylinderGeometry(0.44, 0.44, 0.16, 12);
          endB.rotateX(Math.PI * 0.5);
          endB.translate(0, 0.54, 1.14);
          const pipeCore = new THREE.CylinderGeometry(0.32, 0.32, CAPYTORIO_TILE_SIZE, 10);
          pipeCore.rotateX(Math.PI * 0.5);
          pipeCore.translate(0, 0.54, 0);
          parts.push(foot, motor, endA, endB, pipeCore);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(body);

    const flowBand = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_inline_pump_flow', () => {
          const band = new THREE.CylinderGeometry(0.51, 0.51, 0.36, 12);
          band.rotateX(Math.PI * 0.5);
          band.translate(0, 0.62, 0);
          return band;
        }),
        mats.cyanGlow
      ),
      false,
      false
    );
    g.add(flowBand);

    const impeller = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_inline_pump_rotor', () => {
          const cap = new THREE.CylinderGeometry(0.14, 0.14, 0.18, 8);
          const vaneA = new THREE.BoxGeometry(0.54, 0.08, 0.09);
          const vaneB = new THREE.BoxGeometry(0.09, 0.08, 0.54);
          return mergeGeos([cap, vaneA, vaneB]);
        }),
        mats.brass
      )
    );
    impeller.position.set(0, 1.14, 0);
    g.add(impeller);
    g.userData.spinPart = impeller;
    g.userData.isPumpImpeller = true;
    return true;
  }

  if (variantItemId === 'oil_refinery') {
    // 3x3 twin distillation towers, catwalk rings, horizontal heat exchanger, copper manifold, flare stack
    const towers = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_refinery_towers', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Main tall fractionator tower
          const towerA = new THREE.CylinderGeometry(0.34, 0.42, 2.08, 12);
          towerA.translate(-0.44, 1.28, -0.18);
          const domeA = new THREE.SphereGeometry(0.34, 10, 8);
          domeA.translate(-0.44, 2.32, -0.18);
          // Secondary catalytic cracker tower
          const towerB = new THREE.CylinderGeometry(0.28, 0.34, 1.66, 12);
          towerB.translate(0.46, 1.06, -0.24);
          const domeB = new THREE.SphereGeometry(0.28, 10, 8);
          domeB.translate(0.46, 1.88, -0.24);
          // Horizontal reboiler drum at rear
          const drum = new THREE.CylinderGeometry(0.32, 0.32, 1.42, 10);
          drum.rotateZ(Math.PI * 0.5);
          drum.translate(0, 0.68, 0.52);
          // Flare stack
          const flare = new THREE.CylinderGeometry(0.08, 0.13, 2.38, 8);
          flare.translate(0.76, 1.42, 0.56);
          parts.push(towerA, domeA, towerB, domeB, drum, flare);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(towers);

    const catwalks = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_refinery_catwalks', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const cy of [1.14, 1.72]) {
            const ring = new THREE.TorusGeometry(0.48, 0.045, 6, 14);
            ring.rotateX(Math.PI * 0.5);
            ring.translate(-0.44, cy, -0.18);
            parts.push(ring);
          }
          const bridge = new THREE.BoxGeometry(0.92, 0.08, 0.28);
          bridge.translate(0.02, 1.42, -0.22);
          parts.push(bridge);
          return mergeGeos(parts);
        }),
        mats.steelLight
      )
    );
    g.add(catwalks);

    const manifold = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_refinery_manifold', () => {
          const parts: THREE.BufferGeometry[] = [];
          const bridgePipe = new THREE.CylinderGeometry(0.09, 0.09, 1.06, 8);
          bridgePipe.rotateZ(Math.PI * 0.5);
          bridgePipe.translate(0.02, 1.66, -0.2);
          parts.push(bridgePipe);
          for (const px of [-0.52, 0, 0.52]) {
            const outPipe = new THREE.CylinderGeometry(0.09, 0.09, 0.42, 8);
            outPipe.rotateX(Math.PI * 0.5);
            outPipe.translate(px, 0.46, -0.88);
            parts.push(outPipe);
          }
          return mergeGeos(parts);
        }),
        mats.copper
      )
    );
    g.add(manifold);

    const flareTip = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_refinery_flare_tip', () => {
          const flame = new THREE.ConeGeometry(0.14, 0.36, 8);
          flame.translate(0.76, 2.74, 0.56);
          return flame;
        }),
        mats.rubyGlow
      ),
      false,
      false
    );
    g.add(flareTip);
    g.userData.isRefinery = true;
    return true;
  }

  if (variantItemId === 'chemical_plant') {
    const frame = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_chem_frame', () => {
          const parts: THREE.BufferGeometry[] = [];
          const deck = chamferedBox(1.88, 0.34, 1.78, 0.08);
          deck.translate(0, 0.4, 0);
          // Rear reactor control housing + twin angled vent stacks
          const rearBox = chamferedBox(1.66, 0.92, 0.54, 0.08);
          rearBox.translate(0, 0.96, 0.56);
          for (const sx of [-0.46, 0.46]) {
            const stack = new THREE.CylinderGeometry(0.13, 0.18, 0.92, 8);
            stack.translate(sx, 1.82, 0.62);
            parts.push(stack);
          }
          parts.push(deck, rearBox);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(frame);

    const vatGlass = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_chem_glass', () => {
          const vL = new THREE.CylinderGeometry(0.36, 0.36, 0.86, 12);
          vL.translate(-0.44, 1.0, -0.26);
          const vR = new THREE.CylinderGeometry(0.36, 0.36, 0.86, 12);
          vR.translate(0.44, 1.0, -0.26);
          return mergeGeos([vL, vR]);
        }),
        mats.labGlass
      ),
      false,
      false
    );
    vatGlass.renderOrder = 3;
    g.add(vatGlass);

    const liquidL = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_chem_liq_l', () => {
          const core = new THREE.CylinderGeometry(0.28, 0.28, 0.62, 10);
          core.translate(-0.44, 0.9, -0.26);
          return core;
        }),
        mats.cyanGlow
      ),
      false,
      false
    );
    g.add(liquidL);

    const liquidR = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_chem_liq_r', () => {
          const core = new THREE.CylinderGeometry(0.28, 0.28, 0.62, 10);
          core.translate(0.44, 0.9, -0.26);
          return core;
        }),
        mats.emeraldGlow
      ),
      false,
      false
    );
    g.add(liquidR);

    const coils = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_chem_coils', () => {
          const arch = new THREE.TorusGeometry(0.44, 0.065, 8, 16, Math.PI);
          arch.translate(0, 1.44, -0.26);
          const capL = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 10);
          capL.translate(-0.44, 1.44, -0.26);
          const capR = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 10);
          capR.translate(0.44, 1.44, -0.26);
          return mergeGeos([arch, capL, capR]);
        }),
        mats.copper
      )
    );
    g.add(coils);
    g.userData.isChemPlant = true;
    return true;
  }

  // =========================================================================
  // 7. RAIL & TRAINS (rail, train_stop, locomotive 2x1, cargo_wagon 2x1)
  // =========================================================================
  if (variantItemId === 'rail') {
    const ballast = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_rail_ballast', () => {
          const bed = new THREE.BoxGeometry(2.26, 0.08, CAPYTORIO_TILE_SIZE + 0.02);
          bed.translate(0, 0.04, 0);
          return bed;
        }),
        mats.concrete
      ),
      false,
      true
    );
    g.add(ballast);

    const sleepers = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_rail_sleepers', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const sz of [-0.94, -0.32, 0.32, 0.94]) {
            const tie = new THREE.BoxGeometry(2.04, 0.1, 0.24);
            tie.translate(0, 0.12, sz);
            parts.push(tie);
          }
          return mergeGeos(parts);
        }),
        mats.timber
      )
    );
    g.add(sleepers);

    const rails = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_rail_steel', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const rx of [-0.68, 0.68]) {
            const rail = new THREE.BoxGeometry(0.14, 0.16, CAPYTORIO_TILE_SIZE + 0.04);
            rail.translate(rx, 0.22, 0);
            parts.push(rail);
          }
          return mergeGeos(parts);
        }),
        mats.steelLight
      )
    );
    g.add(rails);
    return true;
  }

  if (variantItemId === 'train_stop') {
    const platform = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_train_stop_platform', () => {
          const pad = chamferedBox(1.88, 0.24, 1.88, 0.06);
          pad.translate(0, 0.12, 0);
          const mast = new THREE.CylinderGeometry(0.11, 0.15, 2.38, 8);
          mast.translate(0.56, 1.32, 0);
          const arm = new THREE.BoxGeometry(1.12, 0.12, 0.12);
          arm.translate(0.06, 2.28, 0);
          return mergeGeos([pad, mast, arm]);
        }),
        mats.steelDark
      )
    );
    g.add(platform);

    const signBoard = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_train_stop_sign', () => {
          const board = chamferedBox(1.06, 0.52, 0.14, 0.04);
          board.translate(-0.18, 2.28, -0.06);
          return board;
        }),
        mats.hazardYellow
      )
    );
    g.add(signBoard);

    const signalLamp = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_train_stop_lamp', () => {
          const hood = new THREE.CylinderGeometry(0.18, 0.18, 0.22, 10);
          hood.rotateX(Math.PI * 0.5);
          hood.translate(0.56, 1.92, -0.18);
          return hood;
        }),
        mats.rubyGlow
      ),
      false,
      false
    );
    g.add(signalLamp);
    return true;
  }

  if (variantItemId === 'locomotive') {
    // Native 2x1 proportions (scale = [1, 1, 1], spanning ~4.7m along X!)
    const underframe = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_loco_chassis_2x1', () => {
          const parts: THREE.BufferGeometry[] = [];
          const deck = chamferedBox(CAPYTORIO_TILE_SIZE * 2 - 0.34, 0.28, 1.86, 0.08);
          deck.translate(0, 0.44, 0);
          parts.push(deck);
          // 4 pairs of steel bogie wheels
          for (const wx of [-1.62, -0.82, 0.82, 1.62]) {
            for (const wz of [-0.74, 0.74]) {
              const wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.14, 10);
              wheel.rotateX(Math.PI * 0.5);
              wheel.translate(wx, 0.28, wz);
              parts.push(wheel);
            }
          }
          // Front wedge cowcatcher plow (-X nose)
          const plow = new THREE.ConeGeometry(0.92, 0.62, 4);
          plow.rotateZ(Math.PI * 0.5);
          plow.rotateX(Math.PI * 0.25);
          plow.scale(1, 0.55, 1);
          plow.translate(-2.42, 0.32, 0);
          parts.push(plow);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(underframe);

    const body = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_loco_body_2x1', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Streamlined Capy-orange / crimson diesel body
          const engineHood = chamferedBox(3.16, 1.18, 1.64, 0.14);
          engineHood.translate(0.56, 1.12, 0);
          // Elevated forward engineer cab
          const cab = chamferedBox(1.36, 1.38, 1.72, 0.14);
          cab.translate(-1.38, 1.24, 0);
          // Sloped aerodynamic nose
          const nose = chamferedBox(0.68, 0.86, 1.54, 0.16);
          nose.translate(-2.12, 0.96, 0);
          parts.push(engineHood, cab, nose);
          return mergeGeos(parts);
        }),
        accentMat
      )
    );
    g.add(body);
    accentMeshes.push(body);

    const windshield = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_loco_glass', () => {
          const glass = new THREE.BoxGeometry(0.18, 0.44, 1.44);
          glass.translate(-2.06, 1.54, 0);
          return glass;
        }),
        mats.labGlass
      ),
      false,
      false
    );
    g.add(windshield);

    const trim = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_loco_trim', () => {
          const stripeL = new THREE.BoxGeometry(4.1, 0.16, 0.08);
          stripeL.translate(-0.08, 0.88, -0.84);
          const stripeR = new THREE.BoxGeometry(4.1, 0.16, 0.08);
          stripeR.translate(-0.08, 0.88, 0.84);
          const lamp = new THREE.CylinderGeometry(0.16, 0.18, 0.14, 10);
          lamp.rotateZ(Math.PI * 0.5);
          lamp.translate(-2.46, 1.06, 0);
          return mergeGeos([stripeL, stripeR, lamp]);
        }),
        mats.hazardYellow
      )
    );
    g.add(trim);

    // Twin roof radiator fans (reuses gearA/gearB rotation hooks cleanly!)
    const fanGeo = getCachedGeo('var_loco_fan', () => {
      const b1 = new THREE.BoxGeometry(0.74, 0.06, 0.14);
      const b2 = new THREE.BoxGeometry(0.14, 0.06, 0.74);
      const hub = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
      return mergeGeos([b1, b2, hub]);
    });
    const fanA = new THREE.Mesh(fanGeo, mats.steelLight);
    fanA.position.set(0.32, 1.76, 0);
    g.add(fanA);
    const fanB = new THREE.Mesh(fanGeo, mats.steelLight);
    fanB.position.set(1.36, 1.76, 0);
    g.add(fanB);
    g.userData.gearA = fanA;
    g.userData.gearB = fanB;
    return true;
  }

  if (variantItemId === 'cargo_wagon') {
    // Native 2x1 proportions (scale = [1, 1, 1], spanning ~4.7m along X!)
    const underframe = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_wagon_chassis_2x1', () => {
          const parts: THREE.BufferGeometry[] = [];
          const deck = chamferedBox(CAPYTORIO_TILE_SIZE * 2 - 0.32, 0.24, 1.84, 0.08);
          deck.translate(0, 0.42, 0);
          parts.push(deck);
          for (const wx of [-1.58, -0.78, 0.78, 1.58]) {
            for (const wz of [-0.74, 0.74]) {
              const wheel = new THREE.CylinderGeometry(0.27, 0.27, 0.14, 10);
              wheel.rotateX(Math.PI * 0.5);
              wheel.translate(wx, 0.27, wz);
              parts.push(wheel);
            }
          }
          // End couplers
          for (const cx of [-2.42, 2.42]) {
            const coupler = new THREE.BoxGeometry(0.24, 0.18, 0.46);
            coupler.translate(cx, 0.42, 0);
            parts.push(coupler);
          }
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(underframe);

    const cargoBox = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_wagon_box_2x1', () => {
          const parts: THREE.BufferGeometry[] = [];
          const hull = chamferedBox(4.24, 0.98, 1.66, 0.1);
          hull.translate(0, 1.02, 0);
          parts.push(hull);
          // External vertical structural ribs
          for (const rx of [-1.56, -0.78, 0, 0.78, 1.56]) {
            const rib = new THREE.BoxGeometry(0.14, 0.92, 1.76);
            rib.translate(rx, 1.02, 0);
            parts.push(rib);
          }
          return mergeGeos(parts);
        }),
        accentMat
      )
    );
    g.add(cargoBox);
    accentMeshes.push(cargoBox);

    const hatches = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_wagon_hatches', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const hx of [-1.18, 0, 1.18]) {
            const hatch = chamferedBox(0.92, 0.14, 1.38, 0.04);
            hatch.translate(hx, 1.56, 0);
            parts.push(hatch);
          }
          return mergeGeos(parts);
        }),
        mats.steelLight
      )
    );
    g.add(hatches);
    return true;
  }

  // =========================================================================
  // 8. ROBOTICS (roboport 3x3 + hovering animated logistic/construction mini-drones!)
  // =========================================================================
  if (variantItemId === 'roboport') {
    const hangar = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_roboport_hangar', () => {
          const parts: THREE.BufferGeometry[] = [];
          const base = chamferedBox(1.94, 0.86, 1.94, 0.12);
          base.translate(0, 0.66, 0);
          // Raised octagonal landing pad roof
          const pad = new THREE.CylinderGeometry(0.84, 0.92, 0.16, 8);
          pad.translate(0, 1.16, 0);
          // Corner charging pylons
          for (const px of [-0.82, 0.82]) {
            for (const pz of [-0.82, 0.82]) {
              const pylon = new THREE.CylinderGeometry(0.08, 0.12, 0.62, 6);
              pylon.translate(px, 1.38, pz);
              parts.push(pylon);
            }
          }
          parts.push(base, pad);
          return mergeGeos(parts);
        }),
        mats.steelDark
      )
    );
    g.add(hangar);

    const bayAccent = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_roboport_accent', () => {
          const doorF = chamferedBox(1.12, 0.52, 0.14, 0.04);
          doorF.translate(0, 0.56, -0.96);
          const doorB = chamferedBox(1.12, 0.52, 0.14, 0.04);
          doorB.translate(0, 0.56, 0.96);
          return mergeGeos([doorF, doorB]);
        }),
        accentMat
      )
    );
    g.add(bayAccent);
    accentMeshes.push(bayAccent);

    const beacons = addCastReceive(
      new THREE.Mesh(
        getCachedGeo('var_roboport_beacons', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Landing pad glowing cyan ring + corner beacon caps
          const ring = new THREE.TorusGeometry(0.62, 0.05, 6, 16);
          ring.rotateX(Math.PI * 0.5);
          ring.translate(0, 1.26, 0);
          parts.push(ring);
          for (const px of [-0.82, 0.82]) {
            for (const pz of [-0.82, 0.82]) {
              const tip = new THREE.SphereGeometry(0.09, 8, 6);
              tip.translate(px, 1.72, pz);
              parts.push(tip);
            }
          }
          return mergeGeos(parts);
        }),
        mats.cyanGlow
      ),
      false,
      false
    );
    g.add(beacons);

    // Side communications radar mast spinning smoothly
    const mastSpin = new THREE.Mesh(
      getCachedGeo('var_roboport_radar', () => {
        const rod = new THREE.CylinderGeometry(0.05, 0.06, 0.44, 6);
        const bar = new THREE.BoxGeometry(0.54, 0.09, 0.08);
        bar.translate(0, 0.22, 0);
        return mergeGeos([rod, bar]);
      }),
      mats.steelLight
    );
    mastSpin.position.set(0.76, 1.84, 0.76);
    g.add(mastSpin);
    g.userData.spinPart = mastSpin;
    g.userData.isRadarDish = true;

    // 4 pooled hovering mini-drones (alternating amber logistic_robot & silver construction_robot)
    // Animated in sync() with zero per-frame allocations!
    const droneBodyGeo = getCachedGeo('var_roboport_drone_body', () => {
      const hull = new THREE.OctahedronGeometry(0.14, 0);
      hull.scale(1.2, 0.75, 1.2);
      const rotor = new THREE.BoxGeometry(0.46, 0.025, 0.07);
      rotor.translate(0, 0.14, 0);
      const rotor2 = new THREE.BoxGeometry(0.07, 0.025, 0.46);
      rotor2.translate(0, 0.14, 0);
      return mergeGeos([hull, rotor, rotor2]);
    });
    const roboDrones: THREE.Mesh[] = [];
    for (let d = 0; d < 4; d++) {
      const drone = new THREE.Mesh(droneBodyGeo, d % 2 === 0 ? mats.brass : mats.steelLight);
      drone.position.set(0, 1.9 + d * 0.2, 0);
      drone.castShadow = false;
      g.add(drone);
      roboDrones.push(drone);
    }
    g.userData.roboDrones = roboDrones;
    return true;
  }

  return false;
}
