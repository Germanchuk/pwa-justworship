/**
 * PROTOTYPE — ітерація 4: undo і одночасна правка тексту через мідлвер.
 * `expect` фіксує те, ЩО Є.
 */
import { describe, expect, it } from "vitest";
import { Editor, Element, Node, Transforms } from "slate";
import { withYHistory } from "@slate-yjs/core";
import { flush, makePair, Peer } from "../harness";
import { line, withTextLanes } from "./textLanes";
import { createLaneView, LaneDisplay, LaneView } from "./laneView";

const SONG = [
  line("/Куплет"),
  //    0123456789012345678
  line("Ти святий, Господь", "Am F       C   G"),
  line("Твоє світло серед ночі", "F    C      G     Am"),
];
const ALL: LaneDisplay = { words: true, chords: true };
const WORDS: LaneDisplay = { words: true, chords: false };

function setup(a: LaneDisplay, b: LaneDisplay) {
  const net = makePair(SONG as unknown as Node[], {
    extend: (p) => {
      withTextLanes(p.editor);
      withYHistory(p.editor as never);
    },
  });
  const mk = (p: Peer, d: LaneDisplay) => createLaneView(p.editor, d, { flush: () => flush(p) });
  return { net, A: mk(net.A, a), B: mk(net.B, b) };
}
const doc = (p: Peer) => p.editor.children.map((l) => (l as Element).children.map((c) => Node.string(c)).join(" / "));
const at = (h: LaneView, ln: number, lane: number, offset: number) =>
  Transforms.select(h.view, { path: [ln, lane, 0], offset });
const undo = (h: LaneView) => (h.view as unknown as { undo: () => void }).undo();
const redo = (h: LaneView) => (h.view as unknown as { redo: () => void }).redo();
/**
 * Між діями користувача — тік: у браузері кожне натискання — окрема подія, і
 * відкладений `onChange` Slate встигає відпрацювати. Без цього undo в тій самій
 * синхронній ділянці дописує «\n» (артефакт тесту, у браузері не буває).
 */
const tick = () => new Promise((r) => setTimeout(r, 0));
/** Окремий крок історії: Y.UndoManager склеює правки за 500 мс. */
const step = (p: Peer) => (p.editor as unknown as { undoManager: { stopCapturing: () => void } }).undoManager.stopCapturing();

describe("undo через мідлвер", () => {
  it("друк → undo → redo", async () => {
    const { net, A } = setup(ALL, ALL);
    at(A, 1, 1, 18);
    Editor.insertText(A.view, "!");
    await tick();
    undo(A);
    await tick();
    expect(doc(net.B)[1]).toBe("Am F       C   G / Ти святий, Господь");
    redo(A);
    await tick();
    expect(doc(net.B)[1]).toBe("Am F       C   G / Ти святий, Господь!");
  });

  it("Enter посеред рядка → undo — рядок цілий, курсор там, де був до Enter", async () => {
    const { net, A } = setup(WORDS, ALL);
    at(A, 1, 0, 11);
    await tick();
    Editor.insertBreak(A.view);
    await tick();
    step(net.A);
    undo(A);
    await tick();
    expect(doc(net.B).slice(1, 3)).toEqual([
      "Am F       C   G / Ti святий, Господь".replace("Ti", "Ти"),
      "F    C      G     Am / Твоє світло серед ночі",
    ]);
    expect(A.view.selection?.anchor).toEqual({ path: [1, 0, 0], offset: 11 });
  });

  it("лише слова: склеїв рядки (сховані акорди дописались) → undo — акорди другого рядка повернулись на місце", async () => {
    const { net, A } = setup(WORDS, ALL);
    at(A, 2, 0, 0);
    await tick();
    Editor.deleteBackward(A.view);
    await tick();
    step(net.A);
    undo(A);
    await tick();
    expect(doc(net.B).slice(1, 3)).toEqual([
      "Am F       C   G / Ти святий, Господь",
      "F    C      G     Am / Твоє світло серед ночі",
    ]);
  });

  it("моє undo не скасовує правок Германа", async () => {
    const { net, A, B } = setup(ALL, ALL);
    at(A, 1, 1, 0);
    Editor.insertText(A.view, "О, ");
    await tick();
    step(net.A);
    at(B, 2, 1, 22);
    Editor.insertText(B.view, "!");
    await tick();
    undo(A);
    await tick();
    expect(doc(net.A).slice(1, 3)).toEqual([
      "Am F       C   G / Ти святий, Господь",
      "F    C      G     Am / Твоє світло серед ночі!",
    ]);
  });
});

describe("кроки історії", () => {
  it("Enter, а одразу за ним друк — два окремі кроки undo", async () => {
    const { net, A } = setup(WORDS, ALL);
    at(A, 1, 0, 11);
    await tick();
    Editor.insertBreak(A.view);
    await tick();
    Editor.insertText(A.view, "О ");
    await tick();
    undo(A);
    await tick();
    expect(doc(net.B).slice(1, 3)).toEqual(["Am F       C   G / Ти святий, ", " / Господь"]);
    undo(A);
    await tick();
    expect(doc(net.B)[1]).toBe("Am F       C   G / Ти святий, Господь");
  });
});

describe("одночасна правка тексту", () => {
  it("онлайн, той самий рядок: Оля пише на початку, Герман у кінці — обидва; курсор Олі на своєму місці", () => {
    const { net, A, B } = setup(ALL, ALL);
    at(A, 1, 1, 0);
    Editor.insertText(A.view, "О, ");
    at(B, 1, 1, 21);
    Editor.insertText(B.view, "!");
    expect(doc(net.A)[1]).toBe("Am F       C   G / О, Ти святий, Господь!");
    expect(A.view.selection?.anchor).toEqual({ path: [1, 1, 0], offset: 3 });
  });

  it("Герман пише перед курсором Олі в тому самому рядку — курсор Олі зсувається разом з текстом", () => {
    const { A, B } = setup(ALL, ALL);
    at(A, 1, 1, 5);
    at(B, 1, 1, 0);
    Editor.insertText(B.view, "О, ");
    expect(A.view.selection?.anchor).toEqual({ path: [1, 1, 0], offset: 8 });
  });

  it("без мережі: Оля вписує слово всередину «Господь», Герман стирає «Господь» — вписане Олею лишається", () => {
    const { net, A, B } = setup(ALL, ALL);
    net.unlink();
    at(A, 1, 1, 14);
    Editor.insertText(A.view, "Х");
    Transforms.select(B.view, { anchor: { path: [1, 1, 0], offset: 11 }, focus: { path: [1, 1, 0], offset: 18 } });
    Editor.deleteFragment(B.view);
    net.link();
    expect(doc(net.A)[1]).toBe("Am F       C   G / Ти святий, Х");
    expect(doc(net.A)).toEqual(doc(net.B));
  });

  it("без мережі: обоє пишуть в одну точку — обидві вставки, однаковий порядок в обох", () => {
    const { net, A, B } = setup(ALL, ALL);
    net.unlink();
    at(A, 1, 0, 0);
    Editor.insertText(A.view, "X ");
    at(B, 1, 0, 0);
    Editor.insertText(B.view, "Y ");
    net.link();
    expect(doc(net.A)).toEqual(doc(net.B));
    expect(["X Y Am F       C   G", "Y X Am F       C   G"]).toContain(doc(net.A)[1].split(" / ")[0]);
  });
});
