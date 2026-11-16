import type { Metadata } from "next";
import { FirstAccessForm } from "./first-access-form";

export const metadata: Metadata = {
  title: "Premier accès livreur — Ofika Delivery",
  robots: { index: false, follow: false },
};

export default function FirstAccessPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="inline-block rounded-full border border-[#EAEAEA] bg-white px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[#787774]">
          Activation compte coursier
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
          Premier accès
        </h1>
        <p className="text-xs text-[#787774] leading-relaxed">
          Renseignez votre numéro et le code d&apos;accès temporaire transmis par votre entreprise pour définir votre code PIN secret.
        </p>
      </div>

      <div className="rounded-[12px] border border-[#EAEAEA] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] sm:p-6">
        <FirstAccessForm />
      </div>
    </div>
  );
}
