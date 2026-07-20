import {Modal} from "#components";
import { Button } from "@/components/ui/button";

const Trigger = (props) => {
  return (
    <Button variant="destructive" {...props}>
      Видалити список
    </Button>
  )
}

const Content = ({ onDelete }) => {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="destructive" onClick={onDelete}>Так</Button>
      <form method="dialog">
        <Button variant="outline">Ні</Button>
      </form>
    </div>
  )
}

export default function DeleteSchedule({ deleteSchedule }) {
  return (
    <div className="flex mt-6 justify-center">
      <Modal
        trigger={<Trigger />}
        title={"Дійсно видалити список?"}
        content={<Content onDelete={deleteSchedule} />}
      />
    </div>
  )
}