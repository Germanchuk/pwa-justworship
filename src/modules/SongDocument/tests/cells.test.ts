/** Клітинкові доріжки (ADR-0008): сітка, текст ↔ клітинки, друк за синтаксисом, такти, склеювання, вставка. */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { change, makePair } from "./harness";
import {
  addBar,
  addLane,
  barsOf,
  CellAt,
  CellKind,
  eraseCell,
  insertPlainText,
  layout,
  linesOf,
  mergeLine,
  parseCells,
  removeBar,
  renderCells,
  Song,
  stepsPerBar,
  typeCell,
  writeMeta,
} from "../model";

const slotOf = (song: Song, ln: number, id: string) => linesOf(song)[ln].get(id) as Y.Map<unknown>;
const text = (song: Song, ln: number, id: string, kind: CellKind, steps = 8) => {
  const slot = slotOf(song, ln, id);
  const cells = slot.get("cells") as Y.Map<string>;
  return renderCells(kind, (k) => cells.get(k), barsOf(slot), steps);
};
/** Пісня з однією доріжкою виду `kind`; `type` друкує рядок символів із кроку 0. */
function withLane(kind: CellKind, seed = [{ words: "Ти святий" }, { words: "Господь" }]) {
  const net = makePair(seed);
  let id = "";
  change(net.A, () => (id = addLane(net.A, kind, linesOf(net.A))));
  const type = (chars: string, ln = 0, from: CellAt = { step: 0, string: 0 }) => {
    let at = from;
    let prev: string | null = null;
    change(net.A, () =>
      [...chars].forEach((ch) => {
        at = typeCell(kind, slotOf(net.A, ln, id), 8, at, ch, prev);
        prev = ch;
      }),
    );
    return at;
  };
  return { net, id, type };
}

describe("сітка", () => {
  it("крок — вісімка: 4/4 → 8, 3/4 → 6, 6/8 → 6, 12/8 → 12", () => {
    expect(["4/4", "3/4", "6/8", "12/8", "2/2"].map(stepsPerBar)).toEqual([8, 6, 6, 12, 8]);
  });

  it("за замовчуванням один такт; додати — скільки завгодно; прибрати можна лише порожній останній", () => {
    const { net, id, type } = withLane("cajon");
    expect(text(net.B, 0, id, "cajon")).toEqual(["|--------|"]);
    change(net.A, () => addBar(slotOf(net.A, 0, id)));
    change(net.A, () => addBar(slotOf(net.A, 0, id)));
    type("B", 0, { step: 16, string: 0 });
    expect(text(net.B, 0, id, "cajon")).toEqual(["|--------|--------|B-------|"]);
    change(net.A, () => removeBar(slotOf(net.A, 0, id)));
    expect(barsOf(slotOf(net.B, 0, id))).toBe(3);
  });
});

describe("кахон", () => {
  it("B / T / g / - — по кроку на символ", () => {
    const { net, id, type } = withLane("cajon");
    type("B-T-BgT-");
    expect(text(net.B, 0, id, "cajon")).toEqual(["|B-T-BgT-|"]);
  });
});

describe("таби", () => {
  it("лад — у крок, двозначний лад — двома цифрами поспіль; «-» — далі; x — заглушена", () => {
    const { net, id, type } = withLane("tab");
    let at = type("3-", 0, { step: 0, string: 5 }); // E, 3-й лад
    at = type("12-", 0, { ...at, string: 1 });
    type("x", 0, { ...at, string: 0 });
    expect(text(net.B, 0, id, "tab")).toEqual([
      "e|----x-----------|",
      "B|--12------------|",
      "G|----------------|",
      "D|----------------|",
      "A|----------------|",
      "E|3---------------|",
    ]);
  });

  it("текст табів ↔ клітинки — туди й назад той самий; табулатура з сайту з іншою шириною теж лягає", () => {
    const lines = ["e|--------|", "B|---1----|", "G|--0-----|", "D|-2------|", "A|3-------|", "E|--------|"];
    const parsed = parseCells("tab", lines, 8)!;
    expect(renderCells("tab", (k) => parsed.cells[k], parsed.bars, 8)).toEqual(lines);
    const wide = ["e|----------------|", "B|------1---------|", "G|----0-----------|", "D|--2-------------|", "A|3---------------|", "E|----------------|"];
    expect(parseCells("tab", wide, 8)!.cells).toEqual(parsed.cells);
  });
});

describe("прямокутники", () => {
  it("назва відкриває прямокутник, «-» тягне, «.» — порожньо; текст ↔ клітинки", () => {
    const { net, id, type } = withLane("blocks");
    type("Am------");
    change(net.A, () => addBar(slotOf(net.A, 0, id)));
    type("F---G...", 0, { step: 8, string: 0 });
    expect(text(net.B, 0, id, "blocks")).toEqual(["|Am------|F---G...|"]);
    const parsed = parseCells("blocks", ["|Am------|F---G...|"], 8)!;
    expect(renderCells("blocks", (k) => parsed.cells[k], parsed.bars, 8)).toEqual(["|Am------|F---G...|"]);
  });

  it("Backspace: стирає крок, а на порожньому — попередній", () => {
    const { net, id, type } = withLane("blocks");
    const at = type("C---");
    change(net.A, () => eraseCell("blocks", slotOf(net.A, 0, id), 8, at, true));
    expect(text(net.B, 0, id, "blocks")).toEqual(["|C--.....|"]);
  });
});

describe("склеювання рядків", () => {
  it("клітинки другого рядка дописуються після тактів першого", () => {
    const { net, id, type } = withLane("cajon");
    type("B-T-B-T-", 0);
    type("BBT-BBT-", 1);
    change(net.A, () => mergeLine(net.A, 1));
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти святийГосподь"]);
    expect(text(net.B, 0, id, "cajon")).toEqual(["|B-T-B-T-|BBT-BBT-|"]);
  });
});

describe("вставка розпізнає доріжки і збирає їх у рядок", () => {
  const TAB = ["e|--------|", "B|---1----|", "G|--0-----|", "D|-2------|", "A|3-------|", "E|--------|"];

  it("таби, кахон, акорди й слова → один рядок пісні; наступні таби — новий рядок", () => {
    const { net, id: tab } = withLane("tab", [{ words: "" }]);
    let cajon = "";
    change(net.A, () => (cajon = addLane(net.A, "cajon", linesOf(net.A))));
    const pasted = [...TAB, "|B-T-B-T-|", "C       G", "Ти святий", ...TAB, "Господь"].join("\n");
    change(net.A, () => insertPlainText(net.A, { line: 0, lane: "words", offset: 0 }, pasted));
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти святий", "Господь"]);
    expect(text(net.B, 0, tab, "tab")).toEqual(TAB);
    expect(text(net.B, 0, cajon, "cajon")).toEqual(["|B-T-B-T-|"]);
    expect(text(net.B, 1, tab, "tab")).toEqual(TAB);
    expect(text(net.B, 1, cajon, "cajon")).toEqual(["|--------|"]);
  });

  it("дві доріжки табів — перші таби групи в першу, другі — в другу", () => {
    const { net, id: t1 } = withLane("tab", [{ words: "" }]);
    let t2 = "";
    change(net.A, () => (t2 = addLane(net.A, "tab", linesOf(net.A))));
    const solo = TAB.map((l) => l.replace("1", "5"));
    change(net.A, () => insertPlainText(net.A, { line: 0, lane: "words", offset: 0 }, [...TAB, ...solo, "Алилуя"].join("\n")));
    expect(layout(net.B).map((l) => l.words)).toEqual(["Алилуя"]);
    expect(text(net.B, 0, t1, "tab")).toEqual(TAB);
    expect(text(net.B, 0, t2, "tab")).toEqual(solo);
  });

  it("таби, для яких у пісні немає доріжки, лишаються словами", () => {
    const net = makePair([{ words: "" }]);
    change(net.A, () => insertPlainText(net.A, { line: 0, lane: "words", offset: 0 }, TAB.slice(0, 2).join("\n")));
    expect(layout(net.B).map((l) => l.words)).toEqual(TAB.slice(0, 2));
  });

  it("розмір 6/8 — шість кроків у такті", () => {
    const { net, id } = withLane("cajon", [{ words: "" }]);
    change(net.A, () => writeMeta(net.A.doc, { timeSignature: "6/8" }));
    change(net.A, () => insertPlainText(net.A, { line: 0, lane: "words", offset: 0 }, "|B--T--|\nТи"));
    expect(text(net.B, 0, id, "cajon", 6)).toEqual(["|B--T--|"]);
  });
});
