import * as THREE from 'three';
import {
  CAPYTORIO_CHEST_SLOTS,
  CAPYTORIO_ITEM_SHAPES,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_TILE_SIZE,
  CAPYTORIO_WORLD_ORIGIN_X,
  CAPYTORIO_WORLD_ORIGIN_Z,
  RECIPE_BY_ID,
  getCapytorioInserterReach,
  getCapytorioItemMeta,
  getCapytorioSmeltSpec,
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
  capytorioMachineCenterWorldX,
  capytorioMachineCenterWorldZ,
  evalBeltItemLocalPose,
  getBeltCurveShape,
  getCapytorioPlacementAnchor,
  getCapytorioToolFootprint,
  resolveCapytorioPlaceableSpec,
  sampleCapytorioTerrainDetail,
  tileKey,
  type CapytorioBlueprintEntry,
  type CapytorioMachine,
  type CapytorioTerrainSample,
} from './CapytorioFactoryEngine';
import {
  DEDICATED_CAPYTORIO_VARIANT_MODELS,
  buildDedicatedVariantModel,
  variantSkipsDefaultPlinth,
  type CapytorioVariantMaterials,
} from './capytorio/CapytorioVariantModels';

const TERRAIN_DECK_SEGS = 64;
const TERRAIN_DECK_BASE_TILES = 128;
const TERRAIN_DECK_TILES_PER_SEG = TERRAIN_DECK_BASE_TILES / TERRAIN_DECK_SEGS; // 2 tiles/seg -> 4x faster rebuilds
const TERRAIN_DECK_BASE_SIZE = TERRAIN_DECK_BASE_TILES * CAPYTORIO_TILE_SIZE; // 320m at lodStep = 1 (preserved!)
const WATER_SURFACE_Y = -0.20;
const _terrainSampleScratch: CapytorioTerrainSample = {
  type: 'grass',
  isWater: false,
  elevationY: -0.02,
  waterDepth: 0,
  sandBlend: 0,
};

const MAX_ORE_INSTANCES = 1024;
const MAX_BELT_INSTANCES = 1400;
const MAX_CURVED_BELT_INSTANCES = 600;
const MAX_SHAPE_ITEM_INSTANCES = 2048;
const MAX_TREE_INSTANCES = 512;
const MAX_BLUEPRINT_GHOST_TILES = 256;
const MAX_ALT_MODE_SPRITES = 256;
const MAX_VISIBLE_RADIUS_TILES = 22;
const BELT_SURFACE_Y = 0.145;
const INSERTER_UPPER_ARM_LEN = 1.65;
const INSERTER_FOREARM_LEN = 1.70;
const INSERTER_SHOULDER_Y = 0.60;
const LONG_INSERTER_REACH_SCALE = 1.66;

// Module-scoped zero-allocation math helpers
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _activeKeysScratch = new Set<string>();
const _blueprintStockScratch = new Map<string, number>();
const _ghostBeltLookup = new Map<string, CapytorioBlueprintEntry>();
const _ghostUsedCountsByKey = new Map<string, number>();
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
  battery: 0,
  ammo: 0,
  grenade: 0,
  armor: 0,
  engine: 0,
  barrel: 0,
  brick: 0,
  module: 0,
};

const _scaleScratch: [number, number, number] = [1, 1, 1];
const _altBadgeScratch = {
  key: '',
  label: '',
  sub: '',
  accent: '#38bdf8',
  warn: false,
};

function resolveMachineMeshKey(type: CapytorioMachineType, variantItemId?: string): string {
  if (variantItemId && DEDICATED_CAPYTORIO_VARIANT_MODELS.has(variantItemId)) {
    return variantItemId;
  }
  return type;
}

function resolveMachineVisualScale(
  type: CapytorioMachineType,
  variantItemId: string | undefined,
  width: number,
  height: number,
  out: [number, number, number]
): void {
  if (
    type === 'splitter' ||
    variantItemId === 'locomotive' ||
    variantItemId === 'cargo_wagon'
  ) {
    // Splitter, locomotive, and cargo wagon meshes are constructed natively at 2x1 local proportions
    out[0] = 1.0;
    out[1] = 1.0;
    out[2] = 1.0;
    return;
  }
  const span = Math.max(width, height);
  if (span >= 3) {
    out[0] = 2.86;
    out[1] = 1.72;
    out[2] = 2.86;
  } else if (span === 2) {
    out[0] = 1.92;
    out[1] = 1.44;
    out[2] = 1.92;
  } else {
    out[0] = 1.0;
    out[1] = 1.0;
    out[2] = 1.0;
  }
}

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

/**
 * Procedural beveled toothed spur gear lying flat around the Y axis (centered at y = 0).
 */
function createSpurGearGeometry(
  teeth: number,
  outerR: number,
  rootR: number,
  holeR: number,
  depth: number
): THREE.BufferGeometry {
  const step = (Math.PI * 2) / teeth;
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.2;
    const a2 = a0 + step * 0.32;
    const a3 = a0 + step * 0.68;
    const a4 = a0 + step * 0.8;
    if (i === 0) s.moveTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);
    else s.lineTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);
    s.lineTo(Math.cos(a1) * rootR, Math.sin(a1) * rootR);
    s.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
    s.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
    s.lineTo(Math.cos(a4) * rootR, Math.sin(a4) * rootR);
  }
  s.closePath();
  if (holeR > 0.01) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    s.holes.push(hole);
  }
  const gearBody = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.02, depth * 0.16),
    bevelSize: Math.min(0.016, (outerR - rootR) * 0.16),
    bevelSegments: 1,
  });
  gearBody.rotateX(Math.PI * 0.5);
  gearBody.translate(0, depth * 0.5, 0);

  const hub = new THREE.CylinderGeometry(
    Math.max(holeR + 0.05, rootR * 0.42),
    Math.max(holeR + 0.06, rootR * 0.48),
    depth * 1.45,
    10
  );
  return mergeSimpleIndexedGeometries([gearBody, hub]);
}

/**
 * Chamfered industrial hull block standing upright along Y, centered at (0, 0, 0).
 */
function createChamferedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  chamfer: number
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const c = Math.min(chamfer, hw * 0.45, hd * 0.45);
  const s = new THREE.Shape();
  s.moveTo(-hw + c, -hd);
  s.lineTo(hw - c, -hd);
  s.lineTo(hw, -hd + c);
  s.lineTo(hw, hd - c);
  s.lineTo(hw - c, hd);
  s.lineTo(-hw + c, hd);
  s.lineTo(-hw, hd - c);
  s.lineTo(-hw, -hd + c);
  s.closePath();
  const bevel = Math.min(0.035, height * 0.12, c * 0.6);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.04, height - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
  });
  geo.rotateX(Math.PI * 0.5);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) * 0.5;
    geo.translate(0, -cy, 0);
  }
  return geo;
}

function createBrushedSteelTexture(
  baseHex: string,
  streakHex: string,
  seamHex: string
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Directional brushed metal streaks
  ctx.fillStyle = streakHex;
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 256;
    const y = (i * 197 + (i % 7) * 11) % 256;
    const w = 18 + ((i * 29) % 52);
    ctx.globalAlpha = 0.08 + ((i % 5) * 0.025);
    ctx.fillRect(x, y, w, 1.5);
  }
  ctx.globalAlpha = 1;

  // Riveted industrial steel plate seam grid (2x2 plates per tile)
  ctx.strokeStyle = seamHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();

  // Subtle corner rivet bolts inside each panel
  const panels = [
    [0, 0],
    [128, 0],
    [0, 128],
    [128, 128],
  ];
  for (let p = 0; p < panels.length; p++) {
    const [px, py] = panels[p];
    const pts = [
      [px + 12, py + 12],
      [px + 116, py + 12],
      [px + 12, py + 116],
      [px + 116, py + 116],
    ];
    for (let r = 0; r < pts.length; r++) {
      ctx.fillStyle = seamHex;
      ctx.beginPath();
      ctx.arc(pts[r][0], pts[r][1], 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = streakHex;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(pts[r][0] - 0.8, pts[r][1] - 0.8, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function createIndustrialPlateBumpTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#848484';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle brushed metal micro-grain
  for (let i = 0; i < 360; i++) {
    const x = (i * 89) % 256;
    const y = (i * 151) % 256;
    const v = 114 + ((i * 23) % 34);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 22 + (i % 34), 1);
  }

  // Recessed plate seams
  ctx.strokeStyle = '#383838';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 253, 253);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();

  // Raised rivet bumps
  const panels = [
    [0, 0],
    [128, 0],
    [0, 128],
    [128, 128],
  ];
  ctx.fillStyle = '#d4d4d4';
  for (let p = 0; p < panels.length; p++) {
    const [px, py] = panels[p];
    const pts = [
      [px + 12, py + 12],
      [px + 116, py + 12],
      [px + 12, py + 116],
      [px + 116, py + 116],
    ];
    for (let r = 0; r < pts.length; r++) {
      ctx.beginPath();
      ctx.arc(pts[r][0], pts[r][1], 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createHazardStripeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 256, 256);

  // Bold 45-degree black industrial warning stripes
  ctx.fillStyle = '#1e293b';
  const stripeW = 32;
  for (let offset = -256; offset < 512; offset += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + stripeW, 0);
    ctx.lineTo(offset + stripeW - 256, 256);
    ctx.lineTo(offset - 256, 256);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle industrial wear speckles
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 160; i++) {
    ctx.fillRect((i * 53) % 256, (i * 97) % 256, 3, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5);
  tex.anisotropy = 4;
  return tex;
}

function createKilnBrickTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Dark mortar base
  ctx.fillStyle = '#292524';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 4;
  const rowH = 256 / rows;
  const colW = 256 / cols;
  const brickTones = ['#6b5c52', '#78665a', '#5e524b', '#826b5c', '#63564e'];

  for (let r = 0; r < rows; r++) {
    const xShift = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + xShift;
      const by = r * rowH;
      const tone = brickTones[(r * 7 + c * 3 + 12) % brickTones.length];
      ctx.fillStyle = tone;
      ctx.fillRect(bx + 2.5, by + 2.5, colW - 5, rowH - 5);
      // Warm kiln-fired top highlight
      ctx.fillStyle = 'rgba(255, 224, 190, 0.10)';
      ctx.fillRect(bx + 3, by + 3, colW - 6, 4);
      // Soot shading along lower edge
      ctx.fillStyle = 'rgba(18, 14, 12, 0.18)';
      ctx.fillRect(bx + 3, by + rowH - 7, colW - 6, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  return tex;
}

function createKilnBrickBumpTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Recessed mortar joints
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 4;
  const rowH = 256 / rows;
  const colW = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const xShift = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + xShift;
      const by = r * rowH;
      const shade = 188 + ((r * 13 + c * 17 + 40) % 36);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(bx + 3, by + 3, colW - 6, rowH - 6);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
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
    const main = new THREE.DodecahedronGeometry(0.24, 0);
    main.scale(1.08, 0.86, 1.0);
    main.translate(-0.04, 0.18, 0.02);
    const shardA = new THREE.DodecahedronGeometry(0.165, 0);
    shardA.scale(0.95, 1.15, 0.9);
    shardA.rotateZ(-0.35);
    shardA.translate(0.15, 0.14, -0.09);
    const shardB = new THREE.DodecahedronGeometry(0.145, 0);
    shardB.scale(1.05, 0.78, 0.95);
    shardB.rotateX(0.28);
    shardB.translate(-0.08, 0.11, -0.15);
    return groundGeometryBottomAtZero(mergeSimpleIndexedGeometries([main, shardA, shardB]));
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
    const board = new THREE.ExtrudeGeometry(s, {
      depth: 0.065,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 1,
    });
    board.rotateX(Math.PI * 0.5);
    board.translate(0, 0.065, 0);
    const icChip = new THREE.BoxGeometry(0.24, 0.07, 0.22);
    icChip.translate(-0.04, 0.095, 0.01);
    const cap = new THREE.CylinderGeometry(0.055, 0.055, 0.08, 8);
    cap.translate(0.17, 0.1, -0.09);
    return groundGeometryBottomAtZero(mergeSimpleIndexedGeometries([board, icChip, cap]));
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
  if (shape === 'battery') {
    const cell = createChamferedBoxGeometry(0.42, 0.34, 0.61, 0.045);
    cell.translate(0, 0.17, 0);
    const collar = new THREE.BoxGeometry(0.38, 0.05, 0.54);
    collar.translate(0, 0.35, 0);
    const termA = new THREE.CylinderGeometry(0.065, 0.072, 0.1, 8);
    termA.translate(0, 0.41, -0.15);
    const termB = new THREE.CylinderGeometry(0.065, 0.072, 0.1, 8);
    termB.translate(0, 0.41, 0.15);
    return groundGeometryBottomAtZero(mergeSimpleIndexedGeometries([cell, collar, termA, termB]));
  }
  if (shape === 'ammo') {
    const mag = createChamferedBoxGeometry(0.36, 0.17, 0.61, 0.035);
    mag.translate(0, 0.09, 0);
    const ribA = new THREE.BoxGeometry(0.39, 0.05, 0.09);
    ribA.translate(0, 0.12, -0.16);
    const ribB = new THREE.BoxGeometry(0.39, 0.05, 0.09);
    ribB.translate(0, 0.12, 0.16);
    const tipA = new THREE.ConeGeometry(0.052, 0.14, 6);
    tipA.rotateX(-Math.PI * 0.5);
    tipA.translate(-0.08, 0.16, -0.24);
    const tipB = new THREE.ConeGeometry(0.052, 0.14, 6);
    tipB.rotateX(-Math.PI * 0.5);
    tipB.translate(0.08, 0.16, -0.24);
    return groundGeometryBottomAtZero(mergeSimpleIndexedGeometries([mag, ribA, ribB, tipA, tipB]));
  }
  if (shape === 'grenade') {
    const body = new THREE.IcosahedronGeometry(0.255, 0);
    body.scale(0.98, 0.96, 1.06);
    body.translate(0, 0.24, -0.02);
    const neck = new THREE.CylinderGeometry(0.095, 0.115, 0.11, 8);
    neck.translate(0, 0.49, -0.02);
    const lever = new THREE.BoxGeometry(0.075, 0.24, 0.14);
    lever.rotateX(0.32);
    lever.translate(0, 0.44, 0.19);
    const ring = new THREE.TorusGeometry(0.075, 0.022, 6, 10);
    ring.translate(0.11, 0.51, -0.02);
    return groundGeometryBottomAtZero(mergeSimpleIndexedGeometries([body, neck, lever, ring]));
  }
  if (shape === 'armor') {
    const torso = createChamferedBoxGeometry(0.46, 0.20, 0.61, 0.05);
    torso.translate(0, 0.11, 0);
    const pauldronL = createChamferedBoxGeometry(0.18, 0.17, 0.26, 0.04);
    pauldronL.translate(-0.26, 0.15, -0.13);
    const pauldronR = createChamferedBoxGeometry(0.18, 0.17, 0.26, 0.04);
    pauldronR.translate(0.26, 0.15, -0.13);
    const chestPlate = createChamferedBoxGeometry(0.32, 0.08, 0.34, 0.025);
    chestPlate.translate(0, 0.22, -0.04);
    return groundGeometryBottomAtZero(
      mergeSimpleIndexedGeometries([torso, pauldronL, pauldronR, chestPlate])
    );
  }
  if (shape === 'engine') {
    const block = createChamferedBoxGeometry(0.38, 0.22, 0.61, 0.04);
    block.translate(0, 0.11, 0);
    const bankL = new THREE.BoxGeometry(0.18, 0.16, 0.44);
    bankL.rotateZ(0.42);
    bankL.translate(-0.15, 0.25, -0.02);
    const bankR = new THREE.BoxGeometry(0.18, 0.16, 0.44);
    bankR.rotateZ(-0.42);
    bankR.translate(0.15, 0.25, -0.02);
    const flywheel = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12);
    flywheel.rotateX(Math.PI * 0.5);
    flywheel.translate(0, 0.18, 0.265);
    return groundGeometryBottomAtZero(
      mergeSimpleIndexedGeometries([block, bankL, bankR, flywheel])
    );
  }
  if (shape === 'barrel') {
    const drum = new THREE.CylinderGeometry(0.285, 0.285, 0.44, 12);
    drum.translate(0, 0.22, 0);
    const hoopLow = new THREE.TorusGeometry(0.288, 0.022, 6, 14);
    hoopLow.rotateX(Math.PI * 0.5);
    hoopLow.translate(0, 0.13, 0);
    const hoopHigh = new THREE.TorusGeometry(0.288, 0.022, 6, 14);
    hoopHigh.rotateX(Math.PI * 0.5);
    hoopHigh.translate(0, 0.31, 0);
    const bung = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8);
    bung.translate(0.1, 0.45, -0.08);
    return groundGeometryBottomAtZero(
      mergeSimpleIndexedGeometries([drum, hoopLow, hoopHigh, bung])
    );
  }
  if (shape === 'brick') {
    const base = createChamferedBoxGeometry(0.42, 0.17, 0.61, 0.032);
    base.translate(0, 0.085, 0);
    const frogA = new THREE.BoxGeometry(0.26, 0.035, 0.16);
    frogA.translate(0, 0.18, -0.14);
    const frogB = new THREE.BoxGeometry(0.26, 0.035, 0.16);
    frogB.translate(0, 0.18, 0.14);
    return groundGeometryBottomAtZero(mergeSimpleIndexedGeometries([base, frogA, frogB]));
  }
  if (shape === 'module') {
    const body = createChamferedBoxGeometry(0.44, 0.14, 0.61, 0.035);
    body.translate(0, 0.07, 0);
    const core = createChamferedBoxGeometry(0.24, 0.09, 0.30, 0.02);
    core.translate(0, 0.16, 0.03);
    const pinBar = new THREE.BoxGeometry(0.32, 0.06, 0.09);
    pinBar.translate(0, 0.06, -0.26);
    const finL = new THREE.BoxGeometry(0.06, 0.08, 0.42);
    finL.translate(-0.18, 0.15, 0.02);
    const finR = new THREE.BoxGeometry(0.06, 0.08, 0.42);
    finR.translate(0.18, 0.15, 0.02);
    return groundGeometryBottomAtZero(
      mergeSimpleIndexedGeometries([body, core, pinBar, finL, finR])
    );
  }
  // 'crate' (reserved for packaged placeable buildings/structures)
  const c = 0.28;
  const body = createChamferedBoxGeometry(c * 2, 0.28, c * 2, 0.045);
  body.translate(0, 0.16, 0);
  const lid = new THREE.BoxGeometry(c * 2.08, 0.06, c * 2.08);
  lid.translate(0, 0.31, 0);
  return groundGeometryBottomAtZero(mergeSimpleIndexedGeometries([body, lid]));
}

function createLushMeadowGrassTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Neutral-bright organic surface grain multiplied cleanly by per-vertex biome colors
  // (preserves true emerald meadow, sunlit golden sand, turquoise shallows, and deep ocean hues)
  ctx.fillStyle = '#e8ece6';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle natural turf / sand micro-grain dapples
  for (let i = 0; i < 3000; i++) {
    const x = (i * 197 + (i % 7) * 13) % 512;
    const y = (i * 331 + (i % 5) * 19) % 512;
    if (i % 9 === 0) {
      ctx.fillStyle = '#cfd6cc';
      ctx.fillRect(x, y, 5, 4);
    } else {
      const v = 212 + ((i * 37) % 38);
      ctx.fillStyle = `rgb(${v - 2},${v + 2},${v - 4})`;
      ctx.fillRect(x, y, 2, 4);
    }
  }

  // Crisp subtle Factorio tile grid alignment border (clean building placement clarity on land)
  ctx.strokeStyle = 'rgba(20, 32, 18, 0.16)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 509, 509);

  // Subtle corner surveyor ticks
  ctx.fillStyle = 'rgba(20, 36, 18, 0.26)';
  ctx.fillRect(0, 0, 14, 3);
  ctx.fillRect(0, 0, 3, 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(TERRAIN_DECK_BASE_TILES, TERRAIN_DECK_BASE_TILES);
  tex.offset.set(0.5, 0.5);
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
  tex.repeat.set(TERRAIN_DECK_BASE_TILES, TERRAIN_DECK_BASE_TILES);
  tex.offset.set(0.5, 0.5);
  return tex;
}

function createWaterRippleTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#c8ecfa';
  ctx.fillRect(0, 0, 256, 256);

  // Seamless periodic multi-directional water ripples & subtle sunlit caustics (neutral-bright so vertexColors tint cleanly)
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const u = (x / 256) * Math.PI * 2;
      const v = (y / 256) * Math.PI * 2;
      const w1 = Math.sin(u * 4 + Math.cos(v * 3) * 1.1);
      const w2 = Math.cos(v * 5 + Math.sin(u * 3 - v * 2) * 0.9);
      const w3 = Math.sin((u * 6 - v * 5) + Math.sin(u * 2) * 0.7);
      const wave = w1 * 0.4 + w2 * 0.35 + w3 * 0.25;
      const glint = Math.pow(Math.max(0, wave), 2.2);
      const r = Math.min(255, Math.round(182 + wave * 18 + glint * 54));
      const g = Math.min(255, Math.round(218 + wave * 14 + glint * 36));
      const b = Math.min(255, Math.round(234 + wave * 10 + glint * 21));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 36);
  tex.anisotropy = 4;
  return tex;
}

export class Capytorio3DRenderer {
  public readonly root = new THREE.Group();

  // Endless snapping vertex-colored hydrology terrain mesh & depth-masked animated PBR water mesh
  private groundDeck: THREE.Mesh;
  private groundDeckGeo: THREE.PlaneGeometry;
  private groundEdgeStrip: THREE.Mesh;
  private waterDeck: THREE.Mesh;
  private waterDeckGeo: THREE.PlaneGeometry;
  private waterMaskBuf: Uint8Array;
  private waterMat: THREE.MeshStandardMaterial;
  private waterTex: THREE.CanvasTexture | null = null;
  private deckTex: THREE.CanvasTexture | null = null;
  private deckBumpTex: THREE.CanvasTexture | null = null;
  private lastDeckSnapGx = Number.NaN;
  private lastDeckSnapGz = Number.NaN;
  private lastDeckLodStep = -1;
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

  // Pooled composite machine groups (keyed by variant meshKey so every building variant has its own pool)
  private readonly activeMachineGroups = new Map<string, THREE.Group>();
  private readonly inactivePoolByType = new Map<string, THREE.Group[]>();

  // Pooled transparent 3D blueprint ghost models (zero per-frame allocations)
  private readonly ghostRoot = new THREE.Group();
  private readonly ghostPoolByType = new Map<string, THREE.Group[]>();
  private ghostValidPrimaryMat: THREE.MeshStandardMaterial;
  private ghostValidAccentMat: THREE.MeshStandardMaterial;
  private ghostInvalidPrimaryMat: THREE.MeshStandardMaterial;
  private ghostInvalidAccentMat: THREE.MeshStandardMaterial;
  private ghostBeltDeckValidMat: THREE.MeshStandardMaterial;
  private ghostBeltDeckInvalidMat: THREE.MeshStandardMaterial;

  // Reusable belt geometries shared by instanced belts and 3D ghost belts
  private beltChassisGeo: THREE.BufferGeometry;
  private beltSideRailGeo: THREE.BufferGeometry;
  private beltDeckGeo: THREE.BufferGeometry;
  private curvedChassisLeftGeo: THREE.BufferGeometry;
  private curvedChassisRightGeo: THREE.BufferGeometry;
  private curvedRailLeftGeo: THREE.BufferGeometry;
  private curvedRailRightGeo: THREE.BufferGeometry;
  private curvedDeckLeftGeo: THREE.BufferGeometry;
  private curvedDeckRightGeo: THREE.BufferGeometry;
  private readonly beltHalfSpanX = (CAPYTORIO_TILE_SIZE * 0.88) * 0.5 - 0.055;

  // Cursor, directional build ghost, clipboard blueprint ghost & inspector ring
  private cursorGroup = new THREE.Group();
  private cursorFrameMat: THREE.MeshStandardMaterial;
  private ghostArrowMesh: THREE.Mesh;
  private ghostBodyMesh: THREE.Mesh;
  private inspectRingMesh: THREE.Mesh;
  private bpTileMat: THREE.MeshBasicMaterial;
  private blueprintTileInstanced: THREE.InstancedMesh;
  private lastBlueprintTileCount = 0;

  // Pooled 3D Alt-Mode sprite badges (zero per-frame allocations)
  private readonly altModeRoot = new THREE.Group();
  private readonly altModeSpritePool: THREE.Sprite[] = [];
  private readonly altModeMatCache = new Map<string, THREE.SpriteMaterial>();
  private readonly altModeTexCache = new Map<string, THREE.CanvasTexture>();
  private readonly altModePlaceholderMat: THREE.SpriteMaterial;

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
  private matDarkVoid: THREE.MeshStandardMaterial;
  private matStatusLampIdle: THREE.MeshStandardMaterial;
  private matStatusLampOn: THREE.MeshStandardMaterial;
  private matFurnaceHearthIdle: THREE.MeshStandardMaterial;
  private matFurnaceHearthActive: THREE.MeshStandardMaterial;
  private matGeneratorFireboxIdle: THREE.MeshStandardMaterial;
  private matGeneratorFireboxActive: THREE.MeshStandardMaterial;
  private matLabCoreIdle: THREE.MeshStandardMaterial;
  private matLabCoreActive: THREE.MeshStandardMaterial;
  private matTimber: THREE.MeshStandardMaterial;
  private matCeramicWhite: THREE.MeshStandardMaterial;
  private matSolarBlue: THREE.MeshStandardMaterial;
  private matCyanGlow: THREE.MeshStandardMaterial;
  private matEmeraldGlow: THREE.MeshStandardMaterial;
  private matRubyGlow: THREE.MeshStandardMaterial;
  private matConcrete: THREE.MeshStandardMaterial;
  private readonly variantMats: CapytorioVariantMaterials;
  private industrialPlateBumpTex: THREE.CanvasTexture | null = null;
  private beaconOrb: THREE.Object3D | null = null;
  private beaconDishRing: THREE.Object3D | null = null;

  private lastBeltScrollPhase = 0;
  // Static ore & tree terrain InstancedMesh dirty-cache (skips 3200+ tile scans/uploads per frame)
  private lastTerrainCenterGx = Number.NaN;
  private lastTerrainCenterGz = Number.NaN;
  private lastTerrainRadius = -1;
  private lastTerrainTopoRev = -1;
  private lastTerrainSubPixel = -1;
  // Static belt/rail InstancedMesh dirty-cache (skips redundant matrix rebuilds & GPU buffer uploads)
  private lastBeltTopoRev = -1;
  private lastBeltCamX = Number.NaN;
  private lastBeltCamZ = Number.NaN;
  private lastBeltVisibleMeters = -1;
  private lastBeltSubPixel = -1;

  constructor() {
    this.root.name = 'Capytorio3DRendererRoot';
    this.root.userData.ignoreCameraFade = true;

    // Procedural industrial PBR canvas maps (SSR/Node-safe)
    const steelDarkTex = createBrushedSteelTexture('#334155', '#64748b', '#1e293b');
    const steelLightTex = createBrushedSteelTexture('#94a3b8', '#e2e8f0', '#475569');
    const plateBumpTex = createIndustrialPlateBumpTexture();
    const hazardTex = createHazardStripeTexture();
    const brickTex = createKilnBrickTexture();
    const brickBumpTex = createKilnBrickBumpTexture();
    this.industrialPlateBumpTex = plateBumpTex;
    if (steelDarkTex) this.sharedTextures.push(steelDarkTex);
    if (steelLightTex) this.sharedTextures.push(steelLightTex);
    if (plateBumpTex) this.sharedTextures.push(plateBumpTex);
    if (hazardTex) this.sharedTextures.push(hazardTex);
    if (brickTex) this.sharedTextures.push(brickTex);
    if (brickBumpTex) this.sharedTextures.push(brickBumpTex);

    // Shared calibrated PBR materials (roughness/metalness deltas >= 0.25 between parts)
    this.matSteelDark = new THREE.MeshStandardMaterial({
      color: steelDarkTex ? 0xffffff : 0x334155,
      map: steelDarkTex ?? null,
      bumpMap: plateBumpTex ?? null,
      bumpScale: 0.025,
      roughness: 0.68,
      metalness: 0.58,
    });
    this.matSteelLight = new THREE.MeshStandardMaterial({
      color: steelLightTex ? 0xffffff : 0x94a3b8,
      map: steelLightTex ?? null,
      bumpMap: plateBumpTex ?? null,
      bumpScale: 0.02,
      roughness: 0.32,
      metalness: 0.82,
    });
    this.matBrass = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.24,
      metalness: 0.86,
    });
    this.matHazardYellow = new THREE.MeshStandardMaterial({
      color: hazardTex ? 0xffffff : 0xfacc15,
      map: hazardTex ?? null,
      roughness: 0.48,
      metalness: 0.16,
    });
    this.matBrick = new THREE.MeshStandardMaterial({
      color: brickTex ? 0xffffff : 0x6b5c52,
      map: brickTex ?? null,
      bumpMap: brickBumpTex ?? null,
      bumpScale: 0.06,
      roughness: 0.9,
      metalness: 0.06,
    });
    this.matCopper = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.28,
      metalness: 0.84,
    });
    this.matLabGlass = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.36,
      roughness: 0.1,
      metalness: 0.16,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.matDarkVoid = new THREE.MeshStandardMaterial({
      color: 0x0b0f17,
      roughness: 0.96,
      metalness: 0.05,
    });
    this.matStatusLampIdle = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.1,
    });
    this.matStatusLampOn = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x22c55e,
      emissiveIntensity: 1.45,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.matFurnaceHearthIdle = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.45,
      roughness: 0.25,
    });
    this.matFurnaceHearthActive = new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xea580c,
      emissiveIntensity: 1.65,
      roughness: 0.2,
    });
    this.matGeneratorFireboxIdle = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.18,
      roughness: 0.25,
    });
    this.matGeneratorFireboxActive = new THREE.MeshStandardMaterial({
      color: 0xfb923c,
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
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 1.9,
      roughness: 0.16,
    });
    this.matTimber = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.86,
      metalness: 0.04,
    });
    this.matCeramicWhite = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.22,
      metalness: 0.12,
    });
    this.matSolarBlue = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      emissive: 0x0f172a,
      emissiveIntensity: 0.35,
      roughness: 0.14,
      metalness: 0.62,
    });
    this.matCyanGlow = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.35,
      roughness: 0.18,
      metalness: 0.15,
    });
    this.matEmeraldGlow = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 1.65,
      roughness: 0.16,
      metalness: 0.15,
    });
    this.matRubyGlow = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xe11d48,
      emissiveIntensity: 1.6,
      roughness: 0.16,
      metalness: 0.2,
    });
    this.matConcrete = new THREE.MeshStandardMaterial({
      color: 0x7c8594,
      bumpMap: plateBumpTex ?? null,
      bumpScale: 0.03,
      roughness: 0.9,
      metalness: 0.06,
    });
    this.variantMats = {
      steelDark: this.matSteelDark,
      steelLight: this.matSteelLight,
      brass: this.matBrass,
      hazardYellow: this.matHazardYellow,
      brick: this.matBrick,
      copper: this.matCopper,
      labGlass: this.matLabGlass,
      darkVoid: this.matDarkVoid,
      statusLampIdle: this.matStatusLampIdle,
      statusLampOn: this.matStatusLampOn,
      furnaceHearthIdle: this.matFurnaceHearthIdle,
      timber: this.matTimber,
      ceramicWhite: this.matCeramicWhite,
      solarBlue: this.matSolarBlue,
      cyanGlow: this.matCyanGlow,
      emeraldGlow: this.matEmeraldGlow,
      rubyGlow: this.matRubyGlow,
      concrete: this.matConcrete,
    };
    this.sharedMaterials.push(
      this.matSteelDark,
      this.matSteelLight,
      this.matBrass,
      this.matHazardYellow,
      this.matBrick,
      this.matCopper,
      this.matLabGlass,
      this.matDarkVoid,
      this.matStatusLampIdle,
      this.matStatusLampOn,
      this.matFurnaceHearthIdle,
      this.matFurnaceHearthActive,
      this.matGeneratorFireboxIdle,
      this.matGeneratorFireboxActive,
      this.matLabCoreIdle,
      this.matLabCoreActive,
      this.matTimber,
      this.matCeramicWhite,
      this.matSolarBlue,
      this.matCyanGlow,
      this.matEmeraldGlow,
      this.matRubyGlow,
      this.matConcrete
    );

    // 1. Infinite Snapping Recessed-Basin Terrain Deck (Meadow Grass, Sandy Shores, Lakes, Rivers & Oceans)
    // Subdivided 128x128 mesh with pre-allocated vertex colors & elevation updated ONLY on chunk/LOD snap!
    const deckTex = createLushMeadowGrassTexture();
    const bumpTex = createDeckBumpTexture();
    const waterTex = createWaterRippleTexture();
    this.deckTex = deckTex;
    this.deckBumpTex = bumpTex;
    this.waterTex = waterTex;
    if (deckTex) this.sharedTextures.push(deckTex);
    if (bumpTex) this.sharedTextures.push(bumpTex);
    if (waterTex) this.sharedTextures.push(waterTex);

    const deckGeo = new THREE.PlaneGeometry(
      TERRAIN_DECK_BASE_SIZE,
      TERRAIN_DECK_BASE_SIZE,
      TERRAIN_DECK_SEGS,
      TERRAIN_DECK_SEGS
    );
    deckGeo.rotateX(-Math.PI * 0.5);
    const vertCount = deckGeo.attributes.position.count;
    const colorArray = new Float32Array(vertCount * 3);
    for (let i = 0; i < vertCount; i++) {
      colorArray[i * 3] = 0.28;
      colorArray[i * 3 + 1] = 0.52;
      colorArray[i * 3 + 2] = 0.21;
    }
    deckGeo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    this.groundDeckGeo = deckGeo;

    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: deckTex ?? null,
      bumpMap: bumpTex ?? null,
      bumpScale: 0.045,
      roughness: 0.9,
      metalness: 0.02,
      transparent: false,
      opacity: 1.0,
    });
    this.deckMat = deckMat;
    this.groundDeck = new THREE.Mesh(deckGeo, deckMat);
    this.groundDeck.position.set(CAPYTORIO_WORLD_ORIGIN_X, 0, CAPYTORIO_WORLD_ORIGIN_Z);
    this.groundDeck.receiveShadow = true;
    this.groundDeck.userData.ignoreCameraFade = true;
    this.root.add(this.groundDeck);
    this.sharedGeometries.push(deckGeo);
    this.sharedMaterials.push(deckMat);

    // Depth-Masked Shimmering Animated PBR Water Mesh (matching 128x128 grid; dry-land interior drops to -8m
    // so high-altitude zoom-out NEVER suffers depth-buffer bleed over continents!)
    const waterGeo = new THREE.PlaneGeometry(
      TERRAIN_DECK_BASE_SIZE,
      TERRAIN_DECK_BASE_SIZE,
      TERRAIN_DECK_SEGS,
      TERRAIN_DECK_SEGS
    );
    waterGeo.rotateX(-Math.PI * 0.5);
    const waterColorArr = new Float32Array(vertCount * 3);
    for (let i = 0; i < vertCount; i++) {
      waterColorArr[i * 3] = 0.16;
      waterColorArr[i * 3 + 1] = 0.62;
      waterColorArr[i * 3 + 2] = 0.84;
    }
    waterGeo.setAttribute('color', new THREE.BufferAttribute(waterColorArr, 3));
    this.waterDeckGeo = waterGeo;
    this.waterMaskBuf = new Uint8Array(vertCount);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: waterTex ?? null,
      bumpMap: waterTex ?? null,
      bumpScale: 0.025,
      roughness: 0.34,
      metalness: 0.04,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      envMapIntensity: 0.65,
    });
    this.waterMat = waterMat;
    this.waterDeck = new THREE.Mesh(waterGeo, waterMat);
    this.waterDeck.position.set(CAPYTORIO_WORLD_ORIGIN_X, 0, CAPYTORIO_WORLD_ORIGIN_Z);
    this.waterDeck.receiveShadow = true;
    this.waterDeck.renderOrder = 2;
    this.waterDeck.userData.ignoreCameraFade = true;
    this.root.add(this.waterDeck);
    this.sharedGeometries.push(waterGeo);
    this.sharedMaterials.push(waterMat);

    // Populate initial terrain elevation, water mask & biome colors around origin immediately
    this.rebuildTerrainDeckGeometry(0, 0, 1);

    // Legacy straight coast strip kept hidden now that organic procedural ocean shorelines replace it
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
    this.groundEdgeStrip.visible = false;
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

    // Sculpted 3-shard crystalline ore cluster (single merged instanced geo)
    const oreShardMain = new THREE.ConeGeometry(0.28, 0.78, 6);
    oreShardMain.rotateZ(0.14);
    oreShardMain.translate(0, 0.34, 0);
    const oreShardLeft = new THREE.ConeGeometry(0.21, 0.56, 5);
    oreShardLeft.rotateZ(0.42);
    oreShardLeft.rotateY(0.6);
    oreShardLeft.translate(-0.24, 0.22, 0.12);
    const oreShardRight = new THREE.ConeGeometry(0.19, 0.48, 5);
    oreShardRight.rotateZ(-0.38);
    oreShardRight.rotateX(0.32);
    oreShardRight.translate(0.22, 0.19, -0.14);
    const oreCrystalGeo = groundGeometryBottomAtZero(
      mergeSimpleIndexedGeometries([oreShardMain, oreShardLeft, oreShardRight])
    );
    const oreCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.58,
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
    this.beltChassisGeo = beltChassisGeo;
    this.beltSideRailGeo = beltSideRailGeo;
    this.beltDeckGeo = beltDeckGeo;
    this.curvedChassisLeftGeo = curvedChassisLeftGeo;
    this.curvedChassisRightGeo = curvedChassisRightGeo;
    this.curvedRailLeftGeo = curvedRailLeftGeo;
    this.curvedRailRightGeo = curvedRailRightGeo;
    this.curvedDeckLeftGeo = curvedDeckLeftGeo;
    this.curvedDeckRightGeo = curvedDeckRightGeo;
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

    // 4. Instanced Moving Items (16 distinct 3D shape archetypes with Factorio contrast colors)
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
      battery: { roughness: 0.26, metalness: 0.64 },
      ammo: { roughness: 0.28, metalness: 0.82 },
      grenade: { roughness: 0.56, metalness: 0.48 },
      armor: { roughness: 0.34, metalness: 0.72 },
      engine: { roughness: 0.32, metalness: 0.78 },
      barrel: { roughness: 0.38, metalness: 0.62 },
      brick: { roughness: 0.88, metalness: 0.08 },
      module: { roughness: 0.24, metalness: 0.42 },
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

    // 4B. Instanced Tropical Citrus Trees (Flared Lathe trunk + multi-lobed organic crown + ripe oranges)
    const trunkProfile = [
      new THREE.Vector2(0.36, 0.0),
      new THREE.Vector2(0.27, 0.24),
      new THREE.Vector2(0.22, 0.72),
      new THREE.Vector2(0.18, 1.24),
      new THREE.Vector2(0.24, 1.48),
      new THREE.Vector2(0.01, 1.52),
    ];
    const trunkGeo = new THREE.LatheGeometry(trunkProfile, 8);
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

    const lobeCenter = new THREE.DodecahedronGeometry(0.86, 1);
    lobeCenter.scale(1.04, 0.88, 1.04);
    lobeCenter.translate(0, 0.16, 0);
    const lobeA = new THREE.DodecahedronGeometry(0.64, 1);
    lobeA.translate(0.46, -0.1, 0.22);
    const lobeB = new THREE.DodecahedronGeometry(0.62, 1);
    lobeB.translate(-0.44, -0.12, 0.24);
    const lobeC = new THREE.DodecahedronGeometry(0.6, 1);
    lobeC.translate(0.02, -0.08, -0.46);
    const canopyGeo = mergeSimpleIndexedGeometries([lobeCenter, lobeA, lobeB, lobeC]);
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

    // 6. Pooled Cut/Copy Selection Highlight & Multi-Building 3D Transparent Ghost Items
    const bpTileGeo = new THREE.BoxGeometry(
      CAPYTORIO_TILE_SIZE * 0.94,
      0.06,
      CAPYTORIO_TILE_SIZE * 0.94
    );
    const bpTileMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.bpTileMat = bpTileMat;
    this.blueprintTileInstanced = new THREE.InstancedMesh(
      bpTileGeo,
      bpTileMat,
      MAX_BLUEPRINT_GHOST_TILES
    );
    this.blueprintTileInstanced.frustumCulled = false;
    this.blueprintTileInstanced.count = 0;
    this.blueprintTileInstanced.userData.ignoreCameraFade = true;
    this.root.add(this.blueprintTileInstanced);

    this.altModePlaceholderMat = new THREE.SpriteMaterial({
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    this.altModePlaceholderMat.userData.sharedAsset = true;

    // Translucent 3D holographic ghost materials for blueprint placement preview
    this.ghostValidPrimaryMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.48,
      roughness: 0.34,
      metalness: 0.22,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    this.ghostValidAccentMat = new THREE.MeshStandardMaterial({
      color: 0x86efac,
      emissive: 0x22c55e,
      emissiveIntensity: 0.68,
      roughness: 0.26,
      metalness: 0.16,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
    });
    this.ghostInvalidPrimaryMat = new THREE.MeshStandardMaterial({
      color: 0xf87171,
      emissive: 0xdc2626,
      emissiveIntensity: 0.5,
      roughness: 0.34,
      metalness: 0.22,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    this.ghostInvalidAccentMat = new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      emissive: 0xef4444,
      emissiveIntensity: 0.72,
      roughness: 0.26,
      metalness: 0.16,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
    });
    this.ghostBeltDeckValidMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      map: this.beltTrackTextures[0] ?? null,
      roughness: 0.38,
      metalness: 0.15,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
    });
    this.ghostBeltDeckInvalidMat = new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      emissive: 0xdc2626,
      emissiveIntensity: 0.5,
      map: this.beltTrackTextures[0] ?? null,
      roughness: 0.38,
      metalness: 0.15,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
    });
    this.ghostRoot.name = 'CapytorioBlueprintGhostRoot';
    this.ghostRoot.userData.ignoreCameraFade = true;
    this.root.add(this.ghostRoot);

    this.altModeRoot.name = 'CapytorioAltModeRoot';
    this.altModeRoot.userData.ignoreCameraFade = true;
    this.root.add(this.altModeRoot);

    this.sharedGeometries.push(ghostPlateGeo, arrowGeo, ringGeo, bpTileGeo);
    this.sharedMaterials.push(
      this.cursorFrameMat,
      ringMat,
      bpTileMat,
      this.altModePlaceholderMat,
      this.ghostValidPrimaryMat,
      this.ghostValidAccentMat,
      this.ghostInvalidPrimaryMat,
      this.ghostInvalidAccentMat,
      this.ghostBeltDeckValidMat,
      this.ghostBeltDeckInvalidMat
    );
  }

  private getOrCreateAltModeSprite(idx: number): THREE.Sprite {
    while (this.altModeSpritePool.length <= idx) {
      const sprite = new THREE.Sprite(this.altModePlaceholderMat);
      sprite.visible = false;
      sprite.renderOrder = 12;
      sprite.userData.ignoreCameraFade = true;
      this.altModeRoot.add(sprite);
      this.altModeSpritePool.push(sprite);
    }
    return this.altModeSpritePool[idx];
  }

  private getAltModeMaterial(
    key: string,
    label: string,
    sub: string,
    accentCss: string,
    isWarn: boolean
  ): THREE.SpriteMaterial {
    const existing = this.altModeMatCache.get(key);
    if (existing) {
      // Refresh LRU recency on hit
      this.altModeMatCache.delete(key);
      this.altModeMatCache.set(key, existing);
      return existing;
    }

    // Enforce 128-entry LRU eviction cap so badge textures/materials never grow unbounded
    while (this.altModeMatCache.size >= 128) {
      const oldestKey = this.altModeMatCache.keys().next().value;
      if (oldestKey === undefined) break;
      const evictedMat = this.altModeMatCache.get(oldestKey);
      this.altModeMatCache.delete(oldestKey);
      if (evictedMat) {
        for (let i = 0; i < this.altModeSpritePool.length; i++) {
          const sp = this.altModeSpritePool[i];
          if (sp.material === evictedMat) {
            sp.material = this.altModePlaceholderMat;
            sp.visible = false;
          }
        }
        evictedMat.dispose();
      }
      const evictedTex = this.altModeTexCache.get(oldestKey);
      if (evictedTex) {
        this.altModeTexCache.delete(oldestKey);
        evictedTex.dispose();
      }
    }

    let tex: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 160, 160);
        // Dark crisp chamfered Factorio industrial plate
        const pad = 10;
        const w = 140;
        const h = 140;
        const r = 18;
        ctx.beginPath();
        ctx.moveTo(pad + r, pad);
        ctx.lineTo(pad + w - r, pad);
        ctx.quadraticCurveTo(pad + w, pad, pad + w, pad + r);
        ctx.lineTo(pad + w, pad + h - r);
        ctx.quadraticCurveTo(pad + w, pad + h, pad + w - r, pad + h);
        ctx.lineTo(pad + r, pad + h);
        ctx.quadraticCurveTo(pad, pad + h, pad, pad + h - r);
        ctx.lineTo(pad, pad + r);
        ctx.quadraticCurveTo(pad, pad, pad + r, pad);
        ctx.closePath();

        ctx.fillStyle = isWarn ? 'rgba(69, 10, 10, 0.90)' : 'rgba(15, 23, 42, 0.88)';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = accentCss;
        ctx.stroke();

        // Accent color badge disc / top stripe
        ctx.fillStyle = accentCss;
        if (isWarn) {
          ctx.beginPath();
          ctx.moveTo(80, 26);
          ctx.lineTo(106, 70);
          ctx.lineTo(54, 70);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 30px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', 80, 56);
        } else {
          ctx.beginPath();
          ctx.arc(80, 54, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.65)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Primary short label
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 28px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label.slice(0, 7), 80, sub ? 98 : 106);

        // Optional subline (priority/reach/cap/filter mode)
        if (sub) {
          ctx.fillStyle = accentCss;
          ctx.font = 'bold 21px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillText(sub.slice(0, 9), 80, 128);
        }

        tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        this.altModeTexCache.set(key, tex);
      }
    }

    const mat = new THREE.SpriteMaterial({
      map: tex ?? null,
      color: tex ? 0xffffff : 0xf8fafc,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.altModeMatCache.set(key, mat);
    return mat;
  }

  private fillAltModeBadge(engine: CapytorioFactoryEngine, m: CapytorioMachine): boolean {
    const baseSpec = CAPYTORIO_MACHINE_SPECS[m.type];
    // High-priority operational alerts
    if (baseSpec.powerDemandMw > 0 && engine.powerEfficiency <= 0.05) {
      _altBadgeScratch.key = 'warn:nopwr';
      _altBadgeScratch.label = 'NO PWR';
      _altBadgeScratch.sub = '0%';
      _altBadgeScratch.accent = '#ef4444';
      _altBadgeScratch.warn = true;
      return true;
    }
    if (m.type === 'generator') {
      if (m.variantItemId === 'solar_panel') {
        _altBadgeScratch.key = 'gen:solar';
        _altBadgeScratch.label = 'SOLAR';
        _altBadgeScratch.sub = 'PV';
        _altBadgeScratch.accent = '#38bdf8';
        _altBadgeScratch.warn = false;
        return true;
      }
      if (m.variantItemId === 'accumulator') {
        _altBadgeScratch.key = 'gen:accum';
        _altBadgeScratch.label = 'BATT';
        _altBadgeScratch.sub = 'CAP';
        _altBadgeScratch.accent = '#22d3ee';
        _altBadgeScratch.warn = false;
        return true;
      }
      if (m.variantItemId === 'nuclear_reactor') {
        _altBadgeScratch.key = 'gen:nuclear';
        _altBadgeScratch.label = 'NUKE';
        _altBadgeScratch.sub = 'CORE';
        _altBadgeScratch.accent = '#34d399';
        _altBadgeScratch.warn = false;
        return true;
      }
      if (m.fuelTimer <= 0) {
        _altBadgeScratch.key = 'warn:nofuel';
        _altBadgeScratch.label = 'NO FUEL';
        _altBadgeScratch.sub = 'COAL';
        _altBadgeScratch.accent = '#f59e0b';
        _altBadgeScratch.warn = true;
        return true;
      }
    }
    if (m.type === 'drill') {
      if (m.variantItemId === 'offshore_pump' || m.variantItemId === 'pump') {
        _altBadgeScratch.key = `pump:${m.variantItemId}`;
        _altBadgeScratch.label = m.variantItemId === 'offshore_pump' ? 'WATER' : 'FLUID';
        _altBadgeScratch.sub = 'PUMP';
        _altBadgeScratch.accent = '#38bdf8';
        _altBadgeScratch.warn = false;
        return true;
      }
      const fp = engine.getMachineFootprint(m);
      const ore = engine.findFirstOreInFootprint(m.gx, m.gz, fp.width, fp.height);
      if (!ore) {
        _altBadgeScratch.key = 'warn:noore';
        _altBadgeScratch.label = 'NO ORE';
        _altBadgeScratch.sub = 'EMPTY';
        _altBadgeScratch.accent = '#f59e0b';
        _altBadgeScratch.warn = true;
        return true;
      }
      const meta = getCapytorioItemMeta(ore.resource);
      _altBadgeScratch.key = `drill:${ore.resource}`;
      _altBadgeScratch.label = meta.shortName.toUpperCase();
      _altBadgeScratch.sub = 'MINE';
      _altBadgeScratch.accent = meta.cssColor;
      _altBadgeScratch.warn = false;
      return true;
    }
    if (m.type === 'assembler' && m.recipeId) {
      const rec = RECIPE_BY_ID.get(m.recipeId);
      if (rec) {
        const meta = getCapytorioItemMeta(rec.result);
        _altBadgeScratch.key = `asm:${m.recipeId}`;
        _altBadgeScratch.label = meta.shortName.toUpperCase();
        _altBadgeScratch.sub = `×${rec.resultCount}`;
        _altBadgeScratch.accent = meta.cssColor;
        _altBadgeScratch.warn = false;
        return true;
      }
    }
    if (m.type === 'furnace') {
      let outItem: string | null = null;
      for (const k in m.outputBuffer) {
        if ((m.outputBuffer[k] ?? 0) > 0) {
          outItem = k;
          break;
        }
      }
      if (!outItem) {
        for (const k in m.inputBuffer) {
          if ((m.inputBuffer[k] ?? 0) > 0) {
            const spec = getCapytorioSmeltSpec(k);
            if (spec) {
              outItem = spec.result;
              break;
            }
          }
        }
      }
      if (outItem) {
        const meta = getCapytorioItemMeta(outItem);
        _altBadgeScratch.key = `furn:${outItem}`;
        _altBadgeScratch.label = meta.shortName.toUpperCase();
        _altBadgeScratch.sub = 'SMELT';
        _altBadgeScratch.accent = meta.cssColor;
        _altBadgeScratch.warn = false;
        return true;
      }
      return false;
    }
    if (m.type === 'splitter') {
      const inP = m.splitterInputPriority ?? 'none';
      const outP = m.splitterOutputPriority ?? 'none';
      const filt = m.splitterFilterItem ?? null;
      if (!filt && inP === 'none' && outP === 'none') return false;
      const inTag = inP === 'left' ? 'IL' : inP === 'right' ? 'IR' : '';
      const outTag = outP === 'left' ? 'OL' : outP === 'right' ? 'OR' : filt ? 'OL' : '';
      const sub = `${inTag}${inTag && outTag ? ' ' : ''}${outTag}`.trim() || 'SPLIT';
      if (filt) {
        const meta = getCapytorioItemMeta(filt);
        _altBadgeScratch.key = `split:${filt}:${sub}`;
        _altBadgeScratch.label = meta.shortName.toUpperCase();
        _altBadgeScratch.sub = sub;
        _altBadgeScratch.accent = meta.cssColor;
        _altBadgeScratch.warn = false;
        return true;
      }
      _altBadgeScratch.key = `split:prio:${sub}`;
      _altBadgeScratch.label = 'PRIO';
      _altBadgeScratch.sub = sub;
      _altBadgeScratch.accent = '#facc15';
      _altBadgeScratch.warn = false;
      return true;
    }
    if (m.type === 'inserter') {
      const filters = m.inserterFilters;
      const hasFilters = Boolean(filters && filters.length > 0);
      const reach = getCapytorioInserterReach(m.variantItemId);
      const stackLim = m.inserterStackLimit ?? null;
      if (!hasFilters && reach < 2 && stackLim === null) return false;
      if (hasFilters && filters) {
        const mode = m.inserterFilterMode === 'blacklist' ? 'BLK' : 'FLT';
        const meta = getCapytorioItemMeta(filters[0]);
        const extra = filters.length > 1 ? `+${filters.length - 1}` : stackLim ? `×${stackLim}` : '';
        _altBadgeScratch.key = `ins:${mode}:${filters[0]}:${extra}`;
        _altBadgeScratch.label = meta.shortName.toUpperCase();
        _altBadgeScratch.sub = `${mode}${extra ? ` ${extra}` : ''}`;
        _altBadgeScratch.accent = m.inserterFilterMode === 'blacklist' ? '#f87171' : meta.cssColor;
        _altBadgeScratch.warn = false;
        return true;
      }
      const label = reach === 2 ? 'LONG' : `STK ${stackLim}`;
      const sub = reach === 2 && stackLim ? `2T ×${stackLim}` : reach === 2 ? '2-TILE' : 'CAP';
      _altBadgeScratch.key = `ins:${label}:${sub}`;
      _altBadgeScratch.label = label;
      _altBadgeScratch.sub = sub;
      _altBadgeScratch.accent = reach === 2 ? '#ef4444' : '#38bdf8';
      _altBadgeScratch.warn = false;
      return true;
    }
    if (m.type === 'chest') {
      if (m.variantItemId === 'roboport') {
        const fleet = engine.getRoboportFleetCount(m);
        _altBadgeScratch.key = `roboport:${fleet}`;
        _altBadgeScratch.label = 'PORT';
        _altBadgeScratch.sub = `${fleet} BOT`;
        _altBadgeScratch.accent = '#fb923c';
        _altBadgeScratch.warn = false;
        return true;
      }
      let topItem: string | null = null;
      let topCount = 0;
      for (const k in m.outputBuffer) {
        const c = m.outputBuffer[k] ?? 0;
        if (c > topCount) {
          topCount = c;
          topItem = k;
        }
      }
      const limit = m.chestSlotLimit ?? null;
      if (!topItem && limit === null) return false;
      if (topItem) {
        const meta = getCapytorioItemMeta(topItem);
        const capTag = limit !== null ? `${limit}/${CAPYTORIO_CHEST_SLOTS}` : 'BOX';
        _altBadgeScratch.key = `chest:${topItem}:${capTag}`;
        _altBadgeScratch.label = meta.shortName.toUpperCase();
        _altBadgeScratch.sub = capTag;
        _altBadgeScratch.accent = meta.cssColor;
        _altBadgeScratch.warn = false;
        return true;
      }
      _altBadgeScratch.key = `chest:cap:${limit}`;
      _altBadgeScratch.label = 'CAP';
      _altBadgeScratch.sub = `${limit}/${CAPYTORIO_CHEST_SLOTS}`;
      _altBadgeScratch.accent = '#ef4444';
      _altBadgeScratch.warn = false;
      return true;
    }
    if (m.type === 'lab') {
      if (m.variantItemId === 'beacon') {
        const modCount = m.modules?.length ?? 0;
        _altBadgeScratch.key = `beacon:${modCount}`;
        _altBadgeScratch.label = 'BEACON';
        _altBadgeScratch.sub = modCount > 0 ? `${modCount} MOD` : 'AURA';
        _altBadgeScratch.accent = '#22d3ee';
        _altBadgeScratch.warn = false;
        return true;
      }
      if (m.variantItemId === 'radar') {
        _altBadgeScratch.key = 'radar:scan';
        _altBadgeScratch.label = 'RADAR';
        _altBadgeScratch.sub = 'SCAN';
        _altBadgeScratch.accent = '#38bdf8';
        _altBadgeScratch.warn = false;
        return true;
      }
      _altBadgeScratch.key = 'lab:sci';
      _altBadgeScratch.label = 'LAB';
      _altBadgeScratch.sub = 'TECH';
      _altBadgeScratch.accent = '#a855f7';
      _altBadgeScratch.warn = false;
      return true;
    }
    return false;
  }

  private buildLandingBeaconLandmark(): void {
    // Sculpted architectural Drop-Pod Surveyor Beacon slightly off spawn pad -> clear vista
    const pylon = new THREE.Group();
    pylon.position.set(CAPYTORIO_WORLD_ORIGIN_X, 0, CAPYTORIO_WORLD_ORIGIN_Z - 6.8);

    // Tiered octagonal armored base + anchor pads
    const padLower = new THREE.CylinderGeometry(1.65, 1.95, 0.24, 8);
    padLower.translate(0, 0.12, 0);
    const padUpper = new THREE.CylinderGeometry(1.18, 1.42, 0.28, 8);
    padUpper.translate(0, 0.36, 0);
    const baseGeo = mergeSimpleIndexedGeometries([padLower, padUpper]);
    const base = new THREE.Mesh(baseGeo, this.matSteelDark);
    base.castShadow = true;
    base.receiveShadow = true;
    pylon.add(base);

    // Hazard-striped perimeter safety ring
    const hazardRingGeo = new THREE.CylinderGeometry(1.48, 1.54, 0.09, 8);
    const hazardRing = new THREE.Mesh(hazardRingGeo, this.matHazardYellow);
    hazardRing.position.y = 0.27;
    pylon.add(hazardRing);

    // Tapered central mast + 4 diagonal lattice support struts + parabolic surveyor dish
    const mastParts: THREE.BufferGeometry[] = [];
    const mastCore = new THREE.CylinderGeometry(0.2, 0.34, 4.45, 8);
    mastCore.translate(0, 2.55, 0);
    mastParts.push(mastCore);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) * 0.5 + Math.PI * 0.25;
      const strut = new THREE.CylinderGeometry(0.065, 0.085, 2.25, 6);
      strut.rotateZ(0.46);
      strut.rotateY(ang);
      strut.translate(Math.cos(ang) * 0.62, 1.25, -Math.sin(ang) * 0.62);
      mastParts.push(strut);
    }
    const dishProfile = [
      new THREE.Vector2(0.05, 0.0),
      new THREE.Vector2(0.42, 0.06),
      new THREE.Vector2(0.84, 0.26),
      new THREE.Vector2(0.92, 0.32),
      new THREE.Vector2(0.84, 0.35),
      new THREE.Vector2(0.38, 0.13),
      new THREE.Vector2(0.05, 0.07),
    ];
    const dishShell = new THREE.LatheGeometry(dishProfile, 16);
    dishShell.rotateX(0.42);
    dishShell.translate(0, 4.35, 0.22);
    mastParts.push(dishShell);
    const mastGeo = mergeSimpleIndexedGeometries(mastParts);
    const mast = new THREE.Mesh(mastGeo, this.matSteelLight);
    mast.castShadow = true;
    pylon.add(mast);

    // Copper telemetry feed horn & coil collar
    const feedCollar = new THREE.TorusGeometry(0.36, 0.065, 8, 16);
    feedCollar.rotateX(Math.PI * 0.5);
    feedCollar.translate(0, 3.65, 0);
    const feedSpike = new THREE.ConeGeometry(0.11, 0.55, 8);
    feedSpike.translate(0, 4.78, 0.42);
    feedSpike.rotateX(0.22);
    const copperGeo = mergeSimpleIndexedGeometries([feedCollar, feedSpike]);
    const copperMesh = new THREE.Mesh(copperGeo, this.matCopper);
    pylon.add(copperMesh);

    // Rotating brass telemetry gyro halo
    const dishGeo = new THREE.TorusGeometry(0.92, 0.075, 8, 24);
    const dish = new THREE.Mesh(dishGeo, this.matBrass);
    dish.position.y = 5.38;
    dish.rotation.x = Math.PI * 0.32;
    pylon.add(dish);
    this.beaconDishRing = dish;

    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.25,
      roughness: 0.14,
      metalness: 0.22,
    });
    const orbGeo = new THREE.OctahedronGeometry(0.42, 0);
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.y = 5.38;
    pylon.add(orb);
    this.beaconOrb = orb;

    this.sharedGeometries.push(baseGeo, hazardRingGeo, mastGeo, copperGeo, dishGeo, orbGeo);
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
        bumpMap: this.industrialPlateBumpTex ?? null,
        bumpScale: 0.018,
        roughness: 0.36,
        metalness: 0.38,
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

  private acquireMachineGroup(type: CapytorioMachineType, variantItemId?: string): THREE.Group {
    const meshKey = resolveMachineMeshKey(type, variantItemId);
    const pool = this.inactivePoolByType.get(meshKey);
    if (pool && pool.length > 0) {
      const g = pool.pop()!;
      g.visible = true;
      return g;
    }
    return this.createCompositeMachineMesh(type, variantItemId);
  }

  private releaseMachineGroup(meshKey: string, group: THREE.Group): void {
    group.visible = false;
    this.root.remove(group);
    let pool = this.inactivePoolByType.get(meshKey);
    if (!pool) {
      pool = [];
      this.inactivePoolByType.set(meshKey, pool);
    }
    pool.push(group);
  }

  private createCompositeMachineMesh(
    type: CapytorioMachineType,
    variantItemId?: string
  ): THREE.Group {
    const g = new THREE.Group();
    const spec = CAPYTORIO_MACHINE_SPECS[type];
    const meshKey = resolveMachineMeshKey(type, variantItemId);
    const variantSpec = variantItemId ? resolveCapytorioPlaceableSpec(variantItemId) : null;
    const initialTint = variantSpec?.tintHex ?? spec.colorHex;
    const accentMat = this.getCachedAccentMat(initialTint);
    const accentMeshes: THREE.Mesh[] = [];
    g.userData.meshKey = meshKey;
    g.userData.machineType = type;
    g.userData.accentMeshes = accentMeshes;
    g.userData.appliedTintHex = initialTint;
    g.userData.__occluderRoot = g;
    g.userData.ignoreCameraFade = true;

    // Stepped cast-iron plinth with corner anchor bolts sitting flush on y = 0
    if (!variantSkipsDefaultPlinth(variantItemId)) {
      const plinth = new THREE.Mesh(
        type === 'splitter'
          ? this.getCachedMachineGeo('plinth_splitter_2x1', () => {
              const w = CAPYTORIO_TILE_SIZE * 2 - 0.24;
              const d = CAPYTORIO_TILE_SIZE - 0.14;
              const lower = createChamferedBoxGeometry(w, 0.16, d, 0.14);
              lower.translate(0, 0.08, 0);
              const upper = createChamferedBoxGeometry(w - 0.14, 0.1, d - 0.14, 0.1);
              upper.translate(0, 0.2, 0);
              return mergeSimpleIndexedGeometries([lower, upper]);
            })
          : this.getCachedMachineGeo('plinth', () => {
              const parts: THREE.BufferGeometry[] = [];
              const lower = createChamferedBoxGeometry(2.12, 0.15, 2.12, 0.16);
              lower.translate(0, 0.075, 0);
              parts.push(lower);
              const upper = createChamferedBoxGeometry(1.94, 0.1, 1.94, 0.14);
              upper.translate(0, 0.195, 0);
              parts.push(upper);
              const boltOff = 0.88;
              for (const bx of [-boltOff, boltOff]) {
                for (const bz of [-boltOff, boltOff]) {
                  const pad = new THREE.CylinderGeometry(0.11, 0.14, 0.16, 6);
                  pad.translate(bx, 0.12, bz);
                  parts.push(pad);
                }
              }
              return mergeSimpleIndexedGeometries(parts);
            }),
        this.matSteelDark
      );
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      g.add(plinth);
    }

    // Dedicated procedural 3D silhouette for distinct placeable building variants
    if (
      variantItemId &&
      DEDICATED_CAPYTORIO_VARIANT_MODELS.has(variantItemId) &&
      buildDedicatedVariantModel(variantItemId, g, {
        getCachedGeo: (key, builder) => this.getCachedMachineGeo(key, builder),
        chamferedBox: (w, h, d, bevel = 0.08) => createChamferedBoxGeometry(w, h, d, bevel),
        mergeGeos: (geos) => mergeSimpleIndexedGeometries(geos),
        mats: this.variantMats,
        accentMat,
        accentMeshes,
      })
    ) {
      g.traverse((node) => {
        node.userData.__occluderRoot = g;
        node.userData.ignoreCameraFade = true;
      });
      return g;
    }

    if (type === 'drill') {
      // Heavy A-frame truss mining rig + hydraulic guide pistons + fluted auger + hazard chute
      const frame = new THREE.Mesh(
        this.getCachedMachineGeo('drill_frame', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const sx of [-0.74, 0.74]) {
            const legF = new THREE.BoxGeometry(0.18, 1.48, 0.22);
            legF.rotateX(0.14);
            legF.translate(sx, 0.92, -0.34);
            parts.push(legF);

            const legB = new THREE.BoxGeometry(0.18, 1.48, 0.22);
            legB.rotateX(-0.14);
            legB.translate(sx, 0.92, 0.34);
            parts.push(legB);

            const cross = new THREE.BoxGeometry(0.14, 0.14, 0.88);
            cross.translate(sx, 0.78, 0);
            parts.push(cross);

            const piston = new THREE.CylinderGeometry(0.08, 0.08, 1.24, 8);
            piston.translate(sx * 0.72, 0.88, 0);
            parts.push(piston);
          }
          // Floor collar around drill bore
          const boreRing = new THREE.TorusGeometry(0.54, 0.08, 8, 16);
          boreRing.rotateX(Math.PI * 0.5);
          boreRing.translate(0, 0.28, 0);
          parts.push(boreRing);
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matSteelLight
      );
      frame.castShadow = true;
      frame.receiveShadow = true;
      g.add(frame);

      const motor = new THREE.Mesh(
        this.getCachedMachineGeo('drill_motor', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Open twin-motor gantry flanking an exposed central drill rotary well
          for (const sx of [-0.66, 0.66]) {
            const pod = createChamferedBoxGeometry(0.56, 0.44, 1.18, 0.1);
            pod.translate(sx, 1.62, 0.04);
            parts.push(pod);
          }
          // Rear bridge deck connecting twin drive pods (leaves center rotary spindle open!)
          const rearBridge = createChamferedBoxGeometry(1.76, 0.34, 0.42, 0.08);
          rearBridge.translate(0, 1.64, 0.52);
          parts.push(rearBridge);
          // Front cross-beam tie
          const frontBeam = createChamferedBoxGeometry(1.72, 0.24, 0.28, 0.06);
          frontBeam.translate(0, 1.62, -0.5);
          parts.push(frontBeam);
          return mergeSimpleIndexedGeometries(parts);
        }),
        accentMat
      );
      motor.castShadow = true;
      motor.receiveShadow = true;
      g.add(motor);
      accentMeshes.push(motor);

      const drillTrim = new THREE.Mesh(
        this.getCachedMachineGeo('drill_trim', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Heavy central dark-steel rotary gearbox collar + twin exhaust mufflers
          const wellRing = new THREE.TorusGeometry(0.46, 0.085, 8, 16);
          wellRing.rotateX(Math.PI * 0.5);
          wellRing.translate(0, 1.76, 0);
          parts.push(wellRing);
          for (const sx of [-0.68, 0.68]) {
            const vent = new THREE.BoxGeometry(0.32, 0.1, 0.72);
            vent.translate(sx, 1.88, 0.04);
            parts.push(vent);
          }
          const muffler = new THREE.CylinderGeometry(0.12, 0.14, 0.58, 8);
          muffler.translate(0.62, 2.02, 0.56);
          parts.push(muffler);
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matSteelDark
      );
      drillTrim.castShadow = true;
      g.add(drillTrim);

      const augerGroup = new THREE.Group();
      augerGroup.position.set(0, 0.88, 0);
      const augerMesh = new THREE.Mesh(
        this.getCachedMachineGeo('drill_auger', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Tapered fluted drill bit via LatheGeometry
          const bitPts = [
            new THREE.Vector2(0.01, -0.62),
            new THREE.Vector2(0.18, -0.36),
            new THREE.Vector2(0.32, -0.05),
            new THREE.Vector2(0.44, 0.34),
            new THREE.Vector2(0.24, 0.62),
            new THREE.Vector2(0.2, 1.06),
            new THREE.Vector2(0.01, 1.08),
          ];
          parts.push(new THREE.LatheGeometry(bitPts, 10));
          // Stepped helical cutting flight collars
          const flightSpecs: Array<[number, number, number]> = [
            [-0.24, 0.25, 0.055],
            [0.02, 0.35, 0.065],
            [0.28, 0.44, 0.075],
          ];
          for (let i = 0; i < flightSpecs.length; i++) {
            const [fy, fr, ft] = flightSpecs[i];
            const ring = new THREE.TorusGeometry(fr, ft, 6, 14);
            ring.rotateX(Math.PI * 0.5 + 0.16);
            ring.rotateY(i * 1.1);
            ring.translate(0, fy, 0);
            parts.push(ring);
          }
          // Exposed overhead spinning 8-tooth rotary drive wheel visible from oblique camera!
          const topWheel = createSpurGearGeometry(8, 0.44, 0.33, 0.1, 0.14);
          topWheel.translate(0, 1.02, 0);
          parts.push(topWheel);
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matBrass
      );
      augerMesh.castShadow = true;
      augerGroup.add(augerMesh);
      g.add(augerGroup);
      g.userData.spinPart = augerGroup;

      const chute = new THREE.Mesh(
        this.getCachedMachineGeo('drill_chute', () => {
          const hood = createChamferedBoxGeometry(0.68, 0.36, 0.66, 0.08);
          hood.translate(0, 0.4, -0.96);
          return hood;
        }),
        this.matHazardYellow
      );
      chute.castShadow = true;
      g.add(chute);

      const mouth = new THREE.Mesh(
        this.getCachedMachineGeo('drill_mouth', () => new THREE.BoxGeometry(0.48, 0.22, 0.1)),
        this.matDarkVoid
      );
      mouth.position.set(0, 0.36, -1.26);
      g.add(mouth);

      const lamp = new THREE.Mesh(
        this.getCachedMachineGeo('machine_status_lamp', () => new THREE.SphereGeometry(0.11, 8, 6)),
        this.matStatusLampOn
      );
      lamp.position.set(0, 2.15, -0.26);
      g.add(lamp);
      g.userData.statusLamp = lamp;
    } else if (type === 'inserter') {
      // Articulated Factorio servo inserter with hydraulic rods + paired pneumatic pincer claws
      // Pooled geometry budget strictly <= 22 across all instances (currently 20 total incl. 8 held shapes)
      const ped = new THREE.Mesh(
        this.getCachedMachineGeo('ins_ped', () => {
          const lower = new THREE.CylinderGeometry(0.64, 0.76, 0.16, 8);
          lower.translate(0, 0.29, 0);
          const flange = new THREE.CylinderGeometry(0.46, 0.54, 0.14, 8);
          flange.translate(0, 0.4, 0);
          return mergeSimpleIndexedGeometries([lower, flange]);
        }),
        this.matSteelLight
      );
      ped.castShadow = true;
      ped.receiveShadow = true;
      g.add(ped);

      const turret = new THREE.Group();
      turret.position.set(0, 0.42, 0);

      const turretCollar = new THREE.Mesh(
        this.getCachedMachineGeo('ins_collar', () => {
          const core = new THREE.CylinderGeometry(0.38, 0.46, 0.24, 8);
          core.translate(0, 0.1, 0);
          const servoPod = createChamferedBoxGeometry(0.56, 0.22, 0.42, 0.06);
          servoPod.translate(0, 0.12, 0.18);
          return mergeSimpleIndexedGeometries([core, servoPod]);
        }),
        accentMat
      );
      turret.add(turretCollar);
      accentMeshes.push(turretCollar);

      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(0, 0.22, 0);

      const shoulderPin = new THREE.Mesh(
        this.getCachedMachineGeo('ins_pin', () => {
          const axle = new THREE.CylinderGeometry(0.17, 0.17, 0.48, 10);
          axle.rotateZ(Math.PI * 0.5);
          return axle;
        }),
        this.matSteelDark
      );
      shoulderPivot.add(shoulderPin);

      // Merged twin upper truss booms + cross-braces (1 shared geo!)
      const upperBoom = new THREE.Mesh(
        this.getCachedMachineGeo('ins_upper', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const sx of [-0.13, 0.13]) {
            const rail = new THREE.BoxGeometry(0.1, INSERTER_UPPER_ARM_LEN, 0.22);
            rail.translate(sx, INSERTER_UPPER_ARM_LEN * 0.5, 0);
            parts.push(rail);
          }
          for (const cy of [0.48, 1.12]) {
            const brace = new THREE.BoxGeometry(0.28, 0.1, 0.16);
            brace.translate(0, cy, 0);
            parts.push(brace);
          }
          return mergeSimpleIndexedGeometries(parts);
        }),
        accentMat
      );
      upperBoom.castShadow = true;
      shoulderPivot.add(upperBoom);
      accentMeshes.push(upperBoom);

      const upperStrut = new THREE.Mesh(
        this.getCachedMachineGeo('ins_strut', () => {
          const cyl = new THREE.CylinderGeometry(0.065, 0.065, 1.18, 8);
          cyl.translate(0, 0.72, 0.12);
          const sleeve = new THREE.CylinderGeometry(0.095, 0.095, 0.52, 8);
          sleeve.translate(0, 0.44, 0.12);
          return mergeSimpleIndexedGeometries([cyl, sleeve]);
        }),
        this.matSteelLight
      );
      shoulderPivot.add(upperStrut);

      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, INSERTER_UPPER_ARM_LEN, 0);

      const elbowDrum = new THREE.Mesh(
        this.getCachedMachineGeo('ins_drum', () => {
          const drum = new THREE.CylinderGeometry(0.2, 0.2, 0.38, 12);
          drum.rotateZ(Math.PI * 0.5);
          return drum;
        }),
        this.matSteelDark
      );
      elbowPivot.add(elbowDrum);

      const elbowCap = new THREE.Mesh(
        this.getCachedMachineGeo('ins_cap', () => {
          const cap = new THREE.CylinderGeometry(0.12, 0.12, 0.44, 10);
          cap.rotateZ(Math.PI * 0.5);
          return cap;
        }),
        this.matBrass
      );
      elbowPivot.add(elbowCap);

      const forearm = new THREE.Mesh(
        this.getCachedMachineGeo('ins_forearm', () => {
          const boom = new THREE.BoxGeometry(0.16, 0.15, INSERTER_FOREARM_LEN);
          boom.translate(0, 0, -INSERTER_FOREARM_LEN * 0.5);
          const rod = new THREE.CylinderGeometry(0.045, 0.045, INSERTER_FOREARM_LEN * 0.76, 8);
          rod.rotateX(Math.PI * 0.5);
          rod.translate(0, -0.09, -INSERTER_FOREARM_LEN * 0.48);
          return mergeSimpleIndexedGeometries([boom, rod]);
        }),
        this.matSteelLight
      );
      forearm.castShadow = true;
      elbowPivot.add(forearm);

      const forearmRib = new THREE.Mesh(
        this.getCachedMachineGeo('ins_rib', () => {
          const rib = createChamferedBoxGeometry(0.22, 0.09, 1.24, 0.04);
          rib.translate(0, 0.08, -0.78);
          return rib;
        }),
        accentMat
      );
      elbowPivot.add(forearmRib);
      accentMeshes.push(forearmRib);

      const wristPivot = new THREE.Group();
      wristPivot.position.set(0, 0, -INSERTER_FOREARM_LEN);

      const wristHub = new THREE.Mesh(
        this.getCachedMachineGeo('ins_wrist', () => {
          const hub = createChamferedBoxGeometry(0.36, 0.15, 0.24, 0.04);
          const collar = new THREE.CylinderGeometry(0.1, 0.1, 0.18, 8);
          collar.rotateX(Math.PI * 0.5);
          collar.translate(0, 0, 0.12);
          return mergeSimpleIndexedGeometries([hub, collar]);
        }),
        this.matSteelDark
      );
      wristPivot.add(wristHub);

      // Curved pneumatic pincer claws (shared 1 geo mirrored via scale.x = -1, animated on hold!)
      const jawGeo = this.getCachedMachineGeo('ins_jaw', () => {
        const upperFinger = new THREE.BoxGeometry(0.065, 0.16, 0.14);
        upperFinger.rotateZ(-0.22);
        upperFinger.translate(-0.02, -0.08, 0);
        const lowerTip = new THREE.BoxGeometry(0.055, 0.15, 0.12);
        lowerTip.rotateZ(0.32);
        lowerTip.translate(0.01, -0.21, 0);
        return mergeSimpleIndexedGeometries([upperFinger, lowerTip]);
      });
      const jawL = new THREE.Mesh(jawGeo, this.matBrass);
      jawL.position.set(-0.15, -0.05, 0);
      wristPivot.add(jawL);

      const jawR = new THREE.Mesh(jawGeo, this.matBrass);
      jawR.scale.x = -1;
      jawR.position.set(0.15, -0.05, 0);
      wristPivot.add(jawR);

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
      g.userData.jawL = jawL;
      g.userData.jawR = jawR;
      g.userData.heldMount = heldMount;
      g.userData.heldMeshesByShape = heldMeshesByShape;
      g.userData.lastHeldColorHex = 0xffffff;
    } else if (type === 'furnace') {
      // Domed stoneware brick kiln + merged ironwork bands & twin flanged chimneys + copper coil
      // Strictly 6 pooled geometries (plinth + kiln + ironwork + copper + hearth + port <= 6!)
      const kiln = new THREE.Mesh(
        this.getCachedMachineGeo('furn_kiln', () => {
          const pts = [
            new THREE.Vector2(0.01, 0.22),
            new THREE.Vector2(1.02, 0.22),
            new THREE.Vector2(0.98, 0.72),
            new THREE.Vector2(0.9, 1.24),
            new THREE.Vector2(0.76, 1.56),
            new THREE.Vector2(0.46, 1.78),
            new THREE.Vector2(0.01, 1.82),
          ];
          return new THREE.LatheGeometry(pts, 12);
        }),
        this.matBrick
      );
      kiln.castShadow = true;
      kiln.receiveShadow = true;
      g.add(kiln);

      const ironwork = new THREE.Mesh(
        this.getCachedMachineGeo('furn_ironwork', () => {
          const parts: THREE.BufferGeometry[] = [];
          // 2 heavy forged-iron kiln tension hoops
          for (const [hy, hr] of [
            [0.54, 1.0],
            [1.18, 0.92],
          ]) {
            const band = new THREE.TorusGeometry(hr, 0.045, 6, 16);
            band.rotateX(Math.PI * 0.5);
            band.translate(0, hy, 0);
            parts.push(band);
          }
          // Twin tall flanged smokestacks
          for (const sx of [-0.46, 0.46]) {
            const stack = new THREE.CylinderGeometry(0.17, 0.22, 1.08, 10);
            stack.translate(sx, 1.92, 0.32);
            parts.push(stack);
            const lip = new THREE.CylinderGeometry(0.24, 0.2, 0.12, 10);
            lip.translate(sx, 2.46, 0.32);
            parts.push(lip);
          }
          // Arched cast-iron firebox surround
          const archFrame = new THREE.TorusGeometry(0.42, 0.075, 6, 12, Math.PI);
          archFrame.translate(0, 0.74, -0.94);
          parts.push(archFrame);
          for (const px of [-0.42, 0.42]) {
            const post = new THREE.BoxGeometry(0.14, 0.46, 0.16);
            post.translate(px, 0.52, -0.94);
            parts.push(post);
          }
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matSteelDark
      );
      ironwork.castShadow = true;
      g.add(ironwork);

      const hearth = new THREE.Mesh(
        this.getCachedMachineGeo('furn_hearth', () => {
          const box = new THREE.BoxGeometry(0.74, 0.52, 0.18);
          const dome = new THREE.CylinderGeometry(0.37, 0.37, 0.18, 10, 1, false, 0, Math.PI);
          dome.rotateZ(Math.PI * 0.5);
          dome.rotateY(Math.PI * 0.5);
          dome.translate(0, 0.26, 0);
          return mergeSimpleIndexedGeometries([box, dome]);
        }),
        this.matFurnaceHearthIdle
      );
      hearth.position.set(0, 0.54, -0.92);
      g.add(hearth);
      g.userData.hearthMesh = hearth;

      const copperCrown = new THREE.Mesh(
        this.getCachedMachineGeo('furn_ring', () => {
          const ring = new THREE.TorusGeometry(0.74, 0.08, 8, 16);
          ring.rotateX(Math.PI * 0.5);
          ring.translate(0, 1.56, 0);
          const cap = new THREE.CylinderGeometry(0.28, 0.36, 0.22, 10);
          cap.translate(0, 1.88, -0.06);
          return mergeSimpleIndexedGeometries([ring, cap]);
        }),
        this.matCopper
      );
      g.add(copperCrown);

      const furnaceOutPort = new THREE.Mesh(
        this.getCachedMachineGeo('furn_port', () => {
          const apron = createChamferedBoxGeometry(0.72, 0.22, 0.42, 0.06);
          apron.translate(0, 0.28, -1.0);
          return apron;
        }),
        this.matHazardYellow
      );
      g.add(furnaceOutPort);
    } else if (type === 'assembler') {
      // Chamfered heavy industrial chassis + gantry + real toothed meshing spur gears + stamping press
      const hull = new THREE.Mesh(
        this.getCachedMachineGeo('asm_hull', () => {
          const parts: THREE.BufferGeometry[] = [];
          const body = createChamferedBoxGeometry(1.9, 0.96, 1.9, 0.22);
          body.translate(0, 0.72, 0);
          parts.push(body);
          // Side radiator louvre pods
          for (const sx of [-0.94, 0.94]) {
            const pod = createChamferedBoxGeometry(0.22, 0.62, 1.12, 0.06);
            pod.translate(sx, 0.74, 0);
            parts.push(pod);
          }
          return mergeSimpleIndexedGeometries(parts);
        }),
        accentMat
      );
      hull.castShadow = true;
      hull.receiveShadow = true;
      g.add(hull);
      accentMeshes.push(hull);

      const gantry = new THREE.Mesh(
        this.getCachedMachineGeo('asm_gantry', () => {
          const parts: THREE.BufferGeometry[] = [];
          // 4 heavy corner stanchions
          for (const cx of [-0.78, 0.78]) {
            for (const cz of [-0.78, 0.78]) {
              const post = new THREE.BoxGeometry(0.24, 1.24, 0.24);
              post.translate(cx, 0.84, cz);
              parts.push(post);
            }
          }
          // Overhead gantry cross-beam for stamping press
          const beam = new THREE.BoxGeometry(1.74, 0.18, 0.28);
          beam.translate(0, 1.88, -0.34);
          parts.push(beam);
          for (const sx of [-0.76, 0.76]) {
            const riser = new THREE.BoxGeometry(0.16, 0.56, 0.22);
            riser.translate(sx, 1.62, -0.34);
            parts.push(riser);
          }
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matSteelDark
      );
      gantry.castShadow = true;
      g.add(gantry);

      const hood = new THREE.Mesh(
        this.getCachedMachineGeo('asm_hood', () => {
          const deck = createChamferedBoxGeometry(1.5, 0.26, 1.5, 0.16);
          deck.translate(0, 1.34, 0);
          const pressHousing = new THREE.CylinderGeometry(0.2, 0.24, 0.36, 10);
          pressHousing.translate(0, 1.98, -0.34);
          return mergeSimpleIndexedGeometries([deck, pressHousing]);
        }),
        this.matSteelLight
      );
      hood.castShadow = true;
      g.add(hood);

      // True toothed meshing spur gears (10-tooth brass + 8-tooth steel, center distance = 0.76)
      const gearA = new THREE.Mesh(
        this.getCachedMachineGeo('asm_gearA', () => createSpurGearGeometry(10, 0.44, 0.34, 0.1, 0.14)),
        this.matBrass
      );
      gearA.position.set(-0.36, 1.56, 0.26);
      gearA.castShadow = true;
      g.add(gearA);

      const gearB = new THREE.Mesh(
        this.getCachedMachineGeo('asm_gearB', () => createSpurGearGeometry(8, 0.35, 0.26, 0.08, 0.14)),
        this.matSteelLight
      );
      gearB.position.set(0.38, 1.56, 0.26);
      gearB.castShadow = true;
      g.add(gearB);

      // Reciprocating stamping press piston head
      const pressHead = new THREE.Mesh(
        this.getCachedMachineGeo('asm_press', () => {
          const shaft = new THREE.CylinderGeometry(0.09, 0.09, 0.48, 8);
          shaft.translate(0, 0.18, 0);
          const ram = createChamferedBoxGeometry(0.44, 0.14, 0.36, 0.05);
          ram.translate(0, -0.06, 0);
          return mergeSimpleIndexedGeometries([shaft, ram]);
        }),
        this.matCopper
      );
      pressHead.position.set(0, 1.62, -0.34);
      g.add(pressHead);

      const portOut = new THREE.Mesh(
        this.getCachedMachineGeo('asm_port', () => {
          const apron = createChamferedBoxGeometry(0.76, 0.32, 0.34, 0.06);
          apron.translate(0, 0.44, -0.98);
          return apron;
        }),
        this.matHazardYellow
      );
      g.add(portOut);

      const lamp = new THREE.Mesh(
        this.getCachedMachineGeo('machine_status_lamp', () => new THREE.SphereGeometry(0.11, 8, 6)),
        this.matStatusLampOn
      );
      lamp.position.set(0.68, 1.58, -0.64);
      g.add(lamp);

      g.userData.gearA = gearA;
      g.userData.gearB = gearB;
      g.userData.pressHead = pressHead;
      g.userData.statusLamp = lamp;
    } else if (type === 'generator') {
      // Domed horizontal Lathe boiler + iron saddles & spark-arrestor stack + TubeGeometry copper manifold + spoked brass flywheel
      const boiler = new THREE.Mesh(
        this.getCachedMachineGeo('gen_boiler', () => {
          const boilerPts = [
            new THREE.Vector2(0.01, -0.88),
            new THREE.Vector2(0.46, -0.82),
            new THREE.Vector2(0.66, -0.64),
            new THREE.Vector2(0.68, 0.64),
            new THREE.Vector2(0.46, 0.82),
            new THREE.Vector2(0.01, 0.88),
          ];
          const tank = new THREE.LatheGeometry(boilerPts, 14);
          tank.rotateX(Math.PI * 0.5);
          tank.translate(0.06, 1.0, 0);
          const steamDome = new THREE.CylinderGeometry(0.32, 0.38, 0.34, 10);
          steamDome.translate(0.06, 1.72, -0.14);
          return mergeSimpleIndexedGeometries([tank, steamDome]);
        }),
        accentMat
      );
      boiler.castShadow = true;
      boiler.receiveShadow = true;
      g.add(boiler);
      accentMeshes.push(boiler);

      const cradleAndStack = new THREE.Mesh(
        this.getCachedMachineGeo('gen_stack', () => {
          const parts: THREE.BufferGeometry[] = [];
          // Twin mounting saddles + riveted boiler bands + end-cap bolted rings
          for (const sz of [-0.46, 0.46]) {
            const saddle = new THREE.BoxGeometry(1.16, 0.44, 0.22);
            saddle.translate(0.06, 0.44, sz);
            parts.push(saddle);
            const band = new THREE.TorusGeometry(0.69, 0.045, 6, 16);
            band.translate(0.06, 1.0, sz);
            parts.push(band);
          }
          const topSpine = new THREE.BoxGeometry(0.18, 0.12, 1.28);
          topSpine.translate(0.06, 1.66, 0.06);
          parts.push(topSpine);
          const rearHatch = new THREE.CylinderGeometry(0.34, 0.38, 0.14, 10);
          rearHatch.rotateX(Math.PI * 0.5);
          rearHatch.translate(0.06, 1.0, 0.86);
          parts.push(rearHatch);
          // Tall flanged exhaust smokestack + spark arrestor crown
          const stack = new THREE.CylinderGeometry(0.22, 0.28, 1.48, 10);
          stack.translate(0.48, 1.92, 0.46);
          parts.push(stack);
          const cap = new THREE.CylinderGeometry(0.32, 0.24, 0.16, 10);
          cap.translate(0.48, 2.68, 0.46);
          parts.push(cap);
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matSteelDark
      );
      cradleAndStack.castShadow = true;
      g.add(cradleAndStack);

      const firebox = new THREE.Mesh(
        this.getCachedMachineGeo('gen_firebox', () => new THREE.BoxGeometry(0.68, 0.44, 0.22)),
        this.matGeneratorFireboxIdle
      );
      firebox.position.set(0.06, 0.64, -0.84);
      g.add(firebox);
      g.userData.fireboxMesh = firebox;

      // Curved TubeGeometry copper steam manifold running from steam dome to turbine flywheel side + pressure gauge
      const pipe = new THREE.Mesh(
        this.getCachedMachineGeo('gen_pipe', () => {
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.06, 1.82, -0.14),
            new THREE.Vector3(-0.36, 1.86, -0.14),
            new THREE.Vector3(-0.68, 1.56, -0.06),
            new THREE.Vector3(-0.74, 1.06, 0.14),
          ]);
          const tube = new THREE.TubeGeometry(curve, 14, 0.095, 8, false);
          const flange = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 8);
          flange.rotateZ(Math.PI * 0.5);
          flange.translate(-0.74, 1.02, 0.14);
          const gaugeCap = new THREE.CylinderGeometry(0.22, 0.26, 0.14, 10);
          gaugeCap.translate(0.06, 1.94, -0.14);
          return mergeSimpleIndexedGeometries([tube, flange, gaugeCap]);
        }),
        this.matCopper
      );
      pipe.castShadow = true;
      g.add(pipe);

      // Spoked brass flywheel (rim + 4 radial spokes + hub merged into 1 geo!)
      const flywheel = new THREE.Mesh(
        this.getCachedMachineGeo('gen_flywheel', () => {
          const parts: THREE.BufferGeometry[] = [];
          const rim = new THREE.TorusGeometry(0.58, 0.095, 8, 18);
          rim.rotateY(Math.PI * 0.5);
          parts.push(rim);
          for (let i = 0; i < 4; i++) {
            const spoke = new THREE.BoxGeometry(0.08, 1.08, 0.1);
            spoke.rotateX((i * Math.PI) / 4);
            parts.push(spoke);
          }
          const hub = new THREE.CylinderGeometry(0.18, 0.18, 0.22, 10);
          hub.rotateZ(Math.PI * 0.5);
          parts.push(hub);
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matBrass
      );
      flywheel.position.set(-0.88, 1.0, 0.14);
      flywheel.castShadow = true;
      g.add(flywheel);
      g.userData.flywheel = flywheel;

      const hopperLip = new THREE.Mesh(
        this.getCachedMachineGeo('gen_lip', () => {
          const lip = createChamferedBoxGeometry(0.76, 0.18, 0.3, 0.05);
          lip.translate(0.06, 0.34, -0.94);
          return lip;
        }),
        this.matHazardYellow
      );
      g.add(hopperLip);
    } else if (type === 'lab') {
      // Hexagonal research console + perimeter accent pylons + geodesic brass dome ribs + dual counter-rotating gyro rings
      const consoleBase = new THREE.Mesh(
        this.getCachedMachineGeo('lab_base', () => {
          const parts: THREE.BufferGeometry[] = [];
          const lowerHex = new THREE.CylinderGeometry(0.98, 1.08, 0.34, 6);
          lowerHex.translate(0, 0.4, 0);
          parts.push(lowerHex);
          const upperCollar = new THREE.CylinderGeometry(0.9, 0.96, 0.18, 12);
          upperCollar.translate(0, 0.64, 0);
          parts.push(upperCollar);
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matSteelLight
      );
      consoleBase.castShadow = true;
      consoleBase.receiveShadow = true;
      g.add(consoleBase);

      const labPylons = new THREE.Mesh(
        this.getCachedMachineGeo('lab_pylons', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (let i = 0; i < 3; i++) {
            const ang = (i * Math.PI * 2) / 3 + Math.PI / 6;
            const tower = new THREE.CylinderGeometry(0.14, 0.22, 0.54, 6);
            tower.translate(Math.cos(ang) * 0.94, 0.64, Math.sin(ang) * 0.94);
            parts.push(tower);
            const emitter = new THREE.CylinderGeometry(0.07, 0.14, 0.2, 6);
            emitter.translate(Math.cos(ang) * 0.94, 1.0, Math.sin(ang) * 0.94);
            parts.push(emitter);
          }
          return mergeSimpleIndexedGeometries(parts);
        }),
        accentMat
      );
      labPylons.castShadow = true;
      g.add(labPylons);
      accentMeshes.push(labPylons);

      // Geodesic brass meridian dome cage
      const domeRibs = new THREE.Mesh(
        this.getCachedMachineGeo('lab_ribs', () => {
          const parts: THREE.BufferGeometry[] = [];
          const eqRing = new THREE.TorusGeometry(0.91, 0.042, 6, 20);
          eqRing.rotateX(Math.PI * 0.5);
          eqRing.translate(0, 0.72, 0);
          parts.push(eqRing);
          for (let i = 0; i < 3; i++) {
            const arc = new THREE.TorusGeometry(0.91, 0.032, 6, 16, Math.PI);
            arc.rotateY((i * Math.PI) / 3);
            arc.translate(0, 0.72, 0);
            parts.push(arc);
          }
          const finial = new THREE.CylinderGeometry(0.08, 0.14, 0.18, 8);
          finial.translate(0, 1.66, 0);
          parts.push(finial);
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matBrass
      );
      g.add(domeRibs);

      const core = new THREE.Mesh(
        this.getCachedMachineGeo('lab_core', () => new THREE.OctahedronGeometry(0.36, 0)),
        this.matLabCoreIdle
      );
      core.position.y = 1.18;
      g.add(core);
      g.userData.labCoreMesh = core;

      const labRingA = new THREE.Mesh(
        this.getCachedMachineGeo('lab_ringA', () => new THREE.TorusGeometry(0.56, 0.036, 6, 20)),
        this.matBrass
      );
      labRingA.position.y = 1.18;
      g.add(labRingA);

      const labRingB = new THREE.Mesh(
        this.getCachedMachineGeo('lab_ringB', () => new THREE.TorusGeometry(0.68, 0.03, 6, 20)),
        this.matCopper
      );
      labRingB.position.y = 1.18;
      g.add(labRingB);

      const dome = new THREE.Mesh(
        this.getCachedMachineGeo(
          'lab_dome',
          () => new THREE.SphereGeometry(0.88, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.54)
        ),
        this.matLabGlass
      );
      dome.position.y = 0.7;
      dome.renderOrder = 3;
      g.add(dome);

      g.userData.spinPart = core;
      g.userData.labRingA = labRingA;
      g.userData.labRingB = labRingB;
    } else if (type === 'splitter') {
      // Sculpted 2x1 dual-lane mechanical sorting bridge + hazard lintels + twin rotating brass sorting capstans
      const halfSpan = CAPYTORIO_TILE_SIZE * 0.5;
      const decks = new THREE.Mesh(
        this.getCachedMachineGeo('split_lane_deck_2x1', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const sx of [-halfSpan, halfSpan]) {
            const lane = new THREE.BoxGeometry(CAPYTORIO_TILE_SIZE * 0.86, 0.14, CAPYTORIO_TILE_SIZE + 0.02);
            lane.translate(sx, 0.07, 0);
            parts.push(lane);
          }
          // Outer side guide walls + recessed dark gear wells atop bridge
          for (const wx of [-CAPYTORIO_TILE_SIZE + 0.18, CAPYTORIO_TILE_SIZE - 0.18]) {
            const wall = new THREE.BoxGeometry(0.14, 0.56, 1.54);
            wall.translate(wx, 0.42, 0);
            parts.push(wall);
          }
          for (const sx of [-halfSpan, halfSpan]) {
            const well = new THREE.CylinderGeometry(0.46, 0.48, 0.08, 12);
            well.translate(sx, 0.92, -0.08);
            parts.push(well);
          }
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matSteelDark
      );
      decks.receiveShadow = true;
      g.add(decks);

      const bridge = new THREE.Mesh(
        this.getCachedMachineGeo('split_bridge_2x1', () => {
          const hull = createChamferedBoxGeometry(CAPYTORIO_TILE_SIZE * 2 - 0.24, 0.58, 1.32, 0.14);
          hull.translate(0, 0.64, 0);
          return hull;
        }),
        accentMat
      );
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      g.add(bridge);
      accentMeshes.push(bridge);

      const centerDivider = new THREE.Mesh(
        this.getCachedMachineGeo('split_divider', () => {
          const wall = createChamferedBoxGeometry(0.32, 0.82, 1.66, 0.06);
          wall.translate(0, 0.56, 0);
          const bar = new THREE.CylinderGeometry(0.08, 0.08, CAPYTORIO_TILE_SIZE * 1.6, 8);
          bar.rotateZ(Math.PI * 0.5);
          bar.translate(0, 0.96, 0.22);
          return mergeSimpleIndexedGeometries([wall, bar]);
        }),
        this.matSteelLight
      );
      centerDivider.castShadow = true;
      g.add(centerDivider);

      const hazardLintels = new THREE.Mesh(
        this.getCachedMachineGeo('split_hazard', () => {
          const front = new THREE.BoxGeometry(CAPYTORIO_TILE_SIZE * 2 - 0.34, 0.18, 0.14);
          front.translate(0, 0.86, -0.66);
          const back = new THREE.BoxGeometry(CAPYTORIO_TILE_SIZE * 2 - 0.34, 0.18, 0.14);
          back.translate(0, 0.86, 0.66);
          return mergeSimpleIndexedGeometries([front, back]);
        }),
        this.matHazardYellow
      );
      g.add(hazardLintels);

      // Twin animated brass sorting gears/capstans on top of each lane
      const rotorGeo = this.getCachedMachineGeo('split_rotor', () =>
        createSpurGearGeometry(6, 0.4, 0.28, 0.09, 0.12)
      );
      const rotorL = new THREE.Mesh(rotorGeo, this.matBrass);
      rotorL.position.set(-halfSpan, 1.0, -0.08);
      g.add(rotorL);

      const rotorR = new THREE.Mesh(rotorGeo, this.matBrass);
      rotorR.position.set(halfSpan, 1.0, -0.08);
      g.add(rotorR);

      g.userData.splitRotorL = rotorL;
      g.userData.splitRotorR = rotorR;
    } else if (type === 'tunnel') {
      // Corrugated ribbed subway tunnel hood + pitch-black subterranean throat + hazard bumper
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
        this.getCachedMachineGeo('tun_arch', () => {
          const parts: THREE.BufferGeometry[] = [];
          const barrel = new THREE.CylinderGeometry(0.84, 0.9, 1.62, 12, 1, false, 0, Math.PI);
          barrel.rotateZ(Math.PI * 0.5);
          barrel.rotateY(Math.PI * 0.5);
          barrel.translate(0, 0.26, 0.08);
          parts.push(barrel);
          // 3 corrugated reinforcement arch ribs
          for (const rz of [-0.56, 0.08, 0.72]) {
            const rib = new THREE.TorusGeometry(0.88, 0.065, 6, 14, Math.PI);
            rib.translate(0, 0.26, rz);
            parts.push(rib);
          }
          // Side foundation skirts
          for (const sx of [-0.88, 0.88]) {
            const skirt = new THREE.BoxGeometry(0.18, 0.36, 1.64);
            skirt.translate(sx, 0.28, 0.08);
            parts.push(skirt);
          }
          return mergeSimpleIndexedGeometries(parts);
        }),
        accentMat
      );
      arch.castShadow = true;
      arch.receiveShadow = true;
      g.add(arch);
      accentMeshes.push(arch);

      const throatVoid = new THREE.Mesh(
        this.getCachedMachineGeo('tun_void', () => {
          const hole = new THREE.CylinderGeometry(0.7, 0.7, 0.14, 12, 1, false, 0, Math.PI);
          hole.rotateZ(Math.PI * 0.5);
          hole.rotateY(Math.PI * 0.5);
          hole.translate(0, 0.24, -0.68);
          // Dark-steel top directional badge plate so hazard chevron pops crisply
          const badgePlate = createChamferedBoxGeometry(0.84, 0.09, 0.88, 0.08);
          badgePlate.translate(0, 1.18, -0.06);
          return mergeSimpleIndexedGeometries([hole, badgePlate]);
        }),
        this.matDarkVoid
      );
      g.add(throatVoid);

      const bumperAndSign = new THREE.Mesh(
        this.getCachedMachineGeo('tun_arrow', () => {
          const bumper = createChamferedBoxGeometry(1.94, 0.2, 0.26, 0.04);
          bumper.translate(0, 0.3, -0.78);
          const arrow = new THREE.ConeGeometry(0.32, 0.62, 4);
          arrow.rotateX(-Math.PI * 0.5);
          arrow.translate(0, 1.32, -0.06);
          return mergeSimpleIndexedGeometries([bumper, arrow]);
        }),
        this.matHazardYellow
      );
      g.add(bumperAndSign);
    } else if (type === 'chest') {
      // Chamfered reinforced supply chest with corner steel brackets, X-braced lid & locking clasp
      const body = new THREE.Mesh(
        this.getCachedMachineGeo('chest_body', () => {
          const parts: THREE.BufferGeometry[] = [];
          const crate = createChamferedBoxGeometry(1.56, 0.84, 1.56, 0.12);
          crate.translate(0, 0.64, 0);
          parts.push(crate);
          // Stamped reinforcement side ribs
          for (const off of [-0.36, 0.36]) {
            const ribZ = new THREE.BoxGeometry(0.12, 0.72, 1.62);
            ribZ.translate(off, 0.64, 0);
            parts.push(ribZ);
            const ribX = new THREE.BoxGeometry(1.62, 0.72, 0.12);
            ribX.translate(0, 0.64, off);
            parts.push(ribX);
          }
          return mergeSimpleIndexedGeometries(parts);
        }),
        accentMat
      );
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      accentMeshes.push(body);

      const brackets = new THREE.Mesh(
        this.getCachedMachineGeo('chest_brackets', () => {
          const parts: THREE.BufferGeometry[] = [];
          for (const cx of [-0.74, 0.74]) {
            for (const cz of [-0.74, 0.74]) {
              const corner = new THREE.BoxGeometry(0.18, 0.88, 0.18);
              corner.translate(cx, 0.65, cz);
              parts.push(corner);
            }
          }
          // Heavy dark-steel lid cross-straps + central lock plate visible from overhead
          const strapX = new THREE.BoxGeometry(1.64, 0.08, 0.22);
          strapX.translate(0, 1.29, 0);
          parts.push(strapX);
          const strapZ = new THREE.BoxGeometry(0.22, 0.08, 1.64);
          strapZ.translate(0, 1.29, 0);
          parts.push(strapZ);
          const centerPlate = createChamferedBoxGeometry(0.46, 0.1, 0.46, 0.06);
          centerPlate.translate(0, 1.31, 0);
          parts.push(centerPlate);
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matSteelDark
      );
      g.add(brackets);

      const lid = new THREE.Mesh(
        this.getCachedMachineGeo('chest_lid', () => {
          const parts: THREE.BufferGeometry[] = [];
          const cap = createChamferedBoxGeometry(1.66, 0.22, 1.66, 0.14);
          cap.translate(0, 1.16, 0);
          parts.push(cap);
          // Front locking clasp latch
          const clasp = new THREE.BoxGeometry(0.28, 0.28, 0.14);
          clasp.translate(0, 1.04, -0.84);
          parts.push(clasp);
          // Twin rear hinge knuckles
          for (const hx of [-0.46, 0.46]) {
            const hinge = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8);
            hinge.rotateZ(Math.PI * 0.5);
            hinge.translate(hx, 1.12, 0.84);
            parts.push(hinge);
          }
          return mergeSimpleIndexedGeometries(parts);
        }),
        this.matBrass
      );
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

  private createGhostMachineGroup(
    type: CapytorioMachineType,
    variantItemId?: string
  ): THREE.Group {
    const primaryMeshes: THREE.Mesh[] = [];
    const accentMeshes: THREE.Mesh[] = [];
    const deckMeshes: THREE.Mesh[] = [];

    if (type === 'belt') {
      const g = new THREE.Group();
      g.userData.machineType = 'belt';
      g.userData.meshKey = 'belt';

      const straight = new THREE.Group();
      const sChassis = new THREE.Mesh(this.beltChassisGeo, this.ghostValidPrimaryMat);
      const sRailL = new THREE.Mesh(this.beltSideRailGeo, this.ghostValidAccentMat);
      sRailL.position.x = -this.beltHalfSpanX;
      const sRailR = new THREE.Mesh(this.beltSideRailGeo, this.ghostValidAccentMat);
      sRailR.position.x = this.beltHalfSpanX;
      const sDeck = new THREE.Mesh(this.beltDeckGeo, this.ghostBeltDeckValidMat);
      straight.add(sChassis, sRailL, sRailR, sDeck);
      primaryMeshes.push(sChassis);
      accentMeshes.push(sRailL, sRailR);
      deckMeshes.push(sDeck);

      const curveLeft = new THREE.Group();
      const clChassis = new THREE.Mesh(this.curvedChassisLeftGeo, this.ghostValidPrimaryMat);
      const clRail = new THREE.Mesh(this.curvedRailLeftGeo, this.ghostValidAccentMat);
      const clDeck = new THREE.Mesh(this.curvedDeckLeftGeo, this.ghostBeltDeckValidMat);
      curveLeft.add(clChassis, clRail, clDeck);
      curveLeft.visible = false;
      primaryMeshes.push(clChassis);
      accentMeshes.push(clRail);
      deckMeshes.push(clDeck);

      const curveRight = new THREE.Group();
      const crChassis = new THREE.Mesh(this.curvedChassisRightGeo, this.ghostValidPrimaryMat);
      const crRail = new THREE.Mesh(this.curvedRailRightGeo, this.ghostValidAccentMat);
      const crDeck = new THREE.Mesh(this.curvedDeckRightGeo, this.ghostBeltDeckValidMat);
      curveRight.add(crChassis, crRail, crDeck);
      curveRight.visible = false;
      primaryMeshes.push(crChassis);
      accentMeshes.push(crRail);
      deckMeshes.push(crDeck);

      g.add(straight, curveLeft, curveRight);
      g.traverse((node) => {
        node.userData.ignoreCameraFade = true;
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          mesh.renderOrder = 6;
        }
      });

      g.userData.ghostPrimaryMeshes = primaryMeshes;
      g.userData.ghostAccentMeshes = accentMeshes;
      g.userData.ghostDeckMeshes = deckMeshes;
      g.userData.beltVariants = { straight, curveLeft, curveRight };
      g.userData.ghostValid = true;
      g.visible = false;
      this.ghostRoot.add(g);
      return g;
    }

    const g = this.createCompositeMachineMesh(type, variantItemId);
    const rawAccentMeshes = (g.userData.accentMeshes as THREE.Mesh[] | undefined) ?? [];
    const accentSet = new Set<THREE.Mesh>(rawAccentMeshes);

    // Pose inserter arm leaning forward toward -Z drop direction so ghost orientation is unmistakable
    if (type === 'inserter' && !g.userData.isSentryTurret) {
      const turret = g.userData.turret as THREE.Group | undefined;
      const shoulder = g.userData.shoulderPivot as THREE.Group | undefined;
      const elbow = g.userData.elbowPivot as THREE.Group | undefined;
      const wrist = g.userData.wristPivot as THREE.Group | undefined;
      if (turret) turret.rotation.y = 0;
      if (shoulder) shoulder.rotation.x = -0.45;
      if (elbow) elbow.rotation.x = 0.78;
      if (wrist) wrist.rotation.x = -0.33;
      const heldMap = g.userData.heldMeshesByShape as
        | Record<CapytorioItemShape, THREE.Mesh>
        | undefined;
      if (heldMap) {
        for (let i = 0; i < CAPYTORIO_ITEM_SHAPES.length; i++) {
          const hm = heldMap[CAPYTORIO_ITEM_SHAPES[i]];
          if (hm) {
            hm.visible = false;
            hm.userData.isGhostHiddenHeld = true;
          }
        }
      }
    }

    // Hide pooled hovering robo-drones inside transparent blueprint ghosts
    const roboDrones = g.userData.roboDrones as THREE.Object3D[] | undefined;
    if (roboDrones) {
      for (let i = 0; i < roboDrones.length; i++) {
        roboDrones[i].visible = false;
      }
    }

    g.traverse((node) => {
      node.userData.ignoreCameraFade = true;
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.renderOrder = 6;
        if (mesh.userData.isGhostHiddenHeld) return;
        const origMat = mesh.material;
        const isAccent =
          accentSet.has(mesh) ||
          origMat === this.matHazardYellow ||
          origMat === this.matBrass ||
          origMat === this.matFurnaceHearthIdle ||
          origMat === this.matGeneratorFireboxIdle ||
          origMat === this.matLabCoreIdle ||
          origMat === this.matStatusLampIdle ||
          origMat === this.matStatusLampOn ||
          origMat === this.matCyanGlow ||
          origMat === this.matEmeraldGlow ||
          origMat === this.matRubyGlow ||
          origMat === this.matCeramicWhite;
        if (isAccent) {
          mesh.material = this.ghostValidAccentMat;
          accentMeshes.push(mesh);
        } else {
          mesh.material = this.ghostValidPrimaryMat;
          primaryMeshes.push(mesh);
        }
      }
    });

    g.userData.ghostPrimaryMeshes = primaryMeshes;
    g.userData.ghostAccentMeshes = accentMeshes;
    g.userData.ghostDeckMeshes = deckMeshes;
    g.userData.ghostValid = true;
    g.visible = false;
    this.ghostRoot.add(g);
    return g;
  }

  private acquireGhostGroup(type: CapytorioMachineType, variantItemId?: string): THREE.Group {
    const meshKey = resolveMachineMeshKey(type, variantItemId);
    let pool = this.ghostPoolByType.get(meshKey);
    if (!pool) {
      pool = [];
      this.ghostPoolByType.set(meshKey, pool);
    }
    const idx = _ghostUsedCountsByKey.get(meshKey) ?? 0;
    _ghostUsedCountsByKey.set(meshKey, idx + 1);
    if (idx < pool.length) {
      return pool[idx];
    }
    const created = this.createGhostMachineGroup(type, variantItemId);
    pool.push(created);
    return created;
  }

  private applyGhostMaterialState(group: THREE.Group, valid: boolean): void {
    if (group.userData.ghostValid === valid) return;
    group.userData.ghostValid = valid;
    const primaryMat = valid ? this.ghostValidPrimaryMat : this.ghostInvalidPrimaryMat;
    const accentMat = valid ? this.ghostValidAccentMat : this.ghostInvalidAccentMat;
    const deckMat = valid ? this.ghostBeltDeckValidMat : this.ghostBeltDeckInvalidMat;

    const primaryMeshes = group.userData.ghostPrimaryMeshes as THREE.Mesh[] | undefined;
    if (primaryMeshes) {
      for (let i = 0; i < primaryMeshes.length; i++) {
        primaryMeshes[i].material = primaryMat;
      }
    }
    const accentMeshes = group.userData.ghostAccentMeshes as THREE.Mesh[] | undefined;
    if (accentMeshes) {
      for (let i = 0; i < accentMeshes.length; i++) {
        accentMeshes[i].material = accentMat;
      }
    }
    const deckMeshes = group.userData.ghostDeckMeshes as THREE.Mesh[] | undefined;
    if (deckMeshes) {
      for (let i = 0; i < deckMeshes.length; i++) {
        deckMeshes[i].material = deckMat;
      }
    }
  }

  private getGhostBeltCurveShape(
    gx: number,
    gz: number,
    dir: CapytorioDirection,
    engine: CapytorioFactoryEngine
  ): 'straight' | 'curveLeft' | 'curveRight' {
    const isFeeder = (nx: number, nz: number, expectedDir: CapytorioDirection): boolean => {
      const key = tileKey(nx, nz);
      const bp = _ghostBeltLookup.get(key);
      if (bp) {
        return bp.dir === expectedDir;
      }
      const world = engine.occupancyGrid.get(key);
      if (!world) return false;
      return (
        (world.type === 'belt' || world.type === 'splitter' || world.type === 'tunnel') &&
        world.dir === expectedDir
      );
    };
    const backDir = ((dir + 2) & 3) as CapytorioDirection;
    if (isFeeder(gx + DIR_DX[backDir], gz + DIR_DZ[backDir], dir)) {
      return 'straight';
    }
    const leftSideDir = ((dir + 3) & 3) as CapytorioDirection;
    const rightSideDir = ((dir + 1) & 3) as CapytorioDirection;
    const fedFromLeft = isFeeder(gx + DIR_DX[leftSideDir], gz + DIR_DZ[leftSideDir], rightSideDir);
    const fedFromRight = isFeeder(gx + DIR_DX[rightSideDir], gz + DIR_DZ[rightSideDir], leftSideDir);
    if (fedFromLeft && !fedFromRight) return 'curveLeft';
    if (fedFromRight && !fedFromLeft) return 'curveRight';
    return 'straight';
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

    // Smoothly dissolve terrain & water deck into Capy-Earth planetary globe only at high orbital altitude (~1.2km..8km)
    const deckAlpha =
      logAlt <= 3.10 ? 1.0 : logAlt >= 3.92 ? 0.0 : 1.0 - (logAlt - 3.10) / (3.92 - 3.10);
    const showGroundDeck = deckAlpha > 0.015;
    this.groundDeck.visible = showGroundDeck;
    this.waterDeck.visible = showGroundDeck;
    this.groundEdgeStrip.visible = false;
    if (showGroundDeck) {
      const wantTransparent = deckAlpha < 0.995;
      if (this.deckMat.transparent !== wantTransparent) {
        this.deckMat.transparent = wantTransparent;
        this.deckMat.needsUpdate = true;
      }
      this.deckMat.opacity = deckAlpha;
      this.deckMat.depthWrite = deckAlpha >= 0.98;
      this.waterMat.opacity = 0.76 * deckAlpha;

      // Adapt vertex spacing with camera altitude so close-up shows exact 1-tile shorelines
      // while zoomed-out strategic view reveals sweeping rivers, lakes, and entire ocean coastlines!
      const lodStep =
        altitudeRadius <= 95 ? 1 : altitudeRadius <= 220 ? 2 : altitudeRadius <= 520 ? 4 : 8;
      const snapTiles = Math.max(4, 4 * lodStep);
      const rawCenterGx = (camX - CAPYTORIO_WORLD_ORIGIN_X) / CAPYTORIO_TILE_SIZE;
      const rawCenterGz = (camZ - CAPYTORIO_WORLD_ORIGIN_Z) / CAPYTORIO_TILE_SIZE;
      const snapGx = Math.round(rawCenterGx / snapTiles) * snapTiles;
      const snapGz = Math.round(rawCenterGz / snapTiles) * snapTiles;

      if (
        snapGx !== this.lastDeckSnapGx ||
        snapGz !== this.lastDeckSnapGz ||
        lodStep !== this.lastDeckLodStep
      ) {
        this.rebuildTerrainDeckGeometry(snapGx, snapGz, lodStep);
      }

      const deckX = capytorioGridToWorldX(snapGx);
      const deckZ = capytorioGridToWorldZ(snapGz);
      this.groundDeck.scale.set(lodStep, 1, lodStep);
      this.groundDeck.position.set(deckX, 0, deckZ);
      this.waterDeck.scale.set(lodStep, 1, lodStep);
      this.waterDeck.position.set(deckX, 0, deckZ);

      if (this.waterTex) {
        const rep = 36 * lodStep;
        if (this.waterTex.repeat.x !== rep) {
          this.waterTex.repeat.set(rep, rep);
        }
        this.waterTex.offset.set((timeSec * 0.042) % 1, (timeSec * 0.026) % 1);
      }
    }

    // Sub-pixel gentle scale-down right as factory disappears into planet surface
    const subPixelShrink = factoryClusterFade < 0.99 ? 0.35 + 0.65 * factoryClusterFade : 1.0;

    // 2. Determine visible tile window around camera target & dirty-cache static ore/tree instanced buffers
    const centerGx = Math.round((camX - CAPYTORIO_WORLD_ORIGIN_X) / CAPYTORIO_TILE_SIZE);
    const centerGz = Math.round((camZ - CAPYTORIO_WORLD_ORIGIN_Z) / CAPYTORIO_TILE_SIZE);
    const terrainTileRadius =
      altitudeRadius > 1100
        ? 0
        : Math.min(34, Math.max(MAX_VISIBLE_RADIUS_TILES, Math.round(altitudeRadius * 0.25)));

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

                const hasDrill = engine.getMachineAt(gx, gz)?.type === 'drill';
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

    // Pulse shared active emissive materials & animate Drop-Pod Beacon once per frame (zero allocations)
    this.matGeneratorFireboxActive.emissiveIntensity = 1.55 + Math.sin(timeSec * 8.0) * 0.35;
    this.matFurnaceHearthActive.emissiveIntensity = 1.65 + Math.sin(timeSec * 6.5) * 0.3;
    if (this.beaconOrb) {
      this.beaconOrb.rotation.y = timeSec * 1.15;
      this.beaconOrb.position.y = 5.38 + Math.sin(timeSec * 2.2) * 0.14;
    }
    if (this.beaconDishRing) {
      this.beaconDishRing.rotation.z = timeSec * 0.72;
      this.beaconDishRing.rotation.y = timeSec * 0.38;
    }

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
    const beltsDirty =
      engine.topologyRevision !== this.lastBeltTopoRev ||
      !Number.isFinite(this.lastBeltCamX) ||
      Math.abs(camX - this.lastBeltCamX) > CAPYTORIO_TILE_SIZE * 2 ||
      Math.abs(camZ - this.lastBeltCamZ) > CAPYTORIO_TILE_SIZE * 2 ||
      Math.abs(maxVisibleMeters - this.lastBeltVisibleMeters) > 4.0 ||
      Math.abs(subPixelShrink - this.lastBeltSubPixel) > 0.004;
    const beltVisibleMeters = maxVisibleMeters + CAPYTORIO_TILE_SIZE * 4;
    if (beltsDirty) {
      this.lastBeltTopoRev = engine.topologyRevision;
      this.lastBeltCamX = camX;
      this.lastBeltCamZ = camZ;
      this.lastBeltVisibleMeters = maxVisibleMeters;
      this.lastBeltSubPixel = subPixelShrink;
    }

    const beltHalfSpanX = CAPYTORIO_TILE_SIZE * 0.88 * 0.5 - 0.055; // 1.045m from tile center
    const renderItemsAtScale = altitudeRadius <= 1800;
    const showAltMode = engine.altModeEnabled && altitudeRadius <= 420;
    this.altModeRoot.visible = showAltMode;
    let altSpriteCount = 0;

    for (const [k, m] of engine.machines) {
      const fp = engine.getMachineFootprint(m);
      const wx = capytorioMachineCenterWorldX(m.gx, fp.width);
      const wz = capytorioMachineCenterWorldZ(m.gz, fp.height);
      const visLimit = m.type === 'belt' ? beltVisibleMeters : maxVisibleMeters;
      if (Math.abs(wx - camX) > visLimit || Math.abs(wz - camZ) > visLimit) {
        continue;
      }

      const fwdDx = DIR_DX[m.dir];
      const fwdDz = DIR_DZ[m.dir];
      const rightDx = -fwdDz;
      const rightDz = fwdDx;
      const rotY = dirToRotY(m.dir);
      const curveShape =
        m.type === 'belt' && (beltsDirty || (renderItemsAtScale && m.beltItems.length > 0))
          ? getBeltCurveShape(engine.occupancyGrid, m)
          : 'straight';

      if (m.type === 'belt') {
        if (!beltsDirty) {
          // Static belt geometry already uploaded; fall through directly to dynamic belt items below
        } else {
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
          const leftNb = engine.getMachineAt(m.gx - rightDx, m.gz - rightDz);
          const leftFeed = Boolean(
            leftNb &&
              (leftNb.type === 'belt' || leftNb.type === 'splitter' || leftNb.type === 'tunnel' || leftNb.type === 'drill') &&
              DIR_DX[leftNb.dir] === rightDx &&
              DIR_DZ[leftNb.dir] === rightDz
          );
          const rightNb = engine.getMachineAt(m.gx + rightDx, m.gz + rightDz);
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
        }
      } else {
        _activeKeysScratch.add(k);
        const meshKey = resolveMachineMeshKey(m.type, m.variantItemId);
        let group = this.activeMachineGroups.get(k);
        if (!group || group.userData.meshKey !== meshKey) {
          if (group) {
            this.releaseMachineGroup(
              (group.userData.meshKey as string) ?? (group.userData.machineType as string),
              group
            );
          }
          group = this.acquireMachineGroup(m.type, m.variantItemId);
          group.userData.meshKey = meshKey;
          group.userData.machineType = m.type;
          this.activeMachineGroups.set(k, group);
          this.root.add(group);
        }

        resolveMachineVisualScale(m.type, m.variantItemId, fp.width, fp.height, _scaleScratch);
        group.position.set(wx, 0, wz);
        group.rotation.y = rotY;
        group.scale.set(
          _scaleScratch[0] * subPixelShrink,
          _scaleScratch[1] * subPixelShrink,
          _scaleScratch[2] * subPixelShrink
        );
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
        if (group.userData.isPumpImpeller && group.userData.spinPart) {
          const impeller = group.userData.spinPart as THREE.Object3D;
          const speed = Math.max(0.25, engine.powerEfficiency);
          impeller.rotation.y = timeSec * 6.0 * speed;
        } else if (group.userData.isSentryTurret && group.userData.turret) {
          const turret = group.userData.turret as THREE.Object3D;
          turret.rotation.y = Math.sin(timeSec * 0.9 + m.id * 1.73) * 0.85;
        } else if (group.userData.isRadarDish) {
          if (group.userData.spinPart) {
            (group.userData.spinPart as THREE.Object3D).rotation.y =
              timeSec * (1.35 * Math.max(0.2, engine.powerEfficiency));
          }
          const roboDrones = group.userData.roboDrones as THREE.Object3D[] | undefined;
          if (roboDrones) {
            const fleet = engine.getRoboportFleetCount(m);
            const activeDrones = fleet < roboDrones.length ? fleet : roboDrones.length;
            for (let di = 0; di < roboDrones.length; di++) {
              const drone = roboDrones[di];
              if (di < activeDrones) {
                drone.visible = true;
                const phase = timeSec * (0.95 + di * 0.22) + di * 1.57 + m.id * 0.43;
                const radius = 0.72 + (di % 2) * 0.24;
                const dx = Math.cos(phase) * radius;
                const dz = Math.sin(phase * 1.5) * (radius * 0.76);
                drone.position.set(dx, 1.55 + Math.sin(phase * 2.1) * 0.14 + di * 0.08, dz);
                drone.rotation.y = Math.atan2(-Math.sin(phase), Math.cos(phase * 1.5) * 1.5);
              } else {
                drone.visible = false;
              }
            }
          }
        } else if (group.userData.isBeaconAntennas) {
          const beaconRate = Math.max(0.25, engine.powerEfficiency);
          const ringA = group.userData.labRingA as THREE.Object3D | undefined;
          const ringB = group.userData.labRingB as THREE.Object3D | undefined;
          const emitter = group.userData.spinPart as THREE.Object3D | undefined;
          if (ringA) {
            ringA.rotation.x = 0.55;
            ringA.rotation.y = timeSec * 2.4 * beaconRate;
          }
          if (ringB) {
            ringB.rotation.z = -0.55;
            ringB.rotation.y = -timeSec * 3.1 * beaconRate;
          }
          if (emitter) {
            emitter.rotation.y = timeSec * 2.0 * beaconRate;
          }
        } else if (m.type === 'drill' && group.userData.spinPart) {
          const auger = group.userData.spinPart as THREE.Object3D;
          const drillSpeed = engine.powerEfficiency;
          auger.rotation.y = timeSec * 5.8 * drillSpeed;
          auger.position.y = 0.88 + (drillSpeed > 0.05 ? Math.sin(timeSec * 14.0) * 0.045 * drillSpeed : 0);
          const lamp = group.userData.statusLamp as THREE.Mesh | undefined;
          if (lamp) {
            const desiredLamp = drillSpeed > 0.05 ? this.matStatusLampOn : this.matStatusLampIdle;
            if (lamp.material !== desiredLamp) lamp.material = desiredLamp;
          }
        } else if (m.type === 'assembler') {
          const isWorking = m.craftProgress > 0.005 || m.recipeId !== null;
          const speedMult = engine.getCraftSpeedMultiplier() * engine.powerEfficiency;
          const spin = timeSec * 3.2 * speedMult * (isWorking ? 1.0 : 0.25);
          if (group.userData.gearA) (group.userData.gearA as THREE.Object3D).rotation.y = spin;
          // Exact 10:8 gear tooth meshing ratio
          if (group.userData.gearB) (group.userData.gearB as THREE.Object3D).rotation.y = -spin * 1.25 + 0.24;
          if (group.userData.pressHead) {
            const pressObj = group.userData.pressHead as THREE.Object3D;
            const stroke = isWorking && speedMult > 0.05 ? Math.pow(Math.max(0, Math.sin(timeSec * 5.2 * speedMult)), 2) : 0;
            pressObj.position.y = 1.66 - stroke * 0.16;
          }
          const lamp = group.userData.statusLamp as THREE.Mesh | undefined;
          if (lamp) {
            const desiredLamp = isWorking && speedMult > 0.05 ? this.matStatusLampOn : this.matStatusLampIdle;
            if (lamp.material !== desiredLamp) lamp.material = desiredLamp;
          }
        } else if (m.type === 'generator') {
          if (group.userData.flywheel) {
            const genRate = m.fuelTimer > 0 ? 7.5 : 1.4;
            const fw = group.userData.flywheel as THREE.Object3D;
            if (group.userData.flywheelAxisZ) {
              fw.rotation.z = timeSec * genRate;
            } else {
              fw.rotation.x = timeSec * genRate;
            }
          }
          if (group.userData.nuclearCore) {
            const pulse = 1 + Math.sin(timeSec * 2.8 + m.id) * 0.032;
            (group.userData.nuclearCore as THREE.Object3D).scale.set(pulse, 1, pulse);
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
          const labActive = m.craftProgress > 0.01;
          const core = group.userData.spinPart as THREE.Object3D;
          core.rotation.y = timeSec * (labActive ? 4.8 : 2.2);
          core.position.y = 1.18 + Math.sin(timeSec * 3.2) * 0.07;
          const ringA = group.userData.labRingA as THREE.Object3D | undefined;
          if (ringA) {
            ringA.rotation.x = timeSec * (labActive ? 2.6 : 1.1);
            ringA.rotation.y = timeSec * (labActive ? 1.8 : 0.7);
          }
          const ringB = group.userData.labRingB as THREE.Object3D | undefined;
          if (ringB) {
            ringB.rotation.x = -timeSec * (labActive ? 1.9 : 0.85) + 0.8;
            ringB.rotation.z = timeSec * (labActive ? 2.4 : 0.95);
          }
          const coreMesh = group.userData.labCoreMesh as THREE.Mesh | undefined;
          if (coreMesh) {
            const desiredMat = labActive ? this.matLabCoreActive : this.matLabCoreIdle;
            if (coreMesh.material !== desiredMat) {
              coreMesh.material = desiredMat;
            }
          }
        } else if (m.type === 'splitter') {
          const splitSpin = this.lastBeltScrollPhase * Math.PI * 2;
          if (group.userData.splitRotorL) {
            (group.userData.splitRotorL as THREE.Object3D).rotation.y = splitSpin;
          }
          if (group.userData.splitRotorR) {
            (group.userData.splitRotorR as THREE.Object3D).rotation.y = -splitSpin;
          }
        } else if (m.type === 'inserter' && group.userData.turret) {
          const turret = group.userData.turret as THREE.Object3D;
          const shoulderPivot = group.userData.shoulderPivot as THREE.Object3D | undefined;
          const elbowPivot = group.userData.elbowPivot as THREE.Object3D | undefined;
          const wristPivot = group.userData.wristPivot as THREE.Object3D | undefined;
          const heldMount = group.userData.heldMount as THREE.Object3D | undefined;
          const reachTiles = getCapytorioInserterReach(m.variantItemId);
          const reachScale = reachTiles === 2 ? LONG_INSERTER_REACH_SCALE : 1.0;
          turret.scale.setScalar(reachScale);
          if (heldMount) {
            heldMount.scale.setScalar(1.0 / reachScale);
          }

          // Compute exact world-local target (tgtX, yWrist, tgtZ) in inserter's local space (-Z forward)
          const phase = m.inserterPhase ?? (m.holdingItem ? 'carrying' : m.armSwing > 0.01 ? 'returning' : 'idle_pickup');
          const defaultDist = reachTiles * CAPYTORIO_TILE_SIZE - 0.15;
          const idleDist = 1.45 * reachScale;
          const px = m.pickupLocalX ?? 0;
          const pz = m.pickupLocalZ ?? defaultDist;
          const dx = m.dropLocalX ?? 0;
          const dz = m.dropLocalZ ?? -defaultDist;

          let tgtX = 0;
          let tgtZ = idleDist;
          let yWrist = 0.96 + (reachScale - 1.0) * 0.45;

          if (phase === 'idle_pickup') {
            const relax = 1.0 - (m.armExtend ?? 0);
            tgtX = px * (1 - relax);
            tgtZ = idleDist + (pz - idleDist) * (1 - relax);
            yWrist = (0.96 + (reachScale - 1.0) * 0.45) - (1 - relax) * 0.54;
          } else if (phase === 'reaching') {
            const eRaw = m.armExtend ?? 0;
            const e = eRaw * eRaw * (3 - 2 * eRaw);
            tgtX = px * e;
            tgtZ = idleDist + (pz - idleDist) * e;
            yWrist = (0.96 + (reachScale - 1.0) * 0.45) + (0.40 - (0.96 + (reachScale - 1.0) * 0.45)) * e;
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
            yWrist = 0.40 + Math.sin(s * Math.PI) * (0.72 * reachScale);
          } else {
            // 'returning': sweep smoothly from drop (1) back to idle hover (0) empty
            const s = m.armSwing < 0 ? 0 : m.armSwing > 1 ? 1 : m.armSwing;
            const aStart = Math.atan2(0, -idleDist);
            const aEnd = Math.atan2(-dx, -dz);
            let da = aEnd - aStart;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            const rStart = idleDist;
            const rEnd = Math.hypot(dx, dz);
            const curAng = aStart + da * s;
            const curRad = rStart + (rEnd - rStart) * s;
            tgtX = -Math.sin(curAng) * curRad;
            tgtZ = -Math.cos(curAng) * curRad;
            yWrist = 0.40 + Math.sin(s * Math.PI) * (0.48 * reachScale) + (1 - s) * 0.56;
          }

          turret.rotation.y = Math.atan2(-tgtX, -tgtZ);

          if (shoulderPivot && elbowPivot && wristPivot) {
            const shoulderWorldY = 0.38 + 0.22 * reachScale;
            const rTarget = Math.max(0.45, Math.min(3.26, Math.hypot(tgtX, tgtZ) / reachScale));
            const dy = (yWrist - shoulderWorldY) / reachScale;
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

          const jawL = group.userData.jawL as THREE.Object3D | undefined;
          const jawR = group.userData.jawR as THREE.Object3D | undefined;
          if (jawL && jawR) {
            const clamped = m.holdingItem !== null;
            jawL.position.x = clamped ? -0.115 : -0.165;
            jawR.position.x = clamped ? 0.115 : 0.165;
            jawL.rotation.z = clamped ? 0.18 : -0.12;
            jawR.rotation.z = clamped ? -0.18 : 0.12;
          }
        } else if (m.type === 'furnace' && group.userData.hearthMesh) {
          const hearthMesh = group.userData.hearthMesh as THREE.Mesh;
          const desiredMat =
            m.craftProgress > 0.01 ? this.matFurnaceHearthActive : this.matFurnaceHearthIdle;
          if (hearthMesh.material !== desiredMat) {
            hearthMesh.material = desiredMat;
          }
        } else if (m.type === 'chest') {
          // Locomotive roof radiator fans (zero allocation)
          if (group.userData.gearA) {
            (group.userData.gearA as THREE.Object3D).rotation.y = timeSec * 4.8;
          }
          if (group.userData.gearB) {
            (group.userData.gearB as THREE.Object3D).rotation.y = -timeSec * 4.8;
          }
        }
      }

      // 3D Alt-Mode pooled badge sprite (zero per-frame allocations)
      if (showAltMode && m.type !== 'belt' && altSpriteCount < MAX_ALT_MODE_SPRITES) {
        if (this.fillAltModeBadge(engine, m)) {
          const sprite = this.getOrCreateAltModeSprite(altSpriteCount);
          const mat = this.getAltModeMaterial(
            _altBadgeScratch.key,
            _altBadgeScratch.label,
            _altBadgeScratch.sub,
            _altBadgeScratch.accent,
            _altBadgeScratch.warn
          );
          if (sprite.material !== mat) {
            sprite.material = mat;
          }
          const span = Math.max(fp.width, fp.height);
          const badgeY = span >= 3 ? 3.55 : span === 2 ? 2.85 : m.type === 'splitter' ? 1.85 : 1.75;
          const badgeSize = (span >= 3 ? 2.15 : span === 2 ? 1.72 : 1.28) * subPixelShrink;
          sprite.position.set(wx, badgeY, wz);
          sprite.scale.set(badgeSize, badgeSize, 1);
          sprite.visible = true;
          altSpriteCount++;
        }
      }

      // Render rigid 1:1 items riding along straight, curved, or 2x1 splitter lanes (zero shape distortion)
      if (renderItemsAtScale && m.beltItems.length > 0) {
        for (let bi = 0; bi < m.beltItems.length; bi++) {
          const bItem = m.beltItems[bi];
          const meta = getCapytorioItemMeta(bItem.item);
          const shape = meta.shape ?? resolveCapytorioItemShape(bItem.item, meta.category);
          const idx = _shapeCounts[shape];
          if (idx >= MAX_SHAPE_ITEM_INSTANCES) continue;

          const lane: 0 | 1 = bItem.lane === 1 ? 1 : 0;
          const edge = bItem.edgeProgress ?? 0;
          let localX: number;
          let localZ: number;
          let tangentYaw: number;
          if (m.type === 'splitter') {
            localX = (lane === 1 ? 1 : -1) * (CAPYTORIO_TILE_SIZE * 0.5);
            localZ = (0.5 - bItem.progress) * CAPYTORIO_TILE_SIZE - edge * 0.42;
            tangentYaw = 0;
          } else {
            evalBeltItemLocalPose(curveShape, lane, bItem.progress, _itemPoseScratch);
            localX = _itemPoseScratch[0];
            localZ = _itemPoseScratch[1] - edge * 0.42;
            tangentYaw = _itemPoseScratch[2];
          }

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

    // Hide unused pooled Alt-Mode sprites
    for (let i = altSpriteCount; i < this.altModeSpritePool.length; i++) {
      this.altModeSpritePool[i].visible = false;
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
        this.releaseMachineGroup(
          (group.userData.meshKey as string) ?? (group.userData.machineType as string),
          group
        );
        this.activeMachineGroups.delete(k);
      }
    }

    if (beltsDirty) {
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
    }

    for (let sIdx = 0; sIdx < CAPYTORIO_ITEM_SHAPES.length; sIdx++) {
      const shape = CAPYTORIO_ITEM_SHAPES[sIdx];
      const inst = this.itemInstancedByShape[shape];
      inst.count = _shapeCounts[shape];
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }

    // 4. Update Cursor Hover Tile, Selection Highlights & Multi-Building Paste Ghost
    const showCursorAndRing = altitudeRadius <= 650;
    const isPasteMode = engine.clipboardToolState === 'paste' && engine.clipboard !== null && engine.clipboard.entries.length > 0;
    const isSelectMode =
      engine.clipboardToolState === 'select_copy' || engine.clipboardToolState === 'select_cut';

    this.cursorGroup.visible = showCursorAndRing && !isPasteMode;
    if (isSelectMode || engine.selectedTool === 'demolish' || engine.selectedTool === 'mine') {
      const hWx = capytorioGridToWorldX(engine.hoveredGx);
      const hWz = capytorioGridToWorldZ(engine.hoveredGz);
      this.cursorGroup.position.set(hWx, 0.01, hWz);
      this.cursorGroup.rotation.y = 0;
      this.ghostBodyMesh.scale.set(1, 1, 1);
      if (isSelectMode) {
        const isCut = engine.clipboardToolState === 'select_cut';
        this.cursorFrameMat.color.setHex(isCut ? 0xf97316 : 0x38bdf8);
        this.cursorFrameMat.emissive.setHex(isCut ? 0xc2410c : 0x0284c7);
      } else if (engine.selectedTool === 'demolish') {
        this.cursorFrameMat.color.setHex(0xef4444);
        this.cursorFrameMat.emissive.setHex(0xdc2626);
      } else {
        this.cursorFrameMat.color.setHex(0xfacc15);
        this.cursorFrameMat.emissive.setHex(0xca8a04);
      }
      this.ghostArrowMesh.visible = false;
    } else {
      const resolvedGhost = resolveCapytorioPlaceableSpec(engine.selectedTool);
      const fp = getCapytorioToolFootprint(engine.selectedTool, engine.selectedDir);
      const anchor = getCapytorioPlacementAnchor(
        engine.hoveredGx,
        engine.hoveredGz,
        engine.selectedTool,
        engine.selectedDir
      );
      const hWx = capytorioMachineCenterWorldX(anchor.gx, fp.width);
      const hWz = capytorioMachineCenterWorldZ(anchor.gz, fp.height);
      this.cursorGroup.position.set(hWx, 0.01, hWz);
      this.cursorGroup.rotation.y = 0;
      this.ghostBodyMesh.scale.set(fp.width, 1, fp.height);
      const arrowOffset = Math.max(fp.width, fp.height) * CAPYTORIO_TILE_SIZE * 0.28;
      this.ghostArrowMesh.position.set(
        DIR_DX[engine.selectedDir] * arrowOffset,
        0.48,
        DIR_DZ[engine.selectedDir] * arrowOffset
      );
      this.ghostArrowMesh.rotation.y = dirToRotY(engine.selectedDir);
      const allowWater = engine.selectedTool === 'offshore_pump';
      const fits = engine.canFootprintFit(
        anchor.gx,
        anchor.gz,
        fp.width,
        fp.height,
        undefined,
        allowWater
      );
      const validDrill =
        allowWater ||
        resolvedGhost?.baseType !== 'drill' ||
        engine.findFirstOreInFootprint(anchor.gx, anchor.gz, fp.width, fp.height) !== null;
      const validPlace = fits && validDrill;
      this.cursorFrameMat.color.setHex(validPlace ? 0x22c55e : 0xef4444);
      this.cursorFrameMat.emissive.setHex(validPlace ? 0x16a34a : 0xb91c1c);
      this.ghostArrowMesh.visible = true;
    }

    // 4b. Pooled 3D Selection Footprint & Transparent 3D Blueprint Ghost Items (zero per-frame allocations)
    this.ghostPoolByType.forEach((_pool, meshKey) => {
      _ghostUsedCountsByKey.set(meshKey, 0);
    });

    let bpTileCount = 0;
    if (showCursorAndRing && isPasteMode && engine.clipboard) {
      this.bpTileMat.opacity = 0.22;
      _blueprintStockScratch.clear();
      _ghostBeltLookup.clear();
      const entries = engine.clipboard.entries;
      const anchorGx = engine.pasteAnchor ? engine.pasteAnchor.gx : engine.hoveredGx;
      const anchorGz = engine.pasteAnchor ? engine.pasteAnchor.gz : engine.hoveredGz;

      // First pass: index belt-compatible blueprint entries (including all tiles of 2x1 splitters)
      for (let i = 0; i < entries.length && i < MAX_BLUEPRINT_GHOST_TILES; i++) {
        const entry = entries[i];
        if (
          entry.baseType === 'belt' ||
          entry.baseType === 'splitter' ||
          entry.baseType === 'tunnel'
        ) {
          const efp = getCapytorioToolFootprint(entry.toolId, entry.dir);
          for (let ox = 0; ox < efp.width; ox++) {
            for (let oz = 0; oz < efp.height; oz++) {
              _ghostBeltLookup.set(tileKey(anchorGx + entry.dx + ox, anchorGz + entry.dz + oz), entry);
            }
          }
        }
      }

      for (let i = 0; i < entries.length && bpTileCount < MAX_BLUEPRINT_GHOST_TILES; i++) {
        const entry = entries[i];
        const gx = anchorGx + entry.dx;
        const gz = anchorGz + entry.dz;
        const efp = getCapytorioToolFootprint(entry.toolId, entry.dir);
        const existingAt = engine.machines.get(tileKey(gx, gz));
        let valid = true;
        if (
          existingAt &&
          existingAt.type === entry.baseType &&
          (entry.baseType === 'assembler' ||
            entry.baseType === 'splitter' ||
            entry.baseType === 'inserter' ||
            entry.baseType === 'chest')
        ) {
          valid = true;
        } else if (
          !engine.canFootprintFit(
            gx,
            gz,
            efp.width,
            efp.height,
            undefined,
            entry.toolId === 'offshore_pump'
          )
        ) {
          valid = false;
        } else {
          if (
            entry.baseType === 'drill' &&
            !engine.findFirstOreInFootprint(gx, gz, efp.width, efp.height)
          ) {
            valid = false;
          } else {
            const spec = resolveCapytorioPlaceableSpec(entry.toolId);
            if (!spec) {
              valid = false;
            } else {
              const stockKey = spec.isBaseMachine ? `m:${spec.baseType}` : `i:${spec.id}`;
              const used = _blueprintStockScratch.get(stockKey) ?? 0;
              const avail = spec.isBaseMachine
                ? engine.getPocketMachineCount(spec.baseType)
                : engine.getPocketItemCount(spec.id);
              if (avail - used < 1) {
                valid = false;
              } else {
                _blueprintStockScratch.set(stockKey, used + 1);
              }
            }
          }
        }
        const wx = capytorioMachineCenterWorldX(gx, efp.width);
        const wz = capytorioMachineCenterWorldZ(gz, efp.height);
        _dummy.position.set(wx, 0.03, wz);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(efp.width, 1, efp.height);
        _dummy.updateMatrix();
        this.blueprintTileInstanced.setMatrixAt(bpTileCount, _dummy.matrix);
        _color.setHex(valid ? 0x22c55e : 0xef4444);
        this.blueprintTileInstanced.setColorAt(bpTileCount, _color);
        bpTileCount++;

        const ghostGroup = this.acquireGhostGroup(entry.baseType, entry.toolId);
        resolveMachineVisualScale(
          entry.baseType,
          entry.toolId,
          efp.width,
          efp.height,
          _scaleScratch
        );
        ghostGroup.position.set(wx, 0, wz);
        ghostGroup.rotation.set(0, dirToRotY(entry.dir), 0);
        ghostGroup.scale.set(
          _scaleScratch[0] * subPixelShrink,
          _scaleScratch[1] * subPixelShrink,
          _scaleScratch[2] * subPixelShrink
        );
        if (entry.baseType === 'belt') {
          const shape = this.getGhostBeltCurveShape(gx, gz, entry.dir, engine);
          const variants = ghostGroup.userData.beltVariants as
            | { straight: THREE.Group; curveLeft: THREE.Group; curveRight: THREE.Group }
            | undefined;
          if (variants) {
            variants.straight.visible = shape === 'straight';
            variants.curveLeft.visible = shape === 'curveLeft';
            variants.curveRight.visible = shape === 'curveRight';
          }
        }
        this.applyGhostMaterialState(ghostGroup, valid);
        ghostGroup.visible = true;
      }
    } else if (showCursorAndRing && isSelectMode && engine.previewSelectedKeys.size > 0) {
      this.bpTileMat.opacity = 0.46;
      const selColor = engine.clipboardToolState === 'select_cut' ? 0xf97316 : 0x38bdf8;
      engine.previewSelectedKeys.forEach((key) => {
        if (bpTileCount >= MAX_BLUEPRINT_GHOST_TILES) return;
        const m = engine.machines.get(key);
        if (!m) return;
        const mfp = engine.getMachineFootprint(m);
        const wx = capytorioMachineCenterWorldX(m.gx, mfp.width);
        const wz = capytorioMachineCenterWorldZ(m.gz, mfp.height);
        _dummy.position.set(wx, 0.08, wz);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(mfp.width, 1, mfp.height);
        _dummy.updateMatrix();
        this.blueprintTileInstanced.setMatrixAt(bpTileCount, _dummy.matrix);
        _color.setHex(selColor);
        this.blueprintTileInstanced.setColorAt(bpTileCount, _color);
        bpTileCount++;
      });
    }

    // Hide any unused pooled transparent 3D ghost models
    this.ghostPoolByType.forEach((pool, meshKey) => {
      const used = _ghostUsedCountsByKey.get(meshKey) ?? 0;
      for (let i = used; i < pool.length; i++) {
        pool[i].visible = false;
      }
    });

    if (bpTileCount > 0 || this.lastBlueprintTileCount > 0) {
      this.blueprintTileInstanced.count = bpTileCount;
      this.blueprintTileInstanced.instanceMatrix.needsUpdate = true;
      if (this.blueprintTileInstanced.instanceColor) {
        this.blueprintTileInstanced.instanceColor.needsUpdate = true;
      }
      this.lastBlueprintTileCount = bpTileCount;
    }

    // 5. Universal Inspected Tile / Entity Selection Halo (scaled to multi-tile footprint)
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
        const inspMachine = engine.getMachineAt(inspGx, inspGz);
        if (inspMachine) {
          const ifp = engine.getMachineFootprint(inspMachine);
          this.inspectRingMesh.visible = true;
          this.inspectRingMesh.position.set(
            capytorioMachineCenterWorldX(inspMachine.gx, ifp.width),
            0.05,
            capytorioMachineCenterWorldZ(inspMachine.gz, ifp.height)
          );
          this.inspectRingMesh.scale.set(
            ifp.width >= 2 ? ifp.width * 0.94 : 1,
            1,
            ifp.height >= 2 ? ifp.height * 0.94 : 1
          );
        } else {
          this.inspectRingMesh.visible = true;
          this.inspectRingMesh.position.set(
            capytorioGridToWorldX(inspGx),
            0.05,
            capytorioGridToWorldZ(inspGz)
          );
          this.inspectRingMesh.scale.set(1, 1, 1);
        }
      } else {
        this.inspectRingMesh.visible = false;
      }
    } else {
      this.inspectRingMesh.visible = false;
    }
  }

  /**
   * Re-samples the 128x128 terrain vertex height & biome color buffers around (snapGx, snapGz)
   * with zero heap allocations. Called ONLY when camera snaps to a new chunk or zoom LOD step.
   */
  private rebuildTerrainDeckGeometry(snapGx: number, snapGz: number, lodStep: number): void {
    this.lastDeckSnapGx = snapGx;
    this.lastDeckSnapGz = snapGz;
    this.lastDeckLodStep = lodStep;

    const posAttr = this.groundDeckGeo.attributes.position as THREE.BufferAttribute;
    const colAttr = this.groundDeckGeo.attributes.color as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;
    const wPosAttr = this.waterDeckGeo.attributes.position as THREE.BufferAttribute;
    const wColAttr = this.waterDeckGeo.attributes.color as THREE.BufferAttribute;
    const wPosArr = wPosAttr.array as Float32Array;
    const wColArr = wColAttr.array as Float32Array;
    const mask = this.waterMaskBuf;

    const cols = TERRAIN_DECK_SEGS + 1;
    const halfSegs = TERRAIN_DECK_SEGS * 0.5;
    const tileStep = lodStep * TERRAIN_DECK_TILES_PER_SEG;

    for (let iz = 0; iz <= TERRAIN_DECK_SEGS; iz++) {
      const gz = snapGz + (iz - halfSegs) * tileStep;
      const rowOffset = iz * cols;
      for (let ix = 0; ix <= TERRAIN_DECK_SEGS; ix++) {
        const gx = snapGx + (ix - halfSegs) * tileStep;
        const sample = sampleCapytorioTerrainDetail(gx, gz, _terrainSampleScratch);
        const vi = rowOffset + ix;
        const pIdx = vi * 3;

        posArr[pIdx + 1] = sample.elevationY;
        mask[vi] = sample.isWater ? 1 : 0;

        let r: number;
        let g: number;
        let b: number;
        let wr = 0.24;
        let wg = 0.72;
        let wb = 0.86;

        if (sample.isWater) {
          const d = sample.waterDepth;
          if (sample.type === 'ocean') {
            const t = Math.min(1, Math.max(0, (d - 0.35) / 0.65));
            r = 0.06 * (1 - t) + 0.02 * t;
            g = 0.32 * (1 - t) + 0.12 * t;
            b = 0.52 * (1 - t) + 0.30 * t;
            wr = 0.10 * (1 - t) + 0.04 * t;
            wg = 0.46 * (1 - t) + 0.24 * t;
            wb = 0.74 * (1 - t) + 0.54 * t;
          } else if (sample.type === 'river') {
            const t = Math.min(1, d);
            r = 0.11 * (1 - t) + 0.06 * t;
            g = 0.48 * (1 - t) + 0.34 * t;
            b = 0.66 * (1 - t) + 0.56 * t;
            wr = 0.18 * (1 - t) + 0.10 * t;
            wg = 0.66 * (1 - t) + 0.52 * t;
            wb = 0.86 * (1 - t) + 0.78 * t;
          } else if (sample.type === 'lake') {
            const t = Math.min(1, d);
            r = 0.09 * (1 - t) + 0.04 * t;
            g = 0.44 * (1 - t) + 0.26 * t;
            b = 0.62 * (1 - t) + 0.48 * t;
            wr = 0.14 * (1 - t) + 0.08 * t;
            wg = 0.60 * (1 - t) + 0.44 * t;
            wb = 0.82 * (1 - t) + 0.72 * t;
          } else {
            const t = Math.min(1, d * 2.1);
            r = 0.34 * (1 - t) + 0.14 * t;
            g = 0.64 * (1 - t) + 0.54 * t;
            b = 0.60 * (1 - t) + 0.64 * t;
            wr = 0.34 * (1 - t) + 0.18 * t;
            wg = 0.82 * (1 - t) + 0.70 * t;
            wb = 0.86 * (1 - t) + 0.86 * t;
          }
        } else {
          // Lush meadow grass with natural organic mottling + smooth warm golden coastal sand beaches
          const mottling =
            Math.sin(gx * 0.17 + 0.4) * Math.cos(gz * 0.15 - 0.7) * 0.5 +
            Math.sin((gx + gz) * 0.07) * 0.5;
          const grassR = 0.275 + mottling * 0.028;
          const grassG = 0.525 + mottling * 0.042;
          const grassB = 0.205 + mottling * 0.018;

          const sb = sample.sandBlend;
          if (sb > 0.001) {
            const wet = sb > 0.75 ? (sb - 0.75) * 0.45 : 0;
            const sandR = 0.87 - wet * 0.18;
            const sandG = 0.77 - wet * 0.16;
            const sandB = 0.52 - wet * 0.14;
            r = grassR + (sandR - grassR) * sb;
            g = grassG + (sandG - grassG) * sb;
            b = grassB + (sandB - grassB) * sb;
          } else {
            r = grassR;
            g = grassG;
            b = grassB;
          }
          // Subtle seafoam highlight on the tucked 1-ring shoreline vertices
          wr = 0.46;
          wg = 0.84;
          wb = 0.88;
        }

        colArr[pIdx] = r;
        colArr[pIdx + 1] = g;
        colArr[pIdx + 2] = b;
        wColArr[pIdx] = wr;
        wColArr[pIdx + 1] = wg;
        wColArr[pIdx + 2] = wb;
      }
    }

    // Pass 2: Place waterDeck at WATER_SURFACE_Y over all water vertices and their 1-ring shoreline edge,
    // and drop strictly dry-land interior vertices to -8.0m so water NEVER depth-bleeds over continents at any zoom!
    for (let iz = 0; iz <= TERRAIN_DECK_SEGS; iz++) {
      const rowOffset = iz * cols;
      const zMin = iz > 0 ? iz - 1 : 0;
      const zMax = iz < TERRAIN_DECK_SEGS ? iz + 1 : TERRAIN_DECK_SEGS;
      for (let ix = 0; ix <= TERRAIN_DECK_SEGS; ix++) {
        const vi = rowOffset + ix;
        let nearWater = mask[vi] === 1;
        if (!nearWater) {
          const xMin = ix > 0 ? ix - 1 : 0;
          const xMax = ix < TERRAIN_DECK_SEGS ? ix + 1 : TERRAIN_DECK_SEGS;
          for (let nz = zMin; nz <= zMax && !nearWater; nz++) {
            const nRow = nz * cols;
            for (let nx = xMin; nx <= xMax; nx++) {
              if (mask[nRow + nx] === 1) {
                nearWater = true;
                break;
              }
            }
          }
        }
        wPosArr[vi * 3 + 1] = nearWater ? WATER_SURFACE_Y : -8.0;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    wPosAttr.needsUpdate = true;
    wColAttr.needsUpdate = true;
    this.groundDeckGeo.computeVertexNormals();

    const tileRepeat = TERRAIN_DECK_BASE_TILES * lodStep;
    if (this.deckTex) {
      this.deckTex.repeat.set(tileRepeat, tileRepeat);
    }
    if (this.deckBumpTex) {
      this.deckBumpTex.repeat.set(tileRepeat, tileRepeat);
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
    this.altModeMatCache.forEach((mat) => mat.dispose());
    this.altModeTexCache.forEach((tex) => tex.dispose());
    this.altModeMatCache.clear();
    this.altModeTexCache.clear();
    this.altModeSpritePool.length = 0;
    this.activeMachineGroups.clear();
    this.inactivePoolByType.clear();
    this.ghostPoolByType.clear();
    this.machineGeoCache.clear();
    this.accentMatCache.clear();
    this.heldItemMatCache.clear();
  }
}
