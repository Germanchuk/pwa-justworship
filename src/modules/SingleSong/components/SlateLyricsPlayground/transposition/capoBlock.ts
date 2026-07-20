/**
 * Мінімальний сигнал "редагування акорду заблоковано капо".
 * `withCapoGuard` емітить його, коли блокує мутацію chord-line; UI
 * (`CapoBlockedTooltip`) слухає й показує пояснювальний тултіп біля каретки.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function emitCapoBlocked(): void {
  listeners.forEach((l) => l());
}

export function onCapoBlocked(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
