import React, { useEffect } from "react";
import { fetchAPI } from "#utils/fetch-api";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "#modules/AuthenticatedUser/userSlice";
import {ErrorBoundary} from "react-error-boundary";
import { ErrorBoundaryFallback } from "#components";
import { useLocation } from "react-router-dom";
import BottomBar from "../BottomBar/BottomBar";
import {PageHeaderArea} from "../PageHeaderArea/PageHeaderArea";
import NavigationWrapper from "../Navigation/NavigationWrapper";
import {Container} from "#components";

export default function AuthenticatedLayout({ children }) {
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.user);
  const location = useLocation();

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
      <PageHeaderArea />
      <NavigationWrapper />
      <div className={"middle"}>
          <ErrorBoundary FallbackComponent={ErrorBoundaryFallback} resetKeys={[location.pathname]}>
            <Container>
              {children}
            </Container>
          </ErrorBoundary>
      </div>
      <BottomBar />
    </>
  );
}
