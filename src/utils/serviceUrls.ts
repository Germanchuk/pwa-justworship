/**
 * Звідки фронтенд бере адреси бекенду й collab-сервера.
 *
 * Прод і препрод беруть їх з env — там адреси справжні й статичні.
 *
 * Локально env навмисно порожня, і адреса виводиться з того, ЗВІДКИ відкрито
 * сторінку: `location.hostname`. Vite слухає 0.0.0.0, тож з ноута заходиш на
 * `localhost:5173` і йдеш на `localhost:1337`, а з телефона в тій самій
 * Wi-Fi — на `192.168.x.x:5173` і, тим самим правилом, на `192.168.x.x:1337`.
 * Обидва випадки працюють без жодного IP у конфізі, і зміна мережі більше
 * нічого не ламає: IP підставляє браузер, а не файл.
 */

// Мають збігатися з портами, які піднімає local/run.sh.
const DEV_API_PORT = 1337;
const DEV_COLLAB_PORT = 1338;

// Порожній рядок у .env.local — це «не задано», а не адреса. `??` такого не
// ловить, тому перевіряємо явно.
const configured = (value: string | undefined) =>
  value && value.trim() ? value.trim() : undefined;

const derive = (port: number, scheme: "http" | "ws") => {
  const secure = window.location.protocol === "https:";
  const proto = scheme === "ws" ? (secure ? "wss" : "ws") : secure ? "https" : "http";
  return `${proto}://${window.location.hostname}:${port}`;
};

// Поза браузером `window` немає: цей модуль тягнеться в юніт-тести транзитивно
// (через `fetch-api`), а вони крутяться в node-середовищі. Виведення адреси там
// не потрібне й не має падати на імпорті.
const canDerive = typeof window !== "undefined";

// Виводимо адресу лише в dev. У зібраному бандлі порожня env — це помилка
// збірки, і тихо підставити сюди домен фронтенду означало б сховати її.
const resolve = (value: string | undefined, port: number, scheme: "http" | "ws") =>
  configured(value) ??
  (import.meta.env.DEV && canDerive ? derive(port, scheme) : (value as string));

export const API_URL = resolve(import.meta.env.VITE_API_URL, DEV_API_PORT, "http");

export const COLLAB_URL = resolve(
  import.meta.env.VITE_COLLAB_URL,
  DEV_COLLAB_PORT,
  "ws"
);
