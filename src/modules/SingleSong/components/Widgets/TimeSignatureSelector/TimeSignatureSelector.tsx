import {useEditMode, useTimeSignature} from "../../../redux/selectors";
import {handleTimeSignatureChange} from "./actions";
import classNames from "classnames";

const options = [
  { value: "fourFour", label: "4/4" },
  { value: "threeFour", label: "3/4" },
];

export default function TimeSignatureSelector() {
  const timeSignature = useTimeSignature() ?? "fourFour";
  const isEditMode = useEditMode();

  return (
    <div className="flex gap-2 items-center">
      <div className="text font-semibold">Розмір такту:</div>
      <select
        disabled={!isEditMode}
        className={classNames("px-2.5 font-semibold text-lg rounded border border-dashed", {
          "border-gray-400": isEditMode,
          "border-transparent": !isEditMode
        })}
        value={timeSignature}
        onChange={(e) => handleTimeSignatureChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
