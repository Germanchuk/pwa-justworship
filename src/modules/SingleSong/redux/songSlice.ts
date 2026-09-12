import { createSlice } from '@reduxjs/toolkit';
import { Song, Status } from '../../../models';

export type CollabConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface CollabPeer {
  clientId: number;
  username: string | null;
}

export interface SongState extends Partial<Song> {
  /**
   * Чиїми очима я дивлюсь на примітки — НАБІР ніків членів гурту. Порожній
   * набір = своїми (`NOTE-19`): останню галочку зняти не можна, вона просто
   * нормалізується назад у мене.
   *
   * Діє ЛИШЕ в режимі приміток: там я бачу те, що бачить КОЖЕН з відмічених,
   * і нові примітки створюю одним записом для всіх них. У режимах читання й
   * редагування вибір ігнорується — там завжди видно тільки свої примітки
   * (див. `useNotesViewers`). Стан per-user і локальний, у спільний документ
   * не пишеться й між сесіями не памʼятається.
   */
  notesAudience: string[];
  status: Status;
  song: Partial<Song>;
  connectionStatus: CollabConnectionStatus;
  peers: CollabPeer[];
  leaderClientId: number | null;
  myClientId: number | null;
}

const initialState: SongState = {
  notesAudience: [],
  status: "pending",
  song: {},
  connectionStatus: "connecting",
  peers: [],
  leaderClientId: null,
  myClientId: null
};

const songSlice = createSlice({
  name: 'song',
  initialState,
  reducers: {
    setSong: (state, action) => {
      state.song = action.payload;
    },
    resetSong: (state) => {
      state.song = {};
    },
    setNotesAudience: (state, action) => {
      state.notesAudience = action.payload;
    },
    setStatus: (state, action) => {
      state.status = action.payload;
    },
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload;
    },
    setPeers: (state, action) => {
      state.peers = action.payload;
    },
    setLeaderClientId: (state, action) => {
      state.leaderClientId = action.payload;
    },
    setMyClientId: (state, action) => {
      state.myClientId = action.payload;
    }
  }
});

export const {
  setSong,
  resetSong,
  setNotesAudience,
  setStatus,
  setConnectionStatus,
  setPeers,
  setLeaderClientId,
  setMyClientId
} = songSlice.actions;

export default songSlice.reducer;
