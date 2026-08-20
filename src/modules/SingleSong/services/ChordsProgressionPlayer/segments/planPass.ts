/**
 * Розкладка одного проходу сегмента в АБСОЛЮТНИЙ час.
 *
 * Чистий шар: ні Tone, ні транспорту, ні побічних ефектів. Через це рулонний
 * планувальник тестується без звукового контексту — перевіряти, що ноти й
 * підсвітка стають у правильні імпульси, можна звичайним юніт-тестом.
 *
 * Гуманізація лишається тут (а не в шарі Tone), бо вона зсуває ноти в ЧАСІ, і
 * зсув має бути частиною плану, а не сюрпризом на відтворенні. Джерело
 * випадковості — параметр, тож тест лишається детермінованим.
 */

import { createMidiFromProgression } from "../getMidiFromSections/utils/createMidiFromProgression";
import { progressionToTimeline } from "../getMidiFromSections/utils/progressionToTimeline";
import type { PlannedChord, PlannedNote, PlannedPass, PlaybackSegment } from "./model";
import { prefixTokenKey, progressionBeats } from "./model";

export interface PlanPassOptions {
  /** Множник гуманізації (0 — механічно). */
  humanize?: number;
  /** Джерело випадковості — заради детермінованих тестів. */
  random?: () => number;
}

/**
 * @param startBeats абсолютний імпульс, з якого прохід починається.
 */
export function planPass(
  segment: PlaybackSegment,
  startBeats: number,
  options: PlanPassOptions = {},
): PlannedPass {
  const lengthBeats = progressionBeats(segment.progression);

  // Темп потрібен рівно для одного: гуманізація зсуває ноти на МІЛІСЕКУНДИ
  // (людська неточність від темпу не залежить), а зсув треба виразити в
  // імпульсах. Розташування самих акордів від bpm не залежить узагалі.
  const midi = createMidiFromProgression(
    segment.progression,
    segment.bpm,
    segment.timeSignature,
    0,
    { humanize: options.humanize, random: options.random },
  );

  const ppq = midi.header.ppq;
  const notes: PlannedNote[] = midi.tracks.flatMap((track) =>
    track.notes.map((note) => ({
      beats: startBeats + note.ticks / ppq,
      durationBeats: note.durationTicks / ppq,
      midi: note.midi,
      velocity: note.velocity ?? 0.7,
    })),
  );

  const chords: PlannedChord[] = progressionToTimeline(segment.progression).map((event) => ({
    beats: startBeats + event.startBeats,
    durationBeats: event.durationBeats,
    chord: event.chord,
    tokenKey: prefixTokenKey(event.tokenKey, segment.tokenKeyPrefix),
  }));

  return {
    segmentId: segment.id,
    startBeats,
    lengthBeats,
    notes,
    chords,
  };
}
