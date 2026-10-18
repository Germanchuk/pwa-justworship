import type { Descendant } from "slate";

export interface Song {
  id: number;
  name: string;
  bpm: number;
  key: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  timeSignature?:
    | "fourFour"
    | "threeFour"
    | "sixEight"
    | "twoFour"
    | "fiveFour"
    | "twelveEight";
  slate?: Descendant[];
  // there is field 'owner' with detailed info, it's better to refactor it to isMy or something
}

export type Status = "error" | "saved" | "saving" | "pending";
