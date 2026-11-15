import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/db";
import { findActivation, MIN_PASSWORD_LENGTH } from "@/lib/auth/activation";
import { ActivateForm } from "./activate-form";

export const metadata: Metadata = {
  title: "Activer mon compte — Ofika Delivery",
  // Le jeton est dans l'URL : ne pas l'envoyer à d'autres sites ni l'indexer
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

const PROBLEM_TEXT = {
  INVALID: "Ce lien n'est pas valide. Il a peut-être été remplacé par un lien plus récent.",
  EXPIRED: "Ce lien a expiré (il est valable 48 h).",
  USED: "Ce lien a déjà été utilisé : votre compte est activé.",
  ALREADY_ACTIVE: "Votre compte est déjà activé.",
} as const;

export default function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="text-sm font-medium text-zinc-500">Ofika Delivery</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Activer mon compte</h1>
        <Suspense fallback={<p className="mt-6 text-sm text-zinc-500">Vérification du lien…</p>}>
          <Activation params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Activation({ params }: { params: Promise<{ token: string }> }) {
  await connection(); // validité du lien = heure actuelle + base : toujours à la requête
  const { token } = await params;
  const found = await findActivation(db, token);

  if (!found.ok) {
    return (
      <div role="alert" className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
        <p className="text-amber-900 dark:text-amber-200">{PROBLEM_TEXT[found.problem]}</p>
        {found.problem !== "USED" && found.problem !== "ALREADY_ACTIVE" && (
          <p className="mt-2 text-amber-800 dark:text-amber-300">
            Demandez un nouveau lien à la personne qui vous a invité.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Bonjour <strong>{found.user.name}</strong>, choisissez votre mot de passe pour accéder à l&apos;espace de{" "}
        <strong>{found.companyName}</strong>.
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Identifiant : <strong>{found.user.email}</strong>
      </p>
      <div className="mt-6">
        <ActivateForm token={token} email={found.user.email} minLength={MIN_PASSWORD_LENGTH} />
      </div>
    </>
  );
}
