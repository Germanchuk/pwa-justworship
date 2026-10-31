/**
 * Клітинкова доріжка рядка (ADR-0008) — атомний вузол Slate, що виглядає як
 * текст: таби (струни) й кахон (лінія на удар) — лініями кроків, прямокутники
 * — блоками на сітці. У правці: курсор-крок (клік по кроку ставить його).
 *
 * Починається з лінії поля, як і решта доріжок (`gutter.ts`). До лінії —
 * назви ліній і кнопка довжини, вони не прокручуються; кроки за лінією
 * прокручуються вбік, і всі клітинкові доріжки рядка — разом (слова й акорди
 * переносяться, а не прокручуються).
 *
 * Псевдо-текст: «символ» — крок (у табах — шість струн кроку разом).
 * Кроки виділяються протягом мишею чи довгим натиском і протягом пальцем
 * (Shift+стрілки — `bridge/cells.ts`); на виділеному ставлять примітку, у
 * правці — стирають. Позначене приміткою підсвічене її кольором.
 *
 * Довжина — рядка, а не доріжки (`lineLength`): усі доріжки рядка мають ті
 * самі такти, останній може бути неповним. Задає її кнопка перед доріжкою
 * прямокутників рядка (`LengthMenu`; немає прямокутників — перед першою
 * клітинковою): меню «− 1/8 / + 1/8».
 *
 * Удари — у масштабі людини (`Scale`): подія в найближчій комірці; точно на
 * долі — звичайна, поруч — блідо-червона, що далі від долі — прозоріша; кілька в
 * одній комірці — буквально одна на одній. Правиться лише точне (`cells.ts`).
 */
import * as Y from "yjs";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Node } from "slate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenderElementProps, ReactEditor, useSlateStatic } from "slate-react";
import {
  allLanes,
  barTicks,
  cellSpan,
  eighthsPerBar,
  hiddenPastEnd,
  layout,
  lengthLabel,
  lineLength,
  CellAt,
  CellKind,
  Line,
  readMeta,
  readZoom,
  isBlackKey,
  PIANO_ROWS,
  rowsOf,
  scaleOf,
  setLineLength,
  TICKS,
} from "../../model";
import { isCellsNode } from "../../bridge/projection";
import { useEditorCtx, useModelLine } from "../context";
import { LaneDynamics } from "../dynamics/DynamicsZone";
import { NoteCard } from "../notes/NoteCard";
import { GUTTER, MARGIN_LINE } from "./gutter";
import { INK, PIANO_ROW_PX, ROW_PX, rowPxOf, STEP_PX, STEPS_FONT_PX, stepAtPoint, stepGeometry, stepsVersion, stepX } from "./stepGeometry";
import { StepRows } from "./StepRows";

const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.18)";
/** Довгий натиск пальцем на крок починає виділення (коротший дотик — прокрутка чи тап). */
const LONG_PRESS_MS = 450;

export function CellLane(props: RenderElementProps) {
  const ctx = useEditorCtx();
  const ln = useModelLine(props.element);
  const id = (props.element as unknown as { lane: string }).lane;
  const kind = allLanes(ctx.song.doc).find((l) => l.id === id)?.kind as CellKind | undefined;
  const line = ln >= 0 ? layout(ctx.song)[ln]?.line : undefined;
  const slot = line?.get(id);
  if (!line || !kind || !(slot instanceof Y.Map)) {
    return (
      <div {...props.attributes} style={{ ...MARGIN_LINE, minHeight: "1.6em", boxShadow: RULE }}>
        {props.children}
      </div>
    );
  }
  return <Steps {...props} ln={ln} id={id} kind={kind} line={line} slot={slot as Y.Map<unknown>} />;
}

type StepsProps = RenderElementProps & { ln: number; id: string; kind: CellKind; line: Line; slot: Y.Map<unknown> };

function Steps({ attributes, children, element, ln, id, kind, line, slot }: StepsProps) {
  const ctx = useEditorCtx();
  const editor = useSlateStatic();
  const scroller = useRef<HTMLDivElement>(null);
  /** Коли палець востаннє відпустив довгий натиск — мишачі події після нього не рахуються. */
  const longPressed = useRef(0);

  const { timeSignature } = readMeta(ctx.song.doc);
  const zoom = ctx.me ? readZoom(ctx.song.doc, ctx.me) : undefined;
  const scale = scaleOf(kind, timeSignature, zoom);
  const steps = scale.cells;
  const cursor = ctx.canEdit ? ctx.lanes.cells.cursor() : null;
  const here = cursor && cursor.line === line && cursor.lane === id ? cursor.at : null;
  const sel = ctx.lanes.cells.selection();
  const selected = sel && sel.line === line && sel.lane === id ? sel : null;
  const selectable = ctx.canEdit || ctx.canAnnotate;
  // Примітки цієї доріжки цього рядка: підсвітка кроків і картки над доріжкою.
  const marks = ctx.notes.filter((n) => n.line === ln && n.lane === id && n.status === "visible" && n.at);
  const cards = marks.filter((n) => !n.foreign && (n.note.body || ctx.drafts.includes(n.note.id)));

  /**
   * Крок під точкою екрана — у цій доріжці; над чи під нею — крок тієї ж
   * колонки. Рахується з геометрії, а не пошуком елемента: у піаніно кроки —
   * фон, а не елементи.
   */
  const stepAt = (x: number, y: number): CellAt | null => {
    const el = scroller.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const { sizes, stepPx } = stepGeometry(kind, line, timeSignature, zoom);
    return stepAtPoint(x - box.left + el.scrollLeft, y - box.top, sizes, steps, stepPx, rowPxOf(kind), rowsOf(kind).length);
  };
  /** Виділити кроки `from…to` (комірки масштабу, у будь-якому порядку). */
  const selectSteps = (from: CellAt, to: number) => {
    // Поза правкою виділений текст пісні знімаємо; у правці виділення Slate — уже курсор-крок у цій доріжці.
    if (!ctx.canEdit) window.getSelection()?.removeAllRanges();
    const [a, b] = [Math.min(from.step, to), Math.max(from.step, to)];
    ctx.lanes.cells.select({ line, lane: id, from: cellSpan(scale, a)[0], to: cellSpan(scale, b)[1] }, { anchor: from.step, focus: to, string: from.string });
  };

  // Палець: довгий натиск — виділення з цього кроку, далі протяг його тягне (і не прокручує).
  const latest = useRef({ stepAt, selectSteps, selectable });
  latest.current = { stepAt, selectSteps, selectable };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: (CellAt & { x: number; y: number }) | null = null;
    let active = false;
    const stop = () => {
      clearTimeout(timer);
      if (active) longPressed.current = Date.now();
      start = null;
      active = false;
    };
    const onStart = (e: TouchEvent) => {
      stop();
      const t = e.touches[0];
      const hit = e.touches.length === 1 && latest.current.selectable ? latest.current.stepAt(t.clientX, t.clientY) : null;
      if (!hit) return;
      start = { ...hit, x: t.clientX, y: t.clientY };
      timer = setTimeout(() => {
        if (!start) return;
        active = true;
        latest.current.selectSteps(start, start.step);
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (active && start) {
        e.preventDefault(); // палець тягне виділення, а не прокручує
        const to = latest.current.stepAt(t.clientX, t.clientY);
        if (to) latest.current.selectSteps(start, to.step);
      } else if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 8) stop(); // це прокрутка
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", stop);
    el.addEventListener("touchcancel", stop);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", stop);
      el.removeEventListener("touchcancel", stop);
    };
  }, []);

  // Курсор пішов за край видимого — прокрутити до нього (піаніно — ще й вікно клавіш).
  const hereKey = here ? `${here.step}/${here.string}` : "";
  useEffect(() => {
    const el = scroller.current;
    if (!el || !here) return;
    const { stepPx } = stepGeometry(kind, line, timeSignature, zoom);
    const left = stepX(here.step, steps, stepPx);
    if (left < el.scrollLeft) el.scrollLeft = left - STEP_PX;
    else if (left + stepPx > el.scrollLeft + el.clientWidth) el.scrollLeft = left + stepPx - el.clientWidth + STEP_PX;
    const win = el.closest<HTMLElement>("[data-piano-scroll]");
    if (!win) return;
    const top = here.string * PIANO_ROW_PX;
    if (top < win.scrollTop) win.scrollTop = top - PIANO_ROW_PX;
    else if (top + PIANO_ROW_PX > win.scrollTop + win.clientHeight) win.scrollTop = top + 2 * PIANO_ROW_PX - win.clientHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hereKey]);

  // Миша: клік ставить курсор (у правці), протяг — виділяє кроки; клік без протягу виділення знімає.
  const onMouseDown = (e: React.MouseEvent) => {
    const hit = e.button === 0 ? stepAt(e.clientX, e.clientY) : null;
    if (!hit) return;
    e.preventDefault();
    if (Date.now() - longPressed.current < 800) return;
    if (ctx.canEdit) {
      // Спершу фокус: інакше він поверне виділення туди, де воно було в DOM до кліку.
      ReactEditor.focus(editor);
      ctx.lanes.cells.place(ReactEditor.findPath(editor, element), hit);
    }
    if (!selectable) return;
    let moved = false;
    const onMove = (m: MouseEvent) => {
      const to = stepAt(m.clientX, m.clientY);
      if (!to || (!moved && to.step === hit.step)) return;
      moved = true;
      selectSteps(hit, to.step);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      if (moved) return;
      ctx.lanes.cells.select(null);
      // Піаніно: тап без протягу ставить ноту чи прибирає її.
      if (kind === "piano" && ctx.canEdit) ctx.lanes.cells.toggle(ReactEditor.findPath(editor, element), hit);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp, { once: true });
  };

  const stepsView = (
    <div
      ref={scroller}
      data-cell-scroll=""
      // Геометрія для голки програвання (`Transport`): комірок у такті, тіків у комірці й у такті.
      data-cells={steps}
      data-cell-ticks={(scale.tick * TICKS) / scale.grid}
      data-bar-ticks={barTicks(timeSignature)}
      data-step-px={stepGeometry(kind, line, timeSignature, zoom).stepPx}
      className={cn("relative min-w-0 overflow-x-auto", kind === "piano" && "flex-1")}
      onMouseDown={onMouseDown}
    >
      <StepRows version={stepsVersion(slot, line, timeSignature)} kind={kind} slot={slot} line={line} timeSignature={timeSignature} zoom={zoom} marks={marks} selected={selected} here={here} clickable={ctx.canEdit} />
      <div data-needle="" className="pointer-events-none absolute top-0 bottom-0 z-[3] w-0.5 -ml-px bg-red-500/80" style={{ display: "none" }} />
    </div>
  );

  // Кнопка довжини рядка — одна на рядок, перед його прямокутниками.
  const lengthHere = ctx.canEdit && lengthAnchor(editor, element, (lane) => allLanes(ctx.song.doc).find((l) => l.id === lane)?.kind);

  return (
    <div {...attributes} data-cell-lane={id} className="relative pr-2 md:pr-3" style={{ ...MARGIN_LINE, paddingLeft: GUTTER, boxShadow: RULE }}>
      <LaneDynamics element={element} lane={id} />
      {cards.map((c) => (
        <NoteCard key={c.note.id} view={c} />
      ))}
      <div
        contentEditable={false}
        data-cell-steps=""
        className="relative select-none py-0.5"
        style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: STEPS_FONT_PX, lineHeight: 1.35, color: INK[kind], WebkitTouchCallout: "none" }}
      >
        {kind === "piano" ? (
          // Піаніно: 88 клавіш — вікном із прокруткою вгору-вниз; назви клавіш їдуть разом із ними.
          <>
            {lengthHere && (
              <div className="absolute z-[2]" style={{ left: -GUTTER, top: 2 }}>
                <LengthMenu line={line} timeSignature={timeSignature} />
              </div>
            )}
            <PianoWindow lane={id}>
              <PianoKeys />
              {stepsView}
            </PianoWindow>
          </>
        ) : (
          <>
            {/* До лінії поля: назви ліній і кнопка довжини — не прокручуються. */}
            {/* Назви ліній — шрифтом, як до збільшення сітки: поле вузьке. */}
            <div className="absolute text-stone-400" style={{ left: -GUTTER, top: 2, width: GUTTER - 4, textAlign: "right", fontSize: 13 }}>
              {lengthHere && <LengthMenu line={line} timeSignature={timeSignature} />}
              {rowsOf(kind).map((name, i) => (
                <div key={i} style={{ height: ROW_PX, lineHeight: `${ROW_PX}px` }}>
                  {name}
                </div>
              ))}
            </div>
            {stepsView}
          </>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Чи вузол — доріжка, перед якою стоїть кнопка довжини рядка: перші
 * прямокутники рядка у видимому, а якщо їх немає — перша клітинкова доріжка.
 */
function lengthAnchor(editor: ReturnType<typeof useSlateStatic>, element: RenderRef, kindOf: (lane: string) => string | undefined) {
  try {
    const path = ReactEditor.findPath(editor, element);
    const cells = Node.parent(editor, path).children.map((n, i) => ({ n, i })).filter(({ n }) => isCellsNode(n));
    const blocks = cells.find(({ n }) => kindOf((n as unknown as { lane: string }).lane) === "blocks");
    return (blocks ?? cells[0])?.i === path[path.length - 1];
  } catch {
    return false;
  }
}
type RenderRef = RenderElementProps["element"];

/**
 * Кнопка довжини рядка — перед рядком прямокутників, до лінії поля; на ній
 * сама довжина коротко («2», «1.3» — такт і 3/8). Тап —
 * меню з довжиною словами і «− 1/8 / + 1/8» (меню не закривається між
 * тапами). Довжина спільна для всіх доріжок рядка; укоротив — записане за
 * кінцем сховане, а не стерте.
 */
function LengthMenu({ line, timeSignature }: { line: Line; timeSignature: string }) {
  const ctx = useEditorCtx();
  const length = lineLength(line, timeSignature);
  const label = lengthLabel(length, timeSignature);
  // На кнопці — коротко: «такти.вісімки» неповного («2.3» — 2 такти й 3/8; «2» — рівно два).
  const per = eighthsPerBar(timeSignature);
  const [full, rest] = [Math.floor(length / per), length % per];
  const short = rest ? `${full}.${rest}` : `${full}`;
  const set = (eighths: number) => ctx.lanes.change(() => setLineLength(line, eighths));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Довжина рядка: ${label}`}
        title={`Довжина рядка: ${label}`}
        style={{ height: ROW_PX }}
        className="absolute left-0 top-0 z-[2] flex min-w-[14px] max-w-[22px] items-center justify-center whitespace-nowrap rounded border border-stone-300 bg-white/90 px-0.5 font-sans text-[9px] font-semibold leading-none tracking-tight text-stone-600 hover:text-stone-900"
      >
        {short}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="min-w-44 font-sans">
        <DropdownMenuLabel>Довжина рядка: {label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Меню лишається відкритим: кілька вісімок — кілька тапів поспіль. */}
        <DropdownMenuItem disabled={length <= 1} onSelect={(e) => (e.preventDefault(), set(length - 1))}>
          − 1/8
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => (e.preventDefault(), set(length + 1))}>+ 1/8</DropdownMenuItem>
        {hiddenPastEnd(line, timeSignature) && (
          <div className="px-2 py-1 text-xs text-muted-foreground">За кінцем є записане — сховане, повернеться, якщо подовжити.</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Скільки клавіш піаніно видно у вікні — півтори октави. */
const PIANO_VISIBLE = 18;
/** Куди востаннє прокрутили вікно піаніно доріжки — з цього місця стають нові рядки. */
const pianoScroll = new Map<string, number>();

/**
 * Вікно клавіш піаніно: прокрутка вгору-вниз, у кожного рядка своя (з
 * 2026-10-31 без синхронізації між рядками). Новий — там, де прокрутили
 * востаннє, спершу — довкола C4.
 */
function PianoWindow({ lane, children }: { lane: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = pianoScroll.get(lane) ?? Math.max(0, (PIANO_ROWS.indexOf("C4") + 1) * PIANO_ROW_PX - el.clientHeight / 2);
  }, [lane]);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => void pianoScroll.set(lane, e.currentTarget.scrollTop);
  return (
    <div
      ref={ref}
      data-piano-scroll={lane}
      onScroll={onScroll}
      className="overflow-y-auto overflow-x-hidden overscroll-contain"
      style={{ height: PIANO_VISIBLE * PIANO_ROW_PX, marginLeft: -GUTTER }}
    >
      <div className="flex">{children}</div>
    </div>
  );
}

/** Клавіші в полі: чорні — темніші, підписані лише C (межі октав). */
function PianoKeys() {
  return (
    <div className="shrink-0 text-right font-sans text-[8px] leading-none text-stone-400" style={{ width: GUTTER - 2 }}>
      {PIANO_ROWS.map((name, row) => (
        <div
          key={name}
          className="flex items-center justify-end pr-0.5"
          style={{ height: PIANO_ROW_PX, background: isBlackKey(row) ? "rgba(60, 50, 40, 0.22)" : undefined }}
        >
          {name.startsWith("C") && !name.startsWith("C#") ? name : ""}
        </div>
      ))}
    </div>
  );
}
