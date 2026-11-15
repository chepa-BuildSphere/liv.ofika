import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import { listTeam } from "@/lib/team/team";
import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";

export const metadata: Metadata = { title: "Équipe — Ofika Delivery" };

export default function TeamPage() {
  return (
    <>
      <Link href="/espace" className="text-sm text-ink-muted hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Équipe</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-ink-muted">Chargement…</p>}>
        <Team />
      </Suspense>
    </>
  );
}

async function Team() {
  const user = await requireUser();

  if (!user.roles.includes("COMPANY_ADMIN")) {
    return (
      <p role="alert" className="mt-6 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
        La gestion de l&apos;équipe est réservée à l&apos;admin de l&apos;entreprise.
      </p>
    );
  }

  const members = await listTeam(db, user);

  return (
    <>
      <p className="mt-2 text-sm text-ink-muted">
        Invitez vos collègues et choisissez leurs rôles. Une personne peut cumuler plusieurs rôles.
      </p>
      <div className="mt-6">
        <InviteForm />
      </div>
      <ul className="card mt-6 divide-y divide-line">
        {members.map((m) => (
          <MemberRow
            key={m.id}
            m={{
              id: m.id,
              name: m.name,
              email: m.email,
              phone: m.phone,
              roles: m.roles,
              isActive: m.isActive,
              activated: !!m.activatedAt,
              pendingLinkExpiresAt: m.pendingLinkExpiresAt?.toISOString() ?? null,
              isSelf: m.id === user.id,
            }}
          />
        ))}
      </ul>
    </>
  );
}
