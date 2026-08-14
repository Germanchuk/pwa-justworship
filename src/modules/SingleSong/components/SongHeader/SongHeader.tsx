import {BackButton} from "./BackButton/BackButton";

export const SongHeader = () => {
  return (
    <div className="flex gap-2 items-center">
      <BackButton />
      <div className="grow" />
    </div>
  );
};
