import {memo} from "react";
import {SongEditor} from "#modules/SongDocument/editor/SongEditor";
import {useSongId} from "../redux/selectors";

const Song = () => {
  const songId = useSongId();

  return (
    <div className="flex flex-col gap-4">
      {songId && <SongEditor key={songId} songId={songId} />}
    </div>
  );
};

export default memo(Song);
