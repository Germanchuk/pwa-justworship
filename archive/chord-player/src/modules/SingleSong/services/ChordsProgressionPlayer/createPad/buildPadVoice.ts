import * as Tone from "tone";
import type {PadVoice} from "./padPresets";

/**
 * Збирає пед з шарів синтів і спільного ланцюга ефектів у один PadVoice.
 *
 * Навіщо обгортка:
 * - `dispose()` прибирає ВЕСЬ ланцюг. Старі фабрики повертали голий синт,
 *   плеєр disposed лише його, а reverb/chorus/filter лишалися під'єднаними до
 *   виходу назавжди — витік на кожен play().
 * - шари: сучасні педи будуються з 2+ голосів (октавний «шиммер», суб-бас) —
 *   обгортка тригерить їх разом із зсувом у півтонах.
 * - `volume` — майстер усього педа (Tone.Volume), а баланс шарів між собою
 *   виставляється гучністю самих синтів у фабриці.
 */

export interface PadLayer {
  synth: Tone.PolySynth;
  /** Зсув шару в півтонах відносно ноти акорду (+12 — октава вгору). */
  transpose?: number;
  /** Множник velocity шару (тихіші обертони — менші значення). */
  velocity?: number;
}

const transposeNote = (note: string, semitones: number): string =>
  Tone.Frequency(note).transpose(semitones).toNote();

const transposeNotes = (notes: string | string[], semitones: number): string | string[] => {
  if (semitones === 0) return notes;
  return Array.isArray(notes)
    ? notes.map((n) => transposeNote(n, semitones))
    : transposeNote(notes, semitones);
};

export function buildPadVoice(layers: PadLayer[], chain: Tone.ToneAudioNode[]): PadVoice {
  const out = new Tone.Volume(0).toDestination();
  const nodes = [...chain, out];
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  for (const layer of layers) layer.synth.connect(nodes[0]);

  return {
    triggerAttackRelease(notes, duration, time, velocity = 0.8) {
      for (const layer of layers) {
        layer.synth.triggerAttackRelease(
          transposeNotes(notes, layer.transpose ?? 0),
          duration,
          time,
          velocity * (layer.velocity ?? 1),
        );
      }
    },
    volume: out.volume,
    dispose() {
      for (const layer of layers) layer.synth.dispose();
      for (const node of nodes) node.dispose();
    },
  };
}
