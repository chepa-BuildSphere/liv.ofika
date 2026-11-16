import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { Wordmark } from "@/components/wordmark";
import { ShieldCheckIcon } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion Super Admin — Ofika Platform" };

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FBFBFA] px-4 py-12 text-[#111111]">
      <div className="w-full max-w-md">
        {/* Card principale pro */}
        <div className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white p-8 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.08)]">
          {/* Header */}
          <div className="border-b border-[#EAEAEA] pb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#111111] text-white shadow-xs">
              <ShieldCheckIcon className="h-6 w-6 text-[#C2410C]" />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Wordmark className="text-base" />
              <span className="rounded-full bg-[#111111] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                Super Admin
              </span>
            </div>
            <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#111111]">
              Console Éditeur Plateforme
            </h1>
            <p className="mt-1 text-xs text-[#787774]">
              Accès réservé au Super Administrateur de la plateforme Ofika Delivery.
            </p>
          </div>

          {/* Formulaire de connexion */}
          <div className="mt-6">
            <LoginForm />
          </div>

          <div className="mt-6 border-t border-[#EAEAEA] pt-4 text-center">
            <p className="text-[11px] text-[#787774]">
              Session sécurisée par cookie HTTP-Only · Abidjan, CI
            </p>
          </div>
        </div>

        {/* Liens de retour */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs font-medium text-[#787774] hover:text-[#111111] transition-colors"
          >
            ← Retour au site public Ofika
          </Link>
        </div>

        {/* Déjà connecté : on renvoie directement vers le back-office */}
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
