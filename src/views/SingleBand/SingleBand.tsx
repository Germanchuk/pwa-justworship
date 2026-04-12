import { CogIcon } from "@heroicons/react/24/outline";

export default function SingleBand() {
  return (
    <div>
      <div className="flex justify-between gap-2">
        <h1 className="text-2xl font-bold mb-2">Гурт "Назва"</h1>
        <button className="btn btn-sm btn-square"><CogIcon /></button>
      </div>
      <p>
        списки пісень, налаштування -{">"}{" "}
        адміністратори, ...
      </p>
    </div>
  );
}
