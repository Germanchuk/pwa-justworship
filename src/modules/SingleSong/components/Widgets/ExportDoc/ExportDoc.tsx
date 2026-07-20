import {createDocument} from "../../../services";
import {DocumentArrowDownIcon} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export const ExportDoc = () => {
  return (
    <Button
      size="sm"
      onClick={() => createDocument()}
    >
      <DocumentArrowDownIcon className="w-5"/>
      .docx
    </Button>
  )
}
