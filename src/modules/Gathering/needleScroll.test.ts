import { describe, expect, it } from "vitest";

import { needleScrollTop, type NeedleFrame } from "./needleScroll";

// Вікно 800, бар 100 → вільна смуга 700.
//   якір          = 100 + 0.3 × 700 = 310
//   низ комфорту  = 100 + 0.66 × 700 = 562
const frame = (patch: Partial<NeedleFrame> = {}): NeedleFrame => ({
  top: 300,
  bottom: 320,
  viewport: 800,
  headroom: 100,
  scrollTop: 1000,
  maxScrollTop: 5000,
  ...patch,
});

describe("needleScrollTop", () => {
  it("голка в комфортній смузі — екран стоїть", () => {
    expect(needleScrollTop(frame({ top: 300, bottom: 320 }))).toBeNull();
  });

  it("голка сповзла нижче смуги — везе її на якір", () => {
    expect(needleScrollTop(frame({ top: 700, bottom: 720 }))).toBe(1390);
  });

  it("голка стрибнула вгору (новий прохід лупа) — везе назад до неї", () => {
    expect(needleScrollTop(frame({ top: 40, bottom: 60 }))).toBe(730);
  });

  it("голка під баром — це «не видно», навіть якщо технічно на екрані", () => {
    // Верх голки вище за низ бару: її накриває липка шапка.
    expect(needleScrollTop(frame({ top: 90, bottom: 110 }))).toBe(780);
  });

  it("«до голки» рухає екран і з комфортної смуги", () => {
    expect(needleScrollTop(frame({ top: 300 }), { force: true })).toBe(990);
  });

  it("голка вже на якорі — не смикаємось навіть на вимогу", () => {
    expect(needleScrollTop(frame({ top: 311, bottom: 331 }), { force: true })).toBeNull();
  });

  it("вище початку документа не їдемо", () => {
    expect(needleScrollTop(frame({ top: 40, bottom: 60, scrollTop: 0 }))).toBeNull();
  });

  it("нижче кінця документа не їдемо", () => {
    expect(
      needleScrollTop(frame({ top: 700, bottom: 720, scrollTop: 1150, maxScrollTop: 1200 })),
    ).toBe(1200);
  });

  it("хвіст служіння: доїхали до кінця — далі стоїмо, хоч голка й низько", () => {
    expect(
      needleScrollTop(frame({ top: 700, bottom: 720, scrollTop: 1200, maxScrollTop: 1200 })),
    ).toBeNull();
  });

  it("бар з'їв усе вікно — рухатись нема куди", () => {
    expect(needleScrollTop(frame({ viewport: 100, headroom: 100 }))).toBeNull();
  });
});
