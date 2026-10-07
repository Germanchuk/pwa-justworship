import { describe, expect, it } from "vitest";

import { focusFraction, nearestRow, rowAtFraction } from "./focus";

describe("focusFraction — де на екрані фокусний рядок", () => {
  // Екран 800, пісню можна прокрутити на 3000.
  it.each([
    { name: "посеред пісні — по центру", offset: 1500, max: 3000, at: 0.5 },
    { name: "на самому початку — нагорі", offset: 0, max: 3000, at: 0 },
    { name: "в кінці — внизу", offset: 3000, max: 3000, at: 1 },
    { name: "на півдорозі до центру зверху", offset: 200, max: 3000, at: 0.25 },
    { name: "докрутив пів екрана — вже центр", offset: 400, max: 3000, at: 0.5 },
    { name: "за пів екрана до кінця — ще центр", offset: 2600, max: 3000, at: 0.5 },
    { name: "на півдорозі донизу", offset: 2800, max: 3000, at: 0.75 },
    { name: "гумовий відскок iOS вгору — як початок", offset: -40, max: 3000, at: 0 },
    { name: "гумовий відскок iOS вниз — як кінець", offset: 3040, max: 3000, at: 1 },
    { name: "коротка прокрутка — рівномірно від верху до низу", offset: 150, max: 600, at: 0.25 },
    { name: "прокручувати нікуди — перший рядок", offset: 0, max: 0, at: 0 },
  ])("$name", ({ offset, max, at }) => {
    expect(focusFraction({ offset, max, viewport: 800 })).toBeCloseTo(at);
  });
});

describe("nearestRow — один стовпець: рядок, найближчий до проби", () => {
  const rows = [
    { row: 0, start: 100, end: 140 },
    { row: 1, start: 140, end: 200 },
    { row: 4, start: 200, end: 240 }, // 2–3 сховані фільтром
  ];

  it.each([
    { name: "проба всередині рядка", probe: 170, row: 1 },
    { name: "проба вище за пісню — перший", probe: 0, row: 0 },
    { name: "проба нижче за пісню — останній видимий", probe: 900, row: 4 },
    { name: "між центрами — до ближчого", probe: 200, row: 4 },
  ])("$name", ({ probe, row }) => {
    expect(nearestRow(rows, probe)).toBe(row);
  });

  it("нічого не видно — фокуса немає", () => {
    expect(nearestRow([], 400)).toBeNull();
  });
});

describe("rowAtFraction — колонки: рахуємо видимі рядки", () => {
  const visible = [10, 11, 12, 13, 14];

  it.each([
    { name: "на початку — перший видимий", at: 0, row: 10 },
    { name: "по центру — середній з видимих", at: 0.5, row: 12 },
    { name: "в кінці — останній видимий", at: 1, row: 14 },
    { name: "чверть — ближчий за рахунком", at: 0.25, row: 11 },
  ])("$name", ({ at, row }) => {
    expect(rowAtFraction(visible, at)).toBe(row);
  });

  it("нічого не видно — фокуса немає", () => {
    expect(rowAtFraction([], 0.5)).toBeNull();
  });
});
