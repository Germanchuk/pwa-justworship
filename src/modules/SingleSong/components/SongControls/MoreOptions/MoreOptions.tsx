import {EllipsisVerticalIcon} from "@heroicons/react/24/solid";
import {Dropdown} from "#components";
import React, {useState} from "react";
import {createDocument} from "../../../services";
import {DocumentArrowDownIcon, MusicalNoteIcon} from "@heroicons/react/24/outline";
import {getActiveSongEditor} from "../../SlateLyricsPlayground/songEditorRegistry";
import {useCurrentUsername} from "../../SlateLyricsPlayground/elements/hooks";
import CopySong from "../CopySong/CopySong";
import DeleteSong from "../DeleteSong/DeleteSong";
import {PlayerSettingsDrawer} from "../PlayerSettings/PlayerSettingsDrawer";
import { Button } from "@/components/ui/button";

const itemClass =
  "inline-flex items-center justify-center gap-2 w-full h-8 px-3 mb-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer";

export const MoreOptions = () => {
  const username = useCurrentUsername();
  // Шухляда живе ПОЗА Dropdown: той розмонтовує вміст при закритті.
  const [playerSettingsOpen, setPlayerSettingsOpen] = useState(false);

  return (
    <>
      <Dropdown
        trigger={() => (
          <Button variant="ghost" size="icon" className="rounded-full">
            <EllipsisVerticalIcon className="w-6 h-6"  />
          </Button>
        )}
        position="bottom"
        className="w-45"
      >
        {/* any options zone */}
        <ul className="rounded-box bg-white w-full shadow-md m-0 p-2">
          <li className={itemClass} onClick={() => setPlayerSettingsOpen(true)}>
            <MusicalNoteIcon className="w-5" />
            Плеєр
          </li>
          <CopySong className={itemClass} />
          <li
            className={itemClass}
            onClick={() => createDocument(getActiveSongEditor(), username)}
          >
            <DocumentArrowDownIcon className="w-5"/>
            .docx
          </li>
          <DeleteSong />
        </ul>
      </Dropdown>
      <PlayerSettingsDrawer
        open={playerSettingsOpen}
        onClose={() => setPlayerSettingsOpen(false)}
      />
    </>
  );
}
