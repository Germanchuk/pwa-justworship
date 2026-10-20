/**
 * Документ пісні — модель (ADR-0007): слова всієї пісні — один `Y.Text`,
 * рядки в ньому розмічені вбудованими маркерами.
 *
 *   song: Y.Text   ▸Ти святий, Господь▸Твоє світло серед ночі▸/Приспів▸…
 *     ▸ — маркер рядка, вбудована в текст Y.Map:
 *       chords:     Y.Map { text: Y.Text, notes: Y.Map }  — рядок акордів і його примітки
 *       words:      Y.Map { notes: Y.Map }                — примітки слів (самі слова — у тексті пісні)
 *       <id>:       Y.Map { cells: Y.Map, notes: Y.Map }  — додана доріжка пісні (`lanes.ts`, ADR-0008)
 *       dynamics:   рядок                                 — спільний колір динаміки, може не бути
 *       dynamicsBy: Y.Map  нік → колір                    — особиста динаміка
 *     слова рядка — символи між його маркером і наступним.
 *
 *   lanes: Y.Map — доріжки пісні (`lanes.ts`); meta: Y.Map — шапка пісні
 *   (`meta.ts`); особисте поза рядками — `personal.ts`.
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
import { allLanes, isTextKind, newSlot, type LaneDef } from "./lanes";

/** Текстові доріжки — ті, що правляться в Slate; у рядку завжди акорди над словами, найнижче (ADR-0008). */
export type LaneType = "chords" | "words";
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

/**
 * Новий маркер. Поля створюються разом із ним, тож ніхто не створює їх
 * одночасно з іншим; слоти — для слів, акордів і всіх доріжок `lanes`
 * (і прибраних — повернута доріжка має мати слот).
 */
export function newLine({ chords = "", dynamics, dynamicsBy = {} }: Omit<LineInit, "words"> = {}, lanes: readonly LaneDef[] = []): Line {
  const line = new Y.Map<unknown>();
  line.set("chords", newSlot("chords", chords));
  line.set("words", newSlot("words"));
  lanes.forEach((lane) => isTextKind(lane.kind) || line.set(lane.id, newSlot(lane.kind)));
  line.set("dynamicsBy", new Y.Map<string>(Object.entries(dynamicsBy)));
  if (dynamics) line.set("dynamics", dynamics);
  return line;
}

/** Дописати рядки в кінець пісні (засів документа). */
export function appendLines(song: Song, inits: LineInit[]) {
  const all = allLanes(song.doc);
  inits.forEach(({ words = "", ...lanes }) => {
    song.text.insertEmbed(song.text.length, newLine(lanes, all));
    if (words) song.text.insert(song.text.length, words);
  });
}
