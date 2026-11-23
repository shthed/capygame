// Studio Procedural Web Audio Synthesizer & Surface Foley Engine for CapyGame
// Zero external audio files — 100% real-time Web Audio synthesis with Master Compressor & Warm Reverb Bus

export type CapytorioPlacementSoundProfile = 'heavy' | 'belt' | 'servo' | 'crate';

export function selectCapytorioPlacementProfile(
  machineType?: string
): CapytorioPlacementSoundProfile {
  if (
    machineType === 'belt' ||
    machineType === 'splitter' ||
    machineType === 'tunnel' ||
    machineType === 'transport_belt' ||
    machineType === 'fast_transport_belt' ||
    machineType === 'express_transport_belt'
  ) {
    return 'belt';
  }
  if (
    machineType === 'inserter' ||
    machineType === 'fast_inserter' ||
    machineType === 'long_handed_inserter' ||
    machineType === 'bulk_inserter'
  ) {
    return 'servo';
  }
  if (
    machineType === 'chest' ||
    machineType === 'wooden_chest' ||
    machineType === 'iron_chest' ||
    machineType === 'steel_chest'
  ) {
    return 'crate';
  }
  return 'heavy';
}

export function computeCapytorioAmbientMix(
  activeMachineCount: number,
  powerEfficiency: number,
  isInCapytorio: boolean,
  isMuted: boolean
): { targetGain: number; filterHz: number; humHz: number } {
  if (isMuted || !isInCapytorio || activeMachineCount <= 0) {
    return { targetGain: 0, filterHz: 180, humHz: 56 };
  }
  const activity = Math.min(1, Math.log2(activeMachineCount + 1) / 4.5);
  const eff = Math.max(0.18, Math.min(1.15, powerEfficiency));
  const targetGain = +(0.008 + activity * 0.02 * eff).toFixed(5);
  const filterHz = Math.round(185 + activity * 135 * eff);
  const humHz = +(54 + eff * 8).toFixed(2);
  return { targetGain, filterHz, humHz };
}

class CapyAudioService {
  private ctx: AudioContext | null = null;
  private masterInput: GainNode | null = null;
  private reverbInput: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private musicTimer: number | null = null;
  private lastFootstepMs: number = 0;
  private lastCapytorioPlaceMs: number = 0;
  private lastCapytorioUiMs: number = 0;
  private lastCapytorioMineMs: number = 0;
  private capytorioStepCounter: number = 0;
  private factoryHumOscA: OscillatorNode | null = null;
  private factoryHumOscB: OscillatorNode | null = null;
  private factoryHumFilter: BiquadFilterNode | null = null;
  private factoryHumGain: GainNode | null = null;
  private lifecycleHooked: boolean = false;

  constructor() {
    // Lazy initialize on first user gesture
  }

  private ensureLifecycleHooks(): void {
    if (this.lifecycleHooked || typeof document === 'undefined') return;
    this.lifecycleHooked = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        try {
          window.speechSynthesis?.cancel();
        } catch {
          // Ignore speechSynthesis availability issues
        }
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      } else if (!this.isMuted && this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  private initContext(): void {
    this.ensureLifecycleHooks();
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
          this.setupStudioMasterBus(this.ctx);
        } catch {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private setupStudioMasterBus(ctx: AudioContext): void {
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.88;

    // Master dynamics compressor eliminates clipping when multiple foley/chime voices overlap
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);
    this.masterInput = masterGain;

    // Warm Stereo Feedback Delay Reverb Send (2100 Hz damped acoustic tail)
    const revIn = ctx.createGain();
    revIn.gain.value = 0.24;
    const delayA = ctx.createDelay(0.5);
    delayA.delayTime.value = 0.118;
    const delayB = ctx.createDelay(0.5);
    delayB.delayTime.value = 0.173;
    const dampFilter = ctx.createBiquadFilter();
    dampFilter.type = 'lowpass';
    dampFilter.frequency.value = 2150;
    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.34;

    revIn.connect(delayA);
    delayA.connect(delayB);
    delayB.connect(dampFilter);
    dampFilter.connect(fbGain);
    fbGain.connect(delayA);
    dampFilter.connect(compressor);
    this.reverbInput = revIn;

    // Pre-bake reusable 0.35s pink-ish noise buffer for footsteps & water splashes (zero per-play buffer alloc!)
    const sampleCount = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let seed = 0x9e3779b9;
    for (let i = 0; i < sampleCount; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    }
    this.noiseBuffer = buf;
  }

  private getDryNode(): AudioNode | null {
    if (!this.ctx) return null;
    return this.masterInput ?? this.ctx.destination;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted && this.factoryHumGain && this.ctx) {
      this.factoryHumGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
    if (muted && this.musicTimer) {
      window.clearTimeout(this.musicTimer);
      this.isMusicPlaying = false;
    } else if (!muted && !this.isMusicPlaying) {
      this.startAmbientMusic();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Surface-aware Capybara Paw Footstep Foley ('turf' | 'cobble' | 'water')
  public playFootstep(surface: 'turf' | 'cobble' | 'water'): void {
    if (this.isMuted) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastFootstepMs < 95) return;
    this.lastFootstepMs = nowMs;

    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry || !this.noiseBuffer) return;

    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const jitter = 0.92 + ((nowMs & 15) / 15) * 0.16;

    if (surface === 'water') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(640 * jitter, t);
      filter.frequency.exponentialRampToValueAtTime(280, t + 0.11);
      filter.Q.value = 3.2;
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.start(t, 0, 0.13);
    } else if (surface === 'cobble') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1480 * jitter, t);
      filter.Q.value = 4.5;
      gain.gain.setValueAtTime(0.065, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      src.start(t, 0, 0.065);
    } else {
      // Soft meadow grass & soil rustle
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520 * jitter, t);
      gain.gain.setValueAtTime(0.055, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      src.start(t, 0, 0.085);
    }

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dry);
  }

  // Coin / Berry Pickup Bell Chime (Dual-harmonic shimmer)
  public playCoin(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.exponentialRampToValueAtTime(1318.51, t + 0.075); // E6

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(1975.53, t);
    overtone.frequency.exponentialRampToValueAtTime(2637.02, t + 0.075);

    gain.gain.setValueAtTime(0.095, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    overtone.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    overtone.start(t);
    osc.stop(t + 0.24);
    overtone.stop(t + 0.24);
  }

  // Jump Hop
  public playJump(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.14);

    gain.gain.setValueAtTime(0.13, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(dry);

    osc.start(t);
    osc.stop(t + 0.21);
  }

  // XPBD Soft-Body Trampoline Pad Launch (Punchy Sub-Bounce + Sparkling Harmonic Fifth)
  public playTrampolineLaunch(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const chime = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    sub.type = 'sine';
    sub.frequency.setValueAtTime(82, t);
    sub.frequency.exponentialRampToValueAtTime(290, t + 0.16);

    chime.type = 'triangle';
    chime.frequency.setValueAtTime(523.25, t);
    chime.frequency.exponentialRampToValueAtTime(1046.5, t + 0.24);

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    sub.connect(gain);
    chime.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    sub.start(t);
    chime.start(t);
    sub.stop(t + 0.32);
    chime.stop(t + 0.32);
  }

  // Brick / Block Crystal Smash Chime
  public playBrickHit(pitchMultiplier: number = 1.0): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const fifth = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25 * pitchMultiplier, t);
    osc.frequency.exponentialRampToValueAtTime(1046.5 * pitchMultiplier, t + 0.09);

    fifth.type = 'triangle';
    fifth.frequency.setValueAtTime(783.99 * pitchMultiplier, t);
    fifth.frequency.exponentialRampToValueAtTime(1567.98 * pitchMultiplier, t + 0.09);

    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    fifth.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    fifth.start(t);
    osc.stop(t + 0.22);
    fifth.stop(t + 0.22);
  }

  // Yuzu Munch / Fruit Chomp
  public playChomp(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.linearRampToValueAtTime(155, t + 0.11);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1250, t);
    filter.frequency.exponentialRampToValueAtTime(380, t + 0.12);

    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dry);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Splash in Hot Spring / Home Pool / Lagoon (Filtered Liquid Spray + Bubble Pluck)
  public playSplash(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.22);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.29);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.31);

    osc.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    osc.stop(t + 0.33);

    if (this.noiseBuffer) {
      const spray = this.ctx.createBufferSource();
      spray.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(920, t);
      bp.frequency.exponentialRampToValueAtTime(340, t + 0.25);
      bp.Q.value = 1.8;
      const sGain = this.ctx.createGain();
      sGain.gain.setValueAtTime(0.12, t);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      spray.connect(bp);
      bp.connect(sGain);
      sGain.connect(dry);
      spray.start(t, 0, 0.28);
    }
  }

  // Level Up / Prestige Fanfare
  public playPrestigeFanfare(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + idx * 0.095;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      osc.connect(gain);
      gain.connect(dry);
      if (this.reverbInput) gain.connect(this.reverbInput);

      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  public playBigBang(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.35);
    osc.frequency.exponentialRampToValueAtTime(55, t + 1.8);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 2.0);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(240, t + 1.9);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.1);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    subOsc.start(t);
    osc.stop(t + 2.15);
    subOsc.stop(t + 2.15);
  }

  public playCosmicWarp(pitchMultiplier: number = 1.0): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(196 * pitchMultiplier, t);
    osc.frequency.exponentialRampToValueAtTime(784 * pitchMultiplier, t + 0.38);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);

    osc.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    osc.stop(t + 0.46);
  }

  // Warm Detuned Zen Marimba / Rhodes Ambient Music Loop routed through Studio Reverb Bus
  public startAmbientMusic(): void {
    if (this.isMuted || this.isMusicPlaying) return;
    this.initContext();
    this.isMusicPlaying = true;

    const pentatonicScale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25];

    const playNextNote = () => {
      if (this.isMuted || !this.isMusicPlaying) return;
      const dry = this.getDryNode();
      if (this.ctx && dry && this.ctx.state === 'running') {
        const idx = Math.floor(Math.random() * pentatonicScale.length);
        const freq = pentatonicScale[idx];
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime;

        oscA.type = 'sine';
        oscA.frequency.setValueAtTime(freq, t);
        oscB.type = 'triangle';
        oscB.frequency.setValueAtTime(freq * 1.0035, t); // warm 6-cent chorus detune

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.022, t + 0.045);
        gain.gain.exponentialRampToValueAtTime(0.0004, t + 1.65);

        oscA.connect(gain);
        oscB.connect(gain);
        gain.connect(dry);
        if (this.reverbInput) gain.connect(this.reverbInput);

        oscA.start(t);
        oscB.start(t);
        oscA.stop(t + 1.7);
        oscB.stop(t + 1.7);
      }

      const nextDelay = 1350 + Math.random() * 2100;
      this.musicTimer = window.setTimeout(playNextNote, nextDelay);
    };

    playNextNote();
  }

  public stopAmbientMusic(): void {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public playScaleCardChime(
    domain: 'cosmic' | 'stellar' | 'planetary' | 'terrestrial' | 'microscopic' | 'quantum'
  ): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const domainRootFreqs: Record<typeof domain, [number, number]> = {
      cosmic: [392.0, 587.33],
      stellar: [440.0, 659.25],
      planetary: [493.88, 739.99],
      terrestrial: [523.25, 783.99],
      microscopic: [587.33, 880.0],
      quantum: [659.25, 987.77],
    };
    const [rootHz, fifthHz] = domainRootFreqs[domain] || [523.25, 783.99];
    const t = this.ctx.currentTime;
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(rootHz, t);
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(fifthHz, t + 0.045);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    oscA.start(t);
    oscB.start(t + 0.045);
    oscA.stop(t + 0.3);
    oscB.stop(t + 0.3);
  }

  public speakScaleCardCaption(text: string): void {
    if (this.isMuted || typeof window === 'undefined' || !text.trim()) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1.08;
      utter.volume = 0.82;
      synth.speak(utter);
    } catch {
      // Ignore speech synthesis restrictions cleanly
    }
  }

  public playComboChime(comboCount: number): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
    const idx = Math.max(0, Math.min(pentatonic.length - 1, comboCount - 1));
    const freq = pentatonic[idx];
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const harm = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    harm.type = 'triangle';
    harm.frequency.setValueAtTime(freq * 1.5, t);

    gain.gain.setValueAtTime(0.085, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    harm.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    harm.start(t);
    osc.stop(t + 0.24);
    harm.stop(t + 0.24);
  }

  public playDashWhoosh(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry || !this.noiseBuffer) return;

    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, t);
    filter.frequency.exponentialRampToValueAtTime(1680, t + 0.09);
    filter.frequency.exponentialRampToValueAtTime(340, t + 0.24);
    filter.Q.value = 1.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dry);
    src.start(t, 0, 0.26);
  }

  public playDescentRingChime(ringIndex: number): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const scale = [392.0, 493.88, 587.33, 739.99, 880.0, 1174.66];
    const root = scale[Math.max(0, Math.min(scale.length - 1, ringIndex))];
    const t = this.ctx.currentTime;

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(root, t);
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(root * 1.5, t + 0.04);

    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);

    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    oscA.start(t);
    oscB.start(t + 0.04);
    oscA.stop(t + 0.36);
    oscB.stop(t + 0.36);
  }

  // ============================================================================
  // CAPYTORIO PROCEDURAL INDUSTRIAL FOLEY & DYNAMIC FACTORY HUM
  // ============================================================================

  public playCapytorioPlace(machineType?: string, isDrag: boolean = false): void {
    if (this.isMuted) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastCapytorioPlaceMs < (isDrag ? 48 : 28)) return;
    this.lastCapytorioPlaceMs = nowMs;
    this.capytorioStepCounter = (this.capytorioStepCounter + 1) & 15;

    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const profile = selectCapytorioPlacementProfile(machineType);
    const t = this.ctx.currentTime;
    const jitter = 0.96 + (this.capytorioStepCounter % 5) * 0.022;

    if (profile === 'belt') {
      // Crisp Factorio conveyor rail snap + metallic click
      const click = this.ctx.createOscillator();
      const body = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      click.type = 'triangle';
      click.frequency.setValueAtTime(920 * jitter, t);
      click.frequency.exponentialRampToValueAtTime(340 * jitter, t + 0.045);

      body.type = 'sine';
      body.frequency.setValueAtTime(165 * jitter, t);
      body.frequency.exponentialRampToValueAtTime(88, t + 0.055);

      gain.gain.setValueAtTime(isDrag ? 0.085 : 0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      click.connect(gain);
      body.connect(gain);
      gain.connect(dry);

      click.start(t);
      body.start(t);
      click.stop(t + 0.075);
      body.stop(t + 0.075);

      if (this.noiseBuffer) {
        const snap = this.ctx.createBufferSource();
        snap.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.value = 2600 * jitter;
        hp.Q.value = 2.6;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(isDrag ? 0.045 : 0.06, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
        snap.connect(hp);
        hp.connect(nGain);
        nGain.connect(dry);
        snap.start(t, 0, 0.04);
      }
      return;
    }

    if (profile === 'servo') {
      // Quick hydraulic servo zip + bolt lock
      const servo = this.ctx.createOscillator();
      const lock = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      servo.type = 'sawtooth';
      servo.frequency.setValueAtTime(320 * jitter, t);
      servo.frequency.exponentialRampToValueAtTime(760 * jitter, t + 0.065);

      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 1150;
      filt.Q.value = 2.2;

      lock.type = 'triangle';
      lock.frequency.setValueAtTime(210, t + 0.04);
      lock.frequency.exponentialRampToValueAtTime(115, t + 0.11);

      gain.gain.setValueAtTime(0.095, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      servo.connect(filt);
      filt.connect(gain);
      lock.connect(gain);
      gain.connect(dry);
      if (this.reverbInput) gain.connect(this.reverbInput);

      servo.start(t);
      lock.start(t + 0.04);
      servo.stop(t + 0.08);
      lock.stop(t + 0.125);
      return;
    }

    if (profile === 'crate') {
      // Hollow reinforced supply crate thump + brass latch clack
      const thud = this.ctx.createOscillator();
      const latch = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      thud.type = 'triangle';
      thud.frequency.setValueAtTime(175 * jitter, t);
      thud.frequency.exponentialRampToValueAtTime(72, t + 0.09);

      latch.type = 'sine';
      latch.frequency.setValueAtTime(1180 * jitter, t + 0.025);
      latch.frequency.exponentialRampToValueAtTime(640, t + 0.075);

      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.115);

      thud.connect(gain);
      latch.connect(gain);
      gain.connect(dry);

      thud.start(t);
      latch.start(t + 0.025);
      thud.stop(t + 0.11);
      latch.stop(t + 0.09);
      return;
    }

    // 'heavy' — multi-tile industrial machine drop: hydraulic bass thump + steel clank + pneumatic hiss
    const sub = this.ctx.createOscillator();
    const clank = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    sub.type = 'sine';
    sub.frequency.setValueAtTime(108 * jitter, t);
    sub.frequency.exponentialRampToValueAtTime(42, t + 0.14);

    clank.type = 'triangle';
    clank.frequency.setValueAtTime(520 * jitter, t + 0.012);
    clank.frequency.exponentialRampToValueAtTime(215, t + 0.11);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.165);

    sub.connect(gain);
    clank.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    sub.start(t);
    clank.start(t + 0.012);
    sub.stop(t + 0.17);
    clank.stop(t + 0.13);

    if (this.noiseBuffer) {
      const hiss = this.ctx.createBufferSource();
      hiss.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1850, t + 0.02);
      bp.frequency.exponentialRampToValueAtTime(920, t + 0.14);
      bp.Q.value = 1.8;
      const hGain = this.ctx.createGain();
      hGain.gain.setValueAtTime(0.065, t + 0.02);
      hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      hiss.connect(bp);
      bp.connect(hGain);
      hGain.connect(dry);
      hiss.start(t + 0.02, 0, 0.16);
    }
  }

  public playCapytorioDemolish(): void {
    if (this.isMuted) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastCapytorioPlaceMs < 35) return;
    this.lastCapytorioPlaceMs = nowMs;

    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const wrench = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    wrench.type = 'sawtooth';
    wrench.frequency.setValueAtTime(340, t);
    wrench.frequency.exponentialRampToValueAtTime(140, t + 0.11);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1350, t);
    lp.frequency.exponentialRampToValueAtTime(380, t + 0.12);

    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(58, t + 0.12);

    gain.gain.setValueAtTime(0.115, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    wrench.connect(lp);
    lp.connect(gain);
    sub.connect(gain);
    gain.connect(dry);

    wrench.start(t);
    sub.start(t);
    wrench.stop(t + 0.145);
    sub.stop(t + 0.145);

    if (this.noiseBuffer) {
      const scrape = this.ctx.createBufferSource();
      scrape.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1200;
      bp.Q.value = 2.4;
      const sGain = this.ctx.createGain();
      sGain.gain.setValueAtTime(0.06, t);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      scrape.connect(bp);
      bp.connect(sGain);
      sGain.connect(dry);
      scrape.start(t, 0, 0.095);
    }
  }

  public playCapytorioRotate(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const pawl = this.ctx.createOscillator();
    const click = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    pawl.type = 'triangle';
    pawl.frequency.setValueAtTime(680, t);
    pawl.frequency.exponentialRampToValueAtTime(1180, t + 0.032);

    click.type = 'sine';
    click.frequency.setValueAtTime(1520, t + 0.015);
    click.frequency.exponentialRampToValueAtTime(980, t + 0.05);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.058);

    pawl.connect(gain);
    click.connect(gain);
    gain.connect(dry);

    pawl.start(t);
    click.start(t + 0.015);
    pawl.stop(t + 0.06);
    click.stop(t + 0.06);
  }

  public playCapytorioMine(kind: 'ore' | 'tree'): void {
    if (this.isMuted) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastCapytorioMineMs < 55) return;
    this.lastCapytorioMineMs = nowMs;

    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const jitter = 0.93 + ((nowMs & 7) / 7) * 0.14;

    if (kind === 'tree') {
      // Woody axe thock + leafy brush rustle
      const knock = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      knock.type = 'triangle';
      knock.frequency.setValueAtTime(220 * jitter, t);
      knock.frequency.exponentialRampToValueAtTime(88, t + 0.095);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      knock.connect(gain);
      gain.connect(dry);
      knock.start(t);
      knock.stop(t + 0.115);

      if (this.noiseBuffer) {
        const rustle = this.ctx.createBufferSource();
        rustle.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(980 * jitter, t + 0.015);
        bp.frequency.exponentialRampToValueAtTime(420, t + 0.16);
        bp.Q.value = 1.4;
        const rGain = this.ctx.createGain();
        rGain.gain.setValueAtTime(0.08, t + 0.015);
        rGain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
        rustle.connect(bp);
        bp.connect(rGain);
        rGain.connect(dry);
        rustle.start(t + 0.015, 0, 0.18);
      }
      return;
    }

    // Metallic pickaxe clink on mineral ore + crisp gravel shatter
    const pingA = this.ctx.createOscillator();
    const pingB = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    pingA.type = 'sine';
    pingA.frequency.setValueAtTime(1780 * jitter, t);
    pingA.frequency.exponentialRampToValueAtTime(1420 * jitter, t + 0.12);

    pingB.type = 'triangle';
    pingB.frequency.setValueAtTime(2680 * jitter, t);
    pingB.frequency.exponentialRampToValueAtTime(2150 * jitter, t + 0.09);

    gain.gain.setValueAtTime(0.095, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    pingA.connect(gain);
    pingB.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    pingA.start(t);
    pingB.start(t);
    pingA.stop(t + 0.15);
    pingB.stop(t + 0.11);

    if (this.noiseBuffer) {
      const crunch = this.ctx.createBufferSource();
      crunch.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1950 * jitter, t);
      bp.Q.value = 1.9;
      const cGain = this.ctx.createGain();
      cGain.gain.setValueAtTime(0.085, t);
      cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      crunch.connect(bp);
      bp.connect(cGain);
      cGain.connect(dry);
      crunch.start(t, 0, 0.09);
    }
  }

  public playCapytorioPickup(): void {
    if (this.isMuted) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastCapytorioUiMs < 45) return;
    this.lastCapytorioUiMs = nowMs;

    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(840, t + 0.065);
    gain.gain.setValueAtTime(0.085, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    osc.connect(gain);
    gain.connect(dry);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playCapytorioCraftQueue(kind: 'start' | 'complete' | 'cancel'): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    if (kind === 'start') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(660, t + 0.055);
      gain.gain.setValueAtTime(0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      osc.connect(gain);
      gain.connect(dry);
      osc.start(t);
      osc.stop(t + 0.08);
      return;
    }
    if (kind === 'cancel') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(240, t + 0.08);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
      osc.connect(gain);
      gain.connect(dry);
      osc.start(t);
      osc.stop(t + 0.1);
      return;
    }

    // 'complete': tactile wrench-anvil assembly clink-ding!
    const notes = [659.25, 987.77];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + i * 0.055;
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(notes[i], st);
      gain.gain.setValueAtTime(0.085, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
      osc.connect(gain);
      gain.connect(dry);
      if (this.reverbInput) gain.connect(this.reverbInput);
      osc.start(st);
      osc.stop(st + 0.19);
    }
  }

  public playCapytorioBlueprint(
    kind: 'copy' | 'cut' | 'paste' | 'flip',
    count: number = 1
  ): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    if (kind === 'paste') {
      const taps = Math.max(1, Math.min(4, Math.ceil(count / 2)));
      for (let i = 0; i < taps; i++) {
        const st = t + i * 0.042;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280 + i * 95, st);
        osc.frequency.exponentialRampToValueAtTime(140 + i * 40, st + 0.065);
        gain.gain.setValueAtTime(0.095, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.078);
        osc.connect(gain);
        gain.connect(dry);
        if (this.reverbInput) gain.connect(this.reverbInput);
        osc.start(st);
        osc.stop(st + 0.082);
      }
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = kind === 'cut' ? 'sawtooth' : 'sine';
    if (kind === 'copy') {
      osc.frequency.setValueAtTime(740, t);
      osc.frequency.exponentialRampToValueAtTime(1110, t + 0.06);
    } else if (kind === 'cut') {
      osc.frequency.setValueAtTime(860, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.075);
    } else {
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.045);
    }
    gain.gain.setValueAtTime(0.075, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    osc.connect(gain);
    gain.connect(dry);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playCapytorioSettings(kind: 'copy' | 'paste'): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const freqs = kind === 'copy' ? [587.33, 880.0] : [880.0, 1174.66];
    for (let i = 0; i < freqs.length; i++) {
      const st = t + i * 0.042;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i], st);
      gain.gain.setValueAtTime(0.075, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.09);
      osc.connect(gain);
      gain.connect(dry);
      osc.start(st);
      osc.stop(st + 0.095);
    }
  }

  public playCapytorioFuelLoad(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    // Warm firebox coal ignition rumble + whoosh
    const sub = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(92, t);
    sub.frequency.exponentialRampToValueAtTime(155, t + 0.14);
    sub.frequency.exponentialRampToValueAtTime(68, t + 0.28);
    sGain.gain.setValueAtTime(0.13, t);
    sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    sub.connect(sGain);
    sGain.connect(dry);
    sub.start(t);
    sub.stop(t + 0.31);

    if (this.noiseBuffer) {
      const flare = this.ctx.createBufferSource();
      flare.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, t);
      lp.frequency.exponentialRampToValueAtTime(1450, t + 0.12);
      lp.frequency.exponentialRampToValueAtTime(360, t + 0.28);
      const fGain = this.ctx.createGain();
      fGain.gain.setValueAtTime(0.02, t);
      fGain.gain.linearRampToValueAtTime(0.13, t + 0.09);
      fGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      flare.connect(lp);
      lp.connect(fGain);
      fGain.connect(dry);
      flare.start(t, 0, 0.32);
    }
  }

  public playCapytorioScienceFeed(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const notes = [587.33, 783.99, 1174.66];
    for (let i = 0; i < notes.length; i++) {
      const st = t + i * 0.048;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], st);
      osc.frequency.exponentialRampToValueAtTime(notes[i] * 1.06, st + 0.11);
      gain.gain.setValueAtTime(0.08, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
      osc.connect(gain);
      gain.connect(dry);
      if (this.reverbInput) gain.connect(this.reverbInput);
      osc.start(st);
      osc.stop(st + 0.19);
    }
  }

  public playCapytorioTechComplete(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    // Industrial synth fanfare: warm fifth pad + rising crystalline arpeggio
    const notes = [392.0, 493.88, 587.33, 783.99, 987.77];
    for (let i = 0; i < notes.length; i++) {
      const st = t + i * 0.082;
      const osc = this.ctx.createOscillator();
      const harm = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i], st);
      harm.type = 'sine';
      harm.frequency.setValueAtTime(notes[i] * 2, st);
      gain.gain.setValueAtTime(0.095, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.42);
      osc.connect(gain);
      harm.connect(gain);
      gain.connect(dry);
      if (this.reverbInput) gain.connect(this.reverbInput);
      osc.start(st);
      harm.start(st);
      osc.stop(st + 0.44);
      harm.stop(st + 0.44);
    }
  }

  public playCapytorioRocketLaunch(): void {
    if (this.isMuted) return;
    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    // Deep rocket thruster roar + rising turbine whine + celebratory fifth chord
    const sub = this.ctx.createOscillator();
    const turbine = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(55, t);
    sub.frequency.exponentialRampToValueAtTime(118, t + 1.35);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(240, t);
    lp.frequency.exponentialRampToValueAtTime(1600, t + 1.15);
    lp.frequency.exponentialRampToValueAtTime(420, t + 1.85);

    turbine.type = 'triangle';
    turbine.frequency.setValueAtTime(220, t + 0.15);
    turbine.frequency.exponentialRampToValueAtTime(880, t + 1.45);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.9);

    sub.connect(lp);
    turbine.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    sub.start(t);
    turbine.start(t + 0.15);
    sub.stop(t + 1.95);
    turbine.stop(t + 1.95);

    if (this.noiseBuffer) {
      const roar = this.ctx.createBufferSource();
      roar.buffer = this.noiseBuffer;
      roar.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(340, t);
      bp.frequency.exponentialRampToValueAtTime(1250, t + 1.2);
      bp.Q.value = 0.9;
      const rGain = this.ctx.createGain();
      rGain.gain.setValueAtTime(0.01, t);
      rGain.gain.linearRampToValueAtTime(0.15, t + 0.22);
      rGain.gain.exponentialRampToValueAtTime(0.001, t + 1.85);
      roar.connect(bp);
      bp.connect(rGain);
      rGain.connect(dry);
      roar.start(t);
      roar.stop(t + 1.9);
    }

    // Triumphant major chord swell
    const chord = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < chord.length; i++) {
      const st = t + 0.45 + i * 0.08;
      const osc = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(chord[i], st);
      cGain.gain.setValueAtTime(0.075, st);
      cGain.gain.exponentialRampToValueAtTime(0.001, st + 0.9);
      osc.connect(cGain);
      cGain.connect(dry);
      if (this.reverbInput) cGain.connect(this.reverbInput);
      osc.start(st);
      osc.stop(st + 0.95);
    }
  }

  public playCapytorioError(): void {
    if (this.isMuted) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastCapytorioUiMs < 80) return;
    this.lastCapytorioUiMs = nowMs;

    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const st = t + i * 0.068;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(i === 0 ? 165 : 138, st);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 460;
      gain.gain.setValueAtTime(0.075, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.058);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(dry);
      osc.start(st);
      osc.stop(st + 0.062);
    }
  }

  public playCapytorioUiClick(kind: 'tool' | 'alt_on' | 'alt_off' | 'pipette' = 'tool'): void {
    if (this.isMuted) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastCapytorioUiMs < 35) return;
    this.lastCapytorioUiMs = nowMs;

    this.initContext();
    const dry = this.getDryNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    if (kind === 'alt_on') {
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(980, t + 0.05);
    } else if (kind === 'alt_off') {
      osc.frequency.setValueAtTime(840, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.05);
    } else if (kind === 'pipette') {
      osc.frequency.setValueAtTime(640, t);
      osc.frequency.exponentialRampToValueAtTime(1120, t + 0.045);
    } else {
      osc.frequency.setValueAtTime(760, t);
      osc.frequency.exponentialRampToValueAtTime(520, t + 0.032);
    }
    gain.gain.setValueAtTime(0.065, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.058);
    osc.connect(gain);
    gain.connect(dry);
    osc.start(t);
    osc.stop(t + 0.062);
  }

  /**
   * Smooth, cozy background industrial turbine hum when active Capytorio machines are running.
   * Never initializes AudioContext prematurely (waits for user gesture) and ramps silently to 0
   * when idle, muted, or outside Capytorio.
   */
  public updateCapytorioAmbient(
    activeMachineCount: number,
    powerEfficiency: number,
    isInCapytorio: boolean
  ): void {
    if (!this.ctx || !this.masterInput) return;
    const mix = computeCapytorioAmbientMix(
      activeMachineCount,
      powerEfficiency,
      isInCapytorio,
      this.isMuted
    );

    if (mix.targetGain <= 0) {
      if (this.factoryHumGain) {
        this.factoryHumGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.14);
      }
      return;
    }

    if (!this.factoryHumGain) {
      try {
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        oscA.type = 'sine';
        oscA.frequency.value = mix.humHz;
        oscB.type = 'triangle';
        oscB.frequency.value = mix.humHz * 2.01; // warm subtle 2nd harmonic chorus

        filter.type = 'lowpass';
        filter.frequency.value = mix.filterHz;
        filter.Q.value = 0.8;

        gain.gain.value = 0;

        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterInput);

        oscA.start();
        oscB.start();

        this.factoryHumOscA = oscA;
        this.factoryHumOscB = oscB;
        this.factoryHumFilter = filter;
        this.factoryHumGain = gain;
      } catch {
        return;
      }
    }

    const t = this.ctx.currentTime;
    this.factoryHumOscA?.frequency.setTargetAtTime(mix.humHz, t, 0.25);
    this.factoryHumOscB?.frequency.setTargetAtTime(mix.humHz * 2.01, t, 0.25);
    this.factoryHumFilter?.frequency.setTargetAtTime(mix.filterHz, t, 0.25);
    this.factoryHumGain?.gain.setTargetAtTime(mix.targetGain, t, 0.25);
  }

  public dispose(): void {
    this.stopAmbientMusic();
    try {
      this.factoryHumOscA?.stop();
      this.factoryHumOscB?.stop();
    } catch {
      // Ignore already-stopped oscillators
    }
    this.factoryHumOscA = null;
    this.factoryHumOscB = null;
    this.factoryHumFilter = null;
    this.factoryHumGain = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.masterInput = null;
    this.reverbInput = null;
    this.noiseBuffer = null;
  }
}

export const AudioService = new CapyAudioService();
