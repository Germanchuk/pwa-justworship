/**
 * ЯК ЕКРАН ЧИТАЄ ХОСТА — чистий шар між статусом із кімнати й кнопками.
 *
 * Кожен екран питає одне й те саме: «хост зараз грає ТЕ, що відкрито в мене?»
 * Відповідь стоїть на тотожності цілі — і саме тому вона тут одна на всіх:
 * сторінка пісні й екран зібрання мають упізнавати хоста однаково, інакше
 * кнопки на одному з них починають брехати.
 *
 * Tone, React і мережі тут немає навмисно: усе, що вирішує, чиє світиться й
 * чий стан показувати, перевіряється таблицею.
 */

import type { AudioHostPlaybackState, AudioHostStatus, PlaybackTarget } from "./types";

/**
 * Чи це одне й те саме — БЕЗ огляду на точку старту.
 *
 * Пісня, запущена з третього акорда, лишається тією самою піснею; служіння,
 * запущене з п'ятого пункту, — тим самим служінням. Точка старту живе в тій
 * самій структурі (там їй місце — вона їде однією командою), але тотожності
 * не утворює: інакше кожен новий старт виглядав би для екрана як «хост пішов
 * грати щось інше», і підсвітка гасла б на рівному місці.
 *
 * Id порівнюються рядками: по мережі вони їдуть то числом, то рядком, і це
 * єдине місце, де ця різниця має значення.
 */
export const isSameTarget = (
  a: PlaybackTarget | null | undefined,
  b: PlaybackTarget | null | undefined,
): boolean => {
  if (!a || !b) return false;
  if (a.kind === "song") {
    return b.kind === "song" && String(a.songId) === String(b.songId);
  }
  return b.kind === "gathering" && String(a.listId) === String(b.listId);
};

/** Хост онлайн і озброєний — тобто кнопки гурту стають пультом (`PLAY-27`). */
export const isHostLive = (status: AudioHostStatus | null | undefined): boolean =>
  status?.armed === true;

const hostPlays = (
  status: AudioHostStatus | null | undefined,
  target: PlaybackTarget,
): boolean => isHostLive(status) && isSameTarget(status?.playing, target);

/**
 * Стан хоста очима ЦЬОГО екрана: він грає моє — його стан; грає чуже — для
 * мене тиша, і мій плей його перехопить («останній перемагає», `PLAY-28`).
 */
export const hostStateFor = (
  status: AudioHostStatus | null | undefined,
  target: PlaybackTarget,
): AudioHostPlaybackState => (hostPlays(status, target) ? status!.state : "idle");

/** Спільна голка з хоста для цього екрана. `null` — хост світить не тут. */
export const hostNeedleFor = (
  status: AudioHostStatus | null | undefined,
  target: PlaybackTarget,
): string | null => (hostPlays(status, target) ? status!.currentTokenKey : null);

/**
 * Пункт, на якому служіння на хості чекає «продовжити», — і чекає саме ТУТ, на
 * цьому екрані. `null` — кнопки немає.
 *
 * Кнопку «продовжити» тисне будь-хто з гурту (`LIST-41`), тож питання в
 * кожного те саме, що й про голку: хост стоїть у МОЄМУ служінні? Стоїть у
 * чужому — не моя справа, і кнопки в мене немає.
 */
export const hostAwaitingPoint = (
  status: AudioHostStatus | null | undefined,
  target: PlaybackTarget,
): string | null => (hostPlays(status, target) ? (status!.awaitingAt ?? null) : null);

/**
 * Що підсвічувати: своє, поки звучить мій пристрій, інакше — хостове
 * (`PLAY-33`). Локальний звук сильніший саме тому, що він мій: якщо я граю
 * сам, чужа голка на моєму екрані означала б розсинхрон із тим, що я чую.
 *
 * ⚠️ Поки локально щось звучить, `null` — це теж відповідь (пауза між
 * акордами), а не «немає своєї — візьму хостову».
 *
 * `target` буває `null`: екран ще не знає, що на ньому відкрито (пісня не
 * доїхала). Питати хоста тоді нема про що — лишається своє.
 */
export const needleFor = ({
  localState,
  localTokenKey,
  status,
  target,
}: {
  localState: AudioHostPlaybackState;
  localTokenKey: string | null;
  status: AudioHostStatus | null | undefined;
  target: PlaybackTarget | null;
}): string | null => {
  if (localState !== "idle") return localTokenKey;
  return target ? hostNeedleFor(status, target) : null;
};
