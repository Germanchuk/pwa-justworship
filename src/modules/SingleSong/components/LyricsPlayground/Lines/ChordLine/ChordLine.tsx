import React from "react";
import ChordTooltip from "./ChordTooltip/ChordTooltip";

export default function ChordLine({ children }) {
  const parts = children.split(/(\s+)/);
  return (
    <div className="text-primary chords whitespace-pre-wrap pr-4 pl-1">
      {parts.map((part, index) =>
        part.trim() && part.trim() !== "." && part.trim() !== "|" ? (
          <ChordTooltip key={index}>{part}</ChordTooltip>
        ) : (
          part // Keeps the spaces and . | as they are
        )
      )}
    </div>
  );
}
