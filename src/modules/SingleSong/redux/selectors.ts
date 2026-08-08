import { useDispatch, useSelector } from 'react-redux';
import {
  setSong,
  setNotesAudience,
  setPreferences,
} from './songSlice';
import { useCanAnnotate } from '../mode';

export const useSong = () => useSelector((state: any) => state.song.song);
export const useStatus = () => useSelector((state: any) => state.song.status);
export const useConnectionStatus = () => useSelector((state: any) => state.song.connectionStatus);
export const usePeers = () => useSelector((state: any) => state.song.peers);
export const useLeaderClientId = () => useSelector((state: any) => state.song.leaderClientId);
export const useMyClientId = () => useSelector((state: any) => state.song.myClientId);
export const useSongId = () => useSelector((state: any) => state.song.song.id);

export const usePreferences = () => useSelector((state: any) => state.song.preferences);
export const useTransposition = () => useSelector((state: any) => state.song.preferences.transposition);

export const useSetSong = () => {
  const dispatch = useDispatch();
  return (song: any) => dispatch(setSong(song));
};

export const useSetPreferences = () => {
  const dispatch = useDispatch();
  return (prefs: any) => dispatch(setPreferences(prefs));
};

// ---------- адресат приміток (чиїми очима я дивлюсь) ----------
//
// Режим пісні тут більше не живе: він читається зі шляху — див.
// `#modules/SingleSong/mode`.

/** Сирий вибір із дропдауна: нік учасника або `null` (= я). */
export const useNotesAudience = (): string | null =>
  useSelector((state: any) => state.song.notesAudience as string | null);

export const useSetNotesAudience = () => {
  const dispatch = useDispatch();
  return (username: string | null) => dispatch(setNotesAudience(username));
};

/**
 * Нік, чиї примітки зараз показуються й редагуються — ЄДИНЕ джерело правди
 * для всієї системи приміток (`isVisibleTo`, картки, FAB, втрачені коментарі).
 *
 * У режимі приміток це обраний у дропдауні учасник (за замовчуванням я сам),
 * у решті режимів — завжди я: поза режимом приміток чужі примітки не
 * показуються незалежно від того, що лишилось вибраним у дропдауні.
 */
export const useNotesViewer = (): string | undefined => {
  const me = useSelector((state: any) => state.user?.username as string | undefined);
  const audience = useNotesAudience();
  const canAnnotate = useCanAnnotate();
  return canAnnotate ? audience ?? me : me;
};
