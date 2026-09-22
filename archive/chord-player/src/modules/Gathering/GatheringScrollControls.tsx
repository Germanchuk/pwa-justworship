import { ArrowsUpDownIcon, ViewfinderCircleIcon } from "@heroicons/react/24/outline";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { getAutoScroll, setAutoScroll, subscribeAutoScroll } from "./autoScroll";

/**
 * ДВІ КНОПКИ ВНИЗУ ЕКРАНА: «хай їде сам» і «вернись до гурту».
 *
 * ─── ЧОМУ НЕ У ВЕРХНЬОМУ БАРІ ──────────────────────────────────────────────
 * По-перше, місця там уже немає: центральна панель — 241px, і в служінні в ній
 * і так живуть назва, позначка звуку, «продовжити» й «грати/стоп». По-друге,
 * тиснуть це стоячи з інструментом у руках, однією рукою й не дивлячись:
 * низ екрана під великим пальцем, верх — ні.
 *
 * ─── ЧОМУ «ДО ГОЛКИ» ВИДНО НЕ ЗАВЖДИ ───────────────────────────────────────
 * Поки автоскрол увімкнений, голка на екрані вже є — кнопка вела б туди, де
 * ти й так стоїш. Тому вона зʼявляється рівно тоді, коли щось звучить, а екран
 * за ним не йде: або дотик збив автоскрол, або його ніколи й не вмикали.
 *
 * Що вона робить, залежить від причини — і це не примха, а два різні гурти
 * (`autoScroll.ts`): дотик вона скасовує разом із поїздкою, а свідомо
 * вимкнений автоскрол не вмикає, бо гурту, який гортає сам, екран, що поїхав,
 * тільки заважає (`LIST-45`).
 */
interface Props {
  /** Чи є зараз голка: без неї «до голки» вести нікуди. */
  hasNeedle: boolean;
  onToNeedle: () => void;
}

export const GatheringScrollControls = ({ hasNeedle, onToNeedle }: Props) => {
  const auto = useSyncExternalStore(subscribeAutoScroll, getAutoScroll);

  return (
    <div
      className="glass fixed right-2 z-30 flex flex-col gap-1 rounded-2xl p-1"
      style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {hasNeedle && !auto.on && (
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onToNeedle}
          aria-label="До голки"
          title="До голки"
        >
          <ViewfinderCircleIcon className="h-6 w-6" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className={`rounded-full ${auto.on ? "bg-accent text-accent-foreground" : ""}`}
        onClick={() => setAutoScroll(!auto.on)}
        aria-pressed={auto.on}
        aria-label={auto.on ? "Вимкнути автоскрол" : "Увімкнути автоскрол"}
        title={auto.on ? "Вимкнути автоскрол" : "Увімкнути автоскрол"}
      >
        <ArrowsUpDownIcon className="h-6 w-6" />
      </Button>
    </div>
  );
};
