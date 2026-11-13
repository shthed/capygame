import {
  PerformanceAnalysisSnapshot,
  ProfilerActionEvent,
  ProfilerModuleMetric,
  ProfilerPhaseId,
} from './GpuEngineTypes';

export const PROFILER_PHASES: readonly ProfilerPhaseId[] = [
  'input_camera',
  'physics_bridge',
  'biomechanics',
  'world_simulation',
  'district_gameplay',
  'cosmic_universe',
  'chrono_vessel',
  'vfx_particles',
  'sightline_occlusion',
  'scene_graph_matrices',
  'gpu_shadow_cascade',
  'gpu_render_submit',
  'telemetry_hud',
] as const;

export const PROFILER_PHASE_LABELS: Record<ProfilerPhaseId, string> = {
  input_camera: 'Input & Camera Orbit',
  physics_bridge: 'Rapier3D & Physics Bridge',
  biomechanics: 'Capy-Snake & Foot Kinematics',
  world_simulation: 'Day/Night, Water & Flora',
  district_gameplay: 'Active District Logic',
  cosmic_universe: 'Cosmic Scales & N-Body SPH',
  chrono_vessel: 'Chrono-Vessel Rig & Optics',
  vfx_particles: 'GPU Particles & Sun Motes',
  sightline_occlusion: 'Sightline Ray Occlusion',
  scene_graph_matrices: 'Scene Matrix Transforms',
  gpu_shadow_cascade: 'Shadow Cascade Rig',
  gpu_render_submit: 'GPU Render & Post-FX Passes',
  telemetry_hud: 'Governor & HUD Telemetry',
};

const PHASE_COUNT = PROFILER_PHASES.length;
const HISTORY_LEN = 60;
const MAX_EVENTS = 24;

export class PerformanceProfiler {
  private enabled = false;
  private readonly startTimestampMs: number;

  // Zero-allocation per-frame timing storage
  private readonly phaseStartTimes = new Float64Array(PHASE_COUNT);
  private readonly curFrameMs = new Float32Array(PHASE_COUNT);
  private readonly history = new Float32Array(PHASE_COUNT * HISTORY_LEN);
  private readonly sortScratch = new Float32Array(HISTORY_LEN);
  private writeIdx = 0;
  private sampleCount = 0;

  // CPU and GPU frame metrics
  private totalCpuMs = 0;
  private gpuExecutionMs = 0;
  private readonly gpuHistory = new Float32Array(HISTORY_LEN);
  private gpuSampleCount = 0;

  // WebGL2 Disjoint Timer Query state (non-blocking)
  private glContext: WebGL2RenderingContext | null = null;
  private timerExt: any = null;
  private queryActive: WebGLQuery | null = null;
  private queryPending: WebGLQuery | null = null;
  private timerAvailable = false;

  // Action and event trace ring buffer
  private readonly recentEvents: ProfilerActionEvent[] = [];
  private nextEventId = 1;

  constructor(startTimestampMs: number = Date.now()) {
    this.startTimestampMs = startTimestampMs;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public initGlContext(gl: RenderingContext | null): void {
    if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
      this.glContext = gl;
      try {
        const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (ext) {
          this.timerExt = ext;
          this.timerAvailable = true;
        }
      } catch {
        this.timerExt = null;
        this.timerAvailable = false;
      }
    }
  }

  public beginFrame(): void {
    if (!this.enabled) return;
    this.curFrameMs.fill(0);
    this.checkPendingGpuQuery();
  }

  public startPhase(phase: ProfilerPhaseId): void {
    if (!this.enabled) return;
    const idx = PROFILER_PHASES.indexOf(phase);
    if (idx !== -1) {
      this.phaseStartTimes[idx] = performance.now();
    }
  }

  public endPhase(phase: ProfilerPhaseId): void {
    if (!this.enabled) return;
    const idx = PROFILER_PHASES.indexOf(phase);
    if (idx !== -1) {
      const start = this.phaseStartTimes[idx];
      if (start > 0) {
        const elapsed = performance.now() - start;
        this.curFrameMs[idx] += elapsed;
        this.phaseStartTimes[idx] = 0;
      }
    }
  }

  public beginGpuRender(): void {
    if (!this.enabled) return;
    this.startPhase('gpu_render_submit');
    if (this.glContext && this.timerExt && !this.queryActive) {
      try {
        const q = this.glContext.createQuery();
        if (q) {
          this.glContext.beginQuery(this.timerExt.TIME_ELAPSED_EXT, q);
          this.queryActive = q;
        }
      } catch {
        // Continue safely without hardware timer
      }
    }
  }

  public endGpuRender(): void {
    if (!this.enabled) return;
    this.endPhase('gpu_render_submit');
    if (this.glContext && this.timerExt && this.queryActive) {
      try {
        this.glContext.endQuery(this.timerExt.TIME_ELAPSED_EXT);
        // If there's an older pending query, dispose it to avoid leaks
        if (this.queryPending) {
          this.glContext.deleteQuery(this.queryPending);
        }
        this.queryPending = this.queryActive;
        this.queryActive = null;
      } catch {
        this.queryActive = null;
      }
    }
  }

  private checkPendingGpuQuery(): void {
    if (!this.glContext || !this.timerExt || !this.queryPending) return;
    try {
      const gl = this.glContext;
      const ext = this.timerExt;
      const available = gl.getQueryParameter(this.queryPending, gl.QUERY_RESULT_AVAILABLE);
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);

      if (available && !disjoint) {
        const timeElapsedNs = gl.getQueryParameter(this.queryPending, gl.QUERY_RESULT);
        const timeElapsedMs = Number(timeElapsedNs) / 1000000;
        if (timeElapsedMs > 0 && timeElapsedMs < 500) {
          this.recordGpuSample(timeElapsedMs);
        }
        gl.deleteQuery(this.queryPending);
        this.queryPending = null;
      } else if (available && disjoint) {
        gl.deleteQuery(this.queryPending);
        this.queryPending = null;
      }
    } catch {
      this.queryPending = null;
    }
  }

  public recordGpuSample(ms: number): void {
    this.gpuExecutionMs = Math.round(ms * 100) / 100;
    this.gpuHistory[this.writeIdx] = this.gpuExecutionMs;
    if (this.gpuSampleCount < HISTORY_LEN) this.gpuSampleCount++;
  }

  public endFrame(): void {
    if (!this.enabled) return;

    let sumCpu = 0;
    for (let i = 0; i < PHASE_COUNT; i++) {
      const val = this.curFrameMs[i];
      sumCpu += val;
      this.history[i * HISTORY_LEN + this.writeIdx] = val;
    }
    this.totalCpuMs = Math.round(sumCpu * 100) / 100;

    // Fall back to render submit time if GPU query is unsupported
    if (!this.timerAvailable || this.gpuExecutionMs === 0) {
      this.recordGpuSample(this.curFrameMs[PROFILER_PHASES.indexOf('gpu_render_submit')]);
    }

    this.writeIdx = (this.writeIdx + 1) % HISTORY_LEN;
    if (this.sampleCount < HISTORY_LEN) this.sampleCount++;
  }

  public recordAction(name: string, durationMs: number, details?: string): void {
    const now = Date.now();
    const elapsedSec = Math.max(0, (now - this.startTimestampMs) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = Math.floor(elapsedSec % 60);
    const elapsedLabel = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    this.recentEvents.unshift({
      id: this.nextEventId++,
      timestampMs: now,
      elapsedLabel,
      name,
      durationMs: Math.round(durationMs * 10) / 10,
      details,
    });

    if (this.recentEvents.length > MAX_EVENTS) {
      this.recentEvents.pop();
    }
  }

  public getTelemetrySnapshot(): PerformanceAnalysisSnapshot {
    const modules: ProfilerModuleMetric[] = [];
    const count = Math.max(1, this.sampleCount);

    for (let i = 0; i < PHASE_COUNT; i++) {
      const phaseId = PROFILER_PHASES[i];
      let sum = 0;
      let max = 0;

      for (let s = 0; s < count; s++) {
        const val = this.history[i * HISTORY_LEN + s];
        sum += val;
        if (val > max) max = val;
        this.sortScratch[s] = val;
      }

      this.sortScratch.subarray(0, count).sort();
      const p95Idx = Math.min(count - 1, Math.floor(count * 0.95));
      const p95 = this.sortScratch[p95Idx];
      const avg = sum / count;

      const budgetPercent = Math.round((avg / 16.67) * 1000) / 10;
      const status: 'nominal' | 'elevated' | 'critical' =
        p95 > 5.0 ? 'critical' : p95 > 2.2 ? 'elevated' : 'nominal';

      modules.push({
        id: phaseId,
        label: PROFILER_PHASE_LABELS[phaseId],
        avgMs: Math.round(avg * 100) / 100,
        p95Ms: Math.round(p95 * 100) / 100,
        maxMs: Math.round(max * 100) / 100,
        curMs: Math.round(this.curFrameMs[i] * 100) / 100,
        budgetPercent,
        status,
      });
    }

    // Sort modules by average execution time descending
    modules.sort((a, b) => b.avgMs - a.avgMs);

    const frameBudgetPercent = Math.round((this.totalCpuMs / 16.67) * 1000) / 10;
    const bottleneck: 'cpu' | 'gpu' | 'balanced' =
      this.gpuExecutionMs > this.totalCpuMs * 1.3
        ? 'gpu'
        : this.totalCpuMs > this.gpuExecutionMs * 1.3
        ? 'cpu'
        : 'balanced';

    return {
      enabled: this.enabled,
      totalCpuMs: this.totalCpuMs,
      gpuExecutionMs: this.gpuExecutionMs,
      gpuTimerAvailable: this.timerAvailable,
      bottleneck,
      frameBudgetPercent,
      modules,
      recentEvents: [...this.recentEvents],
    };
  }

  public formatAnalysisReport(): string {
    const snap = this.getTelemetrySnapshot();
    const lines: string[] = [];

    lines.push('=== CAPYGAME 3D PERFORMANCE ANALYSIS ===');
    lines.push(
      `CPU Work: ${snap.totalCpuMs.toFixed(1)}ms | GPU Work: ${snap.gpuExecutionMs.toFixed(
        1
      )}ms | Bottleneck: ${snap.bottleneck.toUpperCase()}`
    );
    lines.push(
      `Budget Used: ${snap.frameBudgetPercent.toFixed(1)}% of 16.67ms (60 FPS Target) | Hardware Timer: ${
        snap.gpuTimerAvailable ? 'Active' : 'CPU-Submit Est.'
      }`
    );
    lines.push('----------------------------------------');
    lines.push('MODULE / SUBSYSTEM CPU BREAKDOWN:');
    lines.push('Module                      Avg    P95    Max   Budget%  Status');

    for (const m of snap.modules) {
      const namePad = m.label.padEnd(26, ' ');
      const avgPad = `${m.avgMs.toFixed(1)}ms`.padStart(6, ' ');
      const p95Pad = `${m.p95Ms.toFixed(1)}ms`.padStart(6, ' ');
      const maxPad = `${m.maxMs.toFixed(1)}ms`.padStart(6, ' ');
      const pctPad = `${m.budgetPercent.toFixed(1)}%`.padStart(8, ' ');
      const statusIcon =
        m.status === 'critical' ? '[CRIT]' : m.status === 'elevated' ? '[WARN]' : '[ OK ]';
      lines.push(`${namePad} ${avgPad} ${p95Pad} ${maxPad} ${pctPad}  ${statusIcon}`);
    }

    if (snap.recentEvents.length > 0) {
      lines.push('----------------------------------------');
      lines.push('RECENT ACTIONS & TIMED EVENTS:');
      for (const ev of snap.recentEvents.slice(0, 8)) {
        lines.push(
          `- [T+${ev.elapsedLabel}] ${ev.name}: ${ev.durationMs.toFixed(1)}ms${
            ev.details ? ` (${ev.details})` : ''
          }`
        );
      }
    }

    // Diagnostic insights based on data
    lines.push('----------------------------------------');
    lines.push('ANALYSIS INSIGHTS & HOTSPOTS:');
    const top = snap.modules[0];
    if (top && top.avgMs > 4.0) {
      lines.push(`- Primary Hotspot: ${top.label} consuming ${top.budgetPercent.toFixed(1)}% of frame budget.`);
    } else {
      lines.push('- Workload distribution is well-balanced across all subsystems.');
    }

    if (snap.bottleneck === 'gpu') {
      lines.push('- GPU execution dominates. Consider lowering shadow cascade resolution or post-FX bloom.');
    } else if (snap.bottleneck === 'cpu') {
      lines.push('- CPU work dominates. Physics steps and scene graph traversals are primary consumers.');
    } else {
      lines.push('- Balanced CPU/GPU execution. Target 60 FPS pacing is healthy.');
    }

    lines.push('========================================');
    return lines.join('\n');
  }
}
