import { StickyNote } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import {
  useNotesViewers,
  useSetNotesAudience,
} from "../../../redux/selectors";
import { useCurrentUsername } from "../elements/hooks";
import { useBandMembers } from "./useBandMembers";

/**
 * Чиї примітки я зараз бачу й редагую. Живе у верхній панелі (`SongControls`)
 * поряд з перемикачем режимів і показується лише в режимі приміток.
 *
 * Вибір МНОЖИННИЙ (`NOTE-18`): відмітивши трьох вокалістів, я бачу те, що
 * бачить кожен з трьох, а нова примітка стає ОДНИМ записом, адресованим усім
 * трьом. «Мої» — така сама галочка, як інші: себе в адресати неявно ніхто не
 * дописує. Знята остання галочка нормалізується назад у мене (`NOTE-19`), тож
 * порожнього екрана без пояснення не буває.
 *
 * Форма — кругла кнопка 36px, як `ConnectionStatus`: у панелі на 375px вільно
 * лишається ~70px. Один чужий — перша літера ніка, кілька — їхня кількість;
 * повний перелік однаково за один тап у меню.
 *
 * TODO: коли зʼявляться ролі, тут же гейтити доступ до чужих приміток —
 * зараз редагувати примітки одне одного можуть усі члени гурту.
 */
export const NotesAudienceSelect = () => {
  const me = useCurrentUsername();
  const viewers = useNotesViewers();
  const setAudience = useSetNotesAudience();
  const members = useBandMembers();

  // Інші члени гурту, окрім мене. Немає кого вибирати (соло-гурт або список
  // не приїхав) — не показуємо перемикач узагалі (`NOTE-23`).
  const others = members
    .map((m) => m.username)
    .filter((username): username is string => !!username && username !== me);
  if (!me || others.length === 0) return null;

  // Порядок галочок, а не порядок кліків: так `visibleFor` у документі
  // виглядає однаково, хто б і в якій послідовності його не відмічав.
  const ordered = [me, ...others];
  const toggle = (username: string) => {
    const next = new Set(viewers);
    if (!next.delete(username)) next.add(username);
    setAudience(ordered.filter((u) => next.has(u)));
  };

  const viewingSelf = viewers.length === 1 && viewers[0] === me;
  const label = viewingSelf
    ? "Мої примітки"
    : viewers.length === 1
      ? `Примітки учасника ${viewers[0]}`
      : `Примітки: ${viewers.join(", ")}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
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
            {viewers.length === 1 ? viewers[0].trim().charAt(0) : viewers.length}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>Чиї примітки показувати</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ordered.map((username) => (
          <DropdownMenuCheckboxItem
            key={username}
            checked={viewers.includes(username)}
            // Меню лишається відкритим: відмітити трьох вокалістів — це три
            // тапи поспіль, а не три відкривання дропдауна.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => toggle(username)}
          >
            {username === me ? "Мої" : username}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
