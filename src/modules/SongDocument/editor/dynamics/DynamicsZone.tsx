/**
 * Смужки динаміки відрізка: ліворуч — спільна, праворуч — моя особиста. На
 * телефоні притиснуті до краю екрана (виходять на поле `Container`, `p-2`),
 * на широкому — до краю колонки. У правці — веди по смужці пальцем, щоб фарбувати.
 */
import { DynamicsLayer, getDynamicsStepColor, layout, lineKind, shownDynamics } from "../../model";
import { useEditorCtx } from "../context";

export function DynamicsZone({ ln }: { ln: number }) {
  const ctx = useEditorCtx();
  const at = layout(ctx.song)[ln];
  // Порожній рядок і примітка смужок не мають: мазок проходить повз них.
  if (!at || lineKind(at) !== "segment") return null;
  return (
    <>
      <Strip ln={ln} layer={null} />
      {ctx.me && <Strip ln={ln} layer={ctx.me} />}
    </>
  );
}

function Strip({ ln, layer }: { ln: number; layer: DynamicsLayer }) {
  const ctx = useEditorCtx();
  const at = layout(ctx.song)[ln];
  const preview = ctx.stroke?.preview(at.line, layer);
  const key = preview === undefined ? shownDynamics(at, layer) : preview;
  if (!key && !ctx.stroke) return null;
  const side = layer === null ? "left" : "right";
  return (
    <div
      contentEditable={false}
      data-dyn-line={ln}
      data-dyn-side={side}
      {...(ctx.stroke?.zoneProps(ln, layer) ?? {})}
      onMouseDown={(e) => e.preventDefault()}
      className={`absolute select-none top-0 bottom-0 ${side === "left" ? "-left-2 md:left-0" : "-right-2 md:right-0"}`}
      style={{
        width: ctx.stroke ? 10 : 4,
        zIndex: 1,
        background: key ? getDynamicsStepColor(key) : "rgba(120, 95, 50, 0.07)",
        opacity: preview === undefined ? 1 : 0.75,
        touchAction: ctx.stroke ? "none" : undefined,
        cursor: ctx.stroke ? "crosshair" : undefined,
      }}
    />
  );
}
