import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db";
import { requireCourier } from "@/lib/auth/courier-session";
import { deliveryStatusLabel, listCourierDeliveries } from "@/lib/deliveries/deliveries";
import { formatPhone } from "@/lib/validation";
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
  const deliveries = await listCourierDeliveries(db, courier);

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
          <h2 className="text-sm font-semibold text-ink-muted">Vos livraisons par entreprise</h2>
          <ul className="mt-2 flex flex-col gap-4">
            {courier.companies.map((c) => {
              const items = deliveries.filter((d) => d.companyId === c.id);
              return (
                <li key={c.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{c.name}</p>
                    <span className="text-xs text-ink-muted">
                      {items.length} colis
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-muted">Aucun colis affecté pour le moment.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-line border-t border-line">
                      {items.map((d) => (
                        <li key={d.id} className="flex flex-col gap-1 py-2.5 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              <span className="font-mono">{d.reference}</span> · {d.recipientName}
                            </span>
                            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs">
                              {deliveryStatusLabel(d.status, d.proofMethod)}
                            </span>
                          </div>
                          <p className="text-ink-muted">
                            {d.address}
                            {d.district ? ` · ${d.district}` : ""} ·{" "}
                            <span className="tabular-nums">{formatPhone(d.recipientPhone)}</span>
                          </p>
                          {d.amountToCollect !== null && (
                            <p className="text-xs font-medium tabular-nums">
                              À encaisser : {d.amountToCollect.toLocaleString("fr-FR")} F CFA
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
