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
 * як нота в тональності пісні (MembraneSynth виражено тональний), а сама ідея
 * сильної долі вимагає знати, де такт починається.
 */
const TICK_PITCH = "C4";
const TICK_VELOCITY = 0.7;

/** Запускає транспорт у темпі `bpm` і клацає, доки не зупинять. */
export function startMetronome(bpm: number): Metronome {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.position = 0;
  transport.bpm.value = bpm;

  const tick = new Tone.MembraneSynth({
    octaves: 2,
    envelope: {attack: 0.001, decay: 0.05, sustain: 0, release: 0.05},
    volume: getMetronomeVolumeDb(),
  });
  const panner = new Tone.Panner(1).toDestination();
  tick.connect(panner);
  // Живий клік віддаємо ручці пульта: поки він існує, зміна трима чутна одразу.
  bindMetronome(tick);

  const loop = new Tone.Loop((time) => {
    tick.triggerAttackRelease(TICK_PITCH, "16n", time, TICK_VELOCITY);
  }, "4n").start(0);
  transport.start();

  return {
    stop() {
      transport.stop();
      transport.cancel();
      unbindMetronome(tick);
      loop.dispose();
      tick.dispose();
      panner.dispose();
    },
  };
}
