import {useDispatch} from "react-redux";
import {useNavigate} from "react-router-dom";
import {DocumentDuplicateIcon} from "@heroicons/react/24/outline";

import {songApi} from "#modules/SingleSong/api";
import {bandPath} from "#constants/routes";
import {useBandOrNull} from "#modules/Band/BandLayout";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";

import {useSong} from "../../../redux/selectors";

/** Пункт меню "Скопіювати": створює копію пісні на бекенді й відкриває її. */
export default function CopySong({ className }: { className?: string }) {
  const dispatch = useDispatch<any>();
  const navigate = useNavigate();
  const song = useSong();
  // Меню живе в нижній панелі — вище band-роутів, тож гурт беремо м'яко.
  const bandId = useBandOrNull()?.id;

  const copySong = () => {
    if (!song?.id || bandId == null) return;
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
    <li className={className} onClick={copySong}>
      <DocumentDuplicateIcon className="w-4" />
      Скопіювати
    </li>
  );
}
