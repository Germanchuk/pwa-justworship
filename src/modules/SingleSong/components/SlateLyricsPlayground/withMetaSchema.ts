import { Editor, Element } from "slate";

const VOID_TYPES = new Set(["bpm", "time-signature", "song-key", "capo"]);

/**
 * Configures void semantics for header meta elements.
 * All meta elements (bpm, time-signature, song-key, capo) are voids that
 * open modals on click — they are not directly text-editable.
 */
export const withMetaSchema = (editor: Editor) => {
  const { isVoid } = editor;

  editor.isVoid = (element) => {
    return (
      Element.isElement(element) && VOID_TYPES.has(element.type)
        ? true
        : isVoid(element)
    );
  };

  return editor;
};
