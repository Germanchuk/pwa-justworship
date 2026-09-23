import type {RefObject} from "react";
import {Modal} from "#components";
import {songApi} from "../../../api";
import {bandPath} from "#constants/routes";
import {useBandId} from "#modules/Band/BandLayout";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";
import {useDispatch} from "react-redux";
import {useSong} from "../../../redux/selectors";
import {useNavigate} from "react-router-dom";
import { Button } from "@/components/ui/button";

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

/**
 * Підтвердження «Видалити пісню?». Своєї кнопки не має: відкриває його пункт
 * «Видалити» в меню дій (`SongActions`) через `dialogRef`.
 */
export default function DeleteSongDialog({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement | null> }) {
  return (
    <Modal
      dialogRef={dialogRef}
      title={"Дійсно видалити пісню?"}
      content={<Content />}
    />
  )
}
