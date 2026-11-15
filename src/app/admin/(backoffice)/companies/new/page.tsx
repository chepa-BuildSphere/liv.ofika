import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { CreateCompanyForm } from "./create-company-form";

export const metadata: Metadata = { title: "Nouvelle entreprise — Ofika" };

export default function NewCompanyPage() {
  return (
    <div className="max-w-xl">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← Tableau de bord
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nouvelle entreprise</h1>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
          <Guarded />
        </Suspense>
      </div>
    </div>
  );
}

async function Guarded() {
  await requireAdmin();
  return <CreateCompanyForm />;
}
