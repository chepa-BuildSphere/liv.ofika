import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import { userActor } from "@/lib/auth/permissions";
import { listCouriers } from "@/lib/couriers/couriers";
import {
  getCourierCashOverview,
  listCompanyCashHandovers,
  type CourierCashOverview,
} from "@/lib/mvp1";
import { EncaissementsClient } from "./encaissements-client";

export const metadata: Metadata = {
  title: "Encaissements & Caisse — Ofika Delivery",
};

export default function EncaissementsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Chargement des encaissements…</p>}>
      <EncaissementsView />
    </Suspense>
  );
}

async function EncaissementsView() {
  const user = await requireUser();
  const couriersList = await listCouriers(db, user);
  const attachedCouriers = couriersList.filter((c) => c.attached);

  const courierSummaries: CourierCashOverview[] = [];
  for (const c of attachedCouriers) {
    const overview = await getCourierCashOverview(db, user.companyId, c.id);
    courierSummaries.push(overview);
  }

  const handovers = await listCompanyCashHandovers(db, userActor(user), user.companyId);
  const canReconcile = user.roles.includes("COMPANY_ADMIN") || user.roles.includes("MANAGER");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Gestion des Encaissements &amp; Rapprochement de Caisse
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Suivi des paiements à la livraison (Wave, Mobile Money, Espèces) et validation des versements physiques au dépôt.
        </p>
      </div>

      <EncaissementsClient
        courierSummaries={courierSummaries}
        handovers={handovers}
        canReconcile={canReconcile}
      />
    </div>
  );
}
