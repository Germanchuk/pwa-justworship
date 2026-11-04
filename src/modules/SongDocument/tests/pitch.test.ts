/** Запис вокалу: висота з сигналу, ноти з кадрів, ноти в пісню. Сигнал — синтетичний «голос» (гармоніки, вібрато, шум). */
import { describe, expect, it } from "vitest";
import { pitchTrack, placeNotes, sungNotes, type PlayedSpan } from "../playback/pitch";

const RATE = 48000;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Псевдовипадковий шум — тести детерміновані. */
function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

/** «Спів»: ноти `[midi, секунд]` (`null` — тиша), три гармоніки, вібрато ±0.3 півтона на 5.5 Гц, тихий шум кімнати. */
function sing(notes: [number | null, number][], { vibrato = 0.3, noise = 0.003 } = {}) {
  const total = notes.reduce((a, [, s]) => a + s, 0);
  const out = new Float32Array(Math.round(total * RATE));
  const rand = rng();
  let i = 0;
  let phase = 0;
  for (const [midi, sec] of notes) {
    const n = Math.round(sec * RATE);
    for (let k = 0; k < n; k++, i++) {
      const t = i / RATE;
      if (midi !== null) {
        const f = hz(midi + vibrato * Math.sin(2 * Math.PI * 5.5 * t));
        phase += (2 * Math.PI * f) / RATE;
        const env = Math.min(1, k / (0.02 * RATE), (n - k) / (0.02 * RATE));
        out[i] = env * 0.3 * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase));
      }
      out[i] += noise * rand();
    }
  }
  return out;
}

describe("висота з сигналу (YIN)", () => {
  it("рівна нота — свій півтон, від баса до сопрано", () => {
    for (const midi of [43, 52, 60, 69, 79]) {
      const frames = pitchTrack(sing([[midi, 0.4]], { vibrato: 0 }), RATE).filter((f) => f.midi !== null);
      expect(frames.length).toBeGreaterThan(20);
      frames.forEach((f) => expect(Math.abs(f.midi! - midi)).toBeLessThan(0.2));
    }
  });

  it("тиша — тиша", () => {
    expect(pitchTrack(sing([[null, 0.5]]), RATE).every((f) => f.midi === null)).toBe(true);
  });
});

describe("ноти з кадрів", () => {
  it("мелодія з вібрато — ноти з тими самими висотами й часом", () => {
    const notes = sungNotes(pitchTrack(sing([[null, 0.3], [60, 0.5], [62, 0.5], [64, 1], [null, 0.4], [67, 0.25]]), RATE));
    expect(notes.map((n) => n.midi)).toEqual([60, 62, 64, 67]);
    const expected = [[0.3, 0.8], [0.8, 1.3], [1.3, 2.3], [2.7, 2.95]];
    notes.forEach((n, i) => {
      expect(Math.abs(n.start - expected[i][0])).toBeLessThan(0.06);
      expect(Math.abs(n.end - expected[i][1])).toBeLessThan(0.06);
    });
  });

  it("та сама нота двічі через паузу — дві ноти", () => {
    const notes = sungNotes(pitchTrack(sing([[64, 0.4], [null, 0.12], [64, 0.4]]), RATE));
    expect(notes.map((n) => n.midi)).toEqual([64, 64]);
  });

  it("клацання коротше за 70 мс — не нота", () => {
    expect(sungNotes(pitchTrack(sing([[null, 0.2], [70, 0.04], [null, 0.3]]), RATE))).toEqual([]);
  });
});

describe("ноти в пісню", () => {
  // Два рядки по такту 4/4 (384 тіки) на 120 BPM: тік = 0.5 / 96 с, такт = 2 с. Рядок 0 грав з 10 с.
  const spt = 0.5 / 96;
  const spans: PlayedSpan[] = [
    { line: 0, from: 0, to: 384, at: 10, end: 12, spt },
    { line: 2, from: 0, to: 384, at: 12, end: 14, spt },
  ];

  it("секунди → тіки рядка, вирівняні до комірки 1/16, з поправкою на затримку", () => {
    // Запис почався о 9 с; нота заспівана на долі 2 (10.5 с), але з затримкою 0.08 с.
    const placed = placeNotes([{ start: 1.58, end: 2.08, midi: 60 }], spans, 9, 0.08, 24);
    expect(placed).toEqual([{ line: 0, time: 96, length: 96, midi: 60 }]);
  });

  it("нота через межу рядків — дві ноти, по шматку в кожному", () => {
    const placed = placeNotes([{ start: 2.5, end: 3.5, midi: 62 }], spans, 9, 0, 24);
    expect(placed).toEqual([
      { line: 0, time: 288, length: 96, midi: 62 },
      { line: 2, time: 0, length: 96, midi: 62 },
    ]);
  });

  it("голос один: нота, що налазить на наступну, обривається; поза зіграним — геть", () => {
    const placed = placeNotes(
      [
        { start: 0, end: 0.5, midi: 55 }, // до старту
        { start: 1, end: 1.6, midi: 60 },
        { start: 1.5, end: 2, midi: 64 },
      ],
      spans,
      9,
      0,
      24,
    );
    expect(placed).toEqual([
      { line: 0, time: 0, length: 96, midi: 60 },
      { line: 0, time: 96, length: 96, midi: 64 },
    ]);
  });
});
