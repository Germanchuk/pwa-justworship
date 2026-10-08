/**
 * PROTOTYPE (гілка `prototype/segments-lanes`) — ітерація 2.
 *
 * Відрізок = `{ type: "segment", ...атрибути, children: [chords, words] }`.
 * Акорди й слова — дві текстові доріжки з курсором; акорди НЕ привʼязані
 * до букв слів (фідбек Германа 2026-10-09). Атрибути відрізка: `dyn`,
 * `heading`, `cajon:<такт>.<доля>`.
 *
 * Правила (Герман): Enter у словах — новий відрізок; перша частина отримує
 * все, друга — порожні доріжки. Злиття (Backspace на початку слів) —
 * дзеркально: лишається все від першого, непорожній рядок акордів другого
 * дописується вирівняним під кінець слів першого.
 */
import { Editor, Element, Node, Path, Point, Range, Transforms } from "slate";

export type LaneType = "chords" | "words";

export function segment(words: string, chords = "", props: Record<string, unknown> = {}) {
  return {
    type: "segment",
    ...props,
    children: [
      { type: "chords", children: [{ text: chords }] },
      { type: "words", children: [{ text: words }] },
    ],
  };
}

const typeOf = (n: unknown) => (n as { type?: string }).type;

export function lanePath(editor: Editor, seg: number, lane: LaneType): Path {
  const node = editor.children[seg] as Element;
  return [seg, node.children.findIndex((c) => typeOf(c) === lane)];
}

export function laneText(editor: Editor, seg: number, lane: LaneType) {
  const path = lanePath(editor, seg, lane);
  return path[1] < 0 ? "" : Node.string(Node.get(editor, path));
}

export function laneAt(editor: Editor, point: Point) {
  const [seg, l] = point.path;
  return { seg, lane: typeOf(Node.get(editor, [seg, l])) as LaneType };
}

const crossesLanes = (r: Range) => !Path.equals(r.anchor.path.slice(0, 2), r.focus.path.slice(0, 2));

export function splitSegment(editor: Editor, at: Point) {
  const s = at.path[0];
  Editor.withoutNormalizing(editor, () => {
    // Ріже текст → слова → відрізок; рядок акордів (він перед словами) лишається першому.
    Transforms.splitNodes(editor, { at, match: (n) => typeOf(n) === "segment", always: true });
    Transforms.insertNodes(editor, { type: "chords", children: [{ text: "" }] } as unknown as Node, {
      at: [s + 1, 0],
    });
  });
  Transforms.select(editor, { path: [s + 1, 1, 0], offset: 0 });
}

export function mergeSegment(editor: Editor, s: number) {
  const wordsLen = laneText(editor, s - 1, "words").length;
  Editor.withoutNormalizing(editor, () => {
    const tail = laneText(editor, s, "chords");
    if (tail.trim()) {
      const prev = laneText(editor, s - 1, "chords");
      const pad = prev.length < wordsLen ? " ".repeat(wordsLen - prev.length) : prev.length ? " " : "";
      Transforms.insertText(editor, pad + tail, { at: Editor.end(editor, lanePath(editor, s - 1, "chords")) });
    }
    Transforms.removeNodes(editor, { at: lanePath(editor, s, "chords") });
    // [s] = [words]; вливаємо відрізок у попередній, потім слова — у слова.
    Transforms.mergeNodes(editor, { at: [s] });
    const n = (editor.children[s - 1] as Element).children.length;
    Transforms.mergeNodes(editor, { at: [s - 1, n - 1] });
  });
  Transforms.select(editor, { path: [s - 1, 1, 0], offset: wordsLen });
}

export function withTextLanes<E extends Editor>(editor: E): E {
  const { apply, insertBreak, deleteBackward, deleteForward, deleteFragment } = editor;

  // «Друга частина — нічого»: новий відрізок не успадковує атрибутів.
  editor.apply = (op) => {
    if (op.type === "split_node" && op.path.length === 1) {
      return apply({ ...op, properties: { type: "segment" } as Partial<Node> });
    }
    apply(op);
  };

  editor.insertBreak = () => {
    const sel = editor.selection;
    if (!sel || crossesLanes(sel)) return;
    if (!Range.isCollapsed(sel)) Transforms.delete(editor);
    const at = editor.selection!.anchor;
    if (laneAt(editor, at).lane !== "words") return; // в акордах Enter немає
    splitSegment(editor, at);
  };
  void insertBreak;

  editor.deleteBackward = (unit) => {
    const sel = editor.selection;
    if (sel && Range.isCollapsed(sel) && Point.equals(sel.anchor, Editor.start(editor, sel.anchor.path.slice(0, 2)))) {
      const { seg, lane } = laneAt(editor, sel.anchor);
      if (lane === "words" && seg > 0) mergeSegment(editor, seg);
      return; // початок рядка акордів — нічого
    }
    deleteBackward(unit);
  };

  editor.deleteForward = (unit) => {
    const sel = editor.selection;
    if (sel && Range.isCollapsed(sel) && Point.equals(sel.anchor, Editor.end(editor, sel.anchor.path.slice(0, 2)))) return;
    deleteForward(unit);
  };

  // Виділення через кілька доріжок/відрізків не видаляємо (прототип).
  editor.deleteFragment = (dir) => {
    if (editor.selection && crossesLanes(editor.selection)) return;
    deleteFragment(dir);
  };

  return editor;
}
