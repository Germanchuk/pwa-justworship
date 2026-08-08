import { useSlate } from "slate-react";
import { MusicalNoteIcon, ChatBubbleBottomCenterTextIcon } from "@heroicons/react/24/outline";

import { Switch } from "@/components/ui/switch";
import { useCurrentUsername } from "../elements/hooks";
import type { DisplayFilter } from "./model";
import { setFilterHidden } from "./operations";
import { useDisplay } from "./useDisplay";
import "./DisplayToggles.css";

const FILTERS: {
  key: DisplayFilter;
  label: string;
  Icon: typeof MusicalNoteIcon;
}[] = [
  { key: "lyrics", label: "Слова", Icon: ChatBubbleBottomCenterTextIcon },
  { key: "chords", label: "Акорди", Icon: MusicalNoteIcon },
];

/**
 * Перемикачі «приховати слова / приховати акорди». Стан per-user і живе в
 * документі (`song-meta-row`) — див. `model.ts`.
 *
 * Стоять у мета-рядку поруч із капо: це той самий клас налаштувань — те, як
 * пісню бачить конкретний музикант, а не спільний вміст. Тому й вигляд той
 * самий, що в капо: бейдж + свіч. Свіч = видимість (увімкнено → показано).
 *
 * Поза читанням фільтри не діють (таблиця в `mode.tsx`), тож свічі показують
 * ефективний стан — усе видно — і не приймають кліків: збережене значення
 * лишається в документі й повертається при виході в читання.
 */
export const DisplayToggles = () => {
  const editor = useSlate();
  const username = useCurrentUsername();
  const { state, stored, filtersApply } = useDisplay();

  return (
    <span contentEditable={false} className="display-toggles">
      {FILTERS.map(({ key, label, Icon }) => {
        const hidden = key === "chords" ? state.chordsHidden : state.lyricsHidden;
        const storedHidden =
          key === "chords" ? stored.chordsHidden : stored.lyricsHidden;
        const toggle = () => {
          if (!filtersApply) return;
          setFilterHidden(editor, username, key, !hidden);
        };
        const title = !filtersApply
          ? `Поза режимом читання показано все; збережено: ${label.toLowerCase()} ${
              storedHidden ? "приховані" : "видно"
            }`
          : hidden
            ? `Показати ${label.toLowerCase()}`
            : `Приховати ${label.toLowerCase()} (перші рядки секцій лишаться)`;

        return (
          <span key={key} className="song-meta-line">
            <span
              className={`song-meta-badge display-toggle ${
                filtersApply ? "" : "song-meta-badge--readonly song-meta-badge--inert"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggle}
              title={title}
            >
              <Icon />
              <span className="song-meta-badge__label">{label}</span>
            </span>

            <span
              className="ml-1.5 inline-flex"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Switch
                checked={!hidden}
                disabled={!filtersApply}
                onCheckedChange={toggle}
                aria-label={label}
                title={title}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
};
