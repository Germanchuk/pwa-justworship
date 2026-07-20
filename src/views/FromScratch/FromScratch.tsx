import React from "react";
import Song from "#modules/SingleSong/components/Song";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { Routes } from "#constants/routes";
import ReactDOM from "react-dom";
import { useDispatch } from "react-redux";
import { resetSong } from "#modules/SingleSong/redux/songSlice";
import { useSetEditMode, useSong } from "#modules/SingleSong/redux/selectors";
import {songApi} from "#modules/SingleSong/api";
import { Button } from "@/components/ui/button";

export default function FromScratch() {
  // add intermediate auto saving into localStorage
  const dispatch = useDispatch();
  const song = useSong();
  const setEditMode = useSetEditMode();
  React.useEffect(() => {
    dispatch(resetSong());
    setEditMode(true);
  }, [dispatch, setEditMode]);
  const navigate = useNavigate();

  const createEntry = async () => {
    try {
      const data = await songApi.createSong(song);

      if (data) {
        navigate(`${Routes.PublicSongs}/${data.data.id}`);
      }
    } catch {
      // ignore error
    }
  };

  return (
    <>
      <Song />
      <SavingButton createEntry={createEntry} />
    </>
  );
}

function SavingButton({ createEntry }) {
  return ReactDOM.createPortal(
    <div className="fixed bottom-4 right-4">
      <Button
        size="icon"
        className="bg-green-600 text-white hover:bg-green-700 ring-1 ring-neutral-400"
        onClick={createEntry}
      >
        <CheckCircleIcon className="w-6 h-6" />
      </Button>
    </div>, document.body
  );
}
