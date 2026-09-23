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
 * Стоїть під кнопкою меню пісні ЗАВЖДИ (`MODE-2`, `APP-26`): у закритому меню
 * — лише іконка поточного режиму, у відкритому решта режимів виїжджає й
 * плашка стає повним перемикачем. Одна скляна плашка показує, що це ОДИН
 * перемикач, а не три окремі кнопки; за шириною вона збігається з рештою
 * кнопок меню (`MENU_TILE`, 52px).
 *
 * Згортання — рядок сітки `1fr → 0fr`: висоту кнопки знати не треба, а
 * перехід плавний. Сховані режими `inert` — ні тапом, ні табом їх не дістати.
 */
export const ModeSwitch = ({ expanded }: { expanded: boolean }) => {
  const mode = useSongMode();
  const setMode = useSetSongMode();

  return (
    <div
      role="radiogroup"
      aria-label="Режим пісні"
      className={cn(MENU_GROUP, "flex-col gap-0")}
    >
      {MODES.map(({ key, label, Icon }, index) => {
        const active = mode === key;
        const shown = expanded || active;
        return (
          <div
            key={key}
            aria-hidden={!shown}
            // React 18 не знає `inert` як булевий проп — лише рядком.
            {...(shown ? {} : { inert: "" })}
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
              shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            {/* Проміжок між режимами — лише в розгорнутому: у згорнутому
                він лишився б над єдиною видимою іконкою. */}
            <div className={cn("min-h-0 overflow-hidden", expanded && index > 0 && "pt-0.5")}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={label}
                title={label}
                onClick={() => setMode(key)}
                className={cn(
                  // Режим перемикають пальцем на сцені, і дрібна ціль тут коштує
                  // найдорожче — 44px, у плашці разом 52px, як решта кнопок меню.
                  MENU_GROUP_ITEM,
                  "inline-flex items-center justify-center transition-colors cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-6" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
