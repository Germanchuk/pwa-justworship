import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDaysIcon,
  ChatBubbleLeftEllipsisIcon,
  Cog6ToothIcon,
  PlusIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

import { fetchAPI } from "#utils/fetch-api";
import { Routes, bandPath } from "#constants/routes";
import { formatDate } from "#utils/utils";
import {
  ActionCard,
  SongSearchTrigger,
  SupportCard,
  SUPPORT_TELEGRAM_URL,
  UpdateBanner,
  WhatsNewCard,
} from "#components";
import { Button } from "@/components/ui/button";

type BandRow = {
  id: number | string;
  name: string;
  songsCount: number;
  listsCount: number;
  lastList: { id: number; date: string } | null;
};

type UpcomingRow = {
  id: number;
  date: string;
  band: { id: number; name: string } | null;
};

/** Скільки найближчих служінь показуємо. */
const UPCOMING_SIZE = 5;

/**
 * Сьогодні як `YYYY-MM-DD` у місцевому часі. Свідомо не `toISOString()`:
 * той рахує в UTC і ввечері віддає вже завтрашню дату — служіння сьогоднішнього
 * вечора зникло б зі списку саме тоді, коли воно найпотрібніше.
 */
function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Ініціали для аватарки: перші літери перших двох слів назви. */
function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function subtitle(band: BandRow) {
  if (band.lastList) {
    return `Останнє служіння — ${formatDate(band.lastList.date)}`;
  }
  if (band.songsCount) {
    return `${band.songsCount} пісень, служінь ще немає`;
  }
  return "Порожній гурт — саме час додати пісню";
}

export default function BandsHome() {
  const [bands, setBands] = useState<BandRow[] | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAPI("/myBands")
      .then((data) => {
        if (!cancelled) setBands(data?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setBands([]);
      });

    // Найближчі служіння з УСІХ гуртів юзера: `/myLists` сам обмежує вибірку
    // його гуртами, дату й порядок задаємо звідси.
    fetchAPI("/myLists", {
      filters: { date: { $gte: todayISO() } },
      sort: { date: "asc" },
      pagination: { pageSize: UPCOMING_SIZE },
      fields: ["date"],
      populate: { band: { fields: ["name"] } },
    })
      .then((data) => {
        if (cancelled) return;
        setUpcoming(
          (data?.data ?? []).map((list: any) => ({
            id: list.id,
            date: list.attributes?.date,
            band: list.attributes?.band?.data
              ? {
                  id: list.attributes.band.data.id,
                  name: list.attributes.band.data.attributes?.name,
                }
              : null,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setUpcoming([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!bands) {
    return null;
  }

  return (
    <>
      {/* Новини про версію — найвище на екрані: це єдиний екран, який
          користувач гарантовано бачить перед роботою з піснями. */}
      <UpdateBanner />
      <WhatsNewCard />

      {/* Запрошення написати в телеграм — над усім іншим: банери вище
          з'являються рідко, тож зазвичай картка й відкриває екран. */}
      <SupportCard className="mb-3" />

      <SongSearchTrigger className="mb-3" />

      {/* Найближчі служіння — над гуртами: зазвичай застосунок відкривають
          саме заради наступної неділі, і це найкоротший шлях до неї. */}
      <UpcomingSection lists={upcoming} />

      <BandsSection bands={bands} />

      {/* Налаштування — під усіма блоками: заходять туди рідко. */}
      <ActionCard
        label="Налаштування"
        to={Routes.Preferences}
        icon={<Cog6ToothIcon className="size-5" />}
        className="min-h-0 flex-row items-center justify-start"
      />
    </>
  );
}

/**
 * Найближчі служіння з усіх гуртів. Дат може не бути зовсім — тоді секція
 * лишається на місці й пояснює, чому вона порожня: зникати їй не можна, бо
 * інакше екран стрибає щоразу, коли остання неділя минула.
 */
function UpcomingSection({ lists }: { lists: UpcomingRow[] | null }) {
  // `null` — ще вантажимо: краще нічого, ніж блимнути «служінь немає».
  if (lists === null) {
    return null;
  }

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-border bg-background/60 shadow-xs">
      <h2 className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground/70">
        Найближчі служіння
      </h2>

      {lists.length === 0 ? (
        <div className="flex items-center gap-3 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-foreground/50">
            <CalendarDaysIcon className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            Попереду порожньо. Створи список на найближчу неділю — і він
            з'явиться тут.
          </p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
          {lists.map((list) => (
            <li key={list.id}>
              {/* Без гурту вести нікуди — рядок лишається, але тьмяний. */}
              {list.band ? (
                <Link
                  to={bandPath.list(list.band.id, list.id)}
                  className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-accent/60"
                >
                  <UpcomingRowContent list={list} />
                </Link>
              ) : (
                <div className="flex w-full items-center gap-3 p-3 opacity-60">
                  <UpcomingRowContent list={list} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UpcomingRowContent({ list }: { list: UpcomingRow }) {
  return (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground/70">
        <CalendarDaysIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold leading-tight">
          {formatDate(list.date)}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {list.band?.name ?? "Гурт недоступний"}
        </span>
      </span>
    </>
  );
}

/** Усе про гурти в одному блоці: список і створення нового. */
function BandsSection({ bands }: { bands: BandRow[] }) {
  // Гуртів немає — блок стає запрошенням завести перший. Приєднання до
  // чужого гурту ще не автоматизоване, тож другий шлях — телеграм.
  if (bands.length === 0) {
    return (
      <section className="mb-3 overflow-hidden rounded-xl border border-border bg-background/60 shadow-xs">
        <h2 className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground/70">
          Гурти
        </h2>

        <div className="flex flex-col items-start gap-3 p-4">
          <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-border text-foreground/50">
            <UserGroupIcon className="size-5" />
          </span>
          <div>
            <p className="text-base font-semibold leading-tight">
              Гуртів поки немає
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Створи свій гурт — станеш його лідером. Якщо треба приєднатися до
              наявного, напиши мені в телеграм 🎸
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={Routes.CreateBand}>
                <PlusIcon className="size-4" />
                Створити гурт
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer">
                <ChatBubbleLeftEllipsisIcon className="size-4" />
                Написати в телеграм
              </a>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-border bg-background/60 shadow-xs">
      <h2 className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground/70">
        Гурти
      </h2>

      <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
        {bands.map((band) => (
          <li key={band.id}>
            <Link
              to={bandPath.home(band.id)}
              className="group flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-accent/60"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground/70 group-hover:text-foreground">
                {initials(band.name) || <UserGroupIcon className="size-5" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold leading-tight">
                  {band.name}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {subtitle(band)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Останнім рядком списку — створення ще одного гурту. */}
      <Link
        to={Routes.CreateBand}
        className="flex w-full items-center gap-3 border-t border-border p-3 text-start transition-colors hover:bg-accent/60"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-foreground/50">
          <PlusIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-semibold leading-tight">
            Створити новий гурт
          </span>
          <span className="text-sm text-muted-foreground">
            Ти станеш його лідером
          </span>
        </span>
      </Link>
    </section>
  );
}
