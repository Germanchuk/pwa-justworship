import * as Tone from "tone";
import {buildPadVoice} from "./buildPadVoice";

/**
 * «Сяйво»: сучасний shimmer-пед. Два шари — тепла пилкова основа і тихий
 * октавний голос, що «розквітає» пізніше (довша атака), — у великий реверб.
 * Октавний шар у ревербі й дає той характерний ефект сяйва зверху.
 */
export const createShimmerPad = () => {
  const base = new Tone.PolySynth(Tone.Synth, {
    oscillator: {type: "fatsawtooth", count: 3, spread: 30},
    envelope: {attack: 1.8, decay: 0.5, sustain: 0.95, release: 6},
  });
  base.volume.value = -16;

  const octave = new Tone.PolySynth(Tone.Synth, {
    oscillator: {type: "fattriangle", count: 2, spread: 15},
    envelope: {attack: 3.5, decay: 0.4, sustain: 0.9, release: 7},
  });
  octave.volume.value = -22;

  return buildPadVoice(
    [
      {synth: base},
      {synth: octave, transpose: 12, velocity: 0.8},
    ],
    [
      new Tone.EQ3({low: -4, mid: -3, high: 2}),
      new Tone.Filter({type: "lowpass", frequency: 3500, Q: 0.5}),
      new Tone.Chorus({frequency: 0.3, delayTime: 5, depth: 0.5, wet: 0.35, spread: 160}).start(),
      new Tone.Reverb({decay: 12, preDelay: 0.05, wet: 0.65}),
    ],
  );
};
