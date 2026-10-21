/** Склеювання рядків: Backspace на початку слів і Delete у їхньому кінці. */
import * as Y from "yjs";
import { appendCells } from "../cells";
import { movableNotes, moveLaneNote, moveWordsNote } from "../notes/move";
import { filledLanes, laneText, layout, lineAt, lineKind, textSlotsOf } from "../read";
import { removeLine } from "../write";
import type { Pos, Song } from "../song";

/**
 * Склеїти рядок `ln` з попереднім — видалити його маркер: слова самі стають
 * словами попереднього. Непорожні акорди й додані текстові доріжки
 * дописуються вирівняними під кінець слів (це копія), примітки всіх доріжок
 * переїжджають у попередній рядок. Клітинкові доріжки дописуються після
 * тактів попереднього (теж копія). Динаміка — попереднього рядка (як і решта
 * його полів).
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
  cur.line.forEach((slot, id) => {
    const to = prev.line.get(id);
    if (slot instanceof Y.Map && slot.has("cells") && to instanceof Y.Map) appendCells(slot, to);
  });
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
