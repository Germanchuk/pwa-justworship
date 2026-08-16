/**
 * Оновлення застосунку: реєстрація service worker'а і стан «є нова версія».
 *
 * НАВІЩО ОКРЕМИЙ МОДУЛЬ, а не хук із `virtual:pwa-register/react`: реєстрація
 * має статись рівно один раз на життя вкладки. Хук би перереєстровував SW і
 * вішав нові таймери на кожен монтаж компонента, у якому він викликаний.
 * Тут же все — модульні синглтони, а React підписується через
 * `useSyncExternalStore` (див. `#hooks/useAppUpdate`).
 *
 * Режим `prompt` (`vite.config.ts`): новий SW чекає, поки користувач сам
 * натисне «Оновити». Мовчазний автоперезапуск заборонений свідомо — він міг
 * би зловити музиканта посеред служіння.
 */
import { registerSW } from "virtual:pwa-register";

/**
 * Як часто перепитуємо сервер про нову версію, поки застосунок відкритий.
 * Браузер сам перевіряє тільки при навігації, а встановлена PWA живе
 * тижнями без жодної — без цього таймера оновлення не приїде ніколи.
 */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let needRefresh = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

const updateSW = registerSW({
  onNeedRefresh() {
    needRefresh = true;
    emit();
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) watchForUpdates(registration);
  },
});

/**
 * Перевіряємо наявність нової версії тоді, коли це має сенс: застосунок
 * на екрані і є мережа. Три приводи — повернення до застосунку, поява
 * інтернету і таймер для довгих сесій.
 */
function watchForUpdates(registration: ServiceWorkerRegistration) {
  const check = () => {
    if (document.visibilityState !== "visible") return;
    if (!navigator.onLine) return;
    // Офлайн або мертвий сервер — `update()` реджектиться; це нормальний
    // стан на сцені, мовчки чекаємо наступного приводу.
    registration.update().catch(() => {});
  };

  check();
  setInterval(check, CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
}

export function subscribeToAppUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNeedRefresh(): boolean {
  return needRefresh;
}

/** Віддає керування новому SW і перезавантажує сторінку. */
export function applyAppUpdate(): Promise<void> {
  return updateSW(true);
}
