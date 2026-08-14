import React, { useEffect, useState } from "react";
import { fetchAPI } from "#utils/fetch-api";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "#modules/AuthenticatedUser/userSlice";
import {ErrorBoundary} from "react-error-boundary";
import { ErrorBoundaryFallback } from "#components";
import { useLocation } from "react-router-dom";
import BottomBar from "../BottomBar/BottomBar";
import HardReloadButton from "../HardReloadButton/HardReloadButton";
import {Container} from "#components";

/** Стан шапки переживає перезавантаження: хто грає з телефона, ховає її раз. */
const HEADER_STORAGE_KEY = "headerVisible";

function readHeaderVisible() {
  try {
    return localStorage.getItem(HEADER_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export default function AuthenticatedLayout({ children }) {
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.user);
  const location = useLocation();
  const [headerVisible, setHeaderVisible] = useState(readHeaderVisible);

  useEffect(() => {
    try {
      localStorage.setItem(HEADER_STORAGE_KEY, String(headerVisible));
    } catch {
      // приватний режим / заборонене сховище — стан просто не переживе сесію
    }
  }, [headerVisible]);

  useEffect(() => {
    fetchAPI("/users/me", {
      populate: ["bands"],
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
      <BottomBar
        visible={headerVisible}
        onToggle={() => setHeaderVisible((visible) => !visible)}
      />
      <ErrorBoundary FallbackComponent={ErrorBoundaryFallback} resetKeys={[location.pathname]}>
        <Container>
          {children}
        </Container>
      </ErrorBoundary>
      {/*<HardReloadButton />*/}
    </>
  );
}
