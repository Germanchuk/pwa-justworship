import * as Tone from "tone";
import {buildPadVoice} from "./buildPadVoice";

/**
 * «Оксамит»: теплий синусовий пед без «блиску» — fatsine у м'який лоу-пас і
 * рівний реверб. Максимально нейтральна підкладка, що не конкурує з вокалом.
 */
export const createWarmPad = () => {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {type: "fatsine", count: 3, spread: 18},
    envelope: {attack: 2.5, decay: 0.5, sustain: 0.9, release: 6},
  });
  synth.volume.value = -10;

  return buildPadVoice(
    [{synth}],
    [
      new Tone.Filter({type: "lowpass", frequency: 1400, Q: 0.4}),
      new Tone.Reverb({decay: 6, preDelay: 0.03, wet: 0.4}),
    ],
  );
};
