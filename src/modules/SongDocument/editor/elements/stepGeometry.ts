/** Розміри кроків клітинкових доріжок на екрані (`StepRows`) — спільні для редактора й горизонтального формату. */
import * as Y from "yjs";
import { barSizes, CellAt, CellKind, Line, lineLength, scaleOf } from "../../model";

export const INK: Record<CellKind, string> = { tab: "#57534e", cajon: "#92400e", blocks: "#1e40af", piano: "#6d28d9" };
export const STEP_PX = 12;
export const ROW_PX = 17;
/** Лінія-клавіша піаніно нижча за струну: 88 клавіш і так довгі. */
export const PIANO_ROW_PX = 11;
/** Висота лінії доріжки виду `kind`. */
export const rowPxOf = (kind: CellKind) => (kind === "piano" ? PIANO_ROW_PX : ROW_PX);
export const BAR_PX = 8;
/**
 * Геометрія рядка доріжки виду `kind`: масштаб, такти в комірках і ширина
 * кроку. Прямокутники без масштабу: їхня комірка ширша чи вужча, щоб такт був
 * завширшки як у ударів. `width` — уся смуга з рисками тактів.
 */
export function stepGeometry(kind: CellKind, line: Line, timeSignature: string, zoom?: number) {
  const scale = scaleOf(kind, timeSignature, zoom);
  const stepPx = kind === "blocks" ? (STEP_PX * scaleOf("tab", timeSignature, zoom).cells) / scale.cells : STEP_PX;
  const sizes = barSizes(lineLength(line, timeSignature), timeSignature, scale);
  const width = (sizes.length + 1) * BAR_PX + sizes.reduce((a, b) => a + b, 0) * stepPx;
  return { scale, stepPx, sizes, width };
}


/** Де на смузі кроків лівий край комірки `step` (такти — `cells` комірок по `stepPx`, між ними риски). */
export const stepX = (step: number, cells: number, stepPx: number) =>
  Math.floor(step / cells) * (BAR_PX + cells * stepPx) + BAR_PX + (step % cells) * stepPx;

/**
 * Комірка під точкою `x`, `y` (px від верхнього лівого кута смуги кроків), —
 * обернене до `stepX`; поза смугою — найближча. Без пошуку елемента під
 * пальцем: кроки піаніно — не елементи, а фон.
 */
export function stepAtPoint(x: number, y: number, sizes: readonly number[], cells: number, stepPx: number, rowPx: number, rows: number): CellAt {
  const barW = BAR_PX + cells * stepPx;
  const bar = Math.min(Math.max(Math.floor(x / barW), 0), sizes.length - 1);
  const s = Math.min(Math.max(Math.floor((x - bar * barW - BAR_PX) / stepPx), 0), sizes[bar] - 1);
  return { step: bar * cells + s, string: Math.min(Math.max(Math.floor(y / rowPx), 0), rows - 1) };
}

/**
 * Відбиток того, що малюють кроки рядка: довжина й клітинки. Збігся з
 * попереднім — доріжку цього рядка не перемальовувати (`StepRows` — memo).
 */
export const stepsVersion = (slot: Y.Map<unknown>, line: Line, timeSignature: string) =>
  `${lineLength(line, timeSignature)}|${Array.from((slot.get("cells") as Y.Map<string>).entries(), ([k, v]) => `${k}=${v}`).join(",")}`;
