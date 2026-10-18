/** Склеювання рядків: Backspace на початку слів і Delete у їхньому кінці. */
import { movableNotes, moveChordsNote, moveWordsNote } from "../notes/move";
import { chordsOf, chordsString, layout, lineAt } from "../read";
import type { Pos, Song } from "../song";

/**
 * Склеїти рядок `ln` з попереднім — видалити його маркер: слова самі стають
 * словами попереднього. Непорожні акорди дописуються вирівняними під кінець
 * слів (це копія), примітки обох доріжок переїжджають у попередній рядок.
 * Динаміка — попереднього рядка (як і решта його полів).
 */
export function mergeLine(song: Song, ln: number): Pos {
  const prev = lineAt(song, ln - 1);
  const cur = lineAt(song, ln);
  const chords = chordsOf(prev.line);
  const tail = chordsString(cur.line);
  // До правок: позиції в акордах `cur` ще живі.
  const wordsNotes = movableNotes(song, ln, "words");
  const chordsNotes = movableNotes(song, ln, "chords");

  let shift = chords.length;
  if (tail.trim()) {
    const wordsLen = prev.words.length;
    const pad = chords.length < wordsLen ? " ".repeat(wordsLen - chords.length) : chords.length ? " " : "";
    shift = chords.length + pad.length;
    chords.insert(chords.length, pad + tail);
  }
  wordsNotes.forEach(({ note }) => moveWordsNote(cur.line, prev.line, note));
  chordsNotes.forEach((n) => moveChordsNote(cur.line, prev.line, n, shift));
  song.text.delete(cur.at, 1);
  return { line: ln - 1, lane: "words", offset: prev.words.length };
}

/** Backspace на початку доріжки: на початку слів — склеїти з попереднім рядком; в акордах — нічого. */
export function backspaceAtLaneStart(song: Song, at: Pos): Pos | null {
  return at.lane === "words" && at.line > 0 ? mergeLine(song, at.line) : null;
}

/** Delete у кінці доріжки: у кінці слів — приєднати наступний рядок; в акордах — нічого. */
export function deleteAtLaneEnd(song: Song, at: Pos): Pos | null {
  if (at.lane !== "words" || at.line >= layout(song).length - 1) return null;
  mergeLine(song, at.line + 1);
  return at;
}
