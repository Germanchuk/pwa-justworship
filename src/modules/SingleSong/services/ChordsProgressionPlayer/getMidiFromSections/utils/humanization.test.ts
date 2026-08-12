import {describe, expect, it} from "vitest";
import {createMidiFromProgression} from "./createMidiFromProgression";
import {dynamicsIntensityAt} from "./dynamicsIntensity";
import {getMidiFromSlate} from "../../getMidiFromSlate/getMidiFromSlate";

// rng = 0.5 → нульовий джитер; послідовність — для перевірки саме джитера.
const noJitter = {random: () => 0.5};
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("dynamicsIntensityAt", () => {
  it("один крок — константа по всій секції", () => {
    // development — індекс 2 із 7 кроків → 2/6
    expect(dynamicsIntensityAt(["development"], 0)).toBeCloseTo(2 / 6);
    expect(dynamicsIntensityAt(["development"], 1)).toBeCloseTo(2 / 6);
  });

  it("два кроки інтерполюються, як градієнт смуги", () => {
    const steps = ["calm", "climax"];
    expect(dynamicsIntensityAt(steps, 0)).toBeCloseTo(0);
    expect(dynamicsIntensityAt(steps, 0.5)).toBeCloseTo(0.5);
    expect(dynamicsIntensityAt(steps, 1)).toBeCloseTo(1);
  });

  it("сміття фільтрується; без валідних кроків — undefined", () => {
    expect(dynamicsIntensityAt(["calm", "not-a-step", "climax"], 1)).toBeCloseTo(1);
    expect(dynamicsIntensityAt(["nope"], 0.5)).toBeUndefined();
    expect(dynamicsIntensityAt(undefined, 0.5)).toBeUndefined();
    expect(dynamicsIntensityAt("climax", 0.5)).toBeUndefined();
  });
});

describe("velocity від динаміки", () => {
  const velocitiesAt = (intensity: number | undefined, sectionStart = false) => {
    const midi = createMidiFromProgression(
      [{chord: "C", duration: 4, intensity, sectionStart}],
      70,
      [4, 4],
      0,
      noJitter,
    );
    return midi.tracks[0].notes.map((n) => n.velocity);
  };

  it("intensity 0 → 0.5, intensity 1 → 1.0, без динаміки → 0.8 як раніше", () => {
    velocitiesAt(0).forEach((v) => expect(v).toBeCloseTo(0.5));
    velocitiesAt(1).forEach((v) => expect(v).toBeCloseTo(1.0));
    velocitiesAt(undefined).forEach((v) => expect(v).toBeCloseTo(0.8));
  });

  it("початок секції дістає акцент, але не вилазить за 1.0", () => {
    velocitiesAt(0.5, true).forEach((v) => expect(v).toBeCloseTo(0.83));
    velocitiesAt(1, true).forEach((v) => expect(v).toBeCloseTo(1.0)); // клямп
  });
});

describe("гуманізація кожної окремої ноти", () => {
  it("ноти одного акорду мають різні velocity і різні зсуви в часі", () => {
    const midi = createMidiFromProgression(
      [{chord: "C", duration: 4}],
      70,
      [4, 4],
      0,
      {random: seq(0.05, 0.95, 0.4, 0.6, 0.9, 0.1, 0.2, 0.8)},
    );
    const notes = midi.tracks[0].notes;
    expect(notes).toHaveLength(4); // бас + тріада

    expect(new Set(notes.map((n) => n.velocity)).size).toBeGreaterThan(1);
    expect(new Set(notes.map((n) => n.ticks)).size).toBeGreaterThan(1);
    // зсув не викидає ноту за початок треку
    notes.forEach((n) => expect(n.ticks).toBeGreaterThanOrEqual(0));
  });

  it("зсув часу обмежений ±12 мс у тіках цього bpm", () => {
    // rng завжди 1 → максимальний додатний зсув для кожної ноти
    const midi = createMidiFromProgression([{chord: "C", duration: 4}], 70, [4, 4], 0, {random: () => 1});
    const ppq = midi.header.ppq;
    const maxOffset = Math.round((12 / 1000) * (70 / 60) * ppq);
    midi.tracks[0].notes.forEach((n) => expect(n.ticks).toBe(maxOffset));
  });
});

describe("рівні гуманізації", () => {
  const render = (humanize: number | undefined) =>
    createMidiFromProgression([{chord: "C", duration: 4}], 70, [4, 4], 0, {
      random: () => 1, // максимальний кидок — видно масштаб рівня
      humanize,
    }).tracks[0].notes;

  it("humanize 0 — механічно: сітка і рівний velocity навіть із «випадковістю»", () => {
    render(0).forEach((n) => {
      expect(n.ticks).toBe(0);
      expect(n.velocity).toBeCloseTo(0.8);
    });
  });

  it("рівень масштабує обидва джитери пропорційно", () => {
    const ppq = 480;
    const baseOffset = (12 / 1000) * (70 / 60) * ppq;

    render(0.5).forEach((n) => {
      expect(n.ticks).toBe(Math.round(baseOffset * 0.5));
      expect(n.velocity).toBeCloseTo(0.8 + 0.04 * 0.5);
    });
    render(1.75).forEach((n) => {
      expect(n.ticks).toBe(Math.round(baseOffset * 1.75));
      expect(n.velocity).toBeCloseTo(0.8 + 0.04 * 1.75);
    });
  });

  it("без параметра — рівень 1 (як раніше)", () => {
    const explicit = render(1);
    render(undefined).forEach((n, i) => {
      expect(n.ticks).toBe(explicit[i].ticks);
      expect(n.velocity).toBeCloseTo(explicit[i].velocity);
    });
  });

  it("акцент секції НЕ масштабується — він частина динаміки, не джитера", () => {
    const notes = createMidiFromProgression(
      [{chord: "C", duration: 4, sectionStart: true}],
      70,
      [4, 4],
      0,
      {random: () => 0.5, humanize: 0},
    ).tracks[0].notes;
    notes.forEach((n) => expect(n.velocity).toBeCloseTo(0.88));
  });
});

describe("динаміка з документа пісні", () => {
  const song = (dynamicsSteps?: string[]) => ({
    bpm: 70,
    timeSignature: [4, 4] as [number, number],
    nodes: [
      {
        type: "section",
        dynamicsSteps,
        children: [
          {type: "chord-line", children: [{text: "| C |"}]},
          {type: "lyric-line", children: [{text: "слова"}]},
          {type: "chord-line", children: [{text: "| G |"}]},
          {type: "lyric-line", children: [{text: "слова"}]},
        ],
      },
    ] as never,
  });

  it("рядок нижче в секції грає гучніше за градієнтом calm→climax", () => {
    const {progression} = getMidiFromSlate(song(["calm", "climax"]), null);
    const [c, g] = progression;
    // центри рядків: (0+0.5)/4 та (2+0.5)/4
    expect(c.intensity).toBeCloseTo(0.125);
    expect(g.intensity).toBeCloseTo(0.625);
    expect(c.sectionStart).toBe(true);
    expect(g.sectionStart).toBeUndefined();
  });

  it("секція без динаміки лишається нейтральною", () => {
    const {progression} = getMidiFromSlate(song(undefined), null);
    progression.forEach((event) => expect(event.intensity).toBeUndefined());
    expect(progression[0].sectionStart).toBe(true);
  });
});
