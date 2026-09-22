import {describe, expect, it} from "vitest";
import {voiceChord} from "./voiceChord";
import {createMidiFromProgression} from "./createMidiFromProgression";

// Pitch classes: C=0 D=2 E=4 F=5 G=7 A=9 B=11
const C = {chordPcs: [0, 4, 7], bassPc: 0};
const G = {chordPcs: [7, 11, 2], bassPc: 7};
const Am = {chordPcs: [9, 0, 4], bassPc: 9};
const F = {chordPcs: [5, 9, 0], bassPc: 5};

const pcsOf = (midis: number[]) => new Set(midis.map((m) => m % 12));

describe("voiceChord", () => {
  it("перший акорд лягає біля середини клавіатури, бас — октавою нижче", () => {
    const {bass, upper} = voiceChord({...C, prevUpper: null});
    expect(bass).toBe(48); // C3
    expect(upper).toEqual([60, 64, 67]); // C4 E4 G4
  });

  it("наступний акорд обирає обернення з мінімальним рухом голосів", () => {
    const c = voiceChord({...C, prevUpper: null});
    const g = voiceChord({...G, prevUpper: c.upper});
    // Перше обернення B3 D4 G4, а не стрибок у root position G4 B4 D5.
    expect(g.upper).toEqual([59, 62, 67]);
    expect(g.bass).toBe(55); // G3
  });

  it("C→G→Am→F веде голоси плавно: жоден не рухається більше ніж на терцію", () => {
    let prev: number[] | null = null;
    for (const chord of [C, G, Am, F]) {
      const {upper} = voiceChord({...chord, prevUpper: prev});
      // голоси впорядковані й тримаються середини клавіатури
      expect([...upper].sort((a, b) => a - b)).toEqual(upper);
      expect(upper[0]).toBeGreaterThanOrEqual(57);
      if (prev) {
        upper.forEach((n, i) => expect(Math.abs(n - prev![i])).toBeLessThanOrEqual(4));
      }
      prev = upper;
    }
  });

  it("слеш-бас іде в бас, верхні голоси лишаються акордом", () => {
    const {bass, upper} = voiceChord({...G, bassPc: 11, prevUpper: null}); // G/B
    expect(bass).toBe(47); // B2
    expect(pcsOf(upper)).toEqual(new Set([7, 11, 2]));
  });

  it("у септакорді тоніку зверху не дублює — її веде бас", () => {
    const {bass, upper} = voiceChord({chordPcs: [0, 4, 7, 11], bassPc: 0, prevUpper: null}); // Cmaj7
    expect(bass).toBe(48);
    expect(pcsOf(upper)).toEqual(new Set([4, 7, 11]));
  });
});

// rng = 0.5 → нульовий джитер: ноти лягають рівно на сітку з базовим velocity.
const noJitter = {random: () => 0.5};

describe("createMidiFromProgression з апплікатурами", () => {
  const progression = [
    {chord: "C", duration: 4},
    {chord: null, duration: 4}, // пауза не скидає голосоведення
    {chord: "G", duration: 4},
  ];

  it("грає бас + верхні голоси, пауза не збиває плавність", () => {
    const midi = createMidiFromProgression(progression, 70, [4, 4], 0, noJitter);
    const ppq = midi.header.ppq;
    const at = (tick: number) =>
      midi.tracks[0].notes
        .filter((n) => n.ticks === tick)
        .map((n) => n.midi)
        .sort((a, b) => a - b);

    expect(at(0)).toEqual([48, 60, 64, 67]); // C: бас C3 + C4 E4 G4
    expect(at(8 * ppq)).toEqual([55, 59, 62, 67]); // G після паузи: перше обернення
  });

  it("транспозиція зсуває всі голоси однаково", () => {
    const plain = createMidiFromProgression(progression, 70, [4, 4], 0, noJitter);
    const shifted = createMidiFromProgression(progression, 70, [4, 4], 2, noJitter);
    expect(shifted.tracks[0].notes.map((n) => n.midi)).toEqual(
      plain.tracks[0].notes.map((n) => n.midi + 2),
    );
  });
});
