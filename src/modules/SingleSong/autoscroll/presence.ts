/**
 * Присутність (`SCROLL-8`, `SCROLL-31`): на якій пісні пристрій і в якому
 * режимі. Кожен пристрій каже це про себе в awareness кімнати гурту; не на
 * пісні — запису немає. Awareness зникає разом із пристроєм (закрив
 * застосунок, втратив звʼязок), тож і присутність теж.
 */

import type { SongMode } from "../mode";
import type { AutoscrollRun } from "./run";

export type Presence = { device: string; songId: string; mode: SongMode };

const MODES: readonly string[] = ["read", "edit", "notes"] satisfies SongMode[];

/**
 * Чи ініціатор на цій пісні в режимі читання. Перезавантажена сторінка —
 * новий пристрій, тож ініціатор після неї відсутній (`SCROLL-27`).
 */
export const initiatorPresent = (
  run: AutoscrollRun,
  songId: string | number,
  presences: Presence[],
): boolean =>
  presences.some(
    (presence) =>
      presence.device === run.initiator.device &&
      presence.songId === String(songId) &&
      presence.mode === "read",
  );

/** Запис присутності з awareness іншого пристрою: битий — немає. */
export const parsePresence = (value: unknown): Presence | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.device !== "string" ||
    (typeof v.songId !== "string" && typeof v.songId !== "number") ||
    typeof v.mode !== "string" ||
    !MODES.includes(v.mode)
  ) {
    return null;
  }
  return { device: v.device, songId: String(v.songId), mode: v.mode as SongMode };
};
