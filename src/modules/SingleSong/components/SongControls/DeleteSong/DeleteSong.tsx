import {Modal} from "#components";
import {songApi} from "../../../api";
import {bandPath} from "#constants/routes";
import {useBandOrNull} from "#modules/Band/BandLayout";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";
import {useDispatch} from "react-redux";
import {useCanEditContent} from "../../../mode";
import {useSong} from "../../../redux/selectors";
import {useNavigate} from "react-router-dom";
import { Button } from "@/components/ui/button";

const Trigger = (props) => {
  return (
    <li className="inline-flex items-center justify-center gap-2 w-full h-8 px-3 mb-1 rounded-md text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer" {...props}>
      Видалити пісню
    </li>
  )
}

const Content = () => {
  const dispatch = useDispatch<any>();
  const song = useSong();
  const navigate = useNavigate();
  // Меню живе в нижній панелі — вище band-роутів, тож гурт беремо м'яко.
  const bandId = useBandOrNull()?.id;

  const deleteSong = async () => {
    if (bandId == null) return;
    songApi.deleteSong(bandId, song.id).then(() => {
      navigate(bandPath.songs(bandId));
    })
      .catch(() => {
        dispatch(addNotificationWithTimeout({
          type: "error",
          message: "Помилка серверу, не вдалось видалити пісню",
        }));
      });
  }
  return (
    <div className="flex justify-end gap-2">
      <Button variant="destructive" onClick={deleteSong}>Так</Button>
      <form method="dialog">
        <Button variant="outline">Ні</Button>
      </form>
    </div>
  )
}

export default function DeleteSong() {
  const canEditContent = useCanEditContent();
  if (!canEditContent) return;
  return (
    <Modal
      trigger={<Trigger />}
      title={"Дійсно видалити пісню?"}
      content={<Content />}
    />
  )
}
