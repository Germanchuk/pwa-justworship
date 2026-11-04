import {useEffect} from "react";

/**
 * Не дає екрану згаснути, поки компонент змонтований (`APP-39`).
 *
 * Best-effort: не всі браузери вміють Wake Lock (iOS Safari — з 16.4, у
 * встановленому на домашній екран PWA — з 18.4), відмова — не привід падати.
 * Браузер сам знімає замок, коли вкладка ховається, тож при поверненні на
 * екран просимо його знову.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== "visible") return;
      if (lock && !lock.released) return;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (cancelled) void acquired.release();
        else lock = acquired;
      } catch {
        // відмовили (енергозбереження, політика) — ну і гаразд
      }
    };

    void request();
    document.addEventListener("visibilitychange", request);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, []);
}
