import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { followView, IDLE_VIEW, type FollowView } from "../../autoscroll/follow";
import { useBandOnline } from "#modules/Band/room/useBandRoom";
import { holdRun, isInitiator, moveRun, releaseAbandoned } from "../../autoscroll/run";
import { getFocusRow } from "../../components/SlateLyricsPlayground/focusRow/FocusRow";
import { useHasFocusRow, useSongMode } from "../../mode";
import AutoscrollChannel, { DEVICE_ID } from "./autoscrollChannel";
import { onScrollGesture } from "./manualScroll";
import { useAutoscrollRun, useInitiatorPresent } from "./useAutoscroll";

const FollowCtx = createContext<FollowView>(IDLE_VIEW);

/**
 * Слідування на відкритій пісні (`SCROLL-19`…`SCROLL-24`), скрол
 * ініціатора, що рухає гурт (`SCROLL-25`, `SCROLL-26`), і присутність на
 * пісні — для «ініціатора немає» (`SCROLL-8`, `SCROLL-31`). Правила — у
 * `autoscroll/follow.ts` і `autoscroll/run.ts`; тут лише події (запис
 * автоскролу, режим, жести) і записи в кімнату гурту.
 */
export const AutoscrollFollowProvider = ({
  songId,
  children,
}: {
  songId: string | number | null;
  children: ReactNode;
}) => {
  const run = useAutoscrollRun(songId);
  const mode = useSongMode();
  const reading = useHasFocusRow();

  // Ініціатор рухає гурт (`SCROLL-25`, `SCROLL-26`): гортання — позиція в
  // усіх стоїть, а його фокусний рядок іде за скролом; відпустив — позицією
  // стає його фокусний рядок.
  const [steering, setSteering] = useState(false);
  const initiatorReading = reading && isInitiator(run, DEVICE_ID);
  useEffect(() => {
    if (!initiatorReading || songId == null) return;
    const channel = AutoscrollChannel.getInstance();
    return onScrollGesture({
      start: () => {
        channel.update(songId, (current) => holdRun(current, Date.now()));
        setSteering(true);
      },
      end: () => {
        channel.update(songId, (current) =>
          moveRun(current, { row: getFocusRow() ?? current.row, now: Date.now() }),
        );
        setSteering(false);
      },
    });
  }, [initiatorReading, songId]);

  // Присутність: на якій я пісні й у якому режимі. Зміна режиму переписує
  // поле, а не знімає його й ставить знову, — інакше в інших на мить
  // «ініціатора немає».
  useEffect(() => {
    if (songId == null) return;
    const channel = AutoscrollChannel.getInstance();
    return () => channel.setPresence(null);
  }, [songId]);
  useEffect(() => {
    if (songId != null) AutoscrollChannel.getInstance().setPresence({ songId, mode });
  }, [songId, mode]);

  // Ініціатор зник із пальцем «на екрані» — позиція не стоїть до стопу:
  // відпускає будь-хто на пісні. Без звʼязку — ні: я не бачу, чи він є, а
  // запис поїде, щойно підʼєднаюсь.
  const present = useInitiatorPresent(songId);
  const online = useBandOnline();
  useEffect(() => {
    if (!online || songId == null) return;
    AutoscrollChannel.getInstance().update(songId, (current) =>
      releaseAbandoned(current, present, Date.now()),
    );
  }, [run, present, online, songId]);

  const value = useMemo(
    () => followView({ run, device: DEVICE_ID, reading, steering }),
    [run, reading, steering],
  );

  return <FollowCtx.Provider value={value}>{children}</FollowCtx.Provider>;
};

export const useAutoscrollFollow = (): FollowView => useContext(FollowCtx);
