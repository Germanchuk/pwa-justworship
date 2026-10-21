/** Доріжки пісні (ADR-0008): список доріжок, слот у кожному рядку, порядок, вставка за порядком. */
import { describe, expect, it } from "vitest";
import { Element, Node, Transforms } from "slate";
import { change, makePair } from "./harness";
import { ALL, at, doc, setup } from "./testKit";
import type { LaneDisplay, LaneView } from "../bridge/laneView";
import {
  addLane,
  allLanes,
  addNote,
  ALL as ALL_SEE,
  cellsOf,
  chordsString,
  laneText,
  mergeLine,
  resolveNotes,
  Song,
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

describe("клітинкові доріжки — атомні вузли видимого дерева", () => {
  const SONG = [
    { words: "Ти святий", chords: "Am F" },
    { words: "Господь", chords: "C G" },
    { words: "Алилуя", chords: "F" },
  ];
  /** Рядок видимого: доріжки згори донизу — `t:`/`c:`/`w:` для табів, акордів, слів. */
  const rowsOf = (h: LaneView, tab: string) =>
    h.view.children.map((l) =>
      (l as Element).children
        .map((c) => {
          const n = c as unknown as { type: string; lane?: string };
          return n.type === "cells" ? (n.lane === tab ? "t" : "?") : `${n.type[0]}:${Node.string(c)}`;
        })
        .join(" | "),
    );
  const withTab = (b: LaneDisplay = ALL) => {
    const ctx = setup(SONG, ALL, b);
    let tab = "";
    ctx.A.change(() => (tab = addLane(ctx.net.A, "tab", linesOf(ctx.net.A))));
    return { ...ctx, tab };
  };

  it("додана доріжка з'являється в кожного над акордами; прибрана — зникає; сховав собі — лише в себе", () => {
    const { net, A, B, tab } = withTab();
    expect(rowsOf(B, tab)).toEqual(["t | c:Am F | w:Ти святий", "t | c:C G | w:Господь", "t | c:F | w:Алилуя"]);
    B.setDisplay({ ...ALL, hidden: [tab] });
    expect(rowsOf(B, tab)[0]).toBe("c:Am F | w:Ти святий");
    expect(rowsOf(A, tab)[0]).toBe("t | c:Am F | w:Ти святий");
    A.change(() => removeLane(net.A.doc, tab));
    expect(rowsOf(A, tab)[0]).toBe("c:Am F | w:Ти святий");
  });

  it("курсор у доріжці: друк — за її синтаксисом, у слова й акорди нічого не йде; стрілки — по кроках і струнах", () => {
    const { net, A, tab } = withTab();
    at(A, 1, 0, 0);
    A.view.insertText("3");
    expect(A.cells.key({ key: "ArrowRight" })).toBe(true);
    expect(A.cells.key({ key: "ArrowDown" })).toBe(true);
    A.view.insertText("x");
    expect(doc(net.B)).toEqual(["Am F / Ти святий", "C G / Господь", "F / Алилуя"]);
    const cells = cellsOf(linesOf(net.B)[1], tab)!;
    expect(cells.toJSON()).toEqual({ "1.1/1": "3", "1.2/2": "x" });
    expect(A.cells.key({ key: "ArrowUp" })).toBe(true);
    expect(A.cells.key({ key: "ArrowUp" })).toBe(false); // верхня струна — далі Slate
    A.cells.key({ key: "Home" });
    expect(A.cells.key({ key: "ArrowLeft" })).toBe(false); // перший крок — далі Slate
  });

  it("копіювання: доріжка — уся, своїм текстом; вставка в доріжку — розбирає текст", () => {
    const { net, A, tab } = withTab();
    change(net.A, () => cellsOf(linesOf(net.A)[1], tab)!.set("1.4/2", "1"));
    Transforms.select(A.view, { anchor: { path: [0, 2, 0], offset: 3 }, focus: { path: [1, 1, 0], offset: 1 } });
    expect(A.copyText()).toBe(
      ["святий", "e|--------|", "B|---1----|", "G|--------|", "D|--------|", "A|--------|", "E|--------|", "C"].join("\n"),
    );
    at(A, 2, 0, 0);
    expect(A.cells.paste(["e|--------|", "B|--------|", "G|--------|", "D|--------|", "A|--------|", "E|3-------|"].join("\n"))).toBe(true);
    expect(cellsOf(linesOf(net.B)[2], tab)!.toJSON()).toEqual({ "1.1/6": "3" });
  });

  it("видалення виділеного захоплює клітинки видимих доріжок у виділенні; рядок зі схованими клітинками лишається", () => {
    const { net, A, B, tab } = withTab();
    const lines = linesOf(net.A);
    change(net.A, () => lines.forEach((line, i) => cellsOf(line, tab)!.set("1.1/1", String(i))));
    // від «святий» (рядок 0, слова) до «Г|осподь» (рядок 1, слова): таби рядка 1 — у виділенні
    Transforms.select(A.view, { anchor: { path: [0, 2, 0], offset: 3 }, focus: { path: [1, 2, 0], offset: 1 } });
    A.view.deleteFragment();
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти осподь", "Алилуя"]);
    expect(linesOf(net.B).map((line) => cellsOf(line, tab)!.get("1.1/1"))).toEqual(["0", "2"]);

    // B не бачить табів: рядок, у якому вони є, з його виділення не зникає і не склеюється
    B.setDisplay({ ...ALL, hidden: [tab] });
    Transforms.select(B.view, { anchor: { path: [0, 1, 0], offset: 0 }, focus: { path: [1, 1, 0], offset: 3 } });
    B.view.deleteFragment();
    expect(layout(net.A).map((l) => l.words)).toEqual(["", "луя"]);
    expect(cellsOf(linesOf(net.A)[1], tab)!.get("1.1/1")).toBe("2");
  });

  it("перестановка доданих доріжок — рядки в кожного перебудовано", () => {
    const { net, A, B, tab } = withTab();
    let cajon = "";
    A.change(() => (cajon = addLane(net.A, "cajon", linesOf(net.A))));
    const order = () =>
      ((B.view.children[0] as Element).children as unknown as { lane?: string; type: string }[]).map((n) => n.lane ?? n.type);
    expect(order()).toEqual([tab, cajon, "chords", "words"]);
    A.change(() => moveLane(net.A.doc, cajon, 0));
    expect(order()).toEqual([cajon, tab, "chords", "words"]);
    A.undoManager.undo();
    expect(order()).toEqual([tab, cajon, "chords", "words"]);
  });
});

describe("додана текстова доріжка (вигуки) — правиться як акорди", () => {
  const SONG = [
    { words: "Ти святий", chords: "Am F" },
    { words: "Господь", chords: "C G" },
  ];
  const vocalsOf = (song: Song, id: string) => linesOf(song).map((line) => laneText(line, id)?.toString());
  const rows = (h: LaneView) =>
    h.view.children.map((l) =>
      (l as Element).children.map((c) => `${(c as unknown as { type: string }).type}:${Node.string(c)}`).join(" | "),
    );
  const withVocals = (b: LaneDisplay = ALL) => {
    const ctx = setup(SONG, ALL, b);
    let id = "";
    ctx.A.change(() => (id = addLane(ctx.net.A, "text", linesOf(ctx.net.A))));
    return { ...ctx, id };
  };

  it("стоїть над акордами, назва — «Вигуки»; друк іде в її текст і доходить до інших", () => {
    const { net, A, B, id } = withVocals();
    expect(songLanes(net.B.doc).map((l) => l.name)).toEqual(["Вигуки", "Акорди", "Слова"]);
    expect(rows(B)[0]).toBe("text: | chords:Am F | words:Ти святий");
    at(A, 0, 0, 0);
    A.view.insertText("Ей!");
    expect(vocalsOf(net.B, id)).toEqual(["Ей!", ""]);
    expect(rows(B)[0]).toBe("text:Ей! | chords:Am F | words:Ти святий");
  });

  it("Enter — вигуки лишаються першій частині; склеювання — дописуються вирівняними під кінець слів", () => {
    const { net, A, id } = withVocals();
    change(net.A, () => laneText(linesOf(net.A)[1], id)!.insert(0, "О-о"));
    change(net.A, () => mergeLine(net.A, 1));
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти святийГосподь"]);
    expect(vocalsOf(net.B, id)).toEqual(["         О-о"]);
    at(A, 0, 2, 3);
    A.view.insertBreak();
    expect(vocalsOf(net.B, id)).toEqual(["         О-о", ""]);
  });

  it("примітка на вигуках — над своєю доріжкою; сховав доріжку — сховалась і примітка", () => {
    const { net, B, id } = withVocals();
    change(net.A, () => laneText(linesOf(net.A)[0], id)!.insert(0, "Ей!"));
    change(net.A, () =>
      addNote(net.A, 0, id, 0, 3, { id: "n", author: "Оля", visibleFor: [ALL_SEE], color: "#F5C518", body: "голосно" }),
    );
    const seen = (h: LaneView) => resolveNotes(net.B, [], h.isShown).map((n) => `${n.lane === id ? "вигуки" : n.lane}:${n.status}`);
    expect(seen(B)).toEqual(["вигуки:visible"]);
    B.setDisplay({ ...ALL, hidden: [id] });
    expect(seen(B)).toEqual(["вигуки:hidden"]);
    expect(rows(B)[0]).toBe("chords:Am F | words:Ти святий");
  });

  it("видалення через рядки стирає вигуки, що потрапили у виділення", () => {
    const { net, A, id } = withVocals();
    change(net.A, () => linesOf(net.A).forEach((line, i) => laneText(line, id)!.insert(0, `в${i}`)));
    // від «святий» (рядок 0, слова) до «Го|сподь» (рядок 1, слова): вигуки й акорди рядка 1 — у виділенні
    Transforms.select(A.view, { anchor: { path: [0, 2, 0], offset: 3 }, focus: { path: [1, 2, 0], offset: 2 } });
    A.view.deleteFragment();
    expect(layout(net.B).map((l) => l.words)).toEqual(["Ти сподь"]);
    expect(vocalsOf(net.B, id)).toEqual(["в0"]);
  });
});
