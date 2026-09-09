/**
 * Гучність метронома — ЖИВА ручка пульта, а не налаштування.
 *
 * Свідомо НЕ в `playerSettings`: там налаштування пристрою, які читаються на
 * запуск і зберігаються в localStorage. Клік крутить людина за пультом
 * посеред служіння, чуючи результат одразу, тож тут:
 *   • діє наживо — значення йде прямо в живий синт, не чекаючи перезапуску;
 *   • не зберігається — перезавантаження вкладки повертає дефолт;
 *   • живе на всю вкладку — вийшов зі сторінки хоста, трим лишився.
 *
 * Без імпорту Tone: активний клік приймаємо структурно (`VolumeTarget`), щоб
 * модуль (і тест) не тягнули за собою аудіоконтекст.
 */

/** Зашита гучність кліку — те, з чим метроном звучав завжди. Трим іде поверх. */
export const METRONOME_BASE_DB = 8;

/**
 * Трим у дБ ВІДНОСНО базової гучності. Крайнє ліво = вимкнено.
 *
 * Верх навмисно з великим запасом: пульт стоїть у залі, де клік мусить
 * пробитись крізь гурт, і +6 дБ там бракувало. Пам'ятай, що трим лягає
 * ПОВЕРХ `METRONOME_BASE_DB`, тож «+24» на слайдері — це +32 дБ у синті;
 * верхня третина шкали вже кліпує і потрібна хіба як аварійний запас.
 */
export const METRONOME_TRIM_RANGE: [number, number] = [-24, 24];

interface VolumeTarget {
  volume: {value: number};
}

let trim = 0;
let active: VolumeTarget | null = null;
const listeners = new Set<() => void>();

const clamp = (value: number): number =>
  Math.min(METRONOME_TRIM_RANGE[1], Math.max(METRONOME_TRIM_RANGE[0], value));

/**
 * Позиція слайдера → гучність синта.
 *
 * Крайнє ліво — тиша, а не «-24 дБ»: на такому тримі клік і так уже нечутний,
 * тож ця позиція коштує дешевше як вимикач, ніж як ще одне тихе значення.
 */
export const metronomeTrimToDb = (value: number): number =>
  value <= METRONOME_TRIM_RANGE[0] ? -Infinity : METRONOME_BASE_DB + clamp(value);

export const isMetronomeMuted = (value: number): boolean =>
  value <= METRONOME_TRIM_RANGE[0];

export const getMetronomeTrim = (): number => trim;

/** Гучність, з якою має звучати клік ЗАРАЗ — для щойно створеного метронома. */
export const getMetronomeVolumeDb = (): number => metronomeTrimToDb(trim);

export function setMetronomeTrim(value: number): void {
  trim = clamp(value);
  // Луп кліку навмисно не спиняємо навіть на тиші: він лишається в сітці
  // транспорту, тож повернута гучність одразу потрапляє в долю, без ре-синку.
  if (active) active.volume.value = metronomeTrimToDb(trim);
  listeners.forEach((listener) => listener());
}

/** Плеєр реєструє живий клік, щоб трим діяв наживо. */
export function bindMetronome(target: VolumeTarget): void {
  active = target;
  target.volume.value = metronomeTrimToDb(trim);
}

export function unbindMetronome(target: VolumeTarget): void {
  if (active === target) active = null;
}

export function subscribeMetronomeTrim(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Для тестів. */
export function resetMetronomeTrim(): void {
  trim = 0;
  active = null;
}
