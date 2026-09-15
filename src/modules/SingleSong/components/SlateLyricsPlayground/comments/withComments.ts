import {
  Editor,
  Element,
  Node,
  Path,
  Range,
  Text,
  Transforms,
  type BaseRange,
} from "slate";

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
import { narrowAudience } from "./visibility";

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

/**
 * Згорнутий діапазон на першому листку, що несе цей коментар: «курсор» у
 * позначці, з якого `CommentsFab` бере її в керування.
 */
export const commentCaret = (
  editor: Editor,
  commentId: string,
): BaseRange | null => {
  for (const [, path] of Editor.nodes(editor, {
    at: [],
    match: (n) =>
      Text.isText(n) &&
      getMarks(n as CustomText).some((c) => c.commentId === commentId),
  })) {
    const point = { path, offset: 0 };
    return { anchor: point, focus: point };
  }
  return null;
};

/**
 * Уся область позначки: від початку першого її листка до кінця останнього.
 * Якщо позначка розірвана (частину тексту між шматками видалили), область
 * накриває й проміжок — «змінити область» (`NOTE-43`) склеює її назад.
 */
export const commentRange = (
  editor: Editor,
  commentId: string,
): BaseRange | null => {
  let first: Path | null = null;
  let last: [CustomText, Path] | null = null;
  for (const [n, p] of Editor.nodes(editor, {
    at: [],
    match: (m) =>
      Text.isText(m) &&
      getMarks(m as CustomText).some((c) => c.commentId === commentId),
  })) {
    first ??= p;
    last = [n as CustomText, p];
  }
  if (!first || !last) return null;
  return {
    anchor: { path: first, offset: 0 },
    focus: { path: last[1], offset: last[0].text.length },
  };
};

/**
 * Перенести позначку на нову область (`NOTE-43`): та сама позначка — id,
 * колір, адресати, автор, картка, — лише на іншому тексті. Область поза
 * текстом пісні ігнорується, і позначка лишається де була.
 *
 * Зняття й накладання — в одному `withoutNormalizing`: інакше між ними
 * нормалізація побачила б примітку без тексту й винесла б її у втрачені.
 */
export const moveComment = (
  editor: Editor,
  commentId: string,
  range: BaseRange,
): void => {
  Transforms.select(editor, range);
  if (!hasBlockSelection(editor)) return;

  Editor.withoutNormalizing(editor, () => {
    let mark: CommentMark | undefined;
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
      const marks = getMarks(leaf);
      mark ??= marks.find((c) => c.commentId === commentId);
      const next = marks.filter((c) => c.commentId !== commentId);
      if (next.length === 0) {
        Transforms.unsetNodes(editor, "comment", { at: p });
      } else {
        Transforms.setNodes(editor, { comment: next } as Partial<CustomText>, {
          at: p,
        });
      }
    }
    if (mark) applyMark(editor, mark, `__cMove_${commentId}`);
  });
};

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

/**
 * Видалити коментар У ВИБРАНИХ адресатів.
 *
 * Коментар один на всіх, кому належить, тож видалення не зносить його, а
 * ЗВУЖУЄ: з `visibleFor` (і в мітках на тексті, і в записі примітки) зникають
 * ті, чиїми очима я дивлюсь. Не лишилось нікого — тоді вже зносимо. Так,
 * дивлячись очима трьох вокалістів, я не можу стерти підказку четвертому,
 * якого на екрані не бачив. Виняток — публічний коментар: `narrowAudience`
 * віддає для нього `null`, тобто повне знесення (див. `visibility.ts`).
 */
export const removeComment = (
  editor: Editor,
  commentId: string,
  audience: string[],
): void => {
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
      const next: CommentMark[] = [];
      for (const mark of getMarks(leaf)) {
        if (mark.commentId !== commentId) {
          next.push(mark);
          continue;
        }
        const rest = narrowAudience(mark, audience);
        if (rest) next.push({ ...mark, visibleFor: rest });
      }
      if (next.length === 0) {
        Transforms.unsetNodes(editor, "comment", { at: p });
      } else {
        Transforms.setNodes(
          editor,
          { comment: next } as Partial<CustomText>,
          { at: p },
        );
      }
    }

    const note = readNote(editor, commentId);
    if (!note) return;
    const rest = narrowAudience(note, audience);
    if (rest) writeNote(editor, commentId, { ...note, visibleFor: rest });
    else deleteNote(editor, commentId);
  });
};

/**
 * Прибрати лише картку, лишивши підсвітку на тексті — тобто понизити примітку
 * назад до виділення (`NOTE-4`).
 *
 * На відміну від `removeComment`, діє на ВЕСЬ коментар, а не на вибраних:
 * картка в коментаря одна на всіх адресатів, тож «прибрати її лише для двох з
 * трьох» не існує як операція. Понизивши спільну примітку, понижуєш її всім.
 */
/**
 * Точкова правка позначки — і в кожній мітці на тексті, і в записі примітки,
 * щоб картка, підсвітка й видимість не розʼїхались.
 */
const patchComment = (
  editor: Editor,
  commentId: string,
  patch: Partial<Pick<CommentMark, "color" | "visibleFor">>,
): void => {
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
      const next = getMarks(leaf).map((mark) =>
        mark.commentId === commentId ? { ...mark, ...patch } : mark,
      );
      Transforms.setNodes(editor, { comment: next } as Partial<CustomText>, {
        at: p,
      });
    }

    const note = readNote(editor, commentId);
    if (note) writeNote(editor, commentId, { ...note, ...patch });
  });
};

/**
 * Замінити адресатів позначки цілком (`NOTE-37`). Порожній перелік
 * ігнорується: позначку без адресатів не бачив би ніхто, а видалення — окрема
 * дія (`NOTE-38`).
 */
export const setCommentAudience = (
  editor: Editor,
  commentId: string,
  visibleFor: string[],
): void => {
  if (visibleFor.length === 0) return;
  patchComment(editor, commentId, { visibleFor });
};

/** Змінити колір позначки, зокрема на закреслення й назад (`NOTE-42`). */
export const setCommentColor = (
  editor: Editor,
  commentId: string,
  color: string,
): void => {
  patchComment(editor, commentId, { color });
};

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
