import {BackButton} from "./BackButton/BackButton";
import {ConnectionStatus} from "../ConnectionStatus/ConnectionStatus";

export const SongHeader = () => {
  return (
    <div className="flex gap-2 items-center">
      <BackButton />
      <div className="grow" />
      <div className="flex items-center gap-3 pr-2">
        <ConnectionStatus />
      </div>
    </div>
  );
};