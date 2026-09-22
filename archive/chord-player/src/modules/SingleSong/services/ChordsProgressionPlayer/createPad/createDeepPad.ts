import * as Tone from "tone";
import {buildPadVoice} from "./buildPadVoice";

/**
 * «Глибина»: темний пед із суб-октавою. Основний шар сильно зафільтрований
 * згори, синусовий шар октавою нижче додає фундамент — фон, що «тримає» залу,
 * не займаючи середину, де живуть вокал і акорди піаніно.
 */
export const createDeepPad = () => {
  const main = new Tone.PolySynth(Tone.Synth, {
    oscillator: {type: "fatsawtooth", count: 3, spread: 20},
    envelope: {attack: 2.2, decay: 0.6, sustain: 0.95, release: 6},
  });
  main.volume.value = -15;

  const sub = new Tone.PolySynth(Tone.Synth, {
    oscillator: {type: "sine"},
    envelope: {attack: 2.5, decay: 0.5, sustain: 0.9, release: 5},
  });
  sub.volume.value = -18;

  return buildPadVoice(
    [
      {synth: main},
      {synth: sub, transpose: -12, velocity: 0.8},
    ],
    [
      new Tone.Filter({type: "lowpass", frequency: 900, Q: 0.5}),
      new Tone.EQ3({low: 1, mid: -3, high: -6}),
      new Tone.Chorus({frequency: 0.25, delayTime: 6, depth: 0.4, wet: 0.3, spread: 140}).start(),
      new Tone.Reverb({decay: 9, preDelay: 0.04, wet: 0.45}),
    ],
  );
};
