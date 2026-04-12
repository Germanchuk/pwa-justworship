import {LineType} from "#models/song";
import {isSongStructureLine} from "#utils/structureCaptionDetector";
import {isChordsLine} from "#utils/keyUtils";

export const defineLineType = (rawLine: string, {firstSectionLine}): LineType => {
  switch (true) {
    case firstSectionLine && isSongStructureLine(rawLine):
      return LineType.HEADER;
    case isChordsLine(rawLine):
      return LineType.CHORDS;
    default:
      return LineType.LYRICS;
  }
}