import store from "#/store";
import {setTimeSignature} from "../../../redux/songSlice";

export const handleTimeSignatureChange = (value: string) => {
  store.dispatch(setTimeSignature(value));
};
