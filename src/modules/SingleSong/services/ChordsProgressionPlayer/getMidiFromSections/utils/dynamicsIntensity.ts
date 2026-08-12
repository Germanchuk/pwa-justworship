import {
  DYNAMICS_STEPS,
  isDynamicsStepKey,
} from "../../../../components/SlateLyricsPlayground/constants/dynamicsSteps";

/** Крок динаміки → 0..1 з рівним кроком: calm → 0, climax → 1. */
const stepIntensity = (key: unknown): number | null => {
  const index = DYNAMICS_STEPS.findIndex((step) => step.key === key);
  return index >= 0 ? index / (DYNAMICS_STEPS.length - 1) : null;
};

/**
 * Інтенсивність динаміки секції в точці `position` (0..1 — відносна висота
 * рядка в секції). Кроки розтягнуті по висоті так само, як стопи градієнта
 * кольорової смуги: перший на 0%, останній на 100%, між ними лінійна
 * інтерполяція. Тобто гучність, яку чуєш, повторює смугу, яку бачиш.
 *
 * `undefined` — коли кроків немає (грати нейтрально, як раніше).
 */
export function dynamicsIntensityAt(steps: unknown, position: number): number | undefined {
  if (!Array.isArray(steps)) return undefined;
  const values = steps
    .filter(isDynamicsStepKey)
    .map(stepIntensity)
    .filter((v): v is number => v != null);

  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];

  const p = Math.min(1, Math.max(0, position));
  const x = p * (values.length - 1);
  const i = Math.min(Math.floor(x), values.length - 2);
  const t = x - i;
  return values[i] * (1 - t) + values[i + 1] * t;
}
