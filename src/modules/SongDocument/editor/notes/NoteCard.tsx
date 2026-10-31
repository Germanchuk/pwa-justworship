/**
 * Картка примітки над доріжкою. Текст правиться прямо в картці (`NOTE-4`) —
 * у будь-якому режимі; видалити, змінити колір, область, адресатів — з меню
 * позначки (`NotesTools`), тап по позначеному тексту.
 *
 * Сама картка (`NoteCardBox`) — без Slate: її ж показує смуга (`strip/`).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReactEditor, useSlateStatic } from "slate-react";
import { cn } from "@/lib/utils";
import { cardBg, cardBorder } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/colors";
import { consumePendingFocus } from "#modules/SingleSong/components/SlateLyricsPlayground/comments/pendingFocus";
import { othersSeeing, type NoteView } from "../../model";
import { useEditorCtx } from "../context";

const SAVE_DEBOUNCE_MS = 300;

/** Поле росте під свій текст (з переносами) замість скролу; `field-sizing` iOS ще не знає. */
function useAutoHeight(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, on = true) {
  const fit = () => {
    const el = ref.current;
    if (!el || !on) return;
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
      if (el.clientWidth === width) return; // власна зміна висоти теж будить — лише ширина
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function NoteCard({ view }: { view: NoteView }) {
  const ctx = useEditorCtx();
  const editor = useSlateStatic();
  return (
    <NoteCardBox
      view={view}
      canAnnotate={ctx.canAnnotate}
      viewers={ctx.viewers}
      onBody={(body) => ctx.onNoteBody(view, body)}
      onBlur={() => ctx.onNoteBlur(view)}
      // Каретка пішла в картку: редактор має перестати вважати себе у
      // фокусі, інакше після кожного запису повертав би DOM-виділення в пісню.
      onFocus={() => {
        try {
          ReactEditor.blur(editor);
        } catch {
          // редактор щойно відмонтований
        }
      }}
    />
  );
}

type BoxProps = {
  view: NoteView;
  canAnnotate: boolean;
  viewers: string[];
  onBody: (body: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Завширшки як текст (не вужче за порожню), а не на всю ширину: так у смузі. */
  fit?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function NoteCardBox({ view, canAnnotate, viewers, onBody, onFocus, onBlur, fit = false, className, style }: BoxProps) {
  const { note } = view;
  const color = note.color || "#F5C518";
  const [draft, setDraft] = useState(note.body);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Набране, але ще не записане; `null` — нічого. */
  const unsaved = useRef<string | null>(null);
  const focused = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const latest = useRef({ onBody, onBlur });
  latest.current = { onBody, onBlur };
  useAutoHeight(field, draft, !fit);

  // Поки поле у фокусі — ним володіє людина, поза фокусом — документ: свій же
  // запис, що повернувся із запізненням, не відкотить щойно набрані букви.
  useEffect(() => {
    if (!focused.current) setDraft(note.body);
  }, [note.body]);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (unsaved.current === null) return;
    const body = unsaved.current;
    unsaved.current = null;
    latest.current.onBody(body);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []); // хвіст дебаунсу не губимо

  // Щойно «додати нотатку» — фокус сюди (клавіатуру на iOS відкрив тап, `pendingFocus`).
  useEffect(() => {
    if (canAnnotate && consumePendingFocus(note.id)) requestAnimationFrame(() => field.current?.focus());
  }, [canAnnotate, note.id]);

  const placeholder = canAnnotate ? "Ваш коментар…" : "";
  const rest = othersSeeing(note, viewers);
  // 16px — інакше iOS зумить сторінку на фокусі.
  const font: React.CSSProperties = {
    font: "inherit",
    fontSize: 16,
    lineHeight: 1.4,
    color: "inherit",
  };
  const textarea = (
    <textarea
      ref={field}
      rows={1}
      value={draft}
      readOnly={!canAnnotate}
      placeholder={placeholder}
      aria-label="Текст примітки"
      className={cn(
        "min-w-0 resize-none overflow-hidden bg-transparent outline-none border-0 p-0 select-text",
        fit ? "absolute inset-0 h-full w-full" : "flex-1",
      )}
      style={font}
      onFocus={() => {
        focused.current = true;
        onFocus?.();
      }}
      onBlur={() => {
        focused.current = false;
        flush();
        latest.current.onBlur?.();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        unsaved.current = e.target.value;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
      }}
    />
  );
  return (
    <div
      contentEditable={false}
      className={cn("rounded border-l-4 px-2 py-0.5 text-sm font-normal flex items-start gap-2", !fit && "my-1 mr-1", className)}
      style={{
        fontFamily: "Pangolin, cursive",
        background: cardBg(color),
        borderColor: cardBorder(color),
        color: "#3f2a06",
        ...style,
      }}
    >
      {fit ? (
        // Поле — завширшки й заввишки як текст: розмір тримає невидима копія тексту, поле лежить поверх
        // (сама `textarea` мала б свою ширину з `cols`).
        <div className="relative min-w-24 flex-1">
          <span aria-hidden className="invisible block whitespace-pre-wrap break-words" style={font}>
            {(draft || placeholder) + " "}
          </span>
          {textarea}
        </div>
      ) : (
        textarea
      )}
      {rest > 0 && (
        // Бачить ще стільки людей поза вибраними (`NOTE-31`): видалення лише звузить.
        <span className="text-xs text-stone-500 shrink-0 self-center" title={`Цю примітку бачить ще ${rest} поза вибраними`}>
          +{rest}
        </span>
      )}
      {note.author && <span className="text-xs text-stone-500 shrink-0 self-center">{note.author}</span>}
    </div>
  );
}
