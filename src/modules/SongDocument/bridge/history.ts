/**
 * Undo/redo — штатний Y.UndoManager на тексті пісні: скасовує лише правки
 * цього учасника. Як у withYHistory, крок історії пам'ятає два курсори:
 * «до» (куди повертає undo) і «після» (куди повертає redo).
 */
import * as Y from "yjs";
import { Range, Transforms } from "slate";
import { fromRelative, toModel, toRelative } from "./positions";
import { quietly, ViewState } from "./state";

type RelativeRange = { anchor: Y.RelativePosition; focus: Y.RelativePosition } | null;
type StackItem = { meta: Map<string, RelativeRange> };
type StackEvent = { stackItem: StackItem; type: "undo" | "redo" };

export type History = {
  /** Перед власною правкою: запам'ятати курсор «до». */
  before: () => void;
  /** Після власної правки, коли курсор уже на місці: запам'ятати курсор «після». */
  after: () => void;
};

export function setupHistory(s: ViewState): History {
  const { view, undoManager } = s;
  const relative = (sel: Range | null): RelativeRange =>
    sel && { anchor: toRelative(s, toModel(s, sel.anchor)), focus: toRelative(s, toModel(s, sel.focus)) };

  let selectionBefore: RelativeRange = null;
  /** Крок історії, який створила або доповнила остання власна правка. */
  let touched: StackItem | null = null;

  const own = () => !undoManager.undoing && !undoManager.redoing;
  undoManager.on("stack-item-added", ({ stackItem }: StackEvent) => {
    if (!own()) return; // крок, створений самим undo/redo, заповнює «popped» нижче
    stackItem.meta.set("selectionBefore", selectionBefore);
    touched = stackItem;
  });
  undoManager.on("stack-item-updated", ({ stackItem }: StackEvent) => {
    if (own()) touched = stackItem; // «до» лишається від першої правки кроку
  });
  undoManager.on("stack-item-popped", ({ stackItem, type }: StackEvent) => {
    // Зворотний крок: його undo — туди, де був цей крок «після», і навпаки.
    const inverse = type === "undo" ? undoManager.redoStack : undoManager.undoStack;
    const item = inverse[inverse.length - 1] as unknown as StackItem | undefined;
    item?.meta.set("selectionBefore", stackItem.meta.get("selection") ?? null);
    item?.meta.set("selection", stackItem.meta.get("selectionBefore") ?? null);

    const sel = stackItem.meta.get("selectionBefore");
    const anchor = sel && fromRelative(s, sel.anchor);
    const focus = sel && fromRelative(s, sel.focus);
    if (anchor && focus) quietly(s, () => Transforms.select(view, { anchor, focus }));
  });

  /**
   * Y.UndoManager зрідка падає, відновлюючи видалені вкладені типи (вада Yjs,
   * `justworship-meta/.scratch/segments-lanes/yjs-undo/`). Тоді історія
   * скидається, а редактор живе далі: видиме вже звірене з тим, що встигло
   * потрапити в модель.
   */
  const safely = (step: () => unknown) => () => {
    try {
      step();
    } catch (error) {
      console.error("laneView: undo/redo впав усередині Yjs — історію скинуто", error);
      undoManager.clear();
    }
  };
  Object.assign(view, { undo: safely(() => undoManager.undo()), redo: safely(() => undoManager.redo()) });

  return {
    before: () => {
      selectionBefore = relative(view.selection);
      touched = null;
    },
    after: () => {
      touched?.meta.set("selection", relative(view.selection));
      touched = null;
    },
  };
}
