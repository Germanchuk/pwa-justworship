/**
 * Одноразове перенесення пісні зі старого документа (дерево Slate з
 * секціями) у модель пісні. Після переходу всіх пісень — видалити.
 *
 * Правила (Герман, 2026-10-18; журнал `.scratch/segments-lanes/`):
 *  - секції зникають; порожній рядок між ними — порожній рядок пісні;
 *    повтор `x2` — секція прописана двічі (примітки — лише в першій копії);
 *    згортання викидається;
 *  - рядок акордів + рядок слів під ним — один рядок пісні; акорди без слів
 *    під собою — рядок самих акордів;
 *  - рядки, про які вирішено вручну (`RowDecision`): мітка структури → `/…`,
 *    мітка з акордами → `/мітка` і рядок акордів під нею, «слова», що насправді
 *    акорди, → акорди;
 *  - примітка — лише на одному рядку й одній доріжці: багаторядкова
 *    обрізається до першого рядка, на акордах і словах разом — лише слова;
 *    підсвітка без запису — примітка з порожнім текстом;
 *  - динаміка секції розкладається по її відрізках пропорційно, як смужка
 *    градієнта; особисте (капо, сховані доріжки) — у мапи ніків.
 */
import * as Y from "yjs";
import { isDynamicsStepKey } from "../model/dynamicsSteps";
import { addNote, ALL, LaneType, LineInit, NoteRecord, songOf, writeCapo, writeHiddenLanes, writeMeta } from "../model";
import { appendLines } from "../model/song";

/** Вузол старого документа — лише те, що конвертер читає. */
export type OldNode = { type?: string; text?: string; children?: OldNode[]; [key: string]: unknown };

/** Ручне рішення про рядок секції: номер секції (з 1) і рядка в ній (з 0) плюс точний текст. */
export type RowDecision = {
  sec: number;
  row: number;
  text: string;
  as: "note" | "note+chords" | "chords";
  note?: string;
  chords?: string;
};

type OldMark = { commentId: string; visibleFor?: string[]; color?: string; author?: string };
type OldRecord = { body?: string; color?: string; visibleFor?: string[]; author?: string };

/**
 * Шматок рядка пісні зі старого рядка: де він був у старому тексті
 * (`from…to`, у новому — зі зсувом `shift`). `alone` — акорди з мітки
 * (`[CHORUS] G A Hm D`): схема секції, а не акорди над словами під нею.
 */
type Piece = { lane: LaneType; text: string; child: number; from: number; to: number; shift: number; alone?: true };
type Row = { chords?: Piece; words?: Piece };
type Span = { row: number; lane: LaneType; from: number; to: number };

export type Converted = { doc: Y.Doc; warnings: string[] };

const textOf = (node: OldNode): string =>
  (node.children ?? []).map((child) => (typeof child.text === "string" ? child.text : textOf(child))).join("");

const leading = (text: string) => text.length - text.trimStart().length;

/** Старий рядок секції → шматки нового (з урахуванням ручного рішення). */
function piecesOf(child: OldNode, index: number, decision: RowDecision | undefined): Piece[] {
  const text = textOf(child);
  const whole = (lane: LaneType): Piece => ({ lane, text, child: index, from: 0, to: text.length, shift: 0 });
  if (!decision) {
    if (child.type === "chord-line") return [whole("chords")];
    if (child.type === "line") return [whole("words")];
    return []; // empty-line всередині секції обробляє виклик
  }
  if (decision.as === "chords") return [whole("chords")];
  const lead = leading(text);
  if (decision.as === "note") {
    const label = text.trim();
    return [{ lane: "words", text: "/" + label, child: index, from: lead, to: lead + label.length, shift: 1 }];
  }
  const chords = decision.chords ?? "";
  const cut = text.lastIndexOf(chords);
  const label = (decision.note ?? "/").slice(1);
  return [
    { lane: "words", text: "/" + label, child: index, from: lead, to: lead + label.length, shift: 1 },
    { lane: "chords", text: chords, child: index, from: cut, to: cut + chords.length, shift: 0, alone: true },
  ];
}

/** Шматки → рядки пісні: акорди беруть слова під собою, якщо вони є. */
function pairRows(pieces: Piece[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const next = pieces[i + 1];
    if (p.lane === "chords" && !p.alone && next?.lane === "words" && !next.text.startsWith("/")) {
      rows.push({ chords: p, words: next });
      i++;
    } else rows.push(p.lane === "chords" ? { chords: p } : { words: p });
  }
  return rows;
}

const isSegment = (row: Row) => !row.words?.text.startsWith("/") && !!(row.words?.text || row.chords?.text);

export function convertSong(nodes: OldNode[], decisions: RowDecision[] = []): Converted {
  const warnings: string[] = [];
  const doc = new Y.Doc();
  const song = songOf(doc);
  const [nameNode, metaRow, ...body] = nodes;
  if (nameNode?.type !== "song-name" || metaRow?.type !== "song-meta-row") throw new Error("немає шапки пісні");

  const used = new Set<RowDecision>();
  const decisionAt = (sec: number, row: number, text: string) => {
    const d = decisions.find((x) => x.sec === sec && x.row === row);
    if (!d) return undefined;
    if (d.text !== text) throw new Error(`рішення ${sec}/${row} застаріло: було ${JSON.stringify(d.text)}, тепер ${JSON.stringify(text)}`);
    used.add(d);
    return d;
  };

  const lines: LineInit[] = [];
  const spans = new Map<string, Span[]>(); // commentId → де позначено (лише перша копія секції)
  const marks = new Map<string, OldMark>();

  /** Позначки старих рядків секції → місця в рядках пісні (`where`: шматок → номер рядка). */
  const collectMarks = (section: OldNode[], where: Map<Piece, number>) => {
    section.forEach((child, index) => {
      let offset = 0;
      for (const leaf of child.children ?? []) {
        const len = (leaf.text ?? "").length;
        for (const mark of (leaf.comment as OldMark[] | undefined) ?? []) {
          marks.set(mark.commentId, marks.get(mark.commentId) ?? mark);
          for (const [piece, row] of where) {
            if (piece.child !== index) continue;
            const from = Math.max(offset, piece.from);
            const to = Math.min(offset + len, piece.to);
            if (to <= from) continue;
            const list = spans.get(mark.commentId) ?? [];
            list.push({ row, lane: piece.lane, from: from - piece.from + piece.shift, to: to - piece.from + piece.shift });
            spans.set(mark.commentId, list);
          }
        }
        offset += len;
      }
    });
  };

  let sec = 0;
  for (const node of body) {
    if (node.type === "empty-line") {
      lines.push({});
      continue;
    }
    if (node.type !== "section") {
      warnings.push(`вузол ${node.type} поза секцією — як рядок`);
    }
    const section = node.type === "section" ? node.children ?? [] : [node];
    if (node.type === "section") sec++;
    // Порожній рядок усередині секції ділить пари так само, як між секціями (`null` — порожній рядок).
    const groups: Piece[][] = [[]];
    section.forEach((child, index) => {
      if (child.type === "empty-line") return groups.push([]);
      if (child.type !== "line" && child.type !== "chord-line") {
        warnings.push(`секція ${sec}: вузол ${child.type} пропущено`);
        return;
      }
      const decision = node.type === "section" ? decisionAt(sec, index, textOf(child)) : undefined;
      groups[groups.length - 1].push(...piecesOf(child, index, decision));
    });
    const rows: (Row | null)[] = groups.flatMap((g, i) => (i ? [null, ...pairRows(g)] : pairRows(g)));

    const repeat = typeof node.repeat === "number" && node.repeat > 1 ? node.repeat : 1;
    const steps = ((node.dynamicsSteps as unknown[]) ?? []).filter(isDynamicsStepKey);
    const segments = rows.filter((r): r is Row => !!r && isSegment(r));
    for (let copy = 0; copy < repeat; copy++) {
      if (copy) lines.push({});
      const where = new Map<Piece, number>();
      rows.forEach((row) => {
        if (!row) return lines.push({});
        const j = segments.indexOf(row);
        const dynamics = steps.length && j >= 0 ? steps[Math.floor((j * steps.length) / segments.length)] : null;
        [row.chords, row.words].forEach((p) => p && where.set(p, lines.length));
        lines.push({ chords: row.chords?.text ?? "", words: row.words?.text ?? "", dynamics });
      });
      if (copy === 0) collectMarks(section, where); // примітки — лише в першій копії
    }
  }
  decisions.filter((d) => !used.has(d)).forEach((d) => warnings.push(`рішення ${d.sec}/${d.row} не знайшло рядка`));
  if (!lines.length) lines.push({});

  doc.transact(() => {
    appendLines(song, lines);
    writeMeta(doc, {
      name: textOf(nameNode),
      bpm: Number.parseInt(textOf(child(metaRow, "bpm")), 10) || 0,
      timeSignature: textOf(child(metaRow, "time-signature")) || "4/4",
      key: (child(metaRow, "song-key").keyValue as string) || "C",
    });
    const capo = child(metaRow, "capo");
    for (const [nick, fret] of Object.entries((capo.valuesBy as Record<string, number>) ?? {})) {
      if (fret) writeCapo(doc, nick, { fret });
    }
    for (const nick of (capo.disabledFor as string[]) ?? []) writeCapo(doc, nick, { off: true });
    const hidden = new Map<string, LaneType[]>();
    for (const [key, lane] of [["chordsHiddenFor", "chords"], ["lyricsHiddenFor", "words"]] as const) {
      for (const nick of (metaRow[key] as string[]) ?? []) hidden.set(nick, [...(hidden.get(nick) ?? []), lane]);
    }
    hidden.forEach((lanes, nick) => writeHiddenLanes(doc, nick, lanes));

    const recordIds = Object.keys(metaRow).filter((k) => k.startsWith("note:")).map((k) => k.slice(5));
    for (const id of new Set([...recordIds, ...spans.keys()])) {
      const where = spans.get(id);
      if (!where?.length) {
        warnings.push(`примітка ${id} без позначок — пропущено`);
        continue;
      }
      const row = Math.min(...where.map((s) => s.row));
      const inRow = where.filter((s) => s.row === row);
      const lane: LaneType = inRow.some((s) => s.lane === "words") ? "words" : "chords";
      const inLane = inRow.filter((s) => s.lane === lane);
      const record = (metaRow[`note:${id}`] as OldRecord | undefined) ?? {};
      const mark = marks.get(id) ?? ({} as OldMark);
      const note: Omit<NoteRecord, "anchor" | "focus" | "quote"> = {
        id,
        author: record.author ?? mark.author ?? "",
        visibleFor: record.visibleFor ?? mark.visibleFor ?? [ALL],
        color: record.color ?? mark.color ?? "",
        body: record.body ?? "",
      };
      addNote(song, row, lane, Math.min(...inLane.map((s) => s.from)), Math.max(...inLane.map((s) => s.to)), note);
    }
  });
  return { doc, warnings };
}

function child(row: OldNode, type: string): OldNode {
  return (row.children ?? []).find((c) => c.type === type) ?? {};
}
