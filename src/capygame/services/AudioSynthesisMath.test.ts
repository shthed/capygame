import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AUDIO_MIXER_SETTINGS,
  canTriggerVoice,
  computeAmbientPhrasePlan,
  computeCapytorioAmbientMix,
  computeCosmicDroneMix,
  humanizePitch,
  normalizeAudioMixerSettings,
  selectCapytorioPlacementProfile,
  volumeToPerceptualGain,
} from './AudioSynthesisMath';

describe('AudioSynthesisMath (Studio 3-Bus Mixer & Anti-Fatigue DSP)', () => {
  it('normalizes and clamps audio mixer settings cleanly with backward-compatible defaults', () => {
    const def = normalizeAudioMixerSettings(undefined);
    assert.deepEqual(def, DEFAULT_AUDIO_MIXER_SETTINGS);

    const clamped = normalizeAudioMixerSettings({
      masterVolume: 1.8,
      sfxVolume: -0.4,
      musicVolume: Number.NaN,
      uiSoundsEnabled: false,
    });
    assert.equal(clamped.masterVolume, 1);
    assert.equal(clamped.sfxVolume, 0);
    assert.equal(clamped.musicVolume, DEFAULT_AUDIO_MIXER_SETTINGS.musicVolume);
    assert.equal(clamped.uiSoundsEnabled, false);
  });

  it('applies a monotonic perceptual gain taper that makes mid-slider levels comfortable', () => {
    const zero = volumeToPerceptualGain(0);
    const half = volumeToPerceptualGain(0.5);
    const full = volumeToPerceptualGain(1.0);
    assert.equal(zero, 0);
    assert.ok(half > 0.2 && half < 0.38, `Expected perceptual half gain ~0.30, got ${half}`);
    assert.equal(full, 1);
  });

  it('humanizes pitch organically within bounded spread across consecutive steps', () => {
    const samples = new Set<number>();
    for (let i = 0; i < 16; i++) {
      const hz = humanizePitch(440, i, 0.05);
      assert.ok(hz >= 418 && hz <= 462, `Pitch ${hz} exceeded ±5% bounds`);
      samples.add(hz);
    }
    assert.ok(samples.size >= 12, 'Pitch humanizer must vary across consecutive steps');
  });

  it('enforces anti-spam cooldown gating for rapid voice triggers', () => {
    assert.equal(canTriggerVoice(0, 100, 50), true);
    assert.equal(canTriggerVoice(100, 130, 50), false);
    assert.equal(canTriggerVoice(100, 150, 50), true);
  });

  it('spaces Forest ambient dyads with restful breathing silences and mutes plucks in Cosmic/Capytorio', () => {
    const forestNormal = computeAmbientPhrasePlan('forest', 1, 0.5);
    assert.equal(forestNormal.shouldPluck, true);
    assert.ok(forestNormal.nextDelayMs >= 5400, 'Forest phrases must leave restful pauses >= 5.4s');
    assert.ok(forestNormal.lowpassHz <= 1100, 'Forest phrases must stay warm and low-pass filtered');

    const forestBreath = computeAmbientPhrasePlan('forest', 4, 0.5);
    assert.ok(forestBreath.nextDelayMs > forestNormal.nextDelayMs, 'Breath pause should extend silence');

    const cosmic = computeAmbientPhrasePlan('cosmic', 1, 0.5);
    assert.equal(cosmic.shouldPluck, false);

    const capytorio = computeAmbientPhrasePlan('capytorio', 1, 0.5);
    assert.equal(capytorio.shouldPluck, false);
  });

  it('maps Infinite Zoom scale smoothly into warm cosmic drone parameters', () => {
    const muted = computeCosmicDroneMix(12, true, true, 0.5);
    assert.equal(muted.targetGain, 0);

    const outside = computeCosmicDroneMix(12, false, false, 0.5);
    assert.equal(outside.targetGain, 0);

    const macro = computeCosmicDroneMix(26, true, false, 0.6);
    const quantum = computeCosmicDroneMix(-32, true, false, 0.6);
    assert.ok(macro.targetGain > 0 && macro.targetGain < 0.04);
    assert.ok(quantum.baseHz > macro.baseHz, 'Quantum scale should rise smoothly in pitch');
    assert.ok(macro.filterHz <= 400 && quantum.filterHz <= 400);
  });

  it('preserves Capytorio placement profile selection and factory hum math', () => {
    assert.equal(selectCapytorioPlacementProfile('transport_belt'), 'belt');
    assert.equal(selectCapytorioPlacementProfile('fast_inserter'), 'servo');
    assert.equal(selectCapytorioPlacementProfile('iron_chest'), 'crate');
    assert.equal(selectCapytorioPlacementProfile('assembling_machine_1'), 'heavy');

    const idle = computeCapytorioAmbientMix(0, 1.0, true, false);
    assert.equal(idle.targetGain, 0);

    const active = computeCapytorioAmbientMix(12, 1.0, true, false);
    assert.ok(active.targetGain > 0.01);
  });
});
