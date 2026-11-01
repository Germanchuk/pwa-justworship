/**
 * Копіювання й перенесення кроків смуги (`SONG-98`): виділене довгим натиском
 * (`useStripSteps`) — усі лінії доріжки на проміжку часу рядка. Копія лягає в
 * буфер і вставляється в комірку курсора (`StripCellEditor`); перенесення —
 * протягом виділеного пальцем.
 */
import * as Y from "yjs";
import { allLanes, copySpan, eraseSpan, isTextKind, layout, lineTicks, pasteSpan, readMeta, type CellKind, type CellsClip, type Song } from "../../model";
import type { StepsSel } from "./useStripSteps";

/** Доріжки, які вже правляться лежачи. */
export const EDITABLE: readonly string[] = ["tab"];

const slotOf = (song: Song, ln: number, lane: string) => {
  const slot = layout(song)[ln]?.line.get(lane);
  return slot instanceof Y.Map && slot.get("cells") instanceof Y.Map ? (slot as Y.Map<unknown>) : null;
};
/** Чи правиться доріжка `lane` лежачи. */
export const editable = (song: Song, lane: string) => EDITABLE.includes(allLanes(song.doc).find((l) => l.id === lane)?.kind ?? "");

export function copySteps(song: Song, { ln, lane, from, to }: StepsSel): CellsClip | null {
  const slot = slotOf(song, ln, lane);
  const kind = allLanes(song.doc).find((l) => l.id === lane)?.kind;
  return slot && kind && !isTextKind(kind) ? copySpan(kind as CellKind, slot, from, to, readMeta(song.doc).timeSignature) : null;
}

/** Покласти `clip` у доріжку `lane` рядка `ln` з `at` (тіки від початку рядка); доріжка іншого виду — ні. */
export function pasteSteps(song: Song, ln: number, lane: string, at: number, clip: CellsClip) {
  const slot = slotOf(song, ln, lane);
  if (!slot || allLanes(song.doc).find((l) => l.id === lane)?.kind !== clip.kind) return;
  const { timeSignature } = readMeta(song.doc);
  song.doc.transact(() => pasteSpan(slot, at, clip, lineTicks(layout(song)[ln].line, timeSignature), timeSignature));
}

/** Перенести виділене `sel` так, щоб воно починалося з `at` рядка `ln` (та сама доріжка). */
export function moveSteps(song: Song, sel: StepsSel, ln: number, at: number) {
  const clip = copySteps(song, sel);
  const from = slotOf(song, sel.ln, sel.lane);
  if (!clip || !from) return;
  song.doc.transact(() => {
    eraseSpan(clip.kind, from, sel.from, sel.to, readMeta(song.doc).timeSignature); // звідки беремо — порожньо
    pasteSteps(song, ln, sel.lane, at, clip);
  });
}
