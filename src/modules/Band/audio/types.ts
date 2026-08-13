/**
 * Протокол band-кімнати (`band:<bandId>` в collab-сервісі). Все їздить
 * awareness-ом — ефемерно свідомо: після reload немає реплею старих команд,
 * повторити = ще раз натиснути.
 */

export type PlaybackAction = "play" | "pause" | "resume" | "stop";

/** Команда контролера хосту. Несе songId — тому хост «підхоплює будь-яку пісню». */
export interface PlaybackCommand {
  /** Зростає в межах peer-а; хост виконує лише свіжіші за вже бачені. */
  nonce: number;
  action: PlaybackAction;
  /** Обов'язковий для play; для pause/resume/stop — просто контекст. */
  songId: string | number | null;
  /** Обраний акорд старту (tokenKey) — для play. */
  startTokenKey: string | null;
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
  songId: string | number | null;
  songName: string | null;
  /** Поточний акорд — для підсвітки в усього гурту. */
  currentTokenKey: string | null;
  /** Хто видав останню виконану команду. */
  controlledBy: string | null;
  updatedAt: number;
}
