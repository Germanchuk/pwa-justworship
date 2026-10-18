/**
 * Усе структурне — Enter, склеювання, видалення виділеного, вставка — правилами
 * моделі (`1-model/rules`), а не в Slate. Видиме лише покаже результат подією Yjs.
 */
import { Node, Range, Transforms } from "slate";
import {
  backspaceAtLaneStart,
  deleteAtLaneEnd,
  deleteRange,
  insertPlainText,
  insertText,
  Pos,
  slashAllowed,
  splitLine,
} from "../../model";
import type { History } from "../history";
import { toModel, toView } from "../positions";
import { isShown } from "../projection";
import { COMMAND, quietly, ViewState } from "../state";

export function installCommands(s: ViewState, history: History) {
  const { song, view, undoManager } = s;
  const canEdit = (ln: number, lane: Pos["lane"]) => isShown(s, ln, lane);

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
  const collapsed = (anchor: Pos, focus: Pos) =>
    Range.isExpanded(view.selection!) ? deleteRange(song, anchor, focus, canEdit) : anchor;

  const { deleteBackward, deleteForward } = view;
  view.insertText = (text) => {
    const sel = view.selection;
    if (!sel) return;
    if (Range.isExpanded(sel)) return command((a, f) => insertText(song, collapsed(a, f), text));
    if (slashAllowed(song, toModel(s, sel.anchor), text)) Transforms.insertText(view, text);
  };
  view.insertBreak = () => command((a, f) => splitLine(song, collapsed(a, f)));
  view.deleteBackward = (unit) => {
    const sel = view.selection;
    if (sel && Range.isCollapsed(sel) && sel.anchor.offset === 0) return command((a) => backspaceAtLaneStart(song, a));
    deleteBackward(unit);
  };
  view.deleteForward = (unit) => {
    const sel = view.selection;
    const atEnd = sel && Range.isCollapsed(sel) && sel.anchor.offset === Node.string(Node.get(view, sel.anchor.path)).length;
    if (atEnd) return command((a) => deleteAtLaneEnd(song, a));
    deleteForward(unit);
  };
  view.deleteFragment = () => command((a, f) => deleteRange(song, a, f, canEdit));
  view.insertData = (data) => {
    const text = data.getData("text/plain");
    if (text) command((a, f) => insertPlainText(song, collapsed(a, f), text));
  };
}
