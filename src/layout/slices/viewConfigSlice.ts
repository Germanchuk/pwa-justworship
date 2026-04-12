import { createSlice } from '@reduxjs/toolkit';

const viewConfigSlice = createSlice({
  name: 'viewConfig',
  initialState: {
    globalLoader: false,
  },
  reducers: {
    enableGlobalLoader: (state) => {
      state.globalLoader = true;
    },
    disableGlobalLoader: (state) => {
        state.globalLoader = false;
      },
  },
});

export const { enableGlobalLoader, disableGlobalLoader } = viewConfigSlice.actions;

export default viewConfigSlice.reducer;
