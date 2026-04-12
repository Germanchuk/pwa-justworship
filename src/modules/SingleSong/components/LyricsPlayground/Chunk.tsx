import {useEditMode, useTransposition} from "../../redux/selectors";
import classNames from "classnames";
import {Line} from "#modules/SingleSong/components/LyricsPlayground/Lines/Line";
import {Line as LineInterface} from "#models/song";
import {FC} from "react";

interface ChunkProps {
  index?: number;
  value: string;
  coloredLines?: LineInterface[];
  onChange: any;
  onKeyDown?: any;
  size: number;
  className?: string;
}

export const Chunk: FC<ChunkProps> = ({
  index = 0,
  value,
  coloredLines,
  onChange,
  onKeyDown = null,
  size,
  className = "",
}) => {
  const editMode = useEditMode();
  const transposition = useTransposition();
  const actualTransposition = editMode ? 0 : transposition;

  return (
    <div
      className={
        classNames(
          className,
          "Chunk",
          "min-h-96 bg-white",
          {["Chunk--editMode"]: editMode}
        )
      }
    >
      <div className={classNames("Chunk__overlay", {"absolute pointer-events-none bottom-0": editMode})}>
        {coloredLines?.map((line, index) => {
          const LineS = Line[line.type];
          return <LineS transposition={actualTransposition} index={index}>{line.token}</LineS>
        })}
      </div>
      {editMode && (
        <textarea
          name={"song content"}
          data-chunk-index={index}
          className={classNames(
            "Chunk__textarea",
            "focus:shadow-accent pr-4 pl-1 block"
          )}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          rows={size}
        />
      )}
    </div>
  );
}