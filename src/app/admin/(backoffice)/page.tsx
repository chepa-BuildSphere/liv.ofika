import { count, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { companies, couriers, deliveries, userRoles, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin-session";
import {
  BuildingOfficeIcon,
  TruckIcon,
  CheckCircleIcon,
  ReceiptIcon,
  PlusIcon,
} from "@/components/icons";
import { CompaniesTableClient } from "./companies-table-client";

export const metadata: Metadata = { title: "Super Admin Console — Ofika Delivery" };

export default function AdminHomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-[#787774]">
            <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-ping" />
            <span>Chargement de la console Super Admin…</span>
          </div>
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}

async function AdminDashboard() {
  const admin = await requireAdmin();

  const [
    [companyCount],
    [activeCompanyCount],
    [courierCount],
    [deliveryCount],
    [deliveredCount],
    list,
  ] = await Promise.all([
    db.select({ n: count() }).from(companies),
    db.select({ n: count() }).from(companies).where(eq(companies.status, "ACTIVE")),
    db.select({ n: count() }).from(couriers),
    db.select({ n: count() }).from(deliveries),
    db.select({ n: count() }).from(deliveries).where(eq(deliveries.status, "DELIVERED")),
    db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        status: companies.status,
        billingEnabled: companies.billingEnabled,
        pricePerDelivery: companies.pricePerDelivery,
        createdAt: companies.createdAt,
        activeAdmins: sql<number>`(count(*) filter (where ${userRoles.role} is not null and ${users.activatedAt} is not null))::int`,
      })
      .from(companies)
      .leftJoin(users, eq(users.companyId, companies.id))
      .leftJoin(userRoles, sql`${userRoles.userId} = ${users.id} AND ${userRoles.role} = 'COMPANY_ADMIN'`)
      .groupBy(companies.id)
      .orderBy(desc(companies.createdAt))
      .limit(100),
  ]);

  const serializedList = list.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: c.status,
    billingEnabled: c.billingEnabled,
    pricePerDelivery: c.pricePerDelivery,
    createdAt: c.createdAt.toISOString(),
    activeAdmins: c.activeAdmins,
  }));

  const todayStr = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-8">
      {/* ── ENTÊTE DU DASHBOARD SUPER ADMIN ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EAEAEA] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#15803D]" />
            <p className="font-mono text-xs uppercase tracking-wider text-[#787774] capitalize">
              {todayStr}
            </p>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111]">
            Super Admin Console
          </h1>
          <p className="mt-1 text-xs text-[#787774]">
            Pilotage global de la plateforme, gestion des marchands et facturation à l&apos;usage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/companies/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-[#9A3412] active:scale-98"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Nouvelle entreprise</span>
          </Link>
        </div>
      </div>

      {/* ── 4 KPI CARDS PRO & PREMIUM ───────────────────────────────────── */}
      <section aria-label="Indicateurs clés de performance" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 : Entreprises */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Entreprises</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F6F3] text-[#111111]">
              <BuildingOfficeIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-[#111111] tabular-nums">
              {companyCount.n}
            </span>
            <span className="text-xs text-[#787774]">inscrite(s)</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#15803D]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
            <span>{activeCompanyCount.n} active(s) sur la plateforme</span>
          </div>
        </div>

        {/* KPI 2 : Livreurs */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Flotte Livreurs</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F6F3] text-[#111111]">
              <TruckIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-[#111111] tabular-nums">
              {courierCount.n}
            </span>
            <span className="text-xs text-[#787774]">coursiers</span>
          </div>
          <div className="mt-2 text-[11px] text-[#787774]">
            Salariés &amp; Indépendants déclarés
          </div>
        </div>

        {/* KPI 3 : Livraisons */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Livraisons</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F6F3] text-[#15803D]">
              <CheckCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-[#111111] tabular-nums">
              {deliveryCount.n}
            </span>
            <span className="text-xs text-[#787774]">total créées</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#15803D]">
            <CheckCircleIcon className="h-3 w-3" />
            <span>{deliveredCount.n} livrée(s) avec preuve QR</span>
          </div>
        </div>

        {/* KPI 4 : Facturation */}
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between text-[#787774]">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Facturation</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F6F3] text-[#C2410C]">
              <ReceiptIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-[#111111] tabular-nums">
              10 F
            </span>
            <span className="text-xs text-[#787774]">CFA / course</span>
          </div>
          <div className="mt-2 text-[11px] text-[#787774]">
            Relevés mensuels consolidés
          </div>
        </div>
      </section>

      {/* ── TABLEAU INTERACTIF DES MARCHANDS ───────────────────────────── */}
      <section aria-label="Liste des entreprises partenaires">
        <CompaniesTableClient companies={serializedList} />
      </section>
    </div>
  );
}
