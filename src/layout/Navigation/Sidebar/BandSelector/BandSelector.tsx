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
import {Dropdown} from "#components";
import { setCurrentBand } from "#modules/AuthenticatedUser/userSlice";

export default function BandSelector({ bands, currentBand }) {
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

  return (
    <div className="flex justify-between gap-2 py-1 pr-1 hover:bg-base-200 active:bg-base-200">
      <div className="col-span-2 flex items-center">
        <UserGroupIcon className="h-5 w-5 mr-2" />
        Гурт:
      </div>
      <div className="col-span-3">
        {!!bands?.length ? (
          <Dropdown
            position={"bottom"}
            trigger={(isOpen) => (
              <button className="btn btn-sm btn-outline btn-base-200 w-44 disabled">
                {currentBand?.name ? currentBand?.name : "Виберіть гурт"}
                <ChevronDownIcon
                  className={classNames("w-4 h-4", {
                    "rotate-180": isOpen,
                  })}
                />
              </button>
            )}
          >
            <ul className="menu bg-base-200 rounded-box w-full shadow-md m-0">
              {bands?.map((band) => (
                <li key={band.id} onClick={handleBandChange(band?.id)}>
                  <span
                    className={classNames("bg-base-200", { // out of MVP
                      "bg-base-300": band?.id === currentBand?.id,
                    })}
                  >
                    {band?.id === currentBand?.id ? (
                      <CheckCircleIcon className="w-5 h-5" />
                    ) : (
                      <CircleIcon className="w-5 h-5" />
                    )}
                    {band?.name}
                  </span>
                </li>
              ))}
              <li>
                <Link
                  to={Routes.JoinBand}
                  className="bg-base-200 ring-1 ring-base-700"
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  Приєднатись до гурту
                </Link>
              </li>
            </ul>
          </Dropdown>
        ) : (
          <button
            className="btn btn-sm btn-outline btn-base-200 w-44 opacity-30"
            // onClick={() => navigate(Routes.JoinBand)} out of MVP
          >
            <PlusCircleIcon className="w-5 h-5" />
            Приєднатись
          </button>
        )}
      </div>
    </div>
  );
}
