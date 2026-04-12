import "./Song.css";
import KeySelector from "./Widgets/KeySelector/KeySelector";
import BpmSelector from "./Widgets/BpmSelector/BpmSelector";
import classNames from "classnames";
import CapoSelector from "./Widgets/CapoSelector/CapoSelector";
import {useShouldHideChords, useSections, useShouldShowChordsAgainstPreferences, useSongId} from "../redux/selectors";
import LyricsPlayground from "./LyricsPlayground/LyricsPlayground";
import TimeSignatureSelector from "./Widgets/TimeSignatureSelector/TimeSignatureSelector";
import {memo} from "react";

const Song = () => {
  const shouldHideChords = useShouldHideChords();
  const shouldShowChordsAgainstPreferences = useShouldShowChordsAgainstPreferences();

  const hideChords = shouldHideChords && !shouldShowChordsAgainstPreferences;

  const sections = useSections();
  const songId = useSongId();

  return (
    <div
      className={classNames("flex flex-col gap-4", {
        hideChords: hideChords,
      })}
    >
      {/*<SongStatus />*/}
      <div className="flex flex-wrap gap-1">
        {/* column-like widget-zone */}
        <KeySelector />
        <CapoSelector />
        <BpmSelector />
        <TimeSignatureSelector />
        <div className="flex gap-2">
          {/* row-like widget zone, behavior flex-wrap */}
        </div>
      </div>
      {songId && <LyricsPlayground sections={sections} />}
    </div>
  );
};

export default memo(Song);