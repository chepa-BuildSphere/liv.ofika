import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/user-session";
import { getCachedPlatformPrice } from "@/lib/billing/public-price";
import { CompanyRegisterForm } from "./company-register-form";
import { Wordmark } from "@/components/wordmark";
import { ShieldCheckIcon, CheckCircleIcon, ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Inscription Business — Ofika Delivery",
  description:
    "Créez votre compte entreprise en 2 minutes. Gérez vos livreurs, éliminez les contestations de livraison et validez vos remises par QR code sécurisé.",
};

export default async function RegisterCompanyPage() {
  const pricePerDelivery = await getCachedPlatformPrice();
  const formattedPrice = pricePerDelivery.toLocaleString("fr-FR");

  return (
    <div className="relative flex min-h-screen flex-col bg-[#FBFBFA] text-[#111111]">
      {/* Texture douce */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          background: "radial-gradient(720px circle at 50% 0%, #C2410C 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-[#EAEAEA] bg-[#FBFBFA]/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="transition-opacity hover:opacity-85">
            <Wordmark className="text-base" />
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <span className="hidden text-[#787774] sm:inline">Vous avez déjà un compte ?</span>
            <Link
              href="/login"
              className="inline-flex h-8.5 items-center justify-center rounded-[6px] border border-[#EAEAEA] bg-white px-3 text-xs font-semibold text-[#111111] transition-colors hover:border-[#111111]"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <div className="space-y-6">
          {/* Titre et proposition de valeur */}
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#C2410C]/20 bg-[#FFF7ED] px-3 py-1 font-mono text-[11px] font-semibold text-[#C2410C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C] animate-pulse" />
              Ouverture de compte Business instantanée
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111]">
              Créez votre compte entreprise
            </h1>
            <p className="text-xs sm:text-sm text-[#787774] leading-relaxed">
              Sécurisez vos tournées de livraison à Abidjan et en Côte d&apos;Ivoire.
              Bénéficiez du système de preuve par QR code et code de remise bilatéral.
            </p>
          </div>

          {/* Avantages clés sous forme de chips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-[8px] border border-[#EAEAEA] bg-white p-2.5">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
              <span className="font-medium text-[#111111]">{formattedPrice} F CFA / livraison livrée</span>
            </div>
            <div className="flex items-center gap-2 rounded-[8px] border border-[#EAEAEA] bg-white p-2.5">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
              <span className="font-medium text-[#111111]">0 F d&apos;abonnement mensuel</span>
            </div>
            <div className="flex items-center gap-2 rounded-[8px] border border-[#EAEAEA] bg-white p-2.5">
              <ShieldCheckIcon className="h-4 w-4 shrink-0 text-[#C2410C]" />
              <span className="font-medium text-[#111111]">Preuve QR code infalsifiable</span>
            </div>
          </div>

          {/* Carte du formulaire */}
          <div className="rounded-[12px] border border-[#EAEAEA] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] sm:p-8">
            <CompanyRegisterForm pricePerDelivery={pricePerDelivery} />
          </div>

          {/* Redirection vers le portail livreur */}
          <div className="rounded-[10px] border border-[#EAEAEA] bg-[#FBFBFA] p-4 text-center">
            <p className="text-xs text-[#787774]">
              Vous êtes coursier ou livreur mandaté par une entreprise ?{" "}
              <Link
                href="/courier/login"
                className="font-semibold text-[#C2410C] hover:underline"
              >
                Accédez à votre espace livreur →
              </Link>
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <RedirectIfLoggedIn />
        </Suspense>
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
