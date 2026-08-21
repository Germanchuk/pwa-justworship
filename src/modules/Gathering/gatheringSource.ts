/**
 * ЗВІДКИ ЗІБРАННЯ БЕРЕ СЛУЖІННЯ — один запит, одна межа, два читачі.
 *
 * Читачів справді два, і саме тому це окремий модуль: екран зібрання показує
 * служіння, а хост звуку його ГРАЄ, і обидва мусять отримати той самий ряд
 * пунктів. Розійшлись би вони — музиканти бачили б не те, що звучить
 * (`LIST-35`, історія 35 у спеці), а це рівно та біда, заради якої
 * `buildGathering` зроблений чистим.
 *
 * Свіжість: вміст пісень тут — знімок останнього збереження collab-документа,
 * а не живий стан (`LIST-32`). Хост перечитує його на кожен запуск — так само,
 * як для окремої пісні (`PLAY-34`).
 */

import type { Descendant } from "slate";

import { fromApi } from "#models/listPoint";
import { fetchAPI } from "#utils/fetch-api";
import type { GatheringPoint } from "./buildGathering";

export interface GatheringList {
  date: string | null;
  title: string | null;
  points: GatheringPoint[];
}

/**
 * Відповідь ендпоінта → пункти зі своїм вмістом.
 *
 * `fromApi` дає чистий union, але вміст пісні (`slate`) живе поруч із пунктом —
 * зшиваємо по id пісні, а НЕ по індексу: межа відсіює пункти (пісня без пісні,
 * порожня примітка), тож порядки двох рядів не збігаються, і зсув на один тихо
 * підклав би не той документ.
 */
export const gatheringFromApi = (data: any): GatheringList => {
  const rawPoints: any[] = Array.isArray(data?.points) ? data.points : [];
  const slateBySongId = new Map<string, Descendant[] | null | undefined>(
    rawPoints
      .filter((raw) => raw?.__component === "list.song-point" && raw?.song?.id != null)
      .map((raw) => [String(raw.song.id), raw.slate]),
  );

  return {
    date: data?.date ?? null,
    title: data?.title ?? null,
    points: fromApi(rawPoints).map((point) =>
      point.kind === "song" ? { ...point, slate: slateBySongId.get(String(point.songId)) } : point,
    ) as GatheringPoint[],
  };
};

/** Усе служіння одним запитом — той самий для екрана й для хоста. */
export const fetchGathering = async (
  bandId: string | number,
  listId: string | number,
): Promise<GatheringList> => {
  const response = await fetchAPI(`/bands/${bandId}/lists/${listId}/gathering`);
  return gatheringFromApi(response?.data ?? null);
};
