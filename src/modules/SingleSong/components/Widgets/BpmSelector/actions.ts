import store from "#/store";
import { setBpm } from "../../../redux/songSlice";

export const handleBpmChange = (bpm) => {
  store.dispatch(setBpm(bpm.replace(/\D+/g, '')));
}