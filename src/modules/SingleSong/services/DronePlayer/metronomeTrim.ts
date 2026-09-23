import {createLiveTrim} from "./liveTrim";

/**
 * Гучність метронома — жива ручка пульта (`liveTrim`), а не налаштування.
 * Луп кліку навмисно не спиняється навіть на тиші: він лишається в сітці
 * транспорту, тож повернута гучність одразу потрапляє в долю, без ре-синку.
 */

/**
 * Зашита гучність кліку: на тримі 0 пік ≈ 0.9, тобто сигнал на пульт іде
 * повний, але чистий. Заміряно офлайн-рендером 2026-09-23. Трим іде поверх.
 */
export const METRONOME_BASE_DB = 4;

/**
 * Верх навмисно з великим запасом: пульт стоїть у залі, де клік мусить
 * пробитись крізь гурт, і +6 дБ там бракувало. Пам'ятай, що трим лягає
 * ПОВЕРХ `METRONOME_BASE_DB`, а база вже біля 0 дБFS: усе вище ~+1 кліпує.
 * Для короткого шумового кліку це чути як жорсткіший удар, а не спотворену
 * ноту, тож верх лишається аварійним запасом; чесний запас — фейдер пульта.
 */
export const METRONOME_TRIM_RANGE: [number, number] = [-24, 24];

const trim = createLiveTrim({range: METRONOME_TRIM_RANGE, baseDb: METRONOME_BASE_DB});

interface VolumeTarget {
  volume: {value: number};
}

export const metronomeTrimToDb = trim.toDb;
export const isMetronomeMuted = trim.isMuted;
export const getMetronomeTrim = trim.get;
export const getMetronomeVolumeDb = trim.getDb;
export const setMetronomeTrim = trim.set;
export const subscribeMetronomeTrim = trim.subscribe;
export const resetMetronomeTrim = trim.reset;

export const bindMetronome = (target: VolumeTarget) =>
  trim.bind(target, (db) => {
    target.volume.value = db;
  });

export const unbindMetronome = (target: VolumeTarget) => trim.unbind(target);
