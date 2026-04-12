import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
  name: 'user',
  initialState: {},
  reducers: {
    setUser: (state, action) => {
      return {
        ...state,
        ...action.payload
      }
    },
    setCurrentBand: (state, action) => {
      return {
        ...state,
        currentBand: action.payload
      }
    }
  },
});

export const { setUser, setCurrentBand } = userSlice.actions;
export default userSlice.reducer;
