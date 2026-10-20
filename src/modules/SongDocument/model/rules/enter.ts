/** Enter у словах. */
import { dynamicsOf, personalDynamicsOf } from "../dynamics";
import { movableNotes, moveWordsNote } from "../notes/move";
import { allLanes } from "../lanes";
import { lineAt } from "../read";
import { newLine, Pos, Song } from "../song";

/**
 * Enter у словах — новий маркер на місці курсора: хвіст слів стає словами
 * нового рядка без жодного копіювання; акорди, клітинки й їхні примітки
 * лишаються першій частині (новий рядок — з порожніми слотами всіх доріжок). Примітка слів, уся на хвості, переїжджає з ним. Динаміка
 * (спільна й особиста) — в обох частинах: пофарбоване місце лишається
 * пофарбованим. Викликати в транзакції; повертає, де після правки курсор.
 */
export function splitLine(song: Song, at: Pos): Pos | null {
  if (at.lane !== "words") return null; // в акордах Enter немає
  const { line, at: marker } = lineAt(song, at.line);
  const moving = movableNotes(song, at.line, "words").filter(
    ({ at: m }) => m && (m.line > at.line || m.from >= at.offset),
  );
  const next = newLine({ dynamics: dynamicsOf(line), dynamicsBy: personalDynamicsOf(line) }, allLanes(song.doc));
  song.text.insertEmbed(marker + 1 + at.offset, next);
  moving.forEach(({ note }) => moveWordsNote(line, next, note));
  return { line: at.line + 1, lane: "words", offset: 0 };
}
