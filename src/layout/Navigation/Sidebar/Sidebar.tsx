import {
  ArrowLeftEndOnRectangleIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import BandSelector from "./BandSelector/BandSelector";
import { Routes } from "../../../constants/routes";
import classNames from "classnames";
import { Button } from "@/components/ui/button";
import { DrawerClose } from "@/components/ui/drawer";

export default function Sidebar() {
  const user = useSelector((state: any) => state.user);
  const { pathname } = useLocation();
  const hasChurch = !!user?.church?.id;
  const hasBand = !!user?.currentBand?.id;

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col grow p-4 overflow-y-auto">
      <div className="flex justify-between items-center">
        <div className="pl-4 text-2xl font-bold">Меню</div>
        <DrawerClose asChild>
          <Button variant="outline" size="icon">
            <XMarkIcon className="size-4" />
          </Button>
        </DrawerClose>
      </div>
      <hr className="my-2 border-border" />
      <div className="flex flex-col grow justify-between gap-4">
        <div>
          <ul className="flex flex-col gap-1 p-0 list-none [&_li>a]:flex [&_li>a]:items-center [&_li>a]:gap-2 [&_li>a]:rounded-md [&_li>a]:px-3 [&_li>a]:py-2 [&_li>a]:text-sm hover:[&_li>a]:bg-accent hover:[&_li>a]:text-accent-foreground">
            <li>
              <div className="flex justify-between gap-2 py-1 pr-1 hover:bg-muted active:bg-muted">
                <div className="flex items-center">
                  <UserIcon className="w-5 h-5 mr-2" />
                  Імʼя:
                </div>
                <Button variant="secondary" size="sm" className="w-44">
                  @{user.username}
                </Button>
              </div>
              <ul>
                <li>
                  <Link
                    to={Routes.Preferences}
                    className={classNames({
                      "bg-accent": pathname.includes(Routes.Preferences),
                    })}
                  >
                    Налаштування
                  </Link>
                </li>
              </ul>
            </li>
            <li>
              <ul>
                <li>
                  <Link
                    to={Routes.ChurchSongs}
                    className={classNames({
                      "bg-accent": pathname.includes(Routes.ChurchSongs),
                      "pointer-events-none opacity-30": !hasChurch,
                    })}
                  >
                    Всі пісні церкви
                  </Link>
                </li>
              </ul>
            </li>
            <li>
              <BandSelector
                bands={user?.bands}
                currentBand={user?.currentBand}
              />
              <ul>
                <li>
                  <Link
                    to={Routes.BandSongs}
                    className={classNames({
                      "bg-accent": pathname.includes(Routes.BandSongs),
                      "pointer-events-none opacity-30": !hasBand,
                    })}
                  >
                    Всі пісні гурту
                  </Link>
                </li>
                <li>
                  <Link
                    to={Routes.BandShedule}
                    className={classNames({
                      "bg-accent": pathname.includes(Routes.BandShedule),
                      "pointer-events-none opacity-30": !hasBand,
                    })}
                  >
                    Дати служінь
                  </Link>
                </li>
              </ul>
            </li>
          </ul>
        </div>

        <Link to={Routes.Login}>
          <Button className="w-full">
            <ArrowLeftEndOnRectangleIcon className="h-6 w-6" />
            Вийти
          </Button>
        </Link>
      </div>
    </div>
  );
}
