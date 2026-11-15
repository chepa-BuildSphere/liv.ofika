import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { logoutAction } from "../actions";

// Cadre commun du back-office. Chaque page vérifie AUSSI la session elle-même :
// le layout ne protège pas les données (guide Next.js « Authentication »).
export default function BackofficeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 sm:px-8 dark:border-zinc-800">
        <Link href="/admin" className="leading-tight">
          <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Back-office plateforme</span>
          <span className="block font-semibold">Ofika Delivery</span>
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
  );
}
