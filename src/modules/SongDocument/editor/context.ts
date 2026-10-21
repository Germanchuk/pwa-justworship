/** Що редактор пісні передає елементам свого видимого дерева. */
import { createContext, useContext } from "react";
import { Element } from "slate";
import { ReactEditor, useSlateStatic } from "slate-react";
import type { NoteView, Song } from "../model";
import type { LaneView } from "../bridge/laneView";
import type { Stroke } from "./dynamics/useStroke";

export type EditorCtx = {
  song: Song;
  lanes: LaneView;
  /** Нік того, хто дивиться (особисте: динаміка, капо). */
  me: string | null;
  /** Примітки, які зараз видно (і чужі сірі в правці — `foreign`), — підсвітки й картки над рядками. */
  notes: NoteView[];
  /** Примітки без тексту, яким щойно «додали нотатку»: картка показана порожньою, поки її не покинули. */
  drafts: string[];
  /** Чиїми очима дивимось на примітки. */
  viewers: string[];
  /** Капо, що діє зараз: акорди показуються транспонованими (лише в читанні). */
  capo: number;
  songKey: string;
  canEdit: boolean;
  /** Примітки створюються й правляться (жива пісня, будь-який режим). */
  canAnnotate: boolean;
  /** Мазок динаміки — поки відкрита панель динаміки; null — зона лише показує колір. */
  stroke: Stroke | null;
  /** Рядок моделі з курсором — показати натяки «акорди…» / «слова…» на порожньому. */
  cursorLine: number | null;
  onNoteBody: (note: NoteView, body: string) => void;
  /** Картку покинули: порожня — знову просто підсвітка. */
  onNoteBlur: (note: NoteView) => void;
};

export const Ctx = createContext<EditorCtx | null>(null);
export const useEditorCtx = () => useContext(Ctx)!;

/** Номер рядка моделі для вузла видимого дерева (−1 — вузол щойно зник). */
export function useModelLine(element: Element) {
  const ctx = useEditorCtx();
  const editor = useSlateStatic();
  try {
    return ctx.lanes.modelLine(ReactEditor.findPath(editor, element)[0]);
  } catch {
    return -1;
  }
}
