import { useCallback, useState, useSyncExternalStore } from "react";

import { APP_VERSION, ChangelogEntry, changesSince } from "#constants/changelog";
import { applyAppUpdate, getNeedRefresh, subscribeToAppUpdate } from "@/lib/appUpdate";

/** Версія, яку користувач уже бачив після оновлення. */
const SEEN_VERSION_KEY = "jw.seen-version";

function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeSeenVersion(version: string) {
  try {
    localStorage.setItem(SEEN_VERSION_KEY, version);
  } catch {
    // Приватний режим Safari забороняє запис — переживемо, просто покажемо
    // «що нового» ще раз наступного разу.
  }
}

/** «Є нова версія» + дія, яка її вмикає. */
export function useAppUpdate() {
  const needRefresh = useSyncExternalStore(subscribeToAppUpdate, getNeedRefresh, () => false);
  return { needRefresh, applyUpdate: applyAppUpdate };
}

/**
 * Зміни, які приїхали з оновленням: усе, що вийшло після версії, яку
 * користувач бачив минулого разу.
 *
 * Перший запуск нічого не показує — новому користувачу історія змін не
 * потрібна, тож просто запам'ятовуємо поточну версію як бачену.
 */
export function useWhatsNew(): { entries: ChangelogEntry[]; dismiss: () => void } {
  const [entries, setEntries] = useState<ChangelogEntry[]>(() => {
    const seen = readSeenVersion();
    if (!seen) {
      writeSeenVersion(APP_VERSION);
      return [];
    }
    return changesSince(seen);
  });

  const dismiss = useCallback(() => {
    writeSeenVersion(APP_VERSION);
    setEntries([]);
  }, []);

  return { entries, dismiss };
}
