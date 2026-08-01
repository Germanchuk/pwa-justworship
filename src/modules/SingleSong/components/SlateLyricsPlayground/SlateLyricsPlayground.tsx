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
import { setActiveSongEditor } from "./songEditorRegistry";
import { useConnectionStatus } from "../../redux/selectors";
import { useCurrentUsername } from "./elements/hooks";
import { SlatePlayerBridge } from "./player/SlatePlayerBridge";
import { usePlayerDecorate } from "./player/usePlayerDecorate";
import "./SlateLyricsPlayground.css";
import "./types";

interface Props {
  songId: string | number;
}

function DecoratedEditable({ placeholder }: { placeholder?: string }) {
  const decorate = usePlayerDecorate();
  return (
    <Editable
      className="slate-editable"
      renderElement={renderElement}
      renderLeaf={(props) => <RenderLeaf {...props} />}
      decorate={decorate}
      onContextMenu={(e) => e.preventDefault()}
      placeholder={placeholder}
    />
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

  // Підключаємось ЛИШЕ після синхронізації з сервером. Якщо приєднати
  // редактор до ще порожнього Y.Doc, Slate одразу нормалізує його і впише
  // у спільний документ дефолтний хедер (порожня назва, bpm 0, 4/4, C).
  // Коли слідом приїде справжній стан, у корені стане два хедери, і правило
  // дедуплікації в withHeader зітре саме той, що з реальними даними.
  useEffect(() => {
    if (!synced) return;
    const yjsEditor = editor as unknown as Parameters<typeof YjsEditor.connect>[0];
    YjsEditor.connect(yjsEditor);
    return () => YjsEditor.disconnect(yjsEditor);
  }, [editor, synced]);

  // Віддаємо редактор споживачам поза деревом <Slate> (експорт у .docx з
  // футерних SongControls) — див. `songEditorRegistry.ts`.
  useEffect(() => {
    setActiveSongEditor(editor);
    return () => setActiveSongEditor(null);
  }, [editor]);

  // DEBUG (тільки dev): доступ до Slate-структури пісні з консолі.
  //   __slate()  — дерево, яке розгортається кліками в консолі
  //   __json()   — той самий вміст рядком; зручно `copy(__json())`
  // Це живий стан МОГО редактора: на відміну від колонки `song.slate`, тут
  // ще присутні per-user дані (коментарі, капо, згорнуті секції), які
  // `sanitizeSnapshot` вирізає перед записом у REST.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as {
      __slate?: () => Descendant[];
      __json?: () => string;
    };
    w.__slate = () => editor.children;
    w.__json = () => JSON.stringify(editor.children, null, 2);
    return () => {
      delete w.__slate;
      delete w.__json;
    };
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
  return <CollabView songId={songId} />;
}
