import { describe, expect, it } from "vitest";

import type { PlaybackSegment } from "./model";
import { bars, makeSegment } from "./segmentFixtures";
import { planTempoTransition, type TempoState } from "./tempoTransition";

/** Тут за замовчуванням сегмент на ДВА такти: рамп міряється його довжиною. */
const segment = (over: Partial<PlaybackSegment> = {}): PlaybackSegment =>
  makeSegment({ progression: bars(2), bpm: 100, ...over });

const from = (bpm: number, timeSignature: [number, number] = [4, 4]): TempoState => ({
  bpm,
  timeSignature,
});

describe("перехід темпу й розміру на межі сегмента", () => {
  it("розмір такту завжди свій — його беруть навіть без рампу", () => {
    const plan = planTempoTransition(from(80), segment({ timeSignature: [6, 8], bpm: 160 }));

    expect(plan.barBeats).toBe(6);
    expect(plan.bpm).toBe(160);
  });

  it("однакові знаменники — темп ведеться, і рівно за один прохід сегмента", () => {
    // Луп на 8 імпульсів, 80 → 120: середній темп 100 імпульсів/хв, тобто
    // прохід триває 8 × 60 / 100 = 4.8 с. Саме стільки й ведемо.
    const plan = planTempoTransition(
      from(80),
      segment({ kind: "loop", bpm: 120, progression: bars(2), rampTempo: true }),
    );

    expect(plan.bpm).toBe(120);
    expect(plan.rampSeconds).toBeCloseTo(4.8, 6);
  });

  it("різні знаменники — стрибок, і жодного рампу", () => {
    // 4/4@80 → 6/8@168 музично СПОВІЛЬНЮЄ відчутну долю: наївний рамп повів би
    // темп у протилежний бік.
    const plan = planTempoTransition(
      from(80, [4, 4]),
      segment({ kind: "loop", bpm: 168, timeSignature: [6, 8], rampTempo: true, progression: bars(2, 6) }),
    );

    expect(plan.bpm).toBe(168);
    expect(plan.rampSeconds).toBe(0);
  });

  it("сегмент не просив рампу — стрибок навіть при однакових знаменниках", () => {
    const plan = planTempoTransition(from(80), segment({ bpm: 120 }));

    expect(plan.rampSeconds).toBe(0);
  });

  it("першому сегменту вести нема звідки — стрибок", () => {
    const plan = planTempoTransition(null, segment({ kind: "loop", bpm: 120, rampTempo: true }));

    expect(plan.bpm).toBe(120);
    expect(plan.rampSeconds).toBe(0);
  });

  it("темп той самий — вести нема куди", () => {
    const plan = planTempoTransition(
      from(100),
      segment({ kind: "loop", bpm: 100, rampTempo: true }),
    );

    expect(plan.rampSeconds).toBe(0);
  });

  it("порожній сегмент рампу не має — вести ніде", () => {
    const plan = planTempoTransition(
      from(80),
      segment({ kind: "loop", bpm: 120, progression: [], rampTempo: true }),
    );

    expect(plan.rampSeconds).toBe(0);
  });

  it("уповільнення ведеться так само, як прискорення", () => {
    // 120 → 80 на 8 імпульсах: середній темп той самий 100, тож і час той самий.
    const plan = planTempoTransition(
      from(120),
      segment({ kind: "loop", bpm: 80, progression: bars(2), rampTempo: true }),
    );

    expect(plan.bpm).toBe(80);
    expect(plan.rampSeconds).toBeCloseTo(4.8, 6);
  });
});
