import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MusicalNoteIcon } from "@heroicons/react/24/outline";

import { SongSearchInput } from "#components";
import { bandPath } from "#constants/routes";
import { fetchAPI } from "#utils/fetch-api";

type SearchGroup = {
  band: { id: number | string; name: string };
  songs: { id: number | string; name: string }[];
};

/** Пауза між останнім натиском і запитом. */
const DEBOUNCE_MS = 300;

/**
 * Сторінка пошуку пісні. Поле згори й фокус одразу при відкритті — екран
 * існує заради вводу. Сабміта немає: шукаємо самі, за паузою в наборі.
 */
export default function SearchSongs() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[] | null>(null);
  const [searching, setSearching] = useState(false);

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) {
      setGroups(null);
      setSearching(false);
      return;
    }

    setSearching(true);

    // `cancelled` рятує від гонки: відповідь на старий запит не має
    // перетирати результати свіжішого.
    let cancelled = false;
    const timer = setTimeout(() => {
      // Четвертий аргумент — без глобального лоадера: він блимав би на
      // кожне слово, а стан пошуку ми показуємо самі.
      fetchAPI("/searchSongs", { q: trimmed }, {}, true)
        .then((data) => {
          if (!cancelled) {
            setGroups(data?.data ?? []);
            setSearching(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setGroups([]);
            setSearching(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  // Пішов з поля, нічого не ввівши — шукати тут нічого, вертаємо назад.
  // Саме назад, а не на головну: екран пошуку тоді не лишає сліду в історії.
  function onBlur() {
    if (!trimmed) {
      navigate(-1);
    }
  }

  return (
    <div>
      <SongSearchInput
        className="mb-3"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={onBlur}
      />

      <Results query={trimmed} groups={groups} searching={searching} />
    </div>
  );
}

function Results({
  query,
  groups,
  searching,
}: {
  query: string;
  groups: SearchGroup[] | null;
  searching: boolean;
}) {
  if (!query) {
    return (
      <p className="text-sm text-muted-foreground">
        Почни вводити назву — шукаю по всіх твоїх гуртах.
      </p>
    );
  }

  // Перший пошук ще не повернувся: краще мовчати, ніж блимнути «нічого
  // не знайшов» за мить до результатів.
  if (groups === null) {
    return <p className="text-sm text-muted-foreground">Шукаю…</p>;
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Нічого не знайшов на «{query}». Спробуй коротший запит — шукаю по назві
        пісні.
      </p>
    );
  }

  return (
    <div
      className={
        // Поки летить наступний запит, старі результати лишаються на екрані,
        // тільки блякнуть: список не має стрибати на кожну літеру.
        searching ? "opacity-60 transition-opacity" : "transition-opacity"
      }
    >
      {groups.map((group) => (
        <section
          key={group.band.id}
          className="mb-3 overflow-hidden rounded-xl border border-border bg-background/60 shadow-xs"
        >
          <h2 className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground/70">
            {group.band.name}
          </h2>

          <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
            {group.songs.map((song) => (
              <li key={song.id}>
                <Link
                  to={bandPath.song(group.band.id, song.id)}
                  className="group flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-accent/60"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground/60 group-hover:text-foreground">
                    <MusicalNoteIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base font-medium leading-tight">
                    {song.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
