import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { fetchAPI } from "#utils/fetch-api";
import { setUser } from "#modules/AuthenticatedUser/userSlice";
import { addNotificationWithTimeout } from "#layout/slices/notificationsSlice";
import { bandApi } from "#modules/Band/api/band";
import { Routes } from "#constants/routes";
import { Button } from "@/components/ui/button";

type Props = {
  bandId: number | string;
  bandName: string;
};

/** Скільки всього рядків у band-scoped колекції: тягнемо лише `meta`. */
async function countOf(bandId: number | string, collection: string) {
  const response = await fetchAPI(
    `/bands/${bandId}/${collection}`,
    { pagination: { pageSize: 1 } },
    {},
    true,
  );
  return response?.meta?.pagination?.total ?? 0;
}

/**
 * Видалення гурту — доступне лише лідеру (сервер перевіряє це сам,
 * політикою `is-band-leader`; тут ми лише не показуємо кнопку іншим).
 *
 * Захист від випадкового тику — ввести назву гурту. Просте «Так/Ні», як у
 * видаленні пісні, тут закоротке: ціна помилки — весь репертуар гурту.
 */
export default function DeleteBand({ bandId, bandName }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [counts, setCounts] = useState<{ songs: number; lists: number } | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Рахуємо, що саме зникне, лише коли модалку відкрили.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    Promise.all([countOf(bandId, "songs"), countOf(bandId, "lists")])
      .then(([songs, lists]) => {
        if (!cancelled) setCounts({ songs, lists });
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, bandId]);

  const close = () => {
    setOpen(false);
    setConfirmation("");
    setCounts(null);
  };

  const confirmed = confirmation.trim() === bandName.trim();

  const remove = async () => {
    if (!confirmed) return;
    setDeleting(true);
    try {
      await bandApi.archive(bandId);

      // Прибираємо гурт зі стору ДО навігації, інакше `BandLayout` устигне
      // побачити ще живий гурт і лишити нас на його сторінці.
      const user = await fetchAPI("/users/me", { populate: ["bands"] });
      dispatch(setUser(user));

      navigate(Routes.Root);
      dispatch(
        addNotificationWithTimeout({
          message: `Гурт "${bandName}" видалено`,
          type: "success",
        }),
      );
    } catch {
      setDeleting(false);
      dispatch(
        addNotificationWithTimeout({
          message: "Не вдалося видалити гурт",
          type: "error",
        }),
      );
    }
  };

  return (
    <section className="mt-10 rounded-md border border-destructive/40 p-4">
      <h2 className="text-sm font-semibold text-destructive">Небезпечна зона</h2>

      {!open ? (
        <>
          <p className="mt-1 mb-3 text-sm text-stone-500">
            Гурт зникне для всіх учасників разом із піснями й служіннями.
          </p>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
            Видалити гурт
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-stone-600">
            Для всіх учасників зникне гурт «{bandName}»
            {counts
              ? `, ${counts.songs} пісень і ${counts.lists} служінь`
              : ", усі його пісні й служіння"}
            .
          </p>
          <p className="mt-1 mb-3 text-sm text-stone-500">
            Дані не стираються — відновити гурт зможу я, якщо напишеш. Але
            повернути його самостійно ти не зможеш.
          </p>

          <label className="block text-sm text-stone-600">
            Введи назву гурту, щоб підтвердити:
            <input
              type="text"
              autoFocus
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={bandName}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            />
          </label>

          <div className="mt-3 flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={!confirmed || deleting}
              onClick={remove}
            >
              {deleting ? "Видаляю…" : "Так, видалити"}
            </Button>
            <Button variant="outline" size="sm" onClick={close}>
              Скасувати
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
