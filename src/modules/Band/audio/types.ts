/**
 * Протокол band-кімнати (`band:<bandId>` в collab-сервісі). Все їздить
 * awareness-ом — ефемерно свідомо: після reload немає реплею старих команд,
 * повторити = ще раз натиснути.
 */

import { pointPrefix } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";

export type PlaybackAction = "play" | "pause" | "resume" | "stop";

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
       * Пункт, з якого грати: `p0`, `p1`… — та сама ознака пункту, що їде
       * попереду ключів токенів (`PLAY-39`). Служіння грає звідси **й до
       * кінця** (`LIST-43`), тож інших координат старту тут не буває.
       */
      fromPoint: string;
    };

/** Перший пункт служіння. Формат ознаки — один на застосунок (`pointPrefix`). */
export const FIRST_POINT = pointPrefix(0);

/** Пісня зі своєї сторінки. Без акорда — з початку. */
export const songTarget = (
  songId: string | number,
  startTokenKey: string | null = null,
): PlaybackTarget => ({ kind: "song", songId, startTokenKey });

/** Служіння цілком. Без пункту — з першого. */
export const gatheringTarget = (
  listId: string | number,
  fromPoint = FIRST_POINT,
): PlaybackTarget => ({ kind: "gathering", listId, fromPoint });

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
  /** Хто видав останню виконану команду. */
  controlledBy: string | null;
  updatedAt: number;
}
