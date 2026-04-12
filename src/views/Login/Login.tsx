import React, { useEffect } from "react";
import {
  KeyIcon,
  AtSymbolIcon,
} from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { loginUser } from "#layout/api";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setUser } from "#modules/AuthenticatedUser/userSlice";
import { addNotificationWithTimeout } from "#layout/slices/notificationsSlice";
import { Routes } from "#constants/routes";

export default function Login() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    localStorage.removeItem("authToken");
  }, []);

  function submitHandler(e) {
    e.preventDefault();
    if (!username || !password) {
      dispatch(
        // @ts-ignore
        addNotificationWithTimeout({
          message: "Введіть дані",
          type: "error",
        })
      );
      return;
    }
    loginUser({ username, password })
      .then((data) => {
        localStorage.setItem("authToken", data.jwt);
        dispatch(setUser(data.user));
        navigate(Routes.Root);
        dispatch(
          // @ts-ignore
          addNotificationWithTimeout({
            message: "Вхід успішний",
            type: "info",
          })
        );
      })
      .catch((e) => {
        dispatch(
          // @ts-ignore
          addNotificationWithTimeout({
            message: "Щось не так",
            type: "error",
          })
        );
      });
  }
  return (
    <div className="flex justify-center items-center gap-y-6 h-screen flex-col">
      <div>
        <h1 className="text-3xl font-bold">Just Worship</h1>
        <p className="text-center">вхід:</p>
      </div>
      <form
        className="flex justify-center items-center gap-y-4 flex-col"
        onSubmit={submitHandler}
      >
        <label className="input input-bordered flex items-center gap-2">
          <AtSymbolIcon className="size-5 text-current" />
          <input
            className="grow"
            type="text"
            placeholder="нікнейм"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="input input-bordered flex items-center gap-2">
          <KeyIcon className="size-5 text-current" />
          <input
            placeholder="пароль"
            type="password"
            className="grow"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit" className="btn">
          Увійти
        </button>
      </form>
      <div>
        <div className="text-center">Немає аккаунту?</div>
        <Link to={Routes.Register}>
          <button className="btn btn-link">Зареєструватися</button>
        </Link>
      </div>
    </div>
  );
}
