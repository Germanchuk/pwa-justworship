/**
 * PROTOTYPE (гілка `prototype/segments-lanes`) — ітерація 2: мокова пісня,
 * примітки на текстових доріжках, транспонування рядка акордів. Без DOM.
 */
import * as Y from "yjs";
import { Editor, Node, Range } from "slate";
import { relativeRangeToSlateRange, slateRangeToRelativeRange, withYHistory } from "@slate-yjs/core";
import { makePair, Peer, Segment } from "./harness";
import { LaneType, line, lineKind, withTextLanes } from "./textLanes";
import { transposeName } from "./model";

export const MOCK_SONG = [
  line("/Куплет 1"),
  // Пробіли підібрано під шрифт редактора (Manrope), як вирівнює людина на око.
  line("Ти святий, Господь", "Am F               C       G", { "cajon:1.1": "B", "cajon:1.5": "t" }),
  line("Твоє світло серед ночі", "F          C             G            Am"),
  line(""),
  line("/Приспів"),
  line("Алилуя, алилуя", "F                 G", {
    "cajon:1.1": "B",
    "cajon:1.3": "t",
    "cajon:1.5": "B",
    "cajon:1.6": "B",
    "cajon:1.7": "t",
  }),
  line("Слава Тобі навіки (x2)", "Am        F        C      G"),
];

export function makeLanesPair(base: () => Editor) {
  return makePair(MOCK_SONG as unknown as Segment[], {
    base,
    extend: (p) => {
      withTextLanes(p.editor);
      withYHistory(p.editor as never); // undo — штатний, у повному дереві
    },
  });
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

/**
 * Чи видно доріжку рядка цьому учасникові. Структурна примітка (`/…`) видна
 * завжди, незалежно від галочок показу (Герман, 2026-10-09).
 */
export function laneShown(editor: Editor, ln: number, lane: LaneType, visible: Record<LaneType, boolean>) {
  return visible[lane] || (lane === "words" && lineKind(editor, ln) === "note");
}

export type LaneDisplay = Record<LaneType, boolean>;

/**
 * Що учасник бачить і може правити в доріжці рядка (його особисті галочки).
 * Схована доріжка не існує для курсору й правок — «що бачу, те й пишу».
 *  - структурна примітка: слова видно й можна правити завжди, акордів немає;
 *  - порожній рядок: видно завжди; друкуєш у видиму доріжку — у слова, якщо
 *    вони показуються, інакше в акорди; рядок акордів над словами — лише під
 *    курсором; якщо сховано все — рядок видно, але писати в нього не можна;
 *  - відрізок: доріжку видно й можна правити, якщо вона показується.
 */
export function laneAccess(editor: Editor, ln: number, lane: LaneType, display: LaneDisplay, caretLine: number | null) {
  const kind = lineKind(editor, ln);
  if (kind === "note") return { shown: lane === "words", editable: lane === "words" };
  if (kind === "empty") {
    if (lane === "words") return { shown: display.words || !display.chords, editable: display.words };
    const shown = display.chords && (caretLine === ln || !display.words);
    return { shown, editable: shown };
  }
  return { shown: display[lane], editable: display[lane] };
}

/**
 * Наскрізне виділення → по шматку на кожну видиму доріжку кожного рядка,
 * який воно зачіпає. Сховані доріжки в позначку не потрапляють.
 */
export function textMarks(p: Peer, range: Range, visible: Record<LaneType, boolean>): TextMark[] {
  const [start, end] = Range.edges(range);
  const out: TextMark[] = [];
  for (let ln = start.path[0]; ln <= end.path[0]; ln++) {
    const line = p.editor.children[ln] as unknown as { children: { type: LaneType }[] };
    line.children.forEach((laneNode, l) => {
      if (!laneShown(p.editor, ln, laneNode.type, visible)) return;
      const piece = Range.intersection(range, Editor.range(p.editor, [ln, l]));
      if (!piece || Range.isCollapsed(piece) || !Editor.string(p.editor, piece).trim()) return;
      const m = textMark(p, piece);
      if (m) out.push(m);
    });
  }
  return out;
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
    const shown = alive.filter((m) => laneShown(p.editor, m.seg!, m.mark.lane, visible));
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
