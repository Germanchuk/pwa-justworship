import { PlayIcon, StopIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { AudioDestination } from "#modules/Band/audio/AudioDestination";
import BandAudioChannel from "#modules/Band/audio/bandAudioChannel";
import { hostStateFor, isHostLive } from "#modules/Band/audio/hostView";
import { FIRST_POINT, gatheringTarget } from "#modules/Band/audio/types";
import { useAudioHostStatus } from "#modules/Band/audio/useBandAudio";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import type { PlaybackSegment } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";

/**
 * «Грати» для всього служіння.
 *
 * ─── ЗВУК ГУРТУ ОДИН ───────────────────────────────────────────────────────
 * Хост онлайн і озброєний → ця кнопка стає пультом: у band-кімнату їде команда
 * «грай оце служіння з такого пункту», і звук піднімає планшет за пультом
 * (`LIST-46`, `PLAY-38`). Хоста немає → грає цей пристрій, і це не аварія, а
 * сценарій «пройти план удома». Куди саме піде звук, видно ДО натиску —
 * ліворуч від кнопки (`PLAY-29`).
 *
 * Протокол той самий, що й у пісні: та сама кімната, те саме «останній
 * перемагає». Тому запуск служіння глушить пісню, а запуск пісні — служіння
 * (`PLAY-40`): і там, і там звук один, і дбає про це той, у кого він у руках —
 * плеєр локально, двигун хоста на хості.
 *
 * ─── ОДИН ШМАТОК, А НЕ ПІСНЯ ЗА ПІСНЕЮ ─────────────────────────────────────
 * Черга всього служіння віддається плеєру ОДНИМ викликом і далі не чіпається:
 * рулон сам доливає матеріал перед голкою. Саме тому дві пісні підряд звучать
 * атакою — між ними немає ні зупинки, ні нового запуску, ні завантаження
 * семплів. Кінця служіння як події теж немає: черга вичерпалась — звук
 * скінчився (`LIST-40`).
 *
 * ⚠️ ЧЕРГА ЇДЕ НЕ ПО МЕРЕЖІ. По ній їде лише «список і пункт», а чергу хост
 * збирає САМ — тим самим чистим `buildGathering` і з того самого джерела. Так
 * програш, який музикант бачить, і той, що звучить, виходять однакові
 * (`LIST-35`) — межі цієї однаковості описані в `audioHostEngine`. Локальний
 * плейбек грає цю, вже зібрану, чергу.
 *
 * ─── ДВІ КНОПКИ, І ОБИДВІ НАВМИСНО ─────────────────────────────────────────
 * «Грати» й «зупинити» — і жодної паузи. Пауза в цьому застосунку означає не
 * «стало, бо я так захотів», а зупинку НА ПРИМІТЦІ, з якої виводить
 * «продовжити» (`LIST-36`, `LIST-37`). Своя, пристроєва пауза була б другим
 * значенням того самого слова, і тікету `06` довелось би їх мирити. «Зупинити»
 * лишається, бо без нього звук нічим спинити.
 *
 * ⚠️ Служіння проходить наскрізь лише ДО ПЕРШОГО ПРОГРАША: примітка без
 * програша проминається (черга не бачить нульового сегмента), а програш крутить
 * свій луп, і вийти з нього нема чим — лише «зупинити». Обидва свідомі проміжні
 * стани, обидва знімає `06`.
 *
 * ─── ЧОМУ ЦЕ ОКРЕМИЙ КОМПОНЕНТ, А НЕ ЧАСТИНА ЕКРАНА ────────────────────────
 * Він живе у верхньому барі, тобто вище роутів — жодного контексту з них не
 * бачить (див. `PageBar`). Звідси й пропси: `listId` та «чи призначений хост»
 * приходять з екрана, бо самому їх узяти нема звідки. Плеєр і канал —
 * синглтони, тож до них він дістає сам.
 */
interface Props {
  /** Заголовок сторінки — дата служіння. Своє місце в барі кнопки з ним ділять. */
  title: string;
  /** Наскрізна черга всього служіння з `buildGathering`. Для локальної гри. */
  segments: PlaybackSegment[];
  /** Кого просити грати на хості. Черга по мережі не їде — лише це. */
  listId: string | number;
  /** Чи взагалі призначений хост звуку в складі гурту (`PLAY-29`). */
  hostDesignated: boolean;
}

export const GatheringControls = ({ title, segments, listId, hostDesignated }: Props) => {
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);
  const [localState, setLocalState] = useState(player.getState());
  const hostStatus = useAudioHostStatus();
  const username = useCurrentUsername();

  useEffect(() => player.onStateChange(setLocalState), [player]);

  const remoteActive = isHostLive(hostStatus);
  // Хост грає щось інше (іншу пісню, інше служіння) → мої кнопки в тиші, а мій
  // плей його перехопить.
  const state = remoteActive ? hostStateFor(hostStatus, gatheringTarget(listId)) : localState;

  const handlePlay = useCallback(() => {
    if (remoteActive) {
      BandAudioChannel.getInstance().sendCommand({
        action: "play",
        // З першого пункту: старт із довільного акорда — тікет `08`.
        target: gatheringTarget(listId, FIRST_POINT),
        issuedBy: username ?? null,
      });
      return;
    }
    // Запуск глушить те, що грало доти (`PLAY-40`): звук один, і про це дбає
    // сам плеєр — тут лишається просто попросити.
    player.playQueue(segments).catch((error) => {
      console.error("Failed to start gathering playback", error);
    });
  }, [remoteActive, listId, username, player, segments]);

  const handleStop = useCallback(() => {
    if (remoteActive) {
      BandAudioChannel.getInstance().sendCommand({
        action: "stop",
        target: gatheringTarget(listId),
        issuedBy: username ?? null,
      });
      return;
    }
    player.stop();
  }, [remoteActive, listId, username, player]);

  const isLoading = state === "loading";
  const isSounding = state === "playing" || state === "paused";
  // Порожня черга гасить кнопку і з хостом: у служінні без жодного звучного
  // пункту хост теж не заграє, і мовчазна кнопка чесніша за команду в нікуди.
  const nothingToPlay = segments.length === 0;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <span className="truncate text-base font-extrabold font-['Unbounded']">{title}</span>

      <div className="flex shrink-0 items-center gap-1">
        {/* Куди піде звук — видно до натиску (`PLAY-29`, `LIST-46`). */}
        <AudioDestination status={hostStatus} hostDesignated={hostDesignated} />
        {isSounding ? (
          <Button
            variant="outline"
            size="icon"
            className="rounded-full border-dashed"
            onClick={handleStop}
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
            disabled={isLoading || nothingToPlay}
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
