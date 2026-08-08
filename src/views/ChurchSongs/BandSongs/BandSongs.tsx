import {Collapsible} from "#components";
import React from "react";
import classNames from "classnames";

export default function BandSongs({name, songs}) {
  return (
    <Collapsible
      Trigger={({isOpen, clickHandler}) => (
        <div
          onClick={clickHandler}
          className={classNames("bg-accent px-3 py-2 rounded mb-2 flex justify-between", {
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
      {/* Пісні чужих гуртів більше не відкриваються — лишається лише перелік. */}
      {songs?.map((song) => (
        <div key={song.id} className="bg-muted px-3 py-2 rounded block mb-2">
          {song.name}
        </div>
      ))}
    </Collapsible>
  )
}
