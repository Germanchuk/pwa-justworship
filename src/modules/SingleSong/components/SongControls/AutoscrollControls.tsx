import React, { useCallback } from "react";
import { ChevronsDown } from "lucide-react";
import type { Descendant } from "slate";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { canStop, isInitiator, startRun } from "../../autoscroll/run";
import { useBandOnline } from "#modules/Band/room/useBandRoom";
import { useHasFocusRow } from "../../mode";
import { useSongId } from "../../redux/selectors";
import AutoscrollChannel, {
  DEVICE_ID,
} from "../../services/Autoscroll/autoscrollChannel";
import { useAutoscrollRun } from "../../services/Autoscroll/useAutoscroll";
import { extractHeader } from "../../services/songChords/extractHeader";
import { getFocusRow } from "../SlateLyricsPlayground/focusRow/FocusRow";
import { getActiveSongEditor } from "../SlateLyricsPlayground/songEditorRegistry";
import { useCurrentUsername } from "../SlateLyricsPlayground/elements/hooks";
import { MENU_TILE } from "./tile";

/**
 * «Старт / стоп автоскролу» — плитка під кнопкою дрона (`SCROLL-4`), лише в
 * читанні (`SCROLL-5`). З дроном не повʼязана.
 *
 * Хто натиснув «старт», стає ініціатором: його фокусний рядок після такту
 * відліку йде по пісні сам. В інших на цій пісні кнопка неактивна, а поруч —
 * імʼя ініціатора (`SCROLL-6`, `SCROLL-8`). Без звʼязку з кімнатою гурту
 * кнопка неактивна: автоскрол буває лише спільним (`SCROLL-11`).
 */
export const AutoscrollControls = () => {
  const songId = useSongId();
  const run = useAutoscrollRun(songId ?? null);
  const online = useBandOnline();
  const username = useCurrentUsername();

  const running = run != null;
  const mayStop = run != null && canStop(run, DEVICE_ID);

  const handleClick = useCallback(() => {
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
      }),
    );
  }, [songId, run, mayStop, username]);

  const leader = running && !mayStop ? (run.initiator.name ?? "хтось") : null;

  return (
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
        onClick={handleClick}
        disabled={!online || songId == null || (running && !mayStop)}
        aria-pressed={mayStop}
        aria-label="Автоскрол"
        title={
          !online
            ? "Автоскрол — немає звʼязку з сервером"
            : mayStop
              ? "Зупинити автоскрол"
              : leader
                ? `Автоскрол веде: ${leader}`
                : "Запустити автоскрол звідси"
        }
      >
        <ChevronsDown className="size-6" strokeWidth={2.25} />
      </Button>
    </div>
  );
};

/**
 * Тінь по краю екрана в ініціатора (`SCROLL-29`): попереджає, що автоскрол
 * іде з цього пристрою. Колір — свій, не той, що в тих, хто слідує. Лише в
 * читанні: поза ним ініціатор позицією не керує (`SCROLL-31`).
 */
export const AutoscrollEdge = () => {
  const songId = useSongId();
  const run = useAutoscrollRun(songId ?? null);
  const hasFocusRow = useHasFocusRow();
  if (!hasFocusRow || !isInitiator(run, DEVICE_ID)) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30"
      style={{
        boxShadow:
          "inset 0 0 0 3px rgb(245 158 11 / 0.55), inset 0 0 28px rgb(245 158 11 / 0.45)",
      }}
    />
  );
};
