import * as Tone from "tone";
import pianoSample from "./c4-piano.wav";

export const createPiano = () => {
  return new Tone.Sampler({
    urls: { C4: pianoSample },
    baseUrl: "",
    release: 2,
    volume: 10,
  }).toDestination();
};
