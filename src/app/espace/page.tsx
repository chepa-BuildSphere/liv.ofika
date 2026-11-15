import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/user-session";

export const metadata: Metadata = { title: "Mon espace — Ofika Delivery" };

const ROLE_LABEL = {
  COMPANY_ADMIN: "Admin entreprise",
  MANAGER: "Gestionnaire",
  RETURNS_OFFICER: "Responsable retours",
} as const;

export default function EspacePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Chargement…</p>}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const user = await requireUser();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Bonjour {user.name}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Vous êtes connecté à l&apos;espace de <strong>{user.companyName}</strong>
        {user.roles.length > 0 && <> en tant que {user.roles.map((r) => ROLE_LABEL[r]).join(" et ")}</>}.
      </p>
      <p className="mt-8 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
        Les livraisons, livreurs et retours arrivent dans les prochaines étapes.
      </p>
    </>
  );
}
