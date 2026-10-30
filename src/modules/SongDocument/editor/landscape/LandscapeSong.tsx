/**
 * Горизонтальний формат пісні на телефоні (лежачи) — окремий вигляд на весь
 * екран, поверх звичайних барів (`SONG-98`). Згори — постійна панель: назад,
 * назва пісні (тап — уся мета-дата пісні окремою шторкою, щоб не забирала
 * місце в пісні), програвання доріжок, дрон, «⋯», перемикач режимів. Під нею
 * — сама пісня однією смугою (`Strip`), прокрутка вбік.
 *
 * Людина бачить структурну примітку, що пливе за піснею, поки триває її
 * частина, рядок пісні й свою доріжку. Програвання — та сама голка, що й у
 * звичайному вигляді: риска через усю смугу, а смуга їде за нею.
 *
 * Поки лише перегляд; перенесення в цей формат — щоб звільнити місце для
 * майбутньої правки.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ChevronDown, Crosshair, Play, Repeat, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { barSpot } from "#layout/BottomBar/path";
import { useCanEditContent, useCapoApplies, useSetSongMode, useSongMode } from "#modules/SingleSong/mode";
import { useNotesViewers } from "#modules/SingleSong/redux/selectors";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import { MODES } from "#modules/SingleSong/components/SongControls/ModeSwitch/ModeSwitch";
import { PlaybackControls } from "#modules/SingleSong/components/SongControls/PlaybackControls";
import { SongActions } from "#modules/SingleSong/components/SongControls/SongActions";
import { CELL_KINDS, readCapo, readHiddenLanes, readMeta, readTempo, readZoom, resolveNotes, songLanes, Song } from "../../model";
import { shownLanes } from "../../bridge/projection";
import { lanePlayer } from "../../playback/player";
import { linePlan, nextLine, Span } from "../../playback/timeline";
import { SongHeader } from "../header/SongHeader";
import { getPlayMark, onPlayMark, setPlayMark } from "../playback/mark";
import { TempoMenu } from "../playback/Transport";
import { useDocVersion } from "../useLinesDoc";
import { useHealSlots } from "../useHealSlots";
import { STRIP_GUTTER, Strip } from "./Strip";
import { BAR_PX, STEP_PX } from "../elements/stepGeometry";

/** Кнопки меню пісні тут менші: висота екрана лежачи — на вагу золота. */
const SMALL_TILES = "[&_.size-13]:size-10 [&_.size-13]:rounded-[14px] [&_svg]:max-h-6 [&_svg]:max-w-6";
const BUTTON = "inline-flex size-10 shrink-0 items-center justify-center rounded-[14px] glass";

export function LandscapeSong({ song }: { song: Song }) {
  useDocVersion(song.doc);
  useHealSlots(song);
  const me = useCurrentUsername() ?? null;
  const canEdit = useCanEditContent();
  const capoApplies = useCapoApplies();
  const viewers = useNotesViewers();
  const [metaOpen, setMetaOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const meta = readMeta(song.doc);
  const zoom = me ? readZoom(song.doc, me) : undefined;
  const hidden = me ? readHiddenLanes(song.doc, me) : [];
  const lanes = shownLanes(song, { words: !hidden.includes("words"), chords: !hidden.includes("chords"), hidden, zoom });
  const capo = me ? readCapo(song.doc, me) : { fret: 0, off: false };
  const notes = resolveNotes(song, viewers, (_, lane) => lanes.includes(lane));

  // Сторінка під цим виглядом не гортається.
  useEffect(() => {
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => void (html.style.overflow = was);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#f8f5eb", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      <header className={cn("relative flex shrink-0 items-center gap-1.5 px-1.5 py-1", SMALL_TILES)}>
        <BackButton />
        <button
          type="button"
          onClick={() => setMetaOpen((v) => !v)}
          aria-expanded={metaOpen}
          className="flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 text-left hover:bg-black/5"
          title="Про пісню"
        >
          <span className="truncate text-base font-bold text-[#1e3a8a]">{meta.name || "Без назви"}</span>
          <ChevronDown className={cn("size-4 shrink-0 text-stone-500 transition-transform", metaOpen && "rotate-180")} />
        </button>
        <div className="flex-1" />
        <LandscapeTransport song={song} me={me} scroller={scroller} />
        <PlaybackControls />
        <SongActions />
        <ModeToggle />
      </header>
      {metaOpen && (
        <div className="absolute inset-x-1.5 top-12 z-10 max-h-[70dvh] overflow-auto rounded-xl border border-stone-200 bg-[#f8f5eb] p-2 shadow-lg">
          <SongHeader song={song} me={me} canEdit={canEdit} capoApplies={capoApplies} change={(fn) => song.doc.transact(fn)} />
          {canEdit && <p className="mt-1 text-xs text-stone-500">Тут поки лише перегляд: правити — у вертикальному положенні.</p>}
        </div>
      )}
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto overscroll-contain" onClick={() => metaOpen && setMetaOpen(false)}>
        <Strip song={song} me={me} lanes={lanes} zoom={zoom} capo={capoApplies && !capo.off ? capo.fret : 0} notes={notes} />
      </div>
    </div>
  );
}

/** Перемикач режимів — у рядок: панель лежачи низька. */
function ModeToggle() {
  const mode = useSongMode();
  const setMode = useSetSongMode();
  return (
    <div role="radiogroup" aria-label="Режим пісні" className="glass flex items-center gap-0.5 rounded-[14px] p-0.5">
      {MODES.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={mode === key}
          aria-label={label}
          title={label}
          onClick={() => setMode(key)}
          className={cn("inline-flex size-9 items-center justify-center rounded-[11px]", mode === key ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
        >
          <Icon className="size-5" />
        </button>
      ))}
    </div>
  );
}

/** «Назад» — як у нижньому барі, якого тут не видно. */
function BackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fallback = barSpot(pathname).back;
  return (
    <button
      type="button"
      aria-label="Назад"
      className={BUTTON}
      onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : fallback && navigate(fallback))}
    >
      <ArrowLeftIcon className="size-5" />
    </button>
  );
}

/**
 * Програвання доріжок у смузі: звідки грати — тап по таймлайну рядка, без
 * нього — перший рядок біля лівого краю. Голка — риска через усю смугу; смуга
 * їде за нею, доки людина не погортає сама (⌖ повертає).
 */
function LandscapeTransport({ song, me, scroller }: { song: Song; me: string | null; scroller: React.RefObject<HTMLDivElement | null> }) {
  const state = useSyncExternalStore(lanePlayer.listen, lanePlayer.getState);
  const loop = useSyncExternalStore(lanePlayer.listen, lanePlayer.loop);
  const [count, setCount] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;
  const hidden = () => (me ? readHiddenLanes(song.doc, me) : []);
  const percent = () => (me ? readTempo(song.doc, me) : 100);

  /** Перший рядок, що видно біля лівого краю смуги. */
  const leftLine = () => {
    const box = scroller.current?.getBoundingClientRect();
    const rows = Array.from(scroller.current?.querySelectorAll<HTMLElement>("[data-strip-line]") ?? []);
    const hit = box && rows.find((r) => r.getBoundingClientRect().right > box.left + STRIP_GUTTER + 8);
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
      lanePlayer.stop();
      setPlayMark(null);
    },
    [song],
  );
  // Тап по таймлайну під час гри — грати звідти.
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
    const el = scroller.current;
    if (state === "idle" || !el) return;
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
    const el = scroller.current;
    if (state === "idle" || !el) return;
    let raf = 0;
    let shownCount: number | null = null;
    const needleEl = () => el.querySelector<HTMLElement>("[data-strip-needle]");
    const frame = () => {
      const left = lanePlayer.countLeft();
      if (left !== shownCount) setCount((shownCount = left));
      const needle = lanePlayer.needle();
      const ruler = needle && el.querySelector<HTMLElement>(`[data-strip-line="${needle.line}"]`);
      const n = needleEl();
      if (n && ruler && needle) {
        const cells = Number(ruler.dataset.cells);
        const cellTicks = Number(ruler.dataset.cellTicks);
        const bar = Number(ruler.dataset.barTicks);
        const b = Math.floor(needle.tick / bar);
        const within = needle.tick - b * bar;
        const x = ruler.offsetLeft + b * (BAR_PX + cells * STEP_PX) + BAR_PX + (within / cellTicks) * STEP_PX;
        n.style.display = "block";
        n.style.left = `${x}px`;
        if (followRef.current && (x < el.scrollLeft + STRIP_GUTTER + 16 || x > el.scrollLeft + el.clientWidth * 0.75)) {
          el.scrollLeft = Math.max(0, x - STRIP_GUTTER - el.clientWidth * 0.2);
        }
      } else if (n) n.style.display = "none";
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      const n = needleEl();
      if (n) n.style.display = "none";
      setCount(null);
    };
  }, [state, scroller]);

  if (!songLanes(song.doc).some((l) => (CELL_KINDS as readonly string[]).includes(l.kind))) return null;
  const playing = state !== "idle";
  const toggleLoop = () => {
    if (loop) return lanePlayer.setLoop(null);
    const line = lanePlayer.needle()?.line;
    const plan = line !== undefined ? linePlan(song, line, hidden()) : null;
    if (line !== undefined && plan) lanePlayer.setLoop({ line, from: 0, to: plan.length });
  };
  return (
    <div className="flex items-center gap-1">
      {playing && !follow && (
        <button type="button" className={BUTTON} onClick={() => setFollow(true)} aria-label="До голки" title="До голки">
          <Crosshair className="size-5" />
        </button>
      )}
      {playing && (
        <>
          <button
            type="button"
            className={cn(BUTTON, loop && "bg-primary text-primary-foreground")}
            onClick={toggleLoop}
            aria-pressed={!!loop}
            aria-label="Повтор"
            title={loop ? "Без повтору" : "Повторювати цей рядок"}
          >
            <Repeat className="size-5" />
          </button>
          <TempoMenu song={song} me={me} className={BUTTON} side="bottom" />
        </>
      )}
      <button
        type="button"
        className={cn(BUTTON, playing && "bg-primary text-primary-foreground")}
        onClick={() => (playing ? lanePlayer.stop() : play(spanFrom(getPlayMark() ?? leftLine())))}
        aria-label={playing ? "Зупинити" : "Грати доріжки"}
        title={playing ? "Зупинити" : "Грати доріжки"}
      >
        {count !== null ? <span className="text-base font-bold">{count}</span> : playing ? <Square className="size-4" fill="currentColor" /> : <Play className="size-5" />}
      </button>
    </div>
  );
}

