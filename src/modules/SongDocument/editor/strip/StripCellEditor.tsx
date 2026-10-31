/**
 * Правка кроків у смузі лежачи (`SONG-98`) — поки що лише табів; далі —
 * решта клітинкових доріжок.
 *
 * Тап по кроку виділяє його; тап поза кроками табів — виділення знято.
 * Прокрутка — звичайна, виділення не чіпає.
 *
 * Справа — **дошка**, без клавіатури: 0–24 і «Стерти»; виділення після вводу
 * лишається на місці. Під нею — **тачпад**: веди по ньому пальцем, і виділення
 * їде за ним по одній осі за жест — вбік по кроках (і далі в сусідній рядок
 * пісні), угору-вниз по струнах, — на крок чи струну за кожен їхній розмір
 * руху пальця. Смуга гортається сама, щоб виділене було видно. Виділену
 * комірку малює рамка в смузі (`data-strip-cursor`); її ставимо прямо в DOM.
 */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import * as Y from "yjs";
import { Move } from "lucide-react";
import { cn } from "@/lib/utils";
import { CellAt, cellKey, CellKind, layout, readMeta, readZoom, scaleOf, Song } from "../../model";
import { stepAtPoint, stepX } from "../elements/stepGeometry";
import { STRIP_GUTTER } from "./Strip";

/** Доріжки, які вже правляться лежачи. */
const EDITABLE: readonly string[] = ["tab"];
const FRETS = Array.from({ length: 25 }, (_, n) => String(n));
const KEY =
  "flex h-8 w-7 touch-manipulation items-center justify-center rounded-lg border border-stone-300 bg-white/80 text-sm font-semibold text-stone-700 active:bg-stone-200 disabled:opacity-40";
/** Стільки пікселів руху пальця на тачпаді вирішують вісь жесту. */
const AXIS_PX = 8;

type Picked = { ln: number; lane: string; kind: CellKind; at: CellAt };

const same = (a: Picked | null, b: Picked | null) =>
  a === b || (!!a && !!b && a.ln === b.ln && a.lane === b.lane && a.at.step === b.at.step && a.at.string === b.at.string);

/** Кроки рядка доріжки по порядку: такти по `cells` комірок, останній буває коротший. */
const stepsOf = (box: HTMLElement) => {
  const cells = Number(box.dataset.cells);
  return (box.dataset.sizes ?? "").split(",").map(Number).flatMap((n, bar) => Array.from({ length: n || 0 }, (_, s) => bar * cells + s));
};

type Props = { song: Song; me: string | null; scroller: RefObject<HTMLDivElement | null> };

export function StripCellEditor({ song, me, scroller }: Props) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

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

  /** Рамки кроків доріжки `lane` по рядках пісні. */
  const boxesOf = (lane: string) =>
    Array.from(scroller.current?.querySelectorAll<HTMLElement>(`[data-strip-steps][data-lane="${CSS.escape(lane)}"]`) ?? []).sort(
      (a, b) => Number(a.dataset.ln) - Number(b.dataset.ln),
    );
  /** Рамка кроків доріжки рядка, де виділення. */
  const boxOf = (p: Picked) => boxesOf(p.lane).find((b) => Number(b.dataset.ln) === p.ln) ?? null;

  /** Рамка виділеного кроку в смузі; немає виділення чи кроку — схована. */
  const place = (p: Picked | null) => {
    const cursor = scroller.current?.querySelector<HTMLElement>("[data-strip-cursor]");
    if (!cursor) return;
    const box = p && boxOf(p);
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

  /** Гортає смугу так, щоб рамку було видно — не під полем підписів і не під липкими рядами згори; вбік — із запасом у крок. */
  const reveal = () => {
    const el = scroller.current;
    const cursor = el?.querySelector<HTMLElement>("[data-strip-cursor]");
    if (!el || !cursor || cursor.style.display === "none") return;
    const v = el.getBoundingClientRect();
    const c = cursor.getBoundingClientRect();
    const [left, right, top] = [v.left + STRIP_GUTTER + c.width, v.left + el.clientWidth - c.width, v.top + Number(cursor.dataset.headPx)];
    if (c.left < left) el.scrollLeft -= left - c.left;
    else if (c.right > right) el.scrollLeft += c.right - right;
    if (c.top < top) el.scrollTop -= top - c.top;
    else if (c.bottom > v.top + el.clientHeight) el.scrollTop += c.bottom - v.top - el.clientHeight;
  };

  /** Виділення на `n` кроків (вбік, через межі рядків пісні) чи струн (у межах доріжки). */
  const shift = (axis: "x" | "y", n: number) => {
    let p = pickedRef.current;
    let box = p && boxOf(p);
    if (!p || !box) return;
    if (axis === "y") {
      const string = Math.min(Math.max(p.at.string + n, 0), Number(box.dataset.rows) - 1);
      select({ ...p, at: { ...p.at, string } });
    } else {
      const boxes = boxesOf(p.lane);
      for (let d = Math.sign(n), left = Math.abs(n); left > 0 && p && box; left--) {
        const steps = stepsOf(box);
        const i = steps.indexOf(p.at.step) + d;
        if (i >= 0 && i < steps.length) {
          p = { ...p, at: { ...p.at, step: steps[i] } };
          continue;
        }
        // Край рядка — у сусідній рядок пісні, де доріжка має кроки.
        const at = boxes.indexOf(box);
        const to = (d > 0 ? boxes.slice(at + 1) : boxes.slice(0, at).reverse()).find((b) => stepsOf(b).length);
        if (!to) break;
        const toSteps = stepsOf(to);
        box = to;
        p = { ...p, ln: Number(to.dataset.ln), at: { step: d > 0 ? toSteps[0] : toSteps[toSteps.length - 1], string: Math.min(p.at.string, Number(to.dataset.rows) - 1) } };
      }
      select(p);
    }
    reveal();
  };

  // Тап — виділити крок (чи зняти виділення, коли під пальцем не таби).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => select(pickAt(e.clientX, e.clientY));
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("click", onClick);
      place(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scroller]);

  // Пісня змінилась (свій ввід, чужа правка) — смуга перемальована: рамку — на місце.
  useLayoutEffect(() => place(pickedRef.current));

  // Тачпад: вісь — за першими пікселями руху; далі крок чи струна на кожен їхній розмір руху пальця.
  const drag = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null; done: number } | null>(null);
  const onPadDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!pickedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, done: 0 };
  };
  const onPadMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    const box = pickedRef.current && boxOf(pickedRef.current);
    if (!g || g.id !== e.pointerId || !box) return;
    const [dx, dy] = [e.clientX - g.x, e.clientY - g.y];
    if (!g.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_PX) return;
      g.axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
    }
    const n = Math.round(g.axis === "x" ? dx / Number(box.dataset.stepPx) : dy / Number(box.dataset.rowPx));
    if (n !== g.done) shift(g.axis, n - g.done);
    g.done = n;
  };
  const onPadUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

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
    <div className="flex shrink-0 flex-col gap-1 border-l border-stone-300 bg-[#f8f5eb] p-1.5" aria-label="Дошка ладів">
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
      <div
        role="group"
        aria-label="Тачпад: веди пальцем — виділення їде за ним"
        aria-disabled={!picked}
        onPointerDown={onPadDown}
        onPointerMove={onPadMove}
        onPointerUp={onPadUp}
        onPointerCancel={onPadUp}
        className={cn(
          "flex min-h-14 flex-1 touch-none select-none items-center justify-center rounded-lg border border-stone-300 bg-white/50 text-stone-300",
          !picked && "opacity-40",
        )}
      >
        <Move className="size-6" />
      </div>
    </div>
  );
}
