import { useState } from "react";
import type { RenderElementProps } from "slate-react";
import { ReactEditor, useSlateStatic } from "slate-react";
import { PowerIcon } from "@heroicons/react/24/solid";
import { useCurrentUsername } from "../hooks";
import { CapoModal } from "./CapoModal";
import type { CapoElement } from "../../types";
import {
  resolveTransposition,
  setCapo,
  setCapoEnabled,
} from "../../transposition/operations";
import { keyDisplayName } from "../../transposition/transposeChords";
import "./Capo.css";

export function Capo(props: RenderElementProps) {
  const { attributes, children, element } = props;
  const editor = useSlateStatic();
  const [open, setOpen] = useState(false);
  const username = useCurrentUsername();
  const isReadonly = ReactEditor.isReadOnly(editor);

  const capo = element as CapoElement;
  // Запам'ятане значення капо (показуємо завжди, навіть коли вимкнено).
  const rawValue = (username && capo.valuesBy?.[username]) ?? 0;
  const enabled =
    rawValue > 0 && !(username ? capo.disabledFor?.includes(username) : true);
  const isEmpty = rawValue === 0;

  // effectiveKey з resolveTransposition коректний для обох станів (вимкнено → songKey).
  const { effectiveKey } = resolveTransposition(editor, username);

  const handleSave = (n: number) => {
    if (!username) return;
    setCapo(editor, username, n);
  };

  const togglePower = () => {
    if (!username || isReadonly) return;
    setCapoEnabled(editor, username, !enabled);
  };

  return (
    <div {...attributes} className="song-meta-line">
      <span
        contentEditable={false}
        className={`song-meta-badge ${isReadonly ? "song-meta-badge--readonly" : ""}`}
        onClick={() => !isReadonly && setOpen(true)}
      >
        <span className="song-meta-badge__label">Капо:</span>
        <span
          className={`song-meta-badge__value ${
            isEmpty ? "song-meta-badge__value--placeholder" : ""
          }`}
          style={!isEmpty && !enabled ? { opacity: 0.45 } : undefined}
        >
          {rawValue}
        </span>
        {enabled && (
          <span
            className="song-meta-badge__value"
            style={{ opacity: 0.6, fontSize: "0.85em", marginLeft: 4 }}
          >
            грає {keyDisplayName(effectiveKey)}
          </span>
        )}
      </span>

      {!isEmpty && !isReadonly && (
        <button
          type="button"
          contentEditable={false}
          className={`capo-power ${enabled ? "capo-power--on" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={togglePower}
          title={
            enabled
              ? "Капо ввімкнено — вимкнути, щоб редагувати акорди"
              : "Капо вимкнено — ввімкнути"
          }
        >
          <PowerIcon />
        </button>
      )}

      {children}
      {open && (
        <CapoModal
          current={rawValue}
          onSave={handleSave}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
