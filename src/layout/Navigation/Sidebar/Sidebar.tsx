import {
  ArrowLeftEndOnRectangleIcon,
  GlobeEuropeAfricaIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import ChurchSelector from "./ChurchSelector/ChurchSelector";
import BandSelector from "./BandSelector/BandSelector";
import { Routes } from "../../../constants/routes";
import classNames from "classnames";

export default function Sidebar() {
  const user = useSelector((state: any) => state.user);
  const { pathname } = useLocation();
  const hasChurch = !!user?.church?.id;
  const hasBand = !!user?.currentBand?.id;
  console.log(pathname);

  if (!user) {
    return null;
  }

  return (
    <div className="drawer-side z-50">
      <label
        htmlFor="my-drawer-4"
        aria-label="close sidebar"
        className="drawer-overlay"
      ></label>
      <div className="bg-base-200 text-base-content min-h-full w-80 p-4 flex flex-col">
        <div className="flex justify-between items-center">
          <div className="pl-4 text-2xl font-bold">Меню</div>
          <div>
            <label
              htmlFor="my-drawer-4"
              className="block drawer-button btn btn-square p-1"
            >
              <XMarkIcon />
            </label>
          </div>
        </div>
        <div className="divider m-0" />
        <div className="flex flex-col grow justify-between">
          <div>
            <ul className="menu p-0">
              <li>
                <div className="flex justify-between gap-2 py-1 pr-1 hover:bg-base-200 active:bg-base-200">
                  <div className="flex items-center">
                    <UserIcon className="w-5 h-5 mr-2" />
                    Імʼя:
                  </div>
                  <button className="btn btn-ghost btn-sm w-44 bg-base-300">
                    @{user.username}
                  </button>
                </div>
                <ul>
                  <li>
                    <Link
                      to={Routes.Preferences}
                      className={classNames({
                        "bg-base-300": pathname.includes(Routes.Preferences),
                      })}
                    >
                      Налаштування
                    </Link>
                  </li>
                </ul>
              </li>
              <li>
                <ChurchSelector church={user?.church} />
                <ul>
                  <li>
                    <Link
                      to={Routes.ChurchSongs}
                      className={classNames({
                        "bg-base-300": pathname.includes(Routes.ChurchSongs),
                        "pointer-events-none opacity-30": !hasChurch,
                      })}
                    >
                      Всі пісні церкви
                    </Link>
                  </li>
                  {/*<li>*/}
                  {/*  <Link*/}
                  {/*    to={Routes.ChurchShedule}*/}
                  {/*    className={classNames({*/}
                  {/*      "bg-base-300": pathname.includes(Routes.ChurchShedule),*/}
                  {/*      "pointer-events-none opacity-30": !hasChurch,*/}
                  {/*    })}*/}
                  {/*  >*/}
                  {/*    Дати служінь*/}
                  {/*  </Link>*/}
                  {/*</li>*/}
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
                        "bg-base-300": pathname.includes(Routes.BandSongs),
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
                        "bg-base-300": pathname.includes(Routes.BandShedule),
                        "pointer-events-none opacity-30": !hasBand,
                      })}
                    >
                      Дати служінь
                    </Link>
                  </li>
                </ul>
              </li>
              {/*<li> OUT OF MVP SCOPE */}
              {/*  <Link*/}
              {/*    to={Routes.PublicSongs}*/}
              {/*    className={classNames("py-2.5", {*/}
              {/*      "bg-base-300": pathname.includes(Routes.PublicSongs),*/}
              {/*    })}*/}
              {/*  >*/}
              {/*    <GlobeEuropeAfricaIcon className="h-5 w-5" />*/}
              {/*    Всі пісні*/}
              {/*  </Link>*/}
              {/*</li>*/}
            </ul>
          </div>

          <Link to={Routes.Login}>
            <button className="btn w-full">
              <ArrowLeftEndOnRectangleIcon className="h-6 w-6" />
              Вийти
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
