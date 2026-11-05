/**
 * Виділення кроків у смузі під примітки (`NOTE-50`, `SONG-98`) — спільне для
 * телефона лежачи й ПК, в обох режимах. Лише **довгим натиском**: короткий тап
 * у примітках участі не бере (у правці він ставить комірку для ладу,
 * `StripCellEditor`), а лише ховає палітру чи меню позначки.
 *
 * Виділений крок — увесь стовпчик (у табах — усі шість струн):
 *  - довгий натиск на кроці — його стовпчик; повів, не відпускаючи, — кілька
 *    поспіль (сторінка тоді не прокручується), лише в межах рядка доріжки;
 *  - довгий натиск на позначеному кроці й відпустив на місці — меню його позначок;
 *  - миша — так само: затримав кнопку чи одразу повів на інший крок.
 *
 * У правці виділене ще й копіюють і переносять (`clip.ts`): «Копіювати» кладе
 * його в буфер (`clip`), а довгий натиск на самому виділеному бере його —
 * веди, і воно їде за пальцем, на тій самій доріжці й через рядки пісні;
 * відпустив — записане перенесено туди.
 *
 * Як і в редакторі, виділене — проміжок часу рядка в тіках (`cellSpan`).
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { cellSpan, CellKind, NoteView, readMeta, scaleOf, Song, type CellsClip } from "../../model";
import { stepAtPoint } from "../elements/stepGeometry";
import { KEEP } from "../notes/NotesTools";
import { copySteps, editable, moveSteps } from "./clip";

/** Виділені кроки доріжки `lane` рядка `ln`: `from…to` — тіки від початку рядка (кінець не входить). */
export type StepsSel = { ln: number; lane: string; from: number; to: number };

export const LONG_PRESS_MS = 450;

/**
 * `edit` — режим правки: виділене можна копіювати й переносити. `pianoEdit` —
 * ноти піаніно правляться мишею (`usePianoEdit`): там протяг мишею — нота, а
 * кроки виділяє лише Ctrl/⌘ + протяг, як рамка в FL Studio.
 */
type Opts = { song: Song; zoom: number | undefined; notes: NoteView[]; on: boolean; edit?: boolean; pianoEdit?: boolean };

export function useStripSteps(container: RefObject<HTMLElement | null>, { song, zoom, notes, on, edit = false, pianoEdit = false }: Opts) {
  const [steps, setSteps] = useState<StepsSel | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  /** Картки, щойно додані без тексту («Додати нотатку»): видно, поки поле не покинули. */
  const [drafts, setDrafts] = useState<string[]>([]);
  const addDraft = (id: string) => setDrafts((d) => [...d, id]);
  const dropDraft = (id: string) => setDrafts((d) => (d.includes(id) ? d.filter((x) => x !== id) : d));
  const [clip, setClip] = useState<CellsClip | null>(null);
  const latest = useRef({ song, zoom, notes, edit, steps, pianoEdit });
  latest.current = { song, zoom, notes, edit, steps, pianoEdit };

  const select = (next: StepsSel | null) => {
    setPicked((prev) => (prev.length ? [] : prev));
    setSteps((prev) => (prev === next || (prev && next && prev.ln === next.ln && prev.lane === next.lane && prev.from === next.from && prev.to === next.to) ? prev : next));
  };
  /** Обрати позначки — виділення кроків знято. */
  const pick = (ids: string[]) => {
    setSteps(null);
    setPicked(ids);
  };
  /** Виділене — в буфер; виділення знято, щоб у правці повернулась дошка з «Вставити». */
  const copy = () => {
    if (steps) setClip(copySteps(song, steps));
    select(null);
  };

  useEffect(() => {
    if (!on) return void (setSteps(null), setPicked([]));
    const el = container.current;
    if (!el) return;

    const boxAt = (target: EventTarget | null) => {
      const box = (target as Element | null)?.closest?.<HTMLElement>("[data-strip-steps]");
      return box && el.contains(box) ? box : null;
    };
    /** Крок рамки `box` під `x` екрана; поза рамкою — крайній. */
    const stepOf = (box: HTMLElement, x: number) => {
      const d = box.dataset;
      return stepAtPoint(x - box.getBoundingClientRect().left, 0, (d.sizes ?? "").split(",").map(Number), Number(d.cells), Number(d.stepPx), 1, 1).step;
    };
    const spanOf = (box: HTMLElement, a: number, b: number): StepsSel => {
      const d = box.dataset;
      const scale = scaleOf(d.kind as CellKind, readMeta(latest.current.song.doc).timeSignature, latest.current.zoom);
      return { ln: Number(d.ln), lane: d.lane ?? "", from: cellSpan(scale, Math.min(a, b))[0], to: cellSpan(scale, Math.max(a, b))[1] };
    };
    const choose = (box: HTMLElement, a: number, b: number) => {
      window.getSelection()?.removeAllRanges();
      select(spanOf(box, a, b));
    };
    /** Позначки (свої, видимі) на кроці `step` — за часом, а не пошуком елемента: у піаніно кроки — фон. */
    const marksAt = (box: HTMLElement, step: number) => {
      const at = spanOf(box, step, step);
      return latest.current.notes
        .filter((n) => n.line === at.ln && n.lane === at.lane && n.status === "visible" && n.at && !n.foreign && n.at.from < at.to && n.at.to > at.from)
        .map((n) => n.note.id);
    };

    /** Кроків у рядку доріжки рамки `box`. */
    const totalOf = (box: HTMLElement) => {
      const sizes = (box.dataset.sizes ?? "").split(",").map(Number);
      return (sizes.length - 1) * Number(box.dataset.cells) + (sizes[sizes.length - 1] || 0);
    };

    // Жест: натиск на кроці; затримався — виділення з цього кроку, далі протяг його тягне.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: { box: HTMLElement; step: number; x: number; y: number } | null = null;
    let last = -1;
    let active = false;
    /**
     * У правці натиснули на самому виділеному — його переносять: `offset` — від
     * початку виділеного до кроку під пальцем (тіки), `to` — куди ляже зараз.
     */
    let grab: { sel: StepsSel; offset: number; to: StepsSel } | null = null;
    /** Коли жест закінчився: клік, що браузер шле слідом, — уже не тап. */
    let gestured = 0;
    /**
     * Прокрутку на час протягу пальцем заморожуємо самим `overflow`: браузер
     * вирішує «це прокрутка» вже на першому мікрорусі пальця, ще до довгого
     * натиску, і далі `touchmove` не скасовується. Заморожуємо всі прокрутні
     * предки кроків до смуги включно (на ПК — ще й прокрутку рядка вбік).
     */
    let thaw = () => {};
    const freeze = (box: HTMLElement) => {
      const frozen: [HTMLElement, string][] = [];
      for (let n: HTMLElement | null = box; n && n !== el.parentElement; n = n.parentElement) {
        if (!/auto|scroll/.test(getComputedStyle(n).overflowX + getComputedStyle(n).overflowY)) continue;
        frozen.push([n, n.style.overflow]);
        n.style.overflow = "hidden"; // місце прокрутки лишається
      }
      thaw = () => frozen.forEach(([n, was]) => (n.style.overflow = was));
    };
    const begin = (box: HTMLElement, x: number, y: number, touch: boolean) => {
      end();
      start = { box, step: stepOf(box, x), x, y };
      last = start.step;
      const sel = latest.current.steps;
      const at = spanOf(box, start.step, start.step);
      if (latest.current.edit && sel && sel.ln === at.ln && sel.lane === at.lane && at.from >= sel.from && at.to <= sel.to && editable(latest.current.song, sel.lane))
        grab = { sel, offset: at.from - sel.from, to: sel };
      timer = setTimeout(() => activate(touch), LONG_PRESS_MS);
    };
    const activate = (touch: boolean) => {
      if (!start || active) return;
      clearTimeout(timer);
      active = true;
      if (touch) freeze(start.box);
      if (!grab) choose(start.box, start.step, last);
      navigator.vibrate?.(10);
    };
    const drag = (x: number, y: number) => {
      if (!start) return;
      if (grab) return carry(x, y);
      last = stepOf(start.box, x);
      choose(start.box, start.step, last);
    };
    /** Виділене їде за пальцем: та сама доріжка, хоч і в сусідньому рядку пісні; з рядка не вилазить. */
    const carry = (x: number, y: number) => {
      if (!start || !grab) return;
      const under = boxAt(document.elementFromPoint(x, y));
      if (under && under.dataset.lane === grab.sel.lane) start.box = under;
      const box = start.box;
      const length = grab.sel.to - grab.sel.from;
      const end = spanOf(box, totalOf(box) - 1, totalOf(box) - 1).to;
      const from = Math.max(0, Math.min(spanOf(box, stepOf(box, x), stepOf(box, x)).from - grab.offset, end - length));
      grab.to = { ln: Number(box.dataset.ln), lane: grab.sel.lane, from, to: from + length };
      window.getSelection()?.removeAllRanges();
      select(grab.to);
    };
    /** Кінець жесту: затримався на позначеному кроці й не повів — меню його позначок. */
    const end = () => {
      clearTimeout(timer);
      if (active && start && grab) {
        gestured = Date.now();
        const { sel, to } = grab;
        if (to.ln !== sel.ln || to.from !== sel.from) moveSteps(latest.current.song, sel, to.ln, to.from);
      } else if (active && start) {
        gestured = Date.now();
        const ids = last === start.step ? marksAt(start.box, start.step) : [];
        if (ids.length) pick(ids);
      }
      grab = null;
      thaw();
      thaw = () => {};
      start = null;
      active = false;
    };

    /** Система перервала дотик — виділене нікуди не переносимо. */
    const cancel = () => {
      if (grab) select(grab.sel);
      grab = null;
      end();
    };

    const onTouchStart = (e: TouchEvent) => {
      const box = e.touches.length === 1 ? boxAt(e.target) : null;
      if (box) begin(box, e.touches[0].clientX, e.touches[0].clientY, true);
      else end();
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (active) {
        if (e.cancelable) e.preventDefault();
        drag(t.clientX, t.clientY);
      } else if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 8) end(); // це прокрутка
    };

    // Миша: затримав кнопку — те саме, що довгий натиск; повів на інший крок — виділення одразу.
    const onMouseDown = (e: MouseEvent) => {
      const box = e.button === 0 ? boxAt(e.target) : null;
      if (!box) return;
      if (latest.current.pianoEdit && box.dataset.kind === "piano" && !e.ctrlKey && !e.metaKey) return; // це правка нот
      e.preventDefault(); // протяг — не виділення тексту
      begin(box, e.clientX, e.clientY, false);
      const onMove = (m: MouseEvent) => {
        if (active) return drag(m.clientX, m.clientY);
        if (start && stepOf(start.box, m.clientX) !== start.step) {
          activate(false);
          drag(m.clientX, m.clientY);
        }
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        end();
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp, { once: true });
    };

    // Короткий тап у примітках участі не бере: лише ховає палітру чи меню позначки.
    // Клік услід за жестом — не тап: далі не пускаємо (у правці він поставив би комірку для ладу).
    const onClick = (e: MouseEvent) => {
      if (Date.now() - gestured < 800) return void e.stopPropagation();
      select(null);
    };

    // Довгий натиск на кроці — не контекстне меню браузера і не системне виділення тексту (iOS).
    const onContextMenu = (e: Event) => boxAt(e.target) && e.preventDefault();

    // Тап повз смугу знімає виділення; палітра й меню позначки — ні.
    const onDocClick = (e: MouseEvent) => {
      // Шлях, а не `closest`: кнопка палітри, що зникла від свого ж тапу, вже відірвана від сторінки.
      const path = e.composedPath();
      if (path.includes(el) || path.some((n) => n instanceof Element && n.matches(KEEP))) return;
      select(null);
    };

    el.addEventListener("click", onClick, { capture: true });
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", cancel);
    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("selectstart", onContextMenu);
    document.addEventListener("click", onDocClick);
    return () => {
      end();
      el.removeEventListener("click", onClick, { capture: true });
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", cancel);
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("selectstart", onContextMenu);
      document.removeEventListener("click", onDocClick);
    };
  }, [container, on]);

  return { steps, picked, select, pick, drafts, addDraft, dropDraft, clip, copy };
}
