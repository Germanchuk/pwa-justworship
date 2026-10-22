/**
 * Клітинкові доріжки (ADR-0008) — псевдо-текст: зберігаються клітинками
 * сітки, показуються й копіюються текстом, пишуться за синтаксисом виду.
 *
 * **Запис і показ — різні сітки.** Удари (таби, кахон) записані в тіках:
 * `TICKS` = 192 на цілу ноту — ділиться і на 2, і на 3, тож і 1/64, і тріолі
 * лягають точно (для програвання, як у DAW). Показ — у масштабі людини
 * (`Scale`, особисте, як капо): комірка 1/16 за замовчуванням, 1/32, 1/64 чи
 * тріольні. Подія показується в найближчій комірці — точно на долі чи поруч
 * (`placeCells`); правка й друк діють лише на точне (`cellKey` — тік долі
 * комірки). Прямокутники поки записані на шістнадцятих і масштабу не мають.
 *
 * Слот пам'ятає свою сітку (`grid` — кроків у цілій ноті): записане на іншій
 * (вісімки, шістнадцяті) перераховує `upgradeGrid`. Доріжка в рядку — `bars`
 * тактів (за замовчуванням один, додаються). Ключ клітинки — «такт.тік»
 * (прямокутники — «такт.крок»), для табів і кахона ще «/лінія» — струна чи
 * вид удару (усе з 1).
 *
 *   прямокутники  |Am------|F---G---|   назва відкриває, «-» тягне, «.» — порожньо
 *   кахон         B|o-------o-------|  кожен удар на своїй лінії: B — бас,
 *                 T|----o-------o---|  T — тон, g — гост; «o» — удар, «-» — нічого
 *                 g|--o---o---o---o-|
 *   таби          e|---12---|          шість струн e B G D A E; лад 0–24, x;
 *                                      порожній крок — один «-», крок із
 *                                      двозначним ладом — два символи на всіх струнах
 */
import * as Y from "yjs";
import type { CellKind } from "./lanes";

export const TAB_STRINGS = ["e", "B", "G", "D", "A", "E"] as const;
/** Лінії кахона згори донизу: бас, тон, гост. */
export const CAJON_ROWS = ["B", "T", "g"] as const;
/** Лінії доріжки згори донизу: струни табів, удари кахона; у прямокутників одна, без назви. */
export const rowsOf = (kind: CellKind): readonly string[] => (kind === "tab" ? TAB_STRINGS : kind === "cajon" ? CAJON_ROWS : [""]);
/** Удар кахона в клітинці. */
const HIT = "o";

/** Тіків у цілій ноті — запис ударів. */
export const TICKS = 192;
/** Прямокутники поки — на шістнадцятих (їхня механіка — згодом). */
const BLOCKS_GRID = 16;
/** Сітка запису виду — кроків у цілій ноті. */
export const gridOf = (kind: CellKind) => (kind === "blocks" ? BLOCKS_GRID : TICKS);
/** Сітка слотів, записаних до 2026-10-22 (без `grid`): крок — вісімка. */
const OLD_GRID = 8;

/** Масштаби показу — комірок у цілій ноті: 1/16, 1/32, 1/64 і тріолі 1/8, 1/16, 1/32. */
export const ZOOMS = [16, 32, 64, 12, 24, 48] as const;
export const DEFAULT_ZOOM = 16;
export const ZOOM_NAMES: Record<number, string> = { 16: "1/16", 32: "1/32", 64: "1/64", 12: "1/8 тріолі", 24: "1/16 тріолі", 48: "1/32 тріолі" };

const meter = (timeSignature: string) => {
  const [n, d] = timeSignature.split("/").map(Number);
  return n > 0 && d > 0 ? [n, d] : [4, 4];
};

/** Шістнадцятих у такті розміру `4/4`, `6/8`… */
export function stepsPerBar(timeSignature: string) {
  const [n, d] = meter(timeSignature);
  return Math.max(1, Math.round((n * 16) / d));
}

/**
 * Масштаб доріжки: `cells` — комірок у такті, `tick` — кроків запису на
 * комірку, `ticks` — кроків запису в такті, `grid` — сітка запису виду.
 * Прямокутники — без масштабу: комірка = крок запису.
 */
export type Scale = { cells: number; tick: number; ticks: number; grid: number };

export function scaleOf(kind: CellKind, timeSignature: string, zoom: number = DEFAULT_ZOOM): Scale {
  const [n, d] = meter(timeSignature);
  const grid = gridOf(kind);
  const ticks = Math.max(1, Math.round((n * grid) / d));
  const tick = kind === "blocks" ? 1 : Math.max(1, Math.round(grid / zoom));
  return { cells: Math.ceil(ticks / tick), tick, ticks, grid };
}

/**
 * Кроків у долі — смуги на екрані, як у FL Studio: доля — одиниця
 * знаменника (`4/4` — 4 кроки), а в складних розмірах (`6/8`, `9/8`, `12/8`)
 * — три вісімки (6 кроків).
 */
export function stepsPerBeat(timeSignature: string) {
  const [n, d] = meter(timeSignature);
  const unit = 16 / d;
  return Math.max(1, Math.round(d === 8 && n % 3 === 0 && n > 3 ? unit * 3 : unit));
}

/** Слот клітинкової доріжки на іншій сітці — його клітинки треба перерахувати. */
export const staleGrid = (slot: Y.Map<unknown>, kind: CellKind) => slot.has("cells") && slot.get("grid") !== gridOf(kind);

/**
 * Перерахувати клітинки слота на сітку свого виду: удар (таби, кахон) стає на
 * крок, у який припадає його початок; прямокутник тягнеться на всі кроки, що
 * займав («-» в решті). Сітка грубшала й на один крок припало два — лишається
 * перший, а назва акорду перемагає «-». Викликати в транзакції.
 */
export function upgradeGrid(slot: Y.Map<unknown>, kind: CellKind) {
  const from = Number(slot.get("grid")) || OLD_GRID;
  const to = gridOf(kind);
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
      const first = Math.floor(((k.step - 1) * to) / from) + 1;
      const last = kind === "blocks" ? Math.max(first, Math.floor((k.step * to) / from)) : first;
      for (let step = first; step <= last; step++) {
        const at = `${k.bar}.${step}${key.includes("/") ? `/${k.string}` : ""}`;
        const v = step === first ? value : "-";
        const was = moved.get(at);
        if (was === undefined || (was === "-" && v !== "-")) moved.set(at, v);
      }
    });
  cells.clear();
  moved.forEach((value, key) => cells.set(key, value));
  slot.set("grid", to);
}

/** Місце курсора в доріжці: комірка масштабу від початку рядка (з 0) і лінія — струна чи удар (з 0; прямокутники — 0). */
export type CellAt = { step: number; string: number };

/** Ключ запису точно на долі комірки `step`. */
export const cellKey = (kind: CellKind, scale: Scale, { step, string }: CellAt) =>
  `${Math.floor(step / scale.cells) + 1}.${(step % scale.cells) * scale.tick + 1}${kind === "blocks" ? "" : `/${string + 1}`}`;

/** Подія в комірці: значення і на скільки воно від долі комірки (0 — точно, до 0.5 комірки). */
export type Placed = { value: string; off: number };
/** Що в комірці: найближче до долі (`value`, `off` — для тексту) і всі події, що туди лягли (`all` — показ накладанням). */
export type Shown = Placed & { all: Placed[] };

/**
 * Записане → комірки масштабу: кожна подія — у найближчу комірку, рівно
 * посередині — у ліву, ближчу до початку такту (ключ
 * `«комірка від початку рядка/лінія»`). Кілька в одній — усі в `all`
 * (показ кладе їх одна на одну), а найближча — для тексту.
 */
export function placeCells(kind: CellKind, entries: Iterable<[string, string]>, bars: number, scale: Scale): Map<string, Shown> {
  const out = new Map<string, Shown>();
  for (const [key, value] of entries) {
    const k = parseKey(key);
    if (!k) continue;
    const exact = (k.step - 1) / scale.tick; // у комірках від початку такту
    let cell = Math.ceil(exact - 0.5); // рівно між двома — ліва, ближча до початку такту
    const off = Math.abs(exact - cell);
    let bar = k.bar - 1;
    if (cell >= scale.cells) [bar, cell] = [bar + 1, 0]; // найближча — перша комірка наступного такту
    if (bar >= bars) continue;
    const at = `${bar * scale.cells + cell}/${kind === "blocks" ? 0 : k.string - 1}`;
    const was = out.get(at);
    const all = [...(was?.all ?? []), { value, off }];
    out.set(at, { ...(was && was.off <= off ? { value: was.value, off: was.off } : { value, off }), all });
  }
  return out;
}

/** Кахон, записаний до 2026-10-22 однією лінією («такт.крок» → B/T/g), — треба розкласти по лініях. */
export const staleCajon = (slot: Y.Map<unknown>) => Array.from((slot.get("cells") as Y.Map<string>).keys()).some((key) => !key.includes("/"));

/** Розкласти старий кахон по лініях: удар іде на лінію свого виду. Викликати в транзакції. */
export function upgradeCajon(slot: Y.Map<unknown>) {
  const cells = slot.get("cells") as Y.Map<string>;
  Array.from(cells.entries()).forEach(([key, value]) => {
    if (key.includes("/")) return;
    cells.delete(key);
    const row = CAJON_ROWS.indexOf(value as (typeof CAJON_ROWS)[number]);
    if (row >= 0) cells.set(`${key}/${row + 1}`, HIT);
  });
}

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

/**
 * Доріжка текстом у масштабі — рядки, як їх показує редактор і кладе в буфер
 * (подія не на долі — у найближчій комірці).
 */
export function renderCells(kind: CellKind, entries: Iterable<[string, string]>, bars: number, scale: Scale): string[] {
  const steps = scale.cells;
  const placed = placeCells(kind, entries, bars, scale);
  const at = (bar: number, s: number, string = 0) => placed.get(`${(bar - 1) * steps + s}/${string}`)?.value;
  const barsText = (bar: (b: number) => string) =>
    "|" + Array.from({ length: bars }, (_, i) => bar(i + 1)).join("|") + "|";

  if (kind === "cajon")
    return CAJON_ROWS.map((name, row) => name + barsText((b) => Array.from({ length: steps }, (_, s) => (at(b, s, row) ? HIT : "-")).join("")));
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
  const widths = Array.from({ length: bars * steps }, (_, step) =>
    Math.max(1, ...TAB_STRINGS.map((_, string) => placed.get(`${step}/${string}`)?.value.length ?? 0)),
  );
  return TAB_STRINGS.map(
    (name, string) =>
      name +
      barsText((b) =>
        Array.from({ length: steps }, (_, s) => (at(b, s, string) ?? "").padEnd(widths[(b - 1) * steps + s], "-")).join(""),
      ),
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

export type Parsed = { cells: Record<string, string>; bars: number; grid: number };

const barsIn = (line: string) => line.slice(line.indexOf("|") + 1).replace(/\|\s*$/, "").split("|");

/** Текст доріжки (з буфера, свій чи з сайту) → клітинки; символ — комірка масштабу. `null` — це не текст цього виду. */
export function parseCells(kind: CellKind, lines: string[], scale: Scale): Parsed | null {
  const steps = scale.cells;
  const { grid } = scale;
  const cells: Record<string, string> = {};
  const put = (bar: number, s: number, value: string, string = 0) => {
    if (s < steps) cells[cellKey(kind, scale, { step: (bar - 1) * steps + s, string })] = value;
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
    return { cells, bars, grid };
  }
  if (kind === "cajon" && lines.length === CAJON_ROWS.length) {
    if (!isCajonRows(lines)) return null;
    const perRow = lines.map(barsIn);
    perRow.forEach((all, row) => all.forEach((text, b) => [...text].forEach((ch, s) => /[oxOX]/.test(ch) && put(b + 1, s, HIT, row))));
    return { cells, bars: Math.max(1, ...perRow.map((b) => b.length)), grid };
  }
  if (lines.length !== 1 || !(kind === "cajon" ? isCajonLine(lines[0]) : isBlocksLine(lines[0]))) return null;
  const all = barsIn(lines[0]);
  all.forEach((text, b) => {
    // Кахон однією лінією (як писали до 2026-10-22): літера — на свою лінію.
    if (kind === "cajon") [...text].forEach((ch, s) => CAJON_ROWS.includes(ch as "B") && put(b + 1, s, HIT, CAJON_ROWS.indexOf(ch as "B")));
    else
      for (const m of text.matchAll(/[^-.]+|-|\./g)) {
        if (m[0] === ".") continue;
        put(b + 1, m.index!, m[0] === "-" ? "-" : m[0]);
        for (let k = 1; k < m[0].length && m[0] !== "-"; k++) put(b + 1, m.index! + k, "-");
      }
  });
  return { cells, bars: all.length, grid };
}

export const isTabLine = (line: string) => /^\s*[eBGDAE]\s*\|[-\dxX|hpbr/\\~ ]*$/.test(line) && line.includes("-");
export const isCajonLine = (line: string) => /^\s*\|([BTg-]+\|)+\s*$/.test(line);
/** Три лінії кахона: B, T, g — по «o» (чи «x») і «-». */
export const isCajonRows = (lines: string[]) =>
  lines.length === CAJON_ROWS.length && lines.every((line, i) => new RegExp(`^\\s*${CAJON_ROWS[i]}\\s*\\|([-oOxX]+\\|)+\\s*$`).test(line));
export const isBlocksLine = (line: string) => !isCajonLine(line) && /^\s*\|([^\s|]+\|)+\s*$/.test(line) && /[A-H]/.test(line);

/** Вид клітинкової доріжки, текстом якої починається `lines[i]`, і скільки рядків тексту вона займає. */
export function recognizeCells(lines: string[], i: number): { kind: CellKind; size: number } | null {
  if (lines.slice(i, i + 6).length === 6 && lines.slice(i, i + 6).every(isTabLine)) return { kind: "tab", size: 6 };
  if (isCajonRows(lines.slice(i, i + CAJON_ROWS.length))) return { kind: "cajon", size: CAJON_ROWS.length };
  if (isCajonLine(lines[i])) return { kind: "cajon", size: 1 };
  if (isBlocksLine(lines[i])) return { kind: "blocks", size: 1 };
  return null;
}

/** Замінити вміст доріжки розібраним (вставка). Викликати в транзакції. */
export function writeParsed(slot: Y.Map<unknown>, { cells, bars, grid }: Parsed) {
  const map = slot.get("cells") as Y.Map<string>;
  map.clear();
  Object.entries(cells).forEach(([key, value]) => map.set(key, value));
  slot.set("bars", bars);
  slot.set("grid", grid);
}

/**
 * Друк символу `ch` у крок `at` за синтаксисом виду; повертає, де курсор далі.
 * `prev` — символ, надрукований у цій доріжці щойно перед цим (курсор відтоді
 * не переставляли), інакше `null`: з ним двозначний лад і назва акорду в
 * кілька символів. Викликати в транзакції.
 *
 * Таби й кахон — навігація ручна: друк лишає курсор на місці (цифри поспіль
 * — один лад, «12»), «-» чи пробіл стирають крок; на інший крок — стрілками.
 * У кахоні «o» чи «x» — удар на лінії курсора, B / T / g — удар на своїй лінії
 * в цьому кроці.
 */
export function typeCell(kind: CellKind, slot: Y.Map<unknown>, scale: Scale, at: CellAt, ch: string, prev: string | null): CellAt {
  const cells = slot.get("cells") as Y.Map<string>;
  const total = barsOf(slot) * scale.cells;
  const key = (a: CellAt) => cellKey(kind, scale, a);
  const next = { ...at, step: Math.min(at.step + 1, total - 1) };
  const clearAndNext = () => (cells.delete(key(at)), next);

  if (kind === "cajon") {
    const row = { b: 0, t: 1, g: 2 }[ch.toLowerCase()];
    if (row !== undefined) cells.set(key({ ...at, string: row }), HIT);
    else if (/[ox]/i.test(ch)) cells.set(key(at), HIT);
    else if (ch === "-" || ch === " " || ch === ".") cells.delete(key(at));
    return at;
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

/**
 * Стерти крок (Backspace/Delete): порожній — стерти попередній і стати на
 * нього. Лише точне на долі комірки — подію поруч видно, але правиться вона в
 * масштабі, де вона точна. Повертає курсор.
 */
export function eraseCell(kind: CellKind, slot: Y.Map<unknown>, scale: Scale, at: CellAt, backward: boolean): CellAt {
  const cells = slot.get("cells") as Y.Map<string>;
  const key = (a: CellAt) => cellKey(kind, scale, a);
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
