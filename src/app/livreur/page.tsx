import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db";
import { requireCourier } from "@/lib/auth/courier-session";
import { listCourierDeliveries } from "@/lib/deliveries/deliveries";
import {
  PackageIcon,
  CheckCircleIcon,
  TruckIcon,
  BanknotesIcon,
  LogOutIcon,
} from "@/components/icons";
import { courierLogoutAction } from "./connexion/actions";
import { CourierDeliveriesClient } from "./courier-deliveries-client";

export const metadata: Metadata = {
  title: "Ma Tournée — Espace Livreur Ofika Delivery",
  description: "Console mobile du livreur : preuve QR bilatérale, géolocalisation et encaissements.",
};

export default function CourierHomePage() {
  return (
    <Suspense fallback={<CourierLoadingSkeleton />}>
      <CourierHome />
    </Suspense>
  );
}

function CourierLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-[#EAEAEA]" />
          <div className="h-4 w-28 rounded-md bg-[#EAEAEA]" />
        </div>
        <div className="h-9 w-24 rounded-lg bg-[#EAEAEA]" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-[#EAEAEA]" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-[#EAEAEA]" />
    </div>
  );
}

async function CourierHome() {
  const courier = await requireCourier();
  const deliveries = await listCourierDeliveries(db, courier);

  const initials = courier.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const totalCount = deliveries.length;
  const deliveredCount = deliveries.filter((d) => d.status === "DELIVERED").length;
  const pendingCount = deliveries.filter((d) =>
    ["ASSIGNED", "PICKED_UP", "ARRIVED"].includes(d.status),
  ).length;
  const codCollected = deliveries
    .filter((d) => d.status === "DELIVERED" && d.amountToCollect)
    .reduce((sum, d) => sum + (d.amountToCollect ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* ── CARTE PROFIL LIVREUR PRO & PREMIUM ──────────────────────────── */}
      <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#111111] font-mono text-base font-black text-white shadow-xs">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#111111]">
                  {courier.name}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-bold text-[#15803D]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#15803D] animate-pulse" />
                  <span>En service</span>
                </span>
              </div>
              <p className="mt-0.5 font-mono text-xs text-[#787774]">
                {courier.phone} · Abidjan
              </p>
            </div>
          </div>

          <form action={courierLogoutAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] px-3 text-xs font-semibold text-[#787774] hover:border-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors"
              title="Quitter la session livreur"
            >
              <LogOutIcon className="h-3.5 w-3.5" />
              <span>Quitter</span>
            </button>
          </form>
        </div>

        {/* ── 4 KPI CARDS MOBILE RAPIDES DU LIVREUR ──────────────────────── */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-[#EAEAEA]">
          {/* Total tournée */}
          <div className="rounded-xl border border-[#EAEAEA] bg-[#FBFBFA] p-3 text-center">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#787774]">
              Total colis
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-[#111111] tabular-nums">
              {totalCount}
            </span>
          </div>

          {/* Livrées avec succès */}
          <div className="rounded-xl border border-[#15803D]/20 bg-[#F0FDF4] p-3 text-center">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#15803D]">
              Livrées (QR)
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-[#15803D] tabular-nums">
              {deliveredCount}
            </span>
          </div>

          {/* À livrer */}
          <div className="rounded-xl border border-[#1D4ED8]/20 bg-[#EFF6FF] p-3 text-center">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#1D4ED8]">
              Restants
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-[#1D4ED8] tabular-nums">
              {pendingCount}
            </span>
          </div>

          {/* COD encaissé */}
          <div className="rounded-xl border border-[#EAEAEA] bg-[#FBFBFA] p-3 text-center">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#787774]">
              COD encaissé
            </span>
            <span className="mt-1 block text-base font-extrabold text-[#111111] font-mono tabular-nums">
              {codCollected.toLocaleString("fr-FR")} F
            </span>
          </div>
        </div>
      </div>

      {/* ── CLIENT INTERACTIF DES COURSES DE LA TOURNÉE ────────────────── */}
      <CourierDeliveriesClient
        companies={courier.companies}
        deliveries={deliveries.map((d) => ({
          id: d.id,
          companyId: d.companyId,
          reference: d.reference,
          recipientName: d.recipientName,
          recipientPhone: d.recipientPhone,
          address: d.address,
          district: d.district,
          packageDescription: d.packageDescription,
          amountToCollect: d.amountToCollect,
          comment: d.comment,
          status: d.status,
          proofMethod: d.proofMethod,
          currentAttempt: d.currentAttempt,
          pickedUpAt: d.pickedUpAt,
        }))}
      />
    </div>
  );
}
