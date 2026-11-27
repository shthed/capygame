// Studio Procedural Web Audio Synthesizer & Surface Foley Engine for CapyGame
// Zero external audio files — 100% real-time Web Audio synthesis with 3-Bus Mixer,
// Warm Master Polish Filter, Dynamics Compressor & Damped Stereo Reverb Send.

import {
  AmbientSoundscapeMode,
  AudioMixerSettings,
  CapytorioPlacementSoundProfile,
  DEFAULT_AUDIO_MIXER_SETTINGS,
  UiClickKind,
  canTriggerVoice,
  computeAmbientPhrasePlan,
  computeCapytorioAmbientMix,
  computeCosmicDroneMix,
  humanizePitch,
  normalizeAudioMixerSettings,
  selectCapytorioPlacementProfile,
  volumeToPerceptualGain,
} from './AudioSynthesisMath';

export {
  DEFAULT_AUDIO_MIXER_SETTINGS,
  computeCapytorioAmbientMix,
  selectCapytorioPlacementProfile,
};
export type {
  AmbientSoundscapeMode,
  AudioMixerSettings,
  CapytorioPlacementSoundProfile,
  UiClickKind,
};

class CapyAudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private reverbInput: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isMuted: boolean = false;
  private mixer: AudioMixerSettings = { ...DEFAULT_AUDIO_MIXER_SETTINGS };
  private ambientMode: AmbientSoundscapeMode = 'forest';
  private isMusicPlaying: boolean = false;
  private musicTimer: number | null = null;
  private musicPhraseIndex: number = 0;

  // Anti-spam cooldown timestamps & humanization step counters
  private lastFootstepMs: number = 0;
  private lastCoinMs: number = 0;
  private lastJumpMs: number = 0;
  private lastWarpMs: number = 0;
  private lastScaleChimeMs: number = 0;
  private lastComboChimeMs: number = 0;
  private lastUiClickMs: number = 0;
  private lastCapytorioPlaceMs: number = 0;
  private lastCapytorioUiMs: number = 0;
  private lastCapytorioMineMs: number = 0;
  private voiceStepCounter: number = 0;

  // Continuous mode drones (smoothly crossfaded, lazily created on gesture)
  private factoryHumOscA: OscillatorNode | null = null;
  private factoryHumOscB: OscillatorNode | null = null;
  private factoryHumFilter: BiquadFilterNode | null = null;
  private factoryHumGain: GainNode | null = null;

  private cosmicDroneOscA: OscillatorNode | null = null;
  private cosmicDroneOscB: OscillatorNode | null = null;
  private cosmicDroneFilter: BiquadFilterNode | null = null;
  private cosmicDroneGain: GainNode | null = null;

  private lifecycleHooked: boolean = false;
  private isGamePaused: boolean = false;
  private wasMusicPlayingBeforePause: boolean = false;

  constructor() {
    // Lazy initialize on first user gesture
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private nextStep(): number {
    this.voiceStepCounter = (this.voiceStepCounter + 1) & 1023;
    return this.voiceStepCounter;
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
      } else if (
        !this.isMuted &&
        !this.isGamePaused &&
        this.ctx &&
        this.ctx.state === 'suspended'
      ) {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  private initContext(): void {
    this.ensureLifecycleHooks();
    if (this.ctx && this.ctx.state === 'closed') {
      this.resetNodes();
      this.ctx = null;
    }
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
    if (this.ctx && this.ctx.state === 'suspended' && !this.isGamePaused && !this.isMuted) {
      this.ctx.resume().catch(() => {});
    }
  }

  private resetNodes(): void {
    this.masterGain = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.uiBus = null;
    this.reverbInput = null;
    this.noiseBuffer = null;
    this.factoryHumOscA = null;
    this.factoryHumOscB = null;
    this.factoryHumFilter = null;
    this.factoryHumGain = null;
    this.cosmicDroneOscA = null;
    this.cosmicDroneOscB = null;
    this.cosmicDroneFilter = null;
    this.cosmicDroneGain = null;
  }

  private setupStudioMasterBus(ctx: AudioContext): void {
    const masterGain = ctx.createGain();
    masterGain.gain.value = this.isMuted
      ? 0
      : volumeToPerceptualGain(this.mixer.masterVolume, 0.9);

    // Gentle high-end polish filter eliminates harsh digital oscillator sheen
    const masterPolish = ctx.createBiquadFilter();
    masterPolish.type = 'lowpass';
    masterPolish.frequency.value = 9200;
    masterPolish.Q.value = 0.6;

    // Master dynamics compressor eliminates clipping when voices overlap
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.2;

    masterGain.connect(masterPolish);
    masterPolish.connect(compressor);
    compressor.connect(ctx.destination);
    this.masterGain = masterGain;

    // Independent Music / SFX / UI Gain Buses
    const musicBus = ctx.createGain();
    musicBus.gain.value = volumeToPerceptualGain(this.mixer.musicVolume, 1.0);
    musicBus.connect(masterGain);
    this.musicBus = musicBus;

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = volumeToPerceptualGain(this.mixer.sfxVolume, 1.0);
    sfxBus.connect(masterGain);
    this.sfxBus = sfxBus;

    const uiBus = ctx.createGain();
    uiBus.gain.value = this.mixer.uiSoundsEnabled
      ? volumeToPerceptualGain(this.mixer.sfxVolume, 0.85)
      : 0;
    uiBus.connect(masterGain);
    this.uiBus = uiBus;

    // Warm Stereo-Feeling Damped Feedback Reverb Send (1650 Hz velvet acoustic tail)
    const revIn = ctx.createGain();
    revIn.gain.value = 0.2;
    const delayA = ctx.createDelay(0.5);
    delayA.delayTime.value = 0.128;
    const delayB = ctx.createDelay(0.5);
    delayB.delayTime.value = 0.189;
    const dampFilter = ctx.createBiquadFilter();
    dampFilter.type = 'lowpass';
    dampFilter.frequency.value = 1650;
    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.32;

    revIn.connect(delayA);
    delayA.connect(delayB);
    delayB.connect(dampFilter);
    dampFilter.connect(fbGain);
    fbGain.connect(delayA);
    dampFilter.connect(masterGain);
    this.reverbInput = revIn;

    // Pre-bake reusable 0.55s warm pink noise buffer (zero per-play buffer allocation)
    const sampleCount = Math.floor(ctx.sampleRate * 0.55);
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

  private getSfxNode(): AudioNode | null {
    if (!this.ctx) return null;
    return this.sfxBus ?? this.masterGain ?? this.ctx.destination;
  }

  private getMusicNode(): AudioNode | null {
    if (!this.ctx) return null;
    return this.musicBus ?? this.masterGain ?? this.ctx.destination;
  }

  private getUiNode(): AudioNode | null {
    if (!this.ctx) return null;
    return this.uiBus ?? this.sfxBus ?? this.masterGain ?? this.ctx.destination;
  }

  private syncBusGainsSmooth(): void {
    if (!this.ctx || this.ctx.state === 'closed') return;
    const t = this.ctx.currentTime;
    try {
      this.masterGain?.gain.setTargetAtTime(
        this.isMuted ? 0 : volumeToPerceptualGain(this.mixer.masterVolume, 0.9),
        t,
        0.04
      );
      this.musicBus?.gain.setTargetAtTime(
        volumeToPerceptualGain(this.mixer.musicVolume, 1.0),
        t,
        0.06
      );
      this.sfxBus?.gain.setTargetAtTime(
        volumeToPerceptualGain(this.mixer.sfxVolume, 1.0),
        t,
        0.04
      );
      this.uiBus?.gain.setTargetAtTime(
        this.mixer.uiSoundsEnabled ? volumeToPerceptualGain(this.mixer.sfxVolume, 0.85) : 0,
        t,
        0.03
      );
    } catch {
      // Ignore AudioParam state errors during suspend/close transitions
    }
  }

  public getMixerSettings(): AudioMixerSettings {
    return { ...this.mixer };
  }

  public applyMixerSettings(patch: Partial<AudioMixerSettings>): AudioMixerSettings {
    this.mixer = normalizeAudioMixerSettings({ ...this.mixer, ...patch });
    this.syncBusGainsSmooth();
    if (this.mixer.musicVolume <= 0.005) {
      this.fadeOutCosmicDrone();
    }
    return { ...this.mixer };
  }

  public setAmbientMode(mode: AmbientSoundscapeMode): void {
    if (this.ambientMode === mode) return;
    this.ambientMode = mode;
    if (mode !== 'cosmic') {
      this.fadeOutCosmicDrone();
    }
    if (mode !== 'capytorio' && this.factoryHumGain && this.ctx && this.ctx.state !== 'closed') {
      try {
        this.factoryHumGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.14);
      } catch {
        // Ignore AudioParam timing errors
      }
    }
  }

  public getAmbientMode(): AmbientSoundscapeMode {
    return this.ambientMode;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.syncBusGainsSmooth();
    if (muted) {
      this.fadeOutCosmicDrone();
      if (this.factoryHumGain && this.ctx && this.ctx.state !== 'closed') {
        try {
          this.factoryHumGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
        } catch {
          // Ignore AudioParam timing errors
        }
      }
      this.stopAmbientMusic();
      this.wasMusicPlayingBeforePause = false;
    } else if (!this.isMusicPlaying && !this.isGamePaused) {
      this.startAmbientMusic();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // ============================================================================
  // SOFT TACTILE UI FOLEY (Replaces piercing coin/beep chimes on buttons/toggles)
  // ============================================================================

  public playUiClick(kind: UiClickKind = 'tap'): void {
    if (this.isMuted || !this.mixer.uiSoundsEnabled || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastUiClickMs, now, 38)) return;
    this.lastUiClickMs = now;

    this.initContext();
    const out = this.getUiNode();
    if (!this.ctx || !out) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    lp.type = 'lowpass';
    lp.Q.value = 0.7;

    if (kind === 'toggle_on') {
      const f0 = humanizePitch(360, step, 0.03);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.32, t + 0.038);
      lp.frequency.setValueAtTime(1150, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.042, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.052);
    } else if (kind === 'toggle_off') {
      const f0 = humanizePitch(410, step, 0.03);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.74, t + 0.038);
      lp.frequency.setValueAtTime(980, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.038, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
    } else if (kind === 'select') {
      const f0 = humanizePitch(440, step, 0.035);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.18, t + 0.045);
      lp.frequency.setValueAtTime(1250, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.062);
    } else if (kind === 'back') {
      const f0 = humanizePitch(330, step, 0.03);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.76, t + 0.042);
      lp.frequency.setValueAtTime(900, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.036, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.054);
    } else {
      // Soft wooden marimba-key tap
      const f0 = humanizePitch(390, step, 0.04);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.68, t + 0.028);
      lp.frequency.setValueAtTime(1050, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.036, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.038);
    }

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(out);

    osc.start(t);
    osc.stop(t + 0.068);
  }

  // Surface-aware Capybara Paw Footstep Foley ('turf' | 'cobble' | 'water')
  public playFootstep(surface: 'turf' | 'cobble' | 'water'): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastFootstepMs, now, 105)) return;
    this.lastFootstepMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry || !this.noiseBuffer) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    if (surface === 'water') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(humanizePitch(580, step, 0.08), t);
      filter.frequency.exponentialRampToValueAtTime(260, t + 0.11);
      filter.Q.value = 2.6;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.075, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.start(t, 0, 0.13);
    } else if (surface === 'cobble') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(humanizePitch(1280, step, 0.07), t);
      filter.Q.value = 3.2;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.055, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      src.start(t, 0, 0.065);
    } else {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(humanizePitch(480, step, 0.08), t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.048, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      src.start(t, 0, 0.085);
    }

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dry);
  }

  // Warm Damped Wooden Kalimba / Soft Berry Pickup Chime (replaces shrill high-pitched coin chirp)
  public playCoin(): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastCoinMs, now, 58)) return;
    this.lastCoinMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const rootHz = humanizePitch(587.33, step, 0.045); // Warm D5 base
    const fifthHz = rootHz * 1.498; // Warm A5 shimmer

    const body = this.ctx.createOscillator();
    const harm = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    body.type = 'sine';
    body.frequency.setValueAtTime(rootHz, t);
    body.frequency.exponentialRampToValueAtTime(fifthHz, t + 0.065);

    harm.type = 'triangle';
    harm.frequency.setValueAtTime(rootHz * 2, t);
    harm.frequency.exponentialRampToValueAtTime(fifthHz * 1.5, t + 0.065);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(950, t + 0.19);
    lp.Q.value = 0.7;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.072, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.21);

    body.connect(lp);
    harm.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    body.start(t);
    harm.start(t);
    body.stop(t + 0.23);
    harm.stop(t + 0.23);
  }

  // Organic Airy Paw-Hop (replaces harsh cartoon triangle "boop/boing")
  public playJump(): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastJumpMs, now, 90)) return;
    this.lastJumpMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const baseHz = humanizePitch(148, step, 0.055);

    // Warm muffled spring-thump body
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseHz, t);
    osc.frequency.exponentialRampToValueAtTime(baseHz * 1.72, t + 0.11);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(640, t);
    lp.Q.value = 0.8;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.088, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.145);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(dry);

    osc.start(t);
    osc.stop(t + 0.16);

    // Subtle soft air / fur puff transient
    if (this.noiseBuffer) {
      const puff = this.ctx.createBufferSource();
      puff.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(humanizePitch(620, step, 0.07), t);
      bp.frequency.exponentialRampToValueAtTime(1120, t + 0.09);
      bp.Q.value = 1.4;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.001, t);
      nGain.gain.linearRampToValueAtTime(0.045, t + 0.014);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      puff.connect(bp);
      bp.connect(nGain);
      nGain.connect(dry);
      puff.start(t, 0, 0.12);
    }
  }

  // XPBD Soft-Body Trampoline Pad Launch (Warm Sub-Bounce + Velvet Harmonic Fifth)
  public playTrampolineLaunch(): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const sub = this.ctx.createOscillator();
    const chime = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    sub.type = 'sine';
    sub.frequency.setValueAtTime(humanizePitch(86, step, 0.04), t);
    sub.frequency.exponentialRampToValueAtTime(245, t + 0.16);

    chime.type = 'sine';
    chime.frequency.setValueAtTime(humanizePitch(392.0, step, 0.03), t);
    chime.frequency.exponentialRampToValueAtTime(587.33, t + 0.22);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1650, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.125, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    sub.connect(lp);
    chime.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    sub.start(t);
    chime.start(t);
    sub.stop(t + 0.3);
    chime.stop(t + 0.3);
  }

  // Brick / Block Warm Ceramic-Wood Clink
  public playBrickHit(pitchMultiplier: number = 1.0): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const root = humanizePitch(440 * Math.max(0.6, Math.min(1.6, pitchMultiplier)), step, 0.04);

    const osc = this.ctx.createOscillator();
    const fifth = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(root, t);
    osc.frequency.exponentialRampToValueAtTime(root * 1.45, t + 0.08);

    fifth.type = 'triangle';
    fifth.frequency.setValueAtTime(root * 1.5, t);
    fifth.frequency.exponentialRampToValueAtTime(root * 2.0, t + 0.08);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2100, t);
    lp.frequency.exponentialRampToValueAtTime(850, t + 0.18);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.085, t + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

    osc.connect(lp);
    fifth.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    fifth.start(t);
    osc.stop(t + 0.21);
    fifth.stop(t + 0.21);
  }

  // Yuzu Munch / Fruit Chomp
  public playChomp(): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(humanizePitch(290, step, 0.06), t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.1);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1050, t);
    filter.frequency.exponentialRampToValueAtTime(340, t + 0.11);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.095, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dry);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  // Splash in Hot Spring / Home Pool / Lagoon (Filtered Liquid Spray + Soft Water Bubble)
  public playSplash(): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(humanizePitch(310, step, 0.06), t);
    osc.frequency.exponentialRampToValueAtTime(105, t + 0.19);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.27);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1100, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.11, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.29);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    osc.stop(t + 0.31);

    if (this.noiseBuffer) {
      const spray = this.ctx.createBufferSource();
      spray.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(humanizePitch(860, step, 0.07), t);
      bp.frequency.exponentialRampToValueAtTime(320, t + 0.24);
      bp.Q.value = 1.6;
      const sGain = this.ctx.createGain();
      sGain.gain.setValueAtTime(0.001, t);
      sGain.gain.linearRampToValueAtTime(0.1, t + 0.012);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      spray.connect(bp);
      bp.connect(sGain);
      sGain.connect(dry);
      spray.start(t, 0, 0.27);
    }
  }

  // Warm Acoustic Chord Fanfare (Level Up / Prestige / Bounty Complete)
  public playPrestigeFanfare(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const notes = [392.0, 493.88, 587.33, 783.99]; // Warm G4-B4-D5-G5
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + idx * 0.088;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1950, t);
      lp.frequency.exponentialRampToValueAtTime(750, t + 0.38);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.095, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

      osc.connect(lp);
      lp.connect(gain);
      gain.connect(dry);
      if (this.reverbInput) gain.connect(this.reverbInput);

      osc.start(t);
      osc.stop(t + 0.44);
    });
  }

  public playBigBang(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(62, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.38);
    osc.frequency.exponentialRampToValueAtTime(52, t + 1.8);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(104, t);
    subOsc.frequency.exponentialRampToValueAtTime(34, t + 2.0);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1450, t);
    filter.frequency.exponentialRampToValueAtTime(210, t + 1.9);

    gain.gain.setValueAtTime(0.005, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.05);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    subOsc.start(t);
    osc.stop(t + 2.1);
    subOsc.stop(t + 2.1);
  }

  // Warm Airy Space-Wind Swell + Soft Sub-Harmonic Shimmer (replaces piercing 2-octave siren sweep)
  public playCosmicWarp(pitchMultiplier: number = 1.0): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastWarpMs, now, 115)) return;
    this.lastWarpMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const mult = Math.max(0.7, Math.min(1.5, pitchMultiplier));
    const step = this.nextStep();
    const baseHz = humanizePitch(164.81 * mult, step, 0.03); // Warm E3 root

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(baseHz, t);
    oscA.frequency.exponentialRampToValueAtTime(baseHz * 1.35, t + 0.28);

    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(baseHz * 1.5, t);
    oscB.frequency.exponentialRampToValueAtTime(baseHz * 2.0, t + 0.28);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(720, t);
    lp.frequency.exponentialRampToValueAtTime(1450, t + 0.14);
    lp.frequency.exponentialRampToValueAtTime(420, t + 0.36);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.068, t + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.36);

    oscA.connect(lp);
    oscB.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    oscA.start(t);
    oscB.start(t);
    oscA.stop(t + 0.38);
    oscB.stop(t + 0.38);

    if (this.noiseBuffer) {
      const air = this.ctx.createBufferSource();
      air.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(340 * mult, t);
      bp.frequency.exponentialRampToValueAtTime(980 * mult, t + 0.16);
      bp.frequency.exponentialRampToValueAtTime(310, t + 0.34);
      bp.Q.value = 1.2;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.001, t);
      nGain.gain.linearRampToValueAtTime(0.052, t + 0.05);
      nGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);
      air.connect(bp);
      bp.connect(nGain);
      nGain.connect(dry);
      air.start(t, 0, 0.36);
    }
  }

  // ============================================================================
  // MODE-AWARE AMBIENT SOUNDSCAPE (Replaces repetitive random bare sine boops!)
  // ============================================================================

  public startAmbientMusic(): void {
    if (this.isMuted || this.isGamePaused || this.isMusicPlaying) return;
    this.initContext();
    this.isMusicPlaying = true;

    const scheduleNextPhrase = () => {
      if (this.isMuted || !this.isMusicPlaying) return;
      const musicOut = this.getMusicNode();
      const plan = computeAmbientPhrasePlan(
        this.ambientMode,
        this.musicPhraseIndex++,
        Math.random()
      );

      if (
        plan.shouldPluck &&
        this.mixer.musicVolume > 0.005 &&
        this.ctx &&
        musicOut &&
        this.ctx.state === 'running'
      ) {
        const t = this.ctx.currentTime;
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const lp = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        // Warm low-passed Rhodes/kalimba dyad — zero piercing treble!
        oscA.type = 'sine';
        oscA.frequency.setValueAtTime(plan.rootHz, t);
        oscB.type = 'sine';
        oscB.frequency.setValueAtTime(plan.harmonyHz * 1.002, t + 0.04);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(plan.lowpassHz, t);
        lp.frequency.exponentialRampToValueAtTime(360, t + plan.decaySec);
        lp.Q.value = 0.6;

        gain.gain.setValueAtTime(0.0006, t);
        gain.gain.linearRampToValueAtTime(plan.peakGain, t + plan.attackSec);
        gain.gain.exponentialRampToValueAtTime(0.0003, t + plan.decaySec);

        oscA.connect(lp);
        oscB.connect(lp);
        lp.connect(gain);
        gain.connect(musicOut);
        if (this.reverbInput) gain.connect(this.reverbInput);

        oscA.start(t);
        oscB.start(t + 0.04);
        oscA.stop(t + plan.decaySec + 0.08);
        oscB.stop(t + plan.decaySec + 0.08);
      }

      if (typeof window !== 'undefined') {
        this.musicTimer = window.setTimeout(scheduleNextPhrase, plan.nextDelayMs);
      }
    };

    // Wait a calm initial breath before the first Forest ambient chord
    if (typeof window !== 'undefined') {
      this.musicTimer = window.setTimeout(scheduleNextPhrase, 2400);
    }
  }

  public stopAmbientMusic(): void {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private fadeOutCosmicDrone(): void {
    if (this.cosmicDroneGain && this.ctx && this.ctx.state !== 'closed') {
      try {
        this.cosmicDroneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.18);
      } catch {
        // Ignore AudioParam state errors
      }
    }
  }

  /**
   * Smooth, warm sub-harmonic celestial pad for Infinite Zoom.
   * Never creates AudioContext prematurely; silently fades out outside cosmic mode.
   */
  public updateCosmicAmbient(logMeters: number, isInCosmic: boolean): void {
    if (!this.ctx || !this.musicBus) return;
    const mix = computeCosmicDroneMix(
      logMeters,
      isInCosmic && !this.isGamePaused,
      this.isMuted,
      this.mixer.musicVolume
    );

    if (mix.targetGain <= 0) {
      this.fadeOutCosmicDrone();
      return;
    }

    if (!this.cosmicDroneGain) {
      try {
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        oscA.type = 'sine';
        oscA.frequency.value = mix.baseHz;
        oscB.type = 'sine';
        oscB.frequency.value = mix.fifthHz;

        filter.type = 'lowpass';
        filter.frequency.value = mix.filterHz;
        filter.Q.value = 0.7;

        gain.gain.value = 0;

        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicBus);

        oscA.start();
        oscB.start();

        this.cosmicDroneOscA = oscA;
        this.cosmicDroneOscB = oscB;
        this.cosmicDroneFilter = filter;
        this.cosmicDroneGain = gain;
      } catch {
        return;
      }
    }

    try {
      const t = this.ctx.currentTime;
      this.cosmicDroneOscA?.frequency.setTargetAtTime(mix.baseHz, t, 0.45);
      this.cosmicDroneOscB?.frequency.setTargetAtTime(mix.fifthHz, t, 0.45);
      this.cosmicDroneFilter?.frequency.setTargetAtTime(mix.filterHz, t, 0.45);
      this.cosmicDroneGain?.gain.setTargetAtTime(mix.targetGain, t, 0.45);
    } catch {
      // Ignore AudioParam errors during suspend/close
    }
  }

  // Soft damped harmonic scale-band detent (rate-limited so fast scrolling stays smooth)
  public playScaleCardChime(
    domain: 'cosmic' | 'stellar' | 'planetary' | 'terrestrial' | 'microscopic' | 'quantum'
  ): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastScaleChimeMs, now, 180)) return;
    this.lastScaleChimeMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const domainRootFreqs: Record<typeof domain, [number, number]> = {
      cosmic: [220.0, 329.63],
      stellar: [246.94, 369.99],
      planetary: [261.63, 392.0],
      terrestrial: [293.66, 440.0],
      microscopic: [329.63, 493.88],
      quantum: [349.23, 523.25],
    };
    const [rootHz, fifthHz] = domainRootFreqs[domain] || [293.66, 440.0];
    const t = this.ctx.currentTime;
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(rootHz, t);
    oscB.type = 'sine';
    oscB.frequency.setValueAtTime(fifthHz, t + 0.035);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(520, t + 0.28);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.048, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.29);

    oscA.connect(lp);
    oscB.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    oscA.start(t);
    oscB.start(t + 0.035);
    oscA.stop(t + 0.31);
    oscB.stop(t + 0.31);
  }

  public speakScaleCardCaption(text: string): void {
    if (this.isMuted || typeof window === 'undefined' || !text.trim()) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1.04;
      utter.volume = Math.max(0.1, Math.min(1, this.mixer.masterVolume));
      synth.speak(utter);
    } catch {
      // Ignore speech synthesis restrictions cleanly
    }
  }

  public playComboChime(comboCount: number): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastComboChimeMs, now, 55)) return;
    this.lastComboChimeMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const pentatonic = [349.23, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
    const idx = Math.max(0, Math.min(pentatonic.length - 1, comboCount - 1));
    const freq = pentatonic[idx];
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const harm = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    harm.type = 'triangle';
    harm.frequency.setValueAtTime(freq * 1.5, t);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2100, t);
    lp.frequency.exponentialRampToValueAtTime(820, t + 0.21);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.068, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);

    osc.connect(lp);
    harm.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    osc.start(t);
    harm.start(t);
    osc.stop(t + 0.24);
    harm.stop(t + 0.24);
  }

  public playDashWhoosh(): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry || !this.noiseBuffer) return;

    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(380, t);
    filter.frequency.exponentialRampToValueAtTime(1420, t + 0.09);
    filter.frequency.exponentialRampToValueAtTime(310, t + 0.24);
    filter.Q.value = 1.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dry);
    src.start(t, 0, 0.26);
  }

  public playDescentRingChime(ringIndex: number): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const scale = [329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const root = scale[Math.max(0, Math.min(scale.length - 1, ringIndex))];
    const t = this.ctx.currentTime;

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(root, t);
    oscB.type = 'sine';
    oscB.frequency.setValueAtTime(root * 1.5, t + 0.04);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1750, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.085, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);

    oscA.connect(lp);
    oscB.connect(lp);
    lp.connect(gain);
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
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastCapytorioPlaceMs, now, isDrag ? 52 : 30)) return;
    this.lastCapytorioPlaceMs = now;
    const step = this.nextStep();

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const profile = selectCapytorioPlacementProfile(machineType);
    const t = this.ctx.currentTime;
    const jitter = humanizePitch(100, step, 0.045) / 100;

    if (profile === 'belt') {
      const click = this.ctx.createOscillator();
      const body = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      click.type = 'triangle';
      click.frequency.setValueAtTime(840 * jitter, t);
      click.frequency.exponentialRampToValueAtTime(320 * jitter, t + 0.045);

      body.type = 'sine';
      body.frequency.setValueAtTime(160 * jitter, t);
      body.frequency.exponentialRampToValueAtTime(84, t + 0.055);

      lp.type = 'lowpass';
      lp.frequency.value = 2200;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(isDrag ? 0.078 : 0.1, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      click.connect(lp);
      body.connect(lp);
      lp.connect(gain);
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
        hp.frequency.value = 2300 * jitter;
        hp.Q.value = 2.4;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(isDrag ? 0.04 : 0.055, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
        snap.connect(hp);
        hp.connect(nGain);
        nGain.connect(dry);
        snap.start(t, 0, 0.04);
      }
      return;
    }

    if (profile === 'servo') {
      const servo = this.ctx.createOscillator();
      const lock = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      servo.type = 'sawtooth';
      servo.frequency.setValueAtTime(300 * jitter, t);
      servo.frequency.exponentialRampToValueAtTime(680 * jitter, t + 0.065);

      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 1050;
      filt.Q.value = 2.2;

      lock.type = 'triangle';
      lock.frequency.setValueAtTime(200, t + 0.04);
      lock.frequency.exponentialRampToValueAtTime(110, t + 0.11);

      gain.gain.setValueAtTime(0.088, t);
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
      const thud = this.ctx.createOscillator();
      const latch = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      thud.type = 'triangle';
      thud.frequency.setValueAtTime(170 * jitter, t);
      thud.frequency.exponentialRampToValueAtTime(72, t + 0.09);

      latch.type = 'sine';
      latch.frequency.setValueAtTime(980 * jitter, t + 0.025);
      latch.frequency.exponentialRampToValueAtTime(580, t + 0.075);

      lp.type = 'lowpass';
      lp.frequency.value = 1800;

      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.115);

      thud.connect(lp);
      latch.connect(lp);
      lp.connect(gain);
      gain.connect(dry);

      thud.start(t);
      latch.start(t + 0.025);
      thud.stop(t + 0.11);
      latch.stop(t + 0.09);
      return;
    }

    const sub = this.ctx.createOscillator();
    const clank = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    sub.type = 'sine';
    sub.frequency.setValueAtTime(106 * jitter, t);
    sub.frequency.exponentialRampToValueAtTime(42, t + 0.14);

    clank.type = 'triangle';
    clank.frequency.setValueAtTime(480 * jitter, t + 0.012);
    clank.frequency.exponentialRampToValueAtTime(205, t + 0.11);

    gain.gain.setValueAtTime(0.14, t);
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
      bp.frequency.setValueAtTime(1750, t + 0.02);
      bp.frequency.exponentialRampToValueAtTime(880, t + 0.14);
      bp.Q.value = 1.8;
      const hGain = this.ctx.createGain();
      hGain.gain.setValueAtTime(0.06, t + 0.02);
      hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      hiss.connect(bp);
      bp.connect(hGain);
      hGain.connect(dry);
      hiss.start(t + 0.02, 0, 0.16);
    }
  }

  public playCapytorioDemolish(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastCapytorioPlaceMs, now, 38)) return;
    this.lastCapytorioPlaceMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const wrench = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    wrench.type = 'sawtooth';
    wrench.frequency.setValueAtTime(320, t);
    wrench.frequency.exponentialRampToValueAtTime(135, t + 0.11);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(360, t + 0.12);

    sub.type = 'sine';
    sub.frequency.setValueAtTime(138, t);
    sub.frequency.exponentialRampToValueAtTime(56, t + 0.12);

    gain.gain.setValueAtTime(0.11, t);
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
      bp.frequency.value = 1150;
      bp.Q.value = 2.4;
      const sGain = this.ctx.createGain();
      sGain.gain.setValueAtTime(0.055, t);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      scrape.connect(bp);
      bp.connect(sGain);
      sGain.connect(dry);
      scrape.start(t, 0, 0.095);
    }
  }

  public playCapytorioRotate(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const pawl = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    pawl.type = 'triangle';
    pawl.frequency.setValueAtTime(humanizePitch(560, step, 0.04), t);
    pawl.frequency.exponentialRampToValueAtTime(920, t + 0.032);

    lp.type = 'lowpass';
    lp.frequency.value = 1650;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.062, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.052);

    pawl.connect(lp);
    lp.connect(gain);
    gain.connect(dry);

    pawl.start(t);
    pawl.stop(t + 0.058);
  }

  public playCapytorioMine(kind: 'ore' | 'tree'): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastCapytorioMineMs, now, 60)) return;
    this.lastCapytorioMineMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const jitter = humanizePitch(100, step, 0.065) / 100;

    if (kind === 'tree') {
      const knock = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      knock.type = 'triangle';
      knock.frequency.setValueAtTime(215 * jitter, t);
      knock.frequency.exponentialRampToValueAtTime(86, t + 0.095);
      gain.gain.setValueAtTime(0.13, t);
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
        bp.frequency.setValueAtTime(920 * jitter, t + 0.015);
        bp.frequency.exponentialRampToValueAtTime(410, t + 0.16);
        bp.Q.value = 1.4;
        const rGain = this.ctx.createGain();
        rGain.gain.setValueAtTime(0.075, t + 0.015);
        rGain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
        rustle.connect(bp);
        bp.connect(rGain);
        rGain.connect(dry);
        rustle.start(t + 0.015, 0, 0.18);
      }
      return;
    }

    const pingA = this.ctx.createOscillator();
    const pingB = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    pingA.type = 'sine';
    pingA.frequency.setValueAtTime(1480 * jitter, t);
    pingA.frequency.exponentialRampToValueAtTime(1180 * jitter, t + 0.11);

    pingB.type = 'triangle';
    pingB.frequency.setValueAtTime(2220 * jitter, t);
    pingB.frequency.exponentialRampToValueAtTime(1780 * jitter, t + 0.085);

    lp.type = 'lowpass';
    lp.frequency.value = 2800;

    gain.gain.setValueAtTime(0.082, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    pingA.connect(lp);
    pingB.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    pingA.start(t);
    pingB.start(t);
    pingA.stop(t + 0.14);
    pingB.stop(t + 0.1);

    if (this.noiseBuffer) {
      const crunch = this.ctx.createBufferSource();
      crunch.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1800 * jitter, t);
      bp.Q.value = 1.9;
      const cGain = this.ctx.createGain();
      cGain.gain.setValueAtTime(0.078, t);
      cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      crunch.connect(bp);
      bp.connect(cGain);
      cGain.connect(dry);
      crunch.start(t, 0, 0.09);
    }
  }

  public playCapytorioPickup(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastCapytorioUiMs, now, 48)) return;
    this.lastCapytorioUiMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const step = this.nextStep();
    const f0 = humanizePitch(420, step, 0.045);
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.48, t + 0.06);
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.062, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    osc.start(t);
    osc.stop(t + 0.085);
  }

  public playCapytorioCraftQueue(kind: 'start' | 'complete' | 'cancel'): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    if (kind === 'start') {
      this.playUiClick('toggle_on');
      return;
    }
    if (kind === 'cancel') {
      this.playUiClick('toggle_off');
      return;
    }

    const notes = [523.25, 783.99];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      const st = t + i * 0.055;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], st);
      lp.type = 'lowpass';
      lp.frequency.value = 1900;
      gain.gain.setValueAtTime(0.001, st);
      gain.gain.linearRampToValueAtTime(0.068, st + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
      osc.connect(lp);
      lp.connect(gain);
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
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    if (kind === 'paste') {
      const taps = Math.max(1, Math.min(4, Math.ceil(count / 2)));
      for (let i = 0; i < taps; i++) {
        const st = t + i * 0.042;
        const osc = this.ctx.createOscillator();
        const lp = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260 + i * 80, st);
        osc.frequency.exponentialRampToValueAtTime(135 + i * 35, st + 0.065);
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        gain.gain.setValueAtTime(0.082, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.078);
        osc.connect(lp);
        lp.connect(gain);
        gain.connect(dry);
        if (this.reverbInput) gain.connect(this.reverbInput);
        osc.start(st);
        osc.stop(st + 0.082);
      }
      return;
    }

    this.playUiClick(kind === 'cut' ? 'toggle_off' : 'select');
  }

  public playCapytorioSettings(kind: 'copy' | 'paste'): void {
    this.playUiClick(kind === 'copy' ? 'toggle_on' : 'select');
  }

  public playCapytorioFuelLoad(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(92, t);
    sub.frequency.exponentialRampToValueAtTime(150, t + 0.14);
    sub.frequency.exponentialRampToValueAtTime(68, t + 0.28);
    sGain.gain.setValueAtTime(0.115, t);
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
      lp.frequency.exponentialRampToValueAtTime(1350, t + 0.12);
      lp.frequency.exponentialRampToValueAtTime(340, t + 0.28);
      const fGain = this.ctx.createGain();
      fGain.gain.setValueAtTime(0.015, t);
      fGain.gain.linearRampToValueAtTime(0.115, t + 0.09);
      fGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      flare.connect(lp);
      lp.connect(fGain);
      fGain.connect(dry);
      flare.start(t, 0, 0.32);
    }
  }

  public playCapytorioScienceFeed(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const notes = [440.0, 587.33, 880.0];
    for (let i = 0; i < notes.length; i++) {
      const st = t + i * 0.048;
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], st);
      osc.frequency.exponentialRampToValueAtTime(notes[i] * 1.04, st + 0.11);
      lp.type = 'lowpass';
      lp.frequency.value = 1850;
      gain.gain.setValueAtTime(0.001, st);
      gain.gain.linearRampToValueAtTime(0.062, st + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(dry);
      if (this.reverbInput) gain.connect(this.reverbInput);
      osc.start(st);
      osc.stop(st + 0.19);
    }
  }

  public playCapytorioTechComplete(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const notes = [329.63, 392.0, 493.88, 659.25, 783.99];
    for (let i = 0; i < notes.length; i++) {
      const st = t + i * 0.082;
      const osc = this.ctx.createOscillator();
      const harm = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i], st);
      harm.type = 'sine';
      harm.frequency.setValueAtTime(notes[i] * 2, st);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2100, st);
      lp.frequency.exponentialRampToValueAtTime(760, st + 0.42);
      gain.gain.setValueAtTime(0.001, st);
      gain.gain.linearRampToValueAtTime(0.08, st + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.42);
      osc.connect(lp);
      harm.connect(lp);
      lp.connect(gain);
      gain.connect(dry);
      if (this.reverbInput) gain.connect(this.reverbInput);
      osc.start(st);
      harm.start(st);
      osc.stop(st + 0.44);
      harm.stop(st + 0.44);
    }
  }

  public playCapytorioRocketLaunch(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const turbine = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(55, t);
    sub.frequency.exponentialRampToValueAtTime(118, t + 1.35);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(240, t);
    lp.frequency.exponentialRampToValueAtTime(1450, t + 1.15);
    lp.frequency.exponentialRampToValueAtTime(420, t + 1.85);

    turbine.type = 'triangle';
    turbine.frequency.setValueAtTime(210, t + 0.15);
    turbine.frequency.exponentialRampToValueAtTime(760, t + 1.45);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.145, t + 0.25);
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
      bp.frequency.exponentialRampToValueAtTime(1200, t + 1.2);
      bp.Q.value = 0.9;
      const rGain = this.ctx.createGain();
      rGain.gain.setValueAtTime(0.01, t);
      rGain.gain.linearRampToValueAtTime(0.14, t + 0.22);
      rGain.gain.exponentialRampToValueAtTime(0.001, t + 1.85);
      roar.connect(bp);
      bp.connect(rGain);
      rGain.connect(dry);
      roar.start(t);
      roar.stop(t + 1.9);
    }

    const chord = [392.0, 493.88, 587.33, 783.99];
    for (let i = 0; i < chord.length; i++) {
      const st = t + 0.45 + i * 0.08;
      const osc = this.ctx.createOscillator();
      const cLp = this.ctx.createBiquadFilter();
      const cGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(chord[i], st);
      cLp.type = 'lowpass';
      cLp.frequency.value = 1800;
      cGain.gain.setValueAtTime(0.001, st);
      cGain.gain.linearRampToValueAtTime(0.068, st + 0.02);
      cGain.gain.exponentialRampToValueAtTime(0.001, st + 0.9);
      osc.connect(cLp);
      cLp.connect(cGain);
      cGain.connect(dry);
      if (this.reverbInput) cGain.connect(this.reverbInput);
      osc.start(st);
      osc.stop(st + 0.95);
    }
  }

  // Soft muted wood/brass double thud (replaces harsh sawtooth buzz)
  public playCapytorioError(): void {
    if (this.isMuted || this.mixer.sfxVolume <= 0.005) return;
    const now = this.nowMs();
    if (!canTriggerVoice(this.lastCapytorioUiMs, now, 85)) return;
    this.lastCapytorioUiMs = now;

    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry) return;

    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const st = t + i * 0.072;
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i === 0 ? 185 : 146, st);
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      gain.gain.setValueAtTime(0.001, st);
      gain.gain.linearRampToValueAtTime(0.068, st + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.062);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(dry);
      osc.start(st);
      osc.stop(st + 0.068);
    }
  }

  // Crisp mechanical tactile switch routed through uiBus (replaces digital triangle beep)
  public playCapytorioUiClick(kind: 'tool' | 'alt_on' | 'alt_off' | 'pipette' = 'tool'): void {
    if (kind === 'alt_on') {
      this.playUiClick('toggle_on');
    } else if (kind === 'alt_off') {
      this.playUiClick('toggle_off');
    } else if (kind === 'pipette') {
      this.playUiClick('select');
    } else {
      this.playUiClick('tap');
    }
  }

  /**
   * Smooth, cozy background industrial turbine hum when active Capytorio machines are running.
   * Never initializes AudioContext prematurely and ramps silently to 0 when idle, muted, or outside Capytorio.
   */
  public updateCapytorioAmbient(
    activeMachineCount: number,
    powerEfficiency: number,
    isInCapytorio: boolean
  ): void {
    if (!this.ctx || !this.musicBus) return;
    const mix = computeCapytorioAmbientMix(
      activeMachineCount,
      powerEfficiency,
      isInCapytorio && !this.isGamePaused,
      this.isMuted || this.mixer.musicVolume <= 0.005
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
        oscB.frequency.value = mix.humHz * 2.01;

        filter.type = 'lowpass';
        filter.frequency.value = mix.filterHz;
        filter.Q.value = 0.8;

        gain.gain.value = 0;

        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicBus);

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

    try {
      const t = this.ctx.currentTime;
      this.factoryHumOscA?.frequency.setTargetAtTime(mix.humHz, t, 0.25);
      this.factoryHumOscB?.frequency.setTargetAtTime(mix.humHz * 2.01, t, 0.25);
      this.factoryHumFilter?.frequency.setTargetAtTime(mix.filterHz, t, 0.25);
      this.factoryHumGain?.gain.setTargetAtTime(mix.targetGain, t, 0.25);
    } catch {
      // Ignore AudioParam state errors during suspend/close transitions
    }
  }

  public playUfoTouchdown(): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry || this.ctx.state !== 'running') return;

    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const hum = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    sub.type = 'sine';
    sub.frequency.setValueAtTime(118, t);
    sub.frequency.exponentialRampToValueAtTime(46, t + 0.28);

    hum.type = 'triangle';
    hum.frequency.setValueAtTime(320, t);
    hum.frequency.exponentialRampToValueAtTime(110, t + 0.48);

    lp.type = 'lowpass';
    lp.frequency.value = 1100;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.52);

    sub.connect(lp);
    hum.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    sub.start(t);
    hum.start(t);
    sub.stop(t + 0.54);
    hum.stop(t + 0.54);

    if (this.noiseBuffer) {
      const hiss = this.ctx.createBufferSource();
      hiss.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1450, t);
      bp.frequency.exponentialRampToValueAtTime(450, t + 0.26);
      bp.Q.value = 1.6;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.075, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      hiss.connect(bp);
      bp.connect(nGain);
      nGain.connect(dry);
      hiss.start(t, 0, 0.3);
    }
  }

  public playUfoLiftoff(): void {
    if (this.isMuted || this.isGamePaused || this.mixer.sfxVolume <= 0.005) return;
    this.initContext();
    const dry = this.getSfxNode();
    if (!this.ctx || !dry || this.ctx.state !== 'running') return;

    const t = this.ctx.currentTime;
    const turbine = this.ctx.createOscillator();
    const harmonic = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    turbine.type = 'sine';
    turbine.frequency.setValueAtTime(110, t);
    turbine.frequency.exponentialRampToValueAtTime(440, t + 0.95);
    turbine.frequency.exponentialRampToValueAtTime(660, t + 1.45);

    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(220, t);
    harmonic.frequency.exponentialRampToValueAtTime(659.25, t + 1.1);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.exponentialRampToValueAtTime(1950, t + 1.1);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.135, t + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    turbine.connect(lp);
    harmonic.connect(lp);
    lp.connect(gain);
    gain.connect(dry);
    if (this.reverbInput) gain.connect(this.reverbInput);

    turbine.start(t);
    harmonic.start(t);
    turbine.stop(t + 1.54);
    harmonic.stop(t + 1.54);

    if (this.noiseBuffer) {
      const wash = this.ctx.createBufferSource();
      wash.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(280, t);
      bp.frequency.exponentialRampToValueAtTime(1250, t + 0.35);
      bp.Q.value = 1.2;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.08, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      wash.connect(bp);
      bp.connect(nGain);
      nGain.connect(dry);
      wash.start(t, 0, 0.35);
    }
  }

  private stopAllContinuousDrones(): void {
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

    try {
      this.cosmicDroneOscA?.stop();
      this.cosmicDroneOscB?.stop();
    } catch {
      // Ignore already-stopped oscillators
    }
    this.cosmicDroneOscA = null;
    this.cosmicDroneOscB = null;
    this.cosmicDroneFilter = null;
    this.cosmicDroneGain = null;
  }

  public suspendForPause(): void {
    if (this.isGamePaused) return;
    this.isGamePaused = true;
    this.wasMusicPlayingBeforePause = this.isMusicPlaying;
    this.stopAmbientMusic();
    this.stopAllContinuousDrones();
    try {
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel();
      }
    } catch {
      // Ignore speechSynthesis availability issues
    }
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public resumeFromPause(): void {
    if (!this.isGamePaused) return;
    this.isGamePaused = false;
    if (!this.isMuted && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.wasMusicPlayingBeforePause && !this.isMuted) {
      this.wasMusicPlayingBeforePause = false;
      this.startAmbientMusic();
    }
  }

  public dispose(): void {
    this.isGamePaused = false;
    this.wasMusicPlayingBeforePause = false;
    this.stopAmbientMusic();
    this.stopAllContinuousDrones();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.resetNodes();
  }
}

export const AudioService = new CapyAudioService();
