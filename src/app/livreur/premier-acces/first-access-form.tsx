"use client";

import { useActionState } from "react";
import { firstAccessAction, type FirstAccessState } from "./actions";

const digitInput = "input h-14 text-center font-mono text-2xl tracking-[0.4em] tabular-nums";

export function FirstAccessForm() {
  const [state, action, pending] = useActionState<FirstAccessState, FormData>(firstAccessAction, { status: "idle" });

  if (state.status === "done") {
    return (
      <div role="status" className="rounded-lg border border-success/30 bg-success-soft p-4 text-sm">
        <p className="font-medium text-success">Votre code PIN est enregistré.</p>
        <p className="mt-1 text-success">
          Vous vous connecterez avec votre numéro de téléphone et ce code PIN. Ne le donnez à personne, même à votre
          entreprise.
        </p>
        <a href="/livreur/connexion" className="btn-primary mt-3 h-12 w-full text-base">
          Se connecter
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="field-label">
        Votre numéro de téléphone
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="07 07 07 07 07"
          defaultValue={state.status === "error" ? state.phone : undefined}
          className="input h-12 text-lg"
        />
      </label>

      <label className="field-label">
        Code d&apos;accès donné par votre entreprise
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          placeholder="000 000"
          defaultValue={state.status === "error" ? state.code : undefined}
          className={digitInput}
        />
      </label>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-medium">Choisissez votre code PIN (6 chiffres)</legend>
        <p className="text-xs text-ink-muted">Vous le taperez à chaque connexion. Évitez 123456, 000000 ou votre date de naissance.</p>
        <label className="field-label">
          Code PIN
          <input name="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="\d{6}" maxLength={6} required className={digitInput} />
        </label>
        <label className="field-label">
          Confirmer le code PIN
          <input
            name="pinConfirmation"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{6}"
            maxLength={6}
            required
            className={digitInput}
          />
        </label>
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="alert-error">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary h-12 text-base">
        {pending ? "Enregistrement…" : "Enregistrer mon code PIN"}
      </button>
    </form>
  );
}
