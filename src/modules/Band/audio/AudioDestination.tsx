import { SpeakerWaveIcon } from "@heroicons/react/24/outline";

import { isHostLive } from "./hostView";
import type { AudioHostStatus } from "./types";

/**
 * КУДИ ПІДЕ ЗВУК — видно ДО того, як натиснули «грати» (`PLAY-29`, `LIST-46`).
 *
 * Питання не косметичне: та сама кнопка або підніме звук на планшеті за
 * пультом, або заграє з телефона в кишені. Дізнатись про це після натиску —
 * посеред служіння — найгірший з можливих моментів.
 *
 * Три стани, і кожен щось значить:
 *   хост онлайн   — імʼя того, чий пристрій зараз звучить на весь зал;
 *   хост призначений, але офлайн — «звук тут»: пульт мав би грати, але не
 *                   грає, і зараз заграє мій телефон;
 *   хоста немає   — нічого: гурт про хост і не домовлявся, показувати нема про
 *                   що (сценарій «пройти план удома»).
 */
interface Props {
  status: AudioHostStatus | null | undefined;
  /**
   * Чи взагалі призначений хост у складі гурту. Приходить пропсом, а не з
   * контексту: у верхньому барі роутних контекстів немає (див. `PageBar`).
   */
  hostDesignated: boolean;
}

export const AudioDestination = ({ status, hostDesignated }: Props) => {
  if (isHostLive(status)) {
    return (
      <span
        className="flex items-center gap-0.5 text-[10px] font-semibold text-blue-900 max-w-24"
        title={`Звук грає: ${status?.username ?? "хост"}`}
      >
        <SpeakerWaveIcon className="size-3.5 shrink-0" />
        <span className="truncate">{status?.username ?? "хост"}</span>
      </span>
    );
  }

  if (hostDesignated) {
    return (
      <span className="text-[10px] font-semibold text-stone-400" title="Хост звуку офлайн">
        звук тут
      </span>
    );
  }

  return null;
};
