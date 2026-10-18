/** Спільний стан містка: модель, видиме дерево і як їхні рядки зараз зіставлені. */
import * as Y from "yjs";
import { Editor } from "slate";
import type { LineAt, Song } from "../model";
import type { LaneDisplay, Source } from "./projection";

/** Походження правок цього учасника (для undo й щоб не відлунювати власний друк). */
export const TYPING = Symbol("друк");
export const COMMAND = Symbol("команда");

export type ViewState = {
  song: Song;
  /** Редактор Slate, який бачить і править користувач. */
  view: Editor;
  /** Які доріжки людина вибрала бачити. */
  display: LaneDisplay;
  /** Рядки моделі на момент останньої звірки (між подіями Yjs — поточні). */
  lines: LineAt[];
  /** Рядки видимого дерева: який маркер і які доріжки. */
  sources: Source[];
  /** Видиме править сам місток — це не дія користувача. */
  syncing: boolean;
  undoManager: Y.UndoManager;
};

/** Правка видимого самим містком: не йде в модель і не нормалізується. */
export function quietly(s: ViewState, fn: () => void) {
  s.syncing = true;
  try {
    Editor.withoutNormalizing(s.view, fn);
  } finally {
    s.syncing = false;
  }
}
