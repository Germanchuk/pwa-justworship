/**
 * Панель динаміки — плаває над піснею, поки її не закрили хрестиком. Пензель:
 * колір або гумка. Чия фарба — задає смужка (ліва — для всіх, права — моя).
 */
import { XMarkIcon } from "@heroicons/react/24/outline";
import { DYNAMICS_STEPS, SILENCE } from "../../model";
import { STRIKE_SWATCH_STYLE, StrikeGlyph } from "../StrikeGlyph";
import { setDynamicsPanel } from "./panel";
import type { Brush } from "./useStroke";

type Props = {
  brush: Brush;
  setBrush: (b: Brush) => void;
};

/** Над нижнім баром (`BottomBar`: 52px + відступи). */
export const DYNAMICS_PANEL_BOTTOM = "calc(52px + 1.5rem + env(safe-area-inset-bottom))";

export function DynamicsPalette({ brush, setBrush }: Props) {
  const ring = (on: boolean) => (on ? "ring-2 ring-offset-1 ring-stone-700" : "");
  const label = brush ? DYNAMICS_STEPS.find((s) => s.key === brush)?.label : "Гумка";
  return (
    <div
      role="toolbar"
      aria-label="Динаміка"
      className="glass fixed left-1/2 -translate-x-1/2 z-40 w-max max-w-[calc(100vw-2rem)] rounded-2xl px-3 py-2"
      style={{ bottom: DYNAMICS_PANEL_BOTTOM }}
      onMouseDown={(e) => e.preventDefault()} // курсор і виділення в пісні лишаються
    >
      <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
        <span className="flex-1">
          Динаміка · <span className="text-stone-700">{label}</span> — ведіть по смужці біля рядків
        </span>
        <button type="button" aria-label="Закрити динаміку" title="Закрити" className="text-stone-500 hover:text-stone-800" onClick={() => setDynamicsPanel(false)}>
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {DYNAMICS_STEPS.map((step) => (
          <button
            key={step.key}
            type="button"
            title={step.label}
            aria-label={step.label}
            aria-pressed={brush === step.key}
            onClick={() => setBrush(step.key)}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${ring(brush === step.key)}`}
            style={step.key === SILENCE ? STRIKE_SWATCH_STYLE : { background: step.color }}
          >
            {step.key === SILENCE && <StrikeGlyph />}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={brush === null}
          onClick={() => setBrush(null)}
          className={`h-8 rounded-full border border-stone-300 bg-white/70 px-2.5 text-xs ${ring(brush === null)}`}
        >
          гумка
        </button>
      </div>
    </div>
  );
}
