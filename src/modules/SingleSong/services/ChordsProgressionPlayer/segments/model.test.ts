import { describe, expect, it } from "vitest";

import { pointOfKey, prefixTokenKey, unprefixTokenKey } from "./model";

/**
 * Ключ токена — частина протоколу: він їде по мережі разом з голкою. Тут
 * перевіряється рівно одне — що дорога туди й назад не втрачає й не плутає
 * пункт. Ціна помилки видима: акорд спалахнув би не в тій пісні.
 */
describe("ключ токена: префікс пункту", () => {
  it("без префікса ключ лишається собою в обидва боки", () => {
    expect(prefixTokenKey("0:1:3", undefined)).toBe("0:1:3");
    expect(unprefixTokenKey("0:1:3", undefined)).toBe("0:1:3");
  });

  it("з префіксом дорога туди й назад повертає той самий ключ", () => {
    expect(prefixTokenKey("0:1:3", "p2")).toBe("p2:0:1:3");
    expect(unprefixTokenKey("p2:0:1:3", "p2")).toBe("0:1:3");
  });

  it("чужий пункт не впізнається — саме це не дає підсвітці спалахнути двічі", () => {
    expect(unprefixTokenKey("p2:0:1:3", "p0")).toBeNull();
  });

  it("сусідній номер не з'їдається частковим збігом: `p1` не впізнає `p10`", () => {
    expect(unprefixTokenKey("p10:0:1:3", "p1")).toBeNull();
    expect(unprefixTokenKey("p10:0:1:3", "p10")).toBe("0:1:3");
  });

  it("нічого не звучить — нічого й не підсвічено", () => {
    expect(prefixTokenKey(null, "p2")).toBeNull();
    expect(unprefixTokenKey(null, "p2")).toBeNull();
  });

  it("ключ без префікса до пункту не належить", () => {
    expect(unprefixTokenKey("0:1:3", "p0")).toBeNull();
  });
});

/**
 * Адреса в служінні — `пункт[:решта]`, і читається вона однаково, чим би та
 * решта не була. На цьому стоїть «грай звідси»: тап дає ключ токена, кнопка —
 * сам пункт, а черга ріжеться одним правилом.
 */
describe("пункт з адреси", () => {
  it("сам пункт — це вже адреса", () => {
    expect(pointOfKey("p3")).toBe("p3");
  });

  it("ключ токена звужує адресу, але пункт у ній той самий", () => {
    expect(pointOfKey("p3:0:1:2")).toBe("p3");
  });

  it("id сегмента читається так само — звідси й спільне правило", () => {
    expect(pointOfKey("p3:loop")).toBe("p3");
    expect(pointOfKey("p3:pause")).toBe("p3");
  });

  it("двоцифровий пункт лишається собою: `p10` — це не `p1`", () => {
    expect(pointOfKey("p10:0:1:2")).toBe("p10");
  });
});
