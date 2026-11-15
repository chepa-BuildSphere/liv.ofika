import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion — Back-office Ofika" };

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="text-sm font-medium text-zinc-500">Ofika Delivery</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Back-office plateforme</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Accès réservé à l&apos;éditeur.</p>
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
