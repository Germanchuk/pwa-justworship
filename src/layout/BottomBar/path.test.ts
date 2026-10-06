import { describe, expect, it } from "vitest";
import { barSpot } from "./path";

describe("barSpot — місце екрана в шляху нижнього бару", () => {
  it("головна — без шляху", () => {
    expect(barSpot("/")).toEqual({ bandId: null, screen: null, active: "home", back: null, songMenu: false });
  });

  it("пошук і налаштування — екрани поза гуртом, одразу після 🏠", () => {
    expect(barSpot("/search")).toEqual({ bandId: null, screen: "Пошук", active: "screen", back: null, songMenu: false });
    expect(barSpot("/preferences")).toEqual({ bandId: null, screen: "Налаштування", active: "screen", back: null, songMenu: false });
  });

  it("сторінка гурту — гурт поточний", () => {
    expect(barSpot("/bands/7")).toEqual({ bandId: "7", screen: null, active: "band", back: null, songMenu: false });
  });

  it("екран гурту — третій пункт", () => {
    expect(barSpot("/bands/7/songs")).toEqual({ bandId: "7", screen: "Пісні", active: "screen", back: null, songMenu: false });
    expect(barSpot("/bands/7/lists/new").screen).toBe("Новий список");
  });

  it("правка списку — той самий шлях, що й читання", () => {
    expect(barSpot("/bands/7/lists/3/edit")).toEqual(barSpot("/bands/7/lists/3"));
  });

  it("пісня й зібрання — лише «назад», без історії — на рівень вище", () => {
    expect(barSpot("/bands/7/songs/5")).toEqual({
      bandId: null, screen: null, active: "back", back: "/bands/7/songs", songMenu: true,
    });
    expect(barSpot("/bands/7/songs/5/edit").back).toBe("/bands/7/songs");
    expect(barSpot("/bands/7/lists/3/songs/5").back).toBe("/bands/7/lists/3");
    expect(barSpot("/bands/7/lists/3/songs/5/notes").back).toBe("/bands/7/lists/3");
    expect(barSpot("/bands/7/lists/3/gathering").back).toBe("/bands/7/lists/3");
  });

  it("кнопка меню пісні — лише на пісні, не в зібранні", () => {
    expect(barSpot("/bands/7/lists/3/songs/5/edit").songMenu).toBe(true);
    expect(barSpot("/bands/7/lists/3/gathering").songMenu).toBe(false);
  });

  it("нова пісня — екран гурту, а не пісня з id «new»", () => {
    expect(barSpot("/bands/7/songs/new").screen).toBe("Нова пісня");
    expect(barSpot("/bands/7/songs/new/from-scratch").active).toBe("screen");
  });

  it("/bands/new — не гурт з id «new»", () => {
    expect(barSpot("/bands/new")).toEqual({ bandId: null, screen: "Новий гурт", active: "screen", back: null, songMenu: false });
  });
});
