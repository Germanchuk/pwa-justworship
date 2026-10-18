/**
 * Шапка пісні — `meta: Y.Map`, по ключу на поле. Значення прості: правка
 * поля — «перемагає останній» у межах цього поля, різні поля не заважають.
 */
import * as Y from "yjs";

export type SongMeta = {
  name: string;
  bpm: number;
  /** Розмір як його бачать люди: "4/4", "6/8"… */
  timeSignature: string;
  /** Тональність пісні: "C", "F#m"… */
  key: string;
};

export const META_DEFAULTS: SongMeta = { name: "", bpm: 0, timeSignature: "4/4", key: "C" };

export const metaMapOf = (doc: Y.Doc) => doc.getMap<unknown>("meta");

export function readMeta(doc: Y.Doc): SongMeta {
  const map = metaMapOf(doc);
  const pick = <K extends keyof SongMeta>(key: K): SongMeta[K] => {
    const value = map.get(key);
    return typeof value === typeof META_DEFAULTS[key] ? (value as SongMeta[K]) : META_DEFAULTS[key];
  };
  return { name: pick("name"), bpm: pick("bpm"), timeSignature: pick("timeSignature"), key: pick("key") };
}

/** Записати поля шапки; незмінені не чіпає, щоб не слати порожніх правок. */
export function writeMeta(doc: Y.Doc, patch: Partial<SongMeta>) {
  const map = metaMapOf(doc);
  doc.transact(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined && map.get(key) !== value) map.set(key, value);
    }
  });
}
