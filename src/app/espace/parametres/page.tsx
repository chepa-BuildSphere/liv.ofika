import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { can, userActor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/user-session";

export const metadata: Metadata = {
  title: "Paramètres — Ofika Delivery",
};

export default function ParametresPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Chargement des paramètres…</p>}>
      <ParametresContent />
    </Suspense>
  );
}

async function ParametresContent() {
  const user = await requireUser();
  const actor = userActor(user);
  const company = { companyId: user.companyId };
  const isAdmin = can(actor, "company.manageUsers", company).allowed;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres de l&apos;entreprise</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Configuration des options de livraison, du mode test et des modules intégrés pour{" "}
          <strong>{user.companyName}</strong>.
        </p>
      </div>

      {/* Option OTP - Bientôt disponible */}
      <section className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Preuve renforcée par SMS / WhatsApp (Option OTP)</h2>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Bientôt disponible
              </span>
            </div>
            <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
              Génère et transmet un code OTP par SMS ou WhatsApp sur le téléphone du destinataire en complément
              du QR code dynamique de 3 minutes, ou permet la remise en mode « OTP seul » en cas d&apos;absence
              d&apos;internet côté client.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <label className="relative inline-flex cursor-not-allowed items-center opacity-60">
              <input type="checkbox" disabled checked={false} aria-label="Option OTP (bientôt disponible)" className="sr-only peer" />
              <div className="w-11 h-6 bg-line-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
            <span className="text-xs font-medium text-ink-muted">Désactivée</span>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-surface-elevated/70 p-4 border border-line text-xs text-ink-muted space-y-1.5">
          <p className="font-semibold text-ink">ℹ️ Statut dans le MVP :</p>
          <p>
            Cette fonctionnalité est entièrement modélisée dans la base de données (tables <code>otp_codes</code> et
            garde-fous), mais désactivée par défaut via l&apos;interrupteur côté serveur. Aucun fournisseur SMS n&apos;est
            requis pour le lancement.
          </p>
          <p>
            En cas de destinataire sans smartphone ou batterie, l&apos;administrateur de l&apos;entreprise utilise la
            fonction <strong>« Forcer Livré »</strong> avec motif obligatoire consigné au journal d&apos;audit.
          </p>
        </div>
      </section>

      {/* Mode test */}
      <section className="card p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Mode test &amp; Simulation d&apos;intégration</h2>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Actif pour les développeurs
            </span>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
            Toutes les livraisons créées avec une clé d&apos;API test (<code>ofk_test_…</code>) sont cloisonnées
            en mode test : elles ne sont <strong>jamais envoyées aux livreurs</strong>, <strong>ne sont jamais facturées</strong>,
            et peuvent progresser instantanément grâce au point de simulation <code>POST /v1/test/deliveries/&#123;id&#125;/simulate</code>.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/espace/cles-api" className="btn-secondary text-xs">
            Gérer les clés d&apos;API test &amp; live →
          </Link>
          <Link href="/espace/documentation" className="btn-secondary text-xs">
            Consulter le guide de simulation →
          </Link>
        </div>
      </section>

      {/* Accès rapides aux autres modules */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Modules &amp; Équipe</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isAdmin && (
            <Link href="/espace/equipe" className="card p-4 transition-colors hover:border-ink">
              <span className="font-semibold text-sm">Gestion de l&apos;équipe</span>
              <p className="mt-1 text-xs text-ink-muted">Inviter des collaborateurs, attribuer les rôles et révoquer les accès.</p>
            </Link>
          )}
          <Link href="/espace/webhooks" className="card p-4 transition-colors hover:border-ink">
            <span className="font-semibold text-sm">Webhooks &amp; Événements</span>
            <p className="mt-1 text-xs text-ink-muted">Configurer les URL d&apos;écoute, tester la signature HMAC et renvoyer les échecs.</p>
          </Link>
          <Link href="/espace/facturation" className="card p-4 transition-colors hover:border-ink">
            <span className="font-semibold text-sm">Facturation &amp; Relevés</span>
            <p className="mt-1 text-xs text-ink-muted">Suivi des livraisons payantes du mois en cours et relevés validés.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
