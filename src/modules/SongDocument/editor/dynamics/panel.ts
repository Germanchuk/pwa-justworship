/**
 * Чи відкрита панель динаміки. Відкривається з «⋯» меню пісні, закривається
 * своїм хрестиком; поки відкрита — смужки фарбуються в будь-якому режимі.
 * Меню й редактор — різні гілки дерева, тож стан — у маленькому сховищі модуля
 * (як `useSongMenuOpen`). Не пам'ятається: нова пісня — панель закрита.
 */
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

export function setDynamicsPanel(next: boolean) {
  if (next === open) return;
  open = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const useDynamicsPanel = () => useSyncExternalStore(subscribe, () => open);
