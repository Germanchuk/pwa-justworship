/** Примітки для показу: над яким рядком картка, що зараз позначено, чи видно. */
import { layout } from "../read";
import { LANES, LaneType, Line, Song } from "../song";
import { Audience, canSee, NoteRecord, notesOf, resolveRange, TextAt } from "./marks";

export type NoteView = {
  note: NoteRecord;
  lane: LaneType;
  /** Маркер, у якому лежить запис. */
  holder: Line;
  /** Рядок, над яким картка: де позначене зараз, а якщо воно зникло — де лежить запис. */
  line: number;
  at: TextAt | null;
  status: "visible" | "hidden" | "lost";
};

/**
 * Примітки пісні, які бачить `audience` (`marks.ts`), з поточними позначками. Схована —
 * коли схована її доріжка; втрачена — коли зникло все позначене.
 */
export function resolveNotes(song: Song, audience: Audience, isShown: (line: number, lane: LaneType) => boolean): NoteView[] {
  const lines = layout(song);
  return lines.flatMap((l, owner) =>
    LANES.flatMap((lane) =>
      Array.from(notesOf(l.line, lane).values())
        .filter((note) => canSee(note, audience))
        .map((note): NoteView => {
          const at = resolveRange(song, lines, owner, lane, note);
          const line = at?.line ?? owner;
          const status = !at ? "lost" : isShown(line, lane) ? "visible" : "hidden";
          return { note, lane, holder: l.line, line, at, status };
        }),
    ),
  );
}
