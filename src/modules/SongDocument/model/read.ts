/** Читання моделі: рядки по порядку і що в кожному з них. */
import * as Y from "yjs";

import { LaneType, Line, LineAt, LineKind, Song } from "./song";

/** Рядки пісні по порядку. */
export function layout(song: Song): LineAt[] {
  const out: LineAt[] = [];
  let pos = 0;
  for (const { insert } of song.text.toDelta() as { insert: string | Line }[]) {
    if (typeof insert === "string") {
      // Текст до першого маркера правила не створюють; якщо він є — він нічий.
      if (out.length) out[out.length - 1].words += insert;
      pos += insert.length;
    } else {
      out.push({ line: insert, at: pos, words: "" });
      pos += 1;
    }
  }
  return out;
}

export const linesOf = (song: Song) => layout(song).map((l) => l.line);

export function lineAt(song: Song, ln: number): LineAt {
  const l = layout(song)[ln];
  if (!l) throw new Error(`songModel: рядка ${ln} немає`);
  return l;
}

/** Номер рядка, якому належить місце `index` тексту пісні (−1 — до першого маркера). */
export function lineOfIndex(lines: readonly LineAt[], index: number) {
  let ln = -1;
  while (ln + 1 < lines.length && lines[ln + 1].at < index) ln++;
  return ln;
}

export const laneMap = (line: Line, lane: LaneType) => line.get(lane) as Y.Map<unknown>;
/** Текст доріжки рядка (акорди чи додана текстова); `undefined` — це не текстова доріжка або слота ще немає. */
export const laneText = (line: Line, lane: LaneType) => {
  const text = (line.get(lane) as Y.Map<unknown> | undefined)?.get?.("text");
  return text instanceof Y.Text ? text : undefined;
};
export const chordsOf = (line: Line) => laneText(line, "chords")!;
export const chordsString = (line: Line) => chordsOf(line)?.toString() ?? "";
/** Чи це текстова доріжка рядка (слова — завжди; решта — коли в слоті текст). */
export const isTextSlot = (line: Line, lane: LaneType) => lane === "words" || !!laneText(line, lane);
/** id текстових доріжок рядка, крім слів (акорди й додані текстові). */
export function textSlotsOf(line: Line): string[] {
  const out: string[] = [];
  line.forEach((_, id) => laneText(line, id) && out.push(id));
  return out;
}
export const laneOf = (l: LineAt, lane: LaneType) => (lane === "words" ? l.words : laneText(l.line, lane)?.toString() ?? "");
export const laneString = (song: Song, ln: number, lane: LaneType) => laneOf(lineAt(song, ln), lane);

/** Вид рядка — з вмісту: `/…` — структурна примітка, нічого в жодній доріжці — порожній, решта — відрізок. */
export function lineKind(l: LineAt): LineKind {
  if (l.words.startsWith("/")) return "note";
  if (!l.words && !hasContent(l.line)) return "empty";
  return "segment";
}

/** Чи є щось у доріжках рядка, крім слів: текст акордів чи доданих текстових, клітинки. */
function hasContent(line: Line) {
  let any = false;
  line.forEach((slot) => {
    if (any || !(slot instanceof Y.Map)) return;
    const text = slot.get("text");
    const cells = slot.get("cells");
    any = (text instanceof Y.Text && text.length > 0) || (cells instanceof Y.Map && cells.size > 0);
  });
  return any;
}
