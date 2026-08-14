import React from 'react'
import {ArrowLeftEndOnRectangleIcon, ArrowPathIcon} from "@heroicons/react/24/outline";
import {Link} from "react-router-dom";
import {Routes} from "#constants/routes";
import {Button} from "@/components/ui/button";
import {hardResetApp} from "./hardReset";

export default function Preferences() {
  const [resetting, setResetting] = React.useState(false);

  async function onHardReset() {
    setResetting(true);
    try {
      await hardResetApp();
    } catch (e) {
      // Не лишаємо кнопку залиплою, якщо щось не так із SW/caches API.
      console.error("Hard reset failed", e);
      setResetting(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Налаштування</h1>

      <section className="mt-4">
        <h2 className="text-base font-medium">Версія застосунку</h2>
        <p className="mt-1 text-sm opacity-70">
          Якщо застосунок працює як стара версія — скинь кеш. Це прибере
          збережену офлайн-копію й перезавантажить останню версію з сервера.
          З акаунта не вийде.
        </p>
        <Button
          variant="secondary"
          onClick={onHardReset}
          disabled={resetting}
          className="mt-3"
        >
          <ArrowPathIcon className={resetting ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
          {resetting ? "Скидаю…" : "Скинути кеш і перезавантажити"}
        </Button>
      </section>

      {/* Вихід жив у бічному меню; меню більше немає, тож він тут — єдиному
          екрані оболонки, який не належить конкретному гурту. */}
      <section className="mt-8">
        <h2 className="text-base font-medium">Акаунт</h2>
        <Link to={Routes.Login}>
          <Button className="mt-3">
            <ArrowLeftEndOnRectangleIcon className="h-5 w-5" />
            Вийти
          </Button>
        </Link>
      </section>
    </div>
  )
}
