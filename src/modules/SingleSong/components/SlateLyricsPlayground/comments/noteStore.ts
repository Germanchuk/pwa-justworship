/**
 * ДЕ ЖИВУТЬ ПРИМІТКИ
 *
 * Не окремим вузлом документа, а метаданими `song-meta-row`: по одному пропу
 * на коментар, ключ `note:<commentId>`, значення — `NoteRecord`.
 *
 * Чому не вузол. Вузол-якір мав ЗБЕРЕЖЕНУ позицію («стою над своїм рядком»),
 * тоді як сенс її ВИВОДИТЬСЯ з міток на тексті. Ніщо не тримало ці дві речі
 * разом, і будь-яка правка вище — Enter на початку рядка, вставка, розрив
 * секції, чужа правка — розʼїжджала картку з виділенням. Тепер позиція не
 * зберігається взагалі: картка малюється над першим видимим рядком, що несе
 * мітку (`noteHeads.ts`), тож дрейф неможливий за побудовою.
 *
 * Чому саме тут. `song-meta-row` уже є сховищем метаданих документа
 * (`chordsHiddenFor`, `lyricsHiddenFor`, `capo.valuesBy`), гарантовано існує
 * (`withHeader`) і, на відміну від кореневого `Y.Map`, потрапляє в резервну
 * копію `song_collab_state.slateFull` — вона рахується з вмісту документа.
 *
 * Чому окремий проп на коментар — див. коментар до `SongMetaRowElement`.
 */

import { Transforms, type Editor } from "slate";

import type { NoteRecord, SongMetaRowElement } from "../types";
import { findMetaRow } from "../withHeader";

/** Мусить збігатися з шаблоном ключа в `SongMetaRowElement`. */
export const NOTE_KEY_PREFIX = "note:";

type NoteKey = `note:${string}`;

export const noteKey = (commentId: string): NoteKey =>
  `${NOTE_KEY_PREFIX}${commentId}` as NoteKey;

export const isNoteKey = (key: string): key is NoteKey =>
  key.startsWith(NOTE_KEY_PREFIX);

export const commentIdFromNoteKey = (key: string): string =>
  key.slice(NOTE_KEY_PREFIX.length);

/** Чиста проєкція рядка метаданих у `{ commentId: NoteRecord }`. */
export const notesOfMetaRow = (
  row: SongMetaRowElement | undefined,
): Record<string, NoteRecord> => {
  const out: Record<string, NoteRecord> = {};
  if (!row) return out;
  for (const [key, value] of Object.entries(row) as Array<[string, unknown]>) {
    if (!isNoteKey(key)) continue;
    const record = value as NoteRecord | undefined;
    if (record && typeof record.body === "string") {
      out[commentIdFromNoteKey(key)] = record;
    }
  }
  return out;
};

/** Усі примітки документа. Читання — без транзакцій. */
export const readNotes = (editor: Editor): Record<string, NoteRecord> =>
  notesOfMetaRow(findMetaRow(editor)?.[0]);

export const readNote = (
  editor: Editor,
  commentId: string,
): NoteRecord | undefined => readNotes(editor)[commentId];

/**
 * Чи є примітка (картка з текстом) у цього коментаря. Запис із порожнім
 * `body` — це все одно примітка: `NOTE-4` дозволяє стерти текст, лишивши
 * картку. Просте виділення без картки запису не має взагалі.
 */
export const hasNote = (editor: Editor, commentId: string): boolean =>
  readNote(editor, commentId) !== undefined;

/**
 * Повертає `false`, якщо писати нікуди — рядка метаданих ще немає. Викликач
 * має вирішити, що робити: міграція, наприклад, у такому разі НЕ видаляє
 * старий вузол, інакше текст примітки пропав би безслідно.
 */
export const writeNote = (
  editor: Editor,
  commentId: string,
  record: NoteRecord,
): boolean => {
  const entry = findMetaRow(editor);
  if (!entry) return false;
  const [, path] = entry;
  Transforms.setNodes(
    editor,
    // Через unknown: обчислений ключ звужується до `string`, а в типі
    // рядка метаданих ключі приміток описані шаблонним індексним підписом.
    { [noteKey(commentId)]: record } as unknown as Partial<SongMetaRowElement>,
    { at: path },
  );
  return true;
};

/** Точкова правка тексту — решта метаданих коментаря лишається як була. */
export const writeNoteBody = (
  editor: Editor,
  commentId: string,
  body: string,
): void => {
  const entry = findMetaRow(editor);
  if (!entry) return;
  const [row] = entry;
  const current = notesOfMetaRow(row)[commentId];
  if (!current || current.body === body) return;
  writeNote(editor, commentId, { ...current, body });
};

export const deleteNote = (editor: Editor, commentId: string): void => {
  const entry = findMetaRow(editor);
  if (!entry) return;
  const [row, path] = entry;
  const key = noteKey(commentId);
  if (!(key in row)) return;
  Transforms.unsetNodes(editor, key, { at: path });
};
