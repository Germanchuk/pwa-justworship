import { ForwardIcon, PlayIcon, StopIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { AudioDestination } from "#modules/Band/audio/AudioDestination";
import BandAudioChannel from "#modules/Band/audio/bandAudioChannel";
import { hostAwaitingPoint, hostStateFor, isHostLive } from "#modules/Band/audio/hostView";
import { FIRST_POINT, gatheringTarget, type PlaybackAction } from "#modules/Band/audio/types";
import { useAudioHostStatus } from "#modules/Band/audio/useBandAudio";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import type { Gathering } from "./buildGathering";
import { useGatheringStart } from "./useGatheringStart";

/**
 * «Грати» для всього служіння.
 *
 * ─── ЗВУК ГУРТУ ОДИН ───────────────────────────────────────────────────────
 * Хост онлайн і озброєний → ця кнопка стає пультом: у band-кімнату їде команда
 * «грай оце служіння з такого місця», і звук піднімає планшет за пультом
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
 * ⚠️ ЧЕРГА ЇДЕ НЕ ПО МЕРЕЖІ. По ній їде лише «список і місце», а чергу хост
 * збирає САМ — тим самим чистим `buildGathering` і з того самого джерела. Так
 * програш, який музикант бачить, і той, що звучить, виходять однакові
 * (`LIST-35`) — межі цієї однаковості описані в `audioHostEngine`. Локальний
 * плейбек грає цю, вже зібрану, чергу.
 *
 * ⚠️ ЦЕ НЕ ЄДИНИЙ СПОСІБ ЗАПУСТИТИ. Тап по акорду просто в тексті означає те
 * саме «грай», лише з точнішої адреси (`LIST-43`), і йде тією самою дорогою —
 * `useGatheringStart`. Тому кнопка тут не тримає ніякої «своєї» логіки старту.
 *
 * ─── ТРИ КНОПКИ, І ЖОДНОЇ ПАУЗИ ────────────────────────────────────────────
 * «Грати», «зупинити» і — коли служіння чекає — «продовжити». Паузи серед них
 * немає навмисно: пауза в цьому застосунку означає не «стало, бо я так
 * захотів», а зупинку НА ПРИМІТЦІ (`LIST-36`, `LIST-37`). Своя, пристроєва
 * пауза була б другим значенням того самого слова.
 *
 * «Продовжити» з'являється на два різні очікування — тиша на примітці й луп
 * програша — бо для того, хто на неї дивиться, вони однакові: далі буде, коли
 * ми скажемо. Тисне її будь-хто з гурту, один раз, і звук іде далі У ВСІХ
 * (`LIST-41`) — тією ж дорогою, що й «грати»: команда в кімнату, коли грає
 * хост, свій плеєр, коли граю я сам.
 *
 * ⚠️ У ЛУПІ кнопка живе трохи не в такт звуку: черга йде попереду голки на
 * горизонт доливання, тож кнопка з'являється до першого чутного кола програша
 * і зникає на сам натиск, а вийде луп на межі свого проходу (`LIST-42`).
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
  /** Зібране служіння: черга для локальної гри й адреси старту в ній. */
  gathering: Gathering;
  /** Кого просити грати на хості. Черга по мережі не їде — лише це. */
  listId: string | number;
  /** Чи взагалі призначений хост звуку в складі гурту (`PLAY-29`). */
  hostDesignated: boolean;
}

export const GatheringControls = ({ title, gathering, listId, hostDesignated }: Props) => {
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);
  const [localState, setLocalState] = useState(player.getState());
  const [localAwaitingAt, setLocalAwaitingAt] = useState(player.getAwaitingPoint());
  const hostStatus = useAudioHostStatus();
  const username = useCurrentUsername();

  useEffect(() => player.onStateChange(setLocalState), [player]);
  // Очікування — окрема підписка, а не похідне від стану: у лупі програша стан
  // лишається «playing», а кнопка мусить з'явитись саме там.
  useEffect(() => player.onAwaitingContinueChange(setLocalAwaitingAt), [player]);

  const remoteActive = isHostLive(hostStatus);
  const target = gatheringTarget(listId);
  // Хост грає щось інше (іншу пісню, інше служіння) → мої кнопки в тиші, а мій
  // плей його перехопить.
  const state = remoteActive ? hostStateFor(hostStatus, target) : localState;
  const awaitingAt = remoteActive ? hostAwaitingPoint(hostStatus, target) : localAwaitingAt;

  // Однакові листи в кімнату гурту, різні лише дією і адресою. Запуску серед
  // них немає: він живе в `useGatheringStart` — там, де ним користується ще й
  // тап по акорду.
  const command = useCallback(
    (action: PlaybackAction, from?: string) => {
      BandAudioChannel.getInstance().sendCommand({
        action,
        target: gatheringTarget(listId, from),
        issuedBy: username ?? null,
      });
    },
    [listId, username],
  );

  // Кнопка — це та сама дія, що й тап по акорду в тексті, лише з найгрубішою
  // адресою: з першого пункту (`useGatheringStart`).
  const start = useGatheringStart(listId, gathering);
  const handlePlay = useCallback(() => start(FIRST_POINT), [start]);

  const handleContinue = useCallback(() => {
    // Пункт, який ЦЕЙ екран бачить зупиненим, їде разом із натиском: тиснуть
    // кілька людей одразу, і без адреси другий натиск проковтнув би наступну
    // зупинку (`requestExit`).
    if (awaitingAt == null) return;
    if (remoteActive) return command("continue", awaitingAt);
    player.next(awaitingAt);
  }, [awaitingAt, remoteActive, command, player]);

  const handleStop = useCallback(() => {
    if (remoteActive) return command("stop");
    player.stop();
  }, [remoteActive, command, player]);

  const isLoading = state === "loading";
  const isSounding = state === "playing" || state === "paused";
  // Порожня черга гасить кнопку і з хостом: у служінні без жодного звучного
  // пункту хост теж не заграє, і мовчазна кнопка чесніша за команду в нікуди.
  const nothingToPlay = gathering.segments.length === 0;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <span className="truncate text-base font-extrabold font-['Unbounded']">{title}</span>

      <div className="flex shrink-0 items-center gap-1">
        {/* Куди піде звук — видно до натиску (`PLAY-29`, `LIST-46`). */}
        <AudioDestination status={hostStatus} hostDesignated={hostDesignated} />
        {awaitingAt != null && (
          <Button
            variant="outline"
            size="icon"
            className="rounded-full border-dashed"
            onClick={handleContinue}
            aria-label="Продовжити служіння"
          >
            <ForwardIcon className="h-6 w-6" />
          </Button>
        )}
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
