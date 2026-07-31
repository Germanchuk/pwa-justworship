import {Section, Line, LineType} from "#models/song";
import {defineLineType} from "#modules/SingleSong/utils/defineLineType";

export const sectionsToLinesStream: (sections: Section[]) => Line[] = (sections) => {
  // this function transforms sections array obtained from be/db - to Array<Line>
  // we need this to show data in split text areas and other cases
  // output lines should exactly represent input sections
  if (!sections?.length) {
    return  [];
  }

  return sections?.flatMap((sec) => {
    const rawLines = sec.content.split('\n');

    const lines: Line[] = rawLines.map((line, index, array) => ({
      token: line, // Assuming 'token' based on your previous message
      type: defineLineType(line, { firstSectionLine: index === 0 }),
      isFirst: index === 0,
      isLast: index === array.length - 1
    }));

    const spacingCount = sec.spacing ?? 2;
    const spacingLines: Line[] = Array.from({ length: spacingCount - 1 }, () => ({
      token: "",   // Empty token for spacing
      type: LineType.SPACING,
    }));

    return [...lines, ...spacingLines];
  });

};
