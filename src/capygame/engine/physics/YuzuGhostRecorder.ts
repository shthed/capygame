export const GHOST_SAMPLE_INTERVAL_SEC = 0.05;
export const GHOST_SAMPLE_DT_MS = 50;
export const GHOST_MAX_FRAMES = 2400; // 120 seconds max at 20 Hz
export const GHOST_STRIDE = 6; // [lxQ, lyQ, lzQ, yawQ, inputPacked, flags]
export const YUZU_GHOST_STORAGE_KEY = 'capy_game_yuzu_ghost_v1';

const POS_QUANT_SCALE = 200; // 5 mm resolution within +/- 163.8 m
const YAW_QUANT_SCALE = 1000; // ~0.001 rad resolution

export interface QuantizedGhostRun {
  version: 1;
  durationMs: number;
  frameCount: number;
  sampleDtMs: number;
  recordedAtIso: string;
  data: number[];
}

export interface GhostPoseScratch {
  x: number;
  y: number;
  z: number;
  yaw: number;
  grounded: boolean;
  moving: boolean;
  jumping: boolean;
  inputX: number;
  inputZ: number;
  finished: boolean;
  progress: number;
}

export function createGhostPoseScratch(): GhostPoseScratch {
  return {
    x: 0,
    y: 0.6,
    z: 0,
    yaw: Math.PI,
    grounded: true,
    moving: false,
    jumping: false,
    inputX: 0,
    inputZ: 0,
    finished: false,
    progress: 0,
  };
}

function clampInt16(v: number): number {
  const r = Math.round(v);
  return r < -32767 ? -32767 : r > 32767 ? 32767 : r;
}

export function normalizeAngleRad(rad: number): number {
  if (!Number.isFinite(rad)) return 0;
  const twoPi = Math.PI * 2;
  let a = ((rad + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  if (a <= -Math.PI) a += twoPi;
  return a;
}

function packSteerInput(ix: number, iz: number): number {
  const qx = Math.max(-15, Math.min(15, Math.round(ix * 15)));
  const qz = Math.max(-15, Math.min(15, Math.round(iz * 15)));
  return (qx + 15) | ((qz + 15) << 5);
}

function unpackSteerX(packed: number): number {
  return ((packed & 31) - 15) / 15;
}

function unpackSteerZ(packed: number): number {
  return (((packed >> 5) & 31) - 15) / 15;
}

/**
 * Zero-allocation 20 Hz quantized input/transform keyframe recorder for Yuzu Mountain runs.
 */
export class YuzuGhostRecorder {
  private readonly buffer = new Int16Array(GHOST_MAX_FRAMES * GHOST_STRIDE);
  private frameCount = 0;
  private nextSampleSec = 0;
  private active = false;

  public startRun(): void {
    this.frameCount = 0;
    this.nextSampleSec = 0;
    this.active = true;
  }

  public stopRun(): void {
    this.active = false;
  }

  public isActive(): boolean {
    return this.active;
  }

  public getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Captures quantized keyframes on fixed 50 ms boundaries without allocating objects.
   */
  public recordTick(
    elapsedSec: number,
    lx: number,
    ly: number,
    lz: number,
    yaw: number,
    inputX: number,
    inputZ: number,
    grounded: boolean,
    moving: boolean,
    jumping: boolean
  ): void {
    if (!this.active || this.frameCount >= GHOST_MAX_FRAMES) return;
    if (elapsedSec + 1e-6 < this.nextSampleSec) return;

    const base = this.frameCount * GHOST_STRIDE;
    this.buffer[base] = clampInt16(lx * POS_QUANT_SCALE);
    this.buffer[base + 1] = clampInt16(ly * POS_QUANT_SCALE);
    this.buffer[base + 2] = clampInt16(lz * POS_QUANT_SCALE);
    this.buffer[base + 3] = clampInt16(normalizeAngleRad(yaw) * YAW_QUANT_SCALE);
    this.buffer[base + 4] = packSteerInput(inputX, inputZ);
    this.buffer[base + 5] = (grounded ? 1 : 0) | (moving ? 2 : 0) | (jumping ? 4 : 0);

    this.frameCount++;
    this.nextSampleSec = this.frameCount * GHOST_SAMPLE_INTERVAL_SEC;
  }

  public finalizeRun(
    durationMs: number,
    endLx: number,
    endLy: number,
    endLz: number,
    endYaw: number
  ): QuantizedGhostRun | null {
    if (!this.active) return null;
    this.active = false;
    if (this.frameCount < 2) return null;

    // Append final summit sample if capacity permits so ghost always crosses the crown line cleanly
    if (this.frameCount < GHOST_MAX_FRAMES) {
      const base = this.frameCount * GHOST_STRIDE;
      this.buffer[base] = clampInt16(endLx * POS_QUANT_SCALE);
      this.buffer[base + 1] = clampInt16(endLy * POS_QUANT_SCALE);
      this.buffer[base + 2] = clampInt16(endLz * POS_QUANT_SCALE);
      this.buffer[base + 3] = clampInt16(normalizeAngleRad(endYaw) * YAW_QUANT_SCALE);
      this.buffer[base + 4] = packSteerInput(0, -1);
      this.buffer[base + 5] = 1 | 2;
      this.frameCount++;
    }

    const sliceLen = this.frameCount * GHOST_STRIDE;
    const data = new Array<number>(sliceLen);
    for (let i = 0; i < sliceLen; i++) {
      data[i] = this.buffer[i];
    }

    return {
      version: 1,
      durationMs: Math.max(100, Math.round(durationMs)),
      frameCount: this.frameCount,
      sampleDtMs: GHOST_SAMPLE_DT_MS,
      recordedAtIso: new Date().toISOString(),
      data,
    };
  }
}

/**
 * Samples a recorded quantized ghost run at `elapsedSec` into `out` with zero heap allocations.
 */
export function sampleGhostRunAtTime(
  run: QuantizedGhostRun,
  elapsedSec: number,
  out: GhostPoseScratch
): boolean {
  const count = run.frameCount;
  if (count <= 0 || run.data.length < count * GHOST_STRIDE) {
    return false;
  }

  const dtSec = Math.max(0.01, (run.sampleDtMs || GHOST_SAMPLE_DT_MS) / 1000);
  const totalSec = Math.max(0.1, run.durationMs / 1000);
  const clampedT = Math.max(0, Math.min(totalSec, elapsedSec));
  const exactIdx = clampedT / dtSec;
  const idx0 = Math.min(count - 1, Math.floor(exactIdx));
  const idx1 = Math.min(count - 1, idx0 + 1);
  const alpha = idx0 === idx1 ? 0 : Math.max(0, Math.min(1, exactIdx - idx0));

  const o0 = idx0 * GHOST_STRIDE;
  const o1 = idx1 * GHOST_STRIDE;

  const x0 = run.data[o0] / POS_QUANT_SCALE;
  const y0 = run.data[o0 + 1] / POS_QUANT_SCALE;
  const z0 = run.data[o0 + 2] / POS_QUANT_SCALE;
  const yaw0 = run.data[o0 + 3] / YAW_QUANT_SCALE;

  const x1 = run.data[o1] / POS_QUANT_SCALE;
  const y1 = run.data[o1 + 1] / POS_QUANT_SCALE;
  const z1 = run.data[o1 + 2] / POS_QUANT_SCALE;
  const yaw1 = run.data[o1 + 3] / YAW_QUANT_SCALE;

  out.x = x0 + (x1 - x0) * alpha;
  out.y = y0 + (y1 - y0) * alpha;
  out.z = z0 + (z1 - z0) * alpha;

  const dYaw = Math.atan2(Math.sin(yaw1 - yaw0), Math.cos(yaw1 - yaw0));
  out.yaw = normalizeAngleRad(yaw0 + dYaw * alpha);

  const packed = run.data[o0 + 4];
  const flags = run.data[o0 + 5];
  out.inputX = unpackSteerX(packed);
  out.inputZ = unpackSteerZ(packed);
  out.grounded = (flags & 1) !== 0;
  out.moving = (flags & 2) !== 0;
  out.jumping = (flags & 4) !== 0;
  out.finished = elapsedSec >= totalSec;
  out.progress = Math.max(0, Math.min(1, elapsedSec / totalSec));
  return true;
}

export function parseAndValidateGhostRun(raw: unknown): QuantizedGhostRun | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<QuantizedGhostRun>;
  if (obj.version !== 1) return null;
  if (typeof obj.durationMs !== 'number' || !Number.isFinite(obj.durationMs) || obj.durationMs < 100) {
    return null;
  }
  if (
    typeof obj.frameCount !== 'number' ||
    !Number.isInteger(obj.frameCount) ||
    obj.frameCount < 2 ||
    obj.frameCount > GHOST_MAX_FRAMES
  ) {
    return null;
  }
  if (!Array.isArray(obj.data) || obj.data.length !== obj.frameCount * GHOST_STRIDE) {
    return null;
  }
  const cleanData = new Array<number>(obj.data.length);
  for (let i = 0; i < obj.data.length; i++) {
    const val = obj.data[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) return null;
    cleanData[i] = clampInt16(val);
  }
  const sampleDtMs =
    typeof obj.sampleDtMs === 'number' && Number.isFinite(obj.sampleDtMs)
      ? Math.max(16, Math.min(250, Math.round(obj.sampleDtMs)))
      : GHOST_SAMPLE_DT_MS;
  return {
    version: 1,
    durationMs: Math.round(obj.durationMs),
    frameCount: obj.frameCount,
    sampleDtMs,
    recordedAtIso:
      typeof obj.recordedAtIso === 'string' && obj.recordedAtIso.length > 0
        ? obj.recordedAtIso
        : new Date().toISOString(),
    data: cleanData,
  };
}

export function loadBestYuzuGhostRun(): QuantizedGhostRun | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(YUZU_GHOST_STORAGE_KEY);
    if (!raw) return null;
    return parseAndValidateGhostRun(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveBestYuzuGhostRunIfFaster(candidate: QuantizedGhostRun): {
  saved: boolean;
  bestRun: QuantizedGhostRun;
} {
  const existing = loadBestYuzuGhostRun();
  if (existing && existing.durationMs <= candidate.durationMs) {
    return { saved: false, bestRun: existing };
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(YUZU_GHOST_STORAGE_KEY, JSON.stringify(candidate));
    }
  } catch {
    // Ignore storage quota errors
  }
  return { saved: true, bestRun: candidate };
}

export function saveYuzuGhostRunDirect(run: QuantizedGhostRun): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(YUZU_GHOST_STORAGE_KEY, JSON.stringify(run));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearBestYuzuGhostRun(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(YUZU_GHOST_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}
