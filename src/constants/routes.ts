import type { SongMode } from "#modules/SingleSong/mode";

export enum Routes {
  Root = "/",
  Login = "/login",
  Register = "/register",
  Preferences = "/preferences",
  // Пошук пісні по всіх гуртах юзера — поки що лише екран з полем вводу.
  SearchSongs = "/search",
  //
  // Гурти: статичні сегменти йдуть перед `:bandId`, react-router ранжує їх вище.
  JoinBand = "/bands/join",
  CreateBand = "/bands/new",
  //
  // Усе, що належить гурту, живе під ним. Гурт у шляху — єдине джерело
  // правди про контекст: жодного "поточного гурту" в юзері більше немає.
  Band = "/bands/:bandId",
  BandMembers = "/bands/:bandId/members",
  AudioHost = "/bands/:bandId/audio-host",
  BandSongs = "/bands/:bandId/songs",
  CreateSong = "/bands/:bandId/songs/new",
  AddSongFromScratch = "/bands/:bandId/songs/new/from-scratch",
  // Режим роботи з піснею — останній сегмент шляху, а не стан у сторі:
  // порожній = читання, `edit` і `notes` — решта (див. `SingleSong/mode.tsx`).
  SingleSong = "/bands/:bandId/songs/:songId",
  SingleSongMode = "/bands/:bandId/songs/:songId/:mode",
  BandLists = "/bands/:bandId/lists",
  CreateList = "/bands/:bandId/lists/new",
  // Як і в пісні: порожній останній сегмент = читання, `edit` = правка.
  // Читання лишається основною адресою списку — саме її дають музикантам.
  SingleList = "/bands/:bandId/lists/:listId",
  EditList = "/bands/:bandId/lists/:listId/edit",
  //
  // Церква поки без входів з UI — лишається під майбутні фічі.
  JoinChurch = "/churches",
  CreateChurch = "/churches/add",
  SingleChurch = "/churches/:churchId",
}

type Id = string | number;

/** Побудова band-scoped шляхів. Рядки руками не склеюємо. */
export const bandPath = {
  home: (bandId: Id) => `/bands/${bandId}`,
  members: (bandId: Id) => `/bands/${bandId}/members`,
  audioHost: (bandId: Id) => `/bands/${bandId}/audio-host`,
  songs: (bandId: Id) => `/bands/${bandId}/songs`,
  // Читання лишає шлях пісні коротким: посилання на пісню не змінилось.
  song: (bandId: Id, songId: Id, mode: SongMode = "read") =>
    mode === "read"
      ? `/bands/${bandId}/songs/${songId}`
      : `/bands/${bandId}/songs/${songId}/${mode}`,
  createSong: (bandId: Id) => `/bands/${bandId}/songs/new`,
  songFromScratch: (bandId: Id) => `/bands/${bandId}/songs/new/from-scratch`,
  lists: (bandId: Id) => `/bands/${bandId}/lists`,
  createList: (bandId: Id) => `/bands/${bandId}/lists/new`,
  list: (bandId: Id, listId: Id) => `/bands/${bandId}/lists/${listId}`,
  editList: (bandId: Id, listId: Id) => `/bands/${bandId}/lists/${listId}/edit`,
};
