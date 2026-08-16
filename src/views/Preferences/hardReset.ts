/**
 * "Hard reset" застосунку.
 *
 * НАВІЩО: service worker precache-ить бандл, тож після деплою браузер
 * деякий час віддає стару версію. Звичайний reload цього не лікує —
 * відповідь усе одно приходить із SW-кешу.
 *
 * Штатний шлях оновлення — банер «Є нова версія» (`src/lib/appUpdate.ts`).
 * Ця кнопка лишається аварійною: коли SW зламався і банер не приходить.
 *
 * Тому знімаємо саме те, що тримає стару версію:
 *   1. знімаємо реєстрацію всіх service worker'ів;
 *   2. видаляємо всі CacheStorage-кеші (precache + `api-cache`).
 *
 * `localStorage` НЕ чіпаємо — там сесія, вихід із акаунта тут не потрібен.
 */
export async function hardResetApp(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  // Кеш-бастер у query: iOS Safari інколи віддає закешований документ навіть
  // після зняття SW, а нова адреса гарантовано йде в мережу.
  const url = new URL(window.location.href);
  url.searchParams.set("_r", Date.now().toString(36));
  window.location.replace(url.toString());
}
