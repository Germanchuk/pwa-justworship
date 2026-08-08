import { useEffect, useState } from "react";
import type * as Y from "yjs";
import { ChevronDown, Copy, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { useCanAnnotate } from "../../../mode";
import { useNotesViewer } from "../../../redux/selectors";
import { highlightBg } from "./colors";
import {
  type LostComment,
  getLostCommentsMap,
  listLostComments,
  removeLostComment,
} from "./lostComments";
import { isVisibleTo } from "./visibility";

const formatTime = (ts: number): string => {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
};

export const LostCommentsBlock = ({ ydoc }: { ydoc: Y.Doc }) => {
  // Втрачені коментарі належать тому ж адресатові, що й решта приміток:
  // дивлюсь очима іншого — бачу його втрачені, не свої.
  const viewer = useNotesViewer();
  // Видалення примітки — дія режиму приміток; в інших режимах лишається
  // перегляд і копіювання.
  const canAnnotate = useCanAnnotate();
  const [items, setItems] = useState<LostComment[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const map = getLostCommentsMap(ydoc);
    const update = () => setItems(listLostComments(ydoc));
    update();
    map.observe(update);
    return () => map.unobserve(update);
  }, [ydoc]);

  const visible = items
    .filter((c) => isVisibleTo(c, viewer))
    .sort((a, b) => b.timestamp - a.timestamp);

  if (visible.length === 0) return null;

  const copy = async (body: string) => {
    try {
      await navigator.clipboard?.writeText(body);
    } catch {
      // ignore — clipboard may be unavailable
    }
  };

  return (
    <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50/60 p-2 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-1 py-1 text-left font-medium text-amber-900 hover:text-amber-700"
      >
        <span>
          Втрачені коментарі
          <span className="ml-1.5 text-xs font-normal opacity-70">
            ({visible.length})
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 transition-transform",
            expanded ? "rotate-180" : "",
          )}
        />
      </button>

      {expanded && (
        <ul className="mt-1 space-y-1.5">
          {visible.map((c) => (
            <li
              key={c.commentId}
              className="flex items-start gap-2 rounded-sm bg-white/60 px-2 py-1.5"
            >
              <span
                className="mt-1 inline-block size-3 shrink-0 rounded-full border border-black/15"
                style={{ backgroundColor: highlightBg(c.color) }}
                title={c.color}
              />
              <div className="flex-1 min-w-0">
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {c.body || (
                    <span className="italic text-muted-foreground">
                      (порожня нотатка)
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatTime(c.timestamp)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(c.body)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent transition-colors"
                title="Скопіювати текст"
              >
                <Copy className="size-3.5" />
              </button>
              {canAnnotate && (
                <button
                  type="button"
                  onClick={() => removeLostComment(ydoc, c.commentId)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Видалити"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
