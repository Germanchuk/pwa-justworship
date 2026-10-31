/**
 * Іконка доріжки за видом — одна на застосунок: вибір доріжок у шапці пісні й
 * поле доріжок горизонтального формату (там таби й кахон підписані назвами
 * ліній, іконка — решті). Поки що з lucide; повний список іконок проєкту —
 * `justworship-meta/.scratch/icons/inventory.md`.
 */
import { ChartNoAxesGantt, Drum, Guitar, Megaphone, MicVocal, Milestone, Music2, Piano, type LucideIcon } from "lucide-react";
import type { LaneKind } from "../model";

export const LANE_ICON: Record<LaneKind, LucideIcon> = {
  words: MicVocal, // слова — те, що співають
  chords: Music2, // акорди (власної іконки акорду в наборі немає)
  text: Megaphone, // вигуки, бек-вокал
  blocks: ChartNoAxesGantt, // прямокутники — смуги на сітці, як діаграма Ганта
  tab: Guitar,
  cajon: Drum,
  piano: Piano, // piano roll
};

/** Ряд структурних приміток у смузі — як доріжка: вказівник, звідки почалась частина пісні. */
export const SECTION_ICON: LucideIcon = Milestone;
