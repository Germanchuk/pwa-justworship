import { useEffect, useMemo, useRef, type RefObject } from "react";
import { createEditor, Transforms, type Descendant, type Editor } from "slate";
import { Slate, Editable, withReact } from "slate-react";
import { withYjs, withYHistory, YjsEditor } from "@slate-yjs/core";

import { renderElement } from "./renderElement";
import { withSections } from "./withSections";
import { withClipboard } from "./withClipboard";
import { withHeader } from "./withHeader";
import { withMetaSchema } from "./withMetaSchema";
import { withComments } from "./comments/withComments";
import { withModeGuard } from "./mode/withModeGuard";
import { RenderLeaf } from "./comments/renderLeaf";
import { NoteHeadsProvider } from "./comments/NoteHeadsContext";
import { CommentsFab } from "./comments/CommentsFab";
import { LostCommentsBlock } from "./comments/LostCommentsBlock";
import { pushLostComment } from "./comments/lostComments";
import { isPrivateTo } from "./comments/visibility";
import { useCollabProvider } from "./useCollabProvider";
import { useFillViewportHeight } from "./useFillViewportHeight";
import { useColumnsRelayout } from "./useColumnsRelayout";
import { setActiveSongEditor } from "./songEditorRegistry";
import { useCanAnnotate, useCanEditContent } from "../../mode";
import { useConnectionStatus } from "../../redux/selectors";
import { useCurrentUsername } from "./elements/hooks";
import { useChordDecorate } from "./useChordDecorate";
import DronePlayer from "../../services/DronePlayer/DronePlayer";
import { extractHeader } from "../../services/songChords/extractHeader";
import "./SlateLyricsPlayground.css";
import "./types";

interface Props {
  songId: string | number;
}

function DecoratedEditable({
  placeholder,
  readOnly,
  editableRef,
}: {
  placeholder?: string;
  readOnly: boolean;
  editableRef: RefObject<HTMLDivElement | null>;
}) {
  const decorate = useChordDecorate();
  useFillViewportHeight(editableRef);

  return (
    <Editable
      ref={editableRef}
      className="slate-editable"
      readOnly={readOnly}
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
  // Вузол редактора живе тут, а не в `DecoratedEditable`: перерахунок колонок
  // чіпляється до `<Slate onValueChange>`, тобто до цього ж рівня.
  const editableRef = useRef<HTMLDivElement | null>(null);
  const relayoutColumns = useColumnsRelayout(editableRef);
  const status = useConnectionStatus();
  const me = useCurrentUsername();
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  // Режим — per-user і локальний, тож НЕ входить у deps редактора: пересоздання
  // Yjs-редактора на кожне перемикання відʼєднало б документ. Guard читає
  // актуальне значення через ref.
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
    e = withClipboard(e);
    // Найзовнішній guard: поза режимом редагування вміст пісні незмінний.
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
  // меню пісні) — див. `songEditorRegistry.ts`.
  useEffect(() => {
    setActiveSongEditor(editor);
    return () => setActiveSongEditor(null);
  }, [editor]);

  // Дрон грає ЦЮ пісню: тональність і темп читаються з документа на кожне
  // «увімкнути», тож правка шапки діє з наступного вмикання (`PLAY-34`).
  // Вихід із пісні лише знімає джерело — звук грає далі (`PLAY-49`).
  useEffect(() => {
    const player = DronePlayer.getInstance();
    const source = () => extractHeader(editor.children as Descendant[]);
    player.setSource(source);
    return () => player.setSource(null);
  }, [editor]);

  // Поза редагуванням contentEditable вимкнений — прибираємо каретку, щоб
  // після повернення в edit не лишалось "привида" старого селекшна.
  useEffect(() => {
    if (!canEditContent) Transforms.deselect(editor);
  }, [editor, canEditContent]);

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
    <Slate
      editor={editor}
      initialValue={editor.children}
      onValueChange={relayoutColumns}
    >
      <LostCommentsBlock ydoc={ydoc} />
      {/* Розкладка карток приміток рахується один раз на зміну документа,
          а не в кожному рядку — див. `comments/NoteHeadsContext.tsx`. */}
      <NoteHeadsProvider>
        {/* Читання й примітки — без contentEditable: тап не ставить
            каретку й не відкриває клавіатуру (`MODE-6`, `MODE-19`).
            Виділення під позначку в примітках — `useAnnotationRange`. */}
        <DecoratedEditable
          editableRef={editableRef}
          readOnly={!canEditContent}
          placeholder={canEditContent ? "Почніть друкувати..." : undefined}
        />
      </NoteHeadsProvider>
      {canAnnotate && <CommentsFab />}
    </Slate>
  );
}

export default function SlateLyricsPlayground({ songId }: Props) {
  return <CollabView songId={songId} />;
}
