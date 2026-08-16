import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { fetchAPI } from "#utils/fetch-api";
import { setUser } from "#modules/AuthenticatedUser/userSlice";
import { addNotificationWithTimeout } from "#layout/slices/notificationsSlice";
import { bandApi } from "#modules/Band/api/band";
import { bandPath } from "#constants/routes";
import { Button } from "@/components/ui/button";

const NAME_MAX_LENGTH = 60;

export default function CreateBand() {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const notify = (message: string, type: "error" | "success") =>
    dispatch(addNotificationWithTimeout({ message, type }));

  async function submitHandler(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      notify("Вкажіть назву гурту", "error");
      return;
    }

    setSaving(true);
    try {
      const { data } = await bandApi.create(trimmed);

      // Новий гурт має приїхати в redux ДО навігації: `BandLayout` пускає
      // всередину лише гурти зі списку юзера, інакше нас відкине на головну.
      const user = await fetchAPI("/users/me", { populate: ["bands"] });
      dispatch(setUser(user));

      navigate(bandPath.home(data.id));
      notify(`Гурт "${data.name}" створено. Ти його лідер 🎸`, "success");
    } catch (error) {
      // `fetchAPI` перезагортає помилку сервера, лишаючи префікс "Error: ".
      const message =
        error instanceof Error
          ? error.message.replace(/^Error:\s*/, "")
          : "";
      notify(message || "Не вдалося створити гурт", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitHandler}>
      <h1 className="text-2xl font-bold mb-2">Зареєструвати гурт</h1>

      <p className="mb-3 text-sm text-muted-foreground">
        Ти станеш лідером гурту — решта учасників приєднається пізніше.
      </p>

      <label className="form-control w-full">
        <div className="label">
          <span className="label-text">Назва гурту:</span>
        </div>
        <input
          type="text"
          autoFocus
          value={name}
          maxLength={NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="Хілсонг"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs w-full"
        />
      </label>

      <div className="py-4 flex justify-center">
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Створюю…" : "Зареєструвати"}
        </Button>
      </div>
    </form>
  );
}
