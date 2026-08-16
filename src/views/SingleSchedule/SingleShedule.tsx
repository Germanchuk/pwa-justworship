import {
  CalendarDaysIcon,
  CheckIcon,
  PencilSquareIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { uk } from "date-fns/locale";
import {
  forwardRef,
  LegacyRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import DatePicker from "react-datepicker";
import DragDropList from "./DragDropList/DragDropList";
import SongsOrder from "./SongsOrder/SongsOrder";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchAPI } from "#utils/fetch-api";
import { format } from "date-fns";
import { bandPath } from "#constants/routes";
import {
  DEFAULT_LIST_TITLE,
  LIST_TITLE_MAX_LENGTH,
} from "#constants/app";
import { useBand } from "#modules/Band/BandLayout";
import { formatDate } from "#utils/utils";
import DeleteSchedule from "./DeleteSchedule/DeleteSchedule";
import {addNotificationWithTimeout} from "#layout/slices/notificationsSlice";
import {useDispatch} from "react-redux";
import {ToPageBar} from "#layout/PageBar/ToPageBar";
import { Button } from "@/components/ui/button";

const EMPTY_SHEDULE = {
  date: "",
  title: "",
  songs: [],
};

/**
 * Шапка служіння — дата й підпис. У читанні це одна картка: дата великим,
 * підпис дрібним під нею, як рядок у «Найближчих служіннях» на головному.
 * У правці — та сама картка, але рядками-полями: дата відкриває календар,
 * підпис редагується на місці. Дату й підпис на служінні ніхто не міняє,
 * тож у читанні їм нема від чого реагувати на дотик.
 */
const headerCardClass = (invalid?: boolean) =>
  `mb-3 overflow-hidden rounded-xl border bg-background/60 shadow-xs ${
    invalid ? "border-destructive" : "border-border"
  }`;

const rowClass = "flex w-full items-center gap-3 p-3 text-start";

const circleClass = (invalid?: boolean) =>
  `flex size-11 shrink-0 items-center justify-center rounded-full border bg-muted ${
    invalid ? "border-destructive text-destructive" : "border-border text-foreground/70"
  }`;

/** Дата рядком: у читанні — текст, у правці — те, що відкриває календар. */
function DateRowContent({ date, invalid }: any) {
  return (
    <>
      <span className={circleClass(invalid)}>
        <CalendarDaysIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold leading-tight">
          {date ? formatDate(date.replace("/", "-")) : "Оберіть дату"}
        </span>
        {invalid && (
          <span className="truncate text-sm text-destructive">
            Без дати список не зберегти
          </span>
        )}
      </span>
    </>
  );
}

const Trigger = forwardRef(
  ({ value, onClick, invalid }: any, ref: LegacyRef<HTMLButtonElement>) => (
    <button
      onClick={onClick}
      ref={ref}
      className={`${rowClass} cursor-pointer transition-colors hover:bg-accent/60`}
    >
      <DateRowContent date={value} invalid={invalid} />
    </button>
  )
);

export default function SingleShedule() {
  // `/bands/:bandId/lists/new` — без listId, отже режим створення.
  const { listId, mode } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<any>();
  const band = useBand();
  const isCreateMode = !listId;

  // Джерело правди про режим — ШЛЯХ, як і в пісні: `lists/:listId` це
  // читання, `lists/:listId/edit` — правка. Новий список нічого читати не
  // може, тож відкривається одразу в правці. Невідомий сегмент — не помилка:
  // показуємо читання, бо саме воно безпечне.
  const isEditing = isCreateMode || mode === "edit";

  const [shedule, setShedule] = useState(null);
  // Підсвітка «дата обов'язкова». Вмикається лише спробою зберегти: до неї
  // порожня дата — ще не помилка, а просто незаповнений новий список.
  const [dateMissing, setDateMissing] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  // Останній збережений стан списку. Потрібен «Скасувати»: сторінка при
  // перемиканні режиму не перемонтовується, тож без відкату читання показувало
  // б незбережені зміни так, ніби вони вже в базі.
  const savedRef = useRef(null);

  useEffect(() => {
    if (isCreateMode) {
      setShedule(EMPTY_SHEDULE); // deep copy of EMPTY_SCHEDULE
      return;
    }

    fetchAPI(`/bands/${band.id}/lists/${listId}`, {
      populate: ["songs"],
    }).then((data) => {
      savedRef.current = data.data;
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

  const setTitle = useCallback((title) => {
    setShedule((prev) => ({
      ...prev,
      title,
    }));
  }, []);

  const setDate = useCallback((date) => {
    setDateMissing(false);
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
    // Дата — єдине, чим список називається на всіх інших екранах, тож без неї
    // зберігати нема чого. Те саме правило продубльоване в контролері `list`:
    // тут воно лише пояснює користувачу, чого від нього хочуть.
    //
    // Помилка живе на самому полі, а не повідомленням: поле дати при довгому
    // списку може бути далеко вгорі від кнопки, тож підсвітку ще й підвозимо
    // до очей.
    if (!shedule.date) {
      setDateMissing(true);
      dateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    try {
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

      // Збереглось — виходимо в читання: правка це короткий візит, а не стан,
      // у якому лишаються. `replace`, щоб «назад» вело туди, звідки прийшли,
      // а не назад у правку.
      savedRef.current = shedule;
      navigate(bandPath.list(band.id, isCreateMode ? data.data.id : listId), {
        replace: true,
      });
    } catch {
      // Не зберегли — лишаємось у правці, інакше накидані пісні просто зникли б
      // з екрана разом з переходом у читання.
      dispatch(
        addNotificationWithTimeout({
          type: "error",
          message: "Помилка серверу, не вдалось зберегти список",
        })
      );
    }
  }

  /** Вихід із правки без збереження: відкочуємо список і повертаємось у читання. */
  function cancelEditing() {
    setShedule(savedRef.current);
    setDateMissing(false);
    navigate(bandPath.list(band.id, listId), { replace: true });
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

  const songs = shedule?.songs || [];

  return (
    <>
      <ToPageBar>{band.name}</ToPageBar>

      <div className={headerCardClass(dateMissing)} ref={dateRef}>
        {isEditing ? (
          <>
            <div className="ScheduleDate">
              <DatePicker
                selected={shedule?.date ?? null}
                onChange={setDate} // Single date
                locale={uk}
                dateFormat="yyyy-MM-dd"
                customInput={<Trigger invalid={dateMissing} />}
                placeholderText="Оберіть дату"
              />
            </div>

            <label className={`${rowClass} border-t border-border`}>
              <span className={circleClass()}>
                <TagIcon className="size-5" />
              </span>
              {/* Порожньо — не помилка: плейсхолдер показує той самий текст,
                  який побачить гурт, тож підписувати треба лише незвичайне
                  служіння. */}
              <input
                type="text"
                value={shedule.title ?? ""}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={LIST_TITLE_MAX_LENGTH}
                placeholder={DEFAULT_LIST_TITLE}
                className="min-w-0 grow appearance-none bg-transparent text-base outline-0 placeholder:text-muted-foreground"
              />
            </label>
          </>
        ) : (
          <div className={rowClass}>
            <span className={circleClass()}>
              <CalendarDaysIcon className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-semibold leading-tight">
                {formatDate(shedule.date)}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {shedule.title?.trim() || DEFAULT_LIST_TITLE}
              </span>
            </span>
          </div>
        )}
      </div>

      {isEditing ? (
        <DragDropList
          items={songs}
          setItems={setItems}
          addItem={addItem}
          deleteItem={deleteItem}
        />
      ) : (
        <SongsOrder items={songs} bandId={band.id} />
      )}

      {/* Кнопка режиму — під списком, а не у верхньому барі: вона стосується
          саме списку, і на неї не можна натрапити пальцем, гортаючи пісні. */}
      <div className="flex justify-center gap-2">
        {isEditing ? (
          <>
            <Button onClick={saveSchedule}>
              <CheckIcon className="size-5" />
              Зберегти як є
            </Button>
            {/* У створенні скасовувати нема куди — попереднього режиму
                в нового списку не існує. */}
            {!isCreateMode && (
              <Button variant="ghost" onClick={cancelEditing}>
                Скасувати
              </Button>
            )}
          </>
        ) : (
          <Button asChild variant="outline">
            <Link to={bandPath.editList(band.id, listId)}>
              <PencilSquareIcon className="size-5" />
              Редагувати
            </Link>
          </Button>
        )}
      </div>

      {/* Видалення живе тільки в правці: на служінні його на екрані немає. */}
      {isEditing && !isCreateMode && (
        <DeleteSchedule deleteSchedule={deleteSchedule} />
      )}
    </>
  );
}
