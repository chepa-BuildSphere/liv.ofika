"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  SearchIcon,
  BuildingOfficeIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
} from "@/components/icons";

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | string;
  billingEnabled: boolean;
  pricePerDelivery: number;
  createdAt: string;
  activeAdmins: number;
}

export function CompaniesTableClient({ companies }: { companies: CompanyRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [billingFilter, setBillingFilter] = useState<"ALL" | "BILLING" | "FREE">("ALL");

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const matchSearch =
        search.trim() === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" || c.status === statusFilter;

      const matchBilling =
        billingFilter === "ALL" ||
        (billingFilter === "BILLING" ? c.billingEnabled : !c.billingEnabled);

      return matchSearch && matchStatus && matchBilling;
    });
  }, [companies, search, statusFilter, billingFilter]);

  return (
    <div className="space-y-4">
      {/* ── BARRE DE RECHERCHE ET FILTRES ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#EAEAEA] bg-white p-3 shadow-xs">
        {/* Champ de recherche */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#787774]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, enseigne ou identifiant…"
            className="w-full h-10 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] pl-9 pr-3 text-xs text-[#111111] placeholder:text-[#787774] focus:border-[#C2410C] focus:bg-white focus:outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#787774] hover:text-[#111111]"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Filtres de sélection rapide */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "SUSPENDED")}
            className="h-10 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] px-3 text-xs font-medium text-[#111111] focus:border-[#C2410C] focus:outline-none cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actives uniquement</option>
            <option value="SUSPENDED">Suspendues</option>
          </select>

          <select
            value={billingFilter}
            onChange={(e) => setBillingFilter(e.target.value as "ALL" | "BILLING" | "FREE")}
            className="h-10 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] px-3 text-xs font-medium text-[#111111] focus:border-[#C2410C] focus:outline-none cursor-pointer"
          >
            <option value="ALL">Toute facturation</option>
            <option value="BILLING">Facturées (Payantes)</option>
            <option value="FREE">Période Gratuite (0 F)</option>
          </select>
        </div>
      </div>

      {/* ── TABLEAU PRO DES ENTREPRISES ───────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] px-5 py-3.5 bg-[#FBFBFA]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#111111]">Entreprises Partenaires</h2>
            <span className="rounded-full bg-[#111111] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              {filtered.length}
            </span>
          </div>
          <span className="text-xs text-[#787774]">
            {filtered.length === companies.length
              ? `Total : ${companies.length} enregistrée(s)`
              : `${filtered.length} filtrée(s) sur ${companies.length}`}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F3] text-[#787774]">
              <BuildingOfficeIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-[#111111]">
              Aucune entreprise ne correspond à votre recherche
            </p>
            <p className="text-xs text-[#787774]">
              Essayez de modifier vos filtres ou créez une nouvelle entreprise partenaire.
            </p>
            <div className="pt-2">
              <Link
                href="/admin/companies/new"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#C2410C] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#9A3412]"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Nouvelle entreprise</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EAEAEA] bg-[#F7F6F3] font-mono text-[10px] uppercase tracking-wider text-[#787774]">
                <tr>
                  <th className="px-5 py-3">Entreprise</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Admin d&apos;enseigne</th>
                  <th className="px-4 py-3">Tarif appliqué</th>
                  <th className="px-4 py-3">Date de création</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {filtered.map((c) => {
                  const initial = c.name.slice(0, 1).toUpperCase();
                  const formattedDate = new Date(c.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr
                      key={c.id}
                      className="group transition-colors hover:bg-[#FBFBFA]"
                    >
                      {/* Entreprise name & slug */}
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/companies/${c.id}`}
                          className="flex items-center gap-3"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111111] font-bold text-xs text-white group-hover:bg-[#C2410C] transition-colors">
                            {initial}
                          </span>
                          <div>
                            <span className="font-bold text-[#111111] group-hover:text-[#C2410C] transition-colors">
                              {c.name}
                            </span>
                            <span className="block font-mono text-[10px] text-[#787774]">
                              ofika://{c.slug}
                            </span>
                          </div>
                        </Link>
                      </td>

                      {/* Statut entreprise */}
                      <td className="px-4 py-3.5">
                        {c.status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-2.5 py-0.5 font-medium text-[#15803D]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DC2626]/20 bg-[#FEF2F2] px-2.5 py-0.5 font-medium text-[#DC2626]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                            <span>Suspendue</span>
                          </span>
                        )}
                      </td>

                      {/* Statut activation premier admin */}
                      <td className="px-4 py-3.5">
                        {c.activeAdmins > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#15803D]/20 bg-[#F0FDF4] px-2 py-0.5 font-medium text-[#15803D]">
                            <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>Compte activé</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#B45309]/20 bg-[#FFFBEB] px-2 py-0.5 font-medium text-[#B45309]">
                            <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>En attente du PIN</span>
                          </span>
                        )}
                      </td>

                      {/* Facturation barème */}
                      <td className="px-4 py-3.5">
                        {c.billingEnabled ? (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#111111]">
                            <span>{c.pricePerDelivery.toLocaleString("fr-FR")} F CFA</span>
                            <span className="text-[10px] text-[#787774]">/ course</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-[#EAEAEA] bg-[#F7F6F3] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#787774]">
                            Gratuite (0 F)
                          </span>
                        )}
                      </td>

                      {/* Date de création */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#787774]">
                        {formattedDate}
                      </td>

                      {/* Action rapide */}
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/admin/companies/${c.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-[#EAEAEA] bg-white px-2.5 text-xs font-semibold text-[#111111] hover:border-[#111111] hover:bg-[#FBFBFA] transition-all"
                        >
                          <span>Gérer</span>
                          <ChevronRightIcon className="h-3.5 w-3.5 text-[#787774]" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
