import { useMemo } from "react";
import { Navigate, Outlet, useMatch } from "react-router-dom";
import { useSelector } from "react-redux";

import { Routes } from "#constants/routes";
import { BandAudioBridge } from "./audio/BandAudioBridge";

export type Band = {
  id: number | string;
  name: string;
};

/**
 * Гурт поточного екрана: `:bandId` з URL, звірений зі списком гуртів юзера —
 * чужий (або ще не завантажений) гурт дає `null`.
 *
 * НАВІЩО НЕ КОНТЕКСТ: частина UI пісні (`SongControls` у нижній панелі)
 * рендериться не там, де оголошена, — вона їде в `PageFooterArea` через стан,
 * тобто фізично живе ВИЩЕ band-роутів і жодного контексту з `BandLayout` не
 * бачить. Виведення з URL працює однаково в обох місцях.
 */
export const useBandOrNull = (): Band | null => {
  const bandId = useUrlBandId();
  const bands = useSelector((state: any) => state.user?.bands);

  return useMemo(
    () =>
      bands?.find((item: Band) => String(item.id) === String(bandId)) ?? null,
    [bands, bandId]
  );
};

/**
 * Те саме, але для екранів під `BandLayout`, де гурт гарантовано є, — щоб не
 * тягнути `null`-перевірки крізь усю сторінку.
 */
export const useBand = (): Band => {
  const band = useBandOrNull();
  if (!band) {
    throw new Error("useBand доступний лише всередині band-роутів");
  }
  return band;
};

export const useBandId = () => useBand().id;

/**
 * Лише id з URL, без звірки зі списком гуртів — для навігаційних елементів
 * (сайдбар), яким треба знати «ми в гурті чи ні» ще до приїзду юзера.
 */
export const useUrlBandId = (): string | null => {
  const nested = useMatch(`${Routes.Band}/*`);
  const exact = useMatch(Routes.Band);
  const bandId = nested?.params?.bandId ?? exact?.params?.bandId;

  // `/bands/join` і `/bands/new` теж підпадають під `:bandId` — це не гурти.
  if (!bandId || bandId === "join" || bandId === "new") {
    return null;
  }
  return bandId;
};

/**
 * Гейт band-роутів: нижче рендериться лише те, що справді належить нашому
 * гурту. Сам гурт діти беруть через `useBand`.
 */
export default function BandLayout() {
  const bands = useSelector((state: any) => state.user?.bands);
  const band = useBandOrNull();

  // Юзер ще не приїхав з /users/me — рендерити нічого, інакше зайвий редірект.
  if (!bands) {
    return null;
  }

  // Гурт не наш (або вже не наш) — на головну, до списку своїх гуртів.
  if (!band) {
    return <Navigate to={Routes.Root} replace />;
  }

  return (
    <>
      <BandAudioBridge bandId={band.id} />
      <Outlet />
    </>
  );
}
