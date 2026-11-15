import { count, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { companies, couriers, deliveries, userRoles, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin-session";

export const metadata: Metadata = { title: "Back-office — Ofika" };

export default function AdminHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Chargement…</p>}>
      <AdminDashboard />
    </Suspense>
  );
}

async function AdminDashboard() {
  const admin = await requireAdmin();

  const [[companyCount], [courierCount], [deliveryCount], list] = await Promise.all([
    db.select({ n: count() }).from(companies),
    db.select({ n: count() }).from(couriers),
    db.select({ n: count() }).from(deliveries),
    db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        status: companies.status,
        billingEnabled: companies.billingEnabled,
        pricePerDelivery: companies.pricePerDelivery,
        createdAt: companies.createdAt,
        // Nombre d'admins entreprise ayant activé leur compte
        activeAdmins: sql<number>`(count(*) filter (where ${userRoles.role} is not null and ${users.activatedAt} is not null))::int`,
      })
      .from(companies)
      .leftJoin(users, eq(users.companyId, companies.id))
      .leftJoin(userRoles, sql`${userRoles.userId} = ${users.id} AND ${userRoles.role} = 'COMPANY_ADMIN'`)
      .groupBy(companies.id)
      .orderBy(desc(companies.createdAt))
      .limit(50),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {admin.name}</h1>
        <Link
          href="/admin/companies/new"
          className="btn-primary"
        >
          Nouvelle entreprise
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Entreprises" value={companyCount.n} />
        <Stat label="Livreurs" value={courierCount.n} />
        <Stat label="Livraisons" value={deliveryCount.n} />
      </dl>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Entreprises</h2>
        {list.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
            Aucune entreprise pour l&apos;instant.{" "}
            <Link href="/admin/companies/new" className="font-medium text-ink underline">
              Créer la première
            </Link>
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-ink-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Nom</th>
                  <th className="px-4 py-2 font-medium">Admin</th>
                  <th className="px-4 py-2 font-medium">Facturation</th>
                  <th className="px-4 py-2 font-medium">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-4 py-2">
                      <Link href={`/admin/companies/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.status === "SUSPENDED" && <span className="ml-2 text-xs text-danger">suspendue</span>}
                    </td>
                    <td className="px-4 py-2">
                      {c.activeAdmins > 0 ? (
                        <span className="text-success">Activé</span>
                      ) : (
                        <span className="text-warning">En attente d&apos;activation</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {c.billingEnabled ? `${c.pricePerDelivery} F CFA / livraison` : "Gratuite"}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{c.createdAt.toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
