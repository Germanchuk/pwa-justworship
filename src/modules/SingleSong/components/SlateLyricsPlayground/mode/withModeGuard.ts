import { type Editor } from "slate";

import { emitModeBlocked } from "./modeBlock";

/**
 * Змінювати вміст пісні можна ЛИШЕ в режимі редагування (`SongMode.edit`).
 *
 * Режим читання вимикає ввід самим `readOnly` на `<Editable>` (немає каретки й
 * клавіатури). Режим приміток лишається contentEditable — інакше зламається
 * виділення тексту, на якому тримається `CommentsFab`, — тож саме тут потрібен
 * цей guard: він відсікає всі мутації рівня користувацького вводу.
 *
 * Свідомо перехоплюємо лише "інпутні" методи редактора. Коментарі ставляться
 * через `Transforms.setNodes/insertNodes` (див. `comments/withComments.ts`),
 * тобто повз ці методи — і в режимі приміток працюють нормально. Так само
 * повз guard ідуть віддалені Yjs-зміни (вони застосовуються через `apply`).
 */
export const withModeGuard = (
  editor: Editor,
  canEditContent: () => boolean,
): Editor => {
  const {
    insertText,
    insertBreak,
    insertSoftBreak,
    insertFragment,
    insertData,
    deleteBackward,
    deleteForward,
    deleteFragment,
  } = editor;

  // Заблокувати правку й повідомити UI (тултіп біля каретки).
  const deny = (): void => emitModeBlocked();

  editor.insertText = (text, options) => {
    if (!canEditContent()) return deny();
    insertText(text, options);
  };

  editor.insertBreak = () => {
    if (!canEditContent()) return deny();
    insertBreak();
  };

  editor.insertSoftBreak = () => {
    if (!canEditContent()) return deny();
    insertSoftBreak();
  };

  editor.insertFragment = (fragment, options) => {
    if (!canEditContent()) return deny();
    insertFragment(fragment, options);
  };

  editor.insertData = (data) => {
    if (!canEditContent()) return deny();
    insertData(data);
  };

  editor.deleteBackward = (unit) => {
    if (!canEditContent()) return deny();
    deleteBackward(unit);
  };

  editor.deleteForward = (unit) => {
    if (!canEditContent()) return deny();
    deleteForward(unit);
  };

  // Backspace/Delete при розгорнутому селекшні йде сюди, а не в deleteBackward.
  editor.deleteFragment = (direction) => {
    if (!canEditContent()) return deny();
    deleteFragment(direction);
  };

  return editor;
};
