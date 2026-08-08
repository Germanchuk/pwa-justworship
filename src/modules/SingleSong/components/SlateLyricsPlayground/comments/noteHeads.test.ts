import { describe, expect, it } from "vitest";
import type { Descendant } from "slate";

import type { DisplayState } from "../display/model";
import { collectNoteHeads, rowKey } from "./noteHeads";

const C1 = "c1";
const C2 = "c2";

const mark = (commentId = C1) => ({
  commentId,
  visibleFor: ["me"],
  color: "#fef08a",
});

/** Рядок слів; `marked` — частина тексту, позначена коментарем. */
const line = (text = "слова", marked?: string, commentId = C1): Descendant =>
  ({
    type: "line",
    children: marked
      ? [{ text }, { text: marked, comment: [mark(commentId)] }]
      : [{ text }],
  }) as Descendant;

const chords = (
  text = "| C | G |",
  marked?: string,
  commentId = C1,
): Descendant =>
  ({
    type: "chord-line",
    children: marked
      ? [{ text }, { text: marked, comment: [mark(commentId)] }]
      : [{ text }],
  }) as Descendant;

const section = (...rows: Descendant[]): Descendant =>
  ({ type: "section", children: rows }) as Descendant;

/** Документ завжди починається з хедера — секції йдуть з індексу 2. */
const doc = (...sections: Descendant[]): Descendant[] => [
  { type: "song-name", children: [{ text: "" }] } as Descendant,
  { type: "song-meta-row", children: [] } as unknown as Descendant,
  ...sections,
];

const ALL_VISIBLE: DisplayState = { chordsHidden: false, lyricsHidden: false };
const NO_LYRICS: DisplayState = { chordsHidden: false, lyricsHidden: true };
const NO_CHORDS: DisplayState = { chordsHidden: true, lyricsHidden: false };
const ONLY_HEADINGS: DisplayState = { chordsHidden: true, lyricsHidden: true };

const headOf = (nodes: Descendant[], state: DisplayState, id = C1) => {
  for (const [key, ids] of collectNoteHeads(nodes, state)) {
    if (ids.includes(id)) return key;
  }
  return null;
};

describe("collectNoteHeads", () => {
  it("ставить картку над першим рядком із міткою", () => {
    const nodes = doc(section(line("Куплет 1"), line("рядок", "текст")));
    expect(headOf(nodes, ALL_VISIBLE)).toBe(rowKey(2, 1));
  });

  it("виділення через кілька рядків дає одну картку — на першому", () => {
    const nodes = doc(
      section(line("Куплет 1"), chords("| C |", " G"), line("рядок", "текст")),
    );
    const heads = collectNoteHeads(nodes, ALL_VISIBLE);
    expect(heads.get(rowKey(2, 1))).toEqual([C1]);
    expect(heads.get(rowKey(2, 2))).toBeUndefined();
  });

  it("кілька приміток на одному рядку — у порядку появи", () => {
    const nodes = doc(
      section(line("Куплет 1"), {
        type: "line",
        children: [
          { text: "а", comment: [mark(C2)] },
          { text: "б", comment: [mark(C1)] },
        ],
      } as Descendant),
    );
    expect(collectNoteHeads(nodes, ALL_VISIBLE).get(rowKey(2, 1))).toEqual([
      C2,
      C1,
    ]);
  });

  it("порожній позначений leaf не тримає картку", () => {
    const nodes = doc(section(line("Куплет 1"), line("рядок", "")));
    expect(headOf(nodes, ALL_VISIBLE)).toBeNull();
  });

  it("без мітки в документі картки немає", () => {
    const nodes = doc(section(line("Куплет 1"), line()));
    expect(headOf(nodes, ALL_VISIBLE)).toBeNull();
  });
});

// NOTE-13: картка жива, доки видно хоч один символ її тексту-якоря. Схований
// рядок головою бути не може, тож картка сама переїжджає на видимий.
describe("collectNoteHeads + фільтри показу", () => {
  it("ховає картку, коли єдиний позначений рядок прихований", () => {
    const nodes = doc(section(line("Куплет 1"), line("рядок", "текст")));
    expect(headOf(nodes, NO_LYRICS)).toBeNull();
  });

  it("переносить картку на видимий рядок виділення", () => {
    const nodes = doc(
      section(line("Куплет 1"), chords("| C |", " G"), line("рядок", "текст")),
    );
    // слова сховані → голова переїжджає на акордовий рядок
    expect(headOf(nodes, NO_LYRICS)).toBe(rowKey(2, 1));
    // акорди сховані → голова на рядку слів
    expect(headOf(nodes, NO_CHORDS)).toBe(rowKey(2, 2));
    // сховано все, крім заголовка → показувати нема де
    expect(headOf(nodes, ONLY_HEADINGS)).toBeNull();
  });

  it("позначений заголовок секції тримає картку видимою завжди", () => {
    const nodes = doc(section(line("Куплет 1", " (тихо)"), line()));
    expect(headOf(nodes, ONLY_HEADINGS)).toBe(rowKey(2, 0));
  });

  it("бачить позначений текст у сусідній секції", () => {
    const nodes = doc(
      section(line("Куплет 1"), line("рядок", "текст")),
      section(chords("| Am |", " F"), line()),
    );
    // слова сховані, але шматок виділення лежить у заголовку 2-ї секції
    expect(headOf(nodes, NO_LYRICS)).toBe(rowKey(3, 0));
  });
});
