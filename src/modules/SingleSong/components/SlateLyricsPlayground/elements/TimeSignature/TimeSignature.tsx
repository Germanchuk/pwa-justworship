import { useState } from "react";
import type { RenderElementProps } from "slate-react";
import { Node } from "slate";
import { useSlateStatic } from "slate-react";
import { useCanEditContent } from "../../../../mode";
import { MetaBadge } from "../MetaBadge/MetaBadge";
import { setVoidText } from "../setVoidText";
import { TimeSignatureModal } from "./TimeSignatureModal";

export function TimeSignature(props: RenderElementProps) {
  const { attributes, children, element } = props;
  const editor = useSlateStatic();
  const [open, setOpen] = useState(false);
  // Мета пісні — спільний вміст: правиться лише в режимі редагування.
  const isReadonly = !useCanEditContent();
  const value = Node.string(element) || "4/4";

  return (
    <div {...attributes} className="song-meta-line">
      <MetaBadge
        label="Розмір:"
        value={value}
        readonly={isReadonly}
        title={isReadonly ? "Розмір змінюється в режимі редагування" : undefined}
        onOpen={() => setOpen(true)}
      />
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
