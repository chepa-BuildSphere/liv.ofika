"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  TrendingUpIcon,
  PackageIcon,
  TruckIcon,
  AlertTriangleIcon,
  UsersIcon,
  ReceiptIcon,
  KeyIcon,
  PlusIcon,
  LogOutIcon,
  BuildingOfficeIcon,
} from "@/components/icons";

interface EspaceNavProps {
  companyName: string;
  userName: string;
  userRoles: string[];
  permissions: {
    canDeliveries: boolean;
    canReturns: boolean;
    canCouriers: boolean;
    canTeam: boolean;
    canBilling: boolean;
    canCash?: boolean;
    canDisputes?: boolean;
  };
  notificationBell: ReactNode;
  logoutAction: () => Promise<void>;
}

const ROLE_DISPLAY: Record<string, { label: string; badgeClass: string }> = {
  COMPANY_ADMIN: {
    label: "Admin Entreprise",
    badgeClass: "bg-[#FFF7ED] text-[#C2410C] border-[#FFEDD5]",
  },
  MANAGER: {
    label: "Gestionnaire",
    badgeClass: "bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]",
  },
  RETURNS_OFFICER: {
    label: "Resp. Retours",
    badgeClass: "bg-[#FFFBEB] text-[#B45309] border-[#FEF3C7]",
  },
};

export function EspaceSidebarNav({
  companyName,
  userName,
  userRoles,
  permissions,
  notificationBell,
  logoutAction,
}: EspaceNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initial = companyName.slice(0, 1).toUpperCase();
  const primaryRole = userRoles[0] ?? "COMPANY_ADMIN";
  const roleMeta = ROLE_DISPLAY[primaryRole] ?? {
    label: primaryRole,
    badgeClass: "bg-[#F7F6F3] text-[#787774] border-[#EAEAEA]",
  };

  const isDashboardActive = pathname === "/espace" || pathname === "/dashboard";
  const isDeliveriesActive = pathname.startsWith("/espace/livraisons");
  const isReturnsActive = pathname.startsWith("/espace/retours");
  const isCouriersActive = pathname.startsWith("/espace/livreurs");
  const isTeamActive = pathname.startsWith("/espace/equipe");
  const isBillingActive = pathname.startsWith("/espace/facturation");
  const isCashActive = pathname.startsWith("/espace/encaissements");
  const isDisputesActive = pathname.startsWith("/espace/litiges");
  const isApiActive = pathname.startsWith("/espace/cles-api") || pathname.startsWith("/espace/webhooks");
  const isSettingsActive = pathname.startsWith("/espace/parametres");
  const isDocsActive = pathname.startsWith("/espace/documentation");

  return (
    <>
      {/* ── BARRE MOBILE ESPACE ENTREPRISE ───────────────────────────── */}
      <div className="flex lg:hidden items-center justify-between border-b border-[#EAEAEA] bg-white px-4 py-3 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#EAEAEA] text-[#111111] hover:bg-[#F7F6F3]"
            aria-label="Ouvrir le menu de navigation"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <div>
            <span className="block font-bold text-xs text-[#111111] truncate max-w-[150px]">
              {companyName}
            </span>
            <span className="block font-mono text-[9px] uppercase tracking-wider text-[#C2410C]">
              {roleMeta.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {notificationBell}
          {permissions.canDeliveries && (
            <Link
              href="/espace/livraisons"
              className="inline-flex h-8 items-center gap-1 rounded-md bg-[#C2410C] px-2.5 text-[11px] font-bold text-white shadow-xs"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Colis</span>
            </Link>
          )}
        </div>
      </div>

      {/* Menu mobile déroulant */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 top-15 z-30 bg-black/40 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-72 bg-white h-full border-r border-[#EAEAEA] p-5 flex flex-col justify-between shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5 overflow-y-auto">
              <div>
                <span className="block font-bold text-sm text-[#111111]">{companyName}</span>
                <span className={`inline-block mt-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${roleMeta.badgeClass}`}>
                  {roleMeta.label}
                </span>
              </div>

              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                    isDashboardActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                  }`}
                >
                  <TrendingUpIcon className="h-4 w-4" />
                  <span>Tableau de bord</span>
                </Link>

                {permissions.canDeliveries && (
                  <Link
                    href="/espace/livraisons"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                      isDeliveriesActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                    }`}
                  >
                    <PackageIcon className="h-4 w-4" />
                    <span>Livraisons</span>
                  </Link>
                )}

                {permissions.canReturns && (
                  <Link
                    href="/espace/retours"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                      isReturnsActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                    }`}
                  >
                    <AlertTriangleIcon className="h-4 w-4" />
                    <span>Retours dépôt</span>
                  </Link>
                )}

                {permissions.canCouriers && (
                  <Link
                    href="/espace/livreurs"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                      isCouriersActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                    }`}
                  >
                    <TruckIcon className="h-4 w-4" />
                    <span>Livreurs</span>
                  </Link>
                )}

                {permissions.canTeam && (
                  <Link
                    href="/espace/equipe"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                      isTeamActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                    }`}
                  >
                    <UsersIcon className="h-4 w-4" />
                    <span>Équipe</span>
                  </Link>
                )}

                {permissions.canBilling && (
                  <Link
                    href="/espace/facturation"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                      isBillingActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                    }`}
                  >
                    <ReceiptIcon className="h-4 w-4" />
                    <span>Facturation (10 F)</span>
                  </Link>
                )}

                {permissions.canCash && (
                  <Link
                    href="/espace/encaissements"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                      isCashActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                    }`}
                  >
                    <ReceiptIcon className="h-4 w-4" />
                    <span>Encaissements (COD)</span>
                  </Link>
                )}

                {permissions.canDisputes && (
                  <Link
                    href="/espace/litiges"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                      isDisputesActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                    }`}
                  >
                    <AlertTriangleIcon className="h-4 w-4" />
                    <span>Litiges &amp; Contentieux</span>
                  </Link>
                )}

                <Link
                  href="/espace/cles-api"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                    isApiActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                  }`}
                >
                  <KeyIcon className="h-4 w-4" />
                  <span>Clés API &amp; Webhooks</span>
                </Link>

                <Link
                  href="/espace/parametres"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                    isSettingsActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                  }`}
                >
                  <span>Paramètres</span>
                </Link>

                <Link
                  href="/espace/documentation"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                    isDocsActive ? "bg-[#111111] text-white" : "text-[#555] hover:bg-[#F7F6F3]"
                  }`}
                >
                  <span>Docs API</span>
                </Link>
              </div>
            </div>

            <div className="border-t border-[#EAEAEA] pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#111111]">{userName}</p>
                  <p className="text-[10px] text-[#787774]">{roleMeta.label}</p>
                </div>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[#EAEAEA] text-[#787774] hover:text-[#DC2626]"
                    title="Déconnexion"
                  >
                    <LogOutIcon className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR DESKTOP PREMIUM POUR ESPACE ENTREPRISE ────────────── */}
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-[#EAEAEA] bg-white p-5 shrink-0 min-h-screen sticky top-0">
        <div className="space-y-6">
          {/* En-tête Enseigne & Rôle */}
          <div className="border-b border-[#EAEAEA] pb-5">
            <Link href="/dashboard" className="group block">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111111] text-white font-extrabold text-sm shadow-xs group-hover:bg-[#C2410C] transition-colors">
                  {initial}
                </span>
                <div className="overflow-hidden">
                  <span className="block font-extrabold tracking-tight text-sm text-[#111111] truncate group-hover:text-[#C2410C] transition-colors">
                    {companyName}
                  </span>
                  <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-[#787774]">
                    Ofika Entreprise
                  </span>
                </div>
              </div>
            </Link>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${roleMeta.badgeClass}`}>
                {roleMeta.label}
              </span>
              <div className="shrink-0">{notificationBell}</div>
            </div>
          </div>

          {/* Navigation groupée */}
          <div className="space-y-4">
            {/* Groupe 1 : Activité quotidienne */}
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774] px-2">
                Activité Terrain
              </p>
              <Link
                href="/dashboard"
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  isDashboardActive
                    ? "bg-[#111111] text-white shadow-xs"
                    : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUpIcon className="h-4 w-4" />
                  <span>Tableau de bord</span>
                </div>
                {isDashboardActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
              </Link>

              {permissions.canDeliveries && (
                <Link
                  href="/espace/livraisons"
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    isDeliveriesActive
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <PackageIcon className="h-4 w-4" />
                    <span>Livraisons</span>
                  </div>
                  {isDeliveriesActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
                </Link>
              )}

              {permissions.canReturns && (
                <Link
                  href="/espace/retours"
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    isReturnsActive
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <span>Retours au dépôt</span>
                  </div>
                  {isReturnsActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
                </Link>
              )}
            </div>

            {/* Groupe 2 : Flotte & Équipe */}
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774] px-2">
                Ressources
              </p>
              {permissions.canCouriers && (
                <Link
                  href="/espace/livreurs"
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    isCouriersActive
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <TruckIcon className="h-4 w-4" />
                    <span>Flotte Livreurs</span>
                  </div>
                  {isCouriersActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
                </Link>
              )}

              {permissions.canTeam && (
                <Link
                  href="/espace/equipe"
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    isTeamActive
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <UsersIcon className="h-4 w-4" />
                    <span>Équipe &amp; Rôles</span>
                  </div>
                  {isTeamActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
                </Link>
              )}
            </div>

            {/* Groupe 3 : Gestion & Intégration */}
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774] px-2">
                Gestion &amp; Outils
              </p>
              {permissions.canBilling && (
                <Link
                  href="/espace/facturation"
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    isBillingActive
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ReceiptIcon className="h-4 w-4" />
                    <span>Facturation (10 F)</span>
                  </div>
                  {isBillingActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
                </Link>
              )}

              {permissions.canCash && (
                <Link
                  href="/espace/encaissements"
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    isCashActive
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ReceiptIcon className="h-4 w-4" />
                    <span>Encaissements (COD)</span>
                  </div>
                  {isCashActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
                </Link>
              )}

              {permissions.canDisputes && (
                <Link
                  href="/espace/litiges"
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    isDisputesActive
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <span>Litiges &amp; Contentieux</span>
                  </div>
                  {isDisputesActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
                </Link>
              )}

              <Link
                href="/espace/cles-api"
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  isApiActive
                    ? "bg-[#111111] text-white shadow-xs"
                    : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <KeyIcon className="h-4 w-4" />
                  <span>Clés API &amp; Webhooks</span>
                </div>
                {isApiActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
              </Link>

              <Link
                href="/espace/parametres"
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  isSettingsActive
                    ? "bg-[#111111] text-white shadow-xs"
                    : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                }`}
              >
                <span>Paramètres</span>
                {isSettingsActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
              </Link>

              <Link
                href="/espace/documentation"
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  isDocsActive
                    ? "bg-[#111111] text-white shadow-xs"
                    : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                }`}
              >
                <span>Documentation API</span>
                {isDocsActive && <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />}
              </Link>
            </div>
          </div>

          {/* Raccourci action rapide */}
          {permissions.canDeliveries && (
            <div className="rounded-xl border border-[#EAEAEA] bg-[#FBFBFA] p-3 space-y-2">
              <p className="text-[11px] font-bold text-[#111111]">Nouvelle Expédition</p>
              <p className="text-[10px] text-[#787774] leading-relaxed">
                Créez une course ou importez un fichier Excel pour vos tournées.
              </p>
              <Link
                href="/espace/livraisons"
                className="inline-flex w-full h-8 items-center justify-center gap-1.5 rounded-lg bg-[#C2410C] text-[11px] font-bold text-white shadow-xs hover:bg-[#9A3412] transition-colors"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>Créer une livraison</span>
              </Link>
            </div>
          )}
        </div>

        {/* Profil utilisateur connecté & Déconnexion */}
        <div className="border-t border-[#EAEAEA] pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white font-bold text-xs">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-bold text-[#111111]">{userName}</p>
                <p className="font-mono text-[10px] text-[#787774]">{roleMeta.label}</p>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#EAEAEA] text-[#787774] hover:border-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors"
                title="Se déconnecter"
              >
                <LogOutIcon className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
