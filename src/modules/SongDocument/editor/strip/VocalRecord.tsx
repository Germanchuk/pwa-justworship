/**
 * Запис вокалу в смузі (PLAY-60…): кнопка мікрофона біля ▶ і, після дубля,
 * панель чернетки — зсув на затримку, «ще раз», «скасувати», «зберегти».
 *
 * Пишемо в видиму доріжку піаніно; їх кілька — вибір; немає жодної — 🎤
 * додає доріжку «Вокал» (першим же натиском, у кожен рядок, як завжди).
 */
import { useSyncExternalStore } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Mic, RotateCcw, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { addLane, DEFAULT_ZOOM, linesOf, readHiddenLanes, readTempo, songLanes, Song } from "../../model";
import { vocalRecorder } from "../../playback/recorder";
import type { Span } from "../../playback/timeline";
import { STRIP_BUTTON } from "./StripTransport";

/** Крок зсуву чернетки — 20 мс: на слух уже чути, на око — частка комірки. */
const NUDGE = 0.02;

type Props = { song: Song; me: string | null; zoom: number | undefined; from: () => Span | null; side: "top" | "bottom" };

/** 🎤: почати дубль. Показується, лише коли людина може правити. */
export function RecordButton({ song, me, zoom, from, side }: Props) {
  const state = useSyncExternalStore(vocalRecorder.listen, vocalRecorder.getState);
  const error = useSyncExternalStore(vocalRecorder.listen, vocalRecorder.getError);
  const hidden = () => (me ? readHiddenLanes(song.doc, me) : []);
  const pianos = songLanes(song.doc).filter((l) => l.kind === "piano" && !hidden().includes(l.id));

  const record = (lane?: string) => {
    let id = lane ?? pianos[0]?.id;
    if (!id) song.doc.transact(() => (id = addLane(song, "piano", linesOf(song), "Вокал")));
    const start = from();
    if (!id || !start) return;
    void vocalRecorder.start({ song, lane: id, from: start, hidden, percent: () => (me ? readTempo(song.doc, me) : 100), zoom: zoom ?? DEFAULT_ZOOM });
  };

  const busy = state === "opening" || state === "recording";
  const button = (onClick?: () => void) => (
    <button
      type="button"
      className={cn(STRIP_BUTTON, busy && "bg-red-600 text-white")}
      onClick={onClick}
      aria-label={busy ? "Зупинити запис" : "Записати вокал"}
      title={busy ? "Зупинити запис" : "Записати вокал"}
    >
      {state === "opening" ? <Loader2 className="size-5 animate-spin" /> : <Mic className={cn("size-5", state === "recording" && "animate-pulse")} />}
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      {error && (
        <button type="button" className="max-w-40 truncate text-xs text-red-700" onClick={vocalRecorder.clearError} title={error}>
          {error}
        </button>
      )}
      {busy ? (
        button(vocalRecorder.stop)
      ) : pianos.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{button()}</DropdownMenuTrigger>
          <DropdownMenuContent side={side} align="end" className="min-w-40">
            <DropdownMenuLabel>Записати в доріжку</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {pianos.map((l) => (
              <DropdownMenuItem key={l.id} onSelect={() => record(l.id)}>
                {l.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        button(() => record())
      )}
    </div>
  );
}

/** Чернетка дубля: розбираю → зсув, ще раз, скасувати, зберегти. Замість транспорту, поки вона є. */
export function DraftBar() {
  const state = useSyncExternalStore(vocalRecorder.listen, vocalRecorder.getState);
  const draft = useSyncExternalStore(vocalRecorder.listen, vocalRecorder.getDraft);
  if (state === "analyzing")
    return (
      <div className="flex items-center gap-1.5 px-2 text-sm text-stone-600">
        <Loader2 className="size-4 animate-spin" /> Розбираю ноти…
      </div>
    );
  if (state !== "review" || !draft) return null;
  const ms = Math.round(draft.shift * 1000);
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={STRIP_BUTTON} onClick={() => vocalRecorder.nudge(NUDGE)} aria-label="Ноти раніше" title="Ноти раніше">
        <ChevronLeft className="size-5" />
      </button>
      <span className="w-12 text-center text-[11px] leading-tight text-stone-600" title="Поправка на затримку навушників">
        {ms} мс
      </span>
      <button type="button" className={STRIP_BUTTON} onClick={() => vocalRecorder.nudge(-NUDGE)} aria-label="Ноти пізніше" title="Ноти пізніше">
        <ChevronRight className="size-5" />
      </button>
      <button type="button" className={STRIP_BUTTON} onClick={vocalRecorder.retake} aria-label="Ще раз" title="Ще раз">
        <RotateCcw className="size-5" />
      </button>
      <button type="button" className={STRIP_BUTTON} onClick={vocalRecorder.discard} aria-label="Скасувати" title="Скасувати">
        <X className="size-5" />
      </button>
      <button
        type="button"
        className={cn(STRIP_BUTTON, "w-auto gap-1 bg-primary px-2.5 text-sm font-semibold text-primary-foreground")}
        onClick={vocalRecorder.save}
        aria-label="Зберегти ноти"
        title="Зберегти ноти"
      >
        <Check className="size-5" /> {draft.notes.length}
      </button>
    </div>
  );
}
