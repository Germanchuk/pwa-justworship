import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";

import { COLLAB_URL } from "#utils/serviceUrls";
import {
  setConnectionStatus,
  setLeaderClientId,
  setMyClientId,
  setPeers,
  type CollabConnectionStatus,
  type CollabPeer,
} from "#modules/SingleSong/redux/songSlice";
import { songOf, type Song } from "../model";

/**
 * Документ пісні в моделі рядків — кімната collab `lines:<id>`. Присутність
 * (хто ще в пісні) і стан з'єднання — у redux, як і раніше.
 */
export function useLinesDoc(songId: string | number): { song: Song; synced: boolean } {
  const dispatch = useDispatch();
  const username = useSelector((state: { user?: { username?: string } }) => state.user?.username);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const song = useMemo(() => songOf(new Y.Doc()), [songId]);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const { doc } = song;
    dispatch(setConnectionStatus("connecting"));
    dispatch(setMyClientId(doc.clientID));

    const provider = new HocuspocusProvider({
      url: COLLAB_URL,
      name: `lines:${songId}`,
      document: doc,
      token: localStorage.getItem("authToken") ?? "",
      onSynced: () => setSynced(true),
      onStatus: ({ status }) => dispatch(setConnectionStatus(status as CollabConnectionStatus)),
      onAuthenticationFailed: ({ reason }) => {
        console.warn("[collab] auth failed:", reason);
        dispatch(setConnectionStatus("error"));
      },
    });
    provider.awareness?.setLocalStateField("user", { username: username ?? null });

    const updatePresence = () => {
      const states = provider.awareness?.getStates();
      const peers: CollabPeer[] = [];
      let leader = doc.clientID;
      states?.forEach((state, clientId) => {
        peers.push({ clientId, username: state?.user?.username ?? null });
        if (clientId < leader) leader = clientId;
      });
      dispatch(setPeers(peers));
      dispatch(setLeaderClientId(peers.length ? leader : null));
    };
    provider.awareness?.on("change", updatePresence);
    updatePresence();

    if (import.meta.env.DEV) (window as unknown as { __song?: Song }).__song = song;

    return () => {
      provider.awareness?.off("change", updatePresence);
      provider.destroy();
      doc.destroy();
      dispatch(setConnectionStatus("disconnected"));
      dispatch(setPeers([]));
      dispatch(setLeaderClientId(null));
      dispatch(setMyClientId(null));
    };
  }, [song, songId, dispatch, username]);

  return { song, synced };
}

/** Перемальовуватись на будь-яку зміну документа (шапка, примітки, особисте). */
export function useDocVersion(doc: Y.Doc): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    doc.on("update", bump);
    return () => doc.off("update", bump);
  }, [doc]);
  return version;
}
