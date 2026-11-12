// Studio Procedural Web Audio Synthesizer & Surface Foley Engine for CapyGame
// Zero external audio files — 100% real-time Web Audio synthesis with Master Compressor & Warm Reverb Bus

class CapyAudioService {
  private ctx: AudioContext | null = null;
  private masterInput: GainNode | null = null;
  private reverbInput: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private musicTimer: number | null = null;
  private lastFootstepMs: number = 0;

  constructor() {
    // Lazy initialize on first user gesture
  }

  private initContext(): void {
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
}

export const AudioService = new CapyAudioService();
