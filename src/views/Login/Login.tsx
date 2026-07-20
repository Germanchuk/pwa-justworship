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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
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
    setIsLoading(true);
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
      })
      .finally(() => {
        setIsLoading(false);
      });
  }
  return (
    <div className="flex justify-center items-center gap-y-6 h-screen flex-col">
      <div>
        <h1 className="text-3xl font-extrabold font-['Unbounded']">Just Worship</h1>
        <p className="text-center">вхід:</p>
      </div>
      <form
        className="flex justify-center items-center gap-y-4 flex-col"
        onSubmit={submitHandler}
      >
        <label className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs flex items-center gap-2">
          <AtSymbolIcon className="size-5 text-current" />
          <input
            className="grow"
            type="text"
            placeholder="нікнейм"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
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
            disabled={isLoading}
          />
        </label>

        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="size-4 animate-spin" />}
          Увійти
        </Button>
      </form>
      <div className="flex flex-col items-center gap-2">
        <div className="text-center text-sm text-muted-foreground">Немає аккаунту?</div>
        <Button asChild variant="link" className="underline hover:bg-accent hover:text-accent-foreground">
          <Link to={Routes.Register}>Зареєструватися</Link>
        </Button>
      </div>
    </div>
  );
}
