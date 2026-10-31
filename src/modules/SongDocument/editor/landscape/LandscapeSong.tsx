/**
 * Горизонтальний формат пісні на телефоні (лежачи) — окремий вигляд на весь
 * екран, поверх звичайних барів (`SONG-98`). Згори — постійна панель: назад,
 * назва пісні (тап — уся мета-дата пісні окремою шторкою, щоб не забирала
 * місце в пісні), програвання доріжок, дрон, «⋯», перемикач режимів. Під нею
 * — сама пісня однією смугою (`Strip`), прокрутка вбік.
 *
 * Людина бачить структурну примітку, що пливе за піснею, поки триває її
 * частина, рядок пісні й свою доріжку. Смуга й програвання — ті самі, що й на
 * ПК (`strip/`): там смуга лише розрізана по рядках.
 *
 * Правка — поки лише табів, дошкою ладів справа (`strip/StripCellEditor`);
 * решта — у вертикальному положенні. Примітки — в обох режимах, довгим
 * натиском на кроках (`strip/useStripSteps`): палітра й меню позначки — на тій
 * самій панелі справа, у правці на цей час замість дошки (`strip/StripNotes`).
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { barSpot } from "#layout/BottomBar/path";
import { useCanAnnotate, useCanEditContent, useCapoApplies, useSetSongMode, useSongMode } from "#modules/SingleSong/mode";
import { MODES } from "#modules/SingleSong/components/SongControls/ModeSwitch/ModeSwitch";
import { PlaybackControls } from "#modules/SingleSong/components/SongControls/PlaybackControls";
import { SongActions } from "#modules/SingleSong/components/SongControls/SongActions";
import { readMeta, Song, songLanes } from "../../model";
import { SongHeader } from "../header/SongHeader";
import { Strip } from "../strip/Strip";
import { STRIP_BUTTON, StripTransport } from "../strip/StripTransport";
import { useStripView } from "../strip/useStripView";
import { StripCellEditor } from "../strip/StripCellEditor";
import { StripNotes } from "../strip/StripNotes";
import { useStripSteps } from "../strip/useStripSteps";

/** Кнопки меню пісні тут менші: висота екрана лежачи — на вагу золота. */
const SMALL_TILES = "[&_.size-13]:size-10 [&_.size-13]:rounded-[14px] [&_svg]:max-h-6 [&_svg]:max-w-6";
/** Кнопки палітри й меню позначки — теж менші. */
const SMALL_ITEMS = "[&_.size-11]:size-9 [&_.size-11]:rounded-[11px] [&_svg]:max-h-5 [&_svg]:max-w-5";

export function LandscapeSong({ song }: { song: Song }) {
  const view = useStripView(song);
  const { me } = view;
  const canEdit = useCanEditContent();
  const canAnnotate = useCanAnnotate();
  const capoApplies = useCapoApplies();
  const [metaOpen, setMetaOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const meta = readMeta(song.doc);
  const tabsShown = songLanes(song.doc).some((l) => l.kind === "tab" && view.lanes.includes(l.id));
  // Примітки на кроках — лише в читанні: у правці тап по кроку ставить комірку для ладу.
  const sel = useStripSteps(scroller, { song, zoom: view.zoom, notes: view.notes, on: canAnnotate && !!me });
  const notesUi = !!me && (!!sel.steps || sel.picked.length > 0);

  // Сторінка під цим виглядом не гортається.
  useEffect(() => {
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => void (html.style.overflow = was);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#f8f5eb", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      {/* Межа панелі — явна лінія; тіні немає: вона лягала б на таймлайн. */}
      <header
        className={cn("relative z-[6] flex shrink-0 items-center gap-1.5 border-b border-stone-300 px-1.5 py-1", SMALL_TILES)}
        style={{ background: "#f8f5eb" }}
      >
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
        <StripTransport song={song} me={me} scroller={scroller} />
        <PlaybackControls />
        <SongActions />
        <ModeToggle />
      </header>
      {metaOpen && (
        <div className="absolute inset-x-1.5 top-12 z-10 max-h-[70dvh] overflow-auto rounded-xl border border-stone-200 bg-[#f8f5eb] p-2 shadow-lg">
          <SongHeader song={song} me={me} canEdit={canEdit} capoApplies={capoApplies} change={(fn) => song.doc.transact(fn)} />
          {canEdit && <p className="mt-1 text-xs text-stone-500">Лежачи поки правляться лише таби (дошка справа); решту — у вертикальному положенні.</p>}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div ref={scroller} className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain" onClick={() => metaOpen && setMetaOpen(false)}>
          <Strip song={song} {...view} steps={sel.steps} cardsEdit={canAnnotate && me ? { viewers: view.viewers, ...sel } : undefined} />
        </div>
        {/* Правка лежачи — поки таби: дошка ладів справа (`StripCellEditor`). */}
        {canEdit && tabsShown && <StripCellEditor song={song} me={me} scroller={scroller} paused={notesUi} />}
        {/* Палітра й меню позначки на виділених кроках — там само справа. */}
        {notesUi && me && (
          <div className="flex shrink-0 flex-col overflow-y-auto border-l border-stone-300 bg-[#f8f5eb] p-1.5">
            <StripNotes song={song} me={me} viewers={view.viewers} notes={view.notes} {...sel} className={SMALL_ITEMS} />
          </div>
        )}
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
      className={STRIP_BUTTON}
      onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : fallback && navigate(fallback))}
    >
      <ArrowLeftIcon className="size-5" />
    </button>
  );
}
