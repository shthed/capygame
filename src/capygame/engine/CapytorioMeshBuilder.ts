import * as THREE from 'three';
import {
  CAPYTORIO_ITEM_SHAPES,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_TILE_SIZE,
  CAPYTORIO_WORLD_ORIGIN_X,
  CAPYTORIO_WORLD_ORIGIN_Z,
  getCapytorioItemMeta,
  resolveCapytorioItemShape,
  type CapytorioDirection,
  type CapytorioItemShape,
  type CapytorioMachineType,
} from './CapytorioData';
import {
  CapytorioFactoryEngine,
  DIR_DX,
  DIR_DZ,
  capytorioGridToWorldX,
  capytorioGridToWorldZ,
  evalBeltItemLocalPose,
  getBeltCurveShape,
  resolveCapytorioPlaceableSpec,
  tileKey,
} from './CapytorioFactoryEngine';

const MAX_ORE_INSTANCES = 1024;
const MAX_BELT_INSTANCES = 1400;
const MAX_CURVED_BELT_INSTANCES = 600;
const MAX_SHAPE_ITEM_INSTANCES = 2048;
const MAX_TREE_INSTANCES = 512;
const MAX_VISIBLE_RADIUS_TILES = 22;
const BELT_SURFACE_Y = 0.145;
const INSERTER_UPPER_ARM_LEN = 1.65;
const INSERTER_FOREARM_LEN = 1.70;
const INSERTER_SHOULDER_Y = 0.60;

// Module-scoped zero-allocation math helpers
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _activeKeysScratch = new Set<string>();
const _beltTierCounts: [number, number, number] = [0, 0, 0];
const _curvedLeftTierCounts: [number, number, number] = [0, 0, 0];
const _curvedRightTierCounts: [number, number, number] = [0, 0, 0];
const _itemPoseScratch: [number, number, number] = [0, 0, 0];
const _shapeCounts: Record<CapytorioItemShape, number> = {
  ore: 0,
  plate: 0,
  gear: 0,
  circuit: 0,
  science: 0,
  coil: 0,
  fruit: 0,
  crate: 0,
};

function dirToRotY(dir: CapytorioDirection): number {
  return -dir * (Math.PI * 0.5);
}

function hashTile(gx: number, gz: number): number {
  let h = (gx * 374761393 + gz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function mergeSimpleIndexedGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partIdx = part.index;
    totalVerts += part.attributes.position.count;
    totalIndices += partIdx ? partIdx.count : part.attributes.position.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (let p = 0; p < parts.length; p++) {
    const g = parts[p];
    const posAttr = g.attributes.position;
    const normAttr = g.attributes.normal;
    const uvAttr = g.attributes.uv;
    positions.set(posAttr.array as Float32Array, vOffset * 3);
    if (normAttr) normals.set(normAttr.array as Float32Array, vOffset * 3);
    if (uvAttr) uvs.set(uvAttr.array as Float32Array, vOffset * 2);

    const gIdx = g.index;
    if (gIdx) {
      const idxArr = gIdx.array;
      for (let k = 0; k < idxArr.length; k++) {
        indices[iOffset + k] = idxArr[k] + vOffset;
      }
      iOffset += idxArr.length;
    } else {
      for (let k = 0; k < posAttr.count; k++) {
        indices[iOffset + k] = vOffset + k;
      }
      iOffset += posAttr.count;
    }
    vOffset += posAttr.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

function groundGeometryBottomAtZero(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    geo.translate(0, -geo.boundingBox.min.y, 0);
  }
  return geo;
}

function createFactorioBeltSurfaceTexture(
  chevronHex: string,
  chevronHighlightHex: string
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Medium industrial steel-grey belt slat base (high contrast for dark Coal + bright Plates/Ores)
  ctx.fillStyle = '#48505c';
  ctx.fillRect(0, 0, 512, 512);

  // Two distinct parallel belt track lanes (Left Lane 26..236, Right Lane 276..486)
  ctx.fillStyle = '#3c434e';
  ctx.fillRect(26, 0, 210, 512);
  ctx.fillRect(276, 0, 210, 512);

  // Recessed dark center spine groove & dark steel outer flange channels
  ctx.fillStyle = '#1e232b';
  ctx.fillRect(239, 0, 34, 512);
  ctx.fillRect(0, 0, 22, 512);
  ctx.fillRect(490, 0, 22, 512);

  // Center brushed-steel divider seam down center
  ctx.fillStyle = '#64748b';
  ctx.fillRect(252, 0, 8, 512);

  // Fine Factorio conveyor tread cross-slats & compact edge ticks (8 seamless repeats per tile)
  for (let row = 0; row < 8; row++) {
    const y = row * 64;
    ctx.fillStyle = '#2b313a';
    ctx.fillRect(22, y, 217, 4);
    ctx.fillRect(273, y, 217, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(22, y + 4, 217, 2);
    ctx.fillRect(273, y + 4, 217, 2);

    // Compact Factorio tier-colored edge ticks along outer belt lip
    ctx.fillStyle = chevronHex;
    ctx.fillRect(4, y + 18, 11, 20);
    ctx.fillRect(497, y + 18, 11, 20);
  }

  // Smaller, crisp Factorio-style chevrons (8 per tile repeat) pointing forward toward y=0 (-Z / curve tangent)
  const drawChevron = (cx: number, cy: number, halfW: number, height: number, thick: number) => {
    ctx.fillStyle = chevronHex;
    ctx.beginPath();
    ctx.moveTo(cx, cy - height * 0.5);
    ctx.lineTo(cx + halfW, cy + height * 0.35);
    ctx.lineTo(cx + halfW, cy + height * 0.35 + thick);
    ctx.lineTo(cx, cy - height * 0.5 + thick);
    ctx.lineTo(cx - halfW, cy + height * 0.35 + thick);
    ctx.lineTo(cx - halfW, cy + height * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = chevronHighlightHex;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  for (let rep = 0; rep < 8; rep++) {
    const cy = rep * 64 + 32;
    drawChevron(131, cy, 38, 22, 10);
    drawChevron(381, cy, 38, 22, 10);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Procedural 90° Factorio curved belt ribbon deck whose UV.x spans cross-section [0..1]
 * and UV.y spans true center-arc distance divided by CAPYTORIO_TILE_SIZE so scroll velocity
 * matches Straight belts 1:1 in world m/s.
 */
function createCurvedBeltDeckGeometry(
  side: 'left' | 'right',
  halfWidth: number,
  yHeight: number
): THREE.BufferGeometry {
  const segs = 14;
  const halfTile = CAPYTORIO_TILE_SIZE * 0.5;
  const rCenter = halfTile;
  const rInner = Math.max(0.12, rCenter - halfWidth);
  const rOuter = rCenter + halfWidth;
  const pivotX = side === 'left' ? -halfTile : halfTile;
  const pivotZ = -halfTile;
  const vMax = (Math.PI * 0.5 * rCenter) / CAPYTORIO_TILE_SIZE; // ~0.7854

  const vertCount = (segs + 1) * 2;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = new Uint16Array(segs * 6);

  for (let i = 0; i <= segs; i++) {
    const t = i / segs; // 0 (side entrance) -> 1 (-Z exit)
    const theta = (1 - t) * (Math.PI * 0.5);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const vCoord = t * vMax;

    // U = 0 (left track), U = 1 (right track)
    const rU0 = side === 'left' ? rInner : rOuter;
    const rU1 = side === 'left' ? rOuter : rInner;

    const x0 = side === 'left' ? pivotX + rU0 * cosT : pivotX - rU0 * cosT;
    const z0 = pivotZ + rU0 * sinT;
    const x1 = side === 'left' ? pivotX + rU1 * cosT : pivotX - rU1 * cosT;
    const z1 = pivotZ + rU1 * sinT;

    const vi = i * 2;
    positions[vi * 3] = x0;
    positions[vi * 3 + 1] = yHeight;
    positions[vi * 3 + 2] = z0;
    normals[vi * 3] = 0;
    normals[vi * 3 + 1] = 1;
    normals[vi * 3 + 2] = 0;
    uvs[vi * 2] = 0;
    uvs[vi * 2 + 1] = vCoord;

    positions[(vi + 1) * 3] = x1;
    positions[(vi + 1) * 3 + 1] = yHeight;
    positions[(vi + 1) * 3 + 2] = z1;
    normals[(vi + 1) * 3] = 0;
    normals[(vi + 1) * 3 + 1] = 1;
    normals[(vi + 1) * 3 + 2] = 0;
    uvs[(vi + 1) * 2] = 1;
    uvs[(vi + 1) * 2 + 1] = vCoord;

    if (i < segs) {
      const a = vi;
      const b = vi + 1;
      const c = vi + 2;
      const d = vi + 3;
      const ii = i * 6;
      if (side === 'left') {
        indices[ii] = a;
        indices[ii + 1] = b;
        indices[ii + 2] = c;
        indices[ii + 3] = c;
        indices[ii + 4] = b;
        indices[ii + 5] = d;
      } else {
        indices[ii] = a;
        indices[ii + 1] = c;
        indices[ii + 2] = b;
        indices[ii + 3] = c;
        indices[ii + 4] = d;
        indices[ii + 5] = b;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

function createCurvedArcBandGeometry(
  side: 'left' | 'right',
  radiusCenter: number,
  bandWidth: number,
  yBottom: number,
  yTop: number
): THREE.BufferGeometry {
  const segs = 14;
  const halfTile = CAPYTORIO_TILE_SIZE * 0.5;
  const pivotX = side === 'left' ? -halfTile : halfTile;
  const pivotZ = -halfTile;
  const rMin = Math.max(0.05, radiusCenter - bandWidth * 0.5);
  const rMax = radiusCenter + bandWidth * 0.5;
  const parts: THREE.BufferGeometry[] = [];

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const tMid = (t0 + t1) * 0.5;
    const theta0 = (1 - t0) * (Math.PI * 0.5);
    const theta1 = (1 - t1) * (Math.PI * 0.5);
    const thetaMid = (1 - tMid) * (Math.PI * 0.5);
    const chord = Math.hypot(
      Math.cos(theta1) - Math.cos(theta0),
      Math.sin(theta1) - Math.sin(theta0)
    ) * radiusCenter + 0.015;

    const rMid = (rMin + rMax) * 0.5;
    const box = new THREE.BoxGeometry(rMax - rMin, yTop - yBottom, chord);
    const rotY = side === 'left' ? -thetaMid : thetaMid;
    box.rotateY(rotY);
    const wx = side === 'left' ? pivotX + rMid * Math.cos(thetaMid) : pivotX - rMid * Math.cos(thetaMid);
    const wz = pivotZ + rMid * Math.sin(thetaMid);
    box.translate(wx, (yBottom + yTop) * 0.5, wz);
    parts.push(box);
  }
  return mergeSimpleIndexedGeometries(parts);
}

function createItemShapeGeometry(shape: CapytorioItemShape): THREE.BufferGeometry {
  // All belt item silhouettes are calibrated to ~0.61–0.63 m along the belt travel axis (Z)
  // so 4 items per lane (0.625 m Factorio slot pitch) sit tightly packed and touching with zero gaps,
  // while keeping width (X) <= 0.72 m inside each 0.98 m lane corridor.
  if (shape === 'ore') {
    const geo = new THREE.DodecahedronGeometry(0.325, 0);
    geo.scale(1.06, 0.72, 0.99);
    return groundGeometryBottomAtZero(geo);
  }
  if (shape === 'plate') {
    const hw = 0.34;
    const hd = 0.292;
    const s = new THREE.Shape();
    s.moveTo(-hw + 0.035, -hd);
    s.lineTo(hw - 0.035, -hd);
    s.lineTo(hw, -hd + 0.035);
    s.lineTo(hw, hd - 0.035);
    s.lineTo(hw - 0.035, hd);
    s.lineTo(-hw + 0.035, hd);
    s.lineTo(-hw, hd - 0.035);
    s.lineTo(-hw, -hd + 0.035);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.085,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    geo.rotateX(Math.PI * 0.5);
    return groundGeometryBottomAtZero(geo);
  }
  if (shape === 'gear') {
    const teeth = 8;
    const rOuter = 0.302;
    const rRoot = 0.218;
    const step = (Math.PI * 2) / teeth;
    const s = new THREE.Shape();
    for (let i = 0; i < teeth; i++) {
      const a0 = i * step;
      const a1 = a0 + step * 0.22;
      const a2 = a0 + step * 0.34;
      const a3 = a0 + step * 0.66;
      const a4 = a0 + step * 0.78;
      if (i === 0) s.moveTo(Math.cos(a0) * rRoot, Math.sin(a0) * rRoot);
      else s.lineTo(Math.cos(a0) * rRoot, Math.sin(a0) * rRoot);
      s.lineTo(Math.cos(a1) * rRoot, Math.sin(a1) * rRoot);
      s.lineTo(Math.cos(a2) * rOuter, Math.sin(a2) * rOuter);
      s.lineTo(Math.cos(a3) * rOuter, Math.sin(a3) * rOuter);
      s.lineTo(Math.cos(a4) * rRoot, Math.sin(a4) * rRoot);
    }
    s.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.084, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.012,
      bevelSegments: 1,
    });
    geo.rotateX(Math.PI * 0.5);
    return groundGeometryBottomAtZero(geo);
  }
  if (shape === 'circuit') {
    const hw = 0.32;
    const hd = 0.298;
    const s = new THREE.Shape();
    s.moveTo(-hw, -hd);
    s.lineTo(hw - 0.075, -hd);
    s.lineTo(hw, -hd + 0.075);
    s.lineTo(hw, hd);
    s.lineTo(-hw + 0.065, hd);
    s.lineTo(-hw, hd - 0.065);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.075,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.012,
      bevelSegments: 1,
    });
    geo.rotateX(Math.PI * 0.5);
    return groundGeometryBottomAtZero(geo);
  }
  if (shape === 'science') {
    // Classic Erlenmeyer conical science flask silhouette
    const pts = [
      new THREE.Vector2(0.001, 0.0),
      new THREE.Vector2(0.28, 0.0),
      new THREE.Vector2(0.308, 0.075),
      new THREE.Vector2(0.258, 0.19),
      new THREE.Vector2(0.11, 0.39),
      new THREE.Vector2(0.102, 0.50),
      new THREE.Vector2(0.145, 0.535),
      new THREE.Vector2(0.075, 0.56),
      new THREE.Vector2(0.001, 0.56),
    ];
    const geo = new THREE.LatheGeometry(pts, 12);
    return groundGeometryBottomAtZero(geo);
  }
  if (shape === 'coil') {
    const geo = new THREE.TorusGeometry(0.222, 0.088, 8, 16);
    geo.rotateX(Math.PI * 0.5);
    return groundGeometryBottomAtZero(geo);
  }
  if (shape === 'fruit') {
    const geo = new THREE.SphereGeometry(0.306, 10, 8);
    geo.scale(1.04, 0.90, 1.02);
    return groundGeometryBottomAtZero(geo);
  }
  // 'crate'
  const c = 0.285;
  const s = new THREE.Shape();
  s.moveTo(-c, -c);
  s.lineTo(c, -c);
  s.lineTo(c, c);
  s.lineTo(-c, c);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 1,
  });
  geo.rotateX(Math.PI * 0.5);
  return groundGeometryBottomAtZero(geo);
}

function createLushMeadowGrassTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Lush Factorio-style emerald & olive meadow turf base
  ctx.fillStyle = '#417930';
  ctx.fillRect(0, 0, 512, 512);

  // Warm earthy soil dapples & sun-dappled turf blades
  for (let i = 0; i < 3200; i++) {
    const x = (i * 197 + (i % 7) * 13) % 512;
    const y = (i * 331 + (i % 5) * 19) % 512;
    if (i % 9 === 0) {
      // Subtle loam/clover tuft
      ctx.fillStyle = '#346326';
      ctx.fillRect(x, y, 5, 4);
    } else {
      const g = 108 + ((i * 37) % 38);
      const r = 52 + ((i * 23) % 26);
      const b = 36 + ((i * 17) % 18);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 2, 4);
    }
  }

  // Crisp subtle Factorio tile grid alignment border (clean building placement clarity)
  ctx.strokeStyle = 'rgba(18, 42, 14, 0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 509, 509);

  // Subtle corner surveyor ticks
  ctx.fillStyle = 'rgba(20, 48, 16, 0.34)';
  ctx.fillRect(0, 0, 14, 3);
  ctx.fillRect(0, 0, 3, 14);

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
  for (let i = 0; i < 1200; i++) {
    const x = (i * 113) % 256;
    const y = (i * 211) % 256;
    const g = 102 + ((i * 41) % 58);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x, y, 2, 3);
  }
  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 2;
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

  // Instanced meshes for high-density ores, continuous dual-lane belts, distinct-shape items, and tropical citrus trees
  private orePlateInstanced: THREE.InstancedMesh;
  private oreCrystalInstanced: THREE.InstancedMesh;
  private beltChassisInstanced: THREE.InstancedMesh;
  private beltRailSideInstanced: THREE.InstancedMesh;
  private beltSideBridgeInstanced: THREE.InstancedMesh;
  private beltDeckInstancedByTier: [THREE.InstancedMesh, THREE.InstancedMesh, THREE.InstancedMesh];
  private beltChassisCurveLeftInstanced: THREE.InstancedMesh;
  private beltChassisCurveRightInstanced: THREE.InstancedMesh;
  private beltRailCurveLeftInstanced: THREE.InstancedMesh;
  private beltRailCurveRightInstanced: THREE.InstancedMesh;
  private beltDeckCurveLeftByTier: [THREE.InstancedMesh, THREE.InstancedMesh, THREE.InstancedMesh];
  private beltDeckCurveRightByTier: [THREE.InstancedMesh, THREE.InstancedMesh, THREE.InstancedMesh];
  private beltTrackTextures: Array<THREE.CanvasTexture | null> = [];
  private deckMat: THREE.MeshStandardMaterial;
  private coastMat: THREE.MeshStandardMaterial;
  private itemGeosByShape: Record<CapytorioItemShape, THREE.BufferGeometry>;
  private itemInstancedByShape: Record<CapytorioItemShape, THREE.InstancedMesh>;
  private treeTrunkInstanced: THREE.InstancedMesh;
  private treeCanopyInstanced: THREE.InstancedMesh;
  private treeOrangeInstanced: THREE.InstancedMesh;

  // Pooled composite machine groups
  private readonly activeMachineGroups = new Map<string, THREE.Group>();
  private readonly inactivePoolByType = new Map<CapytorioMachineType, THREE.Group[]>();

  // Cursor, directional build ghost & inspector ring
  private cursorGroup = new THREE.Group();
  private cursorFrameMat: THREE.MeshStandardMaterial;
  private ghostArrowMesh: THREE.Mesh;
  private ghostBodyMesh: THREE.Mesh;
  private inspectRingMesh: THREE.Mesh;

  // Shared geometries, textures & materials for composite machines
  private sharedMaterials: THREE.Material[] = [];
  private sharedGeometries: THREE.BufferGeometry[] = [];
  private sharedTextures: THREE.Texture[] = [];
  private readonly machineGeoCache = new Map<string, THREE.BufferGeometry>();
  private readonly accentMatCache = new Map<number, THREE.MeshStandardMaterial>();
  private readonly heldItemMatCache = new Map<number, THREE.MeshStandardMaterial>();
  private matSteelDark: THREE.MeshStandardMaterial;
  private matSteelLight: THREE.MeshStandardMaterial;
  private matBrass: THREE.MeshStandardMaterial;
  private matHazardYellow: THREE.MeshStandardMaterial;
  private matBrick: THREE.MeshStandardMaterial;
  private matCopper: THREE.MeshStandardMaterial;
  private matLabGlass: THREE.MeshStandardMaterial;
  private matFurnaceHearthIdle: THREE.MeshStandardMaterial;
  private matFurnaceHearthActive: THREE.MeshStandardMaterial;
  private matGeneratorFireboxIdle: THREE.MeshStandardMaterial;
  private matGeneratorFireboxActive: THREE.MeshStandardMaterial;
  private matLabCoreIdle: THREE.MeshStandardMaterial;
  private matLabCoreActive: THREE.MeshStandardMaterial;

  private lastBeltScrollPhase = 0;
  // Static ore & tree terrain InstancedMesh dirty-cache (skips 3200+ tile scans/uploads per frame)
  private lastTerrainCenterGx = Number.NaN;
  private lastTerrainCenterGz = Number.NaN;
  private lastTerrainRadius = -1;
  private lastTerrainTopoRev = -1;
  private lastTerrainSubPixel = -1;

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
    this.matFurnaceHearthIdle = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.45,
      roughness: 0.25,
    });
    this.matFurnaceHearthActive = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.55,
      roughness: 0.22,
    });
    this.matGeneratorFireboxIdle = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.18,
      roughness: 0.25,
    });
    this.matGeneratorFireboxActive = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.55,
      roughness: 0.22,
    });
    this.matLabCoreIdle = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 0.85,
      roughness: 0.18,
    });
    this.matLabCoreActive = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 1.85,
      roughness: 0.16,
    });
    this.sharedMaterials.push(
      this.matSteelDark,
      this.matSteelLight,
      this.matBrass,
      this.matHazardYellow,
      this.matBrick,
      this.matCopper,
      this.matLabGlass,
      this.matFurnaceHearthIdle,
      this.matFurnaceHearthActive,
      this.matGeneratorFireboxIdle,
      this.matGeneratorFireboxActive,
      this.matLabCoreIdle,
      this.matLabCoreActive
    );

    // 1. Infinite Lush Meadow Grass Deck (320m x 320m snapping smoothly in 10m steps)
    // Kept opaque at ground altitude for fast early-Z, crisp SSAO depth, and zero sorting glitches!
    const deckTex = createLushMeadowGrassTexture();
    const bumpTex = createDeckBumpTexture();
    if (deckTex) this.sharedTextures.push(deckTex);
    if (bumpTex) this.sharedTextures.push(bumpTex);
    const deckGeo = new THREE.PlaneGeometry(320, 320, 1, 1);
    deckGeo.rotateX(-Math.PI * 0.5);
    const deckMat = new THREE.MeshStandardMaterial({
      color: deckTex ? 0xffffff : 0x417930,
      map: deckTex ?? null,
      bumpMap: bumpTex ?? null,
      bumpScale: 0.05,
      roughness: 0.92,
      metalness: 0.02,
      transparent: false,
      opacity: 1.0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.deckMat = deckMat;
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
      transparent: false,
      opacity: 1.0,
    });
    this.coastMat = coastMat;
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

    // 3. Instanced Continuous Gap-Free Dual-Lane Factorio Transport Belts
    const seamlessBeltLen = CAPYTORIO_TILE_SIZE + 0.02; // Slight 2cm overlap eliminates seams
    const beltWidth = CAPYTORIO_TILE_SIZE * 0.88; // 2.20m wide continuous steel chassis
    const beltChassisGeo = new THREE.BoxGeometry(beltWidth, 0.125, seamlessBeltLen);
    beltChassisGeo.translate(0, 0.0625, 0); // Flush bottom y = 0, deck top y = 0.125
    const beltChassisMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.72,
      metalness: 0.58,
    });
    this.beltChassisInstanced = new THREE.InstancedMesh(
      beltChassisGeo,
      beltChassisMat,
      MAX_BELT_INSTANCES
    );
    this.beltChassisInstanced.frustumCulled = false;
    this.beltChassisInstanced.count = 0;
    this.beltChassisInstanced.receiveShadow = true;
    this.beltChassisInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.beltChassisInstanced);

    // Low-profile Factorio gunmetal steel outer rail flanges (emitted only on non-junction edges)
    const beltSideRailGeo = new THREE.BoxGeometry(0.11, 0.055, seamlessBeltLen);
    beltSideRailGeo.translate(0, 0.145, 0);
    const beltRailMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.44,
      metalness: 0.68,
    });
    this.beltRailSideInstanced = new THREE.InstancedMesh(
      beltSideRailGeo,
      beltRailMat,
      MAX_BELT_INSTANCES * 2
    );
    this.beltRailSideInstanced.frustumCulled = false;
    this.beltRailSideInstanced.count = 0;
    this.beltRailSideInstanced.castShadow = true;
    this.beltRailSideInstanced.receiveShadow = true;
    this.beltRailSideInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.beltRailSideInstanced);

    // Flush corner & T-junction side-bridge deck (eliminates the 14cm side gap when perpendicular belts feed in)
    const beltSideBridgeGeo = new THREE.BoxGeometry(0.24, 0.136, beltWidth - 0.12);
    beltSideBridgeGeo.translate(0, 0.068, 0);
    const beltSideBridgeMat = new THREE.MeshStandardMaterial({
      color: 0x3b424e,
      roughness: 0.6,
      metalness: 0.35,
    });
    this.beltSideBridgeInstanced = new THREE.InstancedMesh(
      beltSideBridgeGeo,
      beltSideBridgeMat,
      MAX_BELT_INSTANCES * 2
    );
    this.beltSideBridgeInstanced.frustumCulled = false;
    this.beltSideBridgeInstanced.count = 0;
    this.beltSideBridgeInstanced.receiveShadow = true;
    this.beltSideBridgeInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.beltSideBridgeInstanced);

    // Animated procedural belt deck surface per speed tier (T1 Yellow, T2 Red, T3 Cyan)
    const beltDeckGeo = new THREE.PlaneGeometry(beltWidth - 0.18, seamlessBeltLen);
    beltDeckGeo.rotateX(-Math.PI * 0.5);
    beltDeckGeo.translate(0, 0.138, 0); // Safely 1.3cm above chassis top (0.125) to avoid Z-fighting
    const tierStyles: Array<[string, string]> = [
      ['#facc15', '#fef08a'],
      ['#ef4444', '#fca5a5'],
      ['#06b6d4', '#a5f3fc'],
    ];
    const deckMeshes: THREE.InstancedMesh[] = [];
    const curvedLeftDeckMeshes: THREE.InstancedMesh[] = [];
    const curvedRightDeckMeshes: THREE.InstancedMesh[] = [];
    const curvedChassisLeftGeo = createCurvedArcBandGeometry('left', CAPYTORIO_TILE_SIZE * 0.5, beltWidth, 0, 0.125);
    const curvedChassisRightGeo = createCurvedArcBandGeometry('right', CAPYTORIO_TILE_SIZE * 0.5, beltWidth, 0, 0.125);
    const beltHalfSpanX = beltWidth * 0.5 - 0.055; // 1.045m
    const curvedRailLeftGeo = mergeSimpleIndexedGeometries([
      createCurvedArcBandGeometry('left', CAPYTORIO_TILE_SIZE * 0.5 - beltHalfSpanX, 0.11, 0.118, 0.173),
      createCurvedArcBandGeometry('left', CAPYTORIO_TILE_SIZE * 0.5 + beltHalfSpanX, 0.11, 0.118, 0.173),
    ]);
    const curvedRailRightGeo = mergeSimpleIndexedGeometries([
      createCurvedArcBandGeometry('right', CAPYTORIO_TILE_SIZE * 0.5 - beltHalfSpanX, 0.11, 0.118, 0.173),
      createCurvedArcBandGeometry('right', CAPYTORIO_TILE_SIZE * 0.5 + beltHalfSpanX, 0.11, 0.118, 0.173),
    ]);
    const curvedDeckLeftGeo = createCurvedBeltDeckGeometry('left', (beltWidth - 0.18) * 0.5, 0.138);
    const curvedDeckRightGeo = createCurvedBeltDeckGeometry('right', (beltWidth - 0.18) * 0.5, 0.138);

    this.beltChassisCurveLeftInstanced = new THREE.InstancedMesh(
      curvedChassisLeftGeo,
      beltChassisMat,
      MAX_CURVED_BELT_INSTANCES
    );
    this.beltChassisCurveLeftInstanced.frustumCulled = false;
    this.beltChassisCurveLeftInstanced.count = 0;
    this.beltChassisCurveLeftInstanced.receiveShadow = true;
    this.beltChassisCurveLeftInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.beltChassisCurveLeftInstanced);

    this.beltChassisCurveRightInstanced = new THREE.InstancedMesh(
      curvedChassisRightGeo,
      beltChassisMat,
      MAX_CURVED_BELT_INSTANCES
    );
    this.beltChassisCurveRightInstanced.frustumCulled = false;
    this.beltChassisCurveRightInstanced.count = 0;
    this.beltChassisCurveRightInstanced.receiveShadow = true;
    this.beltChassisCurveRightInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.beltChassisCurveRightInstanced);

    this.beltRailCurveLeftInstanced = new THREE.InstancedMesh(
      curvedRailLeftGeo,
      beltRailMat,
      MAX_CURVED_BELT_INSTANCES
    );
    this.beltRailCurveLeftInstanced.frustumCulled = false;
    this.beltRailCurveLeftInstanced.count = 0;
    this.beltRailCurveLeftInstanced.castShadow = true;
    this.beltRailCurveLeftInstanced.receiveShadow = true;
    this.beltRailCurveLeftInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.beltRailCurveLeftInstanced);

    this.beltRailCurveRightInstanced = new THREE.InstancedMesh(
      curvedRailRightGeo,
      beltRailMat,
      MAX_CURVED_BELT_INSTANCES
    );
    this.beltRailCurveRightInstanced.frustumCulled = false;
    this.beltRailCurveRightInstanced.count = 0;
    this.beltRailCurveRightInstanced.castShadow = true;
    this.beltRailCurveRightInstanced.receiveShadow = true;
    this.beltRailCurveRightInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.beltRailCurveRightInstanced);

    for (let t = 0; t < 3; t++) {
      const tex = createFactorioBeltSurfaceTexture(tierStyles[t][0], tierStyles[t][1]);
      this.beltTrackTextures.push(tex);
      if (tex) this.sharedTextures.push(tex);
      const mat = new THREE.MeshStandardMaterial({
        color: tex ? 0xffffff : 0x48505c,
        map: tex ?? null,
        roughness: 0.56,
        metalness: 0.25,
      });
      const mesh = new THREE.InstancedMesh(beltDeckGeo, mat, MAX_BELT_INSTANCES);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.receiveShadow = true;
      mesh.userData.ignoreCameraFade = true;
      this.root.add(mesh);
      deckMeshes.push(mesh);

      const cLeftMesh = new THREE.InstancedMesh(curvedDeckLeftGeo, mat, MAX_CURVED_BELT_INSTANCES);
      cLeftMesh.frustumCulled = false;
      cLeftMesh.count = 0;
      cLeftMesh.receiveShadow = true;
      cLeftMesh.userData.ignoreCameraFade = true;
      this.root.add(cLeftMesh);
      curvedLeftDeckMeshes.push(cLeftMesh);

      const cRightMesh = new THREE.InstancedMesh(curvedDeckRightGeo, mat, MAX_CURVED_BELT_INSTANCES);
      cRightMesh.frustumCulled = false;
      cRightMesh.count = 0;
      cRightMesh.receiveShadow = true;
      cRightMesh.userData.ignoreCameraFade = true;
      this.root.add(cRightMesh);
      curvedRightDeckMeshes.push(cRightMesh);

      this.sharedMaterials.push(mat);
    }
    this.beltDeckInstancedByTier = [deckMeshes[0], deckMeshes[1], deckMeshes[2]];
    this.beltDeckCurveLeftByTier = [curvedLeftDeckMeshes[0], curvedLeftDeckMeshes[1], curvedLeftDeckMeshes[2]];
    this.beltDeckCurveRightByTier = [curvedRightDeckMeshes[0], curvedRightDeckMeshes[1], curvedRightDeckMeshes[2]];
    this.sharedGeometries.push(
      beltChassisGeo,
      beltSideRailGeo,
      beltSideBridgeGeo,
      beltDeckGeo,
      curvedChassisLeftGeo,
      curvedChassisRightGeo,
      curvedRailLeftGeo,
      curvedRailRightGeo,
      curvedDeckLeftGeo,
      curvedDeckRightGeo
    );
    this.sharedMaterials.push(beltChassisMat, beltRailMat, beltSideBridgeMat);

    // 4. Instanced Moving Items (8 distinct 3D shape archetypes with Factorio contrast colors)
    const shapeGeos = {} as Record<CapytorioItemShape, THREE.BufferGeometry>;
    const shapePools = {} as Record<CapytorioItemShape, THREE.InstancedMesh>;
    const shapeMaterials: Record<CapytorioItemShape, { roughness: number; metalness: number }> = {
      ore: { roughness: 0.68, metalness: 0.24 },
      plate: { roughness: 0.22, metalness: 0.78 },
      gear: { roughness: 0.24, metalness: 0.82 },
      circuit: { roughness: 0.3, metalness: 0.28 },
      science: { roughness: 0.14, metalness: 0.14 },
      coil: { roughness: 0.22, metalness: 0.82 },
      fruit: { roughness: 0.46, metalness: 0.05 },
      crate: { roughness: 0.44, metalness: 0.34 },
    };

    for (let i = 0; i < CAPYTORIO_ITEM_SHAPES.length; i++) {
      const shape = CAPYTORIO_ITEM_SHAPES[i];
      const geo = createItemShapeGeometry(shape);
      const spec = shapeMaterials[shape];
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: spec.roughness,
        metalness: spec.metalness,
      });
      const inst = new THREE.InstancedMesh(geo, mat, MAX_SHAPE_ITEM_INSTANCES);
      inst.frustumCulled = false;
      inst.count = 0;
      inst.castShadow = true;
      inst.userData.ignoreCameraFade = true;
      _color.setHex(0xffffff);
      inst.setColorAt(0, _color);
      this.root.add(inst);
      shapeGeos[shape] = geo;
      shapePools[shape] = inst;
      this.sharedGeometries.push(geo);
      this.sharedMaterials.push(mat);
    }
    this.itemGeosByShape = shapeGeos;
    this.itemInstancedByShape = shapePools;

    // 4B. Instanced Tropical Citrus Trees (Bark trunk + lush crown + ripe oranges)
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.27, 1.45, 7);
    trunkGeo.translate(0, 0.725, 0); // Grounded pivot at y = 0
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x6b4423,
      roughness: 0.9,
      metalness: 0.04,
    });
    this.treeTrunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, MAX_TREE_INSTANCES);
    this.treeTrunkInstanced.frustumCulled = false;
    this.treeTrunkInstanced.count = 0;
    this.treeTrunkInstanced.castShadow = true;
    this.treeTrunkInstanced.receiveShadow = true;
    this.treeTrunkInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.treeTrunkInstanced);

    const canopyGeo = new THREE.DodecahedronGeometry(0.95, 1);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.04,
    });
    this.treeCanopyInstanced = new THREE.InstancedMesh(canopyGeo, canopyMat, MAX_TREE_INSTANCES);
    this.treeCanopyInstanced.frustumCulled = false;
    this.treeCanopyInstanced.count = 0;
    this.treeCanopyInstanced.castShadow = true;
    this.treeCanopyInstanced.receiveShadow = true;
    this.treeCanopyInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.treeCanopyInstanced);

    const orangeGeo = new THREE.SphereGeometry(0.19, 7, 6);
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.24,
      roughness: 0.38,
      metalness: 0.08,
    });
    this.treeOrangeInstanced = new THREE.InstancedMesh(
      orangeGeo,
      orangeMat,
      MAX_TREE_INSTANCES * 3
    );
    this.treeOrangeInstanced.frustumCulled = false;
    this.treeOrangeInstanced.count = 0;
    this.treeOrangeInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.treeOrangeInstanced);

    this.sharedGeometries.push(trunkGeo, canopyGeo, orangeGeo);
    this.sharedMaterials.push(trunkMat, canopyMat, orangeMat);

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

    const baseGeo = new THREE.CylinderGeometry(1.4, 1.8, 0.35, 8);
    const base = new THREE.Mesh(baseGeo, this.matSteelDark);
    base.position.y = 0.175;
    base.castShadow = true;
    base.receiveShadow = true;
    pylon.add(base);

    const mastGeo = new THREE.CylinderGeometry(0.22, 0.34, 4.6, 8);
    const mast = new THREE.Mesh(mastGeo, this.matSteelLight);
    mast.position.y = 2.5;
    mast.castShadow = true;
    pylon.add(mast);

    const dishGeo = new THREE.TorusGeometry(0.85, 0.09, 8, 20);
    const dish = new THREE.Mesh(dishGeo, this.matBrass);
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
    const orbGeo = new THREE.OctahedronGeometry(0.45, 0);
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.y = 5.3;
    pylon.add(orb);
    this.sharedGeometries.push(baseGeo, mastGeo, dishGeo, orbGeo);
    this.sharedMaterials.push(orbMat);

    this.beaconPillarGroup.add(pylon);
    this.beaconPillarGroup.userData.__occluderRoot = this.beaconPillarGroup;
    pylon.traverse((node) => {
      node.userData.__occluderRoot = this.beaconPillarGroup;
    });
  }

  private getCachedMachineGeo(
    key: string,
    factory: () => THREE.BufferGeometry
  ): THREE.BufferGeometry {
    let geo = this.machineGeoCache.get(key);
    if (!geo) {
      geo = factory();
      this.machineGeoCache.set(key, geo);
      this.sharedGeometries.push(geo);
    }
    return geo;
  }

  private getCachedAccentMat(colorHex: number): THREE.MeshStandardMaterial {
    let mat = this.accentMatCache.get(colorHex);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.38,
        metalness: 0.35,
      });
      this.accentMatCache.set(colorHex, mat);
      this.sharedMaterials.push(mat);
    }
    return mat;
  }

  private getCachedHeldItemMat(colorHex: number): THREE.MeshStandardMaterial {
    let mat = this.heldItemMatCache.get(colorHex);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.28,
        metalness: 0.38,
      });
      this.heldItemMatCache.set(colorHex, mat);
      this.sharedMaterials.push(mat);
    }
    return mat;
  }

  /**
   * Returns only the tall Drop-Pod Beacon landmark (when requested in 3D chase camera mode).
   * Low-profile factory floor machines (furnaces, inserters, drills, etc.) are NEVER faded by
   * camera sightline rays, eliminating partial sub-mesh disappearance and shader compile stalls.
   */
  public collectOccluderCandidates(
    out: THREE.Object3D[],
    includeTallLandmark: boolean = true
  ): void {
    if (includeTallLandmark && this.beaconPillarGroup.visible) {
      out.push(this.beaconPillarGroup);
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
    const accentMat = this.getCachedAccentMat(spec.colorHex);
    const accentMeshes: THREE.Mesh[] = [];
    g.userData.accentMeshes = accentMeshes;
    g.userData.appliedTintHex = spec.colorHex;
    g.userData.__occluderRoot = g;
    g.userData.ignoreCameraFade = true;

    // Base chassis plinth sitting flush on y = 0 (shared geometry across every machine!)
    const plinth = new THREE.Mesh(
      this.getCachedMachineGeo('plinth', () => new THREE.BoxGeometry(2.05, 0.24, 2.05)),
      this.matSteelDark
    );
    plinth.position.y = 0.12;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    g.add(plinth);

    if (type === 'drill') {
      // Twin A-frame pillars + rotating drill auger + output chute pointing -Z
      const legGeo = this.getCachedMachineGeo('drill_leg', () => new THREE.BoxGeometry(0.28, 1.45, 0.36));
      for (const sx of [-0.72, 0.72]) {
        const leg = new THREE.Mesh(legGeo, this.matSteelLight);
        leg.position.set(sx, 0.92, 0);
        leg.castShadow = true;
        g.add(leg);
      }
      const bridge = new THREE.Mesh(
        this.getCachedMachineGeo('drill_bridge', () => new THREE.BoxGeometry(1.85, 0.34, 0.9)),
        accentMat
      );
      bridge.position.set(0, 1.56, 0);
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      g.add(bridge);
      accentMeshes.push(bridge);

      const augerGroup = new THREE.Group();
      augerGroup.position.set(0, 0.86, 0);
      const cone = new THREE.Mesh(
        this.getCachedMachineGeo('drill_cone', () => new THREE.ConeGeometry(0.46, 1.18, 8)),
        this.matBrass
      );
      cone.rotation.x = Math.PI;
      augerGroup.add(cone);
      const collar = new THREE.Mesh(
        this.getCachedMachineGeo('drill_collar', () => new THREE.TorusGeometry(0.4, 0.08, 6, 14)),
        this.matSteelLight
      );
      collar.rotation.x = Math.PI * 0.5;
      collar.position.y = 0.25;
      augerGroup.add(collar);
      g.add(augerGroup);
      g.userData.spinPart = augerGroup;

      const chute = new THREE.Mesh(
        this.getCachedMachineGeo('drill_chute', () => new THREE.BoxGeometry(0.55, 0.32, 0.65)),
        this.matHazardYellow
      );
      chute.position.set(0, 0.36, -0.98);
      g.add(chute);
    } else if (type === 'inserter') {
      // Multi-joint articulated Factorio mechanical inserter (all geometries pooled & shared)
      const ped = new THREE.Mesh(
        this.getCachedMachineGeo('ins_ped', () => new THREE.CylinderGeometry(0.56, 0.72, 0.22, 8)),
        this.matSteelLight
      );
      ped.position.y = 0.26;
      ped.castShadow = true;
      ped.receiveShadow = true;
      g.add(ped);

      const turret = new THREE.Group();
      turret.position.set(0, 0.38, 0);

      const turretCollar = new THREE.Mesh(
        this.getCachedMachineGeo('ins_collar', () => new THREE.CylinderGeometry(0.36, 0.44, 0.22, 8)),
        accentMat
      );
      turretCollar.position.y = 0.08;
      turret.add(turretCollar);
      accentMeshes.push(turretCollar);

      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(0, 0.22, 0);

      const shoulderPin = new THREE.Mesh(
        this.getCachedMachineGeo('ins_pin', () => new THREE.CylinderGeometry(0.16, 0.16, 0.44, 10)),
        this.matSteelDark
      );
      shoulderPin.rotation.z = Math.PI * 0.5;
      shoulderPivot.add(shoulderPin);

      const upperArmGeo = this.getCachedMachineGeo(
        'ins_upper',
        () => new THREE.BoxGeometry(0.11, INSERTER_UPPER_ARM_LEN, 0.2)
      );
      const upperArmL = new THREE.Mesh(upperArmGeo, accentMat);
      upperArmL.position.set(-0.12, INSERTER_UPPER_ARM_LEN * 0.5, 0);
      upperArmL.castShadow = true;
      shoulderPivot.add(upperArmL);
      accentMeshes.push(upperArmL);

      const upperArmR = new THREE.Mesh(upperArmGeo, accentMat);
      upperArmR.position.set(0.12, INSERTER_UPPER_ARM_LEN * 0.5, 0);
      upperArmR.castShadow = true;
      shoulderPivot.add(upperArmR);
      accentMeshes.push(upperArmR);

      const upperStrut = new THREE.Mesh(
        this.getCachedMachineGeo('ins_strut', () => new THREE.BoxGeometry(0.14, 1.12, 0.14)),
        this.matSteelLight
      );
      upperStrut.position.set(0, 0.72, 0.08);
      shoulderPivot.add(upperStrut);

      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, INSERTER_UPPER_ARM_LEN, 0);

      const elbowDrum = new THREE.Mesh(
        this.getCachedMachineGeo('ins_drum', () => new THREE.CylinderGeometry(0.18, 0.18, 0.36, 12)),
        this.matSteelDark
      );
      elbowDrum.rotation.z = Math.PI * 0.5;
      elbowPivot.add(elbowDrum);

      const elbowCap = new THREE.Mesh(
        this.getCachedMachineGeo('ins_cap', () => new THREE.CylinderGeometry(0.11, 0.11, 0.4, 10)),
        this.matBrass
      );
      elbowCap.rotation.z = Math.PI * 0.5;
      elbowPivot.add(elbowCap);

      const forearm = new THREE.Mesh(
        this.getCachedMachineGeo(
          'ins_forearm',
          () => new THREE.BoxGeometry(0.16, 0.15, INSERTER_FOREARM_LEN)
        ),
        this.matSteelLight
      );
      forearm.position.set(0, 0, -INSERTER_FOREARM_LEN * 0.5);
      forearm.castShadow = true;
      elbowPivot.add(forearm);

      const forearmRib = new THREE.Mesh(
        this.getCachedMachineGeo('ins_rib', () => new THREE.BoxGeometry(0.2, 0.08, 1.24)),
        accentMat
      );
      forearmRib.position.set(0, 0.06, -0.78);
      elbowPivot.add(forearmRib);
      accentMeshes.push(forearmRib);

      const wristPivot = new THREE.Group();
      wristPivot.position.set(0, 0, -INSERTER_FOREARM_LEN);

      const wristHub = new THREE.Mesh(
        this.getCachedMachineGeo('ins_wrist', () => new THREE.BoxGeometry(0.32, 0.14, 0.22)),
        this.matSteelDark
      );
      wristPivot.add(wristHub);

      const jawGeo = this.getCachedMachineGeo('ins_jaw', () => new THREE.BoxGeometry(0.065, 0.26, 0.14));
      for (const sx of [-0.15, 0.15]) {
        const jaw = new THREE.Mesh(jawGeo, this.matBrass);
        jaw.position.set(sx, -0.14, 0);
        wristPivot.add(jaw);
      }

      // Pre-built held item meshes sharing cached color materials (zero per-inserter material allocs)
      const defaultHeldMat = this.getCachedHeldItemMat(0xffffff);
      const heldMount = new THREE.Group();
      heldMount.position.set(0, -0.28, 0);
      const heldMeshesByShape = {} as Record<CapytorioItemShape, THREE.Mesh>;
      for (let sIdx = 0; sIdx < CAPYTORIO_ITEM_SHAPES.length; sIdx++) {
        const shape = CAPYTORIO_ITEM_SHAPES[sIdx];
        const m = new THREE.Mesh(this.itemGeosByShape[shape], defaultHeldMat);
        m.visible = false;
        heldMount.add(m);
        heldMeshesByShape[shape] = m;
      }
      wristPivot.add(heldMount);

      elbowPivot.add(wristPivot);
      shoulderPivot.add(elbowPivot);
      turret.add(shoulderPivot);
      g.add(turret);

      g.userData.turret = turret;
      g.userData.shoulderPivot = shoulderPivot;
      g.userData.elbowPivot = elbowPivot;
      g.userData.wristPivot = wristPivot;
      g.userData.heldMeshesByShape = heldMeshesByShape;
      g.userData.lastHeldColorHex = 0xffffff;
    } else if (type === 'furnace') {
      const kiln = new THREE.Mesh(
        this.getCachedMachineGeo('furn_kiln', () => new THREE.CylinderGeometry(0.86, 1.0, 1.35, 8)),
        this.matBrick
      );
      kiln.position.y = 0.9;
      kiln.castShadow = true;
      kiln.receiveShadow = true;
      g.add(kiln);

      const chimneyGeo = this.getCachedMachineGeo(
        'furn_chimney',
        () => new THREE.CylinderGeometry(0.18, 0.22, 1.0, 8)
      );
      const chimneyL = new THREE.Mesh(chimneyGeo, this.matSteelDark);
      chimneyL.position.set(-0.46, 1.85, 0.35);
      chimneyL.castShadow = true;
      g.add(chimneyL);

      const chimneyR = new THREE.Mesh(chimneyGeo, this.matSteelDark);
      chimneyR.position.set(0.46, 1.85, 0.35);
      chimneyR.castShadow = true;
      g.add(chimneyR);

      const hearth = new THREE.Mesh(
        this.getCachedMachineGeo('furn_hearth', () => new THREE.BoxGeometry(0.75, 0.52, 0.2)),
        this.matFurnaceHearthIdle
      );
      hearth.position.set(0, 0.65, -0.88);
      g.add(hearth);
      g.userData.hearthMesh = hearth;

      const capRing = new THREE.Mesh(
        this.getCachedMachineGeo('furn_ring', () => new THREE.TorusGeometry(0.72, 0.08, 6, 12)),
        this.matCopper
      );
      capRing.rotation.x = Math.PI * 0.5;
      capRing.position.y = 1.56;
      g.add(capRing);

      const furnaceOutPort = new THREE.Mesh(
        this.getCachedMachineGeo('furn_port', () => new THREE.BoxGeometry(0.55, 0.24, 0.34)),
        this.matHazardYellow
      );
      furnaceOutPort.position.set(0, 0.28, -0.96);
      g.add(furnaceOutPort);
    } else if (type === 'assembler') {
      const hull = new THREE.Mesh(
        this.getCachedMachineGeo('asm_hull', () => new THREE.BoxGeometry(1.86, 1.05, 1.86)),
        accentMat
      );
      hull.position.y = 0.76;
      hull.castShadow = true;
      hull.receiveShadow = true;
      g.add(hull);
      accentMeshes.push(hull);

      const hood = new THREE.Mesh(
        this.getCachedMachineGeo('asm_hood', () => new THREE.BoxGeometry(1.42, 0.3, 1.42)),
        this.matSteelLight
      );
      hood.position.y = 1.42;
      hood.castShadow = true;
      g.add(hood);

      const gearA = new THREE.Mesh(
        this.getCachedMachineGeo('asm_gearA', () => new THREE.CylinderGeometry(0.42, 0.42, 0.18, 8)),
        this.matBrass
      );
      gearA.position.set(-0.36, 1.66, 0);
      g.add(gearA);

      const gearB = new THREE.Mesh(
        this.getCachedMachineGeo('asm_gearB', () => new THREE.CylinderGeometry(0.32, 0.32, 0.18, 6)),
        this.matSteelLight
      );
      gearB.position.set(0.38, 1.66, 0);
      g.add(gearB);

      const portOut = new THREE.Mesh(
        this.getCachedMachineGeo('asm_port', () => new THREE.BoxGeometry(0.6, 0.34, 0.28)),
        this.matHazardYellow
      );
      portOut.position.set(0, 0.46, -0.98);
      g.add(portOut);

      g.userData.gearA = gearA;
      g.userData.gearB = gearB;
    } else if (type === 'generator') {
      const boiler = new THREE.Mesh(
        this.getCachedMachineGeo('gen_boiler', () => new THREE.CylinderGeometry(0.68, 0.68, 1.65, 12)),
        accentMat
      );
      boiler.rotation.x = Math.PI * 0.5;
      boiler.position.set(0, 0.98, 0);
      boiler.castShadow = true;
      boiler.receiveShadow = true;
      g.add(boiler);
      accentMeshes.push(boiler);

      const firebox = new THREE.Mesh(
        this.getCachedMachineGeo('gen_firebox', () => new THREE.BoxGeometry(0.64, 0.44, 0.22)),
        this.matGeneratorFireboxIdle
      );
      firebox.position.set(0, 0.65, -0.82);
      g.add(firebox);
      g.userData.fireboxMesh = firebox;

      const stack = new THREE.Mesh(
        this.getCachedMachineGeo('gen_stack', () => new THREE.CylinderGeometry(0.24, 0.3, 1.4, 8)),
        this.matSteelDark
      );
      stack.position.set(0.45, 1.9, 0.42);
      stack.castShadow = true;
      g.add(stack);

      const pipe = new THREE.Mesh(
        this.getCachedMachineGeo('gen_pipe', () => new THREE.TorusGeometry(0.48, 0.1, 6, 12)),
        this.matCopper
      );
      pipe.position.set(-0.52, 1.15, -0.2);
      pipe.rotation.y = Math.PI * 0.5;
      g.add(pipe);

      const flywheel = new THREE.Mesh(
        this.getCachedMachineGeo('gen_flywheel', () => new THREE.CylinderGeometry(0.62, 0.62, 0.18, 12)),
        this.matBrass
      );
      flywheel.rotation.z = Math.PI * 0.5;
      flywheel.position.set(-0.88, 0.98, 0.15);
      g.add(flywheel);
      g.userData.flywheel = flywheel;
    } else if (type === 'lab') {
      const consoleBase = new THREE.Mesh(
        this.getCachedMachineGeo('lab_base', () => new THREE.CylinderGeometry(0.95, 1.05, 0.45, 6)),
        this.matSteelLight
      );
      consoleBase.position.y = 0.46;
      consoleBase.castShadow = true;
      consoleBase.receiveShadow = true;
      g.add(consoleBase);

      const core = new THREE.Mesh(
        this.getCachedMachineGeo('lab_core', () => new THREE.OctahedronGeometry(0.44, 0)),
        this.matLabCoreIdle
      );
      core.position.y = 1.25;
      g.add(core);
      g.userData.labCoreMesh = core;

      const dome = new THREE.Mesh(
        this.getCachedMachineGeo(
          'lab_dome',
          () => new THREE.SphereGeometry(0.88, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)
        ),
        this.matLabGlass
      );
      dome.position.y = 0.68;
      dome.renderOrder = 3;
      g.add(dome);
      g.userData.spinPart = core;
    } else if (type === 'splitter') {
      const passDeck = new THREE.Mesh(
        this.getCachedMachineGeo(
          'split_deck',
          () => new THREE.BoxGeometry(2.16, 0.14, CAPYTORIO_TILE_SIZE + 0.02)
        ),
        this.matSteelDark
      );
      passDeck.position.y = 0.07;
      passDeck.receiveShadow = true;
      g.add(passDeck);

      const bridge = new THREE.Mesh(
        this.getCachedMachineGeo('split_bridge', () => new THREE.BoxGeometry(2.14, 0.62, 1.25)),
        accentMat
      );
      bridge.position.y = 0.54;
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      g.add(bridge);
      accentMeshes.push(bridge);

      const dial = new THREE.Mesh(
        this.getCachedMachineGeo('split_dial', () => new THREE.ConeGeometry(0.42, 0.45, 4)),
        this.matHazardYellow
      );
      dial.rotation.x = -Math.PI * 0.5;
      dial.position.set(0, 0.98, -0.15);
      g.add(dial);
    } else if (type === 'tunnel') {
      const passDeck = new THREE.Mesh(
        this.getCachedMachineGeo(
          'split_deck',
          () => new THREE.BoxGeometry(2.16, 0.14, CAPYTORIO_TILE_SIZE + 0.02)
        ),
        this.matSteelDark
      );
      passDeck.position.y = 0.07;
      passDeck.receiveShadow = true;
      g.add(passDeck);

      const arch = new THREE.Mesh(
        this.getCachedMachineGeo(
          'tun_arch',
          () => new THREE.CylinderGeometry(0.75, 0.85, 1.5, 10, 1, false, 0, Math.PI)
        ),
        accentMat
      );
      arch.rotation.z = Math.PI * 0.5;
      arch.rotation.y = Math.PI * 0.5;
      arch.position.set(0, 0.3, 0);
      arch.castShadow = true;
      g.add(arch);
      accentMeshes.push(arch);

      const signArrow = new THREE.Mesh(
        this.getCachedMachineGeo('tun_arrow', () => new THREE.ConeGeometry(0.34, 0.65, 4)),
        this.matHazardYellow
      );
      signArrow.rotation.x = -Math.PI * 0.5;
      signArrow.position.set(0, 1.15, -0.1);
      g.add(signArrow);
    } else if (type === 'chest') {
      const body = new THREE.Mesh(
        this.getCachedMachineGeo('chest_body', () => new THREE.BoxGeometry(1.5, 0.88, 1.5)),
        accentMat
      );
      body.position.y = 0.66;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      accentMeshes.push(body);

      const lid = new THREE.Mesh(
        this.getCachedMachineGeo('chest_lid', () => new THREE.BoxGeometry(1.6, 0.22, 1.6)),
        this.matBrass
      );
      lid.position.y = 1.18;
      lid.castShadow = true;
      g.add(lid);
    }

    // Guarantee every sub-mesh is immune to partial camera occlusion fading
    g.traverse((node) => {
      node.userData.__occluderRoot = g;
      node.userData.ignoreCameraFade = true;
    });

    return g;
  }

  public sync(
    engine: CapytorioFactoryEngine,
    camX: number,
    camZ: number,
    dt: number,
    timeSec: number,
    visible: boolean,
    altitudeRadius: number = 26
  ): void {
    const logAlt = Math.log10(Math.max(10, altitudeRadius));
    // Smoothly fade entire factory cluster out past 100km once its on-screen size becomes sub-pixel (< 1 px)
    const factoryClusterFade =
      logAlt <= 4.35 ? 1.0 : logAlt >= 5.18 ? 0.0 : 1.0 - (logAlt - 4.35) / (5.18 - 4.35);
    const effectiveVisible = visible && factoryClusterFade > 0.01;
    this.root.visible = effectiveVisible;
    if (!effectiveVisible) return;

    // Smoothly dissolve lush Factorio grass deck into Capy-Earth planetary texture between ~250m and ~2.8km
    const deckAlpha =
      logAlt <= 2.40 ? 1.0 : logAlt >= 3.45 ? 0.0 : 1.0 - (logAlt - 2.40) / (3.45 - 2.40);
    const showGroundDeck = deckAlpha > 0.015;
    this.groundDeck.visible = showGroundDeck;
    this.groundEdgeStrip.visible = showGroundDeck;
    if (showGroundDeck) {
      const wantTransparent = deckAlpha < 0.995;
      if (this.deckMat.transparent !== wantTransparent) {
        this.deckMat.transparent = wantTransparent;
        this.deckMat.needsUpdate = true;
      }
      if (this.coastMat.transparent !== wantTransparent) {
        this.coastMat.transparent = wantTransparent;
        this.coastMat.needsUpdate = true;
      }
      this.deckMat.opacity = deckAlpha;
      this.deckMat.depthWrite = deckAlpha >= 0.98;
      this.coastMat.opacity = deckAlpha;
      this.coastMat.depthWrite = deckAlpha >= 0.98;
      const deckExtentScale = Math.max(1.0, Math.min(10.0, altitudeRadius / 72.0));
      this.groundDeck.scale.set(deckExtentScale, 1, deckExtentScale);
      const snapStep = CAPYTORIO_TILE_SIZE * 4;
      const deckX = Math.max(500 + 160 * deckExtentScale, Math.round(camX / snapStep) * snapStep);
      const deckZ = Math.round(camZ / snapStep) * snapStep;
      this.groundDeck.position.set(deckX, -0.02, deckZ);
      this.groundEdgeStrip.position.z = deckZ;
    }

    // Sub-pixel gentle scale-down right as factory disappears into planet surface
    const subPixelShrink = factoryClusterFade < 0.99 ? 0.35 + 0.65 * factoryClusterFade : 1.0;

    // 2. Determine visible tile window around camera target & dirty-cache static ore/tree instanced buffers
    const centerGx = Math.round((camX - CAPYTORIO_WORLD_ORIGIN_X) / CAPYTORIO_TILE_SIZE);
    const centerGz = Math.round((camZ - CAPYTORIO_WORLD_ORIGIN_Z) / CAPYTORIO_TILE_SIZE);
    const terrainTileRadius =
      altitudeRadius > 1100
        ? 0
        : Math.min(28, Math.max(MAX_VISIBLE_RADIUS_TILES, Math.round(altitudeRadius * 0.25)));

    const terrainDirty =
      centerGx !== this.lastTerrainCenterGx ||
      centerGz !== this.lastTerrainCenterGz ||
      terrainTileRadius !== this.lastTerrainRadius ||
      engine.topologyRevision !== this.lastTerrainTopoRev ||
      Math.abs(subPixelShrink - this.lastTerrainSubPixel) > 0.005;

    if (terrainDirty) {
      this.lastTerrainCenterGx = centerGx;
      this.lastTerrainCenterGz = centerGz;
      this.lastTerrainRadius = terrainTileRadius;
      this.lastTerrainTopoRev = engine.topologyRevision;
      this.lastTerrainSubPixel = subPixelShrink;

      let oreCount = 0;
      let treeCount = 0;
      let orangeCount = 0;
      if (terrainTileRadius > 0) {
        for (let dx = -terrainTileRadius; dx <= terrainTileRadius; dx++) {
          const gx = centerGx + dx;
          const wx = capytorioGridToWorldX(gx);
          if (wx < 504) continue; // Keep ocean shelf clean
          for (let dz = -terrainTileRadius; dz <= terrainTileRadius; dz++) {
            const gz = centerGz + dz;
            const wz = capytorioGridToWorldZ(gz);
            const h = hashTile(gx, gz);

            if (oreCount < MAX_ORE_INSTANCES) {
              const res = engine.getResourceAt(gx, gz);
              if (res) {
                const meta = getCapytorioItemMeta(res.resource);

                _dummy.position.set(wx, 0.025, wz);
                _dummy.rotation.set(0, h * Math.PI, 0);
                _dummy.scale.setScalar(subPixelShrink);
                _dummy.updateMatrix();
                this.orePlateInstanced.setMatrixAt(oreCount, _dummy.matrix);
                _color.setHex(meta.colorHex).multiplyScalar(0.55);
                this.orePlateInstanced.setColorAt(oreCount, _color);

                const hasDrill = engine.machines.get(tileKey(gx, gz))?.type === 'drill';
                const crystalScale = (hasDrill ? 0.55 : 0.78 + h * 0.45) * subPixelShrink;
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
                continue;
              }
            }

            if (treeCount < MAX_TREE_INSTANCES && engine.hasTreeAt(gx, gz)) {
              const treeScale = (0.85 + h * 0.3) * subPixelShrink;
              const jitterX = (h - 0.5) * 0.45;
              const jitterZ = (((h * 13) % 1) - 0.5) * 0.45;
              const tx = wx + jitterX;
              const tz = wz + jitterZ;

              _dummy.position.set(tx, 0, tz);
              _dummy.rotation.set(0, h * Math.PI * 2, 0);
              _dummy.scale.set(treeScale, treeScale, treeScale);
              _dummy.updateMatrix();
              this.treeTrunkInstanced.setMatrixAt(treeCount, _dummy.matrix);

              _dummy.position.set(tx, 1.82 * treeScale, tz);
              _dummy.rotation.set(h * 0.3, h * 6.28, 0);
              _dummy.scale.set(treeScale, treeScale * 0.88, treeScale);
              _dummy.updateMatrix();
              this.treeCanopyInstanced.setMatrixAt(treeCount, _dummy.matrix);
              const greenShade = h < 0.34 ? 0x22792c : h < 0.68 ? 0x2f8f34 : 0x3da33d;
              _color.setHex(greenShade);
              this.treeCanopyInstanced.setColorAt(treeCount, _color);

              for (let oi = 0; oi < 3 && orangeCount < MAX_TREE_INSTANCES * 3; oi++) {
                const oAngle = h * 6.28 + oi * 2.094;
                const oRad = 0.84 * treeScale;
                _dummy.position.set(
                  tx + Math.cos(oAngle) * oRad,
                  (2.08 + (oi % 2) * 0.22) * treeScale,
                  tz + Math.sin(oAngle) * oRad
                );
                _dummy.rotation.set(0, 0, 0);
                _dummy.scale.setScalar(treeScale);
                _dummy.updateMatrix();
                this.treeOrangeInstanced.setMatrixAt(orangeCount, _dummy.matrix);
                orangeCount++;
              }
              treeCount++;
            }
          }
        }
      }
      this.orePlateInstanced.count = oreCount;
      this.orePlateInstanced.instanceMatrix.needsUpdate = true;
      if (this.orePlateInstanced.instanceColor) this.orePlateInstanced.instanceColor.needsUpdate = true;
      this.oreCrystalInstanced.count = oreCount;
      this.oreCrystalInstanced.instanceMatrix.needsUpdate = true;
      if (this.oreCrystalInstanced.instanceColor) this.oreCrystalInstanced.instanceColor.needsUpdate = true;
      this.treeTrunkInstanced.count = treeCount;
      this.treeTrunkInstanced.instanceMatrix.needsUpdate = true;
      this.treeCanopyInstanced.count = treeCount;
      this.treeCanopyInstanced.instanceMatrix.needsUpdate = true;
      if (this.treeCanopyInstanced.instanceColor) this.treeCanopyInstanced.instanceColor.needsUpdate = true;
      this.treeOrangeInstanced.count = orangeCount;
      this.treeOrangeInstanced.instanceMatrix.needsUpdate = true;
    }

    // Pulse shared active generator firebox material once per frame
    this.matGeneratorFireboxActive.emissiveIntensity = 1.55 + Math.sin(timeSec * 8.0) * 0.35;

    // 3. Synchronize belt chevron UV scroll strictly 1:1 with CapytorioFactoryEngine.beltScrollPhase
    this.lastBeltScrollPhase = engine.beltScrollPhase;
    for (let t = 0; t < this.beltTrackTextures.length; t++) {
      const tex = this.beltTrackTextures[t];
      if (tex) {
        const tierMult = t === 0 ? 1.0 : t === 1 ? 2.0 : 3.0;
        // Decreasing offset.y scrolls canvas texture forward along -Z / curved tangent at exact item rate
        tex.offset.y = -((this.lastBeltScrollPhase * tierMult) % 1.0);
      }
    }

    let beltChassisCount = 0;
    let beltRailSideCount = 0;
    let beltSideBridgeCount = 0;
    let beltCurvedLeftCount = 0;
    let beltCurvedRightCount = 0;
    _beltTierCounts[0] = 0;
    _beltTierCounts[1] = 0;
    _beltTierCounts[2] = 0;
    _curvedLeftTierCounts[0] = 0;
    _curvedLeftTierCounts[1] = 0;
    _curvedLeftTierCounts[2] = 0;
    _curvedRightTierCounts[0] = 0;
    _curvedRightTierCounts[1] = 0;
    _curvedRightTierCounts[2] = 0;
    for (let sIdx = 0; sIdx < CAPYTORIO_ITEM_SHAPES.length; sIdx++) {
      _shapeCounts[CAPYTORIO_ITEM_SHAPES[sIdx]] = 0;
    }
    _activeKeysScratch.clear();

    const maxVisibleMeters = Math.max(
      (MAX_VISIBLE_RADIUS_TILES + 4) * CAPYTORIO_TILE_SIZE,
      altitudeRadius * 1.5
    );
    const beltHalfSpanX = CAPYTORIO_TILE_SIZE * 0.88 * 0.5 - 0.055; // 1.045m from tile center
    const renderItemsAtScale = altitudeRadius <= 1800;

    for (const [k, m] of engine.machines) {
      const wx = capytorioGridToWorldX(m.gx);
      const wz = capytorioGridToWorldZ(m.gz);
      if (Math.abs(wx - camX) > maxVisibleMeters || Math.abs(wz - camZ) > maxVisibleMeters) {
        continue;
      }

      const fwdDx = DIR_DX[m.dir];
      const fwdDz = DIR_DZ[m.dir];
      const rightDx = -fwdDz;
      const rightDz = fwdDx;
      const rotY = dirToRotY(m.dir);
      const curveShape = m.type === 'belt' ? getBeltCurveShape(engine.machines, m) : 'straight';

      if (m.type === 'belt') {
        const tierMult = m.tierMult ?? 1.0;
        const tierIdx: 0 | 1 | 2 =
          m.variantItemId === 'express_transport_belt' || tierMult >= 2.8
            ? 2
            : m.variantItemId === 'fast_transport_belt' || tierMult >= 1.8
              ? 1
              : 0;
        const railTint = tierIdx === 2 ? 0x38bdf8 : tierIdx === 1 ? 0xf87171 : 0x717d8e;
        _color.setHex(railTint);

        _dummy.position.set(wx, 0, wz);
        _dummy.rotation.set(0, rotY, 0);
        _dummy.scale.setScalar(subPixelShrink);
        _dummy.updateMatrix();

        if (curveShape === 'curve_from_left') {
          if (beltCurvedLeftCount < MAX_CURVED_BELT_INSTANCES) {
            this.beltChassisCurveLeftInstanced.setMatrixAt(beltCurvedLeftCount, _dummy.matrix);
            this.beltRailCurveLeftInstanced.setMatrixAt(beltCurvedLeftCount, _dummy.matrix);
            this.beltRailCurveLeftInstanced.setColorAt(beltCurvedLeftCount, _color);
            beltCurvedLeftCount++;

            const tCount = _curvedLeftTierCounts[tierIdx];
            if (tCount < MAX_CURVED_BELT_INSTANCES) {
              this.beltDeckCurveLeftByTier[tierIdx].setMatrixAt(tCount, _dummy.matrix);
              _curvedLeftTierCounts[tierIdx] = tCount + 1;
            }
          }
        } else if (curveShape === 'curve_from_right') {
          if (beltCurvedRightCount < MAX_CURVED_BELT_INSTANCES) {
            this.beltChassisCurveRightInstanced.setMatrixAt(beltCurvedRightCount, _dummy.matrix);
            this.beltRailCurveRightInstanced.setMatrixAt(beltCurvedRightCount, _dummy.matrix);
            this.beltRailCurveRightInstanced.setColorAt(beltCurvedRightCount, _color);
            beltCurvedRightCount++;

            const tCount = _curvedRightTierCounts[tierIdx];
            if (tCount < MAX_CURVED_BELT_INSTANCES) {
              this.beltDeckCurveRightByTier[tierIdx].setMatrixAt(tCount, _dummy.matrix);
              _curvedRightTierCounts[tierIdx] = tCount + 1;
            }
          }
        } else if (beltChassisCount < MAX_BELT_INSTANCES) {
          this.beltChassisInstanced.setMatrixAt(beltChassisCount, _dummy.matrix);
          beltChassisCount++;

          const tCount = _beltTierCounts[tierIdx];
          if (tCount < MAX_BELT_INSTANCES) {
            this.beltDeckInstancedByTier[tierIdx].setMatrixAt(tCount, _dummy.matrix);
            _beltTierCounts[tierIdx] = tCount + 1;
          }

          // Check perpendicular neighbors feeding into left or right side of this straight/T-junction belt
          const leftNb = engine.machines.get(tileKey(m.gx - rightDx, m.gz - rightDz));
          const leftFeed = Boolean(
            leftNb &&
              (leftNb.type === 'belt' || leftNb.type === 'splitter' || leftNb.type === 'tunnel' || leftNb.type === 'drill') &&
              DIR_DX[leftNb.dir] === rightDx &&
              DIR_DZ[leftNb.dir] === rightDz
          );
          const rightNb = engine.machines.get(tileKey(m.gx + rightDx, m.gz + rightDz));
          const rightFeed = Boolean(
            rightNb &&
              (rightNb.type === 'belt' || rightNb.type === 'splitter' || rightNb.type === 'tunnel' || rightNb.type === 'drill') &&
              DIR_DX[rightNb.dir] === -rightDx &&
              DIR_DZ[rightNb.dir] === -rightDz
          );

          if (!leftFeed && beltRailSideCount < MAX_BELT_INSTANCES * 2) {
            _dummy.position.set(wx - rightDx * beltHalfSpanX, 0, wz - rightDz * beltHalfSpanX);
            _dummy.rotation.set(0, rotY, 0);
            _dummy.scale.setScalar(subPixelShrink);
            _dummy.updateMatrix();
            this.beltRailSideInstanced.setMatrixAt(beltRailSideCount, _dummy.matrix);
            this.beltRailSideInstanced.setColorAt(beltRailSideCount, _color);
            beltRailSideCount++;
          } else if (leftFeed && beltSideBridgeCount < MAX_BELT_INSTANCES * 2) {
            _dummy.position.set(wx - rightDx * 1.15, 0, wz - rightDz * 1.15);
            _dummy.rotation.set(0, rotY, 0);
            _dummy.scale.setScalar(subPixelShrink);
            _dummy.updateMatrix();
            this.beltSideBridgeInstanced.setMatrixAt(beltSideBridgeCount, _dummy.matrix);
            beltSideBridgeCount++;
          }

          if (!rightFeed && beltRailSideCount < MAX_BELT_INSTANCES * 2) {
            _dummy.position.set(wx + rightDx * beltHalfSpanX, 0, wz + rightDz * beltHalfSpanX);
            _dummy.rotation.set(0, rotY, 0);
            _dummy.scale.setScalar(subPixelShrink);
            _dummy.updateMatrix();
            this.beltRailSideInstanced.setMatrixAt(beltRailSideCount, _dummy.matrix);
            this.beltRailSideInstanced.setColorAt(beltRailSideCount, _color);
            beltRailSideCount++;
          } else if (rightFeed && beltSideBridgeCount < MAX_BELT_INSTANCES * 2) {
            _dummy.position.set(wx + rightDx * 1.15, 0, wz + rightDz * 1.15);
            _dummy.rotation.set(0, rotY, 0);
            _dummy.scale.setScalar(subPixelShrink);
            _dummy.updateMatrix();
            this.beltSideBridgeInstanced.setMatrixAt(beltSideBridgeCount, _dummy.matrix);
            beltSideBridgeCount++;
          }
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
        group.rotation.y = rotY;
        group.scale.setScalar(subPixelShrink);
        const accentMeshes = group.userData.accentMeshes as THREE.Mesh[] | undefined;
        if (accentMeshes && accentMeshes.length > 0) {
          const tint = m.variantItemId
            ? resolveCapytorioPlaceableSpec(m.variantItemId)?.tintHex ?? CAPYTORIO_MACHINE_SPECS[m.type].colorHex
            : CAPYTORIO_MACHINE_SPECS[m.type].colorHex;
          if (group.userData.appliedTintHex !== tint) {
            const sharedTintMat = this.getCachedAccentMat(tint);
            for (let ai = 0; ai < accentMeshes.length; ai++) {
              accentMeshes[ai].material = sharedTintMat;
            }
            group.userData.appliedTintHex = tint;
          }
        }

        // Zero-allocation mechanical animations & 2-bone analytical inserter IK
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
          const fireboxMesh = group.userData.fireboxMesh as THREE.Mesh | undefined;
          if (fireboxMesh) {
            const desiredMat =
              m.fuelTimer > 0 ? this.matGeneratorFireboxActive : this.matGeneratorFireboxIdle;
            if (fireboxMesh.material !== desiredMat) {
              fireboxMesh.material = desiredMat;
            }
          }
        } else if (m.type === 'lab' && group.userData.spinPart) {
          const core = group.userData.spinPart as THREE.Object3D;
          core.rotation.y = timeSec * (m.craftProgress > 0.01 ? 4.8 : 2.4);
          core.position.y = 1.25 + Math.sin(timeSec * 3.2) * 0.08;
          const coreMesh = group.userData.labCoreMesh as THREE.Mesh | undefined;
          if (coreMesh) {
            const desiredMat =
              m.craftProgress > 0.01 ? this.matLabCoreActive : this.matLabCoreIdle;
            if (coreMesh.material !== desiredMat) {
              coreMesh.material = desiredMat;
            }
          }
        } else if (m.type === 'inserter' && group.userData.turret) {
          const turret = group.userData.turret as THREE.Object3D;
          const shoulderPivot = group.userData.shoulderPivot as THREE.Object3D | undefined;
          const elbowPivot = group.userData.elbowPivot as THREE.Object3D | undefined;
          const wristPivot = group.userData.wristPivot as THREE.Object3D | undefined;

          // Compute exact world-local target (tgtX, yWrist, tgtZ) in inserter's local space (-Z forward)
          const phase = m.inserterPhase ?? (m.holdingItem ? 'carrying' : m.armSwing > 0.01 ? 'returning' : 'idle_pickup');
          const px = m.pickupLocalX ?? 0;
          const pz = m.pickupLocalZ ?? 2.35;
          const dx = m.dropLocalX ?? 0;
          const dz = m.dropLocalZ ?? -2.35;

          let tgtX = 0;
          let tgtZ = 1.45;
          let yWrist = 0.96;

          if (phase === 'idle_pickup') {
            const relax = 1.0 - (m.armExtend ?? 0);
            tgtX = px * (1 - relax);
            tgtZ = 1.45 + (pz - 1.45) * (1 - relax);
            yWrist = 0.96 - (1 - relax) * 0.54;
          } else if (phase === 'reaching') {
            const eRaw = m.armExtend ?? 0;
            const e = eRaw * eRaw * (3 - 2 * eRaw);
            tgtX = px * e;
            tgtZ = 1.45 + (pz - 1.45) * e;
            yWrist = 0.96 + (0.40 - 0.96) * e;
          } else if (phase === 'carrying') {
            const s = m.armSwing < 0 ? 0 : m.armSwing > 1 ? 1 : m.armSwing;
            const aStart = Math.atan2(-px, -pz);
            const aEnd = Math.atan2(-dx, -dz);
            let da = aEnd - aStart;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            const rStart = Math.hypot(px, pz);
            const rEnd = Math.hypot(dx, dz);
            const curAng = aStart + da * s;
            const curRad = rStart + (rEnd - rStart) * s;
            tgtX = -Math.sin(curAng) * curRad;
            tgtZ = -Math.cos(curAng) * curRad;
            yWrist = 0.40 + Math.sin(s * Math.PI) * 0.72;
          } else {
            // 'returning': sweep smoothly from drop (1) back to idle hover (0) empty
            const s = m.armSwing < 0 ? 0 : m.armSwing > 1 ? 1 : m.armSwing;
            const aStart = Math.atan2(0, -1.45);
            const aEnd = Math.atan2(-dx, -dz);
            let da = aEnd - aStart;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            const rStart = 1.45;
            const rEnd = Math.hypot(dx, dz);
            const curAng = aStart + da * s;
            const curRad = rStart + (rEnd - rStart) * s;
            tgtX = -Math.sin(curAng) * curRad;
            tgtZ = -Math.cos(curAng) * curRad;
            yWrist = 0.40 + Math.sin(s * Math.PI) * 0.48 + (1 - s) * 0.56;
          }

          turret.rotation.y = Math.atan2(-tgtX, -tgtZ);

          if (shoulderPivot && elbowPivot && wristPivot) {
            const rTarget = Math.max(0.45, Math.min(3.26, Math.hypot(tgtX, tgtZ)));
            const dy = yWrist - INSERTER_SHOULDER_Y;
            const dist = Math.min(3.28, Math.max(0.35, Math.hypot(rTarget, dy)));
            const l1 = INSERTER_UPPER_ARM_LEN;
            const l2 = INSERTER_FOREARM_LEN;
            const alpha = Math.atan2(dy, rTarget);
            const cosBeta = Math.max(-0.98, Math.min(0.98, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)));
            const beta = Math.acos(cosBeta);
            const phi1 = alpha + beta;

            const sRotX = phi1 - Math.PI * 0.5;
            const endR = l1 * Math.cos(phi1);
            const endY = l1 * Math.sin(phi1);
            const phi2 = Math.atan2(dy - endY, rTarget - endR);

            shoulderPivot.rotation.x = sRotX;
            elbowPivot.rotation.x = phi2 - sRotX;
            wristPivot.rotation.x = -phi2;
          }

          const heldMeshesByShape = group.userData.heldMeshesByShape as
            | Record<CapytorioItemShape, THREE.Mesh>
            | undefined;
          if (heldMeshesByShape) {
            let activeShape: CapytorioItemShape | null = null;
            let activeMat: THREE.MeshStandardMaterial | null = null;
            if (m.holdingItem) {
              const meta = getCapytorioItemMeta(m.holdingItem);
              activeShape = meta.shape ?? resolveCapytorioItemShape(m.holdingItem, meta.category);
              activeMat = this.getCachedHeldItemMat(meta.colorHex);
            }
            for (let sIdx = 0; sIdx < CAPYTORIO_ITEM_SHAPES.length; sIdx++) {
              const sh = CAPYTORIO_ITEM_SHAPES[sIdx];
              const hm = heldMeshesByShape[sh];
              const vis = sh === activeShape;
              hm.visible = vis;
              if (vis && activeMat && hm.material !== activeMat) {
                hm.material = activeMat;
              }
            }
          }
        } else if (m.type === 'furnace' && group.userData.hearthMesh) {
          const hearthMesh = group.userData.hearthMesh as THREE.Mesh;
          const desiredMat =
            m.craftProgress > 0.01 ? this.matFurnaceHearthActive : this.matFurnaceHearthIdle;
          if (hearthMesh.material !== desiredMat) {
            hearthMesh.material = desiredMat;
          }
        }
      }

      // Render rigid 1:1 items riding along straight or concentric curved arc lanes (zero shape distortion)
      if (renderItemsAtScale && m.beltItems.length > 0) {
        for (let bi = 0; bi < m.beltItems.length; bi++) {
          const bItem = m.beltItems[bi];
          const meta = getCapytorioItemMeta(bItem.item);
          const shape = meta.shape ?? resolveCapytorioItemShape(bItem.item, meta.category);
          const idx = _shapeCounts[shape];
          if (idx >= MAX_SHAPE_ITEM_INSTANCES) continue;

          const lane: 0 | 1 = bItem.lane === 1 ? 1 : 0;
          evalBeltItemLocalPose(curveShape, lane, bItem.progress, _itemPoseScratch);
          const edge = bItem.edgeProgress ?? 0;
          const localX = _itemPoseScratch[0];
          const localZ = _itemPoseScratch[1] - edge * 0.42;
          const tangentYaw = _itemPoseScratch[2];

          const worldX = wx + rightDx * localX - fwdDx * localZ;
          const worldZ = wz + rightDz * localX - fwdDz * localZ;
          const worldY = BELT_SURFACE_Y - edge * edge * 0.065;

          _dummy.position.set(worldX, worldY, worldZ);
          _dummy.rotation.order = 'YXZ';
          _dummy.rotation.set(-edge * 0.85, rotY + tangentYaw, 0);
          _dummy.scale.setScalar(subPixelShrink);
          _dummy.updateMatrix();
          const instMesh = this.itemInstancedByShape[shape];
          instMesh.setMatrixAt(idx, _dummy.matrix);
          _color.setHex(meta.colorHex);
          instMesh.setColorAt(idx, _color);
          _shapeCounts[shape] = idx + 1;
        }
      }
    }

    // Render spilled belt-end items tumbling and resting on the Capytorio meadow (rigid uniform scale, 0 extra draw calls)
    if (renderItemsAtScale && engine.spilledItems.length > 0) {
      const maxSpillRadiusM = MAX_VISIBLE_RADIUS_TILES * CAPYTORIO_TILE_SIZE;
      const camLocalX = camX - CAPYTORIO_WORLD_ORIGIN_X;
      const camLocalZ = camZ - CAPYTORIO_WORLD_ORIGIN_Z;
      for (let si = 0; si < engine.spilledItems.length; si++) {
        const sp = engine.spilledItems[si];
        if (
          Math.abs(sp.lx - camLocalX) > maxSpillRadiusM ||
          Math.abs(sp.lz - camLocalZ) > maxSpillRadiusM
        ) {
          continue;
        }
        const meta = getCapytorioItemMeta(sp.item);
        const shape = meta.shape ?? resolveCapytorioItemShape(sp.item, meta.category);
        const idx = _shapeCounts[shape];
        if (idx >= MAX_SHAPE_ITEM_INSTANCES) continue;

        _dummy.position.set(
          CAPYTORIO_WORLD_ORIGIN_X + sp.lx,
          sp.y + 0.015,
          CAPYTORIO_WORLD_ORIGIN_Z + sp.lz
        );
        _dummy.rotation.order = 'YXZ';
        _dummy.rotation.set(sp.rx, sp.ry, sp.rz);
        _dummy.scale.setScalar(subPixelShrink);
        _dummy.updateMatrix();
        const instMesh = this.itemInstancedByShape[shape];
        instMesh.setMatrixAt(idx, _dummy.matrix);
        _color.setHex(meta.colorHex);
        instMesh.setColorAt(idx, _color);
        _shapeCounts[shape] = idx + 1;
      }
    }

    // Release out-of-range or demolished composite machine groups back to pool
    for (const [k, group] of this.activeMachineGroups) {
      if (!_activeKeysScratch.has(k)) {
        this.releaseMachineGroup(group.userData.machineType as CapytorioMachineType, group);
        this.activeMachineGroups.delete(k);
      }
    }

    this.beltChassisInstanced.count = beltChassisCount;
    this.beltChassisInstanced.instanceMatrix.needsUpdate = true;
    this.beltRailSideInstanced.count = beltRailSideCount;
    this.beltRailSideInstanced.instanceMatrix.needsUpdate = true;
    if (this.beltRailSideInstanced.instanceColor) {
      this.beltRailSideInstanced.instanceColor.needsUpdate = true;
    }
    this.beltSideBridgeInstanced.count = beltSideBridgeCount;
    this.beltSideBridgeInstanced.instanceMatrix.needsUpdate = true;

    this.beltChassisCurveLeftInstanced.count = beltCurvedLeftCount;
    this.beltChassisCurveLeftInstanced.instanceMatrix.needsUpdate = true;
    this.beltChassisCurveRightInstanced.count = beltCurvedRightCount;
    this.beltChassisCurveRightInstanced.instanceMatrix.needsUpdate = true;
    this.beltRailCurveLeftInstanced.count = beltCurvedLeftCount;
    this.beltRailCurveLeftInstanced.instanceMatrix.needsUpdate = true;
    if (this.beltRailCurveLeftInstanced.instanceColor) {
      this.beltRailCurveLeftInstanced.instanceColor.needsUpdate = true;
    }
    this.beltRailCurveRightInstanced.count = beltCurvedRightCount;
    this.beltRailCurveRightInstanced.instanceMatrix.needsUpdate = true;
    if (this.beltRailCurveRightInstanced.instanceColor) {
      this.beltRailCurveRightInstanced.instanceColor.needsUpdate = true;
    }

    for (let t = 0; t < 3; t++) {
      const dm = this.beltDeckInstancedByTier[t];
      dm.count = _beltTierCounts[t];
      dm.instanceMatrix.needsUpdate = true;

      const clm = this.beltDeckCurveLeftByTier[t];
      clm.count = _curvedLeftTierCounts[t];
      clm.instanceMatrix.needsUpdate = true;

      const crm = this.beltDeckCurveRightByTier[t];
      crm.count = _curvedRightTierCounts[t];
      crm.instanceMatrix.needsUpdate = true;
    }

    for (let sIdx = 0; sIdx < CAPYTORIO_ITEM_SHAPES.length; sIdx++) {
      const shape = CAPYTORIO_ITEM_SHAPES[sIdx];
      const inst = this.itemInstancedByShape[shape];
      inst.count = _shapeCounts[shape];
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }

    // 4. Update Cursor Hover Tile & Directional Ghost Preview
    const showCursorAndRing = altitudeRadius <= 650;
    this.cursorGroup.visible = showCursorAndRing;
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
      const resolvedGhost = resolveCapytorioPlaceableSpec(engine.selectedTool);
      const validDrill =
        resolvedGhost?.baseType !== 'drill' ||
        engine.getResourceAt(engine.hoveredGx, engine.hoveredGz) !== null;
      this.cursorFrameMat.color.setHex(validDrill ? 0x22c55e : 0xef4444);
      this.cursorFrameMat.emissive.setHex(validDrill ? 0x16a34a : 0xb91c1c);
      this.ghostArrowMesh.visible = true;
    }

    // 5. Universal Inspected Tile / Entity Selection Halo
    if (showCursorAndRing) {
      let inspGx: number | null = null;
      let inspGz: number | null = null;
      if (engine.inspectedTile) {
        inspGx = engine.inspectedTile.gx;
        inspGz = engine.inspectedTile.gz;
      } else if (engine.inspectedKey) {
        const insp = engine.machines.get(engine.inspectedKey);
        if (insp) {
          inspGx = insp.gx;
          inspGz = insp.gz;
        }
      }
      if (inspGx !== null && inspGz !== null) {
        this.inspectRingMesh.visible = true;
        this.inspectRingMesh.position.set(
          capytorioGridToWorldX(inspGx),
          0.05,
          capytorioGridToWorldZ(inspGz)
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
    for (let i = 0; i < this.sharedTextures.length; i++) {
      this.sharedTextures[i].dispose();
    }
    this.activeMachineGroups.clear();
    this.inactivePoolByType.clear();
    this.machineGeoCache.clear();
    this.accentMatCache.clear();
    this.heldItemMatCache.clear();
  }
}
