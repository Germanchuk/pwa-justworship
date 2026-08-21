/**
 * Протокол band-кімнати (`band:<bandId>` в collab-сервісі). Все їздить
 * awareness-ом — ефемерно свідомо: після reload немає реплею старих команд,
 * повторити = ще раз натиснути.
 */

import { pointPrefix } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";

/**
 * `continue` — це «продовжити» служіння (`LIST-41`), а не «зняти паузу»
 * (`resume`). Різниця не косметична: `resume` пускає транспорт далі там, де
 * його спинили руками, а `continue` СУНЕ ЧЕРГУ — знімає зупинку на примітці
 * або виводить із лупа програша. Тому дія окрема, а не перевикористана.
 */
export type PlaybackAction = "play" | "pause" | "resume" | "continue" | "stop";

/**
 * ЩО грати — і звідки. Union, а не поля «іноді заповнені»: пісня й зібрання —
 * два різні випадки, і жоден бік не має вгадувати, який із них перед ним
 * (`PLAY-38`).
 *
 * Протокол ОДИН на обидва: та сама кімната, той самий хост, те саме «останній
 * перемагає». Двох немає навмисно — хост, звук і транспорт одні, тож пісня й
 * зібрання не можуть звучати одночасно (`PLAY-40`).
 */
export type PlaybackTarget =
  | {
      kind: "song";
      songId: string | number;
      /** Обраний акорд старту: `секція:рядок:токен` у межах пісні. */
      startTokenKey: string | null;
    }
  | {
      kind: "gathering";
      listId: string | number;
      /**
       * Звідки грати. Служіння звучить від цього місця **й до кінця**
       * (`LIST-43`), тож координата тут одна — точка входу, не відрізок.
       *
       * Адреса буває грубою і точною: `p0`, `p1`… — з початку пункту (та сама
       * ознака пункту, що їде попереду ключів токенів, `PLAY-39`);
       * `p2:0:1:3` — з конкретного акорда в ньому, тобто цілий ключ токена,
       * як він і їде по мережі. Друга — уточнення першої, а не інший вид
       * адреси: пункт у ній той самий перший (`pointOfKey`). Тому поле одне —
       * необов'язкове «іноді ще й акорд» роздвоїло б протокол на рівному
       * місці.
       */
      from: string;
    };

/** Перший пункт служіння. Формат ознаки — один на застосунок (`pointPrefix`). */
export const FIRST_POINT = pointPrefix(0);

/** Пісня зі своєї сторінки. Без акорда — з початку. */
export const songTarget = (
  songId: string | number,
  startTokenKey: string | null = null,
): PlaybackTarget => ({ kind: "song", songId, startTokenKey });

/** Служіння цілком. Без адреси — з першого пункту. */
export const gatheringTarget = (
  listId: string | number,
  from = FIRST_POINT,
): PlaybackTarget => ({ kind: "gathering", listId, from });

/** Команда контролера хосту. */
export interface PlaybackCommand {
  /** Зростає в межах peer-а; хост виконує лише свіжіші за вже бачені. */
  nonce: number;
  action: PlaybackAction;
  /**
   * Обов'язковий для play; для pause/resume/stop — просто контекст (звук на
   * хості один, і зупиняється саме він).
   */
  target: PlaybackTarget;
  issuedBy: string | null;
  issuedAt: number;
}

export type AudioHostPlaybackState = "idle" | "loading" | "playing" | "paused";

/** Статус, який хост публікує в кімнату. Жива правда про «звук гурту». */
export interface AudioHostStatus {
  userId: number | null;
  username: string | null;
  /** Звук розблоковано дотиком (Tone.start) — хост готовий грати. */
  armed: boolean;
  state: AudioHostPlaybackState;
  /** Що саме зараз на хості — та сама пара, що й у команді. */
  playing: PlaybackTarget | null;
  /** Людська назва того, що грає: назва пісні або дата служіння. */
  playingName: string | null;
  /**
   * Поточний акорд — для підсвітки в усього гурту. У зібранні приходить з
   * ознакою пункту попереду (`PLAY-39`): без неї той самий акорд спалахнув би
   * одразу в кількох піснях служіння.
   */
  currentTokenKey: string | null;
  /**
   * Пункт, на якому служіння чекає «продовжити» (`LIST-41`), — на примітці або
   * в лупі програша; `null` — не чекає. Одне значення на два очікування: тому,
   * хто дивиться на кнопку, вони однакові.
   *
   * Не прапорець, бо натиск їде назад цим самим пунктом: двоє з гурту тиснуть
   * одночасно, і без адреси другий натиск проковтнув би наступну зупинку.
   *
   * Необов'язкове: хост старішої версії цього поля не шле, і для екрана це
   * означає просто «не чекає».
   */
  awaitingAt?: string | null;
  /** Хто видав останню виконану команду. */
  controlledBy: string | null;
  updatedAt: number;
}
