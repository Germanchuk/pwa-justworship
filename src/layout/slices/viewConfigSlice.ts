import { createSlice } from '@reduxjs/toolkit';

const viewConfigSlice = createSlice({
  name: 'viewConfig',
  initialState: {
    globalLoader: false,
    // Скільки запитів зараз тримають індикатор. Один прапорець гасив би його,
    // щойно завершився перший із кількох паралельних запитів.
    loaderRequests: 0,
  },
  reducers: {
    enableGlobalLoader: (state) => {
      state.loaderRequests += 1;
      state.globalLoader = true;
    },
    disableGlobalLoader: (state) => {
      state.loaderRequests = Math.max(0, state.loaderRequests - 1);
      state.globalLoader = state.loaderRequests > 0;
    },
  },
});

export const { enableGlobalLoader, disableGlobalLoader } = viewConfigSlice.actions;

export default viewConfigSlice.reducer;
