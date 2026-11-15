import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentCourier } from "@/lib/auth/courier-session";
import { CourierLoginForm } from "./courier-login-form";

export const metadata: Metadata = { title: "Connexion livreur — Ofika Delivery" };

export default function CourierLoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
      <p className="mt-2 text-sm text-ink-muted">Votre numéro de téléphone et votre code PIN à 6 chiffres.</p>
      <div className="mt-6">
        <CourierLoginForm />
      </div>
      <p className="mt-6 text-sm text-ink-muted">
        Première fois ?{" "}
        <Link href="/livreur/premier-acces" className="link">
          Choisir mon code PIN avec le code d&apos;accès de mon entreprise
        </Link>
      </p>
      <Suspense fallback={null}>
        <RedirectIfLoggedIn />
      </Suspense>
    </>
  );
}

async function RedirectIfLoggedIn() {
  if (await getCurrentCourier()) redirect("/livreur");
  return null;
}
