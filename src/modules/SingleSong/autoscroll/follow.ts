/**
 * Слідування (`SCROLL-19`…`SCROLL-24`): чи прикріплений мій екран до
 * позиції автоскролу. Стан пристрою на одній відкритій пісні — у спільний
 * запис не йде, кожен слідує або ні сам.
 *
 * Ініціатор у цьому автоматі не бере участі: поки він у читанні, позицію
 * веде він сам, а його скрол рухає гурт (`followView`).
 */

import { isInitiator, type AutoscrollRun } from "./run";

export type FollowState = {
  /**
   * Цей екран бачить автоскрол, що йде на пісні. Не те саме, що «запис є»:
   * так відрізняємо старт (запис зʼявився) від оновлення запису.
   */
  running: boolean;
  following: boolean;
};

export const NOT_FOLLOWING: FollowState = { running: false, following: false };

export type FollowEvent =
  /**
   * Запис автоскролу пісні — зʼявився, змінився чи зник. `openedAt` — коли я
   * відкрив пісню (той самий годинник, що й `startedAt`, з точністю до
   * розбіжності годинників пристроїв). `reading` — чи я зараз у режимі
   * читання: запис може приїхати й тоді, коли я вже в іншому.
   */
  | { type: "run"; run: AutoscrollRun | null; openedAt: number; reading: boolean }
  /** Ручний скрол — дотик, колесо, клавіші, смуга прокрутки (`SCROLL-22`). */
  | { type: "gesture" }
  /** Вийшов із режиму читання (`SCROLL-22`). */
  | { type: "leave-read" }
  /** Кнопка повернення (`SCROLL-23`). */
  | { type: "return" };

/**
 * Перехід. Нічого не змінилось — той самий обʼєкт: ручний скрол сипле
 * десятками подій, і кожен новий стан — це перемальовка.
 */
export const follow = (state: FollowState, event: FollowEvent): FollowState => {
  switch (event.type) {
    case "run": {
      if (!event.run) return state.running ? NOT_FOLLOWING : state;
      // Автоскрол уже йшов і лише оновив запис — слідування не чіпаємо.
      if (state.running) return state;
      // Хто відкрив пісню, поки автоскрол іде, слідує (`SCROLL-19`); хто був
      // на ній у момент старту — ні (`SCROLL-20`). Поза читанням не слідує
      // ніхто (`SCROLL-22`).
      return {
        running: true,
        following: event.reading && event.run.startedAt < event.openedAt,
      };
    }
    case "gesture":
    case "leave-read":
      return state.following ? { ...state, following: false } : state;
    case "return":
      return state.running && !state.following ? { ...state, following: true } : state;
  }
};

export type FollowView = {
  /** Мій фокусний рядок — позиція автоскролу, екран їде сам. */
  attached: boolean;
  /** Тінь по краю екрана: свій колір у ініціатора (`SCROLL-29`) і в тих, хто слідує (`SCROLL-21`). */
  edge: "initiator" | "follower" | null;
  /** Бокова кнопка повернення (`SCROLL-23`). */
  returnButton: boolean;
};

/** Автоскролу немає — нічого не показуємо. */
export const IDLE_VIEW: FollowView = { attached: false, edge: null, returnButton: false };

/**
 * Що показати цьому пристрою. Ініціатор прикріплений, поки він у читанні;
 * вийшов — та сама кнопка повертає його туди.
 *
 * Поки ініціатор гортає (`steering`, `SCROLL-25`), його фокусний рядок веде
 * скрол, а не позиція: так він і обирає, куди перенести гурт. Зі
 * слідування це не виводить — тінь лишається, кнопки повернення немає.
 */
export const followView = ({
  run,
  device,
  following,
  reading,
  steering,
}: {
  run: AutoscrollRun | null;
  device: string;
  following: boolean;
  reading: boolean;
  steering: boolean;
}): FollowView => {
  if (!run) return IDLE_VIEW;
  const initiator = isInitiator(run, device);
  if (reading && initiator && steering) {
    return { attached: false, edge: "initiator", returnButton: false };
  }
  const attached = reading && (initiator || following);
  return {
    attached,
    edge: attached ? (initiator ? "initiator" : "follower") : null,
    returnButton: !attached,
  };
};
