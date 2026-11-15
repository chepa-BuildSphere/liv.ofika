import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/user-session";
import { userLogoutAction } from "./actions";

// Cadre de l'espace entreprise. Chaque page revérifie aussi la session.
export default function EspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 sm:px-8 dark:border-zinc-800">
        <Suspense fallback={<span className="font-semibold">Ofika Delivery</span>}>
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
      <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Ofika Delivery</span>
      <span className="block font-semibold">{user.companyName}</span>
    </Link>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-zinc-600 sm:inline dark:text-zinc-400">{user.name}</span>
      <form action={userLogoutAction}>
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
