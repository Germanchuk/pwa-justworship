import React, { useCallback } from "react";
import { ChevronsDown, createLucideIcon, LocateFixed } from "lucide-react";
import type { Descendant } from "slate";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { canStop, isInitiator, startRun } from "../../autoscroll/run";
import { useBandOnline } from "#modules/Band/room/useBandRoom";
import { useSongId } from "../../redux/selectors";
import AutoscrollChannel, {
  DEVICE_ID,
} from "../../services/Autoscroll/autoscrollChannel";
import { useAutoscrollFollow } from "../../services/Autoscroll/AutoscrollFollow";
import {
  useAutoscrollRun,
  useInitiatorPresent,
} from "../../services/Autoscroll/useAutoscroll";
import { extractHeader } from "../../services/songChords/extractHeader";
import { getFocusRow } from "../SlateLyricsPlayground/focusRow/FocusRow";
import { getActiveSongEditor } from "../SlateLyricsPlayground/songEditorRegistry";
import { useCurrentUsername } from "../SlateLyricsPlayground/elements/hooks";
import { MENU_TILE } from "./tile";

/**
 * «Старт / стоп автоскролу» — плитка під кнопкою дрона (`SCROLL-4`), лише в
 * читанні (`SCROLL-5`). З дроном не повʼязана. Поки автоскрол не йде, під
 * нею — плитка з трьома шевронами: старт удвічі швидше (`SCROLL-33`); стоп —
 * одна кнопка.
 *
 * Хто натиснув «старт», стає ініціатором: його фокусний рядок після такту
 * відліку йде по пісні сам. В інших на цій пісні кнопка неактивна, а поруч —
 * імʼя ініціатора (`SCROLL-6`, `SCROLL-8`); ініціатора немає на пісні в
 * читанні — зупинити може будь-хто. Без звʼязку з кімнатою гурту
 * кнопка неактивна: автоскрол буває лише спільним (`SCROLL-11`).
 */
export const AutoscrollControls = () => {
  const songId = useSongId();
  const run = useAutoscrollRun(songId ?? null);
  const present = useInitiatorPresent(songId ?? null);
  const online = useBandOnline();
  const username = useCurrentUsername();

  const running = run != null;
  const mayStop = run != null && canStop(run, DEVICE_ID, present);

  const handleClick = useCallback(
    (speed: number) => {
      if (songId == null) return;
      const channel = AutoscrollChannel.getInstance();
      if (run) {
        if (mayStop) channel.stop(songId);
        return;
      }
      const editor = getActiveSongEditor();
      const row = getFocusRow();
      if (!editor || row == null) return;
      channel.start(
        songId,
        startRun({
          row,
          now: Date.now(),
          header: extractHeader(editor.children as Descendant[]),
          initiator: { device: DEVICE_ID, name: username ?? null },
          speed,
        }),
      );
    },
    [songId, run, mayStop, username],
  );

  // Імʼя ініціатора бачать усі, крім нього самого, — і тоді, коли його вже
  // немає, а зупинити може будь-хто (`SCROLL-6`).
  const leader =
    running && !isInitiator(run, DEVICE_ID)
      ? (run.initiator.name ?? "хтось")
      : null;

  return (
    <>
      <div className="flex items-center gap-2">
        {leader && (
          <span
            className="glass flex h-13 items-center rounded-[19px] px-2 text-xs font-semibold text-blue-900 max-w-32"
            title={`Автоскрол веде: ${leader}`}
          >
            <span className="truncate">{leader}</span>
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            MENU_TILE,
            mayStop &&
              "border-primary bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:text-primary-foreground",
          )}
          onClick={() => handleClick(1)}
          disabled={!online || songId == null || (running && !mayStop)}
          aria-pressed={mayStop}
          aria-label="Автоскрол"
          title={
            !online
              ? "Автоскрол — немає звʼязку з сервером"
              : mayStop
                ? leader
                  ? `Зупинити автоскрол (вів: ${leader})`
                  : "Зупинити автоскрол"
                : leader
                  ? `Автоскрол веде: ${leader}`
                  : "Запустити автоскрол звідси"
          }
        >
          <ChevronsDown className="size-6" strokeWidth={2.25} />
        </Button>
      </div>
      {!running && (
        <Button
          variant="ghost"
          size="icon"
          className={MENU_TILE}
          onClick={() => handleClick(2)}
          disabled={!online || songId == null}
          aria-label="Автоскрол удвічі швидше"
          title={
            online
              ? "Запустити автоскрол звідси, удвічі швидше"
              : "Автоскрол — немає звʼязку з сервером"
          }
        >
          <ChevronsDownTriple className="size-6" strokeWidth={2.25} />
        </Button>
      )}
    </>
  );
};

/** Три шеврони — «удвічі швидше»: `ChevronsDown` з ще одним. */
const ChevronsDownTriple = createLucideIcon("chevrons-down-triple", [
  ["path", { d: "m7 3 5 5 5-5", key: "top" }],
  ["path", { d: "m7 9 5 5 5-5", key: "middle" }],
  ["path", { d: "m7 15 5 5 5-5", key: "bottom" }],
]);

const EDGE_SHADOW = {
  initiator:
    "inset 0 0 0 3px rgb(245 158 11 / 0.55), inset 0 0 28px rgb(245 158 11 / 0.45)",
  follower:
    "inset 0 0 0 1px rgb(59 130 246 / 0.35), inset 0 0 16px rgb(59 130 246 / 0.25)",
};

/**
 * Тінь по краю екрана, поки екран прикріплений до автоскролу. В ініціатора —
 * бурштинова (`SCROLL-29`): попереджає, що автоскрол іде з цього пристрою. У
 * того, хто слідує, — тонка синя (`SCROLL-21`). Лише в читанні: поза ним
 * ніхто не прикріплений (`SCROLL-22`, `SCROLL-31`).
 */
export const AutoscrollEdge = () => {
  const { edge } = useAutoscrollFollow();
  if (!edge) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30"
      style={{ boxShadow: EDGE_SHADOW[edge] }}
    />
  );
};

/**
 * Бокова кнопка повернення (`SCROLL-23`): автоскрол іде, а мій екран — ні.
 * Натиск везе в читання (якщо я в іншому режимі), до позиції автоскролу й
 * повертає слідування; кнопка зникає. Після стопу зникає й так (`SCROLL-30`).
 */
export const AutoscrollReturn = () => {
  const { returnButton, returnToRun } = useAutoscrollFollow();
  if (!returnButton) return null;
  return (
    <Button
      variant="ghost"
      className="glass fixed right-0 top-1/2 z-40 h-11 -translate-y-1/2 gap-1.5 rounded-l-[19px] rounded-r-none px-3 text-sm font-semibold text-blue-900 animate-in fade-in-0 slide-in-from-right-4"
      onClick={returnToRun}
      title="Повернутись до автоскролу"
    >
      <LocateFixed className="size-5" strokeWidth={2.25} />
      До автоскролу
    </Button>
  );
};
