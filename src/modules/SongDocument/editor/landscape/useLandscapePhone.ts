/**
 * Телефон лежачи — горизонтальний формат пісні (`landscape/LandscapeSong`).
 * Низький екран у ландшафті й палець, а не миша: планшет і ноутбук із
 * низьким вікном лишаються у звичайному вигляді.
 */
import { useSyncExternalStore } from "react";

const QUERY = "(orientation: landscape) and (max-height: 500px) and (pointer: coarse)";

const media = () => (typeof window === "undefined" ? null : window.matchMedia(QUERY));

export const useLandscapePhone = () =>
  useSyncExternalStore(
    (fn) => {
      const m = media();
      m?.addEventListener("change", fn);
      return () => m?.removeEventListener("change", fn);
    },
    () => media()?.matches ?? false,
  );
