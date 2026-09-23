import { BookOpen, Pencil, StickyNote } from "lucide-react";

import { cn } from "@/lib/utils";

import { useSetSongMode, useSongMode, type SongMode } from "../../../mode";
import { MENU_GROUP, MENU_GROUP_ITEM } from "../tile";

export const MODES: { key: SongMode; label: string; Icon: typeof BookOpen }[] = [
  { key: "read", label: "Читання — програвання акордів", Icon: BookOpen },
  { key: "edit", label: "Редагування пісні", Icon: Pencil },
  { key: "notes", label: "Примітки — виділення й коментарі", Icon: StickyNote },
];

/**
 * Перемикач режимів пісні — по суті навігація: кожен режим має свій шлях.
 * Лишається локальним для користувача: сусіди по бенду ходять своїми URL і
 * можуть бути в інших режимах у тій самій пісні, документ у всіх однаково
 * живе через websocket.
 *
 * Стоїть стовпчиком угорі меню пісні (`MODE-2`, `APP-27`). Одна скляна плашка
 * на три плитки показує, що це ОДИН перемикач, а не три окремі кнопки; за
 * шириною плашка збігається з рештою кнопок меню (`MENU_TILE`, 44px).
 */
export const ModeSwitch = () => {
  const mode = useSongMode();
  const setMode = useSetSongMode();

  return (
    <div
      role="radiogroup"
      aria-label="Режим пісні"
      className={cn(MENU_GROUP, "flex-col")}
    >
      {MODES.map(({ key, label, Icon }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setMode(key)}
            className={cn(
              // Режим перемикають пальцем на сцені, і дрібна ціль тут коштує
              // найдорожче — 36px, у плашці разом 44px, як решта кнопок меню.
              MENU_GROUP_ITEM,
              "inline-flex items-center justify-center transition-colors cursor-pointer",
              active
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-5" />
          </button>
        );
      })}
    </div>
  );
};
