/**
 * Клітинкові доріжки (ADR-0008) — псевдо-текст: зберігаються клітинками
 * сітки, показуються й копіюються текстом, пишуться за синтаксисом виду.
 *
 * Сітка стала: крок — вісімка (`4/4` → 8 кроків у такті, `6/8` → 6).
 * Доріжка в рядку — `bars` тактів (за замовчуванням один, додаються). Ключ
 * клітинки — «такт.крок», для табів ще «/струна» (усе з 1).
 *
 *   прямокутники  |Am------|F---G---|   назва відкриває, «-» тягне, «.» — порожньо
 *   кахон         |B-T-B-T-|           B — бас, T — тон, g — гост, «-» — нічого
 *   таби          e|---1----|          шість струн e B G D A E; лад 0–24, x
 */
import * as Y from "yjs";
import type { CellKind } from "./lanes";

export const TAB_STRINGS = ["e", "B", "G", "D", "A", "E"] as const;

/** Кроків (вісімок) у такті розміру `4/4`, `6/8`… */
export function stepsPerBar(timeSignature: string) {
  const [n, d] = timeSignature.split("/").map(Number);
  return n > 0 && d > 0 ? Math.max(1, Math.round((n * 8) / d)) : 8;
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
  // Таби: якщо в такті є двозначний лад — усі кроки такту завширшки два символи.
  const width = (b: number) =>
    Array.from({ length: steps * 6 }).some((_, i) => (at(b, i % steps, Math.floor(i / steps)) ?? "").length > 1) ? 2 : 1;
  return TAB_STRINGS.map(
    (name, string) =>
      name +
      barsText((b) => {
        const w = width(b);
        return Array.from({ length: steps }, (_, s) => (at(b, s, string) ?? "").padEnd(w, "-")).join("");
      }),
  );
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
    let bars = 1;
    lines.forEach((line, string) => {
      const all = barsIn(line);
      bars = Math.max(bars, all.length);
      all.forEach((text, b) => {
        // Ширина такту будь-яка (табулатура з сайту) — місце ладу переводимо в крок пропорційно.
        for (const m of text.matchAll(/\d+|x/gi)) put(b + 1, Math.floor((m.index! * steps) / Math.max(1, text.length)), m[0].toLowerCase(), string);
      });
    });
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
}

/**
 * Друк символу `ch` у крок `at` за синтаксисом виду; повертає, де курсор далі.
 * `prev` — символ, надрукований у цій доріжці щойно перед цим (курсор відтоді
 * не переставляли), інакше `null`: з ним двозначний лад, назва акорду в кілька
 * символів, «-» після ладу. Викликати в транзакції.
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
      cells.set(key(at), prev && /\d/.test(prev) && cur && /^\d$/.test(cur) && Number(cur + ch) <= 24 ? cur + ch : ch);
      return at;
    }
    if (ch.toLowerCase() === "x") return (cells.set(key(at), "x"), at);
    if (ch !== "-" && ch !== " ") return at;
    // «-» одразу після ладу — «далі»: лад лишається, курсор іде на наступний крок.
    return prev && /[\dx]/i.test(prev) ? next : clearAndNext();
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
  const shift = barsOf(to);
  const dst = to.get("cells") as Y.Map<string>;
  src.forEach((value, key) => {
    const k = parseKey(key)!;
    dst.set(`${k.bar + shift}.${k.step}${key.includes("/") ? `/${k.string}` : ""}`, value);
  });
  to.set("bars", shift + barsOf(from));
}
