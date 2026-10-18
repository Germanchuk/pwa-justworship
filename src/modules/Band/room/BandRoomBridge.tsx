import {useEffect} from "react";

import BandRoom from "./bandRoom";

/**
 * Logic-only: тримає підключення до кімнати гурту, поки користувач у гурті.
 * Живе в BandLayout — вхід у гурт підключає, вихід (або зміна гурту) міняє
 * кімнату. UI нічого не рендерить.
 */
export function BandRoomBridge({bandId}: {bandId: string | number}) {
  useEffect(() => {
    const room = BandRoom.getInstance();
    room.connect(bandId);
    return () => {
      // Розмонтування BandLayout = вихід із band-роутів.
      if (room.getBandId() === String(bandId)) {
        room.disconnect();
      }
    };
  }, [bandId]);

  return null;
}
