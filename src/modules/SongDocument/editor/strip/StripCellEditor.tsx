/**
 * Правка кроків у смузі лежачи (`SONG-98`) — поки що лише табів; далі —
 * решта клітинкових доріжок.
 *
 * Прокрутка й тап — як завжди. Тап по кроку виділяє його, і місце тапу на
 * екрані стає **прицілом**: гортаєш смугу — під прицілом проїжджають кроки, і
 * виділеним стає той, що під ним (вбік — по кроках, угору-вниз — по струнах).
 * Приціл над чимось, що не таби, — виділення немає, доки під нього не приїде
 * крок. Тап деінде — приціл знято.
 *
 * Щоб під приціл можна було підвести будь-який крок (і верхню струну, і
 * перший такт, і пісню, нижчу за екран), у правці навколо смуги — запас
 * порожнього паперу на екран з кожного боку; вигляд при цьому не стрибає.
 *
 * Лад вводить **дошка** справа — без клавіатури: 0–24 і «Стерти»; виділення
 * після вводу лишається на місці. Виділену комірку малює рамка в смузі
 * (`data-strip-cursor`); її ставимо прямо в DOM — на кожен крок прокрутки
 * React смугу не перемальовує.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import * as Y from "yjs";
import { cn } from "@/lib/utils";
import { CellAt, cellKey, CellKind, layout, readMeta, readZoom, scaleOf, Song } from "../../model";
import { stepAtPoint, stepX } from "../elements/stepGeometry";

/** Доріжки, які вже правляться лежачи. */
const EDITABLE: readonly string[] = ["tab"];
const FRETS = Array.from({ length: 25 }, (_, n) => String(n));
const KEY =
  "flex h-9 w-7 touch-manipulation items-center justify-center rounded-lg border border-stone-300 bg-white/80 text-sm font-semibold text-stone-700 active:bg-stone-200 disabled:opacity-40";

type Picked = { ln: number; lane: string; kind: CellKind; at: CellAt };

const same = (a: Picked | null, b: Picked | null) =>
  a === b || (!!a && !!b && a.ln === b.ln && a.lane === b.lane && a.at.step === b.at.step && a.at.string === b.at.string);

type Props = { song: Song; me: string | null; scroller: RefObject<HTMLDivElement | null> };

export function StripCellEditor({ song, me, scroller }: Props) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  /** Приціл — точка у вікні смуги (px від її лівого верхнього кута). */
  const anchor = useRef<{ x: number; y: number } | null>(null);

  /** Крок доріжки, що правиться, під точкою екрана — з геометрії її рамки (`StepsBox`). */
  const pickAt = (x: number, y: number): Picked | null => {
    const box = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-strip-steps]");
    if (!box || !scroller.current?.contains(box) || !EDITABLE.includes(box.dataset.kind ?? "")) return null;
    const d = box.dataset;
    const r = box.getBoundingClientRect();
    const sizes = (d.sizes ?? "").split(",").map(Number);
    const at = stepAtPoint(x - r.left, y - r.top, sizes, Number(d.cells), Number(d.stepPx), Number(d.rowPx), Number(d.rows));
    return { ln: Number(d.ln), lane: d.lane ?? "", kind: d.kind as CellKind, at };
  };

  /** Рамка виділеного кроку в смузі; немає виділення чи кроку — схована. */
  const place = (p: Picked | null) => {
    const cursor = scroller.current?.querySelector<HTMLElement>("[data-strip-cursor]");
    if (!cursor) return;
    const box = p && scroller.current?.querySelector<HTMLElement>(`[data-strip-steps][data-ln="${p.ln}"][data-lane="${CSS.escape(p.lane)}"]`);
    if (!p || !box || !cursor.parentElement) return void (cursor.style.display = "none");
    const grid = cursor.parentElement.getBoundingClientRect();
    const r = box.getBoundingClientRect();
    const stepPx = Number(box.dataset.stepPx);
    const rowPx = Number(box.dataset.rowPx);
    Object.assign(cursor.style, {
      display: "block",
      left: `${r.left - grid.left + stepX(p.at.step, Number(box.dataset.cells), stepPx)}px`,
      top: `${r.top - grid.top + p.at.string * rowPx}px`,
      width: `${stepPx}px`,
      height: `${rowPx}px`,
    });
  };

  const select = (p: Picked | null) => {
    if (!same(p, pickedRef.current)) setPicked((pickedRef.current = p));
    place(p);
  };

  // Тап — виділити крок і поставити приціл; гортання — виділення за прицілом.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const p = pickAt(e.clientX, e.clientY);
      const box = el.getBoundingClientRect();
      anchor.current = p ? { x: e.clientX - box.left, y: e.clientY - box.top } : null;
      select(p);
    };
    const onScroll = () => {
      if (!anchor.current) return;
      const box = el.getBoundingClientRect();
      select(pickAt(box.left + anchor.current.x, box.top + anchor.current.y));
    };
    el.addEventListener("click", onClick);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("click", onClick);
      el.removeEventListener("scroll", onScroll);
      place(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scroller]);

  // Запас навколо смуги на час правки; прокрутку зсуваємо на нього ж — вигляд не стрибає.
  useLayoutEffect(() => {
    const el = scroller.current;
    const grid = el?.querySelector<HTMLElement>("[data-strip]");
    if (!el || !grid) return;
    const [x, y] = [el.clientWidth, el.clientHeight];
    grid.style.padding = `${y}px ${x}px`;
    el.scrollLeft += x;
    el.scrollTop += y;
    return () => {
      const [left, top] = [el.scrollLeft, el.scrollTop];
      grid.style.padding = "";
      el.scrollLeft = left - x;
      el.scrollTop = top - y;
    };
  }, [scroller]);

  // Пісня змінилась (свій ввід, чужа правка) — смуга перемальована: рамку — на місце.
  useLayoutEffect(() => place(pickedRef.current));

  const { timeSignature } = readMeta(song.doc);
  const zoom = me ? readZoom(song.doc, me) : undefined;
  const cellsOf = (p: Picked) => {
    const slot = layout(song)[p.ln]?.line.get(p.lane);
    return slot instanceof Y.Map && slot.get("cells") instanceof Y.Map ? (slot.get("cells") as Y.Map<string>) : null;
  };
  const keyOf = (p: Picked) => cellKey(p.kind, scaleOf(p.kind, timeSignature, zoom), p.at);
  const value = picked ? (cellsOf(picked)?.get(keyOf(picked)) ?? null) : null;
  const write = (fret: string | null) => {
    const p = pickedRef.current;
    const cells = p && cellsOf(p);
    if (!p || !cells) return;
    song.doc.transact(() => (fret === null ? cells.delete(keyOf(p)) : cells.set(keyOf(p), fret)));
  };

  return (
    <div className="flex shrink-0 flex-col justify-center gap-1 border-l border-stone-300 bg-[#f8f5eb] p-1.5" aria-label="Дошка ладів">
      <div className="grid grid-cols-5 gap-1">
        {FRETS.map((fret) => (
          <button
            key={fret}
            type="button"
            disabled={!picked}
            onClick={() => write(fret)}
            aria-pressed={value === fret}
            className={cn(KEY, value === fret && "border-primary bg-primary text-primary-foreground")}
          >
            {fret}
          </button>
        ))}
      </div>
      <button type="button" disabled={!picked || value === null} onClick={() => write(null)} className={cn(KEY, "w-full text-xs")}>
        Стерти
      </button>
    </div>
  );
}
