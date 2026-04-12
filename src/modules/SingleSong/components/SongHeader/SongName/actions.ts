import store from "#/store";
import {setSongName } from "../../../redux/songSlice";

export const handleSongName = (songName) => {
  store.dispatch(setSongName(songName));
}