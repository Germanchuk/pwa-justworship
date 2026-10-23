/**
 * Курсор у клітинковій доріжці (ADR-0008). Для Slate доріжка — атомний вузол;
 * усередині нього в кожного свій курсор-крок: стрілки ходять по кроках (у табах
 * і кахоні ↑↓ — по лініях), символ пишеться за синтаксисом виду, Backspace стирає крок.
 * Дійшли до краю — стрілку обробляє Slate: курсор виходить у сусідню доріжку.
 *
 * Доріжка — псевдо-текст, і кроки в ній виділяються, як символи: протяг
 * мишею, довгий натиск і протяг пальцем, Shift+стрілки. Виділене — проміжок
 * часу рядка (тіки, `cellSpan`), у будь-якому режимі: на ньому ставлять
 * примітку, а в правці — стирають (Backspace/Delete).
 */
import * as Y from "yjs";
import { Editor, Path, Range, Transforms } from "slate";
import {
  allLanes,
  barSizes,
  cellSpan,
  endOf,
  eraseSpan,
  lineLength,
  CellAt,
  CellKind,
  eraseCell,
  isTextKind,
  Line,
  parseCells,
  readMeta,
  renderCells,
  rowsOf,
  scaleOf,
  typeCell,
  writeParsed,
} from "../model";
import type { History } from "./history";
import { isCellsNode, laneOfNode } from "./projection";
import { COMMAND, TYPING, ViewState } from "./state";

export type CellCursor = { line: Line; lane: string; kind: CellKind; at: CellAt; prev: string | null };
/** Виділені кроки доріжки `lane` рядка `line`: `from…to` — тіки від початку рядка (кінець не входить). */
export type CellSelection = { line: Line; lane: string; from: number; to: number };

export type Cells = {
  /** Курсор цього учасника в клітинковій доріжці; `null` — він не в ній. */
  cursor: () => CellCursor | null;
  /** Поставити курсор на крок доріжки-вузла `path` (клік по кроку). */
  place: (path: Path, at: CellAt) => void;
  /** Клавіша, поки курсор у доріжці: `true` — оброблено (не пускати далі в Slate). */
  key: (e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }) => boolean;
  /** Друк тексту в доріжку (з клавіатури телефона — через Slate); `false` — курсор не в доріжці. */
  type: (text: string) => boolean;
  /** Вставка тексту доріжки з буфера; `false` — курсор не в доріжці. */
  paste: (text: string) => boolean;
  /** Виділені кроки (в будь-якому режимі); `null` — нічого не виділено. */
  selection: () => CellSelection | null;
  /**
   * Виділити кроки (`null` — зняти). `anchor` — комірка, від якої тягнуть
   * (Shift+стрілки ведуть від неї); у правці курсор стає на `focus`.
   */
  select: (sel: CellSelection | null, ends?: { anchor: number; focus: number; string: number }) => void;
  /** Підписатися на рух курсора й виділення; повертає відписку. */
  listen: (fn: () => void) => () => void;
};

const kindOf = (s: ViewState, id: string) => allLanes(s.song.doc).find((l) => l.id === id)?.kind;
/** Масштаб доріжки виду `kind` для цієї людини. */
export const scaleIn = (s: ViewState, kind: CellKind) => scaleOf(kind, readMeta(s.song.doc).timeSignature, s.display.zoom);
/** Такти рядка в комірках масштабу виду `kind` (довжина рядка спільна для всіх його доріжок). */
const sizesIn = (s: ViewState, line: Line, kind: CellKind) => {
  const { timeSignature } = readMeta(s.song.doc);
  return barSizes(lineLength(line, timeSignature), timeSignature, scaleIn(s, kind));
};
const slotOf = (c: CellCursor) => c.line.get(c.lane) as Y.Map<unknown> | undefined;

/** Доріжка текстом (для буфера) — так само, як її показує редактор. */
export function cellText(s: ViewState, line: Line, id: string): string[] {
  const kind = kindOf(s, id);
  const slot = line.get(id) as Y.Map<unknown> | undefined;
  if (!kind || isTextKind(kind) || !slot) return [];
  const cells = slot.get("cells") as Y.Map<string>;
  return renderCells(kind, cells.entries(), sizesIn(s, line, kind), scaleIn(s, kind));
}

export function installCells(s: ViewState, history: History): Cells {
  const { view } = s;
  let cursor: CellCursor | null = null;
  let selected: CellSelection | null = null;
  /** Комірка, від якої тягнуть виділення (у масштабі людини). */
  let anchor: number | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  /** Де зараз виділення: у клітинковій доріжці — курсор у ній, інакше — немає. */
  const sync = () => {
    const sel = view.selection;
    const path = sel && Range.isCollapsed(sel) ? sel.anchor.path.slice(0, 2) : null;
    const node = path && path.length === 2 && Editor.hasPath(view, path) ? Editor.node(view, path)[0] : null;
    const lane = node ? laneOfNode(node) : null;
    const src = path ? s.sources[path[0]] : null;
    const kind = node && isCellsNode(node) && lane ? kindOf(s, lane) : undefined;
    if (!src || !lane || !kind || isTextKind(kind)) {
      if (cursor) {
        cursor = null;
        notify();
      }
      return;
    }
    if (cursor?.line === src.line && cursor.lane === lane) return;
    cursor = { line: src.line, lane, kind, at: { step: 0, string: 0 }, prev: null };
    notify();
  };
  const { onChange } = view;
  view.onChange = (options) => {
    sync();
    onChange(options);
  };

  /** Курсор зараз — виділення могло змінитись без onChange (Slate повідомляє згодом). */
  const current = () => (sync(), cursor);

  /** Правка доріжки під курсором — через історію, як і решта правок. */
  const edit = (origin: symbol, fn: (c: CellCursor, slot: Y.Map<unknown>) => void) => {
    const c = current();
    const slot = c && slotOf(c);
    if (!c || !slot) return;
    history.before();
    if (origin === COMMAND) s.undoManager.stopCapturing();
    s.song.doc.transact(() => fn(c, slot), origin);
    if (origin === COMMAND) s.undoManager.stopCapturing();
    history.after();
    notify();
  };
  const move = (at: CellAt) => {
    cursor = { ...cursor!, at, prev: null };
    notify();
    return true;
  };
  const select = (sel: CellSelection | null, from: number | null = null) => {
    selected = sel;
    anchor = sel ? from : null;
    notify();
  };
  /** Кроки `a…b` (комірки масштабу, у будь-якому порядку) доріжки під курсором. */
  const span = (c: CellCursor, a: number, b: number): CellSelection => {
    const scale = scaleIn(s, c.kind);
    return { line: c.line, lane: c.lane, from: cellSpan(scale, Math.min(a, b))[0], to: cellSpan(scale, Math.max(a, b))[1] };
  };
  /** Виділене — у доріжці під курсором. */
  const selectedHere = (c: CellCursor) => (selected && selected.line === c.line && selected.lane === c.lane ? selected : null);
  const type = (text: string) => {
    if (!current()) return false;
    if (selected) select(null);
    edit(TYPING, (c, slot) => {
      for (const ch of text) {
        c.at = typeCell(c.kind, slot, scaleIn(s, c.kind), c.at, ch, c.prev, endOf(sizesIn(s, c.line, c.kind), scaleIn(s, c.kind)));
        c.prev = ch;
      }
    });
    return true;
  };

  return {
    cursor: current,
    place: (path, at) => {
      Transforms.select(view, Editor.start(view, path));
      sync();
      if (cursor) move(at);
    },
    key: (e) => {
      const c = current();
      if (!c || e.metaKey || e.ctrlKey || e.altKey) return false;
      const total = endOf(sizesIn(s, c.line, c.kind), scaleIn(s, c.kind));
      const { step, string } = c.at;
      const sel = selectedHere(c);
      // Shift+←/→ — виділення від комірки, де почали, до курсора.
      if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const to = Math.max(0, Math.min(total - 1, step + (e.key === "ArrowLeft" ? -1 : 1)));
        const from = sel && anchor !== null ? anchor : step;
        move({ step: to, string });
        select(span(c, from, to), from);
        return true;
      }
      if (e.key === "Escape") {
        if (!selected) return false;
        select(null);
        return true;
      }
      if (sel && (e.key === "Backspace" || e.key === "Delete")) {
        edit(COMMAND, (cur, slot) => eraseSpan(cur.kind, slot, sel.from, sel.to, readMeta(s.song.doc).timeSignature));
        select(null);
        return true;
      }
      if (selected) select(null); // будь-яка інша клавіша — виділення вже не те
      switch (e.key) {
        case "ArrowLeft":
          return step > 0 && move({ step: step - 1, string });
        case "ArrowRight":
          return step < total - 1 && move({ step: step + 1, string });
        case "ArrowUp":
          return string > 0 && move({ step, string: string - 1 });
        case "ArrowDown":
          return string < rowsOf(c.kind).length - 1 && move({ step, string: string + 1 });
        case "Home":
          return move({ step: 0, string });
        case "End":
          return move({ step: total - 1, string });
        case "Backspace":
        case "Delete":
          edit(COMMAND, (cur, sl) => {
            cur.at = eraseCell(cur.kind, sl, scaleIn(s, cur.kind), cur.at, e.key === "Backspace");
            cur.prev = null;
          });
          return true;
        case "Enter":
          return true; // у доріжці Enter нічого не робить
        default:
          return e.key.length === 1 && type(e.key);
      }
    },
    type,
    selection: () => selected,
    select: (sel, ends) => {
      select(sel, ends?.anchor ?? null);
      // У правці курсор стає туди, куди дотягли (як у тексті).
      if (sel && ends && cursor && cursor.line === sel.line && cursor.lane === sel.lane) move({ step: ends.focus, string: ends.string });
    },
    paste: (text) => {
      const c = current();
      if (!c) return false;
      const parsed = parseCells(c.kind, text.split(/\r?\n/).filter((l) => l.trim()), scaleIn(s, c.kind));
      if (parsed) edit(COMMAND, (cur, slot) => writeParsed(cur.line, slot, parsed, readMeta(s.song.doc).timeSignature));
      return true;
    },
    listen: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
