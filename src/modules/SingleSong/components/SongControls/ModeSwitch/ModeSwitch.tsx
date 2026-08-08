import { BookOpen, Pencil, StickyNote } from "lucide-react";

import { cn } from "@/lib/utils";

import { useSetSongMode, useSongMode, type SongMode } from "../../../mode";

const MODES: { key: SongMode; label: string; Icon: typeof BookOpen }[] = [
  { key: "read", label: "Читання — програвання акордів", Icon: BookOpen },
  { key: "edit", label: "Редагування пісні", Icon: Pencil },
  { key: "notes", label: "Примітки — виділення й коментарі", Icon: StickyNote },
];

/**
 * Перемикач режимів пісні — по суті навігація: кожен режим має свій шлях.
 * Лишається локальним для користувача: сусіди по бенду ходять своїми URL і
 * можуть бути в інших режимах у тій самій пісні, документ у всіх однаково
 * живе через websocket.
 */
export const ModeSwitch = () => {
  const mode = useSongMode();
  const setMode = useSetSongMode();

  return (
    <div
      role="radiogroup"
      aria-label="Режим пісні"
      className="flex items-center gap-0.5 rounded-full border border-dashed border-input bg-background p-0.5"
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
              // Компактно: у шапці поруч ще статус, транспорт і "три крапки" —
              // на 375px усе має вміщатись в один рядок.
              "inline-flex size-7 items-center justify-center rounded-full transition-colors cursor-pointer",
              active
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
};
