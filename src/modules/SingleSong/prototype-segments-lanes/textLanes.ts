/**
 * PROTOTYPE (гілка `prototype/segments-lanes`) — ітерація 3.
 *
 * Документ — ряд рядків `{ type: "line", ...атрибути, children: [chords, words] }`.
 * Акорди й слова — дві текстові доріжки з курсором; акорди НЕ привʼязані
 * до букв слів. Атрибути рядка: лише `cajon:<такт>.<доля>`.
 *
 * Чим є рядок, визначає його вміст (Герман, 2026-10-09):
 *  - порожній (і слова, і акорди) — ще не відрізок;
 *  - слова починаються з `/` — структурна примітка, не відрізок;
 *  - решта — відрізок.
 *
 * Enter у словах — новий рядок: перша частина отримує все, друга — порожні
 * доріжки. Злиття (Backspace на початку слів) — дзеркально: лишається все
 * від першого, непорожні акорди другого дописуються вирівняними під кінець
 * слів першого.
 */
import { Editor, Element, Node, Path, Point, Range, Transforms } from "slate";

export type LaneType = "chords" | "words";
export type LineKind = "segment" | "empty" | "note";

export function line(words: string, chords = "", props: Record<string, unknown> = {}) {
  return {
    type: "line",
    ...props,
    children: [
      { type: "chords", children: [{ text: chords }] },
      { type: "words", children: [{ text: words }] },
    ],
  };
}

const typeOf = (n: unknown) => (n as { type?: string }).type;

export function lanePath(editor: Editor, ln: number, lane: LaneType): Path {
  const node = editor.children[ln] as Element;
  return [ln, node.children.findIndex((c) => typeOf(c) === lane)];
}

export function laneText(editor: Editor, ln: number, lane: LaneType) {
  const path = lanePath(editor, ln, lane);
  return path[1] < 0 ? "" : Node.string(Node.get(editor, path));
}

export function lineKind(editor: Editor, ln: number): LineKind {
  const words = laneText(editor, ln, "words");
  if (words.startsWith("/")) return "note";
  if (!words && !laneText(editor, ln, "chords")) return "empty";
  return "segment";
}

export function laneAt(editor: Editor, point: Point) {
  const [ln, l] = point.path;
  return { line: ln, lane: typeOf(Node.get(editor, [ln, l])) as LaneType };
}

export function splitLine(editor: Editor, at: Point) {
  const ln = at.path[0];
  Editor.withoutNormalizing(editor, () => {
    // Ріже текст → слова → рядок; рядок акордів (він перед словами) лишається першому.
    Transforms.splitNodes(editor, { at, match: (n) => typeOf(n) === "line", always: true });
    Transforms.insertNodes(editor, { type: "chords", children: [{ text: "" }] } as unknown as Node, {
      at: [ln + 1, 0],
    });
  });
  Transforms.select(editor, { path: [ln + 1, 1, 0], offset: 0 });
}

export function mergeLine(editor: Editor, ln: number) {
  const wordsLen = laneText(editor, ln - 1, "words").length;
  Editor.withoutNormalizing(editor, () => {
    const tail = laneText(editor, ln, "chords");
    if (tail.trim()) {
      const prev = laneText(editor, ln - 1, "chords");
      const pad = prev.length < wordsLen ? " ".repeat(wordsLen - prev.length) : prev.length ? " " : "";
      Transforms.insertText(editor, pad + tail, { at: Editor.end(editor, lanePath(editor, ln - 1, "chords")) });
    }
    Transforms.removeNodes(editor, { at: lanePath(editor, ln, "chords") });
    // [ln] = [words]; вливаємо рядок у попередній, потім слова — у слова.
    Transforms.mergeNodes(editor, { at: [ln] });
    const n = (editor.children[ln - 1] as Element).children.length;
    Transforms.mergeNodes(editor, { at: [ln - 1, n - 1] });
  });
  Transforms.select(editor, { path: [ln - 1, 1, 0], offset: wordsLen });
}

/** Стерти шматок однієї доріжки (точки в одному текстовому вузлі). */
function eraseInLane(editor: Editor, from: Point, to: Point) {
  if (!Point.equals(from, to)) Transforms.delete(editor, { at: { anchor: from, focus: to } });
  return true;
}

/**
 * Виділення через кілька рядків: як у звичайному тексті — хвіст першого
 * рядка й голова останнього стираються, рядки між ними зникають, а якщо
 * обидва кінці в словах — останній рядок вливається в перший.
 * У межах одного рядка (акорди → слова) — лише стираємо обидва шматки.
 */
/** Чи може цей учасник правити доріжку (особиста видимість). Ставить сторінка. */
export type LaneEditable = (ln: number, lane: LaneType) => boolean;
const editableOf = (editor: Editor): LaneEditable =>
  (editor as unknown as { laneEditable?: LaneEditable }).laneEditable ?? (() => true);

function deleteAcross(editor: Editor, range: Range) {
  const [start, end] = Range.edges(range);
  const a = start.path[0];
  const b = end.path[0];
  const startLane = laneAt(editor, start).lane;
  const endLane = laneAt(editor, end).lane;
  const can = editableOf(editor);
  const laneOfPath = (ln: number, l: number) => typeOf(Node.get(editor, [ln, l])) as LaneType;
  const ok = (ln: number, l: number) => can(ln, laneOfPath(ln, l));
  // Сховане не стираємо: «що бачу, те й правлю».
  const erase = (ln: number, l: number, from: Point, to: Point) => ok(ln, l) && eraseInLane(editor, from, to);
  const eraseLane = (ln: number, l: number) => erase(ln, l, Editor.start(editor, [ln, l]), Editor.end(editor, [ln, l]));
  let merge = a !== b && startLane === "words" && endLane === "words" && can(a, "words") && can(b, "words");
  Editor.withoutNormalizing(editor, () => {
    erase(b, end.path[1], Editor.start(editor, end.path.slice(0, 2)), end);
    for (let l = 0; l < end.path[1]; l++) if (a !== b || l > start.path[1]) eraseLane(b, l);
    if (a === b) {
      erase(a, start.path[1], start, Editor.end(editor, start.path.slice(0, 2)));
      return;
    }
    for (let i = b - 1; i > a; i--) {
      const lanes = (editor.children[i] as Element).children;
      // Рядок зникає, лише якщо в ньому немає схованого вмісту.
      if (lanes.every((c, l) => ok(i, l) || !Node.string(c))) Transforms.removeNodes(editor, { at: [i] });
      else {
        lanes.forEach((_, l) => eraseLane(i, l));
        merge = false;
      }
    }
    const lanes = (editor.children[a] as Element).children.length;
    for (let l = start.path[1] + 1; l < lanes; l++) eraseLane(a, l);
    erase(a, start.path[1], start, Editor.end(editor, start.path.slice(0, 2)));
  });
  if (merge) {
    Transforms.select(editor, Editor.start(editor, lanePath(editor, a + 1, "words")));
    mergeLine(editor, a + 1);
  } else {
    Transforms.select(editor, start);
  }
}

/**
 * Правило Германа (2026-10-10): `/` на початку слів (тобто структурну
 * примітку) можна надрукувати лише в порожньому рядку. Рядок із вмістом
 * приміткою не стає, і перед `/` примітки нічого не вставити. Деінде `/`
 * звичайний символ (`D/F#` в акордах, «і/або» в словах).
 */
export function slashAllowed(editor: Editor, at: Point, text: string) {
  const { line: ln, lane } = laneAt(editor, at);
  if (lane !== "words" || at.offset !== 0) return true;
  if (laneText(editor, ln, "words").startsWith("/")) return false;
  return !text.startsWith("/") || lineKind(editor, ln) === "empty";
}

export function withTextLanes<E extends Editor>(editor: E): E {
  const { apply, deleteBackward, deleteForward, deleteFragment, insertText } = editor;

  editor.insertText = (text, options) => {
    const at = editor.selection && Range.isCollapsed(editor.selection) ? editor.selection.anchor : null;
    if (at && !slashAllowed(editor, at, text)) return;
    insertText(text, options);
  };

  // «Друга частина — нічого»: новий рядок не успадковує атрибутів.
  editor.apply = (op) => {
    if (op.type === "split_node" && op.path.length === 1) {
      return apply({ ...op, properties: { type: "line" } as Partial<Node> });
    }
    apply(op);
  };

  editor.insertBreak = () => {
    const sel = editor.selection;
    if (!sel) return;
    if (!Range.isCollapsed(sel)) editor.deleteFragment();
    const at = editor.selection!.anchor;
    if (laneAt(editor, at).lane !== "words") return; // в акордах Enter немає
    splitLine(editor, at);
  };

  editor.deleteBackward = (unit) => {
    const sel = editor.selection;
    if (sel && Range.isCollapsed(sel) && Point.equals(sel.anchor, Editor.start(editor, sel.anchor.path.slice(0, 2)))) {
      const { line: ln, lane } = laneAt(editor, sel.anchor);
      if (lane === "words" && ln > 0) mergeLine(editor, ln);
      return; // початок рядка акордів — нічого
    }
    deleteBackward(unit);
  };

  editor.deleteForward = (unit) => {
    const sel = editor.selection;
    if (sel && Range.isCollapsed(sel) && Point.equals(sel.anchor, Editor.end(editor, sel.anchor.path.slice(0, 2)))) {
      const { line: ln, lane } = laneAt(editor, sel.anchor);
      if (lane === "words" && ln < editor.children.length - 1) {
        Transforms.select(editor, Editor.start(editor, lanePath(editor, ln + 1, "words")));
        mergeLine(editor, ln + 1);
      }
      return;
    }
    deleteForward(unit);
  };

  editor.deleteFragment = (dir) => {
    const sel = editor.selection;
    if (sel && !Path.equals(sel.anchor.path.slice(0, 2), sel.focus.path.slice(0, 2))) return deleteAcross(editor, sel);
    deleteFragment(dir);
  };

  return editor;
}
