import type {ChordEvent} from "./createMidiFromProgression";

/**
 * Прогресія в музичному часі — долях. Це те, що взагалі не залежить від темпу,
 * і тому лишається тут.
 */
export interface ChordBeatEvent {
  id: number;
  /**
   * Stable path-derived identifier that maps the event back to a token in the editor:
   * `${sectionIndex}:${chordLineIndexInSection}:${tokenIndexInLine}`.
   * Null for rests / events from sources that don't track positions (legacy).
   */
  tokenKey: string | null;
  chord: string | null;
  startBeats: number;
  durationBeats: number;
}

/**
 * Те саме, але вже прив'язане до годинника: секунди додає `ChordsProgressionPlayer`,
 * коли знає bpm, з яким реально стартує транспорт.
 */
export interface ChordTimelineEvent extends ChordBeatEvent {
  start: number; // seconds from the beginning of the transport
  duration: number; // seconds
}

export function progressionToTimeline(progression: ChordEvent[]): ChordBeatEvent[] {
  let accumulatedBeats = 0;

  return progression
    .map((event, index) => {
      const beats = Math.max(0, event.duration ?? 0);
      const timelineEvent: ChordBeatEvent = {
        id: event.id ?? index,
        tokenKey: event.tokenKey ?? null,
        chord: event.chord,
        startBeats: accumulatedBeats,
        durationBeats: beats,
      };
      accumulatedBeats += beats;
      return timelineEvent;
    })
    .filter((event) => event.durationBeats > 0 || event.chord != null);
}
