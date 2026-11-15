"use client";

import { useActionState } from "react";
import { userLoginAction, type UserLoginState } from "./actions";

export function UserLoginForm() {
  const [state, action, pending] = useActionState<UserLoginState, FormData>(userLoginAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        E-mail
        <input name="email" type="email" autoComplete="username" required defaultValue={state.email} className="input" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Mot de passe
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
