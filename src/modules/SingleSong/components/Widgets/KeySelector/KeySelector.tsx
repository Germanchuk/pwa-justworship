import React, { useState } from "react";
import { keys } from "#utils/keyUtils";
import classNames from "classnames";
import {Modal} from "#components";
import {useEditMode, useKey} from "../../../redux/selectors";
import { handleChangeKey, handleTransposeSong } from "./actions";

export default function KeySelector() {
  const basicKey = useKey();
  const isEditMode = useEditMode();
  const [keyCandidate, setKeyCandidate] = useState("");
  const changeKey = () => handleChangeKey(keyCandidate);
  const transposeSong = () => handleTransposeSong(keyCandidate);
  const revert = () => setKeyCandidate(basicKey);
  return (
    <div className="flex gap-2 items-center">
      <div className="text font-semibold">Тональність:</div>
      <KeyPicker
        value={basicKey}
        setValue={setKeyCandidate}
        disabled={!isEditMode}
      />
      {keyCandidate && keyCandidate !== basicKey && (
        <Modal
          title={basicKey.replace("sharp", "#") + " → " + keyCandidate.replace("sharp", "#")}
          content={<div>
            <p className="mb-4">Тональність пісні вказується вручну і може відрізнятись від тональності акордів. Тому є вартіанти:</p>
            <div className="flex flex-col items-center gap-2">
              <button className="btn btn-outline" onClick={changeKey}>Виправити тональність</button>
              <button className="btn btn-outline" onClick={transposeSong}>Перетонувати всю пісню</button>
              <button className="btn" onClick={revert}>Відмінити</button>
          </div>
        </div>}
          hideCloseButton
        />
      )}
    </div>
  );
}

function KeyPicker({ value, setValue, disabled = false }) {
  return (
    <span>
      <select
        className={classNames("pl-2.5 font-semibold text-lg rounded border border-dashed", {
          "border-gray-400": !disabled,
          "border-transparent": disabled
        })}
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={disabled}
      >
        {keys.map((key) => (
          <option key={key} value={key}>
            {key.replace(/sharp/g, "#")}
          </option>
        ))}
      </select>
    </span>
  );
}

// function TranspositionPicker({ value, setValue }) {
//   return (
//     <select
//       className="px-4 border rounded block"
//       value={value}
//       onChange={(e) => setValue(e.target.value)}
//     >
//       {transpositions.map((trans) => (
//         <option key={trans} value={trans}>
//           {trans}
//         </option>
//       ))}
//     </select>
//   );
// }
