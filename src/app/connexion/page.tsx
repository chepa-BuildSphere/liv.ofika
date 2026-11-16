import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/user-session";
import { UserLoginForm } from "./user-login-form";
import { Wordmark } from "@/components/wordmark";
import { ShieldCheckIcon, ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Connexion Entreprise — Ofika Delivery",
  description: "Accès sécurisé pour les équipes et gestionnaires de livraison.",
};

export default function UserLoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#FBFBFA] text-[#111111]">
      {/* Texture subtile en arrière-plan */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          background: "radial-gradient(720px circle at 50% 0%, #C2410C 0%, transparent 70%)",
        }}
      />

      {/* Header épuré */}
      <header className="relative z-10 border-b border-[#EAEAEA] bg-[#FBFBFA]/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="transition-opacity hover:opacity-85">
            <Wordmark className="text-base" />
          </Link>
          <div className="flex items-center gap-3 text-xs text-[#787774]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-mono text-[11px] text-[#787774]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
              Connexion sécurisée TLS 1.3
            </span>
          </div>
        </div>
      </header>

      {/* Corps principal : centré responsive */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-[420px]">
          {/* Carte principale */}
          <div className="rounded-[12px] border border-[#EAEAEA] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] sm:p-8">
            <div className="space-y-1.5">
              <span className="inline-block rounded-full border border-[#EAEAEA] bg-[#F7F6F3] px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[#787774]">
                Espace Entreprise
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
                Connexion
              </h1>
              <p className="text-xs text-[#787774]">
                Accédez à vos tournées, bordereaux de livraison et statistiques de facturation.
              </p>
            </div>

            <div className="mt-6">
              <UserLoginForm />
            </div>

            <div className="mt-6 border-t border-[#EAEAEA] pt-4 text-center space-y-2">
              <p className="text-xs text-[#787774]">
                Pas encore de compte entreprise ?
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#C2410C] hover:underline"
              >
                Créer un compte business gratuitement <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Redirection vers le portail livreur (PWA) */}
          <div className="mt-4 rounded-[10px] border border-[#EAEAEA] bg-white p-4 transition-colors hover:border-[#D4D4D4]">
            <Link
              href="/courier/login"
              className="flex items-center justify-between text-xs font-medium text-[#111111]"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF7ED] text-[#C2410C]">
                  <ShieldCheckIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-[#111111]">Vous êtes livreur ou coursier ?</p>
                  <p className="text-[11px] text-[#787774]">Connectez-vous par téléphone et code PIN</p>
                </div>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-[#787774]" />
            </Link>
          </div>

          <Suspense fallback={null}>
            <RedirectIfLoggedIn />
          </Suspense>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#EAEAEA] py-4 text-center text-xs text-[#787774]">
        <div className="mx-auto max-w-5xl px-4">
          Ofika Delivery · Plateforme logistique B2B sécurisée · Abidjan, Côte d&apos;Ivoire
        </div>
      </footer>
    </div>
  );
}

async function RedirectIfLoggedIn() {
  if (await getCurrentUser()) redirect("/dashboard");
  return null;
}
