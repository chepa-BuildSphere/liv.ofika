"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BuildingOfficeIcon,
  ReceiptIcon,
  PlusIcon,
  LogOutIcon,
  ShieldCheckIcon,
} from "@/components/icons";

interface AdminNavProps {
  adminName: string;
  logoutAction: () => Promise<void>;
}

export function AdminSidebarNav({ adminName, logoutAction }: AdminNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isCompaniesActive =
    pathname === "/admin" || pathname.startsWith("/admin/companies");
  const isBillingActive = pathname.startsWith("/admin/facturation");

  return (
    <>
      {/* ── BARRE MOBILE SUPER ADMIN ──────────────────────────────────── */}
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
            <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#C2410C]">
              Super Admin
            </span>
            <span className="text-xs font-bold text-[#111111]">Ofika Platform</span>
          </div>
        </div>

        <Link
          href="/admin/companies/new"
          className="inline-flex h-8 items-center gap-1 rounded-md bg-[#C2410C] px-2.5 text-[11px] font-bold text-white shadow-xs"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          <span>Entreprise</span>
        </Link>
      </div>

      {/* Menu mobile déroulant */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-15 z-30 bg-black/40 backdrop-blur-xs" onClick={() => setMobileOpen(false)}>
          <div
            className="w-72 bg-white h-full border-r border-[#EAEAEA] p-5 flex flex-col justify-between shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div>
                <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774]">
                  Navigation Plateforme
                </p>
                <div className="mt-3 space-y-1">
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      isCompaniesActive
                        ? "bg-[#111111] text-white"
                        : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                    }`}
                  >
                    <BuildingOfficeIcon className="h-4 w-4" />
                    <span>Entreprises partenaires</span>
                  </Link>
                  <Link
                    href="/admin/facturation"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      isBillingActive
                        ? "bg-[#111111] text-white"
                        : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
                    }`}
                  >
                    <ReceiptIcon className="h-4 w-4" />
                    <span>Facturation &amp; Relevés</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-[#EAEAEA] pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#111111]">{adminName}</p>
                  <p className="text-[10px] text-[#787774]">Super Admin</p>
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

      {/* ── SIDEBAR DESKTOP PREMIUM ─────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-[#EAEAEA] bg-white p-5 shrink-0 min-h-screen sticky top-0">
        <div className="space-y-6">
          {/* Logo & Badge Super Admin */}
          <div className="border-b border-[#EAEAEA] pb-5">
            <Link href="/admin" className="group block">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111111] text-white font-black text-sm shadow-xs">
                  O
                </span>
                <div>
                  <span className="font-extrabold tracking-tight text-base text-[#111111] group-hover:text-[#C2410C] transition-colors">
                    OFIKA
                  </span>
                  <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-[#787774]">
                    Super Admin Console
                  </span>
                </div>
              </div>
            </Link>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-2.5 py-0.5 text-[10px] font-semibold text-[#15803D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#15803D] animate-pulse" />
                <span>Base Neon Connectée</span>
              </span>
            </div>
          </div>

          {/* Navigation links */}
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#787774] px-2 mb-2">
              Plateforme &amp; Métiers
            </p>
            <Link
              href="/admin"
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                isCompaniesActive
                  ? "bg-[#111111] text-white shadow-xs"
                  : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BuildingOfficeIcon className="h-4 w-4" />
                <span>Entreprises</span>
              </div>
              {isCompaniesActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />
              )}
            </Link>

            <Link
              href="/admin/facturation"
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                isBillingActive
                  ? "bg-[#111111] text-white shadow-xs"
                  : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ReceiptIcon className="h-4 w-4" />
                <span>Facturation &amp; Relevés</span>
              </div>
              {isBillingActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />
              )}
            </Link>
          </div>

          {/* Raccourci action rapide */}
          <div className="rounded-xl border border-[#EAEAEA] bg-[#FBFBFA] p-3 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#111111]">
              <ShieldCheckIcon className="h-4 w-4 text-[#C2410C]" />
              <span>Gestion Partenaire</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#787774]">
              Créez une nouvelle entreprise ou modifiez son barème de facturation.
            </p>
            <Link
              href="/admin/companies/new"
              className="inline-flex w-full h-8 items-center justify-center gap-1.5 rounded-lg bg-[#C2410C] text-[11px] font-bold text-white shadow-xs hover:bg-[#9A3412] transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Nouvelle entreprise</span>
            </Link>
          </div>
        </div>

        {/* Profil admin footer */}
        <div className="border-t border-[#EAEAEA] pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white font-bold text-xs">
                {adminName.slice(0, 2).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-bold text-[#111111]">{adminName}</p>
                <p className="font-mono text-[10px] text-[#787774]">Super Admin</p>
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
