import {Midi} from "@tonejs/midi";
import type {Descendant} from "slate";

import {
  chordLineToProgressionMapWithKeys,
  isPlayableChordLine,
} from "../getMidiFromSections/utils/chordLineToProgressionMapWithKeys";
import {createMidiFromProgression, isRest, type ChordEvent} from "../getMidiFromSections/utils/createMidiFromProgression";
import {dynamicsIntensityAt} from "../getMidiFromSections/utils/dynamicsIntensity";
import {progressionToTimeline, type ChordBeatEvent} from "../getMidiFromSections/utils/progressionToTimeline";
import {DEFAULT_BPM, DEFAULT_TIME_SIGNATURE} from "../songDefaults";

export interface SongContentSnapshot {
  nodes: Descendant[];
  bpm: number;
  timeSignature: [number, number];
}

export interface PreparedSlateMidiData {
  midi: Midi;
  progression: ChordEvent[];
  /** Долі, не секунди — у секунди їх переводить плеєр, коли фіксує bpm транспорту. */
  timeline: ChordBeatEvent[];
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
  options: {humanize?: number} = {},
): PreparedSlateMidiData {
  if (!snapshot || !Array.isArray(snapshot.nodes) || snapshot.nodes.length === 0) {
    return emptyResult(DEFAULT_BPM, DEFAULT_TIME_SIGNATURE);
  }

  const {bpm, timeSignature} = snapshot;
  const beatsPerBar = timeSignature?.[0] ?? 4;

  // Walk root children, counting only `section` elements (skip song-name / song-meta-row).
  let sectionIndex = -1;
  const progression: ChordEvent[] = [];

  for (const root of snapshot.nodes) {
    if (!isElement(root) || root.type !== "section") continue;
    sectionIndex += 1;

    const sectionEl = root as unknown as {
      repeat?: number;
      dynamicsSteps?: unknown;
      children?: unknown[];
    };
    const repeat = Math.max(1, Math.floor(sectionEl.repeat ?? 1) || 1);
    const sectionBase: ChordEvent[] = [];

    // Смуга динаміки — це висота секції, тож позицію рядка міряємо серед усіх
    // її рядків; comment-anchor нульової висоти не рахуємо.
    const lines = (sectionEl.children ?? [])
      .filter(isElement)
      .filter((child) => child.type !== "comment-anchor");

    let chordLineIndex = -1;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const child = lines[lineIndex];
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

      // Динаміку читаємо в центрі рядка — так гучність повторює градієнт смуги.
      const intensity = dynamicsIntensityAt(
        sectionEl.dynamicsSteps,
        (lineIndex + 0.5) / lines.length,
      );
      if (intensity != null) {
        for (const event of events) event.intensity = intensity;
      }

      sectionBase.push(...events);
    }

    // Акцент початку секції — на перший звучний акорд (паузи пропускаємо).
    const firstSounding = sectionBase.find((event) => !isRest(event.chord));
    if (firstSounding) firstSounding.sectionStart = true;

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

  // Транспозиція завжди 0: капо — річ відображення, не звуку. Параметр
  // createMidiFromProgression лишається для майбутнього «грати в іншій тональності».
  const midi = createMidiFromProgression(slice, bpm, timeSignature, 0, {
    humanize: options.humanize,
  });
  const timeline = progressionToTimeline(slice);

  return {midi, progression: slice, timeline, bpm, timeSignature};
}
