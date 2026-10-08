/**
 * PROTOTYPE — ітерації 2–3: рядок = [акорди, слова], дві текстові доріжки.
 * Справжні Slate + @slate-yjs, два Y.Doc. `expect` фіксує те, ЩО Є.
 */
import { describe, expect, it } from "vitest";
import { Editor, Element, Node, Transforms } from "slate";
import { flush, makePair, Peer, removeSegment, Segment } from "./harness";
import { lanePath, line, lineKind, withTextLanes } from "./textLanes";

const SONG = [
  //       0123456789012345678
  line("Ти святий, Господь", "Am F       C   G", { "cajon:1.1": "B" }),
  line("Твоє світло серед ночі", "F    C      G     Am"),
];

const pair = () => makePair(SONG as unknown as Segment[], { extend: (p) => withTextLanes(p.editor) });

function enter(p: Peer, seg: number, offset: number) {
  Transforms.select(p.editor, { path: [seg, 1, 0], offset });
  Editor.insertBreak(p.editor);
  flush(p);
}
function backspace(p: Peer, seg: number, lane: 0 | 1 = 1) {
  Transforms.select(p.editor, { path: [seg, lane, 0], offset: 0 });
  Editor.deleteBackward(p.editor, { unit: "character" });
  flush(p);
}
function type(p: Peer, seg: number, lane: "chords" | "words", offset: number, text: string) {
  Transforms.insertText(p.editor, text, { at: { path: [...lanePath(p.editor, seg, lane), 0], offset } });
  flush(p);
}

/** Відрізок у читабельному вигляді: атрибути, акорди, слова. */
type SegView = Record<string, unknown> & { chords: string; words: string; lanes: string };
function view(p: Peer): SegView[] {
  return p.editor.children.map((n) => {
    const { type: _t, children, ...props } = n as Element & Record<string, unknown>;
    const lanes = Object.fromEntries(
      (children as Element[]).map((c) => [(c as unknown as { type: string }).type, Node.string(c)]),
    );
    return { ...props, ...lanes, lanes: (children as unknown as { type: string }[]).map((c) => c.type).join("+") } as SegView;
  });
}

describe("Enter і Backspace", () => {
  it("Enter посеред слів: перша частина отримує все, друга — порожні доріжки", () => {
    const { A, B } = pair();
    enter(A, 0, 11);
    expect(view(B).slice(0, 2)).toEqual([
      { "cajon:1.1": "B", chords: "Am F       C   G", words: "Ти святий, ", lanes: "chords+words" },
      { chords: "", words: "Господь", lanes: "chords+words" },
    ]);
  });

  it("Enter → Backspace повертає рівно те, що було", () => {
    const { A, B } = pair();
    const before = view(B);
    enter(A, 0, 11);
    backspace(A, 1);
    expect(view(B)).toEqual(before);
  });

  it("злиття з непорожніми акордами другого: дописуються вирівняними під кінець слів першого", () => {
    const { A, B } = pair();
    backspace(A, 1);
    expect(view(B)).toEqual([
      {
        "cajon:1.1": "B",
        chords: "Am F       C   G  F    C      G     Am",
        words: "Ти святий, ГосподьТвоє світло серед ночі",
        lanes: "chords+words",
      },
    ]);
  });

  it("Backspace на початку рядка акордів і Enter в акордах нічого не роблять", () => {
    const { A, B } = pair();
    const before = view(B);
    backspace(A, 1, 0);
    Transforms.select(A.editor, { path: [1, 0, 0], offset: 2 });
    Editor.insertBreak(A.editor);
    flush(A);
    expect(view(B)).toEqual(before);
  });
});

describe("порожній рядок, /примітка, видалення кількох рядків", () => {
  it("що є відрізком, визначає вміст рядка", () => {
    const { A } = makePair(
      [line("Слова"), line("", "Am  G"), line(""), line("/Приспів"), line("/ x2 ", "C")] as unknown as Segment[],
      { extend: (p) => withTextLanes(p.editor) },
    );
    expect([0, 1, 2, 3, 4].map((i) => lineKind(A.editor, i))).toEqual(["segment", "segment", "empty", "note", "note"]);
  });

  it("Enter у кінці рядка дає порожній рядок — не відрізок; дописали «/Міст» — примітка; стерли «/» — відрізок", () => {
    const { A, B } = pair();
    enter(A, 1, 22);
    expect(lineKind(B.editor, 2)).toBe("empty");
    type(A, 2, "words", 0, "/Міст");
    expect(lineKind(B.editor, 2)).toBe("note");
    Transforms.delete(A.editor, { at: { path: [2, 1, 0], offset: 0 }, distance: 1 });
    flush(A);
    expect(lineKind(B.editor, 2)).toBe("segment");
  });

  it("виділили від середини слів #0 до середини слів #1 і стерли — як у звичайному тексті", () => {
    const { A, B } = pair();
    Transforms.select(A.editor, { anchor: { path: [0, 1, 0], offset: 3 }, focus: { path: [1, 1, 0], offset: 5 } });
    Editor.deleteFragment(A.editor);
    flush(A);
    expect(view(B)).toEqual([
      { "cajon:1.1": "B", chords: "Am F       C   G", words: "Ти світло серед ночі", lanes: "chords+words" },
    ]);
  });
});

describe("сховане не стирається («що бачу, те й правлю»)", () => {
  const only = (p: Peer, lane: "chords" | "words") => {
    (p.editor as unknown as { laneEditable: (ln: number, l: string) => boolean }).laneEditable = (_ln, l) => l === lane;
  };

  it("бачу лише слова: виділив від слів #0 до слів #1 і стер — акорди #1 цілі й переїхали в склеєний рядок", () => {
    const { A, B } = pair();
    only(A, "words");
    Transforms.select(A.editor, { anchor: { path: [0, 1, 0], offset: 3 }, focus: { path: [1, 1, 0], offset: 5 } });
    Editor.deleteFragment(A.editor);
    flush(A);
    expect(view(B)).toEqual([
      {
        "cajon:1.1": "B",
        chords: "Am F       C   G F    C      G     Am",
        words: "Ти світло серед ночі",
        lanes: "chords+words",
      },
    ]);
  });

  it("бачу лише акорди: виділив від акордів #0 до акордів #1 і стер — слова цілі, рядки не склеюються", () => {
    const { A, B } = pair();
    only(A, "chords");
    Transforms.select(A.editor, { anchor: { path: [0, 0, 0], offset: 3 }, focus: { path: [1, 0, 0], offset: 5 } });
    Editor.deleteFragment(A.editor);
    flush(A);
    expect(view(B).map((s) => [s.chords, s.words])).toEqual([
      ["Am ", "Ти святий, Господь"],
      ["C      G     Am", "Твоє світло серед ночі"],
    ]);
  });
});

describe("конкурентно (A і B без мережі, потім зустрічаються)", () => {
  it("A ділить слова, B пише в хвіст слів — набране B опиняється в кінці першої частини", () => {
    const net = pair();
    net.unlink();
    enter(net.A, 0, 11);
    type(net.B, 0, "words", 14, "Х"); // «Гос|Хподь»
    net.link();
    expect(view(net.A).slice(0, 2).map((s) => s.words)).toEqual(["Ти святий, Х", "Господь"]);
    expect(view(net.A)).toEqual(view(net.B));
  });

  it("A ділить слова, B правит рядок акордів того ж відрізка — акорди лишаються першій частині, правка B ціла", () => {
    const net = pair();
    net.unlink();
    enter(net.A, 0, 11);
    type(net.B, 0, "chords", 16, " D");
    net.link();
    expect(view(net.A).slice(0, 2).map((s) => s.chords)).toEqual(["Am F       C   G D", ""]);
  });

  it("A і B одночасно тиснуть Enter в одному рядку — хвіст слів ЗАДВОЮЄТЬСЯ", () => {
    // Кожен копіює хвіст у свій новий відрізок (split = копія + видалення);
    // видалення з оригіналу зливаються, а дві копії — ні.
    const net = pair();
    net.unlink();
    enter(net.A, 0, 11);
    enter(net.B, 0, 11);
    net.link();
    expect(view(net.A)).toEqual(view(net.B));
    expect(view(net.A).map((s) => `${s.lanes}|${s.words}`)).toEqual([
      "chords+words|Ти святий, ",
      "chords+words|Господь",
      "chords+words|Господь",
      "chords+words|Твоє світло серед ночі",
    ]);
  });

  it("A зливає #1 у #0, B пише в слова #1 — набране B ЗНИКАЄ", () => {
    const net = pair();
    net.unlink();
    backspace(net.A, 1);
    type(net.B, 1, "words", 4, " ясне");
    net.link();
    expect(view(net.A)).toEqual(view(net.B));
    expect(view(net.A).map((s) => s.words)).toEqual(["Ти святий, ГосподьТвоє світло серед ночі"]);
  });

  it("A зливає #1 у #0, B пише в акорди #1 — правка B теж зникає", () => {
    const net = pair();
    net.unlink();
    backspace(net.A, 1);
    type(net.B, 1, "chords", 0, "Dm ");
    net.link();
    expect(view(net.A)[0].chords).toEqual("Am F       C   G  F    C      G     Am");
  });

  it("A видаляє відрізок, B у ньому пише — видалення перемагає", () => {
    const net = pair();
    net.unlink();
    removeSegment(net.A, 1);
    type(net.B, 1, "words", 0, "О, ");
    net.link();
    expect(view(net.A).map((s) => s.words)).toEqual(["Ти святий, Господь"]);
  });

  it("правка слів не рухає акорди: дописали на початку — слова зʼїхали під акордами", () => {
    const { A, B } = pair();
    type(A, 0, "words", 0, "О, ");
    expect(view(B)[0]).toMatchObject({ chords: "Am F       C   G", words: "О, Ти святий, Господь" });
  });
});
