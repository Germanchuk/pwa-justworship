import { describe, expect, it } from "vitest";
import type { Descendant } from "slate";

import { songRows } from "./rows";

const line = (text = "слова"): Descendant =>
  ({ type: "line", children: [{ text }] }) as Descendant;

const chords = (text = "| C | G |"): Descendant =>
  ({ type: "chord-line", children: [{ text }] }) as Descendant;

const anchor = (): Descendant =>
  ({
    type: "comment-anchor",
    commentId: "c1",
    visibleFor: ["all"],
    color: "#fef08a",
    body: "",
    children: [{ text: "" }],
  }) as Descendant;

const empty = (): Descendant =>
  ({ type: "empty-line", children: [{ text: "" }] }) as Descendant;

const section = (
  rows: Descendant[],
  attrs: Record<string, unknown> = {},
): Descendant => ({ type: "section", ...attrs, children: rows }) as Descendant;

/** Документ завжди починається з хедера — секції йдуть з індексу 2. */
const doc = (...body: Descendant[]): Descendant[] => [
  { type: "song-name", children: [{ text: "Пісня" }] } as Descendant,
  { type: "song-meta-row", children: [] } as unknown as Descendant,
  ...body,
];

describe("songRows — з чого складається пісня для автоскролу", () => {
  it.each([
    {
      name: "заголовок секції — окремий рядок",
      doc: doc(section([line("Куплет 1")])),
      rows: [[[2, 0]]],
    },
    {
      name: "акорди над словами — один рядок",
      doc: doc(section([line("Куплет"), chords(), line()])),
      rows: [[[2, 0]], [[2, 1], [2, 2]]],
    },
    {
      name: "акорди без слів під ними — рядок сам по собі",
      doc: doc(section([line("Програш"), chords(), chords()])),
      rows: [[[2, 0]], [[2, 1]], [[2, 2]]],
    },
    {
      name: "слова без акордів — рядок сам по собі",
      doc: doc(section([line("Приспів"), line("раз"), line("два")])),
      rows: [[[2, 0]], [[2, 1]], [[2, 2]]],
    },
    {
      name: "слова над акордами не злипаються — пара лише «акорди, потім слова»",
      doc: doc(section([line("Куплет"), line(), chords()])),
      rows: [[[2, 0]], [[2, 1]], [[2, 2]]],
    },
    {
      name: "секція без підпису: перші акорди над словами — теж один рядок",
      doc: doc(section([chords("| Am | F |"), line(), chords(), line()])),
      rows: [[[2, 0], [2, 1]], [[2, 2], [2, 3]]],
    },
    {
      name: "порожні рядки між секціями — не рядки",
      doc: doc(
        section([line("Куплет")]),
        empty(),
        empty(),
        section([line("Приспів")]),
      ),
      rows: [[[2, 0]], [[5, 0]]],
    },
    {
      name: "старий вузол-якір примітки — не рядок і не розриває пару",
      doc: doc(section([anchor(), line("Куплет"), chords(), anchor(), line()])),
      rows: [[[2, 1]], [[2, 2], [2, 4]]],
    },
    {
      name: "рядок із самих пробілів — рядок: на екрані він є, і заголовком буває",
      doc: doc(section([line("   "), line()])),
      rows: [[[2, 0]], [[2, 1]]],
    },
    {
      name: "пісня без секцій — нуль рядків",
      doc: doc(empty()),
      rows: [],
    },
  ])("$name", ({ doc, rows }) => {
    expect(songRows(doc)).toEqual(rows);
  });

  it("фільтри показу й згортання не міняють нумерацію (`SCROLL-16`)", () => {
    const plain = doc(
      section([line("Куплет"), chords(), line(), chords(), line()]),
      section([line("Приспів"), chords(), line()]),
    );
    const personal = doc(
      section([line("Куплет"), chords(), line(), chords(), line()], {
        collapsedFor: ["me"],
      }),
      section([line("Приспів"), chords(), line()]),
    );
    (personal[1] as unknown as Record<string, unknown>).chordsHiddenFor = ["me"];
    (personal[1] as unknown as Record<string, unknown>).lyricsHiddenFor = ["me"];

    expect(songRows(personal)).toEqual(songRows(plain));
    expect(songRows(plain)).toHaveLength(5);
  });

  it("повтори секції (`x2`) нічого не додають (ADR-0005)", () => {
    const once = doc(section([line("Приспів"), chords(), line()]));
    const twice = doc(section([line("Приспів"), chords(), line()], { repeat: 2 }));
    expect(songRows(twice)).toEqual(songRows(once));
  });
});
