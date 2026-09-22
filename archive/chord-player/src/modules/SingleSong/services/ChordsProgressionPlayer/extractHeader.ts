import {Element, Node, type Descendant} from "slate";

import {keys as VALID_KEYS} from "#utils/keyUtils";

import type {SongKeyValue} from "../../components/SlateLyricsPlayground/transposition/model";
import {DEFAULT_BPM, DEFAULT_TIME_SIGNATURE} from "./songDefaults";

/**
 * Тональність пісні за замовчуванням. Дублює `withHeader.DEFAULT_KEY` свідомо:
 * тягнути сюди плагін редактора (а з ним Slate-трансформації) заради одного
 * рядка нема за що — цей шар читає ноди й нічого в них не міняє.
 */
const DEFAULT_KEY: SongKeyValue = "C";

const VALID_KEYS_SET = new Set<string>(VALID_KEYS);

export interface SongHeader {
  name: string | null;
  bpm: number;
  timeSignature: [number, number];
  /**
   * Ярлик тональності. Саме ярлик: акорди пісні можуть із ним розходитись, і
   * єдине, заради чого він потрібен поза показом, — побудувати домінанту в
   * програші (`buildGathering`). Шви беруться з реальних акордів.
   */
  key: SongKeyValue;
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
  let key: SongKeyValue = DEFAULT_KEY;

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
  if (!metaRow || !Element.isElement(metaRow)) return {name, bpm, timeSignature, key};

  for (const child of (metaRow as {children?: Descendant[]}).children ?? []) {
    if (!Element.isElement(child)) continue;
    const t = (child as {type?: string}).type;
    if (t === "bpm") {
      const parsed = Number(Node.string(child));
      if (Number.isFinite(parsed) && parsed > 0) bpm = parsed;
    } else if (t === "time-signature") {
      timeSignature = parseTimeSig(Node.string(child) || "4/4");
    } else if (t === "song-key") {
      // Той самий інваріант, що тримає `withHeader`, — але тут документ ніхто
      // не нормалізує: він приїхав знімком. Битий ярлик мовчки з'їхав би в
      // сусідній акорд (`keys.findIndex` віддав би −1), тож краще дефолт.
      const value = (child as {keyValue?: string}).keyValue;
      if (value && VALID_KEYS_SET.has(value)) key = value as SongKeyValue;
    }
  }
  return {name, bpm, timeSignature, key};
};
