"use client";

import { useActionState } from "react";
import { activateAction, type ActivateState } from "./actions";

export function ActivateForm({ token, email, minLength }: { token: string; email: string; minLength: number }) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(activateAction.bind(null, token), {
    status: "idle",
  });

  if (state.status === "done") {
    return (
      <div role="status" className="rounded-lg border border-success/30 bg-success-soft p-4 text-sm">
        <p className="font-medium text-success">Votre compte est activé.</p>
        <p className="mt-1 text-success">
          Vous vous connecterez avec <strong>{state.email}</strong> et le mot de passe que vous venez de choisir.
        </p>
        <a
          href="/connexion"
          className="btn-primary mt-3"
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
        <input name="password" type="password" autoComplete="new-password" minLength={minLength} required className="input" />
        <span className="text-xs font-normal text-ink-muted">Au moins {minLength} caractères.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Confirmer le mot de passe
        <input name="confirmation" type="password" autoComplete="new-password" minLength={minLength} required className="input" />
      </label>

      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary"
      >
        {pending ? "Activation…" : "Activer mon compte"}
      </button>
    </form>
  );
}
