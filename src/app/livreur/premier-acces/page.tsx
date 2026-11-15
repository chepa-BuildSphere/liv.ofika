import type { Metadata } from "next";
import { FirstAccessForm } from "./first-access-form";

export const metadata: Metadata = {
  title: "Premier accès livreur — Ofika Delivery",
  robots: { index: false, follow: false },
};

export default function FirstAccessPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Premier accès</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Saisissez votre numéro et le code d&apos;accès reçu de votre entreprise, puis choisissez votre code PIN.
      </p>
      <div className="mt-6">
        <FirstAccessForm />
      </div>
    </>
  );
}
