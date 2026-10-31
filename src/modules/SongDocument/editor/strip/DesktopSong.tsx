/**
 * Пісня на ПК (`SONG-97`): той самий вигляд, що й на телефоні лежачи
 * (`Strip`, `StripTransport`), лише смуга розрізана по рядках пісні і сторінка
 * гортається згори донизу. Шапка пісні — як була; згодом мета-дата на ПК
 * матиме свій вигляд.
 *
 * Поки лише перегляд: правка — у редакторі Slate (телефон стоячи, планшет).
 */
import { useCanEditContent, useCapoApplies } from "#modules/SingleSong/mode";
import type { Song } from "../../model";
import { DYNAMICS_PANEL_BOTTOM } from "../dynamics/DynamicsPalette";
import { SongHeader } from "../header/SongHeader";
import { Strip } from "./Strip";
import { StripTransport } from "./StripTransport";
import { useStripView } from "./useStripView";

export function DesktopSong({ song }: { song: Song }) {
  const view = useStripView(song);
  const canEdit = useCanEditContent();
  const capoApplies = useCapoApplies();
  return (
    <div className="relative">
      <SongHeader song={song} me={view.me} canEdit={canEdit} capoApplies={capoApplies} change={(fn) => song.doc.transact(fn)} />
      {canEdit && <p className="mb-2 px-1.5 text-xs text-stone-500">На ПК пісня поки лише для перегляду: правити — на телефоні чи планшеті.</p>}
      <Strip song={song} {...view} split />
      <div className="fixed right-2 z-40" style={{ bottom: DYNAMICS_PANEL_BOTTOM }}>
        <StripTransport song={song} me={view.me} menuSide="top" />
      </div>
    </div>
  );
}
