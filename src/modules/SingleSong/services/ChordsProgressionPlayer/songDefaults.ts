/**
 * Дефолти темпу й розміру для однієї пісні.
 *
 * Живуть окремо від плеєра свідомо: їх читає і підготовка даних
 * (`getMidiFromSlate`), і UI-бридж, а тягнути заради двох констант Tone (а з ним
 * і AudioContext) у модулі, які звуку не торкаються, немає за що.
 */
export const DEFAULT_BPM = 70;
export const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];
