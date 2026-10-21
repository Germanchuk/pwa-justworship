/**
 * Правила рядка (ADR-0006/0007) — через видиме дерево, як у користувача.
 * Два учасники на двох копіях моделі в Yjs. `expect` фіксує те, ЩО Є.
 */
import { describe, expect, it } from "vitest";
import { Editor, Transforms } from "slate";
import { change } from "./harness";
import { LaneView } from "../bridge/laneView";
import { layout, lineKind, removeLine } from "../model";
import { at, CHORDS, doc, rows, setup, WORDS, deleteSelection, confirmed } from "./testKit";

const SONG = [
  //       0123456789012345678
  { words: "Ти святий, Господь", chords: "Am F       C   G", dynamics: "calm" as const },
  { words: "Твоє світло серед ночі", chords: "F    C      G     Am" },
];

// З показом «усе» у відрізку доріжки у видимому: 0 — акорди, 1 — слова.
const enter = (h: LaneView, ln: number, offset: number) => {
  at(h, ln, 1, offset);
  Editor.insertBreak(h.view);
};
const backspace = (h: LaneView, ln: number, lane = 1) => {
  at(h, ln, lane, 0);
  Editor.deleteBackward(h.view);
  confirmed(h); // склеювання двох непорожніх — з підтвердженням (SONG-92)
};
const type = (h: LaneView, ln: number, lane: number, offset: number, text: string) => {
  at(h, ln, lane, offset);
  Editor.insertText(h.view, text);
};

describe("Enter і Backspace", () => {
  it("Enter посеред слів: перша частина отримує все, друга — порожні доріжки", () => {
    const { net, A } = setup(SONG);
    enter(A, 0, 11);
    expect(rows(net.B).slice(0, 2)).toEqual([
      { chords: "Am F       C   G", words: "Ти святий, ", dynamics: "calm" as const },
      { chords: "", words: "Господь", dynamics: "calm" },
    ]);
  });

  it("Enter → Backspace повертає рівно те, що було", () => {
    const { net, A } = setup(SONG);
    const before = rows(net.B);
    enter(A, 0, 11);
    backspace(A, 1);
    expect(rows(net.B)).toEqual(before);
  });

  it("злиття з непорожніми акордами другого: дописуються вирівняними під кінець слів першого", () => {
    const { net, A } = setup(SONG);
    backspace(A, 1);
    expect(rows(net.B)).toEqual([
      {
        chords: "Am F       C   G  F    C      G     Am",
        words: "Ти святий, ГосподьТвоє світло серед ночі",
        dynamics: "calm" as const,
      },
    ]);
  });

  it("Backspace на початку рядка акордів і Enter в акордах нічого не роблять", () => {
    const { net, A } = setup(SONG);
    const before = doc(net.B);
    backspace(A, 1, 0);
    at(A, 1, 0, 2);
    Editor.insertBreak(A.view);
    expect(doc(net.B)).toEqual(before);
  });
});

describe("порожній рядок, /примітка, видалення кількох рядків", () => {
  it("що є відрізком, визначає вміст рядка", () => {
    const { net } = setup([
      { words: "Слова" },
      { words: "", chords: "Am  G" },
      { words: "" },
      { words: "/Приспів" },
      { words: "/ x2 ", chords: "C" },
    ]);
    expect(layout(net.A).map(lineKind)).toEqual(["segment", "segment", "empty", "note", "note"]);
  });

  it("Enter у кінці рядка дає порожній рядок — не відрізок; дописали «/Міст» — примітка; стерли «/» — відрізок", () => {
    const { net, A } = setup(SONG);
    enter(A, 1, 22);
    expect(lineKind(layout(net.B)[2])).toBe("empty");
    type(A, 2, 0, 0, "/Міст"); // у порожнього рядка у видимому одна доріжка — слова
    expect(lineKind(layout(net.B)[2])).toBe("note");
    Transforms.delete(A.view, { at: { path: [2, 0, 0], offset: 0 }, distance: 1 });
    expect(lineKind(layout(net.B)[2])).toBe("segment");
  });

  it("виділили від середини слів #0 до середини слів #1 і стерли — як у звичайному тексті", () => {
    const { net, A } = setup(SONG);
    Transforms.select(A.view, { anchor: { path: [0, 1, 0], offset: 3 }, focus: { path: [1, 1, 0], offset: 5 } });
    deleteSelection(A);
    expect(rows(net.B)).toEqual([{ chords: "Am F       C   G", words: "Ти світло серед ночі", dynamics: "calm" as const }]);
  });
});

describe("сховане не стирається («що бачу, те й правлю»)", () => {
  it("бачу лише слова: виділив від слів #0 до слів #1 і стер — акорди #1 цілі й переїхали в склеєний рядок", () => {
    const { net, A } = setup(SONG, WORDS);
    Transforms.select(A.view, { anchor: { path: [0, 0, 0], offset: 3 }, focus: { path: [1, 0, 0], offset: 5 } });
    deleteSelection(A);
    expect(rows(net.B)).toEqual([
      { chords: "Am F       C   G F    C      G     Am", words: "Ти світло серед ночі", dynamics: "calm" as const },
    ]);
  });

  it("бачу лише акорди: виділив від акордів #0 до акордів #1 і стер — слова цілі, рядки не склеюються", () => {
    const { net, A } = setup(SONG, CHORDS);
    Transforms.select(A.view, { anchor: { path: [0, 0, 0], offset: 3 }, focus: { path: [1, 0, 0], offset: 5 } });
    deleteSelection(A);
    expect(doc(net.B)).toEqual(["Am  / Ти святий, Господь", "C      G     Am / Твоє світло серед ночі"]);
  });
});

describe("конкурентно (A і B без мережі, потім зустрічаються)", () => {
  it("A ділить слова, B пише в хвіст слів — набране B лишається там, де він писав (у другій частині)", () => {
    const { net, A, B } = setup(SONG);
    net.unlink();
    enter(A, 0, 11);
    type(B, 0, 1, 14, "Х"); // «Гос|Хподь»
    net.link();
    expect(doc(net.A).slice(0, 2)).toEqual(["Am F       C   G / Ти святий, ", " / ГосХподь"]);
    expect(doc(net.A)).toEqual(doc(net.B));
  });

  it("A ділить слова, B править рядок акордів того ж рядка — акорди лишаються першій частині, правка B ціла", () => {
    const { net, A, B } = setup(SONG);
    net.unlink();
    enter(A, 0, 11);
    type(B, 0, 0, 16, " D");
    net.link();
    expect(doc(net.A).slice(0, 2)).toEqual(["Am F       C   G D / Ти святий, ", " / Господь"]);
  });

  it("A і B одночасно тиснуть Enter в одному місці — хвіст не задвоюється, між частинами порожній рядок", () => {
    // Кожен вставив свій маркер у те саме місце; слова не копіювались.
    const { net, A, B } = setup(SONG);
    net.unlink();
    enter(A, 0, 11);
    enter(B, 0, 11);
    net.link();
    expect(doc(net.A)).toEqual(doc(net.B));
    expect(doc(net.A).map((l) => l.split(" / ")[1])).toEqual(["Ти святий, ", "", "Господь", "Твоє світло серед ночі"]);
  });

  it("A і B одночасно тиснуть Enter у різних місцях одного рядка — три рядки, нічого не задвоєно", () => {
    const { net, A, B } = setup(SONG);
    net.unlink();
    enter(A, 0, 3);
    enter(B, 0, 11);
    net.link();
    expect(doc(net.A)).toEqual(doc(net.B));
    expect(doc(net.A).map((l) => l.split(" / ")[1])).toEqual(["Ти ", "святий, ", "Господь", "Твоє світло серед ночі"]);
  });

  it("A зливає #1 у #0, B пише в слова #1 — набране B лишається в склеєному рядку", () => {
    const { net, A, B } = setup(SONG);
    net.unlink();
    backspace(A, 1);
    type(B, 1, 1, 4, " ясне");
    net.link();
    expect(doc(net.A)).toEqual(doc(net.B));
    expect(doc(net.A).map((l) => l.split(" / ")[1])).toEqual(["Ти святий, ГосподьТвоє ясне світло серед ночі"]);
  });

  it("A зливає #1 у #0, B пише в акорди #1 — правка B ЗНИКАЄ (акорди при склеюванні копіюються)", () => {
    const { net, A, B } = setup(SONG);
    net.unlink();
    backspace(A, 1);
    type(B, 1, 0, 0, "Dm ");
    net.link();
    expect(rows(net.A)[0].chords).toEqual("Am F       C   G  F    C      G     Am");
  });

  it("A і B одночасно склеюють #1 з #0 — слова не задвоюються, а непорожні акорди #1 ЗАДВОЮЮТЬСЯ", () => {
    const { net, A, B } = setup(SONG);
    net.unlink();
    backspace(A, 1);
    backspace(B, 1);
    net.link();
    expect(doc(net.A)).toEqual(doc(net.B));
    expect(rows(net.A)).toHaveLength(1);
    expect(rows(net.A)[0].words).toBe("Ti святий, ГосподьТвоє світло серед ночі".replace("Ti", "Ти"));
    expect(rows(net.A)[0].chords.match(/Am/g)).toHaveLength(3); // Am з #0 і двічі з #1
  });

  it("A ділить #1, B у цей час склеює #1 з #0 — нічого не загублено й не задвоєно", () => {
    const { net, A, B } = setup(SONG);
    net.unlink();
    enter(A, 1, 5); // «Твоє |світло серед ночі»
    backspace(B, 1);
    net.link();
    expect(doc(net.A)).toEqual(doc(net.B));
    expect(doc(net.A).map((l) => l.split(" / ")[1])).toEqual(["Ти святий, ГосподьТвоє ", "світло серед ночі"]);
  });

  it("A видаляє рядок, B у ньому пише — рядок зникає, а набране B лишається в кінці попереднього", () => {
    const { net, B } = setup(SONG);
    net.unlink();
    change(net.A, () => removeLine(net.A, 1));
    type(B, 1, 1, 0, "О, ");
    net.link();
    expect(doc(net.A)).toEqual(doc(net.B));
    expect(doc(net.A).map((l) => l.split(" / ")[1])).toEqual(["Ти святий, ГосподьО, "]);
  });

  it("правка слів не рухає акорди: дописали на початку — слова зʼїхали під акордами", () => {
    const { net, A } = setup(SONG);
    type(A, 0, 1, 0, "О, ");
    expect(doc(net.B)[0]).toBe("Am F       C   G / О, Ти святий, Господь");
  });
});
