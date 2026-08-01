import "./Song.css";
import {useSongId} from "../redux/selectors";
import SlateLyricsPlayground from "./SlateLyricsPlayground/SlateLyricsPlayground";
import {PresenceList} from "./PresenceList/PresenceList";
import {MigrationGate} from "./MigrationGate/MigrationGate";
import {memo} from "react";

const Song = () => {
  const songId = useSongId();

  return (
    <div className="flex flex-col gap-4">
      {/*<PresenceList />*/}
      {songId && (
        <MigrationGate key={songId} songId={songId}>
          <SlateLyricsPlayground songId={songId} />
        </MigrationGate>
      )}
    </div>
  );
};

export default memo(Song);
