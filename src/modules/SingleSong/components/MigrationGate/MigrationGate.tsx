import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { songApi } from "../../api";

interface CollabStatus {
  /** Пісня вже має collab-state: `lastCollabSavedAt` виставляється при першому збереженні. */
  migrated: boolean;
  /** Є що переносити зі старої `slate`-колонки (у новостворених пісень її ще немає). */
  hasLegacyContent: boolean;
}

interface Props {
  songId: string | number;
  children: ReactNode;
}

/**
 * Пісня переїжджає на новий (collab) редактор у момент першого підключення до
 * її Yjs-документа: сервер бутстрапить документ із legacy-колонки `slate` і
 * зберігає його як collab-state. Тому саме відкриття сторінки — незворотна
 * дія, і робимо ми її лише за явним кліком користувача.
 *
 * Уже мігровані пісні (і новостворені, де мігрувати нічого) відкриваються
 * одразу — кнопка з'являється тільки для legacy-пісень.
 */
export function MigrationGate({ songId, children }: Props) {
  const [status, setStatus] = useState<CollabStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setError(null);
    setConfirmed(false);

    songApi
      .getSong(songId)
      .then((response) => {
        if (cancelled) return;
        const song = response?.data ?? {};
        setStatus({
          migrated: !!song.lastCollabSavedAt,
          hasLegacyContent: Array.isArray(song.slate) && song.slate.length > 0,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message ?? err));
      });

    return () => {
      cancelled = true;
    };
  }, [songId]);

  if (error) {
    return (
      <div className="text-red-600 text-sm p-4 border border-red-200 rounded bg-red-50">
        Не вдалося перевірити стан пісні: {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="slate-editable-skeleton text-gray-400 text-sm p-4">
        Перевіряємо пісню…
      </div>
    );
  }

  if (status.migrated || !status.hasLegacyContent || confirmed) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-start gap-3 p-4 border border-amber-200 rounded bg-amber-50">
      <div className="text-sm text-amber-900">
        Ця пісня ще у старому форматі. Щоб відкрити її в новому редакторі, її
        треба перенести — текст, акорди й секції збережуться, але повернути
        стару версію через застосунок буде вже неможливо.
      </div>
      <Button onClick={() => setConfirmed(true)}>Мігрувати</Button>
    </div>
  );
}
