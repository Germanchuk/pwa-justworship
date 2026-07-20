import type { RenderElementProps } from "slate-react";
import "./SongMetaRow.css";

export function SongMetaRow({ attributes, children }: RenderElementProps) {
  return (
    <div {...attributes} className="song-meta-row">
      {children}
    </div>
  );
}
