import store from "#/store";
import { savePreferencesThunk } from "../../../redux/songSlice";

export const handleTranspositionChange = (transposition: number) => {
  const { preferences, song } = store.getState().song;
  const songId = song?.id;

  if (!songId) return;

  const nextPreferences = {
    hideChords: false,
    ...preferences,
    transposition
  };

  store.dispatch(savePreferencesThunk({ songId, preferences: nextPreferences }));
};
