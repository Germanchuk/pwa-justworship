import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReactEditor, useSlateStatic } from "slate-react";

import { useCanAnnotate } from "../../../mode";
import { useNotesViewers } from "../../../redux/selectors";
import type { NoteRecord } from "../types";
import { cardBg, cardBorder, DEFAULT_COMMENT_COLOR } from "./colors";
import { consumePendingFocus } from "./pendingFocus";
import { restCount } from "./visibility";
import { readNote, updateCommentBody } from "./withComments";
import "./comments.css";

const SAVE_DEBOUNCE_MS = 300;

/**
 * Поле росте під свій текст замість скролу — з урахуванням переносів, а не
 * лише `\n`. Перераховуємо на кожну зміну тексту і на зміну ШИРИНИ (поворот,
 * інша кількість колонок): вужче поле — більше перенесених рядків.
 *
 * CSS `field-sizing: content` робив би те саме, але iOS Safari його ще не знає.
 */
const useAutoHeight = (
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
) => {
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(fit, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      // Власна зміна висоти теж будить обсервер — реагуємо лише на ширину.
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

type CardProps = {
  commentId: string;
  note: NoteRecord;
  canEdit: boolean;
  /** Скільки адресатів у примітки ПОНАД тих, чиїми очима я дивлюсь. */
  rest: number;
};

const NoteCard = ({ commentId, note, canEdit, rest }: CardProps) => {
  const editor = useSlateStatic();
  const [draft, setDraft] = useState(note.body);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Набране, але ще не записане в документ; `null` — записувати нічого. */
  const unsaved = useRef<string | null>(null);
  const focused = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(textareaRef, draft);

  /**
   * Поки поле у фокусі — ним володіє користувач, поза фокусом — документ.
   *
   * Без цього правила власний запис повертався сюди як новий `note.body` із
   * запізненням (операція → onChange Slate → ререндер усього документа), і
   * `setDraft` відкочував поле назад — букви, набрані за цей час, зникали.
   * Ціна: чужу правку ТІЄЇ Ж примітки видно лише після виходу з поля.
   */
  useEffect(() => {
    if (!focused.current) setDraft(note.body);
  }, [note.body]);

  const flush = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
    if (unsaved.current === null) return;
    const body = unsaved.current;
    unsaved.current = null;
    try {
      updateCommentBody(editor, commentId, body);
    } catch {
      // Редактор уже відмонтований — писати нікуди.
    }
  };

  // На відмонтуванні не губимо хвіст, що ще чекав на дебаунс.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

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
    unsaved.current = value;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  };

  const onFocus = () => {
    focused.current = true;
    releaseEditorFocus();
  };

  /**
   * Віддаємо поле документу: дописуємо хвіст і читаємо тіло ПРЯМО з редактора —
   * `note.body` у пропсах ще старий, доки не прийде ререндер, і на мить
   * показав би текст без щойно набраних букв.
   */
  const onBlur = () => {
    focused.current = false;
    flush();
    const body = readNote(editor, commentId)?.body;
    if (body !== undefined) setDraft(body);
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
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => canEdit && onChange(e.target.value)}
        readOnly={!canEdit}
        placeholder={canEdit ? "Ваш коментар…" : ""}
        rows={1}
      />
      {rest > 0 && (
        /*
          Ця примітка ширша за мій вибір: окрім відмічених, її бачить ще `rest`
          людей (`NOTE-31`). Знак потрібен саме тут, бо видалення ЗВУЖУЄ —
          без нього моє «видалити» тихо лишало б картку комусь іще.
          Публічні коментарі сюди не потрапляють: їхню публічність уже видно
          за сірим кольором, і значок висів би на кожній картці.
        */
        <span
          className="note-card__rest"
          title={`Цю примітку бачить ще ${rest} поза вибраними`}
        >
          +{rest}
        </span>
      )}
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
  const viewers = useNotesViewers();

  if (notes.length === 0) return null;

  return (
    <div className="note-cards" contentEditable={false}>
      {notes.map(({ commentId, note }) => (
        <NoteCard
          key={commentId}
          commentId={commentId}
          note={note}
          canEdit={canAnnotate}
          rest={restCount(note, viewers)}
        />
      ))}
    </div>
  );
};
