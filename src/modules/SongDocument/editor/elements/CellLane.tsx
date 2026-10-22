/**
 * Клітинкова доріжка рядка (ADR-0008) — атомний вузол Slate, що виглядає як
 * текст: таби (струни) й кахон (лінія на удар) — лініями кроків, прямокутники
 * — блоками на сітці. У правці: курсор-крок (клік по кроку ставить його).
 *
 * Довжина — рядка, а не доріжки (`lineLength`): усі доріжки рядка мають ті
 * самі такти, останній може бути неповним. Над першою доріжкою рядка з
 * курсором — лінійка (`LineRuler`): тягни ручку чи тапни — шторка з ±.
 *
 * Удари — у масштабі людини (`Scale`): подія в найближчій комірці; точно на
 * долі — звичайна, поруч — блідо-червона, що далі від долі — прозоріша; кілька в
 * одній комірці — буквально одна на одній. Правиться лише точне (`cells.ts`).
 */
import * as Y from "yjs";
import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Node } from "slate";
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
import { DYNAMICS_PANEL_BOTTOM } from "../dynamics/DynamicsPalette";

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

  // Лінійка — над першою клітинковою доріжкою рядка, у правці й лише на рядку з курсором.
  const ruler = ctx.canEdit && ctx.cursorLine === ln && firstCellLane(editor, element);

  return (
    <div {...attributes} data-cell-lane={id} className="pr-2 md:pr-3" style={{ paddingLeft: 16, boxShadow: RULE }}>
      <div contentEditable={false} className="select-none py-0.5" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, lineHeight: 1.35, color: INK[kind] }}>
        <div className="min-w-0 overflow-x-auto">
          {ruler && <LineRuler line={line!} timeSignature={timeSignature} zoom={zoom} />}
          {body}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Чи вузол — перша клітинкова доріжка свого рядка у видимому. */
function firstCellLane(editor: ReturnType<typeof useSlateStatic>, element: RenderRef) {
  try {
    const path = ReactEditor.findPath(editor, element);
    const siblings = Node.parent(editor, path).children;
    return siblings.findIndex((n) => isCellsNode(n)) === path[path.length - 1];
  } catch {
    return false;
  }
}
type RenderRef = RenderElementProps["element"];

/**
 * Лінійка довжини рядка: номери тактів і ручка в кінці з довжиною словами
 * («1 такт + 3/8»). Тягни ручку — довжина міняється по вісімці (прив'язка під пальцем);
 * тапни — шторка знизу з ± вісімка і ± такт. Довжина спільна для всіх доріжок
 * рядка; укоротив — те, що за кінцем, сховане, а не стерте.
 */
function LineRuler({ line, timeSignature, zoom }: { line: Line; timeSignature: string; zoom: number | undefined }) {
  const ctx = useEditorCtx();
  const length = lineLength(line, timeSignature);
  const [drag, setDrag] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const start = useRef<{ x: number; moved: boolean } | null>(null);
  const shown = drag ?? length;
  const scale = scaleOf("tab", timeSignature, zoom); // ширини — за ударами, прямокутники тягнуться під них
  const sizes = barSizes(shown, timeSignature, scale);
  const per = eighthsPerBar(timeSignature);
  const eighthPx = (STEP_PX * scale.cells) / per;
  const set = (eighths: number) => ctx.lanes.change(() => setLineLength(line, eighths));
  const keep = (e: React.MouseEvent) => e.preventDefault(); // курсор лишається в рядку
  const hidden = hiddenPastEnd(line, timeSignature);

  return (
    <div className="flex items-center font-sans text-[10px] text-stone-500" style={{ height: 18 }}>
      <span style={{ flex: "none", width: LABEL_PX }} />
      {sizes.map((size, b) => (
        <span
          key={b}
          className="border-l border-stone-400/60 pl-0.5 truncate"
          style={{ flex: "none", width: BAR_PX + size * STEP_PX, background: b % 2 ? "rgba(120,95,50,0.05)" : undefined }}
        >
          {b + 1}
        </span>
      ))}
      <button
        type="button"
        aria-label={`Довжина рядка: ${lengthLabel(length, timeSignature)}. Тягни, щоб змінити`}
        title="Тягни — довжина по вісімці; тапни — точніше"
        className="ml-0.5 flex h-[18px] items-center gap-1 rounded-full border border-stone-400 bg-white/80 px-1.5 text-stone-600 touch-none"
        onMouseDown={keep}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, moved: false };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 6) s.moved = true;
          if (s.moved) setDrag(Math.max(1, length + Math.round(dx / eighthPx)));
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          if (s?.moved && drag !== null && drag !== length) set(drag);
          if (!s?.moved) setSheet(true);
          setDrag(null);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
      >
        ⟷<span className="whitespace-nowrap">{lengthLabel(shown, timeSignature)}</span>
      </button>
      {hidden && drag === null && <span className="ml-1 whitespace-nowrap text-stone-400">далі сховане</span>}
      {sheet &&
        createPortal(
          <div
            role="dialog"
            aria-label="Довжина рядка"
            className="glass fixed left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100vw-2rem)] rounded-2xl px-3 py-2 font-sans"
            style={{ bottom: DYNAMICS_PANEL_BOTTOM }}
            onMouseDown={keep}
          >
            <div className="mb-1.5 flex items-center gap-2 text-sm">
              <span className="flex-1 text-stone-500">
                Довжина рядка: <b className="text-stone-800">{lengthLabel(length, timeSignature)}</b>
              </span>
              <button type="button" aria-label="Закрити" className="text-stone-500" onClick={() => setSheet(false)}>
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              {[
                ["− такт", -per],
                ["− 1/8", -1],
                ["+ 1/8", 1],
                ["+ такт", per],
              ].map(([label, delta]) => (
                <button
                  key={label}
                  type="button"
                  className="h-10 min-w-14 rounded-xl border border-stone-300 bg-white/80 px-3 text-sm disabled:opacity-40"
                  disabled={length + Number(delta) < 1}
                  onClick={() => set(length + Number(delta))}
                >
                  {label}
                </button>
              ))}
            </div>
            {hidden && <div className="mt-1.5 text-xs text-stone-500">За кінцем рядка є записане — сховане, повернеться, якщо подовжити.</div>}
          </div>,
          document.body,
        )}
    </div>
  );
}
