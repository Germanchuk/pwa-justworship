import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
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

  useEffect(() => {
    let cancelled = false;
    fetchAPI("/myBands")
      .then((data) => {
        if (!cancelled) setBands(data?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setBands([]);
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

/** Усе про гурти в одному блоці: список і створення нового. */
function BandsSection({ bands }: { bands: BandRow[] }) {
  // Гуртів немає — увесь блок стає запрошенням написати в телеграм:
  // самостійного створення гурту ще нема, тож інших шляхів звідси не існує.
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
              Створити гурт самостійно ще не можна. Напиши мені в телеграм — я
              заведу новий гурт або додам тебе до наявного 🎸
            </p>
          </div>
          <Button asChild>
            <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer">
              <ChatBubbleLeftEllipsisIcon className="size-4" />
              Написати в телеграм
            </a>
          </Button>
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

      {/* Самостійного створення гурту ще немає — кнопка стоїть на місці,
          але вимкнена, щоб не вести в тупик. */}
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center gap-3 border-t border-border p-3 text-start opacity-60"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-foreground/50">
          <PlusIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-semibold leading-tight text-foreground/70">
            Створити новий гурт
          </span>
          <span className="text-sm text-muted-foreground">Поки недоступно</span>
        </span>
      </button>
    </section>
  );
}
