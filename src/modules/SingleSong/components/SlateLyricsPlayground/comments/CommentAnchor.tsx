import { useEffect, useRef, useState } from "react";
import { useSlateStatic, type RenderElementProps } from "slate-react";

import { useCurrentUsername } from "../elements/hooks";
import type { CommentAnchorElement } from "../types";
import { cardBg, cardBorder, DEFAULT_COMMENT_COLOR } from "./colors";
import { consumePendingFocus } from "./pendingFocus";
import { isVisibleTo } from "./visibility";
import { updateCommentBody } from "./withComments";
import "./comments.css";

const SAVE_DEBOUNCE_MS = 300;

export const CommentAnchor = (props: RenderElementProps) => {
  const { attributes, children, element } = props;
  const anchor = element as CommentAnchorElement;
  const me = useCurrentUsername();
  const editor = useSlateStatic();
  const showCard = isVisibleTo(anchor, me);
  // For now anyone who can see the anchor can also edit it. We'll tighten
  // this once we introduce a separate creator field.
  const canEdit = showCard;

  const [draft, setDraft] = useState(anchor.body);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(anchor.body);
  }, [anchor.body]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Auto-focus the textarea when this anchor was just created by the
  // current user (CommentsFab marks the commentId via setPendingFocus).
  useEffect(() => {
    if (!canEdit) return;
    if (!consumePendingFocus(anchor.commentId)) return;
    // Defer past Slate's normalization pass / first paint so the DOM node
    // is mounted and laid out before we try to focus.
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [canEdit, anchor.commentId]);

  if (!showCard) {
    return (
      <div {...attributes} contentEditable={false} style={{ display: "none" }}>
        {children}
      </div>
    );
  }

  const onChange = (value: string) => {
    setDraft(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      updateCommentBody(editor, anchor.commentId, value);
    }, SAVE_DEBOUNCE_MS);
  };

  const color = anchor.color ?? DEFAULT_COMMENT_COLOR;

  return (
    <div {...attributes} className="comment-anchor" contentEditable={false}>
      <div
        className="comment-anchor__card"
        style={{
          backgroundColor: cardBg(color),
          borderColor: cardBorder(color),
        }}
      >
        <textarea
          ref={textareaRef}
          className="comment-anchor__textarea"
          value={draft}
          onChange={(e) => canEdit && onChange(e.target.value)}
          readOnly={!canEdit}
          placeholder={canEdit ? "Ваш коментар…" : ""}
          rows={Math.min(6, Math.max(1, draft.split("\n").length))}
        />
      </div>
      {children}
    </div>
  );
};
