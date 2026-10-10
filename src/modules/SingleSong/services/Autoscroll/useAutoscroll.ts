import {useEffect, useState, useSyncExternalStore} from "react";

import {beatMs, isInitiator, phaseAt, rowMs, type AutoscrollRun} from "../../autoscroll/run";
import AutoscrollChannel, {DEVICE_ID} from "./autoscrollChannel";

/** Автоскрол, що йде на цій пісні, або null. */
export const useAutoscrollRun = (songId: string | number | null): AutoscrollRun | null => {
  const channel = AutoscrollChannel.getInstance();
  return useSyncExternalStore(channel.subscribe, () =>
    songId == null ? null : channel.get(songId),
  );
};

/**
 * Чи ініціатор автоскролу на цій пісні в режимі читання (`SCROLL-8`).
 * Автоскролу немає — `false`.
 */
export const useInitiatorPresent = (songId: string | number | null): boolean => {
  const channel = AutoscrollChannel.getInstance();
  return useSyncExternalStore(
    channel.subscribe,
    () => songId != null && channel.isInitiatorPresent(songId),
  );
};

/** Що автоскрол каже фокусному рядку цього пристрою. */
export type Drive = {
  /** Позиція — номер рядка пісні. */
  row: number;
  /** Іде такт відліку: кружечок блимає на кожну долю (`SCROLL-7`). */
  counting: boolean;
  /** Тривалість долі, мс — темп блимання. */
  beatMs: number;
  /** Момент старту — щоб блимання на відліку йшло в долю й у того, хто приєднався посеред такту. */
  startedAt: number;
};

/** Як часто перераховувати позицію. Рядок триває секунди — сота частка нічого не зсуне. */
const TICK_MS = 100;

/**
 * Позиція автоскролу для фокусного рядка — коли екран прикріплений до неї
 * (`attached`: кожен у читанні, крім ініціатора, що саме гортає, —
 * `followView`).
 *
 * Тут же автоскрол зупиняється сам, коли позиція пройшла останній рядок
 * (`SCROLL-10`): стоп пише кожен, хто відкрив пісню, — стерти запис двічі
 * нешкідливо, а ініціатора на пісні вже може й не бути. Решта чекає ще
 * рядок понад кінець: годинник, що спішить на секунди, не мусить зупиняти
 * гурт раніше за ініціатора.
 */
export const useAutoscrollDrive = (
  songId: string | number,
  rowCount: number,
  attached: boolean,
): Drive | null => {
  const run = useAutoscrollRun(songId);
  // Фаза помічена записом, з якого її пораховано: на новий запис (ініціатор
  // відпустив екран) стара фаза ще один рендер лежить у стані, і кружечок
  // смикнувся б на старий рядок — разом зі сторінкою.
  const [phase, setPhase] = useState<{
    run: AutoscrollRun;
    row: number;
    counting: boolean;
  } | null>(null);

  useEffect(() => {
    // Нуль рядків — документ ще не підʼєднаний до редактора (`YjsEditor.connect`
    // іде ефектом батька, ПІСЛЯ цього). Порахувати тут «кінець пісні» означало
    // б зупинити автоскрол усьому гурту, щойно хтось відкрив пісню.
    if (!run || rowCount === 0) {
      setPhase(null);
      return;
    }

    const mine = isInitiator(run, DEVICE_ID);
    const margin = rowMs(run);

    const tick = () => {
      const now = Date.now();
      const next = phaseAt(run, now, rowCount);
      if (next.kind === "ended") {
        if (!mine && phaseAt(run, now - margin, rowCount).kind !== "ended") return;
        AutoscrollChannel.getInstance().stop(songId);
        setPhase(null);
        return;
      }
      const counting = next.kind === "count-in";
      setPhase((current) =>
        current?.run === run && current.row === next.row && current.counting === counting
          ? current
          : {run, row: next.row, counting},
      );
    };

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [run, rowCount, songId]);

  if (!run || !phase || phase.run !== run || !attached) return null;
  return {row: phase.row, counting: phase.counting, beatMs: beatMs(run), startedAt: run.startedAt};
};
