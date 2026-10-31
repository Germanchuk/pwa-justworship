/**
 * Транспорт програвання доріжок (ADR-0009) — у читанні й у правці, справа
 * над нижнім баром, під великим пальцем. Є лише в пісні з клітинковими
 * доріжками: грати більше нічого.
 *
 *   не грає:  [↻] [▶]
 *   грає:     [⌖] [↻] [70 %] [■]     ⌖ — «до голки», коли стеження вимкнулось
 *
 * Звідки грати: у правці — від курсора-кроку (чи з рядка курсора); у
 * читанні — з рядка, по полю якого тапнули (`mark.ts`), а без позначки — з
 * рядка в центрі екрана. Тап по полю під час гри — грати звідти.
 *
 * Повтор (↻) — перемикач, і до старту: з ним ▶ крутить виділені кроки, а без
 * них — рядок старту; тап по полю переносить коло туди; ■ повтору не знімає.
 *
 * Голка — риска на кроках клітинкових доріжок рядка, що грає, і підсвічений
 * рядок. Її малює цикл кадрів прямо в DOM (React на кожен кадр — надто
 * дорого): позиція — з годинника аудіо (`lanePlayer.needle`). Екран іде за
 * голкою; торкнувся й гортаєш сам — стеження вимикається, «⌖» повертає.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Crosshair, Play, Repeat, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MENU_GROUP, MENU_GROUP_ITEM, MENU_TILE } from "#modules/SingleSong/components/SongControls/tile";
import { CELL_KINDS, cellSpan, layout, readHiddenLanes, readMeta, readTempo, readZoom, scaleOf, songLanes, Song, writeTempo } from "../../model";
import type { LaneView } from "../../bridge/laneView";
import { lanePlayer } from "../../playback/player";
import { linePlan, nextLine, Span } from "../../playback/timeline";
import { DYNAMICS_PANEL_BOTTOM } from "../dynamics/DynamicsPalette";
import { useDynamicsPanel } from "../dynamics/panel";
import { followNeedle, frameClock } from "./follow";
import { getPlayMark, onPlayMark, setPlayMark } from "./mark";
import { BAR_PX } from "../elements/stepGeometry";

const TEMPOS = [50, 60, 70, 80, 90, 100];
const PLAYING_CSS = ".song-row[data-playing] { background: rgba(250, 204, 21, 0.1); }";

type Props = { song: Song; lanes: LaneView; me: string | null; canEdit: boolean; cursorLine: number | null };

export function Transport({ song, lanes, me, canEdit, cursorLine }: Props) {
  const state = useSyncExternalStore(lanePlayer.listen, lanePlayer.getState);
  const loop = useSyncExternalStore(lanePlayer.listen, lanePlayer.repeating);
  const painting = useDynamicsPanel();
  const [count, setCount] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;

  const hidden = () => (me ? readHiddenLanes(song.doc, me) : []);
  const percent = () => (me ? readTempo(song.doc, me) : 100);

  /** Рядок у центрі екрана (на широкому — перший видимий у порядку читання). */
  const centerLine = () => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-song-editor] .song-row[data-line]"));
    const y = window.innerHeight * 0.4;
    const hit = rows.find((r) => {
      const { top, bottom } = r.getBoundingClientRect();
      return top <= y && bottom > y;
    });
    const visible = hit ?? rows.find((r) => r.getBoundingClientRect().bottom > 0);
    return visible ? Number(visible.dataset.line) : 0;
  };

  /** Звідки грати зараз (див. вище); рядок без часу — з наступного. */
  const startSpan = (): Span | null => {
    const lines = layout(song);
    const { timeSignature } = readMeta(song.doc);
    const cell = canEdit ? lanes.cells.cursor() : null;
    let line = 0;
    let tick = 0;
    if (cell) {
      line = lines.findIndex((l) => l.line === cell.line);
      tick = cellSpan(scaleOf(cell.kind, timeSignature, me ? readZoom(song.doc, me) : undefined), cell.at.step)[0];
    } else if (canEdit && cursorLine !== null) line = cursorLine;
    else line = getPlayMark() ?? centerLine();
    const plan = line >= 0 ? linePlan(song, line, hidden()) : null;
    if (plan && tick < plan.length) return { line, from: tick, to: plan.length };
    return nextLine(song, line, hidden()) ?? nextLine(song, -1, hidden());
  };

  /** Виділені кроки як проміжок рядка; немає виділення — `null`. */
  const selectionSpan = (): Span | null => {
    const sel = lanes.cells.selection();
    const line = sel ? layout(song).findIndex((l) => l.line === sel.line) : -1;
    return sel && line >= 0 ? { line, from: sel.from, to: sel.to } : null;
  };

  const play = (from: Span | null, loop?: Span) => {
    if (!from) return;
    setFollow(true);
    lanePlayer.start({ song, from, loop, hidden, percent }).catch((error) => console.error("lane playback", error));
  };
  /** ▶: з повтором і виділенням — крутити виділене, інакше — звідки грати зараз. */
  const playHere = () => {
    const sel = loop ? selectionSpan() : null;
    play(sel ?? startSpan(), sel ?? undefined);
  };

  // Пішли з пісні — тиша; позначка старту — лише для цієї пісні.
  useEffect(
    () => () => {
      lanePlayer.reset();
      setPlayMark(null);
    },
    [song],
  );

  // Тап по полю під час гри — грати звідти (з повтором — коло переїжджає туди).
  useEffect(
    () =>
      onPlayMark(() => {
        const mark = getPlayMark();
        if (mark === null || lanePlayer.getState() === "idle") return;
        const plan = linePlan(song, mark, hidden());
        play(plan ? { line: mark, from: 0, to: plan.length } : nextLine(song, mark, hidden()));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [song, me],
  );

  // Гортаєш сам — стеження вимикається.
  useEffect(() => {
    if (state === "idle") return;
    const off = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("[data-transport]")) return;
      setFollow(false);
    };
    window.addEventListener("wheel", off, { passive: true });
    window.addEventListener("touchmove", off, { passive: true });
    return () => {
      window.removeEventListener("wheel", off);
      window.removeEventListener("touchmove", off);
    };
  }, [state]);

  // Голка, підсвітка рядка, стеження, відлік — цикл кадрів.
  useEffect(() => {
    if (state === "idle") return;
    let raf = 0;
    let row: HTMLElement | null = null;
    let shownCount: number | null = null;
    const clear = () => {
      row?.removeAttribute("data-playing");
      row?.querySelectorAll<HTMLElement>("[data-needle]").forEach((n) => (n.style.display = "none"));
    };
    const clock = frameClock();
    const frame = (now: number) => {
      const dt = clock(now);
      const left = lanePlayer.countLeft();
      if (left !== shownCount) setCount((shownCount = left));
      const needle = lanePlayer.needle();
      const next = needle ? document.querySelector<HTMLElement>(`[data-song-editor] .song-row[data-line="${needle.line}"]`) : null;
      if (next !== row) {
        clear();
        row = next;
        if (row && followRef.current) row.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (row && needle) {
        row.setAttribute("data-playing", "");
        const scrollers = Array.from(row.querySelectorAll<HTMLElement>("[data-cell-scroll]"));
        scrollers.forEach((sc) => {
          const x = needleX(sc, needle.tick);
          const el = sc.querySelector<HTMLElement>("[data-needle]");
          if (!el || x === null) return;
          el.style.display = "block";
          el.style.left = `${x}px`;
          // Кроки пливуть під голкою — кожна доріжка рядка сама, до тієї самої голки.
          if (followRef.current) followNeedle(sc, x, dt);
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clear();
      setCount(null);
    };
  }, [state]);

  // Стеження повернули — одразу до голки.
  useEffect(() => {
    if (!follow) return;
    document.querySelector("[data-song-editor] .song-row[data-playing]")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [follow]);

  if (!songLanes(song.doc).some((l) => (CELL_KINDS as readonly string[]).includes(l.kind))) return null;

  const playing = state !== "idle";
  // Виділені кроки — їх по колу; інакше — рядок, що грає (чи, до старту, рядок старту).
  const toggleLoop = () => lanePlayer.setLoop(!loop, selectionSpan() ?? undefined);

  return (
    <div
      data-transport=""
      className="fixed right-2 z-40 flex items-center gap-2"
      style={{ bottom: painting ? `calc(${DYNAMICS_PANEL_BOTTOM} + 6.5rem)` : DYNAMICS_PANEL_BOTTOM }}
      onMouseDown={(e) => e.preventDefault()} // курсор і виділення в пісні лишаються — від них і грати
    >
      {playing && <style>{PLAYING_CSS}</style>}
      {playing && !follow && (
        <Button variant="ghost" size="icon" className={MENU_TILE} onClick={() => setFollow(true)} aria-label="До голки" title="До голки">
          <Crosshair className="size-6" />
        </Button>
      )}
      <div className={MENU_GROUP}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(MENU_GROUP_ITEM, loop && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}
          onClick={toggleLoop}
          aria-pressed={loop}
          aria-label="Повтор"
          title={loop ? "Без повтору" : "Повторювати виділене чи рядок"}
        >
          <Repeat className="size-5" />
        </Button>
        {playing && <TempoMenu song={song} me={me} className={MENU_GROUP_ITEM} side="top" />}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={cn(MENU_TILE, playing && "border-primary bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:text-primary-foreground")}
        onClick={() => (playing ? lanePlayer.stop() : playHere())}
        aria-label={playing ? "Зупинити" : "Грати доріжки"}
        title={playing ? "Зупинити" : "Грати доріжки"}
      >
        {count !== null ? <span className="text-lg font-bold">{count}</span> : playing ? <Square className="size-5" fill="currentColor" /> : <Play className="size-6" />}
      </Button>
    </div>
  );
}

/** Де на кроках доріжки тік `tick` (від початку рядка): px від початку її вмісту — з геометрії, без пошуку елементів. */
function needleX(sc: HTMLElement, tick: number): number | null {
  const cellTicks = Number(sc.dataset.cellTicks);
  const cells = Number(sc.dataset.cells);
  const bar = Number(sc.dataset.barTicks);
  const stepPx = Number(sc.dataset.stepPx);
  if (!cellTicks || !cells || !bar || !stepPx) return null;
  const b = Math.floor(tick / bar);
  const within = tick - b * bar;
  return b * (BAR_PX + cells * stepPx) + BAR_PX + (within / cellTicks) * stepPx;
}

/** Темп програвання у відсотках — особисте в пісні (`PLAY-55`). */
export function TempoMenu({ song, me, className, side }: { song: Song; me: string | null; className: string; side: "top" | "bottom" }) {
  const tempo = me ? readTempo(song.doc, me) : 100;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(className, "inline-flex items-center justify-center text-xs font-semibold")} aria-label={`Темп: ${tempo} %`} title="Темп">
        {tempo}%
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" className="min-w-36">
        <DropdownMenuLabel>Темп програвання</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={String(tempo)} onValueChange={(v) => me && song.doc.transact(() => writeTempo(song.doc, me, Number(v)))}>
          {TEMPOS.map((t) => (
            <DropdownMenuRadioItem key={t} value={String(t)} onSelect={(e) => e.preventDefault()}>
              {t} %
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
