/**
 * Кроки динаміки — від тиші до кульмінації. Ключ лежить у маркері рядка,
 * колір — лише показ. `silence` кольору не має: його смужка — закреслена
 * лінія (див. `DynamicsZone`).
 */
export type DynamicsStepKey =
  | "silence"
  | "calm"
  | "light-development"
  | "development"
  | "active"
  | "energetic"
  | "loud"
  | "climax";

export interface DynamicsStep {
  key: DynamicsStepKey;
  label: string;
  color: string;
}

export const SILENCE: DynamicsStepKey = "silence";

export const DYNAMICS_STEPS: readonly DynamicsStep[] = [
  { key: "silence", label: "Тиша", color: "#374151" }, // чорнило закреслення приміток (`STRIKE_INK`)
  { key: "calm", label: "Спокійний", color: "#86efac" },
  { key: "light-development", label: "Легкий розвиток", color: "#bef264" },
  { key: "development", label: "Розвиток", color: "#fde047" },
  { key: "active", label: "Активний", color: "#fcc970" },
  { key: "energetic", label: "Енергійний", color: "#fdab74" },
  { key: "loud", label: "Гучний", color: "#fca5a5" },
  { key: "climax", label: "Кульмінація", color: "#f87171" },
];

const STEP_BY_KEY = Object.fromEntries(DYNAMICS_STEPS.map((step) => [step.key, step])) as Record<DynamicsStepKey, DynamicsStep>;

export const isDynamicsStepKey = (value: unknown): value is DynamicsStepKey =>
  typeof value === "string" && value in STEP_BY_KEY;

export const getDynamicsStepColor = (key: DynamicsStepKey): string => STEP_BY_KEY[key].color;
