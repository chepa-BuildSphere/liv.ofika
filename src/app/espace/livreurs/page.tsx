import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { can, userActor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/user-session";
import { listCouriers } from "@/lib/couriers/couriers";
import { formatPhone } from "@/lib/validation";
import { env } from "@/env";
import { AddCourierForm } from "./add-courier-form";
import { IssueCodeButton } from "./issue-code-button";

export const metadata: Metadata = { title: "Livreurs — Ofika Delivery" };

const TYPE_LABEL = { EMPLOYEE: "Employé", INDEPENDENT: "Indépendant" } as const;

export default function CouriersPage() {
  return (
    <>
      <Link href="/espace" className="text-sm text-ink-muted hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Livreurs</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-ink-muted">Chargement…</p>}>
        <Couriers />
      </Suspense>
    </>
  );
}

async function Couriers() {
  const user = await requireUser();
  if (!can(userActor(user), "couriers.manage", { companyId: user.companyId }).allowed) {
    return (
      <p role="alert" className="mt-6 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
        La gestion des livreurs est réservée à l&apos;admin entreprise et au gestionnaire.
      </p>
    );
  }

  const list = await listCouriers(db, user);
  const attached = list.filter((c) => c.attached);
  const detached = list.filter((c) => !c.attached);

  return (
    <>
      <p className="mt-2 text-sm text-ink-muted">
        Les livreurs se connectent avec leur téléphone et un code PIN à 6 chiffres qu&apos;ils choisissent eux-mêmes.
      </p>
      <div className="mt-6">
        <AddCourierForm appUrl={env.appUrl} />
      </div>

      {attached.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
          Aucun livreur pour l&apos;instant.
        </p>
      ) : (
        <ul className="card mt-6 divide-y divide-line" aria-label="Livreurs rattachés">
          {attached.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 px-4 py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="tabular-nums text-ink-muted">{formatPhone(c.phone)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs">{TYPE_LABEL[c.employmentType]}</span>
                  {c.hasPin ? (
                    <span className="text-xs text-success">Code PIN choisi</span>
                  ) : (
                    <span className="text-xs text-warning">Premier accès à faire</span>
                  )}
                </div>
              </div>
              {!c.hasPin && <IssueCodeButton courierId={c.id} appUrl={env.appUrl} />}
            </li>
          ))}
        </ul>
      )}

      {detached.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink-muted">Anciens livreurs (détachés)</h2>
          <ul className="card mt-2 divide-y divide-line">
            {detached.map((c) => (
              <li key={c.id} className="flex justify-between px-4 py-3 text-sm text-ink-muted">
                <span>{c.name}</span>
                <span>Détaché le {c.detachedAt?.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
