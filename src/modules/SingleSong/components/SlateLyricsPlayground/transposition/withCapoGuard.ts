import { Editor, Element, Range, type Point } from "slate";

import { emitCapoBlocked } from "./capoBlock";
import { resolveTransposition } from "./operations";

/**
 * Per-user капо (режим 3): коли в користувача застосовано капо (>0), акорди
 * показуються транспоновано ЛИШЕ йому (через `displayChord`-декорацію), а сам
 * документ лишається у спільній тональності для всіх.
 *
 * Щоб капо-юзер випадково не вписав акорди у "своїй" тональності в спільний
 * документ — поки капо активне, БЛОКУЄМО будь-яке редагування chord-line.
 * Лірика й структура лишаються редагованими. Капо = 0 повертає редагування.
 *
 * `getUsername` повертає нік поточного користувача (капо береться з документа).
 */
export const withCapoGuard = (
  editor: Editor,
  getUsername: () => string | undefined,
): Editor => {
  const {
    insertText,
    insertBreak,
    insertSoftBreak,
    deleteBackward,
    deleteForward,
    insertFragment,
    insertData,
  } = editor;

  const capoOn = () => resolveTransposition(editor, getUsername()).myCapo > 0;

  // Заблокувати правку й повідомити UI (тултіп з поясненням біля каретки).
  const deny = (): void => emitCapoBlocked();

  editor.insertText = (text, options) => {
    if (capoOn() && selectionTouchesChordLine(editor)) return deny();
    insertText(text, options);
  };

  editor.insertBreak = () => {
    if (capoOn() && selectionTouchesChordLine(editor)) return deny();
    insertBreak();
  };

  editor.insertSoftBreak = () => {
    if (capoOn() && selectionTouchesChordLine(editor)) return deny();
    insertSoftBreak();
  };

  editor.insertFragment = (fragment) => {
    if (capoOn() && selectionTouchesChordLine(editor)) return deny();
    insertFragment(fragment);
  };

  editor.insertData = (data) => {
    if (capoOn() && selectionTouchesChordLine(editor)) return deny();
    insertData(data);
  };

  editor.deleteBackward = (unit) => {
    if (capoOn() && deleteWouldTouchChordLine(editor, "backward", unit)) return deny();
    deleteBackward(unit);
  };

  editor.deleteForward = (unit) => {
    if (capoOn() && deleteWouldTouchChordLine(editor, "forward", unit)) return deny();
    deleteForward(unit);
  };

  return editor;
};

const isChordLine = (n: unknown): boolean =>
  Element.isElement(n as Element) && (n as { type?: string }).type === "chord-line";

/** Чи перетинає поточний селекшн хоч один chord-line. */
function selectionTouchesChordLine(editor: Editor): boolean {
  const { selection } = editor;
  if (!selection) return false;
  for (const _ of Editor.nodes(editor, { at: selection, match: isChordLine })) {
    return true;
  }
  return false;
}

function pointInChordLine(editor: Editor, point: Point | undefined): boolean {
  if (!point) return false;
  for (const _ of Editor.nodes(editor, { at: point, match: isChordLine })) {
    return true;
  }
  return false;
}

/**
 * Видалення зачіпає chord-line, якщо: (а) селекшн уже в ньому, або (б) каретка
 * згорнута на межі блока і видалення зіллє сусідній chord-line (backspace на
 * початку рядка / delete в кінці).
 */
function deleteWouldTouchChordLine(
  editor: Editor,
  dir: "backward" | "forward",
  unit: Parameters<Editor["deleteBackward"]>[0],
): boolean {
  if (selectionTouchesChordLine(editor)) return true;
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) return false;
  const adjacent =
    dir === "backward"
      ? Editor.before(editor, selection.anchor, { unit })
      : Editor.after(editor, selection.anchor, { unit });
  return pointInChordLine(editor, adjacent);
}
