import { describe, expect, it } from "vitest";

import {
  AUDIENCE_ALL,
  countWithMember,
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

describe("countWithMember", () => {
  // Я — anna. Позначки: моя приватна, спільна з bohdan, спільна з vika,
  // приватна bohdan.
  const marks = [
    forThem("anna"),
    forThem("anna", "bohdan"),
    forThem("anna", "vika"),
    forThem("bohdan"),
  ];

  it("невідмічений: скільки в нього разом з уже відміченими", () => {
    expect(countWithMember(marks, ["anna"], "bohdan")).toBe(1);
    expect(countWithMember(marks, ["anna"], "vika")).toBe(1);
  });

  it("відмічений: те, що зараз на екрані", () => {
    expect(countWithMember(marks, ["anna"], "anna")).toBe(3);
    expect(countWithMember(marks, ["anna", "bohdan"], "anna")).toBe(1);
    expect(countWithMember(marks, ["anna", "bohdan"], "bohdan")).toBe(1);
  });

  it("спільних немає — нуль у всіх", () => {
    expect(countWithMember(marks, ["anna", "bohdan"], "vika")).toBe(0);
    expect(countWithMember(marks, ["bohdan", "vika"], "bohdan")).toBe(0);
  });

  it("порожній набір — скільки в людини особисто, без інших відмічених", () => {
    expect(countWithMember(marks, [], "anna")).toBe(3);
    expect(countWithMember(marks, [], "bohdan")).toBe(2);
    expect(countWithMember(marks, [], "vika")).toBe(1);
  });

  it("публічні не рахуються: вони застарілі й від вибору не залежать", () => {
    const withPublic = [...marks, forThem(AUDIENCE_ALL)];
    expect(countWithMember(withPublic, ["anna"], "bohdan")).toBe(1);
  });
});
