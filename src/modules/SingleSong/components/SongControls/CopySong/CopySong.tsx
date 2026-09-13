import {useDispatch} from "react-redux";
import {useNavigate} from "react-router-dom";
import {DocumentDuplicateIcon} from "@heroicons/react/24/outline";

import {Button} from "@/components/ui/button";
import {songApi} from "#modules/SingleSong/api";
import {bandPath} from "#constants/routes";
import {useBandId} from "#modules/Band/BandLayout";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";

import {useSong} from "../../../redux/selectors";

/** Дія «Скопіювати»: створює копію пісні на бекенді й відкриває її (`LIB-9`). */
export default function CopySong() {
  const dispatch = useDispatch<any>();
  const navigate = useNavigate();
  const song = useSong();
  const bandId = useBandId();

  const copySong = () => {
    if (!song?.id) return;
    songApi.copySong(bandId, song.id as string).then((data) => {
      navigate(bandPath.song(bandId, data.data.id));
    })
      .catch(() => {
        dispatch(addNotificationWithTimeout({
          type: "error",
          message: "Помилка серверу, не вдалось скопіювати пісню",
        }));
      });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={copySong}
      aria-label="Скопіювати пісню"
      title="Скопіювати пісню"
    >
      <DocumentDuplicateIcon className="size-6" />
    </Button>
  );
}
