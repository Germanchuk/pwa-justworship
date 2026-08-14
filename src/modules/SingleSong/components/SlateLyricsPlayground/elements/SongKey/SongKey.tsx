import { useState } from "react";
import type { RenderElementProps } from "slate-react";
import { useSlate } from "slate-react";
import { useCanEditContent } from "../../../../mode";
import { KeyPickerModal, type KeyChangeMode } from "./KeyPickerModal";
import type { SongKeyElement } from "../../types";
import type { SongKeyValue } from "../../transposition/model";
import { changePlayingKey, relabelKey } from "../../transposition/operations";
import { keyDisplayName } from "../../transposition/transposeChords";
import { useTransposition } from "../../transposition/useTransposition";

function display(k: string): string {
  return k.replace("sharp", "#");
}

export function SongKey(props: RenderElementProps) {
  const { attributes, children, element } = props;
  // useSlate (а не useSlateStatic): підпис «З капою» залежить від капо-елемента,
  // тож цей рядок має перемальовуватись і на зміни поза власним вузлом.
  const editor = useSlate();
  const [open, setOpen] = useState(false);
  const songKey = element as SongKeyElement;
  // Тональність — спільний вміст: правиться лише в режимі редагування.
  const isReadonly = !useCanEditContent();
  // myCapo === 0, коли капо не виставлено, вимкнено свічем АБО не діє в цьому
  // режимі — тож підпис «З капою» сам зникає в усіх трьох випадках.
  const { myCapo, effectiveKey } = useTransposition();

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
        title={
          isReadonly ? "Тональність змінюється в режимі редагування" : undefined
        }
        onClick={() => !isReadonly && setOpen(true)}
      >
        <span className="song-meta-badge__label">Тональність:</span>
        <span className="song-meta-badge__value">
          {display(songKey.keyValue || "C")}
        </span>
      </span>
      {myCapo > 0 && (
        <span contentEditable={false} className="song-meta-note">
          З капою: {keyDisplayName(effectiveKey)}
        </span>
      )}
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
