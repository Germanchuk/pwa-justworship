import { CogIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export default function SingleBand() {
  return (
    <div>
      <div className="flex justify-between gap-2">
        <h1 className="text-2xl font-bold mb-2">Гурт "Назва"</h1>
        <Button size="sm" variant="outline" className="size-8 p-0"><CogIcon className="size-4" /></Button>
      </div>
      <p>
        списки пісень, налаштування -{">"}{" "}
        адміністратори, ...
      </p>
    </div>
  );
}
