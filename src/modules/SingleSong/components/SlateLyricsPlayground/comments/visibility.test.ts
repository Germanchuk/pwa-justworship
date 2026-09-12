import { describe, expect, it } from "vitest";

import {
  AUDIENCE_ALL,
  isPrivateTo,
  isVisibleToAll,
  narrowAudience,
  restCount,
} from "./visibility";

const forThem = (...usernames: string[]) => ({ visibleFor: usernames });

const VOCALS = ["anna", "bohdan", "vika"];

describe("isVisibleToAll", () => {
  it("показує позначку, адресовану рівно набору", () => {
    expect(isVisibleToAll(forThem(...VOCALS), VOCALS)).toBe(true);
  });

  it("показує ширшу позначку: її бачить кожен з набору", () => {
    expect(isVisibleToAll(forThem(...VOCALS, "taras"), VOCALS)).toBe(true);
  });

  it("ховає позначку, яку бачать не всі з набору", () => {
    expect(isVisibleToAll(forThem("anna", "bohdan"), VOCALS)).toBe(false);
  });

  it("порядок ніків не має значення", () => {
    expect(isVisibleToAll(forThem("vika", "anna", "bohdan"), VOCALS)).toBe(true);
  });

  it("публічну позначку видно за будь-якого набору", () => {
    expect(isVisibleToAll(forThem(AUDIENCE_ALL), VOCALS)).toBe(true);
    expect(isVisibleToAll(forThem(AUDIENCE_ALL), ["me"])).toBe(true);
  });

  it("порожній набір не показує нічого, крім публічного", () => {
    expect(isVisibleToAll(forThem("anna"), [])).toBe(false);
    expect(isVisibleToAll(forThem(AUDIENCE_ALL), [])).toBe(true);
  });

  it("позначка без адресатів не видна нікому", () => {
    expect(isVisibleToAll({}, VOCALS)).toBe(false);
    expect(isVisibleToAll(forThem(), VOCALS)).toBe(false);
  });
});

describe("narrowAudience", () => {
  it("зносить позначку, адресовану рівно набору", () => {
    expect(narrowAudience(forThem(...VOCALS), VOCALS)).toBeNull();
  });

  it("лишає позначку тим, кого в наборі не було", () => {
    expect(narrowAudience(forThem(...VOCALS, "taras"), VOCALS)).toEqual([
      "taras",
    ]);
  });

  it("зносить публічну позначку цілком: з `all` нікого не віднімеш", () => {
    expect(narrowAudience(forThem(AUDIENCE_ALL), VOCALS)).toBeNull();
  });

  it("зносить власну приватну позначку", () => {
    expect(narrowAudience(forThem("me"), ["me"])).toBeNull();
  });
});

describe("restCount", () => {
  it("рахує тих, кого моє видалення не зачепить", () => {
    expect(restCount(forThem(...VOCALS, "taras"), VOCALS)).toBe(1);
    expect(restCount(forThem(...VOCALS), VOCALS)).toBe(0);
  });

  it("для публічної позначки не рахує нічого", () => {
    expect(restCount(forThem(AUDIENCE_ALL), VOCALS)).toBe(0);
  });
});

describe("isPrivateTo", () => {
  it("впізнає позначку, адресовану тільки мені", () => {
    expect(isPrivateTo(forThem("me"), "me")).toBe(true);
  });

  it("спільна позначка вже не приватна — адресат дізнається про втрату", () => {
    expect(isPrivateTo(forThem("me", "anna"), "me")).toBe(false);
    expect(isPrivateTo(forThem(AUDIENCE_ALL), "me")).toBe(false);
  });
});
