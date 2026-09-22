import React, {useEffect, useState} from "react";
import {ArrowLeftIcon} from "@heroicons/react/24/outline";
import {Loader2} from "lucide-react";
import {useSelector} from "react-redux";
import {useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {bandPath} from "#constants/routes";
import {useBandId} from "#modules/Band/BandLayout";
import DronePlayer from "../../services/DronePlayer/DronePlayer";
import {useCanAnnotate, useCanPlay, useSongMode} from "../../mode";
import {useConnectionIndicator} from "../ConnectionStatus/useConnectionIndicator";
import {NotesAudienceSelect} from "../SlateLyricsPlayground/comments/NotesAudienceSelect";
import {MODES, ModeSwitch} from "./ModeSwitch/ModeSwitch";
import {PlaybackControls} from "./PlaybackControls";
import {SongActions} from "./SongActions";

/** Відкрите меню — налаштування пристрою (`APP-29`), за замовчуванням закрите. */
const MENU_STORAGE_KEY = "songMenuOpen";

function readMenuOpen() {
  try {
    return localStorage.getItem(MENU_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Навігація сторінки пісні (`APP-24`–`APP-29`): «назад» і кнопка меню, що
 * висять у правому верхньому куті поверх пісні. Постійної панелі тут немає —
 * місце віддане пісні.
 *
 *   закрито:     [←][📖]
 *   відкрито: [←][▶][📖]   ← кнопки поточного режиму
 *                    [📖]
 *                    [✏️]   ← перемикач режимів
 *                    [🗒]
 *                    [⧉] … ← дії з піснею
 *
 * Меню закривається ЛИШЕ своєю кнопкою (`APP-28`): вибір режиму, дія чи тап
 * повз нього панель не згортають — хто керує звуком, тримає її відкритою.
 */
export const SongControls = () => {
  const [open, setOpen] = useState(readMenuOpen);
  const canPlay = useCanPlay();

  useEffect(() => {
    try {
      localStorage.setItem(MENU_STORAGE_KEY, String(open));
    } catch {
      // приватний режим / заборонене сховище — стан просто не переживе сесію
    }
  }, [open]);

  // Вийшли з режиму читання — глушимо СВІЙ звук. Хоста не чіпаємо: він грає
  // для всього гурту, а не для цього екрана. Живе тут, а не біля кнопок
  // програвання: ті змонтовані лише у відкритому меню.
  useEffect(() => {
    if (!canPlay) DronePlayer.getInstance().stop();
  }, [canPlay]);

  return (
    <div
      className="fixed right-2 z-40 flex flex-col items-end gap-1"
      style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <div className="glass flex items-center gap-1 rounded-2xl p-1">
        <BackButton />
        {open && <ModeActions />}
        <MenuButton open={open} onToggle={() => setOpen((value) => !value)} />
      </div>

      {open && (
        <div className="glass flex flex-col items-center gap-1 rounded-2xl p-1">
          <ModeSwitch />
          <SongActions />
        </div>
      )}
    </div>
  );
};

/** Рядок меню: те, що стосується поточного режиму. У редагуванні — нічого. */
const ModeActions = () => {
  const canPlay = useCanPlay();
  const canAnnotate = useCanAnnotate();
  if (canPlay) return <PlaybackControls />;
  if (canAnnotate) return <NotesAudienceSelect />;
  return null;
};

/**
 * «Назад» туди, звідки прийшли (`APP-25`). `idx` — лічильник записів історії,
 * який веде сам роутер: 0 означає, що пісня — перший екран сесії (посилання,
 * старт застосунку), і крок назад вивів би із застосунку. Режими історії не
 * додають (`MODE-26`), тож і `idx` вони не зсувають.
 */
const BackButton = () => {
  const navigate = useNavigate();
  const bandId = useBandId();
  const isLoading = useSelector((state: any) => state.viewConfig.globalLoader);

  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) {
      navigate(-1);
    } else {
      navigate(bandPath.songs(bandId));
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={goBack}
      aria-label="Назад"
      title="Назад"
    >
      {isLoading ? (
        <Loader2 className="size-6 animate-spin" />
      ) : (
        <ArrowLeftIcon className="size-6" />
      )}
    </Button>
  );
};

/**
 * Кнопка меню несе те, що треба бачити й при закритому меню (`APP-26`):
 * іконку поточного режиму і стан звʼязку кольором рамки (`COLLAB-5`).
 */
const MenuButton = ({ open, onToggle }: { open: boolean; onToggle: () => void }) => {
  const mode = useSongMode();
  const connection = useConnectionIndicator();
  const Icon = MODES.find((item) => item.key === mode)!.Icon;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={cn("rounded-full transition-colors", open && "bg-accent")}
        style={connection.color ? { borderColor: connection.color } : undefined}
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Сховати меню пісні" : "Меню пісні"}
        title={open ? "Сховати меню пісні" : "Меню пісні"}
      >
        <Icon className="size-5" />
      </Button>
      <span className="sr-only" role="status">
        {connection.label}
      </span>
    </>
  );
};
