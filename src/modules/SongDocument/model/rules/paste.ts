/** Вставка простого тексту з буфера — зі свого редактора чи ззовні (сайт з акордами, табами). */
import * as Y from "yjs";
import { isChordsLine } from "#utils/keyUtils";
import { DEFAULT_ZOOM, parseCells, Parsed, recognizeCells, Scale, scaleOf, writeParsed } from "../cells";
import { CellKind, songLanes } from "../lanes";
import { readMeta } from "../meta";
import { chordsOf, lineAt } from "../read";
import type { Pos, Song } from "../song";
import { splitLine } from "./enter";
import { insertText } from "./slash";

/** Рядок пісні, зібраний із рядків тексту: слова, акорди й клітинкові доріжки (id → вміст). */
export type Pasted = { chords: string; words: string; cells: Record<string, Parsed> };

const empty = (): Pasted => ({ chords: "", words: "", cells: {} });

/**
 * Рядки тексту → рядки пісні (ADR-0008). Кожен рядок (для табів — шість)
 * розпізнається: таби, кахон, прямокутники, акорди (той самий розпізнавач, що
 * в бойовому редакторі) або слова. Сусідні збираються в один рядок пісні в
 * порядку доріжок `order` (згори донизу; слова — найнижчі): шматок, якому в
 * зібраному вже немає місця нижче, починає новий рядок. Тож акорди беруть
 * слова під собою, k-ті таби групи йдуть у k-ту доріжку табів. Таби, кахон і
 * прямокутники, для яких у пісні немає доріжки, лишаються словами. Порожній
 * рядок — роздільник: окремий порожній рядок пісні.
 */
export function groupLines(
  lines: string[],
  order: readonly { id: string; kind: string }[] = [],
  scale: (kind: CellKind) => Scale = (kind) => scaleOf(kind, "4/4"),
): Pasted[] {
  // Без списку доріжок — лише акорди над словами.
  const lanes = order.length ? order : [{ id: "chords", kind: "chords" }, { id: "words", kind: "words" }];
  const out: Pasted[] = [];
  let cur: Pasted | null = null;
  let last = -1;
  const flush = () => {
    if (cur) out.push(cur);
    cur = null;
    last = -1;
  };
  /** Покласти шматок у доріжку виду `kind`: перша така доріжка нижче за вже зібране, інакше — новий рядок. */
  const place = (kind: string, put: (row: Pasted, id: string) => void) => {
    const spots = lanes.map((lane, i) => ({ ...lane, i })).filter((lane) => lane.kind === kind);
    let spot = spots.find((lane) => lane.i > last);
    if (!spot) {
      flush();
      spot = spots[0];
    }
    cur ??= empty();
    put(cur, spot.id);
    last = spot.i;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      out.push({ ...empty(), words: line });
      continue;
    }
    const found = recognizeCells(lines, i);
    const parsed = found && lanes.some((l) => l.kind === found.kind) && parseCells(found.kind, lines.slice(i, i + found.size), scale(found.kind));
    if (found && parsed) {
      place(found.kind, (row, id) => (row.cells[id] = parsed));
      i += found.size - 1;
      continue;
    }
    const lane = isChordsLine(line) ? "chords" : "words";
    const at = lanes.findIndex((l) => l.kind === lane);
    if (at <= last) flush();
    cur ??= empty();
    cur[lane] = line;
    last = at;
  }
  flush();
  return out;
}

/**
 * У словах рядки стають рядками (як Enter), акорди — в акорди свого рядка
 * (дописуються в кінець, якщо там уже щось є), клітинкові доріжки — у свої
 * доріжки рядка (замінюють вміст; символ — комірка масштабу `zoom` того, хто
 * вставляє). В акордах усе — одним рядком через пробіл.
 */
export function insertPlainText(song: Song, at: Pos, pasted: string, zoom: number = DEFAULT_ZOOM): Pos {
  const parts = pasted.split(/\r?\n/);
  // У будь-яку доріжку, крім слів (акорди, вигуки), — одним рядком через пробіл.
  if (at.lane !== "words") return insertText(song, at, parts.join(" ")) ?? at;
  const order = songLanes(song.doc).map(({ id, kind }) => ({ id, kind }));
  const { timeSignature } = readMeta(song.doc);
  return groupLines(parts, order, (kind) => scaleOf(kind, timeSignature, zoom)).reduce<Pos>((pos, { chords, words, cells }, i) => {
    const here = i > 0 ? splitLine(song, pos) ?? pos : pos;
    const line = lineAt(song, here.line).line;
    if (chords) {
      const lane = chordsOf(line);
      lane.insert(lane.length, (lane.length ? " " : "") + chords);
    }
    Object.entries(cells).forEach(([id, parsed]) => {
      const slot = line.get(id);
      if (slot instanceof Y.Map) writeParsed(line, slot, parsed, timeSignature);
    });
    return words ? insertText(song, here, words) ?? here : here;
  }, at);
}

