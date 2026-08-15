import { createSlice } from '@reduxjs/toolkit';
import { Song, Status } from '../../../models';

export type CollabConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface CollabPeer {
  clientId: number;
  username: string | null;
}

export interface SongState extends Partial<Song> {
  /**
   * Чиїми очима я дивлюсь на примітки (нік члена гурту). `null` = своїми.
   *
   * Діє ЛИШЕ в режимі приміток: там я бачу рівно те, що бачить обраний
   * учасник, і нові примітки створюю для нього. У режимах читання й
   * редагування вибір ігнорується — там завжди видно тільки свої примітки
   * (див. `useNotesViewer`). Стан per-user і локальний, у спільний документ
   * не пишеться.
   */
  notesAudience: string | null;
  status: Status;
  song: Partial<Song>;
  connectionStatus: CollabConnectionStatus;
  peers: CollabPeer[];
  leaderClientId: number | null;
  myClientId: number | null;
}

const initialState: SongState = {
  notesAudience: null,
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
