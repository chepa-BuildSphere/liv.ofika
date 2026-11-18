import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/admin-session";
import { getPlatformPricePerDelivery } from "@/lib/billing/billing";
import { ChevronRightIcon, BuildingOfficeIcon } from "@/components/icons";
import { CreateCompanyForm } from "./create-company-form";

export const metadata: Metadata = { title: "Nouvelle Entreprise Partenaire — Super Admin Ofika" };

export default function NewCompanyPage() {
  return (
    <div className="max-w-2xl space-y-6">
      {/* ── BREADCRUMB ─────────────────────────────────────────────────── */}
      <nav aria-label="Fil d'ariane" className="flex items-center gap-2 text-xs text-[#787774]">
        <Link href="/admin" className="hover:text-[#111111] transition-colors">
          Console Super Admin
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <Link href="/admin" className="hover:text-[#111111] transition-colors">
          Entreprises
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#111111]">Nouvelle entreprise</span>
      </nav>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[#EAEAEA] pb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-white">
            <BuildingOfficeIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111111]">
              Ajouter une Entreprise Partenaire
            </h1>
            <p className="text-xs text-[#787774]">
              Créez l&apos;organisation cliente et générez le lien d&apos;activation pour son premier administrateur.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#EAEAEA] bg-white p-6 sm:p-8 shadow-xs">
        <Suspense
          fallback={
            <div className="flex h-32 items-center justify-center">
              <span className="text-xs text-[#787774]">Vérification des droits Super Admin…</span>
            </div>
          }
        >
          <Guarded />
        </Suspense>
      </div>
    </div>
  );
}

async function Guarded() {
  await requireAdmin();
  const defaultPrice = await getPlatformPricePerDelivery(db);
  return <CreateCompanyForm defaultPrice={defaultPrice} />;
}
