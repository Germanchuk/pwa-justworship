/** Друк із правилом «/»: структурна примітка починається лише в порожньому рядку. */
import { lineAt, lineKind } from "../read";
import type { Pos, Song } from "../song";
import { insertIn } from "../write";

/**
 * `/` на початку слів (структурна примітка) — лише в порожньому рядку; перед
 * `/` примітки нічого не вставити. Деінде `/` — звичайний символ (`D/F#`).
 */
export function slashAllowed(song: Song, at: Pos, text: string) {
  if (at.lane !== "words" || at.offset !== 0) return true;
  const l = lineAt(song, at.line);
  if (l.words.startsWith("/")) return false;
  return !text.startsWith("/") || lineKind(l) === "empty";
}

export function insertText(song: Song, at: Pos, text: string): Pos | null {
  if (!slashAllowed(song, at, text)) return null;
  insertIn(song, at, text);
  return { ...at, offset: at.offset + text.length };
}
