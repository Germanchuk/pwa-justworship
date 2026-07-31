import {fetchAPI} from "#utils/fetch-api";

export const songApi = {
  createSong: (song) => fetchAPI(
    "/currentBandSongs",
    {},
    {
      method: "POST",
      body: JSON.stringify({
        data: song,
      }),
    }
  ),
  updateSong: (songId, song) => fetchAPI(`/currentBandSongs/${songId}`, {}, {
    method: "PUT",
    body: JSON.stringify({data: song}),
  }, true),
  deleteSong: (songId, song) => fetchAPI(`/currentBandSongs/${songId}`, {}, {
    method: "DELETE",
    body: song, // do we need this body ?
  }),
  copySong: (songId) => fetchAPI(`/copySong/${songId}`, {}, { method: "POST" }),
  getSong: (songId) => fetchAPI(`/currentBandSongs/${songId}`, {}, {}, true),
}