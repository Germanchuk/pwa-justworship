import * as Tone from "tone";
import lotusPond from "./lotus-pond.m4a";

export const createPad = () => {
  return new Tone.Sampler({
    urls: { C4: lotusPond },
    attack: 3,
    release: 5,
    baseUrl: "",
    volume: -8,
  }).toDestination();
}