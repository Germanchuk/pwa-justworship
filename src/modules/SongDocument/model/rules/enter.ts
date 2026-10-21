/** Enter у словах. */
import { dynamicsOf, personalDynamicsOf } from "../dynamics";
import { movableNotes, moveWordsNote } from "../notes/move";
import { allLanes } from "../lanes";
import { lineAt } from "../read";
import { newLine, Pos, Song } from "../song";

/**
 * Enter у словах — новий маркер на місці курсора: хвіст слів стає словами
 * нового рядка без жодного копіювання; акорди, клітинки й їхні примітки
 * лишаються першій частині (новий рядок — з порожніми слотами всіх доріжок).
 * Примітка слів, уся на хвості, переїжджає з ним. Динаміка (спільна й
 * особиста) — в обох частинах: пофарбоване місце лишається пофарбованим.
 *
 * На самому початку непорожніх слів увесь рядок їде вниз: новий порожній
 * маркер стає **перед** поточним, тож доріжки, примітки й динаміка лишаються
 * з рядком, а над ним — порожній рядок. Нічого не копіюється й не переноситься.
 *
 * Викликати в транзакції; повертає, де після правки курсор.
 */
export function splitLine(song: Song, at: Pos): Pos | null {
  if (at.lane !== "words") return null; // в акордах Enter немає
  const { line, at: marker, words } = lineAt(song, at.line);
  const next = newLine({ dynamics: dynamicsOf(line), dynamicsBy: personalDynamicsOf(line) }, allLanes(song.doc));
  if (at.offset === 0 && words.length > 0) {
    song.text.insertEmbed(marker, next);
    return { line: at.line + 1, lane: "words", offset: 0 };
  }
  const moving = movableNotes(song, at.line, "words").filter(
    ({ at: m }) => m && (m.line > at.line || m.from >= at.offset),
  );
  song.text.insertEmbed(marker + 1 + at.offset, next);
  moving.forEach(({ note }) => moveWordsNote(line, next, note));
  return { line: at.line + 1, lane: "words", offset: 0 };
}
