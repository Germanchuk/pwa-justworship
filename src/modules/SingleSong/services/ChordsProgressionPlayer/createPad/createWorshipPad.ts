import * as Tone from "tone";
import {buildPadVoice} from "./buildPadVoice";

/**
 * «Аналог»: щільний worship-пед із детюнених пилок — низ підрізаний, повільний
 * хорус ворушить стерео, довгий реверб розмиває переходи. Це переосмислений
 * перший синт-пед проєкту, тепер без витоку ланцюга ефектів.
 */
export const createWorshipPad = () => {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {type: "fatsawtooth", count: 3, spread: 40},
    envelope: {attack: 2.0, decay: 0.6, sustain: 0.95, release: 5.0},
  });
  synth.volume.value = -14;

  return buildPadVoice(
    [{synth}],
    [
      new Tone.EQ3({low: -3, mid: -2, high: 1}),
      new Tone.Filter({type: "lowpass", frequency: 2400, Q: 0.6}),
      new Tone.Chorus({frequency: 0.5, delayTime: 4, depth: 0.7, wet: 0.55, spread: 180}).start(),
      new Tone.Reverb({decay: 8, preDelay: 0.04, wet: 0.5}),
    ],
  );
};
