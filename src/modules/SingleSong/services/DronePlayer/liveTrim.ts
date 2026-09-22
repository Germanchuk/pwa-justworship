/**
 * ЖИВА ручка пульта — гучність, яку крутять посеред служіння, чуючи залу.
 *
 * Це не налаштування, і тому:
 *   • діє наживо — значення йде прямо в живий звук, не чекаючи перезапуску;
 *   • не зберігається — перезавантаження вкладки повертає дефолт;
 *   • живе на всю вкладку — вийшов зі сторінки хоста, трим лишився.
 *
 * Трим рахується в дБ ВІДНОСНО базової гучності звуку; крайнє ліво — тиша, а
 * не «найтихіше значення»: на такому тримі звук і так уже нечутний, тож ця
 * позиція коштує дешевше як вимикач.
 *
 * Без Tone: живий звук приходить функцією, що приймає дБ, тож модуль (і тест)
 * не тягнуть за собою аудіоконтекст.
 */
export interface LiveTrim {
  range: [number, number];
  toDb(value: number): number;
  isMuted(value: number): boolean;
  get(): number;
  /** Гучність, з якою має звучати щойно створений звук — уже з тримом. */
  getDb(): number;
  set(value: number): void;
  /** Звук реєструється, щоб трим діяв наживо. `owner` — щоб відв'язати саме його. */
  bind(owner: object, apply: (db: number) => void): void;
  unbind(owner: object): void;
  subscribe(listener: () => void): () => void;
  /** Для тестів. */
  reset(): void;
}

export function createLiveTrim({range, baseDb}: {range: [number, number]; baseDb: number}): LiveTrim {
  let trim = 0;
  let active: {owner: object; apply: (db: number) => void} | null = null;
  const listeners = new Set<() => void>();

  const clamp = (value: number) => Math.min(range[1], Math.max(range[0], value));
  const isMuted = (value: number) => value <= range[0];
  const toDb = (value: number) => (isMuted(value) ? -Infinity : baseDb + clamp(value));

  return {
    range,
    toDb,
    isMuted,
    get: () => trim,
    getDb: () => toDb(trim),
    set(value) {
      trim = clamp(value);
      active?.apply(toDb(trim));
      listeners.forEach((listener) => listener());
    },
    bind(owner, apply) {
      active = {owner, apply};
      apply(toDb(trim));
    },
    unbind(owner) {
      if (active?.owner === owner) active = null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset() {
      trim = 0;
      active = null;
    },
  };
}
