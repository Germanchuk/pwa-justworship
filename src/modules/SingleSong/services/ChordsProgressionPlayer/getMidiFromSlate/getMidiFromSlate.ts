import {Midi} from "@tonejs/midi";
import type {Descendant} from "slate";

import {
  chordLineToProgressionMapWithKeys,
  isPlayableChordLine,
} from "../getMidiFromSections/utils/chordLineToProgressionMapWithKeys";
import {createMidiFromProgression, type ChordEvent} from "../getMidiFromSections/utils/createMidiFromProgression";
import {progressionToTimeline, type ChordTimelineEvent} from "../getMidiFromSections/utils/progressionToTimeline";

export interface SongContentSnapshot {
  nodes: Descendant[];
  bpm: number;
  timeSignature: [number, number];
  transposition: number;
}

export interface PreparedSlateMidiData {
  midi: Midi;
  progression: ChordEvent[];
  timeline: ChordTimelineEvent[];
  bpm: number;
  timeSignature: [number, number];
}

const emptyResult = (bpm: number, ts: [number, number]): PreparedSlateMidiData => ({
  midi: new Midi(),
  progression: [],
  timeline: [],
  bpm,
  timeSignature: ts,
});

const isElement = (n: unknown): n is {type: string; children?: unknown[]} =>
  typeof n === "object" && n != null && typeof (n as {type?: unknown}).type === "string";

const nodeText = (node: unknown): string => {
  if (!isElement(node)) return "";
  const kids = node.children ?? [];
  return kids
    .map((c) => {
      if (c && typeof (c as {text?: unknown}).text === "string") {
        return (c as {text: string}).text;
      }
      return nodeText(c);
    })
    .join("");
};

export function getMidiFromSlate(
  snapshot: SongContentSnapshot | null,
  startTokenKey: string | null,
): PreparedSlateMidiData {
  if (!snapshot || !Array.isArray(snapshot.nodes) || snapshot.nodes.length === 0) {
    return emptyResult(70, [4, 4]);
  }

  const {bpm, timeSignature, transposition} = snapshot;
  const beatsPerBar = timeSignature?.[0] ?? 4;

  // Walk root children, counting only `section` elements (skip song-name / song-meta-row).
  let sectionIndex = -1;
  const progression: ChordEvent[] = [];

  for (const root of snapshot.nodes) {
    if (!isElement(root) || root.type !== "section") continue;
    sectionIndex += 1;

    const sectionEl = root as unknown as {repeat?: number; children?: unknown[]};
    const repeat = Math.max(1, Math.floor(sectionEl.repeat ?? 1) || 1);
    const sectionBase: ChordEvent[] = [];

    let chordLineIndex = -1;
    for (const child of sectionEl.children ?? []) {
      if (!isElement(child)) continue;
      if (child.type !== "chord-line") continue;
      chordLineIndex += 1;

      const text = nodeText(child);
      if (!text.trim()) continue;
      if (!isPlayableChordLine(text)) continue;

      const events = chordLineToProgressionMapWithKeys(
        text,
        sectionIndex,
        chordLineIndex,
        beatsPerBar,
      );
      sectionBase.push(...events);
    }

    for (let pass = 0; pass < repeat; pass++) {
      progression.push(...sectionBase);
    }
  }

  // Assign sequential numeric ids (preserved for legacy listeners that read event.id).
  const indexed = progression.map((event, index) => ({...event, id: index}));

  const startIndex =
    startTokenKey == null
      ? -1
      : indexed.findIndex((event) => event.tokenKey === startTokenKey);
  const slice = startIndex > 0 ? indexed.slice(startIndex) : indexed;

  const midi = createMidiFromProgression(slice, bpm, timeSignature, transposition);
  const timeline = progressionToTimeline(slice, bpm);

  return {midi, progression: slice, timeline, bpm, timeSignature};
}
