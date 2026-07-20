import {useDispatch} from "react-redux";
import {useNavigate} from "react-router-dom";
import {songApi} from "#modules/SingleSong/api";
import {Routes} from "#constants/routes";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";
import {DocumentDuplicateIcon} from "@heroicons/react/24/outline";
import React from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ songId}) {
  const dispatch = useDispatch<any>();
  const navigate = useNavigate();

  const copySong = () => {
    songApi.copySong(songId as string).then((data) => {
      navigate(`${Routes.PublicSongs}/${data.data.id}`);
    })
      .catch(() => {
        dispatch(addNotificationWithTimeout({
          type: "error",
          message: "Помилка серверу, не вдалось скопіювати пісню",
        }));
      });
  }
  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full border-dashed"
      onClick={copySong}
    >
      <DocumentDuplicateIcon className="w-6 h-6" />
    </Button>
  );
}
