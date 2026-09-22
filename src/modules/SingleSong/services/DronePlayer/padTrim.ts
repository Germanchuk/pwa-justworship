import {createLiveTrim} from "./liveTrim";

/**
 * Гучність педа — друга жива ручка пульта поруч із метрономом (`liveTrim`).
 * База — 0 дБ, тобто рівно те, як дрон звучить у POC Германа; трим — поверх.
 * Вгору запасу менше, ніж у кліку: пед і так лежить під гуртом, а не пробивається
 * крізь нього.
 */
export const PAD_TRIM_RANGE: [number, number] = [-24, 12];

export const padTrim = createLiveTrim({range: PAD_TRIM_RANGE, baseDb: 0});
