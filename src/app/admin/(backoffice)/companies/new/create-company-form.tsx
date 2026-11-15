"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActivationLinkBox } from "@/components/activation-link-box";
import { createCompanyAction, type CreateCompanyState } from "../actions";

export function CreateCompanyForm() {
  const [state, action, pending] = useActionState<CreateCompanyState, FormData>(createCompanyAction, {
    status: "idle",
  });

  if (state.status === "created") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          L&apos;entreprise <strong>{state.companyName}</strong> est créée. Envoyez le lien ci-dessous à son admin : il y
          choisira son mot de passe.
        </p>
        <ActivationLinkBox
          url={state.link.url}
          expiresAt={state.link.expiresAt}
          recipientName={state.link.adminName}
          recipientPhone={state.link.adminPhone}
        />
        <div className="flex gap-4 text-sm">
          <Link href={`/admin/companies/${state.companyId}`} className="font-medium underline">
            Voir l&apos;entreprise
          </Link>
          <Link href="/admin" className="font-medium underline">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  const errors = state.status === "error" ? state.errors : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Entreprise</legend>
        <Field label="Nom de l'entreprise" name="companyName" error={errors.companyName} defaultValue={values?.companyName} required />
        <Field label="Téléphone (facultatif)" name="companyPhone" type="tel" error={errors.companyPhone} defaultValue={values?.companyPhone} placeholder="+225 07 00 00 00 00" />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Premier admin de l&apos;entreprise</legend>
        <Field label="Nom complet" name="adminName" error={errors.adminName} defaultValue={values?.adminName} required />
        <Field label="E-mail (identifiant de connexion)" name="adminEmail" type="email" error={errors.adminEmail} defaultValue={values?.adminEmail} required />
        <Field label="Téléphone WhatsApp (facultatif)" name="adminPhone" type="tel" error={errors.adminPhone} defaultValue={values?.adminPhone} placeholder="+225 07 00 00 00 00" />
      </fieldset>

      <p className="text-sm text-ink-muted">
        Facturation par défaut : activée, 10 F CFA par livraison. Modifiable plus tard.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="btn-primary sm:self-start sm:px-6"
      >
        {pending ? "Création…" : "Créer l'entreprise et générer le lien"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  type = "text",
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input name={name} type={type} aria-invalid={!!error} className="input" {...rest} />
      {error && <span className="text-sm font-normal text-danger">{error}</span>}
    </label>
  );
}
