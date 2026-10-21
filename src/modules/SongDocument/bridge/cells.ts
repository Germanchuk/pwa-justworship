/**
 * Курсор у клітинковій доріжці (ADR-0008). Для Slate доріжка — атомний вузол;
 * усередині нього в кожного свій курсор-крок: стрілки ходять по кроках (у табах
 * ↑↓ — по струнах), символ пишеться за синтаксисом виду, Backspace стирає крок.
 * Дійшли до краю — стрілку обробляє Slate: курсор виходить у сусідню доріжку.
 */
import * as Y from "yjs";
import { Editor, Path, Range, Transforms } from "slate";
import {
  allLanes,
  barsOf,
  CellAt,
  CellKind,
  eraseCell,
  isTextKind,
  Line,
  parseCells,
  readMeta,
  renderCells,
  stepsPerBar,
  typeCell,
  writeParsed,
} from "../model";
import type { History } from "./history";
import { isCellsNode, laneOfNode } from "./projection";
import { COMMAND, TYPING, ViewState } from "./state";

export type CellCursor = { line: Line; lane: string; kind: CellKind; at: CellAt; prev: string | null };

export type Cells = {
  /** Курсор цього учасника в клітинковій доріжці; `null` — він не в ній. */
  cursor: () => CellCursor | null;
  /** Поставити курсор на крок доріжки-вузла `path` (клік по кроку). */
  place: (path: Path, at: CellAt) => void;
  /** Клавіша, поки курсор у доріжці: `true` — оброблено (не пускати далі в Slate). */
  key: (e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }) => boolean;
  /** Друк тексту в доріжку (з клавіатури телефона — через Slate); `false` — курсор не в доріжці. */
  type: (text: string) => boolean;
  /** Вставка тексту доріжки з буфера; `false` — курсор не в доріжці. */
  paste: (text: string) => boolean;
  /** Підписатися на рух курсора; повертає відписку. */
  listen: (fn: () => void) => () => void;
};

const kindOf = (s: ViewState, id: string) => allLanes(s.song.doc).find((l) => l.id === id)?.kind;
const stepsOf = (s: ViewState) => stepsPerBar(readMeta(s.song.doc).timeSignature);
const slotOf = (c: CellCursor) => c.line.get(c.lane) as Y.Map<unknown> | undefined;

/** Доріжка текстом (для буфера) — так само, як її показує редактор. */
export function cellText(s: ViewState, line: Line, id: string): string[] {
  const kind = kindOf(s, id);
  const slot = line.get(id) as Y.Map<unknown> | undefined;
  if (!kind || isTextKind(kind) || !slot) return [];
  const cells = slot.get("cells") as Y.Map<string>;
  return renderCells(kind, (k) => cells.get(k), barsOf(slot), stepsOf(s));
}

export function installCells(s: ViewState, history: History): Cells {
  const { view } = s;
  let cursor: CellCursor | null = null;
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
  const type = (text: string) => {
    if (!current()) return false;
    edit(TYPING, (c, slot) => {
      for (const ch of text) {
        c.at = typeCell(c.kind, slot, stepsOf(s), c.at, ch, c.prev);
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
      const slot = slotOf(c);
      const total = barsOf(slot) * stepsOf(s);
      const { step, string } = c.at;
      switch (e.key) {
        case "ArrowLeft":
          return step > 0 && move({ step: step - 1, string });
        case "ArrowRight":
          return step < total - 1 && move({ step: step + 1, string });
        case "ArrowUp":
          return c.kind === "tab" && string > 0 && move({ step, string: string - 1 });
        case "ArrowDown":
          return c.kind === "tab" && string < 5 && move({ step, string: string + 1 });
        case "Home":
          return move({ step: 0, string });
        case "End":
          return move({ step: total - 1, string });
        case "Backspace":
        case "Delete":
          edit(COMMAND, (cur, sl) => {
            cur.at = eraseCell(cur.kind, sl, stepsOf(s), cur.at, e.key === "Backspace");
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
    paste: (text) => {
      const c = current();
      if (!c) return false;
      const parsed = parseCells(c.kind, text.split(/\r?\n/).filter((l) => l.trim()), stepsOf(s));
      if (parsed) edit(COMMAND, (_, slot) => writeParsed(slot, parsed));
      return true;
    },
    listen: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
