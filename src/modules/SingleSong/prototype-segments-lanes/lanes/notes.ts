/**
 * Примітки на доріжках. Запис примітки не змінюється; позначка — діапазон
 * символів в одній текстовій доріжці, прив'язаний відносними позиціями Yjs
 * (переживає правки навколо). Примітка може мати кілька позначок.
 */
import * as Y from "yjs";
import { Editor, Node, Range } from "slate";
import { relativeRangeToSlateRange, slateRangeToRelativeRange } from "@slate-yjs/core";
import { LaneType, laneTypeOf } from "./textLanes";

/** Документ пісні: Yjs і повне дерево, прив'язане до нього. */
export type SongDoc = { doc: Y.Doc; root: Y.XmlText; editor: Editor };

export type TextMark = { lane: LaneType; anchor: unknown; focus: unknown; quote: string };
export type LaneNote = { id: string; text: string; author: string; marks: TextMark[] };

export const laneNotes = (song: SongDoc) => song.doc.getMap<LaneNote>("laneNotes");

/** Позначка на діапазоні в одній доріжці повного дерева. */
export function textMark(song: SongDoc, range: Range): TextMark {
  const rel = slateRangeToRelativeRange(song.root, song.editor, range);
  return {
    lane: laneTypeOf(Node.get(song.editor, range.anchor.path.slice(0, 2))),
    anchor: Y.relativePositionToJSON(rel.anchor),
    focus: Y.relativePositionToJSON(rel.focus),
    quote: Editor.string(song.editor, range),
  };
}

export type ResolvedMark = { mark: TextMark; line: number | null; range: Range | null };
export type NoteView = {
  note: LaneNote;
  marks: ResolvedMark[];
  /** рядок, над яким картка; null — схована або втрачена */
  cardAt: number | null;
  status: "visible" | "hidden" | "lost";
};

/**
 * Де зараз позначки примітки. Картка — над першим рядком із видимою
 * позначкою; схована, коли сховані всі її доріжки; втрачена, коли зникло все
 * позначене.
 */
export function resolveNotes(song: SongDoc, isShown: (ln: number, lane: LaneType) => boolean): NoteView[] {
  const views: NoteView[] = [];
  laneNotes(song).forEach((note) => {
    const marks = note.marks.map((mark): ResolvedMark => {
      const range = relativeRangeToSlateRange(song.root, song.editor, {
        anchor: Y.createRelativePositionFromJSON(mark.anchor),
        focus: Y.createRelativePositionFromJSON(mark.focus),
      });
      return range && Range.isExpanded(range)
        ? { mark, line: Range.start(range).path[0], range }
        : { mark, line: null, range: null };
    });
    const alive = marks.filter((m) => m.line !== null);
    const shown = alive.filter((m) => isShown(m.line!, m.mark.lane));
    const cardAt = shown.length ? Math.min(...shown.map((m) => m.line!)) : null;
    views.push({ note, marks, cardAt, status: !alive.length ? "lost" : cardAt === null ? "hidden" : "visible" });
  });
  return views;
}
