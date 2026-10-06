import { matchPath } from "react-router-dom";
import { Routes, bandPath } from "#constants/routes";

/**
 * Місце екрана в шляху нижнього бару (`APP-30`, `APP-31`). Шлях має не
 * більше трьох рівнів — `🏠 · Гурт · Екран`, — тож пункти не складаються
 * списком, а займають три фіксовані місця, і кожне або відкрите, або ні.
 * На головній шляху немає зовсім — там бар показує пошук і профіль; на
 * пісні й у зібранні — лише «назад» (`back`).
 */
export type BarSpot = {
  /** Гурт у шляху — `:bandId` з адреси; поза гуртом `null`. */
  bandId: string | null;
  /** Підпис екрана після гурту (або після 🏠, якщо екран поза гуртом). */
  screen: string | null;
  /**
   * Поточний пункт шляху; `home` — головна, де шляху немає; `back` — пісня
   * чи зібрання, де замість шляху саме «назад».
   */
  active: "home" | "band" | "screen" | "back";
  /**
   * Куди «назад», коли повертатись історією нікуди (`APP-25`, `APP-38`):
   * у список, якщо пісню відкрили з нього (`APP-37`), інакше в пісні гурту.
   */
  back: string | null;
  /** Пісня: поруч із «назад» — кнопка меню пісні (`APP-26`). У зібранні меню немає. */
  songMenu: boolean;
};

/**
 * Сценічні екрани — пісня й зібрання. Бар на них — «назад» (а на пісні ще
 * кнопка меню), друга колонка — куди «назад» веде, коли історії немає.
 * `songs/new` теж підпадає під шаблон пісні, тож його відсіюємо окремо.
 */
const STAGE_SCREENS: [string, (p: Record<string, string>) => string][] = [
  [Routes.Gathering, (p) => bandPath.list(p.bandId, p.listId)],
  [Routes.ListSong, (p) => bandPath.list(p.bandId, p.listId)],
  [`${Routes.ListSong}/:mode`, (p) => bandPath.list(p.bandId, p.listId)],
  [Routes.SingleSong, (p) => bandPath.songs(p.bandId)],
  [Routes.SingleSongMode, (p) => bandPath.songs(p.bandId)],
];

function stageScreen(pathname: string): { back: string; songMenu: boolean } | null {
  for (const [pattern, fallback] of STAGE_SCREENS) {
    const match = matchPath(pattern, pathname);
    if (match && match.params.songId !== "new") {
      return {
        back: fallback(match.params as Record<string, string>),
        songMenu: pattern !== Routes.Gathering,
      };
    }
  }
  return null;
}

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
 * Пісня й зібрання тут не описані: це сценічні екрани (`STAGE_SCREENS`).
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
  if (outside) {
    return { bandId: null, screen: outside, active: "screen", back: null, songMenu: false };
  }

  const stage = stageScreen(pathname);
  if (stage) return { bandId: null, screen: null, active: "back", ...stage };

  const band = matchPath(`${Routes.Band}/*`, pathname);
  if (band?.params.bandId) {
    const screen = find(BAND_SCREENS, `/${band.params["*"] ?? ""}`);
    return {
      bandId: band.params.bandId,
      screen,
      active: screen ? "screen" : "band",
      back: null,
      songMenu: false,
    };
  }

  return { bandId: null, screen: null, active: "home", back: null, songMenu: false };
}
