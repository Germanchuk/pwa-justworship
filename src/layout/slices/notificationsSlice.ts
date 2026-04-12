import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from "uuid"

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: [],
  reducers: {
    addNotification: (state, action) => {
      state.push(action.payload);
      return state;
    },
    removeNotification: (state, action) => {
        return state.filter(notification => notification.id !== action.payload);
    }
  },
});

export const { addNotification, removeNotification } = notificationsSlice.actions;

interface Notification {
    id?: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    timeout?: number;
}

export const addNotificationWithTimeout = (notification: Notification) => (dispatch) => {
    const defaultMessage = {
        message: "Важливо",
        timeout: 10000
    }
    notification.id = uuidv4();

    notification = { ...defaultMessage, ...notification };

    dispatch(addNotification(notification));
  
    setTimeout(() => {
      dispatch(removeNotification(notification.id));
    }, notification.timeout);
  };

export default notificationsSlice.reducer;
