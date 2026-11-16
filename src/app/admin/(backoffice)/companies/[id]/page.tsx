import { and, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { companies, userAccessTokens, userRoles, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin-session";
import { getAdminCompanyBillingOverview } from "@/lib/billing/billing";
import { getRequestMeta } from "@/lib/request-meta";
import { logSupportView } from "@/lib/support/support-view";
import {
  BuildingOfficeIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  PhoneIcon,
  UsersIcon,
  ReceiptIcon,
} from "@/components/icons";
import { BillingSection } from "./billing-section";
import { RegenerateLink } from "./regenerate-link";

export const metadata: Metadata = { title: "Fiche Entreprise — Super Admin Ofika" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: "Admin Entreprise",
  MANAGER: "Gestionnaire",
  RETURNS_OFFICER: "Resp. Retours",
};

export default function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-48 items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-[#787774]">
            <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-ping" />
            <span>Chargement du dossier entreprise…</span>
          </div>
        </div>
      }
    >
      <CompanyDetail params={params} />
    </Suspense>
  );
}

async function CompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) notFound();

  // Règle 9 : consultation support journalisée, visible par l'entreprise
  await logSupportView(db, {
    platformAdmin: admin,
    companyId: company.id,
    view: "company_detail",
    ...(await getRequestMeta()),
  });

  const billingOverview = await getAdminCompanyBillingOverview(db, admin, company.id);

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      activatedAt: users.activatedAt,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.companyId, company.id))
    .orderBy(users.createdAt);

  const ids = members.map((m) => m.id);
  const [roles, tokens] = ids.length
    ? await Promise.all([
        db.select().from(userRoles).where(inArray(userRoles.userId, ids)),
        db
          .select({
            userId: userAccessTokens.userId,
            expiresAt: userAccessTokens.expiresAt,
            usedAt: userAccessTokens.usedAt,
            revokedAt: userAccessTokens.revokedAt,
          })
          .from(userAccessTokens)
          .where(and(inArray(userAccessTokens.userId, ids), eq(userAccessTokens.purpose, "ACTIVATION")))
          .orderBy(desc(userAccessTokens.createdAt)),
      ])
    : [[], []];

  const now = new Date();
  const initial = company.name.slice(0, 1).toUpperCase();

  return (
    <div className="space-y-8">
      {/* ── BREADCRUMB ─────────────────────────────────────────────────── */}
      <nav aria-label="Fil d'ariane" className="flex items-center gap-2 text-xs text-[#787774]">
        <Link href="/admin" className="hover:text-[#111111] transition-colors">
          Console Super Admin
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <Link href="/admin" className="hover:text-[#111111] transition-colors">
          Entreprises
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#111111]">{company.name}</span>
      </nav>

      {/* ── ENTÊTE DE L'ENTREPRISE ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-xl border border-[#EAEAEA] bg-white p-6 shadow-xs">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-xl font-black text-white shadow-xs">
            {initial}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#111111]">
                {company.name}
              </h1>
              {company.status === "ACTIVE" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-semibold text-[#15803D]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
                  <span>Entreprise Active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DC2626]/20 bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-semibold text-[#DC2626]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                  <span>Suspendue</span>
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-[#787774]">
              Identifiant système : ofika://{company.slug}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#787774]">
              <ShieldCheckIcon className="h-3.5 w-3.5 text-[#15803D]" />
              <span>Consultation support sécurisée enregistrée au journal d&apos;audit.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── GRILLE DES MÉTADONNÉES TECHNIQUES ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Statut & Slug */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-xs">
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774]">
            Enseigne
          </span>
          <p className="mt-1 font-bold text-sm text-[#111111]">{company.slug}</p>
          <p className="mt-0.5 text-[11px] text-[#787774]">Préfixe des identifiants</p>
        </div>

        {/* Téléphone WhatsApp */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-xs">
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774]">
            Contact
          </span>
          <p className="mt-1 font-mono font-bold text-sm text-[#111111]">
            {company.phone ?? "Non renseigné"}
          </p>
          <p className="mt-0.5 text-[11px] text-[#787774]">Ligne directe marchand</p>
        </div>

        {/* Facturation barème */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-xs">
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774]">
            Barème de course
          </span>
          <p className="mt-1 font-mono font-bold text-sm text-[#111111]">
            {company.billingEnabled ? `${company.pricePerDelivery} F CFA` : "0 F (Gratuit)"}
          </p>
          <p className="mt-0.5 text-[11px] text-[#15803D]">
            {company.billingEnabled ? "Par livraison réussie" : "Période de test"}
          </p>
        </div>

        {/* Date d'inscription */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-xs">
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774]">
            Inscription
          </span>
          <p className="mt-1 font-mono font-bold text-sm text-[#111111]">
            {company.createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
          <p className="mt-0.5 text-[11px] text-[#787774]">Date de validation</p>
        </div>
      </div>

      {/* ── SECTION UTILISATEURS & ADMINS ──────────────────────────────── */}
      <section aria-label="Membres et administrateurs" className="rounded-xl border border-[#EAEAEA] bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] bg-[#FBFBFA] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-[#111111]" />
            <h2 className="text-sm font-bold text-[#111111]">Utilisateurs de l&apos;Entreprise</h2>
            <span className="rounded-full bg-[#111111] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              {members.length}
            </span>
          </div>
          <span className="text-xs text-[#787774]">
            Admins, Gestionnaires et Responsables des retours
          </span>
        </div>

        <ul className="divide-y divide-[#EAEAEA]">
          {members.map((m) => {
            const latest = tokens.find((t) => t.userId === m.id);
            const linkValid = latest && !latest.usedAt && !latest.revokedAt && latest.expiresAt > now;

            return (
              <li
                key={m.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-[#FBFBFA]"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-[#111111]">{m.name}</span>
                    {roles
                      .filter((r) => r.userId === m.id)
                      .map((r) => (
                        <span
                          key={r.role}
                          className="rounded-full bg-[#F7F6F3] border border-[#EAEAEA] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#555]"
                        >
                          {ROLE_LABEL[r.role] ?? r.role}
                        </span>
                      ))}
                  </div>

                  <p className="font-mono text-xs text-[#787774]">
                    {m.email}
                    {m.phone && ` · ${m.phone}`}
                  </p>

                  <div className="pt-1">
                    {m.activatedAt ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#15803D]">
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        <span>Compte activé le {m.activatedAt.toLocaleDateString("fr-FR")}</span>
                      </span>
                    ) : linkValid ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#B45309]">
                        <ClockIcon className="h-3.5 w-3.5" />
                        <span>
                          En attente : lien valable jusqu&apos;au{" "}
                          {latest.expiresAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#DC2626]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                        <span>Lien d&apos;activation expiré : régénérez un lien ci-contre</span>
                      </span>
                    )}
                  </div>
                </div>

                {!m.activatedAt && m.isActive && (
                  <div className="sm:max-w-sm shrink-0">
                    <RegenerateLink userId={m.id} userName={m.name} userPhone={m.phone} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── SECTION FACTURATION À L'USAGE DE L'ENTREPRISE ──────────────── */}
      <BillingSection overview={billingOverview} />
    </div>
  );
}
