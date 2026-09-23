import { useCallback, useEffect, useState } from "react";
import { Range, type BaseRange, type Editor } from "slate";
import { ReactEditor } from "slate-react";

/**
 * Діапазон пісні, до якого чіпляється позначка в режимі приміток.
 *
 * Режим приміток показує пісню як читання: `<Editable readOnly>`, тож тап не
 * ставить каретку й не відкриває клавіатуру (`MODE-19`). Але `editor.selection`
 * у `readOnly` каналом бути не може: slate-react на КОЖЕН `selectionchange`
 * у read-only редакторі робить `Transforms.deselect` (виділення не в
 * contentEditable для нього «не своє»). Тому діапазон живе тут, окремо, а в
 * `editor.selection` потрапляє лише на мить застосування позначки.
 *
 * Звідки береться:
 *  - виділення браузера (нативний long-press з ручками) → розгорнутий діапазон;
 *  - тап по тексту → згорнута точка під пальцем. Якщо там позначка, FAB
 *    переходить у керування нею — як раніше з кареткою (`NOTE-36`).
 *
 * Згорнуте чи зникле виділення браузера діапазон НЕ скидає: так воно зникає й
 * від тапу по самому FAB, а позначка має лягти туди, що виділяли. Скидає тап:
 *  - по пісні — стає новою точкою (див. вище);
 *  - повз пісню (поле сторінки, меню пісні) — діапазону більше немає, палітра
 *    й меню позначки ховаються разом із виділенням. Тапи по самих кнопках
 *    приміток (`ANNOTATION_UI`) і по їхніх випадних списках — не «повз».
 */
/** Позначає інтерфейс приміток: тап по ньому не скидає діапазон. */
export const ANNOTATION_UI = "data-annotation-ui";
const KEEP_RANGE = `[${ANNOTATION_UI}], [role="menu"]`;

export const useAnnotationRange = (editor: Editor) => {
  const [range, setRange] = useState<BaseRange | null>(null);

  useEffect(() => {
    const root = ReactEditor.toDOMNode(editor, editor);

    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      if (!isSongText(root, sel.anchorNode) || !isSongText(root, sel.focusNode)) {
        return;
      }
      const next = ReactEditor.toSlateRange(editor, sel, {
        exactMatch: false,
        suppressThrow: true,
      });
      if (!next || Range.isCollapsed(next)) return;
      setRange((prev) => (prev && Range.equals(prev, next) ? prev : next));
    };

    const onClick = (e: MouseEvent) => {
      if (!isSongText(root, e.target as Node | null)) return;
      // Клік, яким закінчилось протягування мишею, лишає виділення — його
      // вже підхопив `selectionchange`.
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      try {
        setRange(ReactEditor.findEventRange(editor, e));
      } catch {
        setRange(null);
      }
    };

    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // Усередині редактора вирішує `onClick`; острівці (картка примітки)
      // вибір не скидають.
      if (!target || root.contains(target)) return;
      if (target.closest?.(KEEP_RANGE)) return;
      // Протягування мишею, що закінчилось поза піснею, лишає виділення.
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      setRange(null);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("click", onClickOutside);
    root.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("click", onClickOutside);
      root.removeEventListener("click", onClick);
    };
  }, [editor]);

  // Програмний вибір (щойно створена позначка стає обраною, `NOTE-7`):
  // нативне виділення знімаємо, щоб воно не лишалось висіти поверх.
  const select = useCallback((next: BaseRange | null) => {
    window.getSelection()?.removeAllRanges();
    setRange(next);
  }, []);

  return { range, select };
};

/**
 * Вузол — текст пісні, а не острівець інтерфейсу всередині редактора (картка
 * примітки, кнопки секції). У `readOnly` сам корінь редактора має
 * `contenteditable="false"`, тож острівцем вважається лише НАЙБЛИЖЧИЙ такий
 * предок, що не є коренем.
 */
const isSongText = (root: HTMLElement, node: Node | null): boolean => {
  if (!node || !root.contains(node)) return false;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const island = el?.closest('[contenteditable="false"]');
  return !island || island === root;
};
