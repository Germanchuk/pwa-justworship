import {useSyncExternalStore} from "react";

import BandRoom from "./bandRoom";

/** Чи є звʼязок із кімнатою гурту. */
export const useBandOnline = (): boolean => {
  const room = BandRoom.getInstance();
  return useSyncExternalStore(
    (listener) => room.onOnline(listener),
    () => room.isOnline(),
  );
};
