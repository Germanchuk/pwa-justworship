import { useState } from "react";
import type { RenderElementProps } from "slate-react";
import { useSlateStatic } from "slate-react";
import { Switch } from "@/components/ui/switch";
import { useCapoApplies, useSettingsEditable } from "../../../../mode";
import { useCurrentUsername } from "../hooks";
import { CapoModal } from "./CapoModal";
import type { CapoElement } from "../../types";
import { setCapo, setCapoEnabled } from "../../transposition/operations";

export function Capo(props: RenderElementProps) {
  const { attributes, children, element } = props;
  const editor = useSlateStatic();
  const [open, setOpen] = useState(false);
  const username = useCurrentUsername();
  // Поза читанням капо не діє (таблиця в `mode.tsx`) — тоді бейдж показує
  // ефективний стан: приглушений, свіч вимкнений, значення на місці.
  const capoApplies = useCapoApplies();
  // У знімку (режим зібрання) капо ДІЄ, але міняти його нікуди записати —
  // бейдж і свіч поводяться так само, як поза читанням.
  const editable = useSettingsEditable();
  const interactive = capoApplies && editable;

  const capo = element as CapoElement;
  // Запам'ятане значення капо (показуємо завжди, навіть коли вимкнено).
  const rawValue = (username && capo.valuesBy?.[username]) ?? 0;
  const enabled =
    rawValue > 0 && !(username ? capo.disabledFor?.includes(username) : true);
  const isEmpty = rawValue === 0;
  const active = enabled && capoApplies;

  const handleSave = (n: number) => {
    if (!username) return;
    setCapo(editor, username, n);
  };

  const togglePower = () => {
    if (!username) return;
    setCapoEnabled(editor, username, !enabled);
  };

  const title = !editable
    ? rawValue > 0
      ? `Капо ${rawValue} — як збережено в пісні`
      : "Капо не виставлене"
    : !capoApplies
    ? "Капо діє лише в режимі читання — тут акорди показані у тональності пісні"
    : isEmpty
      ? "Спочатку виберіть лад капо"
      : enabled
        ? "Капо ввімкнено — вимкнути, щоб бачити акорди у тональності пісні"
        : "Капо вимкнено — ввімкнути";

  // Капо — per-user налаштування показу (не спільний вміст), тож виставляти
  // його можна й у читанні: музикант має могти поставити своє капо.
  return (
    <div {...attributes} className="song-meta-line">
      <span
        contentEditable={false}
        className={`song-meta-badge ${
          interactive ? "" : "song-meta-badge--readonly song-meta-badge--inert"
        }`}
        onClick={() => interactive && setOpen(true)}
        title={interactive ? undefined : title}
      >
        <span className="song-meta-badge__label">Капо:</span>
        <span
          className={`song-meta-badge__value ${
            isEmpty ? "song-meta-badge__value--placeholder" : ""
          } ${!isEmpty && !active ? "song-meta-badge__value--muted" : ""}`}
        >
          {rawValue}
        </span>
      </span>

      {/* Свіч завжди в DOM: при капо=0 (або коли режим його не застосовує)
          просто disabled, щоб рядок не стрибав при зміні стану. */}
      <span
        contentEditable={false}
        className="ml-1.5 inline-flex"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Switch
          checked={active}
          disabled={isEmpty || !interactive}
          onCheckedChange={togglePower}
          aria-label="Капо"
          title={title}
        />
      </span>

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
