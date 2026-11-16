import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import {
  DeliveryError,
  listReturningDeliveriesGroupedByCourier,
} from "@/lib/deliveries/deliveries";
import {
  AlertTriangleIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { ReturnsClient } from "./returns-client";

export const metadata: Metadata = { title: "Réception des Retours au Dépôt — Ofika Delivery" };

export default function ReturnsPage() {
  return (
    <div className="space-y-6">
      {/* ── BREADCRUMB ─────────────────────────────────────────────────── */}
      <nav aria-label="Fil d'ariane" className="flex items-center gap-2 text-xs text-[#787774]">
        <Link href="/dashboard" className="hover:text-[#111111] transition-colors">
          Tableau de bord
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#111111]">Retours au dépôt</span>
      </nav>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[#EAEAEA] pb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-[#B45309]">
            <AlertTriangleIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111111]">
              Réception des Retours au Dépôt
            </h1>
            <p className="text-xs text-[#787774]">
              Contrôle physique des colis refusés ou non livrés. Scannez le QR code du bordereau pour solder la tournée du livreur.
            </p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-48 items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-[#787774]">
              <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-ping" />
              <span>Chargement du registre des retours…</span>
            </div>
          </div>
        }
      >
        <ReturnsContent />
      </Suspense>
    </div>
  );
}

async function ReturnsContent() {
  const user = await requireUser();

  try {
    const data = await listReturningDeliveriesGroupedByCourier(db, user);
    return <ReturnsClient groups={data.groups} recentReceived={data.recentReceived} />;
  } catch (e) {
    if (e instanceof DeliveryError && e.code === "FORBIDDEN") {
      return (
        <div role="alert" className="rounded-xl border border-[#B45309]/20 bg-[#FFFBEB] p-5 text-xs text-[#B45309]">
          {e.message}
        </div>
      );
    }
    throw e;
  }
}
