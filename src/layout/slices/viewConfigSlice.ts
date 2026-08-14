import { createSlice } from '@reduxjs/toolkit';

/**
 * Показувати шапку пісні (назва + мета-рядок: темп, розмір, тональність,
 * капо, фільтри показу). Налаштування екрана, а не пісні: воно про те,
 * скільки місця віддати самій пісні, тож живе тут, поруч із глобальним
 * лоадером, а не в документі. Спільне для всіх пісень і переживає
 * перезавантаження.
 */
const SONG_META_KEY = 'songMetaVisible';

function readSongMetaVisible() {
  try {
    return localStorage.getItem(SONG_META_KEY) !== 'false';
  } catch {
    return true;
  }
}

function persistSongMetaVisible(visible: boolean) {
  try {
    localStorage.setItem(SONG_META_KEY, String(visible));
  } catch {
    // приватний режим / заборонене сховище — стан просто не переживе сесію
  }
}

const viewConfigSlice = createSlice({
  name: 'viewConfig',
  initialState: {
    globalLoader: false,
    songMetaVisible: readSongMetaVisible(),
  },
  reducers: {
    enableGlobalLoader: (state) => {
      state.globalLoader = true;
    },
    disableGlobalLoader: (state) => {
        state.globalLoader = false;
      },
    toggleSongMeta: (state) => {
      state.songMetaVisible = !state.songMetaVisible;
      persistSongMetaVisible(state.songMetaVisible);
    },
  },
});

export const { enableGlobalLoader, disableGlobalLoader, toggleSongMeta } = viewConfigSlice.actions;

export default viewConfigSlice.reducer;
