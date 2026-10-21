/**
 * Пісня, відкрита в редакторі, — для частин сторінки поза ним (меню пісні:
 * числа біля імен у виборі «чиїми очима»). Сховище модуля, як `useSongMenuOpen`.
 */
import { useSyncExternalStore } from "react";
import type { Song } from "../model";

let active: Song | null = null;
const listeners = new Set<() => void>();

export function setActiveSong(song: Song | null) {
  active = song;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const useActiveSong = () => useSyncExternalStore(subscribe, () => active);
