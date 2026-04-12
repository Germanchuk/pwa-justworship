// ignore this file, see another version playMidiGpt.ts
import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import padSample from "./pad-c4.mp3";
import pianoSample from "./c4-piano.wav";

/**
 * Програє MIDI-прогресію як ніжний worship pad (синус)
 * з точним таймінгом і плавним звучанням.
 */
export async function playMidiProgression(midi: Midi, bpm = 70) {
  await Tone.start();
  Tone.getTransport().cancel();
  Tone.getTransport().stop();
  Tone.getTransport().position = 0;
  Tone.getTransport().bpm.value = bpm;

  const pad = new Tone.Sampler({
    urls: {
      "C5": padSample
    },
    attack: 3,
    release: 5,
    baseUrl: "",
    volume: -8
  }).toDestination();

  const piano = new Tone.Sampler({
    urls: {
      "C5": pianoSample
    },
    baseUrl: "",
    release: 2,
    volume: 10
  }).toDestination();

  await Tone.loaded();

  // 🕒 створюємо Tone.Part із коректним конвертуванням beats → seconds
  const part = new Tone.Part((time, note) => {
    // pad.triggerAttackRelease(note.name, note.duration, time, note.velocity);
    piano.triggerAttackRelease(note.name, note.duration, time, note.velocity);
  });

  // Додаємо ноти з MIDI-файлу
  midi.tracks.forEach((track) => {
    track.notes.forEach((note) => {
      part.add({
        time: `${note.time}i`, // точний розрахунок
        name: Tone.Frequency(note.midi, "midi").toNote(),
        duration: note.duration,
        velocity: note.velocity ?? 0.7,
      });
    });
  });

  // налаштування частини
  part.loop = false;
  part.start(0);

  // 🕓 Метроном (click кожну четверть)
  const tick = new Tone.MembraneSynth({
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    volume: 8,
  }).toDestination();

  // 🎚 Панорамування — 1.0 = правий канал, -1.0 = лівий
  const pan = new Tone.Panner(1.0).toDestination();

// з'єднуємо синт з паннером
  tick.connect(pan);

  let beatCount = 0;
  const tickEvent = new Tone.Loop((time) => {
    const isFirstBeat = beatCount % 4 === 0;
    const pitch = isFirstBeat ? "C5" : "C4";
    tick.triggerAttackRelease(pitch, "16n", time);
    beatCount++;
  }, "4n");

  tickEvent.start(0);

  // 🧮 Обчислюємо довжину в ударах, не в секундах
  const totalBeats = Math.max(
    ...midi.tracks.flatMap((t) => t.notes.map((n) => n.time + n.duration))
  );

  // 🛑 Зупиняємо метроном після завершення MIDI
  Tone.getTransport().scheduleOnce(() => {
    tickEvent.stop();
  }, totalBeats);

  // запуск
  Tone.getTransport().start();
}
