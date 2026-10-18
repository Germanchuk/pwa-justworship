/**
 * Переклад позицій: точка у видимому дереві ↔ місце в моделі (рядок, доріжка,
 * символ) ↔ відносна позиція Yjs (живе при чужих правках — для undo, згодом
 * для курсорів інших людей).
 */
import * as Y from "yjs";
import type { Point } from "slate";
import { chordsOf, laneOf, Line, lineOfIndex, Pos } from "../model";
import type { ViewState } from "./state";

export const indexOf = (s: ViewState, line: Line) => s.lines.findIndex((l) => l.line === line);

export const toModel = (s: ViewState, { path: [vln, vl], offset }: Point): Pos => ({
  line: indexOf(s, s.sources[vln].line),
  lane: s.sources[vln].lanes[vl],
  offset,
});

/** `null` — цієї доріжки людина не бачить. */
export function toView(s: ViewState, { line, lane, offset }: Pos): Point | null {
  const vln = s.sources.findIndex((src) => src.line === s.lines[line]?.line);
  const vl = vln < 0 ? -1 : s.sources[vln].lanes.indexOf(lane);
  return vl < 0 ? null : { path: [vln, vl, 0], offset };
}

/**
 * Місце в моделі → відносна позиція Yjs. У кінці доріжки позиція тримається
 * символу ліворуч (як у @slate-yjs): інакше в кінці слів вона чіплялась би за
 * маркер наступного рядка, і чужий Enter у кінці рядка переносив би її в новий.
 */
export function toRelative(s: ViewState, { line, lane, offset }: Pos): Y.RelativePosition {
  const l = s.lines[line];
  const assoc = offset === laneOf(l, lane).length ? -1 : 0;
  return lane === "words"
    ? Y.createRelativePositionFromTypeIndex(s.song.text, l.at + 1 + offset, assoc)
    : Y.createRelativePositionFromTypeIndex(chordsOf(l.line), offset, assoc);
}

/** Відносна позиція Yjs → точка у видимому; `null` — місця вже немає або його не видно. */
export function fromRelative(s: ViewState, rel: Y.RelativePosition): Point | null {
  const abs = Y.createAbsolutePositionFromRelativePosition(rel, s.song.doc);
  if (!abs) return null;
  if (abs.type === s.song.text) {
    const ln = lineOfIndex(s.lines, abs.index);
    return ln < 0 ? null : toView(s, { line: ln, lane: "words", offset: abs.index - s.lines[ln].at - 1 });
  }
  const ln = s.lines.findIndex((l) => chordsOf(l.line) === abs.type);
  return ln < 0 ? null : toView(s, { line: ln, lane: "chords", offset: abs.index });
}
