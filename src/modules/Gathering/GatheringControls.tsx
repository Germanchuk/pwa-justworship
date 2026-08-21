import { PlayIcon, StopIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import type { PlaybackSegment } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";

/**
 * «Грати» для всього служіння.
 *
 * ─── ОДИН ШМАТОК, А НЕ ПІСНЯ ЗА ПІСНЕЮ ─────────────────────────────────────
 * Черга всього служіння віддається плеєру ОДНИМ викликом і далі не чіпається:
 * рулон сам доливає матеріал перед голкою. Саме тому дві пісні підряд звучать
 * атакою — між ними немає ні зупинки, ні нового запуску, ні завантаження
 * семплів. Кінця служіння як події теж немає: черга вичерпалась — звук
 * скінчився (`LIST-40`).
 *
 * ─── ДВІ КНОПКИ, І ОБИДВІ НАВМИСНО ─────────────────────────────────────────
 * «Грати» й «зупинити» — і жодної паузи. Пауза в цьому застосунку означає не
 * «стало, бо я так захотів», а зупинку НА ПРИМІТЦІ, з якої виводить
 * «продовжити» (`LIST-36`, `LIST-37`). Своя, пристроєва пауза була б другим
 * значенням того самого слова, і тікету `06` довелось би їх мирити. «Зупинити»
 * лишається, бо без нього звук нічим спинити.
 *
 * ─── ЧОМУ ТУТ ПОКИ НЕМА ХОСТА ──────────────────────────────────────────────
 * Зібрання грає з ЦЬОГО пристрою — сценарій «пройти план удома». Хост звуку й
 * спільна голка на весь гурт — тікет `05`; «продовжити» — тікет `06`.
 *
 * ⚠️ Доти зібрання проходить наскрізь лише ДО ПЕРШОГО ПРОГРАША: примітка без
 * програша проминається (черга не бачить нульового сегмента), а програш
 * крутить свій луп, і вийти з нього нема чим — лише «зупинити». Обидва
 * свідомі проміжні стани, обидва знімає `06`.
 *
 * ─── ЧОМУ ЦЕ ОКРЕМИЙ КОМПОНЕНТ, А НЕ ЧАСТИНА ЕКРАНА ────────────────────────
 * Він живе у верхньому барі, тобто вище роутів — жодного контексту з них не
 * бачить (див. `PageBar`). Йому це й не треба: плеєр — синглтон, а черга
 * приїжджає пропсом. Заразом стан кнопок не смикає екран зі служінням.
 */
interface Props {
  /** Заголовок сторінки — дата служіння. Своє місце в барі кнопки з ним ділять. */
  title: string;
  /** Наскрізна черга всього служіння з `buildGathering`. */
  segments: PlaybackSegment[];
}

export const GatheringControls = ({ title, segments }: Props) => {
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);
  const [state, setState] = useState(player.getState());

  useEffect(() => player.onStateChange(setState), [player]);

  const handlePlay = useCallback(() => {
    // Запуск зібрання глушить те, що грало доти (`PLAY-40`): звук один, і
    // про це дбає сам плеєр — тут лишається просто попросити.
    player.playQueue(segments).catch((error) => {
      console.error("Failed to start gathering playback", error);
    });
  }, [player, segments]);

  const isLoading = state === "loading";
  const isSounding = state === "playing" || state === "paused";

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <span className="truncate text-base font-extrabold font-['Unbounded']">{title}</span>

      <div className="flex shrink-0 items-center gap-1">
        {isSounding ? (
          <Button
            variant="outline"
            size="icon"
            className="rounded-full border-dashed"
            onClick={() => player.stop()}
            aria-label="Зупинити служіння"
          >
            <StopIcon className="h-6 w-6" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className="rounded-full border-dashed"
            onClick={handlePlay}
            disabled={isLoading || segments.length === 0}
            aria-label="Грати служіння"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayIcon className="h-6 w-6" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
