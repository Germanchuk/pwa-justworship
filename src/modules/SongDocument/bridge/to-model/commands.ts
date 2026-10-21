/**
 * Усе структурне — Enter, склеювання, видалення виділеного, вставка — правилами
 * моделі (`1-model/rules`), а не в Slate. Видиме лише покаже результат подією Yjs.
 */
import { Editor, Node, Range, Transforms } from "slate";
import {
  backspaceAtLaneStart,
  clearCells,
  deleteAtLaneEnd,
  deleteRange,
  insertPlainText,
  insertText,
  linesOf,
  Pos,
  slashAllowed,
  splitLine,
} from "../../model";
import type { Cells } from "../cells";
import type { History } from "../history";
import { toModel, toView } from "../positions";
import { isCellsNode, isShown, laneOfNode } from "../projection";
import { COMMAND, quietly, ViewState } from "../state";

export function installCommands(s: ViewState, history: History, cells: Cells) {
  const { song, view, undoManager } = s;
  const canEdit = (ln: number, lane: string) => isShown(s, ln, lane);

  /**
   * Стерти виділене: текст — правилом моделі, клітинкові доріжки, які
   * захопило виділення (атомні вузли), — очистити. Рядки, що зникли
   * цілком, забирають свої клітинки з собою.
   */
  const removeSelection = (anchor: Pos, focus: Pos) => {
    const cells = Array.from(
      Editor.nodes(view, { at: view.selection!, match: (n, path) => path.length === 2 && isCellsNode(n) }),
      ([n, path]) => ({ line: s.sources[path[0]].line, id: laneOfNode(n) }),
    );
    const at = deleteRange(song, anchor, focus, canEdit);
    const alive = new Set(linesOf(song));
    cells.forEach(({ line, id }) => alive.has(line) && clearCells(line, id));
    return at;
  };

  /** Правило моделі з курсором видимого; окремий крок undo; курсор — куди скаже правило. */
  const command = (run: (anchor: Pos, focus: Pos) => Pos | null) => {
    const sel = view.selection;
    if (!sel) return;
    const [anchor, focus] = [toModel(s, sel.anchor), toModel(s, sel.focus)];
    history.before();
    undoManager.stopCapturing();
    let caret: Pos | null = null;
    song.doc.transact(() => {
      caret = run(anchor, focus);
    }, COMMAND);
    undoManager.stopCapturing();
    const at = caret && toView(s, caret);
    if (at) quietly(s, () => Transforms.select(view, at));
    history.after();
  };
  /** Спершу стерти виділене (якщо є), потім правило в точці, що лишилась. */
  const collapsed = (anchor: Pos, focus: Pos) => (Range.isExpanded(view.selection!) ? removeSelection(anchor, focus) : anchor);

  const { deleteBackward, deleteForward } = view;
  // Курсор у клітинковій доріжці — друк, стирання й вставка йдуть у неї (за її синтаксисом).
  view.insertText = (text) => {
    const sel = view.selection;
    if (!sel || cells.type(text)) return;
    if (Range.isExpanded(sel)) return command((a, f) => insertText(song, collapsed(a, f), text));
    if (slashAllowed(song, toModel(s, sel.anchor), text)) Transforms.insertText(view, text);
  };
  view.insertBreak = () => command((a, f) => splitLine(song, collapsed(a, f)));
  view.deleteBackward = (unit) => {
    if (cells.key({ key: "Backspace" })) return;
    const sel = view.selection;
    if (sel && Range.isCollapsed(sel) && sel.anchor.offset === 0) return command((a) => backspaceAtLaneStart(song, a));
    deleteBackward(unit);
  };
  view.deleteForward = (unit) => {
    if (cells.key({ key: "Delete" })) return;
    const sel = view.selection;
    const atEnd = sel && Range.isCollapsed(sel) && sel.anchor.offset === Node.string(Node.get(view, sel.anchor.path)).length;
    if (atEnd) return command((a) => deleteAtLaneEnd(song, a));
    deleteForward(unit);
  };
  view.deleteFragment = () => command((a, f) => removeSelection(a, f));
  view.insertData = (data) => {
    const text = data.getData("text/plain");
    if (text && cells.paste(text)) return;
    if (text) command((a, f) => insertPlainText(song, collapsed(a, f), text));
  };
}
