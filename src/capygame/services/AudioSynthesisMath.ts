// Pure Deterministic Audio DSP, Mixer Curves & Mode-Aware Soundscape Math
// Zero Web Audio DOM dependencies — 100% unit-testable via node:test

export type CapytorioPlacementSoundProfile = 'heavy' | 'belt' | 'servo' | 'crate';
export type AmbientSoundscapeMode = 'cosmic' | 'forest' | 'capytorio';
export type UiClickKind = 'tap' | 'toggle_on' | 'toggle_off' | 'select' | 'back';

export interface AudioMixerSettings {
  masterVolume: number; // 0.0 .. 1.0
  sfxVolume: number; // 0.0 .. 1.0
  musicVolume: number; // 0.0 .. 1.0
  uiSoundsEnabled: boolean;
}

export const DEFAULT_AUDIO_MIXER_SETTINGS: Readonly<AudioMixerSettings> = Object.freeze({
  masterVolume: 0.8,
  sfxVolume: 0.75,
  musicVolume: 0.45,
  uiSoundsEnabled: true,
});

export function clampUnit(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export function normalizeAudioMixerSettings(
  raw?: Partial<AudioMixerSettings> | null
): AudioMixerSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AUDIO_MIXER_SETTINGS };
  }
  return {
    masterVolume: clampUnit(raw.masterVolume, DEFAULT_AUDIO_MIXER_SETTINGS.masterVolume),
    sfxVolume: clampUnit(raw.sfxVolume, DEFAULT_AUDIO_MIXER_SETTINGS.sfxVolume),
    musicVolume: clampUnit(raw.musicVolume, DEFAULT_AUDIO_MIXER_SETTINGS.musicVolume),
    uiSoundsEnabled:
      raw.uiSoundsEnabled === undefined
        ? DEFAULT_AUDIO_MIXER_SETTINGS.uiSoundsEnabled
        : Boolean(raw.uiSoundsEnabled),
  };
}

/**
 * Maps a linear 0..1 UI slider value into a smooth perceptual gain curve (x^1.75)
 * so 50% feels naturally half-loud instead of blasting near full volume.
 */
export function volumeToPerceptualGain(normalizedVolume: number, maxGain: number = 1.0): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(normalizedVolume) ? normalizedVolume : 0));
  if (clamped <= 0.001) return 0;
  return +(Math.pow(clamped, 1.75) * Math.max(0, maxGain)).toFixed(5);
}

/**
 * Deterministic organic pitch humanizer (±spreadRatio) so repeated footsteps,
 * jumps, pickups, and UI clicks never sound robotic or fatiguing.
 */
export function humanizePitch(
  baseHz: number,
  stepCounter: number,
  spreadRatio: number = 0.045
): number {
  const safeBase = Math.max(20, Number.isFinite(baseHz) ? baseHz : 220);
  const safeSpread = Math.max(0, Math.min(0.25, spreadRatio));
  // Golden-ratio quasi-random sequence in [-1, 1]
  const frac = ((Math.abs(Math.trunc(stepCounter)) * 0.61803398875) % 1) * 2 - 1;
  return +(safeBase * (1 + frac * safeSpread)).toFixed(3);
}

/**
 * Anti-spam polyphony cooldown gate.
 */
export function canTriggerVoice(
  lastTriggeredMs: number,
  nowMs: number,
  cooldownMs: number
): boolean {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastTriggeredMs)) return true;
  if (lastTriggeredMs <= 0) return true;
  return nowMs - lastTriggeredMs >= Math.max(0, cooldownMs);
}

export interface AmbientPhrasePlan {
  shouldPluck: boolean;
  rootHz: number;
  harmonyHz: number;
  lowpassHz: number;
  attackSec: number;
  decaySec: number;
  peakGain: number;
  nextDelayMs: number;
}

// Warm F-major9 / Lydian acoustic kalimba palette (lower, mellow register — no shrill upper octave!)
const FOREST_WARM_CHORD_VOICINGS: ReadonlyArray<readonly [number, number]> = [
  [174.61, 261.63], // F3 + C4 (warm open fifth)
  [220.0, 329.63], // A3 + E4
  [196.0, 293.66], // G3 + D4
  [261.63, 392.0], // C4 + G4
  [246.94, 329.63], // B3 + E4 (gentle suspension)
  [220.0, 293.66], // A3 + D4
];

/**
 * Computes calm, restful ambient musical phrasing per mode.
 * Forest plays soft, low-passed acoustic dyads with long 5.5s–10.5s breathing silences;
 * Cosmic and Capytorio rely on smooth continuous drones instead of periodic plucks.
 */
export function computeAmbientPhrasePlan(
  mode: AmbientSoundscapeMode,
  phraseIndex: number,
  jitterUnit: number = 0.5
): AmbientPhrasePlan {
  const j = Math.max(0, Math.min(1, Number.isFinite(jitterUnit) ? jitterUnit : 0.5));
  if (mode !== 'forest') {
    return {
      shouldPluck: false,
      rootHz: 0,
      harmonyHz: 0,
      lowpassHz: 420,
      attackSec: 0.25,
      decaySec: 1.5,
      peakGain: 0,
      nextDelayMs: 6500,
    };
  }

  const idx = Math.abs(Math.trunc(phraseIndex)) % FOREST_WARM_CHORD_VOICINGS.length;
  const [rootHz, harmonyHz] = FOREST_WARM_CHORD_VOICINGS[idx];
  // Every 4th phrase inserts an extra-long peaceful breathing pause
  const isBreathPause = phraseIndex > 0 && phraseIndex % 4 === 0;
  const baseDelayMs = isBreathPause ? 8200 : 5400;
  const nextDelayMs = Math.round(baseDelayMs + j * 3100);

  return {
    shouldPluck: true,
    rootHz,
    harmonyHz,
    lowpassHz: Math.round(780 + j * 260),
    attackSec: 0.065,
    decaySec: +(2.1 + j * 0.75).toFixed(2),
    peakGain: +(0.015 + j * 0.005).toFixed(4),
    nextDelayMs,
  };
}

export interface CosmicDroneMix {
  targetGain: number;
  baseHz: number;
  fifthHz: number;
  filterHz: number;
}

/**
 * Maps Infinite Zoom logarithmic scale (-35 .. +30 log10 meters) to a deep,
 * warm, non-fatiguing celestial drone pad.
 */
export function computeCosmicDroneMix(
  logMeters: number,
  isInCosmic: boolean,
  isMuted: boolean,
  musicVolume: number = DEFAULT_AUDIO_MIXER_SETTINGS.musicVolume
): CosmicDroneMix {
  if (isMuted || !isInCosmic || musicVolume <= 0.005) {
    return { targetGain: 0, baseHz: 73.42, fifthHz: 110.0, filterHz: 220 };
  }
  const clampedLog = Math.max(-35, Math.min(30, Number.isFinite(logMeters) ? logMeters : 0));
  // 0 at cosmic macro (+30), 1 at Planck quantum (-35)
  const depthT = (30 - clampedLog) / 65;
  const baseHz = +(58 + depthT * 38).toFixed(2); // 58 Hz (deep space) .. 96 Hz (quantum)
  const fifthHz = +(baseHz * 1.498).toFixed(2); // warm slightly detuned perfect fifth
  const filterHz = Math.round(210 + (1 - Math.abs(depthT - 0.5) * 1.4) * 160);
  const targetGain = volumeToPerceptualGain(musicVolume, 0.028);
  return { targetGain, baseHz, fifthHz, filterHz };
}

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
