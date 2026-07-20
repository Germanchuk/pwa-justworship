import { useState } from "react";
import type { RenderElementProps } from "slate-react";
import { Node } from "slate";
import { ReactEditor, useSlateStatic } from "slate-react";
import { setVoidText } from "../setVoidText";
import { TimeSignatureModal } from "./TimeSignatureModal";

export function TimeSignature(props: RenderElementProps) {
  const { attributes, children, element } = props;
  const editor = useSlateStatic();
  const [open, setOpen] = useState(false);
  const isReadonly = ReactEditor.isReadOnly(editor);
  const value = Node.string(element) || "4/4";

  return (
    <div {...attributes} className="song-meta-line">
      <span
        contentEditable={false}
        className={`song-meta-badge ${isReadonly ? "song-meta-badge--readonly" : ""}`}
        onClick={() => !isReadonly && setOpen(true)}
      >
        <span className="song-meta-badge__label">Розмір:</span>
        <span className="song-meta-badge__value">{value}</span>
      </span>
      {children}
      {open && (
        <TimeSignatureModal
          current={value}
          onPick={(v) => setVoidText(editor, element, v)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
