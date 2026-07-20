import { useState } from "react";
import type { RenderElementProps } from "slate-react";
import { ReactEditor, useSlateStatic } from "slate-react";
import { KeyPickerModal, type KeyChangeMode } from "./KeyPickerModal";
import type { SongKeyElement } from "../../types";
import type { SongKeyValue } from "../../transposition/model";
import { changePlayingKey, relabelKey } from "../../transposition/operations";

function display(k: string): string {
  return k.replace("sharp", "#");
}

export function SongKey(props: RenderElementProps) {
  const { attributes, children, element } = props;
  const editor = useSlateStatic();
  const [open, setOpen] = useState(false);
  const songKey = element as SongKeyElement;
  const isReadonly = ReactEditor.isReadOnly(editor);

  const handlePick = (newKey: string, mode: KeyChangeMode) => {
    if (mode === "relabel") {
      relabelKey(editor, newKey as SongKeyValue);
    } else {
      changePlayingKey(editor, newKey as SongKeyValue);
    }
  };

  return (
    <div {...attributes} className="song-meta-line">
      <span
        contentEditable={false}
        className={`song-meta-badge ${isReadonly ? "song-meta-badge--readonly" : ""}`}
        onClick={() => !isReadonly && setOpen(true)}
      >
        <span className="song-meta-badge__label">Тональність:</span>
        <span className="song-meta-badge__value">
          {display(songKey.keyValue || "C")}
        </span>
      </span>
      {children}
      {open && (
        <KeyPickerModal
          current={songKey.keyValue || "C"}
          onPick={handlePick}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
