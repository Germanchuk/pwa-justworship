/**
 * Рядок пісні з доріжками — схема документа й правила повного дерева.
 *
 * Документ — ряд рядків `{ type: "line", ...атрибути, children: [chords, words] }`.
 * Акорди й слова — текстові доріжки з курсором; акорди не прив'язані до букв
 * слів (вирівнюються пробілами). Атрибути рядка — клітинки кахону
 * (`cajon:<такт>.<доля>`).
 *
 * Чим є рядок, визначає вміст:
 *  - порожній (і слова, і акорди) — ще не відрізок;
 *  - слова починаються з `/` — структурна примітка;
 *  - решта — відрізок.
 *
 * Правила (ADR-0006, рішення Германа):
 *  - Enter є лише в словах і ділить рядок: перша частина отримує все, друга —
 *    порожні доріжки без атрибутів;
 *  - Backspace на початку слів склеює з попереднім рядком: лишається все від
 *    першого, непорожні акорди другого дописуються вирівняними під кінець слів;
 *  - доріжки не зливаються між собою (Backspace/Delete на межі доріжки);
 *  - `/` на початку слів можна надрукувати лише в порожньому рядку;
 *  - видалення виділення не стирає доріжок, які цей учасник не бачить
 *    (див. `setLaneAccess`).
 */
import { Editor, Element, Node, Path, Point, Range, Transforms } from "slate";

export type LaneType = "chords" | "words";
export type LineKind = "segment" | "empty" | "note";

/** Порядок доріжок у рядку. */
export const LANES: readonly LaneType[] = ["chords", "words"];

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

export const laneTypeOf = (node: Node) => (node as { type?: string }).type as LaneType;

export function lanePath(editor: Editor, ln: number, lane: LaneType): Path {
  return [ln, (editor.children[ln] as Element).children.findIndex((c) => laneTypeOf(c) === lane)];
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
  return { line: ln, lane: laneTypeOf(Node.get(editor, [ln, l])) };
}

/** Межі доріжки, в якій стоїть точка. */
const laneOfPoint = (point: Point): Path => point.path.slice(0, 2);
const atLaneStart = (editor: Editor, p: Point) => Point.equals(p, Editor.start(editor, laneOfPoint(p)));
const atLaneEnd = (editor: Editor, p: Point) => Point.equals(p, Editor.end(editor, laneOfPoint(p)));

// ── особиста видимість ─────────────────────────────────────────────────────

/** Чи може учасник правити доріжку рядка (бачить її). За замовчуванням — усе. */
export type LaneAccess = (ln: number, lane: LaneType) => boolean;
const ACCESS = new WeakMap<Editor, LaneAccess>();

export function setLaneAccess(editor: Editor, access: LaneAccess) {
  ACCESS.set(editor, access);
}

const canEdit = (editor: Editor, ln: number, lane: LaneType) => ACCESS.get(editor)?.(ln, lane) ?? true;

// ── правила ────────────────────────────────────────────────────────────────

/**
 * `/` на початку слів (структурна примітка) — лише в порожньому рядку; перед
 * `/` примітки нічого не вставити. Деінде `/` — звичайний символ (`D/F#`).
 */
export function slashAllowed(editor: Editor, at: Point, text: string) {
  const { line: ln, lane } = laneAt(editor, at);
  if (lane !== "words" || at.offset !== 0) return true;
  if (laneText(editor, ln, "words").startsWith("/")) return false;
  return !text.startsWith("/") || lineKind(editor, ln) === "empty";
}

export function splitLine(editor: Editor, at: Point) {
  const ln = at.path[0];
  Editor.withoutNormalizing(editor, () => {
    // Ріже текст → слова → рядок; рядок акордів стоїть перед словами й лишається першому.
    Transforms.splitNodes(editor, { at, match: (n) => (n as { type?: string }).type === "line", always: true });
    Transforms.insertNodes(editor, { type: "chords", children: [{ text: "" }] } as unknown as Node, { at: [ln + 1, 0] });
  });
  Transforms.select(editor, Editor.start(editor, lanePath(editor, ln + 1, "words")));
}

export function mergeLine(editor: Editor, ln: number) {
  const wordsLen = laneText(editor, ln - 1, "words").length;
  Editor.withoutNormalizing(editor, () => {
    const tail = laneText(editor, ln, "chords");
    if (tail.trim()) {
      const head = laneText(editor, ln - 1, "chords");
      const pad = head.length < wordsLen ? " ".repeat(wordsLen - head.length) : head ? " " : "";
      Transforms.insertText(editor, pad + tail, { at: Editor.end(editor, lanePath(editor, ln - 1, "chords")) });
    }
    Transforms.removeNodes(editor, { at: lanePath(editor, ln, "chords") });
    // [ln] = [words]: вливаємо рядок у попередній, потім слова — у слова.
    Transforms.mergeNodes(editor, { at: [ln] });
    Transforms.mergeNodes(editor, { at: [ln - 1, (editor.children[ln - 1] as Element).children.length - 1] });
  });
  Transforms.select(editor, { path: [...lanePath(editor, ln - 1, "words"), 0], offset: wordsLen });
}

/**
 * Видалення виділення через доріжки й рядки — як у звичайному тексті, у
 * порядку документа (слова рядка → акорди наступного → його слова…):
 * стирається все між кінцями, рядки між ними зникають, а якщо обидва кінці
 * в словах — останній рядок вливається в перший. Чого учасник не бачить, те
 * не стирається; рядок зі схованим вмістом не зникає й не склеюється.
 */
function deleteAcross(editor: Editor, range: Range) {
  const [start, end] = Range.edges(range);
  const a = start.path[0];
  const b = end.path[0];
  const lanesOf = (ln: number) => (editor.children[ln] as Element).children;
  const editable = (ln: number, l: number) => canEdit(editor, ln, laneTypeOf(lanesOf(ln)[l]));
  const erase = (from: Point, to: Point) => {
    const [ln, l] = from.path;
    if (!Point.equals(from, to) && editable(ln, l)) Transforms.delete(editor, { at: { anchor: from, focus: to } });
  };
  const eraseLane = (ln: number, l: number) => erase(Editor.start(editor, [ln, l]), Editor.end(editor, [ln, l]));
  let merge =
    a !== b && laneAt(editor, start).lane === "words" && laneAt(editor, end).lane === "words" &&
    canEdit(editor, a, "words") && canEdit(editor, b, "words");

  Editor.withoutNormalizing(editor, () => {
    // Від кінця до початку, щоб шляхи ще не стертого лишались чинними.
    erase(Editor.start(editor, laneOfPoint(end)), end);
    for (let l = a === b ? start.path[1] + 1 : 0; l < end.path[1]; l++) eraseLane(b, l);
    for (let ln = b - 1; ln > a; ln--) {
      const hidesContent = lanesOf(ln).some((lane, l) => !editable(ln, l) && Node.string(lane));
      if (!hidesContent) Transforms.removeNodes(editor, { at: [ln] });
      else {
        lanesOf(ln).forEach((_, l) => eraseLane(ln, l));
        merge = false;
      }
    }
    if (a !== b) for (let l = start.path[1] + 1; l < lanesOf(a).length; l++) eraseLane(a, l);
    erase(start, Editor.end(editor, laneOfPoint(start)));
  });

  if (merge) mergeLine(editor, a + 1);
  else Transforms.select(editor, start);
}

/** Простий текст, вставлений із буфера: у словах рядки стають рядками, в акордах — пробілами. */
export function insertPlainText(editor: Editor, text: string) {
  if (!editor.selection) return;
  const parts = text.split(/\r?\n/);
  if (laneAt(editor, Range.start(editor.selection)).lane === "chords") return Editor.insertText(editor, parts.join(" "));
  parts.forEach((part, i) => {
    if (i > 0) Editor.insertBreak(editor);
    if (part) Editor.insertText(editor, part);
  });
}

export function withTextLanes<E extends Editor>(editor: E): E {
  const { apply, insertText, deleteBackward, deleteForward, deleteFragment } = editor;

  // Друга частина рядка після Enter не успадковує атрибутів (Slate копіює всі).
  editor.apply = (op) => {
    if (op.type === "split_node" && op.path.length === 1) {
      return apply({ ...op, properties: { type: "line" } as Partial<Node> });
    }
    apply(op);
  };

  editor.insertText = (text, options) => {
    const sel = editor.selection;
    if (sel && Range.isCollapsed(sel) && !slashAllowed(editor, sel.anchor, text)) return;
    insertText(text, options);
  };

  editor.insertBreak = () => {
    if (!editor.selection) return;
    if (Range.isExpanded(editor.selection)) editor.deleteFragment();
    const at = editor.selection!.anchor;
    if (laneAt(editor, at).lane === "words") splitLine(editor, at); // в акордах Enter немає
  };

  editor.deleteBackward = (unit) => {
    const sel = editor.selection;
    if (!sel || Range.isExpanded(sel) || !atLaneStart(editor, sel.anchor)) return deleteBackward(unit);
    const { line: ln, lane } = laneAt(editor, sel.anchor);
    if (lane === "words" && ln > 0) mergeLine(editor, ln); // на початку акордів — нічого
  };

  editor.deleteForward = (unit) => {
    const sel = editor.selection;
    if (!sel || Range.isExpanded(sel) || !atLaneEnd(editor, sel.anchor)) return deleteForward(unit);
    const { line: ln, lane } = laneAt(editor, sel.anchor);
    if (lane === "words" && ln < editor.children.length - 1) mergeLine(editor, ln + 1);
  };

  editor.deleteFragment = (options) => {
    const sel = editor.selection;
    if (sel && !Path.equals(laneOfPoint(sel.anchor), laneOfPoint(sel.focus))) return deleteAcross(editor, sel);
    deleteFragment(options);
  };

  return editor;
}
