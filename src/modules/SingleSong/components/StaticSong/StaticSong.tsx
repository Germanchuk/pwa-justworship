import { useMemo } from "react";
import { createEditor, type Descendant, type Editor } from "slate";
import { Editable, Slate, withReact } from "slate-react";

import { renderElement } from "../SlateLyricsPlayground/renderElement";
import { RenderLeaf } from "../SlateLyricsPlayground/comments/renderLeaf";
import { NoteHeadsProvider } from "../SlateLyricsPlayground/comments/NoteHeadsContext";
import { usePlayerDecorate } from "../SlateLyricsPlayground/player/usePlayerDecorate";
import { withComments } from "../SlateLyricsPlayground/comments/withComments";
import { withHeader } from "../SlateLyricsPlayground/withHeader";
import { withMetaSchema } from "../SlateLyricsPlayground/withMetaSchema";
import { withModeGuard } from "../SlateLyricsPlayground/mode/withModeGuard";
import { withSections } from "../SlateLyricsPlayground/withSections";
import "../SlateLyricsPlayground/SlateLyricsPlayground.css";

/**
 * Пісня, показана БЕЗ підключення до collab-документа.
 *
 * ─── НАВІЩО ────────────────────────────────────────────────────────────────
 * Режим зібрання показує всі пісні служіння поспіль. Відкривати на одному
 * екрані вісім Yjs-документів означало б вісім вебсокет-підключень заради
 * того, чого там і не роблять: у зібранні нічого не редагують і нічого не
 * має оновлюватись само. Тому документ приїжджає звичайним HTTP-запитом
 * знімком, а Slate тут — просто рушій показу.
 *
 * ─── ЧОМУ ПЕРСОНАЛЬНІ НАЛАШТУВАННЯ ПРАЦЮЮТЬ САМІ ───────────────────────────
 * Капо, фільтри слів/акордів, згорнуті секції й свої примітки живуть
 * ПЕРСОНАЛЬНО В САМОМУ ДОКУМЕНТІ, а читають їх хуки через `useSlate` — не
 * через Yjs. Тож той самий редактор, налитий знімком, дає весь звичний показ
 * без жодного окремого рендера. Головне — щоб знімок був НЕзнеособлений:
 * джерело тут `slateFull`, а не публічна колонка (див. ендпоінт зібрання).
 *
 * ─── ПЛАГІНИ ───────────────────────────────────────────────────────────────
 * Ті самі, що й у бойовому редакторі, мінус `withYjs`/`withYHistory`: схема
 * має лишатись тією ж, інакше документ, зроблений там, показувався б тут
 * інакше. `withModeGuard` замкнений у «не редагується» назавжди.
 */

interface Props {
  /** Потрібен лише як ключ пересоздання редактора — і як зачіпка під плеєр. */
  songId: string | number;
  slate: Descendant[];
}

function StaticEditable() {
  // Та сама декорація, що й у пісні: підсвітка акордів, показ капо, приглушені
  // слоти після `!`. Підсвітки «зараз грає» тут поки не буває — контекст
  // плеєра віддає порожнє значення за замовчуванням.
  const decorate = usePlayerDecorate();

  return (
    <Editable
      className="slate-editable"
      readOnly
      renderElement={renderElement}
      renderLeaf={(props) => <RenderLeaf {...props} />}
      decorate={decorate}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

export function StaticSong({ songId, slate }: Props) {
  const editor = useMemo(() => {
    let e = withReact(createEditor()) as unknown as Editor;
    e = withMetaSchema(e);
    e = withHeader(e);
    e = withSections(e);
    // Примітки лишаються видимими (свої — справжнім кольором), але осиротіти
    // тут нічому: документ ніхто не змінює.
    e = withComments(e, { onNoteOrphaned: () => {} });
    // Замкнено назавжди: у зібранні пісню не правлять узагалі.
    e = withModeGuard(e, () => false);
    return e;
  }, [songId]);

  if (!Array.isArray(slate) || slate.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Пісня ще порожня — її не відкривали в редакторі.
      </div>
    );
  }

  return (
    <Slate editor={editor} initialValue={slate}>
      {/* Розкладка карток приміток рахується один раз на документ. */}
      <NoteHeadsProvider>
        <StaticEditable />
      </NoteHeadsProvider>
    </Slate>
  );
}

export default StaticSong;
