import {useEffect} from "react";

import BandAudioChannel from "./bandAudioChannel";

/**
 * Logic-only: тримає підключення до band-кімнати, поки користувач у гурті.
 * Живе в BandLayout — вхід у гурт підключає, вихід (або зміна гурту) міняє
 * кімнату. UI нічого не рендерить.
 */
export function BandAudioBridge({bandId}: {bandId: string | number}) {
  useEffect(() => {
    const channel = BandAudioChannel.getInstance();
    channel.connect(bandId);
    return () => {
      // Розмонтування BandLayout = вихід із band-роутів.
      if (String(channel.getBandId()) === String(bandId)) {
        channel.disconnect();
      }
    };
  }, [bandId]);

  return null;
}
