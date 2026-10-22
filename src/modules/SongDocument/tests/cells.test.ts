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
  upgradeGrid,
  writeMeta,
} from "../model";

/** `n` прочерків — порожні кроки. */
const d = (n: number) => "-".repeat(n);
/** Рядок табу: струна, потім такт — `[крок, лад]…` на 16 кроках (з 0). */
const tabLine = (name: string, ...frets: [number, string][]) => {
  let out = "";
  for (let s = 0; s < 16; s++) out += frets.find(([at]) => at === s)?.[1] ?? "-";
  return `${name}|${out}|`;
};

const slotOf = (song: Song, ln: number, id: string) => linesOf(song)[ln].get(id) as Y.Map<unknown>;
const text = (song: Song, ln: number, id: string, kind: CellKind, steps = 16) => {
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
        at = typeCell(kind, slotOf(net.A, ln, id), 16, at, ch, prev);
        prev = ch;
      }),
    );
    return at;
  };
  return { net, id, type };
}

describe("сітка", () => {
  it("крок — шістнадцята: 4/4 → 16, 3/4 → 12, 6/8 → 12, 12/8 → 24", () => {
    expect(["4/4", "3/4", "6/8", "12/8", "2/2"].map(stepsPerBar)).toEqual([16, 12, 12, 24, 16]);
  });

  it("за замовчуванням один такт; додати — скільки завгодно; прибрати можна лише порожній останній", () => {
    const { net, id, type } = withLane("cajon");
    expect(text(net.B, 0, id, "cajon")).toEqual([`|${d(16)}|`]);
    change(net.A, () => addBar(slotOf(net.A, 0, id)));
    change(net.A, () => addBar(slotOf(net.A, 0, id)));
    type("B", 0, { step: 32, string: 0 });
    expect(text(net.B, 0, id, "cajon")).toEqual([`|${d(16)}|${d(16)}|B${d(15)}|`]);
    change(net.A, () => removeBar(slotOf(net.A, 0, id)));
    expect(barsOf(slotOf(net.B, 0, id))).toBe(3);
  });

  it("клітинки, записані вісімками (слот без `grid`), перераховуються: крок вісімки — перша з її шістнадцятих", () => {
    const { net, id } = withLane("tab");
    change(net.A, () => {
      const slot = slotOf(net.A, 0, id);
      slot.delete("grid");
      const cells = slot.get("cells") as Y.Map<string>;
      cells.set("1.1/6", "3");
      cells.set("1.4/2", "12");
      cells.set("2.8/1", "x");
    });
    change(net.A, () => upgradeGrid(slotOf(net.A, 0, id), "tab"));
    expect((slotOf(net.B, 0, id).get("cells") as Y.Map<string>).toJSON()).toEqual({ "1.1/6": "3", "1.7/2": "12", "2.15/1": "x" });
    expect(slotOf(net.B, 0, id).get("grid")).toBe(16);
  });

  it("тридцять другі → шістнадцяті: на один крок припало два — лишається перший", () => {
    const { net, id } = withLane("tab");
    change(net.A, () => {
      const slot = slotOf(net.A, 0, id);
      slot.set("grid", 32);
      const cells = slot.get("cells") as Y.Map<string>;
      cells.set("1.1/1", "3");
      cells.set("1.2/1", "5");
      cells.set("1.3/1", "7");
    });
    change(net.A, () => upgradeGrid(slotOf(net.A, 0, id), "tab"));
    expect((slotOf(net.B, 0, id).get("cells") as Y.Map<string>).toJSON()).toEqual({ "1.1/1": "3", "1.2/1": "7" });
  });

  it("прямокутник старої сітки тягнеться на всі свої кроки", () => {
    const { net, id } = withLane("blocks");
    change(net.A, () => {
      const slot = slotOf(net.A, 0, id);
      slot.delete("grid");
      const cells = slot.get("cells") as Y.Map<string>;
      ["Am", "-", "-", "-", "F", "-", "G"].forEach((v, i) => cells.set(`1.${i + 1}`, v)); // |Am------F---G...|
    });
    change(net.A, () => upgradeGrid(slotOf(net.A, 0, id), "blocks"));
    expect(text(net.B, 0, id, "blocks")).toEqual([`|Am${d(6)}F${d(3)}G-..|`]);
  });
});

describe("кахон", () => {
  it("B / T / g / - — по кроку на символ", () => {
    const { net, id, type } = withLane("cajon");
    type("B-T-BgT-");
    expect(text(net.B, 0, id, "cajon")).toEqual([`|B-T-BgT-${d(8)}|`]);
  });
});

describe("таби", () => {
  it("навігація ручна: друк лишає курсор на місці, цифри поспіль — один лад; x — заглушена; «-» стирає", () => {
    const { net, id, type } = withLane("tab");
    expect(type("3", 0, { step: 0, string: 5 })).toEqual({ step: 0, string: 5 }); // E, 3-й лад
    type("12", 0, { step: 2, string: 1 });
    type("x", 0, { step: 4, string: 0 });
    type("7-", 0, { step: 6, string: 2 });
    // Крок 2 завширшки два символи (лад 12) — на всіх струнах; «7-» на G: «-» стер сімку.
    expect(text(net.B, 0, id, "tab")).toEqual([
      `e|-----x${d(11)}|`,
      `B|--12--${d(11)}|`,
      `G|${d(17)}|`,
      `D|${d(17)}|`,
      `A|${d(17)}|`,
      `E|3${d(16)}|`,
    ]);
  });

  it("порожній крок — один прочерк; крок із двозначним ладом — два символи на всіх струнах", () => {
    const { net, id, type } = withLane("tab");
    type("12", 0, { step: 2, string: 1 });
    const [e, B] = text(net.B, 0, id, "tab");
    expect(B).toBe(`B|--12${d(13)}|`);
    expect(e).toBe(`e|----${d(13)}|`);
    expect(B.length).toBe(2 + 17 + 1);
  });

  it("лад понад 24 не складається: наступна цифра починає новий; Backspace скорочує лад на цифру", () => {
    const { net, id, type } = withLane("tab");
    type("125", 0, { step: 0, string: 0 });
    const cells = () => (slotOf(net.B, 0, id).get("cells") as Y.Map<string>).toJSON();
    expect(cells()).toEqual({ "1.1/1": "5" });
    type("21", 0, { step: 0, string: 0 });
    change(net.A, () => eraseCell("tab", slotOf(net.A, 0, id), 16, { step: 0, string: 0 }, true));
    expect(cells()).toEqual({ "1.1/1": "2" });
  });

  it("текст табів ↔ клітинки — туди й назад той самий; табулатура з сайту з іншою шириною теж лягає", () => {
    const lines = [tabLine("e"), tabLine("B", [6, "1"]), tabLine("G", [4, "0"]), tabLine("D", [2, "2"]), tabLine("A", [0, "3"]), tabLine("E")];
    const parsed = parseCells("tab", lines, 16)!;
    expect(parsed.cells).toEqual({ "1.7/2": "1", "1.5/3": "0", "1.3/4": "2", "1.1/5": "3" });
    expect(renderCells("tab", (k) => parsed.cells[k], parsed.bars, 16)).toEqual(lines);
    const site = ["e|--------|", "B|---1----|", "G|--0-----|", "D|-2------|", "A|3-------|", "E|--------|"];
    expect(parseCells("tab", site, 16)!.cells).toEqual(parsed.cells);
  });

  it("двозначний лад у тексті займає одну колонку — решта кроків не зсуваються", () => {
    const { net, id, type } = withLane("tab");
    type("12", 0, { step: 2, string: 1 });
    type("3", 0, { step: 15, string: 5 });
    const shown = text(net.B, 0, id, "tab");
    const parsed = parseCells("tab", shown, 16)!;
    expect(parsed.cells).toEqual({ "1.3/2": "12", "1.16/6": "3" });
  });
});

describe("прямокутники", () => {
  it("назва відкриває прямокутник, «-» тягне, «.» — порожньо; текст ↔ клітинки", () => {
    const { net, id, type } = withLane("blocks");
    type("Am------");
    change(net.A, () => addBar(slotOf(net.A, 0, id)));
    type("F---G...", 0, { step: 16, string: 0 });
    const shown = [`|Am------${".".repeat(8)}|F---G${".".repeat(11)}|`];
    expect(text(net.B, 0, id, "blocks")).toEqual(shown);
    const parsed = parseCells("blocks", shown, 16)!;
    expect(renderCells("blocks", (k) => parsed.cells[k], parsed.bars, 16)).toEqual(shown);
  });

  it("Backspace: стирає крок, а на порожньому — попередній", () => {
    const { net, id, type } = withLane("blocks");
    const at = type("C---");
    change(net.A, () => eraseCell("blocks", slotOf(net.A, 0, id), 16, at, true));
    expect(text(net.B, 0, id, "blocks")).toEqual([`|C--${".".repeat(13)}|`]);
  });
});

describe("склеювання рядків", () => {
  it("клітинки другого рядка дописуються після тактів першого", () => {
    const { net, id, type } = withLane("cajon");
    type("B-T-B-T-", 0);
    type("BBT-BBT-", 1);
    change(net.A, () => mergeLine(net.A, 1));
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти святийГосподь"]);
    expect(text(net.B, 0, id, "cajon")).toEqual([`|B-T-B-T-${d(8)}|BBT-BBT-${d(8)}|`]);
  });
});

describe("вставка розпізнає доріжки і збирає їх у рядок", () => {
  const TAB = [tabLine("e"), tabLine("B", [6, "1"]), tabLine("G", [4, "0"]), tabLine("D", [2, "2"]), tabLine("A", [0, "3"]), tabLine("E")];
  const CAJON = `|B-T-B-T-${d(8)}|`;

  it("таби, кахон, акорди й слова → один рядок пісні; наступні таби — новий рядок", () => {
    const { net, id: tab } = withLane("tab", [{ words: "" }]);
    let cajon = "";
    change(net.A, () => (cajon = addLane(net.A, "cajon", linesOf(net.A))));
    const pasted = [...TAB, CAJON, "C       G", "Ти святий", ...TAB, "Господь"].join("\n");
    change(net.A, () => insertPlainText(net.A, { line: 0, lane: "words", offset: 0 }, pasted));
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти святий", "Господь"]);
    expect(text(net.B, 0, tab, "tab")).toEqual(TAB);
    expect(text(net.B, 0, cajon, "cajon")).toEqual([CAJON]);
    expect(text(net.B, 1, tab, "tab")).toEqual(TAB);
    expect(text(net.B, 1, cajon, "cajon")).toEqual([`|${d(16)}|`]);
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

  it("розмір 6/8 — 12 кроків у такті", () => {
    const { net, id } = withLane("cajon", [{ words: "" }]);
    change(net.A, () => writeMeta(net.A.doc, { timeSignature: "6/8" }));
    const bar = `|B--T--${d(6)}|`;
    change(net.A, () => insertPlainText(net.A, { line: 0, lane: "words", offset: 0 }, `${bar}\nТи`));
    expect(text(net.B, 0, id, "cajon", 12)).toEqual([bar]);
  });
});
