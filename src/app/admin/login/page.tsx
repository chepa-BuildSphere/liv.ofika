import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { LoginForm } from "./login-form";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Connexion — Back-office Ofika" };

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Wordmark className="text-base" />
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Back-office plateforme</h1>
        <p className="mt-2 text-sm text-ink-muted">Accès réservé à l&apos;éditeur.</p>
        <div className="mt-8">
          <LoginForm />
        </div>
        {/* Déjà connecté : on renvoie vers le back-office */}
        <Suspense fallback={null}>
          <RedirectIfLoggedIn />
        </Suspense>
      </div>
    </main>
  );
}

async function RedirectIfLoggedIn() {
  if (await getCurrentAdmin()) redirect("/admin");
  return null;
}
