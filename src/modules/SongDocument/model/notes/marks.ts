/**
 * Примітки — на доріжці свого рядка: `рядок.акорди.notes` або
 * `рядок.слова.notes`, ключ — id примітки. Запис незмінний (правка тексту
 * чи адресатів — новий запис під тим самим ключем); одна примітка — одна
 * доріжка одного рядка.
 *
 * Позначка — діапазон символів через відносні позиції Yjs:
 *  - слова — у спільному тексті пісні, тож позиції переживають Enter і
 *    склеювання без перерахунку — переїжджає лише запис;
 *  - акорди — у рядку акордів свого рядка.
 * Початок прив'язаний до першого позначеного символу, кінець — до
 * останнього: дописане по краях у позначку не входить.
 */
import * as Y from "yjs";
import { chordsOf, laneMap, laneOf, layout, lineOfIndex } from "../read";
import type { LaneType, Line, LineAt, Song } from "../song";

/** Кому видно примітку: `ALL` — усім, інакше ніки (автор і адресати). */
export const ALL = "all";

export type NoteRange = { anchor: unknown; focus: unknown; quote: string };
export type NoteRecord = NoteRange & {
  id: string;
  author: string;
  visibleFor: string[];
  /** Колір підсвітки (hex) або `STRIKE` — закреслення. */
  color: string;
  /** Текст картки; порожній — просто підсвітка. */
  body: string;
};

export const STRIKE = "strike";

export const notesOf = (line: Line, lane: LaneType) => laneMap(line, lane).get("notes") as Y.Map<NoteRecord>;

export const canSee = (note: NoteRecord, nick: string | null) =>
  note.visibleFor.includes(ALL) || (nick !== null && note.visibleFor.includes(nick));

export const rel = (type: Y.AbstractType<unknown>, index: number, assoc: number) =>
  Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(type, index, assoc));

/** Позначка на символах `from…to` доріжки рядка `ln`. */
export function noteRange(song: Song, ln: number, lane: LaneType, from: number, to: number): NoteRange {
  const l = layout(song)[ln];
  const [type, base] = lane === "words" ? [song.text, l.at + 1] : [chordsOf(l.line), 0];
  return { anchor: rel(type, base + from, 0), focus: rel(type, base + to, -1), quote: laneOf(l, lane).slice(from, to) };
}

/** Де зараз позначене: рядок і символи в доріжці, або null — позначене зникло. */
export type TextAt = { line: number; from: number; to: number };

/**
 * Слова — в тому рядку, де зараз перший позначений символ, і не далі його
 * кінця (Enter посеред позначеного лишає позначку на першій частині).
 * Акорди — у рядку `owner`, де лежить запис.
 */
export function resolveRange(song: Song, lines: readonly LineAt[], owner: number, lane: LaneType, range: NoteRange): TextAt | null {
  const at = (json: unknown) => Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(json), song.doc);
  const a = at(range.anchor);
  const f = at(range.focus);
  if (!a || !f) return null;
  if (lane === "chords") {
    const chords = chordsOf(lines[owner].line);
    if (a.type !== chords || f.type !== chords) return null;
    return f.index > a.index ? { line: owner, from: a.index, to: f.index } : null;
  }
  if (a.type !== song.text || f.type !== song.text) return null;
  const ln = lineOfIndex(lines, a.index); // рядок першого позначеного символу
  if (ln < 0) return null;
  const start = lines[ln].at + 1;
  const from = Math.max(a.index, start) - start;
  const to = Math.min(f.index, start + lines[ln].words.length) - start;
  return to > from ? { line: ln, from, to } : null;
}

/** Нова примітка на символах `from…to` доріжки рядка `ln`. Викликати в транзакції. */
export function addNote(
  song: Song,
  ln: number,
  lane: LaneType,
  from: number,
  to: number,
  note: Omit<NoteRecord, keyof NoteRange>,
) {
  notesOf(layout(song)[ln].line, lane).set(note.id, { ...note, ...noteRange(song, ln, lane, from, to) });
}
