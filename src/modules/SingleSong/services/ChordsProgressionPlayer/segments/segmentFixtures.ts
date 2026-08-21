/**
 * Сегменти для тестів черги й переходів темпу.
 *
 * Живуть окремим модулем, бо `queue.test.ts` і `tempoTransition.test.ts`
 * будують той самий сегмент з тих самих причин: обидва перевіряють ПОВЕДІНКУ
 * рулону, а не музику, тож прогресія їм потрібна рівно як довжина в імпульсах.
 * Дві копії розійшлись би тихо — і тест, який ловить різницю між 4/4 і 6/8,
 * першим би від цього й постраждав.
 */

import type { ChordEvent } from "../getMidiFromSections/utils/createMidiFromProgression";
import type { PlaybackSegment } from "./model";

/** Прогресія на `count` тактів: один акорд на такт довжиною `beats` імпульсів. */
export const bars = (count: number, beats = 4): ChordEvent[] =>
  Array.from({ length: count }, (_, i) => ({
    chord: "C",
    duration: beats,
    tokenKey: `0:0:${i}`,
  }));

export const makeSegment = (over: Partial<PlaybackSegment> = {}): PlaybackSegment => ({
  id: "s",
  progression: bars(1),
  bpm: 80,
  timeSignature: [4, 4],
  kind: "once",
  ...over,
});
