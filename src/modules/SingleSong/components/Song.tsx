import "./Song.css";
import {useSongId} from "../redux/selectors";
import SlateLyricsPlayground from "./SlateLyricsPlayground/SlateLyricsPlayground";
import {PresenceList} from "./PresenceList/PresenceList";
import {memo} from "react";

const Song = () => {
  const songId = useSongId();

  return (
    <div className="flex flex-col gap-4">
      <PresenceList />
      {songId && (
        <SlateLyricsPlayground key={songId} songId={songId} />
      )}
    </div>
  );
};

export default memo(Song);
