import {useSyncExternalStore} from "react";

/**
 * Чи відкрите меню пісні. Кнопка меню живе в нижньому барі, а саме меню —
 * угорі над піснею (`APP-27`), і бар стоїть вище роутів: спільного предка з
 * піснею, крім кореня, вони не мають. Тож стан — у маленькому сховищі на рівні
 * модуля, яке обидва читають.
 *
 * Відкрите чи закрите — налаштування пристрою (`APP-29`): переживає
 * перезавантаження, за замовчуванням закрите.
 */
const STORAGE_KEY = "songMenuOpen";

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

let open = read();
const listeners = new Set<() => void>();

function toggle() {
  open = !open;
  try {
    localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    // приватний режим / заборонене сховище — стан просто не переживе сесію
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSongMenuOpen(): [boolean, () => void] {
  return [useSyncExternalStore(subscribe, () => open), toggle];
}
