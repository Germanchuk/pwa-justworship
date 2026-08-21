import { useCallback } from "react";

import BandAudioChannel from "#modules/Band/audio/bandAudioChannel";
import { isHostLive } from "#modules/Band/audio/hostView";
import { gatheringTarget } from "#modules/Band/audio/types";
import { useAudioHostStatus } from "#modules/Band/audio/useBandAudio";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import ChordsProgressionPlayer from "#modules/SingleSong/services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import { sliceFrom, type Gathering } from "./buildGathering";

/**
 * «Грай служіння звідси» — одна дія на два натиски.
 *
 * Її просять двоє: кнопка в барі (з першого пункту) і тап по акорду просто в
 * тексті (`LIST-43`). Різниця між ними — лише в АДРЕСІ, і саме тому вони тут
 * разом: два написання розійшлись би тихо, і розійшлись би на тому, чи ця
 * дорога веде на хост, чи в свій динамік.
 *
 * ⚠️ Хост живий → нікуди не граємо самі: у кімнату їде команда з адресою, а
 * чергу хост збирає САМ — тим самим чистим `buildGathering` (`LIST-35`).
 * Хоста немає → грає цей пристрій, і це не аварія, а «пройти план удома»
 * (`LIST-46`).
 */
export const useGatheringStart = (listId: string | number, gathering: Gathering) => {
  const hostStatus = useAudioHostStatus();
  const username = useCurrentUsername();
  // Саме булеве значення, а не статус: статус приїжджає на кожен рух голки, і
  // дія перестала б бути тією самою функцією між акордами.
  const remoteActive = isHostLive(hostStatus);

  return useCallback(
    (from: string) => {
      if (remoteActive) {
        BandAudioChannel.getInstance().sendCommand({
          action: "play",
          target: gatheringTarget(listId, from),
          issuedBy: username ?? null,
        });
        return;
      }

      // Запуск глушить те, що грало доти (`PLAY-40`): звук один, і дбає про це
      // сам плеєр — тут лишається просто попросити.
      ChordsProgressionPlayer.getInstance()
        .playQueue(sliceFrom(gathering, from))
        .catch((error) => {
          console.error("Failed to start gathering playback", error);
        });
    },
    [remoteActive, listId, username, gathering],
  );
};
