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
};
