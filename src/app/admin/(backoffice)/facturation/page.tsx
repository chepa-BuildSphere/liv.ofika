import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/admin-session";
import {
  formatBillingPeriod,
  listAllMonthlyStatements,
  STATEMENT_STATUS_LABEL,
} from "@/lib/billing/billing";
import {
  ReceiptIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronRightIcon,
  BanknotesIcon,
} from "@/components/icons";
import { MarkPaidButton } from "./mark-paid-button";

export const metadata: Metadata = { title: "Facturation & Relevés Mensuels — Super Admin Ofika" };

export default function AdminBillingPage() {
  return (
    <div className="space-y-8">
      {/* ── BREADCRUMB & HEADER ────────────────────────────────────────── */}
      <div className="border-b border-[#EAEAEA] pb-6">
        <nav aria-label="Fil d'ariane" className="flex items-center gap-2 text-xs text-[#787774]">
          <Link href="/admin" className="hover:text-[#111111] transition-colors">
            Console Super Admin
          </Link>
          <ChevronRightIcon className="h-3.5 w-3.5" />
          <span className="font-semibold text-[#111111]">Facturation &amp; Relevés</span>
        </nav>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111]">
              Relevés mensuels consolidés
            </h1>
            <p className="mt-1 text-xs text-[#787774]">
              Suivi des 10 F CFA / livraison pour chaque enseigne, validation des encaissements et archivage officiel.
            </p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-48 items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-[#787774]">
              <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-ping" />
              <span>Chargement des relevés mensuels…</span>
            </div>
          </div>
        }
      >
        <StatementsContent />
      </Suspense>
    </div>
  );
}

async function StatementsContent() {
  const admin = await requireAdmin();
  const rows = await listAllMonthlyStatements(db, admin);

  const totalStatements = rows.length;
  const totalAmount = rows.reduce((acc, r) => acc + r.statement.totalAmount, 0);
  const paidAmount = rows
    .filter((r) => r.statement.status === "PAID")
    .reduce((acc, r) => acc + r.statement.totalAmount, 0);
  const pendingAmount = totalAmount - paidAmount;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#EAEAEA] bg-white p-12 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F3] text-[#787774]">
          <ReceiptIcon className="h-6 w-6" />
        </div>
        <h2 className="text-sm font-bold text-[#111111]">Aucun relevé mensuel généré</h2>
        <p className="max-w-md mx-auto text-xs text-[#787774] leading-relaxed">
          Les relevés mensuels sont créés automatiquement en fin de mois ou émis directement depuis la fiche de chaque entreprise.
        </p>
        <div className="pt-2">
          <Link
            href="/admin"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#111111] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#333]"
          >
            <span>Consulter les entreprises</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── METRICS FACTURATION CARDS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Facturé */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Volume Total</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F6F3] text-[#111111]">
              <BanknotesIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111] tabular-nums">
              {totalAmount.toLocaleString("fr-FR")}
            </span>
            <span className="text-xs font-semibold text-[#787774]">F CFA</span>
          </div>
          <p className="mt-1 text-[11px] text-[#787774]">
            {totalStatements} relevé(s) émis au total
          </p>
        </div>

        {/* Encaissé / Soldé */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Encaissé (Soldé)</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0FDF4] text-[#15803D]">
              <CheckCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#15803D] tabular-nums">
              {paidAmount.toLocaleString("fr-FR")}
            </span>
            <span className="text-xs font-semibold text-[#15803D]">F CFA</span>
          </div>
          <p className="mt-1 text-[11px] text-[#15803D]">
            Paiements validés et rapprochés
          </p>
        </div>

        {/* En attente de règlement */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">En attente</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFBEB] text-[#B45309]">
              <ClockIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#B45309] tabular-nums">
              {pendingAmount.toLocaleString("fr-FR")}
            </span>
            <span className="text-xs font-semibold text-[#B45309]">F CFA</span>
          </div>
          <p className="mt-1 text-[11px] text-[#787774]">
            À solder par virement ou mobile money
          </p>
        </div>
      </div>

      {/* ── TABLEAU OFFICIEL DES RELEVÉS ───────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] px-5 py-3.5 bg-[#FBFBFA]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#111111]">Historique des Relevés Mensuels</h2>
            <span className="rounded-full bg-[#111111] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              {rows.length}
            </span>
          </div>
          <span className="text-xs text-[#787774]">
            Tarif scellé à 10 F CFA / course livrée
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#EAEAEA] bg-[#F7F6F3] font-mono text-[10px] uppercase tracking-wider text-[#787774]">
              <tr>
                <th className="px-5 py-3">Entreprise Partenaire</th>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3 text-right">Livrées (10 F)</th>
                <th className="px-4 py-3 text-right">Retours (0 F)</th>
                <th className="px-4 py-3 text-right">Montant Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-5 py-3 text-right">Action Super Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA]">
              {rows.map(({ statement: st, companyName }) => (
                <tr key={st.id} className="transition-colors hover:bg-[#FBFBFA]">
                  {/* Entreprise */}
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/companies/${st.companyId}`}
                      className="font-bold text-[#111111] hover:text-[#C2410C] transition-colors"
                    >
                      {companyName}
                    </Link>
                  </td>

                  {/* Période */}
                  <td className="px-4 py-3.5 capitalize font-medium text-[#111111]">
                    {formatBillingPeriod(st.period)}
                  </td>

                  {/* Livrées */}
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#111111]">
                    {st.deliveredCount}
                  </td>

                  {/* Gratuites */}
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#787774]">
                    {st.freeCount}
                  </td>

                  {/* Montant total */}
                  <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums text-[#111111]">
                    {st.totalAmount.toLocaleString("fr-FR")} F CFA
                  </td>

                  {/* Statut */}
                  <td className="px-4 py-3.5">
                    {st.status === "PAID" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-2.5 py-0.5 font-medium text-[#15803D]">
                        <CheckCircleIcon className="h-3 w-3" />
                        <span>Soldé</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309]/20 bg-[#FFFBEB] px-2.5 py-0.5 font-medium text-[#B45309]">
                        <ClockIcon className="h-3 w-3" />
                        <span>{STATEMENT_STATUS_LABEL[st.status]}</span>
                      </span>
                    )}
                    {st.paidAt && (
                      <span className="block mt-0.5 font-mono text-[10px] text-[#787774]">
                        le {st.paidAt.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" })}
                      </span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-5 py-3.5 text-right">
                    {st.status !== "PAID" ? (
                      <MarkPaidButton statementId={st.id} />
                    ) : (
                      <span className="font-mono text-[11px] font-bold text-[#15803D]">
                        ✓ Encaissé
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
