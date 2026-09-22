/**
 * ЯК ЕКРАН ЧИТАЄ ХОСТА — чистий шар між статусом із кімнати й кнопками.
 *
 * Кожен екран питає одне й те саме: «хост зараз грає ТЕ, що відкрито в мене?»
 * Відповідь стоїть на тотожності цілі — і саме тому вона тут одна на всіх.
 *
 * Tone, React і мережі тут немає навмисно: усе, що вирішує, чий стан показувати
 * і куди йдуть кнопки, перевіряється таблицею.
 */

import type { AudioHostPlaybackState, AudioHostStatus, PlaybackTarget } from "./types";

/**
 * Чи це одне й те саме. Id порівнюються рядками: по мережі вони їдуть то
 * числом, то рядком, і це єдине місце, де ця різниця має значення.
 */
export const isSameTarget = (
  a: PlaybackTarget | null | undefined,
  b: PlaybackTarget | null | undefined,
): boolean => {
  if (!a || !b) return false;
  return a.kind === b.kind && String(a.songId) === String(b.songId);
};

/** Хост онлайн і озброєний — тобто кнопки гурту стають пультом (`PLAY-27`). */
export const isHostLive = (status: AudioHostStatus | null | undefined): boolean =>
  status?.armed === true;

/**
 * КУДИ ЙДУТЬ МОЇ КНОПКИ — на хост чи у власний динамік.
 *
 * **Звук, який уже йде з мого пристрою, лишається моїм.** Хост живий і я мовчу
 * — кнопки стають пультом (`PLAY-27`); хоста немає — граю сам (`PLAY-30`).
 *
 * ⚠️ ЩО РОБИТЬ ХОСТ, ЯКИЙ ЗʼЯВИВСЯ ПОСЕРЕД МОЄЇ ГРИ: нічого. Він забирає
 * НАСТУПНЕ вмикання, а не поточне. Інакше «вимкнути» поїхало б у кімнату гурту,
 * а звук лишився б тут — на екрані кнопка від чужого звуку, у динаміку свій, і
 * вимкнути його нічим. Те саме стосується `loading`: звук уже піднімається
 * саме тут.
 *
 * Симетрично: поки я граю сам, чужий хост мене не глушить — «останній
 * перемагає» (`PLAY-28`) стосується того, хто звуком керує, а тут ним керую я.
 */
export type PlaybackRoute = "host" | "local";

export const routeFor = ({
  localState,
  status,
}: {
  localState: AudioHostPlaybackState;
  status: AudioHostStatus | null | undefined;
}): PlaybackRoute => (localState === "idle" && isHostLive(status) ? "host" : "local");

/**
 * Стан хоста очима ЦЬОГО екрана: він грає моє — його стан; грає чуже — для
 * мене тиша, і моє вмикання його перехопить («останній перемагає», `PLAY-28`).
 */
export const hostStateFor = (
  status: AudioHostStatus | null | undefined,
  target: PlaybackTarget,
): AudioHostPlaybackState =>
  isHostLive(status) && isSameTarget(status?.playing, target) ? status!.state : "idle";
