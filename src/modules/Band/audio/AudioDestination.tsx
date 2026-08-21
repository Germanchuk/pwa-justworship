import { SpeakerWaveIcon } from "@heroicons/react/24/outline";

import type { PlaybackRoute } from "./hostView";
import type { AudioHostStatus } from "./types";

/**
 * КУДИ ПІДЕ ЗВУК — видно ДО того, як натиснули «грати» (`PLAY-29`, `LIST-46`).
 *
 * Питання не косметичне: та сама кнопка або підніме звук на планшеті за
 * пультом, або заграє з телефона в кишені. Дізнатись про це після натиску —
 * посеред служіння — найгірший з можливих моментів.
 *
 * Три стани, і кожен щось значить:
 *   маршрут на хост — імʼя того, чий пристрій зараз звучить на весь зал;
 *   маршрут сюди, а хост у гурті є — «звук тут»: пульт мав би грати, але не
 *                   грає (офлайн, не озброєний — або я вже граю сам, і хост,
 *                   що зʼявився, забере лише наступний запуск, `routeFor`);
 *   хоста немає   — нічого: гурт про хост і не домовлявся, показувати нема про
 *                   що (сценарій «пройти план удома»).
 *
 * ⚠️ Напис читає МАРШРУТ, а не статус хоста. Це та сама відповідь, яку слухають
 * кнопки поруч, тож розійтись вони не можуть: «звук тут» під командою в зал
 * було б найгіршою з можливих брехень.
 */
interface Props {
  /** Куди підуть кнопки поруч (`routeFor`). */
  route: PlaybackRoute;
  status: AudioHostStatus | null | undefined;
  /**
   * Чи взагалі призначений хост у складі гурту. Приходить пропсом, а не з
   * контексту: у верхньому барі роутних контекстів немає (див. `PageBar`).
   */
  hostDesignated: boolean;
}

export const AudioDestination = ({ route, status, hostDesignated }: Props) => {
  if (route === "host") {
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

  // Хост у гурті є — призначений або просто озброєний на чиємусь пристрої
  // (сторінка хоста приймає команди й від непризначеного акаунта). Тоді мовчати
  // не можна: звук іде НЕ туди, куди міг би, і сказати про це — весь сенс.
  if (hostDesignated || status?.armed) {
    return (
      <span
        className="text-[10px] font-semibold text-stone-400"
        title={
          status?.armed
            ? "Звук іде з цього пристрою; хост забере наступний запуск"
            : "Хост звуку офлайн"
        }
      >
        звук тут
      </span>
    );
  }

  return null;
};
