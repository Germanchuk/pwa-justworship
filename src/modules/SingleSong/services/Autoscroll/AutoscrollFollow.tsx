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
import { useHasFocusRow, useSetSongMode } from "../../mode";
import { DEVICE_ID } from "./autoscrollChannel";
import { onManualScroll } from "./manualScroll";
import { useAutoscrollRun } from "./useAutoscroll";

type Follow = FollowView & {
  /** Кнопка повернення: у читання, до позиції, знову слідую (`SCROLL-23`). */
  returnToRun: () => void;
};

const FollowCtx = createContext<Follow>({ ...IDLE_VIEW, returnToRun: () => {} });

/**
 * Слідування на відкритій пісні (`SCROLL-19`…`SCROLL-24`). Правила — у
 * `autoscroll/follow.ts`; тут лише події: запис автоскролу, режим, жести.
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

  const returnToRun = useCallback(() => {
    if (!reading) setMode("read");
    dispatch({ type: "return" });
  }, [reading, setMode]);

  const value = useMemo(
    () => ({
      ...followView({ run, device: DEVICE_ID, following: state.following, reading }),
      returnToRun,
    }),
    [run, state.following, reading, returnToRun],
  );

  return <FollowCtx.Provider value={value}>{children}</FollowCtx.Provider>;
};

export const useAutoscrollFollow = (): Follow => useContext(FollowCtx);
