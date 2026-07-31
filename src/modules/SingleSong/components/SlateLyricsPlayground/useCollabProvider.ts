import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  setConnectionStatus,
  setPeers,
  setLeaderClientId,
  setMyClientId,
  type CollabConnectionStatus,
  type CollabPeer,
} from "../../redux/songSlice";

interface UseCollabProviderResult {
  ydoc: Y.Doc;
  sharedRoot: Y.XmlText;
  provider: HocuspocusProvider | null;
  synced: boolean;
}

export function useCollabProvider(songId: string | number): UseCollabProviderResult {
  const dispatch = useDispatch();
  const username = useSelector((state: any) => state.user?.username) as string | undefined;
  const ydoc = useMemo(() => new Y.Doc(), [songId]);
  const sharedRoot = useMemo(
    () => ydoc.get("content", Y.XmlText) as Y.XmlText,
    [ydoc],
  );

  const [synced, setSynced] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);

  // TEMP DEBUG: expose the live ydoc for inspection.
  (window as unknown as { __ydoc?: Y.Doc }).__ydoc = ydoc;
  (window as unknown as { __sharedRoot?: Y.XmlText }).__sharedRoot = sharedRoot;

  useEffect(() => {
    const url = import.meta.env.VITE_COLLAB_URL;
    const token = localStorage.getItem("authToken") ?? "";

    dispatch(setConnectionStatus("connecting"));
    dispatch(setMyClientId(ydoc.clientID));

    const provider = new HocuspocusProvider({
      url,
      name: `song:${songId}`,
      document: ydoc,
      token,
      onSynced: () => setSynced(true),
      onStatus: ({ status }) => {
        dispatch(setConnectionStatus(status as CollabConnectionStatus));
      },
      onAuthenticationFailed: ({ reason }) => {
        console.warn("[collab] auth failed:", reason);
        dispatch(setConnectionStatus("error"));
      },
      onDisconnect: () => {
        setSynced(false);
      },
    });

    providerRef.current = provider;

    // Publish our identity into awareness so other peers can see us.
    provider.awareness?.setLocalStateField("user", { username: username ?? null });

    const updatePresence = () => {
      const states = provider.awareness?.getStates();
      if (!states || states.size === 0) {
        dispatch(setPeers([]));
        dispatch(setLeaderClientId(null));
        return;
      }
      const peers: CollabPeer[] = [];
      let minId = ydoc.clientID;
      states.forEach((state, clientId) => {
        peers.push({
          clientId,
          username: state?.user?.username ?? null,
        });
        if (clientId < minId) minId = clientId;
      });
      dispatch(setPeers(peers));
      dispatch(setLeaderClientId(minId));
    };

    provider.awareness?.on("change", updatePresence);
    updatePresence();

    return () => {
      provider.awareness?.off("change", updatePresence);
      provider.destroy();
      providerRef.current = null;
      ydoc.destroy();
      dispatch(setConnectionStatus("disconnected"));
      dispatch(setPeers([]));
      dispatch(setLeaderClientId(null));
      dispatch(setMyClientId(null));
    };
  }, [songId, ydoc, dispatch, username]);

  return {
    ydoc,
    sharedRoot,
    provider: providerRef.current,
    synced,
  };
}
