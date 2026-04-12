import {fetchAPI} from "#utils/fetch-api";

export const sPreferencesApi = {
  getPreferences: (songId) => fetchAPI(`/getPreferencesBySongId/${songId}`),
  createPreferences: (songId, preferences) => fetchAPI(`/createPreference/${songId}`, {}, {
    method: "POST",
    body: JSON.stringify(preferences),
  }),
  updatePreferences: (preferenceId, preferences) => fetchAPI(`/savePreference/${preferenceId}`, {}, {
    method: "PUT",
    body: JSON.stringify(preferences),
  })
}