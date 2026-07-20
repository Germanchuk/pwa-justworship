import {useEffect, useMemo, useRef, useState} from "react";
import type {ReactNode} from "react";
import {Element, Node, type Descendant, type Editor} from "slate";

import ChordsProgressionPlayer from "../../../services/ChordsProgressionPlayer/ChordsProgressionPlayer";
import {PlayerHighlightContext} from "./PlayerHighlightContext";
import {useCurrentUsername} from "../elements/hooks";
import {resolveTransposition} from "../transposition/operations";

interface Props {
  editor: Editor;
  children: ReactNode;
}

const DEFAULT_BPM = 70;
const DEFAULT_TS: [number, number] = [4, 4];

const parseTimeSig = (text: string): [number, number] => {
  const [a, b] = text.split("/").map((v) => parseInt(v, 10));
  const num = Number.isFinite(a) && a > 0 ? a : DEFAULT_TS[0];
  const den = Number.isFinite(b) && b > 0 ? b : DEFAULT_TS[1];
  return [num, den];
};

const extractHeader = (nodes: Descendant[]): {bpm: number; timeSignature: [number, number]} => {
  let bpm = DEFAULT_BPM;
  let timeSignature: [number, number] = DEFAULT_TS;

  const metaRow = nodes.find(
    (n) => Element.isElement(n) && (n as {type?: string}).type === "song-meta-row",
  );
  if (!metaRow || !Element.isElement(metaRow)) return {bpm, timeSignature};

  for (const child of (metaRow as {children?: Descendant[]}).children ?? []) {
    if (!Element.isElement(child)) continue;
    const t = (child as {type?: string}).type;
    if (t === "bpm") {
      const parsed = Number(Node.string(child));
      if (Number.isFinite(parsed) && parsed > 0) bpm = parsed;
    } else if (t === "time-signature") {
      timeSignature = parseTimeSig(Node.string(child) || "4/4");
    }
  }
  return {bpm, timeSignature};
};

export const SlatePlayerBridge = ({editor, children}: Props) => {
  const player = useMemo(() => ChordsProgressionPlayer.getInstance(), []);

  // Транспозиція плейбеку = per-user капо з документа (capo.valuesBy[username]).
  // Тримаємо нік у ref, бо provider — стабільне замикання, що читає live-стан.
  const username = useCurrentUsername();
  const usernameRef = useRef(username);
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  const [currentTokenKey, setCurrentTokenKey] = useState<string | null>(null);
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(
    player.getStartChordTokenKey(),
  );

  useEffect(() => {
    const provider = () => {
      const nodes = editor.children as Descendant[];
      const {bpm, timeSignature} = extractHeader(nodes);
      const {myCapo} = resolveTransposition(editor, usernameRef.current);
      return {
        nodes,
        bpm,
        timeSignature,
        transposition: myCapo,
      };
    };
    player.setContentProvider(provider);
    return () => {
      player.setContentProvider(null);
    };
  }, [editor, player]);

  useEffect(
    () =>
      player.onChordChange((event) => {
        setCurrentTokenKey(event?.tokenKey ?? null);
      }),
    [player],
  );

  useEffect(
    () => player.onSelectedChordKeyChange((key) => setSelectedTokenKey(key)),
    [player],
  );

  const value = useMemo(
    () => ({currentTokenKey, selectedTokenKey}),
    [currentTokenKey, selectedTokenKey],
  );

  return (
    <PlayerHighlightContext.Provider value={value}>
      {children}
    </PlayerHighlightContext.Provider>
  );
};
