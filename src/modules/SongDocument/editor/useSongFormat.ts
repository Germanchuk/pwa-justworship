/**
 * Формат пісні за екраном:
 *
 * - `landscape` — телефон лежачи: смуга на весь екран (`landscape/LandscapeSong`).
 *   Низький екран у ландшафті й палець, а не миша: планшет і ноутбук із
 *   низьким вікном сюди не потрапляють.
 * - `desktop` — ПК (миша): та сама смуга, розрізана по рядках пісні
 *   (`strip/DesktopSong`).
 * - `portrait` — решта (телефон стоячи, планшет): редактор Slate.
 */
import { useSyncExternalStore } from "react";

export type SongFormat = "landscape" | "desktop" | "portrait";

const LANDSCAPE = "(orientation: landscape) and (max-height: 500px) and (pointer: coarse)";
const DESKTOP = "(hover: hover) and (pointer: fine)";

const media = (query: string) => (typeof window === "undefined" ? null : window.matchMedia(query));

const formatNow = (): SongFormat => (media(LANDSCAPE)?.matches ? "landscape" : media(DESKTOP)?.matches ? "desktop" : "portrait");

export const useSongFormat = () =>
  useSyncExternalStore((fn) => {
    const all = [media(LANDSCAPE), media(DESKTOP)];
    all.forEach((m) => m?.addEventListener("change", fn));
    return () => all.forEach((m) => m?.removeEventListener("change", fn));
  }, formatNow);
