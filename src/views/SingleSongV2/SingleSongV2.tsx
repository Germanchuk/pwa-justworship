import React, {useCallback, useRef} from "react";
import { useParams } from "react-router-dom";
import Song from "#modules/SingleSong/components/Song";
import { useDispatch } from "react-redux";
import {
  useSong,
  useSetSong,
  useSetPreferences,
  useEditMode,
} from "#modules/SingleSong/redux/selectors";
import {fetchSongThunk} from "#modules/SingleSong/redux/songThunks";
import {songApi, sPreferencesApi} from "#modules/SingleSong/api";
import {SongControls} from "#modules/SingleSong/components/SongControls/SongControls";
import {setEditMode, setStatus} from "#modules/SingleSong/redux/songSlice";
import {ToPageHeaderArea} from "#layout/PageHeaderArea/ToPageHeaderArea";

export default function SingleSongV2() {
  const { songId } = useParams();
  const setPreferences = useSetPreferences();
  const dispatch = useDispatch();
  const song = useSong();
  const editMode = useEditMode();
  const setSong = useSetSong();
  const isReadonly = Boolean(song?.readonly);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  const saveSong = useCallback(song => {
    dispatch(setStatus("saving"));
    // strip slate / collab snapshot fields — collab-server owns those now,
    // sending stale Redux copies would overwrite fresh snapshots.
    const { slate: _slate, song_collab_state: _scs, lastCollabSavedAt: _lcs, ...metadata } = song;
    songApi.updateSong(song.id, metadata)
      .then(() => {
        dispatch(setStatus("saved"));
      })
      .catch(() => {
        dispatch(setStatus("error"));
      });
  }, []);

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

  React.useEffect(() => {
    if (!songId) return;
    // @ts-ignore
    dispatch(fetchSongThunk(songId))
  }, [songId, dispatch]);

  React.useEffect(() => {
    if (!editMode) return;

    dispatch(setStatus("pending"));

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      saveSong(song);
    }, 1000);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [song]);

  return (
    <>
      <ToPageHeaderArea>
        <SongControls isReadonly={isReadonly} songId={songId} />
      </ToPageHeaderArea>
      <Song />
    </>
  );
}
