export enum Routes {
  Root = "/",
  Login = "/login",
  Register = "/register",
  Preferences = "/preferences",
  //
  PublicSongs = "/publicSongs",
  SinglePublicSong = "/publicSongs/:songId",
  EditPublicSong = "/publicSongs/edit/:songId",
  //
  ChurchSongs = "/churchSongs",
  SingleChurchSong = "/churchSongs/:songId",
  //
  BandSongs = "/bandSongs",
  SingleBandSong = "/bandSongs/:songId",
  //
  CreateSong = "/songs/create",
  AddSongTextToSong = "/songs/create/textToSong",
  AddSongFromScratch = "/songs/create/fromScratch",
  //
  ChurchShedule = "/churchShedule",
  BandShedule = "/bandShedule",
  CreateBandShedule = "/bandShedule/create", // for Link to be reliable
  SingleBandShedule = "/bandShedule/:scheduleId",
  //
  JoinChurch = "/churches",
  CreateChurch = "/churches/add",
  SingleChurch = "/churches/:churchId",
  //
  JoinBand = "/bands",
  CreateBand = "/bands/add",
  SingleBand = "/bands/:bandId",
  //
}
