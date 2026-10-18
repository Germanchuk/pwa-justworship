/**
 * Undo і одночасна правка тексту через мідлвер (модель пісні в Yjs).
 * Undo — штатний Y.UndoManager на рядках моделі. `expect` фіксує те, ЩО Є.
 */
import { describe, expect, it } from "vitest";
import { Editor, Transforms } from "slate";
import { LaneDisplay, LaneView } from "../bridge/laneView";
import { ALL, at, doc, setup as setupWith, tick, WORDS } from "./testKit";

const SONG = [
  { words: "/Куплет" },
  //       0123456789012345678
  { words: "Ти святий, Господь", chords: "Am F       C   G" },
  { words: "Твоє світло серед ночі", chords: "F    C      G     Am" },
];

const setup = (a: LaneDisplay, b: LaneDisplay) => setupWith(SONG, a, b);
const undo = (h: LaneView) => (h.view as unknown as { undo: () => void }).undo();
const redo = (h: LaneView) => (h.view as unknown as { redo: () => void }).redo();
/** Окремий крок історії: Y.UndoManager склеює правки за 500 мс. */
const step = (h: LaneView) => h.undoManager.stopCapturing();

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
    step(A);
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
    step(A);
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
    step(A);
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

describe("курсор в історії (як у withYHistory)", () => {
  it("redo повертає курсор туди, де він був після правки", async () => {
    const { A } = setup(WORDS, ALL);
    at(A, 1, 0, 11);
    await tick();
    Editor.insertBreak(A.view);
    await tick();
    undo(A);
    await tick();
    expect(A.view.selection?.anchor).toEqual({ path: [1, 0, 0], offset: 11 });
    redo(A);
    await tick();
    expect(A.view.selection?.anchor).toEqual({ path: [2, 0, 0], offset: 0 });
  });

  it("курсор у кінці рядка тримається рядка: чужий Enter у кінці не переносить його в новий рядок", async () => {
    const { net, A, B } = setup(WORDS, ALL);
    at(A, 1, 0, 18);
    Editor.insertText(A.view, "!");
    await tick();
    at(B, 1, 1, 19);
    Editor.insertBreak(B.view); // новий порожній рядок під «…Господь!»
    await tick();
    undo(A);
    await tick();
    expect(doc(net.A).slice(1, 3)).toEqual(["Am F       C   G / Ти святий, Господь", " / "]);
    expect(A.view.selection?.anchor).toEqual({ path: [1, 0, 0], offset: 18 });
  });
});
