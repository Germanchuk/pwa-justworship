/**
 * Що смуга показує людині: її доріжки, масштаб, капо й примітки її очима.
 * Спільне для телефона лежачи й ПК — щоб обидва формати були одним виглядом.
 */
import { useCapoApplies } from "#modules/SingleSong/mode";
import { useNotesViewers } from "#modules/SingleSong/redux/selectors";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import { readCapo, readHiddenLanes, readZoom, resolveNotes, Song } from "../../model";
import { shownLanes } from "../../bridge/projection";
import { useDocVersion } from "../useLinesDoc";
import { useSongSession } from "../useSongSession";

export function useStripView(song: Song) {
  useDocVersion(song.doc);
  useSongSession(song);
  const me = useCurrentUsername() ?? null;
  const capoApplies = useCapoApplies();
  const viewers = useNotesViewers();

  const zoom = me ? readZoom(song.doc, me) : undefined;
  const hidden = me ? readHiddenLanes(song.doc, me) : [];
  const lanes = shownLanes(song, { words: !hidden.includes("words"), chords: !hidden.includes("chords"), hidden, zoom });
  const capo = me ? readCapo(song.doc, me) : { fret: 0, off: false };
  const notes = resolveNotes(song, viewers, (_, lane) => lanes.includes(lane));
  return { me, lanes, zoom, capo: capoApplies && !capo.off ? capo.fret : 0, notes };
}
