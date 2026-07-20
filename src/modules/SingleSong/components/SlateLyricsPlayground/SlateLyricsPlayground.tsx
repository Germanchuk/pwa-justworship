import { useEffect, useMemo, useRef } from "react";
import { createEditor, type Descendant, type Editor } from "slate";
import { Slate, Editable, withReact } from "slate-react";
import { withYjs, withYHistory, YjsEditor } from "@slate-yjs/core";

import { renderElement } from "./renderElement";
import { withSections } from "./withSections";
import { withHeader } from "./withHeader";
import { withMetaSchema } from "./withMetaSchema";
import { withComments } from "./comments/withComments";
import { withCapoGuard } from "./transposition/withCapoGuard";
import { CapoBlockedTooltip } from "./transposition/CapoBlockedTooltip";
import { RenderLeaf } from "./comments/renderLeaf";
import { CommentsFab } from "./comments/CommentsFab";
import { LostCommentsBlock } from "./comments/LostCommentsBlock";
import { pushLostComment } from "./comments/lostComments";
import { useCollabProvider } from "./useCollabProvider";
import { useConnectionStatus, useIsReadonly, useSlate } from "../../redux/selectors";
import { useCurrentUsername } from "./elements/hooks";
import { SlatePlayerBridge } from "./player/SlatePlayerBridge";
import { usePlayerDecorate } from "./player/usePlayerDecorate";
import "./SlateLyricsPlayground.css";
import "./types";

interface Props {
  songId: string | number;
}

const EMPTY_DOCUMENT: Descendant[] = [
  { type: "empty-line", children: [{ text: "" }] } as unknown as Descendant,
];

function DecoratedEditable({
  readOnly,
  placeholder,
}: {
  readOnly?: boolean;
  placeholder?: string;
}) {
  const decorate = usePlayerDecorate();
  return (
    <Editable
      readOnly={readOnly}
      className="slate-editable"
      renderElement={renderElement}
      renderLeaf={(props) => <RenderLeaf {...props} />}
      decorate={decorate}
      onContextMenu={(e) => e.preventDefault()}
      placeholder={placeholder}
    />
  );
}

function ReadonlyView({ slate }: { slate: Descendant[] | null | undefined }) {
  const editor = useMemo(() => {
    let e = withReact(createEditor());
    e = withMetaSchema(e);
    e = withHeader(e);
    e = withSections(e);
    e = withComments(e);
    return e;
  }, []);
  const value = Array.isArray(slate) && slate.length > 0 ? slate : EMPTY_DOCUMENT;

  return (
    <Slate editor={editor} initialValue={value}>
      <SlatePlayerBridge editor={editor}>
        <DecoratedEditable readOnly />
      </SlatePlayerBridge>
    </Slate>
  );
}

function CollabView({ songId }: { songId: string | number }) {
  const { ydoc, sharedRoot, synced } = useCollabProvider(songId);
  const status = useConnectionStatus();
  const me = useCurrentUsername();
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  const editor = useMemo(() => {
    const yjsEditor = withYjs(withReact(createEditor()), sharedRoot);
    let e = withYHistory(yjsEditor) as unknown as Editor;
    e = withMetaSchema(e);
    e = withHeader(e);
    e = withSections(e);
    e = withComments(e, {
      onAnchorOrphaned: (data) => {
        // Skip self-orphans: if I am the comment's author and the
        // orphaning happened on my editor, I deliberately deleted my
        // own marked text — don't surface it as "lost" to me or peers.
        if (data.author && data.author === meRef.current) return;
        pushLostComment(ydoc, data);
      },
    });
    // Капо активне → акорди показуються транспоновано лише мені, тож блокуємо
    // редагування chord-line, щоб не писати у спільний документ чужу тональність.
    e = withCapoGuard(e, () => meRef.current);
    return e;
  }, [sharedRoot, ydoc]);

  useEffect(() => {
    const yjsEditor = editor as unknown as Parameters<typeof YjsEditor.connect>[0];
    YjsEditor.connect(yjsEditor);
    return () => YjsEditor.disconnect(yjsEditor);
  }, [editor]);

  if (status === "error") {
    return (
      <div className="text-red-600 text-sm p-4 border border-red-200 rounded bg-red-50">
        Немає доступу до цієї пісні. Зверніться до власника бенду.
      </div>
    );
  }

  if (!synced) {
    return (
      <div className="slate-editable-skeleton text-gray-400 text-sm p-4">
        Підключення до сервера…
      </div>
    );
  }

  return (
    <Slate editor={editor} initialValue={editor.children}>
      <SlatePlayerBridge editor={editor}>
        <LostCommentsBlock ydoc={ydoc} />
        <DecoratedEditable placeholder="Почніть друкувати..." />
        <CommentsFab />
        <CapoBlockedTooltip />
      </SlatePlayerBridge>
    </Slate>
  );
}

export default function SlateLyricsPlayground({ songId }: Props) {
  const isReadonly = useIsReadonly();
  const slate = useSlate();

  if (isReadonly) {
    return <ReadonlyView slate={slate} />;
  }

  return <CollabView songId={songId} />;
}
