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
import { Button } from "@/components/ui/button";

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
        <h1 className="text-3xl font-extrabold font-['Unbounded']">Just Worship</h1>
        <p className="text-center">реєстрація</p>
      </div>
      <form
        className="flex justify-center items-center gap-y-4 flex-col"
        onSubmit={submitHandler}
      >
        <label className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs flex items-center gap-2">
          <EnvelopeIcon className="size-5 text-current" />
          <input
            className="grow"
            type="text"
            placeholder="мейл"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs flex items-center gap-2">
          <AtSymbolIcon className="size-5 text-current" />
          <input
            className="grow"
            type="text"
            placeholder="унікальний нікнейм"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs flex items-center gap-2">
          <KeyIcon className="size-5 text-current" />
          <input
            placeholder="пароль"
            type="password"
            className="grow"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <Button type="submit">
          Зареєструватися
        </Button>
      </form>
      <div className="flex flex-col items-center gap-2">
        <div className="text-center text-sm text-muted-foreground">Вже є аккаунт?</div>
        <Button asChild variant="link" className="underline hover:bg-accent hover:text-accent-foreground">
          <Link to={Routes.Login}>Увійти</Link>
        </Button>
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
