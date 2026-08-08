import type { BaseEditor } from "slate";
import type { ReactEditor } from "slate-react";
import type { HistoryEditor } from "slate-history";

import type { DynamicsStepKey } from "./constants/dynamicsSteps";

export type CommentMark = {
  commentId: string;
  /**
   * Usernames that may see (and currently also manage) this mark.
   * The literal string "all" means everyone — public.
   * Private mark: `[authorUsername]`. Targeted: `[author, ...recipients]`.
   */
  visibleFor: string[];
  color: string;
  /** Username of the creator. Optional for back-compat with old data. */
  author?: string;
};

export type CustomText = {
  text: string;
  bold?: true;
  comment?: CommentMark[];
  // Decoration-only marks injected by `usePlayerDecorate`. Never persisted.
  chordToken?: true;
  chordTokenKey?: string;
  chordPlayingNow?: boolean;
  chordSelected?: boolean;
  chordInvalid?: boolean;
  // Per-user капо (режим 3): транспонований акорд для показу замість збереженого
  // тексту. Інжектиться лише у read-only для капо-юзера. Ніколи не персиститься.
  displayChord?: string;
};

/**
 * Примітка як така: текст картки плюс метадані самого коментаря.
 * Зберігається в `song-meta-row`, по одному пропу на коментар — див.
 * `comments/noteStore.ts`. Мітки на тексті (`CommentMark`) лишаються самим
 * якорем: вони кажуть ДЕ висить примітка, запис — ЩО вона таке.
 *
 * `color`/`visibleFor`/`author` навмисно дублюють мітку: коли текст під
 * приміткою видалили, міток уже немає, а показати втрачену примітку
 * потрібному адресату треба (`NOTE-29`).
 */
export type NoteRecord = {
  body: string;
  color: string;
  visibleFor: string[];
  author?: string;
};

/**
 * @deprecated Старий вузол-якір. Лишається тільки заради міграції існуючих
 * документів: `withComments` переносить його `body` у метадані й видаляє
 * вузол. Прибрати разом із міграцією, коли прод дожує старі пісні.
 */
export type CommentAnchorElement = {
  type: "comment-anchor";
  commentId: string;
  visibleFor: string[];
  color: string;
  body: string;
  author?: string;
  children: [{ text: "" }];
};

export type LineElement = { type: "line"; children: CustomText[] };
export type ChordLineElement = { type: "chord-line"; children: CustomText[] };
export type EmptyLineElement = { type: "empty-line"; children: CustomText[] };

export type LyricLineElement = { type: "lyric-line"; children: CustomText[] };
export type HeaderElement = { type: "header"; rawCaption: string; children: CustomText[] };

export type SectionChild =
  | LineElement
  | ChordLineElement
  | EmptyLineElement
  | LyricLineElement
  | HeaderElement
  | CommentAnchorElement;

export type SectionElement = {
  type: "section";
  sectionType?: string;
  number?: number;
  repeat?: number;
  collapsedFor?: string[];
  dynamicsSteps?: DynamicsStepKey[];
  children: SectionChild[];
};

// --- Document header (metadata block at top of every song) ---

export type SongNameElement = {
  type: "song-name";
  children: CustomText[];
};

export type BpmElement = {
  type: "bpm";
  children: CustomText[];
};

export type TimeSignatureElement = {
  type: "time-signature";
  children: CustomText[];
};

export type SongKeyElement = {
  type: "song-key";
  keyValue: string;
  children: CustomText[];
};

export type CapoElement = {
  type: "capo";
  valuesBy?: Record<string, number>;
  /**
   * Per-user прапорець "капо тимчасово вимкнено" (нік у списку = вимкнено).
   * Дозволяє пам'ятати значення капо (`valuesBy`), але не застосовувати його —
   * щоб глянути на акорди у тональності пісні й не забути, де було капо. Той
   * самий патерн, що `section.collapsedFor`.
   */
  disabledFor?: string[];
  children: CustomText[];
};

export type SongMetaChild =
  | BpmElement
  | TimeSignatureElement
  | SongKeyElement
  | CapoElement;

export type SongMetaRowElement = {
  type: "song-meta-row";
  /**
   * Per-user режими показу (нік у списку = сховано для нього). Той самий
   * патерн, що `section.collapsedFor` і `capo.disabledFor`.
   * Правило показу й місце в документі — див. `display/model.ts`.
   */
  chordsHiddenFor?: string[];
  lyricsHiddenFor?: string[];
  /**
   * Примітки пісні: ключ `note:<commentId>` → `NoteRecord`.
   *
   * ОДИН ПРОП НА КОМЕНТАР, а не один спільний обʼєкт: `@slate-yjs` пише кожен
   * проп вузла окремим Yjs-атрибутом, тож окремі ключі дають last-writer-wins
   * у межах одного коментаря. Спільний обʼєкт означав би, що двоє, хто правлять
   * РІЗНІ примітки одночасно, затирають один одного.
   *
   * Ключі формує `comments/noteStore.ts` — літерал тут лише тому, що
   * шаблонний індексний підпис не бере значення з константи.
   */
  [noteKey: `note:${string}`]: NoteRecord | undefined;
  children: SongMetaChild[];
};

export type CustomElement =
  | SectionElement
  | SectionChild
  | SongNameElement
  | SongMetaRowElement
  | SongMetaChild
  | CommentAnchorElement;

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
