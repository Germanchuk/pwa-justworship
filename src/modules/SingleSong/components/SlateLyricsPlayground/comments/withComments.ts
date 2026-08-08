import { Editor, Element, Node, Path, Range, Text, Transforms } from "slate";

import type {
  CommentAnchorElement,
  CommentMark,
  CustomText,
  NoteRecord,
} from "../types";
import {
  deleteNote,
  hasNote,
  readNote,
  readNotes,
  writeNote,
  writeNoteBody,
} from "./noteStore";

const LEGACY_ANCHOR_TYPE = "comment-anchor";

const COMMENTABLE_BLOCK_TYPES = new Set([
  "line",
  "chord-line",
  "empty-line",
  "lyric-line",
  "header",
]);

/** @deprecated Лише для міграції старих документів — див. `types.ts`. */
export const isCommentAnchor = (n: unknown): n is CommentAnchorElement =>
  Element.isElement(n as Element) && (n as Element).type === LEGACY_ANCHOR_TYPE;

const getMarks = (leaf: CustomText): CommentMark[] =>
  Array.isArray(leaf.comment) ? leaf.comment : [];

export type WithCommentsOptions = {
  /**
   * Викликається в `normalizeNode` перед тим, як прибрати осиротілу примітку
   * (текст, на якому вона висіла, видалили). Дає змогу зберегти її десь у
   * безпечному місці — див. `lostComments.ts`.
   */
  onNoteOrphaned?: (data: {
    commentId: string;
    body: string;
    color: string;
    visibleFor: string[];
    author?: string;
  }) => void;
};

/**
 * Усі commentId, під якими в документі ще є ВИДИМИЙ символ. Порожні позначені
 * листи (`{text:"", comment:[…]}`) не рахуються: користувач очікує, що примітка
 * помре, коли підсвічувати вже нічого.
 */
const collectLiveCommentIds = (editor: Editor): Set<string> => {
  const live = new Set<string>();
  for (const [n] of Editor.nodes(editor, {
    at: [],
    match: (m) => Text.isText(m) && (m as CustomText).text.length > 0,
  })) {
    for (const mark of getMarks(n as CustomText)) live.add(mark.commentId);
  }
  return live;
};

export const withComments = (
  editor: Editor,
  opts: WithCommentsOptions = {},
) => {
  const { isVoid, normalizeNode } = editor;

  // Старі документи ще можуть містити вузол-якір; поки він не мігрував, він
  // має лишатись void, інакше Slate спробує редагувати його порожній текст.
  editor.isVoid = (element) =>
    element.type === LEGACY_ANCHOR_TYPE ? true : isVoid(element);

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    // Знімаємо мітки з порожніх листів. Slate не прибирає `{text: ""}` сам, а
    // залишковий позначений порожній лист (а) малюється тонкою кольоровою
    // «рискою» в renderLeaf і (б) мовчки пофарбував би все, що в нього
    // надрукують.
    if (Text.isText(node)) {
      const t = node as CustomText;
      if (
        t.text.length === 0 &&
        Array.isArray(t.comment) &&
        t.comment.length > 0
      ) {
        Transforms.unsetNodes(editor, "comment", { at: path });
        return;
      }
    }

    // МІГРАЦІЯ старих документів: вузол-якір → запис у метаданих.
    // Ідемпотентна й самовиконувана: спрацьовує на першому ж відкритті пісні
    // будь-ким. Прибрати разом із `CommentAnchorElement`, коли прод дожує.
    if (isCommentAnchor(node)) {
      const migrated =
        hasNote(editor, node.commentId) ||
        writeNote(editor, node.commentId, {
          body: node.body ?? "",
          color: node.color,
          visibleFor: node.visibleFor,
          author: node.author,
        });
      // Рядка метаданих ще немає (його щойно вставить `withHeader`) — вузол не
      // чіпаємо, інакше текст примітки пропав би. Мігруємо наступним проходом.
      if (migrated) {
        Transforms.removeNodes(editor, { at: path });
        return;
      }
    }

    // Осиротілі примітки: тексту під ними більше немає.
    //
    // Перевіряємо на корені, бо саме він — предок будь-якої правки тексту, а
    // `song-meta-row`, де тепер лежать записи, предком рядків не є і сам би
    // не «забруднився».
    if (Editor.isEditor(node)) {
      const notes = readNotes(editor);
      const ids = Object.keys(notes);
      if (ids.length > 0) {
        const live = collectLiveCommentIds(editor);
        for (const commentId of ids) {
          if (live.has(commentId)) continue;
          const note = notes[commentId];
          opts.onNoteOrphaned?.({ commentId, ...note });
          deleteNote(editor, commentId);
          return; // нормалізація перезапуститься
        }
      }
    }

    normalizeNode(entry);
  };

  return editor;
};

// ---------- internal: apply the comment mark (merge into array) ----------

const applyMark = (
  editor: Editor,
  newMark: CommentMark,
  markerKey: string,
): void => {
  Transforms.setNodes(
    editor,
    { [markerKey]: true } as unknown as Partial<CustomText>,
    { match: Text.isText, split: true },
  );

  const entries: Array<[CustomText, Path]> = [];
  for (const [n, p] of Editor.nodes(editor, {
    at: [],
    match: (m) =>
      Text.isText(m) &&
      (m as unknown as Record<string, unknown>)[markerKey] === true,
  })) {
    entries.push([n as CustomText, p]);
  }
  for (const [leaf, p] of entries) {
    const merged = [...getMarks(leaf), newMark];
    Transforms.setNodes(
      editor,
      { comment: merged } as Partial<CustomText>,
      { at: p },
    );
    Transforms.unsetNodes(editor, markerKey, { at: p });
  }
};

const hasBlockSelection = (editor: Editor): boolean => {
  const { selection } = editor;
  if (!selection || Range.isCollapsed(selection)) return false;
  const [start] = Range.edges(selection);
  return !!Editor.above(editor, {
    at: start,
    match: (n) =>
      Element.isElement(n) &&
      Editor.isBlock(editor, n) &&
      COMMENTABLE_BLOCK_TYPES.has((n as { type: string }).type),
    mode: "lowest",
  });
};

// ---------- public API ----------

/** Кольорове виділення на поточному селекшні. Картки не створює. */
export const addHighlight = (
  editor: Editor,
  commentId: string,
  visibleFor: string[],
  color: string,
  author?: string,
): void => {
  if (!hasBlockSelection(editor)) return;
  const mark: CommentMark = { commentId, visibleFor, color, author };
  Editor.withoutNormalizing(editor, () => {
    applyMark(editor, mark, `__cAdd_${commentId}`);
  });
};

/**
 * Виділення на селекшні ПЛЮС запис примітки в метаданих документа.
 * Де саме зʼявиться картка, тут не вирішується — див. `noteHeads.ts`.
 */
export const addNote = (
  editor: Editor,
  commentId: string,
  visibleFor: string[],
  color: string,
  body = "",
  author?: string,
): void => {
  if (!hasBlockSelection(editor)) return;
  const mark: CommentMark = { commentId, visibleFor, color, author };

  Editor.withoutNormalizing(editor, () => {
    applyMark(editor, mark, `__cAdd_${commentId}`);
    writeNote(editor, commentId, { body, color, visibleFor, author });
  });
};

/**
 * Перетворити наявне виділення на примітку (`NOTE-4`). Метадані беремо з самої
 * мітки — вона вже несе колір, адресата й автора.
 */
export const convertHighlightToNote = (
  editor: Editor,
  commentId: string,
  body = "",
): void => {
  if (hasNote(editor, commentId)) return;

  for (const [n] of Editor.nodes(editor, {
    at: [],
    match: (m) =>
      Text.isText(m) &&
      (m as CustomText).text.length > 0 &&
      getMarks(m as CustomText).some((c) => c.commentId === commentId),
  })) {
    const mark = getMarks(n as CustomText).find(
      (c) => c.commentId === commentId,
    );
    if (!mark) continue;
    const record: NoteRecord = {
      body,
      color: mark.color,
      visibleFor: mark.visibleFor,
      author: mark.author,
    };
    writeNote(editor, commentId, record);
    return;
  }
};

/** Видалити коментар повністю: мітки з тексту + запис примітки. */
export const removeComment = (editor: Editor, commentId: string): void => {
  Editor.withoutNormalizing(editor, () => {
    const matches: Array<[CustomText, Path]> = [];
    for (const [n, p] of Editor.nodes(editor, {
      at: [],
      match: (m) =>
        Text.isText(m) &&
        getMarks(m as CustomText).some((c) => c.commentId === commentId),
    })) {
      matches.push([n as CustomText, p]);
    }
    for (const [leaf, p] of matches) {
      const filtered = getMarks(leaf).filter(
        (c) => c.commentId !== commentId,
      );
      if (filtered.length === 0) {
        Transforms.unsetNodes(editor, "comment", { at: p });
      } else {
        Transforms.setNodes(
          editor,
          { comment: filtered } as Partial<CustomText>,
          { at: p },
        );
      }
    }

    deleteNote(editor, commentId);
  });
};

/**
 * Прибрати лише картку, лишивши підсвітку на тексті — тобто понизити примітку
 * назад до виділення (`NOTE-4`).
 */
export const removeNoteOnly = (editor: Editor, commentId: string): void => {
  deleteNote(editor, commentId);
};

export const updateCommentBody = (
  editor: Editor,
  commentId: string,
  body: string,
): void => {
  writeNoteBody(editor, commentId, body);
};

export { hasNote, readNote };
export { Node };
