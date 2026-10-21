/**
 * Мідлвер «видиме дерево ↔ модель пісні» (ADR-0007): два учасники на двох
 * копіях моделі в Yjs, у кожного своє видиме дерево — лише вибрані доріжки.
 * `expect` фіксує те, ЩО Є.
 */
import { describe, expect, it } from "vitest";
import { Editor, Transforms } from "slate";
import { change } from "./harness";
import { linesOf, paintDynamics, removeLine } from "../model";
import { LaneDisplay } from "../bridge/laneView";
import { selectedText } from "../bridge/clipboard";
import { ALL, at, CHORDS, doc, NONE, setup as setupWith, shown, WORDS, deleteSelection } from "./testKit";

const SONG = [
  { words: "/Куплет" },
  //       0123456789012345678
  { words: "Ти святий, Господь", chords: "Am F       C   G" },
  { words: "Твоє світло серед ночі", chords: "F    C      G     Am" },
  { words: "" },
  { words: "Алилуя", chords: "F G" },
];

const setup = (a: LaneDisplay, b: LaneDisplay) => setupWith(SONG, a, b);

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
    deleteSelection(A);
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

describe("вставка з буфера й захист від правок в обхід команд", () => {
  const clipboard = (text: string) => ({ getData: (t: string) => (t === "text/plain" ? text : "") }) as DataTransfer;

  it("кілька рядків у словах стають рядками; «/Міст» на новому порожньому рядку — примітка", () => {
    const { net, A } = setup(WORDS, ALL);
    at(A, 2, 0, 22);
    A.view.insertData(clipboard("\n/Міст\nНовий рядок"));
    expect(doc(net.B).slice(2, 5)).toEqual([
      "F    C      G     Am / Твоє світло серед ночі",
      " / /Міст",
      " / Новий рядок",
    ]);
    expect(A.view.selection?.anchor).toEqual({ path: [4, 0, 0], offset: 11 });
  });

  it("скопійований рядок «акорди + слова» вставляється в порожній рядок як акорди і слова", () => {
    const { net, A } = setup(ALL, ALL);
    at(A, 3, 0, 0);
    A.view.insertData(clipboard("Am F               C       G\nТи святий, Господь"));
    expect(doc(net.B)[3]).toBe("Am F               C       G / Ти святий, Господь");
  });

  it("копіювання двох доріжок рядка → вставка в інше місце: акорди лягають в акорди", () => {
    const { net, A } = setup(ALL, ALL);
    Transforms.select(A.view, { anchor: { path: [1, 0, 0], offset: 0 }, focus: { path: [1, 1, 0], offset: 18 } });
    const copied = selectedText(A.view);
    expect(copied).toBe("Am F       C   G\nТи святий, Господь");
    at(A, 3, 0, 0);
    A.view.insertData(clipboard(copied!));
    expect(doc(net.B)[3]).toBe("Am F       C   G / Ти святий, Господь");
  });

  it("кілька пар, рядок самих акордів і такти — кожне на своє місце", () => {
    const { net, A } = setup(ALL, ALL);
    at(A, 3, 0, 0);
    A.view.insertData(clipboard("| Am . | F . |\n\nC   G\nСлава\nD/F# G"));
    expect(doc(net.B).slice(3, 7)).toEqual(["| Am . | F . | / ", " / ", "C   G / Слава", "D/F# G / "]);
  });

  it("в акорди кілька рядків вставляються одним рядком через пробіл", () => {
    const { net, A } = setup(CHORDS, ALL);
    at(A, 1, 0, 0);
    A.view.insertData(clipboard("Dm\nC "));
    expect(doc(net.B)[1]).toBe("Dm C Am F       C   G / Ти святий, Господь");
  });

  it("структурна операція в обхід команд не потрапляє в документ — видиме відкочується", async () => {
    const { net, A } = setup(ALL, ALL);
    const before = doc(net.A);
    const warn = console.warn;
    console.warn = () => {};
    try {
      Transforms.removeNodes(A.view, { at: [1] });
      await new Promise((r) => setTimeout(r, 0));
    } finally {
      console.warn = warn;
    }
    expect(doc(net.A)).toEqual(before);
    expect(shown(A)[1]).toBe("c:Am F       C   G | w:Ти святий, Господь");
  });
});

describe("зміни моделі в обхід видимого", () => {
  it("видалили рядок прямо в моделі — видиме підтягується одразу (подія Yjs)", () => {
    const { net, A } = setup(WORDS, ALL);
    change(net.A, () => removeLine(net.A, 1));
    expect(shown(A)).toEqual(["w:/Куплет", "w:Твоє світло серед ночі", "w:", "w:Алилуя"]);
  });

  it("пофарбували рядок у моделі — видиме дерево не перебудовується (динаміка не в дереві Slate)", () => {
    const { net, A } = setup(ALL, ALL);
    const before = A.view.children;
    change(net.A, () => paintDynamics(net.A, [linesOf(net.A)[1]], "loud"));
    expect(A.view.children).toBe(before);
  });
});
