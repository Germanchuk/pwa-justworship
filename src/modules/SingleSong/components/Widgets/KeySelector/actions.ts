import store from "#/store";
import { setKey, setSections } from "../../../redux/songSlice";
import { remapChords } from "#utils/keyUtils";

export const handleChangeKey = (key: string) => {
  store.dispatch(setKey(key));
};

export const handleTransposeSong = (key: string) => {
  const song = store.getState().song.song;
  const sections = remapChords(song.sections, song.key, key);
  store.dispatch(setSections(sections));
  store.dispatch(setKey(key));
};
