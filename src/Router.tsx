import "./App.css";
import { Route, Routes as RouterRoutes, useLocation } from "react-router-dom";

import PublicLayout from "#layout/PublicLayout/PublicLayout";
import ProtectedRoute from "#layout/ProtectedRoute/ProtectedRoute";
import BandLayout from "#modules/Band/BandLayout";

import CreateSong from "#views/CreateSong/CreateSong";
import Login from "#views/Login/Login";
import Registration from "#views/Registration/Registration";
import SingleSong from "#views/SingleSong/SingleSong";
import FromScratch from "#views/FromScratch/FromScratch";
import Preferences from "#views/Preferences/Preferences";
import JoinChurch from "#views/JoinChurch/JoinChurch";
import { Routes } from "#constants/routes";
import CreateChurch from "#views/CreateChurch/CreateChurch";
import SingleChurch from "#views/SingleChurch/SingleChurch";
import JoinBand from "#views/JoinBand/JoinBand";
import CreateBand from "#views/CreateBand/CreateBand";
import BandSongs from "#views/BandSongs/BandSongs";
import BandsHome from "#views/BandsHome/BandsHome";
import BandHome from "#views/BandHome/BandHome";
import SingleShedule from "#views/SingleSchedule/SingleShedule";
import ShadcnDemo from "#views/ShadcnDemo/ShadcnDemo";
import Landing from "#views/Landing/Landing";

function Router() {
  const location = useLocation();

  return (
    <div className={"h-full flex flex-col"}>
      <RouterRoutes location={location}>
        <Route path="/" element={<ProtectedRoute />}>
          {/* Головний екран — усі гурти юзера. */}
          <Route index element={<BandsHome />} />
          <Route path={Routes.Preferences} element={<Preferences />} />
          <Route path={Routes.JoinBand} element={<JoinBand />} />
          <Route path={Routes.CreateBand} element={<CreateBand />} />
          <Route path={Routes.JoinChurch} element={<JoinChurch />} />
          <Route path={Routes.CreateChurch} element={<CreateChurch />} />
          <Route path={Routes.SingleChurch} element={<SingleChurch />} />

          {/* Усе band-scoped: `BandLayout` звіряє `:bandId` зі списком
              гуртів юзера й роздає гурт нижче через контекст. */}
          <Route path={Routes.Band} element={<BandLayout />}>
            <Route index element={<BandHome />} />
            <Route path="songs" element={<BandSongs />} />
            <Route path="songs/new" element={<CreateSong />} />
            <Route path="songs/new/from-scratch" element={<FromScratch />} />
            {/* `:mode?` — один і той самий елемент на всі три режими: інакше
                перемикання режиму розмонтувало б редактор і перепідключало
                Yjs-документ. Невідомий сегмент `SingleSong` сам зводить на
                канонічний шлях читання. */}
            <Route path="songs/:songId/:mode?" element={<SingleSong />} />
            <Route path="lists/new" element={<SingleShedule />} />
            <Route path="lists/:listId" element={<SingleShedule />} />
          </Route>
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
