import { useEffect, useState } from "react";

import { bandApi, type BandMember } from "../../../api";
import { useBandOrNull } from "#modules/Band/BandLayout";

/**
 * Склад поточного гурту. Тягнеться лише коли потрібен (споживачі —
 * `NotesAudienceSelect` і «Хто бачить» у `CommentsFab`, обидва живуть тільки
 * в режимі приміток) і кешується на
 * рівні модуля по id гурту: перемикання режимів туди-сюди не має смикати
 * мережу, а склад гурту між сесіями майже не змінюється.
 */
const cache = new Map<string, BandMember[]>();

export const useBandMembers = (): BandMember[] => {
  const band = useBandOrNull();
  const key = band == null ? null : String(band.id);
  const [members, setMembers] = useState<BandMember[]>(() =>
    key ? cache.get(key) ?? [] : [],
  );

  useEffect(() => {
    if (!key) return;

    const cached = cache.get(key);
    if (cached) {
      setMembers(cached);
      return;
    }

    let cancelled = false;
    bandApi
      .getMembers(key)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        cache.set(key, list);
        if (!cancelled) setMembers(list);
      })
      .catch(() => {
        // Немає списку — дропдаун просто не показується, примітки лишаються
        // своїми. Падати через це не варто.
        if (!cancelled) setMembers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return members;
};
