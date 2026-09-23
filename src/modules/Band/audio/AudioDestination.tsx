import { SpeakerWaveIcon } from "@heroicons/react/24/outline";

import type { PlaybackRoute } from "./hostView";
import type { AudioHostStatus } from "./types";

/**
 * КУДИ ПІДЕ ЗВУК — видно ДО того, як натиснули «увімкнути» (`PLAY-29`, `LIST-46`).
 *
 * Питання не косметичне: та сама кнопка або підніме звук на планшеті за
 * пультом, або заграє з телефона в кишені. Дізнатись про це після натиску —
 * посеред служіння — найгірший з можливих моментів.
 *
 * Маршрут на хост — імʼя того, чий пристрій зараз звучить на весь зал. Звук
 * з цього пристрою — нічого: це звичайний випадок, підпис лише займав би
 * місце в рядку меню (колишнє «звук тут» прибрано 2026-09-23).
 *
 * ⚠️ Напис читає МАРШРУТ, а не статус хоста. Це та сама відповідь, яку слухають
 * кнопки поруч, тож розійтись вони не можуть.
 */
interface Props {
  /** Куди підуть кнопки поруч (`routeFor`). */
  route: PlaybackRoute;
  status: AudioHostStatus | null | undefined;
}

export const AudioDestination = ({ route, status }: Props) => {
  if (route !== "host") return null;
  return (
    <span
      className="flex h-9 items-center gap-0.5 px-1.5 text-[10px] font-semibold text-blue-900 max-w-28"
      title={`Звук грає: ${status?.username ?? "хост"}`}
    >
      <SpeakerWaveIcon className="size-3.5 shrink-0" />
      <span className="truncate">{status?.username ?? "хост"}</span>
    </span>
  );
};
