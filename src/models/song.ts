export interface Song {
  id: number;
  name: string;
  bpm: number;
  key: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  timeSignature?: "fourFour" | "threeFour";
  sections: Section[];
  // there is field 'owner' with detailed info, it's better to refactor it to isMy or something
}

export interface Section {
  id: number;
  content: string;
  spacing: number;
}

// Sections are mapping to the Lines for view purposes
export interface Line {
  token: string;
  type?: LineType;
  isFirst?: boolean;
  isLast?: boolean;
}

export enum LineType {
  SPACING = "spacing",
  CHORDS = "chords",
  HEADER = "header",
  LYRICS = "lyrics"
}

export type Status = "error" | "saved" | "saving" | "pending";
