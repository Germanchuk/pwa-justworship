/**
 * Програвання доріжок у смузі (`PLAY-50`) — і лежачи на телефоні, і на ПК.
 * Звідки грати — тап по таймлайну рядка, без нього — перший видимий рядок
 * (лежачи — біля лівого краю, на ПК — згори). Голка — риска через усю смугу
 * рядка, що грає; смуга плавно пливе під нею (`followNeedle`; на ПК — ще й
 * сторінка до смуги), доки людина не погортає сама (⌖ повертає).
 *
 * Повтор (↻) — перемикач, і до старту: з ним ▶ крутить рядок старту, тап по
 * таймлайну переносить коло туди, а ■ повтору не знімає.
 *
 * `scroller` — контейнер однієї смуги (лежачи); без нього гортається сторінка,
 * а кожна смуга-рядок — сама вбік (ПК).
 */
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Crosshair, Play, Repeat, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { CELL_KINDS, readHiddenLanes, readTempo, songLanes, Song } from "../../model";
import { lanePlayer } from "../../playback/player";
import { linePlan, nextLine, Span } from "../../playback/timeline";
import { followNeedle, frameClock } from "../playback/follow";
import { getPlayMark, onPlayMark, setPlayMark } from "../playback/mark";
import { TempoMenu } from "../playback/Transport";
import { BAR_PX, STEP_PX } from "../elements/stepGeometry";
import { STRIP_GUTTER } from "./Strip";

export const STRIP_BUTTON = "inline-flex size-10 shrink-0 items-center justify-center rounded-[14px] glass";
/** Згори сторінки на ПК — верхній бар, знизу — нижній: смуга, що грає, має бути між ними. */
const PAGE_TOP = 64;
const PAGE_BOTTOM = 112;

type Props = { song: Song; me: string | null; scroller?: RefObject<HTMLDivElement | null>; menuSide?: "top" | "bottom" };

export function StripTransport({ song, me, scroller, menuSide = "bottom" }: Props) {
  const state = useSyncExternalStore(lanePlayer.listen, lanePlayer.getState);
  const loop = useSyncExternalStore(lanePlayer.listen, lanePlayer.repeating);
  const [count, setCount] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;
  const hidden = () => (me ? readHiddenLanes(song.doc, me) : []);
  const percent = () => (me ? readTempo(song.doc, me) : 100);
  const root = () => scroller?.current ?? document;

  /** Перший рядок, якого видно таймлайн: лежачи — біля лівого краю, на ПК — згори. */
  const firstLine = () => {
    const box = scroller?.current?.getBoundingClientRect();
    const rows = Array.from(root().querySelectorAll<HTMLElement>("[data-strip-line]"));
    const hit = rows.find((r) => {
      const at = r.getBoundingClientRect();
      return box ? at.right > box.left + STRIP_GUTTER + 8 : at.top > PAGE_TOP - 8;
    });
    return hit ? Number(hit.dataset.stripLine) : 0;
  };
  const spanFrom = (line: number): Span | null => {
    const plan = linePlan(song, line, hidden());
    return plan ? { line, from: 0, to: plan.length } : (nextLine(song, line, hidden()) ?? nextLine(song, -1, hidden()));
  };
  const play = (from: Span | null) => {
    if (!from) return;
    setFollow(true);
    lanePlayer.start({ song, from, hidden, percent }).catch((error) => console.error("lane playback", error));
  };

  useEffect(
    () => () => {
      lanePlayer.reset();
      setPlayMark(null);
    },
    [song],
  );
  // Тап по таймлайну під час гри — грати звідти (з повтором — коло переїжджає туди).
  useEffect(
    () =>
      onPlayMark(() => {
        const mark = getPlayMark();
        if (mark !== null && lanePlayer.getState() !== "idle") play(spanFrom(mark));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [song, me],
  );
  // Гортаєш сам — стеження вимикається.
  useEffect(() => {
    const el: HTMLElement | Window = scroller?.current ?? window;
    if (state === "idle") return;
    const off = () => setFollow(false);
    el.addEventListener("wheel", off, { passive: true });
    el.addEventListener("touchmove", off, { passive: true });
    return () => {
      el.removeEventListener("wheel", off);
      el.removeEventListener("touchmove", off);
    };
  }, [state, scroller]);

  // Голка й стеження — цикл кадрів (позиція — з годинника аудіо).
  useEffect(() => {
    if (state === "idle") return;
    let raf = 0;
    let shownCount: number | null = null;
    let shown: HTMLElement | null = null;
    let lastLine: number | null = null;
    const clock = frameClock();
    const frame = (now: number) => {
      const dt = clock(now);
      const left = lanePlayer.countLeft();
      if (left !== shownCount) setCount((shownCount = left));
      const needle = lanePlayer.needle();
      const ruler = needle && root().querySelector<HTMLElement>(`[data-strip-line="${needle.line}"]`);
      const strip = ruler?.closest<HTMLElement>("[data-strip]");
      const n = strip?.querySelector<HTMLElement>("[data-strip-needle]") ?? null;
      if (shown && shown !== n) shown.style.display = "none";
      shown = n;
      if (n && ruler && needle && strip) {
        const cells = Number(ruler.dataset.cells);
        const cellTicks = Number(ruler.dataset.cellTicks);
        const bar = Number(ruler.dataset.barTicks);
        const b = Math.floor(needle.tick / bar);
        const within = needle.tick - b * bar;
        const x = ruler.offsetLeft + b * (BAR_PX + cells * STEP_PX) + BAR_PX + (within / cellTicks) * STEP_PX;
        n.style.display = "block";
        n.style.left = `${x}px`;
        // Смуга вбік — у своєму контейнері (лежачи — уся пісня, на ПК — рядок), плавно.
        const box = strip.parentElement;
        if (followRef.current && box) followNeedle(box, x, dt, STRIP_GUTTER);
        // На ПК — ще й сторінка до нового рядка, якщо він поза екраном.
        if (!scroller && followRef.current && needle.line !== lastLine) {
          const at = strip.getBoundingClientRect();
          if (at.top < PAGE_TOP || at.bottom > window.innerHeight - PAGE_BOTTOM) window.scrollBy({ top: at.top - window.innerHeight * 0.25, behavior: "smooth" });
        }
        lastLine = needle.line;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (shown) shown.style.display = "none";
      setCount(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, scroller]);

  if (!songLanes(song.doc).some((l) => (CELL_KINDS as readonly string[]).includes(l.kind))) return null;
  const playing = state !== "idle";
  return (
    <div className="flex items-center gap-1">
      {playing && !follow && (
        <button type="button" className={STRIP_BUTTON} onClick={() => setFollow(true)} aria-label="До голки" title="До голки">
          <Crosshair className="size-5" />
        </button>
      )}
      <button
        type="button"
        className={cn(STRIP_BUTTON, loop && "bg-primary text-primary-foreground")}
        onClick={() => lanePlayer.setLoop(!loop)}
        aria-pressed={loop}
        aria-label="Повтор"
        title={loop ? "Без повтору" : "Повторювати рядок"}
      >
        <Repeat className="size-5" />
      </button>
      {playing && <TempoMenu song={song} me={me} className={STRIP_BUTTON} side={menuSide} />}
      <button
        type="button"
        className={cn(STRIP_BUTTON, playing && "bg-primary text-primary-foreground")}
        onClick={() => (playing ? lanePlayer.stop() : play(spanFrom(getPlayMark() ?? firstLine())))}
        aria-label={playing ? "Зупинити" : "Грати доріжки"}
        title={playing ? "Зупинити" : "Грати доріжки"}
      >
        {count !== null ? <span className="text-base font-bold">{count}</span> : playing ? <Square className="size-4" fill="currentColor" /> : <Play className="size-5" />}
      </button>
    </div>
  );
}
