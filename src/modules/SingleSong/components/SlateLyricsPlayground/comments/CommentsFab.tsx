import { useEffect, useRef, useState } from "react";
import { Editor, Range, Transforms, type BaseRange } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import {
  Captions,
  Highlighter,
  Megaphone,
  MessageSquareOff,
  MessageSquarePlus,
  PencilOff,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useNotesViewer } from "../../../redux/selectors";
import { useCurrentUsername } from "../elements/hooks";
import type { CommentMark, CustomText } from "../types";
import {
  COMMENT_PALETTE,
  highlightBg,
  PUBLIC_COMMENT_COLOR,
} from "./colors";
import { setPendingFocus } from "./pendingFocus";
import { isVisibleTo, privateTo, publicVisibility } from "./visibility";
import {
  addHighlight,
  addNote,
  convertHighlightToNote,
  hasNote,
  removeComment,
  removeNoteOnly,
} from "./withComments";

const FAB_SIZE = 56;
const FAB_RIGHT = 8;
// Vertical anchor for the FAB inside the visual viewport (0 = top, 1 = bottom).
const FAB_V_RATIO = 0.85;

const generateId = (): string => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const getCaretMarks = (
  editor: Editor,
  viewer: string | undefined,
): CommentMark[] => {
  if (!viewer) return [];
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) return [];
  try {
    const [leaf] = Editor.leaf(editor, selection.anchor);
    const arr = (leaf as CustomText).comment;
    if (!Array.isArray(arr)) return [];
    return arr.filter((m) => isVisibleTo(m, viewer));
  } catch {
    return [];
  }
};

const noLoseSelection = (e: React.MouseEvent) => e.preventDefault();

const useRafPin = (ref: React.RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const vv =
      typeof window === "undefined" ? null : window.visualViewport ?? null;

    let raf = 0;
    let prevTx = NaN;
    let prevTy = NaN;

    const fallbackWidth = () =>
      typeof window === "undefined" ? 0 : window.innerWidth;
    const fallbackHeight = () =>
      typeof window === "undefined" ? 0 : window.innerHeight;

    const tick = () => {
      const el = ref.current;
      if (el) {
        const left = vv ? vv.offsetLeft : 0;
        const top = vv ? vv.offsetTop : 0;
        const width = vv ? vv.width : fallbackWidth();
        const height = vv ? vv.height : fallbackHeight();

        const tx = left + width - FAB_SIZE - FAB_RIGHT;
        const ty = top + height * FAB_V_RATIO;

        if (tx !== prevTx || ty !== prevTy) {
          el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
          prevTx = tx;
          prevTy = ty;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
};

const iconBtnBase =
  "inline-flex size-14 items-center justify-center rounded-full shadow-md border border-black/10 transition-transform cursor-pointer hover:scale-105 active:scale-95";

const NeutralIconButton = ({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onMouseDown={noLoseSelection}
    onClick={onClick}
    title={title}
    className={cn(iconBtnBase, "bg-secondary text-secondary-foreground")}
  >
    {children}
  </button>
);

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
  destructive?: boolean;
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

type AddPhase = "kind" | "color-highlight" | "color-note";

type OpenContext =
  | { mode: "add" }
  | { mode: "manage"; marks: CommentMark[] }
  | null;

export const CommentsFab = () => {
  const editor = useSlate();
  // `me` — автор нової примітки (завжди я, хто б її не адресат).
  // `viewer` — чиї примітки зараз показуються й кому адресуються нові.
  const me = useCurrentUsername();
  const viewer = useNotesViewer();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<AddPhase>("kind");
  const [openCtx, setOpenCtx] = useState<OpenContext>(null);
  const savedSel = useRef<BaseRange | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useRafPin(wrapRef);

  const { selection } = editor;
  const hasSel = !!viewer && !!selection && Range.isExpanded(selection);
  const liveMarksAtCaret = !hasSel ? getCaretMarks(editor, viewer) : [];
  const hasMarksAtCaret = liveMarksAtCaret.length > 0;
  const visible = hasSel || hasMarksAtCaret || open;

  useEffect(() => {
    if (!open) {
      setPhase("kind");
      setOpenCtx(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (wrapRef.current && wrapRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, [open]);

  const restoreSelection = (): BaseRange | null => {
    const sel = savedSel.current;
    if (!sel) return null;
    try {
      ReactEditor.focus(editor);
      Transforms.select(editor, sel);
      return sel;
    } catch {
      return null;
    }
  };

  const applyHighlight = (color: string) => {
    if (!viewer) return;
    const sel = restoreSelection();
    if (!sel || !Range.isExpanded(sel)) {
      setOpen(false);
      return;
    }
    addHighlight(editor, generateId(), privateTo(viewer), color, me);
    Transforms.deselect(editor);
    savedSel.current = null;
    setOpen(false);
  };

  const applyNote = (color: string) => {
    if (!viewer) return;
    const sel = restoreSelection();
    if (!sel || !Range.isExpanded(sel)) {
      setOpen(false);
      return;
    }
    const id = generateId();
    setPendingFocus(id);
    addNote(editor, id, privateTo(viewer), color, "", me);
    Transforms.deselect(editor);
    savedSel.current = null;
    setOpen(false);
  };

  const applyPublicNote = () => {
    if (!viewer) return;
    const sel = restoreSelection();
    if (!sel || !Range.isExpanded(sel)) {
      setOpen(false);
      return;
    }
    const id = generateId();
    setPendingFocus(id);
    addNote(editor, id, publicVisibility(), PUBLIC_COMMENT_COLOR, "", me);
    Transforms.deselect(editor);
    savedSel.current = null;
    setOpen(false);
  };

  const doDelete = (commentId: string) => {
    removeComment(editor, commentId);
    setOpen(false);
  };

  const doAddNote = (commentId: string) => {
    setPendingFocus(commentId);
    convertHighlightToNote(editor, commentId, "");
    setOpen(false);
  };

  const doRemoveNote = (commentId: string) => {
    removeNoteOnly(editor, commentId);
    setOpen(false);
  };

  const onTriggerMouseDown = (e: React.MouseEvent) => {
    const sel = editor.selection;
    if (sel && Range.isExpanded(sel)) {
      savedSel.current = sel;
      setOpenCtx({ mode: "add" });
    } else {
      const marks = getCaretMarks(editor, viewer);
      if (marks.length > 0) {
        savedSel.current = sel ?? null;
        setOpenCtx({ mode: "manage", marks });
      } else {
        savedSel.current = null;
        setOpenCtx(null);
      }
    }
    e.preventDefault();
  };

  const onTriggerClick = () => {
    setOpen((o) => !o);
  };

  return (
    <div
      ref={wrapRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: FAB_SIZE,
        height: FAB_SIZE,
        zIndex: 40,
        willChange: "transform, opacity",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 180ms ease-out",
      }}
    >
      <Button
        variant="secondary"
        size="icon"
        aria-label="Коментарі"
        onMouseDown={onTriggerMouseDown}
        onClick={onTriggerClick}
        className="size-14 rounded-full shadow-lg relative"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : hasSel ? (
          <Captions className="h-6 w-6" />
        ) : (
          <PencilOff className="h-6 w-6" />
        )}
        {!open && hasMarksAtCaret && (
          <span className="absolute -top-1 -right-1 size-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-none flex items-center justify-center">
            {liveMarksAtCaret.length}
          </span>
        )}
      </Button>

      {open && openCtx && (
        <div
          onMouseDown={noLoseSelection}
          className="absolute bottom-full right-0 mb-3 flex flex-col items-end gap-2"
        >
          {openCtx.mode === "add" && phase === "kind" && (
            <>
              <NeutralIconButton
                onClick={() => setPhase("color-highlight")}
                title="Виділити"
              >
                <Highlighter className="size-5" />
              </NeutralIconButton>
              <NeutralIconButton
                onClick={() => setPhase("color-note")}
                title="Нотатка"
              >
                <StickyNote className="size-5" />
              </NeutralIconButton>
              <NeutralIconButton
                onClick={applyPublicNote}
                title="Публічний коментар"
              >
                <Megaphone className="size-5" />
              </NeutralIconButton>
            </>
          )}

          {openCtx.mode === "add" &&
            (phase === "color-highlight" || phase === "color-note") && (
              <>
                {COMMENT_PALETTE.map((c) => (
                  <ColoredIconButton
                    key={c.name}
                    color={c.hex}
                    title={`${phase === "color-highlight" ? "Виділити" : "Нотатка"}: ${c.name}`}
                    onClick={() =>
                      phase === "color-highlight"
                        ? applyHighlight(c.hex)
                        : applyNote(c.hex)
                    }
                  >
                    {phase === "color-highlight" ? (
                      <Highlighter className="size-5" />
                    ) : (
                      <StickyNote className="size-5" />
                    )}
                  </ColoredIconButton>
                ))}
              </>
            )}

          {openCtx.mode === "manage" &&
            openCtx.marks.map((m) => {
              const noted = hasNote(editor, m.commentId);
              return (
                <div
                  key={m.commentId}
                  className="flex flex-col items-end gap-1.5"
                >
                  <ColoredIconButton
                    color={m.color}
                    title="Видалити повністю"
                    destructive
                    onClick={() => doDelete(m.commentId)}
                  >
                    <Trash2 className="size-5" />
                  </ColoredIconButton>
                  {noted ? (
                    <ColoredIconButton
                      color={m.color}
                      title="Прибрати нотатку, лишити виділення"
                      onClick={() => doRemoveNote(m.commentId)}
                    >
                      <MessageSquareOff className="size-5" />
                    </ColoredIconButton>
                  ) : (
                    <ColoredIconButton
                      color={m.color}
                      title="Додати нотатку"
                      onClick={() => doAddNote(m.commentId)}
                    >
                      <MessageSquarePlus className="size-5" />
                    </ColoredIconButton>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
