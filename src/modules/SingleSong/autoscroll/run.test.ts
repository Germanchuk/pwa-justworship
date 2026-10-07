import { describe, expect, it } from "vitest";

import {
  canStop,
  columnPitch,
  displayRow,
  parseRun,
  phaseAt,
  sameRun,
  startRun,
  type AutoscrollRun,
} from "./run";

const run = (patch: Partial<AutoscrollRun> = {}): AutoscrollRun => ({
  row: 0,
  startedAt: 0,
  bpm: 60,
  beatsPerBar: 4,
  initiator: { device: "a", name: "Аня" },
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
  ])("$name — інший", ({ patch }) => {
    expect(sameRun(run(), run(patch))).toBe(false);
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
