import ReactDOM from "react-dom/client";

import "./index.css";
import "./components/MagicInput/MagicInput.css";

import "react-datepicker/dist/react-datepicker.css";

import Router from "./Router";
import {BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./store";
import NotificationsCenter from "#layout/NotificationsCenter/NotificationsCenter";
import {PageBarProvider} from "#layout/PageBar/PageBarProvider";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
    <Provider store={store}>
      <BrowserRouter>
        <PageBarProvider>
          <Router />
          <NotificationsCenter />
        </PageBarProvider>
      </BrowserRouter>
    </Provider>
);
