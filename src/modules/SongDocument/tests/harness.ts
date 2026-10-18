/**
 * Стенд для тестів: два учасники з копіями моделі пісні в Yjs і «мережа»
 * між ними, яку можна вимкнути (у застосунку документи синхронізує Hocuspocus).
 */
import * as Y from "yjs";
import { appendLines, chordsString, layout, LineInit, Song, songOf } from "../model";

export type Peer = Song;

/** Два учасники з однаковою піснею; `unlink()`/`link()` — мережа. */
export function makePair(seed: LineInit[]) {
  const a = new Y.Doc();
  const b = new Y.Doc();
  let online = true;
  const queueAB: Uint8Array[] = [];
  const queueBA: Uint8Array[] = [];
  a.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin === "net") return;
    if (online) Y.applyUpdate(b, u, "net");
    else queueAB.push(u);
  });
  b.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin === "net") return;
    if (online) Y.applyUpdate(a, u, "net");
    else queueBA.push(u);
  });
  const A = songOf(a);
  const B = songOf(b);
  a.transact(() => appendLines(A, seed), "seed");

  return {
    A,
    B,
    get online() {
      return online;
    },
    get queued() {
      return queueAB.length + queueBA.length;
    },
    unlink() {
      online = false;
    },
    link() {
      online = true;
      queueAB.splice(0).forEach((u) => Y.applyUpdate(b, u, "net"));
      queueBA.splice(0).forEach((u) => Y.applyUpdate(a, u, "net"));
    },
  };
}

export type Pair = ReturnType<typeof makePair>;

/** Правка моделі «ззовні» (сценарій, чужа дія) — одна транзакція. */
export const change = (song: Song, fn: () => void) => song.doc.transact(fn, "scenario");

/** Документ рядками «акорди / слова» — для тестів і панелі стану. */
export const docLines = (song: Song) => layout(song).map((l) => `${chordsString(l.line)} / ${l.words}`);
