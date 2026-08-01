import {EllipsisVerticalIcon} from "@heroicons/react/24/solid";
import {Dropdown} from "#components";
import React from "react";
import {createDocument} from "../../../services";
import {DocumentArrowDownIcon, EyeIcon, EyeSlashIcon} from "@heroicons/react/24/outline";
import {useDispatch} from "react-redux";
import {useShouldHideChords, usePreferences, useSong} from "../../../redux/selectors";
import {getActiveSongEditor} from "../../SlateLyricsPlayground/songEditorRegistry";
import {useCurrentUsername} from "../../SlateLyricsPlayground/elements/hooks";
import {savePreferencesThunk} from "../../../redux/songSlice";
import DeleteSong from "../DeleteSong/DeleteSong";
import { Button } from "@/components/ui/button";

export const MoreOptions = () => {
  const dispatch = useDispatch<any>();
  const hideChords = useShouldHideChords();
  const preferences = usePreferences();
  const song = useSong();
  const username = useCurrentUsername();

  const handleToggle = () => {
    if (!song?.id) return;

    const nextPreferences = {
      transposition: preferences?.transposition ?? 0,
      hideChords: !preferences?.hideChords,
      id: preferences?.id
    };

    dispatch(savePreferencesThunk({ songId: song.id, preferences: nextPreferences }));
  };

  return (
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
        <li
          className="inline-flex items-center justify-center gap-2 w-full h-8 px-3 mb-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          onClick={() => createDocument(getActiveSongEditor(), username)}
        >
          <DocumentArrowDownIcon className="w-5"/>
          .docx
        </li>
        <li
          className="inline-flex items-center justify-center gap-2 w-full h-8 px-3 mb-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          onClick={handleToggle}
        >
          {hideChords ? <EyeIcon className="w-4"/>
            : <EyeSlashIcon className="w-4"/>}
          {hideChords ? "Показати" : "Сховати"} акорди
        </li>
        <DeleteSong />
      </ul>
    </Dropdown>
  );
}
