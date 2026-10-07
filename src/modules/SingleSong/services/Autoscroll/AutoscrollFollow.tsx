import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import {
  follow,
  followView,
  IDLE_VIEW,
  NOT_FOLLOWING,
  type FollowView,
} from "../../autoscroll/follow";
import { useBandOnline } from "#modules/Band/room/useBandRoom";
import { holdRun, isInitiator, moveRun, releaseAbandoned } from "../../autoscroll/run";
import { getFocusRow } from "../../components/SlateLyricsPlayground/focusRow/FocusRow";
import { useHasFocusRow, useSetSongMode, useSongMode } from "../../mode";
import AutoscrollChannel, { DEVICE_ID } from "./autoscrollChannel";
import { onManualScroll, onScrollGesture } from "./manualScroll";
import { useAutoscrollRun, useInitiatorPresent } from "./useAutoscroll";

type Follow = FollowView & {
  /** Кнопка повернення: у читання, до позиції, знову слідую (`SCROLL-23`). */
  returnToRun: () => void;
};

const FollowCtx = createContext<Follow>({ ...IDLE_VIEW, returnToRun: () => {} });

/**
 * Слідування на відкритій пісні (`SCROLL-19`…`SCROLL-24`), скрол
 * ініціатора, що рухає гурт (`SCROLL-25`, `SCROLL-26`), і присутність на
 * пісні — для «ініціатора немає» (`SCROLL-8`, `SCROLL-31`). Правила — у
 * `autoscroll/follow.ts` і `autoscroll/run.ts`; тут лише події (запис
 * автоскролу, режим, жести) і записи в кімнату гурту.
 *
 * Стан живе, поки відкрита пісня: інша пісня — новий провайдер (`key`), бо
 * «відкрив пісню» — це момент, від якого рахується, чи я був на ній на
 * старті. Зміна режиму — та сама пісня: стан лишається.
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
  const setMode = useSetSongMode();
  const [openedAt] = useState(Date.now);
  const [state, dispatch] = useReducer(follow, NOT_FOLLOWING);

  // Зміна режиму шле той самий запис ще раз — автомат його пропускає; вихід
  // із читання — окрема подія нижче.
  useEffect(() => {
    dispatch({ type: "run", run, openedAt, reading });
  }, [run, openedAt, reading]);

  useEffect(() => {
    if (!reading) dispatch({ type: "leave-read" });
  }, [reading]);

  useEffect(() => {
    if (!state.following) return;
    return onManualScroll(() => dispatch({ type: "gesture" }));
  }, [state.following]);

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

  const returnToRun = useCallback(() => {
    if (!reading) setMode("read");
    dispatch({ type: "return" });
  }, [reading, setMode]);

  const value = useMemo(
    () => ({
      ...followView({
        run,
        device: DEVICE_ID,
        following: state.following,
        reading,
        steering,
      }),
      returnToRun,
    }),
    [run, state.following, reading, steering, returnToRun],
  );

  return <FollowCtx.Provider value={value}>{children}</FollowCtx.Provider>;
};

export const useAutoscrollFollow = (): Follow => useContext(FollowCtx);
