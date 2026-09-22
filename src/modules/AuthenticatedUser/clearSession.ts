import { clearUser } from "./userSlice";

/**
 * Стирає все, що лишилося від попередньої сесії в цьому браузері.
 *
 * НАВІЩО: після зміни пароля чи юзернейма в адмінці користувач не міг
 * увійти в тому ж браузері, хоча в іншому входив. Тому перед кожною
 * спробою входу прибираємо:
 *   1. токен у `localStorage`;
 *   2. користувача в Redux (`setUser` зливає поля, а не заміняє їх);
 *   3. `api-cache` service worker'а: він тримає відповіді старої сесії.
 *
 * Precache SW не чіпаємо: там бандл, а не сесія.
 */
export async function clearSession(dispatch: (action: unknown) => void): Promise<void> {
  localStorage.removeItem("authToken");
  dispatch(clearUser());

  if ("caches" in window) {
    try {
      await caches.delete("api-cache");
    } catch {
      // CacheStorage недоступний (приватний режим тощо) — вхід від цього не залежить
    }
  }
}
