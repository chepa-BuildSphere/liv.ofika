import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import {
  BILLING_SETTING_LABEL,
  BillingError,
  formatBillingPeriod,
  formatBillingSettingValue,
  getCompanyBillingOverview,
  STATEMENT_STATUS_LABEL,
} from "@/lib/billing/billing";
import {
  ReceiptIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
} from "@/components/icons";

export const metadata: Metadata = { title: "Facturation & Relevés — Ofika Delivery" };

type SearchParams = Promise<{ period?: string }>;

function formatDateTime(d: Date): string {
  return d.toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function CompanyBillingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-6">
      {/* ── BREADCRUMB ─────────────────────────────────────────────────── */}
      <nav aria-label="Fil d'ariane" className="flex items-center gap-2 text-xs text-[#787774]">
        <Link href="/dashboard" className="hover:text-[#111111] transition-colors">
          Tableau de bord
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#111111]">Facturation &amp; Relevés</span>
      </nav>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[#EAEAEA] pb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-white">
            <ReceiptIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111111]">
              Facturation à l&apos;Usage Réel
            </h1>
            <p className="text-xs text-[#787774]">
              Suivi transparent de vos livraisons réussies à 10 F CFA / course. 0 F d&apos;abonnement et gratuité totale sur les échecs et retours.
            </p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-48 items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-[#787774]">
              <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-ping" />
              <span>Chargement du relevé de facturation…</span>
            </div>
          </div>
        }
      >
        <CompanyBillingContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CompanyBillingContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  let overview;
  try {
    overview = await getCompanyBillingOverview(db, user, params.period);
  } catch (e) {
    if (e instanceof BillingError) {
      return (
        <div className="space-y-3">
          <div role="alert" className="rounded-xl border border-[#B45309]/20 bg-[#FFFBEB] p-5 text-xs text-[#B45309]">
            {e.message}
          </div>
          {e.code === "INVALID" && (
            <Link href="/espace/facturation" className="text-xs font-semibold text-[#C2410C] hover:underline">
              ← Revenir au mois en cours
            </Link>
          )}
        </div>
      );
    }
    throw e;
  }

  const { company, currentPeriod, statements, history } = overview;

  return (
    <div className="space-y-8">
      {/* ── BANNIÈRE TARIF EN VIGUEUR ──────────────────────────────────── */}
      <section aria-label="Tarif en vigueur" className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#787774]">
            Barème Actuel
          </span>
          <p className="text-lg font-extrabold text-[#111111]">
            {company.billingEnabled
              ? `${company.pricePerDelivery.toLocaleString("fr-FR")} F CFA par livraison livrée`
              : "Période gratuite (0 F CFA / livraison)"}
          </p>
          <p className="text-xs text-[#787774]">
            Le tarif est scellé pour chaque livraison au moment exact où la remise est validée.
          </p>
        </div>

        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs font-bold ${
            company.billingEnabled
              ? "border-[#15803D]/20 bg-[#F0FDF4] text-[#15803D]"
              : "border-[#B45309]/20 bg-[#FFFBEB] text-[#B45309]"
          }`}
        >
          {company.billingEnabled ? "✓ Facturation Active (ON)" : "Période de Test Gratuite (OFF)"}
        </span>
      </section>

      {/* ── SUIVI DU MOIS EN COURS ─────────────────────────────────────── */}
      <section aria-label="Suivi de la période" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#111111] capitalize">
            Période : {formatBillingPeriod(currentPeriod.period)}
          </h2>

          <form method="GET" action="/espace/facturation" className="flex items-center gap-2">
            <input
              type="month"
              name="period"
              defaultValue={currentPeriod.period.slice(0, 7)}
              className="h-9 rounded-lg border border-[#EAEAEA] bg-white px-3 font-mono text-xs text-[#111111] focus:border-[#C2410C] focus:outline-none"
            />
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#111111] px-3.5 text-xs font-bold text-white hover:bg-[#333] transition-colors"
            >
              Afficher
            </button>
          </form>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-xs">
            <span className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774]">
              Livraisons réussies
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-[#111111] tabular-nums">
              {currentPeriod.deliveredCount}
            </span>
          </div>

          <div className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-xs">
            <span className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774]">
              Dont forcées
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-[#787774] tabular-nums">
              {currentPeriod.forcedCount}
            </span>
          </div>

          <div className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-xs">
            <span className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774]">
              Gratuites (0 F)
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-[#15803D] tabular-nums">
              {currentPeriod.freeCount}
            </span>
          </div>

          <div className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-xs">
            <span className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774]">
              Total estimé du mois
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-[#C2410C] font-mono tabular-nums">
              {currentPeriod.totalAmount.toLocaleString("fr-FR")} F CFA
            </span>
          </div>
        </div>

        {currentPeriod.priceBreakdown.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EAEAEA] bg-[#F7F6F3] font-mono text-[10px] uppercase tracking-wider text-[#787774]">
                <tr>
                  <th className="px-5 py-3">Tarif unitaire figé</th>
                  <th className="px-4 py-3 text-right">Nombre de courses</th>
                  <th className="px-5 py-3 text-right">Sous-total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {currentPeriod.priceBreakdown.map((row) => (
                  <tr key={row.unitPrice} className="transition-colors hover:bg-[#FBFBFA]">
                    <td className="px-5 py-3 font-mono font-medium text-[#111111]">
                      {row.unitPrice.toLocaleString("fr-FR")} F CFA / course
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#111111]">{row.count}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold tabular-nums text-[#111111]">
                      {row.subtotal.toLocaleString("fr-FR")} F CFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── RELEVÉS MENSUELS OFFICIELS ─────────────────────────────────── */}
      <section aria-label="Relevés mensuels" className="space-y-3">
        <h2 className="text-sm font-bold text-[#111111]">
          Relevés Mensuels ({statements.length})
        </h2>

        {statements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#EAEAEA] bg-white p-8 text-center text-xs text-[#787774]">
            Aucun relevé mensuel émis pour l&apos;instant. Le premier relevé sera généré en fin de mois.
          </div>
        ) : (
          <ul className="rounded-xl border border-[#EAEAEA] bg-white divide-y divide-[#EAEAEA] shadow-xs">
            {statements.map((st) => (
              <li key={st.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 text-xs transition-colors hover:bg-[#FBFBFA]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-[#111111] capitalize">
                      {formatBillingPeriod(st.period)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                        st.status === "PAID"
                          ? "border-[#15803D]/20 bg-[#F0FDF4] text-[#15803D]"
                          : "border-[#B45309]/20 bg-[#FFFBEB] text-[#B45309]"
                      }`}
                    >
                      {STATEMENT_STATUS_LABEL[st.status]}
                    </span>
                  </div>
                  <p className="font-mono text-[#787774]">
                    {st.deliveredCount} livrée(s) · {st.freeCount} gratuite(s)
                    {st.issuedAt ? ` · Émis le ${formatDateTime(st.issuedAt)}` : ""}
                    {st.paidAt ? ` · Soldé le ${formatDateTime(st.paidAt)}` : ""}
                  </p>
                </div>

                <span className="font-mono text-base font-extrabold tabular-nums text-[#111111]">
                  {st.totalAmount.toLocaleString("fr-FR")} F CFA
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── HISTORIQUE DES RÉGLAGES ─────────────────────────────────────── */}
      {history.length > 0 && (
        <section aria-label="Historique des changements de tarif" className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#787774]">
            Historique des réglages tarifaires ({history.length})
          </h2>
          <ul className="rounded-xl border border-[#EAEAEA] bg-white divide-y divide-[#EAEAEA] text-xs">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-[#787774]">
                <span>
                  <span className="font-semibold text-[#111111]">{BILLING_SETTING_LABEL[h.setting]} :</span>{" "}
                  {formatBillingSettingValue(h.setting, h.oldValue)} →{" "}
                  <strong className="text-[#111111]">{formatBillingSettingValue(h.setting, h.newValue)}</strong>
                </span>
                <span className="font-mono text-[10px]">{formatDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
