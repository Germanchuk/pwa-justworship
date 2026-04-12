import {MagicInput} from "#components";
import { useSongName } from "../../../redux/selectors";
import { handleSongName } from "./actions";

export const SongName = () => {
  const songName = useSongName();
  return (
    <MagicInput
      className="text-xl font-semibold"
      value={songName}
      setValue={handleSongName}
    />
  )
}