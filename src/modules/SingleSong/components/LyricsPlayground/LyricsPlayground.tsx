import {useBreakpoint} from "#hooks/useBreakpoint";
import {Breakpoints} from "#models/breakpoints";
import {Chunk} from "./Chunk";
import {syncValueWithSections} from "./actions";
import ChunkedTextarea from "./ChunkedTextarea";
import {useCallback, useState} from "react";
import {sectionsToLinesStream} from "../../utils/sectionsToLinesStream";
import {useEditMode} from "../../redux/selectors";
import classNames from "classnames";
import "./Chunk.css";
import {useMaxLines} from "#modules/SingleSong/components/LyricsPlayground/useMaxLines";

export default function LyricsPlayground({ sections }) {
  // common format is Array<Line> named linesStream;
  // 1. request Sections
  // 2. map sections to Array<Line>
  // 4. handle change
  // 5. gather them back to Sections
  // 7. auto-save Sections (debounced) after update
  const linesStream = sectionsToLinesStream(sections);

  const [pureTextValue, setPureTextValue] = useState<string | null>(() => linesStream.map(l => l.token).join("\n"));

  const isLessThanSM = !useBreakpoint(Breakpoints.SM);
  const editMode = useEditMode();

  const maxLines = useMaxLines();
  const textareaContentSize = pureTextValue?.split(("\n"))?.length;

  const textareaSize = textareaContentSize < maxLines ? maxLines : textareaContentSize;

  function handleSingleChunk(e) {
    const { value } = e.target;
    setPureTextValue(value);
    syncValueWithSections(value);
  }

  const handleMultiChunk = useCallback((updater) => {
    const newLines = updater(linesStream.map(l => l.token));
    syncValueWithSections(newLines.join("\n"));
  }, [linesStream]);

  console.log("PURE_VALUE: ", pureTextValue);

  return (
      <div className={classNames("sm:text-sm border border-dashed rounded-sm", {"border-gray-400": editMode, "border-white": !editMode})}>
        {isLessThanSM
          ? (
            <Chunk
              value={pureTextValue}
              coloredLines={linesStream}
              size={textareaSize}
              onChange={handleSingleChunk}
              className={"w-full"}
            />
          )
        : (
            <ChunkedTextarea
              value={pureTextValue}
              coloredLines={linesStream}
              setLines={handleMultiChunk}
            />
          )}
      </div>
  );
};
