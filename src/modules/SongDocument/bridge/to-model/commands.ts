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
  Line,
  linesOf,
  Pos,
  mergeNeedsConfirm,
  removalNeedsConfirm,
  removeLineAt,
  slashAllowed,
  splitLine,
} from "../../model";
import type { Cells } from "../cells";
import type { History } from "../history";
import { toModel, toView } from "../positions";
import { isCellsNode, isShown, laneOfNode } from "../projection";
import { COMMAND, quietly, ViewState } from "../state";

/**
 * Попередження перед видаленням рядків (`SONG-90`, `SONG-91`): перша дія лише
 * попереджає, друга (той самий Backspace чи Delete, або «Видалити») — видаляє.
 *  - `line` — Backspace на початку порожніх слів рядка з вмістом доріжок;
 *  - `range` — виділення через кілька рядків: Backspace, Delete, друк, вставка, Enter;
 *  - `merge` — склеювання двох непорожніх рядків: Backspace на початку слів чи Delete у кінці.
 */
export type Pending =
  | { kind: "line"; line: Line; lanes: string[] }
  | { kind: "range"; range: Range; rows: number }
  | { kind: "merge"; at: Range; forward: boolean };

export type Removal = {
  /** Що видалиться наступною такою самою дією; `null` — попередження немає. */
  pending: () => Pending | null;
  confirm: () => void;
  cancel: () => void;
  listen: (fn: () => void) => () => void;
};

export function installCommands(s: ViewState, history: History, cells: Cells): Removal {
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

  let pending: Pending | null = null;
  const listeners = new Set<() => void>();
  const arm = (next: typeof pending) => {
    if (pending === next) return;
    pending = next;
    listeners.forEach((fn) => fn());
  };
  /** Видалити те, про що попередили: рядок (курсор — у кінець слів попереднього) чи виділене. */
  const confirm = () => {
    const was = pending;
    arm(null);
    if (was?.kind === "range") return command((a, f) => removeSelection(a, f));
    if (was?.kind === "merge") return command((a) => (was.forward ? deleteAtLaneEnd(song, a) : backspaceAtLaneStart(song, a)));
    const ln = was ? linesOf(song).indexOf(was.line) : -1;
    if (ln > 0) command(() => removeLineAt(song, ln));
  };
  /** Виділення захоплює кілька рядків видимого — його видалення чекає підтвердження. */
  const rowsOf = (sel: Range | null) =>
    sel && Range.isExpanded(sel) ? Math.abs(sel.anchor.path[0] - sel.focus.path[0]) + 1 : 1;
  /** Дія, що спершу стирає виділене: через кілька рядків — попередити й нічого не робити (`true`). */
  const guardRange = () => {
    const sel = view.selection;
    if (!sel || rowsOf(sel) < 2) return false;
    arm({ kind: "range", range: sel, rows: rowsOf(sel) });
    return true;
  };
  // Курсор пішов (друк, стрілки, клік, інше виділення) — попередження знімається.
  const { onChange } = view;
  view.onChange = (options) => {
    const sel = view.selection;
    if (pending?.kind === "line") {
      const here = sel && Range.isCollapsed(sel) && sel.anchor.offset === 0 ? s.sources[sel.anchor.path[0]]?.line : null;
      if (here !== pending.line) arm(null);
    } else if (pending?.kind === "range" && !(sel && Range.equals(sel, pending.range))) arm(null);
    else if (pending?.kind === "merge" && !(sel && Range.equals(sel, pending.at))) arm(null);
    onChange(options);
  };

  /** Backspace на початку / Delete у кінці слів: склеїти — двох непорожніх лише вдруге (`SONG-92`). */
  const merge = (sel: Range, forward: boolean, ln: number) => {
    const run = () => command((a) => (forward ? deleteAtLaneEnd(song, a) : backspaceAtLaneStart(song, a)));
    if (ln < 0 || !mergeNeedsConfirm(song, ln)) return run();
    if (pending?.kind === "merge" && pending.forward === forward && Range.equals(pending.at, sel)) return confirm();
    arm({ kind: "merge", at: sel, forward });
  };

  const { deleteBackward, deleteForward } = view;
  // Курсор у клітинковій доріжці — друк, стирання й вставка йдуть у неї (за її синтаксисом).
  view.insertText = (text) => {
    const sel = view.selection;
    if (!sel || cells.type(text) || guardRange()) return;
    if (Range.isExpanded(sel)) return command((a, f) => insertText(song, collapsed(a, f), text));
    if (slashAllowed(song, toModel(s, sel.anchor), text)) Transforms.insertText(view, text);
  };
  view.insertBreak = () => guardRange() || command((a, f) => splitLine(song, collapsed(a, f)));
  view.deleteBackward = (unit) => {
    if (cells.key({ key: "Backspace" })) return;
    const sel = view.selection;
    if (sel && Range.isCollapsed(sel) && sel.anchor.offset === 0) {
      const at = toModel(s, sel.anchor);
      const lanes = removalNeedsConfirm(song, at);
      if (!lanes) return merge(sel, false, at.lane === "words" ? at.line : -1);
      const line = linesOf(song)[at.line];
      return pending?.kind === "line" && pending.line === line ? confirm() : arm({ kind: "line", line, lanes });
    }
    deleteBackward(unit);
  };
  view.deleteForward = (unit) => {
    if (cells.key({ key: "Delete" })) return;
    const sel = view.selection;
    const atEnd = sel && Range.isCollapsed(sel) && sel.anchor.offset === Node.string(Node.get(view, sel.anchor.path)).length;
    if (atEnd) {
      const at = toModel(s, sel.anchor);
      return merge(sel, true, at.lane === "words" ? at.line + 1 : -1);
    }
    deleteForward(unit);
  };
  // Backspace / Delete / вирізання виділеного. Через кілька рядків — спершу попередження, той самий жест удруге — видалити.
  view.deleteFragment = () => {
    if (pending?.kind === "range" && view.selection && Range.equals(view.selection, pending.range)) return confirm();
    if (guardRange()) return;
    command((a, f) => removeSelection(a, f));
  };
  view.insertData = (data) => {
    const text = data.getData("text/plain");
    if (text && cells.paste(text)) return;
    if (text && guardRange()) return;
    if (text) command((a, f) => insertPlainText(song, collapsed(a, f), text));
  };

  return {
    pending: () => pending,
    confirm,
    cancel: () => arm(null),
    listen: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
