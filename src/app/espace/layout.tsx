import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/user-session";
import { userLogoutAction } from "./actions";
import { Wordmark } from "@/components/wordmark";

// Cadre de l'espace entreprise. Chaque page revérifie aussi la session.
export default function EspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-8">
        <Suspense fallback={<Wordmark />}>
          <CompanyName />
        </Suspense>
        <Suspense fallback={null}>
          <UserMenu />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}

async function CompanyName() {
  const user = await requireUser();
  return (
    <Link href="/espace" className="leading-tight">
      <Wordmark className="block text-xs uppercase tracking-wide" />
      <span className="block font-semibold">{user.companyName}</span>
    </Link>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-3">
      {user.roles.includes("COMPANY_ADMIN") && (
        <Link href="/espace/equipe" className="link text-sm">
          Équipe
        </Link>
      )}
      <span className="hidden text-sm text-ink-muted sm:inline">{user.name}</span>
      <form action={userLogoutAction}>
        <button
          type="submit"
          className="btn-secondary"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
