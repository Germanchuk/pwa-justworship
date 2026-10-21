import React, {useRef, useState} from "react";
import {EllipsisHorizontalIcon} from "@heroicons/react/24/outline";
import {ChevronRight} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {buttonVariants} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {AudienceItems, useAudience} from "#modules/SongDocument/editor/notes/NotesAudienceSelect";
import {setDynamicsPanel, useDynamicsPanel} from "#modules/SongDocument/editor/dynamics/panel";
import {createDocument} from "../../services";
import {useCanEditContent} from "../../mode";
import {getActiveSongEditor} from "../SlateLyricsPlayground/songEditorRegistry";
import {useCurrentUsername} from "../SlateLyricsPlayground/elements/hooks";
import {useCopySong} from "./CopySong/CopySong";
import DeleteSongDialog from "./DeleteSong/DeleteSong";
import {MENU_TILE} from "./tile";

/**
 * Дії з піснею — «⋯» під перемикачем режимів (`APP-27`). Випадне меню з
 * підменю (до 2026-10-21 — нативний `<select>`, але вкладених списків він не
 * вміє). Підменю розгортаються ВСЕРЕДИНІ меню, з відступом, а не окремими
 * випадними списками збоку: на вузькому екрані тим нема куди стати, і вони
 * закривались від найменшого руху.
 *
 *   Динаміка                 ← плаваюча панель фарбування (у будь-якому режимі)
 *   Скопіювати пісню
 *   Завантажити .docx
 *   Показ ▸ Від іншого користувача ▸ учасники з галочками
 *   Видалити пісню           ← лише в правці
 */
export const SongActions = () => {
  const username = useCurrentUsername();
  const copySong = useCopySong();
  const canDelete = useCanEditContent();
  const dynamics = useDynamicsPanel();
  const audience = useAudience();
  const deleteDialog = useRef<HTMLDialogElement>(null);
  /** Яке підменю розгорнуте: «Показ» чи ще й «Від іншого користувача» в ньому. */
  const [depth, setDepth] = useState(0);

  return (
    <>
      <DropdownMenu onOpenChange={(open) => !open && setDepth(0)}>
        <DropdownMenuTrigger
          aria-label="Дії з піснею"
          title="Дії з піснею"
          className={cn(buttonVariants({variant: "ghost", size: "icon"}), MENU_TILE)}
        >
          <EllipsisHorizontalIcon className="size-7" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="left" align="start" className="min-w-52">
          <DropdownMenuCheckboxItem checked={dynamics} onCheckedChange={(on) => setDynamicsPanel(!!on)}>
            Динаміка
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={copySong}>Скопіювати пісню</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => createDocument(getActiveSongEditor(), username)}>
            Завантажити .docx
          </DropdownMenuItem>
          {audience && (
            <>
              <Unfold open={depth >= 1} onToggle={() => setDepth(depth >= 1 ? 0 : 1)}>
                Показ
              </Unfold>
              {depth >= 1 && (
                <div className="pl-3">
                  <Unfold open={depth >= 2} onToggle={() => setDepth(depth >= 2 ? 1 : 2)}>
                    Від іншого користувача
                  </Unfold>
                  {depth >= 2 && (
                    <div className="pl-3">
                      <AudienceItems audience={audience} header={false} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => deleteDialog.current?.showModal()}>
                Видалити пісню
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Поза кнопкою: інакше діалог успадкував би її стилі тексту. */}
      {canDelete && <DeleteSongDialog dialogRef={deleteDialog} />}
    </>
  );
};

/** Пункт, що розгортає підменю під собою; меню при цьому лишається відкритим. */
const Unfold = ({open, onToggle, children}: {open: boolean; onToggle: () => void; children: React.ReactNode}) => (
  <DropdownMenuItem aria-expanded={open} onSelect={(e) => (e.preventDefault(), onToggle())}>
    <span className="flex-1">{children}</span>
    <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
  </DropdownMenuItem>
);
