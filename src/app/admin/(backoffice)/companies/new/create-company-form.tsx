"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActivationLinkBox } from "../activation-link-box";
import { createCompanyAction, type CreateCompanyState } from "../actions";

const input =
  "h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base font-normal outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100";

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

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Facturation par défaut : activée, 10 F CFA par livraison. Modifiable plus tard.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-zinc-900 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 sm:self-start sm:px-6 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
      <input name={name} type={type} aria-invalid={!!error} className={input} {...rest} />
      {error && <span className="text-sm font-normal text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}
