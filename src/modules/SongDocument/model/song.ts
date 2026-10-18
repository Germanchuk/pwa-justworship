/**
 * Документ пісні — модель (ADR-0007): слова всієї пісні — один `Y.Text`,
 * рядки в ньому розмічені вбудованими маркерами.
 *
 *   song: Y.Text   ▸Ти святий, Господь▸Твоє світло серед ночі▸/Приспів▸…
 *     ▸ — маркер рядка, вбудована в текст Y.Map:
 *       chords:     Y.Map { text: Y.Text, notes: Y.Map }  — рядок акордів і його примітки
 *       words:      Y.Map { notes: Y.Map }                — примітки слів (самі слова — у тексті пісні)
 *       dynamics:   рядок                                 — спільний колір динаміки, може не бути
 *       dynamicsBy: Y.Map  нік → колір                    — особиста динаміка
 *     слова рядка — символи між його маркером і наступним.
 *
 *   meta: Y.Map — шапка пісні (`meta.ts`); особисте поза рядками — `personal.ts`.
 *
 * Чому так: Enter — це вставка маркера, склеювання — видалення маркера.
 * Слова між рядками ніколи не копіюються, тож одночасні Enter не задвоюють
 * хвіст, а набране в рядок, який хтось у цю мить склеює, не губиться. (Yjs
 * не вміє переносити — лише копіювати й видаляти; тут переносити нічого.)
 *
 * Маркер — ідентичність рядка: той самий об'єкт Y.Map, доки рядок живий.
 * Перший символ тексту — маркер рядка №0; правила його не видаляють.
 */
import * as Y from "yjs";
import type { DynamicsStepKey } from "./dynamicsSteps";

export type LaneType = "chords" | "words";
/** Порядок доріжок у рядку (і в порядку документа: акорди рядка → його слова). */
export const LANES: readonly LaneType[] = ["chords", "words"];
export type LineKind = "segment" | "empty" | "note";

/** Маркер рядка — вбудована в текст пісні Y.Map; він же ідентичність рядка. */
export type Line = Y.Map<unknown>;
export type Song = { doc: Y.Doc; text: Y.Text };
export type LineInit = {
  words?: string;
  chords?: string;
  dynamics?: DynamicsStepKey | null;
  dynamicsBy?: Record<string, DynamicsStepKey>;
};

/** Рядок у тексті пісні: маркер, де він стоїть у тексті, і слова рядка. */
export type LineAt = { line: Line; at: number; words: string };

/** Місце в документі: рядок, доріжка, символ. */
export type Pos = { line: number; lane: LaneType; offset: number };

/** Чи може цей учасник правити доріжку рядка (бачить її). */
export type CanEdit = (line: number, lane: LaneType) => boolean;

export const songOf = (doc: Y.Doc): Song => ({ doc, text: doc.getText("song") });

/** Новий маркер. Поля створюються разом із ним, тож ніхто не створює їх одночасно з іншим. */
export function newLine({ chords = "", dynamics, dynamicsBy = {} }: Omit<LineInit, "words"> = {}): Line {
  const chordsLane = new Y.Map<unknown>();
  chordsLane.set("text", new Y.Text(chords));
  chordsLane.set("notes", new Y.Map());
  const wordsLane = new Y.Map<unknown>();
  wordsLane.set("notes", new Y.Map());

  const line = new Y.Map<unknown>();
  line.set("chords", chordsLane);
  line.set("words", wordsLane);
  line.set("dynamicsBy", new Y.Map<string>(Object.entries(dynamicsBy)));
  if (dynamics) line.set("dynamics", dynamics);
  return line;
}

/** Дописати рядки в кінець пісні (засів документа). */
export function appendLines(song: Song, inits: LineInit[]) {
  inits.forEach(({ words = "", ...lanes }) => {
    song.text.insertEmbed(song.text.length, newLine(lanes));
    if (words) song.text.insert(song.text.length, words);
  });
}
