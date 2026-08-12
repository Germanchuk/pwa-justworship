import {isPadPreset, type PadPreset} from "./createPad/padPresets";

/**
 * Налаштування плеєра — властивість ПРИСТРОЮ, не пісні: у кожного музиканта
 * свій телефон і свій смак фону, тож живуть у localStorage, а не в документі.
 *
 * Модуль свідомо без React: плеєр читає його напряму, а UI підписується через
 * `useSyncExternalStore` (хук лежить поруч із меню).
 */
/** Рівні гуманізації: множник для джитера velocity і часу. */
export const HUMANIZE_LEVELS = [
  {key: "off", label: "Вимкнена", factor: 0},
  {key: "light", label: "Легка", factor: 0.5},
  {key: "natural", label: "Природна", factor: 1},
  {key: "loose", label: "Вільна", factor: 1.75},
] as const;

export type HumanizeLevel = (typeof HUMANIZE_LEVELS)[number]["key"];

const isHumanizeLevel = (value: unknown): value is HumanizeLevel =>
  HUMANIZE_LEVELS.some((level) => level.key === value);

export const getHumanizeFactor = (key: HumanizeLevel): number =>
  HUMANIZE_LEVELS.find((level) => level.key === key)?.factor ?? 1;

export const PIANO_VOLUME_RANGE: [number, number] = [-24, 6]; // дБ

const clampPianoVolume = (value: number): number =>
  Math.min(PIANO_VOLUME_RANGE[1], Math.max(PIANO_VOLUME_RANGE[0], value));

export interface PlayerSettings {
  padPreset: PadPreset;
  /** Піаніно-стаб поверх педа. */
  piano: boolean;
  /** Гучність піаніно, дБ. */
  pianoVolume: number;
  humanize: HumanizeLevel;
}

const STORAGE_KEY = "jw.player-settings";

const DEFAULTS: PlayerSettings = {
  padPreset: "classic",
  piano: true,
  pianoVolume: 0,
  humanize: "natural",
};

let cached: PlayerSettings | null = null;
const listeners = new Set<() => void>();

// try/catch навколо всього: приватний режим Safari, вимкнений storage,
// зіпсований JSON чи старий ключ пресета — усе тихо падає на дефолти.
const load = (): PlayerSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<PlayerSettings>;
    return {
      padPreset: isPadPreset(parsed.padPreset) ? parsed.padPreset : DEFAULTS.padPreset,
      piano: typeof parsed.piano === "boolean" ? parsed.piano : DEFAULTS.piano,
      pianoVolume: Number.isFinite(parsed.pianoVolume)
        ? clampPianoVolume(parsed.pianoVolume as number)
        : DEFAULTS.pianoVolume,
      humanize: isHumanizeLevel(parsed.humanize) ? parsed.humanize : DEFAULTS.humanize,
    };
  } catch {
    return DEFAULTS;
  }
};

export function getPlayerSettings(): PlayerSettings {
  if (!cached) cached = load();
  return cached;
}

export function updatePlayerSettings(patch: Partial<PlayerSettings>): void {
  cached = {...getPlayerSettings(), ...patch};
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // не збереглось — переживемо, налаштування живе до перезавантаження
  }
  listeners.forEach((listener) => listener());
}

export function subscribePlayerSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Для тестів: скинути кеш, щоб наступний get перечитав storage. */
export function resetPlayerSettingsCache(): void {
  cached = null;
}
