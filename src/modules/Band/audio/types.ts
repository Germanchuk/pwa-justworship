/**
 * Протокол band-кімнати (`band:<bandId>` в collab-сервісі). Все їздить
 * awareness-ом — ефемерно свідомо: після reload немає реплею старих команд,
 * повторити = ще раз натиснути.
 */

/** Дрон вмикають і вимикають (ADR-0003) — паузи й «продовжити» немає. */
export type PlaybackAction = "play" | "stop";

/**
 * ЩО грати. Зараз це лише пісня, але поле `kind` лишається: коли повернеться
 * звук зібрання, ціль знову стане union-ом (див. `archive/chord-player`), і
 * жоден бік не мусить вгадувати, який випадок перед ним. Ціль іншого виду хост
 * мовчки ігнорує — так поводиться і зі старими клієнтами.
 */
export type PlaybackTarget = {
  kind: "song";
  songId: string | number;
};

export const songTarget = (songId: string | number): PlaybackTarget => ({ kind: "song", songId });

/** Команда контролера хосту. */
export interface PlaybackCommand {
  /** Зростає в межах peer-а; хост виконує лише свіжіші за вже бачені. */
  nonce: number;
  action: PlaybackAction;
  /** Обов'язковий для play; для stop — просто контекст (звук на хості один). */
  target: PlaybackTarget;
  issuedBy: string | null;
  issuedAt: number;
}

export type AudioHostPlaybackState = "idle" | "loading" | "playing";

/** Статус, який хост публікує в кімнату. Жива правда про «звук гурту». */
export interface AudioHostStatus {
  userId: number | null;
  username: string | null;
  /** Звук розблоковано дотиком (Tone.start) — хост готовий грати. */
  armed: boolean;
  state: AudioHostPlaybackState;
  /** Що саме зараз на хості — та сама ціль, що й у команді. */
  playing: PlaybackTarget | null;
  /** Людська назва того, що грає: назва пісні. */
  playingName: string | null;
  /** Хто видав останню виконану команду. */
  controlledBy: string | null;
  updatedAt: number;
}
