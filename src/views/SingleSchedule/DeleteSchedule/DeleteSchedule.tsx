import {Modal} from "#components";

const Trigger = (props) => {
  return (
    <button className="btn btn-outline bg-delete-base text-delete-content ring-delete-content" {...props}>
      Видалити список
    </button>
  )
}

const Content = ({ onDelete }) => {
  return (
    <div className="flex justify-end gap-2">
      <button className={"btn bg-delete-base text-delete-content"} onClick={onDelete}>Так</button>
      <form method="dialog">
        <button className={"btn"}>Ні</button>
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