import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import {useDispatch} from "react-redux";
import {useShouldHideChords, usePreferences, useSong} from "../../../redux/selectors";
import {savePreferencesThunk} from "../../../redux/songSlice";

export const HideChords =  () => {
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

  return(
    <button
      className="btn btn-sm"
      onClick={handleToggle}
    >
      {hideChords ? <EyeIcon className="w-4"/>
        : <EyeSlashIcon className="w-4"/>}
      {hideChords ? "Показати" : "Сховати"} акорди
    </button>
  )
}
