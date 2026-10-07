import { describe, expect, it } from "vitest";

import {
  canStop,
  columnPitch,
  displayRow,
  holdRun,
  moveRun,
  parseRun,
  phaseAt,
  sameRun,
  sameStart,
  startRun,
  type AutoscrollRun,
} from "./run";

const run = (patch: Partial<AutoscrollRun> = {}): AutoscrollRun => ({
  row: 0,
  startedAt: 0,
  bpm: 60,
  beatsPerBar: 4,
  initiator: { device: "a", name: "Аня" },
  movedAt: null,
  held: false,
  ...patch,
});

describe("startRun — що фіксує старт (`SCROLL-14`)", () => {
  it("рядок, момент, темп і розмір пісні; ініціатор — цей пристрій", () => {
    expect(
      startRun({
        row: 12,
        now: 5000,
        header: { bpm: 96, timeSignature: [6, 8] },
        initiator: { device: "a", name: "Аня" },
      }),
    ).toEqual({
      row: 12,
      startedAt: 5000,
      bpm: 96,
      beatsPerBar: 6,
      initiator: { device: "a", name: "Аня" },
      movedAt: null,
      held: false,
    });
  });
});

describe("phaseAt — де позиція в момент часу", () => {
  // 60 BPM: доля — секунда.
  it.each([
    { name: "щойно стартували — відлік, перша доля", now: 0, phase: { kind: "count-in", row: 0, beat: 0 } },
    { name: "відлік, третя доля", now: 2500, phase: { kind: "count-in", row: 0, beat: 2 } },
    { name: "такт відліку минув — рядок старту", now: 4000, phase: { kind: "moving", row: 0 } },
    { name: "рядок триває два такти — 8 долей у 4/4", now: 11_999, phase: { kind: "moving", row: 0 } },
    { name: "наступний рядок", now: 12_000, phase: { kind: "moving", row: 1 } },
    { name: "останній рядок", now: 4000 + 9 * 8000, phase: { kind: "moving", row: 9 } },
    { name: "пройшли останній рядок — кінець (`SCROLL-10`)", now: 4000 + 10 * 8000, phase: { kind: "ended" } },
    { name: "годинник ініціатора попереду мого — ще відлік", now: -300, phase: { kind: "count-in", row: 0, beat: 0 } },
  ])("$name", ({ now, phase }) => {
    expect(phaseAt(run(), now, 10)).toEqual(phase);
  });

  it("6/8 — рядок 12 долей, відлік 6", () => {
    // 120 BPM: доля — пів секунди. Відлік 3 с, рядок 6 с.
    const r = run({ bpm: 120, beatsPerBar: 6 });
    expect(phaseAt(r, 2999, 10)).toEqual({ kind: "count-in", row: 0, beat: 5 });
    expect(phaseAt(r, 3000 + 5999, 10)).toEqual({ kind: "moving", row: 0 });
    expect(phaseAt(r, 3000 + 6000, 10)).toEqual({ kind: "moving", row: 1 });
  });

  it("рахунок іде від рядка старту", () => {
    expect(phaseAt(run({ row: 7 }), 4000 + 8000, 10)).toEqual({ kind: "moving", row: 8 });
  });

  it("рядок старту зник із пісні — кінець", () => {
    expect(phaseAt(run({ row: 7 }), 0, 5)).toEqual({ kind: "ended" });
  });
});

describe("ініціатор рухає гурт (`SCROLL-25`, `SCROLL-26`)", () => {
  // 60 BPM, 4/4: відлік 4 с, рядок 8 с. Стартували з рядка 0 у момент 0.
  it("відпустив — рахунок іде від його рядка й моменту, без відліку", () => {
    const moved = moveRun(run(), { row: 5, now: 30_000 });
    expect(phaseAt(moved, 30_000, 20)).toEqual({ kind: "moving", row: 5 });
    expect(phaseAt(moved, 37_999, 20)).toEqual({ kind: "moving", row: 5 });
    expect(phaseAt(moved, 38_000, 20)).toEqual({ kind: "moving", row: 6 });
  });

  it("відпустив — темп, розмір, момент старту й ініціатор лишаються з моменту старту", () => {
    const started = run({ bpm: 96, beatsPerBar: 6, startedAt: 1000 });
    const moved = moveRun(started, { row: 5, now: 30_000 });
    expect(moved).toMatchObject({
      bpm: 96,
      beatsPerBar: 6,
      startedAt: 1000,
      initiator: started.initiator,
    });
  });

  it("переніс назад на початок секції — повтор: позиція вертається й іде знову", () => {
    // На момент 60 000 позиція — рядок 7; приспів почався з рядка 2.
    expect(phaseAt(run(), 60_000, 20)).toEqual({ kind: "moving", row: 7 });
    const repeat = moveRun(run(), { row: 2, now: 60_000 });
    expect(phaseAt(repeat, 60_000, 20)).toEqual({ kind: "moving", row: 2 });
    expect(phaseAt(repeat, 68_000, 20)).toEqual({ kind: "moving", row: 3 });
  });

  it("переніс посеред відліку — відлік скасовано, рух одразу", () => {
    const moved = moveRun(run(), { row: 3, now: 2000 });
    expect(phaseAt(moved, 2000, 20)).toEqual({ kind: "moving", row: 3 });
  });

  it("переніс за останній рядок — кінець", () => {
    expect(phaseAt(moveRun(run(), { row: 20, now: 30_000 }), 30_000, 20)).toEqual({
      kind: "ended",
    });
  });

  it("палець на екрані — позиція стоїть на рядку моменту дотику", () => {
    // На момент 30 000 позиція — рядок 3.
    const held = holdRun(run(), 30_000);
    expect(phaseAt(held, 30_000, 20)).toEqual({ kind: "moving", row: 3 });
    expect(phaseAt(held, 300_000, 20)).toEqual({ kind: "moving", row: 3 });
  });

  it("палець на екрані посеред відліку — стоїть на рядку старту, не блимає", () => {
    expect(phaseAt(holdRun(run({ row: 4 }), 2000), 2000, 20)).toEqual({
      kind: "moving",
      row: 4,
    });
  });

  it("тримав, потім відпустив — рахунок від рядка й моменту відпускання", () => {
    const moved = moveRun(holdRun(run(), 30_000), { row: 9, now: 45_000 });
    expect(phaseAt(moved, 45_000, 20)).toEqual({ kind: "moving", row: 9 });
    expect(phaseAt(moved, 53_000, 20)).toEqual({ kind: "moving", row: 10 });
  });
});

describe("canStop — хто може зупинити (`SCROLL-8`)", () => {
  it.each([
    { name: "ініціатор", device: "a", can: true },
    { name: "інший пристрій", device: "b", can: false },
  ])("$name", ({ device, can }) => {
    expect(canStop(run(), device)).toBe(can);
  });
});

describe("sameRun — той самий запис", () => {
  it("однакові поля — той самий", () => {
    expect(sameRun(run(), run())).toBe(true);
  });

  it.each([
    { name: "інший рядок", patch: { row: 1 } },
    { name: "інший момент старту", patch: { startedAt: 1 } },
    { name: "інший ініціатор", patch: { initiator: { device: "b", name: "Аня" } } },
    { name: "перенесений", patch: { movedAt: 5000 } },
    { name: "палець на екрані", patch: { held: true } },
  ])("$name — інший", ({ patch }) => {
    expect(sameRun(run(), run(patch))).toBe(false);
  });
});

describe("sameStart — той самий автоскрол", () => {
  it("перенесений — той самий", () => {
    expect(sameStart(run(), moveRun(holdRun(run(), 30_000), { row: 9, now: 45_000 }))).toBe(true);
  });

  it.each([
    { name: "новий старт", patch: { startedAt: 1 } },
    { name: "інший ініціатор", patch: { initiator: { device: "b", name: "Аня" } } },
  ])("$name — інший", ({ patch }) => {
    expect(sameStart(run(), run(patch))).toBe(false);
  });
});

describe("displayRow — де показати позицію в МОЄМУ показі", () => {
  it.each([
    { name: "рядок видно — він", visible: [0, 1, 2, 3], row: 2, shown: 2 },
    { name: "у згорнутій секції — її заголовок (`SCROLL-17`)", visible: [0, 1, 5, 6], row: 3, shown: 1 },
    { name: "схований перед першим видимим — перший видимий", visible: [2, 3], row: 0, shown: 2 },
    { name: "схований після останнього — останній", visible: [0, 1], row: 4, shown: 1 },
    { name: "нічого не видно", visible: [], row: 0, shown: null },
  ])("$name", ({ visible, row, shown }) => {
    expect(displayRow(visible, row)).toBe(shown);
  });
});

describe("columnPitch — на скільки гортати одну колонку", () => {
  it.each([
    // Як у CSS: бажана 256, проміжок 24 — браузер вміщує стільки колонок,
    // скільки влізе, і розтягує їх на решту місця.
    { name: "три колонки", width: 900, pitch: (900 - 2 * 24) / 3 + 24 },
    { name: "дві колонки", width: 600, pitch: (600 - 24) / 2 + 24 },
    { name: "вужче за колонку — одна на всю ширину", width: 200, pitch: 200 + 24 },
  ])("$name", ({ width, pitch }) => {
    expect(columnPitch(width, 256, 24)).toBeCloseTo(pitch);
  });
});

describe("parseRun — запис із мережі", () => {
  it("цілий запис — як є", () => {
    expect(parseRun(run())).toEqual(run());
  });

  it("перенесений і притриманий — як є", () => {
    const value = run({ movedAt: 5000, held: true });
    expect(parseRun(value)).toEqual(value);
  });

  it("без полів переносу — ще не переносили", () => {
    const old = {
      row: 0,
      startedAt: 0,
      bpm: 60,
      beatsPerBar: 4,
      initiator: { device: "a", name: "Аня" },
    };
    expect(parseRun(old)).toEqual(run());
  });

  it.each([
    { name: "нічого", value: undefined },
    { name: "не обʼєкт", value: "x" },
    { name: "без темпу", value: { ...run(), bpm: 0 } },
    { name: "без ініціатора", value: { ...run(), initiator: null } },
    { name: "рядок не число", value: { ...run(), row: "3" } },
  ])("$name — нічого не йде", ({ value }) => {
    expect(parseRun(value)).toBeNull();
  });
});
