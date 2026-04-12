import React from "react";
import { rawTextToSongObject } from "../../utils/compiler/compiler";
import HighlightedOutput from "./HighlightedOutput/HighlightedOutput";
import RealInput from "./RealInput/RealInput";

export default function TextToSong() {
  const [text, setText] = React.useState("");
  return (
    <div
      // className="grid grid-cols-2 gap-8"
      className="relative h-full"
    >
      <div>
        <RealInput value={text} setValue={setText} />
      </div>
      <div
        className="absolute top-0 right-0 left-0 bottom-0"
        style={{ pointerEvents: "none" }}
      >
        <HighlightedOutput songObject={rawTextToSongObject(text)} hideSongName />
      </div>
    </div>
  );
}
