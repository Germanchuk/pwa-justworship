import { Editor, Node, Transforms, type Element } from "slate";
import { ReactEditor } from "slate-react";

/**
 * Replace the inner text of a void element while preserving Y-doc structure.
 * Used by Bpm/TimeSignature where the displayed value lives in children[0].text
 * but the element is void (no inline editing).
 */
export function setVoidText(
  editor: Editor,
  element: Element,
  newText: string,
): void {
  const path = ReactEditor.findPath(editor, element);
  const textPath = [...path, 0];
  const oldLength = Node.string(element).length;

  // `voids: true` обовʼязкове: bpm/time-signature — void-елементи, а Slate-трансформи
  // за замовчуванням НЕ заходять у void (insertText нічого не вставляє → значення не
  // зберігається; delete губить вузол → нормалізація `withHeader` перебудовує meta-row
  // і ресетить capo.valuesBy). З `voids: true` правимо текст void на місці.
  Editor.withoutNormalizing(editor, () => {
    if (oldLength > 0) {
      Transforms.delete(editor, {
        at: {
          anchor: { path: textPath, offset: 0 },
          focus: { path: textPath, offset: oldLength },
        },
        voids: true,
      });
    }
    if (newText.length > 0) {
      Transforms.insertText(editor, newText, {
        at: { path: textPath, offset: 0 },
        voids: true,
      });
    }
  });
}
