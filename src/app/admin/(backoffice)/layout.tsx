import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { logoutAction } from "../actions";
import { Wordmark } from "@/components/wordmark";

// Cadre commun du back-office. Chaque page vérifie AUSSI la session elle-même :
// le layout ne protège pas les données (guide Next.js « Authentication »).
export default function BackofficeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-8">
        <Link href="/admin" className="leading-tight">
          <span className="block text-xs font-medium uppercase tracking-wide text-ink-muted">Back-office plateforme</span>
          <Wordmark className="block" />
        </Link>
        <Suspense fallback={null}>
          <AdminMenu />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}

async function AdminMenu() {
  const admin = await requireAdmin();
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-ink-muted sm:inline">{admin.name}</span>
      <form action={logoutAction}>
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
