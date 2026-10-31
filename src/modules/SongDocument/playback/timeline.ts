/**
 * Програвання доріжок (ADR-0009) без звуку й DOM: що звучить у рядку і коли.
 *
 * Час — тіки позначок (`TICKS` = 384 на цілу ноту) від початку рядка, як і в
 * клітинок (`timedCells`). Рядок триває свою довжину (`lineTicks`); у
 * порожнього відрізка це такт тиші — грає те, що написано. Порожні рядки й
 * структурні примітки клітинкових доріжок не мають (`SONG-76`), тож і часу
 * не займають.
 *
 * Звучать доріжки, які людина бачить: сховав — не звучить (окремих
 * перемикачів звуку немає).
 */
import * as Y from "yjs";
import { barTicks, CAJON_ROWS, pianoMidi, CellKind, CELL_KINDS, layout, lineKind, lineTicks, readMeta, songLanes, Song, timedCells, TICKS } from "../model";

export type CajonHit = (typeof CAJON_ROWS)[number];

/** Подія рядка: `tick` — від початку рядка. */
export type Hit = { tick: number; lane: string } & (
  | { kind: "tab"; string: number; fret: number | "x" }
  | { kind: "cajon"; hit: CajonHit }
  /** Нота піаніно — поки ваншот, як удар. */
  | { kind: "note"; midi: number }
  /** Акорд прямокутника звучить до наступного акорду або до кінця такту. */
  | { kind: "chord"; name: string; length: number }
);

/** Що звучить у рядку `ln`: довжина й події за часом; `null` — рядок часу не займає. */
export type LinePlan = { length: number; hits: Hit[] };

export function linePlan(song: Song, ln: number, hidden: readonly string[]): LinePlan | null {
  const l = layout(song)[ln];
  if (!l || lineKind(l) !== "segment") return null;
  const { timeSignature } = readMeta(song.doc);
  const length = lineTicks(l.line, timeSignature);
  const bar = barTicks(timeSignature);
  const hits: Hit[] = [];
  songLanes(song.doc)
    .filter((lane) => (CELL_KINDS as readonly string[]).includes(lane.kind) && !hidden.includes(lane.id))
    .forEach(({ id, kind }) => {
      const slot = l.line.get(id);
      if (!(slot instanceof Y.Map) || !slot.has("cells")) return;
      const cells = timedCells(kind as CellKind, slot as Y.Map<unknown>, timeSignature).filter((c) => c.time < length);
      if (kind === "tab") {
        cells.forEach(({ time, string, value }) => {
          const fret = value === "x" || value === "X" ? "x" : Number(value);
          if (fret === "x" || Number.isFinite(fret)) hits.push({ tick: time, lane: id, kind: "tab", string, fret });
        });
      } else if (kind === "piano") {
        cells.forEach(({ time, string }) => hits.push({ tick: time, lane: id, kind: "note", midi: pianoMidi(string - 1) }));
      } else if (kind === "cajon") {
        cells.forEach(({ time, string }) => {
          const hit = CAJON_ROWS[string - 1];
          if (hit) hits.push({ tick: time, lane: id, kind: "cajon", hit });
        });
      } else {
        const starts = cells.filter((c) => c.value !== "-" && c.value !== ".");
        starts.forEach(({ time, value }, i) => {
          const barEnd = (Math.floor(time / bar) + 1) * bar;
          const end = Math.min(starts[i + 1]?.time ?? Infinity, barEnd, length);
          hits.push({ tick: time, lane: id, kind: "chord", name: value, length: end - time });
        });
      }
    });
  return { length, hits: hits.sort((a, b) => a.tick - b.tick) };
}

/** Проміжок рядка, що грає: `from…to` — тіки від його початку. */
export type Span = { line: number; from: number; to: number };

/** Наступний рядок після `ln`, що займає час; `null` — пісня скінчилась. */
export function nextLine(song: Song, ln: number, hidden: readonly string[]): Span | null {
  const lines = layout(song).length;
  for (let i = ln + 1; i < lines; i++) {
    const plan = linePlan(song, i, hidden);
    if (plan) return { line: i, from: 0, to: plan.length };
  }
  return null;
}

/**
 * Секунд у тіку: BPM рахує долю розміру (`PLAY-35`) — у `4/4` чверті, у `6/8`
 * вісімки; `percent` — особистий темп програвання.
 */
export function tickSeconds(bpm: number, timeSignature: string, percent: number) {
  const unit = Number(timeSignature.split("/")[1]) || 4;
  return (60 * unit) / (bpm * TICKS * (percent / 100));
}
