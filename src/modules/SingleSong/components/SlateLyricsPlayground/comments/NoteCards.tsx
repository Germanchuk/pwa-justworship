import { useEffect, useRef, useState } from "react";
import { ReactEditor, useSlateStatic } from "slate-react";

import { useCanAnnotate } from "../../../mode";
import type { NoteRecord } from "../types";
import { cardBg, cardBorder, DEFAULT_COMMENT_COLOR } from "./colors";
import { consumePendingFocus } from "./pendingFocus";
import { updateCommentBody } from "./withComments";
import "./comments.css";

const SAVE_DEBOUNCE_MS = 300;

type CardProps = {
  commentId: string;
  note: NoteRecord;
  canEdit: boolean;
};

const NoteCard = ({ commentId, note, canEdit }: CardProps) => {
  const editor = useSlateStatic();
  const [draft, setDraft] = useState(note.body);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(note.body);
  }, [note.body]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Автофокус, якщо примітку щойно створив цей користувач (CommentsFab
  // позначає commentId через setPendingFocus).
  useEffect(() => {
    if (!canEdit) return;
    if (!consumePendingFocus(commentId)) return;
    // Після нормалізації Slate і першого паінта — інакше DOM-вузла ще немає.
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [canEdit, commentId]);

  const onChange = (value: string) => {
    setDraft(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      updateCommentBody(editor, commentId, value);
    }, SAVE_DEBOUNCE_MS);
  };

  /**
   * Знімаємо з редактора прапорець «я у фокусі», коли каретка пішла в картку.
   *
   * Slate робить це сам лише тоді, коли фокус іде у VOID-вузол (`Editable`
   * `onBlur` виходить раніше для будь-якого не-void елемента). Поки картка
   * була void-якорем, це працювало; тепер вона живе всередині звичайного
   * рядка, тож редактор лишався б «сфокусованим» — а `isFocused` це єдина
   * умова, за якої layout-ефект `Editable` повертає DOM-селекшн на
   * `editor.selection`. На кожен запис тіла примітки каретка вискакувала б з
   * поля туди, де востаннє клікнули в пісні (ще й зі скролом).
   *
   * `ReactEditor.blur` тут лише скидає прапорець: сам `el.blur()` він кличе,
   * тільки якщо активний елемент — саме редактор, а він уже textarea.
   */
  const releaseEditorFocus = () => {
    try {
      ReactEditor.blur(editor);
    } catch {
      // Редактор саме зараз відмонтований — скидати нема чого.
    }
  };

  const color = note.color ?? DEFAULT_COMMENT_COLOR;

  return (
    <div
      className="note-card"
      style={{ backgroundColor: cardBg(color), borderColor: cardBorder(color) }}
    >
      <textarea
        ref={textareaRef}
        className="note-card__textarea"
        value={draft}
        onFocus={releaseEditorFocus}
        onChange={(e) => canEdit && onChange(e.target.value)}
        readOnly={!canEdit}
        placeholder={canEdit ? "Ваш коментар…" : ""}
        rows={Math.min(6, Math.max(1, draft.split("\n").length))}
      />
    </div>
  );
};

/**
 * Картки, що належать цьому рядку. Малюються ВСЕРЕДИНІ вузла рядка, першим
 * блоком — тому вони фізично розсовують текст (`NOTE-10`) і не можуть від
 * нього відірватись: у документі їх немає, є лише мітки на тексті.
 *
 * Список рахує `useNoteHeadsFor` — тут лише рендер.
 */
export const NoteCards = ({
  notes,
}: {
  notes: Array<{ commentId: string; note: NoteRecord }>;
}) => {
  // Текст примітки правиться лише в режимі приміток; в інших режимах картка
  // видима, але read-only.
  const canAnnotate = useCanAnnotate();

  if (notes.length === 0) return null;

  return (
    <div className="note-cards" contentEditable={false}>
      {notes.map(({ commentId, note }) => (
        <NoteCard
          key={commentId}
          commentId={commentId}
          note={note}
          canEdit={canAnnotate}
        />
      ))}
    </div>
  );
};
