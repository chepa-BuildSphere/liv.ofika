import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { can, userActor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/user-session";
import { getCompanyDashboard } from "@/lib/dashboard/dashboard";
import {
  PackageIcon,
  TruckIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  TrendingUpIcon,
  PlusIcon,
  ReceiptIcon,
  UsersIcon,
  KeyIcon,
} from "@/components/icons";
import { ROLE_LABEL } from "./equipe/roles";
import { SecurityAlertCard } from "./security-alert-card";
import { SupportViews } from "./support-views";

export const metadata: Metadata = {
  title: "Tableau de bord Entreprise — Ofika Delivery",
};

type PageProps = {
  searchParams: Promise<{
    date?: string;
    test?: string;
  }>;
};

export default function EspacePage({ searchParams }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-[#787774]">
            <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-ping" />
            <span>Chargement du tableau de bord entreprise…</span>
          </div>
        </div>
      }
    >
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const user = await requireUser();
  const actor = userActor(user);
  const company = { companyId: user.companyId };

  const canDeliveries = can(actor, "delivery.create", company).allowed;
  const canReturns = can(actor, "return.receive", {
    companyId: user.companyId,
    status: "RETURNING",
    courierId: null,
  }).allowed;
  const canCouriers = can(actor, "couriers.manage", company).allowed;
  const canTeam = can(actor, "company.manageUsers", company).allowed;
  const canBilling = can(actor, "billing.viewStatements", company).allowed;

  const includeTest = resolvedParams.test === "1";
  const dashboard = await getCompanyDashboard(actor, user.companyId, {
    date: resolvedParams.date,
    includeTest,
  });

  const { metrics, unreceivedReturns, courierSummaries, forcedDeliveries, securityAlerts } = dashboard;

  return (
    <div className="space-y-8">
      {/* ── EN-TÊTE DU DASHBOARD MARCHAND ─────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#EAEAEA] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#15803D]" />
            <p className="font-mono text-xs uppercase tracking-wider text-[#787774]">
              {user.companyName} · {dashboard.date}
            </p>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111]">
            Tableau de bord
          </h1>
          <p className="mt-1 text-xs text-[#787774]">
            Activité en direct de vos livraisons · Connecté en tant que{" "}
            <strong>{user.roles.map((r) => ROLE_LABEL[r] ?? r).join(" & ")}</strong>.
          </p>
        </div>

        {/* Contrôles date, mode test et action rapide */}
        <div className="flex flex-wrap items-center gap-2.5">
          <form method="GET" className="flex items-center gap-2 rounded-lg border border-[#EAEAEA] bg-white p-1 shadow-2xs">
            <input
              type="date"
              name="date"
              defaultValue={dashboard.date}
              className="rounded-md border-0 bg-transparent px-2 py-1 text-xs font-mono text-[#111111] focus:outline-none"
            />
            <label className="flex items-center gap-1.5 px-2 text-[11px] font-medium text-[#787774] cursor-pointer">
              <input
                type="checkbox"
                name="test"
                value="1"
                defaultChecked={includeTest}
                className="size-3 accent-[#C2410C]"
              />
              Test
            </label>
            <button
              type="submit"
              className="h-7 rounded-md bg-[#111111] px-2.5 text-[11px] font-bold text-white hover:bg-[#333] transition-colors"
            >
              OK
            </button>
            {!dashboard.isToday && (
              <Link
                href="/dashboard"
                className="px-2 text-[11px] font-semibold text-[#C2410C] hover:underline"
              >
                Aujourd&apos;hui
              </Link>
            )}
          </form>

          {canDeliveries && (
            <Link
              href="/espace/livraisons"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#C2410C] px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#9A3412] active:scale-98"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Nouvelle livraison</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── ALERTES DE SÉCURITÉ ACTIVES ─────────────────────────────────── */}
      {securityAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">
              Alertes de sécurité à traiter ({securityAlerts.length})
            </h2>
          </div>
          {securityAlerts.map((alert) => (
            <SecurityAlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* ── 4 KPI CARDS PRO & PREMIUM ───────────────────────────────────── */}
      <section aria-label="Indicateurs clés" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 : Livrées */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Livrées</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0FDF4] text-[#15803D]">
              <CheckCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-[#111111] tabular-nums">
              {metrics.deliveredTotal}
            </span>
            <span className="text-xs text-[#787774]">sur {metrics.total} colis</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <span className="text-[#15803D] font-medium">✓ {metrics.deliveredQr} par QR scellé</span>
            {metrics.deliveredForced > 0 && (
              <span className="text-[#B45309] font-medium">
                ⚠️ {metrics.deliveredForced} forcée(s)
              </span>
            )}
          </div>
        </div>

        {/* KPI 2 : En tournée */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">En tournée</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1D4ED8]">
              <TruckIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-[#111111] tabular-nums">
              {metrics.inTransit}
            </span>
            <span className="text-xs text-[#787774]">en cours de route</span>
          </div>
          <p className="mt-2 text-[11px] text-[#787774]">
            Pris en charge par livreurs à moto
          </p>
        </div>

        {/* KPI 3 : Retours non réceptionnés */}
        <div
          className={`rounded-xl border p-5 shadow-xs transition-shadow hover:shadow-sm ${
            metrics.returning > 0
              ? "border-[#B45309]/30 bg-[#FFFBEB]/40"
              : "border-[#EAEAEA] bg-white"
          }`}
        >
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Retours dépôt</span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                metrics.returning > 0 ? "bg-[#FFFBEB] text-[#B45309]" : "bg-[#F7F6F3] text-[#787774]"
              }`}
            >
              <AlertTriangleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold tracking-tight tabular-nums ${
                metrics.returning > 0 ? "text-[#B45309]" : "text-[#111111]"
              }`}
            >
              {metrics.returning}
            </span>
            <span className="text-xs text-[#787774]">non réceptionnés</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-[#787774]">{metrics.returnReceived} reçus au dépôt</span>
            {metrics.returning > 0 && canReturns && (
              <Link href="/espace/retours" className="font-bold text-[#C2410C] hover:underline">
                Scanner →
              </Link>
            )}
          </div>
        </div>

        {/* KPI 4 : Taux de succès */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Taux de succès</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED] text-[#C2410C]">
              <TrendingUpIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold tracking-tight text-[#C2410C] tabular-nums">
              {metrics.successRatePercent}%
            </span>
            <span className="text-xs text-[#787774]">des courses closes</span>
          </div>
          <p className="mt-2 text-[11px] text-[#787774]">
            {metrics.failed} échec(s) enregistré(s)
          </p>
        </div>
      </section>

      {/* ── VENTILATION PAR STATUT ─────────────────────────────────────── */}
      <section aria-label="Ventilation par statut" className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
            Ventilation des colis par statut
          </h2>
          <Link href="/espace/livraisons" className="text-xs font-semibold text-[#C2410C] hover:underline">
            Voir toutes les livraisons →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 text-xs">
          <div className="rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] p-2.5 text-center">
            <span className="text-[10px] text-[#787774] block mb-0.5">Créées</span>
            <span className="text-base font-bold tabular-nums text-[#111111]">{metrics.created}</span>
          </div>
          <div className="rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] p-2.5 text-center">
            <span className="text-[10px] text-[#787774] block mb-0.5">Affectées</span>
            <span className="text-base font-bold tabular-nums text-[#111111]">{metrics.assigned}</span>
          </div>
          <div className="rounded-lg border border-[#3B82F6]/20 bg-[#EFF6FF] p-2.5 text-center">
            <span className="text-[10px] font-semibold text-[#1D4ED8] block mb-0.5">En tournée</span>
            <span className="text-base font-bold tabular-nums text-[#1D4ED8]">{metrics.inTransit}</span>
          </div>
          <div className="rounded-lg border border-[#15803D]/20 bg-[#F0FDF4] p-2.5 text-center">
            <span className="text-[10px] font-semibold text-[#15803D] block mb-0.5">Livrées (QR)</span>
            <span className="text-base font-bold tabular-nums text-[#15803D]">{metrics.deliveredQr}</span>
          </div>
          <div className="rounded-lg border border-[#B45309]/20 bg-[#FFFBEB] p-2.5 text-center">
            <span className="text-[10px] font-semibold text-[#B45309] block mb-0.5">Livrées (forcées)</span>
            <span className="text-base font-bold tabular-nums text-[#B45309]">{metrics.deliveredForced}</span>
          </div>
          <div className="rounded-lg border border-[#DC2626]/20 bg-[#FEF2F2] p-2.5 text-center">
            <span className="text-[10px] font-semibold text-[#DC2626] block mb-0.5">Échecs</span>
            <span className="text-base font-bold tabular-nums text-[#DC2626]">{metrics.failed}</span>
          </div>
          <div className="rounded-lg border border-[#B45309]/20 bg-[#FFFBEB] p-2.5 text-center">
            <span className="text-[10px] font-semibold text-[#B45309] block mb-0.5">Retours dépôt</span>
            <span className="text-base font-bold tabular-nums text-[#B45309]">{metrics.returning}</span>
          </div>
          <div className="rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] p-2.5 text-center">
            <span className="text-[10px] text-[#787774] block mb-0.5">Retours reçus</span>
            <span className="text-base font-bold tabular-nums text-[#111111]">{metrics.returnReceived}</span>
          </div>
        </div>
      </section>

      {/* ── RETOURS NON RÉCEPTIONNÉS (ATTENTION IMMÉDIATE) ─────────────── */}
      <section aria-label="Retours non réceptionnés" className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] bg-[#FBFBFA] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-[#111111]">
              Retours non réceptionnés au dépôt
            </h2>
            <p className="text-[11px] text-[#787774]">
              Colis retournés par les livreurs mais non encore scannés physiquement au dépôt.
            </p>
          </div>
          {canReturns && (
            <Link
              href="/espace/retours"
              className="inline-flex h-8 items-center gap-1 rounded-md bg-[#111111] px-2.5 text-xs font-semibold text-white hover:bg-[#333]"
            >
              <span>Scanner un retour →</span>
            </Link>
          )}
        </div>

        {unreceivedReturns.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#15803D] bg-[#F0FDF4]/50">
            ✓ Tous les colis de retour ont été réceptionnés et vérifiés au dépôt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EAEAEA] bg-[#F7F6F3] font-mono text-[10px] uppercase tracking-wider text-[#787774]">
                <tr>
                  <th className="px-5 py-3">Référence</th>
                  <th className="px-4 py-3">Destinataire &amp; Adresse</th>
                  <th className="px-4 py-3">Livreur</th>
                  <th className="px-4 py-3">Délai</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {unreceivedReturns.map((r) => (
                  <tr key={r.deliveryId} className="transition-colors hover:bg-[#FBFBFA]">
                    <td className="px-5 py-3 font-mono font-bold text-[#111111]">
                      <Link href={`/espace/livraisons/${r.deliveryId}`} className="text-[#C2410C] hover:underline">
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#787774] max-w-xs truncate">
                      {r.recipientAddress}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#111111]">{r.courierName ?? "Non affecté"}</span>
                      {r.courierPhone && <span className="block font-mono text-[10px] text-[#787774]">{r.courierPhone}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.hoursElapsed >= 4
                            ? "bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20"
                            : r.hoursElapsed >= 2
                            ? "bg-[#FFFBEB] text-[#B45309] border border-[#B45309]/20"
                            : "bg-[#F7F6F3] text-[#787774] border border-[#EAEAEA]"
                        }`}
                      >
                        {r.hoursElapsed > 0 ? `Il y a ${r.hoursElapsed} h` : "Récent (< 1 h)"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canReturns ? (
                        <Link
                          href="/espace/retours"
                          className="inline-flex h-7 items-center rounded-md border border-[#EAEAEA] bg-white px-2.5 text-[11px] font-semibold text-[#111111] hover:border-[#111111]"
                        >
                          Réceptionner
                        </Link>
                      ) : (
                        <span className="text-[#787774]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── ACTIVITÉ DES LIVREURS ──────────────────────────────────────── */}
      <section aria-label="Activité des livreurs" className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] bg-[#FBFBFA] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-[#111111]">Activité de la Flotte</h2>
            <p className="text-[11px] text-[#787774]">
              Suivi en temps réel des courses par coursier pour cette journée.
            </p>
          </div>
          {canCouriers && (
            <Link href="/espace/livreurs" className="text-xs font-semibold text-[#C2410C] hover:underline">
              Gérer la flotte →
            </Link>
          )}
        </div>

        {courierSummaries.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#787774]">
            Aucun livreur n&apos;a de colis assigné ou en cours pour cette date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EAEAEA] bg-[#F7F6F3] font-mono text-[10px] uppercase tracking-wider text-[#787774]">
                <tr>
                  <th className="px-5 py-3">Livreur</th>
                  <th className="px-3 py-3 text-center">En tournée</th>
                  <th className="px-3 py-3 text-center">Livrées (QR)</th>
                  <th className="px-3 py-3 text-center">Forcées</th>
                  <th className="px-3 py-3 text-center">Retours en cours</th>
                  <th className="px-3 py-3 text-center">Retours reçus</th>
                  <th className="px-3 py-3 text-center">Échecs</th>
                  <th className="px-5 py-3 text-right">État tournée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {courierSummaries.map((c) => (
                  <tr key={c.courierId} className="transition-colors hover:bg-[#FBFBFA]">
                    <td className="px-5 py-3">
                      <span className="font-bold text-[#111111]">{c.name}</span>
                      <span className="block font-mono text-[10px] text-[#787774]">{c.phone}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-[#1D4ED8]">
                      {c.pickedUp}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-[#15803D]">
                      {c.deliveredQr}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-[#B45309]">
                      {c.deliveredForced}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-[#B45309]">
                      {c.returning}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-[#787774]">
                      {c.returnReceived}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-[#DC2626]">
                      {c.failed}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          c.isSettled
                            ? "bg-[#F0FDF4] text-[#15803D] border border-[#15803D]/20"
                            : "bg-[#EFF6FF] text-[#1D4ED8] border border-[#1D4ED8]/20"
                        }`}
                      >
                        {c.isSettled ? "Soldé ✓" : "En cours"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── LIVRAISONS FORCÉES (SURVEILLANCE & CONFORMITÉ) ─────────────── */}
      {forcedDeliveries.length > 0 && (
        <section aria-label="Livraisons forcées récentes" className="overflow-hidden rounded-xl border border-[#B45309]/30 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] bg-[#FFFBEB]/40 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#B45309]" />
              <h2 className="text-sm font-bold text-[#111111]">Livraisons forcées récentes (Audit)</h2>
            </div>
            <span className="text-xs text-[#787774]">Motif obligatoire vérifiable</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EAEAEA] bg-[#F7F6F3] font-mono text-[10px] uppercase tracking-wider text-[#787774]">
                <tr>
                  <th className="px-5 py-3">Référence</th>
                  <th className="px-4 py-3">Livreur</th>
                  <th className="px-4 py-3">Motif consigné</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {forcedDeliveries.map((f) => (
                  <tr key={f.deliveryId} className="transition-colors hover:bg-[#FBFBFA]">
                    <td className="px-5 py-3 font-mono font-bold text-[#111111]">{f.reference}</td>
                    <td className="px-4 py-3 text-[#787774]">{f.courierName ?? "Inconnu"}</td>
                    <td className="px-4 py-3 text-[#111111] max-w-sm truncate">{f.forcedReason}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/espace/livraisons/${f.deliveryId}`}
                        className="text-xs font-semibold text-[#C2410C] hover:underline"
                      >
                        Consulter →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── CONSULTATIONS SUPPORT ENREGISTRÉES ──────────────────────────── */}
      <SupportViews user={user} />
    </div>
  );
}
