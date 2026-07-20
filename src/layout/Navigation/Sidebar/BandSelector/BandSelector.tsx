import {
  CheckCircleIcon,
  ChevronDownIcon,
  PlusCircleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import classNames from "classnames";
import React from "react";
import CircleIcon from "../../../../icons/CircleIcon";
import { useDispatch } from "react-redux";
import { fetchAPI } from "../../../../utils/fetch-api";
import { Link } from "react-router-dom";
import { Routes } from "../../../../constants/routes";
import { Dropdown } from "#components";
import { setCurrentBand } from "#modules/AuthenticatedUser/userSlice";
import { Button } from "@/components/ui/button";

type Variant = "compact" | "hero";

interface BandSelectorProps {
  bands: any[];
  currentBand: any;
  variant?: Variant;
}

export default function BandSelector({
  bands,
  currentBand,
  variant = "compact",
}: BandSelectorProps) {
  const dispatch = useDispatch();

  const handleBandChange = (bandId) => () => {
    if (bandId === currentBand?.id) {
      return;
    }

    dispatch(setCurrentBand(bands?.find((band) => band?.id === bandId)));

    fetchAPI("/users-permissions/users/me", null, {
      method: "PUT",
      body: JSON.stringify({
        currentBand: bandId,
      }),
    })
      .then(() => {
        window.location.reload();
      })
      .catch(() => {
        dispatch(
          // @ts-ignore
          addNotificationWithTimeout({
            message: "Щось не так",
            type: "error",
          })
        );
      });
  };

  const menu = (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0 [&_li>span]:flex [&_li>span]:cursor-pointer [&_li>span]:items-center [&_li>span]:gap-2 [&_li>span]:rounded-sm [&_li>span]:px-2 [&_li>span]:py-1.5 [&_li>span]:text-sm hover:[&_li>span]:bg-accent hover:[&_li>span]:text-accent-foreground [&_li>a]:flex [&_li>a]:items-center [&_li>a]:gap-2 [&_li>a]:rounded-sm [&_li>a]:px-2 [&_li>a]:py-1.5 [&_li>a]:text-sm hover:[&_li>a]:bg-accent hover:[&_li>a]:text-accent-foreground">
      {bands?.map((band) => (
        <li key={band.id} onClick={handleBandChange(band?.id)}>
          <span
            className={classNames({
              "bg-accent text-accent-foreground": band?.id === currentBand?.id,
            })}
          >
            {band?.id === currentBand?.id ? (
              <CheckCircleIcon className="size-4" />
            ) : (
              <CircleIcon className="size-4" />
            )}
            {band?.name}
          </span>
        </li>
      ))}
      <li className="my-1 border-t" />
      <li>
        <Link to={Routes.JoinBand}>
          <PlusCircleIcon className="size-4" />
          Приєднатись до гурту
        </Link>
      </li>
    </ul>
  );

  if (variant === "hero") {
    if (!bands?.length) {
      return (
        <Button asChild variant="outline" className="h-auto w-full justify-start gap-3 p-4">
          <Link to={Routes.JoinBand}>
            <span className="flex size-10 items-center justify-center rounded-md border border-border bg-background">
              <PlusCircleIcon className="size-5" />
            </span>
            <span className="flex flex-col items-start">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Гурт
              </span>
              <span className="text-base font-semibold">Приєднатись до гурту</span>
            </span>
          </Link>
        </Button>
      );
    }
    return (
      <Dropdown
        position="bottom"
        align="end"
        className="w-72"
        trigger={(isOpen) => (
          <button
            type="button"
            className="group flex w-full items-center gap-2.5 rounded-xl border bg-background/60 p-2.5 text-start shadow-xs transition-all hover:border-foreground/30 hover:bg-accent/60 hover:shadow-sm cursor-pointer"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground/70 group-hover:text-foreground">
              <UserGroupIcon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Гурт
              </span>
              <span className="truncate text-base font-semibold leading-tight">
                {currentBand?.name ?? "Виберіть гурт"}
              </span>
            </span>
            <ChevronDownIcon
              className={classNames(
                "size-4 shrink-0 opacity-60 transition-transform",
                { "rotate-180": isOpen }
              )}
            />
          </button>
        )}
      >
        {menu}
      </Dropdown>
    );
  }

  return (
    <div className="flex justify-between gap-2 py-1 pr-1 hover:bg-muted active:bg-muted">
      <div className="col-span-2 flex items-center">
        <UserGroupIcon className="h-5 w-5 mr-2" />
        Гурт:
      </div>
      <div className="col-span-3">
        {bands?.length ? (
          <Dropdown
            position="bottom"
            trigger={(isOpen) => (
              <Button variant="outline" size="sm" className="w-44 justify-between">
                <span className="truncate">
                  {currentBand?.name ? currentBand?.name : "Виберіть гурт"}
                </span>
                <ChevronDownIcon
                  className={classNames("size-4 shrink-0 opacity-60 transition-transform", {
                    "rotate-180": isOpen,
                  })}
                />
              </Button>
            )}
          >
            {menu}
          </Dropdown>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-44 opacity-30"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Приєднатись
          </Button>
        )}
      </div>
    </div>
  );
}
