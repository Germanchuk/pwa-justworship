import { useEffect, useMemo, useRef } from "react";
import { createEditor, Transforms, type Descendant, type Editor } from "slate";
import { Slate, Editable, withReact } from "slate-react";
import { withYjs, withYHistory, YjsEditor } from "@slate-yjs/core";

import { renderElement } from "./renderElement";
import { withSections } from "./withSections";
import { withHeader } from "./withHeader";
import { withMetaSchema } from "./withMetaSchema";
import { withComments } from "./comments/withComments";
import { withModeGuard } from "./mode/withModeGuard";
import { ModeBlockedTooltip } from "./mode/ModeBlockedTooltip";
import { RenderLeaf } from "./comments/renderLeaf";
import { NoteHeadsProvider } from "./comments/NoteHeadsContext";
import { CommentsFab } from "./comments/CommentsFab";
import { LostCommentsBlock } from "./comments/LostCommentsBlock";
import { pushLostComment } from "./comments/lostComments";
import { isPrivateTo } from "./comments/visibility";
import { useCollabProvider } from "./useCollabProvider";
import { useFillViewportHeight } from "./useFillViewportHeight";
import { setActiveSongEditor } from "./songEditorRegistry";
import { useCanAnnotate, useCanEditContent, useSongMode } from "../../mode";
import { useConnectionStatus } from "../../redux/selectors";
import { useCurrentUsername } from "./elements/hooks";
import { SlatePlayerBridge } from "./player/SlatePlayerBridge";
import { usePlayerDecorate } from "./player/usePlayerDecorate";
import "./SlateLyricsPlayground.css";
import "./types";

interface Props {
  songId: string | number;
}

function DecoratedEditable({
  placeholder,
  readOnly,
  canEditContent,
}: {
  placeholder?: string;
  readOnly: boolean;
  canEditContent: boolean;
}) {
  const decorate = usePlayerDecorate();
  const editableRef = useRef<HTMLDivElement | null>(null);
  useFillViewportHeight(editableRef);

  // Drag&drop тексту НЕ проходить через `withModeGuard`: slate-react сам
  // викликає `Transforms.delete` на перетягнутому діапазоні, а вже потім
  // `insertData` (яку guard відсікає) — вийшло б видалення без вставки.
  // Тому в режимі приміток гасимо перетягування на рівні DOM-події:
  // `preventDefault` для slate-react означає "подію вже оброблено".
  const blockDragWhenNotEditing = (e: React.DragEvent) => {
    if (!canEditContent) e.preventDefault();
  };

  return (
    <Editable
      ref={editableRef}
      className="slate-editable"
      readOnly={readOnly}
      renderElement={renderElement}
      renderLeaf={(props) => <RenderLeaf {...props} />}
      decorate={decorate}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={blockDragWhenNotEditing}
      onDrop={blockDragWhenNotEditing}
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

  // Режим — per-user і локальний, тож НЕ входить у deps редактора: пересоздання
  // Yjs-редактора на кожне перемикання відʼєднало б документ. Guard читає
  // актуальне значення через ref.
  const mode = useSongMode();
  const canEditContent = useCanEditContent();
  const canAnnotate = useCanAnnotate();
  const canEditRef = useRef(canEditContent);
  useEffect(() => {
    canEditRef.current = canEditContent;
  }, [canEditContent]);

  const editor = useMemo(() => {
    const yjsEditor = withYjs(withReact(createEditor()), sharedRoot);
    let e = withYHistory(yjsEditor) as unknown as Editor;
    e = withMetaSchema(e);
    e = withHeader(e);
    e = withSections(e);
    e = withComments(e, {
      onNoteOrphaned: (data) => {
        // Skip self-orphans: if the note was mine alone and I am its
        // author, I deliberately deleted my own marked text — don't
        // surface it as "lost" to me or peers. A note I wrote *for*
        // somebody else is NOT mine to silently drop: its addressee must
        // still learn that the text under it is gone.
        if (data.author === meRef.current && isPrivateTo(data, meRef.current)) {
          return;
        }
        pushLostComment(ydoc, data);
      },
    });
    // Найзовнішній guard: поза режимом редагування вміст пісні незмінний
    // (у режимі приміток редактор лишається contentEditable заради виділення).
    e = withModeGuard(e, () => canEditRef.current);
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

  // Режим читання вимикає contentEditable — прибираємо каретку, щоб після
  // повернення в edit/notes не лишалось "привида" старого селекшна.
  useEffect(() => {
    if (mode === "read") Transforms.deselect(editor);
  }, [editor, mode]);

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
        {/* Розкладка карток приміток рахується один раз на зміну документа,
            а не в кожному рядку — див. `comments/NoteHeadsContext.tsx`. */}
        <NoteHeadsProvider>
          <DecoratedEditable
            readOnly={mode === "read"}
            canEditContent={canEditContent}
            placeholder={canEditContent ? "Почніть друкувати..." : undefined}
          />
        </NoteHeadsProvider>
        {canAnnotate && <CommentsFab />}
        <ModeBlockedTooltip />
      </SlatePlayerBridge>
    </Slate>
  );
}

export default function SlateLyricsPlayground({ songId }: Props) {
  return <CollabView songId={songId} />;
}
