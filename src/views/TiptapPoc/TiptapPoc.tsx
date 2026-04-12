import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { CustomHardBreak } from '#poc/TiptapEditor/extensions/CustomHardBreak';

// A minimal editor, configured for lyrics-style line breaks using our custom extension.
const LyricsEditorPoc = () => {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      CustomHardBreak, // Use our new, file-based custom extension.
    ],
    content: `
      <p>Це базовий редактор для лірики.</p>
      <p>Тепер натискання <strong>Enter</strong> створює новий рядок,<br>а не новий абзац.</p>
      <p>Щоб створити новий абзац, використовуйте <strong>Shift+Enter</strong>.</p>
    `,
    editorProps: {
      attributes: {
        // Re-use some basic styling from the existing CSS file.
        class: 'tiptap',
      },
    },
  });

  return <EditorContent editor={editor} />;
};

/**
 * The main component for the Tiptap Proof of Concept page,
 * demonstrating a minimal editor setup tailored for lyrics.
 */
export function TiptapPoc() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Мінімальний Редактор для Лірики</h1>
      <p>
        Натискання <strong>Enter</strong> створює перенос рядка.
        <br />
        Натискання <strong>Shift+Enter</strong> створює новий абзац.
      </p>
      
      <div className="tiptap-editor-wrapper">
        <LyricsEditorPoc />
      </div>
    </div>
  );
}
