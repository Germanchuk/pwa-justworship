/**
 * Кахон — клітинки одного такту, атрибути рядка `cajon:1.<доля>`.
 * Порожній кахон у відрізку = «як попередньо» (sim.): рисунок найближчого
 * попереднього рядка, де він є.
 */
import { Node } from "slate";

export const CAJON_STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const cajonKey = (step: number) => `cajon:1.${step}`;

export type CajonCells = Partial<Record<number, string>>;

export function cajonOf(line: Node): CajonCells {
  const cells: CajonCells = {};
  CAJON_STEPS.forEach((step) => {
    const v = (line as Record<string, unknown>)[cajonKey(step)];
    if (typeof v === "string" && v) cells[step] = v;
  });
  return cells;
}

const isEmpty = (cells: CajonCells) => Object.keys(cells).length === 0;

/** Рисунок, який звучить у рядку `ln`: свій, або успадкований (з номером рядка). */
export function cajonAt(lines: Node[], ln: number): { cells: CajonCells; from: number } | null {
  for (let i = ln; i >= 0; i--) {
    const cells = cajonOf(lines[i]);
    if (!isEmpty(cells)) return { cells, from: i };
  }
  return null;
}
