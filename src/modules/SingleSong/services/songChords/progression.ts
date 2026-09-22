import type {Descendant} from "slate";

import {SILENCE_MARK} from "#utils/chordSyntax";
import {
  chordLineToProgressionMapWithKeys,
  isPlayableChordLine,
} from "./chordLineToProgressionMapWithKeys";

/** Акорд у такті: що написано і скільки імпульсів займає (модель часу — `songDefaults`). */
export interface ChordEvent {
  /** `секція:рядок:токен`; у тиші — `null`. */
  tokenKey?: string | null;
  /** `null`, `""` або `_` — тиша. */
  chord: string | null;
  duration: number;
}

export function isRest(chord: string | null | undefined): boolean {
  if (chord == null) return true;
  const s = chord.trim();
  // Тиша має рівно одне написання — `_` (див. `chordSyntax`). Порожній рядок
  // сюди теж потрапляє: так лексер позначає долі, що лишились без акорду.
  return s === "" || s === SILENCE_MARK;
}

const isElement = (n: unknown): n is {type: string; children?: unknown[]} =>
  typeof n === "object" && n != null && typeof (n as {type?: unknown}).type === "string";

const nodeText = (node: unknown): string => {
  if (!isElement(node)) return "";
  return (node.children ?? [])
    .map((c) =>
      c && typeof (c as {text?: unknown}).text === "string" ? (c as {text: string}).text : nodeText(c),
    )
    .join("");
};

/**
 * Акорди пісні в порядку запису: лише рядки, закриті тактовими рисками, кожна
 * секція один раз.
 *
 * Звуку з цього більше не будується (ADR-0003) — прогресію читає програш у
 * зібранні, щоб знати, з якого акорда виходить попередня пісня і в який входить
 * наступна.
 */
export function songProgression(nodes: Descendant[], beatsPerBar: number): ChordEvent[] {
  const progression: ChordEvent[] = [];
  let sectionIndex = -1;

  for (const root of nodes) {
    if (!isElement(root) || root.type !== "section") continue;
    sectionIndex += 1;

    let chordLineIndex = -1;
    for (const child of root.children ?? []) {
      if (!isElement(child) || child.type !== "chord-line") continue;
      chordLineIndex += 1;

      const text = nodeText(child);
      if (!isPlayableChordLine(text)) continue;
      progression.push(
        ...chordLineToProgressionMapWithKeys(text, sectionIndex, chordLineIndex, beatsPerBar),
      );
    }
  }

  return progression;
}
