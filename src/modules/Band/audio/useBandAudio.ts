import {useEffect, useState} from "react";

import BandAudioChannel from "./bandAudioChannel";
import type {AudioHostStatus} from "./types";

/**
 * Живий статус хоста звуку гурту (null — хост не онлайн / не в кімнаті).
 * Працює будь-де, включно з порталом нижньої панелі: канал — синглтон,
 * підключення тримає BandAudioBridge у BandLayout.
 */
export const useAudioHostStatus = (): AudioHostStatus | null => {
  const channel = BandAudioChannel.getInstance();
  const [status, setStatus] = useState<AudioHostStatus | null>(channel.getHostStatus());

  useEffect(() => channel.onHostStatus(setStatus), [channel]);

  return status;
};
