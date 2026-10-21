/**
 * «Від іншого користувача» — чиїми очима я бачу й правлю примітки. Вибір
 * живе глибоко в меню пісні («⋯ → Показ → Від іншого користувача»); поки
 * дивлюсь не своїми очима, у стовпчику меню висить жовта плитка з тим самим
 * списком — стан, у якому легко забутись.
 *
 * Вибір МНОЖИННИЙ (`NOTE-18`): відмітивши трьох вокалістів, я бачу те, що
 * бачить кожен з трьох, а нова примітка стає ОДНИМ записом, адресованим усім
 * трьом. «Мої» — така сама галочка, як інші: себе в адресати неявно ніхто не
 * дописує. Знята остання галочка нормалізується назад у мене (`NOTE-19`), тож
 * порожнього екрана без пояснення не буває. Біля імені — числа (`NOTE-45`).
 *
 * TODO: коли зʼявляться ролі, тут же гейтити доступ до чужих приміток —
 * зараз редагувати примітки одне одного можуть усі члени гурту.
 */
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MENU_TILE } from "#modules/SingleSong/components/SongControls/tile";
import { useNotesViewers, useSetNotesAudience } from "#modules/SingleSong/redux/selectors";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import { useBandMembers } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/useBandMembers";
import { noteCounts } from "../../model";
import { useActiveSong } from "../activeSong";
import { useDocVersion } from "../useLinesDoc";

/** Хто є у виборі й хто відмічений. `null` — обирати нема з кого (`NOTE-23`). */
export function useAudience() {
  const me = useCurrentUsername();
  const viewers = useNotesViewers();
  const setAudience = useSetNotesAudience();
  const members = useBandMembers();
  // Інші члени гурту, окрім мене.
  const others = members.map((m) => m.username).filter((u): u is string => !!u && u !== me);
  if (!me || others.length === 0) return null;
  // Порядок галочок, а не кліків: так `visibleFor` у документі виглядає
  // однаково, хто б і в якій послідовності не відмічав.
  const ordered = [me, ...others];
  const toggle = (nick: string) => {
    const next = new Set(viewers);
    if (!next.delete(nick)) next.add(nick);
    setAudience(ordered.filter((u) => next.has(u)));
  };
  const viewingSelf = viewers.length === 1 && viewers[0] === me;
  return { me, viewers, ordered, toggle, viewingSelf };
}

/** Галочки учасників — у підменю «⋯» і в жовтій плитці. */
export function AudienceItems({ audience, header = true }: { audience: NonNullable<ReturnType<typeof useAudience>>; header?: boolean }) {
  const song = useActiveSong();
  return (
    <>
      {header && (
        <>
          <DropdownMenuLabel>Чиї примітки показувати</DropdownMenuLabel>
          <DropdownMenuSeparator />
        </>
      )}
      {audience.ordered.map((nick) => {
        const counts = song ? noteCounts(song, audience.viewers, nick) : null;
        return (
          <DropdownMenuCheckboxItem
            key={nick}
            checked={audience.viewers.includes(nick)}
            // Меню лишається відкритим: трьох вокалістів — три тапи поспіль.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => audience.toggle(nick)}
          >
            <span className="flex-1">{nick === audience.me ? "Мої" : nick}</span>
            {counts && (
              <span className="ml-3 text-xs tabular-nums text-muted-foreground">
                {counts.together} ({counts.own})
              </span>
            )}
          </DropdownMenuCheckboxItem>
        );
      })}
    </>
  );
}

/** Жовта плитка в меню, поки дивлюсь не своїми очима. */
export function ViewingAsTile() {
  const audience = useAudience();
  const song = useActiveSong();
  useDocVersion(song?.doc ?? null);
  if (!audience || audience.viewingSelf) return null;
  const { viewers } = audience;
  const label = viewers.length === 1 ? `Примітки учасника ${viewers[0]}` : `Примітки: ${viewers.join(", ")}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className={cn(
          MENU_TILE,
          "inline-flex items-center justify-center transition-colors cursor-pointer",
          "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200",
        )}
      >
        <span className="text-base font-semibold uppercase leading-none">
          {viewers.length === 1 ? viewers[0].trim().charAt(0) : viewers.length}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="start" className="min-w-48">
        <AudienceItems audience={audience} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
