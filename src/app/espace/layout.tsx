import { Suspense, type ReactNode } from "react";
import { can, userActor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/user-session";
import { getRecentNotifications } from "@/lib/notifications/notifications";
import { userLogoutAction } from "./actions";
import { NotificationBell } from "./notification-bell";
import { EspaceSidebarNav } from "./espace-nav";

// Cadre commun de l'espace entreprise.
// Le layout est synchrone (coquille statique immédiate) :
// la navigation latérale dynamique et l'authentification sont encapsulées dans Suspense.
export default function EspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-[#FBFBFA] text-[#111111]">
      <Suspense fallback={<EspaceSidebarSkeleton />}>
        <AsyncEspaceSidebar />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}

async function AsyncEspaceSidebar() {
  const user = await requireUser();
  const actor = userActor(user);
  const company = { companyId: user.companyId };
  const notifications = await getRecentNotifications(user.companyId, 15);

  const canDeliveries = can(actor, "delivery.create", company).allowed;
  const canReturns = can(actor, "return.receive", {
    companyId: user.companyId,
    status: "RETURNING",
    courierId: null,
  }).allowed;
  const canCouriers = can(actor, "couriers.manage", company).allowed;
  const canTeam = can(actor, "company.manageUsers", company).allowed;
  const canBilling = can(actor, "billing.viewStatements", company).allowed;
  const canCash = can(actor, "cash.viewHandovers", company).allowed;
  const canDisputes = can(actor, "dispute.manage", {
    companyId: user.companyId,
    status: "DELIVERED",
    courierId: null,
  }).allowed;

  return (
    <EspaceSidebarNav
      companyName={user.companyName}
      userName={user.name}
      userRoles={user.roles}
      permissions={{
        canDeliveries,
        canReturns,
        canCouriers,
        canTeam,
        canBilling,
        canCash,
        canDisputes,
      }}
      notificationBell={<NotificationBell initialNotifications={notifications} />}
      logoutAction={userLogoutAction}
    />
  );
}

function EspaceSidebarSkeleton() {
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
              <div className="h-9 w-9 rounded-xl bg-[#EAEAEA] animate-pulse" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-24 rounded bg-[#EAEAEA] animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-[#EAEAEA] animate-pulse" />
              </div>
            </div>
            <div className="h-5 w-20 rounded-full bg-[#EAEAEA] animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-8 rounded-lg bg-[#F7F6F3] animate-pulse" />
            <div className="h-8 rounded-lg bg-[#F7F6F3] animate-pulse" />
            <div className="h-8 rounded-lg bg-[#F7F6F3] animate-pulse" />
            <div className="h-8 rounded-lg bg-[#F7F6F3] animate-pulse" />
            <div className="h-8 rounded-lg bg-[#F7F6F3] animate-pulse" />
          </div>
        </div>
        <div className="border-t border-[#EAEAEA] pt-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-[#EAEAEA] animate-pulse" />
            <div className="space-y-1 flex-1">
              <div className="h-3 w-20 rounded bg-[#EAEAEA] animate-pulse" />
              <div className="h-2.5 w-14 rounded bg-[#EAEAEA] animate-pulse" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
