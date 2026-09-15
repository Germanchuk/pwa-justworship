import { Editor, Range, Transforms, type BaseRange } from "slate";
import { useState } from "react";
import { ReactEditor, useSlate } from "slate-react";
import {
  Highlighter,
  MessageSquareOff,
  MessageSquarePlus,
  Strikethrough,
  TextSelect,
  Trash2,
  Users,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useNotesViewers } from "../../../redux/selectors";
import { useCurrentUsername } from "../elements/hooks";
import type { CommentMark, CustomText } from "../types";
import {
  cardBorder,
  COMMENT_PALETTE,
  DEFAULT_COMMENT_COLOR,
  highlightBg,
  isStrike,
  selectedBg,
  STRIKE_COLOR,
} from "./colors";
import { setPendingFocus } from "./pendingFocus";
import { useAnnotationRange } from "./useAnnotationRange";
import { useBandMembers } from "./useBandMembers";
import { AUDIENCE_ALL, isVisibleToAll, restCount } from "./visibility";
import {
  addHighlight,
  commentCaret,
  commentRange,
  convertHighlightToNote,
  hasNote,
  removeComment,
  moveComment,
  removeNoteOnly,
  setCommentAudience,
  setCommentColor,
} from "./withComments";

const generateId = (): string => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const getCaretMarks = (
  editor: Editor,
  selection: BaseRange | null,
  viewers: string[],
): CommentMark[] => {
  if (viewers.length === 0) return [];
  if (!selection || !Range.isCollapsed(selection)) return [];
  try {
    const [leaf] = Editor.leaf(editor, selection.anchor);
    const arr = (leaf as CustomText).comment;
    if (!Array.isArray(arr)) return [];
    return arr.filter((m) => isVisibleToAll(m, viewers));
  } catch {
    return [];
  }
};

/**
 * Підсвітка позначок, обраних тапом (`NOTE-36`). Правило на `data-cid`, а не
 * проп у `RenderLeaf`: так не перемальовується жоден листок, а позначка на
 * кількох рядках (кілька span з тим самим `data-cid`) виділяється цілком.
 * `!important` — бо звичайний фон позначки стоїть інлайном.
 */
const selectedMarksCss = (marks: CommentMark[]): string =>
  marks
    .map((m) => {
      const color = m.color ?? DEFAULT_COMMENT_COLOR;
      return `[data-cid="${CSS.escape(m.commentId)}"] {
  background-color: ${selectedBg(color)} !important;
  box-shadow: inset 0 -2px 0 ${cardBorder(color)};
}`;
    })
    .join("\n");

const noLoseSelection = (e: React.MouseEvent) => e.preventDefault();

const iconBtnBase =
  "inline-flex size-14 items-center justify-center rounded-full shadow-md border border-black/10 transition-transform cursor-pointer hover:scale-105 active:scale-95";

const ColoredIconButton = ({
  color,
  onClick,
  title,
  children,
}: {
  color: string;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onMouseDown={noLoseSelection}
    onClick={onClick}
    title={title}
    // Same tone the text highlight uses (rgba alpha 0.32 over the page) so
    // the button reads as the highlight's lighter shade, not the raw color.
    style={{ backgroundColor: highlightBg(color) }}
    className={cn(iconBtnBase, "text-foreground")}
  >
    {children}
  </button>
);

/** Кружок кольору позначки; у закреслення кольору нема — його іконка. */
const ColorDot = ({ color }: { color: string }) =>
  isStrike(color) ? (
    <Strikethrough className="size-5" />
  ) : (
    <span
      className="size-5 rounded-full border border-black/10"
      style={{ backgroundColor: cardBorder(color) }}
    />
  );

const menuIconButton = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "rounded-full",
);

/**
 * Колір позначки (`NOTE-42`): кружок угорі меню, по тапу — та сама палітра,
 * що й при створенні, разом із закресленням.
 */
const MarkColorMenu = ({ mark }: { mark: CommentMark }) => {
  const editor = useSlate();
  const color = mark.color ?? DEFAULT_COMMENT_COLOR;
  const options = [
    ...COMMENT_PALETTE.map((c) => ({ key: c.name, color: c.hex })),
    { key: "strike", color: STRIKE_COLOR },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Колір"
        aria-label="Колір"
        className={menuIconButton}
      >
        <ColorDot color={color} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="start" className="min-w-0 p-1">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.key}
            title={o.key === "strike" ? "Закреслення" : o.key}
            onSelect={() => setCommentColor(editor, mark.commentId, o.color)}
            className={cn(
              "justify-center rounded-full p-2",
              o.color === color && "bg-accent",
            )}
          >
            <ColorDot color={o.color} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Хто бачить позначку (`NOTE-37`): учасники гурту з галочками, як у виборі
 * «чиїми очима» (`NotesAudienceSelect`). Правка йде одразу в документ.
 *
 *  - останню галочку зняти не можна — для видалення є смітник;
 *  - зняти можна й тих, чиїми очима я дивлюсь: тоді позначка зникає з мого
 *    екрана разом із цим меню — я віддав її іншим;
 *  - публічному коментарю кнопки нема: «всім» — не перелік, міняти нема чого;
 *  - у гурті з однієї людини — теж нема, вибирати нема з кого.
 */
const MarkAudienceMenu = ({ mark }: { mark: CommentMark }) => {
  const editor = useSlate();
  const me = useCurrentUsername();
  const members = useBandMembers();

  const current = mark.visibleFor;
  if (current.includes(AUDIENCE_ALL)) return null;

  const memberNames = members
    .map((m) => m.username)
    .filter((u): u is string => !!u && u !== me);
  // Хто вже вийшов з гурту, але досі в адресатах, — теж у списку, щоб його
  // можна було зняти.
  const former = current.filter((u) => u !== me && !memberNames.includes(u));
  const ordered = [...(me ? [me] : []), ...memberNames, ...former];
  if (ordered.length < 2) return null;

  const toggle = (username: string) => {
    const next = new Set(current);
    if (!next.delete(username)) next.add(username);
    // Порядок галочок, а не кліків — як у `NotesAudienceSelect`.
    setCommentAudience(
      editor,
      mark.commentId,
      ordered.filter((u) => next.has(u)),
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Хто бачить"
        aria-label="Хто бачить"
        className={menuIconButton}
      >
        <Users className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="end" className="min-w-48">
        <DropdownMenuLabel>Хто бачить</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ordered.map((username) => {
          const checked = current.includes(username);
          return (
            <DropdownMenuCheckboxItem
              key={username}
              checked={checked}
              disabled={checked && current.length === 1}
              // Меню лишається відкритим: кілька людей — кілька тапів поспіль.
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(username)}
            >
              {username === me ? "Я" : username}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const CommentsFab = () => {
  const editor = useSlate();
  // `me` — автор нової позначки (завжди я, хто б не був адресатом).
  // `viewers` — чиї позначки зараз показуються й кому адресуються нові:
  // відмічених може бути кілька, і тоді позначка створюється ОДНА на всіх.
  const me = useCurrentUsername();
  const viewers = useNotesViewers();
  // Не `editor.selection`: у режимі приміток редактор read-only, і Slate
  // тримає там виділення лише на мить застосування позначки.
  const { range, select } = useAnnotationRange(editor);
  // Позначка, чию область зараз змінюють (`NOTE-43`). Поки це так, виділення
  // в тексті — нова область, а не заготовка під нову позначку.
  const [resizing, setResizing] = useState<string | null>(null);
  const hasSel =
    !resizing && viewers.length > 0 && !!range && Range.isExpanded(range);
  // Обрані позначки: під «курсором», який ставить тап по позначці або
  // створення нової. Поки вони є, їхнє меню відкрите — без окремої кнопки.
  const selectedMarks =
    !hasSel && !resizing ? getCaretMarks(editor, range, viewers) : [];
  const visible = !!resizing || hasSel || selectedMarks.length > 0;

  // Виділення → одразу позначка обраного кольору (`NOTE-7`). Щойно створена
  // вона стає обраною, як після тапу по ній: звідси до неї дописують текст.
  const applyHighlight = (color: string) => {
    if (!range || !Range.isExpanded(range) || viewers.length === 0) return;
    const id = generateId();
    try {
      Transforms.select(editor, range);
    } catch {
      select(null);
      return;
    }
    addHighlight(editor, id, [...viewers], color, me);
    Transforms.deselect(editor);
    select(commentCaret(editor, id));
  };

  // Виділяємо всю позначку нативним виділенням — далі користувач тягне
  // ручки, а `useAnnotationRange` стежить за новою областю.
  const startResize = (commentId: string) => {
    const current = commentRange(editor, commentId);
    const sel = window.getSelection();
    if (!current || !sel) return;
    try {
      const dom = ReactEditor.toDOMRange(editor, current);
      sel.removeAllRanges();
      sel.addRange(dom);
    } catch {
      return;
    }
    setResizing(commentId);
  };

  // Той самий тап застосовує. Виділення зняли (тап повз) — нічого не міняємо,
  // позначка просто лишається обраною.
  const finishResize = () => {
    if (!resizing) return;
    if (range && Range.isExpanded(range)) {
      try {
        moveComment(editor, resizing, range);
      } catch {
        // Область застаріла (документ змінився під ногами) — лишаємо як було.
      }
      Transforms.deselect(editor);
    }
    select(commentCaret(editor, resizing));
    setResizing(null);
  };

  const doAddNote = (commentId: string) => {
    setPendingFocus(commentId);
    convertHighlightToNote(editor, commentId, "");
  };

  return (
    <div
      // Звичайний `fixed`: клавіатура в режимі приміток відкривається лише в
      // картці, тож підлаштовуватись під visual viewport більше не треба.
      className="fixed right-2 z-40 flex flex-col items-end gap-2 transition-opacity duration-200"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
      onMouseDown={noLoseSelection}
    >
      {selectedMarks.length > 0 && (
        <style>{selectedMarksCss(selectedMarks)}</style>
      )}

      {resizing && (
        <div className="glass flex flex-col items-center gap-1 rounded-2xl p-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-accent"
            onClick={finishResize}
            aria-label="Застосувати область"
            title="Застосувати область"
          >
            <TextSelect className="size-5" />
          </Button>
        </div>
      )}

      {hasSel && (
        <>
          {COMMENT_PALETTE.map((c) => (
            <ColoredIconButton
              key={c.name}
              color={c.hex}
              title={`Виділити: ${c.name}`}
              onClick={() => applyHighlight(c.hex)}
            >
              <Highlighter className="size-5" />
            </ColoredIconButton>
          ))}
          {/* Іконка інша, ніж у кольорових: ті розрізняються кольором,
              а закреслення кольору не має. */}
          <ColoredIconButton
            color={STRIKE_COLOR}
            title="Закреслити"
            onClick={() => applyHighlight(STRIKE_COLOR)}
          >
            <Strikethrough className="size-5" />
          </ColoredIconButton>
        </>
      )}

      {/* Меню обраної позначки — у стилі меню пісні (`SongControls`): скляна
          плашка з безбарвними кнопками. Яку позначку правимо, видно з її
          підсвітки в тексті (`selectedMarksCss`). */}
      {selectedMarks.map((m) => {
        const noted = hasNote(editor, m.commentId);
        // Скільки адресатів переживе видалення: коментар ширший за мій
        // вибір не зникає, а звужується — кнопка має казати це чесно.
        const rest = restCount(m, viewers);
        const deleteTitle =
          rest > 0
            ? `Видалити у вибраних (лишиться ще в ${rest})`
            : "Видалити повністю";
        const noteTitle = noted
          ? "Прибрати нотатку, лишити виділення"
          : "Додати нотатку";
        return (
          <div
            key={m.commentId}
            className="glass flex flex-col items-center gap-1 rounded-2xl p-1"
          >
            <MarkColorMenu mark={m} />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => startResize(m.commentId)}
              aria-label="Змінити область"
              title="Змінити область"
            >
              <TextSelect className="size-5" />
            </Button>
            <MarkAudienceMenu mark={m} />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() =>
                noted
                  ? removeNoteOnly(editor, m.commentId)
                  : doAddNote(m.commentId)
              }
              aria-label={noteTitle}
              title={noteTitle}
            >
              {noted ? (
                <MessageSquareOff className="size-5" />
              ) : (
                <MessageSquarePlus className="size-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => removeComment(editor, m.commentId, viewers)}
              aria-label={deleteTitle}
              title={deleteTitle}
            >
              <Trash2 className="size-5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};
