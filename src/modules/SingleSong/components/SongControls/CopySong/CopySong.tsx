import {useDispatch} from "react-redux";
import {useNavigate} from "react-router-dom";

import {songApi} from "#modules/SingleSong/api";
import {bandPath} from "#constants/routes";
import {useBandId} from "#modules/Band/BandLayout";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";

import {useSong} from "../../../redux/selectors";

/** Дія «Скопіювати»: створює копію пісні на бекенді й відкриває її (`LIB-9`). */
export function useCopySong() {
  const dispatch = useDispatch<any>();
  const navigate = useNavigate();
  const song = useSong();
  const bandId = useBandId();

  return () => {
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
}
