import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { Song, Status } from '../../../models';
import { sPreferencesApi } from '../api';

export interface SongPreferences {
  id?: number | string;
  transposition: number;
  hideChords: boolean;
}

export interface SongState extends Partial<Song> {
  editMode: boolean;
  status: Status;
  song: Partial<Song>;
  preferences: SongPreferences;
  showChordsAgainstPreferences: boolean;
}

const initialState: SongState = {
  editMode: false,
  status: "pending",
  song: {},
  preferences: {
    transposition: 0,
    hideChords: false
  },
  showChordsAgainstPreferences: false
};

export const savePreferencesThunk = createAsyncThunk<
  SongPreferences,
  {
    songId: string | number;
    preferences: SongPreferences;
  }
>(
  'song/savePreferences',
  async (
    {
      songId,
      preferences,
    }
  ) => {
    const response = preferences?.id
      ? await sPreferencesApi.updatePreferences(preferences.id, preferences)
      : await sPreferencesApi.createPreferences(songId, preferences);

    return response?.data ?? preferences;
  }
);

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
    setSongName: (state, action) => {
      state.song.name = action.payload;
    },
    setBpm: (state, action) => {
      state.song.bpm = action.payload;
    },
    setKey: (state, action) => {
      state.song.key = action.payload;
    },
    setTimeSignature: (state, action) => {
      state.song.timeSignature = action.payload;
    },
    setEditMode: (state, action) => {
      state.editMode = action.payload;
    },
    setSections: (state, action) => {
      state.song.sections = action.payload;
    },
    setPreferences: (state, action) => {
      state.preferences = {
        ...state.preferences,
        ...action.payload
      };
    },
    showChordsAgainstPreferences: (state, action) => {
      state.showChordsAgainstPreferences = action.payload;
    },
    setStatus: (state, action) => {
      state.status = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(savePreferencesThunk.fulfilled, (state, action) => {
      state.preferences = {
        ...state.preferences,
        ...action.payload
      };
    });
  }
});

export const {
  setSong,
  resetSong,
  setSongName,
  setBpm,
  setKey,
  setTimeSignature,
  setEditMode,
  setSections,
  setPreferences,
  showChordsAgainstPreferences,
  setStatus
} = songSlice.actions;

export default songSlice.reducer;
