import React, { useEffect, useState } from "react";
import { fetchAPI } from "#utils/fetch-api";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "#modules/AuthenticatedUser/userSlice";
import {ErrorBoundary} from "react-error-boundary";
import { ErrorBoundaryFallback } from "#components";
import { useLocation } from "react-router-dom";
import BottomBar from "../BottomBar/BottomBar";
import NavigationWrapper from "../Navigation/NavigationWrapper";
import HardReloadButton from "../HardReloadButton/HardReloadButton";
import {Container} from "#components";

export default function AuthenticatedLayout({ children }) {
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.user);
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    fetchAPI("/users/me", {
      populate: ["bands", "currentBand", "church"],
    })
    .then((data) => {
      dispatch(setUser(data));
    });
  }, []);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <BottomBar onMenuClick={() => setNavOpen(true)} />
      <NavigationWrapper open={navOpen} onOpenChange={setNavOpen} />
      <ErrorBoundary FallbackComponent={ErrorBoundaryFallback} resetKeys={[location.pathname]}>
        <Container>
          {children}
        </Container>
      </ErrorBoundary>
      {/*<HardReloadButton />*/}
    </>
  );
}
