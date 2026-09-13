import {TrashIcon} from "@heroicons/react/24/outline";
import {Modal} from "#components";
import {songApi} from "../../../api";
import {bandPath} from "#constants/routes";
import {useBandId} from "#modules/Band/BandLayout";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";
import {useDispatch} from "react-redux";
import {useCanEditContent} from "../../../mode";
import {useSong} from "../../../redux/selectors";
import {useNavigate} from "react-router-dom";
import { Button } from "@/components/ui/button";

const Trigger = (props) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full text-destructive hover:text-destructive"
      aria-label="Видалити пісню"
      title="Видалити пісню"
      {...props}
    >
      <TrashIcon className="size-6" />
    </Button>
  )
}

const Content = () => {
  const dispatch = useDispatch<any>();
  const song = useSong();
  const navigate = useNavigate();
  const bandId = useBandId();

  const deleteSong = async () => {
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
