import * as Tone from "tone";

/**
 * A lush, ethereal worship pad built from a fat detuned PolySynth, run through
 * a low-pass, gentle EQ tilt, slow chorus, and a long-tail reverb. No samples.
 *
 * Tuned for chord-stab triggering at ~quarter/half-note durations: long attack
 * (~2 s) smooths in, long release (~5 s) blurs into the next chord. Volume is
 * pre-attenuated so it sits under the piano stab without overwhelming it.
 */
export const createWorshipPad = () => {
  const reverb = new Tone.Reverb({decay: 8, preDelay: 0.04, wet: 0.5}).toDestination();
  const chorus = new Tone.Chorus({
    frequency: 0.5,
    delayTime: 4,
    depth: 0.7,
    wet: 0.55,
    spread: 180,
  })
    .start()
    .connect(reverb);
  const filter = new Tone.Filter({type: "lowpass", frequency: 2400, Q: 0.6}).connect(chorus);
  const eq = new Tone.EQ3({low: -3, mid: -2, high: 1}).connect(filter);

  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {type: "fatsawtooth", count: 3, spread: 40},
    envelope: {attack: 2.0, decay: 0.6, sustain: 0.95, release: 5.0},
  });
  synth.connect(eq);
  synth.volume.value = -14;

  return synth;
};
