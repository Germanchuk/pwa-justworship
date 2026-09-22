import {
  Editor,
  Element,
  Node,
  Range,
  Transforms,
  type Descendant,
  type Path,
  type PointRef,
} from "slate";

import { clipboardSectionAttrs, toSetNodesProps, type SectionAttrs } from "./sectionAttrs";
import type { LineElement, SectionElement } from "./types";

/**
 * Буфер обміну пісні: що копіюється і як вставляється.
 *
 * **Копіювання.** Секція, виділена ЦІЛКОМ, їде секцією — разом із повторами й
 * динамікою (`clipboardSectionAttrs`). Частина секції їде простим текстом:
 * рядок не тягне за собою атрибутів секції, з якої його взяли. Примітки не
 * їдуть ніколи — у фрагменті лишається тільки текст рядків.
 *
 * **Вставка — це набір тексту.** Рядки лягають так, ніби їх надрукували з
 * Enter між ними, тож межі секцій складаються за звичайним правилом (порожній
 * рядок — межа, `withSections.ts`). Секція ніколи не опиняється всередині
 * іншої — а саме так і народжувались вкладені секції: Slate вставляв
 * скопійований вузол-секцію на місце виділеного рядка.
 *
 * Атрибути скопійованої секції отримує секція, яку її рядки утворили на новому
 * місці, — якщо та складається рівно з них. Якщо вставлені рядки злилися з
 * сусідніми (між ними немає порожнього рядка), діє звичайне злиття, а
 * атрибути вставленої секції губляться разом із її межами.
 */
export const withClipboard = (editor: Editor): Editor => {
  editor.getFragment = () => {
    const { selection } = editor;
    if (!selection) return [];

    // Потрійний клік виділяє рядок разом із початком наступного блоку. Без
    // `unhangRange` у буфер потрапив би зайвий порожній рядок, і вставка на
    // місце рядка розривала б секцію.
    const range = Editor.unhangRange(editor, selection);
    const first = Range.start(range).path[0];

    return Node.fragment(editor, range).flatMap((node, i): Descendant[] => {
      const lines = rowsOf(node).map(lineOf);
      if (isSection(node) && covers(editor, range, [first + i])) {
        return [{ type: "section", ...clipboardSectionAttrs(node), children: lines }];
      }
      return lines;
    });
  };

  // Адресу вставки (`options.at`) свідомо не підтримуємо: вставка завжди йде
  // в каретку, інших викликів у застосунку немає.
  editor.insertFragment = (fragment) => {
    insertBlocks(
      editor,
      fragment.map((node) => ({
        rows: rowsOf(node),
        attrs: isSection(node) ? clipboardSectionAttrs(node) : undefined,
      })),
    );
  };

  // Текст ззовні (сайт з акордами, нотатки) лягає за тим самим правилом.
  editor.insertTextData = (data) => {
    const text = data.getData("text/plain");
    if (!text) return false;
    insertBlocks(editor, [{ rows: text.split(/\r\n|\r|\n/) }]);
    return true;
  };

  return editor;
};

/**
 * Що несе фрагмент: рядки тексту, а якщо це ціла секція — ще й її атрибути.
 * Порожній рядок — межа секцій, як і в самому документі.
 */
type Block = { rows: string[]; attrs?: SectionAttrs };

const isSection = (node: Node): node is SectionElement =>
  Element.isElement(node) && node.type === "section";

/**
 * Текст рядків вузла верхнього рівня. Бейджі шапки (темп, тональність…) і
 * застарілі якорі приміток текстом пісні не є — їх пропускаємо.
 */
const rowsOf = (node: Node): string[] => {
  if (!Element.isElement(node)) return [Node.string(node)];
  switch (node.type) {
    case "section":
      return node.children
        .filter((child) => child.type !== "comment-anchor")
        .map((child) => Node.string(child));
    case "song-meta-row":
    case "comment-anchor":
      return [];
    default:
      return [Node.string(node)];
  }
};

const lineOf = (text: string): LineElement => ({ type: "line", children: [{ text }] });

/** Чи потрапила секція у виділення вся — від першого символу до останнього. */
const covers = (editor: Editor, range: Range, path: Path): boolean =>
  Range.includes(range, Editor.start(editor, path)) &&
  Range.includes(range, Editor.end(editor, path));

const insertBlocks = (editor: Editor, blocks: Block[]) => {
  const placed: { attrs: SectionAttrs; start: PointRef; end: PointRef }[] = [];

  // Уся вставка — без проміжних нормалізацій, як і звичайний набір поверх
  // виділення: інакше рядок, спорожнілий після видалення виділеного, встиг би
  // розірвати секцію й одразу злитися назад, скинувши згортання.
  Editor.withoutNormalizing(editor, () => {
    if (!editor.selection) return;
    if (Range.isExpanded(editor.selection)) {
      Transforms.delete(editor, { at: Editor.unhangRange(editor, editor.selection) });
    }
    // Бейдж шапки — не текст, вставляти в нього нічого.
    if (!editor.selection || Editor.void(editor)) return;

    // Назва пісні — завжди один рядок: розрив у ній розколов би шапку
    // документа (`withHeader`), тож рядки лягають через пробіл.
    if (Editor.above(editor, { match: (n) => Element.isElement(n) && n.type === "song-name" })) {
      const text = blocks.flatMap((block) => block.rows).filter(Boolean).join(" ");
      if (text) Transforms.insertText(editor, text);
      return;
    }

    // `backward`: точка лишається ПЕРЕД текстом, який вставлять у неї саму.
    const caretRef = () =>
      Editor.pointRef(editor, editor.selection!.anchor, { affinity: "backward" });

    let first = true;
    for (const { rows, attrs } of blocks) {
      let start: PointRef | null = null;
      for (const [i, text] of rows.entries()) {
        if (!first) Transforms.splitNodes(editor, { always: true });
        first = false;
        if (attrs && i === 0) start = caretRef();
        if (text) Transforms.insertText(editor, text);
      }
      if (attrs && start) placed.push({ attrs, start, end: caretRef() });
    }
  });

  // Межі секцій складаються лише після нормалізації — тому атрибути вже тут.
  for (const { attrs, start, end } of placed) {
    const from = start.unref();
    const to = end.unref();
    if (!from || !to) continue;
    const entry = Editor.above(editor, { at: from, match: isSection });
    if (!entry) continue;
    const [section, path] = entry;
    if (Editor.isStart(editor, from, path) && Editor.isEnd(editor, to, path)) {
      Transforms.setNodes<SectionElement>(editor, toSetNodesProps(attrs, section), {
        at: path,
      });
    }
  }
};
