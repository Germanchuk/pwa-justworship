import React, {useEffect, useState} from "react";
import {Sparkles, X} from "lucide-react";
import {useParams} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {bandPath} from "#constants/routes";
import {useBandId} from "#modules/Band/BandLayout";
import {BackButton} from "./BackButton";
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
  const bandId = useBandId();
  const { listId } = useParams();
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
        {/* Без історії — на рівень вище: у список, з якого пісню відкрили
            (`APP-37`), інакше в бібліотеку гурту. */}
        <BackButton
          fallback={listId ? bandPath.list(bandId, listId) : bandPath.songs(bandId)}
        />
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
