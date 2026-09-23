import * as Tone from "tone";

import {bindMetronome, getMetronomeVolumeDb, unbindMetronome} from "./metronomeTrim";

export interface Metronome {
  stop(): void;
}

/**
 * Клік на кожен імпульс — у ПРАВОМУ каналі, поруч із педом у лівому (ADR-0003).
 * Про імпульс див. модель часу в `songDefaults`: BPM рахує саме його, тож
 * інтервал завжди `"4n"` — імпульс лягає 1:1 на чверть транспорту.
 *
 * Усі кліки однакові — без сильної долі (рішення Германа 2026-08-13). Акценти
 * пробували двома способами, обидва звучали чужорідно: інша висота читається
 * як нота в тональності пісні, а сама ідея сильної долі вимагає знати, де такт
 * починається.
 *
 * Звук — шум без висоти у два шари (обрано на слух 2026-09-23): дерев'яний
 * «ток» у вузькій смузі й сухе клацання атаки трохи вище. Уся енергія лежить у
 * 1–5 кГц, де вухо найчутливіше, а гурт найрідший, тож клік пробивається без
 * надмірної гучності. Попередній клік — синт бочки на C4 — сидів нижче 500 Гц,
 * у смузі гурту, і звучав глухо.
 */
interface Layer {
  /** Стала згасання шуму, с. */
  decay: number;
  filter: Partial<Tone.FilterOptions>;
  /** Рівень шару відносно іншого, дБ. */
  db: number;
}

const WOOD: Layer = {decay: 0.008, filter: {type: "bandpass", frequency: 2200, Q: 2.5}, db: 0};
const SNAP: Layer = {decay: 0.003, filter: {type: "bandpass", frequency: 3200, Q: 0.8}, db: -5};

/**
 * Шум — один сталий семпл із сідом, а не `Tone.Noise`: той щоразу стартує з
 * випадкового місця свого буфера, і удари різнились би на ±3–5 дБ.
 */
function noiseBurst(decay: number): Tone.ToneAudioBuffer {
  const rate = Tone.getContext().sampleRate;
  const data = new Float32Array(Math.round(rate * decay * 8)); // хвіст до −70 дБ
  let seed = 1;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647; // Park–Miller
    data[i] = ((seed / 2147483647) * 2 - 1) * Math.exp(-i / (rate * decay));
  }
  return Tone.ToneAudioBuffer.fromArray(data);
}

/** Запускає транспорт у темпі `bpm` і клацає, доки не зупинять. */
export function startMetronome(bpm: number): Metronome {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.position = 0;
  transport.bpm.value = bpm;

  const panner = new Tone.Panner(1).toDestination();
  const volume = new Tone.Volume(getMetronomeVolumeDb()).connect(panner);
  const layers = [WOOD, SNAP].map((layer) => {
    const filter = new Tone.Filter(layer.filter).connect(volume);
    const player = new Tone.Player({url: noiseBurst(layer.decay), volume: layer.db}).connect(filter);
    return {player, filter};
  });
  // Живий клік віддаємо ручці пульта: поки він існує, зміна трима чутна одразу.
  bindMetronome(volume);

  const loop = new Tone.Loop((time) => {
    for (const {player} of layers) player.start(time);
  }, "4n").start(0);
  transport.start();

  return {
    stop() {
      transport.stop();
      transport.cancel();
      unbindMetronome(volume);
      loop.dispose();
      for (const {player, filter} of layers) {
        player.dispose();
        filter.dispose();
      }
      volume.dispose();
      panner.dispose();
    },
  };
}
