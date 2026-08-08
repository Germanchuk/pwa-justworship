/**
 * Мінімальний сигнал "правка заблокована режимом". `withModeGuard` емітить
 * його, коли відсікає мутацію, а `ModeBlockedTooltip` показує пояснення біля
 * каретки — щоб натиснута клавіша не "провалювалась у тишу".
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function emitModeBlocked(): void {
  listeners.forEach((l) => l());
}

export function onModeBlocked(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
