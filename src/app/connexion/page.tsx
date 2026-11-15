import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/user-session";
import { UserLoginForm } from "./user-login-form";

export const metadata: Metadata = { title: "Connexion — Ofika Delivery" };

export default function UserLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="text-sm font-medium text-zinc-500">Ofika Delivery</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Connexion à votre espace</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Pour les équipes des entreprises clientes. Pas encore de compte ? Votre administrateur vous envoie un lien
          d&apos;activation.
        </p>
        <div className="mt-8">
          <UserLoginForm />
        </div>
        <Suspense fallback={null}>
          <RedirectIfLoggedIn />
        </Suspense>
      </div>
    </main>
  );
}

async function RedirectIfLoggedIn() {
  if (await getCurrentUser()) redirect("/espace");
  return null;
}
