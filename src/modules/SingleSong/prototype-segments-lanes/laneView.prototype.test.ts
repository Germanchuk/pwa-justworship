/**
 * PROTOTYPE — ітерація 4: мідлвер «повне дерево ↔ видиме дерево».
 * Справжні Slate + @slate-yjs, два учасники, у кожного — повне дерево
 * (прив'язане до Yjs) і своє видиме (лише вибрані доріжки).
 * `expect` фіксує те, ЩО Є.
 */
import { describe, expect, it } from "vitest";
import { Editor, Element, Node, Transforms } from "slate";
import { flush, makePair, Peer, Segment } from "./harness";
import { line, withTextLanes } from "./textLanes";
import { createLaneView, LaneDisplay, LaneViewHandle } from "./laneView";

const SONG = [
  line("/Куплет"),
  //    0123456789012345678
  line("Ти святий, Господь", "Am F       C   G"),
  line("Твоє світло серед ночі", "F    C      G     Am"),
  line(""),
  line("Алилуя", "F G"),
];

const ALL: LaneDisplay = { words: true, chords: true };
const WORDS: LaneDisplay = { words: true, chords: false };
const CHORDS: LaneDisplay = { words: false, chords: true };
const NONE: LaneDisplay = { words: false, chords: false };

function setup(a: LaneDisplay, b: LaneDisplay) {
  const net = makePair(SONG as unknown as Segment[], { extend: (p) => withTextLanes(p.editor) });
  const mk = (p: Peer, d: LaneDisplay) => createLaneView(p.editor, d, { afterFullChange: () => flush(p) });
  return { net, A: mk(net.A, a), B: mk(net.B, b) };
}

/** Видиме дерево: рядок = доріжки через « | », тип доріжки — першою літерою. */
const shown = (h: LaneViewHandle) =>
  h.view.children.map((l) =>
    (l as Element).children.map((c) => `${(c as unknown as { type: string }).type[0]}:${Node.string(c)}`).join(" | "),
  );
/** Повне дерево в документі (однакове в обох після синхронізації). */
const doc = (p: Peer) => p.editor.children.map((l) => (l as Element).children.map((c) => Node.string(c)).join(" / "));

const at = (h: LaneViewHandle, ln: number, lane: number, offset: number) =>
  Transforms.select(h.view, { path: [ln, lane, 0], offset });

describe("проєкція: кожен бачить лише свої доріжки, каркас — завжди", () => {
  it("усе / лише слова / лише акорди / нічого", () => {
    const { A, B } = setup(WORDS, CHORDS);
    expect(shown(A)).toEqual(["w:/Куплет", "w:Ти святий, Господь", "w:Твоє світло серед ночі", "w:", "w:Алилуя"]);
    expect(shown(B)).toEqual(["w:/Куплет", "c:Am F       C   G", "c:F    C      G     Am", "c:", "c:F G"]);
    A.setDisplay(NONE);
    expect(shown(A)).toEqual(["w:/Куплет", "w:"]);
    A.setDisplay(ALL);
    expect(shown(A)[1]).toBe("c:Am F       C   G | w:Ти святий, Господь");
  });
});

describe("правка, бачачи частину доріжок", () => {
  it("лише слова: друк іде в документ, рядки, яких не торкались, — ті самі об'єкти", () => {
    const { net, A, B } = setup(WORDS, ALL);
    const untouched = A.view.children[2];
    at(A, 1, 0, 18);
    Editor.insertText(A.view, "!");
    expect(doc(net.B)[1]).toBe("Am F       C   G / Ти святий, Господь!");
    expect(shown(B)[1]).toBe("c:Am F       C   G | w:Ти святий, Господь!");
    expect(A.view.children[2]).toBe(untouched);
  });

  it("лише слова: Enter посеред рядка — сховані акорди лишаються першій частині", () => {
    const { net, A, B } = setup(WORDS, ALL);
    at(A, 1, 0, 11);
    Editor.insertBreak(A.view);
    expect(shown(A).slice(1, 3)).toEqual(["w:Ти святий, ", "w:Господь"]);
    expect(doc(net.B).slice(1, 3)).toEqual(["Am F       C   G / Ти святий, ", " / Господь"]);
    expect(shown(B)[2]).toBe("c: | w:Господь");
    expect(A.view.selection?.anchor).toEqual({ path: [2, 0, 0], offset: 0 });
  });

  it("лише слова: Backspace склеює рядки — сховані акорди другого не губляться", () => {
    const { net, A } = setup(WORDS, ALL);
    at(A, 2, 0, 0);
    Editor.deleteBackward(A.view);
    expect(shown(A)[1]).toBe("w:Ти святий, ГосподьТвоє світло серед ночі");
    expect(doc(net.B)[1]).toBe("Am F       C   G  F    C      G     Am / Ти святий, ГосподьТвоє світло серед ночі");
  });

  it("лише слова: виділив через два рядки й стер — сховане не стерто, рядки склеєні", () => {
    const { net, A } = setup(WORDS, ALL);
    Transforms.select(A.view, { anchor: { path: [1, 0, 0], offset: 3 }, focus: { path: [2, 0, 0], offset: 5 } });
    Editor.deleteFragment(A.view);
    expect(shown(A)[1]).toBe("w:Ти світло серед ночі");
    expect(doc(net.B)[1]).toBe("Am F       C   G F    C      G     Am / Ти світло серед ночі");
  });

  it("лише акорди: друк в акорди, слова не зачеплені; стрілка вліво з початку рядка — в кінець акордів попереднього", () => {
    const { net, A } = setup(CHORDS, ALL);
    at(A, 1, 0, 0);
    Editor.insertText(A.view, "Dm ");
    expect(doc(net.B)[1]).toBe("Dm Am F       C   G / Ти святий, Господь");
    at(A, 2, 0, 0);
    Transforms.move(A.view, { reverse: true });
    expect(A.view.selection?.anchor).toEqual({ path: [1, 0, 0], offset: 19 });
  });

  it("лише акорди: друк у порожньому рядку — це акорди (рядок стає відрізком без слів)", () => {
    const { net, A } = setup(CHORDS, ALL);
    at(A, 3, 0, 0);
    Editor.insertText(A.view, "Em");
    expect(doc(net.B)[3]).toBe("Em / ");
    expect(shown(A)[3]).toBe("c:Em");
  });
});

describe("чужі правки доходять у видиме дерево", () => {
  it("Герман пише слова, у Олі курсор в іншому рядку — курсор не зрушив, той рядок той самий об'єкт", () => {
    const { A, B } = setup(WORDS, ALL);
    at(A, 2, 0, 5);
    const olyasLine = A.view.children[2];
    at(B, 1, 1, 0);
    Editor.insertText(B.view, "О, ");
    expect(shown(A)[1]).toBe("w:О, Ти святий, Господь");
    expect(A.view.selection?.anchor).toEqual({ path: [2, 0, 0], offset: 5 });
    expect(A.view.children[2]).toBe(olyasLine);
  });

  it("Герман вставляє рядок вище — курсор Олі переїжджає разом зі своїм рядком", () => {
    const { A, B } = setup(WORDS, ALL);
    at(A, 2, 0, 5);
    at(B, 0, 0, 7);
    Editor.insertBreak(B.view); // Enter у кінці «/Куплет» — новий порожній рядок
    expect(shown(A).slice(0, 3)).toEqual(["w:/Куплет", "w:", "w:Ти святий, Господь"]);
    expect(A.view.selection?.anchor).toEqual({ path: [3, 0, 0], offset: 5 });
  });

  it("Герман пише акорди — у Олі (лише слова) у видимому нічого не змінюється", () => {
    const { A, B } = setup(WORDS, ALL);
    const before = A.view.children;
    at(B, 1, 0, 0);
    Editor.insertText(B.view, "Dm ");
    expect(A.view.children).toBe(before);
  });

  it("порожній рядок став відрізком у Германа — в Олі (усе показано) рядку додається доріжка акордів", () => {
    const { A, B } = setup(ALL, ALL);
    expect(shown(A)[3]).toBe("w:");
    at(B, 3, 0, 0);
    Editor.insertText(B.view, "Ми");
    expect(shown(A)[3]).toBe("c: | w:Ми");
  });

  it("сам пишу в порожній рядок (усе показано) — йому додається доріжка акордів, курсор лишається в словах", () => {
    const { A } = setup(ALL, ALL);
    at(A, 3, 0, 0);
    Editor.insertText(A.view, "Ми");
    expect(shown(A)[3]).toBe("c: | w:Ми");
    expect(A.view.selection?.anchor).toEqual({ path: [3, 1, 0], offset: 2 });
  });

  it("Оля нічого не показує, крім каркаса; Герман пише в порожній рядок — рядок зникає з її видимого", () => {
    const { A, B } = setup(NONE, ALL);
    expect(shown(A)).toEqual(["w:/Куплет", "w:"]);
    at(B, 3, 0, 0);
    Editor.insertText(B.view, "Ми");
    expect(shown(A)).toEqual(["w:/Куплет"]);
  });
});

describe("правило «/»", () => {
  it("на початку рядка з вмістом «/» не друкується; у порожньому — рядок стає приміткою; деінде «/» звичайний", () => {
    const { net, A } = setup(ALL, ALL);
    at(A, 1, 1, 0);
    Editor.insertText(A.view, "/");
    expect(doc(net.B)[1]).toBe("Am F       C   G / Ти святий, Господь");
    at(A, 1, 0, 2);
    Editor.insertText(A.view, "/E");
    expect(doc(net.B)[1]).toBe("Am/E F       C   G / Ти святий, Господь");
    at(A, 3, 0, 0);
    Editor.insertText(A.view, "/Міст");
    expect(shown(A)[3]).toBe("w:/Міст");
  });

  it("перед «/» примітки нічого не вставити", () => {
    const { net, A } = setup(ALL, ALL);
    at(A, 0, 0, 0);
    Editor.insertText(A.view, "X");
    expect(doc(net.B)[0]).toBe(" / /Куплет");
  });

  it("конкурентно: Оля пише «/» у порожній рядок, Герман без мережі — «Ми» в той самий", () => {
    const { net, A, B } = setup(ALL, ALL);
    net.unlink();
    at(A, 3, 0, 0);
    Editor.insertText(A.view, "/");
    at(B, 3, 0, 0);
    Editor.insertText(B.view, "Ми");
    net.link();
    expect(doc(net.A)[3]).toBe(doc(net.B)[3]);
    expect([" / /Ми", " / Ми/"]).toContain(doc(net.A)[3]);
  });
});
