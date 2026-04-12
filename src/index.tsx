import ReactDOM from "react-dom/client";

import "./index.css";
import "./views/TextToSong/HighlightedOutput/Block/block.css";
import "./components/MagicInput/MagicInput.css";

import "react-datepicker/dist/react-datepicker.css";

import Router from "./Router";
import {BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./store";
import NotificationsCenter from "#layout/NotificationsCenter/NotificationsCenter";
import {PageHeaderProvider} from "#layout/PageHeaderArea/PageHeaderAreaProvider";
import {PageFooterProvider} from "#layout/PageFooterArea/PageFooterAreaProvider";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
    <Provider store={store}>
      <BrowserRouter>
        <PageHeaderProvider>
          <PageFooterProvider>
            <Router />
            <NotificationsCenter />
          </PageFooterProvider>
        </PageHeaderProvider>
      </BrowserRouter>
    </Provider>
);
