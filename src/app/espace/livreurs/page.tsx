import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { can, userActor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/user-session";
import { listCouriers } from "@/lib/couriers/couriers";
import { getCourierSummaries } from "@/lib/deliveries/deliveries";
import { formatPhone } from "@/lib/validation";
import { env } from "@/env";
import {
  TruckIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@/components/icons";
import { AddCourierForm } from "./add-courier-form";
import { DetachCourierButton } from "./detach-courier-button";
import { IssueCodeButton } from "./issue-code-button";

export const metadata: Metadata = { title: "Flotte Livreurs — Ofika Delivery" };

const TYPE_LABEL = { EMPLOYEE: "Salarié", INDEPENDENT: "Indépendant" } as const;

export default function CouriersPage() {
  return (
    <div className="space-y-6">
      {/* ── BREADCRUMB ─────────────────────────────────────────────────── */}
      <nav aria-label="Fil d'ariane" className="flex items-center gap-2 text-xs text-[#787774]">
        <Link href="/dashboard" className="hover:text-[#111111] transition-colors">
          Tableau de bord
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#111111]">Livreurs &amp; Flotte</span>
      </nav>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[#EAEAEA] pb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-white">
            <TruckIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111111]">
              Flotte de Livreurs
            </h1>
            <p className="text-xs text-[#787774]">
              Rattachez vos livreurs à moto, générez leurs codes de premier accès et suivez l&apos;état de leurs tournées à Abidjan.
            </p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-48 items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-[#787774]">
              <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-ping" />
              <span>Chargement de la flotte…</span>
            </div>
          </div>
        }
      >
        <Couriers />
      </Suspense>
    </div>
  );
}

async function Couriers() {
  const user = await requireUser();
  if (!can(userActor(user), "couriers.manage", { companyId: user.companyId }).allowed) {
    return (
      <div role="alert" className="rounded-xl border border-[#B45309]/20 bg-[#FFFBEB] p-5 text-xs text-[#B45309]">
        La gestion des livreurs est réservée à l&apos;administrateur et au gestionnaire de l&apos;entreprise.
      </div>
    );
  }

  const [list, summaries] = await Promise.all([listCouriers(db, user), getCourierSummaries(db, user)]);
  const attached = list.filter((c) => c.attached);
  const detached = list.filter((c) => !c.attached);
  const summaryByCourier = new Map(summaries.map((s) => [s.courierId, s]));
  const visibleSummaries = summaries.filter(
    (s) => s.attached || s.pickedUpTotal > 0 || s.assignedPendingPickup > 0,
  );

  return (
    <div className="space-y-8">
      {/* Formulaire d'ajout rapide de coursier */}
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-6 shadow-xs">
        <AddCourierForm appUrl={env.appUrl} />
      </div>

      {/* Bilan en direct par livreur */}
      {visibleSummaries.length > 0 && (
        <section aria-label="Bilan par livreur" className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] bg-[#FBFBFA] px-5 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-[#111111]">Bilan d&apos;Activité par Livreur</h2>
              <p className="text-[11px] text-[#787774]">Colis pris = Livrés + Retours reçus + En cours</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EAEAEA] bg-[#F7F6F3] font-mono text-[10px] uppercase tracking-wider text-[#787774]">
                <tr>
                  <th className="px-5 py-3">Livreur</th>
                  <th className="px-3 py-3 text-right">Pris</th>
                  <th className="px-3 py-3 text-right">Livrés</th>
                  <th className="px-3 py-3 text-right">Dont forcés</th>
                  <th className="px-3 py-3 text-right">Retours reçus</th>
                  <th className="px-3 py-3 text-right">En cours</th>
                  <th className="px-5 py-3 text-right">État tournée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {visibleSummaries.map((s) => (
                  <tr key={s.courierId} className="transition-colors hover:bg-[#FBFBFA]">
                    <td className="px-5 py-3">
                      <Link href={`/espace/livraisons?courierId=${s.courierId}`} className="font-bold text-[#111111] hover:text-[#C2410C]">
                        {s.courierName}
                      </Link>
                      {!s.attached && <span className="ml-1.5 text-[10px] text-[#787774] font-mono">(détaché)</span>}
                      {s.assignedPendingPickup > 0 && (
                        <span className="block text-[11px] text-[#B45309]">
                          + {s.assignedPendingPickup} à prendre en charge
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-[#111111]">{s.pickedUpTotal}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-[#15803D]">{s.delivered}</td>
                    <td className="px-3 py-3 text-right font-mono text-[#787774]">{s.forcedDelivered}</td>
                    <td className="px-3 py-3 text-right font-mono text-[#787774]">{s.returnReceived}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-[#1D4ED8]">
                      {s.inProgress}
                      {s.returning > 0 && (
                        <span className="block text-[10px] text-[#B45309]">dont {s.returning} en retour</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {s.isSettled ? (
                        <span className="inline-flex items-center rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-2.5 py-0.5 font-bold text-[#15803D]">
                          Soldé ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-[#1D4ED8]/20 bg-[#EFF6FF] px-2.5 py-0.5 font-bold text-[#1D4ED8]">
                          En cours
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Liste des livreurs rattachés */}
      <section aria-label="Livreurs rattachés" className="space-y-3">
        <h2 className="text-sm font-bold text-[#111111]">
          Livreurs Actifs ({attached.length})
        </h2>

        {attached.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#EAEAEA] bg-white p-8 text-center text-xs text-[#787774]">
            Aucun livreur rattaché pour l&apos;instant.
          </div>
        ) : (
          <ul className="rounded-xl border border-[#EAEAEA] bg-white divide-y divide-[#EAEAEA] shadow-xs">
            {attached.map((c) => {
              const summary = summaryByCourier.get(c.id);
              return (
                <li key={c.id} className="flex flex-col gap-3 p-4 sm:p-5 text-xs transition-colors hover:bg-[#FBFBFA]">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-sm text-[#111111]">{c.name}</p>
                      <p className="font-mono text-[#787774]">{formatPhone(c.phone)}</p>
                      {summary && (
                        <p className="mt-1 text-[11px] text-[#787774]">
                          Tournée : {summary.pickedUpTotal} pris = {summary.delivered} livré(s) +{" "}
                          {summary.returnReceived} retour(s) + {summary.inProgress} en cours
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#EAEAEA] bg-[#F7F6F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#555]">
                        {TYPE_LABEL[c.employmentType]}
                      </span>
                      {c.hasPin ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#15803D]">
                          <CheckCircleIcon className="h-3 w-3" />
                          <span>Code PIN configuré</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B45309]">
                          <ClockIcon className="h-3 w-3" />
                          <span>Premier accès en attente</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EAEAEA]/60">
                    <div>
                      {!c.hasPin && <IssueCodeButton courierId={c.id} appUrl={env.appUrl} />}
                    </div>
                    <DetachCourierButton courierId={c.id} courierName={c.name} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Livreurs détachés */}
      {detached.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#787774]">
            Historique des livreurs détachés ({detached.length})
          </h2>
          <ul className="rounded-xl border border-[#EAEAEA] bg-white divide-y divide-[#EAEAEA] text-xs">
            {detached.map((c) => (
              <li key={c.id} className="flex justify-between p-3 text-[#787774]">
                <span className="font-medium text-[#111111]">{c.name}</span>
                <span className="font-mono text-[11px]">Détaché le {c.detachedAt?.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
