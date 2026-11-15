"use client";

import { useActionState, useState } from "react";
import { ActivationLinkBox } from "@/components/activation-link-box";
import { inviteAction, type InviteState } from "./actions";
import { ROLE_OPTIONS } from "./roles";

/** Remonter le formulaire (nouvelle clé) le remet à zéro, état de l'action compris. */
export function InviteForm() {
  const [round, setRound] = useState(0);
  return <InviteFormInner key={round} startOpen={round > 0} onAgain={() => setRound((n) => n + 1)} />;
}

function InviteFormInner({ startOpen, onAgain }: { startOpen: boolean; onAgain: () => void }) {
  const [open, setOpen] = useState(startOpen);
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteAction, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          <strong>{state.name}</strong> est invité. Envoyez-lui ce lien : il y choisira son mot de passe.
        </p>
        <ActivationLinkBox url={state.url} expiresAt={state.expiresAt} recipientName={state.name} recipientPhone={state.phone} />
        <button
          type="button"
          className="btn-secondary self-start"
          onClick={onAgain}
        >
          Inviter une autre personne
        </button>
      </div>
    );
  }

  if (!open && state.status === "idle") {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Inviter un utilisateur
      </button>
    );
  }

  const fields = state.status === "error" ? state.fields : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} className="card flex flex-col gap-4 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Inviter un utilisateur</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Nom complet
          <input name="name" required defaultValue={values?.name} aria-invalid={!!fields.name} className="input" />
          {fields.name && <span className="field-error">{fields.name}</span>}
        </label>
        <label className="field-label">
          E-mail (identifiant)
          <input name="email" type="email" required defaultValue={values?.email} aria-invalid={!!fields.email} className="input" />
          {fields.email && <span className="field-error">{fields.email}</span>}
        </label>
        <label className="field-label">
          Téléphone WhatsApp (facultatif)
          <input name="phone" type="tel" placeholder="+225 07 00 00 00 00" defaultValue={values?.phone} aria-invalid={!!fields.phone} className="input" />
          {fields.phone && <span className="field-error">{fields.phone}</span>}
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Rôles (un ou plusieurs)</legend>
        <div className="mt-2 flex flex-col gap-2">
          {ROLE_OPTIONS.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="roles"
                value={r.value}
                defaultChecked={values?.roles.includes(r.value)}
                className="mt-0.5 size-4 accent-brand-strong"
              />
              <span>
                <span className="font-medium">{r.label}</span>
                <span className="block text-ink-muted">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
        {fields.roles && <p className="field-error mt-2">{fields.roles}</p>}
      </fieldset>

      {state.status === "error" && state.message && <p role="alert" className="alert-error">{state.message}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Invitation…" : "Inviter et générer le lien"}
        </button>
        <button type="button" className="btn-secondary h-11" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}
