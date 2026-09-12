import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Element } from "slate";
import { ReactEditor, useSlate } from "slate-react";

import { useNotesViewers } from "../../../redux/selectors";
import { useDisplay } from "../display/useDisplay";
import { useCurrentUsername } from "../elements/hooks";
import type { NoteRecord } from "../types";
import { collectNoteHeads, rowKey } from "./noteHeads";
import { readNotes } from "./noteStore";
import { isVisibleToAll } from "./visibility";

type NoteHeads = {
  /** `rowKey` → commentId[]; де саме малюється кожна картка. */
  heads: Map<string, string[]>;
  /** Самі примітки — `commentId` → запис із метаданих документа. */
  notes: Record<string, NoteRecord>;
};

const EMPTY: NoteHeads = { heads: new Map(), notes: {} };

const NoteHeadsCtx = createContext<NoteHeads>(EMPTY);

/**
 * Рахує розкладку карток ОДИН раз на зміну документа, а не в кожному рядку:
 * інакше кожен з ~сотні рядків робив би власний обхід дерева.
 */
export const NoteHeadsProvider = ({ children }: { children: ReactNode }) => {
  const editor = useSlate();
  const username = useCurrentUsername();
  // Фільтри показу, які реально діють у цьому режимі — див. `display/useDisplay`.
  // Картка примітки живе на першому ВИДИМОМУ рядку зі своєю міткою, тож
  // розкладка залежить від того, що саме сховано.
  const { chordsHidden, lyricsHidden } = useDisplay().state;

  const value = useMemo<NoteHeads>(() => {
    return {
      heads: collectNoteHeads(editor.children, { chordsHidden, lyricsHidden }),
      notes: readNotes(editor),
    };
    // `editor.children` — саме тригер перерахунку: обʼєкт редактора живе весь
    // час один, а Slate на кожну операцію будує НОВИЙ масив дітей
    // (`replaceChildren`), не мутуючи старий. Лінтер цього не знає.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editor.children, chordsHidden, lyricsHidden, username]);

  return (
    <NoteHeadsCtx.Provider value={value}>{children}</NoteHeadsCtx.Provider>
  );
};

/**
 * Примітки, чиї картки належать саме цьому рядку — вже відфільтровані за тим,
 * чиїми очима дивимось (`NOTE-14`…`NOTE-17`).
 */
export const useNoteHeadsFor = (
  element: Element,
): Array<{ commentId: string; note: NoteRecord }> => {
  const editor = useSlate();
  const { heads, notes } = useContext(NoteHeadsCtx);
  const viewers = useNotesViewers();

  let key: string | null = null;
  try {
    const path = ReactEditor.findPath(editor, element);
    if (path.length === 2) key = rowKey(path[0], path[1]);
  } catch {
    // Рядок саме зараз відʼєднаний від дерева — карток не малюємо.
  }
  if (!key) return [];

  const ids = heads.get(key);
  if (!ids) return [];

  const out: Array<{ commentId: string; note: NoteRecord }> = [];
  for (const commentId of ids) {
    const note = notes[commentId];
    // Мітка без запису — це просто виділення (`NOTE-1`), картки не має.
    if (!note) continue;
    if (!isVisibleToAll(note, viewers)) continue;
    out.push({ commentId, note });
  }
  return out;
};
