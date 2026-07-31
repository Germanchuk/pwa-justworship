import React from "react";
import { useParams } from "react-router-dom";
import Song from "#modules/SingleSong/components/Song";
import { useDispatch } from "react-redux";
import {
  useSetSong,
  useSetPreferences,
} from "#modules/SingleSong/redux/selectors";
import {sPreferencesApi} from "#modules/SingleSong/api";
import {SongControls} from "#modules/SingleSong/components/SongControls/SongControls";
import {setEditMode} from "#modules/SingleSong/redux/songSlice";
import {SongHeader} from "#modules/SingleSong/components/SongHeader/SongHeader";
import {ToPageHeaderArea} from "#layout/PageHeaderArea/ToPageHeaderArea";
import {ToPageFooterArea} from "#layout/PageFooterArea/ToPageFooterArea";

export default function SingleSong() {
  const { songId } = useParams();
  const setPreferences = useSetPreferences();
  const dispatch = useDispatch();
  const setSong = useSetSong();

  React.useEffect(() => {
    return () => {
      dispatch(setSong({})); // reset song
      dispatch(setEditMode(false));
    }
  }, []);

  React.useEffect(() => {
    if (!songId) return;
    sPreferencesApi.getPreferences(songId).then((response) => {
      setPreferences(response.data);
    });
  }, [songId]);

  // The song itself is never fetched over HTTP: the collab WebSocket document
  // (`song:<id>`) is the single source of truth for content *and* header
  // attributes (name/bpm/key/time signature). All the client needs from the
  // route is the id to open that document with.
  React.useEffect(() => {
    if (!songId) return;
    dispatch(setSong({ id: songId }));
  }, [songId, dispatch]);

  return (
    <>
      <ToPageHeaderArea>
        <SongHeader />
      </ToPageHeaderArea>
      <Song />
      <ToPageFooterArea>
        <SongControls songId={songId} />
      </ToPageFooterArea>
    </>
  );
}
