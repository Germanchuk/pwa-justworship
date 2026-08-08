import {fetchAPI} from "#utils/fetch-api";

type Id = string | number;

// Пісня завжди належить гурту, тому кожен виклик починається з `bandId` —
// його дає `useBand()` з URL, а не якийсь прихований "поточний гурт".
export const songApi = {
  createSong: (bandId: Id, song) => fetchAPI(
    `/bands/${bandId}/songs`,
    {},
    {
      method: "POST",
      body: JSON.stringify({
        data: song,
      }),
    }
  ),
  updateSong: (bandId: Id, songId: Id, song) => fetchAPI(`/bands/${bandId}/songs/${songId}`, {}, {
    method: "PUT",
    body: JSON.stringify({data: song}),
  }, true),
  deleteSong: (bandId: Id, songId: Id) => fetchAPI(`/bands/${bandId}/songs/${songId}`, {}, {
    method: "DELETE",
  }),
  // `bandId` — куди кладемо копію, `songId` — що копіюємо.
  copySong: (bandId: Id, songId: Id) => fetchAPI(`/bands/${bandId}/songs/${songId}/copy`, {}, { method: "POST" }),
  getSong: (bandId: Id, songId: Id) => fetchAPI(`/bands/${bandId}/songs/${songId}`, {}, {}, true),
}
