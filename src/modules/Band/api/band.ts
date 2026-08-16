import { fetchAPI } from "#utils/fetch-api";

/**
 * Роль у гурті. Лідер — той, хто гурт створив; гість — обмежений учасник
 * (поки що лише мітка, доступ у нього такий самий). Решта — учасники.
 */
export type BandRole = "leader" | "member" | "guest";

export const BAND_ROLE_LABEL: Record<BandRole, string> = {
  leader: "лідер",
  member: "учасник",
  guest: "гість",
};

export type BandMember = {
  id: number | string;
  username: string;
  role: BandRole;
};

export const bandApi = {
  // Створює гурт і робить автора його лідером.
  create: (
    name: string,
  ): Promise<{ data: { id: number; name: string; role: BandRole } }> =>
    fetchAPI(
      "/bands/new",
      {},
      {
        method: "POST",
        body: JSON.stringify({ data: { name } }),
      },
    ),

  // `avoidGlobalLoader` — список тягнеться фоном при вході в режим приміток,
  // глобальний лоадер на всю сторінку тут був би зайвим миготінням.
  getMembers: (bandId: number | string): Promise<{ data: BandMember[] }> =>
    fetchAPI(`/bands/${bandId}/members`, {}, {}, true),

  // Видалення гурту. На сервері це архівація: гурт зникає з застосунку, але
  // пісні й списки лишаються цілими. Доступно лише лідеру.
  archive: (
    bandId: number | string,
  ): Promise<{ data: { id: number; deletedAt: string } }> =>
    fetchAPI(`/bands/${bandId}/archive`, {}, { method: "PUT" }),

  // Призначити (userId) або зняти (null) хоста звуку гурту.
  // `headers` тут НЕ передаємо: fetchAPI розгортає options поверх дефолтів і
  // власний headers затер би Authorization разом із Content-Type.
  setAudioHost: (
    bandId: number | string,
    userId: number | string | null,
  ): Promise<{ data: { id: number; audioHostUserId: number | null } }> =>
    fetchAPI(
      `/bands/${bandId}/audioHost`,
      {},
      {
        method: "PUT",
        body: JSON.stringify({ data: { userId } }),
      },
      true,
    ),
};
