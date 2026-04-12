import {MagicInput} from "#components";
import {useBpm, useEditMode} from '../../../redux/selectors';
import { handleBpmChange } from "./actions";
import classNames from "classnames";

export default function BpmSelector() {
  const bpm = useBpm();
  const isEditMode = useEditMode();
  return (
    <div className="flex gap-2 items-center">
      <div className="text font-semibold">Темп:</div>
      <MagicInput
        className={classNames("px-2.5 font-semibold text-lg rounded border !border-dashed", {
          "border-gray-400": isEditMode,
          "border-transparent": !isEditMode
        })}
        value={String(bpm ?? '')}
        setValue={handleBpmChange}
      />
    </div>
  );
}
