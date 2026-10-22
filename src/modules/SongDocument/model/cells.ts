/**
 * Клітинкові доріжки (ADR-0008) — псевдо-текст: зберігаються клітинками
 * сітки, показуються й копіюються текстом, пишуться за синтаксисом виду.
 *
 * Сітка стала: крок — шістнадцята (`4/4` → 16 кроків у такті, `6/8` → 12).
 * Слот пам'ятає свою сітку (`grid` — кроків у цілій ноті): клітинки, записані
 * на іншій (вісімки, тридцять другі), перераховує `upgradeGrid`. Доріжка в рядку — `bars`
 * тактів (за замовчуванням один, додаються). Ключ клітинки — «такт.крок»,
 * для табів ще «/струна» (усе з 1).
 *
 *   прямокутники  |Am------|F---G---|   назва відкриває, «-» тягне, «.» — порожньо
 *   кахон         |B-T-B-T-|           B — бас, T — тон, g — гост, «-» — нічого
 *   таби          e|---12---|          шість струн e B G D A E; лад 0–24, x;
 *                                      порожній крок — один «-», крок із
 *                                      двозначним ладом — два символи на всіх струнах
 */
import * as Y from "yjs";
import type { CellKind } from "./lanes";

export const TAB_STRINGS = ["e", "B", "G", "D", "A", "E"] as const;

/** Кроків у цілій ноті: крок — шістнадцята. */
export const GRID = 16;
/** Сітка слотів, записаних до 2026-10-22 (без `grid`): крок — вісімка. */
const OLD_GRID = 8;

/** Кроків (шістнадцятих) у такті розміру `4/4`, `6/8`… */
export function stepsPerBar(timeSignature: string) {
  const [n, d] = timeSignature.split("/").map(Number);
  return n > 0 && d > 0 ? Math.max(1, Math.round((n * GRID) / d)) : GRID;
}

/**
 * Кроків у долі — смуги на екрані, як у FL Studio: доля — одиниця
 * знаменника (`4/4` — 4 кроки), а в складних розмірах (`6/8`, `9/8`, `12/8`)
 * — три вісімки (6 кроків).
 */
export function stepsPerBeat(timeSignature: string) {
  const [n, d] = timeSignature.split("/").map(Number);
  if (!(n > 0 && d > 0)) return GRID / 4;
  const unit = GRID / d;
  return Math.max(1, Math.round(d === 8 && n % 3 === 0 && n > 3 ? unit * 3 : unit));
}

/** Слот клітинкової доріжки на іншій сітці — його клітинки треба перерахувати. */
export const staleGrid = (slot: Y.Map<unknown>) => slot.has("cells") && slot.get("grid") !== GRID;

/**
 * Перерахувати клітинки слота на сітку `GRID`: удар (таби, кахон) стає на
 * крок, у який припадає його початок; прямокутник тягнеться на всі кроки, що
 * займав («-» в решті). Сітка грубшала й на один крок припало два — лишається
 * перший, а назва акорду перемагає «-». Викликати в транзакції.
 */
export function upgradeGrid(slot: Y.Map<unknown>, kind: CellKind) {
  const from = Number(slot.get("grid")) || OLD_GRID;
  const cells = slot.get("cells") as Y.Map<string>;
  const moved = new Map<string, string>();
  const order = (key: string) => {
    const k = parseKey(key)!;
    return k.bar * 1e6 + k.step * 10 + k.string;
  };
  Array.from(cells.entries())
    .sort(([a], [b]) => order(a) - order(b))
    .forEach(([key, value]) => {
      const k = parseKey(key);
      if (!k) return;
      const first = Math.floor(((k.step - 1) * GRID) / from) + 1;
      const last = kind === "blocks" ? Math.max(first, Math.floor((k.step * GRID) / from)) : first;
      for (let step = first; step <= last; step++) {
        const at = `${k.bar}.${step}${key.includes("/") ? `/${k.string}` : ""}`;
        const v = step === first ? value : "-";
        const was = moved.get(at);
        if (was === undefined || (was === "-" && v !== "-")) moved.set(at, v);
      }
    });
  cells.clear();
  moved.forEach((value, key) => cells.set(key, value));
  slot.set("grid", GRID);
}

/** Місце курсора в доріжці: крок від початку рядка (з 0) і струна (з 0; не таби — 0). */
export type CellAt = { step: number; string: number };

export const cellKey = (kind: CellKind, steps: number, { step, string }: CellAt) =>
  `${Math.floor(step / steps) + 1}.${(step % steps) + 1}${kind === "tab" ? `/${string + 1}` : ""}`;

function parseKey(key: string) {
  const m = /^(\d+)\.(\d+)(?:\/(\d+))?$/.exec(key);
  return m ? { bar: Number(m[1]), step: Number(m[2]), string: m[3] ? Number(m[3]) : 1 } : null;
}

/** Скільки тактів у доріжці рядка: записане в слоті, але не менше, ніж займають клітинки. */
export function barsOf(slot: Y.Map<unknown> | undefined) {
  const cells = slot?.get("cells") as Y.Map<string> | undefined;
  let most = Number(slot?.get("bars")) || 1;
  cells?.forEach((_, key) => (most = Math.max(most, parseKey(key)?.bar ?? 1)));
  return most;
}

type Read = (key: string) => string | undefined;

/** Доріжка текстом — рядки, як їх показує редактор і кладе в буфер. */
export function renderCells(kind: CellKind, read: Read, bars: number, steps: number): string[] {
  const at = (bar: number, s: number, string = 0) => read(cellKey(kind, steps, { step: (bar - 1) * steps + s, string }));
  const barsText = (bar: (b: number) => string) =>
    "|" + Array.from({ length: bars }, (_, i) => bar(i + 1)).join("|") + "|";

  if (kind === "cajon") return [barsText((b) => Array.from({ length: steps }, (_, s) => at(b, s) ?? "-").join(""))];
  if (kind === "blocks")
    return [
      barsText((b) => {
        let out = "";
        let under = 0; // скільки ще кроків ховає під собою назва акорду
        for (let s = 0; s < steps; s++) {
          const v = at(b, s);
          if (v && v !== "-") {
            out += v;
            under = v.length - 1;
          } else if (v === "-" && under > 0) under--;
          else {
            out += v === "-" ? "-" : ".";
            under = 0;
          }
        }
        return out;
      }),
    ];
  // Таби: крок завширшки найдовшого ладу в ньому на всіх струнах, порожній — один «-».
  const widths = tabWidths(read, bars, steps);
  return TAB_STRINGS.map(
    (name, string) =>
      name +
      barsText((b) =>
        Array.from({ length: steps }, (_, s) => (at(b, s, string) ?? "").padEnd(widths[(b - 1) * steps + s], "-")).join(""),
      ),
  );
}

/** Ширина кожного кроку табів (від початку рядка): найдовший лад у ньому на всіх струнах, не менше 1. */
export function tabWidths(read: Read, bars: number, steps: number): number[] {
  return Array.from({ length: bars * steps }, (_, step) =>
    Math.max(1, ...TAB_STRINGS.map((_, string) => read(cellKey("tab", steps, { step, string }))?.length ?? 0)),
  );
}

/**
 * Колонки такту табів: шість рядків тексту одного такту → значення по
 * колонках. Колонка — один символ, або ширше, якщо в ній починається лад у
 * кілька цифр (на будь-якій струні).
 */
function tabColumns(texts: string[]): (string | undefined)[][] {
  const len = Math.max(0, ...texts.map((t) => t.length));
  const cols: (string | undefined)[][] = [];
  for (let i = 0; i < len; ) {
    let width = 1;
    let values: (string | undefined)[] = [];
    for (let grown = true; grown; ) {
      grown = false;
      values = texts.map((t) => {
        const m = /\d+|x/i.exec(t.slice(i));
        if (!m || m.index >= width) return undefined;
        if (m.index + m[0].length > width) {
          width = m.index + m[0].length;
          grown = true;
        }
        return m[0].toLowerCase();
      });
    }
    cols.push(values);
    i += width;
  }
  return cols;
}

export type Parsed = { cells: Record<string, string>; bars: number };

const barsIn = (line: string) => line.slice(line.indexOf("|") + 1).replace(/\|\s*$/, "").split("|");

/** Текст доріжки (з буфера, свій чи з сайту) → клітинки. `null` — це не текст цього виду. */
export function parseCells(kind: CellKind, lines: string[], steps: number): Parsed | null {
  const cells: Record<string, string> = {};
  const put = (bar: number, s: number, value: string, string = 0) => {
    if (s < steps) cells[cellKey(kind, steps, { step: (bar - 1) * steps + s, string })] = value;
  };
  if (kind === "tab") {
    if (lines.length !== 6 || !lines.every(isTabLine)) return null;
    const perString = lines.map(barsIn);
    const bars = Math.max(1, ...perString.map((b) => b.length));
    for (let b = 0; b < bars; b++) {
      const cols = tabColumns(perString.map((all) => all[b] ?? ""));
      // Свій текст — колонка на крок; табулатура з сайту з іншою кількістю колонок лягає пропорційно.
      cols.forEach((values, c) =>
        values.forEach((v, string) => v && put(b + 1, cols.length === steps ? c : Math.floor((c * steps) / cols.length), v, string)),
      );
    }
    return { cells, bars };
  }
  if (lines.length !== 1 || !(kind === "cajon" ? isCajonLine(lines[0]) : isBlocksLine(lines[0]))) return null;
  const all = barsIn(lines[0]);
  all.forEach((text, b) => {
    if (kind === "cajon") [...text].forEach((ch, s) => ch !== "-" && put(b + 1, s, ch));
    else
      for (const m of text.matchAll(/[^-.]+|-|\./g)) {
        if (m[0] === ".") continue;
        put(b + 1, m.index!, m[0] === "-" ? "-" : m[0]);
        for (let k = 1; k < m[0].length && m[0] !== "-"; k++) put(b + 1, m.index! + k, "-");
      }
  });
  return { cells, bars: all.length };
}

export const isTabLine = (line: string) => /^\s*[eBGDAE]\s*\|[-\dxX|hpbr/\\~ ]*$/.test(line) && line.includes("-");
export const isCajonLine = (line: string) => /^\s*\|([BTg-]+\|)+\s*$/.test(line);
export const isBlocksLine = (line: string) => !isCajonLine(line) && /^\s*\|([^\s|]+\|)+\s*$/.test(line) && /[A-H]/.test(line);

/** Вид клітинкової доріжки, текстом якої починається `lines[i]`, і скільки рядків тексту вона займає. */
export function recognizeCells(lines: string[], i: number): { kind: CellKind; size: number } | null {
  if (lines.slice(i, i + 6).length === 6 && lines.slice(i, i + 6).every(isTabLine)) return { kind: "tab", size: 6 };
  if (isCajonLine(lines[i])) return { kind: "cajon", size: 1 };
  if (isBlocksLine(lines[i])) return { kind: "blocks", size: 1 };
  return null;
}

/** Замінити вміст доріжки розібраним (вставка). Викликати в транзакції. */
export function writeParsed(slot: Y.Map<unknown>, { cells, bars }: Parsed) {
  const map = slot.get("cells") as Y.Map<string>;
  map.clear();
  Object.entries(cells).forEach(([key, value]) => map.set(key, value));
  slot.set("bars", bars);
  slot.set("grid", GRID);
}

/**
 * Друк символу `ch` у крок `at` за синтаксисом виду; повертає, де курсор далі.
 * `prev` — символ, надрукований у цій доріжці щойно перед цим (курсор відтоді
 * не переставляли), інакше `null`: з ним двозначний лад і назва акорду в
 * кілька символів. Викликати в транзакції.
 *
 * Таби — навігація ручна: друк лишає курсор на місці (цифри поспіль — один
 * лад, «12»), «-» чи пробіл стирають крок; на інший крок — стрілками.
 */
export function typeCell(kind: CellKind, slot: Y.Map<unknown>, steps: number, at: CellAt, ch: string, prev: string | null): CellAt {
  const cells = slot.get("cells") as Y.Map<string>;
  const total = barsOf(slot) * steps;
  const key = (a: CellAt) => cellKey(kind, steps, a);
  const next = { ...at, step: Math.min(at.step + 1, total - 1) };
  const clearAndNext = () => (cells.delete(key(at)), next);

  if (kind === "cajon") {
    const hit = { b: "B", t: "T", g: "g" }[ch.toLowerCase()];
    if (hit) cells.set(key(at), hit);
    else if (ch === "-" || ch === " " || ch === ".") cells.delete(key(at));
    else return at;
    return next;
  }
  if (kind === "tab") {
    if (/\d/.test(ch)) {
      const cur = cells.get(key(at));
      cells.set(key(at), prev && /\d/.test(prev) && cur && /^\d+$/.test(cur) && Number(cur + ch) <= 24 ? cur + ch : ch);
    } else if (ch.toLowerCase() === "x") cells.set(key(at), "x");
    else if (ch === "-" || ch === " ") cells.delete(key(at));
    return at;
  }
  // Прямокутники: назва акорду пишеться як текст — по кроку на символ; «-» тягне, «.» — порожньо.
  if (ch === "-") return (cells.set(key(at), "-"), next);
  if (ch === "." || ch === " ") return clearAndNext();
  const back = { ...at, step: at.step - 1 };
  if (prev && !/[-. ]/.test(prev)) {
    // Шукаємо початок назви, яку дописуємо: ліворуч під назвою — «-».
    let start = back;
    while (start.step > 0 && cells.get(key(start)) === "-") start = { ...start, step: start.step - 1 };
    const name = cells.get(key(start));
    if (name && name !== "-") {
      cells.set(key(start), name + ch);
      cells.set(key(at), "-");
      return next;
    }
  }
  cells.set(key(at), ch);
  return next;
}

/** Стерти крок (Backspace/Delete): порожній — стерти попередній і стати на нього. Повертає курсор. */
export function eraseCell(kind: CellKind, slot: Y.Map<unknown>, steps: number, at: CellAt, backward: boolean): CellAt {
  const cells = slot.get("cells") as Y.Map<string>;
  const key = (a: CellAt) => cellKey(kind, steps, a);
  // Лад у кілька цифр Backspace скорочує на цифру.
  const cur = cells.get(key(at));
  if (kind === "tab" && backward && cur && /^\d{2,}$/.test(cur)) {
    cells.set(key(at), cur.slice(0, -1));
    return at;
  }
  if (cells.has(key(at)) || !backward || at.step === 0) {
    cells.delete(key(at));
    return at;
  }
  const back = { ...at, step: at.step - 1 };
  cells.delete(key(back));
  return back;
}

/** Додати такт у кінець доріжки рядка. Викликати в транзакції. */
export const addBar = (slot: Y.Map<unknown>) => slot.set("bars", barsOf(slot) + 1);

/** Прибрати останній такт, якщо він порожній і не єдиний. Викликати в транзакції. */
export function removeBar(slot: Y.Map<unknown>) {
  const bars = barsOf(slot);
  const cells = slot.get("cells") as Y.Map<string>;
  const used = Array.from(cells.keys()).some((key) => parseKey(key)?.bar === bars);
  if (bars > 1 && !used) slot.set("bars", bars - 1);
}

/**
 * Склеювання: клітинки рядка `from` дописуються в `to` після його тактів (це
 * копія, як і акорди). Викликати, поки `from` ще в документі.
 */
export function appendCells(from: Y.Map<unknown>, to: Y.Map<unknown>) {
  const src = from.get("cells") as Y.Map<string>;
  const extra = Number(from.get("bars")) > 1;
  if (!src?.size && !extra) return;
  const dst = to.get("cells") as Y.Map<string>;
  // Порожня доріжка з одним тактом — дописуємо з її початку, без зайвого порожнього такту.
  const shift = !dst.size && barsOf(to) === 1 ? 0 : barsOf(to);
  src.forEach((value, key) => {
    const k = parseKey(key)!;
    dst.set(`${k.bar + shift}.${k.step}${key.includes("/") ? `/${k.string}` : ""}`, value);
  });
  to.set("bars", shift + barsOf(from));
}
