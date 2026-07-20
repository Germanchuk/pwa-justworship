export type DynamicsStepKey =
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

export const DYNAMICS_STEPS: readonly DynamicsStep[] = [
  { key: "calm", label: "Спокійний", color: "#22c55e" },
  { key: "light-development", label: "Легкий розвиток", color: "#84cc16" },
  { key: "development", label: "Розвиток", color: "#eab308" },
  { key: "active", label: "Активний", color: "#f59e0b" },
  { key: "energetic", label: "Енергійний", color: "#f97316" },
  { key: "loud", label: "Гучний", color: "#ef4444" },
  { key: "climax", label: "Кульмінація", color: "#b91c1c" },
];

export const DYNAMICS_STEPS_MAX = 10;

const STEP_BY_KEY: Record<DynamicsStepKey, DynamicsStep> = DYNAMICS_STEPS.reduce(
  (acc, step) => {
    acc[step.key] = step;
    return acc;
  },
  {} as Record<DynamicsStepKey, DynamicsStep>,
);

export const isDynamicsStepKey = (value: unknown): value is DynamicsStepKey =>
  typeof value === "string" && value in STEP_BY_KEY;

export const getDynamicsStep = (key: DynamicsStepKey): DynamicsStep =>
  STEP_BY_KEY[key];

export const getDynamicsStepColor = (key: DynamicsStepKey): string =>
  STEP_BY_KEY[key].color;

export const getDynamicsStepLabel = (key: DynamicsStepKey): string =>
  STEP_BY_KEY[key].label;

export const buildDynamicsGradient = (
  steps: readonly DynamicsStepKey[] | undefined,
): string | undefined => {
  if (!steps || steps.length === 0) return undefined;
  const colors = steps
    .filter(isDynamicsStepKey)
    .map((key) => STEP_BY_KEY[key].color);
  if (colors.length === 0) return undefined;
  if (colors.length === 1) return colors[0];
  const stops = colors.map((color, index) => {
    const pct = Math.round((index / (colors.length - 1)) * 1000) / 10;
    return `${color} ${pct}%`;
  });
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
};
