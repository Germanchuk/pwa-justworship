import { configureStore } from "@reduxjs/toolkit";
import userReducer from "#modules/AuthenticatedUser/userSlice";
import notificationsSlice from "#layout/slices/notificationsSlice";
import viewConfigSlice from "#layout/slices/viewConfigSlice";
import songSlice from "#modules/SingleSong/redux/songSlice";

const store = configureStore({
  reducer: {
    user: userReducer,
    notifications: notificationsSlice,
    viewConfig: viewConfigSlice,
    song: songSlice,
  },
});

export default store;
