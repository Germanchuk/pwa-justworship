import { describe, expect, it } from "vitest";

import { silenceReason, type SilenceInput } from "./silenceReason";

const at = (patch: Partial<SilenceInput> = {}): SilenceInput => ({
  state: "idle",
  itemCount: 3,
  segmentCount: 5,
  startFailed: false,
  hostLate: false,
  ...patch,
});

describe("silenceReason — чому тихо", () => {
  it("звук іде — пояснювати нічого", () => {
    expect(silenceReason(at({ state: "playing" }))).toBeNull();
  });

  it("тихо, і все гаразд — теж нічого: просто ще не тиснули «грати»", () => {
    expect(silenceReason(at())).toBeNull();
  });

  it("запуск не піднявся — кажемо про це", () => {
    expect(silenceReason(at({ startFailed: true }))).toBe("startFailed");
  });

  it("звук пішов після невдалої спроби — напис знімається сам", () => {
    expect(silenceReason(at({ startFailed: true, state: "playing" }))).toBeNull();
  });

  it("у служінні немає жодного звучного пункту", () => {
    expect(silenceReason(at({ segmentCount: 0 }))).toBe("empty");
  });

  it("служіння порожнє геть — це вже сказав сам екран", () => {
    expect(silenceReason(at({ itemCount: 0, segmentCount: 0 }))).toBeNull();
  });

  it("попросили хоста, а він мовчить", () => {
    expect(silenceReason(at({ hostLate: true }))).toBe("hostSilent");
  });

  it("хост заграв — питання зникло", () => {
    expect(silenceReason(at({ hostLate: true, state: "playing" }))).toBeNull();
  });

  it("невдалий запуск важливіший за мовчазного хоста: він свіжіший", () => {
    expect(silenceReason(at({ startFailed: true, hostLate: true }))).toBe("startFailed");
  });

  it("грати нічого — це сильніше за мовчазного хоста", () => {
    expect(silenceReason(at({ segmentCount: 0, hostLate: true }))).toBe("empty");
  });
});

describe("silenceReason — завантаження не є тишею", () => {
  it("хост узявся вантажити — питання ще не постало", () => {
    expect(silenceReason(at({ state: "loading", hostLate: true }))).toBeNull();
  });

  it("а впав на завантаженні (знову idle) — постало", () => {
    expect(silenceReason(at({ state: "idle", hostLate: true }))).toBe("hostSilent");
  });

  it("зупинка на примітці — теж не тиша без пояснення: це сама музика", () => {
    expect(silenceReason(at({ state: "paused", segmentCount: 0 }))).toBeNull();
  });
});
