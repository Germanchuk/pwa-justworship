import { describe, expect, it } from "vitest";
import type { Descendant } from "slate";

import { isRowHiddenAt } from "./operations";
import type { DisplayState } from "./model";

const C1 = "c1";

const mark = (commentId = C1) => ({
  commentId,
  visibleFor: ["me"],
  color: "#fef08a",
});

/** Рядок слів; `marked` — частина тексту, позначена коментарем C1. */
const line = (text = "слова", marked?: string): Descendant =>
  ({
    type: "line",
    children: marked
      ? [{ text }, { text: marked, comment: [mark()] }]
      : [{ text }],
  }) as Descendant;

const chords = (text = "| C | G |", marked?: string): Descendant =>
  ({
    type: "chord-line",
    children: marked
      ? [{ text }, { text: marked, comment: [mark()] }]
      : [{ text }],
  }) as Descendant;

const anchor = (): Descendant =>
  ({
    type: "comment-anchor",
    commentId: C1,
    visibleFor: ["me"],
    color: "#fef08a",
    body: "",
    children: [{ text: "" }],
  }) as Descendant;

const ALL_VISIBLE: DisplayState = { chordsHidden: false, lyricsHidden: false };
const NO_LYRICS: DisplayState = { chordsHidden: false, lyricsHidden: true };
const NO_CHORDS: DisplayState = { chordsHidden: true, lyricsHidden: false };
const ONLY_HEADINGS: DisplayState = { chordsHidden: true, lyricsHidden: true };

/** Індекси рядків, які лишаються видимими. */
const visible = (rows: Descendant[], state: DisplayState) =>
  rows.map((_, i) => i).filter((i) => !isRowHiddenAt(rows, i, state));

describe("isRowHiddenAt", () => {
  it("без фільтрів не ховає нічого", () => {
    const rows = [line("Куплет 1"), chords(), line()];
    expect(visible(rows, ALL_VISIBLE)).toEqual([0, 1, 2]);
  });

  it("приховати слова: лишає заголовок і акорди", () => {
    const rows = [line("Куплет 1"), chords(), line(), chords(), line()];
    expect(visible(rows, NO_LYRICS)).toEqual([0, 1, 3]);
  });

  it("приховати акорди: лишає заголовок і слова", () => {
    const rows = [line("Куплет 1"), chords(), line(), chords(), line()];
    expect(visible(rows, NO_CHORDS)).toEqual([0, 2, 4]);
  });

  it("обидва фільтри лишають рівно заголовок секції", () => {
    const rows = [line("Куплет 1"), chords(), line(), chords(), line()];
    expect(visible(rows, ONLY_HEADINGS)).toEqual([0]);
  });

  it("заголовок-акорд лишається видимим навіть з прихованими акордами", () => {
    const rows = [chords("| Am | F |"), line(), chords()];
    expect(visible(rows, NO_CHORDS)).toEqual([0, 1]);
    expect(visible(rows, ONLY_HEADINGS)).toEqual([0]);
  });

  it("якорі коментарів не рахуються заголовком і самі не ховаються тут", () => {
    //      0: якір  1: заголовок  2: якір  3: слова
    const rows = [anchor(), line("Куплет 1"), anchor(), line()];
    expect(visible(rows, NO_LYRICS)).toEqual([0, 1, 2]);
  });
});

// Показ карток приміток тепер випливає з правила розкладки —
// див. `comments/noteHeads.test.ts`.
