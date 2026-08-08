/**
 * Slate-трансформації режимів показу — реалізація контрактів з `model.ts`.
 *
 *   resolveDisplay   — які фільтри увімкнені для цього користувача;
 *   setFilterHidden  — увімкнути/вимкнути один фільтр для цього користувача;
 *   isRowHiddenAt    — чисте правило показу для одного рядка секції.
 *
 * Показ карток приміток окремого правила більше не має: картка живе на першому
 * ВИДИМОМУ рядку зі своєю міткою, тож `isRowHiddenAt` вирішує і за неї —
 * див. `comments/noteHeads.ts`.
 */

import { Element, Transforms, type Descendant, type Editor } from "slate";

import type { SongMetaRowElement } from "../types";
import { findMetaRow } from "../withHeader";
import { DISPLAY_FIELD, type DisplayFilter, type DisplayState } from "./model";

export const resolveDisplay = (
  editor: Editor,
  username: string | undefined,
): DisplayState => {
  const row = findMetaRow(editor)?.[0];
  const isOn = (filter: DisplayFilter) =>
    !!username && !!row?.[DISPLAY_FIELD[filter]]?.includes(username);

  return {
    chordsHidden: isOn("chords"),
    lyricsHidden: isOn("lyrics"),
  };
};

export const setFilterHidden = (
  editor: Editor,
  username: string | undefined,
  filter: DisplayFilter,
  hidden: boolean,
): void => {
  if (!username) return;
  const entry = findMetaRow(editor);
  if (!entry) return;
  const [row, path] = entry;

  const field = DISPLAY_FIELD[filter];
  const current = row[field] ?? [];
  if (current.includes(username) === hidden) return; // нічого не змінюється

  const next = hidden
    ? [...current, username]
    : current.filter((u) => u !== username);

  Transforms.setNodes<SongMetaRowElement>(
    editor,
    // Через unknown: обчислений ключ звужується до `string`, а в
    // `SongMetaRowElement` є шаблонний індексний підпис для приміток.
    { [field]: next } as unknown as Partial<SongMetaRowElement>,
    { at: path },
  );
};

/**
 * Змістовний рядок секції. Виняток — старий вузол-якір коментаря: у вже
 * мігрованих документах його немає, але поки прод дожовує старі пісні, він
 * може трапитись, і заголовком секції він не є.
 */
const isContentRow = (node: Descendant | undefined): node is Element =>
  !!node &&
  Element.isElement(node) &&
  (node as Element).type !== "comment-anchor";

/**
 * Правило показу (див. `model.ts`) для рядка `index` у дітях секції.
 * Чиста функція — уся логіка крайових випадків тестується тут.
 */
export const isRowHiddenAt = (
  rows: Descendant[],
  index: number,
  { chordsHidden, lyricsHidden }: DisplayState,
): boolean => {
  if (!chordsHidden && !lyricsHidden) return false;

  const row = rows[index];
  if (!isContentRow(row)) return false;

  const firstIdx = rows.findIndex(isContentRow);
  if (index === firstIdx) return false; // заголовок секції — завжди видимий

  if (row.type === "chord-line") return chordsHidden;
  if (row.type === "line") return lyricsHidden;
  return false;
};

