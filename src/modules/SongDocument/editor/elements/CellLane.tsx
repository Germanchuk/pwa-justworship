/**
 * Клітинкова доріжка рядка (ADR-0008) — атомний вузол Slate, що виглядає як
 * текст: таби (струни) й кахон (лінія на удар) — лініями кроків, прямокутники
 * — блоками на сітці. У правці: курсор-крок (клік по кроку ставить його),
 * «+ такт» / «− такт».
 */
import * as Y from "yjs";
import type { ReactNode } from "react";
import { RenderElementProps, ReactEditor, useSlateStatic } from "slate-react";
import { addBar, allLanes, barsOf, layout, cellKey, CellAt, CellKind, readMeta, removeBar, rowsOf, stepsPerBar, stepsPerBeat } from "../../model";
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
const STEP_PX = 10;
const ROW_PX = 17;
const LABEL_PX = 10;
const BAR_PX = 8;
const DASH = "linear-gradient(currentColor, currentColor) center / calc(100% - 2px) 1px no-repeat";
/** Фон кольором — шаром, щоб лягати під риску й під прямокутник. */
const fill = (color: string) => `linear-gradient(${color}, ${color})`;
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
  const steps = stepsPerBar(timeSignature);
  const beat = stepsPerBeat(timeSignature);
  const bars = barsOf(slot);
  const cells = slot.get("cells") as Y.Map<string>;
  const read = (at: CellAt) => cells.get(cellKey(kind, steps, at));
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
    const tinted = Math.floor((at.step % steps) / beat) % 2 === 1;
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
      {Array.from({ length: bars }, (_, b) => [
        <span key={`bar${b}`} className="text-stone-400" style={fixed(BAR_PX)}>
          |
        </span>,
        ...Array.from({ length: steps }, (_, s) => fn(b * steps + s)),
      ]).flat()}
      <span key="end" className="text-stone-400" style={fixed(BAR_PX)}>
        |
      </span>
    </div>
  );
  /** Крок лінії: риска, коли порожньо, інакше — значення по центру. */
  const lineStep = (at: CellAt, v: string | undefined, content: ReactNode = v) =>
    stepSpan(at, content ?? "", {
      ...fixed(STEP_PX),
      display: "flex",
      alignItems: "center",
      justifyContent: "center", // ширший за крок лад виходить на обидва боки порівну
      height: ROW_PX,
      fontSize: 10,
      fontWeight: 600,
      color: v ? INK[kind] : "#a8a29e",
      background: v ? undefined : DASH,
    });

  let body: ReactNode;
  if (kind !== "blocks") {
    // Таби — струна на лінію, кахон — вид удару на лінію.
    body = rowsOf(kind).map((name, string) =>
      row(name, (step) => {
        const v = read({ step, string });
        const digits = v && v.length > 1 ? <span style={{ display: "inline-block", transform: "scaleX(0.7)" }}>{v}</span> : v;
        return lineStep({ step, string }, v, digits);
      }),
    );
  } else {
    // Прямокутники: назва відкриває блок, «-» його тягне; порожній крок — «·».
    body = row("", (step) => {
      const v = read({ step, string: 0 });
      const start = !!v && v !== "-";
      const prevV = step > 0 && step % steps !== 0 ? read({ step: step - 1, string: 0 }) : undefined;
      const inBlock = start || (v === "-" && !!prevV);
      const nextV = (step + 1) % steps !== 0 ? read({ step: step + 1, string: 0 }) : undefined;
      const ends = inBlock && nextV !== "-";
      return stepSpan(
        { step, string: 0 },
        start ? <span className="relative z-[1] font-bold">{v}</span> : inBlock ? " " : "·",
        {
          ...fixed(STEP_PX),
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

  return (
    <div {...attributes} data-cell-lane={id} className="pr-2 md:pr-3" style={{ paddingLeft: 16, boxShadow: RULE }}>
      <div contentEditable={false} className="select-none flex items-start gap-2 py-0.5" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, lineHeight: 1.35, color: INK[kind] }}>
        <div className="min-w-0 overflow-x-auto">{body}</div>
        {ctx.canEdit && (
          <span className="flex gap-1 text-[11px] font-sans text-stone-400 shrink-0">
            <button type="button" title={`${lane.name}: додати такт`} onMouseDown={(e) => e.preventDefault()} onClick={() => ctx.lanes.change(() => addBar(slot))}>
              +такт
            </button>
            {bars > 1 && (
              <button type="button" title="Прибрати останній порожній такт" onMouseDown={(e) => e.preventDefault()} onClick={() => ctx.lanes.change(() => removeBar(slot))}>
                −
              </button>
            )}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
