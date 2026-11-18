import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import { listCompanyDisputes } from "@/lib/mvp1";

export const metadata: Metadata = {
  title: "Litiges & Contentieux — Ofika Delivery",
};

export default function LitigesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Chargement des litiges…</p>}>
      <LitigesView />
    </Suspense>
  );
}

async function LitigesView() {
  const user = await requireUser();
  const disputes = await listCompanyDisputes(db, user.companyId);

  const openCount = disputes.filter((d) => d.status === "OPEN").length;
  const resolvedCount = disputes.filter((d) => d.status === "RESOLVED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Gestion des Litiges &amp; Réclamations
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Suivi centralisé des contestations de livraison, avaries de colis et anomalies d'encaissement.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 border-l-4 border-l-warning">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Litiges en cours</p>
          <p className="mt-2 text-2xl font-black text-warning tabular-nums">{openCount}</p>
          <p className="mt-1 text-xs text-ink-muted">Dossiers nécessitant une décision</p>
        </div>

        <div className="card p-5 border-l-4 border-l-success">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Litiges résolus</p>
          <p className="mt-2 text-2xl font-black text-success tabular-nums">{resolvedCount}</p>
          <p className="mt-1 text-xs text-ink-muted">Dossiers clôturés avec accord</p>
        </div>

        <div className="card p-5 border-l-4 border-l-ink">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total réclamations</p>
          <p className="mt-2 text-2xl font-black text-ink tabular-nums">{disputes.length}</p>
          <p className="mt-1 text-xs text-ink-muted">Historique complet</p>
        </div>
      </div>

      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold text-ink">Tous les dossiers de litige</h2>

        {disputes.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink-muted">
            Aucun litige enregistré. Vos livraisons se déroulent sans incident !
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface text-ink-muted">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Commande</th>
                  <th className="p-3">Destinataire</th>
                  <th className="p-3">Motif</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Résolution</th>
                  <th className="p-3 text-right">Lien</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-surface/50">
                    <td className="p-3 tabular-nums text-ink-muted">
                      {new Date(d.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3 font-mono font-bold text-ink">
                      {d.deliveryReference}
                    </td>
                    <td className="p-3 text-ink">{d.recipientName}</td>
                    <td className="p-3 font-medium text-ink">{d.reason}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          d.status === "OPEN"
                            ? "bg-warning text-white"
                            : d.status === "RESOLVED"
                              ? "bg-success text-white"
                              : "bg-ink-muted text-white"
                        }`}
                      >
                        {d.status === "OPEN" ? "EN COURS" : d.status === "RESOLVED" ? "RÉSOLU" : "REJETÉ"}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs truncate text-ink-muted" title={d.description}>
                      {d.description}
                    </td>
                    <td className="p-3 text-ink-muted">
                      {d.resolutionNotes ? `${d.resolutionNotes} (${d.resolvedByUserName ?? "Admin"})` : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/espace/livraisons/${d.deliveryId}`}
                        className="btn-secondary text-xs py-1 px-2.5 inline-block"
                      >
                        Voir colis →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
