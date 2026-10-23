/**
 * Звідки грати в читанні (ADR-0009): тап по полю перед рядком ставить позначку.
 * Без позначки — рядок у центрі екрана. Позначка живе, поки відкрита пісня.
 */
import { useSyncExternalStore } from "react";

let mark: number | null = null;
const listeners = new Set<() => void>();

export const getPlayMark = () => mark;

export function setPlayMark(line: number | null) {
  mark = line;
  listeners.forEach((fn) => fn());
}

export const onPlayMark = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export const usePlayMark = () => useSyncExternalStore(onPlayMark, getPlayMark);
