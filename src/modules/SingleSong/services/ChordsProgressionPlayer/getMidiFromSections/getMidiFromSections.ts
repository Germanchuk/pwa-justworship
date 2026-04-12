import {Midi} from "@tonejs/midi";
import store from "#/store";
import {sectionsToLinesStream} from "../../../utils/sectionsToLinesStream";
import {isChordsLine} from "#utils/keyUtils";
import {chordLineToProgressionMap} from "./utils/chordLineToProgressionMap";
import {createMidiFromProgression, type ChordEvent} from "./utils/createMidiFromProgression";
import {progressionToTimeline, type ChordTimelineEvent} from "./utils/progressionToTimeline";

export interface PreparedMidiData {
  midi: Midi;
  progression: ChordEvent[];
  timeline: ChordTimelineEvent[];
  bpm: number;
  timeSignature: [number, number];
}

export const getMidiFromSections = (startChordId?: number | null): PreparedMidiData => {
  const sections = store.getState()?.song?.song?.sections;
  const bpm = store.getState()?.song?.song?.bpm ?? 70;
  const timeSignatureStr = store.getState()?.song?.song?.timeSignature ?? "4/4";
  const [num, den] = timeSignatureStr.split("/").map((v) => parseInt(v, 10));
  const timeSignature: [number, number] = [
    Number.isFinite(num) && num > 0 ? num : 4,
    Number.isFinite(den) && den > 0 ? den : 4,
  ];

  const progression = sectionsToLinesStream(sections)
    .filter((line) => (isChordsLine(line)))
    .flatMap((line) => chordLineToProgressionMap(line))
    .map((event, index) => ({
      ...(event as ChordEvent),
      id: index,
    })) as ChordEvent[];

  const startIndex = startChordId == null ? 0 : progression.findIndex((event) => event.id === startChordId);
  const progressionSlice = startIndex > 0 ? progression.slice(startIndex) : progression;

  const midi = createMidiFromProgression(progressionSlice, bpm, timeSignature);
  const timeline = progressionToTimeline(progressionSlice, bpm);

  return { midi, progression: progressionSlice, timeline, bpm, timeSignature };
};
