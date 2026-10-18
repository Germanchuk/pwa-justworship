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
export const chordsOf = (line: Line) => laneMap(line, "chords").get("text") as Y.Text;
export const chordsString = (line: Line) => chordsOf(line)?.toString() ?? "";
export const laneOf = (l: LineAt, lane: LaneType) => (lane === "words" ? l.words : chordsString(l.line));
export const laneString = (song: Song, ln: number, lane: LaneType) => laneOf(lineAt(song, ln), lane);

/** Вид рядка — з вмісту: `/…` — структурна примітка, нічого — порожній, решта — відрізок. */
export function lineKind(l: LineAt): LineKind {
  if (l.words.startsWith("/")) return "note";
  if (!l.words && !chordsString(l.line)) return "empty";
  return "segment";
}
