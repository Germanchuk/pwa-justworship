import React, { useEffect } from "react";
import {
  KeyIcon,
  AtSymbolIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { registerUser } from "#layout/api";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setUser } from "#modules/AuthenticatedUser/userSlice";
import { addNotificationWithTimeout } from "#layout/slices/notificationsSlice";
import { Routes } from "#constants/routes";

export default function Registration() {
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    localStorage.removeItem("authToken");
  }, []);

  function submitHandler(e) {
    e.preventDefault();
    if (!username || !password || !email) {
      dispatch(
        // @ts-ignore
        addNotificationWithTimeout({
          message: "Введіть всі дані",
          type: "error",
        })
      );
      return;
    }
    if (!validateEmail(email)) {
      dispatch(
        // @ts-ignore
        addNotificationWithTimeout({
          message: "Введіть коректну пошту",
          type: "error",
        })
      );
      return;
    }
    if (password.length < 6) {
      dispatch(
        // @ts-ignore
        addNotificationWithTimeout({
          message: "Мінімальна довжина пароля 6 символів",
          type: "error",
        })
      );
      return;
    }
    registerUser({ username, password, email })
      .then((data) => {
        localStorage.setItem("authToken", data.jwt);
        dispatch(setUser(data.user));
        navigate(Routes.Root);
        //
        dispatch(
          // @ts-ignore
          addNotificationWithTimeout({
            message: "Реєстрація успішна",
            type: "success",
          })
        );
      })
      .catch((e) => {
        dispatch(
          // @ts-ignore
          addNotificationWithTimeout({
            message: "Щось не так.\nСхоже вже є користувач з такою поштою або нікнеймом.",
            type: "error",
          })
        );
      });
  }
  return (
    <div className="flex justify-center items-center gap-y-6 h-screen flex-col">
      <div>
        <h1 className="text-3xl font-bold">Just Worship</h1>
        <p className="text-center">реєстрація</p>
      </div>
      <form
        className="flex justify-center items-center gap-y-4 flex-col"
        onSubmit={submitHandler}
      >
        <label className="input input-bordered flex items-center gap-2">
          <EnvelopeIcon className="size-5 text-current" />
          <input
            className="grow"
            type="text"
            placeholder="мейл"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="input input-bordered flex items-center gap-2">
          <AtSymbolIcon className="size-5 text-current" />
          <input
            className="grow"
            type="text"
            placeholder="унікальний нікнейм"
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
          Зареєструватися
        </button>
      </form>
      <div className="flex flex-col items-center">
        <div className="text-center">Вже є аккаунт?</div>
        <Link to={Routes.Login}>
          <button className="btn btn-link">Увійти</button>
        </Link>
      </div>
    </div>
  );
}

function validateEmail(email) {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
}
