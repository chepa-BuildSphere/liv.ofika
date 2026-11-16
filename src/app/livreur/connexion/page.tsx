import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentCourier } from "@/lib/auth/courier-session";
import { CourierLoginForm } from "./courier-login-form";
import { KeyIcon, ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Connexion Livreur — Ofika Delivery",
  description: "Accès mobile à la tournée et validation des colis par QR code.",
};

export default function CourierLoginPage() {
  return (
    <div className="space-y-6">
      {/* En-tête de bienvenue livreur */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#EAEAEA] bg-white px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[#787774]">
          <span className="h-2 w-2 rounded-full bg-[#15803D]" />
          Portail Coursier Mobile
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
          Connexion Livreur
        </h1>
        <p className="text-xs text-[#787774] leading-relaxed">
          Accédez à vos colis du jour et validez les remises par QR code et code client.
        </p>
      </div>

      {/* Carte du formulaire */}
      <div className="rounded-[12px] border border-[#EAEAEA] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] sm:p-6">
        <CourierLoginForm />
      </div>

      {/* Carte d'accès Premier Pas */}
      <div className="rounded-[12px] border border-[#EAEAEA] bg-[#FBFBFA] p-4 transition-colors hover:border-[#D4D4D4]">
        <Link
          href="/courier/first-access"
          className="flex items-start gap-3 text-xs"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF7ED] text-[#C2410C]">
            <KeyIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[#111111]">Première connexion ?</p>
            <p className="mt-0.5 text-[#787774] leading-normal">
              Activez votre compte et choisissez votre code PIN avec le code remis par votre entreprise.
            </p>
            <span className="mt-2 inline-flex items-center gap-1 font-medium text-[#C2410C]">
              Définir mon code PIN <ArrowRightIcon className="h-3 w-3" />
            </span>
          </div>
        </Link>
      </div>

      {/* Lien retour entreprise */}
      <div className="text-center">
        <Link
          href="/login"
          className="text-xs text-[#787774] transition-colors hover:text-[#111111] hover:underline"
        >
          Vous êtes gestionnaire d&apos;entreprise ? Connexion équipe →
        </Link>
      </div>

      <Suspense fallback={null}>
        <RedirectIfLoggedIn />
      </Suspense>
    </div>
  );
}

async function RedirectIfLoggedIn() {
  if (await getCurrentCourier()) redirect("/courier");
  return null;
}
