/**
 * Швидкодія мідлвера на великій пісні: розкладка рядків (`layout`) щоразу
 * проходить весь текст, тож ціна дії росте з довжиною пісні. Межі в `expect`
 * свідомо щедрі — тест ловить зростання на порядки, а не мілісекунди.
 */
import { describe, expect, it } from "vitest";
import { Editor, Transforms } from "slate";
import { LineInit } from "../model";
import { setup, WORDS } from "./testKit";

const LINES = Number(process.env.PERF_LINES ?? 300);
const SONG: LineInit[] = Array.from({ length: LINES }, (_, i) =>
  i % 5 === 0 ? { words: `/Частина ${i / 5}` } : { words: "Ти святий, Господь, Твоє світло серед ночі", chords: "Am      F       C       G" },
);

const perOp = (n: number, run: (i: number) => void) => {
  const t = performance.now();
  for (let i = 0; i < n; i++) run(i);
  return (performance.now() - t) / n;
};

describe(`швидкодія: пісня на ${LINES} рядків`, () => {
  it("друк, Enter і чужий друк — мілісекунди на дію", () => {
    const { A, B } = setup(SONG, WORDS, WORDS);
    // У «лише слова» в кожному рядку одна доріжка — курсор у кінець слів рядка.
    const caret = (h: typeof A, ln: number) => Transforms.select(h.view, Editor.end(h.view, [ln % h.view.children.length, 0]));
    const typing = perOp(500, (i) => {
      caret(A, i * 7);
      Editor.insertText(A.view, "а");
    });
    const enters = perOp(50, (i) => {
      caret(A, i * 11);
      Editor.insertBreak(A.view);
    });
    const remote = perOp(500, (i) => {
      caret(B, i * 13);
      Editor.insertText(B.view, "б");
    });
    console.log(
      `${LINES} рядків, ${A.view.children.length} у видимому: друк ${typing.toFixed(3)} мс, Enter ${enters.toFixed(3)} мс, ` +
        `друк іншого (обидва дерева) ${remote.toFixed(3)} мс`,
    );
    expect(typing).toBeLessThan(20);
    expect(enters).toBeLessThan(50);
    expect(remote).toBeLessThan(20);
  });
});
