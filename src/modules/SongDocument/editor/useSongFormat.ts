/**
 * Формат пісні за екраном:
 *
 * - `landscape` — телефон лежачи: смуга на весь екран (`landscape/LandscapeSong`).
 *   Низький екран у ландшафті й палець, а не миша: планшет і ноутбук із
 *   низьким вікном сюди не потрапляють.
 * - `desktop` — ПК (миша): та сама смуга, розрізана по рядках пісні
 *   (`strip/DesktopSong`).
 * - `tablet` — решта широких (планшет): редактор Slate з усіма доріжками.
 * - `phone` — вузький екран (телефон стоячи): той самий редактор, але простий —
 *   лише слова й акорди (`SONG-97`). Решту людина бачить, перегорнувши
 *   телефон чи зайшовши з більшого пристрою.
 */
import { useSyncExternalStore } from "react";

export type SongFormat = "landscape" | "desktop" | "tablet" | "phone";

const LANDSCAPE = "(orientation: landscape) and (max-height: 500px) and (pointer: coarse)";
const DESKTOP = "(hover: hover) and (pointer: fine)";
/** Ширина, з якої екран — уже не телефон (iPad mini стоячи — 744). */
const WIDE = "(min-width: 640px)";

const media = (query: string) => (typeof window === "undefined" ? null : window.matchMedia(query));

const formatNow = (): SongFormat =>
  media(LANDSCAPE)?.matches ? "landscape" : media(DESKTOP)?.matches ? "desktop" : media(WIDE)?.matches ? "tablet" : "phone";

export const useSongFormat = () =>
  useSyncExternalStore((fn) => {
    const all = [media(LANDSCAPE), media(DESKTOP), media(WIDE)];
    all.forEach((m) => m?.addEventListener("change", fn));
    return () => all.forEach((m) => m?.removeEventListener("change", fn));
  }, formatNow);
