import { matchPath } from "react-router-dom";
import { Routes } from "#constants/routes";

/**
 * Місце екрана в шляху нижнього бару (`APP-30`, `APP-31`). Шлях має не
 * більше трьох рівнів — `🏠 · Гурт · Екран`, — тож пункти не складаються
 * списком, а займають три фіксовані місця, і кожне або відкрите, або ні.
 * На головній шляху немає зовсім — там бар показує пошук і профіль.
 */
export type BarSpot = {
  /** Гурт у шляху — `:bandId` з адреси; поза гуртом `null`. */
  bandId: string | null;
  /** Підпис екрана після гурту (або після 🏠, якщо екран поза гуртом). */
  screen: string | null;
  /** Поточний пункт шляху; `home` — головна, де шляху немає. */
  active: "home" | "band" | "screen";
};

/** Екрани поза гуртом, що стоять у шляху одразу після 🏠. */
const OUTSIDE_SCREENS: [string, string][] = [
  [Routes.SearchSongs, "Пошук"],
  [Routes.Preferences, "Налаштування"],
  [Routes.CreateBand, "Новий гурт"],
  [Routes.JoinBand, "Приєднатись"],
  [Routes.JoinChurch, "Церква"],
  [Routes.CreateChurch, "Церква"],
  [Routes.SingleChurch, "Церква"],
];

/**
 * Екрани гурту — шляхи всередині `/bands/:bandId`. Порядок важливий:
 * статичний `lists/new` має спрацювати раніше за `lists/:listId`. Підпис
 * списку — запасний: справжній (дату) ставить сама сторінка (`ToPageBar`).
 * Пісня й зібрання тут не описані: на них бару немає.
 */
const BAND_SCREENS: [string, string][] = [
  ["/members", "Склад"],
  ["/audio-host", "Хост звуку"],
  ["/songs", "Пісні"],
  ["/songs/new", "Нова пісня"],
  ["/songs/new/from-scratch", "Нова пісня"],
  ["/lists", "Списки"],
  ["/lists/new", "Новий список"],
  ["/lists/:listId", "Список"],
  ["/lists/:listId/edit", "Список"],
];

const find = (screens: [string, string][], pathname: string) =>
  screens.find(([pattern]) => matchPath(pattern, pathname))?.[1] ?? null;

export function barSpot(pathname: string): BarSpot {
  // Раніше за гурт: `/bands/new` і `/bands/join` підпадають і під `:bandId`.
  const outside = find(OUTSIDE_SCREENS, pathname);
  if (outside) return { bandId: null, screen: outside, active: "screen" };

  const band = matchPath(`${Routes.Band}/*`, pathname);
  if (band?.params.bandId) {
    const screen = find(BAND_SCREENS, `/${band.params["*"] ?? ""}`);
    return { bandId: band.params.bandId, screen, active: screen ? "screen" : "band" };
  }

  return { bandId: null, screen: null, active: "home" };
}
