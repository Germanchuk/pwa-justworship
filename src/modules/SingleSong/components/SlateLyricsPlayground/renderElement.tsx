import type { RenderElementProps } from "slate-react";

import { ChordLine } from "./elements/ChordLine/ChordLine";
import { EmptyLine } from "./elements/EmptyLine/EmptyLine";
import { Line } from "./elements/Line/Line";
import { Section } from "./elements/Section/Section";
import { SongName } from "./elements/SongName/SongName";
import { SongMetaRow } from "./elements/SongMetaRow/SongMetaRow";
import { Bpm } from "./elements/Bpm/Bpm";
import { TimeSignature } from "./elements/TimeSignature/TimeSignature";
import { SongKey } from "./elements/SongKey/SongKey";
import { Capo } from "./elements/Capo/Capo";
import { CommentAnchor } from "./comments/CommentAnchor";

export const renderElement = (props: RenderElementProps) => {
  switch (props.element.type) {
    case "comment-anchor":
      return <CommentAnchor {...props} />;
    case "section":
      return <Section {...props} />;
    case "empty-line":
      return <EmptyLine {...props} />;
    case "chord-line":
      return <ChordLine {...props} />;
    case "line":
      return <Line {...props} />;
    case "song-name":
      return <SongName {...props} />;
    case "song-meta-row":
      return <SongMetaRow {...props} />;
    case "bpm":
      return <Bpm {...props} />;
    case "time-signature":
      return <TimeSignature {...props} />;
    case "song-key":
      return <SongKey {...props} />;
    case "capo":
      return <Capo {...props} />;
    default:
      return <p {...props.attributes}>{props.children}</p>;
  }
};
