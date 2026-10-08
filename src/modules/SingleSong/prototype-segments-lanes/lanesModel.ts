/**
 * PROTOTYPE (гілка `prototype/segments-lanes`) — ітерація 2: мокова пісня,
 * примітки на текстових доріжках, транспонування рядка акордів. Без DOM.
 */
import * as Y from "yjs";
import { Editor, Node, Range } from "slate";
import { relativeRangeToSlateRange, slateRangeToRelativeRange } from "@slate-yjs/core";
import { makePair, Peer, Segment } from "./harness";
import { LaneType, segment, withTextLanes } from "./textLanes";
import { transposeName } from "./model";

export const MOCK_SONG = [
  segment("Куплет 1", "", { heading: true }),
  //       0123456789012345678
  segment("Ти святий, Господь", "Am F       C   G", { dyn: 2, "cajon:1.1": "B", "cajon:1.5": "t" }),
  segment("Твоє світло серед ночі", "F    C      G     Am"),
  segment("Приспів", "", { heading: true }),
  segment("Алилуя, алилуя", "F       G", {
    dyn: 4,
    "cajon:1.1": "B",
    "cajon:1.3": "t",
    "cajon:1.5": "B",
    "cajon:1.6": "B",
    "cajon:1.7": "t",
  }),
  segment("Слава Тобі навіки (x2)", "Am    F    C   G"),
];

export function makeLanesPair(base: () => Editor) {
  return makePair(MOCK_SONG as unknown as Segment[], { base, extend: (p) => withTextLanes(p.editor) });
}

// ── примітки ───────────────────────────────────────────────────────────────

/** Мітка — діапазон символів в одній текстовій доріжці. */
export type TextMark = { lane: LaneType; anchor: unknown; focus: unknown; quote: string };
export type LaneNote = { id: string; text: string; author: string; marks: TextMark[] };

export const laneNotes = (p: Peer) => p.doc.getMap<LaneNote>("laneNotes");

export function textMark(p: Peer, range: Range): TextMark | null {
  const [s, l] = range.anchor.path;
  const [fs, fl] = range.focus.path;
  if (s !== fs || l !== fl || Range.isCollapsed(range)) return null;
  const rel = slateRangeToRelativeRange(p.root, p.editor, range);
  return {
    lane: (Node.get(p.editor, [s, l]) as unknown as { type: LaneType }).type,
    anchor: Y.relativePositionToJSON(rel.anchor),
    focus: Y.relativePositionToJSON(rel.focus),
    quote: Editor.string(p.editor, range),
  };
}

export type ResolvedTextMark = { mark: TextMark; seg: number | null; range?: Range; lost: boolean };
export type LaneNoteView = {
  note: LaneNote;
  marks: ResolvedTextMark[];
  cardAt: number | null;
  status: "visible" | "hidden" | "lost";
};

export function resolveLaneNotes(p: Peer, visible: Record<LaneType, boolean>): LaneNoteView[] {
  const out: LaneNoteView[] = [];
  laneNotes(p).forEach((note) => {
    const marks = note.marks.map((m): ResolvedTextMark => {
      const r = relativeRangeToSlateRange(p.root, p.editor, {
        anchor: Y.createRelativePositionFromJSON(m.anchor),
        focus: Y.createRelativePositionFromJSON(m.focus),
      });
      if (!r || Range.isCollapsed(r)) return { mark: m, seg: null, lost: true };
      return { mark: m, seg: Range.start(r).path[0], range: r, lost: false };
    });
    const alive = marks.filter((m) => !m.lost);
    const shown = alive.filter((m) => visible[m.mark.lane]);
    const cardAt = shown.length ? Math.min(...shown.map((m) => m.seg!)) : null;
    out.push({ note, marks, cardAt, status: !alive.length ? "lost" : cardAt == null ? "hidden" : "visible" });
  });
  return out;
}

// ── транспонування рядка акордів (лише показ, особисте) ─────────────────────

/** Кожен токен лишається на своїй колонці; довший — відсуває наступний. */
export function transposeLine(line: string, semis: number) {
  if (!semis) return line;
  let out = "";
  for (const m of line.matchAll(/\S+/g)) {
    const col = Math.max(m.index!, out.length ? out.length + 1 : 0);
    out = out.padEnd(col, " ") + (/^[A-G]/.test(m[0]) ? transposeName(m[0], semis) : m[0]);
  }
  return out;
}
