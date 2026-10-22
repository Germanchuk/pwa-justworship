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
import { highlightBg, isStrike, OTHERS_NEUTRAL_COLOR, STRIKE_INK } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import {
  allLanes,
  barSizes,
  cellSpan,
  eighthsPerBar,
  hiddenPastEnd,
  layout,
  lengthLabel,
  lineLength,
  CellAt,
  CellKind,
  Line,
  NoteView,
  placeCells,
  readMeta,
  readZoom,
  rowsOf,
  scaleOf,
  setLineLength,
  stepsPerBeat,
} from "../../model";
import { isCellsNode } from "../../bridge/projection";
import { useEditorCtx, useModelLine } from "../context";
import { LaneDynamics } from "../dynamics/DynamicsZone";
import { NoteCard } from "../notes/NoteCard";
import { GUTTER, MARGIN_LINE } from "./gutter";

const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.18)";
const INK: Record<CellKind, string> = { tab: "#57534e", cajon: "#92400e", blocks: "#1e40af" };
/**
 * Крок на екрані — комірка сталої ширини `STEP_PX`, однакова в усіх видів,
 * для риски, ладу до 24, удару й шматка прямокутника, на будь-якому екрані
 * (не тягнеться й не стискається; не влазить — прокрутка вбік). Риска такту
 * теж сталої ширини, тож такти доріжок стоять одне під одним.
 * Двозначний лад стискається по горизонталі, щоб уміститись у крок. Текстом
 * (буфер) — як `renderCells`.
 */
const STEP_PX = 12;
const ROW_PX = 17;
const BAR_PX = 8;
const DASH = "linear-gradient(currentColor, currentColor) center / calc(100% - 2px) 1px no-repeat";
/** Фон кольором — шаром, щоб лягати під риску й під прямокутник. */
const fill = (color: string) => `linear-gradient(${color}, ${color})`;
/** Подія не на долі своєї комірки (дрібніша за сітку перегляду). */
const OFF_GRID_INK = "#f87171";
/** Кожна друга доля такту трохи темніша — як смуги в FL Studio. */
const BEAT_TINT = "rgba(120, 95, 50, 0.09)";
/** Виділені кроки — як виділений текст. */
const SELECTED = "rgba(59, 130, 246, 0.28)";
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
  // Доля — у кроках запису: смуги лягають за часом, а не за номером комірки.
  const beatTicks = (stepsPerBeat(timeSignature) * scale.grid) / 16;
  // Прямокутники без масштабу: їхня комірка ширша чи вужча, щоб такт був завширшки як у ударів.
  const stepPx = kind === "blocks" ? (STEP_PX * scaleOf("tab", timeSignature, zoom).cells) / steps : STEP_PX;
  const length = lineLength(line, timeSignature);
  const sizes = barSizes(length, timeSignature, scale);
  const placed = placeCells(kind, (slot.get("cells") as Y.Map<string>).entries(), sizes, scale);
  const shown = (at: CellAt) => placed.get(`${at.step}/${at.string}`);
  const read = (at: CellAt) => shown(at)?.value;
  const cursor = ctx.canEdit ? ctx.lanes.cells.cursor() : null;
  const here = cursor && cursor.line === line && cursor.lane === id ? cursor.at : null;
  const sel = ctx.lanes.cells.selection();
  const selected = sel && sel.line === line && sel.lane === id ? sel : null;
  const selectable = ctx.canEdit || ctx.canAnnotate;
  // Примітки цієї доріжки цього рядка: підсвітка кроків і картки над доріжкою.
  const marks = ctx.notes.filter((n) => n.line === ln && n.lane === id && n.status === "visible" && n.at);
  const cards = marks.filter((n) => !n.foreign && (n.note.body || ctx.drafts.includes(n.note.id)));

  /** Крок під точкою екрана — у цій доріжці; над чи під нею — крок тієї ж колонки. */
  const stepAt = (x: number, y: number): CellAt | null => {
    const box = scroller.current?.getBoundingClientRect();
    if (!box) return null;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    const el = document.elementFromPoint(clamp(x, box.left + 1, box.right - 1), clamp(y, box.top + 1, box.bottom - 1));
    const step = el?.closest<HTMLElement>("[data-step]");
    return step && scroller.current!.contains(step) ? { step: Number(step.dataset.step), string: Number(step.dataset.row) } : null;
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

  // Клітинкові доріжки рядка прокручуються разом: нова стає туди ж, де сусідні.
  const siblings = (el: HTMLElement) =>
    Array.from(el.closest(".song-row")?.querySelectorAll<HTMLElement>("[data-cell-scroll]") ?? []).filter((o) => o !== el);
  useLayoutEffect(() => {
    const el = scroller.current;
    const other = el && siblings(el)[0];
    if (el && other) el.scrollLeft = other.scrollLeft;
  }, []);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    siblings(el).forEach((o) => o.scrollLeft !== el.scrollLeft && (o.scrollLeft = el.scrollLeft));
  };
  // Курсор пішов за край видимого — прокрутити до нього.
  const hereKey = here ? `${here.step}/${here.string}` : "";
  useEffect(() => {
    const el = scroller.current;
    const cell = here && el?.querySelector<HTMLElement>(`[data-step="${here.step}"]`);
    if (!el || !cell) return;
    const [box, c] = [el.getBoundingClientRect(), cell.getBoundingClientRect()];
    if (c.left < box.left) el.scrollLeft -= box.left - c.left + STEP_PX;
    else if (c.right > box.right) el.scrollLeft += c.right - box.right + STEP_PX;
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
      if (!moved) ctx.lanes.cells.select(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp, { once: true });
  };

  /** Позначки приміток, що лягають на крок `step` (за часом — і в іншому масштабі). */
  const marksAt = (step: number): NoteView[] => {
    const [a, b] = cellSpan(scale, step);
    return marks.filter((n) => n.at!.from < b && n.at!.to > a);
  };
  const stepSpan = (at: CellAt, content: ReactNode, style: React.CSSProperties = {}) => {
    const tinted = Math.floor(((at.step % steps) * scale.tick) / beatTicks) % 2 === 1;
    const background = [style.background, tinted && fill(BEAT_TINT)].filter(Boolean).join(", ") || undefined;
    const [a, b] = cellSpan(scale, at.step);
    const inSelection = !!selected && selected.from < b && selected.to > a;
    const on = marksAt(at.step);
    const own = on.filter((n) => !n.foreign);
    const colors = own.map((n) => n.note.color);
    // Позначка — шаром під значенням (кілька — шарами), чужа — сірим; закреслення — рисою поверх.
    const fills = [...colors.filter((c) => !isStrike(c)), ...(on.some((n) => n.foreign) ? [OTHERS_NEUTRAL_COLOR] : [])].map((c) => fill(highlightBg(c)));
    const ids = own.map((n) => n.note.id).join(" ") || undefined;
    return (
      <span
        key={`${at.step}/${at.string}`}
        data-step={at.step}
        data-row={at.string}
        data-notes={ids}
        className={ctx.canEdit ? "cursor-pointer" : undefined}
        // Курсор — тінню всередині, а не фоном: фон кроку — риска й смуга долі.
        style={{
          ...style,
          position: "relative",
          background,
          ...(here && here.step === at.step && here.string === at.string ? { boxShadow: "inset 0 0 0 99px rgba(59,130,246,0.3)", outline: "1px solid #3b82f6" } : {}),
        }}
      >
        {(fills.length > 0 || inSelection) && (
          <span
            data-note-fill={ids}
            className="pointer-events-none absolute inset-0"
            style={{ background: [...(inSelection ? [fill(SELECTED)] : []), ...fills].join(", ") }}
          />
        )}
        {content}
        {colors.some(isStrike) && (
          <span className="pointer-events-none absolute inset-x-0 z-[2]" style={{ top: "50%", height: 2, marginTop: -1, background: STRIKE_INK }} />
        )}
      </span>
    );
  };
  const fixed = (width: number): React.CSSProperties => ({ flex: "none", width, textAlign: "center" });
  /** Лінія доріжки: такти з кроками (назва лінії — до лінії поля). */
  const row = (key: string, fn: (step: number) => ReactNode) => (
    <div key={key} className="whitespace-pre flex items-stretch" style={{ lineHeight: `${ROW_PX}px` }}>
      {sizes.flatMap((size, b) => [
        <span key={`bar${b}`} className="text-stone-400" style={fixed(BAR_PX)}>
          |
        </span>,
        ...Array.from({ length: size }, (_, s) => fn(b * steps + s)),
      ])}
      <span key="end" className="text-stone-400" style={fixed(BAR_PX)}>
        |
      </span>
    </div>
  );
  /**
   * Крок лінії: риска, коли порожньо, інакше — значення по центру; не на долі
   * — сіріше й прозоріше, що далі. Кілька подій у комірці (дрібна партія в
   * грубій сітці) — буквально одна на одній: так видно, що їх там кілька.
   */
  const lineStep = (at: CellAt) => {
    const cell = shown(at);
    return stepSpan(
      at,
      cell?.all.map(({ value, off }, i) => (
        <span
          key={i}
          className="absolute inset-0 flex items-center justify-center"
          // Не на своїй долі — блідо-червона; що далі від долі, то трохи прозоріша.
          style={off ? { color: OFF_GRID_INK, opacity: 1 - off * 0.6 } : undefined}
        >
          {/* Двозначний лад стискається, щоб уміститись у крок. */}
          {value.length > 1 ? <span style={{ display: "inline-block", transform: "scaleX(0.7)" }}>{value}</span> : value}
        </span>
      )),
      {
        ...fixed(STEP_PX),
        display: "flex",
        alignItems: "center",
        justifyContent: "center", // ширший за крок лад виходить на обидва боки порівну
        height: ROW_PX,
        fontSize: 10,
        fontWeight: 600,
        color: cell ? INK[kind] : "#a8a29e",
        background: cell ? undefined : DASH,
      },
    );
  };

  let body: ReactNode;
  if (kind !== "blocks") {
    // Таби — струна на лінію, кахон — вид удару на лінію.
    body = rowsOf(kind).map((name, string) => row(name, (step) => lineStep({ step, string })));
  } else {
    // Прямокутники: назва відкриває блок, «-» його тягне; порожній крок — «·».
    body = row("blocks", (step) => {
      const v = read({ step, string: 0 });
      const start = !!v && v !== "-";
      const prevV = step > 0 && step % steps !== 0 ? read({ step: step - 1, string: 0 }) : undefined;
      const inBlock = start || (v === "-" && !!prevV);
      const lastInBar = (step % steps) + 1 >= sizes[Math.floor(step / steps)];
      const nextV = !lastInBar ? read({ step: step + 1, string: 0 }) : undefined;
      const ends = inBlock && nextV !== "-";
      return stepSpan(
        { step, string: 0 },
        start ? <span className="relative z-[1] font-bold">{v}</span> : inBlock ? " " : "·",
        {
          ...fixed(stepPx),
          display: "inline-block",
          textAlign: "left",
          color: inBlock ? INK.blocks : "#a8a29e",
          background: inBlock ? fill("rgba(59,130,246,0.12)") : undefined,
          borderTop: inBlock ? "1px solid rgba(30,64,175,0.4)" : undefined,
          borderBottom: inBlock ? "1px solid rgba(30,64,175,0.4)" : undefined,
          borderLeft: start ? "1px solid rgba(30,64,175,0.6)" : undefined,
          borderRight: ends ? "1px solid rgba(30,64,175,0.6)" : undefined,
          borderRadius: start && ends ? 3 : start ? "3px 0 0 3px" : ends ? "0 3px 3px 0" : undefined,
          overflow: "visible",
        },
      );
    });
  }

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
        style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, lineHeight: 1.35, color: INK[kind], WebkitTouchCallout: "none" }}
      >
        {/* До лінії поля: назви ліній і кнопка довжини — не прокручуються. */}
        <div className="absolute text-stone-400" style={{ left: -GUTTER, top: 2, width: GUTTER - 4, textAlign: "right" }}>
          {lengthHere && <LengthMenu line={line} timeSignature={timeSignature} />}
          {rowsOf(kind).map((name, i) => (
            <div key={i} style={{ height: ROW_PX, lineHeight: `${ROW_PX}px` }}>
              {name}
            </div>
          ))}
        </div>
        <div ref={scroller} data-cell-scroll="" className="min-w-0 overflow-x-auto" onScroll={onScroll} onMouseDown={onMouseDown}>
          {body}
        </div>
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
        className="absolute left-0 top-0 z-[2] flex h-[17px] min-w-[14px] max-w-[22px] items-center justify-center whitespace-nowrap rounded border border-stone-300 bg-white/90 px-0.5 font-sans text-[9px] font-semibold leading-none tracking-tight text-stone-600 hover:text-stone-900"
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
