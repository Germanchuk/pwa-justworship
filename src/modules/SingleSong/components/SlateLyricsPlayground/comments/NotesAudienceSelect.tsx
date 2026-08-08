import { StickyNote } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import {
  useNotesAudience,
  useSetNotesAudience,
} from "../../../redux/selectors";
import { useCurrentUsername } from "../elements/hooks";
import { useBandMembers } from "./useBandMembers";

/**
 * Вибір, чиї примітки я зараз бачу й редагую. Живе у верхній панелі
 * (`SongControls`) поряд з перемикачем режимів і показується лише в режимі
 * приміток.
 *
 * Семантика одиночного вибору — "дивитись очима X": обравши учасника, я бачу
 * рівно те, що бачить він (його приватні + публічні), своїх приміток при цьому
 * не видно, а нові створюються для нього. Значення живе в `song.notesAudience`,
 * читається через `useNotesViewer`.
 *
 * Форма — кругла кнопка 36px, як `ConnectionStatus`: у панелі на 375px вільно
 * лишається ~70px, тож текстова плашка з ніком туди не влазить. Тому нік
 * стиснуто до першої літери, а повне імʼя живе в `title` і в самому меню.
 *
 * TODO: коли зʼявляться ролі, тут же гейтити доступ до чужих приміток —
 * зараз редагувати примітки одне одного можуть усі члени гурту.
 */
export const NotesAudienceSelect = () => {
  const me = useCurrentUsername();
  const audience = useNotesAudience();
  const setAudience = useSetNotesAudience();
  const members = useBandMembers();

  // Інші члени гурту, окрім мене. Немає кого вибирати (соло-гурт або список
  // не приїхав) — не показуємо перемикач узагалі.
  const others = members.filter((m) => m.username && m.username !== me);
  if (!me || others.length === 0) return null;

  const viewingSelf = audience === null || audience === me;
  const current = viewingSelf ? me : audience;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={
          viewingSelf ? "Мої примітки" : `Примітки учасника ${current}`
        }
        title={viewingSelf ? "Мої примітки" : `Примітки учасника ${current}`}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed transition-colors cursor-pointer",
          viewingSelf
            ? "border-input bg-background text-muted-foreground hover:bg-accent"
            : // Чужі примітки — стан, у якому легко забутись: підсвічуємо.
              "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200",
        )}
      >
        {viewingSelf ? (
          <StickyNote className="size-4" />
        ) : (
          <span className="text-sm font-semibold uppercase leading-none">
            {current?.trim().charAt(0)}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>Чиї примітки показувати</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          // Мій власний нік як значення пункту "Мої" — у стані він
          // нормалізується назад у `null` (= дефолт, дивлюсь своїми очима).
          value={viewingSelf ? me : (audience as string)}
          onValueChange={(value) => setAudience(value === me ? null : value)}
        >
          <DropdownMenuRadioItem value={me}>Мої</DropdownMenuRadioItem>
          {others.map((m) => (
            <DropdownMenuRadioItem key={m.username} value={m.username}>
              {m.username}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
