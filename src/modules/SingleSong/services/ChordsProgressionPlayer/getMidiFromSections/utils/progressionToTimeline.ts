import type {ChordEvent} from "./createMidiFromProgression";

export interface ChordTimelineEvent {
  id: number;
  chord: string | null;
  start: number; // seconds from the beginning of the transport
  duration: number; // seconds
  startBeats: number;
  durationBeats: number;
}

function sanitizeBpm(bpm?: number): number {
  if (!bpm || Number.isNaN(bpm) || bpm <= 0) {
    return 70;
  }
  return bpm;
}

export function progressionToTimeline(
  progression: ChordEvent[],
  bpm?: number
): ChordTimelineEvent[] {
  const safeBpm = sanitizeBpm(bpm);
  const beatDuration = 60 / safeBpm;
  let accumulatedBeats = 0;

  return progression
    .map((event, index) => {
      const beats = Math.max(0, event.duration ?? 0);
      const timelineEvent: ChordTimelineEvent = {
        id: event.id ?? index,
        chord: event.chord,
        start: accumulatedBeats * beatDuration,
        duration: beats * beatDuration,
        startBeats: accumulatedBeats,
        durationBeats: beats,
      };
      accumulatedBeats += beats;
      return timelineEvent;
    })
    .filter((event) => event.durationBeats > 0 || event.chord != null);
}
