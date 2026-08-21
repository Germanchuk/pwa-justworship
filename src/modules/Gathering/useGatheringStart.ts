import { useCallback, useRef } from "react";

import BandAudioChannel from "#modules/Band/audio/bandAudioChannel";
import type { PlaybackRoute } from "#modules/Band/audio/hostView";
import { gatheringTarget } from "#modules/Band/audio/types";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import { sliceFrom, type Gathering } from "./buildGathering";

/**
 * Чим скінчився натиск. Не «успіх / помилка»: між ними стоїть третій випадок —
 * команда пішла на хост, і чи заграв він, звідси не видно взагалі. Саме тому
 * екран мусить його дочекатись і, не дочекавшись, сказати про це (`PLAY-30`).
 */
export type StartOutcome =
  /** Команда поїхала в кімнату гурту; звук — справа хоста. */
  | "asked-host"
  /** Грає цей пристрій: семпли пішли вантажитись. */
  | "local"
  /** Локальний запуск упав — звуку не буде, і про це треба сказати. */
  | "local-failed";

/**
 * «Грай служіння звідси» — одна дія на два натиски.
 *
 * Її просять двоє: кнопка в барі (з першого пункту) і тап по акорду просто в
 * тексті (`LIST-43`). Різниця між ними — лише в АДРЕСІ, і саме тому вони тут
 * разом: два написання розійшлись би тихо, і розійшлись би на тому, чи ця
 * дорога веде на хост, чи в свій динамік.
 *
 * ⚠️ Маршрут ПРИХОДИТЬ ЗВЕРХУ, а не рахується тут (`routeFor`). Хук викликає
 * лише екран, і той самий маршрут читають кнопки в барі: два обчислення того
 * самого розійшлись би рівно на тому пристрої, де щось уже грає.
 *
 * Маршрут на хост → нікуди не граємо самі: у кімнату їде команда з адресою, а
 * чергу хост збирає САМ — тим самим чистим `buildGathering` (`LIST-35`).
 * Маршрут сюди → грає цей пристрій, і це не аварія, а «пройти план удома»
 * (`LIST-46`).
 */
export const useGatheringStart = ({
  listId,
  gathering,
  route,
  onOutcome,
}: {
  listId: string | number;
  gathering: Gathering;
  route: PlaybackRoute;
  /** Куди подівся натиск. Викликається й на успіх — щоб зняти старий напис. */
  onOutcome: (outcome: StartOutcome) => void;
}) => {
  // Наслідок тримаємо в ref, а не в залежностях: інакше дія перероджувалась би
  // на кожен ререндер екрана, а разом з нею й `memo` на пунктах (голка рухається
  // кілька разів на такт — див. `GatheringItemView`).
  const report = useRef(onOutcome);
  report.current = onOutcome;

  /**
   * Покоління натиску. Між «грай» і звуком стоїть завантаження семплів, і за
   * цей час устигає прилетіти ще один натиск (тап по іншому акорду). Тоді
   * ПОПЕРЕДНІЙ запуск може впасти вже під живий звук нового — і без покоління
   * його «не вдалося» лишилось би висіти на екрані до кінця служіння, ні про
   * що. Те саме покоління всередині себе рахує й плеєр (`startGeneration`).
   */
  const generation = useRef(0);

  const username = useCurrentUsername();

  return useCallback(
    (from: string) => {
      const mine = ++generation.current;

      if (route === "host") {
        BandAudioChannel.getInstance().sendCommand({
          action: "play",
          target: gatheringTarget(listId, from),
          issuedBy: username ?? null,
        });
        report.current("asked-host");
        return;
      }

      // Запуск глушить те, що грало доти (`PLAY-40`): звук один, і дбає про це
      // сам плеєр — тут лишається просто попросити.
      report.current("local");
      ChordsProgressionPlayer.getInstance()
        .playQueue(sliceFrom(gathering, from))
        .catch((error) => {
          console.error("Failed to start gathering playback", error);
          // Нас уже перезапустили — падіння стосується мертвого запуску, і
          // казати про нього означало б скаржитись на те, що зараз звучить.
          if (mine === generation.current) report.current("local-failed");
        });
    },
    [route, listId, username, gathering],
  );
};
