import { count, desc } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db";
import { companies, couriers, deliveries } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin-session";
import { logoutAction } from "./actions";

export const metadata: Metadata = { title: "Back-office — Ofika" };

export default function AdminHomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<p className="px-4 py-10 text-sm text-zinc-500 sm:px-8">Chargement…</p>}>
        <AdminDashboard />
      </Suspense>
    </div>
  );
}

async function AdminDashboard() {
  const admin = await requireAdmin();

  const [[companyCount], [courierCount], [deliveryCount], latest] = await Promise.all([
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
      })
      .from(companies)
      .orderBy(desc(companies.createdAt))
      .limit(20),
  ]);

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 sm:px-8 dark:border-zinc-800">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Back-office plateforme</p>
          <p className="font-semibold">Ofika Delivery</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-600 sm:inline dark:text-zinc-400">{admin.name}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="h-9 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {admin.name}</h1>

        <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Entreprises" value={companyCount.n} />
          <Stat label="Livreurs" value={courierCount.n} />
          <Stat label="Livraisons" value={deliveryCount.n} />
        </dl>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Entreprises</h2>
          {latest.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Aucune entreprise pour l&apos;instant. La création arrive à la tâche 1.2.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Nom</th>
                    <th className="px-4 py-2 font-medium">Statut</th>
                    <th className="px-4 py-2 font-medium">Facturation</th>
                    <th className="px-4 py-2 font-medium">Créée le</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((c) => (
                    <tr key={c.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-4 py-2">
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-zinc-500">{c.slug}</span>
                      </td>
                      <td className="px-4 py-2">{c.status}</td>
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
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
