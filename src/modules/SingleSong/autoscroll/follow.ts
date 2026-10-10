/**
 * Слідування (`SCROLL-19`…`SCROLL-22`): чи прикріплений мій екран до
 * позиції автоскролу. Стан пристрою на одній відкритій пісні — у спільний
 * запис не йде.
 *
 * Автоскрол захоплює всіх, хто на пісні в читанні: ручний скрол не виводить
 * (на наступному рядку екран повернеться до позиції), кнопки повернення
 * немає. Ініціатор, поки гортає, сам веде фокус — так він рухає гурт.
 */

import { isInitiator, type AutoscrollRun } from "./run";

export type FollowView = {
  /** Мій фокусний рядок — позиція автоскролу, екран їде сам. */
  attached: boolean;
  /** Тінь по краю екрана: свій колір у ініціатора (`SCROLL-29`) і в учасників (`SCROLL-21`). */
  edge: "initiator" | "follower" | null;
};

/** Автоскролу немає або я не в читанні — нічого не показуємо. */
export const IDLE_VIEW: FollowView = { attached: false, edge: null };

/**
 * Що показати цьому пристрою. Поки ініціатор гортає (`steering`,
 * `SCROLL-25`), його фокусний рядок веде скрол, а не позиція: так він і
 * обирає, куди перенести гурт.
 */
export const followView = ({
  run,
  device,
  reading,
  steering,
}: {
  run: AutoscrollRun | null;
  device: string;
  reading: boolean;
  steering: boolean;
}): FollowView => {
  if (!run || !reading) return IDLE_VIEW;
  const initiator = isInitiator(run, device);
  return {
    attached: !(initiator && steering),
    edge: initiator ? "initiator" : "follower",
  };
};
