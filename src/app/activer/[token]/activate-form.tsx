"use client";

import { useActionState } from "react";
import { activateAction, type ActivateState } from "./actions";

const input =
  "h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base font-normal outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100";

export function ActivateForm({ token, email, minLength }: { token: string; email: string; minLength: number }) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(activateAction.bind(null, token), {
    status: "idle",
  });

  if (state.status === "done") {
    return (
      <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950">
        <p className="font-medium text-emerald-900 dark:text-emerald-200">Votre compte est activé.</p>
        <p className="mt-1 text-emerald-800 dark:text-emerald-300">
          Vous vous connecterez avec <strong>{state.email}</strong> et le mot de passe que vous venez de choisir.
        </p>
        <a
          href="/connexion"
          className="mt-3 inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Se connecter
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Aide les gestionnaires de mots de passe à associer l'identifiant */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Mot de passe
        <input name="password" type="password" autoComplete="new-password" minLength={minLength} required className={input} />
        <span className="text-xs font-normal text-zinc-500">Au moins {minLength} caractères.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Confirmer le mot de passe
        <input name="confirmation" type="password" autoComplete="new-password" minLength={minLength} required className={input} />
      </label>

      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-zinc-900 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Activation…" : "Activer mon compte"}
      </button>
    </form>
  );
}
