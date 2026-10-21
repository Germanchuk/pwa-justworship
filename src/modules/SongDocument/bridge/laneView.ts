/**
 * Місток: видиме дерево Slate поверх моделі пісні (ADR-0007).
 *
 * Модель (`1-model`) — єдине джерело правди. Видиме дерево — звичайний
 * редактор Slate, який бачить користувач: лише вибрані ним доріжки. Slate не
 * знає про сховане, тож навігація, виділення й видалення в ньому рідні, а
 * сховане не правиться.
 *
 * Частини:
 *  - `projection.ts`  — що з моделі бачить ця людина;
 *  - `positions.ts`   — місце у видимому ↔ місце в моделі ↔ позиція Yjs;
 *  - `to-model/`      — друк іде в модель тією самою правкою (`typing.ts`),
 *                       решта — правилами моделі (`commands.ts`);
 *  - `from-model/`    — будь-яка зміна моделі (своя, чужа, undo) приходить
 *                       подією Yjs: склад рядків (`align.ts`), точний текст
 *                       (`deltas.ts`);
 *  - `to-model/paint.ts` — мазок динаміки збоку рядка (поза Slate);
 *  - `history.ts`     — undo/redo з курсором «до» і «після»;
 *  - `clipboard.ts`   — що копіюється в буфер як простий текст.
 */
import * as Y from "yjs";
import { createEditor, Editor, Point, Range } from "slate";
import type { LaneType, Pos, Song } from "../model";
import { cellText, installCells, type Cells } from "./cells";
import { installCopy, selectedText } from "./clipboard";
import { alignLines, rebuild } from "./from-model/align";
import { observeModel } from "./from-model/observe";
import { setupHistory } from "./history";
import { indexOf, toModel, toView } from "./positions";
import { isCellsNode, isShown, LaneDisplay, laneOfNode } from "./projection";
import { COMMAND, quietly, TYPING, ViewState } from "./state";
import { installCommands, type Removal } from "./to-model/commands";
import { installPaint, Paint } from "./to-model/paint";
import { interceptTyping } from "./to-model/typing";

export type { LaneDisplay } from "./projection";
export { viewLanes } from "./projection";

export type LaneView = {
  /** Редактор, який бачить і править користувач. */
  view: Editor;
  setDisplay: (display: LaneDisplay) => void;
  /** Номер рядка моделі для рядка видимого (−1 — такого вже немає). */
  modelLine: (vln: number) => number;
  /** Чи видно (і можна правити) доріжку рядка моделі. */
  isShown: (line: number, lane: LaneType) => boolean;
  toModel: (p: Point) => Pos;
  toView: (p: Pos) => Point | null;
  /** Виділення видимого → шматки по доріжках у моделі (лише видиме). */
  modelPieces: (r: Range) => { anchor: Pos; focus: Pos }[];
  /** Пофарбувати рядки динамікою (`null` — стерти) — один крок undo. */
  paint: Paint;
  /** Зміна поза Slate (доріжки пісні) — одна транзакція, один крок undo. */
  change: (fn: () => void) => void;
  /** Курсор у клітинкових доріжках (таби, кахон, прямокутники). */
  cells: Cells;
  /** Попередження перед видаленням рядка з вмістом доріжок. */
  removal: Removal;
  /** Текст виділеного, як його кладе в буфер копіювання (з клітинковими доріжками). */
  copyText: () => string | null;
  undoManager: Y.UndoManager;
  destroy: () => void;
};

export function createLaneView(song: Song, display: LaneDisplay, opts: { base?: () => Editor } = {}): LaneView {
  const s: ViewState = {
    song,
    view: (opts.base ?? createEditor)(),
    display,
    lines: [],
    sources: [],
    syncing: false,
    // Список доріжок — теж у undo: додав чи переставив доріжку — скасував.
    undoManager: new Y.UndoManager([song.text, song.doc.getMap("lanes")], { trackedOrigins: new Set([TYPING, COMMAND]) }),
  };
  // Клітинкова доріжка — атомний вузол: курсор переходить через неї, виділення її захоплює, друкувати в неї не можна.
  const { isVoid } = s.view;
  s.view.isVoid = (el) => (el as unknown as { type: string }).type === "cells" || isVoid(el);
  const history = setupHistory(s);
  interceptTyping(s, history);
  const cells = installCells(s, history);
  const removal = installCommands(s, history, cells);
  const cellLines = (path: number[]) => {
    const node = Editor.node(s.view, path)[0];
    return cellText(s, s.sources[path[0]].line, laneOfNode(node));
  };
  installCopy(s, cellLines);
  const paint = installPaint(s, history);
  const unobserve = observeModel(s);
  rebuild(s);

  return {
    view: s.view,
    setDisplay: (next) => {
      s.display = next;
      quietly(s, () => alignLines(s));
    },
    modelLine: (vln) => (s.sources[vln] ? indexOf(s, s.sources[vln].line) : -1),
    isShown: (ln, lane) => isShown(s, ln, lane),
    toModel: (p) => toModel(s, p),
    toView: (p) => toView(s, p),
    modelPieces: (r) =>
      Array.from(Editor.nodes(s.view, { at: r, match: (n, path) => path.length === 2 && !isCellsNode(n) }), ([, path]) =>
        Range.intersection(r, Editor.range(s.view, path)),
      )
        .filter((piece): piece is Range => !!piece && Range.isExpanded(piece))
        .map((piece) => ({ anchor: toModel(s, piece.anchor), focus: toModel(s, piece.focus) })),
    paint,
    change: (fn) => {
      history.before();
      s.undoManager.stopCapturing();
      s.song.doc.transact(fn, COMMAND);
      s.undoManager.stopCapturing();
      history.after();
    },
    cells,
    removal,
    copyText: () => selectedText(s.view, cellLines),
    undoManager: s.undoManager,
    destroy: () => {
      unobserve();
      s.undoManager.destroy();
    },
  };
}
