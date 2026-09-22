/**
 * Реєстр "живого" Slate-редактора відкритої пісні.
 *
 * НАВІЩО: `SongControls` (а з ними й дія ".docx") — сусід `<Song/>`, тобто
 * ПОЗА React-деревом `<Slate>`. Тож ні
 * `useSlateStatic`, ні React-контекст туди не дістають. Оскільки на сторінці
 * завжди відкрита рівно одна пісня, тримаємо модульний сінглтон — той самий
 * патерн, що `DronePlayer.setSource`.
 *
 * Редактор — єдине джерело правди про вміст пісні: у redux лежить лише
 * `{ id }` (див. `views/SingleSong/SingleSong.tsx`).
 */

import type { Editor } from "slate";

let activeEditor: Editor | null = null;

export function setActiveSongEditor(editor: Editor | null): void {
  activeEditor = editor;
}

export function getActiveSongEditor(): Editor | null {
  return activeEditor;
}
