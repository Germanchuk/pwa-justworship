/** Склеювання рядків: Backspace на початку слів і Delete у їхньому кінці. */
import * as Y from "yjs";
import { appendCells, blankLength, EIGHTH_TICKS, lineLength, setLineLength } from "../cells";
import { readMeta } from "../meta";
import { notesOf } from "../notes/marks";
import { movableNotes, moveLaneNote, moveTimeNote, moveWordsNote } from "../notes/move";
import { filledLanes, laneText, layout, lineAt, lineKind, textSlotsOf } from "../read";
import { removeLine } from "../write";
import type { Pos, Song } from "../song";

/**
 * Склеїти рядок `ln` з попереднім — видалити його маркер: слова самі стають
 * словами попереднього. Непорожні акорди й додані текстові доріжки
 * дописуються вирівняними під кінець слів (це копія), примітки всіх доріжок
 * переїжджають у попередній рядок. Клітинкові доріжки дописуються після
 * тактів попереднього (теж копія, примітки — зсунуті з ними), і довжина
 * склеєного — сума довжин (з неповним тактом посередині — як є). Динаміка — попереднього рядка (як і
 * решта його полів).
 */
export function mergeLine(song: Song, ln: number): Pos {
  const prev = lineAt(song, ln - 1);
  const cur = lineAt(song, ln);
  // Попередній рядок порожній — прибрати лише його маркер: рядок піднімається
  // цілком, нічого не копіюючи (обернене до Enter на початку слів). Крім рядка
  // №0: те, що в нього в цю мить друкують, лишилось би перед першим маркером.
  if (ln - 1 > 0 && lineKind(prev) === "empty") {
    song.text.delete(prev.at, 1);
    return { line: ln - 1, lane: "words", offset: 0 };
  }
  // До правок: позиції в текстах `cur` ще живі.
  const wordsNotes = movableNotes(song, ln, "words");
  const lanes = textSlotsOf(cur.line).filter((id) => laneText(prev.line, id));
  const laneNotes = lanes.map((id) => movableNotes(song, ln, id));

  lanes.forEach((id, i) => {
    const text = laneText(prev.line, id)!;
    const tail = laneText(cur.line, id)!.toString();
    let shift = text.length;
    if (tail.trim()) {
      const wordsLen = prev.words.length;
      const pad = text.length < wordsLen ? " ".repeat(wordsLen - text.length) : text.length ? " " : "";
      shift = text.length + pad.length;
      text.insert(text.length, pad + tail);
    }
    laneNotes[i].forEach((n) => moveLaneNote(cur.line, prev.line, id, n, shift));
  });
  const { timeSignature } = readMeta(song.doc);
  const cellLanes = Array.from(cur.line.entries()).filter(([, slot]) => slot instanceof Y.Map && slot.has("cells"));
  if (cellLanes.length) {
    // Попередній без тактів і без вмісту — другий лягає з його початку, без зайвого порожнього такту.
    const offset = blankLength(prev.line) ? 0 : lineLength(prev.line, timeSignature);
    const length = offset + lineLength(cur.line, timeSignature);
    cellLanes.forEach(([id, slot]) => {
      const to = prev.line.get(id);
      if (!(to instanceof Y.Map)) return;
      appendCells(slot as Y.Map<unknown>, to, offset, timeSignature);
      Array.from(notesOf(cur.line, id)?.values() ?? []).forEach((note) => moveTimeNote(cur.line, prev.line, id, note, offset * EIGHTH_TICKS));
    });
    setLineLength(prev.line, length);
  }
  wordsNotes.forEach(({ note }) => moveWordsNote(cur.line, prev.line, note));
  song.text.delete(cur.at, 1);
  return { line: ln - 1, lane: "words", offset: prev.words.length };
}

/**
 * Backspace на початку **порожніх** слів рядка, у якого в інших доріжках є
 * вміст (акорди, таби, вигуки), прибирає рядок разом із цим вмістом — тож
 * спершу попередження (`SONG-90`). Повертає id доріжок із вмістом або `null`,
 * коли попереджати не треба.
 */
export function removalNeedsConfirm(song: Song, at: Pos): string[] | null {
  if (at.lane !== "words" || at.offset !== 0 || at.line === 0) return null;
  const l = lineAt(song, at.line);
  if (l.words) return null;
  const filled = filledLanes(l.line);
  return filled.length ? filled : null;
}

/**
 * Склеювання двох **непорожніх** рядків (Backspace на початку слів рядка
 * `ln`, Delete у кінці слів рядка `ln - 1`) — спершу попередження (`SONG-92`).
 * Порожній рядок з будь-якого боку просто зникає — попереджати нема про що.
 */
export function mergeNeedsConfirm(song: Song, ln: number) {
  const lines = layout(song);
  if (ln <= 0 || ln >= lines.length) return false;
  return lineKind(lines[ln - 1]) !== "empty" && lineKind(lines[ln]) !== "empty";
}

/** Прибрати рядок `ln` разом із доріжками (підтверджене видалення); курсор — у кінець слів попереднього. */
export function removeLineAt(song: Song, ln: number): Pos {
  const prev = lineAt(song, ln - 1);
  removeLine(song, ln);
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
