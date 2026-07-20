import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { yTextToSlateElement } from "@slate-yjs/core";
import {
  setConnectionStatus,
  setPeers,
  setLeaderClientId,
  setMyClientId,
  setBpm,
  setKey,
  setTimeSignature,
  setSongName,
  type CollabConnectionStatus,
  type CollabPeer,
} from "../../redux/songSlice";

function timeSignatureFromDisplay(value: string): string {
  if (value === "4/4") return "fourFour";
  if (value === "3/4") return "threeFour";
  return value; // already enum or unknown
}

function mirrorHeaderToRedux(root: Y.XmlText, dispatch: ReturnType<typeof useDispatch>) {
  try {
    if (root.length === 0) return;
    const tree = yTextToSlateElement(root) as { children?: any[] };
    const nodes = tree.children ?? [];
    if (nodes.length < 2) return;

    const songNameNode = nodes[0];
    const metaRow = nodes[1];

    if (songNameNode?.type === "song-name") {
      const name = songNameNode.children?.[0]?.text ?? "";
      dispatch(setSongName(name));
    }

    if (metaRow?.type === "song-meta-row" && Array.isArray(metaRow.children)) {
      for (const child of metaRow.children) {
        switch (child?.type) {
          case "bpm": {
            const n = Number(child.children?.[0]?.text ?? "0");
            if (Number.isFinite(n)) dispatch(setBpm(n));
            break;
          }
          case "time-signature": {
            const display = child.children?.[0]?.text ?? "4/4";
            dispatch(setTimeSignature(timeSignatureFromDisplay(display)));
            break;
          }
          case "song-key": {
            if (typeof child.keyValue === "string") dispatch(setKey(child.keyValue));
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[collab] mirror to redux failed", err);
  }
}

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

    // Mirror header values from Y.Doc to Redux so legacy consumers
    // (ChordsProgressionPlayer, transposition logic) see live updates.
    const onYUpdate = () => mirrorHeaderToRedux(sharedRoot, dispatch);
    ydoc.on("update", onYUpdate);
    onYUpdate();

    return () => {
      ydoc.off("update", onYUpdate);
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
