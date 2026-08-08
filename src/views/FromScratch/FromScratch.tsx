import React from "react";
import Song from "#modules/SingleSong/components/Song";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { bandPath } from "#constants/routes";
import { useBandId } from "#modules/Band/BandLayout";
import ReactDOM from "react-dom";
import { useDispatch } from "react-redux";
import { resetSong } from "#modules/SingleSong/redux/songSlice";
import { useSong } from "#modules/SingleSong/redux/selectors";
import { SongModeProvider } from "#modules/SingleSong/mode";
import {songApi} from "#modules/SingleSong/api";
import { Button } from "@/components/ui/button";

export default function FromScratch() {
  // add intermediate auto saving into localStorage
  const dispatch = useDispatch();
  const song = useSong();
  React.useEffect(() => {
    dispatch(resetSong());
  }, [dispatch]);
  const navigate = useNavigate();
  const bandId = useBandId();

  const createEntry = async () => {
    try {
      const data = await songApi.createSong(bandId, song);

      if (data) {
        navigate(bandPath.song(bandId, data.data.id));
      }
    } catch {
      // ignore error
    }
  };

  // Пісні ще нема в URL, тож режим зі шляху не прочитати — задаємо його явно:
  // нову пісню одразу відкриваємо в редагуванні, писати її нема з чого.
  return (
    <SongModeProvider mode="edit">
      <Song />
      <SavingButton createEntry={createEntry} />
    </SongModeProvider>
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
