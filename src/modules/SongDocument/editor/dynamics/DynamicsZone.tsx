/**
 * Смужки динаміки відрізка: ліворуч — спільна, праворуч — моя особиста. На
 * телефоні притиснуті до краю екрана (виходять на поле `Container`, `p-2`),
 * на широкому — до краю колонки. У правці — веди по смужці пальцем, щоб фарбувати.
 */
import { DynamicsLayer, DynamicsStepKey, getDynamicsStepColor, layout, lineKind, shownDynamics, SILENCE } from "../../model";
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

const EMPTY = "rgba(120, 95, 50, 0.07)";

/** Тиша — закреслена лінія: тонка вертикаль, яку перетинають косі риски. Плитка 8×16, повторюється вниз. */
const silenceTile = (ink: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='16'><g stroke='${ink}'><line x1='4' y1='0' x2='4' y2='16' stroke-width='2'/><line x1='0' y1='11' x2='8' y2='5' stroke-width='1.5'/></g></svg>`,
  )}") center top / 8px 16px repeat-y`;

const stripBackground = (key: DynamicsStepKey | null) => {
  if (!key) return EMPTY;
  return key === SILENCE ? silenceTile(getDynamicsStepColor(key)) : getDynamicsStepColor(key);
};

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
        // Тиші треба ширше: інакше косих рисок не видно.
        width: ctx.stroke ? 10 : key === SILENCE ? 8 : 4,
        zIndex: 1,
        background: stripBackground(key),
        opacity: preview === undefined ? 1 : 0.75,
        touchAction: ctx.stroke ? "none" : undefined,
        cursor: ctx.stroke ? "crosshair" : undefined,
      }}
    />
  );
}
