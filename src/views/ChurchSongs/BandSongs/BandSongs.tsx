import {Collapsible} from "#components";
import {Routes} from "#constants/routes";
import {Link} from "react-router-dom";
import React from "react";
import classNames from "classnames";

export default function BandSongs({name, songs}) {
  return (
    <Collapsible
      Trigger={({isOpen, clickHandler}) => (
        <div
          onClick={clickHandler}
          className={classNames("bg-base-300 px-3 py-2 rounded mb-2 flex justify-between", {
            "bg-white": isOpen,
          })}
        >
          <span className="font-semibold">{name}</span>
          <span>{songs.length} пісень</span>
        </div>
      )
      }
      openByDefault={true}
    >
      {songs?.map((song) => (
        <Link
          to={`${Routes.PublicSongs}/${song.id}`}
          className="bg-base-200 px-3 py-2 rounded block mb-2"
        >
          {song.name}
        </Link>
      ))}
    </Collapsible>
  )
}
