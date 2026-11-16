import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { can, userActor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/user-session";
import { listDeliveries } from "@/lib/deliveries/deliveries";
import { CSV_TEMPLATE } from "@/lib/deliveries/csv-import";
import type { DeliveryStatus } from "@/lib/deliveries/transitions";
import { formatPhone } from "@/lib/validation";
import { CreateDeliveryForm } from "./create-delivery-form";
import { ImportDeliveriesForm } from "./import-deliveries-form";

export const metadata: Metadata = { title: "Livraisons — Ofika Delivery" };

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  CREATED: "Créée",
  ASSIGNED: "Affectée",
  PICKED_UP: "Prise en charge",
  ARRIVED: "Arrivé",
  DELIVERED: "Livré",
  DELIVERY_FAILED: "Échec",
  RETURNING: "Retour en cours",
  RETURN_RECEIVED: "Retour réceptionné",
  CANCELLED: "Annulée",
};

export default function DeliveriesPage() {
  return (
    <>
      <Link href="/espace" className="text-sm text-ink-muted hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Livraisons</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-ink-muted">Chargement…</p>}>
        <Deliveries />
      </Suspense>
    </>
  );
}

async function Deliveries() {
  const user = await requireUser();
  if (!can(userActor(user), "delivery.create", { companyId: user.companyId }).allowed) {
    return (
      <p role="alert" className="mt-6 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
        La création et le suivi des livraisons sont réservés à l&apos;admin entreprise et au gestionnaire.
      </p>
    );
  }

  const list = await listDeliveries(db, user);

  return (
    <>
      <p className="mt-2 text-sm text-ink-muted">
        Créez vos livraisons à la main avant de les affecter à un livreur.
      </p>
      <div className="mt-6 flex flex-wrap items-start gap-3">
        <CreateDeliveryForm />
        <ImportDeliveriesForm template={CSV_TEMPLATE} />
      </div>

      {list.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
          Aucune livraison pour l&apos;instant.
        </p>
      ) : (
        <ul className="card mt-6 divide-y divide-line" aria-label="Livraisons de l'entreprise">
          {list.map((d) => {
            const label =
              d.status === "DELIVERED" && d.proofMethod === "MANUAL"
                ? "Livré (forcé)"
                : STATUS_LABEL[d.status];
            return (
              <li key={d.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    <span className="font-mono">{d.reference}</span> · {d.recipientName}{" "}
                    <span className="tabular-nums font-normal text-ink-muted">({formatPhone(d.recipientPhone)})</span>
                  </p>
                  <p className="text-ink-muted">
                    {d.address}
                    {d.district ? ` · ${d.district}` : ""}
                    {d.packageDescription ? ` · ${d.packageDescription}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {d.amountToCollect !== null && (
                    <span className="tabular-nums text-xs text-ink-muted">
                      {d.amountToCollect.toLocaleString("fr-FR")} F CFA
                    </span>
                  )}
                  <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium">
                    {label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
