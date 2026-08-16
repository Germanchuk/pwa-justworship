import { TrashIcon } from "@heroicons/react/24/outline";
import { Modal } from "#components";
import { Button } from "@/components/ui/button";

/**
 * Видалення списку — тихим рядком під секціями, а не червоною пігулкою
 * посеред екрана: заходять сюди рідко, а червоне в застосунку лишаємо
 * власне підтвердженню, де воно й доречне.
 */
const Trigger = (props) => {
  return (
    <Button
      variant="ghost"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      {...props}
    >
      <TrashIcon className="size-4" />
      Видалити список
    </Button>
  );
};

const Content = ({ onDelete }) => {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="destructive" onClick={onDelete}>
        Так
      </Button>
      <form method="dialog">
        <Button variant="outline">Ні</Button>
      </form>
    </div>
  );
};

export default function DeleteSchedule({ deleteSchedule }) {
  return (
    <div className="mt-6 flex justify-center">
      <Modal
        trigger={<Trigger />}
        title={"Дійсно видалити список?"}
        content={<Content onDelete={deleteSchedule} />}
      />
    </div>
  );
}
