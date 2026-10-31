/**
 * Формат пісні за екраном (`SONG-97`), у такому порядку:
 *
 * - `landscape` — телефон лежачи: смуга на весь екран (`landscape/LandscapeSong`).
 *   Низький екран у ландшафті й палець, а не миша: планшет і ноутбук із
 *   низьким вікном сюди не потрапляють.
 * - `phone` — **вузьке вертикальне вікно** (як телефон стоячи), хоч би який
 *   пристрій: редактор Slate, але простий — лише слова й акорди. Вузьке —
 *   це вузьке, і на ПК теж. Решту людина бачить, перегорнувши телефон чи
 *   розширивши вікно.
 * - `desktop` — ПК (миша): та сама смуга, що лежачи, розрізана по рядках пісні
 *   (`strip/DesktopSong`).
 * - `tablet` — решта (планшет): редактор Slate з усіма доріжками.
 */
import { useSyncExternalStore } from "react";

export type SongFormat = "landscape" | "desktop" | "tablet" | "phone";

const LANDSCAPE = "(orientation: landscape) and (max-height: 500px) and (pointer: coarse)";
/** Як телефон стоячи: вужче за 640 px (iPad mini стоячи — 744) і вище, ніж ширше. */
const NARROW = "(max-width: 639px) and (orientation: portrait)";
const DESKTOP = "(hover: hover) and (pointer: fine)";

const media = (query: string) => (typeof window === "undefined" ? null : window.matchMedia(query));

const formatNow = (): SongFormat =>
  media(LANDSCAPE)?.matches ? "landscape" : media(NARROW)?.matches ? "phone" : media(DESKTOP)?.matches ? "desktop" : "tablet";

export const useSongFormat = () =>
  useSyncExternalStore((fn) => {
    const all = [media(LANDSCAPE), media(NARROW), media(DESKTOP)];
    all.forEach((m) => m?.addEventListener("change", fn));
    return () => all.forEach((m) => m?.removeEventListener("change", fn));
  }, formatNow);
