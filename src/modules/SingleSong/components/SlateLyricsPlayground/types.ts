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
   * щоб редагувати акорди й не забути, де було капо. Той самий патерн, що
   * `section.collapsedFor`.
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
