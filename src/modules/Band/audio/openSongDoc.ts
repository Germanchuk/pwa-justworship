import * as Y from "yjs";
import {HocuspocusProvider} from "@hocuspocus/provider";
import {yTextToSlateElement} from "@slate-yjs/core";
import type {Descendant} from "slate";

import {extractHeader, type SongHeader} from "#modules/SingleSong/services/songChords/extractHeader";
import {COLLAB_URL} from "#utils/serviceUrls";

export interface SongDocHandle {
  songId: string | number;
  /** Резолвиться після першої синхронізації з сервером. */
  synced: Promise<void>;
  /** Шапка пісні: читає поточний стан Y-документа при кожному виклику. */
  getHeader(): SongHeader;
  destroy(): void;
}

/**
 * Headless-підключення до документа пісні — без редактора й без Slate-байндингу.
 * Хост звуку відкриває так будь-яку пісню, яку йому скомандували грати:
 * підключився → синхронізувався → прочитав шапку (тональність, темп) → грає.
 * Правки, зроблені гуртом під час гри, підхопляться наступним вмиканням
 * (джерело читає живий документ).
 */
export function openSongDoc(songId: string | number): SongDocHandle {
  const url = COLLAB_URL;
  const token = localStorage.getItem("authToken") ?? "";

  const ydoc = new Y.Doc();
  // Той самий спільний корінь, що в редакторі (див. useCollabProvider).
  const sharedRoot = ydoc.get("content", Y.XmlText) as Y.XmlText;

  let resolveSynced: () => void;
  const synced = new Promise<void>((resolve) => {
    resolveSynced = resolve;
  });

  const provider = new HocuspocusProvider({
    url,
    name: `song:${songId}`,
    document: ydoc,
    token,
    onSynced: () => resolveSynced(),
  });

  return {
    songId,
    synced,
    getHeader() {
      return extractHeader(yTextToSlateElement(sharedRoot).children as Descendant[]);
    },
    destroy() {
      provider.destroy();
      ydoc.destroy();
    },
  };
}
