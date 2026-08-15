import React from "react";
import { Navigate, useParams } from "react-router-dom";
import Song from "#modules/SingleSong/components/Song";
import { useDispatch } from "react-redux";
import { useSetSong } from "#modules/SingleSong/redux/selectors";
import { parseSongMode } from "#modules/SingleSong/mode";
import { bandPath } from "#constants/routes";
import {SongControls} from "#modules/SingleSong/components/SongControls/SongControls";
import {setNotesAudience} from "#modules/SingleSong/redux/songSlice";
import {SongHeader} from "#modules/SingleSong/components/SongHeader/SongHeader";
import {ToPageHeaderArea} from "#layout/PageHeaderArea/ToPageHeaderArea";
import {ToPageFooterArea} from "#layout/PageFooterArea/ToPageFooterArea";

export default function SingleSong() {
  const { bandId, songId, mode } = useParams();
  const dispatch = useDispatch();
  const setSong = useSetSong();

  React.useEffect(() => {
    return () => {
      dispatch(setSong({})); // reset song
      dispatch(setNotesAudience(null)); // своїми примітками, не чужими
    }
  }, []);

  // The song itself is never fetched over HTTP: the collab WebSocket document
  // (`song:<id>`) is the single source of truth for content *and* header
  // attributes (name/bpm/key/time signature). All the client needs from the
  // route is the id to open that document with.
  React.useEffect(() => {
    if (!songId) return;
    dispatch(setSong({ id: songId }));
  }, [songId, dispatch]);

  // Сегмент режиму з чужих рук може бути будь-яким. Це не 404: пісня існує,
  // просто режим не розпізнали — зводимо на канонічний шлях читання.
  if (bandId && songId && parseSongMode(mode) === null) {
    return <Navigate to={bandPath.song(bandId, songId)} replace />;
  }

  return (
    <>
      <ToPageHeaderArea>
        <SongHeader />
      </ToPageHeaderArea>
      <Song />
      <ToPageFooterArea>
        <SongControls />
      </ToPageFooterArea>
    </>
  );
}
