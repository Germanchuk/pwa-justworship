import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { UserGroupIcon } from "@heroicons/react/24/outline";

import { fetchAPI } from "#utils/fetch-api";
import { Routes, bandPath } from "#constants/routes";
import { formatDate } from "#utils/utils";
import { ActionCard } from "#components";
import { SubHeaderArea } from "#layout/SubHeaderArea/SubHeaderArea";
import WelcomePage from "#views/WelcomePage/WelcomePage";

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
  const username = useSelector((state: any) => state.user?.username);
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
      <h1 className="text-3xl font-bold tracking-tight pb-4">
        Привіт, @{username}
      </h1>

      <SubHeaderArea>
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <ActionCard label="Створити новий гурт" to={Routes.CreateBand} />
          <ActionCard label="Приєднатися до гурту" to={Routes.JoinBand} />
        </div>
      </SubHeaderArea>

      {/* Гуртів ще немає — під кнопками лишається привітання з підказкою. */}
      {bands.length === 0 && <WelcomePage />}

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {bands.map((band) => (
          <li key={band.id}>
            <Link
              to={bandPath.home(band.id)}
              className="group flex w-full items-center gap-3 rounded-xl border bg-background/60 p-3 text-start shadow-xs transition-all hover:border-foreground/30 hover:bg-accent/60 hover:shadow-sm"
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
    </>
  );
}
