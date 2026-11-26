import type { CapytorioItemShape, CapytorioMachineType } from './CapytorioData';

export type CapytorioAltIconKind =
  | 'item'
  | 'machine'
  | 'warn_power'
  | 'warn_fuel'
  | 'warn_ore'
  | 'water'
  | 'lab_science'
  | 'radar'
  | 'beacon'
  | 'roboport'
  | 'prio_split'
  | 'long_inserter'
  | 'stack_cap'
  | 'chest_cap';

export interface CapytorioAltBadgeSpec {
  key: string;
  iconKind: CapytorioAltIconKind;
  itemShape: CapytorioItemShape;
  machineType: CapytorioMachineType | '';
  variantItemId: string;
  accentCss: string;
  warn: boolean;
  blacklist: boolean;
}

function fillStrokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | null,
  stroke: string | null,
  lineWidth: number = 1.4
): void {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  pts: ReadonlyArray<readonly [number, number]>,
  fill: string | null,
  stroke: string | null,
  lineWidth: number = 1.4
): void {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function drawItemShapeIcon(
  ctx: CanvasRenderingContext2D,
  shape: CapytorioItemShape,
  color: string
): void {
  const ink = '#0d1017';
  switch (shape) {
    case 'ore': {
      drawPolygon(
        ctx,
        [
          [7, 17],
          [4.5, 11],
          [9.5, 6.2],
          [15.2, 7.8],
          [17.5, 14],
          [13, 18.6],
        ],
        color,
        ink,
        1.45
      );
      drawPolygon(
        ctx,
        [
          [12.4, 18.2],
          [11, 12.6],
          [16, 10.4],
          [19.6, 14.5],
          [17, 18.6],
        ],
        color,
        ink,
        1.35
      );
      ctx.save();
      ctx.globalAlpha = 0.34;
      drawPolygon(
        ctx,
        [
          [9.5, 6.2],
          [12, 11],
          [7.2, 11.4],
        ],
        '#ffffff',
        null
      );
      ctx.restore();
      break;
    }
    case 'plate': {
      drawPolygon(
        ctx,
        [
          [3.8, 14.4],
          [9, 6.8],
          [20.2, 7.4],
          [15.6, 16.4],
        ],
        color,
        ink,
        1.45
      );
      ctx.save();
      ctx.globalAlpha = 0.55;
      drawPolygon(
        ctx,
        [
          [3.8, 14.4],
          [15.6, 16.4],
          [15.6, 19.0],
          [3.8, 17.0],
        ],
        '#141820',
        ink,
        1.1
      );
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(8.6, 9.6);
      ctx.lineTo(16.6, 10.0);
      ctx.strokeStyle = 'rgba(255,255,255,0.48)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
    }
    case 'gear': {
      const teeth = 8;
      const cx = 12;
      const cy = 12;
      const rOut = 9.0;
      const rIn = 6.5;
      ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a0 = (i / teeth) * Math.PI * 2;
        const a1 = ((i + 0.24) / teeth) * Math.PI * 2;
        const a2 = ((i + 0.52) / teeth) * Math.PI * 2;
        const a3 = ((i + 0.76) / teeth) * Math.PI * 2;
        const p0x = cx + Math.cos(a0) * rIn;
        const p0y = cy + Math.sin(a0) * rIn;
        if (i === 0) ctx.moveTo(p0x, p0y);
        else ctx.lineTo(p0x, p0y);
        ctx.lineTo(cx + Math.cos(a1) * rOut, cy + Math.sin(a1) * rOut);
        ctx.lineTo(cx + Math.cos(a2) * rOut, cy + Math.sin(a2) * rOut);
        ctx.lineTo(cx + Math.cos(a3) * rIn, cy + Math.sin(a3) * rIn);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 3.3, 0, Math.PI * 2);
      ctx.fillStyle = '#141822';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      break;
    }
    case 'circuit': {
      fillStrokeRoundedRect(ctx, 4, 4.4, 16, 15.2, 1.6, color, ink, 1.45);
      fillStrokeRoundedRect(ctx, 8.4, 8.4, 7.2, 7.2, 0.9, '#181c24', '#f4b054', 1.15);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      const ys = [7, 12, 17];
      for (let i = 0; i < ys.length; i++) {
        const y = ys[i];
        ctx.beginPath();
        ctx.moveTo(6.1, y);
        ctx.lineTo(8.3, y);
        ctx.moveTo(15.7, y);
        ctx.lineTo(17.9, y);
        ctx.stroke();
      }
      break;
    }
    case 'science': {
      ctx.beginPath();
      ctx.moveTo(9.5, 4.2);
      ctx.lineTo(14.5, 4.2);
      ctx.lineTo(14.5, 8.6);
      ctx.lineTo(18.8, 17.6);
      ctx.quadraticCurveTo(19.3, 19.6, 17.3, 19.6);
      ctx.lineTo(6.7, 19.6);
      ctx.quadraticCurveTo(4.7, 19.6, 5.2, 17.6);
      ctx.lineTo(9.5, 8.6);
      ctx.closePath();
      ctx.fillStyle = '#202632';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.45;
      ctx.lineJoin = 'round';
      ctx.stroke();

      drawPolygon(
        ctx,
        [
          [7.6, 13.4],
          [16.4, 13.4],
          [18.2, 18.6],
          [5.8, 18.6],
        ],
        color,
        null
      );
      fillStrokeRoundedRect(ctx, 8.4, 2.9, 7.2, 2.2, 0.6, '#d4d7de', ink, 1.05);
      ctx.beginPath();
      ctx.arc(10.5, 16.0, 1.15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fill();
      break;
    }
    case 'coil': {
      ctx.beginPath();
      ctx.arc(12, 12, 7.3, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.05;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(12, 12, 4.1, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(12, 12, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = '#141822';
      ctx.fill();
      break;
    }
    case 'fruit': {
      ctx.beginPath();
      ctx.arc(12, 13.2, 6.8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.45;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(12, 6.5);
      ctx.quadraticCurveTo(13.2, 3.6, 16.2, 3.6);
      ctx.quadraticCurveTo(15.2, 6.3, 12, 6.5);
      ctx.closePath();
      ctx.fillStyle = '#45b649';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(9.6, 11.0, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.36)';
      ctx.fill();
      break;
    }
    case 'battery': {
      fillStrokeRoundedRect(ctx, 5.4, 6.5, 13.2, 13.0, 1.6, color, ink, 1.45);
      fillStrokeRoundedRect(ctx, 7.4, 3.8, 3.1, 2.9, 0.5, '#e2e8f0', ink, 1.05);
      fillStrokeRoundedRect(ctx, 13.5, 3.8, 3.1, 2.9, 0.5, '#f59e0b', ink, 1.05);
      drawPolygon(
        ctx,
        [
          [12.7, 9.0],
          [9.8, 13.3],
          [11.9, 13.3],
          [11.1, 17.0],
          [14.4, 12.5],
          [12.2, 12.5],
        ],
        '#fef08a',
        ink,
        0.75
      );
      break;
    }
    case 'ammo': {
      drawPolygon(
        ctx,
        [
          [5.4, 18.6],
          [7.2, 7.5],
          [16.8, 7.5],
          [18.6, 18.6],
        ],
        '#334155',
        ink,
        1.45
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.75;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(8.5, 7.5);
      ctx.lineTo(9.5, 4.1);
      ctx.lineTo(10.5, 7.5);
      ctx.moveTo(11.5, 7.5);
      ctx.lineTo(12, 3.9);
      ctx.lineTo(12.5, 7.5);
      ctx.moveTo(13.5, 7.5);
      ctx.lineTo(14.5, 4.1);
      ctx.lineTo(15.5, 7.5);
      ctx.stroke();
      fillStrokeRoundedRect(ctx, 7.5, 11.0, 9.0, 4.2, 0.6, color, ink, 1.05);
      break;
    }
    case 'grenade': {
      ctx.beginPath();
      ctx.arc(11.5, 13.5, 5.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.45;
      ctx.stroke();

      fillStrokeRoundedRect(ctx, 9.8, 5.4, 3.4, 2.7, 0.5, '#94a3b8', ink, 1.05);
      ctx.beginPath();
      ctx.moveTo(13.2, 6.2);
      ctx.lineTo(16.5, 6.2);
      ctx.lineTo(18.0, 11.5);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(7.8, 6.2, 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;
    }
    case 'armor': {
      drawPolygon(
        ctx,
        [
          [6.5, 6.5],
          [9.5, 4.8],
          [14.5, 4.8],
          [17.5, 6.5],
          [19.5, 10],
          [16.8, 11.8],
          [16, 19],
          [8, 19],
          [7.2, 11.8],
          [4.5, 10],
        ],
        color,
        ink,
        1.45
      );
      drawPolygon(
        ctx,
        [
          [9.5, 8.5],
          [14.5, 8.5],
          [14.5, 13.5],
          [12, 15.5],
          [9.5, 13.5],
        ],
        '#1e293b',
        '#cbd5e1',
        0.95
      );
      break;
    }
    case 'engine': {
      fillStrokeRoundedRect(ctx, 5, 9, 14, 9, 1.4, color, ink, 1.45);
      drawPolygon(
        ctx,
        [
          [7, 9],
          [9, 5.4],
          [11.5, 5.4],
          [11.5, 9],
        ],
        '#94a3b8',
        ink,
        1.2
      );
      drawPolygon(
        ctx,
        [
          [17, 9],
          [15, 5.4],
          [12.5, 5.4],
          [12.5, 9],
        ],
        '#94a3b8',
        ink,
        1.2
      );
      ctx.beginPath();
      ctx.arc(12, 13.5, 2.7, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.15;
      ctx.stroke();
      break;
    }
    case 'barrel': {
      fillStrokeRoundedRect(ctx, 6, 4.4, 12, 15.2, 2.0, color, ink, 1.45);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.85;
      ctx.beginPath();
      ctx.moveTo(5.5, 9.2);
      ctx.lineTo(18.5, 9.2);
      ctx.moveTo(5.5, 14.8);
      ctx.lineTo(18.5, 14.8);
      ctx.stroke();
      break;
    }
    case 'brick': {
      drawPolygon(
        ctx,
        [
          [4, 13.5],
          [9.5, 7.4],
          [20, 7.4],
          [14.5, 13.5],
        ],
        color,
        ink,
        1.35
      );
      drawPolygon(
        ctx,
        [
          [4, 13.5],
          [14.5, 13.5],
          [14.5, 17.6],
          [4, 17.6],
        ],
        color,
        ink,
        1.35
      );
      drawPolygon(
        ctx,
        [
          [14.5, 13.5],
          [20, 7.4],
          [20, 11.5],
          [14.5, 17.6],
        ],
        '#252932',
        ink,
        1.25
      );
      break;
    }
    case 'module': {
      fillStrokeRoundedRect(ctx, 5, 4.4, 14, 15.2, 1.6, '#232730', ink, 1.45);
      fillStrokeRoundedRect(ctx, 7.5, 7, 9, 8, 1.0, color, ink, 1.1);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8, 17.5);
      ctx.lineTo(10, 17.5);
      ctx.moveTo(11, 17.5);
      ctx.lineTo(13, 17.5);
      ctx.moveTo(14, 17.5);
      ctx.lineTo(16, 17.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, 11, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
      break;
    }
    case 'crate':
    default: {
      fillStrokeRoundedRect(ctx, 4.5, 4.5, 15, 15, 1.6, color, ink, 1.45);
      ctx.strokeStyle = 'rgba(13,16,23,0.5)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(6.5, 6.5);
      ctx.lineTo(17.5, 17.5);
      ctx.moveTo(17.5, 6.5);
      ctx.lineTo(6.5, 17.5);
      ctx.stroke();
      fillStrokeRoundedRect(ctx, 7.2, 7.2, 9.6, 9.6, 0.8, null, 'rgba(13,16,23,0.55)', 1.1);
      break;
    }
  }
}

function drawMachineShapeIcon(
  ctx: CanvasRenderingContext2D,
  machineType: CapytorioMachineType | '',
  variantItemId: string,
  color: string
): void {
  const ink = '#0d1017';
  if (variantItemId === 'solar_panel') {
    drawPolygon(
      ctx,
      [
        [4.5, 6],
        [19.5, 6],
        [21, 17.5],
        [3, 17.5],
      ],
      '#1d4ed8',
      ink,
      1.45
    );
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    ctx.moveTo(8.5, 6);
    ctx.lineTo(7.5, 17.5);
    ctx.moveTo(12, 6);
    ctx.lineTo(12, 17.5);
    ctx.moveTo(15.5, 6);
    ctx.lineTo(16.5, 17.5);
    ctx.moveTo(4, 10);
    ctx.lineTo(20, 10);
    ctx.moveTo(3.5, 14);
    ctx.lineTo(20.5, 14);
    ctx.stroke();
    return;
  }
  if (variantItemId === 'accumulator') {
    fillStrokeRoundedRect(ctx, 5, 6, 14, 14, 2.2, '#2b313c', ink, 1.45);
    fillStrokeRoundedRect(ctx, 7, 9, 10, 2.4, 0.7, '#38bdf8', null);
    fillStrokeRoundedRect(ctx, 7, 13.6, 10, 2.4, 0.7, '#38bdf8', null);
    fillStrokeRoundedRect(ctx, 7.5, 3.4, 2.8, 3, 0.5, '#f59e0b', ink, 1.05);
    fillStrokeRoundedRect(ctx, 13.7, 3.4, 2.8, 3, 0.5, '#f59e0b', ink, 1.05);
    return;
  }
  if (variantItemId === 'nuclear_reactor') {
    fillStrokeRoundedRect(ctx, 3.5, 4.5, 17, 15, 2, '#374151', ink, 1.45);
    ctx.beginPath();
    ctx.arc(12, 12, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 12, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#a7f3d0';
    ctx.fill();
    return;
  }
  if (variantItemId === 'small_electric_pole' || variantItemId === 'medium_electric_pole' || variantItemId === 'big_electric_pole') {
    fillStrokeRoundedRect(ctx, 10.4, 4.2, 3.2, 16.4, 0.8, '#8b5a2b', ink, 1.35);
    fillStrokeRoundedRect(ctx, 4.8, 6.8, 14.4, 2.6, 0.6, color, ink, 1.15);
    ctx.beginPath();
    ctx.arc(6.8, 6.0, 1.5, 0, Math.PI * 2);
    ctx.arc(17.2, 6.0, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    return;
  }
  if (variantItemId === 'stone_wall' || variantItemId === 'gate') {
    drawPolygon(
      ctx,
      [
        [3.5, 8.8],
        [3.5, 5.4],
        [7.5, 5.4],
        [7.5, 8],
        [10.2, 8],
        [10.2, 5.4],
        [13.8, 5.4],
        [13.8, 8],
        [16.5, 8],
        [16.5, 5.4],
        [20.5, 5.4],
        [20.5, 19.5],
        [3.5, 19.5],
      ],
      '#7c8594',
      ink,
      1.4
    );
    return;
  }

  switch (machineType) {
    case 'belt': {
      fillStrokeRoundedRect(ctx, 3.5, 4.5, 17, 15, 2, '#333b48', ink, 1.45);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(7.5, 8.2);
      ctx.lineTo(12, 12);
      ctx.lineTo(7.5, 15.8);
      ctx.moveTo(12.8, 8.2);
      ctx.lineTo(17.3, 12);
      ctx.lineTo(12.8, 15.8);
      ctx.stroke();
      break;
    }
    case 'inserter': {
      fillStrokeRoundedRect(ctx, 5.5, 14.5, 13, 5, 1.2, '#3a4252', ink, 1.4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(12, 15.5);
      ctx.lineTo(7.8, 9.2);
      ctx.lineTo(15.6, 5.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(16.6, 5.2, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      break;
    }
    case 'furnace': {
      fillStrokeRoundedRect(ctx, 4.5, 4.5, 15, 15, 2.5, '#6b5c52', ink, 1.45);
      ctx.beginPath();
      ctx.arc(12, 13, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, 13.6, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.fill();
      break;
    }
    case 'drill': {
      fillStrokeRoundedRect(ctx, 4.5, 4.2, 15, 10.5, 1.5, color, ink, 1.4);
      drawPolygon(
        ctx,
        [
          [7, 14.7],
          [17, 14.7],
          [12, 20.4],
        ],
        '#cbd5e1',
        ink,
        1.35
      );
      break;
    }
    case 'assembler': {
      fillStrokeRoundedRect(ctx, 4, 4.5, 16, 15, 2.2, color, ink, 1.45);
      ctx.save();
      ctx.translate(12, 12);
      ctx.scale(0.55, 0.55);
      ctx.translate(-12, -12);
      drawItemShapeIcon(ctx, 'gear', '#e2e8f0');
      ctx.restore();
      break;
    }
    case 'splitter': {
      fillStrokeRoundedRect(ctx, 3.2, 6, 17.6, 12, 1.6, '#363f4d', ink, 1.4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(8, 15.2);
      ctx.lineTo(8, 8.8);
      ctx.moveTo(16, 15.2);
      ctx.lineTo(16, 8.8);
      ctx.moveTo(5.6, 11.2);
      ctx.lineTo(8, 8.5);
      ctx.lineTo(10.4, 11.2);
      ctx.moveTo(13.6, 11.2);
      ctx.lineTo(16, 8.5);
      ctx.lineTo(18.4, 11.2);
      ctx.stroke();
      break;
    }
    case 'tunnel': {
      fillStrokeRoundedRect(ctx, 4, 5.5, 16, 13, 2, '#2d3442', ink, 1.45);
      fillStrokeRoundedRect(ctx, 4, 15.5, 16, 3.4, 0.8, color, ink, 1.1);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(12, 8.5);
      ctx.lineTo(12, 14.0);
      ctx.moveTo(9.4, 11.6);
      ctx.lineTo(12, 14.2);
      ctx.lineTo(14.6, 11.6);
      ctx.stroke();
      break;
    }
    case 'lab': {
      drawItemShapeIcon(ctx, 'science', '#a855f7');
      break;
    }
    case 'generator': {
      fillStrokeRoundedRect(ctx, 3.5, 6.5, 17, 11, 2.2, '#475569', ink, 1.45);
      drawPolygon(
        ctx,
        [
          [13, 7.6],
          [9.2, 12.6],
          [11.8, 12.6],
          [10.8, 16.6],
          [14.8, 11.4],
          [12.2, 11.4],
        ],
        '#facc15',
        ink,
        0.9
      );
      break;
    }
    case 'chest':
    default: {
      fillStrokeRoundedRect(ctx, 4.2, 5.2, 15.6, 13.6, 1.6, color, ink, 1.45);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(4.2, 9.6);
      ctx.lineTo(19.8, 9.6);
      ctx.stroke();
      fillStrokeRoundedRect(ctx, 10, 8, 4, 3.4, 0.6, '#f4b054', ink, 1.0);
      break;
    }
  }
}

function drawRedSlashOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.arc(12, 12, 8.8, 0, Math.PI * 2);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5.8, 5.8);
  ctx.lineTo(18.2, 18.2);
  ctx.strokeStyle = '#0d1017';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.0;
  ctx.stroke();
}

/**
 * Renders a crisp, Factorio-style icon-only Alt-Mode overlay badge onto a 2D canvas.
 * Zero text labels are drawn — only recognizable item, machine, or alert icons.
 */
export function drawCapytorioAltBadgeToCanvas(
  ctx: CanvasRenderingContext2D,
  size: number,
  spec: CapytorioAltBadgeSpec
): void {
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const half = size * 0.5;
  const radius = size * 0.43;

  // Clean subtle dark translucent medallion so icons pop cleanly over any machine roof
  const bgGrad = ctx.createRadialGradient(
    half,
    half * 0.85,
    size * 0.06,
    half,
    half,
    radius
  );
  if (spec.warn) {
    bgGrad.addColorStop(0, 'rgba(72, 16, 18, 0.90)');
    bgGrad.addColorStop(1, 'rgba(28, 7, 10, 0.88)');
  } else {
    bgGrad.addColorStop(0, 'rgba(24, 30, 42, 0.84)');
    bgGrad.addColorStop(1, 'rgba(9, 13, 21, 0.86)');
  }

  ctx.beginPath();
  ctx.arc(half, half, radius, 0, Math.PI * 2);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Crisp subtle metallic bezel ring (no loud neon stroke)
  ctx.lineWidth = Math.max(3, size * 0.024);
  ctx.strokeStyle = spec.warn ? 'rgba(248, 113, 113, 0.92)' : 'rgba(148, 163, 184, 0.52)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(half, half, radius - size * 0.026, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1.5, size * 0.01);
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.stroke();

  // Map 24x24 icon coordinate space cleanly centered inside the medallion
  ctx.save();
  const iconSpan = size * 0.68;
  const scale = iconSpan / 20;
  ctx.translate(half - 12 * scale, half - 12 * scale);
  ctx.scale(scale, scale);

  const ink = '#0d1017';
  switch (spec.iconKind) {
    case 'item':
      drawItemShapeIcon(ctx, spec.itemShape, spec.accentCss);
      if (spec.blacklist) {
        drawRedSlashOverlay(ctx);
      }
      break;
    case 'machine':
      drawMachineShapeIcon(ctx, spec.machineType, spec.variantItemId, spec.accentCss);
      if (spec.blacklist) {
        drawRedSlashOverlay(ctx);
      }
      break;
    case 'warn_power':
      drawPolygon(
        ctx,
        [
          [13.4, 3.8],
          [7.4, 13.0],
          [11.6, 13.0],
          [10.2, 20.2],
          [16.8, 10.6],
          [12.4, 10.6],
        ],
        '#facc15',
        ink,
        1.35
      );
      drawRedSlashOverlay(ctx);
      break;
    case 'warn_fuel':
      ctx.beginPath();
      ctx.moveTo(12, 4.2);
      ctx.quadraticCurveTo(17.6, 10.6, 17.0, 15.2);
      ctx.quadraticCurveTo(16.4, 19.6, 12, 19.6);
      ctx.quadraticCurveTo(7.6, 19.6, 7.0, 15.2);
      ctx.quadraticCurveTo(6.4, 10.6, 12, 4.2);
      ctx.closePath();
      ctx.fillStyle = '#f97316';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      drawRedSlashOverlay(ctx);
      break;
    case 'warn_ore':
      drawItemShapeIcon(ctx, 'ore', '#f59e0b');
      drawRedSlashOverlay(ctx);
      break;
    case 'water':
      ctx.beginPath();
      ctx.moveTo(12, 4.0);
      ctx.quadraticCurveTo(17.8, 11.2, 17.2, 15.4);
      ctx.quadraticCurveTo(16.6, 19.8, 12, 19.8);
      ctx.quadraticCurveTo(7.4, 19.8, 6.8, 15.4);
      ctx.quadraticCurveTo(6.2, 11.2, 12, 4.0);
      ctx.closePath();
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(10.0, 14.2, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
      break;
    case 'lab_science':
      drawItemShapeIcon(ctx, 'science', '#a855f7');
      break;
    case 'radar':
      drawPolygon(
        ctx,
        [
          [7, 19.6],
          [10, 13.2],
          [14, 13.2],
          [17, 19.6],
        ],
        '#475569',
        ink,
        1.35
      );
      ctx.beginPath();
      ctx.arc(12, 9.6, 5.2, Math.PI * 1.15, Math.PI * 1.95);
      ctx.lineTo(12, 13.0);
      ctx.closePath();
      ctx.fillStyle = '#cbd5e1';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(14.5, 7.2, 1.7, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      break;
    case 'beacon':
      fillStrokeRoundedRect(ctx, 4.5, 13.5, 15, 6, 1.2, '#334155', ink, 1.4);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(12, 9.4, 6.0, 2.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, 9.4, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      break;
    case 'roboport':
      fillStrokeRoundedRect(ctx, 4.5, 11.5, 15, 8, 1.4, '#334155', ink, 1.4);
      ctx.beginPath();
      ctx.arc(12, 8.2, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = '#fb923c';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(6.2, 7.4);
      ctx.lineTo(9.2, 7.4);
      ctx.moveTo(14.8, 7.4);
      ctx.lineTo(17.8, 7.4);
      ctx.stroke();
      break;
    case 'prio_split':
      drawMachineShapeIcon(ctx, 'splitter', '', '#facc15');
      break;
    case 'long_inserter':
      drawMachineShapeIcon(ctx, 'inserter', '', '#ef4444');
      break;
    case 'stack_cap':
      drawMachineShapeIcon(ctx, 'inserter', '', '#38bdf8');
      break;
    case 'chest_cap':
      drawMachineShapeIcon(ctx, 'chest', '', '#ef4444');
      break;
  }

  ctx.restore();
}
