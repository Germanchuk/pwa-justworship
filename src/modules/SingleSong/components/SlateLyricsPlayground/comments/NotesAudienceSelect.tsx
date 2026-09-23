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
import { MENU_TILE } from "../../SongControls/tile";

import {
  useNotesViewers,
  useSetNotesAudience,
} from "../../../redux/selectors";
import { useCurrentUsername } from "../elements/hooks";
import { getActiveSongEditor } from "../songEditorRegistry";
import { useBandMembers } from "./useBandMembers";
import { countWithMember } from "./visibility";
import { listMarks } from "./withComments";

/**
 * Чиї примітки я зараз бачу й редагую. Окрема плитка під «⋯» у меню пісні
 * (`SongControls`), лише в режимі приміток.
 *
 * Вибір МНОЖИННИЙ (`NOTE-18`): відмітивши трьох вокалістів, я бачу те, що
 * бачить кожен з трьох, а нова примітка стає ОДНИМ записом, адресованим усім
 * трьом. «Мої» — така сама галочка, як інші: себе в адресати неявно ніхто не
 * дописує. Знята остання галочка нормалізується назад у мене (`NOTE-19`), тож
 * порожнього екрана без пояснення не буває.
 *
 * Форма — скляна плитка, як решта кнопок меню (`MENU_TILE`). Один чужий —
 * перша літера ніка, кілька — їхня кількість;
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
          MENU_TILE,
          "inline-flex items-center justify-center transition-colors cursor-pointer",
          viewingSelf
            ? "text-muted-foreground hover:bg-accent"
            : // Чужі примітки — стан, у якому легко забутись: підсвічуємо.
              "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200",
        )}
      >
        {viewingSelf ? (
          <StickyNote className="size-5" />
        ) : (
          <span className="text-base font-semibold uppercase leading-none">
            {viewers.length === 1 ? viewers[0].trim().charAt(0) : viewers.length}
          </span>
        )}
      </DropdownMenuTrigger>

      {/* Ліворуч від плитки: під нею може стояти палітра приміток. */}
      <DropdownMenuContent side="left" align="start" className="min-w-48">
        <DropdownMenuLabel>Чиї примітки показувати</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <AudienceItems
          ordered={ordered}
          viewers={viewers}
          me={me}
          onToggle={toggle}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Пункти списку з лічильниками (`NOTE-45`): біля кожного — скільки позначок
 * у нього разом з уже відміченими, а в дужках — скільки в нього особисто.
 * Окремий компонент, бо вміст
 * дропдауна існує лише поки він відкритий: документ перебираємо тоді ж, і
 * наново після кожної галочки.
 */
const AudienceItems = ({
  ordered,
  viewers,
  me,
  onToggle,
}: {
  ordered: string[];
  viewers: string[];
  me: string;
  onToggle: (username: string) => void;
}) => {
  // Редактор живе в іншому дереві (`songEditorRegistry`); поки його нема —
  // просто без чисел.
  const editor = getActiveSongEditor();
  const marks = editor ? listMarks(editor) : null;

  return (
    <>
      {ordered.map((username) => (
        <DropdownMenuCheckboxItem
          key={username}
          checked={viewers.includes(username)}
          // Меню лишається відкритим: відмітити трьох вокалістів — це три
          // тапи поспіль, а не три відкривання дропдауна.
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => onToggle(username)}
        >
          {username === me ? "Мої" : username}
          {marks && (
            <span className="ml-auto pl-4 text-xs tabular-nums text-muted-foreground">
              {countWithMember(marks, viewers, username)} (
              {countWithMember(marks, [], username)})
            </span>
          )}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  );
};
