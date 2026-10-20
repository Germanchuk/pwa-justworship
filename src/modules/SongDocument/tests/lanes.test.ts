/** Доріжки пісні (ADR-0008): список доріжок, слот у кожному рядку, порядок, вставка за порядком. */
import { describe, expect, it } from "vitest";
import { change, makePair } from "./harness";
import {
  addLane,
  allLanes,
  cellsOf,
  chordsString,
  ensureSlots,
  insertPlainText,
  layout,
  lineKind,
  linesOf,
  missingSlots,
  moveLane,
  removeLane,
  restoreLane,
  songLanes,
  splitLine,
} from "../model";

const SEED = [
  { words: "Ти святий, Господь", chords: "Am F" },
  { words: "Твоє світло", chords: "C G" },
];
const ids = (lanes: { id: string }[]) => lanes.map((l) => l.id);

describe("список доріжок", () => {
  it("пісня без списку — акорди над словами; так і перенесені пісні", () => {
    const net = makePair(SEED);
    expect(songLanes(net.A.doc).map((l) => [l.id, l.kind])).toEqual([
      ["chords", "chords"],
      ["words", "words"],
    ]);
    expect(net.A.doc.getMap("lanes").size).toBe(0);
  });

  it("додана доріжка — над акордами, зі слотом у кожному рядку; дві доріжки табів — дві різні", () => {
    const net = makePair(SEED);
    let t1 = "";
    let t2 = "";
    change(net.A, () => {
      t1 = addLane(net.A, "tab", linesOf(net.A));
      t2 = addLane(net.A, "tab", linesOf(net.A));
    });
    expect(ids(songLanes(net.B.doc))).toEqual([t1, t2, "chords", "words"]);
    expect(songLanes(net.B.doc).map((l) => l.name)).toEqual(["Таби", "Таби 2", "Акорди", "Слова"]);
    linesOf(net.B).forEach((line) => {
      expect(cellsOf(line, t1)?.size).toBe(0);
      expect(cellsOf(line, t2)?.size).toBe(0);
    });
  });

  it("Enter — новий рядок зі слотами всіх доріжок", () => {
    const net = makePair(SEED);
    let id = "";
    change(net.A, () => (id = addLane(net.A, "cajon", linesOf(net.A))));
    change(net.A, () => splitLine(net.A, { line: 0, lane: "words", offset: 3 }));
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти ", "святий, Господь", "Твоє світло"]);
    expect(linesOf(net.B).every((line) => cellsOf(line, id) !== undefined)).toBe(true);
  });

  it("доріжку додали, поки інший тиснув Enter, — новий рядок без слота дописується, обоє сходяться", () => {
    const net = makePair(SEED);
    net.unlink();
    let id = "";
    change(net.A, () => (id = addLane(net.A, "blocks", linesOf(net.A))));
    change(net.B, () => splitLine(net.B, { line: 1, lane: "words", offset: 4 }));
    net.link();
    const missing = missingSlots(net.A, linesOf(net.A));
    expect(missing.map(({ lane }) => lane.id)).toEqual([id]);
    change(net.A, () => ensureSlots(net.A, linesOf(net.A)));
    expect(missingSlots(net.B, linesOf(net.B))).toEqual([]);
    expect(linesOf(net.B).every((line) => cellsOf(line, id) !== undefined)).toBe(true);
  });

  it("перетягуються лише додані — порядок спільний; слова завжди найнижчі, акорди — другі знизу", () => {
    const net = makePair(SEED);
    let tab = "";
    let cajon = "";
    change(net.A, () => {
      tab = addLane(net.A, "tab", linesOf(net.A));
      cajon = addLane(net.A, "cajon", linesOf(net.A));
    });
    change(net.A, () => moveLane(net.A.doc, cajon, 0));
    expect(ids(songLanes(net.B.doc))).toEqual([cajon, tab, "chords", "words"]);
    change(net.B, () => moveLane(net.B.doc, cajon, 5)); // далі за кінець доданих — найнижча з доданих
    expect(ids(songLanes(net.A.doc))).toEqual([tab, cajon, "chords", "words"]);
    expect(() => moveLane(net.A.doc, "words", 0)).toThrow();
    expect(() => moveLane(net.A.doc, "chords", 0)).toThrow();
  });

  it("прибрана доріжка зникає зі списку, вміст лишається; її можна повернути; слова й акорди — ні", () => {
    const net = makePair(SEED);
    let id = "";
    change(net.A, () => (id = addLane(net.A, "tab", linesOf(net.A))));
    change(net.A, () => cellsOf(linesOf(net.A)[0], id)!.set("1.1/1", "3"));
    change(net.A, () => removeLane(net.A.doc, id));
    expect(ids(songLanes(net.B.doc))).toEqual(["chords", "words"]);
    expect(ids(allLanes(net.B.doc))).toEqual([id, "chords", "words"]);
    expect(cellsOf(linesOf(net.B)[0], id)!.get("1.1/1")).toBe("3");
    change(net.B, () => restoreLane(net.B.doc, id));
    expect(ids(songLanes(net.A.doc))).toEqual([id, "chords", "words"]);
    expect(() => removeLane(net.A.doc, "words")).toThrow();
  });

  it("рядок із клітинками — відрізок, навіть без слів і акордів", () => {
    const net = makePair([{ words: "" }]);
    let id = "";
    change(net.A, () => (id = addLane(net.A, "cajon", linesOf(net.A))));
    expect(lineKind(layout(net.A)[0])).toBe("empty");
    change(net.A, () => cellsOf(linesOf(net.A)[0], id)!.set("1.1", "B"));
    expect(lineKind(layout(net.B)[0])).toBe("segment");
  });
});

describe("вставка: акорди беруть слова під собою, лише слова — решта доріжок порожні", () => {
  it("доріжки пісні вставки не міняють — рядки зі словами й акордами, як і без них", () => {
    const net = makePair([{ words: "" }]);
    change(net.A, () => addLane(net.A, "tab", linesOf(net.A)));
    change(net.A, () => insertPlainText(net.A, { line: 0, lane: "words", offset: 0 }, "Am  F\nТи святий\nГосподь"));
    expect(layout(net.B).map((l) => [chordsString(l.line), l.words])).toEqual([
      ["Am  F", "Ти святий"],
      ["", "Господь"],
    ]);
    expect(missingSlots(net.B, linesOf(net.B))).toEqual([]);
  });
});
