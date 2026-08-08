import { CalendarIcon, CheckIcon } from "@heroicons/react/24/outline";
import { uk } from "date-fns/locale";
import { forwardRef, LegacyRef, useCallback, useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import DragDropList from "./DragDropList/DragDropList";
import { useNavigate, useParams } from "react-router-dom";
import { fetchAPI } from "#utils/fetch-api";
import { format } from "date-fns";
import { bandPath } from "#constants/routes";
import { useBand } from "#modules/Band/BandLayout";
import { formatDate } from "#utils/utils";
import DeleteSchedule from "./DeleteSchedule/DeleteSchedule";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";
import {useDispatch} from "react-redux";
import {ToPageHeaderArea} from "#layout/PageHeaderArea/ToPageHeaderArea";
import {ToPageFooterArea} from "#layout/PageFooterArea/ToPageFooterArea";
import { Button } from "@/components/ui/button";

const EMPTY_SHEDULE = {
  date: "",
  songs: [],
};

const Trigger = forwardRef(
  ({ value, onClick }: any, ref: LegacyRef<HTMLButtonElement>) => (
    <button
      onClick={onClick}
      ref={ref}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs flex justify-between items-center gap-2 w-full cursor-pointer"
    >
      {value && (
        <div className="text-xl font-medium">
          {formatDate(value.replace("/", "-"))}
        </div>
      )}
      {!value && <div className="text-xl text-placeholder">Оберіть дату</div>}
      <CalendarIcon className="w-6 h-6" />
    </button>
  )
);

export default function SingleShedule() {
  // `/bands/:bandId/lists/new` — без listId, отже режим створення.
  const { listId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<any>();
  const band = useBand();
  const isCreateMode = !listId;

  const [shedule, setShedule] = useState(null);


  useEffect(() => {
    if (isCreateMode) {
      setShedule(EMPTY_SHEDULE); // deep copy of EMPTY_SCHEDULE
      return;
    }

    fetchAPI(`/bands/${band.id}/lists/${listId}`, {
      populate: ["songs"],
    }).then((data) => {
      setShedule(data.data);
    });
  }, []);

  const addItem = useCallback((newItem) => {
    setShedule((prev) => ({
      ...prev,
      songs: [...prev.songs, newItem],
    }));
  }, []);

  const setItems = useCallback((items) => {
    setShedule((prev) => ({
      ...prev,
      songs: items,
    }));
  }, []);

  const setDate = useCallback((date) => {
    setShedule((prev) => ({
      ...prev,
      date: format(date, "yyyy-MM-dd"), // to be consistent (api support any type of date)
    }));
  }, []);

  const deleteItem = useCallback((itemId) => {
    setShedule((prev) => ({
      ...prev,
      songs: prev.songs.filter((item) => item.id !== itemId),
    }))
  }, [setShedule]);

  async function saveSchedule() {
    const data = await fetchAPI(
      isCreateMode
        ? `/bands/${band.id}/lists`
        : `/bands/${band.id}/lists/${listId}`,
      {},
      {
        method: isCreateMode ? "POST" : "PUT",
        body: JSON.stringify({
          data: shedule,
        }),
      }
    );

    if (isCreateMode && data) {
      navigate(bandPath.list(band.id, data.data.id));
    }
  }

  function deleteSchedule() {
    fetchAPI(
      `/bands/${band.id}/lists/${listId}`,
      {},
      {
        method: "DELETE"
      }
    )
      .then(() => {
        navigate(bandPath.home(band.id));
        dispatch(addNotificationWithTimeout({
          type: "success",
          message: "Список видалено"
        }));
      })
      .catch(() => {
        dispatch(addNotificationWithTimeout({
          type: "error",
          message: "Помилка серверу, не вдалось видалити список"
        }));
      });
  }

  if (!shedule) return null;

  return (
    <>
      <ToPageHeaderArea>Недільне служіння</ToPageHeaderArea>
      <div className="Bridge">
        <div className="mb-4">
          <DatePicker
            selected={shedule?.date ?? null}
            onChange={setDate} // Single date
            locale={uk}
            dateFormat="yyyy-MM-dd"
            customInput={<Trigger />}
            placeholderText="Оберіть дату"
          />
        </div>
        <div>
          <DragDropList
            items={shedule?.songs || []}
            setItems={setItems}
            addItem={addItem}
            deleteItem={deleteItem}
          />
        </div>
      </div>
      {!isCreateMode && <DeleteSchedule deleteSchedule={deleteSchedule} />}
      <ToPageFooterArea>
        <SavingButton saveShedule={saveSchedule} />
      </ToPageFooterArea>
    </>
  );
}

function SavingButton({ saveShedule }) {
  return (
      <Button
        className="rounded-4xl"
        onClick={saveShedule}
      >
        <CheckIcon className="w-6 h-6" />
        Зберегти як є {/*тут прикол в тому, що кнопка існує навіть тоді коли список не змінився і потреби зберігати немає*/}
      </Button>
  );
}
