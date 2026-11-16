import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { can, userActor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/user-session";
import { listTeam } from "@/lib/team/team";
import { UsersIcon, ChevronRightIcon } from "@/components/icons";
import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";

export const metadata: Metadata = { title: "Équipe & Collaborateurs — Ofika Delivery" };

export default function TeamPage() {
  return (
    <div className="space-y-6">
      {/* ── BREADCRUMB ─────────────────────────────────────────────────── */}
      <nav aria-label="Fil d'ariane" className="flex items-center gap-2 text-xs text-[#787774]">
        <Link href="/dashboard" className="hover:text-[#111111] transition-colors">
          Tableau de bord
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#111111]">Équipe &amp; Collaborateurs</span>
      </nav>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[#EAEAEA] pb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-white">
            <UsersIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111111]">
              Gestion de l&apos;Équipe
            </h1>
            <p className="text-xs text-[#787774]">
              Invitez vos collaborateurs, attribuez les permissions (Admin, Gestionnaire, Resp. Retours) et gérez les accès.
            </p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-48 items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-[#787774]">
              <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-ping" />
              <span>Chargement des collaborateurs…</span>
            </div>
          </div>
        }
      >
        <Team />
      </Suspense>
    </div>
  );
}

async function Team() {
  const user = await requireUser();

  if (!can(userActor(user), "company.manageUsers", { companyId: user.companyId }).allowed) {
    return (
      <div role="alert" className="rounded-xl border border-[#B45309]/20 bg-[#FFFBEB] p-5 text-xs text-[#B45309]">
        La gestion des membres de l&apos;équipe est strictement réservée à l&apos;administrateur de l&apos;entreprise.
      </div>
    );
  }

  const members = await listTeam(db, user);

  return (
    <div className="space-y-8">
      {/* Formulaire d'invitation d'un membre */}
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-6 shadow-xs">
        <InviteForm />
      </div>

      {/* Liste des membres */}
      <section aria-label="Membres de l'équipe" className="space-y-3">
        <h2 className="text-sm font-bold text-[#111111]">
          Membres Actifs ({members.length})
        </h2>

        <ul className="rounded-xl border border-[#EAEAEA] bg-white divide-y divide-[#EAEAEA] shadow-xs">
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
                activated: Boolean(m.activatedAt),
                pendingLinkExpiresAt: m.pendingLinkExpiresAt ? m.pendingLinkExpiresAt.toISOString() : null,
                isSelf: m.id === user.id,
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
