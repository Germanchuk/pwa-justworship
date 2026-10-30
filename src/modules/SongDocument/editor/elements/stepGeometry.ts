/** Розміри кроків клітинкових доріжок на екрані (`StepRows`) — спільні для редактора й горизонтального формату. */
import { barSizes, CellKind, Line, lineLength, scaleOf } from "../../model";

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

