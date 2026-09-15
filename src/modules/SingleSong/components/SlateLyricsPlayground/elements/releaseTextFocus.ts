import { Transforms, type Editor } from "slate";
import { ReactEditor } from "slate-react";

/**
 * Вихід із тексту перед вікном поверх пісні: знімаємо виділення й фокус, щоб
 * екранна клавіатура, відкрита під час набору, сховалася. Курсор назад після
 * закриття вікна не повертаємо — зміна мети не означає «друкую далі».
 */
export function releaseTextFocus(editor: Editor): void {
  Transforms.deselect(editor);
  ReactEditor.blur(editor);
}
