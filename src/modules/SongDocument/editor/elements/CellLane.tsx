/**
 * Клітинкова доріжка рядка (ADR-0008) — атомний вузол Slate, що виглядає як
 * текст: таби (струни) й кахон (лінія на удар) — лініями кроків, прямокутники
 * — блоками на сітці. У правці: курсор-крок (клік по кроку ставить його).
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
import type { ReactNode } from "react";
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
  barSizes,
  eighthsPerBar,
  hiddenPastEnd,
  layout,
  lengthLabel,
  lineLength,
  CellAt,
  CellKind,
  Line,
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

const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.18)";
const INK: Record<CellKind, string> = { tab: "#57534e", cajon: "#92400e", blocks: "#1e40af" };
/**
 * Крок на екрані — комірка сталої ширини `STEP_PX`, однакова в усіх видів,
 * для риски, ладу до 24, удару й шматка прямокутника, на будь-якому екрані
 * (не тягнеться й не стискається; не влазить — прокрутка вбік). Назва лінії й
 * риска такту теж сталої ширини, тож такти доріжок стоять одне під одним.
 * Двозначний лад стискається по горизонталі, щоб уміститись у крок. Текстом
 * (буфер) — як `renderCells`.
 */
const STEP_PX = 12;
const ROW_PX = 17;
const LABEL_PX = 10;
const BAR_PX = 8;
const DASH = "linear-gradient(currentColor, currentColor) center / calc(100% - 2px) 1px no-repeat";
/** Фон кольором — шаром, щоб лягати під риску й під прямокутник. */
const fill = (color: string) => `linear-gradient(${color}, ${color})`;
/** Подія не на долі своєї комірки (дрібніша за сітку перегляду). */
const OFF_GRID_INK = "#f87171";
/** Кожна друга доля такту трохи темніша — як смуги в FL Studio. */
const BEAT_TINT = "rgba(120, 95, 50, 0.09)";

export function CellLane({ attributes, children, element }: RenderElementProps) {
  const ctx = useEditorCtx();
  const editor = useSlateStatic();
  const ln = useModelLine(element);
  const id = (element as unknown as { lane: string }).lane;
  const lane = allLanes(ctx.song.doc).find((l) => l.id === id);
  const line = ln >= 0 ? layout(ctx.song)[ln]?.line : undefined;
  const slot = line?.get(id) as Y.Map<unknown> | undefined;
  const kind = lane?.kind as CellKind | undefined;
  if (!slot || !kind || !lane) {
    return (
      <div {...attributes} style={{ minHeight: "1.6em", boxShadow: RULE }}>
        {children}
      </div>
    );
  }

  const { timeSignature } = readMeta(ctx.song.doc);
  const zoom = ctx.me ? readZoom(ctx.song.doc, ctx.me) : undefined;
  const scale = scaleOf(kind, timeSignature, zoom);
  const steps = scale.cells;
  // Доля — у кроках запису: смуги лягають за часом, а не за номером комірки.
  const beatTicks = (stepsPerBeat(timeSignature) * scale.grid) / 16;
  // Прямокутники без масштабу: їхня комірка ширша чи вужча, щоб такт був завширшки як у ударів.
  const stepPx = kind === "blocks" ? (STEP_PX * scaleOf("tab", timeSignature, zoom).cells) / steps : STEP_PX;
  const length = lineLength(line!, timeSignature);
  const sizes = barSizes(length, timeSignature, scale);
  const placed = placeCells(kind, (slot.get("cells") as Y.Map<string>).entries(), sizes, scale);
  const shown = (at: CellAt) => placed.get(`${at.step}/${at.string}`);
  const read = (at: CellAt) => shown(at)?.value;
  const cursor = ctx.canEdit ? ctx.lanes.cells.cursor() : null;
  const here = cursor && cursor.line === line && cursor.lane === id ? cursor.at : null;
  const place = (at: CellAt) => (e: React.MouseEvent) => {
    if (!ctx.canEdit) return;
    e.preventDefault();
    // Спершу фокус: інакше він поверне виділення туди, де воно було в DOM до кліку.
    ReactEditor.focus(editor);
    ctx.lanes.cells.place(ReactEditor.findPath(editor, element), at);
  };
  const stepSpan = (at: CellAt, content: ReactNode, style: React.CSSProperties = {}) => {
    const tinted = Math.floor(((at.step % steps) * scale.tick) / beatTicks) % 2 === 1;
    const background = [style.background, tinted && fill(BEAT_TINT)].filter(Boolean).join(", ") || undefined;
    return (
      <span
        key={`${at.step}/${at.string}`}
        onMouseDown={place(at)}
        className={ctx.canEdit ? "cursor-pointer" : undefined}
        // Курсор — тінню всередині, а не фоном: фон кроку — риска й смуга долі.
        style={{ ...style, background, ...(here && here.step === at.step && here.string === at.string ? { boxShadow: "inset 0 0 0 99px rgba(59,130,246,0.3)", outline: "1px solid #3b82f6" } : {}) }}
      >
        {content}
      </span>
    );
  };
  const fixed = (width: number): React.CSSProperties => ({ flex: "none", width, textAlign: "center" });
  /** Лінія доріжки: назва, такти з кроками. */
  const row = (name: string, fn: (step: number) => ReactNode) => (
    <div key={name || "row"} className="whitespace-pre flex items-stretch" style={{ lineHeight: `${ROW_PX}px` }}>
      <span className="text-stone-400" style={{ ...fixed(LABEL_PX), textAlign: "left" }}>
        {name}
      </span>
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
        position: "relative",
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
    body = rowsOf(kind).map((name, string) =>
      row(name, (step) => {
        return lineStep({ step, string });
      }),
    );
  } else {
    // Прямокутники: назва відкриває блок, «-» його тягне; порожній крок — «·».
    body = row("", (step) => {
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
    <div {...attributes} data-cell-lane={id} className="relative pr-2 md:pr-3" style={{ paddingLeft: 16, boxShadow: RULE }}>
      <div contentEditable={false} className="select-none py-0.5" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, lineHeight: 1.35, color: INK[kind] }}>
        {lengthHere && <LengthMenu line={line!} timeSignature={timeSignature} />}
        <div className="min-w-0 overflow-x-auto">{body}</div>
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
 * Кнопка довжини рядка — перед рядком прямокутників, у полі ліворуч; на ній
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
        className="absolute left-0 top-0.5 z-[2] flex h-[17px] min-w-[18px] max-w-[26px] items-center justify-center whitespace-nowrap rounded border border-stone-300 bg-white/90 px-0.5 font-sans text-[9px] font-semibold leading-none tracking-tight text-stone-600 hover:text-stone-900"
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
