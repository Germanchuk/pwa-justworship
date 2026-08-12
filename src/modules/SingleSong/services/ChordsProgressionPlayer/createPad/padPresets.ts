import type * as Tone from "tone";
import {createPad} from "./createPad";
import {createWorshipPad} from "./createWorshipPad";
import {createWarmPad} from "./createWarmPad";
import {createShimmerPad} from "./createShimmerPad";
import {createDeepPad} from "./createDeepPad";

/**
 * Будь-що з Tone-івським інтерфейсом тригера нот. Дозволяє змішувати
 * семплерні та синтові педи, не протягуючи конкретні типи крізь плеєр.
 */
export type PadVoice = {
  triggerAttackRelease(
    notes: string | string[],
    duration: string | number,
    time?: number,
    velocity?: number,
  ): unknown;
  volume: Tone.Param<"decibels"> | {value: number};
  dispose(): unknown;
};

export interface PadPresetDef {
  key: string;
  /** Назва в меню плеєра. */
  label: string;
  /** Короткий опис звучання — теж для меню. */
  description: string;
  create: () => PadVoice;
}

/**
 * Єдине джерело правди про пресети фонів: і меню плеєра, і сам плеєр читають
 * звідси. Новий пресет = нова фабрика + один запис тут.
 */
export const PAD_PRESETS = [
  {
    key: "classic",
    label: "Класика",
    description: "Тепла семпл-підкладка (lotus pond).",
    create: createPad,
  },
  {
    key: "worship",
    label: "Аналог",
    description: "Щільні детюнені пилки: хорус і довгий реверб.",
    create: createWorshipPad,
  },
  {
    key: "shimmer",
    label: "Сяйво",
    description: "Октавний шар «розквітає» зверху у великому ревербі.",
    create: createShimmerPad,
  },
  {
    key: "deep",
    label: "Глибина",
    description: "Темний фон із суб-октавою — тримає низ, звільняє середину.",
    create: createDeepPad,
  },
  {
    key: "warm",
    label: "Оксамит",
    description: "М'який синусовий пед без блиску — не заважає вокалу.",
    create: createWarmPad,
  },
] as const satisfies readonly PadPresetDef[];

export type PadPreset = (typeof PAD_PRESETS)[number]["key"];

export const isPadPreset = (value: unknown): value is PadPreset =>
  PAD_PRESETS.some((preset) => preset.key === value);

/** Невідомий ключ (старий localStorage тощо) падає на перший пресет. */
export const getPadPresetDef = (key: string): PadPresetDef =>
  PAD_PRESETS.find((preset) => preset.key === key) ?? PAD_PRESETS[0];
