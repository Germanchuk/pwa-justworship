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
  readZoom,
  renderCells,
  scaleOf,
  Song,
  stepsPerBar,
  stepsPerBeat,
  typeCell,
  upgradeCajon,
  upgradeGrid,
  placeCells,
  writeMeta,
  writeZoom,
} from "../model";

/** Масштаб виду в `4/4`: за замовчуванням 1/16. */
const sc = (kind: CellKind, zoom = 16, ts = "4/4") => scaleOf(kind, ts, zoom);

/** `n` прочерків — порожні кроки. */
const d = (n: number) => "-".repeat(n);
/** Рядок табу: струна, потім такт — `[крок, лад]…` на 16 кроках (з 0). */
const tabLine = (name: string, ...frets: [number, string][]) => {
  let out = "";
  for (let s = 0; s < 16; s++) out += frets.find(([at]) => at === s)?.[1] ?? "-";
  return `${name}|${out}|`;
};

/** Кахон текстом: `bars` тактів; удари — кроки від початку рядка (з 0) на лініях B, T, g. */
const cajon = (bars: number, hits: { B?: number[]; T?: number[]; g?: number[] } = {}, steps = 16) =>
  (["B", "T", "g"] as const).map(
    (row) =>
      `${row}|${Array.from({ length: bars }, (_, b) => Array.from({ length: steps }, (_, s) => (hits[row]?.includes(b * steps + s) ? "o" : "-")).join("")).join("|")}|`,
  );
const slotOf = (song: Song, ln: number, id: string) => linesOf(song)[ln].get(id) as Y.Map<unknown>;
const text = (song: Song, ln: number, id: string, kind: CellKind, scale = sc(kind)) => {
  const slot = slotOf(song, ln, id);
  const cells = slot.get("cells") as Y.Map<string>;
  return renderCells(kind, cells.entries(), barsOf(slot), scale);
};
const cellsJSON = (song: Song, ln: number, id: string) => (slotOf(song, ln, id).get("cells") as Y.Map<string>).toJSON();
/** Пісня з однією доріжкою виду `kind`; `type` друкує рядок символів із кроку 0. */
function withLane(kind: CellKind, seed = [{ words: "Ти святий" }, { words: "Господь" }]) {
  const net = makePair(seed);
  let id = "";
  change(net.A, () => (id = addLane(net.A, kind, linesOf(net.A))));
  const type = (chars: string, ln = 0, from: CellAt = { step: 0, string: 0 }, zoom = 16) => {
    let at = from;
    let prev: string | null = null;
    change(net.A, () =>
      [...chars].forEach((ch) => {
        at = typeCell(kind, slotOf(net.A, ln, id), sc(kind, zoom), at, ch, prev);
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

  it("доля для смуг: одиниця знаменника, у 6/8, 9/8, 12/8 — три вісімки", () => {
    expect(["4/4", "3/4", "2/2", "6/8", "12/8", "7/8"].map(stepsPerBeat)).toEqual([4, 4, 8, 6, 6, 2]);
  });

  it("за замовчуванням один такт; додати — скільки завгодно; прибрати можна лише порожній останній", () => {
    const { net, id, type } = withLane("cajon");
    expect(text(net.B, 0, id, "cajon")).toEqual(cajon(1));
    change(net.A, () => addBar(slotOf(net.A, 0, id)));
    change(net.A, () => addBar(slotOf(net.A, 0, id)));
    type("B", 0, { step: 32, string: 0 });
    expect(text(net.B, 0, id, "cajon")).toEqual(cajon(3, { B: [32] }));
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
    expect((slotOf(net.B, 0, id).get("cells") as Y.Map<string>).toJSON()).toEqual({ "1.1/6": "3", "1.145/2": "12", "2.337/1": "x" });
    expect(slotOf(net.B, 0, id).get("grid")).toBe(384);
  });

  it("тридцять другі → тіки: без втрат, кожна на свій тік; 1/128 — точно", () => {
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
    expect((slotOf(net.B, 0, id).get("cells") as Y.Map<string>).toJSON()).toEqual({ "1.1/1": "3", "1.13/1": "5", "1.25/1": "7" });
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
  it("кожен удар на своїй лінії; B / T / g — на свою лінію, o — на лінію курсора, «-» стирає; курсор стоїть", () => {
    const { net, id, type } = withLane("cajon");
    expect(type("B", 0, { step: 0, string: 0 })).toEqual({ step: 0, string: 0 });
    type("Tg", 0, { step: 4, string: 0 }); // два удари разом
    type("o", 0, { step: 8, string: 2 });
    type("o-", 0, { step: 12, string: 1 });
    expect(text(net.B, 0, id, "cajon")).toEqual(cajon(1, { B: [0], T: [4], g: [4, 8] }));
  });

  it("кахон однією лінією (до 2026-10-22) розкладається по лініях — і в пісні, і з буфера", () => {
    const { net, id } = withLane("cajon");
    change(net.A, () => {
      const slot = slotOf(net.A, 0, id);
      slot.set("grid", 16); // так лежить записане тоді: шістнадцятими
      const cells = slot.get("cells") as Y.Map<string>;
      ["1.1", "1.5", "1.7"].forEach((key, i) => cells.set(key, "BTg"[i]));
    });
    change(net.A, () => {
      upgradeCajon(slotOf(net.A, 0, id));
      upgradeGrid(slotOf(net.A, 0, id), "cajon");
    });
    expect(text(net.B, 0, id, "cajon")).toEqual(cajon(1, { B: [0], T: [4], g: [6] }));
    expect(parseCells("cajon", [`|B---T-g${d(9)}|`], sc("cajon"))!.cells).toEqual({ "1.1/1": "o", "1.97/2": "o", "1.145/3": "o" });
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
    change(net.A, () => eraseCell("tab", slotOf(net.A, 0, id), sc("tab"), { step: 0, string: 0 }, true));
    expect(cells()).toEqual({ "1.1/1": "2" });
  });

  it("текст табів ↔ клітинки — туди й назад той самий; табулатура з сайту з іншою шириною теж лягає", () => {
    const lines = [tabLine("e"), tabLine("B", [6, "1"]), tabLine("G", [4, "0"]), tabLine("D", [2, "2"]), tabLine("A", [0, "3"]), tabLine("E")];
    const parsed = parseCells("tab", lines, sc("tab"))!;
    expect(parsed.cells).toEqual({ "1.145/2": "1", "1.97/3": "0", "1.49/4": "2", "1.1/5": "3" });
    expect(renderCells("tab", Object.entries(parsed.cells), parsed.bars, sc("tab"))).toEqual(lines);
    const site = ["e|--------|", "B|---1----|", "G|--0-----|", "D|-2------|", "A|3-------|", "E|--------|"];
    expect(parseCells("tab", site, sc("tab"))!.cells).toEqual(parsed.cells);
  });

  it("двозначний лад у тексті займає одну колонку — решта кроків не зсуваються", () => {
    const { net, id, type } = withLane("tab");
    type("12", 0, { step: 2, string: 1 });
    type("3", 0, { step: 15, string: 5 });
    const shown = text(net.B, 0, id, "tab");
    const parsed = parseCells("tab", shown, sc("tab"))!;
    expect(parsed.cells).toEqual({ "1.49/2": "12", "1.361/6": "3" });
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
    const parsed = parseCells("blocks", shown, sc("blocks"))!;
    expect(renderCells("blocks", Object.entries(parsed.cells), parsed.bars, sc("blocks"))).toEqual(shown);
  });

  it("Backspace: стирає крок, а на порожньому — попередній", () => {
    const { net, id, type } = withLane("blocks");
    const at = type("C---");
    change(net.A, () => eraseCell("blocks", slotOf(net.A, 0, id), sc("blocks"), at, true));
    expect(text(net.B, 0, id, "blocks")).toEqual([`|C--${".".repeat(13)}|`]);
  });
});

describe("склеювання рядків", () => {
  it("клітинки другого рядка дописуються після тактів першого", () => {
    const { net, id, type } = withLane("cajon");
    type("B", 0, { step: 0, string: 0 });
    type("T", 0, { step: 4, string: 0 });
    type("B", 1, { step: 1, string: 0 });
    type("T", 1, { step: 2, string: 0 });
    change(net.A, () => mergeLine(net.A, 1));
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти святийГосподь"]);
    expect(text(net.B, 0, id, "cajon")).toEqual(cajon(2, { B: [0, 17], T: [4, 18] }));
  });
});

describe("вставка розпізнає доріжки і збирає їх у рядок", () => {
  const TAB = [tabLine("e"), tabLine("B", [6, "1"]), tabLine("G", [4, "0"]), tabLine("D", [2, "2"]), tabLine("A", [0, "3"]), tabLine("E")];
  const CAJON = cajon(1, { B: [0, 4], T: [2, 6], g: [7] });

  it("таби, кахон, акорди й слова → один рядок пісні; наступні таби — новий рядок", () => {
    const { net, id: tab } = withLane("tab", [{ words: "" }]);
    let lane = "";
    change(net.A, () => (lane = addLane(net.A, "cajon", linesOf(net.A))));
    const pasted = [...TAB, ...CAJON, "C       G", "Ти святий", ...TAB, "Господь"].join("\n");
    change(net.A, () => insertPlainText(net.A, { line: 0, lane: "words", offset: 0 }, pasted));
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти святий", "Господь"]);
    expect(text(net.B, 0, tab, "tab")).toEqual(TAB);
    expect(text(net.B, 0, lane, "cajon")).toEqual(CAJON);
    expect(text(net.B, 1, tab, "tab")).toEqual(TAB);
    expect(text(net.B, 1, lane, "cajon")).toEqual(cajon(1));
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
    expect(text(net.B, 0, id, "cajon", sc("cajon", 16, "6/8"))).toEqual(cajon(1, { B: [0], T: [3] }, 12));
  });
});

describe("запис у тіках, показ у масштабі людини", () => {
  it("масштаб: комірок у такті і тіків на комірку; тріолі — точно", () => {
    expect([16, 32, 64, 128, 12, 24, 48].map((z) => sc("tab", z)).map(({ cells, tick }) => [cells, tick])).toEqual([
      [16, 24],
      [32, 12],
      [64, 6],
      [128, 3],
      [12, 32],
      [24, 16],
      [48, 8],
    ]);
    expect(sc("blocks", 64)).toMatchObject({ cells: 16, tick: 1 }); // прямокутники без масштабу
  });

  it("записане в 1/64 у масштабі 1/16 — у найближчій комірці, сіріше; правка 1/16 його не чіпає", () => {
    const { net, id, type } = withLane("cajon");
    type("B", 0, { step: 1, string: 0 }, 64); // одна 64-та після першої долі
    expect(cellsJSON(net.B, 0, id)).toEqual({ "1.7/1": "o" });
    const placed = placeCells("cajon", (slotOf(net.B, 0, id).get("cells") as Y.Map<string>).entries(), 1, sc("cajon"));
    expect(placed.get("0/0")).toMatchObject({ value: "o", off: 0.25 });
    change(net.A, () => eraseCell("cajon", slotOf(net.A, 0, id), sc("cajon"), { step: 0, string: 0 }, false));
    expect(cellsJSON(net.B, 0, id)).toEqual({ "1.7/1": "o" });
    change(net.A, () => eraseCell("cajon", slotOf(net.A, 0, id), sc("cajon", 64), { step: 1, string: 0 }, false));
    expect(cellsJSON(net.B, 0, id)).toEqual({});
  });

  it("дві події в одній комірці — обидві (показ кладе одна на одну), для тексту — найближча; кінець такту — перша комірка наступного", () => {
    const { net, id, type } = withLane("tab");
    change(net.A, () => addBar(slotOf(net.A, 0, id)));
    type("3", 0, { step: 0, string: 0 }, 64);
    type("5", 0, { step: 1, string: 0 }, 64);
    type("7", 0, { step: 63, string: 0 }, 64); // остання 64-та першого такту
    const placed = placeCells("tab", (slotOf(net.B, 0, id).get("cells") as Y.Map<string>).entries(), 2, sc("tab"));
    expect(placed.get("0/0")).toEqual({ value: "3", off: 0, all: [{ value: "3", off: 0 }, { value: "5", off: 0.25 }] });
    expect(placed.get("16/0")).toMatchObject({ value: "7", off: 0.25 });
  });

  it("рівно між двома комірками — у лівій, ближчій до початку такту", () => {
    const { net, id, type } = withLane("tab");
    type("3", 0, { step: 1, string: 0 }, 32); // друга 32-га — рівно між 1-ю і 2-ю шістнадцятими
    type("5", 0, { step: 31, string: 1 }, 32); // остання 32-га такту — між останньою 16-ю і наступним тактом
    const placed = placeCells("tab", (slotOf(net.B, 0, id).get("cells") as Y.Map<string>).entries(), 2, sc("tab"));
    expect(placed.get("0/0")).toMatchObject({ value: "3", off: 0.5 });
    expect(placed.get("15/1")).toMatchObject({ value: "5", off: 0.5 });
  });

  it("1/128: друк на свій тік, у 1/16 — у своїй комірці блідо", () => {
    const { net, id, type } = withLane("tab");
    type("4", 0, { step: 1, string: 0 }, 128);
    expect(cellsJSON(net.B, 0, id)).toEqual({ "1.4/1": "4" });
    const placed = placeCells("tab", (slotOf(net.B, 0, id).get("cells") as Y.Map<string>).entries(), 1, sc("tab"));
    expect(placed.get("0/0")).toMatchObject({ value: "4", off: 0.125 });
  });

  it("тріолі: друк у масштабі 1/8 тріолі — на свій тік", () => {
    const { net, id, type } = withLane("tab");
    type("2", 0, { step: 1, string: 0 }, 12);
    expect(cellsJSON(net.B, 0, id)).toEqual({ "1.33/1": "2" });
    expect(text(net.B, 0, id, "tab", sc("tab", 12))[0]).toBe(`e|-2${d(10)}|`);
  });

  it("вставка розбирає текст у масштабі того, хто вставляє", () => {
    const { net, id } = withLane("cajon", [{ words: "" }]);
    const bars32 = cajon(1, { B: [0, 1] }, 32);
    change(net.A, () => insertPlainText(net.A, { line: 0, lane: "words", offset: 0 }, [...bars32, "Ти"].join("\n"), 32));
    expect(cellsJSON(net.B, 0, id)).toEqual({ "1.1/1": "o", "1.13/1": "o" });
  });

  it("масштаб — особистий, як капо: за ніком у пісні, за замовчуванням 1/16", () => {
    const { net } = withLane("tab");
    expect(readZoom(net.B.doc, "Оля")).toBe(16);
    change(net.A, () => writeZoom(net.A.doc, "Оля", 64));
    expect([readZoom(net.B.doc, "Оля"), readZoom(net.B.doc, "Вова")]).toEqual([64, 16]);
    change(net.A, () => writeZoom(net.A.doc, "Оля", 16));
    expect(net.B.doc.getMap("zoom").has("Оля")).toBe(false);
  });
});
