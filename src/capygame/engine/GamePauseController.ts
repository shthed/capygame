export interface GamePauseSnapshot {
  isPaused: boolean;
  pausedAtMs: number | null;
  totalPausedMs: number;
  pauseCount: number;
}

/**
 * Pure deterministic controller for halting/resuming the entire game loop,
 * physics worker, GPU post-processing targets, and Web Audio without dt spikes.
 */
export class GamePauseController {
  private paused: boolean = false;
  private pausedAtMs: number | null = null;
  private totalPausedMs: number = 0;
  private pauseCount: number = 0;

  public get isPaused(): boolean {
    return this.paused;
  }

  public pause(nowMs: number = performance.now()): boolean {
    if (this.paused) return false;
    this.paused = true;
    this.pausedAtMs = Number.isFinite(nowMs) ? nowMs : 0;
    this.pauseCount += 1;
    return true;
  }

  public resume(nowMs: number = performance.now()): { resumed: boolean; pausedDurationMs: number } {
    if (!this.paused) {
      return { resumed: false, pausedDurationMs: 0 };
    }
    const safeNow = Number.isFinite(nowMs) ? nowMs : 0;
    const duration =
      this.pausedAtMs !== null ? Math.max(0, safeNow - this.pausedAtMs) : 0;
    this.totalPausedMs += duration;
    this.paused = false;
    this.pausedAtMs = null;
    return { resumed: true, pausedDurationMs: duration };
  }

  public toggle(nowMs: number = performance.now()): boolean {
    if (this.paused) {
      this.resume(nowMs);
      return false;
    }
    this.pause(nowMs);
    return true;
  }

  public getSnapshot(): GamePauseSnapshot {
    return {
      isPaused: this.paused,
      pausedAtMs: this.pausedAtMs,
      totalPausedMs: this.totalPausedMs,
      pauseCount: this.pauseCount,
    };
  }
}
