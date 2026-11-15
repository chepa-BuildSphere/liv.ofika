import { db } from "@/db";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import { listSupportViews } from "@/lib/support/support-view";

// Règle 9 : l'entreprise voit chaque consultation de ses données par le support Ofika.
export async function SupportViews({ user }: { user: CompanyUserIdentity }) {
  const views = await listSupportViews(db, user, 20);
  if (views === null) return null; // pas le droit de consulter le journal

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Consultations du support Ofika</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Chaque fois que l&apos;équipe Ofika consulte les données de votre entreprise, c&apos;est enregistré ici.
      </p>
      {views.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">
          Aucune consultation pour l&apos;instant.
        </p>
      ) : (
        <ul className="card mt-3 divide-y divide-line text-sm">
          {views.map((v, i) => (
            <li key={i} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span>
                <span className="font-medium">{v.adminName}</span>
                <span className="text-ink-muted"> · {v.what}</span>
              </span>
              <time className="tabular-nums text-ink-muted" dateTime={v.at.toISOString()}>
                {v.at.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Abidjan" })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
