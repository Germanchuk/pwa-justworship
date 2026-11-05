/**
 * Правка нот піаніно в смузі — на ПК мишею й лежачи пальцем, як piano roll у
 * FL Studio (`SONG-99`):
 *
 *  - клік по порожній комірці ставить ноту довжиною останньої взятої,
 *    поставленої чи розтягнутої (спершу — комірка сітки); мишею її, не
 *    відпускаючи, одразу ведуть;
 *  - протяг ноти переносить її в часі й по висоті — по комірках сітки людини,
 *    і в сусідній рядок пісні теж; протяг правого краю — довжина;
 *  - правий клік стирає ноту, з протягом — усі, по яких провів; пальцем —
 *    тап по ноті;
 *  - Ctrl/⌘ + протяг мишею, довгий натиск пальцем — виділення кроків під
 *    примітки (`useStripSteps`), а не правка.
 *
 * Пальцем по порожньому смуга гортається, як завжди: нота стає лише від тапу.
 * Поки ведуть, нота на екрані — тінню, а в пісню пишеться, коли відпустили:
 * один запис на жест, і клавіші смуги під пальцем не з'їжджають (їхній
 * діапазон залежить від нот). Правиться лише нота точно на долі комірки, як і
 * в друку (`SONG-83`): її `StepRows` і робить «взятою» (`data-piano-note`).
 */
import { useEffect, useRef, type RefObject } from "react";
import * as Y from "yjs";
import { cellAt, cellSpan, layout, movePianoNote, noteLength, noteValue, pianoMidi, pianoNote, putPianoNote, readMeta, scaleOf, TICKS, type Scale, type Song } from "../../model";
import { previewNote } from "../../playback/preview";
import { boundaryAtX, INK, noteRect, PIANO_ROW_PX, stepAtPoint } from "../elements/stepGeometry";
import { LONG_PRESS_MS } from "./useStripSteps";

/** Довжина останньої взятої, поставленої чи розтягнутої ноти (тіки позначок) — такою стає нова, як у FL Studio. */
let lastLength: number | null = null;

/** Далі — протяг пальцем, а не тап (як і в `useStripSteps`). */
const MOVE_PX = 8;

const PIANO_BOX = '[data-strip-steps][data-kind="piano"]';

/** Рамка кроків доріжки піаніно в рядку пісні з її геометрією (`StepsBox`); `top` — клавіша першої лінії. */
type Box = { el: HTMLElement; ln: number; lane: string; sizes: number[]; cells: number; stepPx: number; rows: number; top: number; total: number };

function boxOf(el: HTMLElement): Box {
  const d = el.dataset;
  const sizes = (d.sizes ?? "").split(",").map(Number);
  const cells = Number(d.cells);
  const total = (sizes.length - 1) * cells + sizes[sizes.length - 1];
  return { el, ln: Number(d.ln), lane: d.lane ?? "", sizes, cells, stepPx: Number(d.stepPx), rows: Number(d.rows), top: Number(d.keyTop), total };
}

/** Комірка й клавіша під точкою екрана; поза рамкою — найближчі. */
function pointIn(box: Box, x: number, y: number) {
  const r = box.el.getBoundingClientRect();
  const at = stepAtPoint(x - r.left, y - r.top, box.sizes, box.cells, box.stepPx, PIANO_ROW_PX, box.rows);
  return { cell: at.step, row: box.top + at.string };
}

/** Де нота: рамка рядка, комірка початку, клавіша (з 0), тривалість у тіках. */
type Spot = { box: Box; cell: number; row: number; length: number };
const same = (a: Spot, b: Spot) => a.box.el === b.box.el && a.cell === b.cell && a.row === b.row && a.length === b.length;

type Gesture = {
  id: number;
  touch: boolean;
  x0: number;
  y0: number;
  t0: number;
  mode: "new" | "move" | "resize";
  /** Взята нота (`move`, `resize`) — ключ запису; нова — `null`. */
  key: string | null;
  /** Значення ноти (`o`, `o<тіки>`): переноситься як є. */
  value: string;
  /** На скільки комірок від початку ноти її взяли. */
  grab: number;
  /** Звідки почали і де нота (тінь) зараз. */
  start: Spot;
  spot: Spot;
  /** Пальцем — повели далі за `MOVE_PX`: це вже не тап. */
  drag: boolean;
};

type Opts = { song: Song; zoom: number | undefined; on: boolean };

export function usePianoEdit(container: RefObject<HTMLElement | null>, { song, zoom, on }: Opts) {
  const latest = useRef({ song, zoom });
  latest.current = { song, zoom };

  useEffect(() => {
    const el = container.current;
    if (!on || !el) return;
    const ts = () => readMeta(latest.current.song.doc).timeSignature;
    const scale = () => scaleOf("piano", ts(), latest.current.zoom);
    const cellTicks = (sc: Scale) => (sc.tick * TICKS) / sc.grid;
    const slotOf = (box: Box) => {
      const slot = layout(latest.current.song)[box.ln]?.line.get(box.lane);
      return slot instanceof Y.Map && slot.get("cells") instanceof Y.Map ? (slot as Y.Map<unknown>) : null;
    };
    const change = (fn: () => void) => latest.current.song.doc.transact(fn);
    const erase = (box: Box, key: string) => {
      const cells = slotOf(box)?.get("cells") as Y.Map<string> | undefined;
      if (cells?.has(key)) change(() => cells.delete(key));
    };

    let g: Gesture | null = null;
    /** Права кнопка затиснута: стираємо все, по чому ведуть. */
    let erasing: number | null = null;

    // Тінь ноти — поверх нот смуги, поки її ведуть.
    const ghost = document.createElement("div");
    ghost.className = "pointer-events-none absolute rounded-[2px]";
    Object.assign(ghost.style, { zIndex: "3", height: `${PIANO_ROW_PX - 2}px`, background: INK.piano, boxShadow: "0 0 0 1px #fff, 0 1px 4px rgba(0,0,0,0.35)" });
    const showGhost = (s: Spot, sc: Scale) => {
      const grid = s.box.el.querySelector("[data-piano-grid]");
      if (!grid) return;
      if (ghost.parentElement !== grid) grid.appendChild(ghost);
      const { left, width } = noteRect(s.cell, s.length / cellTicks(sc), s.box.cells, s.box.total, s.box.stepPx);
      Object.assign(ghost.style, { left: `${left}px`, width: `${width}px`, top: `${(s.row - s.box.top) * PIANO_ROW_PX + 1}px` });
    };
    /** Взята нота, поки її ведуть, на старому місці не видно — лише тінь. */
    let hidden: HTMLElement | null = null;
    const finish = () => {
      ghost.remove();
      const was = hidden;
      hidden = null;
      // Записане перемалює смугу; до того нота лишається схованою, щоб не блимнула на старому місці.
      if (was) requestAnimationFrame(() => requestAnimationFrame(() => (was.style.visibility = "")));
      g = null;
    };

    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const boxEl = target?.closest?.<HTMLElement>(PIANO_BOX);
      if (!target || !boxEl || !el.contains(boxEl) || g || erasing !== null || !e.isPrimary) return;
      const mouse = e.pointerType === "mouse";
      if (mouse && (e.ctrlKey || e.metaKey)) return; // виділення кроків (`useStripSteps`)
      if (mouse && e.button !== 0 && e.button !== 2) return;
      const box = boxOf(boxEl);
      const sc = scale();
      const key = target.closest<HTMLElement>("[data-piano-note]")?.dataset.pianoNote ?? null;
      if (mouse) {
        e.preventDefault(); // не виділення тексту
        el.setPointerCapture(e.pointerId);
      }
      if (mouse && e.button === 2) {
        erasing = e.pointerId;
        if (key) erase(box, key);
        return;
      }
      const p = pointIn(box, e.clientX, e.clientY);
      const base = { id: e.pointerId, touch: !mouse, x0: e.clientX, y0: e.clientY, t0: Date.now(), drag: false };
      if (key) {
        const slot = slotOf(box);
        const note = slot && pianoNote(slot, key, ts());
        if (!note) return;
        const spot = { box, cell: Math.round(cellAt(sc, note.time)), row: note.row, length: noteLength(note.value) || cellTicks(sc) };
        const mode = target.closest("[data-piano-edge]") ? "resize" : "move";
        g = { ...base, mode, key, value: note.value, grab: p.cell - spot.cell, start: spot, spot };
        if (mouse) {
          lastLength = spot.length; // узяв ноту — нові будуть такої довжини
          if (mode === "move") previewNote(pianoMidi(note.row));
        }
      } else {
        const length = lastLength ?? cellTicks(sc);
        const spot = { box, cell: p.cell, row: p.row, length };
        g = { ...base, mode: "new", key: null, value: noteValue(length), grab: 0, start: spot, spot };
        // Мишею нота стає одразу, і її, не відпускаючи, ведуть; пальцем — лише від тапу (протяг — прокрутка).
        if (mouse) {
          showGhost(spot, sc);
          previewNote(pianoMidi(p.row));
        }
      }
    };

    /** Куди ляже нота, яку ведуть: та сама доріжка, хоч і в сусідньому рядку пісні; з рядка не вилазить. */
    const carried = (g: Gesture, x: number, y: number): Spot => {
      const under = document.elementFromPoint(x, y)?.closest<HTMLElement>(PIANO_BOX);
      const box = under && el.contains(under) && under.dataset.lane === g.start.box.lane ? boxOf(under) : g.spot.box;
      const p = pointIn(box, x, y);
      return { box, cell: Math.min(Math.max(p.cell - g.grab, 0), box.total - 1), row: p.row, length: g.spot.length };
    };
    /** Нова довжина ноти, яку тягнуть за край: до найближчої межі комірок, не менше комірки. */
    const resized = (g: Gesture, x: number, sc: Scale): Spot => {
      const { box, cell } = g.start;
      const end = Math.max(cell + 1, boundaryAtX(x - box.el.getBoundingClientRect().left, box.sizes, box.cells, box.stepPx));
      return { ...g.start, length: cellSpan(sc, end - 1)[1] - cellSpan(sc, cell)[0] };
    };

    const onMove = (e: PointerEvent) => {
      if (erasing === e.pointerId) {
        const note = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-piano-note]");
        const boxEl = note?.closest<HTMLElement>(PIANO_BOX);
        if (note && boxEl && el.contains(boxEl)) erase(boxOf(boxEl), note.dataset.pianoNote!);
        return;
      }
      if (!g || e.pointerId !== g.id) return;
      if (g.touch && !g.drag) {
        if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) <= MOVE_PX) return;
        // Пальцем по порожньому — прокрутка; затримався на ноті — виділення кроків (`useStripSteps`).
        if (g.mode === "new" || Date.now() - g.t0 >= LONG_PRESS_MS) return finish();
        g.drag = true;
      }
      const sc = scale();
      const next = g.mode === "resize" ? resized(g, e.clientX, sc) : carried(g, e.clientX, e.clientY);
      if (same(next, g.spot)) return;
      if (next.row !== g.spot.row) previewNote(pianoMidi(next.row));
      g.spot = next;
      if (g.key && !hidden) {
        hidden = g.start.box.el.querySelector<HTMLElement>(`[data-piano-note="${CSS.escape(g.key)}"]`);
        if (hidden) hidden.style.visibility = "hidden";
      }
      showGhost(next, sc);
    };

    const onUp = (e: PointerEvent) => {
      if (erasing === e.pointerId) return void (erasing = null);
      if (!g || e.pointerId !== g.id) return;
      const { mode, key, start, spot, value } = g;
      const tap = g.touch && !g.drag;
      const time = cellSpan(scale(), spot.cell)[0];
      if (tap && Date.now() - g.t0 >= LONG_PRESS_MS) {
        // Довгий натиск — це виділення кроків, ноти не чіпаємо.
      } else if (mode === "new") {
        const slot = slotOf(spot.box);
        if (slot) {
          change(() => putPianoNote(slot, { time, row: spot.row, value }, ts()));
          lastLength = spot.length;
          if (tap) previewNote(pianoMidi(spot.row));
        }
      } else if (tap && mode === "move" && key) erase(start.box, key);
      else if (key && !same(spot, start)) {
        const [from, to] = [slotOf(start.box), slotOf(spot.box)];
        if (from && to) {
          change(() => (mode === "resize" ? putPianoNote(from, { time, row: spot.row, value: noteValue(spot.length) }, ts()) : movePianoNote(from, key, to, time, spot.row, ts())));
          lastLength = spot.length;
        }
      }
      finish();
    };

    const onCancel = (e: PointerEvent) => {
      if (erasing === e.pointerId) erasing = null;
      if (g && e.pointerId === g.id) finish();
    };
    // Правий клік у піаніно — стерти, а не меню браузера.
    const onMenu = (e: Event) => (e.target as Element | null)?.closest?.(PIANO_BOX) && e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("contextmenu", onMenu);
    return () => {
      finish();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("contextmenu", onMenu);
    };
  }, [container, on]);
}
