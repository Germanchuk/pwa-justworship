/**
 * Slate-обізнані хелпери транспозиції акордів (чисті функції, без Slate-стану).
 *
 * Реюзає:
 *   - `chord-transposer` — транспозиція окремого акорд-токена з ключа в ключ;
 *   - `#utils/keyUtils` — `transpose` (тональність вниз на N), `isChord`;
 *   - `tokenizeChordLine` — токенізація chord-line з офсетами (відокремлює
 *     бари `|` та крапки-продовження `.` від акордів — на відміну від легасі
 *     `keyUtils.transposeLine`, який спотикався б на барах).
 */

import * as Transposer from "chord-transposer";

import { isChord, transpose as keyDownBy } from "#utils/keyUtils";
import { tokenizeChordLine } from "../../../services/ChordsProgressionPlayer/getMidiFromSections/utils/chordLineToProgressionMapWithKeys";
import type { SongKeyValue } from "./model";

const SEPARATORS = new Set(["|", "."]);

/**
 * chord-transposer не має деяких "екзотичних" мажорних тональностей у sharp-нотації:
 * зокрема A# major (rank 10) — валідний лише енгармонік Bb. Без цього "A#" хибно
 * резолвиться в C (бо C-шкала містить "A#") → транспозиція не відбувається.
 * (C#, D#, F#, G# у бібліотеці є, тож лишаємо їх як sharp.)
 */
const ENHARMONIC_FOR_TRANSPOSER: Record<string, string> = {
  "A#": "Bb",
};

/** Внутрішнє представлення Strapi-ключа ("Csharp") у нотацію chord-transposer ("C#"). */
const toMusical = (key: string): string => {
  const sharp = key.replace("sharp", "#");
  return ENHARMONIC_FOR_TRANSPOSER[sharp] ?? sharp;
};

/** Назва тональності для показу користувачу — узгоджена зі спелінгом акордів
 *  (напр. "Asharp" → "Bb", бо саме так звучатимуть транспоновані акорди). */
export function keyDisplayName(key: SongKeyValue): string {
  return toMusical(key);
}

/**
 * Транспонує один акорд-токен з тональності `fromKey` у `toKey`.
 * На будь-якій помилці парсингу повертає токен без змін (без винятку).
 */
function transposeToken(
  token: string,
  fromKey: SongKeyValue,
  toKey: SongKeyValue,
): string {
  try {
    return Transposer.transpose(token)
      .fromKey(toMusical(fromKey))
      .toKey(toMusical(toKey))
      .toString();
  } catch {
    return token;
  }
}

/**
 * Транспонує текст ОДНОГО chord-line з `fromKey` у `toKey`, зберігаючи всі
 * пробіли, бари `|` та крапки `.` на своїх місцях. Заміняємо лише реальні
 * акорд-токени, ідучи справа наліво — щоб офсети решти токенів лишались валідні.
 */
export function transposeChordText(
  text: string,
  fromKey: SongKeyValue,
  toKey: SongKeyValue,
): string {
  if (fromKey === toKey) return text;

  const tokens = tokenizeChordLine(text);
  let result = text;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const tk = tokens[i];
    if (SEPARATORS.has(tk.token)) continue;
    if (!isChord(tk.token)) continue;

    const transposed = transposeToken(tk.token, fromKey, toKey);
    if (transposed === tk.token) continue;

    result = result.slice(0, tk.charStart) + transposed + result.slice(tk.charEnd);
  }

  return result;
}

/**
 * Тональність, у якій фактично грає капо-юзер: `songKey` вниз на `capo` півтонів.
 * capo = +3, songKey = C → A. (capo <= 0 → без змін.)
 */
export function keyForCapo(songKey: SongKeyValue, capo: number): SongKeyValue {
  if (!capo) return songKey;
  return keyDownBy(songKey, capo) as SongKeyValue;
}

/**
 * Транспонує текст chord-line ДЛЯ ПОКАЗУ капо-юзеру: зі спільної `songKey`
 * вниз на `capo` півтонів. Зручний шорткат над `transposeChordText`.
 */
export function transposeChordTextForCapo(
  text: string,
  songKey: SongKeyValue,
  capo: number,
): string {
  if (!capo) return text;
  return transposeChordText(text, songKey, keyForCapo(songKey, capo));
}
