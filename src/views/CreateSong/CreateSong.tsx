import {Modal} from "#components";
import HolychordsModalContent from "./Holychords/HolychordsModalContent";
import {useCallback, useState} from "react";
import {songApi} from "#modules/SingleSong/api";
import {useNavigate} from "react-router-dom";
import {useDispatch} from "react-redux";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";
import {Routes} from "#constants/routes";

export default function CreateSong() {
  const navigate = useNavigate();
  const dispatch = useDispatch<any>();
  const [loading, setLoading] = useState(false);

  const createSong = useCallback(() => {
    setLoading(true);
    songApi.createSong({
      name: "Нова пісня"
    })
      .then((song) => {
        navigate(`${Routes.PublicSongs}/${song.data.id}`)
      })
      .catch(() => {
        dispatch(
          addNotificationWithTimeout({
            type: "error",
            message: "Не вдалось створити нову пісню.",
          })
        );
      });
  }, [navigate, dispatch]);

  return (
    <>
      <div className="flex justify-between items-center pb-8">
        <h1 className="text-3xl font-bold tracking-tight">Додавання пісні</h1>
      </div>
      <div className="flex items-center gap-4 flex-col">
        <Modal
          trigger={<button className="btn">Імпортувати з Holychords</button>}
          content={<HolychordsModalContent />}
          title={"Імпортувати з Holychords"}
        />
        <button className="btn" onClick={createSong}>
          {loading ? <div className="loading" /> :"Створити в редакторі"}
        </button>
      </div>
    </>
  );
}
