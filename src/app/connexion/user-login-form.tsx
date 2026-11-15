"use client";

import { useActionState } from "react";
import { userLoginAction, type UserLoginState } from "./actions";

const input =
  "h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base font-normal outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100";

export function UserLoginForm() {
  const [state, action, pending] = useActionState<UserLoginState, FormData>(userLoginAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        E-mail
        <input name="email" type="email" autoComplete="username" required defaultValue={state.email} className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Mot de passe
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-zinc-900 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
