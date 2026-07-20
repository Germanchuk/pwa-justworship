import { useDispatch, useSelector } from 'react-redux';
import {
  setSong,
  setEditMode,
  setPreferences,
  setCarefulMode,
} from './songSlice';

export const useSong = () => useSelector((state: any) => state.song.song);
export const useBpm = () => useSelector((state: any) => state.song.song.bpm);
export const useKey = () => useSelector((state: any) => state.song.song.key);
export const useTimeSignature = () => useSelector((state: any) => state.song.song.timeSignature);
export const useSongName = () => useSelector((state: any) => state.song.song.name);
export const useEditMode = () => useSelector((state: any) => state.song.editMode);
export const useStatus = () => useSelector((state: any) => state.song.status);
export const useConnectionStatus = () => useSelector((state: any) => state.song.connectionStatus);
export const usePeers = () => useSelector((state: any) => state.song.peers);
export const useLeaderClientId = () => useSelector((state: any) => state.song.leaderClientId);
export const useMyClientId = () => useSelector((state: any) => state.song.myClientId);
export const useSections = () => useSelector((state: any) => state.song.song.sections);
export const useSlate = () => useSelector((state: any) => state.song.song.slate);
export const useSongId = () => useSelector((state: any) => state.song.song.id);
export const useIsReadonly = () => useSelector((state: any) => Boolean(state.song.song?.readonly));

export const usePreferences = () => useSelector((state: any) => state.song.preferences);
export const useShouldHideChords = () => useSelector((state: any) => state.song.preferences.hideChords);
export const useTransposition = () => useSelector((state: any) => state.song.preferences.transposition);
export const useShouldShowChordsAgainstPreferences = () => useSelector((state: any) => state.song.showChordsAgainstPreferences);

export const useSetSong = () => {
  const dispatch = useDispatch();
  return (song: any) => dispatch(setSong(song));
};

export const useSetEditMode = () => {
  const dispatch = useDispatch();
  return (mode: boolean) => dispatch(setEditMode(mode));
};

export const useSetPreferences = () => {
  const dispatch = useDispatch();
  return (prefs: any) => dispatch(setPreferences(prefs));
};

export const useCarefulMode = () =>
  useSelector((state: any) => Boolean(state.song.carefulMode));

export const useSetCarefulMode = () => {
  const dispatch = useDispatch();
  return (value: boolean) => dispatch(setCarefulMode(value));
};
