/**
 * Пісня на ПК (`SONG-97`): той самий вигляд, що й на телефоні лежачи
 * (`Strip`, `StripTransport`), лише смуга розрізана по рядках пісні і сторінка
 * гортається згори донизу. Шапка пісні — як була; згодом мета-дата на ПК
 * матиме свій вигляд.
 *
 * Правиться поки лише піаніно — мишею, як у FL Studio (`usePianoEdit`);
 * решта — у редакторі Slate (телефон стоячи, планшет). Примітки на кроках —
 * як лежачи, затримкою кнопки чи протягом мишею, в обох режимах
 * (`useStripSteps`; у правці в піаніно — Ctrl/⌘ + протяг); палітра й меню
 * позначки — під меню пісні, як у редакторі.
 */
import { useRef } from "react";
import { createPortal } from "react-dom";
import { useSongMenuSlot } from "#modules/SingleSong/components/SongControls/menuSlot";
import { useCanAnnotate, useCanEditContent, useCapoApplies } from "#modules/SingleSong/mode";
import type { Song } from "../../model";
import { DYNAMICS_PANEL_BOTTOM } from "../dynamics/DynamicsPalette";
import { SongHeader } from "../header/SongHeader";
import { Strip } from "./Strip";
import { StripNotes } from "./StripNotes";
import { StripTransport } from "./StripTransport";
import { usePianoEdit } from "./usePianoEdit";
import { useStripSteps } from "./useStripSteps";
import { useStripView } from "./useStripView";

export function DesktopSong({ song }: { song: Song }) {
  const view = useStripView(song);
  const canEdit = useCanEditContent();
  const canAnnotate = useCanAnnotate();
  const capoApplies = useCapoApplies();
  const slot = useSongMenuSlot();
  const strip = useRef<HTMLDivElement>(null);
  const { me } = view;
  const sel = useStripSteps(strip, { song, zoom: view.zoom, notes: view.notes, on: canAnnotate && !!me, pianoEdit: canEdit });
  usePianoEdit(strip, { song, zoom: view.zoom, on: canEdit });
  return (
    <div className="relative">
      <SongHeader song={song} me={view.me} canEdit={canEdit} capoApplies={capoApplies} change={(fn) => song.doc.transact(fn)} />
      {canEdit && (
        <p className="mb-2 px-1.5 text-xs text-stone-500">
          На ПК поки правиться лише піаніно — як у FL Studio: клік ставить ноту, протяг переносить, край — довжина, правий клік стирає. Решту — на телефоні чи планшеті.
        </p>
      )}
      <div ref={strip}>
        <Strip song={song} {...view} split steps={sel.steps} cardsEdit={canAnnotate && me ? { viewers: view.viewers, ...sel } : undefined} edit={canEdit} />
      </div>
      {slot && me && createPortal(<StripNotes song={song} me={me} viewers={view.viewers} notes={view.notes} {...sel} />, slot)}
      <div className="fixed right-2 z-40" style={{ bottom: DYNAMICS_PANEL_BOTTOM }}>
        <StripTransport song={song} me={view.me} menuSide="top" canEdit={canEdit} zoom={view.zoom} />
      </div>
    </div>
  );
}
