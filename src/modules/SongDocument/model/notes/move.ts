/** Перенесення записів приміток між рядками — при Enter і склеюванні. */
import { laneText, layout } from "../read";
import type { LaneType, Line, Song } from "../song";
import { NoteRecord, notesOf, rel, resolveRange, TextAt } from "./marks";

/** Примітка доріжки рядка з тим, що вона зараз позначає (null — позначене зникло). */
export type MovableNote = { note: NoteRecord; at: TextAt | null };

export function movableNotes(song: Song, ln: number, lane: LaneType): MovableNote[] {
  const lines = layout(song);
  return Array.from(notesOf(lines[ln].line, lane).values(), (note) => ({
    note,
    at: resolveRange(song, lines, ln, lane, note),
  }));
}

/** Перенести запис примітки слів з маркера `from` у маркер `to` — позиції в спільному тексті лишаються як є. */
export function moveWordsNote(from: Line, to: Line, note: NoteRecord) {
  notesOf(from, "words").delete(note.id);
  notesOf(to, "words").set(note.id, note);
}

/**
 * Перенести примітку текстової доріжки `lane` (акорди, додана) у ту саму
 * доріжку рядка `to`, зсунуту на `shift` (текст `from` дописаний туди з цього
 * місця). Позначене, що вже зникло, — примітка лишається з тим самим записом
 * (її покажуть як втрачену). Викликати, поки маркер `from` ще в документі.
 */
export function moveLaneNote(from: Line, to: Line, lane: LaneType, { note, at }: MovableNote, shift: number) {
  const text = laneText(to, lane)!;
  notesOf(from, lane).delete(note.id);
  notesOf(to, lane).set(
    note.id,
    at ? { ...note, anchor: rel(text, at.from + shift, 0), focus: rel(text, at.to + shift, -1) } : note,
  );
}
