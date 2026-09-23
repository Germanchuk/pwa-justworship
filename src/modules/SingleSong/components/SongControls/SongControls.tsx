import React, {useEffect, useState} from "react";
import {ArrowLeftIcon} from "@heroicons/react/24/outline";
import {Loader2, Sparkles, X} from "lucide-react";
import {useSelector} from "react-redux";
import {useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {bandPath} from "#constants/routes";
import {useBandId} from "#modules/Band/BandLayout";
import DronePlayer from "../../services/DronePlayer/DronePlayer";
import {useCanAnnotate, useCanPlay} from "../../mode";
import {useConnectionIndicator} from "../ConnectionStatus/useConnectionIndicator";
import {NotesAudienceSelect} from "../SlateLyricsPlayground/comments/NotesAudienceSelect";
import {ModeSwitch} from "./ModeSwitch/ModeSwitch";
import {PlaybackControls} from "./PlaybackControls";
import {SongActions} from "./SongActions";
import {SongMenuSlot} from "./menuSlot";
import {MENU_TILE} from "./tile";

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
 * місце віддане пісні. Окрема кнопка — скляна плитка (`MENU_TILE`); кнопки,
 * що діють разом (перемикач режимів), — одна плашка зі спільним фоном
 * (`MENU_GROUP`).
 *
 *   закрито:      [←]  [✦]
 *                      [📖]   ← лише поточний режим
 *
 *   відкрито: [←]  [✕]
 *                      [📖]
 *                      [✏️]   ← той самий перемикач, розгорнутий
 *                      [🗒]
 *
 *                      [⋯]    ← дії з піснею (нативний список)
 *                      [⏻]    ← кнопка режиму: дрон у читанні, адресат
 *                               у примітках, у редагуванні нічого
 *
 *                      [🖍]   ← слот: палітра / меню позначки (`SongMenuSlot`)
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
      // Один проміжок між усіма групами кнопок — і в рядку, і в стовпчику.
      className="fixed right-2 z-40 flex flex-col items-end gap-2"
      style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <div className="flex items-center gap-2">
        <BackButton />
        <MenuButton open={open} onToggle={() => setOpen((value) => !value)} />
      </div>

      <ModeSwitch expanded={open} />
      {open && <SongActions />}
      {open && <ModeActions />}

      <SongMenuSlot />
    </div>
  );
};

/**
 * Кнопка поточного режиму — окрема плитка під «⋯»: дрон у читанні
 * (`PLAY-2`), адресат приміток у примітках, у редагуванні нічого.
 */
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
      className={MENU_TILE}
      onClick={goBack}
      aria-label="Назад"
      title="Назад"
    >
      {isLoading ? (
        <Loader2 className="size-7 animate-spin" />
      ) : (
        <ArrowLeftIcon className="size-7" />
      )}
    </Button>
  );
};

/**
 * Кнопка меню: ✦ — закрите, ✕ — відкрите (`APP-26`). Режиму вона не показує —
 * він висить під нею окремо (`ModeSwitch`). Колір її рамки — стан звʼязку
 * (`COLLAB-5`): кнопка видна завжди, тож і звʼязок видно завжди.
 */
const MenuButton = ({ open, onToggle }: { open: boolean; onToggle: () => void }) => {
  const connection = useConnectionIndicator();
  const Icon = open ? X : Sparkles;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(MENU_TILE, open && "bg-accent")}
        style={connection.color ? { borderColor: connection.color } : undefined}
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Сховати меню пісні" : "Меню пісні"}
        title={open ? "Сховати меню пісні" : "Меню пісні"}
      >
        <Icon className="size-6" />
      </Button>
      <span className="sr-only" role="status">
        {connection.label}
      </span>
    </>
  );
};
