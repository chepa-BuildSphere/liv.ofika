import type { Metadata } from "next";
import { Suspense } from "react";
import { requireCourier } from "@/lib/auth/courier-session";
import { courierLogoutAction } from "./connexion/actions";

export const metadata: Metadata = { title: "Mes livraisons — Ofika Delivery" };

export default function CourierHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Chargement…</p>}>
      <CourierHome />
    </Suspense>
  );
}

async function CourierHome() {
  const courier = await requireCourier();
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {courier.name}</h1>
        <form action={courierLogoutAction}>
          <button type="submit" className="btn-secondary shrink-0 whitespace-nowrap">
            Se déconnecter
          </button>
        </form>
      </div>

      {courier.companies.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
          Vous n&apos;êtes rattaché à aucune entreprise pour le moment.
        </p>
      ) : (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-ink-muted">Vos entreprises</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {courier.companies.map((c) => (
              <li key={c.id} className="card p-4">
                <p className="font-semibold">{c.name}</p>
                <p className="mt-1 text-sm text-ink-muted">Vos colis de {c.name} apparaîtront ici.</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
