import { Suspense, type ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { logoutAction } from "../actions";
import { AdminSidebarNav } from "./admin-nav";

// Cadre commun du back-office.
// Le layout est synchrone (coquille statique immédiate) :
// la navigation latérale dynamique et l'authentification sont encapsulées dans Suspense.
export default function BackofficeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-[#FBFBFA] text-[#111111]">
      <Suspense fallback={<AdminSidebarSkeleton />}>
        <AsyncAdminSidebar />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}

async function AsyncAdminSidebar() {
  const admin = await requireAdmin();
  return <AdminSidebarNav adminName={admin.name} logoutAction={logoutAction} />;
}

function AdminSidebarSkeleton() {
  return (
    <>
      <div className="flex lg:hidden h-14 w-full items-center justify-between border-b border-[#EAEAEA] bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#EAEAEA] animate-pulse" />
          <div className="h-4 w-24 rounded bg-[#EAEAEA] animate-pulse" />
        </div>
      </div>
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-[#EAEAEA] bg-white p-5 shrink-0 min-h-screen sticky top-0">
        <div className="space-y-6">
          <div className="border-b border-[#EAEAEA] pb-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[#EAEAEA] animate-pulse" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-20 rounded bg-[#EAEAEA] animate-pulse" />
                <div className="h-2.5 w-28 rounded bg-[#EAEAEA] animate-pulse" />
              </div>
            </div>
            <div className="h-5 w-32 rounded-full bg-[#EAEAEA] animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-9 rounded-lg bg-[#F7F6F3] animate-pulse" />
            <div className="h-9 rounded-lg bg-[#F7F6F3] animate-pulse" />
          </div>
        </div>
        <div className="border-t border-[#EAEAEA] pt-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-[#EAEAEA] animate-pulse" />
            <div className="space-y-1 flex-1">
              <div className="h-3 w-20 rounded bg-[#EAEAEA] animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-[#EAEAEA] animate-pulse" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
