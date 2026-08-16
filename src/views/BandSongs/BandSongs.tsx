import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MusicalNoteIcon, PlusIcon } from "@heroicons/react/24/outline";

import { fetchAPI } from "#utils/fetch-api";
import { SongFilterInput } from "#components";
import { ToPageBar } from "#layout/PageBar/ToPageBar";
import { bandPath } from "#constants/routes";
import { useBand } from "#modules/Band/BandLayout";
import { Button } from "@/components/ui/button";

/** Стеля Strapi на одну відповідь — `maxLimit` у `be/config/api.js`. */
const PAGE_SIZE = 100;
/**
 * Запобіжник: скільки сторінок готові забрати. Гурт із 2000 піснями — не наш
 * випадок, а нескінченний цикл на кривому `pageCount` — цілком можливий.
 */
const MAX_PAGES = 20;

type SongRow = {
  id: number;
  attributes: { name?: string; key?: string | null; bpm?: number | null };
};

/**
 * Уся бібліотека гурту, а не перша сторінка. Екран називається «всі пісні», і
 * мовчки обрізати його на 25-й (дефолт Strapi) — саме те, що тут і було: у
 * гурті з 43 піснями 18 не було видно нізвідки.
 *
 * `sort` іде на сервер не заради показу — за абеткою ми впорядкуємо самі, з
 * українською локаллю, — а заради стабільності сторінок: без нього порядок між
 * двома запитами не гарантований, і пісня може задвоїтись або зникнути.
 */
async function fetchAllSongs(bandId: number | string): Promise<SongRow[]> {
  const rows: SongRow[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    // Тільки те, що показує рядок. Раніше запит не звужували полями, тож
    // разом із назвами приїжджав повний `slate` кожної пісні — увесь текст
    // з акордами заради списку назв.
    const response = await fetchAPI(`/bands/${bandId}/songs`, {
      fields: ["name", "key", "bpm"],
      sort: { name: "asc" },
      pagination: { page, pageSize: PAGE_SIZE },
    });

    rows.push(...(response?.data ?? []));

    const pagination = response?.meta?.pagination;
    if (!pagination || page >= (pagination.pageCount ?? 1)) break;
  }

  return rows;
}

/** `Csharp` у базі — `C#` на екрані. */
function formatKey(key?: string | null) {
  return key ? key.replace("sharp", "#") : null;
}

/**
 * Бібліотека пісень гурту. Один список, впорядкований за абеткою, з фільтром
 * по назві згори.
 *
 * Чому в підписі рядка лише темп, без розміру: колонка `timeSignature`
 * заповнена лише в частини пісень (решта — `null`, хоча в самому документі
 * розмір стоїть), бо в базу її пише collab при збереженні. Показувати поле,
 * яке в двох третин пісень порожнє й розходиться з документом, — гірше, ніж
 * не показувати. Тональність же є завжди: у неї є дефолт на рівні бази.
 */
export default function BandSongs() {
  const band = useBand();
  const [songs, setSongs] = useState<SongRow[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchAllSongs(band.id)
      .then((rows) => {
        if (!cancelled) setSongs(rows);
      })
      .catch(() => {
        if (!cancelled) setSongs([]);
      });

    return () => {
      cancelled = true;
    };
  }, [band.id]);

  const shown = useMemo(() => {
    if (!songs) return [];

    // `localeCompare` з українською локаллю, а не сортування бази: інакше «Є»
    // та «І» стають після «Я» — порядок кодових точок, а не абетки.
    const sorted = [...songs].sort((a, b) =>
      (a.attributes.name ?? "").localeCompare(b.attributes.name ?? "", "uk"),
    );

    const needle = filter.trim().toLowerCase();
    if (!needle) return sorted;

    return sorted.filter((song) =>
      (song.attributes.name ?? "").toLowerCase().includes(needle),
    );
  }, [songs, filter]);

  return (
    <>
      <ToPageBar>{band.name}</ToPageBar>

      {/* Фільтр над карткою, як пошук над секціями на головній. Ховаємо його,
          поки список порожній: фільтрувати нічого. */}
      {songs !== null && songs.length > 0 && (
        <SongFilterInput
          className="mb-3"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      )}

      <section className="mb-3 overflow-hidden rounded-xl border border-border bg-background/60 shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold text-foreground/70">
            Пісні гурту
            {songs !== null && songs.length > 0 && (
              <span className="ml-2 font-normal text-muted-foreground">
                {shown.length}
              </span>
            )}
          </h2>
          {/* На порожній бібліотеці кнопки тут немає: заклик додати першу
              пісню вже стоїть нижче, і другий такий самий поруч — зайвий. */}
          {songs?.length ? (
            <Button asChild variant="ghost" size="sm">
              <Link to={bandPath.createSong(band.id)}>
                <PlusIcon className="size-4" />
                Додати
              </Link>
            </Button>
          ) : null}
        </div>

        {/* `null` — ще вантажимо: краще порожнеча, ніж блимнути «пісень
            немає» на бібліотеці, яка зараз приїде. */}
        {songs === null ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">…</div>
        ) : songs.length === 0 ? (
          <EmptyLibrary bandId={band.id} />
        ) : shown.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            За запитом «{filter.trim()}» нічого немає
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
            {shown.map((song) => (
              <li key={song.id}>
                <Link
                  to={bandPath.song(band.id, song.id)}
                  className="group flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-accent/60"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground/70 group-hover:text-foreground">
                    {formatKey(song.attributes.key) ?? (
                      <MusicalNoteIcon className="size-5" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-semibold leading-tight">
                      {song.attributes.name || "Без назви"}
                    </span>
                    {/* Темп 0 — це «не вказаний», а не повільна пісня. */}
                    {(song.attributes.bpm ?? 0) > 0 && (
                      <span className="truncate text-sm text-muted-foreground">
                        Темп {song.attributes.bpm}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function EmptyLibrary({ bandId }: { bandId: number | string }) {
  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-border text-foreground/50">
        <MusicalNoteIcon className="size-5" />
      </span>
      <div>
        <p className="text-base font-semibold leading-tight">
          Поки пісень немає
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Додай першу — імпортом з Holychords, копією з іншого гурту або з
          чистого аркуша.
        </p>
      </div>
      <Button asChild>
        <Link to={bandPath.createSong(bandId)}>
          <PlusIcon className="size-4" />
          Додати пісню
        </Link>
      </Button>
    </div>
  );
}
