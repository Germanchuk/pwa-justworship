/** Доріжки пісні (ADR-0008): список доріжок, слот у кожному рядку, порядок, вставка за порядком. */
import { describe, expect, it } from "vitest";
import { Transforms } from "slate";
import { change, makePair } from "./harness";
import { ALL, at, setup, shown } from "./testKit";
import {
  addLane,
  allLanes,
  cellsOf,
  ensureSlots,
  groupLines,
  layout,
  lineKind,
  linesOf,
  missingSlots,
  moveLane,
  removeLane,
  restoreLane,
  songLanes,
  splitLine,
  textLaneOrder,
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

  it("додана доріжка — внизу, зі слотом у кожному рядку; дві доріжки табів — дві різні", () => {
    const net = makePair(SEED);
    let t1 = "";
    let t2 = "";
    change(net.A, () => {
      t1 = addLane(net.A, "tab", linesOf(net.A));
      t2 = addLane(net.A, "tab", linesOf(net.A));
    });
    expect(ids(songLanes(net.B.doc))).toEqual(["chords", "words", t1, t2]);
    expect(songLanes(net.B.doc).map((l) => l.name)).toEqual(["Акорди", "Слова", "Таби", "Таби 2"]);
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

  it("перетягування: слова над акордами — порядок спільний для всіх", () => {
    const net = makePair(SEED);
    let id = "";
    change(net.A, () => (id = addLane(net.A, "tab", linesOf(net.A))));
    change(net.A, () => moveLane(net.A.doc, "words", 0));
    expect(ids(songLanes(net.B.doc))).toEqual(["words", "chords", id]);
    change(net.B, () => moveLane(net.B.doc, id, 1));
    expect(ids(songLanes(net.A.doc))).toEqual(["words", id, "chords"]);
    expect(textLaneOrder(net.A.doc)).toEqual(["words", "chords"]);
  });

  it("прибрана доріжка зникає зі списку, вміст лишається; її можна повернути; слова й акорди — ні", () => {
    const net = makePair(SEED);
    let id = "";
    change(net.A, () => (id = addLane(net.A, "tab", linesOf(net.A))));
    change(net.A, () => cellsOf(linesOf(net.A)[0], id)!.set("1.1/1", "3"));
    change(net.A, () => removeLane(net.A.doc, id));
    expect(ids(songLanes(net.B.doc))).toEqual(["chords", "words"]);
    expect(ids(allLanes(net.B.doc))).toContain(id);
    expect(cellsOf(linesOf(net.B)[0], id)!.get("1.1/1")).toBe("3");
    change(net.B, () => restoreLane(net.B.doc, id));
    expect(ids(songLanes(net.A.doc))).toEqual(["chords", "words", id]);
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

describe("вставка збирає рядки за порядком доріжок пісні", () => {
  const TEXT = ["Am  F", "Ти святий", "C  G", "Твоє світло", "", "Алилуя"];

  it("акорди над словами — акорди беруть слова під собою", () => {
    expect(groupLines(TEXT, ["chords", "words"])).toEqual([
      { chords: "Am  F", words: "Ти святий" },
      { chords: "C  G", words: "Твоє світло" },
      { chords: "", words: "" },
      { chords: "", words: "Алилуя" },
    ]);
  });

  it("слова над акордами — акорди беруть слова над собою", () => {
    expect(groupLines(["Ти святий", "Am  F", "Твоє світло", "C  G"], ["words", "chords"])).toEqual([
      { chords: "Am  F", words: "Ти святий" },
      { chords: "C  G", words: "Твоє світло" },
    ]);
  });

  it("лише слова — рядки зі словами, решта доріжок порожні", () => {
    expect(groupLines(["Ти святий", "Господь"], ["chords", "words"])).toEqual([
      { chords: "", words: "Ти святий" },
      { chords: "", words: "Господь" },
    ]);
  });
});

describe("видиме дерево йде за порядком пісні", () => {
  it("перетягнули слова над акорди — у кожного рядок перебудовано; undo повертає", () => {
    const { net, A, B } = setup(SEED, ALL, ALL);
    expect(shown(B)[0]).toBe("c:Am F | w:Ти святий, Господь");
    at(A, 0, 1, 2);
    A.change(() => moveLane(net.A.doc, "words", 0));
    expect(shown(B)).toEqual(["w:Ти святий, Господь | c:Am F", "w:Твоє світло | c:C G"]);
    expect(shown(A)[0]).toBe("w:Ти святий, Господь | c:Am F");
    A.undoManager.undo();
    expect(shown(B)[0]).toBe("c:Am F | w:Ти святий, Господь");
  });

  it("слова над акордами: видалення через рядки стирає в порядку документа", () => {
    const { net, A } = setup(SEED, ALL, ALL);
    A.change(() => moveLane(net.A.doc, "words", 0));
    // виділення від «святий» (рядок 0, слова) до «світло» (рядок 1, слова)
    Transforms.select(A.view, { anchor: { path: [0, 0, 0], offset: 3 }, focus: { path: [1, 0, 0], offset: 5 } });
    A.view.deleteFragment();
    // акорди рядка 0 стоять після його слів — стерті; акорди рядка 1 — після виділення, дописуються склеюванням
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти світло"]);
    expect(shown(A)).toEqual(["w:Ти світло | c:   C G"]);
  });
});
