import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setSong,
  setNotesAudience,
} from './songSlice';
import { useCanAnnotate } from '../mode';

export const useSong = () => useSelector((state: any) => state.song.song);
export const useStatus = () => useSelector((state: any) => state.song.status);
export const useConnectionStatus = () => useSelector((state: any) => state.song.connectionStatus);
export const usePeers = () => useSelector((state: any) => state.song.peers);
export const useLeaderClientId = () => useSelector((state: any) => state.song.leaderClientId);
export const useMyClientId = () => useSelector((state: any) => state.song.myClientId);
export const useSongId = () => useSelector((state: any) => state.song.song.id);

export const useSetSong = () => {
  const dispatch = useDispatch();
  return (song: any) => dispatch(setSong(song));
};

// ---------- адресат приміток (чиїми очима я дивлюсь) ----------
//
// Режим пісні тут більше не живе: він читається зі шляху — див.
// `#modules/SingleSong/mode`.

/** Сирий вибір із дропдауна: ніки відмічених учасників (порожньо = я). */
export const useNotesAudience = (): string[] =>
  useSelector((state: any) => state.song.notesAudience as string[]);

export const useSetNotesAudience = () => {
  const dispatch = useDispatch();
  return (usernames: string[]) => dispatch(setNotesAudience(usernames));
};

/**
 * Набір ніків, чиї примітки зараз показуються й редагуються — ЄДИНЕ джерело
 * правди для всієї системи приміток (`isVisibleToAll`, картки, FAB, втрачені
 * коментарі).
 *
 * У режимі приміток це відмічені в дропдауні учасники (за замовчуванням я
 * сам), у решті режимів — завжди я один: поза режимом приміток чужі примітки
 * не показуються незалежно від того, що лишилось вибраним (`NOTE-22`).
 *
 * `useMemo` тут не косметика: масив іде в deps `NoteHeadsProvider`, і новий
 * масив на кожен рендер перераховував би розкладку карток по всій пісні.
 */
export const useNotesViewers = (): string[] => {
  const me = useSelector((state: any) => state.user?.username as string | undefined);
  const audience = useNotesAudience();
  const canAnnotate = useCanAnnotate();
  return useMemo(() => {
    const mine = me ? [me] : [];
    if (!canAnnotate) return mine;
    return audience.length > 0 ? audience : mine;
  }, [canAnnotate, audience, me]);
};
