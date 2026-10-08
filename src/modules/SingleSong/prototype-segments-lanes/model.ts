/**
 * PROTOTYPE (гілка `prototype/segments-lanes`) — викинути після оцінки ADR-0006.
 *
 * Варіанти правила для акордів, мокова пісня, примітки й «як попередньо» —
 * без DOM, поверх `harness.ts`. Сторінка лише викликає це.
 */
import * as Y from "yjs";
import { Editor, Node, Range } from "slate";
import { relativeRangeToSlateRange, slateRangeToRelativeRange } from "@slate-yjs/core";
import {
  addChordOnSegment,
  addChordStored,
  chordsOnSegments,
  chordsStored,
  makePair,
  Peer,
  removeChordOnSegment,
  removeChordStored,
  renameChordOnSegment,
  renameChordStored,
  Segment,
  withEmptySecondHalf,
  withMergeRemap,
} from "./harness";

// ── варіанти ───────────────────────────────────────────────────────────────

export type VariantId = "A" | "A-rule" | "B" | "B-fixed";

export const VARIANTS: Record<
  VariantId,
  { title: string; short: string; storage: "segment" | "stored"; emptySecondHalf: boolean; mergeRemap: boolean }
> = {
  A: {
    title: "A · ключ chord:<id> на відрізку (як в ADR)",
    short: "Без додаткових правил: як Slate і @slate-yjs роблять самі.",
    storage: "segment",
    emptySecondHalf: false,
    mergeRemap: false,
  },
  "A-rule": {
    title: "A + «другій половині — порожньо»",
    short: "Правило Германа: при Enter усі атрибути лишаються першій половині.",
    storage: "segment",
    emptySecondHalf: true,
    mergeRemap: false,
  },
  B: {
    title: "B · позиції акордів у бібліотеці (stored positions)",
    short: "Акорд — позиція, яку @slate-yjs сама переносить при діленні/злитті.",
    storage: "stored",
    emptySecondHalf: false,
    mergeRemap: false,
  },
  "B-fixed": {
    title: "B + виправлене злиття + «другій половині — порожньо»",
    short: "B, плюс ~25 рядків: обхід бага злиття й правило для інших атрибутів.",
    storage: "stored",
    emptySecondHalf: true,
    mergeRemap: true,
  },
};

export type ChordView = {
  id: string;
  name: string;
  /** спосіб A: відрізок, на якому лежить ключ */
  storedOn?: number;
  seg: number | null;
  offset: number | null;
  char: string | null;
};

export function chordOps(variant: VariantId) {
  const v = VARIANTS[variant];
  if (v.storage === "segment") {
    return {
      add: (p: Peer, seg: number, offset: number, id: string, name: string) =>
        addChordOnSegment(p, seg, offset, id, name),
      remove: (p: Peer, c: ChordView) => removeChordOnSegment(p, c.storedOn!, c.id),
      rename: (p: Peer, c: ChordView, name: string) => renameChordOnSegment(p, c.storedOn!, c.id, name),
      list: (p: Peer): ChordView[] => chordsOnSegments(p),
      /** На якому відрізку малювати: там, де лежить ключ. */
      home: (c: ChordView) => c.storedOn!,
    };
  }
  return {
    add: (p: Peer, seg: number, offset: number, id: string, name: string) =>
      addChordStored(p, seg, offset, id, name),
    remove: (p: Peer, c: ChordView) => removeChordStored(p, c.id),
    rename: (p: Peer, c: ChordView, name: string) => renameChordStored(p, c.id, name),
    list: (p: Peer): ChordView[] => chordsStored(p),
    home: (c: ChordView) => c.seg,
  };
}

// ── мокова пісня ───────────────────────────────────────────────────────────

const seg = (text: string, props: Record<string, unknown> = {}): Segment => ({
  type: "segment",
  children: [{ text }],
  ...props,
});

/** Відрізки й акорди (офсет символу → акорд). Індекси використовують сценарії. */
export const MOCK_SONG: { segment: Segment; chords: [number, string][] }[] = [
  { segment: seg("Куплет 1", { heading: true }), chords: [] },
  {
    //             0123456789012345678
    segment: seg("Ти святий, Господь", { dyn: 2, "cajon:1.1": "B", "cajon:1.5": "t" }),
    chords: [
      [0, "Am"],
      [3, "F"],
      [11, "C"],
      [15, "G"],
    ],
  },
  {
    //            0123456789012345678901
    segment: seg("Твоє світло серед ночі"),
    chords: [
      [0, "F"],
      [5, "C"],
      [12, "G"],
      [18, "Am"],
    ],
  },
  { segment: seg("Приспів", { heading: true }), chords: [] },
  {
    //            012345678901234
    segment: seg("Алилуя, алилуя", {
      dyn: 4,
      "cajon:1.1": "B",
      "cajon:1.3": "t",
      "cajon:1.5": "B",
      "cajon:1.6": "B",
      "cajon:1.7": "t",
    }),
    chords: [
      [0, "F"],
      [8, "G"],
    ],
  },
  {
    //            0123456789012345678901
    segment: seg("Слава Тобі навіки (x2)"),
    chords: [
      [0, "Am"],
      [6, "F"],
      [11, "C"],
      [15, "G"],
    ],
  },
];

/** id мокового акорду: `<відрізок>-<офсет>` — сценарії посилаються на них. */
export const mockChordId = (segIndex: number, offset: number) => `${segIndex}-${offset}`;

export function makeSongPair(variant: VariantId, base: () => Editor) {
  const v = VARIANTS[variant];
  const pair = makePair(
    MOCK_SONG.map((s) => ({ ...s.segment })),
    {
      base,
      extend: (p) => {
        if (v.emptySecondHalf) withEmptySecondHalf(p);
        if (v.mergeRemap) withMergeRemap(p);
      },
    },
  );
  const ops = chordOps(variant);
  MOCK_SONG.forEach((s, i) => s.chords.forEach(([o, n]) => ops.add(pair.A, i, o, mockChordId(i, o), n)));
  return pair;
}

// ── «як попередньо» ────────────────────────────────────────────────────────

export const CAJON_STEPS = [1, 2, 3, 4, 5, 6, 7, 8];
export const cajonKey = (step: number) => `cajon:1.${step}`;

export function cajonOf(node: Node): Record<number, string> {
  const out: Record<number, string> = {};
  CAJON_STEPS.forEach((s) => {
    const v = (node as Record<string, unknown>)[cajonKey(s)];
    if (typeof v === "string" && v) out[s] = v;
  });
  return out;
}

/** Порожня доріжка = як у найближчому попередньому відрізку, де вона не порожня. */
export function inherited<T>(nodes: Node[], index: number, pick: (n: Node) => T | undefined) {
  for (let i = index - 1; i >= 0; i--) {
    const v = pick(nodes[i]);
    if (v !== undefined) return { value: v, from: i };
  }
  return undefined;
}

// ── примітки ───────────────────────────────────────────────────────────────

export type Mark =
  | { lane: "chords"; chord: string }
  | { lane: "words"; anchor: unknown; focus: unknown; quote: string };

/** Запис примітки не змінюється (як `NoteRecord` у бойовому редакторі). */
export type NoteRecord = { id: string; text: string; author: string; marks: Mark[] };

export const notesMap = (p: Peer) => p.doc.getMap<NoteRecord>("notes");

export function wordsMark(p: Peer, range: Range): Mark {
  const rel = slateRangeToRelativeRange(p.root, p.editor, range);
  return {
    lane: "words",
    anchor: Y.relativePositionToJSON(rel.anchor),
    focus: Y.relativePositionToJSON(rel.focus),
    quote: Editor.string(p.editor, range),
  };
}

export type Visibility = { words: boolean; chords: boolean; cajon: boolean };

export type ResolvedMark = { mark: Mark; seg: number | null; range?: Range; lost: boolean };

export type NoteView = {
  note: NoteRecord;
  marks: ResolvedMark[];
  /** відрізок, над яким картка; null — схована або втрачена */
  cardAt: number | null;
  status: "visible" | "hidden" | "lost";
};

export function resolveNotes(p: Peer, chords: ChordView[], home: (c: ChordView) => number | null, vis: Visibility) {
  const out: NoteView[] = [];
  notesMap(p).forEach((note) => {
    const marks: ResolvedMark[] = note.marks.map((m) => {
      if (m.lane === "chords") {
        const c = chords.find((x) => x.id === m.chord);
        const at = c ? home(c) : null;
        return { mark: m, seg: at ?? null, lost: at == null };
      }
      const r = relativeRangeToSlateRange(p.root, p.editor, {
        anchor: Y.createRelativePositionFromJSON(m.anchor),
        focus: Y.createRelativePositionFromJSON(m.focus),
      });
      if (!r || Range.isCollapsed(r)) return { mark: m, seg: null, lost: true };
      return { mark: m, seg: Range.start(r).path[0], range: r, lost: false };
    });
    const alive = marks.filter((m) => !m.lost);
    const visible = alive.filter((m) => vis[m.mark.lane]);
    const cardAt = visible.length ? Math.min(...visible.map((m) => m.seg!)) : null;
    out.push({
      note,
      marks,
      cardAt,
      status: alive.length === 0 ? "lost" : cardAt == null ? "hidden" : "visible",
    });
  });
  return out;
}

// ── транспонування (особисте, як капо) ─────────────────────────────────────

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

export function transposeName(name: string, semis: number) {
  if (!semis) return name;
  const shift = (root: string) => {
    const i = NOTES.indexOf(FLATS[root] ?? root);
    return i < 0 ? root : NOTES[(i + semis + 120) % 12];
  };
  return name.replace(/^([A-G][#b]?)/, shift).replace(/\/([A-G][#b]?)/, (_, r) => "/" + shift(r));
}
