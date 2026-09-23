import React, {useRef, type ChangeEvent} from "react";
import {EllipsisHorizontalIcon} from "@heroicons/react/24/outline";

import {buttonVariants} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {createDocument} from "../../services";
import {useCanEditContent} from "../../mode";
import {getActiveSongEditor} from "../SlateLyricsPlayground/songEditorRegistry";
import {useCurrentUsername} from "../SlateLyricsPlayground/elements/hooks";
import {useCopySong} from "./CopySong/CopySong";
import DeleteSongDialog from "./DeleteSong/DeleteSong";
import {MENU_TILE} from "./tile";

/**
 * Дії з піснею — «⋯» під перемикачем режимів (`APP-27`). Список — нативний
 * `<select>` браузера: на iOS це системний пікер, який не треба ні верстати,
 * ні вчити. Сам `<select>` прозорий і лежить поверх іконки, тож тап по «⋯»
 * відкриває саме його.
 *
 * `value` завжди "" — вибір лише запускає дію й одразу скидається, тож той
 * самий пункт можна вибрати й удруге.
 */
export const SongActions = () => {
  const username = useCurrentUsername();
  const copySong = useCopySong();
  const canDelete = useCanEditContent();
  const deleteDialog = useRef<HTMLDialogElement>(null);

  const run = (event: ChangeEvent<HTMLSelectElement>) => {
    switch (event.target.value) {
      case "copy":
        copySong();
        break;
      case "docx":
        createDocument(getActiveSongEditor(), username);
        break;
      case "delete":
        deleteDialog.current?.showModal();
        break;
    }
  };

  return (
    <>
    <div
      className={cn(
        buttonVariants({variant: "ghost", size: "icon"}),
        MENU_TILE,
        "relative focus-within:ring-[3px] focus-within:ring-ring/50",
      )}
    >
      <EllipsisHorizontalIcon className="size-6" />
      <select
        value=""
        onChange={run}
        aria-label="Дії з піснею"
        title="Дії з піснею"
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        <option value="" disabled>Дії з піснею</option>
        <option value="copy">Скопіювати пісню</option>
        <option value="docx">Завантажити .docx</option>
        {canDelete && <option value="delete">Видалити пісню</option>}
      </select>
    </div>
    {/* Поза кнопкою: інакше діалог успадкував би її стилі тексту. */}
    {canDelete && <DeleteSongDialog dialogRef={deleteDialog} />}
    </>
  );
};
