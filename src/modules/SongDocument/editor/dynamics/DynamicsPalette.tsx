/** Пензель динаміки: колір або гумка, і чия фарба — для всіх чи лише для мене. */
import { DYNAMICS_STEPS } from "../../model";
import type { Brush } from "./useStroke";

type Props = {
  brush: Brush;
  setBrush: (b: Brush) => void;
  personal: boolean;
  setPersonal: (personal: boolean) => void;
};

export function DynamicsPalette({ brush, setBrush, personal, setPersonal }: Props) {
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
          className={`w-5 h-5 rounded-full ${ring(brush === step.key)}`}
          style={{ background: step.color }}
        />
      ))}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setBrush(null)}
        className={`rounded border px-1.5 py-0.5 ${ring(brush === null)}`}
      >
        гумка
      </button>
      <span className="ml-2 inline-flex rounded border overflow-hidden">
        {[false, true].map((mine) => (
          <button
            key={String(mine)}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPersonal(mine)}
            className={`px-1.5 py-0.5 ${personal === mine ? "bg-stone-700 text-white" : "bg-white"}`}
          >
            {mine ? "лише мені" : "для всіх"}
          </button>
        ))}
      </span>
    </div>
  );
}
