/**
 * Редактор пісні: модель пісні (ADR-0007) у кімнаті `lines:<id>` і видиме
 * дерево Slate поверх неї — лише ті доріжки, які людина вибрала бачити.
 *
 * Режим — зі шляху (`SingleSong/mode.tsx`): читання — без contentEditable,
 * капо діє; правка — вміст, шапка й динаміка; примітки — виділення й картки.
 * Особистий вибір доріжок діє в усіх режимах (ADR-0006).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createEditor, Editor, Node, NodeEntry, Range, Text, Transforms } from "slate";
import { Editable, ReactEditor, Slate, withReact } from "slate-react";
import { useCanAnnotate, useCanEditContent, useCapoApplies } from "#modules/SingleSong/mode";
import { useConnectionStatus, useNotesViewers } from "#modules/SingleSong/redux/selectors";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import DronePlayer from "#modules/SingleSong/services/DronePlayer/DronePlayer";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import { readCapo, removeNote, readHiddenLanes, readMeta, resolveNotes, Song, type NoteView } from "../model";
import { createLaneView, type LaneDisplay } from "../bridge/laneView";
import { Ctx, type EditorCtx } from "./context";
import { DynamicsPalette } from "./dynamics/DynamicsPalette";
import { useStroke, type Brush } from "./dynamics/useStroke";
import { Leaf } from "./elements/Leaf";
import { renderElement } from "./elements/renderElement";
import { SongHeader } from "./header/SongHeader";
import { NoteComposer, type NoteTarget } from "./notes/NoteComposer";
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
  const display: LaneDisplay = { words: !hidden.includes("words"), chords: !hidden.includes("chords") };
  const lanes = useMemo(
    () => createLaneView(song, display, { base: () => withReact(createEditor()) }),
    // Видиме дерево створюється раз на документ; вибір доріжок міняє `setDisplay`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [song],
  );
  useEffect(() => () => lanes.destroy(), [lanes]);
  // Вибір доріжок → видиме дерево. Примітки й позначки цього рендера порахувались ще
  // зі старим вибором — тож одразу, до показу, рендеримо ще раз зі свіжим.
  const [, rerender] = useState(0);
  useLayoutEffect(() => {
    lanes.setDisplay(display);
    rerender((n) => n + 1);
  }, [lanes, display.words, display.chords]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = lanes.view;

  const [brush, setBrush] = useState<Brush>("calm");
  const stroke = useStroke(song, brush, lanes.paint);
  const [composing, setComposing] = useState<NoteTarget | null>(null);
  const [cursorLine, setCursorLine] = useState<number | null>(null);
  const editableRef = useRef<HTMLDivElement | null>(null);
  useFillViewportHeight(editableRef);
  const relayoutColumns = useColumnsRelayout(editableRef);

  const meta = readMeta(song.doc);
  const capo = me ? readCapo(song.doc, me) : { fret: 0, off: false };
  const activeCapo = capoApplies && !capo.off ? capo.fret : 0;
  // Чиїми очима: поза режимом приміток — своїми, у примітках — вибраних у меню.
  const viewers = useNotesViewers();
  const notes = resolveNotes(song, viewers, lanes.isShown);

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
    return anchor && focus ? [{ anchor, focus, noteColor: n.note.color }] : [];
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
          return piece && !Range.isCollapsed(piece) ? [{ ...piece, noteColor: r.noteColor }] : [];
        }),
      ];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangesKey, view],
  );

  /** Виділене в браузері → одна доріжка одного рядка для нової примітки. */
  const startNote = () => {
    const dom = window.getSelection();
    const range = dom && dom.rangeCount ? ReactEditor.toSlateRange(view, dom, { exactMatch: false, suppressThrow: true }) : null;
    const pieces = range ? lanes.modelPieces(range) : [];
    if (pieces.length !== 1) {
      window.alert(pieces.length ? "Примітка — в одному рядку й одній доріжці: виділіть лише слова або лише акорди одного рядка." : "Спершу виділіть текст.");
      return;
    }
    const [piece] = pieces;
    // Текст доріжки у видимому — той самий, що в моделі.
    const laneText = Node.string(Node.get(view, Range.start(range!).path.slice(0, 2)));
    const [from, to] = [piece.anchor.offset, piece.focus.offset].sort((a, b) => a - b);
    setComposing({ ...piece, quote: laneText.slice(from, to) });
  };

  const ctx: EditorCtx = {
    song,
    lanes,
    me,
    notes,
    capo: activeCapo,
    songKey: meta.key,
    canEdit,
    canAnnotate,
    stroke: canEdit ? stroke : null,
    cursorLine,
    viewers,
    onNoteDelete: (n: NoteView) => song.doc.transact(() => removeNote(n.holder, n.lane, n.note, viewers)),
  };

  return (
    <Ctx.Provider value={ctx}>
      <div data-song-editor className="relative">
        <SongHeader song={song} me={me} canEdit={canEdit} capoApplies={capoApplies} />
        {canEdit && (
          <div className="mb-2 pl-4">
            <DynamicsPalette brush={brush} setBrush={setBrush} />
          </div>
        )}
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
          />
        </Slate>
        {canAnnotate && me && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={startNote}
            className="fixed bottom-6 right-6 z-40 rounded-full bg-amber-500 text-white shadow-lg px-4 py-3 text-sm font-semibold"
          >
            + Примітка
          </button>
        )}
        {composing && me && <NoteComposer song={song} me={me} audience={viewers} target={composing} onClose={() => setComposing(null)} />}
      </div>
    </Ctx.Provider>
  );
}
