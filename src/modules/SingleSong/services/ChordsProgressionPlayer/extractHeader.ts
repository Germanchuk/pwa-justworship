import {Element, Node, type Descendant} from "slate";

import {DEFAULT_BPM, DEFAULT_TIME_SIGNATURE} from "./songDefaults";

export interface SongHeader {
  name: string | null;
  bpm: number;
  timeSignature: [number, number];
}

const parseTimeSig = (text: string): [number, number] => {
  const [a, b] = text.split("/").map((v) => parseInt(v, 10));
  const num = Number.isFinite(a) && a > 0 ? a : DEFAULT_TIME_SIGNATURE[0];
  const den = Number.isFinite(b) && b > 0 ? b : DEFAULT_TIME_SIGNATURE[1];
  return [num, den];
};

/**
 * Читає шапку пісні (назва, темп, розмір) прямо з нодів документа.
 * Спільний для SlatePlayerBridge (редактор) і headless-програвання на хості.
 */
export const extractHeader = (nodes: Descendant[]): SongHeader => {
  let name: string | null = null;
  let bpm = DEFAULT_BPM;
  let timeSignature: [number, number] = DEFAULT_TIME_SIGNATURE;

  const songName = nodes.find(
    (n) => Element.isElement(n) && (n as {type?: string}).type === "song-name",
  );
  if (songName && Element.isElement(songName)) {
    const text = Node.string(songName).trim();
    name = text.length > 0 ? text : null;
  }

  const metaRow = nodes.find(
    (n) => Element.isElement(n) && (n as {type?: string}).type === "song-meta-row",
  );
  if (!metaRow || !Element.isElement(metaRow)) return {name, bpm, timeSignature};

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
  return {name, bpm, timeSignature};
};
