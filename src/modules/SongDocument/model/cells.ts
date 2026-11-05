/**
 * Клітинкові доріжки (ADR-0008) — псевдо-текст: зберігаються клітинками
 * сітки, показуються й копіюються текстом, пишуться за синтаксисом виду.
 *
 * **Запис і показ — різні сітки.** Удари (таби, кахон) записані в тіках:
 * `TICKS` = 384 на цілу ноту — ділиться і на 128, і на 3, тож і 1/128, і тріолі
 * лягають точно (для програвання, як у DAW). Показ — у масштабі людини
 * (`Scale`, особисте, як капо): комірка 1/16 за замовчуванням, 1/32, 1/64, 1/128 чи
 * тріольні. Подія показується в найближчій комірці — точно на долі чи поруч
 * (`placeCells`); правка й друк діють лише на точне (`cellKey` — тік долі
 * комірки). Прямокутники поки записані на шістнадцятих і масштабу не мають.
 *
 * Слот пам'ятає свою сітку (`grid` — кроків у цілій ноті): записане на іншій
 * (вісімки, шістнадцяті, 192 тіки) перераховує `upgradeGrid`.
 *
 * **Довжина — властивість рядка** (`lineLength`, у вісімках), спільна для
 * всіх його доріжок: такти й, можливо, неповний останній. Що за межею —
 * сховане, але не стерте (тимчасове рішення 2026-10-23, заради гнучкості). Ключ клітинки — «такт.тік»
 * (прямокутники — «такт.крок»), для табів і кахона ще «/лінія» — струна чи
 * вид удару (усе з 1).
 *
 *   прямокутники  |Am------|F---G---|   назва відкриває, «-» тягне, «.» — порожньо
 *   кахон         B|o-------o-------|  кожен удар на своїй лінії: B — бас,
 *                 T|----o-------o---|  T — тон (снейр), H — хет, M — том;
 *                 H|--o---o---o---o-|  «o» — удар, «-» — нічого
 *                 M|--------------o-|
 *   таби          e|---12---|          шість струн e B G D A E; лад 0–24, x;
 *                                      порожній крок — один «-», крок із
 *                                      двозначним ладом — два символи на всіх струнах
 *   піаніно      C4|o===o---|          piano roll: 88 клавіш від C8 до A0, лінія на
 *               E4|--o-----|          клавішу; «o» — нота, «=» — вона ще звучить;
 *                                      текстом — лише лінії з нотами
 *
 * Нота піаніно в клітинці — `o` (без тривалості, ваншот, як удар) або `o96` —
 * звучить 96 тіків `TICKS` (з 2026-11-04, під запис вокалу).
 */
import * as Y from "yjs";
import type { CellKind } from "./lanes";
import type { Line } from "./song";

export const TAB_STRINGS = ["e", "B", "G", "D", "A", "E"] as const;
/**
 * Лінії кахона згори донизу: бас, тон (снейр), закритий хет, том. Хет — на місці
 * госта `g` (до 2026-10-31): записане гостом звучить хетом.
 */
export const CAJON_ROWS = ["B", "T", "H", "M"] as const;
/** Лінія кахона (з 0) за літерою, будь-якого регістру; стара `g` — хет; -1 — не кахон. */
export const cajonRow = (ch: string) => {
  const c = ch.toUpperCase();
  return c === "G" ? CAJON_ROWS.indexOf("H") : CAJON_ROWS.indexOf(c as (typeof CAJON_ROWS)[number]);
};
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
/** MIDI найвищої клавіші піаніно (C8); лінія `row` (з 0) — `PIANO_TOP - row`. */
export const PIANO_TOP = 108;
/** Клавіші піаніно згори донизу — 88, від C8 до A0 («C4» — до першої октави). */
export const PIANO_ROWS: readonly string[] = Array.from({ length: 88 }, (_, row) => {
  const midi = PIANO_TOP - row;
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
});
/** MIDI клавіші на лінії `row` (з 0) доріжки піаніно. */
export const pianoMidi = (row: number) => PIANO_TOP - row;
/** Чорна клавіша на лінії `row` — тінню, як у DAW. */
export const isBlackKey = (row: number) => NOTE_NAMES[pianoMidi(row) % 12].includes("#");

/** Лінії доріжки згори донизу: струни табів, удари кахона, клавіші піаніно; у прямокутників одна, без назви. */
export const rowsOf = (kind: CellKind): readonly string[] =>
  kind === "tab" ? TAB_STRINGS : kind === "cajon" ? CAJON_ROWS : kind === "piano" ? PIANO_ROWS : [""];
/** Удар кахона в клітинці. */
const HIT = "o";
/** Тривалість ноти піаніно в тіках `TICKS`; 0 — ваншот (`o`). */
export const noteLength = (value: string) => Number(/^o(\d+)$/.exec(value)?.[1] ?? 0);
/** Значення клітинки ноти піаніно тривалістю `ticks` (0 — ваншот). */
export const noteValue = (ticks: number) => (ticks > 0 ? `${HIT}${Math.round(ticks)}` : HIT);
/** Звучить нота й далі (текст піаніно): «o==» — нота на три комірки. */
const HOLD = "=";

/** Тіків у цілій ноті — запис ударів: 128 · 3 — і 1/128, і тріолі точно. */
export const TICKS = 384;
/** Прямокутники поки — на шістнадцятих (їхня механіка — згодом). */
const BLOCKS_GRID = 16;
/** Сітка запису виду — кроків у цілій ноті. */
export const gridOf = (kind: CellKind) => (kind === "blocks" ? BLOCKS_GRID : TICKS);
/** Сітка слотів, записаних до 2026-10-22 (без `grid`): крок — вісімка. */
const OLD_GRID = 8;

/** Масштаби показу — комірок у цілій ноті: 1/16, 1/32, 1/64, 1/128 і тріолі 1/8, 1/16, 1/32. */
export const ZOOMS = [16, 32, 64, 128, 12, 24, 48] as const;
export const DEFAULT_ZOOM = 16;
export const ZOOM_NAMES: Record<number, string> = { 16: "1/16", 32: "1/32", 64: "1/64", 128: "1/128", 12: "1/8 тріолі", 24: "1/16 тріолі", 48: "1/32 тріолі" };

const meter = (timeSignature: string) => {
  const [n, d] = timeSignature.split("/").map(Number);
  return n > 0 && d > 0 ? [n, d] : [4, 4];
};

/** Вісімок у такті — одиниця довжини рядка. */
export function eighthsPerBar(timeSignature: string) {
  const [n, d] = meter(timeSignature);
  return Math.max(1, Math.round((n * 8) / d));
}

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
export function placeCells(kind: CellKind, entries: Iterable<[string, string]>, bars: Bars, scale: Scale): Map<string, Shown> {
  const sizes = sizesOf(bars, scale);
  const out = new Map<string, Shown>();
  for (const [key, value] of entries) {
    const k = parseKey(key);
    if (!k) continue;
    const exact = (k.step - 1) / scale.tick; // у комірках від початку такту
    let cell = Math.ceil(exact - 0.5); // рівно між двома — ліва, ближча до початку такту
    const off = Math.abs(exact - cell);
    let bar = k.bar - 1;
    if (cell >= scale.cells) [bar, cell] = [bar + 1, 0]; // найближча — перша комірка наступного такту
    if (bar >= sizes.length || cell >= sizes[bar]) continue; // за межею рядка — сховане
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
    const row = cajonRow(value);
    if (row >= 0) cells.set(`${key}/${row + 1}`, HIT);
  });
}

function parseKey(key: string) {
  const m = /^(\d+)\.(\d+)(?:\/(\d+))?$/.exec(key);
  return m ? { bar: Number(m[1]), step: Number(m[2]), string: m[3] ? Number(m[3]) : 1 } : null;
}

/** Скільки тактів займає доріжка: записане в слоті (до 2026-10-23), але не менше, ніж займають клітинки. */
export function barsOf(slot: Y.Map<unknown> | undefined) {
  const cells = slot?.get("cells") as Y.Map<string> | undefined;
  let most = Number(slot?.get("bars")) || 1;
  cells?.forEach((_, key) => (most = Math.max(most, parseKey(key)?.bar ?? 1)));
  return most;
}

const cellSlots = (line: Line) =>
  Array.from(line.values()).filter((v): v is Y.Map<unknown> => v instanceof Y.Map && v.has("cells"));

/**
 * Довжина рядка у вісімках, спільна для всіх його клітинкових доріжок.
 * Записана на маркері (`length`); поки не записана — найдовша з доріжок
 * рядка, цілими тактами, хоч один.
 */
export function lineLength(line: Line, timeSignature: string): number {
  const stored = Number(line.get("length"));
  if (stored > 0) return stored;
  return Math.max(1, ...cellSlots(line).map(barsOf)) * eighthsPerBar(timeSignature);
}

/** Чи довжину рядка ще не задавали і в його доріжках нічого немає. */
export const blankLength = (line: Line) => !line.has("length") && cellSlots(line).every((slot) => !(slot.get("cells") as Y.Map<string>).size);

/** Чи є в доріжках рядка вміст за його кінцем (сховане, не стерте). */
export function hiddenPastEnd(line: Line, timeSignature: string): boolean {
  const length = lineLength(line, timeSignature);
  const [n, d] = meter(timeSignature);
  return cellSlots(line).some((slot) => {
    const grid = Number(slot.get("grid")) || TICKS;
    const perBar = Math.max(1, Math.round((n * grid) / d));
    const end = (length * grid) / 8;
    return Array.from((slot.get("cells") as Y.Map<string>).keys()).some((key) => {
      const k = parseKey(key);
      return !!k && (k.bar - 1) * perBar + (k.step - 1) >= end;
    });
  });
}

/** Довжина рядка словами: «2 такти + 3/8». */
export function lengthLabel(eighths: number, timeSignature: string): string {
  const per = eighthsPerBar(timeSignature);
  const [full, rest] = [Math.floor(eighths / per), eighths % per];
  const [d, dd] = [full % 10, full % 100];
  const word = d === 1 && dd !== 11 ? "такт" : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? "такти" : "тактів";
  return [full ? `${full} ${word}` : "", rest ? `${rest}/8` : ""].filter(Boolean).join(" + ");
}

/** Задати довжину рядка у вісімках (не менше однієї). Викликати в транзакції. */
export const setLineLength = (line: Line, eighths: number) => line.set("length", Math.max(1, Math.round(eighths)));

/** Подовжити рядок до `eighths`, якщо він коротший (вставка такту з буфера). Викликати в транзакції. */
export function growLine(line: Line, eighths: number, timeSignature: string) {
  if (lineLength(line, timeSignature) < eighths) setLineLength(line, eighths);
}

/**
 * Такти рядка в комірках масштабу: повні — `scale.cells`, неповний останній
 * — стільки, скільки влазить у його вісімки.
 */
export function barSizes(length: number, timeSignature: string, scale: Scale): number[] {
  const per = eighthsPerBar(timeSignature);
  const sizes = Array.from({ length: Math.floor(length / per) }, () => scale.cells);
  const rest = length % per;
  if (rest) sizes.push(Math.max(1, Math.ceil((rest * scale.grid) / 8 / scale.tick)));
  return sizes.length ? sizes : [scale.cells];
}

/** Комірка за останньою в рядку (індекси — «такт · комірок у такті + комірка»). */
export const endOf = (sizes: readonly number[], scale: Scale) => (sizes.length - 1) * scale.cells + sizes[sizes.length - 1];

/**
 * Час позначок (примітки на клітинковій доріжці) — тіки `TICKS` від початку
 * рядка, однаково для всіх видів і масштабів: зміна масштабу показу позначку
 * не зсуває, а прямокутники (своя сітка) міряються тим самим часом.
 */
export const EIGHTH_TICKS = TICKS / 8;
/** Довжина рядка в тіках позначок. */
export const lineTicks = (line: Line, timeSignature: string) => lineLength(line, timeSignature) * EIGHTH_TICKS;

/** Проміжок часу комірки `i` масштабу (індекс «такт · комірок у такті + комірка»): `[початок, кінець)` у тіках позначок. */
export function cellSpan(scale: Scale, i: number): [number, number] {
  const per = TICKS / scale.grid;
  const bar = Math.floor(i / scale.cells) * scale.ticks;
  const at = (i % scale.cells) * scale.tick;
  return [(bar + at) * per, (bar + Math.min(at + scale.tick, scale.ticks)) * per];
}

/** Комірка масштабу, на яку припадає тік рядка `t` (тіки позначок), — обернене до `cellSpan`; між долями — дробова. */
export function cellAt(scale: Scale, t: number) {
  const k = (t * scale.grid) / TICKS; // кроки запису від початку рядка
  const bar = Math.floor(k / scale.ticks);
  return bar * scale.cells + (k - bar * scale.ticks) / scale.tick;
}

/** Клітинка слота в часі: `time` — тіки позначок від початку рядка, `string` — лінія (з 1). */
export type TimedCell = { time: number; string: number; value: string };

/** Усі клітинки слота в часі рядка, за часом і лінією (програвання, цитата примітки). */
export function timedCells(kind: CellKind, slot: Y.Map<unknown>, timeSignature: string): TimedCell[] {
  const grid = Number(slot.get("grid")) || gridOf(kind);
  const [n, d] = meter(timeSignature);
  const perBar = Math.max(1, Math.round((n * grid) / d));
  return Array.from((slot.get("cells") as Y.Map<string>).entries())
    .flatMap(([key, value]) => {
      const k = parseKey(key);
      return k ? [{ time: (((k.bar - 1) * perBar + k.step - 1) * TICKS) / grid, string: k.string, value }] : [];
    })
    .sort((a, b) => a.time - b.time || a.string - b.string);
}

/** Записане в слоті на проміжку `from…to` (тіки позначок) — коротко, «3 5 7» чи «B T», для «було на …» втраченої примітки. */
export function cellsQuote(kind: CellKind, slot: Y.Map<unknown>, from: number, to: number, timeSignature: string): string {
  return timedCells(kind, slot, timeSignature)
    .filter((c) => c.time >= from && c.time < to && c.value !== "-")
    .map((c) => (kind === "cajon" ? (CAJON_ROWS[c.string - 1] ?? c.value) : kind === "piano" ? (PIANO_ROWS[c.string - 1] ?? c.value) : c.value))
    .join(" ");
}

/** Тіків позначок у повному такті розміру. */
export const barTicks = (timeSignature: string) => eighthsPerBar(timeSignature) * EIGHTH_TICKS;

/**
 * Стерти записане в слоті на проміжку `from…to` (тіки позначок) — видалення
 * виділених кроків, усіх ліній. Прямокутник, якого шматок стерли, за
 * проміжком теж обривається (його «-» далі). Викликати в транзакції.
 */
export function eraseSpan(kind: CellKind, slot: Y.Map<unknown>, from: number, to: number, timeSignature: string) {
  const grid = Number(slot.get("grid")) || gridOf(kind);
  const [n, d] = meter(timeSignature);
  const perBar = Math.max(1, Math.round((n * grid) / d));
  const cells = slot.get("cells") as Y.Map<string>;
  const indexOf = (key: string) => {
    const k = parseKey(key);
    return k ? (k.bar - 1) * perBar + k.step - 1 : -1;
  };
  const [first, end] = [Math.ceil((from * grid) / TICKS), Math.ceil((to * grid) / TICKS)];
  Array.from(cells.keys()).forEach((key) => {
    const i = indexOf(key);
    if (i >= first && i < end) cells.delete(key);
  });
  if (kind !== "blocks") return;
  const keyAt = (i: number) => `${Math.floor(i / perBar) + 1}.${(i % perBar) + 1}`;
  for (let i = end; cells.get(keyAt(i)) === "-"; i++) cells.delete(keyAt(i));
}

/** Записане на проміжку доріжки — що копіюють і переносять кроки смуги: час клітинок — від його початку, `length` — його довжина (тіки позначок). */
export type CellsClip = { kind: CellKind; length: number; cells: TimedCell[] };

/** Записане в слоті на проміжку `from…to` (тіки позначок), усіх ліній. */
export function copySpan(kind: CellKind, slot: Y.Map<unknown>, from: number, to: number, timeSignature: string): CellsClip {
  const cells = timedCells(kind, slot, timeSignature).filter((c) => c.time >= from && c.time < to);
  return { kind, length: to - from, cells: cells.map((c) => ({ ...c, time: c.time - from })) };
}

/**
 * Покласти `clip` у слот з `at` (тіки позначок): що там було на його
 * довжину — стерто, що за `end` (кінець рядка) — відкинуто. Викликати в
 * транзакції.
 */
export function pasteSpan(slot: Y.Map<unknown>, at: number, clip: CellsClip, end: number, timeSignature: string) {
  const to = Math.min(at + clip.length, end);
  eraseSpan(clip.kind, slot, at, to, timeSignature);
  const grid = Number(slot.get("grid")) || gridOf(clip.kind);
  const [n, d] = meter(timeSignature);
  const perBar = Math.max(1, Math.round((n * grid) / d));
  const cells = slot.get("cells") as Y.Map<string>;
  clip.cells.forEach((c) => {
    if (at + c.time >= to) return;
    const i = Math.round(((at + c.time) * grid) / TICKS);
    cells.set(`${Math.floor(i / perBar) + 1}.${(i % perBar) + 1}${clip.kind === "blocks" ? "" : `/${c.string}`}`, c.value);
  });
}

/** Такти: числом — стільки повних, масивом — розміри кожного (`barSizes`). */
type Bars = number | readonly number[];
const sizesOf = (bars: Bars, scale: Scale) => (typeof bars === "number" ? Array.from({ length: bars }, () => scale.cells) : bars);

/**
 * Доріжка текстом у масштабі — рядки, як їх показує редактор і кладе в буфер
 * (подія не на долі — у найближчій комірці).
 */
export function renderCells(kind: CellKind, entries: Iterable<[string, string]>, bars: Bars, scale: Scale): string[] {
  const steps = scale.cells;
  const sizes = sizesOf(bars, scale);
  const placed = placeCells(kind, entries, sizes, scale);
  const at = (bar: number, s: number, string = 0) => placed.get(`${(bar - 1) * steps + s}/${string}`)?.value;
  /** Такти текстом; `cells(b)` — комірки такту `b` (з 1) у його розмірі. */
  const barsText = (bar: (b: number) => string) => "|" + sizes.map((_, i) => bar(i + 1)).join("|") + "|";
  const each = (b: number, fn: (s: number) => string) => Array.from({ length: sizes[b - 1] }, (_, s) => fn(s)).join("");

  if (kind === "cajon") return CAJON_ROWS.map((name, row) => name + barsText((b) => each(b, (s) => (at(b, s, row) ? HIT : "-"))));
  if (kind === "piano") {
    // Лише клавіші, на яких щось є (88 ліній у буфері нікому не потрібні); порожньо — одна C4.
    const used = PIANO_ROWS.map((_, row) => row).filter((row) => sizes.some((size, b) => Array.from({ length: size }, (_, s) => at(b + 1, s, row)).some(Boolean)));
    const cellTicks = (scale.tick * TICKS) / scale.grid;
    return (used.length ? used : [PIANO_ROWS.indexOf("C4")]).map((row) => {
      let hold = 0; // скільки комірок нота ще звучить
      return (
        PIANO_ROWS[row] +
        barsText((b) =>
          each(b, (s) => {
            const v = at(b, s, row);
            if (v) {
              hold = Math.max(0, Math.round(noteLength(v) / cellTicks) - 1);
              return HIT;
            }
            if (hold <= 0) return "-";
            hold--;
            return HOLD;
          }),
        )
      );
    });
  }
  if (kind === "blocks")
    return [
      barsText((b) => {
        let out = "";
        let under = 0; // скільки ще кроків ховає під собою назва акорду
        for (let s = 0; s < sizes[b - 1]; s++) {
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
  const width = (step: number) => Math.max(1, ...TAB_STRINGS.map((_, string) => placed.get(`${step}/${string}`)?.value.length ?? 0));
  return TAB_STRINGS.map((name, string) => name + barsText((b) => each(b, (s) => (at(b, s, string) ?? "").padEnd(width((b - 1) * steps + s), "-"))));
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
  if (kind === "piano") {
    if (!lines.length || !lines.every(isPianoLine)) return null;
    const rows = lines.map((line) => PIANO_ROWS.indexOf(line.trim().split("|")[0].trim()));
    const perRow = lines.map(barsIn);
    const cellTicks = (scale.tick * TICKS) / grid;
    perRow.forEach((all, i) => {
      // «o==» — нота на три комірки, і через риску такту теж.
      let open: { bar: number; s: number; cells: number } | null = null;
      const close = () => open && put(open.bar, open.s, open.cells > 1 ? noteValue(open.cells * cellTicks) : HIT, rows[i]);
      all.forEach((text, b) =>
        [...text].forEach((ch, s) => {
          if (ch === HOLD && open) return void open.cells++;
          close();
          open = /[oxOX]/.test(ch) ? { bar: b + 1, s, cells: 1 } : null;
        }),
      );
      close();
    });
    return { cells, bars: Math.max(1, ...perRow.map((b) => b.length)), grid };
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
    if (kind === "cajon") [...text].forEach((ch, s) => cajonRow(ch) >= 0 && put(b + 1, s, HIT, cajonRow(ch)));
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
/** Лінії кахона: B, T, H, M — по «o» (чи «x») і «-». */
export const isCajonRows = (lines: string[]) =>
  lines.length === CAJON_ROWS.length && lines.every((line, i) => new RegExp(`^\\s*${CAJON_ROWS[i]}\\s*\\|([-oOxX]+\\|)+\\s*$`).test(line));
export const isBlocksLine = (line: string) => !isCajonLine(line) && /^\s*\|([^\s|]+\|)+\s*$/.test(line) && /[A-H]/.test(line);

/** Лінія піаніно: назва клавіші з октавою (`C4`, `F#3`) і такти з «o», «=» та «-». */
export const isPianoLine = (line: string) => {
  const m = /^\s*([A-G]#?\d)\s*\|([-=oOxX]+\|)+\s*$/.exec(line);
  return !!m && PIANO_ROWS.includes(m[1]);
};

/** Вид клітинкової доріжки, текстом якої починається `lines[i]`, і скільки рядків тексту вона займає. */
export function recognizeCells(lines: string[], i: number): { kind: CellKind; size: number } | null {
  if (isPianoLine(lines[i] ?? "")) {
    let size = 1;
    while (i + size < lines.length && isPianoLine(lines[i + size])) size++;
    return { kind: "piano", size };
  }
  if (lines.slice(i, i + 6).length === 6 && lines.slice(i, i + 6).every(isTabLine)) return { kind: "tab", size: 6 };
  if (isCajonRows(lines.slice(i, i + CAJON_ROWS.length))) return { kind: "cajon", size: CAJON_ROWS.length };
  if (isCajonLine(lines[i])) return { kind: "cajon", size: 1 };
  if (isBlocksLine(lines[i])) return { kind: "blocks", size: 1 };
  return null;
}

/** Замінити вміст доріжки розібраним (вставка); рядок подовжується під вставлені такти. Викликати в транзакції. */
export function writeParsed(line: Line, slot: Y.Map<unknown>, { cells, bars, grid }: Parsed, timeSignature: string) {
  const map = slot.get("cells") as Y.Map<string>;
  map.clear();
  Object.entries(cells).forEach(([key, value]) => map.set(key, value));
  slot.set("grid", grid);
  growLine(line, bars * eighthsPerBar(timeSignature), timeSignature);
}

/**
 * Друк символу `ch` у крок `at` за синтаксисом виду; повертає, де курсор далі.
 * `prev` — символ, надрукований у цій доріжці щойно перед цим (курсор відтоді
 * не переставляли), інакше `null`: з ним двозначний лад і назва акорду в
 * кілька символів. Викликати в транзакції.
 *
 * Таби й кахон — навігація ручна: друк лишає курсор на місці (цифри поспіль
 * — один лад, «12»), «-» чи пробіл стирають крок; на інший крок — стрілками.
 * У кахоні «o» чи «x» — удар на лінії курсора, B / T / H / M (і стара g — хет)
 * — удар на своїй лінії в цьому кроці.
 */
export function typeCell(
  kind: CellKind,
  slot: Y.Map<unknown>,
  scale: Scale,
  at: CellAt,
  ch: string,
  prev: string | null,
  /** Комірка за останньою в рядку (`endOf`). */
  total = barsOf(slot) * scale.cells,
): CellAt {
  const cells = slot.get("cells") as Y.Map<string>;
  const key = (a: CellAt) => cellKey(kind, scale, a);
  const next = { ...at, step: Math.min(at.step + 1, total - 1) };
  const clearAndNext = () => (cells.delete(key(at)), next);

  if (kind === "piano") {
    if (/[ox]/i.test(ch)) cells.set(key(at), HIT);
    else if (ch === "-" || ch === " " || ch === ".") cells.delete(key(at));
    return at;
  }
  if (kind === "cajon") {
    const row = cajonRow(ch);
    if (row >= 0) cells.set(key({ ...at, string: row }), HIT);
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
 * Тап по комірці піаніно: порожньо — нота, нота точно на долі комірки — геть,
 * як і довга нота, що ще звучить у цій комірці. Нота поруч (дрібніша за
 * масштаб) не чіпається — як і в друку; тоді тап ставить ще одну на долю.
 * Викликати в транзакції.
 */
export function toggleCell(kind: CellKind, slot: Y.Map<unknown>, scale: Scale, at: CellAt) {
  const cells = slot.get("cells") as Y.Map<string>;
  const key = cellKey(kind, scale, at);
  if (cells.has(key)) return void cells.delete(key);
  const held = kind === "piano" ? heldAt(slot, scale, at) : null;
  if (held) cells.delete(held);
  else cells.set(key, HIT);
}

/** Ключ довгої ноти піаніно, що звучить на долі комірки `at` (почалась раніше); `null` — такої немає. */
function heldAt(slot: Y.Map<unknown>, scale: Scale, at: CellAt): string | null {
  const per = TICKS / scale.grid;
  const tick = (Math.floor(at.step / scale.cells) * scale.ticks + (at.step % scale.cells) * scale.tick) * per;
  const perBar = scale.ticks;
  for (const [key, value] of (slot.get("cells") as Y.Map<string>).entries()) {
    const k = parseKey(key);
    if (!k || k.string !== at.string + 1) continue;
    const start = ((k.bar - 1) * perBar + k.step - 1) * per;
    if (start < tick && tick < start + noteLength(value)) return key;
  }
  return null;
}

/** Нота з мікрофона (запис вокалу): `time`, `length` — тіки `TICKS` від початку рядка, `midi` — висота. */
export type SungNote = { time: number; length: number; midi: number };

/**
 * Записати заспівані ноти в слот піаніно замість того, що там було на
 * проміжку `from…to` (тіки позначок), — як punch-in у DAW. Нота, що
 * почалась до проміжку й звучить у ньому, обрізається до його початку.
 * Викликати в транзакції.
 */
export function writeSung(slot: Y.Map<unknown>, from: number, to: number, notes: readonly SungNote[], timeSignature: string) {
  eraseSpan("piano", slot, from, to, timeSignature);
  timedCells("piano", slot, timeSignature).forEach(({ time, string, value }) => {
    const length = noteLength(value);
    if (time < from && time + length > from) putPianoNote(slot, { time, row: string - 1, value: noteValue(from - time) }, timeSignature);
  });
  notes.forEach(({ time, length, midi }) => {
    const row = PIANO_TOP - midi;
    if (row < 0 || row >= PIANO_ROWS.length || time < from || time >= to) return;
    putPianoNote(slot, { time, row, value: noteValue(length) }, timeSignature);
  });
}

/** Нота піаніно в рядку: `time` — тіки позначок від початку рядка, `row` — клавіша (з 0), `value` — `o` (ваншот) чи `o<тіки>`. */
export type PianoNote = { time: number; row: number; value: string };

/** Ключ запису ноти піаніно на `time` (тіки позначок від початку рядка) і клавіші `row` (з 0). */
function pianoKey(slot: Y.Map<unknown>, time: number, row: number, timeSignature: string) {
  const grid = Number(slot.get("grid")) || TICKS;
  const [n, d] = meter(timeSignature);
  const perBar = Math.max(1, Math.round((n * grid) / d));
  const i = Math.round((time * grid) / TICKS);
  return `${Math.floor(i / perBar) + 1}.${(i % perBar) + 1}/${row + 1}`;
}

/** Нота піаніно за ключем запису; немає — `null`. */
export function pianoNote(slot: Y.Map<unknown>, key: string, timeSignature: string): PianoNote | null {
  const value = (slot.get("cells") as Y.Map<string>).get(key);
  const k = parseKey(key);
  if (!value || !k) return null;
  const grid = Number(slot.get("grid")) || TICKS;
  const [n, d] = meter(timeSignature);
  const perBar = Math.max(1, Math.round((n * grid) / d));
  return { time: (((k.bar - 1) * perBar + k.step - 1) * TICKS) / grid, row: k.string - 1, value };
}

/**
 * Записати ноту піаніно — нову чи розтягнуту (на тому самому місці ключ
 * той самий, тож нота просто отримує нову тривалість). Нота, що вже
 * починалась там само на тій самій клавіші, замінюється. Викликати в транзакції.
 */
export function putPianoNote(slot: Y.Map<unknown>, note: PianoNote, timeSignature: string) {
  (slot.get("cells") as Y.Map<string>).set(pianoKey(slot, note.time, note.row, timeSignature), note.value);
}

/**
 * Перенести ноту `key` слота `from` на `time` і клавішу `row` слота `to` (той
 * самий рядок чи інший, тієї самої доріжки) — з її тривалістю. Викликати в транзакції.
 */
export function movePianoNote(from: Y.Map<unknown>, key: string, to: Y.Map<unknown>, time: number, row: number, timeSignature: string) {
  const note = pianoNote(from, key, timeSignature);
  if (!note) return;
  (from.get("cells") as Y.Map<string>).delete(key);
  putPianoNote(to, { time, row, value: note.value }, timeSignature);
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

/**
 * Склеювання: клітинки слота `from` дописуються в `to`, зсунуті на `offset`
 * вісімок (довжину першого рядка — і з неповним тактом). Це копія, як і
 * акорди. Викликати, поки `from` ще в документі.
 */
export function appendCells(from: Y.Map<unknown>, to: Y.Map<unknown>, offset: number, timeSignature: string) {
  const src = from.get("cells") as Y.Map<string>;
  if (!src?.size) return;
  const dst = to.get("cells") as Y.Map<string>;
  const grid = Number(to.get("grid")) || TICKS;
  const [n, d] = meter(timeSignature);
  const perBar = Math.max(1, Math.round((n * grid) / d));
  const shift = Math.round((offset * grid) / 8);
  src.forEach((value, key) => {
    const k = parseKey(key)!;
    const at = (k.bar - 1) * perBar + (k.step - 1) + shift; // від початку рядка
    dst.set(`${Math.floor(at / perBar) + 1}.${(at % perBar) + 1}${key.includes("/") ? `/${k.string}` : ""}`, value);
  });
}
