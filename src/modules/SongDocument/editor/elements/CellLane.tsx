/**
 * Клітинкова доріжка рядка (ADR-0008) — атомний вузол Slate, що виглядає як
 * текст: таби й кахон — моноширинним текстом, прямокутники — блоками на сітці.
 * У правці: курсор-крок (клік по кроку ставить його), «+ такт» / «− такт».
 */
import * as Y from "yjs";
import type { ReactNode } from "react";
import { RenderElementProps, ReactEditor, useSlateStatic } from "slate-react";
import { addBar, allLanes, barsOf, layout, cellKey, CellAt, CellKind, readMeta, removeBar, stepsPerBar, TAB_STRINGS } from "../../model";
import { useEditorCtx, useModelLine } from "../context";

const RULE = "inset 0 -1px 0 0 rgba(120, 95, 50, 0.18)";
const INK: Record<CellKind, string> = { tab: "#57534e", cajon: "#92400e", blocks: "#1e40af" };
/**
 * Крок табів на екрані — комірка сталої ширини `TAB_STEP_PX`, однакова для
 * риски й ладу до 24 і на будь-якому екрані (не тягнеться й не стискається;
 * не влазить — прокрутка вбік). Двозначний лад стискається по горизонталі,
 * щоб уміститись у крок. Текстом (буфер) — як `renderCells`.
 */
const TAB_STEP_PX = 10;
const TAB_ROW_PX = 17;
const DASH = "linear-gradient(currentColor, currentColor) center / calc(100% - 2px) 1px no-repeat";

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

  const steps = stepsPerBar(readMeta(ctx.song.doc).timeSignature);
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
  const stepSpan = (at: CellAt, content: ReactNode, style: React.CSSProperties = {}) => (
    <span
      key={`${at.step}/${at.string}`}
      onMouseDown={place(at)}
      className={ctx.canEdit ? "cursor-pointer" : undefined}
            // Курсор — тінню всередині, а не фоном: фон кроку табів — його риска.
      style={{ ...style, ...(here && here.step === at.step && here.string === at.string ? { boxShadow: "inset 0 0 0 99px rgba(59,130,246,0.3)", outline: "1px solid #3b82f6" } : {}) }}
    >
      {content}
    </span>
  );
  const allSteps = (fn: (step: number) => ReactNode): ReactNode[] => [
    ...Array.from({ length: bars }, (_, b) => [
      <span key={`bar${b}`} className="text-stone-400">|</span>,
      ...Array.from({ length: steps }, (_, s) => fn(b * steps + s)),
    ]).flat(),
    <span key="end" className="text-stone-400">|</span>,
  ];

  let body: ReactNode;
  if (kind === "tab") {
    body = TAB_STRINGS.map((name, string) => (
      <div key={name} className="whitespace-pre flex items-center" style={{ lineHeight: `${TAB_ROW_PX}px` }}>
        <span className="text-stone-400">{name}</span>
        {allSteps((step) => {
          const v = read({ step, string });
          const digits = v && v.length > 1 ? <span style={{ display: "inline-block", transform: "scaleX(0.7)" }}>{v}</span> : v;
          return stepSpan({ step, string }, digits ?? "", {
            display: "flex",
            alignItems: "center",
            justifyContent: "center", // ширший за крок лад виходить на обидва боки порівну
            flex: "none",
            width: TAB_STEP_PX,
            height: TAB_ROW_PX,
            fontSize: 10,
            fontWeight: 600,
            color: v ? INK.tab : "#a8a29e",
            background: v ? undefined : DASH,
          });
        })}
      </div>
    ));
  } else if (kind === "cajon") {
    body = <div className="whitespace-pre">{allSteps((step) => stepSpan({ step, string: 0 }, read({ step, string: 0 }) ?? "-"))}</div>;
  } else {
    // Прямокутники: назва відкриває блок, «-» його тягне; порожній крок — «·».
    body = (
      <div className="whitespace-pre flex items-stretch">
        {allSteps((step) => {
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
              display: "inline-block",
              minWidth: "1ch",
              textAlign: "left",
              color: inBlock ? INK.blocks : "#a8a29e",
              background: inBlock ? "rgba(59,130,246,0.12)" : undefined,
              borderTop: inBlock ? "1px solid rgba(30,64,175,0.4)" : undefined,
              borderBottom: inBlock ? "1px solid rgba(30,64,175,0.4)" : undefined,
              borderLeft: start ? "1px solid rgba(30,64,175,0.6)" : undefined,
              borderRight: ends ? "1px solid rgba(30,64,175,0.6)" : undefined,
              borderRadius: start && ends ? 3 : start ? "3px 0 0 3px" : ends ? "0 3px 3px 0" : undefined,
              overflow: "visible",
            },
          );
        })}
      </div>
    );
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
