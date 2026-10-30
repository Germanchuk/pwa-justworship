/**
 * Лікар слотів (ADR-0008): рядок, що народився одночасно з новою доріжкою, —
 * без її слота: дописати; клітинки на старій сітці — перерахувати. Працює в
 * будь-якому режимі й показі (і в горизонтальному форматі): інакше читання
 * показало б старі як є.
 */
import { useEffect } from "react";
import { ensureSlots, linesOf, missingSlots, Song } from "../model";

export function useHealSlots(song: Song) {
  useEffect(() => {
    const heal = () => {
      const lines = linesOf(song);
      if (missingSlots(song, lines).length) song.doc.transact(() => ensureSlots(song, lines), "heal");
    };
    let queued = false;
    const onTransaction = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        heal();
      });
    };
    heal();
    song.doc.on("afterTransaction", onTransaction);
    return () => song.doc.off("afterTransaction", onTransaction);
  }, [song]);
}
