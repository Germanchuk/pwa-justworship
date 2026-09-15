import { type Editor } from "slate";

/**
 * Змінювати вміст пісні можна ЛИШЕ в режимі редагування (`SongMode.edit`).
 *
 * Читання й примітки вимикають ввід уже самим `readOnly` на `<Editable>`
 * (немає каретки, клавіатури, вставки й перетягування). Цей guard —
 * страховка поверх: він мовчки відсікає мутації рівня користувацького вводу,
 * якщо якийсь шлях все ж обійде `readOnly`.
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

  editor.insertText = (text, options) => {
    if (!canEditContent()) return;
    insertText(text, options);
  };

  editor.insertBreak = () => {
    if (!canEditContent()) return;
    insertBreak();
  };

  editor.insertSoftBreak = () => {
    if (!canEditContent()) return;
    insertSoftBreak();
  };

  editor.insertFragment = (fragment, options) => {
    if (!canEditContent()) return;
    insertFragment(fragment, options);
  };

  editor.insertData = (data) => {
    if (!canEditContent()) return;
    insertData(data);
  };

  editor.deleteBackward = (unit) => {
    if (!canEditContent()) return;
    deleteBackward(unit);
  };

  editor.deleteForward = (unit) => {
    if (!canEditContent()) return;
    deleteForward(unit);
  };

  // Backspace/Delete при розгорнутому селекшні йде сюди, а не в deleteBackward.
  editor.deleteFragment = (direction) => {
    if (!canEditContent()) return;
    deleteFragment(direction);
  };

  return editor;
};
