/** Примітки для показу: над яким рядком картка, що зараз позначено, чи видно. */
import { layout, textSlotsOf } from "../read";
import type { LaneType, Line, Song } from "../song";
import { ALL, Audience, canSee, NoteRecord, notesOf, resolveRange, TextAt } from "./marks";

export type NoteView = {
  note: NoteRecord;
  lane: LaneType;
  /** Маркер, у якому лежить запис. */
  holder: Line;
  /** Рядок, над яким картка: де позначене зараз, а якщо воно зникло — де лежить запис. */
  line: number;
  at: TextAt | null;
  status: "visible" | "hidden" | "lost";
  /** Чужа — `audience` її не бачить; показується лише сірою підсвіткою в правці (`NOTE-15`). */
  foreign?: true;
};

/** Усі записи приміток пісні: рядок запису, доріжка, запис. */
function records(song: Song) {
  return layout(song).flatMap((l, owner) =>
    [...textSlotsOf(l.line), "words"].flatMap((lane) => Array.from(notesOf(l.line, lane).values()).map((note) => ({ owner, lane, note }))),
  );
}

/**
 * Примітки пісні, які бачить `audience` (`marks.ts`), з поточними позначками. Схована —
 * коли схована її доріжка; втрачена — коли зникло все позначене. `others` — ще й
 * решту, позначених `foreign`.
 */
export function resolveNotes(
  song: Song,
  audience: Audience,
  isShown: (line: number, lane: LaneType) => boolean,
  { others = false } = {},
): NoteView[] {
  const lines = layout(song);
  return records(song).flatMap(({ owner, lane, note }): NoteView[] => {
    const seen = canSee(note, audience);
    if (!seen && !others) return [];
    const at = resolveRange(song, lines, owner, lane, note);
    const line = at?.line ?? owner;
    const status = !at ? "lost" : isShown(line, lane) ? "visible" : "hidden";
    return [{ note, lane, holder: lines[owner].line, line, at, status, ...(seen ? {} : { foreign: true as const }) }];
  });
}

/**
 * Числа біля імен у виборі «чиїми очима» (`NOTE-45`): скільки позначок буде
 * видно, якщо до `audience` додати `nick` (для вже відміченого — те, що на
 * екрані), і скільки в нього особисто. Публічні не рахуються.
 */
export function noteCounts(song: Song, audience: Audience, nick: string): { together: number; own: number } {
  const addressed = records(song)
    .map((r) => r.note)
    .filter((n) => !n.visibleFor.includes(ALL));
  const together = audience.includes(nick) ? audience : [...audience, nick];
  return {
    together: addressed.filter((n) => canSee(n, together)).length,
    own: addressed.filter((n) => canSee(n, [nick])).length,
  };
}
