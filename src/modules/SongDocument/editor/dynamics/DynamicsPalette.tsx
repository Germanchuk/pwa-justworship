/** Пензель динаміки: колір або гумка. Чия фарба — задає смужка (ліва — для всіх, права — моя). */
import { DYNAMICS_STEPS, SILENCE } from "../../model";
import { STRIKE_SWATCH_STYLE, StrikeGlyph } from "../StrikeGlyph";
import type { Brush } from "./useStroke";

type Props = {
  brush: Brush;
  setBrush: (b: Brush) => void;
};

export function DynamicsPalette({ brush, setBrush }: Props) {
  const ring = (on: boolean) => (on ? "ring-2 ring-offset-1 ring-stone-700" : "");
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-stone-500">Динаміка:</span>
      {DYNAMICS_STEPS.map((step) => (
        <button
          key={step.key}
          type="button"
          title={step.label}
          aria-label={step.label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setBrush(step.key)}
          className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center ${ring(brush === step.key)}`}
          style={step.key === SILENCE ? STRIKE_SWATCH_STYLE : { background: step.color }}
        >
          {step.key === SILENCE && <StrikeGlyph />}
        </button>
      ))}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setBrush(null)}
        className={`rounded border px-1.5 py-0.5 ${ring(brush === null)}`}
      >
        гумка
      </button>
    </div>
  );
}
