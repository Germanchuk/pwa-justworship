import {createDocument} from "../../../services";
import {DocumentArrowDownIcon} from "@heroicons/react/24/outline";

export const ExportDoc = () => {
  return (
    <button
      className="btn btn-sm"
      onClick={() => createDocument()}
    >
      <DocumentArrowDownIcon className="w-5"/>
      .docx
    </button>
  )
}
