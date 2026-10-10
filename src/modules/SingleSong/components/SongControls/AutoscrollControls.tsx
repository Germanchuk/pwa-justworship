import React, { useCallback } from "react";
import { ChevronsDown, createLucideIcon } from "lucide-react";
import type { Descendant } from "slate";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { canStop, startRun } from "../../autoscroll/run";
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
 * відліку йде по пісні сам. В інших на цій пісні кнопка неактивна, імені
 * ініціатора не показуємо (`SCROLL-6`, `SCROLL-8`); ініціатора немає на
 * пісні в читанні — зупинити може будь-хто. Без звʼязку з кімнатою гурту
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

  return (
    <>
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
              ? "Зупинити автоскрол"
              : running
                ? "Автоскрол іде"
                : "Запустити автоскрол звідси"
        }
      >
        <ChevronsDown className="size-6" strokeWidth={2.25} />
      </Button>
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

const AMBER = "rgb(245 158 11 / 0.55)";
const AMBER_GLOW = "rgb(245 158 11 / 0.45)";

const EDGE_SHADOW = {
  // Лише ліворуч і праворуч: від'ємний розкид ховає тінь зверху й знизу.
  initiator: [
    `inset 3px 0 0 ${AMBER}`,
    `inset -3px 0 0 ${AMBER}`,
    `inset 28px 0 28px -14px ${AMBER_GLOW}`,
    `inset -28px 0 28px -14px ${AMBER_GLOW}`,
  ].join(", "),
  follower:
    "inset 0 0 0 1px rgb(59 130 246 / 0.35), inset 0 0 16px rgb(59 130 246 / 0.25)",
};

/**
 * Тінь по краю екрана, поки екран прикріплений до автоскролу. В ініціатора —
 * бурштинова, лише з боків (`SCROLL-29`): попереджає, що автоскрол іде з
 * цього пристрою. В учасників — тонка синя рамка (`SCROLL-21`). Лише в
 * читанні: поза ним ніхто не прикріплений (`SCROLL-22`, `SCROLL-31`).
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
