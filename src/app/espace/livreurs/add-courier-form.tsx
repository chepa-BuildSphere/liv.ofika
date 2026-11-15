"use client";

import { useActionState, useState } from "react";
import { addCourierAction, type AddCourierState } from "./actions";

/** Remonter le formulaire (nouvelle clé) le remet à zéro, état de l'action compris. */
export function AddCourierForm() {
  const [round, setRound] = useState(0);
  return <Inner key={round} startOpen={round > 0} onAgain={() => setRound((n) => n + 1)} />;
}

function Inner({ startOpen, onAgain }: { startOpen: boolean; onAgain: () => void }) {
  const [open, setOpen] = useState(startOpen);
  const [state, action, pending] = useActionState<AddCourierState, FormData>(addCourierAction, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          {state.message}
        </p>
        <button type="button" className="btn-secondary self-start" onClick={onAgain}>
          Ajouter un autre livreur
        </button>
      </div>
    );
  }

  if (!open && state.status === "idle") {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Ajouter un livreur
      </button>
    );
  }

  const fields = state.status === "error" ? state.fields : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} className="card flex flex-col gap-4 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Ajouter un livreur</h2>
      <p className="text-sm text-ink-muted">
        Si ce numéro a déjà un compte livreur Ofika (il travaille pour une autre entreprise), il sera simplement rattaché à
        la vôtre : un livreur garde un seul compte.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Nom du livreur
          <input name="name" required defaultValue={values?.name} aria-invalid={!!fields.name} className="input" />
          {fields.name && <span className="field-error">{fields.name}</span>}
        </label>
        <label className="field-label">
          Téléphone (identifiant de connexion)
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            placeholder="07 07 07 07 07"
            defaultValue={values?.phone}
            aria-invalid={!!fields.phone}
            className="input"
          />
          {fields.phone && <span className="field-error">{fields.phone}</span>}
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Type de collaboration</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {[
            { value: "EMPLOYEE", label: "Employé" },
            { value: "INDEPENDENT", label: "Indépendant" },
          ].map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="employmentType"
                value={o.value}
                required
                defaultChecked={(values?.employmentType ?? "EMPLOYEE") === o.value}
                className="size-4 accent-brand-strong"
              />
              {o.label}
            </label>
          ))}
        </div>
        {fields.employmentType && <p className="field-error mt-2">{fields.employmentType}</p>}
      </fieldset>

      {state.status === "error" && state.message && (
        <p role="alert" className="alert-error">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Ajout…" : "Ajouter le livreur"}
        </button>
        <button type="button" className="btn-secondary h-11" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}
