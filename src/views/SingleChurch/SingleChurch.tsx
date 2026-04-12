import { CogIcon } from "@heroicons/react/24/outline";

export default function SingleChurch() {
  return (
    <div>
      <div className="flex justify-between gap-2">
        <h1 className="text-2xl font-bold mb-2">Церква "Назва"</h1>
        <button className="btn btn-sm btn-square"><CogIcon /></button>
      </div>
      <p>
        різна інфа для людей з доступом: списки пісень, налаштування -{">"}{" "}
        адміністратори,
      </p>
    </div>
  );
}
