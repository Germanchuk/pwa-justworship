import { describe, expect, it } from "vitest";
import { barSpot } from "./path";

describe("barSpot — місце екрана в шляху нижнього бару", () => {
  it("головна — без шляху", () => {
    expect(barSpot("/")).toEqual({ bandId: null, screen: null, active: "home" });
  });

  it("пошук і налаштування — екрани поза гуртом, одразу після 🏠", () => {
    expect(barSpot("/search")).toEqual({ bandId: null, screen: "Пошук", active: "screen" });
    expect(barSpot("/preferences")).toEqual({ bandId: null, screen: "Налаштування", active: "screen" });
  });

  it("сторінка гурту — гурт поточний", () => {
    expect(barSpot("/bands/7")).toEqual({ bandId: "7", screen: null, active: "band" });
  });

  it("екран гурту — третій пункт", () => {
    expect(barSpot("/bands/7/songs")).toEqual({ bandId: "7", screen: "Пісні", active: "screen" });
    expect(barSpot("/bands/7/lists/new").screen).toBe("Новий список");
  });

  it("правка списку — той самий шлях, що й читання", () => {
    expect(barSpot("/bands/7/lists/3/edit")).toEqual(barSpot("/bands/7/lists/3"));
  });

  it("/bands/new — не гурт з id «new»", () => {
    expect(barSpot("/bands/new")).toEqual({ bandId: null, screen: "Новий гурт", active: "screen" });
  });
});
