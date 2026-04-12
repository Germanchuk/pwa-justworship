import {EllipsisVerticalIcon} from "@heroicons/react/24/solid";
import {Dropdown} from "#components";
import React from "react";
import {createDocument} from "../../../services";
import {DocumentArrowDownIcon, EyeIcon, EyeSlashIcon} from "@heroicons/react/24/outline";
import {useDispatch} from "react-redux";
import {useShouldHideChords, usePreferences, useSong} from "../../../redux/selectors";
import {savePreferencesThunk} from "../../../redux/songSlice";
import DeleteSong from "../DeleteSong/DeleteSong";

export const MoreOptions = () => {
  const dispatch = useDispatch<any>();
  const hideChords = useShouldHideChords();
  const preferences = usePreferences();
  const song = useSong();

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
        <button className="btn btn-circle btn-ghost">
          <EllipsisVerticalIcon className="w-6 h-6"  />
        </button>
      )}
      position="top"
      className="w-45"
    >
      {/* any options zone */}
      <ul className="rounded-box bg-white w-full shadow-md m-0 p-2">
        <li
          className="btn btn-block btn-sm mb-1"
          onClick={() => createDocument()}
        >
          <DocumentArrowDownIcon className="w-5"/>
          .docx
        </li>
        <li
          className="btn btn-block btn-sm mb-1"
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
