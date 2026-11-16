import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { can, userActor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/user-session";
import { ROLE_LABEL } from "./equipe/roles";
import { SupportViews } from "./support-views";

export const metadata: Metadata = { title: "Mon espace — Ofika Delivery" };

export default function EspacePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Chargement…</p>}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const user = await requireUser();
  const actor = userActor(user);
  const company = { companyId: user.companyId };
  const canDeliveries = can(actor, "delivery.create", company).allowed;
  const canCouriers = can(actor, "couriers.manage", company).allowed;
  const canTeam = can(actor, "company.manageUsers", company).allowed;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Bonjour {user.name}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Vous êtes connecté à l&apos;espace de <strong>{user.companyName}</strong>
        {user.roles.length > 0 && <> en tant que {user.roles.map((r) => ROLE_LABEL[r]).join(" et ")}</>}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {canDeliveries && (
          <Link href="/espace/livraisons" className="card flex flex-col gap-1 p-5 transition-colors hover:border-ink">
            <span className="font-semibold">Livraisons</span>
            <span className="text-sm text-ink-muted">Créer et suivre les livraisons de l&apos;entreprise.</span>
          </Link>
        )}
        {canCouriers && (
          <Link href="/espace/livreurs" className="card flex flex-col gap-1 p-5 transition-colors hover:border-ink">
            <span className="font-semibold">Livreurs</span>
            <span className="text-sm text-ink-muted">Ajouter, rattacher, détacher et gérer les codes d&apos;accès.</span>
          </Link>
        )}
        {canTeam && (
          <Link href="/espace/equipe" className="card flex flex-col gap-1 p-5 transition-colors hover:border-ink">
            <span className="font-semibold">Équipe</span>
            <span className="text-sm text-ink-muted">Inviter des collaborateurs et gérer leurs rôles.</span>
          </Link>
        )}
      </div>

      {!canDeliveries && !canCouriers && !canTeam && (
        <p className="mt-8 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
          La réception des retours arrive dans les prochaines étapes.
        </p>
      )}
      <SupportViews user={user} />
    </>
  );
}
