import React from "react";
import {DocumentArrowDownIcon} from "@heroicons/react/24/outline";

import {Button} from "@/components/ui/button";
import {createDocument} from "../../services";
import {getActiveSongEditor} from "../SlateLyricsPlayground/songEditorRegistry";
import {useCurrentUsername} from "../SlateLyricsPlayground/elements/hooks";
import CopySong from "./CopySong/CopySong";
import DeleteSong from "./DeleteSong/DeleteSong";

/**
 * Дії з піснею — низ стовпчика меню пісні (`APP-27`). Лише іконки: стовпчик
 * може висіти над піснею постійно, і підписи накривали б удвічі більше
 * тексту. Назву кожна дія має в `aria-label`/`title`.
 */
export const SongActions = () => {
  const username = useCurrentUsername();

  return (
    <>
      <CopySong />
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => createDocument(getActiveSongEditor(), username)}
        aria-label="Завантажити .docx"
        title="Завантажити .docx"
      >
        <DocumentArrowDownIcon className="size-6" />
      </Button>
      <DeleteSong />
    </>
  );
}
