import { Element, Node } from "slate";
import { ReactEditor, useSlate } from "slate-react";

import { isRowHiddenAt } from "./operations";
import { useDisplay } from "./useDisplay";

/**
 * Чи ховати цей рядок секції за активними фільтрами показу.
 * Правило показу описане в `model.ts`, самé обчислення — `isRowHiddenAt`,
 * а чи фільтри взагалі діють у цьому режимі — `useDisplay`.
 *
 * Ховаємо через CSS (`display: none`), а НЕ прибираючи вузол з рендера:
 * Slate вимагає, щоб DOM відповідав моделі.
 */
export const useRowHidden = (element: Element): boolean => {
  const editor = useSlate();
  const { state } = useDisplay();

  if (!state.chordsHidden && !state.lyricsHidden) return false;

  try {
    const path = ReactEditor.findPath(editor, element);
    if (path.length !== 2) return false;

    const section = Node.get(editor, path.slice(0, 1));
    if (!Element.isElement(section) || section.type !== "section") return false;

    return isRowHiddenAt(section.children, path[1], state);
  } catch {
    return false;
  }
};
