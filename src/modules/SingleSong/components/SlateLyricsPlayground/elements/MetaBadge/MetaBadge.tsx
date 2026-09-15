import type { ReactNode } from "react";
import { useSlateStatic } from "slate-react";
import { releaseTextFocus } from "../releaseTextFocus";

interface Props {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  /** Бейдж не відкриває вікно (приглушений вигляд). */
  readonly?: boolean;
  className?: string;
  title?: string;
  onOpen: () => void;
}

/**
 * Бейдж мети пісні в мета-рядку. Лежить усередині `contenteditable`, тож
 * дотик за замовчуванням фокусує редактор і відкриває екранну клавіатуру —
 * `preventDefault` на `mousedown` цей фокус скасовує (як у кнопках поверх
 * тексту). Уже відкриту клавіатуру ховаємо в момент відкриття вікна.
 */
export function MetaBadge({
  label,
  value,
  valueClassName = "",
  readonly = false,
  className = "",
  title,
  onOpen,
}: Props) {
  const editor = useSlateStatic();

  return (
    <span
      contentEditable={false}
      className={`song-meta-badge ${readonly ? "song-meta-badge--readonly" : ""} ${className}`}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (readonly) return;
        releaseTextFocus(editor);
        onOpen();
      }}
    >
      <span className="song-meta-badge__label">{label}</span>
      <span className={`song-meta-badge__value ${valueClassName}`}>
        {value}
      </span>
    </span>
  );
}
