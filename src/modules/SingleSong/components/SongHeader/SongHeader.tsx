import React from "react";
import {Status} from "#components";
import {useStatus} from "../../redux/selectors";
import {SongName} from "./SongName/SongName";
import {BackButton} from "./BackButton/BackButton";

export const SongHeader = () => {
  const status = useStatus();
  return (
    <div className="flex gap-2 items-center">
      <BackButton />
      <div className={"grow"}>
        <SongName />
      </div>
      <div className={"pr-2"}>
        <Status status={status} />
      </div>
    </div>
  )
}