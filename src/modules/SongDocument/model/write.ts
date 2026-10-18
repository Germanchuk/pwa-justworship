/** Правки тексту доріжки без правил — цеглинки, з яких складені правила (`rules/`). */
import { chordsOf, lineAt } from "./read";
import { LaneType, Pos, Song } from "./song";

export function insertIn(song: Song, at: Pos, text: string) {
  const l = lineAt(song, at.line);
  if (at.lane === "words") song.text.insert(l.at + 1 + at.offset, text);
  else chordsOf(l.line).insert(at.offset, text);
}

export function eraseIn(song: Song, ln: number, lane: LaneType, from: number, to: number) {
  if (to <= from) return;
  const l = lineAt(song, ln);
  if (lane === "words") song.text.delete(l.at + 1 + from, to - from);
  else chordsOf(l.line).delete(from, to - from);
}

/**
 * Прибрати рядок цілком — маркер (а з ним акорди, кахон, примітки) і слова.
 * Що хтось у цю мить дописує в його слова, лишається — в кінці попереднього
 * рядка. Рядок №0 не прибирається: на ньому тримається початок тексту.
 */
export function removeLine(song: Song, ln: number) {
  if (ln === 0) throw new Error("songModel: рядок №0 не прибирається");
  const { at, words } = lineAt(song, ln);
  song.text.delete(at, 1 + words.length);
}
