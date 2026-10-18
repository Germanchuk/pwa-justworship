/** Зона динаміки ліворуч від відрізка; у правці — веди по ній пальцем, щоб фарбувати. */
import { getDynamicsStepColor, layout, lineKind, shownDynamics } from "../../model";
import { useEditorCtx } from "../context";

export function DynamicsZone({ ln }: { ln: number }) {
  const ctx = useEditorCtx();
  const at = layout(ctx.song)[ln];
  // Порожній рядок і примітка зони не мають: мазок проходить повз них.
  if (!at || lineKind(at) !== "segment") return null;
  const preview = ctx.stroke?.preview(at.line);
  const key = preview === undefined ? shownDynamics(at, ctx.me) : preview;
  if (!key && !ctx.stroke) return null;
  return (
    <div
      contentEditable={false}
      data-dyn-line={ln}
      {...(ctx.stroke?.zoneProps(ln) ?? {})}
      onMouseDown={(e) => e.preventDefault()}
      className="absolute select-none"
      style={{
        left: 0,
        top: 0,
        bottom: 0,
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
