/**
 * Особисте кожного, що не належить рядку, — окремі мапи документа з ключем
 * нік. Мапи верхнього рівня, тож ніхто не створює їх одночасно з іншим.
 *   capo:        нік → лад капо
 *   capoOff:     нік → true — капо тимчасово вимкнене (значення пам'ятаємо)
 *   hiddenLanes: нік → id доріжок (`lanes.ts`), яких людина не бачить
 * Особиста динаміка — на самому рядку (`dynamics.ts`).
 */
import * as Y from "yjs";

const capoMap = (doc: Y.Doc) => doc.getMap<number>("capo");
const capoOffMap = (doc: Y.Doc) => doc.getMap<boolean>("capoOff");
const hiddenMap = (doc: Y.Doc) => doc.getMap<string[]>("hiddenLanes");

export type Capo = { fret: number; off: boolean };

export const readCapo = (doc: Y.Doc, nick: string): Capo => ({
  fret: capoMap(doc).get(nick) ?? 0,
  off: capoOffMap(doc).get(nick) === true,
});

export function writeCapo(doc: Y.Doc, nick: string, { fret, off }: Partial<Capo>) {
  doc.transact(() => {
    if (fret !== undefined) {
      if (fret) capoMap(doc).set(nick, fret);
      else capoMap(doc).delete(nick);
    }
    if (off !== undefined) {
      if (off) capoOffMap(doc).set(nick, true);
      else capoOffMap(doc).delete(nick);
    }
  });
}

export const readHiddenLanes = (doc: Y.Doc, nick: string): string[] => hiddenMap(doc).get(nick) ?? [];

export function writeHiddenLanes(doc: Y.Doc, nick: string, lanes: string[]) {
  if (lanes.length) hiddenMap(doc).set(nick, [...lanes]);
  else hiddenMap(doc).delete(nick);
}
