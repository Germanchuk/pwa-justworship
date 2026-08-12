import { fetchAPI } from "#utils/fetch-api";

export type BandMember = {
  id: number | string;
  username: string;
};

export const bandApi = {
  // `avoidGlobalLoader` — список тягнеться фоном при вході в режим приміток,
  // глобальний лоадер на всю сторінку тут був би зайвим миготінням.
  getMembers: (bandId: number | string): Promise<{ data: BandMember[] }> =>
    fetchAPI(`/bands/${bandId}/members`, {}, {}, true),

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
