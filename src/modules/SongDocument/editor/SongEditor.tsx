/**
 * Редактор пісні: модель пісні (ADR-0007) у кімнаті `lines:<id>` і видиме
 * дерево Slate поверх неї — лише ті доріжки, які людина вибрала бачити.
 *
 * Режим — зі шляху (`SingleSong/mode.tsx`): читання — без contentEditable,
 * капо діє; правка — вміст і шапка. Примітки (виділення → палітра) і
 * динаміка (поки відкрита її панель) — в обох режимах. Особистий вибір
 * доріжок діє в усіх режимах (ADR-0006).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createEditor, Editor, Node, NodeEntry, Range, Text, Transforms } from "slate";
import { Editable, ReactEditor, Slate, withReact } from "slate-react";
import { useCanAnnotate, useCanEditContent, useCapoApplies } from "#modules/SingleSong/mode";
import { useConnectionStatus, useNotesViewers } from "#modules/SingleSong/redux/selectors";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import DronePlayer from "#modules/SingleSong/services/DronePlayer/DronePlayer";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import {
  ensureSlots,
  linesOf,
  missingSlots,
  readCapo,
  readHiddenLanes,
  readMeta,
  resolveNotes,
  Song,
  updateNote,
} from "../model";
import { createLaneView, type LaneDisplay } from "../bridge/laneView";
import { Ctx, type EditorCtx } from "./context";
import { setActiveSong } from "./activeSong";
import { DynamicsPalette } from "./dynamics/DynamicsPalette";
import { setDynamicsPanel, useDynamicsPanel } from "./dynamics/panel";
import { useStroke, type Brush } from "./dynamics/useStroke";
import { FOREIGN_KEY, Leaf, NOTE_KEY } from "./elements/Leaf";
import { renderElement } from "./elements/renderElement";
import { SongHeader } from "./header/SongHeader";
import { LostNotes } from "./notes/LostNotes";
import { NotesTools } from "./notes/NotesTools";
import { RemovalWarning } from "./RemovalWarning";
import { useColumnsRelayout } from "./layout/useColumnsRelayout";
import { useFillViewportHeight } from "./layout/useFillViewportHeight";
import { useDocVersion, useLinesDoc } from "./useLinesDoc";
// Колонки на широких екранах і решта вигляду записничка — спільні зі
// статичним показом (зібрання), що ще на старому редакторі.
import "#modules/SingleSong/components/SlateLyricsPlayground/SlateLyricsPlayground.css";

export function SongEditor({ songId }: { songId: string | number }) {
  const { song, synced } = useLinesDoc(songId);
  const status = useConnectionStatus();
  if (status === "error") {
    return (
      <div className="text-red-600 text-sm p-4 border border-red-200 rounded bg-red-50">
        Немає доступу до цієї пісні. Зверніться до власника бенду.
      </div>
    );
  }
  if (!synced) return <div className="text-gray-400 text-sm p-4">Підключення до сервера…</div>;
  return <LoadedEditor song={song} />;
}

function LoadedEditor({ song }: { song: Song }) {
  const me = useCurrentUsername() ?? null;
  const canEdit = useCanEditContent();
  const canAnnotate = useCanAnnotate();
  const capoApplies = useCapoApplies();
  useDocVersion(song.doc); // шапка, примітки, особисте — перечитуються на кожну зміну

  const hidden = me ? readHiddenLanes(song.doc, me) : [];
  const display: LaneDisplay = { words: !hidden.includes("words"), chords: !hidden.includes("chords"), hidden };
  const lanes = useMemo(
    () => createLaneView(song, display, { base: () => withReact(createEditor()) }),
    // Видиме дерево створюється раз на документ; вибір доріжок міняє `setDisplay`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [song],
  );
  useEffect(() => () => lanes.destroy(), [lanes]);
  if (import.meta.env.DEV) (window as unknown as { __lanes?: unknown }).__lanes = lanes;
  // Вибір доріжок → видиме дерево. Примітки й позначки цього рендера порахувались ще
  // зі старим вибором — тож одразу, до показу, рендеримо ще раз зі свіжим.
  const [, rerender] = useState(0);
  useLayoutEffect(() => {
    lanes.setDisplay(display);
    rerender((n) => n + 1);
  }, [lanes, hidden.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = lanes.view;

  // Рядок, що народився одночасно з новою доріжкою, — без її слота: дописати (ADR-0008).
  useEffect(() => {
    if (!canEdit) return;
    const heal = () => {
      const lines = linesOf(song);
      if (missingSlots(song, lines).length) song.doc.transact(() => ensureSlots(song, lines), "heal");
    };
    let queued = false;
    const onTransaction = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        heal();
      });
    };
    heal();
    song.doc.on("afterTransaction", onTransaction);
    return () => song.doc.off("afterTransaction", onTransaction);
  }, [song, canEdit]);

  // Курсор-крок у клітинковій доріжці живе поза Slate — перемальовуватись на його рух.
  const [, cellMoved] = useState(0);
  useEffect(() => lanes.cells.listen(() => cellMoved((n) => n + 1)), [lanes]);
  useEffect(() => lanes.removal.listen(() => cellMoved((n) => n + 1)), [lanes]);

  // Пісня — для меню поза редактором; панель динаміки нової пісні — закрита.
  useEffect(() => {
    setActiveSong(song);
    return () => {
      setActiveSong(null);
      setDynamicsPanel(false);
    };
  }, [song]);

  const [brush, setBrush] = useState<Brush>("calm");
  const stroke = useStroke(song, brush, lanes.paint);
  const painting = useDynamicsPanel();
  // Примітки без тексту, яким щойно «додали нотатку» — їхня картка порожня, але показана.
  const [drafts, setDrafts] = useState<string[]>([]);
  const [cursorLine, setCursorLine] = useState<number | null>(null);
  const editableRef = useRef<HTMLDivElement | null>(null);
  useFillViewportHeight(editableRef);
  const relayoutColumns = useColumnsRelayout(editableRef);

  const meta = readMeta(song.doc);
  const capo = me ? readCapo(song.doc, me) : { fret: 0, off: false };
  const activeCapo = capoApplies && !capo.off ? capo.fret : 0;
  // Чиїми очима — вибраних у «⋯ → Показ → Від іншого користувача» (за замовчуванням своїми).
  // У правці — ще й чужі, сірим (`NOTE-15`): правка зачепить чужий якір.
  const viewers = useNotesViewers();
  const notes = resolveNotes(song, viewers, lanes.isShown, { others: canEdit });

  // Дрон грає ЦЮ пісню: тональність і темп — з документа на кожне «увімкнути».
  useEffect(() => {
    const player = DronePlayer.getInstance();
    player.setSource(() => {
      const m = readMeta(song.doc);
      const [num, den] = m.timeSignature.split("/").map(Number);
      return { name: m.name || null, bpm: m.bpm, timeSignature: [num || 4, den || 4], key: m.key as SongKeyValue };
    });
    return () => player.setSource(null);
  }, [song]);

  // Поза правкою каретки немає — щоб після повернення не лишалось «привида».
  useEffect(() => {
    if (!canEdit) Transforms.deselect(view);
  }, [view, canEdit]);

  // Позначене приміткою й «/» структурної примітки — декорації видимого дерева.
  const ranges = notes.flatMap((n) => {
    if (n.status !== "visible" || !n.at) return [];
    const anchor = lanes.toView({ line: n.at.line, lane: n.lane, offset: n.at.from });
    const focus = lanes.toView({ line: n.at.line, lane: n.lane, offset: n.at.to });
    const mark = n.foreign ? { [FOREIGN_KEY + n.note.id]: true } : { [NOTE_KEY + n.note.id]: n.note.color };
    return anchor && focus ? [{ anchor, focus, mark }] : [];
  });
  const rangesKey = JSON.stringify(ranges);
  const decorate = useCallback(
    ([node, path]: NodeEntry) => {
      if (!Text.isText(node)) return [];
      const lane = (Node.parent(view, path) as unknown as { type: string }).type;
      const slash = lane === "words" && node.text.startsWith("/") ? [{ anchor: { path, offset: 0 }, focus: { path, offset: 1 }, slash: true }] : [];
      return [
        ...slash,
        ...ranges.flatMap((r) => {
          const piece = Range.intersection(r, Editor.range(view, path));
          return piece && !Range.isCollapsed(piece) ? [{ ...piece, ...r.mark }] : [];
        }),
      ];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangesKey, view],
  );

  const ctx: EditorCtx = {
    song,
    lanes,
    me,
    notes,
    drafts,
    capo: activeCapo,
    songKey: meta.key,
    canEdit,
    canAnnotate,
    stroke: painting ? stroke : null,
    cursorLine,
    viewers,
    onNoteBody: (n, body) => song.doc.transact(() => updateNote(n.holder, n.lane, n.note.id, { body })),
    onNoteBlur: (n) => setDrafts((d) => d.filter((id) => id !== n.note.id)),
  };

  return (
    <Ctx.Provider value={ctx}>
      <div data-song-editor className="relative">
        <SongHeader song={song} me={me} canEdit={canEdit} capoApplies={capoApplies} change={lanes.change} />
        <LostNotes song={song} notes={notes} />
        <Slate
          editor={view}
          initialValue={view.children}
          onChange={() => setCursorLine(view.selection ? lanes.modelLine(view.selection.anchor.path[0]) : null)}
          onValueChange={relayoutColumns}
        >
          <Editable
            ref={editableRef}
            className="slate-editable outline-none pb-24"
            readOnly={!canEdit}
            renderElement={renderElement}
            renderLeaf={Leaf}
            decorate={decorate}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (!ReactEditor.hasEditableTarget(view, e.target)) return; // поле картки примітки
              if (e.key === "Escape") lanes.removal.cancel();
              if (lanes.cells.key(e)) e.preventDefault();
            }}
          />
        </Slate>
        {canAnnotate && me && (
          <NotesTools
            song={song}
            lanes={lanes}
            me={me}
            viewers={viewers}
            notes={notes}
            addDraft={(id) => setDrafts((d) => [...d, id])}
            dropDraft={(id) => setDrafts((d) => d.filter((x) => x !== id))}
          />
        )}
        {painting && <DynamicsPalette brush={brush} setBrush={setBrush} />}
        {canEdit && <RemovalWarning />}
      </div>
    </Ctx.Provider>
  );
}
