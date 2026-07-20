import "./App.css";
import { Route, Routes as RouterRoutes, useLocation } from "react-router-dom";
import {useSelector} from "react-redux";
import classNames from "classnames";

import PublicLayout from "#layout/PublicLayout/PublicLayout";
import ProtectedRoute from "#layout/ProtectedRoute/ProtectedRoute";

import CreateSong from "#views/CreateSong/CreateSong";
import SongsList from "#views/SongsList/SongsList";
import Login from "#views/Login/Login";
import Registration from "#views/Registration/Registration";
import TextToSong from "#views/TextToSong/TextToSong";
import SingleSong from "#views/SingleSong/SingleSong";
import FromScratch from "#views/FromScratch/FromScratch";
import Preferences from "#views/Preferences/Preferences";
import JoinChurch from "#views/JoinChurch/JoinChurch";
import { Routes } from "#constants/routes";
import CreateChurch from "#views/CreateChurch/CreateChurch";
import SingleChurch from "#views/SingleChurch/SingleChurch";
import JoinBand from "#views/JoinBand/JoinBand";
import SingleBand from "#views/SingleBand/SingleBand";
import CreateBand from "#views/CreateBand/CreateBand";
import ChurchSongs from "#views/ChurchSongs/ChurchSongs";
import ChurchShedule from "#views/ChurchShedule/ChurchShedule";
import BandSongs from "#views/BandSongs/BandSongs";
import BandShedule from "#views/BandShedule/BandShedule";
import SingleShedule from "#views/SingleSchedule/SingleShedule";
import WelcomePage from "#views/WelcomePage/WelcomePage";
import ShadcnDemo from "#views/ShadcnDemo/ShadcnDemo";
import Landing from "#views/Landing/Landing";

function Router() {
  const location = useLocation();
  const user = useSelector((state: any) => state.user);

  const Root = user?.currentBand ? BandShedule : WelcomePage;

  return (
    <div className={"h-full flex flex-col"}>
      <RouterRoutes location={location}>
        <Route path="/" element={<ProtectedRoute />}>
          <Route path={Routes.Root} element={<Root />} />
          <Route path={Routes.PublicSongs} element={<SongsList />} />
          <Route path={Routes.SinglePublicSong} element={<SingleSong />} />
          <Route path={Routes.CreateSong} element={<CreateSong />} />
          <Route path={Routes.AddSongTextToSong} element={<TextToSong />} />
          <Route path={Routes.AddSongFromScratch} element={<FromScratch />} />
          <Route path={Routes.Preferences} element={<Preferences />} />
          <Route path={Routes.JoinChurch} element={<JoinChurch />} />
          <Route path={Routes.CreateChurch} element={<CreateChurch />} />
          <Route path={Routes.SingleChurch} element={<SingleChurch />} />
          <Route path={Routes.JoinBand} element={<JoinBand />} />
          <Route path={Routes.SingleBand} element={<SingleBand />} />
          <Route path={Routes.CreateBand} element={<CreateBand />} />
          <Route path={Routes.ChurchSongs} element={<ChurchSongs />} />
          <Route path={Routes.ChurchShedule} element={<ChurchShedule />} />
          <Route path={Routes.BandSongs} element={<BandSongs />} />
          <Route path={Routes.BandShedule} element={<BandShedule />} />
          <Route path={Routes.SingleBandShedule} element={<SingleShedule />} />
        </Route>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Registration />} />
        </Route>
        <Route path="/shadcn-demo" element={<ShadcnDemo />} />
        <Route path="/landing" element={<Landing />} />
      </RouterRoutes>
    </div>
  );
}

export default Router;
