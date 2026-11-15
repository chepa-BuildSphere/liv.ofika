import { and, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { companies, userAccessTokens, userRoles, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin-session";
import { RegenerateLink } from "./regenerate-link";

export const metadata: Metadata = { title: "Entreprise — Ofika" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: "Admin entreprise",
  MANAGER: "Gestionnaire",
  RETURNS_OFFICER: "Resp. retours",
};

export default function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← Tableau de bord
      </Link>
      <Suspense fallback={<p className="mt-4 text-sm text-zinc-500">Chargement…</p>}>
        <CompanyDetail params={params} />
      </Suspense>
    </>
  );
}

async function CompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) notFound();

  const members = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, activatedAt: users.activatedAt, isActive: users.isActive })
    .from(users)
    .where(eq(users.companyId, company.id))
    .orderBy(users.createdAt);

  const ids = members.map((m) => m.id);
  const [roles, tokens] = ids.length
    ? await Promise.all([
        db.select().from(userRoles).where(inArray(userRoles.userId, ids)),
        db
          .select({ userId: userAccessTokens.userId, expiresAt: userAccessTokens.expiresAt, usedAt: userAccessTokens.usedAt, revokedAt: userAccessTokens.revokedAt })
          .from(userAccessTokens)
          .where(and(inArray(userAccessTokens.userId, ids), eq(userAccessTokens.purpose, "ACTIVATION")))
          .orderBy(desc(userAccessTokens.createdAt)),
      ])
    : [[], []];

  const now = new Date();

  return (
    <>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{company.name}</h1>
      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <Info label="Identifiant" value={company.slug} />
        <Info label="Statut" value={company.status === "ACTIVE" ? "Active" : "Suspendue"} />
        <Info label="Téléphone" value={company.phone ?? "—"} />
        <Info
          label="Facturation"
          value={company.billingEnabled ? `${company.pricePerDelivery} F CFA / livraison` : "Gratuite"}
        />
        <Info label="Créée le" value={company.createdAt.toLocaleDateString("fr-FR")} />
      </dl>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Utilisateurs</h2>
        <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((m) => {
            const latest = tokens.find((t) => t.userId === m.id);
            const linkValid = latest && !latest.usedAt && !latest.revokedAt && latest.expiresAt > now;
            return (
              <li key={m.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {m.email}
                    {m.phone && ` · ${m.phone}`}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {roles
                      .filter((r) => r.userId === m.id)
                      .map((r) => ROLE_LABEL[r.role] ?? r.role)
                      .join(", ")}
                  </p>
                  <p className="mt-1 text-xs">
                    {m.activatedAt ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Compte activé le {m.activatedAt.toLocaleDateString("fr-FR")}
                      </span>
                    ) : linkValid ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        En attente : lien valable jusqu&apos;au{" "}
                        {latest.expiresAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    ) : (
                      <span className="text-red-700 dark:text-red-400">Lien expiré : générez-en un nouveau</span>
                    )}
                  </p>
                </div>
                {!m.activatedAt && m.isActive && (
                  <div className="sm:max-w-sm">
                    <RegenerateLink userId={m.id} userName={m.name} userPhone={m.phone} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500">{label} :</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
